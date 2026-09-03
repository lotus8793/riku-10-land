"use strict";

const CHALLENGE_SECONDS = 60;
const TIMER_TICK_MS = 100;
const MAX_RECORDS = 10;
const STICKER_STEP = 10;

const MODES = ["pair", "tenplus", "flash", "simple", "mogi", "bridge", "minus", "ice"];
// どのタブがポケモンゲット／コインゲージに進むかは、設定タブでタブごとに切り替えられる
// （初期値は GAUGE_MODE_DEFAULTS）。ミッションの必要問題数も同様（MISSION_CAP_DEFAULTS）
const GAUGE_MODE_DEFAULTS = ["simple", "bridge", "minus", "ice"];

const RECORDS_KEYS = {
  simple: "riku10v2-records-simple",
  pair: "riku10v2-records-pair",
  tenplus: "riku10v2-records-tenplus",
  flash: "riku10v2-records-flash",
  mogi: "riku10v2-records-mogi",
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
const SLOW_ANSWER_MS = 20000;
const BACKUP_PREFIX = "riku10v2-";
const COINS_KEY = "riku10v2-coins"; // 旧形式（100円が何枚か）。いまは移行用にだけ読む
const WALLET_KEY = "riku10v2-wallet-yen";
const LEGACY_FINANCE_KEY = "riku10v2-finance"; // 廃止した「とうし」の残高を返金するためにだけ読む
const LEGACY_FINANCE_REFUND_KEY = "riku10v2-finance-refunded";
const GAME_TIME_KEY = "riku10v2-game-time-minutes";
const COIN_PROGRESS_KEY = "riku10v2-coin-progress";
const COIN_VALUE = 100;
const GAME_TIME_PRICE_YEN = 500;
const GAME_TIME_MINUTES_PER_PURCHASE = 60;
const STREAK_KEY = "riku10v2-mission-streak";
const PARTNER_KEY = "riku10v2-partner";
const STREAK_BONUS_DAYS = 7;
const SETTINGS_KEY = "riku10v2-settings";
const PARENT_LOCK_KEY = "riku10v2-parent-lock";
const PARENT_LOCK_ATTEMPTS_KEY = "riku10v2-parent-lock-attempts";
const PARENT_PIN_LENGTH = 4;
const PARENT_RECOVERY_LENGTH = 8;
const PARENT_LOCKOUT_MS = 30000;
const SETTINGS_VERSION = 4;

// きょうのミッションで各タブに必要な問題数の初期値（設定タブでタブごとに変更できる）
const MISSION_CAP_DEFAULTS = {
  pair: 10,
  tenplus: 10,
  flash: 20,
  simple: 20,
  mogi: 10,
  bridge: 10,
  minus: 5,
  ice: 5
};

function defaultGaugeMap() {
  const map = {};
  MODES.forEach((mode) => {
    map[mode] = GAUGE_MODE_DEFAULTS.includes(mode);
  });
  map.multiply = false;
  map.dojo = false;
  return map;
}

// ゲージのクリア数（設定タブで変更できる）
function loadSettings() {
  const defaults = {
    version: SETTINGS_VERSION,
    catchStep: STICKER_STEP,
    coinStep: 75,
    flashMs: 1500, // フラッシュでブロックが見えている時間（ミリ秒）
    flashMax: 10, // フラッシュで出す最大の数
    fireLeftToRight: false, // ほのお: false=小→大、true=左→右に固定
    waitForExplanation: true, // 解説が終わるまで「つぎへ」を表示しない
    missionCaps: { ...MISSION_CAP_DEFAULTS },
    catchModes: defaultGaugeMap(), // ポケモンゲットに進めるタブ
    coinModes: defaultGaugeMap() // コインゲージに進めるタブ
  };
  let parsed = null;
  try {
    parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
  } catch {}
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return defaults;

  const merged = { ...defaults, missionCaps: { ...MISSION_CAP_DEFAULTS } };
  ["catchStep", "coinStep"].forEach((key) => {
    const value = Number(parsed[key]);
    if (Number.isFinite(value) && value >= 1 && value <= 999) merged[key] = Math.round(value);
  });
  const ms = Number(parsed.flashMs);
  if (Number.isFinite(ms) && ms >= 200 && ms <= 10000) merged.flashMs = Math.round(ms);
  const max = Number(parsed.flashMax);
  if (Number.isFinite(max) && max >= 3 && max <= 10) merged.flashMax = Math.round(max);
  if (typeof parsed.fireLeftToRight === "boolean") merged.fireLeftToRight = parsed.fireLeftToRight;
  if (typeof parsed.waitForExplanation === "boolean") merged.waitForExplanation = parsed.waitForExplanation;

  // 旧形式の引き継ぎ: ジム・ダンジョン合算だった missionGoal を4タブに配分する
  const legacyGoal = Number(parsed.missionGoal);
  if (Number.isFinite(legacyGoal) && legacyGoal >= 1) {
    const base = GAUGE_MODE_DEFAULTS.reduce((sum, mode) => sum + MISSION_CAP_DEFAULTS[mode], 0);
    GAUGE_MODE_DEFAULTS.forEach((mode) => {
      merged.missionCaps[mode] = Math.max(1, Math.round((legacyGoal * MISSION_CAP_DEFAULTS[mode]) / base));
    });
  }
  const legacyFlash = Number(parsed.flashCap);
  if (Number.isFinite(legacyFlash) && legacyFlash >= 0 && legacyFlash <= 999) {
    merged.missionCaps.flash = Math.round(legacyFlash);
  }

  // 新形式
  if (parsed.missionCaps && typeof parsed.missionCaps === "object") {
    [...MODES, "multiply", "dojo"].forEach((mode) => {
      const value = Number(parsed.missionCaps[mode]);
      if (Number.isFinite(value) && value >= 0 && value <= 999) merged.missionCaps[mode] = Math.round(value);
    });
  }
  // v2: たしざんジムを答え10まで広げたため、従来の初期値10問を20問へ移行する。
  // それ以外の値に変更していた場合は、その設定をそのまま尊重する。
  const parsedVersion = Number(parsed.version) || 1;
  if (parsedVersion < 2 && Number(parsed.missionCaps?.simple) === 10) {
    merged.missionCaps.simple = MISSION_CAP_DEFAULTS.simple;
  }
  merged.version = SETTINGS_VERSION;
  ["catchModes", "coinModes"].forEach((key) => {
    if (!parsed[key] || typeof parsed[key] !== "object") return;
    [...MODES, "multiply", "dojo"].forEach((mode) => {
      if (typeof parsed[key][mode] === "boolean") merged[key][mode] = parsed[key][mode];
    });
  });
  return merged;
}

// そのタブの正解がポケモンゲット／コインゲージに進むか
function catchEnabled(mode) {
  return SETTINGS.catchModes[mode] === true;
}

function coinEnabled(mode) {
  return SETTINGS.coinModes[mode] === true;
}

// そのタブが今日ミッションに必要な問題数（0 なら必須から外れる）
function missionCap(mode) {
  const value = SETTINGS.missionCaps[mode];
  return Number.isFinite(value) ? value : 0;
}

const SETTINGS = loadSettings();

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS));
}

function loadParentLockConfig() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PARENT_LOCK_KEY) || "null");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    if (parsed.disabled === true) return { version: 1, disabled: true };
    if (typeof parsed.pinHash === "string" && typeof parsed.recoveryHash === "string") {
      return { version: 1, disabled: false, pinHash: parsed.pinHash, recoveryHash: parsed.recoveryHash };
    }
  } catch {}
  return null;
}

function saveParentLockConfig(config) {
  parentLockConfig = config;
  localStorage.setItem(PARENT_LOCK_KEY, JSON.stringify(config));
}

function loadParentLockAttempts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PARENT_LOCK_ATTEMPTS_KEY) || "null");
    if (parsed && typeof parsed === "object") {
      return {
        count: Math.max(0, Math.min(2, Math.round(Number(parsed.count) || 0))),
        lockedUntil: Math.max(0, Number(parsed.lockedUntil) || 0)
      };
    }
  } catch {}
  return { count: 0, lockedUntil: 0 };
}

function saveParentLockAttempts() {
  localStorage.setItem(PARENT_LOCK_ATTEMPTS_KEY, JSON.stringify(parentLockAttempts));
}

// PINと復旧コードは平文で保存せず、端末内では不可逆のハッシュだけを持つ。
function hashParentSecret(kind, secret) {
  const value = `riku10-parent-lock-v1:${kind}:${secret}`;
  let h1 = 0xdeadbeef ^ value.length;
  let h2 = 0x41c6ce57 ^ value.length;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(36).padStart(7, "0")}${(h1 >>> 0).toString(36).padStart(7, "0")}`;
}

function generateParentRecoveryCode() {
  const digits = [];
  const randomValues = new Uint32Array(PARENT_RECOVERY_LENGTH);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(randomValues);
  } else {
    for (let index = 0; index < randomValues.length; index += 1) {
      randomValues[index] = Math.floor(Math.random() * 0xffffffff);
    }
  }
  randomValues.forEach((value) => digits.push(String(value % 10)));
  return digits.join("");
}

let parentLockConfig = loadParentLockConfig();
let parentLockAttempts = loadParentLockAttempts();
const parentLockSession = {
  unlocked: false,
  stage: "unlock",
  entry: "",
  firstPin: "",
  recoveryCode: "",
  message: "",
  returnToSettings: false,
  timerId: null
};
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
  { id: 570, name: "ゾロア" },
  { id: 10, name: "キャタピー" },
  { id: 16, name: "ポッポ" },
  { id: 37, name: "ロコン" },
  { id: 50, name: "ディグダ" },
  { id: 58, name: "ガーディ" },
  { id: 77, name: "ポニータ" },
  { id: 92, name: "ゴース" },
  { id: 113, name: "ラッキー" },
  { id: 116, name: "タッツー" },
  { id: 123, name: "ストライク" },
  { id: 137, name: "ポリゴン" },
  { id: 174, name: "ププリン" },
  { id: 179, name: "メリープ" },
  { id: 181, name: "デンリュウ" },
  { id: 183, name: "マリル" },
  { id: 194, name: "ウパー" },
  { id: 200, name: "ムウマ" },
  { id: 215, name: "ニューラ" },
  { id: 216, name: "ヒメグマ" },
  { id: 228, name: "デルビル" },
  { id: 252, name: "キモリ" },
  { id: 261, name: "ポチエナ" },
  { id: 263, name: "ジグザグマ" },
  { id: 280, name: "ラルトス" },
  { id: 303, name: "クチート" },
  { id: 304, name: "ココドラ" },
  { id: 328, name: "ナックラー" },
  { id: 333, name: "チルット" },
  { id: 349, name: "ヒンバス" },
  { id: 363, name: "タマザラシ" },
  { id: 374, name: "ダンバル" },
  { id: 386, name: "デオキシス" },
  { id: 403, name: "コリンク" },
  { id: 418, name: "ブイゼル" },
  { id: 425, name: "フワンテ" },
  { id: 427, name: "ミミロル" },
  { id: 443, name: "フカマル" },
  { id: 449, name: "ヒポポタス" },
  { id: 459, name: "ユキカブリ" },
  { id: 470, name: "リーフィア" },
  { id: 471, name: "グレイシア" },
  { id: 479, name: "ロトム" },
  { id: 492, name: "シェイミ" },
  { id: 498, name: "ポカブ" },
  { id: 506, name: "ヨーテリー" },
  { id: 529, name: "モグリュー" },
  { id: 531, name: "タブンネ" },
  { id: 546, name: "モンメン" },
  { id: 548, name: "チュリネ" },
  { id: 551, name: "メグロコ" },
  { id: 572, name: "チラーミィ" },
  { id: 587, name: "エモンガ" },
  { id: 595, name: "バチュル" },
  { id: 607, name: "ヒトモシ" },
  { id: 610, name: "キバゴ" },
  { id: 613, name: "クマシュン" },
  { id: 624, name: "コマタナ" },
  { id: 650, name: "ハリマロン" },
  { id: 653, name: "フォッコ" },
  { id: 656, name: "ケロマツ" }
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

// さいふは円で持つ。旧形式（100円が何枚か）からは ×100 して引き継ぐ
function loadWalletYen() {
  const raw = localStorage.getItem(WALLET_KEY);
  let wallet = raw !== null
    ? Math.max(0, Math.round(Number(raw) || 0))
    : Math.max(0, Number(localStorage.getItem(COINS_KEY) || "0") || 0) * COIN_VALUE;

  // 「とうし」廃止時に、現在価値と旧ぎんこう残高を一度だけさいふへ戻す。
  if (localStorage.getItem(LEGACY_FINANCE_REFUND_KEY) !== "true") {
    let refund = 0;
    try {
      const finance = JSON.parse(localStorage.getItem(LEGACY_FINANCE_KEY) || "null");
      if (finance && typeof finance === "object" && !Array.isArray(finance)) {
        refund += Math.max(0, Math.round(Number(finance.invest) || 0));
        refund += Math.max(0, Math.round(Number(finance.bank) || 0));
      }
    } catch {}
    wallet += refund;
    localStorage.setItem(LEGACY_FINANCE_REFUND_KEY, "true");
    localStorage.setItem(WALLET_KEY, String(wallet));
  }

  return wallet;
}

function loadGameTimeMinutes() {
  return Math.max(0, Math.round(Number(localStorage.getItem(GAME_TIME_KEY) || "0") || 0));
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

// ほのおは「小＋大」「大＋小」を同じ基礎頻度で出す。
function makeFireProblems() {
  const problems = [];
  for (let a = 2; a <= 9; a += 1) {
    for (let b = 2; b <= 9; b += 1) {
      const answer = a + b;
      if (answer >= 11 && answer <= 18) {
        problems.push({ displayA: a, displayB: b });
      }
    }
  }
  return problems;
}

function orientFireProblem(problem, leftToRightFixed) {
  const sourceOnLeft = leftToRightFixed || problem.displayA <= problem.displayB;
  const source = sourceOnLeft ? problem.displayA : problem.displayB;
  const target = sourceOnLeft ? problem.displayB : problem.displayA;
  return {
    ...problem,
    big: target,
    small: source,
    sourceOnLeft
  };
}

function makeSimpleProblems() {
  const problems = [];
  for (let a = 1; a <= 9; a += 1) {
    for (let b = 1; b <= 9; b += 1) {
      if (a + b <= 10) {
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

// かみなりジム（フラッシュ）: 10マスに n 個。5のかたまり＋いくつ、で見る練習。
// 主役は5〜10（上の段が5でうまって、下の段があといくつ）。1〜4はごくまれ（20問に1問くらい）
const FLASH_CORE_MIN = 5;
const FLASH_CORE_MAX = 10;
const FLASH_CORE_WEIGHT = 12;

function makeFlashProblems() {
  const problems = [];
  for (let n = 1; n <= SETTINGS.flashMax; n += 1) {
    const times = n >= FLASH_CORE_MIN && n <= FLASH_CORE_MAX ? FLASH_CORE_WEIGHT : 1;
    for (let i = 0; i < times; i += 1) problems.push({ n });
  }
  return problems;
}

let flashProblems = makeFlashProblems();

const bridgeProblems = makeBridgeProblems();
const fireProblems = makeFireProblems();
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
  problem: { simple: null, pair: null, tenplus: null, flash: null, mogi: null, bridge: null, minus: null, ice: null },
  lastKey: { simple: "", pair: "", tenplus: "", flash: "", mogi: "", bridge: "", minus: "", ice: "" },
  questionAt: { simple: 0, pair: 0, tenplus: 0, flash: 0, mogi: 0, bridge: 0, minus: 0, ice: 0 },
  stats: loadStats(),
  dayLog: loadDayLog(),
  started: { simple: false, pair: false, tenplus: false, flash: false, mogi: false, bridge: false, minus: false, ice: false },
  locked: { simple: true, pair: true, tenplus: true, flash: true, mogi: true, bridge: true, minus: true, ice: true },
  records: {
    simple: loadModeRecords(RECORDS_KEYS.simple),
    pair: loadModeRecords(RECORDS_KEYS.pair),
    tenplus: loadModeRecords(RECORDS_KEYS.tenplus),
    flash: loadModeRecords(RECORDS_KEYS.flash),
    mogi: loadModeRecords(RECORDS_KEYS.mogi),
    bridge: loadModeRecords(RECORDS_KEYS.bridge),
    minus: loadModeRecords(RECORDS_KEYS.minus),
    ice: loadModeRecords(RECORDS_KEYS.ice)
  },
  // かみなりジム: timers はフラッシュ表示の setTimeout 群、replays は今の問題で見直した回数
  flash: { timers: [], replays: 0, shown: false },
  // たしざんジム: 答え10の直後に、片方を1減らした答え9の比較問題を出す
  simpleFollowUp: null,
  // もぎダンジョンの盤面: phase は build(10づくり) → sum(こたえ) → done。
  // slots は各がわ10マスの中身（"green"/"red"/null）。取られたマスは穴のまま残す
  mogi: { phase: "build", doneSide: "", slots: { left: [], right: [] } },
  // ほのおで困ったときに、同じ式をもぎダンジョン方式で試す補助盤面
  bridgeMogi: { open: false, used: false, solved: false, original: { left: 0, right: 0 }, slots: { left: [], right: [] } },
  combo: 0,
  stars: 0,
  totalCorrect: Number(localStorage.getItem(TOTAL_KEY) || "0") || 0,
  catchProgress: loadCatchProgress(),
  activeMode: "pair",
  caught: loadCaught(),
  daily: loadDaily(),
  revealTimeout: { ice: null, minus: null },
  walletYen: loadWalletYen(),
  gameTimeMinutes: loadGameTimeMinutes(),
  coinProgress: Math.min(SETTINGS.coinStep - 1, Math.max(0, Number(localStorage.getItem(COIN_PROGRESS_KEY) || "0") || 0)),
  coinJustEarned: false,
  streak: loadStreak(),
  streakBonusJust: false,
  partner: Number(localStorage.getItem(PARTNER_KEY)) || null,
  nextQuestionTimeoutId: null,
  explanationReadyTimeoutId: null,
  bridgeRevealTimeoutId: null,
  timedEnabled: localStorage.getItem(TIMED_KEY) === "true",
  blocksEnabled: localStorage.getItem("riku10v2-blocks-enabled") === "true",
  explainEnabled: localStorage.getItem("riku10v2-explain-enabled") !== "false",
  challenge: { remainingMs: CHALLENGE_SECONDS * 1000, intervalId: null, ended: false }
};

state.dojo = { queue: [], current: 0, started: false };

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
  purchasedGameTime: qs("#purchased-game-time"),
  missionStreakDays: qs("#mission-streak-days"),
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
  explainToggle: qs("#explain-toggle"),
  explainToggleLabel: qs("#explain-toggle-label"),
  explanationWaitToggle: qs("#explanation-wait-toggle"),
  explanationWaitToggleLabel: qs("#explanation-wait-toggle-label"),
  fireDirectionToggle: qs("#fire-direction-toggle"),
  fireDirectionToggleLabel: qs("#fire-direction-toggle-label"),
  bridgeEquation: qs("#bridge-equation"),
  bridgeBoard: qs("#bridge-board"),
  bridgeChain: qs("#bridge-chain"),
  bridgeLeftLabel: qs("#bridge-left-label"),
  bridgeRightLabel: qs("#bridge-right-label"),
  bridgeFrame: qs("#bridge-frame"),
  donorDots: qs("#donor-dots"),
  bridgeMogiHelpToggle: qs("#bridge-mogi-help-toggle"),
  bridgeMogiHelper: qs("#bridge-mogi-helper"),
  bridgeMogiLeftLabel: qs("#bridge-mogi-left-label"),
  bridgeMogiRightLabel: qs("#bridge-mogi-right-label"),
  bridgeMogiLeftFrame: qs("#bridge-mogi-left-frame"),
  bridgeMogiRightFrame: qs("#bridge-mogi-right-frame"),
  bridgeMogiHelpFeedback: qs("#bridge-mogi-help-feedback"),
  bridgeMogiHelpReset: qs("#bridge-mogi-help-reset"),
  mogiEquation: qs("#mogi-equation"),
  mogiChain: qs("#mogi-chain"),
  mogiLeftLabel: qs("#mogi-left-label"),
  mogiRightLabel: qs("#mogi-right-label"),
  mogiLeftFrame: qs("#mogi-left-frame"),
  mogiRightFrame: qs("#mogi-right-frame"),
  tenplusEquation: qs("#tenplus-equation"),
  tenplusFrame: qs("#tenplus-frame"),
  tenplusDots: qs("#tenplus-dots"),
  tenplusRightLabel: qs("#tenplus-right-label"),
  iceEquation: qs("#ice-equation"),
  iceFrame: qs("#ice-frame"),
  iceDots: qs("#ice-dots"),
  iceLeftLabel: qs("#ice-left-label"),
  iceRightLabel: qs("#ice-right-label"),
  flashStage: qs("#flash-stage"),
  flashFrame: qs("#flash-frame"),
  flashVeil: qs("#flash-veil"),
  flashExplain: qs("#flash-explain"),
  flashReplay: qs("#flash-replay"),
  simpleEquation: qs("#simple-equation"),
  simpleJoinBoard: qs("#simple-join-board"),
  simpleLeftLabel: qs("#simple-left-label"),
  simpleRightLabel: qs("#simple-right-label"),
  simpleLeftDots: qs("#simple-left-dots"),
  simpleRightDots: qs("#simple-right-dots"),
  simpleJoinArrow: qs("#simple-join-arrow"),
  simpleJoinText: qs("#simple-join-text"),
  simpleFrame: qs("#simple-frame"),
  simpleCompare: qs("#simple-compare"),
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
  dexDetail: qs("#dex-detail"),
  dexDetailImg: qs("#dex-detail-img"),
  dexDetailName: qs("#dex-detail-name"),
  dexDetailMeta: qs("#dex-detail-meta"),
  catchFill: qs("#catch-fill"),
  catchText: qs("#catch-text"),
  partnerCard: qs("#partner-card"),
  partnerImg: qs("#partner-img"),
  partnerName: qs("#partner-name"),
  parentLockCard: qs("#parent-lock-card"),
  settingsContent: qs("#settings-content"),
  parentLockTitle: qs("#parent-lock-title"),
  parentLockMessage: qs("#parent-lock-message"),
  parentPinEntryView: qs("#parent-pin-entry-view"),
  parentPinDisplay: qs("#parent-pin-display"),
  parentPinKeypad: qs("#parent-pin-keypad"),
  parentPinSubmit: qs("#parent-pin-submit"),
  parentLockForgot: qs("#parent-lock-forgot"),
  parentLockBack: qs("#parent-lock-back"),
  parentRecoveryIssued: qs("#parent-recovery-issued"),
  parentRecoveryCode: qs("#parent-recovery-code"),
  parentLockStatus: qs("#parent-lock-status"),
  parentLockChange: qs("#parent-lock-change"),
  parentLockReissue: qs("#parent-lock-reissue"),
  parentLockRemove: qs("#parent-lock-remove"),
  missionSegs: Object.fromEntries(MODES.map((mode) => [mode, qs(`#mission-seg-${mode}`)])),
  missionLegend: qs("#mission-legend"),
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
  if (Number.isFinite(problem.displayA) && Number.isFinite(problem.displayB)) {
    return `${problem.displayA}+${problem.displayB}`;
  }
  return `${problem.big ?? problem.base}+${problem.small ?? problem.friend}`;
}

/* ---------- 成績記録・にがて優先出題 ---------- */

function flashKey(problem) {
  return String(problem.n);
}

function statKeyFn(mode) {
  if (mode === "flash") return flashKey;
  return mode === "pair" || mode === "bridge" || mode === "mogi" ? problemKey : abKey;
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
  // 0のままの開始時刻や長時間放置だけを除外し、20秒超のゆっくりした回答は残す。
  const elapsedIsValid = elapsed > 300 && elapsed < 30 * 60 * 1000;
  const stat = state.stats[mode][key] || { c: 0, w: 0, t: 0 };
  if (correct) stat.c += 1;
  else stat.w += 1;
  if (elapsedIsValid) {
    stat.t = stat.t ? Math.round(stat.t * 0.7 + elapsed * 0.3) : elapsed;
  }
  // 昔の成績を引きずらないよう、たまったら半減して直近を重視
  if (stat.c + stat.w > 30) {
    stat.c = Math.round(stat.c / 2);
    stat.w = Math.round(stat.w / 2);
  }
  state.stats[mode][key] = stat;
  saveStats();

  const day = state.dayLog[todayStr()] || { c: 0, w: 0, problems: {} };
  if (correct) day.c += 1;
  else day.w += 1;
  if (!day.problems || typeof day.problems !== "object" || Array.isArray(day.problems)) day.problems = {};
  if (!day.problems[mode] || typeof day.problems[mode] !== "object" || Array.isArray(day.problems[mode])) {
    day.problems[mode] = {};
  }
  const savedDailyProblem = day.problems[mode][key];
  const dailyProblem = savedDailyProblem && typeof savedDailyProblem === "object" && !Array.isArray(savedDailyProblem)
    ? savedDailyProblem
    : { n: 0, w: 0, s: 0, t: 0 };
  dailyProblem.n = Math.max(0, Number(dailyProblem.n) || 0);
  dailyProblem.w = Math.max(0, Number(dailyProblem.w) || 0);
  dailyProblem.s = Math.max(0, Number(dailyProblem.s) || 0);
  dailyProblem.t = Math.max(0, Number(dailyProblem.t) || 0);
  dailyProblem.n += 1;
  if (!correct) dailyProblem.w += 1;
  if (elapsedIsValid) {
    dailyProblem.t = Math.max(dailyProblem.t || 0, elapsed);
    if (elapsed >= SLOW_ANSWER_MS) dailyProblem.s += 1;
  }
  day.problems[mode][key] = dailyProblem;
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

/* ---------- コインゲージ（ちょきん） ---------- */

function saveCoins() {
  localStorage.setItem(WALLET_KEY, String(state.walletYen));
  localStorage.setItem(COIN_PROGRESS_KEY, String(state.coinProgress));
}

function renderCoinGauge() {
  els.savings.textContent = `${state.walletYen}円`;
  const percent = Math.min(100, (state.coinProgress / SETTINGS.coinStep) * 100);
  els.coinFill.style.width = `${percent}%`;
  els.coinText.textContent = `あと${SETTINGS.coinStep - state.coinProgress}もんで100円`;
  const current = qs("#coin-current");
  if (current) current.textContent = `${state.walletYen}円`;
  renderGameTimeShop();
}

function currentMissionStreak() {
  return state.streak.last === todayStr() || state.streak.last === yesterdayStr() ? state.streak.count : 0;
}

function renderHeroStats() {
  els.purchasedGameTime.textContent = formatGameTime(state.gameTimeMinutes);
  els.missionStreakDays.textContent = currentMissionStreak();
}

// 渡したぶんの貯金を減らす。0円未満にはしない
function spendYen(yen) {
  const spend = Math.min(state.walletYen, Math.max(0, Math.round(yen)));
  if (spend <= 0) return false;
  state.walletYen -= spend;
  state.coinJustEarned = false;
  saveCoins();
  renderCoinGauge();
  return true;
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
    state.walletYen += COIN_VALUE;
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
    state.walletYen += COIN_VALUE;
    state.coinJustEarned = true;
    burstConfetti(48);
  }
  saveCoins();
  renderCoinGauge();
}

/* ---------- ゲームじかんやさん ---------- */

function formatGameTime(minutes) {
  const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(safeMinutes / 60);
  const rest = safeMinutes % 60;
  if (rest === 0) return `${hours}時間`;
  return hours > 0 ? `${hours}時間${rest}分` : `${rest}分`;
}

function saveGameTime() {
  localStorage.setItem(GAME_TIME_KEY, String(state.gameTimeMinutes));
}

function gameTimeFeedback(message, good = false) {
  const feedback = qs("#game-time-feedback");
  if (!feedback) return;
  feedback.className = `feedback${good ? " is-good" : message ? " is-try" : ""}`;
  feedback.textContent = message || "500円で ゲーム1時間と こうかんできるよ";
}

function renderGameTimeShop() {
  const balance = qs("#game-time-balance");
  if (!balance) return;
  balance.textContent = formatGameTime(state.gameTimeMinutes);
  qs("#game-time-wallet").textContent = `さいふ：${state.walletYen}円`;
  const short = Math.max(0, GAME_TIME_PRICE_YEN - state.walletYen);
  qs("#game-time-price-note").textContent = short > 0
    ? `あと${short}円で 1時間かえるよ`
    : "いま 1時間かえるよ！";
  qs("#game-time-buy").classList.toggle("can-buy", short === 0);
  const useButton = qs("#game-time-use");
  const canUse = state.gameTimeMinutes >= GAME_TIME_MINUTES_PER_PURCHASE;
  useButton.disabled = !canUse;
  useButton.textContent = canUse ? "1時間つかった" : "つかえるチケットがない";
}

function buyGameTime() {
  if (state.walletYen < GAME_TIME_PRICE_YEN) {
    const short = GAME_TIME_PRICE_YEN - state.walletYen;
    gameTimeFeedback(`さいふの おかねが あと${short}円 たりないよ`);
    return false;
  }

  state.walletYen -= GAME_TIME_PRICE_YEN;
  state.gameTimeMinutes += GAME_TIME_MINUTES_PER_PURCHASE;
  state.coinJustEarned = false;
  saveCoins();
  saveGameTime();
  renderCoinGauge();
  renderHeroStats();
  gameTimeFeedback(`おかいあげ ありがとう！ ゲーム時間が 1時間ふえたよ`, true);
  const card = qs("#game-time-ticket");
  card.classList.remove("is-purchased");
  requestAnimationFrame(() => card.classList.add("is-purchased"));
  setTimeout(() => card.classList.remove("is-purchased"), 1200);
  burstConfetti(28);
  playCashRegisterSound();
  return true;
}

function useGameTime() {
  if (state.gameTimeMinutes < GAME_TIME_MINUTES_PER_PURCHASE) {
    gameTimeFeedback("つかえる ゲーム時間が ないよ");
    return false;
  }
  if (!window.confirm("ゲーム時間を1時間つかいますか？")) return false;

  state.gameTimeMinutes -= GAME_TIME_MINUTES_PER_PURCHASE;
  saveGameTime();
  renderGameTimeShop();
  renderHeroStats();
  gameTimeFeedback(`ゲーム時間を 1時間つかったよ。のこり ${formatGameTime(state.gameTimeMinutes)}`, true);
  playTone("click");
  return true;
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

// ミッションの4枠それぞれの達成数
function missionParts() {
  rolloverDaily();
  const done = {};
  MODES.forEach((mode) => {
    done[mode] = Math.min(state.daily[`${mode}Used`] || 0, missionCap(mode));
  });
  return done;
}

function missionTotal() {
  return MODES.reduce((sum, mode) => sum + missionCap(mode), 0);
}

// 各タブが今日あと何問ミッションに必要か
function renderMissionCaps() {
  MODES.forEach((mode) => {
    const el = qs(`#${mode}-cap`);
    if (!el) return;
    const cap = missionCap(mode);
    if (cap <= 0) {
      el.textContent = "きょうは おやすみ";
      return;
    }
    const left = Math.max(0, cap - (state.daily[`${mode}Used`] || 0));
    el.textContent = left > 0 ? `ミッションに あと${left}もん` : "きょうのぶんは クリア！";
  });
}

function renderMission() {
  rolloverDaily();
  renderHeroStats();
  renderMissionCaps();
  const remain = SETTINGS.catchStep - state.catchProgress;
  const catchPercent = (state.catchProgress / SETTINGS.catchStep) * 100;
  els.catchFill.style.width = `${catchPercent}%`;
  els.catchText.textContent = `あと${remain}もん`;

  // タブごとの内訳バー。必要数が0のタブはバーにも凡例にも出さない
  const done = missionParts();
  const total = missionTotal();
  const toWidth = (value) => (total > 0 ? `${Math.min(100, (value / total) * 100)}%` : "0%");
  let legend = "";
  MODES.forEach((mode) => {
    const cap = missionCap(mode);
    els.missionSegs[mode].style.width = toWidth(done[mode]);
    if (cap > 0) {
      legend += `<i class="legend-dot seg-${mode}"></i>${MODE_LABELS[mode]} ${done[mode]}/${cap}`;
    }
  });
  els.missionLegend.innerHTML = legend || "ぜんぶのタブが おやすみに なっているよ（設定タブで もんだいすうを きめてね）";
  const left = total - MODES.reduce((sum, mode) => sum + done[mode], 0);
  els.missionText.textContent = state.daily.done
    ? `クリア！🎉${state.streak.last === todayStr() && state.streak.count > 1 ? ` ${state.streak.count}日れんぞく` : ""}`
    : `あと ${left}もん`;
}

/* ---------- りくのパートナー ---------- */

function renderPartner() {
  const species = STICKERS.find((s) => s.id === state.partner);
  const entry = species ? state.caught[species.id] : null;
  const owned = Boolean(entry && (entry.n || 0) + (entry.s || 0) > 0);
  els.partnerCard.classList.toggle("is-hidden", !owned);
  if (!owned) return;
  els.partnerImg.src = stickerImageUrl(species.id, (entry.s || 0) > 0);
  els.partnerImg.alt = species.name;
  els.partnerCard.title = species.name;
  els.partnerName.textContent = species.name;
}

function setPartner(id) {
  state.partner = id;
  localStorage.setItem(PARTNER_KEY, String(id));
  renderPartner();
}

// ずかんでタップしたポケモンの名前・図鑑番号・ゲット数を表示
function renderDexDetail(entry) {
  els.dexDetail.classList.remove("is-hidden");
  els.dexDetailImg.src = stickerImageUrl(entry.id, entry.shinyCount > 0);
  els.dexDetailImg.alt = entry.name;
  els.dexDetailName.textContent = entry.name;
  const meta = [`ずかんばんごう ${entry.id}`, `${entry.count}ひき ゲット`];
  if (entry.shinyCount > 0) meta.push(`✨いろちがい ${entry.shinyCount}ひき`);
  els.dexDetailMeta.textContent = meta.join(" ・ ");
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
      cell.classList.toggle("is-partner", entry.id === state.partner);
      cell.addEventListener("click", () => {
        setPartner(entry.id);
        renderDexDetail(entry);
        renderDex();
      });
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

// 間違えたときのペナルティ。ポケモンゲット対象のタブだけ、進捗が1つ戻る
function registerWrong(mode) {
  if (!catchEnabled(mode)) return;
  state.catchProgress = Math.max(0, state.catchProgress - 1);
  saveCatchProgress();
  rolloverDaily();
  // そのタブのミッション進捗もペナルティ。ただしクリア後は固定で減らさない
  if (!state.daily.done) {
    const usedKey = `${mode}Used`;
    state.daily[usedKey] = Math.max(0, (state.daily[usedKey] || 0) - 1);
    saveDaily();
  }
  renderMission();
}

function checkMissionGoal() {
  const done = missionParts();
  const cleared = MODES.every((mode) => done[mode] >= missionCap(mode));
  if (!state.daily.done && cleared && missionTotal() > 0) {
    state.daily.done = true;
    saveDaily();
    registerMissionClear();
    catchPokemon(true);
  }
}

// 正解1問ぶんを、そのタブのミッション枠に足す（上限に達したらそれ以上は増えない）
function registerMissionProgress(mode) {
  rolloverDaily();
  const usedKey = `${mode}Used`;
  const used = state.daily[usedKey] || 0;
  if (used < missionCap(mode)) {
    state.daily[usedKey] = used + 1;
    saveDaily();
  }
  checkMissionGoal();
  renderMission();
}

// 正解1問ぶんの処理。どのゲージに進むかは設定タブのタブ別トグルで決まる
function registerCorrect(mode) {
  state.totalCorrect += 1;
  localStorage.setItem(TOTAL_KEY, String(state.totalCorrect));
  if (coinEnabled(mode)) registerCoinProgress();
  if (catchEnabled(mode)) {
    state.catchProgress += 1;
    if (state.catchProgress >= SETTINGS.catchStep) {
      state.catchProgress = 0; // ゲットしたら0から数え直し。間違えても戻らない
      catchPokemon(false);
    }
    saveCatchProgress();
  }
  registerMissionProgress(mode);
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
      window.alert("このファイルは「りくのぼうけん」の保存データではありません");
      return;
    }
    if (!window.confirm("現在のデータを保存データで上書きします。よろしいですか？")) return;
    Object.entries(data).forEach(([key, value]) => {
      if (key.startsWith(BACKUP_PREFIX) && typeof value === "string") {
        localStorage.setItem(key, value);
      }
    });
    location.reload();
  });
}

/* ---------- せいせき（おうちの人向け） ---------- */

const MODE_LABELS = { simple: "たしざんジム", pair: "あわせて10", tenplus: "10+X", flash: "かみなりジム", mogi: "もぎダンジョン", bridge: "ほのおのダンジョン", minus: "ひきざんジム", ice: "こおりのダンジョン" };
const STATS_MODE_LABELS = { simple: "足し算ジム", pair: "合わせて10", tenplus: "10+X", flash: "雷ジム", mogi: "もぎダンジョン", bridge: "炎のダンジョン", minus: "引き算ジム", ice: "氷のダンジョン" };
MODE_LABELS.bridge = "炎のダンジョン";
MODE_LABELS.ice = "氷のダンジョン";
MODE_LABELS.multiply = "かけざんジム";
MODE_LABELS.dojo = "にがて道場";
const SETTINGS_MODES = [...MODES, "multiply", "dojo"];

function formatProblemLabel(mode, key) {
  if (mode === "flash") return `${key}こ`;
  if (mode === "minus" || mode === "ice") return key.replace("-", " − ");
  if (mode === "simple" || mode === "tenplus") return key.replace("-", " + ");
  return key.replace("+", " + ");
}

function formatStatsProblemLabel(mode, key) {
  if (mode === "flash") return `${key}個`;
  return formatProblemLabel(mode, key);
}

let statsCalendarOffset = 0;
let selectedStatsDate = todayStr();

function dayKeyFromDate(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function statsMonthBase() {
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + statsCalendarOffset);
  return base;
}

function dailyProblemEntries(day, mode) {
  const problems = day && day.problems;
  if (!problems || typeof problems !== "object" || Array.isArray(problems)) return [];
  const category = problems[mode];
  if (!category || typeof category !== "object" || Array.isArray(category)) return [];
  return Object.entries(category).map(([key, stat]) => ({
    key,
    w: Math.max(0, Number(stat && stat.w) || 0),
    s: Math.max(0, Number(stat && stat.s) || 0),
    t: Math.max(0, Number(stat && stat.t) || 0)
  }));
}

function dailySlowCount(day) {
  return MODES.reduce((total, mode) => total + dailyProblemEntries(day, mode).reduce((sum, item) => {
    return sum + (item.s || (item.t >= SLOW_ANSWER_MS ? 1 : 0));
  }, 0), 0);
}

function renderStatsSummary(base) {
  const year = base.getFullYear();
  const month = base.getMonth();
  let attempts = 0;
  let wrong = 0;
  let slow = 0;
  const lastDate = new Date(year, month + 1, 0).getDate();
  for (let date = 1; date <= lastDate; date += 1) {
    const day = state.dayLog[`${year}-${month + 1}-${date}`];
    if (!day) continue;
    attempts += (day.c || 0) + (day.w || 0);
    wrong += day.w || 0;
    slow += dailySlowCount(day);
  }
  qs("#stats-summary").textContent = `${month + 1}月の解答数 ${attempts}問　／　誤答 ${wrong}問　／　20秒以上 ${slow}問`;
}

function renderStatsCalendar() {
  const base = statsMonthBase();
  const year = base.getFullYear();
  const month = base.getMonth();
  qs("#stats-month-label").textContent = `${year}年 ${month + 1}月`;
  qs("#stats-next").disabled = statsCalendarOffset >= 0;
  renderStatsSummary(base);

  const grid = qs("#stats-calendar-grid");
  grid.replaceChildren();
  ["日", "月", "火", "水", "木", "金", "土"].forEach((label) => {
    const head = document.createElement("div");
    head.className = "stats-calendar-head";
    head.textContent = label;
    grid.append(head);
  });

  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  for (let index = 0; index < firstDay; index += 1) {
    const empty = document.createElement("span");
    empty.className = "stats-calendar-empty";
    grid.append(empty);
  }

  const now = new Date();
  now.setHours(23, 59, 59, 999);
  for (let date = 1; date <= lastDate; date += 1) {
    const current = new Date(year, month, date);
    const key = dayKeyFromDate(current);
    const day = state.dayLog[key] || { c: 0, w: 0 };
    const attempts = (day.c || 0) + (day.w || 0);
    const slow = dailySlowCount(day);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "stats-calendar-cell";
    button.disabled = current > now;
    button.classList.toggle("is-today", key === todayStr());
    button.classList.toggle("is-selected", key === selectedStatsDate);
    button.classList.toggle("has-issues", (day.w || 0) > 0 || slow > 0);
    button.setAttribute("aria-pressed", key === selectedStatsDate ? "true" : "false");
    button.setAttribute("aria-label", `${month + 1}月${date}日、${attempts}問`);

    const number = document.createElement("span");
    number.className = "stats-calendar-date";
    number.textContent = date;
    const count = document.createElement("strong");
    count.className = "stats-calendar-count";
    count.textContent = button.disabled ? "" : `${attempts}問`;
    const issues = document.createElement("span");
    issues.className = "stats-calendar-issues";
    if ((day.w || 0) > 0) {
      const marker = document.createElement("span");
      marker.className = "is-wrong";
      marker.title = "間違えた問題あり";
      issues.append(marker);
    }
    if (slow > 0) {
      const marker = document.createElement("span");
      marker.className = "is-slow";
      marker.title = "20秒以上の問題あり";
      issues.append(marker);
    }
    button.append(number, count, issues);
    button.addEventListener("click", () => {
      selectedStatsDate = key;
      renderStatsCalendar();
      renderStatsDayDetail();
    });
    grid.append(button);
  }
}

function renderStatsDayDetail() {
  const [, month, date] = selectedStatsDate.split("-").map(Number);
  const day = state.dayLog[selectedStatsDate] || { c: 0, w: 0 };
  const attempts = (day.c || 0) + (day.w || 0);
  const slow = dailySlowCount(day);
  qs("#stats-day-title").textContent = `${month}月${date}日の振り返り`;
  const hasDetails = MODES.some((mode) => dailyProblemEntries(day, mode).length > 0);
  let summary = `解答数 ${attempts}問　／　誤答 ${day.w || 0}問　／　20秒以上 ${slow}問`;
  if (!hasDetails && (day.w || 0) > 0) summary += "（問題ごとの内訳は、この更新後の記録から表示されます）";
  qs("#stats-day-summary").textContent = summary;

  const wrap = qs("#stats-day-details");
  wrap.replaceChildren();
  MODES.forEach((mode) => {
    const card = document.createElement("section");
    card.className = "stats-category-card";
    const title = document.createElement("h4");
    title.textContent = STATS_MODE_LABELS[mode];
    card.append(title);

    const items = dailyProblemEntries(day, mode)
      .filter((item) => item.w > 0 || item.s > 0 || item.t >= SLOW_ANSWER_MS)
      .sort((a, b) => b.w - a.w || b.t - a.t);
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "stats-category-empty";
      empty.textContent = "該当なし";
      card.append(empty);
    } else {
      const list = document.createElement("ul");
      list.className = "stats-problem-list";
      items.forEach((item) => {
        const row = document.createElement("li");
        const label = document.createElement("strong");
        label.textContent = formatStatsProblemLabel(mode, item.key);
        const flags = document.createElement("span");
        flags.className = "stats-problem-flags";
        if (item.w > 0) {
          const wrong = document.createElement("span");
          wrong.className = "stats-issue-tag is-wrong";
          wrong.textContent = `誤答 ${item.w}回`;
          flags.append(wrong);
        }
        if (item.s > 0 || item.t >= SLOW_ANSWER_MS) {
          const slowTag = document.createElement("span");
          slowTag.className = "stats-issue-tag is-slow";
          slowTag.textContent = `${Math.ceil(item.t / 1000)}秒`;
          flags.append(slowTag);
        }
        row.append(label, flags);
        list.append(row);
      });
      card.append(list);
    }
    wrap.append(card);
  });
}

function renderCumulativeWeakProblems() {
  const wrap = qs("#stats-cumulative-weak");
  wrap.replaceChildren();
  MODES.forEach((mode) => {
    const card = document.createElement("section");
    card.className = "stats-category-card";
    const title = document.createElement("h4");
    title.textContent = STATS_MODE_LABELS[mode];
    card.append(title);

    const items = Object.entries(state.stats[mode] || {})
      .map(([key, stat]) => {
        const correct = Math.max(0, Number(stat && stat.c) || 0);
        const wrong = Math.max(0, Number(stat && stat.w) || 0);
        const time = Math.max(0, Number(stat && stat.t) || 0);
        const attempts = correct + wrong;
        const wrongRate = attempts ? wrong / attempts : 0;
        const weakness = wrongRate * 100 + (time >= SLOW_ANSWER_MS ? Math.min(60, time / 1000) : 0);
        return { key, correct, wrong, time, attempts, wrongRate, weakness };
      })
      .filter((item) => item.attempts >= 1 && (item.wrong > 0 || item.time >= SLOW_ANSWER_MS))
      .sort((a, b) => b.weakness - a.weakness || b.attempts - a.attempts)
      .slice(0, 5);

    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "stats-category-empty";
      empty.textContent = "該当なし";
      card.append(empty);
    } else {
      const list = document.createElement("ul");
      list.className = "stats-problem-list stats-history-list";
      items.forEach((item) => {
        const row = document.createElement("li");
        const label = document.createElement("strong");
        label.textContent = formatStatsProblemLabel(mode, item.key);
        const detail = document.createElement("span");
        detail.className = "stats-history-detail";
        const accuracy = Math.round((item.correct / item.attempts) * 100);
        const parts = [`解答 ${item.attempts}回`, `正解 ${item.correct}回`, `誤答 ${item.wrong}回`, `正答率 ${accuracy}%`];
        if (item.time > 0) parts.push(`回答時間 約${Math.round(item.time / 1000)}秒`);
        detail.textContent = parts.join(" ／ ");
        row.append(label, detail);
        list.append(row);
      });
      card.append(list);
    }
    wrap.append(card);
  });
}

function selectStatsDateInVisibleMonth() {
  const base = statsMonthBase();
  const year = base.getFullYear();
  const month = base.getMonth();
  const lastDate = statsCalendarOffset === 0 ? new Date().getDate() : new Date(year, month + 1, 0).getDate();
  let selectedDate = lastDate;
  for (let date = lastDate; date >= 1; date -= 1) {
    const day = state.dayLog[`${year}-${month + 1}-${date}`];
    if (day && (day.c || 0) + (day.w || 0) > 0) {
      selectedDate = date;
      break;
    }
  }
  selectedStatsDate = `${year}-${month + 1}-${selectedDate}`;
}

/* ---------- 1しゅうかんレポート ---------- */

// startDaysAgo〜endDaysAgo（今日=0）の範囲でdayLogを合計する
function weekRangeTotals(startDaysAgo, endDaysAgo) {
  let c = 0;
  let w = 0;
  let activeDays = 0;
  for (let i = startDaysAgo; i <= endDaysAgo; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    const log = state.dayLog[key];
    if (!log) continue;
    c += log.c || 0;
    w += log.w || 0;
    if ((log.c || 0) + (log.w || 0) > 0) activeDays += 1;
  }
  return { c, w, activeDays };
}

// 今週、まちがえたか20秒以上かかった問題だけをまとめる。
function computeWeeklyPractice() {
  const grouped = new Map();
  for (let daysAgo = 0; daysAgo <= 6; daysAgo += 1) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const day = state.dayLog[dayKeyFromDate(date)];
    MODES.forEach((mode) => {
      dailyProblemEntries(day, mode).forEach((item) => {
        const slowCount = item.s || (item.t >= SLOW_ANSWER_MS ? 1 : 0);
        if (item.w <= 0 && slowCount <= 0) return;
        const groupKey = `${mode}:${item.key}`;
        const current = grouped.get(groupKey) || { mode, key: item.key, wrongCount: 0, slowCount: 0, maxTime: 0 };
        current.wrongCount += item.w;
        current.slowCount += slowCount;
        current.maxTime = Math.max(current.maxTime, item.t);
        grouped.set(groupKey, current);
      });
    });
  }
  return [...grouped.values()]
    .sort((a, b) => b.wrongCount - a.wrongCount || b.slowCount - a.slowCount || b.maxTime - a.maxTime)
    .slice(0, 8);
}

function renderReportBadgeList(containerId, items, emptyText) {
  const wrap = qs(`#${containerId}`);
  wrap.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "records-empty";
    empty.textContent = emptyText;
    wrap.append(empty);
    return;
  }
  items.forEach((item) => {
    const badge = document.createElement("div");
    badge.className = "report-badge";
    const mode = document.createElement("span");
    mode.className = "report-badge-mode";
    mode.textContent = MODE_LABELS[item.mode];
    const eq = document.createElement("strong");
    eq.className = "report-badge-eq";
    eq.textContent = formatProblemLabel(item.mode, item.key);
    const detail = document.createElement("span");
    detail.className = "report-badge-detail";
    const reasons = [];
    if (item.wrongCount > 0) reasons.push(`まちがえ ${item.wrongCount}かい`);
    if (item.slowCount > 0) reasons.push(`20びょう以上 ${item.slowCount}かい`);
    detail.textContent = reasons.join("・");
    badge.append(mode, eq, detail);
    wrap.append(badge);
  });
}

function renderReport() {
  const thisWeek = weekRangeTotals(0, 6);
  const lastWeek = weekRangeTotals(7, 13);
  const streakAlive = state.streak.last === todayStr() || state.streak.last === yesterdayStr() ? state.streak.count : 0;

  qs("#report-hero-num").textContent = `${thisWeek.c}もん せいかい！`;
  const diff = thisWeek.c - lastWeek.c;
  let sub;
  if (lastWeek.c === 0 && thisWeek.c === 0) sub = "きょうから はじめよう！";
  else if (diff > 0) sub = `先週より ${diff}もん おおい！すごい！`;
  else if (diff === 0) sub = "先週と おなじペースで がんばってるね！";
  else sub = "今週も コツコツ れんしゅうしよう！";
  qs("#report-hero-sub").textContent = sub;

  const statsWrap = qs("#report-hero-stats");
  statsWrap.replaceChildren();
  const pills = [
    { label: "あそんだ日", value: `${thisWeek.activeDays}／7日` },
    { label: "れんぞくきろく", value: `${streakAlive}日` },
    { label: "ずかん", value: `${speciesCaught()}／${STICKERS.length}しゅるい` }
  ];
  pills.forEach((pill) => {
    const el = document.createElement("div");
    el.className = "report-pill";
    const value = document.createElement("strong");
    value.textContent = pill.value;
    const label = document.createElement("span");
    label.textContent = pill.label;
    el.append(value, label);
    statsWrap.append(el);
  });

  renderReportBadgeList("report-practice", computeWeeklyPractice(), "こんしゅうは まちがえた問題も、20びょう以上かかった問題も ないよ！");

  qs("#report-footer").textContent = `これまでの るいけい せいかい数は ${state.totalCorrect}もん だよ`;
}

function renderWeaknessDojo() {
  const wrap = qs("#dojo-list");
  wrap.replaceChildren();
  const items = [];
  MODES.forEach((mode) => {
    if (mode === "pair") return;
    Object.entries(state.stats[mode] || {}).forEach(([key, stat]) => {
      const correct = Math.max(0, Number(stat?.c) || 0);
      const wrong = Math.max(0, Number(stat?.w) || 0);
      const time = Math.max(0, Number(stat?.t) || 0);
      const attempts = correct + wrong;
      if (!attempts || (wrong <= 0 && time < SLOW_ANSWER_MS)) return;
      const slow = time >= SLOW_ANSWER_MS;
      items.push({ mode, key, wrong, time, attempts, score: wrong / attempts * 100 + (slow ? 20 : 0) });
    });
  });
  // 苦手度の高い問題を集めたあと、カテゴリが続かないように出題順を混ぜる。
  items.sort((a, b) => b.score - a.score || b.wrong - a.wrong || b.time - a.time);
  const buckets = new Map();
  items.forEach((item) => {
    if (!buckets.has(item.mode)) buckets.set(item.mode, []);
    buckets.get(item.mode).push(item);
  });
  const mixedItems = [];
  let previousMode = "";
  while (mixedItems.length < items.length) {
    const available = [...buckets.entries()].filter(([mode, bucket]) => bucket.length && mode !== previousMode);
    const candidates = available.length ? available : [...buckets.entries()].filter(([, bucket]) => bucket.length);
    if (!candidates.length) break;
    const [mode, bucket] = candidates[Math.floor(Math.random() * candidates.length)];
    mixedItems.push(bucket.shift());
    previousMode = mode;
  }
  state.dojo.queue = mixedItems.slice(0, 30);
  state.dojo.current = 0;
  state.dojo.started = false;
  qs("#dojo-start").textContent = state.dojo.queue.length ? "復習スタート" : "復習する問題はないよ";
  qs("#dojo-start").disabled = !state.dojo.queue.length;
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "records-empty";
    empty.textContent = "まだ にがて問題の記録がないよ。まちがえたり、ゆっくり答えた問題がここに出てくるよ！";
    wrap.append(empty);
    return;
  }
  const note = document.createElement("p");
  note.className = "stats-day-summary";
  note.textContent = `${state.dojo.queue.length}問をカテゴリごちゃまぜで出題するよ。`;
  wrap.append(note);
  /* items.slice(0, 30).forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "dojo-row";
    const info = document.createElement("div");
    const category = document.createElement("span");
    category.className = "dojo-category";
    category.textContent = MODE_LABELS[item.mode];
    const problem = document.createElement("strong");
    problem.className = "dojo-problem";
    problem.textContent = formatProblemLabel(item.mode, item.key);
    const detail = document.createElement("span");
    detail.className = "dojo-detail";
    detail.textContent = [item.wrong ? `まちがえ ${item.wrong}回` : "", item.time >= SLOW_ANSWER_MS ? `回答 約${Math.round(item.time / 1000)}秒` : ""].filter(Boolean).join(" ／ ");
    info.append(category, problem, detail);
    const button = document.createElement("button");
    button.className = "quiet-button dojo-practice";
    button.type = "button";
    button.textContent = "この問題から";
    button.addEventListener("click", () => startDojoAt(index));
    row.append(info, button);
    wrap.append(row);
  }); */
}

function startDojoAt(index = 0) {
  if (!state.dojo.queue.length) return;
  state.dojo.current = index;
  state.dojo.started = true;
  qs("#dojo-start").classList.add("is-hidden");
  qs("#dojo-list").classList.add("is-hidden");
  qs("#dojo-quiz").classList.remove("is-hidden");
  showDojoQuestion();
}

function showDojoQuestion() {
  const item = state.dojo.queue[state.dojo.current];
  const parts = item.key.split(/[+-]/).map(Number);
  const answer = item.mode === "flash" ? Number(item.key) : (item.mode === "minus" || item.mode === "ice" ? parts[0] - parts[1] : parts[0] + parts[1]);
  qs("#dojo-category").textContent = MODE_LABELS[item.mode];
  qs("#dojo-problem").textContent = formatProblemLabel(item.mode, item.key);
  qs("#dojo-feedback").textContent = "こたえを えらんでね";
  qs("#dojo-next").classList.add("is-hidden");
  const choices = qs("#dojo-choices"); choices.replaceChildren();
  shuffle([...new Set([answer, answer - 1, answer + 1, answer + 2].filter((value) => value >= 0))]).slice(0, 4).forEach((value) => { const button = document.createElement("button"); button.className = "choice-card"; button.type = "button"; button.textContent = value; button.addEventListener("click", () => { choices.querySelectorAll("button").forEach((choice) => { choice.disabled = true; }); qs("#dojo-feedback").textContent = value === answer ? "せいかい！" : `こたえは ${answer} だよ`; qs("#dojo-next").classList.remove("is-hidden"); }); choices.append(button); });
}

qs("#dojo-start").addEventListener("click", () => startDojoAt(0));
qs("#dojo-next").addEventListener("click", nextDojoQuestion);

function renderStatsPanel() {
  renderStatsCalendar();
  renderStatsDayDetail();
  renderCumulativeWeakProblems();
}

// 「ゲージに入れるタブ」の表。行＝タブ、列＝ポケモンゲット／コインゲージ
function buildGaugeMatrix() {
  const wrap = qs("#gauge-matrix");
  if (!wrap) return;
  wrap.replaceChildren();

  const head = document.createElement("div");
  head.className = "gauge-row is-head";
  ["", "ポケモン", "コイン"].forEach((text) => {
    const cell = document.createElement("span");
    cell.textContent = text;
    head.append(cell);
  });
  wrap.append(head);

  SETTINGS_MODES.forEach((mode) => {
    const row = document.createElement("div");
    row.className = "gauge-row";
    const name = document.createElement("span");
    name.className = "gauge-row-name";
    name.textContent = MODE_LABELS[mode];
    row.append(name);

    [["catchModes", "catch"], ["coinModes", "coin"]].forEach(([key, prefix]) => {
      const cell = document.createElement("label");
      cell.className = "gauge-check";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = `set-${prefix}-${mode}`;
      input.checked = SETTINGS[key][mode] === true;
      input.setAttribute("aria-label", `${MODE_LABELS[mode]}を${prefix === "catch" ? "ポケモンゲット" : "コインゲージ"}に入れる`);
      input.addEventListener("change", () => {
        SETTINGS[key][mode] = input.checked;
        saveSettings();
        renderMission();
        renderCoinGauge();
      });
      cell.append(input);
      row.append(cell);
    });
    wrap.append(row);
  });
}

function renderSettingsPanel() {
  renderFireDirectionToggle();
  renderExplanationWaitToggle();
  MODES.forEach((mode) => {
    const catchInput = qs(`#set-catch-${mode}`);
    const coinInput = qs(`#set-coin-${mode}`);
    if (catchInput) catchInput.checked = catchEnabled(mode);
    if (coinInput) coinInput.checked = coinEnabled(mode);
  });
  qs("#set-catch").value = SETTINGS.catchStep;
  qs("#set-coin").value = SETTINGS.coinStep;
  qs("#set-flash-sec").value = (SETTINGS.flashMs / 1000).toFixed(1);
  qs("#set-flash-max").value = SETTINGS.flashMax;
  MODES.forEach((mode) => {
    qs(`#set-cap-${mode}`).value = missionCap(mode);
  });
  const total = missionTotal();
  const active = MODES.filter((mode) => missionCap(mode) > 0).length;
  qs("#mission-cap-total").textContent = `↑ 上の${MODES.length}タブぜんぶの合計：${total}問（必須${active}タブ）でミッションクリア`;
  renderCoinGauge();
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

bindSettingInput("#set-coin", "coinStep", () => {
  state.coinProgress = Math.min(state.coinProgress, SETTINGS.coinStep - 1);
  saveCoins();
  renderCoinGauge();
});

// タブごとのミッション問題数（0 = きょうは必須から外す）
MODES.forEach((mode) => {
  const input = qs(`#set-cap-${mode}`);
  input.addEventListener("change", () => {
    const value = Math.round(Number(input.value));
    if (!Number.isFinite(value) || value < 0 || value > 999) {
      input.value = missionCap(mode);
      return;
    }
    SETTINGS.missionCaps[mode] = value;
    input.value = value;
    saveSettings();
    checkMissionGoal();
    renderMission();
    renderSettingsPanel();
  });
});

// 表示時間は「秒」で入力してもらい、内部はミリ秒で持つ
qs("#set-flash-sec").addEventListener("change", () => {
  const input = qs("#set-flash-sec");
  const seconds = Number(input.value);
  if (!Number.isFinite(seconds) || seconds < 0.2 || seconds > 10) {
    input.value = (SETTINGS.flashMs / 1000).toFixed(1);
    return;
  }
  SETTINGS.flashMs = Math.round(seconds * 1000);
  input.value = (SETTINGS.flashMs / 1000).toFixed(1);
  saveSettings();
});

qs("#set-flash-max").addEventListener("change", () => {
  const input = qs("#set-flash-max");
  const max = Math.round(Number(input.value));
  if (!Number.isFinite(max) || max < 3 || max > 10) {
    input.value = SETTINGS.flashMax;
    return;
  }
  SETTINGS.flashMax = max;
  input.value = max;
  saveSettings();
  flashProblems = makeFlashProblems();
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
  [["日", "にち"], ["月", "げつ"], ["火", "か"], ["水", "すい"], ["木", "もく"], ["金", "きん"], ["土", "ど"]].forEach(([kanji, kana]) => {
    const head = document.createElement("div");
    head.className = "cal-head";
    const kanjiEl = document.createElement("span");
    kanjiEl.className = "cal-head-kanji";
    kanjiEl.textContent = kanji;
    const kanaEl = document.createElement("span");
    kanaEl.className = "cal-head-kana";
    kanaEl.textContent = kana;
    head.append(kanjiEl, kanaEl);
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
            : kind === "flash"
              ? [1318.5] // かみなりジムでブロックが出た合図
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

// レジの「じゃららん」のあとに、余韻の長い「チーン」を鳴らす。
function playCashRegisterSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const ctx = new AudioContext();
  const start = ctx.currentTime;
  const jingle = [659.25, 783.99, 987.77, 1318.5];

  jingle.forEach((frequency, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = index % 2 === 0 ? "triangle" : "square";
    osc.frequency.value = frequency;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const at = start + index * 0.075;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.11, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.14);
    osc.start(at);
    osc.stop(at + 0.16);
  });

  [1760, 2637].forEach((frequency, index) => {
    const bell = ctx.createOscillator();
    const gain = ctx.createGain();
    bell.type = "sine";
    bell.frequency.value = frequency;
    bell.connect(gain);
    gain.connect(ctx.destination);
    const at = start + 0.42;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.22 : 0.08, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.95);
    bell.start(at);
    bell.stop(at + 1);
  });

  setTimeout(() => ctx.close().catch(() => {}), 1500);
}

function praiseText() {
  const base = pick(PRAISES);
  return state.combo >= 2 ? `${base} 🔥${state.combo}れんぞく` : base;
}

function answerCountsForProgress(mode) {
  return !(mode === "bridge" && state.bridgeMogi.used);
}

function onCorrect(mode) {
  state.locked[mode] = true;
  M[mode].section.classList.add("is-answer-shown");
  stopChallengeTimer();
  const countsForProgress = answerCountsForProgress(mode);
  if (countsForProgress) {
    state.combo += 1;
    countSolvedQuestion();
    if (!state.challenge.ended) registerCorrect(mode);
  }
  const feedback = M[mode].feedback;
  feedback.className = "feedback is-good";
  feedback.textContent = countsForProgress ? praiseText() : "もぎで かんがえて できたね！ このもんだいは れんしゅうあつかいだよ";
  if (countsForProgress && state.coinJustEarned) {
    state.coinJustEarned = false;
    feedback.textContent = "💰 100円 ゲット！ ちょきんが ふえたよ！";
  }
  if (countsForProgress && state.streakBonusJust) {
    state.streakBonusJust = false;
    feedback.textContent = `🔥${state.streak.count}日れんぞくクリア！ ボーナス100円 ゲット！`;
  }
  prepareAnswerNextButton(mode);
  burstConfetti(Math.min(14 + Math.floor(state.combo / 5) * 10, 54));
  playTone("good", state.combo);
}

function onWrong(mode, _hint, correctValue) {
  const countsForProgress = answerCountsForProgress(mode);
  if (countsForProgress) state.combo = 0;
  state.locked[mode] = true;
  M[mode].section.classList.add("is-answer-shown");
  stopChallengeTimer();
  if (countsForProgress && !state.challenge.ended) registerWrong(mode);
  const feedback = M[mode].feedback;
  feedback.className = "feedback is-try";
  feedback.innerHTML = `ふせいかい！<br><span class="feedback-cheer">${pick(CHEERS)}</span>`;
  playTone("try");
  if (correctValue !== undefined) {
    const btn = M[mode].choices.querySelector(`[data-value="${correctValue}"]`);
    if (btn) btn.classList.add("is-correct");
  }
  prepareAnswerNextButton(mode);
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
  M[mode].next.disabled = !visible;
}

// JSアニメーションがない解説は、CSS演出と読む時間が終わるまで待つ。
const STATIC_EXPLANATION_WAIT_MS = {
  flash: 1900,
  pair: 1200,
  tenplus: 800,
  mogi: 1000
};

function shouldWaitForExplanation() {
  return SETTINGS.waitForExplanation && state.explainEnabled;
}

function clearExplanationReadyTimer() {
  if (!state.explanationReadyTimeoutId) return;
  clearTimeout(state.explanationReadyTimeoutId);
  state.explanationReadyTimeoutId = null;
}

function explanationFinished(mode, problem) {
  if (state.problem[mode] !== problem) return;
  setNextButton(mode, true);
}

function scheduleExplanationFinished(mode, problem, delayMs) {
  if (!shouldWaitForExplanation()) {
    explanationFinished(mode, problem);
    return;
  }
  clearExplanationReadyTimer();
  state.explanationReadyTimeoutId = setTimeout(() => {
    state.explanationReadyTimeoutId = null;
    explanationFinished(mode, problem);
  }, delayMs);
}

function prepareAnswerNextButton(mode) {
  if (!shouldWaitForExplanation()) {
    setNextButton(mode, true);
    return;
  }
  setNextButton(mode, false);
  const delay = STATIC_EXPLANATION_WAIT_MS[mode];
  if (delay) scheduleExplanationFinished(mode, state.problem[mode], delay);
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
  if (mode === "flash") resetFlashStage();
}

function clearNextQuestion() {
  if (state.nextQuestionTimeoutId) {
    clearTimeout(state.nextQuestionTimeoutId);
    state.nextQuestionTimeoutId = null;
  }
  clearExplanationReadyTimer();
  clearFlashTimers();
  clearBridgeReveal();
  closeBridgeMogiHelp();
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
  els.timeToggleLabel.textContent = state.timedEnabled ? "時間あり" : "時間なし";
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
  clearFlashTimers();
  els.flashReplay.classList.add("is-hidden");
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

function renderExplainToggle() {
  els.explainToggle.classList.toggle("is-on", state.explainEnabled);
  els.explainToggle.setAttribute("aria-pressed", String(state.explainEnabled));
  els.explainToggleLabel.textContent = state.explainEnabled ? "解説あり" : "解説なし";
  document.body.classList.toggle("no-explain", !state.explainEnabled);
}

function setExplainDisplay(enabled) {
  state.explainEnabled = enabled;
  localStorage.setItem("riku10v2-explain-enabled", String(enabled));
  renderExplainToggle();
}

function renderExplanationWaitToggle() {
  const enabled = SETTINGS.waitForExplanation;
  els.explanationWaitToggle.classList.toggle("is-on", enabled);
  els.explanationWaitToggle.setAttribute("aria-pressed", String(enabled));
  els.explanationWaitToggleLabel.textContent = enabled ? "解説待ち ON" : "解説待ち OFF";
}

function setWaitForExplanation(enabled) {
  SETTINGS.waitForExplanation = enabled;
  saveSettings();
  renderExplanationWaitToggle();
}

function renderFireDirectionToggle() {
  const enabled = SETTINGS.fireLeftToRight;
  els.fireDirectionToggle.classList.toggle("is-on", enabled);
  els.fireDirectionToggle.setAttribute("aria-pressed", String(enabled));
  els.fireDirectionToggleLabel.textContent = enabled ? "左→右固定 ON" : "左→右固定 OFF";
}

function setFireLeftToRight(enabled) {
  SETTINGS.fireLeftToRight = enabled;
  saveSettings();
  renderFireDirectionToggle();
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
  // かみなりジムはブロックを見せているあいだタイマーを止めるので、ここでは動かさない
  if (mode !== "flash") startChallengeTimer();
}

function nextQuestion(mode) {
  if (state.dojo?.started && state.activeMode === mode) {
    nextDojoQuestion();
    return;
  }
  M[mode].section.classList.remove("is-answer-shown");
  state.questionAt[mode] = Date.now();
  if (mode === "pair") nextPair();
  else if (mode === "tenplus") nextTenPlus();
  else if (mode === "flash") nextFlash();
  else if (mode === "mogi") nextMogi();
  else if (mode === "bridge") nextBridge();
  else if (mode === "minus") nextMinus();
  else if (mode === "ice") nextIce();
  else nextSimple();
}

function nextDojoQuestion() {
  state.dojo.current += 1;
  if (state.dojo.current >= state.dojo.queue.length) {
    state.dojo.started = false;
    stopChallengeTimer();
    switchMode("dojo");
    qs("#dojo-start").classList.remove("is-hidden");
    qs("#dojo-quiz").classList.add("is-hidden");
    const wrap = qs("#dojo-list");
    wrap.replaceChildren();
    const done = document.createElement("p");
    done.className = "dojo-complete";
    done.textContent = "にがて問題の復習、おわり！よくがんばったね！";
    wrap.append(done);
    qs("#dojo-start").textContent = "もういちど復習する";
    qs("#dojo-start").disabled = false;
    return;
  }
  showDojoQuestion();
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

/* ---------- かみなりジム（フラッシュ） ---------- */

const FLASH_MAX_REPLAYS = 2;

function clearFlashTimers() {
  state.flash.timers.forEach(clearTimeout);
  state.flash.timers = [];
}

function flashLater(fn, ms) {
  state.flash.timers.push(setTimeout(fn, ms));
}

// n にいちばん近い「きりのいい数（5 か 10）」まであといくつ足りないか。
// 4 → 5より1こすくない、9 → 10より1こすくない、のように見せるために使う
function flashShortOf(n) {
  if (n === 3 || n === 4) return { anchor: 5, gap: 5 - n };
  if (n === 8 || n === 9) return { anchor: 10, gap: 10 - n };
  return null;
}

// 10マス（5×2）に n 個。split=true で上段5個を緑・下段のあまりを赤にして「5といくつ」を見せる。
// missingTo を渡すと、そこまでの足りないマスを点線で見せる（「あと1こで10」の可視化）
function renderFlashFrame(container, n, { counted = false, split = false, missingTo = 0 } = {}) {
  container.replaceChildren();
  for (let index = 0; index < 10; index += 1) {
    const cell = document.createElement("div");
    cell.className = "frame-cell";
    if (index < n) {
      cell.classList.add("is-filled");
      if (split) {
        if (index >= 5) cell.classList.add("is-second-row");
        cell.style.setProperty("--pop-delay", `${index * 45}ms`);
        cell.classList.add("is-split-pop");
      }
      if (counted) {
        cell.classList.add("is-counted");
        cell.dataset.count = String(index + 1);
      }
    } else if (index < missingTo) {
      cell.classList.add("is-missing");
    }
    container.append(cell);
  }
}

function resetFlashStage() {
  clearFlashTimers();
  if (!els.flashStage) return;
  els.flashStage.classList.remove("is-ready", "is-showing", "is-revealed");
  els.flashVeil.textContent = "よ〜い…";
  els.flashExplain.classList.add("is-hidden");
  els.flashExplain.textContent = "";
  els.flashReplay.classList.add("is-hidden");
  els.flashFrame.replaceChildren();
  M.flash.choices.classList.add("is-dim");
}

// ブロックをパッと見せて隠す。隠し終わってはじめて答えを選べるようになる。
// 60秒チャレンジのタイマーは「見ているあいだ」は止めて、考えはじめてから動かす
function showFlash(problem) {
  clearFlashTimers();
  stopChallengeTimer();
  state.locked.flash = true;
  M.flash.choices.classList.add("is-dim");
  els.flashReplay.classList.add("is-hidden");
  els.flashStage.classList.remove("is-showing", "is-revealed");
  els.flashStage.classList.add("is-ready");
  els.flashVeil.textContent = "よ〜い…";
  renderFlashFrame(els.flashFrame, problem.n);

  flashLater(() => {
    els.flashStage.classList.remove("is-ready");
    els.flashStage.classList.add("is-showing");
    playTone("flash");

    flashLater(() => {
      els.flashStage.classList.remove("is-showing");
      els.flashVeil.textContent = "？";
      state.flash.shown = true;
      // 考えはじめた時点から計測する（フラッシュを見ている時間は含めない）
      state.questionAt.flash = Date.now();
      if (!(state.timedEnabled && state.challenge.ended)) {
        state.locked.flash = false;
        M.flash.choices.classList.remove("is-dim");
        if (state.flash.replays < FLASH_MAX_REPLAYS) els.flashReplay.classList.remove("is-hidden");
        M.flash.feedback.className = "feedback";
        M.flash.feedback.textContent = "なんこ だった？";
        if (state.activeMode === "flash") startChallengeTimer();
      }
    }, SETTINGS.flashMs);
  }, 700);
}

function flashExplainHtml(n) {
  let main;
  if (n < 5) main = `うえのだんに <strong>${n}</strong>こ`;
  else if (n === 5) main = `うえのだんが ちょうど <strong>5</strong>こ`;
  else if (n === 10) main = `<span class="eq-green">5</span> と <span class="eq-red">5</span> で <strong>10</strong>`;
  else main = `うえのだん <span class="eq-green">5</span>こ と したのだん <span class="eq-red">${n - 5}</span>こ で <strong>${n}</strong>`;

  // 「あと1こで10」のような、きりのいい数との差でも見えるようにする
  const short = flashShortOf(n);
  let sub = "";
  if (n === 10) sub = "10マス ぜんぶ うまったね";
  else if (short) sub = `<strong>${short.anchor}</strong>より <strong>${short.gap}</strong>こ すくないだけ！ あと${short.gap}こで ${short.anchor}`;

  return sub ? `${main}<span class="flash-explain-sub">${sub}</span>` : main;
}

function nextFlash() {
  if (!guardNext("flash")) return;
  const p = pickWeighted("flash", flashProblems, state.lastKey.flash);
  state.problem.flash = p;
  state.lastKey.flash = flashKey(p);
  state.flash.replays = 0;
  state.flash.shown = false;
  els.flashExplain.classList.add("is-hidden");
  els.flashExplain.textContent = "";
  setNextButton("flash", false);
  M.flash.feedback.className = "feedback";
  M.flash.feedback.textContent = "よく みててね";
  renderChoiceButtons(M.flash.choices, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], (value, button) => {
    chooseFlash(value, button, p);
  });
  // タイマーは showFlash がブロックを隠したあとに動きはじめる
  showFlash(p);
}

function chooseFlash(value, button, problem = state.problem.flash) {
  if (state.locked.flash || !problem) return;
  clearFlashTimers();
  const correct = value === problem.n;
  recordAnswer("flash", problem, correct);
  button.classList.add(correct ? "is-correct" : "is-wrong");
  els.flashReplay.classList.add("is-hidden");
  els.flashStage.classList.remove("is-ready");
  els.flashStage.classList.add("is-showing", "is-revealed");
  els.flashVeil.textContent = "";
  // 答え合わせでは「5のかたまり＋いくつ」に塗り分け、5・10まで足りないマスは点線で見せる
  const short = state.explainEnabled ? flashShortOf(problem.n) : null;
  renderFlashFrame(els.flashFrame, problem.n, {
    counted: state.explainEnabled,
    split: true,
    missingTo: short ? short.anchor : 0
  });
  if (state.explainEnabled) {
    els.flashExplain.innerHTML = flashExplainHtml(problem.n);
    els.flashExplain.classList.remove("is-hidden");
  }
  if (correct) {
    onCorrect("flash");
  } else {
    onWrong("flash", null, problem.n);
  }
}

/* ---------- しゅぎょう（たしざん） ---------- */

function makeSimpleFollowUp(problem) {
  if (problem.a + problem.b !== 10) return null;
  const changedPart = problem.b > 1 ? "b" : "a";
  return {
    a: problem.a - (changedPart === "a" ? 1 : 0),
    b: problem.b - (changedPart === "b" ? 1 : 0),
    compareFrom: { a: problem.a, b: problem.b },
    changedPart
  };
}

function renderSimpleComparison(problem) {
  const before = problem.compareFrom;
  if (!before) return;
  const changedPart = problem.changedPart;
  const beforePart = before[changedPart];
  const afterPart = problem[changedPart];
  const changedA = changedPart === "a";
  const changedB = changedPart === "b";

  els.simpleCompare.innerHTML =
    `<div class="simple-compare-equations" aria-hidden="true">` +
      `<span class="${changedA ? "is-before" : ""}">${before.a}</span><span>＋</span><span class="${changedB ? "is-before" : ""}">${before.b}</span><span>＝</span><span class="is-before">10</span>` +
      `<span class="${changedA ? "is-arrow" : ""}">${changedA ? "↓" : ""}</span><span></span><span class="${changedB ? "is-arrow" : ""}">${changedB ? "↓" : ""}</span><span></span><span class="is-arrow">↓</span>` +
      `<span class="${changedA ? "is-after" : ""}">${problem.a}</span><span>＋</span><span class="${changedB ? "is-after" : ""}">${problem.b}</span><span>＝</span><span class="is-after">9</span>` +
    `</div>` +
    `<p><strong>${beforePart} → ${afterPart}</strong> に 1つ へったから、<br>こたえも <strong>10 → 9</strong> に 1つ へったね。</p>`;
  els.simpleCompare.setAttribute(
    "aria-label",
    `${before.a}たす${before.b}は10。${problem.a}たす${problem.b}は9。${beforePart}から${afterPart}に1つへったから、こたえも10から9に1つへったね。`
  );
  els.simpleCompare.classList.remove("is-hidden");
}

const SIMPLE_JOIN_PAUSE_MS = 900;
const SIMPLE_JOIN_MOVE_MS = 760;
const SIMPLE_JOIN_STAGGER_MS = 130;

function renderSimpleSourceDots(container, count, side) {
  container.replaceChildren();
  for (let index = 0; index < 10; index += 1) {
    const cell = document.createElement("div");
    cell.className = "frame-cell";
    if (index < count) {
      cell.classList.add("is-block", side === "left" ? "is-filled" : "is-guest");
    }
    container.append(cell);
  }
}

function prepareSimpleJoin(problem) {
  els.simpleLeftLabel.textContent = problem.a;
  els.simpleRightLabel.textContent = problem.b;
  renderSimpleSourceDots(els.simpleLeftDots, problem.a, "left");
  renderSimpleSourceDots(els.simpleRightDots, problem.b, "right");
  renderTenFrame(els.simpleFrame, 0, 0);
  els.simpleFrame.classList.remove("is-join-complete", "is-ten-complete");
  els.simpleFrame.setAttribute("aria-label", `${problem.a}こと${problem.b}をあわせる10マスのボード`);
  els.simpleJoinArrow.textContent = "↓ 下で あわせよう";
  els.simpleJoinText.textContent = "";
}

function completeSimpleJoin(problem) {
  const answer = problem.a + problem.b;
  [...els.simpleLeftDots.children, ...els.simpleRightDots.children]
    .filter((cell) => cell.classList.contains("is-block"))
    .forEach((cell) => {
      cell.classList.remove("is-block", "is-filled", "is-guest");
      cell.classList.add("is-source-vacated");
    });
  renderTenFrame(els.simpleFrame, problem.a, problem.b, true);
  els.simpleFrame.classList.add(answer === 10 ? "is-ten-complete" : "is-join-complete");
  els.simpleJoinArrow.textContent = "↓ あわせると";
  els.simpleJoinText.textContent = `${problem.a}こと ${problem.b}こを あわせて ${answer}こ！`;
  els.simpleFrame.setAttribute("aria-label", `${problem.a}こと${problem.b}こをあわせて${answer}こ`);
}

function animateSimpleJoin(problem) {
  const leftDots = [...els.simpleLeftDots.children].filter((cell) => cell.classList.contains("is-block"));
  const rightDots = [...els.simpleRightDots.children].filter((cell) => cell.classList.contains("is-block"));
  const dots = [...leftDots, ...rightDots];
  const cells = [...els.simpleFrame.children].slice(0, dots.length);
  const dotRects = dots.map((dot) => dot.getBoundingClientRect());
  const cellRects = cells.map((cell) => cell.getBoundingClientRect());
  const canAnimate =
    typeof document.createElement("div").animate === "function" &&
    dots.length === cells.length &&
    dotRects.every((rect) => rect.width > 0) &&
    cellRects.every((rect) => rect.width > 0);

  els.simpleJoinArrow.textContent = "↓ あわせると";
  els.simpleJoinText.textContent = `${problem.a}こと ${problem.b}こを あわせて ${problem.a + problem.b}こ！`;

  if (!canAnimate) {
    completeSimpleJoin(problem);
    scheduleExplanationFinished("simple", problem, 650);
    return;
  }

  setNextButton("simple", false);
  let landed = 0;
  dots.forEach((dot, index) => {
    const from = dotRects[index];
    const to = cellRects[index];
    const cell = cells[index];
    const flyer = document.createElement("div");
    flyer.className = `fly-square${index < leftDots.length ? " is-green" : ""}`;
    flyer.style.left = `${from.left}px`;
    flyer.style.top = `${from.top}px`;
    flyer.style.width = `${from.width}px`;
    flyer.style.height = `${from.height}px`;
    els.flyLayer.append(flyer);
    dot.classList.remove("is-block", "is-filled", "is-guest");
    dot.classList.add("is-source-vacated");

    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const scale = to.width / from.width;
    const animation = flyer.animate(
      [
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 1 }
      ],
      {
        duration: SIMPLE_JOIN_MOVE_MS,
        delay: SIMPLE_JOIN_PAUSE_MS + index * SIMPLE_JOIN_STAGGER_MS,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "backwards"
      }
    );

    animation.onfinish = () => {
      flyer.remove();
      if (state.problem.simple !== problem) return;
      if (index < leftDots.length) {
        cell.classList.add("is-filled", "is-pop");
      } else {
        cell.classList.add("is-friend-filled", "is-landed");
        cell.style.setProperty("--pop-delay", "0ms");
      }
      landed += 1;
      if (landed === cells.length) {
        const answer = problem.a + problem.b;
        els.simpleFrame.classList.add(answer === 10 ? "is-ten-complete" : "is-join-complete");
        els.simpleFrame.setAttribute("aria-label", `${problem.a}こと${problem.b}こをあわせて${answer}こ`);
        scheduleExplanationFinished("simple", problem, 650);
      }
    };
  });
}

function nextSimple() {
  if (!guardNext("simple")) return;
  els.flyLayer.replaceChildren();
  const p = state.simpleFollowUp || pickWeighted("simple", simpleProblems, state.lastKey.simple);
  state.simpleFollowUp = null;
  state.problem.simple = p;
  state.lastKey.simple = abKey(p);
  els.simpleEquation.classList.remove("is-solved");
  els.simpleEquation.textContent = `${p.a} + ${p.b}`;
  els.simpleCompare.classList.add("is-hidden");
  els.simpleCompare.replaceChildren();
  els.simpleCompare.removeAttribute("aria-label");
  M.simple.feedback.className = "feedback";
  M.simple.feedback.textContent = "こたえを えらんでね";
  setNextButton("simple", false);
  // 左右を別のあつまりで見せ、答え合わせで下の10マスへ合流させる
  prepareSimpleJoin(p);
  renderChoiceButtons(M.simple.choices, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], (value, button) => {
    chooseSimple(value, button, p);
  });
  if (state.activeMode === "simple") startChallengeTimer();
}

function chooseSimple(value, button, problem = state.problem.simple) {
  if (state.locked.simple) return;
  const answer = problem.a + problem.b;
  const correct = value === answer;
  recordAnswer("simple", problem, correct);
  state.simpleFollowUp = makeSimpleFollowUp(problem);
  button.classList.add(correct ? "is-correct" : "is-wrong");
  els.simpleEquation.innerHTML = `<span class="eq-green">${problem.a}</span><span> + </span><span class="eq-red">${problem.b}</span><span> = ${answer}</span>`;
  els.simpleEquation.classList.add("is-solved");
  if (correct) {
    onCorrect("simple");
  } else {
    onWrong("simple", null, answer);
  }
  if (state.explainEnabled) {
    animateSimpleJoin(problem);
    renderSimpleComparison(problem);
  } else {
    completeSimpleJoin(problem);
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
  // 出題中は base だけ埋めて「あといくつ」を数えられるように
  renderTenFrame(els.pairFrame, state.problem.pair.base, 0);
  renderChoiceButtons(M.pair.choices, [1, 2, 3, 4, 5, 6, 7, 8, 9], choosePair);
  if (state.activeMode === "pair") startChallengeTimer();
}

function choosePair(value, button) {
  if (state.locked.pair) return;
  const problem = state.problem.pair;
  const correct = value === problem.friend;
  recordAnswer("pair", problem, correct);
  button.classList.add(correct ? "is-correct" : "is-wrong");

  els.pairNumber.innerHTML = `<span class="eq-green">${problem.base}</span><span> + </span><span class="eq-red">${problem.friend}</span><span> = 10</span>`;
  els.pairNumber.parentElement.classList.add("is-solved-equation");
  if (state.explainEnabled) {
    renderTenFrame(els.pairFrame, problem.base, problem.friend, true);
  }
  if (correct) {
    els.pairNumber.setAttribute("aria-label", `${problem.base} + ${problem.friend} = 10`);
    if (problem.showReverse && state.explainEnabled) {
      els.pairReverseEquation.innerHTML = `<span class="eq-green">${problem.friend}</span><span> + </span><span class="eq-red">${problem.base}</span><span> = 10</span>`;
      renderTenFrame(els.pairReverseFrame, problem.friend, problem.base, true);
      els.pairReverseSection.classList.remove("is-hidden");
    }
    onCorrect("pair");
  } else {
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

/* ---------- もぎダンジョン（じぶんで10づくり） ---------- */

const mogiDrag = { active: false, side: "", index: -1, color: "", flyer: null, cell: null, offsetX: 0, offsetY: 0, homeLeft: 0, homeTop: 0 };

function mogiFrame(side) {
  return side === "left" ? els.mogiLeftFrame : els.mogiRightFrame;
}

function mogiCount(side) {
  return state.mogi.slots[side].filter(Boolean).length;
}

function renderMogiFrame(side) {
  const slots = state.mogi.slots[side];
  const container = mogiFrame(side);
  container.replaceChildren();
  slots.forEach((color) => {
    const cell = document.createElement("div");
    cell.className = "frame-cell";
    if (color) {
      // ブロックは生まれた側の色（左=緑・右=赤）のまま行き来する
      cell.classList.add("is-block", color === "green" ? "is-filled" : "is-guest");
    }
    container.append(cell);
  });
}

// 取られたがわの数字は出さない（問題の数と変わって混乱するので）。
// ふえていくがわだけ、いまの数を見せて「あといくつで10」を応援する
function renderMogiLabel(labelEl, side, original) {
  const count = mogiCount(side);
  labelEl.textContent = count >= original ? count : "";
}

function renderMogiBoard() {
  const problem = state.problem.mogi;
  renderMogiFrame("left");
  renderMogiFrame("right");
  renderMogiLabel(els.mogiLeftLabel, "left", problem.big);
  renderMogiLabel(els.mogiRightLabel, "right", problem.small);
}

function mogiDragStart(event, side) {
  if (state.activeMode !== "mogi" || state.mogi.phase !== "build" || state.locked.mogi) return;
  if (mogiDrag.active) return;
  const cell = event.target.closest(".frame-cell.is-block");
  if (!cell) return;
  event.preventDefault();
  const rect = cell.getBoundingClientRect();
  const flyer = document.createElement("div");
  flyer.className = "fly-square";
  if (cell.classList.contains("is-filled")) flyer.classList.add("is-green");
  flyer.style.left = `${rect.left}px`;
  flyer.style.top = `${rect.top}px`;
  flyer.style.width = `${rect.width}px`;
  flyer.style.height = `${rect.height}px`;
  els.flyLayer.append(flyer);
  cell.classList.add("is-drag-source");
  mogiDrag.active = true;
  mogiDrag.side = side;
  mogiDrag.index = [...cell.parentElement.children].indexOf(cell);
  mogiDrag.color = cell.classList.contains("is-filled") ? "green" : "red";
  mogiDrag.flyer = flyer;
  mogiDrag.cell = cell;
  mogiDrag.offsetX = event.clientX - rect.left;
  mogiDrag.offsetY = event.clientY - rect.top;
  mogiDrag.homeLeft = rect.left;
  mogiDrag.homeTop = rect.top;
}

function mogiDragMove(event) {
  if (!mogiDrag.active) return;
  event.preventDefault();
  mogiDrag.flyer.style.left = `${event.clientX - mogiDrag.offsetX}px`;
  mogiDrag.flyer.style.top = `${event.clientY - mogiDrag.offsetY}px`;
}

function mogiSnapBack(flyer, homeLeft, homeTop) {
  const dx = homeLeft - parseFloat(flyer.style.left);
  const dy = homeTop - parseFloat(flyer.style.top);
  if (typeof flyer.animate !== "function") {
    flyer.remove();
    return;
  }
  const animation = flyer.animate(
    [{ transform: "translate(0, 0)" }, { transform: `translate(${dx}px, ${dy}px)` }],
    { duration: 180, easing: "ease-out", fill: "forwards" }
  );
  animation.onfinish = () => flyer.remove();
}

function takeMogiDrag() {
  const grabbed = { flyer: mogiDrag.flyer, cell: mogiDrag.cell, side: mogiDrag.side, index: mogiDrag.index, color: mogiDrag.color, homeLeft: mogiDrag.homeLeft, homeTop: mogiDrag.homeTop };
  mogiDrag.active = false;
  mogiDrag.flyer = null;
  mogiDrag.cell = null;
  if (grabbed.cell) grabbed.cell.classList.remove("is-drag-source");
  return grabbed;
}

function mogiDragEnd(event) {
  if (!mogiDrag.active) return;
  const { flyer, side: from, index, color, homeLeft, homeTop } = takeMogiDrag();
  const to = from === "left" ? "right" : "left";
  const rect = mogiFrame(to).getBoundingClientRect();
  const pad = 24;
  const inTarget =
    event.clientX >= rect.left - pad &&
    event.clientX <= rect.right + pad &&
    event.clientY >= rect.top - pad &&
    event.clientY <= rect.bottom + pad;
  const landSlot = state.mogi.slots[to].indexOf(null);
  if (state.mogi.phase !== "build" || !inTarget || landSlot === -1) {
    mogiSnapBack(flyer, homeLeft, homeTop);
    return;
  }
  flyer.remove();
  // 取ったマスは穴のまま残す（左詰めすると子どもが混乱する）
  state.mogi.slots[from][index] = null;
  state.mogi.slots[to][landSlot] = color;
  playTone("click");
  renderMogiBoard();
  const landed = mogiFrame(to).children[landSlot];
  if (landed) landed.classList.add("is-pop");
  if (mogiCount(to) === 10) mogiTenComplete(to);
}

function mogiDragCancel() {
  if (!mogiDrag.active) return;
  const { flyer, homeLeft, homeTop } = takeMogiDrag();
  mogiSnapBack(flyer, homeLeft, homeTop);
}

// さくらんぼ図つきの式。10を作った側の反対の数を「わけた数」として2つの丸にわける
function renderMogiEquation(problem, answer = null) {
  const total = problem.big + problem.small;
  const splitLeft = state.mogi.doneSide === "right"; // 右で10を作った→左のかずをわけた
  const splitValue = splitLeft ? problem.big : problem.small;
  const keepValue = splitLeft ? problem.small : problem.big;
  const moved = 10 - keepValue;
  const rest = total - 10;
  // 丸の並びは下のブロック図と同じ向きにする:
  // 左で10を作ったなら「うつした分」が左、右で10を作ったなら「のこり」が左
  const movedBall = `<span class="cherry-ball ball-moved">${moved}</span>`;
  const restBall = `<span class="cherry-ball ball-rest">${rest}</span>`;
  const balls = state.mogi.doneSide === "left" ? movedBall + restBall : restBall + movedBall;
  const cherry =
    `<span class="cherry-group"><span class="cherry-num">${splitValue}</span>` +
    `<span class="cherry-arms"></span>` +
    `<span class="cherry-row">${balls}</span></span>`;
  const left = splitLeft ? cherry : `<span>${problem.big}</span>`;
  const right = splitLeft ? `<span>${problem.small}</span>` : cherry;
  els.mogiEquation.innerHTML = `${left}<span>+</span>${right}${answer !== null ? `<span>=</span><span>${answer}</span>` : ""}`;
}

function mogiTenComplete(side) {
  state.mogi.phase = "sum";
  state.mogi.doneSide = side;
  mogiFrame(side).classList.add("is-ten-complete");
  playTone("good");
  const problem = state.problem.mogi;
  M.mogi.feedback.className = "feedback";
  M.mogi.feedback.textContent = `10を つくった！ ${problem.big} + ${problem.small} は いくつかな？`;
  renderChoiceButtons(M.mogi.choices, [11, 12, 13, 14, 15, 16, 17, 18, 19], (value, button) => {
    chooseMogiSum(value, button, problem);
  });
}

function chooseMogiSum(value, button, problem = state.problem.mogi) {
  if (state.locked.mogi || state.mogi.phase !== "sum") return;
  const answer = problem.big + problem.small;
  const rest = answer - 10;
  const correct = value === answer;
  recordAnswer("mogi", problem, correct);
  state.mogi.phase = "done";
  button.classList.add(correct ? "is-correct" : "is-wrong");
  if (state.explainEnabled) {
    // かいせつ: さくらんぼ図と、のこりブロックの番号バッジを見せる
    renderMogiEquation(problem, answer);
    const splitValue = state.mogi.doneSide === "right" ? problem.big : problem.small;
    const moved = 10 - (state.mogi.doneSide === "right" ? problem.small : problem.big);
    // 文もさくらんぼの丸と同じ並びで読み上げる
    const [firstPart, secondPart] = state.mogi.doneSide === "left" ? [moved, rest] : [rest, moved];
    els.mogiChain.textContent = `${splitValue}を ${firstPart} と ${secondPart} に わけたね`;
    els.mogiChain.classList.add("is-solved");
    // のこりがわの番号はオレンジ、10がわに「うつした分」の番号は青。
    // さくらんぼの丸の色（ball-rest / ball-moved）と対応させる
    const doneSide = state.mogi.doneSide;
    const restSide = doneSide === "left" ? "right" : "left";
    [...mogiFrame(restSide).children].filter((cell) => cell.classList.contains("is-block")).forEach((cell, index) => {
      cell.classList.add("is-counted", "count-rest");
      cell.dataset.count = index + 1;
    });
    // 10がわは、うつしてきたブロック（生まれ色が違うもの）だけに1から振る
    const nativeClass = doneSide === "left" ? "is-filled" : "is-guest";
    [...mogiFrame(doneSide).children]
      .filter((cell) => cell.classList.contains("is-block") && !cell.classList.contains(nativeClass))
      .forEach((cell, index) => {
        cell.classList.add("is-counted", "count-moved");
        cell.dataset.count = index + 1;
      });
  } else {
    els.mogiEquation.textContent = `${problem.big} + ${problem.small} = ${answer}`;
  }
  els.mogiEquation.classList.add("is-solved");
  if (correct) {
    onCorrect("mogi");
  } else {
    onWrong("mogi", null, answer);
  }
}

function nextMogi() {
  if (!guardNext("mogi")) return;
  els.flyLayer.replaceChildren();
  const p = pickWeighted("mogi", bridgeProblems, state.lastKey.mogi);
  state.problem.mogi = p;
  state.lastKey.mogi = problemKey(p);
  const makeSlots = (n, color) => Array.from({ length: 10 }, (_, i) => (i < n ? color : null));
  state.mogi = { phase: "build", doneSide: "", slots: { left: makeSlots(p.big, "green"), right: makeSlots(p.small, "red") } };
  els.mogiEquation.textContent = `${p.big} + ${p.small}`;
  els.mogiEquation.classList.remove("is-solved");
  els.mogiChain.textContent = "";
  els.mogiChain.classList.remove("is-solved");
  els.mogiLeftFrame.classList.remove("is-ten-complete");
  els.mogiRightFrame.classList.remove("is-ten-complete");
  M.mogi.feedback.className = "feedback";
  M.mogi.feedback.textContent = "ブロックを うごかして 10 を つくろう";
  setNextButton("mogi", false);
  M.mogi.choices.replaceChildren();
  renderMogiBoard();
  if (state.activeMode === "mogi") startChallengeTimer();
}

[["left", els.mogiLeftFrame], ["right", els.mogiRightFrame]].forEach(([side, frame]) => {
  frame.addEventListener("pointerdown", (event) => mogiDragStart(event, side));
});
window.addEventListener("pointermove", mogiDragMove, { passive: false });
window.addEventListener("pointerup", mogiDragEnd);
window.addEventListener("pointercancel", mogiDragCancel);

/* ---------- ほのお内の「もぎで考える」補助 ---------- */

const bridgeMogiDrag = {
  active: false,
  side: "",
  index: -1,
  color: "",
  flyer: null,
  cell: null,
  offsetX: 0,
  offsetY: 0,
  homeLeft: 0,
  homeTop: 0
};

function bridgeMogiFrame(side) {
  return side === "left" ? els.bridgeMogiLeftFrame : els.bridgeMogiRightFrame;
}

function bridgeMogiCount(side) {
  return state.bridgeMogi.slots[side].filter(Boolean).length;
}

function renderBridgeMogiFrame(side) {
  const frame = bridgeMogiFrame(side);
  frame.replaceChildren();
  state.bridgeMogi.slots[side].forEach((color) => {
    const cell = document.createElement("div");
    cell.className = "frame-cell";
    if (color) {
      cell.classList.add("is-block", color === "green" ? "is-filled" : "is-guest");
    }
    frame.append(cell);
  });
  frame.classList.toggle("is-ten-complete", state.bridgeMogi.solved && bridgeMogiCount(side) === 10);
}

function renderBridgeMogiLabel(label, side) {
  const count = bridgeMogiCount(side);
  label.textContent = count >= state.bridgeMogi.original[side] ? count : "";
}

function renderBridgeMogiHelp() {
  renderBridgeMogiFrame("left");
  renderBridgeMogiFrame("right");
  renderBridgeMogiLabel(els.bridgeMogiLeftLabel, "left");
  renderBridgeMogiLabel(els.bridgeMogiRightLabel, "right");
}

// ヒントを使った問題は練習扱い。初回だけ、未完了の炎ミッションを1問戻す。
function applyBridgeMogiMissionPenalty() {
  rolloverDaily();
  if (state.daily.done) return false;
  const used = Math.min(state.daily.bridgeUsed || 0, missionCap("bridge"));
  if (used <= 0) return false;
  state.daily.bridgeUsed = used - 1;
  saveDaily();
  renderMission();
  return true;
}

function resetBridgeMogiHelp() {
  const problem = state.problem.bridge;
  if (!problem) return;
  const firstUse = !state.bridgeMogi.used;
  const missionReduced = firstUse && applyBridgeMogiMissionPenalty();
  clearBridgeMogiDrag();
  const left = Number.isFinite(problem.displayA) ? problem.displayA : problem.big;
  const right = Number.isFinite(problem.displayB) ? problem.displayB : problem.small;
  const makeSlots = (count, color) => Array.from({ length: 10 }, (_, index) => (index < count ? color : null));
  state.bridgeMogi = {
    open: true,
    used: true,
    solved: false,
    original: { left, right },
    slots: { left: makeSlots(left, "green"), right: makeSlots(right, "red") }
  };
  els.bridgeMogiHelper.classList.remove("is-hidden");
  els.bridgeMogiHelpToggle.setAttribute("aria-expanded", "true");
  els.bridgeMogiHelpToggle.textContent = "もぎヒントを とじる";
  els.bridgeMogiHelpFeedback.textContent = missionReduced
    ? "ヒントを つかったので、ミッションが 1もん もどったよ。ブロックを うごかして 10を つくろう"
    : "ブロックを うごかして 10を つくろう";
  renderBridgeMogiHelp();
}

function clearBridgeMogiDrag() {
  if (!bridgeMogiDrag.active) return;
  bridgeMogiDrag.flyer?.remove();
  bridgeMogiDrag.cell?.classList.remove("is-drag-source");
  bridgeMogiDrag.active = false;
  bridgeMogiDrag.flyer = null;
  bridgeMogiDrag.cell = null;
}

function closeBridgeMogiHelp() {
  clearBridgeMogiDrag();
  state.bridgeMogi.open = false;
  els.bridgeMogiHelper.classList.add("is-hidden");
  els.bridgeMogiHelpToggle.setAttribute("aria-expanded", "false");
  els.bridgeMogiHelpToggle.textContent = "わからない → もぎで考える";
}

function toggleBridgeMogiHelp() {
  if (state.locked.bridge || !state.problem.bridge) return;
  if (state.bridgeMogi.open) closeBridgeMogiHelp();
  else resetBridgeMogiHelp();
}

function bridgeMogiDragStart(event, side) {
  if (
    state.activeMode !== "bridge" ||
    !state.bridgeMogi.open ||
    state.bridgeMogi.solved ||
    state.locked.bridge ||
    bridgeMogiDrag.active
  ) return;
  const cell = event.target.closest(".frame-cell.is-block");
  if (!cell) return;
  event.preventDefault();
  const rect = cell.getBoundingClientRect();
  const flyer = document.createElement("div");
  flyer.className = `fly-square${cell.classList.contains("is-filled") ? " is-green" : ""}`;
  flyer.style.left = `${rect.left}px`;
  flyer.style.top = `${rect.top}px`;
  flyer.style.width = `${rect.width}px`;
  flyer.style.height = `${rect.height}px`;
  els.flyLayer.append(flyer);
  cell.classList.add("is-drag-source");
  bridgeMogiDrag.active = true;
  bridgeMogiDrag.side = side;
  bridgeMogiDrag.index = [...cell.parentElement.children].indexOf(cell);
  bridgeMogiDrag.color = cell.classList.contains("is-filled") ? "green" : "red";
  bridgeMogiDrag.flyer = flyer;
  bridgeMogiDrag.cell = cell;
  bridgeMogiDrag.offsetX = event.clientX - rect.left;
  bridgeMogiDrag.offsetY = event.clientY - rect.top;
  bridgeMogiDrag.homeLeft = rect.left;
  bridgeMogiDrag.homeTop = rect.top;
}

function bridgeMogiDragMove(event) {
  if (!bridgeMogiDrag.active) return;
  event.preventDefault();
  bridgeMogiDrag.flyer.style.left = `${event.clientX - bridgeMogiDrag.offsetX}px`;
  bridgeMogiDrag.flyer.style.top = `${event.clientY - bridgeMogiDrag.offsetY}px`;
}

function takeBridgeMogiDrag() {
  const grabbed = {
    flyer: bridgeMogiDrag.flyer,
    cell: bridgeMogiDrag.cell,
    side: bridgeMogiDrag.side,
    index: bridgeMogiDrag.index,
    color: bridgeMogiDrag.color,
    homeLeft: bridgeMogiDrag.homeLeft,
    homeTop: bridgeMogiDrag.homeTop
  };
  bridgeMogiDrag.active = false;
  bridgeMogiDrag.flyer = null;
  bridgeMogiDrag.cell = null;
  grabbed.cell?.classList.remove("is-drag-source");
  return grabbed;
}

function completeBridgeMogiHelp(side) {
  state.bridgeMogi.solved = true;
  const other = side === "left" ? "right" : "left";
  const rest = bridgeMogiCount(other);
  bridgeMogiFrame(side).classList.add("is-ten-complete");
  [...bridgeMogiFrame(other).children]
    .filter((cell) => cell.classList.contains("is-block"))
    .forEach((cell, index) => {
      cell.classList.add("is-counted", "count-rest");
      cell.dataset.count = index + 1;
    });
  els.bridgeMogiHelpFeedback.textContent = `10が できた！ のこりは ${rest}こ。10 + ${rest}で かんがえよう`;
  playTone("good");
}

function bridgeMogiDragEnd(event) {
  if (!bridgeMogiDrag.active) return;
  const { flyer, side: from, index, color, homeLeft, homeTop } = takeBridgeMogiDrag();
  const to = from === "left" ? "right" : "left";
  const rect = bridgeMogiFrame(to).getBoundingClientRect();
  const pad = 24;
  const inTarget =
    event.clientX >= rect.left - pad &&
    event.clientX <= rect.right + pad &&
    event.clientY >= rect.top - pad &&
    event.clientY <= rect.bottom + pad;
  const landSlot = state.bridgeMogi.slots[to].indexOf(null);
  if (!state.bridgeMogi.open || state.bridgeMogi.solved || state.locked.bridge || !inTarget || landSlot === -1) {
    mogiSnapBack(flyer, homeLeft, homeTop);
    return;
  }

  flyer.remove();
  state.bridgeMogi.slots[from][index] = null;
  state.bridgeMogi.slots[to][landSlot] = color;
  playTone("click");
  renderBridgeMogiHelp();
  const landed = bridgeMogiFrame(to).children[landSlot];
  if (landed) landed.classList.add("is-pop");
  if (bridgeMogiCount(to) === 10) completeBridgeMogiHelp(to);
}

function bridgeMogiDragCancel() {
  if (!bridgeMogiDrag.active) return;
  const { flyer, homeLeft, homeTop } = takeBridgeMogiDrag();
  mogiSnapBack(flyer, homeLeft, homeTop);
}

[["left", els.bridgeMogiLeftFrame], ["right", els.bridgeMogiRightFrame]].forEach(([side, frame]) => {
  frame.addEventListener("pointerdown", (event) => bridgeMogiDragStart(event, side));
});
window.addEventListener("pointermove", bridgeMogiDragMove, { passive: false });
window.addEventListener("pointerup", bridgeMogiDragEnd);
window.addEventListener("pointercancel", bridgeMogiDragCancel);
els.bridgeMogiHelpToggle.addEventListener("click", toggleBridgeMogiHelp);
els.bridgeMogiHelpReset.addEventListener("click", resetBridgeMogiHelp);

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
  const remain = total - moved;
  for (let index = 0; index < total; index += 1) {
    const dot = document.createElement("div");
    dot.className = "donor-dot";
    if (index >= remain) {
      // 後ろから移した場所は穴として残し、残りを左詰めで見せる
      dot.classList.add("is-moved-away");
    } else {
      // のこりのブロックに 1, 2… と小さく番号を振る
      dot.classList.add("is-leftover");
      dot.dataset.count = index + 1;
    }
    els.donorDots.append(dot);
  }
}

function animateBridgeCompletion(problem, need) {
  const cells = [...els.bridgeFrame.children].slice(problem.big, problem.big + need);
  const donorDots = [...els.donorDots.children];
  // 移動元の後ろ側から取り、残った5のまとまりを意識できるようにする
  const dots = donorDots.slice(-need);
  const dotRects = dots.map((dot) => dot.getBoundingClientRect());
  const cellRects = cells.map((cell) => cell.getBoundingClientRect());

  renderSplitDots(problem.small, need);

  const canAnimate =
    typeof document.createElement("div").animate === "function" &&
    dotRects.every((rect) => rect.width > 0) &&
    cellRects.every((rect) => rect.width > 0);

  if (!canAnimate) {
    renderTenFrame(els.bridgeFrame, problem.big, need, true);
    els.bridgeFrame.classList.add("is-ten-complete");
    scheduleExplanationFinished("bridge", problem, 650);
    return;
  }

  let landed = 0;
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
      landed += 1;
      // 10個そろった瞬間に、10のかたまりを大きく囲って見せる
      if (landed === cells.length) {
        els.bridgeFrame.classList.add("is-ten-complete");
        scheduleExplanationFinished("bridge", problem, 650);
      }
    };
  });
}

function revealBridgeAnswer(problem, need, rest) {
  els.bridgeLeftLabel.textContent = 10;
  els.bridgeRightLabel.textContent = ""; // のこりは番号バッジで数えるのでラベルは消す
  els.bridgeChain.textContent = `10をつくると、のこりは ${rest}こ になるね`;
  els.bridgeChain.classList.add("is-solved");
  animateBridgeCompletion(problem, need);
}

function scheduleBridgeReveal(problem, need, rest) {
  if (!state.explainEnabled) return;
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

function bridgeEquationText(problem, answer = null) {
  const first = Number.isFinite(problem.displayA) ? problem.displayA : problem.big;
  const second = Number.isFinite(problem.displayB) ? problem.displayB : problem.small;
  return `${first} + ${second}${answer === null ? "" : ` = ${answer}`}`;
}

function nextBridge() {
  if (!guardNext("bridge")) return;
  clearBridgeReveal();
  els.flyLayer.replaceChildren();
  const pickedBridge = pickWeighted("bridge", fireProblems, state.lastKey.bridge);
  state.problem.bridge = orientFireProblem(pickedBridge, SETTINGS.fireLeftToRight);
  state.bridgeMogi = { open: false, used: false, solved: false, original: { left: 0, right: 0 }, slots: { left: [], right: [] } };
  state.lastKey.bridge = problemKey(state.problem.bridge);
  const currentBridge = state.problem.bridge;
  const need = 10 - currentBridge.big;
  els.bridgeEquation.textContent = bridgeEquationText(currentBridge);
  els.bridgeBoard.classList.toggle("is-source-left", currentBridge.sourceOnLeft);
  els.bridgeLeftLabel.textContent = currentBridge.big;
  els.bridgeRightLabel.textContent = currentBridge.small;
  els.bridgeEquation.classList.remove("is-solved");
  els.bridgeChain.textContent = "";
  els.bridgeChain.classList.remove("is-solved");
  M.bridge.feedback.className = "feedback";
  M.bridge.feedback.textContent = "こたえを えらんでね";
  setNextButton("bridge", false);
  els.bridgeFrame.classList.remove("is-ten-complete");
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
  if (answerCountsForProgress("bridge")) recordAnswer("bridge", problem, correct);
  button.classList.add(correct ? "is-correct" : "is-wrong");

  if (correct) {
    els.bridgeEquation.textContent = bridgeEquationText(problem, answer);
    els.bridgeEquation.classList.add("is-solved");
    onCorrect("bridge");
    scheduleBridgeReveal(problem, need, rest);
  } else {
    els.bridgeEquation.textContent = bridgeEquationText(problem, answer);
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
    if (count >= targets.length) {
      explanationFinished(mode, problem);
      return;
    }
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
  if (!state.explainEnabled) return;
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

/* ---------- 保護者ロック ---------- */

function parentLockEnabled() {
  return Boolean(parentLockConfig && !parentLockConfig.disabled && parentLockConfig.pinHash);
}

function resetParentLockAttempts() {
  parentLockAttempts = { count: 0, lockedUntil: 0 };
  saveParentLockAttempts();
}

function clearParentLockTimer() {
  if (parentLockSession.timerId !== null) {
    clearInterval(parentLockSession.timerId);
    parentLockSession.timerId = null;
  }
}

function parentLockSecondsRemaining() {
  return Math.max(0, Math.ceil((parentLockAttempts.lockedUntil - Date.now()) / 1000));
}

function parentLockExpectedLength() {
  return parentLockSession.stage === "recovery" ? PARENT_RECOVERY_LENGTH : PARENT_PIN_LENGTH;
}

function parentLockDefaultMessage() {
  const messages = {
    unlock: "4桁の暗証番号を入力してください",
    "setup-first": "新しい4桁の暗証番号を決めてください",
    "setup-confirm": "確認のため、同じ暗証番号をもう一度入力してください",
    "change-first": "新しい4桁の暗証番号を決めてください",
    "change-confirm": "確認のため、同じ暗証番号をもう一度入力してください",
    recovery: "設定時に控えた8桁の復旧コードを入力してください"
  };
  return messages[parentLockSession.stage] || "暗証番号を入力してください";
}

function renderParentLockScreen() {
  const recoveryIssued = parentLockSession.stage === "recovery-issued";
  els.parentPinEntryView.classList.toggle("is-hidden", recoveryIssued);
  els.parentRecoveryIssued.classList.toggle("is-hidden", !recoveryIssued);
  els.parentLockTitle.textContent = recoveryIssued ? "🔑 復旧コード" : "🔒 保護者ロック";

  if (recoveryIssued) {
    els.parentRecoveryCode.textContent = parentLockSession.recoveryCode;
    clearParentLockTimer();
    return;
  }

  let seconds = parentLockSecondsRemaining();
  if (seconds <= 0 && parentLockAttempts.lockedUntil > 0) {
    resetParentLockAttempts();
    seconds = 0;
  }
  const lockedOut = seconds > 0;
  const expectedLength = parentLockExpectedLength();
  const filled = "● ".repeat(parentLockSession.entry.length);
  const empty = "○ ".repeat(Math.max(0, expectedLength - parentLockSession.entry.length));
  els.parentPinDisplay.textContent = `${filled}${empty}`.trim();
  els.parentPinDisplay.setAttribute("aria-label", `${expectedLength}桁中${parentLockSession.entry.length}桁入力済み`);
  els.parentLockMessage.textContent = lockedOut
    ? `入力を停止しています。あと${seconds}秒お待ちください`
    : parentLockSession.message || parentLockDefaultMessage();

  els.parentPinKeypad.querySelectorAll("button").forEach((button) => {
    button.disabled = lockedOut;
  });
  els.parentPinSubmit.disabled = lockedOut;
  els.parentLockForgot.classList.toggle("is-hidden", parentLockSession.stage !== "unlock");
  const canGoBack =
    parentLockSession.stage === "recovery" ||
    parentLockSession.stage === "setup-confirm" ||
    parentLockSession.stage === "change-confirm" ||
    parentLockSession.returnToSettings;
  els.parentLockBack.classList.toggle("is-hidden", !canGoBack);

  if (lockedOut && parentLockSession.timerId === null) {
    parentLockSession.timerId = setInterval(renderParentLockScreen, 1000);
  } else if (!lockedOut) {
    clearParentLockTimer();
  }
}

function beginParentLockStage(stage, returnToSettings = false, message = "") {
  clearParentLockTimer();
  parentLockSession.stage = stage;
  parentLockSession.entry = "";
  parentLockSession.firstPin = "";
  parentLockSession.recoveryCode = "";
  parentLockSession.message = message;
  parentLockSession.returnToSettings = returnToSettings;
  els.settingsContent.classList.add("is-hidden");
  els.parentLockCard.classList.remove("is-hidden");
  renderParentLockScreen();
}

function renderParentLockManagement() {
  const enabled = parentLockEnabled();
  els.parentLockStatus.textContent = enabled
    ? "保護中です。設定画面を離れると自動でロックします"
    : "保護者ロックは解除されています";
  els.parentLockChange.textContent = enabled ? "暗証番号を変更" : "暗証番号を設定";
  els.parentLockReissue.classList.toggle("is-hidden", !enabled);
  els.parentLockRemove.classList.toggle("is-hidden", !enabled);
}

function showSettingsContent() {
  parentLockSession.unlocked = true;
  parentLockSession.entry = "";
  parentLockSession.firstPin = "";
  parentLockSession.message = "";
  clearParentLockTimer();
  els.parentLockCard.classList.add("is-hidden");
  els.settingsContent.classList.remove("is-hidden");
  renderSettingsPanel();
  renderParentLockManagement();
}

function showParentLockGate() {
  parentLockSession.unlocked = false;
  if (parentLockConfig?.disabled === true) {
    showSettingsContent();
    return;
  }
  if (parentLockEnabled()) {
    beginParentLockStage("unlock");
  } else {
    beginParentLockStage("setup-first", false, "最初に、保護者用の4桁暗証番号を設定してください");
  }
}

function lockParentSettings() {
  parentLockSession.unlocked = false;
  parentLockSession.entry = "";
  parentLockSession.firstPin = "";
  parentLockSession.recoveryCode = "";
  parentLockSession.message = "";
  clearParentLockTimer();
  els.settingsContent.classList.add("is-hidden");
  els.parentLockCard.classList.add("is-hidden");
}

function appendParentLockDigit(digit) {
  if (parentLockSecondsRemaining() > 0) return;
  const expectedLength = parentLockExpectedLength();
  if (parentLockSession.entry.length >= expectedLength) return;
  parentLockSession.entry += digit;
  parentLockSession.message = "";
  renderParentLockScreen();
}

function recordParentLockFailure(label) {
  parentLockAttempts.count += 1;
  parentLockSession.entry = "";
  if (parentLockAttempts.count >= 3) {
    parentLockAttempts.count = 0;
    parentLockAttempts.lockedUntil = Date.now() + PARENT_LOCKOUT_MS;
    parentLockSession.message = "";
  } else {
    parentLockSession.message = `${label}が違います。あと${3 - parentLockAttempts.count}回入力できます`;
  }
  saveParentLockAttempts();
  renderParentLockScreen();
}

function showIssuedRecoveryCode(code) {
  parentLockSession.stage = "recovery-issued";
  parentLockSession.entry = "";
  parentLockSession.firstPin = "";
  parentLockSession.recoveryCode = code;
  parentLockSession.message = "";
  els.settingsContent.classList.add("is-hidden");
  els.parentLockCard.classList.remove("is-hidden");
  renderParentLockScreen();
}

function saveNewParentPin(pin, issueRecoveryCode) {
  if (issueRecoveryCode) {
    const recoveryCode = generateParentRecoveryCode();
    saveParentLockConfig({
      version: 1,
      disabled: false,
      pinHash: hashParentSecret("pin", pin),
      recoveryHash: hashParentSecret("recovery", recoveryCode)
    });
    resetParentLockAttempts();
    showIssuedRecoveryCode(recoveryCode);
    return;
  }

  saveParentLockConfig({
    ...parentLockConfig,
    version: 1,
    disabled: false,
    pinHash: hashParentSecret("pin", pin)
  });
  resetParentLockAttempts();
  window.alert("暗証番号を変更しました。");
  showSettingsContent();
}

function submitParentLockEntry() {
  if (parentLockSecondsRemaining() > 0) return;
  const expectedLength = parentLockExpectedLength();
  if (parentLockSession.entry.length !== expectedLength) {
    parentLockSession.message = `${expectedLength}桁すべて入力してください`;
    renderParentLockScreen();
    return;
  }

  const entry = parentLockSession.entry;
  if (parentLockSession.stage === "unlock") {
    if (hashParentSecret("pin", entry) === parentLockConfig.pinHash) {
      resetParentLockAttempts();
      showSettingsContent();
    } else {
      recordParentLockFailure("暗証番号");
    }
    return;
  }

  if (parentLockSession.stage === "recovery") {
    if (hashParentSecret("recovery", entry) === parentLockConfig.recoveryHash) {
      saveParentLockConfig({ version: 1, disabled: true });
      resetParentLockAttempts();
      window.alert("保護者ロックを初期化しました。必要なら新しい暗証番号を設定してください。");
      showSettingsContent();
    } else {
      recordParentLockFailure("復旧コード");
    }
    return;
  }

  if (parentLockSession.stage === "setup-first" || parentLockSession.stage === "change-first") {
    parentLockSession.firstPin = entry;
    parentLockSession.entry = "";
    parentLockSession.stage = parentLockSession.stage === "setup-first" ? "setup-confirm" : "change-confirm";
    parentLockSession.message = "";
    renderParentLockScreen();
    return;
  }

  if (parentLockSession.stage === "setup-confirm" || parentLockSession.stage === "change-confirm") {
    if (entry !== parentLockSession.firstPin) {
      parentLockSession.entry = "";
      parentLockSession.message = "暗証番号が一致しません。もう一度入力してください";
      renderParentLockScreen();
      return;
    }
    saveNewParentPin(entry, parentLockSession.stage === "setup-confirm");
  }
}

/* ---------- モード切替・初期化 ---------- */

function switchMode(mode) {
  if (mode !== "settings") lockParentSettings();
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
  qs("#gametime-mode").classList.toggle("is-hidden", mode !== "gametime");
  qs("#records-mode").classList.toggle("is-hidden", mode !== "records");
  qs("#dex-mode").classList.toggle("is-hidden", mode !== "dex");
  qs("#stats-panel").classList.toggle("is-hidden", mode !== "stats");
  qs("#report-mode").classList.toggle("is-hidden", mode !== "report");
  qs("#dojo-mode").classList.toggle("is-hidden", mode !== "dojo");
  qs("#multiply-mode").classList.toggle("is-hidden", mode !== "multiply");
  qs("#settings-mode").classList.toggle("is-hidden", mode !== "settings");
  qs("#calendar-mode").classList.toggle("is-hidden", mode !== "calendar");

  if (mode === "gametime") renderGameTimeShop();
  if (mode === "records") renderRecords();
  if (mode === "dex") renderDex();
  if (mode === "stats") renderStatsPanel();
  if (mode === "report") renderReport();
  if (mode === "dojo") renderWeaknessDojo();
  if (mode === "settings") showParentLockGate();
  if (mode === "calendar") {
    calendarOffset = 0;
    renderCalendar();
  }
}

document.querySelectorAll(".mode-tab").forEach((tab) => {
  tab.addEventListener("click", () => switchMode(tab.dataset.mode));
});

document.querySelectorAll("[data-parent-pin-digit]").forEach((button) => {
  button.addEventListener("click", () => appendParentLockDigit(button.dataset.parentPinDigit));
});

qs("#parent-pin-clear").addEventListener("click", () => {
  parentLockSession.entry = "";
  parentLockSession.message = "";
  renderParentLockScreen();
});

qs("#parent-pin-backspace").addEventListener("click", () => {
  parentLockSession.entry = parentLockSession.entry.slice(0, -1);
  parentLockSession.message = "";
  renderParentLockScreen();
});

els.parentPinSubmit.addEventListener("click", submitParentLockEntry);

els.parentLockForgot.addEventListener("click", () => {
  beginParentLockStage("recovery");
});

els.parentLockBack.addEventListener("click", () => {
  if (parentLockSession.stage === "recovery") {
    beginParentLockStage("unlock");
  } else if (parentLockSession.stage === "setup-confirm") {
    beginParentLockStage("setup-first", parentLockSession.returnToSettings);
  } else if (parentLockSession.stage === "change-confirm") {
    beginParentLockStage("change-first", true);
  } else if (parentLockSession.returnToSettings) {
    showSettingsContent();
  }
});

qs("#parent-recovery-ack").addEventListener("click", () => {
  parentLockSession.recoveryCode = "";
  showSettingsContent();
});

els.parentLockChange.addEventListener("click", () => {
  beginParentLockStage(parentLockEnabled() ? "change-first" : "setup-first", true);
});

els.parentLockReissue.addEventListener("click", () => {
  if (!parentLockEnabled()) return;
  if (!window.confirm("現在の復旧コードを無効にして、新しい復旧コードを発行しますか？")) return;
  const recoveryCode = generateParentRecoveryCode();
  saveParentLockConfig({
    ...parentLockConfig,
    recoveryHash: hashParentSecret("recovery", recoveryCode)
  });
  showIssuedRecoveryCode(recoveryCode);
});

els.parentLockRemove.addEventListener("click", () => {
  if (!parentLockEnabled()) return;
  if (!window.confirm("保護者ロックを解除しますか？ 設定タブを誰でも開けるようになります。")) return;
  saveParentLockConfig({ version: 1, disabled: true });
  resetParentLockAttempts();
  renderParentLockManagement();
});

window.addEventListener("keydown", (event) => {
  if (state.activeMode !== "settings" || els.parentLockCard.classList.contains("is-hidden")) return;
  if (parentLockSession.stage === "recovery-issued") return;
  if (/^[0-9]$/.test(event.key)) {
    event.preventDefault();
    appendParentLockDigit(event.key);
  } else if (event.key === "Backspace") {
    event.preventDefault();
    parentLockSession.entry = parentLockSession.entry.slice(0, -1);
    parentLockSession.message = "";
    renderParentLockScreen();
  } else if (event.key === "Enter") {
    event.preventDefault();
    submitParentLockEntry();
  }
});

MODES.forEach((mode) => {
  qs(`#new-${mode}`)?.addEventListener("click", () => nextQuestion(mode));
  M[mode].next.addEventListener("click", () => nextQuestion(mode));
  M[mode].start.addEventListener("click", () => startMode(mode));
});

els.flashReplay.addEventListener("click", () => {
  const problem = state.problem.flash;
  if (!problem || state.locked.flash || state.flash.replays >= FLASH_MAX_REPLAYS) return;
  state.flash.replays += 1;
  showFlash(problem);
});

els.blockToggle.addEventListener("click", () => {
  setBlockDisplay(!state.blocksEnabled);
});

els.explainToggle.addEventListener("click", () => {
  setExplainDisplay(!state.explainEnabled);
});

els.explanationWaitToggle.addEventListener("click", () => {
  setWaitForExplanation(!SETTINGS.waitForExplanation);
});

els.fireDirectionToggle.addEventListener("click", () => {
  setFireLeftToRight(!SETTINGS.fireLeftToRight);
});

els.timeToggle.addEventListener("click", () => {
  setTimedMode(!state.timedEnabled);
  if (state.activeMode === "records") {
    renderRecords();
  }
});

qs("#release-pokemon").addEventListener("click", () => {
  if (!window.confirm("本当にポケモンを全部逃がしますか？（図鑑と累計正解数がリセットされます）")) return;
  state.totalCorrect = 0;
  state.catchProgress = 0;
  state.caught = {};
  localStorage.setItem(TOTAL_KEY, "0");
  saveCatchProgress();
  saveCaught();
  renderDex();
  renderPartner();
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

qs("#stats-prev").addEventListener("click", () => {
  statsCalendarOffset -= 1;
  selectStatsDateInVisibleMonth();
  renderStatsPanel();
});

qs("#stats-next").addEventListener("click", () => {
  if (statsCalendarOffset >= 0) return;
  statsCalendarOffset += 1;
  selectStatsDateInVisibleMonth();
  renderStatsPanel();
});

// 金額を打ち込んで減らす
const coinSpendInput = qs("#coin-spend-amount");
qs("#coin-spend-run").addEventListener("click", () => {
  const yen = Number(coinSpendInput.value);
  if (!Number.isFinite(yen) || yen <= 0) return;
  if (!Number.isInteger(yen)) {
    window.alert("金額は整数で入力してください。");
    return;
  }
  if (state.walletYen < yen) {
    window.alert(`さいふに ${yen}円 ありません（いまは ${state.walletYen}円）`);
    return;
  }
  spendYen(yen);
  coinSpendInput.value = "";
});

qs("#coin-reset").addEventListener("click", () => {
  if (!window.confirm("さいふを0円に戻しますか？")) return;
  state.walletYen = 0;
  state.coinJustEarned = false;
  saveCoins();
  renderCoinGauge();
});

qs("#game-time-buy").addEventListener("click", buyGameTime);
qs("#game-time-use").addEventListener("click", useGameTime);

qs("#backup-export").addEventListener("click", exportBackup);

const backupImportInput = qs("#backup-import-file");
qs("#backup-import").addEventListener("click", () => backupImportInput.click());
backupImportInput.addEventListener("change", () => {
  const file = backupImportInput.files && backupImportInput.files[0];
  if (file) importBackup(file);
  backupImportInput.value = "";
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  let reloadingForUpdate = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadingForUpdate) return;
    reloadingForUpdate = true;
    window.location.reload();
  });
  navigator.serviceWorker
    .register("sw.js?v=95", { updateViaCache: "none" })
    .then((registration) => registration.update())
    .catch(() => {});
}

renderTimeToggle();
renderBlockToggle();
renderExplainToggle();
renderExplanationWaitToggle();
renderFireDirectionToggle();
renderRecords();
buildGaugeMatrix();
renderMission();
renderCoinGauge();
renderHeroStats();
renderPartner();
MODES.forEach(resetModeStart);
switchMode("calendar"); // 起動時はカレンダーを表示
