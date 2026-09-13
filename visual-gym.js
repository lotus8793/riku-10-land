/* かけざんジムA: 5×2のまとまりから、式と合計をつくる。 */
function buildVisualBoard(board, problem, focus = "") {
  board.replaceChildren();
  board.classList.add("five-board");
  board.style.setProperty("--five-groups", String(Math.min(problem.b, 5)));
  board.setAttribute("aria-label", `${problem.a}こずつのまとまりが${problem.b}つ。`);
  for (let g = 0; g < problem.b; g += 1) {
    const group = document.createElement("div");
    group.className = "five-set";
    group.classList.toggle("is-focused", focus === "each" && g === 0 || focus === "groups");
    const cells = document.createElement("div");
    cells.className = "five-cells";
    for (let n = 0; n < problem.a; n += 1) {
      const cell = document.createElement("span");
      cell.className = "five-cell is-filled";
      cells.append(cell);
    }
    group.append(cells);
    board.append(group);
  }
}

function nextVisual() {
  if (!guardNext("visual")) return;
  const p = pickWeighted("visual", multiplyProblems, state.lastKey.visual);
  state.problem.visual = p;
  state.lastKey.visual = abKey(p);
  state.visual = { ...KakezanVisual.initialGame, problem: { each: p.a, groups: p.b }, answer: [] };
  setNextButton("visual", false);
  renderVisual();
  if (state.activeMode === "visual") startChallengeTimer();
}

function visualCanAct() {
  return state.activeMode === "visual" && state.started.visual && !state.locked.visual;
}

function applyVisual(next) {
  if (!visualCanAct() || next === state.visual) return;
  state.visual = next;
  renderVisual();
  if (next.phase === "done") {
    recordAnswer("visual", state.problem.visual, true);
    onCorrect("visual");
  } else if (next.phase === "factor-error" || next.phase === "total-error") {
    recordAnswer("visual", state.problem.visual, false);
    registerWrong("visual");
    state.combo = 0;
    if (state.dojo.started) state.dojo.lastCorrect = false;
    stopChallengeTimer();
    playTone("try");
  }
}

function chooseVisualDigit(value) {
  if (!visualCanAct()) return;
  applyVisual(KakezanVisual.enterDigit(state.visual, value, { requireTotalInput: SETTINGS.visualRequireTotalInput }));
}

function visualReading(problem) {
  const answer = problem.a * problem.b;
  const call = MULTIPLY_CALLS[problem.a][problem.b - 1] + (answer < 10 ? "が" : "");
  // Aでは「さざんが きゅう」のように、答えの9を「きゅう」と読む。
  const total = answer % 10 === 9
    ? japaneseNumberReading(answer).replace(/く$/, "きゅう")
    : japaneseNumberReading(answer);
  return { call, total };
}

function renderVisual() {
  const { answer, phase, total } = state.visual;
  const p = state.problem.visual;
  const failed = phase === "factor-error" || phase === "total-error";
  const done = phase === "done";
  buildVisualBoard(qs("#visual-board"), p, phase);
  qs("#visual-board").setAttribute("aria-label", `${p.a}こ はいった ふくろが ${p.b}ふくろ。`);
  qs("#visual-board").classList.toggle("is-solved", done);
  const step = phase === "each" ? 1 : phase === "groups" || phase === "factor-error" ? 2 : 3;
  qs("#visual-step").textContent = done ? "できた！\nこえにだしてみよう！" : failed ? "ずを みながら、もういちど！" : ["", "① ひとつの ふくろに、なんこ はいってる？", "② ふくろは、いくつある？", "③ ブロックは、ぜんぶで なんこ？"][step];
  ["each", "groups", "total"].forEach((name, index) => {
    const factor = qs(`#visual-factor-${name}`);
    factor.classList.toggle("is-active", phase === name);
    factor.classList.toggle("is-solved", done);
    factor.querySelector(".visual-slot").textContent = index === 2 ? total || "?" : answer[index] ?? "?";
  });
  const reading = done ? visualReading(p) : null;
  qs("#visual-equation").classList.toggle("is-reading", done);
  qs("#visual-reading-call").classList.toggle("is-hidden", !done);
  qs("#visual-reading-total").classList.toggle("is-hidden", !done);
  qs("#visual-reading-call").textContent = reading?.call || "";
  qs("#visual-reading-total").textContent = reading?.total || "";
  qs("#visual-equation").setAttribute("aria-label", `${answer[0] ?? "空欄"}かける${answer[1] ?? "空欄"}イコール${total || "空欄"}`);
  qs("#visual-input").classList.toggle("is-hidden", failed || done);
  qs("#visual-retry").classList.toggle("is-hidden", !failed);
  qs("#visual-submit").classList.toggle("is-hidden", phase !== "total");
  qs("#visual-submit").disabled = !total;
  qs("#visual-undo").disabled = phase === "each";
  qs("#visual-input-note").textContent = phase === "total" ? "2けたは じゅんに おして、さいごに「こたえあわせ」" : "すうじを おしてね";
  const values = phase === "total" ? [1,2,3,4,5,6,7,8,9,0] : [1,2,3,4,5,6,7,8,9];
  renderChoiceButtons(M.visual.choices, values, chooseVisualDigit);
  M.visual.choices.querySelectorAll("button").forEach(button => {
    const value = Number(button.dataset.value);
    button.disabled = phase === "total" && (total.length >= 2 || value === 0 && !total);
    button.classList.toggle("visual-zero", value === 0);
  });
  M.visual.feedback.className = "feedback" + (failed ? " is-try" : done ? " is-good" : "");
  let message = SETTINGS.visualRequireTotalInput ? "ふくろの なかの かず → ふくろの かず → ぜんぶの ブロック" : "ふくろの なかの かず → ふくろの かず";
  if (phase === "factor-error") {
    const reversed = answer[0] === p.b && answer[1] === p.a;
    message = reversed ? "ぜんぶの かずは おなじになるね！ ここでは「ふくろの なかの かず → ふくろの かず」の じゅんに いれよう。" : answer[0] !== p.a ? "まずは、ひとつの ふくろの なかだけを かぞえてみよう。" : "ふくろの なかの かずは あっているよ！ ふくろが いくつあるか かぞえよう。";
  } else if (phase === "total-error") message = "しきは あっているよ！ ふくろの なかの ブロックを たして、ぜんぶの かずを かんがえよう。";
  M.visual.feedback.textContent = message;
  qs("#visual-explanation").classList.toggle("is-hidden", !done);
  qs("#visual-explanation").textContent = done ? `${p.a}こ はいった ふくろが ${p.b}ふくろで、ブロックは ぜんぶで ${total}こ！` : "";
}

function renderVisualAnswerInputToggle() {
  const enabled = SETTINGS.visualRequireTotalInput;
  const button = qs("#visual-answer-input-toggle");
  button.classList.toggle("is-on", enabled);
  button.setAttribute("aria-pressed", String(enabled));
  qs("#visual-answer-input-toggle-label").textContent = enabled ? "こたえを入力する ON" : "こたえを入力する OFF";
}

function bindVisualGym() {
  qs("#visual-answer-input-toggle").addEventListener("click", () => {
    SETTINGS.visualRequireTotalInput = !SETTINGS.visualRequireTotalInput;
    saveSettings();
    renderVisualAnswerInputToggle();
  });
  qs("#visual-submit").addEventListener("click", () => applyVisual(KakezanVisual.submitTotal(state.visual)));
  qs("#visual-undo").addEventListener("click", () => applyVisual(KakezanVisual.undoDigit(state.visual)));
  qs("#visual-retry").addEventListener("click", () => {
    if (!visualCanAct()) return;
    applyVisual(KakezanVisual.retryGame(state.visual));
    startChallengeTimer();
  });
  window.addEventListener("keydown", event => {
    if (!visualCanAct() || event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.target?.matches?.('input, textarea, [contenteditable="true"]')) return;
    if (/^[0-9]$/.test(event.key)) { event.preventDefault(); chooseVisualDigit(Number(event.key)); }
    if (event.key === "Backspace") { event.preventDefault(); applyVisual(KakezanVisual.undoDigit(state.visual)); }
    if (event.key === "Enter") {
      event.preventDefault();
      if (state.visual.phase === "factor-error" || state.visual.phase === "total-error") {
        applyVisual(KakezanVisual.retryGame(state.visual));
        startChallengeTimer();
      } else applyVisual(KakezanVisual.submitTotal(state.visual));
    }
  });
}
