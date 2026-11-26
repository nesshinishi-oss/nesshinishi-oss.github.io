/* ============================================================
   パチモン — バトルエンジン v2
   6能力 / 18タイプ / 特性 / もちもの / 天候 / 設置技 対応
   ============================================================ */
'use strict';

let B = null;
let battleLoopId = 0;

/* ---------------- 乱数 ----------------
   ネット対戦では 両方の ゲームで まったく おなじ 乱数を つかう ひつようが
   あるため、シミュレーション用の 乱数は brng() に まとめています。
   エフェクトなどの 見た目だけの 乱数は Math.random() のままです。 */
function makeBattleRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function brng() { return B && B.rng ? B.rng() : Math.random(); }
function bri(a, b) { return Math.floor(brng() * (b - a + 1)) + a; }

/* ---------------- 小物 ---------------- */
function bStat(m, key) { return m ? (m[key] || 1) : 1; }
function stageMul(st) { st = clamp(st || 0, -6, 6); return st >= 0 ? (2 + st) / 2 : 2 / (2 - st); }
function effStat(mon, key) {
  let v = bStat(mon, key);
  if (mon.stages && key in mon.stages) v *= stageMul(mon.stages[key]);
  if (key === 'atk' && mon.status === 'brn' && mon.ability !== 'guts') v *= 0.5;
  if (key === 'spe' && mon.status === 'par') v *= 0.5;
  if (mon.heldItem === 'choiceband' && key === 'atk') v *= 1.5;
  if (mon.heldItem === 'choicespecs' && key === 'spa') v *= 1.5;
  if (mon.heldItem === 'choicescarf' && key === 'spe') v *= 1.5;
  return Math.max(1, Math.floor(v));
}
function rawStat(mon, key) { return Math.max(1, Math.floor(bStat(mon, key))); }
function isAlive(m) { return !!m && m.hp > 0; }
function sideOf(mon) { return B && mon === B.enemy ? 'enemy' : 'player'; }
function otherSide(side) { return side === 'enemy' ? 'player' : 'enemy'; }
function monAt(side) { return side === 'enemy' ? B.enemy : activeMon(); }
function screensOf(side) { return side === 'enemy' ? B.enemyScreens : B.playerScreens; }
function wrapSel(side) { return side === 'enemy' ? '#enemy-wrap' : '#player-wrap'; }
function weatherLabel(w) {
  return { sun: 'にほんばれ', rain: 'あまごい', sand: 'すなあらし', hail: 'あられ' }[w] || '';
}
function weatherIcon(w) {
  return { sun: '☀', rain: '☂', sand: '≋', hail: '❄' }[w] || '';
}
function resetMonBattleState(mon) {
  if (!mon) return;
  mon.stages = zeroStages();
  mon.confusion = 0;
  mon.flinch = false;
  mon.protect = false;
  mon.protectCount = 0;
  mon.substitute = 0;
  mon.leechseed = false;
  mon.charging = null;
  mon.recharge = false;
  mon.choiceLock = null;
  mon.berryUsed = false;
  mon.focusUsed = false;
  mon.turnMoveId = null;
  mon.actedThisTurn = false;
}
function typeHas(mon, type) { return SPECIES[mon.species].types.includes(type); }

/* まもる: 1回目は かならず せいこう。れんぞくで つかうたびに
   せいこうりつが 1/3 ずつ さがる (100% → 33% → 11% → …)。 */
const PROTECT_DECAY = 1 / 3;
function protectChance(consecutiveUses) {
  if (consecutiveUses <= 0) return 1;
  return Math.pow(PROTECT_DECAY, consecutiveUses);
}
/* その わざが あいてを ねらう ものか。
   まもる / みがわり の はんていに つかう。 */
function moveTargetsFoe(move) {
  if (!move) return false;
  if (move.cat !== 'status') return true;
  const e = move.effect || {};
  if (e.kind === 'heal' || e.kind === 'screen' || e.kind === 'weather'
    || e.kind === 'haze' || e.kind === 'protect' || e.kind === 'substitute'
    || e.kind === 'rest') return false;
  if ((e.kind === 'stat' || e.kind === 'stat2') && e.target === 'self') return false;
  return true;
}
/* その わざが ダメージを あたえる ものか。
   ふいうちの せいこう はんていに つかう。 */
function isDamagingMoveId(id) {
  if (!id) return false;
  if (id === 'struggle') return true;
  const mv = MOVES[id];
  return !!mv && mv.cat !== 'status';
}
/* ターン はじめに、その ターンだけ 有効な 状態を クリアする。
   ひるみは「あいてより さきに うごいた とき」だけ 有効なので、
   ターンを またいで のこさない。 */
function clearTurnState() {
  for (const side of ['player', 'enemy']) {
    const m = monAt(side);
    if (!m) continue;
    m.protect = false;
    m.flinch = false;
    m.turnMoveId = null;
    m.actedThisTurn = false;
  }
}

/* ============================================================
   開始
   ============================================================ */
async function startBattle(enemyMon, opts = {}) {
  if (!G.party.length || battleActive) return;
  /* ひんしの パチモンしか いない ときは たたかわせない。
     まえの しょうぶで こうしゅも たおれていた ばあいの セーフティ。 */
  if (!G.party.some(m => m.hp > 0)) { await whiteout(); return; }
  /* せんとうふの が ひんしなら、げんきな 個体を 先頭に する */
  if (G.party[0].hp <= 0) {
    const alive = G.party.findIndex(m => m.hp > 0);
    if (alive > 0) G.party.unshift(G.party.splice(alive, 1)[0]);
  }
  battleActive = true;
  const st = {
    enemy: enemyMon,
    team: opts.team || [enemyMon],
    trainerId: opts.trainerId || null,
    isTrainer: !!opts.trainerId,
    busy: true, over: false, turnInterrupted: false,
    weather: null, weatherTurns: 0,
    playerScreens: { reflect: 0, lightscreen: 0 },
    enemyScreens: { reflect: 0, lightscreen: 0 },
    caught: false,
  };
  B = st;
  G.dex.seen.add(enemyMon.species);
  /* けいけんちの 分配は この しょうぶ ごとに リセット。
     先頭に 出た 個体だけ 100%、出ていない ひかえは 75%。 */
  G.party.forEach((m, i) => {
    m.hasLed = i === 0;
    resetMonBattleState(m);
  });
  for (const m of st.team) resetMonBattleState(m);

  player.walk = 0;
  setScreen('battle');
  resetBattleSprites();
  updateBattleUI();
  hideActions();
  $('#battle-log').textContent = '…';
  startBattleLoop();

  if (st.isTrainer) {
    const t = TRAINERS[st.trainerId];
    await say(`${t.name} が しょうぶを しかけてきた！`);
    Sfx.cry(st.enemy.species);
    await say(`${t.name} は ${monName(st.enemy)} を くりだした！`);
  } else {
    Sfx.cry(st.enemy.species);
    await say(`やせいの ${monName(st.enemy)} が とびだしてきた！`);
  }
  enterAnim('#enemy-wrap');
  await say(`ゆけっ！ ${monName(activeMon())}！`);
  await onEntry('enemy');
  await onEntry('player');
  st.busy = false;
  showMainActions();
}

/* ============================================================
   ネット対戦の 開始
   おたがいの パチモンを Lv50 の コピーにして たたかいます。
   けいけんち・おかねは もらえず、たいせん後の パーティは そのまま。
   ============================================================ */
async function startPvpBattle(oppTeamData, opts = {}) {
  if (!G.party.length || battleActive) return false;
  const mySide = opts.mySide === 'guest' ? 'guest' : 'host';
  const oppSide = mySide === 'host' ? 'guest' : 'host';
  const localTeam = G.party.map(pvpCloneMon).filter(Boolean);
  const remoteTeam = (oppTeamData || []).map(pvpCloneMon).filter(Boolean);
  if (!localTeam.length || !remoteTeam.length) return false;

  Net.originalParty = G.party;
  G.party = localTeam;
  battleActive = true;
  const st = {
    enemy: remoteTeam[0],
    team: remoteTeam,
    trainerId: null,
    isTrainer: false,
    busy: true, over: false, turnInterrupted: false,
    weather: null, weatherTurns: 0,
    playerScreens: { reflect: 0, lightscreen: 0 },
    enemyScreens: { reflect: 0, lightscreen: 0 },
    caught: false,
    pvp: true,
    mySide, oppSide,
    seed: (opts.seed >>> 0) || 1,
    rng: makeBattleRng((opts.seed >>> 0) || 1),
    turn: 0,
    oppName: opts.oppName || 'あいて',
    pvpEnding: false,
    /* たいせん中に つかった どうぐの 数。G.items は へらさない。 */
    pvpUsed: {},
  };
  B = st;
  localTeam.forEach((m, i) => { m.hasLed = i === 0; resetMonBattleState(m); });
  for (const m of remoteTeam) resetMonBattleState(m);

  player.walk = 0;
  setScreen('battle');
  resetBattleSprites();
  updateBattleUI();
  hideActions();
  const expBar = $('#player-exp') && $('#player-exp').parentElement;
  if (expBar) expBar.classList.add('hidden');
  const netBadge = $('#net-badge');
  if (netBadge) netBadge.classList.remove('hidden');
  $('#battle-log').textContent = '…';
  startBattleLoop();

  Sfx.cry(st.enemy.species);
  await say(`${st.oppName} との ネットたいせん！`, 900);
  await say(`${st.oppName} は ${monName(st.enemy)} を くりだした！`);
  enterAnim('#enemy-wrap');
  await say(`ゆけっ！ ${monName(activeMon())}！`);
  await onEntry('enemy');
  await onEntry('player');
  if (!B || B !== st || st.over) return false;
  st.busy = false;
  pvpLoop();
  return true;
}

function resetBattleSprites() {
  for (const sel of ['#enemy-wrap', '#player-wrap']) {
    const el = $(sel);
    if (!el) continue;
    el.className = 'sprite-wrap';
    el.style.opacity = '';
  }
}
function enterAnim(sel) {
  const wrap = $(sel);
  if (!wrap) return;
  wrap.classList.remove('faint');
  wrap.classList.add('entering');
  setTimeout(() => wrap.classList.remove('entering'), 600);
}
/* とうじょうした 側の とくせい (いかく) */
async function onEntry(side) {
  const st = B;
  if (!st || st.over) return;
  const src = side === 'enemy' ? st.enemy : activeMon();
  const target = side === 'enemy' ? activeMon() : st.enemy;
  if (!src || !target || src.hp <= 0 || target.hp <= 0) return;
  if (src.ability !== 'intimidate') return;
  if (!target.stages) target.stages = zeroStages();
  if ((target.stages.atk || 0) <= -6) return;
  target.stages.atk = Math.max(-6, (target.stages.atk || 0) - 1);
  Sfx.pop();
  updateBattleUI();
  await say(`${monName(src)} の いかくで ${monName(target)} の こうげきが さがった！`);
}
function startBattleLoop() {
  cancelAnimationFrame(battleLoopId);
  const step = () => {
    if (!B) return;
    drawBattleMon($('#enemy-canvas'), B.enemy, false);
    drawBattleMon($('#player-canvas'), activeMon(), true);
    battleLoopId = requestAnimationFrame(step);
  };
  battleLoopId = requestAnimationFrame(step);
}
function stopBattleLoop() { cancelAnimationFrame(battleLoopId); }
function drawBattleMon(canvas, mon, isPlayer) {
  if (!canvas) return;
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, canvas.width, canvas.height);
  if (!mon) return;
  drawPachimon(c, mon.species, canvas.width / 2, canvas.height - 30, 1.55, performance.now(),
    { flip: !isPlayer, shiny: !!mon.shiny });
}

/* ---------------- UI ---------------- */
async function say(text, ms = 760) {
  if (!B) return;
  const el = $('#battle-log');
  el.textContent = text;
  el.classList.remove('log-in');
  void el.offsetWidth;
  el.classList.add('log-in');
  await wait(ms);
}
function hideActions() { $('#battle-actions').innerHTML = ''; }
function focusActions() {
  const list = [...document.querySelectorAll('#battle-actions button:not([disabled])')]
    .filter(b => b.getClientRects().length > 0);
  if (!list.length) return;
  try { list[0].focus({ preventScroll: true }); } catch (e) { list[0].focus(); }
}
function showMainActions() {
  const a = $('#battle-actions');
  a.className = 'battle-actions';
  const runLabel = B && B.pvp ? 'こうさん' : 'にげる';
  a.innerHTML = `
    <button class="btn btn-yellow" data-act="move">わざ</button>
    <button class="btn btn-blue" data-act="bag">バッグ</button>
    <button class="btn btn-green" data-act="switch">こうかん</button>
    <button class="btn btn-red wide" data-act="run">${runLabel}</button>`;
  focusActions();
}
function moveCatLabel(mv) {
  if (mv.cat === 'phys') return 'ぶつり';
  if (mv.cat === 'spec') return 'とくしゅ';
  return 'へんか';
}
function showMoveMenu() {
  const me = activeMon();
  const a = $('#battle-actions');
  a.className = 'battle-actions moves';
  const usable = me.moves.filter(m => MOVES[m.id] && m.pp > 0 && (!me.choiceLock || me.choiceLock === m.id));
  if (!usable.length) {
    a.innerHTML = `<button class="btn btn-red wide" data-act="struggle">わるあがき</button>
      <button class="btn wide" data-act="back">もどる</button>`;
    focusActions();
    return;
  }
  a.innerHTML = me.moves.map((m, i) => {
    const mv = MOVES[m.id];
    if (!mv) return '';
    const locked = me.choiceLock && me.choiceLock !== m.id;
    const dis = m.pp <= 0 || locked;
    const pow = mv.power ? `・${mv.power}` : '';
    return `<button class="btn move-btn" data-act="move:${i}" ${dis ? 'disabled' : ''}>
      ${mv.name} <span class="pp">${m.pp}/${mv.pp}</span>
      <small style="color:${TYPES[mv.type].color}">${TYPES[mv.type].name}・${moveCatLabel(mv)}${pow}</small>
    </button>`;
  }).join('') + `<button class="btn wide" data-act="back">もどる</button>`;
  focusActions();
}
function showBagMenu() {
  const a = $('#battle-actions');
  a.className = 'battle-actions moves';
  const pvpLeft = id => (G.items[id] || 0) - (B && B.pvp && B.pvpUsed ? (B.pvpUsed[id] || 0) : 0);
  const usable = Object.entries(ITEMS).filter(([id, it]) =>
    pvpLeft(id) > 0 && ['ball', 'heal', 'status', 'revive', 'battle'].includes(it.kind));
  if (!usable.length) {
    a.innerHTML = `<div class="btn wide" style="pointer-events:none;text-align:left">つかえる どうぐが ない！</div>
      <button class="btn wide" data-act="back">もどる</button>`;
    focusActions();
    return;
  }
  a.innerHTML = usable.map(([id, it]) => {
    const isBall = it.kind === 'ball';
    const dis = isBall && (B.isTrainer || B.pvp);
    const why = isBall ? (B.pvp ? '（たいせん不可）' : '（トレーナーせん不可）') : '';
    return `<button class="btn ${isBall ? 'btn-blue' : 'btn-green'}" data-act="item:${id}" ${dis ? 'disabled' : ''}>
      ${it.name}<small>×${pvpLeft(id)}${dis ? why : ''}</small></button>`;
  }).join('') + `<button class="btn wide" data-act="back">もどる</button>`;
  focusActions();
}
function updateBattleUI() {
  if (!B) return;
  const me = activeMon(), foe = B.enemy;
  const expWrap = $('#player-exp') && $('#player-exp').parentElement;
  if (expWrap) expWrap.classList.toggle('hidden', !!B.pvp);
  const netBadge = $('#net-badge');
  if (netBadge) netBadge.classList.toggle('hidden', !B.pvp);
  const eName = $('#enemy-name');
  if (eName) eName.innerHTML = monName(foe) + statusTag(foe) + confusionTag(foe);
  const eLv = $('#enemy-lv'); if (eLv) eLv.textContent = 'Lv' + foe.level;
  const eTypes = $('#enemy-types'); if (eTypes) eTypes.innerHTML = typeChips(SPECIES[foe.species].types);
  const er = foe.hp / foe.maxHp;
  const eb = $('#enemy-hp');
  if (eb) { eb.style.width = (er * 100) + '%'; eb.className = hpClass(er); }
  const eNum = $('#enemy-hpnum'); if (eNum) eNum.textContent = `${foe.hp}/${foe.maxHp}`;

  if (me) {
    const pName = $('#player-name');
    if (pName) pName.innerHTML = monName(me) + statusTag(me) + confusionTag(me);
    const pLv = $('#player-lv'); if (pLv) pLv.textContent = 'Lv' + me.level;
    const pTypes = $('#player-types'); if (pTypes) pTypes.innerHTML = typeChips(SPECIES[me.species].types);
    const r = me.hp / me.maxHp;
    const pb = $('#player-hp');
    if (pb) { pb.style.width = (r * 100) + '%'; pb.className = hpClass(r); }
    const pNum = $('#player-hpnum'); if (pNum) pNum.textContent = `${me.hp}/${me.maxHp}`;
    const need = expToNext(me.level, SPECIES[me.species].growth);
    const pe = $('#player-exp');
    if (pe) pe.style.width = clamp(me.exp / Math.max(1, need) * 100, 0, 100) + '%';
  }
  renderFieldUI();
}
function confusionTag(m) {
  return m && m.confusion > 0 ? '<span class="status-tag conf">こんらん</span>' : '';
}
function renderFieldUI() {
  if (!B) return;
  const wb = $('#weather-badge');
  if (wb) {
    if (B.weather) {
      wb.classList.remove('hidden');
      wb.dataset.weather = B.weather;
      wb.innerHTML = `${weatherIcon(B.weather)} ${weatherLabel(B.weather)} <small>${B.weatherTurns}</small>`;
    } else wb.classList.add('hidden');
  }
  const fe = $('#field-effects');
  if (fe) {
    const chips = [];
    if (B.playerScreens.reflect > 0) chips.push('<span class="field-chip reflect">リフレクター</span>');
    if (B.playerScreens.lightscreen > 0) chips.push('<span class="field-chip light">ひかりのかべ</span>');
    if (B.enemyScreens.reflect > 0) chips.push('<span class="field-chip reflect foe">リフレクター(敵)</span>');
    if (B.enemyScreens.lightscreen > 0) chips.push('<span class="field-chip light foe">ひかりのかべ(敵)</span>');
    fe.innerHTML = chips.join('');
  }
}

/* ---------------- アニメ ---------------- */
function animAttack(isPlayer) {
  const src = $(isPlayer ? '#player-wrap' : '#enemy-wrap');
  const tgt = $(isPlayer ? '#enemy-wrap' : '#player-wrap');
  if (!src || !tgt) return;
  src.classList.remove('lunge-r', 'lunge-l', 'hitanim');
  void src.offsetWidth;
  src.classList.add(isPlayer ? 'lunge-r' : 'lunge-l');
  setTimeout(() => {
    tgt.classList.remove('hitanim');
    void tgt.offsetWidth;
    tgt.classList.add('hitanim');
  }, 200);
  Sfx.hit();
}
function showDamage(sel, dmg, eff, crit) {
  const wrap = $(sel);
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = 'dmg-pop' + (crit ? ' crit' : eff > 1 ? ' sup' : eff < 1 ? ' res' : '');
  el.textContent = '-' + dmg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 900);
}
function effFlash(crit) {
  const field = $('.battle-field');
  if (!field) return;
  const d = document.createElement('div');
  d.className = 'eff-flash' + (crit ? ' crit' : '');
  field.appendChild(d);
  setTimeout(() => d.remove(), 480);
}

/* ============================================================
   わざ ごとの ビジュアル エフェクト
   タイプだけでなく、わざ ID ごとに はなび・みず・かみなり・
   はっぱ・こおり・パンチ・いわ・シャドー などを 描き分ける。
   ============================================================ */
const FX_TYPE_SHAPE = {
  normal:'star', fire:'flame', water:'bubble', grass:'leaf', electric:'bolt',
  ice:'ice', fighting:'punch', poison:'poison', ground:'quake', flying:'wind',
  psychic:'ring', bug:'bug', rock:'rock', ghost:'shadow', dragon:'dragon',
  dark:'shadow', steel:'steel', fairy:'fairy',
};
const FX_TYPE_COLOR = {
  normal:'#f0f0f4', fire:'#ff8a3c', water:'#4aa3df', grass:'#7ad05a', electric:'#ffe04a',
  ice:'#a8e8ff', fighting:'#e06a3a', poison:'#b07bd0', ground:'#c99a62', flying:'#b8dcf4',
  psychic:'#e86fa8', bug:'#8cc63f', rock:'#c0b090', ghost:'#8a63c9', dragon:'#6f8ae8',
  dark:'#6f5a9a', steel:'#c8d4e0', fairy:'#f5a8d0',
};
const FX_BEAM_SHAPES = new Set(['beam', 'solar', 'boltbeam', 'icebeam', 'aurora', 'waterjet', 'wave', 'ringbeam', 'dragonbeam', 'scald']);
const FX_BEAM_TINTS = {
  flame:    { a:'#ff5a2a', b:'#ffe8a0' },
  solar:    { a:'#8ae83c', b:'#faffc0' },
  boltbeam: { a:'#ffd23e', b:'#ffffff' },
  icebeam:  { a:'#7fd4f0', b:'#ffffff' },
  aurora:   { a:'#6affc8', b:'#d8fff4' },
  waterjet: { a:'#3a92d8', b:'#e8faff' },
  wave:     { a:'#4aa3df', b:'#ffffff' },
  ringbeam: { a:'#e86fa8', b:'#fff0ff' },
  beam:     { a:'#ffe9a0', b:'#ffffff' },
  steel:    { a:'#a8b8c8', b:'#ffffff' },
  fairy:    { a:'#f58ec0', b:'#fff0ff' },
  dragonbeam: { a:'#5a7ae8', b:'#d8e8ff' },
  scald:    { a:'#ff9a5a', b:'#fff0d8' },
};
const FX_MOVES = {
  /* ノーマル */
  tackle:        { kind:'impact', shape:'punch' },
  scratch:       { kind:'impact', shape:'slash' },
  quickattack:   { kind:'dash', shape:'wind' },
  extremespeed:  { kind:'dash', shape:'wind', color:'#fff6c0' },
  headbutt:      { kind:'impact', shape:'star' },
  bodyslam:      { kind:'impact', shape:'star' },
  doubleedge:    { kind:'impact', shape:'star' },
  hyperbeam:     { kind:'beam', shape:'beam', thick:28, color:'#ffe9a0', shake:true },
  swift:         { shape:'star', particles:12 },
  /* ほのお */
  ember:         { shape:'flame', size:24 },
  flamethrower:  { kind:'beam', shape:'flame', thick:26, color:'#ff8a3c' },
  fireblast:     { shape:'flame', size:44, particles:16 },
  firepunch:     { kind:'impact', shape:'flame' },
  flareblitz:    { kind:'dash', shape:'flame', color:'#ff6a2a' },
  overheat:      { kind:'beam', shape:'flame', thick:36, color:'#ff5a2a', shake:true },
  willowisp:     { kind:'buff', shape:'flame' },
  /* みず */
  watergun:      { shape:'bubble', size:22 },
  surf:          { kind:'beam', shape:'wave', thick:34, color:'#4aa3df' },
  hydropump:     { kind:'beam', shape:'waterjet', thick:26 },
  bubblebeam:    { shape:'bubble', particles:16 },
  aquajet:       { kind:'dash', shape:'water' },
  waterfall:     { kind:'impact', shape:'water' },
  scald:         { kind:'beam', shape:'scald', thick:20, color:'#ffd8c8' },
  /* くさ */
  vinewhip:      { kind:'impact', shape:'leaf' },
  razorleaf:     { shape:'leaf', particles:14 },
  solarbeam:     { kind:'beam', shape:'solar', thick:30, color:'#c8ff6a', shake:true },
  gigadrain:     { shape:'leaf', particles:12 },
  bulletseed:    { shape:'seed', particles:16 },
  petalblizzard: { shape:'petal', particles:20 },
  energyball:    { shape:'leaf', size:36 },
  leechseed:     { kind:'buff', shape:'seed' },
  /* でんき */
  thundershock:  { shape:'bolt', size:20 },
  thunderbolt:   { kind:'beam', shape:'boltbeam', thick:16, color:'#ffe04a' },
  thunder:       { kind:'beam', shape:'boltbeam', thick:24, color:'#fff06a', shake:true },
  spark:         { kind:'impact', shape:'bolt' },
  wildcharge:    { kind:'dash', shape:'bolt' },
  chargebeam:    { kind:'beam', shape:'boltbeam', thick:12 },
  thunderpunch:  { kind:'impact', shape:'bolt' },
  /* こおり */
  icebeam:       { kind:'beam', shape:'icebeam', thick:22, color:'#9fe8ff' },
  blizzard:      { kind:'beam', shape:'ice', thick:30, color:'#d8f4ff', particles:18 },
  icywind:       { kind:'beam', shape:'ice', thick:26, color:'#cfeaff' },
  icepunch:      { kind:'impact', shape:'ice' },
  aurorabeam:    { kind:'beam', shape:'aurora', thick:24, color:'#8affd0' },
  /* かくとう */
  karatechop:    { kind:'impact', shape:'punch' },
  brickbreak:    { kind:'impact', shape:'punch', shake:true },
  closecombat:   { kind:'dash', shape:'punch', shake:true },
  machpunch:     { kind:'dash', shape:'punch' },
  seismictoss:   { kind:'impact', shape:'quake', shake:true },
  /* どく */
  poisonsting:   { shape:'poison', size:18 },
  sludge:        { shape:'poison', size:30 },
  sludgebomb:    { shape:'poison', size:38, particles:16 },
  toxic:         { kind:'buff', shape:'poison' },
  /* じめん */
  earthquake:    { kind:'quake', shape:'quake', shake:true },
  bulldoze:      { kind:'quake', shape:'quake', shake:true },
  dig:           { kind:'impact', shape:'rock', shake:true },
  mudslap:       { shape:'mud' },
  /* ひこう */
  wingattack:    { kind:'impact', shape:'wind' },
  airslash:      { shape:'wind', particles:14 },
  fly:           { kind:'dash', shape:'wind' },
  /* エスパー */
  confusion:     { shape:'ring' },
  psybeam:       { kind:'beam', shape:'ringbeam', thick:20, color:'#e86fa8' },
  psychic:       { shape:'ring', size:40, particles:18 },
  /* むし */
  xscissor:      { kind:'impact', shape:'xslash' },
  furycutter:    { kind:'impact', shape:'slash' },
  bugbuzz:       { shape:'bug', particles:14 },
  /* いわ */
  rockthrow:     { shape:'rock', size:36 },
  rockslide:     { shape:'rock', particles:14, size:30 },
  /* ゴースト / あく */
  shadowball:    { shape:'shadow', size:40 },
  shadowforce:   { kind:'impact', shape:'shadow' },
  suckerpunch:   { kind:'impact', shape:'shadowpunch' },
  crunch:        { kind:'impact', shape:'fang' },
  bite:          { kind:'impact', shape:'fang' },
  /* ドラゴン */
  dragonpulse:   { shape:'dragon', size:36 },
  dracometeor:   { shape:'meteor', particles:16, size:34 },
  dragonclaw:    { kind:'impact', shape:'slash' },
  /* はがね */
  flashcannon:   { kind:'beam', shape:'steel', thick:22, color:'#d8e8f0' },
  bulletpunch:   { kind:'dash', shape:'steel' },
  irontail:      { kind:'impact', shape:'steel' },
  /* フェアリー */
  moonblast:     { shape:'fairy', size:38 },
  dazzlinggleam: { kind:'beam', shape:'fairy', thick:28, color:'#ffc8e8' },
  fairywind:     { shape:'fairy', particles:14 },
  /* へんか */
  growl:         { kind:'buff', shape:'sound', color:'#e8e8f0' },
  sing:          { kind:'buff', shape:'sound', color:'#f5a8d0' },
  swordsdance:   { kind:'buff', shape:'blades' },
  harden:        { kind:'buff', shape:'shield' },
  irondefense:   { kind:'buff', shape:'shield' },
  withdraw:      { kind:'buff', shape:'shield' },
  bulkup:        { kind:'buff', shape:'shield', color:'#e0a060' },
  agility:       { kind:'buff', shape:'speed' },
  recover:       { kind:'buff', shape:'heal' },
  synthesis:     { kind:'buff', shape:'heal' },
  rest:          { kind:'buff', shape:'heal', color:'#a8c8ff' },
  protect:       { kind:'buff', shape:'shield', color:'#8fe3a0' },
  reflect:       { kind:'buff', shape:'wall', color:'#ffd7e8' },
  lightscreen:   { kind:'buff', shape:'wall', color:'#ffe98a' },
  sleeppowder:   { kind:'buff', shape:'powder', color:'#bfa8e8' },
  haze:          { kind:'buff', shape:'mist', color:'#c8d8e8' },
  charm:         { kind:'buff', shape:'hearts' },
  dragondance:   { kind:'buff', shape:'dragon', color:'#8ab8ff' },
  sunnyday:      { kind:'weather', shape:'weather', color:'#ffb84a' },
  raindance:     { kind:'weather', shape:'weather', color:'#4aa3df' },
  hail:          { kind:'weather', shape:'weather', color:'#bfe8f2' },
  sandstorm:     { kind:'weather', shape:'weather', color:'#d8b878' },
  /* ここから 下は わざ ごとの こまかい ちがい */
  leer:          { kind:'buff', shape:'sound', color:'#e8e8f0' },
  substitute:    { kind:'buff', shape:'shield', color:'#8fe3a0' },
  thunderwave:   { kind:'buff', shape:'bolt', color:'#ffe04a' },
  acidarmor:     { kind:'buff', shape:'shield', color:'#b07bd0' },
  venoshock:     { shape:'poison', size:34, particles:14 },
  poisonjab:     { kind:'impact', shape:'poison' },
  earthpower:    { kind:'quake', shape:'quake', shake:true },
  peck:          { kind:'impact', shape:'beak' },
  aerialace:     { kind:'dash', shape:'wind' },
  bravebird:     { kind:'dash', shape:'wind', color:'#9fd4ee', shake:true },
  roost:         { kind:'buff', shape:'heal' },
  hypnosis:      { kind:'buff', shape:'ring', color:'#b48ae0' },
  calmmind:      { kind:'buff', shape:'ring', color:'#e86fa8' },
  dreameater:    { shape:'shadow', size:38, color:'#e86fa8', particles:14 },
  psyshock:      { shape:'ring', size:36, particles:14 },
  storedpower:   { shape:'star', size:36, particles:16 },
  bugbite:       { kind:'impact', shape:'fang' },
  megadrain:     { shape:'leaf', particles:14 },
  stringshot:    { kind:'buff', shape:'powder', color:'#b8d878' },
  stoneedge:     { kind:'impact', shape:'rock', shake:true },
  rockpolish:    { kind:'buff', shape:'speed', color:'#c0b090' },
  rockblast:     { shape:'rock', particles:18, size:30 },
  powergem:      { shape:'gem', size:34, particles:14 },
  lick:          { kind:'impact', shape:'shadow' },
  shadowclaw:    { kind:'impact', shape:'slash', color:'#a88ae0' },
  nightshade:    { shape:'shadow', size:34, color:'#8a63c9', particles:14 },
  confuseray:    { kind:'buff', shape:'ring', color:'#e8c060' },
  hex:           { shape:'shadow', size:36, color:'#a88ae0', particles:14 },
  dragonbreath:  { kind:'beam', shape:'dragonbeam', thick:18, color:'#6f8ae8' },
  outrage:       { kind:'impact', shape:'dragon', shake:true },
  dragonrush:    { kind:'dash', shape:'dragon' },
  darkpulse:     { shape:'shadow', size:36, color:'#6f5a9a', particles:14 },
  nastyplot:     { kind:'buff', shape:'shadow', color:'#6f5a9a' },
  foulplay:      { kind:'impact', shape:'shadowpunch' },
  knockoff:      { kind:'impact', shape:'slash', color:'#9a83c8' },
  metalclaw:     { kind:'impact', shape:'slash', color:'#c8d4e0' },
  meteormash:    { kind:'impact', shape:'punch', color:'#c8d4e0' },
  drainingkiss:  { shape:'hearts', size:32, particles:12 },
  playrough:     { kind:'impact', shape:'fairy' },
  moonlight:     { kind:'buff', shape:'heal', color:'#cfe0ff' },
};

function fxAlpha(hex, a) {
  const n = parseInt((hex || '#ffffff').slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function fxPoint(wrap) {
  const field = $('.battle-field');
  if (!field || !wrap) return { x: 0, y: 0 };
  const fr = field.getBoundingClientRect(), r = wrap.getBoundingClientRect();
  return { x: r.left - fr.left + r.width / 2, y: r.top - fr.top + r.height * 0.58, w: r.width, h: r.height };
}
function fxProfile(moveId, move) {
  const id = moveId || '';
  const m = FX_MOVES[id] || {};
  const shape = m.shape || FX_TYPE_SHAPE[move.type] || 'star';
  const color = m.color || FX_TYPE_COLOR[move.type] || '#ffffff';
  let kind = m.kind;
  if (!kind) {
    if (move.cat === 'status') kind = 'buff';
    else if (FX_BEAM_SHAPES.has(shape)) kind = 'beam';
    else if (move.contact) kind = 'impact';
    else kind = 'projectile';
  }
  return {
    id, shape, color, kind,
    size: m.size || (kind === 'beam' ? 24 : 30),
    thick: m.thick || 18,
    particles: m.particles || (kind === 'impact' ? 11 : 9),
    shake: !!m.shake,
  };
}
function fxDiv(cls) { const d = document.createElement('div'); d.className = cls; return d; }
function fxTint(host, prof) {
  host.style.setProperty('--fx-color', prof.color);
  host.style.setProperty('--fx-glow', fxAlpha(prof.color, 0.6));
  host.style.setProperty('--fx-soft', fxAlpha(prof.color, 0.24));
}
function fxParticles(host, n, prof, opts = {}) {
  for (let i = 0; i < n; i++) {
    const p = fxDiv('fx-p p-' + (opts.shape || prof.shape) + (opts.rise ? ' rise' : ''));
    const ang = (i / n) * 360 + (opts.spread || 0) + Math.random() * 18;
    p.style.setProperty('--ang', ang + 'deg');
    p.style.setProperty('--dist', Math.round((opts.dist || 86) * (0.55 + Math.random() * 0.75)) + 'px');
    p.style.setProperty('--delay', ((opts.delay || 0) + Math.random() * 0.16).toFixed(2) + 's');
    p.style.setProperty('--size', Math.round((opts.size || 11) * (0.65 + Math.random() * 0.8)) + 'px');
    if (opts.rise) p.style.setProperty('--x', Math.round((Math.random() - 0.5) * 90) + 'px');
    host.appendChild(p);
  }
}
function fxSlash(host, angle, delay, len = 130, color = '#ffffff') {
  const s = fxDiv('fx-slash');
  s.style.setProperty('--ang', angle + 'deg');
  s.style.setProperty('--len', len + 'px');
  s.style.setProperty('--slash-color', color);
  s.style.animationDelay = delay + 's';
  host.appendChild(s);
}
function fxShapeExtras(host, prof, delay = 0, atSource = false) {
  const shape = prof.shape;
  if (shape === 'sound') {
    for (let i = 0; i < 3; i++) {
      const arc = fxDiv('fx-arc');
      arc.style.setProperty('--rot', (i * 120 + 20) + 'deg');
      arc.style.animationDelay = (delay + i * 0.07) + 's';
      host.appendChild(arc);
    }
  } else if (shape === 'blades') {
    for (let i = 0; i < 3; i++) fxSlash(host, -45 + i * 32, delay + i * 0.08, 150);
  } else if (shape === 'shield') {
    const sh = fxDiv('fx-shield');
    sh.style.animationDelay = delay + 's';
    host.appendChild(sh);
  } else if (shape === 'wall') {
    const w = fxDiv('fx-wall');
    w.style.animationDelay = delay + 's';
    host.appendChild(w);
  } else if (shape === 'quake') {
    for (let i = 0; i < 5; i++) {
      const cr = fxDiv('fx-crack');
      cr.style.setProperty('--ang', (-70 + i * 34) + 'deg');
      cr.style.setProperty('--len', (60 + Math.random() * 70) + 'px');
      cr.style.animationDelay = (delay + i * 0.03) + 's';
      host.appendChild(cr);
    }
  } else if (shape === 'slash' || shape === 'xslash' || shape === 'wind' || shape === 'fang' || shape === 'shadowpunch') {
    fxSlash(host, -42, delay, 150);
    fxSlash(host, 46, delay + 0.07, 130);
    if (shape === 'xslash') fxSlash(host, 4, delay + 0.13, 160);
  } else if (shape === 'heal') {
    const glow = fxDiv('fx-healglow');
    glow.style.animationDelay = delay + 's';
    host.appendChild(glow);
  } else if (shape === 'dragon' || shape === 'ring') {
    const r = fxDiv('fx-ring');
    r.style.animationDelay = delay + 's';
    host.appendChild(r);
  }
  if (prof.shake && !atSource) {
    const field = $('.battle-field');
    if (field) {
      field.classList.remove('fx-shake');
      void field.offsetWidth;
      field.classList.add('fx-shake');
      setTimeout(() => field.classList.remove('fx-shake'), 520);
    }
  }
}
function fxImpact(layer, pt, prof, delay = 0.3) {
  const host = fxDiv('move-fx fx-impact');
  host.style.left = pt.x + 'px';
  host.style.top = pt.y + 'px';
  fxTint(host, prof);
  const ring = fxDiv('fx-ring');
  ring.style.animationDelay = delay + 's';
  host.appendChild(ring);
  const ring2 = fxDiv('fx-ring r2');
  ring2.style.animationDelay = (delay + 0.09) + 's';
  host.appendChild(ring2);
  const star = fxDiv('fx-star');
  star.style.animationDelay = delay + 's';
  host.appendChild(star);
  fxParticles(host, prof.particles, prof, { delay: delay + 0.03 });
  fxShapeExtras(host, prof, delay + 0.02);
  layer.appendChild(host);
  setTimeout(() => host.remove(), 1500);
}
function fxProjectile(layer, a, d, prof) {
  const host = fxDiv('move-fx fx-orb');
  host.style.left = a.x + 'px';
  host.style.top = a.y + 'px';
  fxTint(host, prof);
  const dx = d.x - a.x, dy = d.y - a.y;
  host.style.setProperty('--dx', dx + 'px');
  host.style.setProperty('--dy', dy + 'px');
  const core = fxDiv('fx-core p-' + prof.shape);
  core.style.setProperty('--size', prof.size + 'px');
  host.appendChild(core);
  for (let i = 0; i < 5; i++) {
    const tr = fxDiv('fx-trail p-' + prof.shape);
    tr.style.setProperty('--size', Math.round(prof.size * (0.35 + i * 0.1)) + 'px');
    tr.style.animationDelay = (i * 0.035) + 's';
    host.appendChild(tr);
  }
  layer.appendChild(host);
  fxImpact(layer, d, prof, 0.34);
  setTimeout(() => host.remove(), 1400);
}
function fxBeam(layer, a, d, prof) {
  const dx = d.x - a.x, dy = d.y - a.y;
  const len = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx) * 180 / Math.PI;
  const host = fxDiv('move-fx fx-beam');
  host.style.left = a.x + 'px';
  host.style.top = a.y + 'px';
  host.style.setProperty('--len', len + 'px');
  host.style.setProperty('--thick', prof.thick + 'px');
  host.style.setProperty('--ang', ang + 'deg');
  fxTint(host, prof);
  const tint = FX_BEAM_TINTS[prof.shape] || { a: prof.color, b: '#ffffff' };
  host.style.setProperty('--fx-a', tint.a);
  host.style.setProperty('--fx-b', tint.b);
  const core = fxDiv('fx-beam-core');
  host.appendChild(core);
  if (prof.shape === 'boltbeam') {
    for (let i = 0; i < 2; i++) {
      const z = fxDiv('fx-zigzag');
      z.style.setProperty('--delay', (i * 0.06) + 's');
      z.style.setProperty('--offset', (i * 22 + 14) + 'px');
      host.appendChild(z);
    }
  }
  if (prof.shape === 'ice' || prof.shape === 'icebeam' || prof.shape === 'aurora') {
    for (let i = 0; i < 5; i++) {
      const sh = fxDiv('fx-shard');
      sh.style.setProperty('--x', Math.round(Math.random() * len) + 'px');
      sh.style.setProperty('--y', Math.round((Math.random() - 0.5) * prof.thick * 2.4) + 'px');
      sh.style.animationDelay = (Math.random() * 0.2) + 's';
      host.appendChild(sh);
    }
  }
  layer.appendChild(host);
  fxImpact(layer, d, prof, 0.34);
  setTimeout(() => host.remove(), 1400);
}
function fxDash(layer, a, d, prof) {
  const dx = d.x - a.x, dy = d.y - a.y;
  const len = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx) * 180 / Math.PI;
  const host = fxDiv('move-fx fx-dash');
  host.style.left = a.x + 'px';
  host.style.top = a.y + 'px';
  host.style.setProperty('--len', len + 'px');
  host.style.setProperty('--ang', ang + 'deg');
  fxTint(host, prof);
  for (let i = 0; i < 4; i++) {
    const st = fxDiv('fx-streak');
    st.style.setProperty('--off', (i - 1.5) * 18 + 'px');
    st.style.animationDelay = (i * 0.035) + 's';
    host.appendChild(st);
  }
  layer.appendChild(host);
  fxImpact(layer, d, prof, 0.16);
  setTimeout(() => host.remove(), 1200);
}
function fxBuff(layer, pt, prof) {
  const host = fxDiv('move-fx fx-buff');
  host.style.left = pt.x + 'px';
  host.style.top = pt.y + 'px';
  fxTint(host, prof);
  const aura = fxDiv('fx-aura');
  host.appendChild(aura);
  const aura2 = fxDiv('fx-aura r2');
  aura2.style.animationDelay = '0.1s';
  host.appendChild(aura2);
  fxParticles(host, prof.shape === 'heal' ? 8 : 10, prof, { rise: true, delay: 0.05, size: 13, dist: 90 });
  fxShapeExtras(host, prof, 0.05, true);
  layer.appendChild(host);
  setTimeout(() => host.remove(), 1500);
}
function fxWeather(layer, prof, id) {
  const host = fxDiv('move-fx fx-weather');
  fxTint(host, prof);
  const overlay = fxDiv('fx-weather-tint');
  host.appendChild(overlay);
  const weatherClass = id === 'raindance' ? 'p-rain'
    : id === 'hail' ? 'p-snow'
      : id === 'sandstorm' ? 'p-sand'
        : 'p-sun';
  for (let i = 0; i < 16; i++) {
    const p = fxDiv('fx-weather-p ' + weatherClass);
    p.style.left = (Math.random() * 100) + '%';
    p.style.animationDelay = (Math.random() * 0.7) + 's';
    p.style.animationDuration = (0.7 + Math.random() * 0.7) + 's';
    host.appendChild(p);
  }
  layer.appendChild(host);
  setTimeout(() => host.remove(), 1600);
}

function playMoveFx(moveId, move, isPlayer) {
  if (typeof document === 'undefined' || !move) return;
  const layer = $('#move-fx-layer');
  if (!layer) return;
  const prof = fxProfile(moveId, move);
  const src = fxPoint($(isPlayer ? '#player-wrap' : '#enemy-wrap'));
  const tgt = fxPoint($(isPlayer ? '#enemy-wrap' : '#player-wrap'));
  const eff = move.effect || {};
  const selfStatus = eff.target === 'self' || eff.kind === 'heal' || eff.kind === 'screen'
    || eff.kind === 'weather' || eff.kind === 'protect' || eff.kind === 'substitute'
    || eff.kind === 'stat2' || eff.kind === 'rest' || eff.kind === 'haze'
    || (eff.kind === 'stat' && eff.target === 'self');
  const pt = (move.cat === 'status' && selfStatus) ? src : tgt;

  if (prof.kind === 'weather') { fxWeather(layer, prof, moveId); return; }
  if (prof.kind === 'beam') { fxBeam(layer, src, tgt, prof); return; }
  if (prof.kind === 'dash') { fxDash(layer, src, tgt, prof); return; }
  if (prof.kind === 'impact') { fxImpact(layer, tgt, prof, 0.16); return; }
  if (prof.kind === 'quake') {
    fxImpact(layer, tgt, prof, 0.1);
    const field = $('.battle-field');
    if (field) {
      field.classList.remove('fx-shake');
      void field.offsetWidth;
      field.classList.add('fx-shake');
      setTimeout(() => field.classList.remove('fx-shake'), 560);
    }
    return;
  }
  if (prof.kind === 'buff') { fxBuff(layer, pt, prof); return; }
  fxProjectile(layer, src, tgt, prof);
}


/* ============================================================
   ダメージ
   ============================================================ */
function rollCrit(mon, move) {
  let stage = 0;
  if (move.critBonus) stage += 1;
  if (mon.heldItem === 'scopelens') stage += 1;
  const table = [1 / 16, 1 / 8, 1 / 4, 1 / 3, 1 / 2];
  return brng() < (table[Math.min(stage, table.length - 1)] || 1 / 16);
}
function positiveStages(mon) {
  return BATTLE_STAT_KEYS.reduce((n, k) => n + Math.max(0, (mon.stages && mon.stages[k]) || 0), 0);
}
function calcDamage(atkMon, defMon, move, opts = {}) {
  const st = B;
  const crit = opts.crit !== undefined ? opts.crit : rollCrit(atkMon, move);
  const defSide = sideOf(defMon);
  const atkKey = move.cat === 'phys' ? 'atk' : 'spa';
  const defKey = move.defStat || (move.cat === 'phys' ? 'def' : 'spd');

  const stageVal = crit ? rawStat : effStat;
  let A = stageVal(atkMon, atkKey);
  let D = stageVal(defMon, defKey);

  /* とくせい（ピンチの とき タイプわざが 1.5ばい） */
  const pinch = { grass: 'overgrow', fire: 'blaze', water: 'torrent' }[move.type];
  if (pinch && atkMon.ability === pinch && atkMon.hp <= atkMon.maxHp / 3) A = Math.floor(A * 1.5);
  /* こんじょう: じょうたい いじょうの とき ぶつりが 1.5ばい */
  if (atkMon.ability === 'guts' && atkMon.status && move.cat === 'phys') A = Math.floor(A * 1.5);

  let power = move.power || 0;
  /* テクニシャン: いりょく 60 いか */
  if (atkMon.ability === 'technician' && power > 0 && power <= 60 && !move.storedPower) {
    power = Math.floor(power * 1.5);
  }
  if (move.doubleIfStatus && defMon.status) power *= 2;
  if (move.storedPower) power = 20 + 20 * positiveStages(atkMon);

  let dmg = Math.floor(Math.floor(2 * atkMon.level / 5 + 2) * power * A / Math.max(1, D) / 50) + 2;
  if (crit) dmg = Math.floor(dmg * 1.5);
  /* スナイパー: きゅうしょの ダメージを さらに 1.5ばい */
  if (crit && atkMon.ability === 'sniper') dmg = Math.floor(dmg * 1.5);

  const eff = typeEffect(move.type, SPECIES[defMon.species].types);
  dmg = Math.floor(dmg * eff);

  /* タイプ一致 */
  if (typeHas(atkMon, move.type)) dmg = Math.floor(dmg * 1.5);

  /* 天候 */
  const weatherMul = { sun: { fire: 1.5, water: 0.5 }, rain: { water: 1.5, fire: 0.5 } };
  const mul = st && weatherMul[st.weather] && weatherMul[st.weather][move.type];
  if (mul) dmg = Math.floor(dmg * mul);

  /* かべ */
  const scr = screensOf(defSide);
  if (move.cat === 'phys' && scr.reflect > 0) dmg = Math.floor(dmg * 0.5);
  if (move.cat === 'spec' && scr.lightscreen > 0) dmg = Math.floor(dmg * 0.5);

  /* もちもの */
  if (atkMon.heldItem === 'lifeorb') dmg = Math.floor(dmg * 1.3);
  const held = ITEMS[atkMon.heldItem];
  if (held && held.boostType === move.type) dmg = Math.floor(dmg * 1.2);

  /* マルチスケイル */
  if (defMon.ability === 'multiscale' && defMon.hp === defMon.maxHp) dmg = Math.floor(dmg * 0.5);
  /* あついしぼう */
  if (defMon.ability === 'thickfat' && (move.type === 'fire' || move.type === 'ice')) dmg = Math.floor(dmg * 0.5);

  dmg = Math.floor(dmg * (0.85 + brng() * 0.15));
  return { dmg: Math.max(1, dmg), eff, crit };
}

/* ============================================================
   能力ランク / 状態
   ============================================================ */
async function changeStage(mon, stat, stages, isSelf) {
  if (!B || !mon || mon.hp <= 0) return false;
  const label = STAT_LABELS[stat] || stat;
  if (mon.ability === 'keeneye' && stat === 'acc' && stages < 0) {
    await say(`しかし ${monName(mon)} の めいちゅうりつは さがらない！`);
    return false;
  }
  if (!mon.stages) mon.stages = zeroStages();
  const cur = mon.stages[stat] || 0;
  const next = clamp(cur + stages, -6, 6);
  if (next === cur) {
    await say(`しかし ${monName(mon)} の ${label}は これいじょう ${stages > 0 ? 'あがらない' : 'さがらない'}！`);
    return false;
  }
  mon.stages[stat] = next;
  const word = stages > 0 ? (Math.abs(stages) >= 2 ? 'ぐーんと あがった' : 'あがった') : (Math.abs(stages) >= 2 ? 'がくっと さがった' : 'さがった');
  if (stages > 0) Sfx.play(880, .09, 'sine', .05, 120); else Sfx.pop();
  await say(`${monName(mon)} の ${label}が ${word}！`);
  updateBattleUI();
  return true;
}

async function inflictStatus(mon, status) {
  if (!B || !mon || mon.hp <= 0) return false;
  if (status === 'confuse') {
    if (mon.ability === 'owntempo') { await say(`${monName(mon)} は マイペースで こんらんしない！`); return false; }
    if (mon.confusion > 0) { await say(`しかし ${monName(mon)} は すでに こんらんしている！`); return false; }
    mon.confusion = bri(2, 5);
    Sfx.pop();
    await say(`${monName(mon)} は こんらんした！`);
    updateBattleUI();
    return true;
  }
  if (mon.status) { await say(`しかし ${monName(mon)} は すでに ${STATUS_LABELS[mon.status] || mon.status}だ！`); return false; }
  const types = SPECIES[mon.species].types;
  if (status === 'brn' && types.includes('fire')) { await say(`しかし ${monName(mon)} には やけどが きかない！`); return false; }
  if (status === 'par' && types.includes('electric')) { await say(`しかし ${monName(mon)} には まひが きかない！`); return false; }
  if ((status === 'psn' || status === 'tox') && (types.includes('poison') || types.includes('steel'))) {
    await say(`しかし ${monName(mon)} には どくが きかない！`); return false;
  }
  if (status === 'frz' && types.includes('ice')) { await say(`しかし ${monName(mon)} には こおりが きかない！`); return false; }
  mon.status = status;
  if (status === 'slp') { mon.sleepTurns = bri(2, 4); Sfx.play(300, .18, 'triangle', .05, -100); }
  if (status === 'tox') mon.toxicCounter = 0;
  const msg = {
    psn: `${monName(mon)} は どくを あびた！`,
    tox: `${monName(mon)} は もうどくを あびた！`,
    par: `${monName(mon)} は しびれて うごきにくくなった！`,
    slp: `${monName(mon)} は ねむって しまった！`,
    brn: `${monName(mon)} は やけどを おった！`,
    frz: `${monName(mon)} は こおって しまった！`,
  }[status] || `${monName(mon)} は ${status} に なった！`;
  await say(msg);
  updateBattleUI();
  return true;
}

/* ============================================================
   へんかわざ
   ============================================================ */
async function applyStatusMove(attacker, defender, move, moveId) {
  const st = B;
  const e = move.effect;
  if (!e) { await say('しかし なにも おこらなかった…'); return; }
  switch (e.kind) {
    case 'stat': {
      const target = e.target === 'self' ? attacker : defender;
      await changeStage(target, e.stat, e.stages, target === attacker);
      break;
    }
    case 'stat2': {
      const target = e.target === 'self' ? attacker : defender;
      for (const [stat, stages] of e.stats) await changeStage(target, stat, stages, target === attacker);
      break;
    }
    case 'status': {
      const target = e.target === 'self' ? attacker : defender;
      await inflictStatus(target, e.status);
      break;
    }
    case 'heal': {
      if (attacker.hp >= attacker.maxHp) { await say('しかし HPは まんたんだ！'); break; }
      let ratio = e.ratio || 0.5;
      /* てんきで かいふくりつが かわるのは こうごうせい / つきのひかり だけ。
         じこさいせい / はねやすめ は てんきに えいきょう されない。 */
      if (moveId === 'synthesis' || moveId === 'moonlight') {
        if (st.weather === 'sun') ratio = Math.max(ratio, 2 / 3);
        else if (st.weather) ratio = Math.min(ratio, 0.25);
      }
      const heal = Math.max(1, Math.floor(attacker.maxHp * ratio));
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
      Sfx.heal();
      await say(`${monName(attacker)} の HPが ${heal} かいふくした！`);
      updateBattleUI();
      break;
    }
    case 'screen': {
      const scr = screensOf(sideOf(attacker));
      if (scr[e.screen] > 0) { await say('しかし すでに はりめぐらされている！'); break; }
      scr[e.screen] = e.turns || 5;
      Sfx.play(660, .12, 'sine', .05, 180);
      await say(e.screen === 'reflect'
        ? `${monName(attacker)} の まわりに リフレクターが はりめぐらされた！`
        : `${monName(attacker)} の まわりに ひかりのかべが はりめぐらされた！`);
      updateBattleUI();
      break;
    }
    case 'weather': {
      if (st.weather === e.weather) { await say('しかし すでに その てんきだ！'); break; }
      st.weather = e.weather; st.weatherTurns = e.turns || 5;
      Sfx.play(440, .2, 'sine', .05, 220);
      const msg = {
        sun: 'にわかに ひざしが つよくなった！',
        rain: 'あまつぶが ふりはじめた！',
        sand: 'すなあらしが ふきはじめた！',
        hail: 'あられが ふりはじめた！',
      }[e.weather];
      await say(msg);
      updateBattleUI();
      break;
    }
    case 'haze': {
      for (const side of ['player', 'enemy']) {
        const m = monAt(side);
        if (m) m.stages = zeroStages();
      }
      await say('すべての のうりょくが もとに もどった！');
      updateBattleUI();
      break;
    }
    case 'protect': {
      const used = attacker.protectCount || 0;
      const chance = protectChance(used);
      attacker.protectCount = used + 1;
      if (brng() >= chance) {
        Sfx.pop();
        await say('しかし うまく きまらなかった！');
        break;
      }
      attacker.protect = true;
      Sfx.play(520, .14, 'triangle', .05, 120);
      await say(`${monName(attacker)} は みを まもっている！`);
      break;
    }
    case 'substitute': {
      const cost = Math.floor(attacker.maxHp / 4);
      if (attacker.substitute > 0) { await say('しかし すでに みがわりが いる！'); break; }
      if (attacker.hp <= cost) { await say('しかし HPが たりなくて みがわりを だせない！'); break; }
      attacker.hp -= cost;
      attacker.substitute = cost;
      Sfx.pop();
      await say(`${monName(attacker)} は みがわりを だした！`);
      updateBattleUI();
      break;
    }
    case 'leechseed': {
      if (typeHas(defender, 'grass')) { await say(`しかし ${monName(defender)} には やどりぎが きかない！`); break; }
      if (defender.leechseed) { await say('しかし すでに たねが ついている！'); break; }
      defender.leechseed = true;
      await say(`${monName(defender)} に やどりぎのタネを うえつけた！`);
      break;
    }
    case 'rest': {
      if (attacker.hp >= attacker.maxHp) { await say('しかし HPは まんたんだ！'); break; }
      if (attacker.status === 'slp') { await say('しかし すでに ねむっている！'); break; }
      attacker.status = 'slp'; attacker.sleepTurns = 3;
      attacker.hp = attacker.maxHp;
      Sfx.heal();
      await say(`${monName(attacker)} は ねむって しまった！`);
      await say(`${monName(attacker)} の HPが まんたんに なった！`);
      updateBattleUI();
      break;
    }
    default:
      await say('しかし なにも おこらなかった…');
  }
}

/* ============================================================
   わざ 実行
   ============================================================ */
async function preMoveChecks(attacker) {
  const st = B;
  if (!st || !attacker || attacker.hp <= 0) return false;
  if (attacker.status === 'slp') {
    if (attacker.sleepTurns > 0) {
      attacker.sleepTurns--;
      if (attacker.sleepTurns <= 0) {
        attacker.status = null;
        await say(`${monName(attacker)} は めを さました！`);
        /* ねむりから さめた ターンは えらんだ わざを そのまま つかう */
      } else {
        await say(`${monName(attacker)} は ぐうぐう ねむっている…`);
        return false;
      }
    } else {
      attacker.status = null;
      await say(`${monName(attacker)} は めを さました！`);
    }
  }
  if (attacker.status === 'frz') {
    if (brng() < 0.2) {
      attacker.status = null;
      await say(`${monName(attacker)} の こおりが とけた！`);
      /* こおりが とけた ターンは えらんだ わざを そのまま つかう */
    } else {
      await say(`${monName(attacker)} は こおって うごけない！`);
      return false;
    }
  }
  if (attacker.status === 'par' && brng() < 0.25) {
    await say(`${monName(attacker)} は しびれて うごけない！`);
    return false;
  }
  if (attacker.confusion > 0) {
    attacker.confusion--;
    if (attacker.confusion <= 0) {
      await say(`${monName(attacker)} の こんらんが とけた！`);
    } else {
      await say(`${monName(attacker)} は こんらんしている！`);
      if (brng() < 0.33) {
        const dmg = Math.max(1, Math.floor(
          (Math.floor(2 * attacker.level / 5 + 2) * 40 * effStat(attacker, 'atk') / Math.max(1, effStat(attacker, 'def'))) / 50) + 2);
        attacker.hp = Math.max(0, attacker.hp - dmg);
        updateBattleUI();
        showDamage(wrapSel(sideOf(attacker)), dmg, 1, false);
        await say(`${monName(attacker)} は じぶんを たたいた！`);
        if (attacker.hp <= 0) await handleFaint(sideOf(attacker));
        return false;
      }
    }
  }
  if (attacker.flinch) {
    attacker.flinch = false;
    await say(`${monName(attacker)} は ひるんで うごけない！`);
    return false;
  }
  return true;
}

async function performMove(attacker, defender, slot, isPlayer) {
  const st = B;
  if (!st || st.over || !attacker || attacker.hp <= 0 || !defender || defender.hp <= 0) return;
  const moveId = slot ? slot.id : null;
  const move = slot ? MOVES[slot.id] : STRUGGLE;
  if (!move) return;

  if (attacker.recharge) {
    attacker.recharge = false;
    await say(`${monName(attacker)} は うごけない！`);
    return;
  }
  if (attacker.charging) {
    const ch = attacker.charging;
    attacker.charging = null;
    attacker.actedThisTurn = true;
    await executeMove(attacker, defender, ch.moveId, isPlayer);
    return;
  }
  if (!(await preMoveChecks(attacker))) { attacker.protectCount = 0; return; }
  if (!B || B.over || attacker.hp <= 0) return;

  /* まもる いがいの わざを えらんだら れんぞく カウントは リセット */
  if (moveId !== 'protect') attacker.protectCount = 0;

  if (slot) slot.pp = Math.max(0, slot.pp - 1);
  await say(`${monName(attacker)} の ${move.name}！`, 520);
  /* ふいうちの はんてい用: この ターンに わざを つかった */
  attacker.actedThisTurn = true;

  if (move.charge && slot && !(moveId === 'solarbeam' && st.weather === 'sun')) {
    attacker.charging = { moveId: slot.id };
    const msg = {
      solarbeam: `${monName(attacker)} は ひかりを あつめている…`,
      fly: `${monName(attacker)} は そらに とびあがった！`,
      dig: `${monName(attacker)} は あなを ほりはじめた！`,
      shadowforce: `${monName(attacker)} は すがたを けした！`,
    }[moveId] || `${monName(attacker)} は ちからを ためている…`;
    await say(msg);
    return;
  }
  await executeMove(attacker, defender, moveId, isPlayer);
}

async function executeMove(attacker, defender, moveId, isPlayer) {
  const st = B;
  if (!st || st.over) return;
  const move = moveId ? MOVES[moveId] : STRUGGLE;
  if (!move) return;

  /* ふいうち: あいてが その ターンに ダメージわざを つかおうと していない、
     または すでに うごいた あと なら しっぱいする。 */
  if (moveId === 'suckerpunch') {
    if (!isDamagingMoveId(defender.turnMoveId) || defender.actedThisTurn) {
      await say('しかし わざは しっぱいした！');
      return;
    }
  }

  if (defender.protect && moveTargetsFoe(move)) {
    await say(`${monName(defender)} は わざを ふせいだ！`);
    return;
  }

  /* そらをとぶ / あなをほる などの こうたい（半無敵） */
  const semi = defender.charging && defender.charging.moveId;
  if (semi && move.cat !== 'status') {
    if (semi === 'fly') {
      if (moveId !== 'thunder') {
        await say(`${monName(defender)} は そらに いる！`);
        return;
      }
    } else if (semi === 'dig') {
      if (moveId !== 'earthquake' && moveId !== 'bulldoze') {
        await say(`${monName(defender)} は あなの なかだ！`);
        return;
      }
    } else if (semi === 'shadowforce') {
      await say(`${monName(defender)} の すがたが みえない！`);
      return;
    }
  }

  /* みがわりは あいてを ねらう へんかわざも ふせぐ */
  if (move.cat === 'status' && defender.substitute > 0 && moveTargetsFoe(move)) {
    await say(`しかし ${monName(defender)} の みがわりが じゃまを した！`);
    return;
  }

  /* めいちゅう */
  if (move.acc != null) {
    let acc = move.acc;
    if (moveId === 'thunder' && st.weather === 'rain') acc = 100;
    if (moveId === 'thunder' && st.weather === 'sun') acc = 50;
    if (moveId === 'blizzard' && st.weather === 'hail') acc = 100;
    if (attacker.ability === 'compoundeyes') acc *= 1.3;
    if (defender.ability === 'sandveil' && st.weather === 'sand') acc *= 0.8;
    const stage = clamp(((attacker.stages && attacker.stages.acc) || 0) - ((defender.stages && defender.stages.eva) || 0), -6, 6);
    const mul = stage >= 0 ? (3 + stage) / 3 : 3 / (3 - stage);
    if (brng() * 100 >= acc * mul) {
      await say('しかし わざが はずれた！');
      return;
    }
  }

  /* タイプ むこう */
  const eff = typeEffect(move.type, SPECIES[defender.species].types);
  if (eff === 0) {
    await say(`しかし ${monName(defender)} には きかないようだ…`);
    return;
  }
  if (move.type === 'ground' && defender.ability === 'levitate') {
    await say(`しかし ${monName(defender)} には きかないようだ…`);
    return;
  }

  playMoveFx(moveId, move, isPlayer);

  if (move.cat === 'status') {
    await applyStatusMove(attacker, defender, move);
    return;
  }

  if (move.onlySleep && defender.status !== 'slp') {
    await say('しかし あいては ねむっていない！');
    return;
  }

  await applyDamage(attacker, defender, move, isPlayer);
}

async function applyDamage(attacker, defender, move, isPlayer) {
  const st = B;
  if (!st || st.over) return;
  const defSide = sideOf(defender);
  const atkSide = sideOf(attacker);

  /* みがわり */
  if (defender.substitute > 0) {
    const { dmg, eff, crit } = calcDamage(attacker, defender, move);
    const absorbed = Math.min(defender.substitute, dmg);
    defender.substitute -= absorbed;
    showDamage(wrapSel(defSide), absorbed, eff, crit);
    updateBattleUI();
    await say(`${monName(defender)} の みがわりが ${absorbed} の ダメージを うけた！`);
    if (defender.substitute <= 0) {
      defender.substitute = 0;
      await say(`${monName(defender)} の みがわりが きえた！`);
    }
    return;
  }

  animAttack(isPlayer);
  await wait(240);

  let dmg, eff, crit;
  if (move.fixed === 'level') {
    dmg = attacker.level;
    eff = typeEffect(move.type, SPECIES[defender.species].types);
    crit = false;
  } else {
    ({ dmg, eff, crit } = calcDamage(attacker, defender, move));
  }

  /* きあいのハチマキ */
  if (defender.hp === defender.maxHp && dmg >= defender.hp && defender.heldItem === 'focusash' && !defender.focusUsed) {
    defender.focusUsed = true;
    defender.heldItem = null;
    dmg = defender.hp - 1;
    await say(`${monName(defender)} は きあいのハチマキで こらえた！`);
  }
  /* がんじょう: まんたん HP から ひんしに なる ダメージを 1 HPで こらえる */
  if (defender.ability === 'sturdy' && defender.hp === defender.maxHp && dmg >= defender.hp) {
    dmg = defender.hp - 1;
    await say(`${monName(defender)} は がんじょうで こらえた！`);
  }

  defender.hp = Math.max(0, defender.hp - dmg);
  updateBattleUI();
  showDamage(wrapSel(defSide), dmg, eff, crit);
  if (crit) await say('きゅうしょに あたった！', 420);
  if (eff > 1) { effFlash(crit); await say('こうかは ばつぐんだ！', 420); }
  else if (eff < 1) await say('こうかは いまひとつの ようだ…', 420);

  /* いのちのたま */
  if (attacker.heldItem === 'lifeorb' && attacker.hp > 0) {
    const rec = Math.max(1, Math.floor(attacker.maxHp / 10));
    attacker.hp = Math.max(0, attacker.hp - rec);
    updateBattleUI();
    await say(`${monName(attacker)} は いのちのたまの ダメージを うけた！`, 460);
  }

  /* きゅうしゅう */
  if (move.drain && dmg > 0 && attacker.hp > 0) {
    const heal = Math.max(1, Math.floor(dmg * move.drain));
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
    updateBattleUI();
    Sfx.heal();
    await say(`${monName(attacker)} は ${heal} HP すいとった！`, 480);
  }

  /* はんどう */
  if (move.recoil && attacker.ability !== 'rockhead' && attacker.hp > 0) {
    const rec = Math.max(1, Math.floor(dmg * move.recoil));
    attacker.hp = Math.max(0, attacker.hp - rec);
    updateBattleUI();
    await say(`${monName(attacker)} は はんどうの ダメージを うけた！`, 480);
  }

  /* じぶんの のうりょく */
  if (attacker.hp > 0) {
    if (move.selfAfter) await changeStage(attacker, move.selfAfter.stat, move.selfAfter.stages, true);
    if (move.selfAfter2) await changeStage(attacker, move.selfAfter2.stat, move.selfAfter2.stages, true);
  }

  /* ついかこうか */
  if (defender.hp > 0 && !st.over) {
    if (move.secondary && brng() < move.secondary.chance && defender.ability !== 'shielddust') {
      const sec = move.secondary;
      if (sec.status) await inflictStatus(defender, sec.status);
      else if (sec.stat) await changeStage(defender, sec.stat, sec.stages, false);
      else if (sec.flinch) {
        defender.flinch = true;
        await say(`${monName(defender)} は ひるんだ！`, 460);
      }
    }
    if (move.selfChance && attacker.hp > 0 && brng() < move.selfChance.chance) {
      await changeStage(attacker, move.selfChance.stat, move.selfChance.stages, true);
    }
    if (attacker.heldItem === 'kingsrock' && brng() < 0.1 && defender.hp > 0) {
      defender.flinch = true;
      await say(`${monName(defender)} は ひるんだ！`, 460);
    }
  }

  /* ふれあい とくせい */
  if (move.contact && defender.hp > 0 && attacker.hp > 0) {
    if (defender.ability === 'static' && brng() < 0.3) await inflictStatus(attacker, 'par');
    if (defender.ability === 'cutecharm' && brng() < 0.3) await inflictStatus(attacker, 'confuse');
  }

  /* はたきおとす */
  if (move.knockoff && defender.heldItem) {
    const it = ITEMS[defender.heldItem];
    if (it) await say(`${monName(defender)} の ${it.name}を はたきおとした！`);
    defender.heldItem = null;
  }

  /* はかいこうせん */
  if (move.recharge && attacker.hp > 0) attacker.recharge = true;

  /* かわらわり */
  if (move.breaksScreens) {
    const scr = screensOf(defSide);
    if (scr.reflect > 0 || scr.lightscreen > 0) {
      scr.reflect = 0; scr.lightscreen = 0;
      await say(`${monName(defender)} の かべが こわれた！`);
      updateBattleUI();
    }
  }

  if (defender.hp <= 0) {
    const atkFainted = attacker.hp <= 0;
    await handleFaint(defSide);
    if (!B || B.over) return;
    /* はんどう・いのちのたま等で こうしゅ も たおれた場合。
       あいてが こうたいして いても、こうしゅ側の ひんしを かならず 処理する。 */
    if (atkFainted && attacker.hp <= 0) {
      st.turnInterrupted = false;
      await handleFaint(atkSide);
    }
    return;
  }
  if (attacker.hp <= 0 && !B.turnInterrupted) {
    await handleFaint(atkSide);
  }
}

/* ============================================================
   てき AI
   ============================================================ */
function chooseEnemyMove() {
  const st = B;
  if (!st) return null;
  const foe = st.enemy, me = activeMon();
  if (!foe) return null;
  if (foe.choiceLock) {
    const locked = foe.moves.find(m => m.id === foe.choiceLock && m.pp > 0);
    if (locked) return locked;
  }
  const usable = foe.moves.filter(m => m.pp > 0 && MOVES[m.id]);
  if (!usable.length) return null;
  const scored = usable.map(m => {
    const mv = MOVES[m.id];
    let s = 10;
    if (mv.cat === 'status') {
      const k = mv.effect && mv.effect.kind;
      if (k === 'heal') s = foe.hp < foe.maxHp * 0.5 ? 80 : 5;
      else if (k === 'status') s = me.status ? 5 : (mv.effect.status === 'confuse' && me.confusion > 0 ? 3 : 55);
      else if (k === 'stat') s = 32;
      else if (k === 'stat2') s = 36;
      else if (k === 'weather') s = st.weather ? 5 : 34;
      else if (k === 'screen') s = 30;
      else if (k === 'leechseed') s = me.leechseed ? 5 : 34;
      else if (k === 'substitute') s = foe.hp > foe.maxHp * 0.6 ? 30 : 5;
      else if (k === 'protect') s = (foe.protectCount || 0) > 0 ? 2 : 14;
      else s = 20;
    } else {
      const eff = typeEffect(mv.type, SPECIES[me.species].types);
      if (eff === 0) s = 0;
      else {
        s = (mv.power || 1) * eff;
        if (SPECIES[foe.species].types.includes(mv.type)) s *= 1.5;
        if (mv.fixed) s = Math.max(s, 40);
        if (mv.onlySleep && me.status !== 'slp') s = 0;
        if (mv.recharge) s *= 0.8;
        if (mv.charge) s *= 0.9;
      }
    }
    return { m, s: s * (0.7 + Math.random() * 0.6) };
  }).sort((a, b) => b.s - a.s);
  return scored[0] ? scored[0].m : usable[0];
}

/* ============================================================
   プレイヤーの こうどう
   ============================================================ */
async function playerAction(act) {
  const st = B;
  if (!st || st.busy || st.over) return;
  clearTurnState();
  /* まもる いがいの こうどう (どうぐ・こうかん・にげる) で れんぞく カウントを リセット */
  const me = activeMon();
  if (me && act.type !== 'move') me.protectCount = 0;

  if (act.type === 'switch') {
    const ok = await doSwitch(false);
    if (!ok || !B || B !== st || st.over) return;
    st.busy = true;
    hideActions();
    await resolveSwitchAfter();
    if (!B || B !== st || st.over) return;
    st.busy = false;
    showMainActions();
    updateBattleUI();
    return;
  }

  if (act.type === 'item') {
    const it = ITEMS[act.id];
    if (!it) return;
    if (it.kind === 'ball') {
      if (st.isTrainer) { await say('トレーナーの パチモンを とるのは ルールいはんだ！'); return; }
      st.busy = true; hideActions();
      await resolveBall(act.id);
    } else {
      const used = await useBattleItem(act.id);
      if (!used || !B || B !== st || st.over) return;
      st.busy = true; hideActions();
      await enemyAttack();
      if (st.turnInterrupted || st.over) st.turnInterrupted = false;
      else await endOfTurn();
    }
    if (!B || B !== st || st.over) return;
    st.busy = false;
    showMainActions();
    updateBattleUI();
    return;
  }

  st.busy = true;
  hideActions();
  if (act.type === 'move') await resolveMoves(act.index);
  else if (act.type === 'run') await resolveRun();

  if (!B || B !== st || st.over) return;
  st.busy = false;
  showMainActions();
  updateBattleUI();
}

async function useBattleItem(id) {
  const it = ITEMS[id];
  if (!it || (G.items[id] || 0) <= 0) return false;
  if (it.kind === 'battle') {
    const me = activeMon();
    G.items[id]--;
    await say(`${it.name}を つかった！`);
    await changeStage(me, it.stat, it.stages, true);
    return true;
  }
  const idx = await pickParty({ title: `${it.name}を だれに つかう？`, aliveOnly: false, cancelable: true });
  if (idx == null) return false;
  const m = G.party[idx];
  const res = applyItemToMon(id, m);
  if (!res.ok) { toast(res.msg); return false; }
  G.items[id]--;
  await say(`${it.name}を つかった！`);
  await say(res.msg);
  Sfx.heal();
  updateBattleUI();
  return true;
}

async function resolveMoves(index) {
  const st = B;
  if (!st) return;
  const me = activeMon(), foe = st.enemy;
  const slot = (index != null && index < me.moves.length) ? me.moves[index] : null;
  const eSlot = chooseEnemyMove();
  const pm = slot ? MOVES[slot.id] : STRUGGLE;
  const em = eSlot ? MOVES[eSlot.id] : null;

  /* ふいうちの はんてい用: この ターンに えらんだ わざ
     (溜めわざの 2ターン目は 実際に くりだす わざを つかう) */
  me.turnMoveId = me.charging ? me.charging.moveId : (slot ? slot.id : 'struggle');
  foe.turnMoveId = foe.charging ? foe.charging.moveId : (eSlot ? eSlot.id : 'struggle');

  if (slot && ['choiceband', 'choicespecs', 'choicescarf'].includes(me.heldItem)) {
    me.choiceLock = slot.id;
  }

  const pPri = pm.priority || 0, ePri = em ? (em.priority || 0) : -1;
  const pSpd = effStat(me, 'spe'), eSpd = effStat(foe, 'spe');
  let playerFirst;
  if (me.heldItem === 'quickclaw' && brng() < 0.2) playerFirst = true;
  else if (foe.heldItem === 'quickclaw' && brng() < 0.2) playerFirst = false;
  else playerFirst = pPri > ePri || (pPri === ePri && (pSpd > eSpd || (pSpd === eSpd && brng() < 0.5)));

  if (playerFirst) {
    await performMove(me, foe, slot, true);
    if (st.turnInterrupted || st.over) { st.turnInterrupted = false; return; }
    await performMove(foe, me, eSlot, false);
    if (st.turnInterrupted || st.over) { st.turnInterrupted = false; return; }
  } else {
    await performMove(foe, me, eSlot, false);
    if (st.turnInterrupted || st.over) { st.turnInterrupted = false; return; }
    await performMove(me, foe, slot, true);
    if (st.turnInterrupted || st.over) { st.turnInterrupted = false; return; }
  }
  await endOfTurn();
}

async function resolveBall(ballId) {
  const st = B;
  if (!st) return;
  if (st.isTrainer) { await say('トレーナーの パチモンを とるのは ルールいはんだ！'); return; }
  if ((G.items[ballId] || 0) <= 0) { await say('ボールが ない！'); return; }
  await tryCatch(ballId);
  if (!B || B.over) return;
  await enemyAttack();
  if (st.turnInterrupted || st.over) { st.turnInterrupted = false; return; }
  await endOfTurn();
}

async function resolveSwitchAfter() {
  const st = B;
  if (!st) return;
  enterAnim('#player-wrap');
  updateBattleUI();
  await say(`ゆけっ！ ${monName(activeMon())}！`);
  await onEntry('player');
  await enemyAttack();
  if (st.turnInterrupted || st.over) { st.turnInterrupted = false; return; }
  await endOfTurn();
}

async function resolveRun() {
  const st = B;
  if (!st) return;
  if (st.isTrainer) { await say('トレーナーしょうぶからは にげられない！'); return; }
  const me = activeMon(), foe = st.enemy;
  if (me.ability === 'runaway') {
    await say('にげあしで うまく にげきれた！');
    await endBattleUI();
    return;
  }
  const chance = clamp(0.55 + (effStat(me, 'spe') - effStat(foe, 'spe')) / 80, 0.25, 0.95);
  if (Math.random() < chance) {
    await say('うまく にげきれた！');
    await endBattleUI();
  } else {
    await say('にげきれなかった！');
    await enemyAttack();
    if (st.turnInterrupted || st.over) { st.turnInterrupted = false; return; }
    await endOfTurn();
  }
}

async function enemyAttack() {
  const st = B;
  if (!st || st.over) return;
  if (!st.enemy || st.enemy.hp <= 0) return;
  const slot = chooseEnemyMove();
  st.enemy.turnMoveId = slot ? slot.id : 'struggle';
  await performMove(st.enemy, activeMon(), slot, false);
}

/* ============================================================
   ターン しゅうりょう
   ============================================================ */
async function chipDamage(mon, side, dmg, msg) {
  /* マジックガード: 間接ダメージを すべて むこう */
  if (mon.ability === 'magicguard') return false;
  mon.hp = Math.max(0, mon.hp - dmg);
  updateBattleUI();
  showDamage(wrapSel(side), dmg, 1, false);
  await say(msg, 420);
  return mon.hp <= 0;
}
async function endOfTurn() {
  const st = B;
  if (!st || st.over) return;
  const weatherChip = {
    sand: { block: ['rock', 'ground', 'steel'], div: 16, msg: 'すなあらしに あおられた' },
    hail: { block: ['ice'], div: 16, msg: 'あられに うたれた' },
  }[st.weather];
  const statusChip = {
    brn: { div: 16, msg: 'やけどの ダメージを うけている' },
    psn: { div: 8, msg: 'どくの ダメージを うけている' },
  };
  /* ネット対戦では おたがいの ゲームで 同じ 順番に なるよう、
     ホスト → ゲスト の 固定順で 処理する。 */
  const sideOrder = (B && B.pvp)
    ? (B.mySide === 'host' ? ['player', 'enemy'] : ['enemy', 'player'])
    : ['player', 'enemy'];
  for (const side of sideOrder) {
    if (!B || B.over || st.turnInterrupted) return;
    const mon = monAt(side);
    if (!mon || mon.hp <= 0) continue;

    if (weatherChip && !weatherChip.block.some(t => typeHas(mon, t))) {
      const d = Math.max(1, Math.floor(mon.maxHp / weatherChip.div));
      if (await chipDamage(mon, side, d, `${monName(mon)} は ${weatherChip.msg}！`)) {
        await handleFaint(side); return;
      }
    }

    if (mon.heldItem === 'leftovers' && mon.hp < mon.maxHp) {
      const heal = Math.max(1, Math.floor(mon.maxHp / 16));
      mon.hp = Math.min(mon.maxHp, mon.hp + heal);
      updateBattleUI();
      await say(`${monName(mon)} は たべのこしで ${heal} HP かいふくした！`, 420);
    }

    if (mon.hp <= mon.maxHp / 2 && !mon.berryUsed) {
      if (mon.heldItem === 'oranberry') {
        mon.berryUsed = true; mon.heldItem = null;
        mon.hp = Math.min(mon.maxHp, mon.hp + 10);
        updateBattleUI(); Sfx.heal();
        await say(`${monName(mon)} は オレンのみで 10 HP かいふくした！`, 420);
      } else if (mon.heldItem === 'sitrusberry') {
        mon.berryUsed = true; mon.heldItem = null;
        const heal = Math.max(1, Math.floor(mon.maxHp / 4));
        mon.hp = Math.min(mon.maxHp, mon.hp + heal);
        updateBattleUI(); Sfx.heal();
        await say(`${monName(mon)} は オボンのみで ${heal} HP かいふくした！`, 420);
      }
    }

    if (mon.leechseed) {
      const d = Math.max(1, Math.floor(mon.maxHp / 8));
      const other = monAt(otherSide(side));
      if (other && other.hp > 0) other.hp = Math.min(other.maxHp, other.hp + d);
      if (await chipDamage(mon, side, d, `${monName(mon)} は やどりぎのタネで ${d} すいとられた！`)) {
        await handleFaint(side); return;
      }
    }

    if (mon.status === 'tox') {
      mon.toxicCounter = (mon.toxicCounter || 0) + 1;
      const d = Math.max(1, Math.floor(mon.maxHp * mon.toxicCounter / 16));
      if (await chipDamage(mon, side, d, `${monName(mon)} は もうどくの ダメージを うけている！`)) {
        await handleFaint(side); return;
      }
    } else if (statusChip[mon.status]) {
      const chip = statusChip[mon.status];
      const d = Math.max(1, Math.floor(mon.maxHp / chip.div));
      if (await chipDamage(mon, side, d, `${monName(mon)} は ${chip.msg}！`)) {
        await handleFaint(side); return;
      }
    }

    /* ターン おわりに はたらく とくせい */
    if (mon.hp > 0 && !st.over) {
      if (mon.ability === 'speedboost' && ((mon.stages && mon.stages.spe) || 0) < 6) {
        await changeStage(mon, 'spe', 1, true);
        if (!B || B.over || st.turnInterrupted) return;
      }
      if (mon.ability === 'icebody' && st.weather === 'hail' && mon.hp < mon.maxHp) {
        const heal = Math.max(1, Math.floor(mon.maxHp / 16));
        mon.hp = Math.min(mon.maxHp, mon.hp + heal);
        updateBattleUI();
        await say(`${monName(mon)} は アイスボディで ${heal} HP かいふくした！`, 420);
      }
      const cure = (mon.ability === 'shedskin' && brng() < 0.3)
        || (mon.ability === 'hydration' && st.weather === 'rain');
      if (cure && mon.status) {
        const label = STATUS_LABELS[mon.status] || mon.status;
        mon.status = null; mon.sleepTurns = 0; mon.toxicCounter = 0;
        updateBattleUI();
        await say(`${monName(mon)} は ${label}が なおった！`, 420);
      }
    }
  }

  for (const scr of [st.playerScreens, st.enemyScreens]) {
    if (scr.reflect > 0) scr.reflect--;
    if (scr.lightscreen > 0) scr.lightscreen--;
  }
  if (st.weather) {
    st.weatherTurns--;
    if (st.weatherTurns <= 0) {
      const w = st.weather;
      st.weather = null; st.weatherTurns = 0;
      await say(`${weatherLabel(w)}が おさまった！`, 460);
    }
  }
  clearTurnState();
  updateBattleUI();
}

/* ============================================================
   ひんし / しょうり
   ============================================================ */
async function handleFaint(side) {
  const st = B;
  if (!st || st.over) return;
  if (st.pvp) return pvpHandleFaint(side);
  st.turnInterrupted = true;

  if (side === 'enemy') {
    const mon = st.enemy;
    Sfx.faint();
    $('#enemy-wrap').classList.add('faint');
    await say(`${monName(mon)} は たおれた！`);
    const slayer = activeMon();
    if (slayer && slayer.hp > 0 && slayer.ability === 'moxie' && ((slayer.stages && slayer.stages.atk) || 0) < 6) {
      await changeStage(slayer, 'atk', 1, true);
      if (!B || B.over) return;
    }
    await awardExp(mon);
    if (!B || B.over) return;
    const next = st.team.find(m => m.hp > 0);
    if (next) { await sendNextEnemy(); return; }
    await handleVictory();
  } else {
    const mon = activeMon();
    Sfx.faint();
    $('#player-wrap').classList.add('faint');
    await say(`${monName(mon)} は たおれて たたかえない！`);
    if (G.party.some(m => m.hp > 0)) {
      await say('つぎの パチモンを えらんでくれ！');
      const foe = st.enemy;
      if (foe && foe.hp > 0 && foe.ability === 'moxie' && ((foe.stages && foe.stages.atk) || 0) < 6) {
        await changeStage(foe, 'atk', 1, true);
        if (!B || B.over) return;
      }
      const ok = await doSwitch(true);
      if (!ok || !B || B.over) return;
      enterAnim('#player-wrap');
      await say(`ゆけっ！ ${monName(activeMon())}！`);
      await onEntry('player');
      updateBattleUI();
    } else {
      await say('めのまえが まっくらに なった…', 900);
      await endBattleUI();
      await whiteout();
    }
  }
}

async function sendNextEnemy() {
  const st = B;
  if (!st) return;
  const next = st.team.find(m => m.hp > 0);
  if (!next) return;
  st.enemy = next;
  resetMonBattleState(next);
  G.dex.seen.add(next.species);
  enterAnim('#enemy-wrap');
  updateBattleUI();
  Sfx.cry(next.species);
  if (st.trainerId) await say(`${TRAINERS[st.trainerId].name} は ${monName(next)} を くりだした！`);
  else await say(`つぎの ${monName(next)} が あらわれた！`);
  await onEntry('enemy');
}

async function handleVictory() {
  const st = B;
  if (!st) return;
  if (st.trainerId) {
    const def = TRAINERS[st.trainerId];
    G.flags['trainer_' + st.trainerId] = true;
    G.money += def.reward;
    await say(`${def.name} との しょうぶに かった！`);
    await say(`しょうりきん ${def.reward}パチ を もらった！`);
    if (def.badge && !G.badges.includes(def.badge)) {
      G.badges.push(def.badge);
      const bd = BADGES[def.badge];
      await say(`${bd ? bd.name : def.badge}を てにいれた！`, 1000);
      Sfx.levelup();
    }
    if (grantBikeIfEligible()) {
      await say('バッジを 2こ あつめた！ おいわいに じてんしゃを もらった！', 1400);
      await say('バッグで のりおり できる。のると いどうが 1.5ばいに なるぞ！', 1400);
      Sfx.levelup();
    }
    if (def.final) {
      await endBattleUI();
      await showEnding();
      return;
    }
  } else {
    const coins = ri(st.enemy.level * 4, st.enemy.level * 8);
    G.money += coins;
    await say(`しょうりきんとして ${coins}パチ ひろった。`);
  }
  Music.play('victory');
  await wait(1800);
  await endBattleUI();
}

async function endBattleUI() {
  if (!B) return;
  const wasPvp = !!B.pvp;
  B.over = true;
  battleActive = false;
  stopBattleLoop();
  if (wasPvp && typeof pvpCleanupBattle === 'function') pvpCleanupBattle();
  const wb = $('#weather-badge');
  if (wb) wb.classList.add('hidden');
  const nb = $('#net-badge');
  if (nb) nb.classList.add('hidden');
  const expWrap = $('#player-exp') && $('#player-exp').parentElement;
  if (expWrap) expWrap.classList.remove('hidden');
  setScreen('world');
  syncHUD();
  saveGame(true);
  B = null;
}

/* ============================================================
   けいけんち / しんか
   ============================================================ */
/* ---------------- 経験値分配 ---------------- */
async function awardExp(defeated) {
  const st = B;
  if (!st) return;
  const sp = SPECIES[defeated.species];
  const trainerMul = st.isTrainer ? 1.5 : 1;
  const baseGain = Math.max(1, Math.floor(sp.exp * defeated.level / 5 * trainerMul * 1.2));

  /*
     一度でも先頭に出た（hasLedがtrue）パチモンには100%の経験値を分配。
     それ以外の生存パチモン（控え）には75%を分配。
     さらに 全員、これまでの 50% の けいけんち に なるよう 調整。

     レベル差ボーナス: 自分より レベルの たかい あいてを たおした ときは、
     1レベルにつき +15%（さいだい 4ばい）の けいけんちを かける。
     レベルを あげるのが おいつかない ときに、たかい レベルの
     ゾーンで 育やすく するため。
  */
  const EXP_RATE = 0.5;
  const LEVEL_GAP_RATE = 0.15;
  const LEVEL_GAP_MAX_MUL = 4;
  const reserveRate = G.items.expall ? 1 : 0.75;
  const receivers = [];

  for (const m of G.party) {
    if (m.hp <= 0) continue;
    // 戦闘に参加した（先頭に出た）パチモンは100%
    const rate = m.hasLed ? 1 : reserveRate;
    const gap = Math.max(0, defeated.level - m.level);
    const levelBonus = Math.min(LEVEL_GAP_MAX_MUL, 1 + gap * LEVEL_GAP_RATE);
    receivers.push({ mon: m, gain: Math.max(1, Math.floor(baseGain * rate * EXP_RATE * levelBonus)) });
  }

  for (const { mon, gain: g } of receivers) {
    await say(`${monName(mon)} は ${g} EXP を かちとった！`, 520);
    const oldMax = mon.maxHp;
    mon.exp += g;
    const evs = evYield(sp);
    addEV(mon, evs);
    recalcStats(mon);
    if (mon.hp > 0) mon.hp = Math.min(mon.maxHp, mon.hp + Math.max(0, mon.maxHp - oldMax));
    await levelUpLoop(mon);
  }
  updateBattleUI();
}

async function levelUpLoop(mon) {
  let guard = 0;
  while (mon.level < 100 && guard++ < 60) {
    const need = expToNext(mon.level, SPECIES[mon.species].growth);
    if (mon.exp < need) break;
    mon.exp -= need;
    mon.level++;
    const oldMax = mon.maxHp;
    recalcStats(mon);
    mon.hp = Math.min(mon.maxHp, mon.hp + Math.max(0, mon.maxHp - oldMax));
    Sfx.levelup();
    updateBattleUI();
    await say(`${monName(mon)} は レベル${mon.level} に あがった！`);

    const learn = SPECIES[mon.species].learn.filter(e => e[0] === mon.level).map(e => e[1]);
    for (const mvId of learn) {
      if (!MOVES[mvId]) continue;
      if (mon.moves.some(m => m.id === mvId)) continue;
      await offerLearnMove(mon, mvId);
    }

    await tryEvolve(mon);
  }
  /* しんか レベルを こえて 手に いれた 個体は、レベルが 1つでも
     あがれば（経験値を えた だけでも）しんか できる。 */
  if (mon.evoPending) await tryEvolve(mon);
}

async function tryEvolve(mon) {
  let guard = 0;
  while (guard++ < 5) {
    const evo = SPECIES[mon.species] && SPECIES[mon.species].evolve;
    if (!evo || evo.into === mon.species || mon.level < evo.level) break;
    mon.evoPending = false;
    await evolveMon(mon, evo.into);
  }
}

/* あたらしい わざを おぼえるか どうか、おぼえる ばあいは どの わざを わすれるかを えらぶ。
   もどりち: 'learn' = あたらしく おぼえる / 0〜3 = その わざを わすれる / null = おぼえない */
function learnMoveModal(mon, newId) {
  return new Promise(resolve => {
    const mv = MOVES[newId];
    const typeCol = TYPES[mv.type] ? TYPES[mv.type].color : '#888';
    const typeName = TYPES[mv.type] ? TYPES[mv.type].name : mv.type;
    const power = mv.power ? `${mv.power}` : '—';
    const acc = mv.acc == null ? '—' : `${mv.acc}`;
    const pp = mv.pp === Infinity ? '—' : mv.pp;

    const head = `
      <div class="learn-card">
        <div class="learn-tag">あたらしい わざ</div>
        <div class="learn-title">${mv.name}</div>
        <div class="learn-meta">
          <span style="color:${typeCol}">${typeName}</span>
          <span>${moveCatLabel(mv)}</span>
          <span>いりょく ${power}</span>
          <span>めいちゅう ${acc}</span>
          <span>PP ${pp}</span>
        </div>
      </div>`;

    if (mon.moves.length < 4) {
      openModal('わざを おぼえる', `
        ${head}
        <p class="learn-note">${monName(mon)} は ${mv.name} を おぼえられる！ おぼえますか？</p>
        <div class="learn-actions">
          <button class="btn btn-yellow" data-learn="1">おぼえる</button>
          <button class="btn" data-skip="1">おぼえない</button>
        </div>
      `, { locked: true });
    } else {
      openModal('わざを おぼえる', `
        ${head}
        <p class="learn-note">${monName(mon)} は 4つの わざを おぼえている。<br>
          どの わざを わすれて ${mv.name} を おぼえる？（わすれない ばあいは キャンセル）</p>
        <div class="learn-list">
          ${mon.moves.map((m, i) => {
            const om = MOVES[m.id];
            if (!om) return '';
            const oc = TYPES[om.type] ? TYPES[om.type].color : '#888';
            return `<button class="btn learn-slot" data-forget="${i}">
              <b>${om.name}</b>
              <small style="color:${oc}">${TYPES[om.type] ? TYPES[om.type].name : om.type}・${moveCatLabel(om)}${om.power ? '・' + om.power : ''}</small>
              <span class="learn-forget">わすれる</span>
            </button>`;
          }).join('')}
        </div>
        <div class="learn-actions">
          <button class="btn" data-skip="1">おぼえない</button>
        </div>
      `, { locked: true });
    }

    const body = $('#modal-body');
    let done = false;
    const finish = val => {
      if (done) return;
      done = true;
      closeModal();
      resolve(val);
    };
    body.querySelectorAll('[data-learn]').forEach(b => b.addEventListener('click', () => { Sfx.click(); finish('learn'); }));
    body.querySelectorAll('[data-forget]').forEach(b => b.addEventListener('click', () => {
      Sfx.click();
      finish(Number(b.dataset.forget));
    }));
    body.querySelectorAll('[data-skip]').forEach(b => b.addEventListener('click', () => { Sfx.click(); finish(null); }));
  });
}

async function offerLearnMove(mon, mvId) {
  const mv = MOVES[mvId];
  if (!mv) return;
  await say(`${monName(mon)} は ${mv.name} を おぼえそうだ…`, 700);
  const ans = await learnMoveModal(mon, mvId);
  if (ans === null) {
    await say(`しかし ${monName(mon)} は ${mv.name} を おぼえなかった。`);
    return;
  }
  if (ans === 'learn') {
    mon.moves.push({ id: mvId, pp: mv.pp });
    Sfx.levelup();
    await say(`${monName(mon)} は ${mv.name} を おぼえた！`);
    return;
  }
  const old = mon.moves[ans];
  mon.moves[ans] = { id: mvId, pp: mv.pp };
  Sfx.levelup();
  await say(`${monName(mon)} は ${MOVES[old.id].name} を わすれて… ${mv.name} を おぼえた！`);
}

async function evolveMon(mon, into) {
  const oldName = monName(mon);
  await say(`あれっ…？ ${oldName} の すがたが…！`, 1000);
  const ratio = mon.hp / mon.maxHp;
  mon.species = into;
  mon.evoPending = false;
  mon.ability = SPECIES[into].ability;
  recalcStats(mon);
  mon.hp = clamp(Math.round(mon.maxHp * ratio), 1, mon.maxHp);
  G.dex.seen.add(into);
  G.dex.caught.add(into);
  Sfx.catchOk();
  updateBattleUI();
  await say(`おめでとう！ ${SPECIES[into].name} に しんかした！`, 1100);
}

/* ============================================================
   つかまえる
   ============================================================ */
function catchChance(foe, ball) {
  if (ball.bonus >= 255) return 1;
  const sp = SPECIES[foe.species];
  let a = ((3 * foe.maxHp - 2 * foe.hp) * sp.catch * ball.bonus) / (3 * foe.maxHp);
  if (foe.status) a *= (foe.status === 'slp' || foe.status === 'frz') ? 2 : 1.5;
  return clamp(a / 255, 0.03, 0.97);
}

async function tryCatch(ballId) {
  const st = B;
  if (!st) return;
  const it = ITEMS[ballId];
  if ((G.items[ballId] || 0) <= 0) { await say('ボールが ない！'); return; }
  G.items[ballId]--;
  await say(`${it.name}を なげた！`);
  const foe = st.enemy;
  const field = $('.battle-field');
  const ball = document.createElement('div');
  ball.className = 'thrown-ball';
  field.appendChild(ball);
  Sfx.throwball();
  await wait(620);
  $('#enemy-wrap').style.opacity = '0';
  ball.remove();

  const p = catchChance(foe, it);
  const shake = document.createElement('div');
  shake.className = 'ball-shake';
  shake.innerHTML = '<div class="thrown-ball"></div>';
  field.appendChild(shake);
  await wait(280);
  const success = Math.random() < p;
  const shakes = success ? 3 : Math.min(2, Math.floor(Math.random() * 3));
  for (let i = 0; i < shakes; i++) { Sfx.pop(); await wait(520); }

  if (success) {
    Sfx.catchOk();
    await say(`やったー！ ${monName(foe)} を つかまえた！`, 1000);
    shake.remove();
    G.dex.caught.add(foe.species);
    resetMonBattleState(foe);
    foe.hp = Math.max(1, foe.hp);
    if (G.party.length < 6) {
      G.party.push(foe);
      await say(`${monName(foe)} が パーティに くわわった！`);
    } else {
      G.box.push(foe);
      await say(`${monName(foe)} は パチボックスに おくられた。`);
    }
    await endBattleUI();
    return;
  }

  shake.remove();
  $('#enemy-wrap').style.opacity = '';
  Sfx.pop();
  await say(`あっ！ ${monName(foe)} は ボールから でてしまった！`);
}

/* ============================================================
   こうかん
   ============================================================ */
async function doSwitch(forced) {
  const idx = await pickParty({
    title: forced ? 'つぎの パチモンを えらんでね！' : 'だれと こうかんする？',
    aliveOnly: true,
    cancelable: !forced,
  });
  if (idx == null) return false;
  if (idx === 0 && !forced) { toast('すでに せんとう中だ！'); return false; }
  if (idx > 0) {
    const old = G.party[0];
    const m = G.party.splice(idx, 1)[0];
    G.party.unshift(m);
    resetMonBattleState(old);
    resetMonBattleState(m);
  }
  const lead = G.party[0];
  if (lead) lead.hasLed = true;
  updateBattleUI();
  return true;
}

/* ---------------- ボタン ---------------- */
$('#battle-actions').addEventListener('click', async e => {
  const btn = e.target.closest('button');
  if (!btn || !B || B.busy || B.over || btn.disabled) return;
  const act = btn.dataset.act;
  Sfx.click();
  if (B && B.pvp) {
    if (act === 'move') showMoveMenu();
    else if (act === 'bag') showBagMenu();
    else if (act === 'back') showMainActions();
    else pvpActionClick(act);
    return;
  }
  if (act === 'move') showMoveMenu();
  else if (act === 'bag') showBagMenu();
  else if (act === 'back') showMainActions();
  else if (act === 'run') playerAction({ type: 'run' });
  else if (act === 'switch') playerAction({ type: 'switch' });
  else if (act === 'struggle') playerAction({ type: 'move', index: null });
  else if (act.startsWith('move:')) playerAction({ type: 'move', index: Number(act.split(':')[1]) });
  else if (act.startsWith('item:')) playerAction({ type: 'item', id: act.split(':')[1] });
});
