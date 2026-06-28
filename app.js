const pairs = [
  { base: 1, friend: 9 },
  { base: 2, friend: 8 },
  { base: 3, friend: 7 },
  { base: 4, friend: 6 },
  { base: 5, friend: 5 },
  { base: 6, friend: 4 },
  { base: 7, friend: 3 },
  { base: 8, friend: 2 },
  { base: 9, friend: 1 }
];

const bridgeProblems = makeBridgeProblems();
const simpleProblems = makeSimpleProblems();

const CHALLENGE_SECONDS = 60;
const TIMER_TICK_MS = 100;
const MAX_RECORDS = 10;
const PAIR_RECORDS_KEY = "riku10-records-pair";
const BRIDGE_RECORDS_KEY = "riku10-records-bridge";
const SIMPLE_RECORDS_KEY = "riku10-records-simple";

const state = {
  pair: null,
  bridge: null,
  simple: null,
  stars: 0,
  highScore: 0,
  pairStreak: 0,
  bridgeStreak: 0,
  simpleStreak: 0,
  pairRecords: loadModeRecords(PAIR_RECORDS_KEY),
  bridgeRecords: loadModeRecords(BRIDGE_RECORDS_KEY),
  simpleRecords: loadModeRecords(SIMPLE_RECORDS_KEY),
  activeMode: "simple",
  started: { pair: false, bridge: false, simple: false },
  nextQuestionTimeoutId: null,
  lastPairKey: "",
  lastBridgeKey: "",
  lastSimpleKey: "",
  timedEnabled: localStorage.getItem("riku10-timed-enabled") === "true",
  challenge: { remainingMs: CHALLENGE_SECONDS * 1000, intervalId: null, ended: false },
  timers: {
    pair: { locked: false },
    bridge: { locked: false },
    simple: { locked: false }
  }
};

state.highScore = Math.max(
  ...state.pairRecords.map((r) => r.score),
  ...state.bridgeRecords.map((r) => r.score),
  ...state.simpleRecords.map((r) => r.score),
  0
);

const els = {
  stars: document.querySelector("#stars"),
  highScore: document.querySelector("#high-score"),
  timeToggle: document.querySelector("#time-toggle"),
  timeToggleLabel: document.querySelector("#time-toggle-label"),
  pairNumber: document.querySelector("#pair-number"),
  pairFrame: document.querySelector("#pair-frame"),
  pairChoices: document.querySelector("#pair-choices"),
  pairFeedback: document.querySelector("#pair-feedback"),
  pairNext: document.querySelector("#pair-next"),
  pairStart: document.querySelector("#pair-start"),
  pairTimerRow: document.querySelector("#pair-timer-row"),
  pairTime: document.querySelector("#pair-time"),
  pairTimerFill: document.querySelector("#pair-timer-fill"),
  bridgeEquation: document.querySelector("#bridge-equation"),
  bridgeChain: document.querySelector("#bridge-chain"),
  bridgeLeftLabel: document.querySelector("#bridge-left-label"),
  bridgeRightLabel: document.querySelector("#bridge-right-label"),
  bridgeFrame: document.querySelector("#bridge-frame"),
  donorDots: document.querySelector("#donor-dots"),
  bridgeChoices: document.querySelector("#bridge-choices"),
  bridgeFeedback: document.querySelector("#bridge-feedback"),
  bridgeNext: document.querySelector("#bridge-next"),
  bridgeStart: document.querySelector("#bridge-start"),
  bridgeTimerRow: document.querySelector("#bridge-timer-row"),
  bridgeTime: document.querySelector("#bridge-time"),
  bridgeTimerFill: document.querySelector("#bridge-timer-fill"),
  simpleEquation: document.querySelector("#simple-equation"),
  simpleFrame: document.querySelector("#simple-frame"),
  simpleChoices: document.querySelector("#simple-choices"),
  simpleFeedback: document.querySelector("#simple-feedback"),
  simpleNext: document.querySelector("#simple-next"),
  simpleStart: document.querySelector("#simple-start"),
  simpleTimerRow: document.querySelector("#simple-timer-row"),
  simpleTime: document.querySelector("#simple-time"),
  simpleTimerFill: document.querySelector("#simple-timer-fill"),
  clearRecords: document.querySelector("#clear-records"),
  parentNote: document.querySelector("#parent-note")
};

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

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

function simpleProblemKey(p) {
  return `${p.a}+${p.b}`;
}

function makeSimpleChoices() {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9];
}

function problemKey(problem) {
  return `${problem.big ?? problem.base}+${problem.small ?? problem.friend}`;
}

function pickDifferent(items, lastKey) {
  if (items.length <= 1) return pick(items);
  const candidates = items.filter((item) => problemKey(item) !== lastKey);
  return pick(candidates.length ? candidates : items);
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

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

function formatRecordDate(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function saveRecords() {
  localStorage.setItem(PAIR_RECORDS_KEY, JSON.stringify(state.pairRecords));
  localStorage.setItem(BRIDGE_RECORDS_KEY, JSON.stringify(state.bridgeRecords));
  localStorage.setItem(SIMPLE_RECORDS_KEY, JSON.stringify(state.simpleRecords));
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
  renderModeRecords(
    state.simpleRecords,
    document.querySelector("#simple-records-list"),
    document.querySelector("#simple-records-empty")
  );
  renderModeRecords(
    state.pairRecords,
    document.querySelector("#pair-records-list"),
    document.querySelector("#pair-records-empty")
  );
  renderModeRecords(
    state.bridgeRecords,
    document.querySelector("#bridge-records-list"),
    document.querySelector("#bridge-records-empty")
  );
}

function addRecord(score, mode) {
  if (!score) return;
  const key = mode === "pair" ? "pairRecords" : mode === "bridge" ? "bridgeRecords" : "simpleRecords";
  state[key] = [...state[key], { score, date: new Date().toISOString() }]
    .sort((a, b) => b.score - a.score || new Date(b.date) - new Date(a.date))
    .slice(0, MAX_RECORDS);
  state.highScore = Math.max(
    ...state.pairRecords.map((r) => r.score),
    ...state.bridgeRecords.map((r) => r.score),
    ...state.simpleRecords.map((r) => r.score),
    0
  );
  localStorage.setItem("riku10-challenge-best", String(state.highScore));
  saveRecords();
  renderRecords();
}

function saveScore() {
  els.stars.textContent = state.stars;
  els.highScore.textContent = state.highScore;
  els.parentNote.textContent = state.timedEnabled
    ? `60びょうで ${state.stars}もん。ベスト ${state.highScore}もん。`
    : "じかんなし。スコアにいれず、ゆっくり考えるモード。";
}

function playTone(kind) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = kind === "good" ? 660 : 180;
  gain.gain.setValueAtTime(0.001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
  osc.start();
  osc.stop(ctx.currentTime + 0.2);
}

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

function timerElements(mode) {
  if (mode === "pair") return { row: els.pairTimerRow, time: els.pairTime, fill: els.pairTimerFill, feedback: els.pairFeedback };
  if (mode === "bridge") return { row: els.bridgeTimerRow, time: els.bridgeTime, fill: els.bridgeTimerFill, feedback: els.bridgeFeedback };
  return { row: els.simpleTimerRow, time: els.simpleTime, fill: els.simpleTimerFill, feedback: els.simpleFeedback };
}

function stopChallengeTimer() {
  if (state.challenge.intervalId) {
    clearInterval(state.challenge.intervalId);
    state.challenge.intervalId = null;
  }
}

function setNextButton(mode, visible) {
  const button = mode === "pair" ? els.pairNext : mode === "bridge" ? els.bridgeNext : els.simpleNext;
  button.classList.toggle("is-hidden", !visible);
}

function modeSection(mode) {
  if (mode === "pair") return document.querySelector("#pair-mode");
  if (mode === "bridge") return document.querySelector("#bridge-mode");
  return document.querySelector("#simple-mode");
}

function setModeWaiting(mode, waiting) {
  modeSection(mode).classList.toggle("is-waiting", waiting);
}

function resetModeStart(mode) {
  state.started[mode] = false;
  setModeWaiting(mode, true);
  state.timers[mode].locked = true;
  setNextButton(mode, false);
}

function clearNextQuestion() {
  if (state.nextQuestionTimeoutId) {
    clearTimeout(state.nextQuestionTimeoutId);
    state.nextQuestionTimeoutId = null;
  }
}

function renderTimerRows() {
  [timerElements("pair"), timerElements("bridge"), timerElements("simple")].forEach((parts) => {
    parts.row.classList.toggle("is-hidden", !state.timedEnabled);
    const seconds = Math.max(0, Math.ceil(state.challenge.remainingMs / 1000));
    const percent = Math.max(0, Math.min(100, (state.challenge.remainingMs / (CHALLENGE_SECONDS * 1000)) * 100));
    parts.time.textContent = seconds;
    parts.fill.style.width = `${percent}%`;
    parts.fill.classList.toggle("is-low", seconds <= 10);
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
  state.timers.pair.locked = true;
  state.timers.bridge.locked = true;
  state.timers.simple.locked = true;
  stopChallengeTimer();
  renderTimerRows();
  addRecord(finalScore, state.activeMode);
  saveScore();

  const feedback = state.activeMode === "pair" ? els.pairFeedback
    : state.activeMode === "bridge" ? els.bridgeFeedback
    : els.simpleFeedback;
  feedback.className = "feedback is-try";
  feedback.textContent = `じかんぎれ。${state.stars}もんできた！`;
  setNextButton(state.activeMode, true);
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

function setTimedMode(enabled) {
  state.timedEnabled = enabled;
  localStorage.setItem("riku10-timed-enabled", String(enabled));
  stopChallengeTimer();
  resetChallengeScore();
  resetModeStart("pair");
  resetModeStart("bridge");
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
  state.started[mode] = true;
  setModeWaiting(mode, false);
  if (mode === "pair") nextPair();
  else if (mode === "bridge") nextBridge();
  else nextSimple();
  startChallengeTimer();
}

function nextPair() {
  clearNextQuestion();
  if (!state.started.pair) {
    resetModeStart("pair");
    return;
  }
  if (state.timedEnabled && state.challenge.ended) {
    resetChallengeScore();
    resetModeStart("pair");
    return;
  }
  state.timers.pair.locked = false;
  state.pair = pickDifferent(pairs, state.lastPairKey);
  state.lastPairKey = problemKey(state.pair);
  els.pairNumber.textContent = state.pair.base;
  els.pairNumber.removeAttribute("aria-label");
  els.pairNumber.parentElement.classList.remove("is-solved-equation");
  els.pairFeedback.className = "feedback";
  els.pairFeedback.textContent = "なかよしを えらんでね";
  setNextButton("pair", false);
  renderTenFrame(els.pairFrame, state.pair.base, state.pair.friend, false, true);
  renderChoiceButtons(els.pairChoices, [1, 2, 3, 4, 5, 6, 7, 8, 9], choosePair);
  if (state.activeMode === "pair") startChallengeTimer();
}

function choosePair(value, button) {
  const timer = state.timers.pair;
  if (timer.locked) return;

  const correct = value === state.pair.friend;
  button.classList.add(correct ? "is-correct" : "is-wrong");

  if (correct) {
    timer.locked = true;
    state.pairStreak += 1;
    countSolvedQuestion();
    els.pairFeedback.className = "feedback is-good";
    els.pairFeedback.textContent = "できた！";
    els.pairNumber.innerHTML = `<span class="eq-green">${state.pair.base}</span><span> + </span><span class="eq-red">${state.pair.friend}</span><span> = 10</span>`;
    els.pairNumber.setAttribute("aria-label", `${state.pair.base} + ${state.pair.friend} = 10`);
    els.pairNumber.parentElement.classList.add("is-solved-equation");
    renderTenFrame(els.pairFrame, state.pair.base, state.pair.friend, true);
    setNextButton("pair", true);
    playTone("good");
  } else {
    state.pairStreak = 0;
    els.pairFeedback.className = "feedback is-try";
    els.pairFeedback.textContent = "もういちど";
    playTone("try");
  }
}

function nextBridge() {
  clearNextQuestion();
  if (!state.started.bridge) {
    resetModeStart("bridge");
    return;
  }
  if (state.timedEnabled && state.challenge.ended) {
    resetChallengeScore();
    resetModeStart("bridge");
    return;
  }
  state.timers.bridge.locked = false;
  state.bridge = pickDifferent(bridgeProblems, state.lastBridgeKey);
  state.lastBridgeKey = problemKey(state.bridge);
  const currentBridge = state.bridge;
  const need = 10 - state.bridge.big;
  const answer = state.bridge.big + state.bridge.small;
  els.bridgeEquation.textContent = `${state.bridge.big} + ${state.bridge.small}`;
  els.bridgeLeftLabel.textContent = state.bridge.big;
  els.bridgeRightLabel.textContent = state.bridge.small;
  els.bridgeEquation.classList.remove("is-solved");
  els.bridgeChain.textContent = "10をつくると？";
  els.bridgeChain.classList.remove("is-solved");
  els.bridgeFeedback.className = "feedback";
  els.bridgeFeedback.textContent = "こたえを えらんでね";
  setNextButton("bridge", false);
  renderTenFrame(els.bridgeFrame, state.bridge.big, need);
  renderDonorDots(state.bridge.small, 0);
  renderChoiceButtons(els.bridgeChoices, [11, 12, 13, 14, 15, 16, 17, 18], (value, button) => {
    chooseBridge(value, button, currentBridge);
  });
  if (state.activeMode === "bridge") startChallengeTimer();
}

function nextSimple() {
  clearNextQuestion();
  if (!state.started.simple) {
    resetModeStart("simple");
    return;
  }
  if (state.timedEnabled && state.challenge.ended) {
    resetChallengeScore();
    resetModeStart("simple");
    return;
  }
  state.timers.simple.locked = false;
  const candidates = simpleProblems.filter((p) => simpleProblemKey(p) !== state.lastSimpleKey);
  const p = pick(candidates.length ? candidates : simpleProblems);
  state.simple = p;
  state.lastSimpleKey = simpleProblemKey(p);
  const answer = p.a + p.b;
  els.simpleEquation.classList.remove("is-solved");
  els.simpleEquation.textContent = `${p.a} + ${p.b}`;
  els.simpleFeedback.className = "feedback";
  els.simpleFeedback.textContent = "こたえを えらんでね";
  setNextButton("simple", false);
  renderTenFrame(els.simpleFrame, 0, 0);
  renderChoiceButtons(els.simpleChoices, makeSimpleChoices(), (value, button) => {
    chooseSimple(value, button, p);
  });
  if (state.activeMode === "simple") startChallengeTimer();
}

function chooseSimple(value, button, problem = state.simple) {
  const timer = state.timers.simple;
  if (timer.locked) return;
  const answer = problem.a + problem.b;
  const correct = value === answer;
  button.classList.add(correct ? "is-correct" : "is-wrong");
  if (correct) {
    timer.locked = true;
    state.simpleStreak += 1;
    countSolvedQuestion();
    els.simpleFeedback.className = "feedback is-good";
    els.simpleFeedback.textContent = "できた！";
    els.simpleEquation.innerHTML = `<span class="eq-green">${problem.a}</span><span> + </span><span class="eq-red">${problem.b}</span><span> = ${answer}</span>`;
    els.simpleEquation.classList.add("is-solved");
    renderTenFrame(els.simpleFrame, problem.a, problem.b, true);
    setNextButton("simple", true);
    playTone("good");
  } else {
    state.simpleStreak = 0;
    els.simpleFeedback.className = "feedback is-try";
    els.simpleFeedback.textContent = "もういちど";
    playTone("try");
  }
}

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

function chooseBridge(value, button, problem = state.bridge) {
  const timer = state.timers.bridge;
  if (timer.locked) return;

  const need = 10 - problem.big;
  const rest = problem.small - need;
  const answer = problem.big + problem.small;
  const correct = value === answer;
  button.classList.add(correct ? "is-correct" : "is-wrong");

  if (correct) {
    timer.locked = true;
    state.bridgeStreak += 1;
    countSolvedQuestion();
    els.bridgeFeedback.className = "feedback is-good";
    els.bridgeFeedback.textContent = "できた！";
    els.bridgeEquation.textContent = `${problem.big} + ${problem.small} = ${answer}`;
    els.bridgeEquation.classList.add("is-solved");
    els.bridgeChain.textContent = "";
    els.bridgeChain.classList.add("is-solved");
    els.bridgeLeftLabel.textContent = 10;
    els.bridgeRightLabel.textContent = rest;
    renderTenFrame(els.bridgeFrame, problem.big, need, true);
    renderSplitDots(problem.small, need);
    setNextButton("bridge", true);
    playTone("good");
  } else {
    state.bridgeStreak = 0;
    els.bridgeFeedback.className = "feedback is-try";
    els.bridgeFeedback.textContent = `${problem.big}を10にして、のこりをたすよ`;
    playTone("try");
  }
}

function switchMode(mode) {
  clearNextQuestion();
  stopChallengeTimer();
  state.activeMode = mode;
  if (mode === "pair" || mode === "bridge" || mode === "simple") {
    resetChallengeScore();
    resetModeStart("pair");
    resetModeStart("bridge");
    resetModeStart("simple");
  }
  document.querySelectorAll(".mode-tab").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.mode === mode);
  });
  document.querySelector("#simple-mode").classList.toggle("is-hidden", mode !== "simple");
  document.querySelector("#pair-mode").classList.toggle("is-hidden", mode !== "pair");
  document.querySelector("#bridge-mode").classList.toggle("is-hidden", mode !== "bridge");
  document.querySelector("#records-mode").classList.toggle("is-hidden", mode !== "records");

  if (mode === "simple") resetModeStart("simple");
  else if (mode === "pair") resetModeStart("pair");
  else if (mode === "bridge") resetModeStart("bridge");
  else renderRecords();
}

document.querySelectorAll(".mode-tab").forEach((tab) => {
  tab.addEventListener("click", () => switchMode(tab.dataset.mode));
});

document.querySelector("#new-simple").addEventListener("click", nextSimple);
document.querySelector("#simple-next").addEventListener("click", nextSimple);
document.querySelector("#simple-start").addEventListener("click", () => startMode("simple"));
document.querySelector("#new-pair").addEventListener("click", nextPair);
document.querySelector("#new-bridge").addEventListener("click", nextBridge);
document.querySelector("#pair-next").addEventListener("click", nextPair);
document.querySelector("#bridge-next").addEventListener("click", nextBridge);
document.querySelector("#pair-start").addEventListener("click", () => startMode("pair"));
document.querySelector("#bridge-start").addEventListener("click", () => startMode("bridge"));
document.querySelector("#time-toggle").addEventListener("click", () => {
  setTimedMode(!state.timedEnabled);
  if (state.activeMode === "records") {
    renderRecords();
  }
});
document.querySelector("#clear-records").addEventListener("click", () => {
  state.pairRecords = [];
  state.bridgeRecords = [];
  state.simpleRecords = [];
  state.highScore = 0;
  localStorage.setItem("riku10-challenge-best", "0");
  saveRecords();
  renderRecords();
  saveScore();
});
document.querySelector("#reset-progress").addEventListener("click", () => {
  clearNextQuestion();
  stopChallengeTimer();
  resetChallengeScore();
  state.pairStreak = 0;
  state.bridgeStreak = 0;
  state.simpleStreak = 0;
  resetModeStart("pair");
  resetModeStart("bridge");
  resetModeStart("simple");
  if (state.activeMode === "pair") {
    resetModeStart("pair");
  } else if (state.activeMode === "bridge") {
    resetModeStart("bridge");
  } else if (state.activeMode === "simple") {
    resetModeStart("simple");
  } else {
    renderRecords();
  }
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js");
}

renderTimeToggle();
renderRecords();
saveScore();
resetModeStart("simple");
resetModeStart("pair");
resetModeStart("bridge");
