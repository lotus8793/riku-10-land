"use strict";

const CHALLENGE_SECONDS = 60;
const TIMER_TICK_MS = 100;
const MAX_RECORDS = 10;
const STICKER_STEP = 10;

const MODES = ["simple", "pair", "bridge", "minus"];

const RECORDS_KEYS = {
  simple: "riku10v2-records-simple",
  pair: "riku10v2-records-pair",
  bridge: "riku10v2-records-bridge",
  minus: "riku10v2-records-minus"
};
const TOTAL_KEY = "riku10v2-total-correct";
const TIMED_KEY = "riku10v2-timed-enabled";
const CAUGHT_KEY = "riku10v2-caught";
const DAILY_KEY = "riku10v2-daily";
const MISSION_GOAL = 20;
const SHINY_RATE = 0.1;
const CATCH_RATE = 0.8;

const STICKERS = [
  { id: 25, name: "ピカチュウ" },
  { id: 133, name: "イーブイ" },
  { id: 7, name: "ゼニガメ" },
  { id: 4, name: "ヒトカゲ" },
  { id: 1, name: "フシギダネ" },
  { id: 39, name: "プリン" },
  { id: 175, name: "トゲピー" },
  { id: 54, name: "コダック" },
  { id: 52, name: "ニャース" },
  { id: 35, name: "ピッピ" },
  { id: 129, name: "コイキング" },
  { id: 393, name: "ポッチャマ" },
  { id: 722, name: "モクロー" },
  { id: 813, name: "ヒバニー" },
  { id: 906, name: "ニャオハ" },
  { id: 912, name: "クワッス" },
  { id: 909, name: "ホゲータ" },
  { id: 12, name: "バタフリー" },
  { id: 104, name: "カラカラ" },
  { id: 143, name: "カビゴン" },
  { id: 94, name: "ゲンガー" },
  { id: 131, name: "ラプラス" },
  { id: 130, name: "ギャラドス" },
  { id: 9, name: "カメックス" },
  { id: 6, name: "リザードン" },
  { id: 448, name: "ルカリオ" },
  { id: 658, name: "ゲッコウガ" },
  { id: 778, name: "ミミッキュ" },
  { id: 151, name: "ミュウ" },
  { id: 149, name: "カイリュー" },
  { id: 384, name: "レックウザ" },
  { id: 150, name: "ミュウツー" },
  { id: 144, name: "フリーザー" },
  { id: 145, name: "サンダー" },
  { id: 146, name: "ファイヤー" },
  { id: 249, name: "ルギア" },
  { id: 250, name: "ホウオウ" },
  { id: 26, name: "ライチュウ" },
  { id: 172, name: "ピチュー" },
  { id: 134, name: "シャワーズ" },
  { id: 135, name: "サンダース" },
  { id: 136, name: "ブースター" },
  { id: 196, name: "エーフィ" },
  { id: 197, name: "ブラッキー" },
  { id: 700, name: "ニンフィア" },
  { id: 59, name: "ウインディ" },
  { id: 38, name: "キュウコン" },
  { id: 142, name: "プテラ" },
  { id: 445, name: "ガブリアス" },
  { id: 447, name: "リオル" },
  { id: 248, name: "バンギラス" },
  { id: 373, name: "ボーマンダ" },
  { id: 376, name: "メタグロス" },
  { id: 282, name: "サーナイト" },
  { id: 257, name: "バシャーモ" },
  { id: 254, name: "ジュカイン" },
  { id: 260, name: "ラグラージ" },
  { id: 392, name: "ゴウカザル" },
  { id: 395, name: "エンペルト" },
  { id: 501, name: "ミジュマル" },
  { id: 63, name: "ケーシィ" },
  { id: 95, name: "イワーク" },
  { id: 132, name: "メタモン" },
  { id: 147, name: "ミニリュウ" },
  { id: 152, name: "チコリータ" },
  { id: 155, name: "ヒノアラシ" },
  { id: 158, name: "ワニノコ" },
  { id: 212, name: "ハッサム" },
  { id: 243, name: "ライコウ" },
  { id: 244, name: "エンテイ" },
  { id: 245, name: "スイクン" },
  { id: 255, name: "アチャモ" },
  { id: 258, name: "ミズゴロウ" },
  { id: 302, name: "ヤミラミ" },
  { id: 311, name: "プラスル" },
  { id: 312, name: "マイナン" },
  { id: 359, name: "アブソル" },
  { id: 380, name: "ラティアス" },
  { id: 381, name: "ラティオス" },
  { id: 382, name: "カイオーガ" },
  { id: 383, name: "グラードン" },
  { id: 385, name: "ジラーチ" },
  { id: 387, name: "ナエトル" },
  { id: 390, name: "ヒコザル" },
  { id: 417, name: "パチリス" },
  { id: 483, name: "ディアルガ" },
  { id: 484, name: "パルキア" },
  { id: 491, name: "ダークライ" },
  { id: 495, name: "ツタージャ" },
  { id: 570, name: "ゾロア" }
];

function stickerImageUrl(id, shiny = false) {
  const variant = shiny ? "shiny/" : "";
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${variant}${id}.png`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function loadCaught() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CAUGHT_KEY) || "null");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {}
  // 旧仕様（順番アンロック）からの引き継ぎ
  const caught = {};
  const total = Number(localStorage.getItem(TOTAL_KEY) || "0") || 0;
  const legacy = Math.min(Math.floor(total / STICKER_STEP), STICKERS.length);
  for (let i = 0; i < legacy; i += 1) {
    caught[STICKERS[i].id] = { n: 1, s: 0 };
  }
  return caught;
}

function loadDaily() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DAILY_KEY) || "null");
    if (parsed && parsed.date === todayStr()) return parsed;
  } catch {}
  return { date: todayStr(), count: 0, done: false };
}

const PRAISES = ["できた！", "すごい！", "やったね！", "てんさい！", "かんぺき！", "ナイス！"];
const CHEERS = ["つぎはがんばろう", "あといっぽ", "りくならできるよ", "てきとうにやってる？", "かんがえてますか？", "しゅうちゅうして！", "こんなのおぼえるだけだからね！"];

const CONFETTI_COLORS = ["#ff6b6b", "#f9c74f", "#2fbf71", "#3b82f6", "#b388ff", "#ff9f1c"];

const pairs = [
  { base: 1, friend: 9 },
  { base: 2, friend: 8, showReverse: true },
  { base: 3, friend: 7, showReverse: true },
  { base: 4, friend: 6, showReverse: true },
  { base: 5, friend: 5 },
  { base: 6, friend: 4 },
  { base: 7, friend: 3 },
  { base: 8, friend: 2 },
  { base: 9, friend: 1 },
  { base: 2, friend: 8, showReverse: true },
  { base: 3, friend: 7, showReverse: true },
  { base: 4, friend: 6, showReverse: true },
];

function makeBridgeProblems() {
  const problems = [];
  for (let big = 6; big <= 9; big += 1) {
    for (let small = 2; small <= 9; small += 1) {
      const answer = big + small;
      if (answer >= 11 && answer <= 19) {
        problems.push({ big, small });
      }
    }
  }
  return problems;
}

function makeSimpleProblems() {
  const problems = [];
  for (let a = 1; a <= 8; a += 1) {
    for (let b = 1; b <= 8; b += 1) {
      if (a + b <= 9) {
        problems.push({ a, b });
      }
    }
  }
  return problems;
}

function makeMinusProblems() {
  const problems = [];
  for (let a = 2; a <= 10; a += 1) {
    for (let b = 1; b < a; b += 1) {
      problems.push({ a, b });
    }
  }
  return problems;
}

const bridgeProblems = makeBridgeProblems();
const simpleProblems = makeSimpleProblems();
const minusProblems = makeMinusProblems();

function loadModeRecords(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((record) => Number.isFinite(record.score) && typeof record.date === "string")
      .slice(0, MAX_RECORDS);
  } catch {
    return [];
  }
}

const state = {
  problem: { simple: null, pair: null, bridge: null, minus: null },
  lastKey: { simple: "", pair: "", bridge: "", minus: "" },
  started: { simple: false, pair: false, bridge: false, minus: false },
  locked: { simple: true, pair: true, bridge: true, minus: true },
  records: {
    simple: loadModeRecords(RECORDS_KEYS.simple),
    pair: loadModeRecords(RECORDS_KEYS.pair),
    bridge: loadModeRecords(RECORDS_KEYS.bridge),
    minus: loadModeRecords(RECORDS_KEYS.minus)
  },
  combo: 0,
  stars: 0,
  highScore: 0,
  totalCorrect: Number(localStorage.getItem(TOTAL_KEY) || "0") || 0,
  activeMode: "simple",
  caught: loadCaught(),
  daily: loadDaily(),
  nextQuestionTimeoutId: null,
  timedEnabled: localStorage.getItem(TIMED_KEY) === "true",
  blocksEnabled: localStorage.getItem("riku10v2-blocks-enabled") !== "false",
  challenge: { remainingMs: CHALLENGE_SECONDS * 1000, intervalId: null, ended: false }
};

function computeHighScore() {
  return Math.max(...MODES.flatMap((mode) => state.records[mode].map((r) => r.score)), 0);
}

state.highScore = computeHighScore();

function qs(selector) {
  return document.querySelector(selector);
}

const M = {};
MODES.forEach((mode) => {
  M[mode] = {
    section: qs(`#${mode}-mode`),
    feedback: qs(`#${mode}-feedback`),
    next: qs(`#${mode}-next`),
    start: qs(`#${mode}-start`),
    timerRow: qs(`#${mode}-timer-row`),
    time: qs(`#${mode}-time`),
    timerFill: qs(`#${mode}-timer-fill`),
    choices: qs(`#${mode}-choices`),
    recordsList: qs(`#${mode}-records-list`),
    recordsEmpty: qs(`#${mode}-records-empty`)
  };
});

const els = {
  stars: qs("#stars"),
  highScore: qs("#high-score"),
  timeToggle: qs("#time-toggle"),
  timeToggleLabel: qs("#time-toggle-label"),
  pairNumber: qs("#pair-number"),
  pairFrame: qs("#pair-frame"),
  pairReverseSection: qs("#pair-reverse"),
  pairReverseEquation: qs("#pair-reverse-equation"),
  pairReverseFrame: qs("#pair-reverse-frame"),
  blockToggle: qs("#block-toggle"),
  blockToggleLabel: qs("#block-toggle-label"),
  bridgeEquation: qs("#bridge-equation"),
  bridgeChain: qs("#bridge-chain"),
  bridgeLeftLabel: qs("#bridge-left-label"),
  bridgeRightLabel: qs("#bridge-right-label"),
  bridgeFrame: qs("#bridge-frame"),
  donorDots: qs("#donor-dots"),
  simpleEquation: qs("#simple-equation"),
  simpleFrame: qs("#simple-frame"),
  minusEquation: qs("#minus-equation"),
  minusFrame: qs("#minus-frame"),
  confetti: qs("#confetti"),
  flyLayer: qs("#fly-layer"),
  stickerOverlay: qs("#sticker-overlay"),
  stickerImg: qs("#sticker-img"),
  stickerName: qs("#sticker-name"),
  stickerCaption: qs("#sticker-caption"),
  pokeball: qs("#pokeball"),
  dexCount: qs("#dex-count"),
  dexProgress: qs("#dex-progress"),
  dexGrid: qs("#dex-grid"),
  catchFill: qs("#catch-fill"),
  catchText: qs("#catch-text"),
  missionFill: qs("#mission-fill"),
  missionText: qs("#mission-text"),
  parentNote: qs("#parent-note")
};

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function abKey(p) {
  return `${p.a}-${p.b}`;
}

function problemKey(problem) {
  return `${problem.big ?? problem.base}+${problem.small ?? problem.friend}`;
}

function pickDifferent(items, lastKey) {
  if (items.length <= 1) return pick(items);
  const candidates = items.filter((item) => problemKey(item) !== lastKey);
  return pick(candidates.length ? candidates : items);
}

function pickDifferentAb(items, lastKey) {
  if (items.length <= 1) return pick(items);
  const candidates = items.filter((item) => abKey(item) !== lastKey);
  return pick(candidates.length ? candidates : items);
}

/* ---------- きろく ---------- */

function formatRecordDate(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function saveRecords() {
  MODES.forEach((mode) => {
    localStorage.setItem(RECORDS_KEYS[mode], JSON.stringify(state.records[mode]));
  });
}

function renderModeRecords(records, listEl, emptyEl) {
  listEl.replaceChildren();
  emptyEl.classList.toggle("is-hidden", records.length > 0);

  records.forEach((record, index) => {
    const row = document.createElement("li");
    row.className = "record-row";

    const rank = document.createElement("span");
    rank.className = "record-rank";
    rank.textContent = index + 1;

    const score = document.createElement("strong");
    score.className = "record-score";
    score.textContent = `${record.score}もん`;

    const date = document.createElement("span");
    date.className = "record-date";
    date.textContent = formatRecordDate(record.date);

    row.append(rank, score, date);
    listEl.append(row);
  });
}

function renderRecords() {
  MODES.forEach((mode) => {
    renderModeRecords(state.records[mode], M[mode].recordsList, M[mode].recordsEmpty);
  });
}

function addRecord(score, mode) {
  if (!score || !MODES.includes(mode)) return;
  state.records[mode] = [...state.records[mode], { score, date: new Date().toISOString() }]
    .sort((a, b) => b.score - a.score || new Date(b.date) - new Date(a.date))
    .slice(0, MAX_RECORDS);
  state.highScore = computeHighScore();
  saveRecords();
  renderRecords();
}

function saveScore() {
  els.stars.textContent = state.stars;
  els.highScore.textContent = state.highScore;
  els.parentNote.textContent = state.timedEnabled
    ? `60びょうで ${state.stars}もん。ベスト ${state.highScore}もん。`
    : `じかんなしモード（れんしゅう）。ポケモンゲットもカウント中。いま ${totalCaught()}ひき。`;
}

/* ---------- ポケモン ---------- */

function saveCaught() {
  localStorage.setItem(CAUGHT_KEY, JSON.stringify(state.caught));
}

function saveDaily() {
  localStorage.setItem(DAILY_KEY, JSON.stringify(state.daily));
}

function rolloverDaily() {
  if (state.daily.date !== todayStr()) {
    state.daily = { date: todayStr(), count: 0, done: false };
    saveDaily();
  }
}

function totalCaught() {
  return Object.values(state.caught).reduce((sum, e) => sum + (e.n || 0) + (e.s || 0), 0);
}

function speciesCaught() {
  return Object.values(state.caught).filter((e) => (e.n || 0) + (e.s || 0) > 0).length;
}

const overlayQueue = [];
let overlayActive = false;

function queueCatchOverlay(item) {
  overlayQueue.push(item);
  if (!overlayActive) showNextOverlay();
}

function showNextOverlay() {
  const item = overlayQueue.shift();
  if (!item) {
    overlayActive = false;
    return;
  }
  overlayActive = true;
  const popEl = els.stickerOverlay.querySelector(".sticker-pop");
  const ball = els.pokeball;

  // 準備（結果はまだ見せない）
  els.stickerImg.src = stickerImageUrl(item.species.id, item.shiny);
  els.stickerImg.alt = item.species.name;
  els.stickerName.textContent = item.shiny ? `✨いろちがいの ${item.species.name}✨` : item.species.name;
  els.stickerCaption.textContent = "つかまえちゅう…";
  popEl.classList.remove("is-shiny", "is-fled");
  popEl.classList.add("is-capturing");
  ball.classList.remove("is-caught", "is-burst");
  els.stickerOverlay.classList.remove("is-hidden");
  popEl.classList.remove("is-animating");
  void popEl.offsetWidth;
  popEl.classList.add("is-animating");

  const reveal = () => {
    popEl.classList.remove("is-capturing");
    popEl.classList.toggle("is-shiny", item.shiny && !item.fled);
    popEl.classList.toggle("is-fled", Boolean(item.fled));
    els.stickerCaption.textContent = item.fled
      ? "あっ！ にげられた…"
      : item.bonus
        ? "ミッションクリア ボーナス！"
        : "ポケモン ゲット！";
    playTone(item.fled ? "flee" : item.shiny ? "shiny" : "sticker");
    setTimeout(() => {
      els.stickerOverlay.classList.add("is-hidden");
      showNextOverlay();
    }, 2000);
  };

  // ボールが揺れる → 成功: 金色に変化 / 失敗: はじけて飛び出す
  setTimeout(() => {
    if (item.fled) {
      ball.classList.add("is-burst");
      setTimeout(reveal, 420);
    } else {
      ball.classList.add("is-caught");
      playTone("click");
      setTimeout(reveal, 780);
    }
  }, 1550);
}

function catchPokemon(bonus) {
  // 演出中はチャレンジタイマーを止める（「つぎへ」で再開）
  stopChallengeTimer();
  const species = pick(STICKERS);
  const fled = !bonus && Math.random() >= CATCH_RATE;
  if (fled) {
    queueCatchOverlay({ species, shiny: false, bonus: false, fled: true });
    return;
  }
  const shiny = Math.random() < SHINY_RATE;
  const entry = state.caught[species.id] || { n: 0, s: 0 };
  if (shiny) entry.s = (entry.s || 0) + 1;
  else entry.n = (entry.n || 0) + 1;
  state.caught[species.id] = entry;
  saveCaught();
  queueCatchOverlay({ species, shiny, bonus, fled: false });
}

function renderMission() {
  rolloverDaily();
  const remain = STICKER_STEP - (state.totalCorrect % STICKER_STEP);
  const catchPercent = ((STICKER_STEP - remain) / STICKER_STEP) * 100;
  els.catchFill.style.width = `${catchPercent}%`;
  els.catchText.textContent = `あと${remain}もん`;

  const percent = Math.min(100, (state.daily.count / MISSION_GOAL) * 100);
  els.missionFill.style.width = `${percent}%`;
  els.missionFill.classList.toggle("is-done", state.daily.done);
  els.missionText.textContent = state.daily.done
    ? "クリア！🎉"
    : `あと ${MISSION_GOAL - state.daily.count}もん`;
}

function renderDex() {
  els.dexCount.textContent = `${speciesCaught()}しゅるい / ${STICKERS.length}`;

  const remain = STICKER_STEP - (state.totalCorrect % STICKER_STEP);
  els.dexProgress.textContent = `ぜんぶで ${totalCaught()}ひき。あと ${remain}もん で つぎのポケモン`;

  const entries = STICKERS.map((species, index) => {
    const entry = state.caught[species.id] || { n: 0, s: 0 };
    return { ...species, index, count: (entry.n || 0) + (entry.s || 0), shinyCount: entry.s || 0 };
  });
  // 持っている数が多い順 → 図鑑順。未ゲットは最後
  entries.sort((a, b) => {
    if ((b.count > 0) !== (a.count > 0)) return b.count > 0 ? 1 : -1;
    return b.count - a.count || a.index - b.index;
  });

  els.dexGrid.replaceChildren();
  entries.forEach((entry) => {
    const cell = document.createElement("span");
    cell.className = "sticker-cell";
    if (entry.count > 0) {
      const img = document.createElement("img");
      img.className = "sticker-img";
      img.src = stickerImageUrl(entry.id, entry.shinyCount > 0);
      img.alt = entry.name;
      img.loading = "lazy";
      cell.append(img);
      cell.title = entry.name;
      if (entry.count >= 2) {
        const dupe = document.createElement("span");
        dupe.className = "dex-dupe";
        dupe.textContent = `×${entry.count}`;
        cell.append(dupe);
      }
      if (entry.shinyCount > 0) {
        const shiny = document.createElement("span");
        shiny.className = "dex-shiny";
        shiny.textContent = "✨";
        cell.append(shiny);
      }
    } else {
      cell.textContent = "？";
      cell.classList.add("is-locked");
    }
    els.dexGrid.append(cell);
  });
}

function registerWrong() {
  state.totalCorrect = Math.max(0, state.totalCorrect - 1);
  localStorage.setItem(TOTAL_KEY, String(state.totalCorrect));
  rolloverDaily();
  state.daily.count = Math.max(0, state.daily.count - 1);
  saveDaily();
  renderMission();
}

function registerCorrect() {
  state.totalCorrect += 1;
  localStorage.setItem(TOTAL_KEY, String(state.totalCorrect));
  rolloverDaily();
  state.daily.count += 1;
  saveDaily();
  if (state.totalCorrect % STICKER_STEP === 0) {
    catchPokemon(false);
  }
  if (!state.daily.done && state.daily.count >= MISSION_GOAL) {
    state.daily.done = true;
    saveDaily();
    catchPokemon(true);
  }
  renderMission();
}

/* ---------- 演出 ---------- */

function burstConfetti(count) {
  for (let index = 0; index < count; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = pick(CONFETTI_COLORS);
    piece.style.animationDelay = `${Math.random() * 220}ms`;
    piece.style.setProperty("--drift", `${(Math.random() * 2 - 1) * 140}px`);
    piece.style.setProperty("--spin", `${Math.random() * 720 - 360}deg`);
    els.confetti.append(piece);
    setTimeout(() => piece.remove(), 1700);
  }
}

function playTone(kind, combo = 0) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const ctx = new AudioContext();
  // C5, E5, G5, C6, E6, G6, C7 — コンボ5ごとに1音ずつ豪華に
  const LADDER = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98, 2093];
  const tier = Math.min(Math.floor(combo / 5), LADDER.length - 3);
  const notes = kind === "good"
    ? LADDER.slice(0, 3 + tier)
    : kind === "sticker"
      ? [523.25, 659.25, 783.99, 1046.5, 1318.5]
      : kind === "shiny"
        ? [659.25, 783.99, 1046.5, 1318.5, 1567.98, 2093]
        : kind === "flee"
          ? [392, 293.66]
          : kind === "click"
            ? [987.77]
            : [330, 220];

  notes.forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = kind === "try" ? "sawtooth" : "triangle";
    osc.frequency.value = freq;
    const at = ctx.currentTime + index * 0.09;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(kind === "try" ? 0.12 : 0.16, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    osc.start(at);
    osc.stop(at + 0.24);
  });
}

function praiseText() {
  const base = pick(PRAISES);
  return state.combo >= 2 ? `${base} 🔥${state.combo}れんぞく` : base;
}

function onCorrect(mode) {
  state.locked[mode] = true;
  stopChallengeTimer();
  state.combo += 1;
  countSolvedQuestion();
  if (!state.challenge.ended) {
    registerCorrect();
  }
  const feedback = M[mode].feedback;
  feedback.className = "feedback is-good";
  feedback.textContent = praiseText();
  setNextButton(mode, true);
  burstConfetti(Math.min(14 + Math.floor(state.combo / 5) * 10, 54));
  playTone("good", state.combo);
  saveScore();
}

function onWrong(mode, _hint, correctValue) {
  state.combo = 0;
  state.locked[mode] = true;
  stopChallengeTimer();
  if (!state.challenge.ended) {
    registerWrong();
  }
  const feedback = M[mode].feedback;
  feedback.className = "feedback is-try";
  feedback.innerHTML = `ふせいかい！<br><span class="feedback-cheer">${pick(CHEERS)}</span>`;
  playTone("try");
  if (correctValue !== undefined) {
    const btn = M[mode].choices.querySelector(`[data-value="${correctValue}"]`);
    if (btn) btn.classList.add("is-correct");
  }
  setNextButton(mode, true);
}

/* ---------- 10マス・カード描画 ---------- */

function renderTenFrame(container, filled, needed = 0, friendFilled = false, hideNeeded = false) {
  container.replaceChildren();
  for (let index = 0; index < 10; index += 1) {
    const cell = document.createElement("div");
    cell.className = "frame-cell";
    if (index < filled) cell.classList.add("is-filled");
    if (index >= filled && index < filled + needed) {
      cell.classList.add(friendFilled ? "is-friend-filled" : "is-needed");
      if (hideNeeded && !friendFilled) {
        cell.classList.add("is-hidden-slot");
      }
      if (friendFilled) {
        cell.style.setProperty("--pop-delay", `${(index - filled) * 55}ms`);
      }
    }
    container.append(cell);
  }
}

function renderMinusFrame(total, removed) {
  els.minusFrame.replaceChildren();
  for (let index = 0; index < 10; index += 1) {
    const cell = document.createElement("div");
    cell.className = "frame-cell";
    if (index < total) {
      cell.classList.add("is-filled");
      if (index >= total - removed) {
        cell.classList.add("is-removed");
        cell.style.setProperty("--pop-delay", `${(index - (total - removed)) * 55}ms`);
      }
    }
    els.minusFrame.append(cell);
  }
}

function renderChoiceButtons(container, values, onChoose) {
  container.replaceChildren();
  values.forEach((value) => {
    const button = document.createElement("button");
    button.className = "choice-card";
    button.type = "button";
    button.textContent = value;
    button.dataset.value = String(value);
    button.addEventListener("click", () => onChoose(value, button));
    container.append(button);
  });
}

/* ---------- タイマー・チャレンジ ---------- */

function stopChallengeTimer() {
  if (state.challenge.intervalId) {
    clearInterval(state.challenge.intervalId);
    state.challenge.intervalId = null;
  }
}

function setNextButton(mode, visible) {
  M[mode].next.classList.toggle("is-hidden", !visible);
}

function setModeWaiting(mode, waiting) {
  M[mode].section.classList.toggle("is-waiting", waiting);
}

function resetModeStart(mode) {
  state.started[mode] = false;
  setModeWaiting(mode, true);
  state.locked[mode] = true;
  setNextButton(mode, false);
}

function clearNextQuestion() {
  if (state.nextQuestionTimeoutId) {
    clearTimeout(state.nextQuestionTimeoutId);
    state.nextQuestionTimeoutId = null;
  }
}

function renderTimerRows() {
  MODES.forEach((mode) => {
    const parts = M[mode];
    parts.timerRow.classList.toggle("is-hidden", !state.timedEnabled);
    const seconds = Math.max(0, Math.ceil(state.challenge.remainingMs / 1000));
    const percent = Math.max(0, Math.min(100, (state.challenge.remainingMs / (CHALLENGE_SECONDS * 1000)) * 100));
    parts.time.textContent = seconds;
    parts.timerFill.style.width = `${percent}%`;
    parts.timerFill.classList.toggle("is-low", seconds <= 10);
  });
}

function renderTimeToggle() {
  els.timeToggle.classList.toggle("is-on", state.timedEnabled);
  els.timeToggle.setAttribute("aria-pressed", String(state.timedEnabled));
  els.timeToggleLabel.textContent = state.timedEnabled ? "じかんあり" : "じかんなし";
  renderTimerRows();
}

function resetChallengeScore() {
  state.stars = 0;
  state.challenge.remainingMs = CHALLENGE_SECONDS * 1000;
  state.challenge.ended = false;
  renderTimerRows();
  saveScore();
}

function handleChallengeEnd() {
  const finalScore = state.stars;
  state.challenge.remainingMs = 0;
  state.challenge.ended = true;
  MODES.forEach((mode) => {
    state.locked[mode] = true;
  });
  stopChallengeTimer();
  renderTimerRows();
  addRecord(finalScore, state.activeMode);
  saveScore();

  if (MODES.includes(state.activeMode)) {
    const feedback = M[state.activeMode].feedback;
    feedback.className = "feedback is-try";
    feedback.textContent = `じかんぎれ。${finalScore}もんできた！`;
    setNextButton(state.activeMode, true);
  }
}

function startChallengeTimer() {
  if (!state.timedEnabled || state.challenge.ended || state.challenge.intervalId) return;
  renderTimerRows();
  state.challenge.intervalId = setInterval(() => {
    state.challenge.remainingMs = Math.max(0, state.challenge.remainingMs - TIMER_TICK_MS);
    renderTimerRows();

    if (state.challenge.remainingMs <= 0) {
      handleChallengeEnd();
    }
  }, TIMER_TICK_MS);
}

function renderBlockToggle() {
  els.blockToggle.classList.toggle("is-on", state.blocksEnabled);
  els.blockToggle.setAttribute("aria-pressed", String(state.blocksEnabled));
  els.blockToggleLabel.textContent = state.blocksEnabled ? "ブロックあり" : "ブロックなし";
}

function setBlockDisplay(enabled) {
  state.blocksEnabled = enabled;
  localStorage.setItem("riku10v2-blocks-enabled", String(enabled));
  renderBlockToggle();
}

function setTimedMode(enabled) {
  state.timedEnabled = enabled;
  localStorage.setItem(TIMED_KEY, String(enabled));
  stopChallengeTimer();
  resetChallengeScore();
  MODES.forEach(resetModeStart);
  renderTimeToggle();
}

function countSolvedQuestion() {
  if (!state.timedEnabled || state.challenge.ended) return;
  state.stars += 1;
  saveScore();
}

function startMode(mode) {
  stopChallengeTimer();
  if (state.timedEnabled) resetChallengeScore();
  state.combo = 0;
  state.started[mode] = true;
  setModeWaiting(mode, false);
  nextQuestion(mode);
  startChallengeTimer();
}

function nextQuestion(mode) {
  if (mode === "pair") nextPair();
  else if (mode === "bridge") nextBridge();
  else if (mode === "minus") nextMinus();
  else nextSimple();
}

function guardNext(mode) {
  clearNextQuestion();
  if (!state.started[mode]) {
    resetModeStart(mode);
    return false;
  }
  if (state.timedEnabled && state.challenge.ended) {
    resetChallengeScore();
    resetModeStart(mode);
    return false;
  }
  state.locked[mode] = false;
  return true;
}

/* ---------- しゅぎょう（たしざん） ---------- */

function nextSimple() {
  if (!guardNext("simple")) return;
  const candidates = simpleProblems.filter((p) => abKey(p) !== state.lastKey.simple);
  const p = pick(candidates.length ? candidates : simpleProblems);
  state.problem.simple = p;
  state.lastKey.simple = abKey(p);
  els.simpleEquation.classList.remove("is-solved");
  els.simpleEquation.textContent = `${p.a} + ${p.b}`;
  M.simple.feedback.className = "feedback";
  M.simple.feedback.textContent = "こたえを えらんでね";
  setNextButton("simple", false);
  renderTenFrame(els.simpleFrame, 0, 0);
  renderChoiceButtons(M.simple.choices, [1, 2, 3, 4, 5, 6, 7, 8, 9], (value, button) => {
    chooseSimple(value, button, p);
  });
  if (state.activeMode === "simple") startChallengeTimer();
}

function chooseSimple(value, button, problem = state.problem.simple) {
  if (state.locked.simple) return;
  const answer = problem.a + problem.b;
  const correct = value === answer;
  button.classList.add(correct ? "is-correct" : "is-wrong");
  if (correct) {
    els.simpleEquation.innerHTML = `<span class="eq-green">${problem.a}</span><span> + </span><span class="eq-red">${problem.b}</span><span> = ${answer}</span>`;
    els.simpleEquation.classList.add("is-solved");
    renderTenFrame(els.simpleFrame, problem.a, problem.b, true);
    onCorrect("simple");
  } else {
    onWrong("simple", null, answer);
  }
}

/* ---------- あわせて10 ---------- */

function nextPair() {
  if (!guardNext("pair")) return;
  state.problem.pair = pickDifferent(pairs, state.lastKey.pair);
  state.lastKey.pair = problemKey(state.problem.pair);
  els.pairNumber.textContent = state.problem.pair.base;
  els.pairNumber.removeAttribute("aria-label");
  els.pairNumber.parentElement.classList.remove("is-solved-equation");
  M.pair.feedback.className = "feedback";
  M.pair.feedback.textContent = "なかよしを えらんでね";
  setNextButton("pair", false);
  els.pairReverseSection.classList.add("is-hidden");
  if (state.blocksEnabled) {
    renderTenFrame(els.pairFrame, state.problem.pair.base, state.problem.pair.friend, false, true);
  } else {
    renderTenFrame(els.pairFrame, 0, 0);
  }
  renderChoiceButtons(M.pair.choices, [1, 2, 3, 4, 5, 6, 7, 8, 9], choosePair);
  if (state.activeMode === "pair") startChallengeTimer();
}

function choosePair(value, button) {
  if (state.locked.pair) return;
  const problem = state.problem.pair;
  const correct = value === problem.friend;
  button.classList.add(correct ? "is-correct" : "is-wrong");

  if (correct) {
    els.pairNumber.innerHTML = `<span class="eq-green">${problem.base}</span><span> + </span><span class="eq-red">${problem.friend}</span><span> = 10</span>`;
    els.pairNumber.setAttribute("aria-label", `${problem.base} + ${problem.friend} = 10`);
    els.pairNumber.parentElement.classList.add("is-solved-equation");
    renderTenFrame(els.pairFrame, problem.base, problem.friend, true);
    if (problem.showReverse) {
      els.pairReverseEquation.innerHTML = `<span class="eq-green">${problem.friend}</span><span> + </span><span class="eq-red">${problem.base}</span><span> = 10</span>`;
      renderTenFrame(els.pairReverseFrame, problem.friend, problem.base, true);
      els.pairReverseSection.classList.remove("is-hidden");
    }
    onCorrect("pair");
  } else {
    onWrong("pair", null, problem.friend);
  }
}

/* ---------- ぼうけん（さくらんぼ） ---------- */

function renderDonorDots(count, moved = 0) {
  els.donorDots.replaceChildren();
  for (let index = 0; index < count; index += 1) {
    const dot = document.createElement("div");
    dot.className = "donor-dot";
    if (index < moved) {
      dot.classList.add("is-moved");
    }
    els.donorDots.append(dot);
  }
}

function renderSplitDots(total, moved) {
  els.donorDots.replaceChildren();
  for (let index = 0; index < total; index += 1) {
    const dot = document.createElement("div");
    dot.className = "donor-dot";
    dot.classList.add(index < moved ? "is-moved-away" : "is-leftover");
    els.donorDots.append(dot);
  }
}

function animateBridgeCompletion(problem, need) {
  const cells = [...els.bridgeFrame.children].slice(problem.big, problem.big + need);
  const dots = [...els.donorDots.children].slice(0, need);
  const dotRects = dots.map((dot) => dot.getBoundingClientRect());
  const cellRects = cells.map((cell) => cell.getBoundingClientRect());

  renderSplitDots(problem.small, need);

  const canAnimate =
    typeof document.createElement("div").animate === "function" &&
    dotRects.every((rect) => rect.width > 0) &&
    cellRects.every((rect) => rect.width > 0);

  if (!canAnimate) {
    renderTenFrame(els.bridgeFrame, problem.big, need, true);
    return;
  }

  cells.forEach((cell, index) => {
    const from = dotRects[index];
    const to = cellRects[index];
    const flyer = document.createElement("div");
    flyer.className = "fly-square";
    flyer.style.left = `${from.left}px`;
    flyer.style.top = `${from.top}px`;
    flyer.style.width = `${from.width}px`;
    flyer.style.height = `${from.height}px`;
    els.flyLayer.append(flyer);

    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const scale = to.width / from.width;

    const animation = flyer.animate(
      [
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 1 }
      ],
      { duration: 520, delay: index * 110, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" }
    );

    animation.onfinish = () => {
      flyer.remove();
      cell.classList.remove("is-needed", "is-hidden-slot");
      cell.classList.add("is-friend-filled", "is-landed");
      cell.style.setProperty("--pop-delay", "0ms");
    };
  });
}

function nextBridge() {
  if (!guardNext("bridge")) return;
  els.flyLayer.replaceChildren();
  state.problem.bridge = pickDifferent(bridgeProblems, state.lastKey.bridge);
  state.lastKey.bridge = problemKey(state.problem.bridge);
  const currentBridge = state.problem.bridge;
  const need = 10 - currentBridge.big;
  els.bridgeEquation.textContent = `${currentBridge.big} + ${currentBridge.small}`;
  els.bridgeLeftLabel.textContent = currentBridge.big;
  els.bridgeRightLabel.textContent = currentBridge.small;
  els.bridgeEquation.classList.remove("is-solved");
  els.bridgeChain.textContent = "10をつくると？";
  els.bridgeChain.classList.remove("is-solved");
  M.bridge.feedback.className = "feedback";
  M.bridge.feedback.textContent = "こたえを えらんでね";
  setNextButton("bridge", false);
  renderTenFrame(els.bridgeFrame, currentBridge.big, need);
  renderDonorDots(currentBridge.small, 0);
  renderChoiceButtons(M.bridge.choices, [11, 12, 13, 14, 15, 16, 17, 18], (value, button) => {
    chooseBridge(value, button, currentBridge);
  });
  if (state.activeMode === "bridge") startChallengeTimer();
}

function chooseBridge(value, button, problem = state.problem.bridge) {
  if (state.locked.bridge) return;

  const need = 10 - problem.big;
  const rest = problem.small - need;
  const answer = problem.big + problem.small;
  const correct = value === answer;
  button.classList.add(correct ? "is-correct" : "is-wrong");

  if (correct) {
    els.bridgeEquation.textContent = `${problem.big} + ${problem.small} = ${answer}`;
    els.bridgeEquation.classList.add("is-solved");
    els.bridgeChain.textContent = "";
    els.bridgeChain.classList.add("is-solved");
    els.bridgeLeftLabel.textContent = 10;
    els.bridgeRightLabel.textContent = rest;
    animateBridgeCompletion(problem, need);
    onCorrect("bridge");
  } else {
    onWrong("bridge", `${problem.big}を10にして、のこりをたすよ`, answer);
  }
}

/* ---------- ひきざん ---------- */

function nextMinus() {
  if (!guardNext("minus")) return;
  const p = pickDifferentAb(minusProblems, state.lastKey.minus);
  state.problem.minus = p;
  state.lastKey.minus = abKey(p);
  els.minusEquation.classList.remove("is-solved");
  els.minusEquation.textContent = `${p.a} − ${p.b}`;
  M.minus.feedback.className = "feedback";
  M.minus.feedback.textContent = "こたえを えらんでね";
  setNextButton("minus", false);
  renderMinusFrame(state.blocksEnabled ? p.a : 0, 0);
  renderChoiceButtons(M.minus.choices, [1, 2, 3, 4, 5, 6, 7, 8, 9], (value, button) => {
    chooseMinus(value, button, p);
  });
  if (state.activeMode === "minus") startChallengeTimer();
}

function chooseMinus(value, button, problem = state.problem.minus) {
  if (state.locked.minus) return;
  const answer = problem.a - problem.b;
  const correct = value === answer;
  button.classList.add(correct ? "is-correct" : "is-wrong");
  if (correct) {
    els.minusEquation.innerHTML = `<span class="eq-green">${problem.a}</span><span> − </span><span class="eq-red">${problem.b}</span><span> = ${answer}</span>`;
    els.minusEquation.classList.add("is-solved");
    renderMinusFrame(problem.a, problem.b);
    onCorrect("minus");
  } else {
    onWrong("minus", "まるを けして かぞえてみよう", answer);
  }
}

/* ---------- モード切替・初期化 ---------- */

function switchMode(mode) {
  clearNextQuestion();
  stopChallengeTimer();
  els.flyLayer.replaceChildren();
  state.activeMode = mode;
  state.combo = 0;
  if (MODES.includes(mode)) {
    resetChallengeScore();
  }
  MODES.forEach(resetModeStart);
  document.querySelectorAll(".mode-tab").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.mode === mode);
  });
  MODES.forEach((m) => {
    M[m].section.classList.toggle("is-hidden", m !== mode);
  });
  qs("#records-mode").classList.toggle("is-hidden", mode !== "records");
  qs("#dex-mode").classList.toggle("is-hidden", mode !== "dex");

  if (mode === "records") renderRecords();
  if (mode === "dex") renderDex();
}

document.querySelectorAll(".mode-tab").forEach((tab) => {
  tab.addEventListener("click", () => switchMode(tab.dataset.mode));
});

MODES.forEach((mode) => {
  qs(`#new-${mode}`)?.addEventListener("click", () => nextQuestion(mode));
  M[mode].next.addEventListener("click", () => nextQuestion(mode));
  M[mode].start.addEventListener("click", () => startMode(mode));
});

els.blockToggle.addEventListener("click", () => {
  setBlockDisplay(!state.blocksEnabled);
});

els.timeToggle.addEventListener("click", () => {
  setTimedMode(!state.timedEnabled);
  if (state.activeMode === "records") {
    renderRecords();
  }
});

qs("#release-pokemon").addEventListener("click", () => {
  if (!window.confirm("ほんとうに ポケモンを ぜんぶ にがす？（累計正解数もリセットされます）")) return;
  state.totalCorrect = 0;
  state.caught = {};
  localStorage.setItem(TOTAL_KEY, "0");
  saveCaught();
  renderDex();
  saveScore();
});

qs("#clear-records").addEventListener("click", () => {
  MODES.forEach((mode) => {
    state.records[mode] = [];
  });
  state.highScore = 0;
  saveRecords();
  renderRecords();
  saveScore();
});

qs("#reset-progress").addEventListener("click", () => {
  clearNextQuestion();
  stopChallengeTimer();
  resetChallengeScore();
  state.combo = 0;
  MODES.forEach(resetModeStart);
  if (state.activeMode === "records") {
    renderRecords();
  }
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js");
}

renderTimeToggle();
renderBlockToggle();
renderRecords();
renderMission();
saveScore();
MODES.forEach(resetModeStart);
