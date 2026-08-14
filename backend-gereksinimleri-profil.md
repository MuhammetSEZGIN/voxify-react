# Backend Gereksinimleri — Kullanıcı Biyografisi ve Profil Arka Planı

Bu not, frontend'de eklenen kullanıcı biyografisi ve profil arka planı (statik
görsel / hareketli GIF) desteğinin backend tarafındaki kalıcı sözleşmesini
tanımlar.

> Mesajlar, DM konuşmaları ve bildirim DTO'ları bu çalışmanın kapsamı dışındadır.
> Frontend mesaj avatarlarını zaten yüklenmiş kullanıcı, klan üyesi ve arkadaş
> profillerinden `senderId` üzerinden tamamlar; bu alanlarda backend değişikliği
> istenmiyor.

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

## 4. Kabul kriterleri

1. Kullanıcı arka plan olarak PNG/JPG/WebP/GIF URL'si kaydedebilir ve yeniden
   girişten sonra aynı değer `GET /me` ile gelir.
2. Başka kullanıcıya tıklanınca biyografi ve arka plan
   `GET /identity/user/{userId}/profile` üzerinden görünür.
3. Boş veya bozuk arka plan URL'si hiçbir endpoint'i 500'e düşürmez; alan `null`
   olabilir ve frontend varsayılan renkli arka plana geri düşer.
