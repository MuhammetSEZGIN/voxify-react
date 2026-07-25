# Güncelleme Planı

Bu dosya, kod tabanı taramasında tespit edilen sorunları ve yapılması planlanan
iyileştirmeleri önem sırasına göre listeler. Tamamlanan maddeler kısa bir kayıt
olarak bırakılır; kalan/yeni maddeler tam detayla listelenir.

## Tamamlanan Maddeler

1. **Ekran paylaşımı ses sızıntısı** — ✅ `useScreenShare.js` ve `VoiceChannel.jsx`'teki
   `setScreenShareEnabled` çağrılarına `echoCancellation`/`noiseSuppression`/`autoGainControl`
   audio constraint'leri eklendi.
2. **`api.js` 401 refresh akışı** — ✅ Response interceptor artık refresh-token
   akışını deniyor (bağımsız axios çağrısıyla, circular import'suz), eşzamanlı
   401'ler tek `refreshPromise` paylaşıyor, başarısızsa login'e yönlendiriyor.
3. **`LiveMessageService.js` listener sızıntısı** — ✅ `pendingListeners` kuyruğu
   bağlantı kurulup dinleyiciler kaydedildikten hemen sonra temizleniyor.
4. **`permissions.js` tutarsızlığı** — ✅ Hiçbir yerde kullanılmadığı doğrulanıp
   dosya tamamen kaldırıldı; tek yetkilendirme kaynağı `MainLayout.jsx`.
5. **`AuthContext.jsx` token senkron sorunu** — ✅ `persistSet`/`persistRemove`
   artık `authStore` hatalarını logluyor; `localStorage` yazımı store hatasından
   bağımsız her zaman uygulanıyor.
6. **`PresenceService.js` gereksiz reconnect** — ✅ `MainLayout.jsx`'e `useMemo`'lanmış
   `clanIdsKey` eklendi, presence effect artık `clans` referansı yerine bu stabil
   anahtara bağımlı.
7. **`VoiceService.js` hata mesajları** — ✅ Network/HTTP/beklenmeyen hatalar
   Türkçe kullanıcı mesajlarına çevriliyor; `AbortError` olduğu gibi geçiyor.

---

## 8. Kişisel arama (kullanıcı arama) özelliği — ✅ Tamamlandı (madde 3 ile birlikte)

`GET /identity/user/search?q=...&page=...&limit=...` (`UserService.searchUsers`)
ve [FriendsPanel.jsx](src/components/friends/FriendsPanel.jsx)'teki "Arkadaş
Ekle" sekmesi olarak uygulandı — ayrı bir arama sayfası/route yerine arkadaş
ekleme akışının bir parçası oldu (aşağıdaki "Sıradaki Özellikler" madde 3'e
bakınız). Sonuçlarda online/offline durumu henüz gösterilmiyor (arkadaş
listesindeki gibi `onlineUserIds` ile eşleştirilebilir, küçük bir ek).

---

## Sıradaki Özellikler (Kullanıcı İsteği — 2026-07-22)

**Önemli düzeltme:** Backend bu repoda **değil** varsayımı yanlıştı — backend
tam bir microservice mimarisi olarak mevcut (IdentityService, ClanService,
MessageService, PresenceService, VoiceService, Ocelot gateway). Gerçek kontrat
[guncelleme-plani-backend.md](guncelleme-plani-backend.md)'de tarandı ve
aşağıdaki maddeler o dokümandaki gerçek route'lara göre güncellendi.

### 1. Şifre değiştirme + e-posta doğrulama + Profil/Avatar — ✅ Tamamlandı (gerçek kontrat ile)

Backend tarafı (`guncelleme-plani-backend.md` madde 0-1) uygulandı: `UserController`/
`AuthController` artık `[Authorize]` + JWT claim tabanlı, `Bio` alanı eklendi.
Frontend bu gerçek route'lara güncellendi:

- `POST /identity/user/change-password { currentPassword, newPassword }`
- `POST /identity/auth/resend-confirmation-email { userId }` — henüz login
  olmamış kullanıcılar için de çağrılabilir, bu yüzden JWT değil body'de userId.
- `GET /identity/auth/confirm-email?userId=...&token=...` — e-postadaki
  bağlantı hedefi (GET, POST değil).
- `GET /identity/user/me`
- `PUT /identity/user { userName, bio, avatarUrl }` — **route netleşmedi**,
  `UserController`'ın base route'una göre tahmin edildi; gerçek route farklıysa
  düzeltilmeli.

Eklenenler:

- [src/services/UserService.js](src/services/UserService.js) — yukarıdaki
  metodlar, `login`/`register` ile aynı `{ isSuccessfull, message, data }`
  zarfını kullanıyor.
- [src/components/account/AccountSettings.jsx](src/components/account/AccountSettings.jsx) —
  Profil, Şifre Değiştir, E-posta Doğrulama sekmeleri.
- [src/pages/ConfirmEmailPage.jsx](src/pages/ConfirmEmailPage.jsx) —
  `/confirm-email?userId=...&token=...` route'u.
- `AuthContext.jsx`'e `updateUser()` eklendi (profil güncellemesi sonrası
  in-memory + persisted user senkronu).
- `src/mocks/handlers.js` gerçek route'larla güncellendi.

**Kalan:** `PUT /identity/user`'ın gerçek route'u backend'den doğrulanmalı.

### 2. Profil sayfası + profil fotoğrafı — ✅ Tamamlandı

`AccountSettings` modalının "Profil" sekmesi (kullanıcı adı, biyografi, ImgBB
avatar yükleme). Başka kullanıcıların profiline bakma (public profile) henüz
yok — `guncelleme-plani-backend.md` madde 2'de not edildiği gibi, madde 8 ile
birlikte ele alınabilir.

### 3. Arkadaşlık (friendship) sistemi + DM — ✅ Frontend tamamlandı (backend kontratına göre)

Backend planında (madde 3) hibrit yaklaşım netleşti: `Friendship` tablosu
IdentityService'de, `DmConversation` MessageService'in Mongo'sunda, mevcut
`channelId`-merkezli SignalR/Mongo altyapısı DM'ler için de kullanılıyor
(sahte clanId hack'i yok).

**Uygulanan gerçek kontrat:**

- `GET /identity/friendship` — arkadaş listesi
- `GET /identity/friendship/requests` — `{ incoming, outgoing }`
- `POST /identity/friendship/requests { addresseeId }`
- `POST /identity/friendship/requests/{id}/accept` / `/reject`
- `DELETE /identity/friendship/{friendUserId}`
- `GET /identity/user/search?q=...&page=...&limit=...` — madde 8 ile ortak
- `POST /message/dm/conversations { otherUserId }` — idempotent, yoksa oluşturur
- `GET /message/dm/conversations` — DM konuşma listesi
- DM mesaj geçmişi/gönderme: **⚠️ doğrulanmadı.** Backend planı "mevcut
  `GET /api/Message?channelId={id}` endpoint'i clanId olmadan yeniden kullanılır"
  diyor, ama frontend'in çalışan implementasyonu `clanId`'yi URL path'ine
  gömüyor (`/message/channelId/{channelId}/clanId/{clanId}`) — path'te opsiyonel
  değil. Kullanıcı onayıyla `MessageService.js` DM'ler için `clanId=null`
  geçildiğinde `/message/dm/channelId/{channelId}` route'una düşecek şekilde
  güncellendi; **bu route backend'de gerçekten bu şekilde mi, doğrulanmalı.**
  `MessageHub.SendMessage(channelId, clanId, message)` de aynı şekilde
  `clanId=null` ile çağrılıyor (DM conversationId, `channelId` parametresi
  olarak geçiyor).

**Eklenenler:**

- [src/services/FriendService.js](src/services/FriendService.js) — friendship endpoint'leri.
- [src/services/DmService.js](src/services/DmService.js) — DM conversation yönetimi.
- [src/services/MessageService.js](src/services/MessageService.js) — `clanId=null`
  olduğunda DM route'una düşüyor (bkz. yukarıdaki doğrulanmamış not).
- [src/services/LiveMessageService.js](src/services/LiveMessageService.js) —
  `sendMessage(channelId, clanId, message)` imzası backend'in kontrat
  değişikliğine göre güncellendi (`senderId`/`userName` artık gönderilmiyor,
  JWT'den türetiliyor). `ChatArea.jsx`'teki 3 çağrı noktası da güncellendi.
- [src/components/friends/FriendsPanel.jsx](src/components/friends/FriendsPanel.jsx) —
  Arkadaşlar / İstekler / Arkadaş Ekle sekmeleri, arama madde 8'i de kapsıyor.
- [src/components/friends/DmChatArea.jsx](src/components/friends/DmChatArea.jsx) —
  DM sohbet paneli (temel gönder/al; GIF/dosya/düzenleme gibi `ChatArea.jsx`
  özellikleri kasıtlı olarak dahil edilmedi, DM route'u doğrulanınca eklenebilir).
- `MainLayout.jsx`: `ServerList`'teki "Home" butonu artık `FriendsPanel`'i
  açıyor (clan seçili değilken); arkadaş listesinden mesaj ikonuna tıklayınca
  `DmService.getOrCreateConversation` çağrılıp `DmChatArea` açılıyor.
- `src/mocks/handlers.js`'e friendship + user search mock'ları eklendi.

**Bilinen sınırlama (backend planından miras):** `MessageHub`/`MessageController`'da
henüz gerçek clan/channel/dm üyelik doğrulaması yok (backend madde 0'ın
ertelenen kısmı) — yani teorik olarak yetkisiz bir kullanıcı bir DM
conversationId'sini tahmin edip mesajlara erişebilir. Bu backend'de
çözülmeli, frontend'in yapabileceği bir şey yok.

**Sıradaki adım:** `PUT /identity/user` ve DM mesaj route'larının (`/message/dm/*`)
gerçek backend route'larıyla doğrulanması.

### 4. Floating UserBar modülü + Arkadaşlar sağ paneli — ✅ Tamamlandı (2026-07-25)

**a) UserBar ayrı modül oldu.** Kullanıcı çubuğu (avatar + mikrofon/kulaklık +
ses ayarları) daha önce üç yerde kopyalanmıştı: `ChannelSidebar` içinde iki kez
(klan seçili / seçili değil) ve `FriendsSidebar` içinde bir kez. Artık tek
bileşen ve `MainLayout`'ta bir kez render ediliyor:

- [src/components/layout/UserBar.jsx](src/components/layout/UserBar.jsx) — sol
  altta `position: fixed` floating çubuk; her sayfada (klan / Arkadaşlar / DM)
  aynı örnek, geçişte durum ve açık menü korunuyor.
- [src/components/layout/VolumeSlider.jsx](src/components/layout/VolumeSlider.jsx) —
  sürükleme sırasında yerel state, üst state'e `requestAnimationFrame` ile
  kare başına en fazla bir yazım.
- [src/hooks/useAudioDevices.js](src/hooks/useAudioDevices.js) — aygıt
  listeleme + `devicechange` dinleyicisi; liste imzası değişmedikçe yeni dizi
  referansı üretmez.

Performans düzenlemeleri:

- `UserBar` ve alt menüleri (`MicSettingsMenu`, `OutputSettingsMenu`,
  `UserMenu`) `React.memo`'lu — mesaj/presence kaynaklı MainLayout render'ları
  çubuğu yeniden çizmiyor.
- Tüm callback'ler MainLayout'ta `useCallback` ile stabil (`handleToggleMic`,
  `handleToggleDeafen`, `handleOpenProfileSettings`).
- Ses kaydırıcıları artık her `onChange`'de tüm ağacı (ChatArea, MemberList,
  VoiceChannel) render etmiyor.
- Aygıt listesi tek örnekten geliyor; menü her açılışta yeniden enumerate
  edilmiyor. Mikrofon izni yalnızca etiketler boşken bir kez isteniyor.
- Dışarı-tıklama/Escape dinleyicileri sadece bir menü açıkken bağlanıyor.
- `isDeafened` artık `MainLayout`'ta — sayfa değişiminde sıfırlanmıyor.

**b) Arkadaşlar sekmesi sağ panel.** Arkadaş listesi, klan içindeki
`clan-members` alanıyla aynı yerde ve aynı görsel dilde gösteriliyor:

- [src/components/friends/FriendsMemberList.jsx](src/components/friends/FriendsMemberList.jsx) —
  `MemberList.jsx` yapısını kullanır (256px sağ `aside`, arama kutusu,
  katlanabilir başlık, gruplu liste). Rol gruplaması yerine
  Çevrimiçi/Çevrimdışı gruplaması, satır üzerinde DM/arkadaşlıktan çıkarma.
- `MainLayout` sağ paneli koşullu render ediyor: Arkadaşlar sekmesinde
  `FriendsMemberList`, klanda `MemberList`.
- Sağ panelden bir arkadaşa tıklamak DM'i açıyor ve Arkadaşlar sekmesine
  geçiriyor (`handleOpenDm` içinde `setIsFriendsActive(true)`).

**Not:** `npm run lint` bu repoda çalışmıyor — ESLint 9.0.0 ile
`eslint.config.js`'in `eslint/config` import'u uyumsuz (bu değişikliklerden
bağımsız, önceden var olan bir sorun). Doğrulama `npm run build` ile yapıldı.

### 5. Arkadaşlar sayfası tek düzen + ChatArea birleştirme — ✅ Tamamlandı (2026-07-25)

**a) Kod tekrarı kaldırıldı: tek `ChatArea`.** `DmChatArea.jsx` (~200 satır)
`ChatArea.jsx`'in mesaj akışını kopyalıyordu (normalizeMessage, SignalR
join/leave, optimistik gönderim, scroll). `ChatArea` artık `variant` prop'u ile
iki modda çalışıyor:

- `variant="channel"` (varsayılan) — `clan` + `channel`, başlıkta `#kanal`.
- `variant="dm"` — `conversation`, başlıkta `@kullanıcı` + geri butonu.

İç mantık `targetId` / `targetClanId` / `targetName` üzerinden yürüyor, böylece
kanal/DM ayrımı tek noktada. DM'ler artık GIF, emoji, dosya yükleme, sayfalama
ve medya önizleme gibi kanal özelliklerinin tamamını kazandı.

Kaldırılan dosyalar: `DmChatArea.jsx`, `FriendsPanel.jsx`, `FriendsSidebar.jsx`.

**b) Düzen düzeltildi.** Arkadaşlar sekmesinde:

- Ortadaki `FriendsPanel` kaldırıldı → yerine `ChatArea` (DM). Sohbet seçili
  değilken "sağdaki listeden bir arkadaşını seç" boş durumu gösteriliyor.
- Soldaki `FriendsSidebar` (arkadaş listesinin ikinci kopyası) kaldırıldı →
  sol panel her sayfada `ChannelSidebar` olarak kalıyor.
- Arkadaş listesi yalnızca sağda, `FriendsMemberList` içinde. `FriendsPanel`'in
  işlevleri (bekleyen istekler, arkadaş ekleme/arama) buraya taşındı.

**c) Sütun bazlı yenileme.** Hem `MemberList` hem `FriendsMemberList`
başlığında yalnızca o sütunu tazeleyen bir yenile tuşu var (dönen ikon
animasyonu ile). `MemberList` için `handleRefreshMembers` klan üyelerini ve
online durumlarını yeniden çekiyor; `FriendsMemberList` için mevcut
`handleRefreshFriends` kullanılıyor.

**d) MemberList görüntü/animasyon hataları — bulundu ve düzeltildi:**

1. `.member-list--collapsed` CSS'te tanımlıydı ama **hiç kullanılmıyordu** —
   katlanmış hâlde çıplak bir `<button>` doğrudan `.discord-app`'in flex
   çocuğu oluyordu. Bunu telafi eden `margin-top/right` ve `background-color`
   hack'leri vardı. Artık buton gerçek kapsayıcısının içinde, hack'ler kaldırıldı.
2. `.member-list__name` `flex:1; min-width:0` içermediği için
   `text-overflow: ellipsis` **hiç tetiklenmiyordu**; uzun kullanıcı adları rol
   rozetini satırdan taşırıyordu. Eklendi.
3. Rol rozeti ve (geçen turda eklenen) hover aksiyonları ikisi de
   `margin-left:auto` kullanıyordu → aynı boşluk için yarışıp hover'da satırı
   kaydırıyorlardı. Rozetten `margin-left:auto` kaldırıldı ve hover'da rozet
   gizleniyor.

**Orphan CSS temizliği:** silinen bileşenlere ait 472 satır ölü CSS kaldırıldı
(`.friends-page*`, `.friends-sidebar*`, `.member-list-row*`).

---

## 6. DM onarımı + Space soyutlaması + kişisel sesli görüşme (2026-07-25)

Backend gereksinimleri ayrı dosyada: [backend-gereksinimleri-dm.md](backend-gereksinimleri-dm.md).

### Kök neden — DM neden hiç çalışmıyordu

MessageService swagger'ı (`:5107/swagger/v1/swagger.json`) okundu ve route'lar
hem doğrudan servise hem gateway üzerinden HTTP ile sınandı. Frontend'in
çağırdığı DM route'larının çoğu **backend'de yoktu**:

| Frontend'in çağırdığı | Gerçekte var olan |
| --- | --- |
| `POST /message/dm/conversations` | `POST .../api/Dm/conversations` |
| `GET /message/dm/channelId/{id}` | `GET .../api/Message?channelId=` (**eskisi 404**) |
| `DELETE/PUT /message/dm/{id}` | **yok** |

**3 tur boyunca fark edilmemesinin sebebi:** Ocelot gateway route eşleştirmeden
*önce* authentication çalıştırıyor. `:5000` üzerinden var olan da olmayan da
**401** dönüyor (kanıt: `/message/api/Nonexistent` → 401, ama `/tamamen/uydurma`
→ 404). Üstelik `api.js`'in 401 interceptor'ı bunu "token süresi doldu" sanıp
refresh deneyip başarısız olunca kullanıcıyı login'e atıyordu — yani **gerçek
hata (route yok), alakasız bir belirti (oturum düştü) olarak görünüyordu.**

### Aşama 1 — DM onarımı ✅

- `DmService.js` / `MessageService.js` gerçek route'lara çekildi.
- **Ocelot prefix belirsizliği:** `/message/*`'ın downstream şablonunun prefix'i
  soyup soymadığı bu makineden kesinleştirilemedi (401 her şeyi maskeliyor).
  Klan mesajlaşması bugüne kadar `/message/channelId/...` ile çalıştığı için,
  servisler iki biçimi de deniyor (`/message/api/Message/...` → 404 ise
  `/message/...`), tutan biçim modül ömrü boyunca hatırlanıyor. Backend madde 0
  düzeltilince bu fallback kaldırılmalı.
- `LiveMessageService.sendMessage`: `clanId=null` (DM) hatası artık teşhis
  edilebilir mesaj veriyor. REST fallback **yok** — swagger'da `POST /api/Message`
  bulunmuyor, hub tek gönderim yolu.
- `handlers.js`'e DM mock'ları eklendi (önceden hiç yoktu).

### Aşama 2 — Space soyutlaması ✅

[src/utils/space.js](src/utils/space.js): `ClanSpace` / `DirectSpace` ortak
soyutlaması. "DM'i gizli klan yap" yaklaşımı **kasıtlı reddedildi** — o
yaklaşımda rol/davet/üye-atma modeli DM'e sızar ve her yere `if (isDm)`
istisnası gerekirdi. `spaceCapabilities()` ile DM'de yönetim yetenekleri
(davet, rol, üye atma, silme) hiç var olmaz.

`VoiceChannel` zaten opak `roomId` aldığı için hiç değişmedi — soyutlamanın
ilk getirisi.

### Aşama 3 — DM'de sesli görüşme ✅ (frontend tarafı)

- Konuşma başına **tek kalıcı oda**: `dm-{conversationId}`. Çoklu kanal yok.
- `ChatArea` DM başlığına "Sesli Görüşme" butonu (toggle).
- Klan ses kanallarıyla **aynı** `activeVoiceChannel` state'i kullanılıyor →
  ekran paylaşımı, ses ayarları, UserBar hiç değişmeden çalışıyor.
- DM odaları presence'a bildirilmiyor (`isDirect` guard'ları): PresenceHub'ın
  tüm imzaları clanId merkezli, DM karşılığı backend'de yok. Bloklayıcı değil —
  LiveKit'in kendi katılımcı listesi odaya girildikten sonra çalışıyor; eksik
  olan sadece "girmeden önce karşı taraf seste mi?" göstergesi.
- `ChannelSidebar`'ın boş durumuna da ses durum paneli eklendi: DM görüşmesi
  klan seçili değilken sürdüğü için bağlantıyı kesme yolu hep görünür olmalı.
  (Panel iki yerde kopyalanmak yerine `renderVoiceStatusPanel()`'e alındı.)

### ⚠️ Canlıya çıkmadan önce backend'de kapatılması gerekenler

- **madde 1.3** — `SendMessage`'ın `clanId=null` desteği. Desteklenmiyorsa DM
  mesaj *gönderme* çalışmaz (yükleme çalışır).
- **madde 1.4** — DM/kanal üyelik doğrulaması. Şu an yetkisiz biri
  `conversationId` tahmin ederek özel mesajlara erişebilir.
- **madde 3.1** — `dm-{conversationId}` için ses token'ı. Bu olmadan sesli
  görüşme hiç çalışmaz.
