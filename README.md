# So'zlar Kutubxonasi — sozlash va GitHub Pages'ga joylash

Bu ilova 6 ta "4000 Essential English Words" kitobining barcha so'zlarini o'z ichiga
oladi (jami 3600 ta so'z, 180 ta bob). Foydalanuvchi ro'yhatdan o'tadi, har bir
bobni o'qiydi, qiyin so'zlarni "⭐ Qiyin so'zlar" ro'yxatiga saqlaydi, test ishlaydi,
va xato qilgan so'zlar "❌ Xatolarim" ro'yxatiga tushadi. Barcha ma'lumotlar
Firebase orqali bulutda saqlanadi — foydalanuvchi istalgan qurilmadan kirsa,
natijalari saqlanib qoladi.

## 1-qadam: Firebase loyihasini yaratish (bepul)

1. https://console.firebase.google.com ga kiring (Google hisobingiz bilan)
2. "Add project" tugmasini bosing, nom bering (masalan `sozlar-kutubxonasi`)
3. Google Analytics so'ralsa — kerak emas, o'chirib qo'yaverishingiz mumkin

## 2-qadam: Authentication'ni yoqish

1. Chap menyuda **Build > Authentication > Get started**
2. **Sign-in method** bo'limida:
   - **Email/Password**'ni yoqing (Enable)
   - Xohlasangiz **Google**'ni ham yoqing (bu holda "Google orqali kirish"
     tugmasi ham ishlaydi)

## 3-qadam: Firestore Database yaratish

1. Chap menyuda **Build > Firestore Database > Create database**
2. Istalgan mintaqani tanlang (masalan `eur3` yoki `europe-west`)
3. **Start in production mode**'ni tanlang
4. Yaratilgandan so'ng **Rules** bo'limiga o'ting va quyidagini joylashtiring
   (bu — har bir foydalanuvchi faqat o'zining ma'lumotlarini o'qiy/yoza olishini
   ta'minlaydi):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

5. **Publish** tugmasini bosing.

## 4-qadam: Web ilova qo'shish va konfiguratsiyani olish

1. Loyiha sahifasida charxli belgi (⚙️) > **Project settings**
2. "Your apps" bo'limida **</>** (Web) belgisini bosing
3. Nom bering, "Firebase Hosting"ni belgilamasangiz ham bo'ladi (biz GitHub
   Pages ishlatamiz)
4. Sizga `firebaseConfig` obyekti beriladi — u quyidagiga o'xshaydi:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "sozlar-kutubxonasi.firebaseapp.com",
  projectId: "sozlar-kutubxonasi",
  storageBucket: "sozlar-kutubxonasi.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

5. `app.js` faylini oching, yuqorida `const firebaseConfig = {...}` qismini
   toping va uni yuqoridagi o'z ma'lumotlaringiz bilan almashtiring.

## 5-qadam: Authentication'da domenni ruxsat etish

1. **Authentication > Settings > Authorized domains**
2. GitHub Pages domeningizni qo'shing, masalan: `sizning-username.github.io`
   (localhost avtomatik ruxsat etilgan bo'ladi, test qilish uchun qulay)

## 6-qadam: GitHub Pages'ga joylash

1. GitHub'da yangi repository yarating (masalan `sozlar-kutubxonasi`)
2. Ushbu 3 ta faylni yuklang: `index.html`, `app.js`, `vocab.json` (`app.js`
   ichida siz to'ldirgan `firebaseConfig` bilan)
3. Repository **Settings > Pages** bo'limiga o'ting
4. **Source**: "Deploy from a branch" → branch: `main`, folder: `/ (root)`
5. Bir necha daqiqadan so'ng sayt manzili tayyor bo'ladi:
   `https://sizning-username.github.io/sozlar-kutubxonasi/`

Shu bilan tamom — endi istalgan odam ro'yhatdan o'tib, o'z hisobi bilan
so'zlarni o'rganishi, qiyin/xato so'zlarni saqlashi mumkin, va istalgan
qurilmadan kirsa ham natijalari saqlanib qoladi.

## Fayllar tuzilishi

- `index.html` — sahifa tuzilishi va uslub (CSS)
- `app.js` — barcha mantiq: Firebase autentifikatsiya, Firestore bilan ishlash,
  navigatsiya, test tizimi (`firebaseConfig`ni shu yerda to'ldirasiz)
- `vocab.json` — 6 kitob, 180 bob, 3600 so'zning tayyor ma'lumotlar bazasi

## Test tizimi qanday ishlaydi

Har bir bobda "Test ishlash" tugmasini bosganda, o'sha bobning barcha 20 ta
so'zi bo'yicha aralashtirilgan tartibda savol beriladi. Har bir savolda 4 ta
javob varianti bo'ladi:

- 1 ta — to'g'ri javob
- 2 ta — o'sha bobning boshqa so'zlaridan (chalkashtirish uchun)
- 2 ta — kitobning boshqa boblaridan

Yo'nalishni (EN→UZ yoki UZ→EN) bob sahifasidagi tugmalar orqali tanlash
mumkin. Xato qilingan so'zlar avtomatik "Xatolarim" ro'yxatiga qo'shiladi.

## Kompyuteringizda sinab ko'rish (GitHub'ga yuklashdan oldin)

`index.html` faylini brauzerda to'g'ridan-to'g'ri ochsangiz (`file://...`),
so'zlar ro'yxati yuklanmaydi — buning sababi brauzerlar xavfsizlik tufayli
`file://` orqali ochilgan sahifadan `vocab.json` faylini o'qishga ruxsat
bermaydi. Shu 3 ta fayl turgan papkada terminal oching va:

```
python3 -m http.server 8000
```

so'ng brauzerda `http://localhost:8000` manzilini oching. Firebase
sozlanmagan bo'lsa ham, ilova "Demo rejim"da to'liq ishlaydi (ma'lumotlar
shu brauzerda saqlanadi) — shu tarzda barcha funksiyalarni (kitob, bob,
so'z, test, qiyin so'zlar, xatolar) sozlashdan oldin sinab ko'rishingiz mumkin.

## Muammo bo'lsa

- **"Firebase sozlanmagan" ogohlantirishi chiqsa** — `app.js` ichidagi
  `firebaseConfig`ni to'ldirmagansiz.
- **Kirish/ro'yhatdan o'tish ishlamasa** — Authentication'da Email/Password
  yoqilganini va Authorized domains'ga domeningiz qo'shilganini tekshiring.
- **Ma'lumotlar saqlanmasa** — Firestore Rules to'g'ri joylashtirilganini va
  Firestore Database yaratilganini tekshiring.
