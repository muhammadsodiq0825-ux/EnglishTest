# So'zlar Kutubxonasi — sozlash va GitHub Pages'ga joylash

Bu ilova endi **istalgan tildagi lug'at kitobini** (PDF yoki DOCX — rasmli/skanerlangan
bo'lsa ham) yuklab, avtomatik boblarga ajratib, kutubxonaga qo'sha oladi. Har bir til
juftligi ("Ingliz tili → Rus tili" kabi) o'z alohida "javon"ida ko'rinadi.

## Nima o'zgardi (2-versiya)

- **MUHIM TUZATISH — kitob avtomatik boblarga ajratish endi ancha aqlliroq**:
  oldingi versiyada, agar PDF/OCR matnida qatorlar (newline) yo'qolib ketsa
  (masalan butun bir bob bitta uzun "qatorga" yopishib qolsa), dastur bobni
  buzib, bitta ulkan noto'g'ri yozuv sifatida saqlar edi. Endi dastur so'zlarni
  ularning **ketma-ket raqamlanishi** (1, 2, 3, 4...) orqali aniqlaydi — qatorlar
  yo'qolgan yoki yo'q bo'lsa ham, "1 Nuclear family – oila... 2 Extended
  family – ..." kabi yopishib qolgan matnni ham to'g'ri, alohida-alohida
  so'zlarga ajratadi. Bu butunlay avtomatik ishlaydi — qo'lda tahrirlash shart
  emas.
- **Bob nomlari endi mavzu asosida ham aniqlanadi** — agar kitobda "1 Family",
  "2 Relationships" kabi mavzu sarlavhalari bo'lsa, ular endi "Bob 1 — Family"
  tarzida chiroyli ko'rinadi (oddiy "Bob 1, Bob 2..." o'rniga)
- **PDF matn chiqarish tubdan yaxshilandi** — endi matn qatorlari sahifadagi
  so'zlarning haqiqiy joylashuviga (vertikal pozitsiyasiga) qarab qayta
  tiklanadi, ikki ustunli sahifalar ham alohida aniqlanadi
- Yangi kitob qo'shish, til javonlari, qidiruv, klaviatura orqali test ishlash,
  telefon uchun tuzatilgan interfeys — bularning barchasi avvalgi versiyada
  qo'shilgan, shu versiyada ham saqlanib qolgan

⚠️ **Muhim — bitta qo'shimcha qadam kerak bo'ladi**: yangi "kitob qo'shish" funksiyasi
ma'lumotlar bazasida yangi tuzilma ishlatgani uchun, Firestore xavfsizlik qoidalarini
(Rules) **bir marta yangilashingiz kerak** — pastda 3-qadamda aniq ko'rsatilgan.
(Agar buni oldingi versiyada allaqachon qilgan bo'lsangiz, qayta qilish shart emas —
faqat `index.html`ni yangisiga almashtirsangiz kifoya.)

---

## 1-qadam: Firebase loyihasini yaratish (bepul)

1. https://console.firebase.google.com ga kiring
2. "Add project" → nom bering → "Create project"

*(Agar bu loyihani avvalroq yaratgan bo'lsangiz, shu qadamni tashlab, 2-qadamga o'ting.)*

## 2-qadam: Authentication va Firestore'ni yoqish

Firebase konsoli interfeysi vaqti-vaqti bilan yangilanib turadi. Agar chap menyuda
aynan "Build" so'zini ko'rmasangiz, quyidagi guruhlarni qidiring:

- **Authentication** — odatda "**Security**" guruhi ichida. Uni oching → "Get started"
  → "Sign-in method" → "**Email/Password**"ni yoqing.
- **Firestore Database** — odatda "**Databases & Storage**" guruhi ichida. Uni oching
  → "Create database" → "Start in production mode" → "Create".

*(Agar guruh nomlari boshqacha bo'lsa, skrinshot tashlang — men aniq ko'rsataman.)*

## 3-qadam: Firestore xavfsizlik qoidalarini joylashtirish (YANGILANGAN)

Firestore Database ichida **"Rules"** bo'limiga o'ting, mavjud matnni o'chirib,
o'rniga **aynan quyidagini** joylashtiring (bu — oldingi versiyadagidan farqli,
chunki endi umumiy "kitoblar" bazasi ham qo'shildi):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Har bir foydalanuvchi faqat o'zining shaxsiy ma'lumotlariga
    // (qiyin so'zlar, xatolar, shaxsiy kitoblar) kira oladi
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Umumiy (hammaga ko'rinadigan) kitoblar — hamma o'qiy oladi,
    // faqat egasi o'chira/o'zgartira oladi
    match /books/{bookId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.resource.data.ownerUid == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.ownerUid == request.auth.uid;

      match /units/{unitId} {
        allow read: if request.auth != null;
        allow create: if request.auth != null && request.resource.data.ownerUid == request.auth.uid;
        allow update, delete: if request.auth != null && resource.data.ownerUid == request.auth.uid;
      }
    }
  }
}
```

"**Publish**" tugmasini bosing.

## 4-qadam: Konfiguratsiya kodini olish

1. ⚙️ (Project settings) → "Your apps" → **`</>`** (Web) belgisi → nom bering →
   "Register app"
2. Chiqqan `firebaseConfig` kodini nusxalab oling (oldingi loyihangiz bo'lsa, buni
   avvalroq olib bo'lgansiz — Project settings'dan istalgan vaqt qayta ko'rish mumkin)

## 5-qadam: `index.html` faylini tahrirlash

1. Yuklab olingan **yangi** `index.html` faylini matn muharririda oching
2. Faylning boshida (~30-qatorlar atrofida) shu qismni toping:

```js
const firebaseConfig = {
  apiKey: "REPLACE_ME",
  ...
};
```

3. O'zingizning (4-qadamdagi) `firebaseConfig` qiymatlaringiz bilan almashtiring,
   saqlang.

## 6-qadam: GitHub'ga yuklash

Repositoryingizda:
- **`index.html`** — eskisini yangisi bilan **almashtiring** (o'chirib, qayta yuklang
  yoki "Upload files" orqali ustiga yozdiring)
- **`vocab.json`** — **o'zgarishsiz qoladi**, qayta yuklash shart emas
- **`app.js`** — endi kerak emas, repositoryingizdan o'chirib tashlashingiz mumkin
  (ilova endi uni ishlatmaydi, lekin turgani ham hech qanday zarar keltirmaydi)

Bu bo'limdan keyin GitHub Pages avtomatik yangilanadi (1-2 daqiqa kutish kifoya).

*(Agar Authentication va Authorized domains'ni avvalroq sozlab bo'lgan bo'lsangiz,
boshqa hech narsa qilish shart emas.)*

---

## Yangi kitob qanday qo'shiladi

1. Ilovada "➕ Qo'shish" tugmasini bosing
2. Kitob nomi, "Tildan"/"Tilga" nomlarini (masalan `Ingliz tili` / `Rus tili`),
   ko'rinish turini (Hammaga / Faqat menga) va faylni (.pdf yoki .docx) tanlang
3. "Matnni chiqarish" — agar fayl rasmli/skanerlangan PDF bo'lsa, bu qadam avtomatik
   OCR (rasmdan matn tanish) ishga tushiradi va biroz vaqt olishi mumkin (sahifalar
   soniga qarab bir necha daqiqagacha)
4. Chiqqan matnni ko'rib chiqing — sahifa raqamlari, keraksiz qatorlarni o'chiring,
   OCR xatolarini tuzating. Har bir qator `so'z - tarjima` ko'rinishida bo'lishi kerak
5. "Boblarga ajratish" — agar kitobda "Unit 1", "1-bob" kabi sarlavhalar bo'lsa,
   ular avtomatik aniqlanadi; bo'lmasa, siz ko'rsatgan songa (masalan har bobda 20 ta
   so'z) qarab avtomatik bo'linadi
6. Har bir bobni ochib tekshiring, kerak bo'lsa so'zlarni tuzating yoki bobni o'chiring
7. "Kitobni saqlash" — kitob kutubxonaga, tanlangan til javoniga qo'shiladi

**Eslatma:** OCR (rasmdan matn tanish) hech qachon 100% aniq bo'lmaydi — shuning
uchun 4-qadamdagi tekshirish va tuzatish bosqichi muhim. Sifatli natija uchun matnli
(skanerlanmagan) PDF yoki DOCX fayllar tavsiya etiladi.

---

## Nima o'zgardi (3-versiya)

- **Progress ko'rsatkichlari**: har bir kitob "javon"ida tugallanish foizi
  (progress-bar), kitob sahifasida umumiy foiz, va har bir bob katagida oxirgi
  test natijasi (masalan "18/20", rangi natijaga qarab yashil/sariq/qizil)
- **"Guruhga" ko'rinish** — kitob yuklashda "Hammaga" va "Faqat menga" bilan
  bir qatorda endi "Guruhga" varianti bor: email ro'yxatini kiritasiz
  (masalan o'quvchilaringizning emaillari), va kitob faqat o'sha emaillar
  bilan ro'yhatdan o'tgan foydalanuvchilargagina ko'rinadi
- **Fon rasm ustidagi matn yorqinroq** — asosiy kontent maydoni endi yarim
  shaffof to'q panelda chiqadi, fon surati bilan matn orasidagi kontrast
  yaxshilandi
- **Sahifa pastida jamoa ma'lumotlari** (footer) qo'shildi

⚠️ **MUHIM — Firestore Rules yana bir marta yangilanishi kerak** (guruh
funksiyasi uchun). Pastdagi yangi qoidalarni albatta joylashtiring — aks
holda kitoblar umuman yuklanmay qoladi.

## Firestore Rules (YANGI, 3-versiya — eskisini butunlay almashtiring)

Firebase konsoli → Firestore Database → Rules → mavjud matnni o'chirib,
aynan quyidagini joylashtiring:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /books/{bookId} {
      allow read: if request.auth != null && (
        resource.data.visibility == 'public' ||
        resource.data.ownerUid == request.auth.uid ||
        (resource.data.visibility == 'group' &&
         request.auth.token.email.lower() in resource.data.allowedEmails)
      );
      allow create: if request.auth != null && request.resource.data.ownerUid == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.ownerUid == request.auth.uid;

      match /units/{unitId} {
        allow read: if request.auth != null && (
          resource.data.visibility == 'public' ||
          resource.data.ownerUid == request.auth.uid ||
          (resource.data.visibility == 'group' &&
           request.auth.token.email.lower() in resource.data.allowedEmails)
        );
        allow create: if request.auth != null && request.resource.data.ownerUid == request.auth.uid;
        allow update, delete: if request.auth != null && resource.data.ownerUid == request.auth.uid;
      }
    }
  }
}
```

"Publish" tugmasini bosishni unutmang.

## Fon rasmni qo'shish (agar hali qilmagan bo'lsangiz)

Bu paketda `library-bg.jpg` fayli bor — uni ham `index.html` bilan bir xil
papkaga (repository ildiziga) yuklang. Fayl nomi aynan shu bo'lishi kerak.

## Kompyuteringizda sinab ko'rish (GitHub'ga yuklashdan oldin)

```
python3 -m http.server 8000
```

so'ng brauzerda `http://localhost:8000` ni oching. Firebase sozlanmagan bo'lsa ham,
ilova "Demo rejim"da to'liq ishlaydi (barcha ma'lumotlar, shu jumladan yuklangan
kitoblar, shu brauzerda saqlanadi) — sozlashdan oldin barcha funksiyalarni shu
tarzda sinab ko'rishingiz mumkin.

## Fayllar tuzilishi

- `index.html` — **butun ilova shu bitta faylda**: interfeys, uslub, Firebase
  autentifikatsiya, Firestore, test tizimi, kitob yuklash va OCR mantig'i
  (`firebaseConfig`ni shu faylning boshida to'ldirasiz)
- `vocab.json` — asosiy 6 kitobning (4000 Essential English Words) tayyor
  ma'lumotlar bazasi — o'zgarmaydi

## Muammo bo'lsa

- **Kitob yuklash "OCR" bosqichida juda uzoq davom etsa** — bu normal, rasmli
  PDF'larda sahifa boshiga bir necha soniya ketishi mumkin; sahifa ko'p bo'lsa
  sabr qiling yoki kichikroq qismlarga bo'lib yuklang.
- **"Saqlashda xato" chiqsa** — Firestore Rules'ni 3-qadamdagi kabi to'g'ri
  joylashtirganingizni tekshiring.
- **Yangi kitob boshqa foydalanuvchilarga ko'rinmasa** — "Hammaga" tanlanganini
  va sahifani yangilab (F5) qayta tekshiring.
