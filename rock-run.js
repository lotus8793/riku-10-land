"use strict";

// The runner shares the dojo's source pool and rewards, while recording answers
// against the original calculation category for statistics and daily review.
(() => {
  const BEST_KEY = "riku10v2-rockrun-best";
  const $ = (id) => document.getElementById(`run-${id}`);
  const stage = $("stage");
  const panels = ["ready", "question", "rest", "result"];
  const pools = { simple: simpleProblems, bridge: fireProblems, minus: minusProblems, ice: iceProblems, multiply: multiplyProblems };
  let phase = "ready";
  let previousPhase = "running";
  let queue = [];
  let current = null;
  let lastItem = "";
  let seconds = SETTINGS.rockRunSeconds;
  let remaining = seconds * 1000;
  let maxHearts = SETTINGS.rockRunHearts;
  let hearts = maxHearts;
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let distance = 0;
  let frame = null;
  let lastFrame = 0;
  let feedbackTime = 0;
  let best = Math.max(0, Number(localStorage.getItem(BEST_KEY)) || 0);
  let runStartBest = best;
  let rushLeft = 0;
  let power = 0;
  let evolveLeft = 0;
  let evolvePhase = "running";
  let evolveTarget = 0;
  let evolveCued = false;
  let flyLeft = 0;
  let hitStop = 0;
  let moveTime = 0;
  let struck = true;
  let special = "close";
  let reached = 0;
  let audio = null;
  let noise = null;

  // Every 500m the partner takes the next step along its own evolution line
  // (ending in Mega Evolution when it has one), and the smash gets flashier
  // up to 1000m, so the bigger effects arrive together with the new form.
  const MILESTONE = 500;
  const EVOLVE_MS = 4200;
  // Answers this quick earn a flight over the rock instead of a smash.
  const FLY_WITHIN = 2000;
  // Even quicker answers alternate two signature moves that match the current
  // form's type: a long-range "far" move on the distant rock, or a dash-in back
  // flip "close" strike (Pikachu's line: Thunder and Iron Tail).
  const SPECIAL_WITHIN = 1500;
  const STRIKE_AT = { smash: 0, far: 150, close: 470 };
  const TAIL_DASH_MS = 280;
  // type: [far move, how it reaches the rock (sky / beam / rise), close move, colour]
  const TYPE_MOVES = {
    electric: ["かみなり", "sky", "アイアンテール", "#ffe45c"],
    fire: ["だいもんじ", "beam", "フレアドライブ", "#ff7a3d"],
    water: ["ハイドロポンプ", "beam", "アクアテール", "#4aa8ff"],
    grass: ["ソーラービーム", "beam", "リーフブレード", "#6fd25a"],
    ice: ["ふぶき", "beam", "つららおとし", "#9be7ff"],
    fighting: ["はどうだん", "beam", "インファイト", "#ff8a4d"],
    poison: ["ヘドロばくだん", "beam", "どくづき", "#c070e0"],
    ground: ["だいちのちから", "rise", "ドリルライナー", "#e0b060"],
    flying: ["エアスラッシュ", "beam", "ブレイブバード", "#a9d0ff"],
    psychic: ["サイコキネシス", "beam", "しねんのずつき", "#ff6fb0"],
    bug: ["むしのさざめき", "beam", "シザークロス", "#b5d83a"],
    rock: ["ストーンエッジ", "rise", "もろはのずつき", "#d4bc84"],
    ghost: ["シャドーボール", "beam", "シャドークロー", "#9a7fe8"],
    dragon: ["りゅうせいぐん", "sky", "げきりん", "#7f8cff"],
    dark: ["あくのはどう", "beam", "かみくだく", "#8a6a9a"],
    steel: ["ラスターカノン", "beam", "アイアンテール", "#dfe9f3"],
    fairy: ["ムーンフォース", "beam", "じゃれつく", "#ffa6d8"],
    normal: ["はかいこうせん", "beam", "すてみタックル", "#fff3c4"],
  };
  const FLY_MS = 900;
  const FLY_END = .8;
  const SMASH_WORDS = ["いわくだき！", "ドカーン！\nいわくだき！！", "ちょう いわくだき！！！"];
  let runner = { shiny: false, form: 0, path: [{ id: 25, name: "ピカチュウ", type: "electric" }] };

  // Road perspective shared by the scenery and the rock: depth z=1 is the stage's
  // bottom edge and larger z approaches the horizon in run-trail.svg. Because the
  // rock sits on the road and everything scrolls at one speed, the partner reads
  // as running toward the rock instead of the rock sliding toward the partner.
  const world = $("world");
  const rock = $("rock");
  const HORIZON = 154 / 340;
  const FAR = 12;
  const NEAR = .45;
  const ROCK_SPAWN = 9;
  const RUSH_MS = 260;
  const PROP_TYPES = [
    // type, count, height at z=1 (share of ground height), width/height, |lateral| range (stage widths at z=1)
    ["tree", 12, 1.15, .76, .5, 1],
    ["bush", 8, .42, 1.48, .37, .62],
    ["flower", 8, .16, 1.8, .35, .55],
    ["grass", 12, .15, 1.5, .34, .5],
    ["pebble", 14, .07, 2.4, .04, .29],
  ];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let view = { width: 0, height: 0, horizon: 0, ground: 0, hitZ: 1.3, rockScale: 1 };
  let rockZ = 5;
  const props = PROP_TYPES.flatMap(([type, count, size, aspect, minLat, maxLat]) =>
    Array.from({ length: count }, (_, i) => {
      const el = document.createElement("div");
      el.className = `run-prop run-prop-${type}`;
      world.append(el);
      const prop = { el, size, aspect, minLat, maxLat, side: i % 2 ? 1 : -1, z: NEAR + (FAR - NEAR) * (i + Math.random()) / count };
      return scatter(prop);
    }));

  function scatter(prop) {
    prop.lat = prop.side * (prop.minLat + Math.random() * (prop.maxLat - prop.minLat));
    prop.flip = Math.random() < .5 ? -1 : 1;
    return prop;
  }

  function measure() {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (!width || !height) return;
    const horizon = height * HORIZON;
    const ground = height - horizon;
    // The rock "hits" where the partner's feet touch the road.
    const hitZ = ground / Math.max(20, ground - 45);
    view = { width, height, horizon, ground, hitZ, rockScale: ground * .9 * hitZ / 138 };
    props.forEach((prop) => {
      const h = prop.size * ground;
      const w = h * prop.aspect;
      Object.assign(prop.el.style, { width: `${w}px`, height: `${h}px`, left: `${-w / 2}px`, top: `${-h}px` });
    });
    renderWorld();
  }

  function runSpeed() {
    return (ROCK_SPAWN - view.hitZ) / Math.min(seconds, 8);
  }

  function place(el, lat, z, scale, opacity) {
    const x = view.width / 2 + lat * view.width / z;
    const y = view.horizon + view.ground / z;
    el.style.transform = `translate(${x}px, ${y}px) scale(${scale[0] / z}, ${scale[1] / z})`;
    el.style.opacity = Math.max(0, Math.min(1, opacity));
    el.style.zIndex = Math.round(1000 - z * 50);
  }

  function renderWorld() {
    props.forEach((prop) => place(prop.el, prop.lat, prop.z, [prop.flip, 1], (FAR - prop.z) / 1.5));
    // Fade the next rock in over the rise, and out again once a flight passes it.
    place(rock, 0, rockZ, [view.rockScale, view.rockScale], Math.min((ROCK_SPAWN + .2 - rockZ) / 1.2, (rockZ - FLY_END) / (view.hitZ - FLY_END)));
  }

  function advance(step) {
    distance += step * 5;
    if (reduceMotion.matches) return;
    props.forEach((prop) => {
      prop.z -= step;
      if (prop.z < NEAR) scatter(prop).z += FAR - NEAR;
    });
  }

  function setPhase(value) {
    phase = value;
    stage.dataset.phase = value;
    stage.classList.toggle("is-moving", value === "running" || value === "success" || value === "rush");
  }

  function showPanel(name) {
    panels.forEach((panel) => $(panel).classList.toggle("is-hidden", panel !== name));
  }

  function sourceItems() {
    return historicalWrongItems().flatMap((item) => {
      const problem = pools[item.mode]?.find((p) => statKeyFn(item.mode)(p) === item.key);
      if (!problem) return [];
      const a = item.mode === "bridge" ? problem.displayA : problem.a;
      const b = item.mode === "bridge" ? problem.displayB : problem.b;
      const subtract = item.mode === "minus" || item.mode === "ice";
      const answer = item.mode === "multiply" ? a * b : subtract ? a - b : a + b;
      return [{ ...item, problem, answer, label: `${a} ${item.mode === "multiply" ? "×" : subtract ? "−" : "+"} ${b}` }];
    });
  }

  function renderHud() {
    $("hearts").textContent = `${"♥ ".repeat(hearts)}${"♡ ".repeat(maxHearts - hearts)}`.trim();
    $("hearts").setAttribute("aria-label", `のこり${hearts}回`);
    $("combo").textContent = combo;
    $("distance").textContent = Math.floor(distance);
  }

  // Pokémon sprites are never bundled (see README); PokeAPI images are cached by
  // the service worker after the first online visit.
  function spriteUrl(id, { back = false, shiny = false } = {}) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${back ? "back/" : ""}${shiny ? "shiny/" : ""}${id}.png`;
  }

  function sprite(img, id, { back = false, shiny = false, fallbackId = id }) {
    img.onerror = () => {
      img.onerror = null;
      img.src = spriteUrl(fallbackId, { back });
    };
    img.src = spriteUrl(id, { back, shiny });
  }

  // Fetch every form once so the evolution cut-ins also work offline later.
  function prefetchForms() {
    runner.path.forEach(({ id }) => [false, true].forEach((back) => {
      new Image().src = spriteUrl(id, { back });
      if (runner.shiny) new Image().src = spriteUrl(id, { back, shiny: true });
    }));
  }

  function formInfo(id, fallbackName) {
    const mega = RUN_MEGAS[id];
    if (mega) return { id, name: `メガ${RUN_FORMS[mega[0]][0]}${mega[1]}`, type: mega[2], mega: true };
    const form = RUN_FORMS[id];
    return { id, name: form?.[0] ?? fallbackName, type: form?.[3] ?? "normal" };
  }

  // Branching lines (Eevee, Ralts, …) and X/Y Megas pick one at random per run.
  function evolutionPath(id, name) {
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    const path = [formInfo(id, name)];
    for (let next = RUN_FORMS[id]?.[1]; next?.length; next = RUN_FORMS[id]?.[1]) {
      id = pick(next);
      path.push(formInfo(id));
    }
    const megas = RUN_FORMS[id]?.[2];
    if (megas?.length) path.push(formInfo(pick(megas)));
    return path;
  }

  function chooseRunner() {
    const species = STICKERS.find((s) => s.id === state.partner);
    const caught = species && state.caught[species.id];
    const owned = Boolean(caught?.n || caught?.s);
    runner = {
      shiny: Boolean(owned && caught.s),
      form: 0,
      path: owned ? evolutionPath(species.id, species.name) : evolutionPath(25, "ピカチュウ"),
    };
    showRunner();
  }

  function currentForm() {
    return runner.path[runner.form];
  }

  function moves() {
    return TYPE_MOVES[currentForm().type] ?? TYPE_MOVES.normal;
  }

  function showRunner() {
    const form = currentForm();
    const img = $("partner");
    sprite(img, form.id, { back: true, shiny: runner.shiny, fallbackId: form.id });
    img.alt = form.name;
  }

  function setPower(value) {
    power = value;
    stage.dataset.power = value;
  }

  function enter() {
    leave();
    queue = sourceItems();
    seconds = SETTINGS.rockRunSeconds;
    score = 0;
    combo = 0;
    distance = 0;
    maxHearts = SETTINGS.rockRunHearts;
    hearts = maxHearts;
    current = null;
    chooseRunner();
    prefetchForms();
    reached = 0;
    setPower(0);
    $("evolve").classList.add("is-hidden");
    setPhase("ready");
    showPanel("ready");
    const tab = qs('[data-mode="rockrun"]');
    const tabs = tab.parentElement;
    tabs.scrollLeft = tab.offsetLeft - tabs.offsetLeft - (tabs.clientWidth - tab.clientWidth) / 2;
    renderHud();
    measure();
    rockZ = view.hitZ + (ROCK_SPAWN - view.hitZ) * .45;
    renderWorld();
    $("pause").classList.add("is-hidden");
    $("stage-caption").textContent = "ポケモンと にがてを こえていこう！";
    $("time-rule").textContent = `1もん ${seconds}びょう`;
    $("hearts-rule").textContent = `♥ ${maxHearts}かいまで`;
    $("best").textContent = `さいこうきろく：いわ ${best}こ`;
    $("start").disabled = !queue.length;
    $("source-note").textContent = queue.length
      ? `にがて道場の ${queue.length}しゅるいから しゅつだい。せいかいで コインゲージ2ばい！`
      : WEAKNESS_SOURCE_MODES.some(weaknessModeEnabled)
        ? "まだ にがて問題は ないよ。ジムで まちがえた問題が ここに あつまるよ。"
        : "保護者の設定で、にがて問題のカテゴリを えらんでね。";
  }

  function leave() {
    cancelAnimationFrame(frame);
    frame = null;
    lastFrame = 0;
    setPhase("ready");
    $("fragments").replaceChildren();
  }

  function start() {
    queue = sourceItems();
    if (!queue.length) return enter();
    state.dojo.started = false;
    state.weakness.started = false;
    seconds = SETTINGS.rockRunSeconds;
    runStartBest = best;
    maxHearts = SETTINGS.rockRunHearts;
    hearts = maxHearts;
    score = 0;
    combo = 0;
    maxCombo = 0;
    distance = 0;
    lastItem = "";
    chooseRunner();
    reached = 0;
    setPower(0);
    $("evolve").classList.add("is-hidden");
    renderHud();
    $("pause").classList.remove("is-hidden");
    next();
    cancelAnimationFrame(frame);
    lastFrame = performance.now();
    frame = requestAnimationFrame(tick);
    // Unlock audio inside the tap so later effects can play from animation frames.
    sound("start");
  }

  function choicesFor(answer) {
    const values = new Set([answer]);
    // Nearby numbers keep the four cards useful for both small sums and九九.
    const offsets = current.mode === "multiply" ? [1, -1, 2, -2, 10, -10, 3, -3] : [1, -1, 2, -2, 3, -3];
    while (values.size < 4) {
      const offset = offsets.splice(Math.floor(Math.random() * offsets.length), 1)[0];
      const value = answer + offset;
      if (value >= 0 && value <= 99) values.add(value);
    }
    return [...values].sort(() => Math.random() - .5);
  }

  function next() {
    if (state.activeMode !== "rockrun") return;
    if (!queue.length) queue = sourceItems();
    if (!queue.length) return enter();
    let index = queue.findIndex((item) => `${item.mode}:${item.key}` !== lastItem);
    if (index < 0) index = 0;
    current = queue.splice(index, 1)[0];
    lastItem = `${current.mode}:${current.key}`;
    remaining = seconds * 1000;
    state.questionAt[current.mode] = Date.now();
    setPhase("running");
    showPanel("question");
    $("fragments").replaceChildren();
    stage.dataset.move = "";
    stage.classList.remove("is-struck");
    $("category").textContent = `にがてチャレンジ · ${MODE_LABELS[current.mode]}`;
    $("equation").textContent = `${current.label} = ?`;
    $("feedback").textContent = "こたえを えらんで いわくだき！";
    $("feedback").className = "run-feedback";
    $("stage-caption").textContent = "いわに むかって ダッシュ！";
    $("continue").classList.add("is-hidden");
    $("choices").replaceChildren();
    choicesFor(current.answer).forEach((value, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "run-answer";
      button.dataset.value = value;
      const key = document.createElement("span");
      key.className = "run-answer-key";
      key.textContent = index + 1;
      button.append(key, document.createTextNode(value));
      button.setAttribute("aria-label", `こたえ ${value}`);
      button.addEventListener("click", () => answer(value));
      $("choices").append(button);
    });
    renderTime();
  }

  function renderTime() {
    const ratio = Math.max(0, remaining / (seconds * 1000));
    $("seconds").textContent = (remaining / 1000).toFixed(1);
    $("time-fill").style.transform = `scaleX(${ratio})`;
    $("time-track").setAttribute("aria-valuemax", seconds);
    $("time-track").setAttribute("aria-valuenow", (remaining / 1000).toFixed(1));
    rockZ = view.hitZ + runSpeed() * remaining / 1000;
    renderWorld();
    stage.classList.toggle("is-urgent", ratio < .3 && phase === "running");
    $("countdown").classList.toggle("is-urgent", ratio < .3);
  }

  function tick(now) {
    const delta = Math.max(0, now - lastFrame);
    lastFrame = now;
    if (state.activeMode !== "rockrun") return leave();
    // Catch/mission reward overlays must never consume answer or feedback time.
    const blocked = overlayActive || document.hidden;
    stage.classList.toggle("is-blocked", blocked);
    if (!blocked && phase === "running") {
      remaining = Math.max(0, remaining - delta);
      advance(runSpeed() * delta / 1000);
      $("distance").textContent = Math.floor(distance);
      renderTime();
      if (remaining <= 0) answer(null);
      else milestone();
    } else if (!blocked && phase === "success") {
      const move = stage.dataset.move;
      moveTime += delta;
      if (!struck && moveTime >= STRIKE_AT[move]) strike();
      if (move === "fly" && flyLeft > 0) {
        // Soar forward so the untouched rock passes underneath.
        const step = Math.max(0, rockZ - FLY_END) * Math.min(1, delta / flyLeft);
        flyLeft -= delta;
        rockZ -= step;
        advance(step);
      } else if (move === "close" && !struck) {
        // Dash right up to the rock before the flip.
        const left = Math.max(1, TAIL_DASH_MS - moveTime + delta);
        const step = Math.max(0, rockZ - (view.hitZ + .15)) * Math.min(1, delta / left);
        rockZ -= step;
        advance(step);
      } else if (!struck) {
        // The far move is on its way to the rock.
      } else if (hitStop > 0) {
        // Freeze the road for an instant on impact so the smash lands hard.
        hitStop -= delta;
      } else {
        // Then burst through the rubble, easing back to running speed.
        const boost = 1 + 2.5 * Math.max(0, feedbackTime - 300) / 800;
        advance(runSpeed() * boost * delta / 1000);
      }
      $("distance").textContent = Math.floor(distance);
      renderWorld();
      feedbackTime -= delta;
      if (feedbackTime <= 0) next();
      else milestone();
    } else if (!blocked && phase === "evolve") {
      evolveLeft -= delta;
      if (!evolveCued && evolveLeft < EVOLVE_MS * .38) {
        evolveCued = true;
        sound(runner.path[evolveTarget].mega ? "mega" : "evolved");
      }
      if (evolveLeft <= 0) endEvolve();
    } else if (!blocked && phase === "rush") {
      // A wrong answer charges straight into the rock rather than teleporting it.
      const step = (rockZ - view.hitZ) * Math.min(1, delta / rushLeft);
      rushLeft -= delta;
      advance(step);
      rockZ -= step;
      if (rushLeft <= 0) collide();
      renderWorld();
    }
    if (phase !== "finished" && phase !== "ready") frame = requestAnimationFrame(tick);
  }

  function collide() {
    rockZ = view.hitZ;
    setPhase("collision");
    $("distance").textContent = Math.floor(distance);
    sound("crash");
    if (!hearts) finish();
  }

  function milestone() {
    const tier = Math.floor(distance / MILESTONE);
    if (tier <= reached) return;
    reached = tier;
    if (runner.path[runner.form + 1]) return startEvolve(runner.form + 1);
    if (Math.min(tier, 2) <= power) return;
    setPower(Math.min(tier, 2));
    $("stage-caption").textContent = "パワーアップ！ いわくだきが もっと すごく なった！";
    sound("power");
  }

  function startEvolve(target) {
    const from = currentForm();
    const to = runner.path[target];
    evolvePhase = phase;
    evolveTarget = target;
    evolveLeft = EVOLVE_MS;
    evolveCued = false;
    setPhase("evolve");
    const cutIn = $("evolve");
    cutIn.dataset.kind = to.mega ? "mega" : "evolve";
    sprite($("evolve-from"), from.id, { shiny: runner.shiny });
    sprite($("evolve-to"), to.id, { shiny: runner.shiny });
    $("evolve-line1").textContent = to.mega ? `${from.name}の メガストーンが\nはんのうした！` : `おや……？\n${from.name}の ようすが……！`;
    $("evolve-line2").textContent = to.mega ? `${from.name}は ${to.name}に\nメガシンカした！` : `おめでとう！\n${from.name}は ${to.name}に しんかした！`;
    // Restart the CSS timeline for a second cut-in in the same run.
    cutIn.classList.add("is-hidden");
    void cutIn.offsetWidth;
    cutIn.classList.remove("is-hidden");
    sound("evolving");
  }

  function endEvolve() {
    // Keep the cut-in out of the per-problem answer time statistics.
    if (evolvePhase === "running") state.questionAt[current.mode] += EVOLVE_MS;
    runner.form = evolveTarget;
    showRunner();
    setPower(Math.max(power, Math.min(reached, 2)));
    $("evolve").classList.add("is-hidden");
    const form = currentForm();
    $("stage-caption").textContent = form.mega ? `${form.name}の パワーで つきすすめ！` : `${form.name}に なった！ このまま つきすすめ！`;
    setPhase(evolvePhase);
  }

  // Centre the effect layer on the rock; returns the rock's middle height.
  function aim() {
    const scale = view.rockScale / rockZ;
    const fragments = $("fragments");
    const y = view.horizon + view.ground / rockZ - 69 * scale;
    fragments.style.left = `${view.width / 2}px`;
    fragments.style.top = `${y}px`;
    return y;
  }

  function strike() {
    const move = stage.dataset.move;
    struck = true;
    stage.classList.add("is-struck");
    hitStop = 70 + power * 30 + (move === "smash" ? 0 : 50);
    shatter(move);
    sound(move);
  }

  function shatter(move) {
    const fragments = $("fragments");
    aim();
    const special = move === "far" || move === "close";
    const count = 12 + power * 8 + Math.min(combo, 10) + (special ? 8 : 0);
    const reach = 1 + power * .35 + (special ? .25 : 0);
    for (let i = 0; i < count; i += 1) {
      const fragment = document.createElement("i");
      const angle = i / count * Math.PI * 2;
      fragment.style.setProperty("--dx", `${Math.cos(angle) * (100 + Math.random() * 90) * reach}px`);
      fragment.style.setProperty("--dy", `${(Math.sin(angle) * 90 - 65) * reach}px`);
      fragment.style.setProperty("--spin", `${(i % 2 ? 1 : -1) * 240}deg`);
      fragments.append(fragment);
    }
    // Sparks from 500m (always for signature moves, in the move's colour);
    // rainbow sparks and a second shockwave from 1000m.
    const sparks = Math.max(power, special ? 1 : 0) * 8;
    for (let i = 0; i < sparks; i += 1) {
      const spark = document.createElement("i");
      const angle = (i + .5) / sparks * Math.PI * 2;
      spark.className = "run-spark";
      spark.style.setProperty("--dx", `${Math.cos(angle) * 150 * reach}px`);
      spark.style.setProperty("--dy", `${Math.sin(angle) * 110 * reach}px`);
      spark.style.setProperty("--rot", `${angle * 180 / Math.PI + 90}deg`);
      spark.style.setProperty("--hue", `${i * 360 / sparks}deg`);
      fragments.append(spark);
    }
    for (let i = 0; i < power + (special ? 1 : 0); i += 1) {
      const ring = document.createElement("i");
      ring.className = "run-ring";
      ring.style.animationDelay = `${i * .14}s`;
      fragments.append(ring);
    }
    if (move === "close") {
      const slash = document.createElement("i");
      slash.className = "run-slash";
      fragments.append(slash);
    }
    showImpact(special ? `${moveName(move)}！` : SMASH_WORDS[power]);
  }

  function moveName(move) {
    const [far, , close] = moves();
    return move === "far" ? far : close;
  }

  // The far move reaches the rock from the sky, as a beam from the partner, or
  // rising out of the ground beneath it.
  function farShot() {
    const y = aim();
    const style = moves()[1];
    const shot = document.createElement("i");
    shot.className = `run-shot run-shot-${style}`;
    const partnerY = view.height - 95;
    shot.style.height = `${style === "sky" ? y + 10 : style === "beam" ? Math.max(20, partnerY - y) : 120}px`;
    $("fragments").append(shot);
  }

  function showImpact(text) {
    const impact = $("impact");
    impact.textContent = text;
    impact.style.animation = "none";
    void impact.offsetWidth;
    impact.style.animation = "";
  }

  // Rock-run sounds share one context and a compressor, so the layered smash
  // (crack, boom, rubble, chime) stays punchy without clipping on iPad speakers.
  function sound(kind) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!audio) {
      audio = new AudioContext();
      noise = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      const comp = audio.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 8;
      comp.ratio.value = 6;
      comp.attack.value = .002;
      comp.release.value = .18;
      comp.connect(audio.destination);
      audio.bus = audio.createGain();
      audio.bus.gain.value = .9;
      audio.bus.connect(comp);
    }
    if (audio.state === "suspended") audio.resume();
    const out = audio.bus;
    const t = audio.currentTime + .01;
    const tone = (freq, at, length, { type = "triangle", volume = .16, to } = {}) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, at);
      if (to) osc.frequency.exponentialRampToValueAtTime(to, at + length);
      gain.gain.setValueAtTime(.0001, at);
      gain.gain.exponentialRampToValueAtTime(volume, at + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, at + length);
      osc.connect(gain).connect(out);
      osc.start(at);
      osc.stop(at + length + .02);
    };
    const hiss = (at, length, volume, { type = "lowpass", from = 3000, to = 200, q = .7, attack = .003 } = {}) => {
      const src = audio.createBufferSource();
      const filter = audio.createBiquadFilter();
      const gain = audio.createGain();
      src.buffer = noise;
      filter.type = type;
      filter.Q.value = q;
      filter.frequency.setValueAtTime(from, at);
      filter.frequency.exponentialRampToValueAtTime(to, at + length);
      gain.gain.setValueAtTime(.0001, at);
      gain.gain.exponentialRampToValueAtTime(volume, at + attack);
      gain.gain.exponentialRampToValueAtTime(.0001, at + length);
      src.connect(filter).connect(gain).connect(out);
      src.start(at, Math.random() * .3);
      src.stop(at + length + .02);
    };
    // The chime climbs a semitone per combo (up to an octave), so keeping a
    // streak literally sounds better and better.
    const lift = 2 ** (Math.min(Math.max(combo - 1, 0), 12) / 12);
    const chime = (at, notes, gap, volume = .12) => notes.forEach((f, i) => {
      tone(f * lift, at + i * gap, .26, { volume });
      tone(f * lift * 2, at + i * gap, .12, { type: "sine", volume: volume * .35 });
    });
    const C = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98, 2093];
    if (kind === "start") {
      chime(t, [659.25, 783.99, 1046.5], .08);
    } else if (kind === "smash") {
      // パキッ (crack) + ドンッ (boom) + ガラガラ (crumble) + カラカラ (pebbles).
      hiss(t, .07, .9, { type: "highpass", from: 2400, to: 1200 });
      tone(170 - power * 20, t, .24 + power * .12, { type: "sine", volume: .95, to: 42 });
      tone(95, t, .1, { type: "square", volume: .18, to: 50 });
      hiss(t + .01, .3 + power * .12, .7, { from: 3200 + power * 1800, to: 260 });
      for (let i = 0; i < 5 + power * 4; i += 1) {
        hiss(t + .1 + Math.random() * (.35 + power * .1), .05, .16 + Math.random() * .12, { type: "bandpass", from: 1800 + Math.random() * 3200, to: 1500, q: 6 });
      }
      if (power >= 1) {
        // ビリッ: an electric zap and a deeper second boom.
        tone(2200, t + .02, .2, { type: "sawtooth", volume: .09, to: 180 });
        tone(1600, t + .07, .14, { type: "square", volume: .06, to: 120 });
        tone(80, t + .05, .5, { type: "sine", volume: .6, to: 30 });
      }
      if (power >= 2) {
        // ズドーン: a rumbling tail and a bright rising swell.
        hiss(t + .08, .7, .45, { from: 900, to: 80 });
        tone(300, t + .05, .45, { type: "sawtooth", volume: .06, to: 1800 });
        [1046.5, 1318.5, 1567.98, 2093].forEach((f) => tone(f * lift, t + .32, .7, { volume: .05 }));
      }
      chime(t + .05, C.slice(0, 3 + power), .055 - power * .008);
      if (combo > 0 && combo % 5 === 0) sound("bonus");
    } else if (kind === "far" || kind === "close") {
      // The rock still breaks with the full smash, plus the move's own sound.
      sound("smash");
      const [, style, close] = moves();
      if (kind === "far" && style !== "sky") {
        // ズバーン: a rushing beam / eruption ending in a bright burst.
        hiss(t, .5, .6, { type: "bandpass", from: 500, to: 3800, q: 1.1, attack: .02 });
        tone(260, t, .4, { type: "sawtooth", volume: .08, to: 1300 });
        tone(90, t + .02, .7, { type: "sine", volume: .7, to: 30 });
      } else if (kind === "far") {
        // ピシャーン: a sharp crack, a falling zap and a long rolling rumble.
        hiss(t, .12, 1, { type: "highpass", from: 5000, to: 2500 });
        tone(3200, t, .3, { type: "sawtooth", volume: .12, to: 90 });
        tone(2400, t + .05, .22, { type: "square", volume: .07, to: 150 });
        hiss(t + .05, 1.1, .7, { from: 700, to: 50, attack: .04 });
        tone(70, t + .02, .9, { type: "sine", volume: .8, to: 28 });
      } else if (close === "アイアンテール") {
        // カキーン: an inharmonic metal clang under the boom.
        [1, 2.76, 5.4, 8.93].forEach((ratio, i) => tone(620 * ratio, t, .7 - i * .12, { type: "sine", volume: .16 / (i + 1) }));
        tone(1240, t, .08, { type: "square", volume: .08, to: 900 });
        tone(110, t, .45, { type: "sine", volume: .8, to: 35 });
      } else {
        // ドゴォ: a heavy body hit with a short swish.
        hiss(t, .18, .5, { type: "bandpass", from: 2600, to: 900, q: 1.5 });
        tone(130, t, .5, { type: "sine", volume: .9, to: 32 });
        tone(70, t + .04, .4, { type: "square", volume: .12, to: 40 });
      }
    } else if (kind === "charge") {
      // ピカッ: a quick rising buzz while the bolt comes down.
      tone(400, t, .14, { type: "sawtooth", volume: .07, to: 2400 });
    } else if (kind === "dash") {
      // シュバッ: a short whoosh into the flip.
      hiss(t, .3, .5, { type: "bandpass", from: 600, to: 2800, q: 1.2, attack: .05 });
      hiss(t + .3, .22, .35, { type: "bandpass", from: 2400, to: 700, q: 1.6, attack: .03 });
    } else if (kind === "fly") {
      // ヒュンッ whoosh up, then a gliding sparkle.
      hiss(t, .55, .55, { type: "bandpass", from: 350, to: 3600, q: 1.4, attack: .14 });
      tone(500, t, .45, { type: "sine", volume: .14, to: 1600 });
      chime(t + .28, C.slice(2, 5 + power), .06, .11);
      if (combo > 0 && combo % 5 === 0) sound("bonus");
    } else if (kind === "bonus") {
      // Combo bonus every 5: a quick fanfare on top.
      [783.99, 1046.5, 1318.5, 1567.98, 2093].forEach((f, i) => tone(f, t + .3 + i * .06, .3, { type: "square", volume: .05 }));
      [1046.5, 1318.5, 1567.98].forEach((f) => tone(f, t + .62, .7, { volume: .07 }));
    } else if (kind === "crash") {
      hiss(t, .25, .45, { from: 1000, to: 150 });
      tone(120, t, .25, { type: "sine", volume: .6, to: 50 });
      tone(330, t + .04, .18, { type: "sawtooth", volume: .08 });
      tone(220, t + .14, .25, { type: "sawtooth", volume: .08 });
    } else if (kind === "power") {
      [523.25, 783.99, 1046.5, 1567.98].forEach((f, i) => tone(f, t + i * .07, .3, { type: "square", volume: .06 }));
    } else if (kind === "evolving") {
      // A rising shimmer while the silhouettes swap faster and faster.
      for (let i = 0; i < 16; i += 1) tone(600 + i * 70, t + .6 + i * i * .0068, .12, { volume: .07 });
    } else if (kind === "evolved" || kind === "mega") {
      hiss(t, .5, .4, { from: 7000, to: 600 });
      tone(160, t, .5, { type: "sine", volume: .7, to: 40 });
      const fanfare = kind === "mega" ? C : C.slice(0, 4);
      fanfare.forEach((f, i) => tone(f, t + .1 + i * .1, .3, { type: "square", volume: .06 }));
      [1046.5, 1318.5, 1567.98].forEach((f) => tone(f, t + .1 + fanfare.length * .1, 1, { volume: .09 }));
    }
  }

  function answer(value) {
    if (phase !== "running" || overlayActive || document.hidden) return;
    // Charge the time since the last animation frame, including a tap on the deadline.
    const now = performance.now();
    remaining = Math.max(0, remaining - (now - lastFrame));
    lastFrame = now;
    const correct = remaining > 0 && value === current.answer;
    const took = seconds * 1000 - remaining;
    if (correct && took <= SPECIAL_WITHIN) special = special === "far" ? "close" : "far";
    const move = !correct ? "" : took <= SPECIAL_WITHIN ? special : took <= FLY_WITHIN ? "fly" : "smash";
    const flying = move === "fly";
    stage.dataset.move = move;
    moveTime = 0;
    struck = !correct || flying;
    setPhase(correct ? "success" : "rush");
    renderTime();
    $("equation").textContent = `${current.label} = ${current.answer}`;
    $("choices").querySelectorAll("button").forEach((button) => {
      button.disabled = true;
      button.classList.toggle("is-correct", Number(button.dataset.value) === current.answer);
      button.classList.toggle("is-wrong", !correct && value !== null && value !== current.answer && Number(button.dataset.value) === value);
    });
    recordAnswer(current.mode, current.problem, correct);
    if (correct) {
      score += 1;
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      if (score > best) {
        best = score;
        localStorage.setItem(BEST_KEY, String(best));
      }
      // Use the weakness gauge switches/cap, including the dojo's double coins.
      registerCorrect("weakness");
      if (coinEnabled("weakness")) registerCoinProgress();
      feedbackTime = move === "close" ? 1400 : 1100;
      stage.style.setProperty("--move-color", moves()[3]);
      stage.dataset.metal = moves()[2] === "アイアンテール" ? "1" : "";
      $("feedback").textContent = `${current.label} = ${current.answer}　せいかい！`;
      $("feedback").classList.add("is-good");
      if (flying) {
        flyLeft = FLY_MS;
        $("stage-caption").textContent = combo % 5 === 0 ? `${combo} コンボ ボーナス！ そらまで とんだ！` : combo > 1 ? `${combo} コンボ！ はやい！ そらを とんで ひらり！` : "はやい！ そらを とんで いわを こえた！";
        showImpact("ひらり！");
        sound("fly");
      } else if (move === "smash") {
        $("stage-caption").textContent = combo % 5 === 0 ? `${combo} コンボ ボーナス！ すごい！` : combo > 1 ? `${combo} コンボ！ そのちょうし！` : "バリーン！ みちが ひらけた！";
        strike();
      } else {
        $("stage-caption").textContent = `${combo % 5 === 0 ? `${combo} コンボ ボーナス！ ` : combo > 1 ? `${combo} コンボ！ ` : "すごく はやい！ "}${currentForm().name}の ${moveName(move)}！`;
        if (move === "far") farShot();
        sound(move === "close" ? "dash" : "charge");
      }
      popCombo();
    } else {
      hearts -= 1;
      combo = 0;
      registerWrong("weakness");
      const timedOut = value === null || remaining <= 0;
      $("feedback").textContent = `${timedOut ? "じかんぎれ！" : "ごっつん！"}　${current.label} = ${current.answer} だよ。`;
      $("feedback").classList.add("is-miss");
      $("stage-caption").textContent = "だいじょうぶ！ こたえを おぼえて もういちど。";
      $("continue").classList.toggle("is-hidden", hearts === 0);
      rushLeft = RUSH_MS;
    }
    renderHud();
  }

  function popCombo() {
    const badge = $("combo-badge");
    badge.dataset.big = combo >= 10 ? "2" : combo >= 5 ? "1" : "0";
    badge.classList.remove("is-pop");
    void badge.offsetWidth;
    badge.classList.add("is-pop");
  }

  function finish() {
    setPhase("finished");
    showPanel("result");
    $("pause").classList.add("is-hidden");
    $("result-title").textContent = score > runStartBest ? "さいこうきろく こうしん！" : "よく がんばったね！";
    $("result-score").textContent = score;
    $("result-answer").textContent = `さいごの こたえ：${current.label} = ${current.answer}`;
    const evolved = runner.form > 0 ? `${currentForm().name}に なれた！ ／ ` : "";
    $("result-best").textContent = `${Math.floor(distance)}m の ぼうけん ／ ${evolved}さいだい ${maxCombo} コンボ ／ さいこうきろく：いわ ${best}こ`;
    cancelAnimationFrame(frame);
  }

  function pause() {
    if (!["running", "success", "collision", "rush", "evolve"].includes(phase)) return;
    if (phase === "running" && !document.hidden && !overlayActive) {
      const now = performance.now();
      remaining = Math.max(0, remaining - (now - lastFrame));
      lastFrame = now;
      if (remaining <= 0) return answer(null);
    }
    previousPhase = phase;
    setPhase("paused");
    showPanel("rest");
    $("pause").classList.add("is-hidden");
  }

  new ResizeObserver(measure).observe(stage);
  $("start").addEventListener("click", start);
  $("retry").addEventListener("click", start);
  $("home").addEventListener("click", enter);
  $("continue").addEventListener("click", () => { if (phase === "collision") next(); });
  $("pause").addEventListener("click", pause);
  $("resume").addEventListener("click", () => {
    if (phase !== "paused") return;
    lastFrame = performance.now();
    // Keep time spent in another app out of per-problem response statistics.
    if (previousPhase === "running") state.questionAt[current.mode] = Date.now() - (seconds * 1000 - remaining);
    setPhase(previousPhase);
    showPanel("question");
    $("pause").classList.remove("is-hidden");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.activeMode === "rockrun") pause();
  });
  window.addEventListener("keydown", (event) => {
    if (state.activeMode !== "rockrun" || event.repeat || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (phase === "running" && /^[1-4]$/.test(event.key)) {
      event.preventDefault();
      $("choices").children[Number(event.key) - 1]?.click();
    } else if (event.key === "Escape") {
      event.preventDefault();
      if (phase === "paused") $("resume").click();
      else pause();
    }
  });
  [["seconds", "rockRunSeconds", 5, 30], ["hearts", "rockRunHearts", 1, 5]].forEach(([id, key, min, max]) => {
    const input = qs(`#set-rockrun-${id}`);
    input.value = SETTINGS[key];
    input.addEventListener("change", () => {
      const value = Number(input.value);
      if (Number.isInteger(value) && value >= min && value <= max) {
        SETTINGS[key] = value;
        saveSettings();
      }
      input.value = SETTINGS[key];
    });
  });
  window.rockRun = { enter, leave };
})();
