# Backend Gereksinimleri — DM Onarımı + Kişisel Ses Görüşmesi

Bu dosya, frontend'de planlanan üç aşama için **backend tarafında gereken
değişiklikleri** listeler. Her madde; mevcut durum, istenen durum ve neden
gerektiği ile birlikte yazılmıştır.

**Doğrulama yöntemi:** MessageService'in swagger dokümanı (`:5107/swagger/v1/swagger.json`)
okundu ve route'lar hem doğrudan servise (`:5107`) hem gateway üzerinden (`:5000`)
HTTP ile sınandı. Yani aşağıdaki "mevcut durum" tespitleri tahmin değil, ölçüm.

**Tarih:** 2026-07-25

---

## 0. Kritik bulgu — Gateway'in erken 401'i teşhisi imkânsızlaştırıyor

**Öncelik: Yüksek.** Bu madde diğer her şeyi maskelediği için ilk sırada.

### Ölçüm

| İstek | `:5107` (servis) | `:5000` (gateway) |
| --- | --- | --- |
| `/api/Dm/conversations` (var olan) | **401** | **401** |
| `/api/Nonexistent` (olmayan) | **404** | **401** |

Gateway, route eşleştirmesinden **önce** authentication çalıştırıyor. Sonuç:
var olmayan bir route ile yetkisiz bir istek **aynı** cevabı veriyor.

### Neden önemli

Frontend 3 sürüm boyunca var olmayan `/message/dm/channelId/{id}` route'unu
çağırdı ve kimse fark etmedi — çünkü gateway 404 yerine 401 döndü. Üstelik
frontend'deki `api.js` interceptor'ı 401'i "token süresi doldu" sanıp refresh
deneyip başarısız olunca kullanıcıyı login sayfasına attı. Yani **gerçek hata
(route yok), alakasız bir belirti (oturum düştü) olarak göründü.**

### İstenen

Ocelot pipeline'ında route eşleştirme, authentication'dan **önce** çalışsın;
eşleşmeyen route `404` dönsün. Alternatif olarak, eşleşmeyen istekler için
`ProblemDetails` gövdesinde ayırt edici bir kod (`"title": "Route not found"`)
döndürülsün ki client 401'i yanlış yorumlamasın.

> Bu düzeltilmezse, aşağıdaki maddelerin hiçbiri güvenilir şekilde test
> edilemez — her hata 401 olarak görünmeye devam eder.

---

## 1. Aşama 1 — DM mesajlaşmasının onarımı

### 1.1 Route uyuşmazlığı (frontend düzeltecek, backend'de iş yok)

Frontend uydurma route'lar çağırıyordu. Gerçek route'lar swagger'dan doğrulandı:

| Frontend'in çağırdığı (yanlış) | Gerçekte var olan (doğru) | Durum |
| --- | --- | --- |
| `POST /message/dm/conversations` | `POST /message/api/Dm/conversations` | yol yanlış |
| `GET /message/dm/conversations` | `GET /message/api/Dm/conversations` | yol yanlış |
| `GET /message/dm/channelId/{id}` | `GET /message/api/Message?channelId=` | **route yok (404)** |
| `DELETE /message/dm/{messageId}` | — | **route yok** |
| `PUT /message/dm/{messageId}` | — | **route yok** |

**Backend'de değişiklik gerekmiyor** — frontend gerçek route'lara çekilecek.
`GET /api/Message?channelId=` (clanId'siz) zaten planın öngördüğü "mevcut
endpoint DM için yeniden kullanılır" davranışını sağlıyor.

### 1.2 `POST /api/Dm/conversations` response şeması belgelenmemiş — ❗ NETLEŞTİRİLMELİ

**Mevcut durum:** Swagger'da `200` cevabının **gövde şeması tanımlı değil**
(`responses: {'200': {}}` — content yok). `DmConversationCreateDto` sadece
`{ otherUserId }` alıyor, ama ne döndüğü belirsiz.

**Frontend'in beklediği:**
```json
{ "conversationId": "…", "otherUserId": "…" }
```

**İstenen:** Dönen gövde en az `conversationId` içermeli ve swagger'da
`ProducesResponseType` ile belgelenmeli. Konuşma listesi (`GET`) için beklenen:
```json
[{ "conversationId": "…", "otherUserId": "…", "otherUserName": "…",
   "otherAvatarUrl": "…", "lastMessage": "…", "lastMessageAt": "…" }]
```

**Kritik soru:** `conversationId`, `MessageDto.channelId` ile **aynı değer mi?**
Frontend'in tüm mimarisi buna dayanıyor — DM mesajları `channelId =
conversationId` varsayımıyla yükleniyor ve gönderiliyor. Farklıysa haber verin,
frontend'de eşleme katmanı gerekir.

### 1.3 `MessageHub.SendMessage`'ın `clanId = null` davranışı — ❗ NETLEŞTİRİLMELİ

**Mevcut durum:** Hub metotları HTTP üzerinden keşfedilemediği için bu tek
bilinmeyen olarak kaldı. Frontend DM gönderirken şunu çağırıyor:

```js
connection.invoke('SendMessage', conversationId, null, message)
//                                ^channelId    ^clanId=null
```

**Gereken:** `SendMessage(channelId, clanId, message)` imzasında `clanId`'nin
`null` gelmesi **desteklenmeli** ve şu davranışı göstermeli:

- `clanId == null` → mesaj DM olarak kaydedilsin (`MessageDto.clanId = null`)
- Yayın (broadcast) `channelId` (yani `conversationId`) grubuna yapılsın
- Exception atılmasın, sessizce düşürülmesin

**Desteklenmiyorsa** iki seçenek var, hangisini tercih ettiğinizi bildirin:
- **(a)** `clanId` nullable yapılsın (tercih edilen — imza değişmez)
- **(b)** Ayrı bir `SendDirectMessage(conversationId, message)` hub metodu
  eklensin; frontend DM'lerde onu çağırır

> Frontend Aşama 1'de (a) varsayımıyla ilerleyecek ve hub reddederse REST
> fallback'e düşecek şekilde savunmacı yazılacak. Ama kalıcı çözüm backend'de.

### 1.4 `GET /api/Message` yetkilendirmesi — ⚠️ GÜVENLİK

**Mevcut durum:** `GET /api/Message?channelId={id}` yalnızca `channelId` alıyor.
Swagger'da üyelik doğrulaması olduğuna dair bir işaret yok ve
`guncelleme-plani.md` madde 3 bunu zaten "bilinen sınırlama" olarak not etmiş:

> *"MessageHub/MessageController'da henüz gerçek clan/channel/dm üyelik
> doğrulaması yok — teorik olarak yetkisiz bir kullanıcı bir DM
> conversationId'sini tahmin edip mesajlara erişebilir."*

**İstenen:** `GET /api/Message` çağrısında JWT'den alınan kullanıcı, istenen
`channelId`'nin (DM ise `conversationId`) katılımcısı mı diye doğrulanmalı;
değilse `403` dönmeli. Aynısı `SendMessage` hub metodu için de geçerli.

**Bu frontend'de çözülemez.** DM içerikleri özel kabul edildiği için Aşama 1'in
canlıya çıkmadan önce kapatılması gereken madde budur.

### 1.5 `MessageDto.id` tipi tutarsızlığı — düşük öncelik

`MessageDto.id` swagger'da `string`, ancak `components.schemas` içinde ayrıca
bir `ObjectId` şeması (`{timestamp, creationTime}`) tanımlı. Frontend'deki
`normalizeMessage` bu yüzden hem düz string hem `{$oid}` hem
`{timestamp,machine,pid,increment}` biçimlerini elle çözmek zorunda kalmış.

**İstenen:** `id` her zaman düz `string` (ObjectId'nin `.ToString()` hâli)
serialize edilsin. Frontend'deki savunmacı kod korunacak, ama tutarlı hâle
gelirse ileride sadeleşir.

---

## 2. Aşama 2 — Space soyutlaması

**Backend'de zorunlu değişiklik yok.** Bu aşama tamamen frontend'in iç
mimarisiyle ilgili: `ChannelSidebar`/`ChatArea`/`VoiceChannel` bileşenleri
`spaceId` alacak şekilde ayrılacak, `ClanSpace` rol/davet kodunu tutacak,
`DirectSpace` o koda hiç erişmeyecek.

Backend'in mevcut clan ve DM endpoint'leri olduğu gibi kullanılacak; DM'ler
**klan tablosuna yazılmayacak** (mimari değerlendirmede reddedildi — rol/davet/
üye-atma modelinin DM'e sızmaması için).

### 2.1 İsteğe bağlı iyileştirme (şart değil)

DM konuşma listesi (`GET /api/Dm/conversations`) `otherUserName` ve
`otherAvatarUrl` döndürüyorsa frontend ek bir kullanıcı sorgusu yapmaz.
Döndürmüyorsa frontend `UserService` ile ayrıca çekecek — çalışır ama fazladan
istek demek. Madde 1.2'deki şema netleşince belli olacak.

---

## 3. Aşama 3 — DM'de sesli görüşme

Kapsam: DM başına **tek kalıcı ses odası**. Çoklu kanal yok, kanal
oluşturma/silme yok.

### 3.1 Ses token'ı DM odaları için verilmeli — ❗ GEREKLİ

**Mevcut durum:**
```
GET /voice/join-room/{roomId}?userId=…&userName=…
```
`roomId` şu an `voiceChannelId` (bir klan ses kanalının ID'si). Bu
`voiceChannelId`'ler `ClanService`'te tutuluyor.

**Gereken:** DM'in ses odası için de token üretilebilmeli. En az müdahaleli yol:

- `roomId` olarak **`dm-{conversationId}`** kabul edilsin (yeni endpoint gerekmez)
- VoiceService, `dm-` önekli `roomId` için yetkiyi **klan üyeliğinden değil**,
  DM katılımcılığından doğrulasın: JWT'deki kullanıcı o `conversationId`'nin
  iki tarafından biri mi?
- Değilse `403`

> Alternatif olarak `GET /voice/join-dm-room/{conversationId}` gibi ayrı bir
> endpoint de olur. Hangisini tercih ederseniz; frontend'de tek satırlık fark.

**Neden gerekli:** Bu olmadan DM'de sesli görüşme hiç çalışmaz — LiveKit
token'ı alınamaz.

### 3.2 Presence — DM ses odası katılımcıları

**Mevcut durum:** `PresenceHub` şu imzalarla çalışıyor:
```
JoinVoiceChannel(clanId, voiceChannelId, userName)
LeaveVoiceChannel()
GetVoiceChannelParticipants(clanId)
SubscribeToClans(clanIds[])
```
Hepsi `clanId` merkezli.

**Gereken:** DM ses odasında kimin bağlı olduğunu karşı tarafın görmesi için:

- `JoinVoiceChannel`'ın `clanId = null` ile çağrılabilmesi (DM odası için
  `voiceChannelId = dm-{conversationId}`), **veya**
- Ayrı `JoinDirectVoice(conversationId, userName)` / `LeaveDirectVoice()` metotları

Ayrıca DM karşı tarafının olayları alabilmesi için bir abonelik yolu gerekiyor:
`SubscribeToConversations(conversationIds[])` gibi.

**Öncelik notu:** Bu madde **Aşama 3 için şart değil.** Presence olmadan da
sesli görüşme çalışır — LiveKit'in kendi katılımcı listesi odaya *girdikten
sonra* kimin bağlı olduğunu zaten veriyor. Eksik olan tek şey, odaya girmeden
önce "karşı taraf şu an seste mi?" bilgisini görebilmek.

Yani:
- **3.1 olmadan** → sesli görüşme çalışmaz (bloklayıcı)
- **3.2 olmadan** → çalışır, sadece "seste" göstergesi olmaz (iyileştirme)

Frontend Aşama 3'ü 3.2 olmadan çalışacak şekilde yazacak; 3.2 gelirse gösterge
eklenir.

---

## Özet — Backend yapılacaklar listesi

| # | Madde | Öncelik | Aşama | Bloklayıcı mı? |
| --- | --- | --- | --- | --- |
| 0 | Gateway: route eşleşmezse 404 dönsün (401 değil) | **Yüksek** | Tümü | Teşhisi bloklar |
| 1.2 | `POST /api/Dm/conversations` response şeması + `conversationId == channelId` teyidi | **Yüksek** | 1 | ❗ Evet |
| 1.3 | `SendMessage`'da `clanId = null` desteği | **Yüksek** | 1 | ❗ Evet (mesaj gönderme) |
| 1.4 | DM/kanal üyelik doğrulaması (`GET /api/Message` + hub) | **Yüksek** | 1 | ⚠️ Güvenlik — canlı öncesi |
| 1.5 | `MessageDto.id` her zaman düz string | Düşük | 1 | Hayır |
| 2.1 | DM listesinde `otherUserName`/`otherAvatarUrl` | Düşük | 2 | Hayır |
| 3.1 | `dm-{conversationId}` için ses token'ı + yetki | **Yüksek** | 3 | ❗ Evet |
| 3.2 | Presence'ta DM ses odası desteği | Orta | 3 | Hayır (gösterge eksik kalır) |

### Frontend'in cevap beklediği 3 soru

1. **`conversationId` ile `MessageDto.channelId` aynı değer mi?** (madde 1.2)
2. **`SendMessage`, `clanId = null` kabul ediyor mu?** Etmiyorsa ayrı hub metodu
   mu eklenecek? (madde 1.3)
3. **Ses token'ı için `dm-{conversationId}` mi, ayrı endpoint mi?** (madde 3.1)

Bu üçü netleşene kadar frontend savunmacı varsayımlarla ilerleyecek; her biri
kodda `// BACKEND-DOĞRULA:` yorumuyla işaretlenecek.

---

## 4. 2026-07-25 (devam) — Canlı testte bulunan yeni sorunlar

Kullanıcı gerçek tarayıcı oturumunda test etti. Üç yeni bulgu.

### 4.1 `POST /message/api/Dm/conversations` → 404 (gerçek oturumda)

**Gözlem:** Kullanıcının tarayıcısında (geçerli JWT ile) bu istek **404**
döndü — 401 değil. Bu önemli bir ayrım: makinemden yaptığım ölçümde aynı route
**401** dönüyordu (token'sız istek, beklenen). Kullanıcı gerçek token'la 404
aldıysa iki ihtimal var:

- **(a)** Route gerçekten yok ve sadece auth kontrolü path'ten önce/sonra
  tutarsız çalışıyor (bazı yollarda 401, bazılarında route-not-found 404 —
  bu da madde 0'ın neden acil olduğunu bir kez daha gösteriyor), **veya**
- **(b)** Ocelot downstream template'i benim tahmin ettiğimden farklı bir
  path'e yönlendiriyor ve gerçek servis tarafı o path'i tanımıyor.

Frontend'de fallback mekanizması iki biçimi de dener
(`/message/api/Dm/conversations` ve `/message/dm/conversations`), 404 alınca
otomatik ikinciyi dener. Kullanıcının ekranında **sadece ilk deneme**
görünüyor — teşhis logu eklendi (`DmService.js`, `console.debug`), sonucu
bekleniyor. Ama kod tarafı ne olursa olsun, **gerçek soru şu:**

**İstenen:** `POST /api/Dm/conversations`'ın MessageService'te gerçekten var
olduğu ve gateway üzerinden (`http://localhost:5000/message/api/Dm/conversations`,
geçerli bir JWT ile) `200`/`201` döndüğü doğrulanmalı. En hızlı doğrulama:

```bash
curl -X POST http://localhost:5000/message/api/Dm/conversations \
  -H "Authorization: Bearer <geçerli-token>" \
  -H "Content-Type: application/json" \
  -d '{"otherUserId":"<geçerli-user-id>"}'
```

Eğer bu da 404 dönerse, route Ocelot config'inde (`ocelot.json` /
`ocelot.*.json`) `/message` prefix'i altında tanımlı değil demektir — DM
Controller'ın route'u swagger'da görünüyor olsa da gateway'e hiç
eklenmemiş olabilir.

### 4.2 Presence: arkadaşlar sekmesinde online/offline hiç çalışmıyordu — ✅ frontend'de bulundu ve düzeltildi

**Kök neden (backend'de değil, frontend'de):** `PresenceHub.GetOnlineUsers`
şimdiye kadar SADECE klan üyelerinin ID'leriyle çağrılıyordu
(`MainLayout.jsx`'teki iki çağrı noktası). Arkadaş listesindeki kullanıcıların
ID'leri **hiçbir zaman** sorgulanmıyordu — bir arkadaş ortak klanınızda
değilse (DM'in doğası gereği sık rastlanan durum), online durumu sunucudan
hiç istenmiyordu.

Ek olarak: `OnlineUsers` event handler'ı gelen listeyle state'i TAMAMEN
DEĞİŞTİRİYORDU (`new Set(userIds)`). Klan sorgusu ve arkadaş sorgusu ayrı
zamanlarda tetiklendiği için, ikinci sorgunun cevabı birincisinin sonucunu
siliyordu.

**Frontend'de yapılan düzeltme:**

- Arkadaş listesi yüklendiğinde/değiştiğinde de `GetOnlineUsers(friendIds)`
  çağrılıyor artık (yeni bir `useEffect`, `friends` state'ine bağlı).
- `OnlineUsers` handler'ı artık SADECE birleştiriyor (`prev ∪ userIds`), asla
  silmiyor. Çevrimdışı olma bilgisi ayrı ve güvenilir bir kaynaktan geliyor:
  `UserOffline` tekil event'i.

**Backend'de kontrol edilmesi gereken:** `GetOnlineUsers(userIds)` çağrısının
cevabı olan `OnlineUsers` event'i, sorgulanmayan ama önceden online olan
kullanıcılar hakkında **hiçbir şey söylememeli** (ne var ne yok) — sadece
sorgulanan ID'lerden hangilerinin şu an online olduğunu döndürmeli. Eğer
backend zaten böyle çalışıyorsa (muhtemel), yukarıdaki frontend düzeltmesi
yeterli. Ekstra bir backend değişikliği gerekmiyor.

### 4.3 Mesaj bildirimleri — sadece konuşma açıkken çalışıyor ⚠️ MİMARİ SINIRLAMA

**Mevcut durum:** `ChatArea` bir kanala/DM'e `SignalRService.joinChannel(id)`
ile katılıyor ve `ReceiveMessage` event'ini SADECE o `ChatArea` instance'ı
mount'tayken dinliyor. Yani:

- Kullanıcı klan görünümündeyken birisi ona DM gönderirse → bildirim YOK
  (DM'in `ChatArea`'sı mount değil, o kanala hiç `JoinChannel` çağrılmamış).
- Kullanıcı A klanındayken B klanındaki bir kanala mesaj gelirse → bildirim YOK.
- Kullanıcı tam o an açık olan konuşmaya bakıyorsa → bildirim VAR (ses +
  masaüstü bildirimi, `useDesktopMessageNotifications`).

**Bu frontend mimarisinin doğal bir sonucu, backend hatası değil** — ama
kullanıcının "gönderilen mesajlarda bildirim olmalı" isteği tam olarak bunu
kapsıyorsa, mevcut model yetersiz. İki çözüm yolu var, hangisini istediğinize
göre backend gereksinimi değişir:

**Seçenek A — Global bildirim kanalı (önerilen):**
`MessageHub`'a kullanıcı bağlandığında (herhangi bir `JoinChannel`
çağrısından BAĞIMSIZ olarak), kullanıcının **üye olduğu tüm klan kanalları +
tüm DM konuşmaları** için otomatik bir "bildirim grubu"na eklenmesi gerekir.
Böylece `ReceiveMessage`'ın yanına (veya onun yerine) `MessageNotification`
gibi hafif bir event eklenir — `{ channelId, clanId, senderId, senderName,
preview }` içerir ve kullanıcı o an o kanalda olmasa bile ulaşır. Frontend
`MainLayout` seviyesinde bunu dinleyip masaüstü bildirimi + rozet gösterir.

- Backend'de gerekli: `MessageHub.OnConnectedAsync`'te kullanıcıyı
  `user-{userId}` grubuna ekleyin (zaten `Context.UserIdentifier` JWT'den
  geliyor — mevcut). Mesaj gönderilirken alıcı(lar) `channelId` grubuna DEĞİL,
  ayrıca `user-{alıcıId}` grubuna da bir bildirim event'i yayınlansın.
- Bu aynı zamanda madde 1.4'teki (üyelik doğrulama) işi kolaylaştırır: kimin
  hangi kanalın/DM'in gerçek katılımcısı olduğu zaten bu grup üyeliğinden
  biliniyor olur.

**Seçenek B — Frontend tüm konuşmalara önceden katılır (backend değişikliği
gerektirmez, ama ölçeklenmez):**
`MainLayout` açılışta kullanıcının tüm klan kanallarına VE tüm DM
konuşmalarına `JoinChannel` çağırır, arka planda hepsini dinler. Kanal/DM
sayısı arttıkça SignalR grup üyeliği şişer; küçük kullanıcı tabanında sorun
olmaz ama uzun vadede A'ya geçilmeli.

**Frontend şimdilik B'yi uygulayabilir** (backend'de hiçbir şey beklemeden),
ama gerçek çözüm A. Hangisini istediğinizi belirtin — B'yi hemen
uygulayabilirim, A için üstteki backend değişikliği gerekiyor.

---

## Özet (güncellenmiş) — Backend yapılacaklar listesi

| # | Madde | Öncelik | Durum |
| --- | --- | --- | --- |
| 0 | Gateway: route eşleşmezse 404 dönsün (401 değil) | **Yüksek** | Açık — 4.1'i de etkiliyor |
| 1.2 | `POST /api/Dm/conversations` response şeması + `conversationId == channelId` teyidi | **Yüksek** | Açık |
| 1.3 | `SendMessage`'da `clanId = null` desteği | **Yüksek** | Açık |
| 1.4 | DM/kanal üyelik doğrulaması | **Yüksek** | Açık — güvenlik |
| 3.1 | `dm-{conversationId}` için ses token'ı + yetki | **Yüksek** | Açık |
| 4.1 | `POST /api/Dm/conversations`'ın gateway üzerinden gerçek token'la 200 döndüğü doğrulanmalı | **Yüksek** | ❗ Yeni — canlı testte 404 alındı |
| 4.2 | Presence online/offline | — | ✅ Frontend'de çözüldü, backend'de aksiyon gerekmiyor |
| 4.3 | Global mesaj bildirimi (Seçenek A: `user-{userId}` grubu) | Orta | ❗ Yeni — kapsam netleşmeli |
