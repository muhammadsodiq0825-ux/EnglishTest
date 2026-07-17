// ==========================================================================
// 4000 Essential English Words — So'zlar Kutubxonasi
// ==========================================================================
// SOZLASH (SETUP) — bu qismni albatta to'ldiring:
// 1) https://console.firebase.google.com da yangi loyiha (project) yarating
// 2) "Build > Authentication" bo'limida Email/Password (va xohlasangiz Google)
//    provayderlarini yoqing (Sign-in method)
// 3) "Build > Firestore Database" ni yarating (production mode bo'lsa ham bo'ladi,
//    pastdagi xavfsizlik qoidalarini Firestore Rules bo'limiga qo'ying — README.md ga qarang)
// 4) Project settings > General > "Your apps" > Web app (</>) qo'shing va
//    quyidagi firebaseConfig obyektini o'zingiznikiga almashtiring.
// ==========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  GoogleAuthProvider, signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteField
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB2KIWXGGmptjJVc8klRc8NuH1OKx7w72I",
  authDomain: "englishtest-eac93.firebaseapp.com",
  projectId: "englishtest-eac93",
  storageBucket: "englishtest-eac93.firebasestorage.app",
  messagingSenderId: "83760408717",
  appId: "1:83760408717:web:fc0927999e012a54c45ac4",
  measurementId: "G-WTN0V0GX93"
};

const CONFIG_IS_PLACEHOLDER = firebaseConfig.apiKey === "REPLACE_ME";

let auth = null, db = null, firebaseReady = false;
try {
  if (!CONFIG_IS_PLACEHOLDER) {
    const fbApp = initializeApp(firebaseConfig);
    auth = getAuth(fbApp);
    db = getFirestore(fbApp);
    firebaseReady = true;
  }
} catch (e) {
  console.error("Firebase init xatosi:", e);
}

// --------------------------------------------------------------------------
// Local demo mode — Firebase sozlanmaguncha ilovani shu brauzerda sinab
// ko'rish uchun (faqat shu qurilma/brauzerda saqlanadi, hisob tizimi yo'q).
// --------------------------------------------------------------------------
const LOCAL_KEY = "vocab_kutubxona_local_v1";
function loadLocalStore() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : { difficult: {}, mistakes: {} };
  } catch (e) {
    return { difficult: {}, mistakes: {} };
  }
}
function saveLocalStore() {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ difficult: State.difficult, mistakes: State.mistakes }));
  } catch (e) { /* ignore quota errors */ }
}

// --------------------------------------------------------------------------
// State
// --------------------------------------------------------------------------
const BOOK_COLORS = { 1:"var(--b1)", 2:"var(--b2)", 3:"var(--b3)", 4:"var(--b4)", 5:"var(--b5)", 6:"var(--b6)" };

const State = {
  user: null,
  localMode: false,      // true when Firebase isn't configured — local browser-only storage
  vocab: [],           // array of {id, title, units:[{unit, words:[{en,uz}]}]}
  difficult: {},        // key -> {book,unit,en,uz}
  mistakes: {},          // key -> {book,unit,en,uz,count}
  route: { name: "loading" },
  quiz: null            // active quiz session
};

function keyFor(book, unit, en) {
  return `${book}_${unit}_${en}`.toLowerCase().replace(/[^a-z0-9_]/g, "_");
}

// --------------------------------------------------------------------------
// Toast helper
// --------------------------------------------------------------------------
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

// --------------------------------------------------------------------------
// Load vocab data
// --------------------------------------------------------------------------
async function loadVocab() {
  const res = await fetch("vocab.json");
  State.vocab = await res.json();
}

// --------------------------------------------------------------------------
// Firestore persistence
// --------------------------------------------------------------------------
async function loadUserData(uid) {
  if (State.localMode) {
    const local = loadLocalStore();
    State.difficult = local.difficult || {};
    State.mistakes = local.mistakes || {};
    return;
  }
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    State.difficult = data.difficult || {};
    State.mistakes = data.mistakes || {};
  } else {
    await setDoc(ref, { difficult: {}, mistakes: {} });
    State.difficult = {};
    State.mistakes = {};
  }
}

async function toggleDifficult(book, unit, en, uz) {
  const k = keyFor(book, unit, en);
  if (State.difficult[k]) {
    delete State.difficult[k];
    if (State.localMode) { saveLocalStore(); return; }
    const ref = doc(db, "users", State.user.uid);
    await updateDoc(ref, { [`difficult.${k}`]: deleteField() });
  } else {
    State.difficult[k] = { book, unit, en, uz };
    if (State.localMode) { saveLocalStore(); return; }
    const ref = doc(db, "users", State.user.uid);
    await updateDoc(ref, { [`difficult.${k}`]: State.difficult[k] });
  }
}

async function removeDifficult(k) {
  delete State.difficult[k];
  if (State.localMode) { saveLocalStore(); return; }
  const ref = doc(db, "users", State.user.uid);
  await updateDoc(ref, { [`difficult.${k}`]: deleteField() });
}

async function recordMistake(book, unit, en, uz) {
  const k = keyFor(book, unit, en);
  const existing = State.mistakes[k];
  const entry = existing
    ? { book, unit, en, uz, count: (existing.count || 1) + 1 }
    : { book, unit, en, uz, count: 1 };
  State.mistakes[k] = entry;
  if (State.localMode) { saveLocalStore(); return; }
  const ref = doc(db, "users", State.user.uid);
  await updateDoc(ref, { [`mistakes.${k}`]: entry });
}

async function removeMistake(k) {
  delete State.mistakes[k];
  if (State.localMode) { saveLocalStore(); return; }
  const ref = doc(db, "users", State.user.uid);
  await updateDoc(ref, { [`mistakes.${k}`]: deleteField() });
}

// --------------------------------------------------------------------------
// Auth UI
// --------------------------------------------------------------------------
const AuthUI = {
  mode: "login", // or "register"
  render() {
    const main = document.getElementById("main");
    const tpl = document.getElementById("tpl-auth").content.cloneNode(true);
    main.innerHTML = "";
    main.appendChild(tpl);

    document.getElementById("tabs").classList.add("hidden");
    document.getElementById("userChip").classList.add("hidden");

    if (CONFIG_IS_PLACEHOLDER) {
      document.getElementById("setupNote").innerHTML =
        "⚠️ Firebase sozlanmagan. <code>app.js</code> faylidagi <code>firebaseConfig</code> qiymatini " +
        "o'zingizning Firebase loyihangiz ma'lumotlariga almashtiring (README.md ga qarang). " +
        "Hozircha kirish/ro'yhatdan o'tish ishlamaydi.";
    }

    this.applyMode();
    document.getElementById("authSwitchLink").onclick = () => {
      this.mode = this.mode === "login" ? "register" : "login";
      this.applyMode();
    };
    document.getElementById("authSubmit").onclick = () => this.submit();
    document.getElementById("authGoogle").onclick = () => this.google();
    document.getElementById("authPassword").addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.submit();
    });
  },
  applyMode() {
    const title = document.getElementById("authTitle");
    const submitBtn = document.getElementById("authSubmit");
    const switchText = document.getElementById("authSwitch");
    if (this.mode === "login") {
      title.textContent = "Xush kelibsiz";
      submitBtn.textContent = "Kirish";
      switchText.innerHTML = 'Hisobingiz yo\'qmi? <span id="authSwitchLink">Ro\'yhatdan o\'ting</span>';
    } else {
      title.textContent = "Ro'yhatdan o'tish";
      submitBtn.textContent = "Ro'yhatdan o'tish";
      switchText.innerHTML = 'Hisobingiz bormi? <span id="authSwitchLink">Kiring</span>';
    }
    document.getElementById("authSwitchLink").onclick = () => {
      this.mode = this.mode === "login" ? "register" : "login";
      this.applyMode();
    };
  },
  showError(msg) {
    const el = document.getElementById("authError");
    el.textContent = msg;
    el.classList.remove("hidden");
  },
  async submit() {
    if (!firebaseReady) { this.showError("Firebase sozlanmagan (yuqoridagi izohga qarang)."); return; }
    const email = document.getElementById("authEmail").value.trim();
    const pass = document.getElementById("authPassword").value;
    if (!email || !pass) { this.showError("Email va parolni kiriting."); return; }
    document.getElementById("authError").classList.add("hidden");
    try {
      if (this.mode === "login") {
        await signInWithEmailAndPassword(auth, email, pass);
      } else {
        await createUserWithEmailAndPassword(auth, email, pass);
      }
    } catch (e) {
      this.showError(this.friendlyError(e));
    }
  },
  async google() {
    if (!firebaseReady) { this.showError("Firebase sozlanmagan (yuqoridagi izohga qarang)."); return; }
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      this.showError(this.friendlyError(e));
    }
  },
  friendlyError(e) {
    const code = e && e.code ? e.code : "";
    const map = {
      "auth/invalid-email": "Email noto'g'ri formatda.",
      "auth/user-not-found": "Bunday foydalanuvchi topilmadi.",
      "auth/wrong-password": "Parol noto'g'ri.",
      "auth/email-already-in-use": "Bu email allaqachon ro'yhatdan o'tgan.",
      "auth/weak-password": "Parol kamida 6 ta belgidan iborat bo'lishi kerak.",
      "auth/invalid-credential": "Email yoki parol noto'g'ri.",
      "auth/network-request-failed": "Internet aloqasi bilan muammo."
    };
    return map[code] || ("Xatolik yuz berdi: " + (e.message || code));
  },
  async logout() {
    if (firebaseReady) await signOut(auth);
  }
};
window.AuthUI = AuthUI;

// --------------------------------------------------------------------------
// Router
// --------------------------------------------------------------------------
const Nav = {
  go(name, params = {}) {
    State.route = { name, ...params };
    this.updateActiveTab();
    Views.render();
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  },
  updateActiveTab() {
    document.querySelectorAll("nav.tabs button").forEach(b => {
      b.classList.toggle("active", b.dataset.tab === State.route.name);
    });
  }
};
window.Nav = Nav;

// --------------------------------------------------------------------------
// Views
// --------------------------------------------------------------------------
const Views = {
  render() {
    const main = document.getElementById("main");
    const r = State.route;
    if (r.name === "shelf") return this.shelf(main);
    if (r.name === "book") return this.book(main, r.bookId);
    if (r.name === "unit") return this.unit(main, r.bookId, r.unitNum);
    if (r.name === "quiz") return this.quiz(main);
    if (r.name === "result") return this.result(main);
    if (r.name === "difficult") return this.difficult(main);
    if (r.name === "mistakes") return this.mistakes(main);
    main.innerHTML = `<div class="loader">Sahifa topilmadi.</div>`;
  },

  crumbs(parts) {
    return `<div class="crumbs">${parts.map((p, i) =>
      i === parts.length - 1
        ? `<span>${p.label}</span>`
        : `<span class="link" data-crumb="${i}">${p.label}</span> <span>›</span>`
    ).join(" ")}</div>`;
  },

  shelf(main) {
    const b = State.vocab;
    const spineRows = b.map(book => {
      const total = book.units.reduce((s, u) => s + u.words.length, 0);
      const done = book.units.reduce((s, u) => s + u.words.filter(w => State.difficult[keyFor(book.id, u.unit, w.en)] !== undefined).length, 0);
      return `<div class="spine" style="--bc:${BOOK_COLORS[book.id]}" data-book="${book.id}">
        <span class="num">${book.id}</span>
        <span class="label">4000 ESSENTIAL WORDS</span>
        <span class="prog">${book.units.length} bob</span>
      </div>`;
    }).join("");

    main.innerHTML = `
      <div class="section-head"><h1>Kutubxona</h1><span class="hint">${b.length} ta kitob · ${b.reduce((s, k) => s + k.units.length, 0)} bob</span></div>
      <p class="shelf-intro">Kitobni tanlang, keyin bobni oching. Har bir bobda 20 ta so'z bor — o'qing, yodlang, so'ng test bilan tekshirib ko'ring.</p>
      <div class="shelf">${spineRows}</div>
    `;
    main.querySelectorAll(".spine").forEach(el => {
      el.onclick = () => Nav.go("book", { bookId: Number(el.dataset.book) });
    });
  },

  book(main, bookId) {
    const book = State.vocab.find(b => b.id === bookId);
    if (!book) return Nav.go("shelf");
    const tiles = book.units.map(u => {
      const learned = u.words.filter(w => State.difficult[keyFor(book.id, u.unit, w.en)]).length;
      return `<div class="unit-tile" data-unit="${u.unit}" style="border-color:${learned ? "rgba(232,163,61,.5)" : ""}">
        <span class="u-label">Bob</span>${u.unit}
      </div>`;
    }).join("");
    main.innerHTML = `
      ${this.crumbs([{ label: "Kutubxona" }, { label: "Kitob " + bookId }])}
      <div class="section-head"><h1>Kitob ${bookId}</h1><span class="hint">${book.units.length} bob · har birida 20 so'z</span></div>
      <div class="units-grid">${tiles}</div>
    `;
    main.querySelector('[data-crumb="0"]').onclick = () => Nav.go("shelf");
    main.querySelectorAll(".unit-tile").forEach(el => {
      el.onclick = () => Nav.go("unit", { bookId, unitNum: Number(el.dataset.unit) });
    });
  },

  unitDirection: "en2uz",

  unit(main, bookId, unitNum) {
    const book = State.vocab.find(b => b.id === bookId);
    const unit = book.units.find(u => u.unit === unitNum);
    const rows = unit.words.map(w => {
      const k = keyFor(bookId, unitNum, w.en);
      const active = !!State.difficult[k];
      return `<div class="word-row" data-en="${escapeAttr(w.en)}">
        <span class="word-en">${escapeHtml(w.en)}</span>
        <span class="word-uz">${escapeHtml(w.uz)}</span>
        <button class="star-btn ${active ? "active" : ""}" data-star="${escapeAttr(w.en)}" title="Qiyin so'zlarga qo'shish">${active ? "★" : "☆"}</button>
      </div>`;
    }).join("");

    main.innerHTML = `
      ${this.crumbs([{ label: "Kutubxona" }, { label: "Kitob " + bookId }, { label: "Bob " + unitNum }])}
      <div class="unit-toolbar">
        <div class="seg" id="dirSeg">
          <button data-dir="en2uz" class="${this.unitDirection === "en2uz" ? "active" : ""}">EN → UZ</button>
          <button data-dir="uz2en" class="${this.unitDirection === "uz2en" ? "active" : ""}">UZ → EN</button>
        </div>
        <button class="btn-test" id="startTestBtn">📝 Test ishlash (20 savol)</button>
      </div>
      <div class="section-head"><h1>Bob ${unitNum}</h1><span class="hint">So'zga bosing — tarjimasi ochiladi</span></div>
      <div class="word-list">${rows}</div>
    `;
    main.querySelectorAll('[data-crumb]').forEach(el => {
      el.onclick = () => {
        const i = Number(el.dataset.crumb);
        if (i === 0) Nav.go("shelf");
        if (i === 1) Nav.go("book", { bookId });
      };
    });
    main.querySelectorAll(".word-row").forEach(row => {
      row.addEventListener("click", (e) => {
        if (e.target.closest(".star-btn")) return;
        row.classList.toggle("revealed");
      });
    });
    main.querySelectorAll(".star-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const en = btn.dataset.star;
        const w = unit.words.find(x => x.en === en);
        await toggleDifficult(bookId, unitNum, w.en, w.uz);
        const active = !!State.difficult[keyFor(bookId, unitNum, w.en)];
        btn.classList.toggle("active", active);
        btn.textContent = active ? "★" : "☆";
        toast(active ? "Qiyin so'zlarga qo'shildi" : "Ro'yxatdan olib tashlandi");
      });
    });
    main.querySelectorAll("#dirSeg button").forEach(btn => {
      btn.onclick = () => {
        this.unitDirection = btn.dataset.dir;
        this.unit(main, bookId, unitNum);
      };
    });
    document.getElementById("startTestBtn").onclick = () => {
      Quiz.start(book, unit, this.unitDirection);
    };
  },

  quiz(main) {
    const q = State.quiz;
    const idx = q.index;
    const question = q.questions[idx];
    const progressPct = Math.round((idx / q.questions.length) * 100);

    main.innerHTML = `
      <div class="quiz-wrap">
        <div class="quiz-meta"><span>Kitob ${q.book.id} · Bob ${q.unit.unit}</span><span>${idx + 1} / ${q.questions.length}</span></div>
        <div class="quiz-progress"><div class="quiz-progress-bar" style="width:${progressPct}%"></div></div>
        <div class="quiz-question">
          <div class="q-dir">${q.direction === "en2uz" ? "Inglizcha so'zni tarjima qiling" : "O'zbekcha tarjimani so'zga moslang"}</div>
          <div class="q-word">${escapeHtml(question.prompt)}</div>
        </div>
        <div class="quiz-options" id="quizOptions">
          ${question.options.map((opt, i) => `<div class="q-option" data-i="${i}">${escapeHtml(opt)}</div>`).join("")}
        </div>
        <div class="quiz-next hidden" id="quizNextWrap"><button class="btn btn-primary" id="quizNextBtn" style="width:auto;padding:11px 28px;">Keyingisi →</button></div>
        <div class="quiz-exit"><button id="quizExitBtn">Testni tugatish</button></div>
      </div>
    `;

    let answered = false;
    main.querySelectorAll(".q-option").forEach(el => {
      el.onclick = async () => {
        if (answered) return;
        answered = true;
        const i = Number(el.dataset.i);
        const chosen = question.options[i];
        const isCorrect = chosen === question.answer;
        main.querySelectorAll(".q-option").forEach(o => o.classList.add("disabled"));
        el.classList.add(isCorrect ? "correct" : "wrong");
        if (!isCorrect) {
          main.querySelectorAll(".q-option").forEach(o => {
            if (o.textContent === question.answer) o.classList.add("correct");
          });
          question.wrong = true;
          await recordMistake(q.book.id, q.unit.unit, question.word.en, question.word.uz);
        }
        if (isCorrect) q.score++;
        document.getElementById("quizNextWrap").classList.remove("hidden");
      };
    });

    document.getElementById("quizNextBtn").onclick = () => {
      if (idx + 1 < q.questions.length) {
        q.index++;
        this.quiz(main);
      } else {
        Nav.go("result");
      }
    };
    document.getElementById("quizExitBtn").onclick = () => {
      if (confirm("Testni to'xtatib, bobga qaytasizmi?")) Nav.go("unit", { bookId: q.book.id, unitNum: q.unit.unit });
    };
  },

  result(main) {
    const q = State.quiz;
    const missed = q.questions.filter(x => x.wrong);
    main.innerHTML = `
      <div class="result-wrap">
        <div class="hint" style="color:var(--muted);font-size:13px;">Kitob ${q.book.id} · Bob ${q.unit.unit} natijasi</div>
        <div class="result-score">${q.score}/${q.questions.length}</div>
        <div class="result-label">${missed.length === 0 ? "Barakalla! Barcha savollarga to'g'ri javob berdingiz." : missed.length + " ta so'zda xato qildingiz — ular \"Xatolarim\" ro'yxatiga saqlandi."}</div>
        ${missed.length ? `<div class="result-list"><h4>Xato qilingan so'zlar</h4>${missed.map(m => `
          <div class="result-row"><span class="r-en">${escapeHtml(m.word.en)}</span><span class="r-correct">${escapeHtml(m.word.uz)}</span></div>
        `).join("")}</div>` : ""}
        <div class="result-actions">
          <button class="btn btn-ghost" id="backUnitBtn">← Bobga qaytish</button>
          <button class="btn btn-primary" id="retryBtn">Qayta test ishlash</button>
        </div>
      </div>
    `;
    document.getElementById("backUnitBtn").onclick = () => Nav.go("unit", { bookId: q.book.id, unitNum: q.unit.unit });
    document.getElementById("retryBtn").onclick = () => Quiz.start(q.book, q.unit, q.direction);
  },

  difficult(main) {
    const items = Object.entries(State.difficult).sort((a, b) => a[1].book - b[1].book || a[1].unit - b[1].unit);
    if (items.length === 0) {
      main.innerHTML = `<div class="section-head"><h1>Qiyin so'zlar</h1></div>
        <div class="empty-state"><div class="big">⭐</div>Hali hech qanday so'z saqlanmagan.<br>Bob ichida so'z yonidagi yulduzchani bosing.</div>`;
      return;
    }
    main.innerHTML = `
      <div class="section-head"><h1>Qiyin so'zlar</h1><span class="hint">${items.length} ta so'z</span></div>
      <div class="saved-list">${items.map(([k, w]) => `
        <div class="saved-row" data-k="${k}">
          <span class="meta">K${w.book}·B${w.unit}</span>
          <span class="word-en">${escapeHtml(w.en)}</span>
          <span class="word-uz">${escapeHtml(w.uz)}</span>
          <button class="remove" data-remove="${k}">✕</button>
        </div>`).join("")}</div>
    `;
    main.querySelectorAll("[data-remove]").forEach(btn => {
      btn.onclick = async () => {
        await removeDifficult(btn.dataset.remove);
        this.difficult(main);
        toast("Ro'yxatdan olib tashlandi");
      };
    });
  },

  mistakes(main) {
    const items = Object.entries(State.mistakes).sort((a, b) => (b[1].count || 1) - (a[1].count || 1));
    if (items.length === 0) {
      main.innerHTML = `<div class="section-head"><h1>Xatolarim</h1></div>
        <div class="empty-state"><div class="big">❌</div>Hali xato qilingan so'zlar yo'q.<br>Test ishlaganingizda xato qilgan so'zlaringiz shu yerda saqlanadi.</div>`;
      return;
    }
    main.innerHTML = `
      <div class="section-head"><h1>Xatolarim</h1><span class="hint">${items.length} ta so'z</span></div>
      <div class="saved-list">${items.map(([k, w]) => `
        <div class="saved-row" data-k="${k}">
          <span class="meta">K${w.book}·B${w.unit}</span>
          <span class="word-en">${escapeHtml(w.en)}</span>
          <span class="word-uz">${escapeHtml(w.uz)}</span>
          <span class="meta">${w.count || 1}x xato</span>
          <button class="remove" data-remove="${k}">✕</button>
        </div>`).join("")}</div>
    `;
    main.querySelectorAll("[data-remove]").forEach(btn => {
      btn.onclick = async () => {
        await removeMistake(btn.dataset.remove);
        this.mistakes(main);
        toast("Ro'yxatdan olib tashlandi");
      };
    });
  }
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

// --------------------------------------------------------------------------
// Quiz engine
// --------------------------------------------------------------------------
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickDistractors(pool, count, exclude) {
  const excludeSet = new Set(exclude.map(x => x.trim().toLowerCase()));
  const seen = new Set();
  const candidates = shuffle(pool).filter(v => {
    const key = v.trim().toLowerCase();
    if (excludeSet.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return candidates.slice(0, count);
}

const Quiz = {
  start(book, unit, direction) {
    const unitWords = unit.words;
    const otherUnitWords = book.units.filter(u => u.unit !== unit.unit).flatMap(u => u.words);

    const questions = shuffle(unitWords).map(word => {
      const answer = direction === "en2uz" ? word.uz : word.en;
      const prompt = direction === "en2uz" ? word.en : word.uz;

      const sameUnitPool = unitWords.filter(w => w.en !== word.en).map(w => direction === "en2uz" ? w.uz : w.en);
      const bookPool = otherUnitWords.map(w => direction === "en2uz" ? w.uz : w.en);

      const d1 = pickDistractors(sameUnitPool, 2, [answer]);
      const d2 = pickDistractors(bookPool, 2, [answer, ...d1]);
      let options = [answer, ...d1, ...d2];
      // Safety net: if not enough unique distractors were found anywhere, backfill from combined pool
      if (options.length < 4) {
        const backfill = pickDistractors([...sameUnitPool, ...bookPool], 4 - options.length, [...options]);
        options = [...options, ...backfill];
      }
      options = shuffle(options.slice(0, 4));

      return { word, prompt, answer, options, wrong: false };
    });

    State.quiz = { book, unit, direction, questions, index: 0, score: 0 };
    Nav.go("quiz");
  }
};
window.Quiz = Quiz;

// --------------------------------------------------------------------------
// Demo banner (shown only in local mode, i.e. Firebase not configured yet)
// --------------------------------------------------------------------------
function showDemoBanner() {
  const bar = document.createElement("div");
  bar.style.cssText = "background:rgba(232,163,61,0.12);border-bottom:1px solid rgba(232,163,61,0.35);" +
    "color:#f4c569;font-size:12.5px;text-align:center;padding:8px 14px;";
  bar.innerHTML = "🔧 Demo rejim: ma'lumotlar faqat shu brauzerda saqlanmoqda. " +
    "Hisob tizimi va barcha qurilmalarda saqlash uchun <code style=\"background:rgba(0,0,0,0.25);padding:1px 5px;border-radius:4px;\">app.js</code> ichida Firebase'ni sozlang (README.md).";
  document.getElementById("topbar").insertAdjacentElement("afterend", bar);
}

// --------------------------------------------------------------------------
// Boot
// --------------------------------------------------------------------------
async function boot() {
  await loadVocab();

  if (!firebaseReady) {
    // Local demo mode: skip real auth, use a browser-only pseudo user so the
    // whole app (difficult words, tests, mistakes) can be tried immediately.
    State.localMode = true;
    State.user = { uid: "local", email: "Mehmon (lokal rejim)" };
    await loadUserData("local");
    document.getElementById("tabs").classList.remove("hidden");
    document.getElementById("userChip").classList.remove("hidden");
    document.getElementById("userEmail").textContent = "Mehmon (lokal)";
    document.getElementById("userChip").querySelector("button").textContent = "Ma'lumotlarni tozalash";
    document.getElementById("userChip").querySelector("button").onclick = () => {
      if (confirm("Shu brauzerdagi barcha saqlangan so'zlarni o'chirasizmi?")) {
        localStorage.removeItem(LOCAL_KEY);
        State.difficult = {};
        State.mistakes = {};
        Nav.go("shelf");
        toast("Tozalandi");
      }
    };
    showDemoBanner();
    Nav.go("shelf");
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      State.user = user;
      await loadUserData(user.uid);
      document.getElementById("tabs").classList.remove("hidden");
      document.getElementById("userChip").classList.remove("hidden");
      document.getElementById("userEmail").textContent = user.email || "Foydalanuvchi";
      Nav.go("shelf");
    } else {
      State.user = null;
      document.getElementById("tabs").classList.add("hidden");
      document.getElementById("userChip").classList.add("hidden");
      AuthUI.render();
    }
  });
}

boot();
