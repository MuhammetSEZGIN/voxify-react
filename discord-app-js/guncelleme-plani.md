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
