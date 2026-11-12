/* ============================================================
   パチモン — バトルエンジン
   ============================================================ */
'use strict';

let B = null;
let battleLoopId = 0;
const STAT_NAMES = { atk:'こうげき', def:'ぼうぎょ', spd:'すばやさ' };

/* ---------------- すがたを みせる ---------------- */
async function startBattle(enemyMon, opts = {}) {
  if (!G.party.length) return;
  battleActive = true;
  const st = {
    enemy: enemyMon,
    team: opts.team || [enemyMon],
    trainerId: opts.trainerId || null,
    isTrainer: !!opts.trainerId,
    busy: true, over: false, faintHandled: false,
  };
  B = st;
  G.dex.seen.add(enemyMon.species);
  for (const m of G.party) m.stages = { atk: 0, def: 0, spd: 0 };
  enemyMon.stages = { atk: 0, def: 0, spd: 0 };

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
    await say(`${t.name} は ${monName(st.enemy)} を くりだした！`);
  } else {
    await say(`やせいの ${monName(st.enemy)} が とびだしてきた！`);
  }
  $('#enemy-wrap').classList.add('entering');
  setTimeout(() => $('#enemy-wrap').classList.remove('entering'), 600);
  await say(`ゆけっ！ ${monName(activeMon())}！`);
  st.busy = false;
  showMainActions();
}

function resetBattleSprites() {
  for (const sel of ['#enemy-wrap', '#player-wrap']) {
    const el = $(sel);
    el.className = 'sprite-wrap';
    el.style.opacity = '';
  }
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
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, canvas.width, canvas.height);
  if (!mon) return;
  drawPachimon(c, mon.species, canvas.width / 2, canvas.height - 30, 1.55, performance.now(), { flip: !isPlayer });
}

/* ---------------- UI ---------------- */
async function say(text, ms = 780) {
  if (!B) return;
  const el = $('#battle-log');
  el.textContent = text;
  el.classList.remove('log-in');
  void el.offsetWidth;
  el.classList.add('log-in');
  await wait(ms);
}
function hideActions() { $('#battle-actions').innerHTML = ''; }
function showMainActions() {
  const a = $('#battle-actions');
  a.className = 'battle-actions';
  a.innerHTML = `
    <button class="btn btn-yellow" data-act="move">わざ</button>
    <button class="btn btn-blue" data-act="ball">ボール</button>
    <button class="btn btn-green" data-act="switch">こうかん</button>
    <button class="btn btn-red" data-act="run">にげる</button>`;
}
function showMoveMenu() {
  const me = activeMon();
  const a = $('#battle-actions');
  a.className = 'battle-actions moves';
  const allZero = me.moves.every(m => m.pp <= 0);
  if (allZero) {
    a.innerHTML = `<button class="btn btn-red wide" data-act="struggle">わるあがき</button>
      <button class="btn wide" data-act="back">もどる</button>`;
    return;
  }
  a.innerHTML = me.moves.map((m, i) => {
    const mv = MOVES[m.id];
    return `<button class="btn move-btn" data-act="move:${i}" ${m.pp <= 0 ? 'disabled' : ''}>
      ${mv.name} <span class="pp">${m.pp}/${mv.pp}</span>
      <small style="color:${TYPES[mv.type].color}">${TYPES[mv.type].name}${mv.power ? '・' + mv.power : ''}</small>
    </button>`;
  }).join('') + `<button class="btn wide" data-act="back">もどる</button>`;
}
function showBallMenu() {
  const a = $('#battle-actions');
  a.className = 'battle-actions moves';
  if (B.isTrainer) {
    a.innerHTML = `<div class="btn wide" style="pointer-events:none;text-align:left">トレーナーしょうぶでは ボールを つかえない！</div>
      <button class="btn wide" data-act="back">もどる</button>`;
    return;
  }
  const balls = [['pachiball', '⚪'], ['superball', '🔵']];
  a.innerHTML = balls.map(([id, ic]) => {
    const it = ITEMS[id], cnt = G.items[id] || 0;
    return `<button class="btn" data-act="ball:${id}" ${cnt <= 0 ? 'disabled' : ''}>${ic}${it.name}<small>×${cnt}</small></button>`;
  }).join('') + `<button class="btn wide" data-act="back">もどる</button>`;
}
function updateBattleUI() {
  if (!B) return;
  const me = activeMon(), foe = B.enemy;
  $('#enemy-name').innerHTML = monName(foe) + statusTag(foe);
  $('#enemy-lv').textContent = 'Lv' + foe.level;
  $('#enemy-types').innerHTML = typeChips(SPECIES[foe.species].types);
  const er = foe.hp / foe.maxHp;
  const eb = $('#enemy-hp');
  eb.style.width = (er * 100) + '%'; eb.className = hpClass(er);

  if (me) {
    $('#player-name').innerHTML = monName(me) + statusTag(me);
    $('#player-lv').textContent = 'Lv' + me.level;
    const r = me.hp / me.maxHp;
    const pb = $('#player-hp');
    pb.style.width = (r * 100) + '%'; pb.className = hpClass(r);
    $('#player-hpnum').textContent = `${me.hp}/${me.maxHp}`;
    $('#player-exp').style.width = clamp(me.exp / expToNext(me.level) * 100, 0, 100) + '%';
  }
}

/* ---------------- アニメ ---------------- */
function animAttack(isPlayer) {
  const src = $(isPlayer ? '#player-wrap' : '#enemy-wrap');
  const tgt = $(isPlayer ? '#enemy-wrap' : '#player-wrap');
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

/* ダメージ すうじ ポップ */
function showDamage(sel, dmg, eff, crit) {
  const wrap = $(sel);
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = 'dmg-pop' + (crit ? ' crit' : eff > 1 ? ' sup' : eff < 1 ? ' res' : '');
  el.textContent = '-' + dmg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

/* こうか ばつぐん の ひかり */
function effFlash(crit) {
  const field = $('.battle-field');
  if (!field) return;
  const d = document.createElement('div');
  d.className = 'eff-flash' + (crit ? ' crit' : '');
  field.appendChild(d);
  setTimeout(() => d.remove(), 480);
}

/* ---------------- こうげき りょうさん ---------------- */
function effStat(mon, key) {
  let v = mon[key];
  const st = mon.stages ? mon.stages[key] : 0;
  const mul = st >= 0 ? (2 + st) / 2 : 2 / (2 - st);
  v = v * mul;
  if (mon.status === 'brn' && key === 'atk') v *= 0.6;
  if (mon.status === 'par' && key === 'spd') v *= 0.5;
  return Math.max(1, Math.floor(v));
}
function calcDamage(atkMon, defMon, move) {
  const A = effStat(atkMon, 'atk'), D = effStat(defMon, 'def');
  const crit = Math.random() < 0.0625;
  let dmg = Math.floor((Math.floor(2 * atkMon.level / 5 + 2) * move.power * A / Math.max(1, D)) / 50) + 2;
  if (crit) dmg = Math.floor(dmg * 1.5);
  const eff = typeEffect(move.type, SPECIES[defMon.species].types);
  dmg = Math.floor(dmg * eff);
  if (SPECIES[atkMon.species].types.includes(move.type)) dmg = Math.floor(dmg * 1.5);
  dmg = Math.floor(dmg * (0.85 + Math.random() * 0.15));
  return { dmg: Math.max(1, dmg), eff, crit };
}

/* ---------------- てきの AI ---------------- */
function chooseEnemyMove() {
  const foe = B.enemy, me = activeMon();
  const usable = foe.moves.filter(m => m.pp > 0);
  if (!usable.length) return null;
  const scored = usable.map(m => {
    const mv = MOVES[m.id];
    let s = 25;
    if (mv.power > 0) s = mv.power * Math.max(0.25, typeEffect(mv.type, SPECIES[me.species].types));
    else if (mv.effect === 'heal' && foe.hp < foe.maxHp * 0.4) s = 90;
    else if (mv.effect === 'sleep' || mv.effect === 'para') s = 55;
    return { m, s: s * (0.65 + Math.random() * 0.7) };
  }).sort((a, b) => b.s - a.s);
  return scored[0].m;
}

/* ---------------- わざを つかう ---------------- */
async function performMove(attacker, defender, slot, isPlayer) {
  const st = B;
  if (!st || st.over) return;
  const move = slot ? MOVES[slot.id] : STRUGGLE;

  if (attacker.status === 'slp') {
    if (attacker.sleepTurns > 0) {
      attacker.sleepTurns--;
      if (attacker.sleepTurns <= 0) {
        attacker.status = null;
        await say(`${monName(attacker)} は めを さました！`);
      } else {
        await say(`${monName(attacker)} は ぐうぐう ねむっている…`);
        return;
      }
    } else attacker.status = null;
  }
  if (attacker.status === 'par' && Math.random() < 0.25) {
    await say(`${monName(attacker)} は しびれて うごけない！`);
    return;
  }

  if (slot) slot.pp = Math.max(0, slot.pp - 1);
  await say(`${monName(attacker)} の ${move.name}！`, 620);

  if (Math.random() * 100 >= move.acc) { await say('しかし わざが はずれた！'); return; }
  if (move.effect) { await applyEffect(move, attacker, defender); return; }

  const mult = typeEffect(move.type, SPECIES[defender.species].types);
  if (mult === 0) { await say(`しかし ${monName(defender)} には きかないようだ…`); return; }

  animAttack(isPlayer);
  await wait(340);

  const { dmg, eff, crit } = calcDamage(attacker, defender, move);
  defender.hp = Math.max(0, defender.hp - dmg);
  updateBattleUI();
  showDamage(defender === st.enemy ? '#enemy-wrap' : '#player-wrap', dmg, eff, crit);
  if (eff > 1) effFlash(crit);
  if (crit) await say('きゅうしょに あたった！', 520);
  if (eff > 1) await say('こうかは ばつぐんだ！', 520);
  else if (eff < 1 && eff > 0) await say('こうかは いまひとつの ようだ…', 520);

  if (defender.hp > 0 && !defender.status) {
    if (move.para && Math.random() < move.para) {
      defender.status = 'par';
      await say(`${monName(defender)} は しびれて しまった！`);
    } else if (move.burn && Math.random() < move.burn) {
      defender.status = 'brn';
      await say(`${monName(defender)} は やけどを おって しまった！`);
    }
  }
  updateBattleUI();
  if (defender.hp <= 0) await handleFaint(defender === st.enemy ? 'enemy' : 'player');
}

async function applyEffect(move, attacker, defender) {
  switch (move.effect) {
    case 'heal': {
      if (attacker.hp >= attacker.maxHp) { await say('しかし HPは まんたんだ！'); break; }
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + Math.floor(attacker.maxHp / 2));
      Sfx.heal();
      await say(`${monName(attacker)} の HPが かいふくした！`);
      break;
    }
    case 'atkUp': case 'defUp': case 'spdUp': {
      const key = move.effect === 'atkUp' ? 'atk' : move.effect === 'defUp' ? 'def' : 'spd';
      if (!attacker.stages) attacker.stages = { atk: 0, def: 0, spd: 0 };
      if (attacker.stages[key] >= 3) { await say('しかし これいじょう あがらない！'); break; }
      attacker.stages[key]++;
      Sfx.play(880, .09, 'sine', .05);
      await say(`${monName(attacker)} の ${STAT_NAMES[key]} が あがった！`);
      break;
    }
    case 'atkDown': case 'defDown': {
      const key = move.effect === 'atkDown' ? 'atk' : 'def';
      if (!defender.stages) defender.stages = { atk: 0, def: 0, spd: 0 };
      if (defender.stages[key] <= -3) { await say('しかし これいじょう さがらない！'); break; }
      defender.stages[key]--;
      Sfx.pop();
      await say(`${monName(defender)} の ${STAT_NAMES[key]} が さがった！`);
      break;
    }
    case 'sleep': {
      if (defender.status) { await say('しかし うまく きまらなかった！'); break; }
      defender.status = 'slp'; defender.sleepTurns = ri(1, 3);
      await say(`${monName(defender)} は ねむって しまった！`);
      break;
    }
    case 'para': {
      if (defender.status) { await say('しかし うまく きまらなかった！'); break; }
      defender.status = 'par';
      await say(`${monName(defender)} は しびれて うごけない！`);
      break;
    }
  }
  updateBattleUI();
}

/* ---------------- まわし ---------------- */
async function playerAction(act) {
  const st = B;
  if (!st || st.busy || st.over) return;
  if (act.type === 'switch') {
    const ok = await doSwitch(false);
    if (!ok || !B || B !== st) return;
  }
  st.busy = true;
  hideActions();

  if (act.type === 'move') await resolveMoves(act.index);
  else if (act.type === 'ball') await resolveBall(act.id);
  else if (act.type === 'switch') await resolveSwitchAfter();
  else if (act.type === 'run') await resolveRun();

  if (!B || B.over) return;
  B.busy = false;
  showMainActions();
  updateBattleUI();
}

async function resolveMoves(index) {
  const st = B;
  const me = activeMon();
  const foe = st.enemy;
  const slot = (index != null && index < me.moves.length) ? me.moves[index] : null;
  const eSlot = chooseEnemyMove();
  const pm = slot ? MOVES[slot.id] : STRUGGLE;
  const em = eSlot ? MOVES[eSlot.id] : null;
  const pPri = pm.priority || 0, ePri = em ? (em.priority || 0) : -1;
  const pSpd = effStat(me, 'spd'), eSpd = effStat(foe, 'spd');
  const playerFirst = pPri > ePri || (pPri === ePri && (pSpd > eSpd || (pSpd === eSpd && Math.random() < 0.5)));

  if (playerFirst) {
    await performMove(me, foe, slot, true);
    if (st.faintHandled || st.over) { st.faintHandled = false; return; }
    await performMove(foe, me, eSlot, false);
    if (st.faintHandled || st.over) { st.faintHandled = false; return; }
  } else {
    await performMove(foe, me, eSlot, false);
    if (st.faintHandled || st.over) { st.faintHandled = false; return; }
    await performMove(me, foe, slot, true);
    if (st.faintHandled || st.over) { st.faintHandled = false; return; }
  }
  await endOfTurn();
}

async function resolveBall(ballId) {
  const st = B;
  if (st.isTrainer) { await say('トレーナーの パチモンを とるのは ルールいはんだ！'); return; }
  if ((G.items[ballId] || 0) <= 0) { await say('ボールが ない！'); return; }
  await tryCatch(ballId);
  if (!B || B.over) return;
  await enemyAttack();
  if (st.faintHandled || st.over) { st.faintHandled = false; return; }
}

async function resolveSwitchAfter() {
  const st = B;
  await say(`${monName(activeMon())}、いっちゃえ！`);
  await enemyAttack();
  if (st.faintHandled || st.over) { st.faintHandled = false; return; }
  await endOfTurn();
}

async function resolveRun() {
  const st = B;
  if (st.isTrainer) { await say('トレーナーしょうぶからは にげられない！'); return; }
  const me = activeMon(), foe = st.enemy;
  const chance = clamp(0.55 + (effStat(me, 'spd') - effStat(foe, 'spd')) / 80, 0.25, 0.95);
  if (Math.random() < chance) {
    await say('うまく にげきれた！');
    await endBattleUI();
  } else {
    await say('にげきれなかった！');
    await enemyAttack();
    if (st.faintHandled || st.over) { st.faintHandled = false; return; }
    await endOfTurn();
  }
}

async function enemyAttack() {
  const st = B;
  if (!st || st.over) return;
  if (st.enemy.hp <= 0) return;
  await performMove(st.enemy, activeMon(), chooseEnemyMove(), false);
}

async function endOfTurn() {
  const st = B;
  for (const side of ['player', 'enemy']) {
    if (!B || B.over || st.faintHandled) return;
    const mon = side === 'player' ? activeMon() : st.enemy;
    if (mon && mon.hp > 0 && mon.status === 'brn') {
      const dmg = Math.max(1, Math.floor(mon.maxHp / 16));
      mon.hp = Math.max(0, mon.hp - dmg);
      await say(`${monName(mon)} は やけどの ダメージを うけている！`);
      updateBattleUI();
      if (mon.hp <= 0) await handleFaint(side);
    }
  }
}

/* ---------------- ひんし ---------------- */
async function handleFaint(side) {
  const st = B;
  if (!st || st.over) return;
  st.faintHandled = true;

  if (side === 'enemy') {
    const mon = st.enemy;
    Sfx.faint();
    $('#enemy-wrap').classList.add('faint');
    await say(`${monName(mon)} は たおれた！`);
    await awardExp(mon);
    if (!B || B.over) return;
    if (st.trainerId && st.team.some(m => m.hp > 0)) {
      await sendNextEnemy();
      return;
    }
    await handleVictory();
  } else {
    const mon = activeMon();
    Sfx.faint();
    $('#player-wrap').classList.add('faint');
    await say(`${monName(mon)} は たおれて たたかえない！`);
    if (G.party.some(m => m.hp > 0)) {
      await say('つぎの パチモンを えらんでくれ！');
      const ok = await doSwitch(true);
      if (!ok || !B || B.over) return;
      const wrap = $('#player-wrap');
      wrap.classList.remove('faint');
      wrap.classList.add('entering');
      setTimeout(() => wrap.classList.remove('entering'), 600);
      await say(`ゆけっ！ ${monName(activeMon())}！`);
      updateBattleUI();
    } else {
      await say('しょっぱなから… ゼンメツかい…', 900);
      await endBattleUI();
      await whiteout();
    }
  }
}

async function sendNextEnemy() {
  const st = B;
  const next = st.team.find(m => m.hp > 0);
  if (!next) return;
  st.enemy = next;
  next.stages = { atk: 0, def: 0, spd: 0 };
  G.dex.seen.add(next.species);
  const wrap = $('#enemy-wrap');
  wrap.classList.remove('faint');
  wrap.classList.add('entering');
  setTimeout(() => wrap.classList.remove('entering'), 600);
  updateBattleUI();
  await say(`${TRAINERS[st.trainerId].name} は ${monName(next)} を くりだした！`);
}

async function handleVictory() {
  const st = B;
  if (st.trainerId) {
    const def = TRAINERS[st.trainerId];
    G.flags['trainer_' + st.trainerId] = true;
    G.money += def.reward;
    await say(`${def.name} との しょうぶに かった！`);
    await say(`しょうりきん ${def.reward}パチ を もらった！`);
    if (def.final) {
      Music.play('victory');
      await wait(2100);
      await endBattleUI();
      await showEnding();
      return;
    }
  } else {
    const coins = ri(st.enemy.level * 4, st.enemy.level * 8);
    G.money += coins;
    await say(`しょうりきんとして ${coins}パち ひろった。`);
  }
  Music.play('victory');
  await wait(2100);
  await endBattleUI();
}

async function endBattleUI() {
  if (!B) return;
  B.over = true;
  battleActive = false;
  stopBattleLoop();
  setScreen('world');
  syncHUD();
  saveGame(true);
  B = null;
}

/* ---------------- けいけんち ---------------- */
async function awardExp(defeated) {
  const me = activeMon();
  if (!me || me.hp <= 0) return;
  const sp = SPECIES[defeated.species];
  const gain = Math.max(1, Math.floor(sp.exp * defeated.level / 5));
  await say(`${monName(me)} は ${gain} EXP を かった！`);
  me.exp += gain;

  while (me.exp >= expToNext(me.level) && me.level < 100) {
    me.exp -= expToNext(me.level);
    me.level++;
    const oldMax = me.maxHp;
    recalcStats(me);
    me.hp = Math.min(me.maxHp, me.hp + (me.maxHp - oldMax));
    Sfx.levelup();
    updateBattleUI();
    await say(`${monName(me)} は レベル${me.level} に あがった！`);

    const learn = SPECIES[me.species].learn.filter(e => e[0] === me.level).map(e => e[1]);
    for (const mvId of learn) {
      if (me.moves.some(m => m.id === mvId)) continue;
      if (me.moves.length < 4) {
        me.moves.push({ id: mvId, pp: MOVES[mvId].pp });
        await say(`${monName(me)} は ${MOVES[mvId].name} を おぼえた！`);
      } else {
        const old = me.moves.shift();
        me.moves.push({ id: mvId, pp: MOVES[mvId].pp });
        await say(`${monName(me)} は ${MOVES[old.id].name} を わすれて… ${MOVES[mvId].name} を おぼえた！`);
      }
    }

    const ev = SPECIES[me.species].evolve;
    if (ev && me.level >= ev.level) await evolveMon(me, ev.into);
  }
  updateBattleUI();
}

async function evolveMon(me, into) {
  await say(`あれっ…？ ${monName(me)} の すがたが…！`, 1100);
  const ratio = me.hp / me.maxHp;
  me.species = into;
  recalcStats(me);
  me.hp = clamp(Math.round(me.maxHp * ratio), 1, me.maxHp);
  G.dex.seen.add(into);
  G.dex.caught.add(into);
  const wrap = $('#player-wrap');
  wrap.classList.add('entering');
  setTimeout(() => wrap.classList.remove('entering'), 600);
  Sfx.catchOk();
  updateBattleUI();
  await say(`おめでとう！ ${SPECIES[into].name} に しんかした！`, 1200);
}

/* ---------------- つかまえる ---------------- */
async function tryCatch(ballId) {
  const st = B;
  const it = ITEMS[ballId];
  G.items[ballId]--;
  await say(`${it.name}を なげた！`);
  const foe = st.enemy;
  const ratio = (3 * foe.maxHp - 2 * foe.hp) / (3 * foe.maxHp);
  const sp = SPECIES[foe.species];
  const statusBonus = foe.status ? 1.5 : 1;
  const p = clamp(ratio * sp.catch * it.bonus * statusBonus / 200, 0.02, 0.95);
  const success = Math.random() < p;

  const field = $('.battle-field');
  const ball = document.createElement('div');
  ball.className = 'thrown-ball';
  field.appendChild(ball);
  Sfx.throwball();
  await wait(660);
  $('#enemy-wrap').style.opacity = '0';
  ball.remove();

  const shake = document.createElement('div');
  shake.className = 'ball-shake';
  shake.innerHTML = '<div class="thrown-ball"></div>';
  field.appendChild(shake);
  await wait(300);
  for (let i = 0; i < 3; i++) { Sfx.pop(); await wait(560); }

  if (success) {
    Sfx.catchOk();
    await say(`やったー！ ${monName(foe)} を つかまえた！`, 1000);
    shake.remove();
    G.dex.caught.add(foe.species);
    if (G.party.length < 6) {
      foe.stages = { atk: 0, def: 0, spd: 0 };
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

/* ---------------- こうかん ---------------- */
async function doSwitch(forced) {
  const idx = await pickParty({
    title: forced ? 'つぎの パチモンを えらんでね！' : 'だれと こうかんする？',
    aliveOnly: true,
    cancelable: !forced,
  });
  if (idx == null) return false;
  if (idx > 0) {
    const m = G.party.splice(idx, 1)[0];
    G.party.unshift(m);
    m.stages = { atk: 0, def: 0, spd: 0 };
    const wrap = $('#player-wrap');
    wrap.classList.remove('faint');
    wrap.classList.add('entering');
    setTimeout(() => wrap.classList.remove('entering'), 600);
  }
  updateBattleUI();
  return true;
}

/* ---------------- ボタン ---------------- */
$('#battle-actions').addEventListener('click', async e => {
  const btn = e.target.closest('button');
  if (!btn || !B || B.busy || B.over) return;
  const act = btn.dataset.act;
  Sfx.click();
  if (act === 'move') showMoveMenu();
  else if (act === 'ball') showBallMenu();
  else if (act === 'back') showMainActions();
  else if (act === 'run') playerAction({ type: 'run' });
  else if (act === 'switch') playerAction({ type: 'switch' });
  else if (act === 'struggle') playerAction({ type: 'move', index: null });
  else if (act.startsWith('move:')) playerAction({ type: 'move', index: Number(act.split(':')[1]) });
  else if (act.startsWith('ball:')) playerAction({ type: 'ball', id: act.split(':')[1] });
});
