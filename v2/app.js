"use strict";

const CHALLENGE_SECONDS = 60;
const TIMER_TICK_MS = 100;
const MAX_RECORDS = 10;
const STICKER_STEP = 10;

const MODES = ["pair", "tenplus", "simple", "bridge", "minus", "ice"];
// 全ゲージ（ポケモン・フレンダ・ミッション）にカウントするモード。
// あわせて10と10+Xはミッションのみ、1日各10問（PRACTICE_MISSION_CAP）までカウントする
const GAUGE_MODES = ["simple", "bridge", "minus", "ice"];

const RECORDS_KEYS = {
  simple: "riku10v2-records-simple",
  pair: "riku10v2-records-pair",
  tenplus: "riku10v2-records-tenplus",
  bridge: "riku10v2-records-bridge",
  minus: "riku10v2-records-minus",
  ice: "riku10v2-records-ice"
};
const TOTAL_KEY = "riku10v2-total-correct";
const CATCH_PROGRESS_KEY = "riku10v2-catch-progress";
const TIMED_KEY = "riku10v2-timed-enabled";
const CAUGHT_KEY = "riku10v2-caught";
const DAILY_KEY = "riku10v2-daily";
const STATS_KEY = "riku10v2-stats";
const DAYLOG_KEY = "riku10v2-daylog";
const BACKUP_PREFIX = "riku10v2-";
const COINS_KEY = "riku10v2-coins";
const COIN_PROGRESS_KEY = "riku10v2-coin-progress";
const COIN_VALUE = 100;
const STREAK_KEY = "riku10v2-mission-streak";
const STREAK_BONUS_DAYS = 7;
const SETTINGS_KEY = "riku10v2-settings";
// あわせて10・10+X がミッションにカウントできる1日あたりの上限
const PRACTICE_MISSION_CAP = 10;

// ゲージのクリア数（とうけいタブの設定で変更できる）
function loadSettings() {
  const defaults = { catchStep: STICKER_STEP, missionGoal: 30, coinStep: 75 };
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const merged = { ...defaults };
      ["catchStep", "missionGoal", "coinStep"].forEach((key) => {
        const value = Number(parsed[key]);
        if (Number.isFinite(value) && value >= 1 && value <= 999) merged[key] = Math.round(value);
      });
      return merged;
    }
  } catch {}
  return { ...defaults };
}

const SETTINGS = loadSettings();

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS));
}
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

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function loadStreak() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STREAK_KEY) || "null");
    if (parsed && typeof parsed.count === "number" && typeof parsed.last === "string") return parsed;
  } catch {}
  return { count: 0, last: "" };
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

// つぎのポケモンまでの進捗（0〜9）。累計正解数とは独立して管理する。
// キーが無い場合は旧仕様（累計の10問区切り）から引き継ぐ
function loadCatchProgress() {
  const raw = localStorage.getItem(CATCH_PROGRESS_KEY);
  if (raw !== null) {
    return Math.min(SETTINGS.catchStep - 1, Math.max(0, Number(raw) || 0));
  }
  const total = Number(localStorage.getItem(TOTAL_KEY) || "0") || 0;
  return total % STICKER_STEP;
}

function loadDaily() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DAILY_KEY) || "null");
    if (parsed && parsed.date === todayStr()) return parsed;
  } catch {}
  return { date: todayStr(), count: 0, done: false };
}

function loadStats() {
  let parsed = null;
  try {
    parsed = JSON.parse(localStorage.getItem(STATS_KEY) || "null");
  } catch {}
  const stats = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  MODES.forEach((mode) => {
    if (!stats[mode] || typeof stats[mode] !== "object") stats[mode] = {};
  });
  return stats;
}

function loadDayLog() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DAYLOG_KEY) || "null");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {}
  return {};
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

function makeTenPlusProblems() {
  const problems = [];
  for (let b = 1; b <= 9; b += 1) {
    problems.push({ a: 10, b });
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

// くり下がりのひきざん（13−8 など、一の位だけでは引けないもの）
function makeIceProblems() {
  const problems = [];
  for (let a = 11; a <= 18; a += 1) {
    for (let b = a - 10 + 1; b <= 9; b += 1) {
      problems.push({ a, b });
    }
  }
  return problems;
}

const bridgeProblems = makeBridgeProblems();
const simpleProblems = makeSimpleProblems();
const tenPlusProblems = makeTenPlusProblems();
const minusProblems = makeMinusProblems();
const iceProblems = makeIceProblems();

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
  problem: { simple: null, pair: null, tenplus: null, bridge: null, minus: null, ice: null },
  lastKey: { simple: "", pair: "", tenplus: "", bridge: "", minus: "", ice: "" },
  questionAt: { simple: 0, pair: 0, tenplus: 0, bridge: 0, minus: 0, ice: 0 },
  stats: loadStats(),
  dayLog: loadDayLog(),
  started: { simple: false, pair: false, tenplus: false, bridge: false, minus: false, ice: false },
  locked: { simple: true, pair: true, tenplus: true, bridge: true, minus: true, ice: true },
  records: {
    simple: loadModeRecords(RECORDS_KEYS.simple),
    pair: loadModeRecords(RECORDS_KEYS.pair),
    tenplus: loadModeRecords(RECORDS_KEYS.tenplus),
    bridge: loadModeRecords(RECORDS_KEYS.bridge),
    minus: loadModeRecords(RECORDS_KEYS.minus),
    ice: loadModeRecords(RECORDS_KEYS.ice)
  },
  combo: 0,
  stars: 0,
  totalCorrect: Number(localStorage.getItem(TOTAL_KEY) || "0") || 0,
  catchProgress: loadCatchProgress(),
  activeMode: "pair",
  caught: loadCaught(),
  daily: loadDaily(),
  revealTimeout: { ice: null, minus: null },
  coins: Math.max(0, Number(localStorage.getItem(COINS_KEY) || "0") || 0),
  coinProgress: Math.min(SETTINGS.coinStep - 1, Math.max(0, Number(localStorage.getItem(COIN_PROGRESS_KEY) || "0") || 0)),
  coinJustEarned: false,
  streak: loadStreak(),
  streakBonusJust: false,
  nextQuestionTimeoutId: null,
  bridgeRevealTimeoutId: null,
  timedEnabled: localStorage.getItem(TIMED_KEY) === "true",
  blocksEnabled: localStorage.getItem("riku10v2-blocks-enabled") === "true",
  challenge: { remainingMs: CHALLENGE_SECONDS * 1000, intervalId: null, ended: false }
};

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
  savings: qs("#savings"),
  coinFill: qs("#coin-fill"),
  coinText: qs("#coin-text"),
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
  tenplusEquation: qs("#tenplus-equation"),
  tenplusFrame: qs("#tenplus-frame"),
  tenplusDots: qs("#tenplus-dots"),
  tenplusRightLabel: qs("#tenplus-right-label"),
  iceEquation: qs("#ice-equation"),
  iceFrame: qs("#ice-frame"),
  iceDots: qs("#ice-dots"),
  iceLeftLabel: qs("#ice-left-label"),
  iceRightLabel: qs("#ice-right-label"),
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
  missionText: qs("#mission-text")
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

/* ---------- 成績記録・にがて優先出題 ---------- */

function statKeyFn(mode) {
  return mode === "pair" || mode === "bridge" ? problemKey : abKey;
}

function saveStats() {
  localStorage.setItem(STATS_KEY, JSON.stringify(state.stats));
}

function saveDayLog() {
  const keys = Object.keys(state.dayLog);
  if (keys.length > 190) {
    keys
      .sort((a, b) => new Date(a) - new Date(b))
      .slice(0, keys.length - 190)
      .forEach((key) => {
        delete state.dayLog[key];
      });
  }
  localStorage.setItem(DAYLOG_KEY, JSON.stringify(state.dayLog));
}

function recordAnswer(mode, problem, correct) {
  const key = statKeyFn(mode)(problem);
  const elapsed = Date.now() - (state.questionAt[mode] || 0);
  const stat = state.stats[mode][key] || { c: 0, w: 0, t: 0 };
  if (correct) stat.c += 1;
  else stat.w += 1;
  if (elapsed > 300 && elapsed < 60000) {
    stat.t = stat.t ? Math.round(stat.t * 0.7 + elapsed * 0.3) : elapsed;
  }
  // 昔の成績を引きずらないよう、たまったら半減して直近を重視
  if (stat.c + stat.w > 30) {
    stat.c = Math.round(stat.c / 2);
    stat.w = Math.round(stat.w / 2);
  }
  state.stats[mode][key] = stat;
  saveStats();

  const day = state.dayLog[todayStr()] || { c: 0, w: 0 };
  if (correct) day.c += 1;
  else day.w += 1;
  state.dayLog[todayStr()] = day;
  saveDayLog();
}

function problemWeight(stat) {
  if (!stat || stat.c + stat.w === 0) return 2; // まだ出していない問題は多めに
  const wrongRate = stat.w / (stat.c + stat.w);
  const slow = stat.t > 6000 ? 1.5 : stat.t > 3500 ? 0.7 : 0;
  return 1 + wrongRate * 4 + slow;
}

function pickWeighted(mode, items, lastKey) {
  const keyFn = statKeyFn(mode);
  const filtered = items.filter((item) => keyFn(item) !== lastKey);
  const pool = filtered.length ? filtered : items;
  const weights = pool.map((item) => problemWeight(state.stats[mode][keyFn(item)]));
  let r = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let i = 0; i < pool.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
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
  saveRecords();
  renderRecords();
}

/* ---------- フレンダゲージ（ちょきん） ---------- */

function saveCoins() {
  localStorage.setItem(COINS_KEY, String(state.coins));
  localStorage.setItem(COIN_PROGRESS_KEY, String(state.coinProgress));
}

function renderCoinGauge() {
  els.savings.textContent = `${state.coins * COIN_VALUE}円`;
  const percent = Math.min(100, (state.coinProgress / SETTINGS.coinStep) * 100);
  els.coinFill.style.width = `${percent}%`;
  els.coinText.textContent = `あと${SETTINGS.coinStep - state.coinProgress}もんで100円`;
}

// ミッションクリアの連続日数。7日ごとにボーナス100円
function registerMissionClear() {
  if (state.streak.last === todayStr()) return;
  state.streak.count = state.streak.last === yesterdayStr() ? state.streak.count + 1 : 1;
  state.streak.last = todayStr();
  localStorage.setItem(STREAK_KEY, JSON.stringify(state.streak));
  // カレンダーに⭐を残す
  const day = state.dayLog[todayStr()] || { c: 0, w: 0 };
  day.m = true;
  state.dayLog[todayStr()] = day;
  saveDayLog();
  if (state.streak.count % STREAK_BONUS_DAYS === 0) {
    state.coins += 1;
    state.streakBonusJust = true;
    saveCoins();
    renderCoinGauge();
    burstConfetti(60);
  }
}

function registerCoinProgress() {
  state.coinProgress += 1;
  if (state.coinProgress >= SETTINGS.coinStep) {
    state.coinProgress = 0;
    state.coins += 1;
    state.coinJustEarned = true;
    burstConfetti(48);
  }
  saveCoins();
  renderCoinGauge();
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
  const remain = SETTINGS.catchStep - state.catchProgress;
  const catchPercent = (state.catchProgress / SETTINGS.catchStep) * 100;
  els.catchFill.style.width = `${catchPercent}%`;
  els.catchText.textContent = `あと${remain}もん`;

  const percent = Math.min(100, (state.daily.count / SETTINGS.missionGoal) * 100);
  els.missionFill.style.width = `${percent}%`;
  els.missionFill.classList.toggle("is-done", state.daily.done);
  els.missionText.textContent = state.daily.done
    ? `クリア！🎉${state.streak.last === todayStr() && state.streak.count > 1 ? ` ${state.streak.count}日れんぞく` : ""}`
    : `あと ${SETTINGS.missionGoal - state.daily.count}もん`;
}

function renderDex() {
  els.dexCount.textContent = `${speciesCaught()}しゅるい / ${STICKERS.length}`;

  const remain = SETTINGS.catchStep - state.catchProgress;
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

function saveCatchProgress() {
  localStorage.setItem(CATCH_PROGRESS_KEY, String(state.catchProgress));
}

function registerWrong() {
  // ペナルティは「つぎのポケモンまで」の進捗のみ。0未満にはしない
  state.catchProgress = Math.max(0, state.catchProgress - 1);
  saveCatchProgress();
  rolloverDaily();
  state.daily.count = Math.max(0, state.daily.count - 1);
  saveDaily();
  renderMission();
}

function checkMissionGoal() {
  if (!state.daily.done && state.daily.count >= SETTINGS.missionGoal) {
    state.daily.done = true;
    saveDaily();
    registerMissionClear();
    catchPokemon(true);
  }
}

function registerCorrect() {
  state.totalCorrect += 1;
  localStorage.setItem(TOTAL_KEY, String(state.totalCorrect));
  rolloverDaily();
  state.daily.count += 1;
  saveDaily();
  registerCoinProgress();
  state.catchProgress += 1;
  if (state.catchProgress >= SETTINGS.catchStep) {
    state.catchProgress = 0; // ゲットしたら0から数え直し。間違えても戻らない
    catchPokemon(false);
  }
  saveCatchProgress();
  checkMissionGoal();
  renderMission();
}

// あわせて10・10+X の正解は、ミッションだけに1日各10問までカウントする
function registerPracticeCorrect(mode) {
  rolloverDaily();
  const usedKey = mode === "pair" ? "pairUsed" : "tenplusUsed";
  const used = state.daily[usedKey] || 0;
  if (used >= PRACTICE_MISSION_CAP) return;
  state.daily[usedKey] = used + 1;
  state.daily.count += 1;
  saveDaily();
  checkMissionGoal();
  renderMission();
}

/* ---------- バックアップ ---------- */

function exportBackup() {
  const data = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith(BACKUP_PREFIX)) data[key] = localStorage.getItem(key);
  }
  const payload = { app: "riku-no-bouken", version: 2, savedAt: new Date().toISOString(), data };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `riku-no-bouken-${todayStr()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importBackup(file) {
  file.text().then((text) => {
    let payload = null;
    try {
      payload = JSON.parse(text);
    } catch {}
    const data = payload && payload.app === "riku-no-bouken" ? payload.data : null;
    if (!data || typeof data !== "object") {
      window.alert("このファイルは りくのぼうけんの ほぞんデータじゃないみたい");
      return;
    }
    if (!window.confirm("いまのデータを ほぞんデータで うわがきするよ。いい？")) return;
    Object.entries(data).forEach(([key, value]) => {
      if (key.startsWith(BACKUP_PREFIX) && typeof value === "string") {
        localStorage.setItem(key, value);
      }
    });
    location.reload();
  });
}

/* ---------- せいせき（おうちの人向け） ---------- */

const MODE_LABELS = { simple: "しゅぎょう", pair: "あわせて10", tenplus: "10+X", bridge: "ぼうけん", minus: "ひきざんジム", ice: "こおりのダンジョン" };

function formatProblemLabel(mode, key) {
  if (mode === "minus" || mode === "ice") return key.replace("-", " − ");
  if (mode === "simple" || mode === "tenplus") return key.replace("-", " + ");
  return key.replace("+", " + ");
}

function renderStatsSummary() {
  const today = state.dayLog[todayStr()] || { c: 0, w: 0 };
  const attempts = today.c + today.w;
  const summary = qs("#stats-summary");
  if (!attempts) {
    summary.textContent = "きょうは まだ問題を解いていません。";
    return;
  }
  const rate = Math.round((today.c / attempts) * 100);
  const streakAlive = state.streak.last === todayStr() || state.streak.last === yesterdayStr() ? state.streak.count : 0;
  summary.textContent = `きょう: ${today.c}問正解・${today.w}問ミス（正答率 ${rate}%）／ミッション連続クリア ${streakAlive}日（7日ごとにボーナス100円）`;
}

function renderStatsChart() {
  const chart = qs("#stats-chart");
  chart.replaceChildren();
  const days = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    const log = state.dayLog[key] || { c: 0, w: 0 };
    days.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, count: log.c || 0, wrong: log.w || 0, isToday: i === 0 });
  }
  const max = Math.max(...days.map((day) => day.count), 5);
  const best = Math.max(...days.map((day) => day.count));
  days.forEach((day, index) => {
    const col = document.createElement("div");
    col.className = "stats-col";
    col.title = `${day.label}: ${day.count}問正解 / ${day.wrong}問ミス`;

    const value = document.createElement("span");
    value.className = "stats-value";
    // ラベルは今日とベスト日だけ（他はホバーで見る）
    if (day.count > 0 && (day.isToday || day.count === best)) value.textContent = day.count;

    const track = document.createElement("div");
    track.className = "stats-bar-track";
    const bar = document.createElement("div");
    bar.className = "stats-bar";
    if (day.isToday) bar.classList.add("is-today");
    bar.style.height = day.count ? `${Math.max(4, (day.count / max) * 100)}%` : "0";
    track.append(bar);

    const label = document.createElement("span");
    label.className = "stats-day";
    if (index % 2 === 1 || day.isToday) label.textContent = day.label;

    col.append(value, track, label);
    chart.append(col);
  });
}

function renderStatsWeak() {
  const wrap = qs("#stats-weak");
  wrap.replaceChildren();
  MODES.forEach((mode) => {
    const column = document.createElement("div");
    column.className = "records-col";
    const title = document.createElement("h3");
    title.className = "records-col-title";
    title.textContent = MODE_LABELS[mode];
    column.append(title);

    const weakest = Object.entries(state.stats[mode])
      .map(([key, stat]) => ({ key, ...stat, tries: stat.c + stat.w, weight: problemWeight(stat) }))
      .filter((stat) => stat.tries >= 2 && (stat.w > 0 || stat.t > 6000))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5);

    if (!weakest.length) {
      const empty = document.createElement("p");
      empty.className = "records-empty";
      empty.textContent = "にがては ないみたい";
      column.append(empty);
    } else {
      const list = document.createElement("ol");
      list.className = "records-list";
      weakest.forEach((stat) => {
        const row = document.createElement("li");
        row.className = "record-row";
        const label = document.createElement("strong");
        label.className = "record-score";
        label.textContent = formatProblemLabel(mode, stat.key);
        const detail = document.createElement("span");
        detail.className = "record-date";
        const accuracy = Math.round((stat.c / stat.tries) * 100);
        detail.textContent = `正答${accuracy}%${stat.t ? `・約${Math.round(stat.t / 1000)}秒` : ""}`;
        row.append(label, detail);
        list.append(row);
      });
      column.append(list);
    }
    wrap.append(column);
  });
}

function renderStatsPanel() {
  renderStatsSummary();
  renderStatsChart();
  renderStatsWeak();
  qs("#set-catch").value = SETTINGS.catchStep;
  qs("#set-mission").value = SETTINGS.missionGoal;
  qs("#set-coin").value = SETTINGS.coinStep;
}

function bindSettingInput(selector, key, onApply) {
  const input = qs(selector);
  input.addEventListener("change", () => {
    const value = Math.round(Number(input.value));
    if (!Number.isFinite(value) || value < 1 || value > 999) {
      input.value = SETTINGS[key];
      return;
    }
    SETTINGS[key] = value;
    input.value = value;
    saveSettings();
    onApply();
  });
}

bindSettingInput("#set-catch", "catchStep", () => {
  state.catchProgress = Math.min(state.catchProgress, SETTINGS.catchStep - 1);
  saveCatchProgress();
  renderMission();
});

bindSettingInput("#set-mission", "missionGoal", () => {
  renderMission();
});

bindSettingInput("#set-coin", "coinStep", () => {
  state.coinProgress = Math.min(state.coinProgress, SETTINGS.coinStep - 1);
  saveCoins();
  renderCoinGauge();
});

/* ---------- カレンダー ---------- */

let calendarOffset = 0; // 0 = 今月、-1 = 先月…

function renderCalendar() {
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + calendarOffset);
  const year = base.getFullYear();
  const month = base.getMonth();
  qs("#cal-title").textContent = `${year}ねん ${month + 1}がつ`;
  qs("#cal-next").disabled = calendarOffset >= 0;

  const grid = qs("#cal-grid");
  grid.replaceChildren();
  ["にち", "げつ", "か", "すい", "もく", "きん", "ど"].forEach((label) => {
    const head = document.createElement("div");
    head.className = "cal-head";
    head.textContent = label;
    grid.append(head);
  });

  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  for (let i = 0; i < firstDay; i += 1) {
    const cell = document.createElement("div");
    cell.className = "cal-cell is-empty";
    grid.append(cell);
  }
  const today = todayStr();
  for (let d = 1; d <= lastDate; d += 1) {
    const key = `${year}-${month + 1}-${d}`;
    const log = state.dayLog[key];
    const cleared = Boolean(log && log.m);
    const played = Boolean(log && (log.c || 0) + (log.w || 0) > 0);
    const cell = document.createElement("div");
    cell.className = "cal-cell";
    if (cleared) cell.classList.add("is-cleared");
    if (key === today) cell.classList.add("is-today");
    const num = document.createElement("span");
    num.textContent = d;
    const stamp = document.createElement("span");
    stamp.className = "cal-stamp";
    if (cleared) stamp.classList.add("cal-ball");
    else stamp.textContent = played ? "🟢" : "";
    if (played) cell.title = `${log.c || 0}問正解 / ${log.w || 0}問ミス`;
    cell.append(num, stamp);
    grid.append(cell);
  }
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
  M[mode].section.classList.add("is-answer-shown");
  stopChallengeTimer();
  state.combo += 1;
  countSolvedQuestion();
  if (!state.challenge.ended) {
    if (GAUGE_MODES.includes(mode)) registerCorrect();
    else registerPracticeCorrect(mode);
  }
  const feedback = M[mode].feedback;
  feedback.className = "feedback is-good";
  feedback.textContent = praiseText();
  if (state.coinJustEarned) {
    state.coinJustEarned = false;
    feedback.textContent = "💰 100円 ゲット！ ちょきんが ふえたよ！";
  }
  if (state.streakBonusJust) {
    state.streakBonusJust = false;
    feedback.textContent = `🔥${state.streak.count}日れんぞくクリア！ ボーナス100円 ゲット！`;
  }
  setNextButton(mode, true);
  burstConfetti(Math.min(14 + Math.floor(state.combo / 5) * 10, 54));
  playTone("good", state.combo);
}

function onWrong(mode, _hint, correctValue) {
  state.combo = 0;
  state.locked[mode] = true;
  M[mode].section.classList.add("is-answer-shown");
  stopChallengeTimer();
  if (!state.challenge.ended && GAUGE_MODES.includes(mode)) {
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

function renderMinusFrame(container, total, removed) {
  container.replaceChildren();
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
    container.append(cell);
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
  M[mode].section.classList.remove("is-answer-shown");
  setNextButton(mode, false);
}

function clearNextQuestion() {
  if (state.nextQuestionTimeoutId) {
    clearTimeout(state.nextQuestionTimeoutId);
    state.nextQuestionTimeoutId = null;
  }
  clearBridgeReveal();
  clearRemovalReveal("ice");
  clearRemovalReveal("minus");
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
  document.body.classList.toggle("no-blocks", !state.blocksEnabled);
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
  M[mode].section.classList.remove("is-answer-shown");
  state.questionAt[mode] = Date.now();
  if (mode === "pair") nextPair();
  else if (mode === "tenplus") nextTenPlus();
  else if (mode === "bridge") nextBridge();
  else if (mode === "minus") nextMinus();
  else if (mode === "ice") nextIce();
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
  const p = pickWeighted("simple", simpleProblems, state.lastKey.simple);
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
  recordAnswer("simple", problem, correct);
  button.classList.add(correct ? "is-correct" : "is-wrong");
  if (correct) {
    els.simpleEquation.innerHTML = `<span class="eq-green">${problem.a}</span><span> + </span><span class="eq-red">${problem.b}</span><span> = ${answer}</span>`;
    els.simpleEquation.classList.add("is-solved");
    renderTenFrame(els.simpleFrame, problem.a, problem.b, true);
    onCorrect("simple");
  } else {
    els.simpleEquation.innerHTML = `<span class="eq-green">${problem.a}</span><span> + </span><span class="eq-red">${problem.b}</span><span> = ${answer}</span>`;
    els.simpleEquation.classList.add("is-solved");
    renderTenFrame(els.simpleFrame, problem.a, problem.b, true);
    onWrong("simple", null, answer);
  }
}

/* ---------- あわせて10 ---------- */

function nextPair() {
  if (!guardNext("pair")) return;
  state.problem.pair = pickWeighted("pair", pairs, state.lastKey.pair);
  state.lastKey.pair = problemKey(state.problem.pair);
  els.pairNumber.textContent = state.problem.pair.base;
  els.pairNumber.removeAttribute("aria-label");
  els.pairNumber.parentElement.classList.remove("is-solved-equation");
  M.pair.feedback.className = "feedback";
  M.pair.feedback.textContent = "なかよしを えらんでね";
  setNextButton("pair", false);
  els.pairReverseSection.classList.add("is-hidden");
  renderTenFrame(els.pairFrame, 0, 0);
  renderChoiceButtons(M.pair.choices, [1, 2, 3, 4, 5, 6, 7, 8, 9], choosePair);
  if (state.activeMode === "pair") startChallengeTimer();
}

function choosePair(value, button) {
  if (state.locked.pair) return;
  const problem = state.problem.pair;
  const correct = value === problem.friend;
  recordAnswer("pair", problem, correct);
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
    els.pairNumber.innerHTML = `<span class="eq-green">${problem.base}</span><span> + </span><span class="eq-red">${problem.friend}</span><span> = 10</span>`;
    els.pairNumber.parentElement.classList.add("is-solved-equation");
    renderTenFrame(els.pairFrame, problem.base, problem.friend, true);
    onWrong("pair", null, problem.friend);
  }
}

/* ---------- 10+X ---------- */

function renderPlainDots(container, count) {
  container.replaceChildren();
  for (let index = 0; index < count; index += 1) {
    const dot = document.createElement("div");
    dot.className = "donor-dot";
    container.append(dot);
  }
}

function nextTenPlus() {
  if (!guardNext("tenplus")) return;
  const p = pickWeighted("tenplus", tenPlusProblems, state.lastKey.tenplus);
  state.problem.tenplus = p;
  state.lastKey.tenplus = abKey(p);
  els.tenplusEquation.classList.remove("is-solved");
  els.tenplusEquation.textContent = `10 + ${p.b}`;
  els.tenplusRightLabel.textContent = p.b;
  M.tenplus.feedback.className = "feedback";
  M.tenplus.feedback.textContent = "こたえを えらんでね";
  setNextButton("tenplus", false);
  renderTenFrame(els.tenplusFrame, 10, 0);
  renderPlainDots(els.tenplusDots, p.b);
  renderChoiceButtons(M.tenplus.choices, [11, 12, 13, 14, 15, 16, 17, 18, 19], (value, button) => {
    chooseTenPlus(value, button, p);
  });
  if (state.activeMode === "tenplus") startChallengeTimer();
}

function chooseTenPlus(value, button, problem = state.problem.tenplus) {
  if (state.locked.tenplus) return;
  const answer = 10 + problem.b;
  const correct = value === answer;
  recordAnswer("tenplus", problem, correct);
  button.classList.add(correct ? "is-correct" : "is-wrong");
  els.tenplusEquation.innerHTML = `<span class="eq-green">10</span><span> + </span><span class="eq-red">${problem.b}</span><span> = ${answer}</span>`;
  els.tenplusEquation.classList.add("is-solved");
  if (correct) {
    onCorrect("tenplus");
  } else {
    onWrong("tenplus", null, answer);
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

function revealBridgeAnswer(problem, need, rest) {
  els.bridgeLeftLabel.textContent = 10;
  els.bridgeRightLabel.textContent = rest;
  animateBridgeCompletion(problem, need);
}

function scheduleBridgeReveal(problem, need, rest) {
  if (state.blocksEnabled) {
    revealBridgeAnswer(problem, need, rest);
    return;
  }
  // ブロックなしでは、まず「ブロックあり」と同じ絵を見せてから10を埋める動きを見せる
  state.bridgeRevealTimeoutId = setTimeout(() => {
    state.bridgeRevealTimeoutId = null;
    if (state.problem.bridge === problem) revealBridgeAnswer(problem, need, rest);
  }, 1500);
}

function clearBridgeReveal() {
  if (state.bridgeRevealTimeoutId) {
    clearTimeout(state.bridgeRevealTimeoutId);
    state.bridgeRevealTimeoutId = null;
  }
}

function nextBridge() {
  if (!guardNext("bridge")) return;
  clearBridgeReveal();
  els.flyLayer.replaceChildren();
  state.problem.bridge = pickWeighted("bridge", bridgeProblems, state.lastKey.bridge);
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
  recordAnswer("bridge", problem, correct);
  button.classList.add(correct ? "is-correct" : "is-wrong");

  if (correct) {
    els.bridgeEquation.textContent = `${problem.big} + ${problem.small} = ${answer}`;
    els.bridgeEquation.classList.add("is-solved");
    els.bridgeChain.textContent = "";
    els.bridgeChain.classList.add("is-solved");
    onCorrect("bridge");
    scheduleBridgeReveal(problem, need, rest);
  } else {
    els.bridgeEquation.textContent = `${problem.big} + ${problem.small} = ${answer}`;
    els.bridgeEquation.classList.add("is-solved");
    onWrong("bridge", `${problem.big}を10にして、のこりをたすよ`, answer);
    scheduleBridgeReveal(problem, need, rest);
  }
}

/* ---------- ひきざん ---------- */

function nextMinus() {
  if (!guardNext("minus")) return;
  clearRemovalReveal("minus");
  const p = pickWeighted("minus", minusProblems, state.lastKey.minus);
  state.problem.minus = p;
  state.lastKey.minus = abKey(p);
  els.minusEquation.classList.remove("is-solved");
  els.minusEquation.textContent = `${p.a} − ${p.b}`;
  M.minus.feedback.className = "feedback";
  M.minus.feedback.textContent = "こたえを えらんでね";
  setNextButton("minus", false);
  renderMinusFrame(els.minusFrame, p.a, 0);
  renderChoiceButtons(M.minus.choices, [1, 2, 3, 4, 5, 6, 7, 8, 9], (value, button) => {
    chooseMinus(value, button, p);
  });
  if (state.activeMode === "minus") startChallengeTimer();
}

function chooseMinus(value, button, problem = state.problem.minus) {
  if (state.locked.minus) return;
  const answer = problem.a - problem.b;
  const correct = value === answer;
  recordAnswer("minus", problem, correct);
  button.classList.add(correct ? "is-correct" : "is-wrong");
  els.minusEquation.innerHTML = `<span class="eq-green">${problem.a}</span><span> − </span><span class="eq-red">${problem.b}</span><span> = ${answer}</span>`;
  els.minusEquation.classList.add("is-solved");
  if (correct) {
    onCorrect("minus");
  } else {
    onWrong("minus", "まるを けして かぞえてみよう", answer);
  }
  scheduleRemovalReveal("minus", problem, () => minusRemovalTargets(problem));
}

/* ---------- こおりのダンジョン（くり下がり） ---------- */

function nextIce() {
  if (!guardNext("ice")) return;
  clearRemovalReveal("ice");
  els.flyLayer.replaceChildren();
  const p = pickWeighted("ice", iceProblems, state.lastKey.ice);
  state.problem.ice = p;
  state.lastKey.ice = abKey(p);
  const ones = p.a - 10;
  els.iceEquation.classList.remove("is-solved");
  els.iceEquation.textContent = `${p.a} − ${p.b}`;
  els.iceLeftLabel.textContent = 10;
  els.iceRightLabel.textContent = ones;
  M.ice.feedback.className = "feedback";
  M.ice.feedback.textContent = "こたえを えらんでね";
  setNextButton("ice", false);
  renderMinusFrame(els.iceFrame, 10, 0);
  renderPlainDots(els.iceDots, ones);
  renderChoiceButtons(M.ice.choices, [1, 2, 3, 4, 5, 6, 7, 8, 9], (value, button) => {
    chooseIce(value, button, p);
  });
  if (state.activeMode === "ice") startChallengeTimer();
}

// 右から1つずつ✕にして数える共通演出（✕は消さずに残す）
function startRemovalSteps(mode, problem, targets) {
  let count = 0;
  const step = () => {
    state.revealTimeout[mode] = null;
    if (state.problem[mode] !== problem) return;
    if (count >= targets.length) return;
    const target = targets[count];
    if (target) {
      target.classList.add("is-removed");
      target.dataset.count = count + 1;
      target.style.setProperty("--pop-delay", "0ms");
    }
    count += 1;
    state.revealTimeout[mode] = setTimeout(step, 450);
  };
  state.revealTimeout[mode] = setTimeout(step, 500);
}

function scheduleRemovalReveal(mode, problem, buildTargets) {
  if (state.blocksEnabled) {
    startRemovalSteps(mode, problem, buildTargets());
    return;
  }
  // ブロックなしでは、まず引く前の絵を見せてから消しはじめる
  state.revealTimeout[mode] = setTimeout(() => {
    state.revealTimeout[mode] = null;
    if (state.problem[mode] === problem) startRemovalSteps(mode, problem, buildTargets());
  }, 1500);
}

function clearRemovalReveal(mode) {
  if (state.revealTimeout[mode]) {
    clearTimeout(state.revealTimeout[mode]);
    state.revealTimeout[mode] = null;
  }
}

// こおり（減々法）: まず右のバラを右から✕にし、たりない分は10のかたまりを右から✕にする
function iceRemovalTargets(problem) {
  const ones = problem.a - 10;
  const dots = [...els.iceDots.children].slice(0, ones).reverse();
  const cells = [...els.iceFrame.children].slice(0, 10).reverse();
  return dots.concat(cells).slice(0, problem.b);
}

// ひきざんジム: ブロックを右から✕にする
function minusRemovalTargets(problem) {
  return [...els.minusFrame.children].slice(0, problem.a).reverse().slice(0, problem.b);
}

function chooseIce(value, button, problem = state.problem.ice) {
  if (state.locked.ice) return;
  const answer = problem.a - problem.b;
  const correct = value === answer;
  recordAnswer("ice", problem, correct);
  button.classList.add(correct ? "is-correct" : "is-wrong");
  els.iceEquation.textContent = `${problem.a} − ${problem.b} = ${answer}`;
  els.iceEquation.classList.add("is-solved");
  if (correct) {
    onCorrect("ice");
  } else {
    onWrong("ice", "バラからとって、のこりは10からとるよ", answer);
  }
  scheduleRemovalReveal("ice", problem, () => iceRemovalTargets(problem));
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
  qs("#stats-panel").classList.toggle("is-hidden", mode !== "stats");
  qs("#calendar-mode").classList.toggle("is-hidden", mode !== "calendar");

  if (mode === "records") renderRecords();
  if (mode === "dex") renderDex();
  if (mode === "stats") renderStatsPanel();
  if (mode === "calendar") {
    calendarOffset = 0;
    renderCalendar();
  }
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
  state.catchProgress = 0;
  state.caught = {};
  localStorage.setItem(TOTAL_KEY, "0");
  saveCatchProgress();
  saveCaught();
  renderDex();
});

qs("#clear-records").addEventListener("click", () => {
  MODES.forEach((mode) => {
    state.records[mode] = [];
  });
  saveRecords();
  renderRecords();
});

qs("#cal-prev").addEventListener("click", () => {
  calendarOffset -= 1;
  renderCalendar();
});

qs("#cal-next").addEventListener("click", () => {
  if (calendarOffset >= 0) return;
  calendarOffset += 1;
  renderCalendar();
});

qs("#coin-reset").addEventListener("click", () => {
  if (!window.confirm("ちょきんを 0円に もどす？（お金をわたしたら リセットしてね）")) return;
  state.coins = 0;
  state.coinProgress = 0;
  state.coinJustEarned = false;
  saveCoins();
  renderCoinGauge();
});

qs("#backup-export").addEventListener("click", exportBackup);

const backupImportInput = qs("#backup-import-file");
qs("#backup-import").addEventListener("click", () => backupImportInput.click());
backupImportInput.addEventListener("change", () => {
  const file = backupImportInput.files && backupImportInput.files[0];
  if (file) importBackup(file);
  backupImportInput.value = "";
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
renderCoinGauge();
MODES.forEach(resetModeStart);
