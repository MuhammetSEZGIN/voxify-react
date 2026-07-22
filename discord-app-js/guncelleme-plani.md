# Güncelleme Planı

Bu dosya, kod tabanı taramasında tespit edilen sorunları ve yapılması planlanan
iyileştirmeleri önem sırasına göre listeler. Her madde: sorunun tanımı, dosya/satır
referansı, somut etkisi ve önerilen çözümü içerir.

## 1. Ekran paylaşımında ortam/sistem sesi sızıntısı (Kritik)

**Sorun:** Ekran paylaşımı başlatılırken `getDisplayMedia` audio capture'ına hiçbir
ses işleme constraint'i verilmiyor.

- [src/hooks/useScreenShare.js:62-65](src/hooks/useScreenShare.js#L62-L65)
- [src/components/voicechannel/VoiceChannel.jsx:95-100](src/components/voicechannel/VoiceChannel.jsx#L95-L100)

`setScreenShareEnabled(true, { audio: true, ... })` çağrısı `echoCancellation`,
`noiseSuppression`, `autoGainControl` gibi hiçbir kısıt tanımlamıyor. Kullanıcı
tarayıcının "sistem sesini de paylaş" seçeneğini işaretlediğinde, filtrelenmemiş
ham sistem sesi (bildirimler, arka plan müziği, OS ses loopback'i) doğrudan
`ScreenShareAudio` track'i olarak diğer katılımcılara gidiyor.

Mikrofon track'i için aynı dosyada (`VoiceChannel.jsx:297-303`) bu constraint'ler
zaten uygulanmış durumda; ekran paylaşımı audio capture'ı bu korumadan tamamen
bağımsız kaldığı için aynı işlem burada da eksik.

**Çözüm:** Her iki `setScreenShareEnabled` çağrısına da audio constraint eklemek:

```js
await localParticipant.setScreenShareEnabled(true, {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: false,
  },
  selfBrowserSurface: 'include',
  // ...mevcut diğer opsiyonlar
});
```

---

## 2. `api.js` 401 handler token yenileme yapmıyor (Kritik)

**Sorun:** Axios response interceptor 401 aldığında refresh-token akışını hiç
denemeden direkt `localStorage`'ı temizleyip `window.location.href = "/login"`
ile sert yönlendirme yapıyor.

- [src/services/api.js](src/services/api.js) (401 handler)
- Karşılaştır: [src/contexts/AuthContext.jsx](src/contexts/AuthContext.jsx) — tam
  bir refresh-token akışı var ama sadece uygulama açılışında (`initAuth`) çalışıyor.

**Etki:** Access token süresi dolduğunda (örn. uzun süre açık kalan bir oturumda),
herhangi bir API isteği 401 dönünce kullanıcı refresh denenmeden aniden login
ekranına atılıyor — aktif bir ses kanalındaysa bağlantısı da kopuyor. Sert
`window.location.href` reload'u SPA state'ini (aktif ses kanalı, LiveKit
bağlantısı) düzgün temizlemeden atıyor.

**Çözüm:** 401 interceptor'ı `AuthContext`'teki refresh mantığını çağıracak
şekilde genişletmek; refresh başarılı olursa orijinal isteği tekrar denemek,
başarısız olursa login'e yönlendirmek.

---

## 3. `LiveMessageService.js` — `pendingListeners` kuyruğu temizlenmiyor (Yüksek)

**Sorun:** `on()` her çağrıldığında callback hem `connection.on()` ile hem
`pendingListeners` dizisine ekleniyor, ancak bağlantı kurulup kuyruktaki
dinleyiciler kaydedildikten sonra kuyruk temizlenmiyor.

- [src/services/LiveMessageService.js](src/services/LiveMessageService.js)
  (kod içi yorumda da "off ile eşleştirme gerekebilir" notu var)

**Etki:** `stopConnection()` + yeniden `startConnection()` döngüsünde (ağ
kopması/yeniden bağlanma, component unmount/mount) eski callback'ler yeni
bağlantıya tekrar eklenir. Aynı mesaj event'i birden fazla kez tetiklenir —
kullanıcı arayüzünde mesajlar çift/üçlü görünebilir.

**Çözüm:** `pendingListeners` kuyruğunu bağlantı kurulduktan sonra temizlemek
veya `off()` ile eşleştirilmiş bir referans takibi eklemek.

---

## 4. `permissions.js` ölü kod, paralel/tutarsız yetkilendirme (Orta-Yüksek)

**Sorun:** [src/utils/permissions.js](src/utils/permissions.js) JWT'de
`clanRoles` claim'i bekliyor (backend bunu hiç göndermiyor) ve proje genelinde
hiçbir yerde import edilmiyor. Bunun yerine `MainLayout.jsx` (satır ~64-74) rolü
ayrı bir yöntemle (`/clans/{id}` fetch'inden `memberships.find()`) hesaplıyor.

**Etki:** İki paralel yetkilendirme mekanizması var, biri tamamen kırık ve
kullanılmıyor. İleride biri "zaten var" diyerek `permissions.js`'i kullanmaya
kalkarsa, JWT'de olmayan claim'e güvenip her zaman yanlış sonuç (`'none'`/member)
dönen kırık bir yetki kontrolü devreye girer.

**Çözüm:** `permissions.js`'i ya `MainLayout.jsx`'teki gerçek yöntemle uyumlu
hale getirip tek kaynak haline getirmek, ya da kullanılmıyorsa dosyayı kaldırmak.

---

## 5. `AuthContext.jsx` — token'ların localStorage + Tauri store'da senkronsuz tutulması (Orta)

**Sorun:** JWT ve refresh token hem `localStorage`'a hem Tauri `LazyStore`'a
(`auth.json`, diskte düz JSON) yazılıyor, ikisi arasında senkron garantisi yok.
`persistSet` sırasında `authStore.set` başarısız olursa hata sessizce yutuluyor
(`catch { /* ignore */ }`).

- [src/contexts/AuthContext.jsx](src/contexts/AuthContext.jsx)

**Etki:** Disk yazma hatası gibi durumlarda token sadece `localStorage`'da kalıp
Tauri store ile diverge edebilir; sessiz auth tutarsızlıkları oluşur ve hiç
loglanmadığı için debug edilemez.

**Çözüm:** `persistSet` hatalarını en azından loglamak; iki kaynak arasında
senkron garantisi olmayan durumları tespit edip birleştirmek (tek kaynak haline
getirmek ya da store yazımı başarısızsa açıkça uyarmak).

---

## 6. `PresenceService.js` + `MainLayout.jsx` — gereksiz bağlantı kopma/yeniden kurulma (Orta)

**Sorun:** `MainLayout.jsx`'teki presence `useEffect` bağımlılığı `[clans,
loadingClans]`; `clans` state'i her klan sıralama/oluşturma/silme işleminde
referans değiştirdiği için bu effect sık sık cleanup + re-run yapıyor,
`PresenceService.stopConnection()` çağrılıp bağlantı komple kapatılıp yeniden
kuruluyor.

**Etki:** Kullanıcı sunucu listesini sürükle-bırak ile sıralarken
(`handleReorderClans`) PresenceHub bağlantısı gereksiz yere düşüp yeniden
kurulur; bu sırada gelen `UserJoinedVoice`/`UserOnline` event'leri kaybolabilir,
`voicePresence`/`onlineUserIds` state'i kısa süreliğine sıfırlanıp UI'da
"kimse yokmuş gibi" bir flash oluşur.

**Çözüm:** Effect bağımlılığını `clans` dizisinin referansı yerine sadece klan
ID'lerinin (stabil bir key, örn. `clans.map(c => c.id).join(',')` veya
`useMemo`'lanmış bir liste) değişimine bağlamak.

---

## 7. `VoiceService.js` — ham hata mesajları kullanıcıya sızıyor (Düşük)

**Sorun:** `catch (error) { throw error; }` hatayı olduğu gibi yeniden
fırlatıyor; network hatası (`TypeError: Failed to fetch`) durumunda
`VoiceChannel.jsx` bu mesajı doğrudan kullanıcıya gösteriyor.

- [src/services/VoiceService.js](src/services/VoiceService.js)
- [src/components/voicechannel/VoiceChannel.jsx](src/components/voicechannel/VoiceChannel.jsx) (hata gösterimi)

**Etki:** Türkçe arayüzde İngilizce/teknik hata mesajı görünüyor, kullanıcı için
anlaşılmaz UX.

**Çözüm:** Hata yakalanırken kullanıcı dostu, Türkçe bir mesaja çevirip
fırlatmak (orijinal hatayı console'da loglamaya devam ederek).

---

## 8. Kişisel arama (kullanıcı arama) özelliği — eksik, baştan tasarlanmalı

**Mevcut durum:** Platformda kullanıcı genelinde arama yapıp başka bir
kullanıcıyı bulma özelliği hiç yok. Sadece bir clan içindeki üye listesinde
client-side filtreleme var ([src/components/clan/MemberList.jsx](src/components/clan/MemberList.jsx))
ve GIF arama (Tenor API, [ChatArea.jsx](src/components/chat/ChatArea.jsx)) mevcut.
DM (birebir mesajlaşma) kavramı da yok — tüm mesajlaşma clan/kanal bazlı.

**Yapılması gerekenler:**

- **Backend:** Kullanıcı adı/etiket bazlı arama endpoint'i
  (`GET /users/search?q=...`), sayfalama, rate-limit (spam aramayı önlemek için),
  gizlilik ayarına saygılı filtreleme.
- **Servis katmanı:** `src/services/UserService.js` — arama isteğini debounce'la
  (server-side arama için `ChatArea.jsx:477`'deki 400ms debounce pattern örnek
  alınabilir).
- **State/route:** `App.jsx`'e yeni route (`/app/search` veya modal/overlay),
  `MainLayout.jsx`'e sonuç state'i.
- **UI bileşeni:** Arama input'u + sonuç listesi (avatar, kullanıcı adı, ortak
  clan bilgisi).
- **Arkadaş ekleme / DM akışı** (eğer hedefse): arama sonucundan "arkadaş ekle"
  / "mesaj gönder" aksiyonu — bunun için DM kanalı kavramının backend'de ve
  `LiveMessageService.js`'de desteklenmesi gerekir (şu an SignalR hub'ı sadece
  clan kanallarına `JoinChannel`/`LeaveChannel` üzerinden bağlanıyor, kullanıcılar
  arası özel kanal kavramı yok).
- **Presence entegrasyonu:** Arama sonuçlarında online/offline durumu
  gösterilecekse `PresenceService.js`'teki `GetOnlineUsers` mantığının clan
  bazlı olmaktan çıkarılıp genişletilmesi gerekir.

Bu madde, tek bileşen eklemekten öte backend + servis katmanı + yeni bir
mesajlaşma modeli (DM) gerektiren orta-büyük bir özellik. Kapsam netleşmeden
(sadece "kullanıcı bul ve profiline git" mi, yoksa "arkadaş ekle + DM başlat" mı)
uygulamaya başlanmamalı.

---

## Öncelik Sırası (Özet)

1. Ekran paylaşımı ses sızıntısı (kritik, kullanıcı gizliliğini doğrudan etkiliyor)
2. `api.js` 401 refresh akışı (kritik, oturum kopmalarına yol açıyor)
3. `LiveMessageService.js` listener sızıntısı (yüksek, mesaj tekrarına yol açıyor)
4. `permissions.js` tutarsızlığı (orta-yüksek, gelecekteki hatalara zemin hazırlıyor)
5. `AuthContext.jsx` token senkron sorunu (orta)
6. `PresenceService.js` gereksiz reconnect (orta)
7. `VoiceService.js` hata mesajları (düşük)
8. Kişisel arama özelliği (yeni özellik, kapsam netleştirilmeli)
