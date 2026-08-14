# Backend Gereksinimleri — Kullanıcı Profili, Avatar ve Profil Arka Planı

Bu not, frontend'de eklenen kullanıcı biyografisi, mesaj avatarı ve profil
arka planı (statik görsel / hareketli GIF) desteğinin backend tarafındaki
kalıcı sözleşmesini tanımlar.

## 1. Kullanıcı profili modeli

Kullanıcı profilinde aşağıdaki herkese açık alanlar bulunmalı:

```json
{
  "id": "user-id",
  "userName": "kullanici",
  "avatarUrl": "https://.../avatar.png",
  "bio": "Kullanıcının biyografisi",
  "profileBackgroundUrl": "https://.../background.gif"
}
```

- `bio`: nullable/string, önerilen azami uzunluk 200 karakter.
- `avatarUrl`: nullable/string, önerilen azami uzunluk 2048 karakter.
- `profileBackgroundUrl`: nullable/string, önerilen azami uzunluk 2048
  karakter. PNG, JPG/JPEG, WebP ve GIF URL'lerini kabul etmeli.
- Veritabanına `ProfileBackgroundUrl` nullable alanı/migration'ı eklenmeli.
- URL boşaltıldığında `null` kaydedilebilmeli.
- Backend dış URL'yi indirmek zorunda değil; yalnızca doğrulanmış `https://`
  URL'sini saklamalı. URL sunucu tarafından indirilecekse SSRF koruması şarttır.

## 2. Kendi profilini okuma ve güncelleme

Mevcut endpoint'ler aşağıdaki alanı da taşımalı:

```http
GET /identity/user/me
PUT /identity/user/update
```

`GET /identity/user/me` yanıtına `profileBackgroundUrl` eklenmeli.

`PUT /identity/user/update` isteği:

```json
{
  "userName": "kullanici",
  "avatarUrl": "https://.../avatar.png",
  "bio": "Biyografi",
  "profileBackgroundUrl": "https://.../background.gif"
}
```

Güncelleme yanıtının güncel profil nesnesini dönmesi tercih edilir. Mevcut
başarı mesajı korunacaksa da sonraki `GET /me` çağrısında yeni alan mutlaka
dönmelidir.

## 3. Başka kullanıcının profil kartı

Yeni endpoint:

```http
GET /identity/user/{userId}/profile
Authorization: Bearer <token>
```

Başarılı yanıt mevcut IdentityService zarfıyla dönmeli:

```json
{
  "isSuccessfull": true,
  "data": {
    "id": "user-id",
    "userName": "kullanici",
    "avatarUrl": "https://.../avatar.png",
    "bio": "Biyografi",
    "profileBackgroundUrl": "https://.../background.gif"
  }
}
```

Bu endpoint e-posta, rol claim'leri, oturum bilgisi veya başka özel hesap
alanlarını kesinlikle döndürmemeli. Kullanıcı yoksa `404`, erişim politikası
engelliyorsa `403` dönmeli. Gateway'de route tanımlanmalı; olmayan route'un
`401` olarak maskelenmemesi önemlidir.

## 4. Mesajlarda kullanıcı avatarı

Hem geçmiş mesaj REST yanıtında hem SignalR `ReceiveMessage` /
`MessageUpdated` olaylarında gönderilen `MessageDto` aşağıdaki alanları
içermeli:

```json
{
  "messageId": "message-id",
  "channelId": "channel-or-conversation-id",
  "senderId": "user-id",
  "userName": "kullanici",
  "avatarUrl": "https://.../avatar.png",
  "content": "Mesaj",
  "createdAt": "2026-08-15T10:00:00Z"
}
```

- `ReceiveMessage` mümkünse ayrı positional parametreler yerine yukarıdaki tek
  DTO nesnesini yayınlamalı.
- Eski mesajlar okunurken avatar, mesaj kaydına snapshot olarak yazılmadıysa
  `senderId` üzerinden güncel kullanıcı profilinden doldurulabilir.
- Avatar sonradan değiştiğinde geçmiş mesajlarda güncel avatarın gösterilmesi
  isteniyorsa sorguda IdentityService/user projection ile zenginleştirme veya
  güvenli bir profil cache'i kullanılmalı.

Frontend, geçiş sürecinde mesajın `senderId` alanını klan üyeleri / DM
katılımcıları ile eşleyerek eksik avatarı tamamlar; ancak ortak klanı olmayan
ve arkadaş olmayan kullanıcılar için backend alanı gereklidir.

## 5. DM konuşmaları ve mesaj bildirimleri

DM konuşma listesinde karşı tarafın avatarı bulunmalı:

```json
{
  "conversationId": "conversation-id",
  "otherUserId": "user-id",
  "otherUserName": "kullanici",
  "otherAvatarUrl": "https://.../avatar.png",
  "lastMessage": "...",
  "lastMessageAt": "2026-08-15T10:00:00Z"
}
```

`DirectMessageReceived` ve `MissedCall` bildirimlerinin REST ve SignalR
nesnelerine de aktör bilgileri eklenmeli:

```json
{
  "actorUserId": "user-id",
  "actorUserName": "kullanici",
  "actorAvatarUrl": "https://.../avatar.png"
}
```

Bu sayede gönderen arkadaş listesinde olmasa bile Mesajlar/Bildirimler
alanında gerçek profil resmi gösterilebilir.

## 6. Kabul kriterleri

1. Kullanıcı arka plan olarak PNG/JPG/WebP/GIF URL'si kaydedebilir ve yeniden
   girişten sonra aynı değer `GET /me` ile gelir.
2. Başka kullanıcıya tıklanınca biyografi ve arka plan
   `GET /identity/user/{userId}/profile` üzerinden görünür.
3. Kanal ve DM geçmişindeki her mesaj DTO'su `senderId`, `userName` ve
   `avatarUrl` taşır.
4. Canlı `ReceiveMessage` olayı aynı avatar alanını taşır.
5. DM/bildirim öğeleri `otherAvatarUrl` veya `actorAvatarUrl` taşır.
6. Boş veya bozuk görsel URL'si hiçbir endpoint'i 500'e düşürmez; alan `null`
   olabilir ve frontend kullanıcı baş harfine geri düşer.
