/* ============================================================
   パチモン — メインエンジン (マップ / UI / セーブ)
   ============================================================ */
'use strict';

/* ---------------- ユーティリティ ---------------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const wait = ms => new Promise(r => setTimeout(r, ms));
const ri = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function weightedPick(table) {
  const entries = Object.entries(table);
  const total = entries.reduce((s, e) => s + e[1], 0);
  let r = Math.random() * total;
  for (const [k, w] of entries) { r -= w; if (r <= 0) return k; }
  return entries[entries.length - 1][0];
}
function typeChips(types) {
  return types.map(t => `<span class="type-chip" style="background:${TYPES[t].color}">${TYPES[t].name}</span>`).join(' ');
}
function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/* ---------------- のうりょく / じょうたい ていぎ ---------------- */
const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const BATTLE_STAT_KEYS = ['atk', 'def', 'spa', 'spd', 'spe'];
const EV_MAX_PER_STAT = 252;
const EV_MAX_TOTAL = 510;
/* 本家は ev/4。パチモンでは 努力値の 影響を 1/3 に おさえる。 */
const EV_STAT_DIVISOR = 12;
const STAT_LABELS = {
  hp:'HP', atk:'こうげき', def:'ぼうぎょ', spa:'とくこう', spd:'とくぼう', spe:'すばやさ',
  acc:'めいちゅう', eva:'かいひ',
};
const STATUS_LABELS = { psn:'どく', tox:'もうどく', par:'まひ', slp:'ねむり', brn:'やけど', frz:'こおり' };
const SHINY_RATE = 1 / 512;

function zeroStages() { return { atk:0, def:0, spa:0, spd:0, spe:0, acc:0, eva:0 }; }
function zeroEV() { return Object.fromEntries(STAT_KEYS.map(k => [k, 0])); }
function randomIVs() { return Object.fromEntries(STAT_KEYS.map(k => [k, ri(0, 31)])); }
function randomNature() { return NATURE_KEYS[ri(0, NATURE_KEYS.length - 1)]; }
function rollHeldItem() { return weightedPick(HELD_ITEM_POOL); }
function clampEV(ev) {
  if (!ev) return zeroEV();
  let budget = EV_MAX_TOTAL;
  return Object.fromEntries(STAT_KEYS.map(k => {
    const v = clamp(Math.floor(Number(ev[k]) || 0), 0, Math.min(EV_MAX_PER_STAT, budget));
    budget -= v;
    return [k, v];
  }));
}
function addEV(mon, gains = {}) {
  if (!mon) return;
  const ev = mon.ev || (mon.ev = zeroEV());
  let total = STAT_KEYS.reduce((s, k) => s + (ev[k] || 0), 0);
  for (const [k, v] of Object.entries(gains)) {
    if (!STAT_KEYS.includes(k)) continue;
    const add = Math.min(Math.floor(Number(v) || 0), EV_MAX_PER_STAT - (ev[k] || 0), EV_MAX_TOTAL - total);
    if (add > 0) { ev[k] = (ev[k] || 0) + add; total += add; }
  }
}
function clampIV(iv) {
  const base = iv || {};
  return Object.fromEntries(STAT_KEYS.map(k => [k, clamp(Math.floor(Number(base[k]) || 0), 0, 31)]));
}

/* ---------------- 効果音 ---------------- */
const Sfx = {
  ctx: null,
  muted: (() => { try { return localStorage.getItem('pachimon_mute') === '1'; } catch (e) { return false; } })(),
  ensure() {
    if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false; this.ctx = new AC(); }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  },
  play(freq, dur = 0.09, type = 'square', vol = 0.05, slide = 0) {
    if (this.muted || !this.ensure()) return;
    try {
      const t0 = this.ctx.currentTime;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.linearRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0012, t0 + dur);
      o.connect(g).connect(this.ctx.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* みなし サイレント */ }
  },
  arp(notes, type = 'square', vol = .06) {
    let delay = 0;
    for (const [freq, dur, gap] of notes) {
      setTimeout(() => this.play(freq, dur, type, vol), delay);
      delay += gap;
    }
  },
  click() { this.play(700, .05, 'square', .04); },
  hit() { this.play(200, .13, 'sawtooth', .06, -90); },
  faint() { this.play(220, .45, 'triangle', .07, -160); },
  heal() { this.arp([[520, .1, 100], [760, .14, 0]], 'sine', .07); },
  throwball() { this.play(900, .08, 'square', .045, -300); },
  pop() { this.play(300, .09, 'square', .06, 240); },
  catchOk() { this.arp([[523, .09, 110], [659, .09, 110], [880, .2, 0]], 'square', .07); },
  levelup() { this.arp([[392, .08, 90], [523, .08, 90], [659, .08, 90], [784, .18, 0]], 'square', .06); },
  cry(species) {
    const idx = Math.max(0, DEX_ORDER.indexOf(species));
    const base = 220 + (idx % 7) * 48;
    const wave = ['square', 'sawtooth', 'triangle'][idx % 3];
    this.play(base, .16, wave, .065, 130);
    setTimeout(() => this.play(base * 1.35, .12, wave, .05, -90), 95);
    setTimeout(() => this.play(base * 0.8, .2, wave, .04, -70), 205);
  },
  lowhp() { this.play(880, .09, 'square', .045); setTimeout(() => this.play(620, .14, 'square', .045), 130); },
  toggle() { this.muted = !this.muted; try { localStorage.setItem('pachimon_mute', this.muted ? '1' : '0'); } catch (e) {} Music.refresh(); },
};

/* ---------------- BGM (チップチューン しきょく) ---------------- */
const NOTE_FREQ = (() => {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const table = {};
  for (let o = 1; o <= 7; o++) names.forEach((n, i) => {
    table[n + o] = 440 * Math.pow(2, (i - 9) / 12 + (o - 4));
  });
  return table;
})();

const Music = {
  /* おと: [おと, はくちょう(ビート)] … 0 は きゅうふく */
  themes: {
    title: {
      bpm: 126,
      tracks: [
        { wave: 'square', vol: .030, seq: [
          'E5',.5,'G5',.5,'A5',.5,'G5',.5,'E5',.5,'D5',.5,'C5',1,
          'D5',.5,'E5',.5,'F5',.5,'E5',.5,'D5',.5,'E5',.5,'C5',1,
          'E5',.5,'G5',.5,'A5',.5,'G5',.5,'E5',.5,'D5',.5,'C5',1,
          'G5',.5,'E5',.5,'D5',.5,'C5',.5,'D5',1,'C5',1,
        ] },
        { wave: 'triangle', vol: .048, seq: [
          'C3',1,'G3',1,'A2',1,'E3',1,
          'F2',1,'C3',1,'G2',1,'G3',1,
          'C3',1,'G3',1,'A2',1,'E3',1,
          'F2',1,'G2',1,'C3',1,'C3',1,
        ] },
      ],
    },
    world: {
      bpm: 96,
      tracks: [
        { wave: 'square', vol: .026, seq: [
          'F4',.75,'A4',.25,'C5',.5,'A4',.5,'G4',.75,'A4',.25,'F4',.5,0,.5,
          'E4',.5,'G4',.5,'A4',.5,'G4',.5,'F4',.5,'D4',.5,'C4',1,
          'F4',.75,'A4',.25,'C5',.5,'A4',.5,'G4',.75,'A4',.25,'C5',.5,0,.5,
          'D5',.5,'C5',.5,'A4',.5,'G4',.5,'F4',1,'C4',1,
        ] },
        { wave: 'triangle', vol: .044, seq: [
          'F2',2,'C3',2,'G2',2,'C3',2,
          'A2',2,'E3',2,'F2',2,'C3',2,
          'F2',2,'C3',2,'G2',2,'C3',2,
          'D3',2,'A2',2,'F2',2,'C3',2,
        ] },
      ],
    },
    battle: {
      bpm: 148,
      tracks: [
        { wave: 'square', vol: .030, seq: [
          'A4',.5,'A4',.5,'B4',.5,'C5',.5,'B4',.5,'A4',.5,'G4',.5,'E4',.5,
          'A4',.5,'C5',.5,'E5',.5,'D5',.5,'C5',.5,'B4',.5,'A4',1,
          'F4',.5,'F4',.5,'G4',.5,'A4',.5,'G4',.5,'F4',.5,'E4',.5,'D4',.5,
          'E4',.5,'G4',.5,'B4',.5,'A4',.5,'G4',.5,'E4',.5,'A4',1,
        ] },
        { wave: 'triangle', vol: .05, seq: [
          'A2',.5,'A3',.5,'A2',.5,'A3',.5,'F2',.5,'F3',.5,'F2',.5,'F3',.5,
          'G2',.5,'G3',.5,'G2',.5,'G3',.5,'E2',.5,'E3',.5,'E2',.5,'E3',.5,
        ] },
      ],
    },
    victory: {
      bpm: 132, once: true,
      tracks: [
        { wave: 'square', vol: .034, seq: [
          'C5',.33,'C5',.33,'C5',.33,'C5',.5,'A4',.5,'B4',.5,'C5',1,
          'B4',.33,'C5',.33,'D5',.33,'E5',.75,'C5',.25,'D5',.25,'E5',.5,'C5',.5,'G4',.5,'C5',1.5,
        ] },
        { wave: 'triangle', vol: .05, seq: [
          'C3',1,'F3',1,'G3',1,'C3',1,
          'G3',1,'C3',1,'F3',1,'C3',2,
        ] },
      ],
    },
    ending: {
      bpm: 84,
      tracks: [
        { wave: 'sine', vol: .05, seq: [
          'C4',.5,'E4',.5,'G4',.5,'C5',.5,'B4',.5,'G4',.5,'E4',.5,'G4',.5,
          'A3',.5,'C4',.5,'E4',.5,'A4',.5,'G4',.5,'E4',.5,'C4',.5,'E4',.5,
          'F3',.5,'A3',.5,'C4',.5,'F4',.5,'E4',.5,'C4',.5,'A3',.5,'C4',.5,
          'G3',.5,'B3',.5,'D4',.5,'G4',.5,'E4',.5,'D4',.5,'C4',1,
        ] },
        { wave: 'triangle', vol: .04, seq: [
          'C3',4,'A2',4,'F2',4,'G2',4,
        ] },
      ],
    },
  },
  cur: null, state: null, timer: null,

  play(name) {
    if (!this.themes[name]) return;
    if (this.cur === name) return;
    this.cur = name;
    this.state = {};
  },
  stop() { this.cur = null; this.state = null; },
  themeForScreen(screen) {
    return { title: 'title', intro: 'title', world: 'world', battle: 'battle' }[screen] || null;
  },
  refresh() {
    if (Sfx.muted) { this.stop(); return; }
    const t = this.themeForScreen(G.screen);
    if (t) this.play(t); else this.stop();
  },
  note(name, t0, dur, wave, vol) {
    const ctx = Sfx.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = wave;
    o.frequency.value = NOTE_FREQ[name] || 440;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    g.gain.setValueAtTime(vol, t0 + Math.max(0.015, dur - 0.07));
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g).connect(Sfx.ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },
  tick() {
    if (!this.cur || Sfx.muted) return;
    if (!Sfx.ensure()) return;
    const ctx = Sfx.ctx;
    if (ctx.state !== 'running') return;
    const th = this.themes[this.cur];
    const beat = 60 / th.bpm;
    const now = ctx.currentTime;
    let allDone = true;
    for (let ti = 0; ti < th.tracks.length; ti++) {
      const tr = th.tracks[ti];
      let st = this.state[ti];
      if (!st) st = this.state[ti] = { i: 0, next: now + 0.06, done: false };
      if (st.done) continue;
      allDone = false;
      if (st.next < now - 0.8) st.next = now + 0.06;      /* タブふっかつ時の さいきろく */
      while (st.next < now + 0.42) {
        const n = tr.seq[st.i], len = tr.seq[st.i + 1] * beat;
        if (n) this.note(n, st.next, len * 0.94, tr.wave, tr.vol);
        st.next += len;
        st.i += 2;
        if (st.i >= tr.seq.length) {
          if (th.once) { st.done = true; break; }
          st.i = 0;
        }
      }
    }
    if (th.once && allDone) this.cur = null;
  },
};
Music.timer = setInterval(() => Music.tick(), 110);

/* ---------------- ゲーム状態 ---------------- */
const SAVE_KEY = 'pachimon_save_v1';              /* きゅう 1スロット ばん（スロット1へ いどう） */
const SAVE_SLOT_COUNT = 3;
const SAVE_SLOT_PREFIX = 'pachimon_save_v1_slot';
const ACTIVE_SLOT_KEY = 'pachimon_active_slot';
/* この バージョンで いちどだけ セーブを けすための フラグ */
const SAVE_WIPE_KEY = 'pachimon_save_wipe_v2_ev_rebalance';
const slotKey = n => `${SAVE_SLOT_PREFIX}${n}`;
let activeSlot = 1;

const G = {
  started: false, screen: 'title', zone: 'field',
  party: [], box: [],
  items: defaultItems(),
  money: 300,
  dex: { seen: new Set(), caught: new Set() },
  flags: {}, starter: null, playTime: 0,
  badges: [], bikeOn: false,
  lastCenter: null,
};
let battleActive = false;

function defaultItems() {
  return { pachiball: 5, superball: 0, potion: 3, superpotion: 0, antidote: 1 };
}

/* ---------------- パチモン生成 ---------------- */
function statAt(base, level, isHp, iv = 31, ev = 0, nature = 'hardy', key = 'atk') {
  const core = Math.floor((base * 2 + iv + Math.floor(ev / EV_STAT_DIVISOR)) * level / 100);
  if (isHp) return Math.max(1, core + level + 10);
  return Math.max(1, Math.floor((core + 5) * natureMul(nature, key)));
}
function recalcStats(mon) {
  const b = SPECIES[mon.species].base;
  const iv = mon.iv || (mon.iv = clampIV(null));
  const ev = mon.ev || (mon.ev = zeroEV());
  const nature = mon.nature || 'hardy';
  mon.maxHp = statAt(b.hp, mon.level, true, iv.hp, ev.hp);
  for (const k of BATTLE_STAT_KEYS) {
    mon[k] = statAt(b[k], mon.level, false, iv[k], ev[k], nature, k);
  }
  mon.hp = clamp(mon.hp == null ? mon.maxHp : mon.hp, 0, mon.maxHp);
}
function defaultMoves(species, level) {
  const learn = SPECIES[species]?.learn?.filter(e => e?.[0] <= level).map(e => e?.[1]) || [];
  const uniq = [...new Set(learn)].slice(-4);
  return uniq.map(id => ({ id, pp: MOVES[id].pp }));
}
function makeMon(species, level, opts = {}) {
  const sp = SPECIES[species];
  const m = {
    species, level, exp: 0, hp: 1,
    moves: opts.moves || defaultMoves(species, level),
    status: null, sleepTurns: 0,
    nature: NATURES[opts.nature] ? opts.nature : randomNature(),
    ability: ABILITIES[opts.ability] ? opts.ability : sp.ability,
    iv: opts.iv ? clampIV(opts.iv) : randomIVs(),
    ev: opts.ev ? clampEV(opts.ev) : zeroEV(),
    heldItem: opts.heldItem !== undefined ? opts.heldItem : (Math.random() < 0.08 ? rollHeldItem() : null),
    shiny: opts.shiny !== undefined ? !!opts.shiny : Math.random() < SHINY_RATE,
    hasLed: !!opts.hasLed,
    stages: zeroStages(),
  };
  recalcStats(m);
  m.hp = m.maxHp;
  /* しんか レベルを こえた 状態で 手に いれた 個体は、
     つぎに レベルが あがった ときに しんか できるように する。 */
  if (sp.evolve && level >= sp.evolve.level) m.evoPending = true;
  return m;
}
function monName(m) { return SPECIES[m.species].name; }
function monData(m) {
  return {
    species: m.species, level: m.level, exp: m.exp, hp: m.hp,
    moves: m.moves.map(x => ({ id: x.id, pp: x.pp })),
    status: m.status || null, sleepTurns: m.sleepTurns || 0,
    nature: m.nature || 'hardy', ability: m.ability || null,
    iv: m.iv || null, ev: m.ev || null,
    heldItem: m.heldItem || null, shiny: !!m.shiny,
    hasLed: !!m.hasLed,
  };
}
function hydrateMon(d) {
  const m = makeMon(d.species, d.level, {
    nature: d.nature,
    ability: d.ability,
    iv: d.iv,
    ev: d.ev,
    heldItem: d.heldItem !== undefined ? d.heldItem : null,
    shiny: !!d.shiny,
    hasLed: !!d.hasLed,
  });
  m.exp = d.exp || 0;
  m.moves = (d.moves || []).filter(x => MOVES[x.id]).map(x => ({ id: x.id, pp: clamp(x.pp, 0, MOVES[x.id].pp) }));
  if (!m.moves.length) m.moves = defaultMoves(d.species, d.level);
  m.status = d.status || null;
  m.sleepTurns = d.sleepTurns || 0;
  m.hp = clamp(d.hp == null ? m.maxHp : d.hp, 0, m.maxHp);
  return m;
}
function activeMon() { return G.party[0]; }

/* ============================================================
   マップ
   ============================================================ */
const TILE = 36;
const MAP_SCALE = 1.5;
const MAP_W = 252, MAP_H = 216;
const T = {
  GRASS:0, TALL:1, TREE:2, WATER:3, PATH:4, ROCKY:5, FLOWER:6, BOULDER:7,
  WALL:8, DOOR:9, SAND:10, SIGN:11, LEDGE:12, GATE:13, SNOW:14, VOLCANIC:15,
};

const START_POS = { x:26, y:128 };
const RESPAWN_POS = { x:22, y:128 };

/* 10この ローブ (だえん) を みずで わけ、ほそい 陆桥で つなぐ。
   岛の ふちは ぎざぎざで、四角形には ならない。 */
const ISLAND = [
  { x:26,  y:120, rx:22, ry:16 },   // 南西: はじまりの町 / わかば草原
  { x:20,  y:80,  rx:20, ry:18 },   // 西: ざわめきの森
  { x:40,  y:34,  rx:20, ry:16 },   // 北西: ガレキ山脈
  { x:78,  y:122, rx:28, ry:14 },   // 南: なぎさ街道
  { x:128, y:122, rx:20, ry:18 },   // 南東: みなと町
  { x:70,  y:82,  rx:18, ry:16 },   // 中西部: こだまの深森
  { x:134, y:70,  rx:18, ry:20 },   // 東: かざんの いただき
  { x:98,  y:18,  rx:22, ry:16 },   // 北: かみなり台地
  { x:152, y:30,  rx:14, ry:18 },   // 北東: こおりの さかみち
  { x:102, y:50,  rx:12, ry:13 },   // 中央: チャンピオンロード
  /* けしき用の 半岛・いわば */
  { x:10,  y:132, rx:9,  ry:6 },
  { x:150, y:136, rx:9,  ry:5 },
  { x:12,  y:48,  rx:8,  ry:9 },
  { x:64,  y:6,   rx:9,  ry:5 },
];

/* ゾーン (HUD / エンカウント名) の めやす */
const REGIONS = [
  { zone:'town1',      x:26,  y:120, rx:9,  ry:7  },
  { zone:'field',      x:26,  y:120, rx:20, ry:15 },
  { zone:'forest',     x:20,  y:80,  rx:20, ry:18 },
  { zone:'rock',       x:40,  y:34,  rx:20, ry:16 },
  { zone:'coast',      x:78,  y:122, rx:28, ry:14 },
  { zone:'harbor',     x:128, y:122, rx:20, ry:18 },
  { zone:'deepforest', x:70,  y:82,  rx:18, ry:16 },
  { zone:'volcano',    x:134, y:70,  rx:18, ry:20 },
  { zone:'thunder',    x:98,  y:18,  rx:22, ry:16 },
  { zone:'ice',        x:152, y:30,  rx:14, ry:18 },
  { zone:'champion',   x:102, y:50,  rx:12, ry:13 },
];

/* ローブを つなぐ 陆桥 (みずの うえの 道) */
const BRIDGES = [
  { x:18,  y:97,  w:10, h:9  },   // 森 ↔ はじまりの町
  { x:26,  y:46,  w:13, h:21 },   // 山脈 ↔ 森
  { x:46,  y:118, w:6,  h:8  },   // 草原 ↔ なぎさ (ゲート1)
  { x:100, y:120, w:11, h:8  },   // なぎさ ↔ みなと
  { x:74,  y:96,  w:6,  h:15 },   // なぎさ ↔ 深森 (ゲート2)
  { x:86,  y:74,  w:35, h:6  },   // 深森 ↔ かざん (ゲート3)
  { x:116, y:20,  w:6,  h:43 },   // かざん ↔ かみなり (ゲート4)
  { x:118, y:24,  w:27, h:6  },   // かみなり ↔ こおり (ゲート5)
  { x:112, y:40,  w:33, h:5  },   // こおり ↔ チャンピオン (ゲート6)
];

/* バッジ ゲート (マップ さくせいじに ゾーンの さかいへ じどう せっちする) */
const GATES = [];
const gateGrid = new Map();

/* ゾーンごとの ひつよう バッジ。
   レベルの ひくい ゾーンから じゅんばんに すすめるように、
   たかい ゾーンは さかいの ゲートで ふさぐ。
   0 = バッジなし / 6 = チャンピオンロード */
const ZONE_REQ = {
  town1: 0, field: 0, river: 0, forest: 0, rock: 0,
  coast: 1, harbor: 1, desert: 1, mine: 1,
  deepforest: 2, spring: 2,
  volcano: 3, bamboo: 3,
  thunder: 4, waterfall: 4, canyon: 4, ruins: 4,
  ice: 5, snowfield: 5,
  champion: 6,
};
function zoneReq(zone) { return ZONE_REQ[zone] ?? 0; }

/* いっぽうつうこうの 段差 (南にだけ おりられる) */
const LEDGES = [
  { x:19, y:98,  w:5, h:1 },   // 森 → 草原 への ちかみち
  { x:27, y:50,  w:5, h:1 },   // 山脈 → 森 への ちかみち
];

const PATCHES = [
  /* わかば草原 */
  { zone:'field', x:10, y:112, w:6, h:4 }, { zone:'field', x:20, y:108, w:6, h:3 },
  { zone:'field', x:30, y:116, w:5, h:4 }, { zone:'field', x:38, y:128, w:6, h:3 },
  { zone:'field', x:7,  y:126, w:5, h:4 }, { zone:'field', x:34, y:108, w:5, h:3 },
  /* ざわめきの森 */
  { zone:'forest', x:8,  y:70, w:6, h:4 }, { zone:'forest', x:16, y:64, w:5, h:4 },
  { zone:'forest', x:26, y:68, w:6, h:3 }, { zone:'forest', x:30, y:78, w:5, h:4 },
  { zone:'forest', x:6,  y:86, w:6, h:4 }, { zone:'forest', x:18, y:88, w:5, h:4 },
  { zone:'forest', x:30, y:90, w:5, h:3 },
  /* ガレキ山脈 */
  { zone:'rock', x:26, y:24, w:6, h:4 }, { zone:'rock', x:34, y:18, w:5, h:4 },
  { zone:'rock', x:48, y:22, w:6, h:4 }, { zone:'rock', x:52, y:32, w:5, h:3 },
  { zone:'rock', x:24, y:38, w:6, h:4 }, { zone:'rock', x:36, y:42, w:5, h:3 },
  /* なぎさ街道 */
  { zone:'coast', x:56, y:114, w:6, h:4 }, { zone:'coast', x:66, y:120, w:6, h:3 },
  { zone:'coast', x:78, y:114, w:5, h:4 }, { zone:'coast', x:88, y:124, w:6, h:3 },
  { zone:'coast', x:96, y:114, w:5, h:3 }, { zone:'coast', x:60, y:128, w:6, h:3 },
  { zone:'coast', x:84, y:130, w:5, h:3 },
  /* みなと町 */
  { zone:'harbor', x:112, y:110, w:5, h:4 }, { zone:'harbor', x:120, y:116, w:5, h:3 },
  { zone:'harbor', x:132, y:110, w:5, h:3 }, { zone:'harbor', x:138, y:124, w:5, h:3 },
  { zone:'harbor', x:114, y:126, w:6, h:4 },
  /* こだまの深森 */
  { zone:'deepforest', x:57, y:73, w:6, h:4 }, { zone:'deepforest', x:62, y:80, w:5, h:4 },
  { zone:'deepforest', x:72, y:70, w:6, h:3 }, { zone:'deepforest', x:78, y:84, w:5, h:4 },
  { zone:'deepforest', x:60, y:90, w:6, h:3 }, { zone:'deepforest', x:78, y:92, w:5, h:3 },
  /* かざんの いただき */
  { zone:'volcano', x:120, y:60, w:5, h:4 }, { zone:'volcano', x:132, y:58, w:5, h:3 },
  { zone:'volcano', x:140, y:66, w:5, h:4 }, { zone:'volcano', x:126, y:78, w:6, h:3 },
  { zone:'volcano', x:140, y:82, w:5, h:3 },
  /* かみなり台地 */
  { zone:'thunder', x:84, y:12, w:6, h:3 }, { zone:'thunder', x:94, y:24, w:5, h:4 },
  { zone:'thunder', x:106, y:12, w:5, h:4 }, { zone:'thunder', x:110, y:24, w:5, h:3 },
  { zone:'thunder', x:82, y:24, w:5, h:3 },
  /* こおりの さかみち */
  { zone:'ice', x:142, y:18, w:5, h:3 }, { zone:'ice', x:148, y:26, w:4, h:3 },
  { zone:'ice', x:154, y:34, w:4, h:4 }, { zone:'ice', x:142, y:38, w:5, h:3 },
  /* チャンピオンロード */
  { zone:'champion', x:96, y:44, w:5, h:3 }, { zone:'champion', x:104, y:54, w:5, h:3 },
  { zone:'champion', x:97, y:57, w:4, h:3 }, { zone:'champion', x:106, y:44, w:4, h:3 },
];

/* みち の グラフ (2マス はば)。ローブの はしから はしまで ながく まわる */
const PATHS = [
  /* はじまりの町 → 森 → ガレキ山脈 (ジム1) */
  [[26,128],[26,122],[26,116],[24,112],[22,108],[20,104],[20,100],[18,96],[20,92],[22,88],[22,84],[24,80],[22,76],[20,72],[22,68],[24,64],[26,60],[28,56],[28,52],[30,48],[32,44],[34,40],[36,36],[38,32],[40,28],[44,28]],
  /* 町の なか */
  [[26,128],[20,126],[16,124],[16,120],[16,114],[16,110]],
  [[26,128],[32,126],[38,124],[38,110]],
  /* 草原 → なぎさ街道 (ゲート1) → みなと町 (ジム2) */
  [[26,128],[32,126],[38,124],[44,122],[46,122],[50,122],[56,122],[62,122],[68,122],[74,122],[80,124],[86,122],[92,124],[98,122],[102,124],[106,122],[110,122],[114,122],[120,122],[126,120],[130,118],[132,114],[132,112]],
  /* なぎさ → 深森 (ゲート2) → 深森ジム (ジム3) */
  [[74,122],[74,114],[74,108],[76,104],[76,100],[76,96],[74,92],[72,88],[70,84],[68,80],[68,76]],
  /* 深森 → かざん (ゲート3) → かざんジム (ジム4) */
  [[68,76],[72,80],[76,84],[80,86],[84,84],[88,82],[92,80],[96,78],[100,77],[104,77],[108,77],[112,77],[116,77],[120,77],[124,76],[128,74],[132,74],[136,72],[136,70]],
  /* かざん → かみなり (ゲート4) → かみなりジム (ジム5) */
  [[136,72],[136,66],[134,62],[130,60],[126,58],[122,56],[120,52],[120,48],[120,44],[118,40],[116,36],[114,32],[112,28],[108,24],[104,22],[100,20]],
  /* かみなり → こおり (ゲート5) → こおりジム (ジム6) */
  [[100,20],[106,20],[112,22],[116,24],[120,26],[124,26],[128,26],[132,26],[136,26],[140,26],[144,26],[148,24],[150,22]],
  /* こおり → チャンピオンゲート (ゲート6) → ライバル */
  [[150,22],[152,28],[150,34],[146,38],[142,42],[138,42],[134,42],[130,42],[126,42],[122,42],[118,42],[116,42],[114,42],[112,44],[108,48],[104,54],[102,58]],
  /* たてもの への いりぐち */
  [[26,116],[20,114],[16,110]],
  [[26,116],[32,114],[38,110]],
  [[74,92],[68,92],[62,93],[58,94]],
  [[120,122],[114,118],[114,114]],
  [[120,122],[134,118],[142,114]],
  [[120,77],[122,82],[122,86]],
  [[100,20],[92,22],[86,18]],
  [[150,22],[148,18],[144,16]],
  [[44,28],[44,26]],
  [[132,112],[132,110]],
  [[68,76],[68,74]],
  [[136,70],[136,66]],
  [[100,20],[98,20]],
  [[150,22],[152,22]],
  [[102,58],[102,60]],
];

const BUILDINGS = [
  { x:14,  y:108, w:5, h:3, type:'center', name:'パチモンセンター' },
  { x:36,  y:108, w:5, h:3, type:'shop',   name:'パチマート' },
  { x:22,  y:42,  w:5, h:3, type:'center', name:'やまの パチモンセンター' },
  { x:48,  y:42,  w:5, h:3, type:'shop',   name:'やまの パチマート' },
  { x:112, y:112, w:5, h:3, type:'center', name:'みなと パチモンセンター' },
  { x:140, y:112, w:5, h:3, type:'shop',   name:'みなと パチマート' },
  { x:56,  y:92,  w:5, h:3, type:'center', name:'もりの パチモンセンター' },
  { x:120, y:84,  w:5, h:3, type:'center', name:'かざんの パチモンセンター' },
  { x:84,  y:16,  w:5, h:3, type:'center', name:'かみなりの パチモンセンター' },
  { x:142, y:14,  w:5, h:3, type:'center', name:'こおりの パチモンセンター' },
  { x:42,  y:24,  w:5, h:3, type:'gym', gymId:'rock',    name:'いわのジム' },
  { x:130, y:108, w:5, h:3, type:'gym', gymId:'cascade', name:'しずくのジム' },
  { x:66,  y:72,  w:5, h:3, type:'gym', gymId:'forest',  name:'しんりょくのジム' },
  { x:134, y:64,  w:5, h:3, type:'gym', gymId:'blaze',   name:'ほのおのジム' },
  { x:96,  y:16,  w:5, h:3, type:'gym', gymId:'thunder', name:'いなずまのジム' },
  { x:150, y:18,  w:5, h:3, type:'gym', gymId:'frost',   name:'こおりのジム' },
];

const NPCS = [
  { id:'prof', x:30, y:126, name:'ハカセ', colors:{ cap:'#8f8f9e', jacket:'#5f5f7e', pack:'#e8e8f0', skin:'#ffe0c2', hair:'#c8c8d4' } },
  { id:'kid', x:22, y:124, name:'ぼうや', colors:{ cap:'#4cc9f0', jacket:'#7cc9ee', pack:'#fff', skin:'#ffd9b8', hair:'#5a4632' } },
  { id:'guide1', x:18, y:122, name:'みちあんない', guide:true, colors:{ cap:'#ffd23e', jacket:'#4a559e', pack:'#fff', skin:'#ffe0c2', hair:'#3a2c1c' } },
  { id:'bugcatcher', x:24, y:86, name:'ムシトリスト', trainer:'bugcatcher', colors:{ cap:'#8bd46b', jacket:'#5f9e4a', pack:'#c8e8b0', skin:'#ffe0c2', hair:'#3a2c1c' } },
  { id:'lass', x:14, y:102, name:'タンバリン', trainer:'lass', colors:{ cap:'#f0a3c8', jacket:'#e88bb0', pack:'#fff', skin:'#ffe0c2', hair:'#8a5a2c' } },
  { id:'shorts', x:30, y:96, name:'ショート', trainer:'shorts', colors:{ cap:'#6ee37a', jacket:'#3f9e5a', pack:'#fff0a8', skin:'#ffd9b8', hair:'#2c2c34' } },
  { id:'camper', x:16, y:66, name:'キャンプボーイ', trainer:'camper', colors:{ cap:'#e8a04f', jacket:'#a56a2c', pack:'#c8e8b0', skin:'#ffe0c2', hair:'#3a2c1c' } },
  { id:'ranger', x:30, y:52, name:'レンジャー', trainer:'ranger', colors:{ cap:'#4f9e55', jacket:'#3f7a44', pack:'#c8e8b0', skin:'#e8c8a0', hair:'#3a2c1c' } },
  { id:'hiker', x:36, y:40, name:'ヤマオトコ', trainer:'hiker', colors:{ cap:'#c9a24a', jacket:'#8a6a2c', pack:'#d8c8a0', skin:'#e8c8a0', hair:'#3a2c1c' } },
  { id:'mountaineer', x:46, y:34, name:'マウンテン', trainer:'mountaineer', colors:{ cap:'#9a8f78', jacket:'#6f6652', pack:'#c4b99f', skin:'#e8c8a0', hair:'#2c2c34' } },
  { id:'guide2', x:32, y:46, name:'みちあんない', guide:true, colors:{ cap:'#ffd23e', jacket:'#4a559e', pack:'#fff', skin:'#ffe0c2', hair:'#3a2c1c' } },
  { id:'guide3', x:54, y:118, name:'みちあんない', guide:true, colors:{ cap:'#ffd23e', jacket:'#4a559e', pack:'#fff', skin:'#ffe0c2', hair:'#3a2c1c' } },
  { id:'picnicker', x:64, y:118, name:'ピクニックガール', trainer:'picnicker', colors:{ cap:'#f2b04f', jacket:'#d88a2c', pack:'#fff0a8', skin:'#ffd9b8', hair:'#6a4a2c' } },
  { id:'swimmer', x:92, y:128, name:'スイマー', trainer:'swimmer', colors:{ cap:'#4aa3df', jacket:'#2f6f9e', pack:'#d8e8f0', skin:'#ffd9b8', hair:'#2c2c34' } },
  { id:'sailor', x:116, y:124, name:'ふなのり', trainer:'sailor', colors:{ cap:'#3f6fa5', jacket:'#2f4f7e', pack:'#d8e8f0', skin:'#ffd9b8', hair:'#2c2c34' } },
  { id:'fisher', x:126, y:116, name:'ウキビト', trainer:'fisher', colors:{ cap:'#7fb8e8', jacket:'#4a7fa5', pack:'#d8e8f0', skin:'#ffd9b8', hair:'#2c2c34' } },
  { id:'guide4', x:120, y:120, name:'みちあんない', guide:true, colors:{ cap:'#ffd23e', jacket:'#4a559e', pack:'#fff', skin:'#ffe0c2', hair:'#3a2c1c' } },
  { id:'guide5', x:74, y:98, name:'みちあんない', guide:true, colors:{ cap:'#ffd23e', jacket:'#4a559e', pack:'#fff', skin:'#ffe0c2', hair:'#3a2c1c' } },
  { id:'ninja', x:66, y:84, name:'シノビ', trainer:'ninja', colors:{ cap:'#5a4f8a', jacket:'#3a2f66', pack:'#1f1a33', skin:'#e8c8a0', hair:'#1f1a33' } },
  { id:'scientist', x:78, y:74, name:'けんきゅういん', trainer:'scientist', colors:{ cap:'#9b8cd6', jacket:'#6b5ea8', pack:'#e8e8f0', skin:'#ffe0c2', hair:'#2c2c34' } },
  { id:'guide6', x:100, y:78, name:'みちあんない', guide:true, colors:{ cap:'#ffd23e', jacket:'#4a559e', pack:'#fff', skin:'#ffe0c2', hair:'#3a2c1c' } },
  { id:'firebreather', x:128, y:72, name:'ファイアブリーザー', trainer:'firebreather', colors:{ cap:'#e0662a', jacket:'#a83a1a', pack:'#ffd27a', skin:'#e8c8a0', hair:'#2c2c34' } },
  { id:'athlete', x:120, y:54, name:'アスリート', trainer:'athlete', colors:{ cap:'#e8c12c', jacket:'#b09a2c', pack:'#fff0a8', skin:'#ffd9b8', hair:'#2c2c34' } },
  { id:'guide7', x:110, y:70, name:'みちあんない', guide:true, colors:{ cap:'#ffd23e', jacket:'#4a559e', pack:'#fff', skin:'#ffe0c2', hair:'#3a2c1c' } },
  { id:'guitarist', x:110, y:24, name:'ギタリスト', trainer:'guitarist', colors:{ cap:'#e8845c', jacket:'#a83a1a', pack:'#2c2c34', skin:'#e8c8a0', hair:'#2c2c34' } },
  { id:'veteran', x:90, y:28, name:'ベテラン', trainer:'veteran', colors:{ cap:'#b09a4f', jacket:'#7d6a38', pack:'#d8c8a0', skin:'#e8c8a0', hair:'#6a6a72' } },
  { id:'guide8', x:84, y:10, name:'みちあんない', guide:true, colors:{ cap:'#ffd23e', jacket:'#4a559e', pack:'#fff', skin:'#ffe0c2', hair:'#3a2c1c' } },
  { id:'skier', x:146, y:30, name:'スキーヤー', trainer:'skier', colors:{ cap:'#7fd4d0', jacket:'#4a9a9a', pack:'#e8faff', skin:'#ffe0c2', hair:'#3a2c1c' } },
  { id:'dragonrider', x:144, y:38, name:'ドラゴンつかい', trainer:'dragonrider', colors:{ cap:'#6b4fd8', jacket:'#4a35a5', pack:'#c9b2ea', skin:'#ffe0c2', hair:'#2c2c34' } },
  { id:'guide9', x:142, y:38, name:'みちあんない', guide:true, colors:{ cap:'#ffd23e', jacket:'#4a559e', pack:'#fff', skin:'#ffe0c2', hair:'#3a2c1c' } },
  { id:'guide10', x:112, y:46, name:'みちあんない', guide:true, colors:{ cap:'#ffd23e', jacket:'#4a559e', pack:'#fff', skin:'#ffe0c2', hair:'#3a2c1c' } },
  { id:'rival', x:102, y:60, name:'パチロー', trainer:'rival', requiresBadges:6, colors:{ cap:'#e8523c', jacket:'#c8482a', pack:'#ffd23e', skin:'#ffe0c2', hair:'#3a2c1c' } },
];

/* かんばん (ほうこうキー + しらべる で よむ) */
const SIGNS = [
  { x:26, y:120, text:'パチもん とう ちゅうおうひろば\n↑ ざわめきの森 / → なぎさ街道' },
  { x:18, y:100, text:'↑ ざわめきの森\n→ なぎさ街道 (バッジ1こ)' },
  { x:32, y:50, text:'↑ ガレキ山脈 / いわのジム\n↓ ざわめきの森' },
  { x:54, y:120, text:'→ なぎさ街道 / みなと町\n← はじまりの町' },
  { x:126, y:120, text:'みなと町\n→ しずくのジム\n↑ 深森ゲート (バッジ2こ)' },
  { x:74, y:106, text:'↑ こだまの深森\nバッジ 2こ ひつよう' },
  { x:110, y:76, text:'→ かざんの いただき\nバッジ 3こ ひつよう' },
  { x:118, y:46, text:'↑ かみなり台地\nバッジ 4こ ひつよう' },
  { x:140, y:26, text:'→ こおりの さかみち\nバッジ 5こ ひつよう' },
  { x:124, y:42, text:'← チャンピオンロード\nバッジ 6こ ひつよう' },
];

/* かくしアイテム (ほうこうキー + しらべる で みつかる) */
const HIDDEN_ITEMS = [
  { x:12,  y:118, item:'potion' },
  { x:30,  y:70,  item:'pachiball' },
  { x:6,   y:88,  item:'antidote' },
  { x:52,  y:30,  item:'superball' },
  { x:44,  y:20,  item:'superpotion' },
  { x:58,  y:124, item:'revive' },
  { x:94,  y:130, item:'hyperpotion' },
  { x:140, y:126, item:'superball' },
  { x:58,  y:88,  item:'expall' },
  { x:124, y:62,  item:'fullrestore' },
  { x:148, y:40,  item:'maxrevive' },
  { x:100, y:50,  item:'hyperball' },
];

/* ============================================================
   マップの かくだい (1.5ばい) と あたらしい 9ゾーン
   これまでの ざひょうを まとめて 1.5ばいに してから、
   ジムの あいだに 地つづきの ゾーンを つけくわえる。
   ============================================================ */
const scaleCoord = v => Math.round(v * MAP_SCALE);
const scaleLen = v => Math.max(1, Math.round(v * MAP_SCALE));
const scalePoint = p => [scaleCoord(p[0]), scaleCoord(p[1])];

function scaleWorldData() {
  for (const r of ISLAND) {
    r.x = scaleCoord(r.x); r.y = scaleCoord(r.y);
    r.rx = scaleCoord(r.rx); r.ry = scaleCoord(r.ry);
  }
  for (const r of REGIONS) {
    r.x = scaleCoord(r.x); r.y = scaleCoord(r.y);
    r.rx = scaleCoord(r.rx); r.ry = scaleCoord(r.ry);
  }
  for (const b of BRIDGES) {
    b.x = scaleCoord(b.x); b.y = scaleCoord(b.y);
    b.w = scaleLen(b.w); b.h = scaleLen(b.h);
  }
  for (const g of GATES) {
    g.x = scaleCoord(g.x); g.y = scaleCoord(g.y);
    g.w = scaleLen(g.w); g.h = scaleLen(g.h);
  }
  for (const l of LEDGES) {
    l.x = scaleCoord(l.x); l.y = scaleCoord(l.y);
    l.w = scaleLen(l.w); l.h = scaleLen(l.h);
  }
  for (const p of PATCHES) {
    p.x = scaleCoord(p.x); p.y = scaleCoord(p.y);
    p.w = scaleLen(p.w); p.h = scaleLen(p.h);
  }
  for (const path of PATHS) for (let i = 0; i < path.length; i++) path[i] = scalePoint(path[i]);
  /* たてものは おおきさを そのままに して、いりぐちを みちに あわせる */
  for (const b of BUILDINGS) { b.x = scaleCoord(b.x); b.y = scaleCoord(b.y); }
  for (const n of NPCS) { n.x = scaleCoord(n.x); n.y = scaleCoord(n.y); }
  for (const s of SIGNS) { s.x = scaleCoord(s.x); s.y = scaleCoord(s.y); }
  for (const h of HIDDEN_ITEMS) { h.x = scaleCoord(h.x); h.y = scaleCoord(h.y); }
  START_POS.x = scaleCoord(START_POS.x); START_POS.y = scaleCoord(START_POS.y);
  RESPAWN_POS.x = scaleCoord(RESPAWN_POS.x); RESPAWN_POS.y = scaleCoord(RESPAWN_POS.y);
}
scaleWorldData();

/* あたらしい ゾーン (すべて 既存の しまと かさなって 地つづき) */
const NEW_ZONE_DEFS = [
  { zone:'river',     cx:18,  cy:150, rx:19, ry:15,
    patches:[[9,142,6,4],[16,146,5,4],[25,152,5,3]],
    paths:[[[33,132],[24,140],[18,150],[14,156]]] },
  { zone:'desert',    cx:82,  cy:168, rx:24, ry:20,
    patches:[[70,156,6,4],[80,154,5,4],[88,162,6,4],[74,172,5,4]],
    paths:[[[84,183],[82,174],[82,168]]] },
  { zone:'mine',      cx:82,  cy:88,  rx:24, ry:24,
    patches:[[72,78,5,4],[84,74,5,4],[90,86,5,4],[76,94,5,4]],
    paths:[[[60,72],[70,80],[82,88],[92,98]]] },
  { zone:'spring',    cx:150, cy:150, rx:24, ry:18,
    patches:[[138,142,5,4],[154,144,5,4],[144,156,5,4],[158,158,5,3]],
    paths:[[[150,180],[150,168],[150,158],[150,150]],[[132,144],[140,148],[150,150]]] },
  { zone:'bamboo',    cx:180, cy:126, rx:22, ry:18,
    patches:[[170,118,5,4],[184,116,5,4],[176,130,5,4],[188,132,4,4]],
    paths:[[[190,120],[184,124],[180,126],[176,132]]] },
  { zone:'waterfall', cx:156, cy:102, rx:20, ry:16,
    patches:[[146,94,5,4],[160,96,5,4],[150,108,5,4],[164,108,4,3]],
    paths:[[[153,87],[156,96],[156,102],[160,108]]] },
  { zone:'canyon',    cx:156, cy:54,  rx:21, ry:16,
    patches:[[146,44,5,4],[160,44,5,4],[150,56,5,4],[164,58,4,3]],
    paths:[[[156,42],[156,48],[156,54],[160,60]]] },
  { zone:'snowfield', cx:204, cy:60,  rx:19, ry:17,
    patches:[[194,50,5,4],[208,48,5,4],[198,64,5,4],[210,60,4,4]],
    paths:[[[219,57],[210,60],[204,60],[198,66]]] },
  { zone:'ruins',     cx:186, cy:84,  rx:19, ry:15,
    patches:[[176,76,5,4],[190,74,5,3],[180,88,5,4],[191,87,4,3]],
    paths:[[[201,105],[192,96],[186,84],[180,90]]] },
];

for (const z of NEW_ZONE_DEFS) {
  ISLAND.push({ x:z.cx, y:z.cy, rx:z.rx, ry:z.ry });
  REGIONS.push({ zone:z.zone, x:z.cx, y:z.cy, rx:z.rx, ry:z.ry });
  for (const [x, y, w, h] of z.patches) PATCHES.push({ zone:z.zone, x, y, w, h });
  for (const p of z.paths) PATHS.push(p);
}

/* あたらしい ゾーンの パチモンセンター */
BUILDINGS.push(
  { x:140, y:152, w:5, h:3, type:'center', name:'いずみの パチモンセンター' },
  { x:178, y:92,  w:5, h:3, type:'center', name:'こだいの パチモンセンター' },
);
PATHS.push([[150,158],[146,156],[142,155]]);
PATHS.push([[180,90],[180,95]]);

/* ジムが あるのに パチマートが なかった ゾーンへ、1つずつ おく */
BUILDINGS.push(
  { x:100, y:138, w:5, h:3, type:'shop', name:'もりの パチマート' },
  { x:196, y:100, w:5, h:3, type:'shop', name:'かざんの パチマート' },
  { x:134, y:24,  w:5, h:3, type:'shop', name:'かみなりの パチマート' },
  { x:219, y:21,  w:5, h:3, type:'shop', name:'こおりの パチマート' },
);
/* センターと マートを むすぶ みじかい みち */
PATHS.push([[102,141],[94,141],[86,141]]);
PATHS.push([[198,103],[202,104],[204,105]]);
PATHS.push([[128,27],[132,27],[136,27]]);
PATHS.push([[215,24],[217,24],[221,24]]);
/* いずみの 湿地 → ささやぶの 小径 (バッジ3こで ひらく みち) */
PATHS.push([[150,150],[158,144],[165,140],[170,136],[176,132]]);

/* あたらしい ゾーンの かくしアイテム と かんばん */
HIDDEN_ITEMS.push(
  { x:12,  y:158, item:'potion' },
  { x:96,  y:170, item:'superball' },
  { x:94,  y:90,  item:'hyperpotion' },
  { x:196, y:78,  item:'maxrevive' },
);
SIGNS.push(
  { x:39,  y:147, text:'↑ ざわめきの森 / ↓ はじまりの町\n→ かわべの こみち' },
  { x:88,  y:176, text:'きた: すなの おか\nひがし: なぎさ街道 / みなと町' },
  { x:154, y:162, text:'いずみの 湿地\nセンターは にしがわ' },
  { x:186, y:96,  text:'こだいの いせき\nおくに つよい パチモンが すむ' },
);

/* いけ・みずうみ (1.5ばい ごの ざひょう) */
const LAKES = [
  { x:15,  y:174, rx:6.3, ry:4.5 },
  { x:15,  y:111, rx:7.5, ry:6.0 },
  { x:81,  y:39,  rx:4.5, ry:3.0 },
  { x:93,  y:135, rx:6.0, ry:4.2 },
  { x:204, y:123, rx:4.5, ry:3.0 },
  { x:147, y:15,  rx:6.0, ry:3.0 },
  { x:225, y:54,  rx:4.5, ry:3.9 },
  { x:102, y:195, rx:4.5, ry:3.0 },
  { x:138, y:198, rx:4.5, ry:2.7 },
  { x:14,  y:154, rx:4.5, ry:3.0 },
  { x:156, y:150, rx:4.0, ry:2.5 },
  { x:160, y:104, rx:3.5, ry:2.5 },
];

let map = [];
const CHUNK = 24;
const terrainChunks = new Map();
let gateNoticeAt = 0;

function inBounds(x, y) { return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H; }

function gateAt(x, y) {
  return gateGrid.get(x + ',' + y) || null;
}
function gateOpen(g) { return !g || G.badges.length >= g.badges; }
function gateMessage(g) {
  return `${g.name}: バッジが ${g.badges}こ ひつようだ。いまは ${G.badges.length}こ。`;
}

function islandAt(x, y) {
  for (const r of ISLAND) {
    const dx = (x - r.x) / r.rx, dy = (y - r.y) / r.ry;
    const wobble = (hash(x * 3 + 11, y * 5 + 7) - 0.5) * 0.16;
    if (dx * dx + dy * dy <= 1 + wobble) return true;
  }
  return false;
}

function regionZoneAt(x, y) {
  let best = null, bestD = Infinity;
  for (const r of REGIONS) {
    const dx = (x - r.x) / r.rx, dy = (y - r.y) / r.ry;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = r; }
  }
  return best ? best.zone : 'field';
}

/* ゾーンの さかいに バッジ ゲート / てきごうする じめんを おく。
   - たかい レベルの ゾーンへは、みちの さかい目に ゲートを つくる。
   - ゲートの ない さかい (くさむら・そうげん) は 木や いわで ふさぐ。
   - これで どの みちからでも、ひつよう バッジが たりないと はいれない。 */
function isBarrierGround(t) {
  return t === T.GRASS || t === T.TALL || t === T.PATH || t === T.FLOWER
    || t === T.ROCKY || t === T.SAND || t === T.SNOW || t === T.VOLCANIC
    || t === T.LEDGE || t === T.GATE;
}
function barrierTerrainAt(x, y) {
  const z = regionZoneAt(x, y);
  if (z === 'desert' || z === 'rock' || z === 'champion' || z === 'thunder'
    || z === 'mine' || z === 'canyon' || z === 'ruins' || z === 'volcano') return T.BOULDER;
  return T.TREE;
}
function applyZoneBarriers(rebuild = true) {
  if (rebuild) {
    GATES.length = 0;
    gateGrid.clear();
  }
  const spots = [];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = map[y][x];
    if (!isBarrierGround(t) || t === T.GATE) continue;
    const z = regionZoneAt(x, y);
    const need = zoneReq(z);
    if (!need) continue;
    /* たてもの・かんばん・NPC の まわりは こわさない */
    if (t === T.WALL || t === T.DOOR || t === T.SIGN) continue;
    if (NPCS.some(n => n.x === x && n.y === y)) continue;
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (!inBounds(nx, ny)) continue;
      const nt = map[ny][nx];
      if (!isBarrierGround(nt)) continue;
      if (zoneReq(regionZoneAt(nx, ny)) >= need) continue;
      spots.push([x, y, z, need, t === T.PATH]);
      break;
    }
  }
  for (const [x, y, z, need, onPath] of spots) {
    if (onPath) {
      const g = {
        id: 'zone-' + z + '-' + x + '-' + y,
        x, y, w: 1, h: 1, badges: need, zone: z,
        name: ((ENCOUNTERS[z] && ENCOUNTERS[z].name) || z) + 'ゲート',
      };
      map[y][x] = T.GATE;
      gateGrid.set(x + ',' + y, g);
      GATES.push(g);
    } else {
      const bt = barrierTerrainAt(x, y);
      map[y][x] = bt;
    }
  }
}

/* かくしアイテムが さかいの いわ・きに うまって しまったら、おなじ ゾーンの
   あるける ばしょへ うつす (バッジを そろえれば とれる ように)。 */
function relocateHiddenItems() {
  const taken = new Set(HIDDEN_ITEMS.map(h => h.x + ',' + h.y));
  for (const h of HIDDEN_ITEMS) {
    const t = map[h.y] && map[h.y][h.x];
    if (t !== T.WALL && t !== T.DOOR && t !== T.TREE && t !== T.BOULDER && t !== T.WATER) continue;
    const z = regionZoneAt(h.x, h.y);
    let best = null;
    for (let r = 1; r <= 12 && !best; r++) {
      for (let dy = -r; dy <= r && !best; dy++) for (let dx = -r; dx <= r && !best; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = h.x + dx, ny = h.y + dy;
        if (!inBounds(nx, ny) || regionZoneAt(nx, ny) !== z) continue;
        const k = nx + ',' + ny;
        if (taken.has(k)) continue;
        if (!walkable(nx, ny)) continue;
        if (NPCS.some(n => n.x === nx && n.y === ny)) continue;
        if (SIGNS.some(s => s.x === nx && s.y === ny)) continue;
        if (BUILDINGS.some(b => nx >= b.x && nx < b.x + b.w && ny >= b.y && ny < b.y + b.h)) continue;
        best = [nx, ny];
      }
    }
    if (best) {
      taken.delete(h.x + ',' + h.y);
      h.x = best[0]; h.y = best[1];
      taken.add(h.x + ',' + h.y);
    }
  }
}

function carvePath(points, width = 2) {
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i], [x1, y1] = points[i + 1];
    const steps = Math.max(1, Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(x0 + (x1 - x0) * s / steps);
      const y = Math.round(y0 + (y1 - y0) * s / steps);
      for (let oy = 0; oy < width; oy++) for (let ox = 0; ox < width; ox++) {
        const tx = x + ox, ty = y + oy;
        if (inBounds(tx, ty)) map[ty][tx] = T.PATH;
      }
    }
  }
}

function buildMap() {
  map = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(T.WATER));

  /* 1. しまの かたち (ゾーンごとに じめんの いろを かえる) */
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (!islandAt(x, y)) { map[y][x] = T.WATER; continue; }
    const z = regionZoneAt(x, y);
    if (z === 'desert') map[y][x] = T.SAND;
    else if (z === 'rock' || z === 'champion' || z === 'thunder' || z === 'mine' || z === 'canyon' || z === 'ruins') map[y][x] = T.ROCKY;
    else if (z === 'volcano') map[y][x] = T.VOLCANIC;
    else if (z === 'ice' || z === 'snowfield') map[y][x] = T.SNOW;
    else map[y][x] = T.GRASS;
  }

  /* 2. ローブを むすぶ 陆桥 */
  for (const br of BRIDGES) {
    for (let y = br.y; y < br.y + br.h; y++) for (let x = br.x; x < br.x + br.w; x++) {
      if (inBounds(x, y)) map[y][x] = T.PATH;
    }
  }

  /* 3. みずうみ・いけ */
  const lake = (cx, cy, rx, ry) => {
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) map[y][x] = T.WATER;
    }
  };
  for (const l of LAKES) lake(l.x, l.y, l.rx, l.ry);

  /* 4. はまべ (みちの うえは かわさない) */
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = map[y][x];
    if (t === T.WATER || t === T.PATH || t === T.WALL || t === T.DOOR || t === T.GATE) continue;
    const nearWater = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return inBounds(nx, ny) && map[ny][nx] === T.WATER;
    });
    if (nearWater) map[y][x] = T.SAND;
  }

  /* 5. 草むら */
  for (const p of PATCHES)
    for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++)
      if (inBounds(x, y) && map[y][x] !== T.WATER) map[y][x] = T.TALL;

  /* 6. みち */
  for (const path of PATHS) carvePath(path, 2);

  /* 7. たてもの */
  for (const b of BUILDINGS) {
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++)
      if (inBounds(x, y)) map[y][x] = T.WALL;
    b.doorX = b.x + Math.floor(b.w / 2); b.doorY = b.y + b.h - 1;
    if (inBounds(b.doorX, b.doorY)) map[b.doorY][b.doorX] = T.DOOR;
    for (let x = b.x - 1; x <= b.x + b.w; x++) {
      const y = b.doorY + 1;
      if (inBounds(x, y) && map[y][x] !== T.WALL && map[y][x] !== T.DOOR) map[y][x] = T.PATH;
    }
  }

  /* 8. バッジ ゲート (ゾーンの さかいを ふさぐ) */
  applyZoneBarriers();

  /* 9. いっぽうつうこうの 段差 */
  for (const l of LEDGES) {
    for (let y = l.y; y < l.y + l.h; y++) for (let x = l.x; x < l.x + l.w; x++)
      if (inBounds(x, y) && map[y][x] !== T.WATER && map[y][x] !== T.GATE) map[y][x] = T.LEDGE;
  }

  /* 10. かざり (き・いわ・はな) */
  const protectedTiles = new Set();
  const protect = (x, y, r = 1) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy;
      if (inBounds(nx, ny)) protectedTiles.add(nx + ',' + ny);
    }
  };
  for (const b of BUILDINGS) protect(b.doorX, b.doorY, 2);
  for (const n of NPCS) protect(n.x, n.y, 1);
  for (const s of SIGNS) protect(s.x, s.y, 1);
  for (const h of HIDDEN_ITEMS) protect(h.x, h.y, 0);
  for (const g of GATES) { protect(g.x, g.y, 3); protect(g.x + g.w - 1, g.y + g.h - 1, 3); }
  protect(START_POS.x, START_POS.y, 1);
  protect(RESPAWN_POS.x, RESPAWN_POS.y, 1);

  for (let y = 2; y < MAP_H - 2; y++) for (let x = 2; x < MAP_W - 2; x++) {
    const t = map[y][x];
    if (t !== T.GRASS && t !== T.ROCKY && t !== T.SNOW && t !== T.VOLCANIC) continue;
    if (protectedTiles.has(x + ',' + y)) continue;
    const z = regionZoneAt(x, y);
    const h = hash(x * 3, y * 11);
    if (z === 'forest' || z === 'deepforest') {
      if (h < 0.22) map[y][x] = T.TREE;
      else if (h > 0.95) map[y][x] = T.FLOWER;
    } else if (z === 'rock' || z === 'champion') {
      if (h < 0.10) map[y][x] = T.BOULDER;
      else if (h > 0.96) map[y][x] = T.FLOWER;
    } else if (z === 'volcano') {
      if (h < 0.13) map[y][x] = T.BOULDER;
      else if (h > 0.97) map[y][x] = T.FLOWER;
    } else if (z === 'thunder') {
      if (h < 0.06) map[y][x] = T.BOULDER;
      else if (h < 0.10) map[y][x] = T.TREE;
    } else if (z === 'ice') {
      if (h < 0.07) map[y][x] = T.TREE;
      else if (h < 0.10) map[y][x] = T.BOULDER;
    } else if (z === 'river' || z === 'spring' || z === 'waterfall') {
      if (h < 0.13) map[y][x] = T.TREE;
      else if (h > 0.90) map[y][x] = T.FLOWER;
    } else if (z === 'bamboo') {
      if (h < 0.18) map[y][x] = T.TREE;
      else if (h > 0.94) map[y][x] = T.FLOWER;
    } else if (z === 'desert') {
      if (h < 0.05) map[y][x] = T.BOULDER;
    } else if (z === 'mine' || z === 'canyon' || z === 'ruins') {
      if (h < 0.10) map[y][x] = T.BOULDER;
      else if (h > 0.96) map[y][x] = T.FLOWER;
    } else if (z === 'snowfield') {
      if (h < 0.06) map[y][x] = T.TREE;
    } else {
      if (h < 0.04) map[y][x] = T.TREE;
      else if (h > 0.93) map[y][x] = T.FLOWER;
    }
  }

  /* 11. かんばん */
  for (const s of SIGNS) if (inBounds(s.x, s.y)) map[s.y][s.x] = T.SIGN;

  /* 12. NPC / かくしアイテム / スタート の まわりを かならず あるける ように */
  const clearTile = (x, y) => {
    if (!inBounds(x, y)) return;
    const t = map[y][x];
    if (t === T.WATER || t === T.TREE || t === T.BOULDER || t === T.WALL || t === T.SIGN) {
      const z = regionZoneAt(x, y);
      map[y][x] = z === 'desert' ? T.SAND
        : (z === 'rock' || z === 'champion' || z === 'thunder' || z === 'mine' || z === 'canyon' || z === 'ruins') ? T.ROCKY
        : z === 'volcano' ? T.VOLCANIC
        : (z === 'ice' || z === 'snowfield') ? T.SNOW : T.GRASS;
    }
  };
  for (const n of NPCS) { clearTile(n.x, n.y); clearTile(n.x, n.y + 1); clearTile(n.x, n.y - 1); }
  for (const h of HIDDEN_ITEMS) clearTile(h.x, h.y);
  clearTile(START_POS.x, START_POS.y);
  clearTile(RESPAWN_POS.x, RESPAWN_POS.y);
  for (const s of SIGNS) { clearTile(s.x, s.y); map[s.y][s.x] = T.SIGN; }

  /* 13. いちばん そとは うみ */
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (x < 1 || y < 1 || x >= MAP_W - 1 || y >= MAP_H - 1) map[y][x] = T.WATER;
  }

  /* 14. かくしアイテム・NPC の クリアで あいた さかいを もういちど ふさぐ */
  applyZoneBarriers(false);
  relocateHiddenItems();
}

function walkable(x, y) {
  if (!inBounds(x, y)) return false;
  const t = map[y][x];
  if (t === T.GATE) return gateOpen(gateAt(x, y));
  if (t === T.LEDGE) return true;
  return t === T.GRASS || t === T.TALL || t === T.PATH || t === T.ROCKY
    || t === T.FLOWER || t === T.SAND || t === T.SNOW || t === T.VOLCANIC;
}

function zoneAt(x, y) {
  for (const p of PATCHES) {
    if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) return p.zone;
  }
  return regionZoneAt(x, y);
}

/* ============================================================
   ゾーンごとの 景観テーマ
   おなじ タイル しゅるいでも、ゾーンで いろ・かたち・
   かざり・空気を ガラッと 変える。シルエットだけでも
   どの ゾーンか わかる ように、木・いわ・草の かたちも
   ゾーンごとに 描き分ける。
   ============================================================ */
const ZONE_THEMES = {
  town1: {
    ground:['#86cf76','#7cc46c'], detail:'#a6e291', groundMotif:'grass',
    path:['#e6d6b0','#dccca4'], pathMotif:'cobble', pathLine:'#c8b489',
    tall:['#5aa85c','#3f8547'], tallStyle:'blades',
    tree:'broadleaf', leaf:['#3a925c','#2f7d4f','#48a468'], trunk:'#6b4a2f',
    rock:'boulder', rockCol:['#9a958d','#bdb7ac'],
    flower:'daisy', flowerCol:['#ffffff','#ffd7e8','#ffd23e'],
    ledge:['#a8835c','#8a6a4a'], ledgeTop:'#7cc46c', gate:'#ffd23e',
    accent:'#ffd23e', ambient:'petals',
  },
  field: {
    ground:['#7cc86c','#72bd62'], detail:'#9adf88', groundMotif:'grass',
    path:['#d9c08e','#d0b785'], pathMotif:'dirt', pathLine:'#bfa676',
    tall:['#4f9e55','#3c7d43'], tallStyle:'blades',
    tree:'broadleaf', leaf:['#3a925c','#2f7d4f','#48a468'], trunk:'#6b4a2f',
    rock:'boulder', rockCol:['#8f8a80','#b9b3a8'],
    flower:'daisy', flowerCol:['#ffffff','#ffd7e8','#ffd23e'],
    ledge:['#a8835c','#8a6a4a'], ledgeTop:'#72bd62', gate:'#ffd23e',
    accent:'#8ed36f', ambient:'petals',
  },
  forest: {
    ground:['#4f8c50','#457f48'], detail:'#69a85e', groundMotif:'moss',
    path:['#7d6545','#735c3f'], pathMotif:'dirt', pathLine:'#5f4a32',
    tall:['#2f6b3a','#245a31'], tallStyle:'fern',
    tree:'broadleaf', leaf:['#246b43','#1d5a38','#2f7d4f'], trunk:'#4a3524',
    rock:'mossy', rockCol:['#6f7a62','#93a07f'],
    flower:'bluebell', flowerCol:['#7aa7ff','#a8c8ff','#ffd23e'],
    ledge:['#6b5236','#57412c'], ledgeTop:'#457f48', gate:'#ffd23e',
    accent:'#7ddb8a', ambient:'fireflies',
  },
  deepforest: {
    ground:['#346b45','#2c5f3d'], detail:'#548f5e', groundMotif:'moss',
    path:['#5c5a3e','#525036'], pathMotif:'moss', pathLine:'#45432f',
    tall:['#1f5234','#173f28'], tallStyle:'fern',
    tree:'giant', leaf:['#1d5a38','#16472c','#2b7045'], trunk:'#3a2a1e',
    rock:'mossy', rockCol:['#52604c','#708060'],
    flower:'glowshroom', flowerCol:['#b8ffe0','#6fe8c0','#ffffff'],
    ledge:['#3f4f36','#32402b'], ledgeTop:'#2c5f3d', gate:'#ffd23e',
    accent:'#6fffc0', ambient:'spores',
  },
  rock: {
    ground:['#9b958d','#8f8a80'], detail:'#b8b2a8', groundMotif:'stone',
    path:['#b8ae9c','#aa9f8d'], pathMotif:'gravel', pathLine:'#8f8574',
    tall:['#8a7a52','#75683f'], tallStyle:'dry',
    tree:'dead', leaf:['#7a8060','#5f6548','#9aa07a'], trunk:'#6b5a46',
    rock:'boulder', rockCol:['#8a857c','#b5afa4'],
    flower:'lichen', flowerCol:['#d8c84a','#a8c86a','#e8e0b0'],
    ledge:['#7a7062','#61594c'], ledgeTop:'#8f8a80', gate:'#ffd23e',
    accent:'#d8c88a', ambient:'dust',
  },
  coast: {
    ground:['#9fce82','#93c478'], detail:'#c8e8a0', groundMotif:'grass',
    path:['#ead9a8','#e2d09c'], pathMotif:'sand', pathLine:'#cdb77e',
    tall:['#7fb85a','#6aa84a'], tallStyle:'blades',
    tree:'palm', leaf:['#3f9e5a','#2f7d4f','#5fbf6a'], trunk:'#a87a4a',
    rock:'searock', rockCol:['#8a9a92','#b0bdb4'],
    flower:'shell', flowerCol:['#ffd7e8','#fff0a8','#ff9f7a'],
    ledge:['#c9b07a','#ae9662'], ledgeTop:'#93c478', gate:'#ffd23e',
    accent:'#7fe0ff', ambient:'seabreeze',
  },
  harbor: {
    ground:['#a7b2b6','#9da8ac'], detail:'#c0c8ca', groundMotif:'cobble',
    path:['#b98b5a','#ab7d4d'], pathMotif:'plank', pathLine:'#8a6238',
    tall:['#8aa05a','#6f8548'], tallStyle:'blades',
    tree:'palm', leaf:['#4f9e64','#3a8550','#6ebf7a'], trunk:'#a87a4a',
    rock:'crate', rockCol:['#b98b5a','#d8b07a'],
    flower:'buoy', flowerCol:['#ff5c5c','#ffd23e','#ffffff'],
    ledge:['#7d8a90','#65727a'], ledgeTop:'#9da8ac', gate:'#ffd23e',
    accent:'#7fd8ff', ambient:'seabreeze',
  },
  volcano: {
    ground:['#56423f','#4b3936'], detail:'#ff7a3c', groundMotif:'lava',
    path:['#6b4a3e','#5f4136'], pathMotif:'ash', pathLine:'#3f2c26',
    tall:['#3a2c2a','#2c211f'], tallStyle:'charred',
    tree:'obsidian', leaf:['#2a2230','#3a2c40','#ff7a3c'], trunk:'#241c24',
    rock:'obsidian', rockCol:['#3a3038','#5a4650'],
    flower:'lavavent', flowerCol:['#ffd23e','#ff7a3c','#fff2b0'],
    ledge:['#4a332c','#38251f'], ledgeTop:'#4b3936', gate:'#ff8a5c',
    accent:'#ff7a3c', ambient:'embers',
  },
  thunder: {
    ground:['#7a7558','#6e6a4e'], detail:'#a8946a', groundMotif:'dry',
    path:['#a8946a','#98845c'], pathMotif:'dirt', pathLine:'#7f6e4a',
    tall:['#8f8250','#766a3f'], tallStyle:'dry',
    tree:'dead', leaf:['#8a8a5a','#6f7048','#b8b878'], trunk:'#5f5238',
    rock:'stormrock', rockCol:['#6f6a62','#8a86a0'],
    flower:'boltbloom', flowerCol:['#fff06a','#e8c12c','#8a6a1a'],
    ledge:['#6f6248','#57503a'], ledgeTop:'#6e6a4e', gate:'#e8c12c',
    accent:'#ffe04a', ambient:'sparks',
  },
  ice: {
    ground:['#d7edf6','#cbe6f1'], detail:'#ffffff', groundMotif:'ice',
    path:['#e8f4fb','#dcedf8'], pathMotif:'snow', pathLine:'#b8d8e8',
    tall:['#a8d8e8','#8fc8dd'], tallStyle:'frost',
    tree:'pine', leaf:['#4f8a7a','#3a6f66','#ffffff'], trunk:'#6a5a52',
    rock:'ice', rockCol:['#bfe8f2','#eafaff'],
    flower:'snowflake', flowerCol:['#ffffff','#bfe8f2','#8ad8f0'],
    ledge:['#a8ccd8','#8fb8c8'], ledgeTop:'#cbe6f1', gate:'#7fd4d0',
    accent:'#9fe8ff', ambient:'snow',
  },
  champion: {
    ground:['#6d6878','#625e6d'], detail:'#ffd23e', groundMotif:'rune',
    path:['#4a4552','#403c48'], pathMotif:'tile', pathLine:'#c8a84a',
    tall:['#4f4a5a','#3f3a48'], tallStyle:'glow',
    tree:'pillar', leaf:['#8a6a4a','#6b4a2f','#ffd23e'], trunk:'#8a6a4a',
    rock:'column', rockCol:['#7a7288','#a89ab0'],
    flower:'rune', flowerCol:['#ffd23e','#fff2b0','#ff8a5c'],
    ledge:['#4a4552','#38343f'], ledgeTop:'#625e6d', gate:'#ffd23e',
    accent:'#ffd23e', ambient:'goldmotes',
  },
  river: {
    ground:['#7ac48a','#6fb87f'], detail:'#b8e8c0', groundMotif:'grass',
    path:['#c8b99a','#bba98a'], pathMotif:'gravel', pathLine:'#a08f70',
    tall:['#4f9e72','#3f855e'], tallStyle:'reed',
    tree:'willow', leaf:['#6fbf72','#4f9e58','#8ad08a'], trunk:'#7a5a3a',
    rock:'riverrock', rockCol:['#8a9a92','#b0c0b4'],
    flower:'lotus', flowerCol:['#ffd7e8','#ff9fc8','#ffd23e'],
    ledge:['#8a7a5a','#6f6248'], ledgeTop:'#6fb87f', gate:'#ffd23e',
    accent:'#7fe8c0', ambient:'dragonfly', water:['#4aa3b8','#3f92a8'],
  },
  desert: {
    ground:['#e8c27a','#dfb86d'], detail:'#c99a50', groundMotif:'sand',
    path:['#d9a961','#cf9d55'], pathMotif:'sand', pathLine:'#b8873f',
    tall:['#b8a85a','#a8944a'], tallStyle:'thorn',
    tree:'cactus', leaf:['#5fa85a','#3f7a3a','#8ad07a'], trunk:'#5fa85a',
    rock:'sandstone', rockCol:['#c99a62','#e0bb86'],
    flower:'desertbloom', flowerCol:['#ff7a9a','#ffd23e','#ffffff'],
    ledge:['#c99a62','#ad8050'], ledgeTop:'#dfb86d', gate:'#ffd23e',
    accent:'#ffb05c', ambient:'sand',
  },
  mine: {
    ground:['#6a5a4a','#5f5042'], detail:'#8a7a62', groundMotif:'cave',
    path:['#8a7a62','#7a6a52'], pathMotif:'gravel', pathLine:'#5f5038',
    tall:['#4a3a30','#3a2c24'], tallStyle:'cave',
    tree:'timber', leaf:['#8a6a4a','#6b4a2f','#a87a4a'], trunk:'#6b4a2f',
    rock:'ore', rockCol:['#665a4a','#8a7a62'],
    flower:'crystal', flowerCol:['#8ad8ff','#d8f8ff','#ffd23e'],
    ledge:['#4f4034','#3f3228'], ledgeTop:'#5f5042', gate:'#c8a84a',
    accent:'#ffd27a', ambient:'dustspark',
  },
  spring: {
    ground:['#6fa878','#649c6d'], detail:'#9fd8a0', groundMotif:'swamp',
    path:['#8a7a5a','#7d6e50'], pathMotif:'wood', pathLine:'#665a3f',
    tall:['#3f7f5a','#2f6b4a'], tallStyle:'reed',
    tree:'willow', leaf:['#5faf72','#479a5c','#7fc88a'], trunk:'#6f5a3a',
    rock:'mossy', rockCol:['#5f7a62','#84a07f'],
    flower:'lotus', flowerCol:['#ffc6de','#f58ec0','#ffd23e'],
    ledge:['#5f6f4a','#4a5838'], ledgeTop:'#649c6d', gate:'#ffd23e',
    accent:'#8fffc0', ambient:'fireflies', water:['#4f8a6a','#3f7a5c'],
  },
  bamboo: {
    ground:['#9ccc6a','#92c260'], detail:'#c8e88a', groundMotif:'bamboo',
    path:['#cbb98a','#bfad7e'], pathMotif:'dirt', pathLine:'#a89568',
    tall:['#5f9e42','#4f8a38'], tallStyle:'bamboo',
    tree:'bamboo', leaf:['#5fae4a','#3f8a3a','#8ad06a'], trunk:'#7fae4a',
    rock:'mossy', rockCol:['#7f8a62','#a8b484'],
    flower:'bambooflower', flowerCol:['#f0f0c0','#d8e8a0','#fff6d8'],
    ledge:['#8a7a4a','#6f6238'], ledgeTop:'#92c260', gate:'#ffd23e',
    accent:'#d8ff7a', ambient:'leaves',
  },
  waterfall: {
    ground:['#7fb8a8','#73ab9c'], detail:'#b8e8e0', groundMotif:'wet',
    path:['#9aa89a','#8c9a8c'], pathMotif:'gravel', pathLine:'#758578',
    tall:['#4f9e82','#3f856e'], tallStyle:'reed',
    tree:'pine', leaf:['#3f8a72','#2f705f','#c8fff0'], trunk:'#5a6a58',
    rock:'wetrock', rockCol:['#7a8a82','#a0b4ac'],
    flower:'sprayflower', flowerCol:['#8ad8f0','#ffffff','#7fd4d0'],
    ledge:['#5f7a70','#4a645c'], ledgeTop:'#73ab9c', gate:'#7fd4d0',
    accent:'#8ad8f0', ambient:'spray', water:['#5fb8d0','#4aa3c0'],
  },
  canyon: {
    ground:['#b57a5a','#aa7052'], detail:'#d8a070', groundMotif:'canyon',
    path:['#c98f66','#bd835c'], pathMotif:'sand', pathLine:'#9f6a46',
    tall:['#8a7a4a','#76683f'], tallStyle:'dry',
    tree:'dead', leaf:['#8a7a4a','#6f6238','#b8a86a'], trunk:'#6f4a32',
    rock:'mesa', rockCol:['#a8603f','#c9865f'],
    flower:'desertrose', flowerCol:['#e85a7a','#ffd23e','#f5d8e0'],
    ledge:['#8f5238','#733f2a'], ledgeTop:'#aa7052', gate:'#ff8a5c',
    accent:'#ff9a5c', ambient:'dust',
  },
  snowfield: {
    ground:['#eef8ff','#e4f2fb'], detail:'#ffffff', groundMotif:'snow',
    path:['#dfeef8','#d4e6f4'], pathMotif:'snow', pathLine:'#b8d4e8',
    tall:['#b8dce8','#a8ccd8'], tallStyle:'frost',
    tree:'pine', leaf:['#3f6f6a','#2f5f5a','#ffffff'], trunk:'#6a5a52',
    rock:'snowrock', rockCol:['#c8dce8','#eef8ff'],
    flower:'snowflake', flowerCol:['#ffffff','#cfeaff','#9fd4ee'],
    ledge:['#c8dce8','#aac4d4'], ledgeTop:'#e4f2fb', gate:'#7fd4d0',
    accent:'#bff0ff', ambient:'snow',
  },
  ruins: {
    ground:['#9a9678','#8e8a6d'], detail:'#b8b090', groundMotif:'tile',
    path:['#b5ab8a','#a89e7d'], pathMotif:'tile', pathLine:'#8a8062',
    tall:['#6f8a4a','#5f7a3f'], tallStyle:'overgrown',
    tree:'dead', leaf:['#6f8a4a','#5f7a3f','#8a9a5a'], trunk:'#6f6248',
    rock:'column', rockCol:['#a89e7d','#c8bd98'],
    flower:'rune', flowerCol:['#8fffc0','#d8ffe8','#ffd23e'],
    ledge:['#7a7058','#5f563f'], ledgeTop:'#8e8a6d', gate:'#ffd23e',
    accent:'#8fffc0', ambient:'goldmotes',
  },
};
const DEFAULT_THEME = ZONE_THEMES.field;
function zoneThemeAt(x, y) {
  return ZONE_THEMES[regionZoneAt(x, y)] || DEFAULT_THEME;
}
function zoneTheme(zone) { return ZONE_THEMES[zone] || DEFAULT_THEME; }

/* ---------------- 地形の 事前描画 (24×24 タイルの チャンク) ---------------- */
function bakeTerrain() {
  terrainChunks.clear();
}

function getTerrainChunk(cx, cy) {
  const key = cx + ',' + cy;
  let cv = terrainChunks.get(key);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = CHUNK * TILE;
  cv.height = CHUNK * TILE;
  const c = cv.getContext('2d');
  c.setTransform(1, 0, 0, 1, -cx * CHUNK * TILE, -cy * CHUNK * TILE);
  const x0 = cx * CHUNK, y0 = cy * CHUNK;
  const x1 = Math.min(MAP_W, x0 + CHUNK), y1 = Math.min(MAP_H, y0 + CHUNK);
  for (let ty = y0; ty < y1; ty++) {
    for (let tx = x0; tx < x1; tx++) drawTile(c, tx, ty, map[ty][tx], zoneTheme(zoneAt(tx, ty)));
  }
  for (const b of BUILDINGS) {
    if (b.x < x1 && b.x + b.w > x0 && b.y < y1 && b.y + b.h > y0) drawBuilding(c, b);
  }
  terrainChunks.set(key, cv);
  return cv;
}

/* ---- タイル描画の 小道具 ---- */
function tileLine(c, x1, y1, x2, y2, col, w = 2, alpha = 1) {
  c.save(); c.globalAlpha = alpha;
  c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.restore();
}
function tileBlob(c, x, y, rx, ry, col, alpha = 1) {
  c.save(); c.globalAlpha = alpha; c.fillStyle = col;
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); c.restore();
}

function drawGroundBase(c, x, y, tx, ty, th, h1, h2) {
  c.fillStyle = h1 < 0.5 ? th.ground[0] : th.ground[1];
  c.fillRect(x, y, TILE, TILE);
  const d = th.detail;
  c.save();
  c.globalAlpha = 0.5;
  c.fillStyle = d;
  switch (th.groundMotif) {
    case 'grass':
      if (h1 < 0.36) c.fillRect(x + 5, y + 8, 5, 2);
      if (h1 > 0.62) c.fillRect(x + TILE - 14, y + TILE - 10, 6, 2);
      if (h2 > 0.82) { c.fillRect(x + 16, y + 17, 2, 5); c.fillRect(x + 19, y + 19, 2, 3); }
      break;
    case 'moss':
      tileBlob(c, x + 9 + h1 * 8, y + 11, 7, 4, d, 0.5);
      tileBlob(c, x + TILE - 10, y + TILE - 9, 8, 4, d, 0.38);
      if (h2 > 0.7) tileBlob(c, x + 20, y + 22, 3, 2, '#c8e8a0', 0.35);
      break;
    case 'sand':
      c.strokeStyle = d; c.lineWidth = 1.5; c.globalAlpha = 0.45;
      c.beginPath();
      for (let i = 0; i < 3; i++) {
        const yy = y + 8 + i * 9 + h1 * 3;
        c.moveTo(x + 4, yy);
        c.quadraticCurveTo(x + TILE / 2, yy + 3, x + TILE - 4, yy);
      }
      c.stroke();
      if (h2 > 0.74) tileBlob(c, x + 12, y + 25, 2, 1.4, '#a87a3a', 0.45);
      break;
    case 'stone':
      tileLine(c, x + 6, y + 11, x + 16, y + 15, d, 1.4, 0.35);
      tileLine(c, x + 16, y + 15, x + 13, y + 25, d, 1.2, 0.3);
      if (h2 > 0.6) tileBlob(c, x + 26, y + 9, 4, 3, d, 0.35);
      break;
    case 'cobble':
      c.strokeStyle = d; c.lineWidth = 1.4; c.globalAlpha = 0.34;
      c.beginPath(); c.arc(x + 11, y + 12, 5, 0, TAU); c.stroke();
      c.beginPath(); c.arc(x + 25, y + 22, 6, 0, TAU); c.stroke();
      if (h2 > 0.55) { c.beginPath(); c.arc(x + 24, y + 9, 4, 0, TAU); c.stroke(); }
      break;
    case 'ice':
      tileLine(c, x + 3, y + 26, x + 15, y + 14, '#ffffff', 1.6, 0.5);
      tileLine(c, x + 15, y + 14, x + 25, y + 19, d, 1.2, 0.4);
      if (h2 > 0.66) {
        c.globalAlpha = 0.8; c.fillStyle = '#ffffff';
        c.fillRect(x + 24, y + 8, 2, 2); c.fillRect(x + 8, y + 7, 2, 2);
      }
      break;
    case 'lava':
      c.strokeStyle = d; c.lineWidth = 1.8; c.globalAlpha = 0.8;
      c.shadowColor = '#ff7a3c'; c.shadowBlur = 5;
      c.beginPath(); c.moveTo(x + 2, y + 12); c.lineTo(x + 13, y + 17); c.lineTo(x + 9, y + 26); c.stroke();
      if (h2 > 0.5) { c.beginPath(); c.moveTo(x + 22, y + 6); c.lineTo(x + 30, y + 15); c.lineTo(x + 26, y + 26); c.stroke(); }
      c.shadowBlur = 0;
      c.fillStyle = '#2a1c1a'; c.globalAlpha = 0.7;
      c.fillRect(x + 17, y + 24, 6, 3);
      break;
    case 'dry':
      tileLine(c, x + 5, y + 8, x + 12, y + 15, d, 1.3, 0.42);
      tileLine(c, x + 12, y + 15, x + 9, y + 24, d, 1.1, 0.36);
      if (h2 > 0.6) tileLine(c, x + 22, y + 6, x + 29, y + 18, d, 1.2, 0.34);
      break;
    case 'swamp':
      tileBlob(c, x + 12 + h1 * 8, y + 18, 9, 4, '#3f6a5a', 0.4);
      tileBlob(c, x + 12 + h1 * 8, y + 17, 5, 2, '#7fb8a0', 0.3);
      if (h2 > 0.62) tileBlob(c, x + 26, y + 24, 6, 3, '#3f6a5a', 0.35);
      break;
    case 'bamboo':
      c.strokeStyle = d; c.lineWidth = 1.4; c.globalAlpha = 0.45;
      c.beginPath(); c.moveTo(x + 6, y + 9); c.quadraticCurveTo(x + 12, y + 12, x + 17, y + 9); c.stroke();
      c.beginPath(); c.moveTo(x + 20, y + 25); c.quadraticCurveTo(x + 26, y + 22, x + 31, y + 26); c.stroke();
      break;
    case 'wet':
      tileLine(c, x + 4, y + 10, x + 17, y + 10, '#ffffff', 1.5, 0.3);
      tileLine(c, x + 22, y + 22, x + 32, y + 22, '#ffffff', 1.3, 0.25);
      if (h2 > 0.64) tileBlob(c, x + 11, y + 27, 4, 2, '#d8fff8', 0.35);
      break;
    case 'canyon':
      c.strokeStyle = d; c.lineWidth = 1.5; c.globalAlpha = 0.36;
      for (let i = 0; i < 2; i++) {
        const yy = y + 9 + i * 11 + h1 * 3;
        c.beginPath(); c.moveTo(x, yy); c.lineTo(x + TILE, yy + 2); c.stroke();
      }
      break;
    case 'snow':
      tileBlob(c, x + 9 + h1 * 14, y + 16, 8, 3, '#c8dce8', 0.28);
      if (h2 > 0.58) {
        c.globalAlpha = 0.85; c.fillStyle = '#ffffff';
        c.fillRect(x + 25, y + 8, 2, 2); c.fillRect(x + 7, y + 25, 2, 2);
      }
      break;
    case 'tile':
      c.strokeStyle = d; c.lineWidth = 1.2; c.globalAlpha = 0.4;
      c.strokeRect(x + 1, y + 1, TILE / 2 - 1, TILE / 2 - 1);
      c.strokeRect(x + TILE / 2, y + TILE / 2, TILE / 2 - 1, TILE / 2 - 1);
      if (h2 > 0.55) { c.globalAlpha = 0.26; c.fillRect(x + 3, y + TILE / 2 + 2, 5, 2); }
      break;
    case 'cave':
      tileBlob(c, x + 8, y + 10, 3, 2, d, 0.5);
      tileBlob(c, x + 27, y + 18, 2.5, 2, d, 0.4);
      if (h2 > 0.7) tileLine(c, x + 12, y + 24, x + 20, y + 20, d, 1.1, 0.3);
      break;
    case 'rune':
      c.strokeStyle = d; c.lineWidth = 1.4; c.globalAlpha = 0.5;
      c.beginPath(); c.moveTo(x + 10, y + 24); c.lineTo(x + 18, y + 10); c.lineTo(x + 26, y + 24); c.stroke();
      if (h2 > 0.66) { c.globalAlpha = 0.35; c.beginPath(); c.arc(x + 18, y + 19, 4, 0, TAU); c.stroke(); }
      break;
  }
  c.restore();
}

function drawPathTile(c, x, y, tx, ty, th, h1, h2) {
  c.fillStyle = h1 < 0.5 ? th.path[0] : th.path[1];
  c.fillRect(x, y, TILE, TILE);
  const d = th.pathLine;
  c.save();
  switch (th.pathMotif) {
    case 'cobble':
      c.strokeStyle = d; c.lineWidth = 1.4; c.globalAlpha = 0.5;
      c.beginPath(); c.arc(x + 9, y + 10, 5, 0, TAU); c.stroke();
      c.beginPath(); c.arc(x + 25, y + 11, 5, 0, TAU); c.stroke();
      c.beginPath(); c.arc(x + 16, y + 25, 6, 0, TAU); c.stroke();
      break;
    case 'plank':
      c.strokeStyle = d; c.lineWidth = 1.6; c.globalAlpha = 0.55;
      for (let i = 0; i < 3; i++) {
        const yy = y + 3 + i * 11;
        c.beginPath(); c.moveTo(x, yy); c.lineTo(x + TILE, yy); c.stroke();
      }
      c.fillStyle = d; c.globalAlpha = 0.35;
      c.fillRect(x + (h1 < 0.5 ? 9 : 23), y + 7, 1.5, 8);
      break;
    case 'sand':
      c.strokeStyle = d; c.lineWidth = 1.3; c.globalAlpha = 0.32;
      c.beginPath();
      c.moveTo(x + 3, y + 9 + h1 * 4); c.quadraticCurveTo(x + 18, y + 14, x + TILE - 3, y + 8);
      c.stroke();
      if (h2 > 0.62) tileBlob(c, x + 26, y + 26, 3, 1.5, d, 0.35);
      break;
    case 'gravel':
      c.fillStyle = d; c.globalAlpha = 0.42;
      c.fillRect(x + 6, y + 8, 4, 3);
      c.fillRect(x + 21, y + 14, 3, 3);
      c.fillRect(x + 12, y + 26, 4, 2);
      if (h2 > 0.5) c.fillRect(x + 29, y + 24, 3, 2);
      break;
    case 'snow':
      c.strokeStyle = d; c.lineWidth = 1.4; c.globalAlpha = 0.36;
      c.beginPath(); c.moveTo(x + 2, y + 12); c.quadraticCurveTo(x + 17, y + 9, x + TILE - 2, y + 13); c.stroke();
      if (h2 > 0.55) { c.globalAlpha = 0.8; c.fillStyle = '#ffffff'; c.fillRect(x + 10, y + 23, 2, 2); }
      break;
    case 'tile':
      c.strokeStyle = d; c.lineWidth = 1.2; c.globalAlpha = 0.55;
      c.strokeRect(x + 2, y + 2, TILE - 4, TILE / 2 - 2);
      c.strokeRect(x + 2, y + TILE / 2, TILE - 4, TILE / 2 - 2);
      c.beginPath(); c.moveTo(x + TILE / 2, y + 2); c.lineTo(x + TILE / 2, y + TILE / 2); c.stroke();
      break;
    case 'wood':
      c.strokeStyle = d; c.lineWidth = 1.5; c.globalAlpha = 0.42;
      for (let i = 0; i < 3; i++) {
        const yy = y + 4 + i * 11;
        c.beginPath(); c.moveTo(x, yy); c.lineTo(x + TILE, yy + 1); c.stroke();
      }
      break;
    case 'moss':
      tileBlob(c, x + 11, y + 10, 7, 3, '#6f8a4a', 0.32);
      tileBlob(c, x + 26, y + 25, 6, 2.5, '#6f8a4a', 0.26);
      break;
    case 'ash':
      c.fillStyle = d; c.globalAlpha = 0.5;
      c.fillRect(x + 8, y + 9, 3, 2);
      c.fillRect(x + 25, y + 21, 4, 2);
      break;
    default:
      c.fillStyle = d; c.globalAlpha = 0.28;
      c.fillRect(x + 7, y + 10, 4, 3);
      c.fillRect(x + TILE - 15, y + TILE - 13, 5, 3);
      break;
  }
  c.restore();
  /* 道の ふち (となりが 道でない ところ) */
  c.save();
  c.strokeStyle = d; c.lineWidth = 2; c.globalAlpha = 0.42;
  const isPath = (nx, ny) => inBounds(nx, ny) && map[ny][nx] === T.PATH;
  if (!isPath(tx, ty - 1)) { c.beginPath(); c.moveTo(x, y + 1); c.lineTo(x + TILE, y + 1); c.stroke(); }
  if (!isPath(tx, ty + 1)) { c.beginPath(); c.moveTo(x, y + TILE - 1); c.lineTo(x + TILE, y + TILE - 1); c.stroke(); }
  if (!isPath(tx - 1, ty)) { c.beginPath(); c.moveTo(x + 1, y); c.lineTo(x + 1, y + TILE); c.stroke(); }
  if (!isPath(tx + 1, ty)) { c.beginPath(); c.moveTo(x + TILE - 1, y); c.lineTo(x + TILE - 1, y + TILE); c.stroke(); }
  c.restore();
}

function drawTallTile(c, x, y, tx, ty, th, h1, h2) {
  c.fillStyle = h1 < 0.5 ? th.tall[0] : th.tall[1];
  c.fillRect(x, y, TILE, TILE);
  c.save();
  c.lineCap = 'round';
  const col = th.tall[1];
  const light = th.detail;
  const style = th.tallStyle || 'blades';
  if (style === 'blades') {
    c.strokeStyle = col; c.lineWidth = 2.6;
    for (let i = 0; i < 6; i++) {
      const bx = x + 4 + (i * 6 + Math.floor(h1 * 4)) % (TILE - 8);
      const by = y + TILE - 3 - (i % 3) * 4;
      const sway = (hash(tx + i, ty * 3) - 0.5) * 8;
      c.beginPath(); c.moveTo(bx, by);
      c.quadraticCurveTo(bx + sway, by - 11, bx + sway * 1.5, by - 20); c.stroke();
    }
    if (h2 > 0.7) c.fillStyle = light, c.fillRect(x + 23, y + 8, 2, 5);
  } else if (style === 'fern') {
    c.strokeStyle = col; c.lineWidth = 2.2;
    for (let i = 0; i < 4; i++) {
      const bx = x + 7 + i * 8, by = y + TILE - 4;
      c.beginPath(); c.moveTo(bx, by);
      c.quadraticCurveTo(bx + (i - 1.5) * 3, by - 16, bx + (i - 1.5) * 9, by - 24); c.stroke();
      c.lineWidth = 1.6;
      for (let k = 1; k <= 3; k++) {
        const t = k / 4;
        const fx = bx + (i - 1.5) * 9 * t, fy = by - 24 * t;
        c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx - 5, fy + 2); c.moveTo(fx, fy); c.lineTo(fx + 5, fy + 2); c.stroke();
      }
      c.lineWidth = 2.2;
    }
  } else if (style === 'reed') {
    c.strokeStyle = col; c.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const bx = x + 6 + i * 6, sway = (hash(tx + i * 2, ty) - 0.5) * 7;
      c.beginPath(); c.moveTo(bx, y + TILE - 3);
      c.quadraticCurveTo(bx + sway, y + 16, bx + sway * 1.3, y + 6); c.stroke();
      if (i % 2 === 0) tileBlob(c, bx + sway * 1.3, y + 7, 2.6, 5, light, 0.95);
    }
  } else if (style === 'bamboo') {
    c.strokeStyle = col; c.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      const bx = x + 8 + i * 10;
      c.beginPath(); c.moveTo(bx, y + TILE - 2); c.lineTo(bx + 2, y + 5); c.stroke();
      c.strokeStyle = light; c.lineWidth = 1.2;
      for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(bx - 3, y + 10 + k * 8); c.lineTo(bx + 5, y + 10 + k * 8); c.stroke(); }
      c.strokeStyle = col; c.lineWidth = 4;
    }
  } else if (style === 'dry' || style === 'thorn') {
    c.strokeStyle = col; c.lineWidth = 2.4;
    for (let i = 0; i < 5; i++) {
      const bx = x + 6 + i * 6, sway = (hash(tx + i, ty * 5) - 0.5) * 9;
      c.beginPath(); c.moveTo(bx, y + TILE - 3);
      c.lineTo(bx + sway, y + 15); c.lineTo(bx + sway * 1.6, y + 7); c.stroke();
      if (style === 'thorn' && i % 2) { c.beginPath(); c.moveTo(bx + sway, y + 16); c.lineTo(bx + sway - 4, y + 12); c.stroke(); }
    }
  } else if (style === 'frost') {
    c.strokeStyle = col; c.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const bx = x + 7 + i * 8;
      c.beginPath(); c.moveTo(bx, y + TILE - 3); c.lineTo(bx + (i % 2 ? 3 : -3), y + 7); c.stroke();
      c.strokeStyle = light; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(bx - 3, y + 19); c.lineTo(bx + 3, y + 15); c.stroke();
      c.strokeStyle = col; c.lineWidth = 2;
    }
  } else if (style === 'charred') {
    c.strokeStyle = '#1f1816'; c.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const bx = x + 7 + i * 8;
      c.beginPath(); c.moveTo(bx, y + TILE - 3); c.lineTo(bx + (i % 2 ? 4 : -4), y + 8); c.stroke();
    }
    c.fillStyle = '#ff7a3c';
    for (let i = 0; i < 3; i++) c.fillRect(x + 6 + i * 10, y + 13 + (i % 2) * 7, 2, 2);
  } else if (style === 'cave') {
    c.strokeStyle = col; c.lineWidth = 2.2;
    for (let i = 0; i < 4; i++) {
      const bx = x + 8 + i * 7;
      c.beginPath(); c.moveTo(bx, y + TILE - 3); c.quadraticCurveTo(bx + 3, y + 17, bx - 2, y + 10); c.stroke();
      tileBlob(c, bx - 2, y + 9, 3.5, 2.2, '#8ad8ff', 0.7);
    }
  } else if (style === 'glow') {
    c.strokeStyle = col; c.lineWidth = 2.4;
    for (let i = 0; i < 5; i++) {
      const bx = x + 6 + i * 6;
      c.beginPath(); c.moveTo(bx, y + TILE - 3); c.quadraticCurveTo(bx + 3, y + 14, bx + 1, y + 7); c.stroke();
    }
    c.fillStyle = light;
    for (let i = 0; i < 3; i++) c.fillRect(x + 8 + i * 9, y + 6 + (i % 2) * 5, 2, 2);
  } else if (style === 'overgrown') {
    c.strokeStyle = col; c.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const bx = x + 5 + i * 7;
      c.beginPath(); c.moveTo(bx, y + TILE - 3); c.quadraticCurveTo(bx + 4, y + 18, bx, y + 9); c.stroke();
    }
    if (h2 > 0.55) {
      c.fillStyle = th.flowerCol[0];
      c.fillRect(x + 12, y + 8, 3, 3); c.fillRect(x + 25, y + 15, 3, 3);
    }
  } else {
    c.strokeStyle = col; c.lineWidth = 2.4;
    for (let i = 0; i < 5; i++) {
      const bx = x + 5 + i * 7;
      c.beginPath(); c.moveTo(bx, y + TILE - 3); c.quadraticCurveTo(bx + 3, y + 15, bx, y + 7); c.stroke();
    }
  }
  c.restore();
}

function drawTreeTile(c, x, y, tx, ty, th, h1, h2) {
  const style = th.tree || 'broadleaf';
  const leaf = th.leaf || ['#3a925c', '#2f7d4f', '#48a468'];
  const trunk = th.trunk || '#6b4a2f';
  const cx = x + TILE / 2, cy = y + TILE / 2;
  c.save();
  if (style === 'broadleaf' || style === 'giant') {
    const big = style === 'giant';
    c.fillStyle = 'rgba(20,40,25,.18)';
    c.beginPath(); c.ellipse(cx, y + TILE - 3, big ? 17 : 14, 4, 0, 0, TAU); c.fill();
    c.fillStyle = trunk;
    c.fillRect(cx - (big ? 4 : 3), y + TILE - 13, big ? 8 : 6, 13);
    const R = big ? 19 : 15;
    circle(c, cx, cy - 6, R, leaf[0]);
    circle(c, cx - (big ? 12 : 10), cy, big ? 13 : 10, leaf[1]);
    circle(c, cx + (big ? 12 : 10), cy - 2, big ? 14 : 11, leaf[1]);
    circle(c, cx - 2, cy - (big ? 19 : 15), big ? 10 : 8, leaf[2]);
    if (big) {
      c.strokeStyle = leaf[2]; c.lineWidth = 2; c.globalAlpha = 0.5;
      c.beginPath(); c.moveTo(cx - 10, cy); c.quadraticCurveTo(cx - 14, cy + 10, cx - 12, cy + 17); c.stroke();
    }
  } else if (style === 'pine') {
    c.fillStyle = trunk; c.fillRect(cx - 3, y + TILE - 12, 6, 12);
    for (let i = 0; i < 3; i++) {
      const w = 15 - i * 3, yy = y + 19 - i * 7;
      polyTile(c, [cx, yy - 12, cx - w, yy, cx + w, yy], i === 2 ? leaf[2] : leaf[i % 2]);
    }
    if (leaf[2] === '#ffffff' || leaf[2] === '#c8fff0') {
      c.fillStyle = '#ffffff'; c.globalAlpha = 0.9;
      c.fillRect(cx - 8, y + 18, 4, 2); c.fillRect(cx - 3, y + 11, 3, 2);
    }
  } else if (style === 'palm') {
    c.strokeStyle = trunk; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx, y + TILE - 3); c.quadraticCurveTo(cx + 3, y + 18, cx - 4, y + 10); c.stroke();
    c.fillStyle = leaf[0];
    for (let i = 0; i < 5; i++) {
      const ang = -2.5 + i * 0.6;
      const ex = cx - 4 + Math.cos(ang) * 16, ey = y + 10 + Math.sin(ang) * 11;
      c.beginPath(); c.moveTo(cx - 4, y + 10);
      c.quadraticCurveTo((cx - 4 + ex) / 2, ey - 5, ex, ey);
      c.quadraticCurveTo((cx - 4 + ex) / 2, ey + 1, cx - 4, y + 10); c.fill();
    }
    circle(c, cx - 2, y + 11, 3, leaf[2]);
    tileBlob(c, cx - 6, y + 15, 2.5, 2, '#6b4a2f', 0.9);
  } else if (style === 'bamboo') {
    for (let i = 0; i < 3; i++) {
      const bx = cx - 10 + i * 10;
      c.strokeStyle = leaf[0]; c.lineWidth = 4;
      c.beginPath(); c.moveTo(bx, y + TILE - 2); c.lineTo(bx + (i - 1) * 3, y + 3); c.stroke();
      c.strokeStyle = leaf[1]; c.lineWidth = 1.3;
      for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(bx - 3, y + 10 + k * 7); c.lineTo(bx + 5, y + 10 + k * 7); c.stroke(); }
      c.fillStyle = leaf[2];
      for (let k = 0; k < 2; k++) {
        const lx = bx + (k ? 5 : -5), ly = y + 8 + k * 9;
        c.beginPath(); c.ellipse(lx, ly, 5, 2, k ? 0.5 : -0.5, 0, TAU); c.fill();
      }
    }
  } else if (style === 'cactus') {
    c.fillStyle = leaf[0];
    c.fillRect(cx - 3, y + 8, 7, 26);
    c.fillRect(cx - 13, y + 15, 10, 5); c.fillRect(cx - 13, y + 10, 5, 10);
    c.fillRect(cx + 5, y + 20, 10, 5); c.fillRect(cx + 11, y + 14, 5, 11);
    c.fillStyle = leaf[1];
    c.fillRect(cx - 1, y + 9, 2, 20);
    c.fillStyle = th.flowerCol[0];
    circle(c, cx + 1, y + 7, 3.5, th.flowerCol[0]);
    c.fillStyle = th.flowerCol[1]; circle(c, cx + 1, y + 7, 1.4, th.flowerCol[1]);
    c.strokeStyle = leaf[2]; c.lineWidth = 1;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(cx + 3, y + 12 + i * 5); c.lineTo(cx + 7, y + 10 + i * 5); c.stroke(); }
  } else if (style === 'dead') {
    c.strokeStyle = trunk; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx, y + TILE - 2); c.quadraticCurveTo(cx - 3, y + 18, cx + 2, y + 8); c.stroke();
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(cx + 1, y + 17); c.lineTo(cx - 10, y + 10); c.stroke();
    c.beginPath(); c.moveTo(cx + 2, y + 13); c.lineTo(cx + 12, y + 6); c.stroke();
    c.beginPath(); c.moveTo(cx - 1, y + 22); c.lineTo(cx - 9, y + 20); c.stroke();
  } else if (style === 'willow') {
    c.fillStyle = trunk; c.fillRect(cx - 3, y + 16, 6, 17);
    circle(c, cx, y + 12, 14, leaf[0]);
    circle(c, cx - 9, y + 16, 9, leaf[1]); circle(c, cx + 9, y + 16, 9, leaf[1]);
    c.strokeStyle = leaf[2]; c.lineWidth = 1.8; c.globalAlpha = 0.8;
    for (let i = 0; i < 5; i++) {
      const bx = cx - 13 + i * 6;
      c.beginPath(); c.moveTo(bx, y + 14); c.quadraticCurveTo(bx + 2, y + 24, bx - 1, y + 32); c.stroke();
    }
  } else if (style === 'obsidian') {
    c.fillStyle = '#241c24';
    polyTile(c, [cx - 11, y + TILE - 2, cx - 5, y + 8, cx - 1, y + 14, cx + 4, y + 2, cx + 9, y + 15, cx + 14, y + 10, cx, y + TILE - 2], '#2a2230');
    c.strokeStyle = '#ff7a3c'; c.lineWidth = 1.8; c.shadowColor = '#ff7a3c'; c.shadowBlur = 6;
    c.beginPath(); c.moveTo(cx - 2, y + 6); c.lineTo(cx + 2, y + 16); c.lineTo(cx - 1, y + 27); c.stroke();
    c.shadowBlur = 0;
  } else if (style === 'timber') {
    c.fillStyle = '#6b4a2f'; c.fillRect(cx - 12, y + 7, 5, 27); c.fillRect(cx + 7, y + 7, 5, 27);
    c.fillRect(cx - 14, y + 5, 28, 5);
    c.strokeStyle = '#3a2c1e'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(cx - 13, y + 8); c.lineTo(cx + 7, y + 30); c.stroke();
    c.fillStyle = '#ffd23e'; circle(c, cx, y + 14, 4, '#ffd23e'); circle(c, cx, y + 14, 2, '#fff2b0');
  } else if (style === 'pillar') {
    c.fillStyle = leaf[0];
    c.fillRect(cx - 5, y + 5, 10, 29);
    c.fillStyle = leaf[1]; c.fillRect(cx - 7, y + 3, 14, 5); c.fillRect(cx - 7, y + 31, 14, 4);
    c.fillStyle = leaf[2]; c.fillRect(cx - 1, y + 8, 2, 22);
    c.strokeStyle = leaf[2]; c.lineWidth = 1.4;
    c.beginPath(); c.arc(cx, y + 18, 7, 0, TAU); c.stroke();
  } else {
    c.fillStyle = trunk; c.fillRect(cx - 3, y + TILE - 12, 6, 12);
    circle(c, cx, cy - 4, 15, leaf[0]); circle(c, cx - 10, cy + 2, 10, leaf[1]); circle(c, cx + 10, cy, 11, leaf[1]);
  }
  c.restore();
}

function polyTile(c, pts, fill) {
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath(); c.fillStyle = fill; c.fill();
}

function drawRockTile(c, x, y, tx, ty, th, h1, h2) {
  const style = th.rock || 'boulder';
  const col = th.rockCol || ['#8f8a80', '#b9b3a8'];
  const cx = x + TILE / 2;
  c.save();
  if (style === 'boulder' || style === 'mossy' || style === 'searock' || style === 'riverrock' || style === 'wetrock') {
    c.fillStyle = 'rgba(20,30,20,.18)';
    c.beginPath(); c.ellipse(cx, y + TILE - 3, 15, 4, 0, 0, TAU); c.fill();
    polyTile(c, [x + 3, y + TILE - 4, x + 7, y + 10, x + 18, y + 4, x + 30, y + 12, x + TILE - 3, y + TILE - 4], col[0]);
    polyTile(c, [x + 15, y + 6, x + 28, y + 13, x + 20, y + 19], col[1]);
    if (style === 'mossy') { c.fillStyle = '#6f8a4a'; c.globalAlpha = 0.65; c.fillRect(x + 7, y + 15, 9, 4); c.fillRect(x + 19, y + 7, 7, 3); c.globalAlpha = 1; }
    if (style === 'searock') { c.strokeStyle = '#4f9e72'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 19, y + 17); c.quadraticCurveTo(x + 25, y + 24, x + 20, y + 31); c.stroke(); }
    if (style === 'riverrock' || style === 'wetrock') { c.fillStyle = 'rgba(255,255,255,.28)'; c.fillRect(x + 20, y + 11, 5, 2); c.fillRect(x + 8, y + 20, 4, 2); }
  } else if (style === 'obsidian') {
    polyTile(c, [cx, y + 2, x + 29, y + 14, x + 25, y + TILE - 3, x + 7, y + TILE - 3, x + 5, y + 15], '#2a202a');
    c.strokeStyle = '#ff7a3c'; c.lineWidth = 1.8; c.shadowColor = '#ff7a3c'; c.shadowBlur = 7;
    c.beginPath(); c.moveTo(cx - 2, y + 7); c.lineTo(cx + 4, y + 17); c.lineTo(cx - 2, y + 27); c.stroke();
    c.shadowBlur = 0;
  } else if (style === 'sandstone' || style === 'mesa') {
    polyTile(c, [x + 4, y + TILE - 3, x + 3, y + 14, x + 14, y + 5, x + 29, y + 11, x + 32, y + TILE - 3], col[0]);
    c.fillStyle = col[1]; c.globalAlpha = 0.55;
    c.fillRect(x + 6, y + 17, 24, 4); c.fillRect(x + 8, y + 24, 21, 4);
    c.globalAlpha = 1;
    if (style === 'mesa') { c.fillStyle = col[1]; c.fillRect(x + 10, y + 8, 16, 4); }
  } else if (style === 'ice') {
    polyTile(c, [cx, y + 3, x + 30, y + 15, x + 26, y + TILE - 4, x + 7, y + TILE - 4, x + 4, y + 16], col[0]);
    c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.globalAlpha = 0.8;
    c.beginPath(); c.moveTo(cx, y + 5); c.lineTo(cx - 4, y + 18); c.lineTo(cx + 8, y + 26); c.stroke();
    c.globalAlpha = 1;
  } else if (style === 'column') {
    c.fillStyle = col[1]; c.fillRect(x + 8, y + TILE - 5, 20, 4);
    c.fillStyle = col[0]; c.fillRect(cx - 7, y + 8, 14, 24);
    c.strokeStyle = col[1]; c.lineWidth = 1.5;
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(cx + i * 4, y + 9); c.lineTo(cx + i * 4, y + 30); c.stroke(); }
    c.fillStyle = col[1]; c.fillRect(cx - 9, y + 5, 18, 5);
    if (h2 > 0.55) { c.fillStyle = '#6f8a4a'; c.globalAlpha = 0.6; c.fillRect(cx - 7, y + 22, 6, 3); c.globalAlpha = 1; }
  } else if (style === 'ore') {
    polyTile(c, [x + 4, y + TILE - 3, x + 7, y + 12, x + 18, y + 5, x + 30, y + 14, x + TILE - 3, y + TILE - 3], col[0]);
    c.fillStyle = '#8ad8ff'; c.globalAlpha = 0.9;
    polyTile(c, [x + 12, y + 16, x + 16, y + 9, x + 20, y + 17, x + 16, y + 22], '#8ad8ff');
    polyTile(c, [x + 21, y + 20, x + 25, y + 13, x + 28, y + 22], '#d8f8ff');
    c.globalAlpha = 1;
  } else if (style === 'stormrock') {
    polyTile(c, [x + 5, y + TILE - 3, x + 8, y + 9, x + 18, y + 4, x + 29, y + 12, x + 31, y + TILE - 3], col[0]);
    c.strokeStyle = '#ffe04a'; c.lineWidth = 2; c.shadowColor = '#ffe04a'; c.shadowBlur = 6;
    c.beginPath(); c.moveTo(x + 20, y + 8); c.lineTo(x + 15, y + 17); c.lineTo(x + 22, y + 16); c.lineTo(x + 17, y + 27); c.stroke();
    c.shadowBlur = 0;
  } else if (style === 'snowrock') {
    polyTile(c, [x + 4, y + TILE - 3, x + 7, y + 12, x + 18, y + 5, x + 30, y + 12, x + 32, y + TILE - 3], col[0]);
    c.fillStyle = '#ffffff'; c.globalAlpha = 0.9;
    c.beginPath(); c.ellipse(cx, y + 10, 11, 4, 0, 0, TAU); c.fill();
    c.globalAlpha = 1;
  } else if (style === 'crate') {
    c.fillStyle = '#a8763f'; c.fillRect(x + 5, y + 7, 26, 25);
    c.strokeStyle = '#6b4a2f'; c.lineWidth = 2; c.strokeRect(x + 5, y + 7, 26, 25);
    c.beginPath(); c.moveTo(x + 7, y + 9); c.lineTo(x + 29, y + 30); c.moveTo(x + 29, y + 9); c.lineTo(x + 7, y + 30); c.stroke();
    c.fillStyle = '#d8b07a'; c.fillRect(x + 8, y + 10, 4, 19);
  } else {
    polyTile(c, [x + 4, y + TILE - 3, x + 8, y + 10, x + 18, y + 4, x + 30, y + 12, x + 32, y + TILE - 3], col[0]);
  }
  c.restore();
}

function drawFlowerTile(c, x, y, tx, ty, th, h1, h2) {
  const cx = x + TILE / 2, cy = y + TILE / 2;
  const col = th.flowerCol || ['#ffd7e8', '#fff0a8', '#ffffff'];
  const style = th.flower || 'daisy';
  c.save();
  if (style === 'shell') {
    c.fillStyle = col[0]; c.beginPath(); c.arc(x + 12, y + 14, 6, 0, Math.PI); c.fill();
    c.strokeStyle = col[1]; c.lineWidth = 1.2; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x + 12, y + 14, 2 + i * 2, 0, Math.PI); c.stroke(); }
    c.fillStyle = col[2];
    polyTile(c, [x + 24, y + 18, x + 30, y + 20, x + 27, y + 24, x + 22, y + 22, x + 21, y + 19], col[2]);
    c.fillStyle = '#e8c84a'; circle(c, x + 25, y + 21, 1.4, '#e8c84a');
  } else if (style === 'rune' || style === 'buoy') {
    c.strokeStyle = col[0]; c.lineWidth = 2; c.shadowColor = col[0]; c.shadowBlur = 6;
    c.beginPath(); c.arc(cx, cy, 8, 0, TAU); c.stroke();
    c.beginPath(); c.moveTo(cx - 5, cy + 5); c.lineTo(cx, cy - 5); c.lineTo(cx + 5, cy + 5); c.stroke();
    c.shadowBlur = 0;
    c.fillStyle = col[1]; circle(c, cx, cy, 2, col[1]);
  } else if (style === 'snowflake') {
    c.strokeStyle = col[0]; c.lineWidth = 1.8; c.shadowColor = '#fff'; c.shadowBlur = 4;
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9); c.stroke();
      c.beginPath(); c.moveTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6);
      c.lineTo(cx + Math.cos(a + 0.4) * 9, cy + Math.sin(a + 0.4) * 9); c.stroke();
    }
    c.shadowBlur = 0;
  } else if (style === 'lavavent') {
    c.fillStyle = '#2a1c1a'; c.beginPath(); c.arc(cx, cy + 3, 8, 0, TAU); c.fill();
    c.fillStyle = col[0]; c.shadowColor = col[1]; c.shadowBlur = 8;
    circle(c, cx, cy + 1, 4, col[0]); circle(c, cx, cy - 3, 2, col[2]);
    c.shadowBlur = 0;
    c.fillStyle = col[1]; c.fillRect(cx - 2, cy - 9, 4, 3);
  } else if (style === 'glowshroom' || style === 'crystal') {
    if (style === 'glowshroom') {
      c.fillStyle = col[1]; c.fillRect(cx - 1.5, cy + 2, 3, 7);
      c.fillStyle = col[0]; c.beginPath(); c.ellipse(cx, cy + 1, 8, 5, 0, Math.PI, 0); c.fill();
      c.fillStyle = col[2]; c.globalAlpha = 0.8; circle(c, cx - 3, cy - 1, 1.3, col[2]); circle(c, cx + 3, cy, 1, col[2]);
      c.globalAlpha = 1;
    } else {
      polyTile(c, [cx, cy - 10, cx + 6, cy + 2, cx, cy + 8, cx - 6, cy + 2], col[0]);
      polyTile(c, [cx, cy - 10, cx + 6, cy + 2, cx, cy], col[1]);
    }
  } else if (style === 'lotus') {
    c.fillStyle = '#4f9e72'; tileBlob(c, cx, cy + 5, 11, 3.5, '#4f9e72', 0.8);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.4;
      c.fillStyle = col[i % 2];
      c.beginPath(); c.ellipse(cx + Math.cos(a) * 4, cy - 2 + Math.sin(a) * 2, 4, 2.4, a, 0, TAU); c.fill();
    }
    c.fillStyle = col[2]; circle(c, cx, cy - 1, 2, col[2]);
  } else if (style === 'bluebell') {
    c.strokeStyle = '#4f9e58'; c.lineWidth = 1.6;
    for (let i = -1; i <= 1; i++) {
      c.beginPath(); c.moveTo(cx + i * 6, cy + 9); c.lineTo(cx + i * 6, cy - 1); c.stroke();
      c.fillStyle = col[i + 1];
      c.beginPath(); c.ellipse(cx + i * 6, cy + 2, 3.2, 4, 0, 0, TAU); c.fill();
    }
  } else if (style === 'boltbloom') {
    c.strokeStyle = col[1]; c.lineWidth = 1.8; c.shadowColor = col[0]; c.shadowBlur = 5;
    c.beginPath(); c.moveTo(cx + 2, cy - 9); c.lineTo(cx - 3, cy); c.lineTo(cx + 3, cy - 1); c.lineTo(cx - 1, cy + 9); c.stroke();
    c.shadowBlur = 0;
    c.fillStyle = col[0]; circle(c, cx + 6, cy + 5, 2, col[0]);
  } else if (style === 'desertbloom' || style === 'desertrose') {
    c.strokeStyle = '#4f8a3a'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(cx, cy + 9); c.lineTo(cx, cy + 1); c.stroke();
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5;
      c.fillStyle = col[i % 2];
      c.beginPath(); c.ellipse(cx + Math.cos(a) * 4, cy + 1 + Math.sin(a) * 4, 3, 2, a, 0, TAU); c.fill();
    }
    c.fillStyle = col[2]; circle(c, cx, cy + 1, 1.7, col[2]);
  } else if (style === 'bambooflower') {
    c.fillStyle = col[0];
    for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(cx - 4 + i * 4, cy + (i % 2) * 4, 2.5, 0, TAU); c.fill(); }
    c.fillStyle = '#7fae4a'; c.fillRect(cx - 1, cy + 5, 2, 6);
  } else if (style === 'lichen') {
    c.fillStyle = col[1]; tileBlob(c, cx - 4, cy, 5, 3, col[1], 0.8); tileBlob(c, cx + 5, cy + 3, 4, 2.5, col[0], 0.8);
  } else if (style === 'sprayflower') {
    c.fillStyle = col[0];
    for (let i = 0; i < 4; i++) {
      const a = i * TAU / 4;
      c.beginPath(); c.ellipse(cx + Math.cos(a) * 3, cy + Math.sin(a) * 3, 3, 1.6, a, 0, TAU); c.fill();
    }
    c.fillStyle = col[1]; circle(c, cx, cy, 1.6, col[1]);
    c.fillStyle = col[2]; c.globalAlpha = 0.7; circle(c, cx + 9, cy - 6, 1.5, col[2]); circle(c, cx - 8, cy + 7, 1.2, col[2]);
  } else {
    /* daisy */
    c.strokeStyle = '#4f8a3a'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(cx, y + TILE - 4); c.lineTo(cx, cy + 1); c.stroke();
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6;
      c.fillStyle = col[i % 2];
      c.beginPath(); c.ellipse(cx + Math.cos(a) * 4, cy + Math.sin(a) * 4, 3.2, 1.8, a, 0, TAU); c.fill();
    }
    c.fillStyle = col[2]; circle(c, cx, cy, 2.4, col[2]);
    if (h2 > 0.6) { c.fillStyle = col[0]; circle(c, x + 8, y + 26, 2, col[0]); }
  }
  c.restore();
}

function drawTile(c, tx, ty, t, th) {
  th = th || DEFAULT_THEME;
  const x = tx * TILE, y = ty * TILE;
  const h1 = hash(tx * 5 + 3, ty * 7 + 1);
  const h2 = hash(tx * 11 + 7, ty * 3 + 5);

  if (t === T.WATER) {
    const isLake = th.water && [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) =>
      inBounds(tx + dx, ty + dy) && map[ty + dy][tx + dx] !== T.WATER).length >= 2;
    const wcol = isLake ? th.water : ['#4aa3df', '#3f95d0'];
    c.fillStyle = h1 < 0.5 ? wcol[0] : wcol[1];
    c.fillRect(x, y, TILE, TILE);
    c.fillStyle = 'rgba(255,255,255,.17)';
    c.fillRect(x + 6, y + 10, 14, 3);
    c.fillRect(x + TILE - 20, y + TILE - 12, 12, 3);
    if (h2 > 0.72) c.fillRect(x + 14, y + 24, 8, 2);
    return;
  }

  drawGroundBase(c, x, y, tx, ty, th, h1, h2);

  if (t === T.PATH) drawPathTile(c, x, y, tx, ty, th, h1, h2);
  else if (t === T.TALL) drawTallTile(c, x, y, tx, ty, th, h1, h2);
  else if (t === T.TREE) drawTreeTile(c, x, y, tx, ty, th, h1, h2);
  else if (t === T.BOULDER) drawRockTile(c, x, y, tx, ty, th, h1, h2);
  else if (t === T.FLOWER) drawFlowerTile(c, x, y, tx, ty, th, h1, h2);
  else if (t === T.SAND) {
    c.fillStyle = h1 < 0.5 ? '#ead9a8' : '#e2d09c';
    if (th.groundMotif === 'sand' && th.ground[0] !== '#ead9a8') {
      c.fillStyle = h1 < 0.5 ? th.ground[0] : th.ground[1];
    }
    c.fillRect(x, y, TILE, TILE);
    c.save(); c.globalAlpha = 0.5; c.fillStyle = th.detail;
    if (h1 < 0.4) c.fillRect(x + 7, y + 12, 4, 3);
    if (h1 > 0.6) c.fillRect(x + TILE - 15, y + TILE - 11, 5, 3);
    if (h2 > 0.7) c.fillRect(x + 18, y + 20, 3, 2);
    c.restore();
  } else if (t === T.SNOW) {
    c.fillStyle = h1 < 0.5 ? th.ground[0] : th.ground[1];
    c.fillRect(x, y, TILE, TILE);
    c.save(); c.globalAlpha = 0.32; c.fillStyle = th.detail;
    c.fillRect(x + 6, y + 9, 7, 3);
    if (h2 > 0.66) c.fillRect(x + TILE - 17, y + TILE - 13, 6, 3);
    c.restore();
    if (h2 > 0.85) circle(c, x + TILE / 2, y + TILE / 2, 2.2, '#ffffff');
  } else if (t === T.VOLCANIC) {
    c.fillStyle = h1 < 0.5 ? th.ground[0] : th.ground[1];
    c.fillRect(x, y, TILE, TILE);
    c.save(); c.strokeStyle = 'rgba(120,50,35,.45)'; c.lineWidth = 2;
    if (h1 < 0.55) {
      c.beginPath(); c.moveTo(x + 6, y + 12); c.lineTo(x + 18, y + 20); c.lineTo(x + 30, y + 14); c.stroke();
    }
    c.strokeStyle = '#ff7a3c'; c.shadowColor = '#ff7a3c'; c.shadowBlur = 6; c.globalAlpha = 0.8;
    if (h2 > 0.55) { c.beginPath(); c.moveTo(x + 8, y + 26); c.lineTo(x + 19, y + 21); c.lineTo(x + 30, y + 27); c.stroke(); }
    c.restore();
  } else if (t === T.ROCKY) {
    c.save(); c.globalAlpha = 0.3; c.fillStyle = th.detail;
    if (h1 < 0.4) c.fillRect(x + 6, y + 8, 7, 4);
    if (h1 > 0.65) c.fillRect(x + TILE - 16, y + TILE - 12, 6, 3);
    c.restore();
  } else if (t === T.SIGN) {
    c.fillStyle = '#6b4a2f';
    c.fillRect(x + TILE / 2 - 3, y + 16, 6, 18);
    c.fillStyle = '#b07a4a';
    c.fillRect(x + 5, y + 6, TILE - 10, 15);
    c.strokeStyle = '#6b4a2f'; c.lineWidth = 2;
    c.strokeRect(x + 5, y + 6, TILE - 10, 15);
    c.fillStyle = '#5a3a22';
    c.fillRect(x + 9, y + 11, 7, 2);
    c.fillRect(x + 9, y + 15, 13, 2);
  } else if (t === T.LEDGE) {
    const lc = th.ledge || ['#8a6a4a', '#a8835c'];
    c.fillStyle = lc[0];
    c.fillRect(x, y + TILE - 12, TILE, 5);
    c.fillStyle = lc[1];
    c.fillRect(x, y + TILE - 7, TILE, 7);
    c.fillStyle = 'rgba(255,255,255,.18)';
    c.fillRect(x, y + TILE - 12, TILE, 1.5);
    c.fillStyle = 'rgba(40,25,15,.35)';
    c.fillRect(x + 6, y + TILE - 5, 8, 3);
    c.fillRect(x + 22, y + TILE - 5, 7, 3);
    if (th.groundMotif === 'snow' || th.groundMotif === 'ice') {
      c.fillStyle = '#ffffff'; c.fillRect(x, y + TILE - 13, TILE, 2);
    }
  } else if (t === T.GATE) {
    const g = gateAt(tx, ty);
    const open = gateOpen(g);
    c.fillStyle = '#3a3f4e';
    c.fillRect(x, y, TILE, TILE);
    c.fillStyle = '#5f6c80';
    c.fillRect(x + 3, y + 2, TILE - 6, TILE - 4);
    const accent = open ? '#8fe3a0' : (th.gate || '#e8c12c');
    c.strokeStyle = accent; c.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const bx = x + 6 + i * 8;
      c.beginPath(); c.moveTo(bx, y + 4); c.lineTo(bx, y + TILE - 4); c.stroke();
    }
    c.fillStyle = accent;
    circle(c, x + TILE / 2, y + TILE / 2, 5, open ? '#2f7d4f' : '#8a6a1a');
    c.fillStyle = '#fff';
    c.font = 'bold 9px sans-serif'; c.textAlign = 'center';
    c.fillText(open ? '✓' : String(g ? g.badges : 0), x + TILE / 2, y + TILE / 2 + 3);
    c.textAlign = 'left';
  }
}

function drawBuilding(c, b) {
  const x = b.x * TILE, y = b.y * TILE, w = b.w * TILE, h = b.h * TILE;
  const isCenter = b.type === 'center';
  const isGym = b.type === 'gym';
  const gymColor = b.gymId === 'cascade' ? '#4a90e2' : b.gymId === 'thunder' ? '#e8c12c'
    : b.gymId === 'forest' ? '#5cb85c' : b.gymId === 'blaze' ? '#f0723c'
    : b.gymId === 'frost' ? '#7fd4d0' : '#b09a4f';
  const gymDark  = b.gymId === 'cascade' ? '#2f6fa5' : b.gymId === 'thunder' ? '#b09a2c'
    : b.gymId === 'forest' ? '#3f8a42' : b.gymId === 'blaze' ? '#c04a1a'
    : b.gymId === 'frost' ? '#4a9a9a' : '#8f7a38';
  c.fillStyle = 'rgba(20,30,20,.25)';
  c.beginPath(); c.ellipse(x + w / 2, y + h, w / 2 + 4, 10, 0, 0, TAU); c.fill();
  // かべ
  c.fillStyle = isGym ? '#d8c8a8' : '#f2e0c2';
  c.fillRect(x, y + h * 0.42, w, h * 0.58);
  c.strokeStyle = isGym ? '#b09a78' : '#d8c0a0'; c.lineWidth = 2;
  c.strokeRect(x, y + h * 0.42, w, h * 0.58);
  // やね
  c.fillStyle = isCenter ? '#e85c6c' : isGym ? gymColor : '#5c8fd8';
  c.fillRect(x - 4, y + 4, w + 8, h * 0.44);
  c.fillStyle = isCenter ? '#c84858' : isGym ? gymDark : '#4870b5';
  c.fillRect(x - 4, y + 4 + h * 0.44 - 6, w + 8, 8);
  c.fillStyle = 'rgba(255,255,255,.25)';
  c.fillRect(x - 4, y + 6, w + 8, 5);
  // まど
  c.fillStyle = '#9fd4ee';
  for (const wx of [x + 10, x + w - 26]) c.fillRect(wx, y + h * 0.5, 16, 14);
  // とびら
  const dx = b.doorX * TILE, dy = b.doorY * TILE;
  c.fillStyle = '#6b4a2f';
  c.fillRect(dx + 4, dy + 4, TILE - 8, TILE - 6);
  c.fillStyle = '#8a6240';
  c.fillRect(dx + 6, dy + 6, TILE - 12, TILE - 10);
  circle(c, dx + TILE - 12, dy + TILE / 2, 2.2, '#ffd23e');
  // かんばん
  c.fillStyle = '#241a30';
  c.fillRect(x + w / 2 - 34, y + h * 0.44 - 12, 68, 14);
  c.fillStyle = '#fff';
  c.font = 'bold 9px sans-serif';
  c.textAlign = 'center';
  c.fillText(isCenter ? 'PACHI CENTER' : isGym ? 'PACHI GYM' : 'PACHI MART', x + w / 2, y + h * 0.44 - 2);
  if (isCenter) {
    c.fillStyle = '#e85c6c';
    c.fillRect(x + 6, y + 8, 5, 16);
    c.fillRect(x + 15, y + 8, 5, 16);
  }
  if (isGym) {
    c.fillStyle = '#fff';
    c.beginPath();
    c.moveTo(x + w / 2, y + 12);
    c.lineTo(x + w / 2 + 9, y + 28);
    c.lineTo(x + w / 2 - 9, y + 28);
    c.closePath(); c.fill();
    c.fillStyle = gymDark;
    c.beginPath();
    c.moveTo(x + w / 2, y + 17);
    c.lineTo(x + w / 2 + 5, y + 26);
    c.lineTo(x + w / 2 - 5, y + 26);
    c.closePath(); c.fill();
  }
  c.textAlign = 'left';
}

/* ============================================================
   ワールド ループ
   ============================================================ */
const worldCanvas = $('#world');
const wctx = worldCanvas.getContext('2d');
const player = {
  tx: START_POS.x, ty: START_POS.y, dir: 'down',
  px: START_POS.x * TILE + TILE / 2, py: START_POS.y * TILE + TILE / 2,
  moving: false, fromX: 0, fromY: 0, toX: 0, toY: 0, t: 0, walk: 0, lastStep: 0,
};
const cam = { x: 0, y: 0, tx: 0, ty: 0 };
const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const keys = new Set();
let worldLocked = () => battleActive || dialogOpen || modalOpen;

/* ---------- じてんしゃ ---------- */
function bikeOwned() { return (G.items.bicycle || 0) > 0; }
/* バッジ2こで じてんしゃを もらえる */
function grantBikeIfEligible() {
  if (G.badges.length < 2 || bikeOwned()) return false;
  G.items.bicycle = 1;
  return true;
}
function toggleBike(fromMenu = false) {
  if (!fromMenu && (G.screen !== 'world' || worldLocked())) return;
  if (!bikeOwned()) { toast('じてんしゃを まだ もっていない。'); Sfx.pop(); return; }
  G.bikeOn = !G.bikeOn;
  Sfx.click();
  syncBikeButton();
  toast(G.bikeOn ? 'じてんしゃに のった！ いどうが 1.5ばいに なった！' : 'じてんしゃから おりた。');
  saveGame(true);
}
function syncBikeButton() {
  const btn = $('#btn-bike');
  if (!btn) return;
  const owned = bikeOwned();
  btn.classList.toggle('hidden', !owned);
  if (!owned) return;
  btn.classList.toggle('btn-yellow', G.bikeOn);
  btn.classList.toggle('btn-blue', !G.bikeOn);
  const st = $('#bike-state');
  if (st) st.textContent = G.bikeOn ? 'おりる' : 'のる';
}

function resizeWorld() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  worldCanvas.width = Math.floor(worldCanvas.clientWidth * dpr);
  worldCanvas.height = Math.floor(worldCanvas.clientHeight * dpr);
  worldCanvas._dpr = dpr;
}
window.addEventListener('resize', resizeWorld);

function tryStep(dx, dy) {
  const dir = dx < 0 ? 'left' : dx > 0 ? 'right' : dy < 0 ? 'up' : 'down';
  player.dir = dir;
  const nx = player.tx + dx, ny = player.ty + dy;
  if (!inBounds(nx, ny)) { player.walk = 0; return; }
  const nt = map[ny][nx];
  if (map[player.ty][player.tx] === T.LEDGE && dy === -1) {
    if (Date.now() - gateNoticeAt > 900) {
      gateNoticeAt = Date.now();
      toast('段差は のぼれない。南へ おりよう。', 2000);
    }
    player.walk = 0; return;
  }
  if (nt === T.GATE) {
    const g = gateAt(nx, ny);
    if (!gateOpen(g)) {
      if (Date.now() - gateNoticeAt > 900) {
        gateNoticeAt = Date.now();
        toast(gateMessage(g), 2400);
        Sfx.pop();
      }
      player.walk = 0; return;
    }
  }
  if (nt === T.LEDGE && dy !== 1) {
    if (Date.now() - gateNoticeAt > 900) {
      gateNoticeAt = Date.now();
      toast('この 段差は 下にしか おりられない。', 2000);
    }
    player.walk = 0; return;
  }
  if (!walkable(nx, ny)) { player.walk = 0; return; }
  if (NPCS.some(n => n.x === nx && n.y === ny)) { player.walk = 0; return; }
  player.moving = true;
  player.fromX = player.tx; player.fromY = player.ty;
  player.toX = nx; player.toY = ny;
  player.t = 0;
  player.px = player.tx * TILE + TILE / 2;
  player.py = player.ty * TILE + TILE / 2;
}

function arriveTile() {
  player.tx = player.toX; player.ty = player.toY;
  player.px = player.tx * TILE + TILE / 2;
  player.py = player.ty * TILE + TILE / 2;
  player.moving = false; player.walk = 0;
  const zone = zoneAt(player.tx, player.ty);
  if (zone !== G.zone) {
    G.zone = zone;
    if (G.started) {
      const enc = ENCOUNTERS[zone];
      showZone(enc ? `${enc.name}  Lv${enc.level[0]}〜${enc.level[1]}` : zone);
      syncHUD();
    }
  }
  const t = map[player.ty][player.tx];
  if (G.started) {
    /* エンカウントは 草むら (TALL) の うえだけ */
    if (t === T.TALL) {
      if (Math.random() < 0.14) { triggerEncounter(); return; }
    }
    if (Math.random() < 0.008) saveGame(true);
  }
}

function updateWorld(dt) {
  if (G.screen !== 'world' || worldLocked()) { player.walk = 0; return; }
  if (player.moving) {
    const spd = 0.75 * (G.bikeOn ? 1.5 : 1);       /* じてんしゃで 1.5ばい */
    player.t += dt * spd / 145;
    player.walk = Math.min(1, player.t);
    if (player.t >= 1) { arriveTile(); }
    else {
      player.px = (player.fromX + (player.toX - player.fromX) * player.t) * TILE + TILE / 2;
      player.py = (player.fromY + (player.toY - player.fromY) * player.t) * TILE + TILE / 2;
    }
    return;
  }
  let dx = 0, dy = 0;
  if (keys.has('arrowleft') || keys.has('a')) dx = -1;
  else if (keys.has('arrowright') || keys.has('d')) dx = 1;
  else if (keys.has('arrowup') || keys.has('w')) dy = -1;
  else if (keys.has('arrowdown') || keys.has('s')) dy = 1;
  if (dx || dy) tryStep(dx, dy);
  else player.walk = 0;
}

/* ゾーンごとの 空気 (はなびら / ほたる / はい / ゆき など) */
function drawZoneAmbient(now, vx, vy, vw, vh) {
  const th = zoneTheme(G.zone);
  const amb = th.ambient;
  if (!amb || amb === 'none') return;
  const t = now / 1000;
  const count = amb === 'snow' ? 54 : amb === 'fireflies' ? 30 : amb === 'embers' ? 34 : 26;
  wctx.save();
  for (let i = 0; i < count; i++) {
    const r1 = hash(i * 13 + 1, i * 7 + 3);
    const r2 = hash(i * 5 + 9, i * 17 + 2);
    const r3 = hash(i * 23 + 5, i * 11 + 13);
    let px, py, sp, sz, a;
    if (amb === 'snow') {
      sp = 16 + r3 * 26;
      px = vx + ((r1 * vw + t * (8 + r3 * 10)) % vw);
      py = vy + ((r2 * vh + t * sp) % vh);
      sz = 1.2 + r3 * 2.2; a = 0.45 + r2 * 0.4;
      wctx.fillStyle = `rgba(255,255,255,${a})`;
      wctx.beginPath(); wctx.arc(px, py, sz, 0, TAU); wctx.fill();
    } else if (amb === 'embers') {
      sp = 12 + r3 * 18;
      px = vx + ((r1 * vw + Math.sin(t * 0.8 + i) * 16 + vw) % vw);
      py = vy + vh - ((r2 * vh + t * sp) % vh);
      sz = 1.5 + r3 * 2.4; a = 0.4 + 0.4 * Math.sin(t * 4 + i);
      wctx.fillStyle = `rgba(255,${120 + Math.floor(r3 * 80)},60,${a})`;
      wctx.beginPath(); wctx.arc(px, py, sz, 0, TAU); wctx.fill();
      wctx.fillStyle = `rgba(255,230,140,${a * 0.7})`;
      wctx.beginPath(); wctx.arc(px, py, sz * 0.45, 0, TAU); wctx.fill();
    } else if (amb === 'fireflies' || amb === 'spores' || amb === 'goldmotes' || amb === 'dustspark') {
      const glow = amb === 'fireflies' ? [180, 255, 130] : amb === 'spores' ? [120, 255, 220]
        : amb === 'goldmotes' ? [255, 220, 110] : [255, 210, 130];
      px = vx + ((r1 * vw + Math.sin(t * 0.45 + i * 1.7) * 26 + vw) % vw);
      py = vy + ((r2 * vh + Math.cos(t * 0.55 + i * 1.3) * 20 + vh) % vh);
      sz = 1.2 + r3 * 2.2; a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2.2 + i * 0.9));
      wctx.fillStyle = `rgba(${glow[0]},${glow[1]},${glow[2]},${a})`;
      wctx.beginPath(); wctx.arc(px, py, sz * 2.4, 0, TAU); wctx.fill();
      wctx.fillStyle = `rgba(255,255,255,${a})`;
      wctx.beginPath(); wctx.arc(px, py, sz * 0.75, 0, TAU); wctx.fill();
    } else if (amb === 'petals' || amb === 'leaves') {
      sp = 12 + r3 * 16;
      px = vx + ((r1 * vw + t * (12 + r3 * 14)) % vw);
      py = vy + ((r2 * vh + t * sp) % vh);
      sz = amb === 'leaves' ? 3 : 2.4; a = 0.45 + r3 * 0.35;
      wctx.save();
      wctx.translate(px, py); wctx.rotate(t * 1.2 + i);
      wctx.fillStyle = amb === 'leaves' ? `rgba(140,210,100,${a})` : `rgba(255,${170 + Math.floor(r3 * 60)},210,${a})`;
      wctx.beginPath(); wctx.ellipse(0, 0, sz * 1.6, sz * 0.8, 0, 0, TAU); wctx.fill();
      wctx.restore();
    } else if (amb === 'sand' || amb === 'dust') {
      sp = 24 + r3 * 34;
      px = vx + ((r1 * vw + t * sp) % vw);
      py = vy + ((r2 * vh + Math.sin(t + i) * 8 + vh) % vh);
      wctx.strokeStyle = amb === 'sand' ? `rgba(255,220,150,${0.18 + r3 * 0.22})` : `rgba(210,190,150,${0.16 + r3 * 0.18})`;
      wctx.lineWidth = 1.4;
      wctx.beginPath(); wctx.moveTo(px, py); wctx.lineTo(px + 10 + r3 * 12, py + 1); wctx.stroke();
    } else if (amb === 'sparks') {
      if (r3 < 0.35) continue;
      px = vx + ((r1 * vw + t * 20) % vw);
      py = vy + ((r2 * vh + Math.sin(t * 3 + i * 2) * 12 + vh) % vh);
      const flash = 0.25 + 0.7 * Math.max(0, Math.sin(t * 6 + i * 2.3));
      wctx.strokeStyle = `rgba(255,240,110,${flash})`; wctx.lineWidth = 1.6;
      wctx.beginPath(); wctx.moveTo(px, py);
      wctx.lineTo(px - 4, py + 6); wctx.lineTo(px + 2, py + 6); wctx.lineTo(px - 2, py + 13); wctx.stroke();
    } else if (amb === 'seabreeze') {
      px = vx + ((r1 * vw + t * (24 + r3 * 20)) % vw);
      py = vy + ((r2 * vh + Math.sin(t * 0.6 + i) * 12 + vh) % vh);
      wctx.strokeStyle = `rgba(255,255,255,${0.12 + r3 * 0.2})`; wctx.lineWidth = 1.6;
      wctx.beginPath(); wctx.moveTo(px, py); wctx.quadraticCurveTo(px + 12, py - 4, px + 24, py); wctx.stroke();
    } else if (amb === 'spray') {
      px = vx + ((r1 * vw + Math.sin(t + i) * 10 + vw) % vw);
      py = vy + ((r2 * vh - t * (8 + r3 * 10) + vh * 2) % vh);
      wctx.fillStyle = `rgba(210,250,255,${0.2 + r3 * 0.3})`;
      wctx.beginPath(); wctx.arc(px, py, 1.2 + r3 * 2, 0, TAU); wctx.fill();
    } else if (amb === 'dragonfly') {
      px = vx + ((r1 * vw + Math.sin(t * 1.4 + i) * 34 + vw) % vw);
      py = vy + ((r2 * vh + Math.cos(t * 1.1 + i * 1.7) * 26 + vh) % vh);
      wctx.strokeStyle = `rgba(150,240,255,${0.3 + r3 * 0.3})`; wctx.lineWidth = 1.4;
      wctx.beginPath(); wctx.moveTo(px, py); wctx.lineTo(px + 5, py - 2); wctx.moveTo(px, py); wctx.lineTo(px - 5, py - 2); wctx.stroke();
    }
  }
  wctx.restore();
}

function renderWorld(now) {
  const dpr = worldCanvas._dpr || 1;
  const cw = worldCanvas.width / dpr, ch = worldCanvas.height / dpr;
  const scale = clamp(Math.max(cw / (TILE * 24), ch / (TILE * 18)), 1, 2.2);
  const vw = cw / scale, vh = ch / scale;
  const worldW = MAP_W * TILE, worldH = MAP_H * TILE;
  const targetX = clamp(player.px - vw / 2, 0, Math.max(0, worldW - vw));
  const targetY = clamp(player.py - vh / 2 - TILE * 0.5, 0, Math.max(0, worldH - vh));
  cam.x += (targetX - cam.x) * 0.14;
  cam.y += (targetY - cam.y) * 0.14;
  if (Math.abs(targetX - cam.x) < 0.3) cam.x = targetX;
  if (Math.abs(targetY - cam.y) < 0.3) cam.y = targetY;

  wctx.setTransform(1, 0, 0, 1, 0, 0);
  wctx.clearRect(0, 0, worldCanvas.width, worldCanvas.height);
  wctx.setTransform(dpr * scale, 0, 0, dpr * scale, -cam.x * dpr * scale, -cam.y * dpr * scale);
  wctx.imageSmoothingEnabled = false;

  const ccx0 = Math.max(0, Math.floor(cam.x / (TILE * CHUNK)));
  const ccy0 = Math.max(0, Math.floor(cam.y / (TILE * CHUNK)));
  const ccx1 = Math.min(Math.ceil(MAP_W / CHUNK) - 1, Math.floor((cam.x + vw) / (TILE * CHUNK)));
  const ccy1 = Math.min(Math.ceil(MAP_H / CHUNK) - 1, Math.floor((cam.y + vh) / (TILE * CHUNK)));
  for (let cy = ccy0; cy <= ccy1; cy++) {
    for (let cx = ccx0; cx <= ccx1; cx++) {
      wctx.drawImage(getTerrainChunk(cx, cy), cx * CHUNK * TILE, cy * CHUNK * TILE);
    }
  }

  /* みずの なみ */
  const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1), x1 = Math.min(MAP_W, Math.ceil((cam.x + vw) / TILE) + 1);
  const y0 = Math.max(0, Math.floor(cam.y / TILE) - 1), y1 = Math.min(MAP_H, Math.ceil((cam.y + vh) / TILE) + 1);
  wctx.strokeStyle = 'rgba(255,255,255,.35)';
  wctx.lineWidth = 2; wctx.lineCap = 'round';
  for (let ty = y0; ty < y1; ty++) for (let tx = x0; tx < x1; tx++) {
    if (map[ty][tx] !== T.WATER) continue;
    const ph = now / 700 + tx * 0.7 + ty * 1.3;
    const ox = Math.sin(ph) * 5, oy = Math.cos(ph * 0.8) * 2;
    wctx.beginPath();
    wctx.moveTo(tx * TILE + 8 + ox, ty * TILE + 18 + oy);
    wctx.lineTo(tx * TILE + 22 + ox, ty * TILE + 18 + oy);
    wctx.stroke();
  }

  /* NPC */
  for (const n of NPCS) {
    const nx = n.x * TILE + TILE / 2, ny = n.y * TILE + TILE * 0.8;
    if (nx < cam.x - TILE || nx > cam.x + vw + TILE || ny < cam.y - TILE || ny > cam.y + vh + TILE) continue;
    drawTrainerSprite(wctx, nx, ny, 'down', 0, n.colors);
    const defeated = n.trainer ? !!G.flags['trainer_' + n.trainer] : true;
    if (n.trainer && !defeated) {
      const bounce = Math.sin(now / 260) * 3;
      wctx.fillStyle = '#fff';
      wctx.beginPath(); wctx.roundRect(nx - 7, ny - 64 + bounce, 14, 18, 5); wctx.fill();
      wctx.fillStyle = '#e8523c';
      wctx.font = 'bold 14px sans-serif'; wctx.textAlign = 'center';
      wctx.fillText('!', nx, ny - 51 + bounce);
      wctx.textAlign = 'left';
    }
  }

  /* かくしアイテムの きらめき */
  for (const h of HIDDEN_ITEMS) {
    if (G.flags['hidden_' + h.x + '_' + h.y]) continue;
    const hx = h.x * TILE + TILE / 2, hy = h.y * TILE + TILE / 2;
    if (hx < cam.x - TILE || hx > cam.x + vw + TILE || hy < cam.y - TILE || hy > cam.y + vh + TILE) continue;
    const tw = (Math.sin(now / 320 + h.x * 2 + h.y) + 1) / 2;
    wctx.save();
    wctx.globalAlpha = 0.35 + tw * 0.55;
    wctx.fillStyle = '#fff6b0';
    const s = 3 + tw * 2.5;
    wctx.beginPath();
    wctx.moveTo(hx, hy - s); wctx.lineTo(hx + s, hy); wctx.lineTo(hx, hy + s); wctx.lineTo(hx - s, hy);
    wctx.closePath(); wctx.fill();
    wctx.restore();
  }

  /* プレイヤー */
  const walkPhase = player.moving ? player.walk : 0;
  drawTrainerSprite(wctx, player.px, player.py + TILE * 0.32, player.dir, walkPhase, PLAYER_LOOK);

  /* 草むらで がさがさ */
  if (map[player.ty] && map[player.ty][player.tx] === T.TALL) {
    wctx.strokeStyle = '#2f6b36'; wctx.lineWidth = 3; wctx.lineCap = 'round';
    const px = player.px, py = player.py + TILE * 0.32;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + now / 300;
      const bx = px + Math.cos(a) * 16, by = py + Math.sin(a) * 5 - 6;
      wctx.beginPath();
      wctx.moveTo(bx, by + 8);
      wctx.lineTo(bx + Math.sin(now / 150 + i) * 3, by - 6);
      wctx.stroke();
    }
  }

  /* ゾーンごとの 空気 (雪 / ほたる / 火のこ / はなびら など) */
  drawZoneAmbient(now, cam.x, cam.y, vw, vh);
}

/* ---------------- メイン ループ ---------------- */
let lastFrame = performance.now();
function loop(now) {
  const dt = Math.min(50, now - lastFrame);
  lastFrame = now;
  if (G.screen === 'world') {
    if (G.started) G.playTime += dt / 1000;
    updateWorld(dt);
    renderWorld(now);
  }
  if (G.screen === 'title' || G.screen === 'intro') {
    $$('.tsp').forEach(cv => paintThumb(cv));
    if (G.screen === 'intro') {
      const pc = $('#prof-canvas');
      if (pc) {
        const c = pc.getContext('2d');
        c.clearRect(0, 0, pc.width, pc.height);
        drawTrainerSprite(c, pc.width / 2, pc.height - 8, 'down', 0, { cap:'#8f8f9e', jacket:'#5f5f7e', pack:'#e8e8f0', skin:'#ffe0c2', hair:'#c8c8d4' }, { scale: 2.4 });
      }
    }
  }
  requestAnimationFrame(loop);
}

/* ============================================================
   入力
   ============================================================ */
/* ---- キーボード フォーカス ナビゲーション ---- */
let lastFocusBeforeModal = null;

function isVisibleEl(el) {
  if (!el) return false;
  const st = getComputedStyle(el);
  if (st.display === 'none' || st.visibility === 'hidden') return false;
  return el.getClientRects().length > 0;
}
function focusables(root) {
  if (!root) return [];
  return [...root.querySelectorAll('button, [href], input, select, textarea, [tabindex]')]
    .filter(el => !el.disabled && el.getAttribute('tabindex') !== '-1' && isVisibleEl(el));
}
function getScope() {
  if (dialogOpen) return $('#dialog-layer');
  if (modalOpen) return $('#modal');
  if (G.screen === 'battle') return $('#battle-screen');
  if (G.screen === 'intro') return $('#intro-screen');
  if (G.screen === 'title') return $('#title-screen');
  return document.body;
}
function focusFirst(root) {
  const list = focusables(root);
  if (!list.length) return false;
  try { list[0].focus({ preventScroll: true }); } catch (e) { list[0].focus(); }
  return true;
}
/* ほうこう キーで いちばん ちかい 要素へ フォーカスを うつす */
function moveFocus(dir) {
  const list = focusables(getScope());
  if (!list.length) return;
  const cur = document.activeElement;
  if (!cur || !list.includes(cur)) { focusFirst(getScope()); return; }
  const cr = cur.getBoundingClientRect();
  const cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
  let best = null, bestScore = Infinity;
  for (const el of list) {
    if (el === cur) continue;
    const r = el.getBoundingClientRect();
    const dx = (r.left + r.width / 2) - cx;
    const dy = (r.top + r.height / 2) - cy;
    let ok = false, primary = 0, perp = 0;
    if (dir === 'arrowright') { ok = dx > 6; primary = dx; perp = Math.abs(dy); }
    else if (dir === 'arrowleft') { ok = dx < -6; primary = -dx; perp = Math.abs(dy); }
    else if (dir === 'arrowdown') { ok = dy > 6; primary = dy; perp = Math.abs(dx); }
    else if (dir === 'arrowup') { ok = dy < -6; primary = -dy; perp = Math.abs(dx); }
    if (!ok) continue;
    const score = primary + perp * 1.7;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) {
    try { best.focus(); } catch (e) {}
  }
}
function trapFocus(e) {
  const list = focusables($('#modal'));
  if (!list.length) return;
  const first = list[0], last = list[list.length - 1];
  const cur = document.activeElement;
  if (!list.includes(cur)) { e.preventDefault(); first.focus(); return; }
  if (e.shiftKey && cur === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && cur === last) { e.preventDefault(); first.focus(); }
}
function focusScreenDefault(name) {
  if (name === 'world') {
    const a = document.activeElement;
    if (a && a !== document.body && a.blur) a.blur();
    return;
  }
  setTimeout(() => {
    if (G.screen !== name || modalOpen || dialogOpen) return;
    focusFirst(getScope());
  }, 0);
}

/* キーボード そうさ ちゅう は フォーカス わくを つねに 表示 */
window.addEventListener('keydown', () => document.body.classList.add('kbd-nav'), true);
window.addEventListener('pointerdown', () => document.body.classList.remove('kbd-nav'), true);

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  const isArrow = k === 'arrowup' || k === 'arrowdown' || k === 'arrowleft' || k === 'arrowright';

  /* キーリピートで れんぞく はつどう しない (Enter ながおし たいさく) */
  if (e.repeat) {
    if (isArrow || k === 'enter' || k === ' ' || k === 'e' || k === 'tab') e.preventDefault();
    return;
  }

  if (dialogOpen) {
    if (isArrow || k === 'tab') e.preventDefault();
    if (k === 'enter' || k === ' ' || k === 'e') { e.preventDefault(); advanceDialog(); }
    return;
  }
  if (modalOpen) {
    if (k === 'escape' || k === 'm') { e.preventDefault(); if (!modalLocked) closeModal(); return; }
    if (k === 'n' && worldMapVisible) { e.preventDefault(); if (!modalLocked) closeModal(); return; }
    if (k === 'tab') { trapFocus(e); return; }
    if (isArrow) { e.preventDefault(); moveFocus(k); }
    return;
  }
  /* タイトル / イントロ / バトル は フォーカス移動 */
  if (G.screen === 'title' && k === 'escape' && !$('#slot-picker').classList.contains('hidden')) {
    e.preventDefault(); closeSlotPicker(); return;
  }
  if (G.screen !== 'world' || battleActive) {
    if (isArrow) { e.preventDefault(); moveFocus(k); }
    return;
  }

  /* ワールド */
  const active = document.activeElement;
  if (isArrow) { e.preventDefault(); keys.add(k); return; }
  if (k === 'm') { e.preventDefault(); openMenu(); return; }
  if (k === 'n') { e.preventDefault(); openWorldMap(); return; }
  if (k === 'b') { e.preventDefault(); toggleBike(); return; }
  if (k === 'enter' || k === ' ' || k === 'e') {
    /* ワールドでは Enter / Space / E は つねに「しらべる」。
       HUD の ボタンに フォーカスが のこっていても、
       ブラウザの ネイティブ クリックに じゃまされないようにする。 */
    e.preventDefault();
    if (active && active !== document.body && active.blur) active.blur();
    interact();
    return;
  }
  keys.add(k);
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

/* tabindex つき div を Enter / Space で はっか */
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  if (e.repeat) { e.preventDefault(); return; }
  const el = document.activeElement;
  if (el && el.hasAttribute && el.hasAttribute('data-kbd')) {
    e.preventDefault();
    e.stopPropagation();
    el.click();
  }
}, true);

/* タッチ */
const touchDir = { x: 0, y: 0 };
function bindPad() {
  const pad = $('#pad');
  if (!pad) return;
  $$('.dp').forEach(b => {
    const dir = b.dataset.dir;
    const on = ev => { ev.preventDefault(); const [dx, dy] = DIRV[dir]; touchDir.x = dx; touchDir.y = dy; keys.add('pad_' + dir); };
    const off = () => { touchDir.x = 0; touchDir.y = 0; keys.delete('pad_' + dir); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointerleave', off);
    b.addEventListener('pointercancel', off);
  });
  $('#btn-a').addEventListener('click', () => { if (dialogOpen) advanceDialog(); else interact(); });
  $('#btn-b').addEventListener('click', () => { if (modalOpen) closeModal(); else openMenu(); });
}
function isTouchDevice() { return window.matchMedia('(pointer:coarse)').matches; }

/* ============================================================
   はなし ボックス
   ============================================================ */
let dialogOpen = false, dialogResolve = null, dialogDone = false, dialogTimer = null;

function dialog(text, name = '') {
  return new Promise(resolve => {
    dialogOpen = true; dialogDone = false;
    const layer = $('#dialog-layer'), box = $('.dialog-box');
    layer.classList.remove('hidden');
    try { box.focus({ preventScroll: true }); } catch (e) { box.focus(); }
    const nameEl = $('#dialog-name');
    if (name) { nameEl.textContent = name; nameEl.style.display = 'inline-block'; }
    else nameEl.style.display = 'none';
    const el = $('#dialog-text');
    el.textContent = '';
    $('.dialog-next').style.visibility = 'hidden';
    let i = 0;
    clearInterval(dialogTimer);
    dialogTimer = setInterval(() => {
      i++;
      el.textContent = text.slice(0, i);
      if (i % 3 === 0) Sfx.play(1200, 0.015, 'square', 0.012);
      if (i >= text.length) finishType();
    }, 26);
    function finishType() {
      clearInterval(dialogTimer); dialogTimer = null;
      el.textContent = text;
      dialogDone = true;
      $('.dialog-next').style.visibility = 'visible';
    }
    dialogResolve = () => {
      if (!dialogDone) { finishType(); return; }
      layer.classList.add('hidden');
      if (document.activeElement === box) box.blur();
      dialogOpen = false; dialogResolve = null;
      resolve();
    };
    box.onclick = () => dialogResolve && dialogResolve();
  });
}
function advanceDialog() { if (dialogResolve) dialogResolve(); }

/* ============================================================
   こうどう (はなす・しらべる)
   ============================================================ */
async function interact() {
  if (worldLocked() || G.screen !== 'world') return;
  const [dx, dy] = DIRV[player.dir];
  const tx = player.tx + dx, ty = player.ty + dy;
  const npc = NPCS.find(n => n.x === tx && n.y === ty);
  if (npc) { talkToNpc(npc); return; }

  const hidden = HIDDEN_ITEMS.find(h => h.x === tx && h.y === ty && !G.flags['hidden_' + tx + '_' + ty]);
  if (hidden) {
    const it = ITEMS[hidden.item];
    G.flags['hidden_' + tx + '_' + ty] = true;
    G.items[hidden.item] = (G.items[hidden.item] || 0) + 1;
    Sfx.catchOk();
    await dialog(`なにか おちている！ ${it.name}を みつけた！`);
    saveGame(true);
    return;
  }

  const sign = SIGNS.find(s => s.x === tx && s.y === ty);
  if (sign) { await dialog(sign.text, 'かんばん'); return; }

  const t = map[ty] ? map[ty][tx] : null;
  if (t === T.GATE) {
    const g = gateAt(tx, ty);
    if (gateOpen(g)) await dialog(`${g.name}。バッジを かくにんした。とおって いい。`, 'ゲート');
    else await dialog(gateMessage(g), 'ゲート');
  } else if (t === T.LEDGE) {
    await dialog('こみちの 段差だ。南へ おりる ことしか できない。');
  } else if (t === T.DOOR) {
    const b = BUILDINGS.find(b => b.doorX === tx && b.doorY === ty);
    if (b) enterBuilding(b);
  } else if (t === T.TALL) {
    await dialog('ざぁ… 草むらが ざわめいている。パチモンが かくれていそうだ。');
  } else if (t === T.WATER) {
    if ((G.items.oldrod || 0) > 0) await tryFish();
    else await dialog('きれいな みずだ。パチモンが およいでいる かもしれない。つりざおが あれば つれそうだ。');
  } else if (t === T.TREE) {
    await dialog('あっという間に きりかぶだった きが そばたっている…。');
  }
}

/* ---------------- つり ---------------- */
let fishing = false;
async function tryFish() {
  if (fishing || battleActive) return;
  fishing = true;
  try {
    Sfx.click();
    await dialog('つりざおを たおして… ぽちゃん。');
    await wait(650);
    const zone = zoneAt(player.tx, player.ty);
    const enc = WATER_ENCOUNTERS[zone] || WATER_ENCOUNTERS.field;
    if (Math.random() < 0.28) {
      await dialog('… あたりは しずかだ。つれなかった。');
      return;
    }
    await dialog('あたりだ！ ひきあげろ！');
    Sfx.pop();
    await wait(300);
    const speciesId = weightedPick(enc.table);
    const level = ri(enc.level[0], enc.level[1]);
    await startBattle(makeMon(speciesId, level), { fishing: true });
  } finally {
    /* エラーや 予期しない 中断が あっても、つぎの Enter で
       つりざおが うごかなく ならないように かならず もどす。 */
    fishing = false;
  }
}

const GUIDE_LINES = {
  guide1: 'ここは はじまりの町。まず 北の ざわめきの森を ぬけて、北西の ガレキ山脈の ジムを めざそう。',
  guide2: 'ここは 山の ふもと。この さきの いわのジムで 1つめの バッジを とったら、南の なぎさ街道へ もどろう。',
  guide3: 'なぎさ街道は 長い 一本道。東へ すすむと みなと町と しずくのジムが あるよ。',
  guide4: 'みなと町へ ようこそ。しずくの バッジを とったら、西の 深森ゲートを とおって こだまの深森へ。',
  guide5: 'こだまの深森は 木の トンネルみたい。北の しんりょくのジムで 3つめの バッジを とろう。',
  guide6: 'ここは 深森と かざんを むすぶ 長い 陸桥。東へ いくと かざんの いただきと ほのおのジムだ。',
  guide7: 'かざんの いただきは あつい！ 4つめの バッジを とったら、北の 細い 道を のぼって かみなり台地へ。',
  guide8: 'かみなり台地の ジムは 5つめ。ライデンを たおしたら、東の こおりゲートを わたろう。',
  guide9: 'こおりの さかみちは つるつる。6つめの バッジを とったら、南西の チャンピオンゲートへ。',
  guide10: 'この さきが チャンピオンロード。6つの バッジを もつ ものだけが、パチローと たたかえる。',
};

async function talkToNpc(npc) {
  player.walk = 0;

  if (npc.gate) {
    if (G.badges.length >= 6) {
      if (!G.flags.gate_open) {
        G.flags.gate_open = true;
        applyNpcState();
        Sfx.levelup();
        await dialog('6つの バッジを かくにんした。チャンピオンロードへ とおって いいぞ！', npc.name);
        saveGame(true);
      } else {
        await dialog('チャンピオンロードは この さきだ。ライバルの パチローが まっている。', npc.name);
      }
    } else {
      await dialog(`ここから さきは チャンピオンロード。バッジが 6こ ないと とおせない。いまは ${G.badges.length}こだ。`, npc.name);
    }
    return;
  }

  if (npc.guide) {
    const obj = currentObjective();
    await dialog(GUIDE_LINES[npc.id] || 'この しまの みちを あんない するよ。', npc.name);
    await dialog(`いまの もくてき: ${obj.title}。${obj.text}`, npc.name);
    return;
  }

  if (npc.trainer) {
    const def = TRAINERS[npc.trainer];
    const beaten = !!G.flags['trainer_' + npc.trainer];
    if (!beaten) {
      if (npc.requiresBadges && G.badges.length < npc.requiresBadges) {
        await dialog(`よくきた。だが、バッジが ${npc.requiresBadges}こ ないと しょうぶ できない。いまは ${G.badges.length}こだ。`, def.name);
        return;
      }
      await dialog(def.pre, def.name);
      await startTrainerBattle(npc.trainer);
    } else {
      await dialog(def.after, def.name);
      if (npc.id === 'fisher' && !G.flags.fisher_rod) {
        G.flags.fisher_rod = true;
        G.items.oldrod = (G.items.oldrod || 0) + 1;
        Sfx.catchOk();
        await dialog('そうだ、おれの つりざおを やるよ！ みずの まえで しらべてみな。', def.name);
        saveGame(true);
      }
    }
    return;
  }
  if (npc.id === 'prof') {
    await dialog('パチモンの せかいへ ようこそ！ ここは 「パチもん とう」だ。', 'ハカセ');
    await dialog('この しまには 6つの ジムが ある。北西の ガレキ山脈から はじめて、バッジを 1つずつ あつめるんだ。', 'ハカセ');
    await dialog('バッジが たりないと ゲートは ひらかない。レベルを あげて、みちを ひとつずつ ひらこう。', 'ハカセ');
    await dialog('6つの バッジを そろえたら、中央の チャンピオンロードで ライバルの パチローと しょうぶだ。', 'ハカセ');
    await dialog('そろそろ パチローが きた。きをつけて たびに出るんだぞ！', 'ハカセ');
    return;
  }
  if (npc.id === 'kid') {
    await dialog('ぼく、パチモン マスターに なるんだ！…って いってたら まえの にんじゃ みんな いなくなった。', 'ぼうや');
    await dialog('あのね、でんきタイプは みずと ひこうに よく きくんだよ。ぼく しってるもん。', 'ぼうや');
    return;
  }
  await dialog('…', npc.name);
}

/* セーブ データに あわせて NPC の いちを なおす */
function applyNpcState() {
  /* ゲートは バッジ数で ひらくため、NPCの いどうは ない */
}

async function enterBuilding(b) {
  Sfx.click();
  if (b.type === 'center') {
    await dialog('いらっしゃいませ！ パチモンセンターへ ようこそ！', 'じょうむいん');
    await wait(200);
    await healPartyFull();
    /* ここが さいごに つかった センター。ぜんめつ したら ここへ もどる */
    G.lastCenter = { x: b.doorX, y: b.doorY + 1, name: b.name };
    await dialog('パチモンたちの キズが なおって、げんきに なりました！ また どうぞ！', 'じょうむいん');
    saveGame(true);
  } else if (b.type === 'gym') {
    const bd = b.gymId ? BADGES[b.gymId] : null;
    const gymLeaderMap = {
      rock: 'gymleader',
      cascade: 'gymleader2',
      forest: 'gymleader3',
      blaze: 'gymleader4',
      thunder: 'gymleader5',
      frost: 'gymleader6'
    };
    const leaderId = gymLeaderMap[b.gymId] || 'gymleader';
    if (bd && G.badges.includes(b.gymId)) {
      await dialog(`${b.name}の なかは しずかだ。${bd.name}が かがやいている。`, 'かんばん');
    } else {
      await startTrainerBattle(leaderId);
    }
  } else {
    await dialog('パチマートへ ようこそ！ ゆっくり みていってね！', 'みせのひと');
    openShop();
  }
}
async function healPartyFull() {
  for (const m of G.party) {
    m.hp = m.maxHp; m.status = null; m.sleepTurns = 0;
    for (const mv of m.moves) mv.pp = MOVES[mv.id].pp;
  }
  Sfx.heal();
  syncHUD();
}

/* ============================================================
   エンカウント / トレーナー
   ============================================================ */
async function triggerEncounter(override) {
  if (battleActive) return;
  const zone = zoneAt(player.tx, player.ty);
  const enc = ENCOUNTERS[zone] || ENCOUNTERS.field;
  const table = override && override.table ? override.table : enc.table;
  const lv = override && override.level ? override.level : enc.level;
  const speciesId = weightedPick(table);
  const level = ri(lv[0], lv[1]);
  const mon = makeMon(speciesId, level);
  await startBattle(mon, {});
}

async function startTrainerBattle(trainerId) {
  const def = TRAINERS[trainerId];
  const team = def.team.map(([sp, lv]) => makeMon(sp, lv));
  await startBattle(team[0], { trainerId, team });
}

function currentZoneName() { return (ENCOUNTERS[G.zone] || ENCOUNTERS.field).name; }

/* ============================================================
   ガイド / 全体マップ
   ============================================================ */
function currentObjective() {
  const badges = G.badges;
  const mp = (x, y) => ({ x: Math.round(x * MAP_SCALE), y: Math.round(y * MAP_SCALE) });
  if (G.flags.trainer_rival) {
    return {
      key: 'done', title: 'パチモン マスター！',
      text: '6つの バッジと ライバルを きわめた。しまを まったり たんけん しよう。',
      target: null,
    };
  }
  const steps = [
    { key:'rock', badge:'rock', title:'いわのバッジを とる', target:mp(44,30),
      text:'はじまりの町から 北の ざわめきの森を ぬけ、北西の ガレキ山脈へ。ジムリーダー ガンゴロウが まっている。' },
    { key:'cascade', badge:'cascade', title:'しずくのバッジを とる', target:mp(132,114),
      text:'南の なぎさ街道を 東へ。みなと町の しずくのジムで ウズミが まっている。バッジ1こで ゲートが ひらく。' },
    { key:'forest', badge:'forest', title:'しんりょくの バッジを とる', target:mp(68,78),
      text:'みなと町の 西にある 深森ゲートを とおって こだまの深森へ。モリーヌの しんりょくのジムだ。' },
    { key:'blaze', badge:'blaze', title:'ほのおの バッジを とる', target:mp(136,70),
      text:'深森の 東の 長い 陸桥を わたって かざんの いただきへ。カエンジの ほのおのジムだ。' },
    { key:'thunder', badge:'thunder', title:'いなずまの バッジを とる', target:mp(98,20),
      text:'かざんの 北の 細い 山道を のぼって かみなり台地へ。ライデンの いなずまのジムだ。' },
    { key:'frost', badge:'frost', title:'こおりの バッジを とる', target:mp(152,22),
      text:'かみなり台地の 東の こおりゲートを わたって こおりの さかみちへ。ヒョウガの こおりのジムだ。' },
    { key:'rival', badge:null, title:'ライバル パチローを たおす', target:mp(102,60),
      text:'6つの バッジを そろえたら、こおりの さかみちから 南西の チャンピオンゲートへ。中央の チャンピオンロードで パチローが まつ。' },
  ];
  for (const s of steps) {
    if (s.badge && !badges.includes(s.badge)) {
      return { key:s.key, title:s.title, text:s.text, target:s.target };
    }
  }
  return { key:'rival', title:steps[6].title, text:steps[6].text, target:steps[6].target };
}

function guideSteps() {
  return [
    { done: G.badges.includes('rock'),    label:'いわの バッジ',    hint:'ガレキ山脈の ジム / ガンゴロウ（Lv27〜31）' },
    { done: G.badges.includes('cascade'), label:'しずくの バッジ',  hint:'みなと町の ジム / ウズミ（Lv36〜40）' },
    { done: G.badges.includes('forest'),  label:'しんりょくの バッジ', hint:'こだまの深森の ジム / モリーヌ（Lv45〜49）' },
    { done: G.badges.includes('blaze'),   label:'ほのおの バッジ',  hint:'かざんの いただきの ジム / カエンジ（Lv53〜58）' },
    { done: G.badges.includes('thunder'), label:'いなずまの バッジ', hint:'かみなり台地の ジム / ライデン（Lv62〜66）' },
    { done: G.badges.includes('frost'),   label:'こおりの バッジ',  hint:'こおりの さかみちの ジム / ヒョウガ（Lv68〜72）' },
    { done: !!G.flags.trainer_rival,      label:'ライバル パチロー', hint:'チャンピオンロード / バッジ6こ〜（Lv76〜82）' },
  ];
}

function openWorldMap() {
  if (battleActive || dialogOpen) return;
  Sfx.click();
  openModal('全体マップ', `
    <div class="worldmap-wrap"><canvas id="worldmap-canvas" width="760" height="652"></canvas></div>
    <div class="worldmap-legend">
      <span><i class="wm-dot" style="background:#ffd23e"></i>いまの ばしょ</span>
      <span><i class="wm-dot" style="background:#ff8a5c"></i>もくてき</span>
      <span>🔒 バッジゲート</span>
      <span>⛰ いわ</span><span>💧 しずく</span><span>🌿 しんりょく</span>
      <span>🔥 ほのお</span><span>⚡ いなずま</span><span>❄ こおり</span>
      <span>🚩 ライバル</span>
    </div>
    <p class="worldmap-note">オレンジの わくが いまの もくてき。🔒の ゲートは ひらく バッジ数が ちがうよ。みちを たどって すすもう。Nキーで とじられる。</p>
  `, { tabs: false, locked: false });
  worldMapVisible = true;
  setTimeout(() => {
    const cv = $('#worldmap-canvas');
    if (cv) drawWorldMap(cv);
  }, 0);
}

function drawWorldMap(cv) {
  const c = cv.getContext('2d');
  const S = cv.width / MAP_W;
  const colors = {
    [T.GRASS]: '#6ab35c', [T.TALL]: '#3f8a45', [T.TREE]: '#2f7d4f',
    [T.WATER]: '#1f4a6e', [T.PATH]: '#d9c08e', [T.ROCKY]: '#9b958d',
    [T.FLOWER]: '#8fcf7a', [T.BOULDER]: '#6e6a62', [T.WALL]: '#3a457e',
    [T.DOOR]: '#ffd23e', [T.SAND]: '#ead9a8', [T.SIGN]: '#b07a4a',
    [T.LEDGE]: '#b08a5c', [T.GATE]: '#ff8a5c', [T.SNOW]: '#dff0fa',
    [T.VOLCANIC]: '#9a7666',
  };
  c.fillStyle = '#08122a';
  c.fillRect(0, 0, cv.width, cv.height);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    c.fillStyle = colors[map[y][x]] || '#000';
    c.fillRect(Math.floor(x * S), Math.floor(y * S), Math.ceil(S), Math.ceil(S));
  }

  /* たてもの */
  for (const b of BUILDINGS) {
    const col = b.type === 'center' ? '#e85c6c' : b.type === 'shop' ? '#5c8fd8'
      : b.gymId === 'cascade' ? '#4a90e2' : b.gymId === 'thunder' ? '#e8c12c' : '#b09a4f';
    c.fillStyle = col;
    c.fillRect(b.x * S, b.y * S, b.w * S, b.h * S);
    c.strokeStyle = '#fff'; c.lineWidth = 1;
    c.strokeRect(b.x * S + 0.5, b.y * S + 0.5, b.w * S - 1, b.h * S - 1);
  }

  /* ゾーン なまえ */
  const labels = [
    ['はじまりの町', 25, 126], ['わかば草原', 48, 104], ['ざわめきの森', 20, 76], ['ガレキ山脈', 38, 42],
    ['なぎさ街道', 74, 133], ['みなと町', 126, 131], ['こだまの深森', 67, 88],
    ['かざんの いただき', 143, 65], ['かみなり台地', 98, 24], ['こおりの さかみち', 152, 29],
    ['チャンピオンロード', 100, 54],
    ['かわべの こみち', 17, 100], ['すなの おか', 55, 112], ['あなぐらの 鉱山', 55, 59],
    ['いずみの 湿地', 101, 100], ['ささやぶの 小径', 122, 86], ['たきつぼの 滝', 104, 68],
    ['わななきの 渓谷', 104, 35], ['しろい 原野', 138, 45], ['こだいの 遺跡', 126, 53],
  ];
  c.textAlign = 'center';
  c.font = 'bold 13px "DotGothic16", sans-serif';
  for (const [text, x, y] of labels) {
    const lx = x * MAP_SCALE * S, ly = y * MAP_SCALE * S;
    const tw = c.measureText(text).width;
    c.fillStyle = 'rgba(6,12,28,.66)';
    c.beginPath(); c.roundRect(lx - tw / 2 - 5, ly - 11, tw + 10, 20, 9); c.fill();
    c.fillStyle = '#fff';
    c.fillText(text, lx, ly + 1);
  }

  /* バッジゲート (ゾーンごとに だいひょう 1こ) */
  const seenGateZones = new Set();
  for (const g of GATES) {
    if (seenGateZones.has(g.zone)) continue;
    seenGateZones.add(g.zone);
    const gx = g.x * S, gy = g.y * S;
    c.fillStyle = '#20242e';
    c.beginPath(); c.arc(gx, gy, 11, 0, TAU); c.fill();
    c.strokeStyle = '#ffb45c'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#ffd23e'; c.font = 'bold 12px sans-serif';
    c.textAlign = 'center';
    c.fillText(String(g.badges), gx, gy + 4);
    /* ちいさな じょう (lock) マーク */
    c.strokeStyle = '#ffd23e'; c.lineWidth = 1.6;
    c.beginPath(); c.arc(gx + 11, gy - 10, 3, Math.PI, 0); c.stroke();
    c.fillStyle = '#ffd23e';
    c.fillRect(gx + 8, gy - 10, 6, 5);
    c.fillStyle = '#20242e';
    c.fillRect(gx + 10.5, gy - 9, 1.5, 3);
  }

  /* ジム マーカー */
  for (const [id, x, y] of [
    ['rock', 44, 30], ['cascade', 132, 114], ['forest', 68, 78],
    ['blaze', 136, 70], ['thunder', 98, 20], ['frost', 152, 22],
  ]) {
    const bd = BADGES[id];
    const mx = x * MAP_SCALE * S, my = y * MAP_SCALE * S;
    c.beginPath(); c.arc(mx, my, 10, 0, TAU);
    c.fillStyle = bd ? bd.color : '#888'; c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#fff'; c.font = 'bold 12px sans-serif'; c.textAlign = 'center';
    c.fillText(bd ? bd.icon : 'G', mx, my + 4);
  }

  /* ライバル / ゲート */
  c.fillStyle = '#e8523c';
  c.beginPath();
  const rx = 102 * MAP_SCALE * S, ry = 60 * MAP_SCALE * S;
  c.moveTo(rx, ry - 9); c.lineTo(rx + 9, ry);
  c.lineTo(rx, ry + 9); c.lineTo(rx - 9, ry);
  c.closePath(); c.fill();
  c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();

  /* いまの もくてき */
  const obj = currentObjective();
  if (obj.target) {
    const tx = obj.target.x * S, ty = obj.target.y * S;
    const pulse = 13 + Math.sin(Date.now() / 300) * 2;
    c.strokeStyle = '#ff8a5c'; c.lineWidth = 3;
    c.beginPath(); c.arc(tx, ty, pulse, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(255,138,92,.45)'; c.lineWidth = 2;
    c.beginPath(); c.arc(tx, ty, pulse + 6, 0, TAU); c.stroke();
  }

  /* プレイヤー */
  const px = player.tx * S, py = player.ty * S;
  c.beginPath(); c.arc(px, py, 7, 0, TAU);
  c.fillStyle = '#ffd23e'; c.fill();
  c.strokeStyle = '#1a1a22'; c.lineWidth = 2; c.stroke();
  c.fillStyle = '#1a1a22';
  c.font = 'bold 11px sans-serif';
  c.fillText('いまここ', px, py - 12);
}

/* ============================================================
   モーダル / メニュー
   ============================================================ */
let modalOpen = false, modalLocked = false, modalTab = 'party';
let worldMapVisible = false;

function openModal(title, html, { tabs = false, locked = false } = {}) {
  if (!modalOpen) lastFocusBeforeModal = document.activeElement;
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = html;
  $('#modal-tabs').classList.toggle('hidden', !tabs);
  modalOpen = true; modalLocked = locked;
  $('#modal').classList.remove('hidden');
  $('#modal-close').style.display = locked ? 'none' : '';
  paintThumbs($('#modal-body'));
  /* ないようが 描画された あとで さいしょの 要素に フォーカス */
  setTimeout(() => {
    if (!modalOpen) return;
    if (!focusFirst($('#modal-body'))) focusFirst($('#modal'));
  }, 0);
}
function closeModal() {
  $('#modal').classList.add('hidden');
  modalOpen = false; modalLocked = false;
  worldMapVisible = false;
  const back = lastFocusBeforeModal;
  lastFocusBeforeModal = null;
  if (modalCloser) { const f = modalCloser; modalCloser = null; f(null); }
  /* ワールドへ もどる ときは フォーカスを はずす。
     HUD の ボタンに フォーカスが のこると、つぎの Enter が
     ボタンに とられて「しらべる / つりざお」が うごかない ことが ある。 */
  if (G.screen === 'world') {
    const ae = document.activeElement;
    if (ae && ae !== document.body && ae.blur) ae.blur();
  } else if (back && back.isConnected && !battleActive && isVisibleEl(back) &&
      back.matches && back.matches('button, [href], input, select, textarea, [tabindex="0"]')) {
    try { back.focus({ preventScroll: true }); } catch (e) {}
  }
}
let modalCloser = null;
$('#modal-close').addEventListener('click', () => { if (!modalLocked) closeModal(); });
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && !modalLocked) closeModal(); });

function paintThumbs(root) {
  root.querySelectorAll('canvas[data-species]').forEach(paintThumb);
}
function paintThumb(cv) {
  const id = cv.dataset.species;
  if (!SPECIES[id]) return;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, cv.width, cv.height);
  const s = (cv.width / 170) * (Number(cv.dataset.scale) || 1);
  drawPachimon(c, id, cv.width / 2, cv.height - 8, s, performance.now(),
    { flip: cv.dataset.flip === '1', shiny: cv.dataset.shiny === '1' });
}
function thumb(speciesId, sizePx = 64, cls = '', extra = '', shiny = false) {
  return `<canvas class="${cls}" data-species="${speciesId}" data-scale="1"${shiny ? ' data-shiny="1"' : ''} ${extra} width="${sizePx * 2}" height="${sizePx * 2}" style="width:${sizePx}px;height:${sizePx}px"></canvas>`;
}
function hpClass(r) { return r > 0.5 ? '' : r > 0.2 ? 'warn' : 'danger'; }
function statusTag(m) {
  if (!m.status) return '';
  const n = STATUS_LABELS[m.status];
  if (!n) return '';
  return `<span class="status-tag ${m.status}">${n}</span>`;
}

/* ------- パーティ ------- */
function partyCardHTML(m, i, opts = {}) {
  const sp = SPECIES[m.species];
  const r = m.hp / m.maxHp;
  const dead = m.hp <= 0;
  const held = m.heldItem && ITEMS[m.heldItem] ? ITEMS[m.heldItem].name : '';
  return `
  <div class="party-card ${dead ? 'dead' : ''} ${opts.picker ? 'pickable' : ''}" data-idx="${i}" tabindex="0" role="button" data-kbd>
    ${thumb(m.species, 56, '', '', !!m.shiny)}
    <div class="pc-info">
      <div class="pc-name"><b>${sp.name}</b>${m.shiny ? '<span class="shiny-star" title="いろちがい">★</span>' : ''}<span class="lv">Lv${m.level}</span>${statusTag(m)} ${typeChips(sp.types)}</div>
      <div class="pc-sub">${ABILITIES[m.ability] ? ABILITIES[m.ability].name : '—'}${held ? ` ・ 🎒 ${held}` : ''}</div>
      <div class="pc-hp">
        <div class="hp-bar"><i class="${hpClass(r)}" style="width:${r * 100}%"></i></div>
        <span class="hp-num">${m.hp}/${m.maxHp}</span>
      </div>
      <div class="pc-moves">${m.moves.map(mv => `<span class="mv">${MOVES[mv.id].name}</span>`).join('')}</div>
    </div>
    ${opts.picker ? '' : `<div class="pc-actions">
      ${i > 0 && !dead ? `<button class="btn btn-green" data-lead="${i}">せんとう</button>` : ''}
      <button class="btn" data-detail="${i}">そうこう</button>
    </div>`}
  </div>`;
}
function setLead(idx) {
  if (idx <= 0 || !G.party[idx]) return false;
  G.party.unshift(G.party.splice(idx, 1)[0]);
  Sfx.click();
  syncHUD();
  return true;
}
function moveMon(from, to, idx, message) {
  const mon = from[idx];
  if (!mon) return null;
  from.splice(idx, 1);
  to.push(mon);
  Sfx.click();
  if (message) toast(message(mon));
  syncHUD();
  return mon;
}
function bindPartyBody(bodyEl, { picker = false, onPick = null } = {}) {
  bodyEl.querySelectorAll('.party-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      const idx = Number(card.dataset.idx);
      if (picker) { onPick && onPick(idx); return; }
      showMonDetail(idx);
    });
  });
  bodyEl.querySelectorAll('[data-lead]').forEach(b => b.addEventListener('click', () => {
    if (setLead(Number(b.dataset.lead))) renderMenuTab('party');
  }));
  bodyEl.querySelectorAll('[data-detail]').forEach(b => b.addEventListener('click', () => {
    showMonDetail(Number(b.dataset.detail));
  }));
}
function showMonDetail(idx, side = 'party') {
  const arr = side === 'box' ? G.box : G.party;
  const m = arr[idx];
  if (!m) return;
  const sp = SPECIES[m.species];
  const need = expToNext(m.level, sp.growth);
  const nature = NATURES[m.nature] || NATURES.hardy;
  const ability = ABILITIES[m.ability] || { name: '—', desc: '' };
  const held = m.heldItem && ITEMS[m.heldItem] ? ITEMS[m.heldItem] : null;
  const iv = m.iv || {};
  const ev = m.ev || {};
  const statRows = STAT_KEYS.map(k => {
    const val = (k === 'hp' ? m.maxHp : m[k]) || 0;
    const max = k === 'hp' ? 320 : 260;
    const nat = nature.up === k ? 'up' : nature.down === k ? 'down' : '';
    return `<div class="stat-line">
      <label>${STAT_LABELS[k]}</label>
      <div class="stat-bar"><i class="${nat}" style="width:${clamp(val / max * 100, 4, 100)}%"></i></div>
      <span class="stat-val">${val}</span>
      <span class="stat-iv" title="個体ち">個${iv[k] || 0}</span>
      <span class="stat-ev" title="努力ち">努${ev[k] || 0}</span>
      <span class="stat-nat ${nat}">${nat === 'up' ? '↑' : nat === 'down' ? '↓' : ''}</span>
    </div>`;
  }).join('');
  openModal(sp.name, `
    <div class="dex-detail mon-detail">
      ${thumb(m.species, 120, '', '', !!m.shiny)}
      <div style="flex:1;min-width:0">
        <div class="pc-name"><b>${sp.name}</b>${m.shiny ? '<span class="shiny-star" title="いろちがい">★</span>' : ''}<span class="lv">Lv${m.level}</span>${statusTag(m)}</div>
        <div class="mon-tags">${typeChips(sp.types)}<span class="info-tag">${nature.name}</span><span class="info-tag">${ability.name}</span>${held ? `<span class="info-tag held">🎒 ${held.name}</span>` : ''}</div>
        <p class="mon-desc">${sp.desc}</p>
        <div class="mon-exp-row"><span>つぎの レベルまで</span><div class="exp-bar"><i style="width:${clamp(m.exp / Math.max(1, need) * 100, 0, 100)}%"></i></div><b>${Math.max(0, need - m.exp)}</b></div>
        <div class="stat-table">${statRows}</div>
        <p class="stat-note">努力値の 効果は 控えめ（本家の 1/3）。レベル・個体値・せいかくも だいじ。</p>
        <div class="mon-ability"><b>とくせい:</b> ${ability.name}<span>${ability.desc || ''}</span></div>
        <div class="pc-moves" style="margin-top:8px">${m.moves.map(mv => {
          const mvv = MOVES[mv.id];
          return `<span class="mv" style="border-color:${TYPES[mvv.type].color}">${mvv.name} <small style="opacity:.6">${mv.pp}/${mvv.pp}PP</small></span>`;
        }).join('')}</div>
        <div class="mon-actions">
          <button class="btn btn-yellow" id="detail-recall">わざを おもいだす</button>
          <button class="btn btn-blue" id="detail-back">もどる</button>
          ${side === 'party' && idx > 0 ? '<button class="btn btn-green" id="detail-lead">せんとうに だす</button>' : ''}
          ${side === 'box' && G.party.length < 6 ? '<button class="btn btn-green" id="detail-toparty">パーティに くわえる</button>' : ''}
          ${side === 'party' && G.party.length > 1 ? '<button class="btn" id="detail-tobox">ボックスへ</button>' : ''}
          ${held ? '<button class="btn" id="detail-unequip">もちものを はずす</button>' : ''}
        </div>
      </div>
    </div>`);
  $('#detail-back').addEventListener('click', () => renderMenuTab(side === 'box' ? 'box' : 'party'));
  $('#detail-recall').addEventListener('click', () => showMoveReminder(idx, side));
  const leadBtn = $('#detail-lead');
  if (leadBtn) leadBtn.addEventListener('click', () => {
    if (setLead(idx)) showMonDetail(0, 'party');
  });
  const toParty = $('#detail-toparty');
  if (toParty) toParty.addEventListener('click', () => {
    moveMon(G.box, G.party, idx, m => `${monName(m)} を パーティに くわえた！`);
    renderMenuTab('box');
  });
  const toBox = $('#detail-tobox');
  if (toBox) toBox.addEventListener('click', () => {
    if (G.party.length <= 1) { toast('さいごの 1ぴきは ボックスに おくれない！'); return; }
    moveMon(G.party, G.box, idx, m => `${monName(m)} を ボックスに おくった。`);
    renderMenuTab('party');
  });
  const unBtn = $('#detail-unequip');
  if (unBtn) unBtn.addEventListener('click', () => {
    G.items[m.heldItem] = (G.items[m.heldItem] || 0) + 1;
    m.heldItem = null;
    Sfx.click();
    showMonDetail(idx, side);
  });
}

/* ------- わざ おもいだし ------- */
function recallableMoves(mon) {
  const known = new Set(mon.moves.map(m => m.id));
  const seen = new Set();
  const out = [];
  for (const [lv, id] of (SPECIES[mon.species].learn || [])) {
    if (lv > mon.level || !MOVES[id] || known.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function moveRowButton(id, attr) {
  const mv = MOVES[id];
  const col = TYPES[mv.type] ? TYPES[mv.type].color : '#888';
  const tname = TYPES[mv.type] ? TYPES[mv.type].name : mv.type;
  const cat = mv.cat === 'phys' ? 'ぶつり' : mv.cat === 'spec' ? 'とくしゅ' : 'へんか';
  return `<button class="btn learn-slot" ${attr}="${id}">
    <b>${mv.name}</b>
    <small style="color:${col}">${tname}・${cat}${mv.power ? '・' + mv.power : ''}</small>
    <span class="learn-forget">えらぶ</span>
  </button>`;
}

function showMoveReminder(idx, side = 'party') {
  const arr = side === 'box' ? G.box : G.party;
  const m = arr[idx];
  if (!m) return;
  const moves = recallableMoves(m);
  if (!moves.length) {
    openModal('わざ おもいだし', `
      <p class="learn-note">${monName(m)} が いま おもいだせる わざは ないようだ。<br>
        レベルが あがると、おもいだせる わざが ふえるよ。</p>
      <div class="learn-actions"><button class="btn btn-blue" id="recall-back">もどる</button></div>`);
  } else {
    openModal('わざ おもいだし', `
      <p class="learn-note">${monName(m)} が これまでに おぼえてきた わざ。<br>
        おもいだして ${m.moves.length >= 4 ? '4つの わざの どれかと いれかえる' : 'わざに くわえる'} ことが できる。</p>
      <div class="learn-list">${moves.map(id => moveRowButton(id, 'data-recall')).join('')}</div>
      <div class="learn-actions"><button class="btn btn-blue" id="recall-back">もどる</button></div>`);
  }
  $('#recall-back').addEventListener('click', () => showMonDetail(idx, side));
  $('#modal-body').querySelectorAll('[data-recall]').forEach(b => b.addEventListener('click', () => {
    Sfx.click();
    const id = b.dataset.recall;
    if (!MOVES[id]) return;
    if (m.moves.length < 4) {
      m.moves.push({ id, pp: MOVES[id].pp });
      Sfx.levelup();
      toast(`${monName(m)} は ${MOVES[id].name} を おもいだした！`);
      showMonDetail(idx, side);
    } else {
      showRecallReplace(idx, side, id);
    }
  }));
}

function showRecallReplace(idx, side, newId) {
  const arr = side === 'box' ? G.box : G.party;
  const m = arr[idx];
  if (!m) return;
  const nm = MOVES[newId];
  openModal('わざを いれかえる', `
    <p class="learn-note">${monName(m)} は ${nm.name} を おもいだしたい。<br>
      どの わざを わすれる？</p>
    <div class="learn-list">${m.moves.map((mv, i) => moveRowButton(mv.id, `data-forget`)).join('')}</div>
    <div class="learn-actions"><button class="btn btn-blue" id="recall-back">もどる</button></div>`);
  $('#recall-back').addEventListener('click', () => showMoveReminder(idx, side));
  $('#modal-body').querySelectorAll('[data-forget]').forEach(b => b.addEventListener('click', () => {
    Sfx.click();
    const i = m.moves.findIndex(x => x.id === b.dataset.forget);
    if (i < 0) return;
    const old = MOVES[m.moves[i].id];
    m.moves[i] = { id: newId, pp: nm.pp };
    Sfx.levelup();
    toast(`${monName(m)} は ${old.name} を わすれて ${nm.name} を おもいだした！`);
    showMonDetail(idx, side);
  }));
}

/* ------- メニュー 本体 ------- */
function openMenu() {
  if (modalOpen || battleActive || dialogOpen) return;
  Sfx.click();
  modalTab = 'party';
  openModal('メニュー', '', { tabs: true });
  renderMenuTab(modalTab);
}
$('#modal-tabs').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  modalTab = b.dataset.tab;
  Sfx.click();
  renderMenuTab(modalTab);
});

function renderMenuTab(tab) {
  $$('#modal-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const body = $('#modal-body');

  if (tab === 'party') {
    if (!G.party.length) { body.innerHTML = '<p style="color:var(--sub)">まだ パチモンが いない…</p>'; return; }
    body.innerHTML = G.party.map((m, i) => partyCardHTML(m, i)).join('');
    bindPartyBody(body);
  }
  if (tab === 'box') {
    body.innerHTML = renderBoxHTML();
    bindBox(body);
  }
  if (tab === 'bag') {
    body.innerHTML = renderBagHTML();
    bindBag(body, renderMenuTab.bind(null, 'bag'));
  }
  if (tab === 'dex') {
    body.innerHTML = renderDexHTML();
    bindDex(body);
  }
  if (tab === 'guide') {
    const obj = currentObjective();
    const steps = guideSteps();
    body.innerHTML = `
      <div class="guide-now">
        <div class="guide-label">いまの もくてき</div>
        <h3>${obj.title}</h3>
        <p>${obj.text}</p>
      </div>
      <div class="guide-clear">
        <b>クリア条件</b>
        <span>6つの ジムバッジを あつめて、チャンピオンロードの ライバル パチローを たおす。</span>
        <small>めやす: クリア時 レベル85前後 / バッジ順は いわ → しずく → しんりょく → ほのお → いなずま → こおり。</small>
      </div>
      <div class="guide-steps">
        ${steps.map((s, i) => `
          <div class="guide-step ${s.done ? 'done' : ''}">
            <span class="gs-no">${s.done ? '✓' : i + 1}</span>
            <div><b>${s.label}</b><small>${s.hint}</small></div>
          </div>`).join('')}
      </div>
      <button class="btn btn-yellow" id="guide-map">🗺 全体マップを みる <span class="key">N</span></button>
      <p class="guide-note">みどりの チェックが クリアずみ。バッジが たりないと ゲートは ひらかない。みちあんないの ひとに はなしかけると、その ばしょの ヒントが もらえるよ。</p>`;
    $('#guide-map').addEventListener('click', openWorldMap);
  }
  if (tab === 'online') {
    if (typeof netRenderMenuTab === 'function') netRenderMenuTab(body);
    else body.innerHTML = '<p style="color:var(--sub)">ネットたいせんを よみこめませんでした…</p>';
    return;
  }
  if (tab === 'system') {
    const mins = Math.floor(G.playTime / 60);
    const slotButtons = Array.from({ length: SAVE_SLOT_COUNT }, (_, idx) => {
      const n = idx + 1;
      const s = slotSummary(n);
      const now = n === activeSlot;
      const label = s ? `${s.leadName} Lv${s.leadLevel}` : 'からっぽ';
      return `<button class="btn ${now ? 'btn-yellow' : 'btn-blue'} slot-save-btn" data-save-slot="${n}">
        ${now ? '▶ ' : ''}スロット${n}<small>${label}</small></button>`;
    }).join('');
    body.innerHTML = `
      <div class="save-info">
        セーブさき: <b style="color:var(--yellow)">スロット${activeSlot}</b><br>
        ぞろえ: パーティ ${G.party.length} ひき / ボックス ${G.box.length} ひき<br>
        ずかん: みつけ ${G.dex.seen.size} / つかまえ ${G.dex.caught.size} / ぜん ${DEX_ORDER.length} 種<br>
        バッジ: ${G.badges.length} こ ・ プレイじかん: ${mins} ふん ・ パチコイン: ${G.money}<br>
      </div>
      <div class="badge-shelf">${Object.entries(BADGES).map(([id, bd]) => {
        const owned = G.badges.includes(id);
        return `<span class="badge ${owned ? 'owned' : ''}" style="--bc:${bd.color}" title="${bd.desc}">${bd.icon} ${owned ? bd.name : '？？？'}</span>`;
      }).join('')}</div>
      <div class="slot-save-row">${slotButtons}</div>
      <p class="slot-save-note">べつの スロットを えらぶと、いまの レポートを そこへ ほぞんして セーブさきを きりかえます。</p>
      <div class="sys-row">
        <button class="btn btn-yellow" id="sys-save">スロット${activeSlot}に きろくする</button>
        <button class="btn ${Sfx.muted ? '' : 'btn-blue'}" id="sys-mute">${Sfx.muted ? 'サウンド: OFF' : 'サウンド: ON'}</button>
        <button class="btn btn-red" id="sys-reset">このスロットを けして タイトルへ</button>
      </div>
      <p style="margin-top:14px;font-size:11px;color:#5a67b5">パチモン © 2026 パチもん製作委員会 — 本家とは いっさい カンケイありません。</p>`;
    $('#sys-save').addEventListener('click', () => { saveGame(); renderMenuTab('system'); });
    $('#sys-mute').addEventListener('click', () => { Sfx.toggle(); renderMenuTab('system'); });
    body.querySelectorAll('[data-save-slot]').forEach(btn => {
      btn.addEventListener('click', () => {
        const n = Number(btn.dataset.saveSlot);
        if (n === activeSlot) { saveGame(); renderMenuTab('system'); return; }
        const s = slotSummary(n);
        const msg = `スロット${n}に セーブして、セーブさきを スロット${n}に きりかえますか？` +
          (s ? `\n（スロット${n}の レポートは うわがきされます）` : '');
        if (!confirm(msg)) return;
        saveGame(true, n);
        renderMenuTab('system');
        toast(`スロット${n}に セーブして きりかえた！`);
        Sfx.heal();
      });
    });
    $('#sys-reset').addEventListener('click', () => {
      if (confirm(`スロット${activeSlot}の レポートを けして、タイトルに もどりますか？\n（ほかの スロットは そのまま のこります）`)) {
        deleteSlot(activeSlot);
        location.reload();
      }
    });
  }
}

/* ------- ボックス ------- */
function boxCardHTML(m, i, side) {
  const sp = SPECIES[m.species];
  const r = m.hp / m.maxHp;
  const held = m.heldItem && ITEMS[m.heldItem] ? ITEMS[m.heldItem].name : '';
  const canDeposit = side === 'party' && G.party.length > 1;
  const canWithdraw = side === 'box' && G.party.length < 6;
  return `
  <div class="box-card ${m.hp <= 0 ? 'dead' : ''}" data-side="${side}" data-idx="${i}" tabindex="0" role="button" data-kbd>
    ${thumb(m.species, 52, '', '', !!m.shiny)}
    <div class="bc-name"><b>${sp.name}</b>${m.shiny ? '<span class="shiny-star">★</span>' : ''}<span class="lv">Lv${m.level}</span></div>
    <div class="pc-sub">${ABILITIES[m.ability] ? ABILITIES[m.ability].name : '—'}${held ? ` ・ 🎒${held}` : ''}</div>
    <div class="hp-bar"><i class="${hpClass(r)}" style="width:${r * 100}%"></i></div>
    <div class="bc-actions">
      ${side === 'party'
        ? `<button class="btn btn-blue" data-bx="box" data-idx="${i}" ${canDeposit ? '' : 'disabled'}>ボックスへ</button>`
        : `<button class="btn btn-green" data-bx="party" data-idx="${i}" ${canWithdraw ? '' : 'disabled'}>パーティへ</button>`}
      <button class="btn" data-bx="detail" data-idx="${i}" data-side="${side}">そうこう</button>
    </div>
  </div>`;
}
function renderBoxHTML() {
  const party = G.party.map((m, i) => boxCardHTML(m, i, 'party')).join('');
  const box = G.box.length
    ? G.box.map((m, i) => boxCardHTML(m, i, 'box')).join('')
    : '<p class="box-empty">ボックスは からっぽだ。つかまえた パチモンが 6ひきを こえると ここに おくられる。</p>';
  return `
    <div class="box-head">パーティ <b>${G.party.length}</b>/6 ・ ボックス <b>${G.box.length}</b>ひき</div>
    <div class="box-section-title">パーティ</div>
    <div class="box-grid">${party}</div>
    <div class="box-section-title">ボックス</div>
    <div class="box-grid">${box}</div>
    <p class="box-note">パチモンは いつでも パーティと ボックスを いったりきたり できる。さいごの 1ぴきは ボックスに おくれない。</p>`;
}
function bindBox(body) {
  body.querySelectorAll('.box-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      showMonDetail(Number(card.dataset.idx), card.dataset.side);
    });
  });
  body.querySelectorAll('[data-bx]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = Number(btn.dataset.idx);
      const side = btn.dataset.side || (btn.closest('.box-card') || {}).dataset?.side;
      const act = btn.dataset.bx;
      if (act === 'detail') { showMonDetail(idx, side); return; }
      if (act === 'box') {
        if (G.party.length <= 1) { toast('さいごの 1ぴきは ボックスに おくれない！'); return; }
        moveMon(G.party, G.box, idx, m => `${monName(m)} を ボックスに おくった。`);
      } else if (act === 'party') {
        if (G.party.length >= 6) { toast('パーティが いっぱいだ！'); return; }
        moveMon(G.box, G.party, idx, m => `${monName(m)} を パーティに くわえた！`);
      }
      renderMenuTab('box');
    });
  });
}

/* ------- バッグ ------- */
const BAG_GROUPS = [
  ['ball', 'ボール', '⚪'],
  ['heal', 'かいふく', '🧪'],
  ['status', 'じょうたい', '💊'],
  ['revive', 'ふっかつ', '✨'],
  ['battle', 'バトル', '⚔'],
  ['held', 'もちもの', '🎒'],
  ['key', 'たいせつ', '🔑'],
];
function curesFor(it) {
  if (it.cure === 'all') return ['psn', 'tox', 'par', 'slp', 'brn', 'frz'];
  if (it.cure === 'psn') return ['psn', 'tox'];
  return it.cure ? [it.cure] : [];
}
function applyItemToMon(id, mon) {
  const it = ITEMS[id];
  if (!it || !mon) return { ok: false, msg: '…' };
  if (it.kind === 'heal') {
    if (mon.hp <= 0) return { ok: false, msg: 'ひんしの パチモンには つかえない…' };
    const before = mon.hp;
    let cured = null;
    const cures = curesFor(it);
    if (mon.status && cures.includes(mon.status)) {
      cured = STATUS_LABELS[mon.status];
      mon.status = null; mon.sleepTurns = 0;
    }
    if (before >= mon.maxHp && !cured) return { ok: false, msg: 'HPは もう まんたんだ！' };
    mon.hp = Math.min(mon.maxHp, mon.hp + (it.heal || 0));
    let msg = `${monName(mon)} の HPが ${mon.hp}/${mon.maxHp} に なった！`;
    if (cured) msg += ` ${cured}も なおった！`;
    return { ok: true, msg };
  }
  if (it.kind === 'status') {
    const cures = curesFor(it);
    if (!mon.status || !cures.includes(mon.status)) return { ok: false, msg: 'なおす じょうたいが ない！' };
    const label = STATUS_LABELS[mon.status];
    mon.status = null; mon.sleepTurns = 0;
    return { ok: true, msg: `${monName(mon)} の ${label}が なおった！` };
  }
  if (it.kind === 'revive') {
    if (mon.hp > 0) return { ok: false, msg: 'げんきな パチモンには つかえない…' };
    mon.hp = Math.max(1, Math.floor(mon.maxHp * (it.ratio || 0.5)));
    mon.status = null; mon.sleepTurns = 0;
    return { ok: true, msg: `${monName(mon)} が げんきに なった！ HP ${mon.hp}/${mon.maxHp}` };
  }
  return { ok: false, msg: 'いまは つかえない…' };
}
function equipHeldItem(id, idx) {
  const it = ITEMS[id];
  const m = G.party[idx];
  if (!it || !m || (G.items[id] || 0) <= 0) return false;
  if (m.heldItem === id) { toast('もう もっている！'); return false; }
  if (m.heldItem) G.items[m.heldItem] = (G.items[m.heldItem] || 0) + 1;
  G.items[id]--;
  m.heldItem = id;
  Sfx.click();
  toast(`${monName(m)} に ${it.name}を もたせた！`);
  return true;
}
function itemRowHTML(icon, it, count, action) {
  return `<div class="item-row">
    <div class="ic">${icon}</div>
    <div class="info"><b>${it.name}</b><p>${it.desc}</p></div>
    <div class="cnt">${count}</div>
    ${action}
  </div>`;
}
function itemGroupsHTML(predicate, row) {
  return BAG_GROUPS.map(([kind, label, icon]) => {
    const rows = Object.entries(ITEMS).filter(([id, it]) => predicate(id, it, kind));
    if (!rows.length) return '';
    return `<div class="bag-group"><div class="bag-group-title">${icon} ${label}</div>${
      rows.map(([id, it]) => row(id, it, kind, icon)).join('')}</div>`;
  }).join('');
}
function renderBagHTML() {
  const groups = itemGroupsHTML(
    (id, it, kind) => it.kind === kind && (G.items[id] || 0) > 0,
    (id, it, kind, icon) => {
      let action;
      if (kind === 'heal' || kind === 'status' || kind === 'revive') {
        action = `<button class="btn btn-green" data-use="${id}">つかう</button>`;
      } else if (kind === 'held') {
        action = `<button class="btn btn-blue" data-hold="${id}">もたせる</button>`;
      } else if (kind === 'key') {
        action = id === 'bicycle'
          ? `<button class="btn ${G.bikeOn ? 'btn-yellow' : 'btn-blue'}" data-bike>${G.bikeOn ? 'おりる' : 'のる'}</button>`
          : `<button class="btn" disabled>${id === 'oldrod' ? 'みずの まえで' : 'こうか ちゅう'}</button>`;
      } else {
        action = `<button class="btn" disabled>バトルで</button>`;
      }
      return itemRowHTML(icon, it, `×${G.items[id] || 0}`, action);
    }
  );
  return groups || '<p style="color:var(--sub)">バッグは からっぽだ… パチマートで どうぐを かおう！</p>';
}
function bindBag(body, rerender) {
  body.querySelectorAll('[data-use]').forEach(b => b.addEventListener('click', async () => {
    const id = b.dataset.use;
    if ((G.items[id] || 0) <= 0) return;
    const idx = await pickParty({ title: `${ITEMS[id].name}を だれに つかう？`, aliveOnly: false, cancelable: true });
    if (idx == null) return;
    const m = G.party[idx];
    const res = applyItemToMon(id, m);
    if (!res.ok) { toast(res.msg); Sfx.pop(); return; }
    G.items[id]--;
    Sfx.heal();
    toast(res.msg);
    rerender();
    syncHUD();
  }));
  body.querySelectorAll('[data-hold]').forEach(b => b.addEventListener('click', async () => {
    const id = b.dataset.hold;
    if ((G.items[id] || 0) <= 0) return;
    const idx = await pickParty({ title: `${ITEMS[id].name}を だれに もたせる？`, aliveOnly: false, cancelable: true });
    if (idx == null) return;
    if (equipHeldItem(id, idx)) { rerender(); syncHUD(); }
  }));
  body.querySelectorAll('[data-bike]').forEach(b => b.addEventListener('click', () => {
    toggleBike(true);
    rerender();
    syncHUD();
  }));
}

/* ------- ずかん ------- */
function renderDexHTML() {
  const cells = DEX_ORDER.map((id, i) => {
    const seen = G.dex.seen.has(id), caught = G.dex.caught.has(id);
    const sp = SPECIES[id];
    if (!seen && !caught) {
      return `<div class="dex-cell"><canvas data-silhouette="${id}" width="128" height="128"></canvas>
        <div class="no">No.${String(i + 1).padStart(3, '0')}</div><div class="nm">？？？？</div></div>`;
    }
    return `<div class="dex-cell ${caught ? 'caught' : ''}" data-dex="${id}" tabindex="0" role="button" data-kbd>
      ${thumb(id, 64)}
      <div class="no">No.${String(i + 1).padStart(3, '0')}</div>
      <div class="nm">${caught ? sp.name : '？？？'}</div></div>`;
  }).join('');
  return `
    <div class="shop-money">みつけ ${G.dex.seen.size} ・ つかまえ ${G.dex.caught.size} / ${DEX_ORDER.length} 種</div>
    <div class="dex-grid">${cells}</div>
    <div id="dex-detail-slot"></div>`;
}
function bindDex(body) {
  body.querySelectorAll('canvas[data-silhouette]').forEach(cv => drawSilhouette(cv, cv.dataset.silhouette, 0.68));
  body.querySelectorAll('[data-dex]').forEach(cell => cell.addEventListener('click', () => {
    const id = cell.dataset.dex;
    const sp = SPECIES[id];
    const caught = G.dex.caught.has(id);
    const slot = $('#dex-detail-slot');
    const b = sp.base;
    const sbar = (label, v) => `
      <div class="stat-row"><label>${label}</label>
      <div class="stat-bar"><i style="width:${clamp(v / 170 * 100, 6, 100)}%"></i></div>
      <b class="stat-num">${v}</b></div>`;
    slot.innerHTML = `
      <div class="dex-detail">
        ${thumb(id, 120)}
        <div style="flex:1">
          <div class="pc-name"><b>${caught ? sp.name : '？？？'}</b>${typeChips(sp.types)}</div>
          <p style="font-size:13px;color:var(--sub);margin-top:6px;line-height:1.7">${caught ? sp.desc : 'すがたは まだ みていない…。つかまえて みたい！'}</p>
          ${caught ? `<p style="font-size:12px;margin-top:6px">つかまえやすさ: ${sp.catch < 60 ? 'むずかしい' : sp.catch < 130 ? 'ふつう' : 'かんたん'}</p>
          <div class="dex-base">
            <div class="dex-base-title">種族値 <span>合計 ${b.hp + b.atk + b.def + b.spa + b.spd + b.spe}</span></div>
            ${sbar('HP', b.hp)}${sbar('こうげき', b.atk)}${sbar('ぼうぎょ', b.def)}
            ${sbar('とくこう', b.spa)}${sbar('とくぼう', b.spd)}${sbar('すばやさ', b.spe)}
          </div>` : ''}
        </div>
      </div>`;
    paintThumbs(slot);
    slot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }));
}

/* ------- パーティ ピッカー (バッグ/バトル共用) ------- */
function pickParty({ title = 'パチモンを えらぶ', aliveOnly = false, mustHeal = false, cancelable = true } = {}) {
  return new Promise(resolve => {
    const cand = G.party.map((m, i) => ({ m, i }))
      .filter(({ m }) => (aliveOnly ? m.hp > 0 : true) && (!mustHeal || m.hp < m.maxHp));
    if (!cand.length) { toast('えらべる パチモンが いない…'); resolve(null); return; }
    openModal(title, cand.map(({ m, i }) => partyCardHTML(m, i, { picker: true })).join(''), { locked: !cancelable });
    modalCloser = () => { resolve(null); };
    $('#modal-body').querySelectorAll('.party-card').forEach(card => {
      card.addEventListener('click', () => {
        const i = Number(card.dataset.idx);
        modalCloser = null;   // まちがって null で かいけつ させない
        closeModal();
        resolve(i);
      });
    });
    if (cancelable) $('#modal-close').style.display = '';
  });
}

/* ------- ショップ ------- */
function openShop() {
  const groups = itemGroupsHTML(
    (id, it, kind) => !!it.shop && it.kind === kind,
    (id, it, kind, icon) => itemRowHTML(icon, it, `${it.price}パチ`,
      `<button class="btn btn-yellow" data-buy="${id}">かう</button>`)
  );
  openModal('パチマート', `<div class="shop-money">しょじきん: ${G.money}パチ</div>${groups}`);
  $('#modal-body').querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.buy, it = ITEMS[id];
    if (G.money < it.price) { toast('パチコインが たりない！'); Sfx.pop(); return; }
    G.money -= it.price;
    G.items[id] = (G.items[id] || 0) + 1;
    Sfx.click();
    toast(`${it.name}を かった！ (のこり ${G.money}パチ)`);
    openShopRefresh();
    syncHUD();
  }));
}
function openShopRefresh() {
  const m = $('#modal-title').textContent === 'パチマート';
  if (m) {
    const scrollPos = $('#modal-body').scrollTop;
    openShop();
    $('#modal-body').scrollTop = scrollPos;
  }
}

/* ============================================================
   HUD / トースト / ゾーン バナー
   ============================================================ */
function syncHUD() {
  $('#zone-pill').textContent = currentZoneName();
  const obj = currentObjective();
  const objText = $('#objective-text');
  if (objText) {
    objText.textContent = obj.title;
    const pill = $('#objective-pill');
    if (pill) { pill.title = obj.text; pill.classList.toggle('done', obj.key === 'done'); }
  }
  $('#money').textContent = G.money;
  const balls = (G.items.pachiball || 0) + (G.items.superball || 0) + (G.items.hyperball || 0);
  $('#ballcount').textContent = balls;
  const bc = $('#badge-count');
  if (bc) bc.textContent = G.badges.length;
  const bt = $('#badge-total');
  if (bt) bt.textContent = Object.keys(BADGES).length;
  syncBikeButton();
  const lead = G.party[0];
  if (lead) {
    $('#lead-name').textContent = `${monName(lead)} Lv${lead.level}`;
    const r = lead.hp / lead.maxHp;
    const bar = $('#lead-hp');
    bar.style.width = (r * 100) + '%';
    bar.className = hpClass(r);
    const card = $('#lead-card');
    if (card) {
      if (r > 0 && r <= 0.2 && !G.lowHpWarned) {
        G.lowHpWarned = true;
        card.classList.add('lowhp');
        Sfx.lowhp();
        toast('⚠ ピンチ！ パチモンの HPが すくない！');
      } else if (r > 0.35) {
        G.lowHpWarned = false;
        card.classList.remove('lowhp');
      }
    }
  } else {
    $('#lead-name').textContent = '—';
    $('#lead-hp').style.width = '100%';
  }
}
let toastTimer = null;
function toast(text, ms = 2200) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
let zoneTimer = null;
function showZone(name) {
  const z = $('#zone-banner');
  z.textContent = name;
  z.classList.add('show');
  clearTimeout(zoneTimer);
  zoneTimer = setTimeout(() => z.classList.remove('show'), 1600);
}

/* ============================================================
   セーブ
   ============================================================ */
function clampSlot(n) {
  n = Math.floor(Number(n));
  return (n >= 1 && n <= SAVE_SLOT_COUNT) ? n : 1;
}
function readSlot(n) {
  try {
    const raw = localStorage.getItem(slotKey(clampSlot(n)));
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && data.v === 1 ? data : null;
  } catch (e) { return null; }
}
function readActiveSlot() {
  try { return clampSlot(parseInt(localStorage.getItem(ACTIVE_SLOT_KEY), 10) || 1); }
  catch (e) { return 1; }
}
function writeActiveSlot(n) {
  try { localStorage.setItem(ACTIVE_SLOT_KEY, String(clampSlot(n))); } catch (e) {}
}
/* この バージョンを はじめて ひらいた ときだけ、これまでの セーブを けす。
   2かいめ いこうは フラグが のこるので 消えない。 */
function wipeSavesOnce() {
  try {
    if (localStorage.getItem(SAVE_WIPE_KEY)) return;
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(ACTIVE_SLOT_KEY);
    for (let i = 1; i <= SAVE_SLOT_COUNT; i++) localStorage.removeItem(slotKey(i));
    localStorage.setItem(SAVE_WIPE_KEY, '1');
  } catch (e) {}
}
/* むかしの 1スロット セーブを スロット1へ ひっこす */
function migrateLegacySave() {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return; }
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (data && data.v === 1) {
      if (!readSlot(1)) localStorage.setItem(slotKey(1), raw);
      localStorage.removeItem(SAVE_KEY);
    }
  } catch (e) {}
}
function slotSummary(n) {
  const data = readSlot(n);
  if (!data) return null;
  const lead = (data.party || [])[0] || null;
  return {
    slot: clampSlot(n),
    leadName: lead && SPECIES[lead.species] ? SPECIES[lead.species].name : '—',
    leadLevel: lead ? lead.level : 0,
    partyCount: (data.party || []).length,
    caught: (data.caught || []).length,
    seen: (data.seen || []).length,
    playTime: data.playTime || 0,
    zone: (ENCOUNTERS[data.zone] || ENCOUNTERS.field).name,
    savedAt: data.savedAt || 0,
  };
}
function hasAnySave() {
  for (let i = 1; i <= SAVE_SLOT_COUNT; i++) if (readSlot(i)) return true;
  return false;
}
function deleteSlot(n) {
  n = clampSlot(n);
  try { localStorage.removeItem(slotKey(n)); } catch (e) {}
  if (activeSlot === n) {
    activeSlot = 1;
    for (let i = 1; i <= SAVE_SLOT_COUNT; i++) {
      if (readSlot(i)) { activeSlot = i; break; }
    }
    writeActiveSlot(activeSlot);
  }
  updateTitleButtons();
}
function saveGame(silent = false, slot = activeSlot) {
  if (!G.started) return;
  /* ネットたいせん中は Lv50 の コピーが G.party に 入っているので セーブしない。
     たいせん終了時は パーティを もどした あとに セーブされる。 */
  if (B && B.pvp && !B.over) return;
  slot = clampSlot(slot);
  const data = {
    v: 1,
    mapScale: MAP_SCALE,
    savedAt: Date.now(),
    player: { x: player.tx, y: player.ty, dir: player.dir },
    party: G.party.map(monData),
    box: G.box.map(monData),
    items: G.items, money: G.money,
    seen: [...G.dex.seen], caught: [...G.dex.caught],
    flags: G.flags, starter: G.starter, zone: G.zone,
    badges: G.badges,
    bikeOn: !!G.bikeOn,
    lastCenter: G.lastCenter,
    playTime: Math.floor(G.playTime),
  };
  try {
    localStorage.setItem(slotKey(slot), JSON.stringify(data));
    activeSlot = slot;
    writeActiveSlot(slot);
    if (!silent) { toast(`スロット${slot}に きろくした！`); Sfx.heal(); }
  } catch (e) { if (!silent) toast('セーブに しっぱいした…'); }
}
function loadGame(slot = activeSlot) {
  const data = readSlot(slot);
  if (!data) return false;
  G.party = (data.party || []).map(hydrateMon);
  G.box = (data.box || []).map(hydrateMon);
  G.items = Object.assign(defaultItems(), data.items || {});
  G.money = data.money ?? 300;
  G.dex.seen = new Set(data.seen || []);
  G.dex.caught = new Set(data.caught || []);
  G.flags = data.flags || {};
  G.starter = data.starter || null;
  G.playTime = data.playTime || 0;
  G.badges = Array.isArray(data.badges) ? data.badges.filter(b => BADGES[b]) : [];
  G.lastCenter = (data.lastCenter && Number.isFinite(data.lastCenter.x) && Number.isFinite(data.lastCenter.y))
    ? { x: data.lastCenter.x, y: data.lastCenter.y, name: String(data.lastCenter.name || 'パチモンセンター') }
    : null;
  /* バッジ2こ いじょうの セーブには じてんしゃを おぎなう */
  grantBikeIfEligible();
  G.bikeOn = !!data.bikeOn && bikeOwned();
  G.lowHpWarned = false;
  G.started = true;
  applyNpcState();
  /* きゅう マップ (1.5ばい まえ) の セーブは ざひょうを おなじ わりあいで ひろげる */
  const savedScale = Number(data.mapScale) || 1;
  let sx = data.player?.x ?? START_POS.x;
  let sy = data.player?.y ?? START_POS.y;
  if (savedScale !== MAP_SCALE) {
    sx = Math.round(sx * MAP_SCALE / savedScale);
    sy = Math.round(sy * MAP_SCALE / savedScale);
    /* かくしアイテムの とった きろくも ひきつぐ */
    for (const h of HIDDEN_ITEMS) {
      const ox = Math.round(h.x * savedScale / MAP_SCALE);
      const oy = Math.round(h.y * savedScale / MAP_SCALE);
      if (G.flags['hidden_' + ox + '_' + oy]) G.flags['hidden_' + h.x + '_' + h.y] = true;
    }
  }
  /* きゅう マップの セーブ / いどう ふのう な ばしょ は スタートちへ */
  if (!inBounds(sx, sy) || !walkable(sx, sy) || NPCS.some(n => n.x === sx && n.y === sy)
    || zoneReq(regionZoneAt(sx, sy)) > G.badges.length) {
    sx = START_POS.x; sy = START_POS.y;
  }
  player.tx = sx;
  player.ty = sy;
  player.dir = data.player?.dir || 'down';
  player.px = player.tx * TILE + TILE / 2;
  player.py = player.ty * TILE + TILE / 2;
  player.moving = false;
  G.zone = zoneAt(player.tx, player.ty);
  activeSlot = clampSlot(slot);
  writeActiveSlot(activeSlot);
  return true;
}

/* ============================================================
   しょうぶ まけ (ばたり) — battle.js から よばれる
   ============================================================ */
/* ちかくの あるける マスを さがす (NPC の いる マスは のぞく) */
function findWalkableSpot(x, y) {
  const tries = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0, 2], [2, 0], [-2, 0], [0, -2]];
  for (const [dx, dy] of tries) {
    const nx = x + dx, ny = y + dy;
    if (inBounds(nx, ny) && walkable(nx, ny) && !NPCS.some(n => n.x === nx && n.y === ny)) {
      return { x: nx, y: ny };
    }
  }
  return null;
}

/* さいごに つかった パチモンセンターの まえ。まだ つかっていなければ スタートの 町 */
function lastCenterSpawn() {
  if (G.lastCenter) {
    const spot = findWalkableSpot(G.lastCenter.x, G.lastCenter.y);
    if (spot) return { x: spot.x, y: spot.y, name: G.lastCenter.name };
  }
  return { x: RESPAWN_POS.x, y: RESPAWN_POS.y, name: 'パチモンセンター' };
}

async function whiteout() {
  const lost = Math.min(G.money, Math.max(50, Math.floor(G.money * 0.2)));
  G.money -= lost;
  await dialog('めのまえが まっくらに なった！…', '');
  await wait(400);
  await healPartyFull();
  const spawn = lastCenterSpawn();
  player.tx = spawn.x; player.ty = spawn.y;
  player.px = player.tx * TILE + TILE / 2;
  player.py = player.ty * TILE + TILE / 2;
  player.dir = 'down'; player.moving = false;
  G.zone = zoneAt(player.tx, player.ty);
  setScreen('world');
  syncHUD();
  await dialog(`${spawn.name}で たいりょくを かいふくした。パチコインを ${lost}パチ おとしてしまった…`);
  saveGame(true);
}

/* エンディング */
async function showEnding() {
  const mins = Math.floor(G.playTime / 60);
  Music.play('ending');
  await dialog('…きみの パチモンは、ほんとうに そだっていたんだな。', 'パチロー');
  await dialog('6つの バッジと ライバルを こえた！ パチモン マスターへの みちのりは まだ つづく。でも きょうの きみなら どこまでも いける！', 'ハカセ');
  await dialog(`しょうりおめでとう！ ずかん みつけ ${G.dex.seen.size} / つかまえ ${G.dex.caught.size} 種、プレイじかん ${mins} ふん。`, 'パチモン');
  toast('★ パチモン しょうり！ これからも まったり あそんでね ★', 5000);
  Music.play('world');
}

/* ============================================================
   画面きりかえ
   ============================================================ */
const SCREEN_SELECTORS = {
  title: '#title-screen', intro: '#intro-screen', battle: '#battle-screen',
};
function setScreen(name) {
  G.screen = name;
  for (const [screen, sel] of Object.entries(SCREEN_SELECTORS)) {
    $(sel).classList.toggle('hidden', name !== screen);
  }
  worldCanvas.classList.toggle('hidden', name !== 'world');
  $('#hud').classList.toggle('hidden', name !== 'world');
  $('#pad').classList.toggle('hidden', !(name === 'world' && isTouchDevice()));
  if (name === 'world') { resizeWorld(); syncHUD(); }
  if (name === 'title') updateTitleButtons();
  Music.refresh();
  focusScreenDefault(name);
}

/* ============================================================
   タイトル / イントロ
   ============================================================ */
let starterPick = null;

function renderStarters() {
  const cards = STARTERS.map(id => {
    const sp = SPECIES[id];
    const bar = (label, v) => `
      <div class="stat-row"><label>${label}</label>
      <div class="stat-bar"><i style="width:${clamp(v / 160 * 100, 6, 100)}%"></i></div></div>`;
    return `
    <div class="starter-card" data-starter="${id}" tabindex="0" role="button" data-kbd>
      ${thumb(id, 120)}
      <div class="sc-name">${sp.name}</div>
      <div>${typeChips(sp.types)}</div>
      <div class="sc-desc">${sp.desc}</div>
      <div class="sc-stats">
        ${bar('HP', sp.base.hp)}${bar('こうげき', sp.base.atk)}${bar('ぼうぎょ', sp.base.def)}
        ${bar('とくこう', sp.base.spa)}${bar('とくぼう', sp.base.spd)}${bar('すばやさ', sp.base.spe)}
      </div>
      <div class="sc-ability">とくせい: ${ABILITIES[sp.ability] ? ABILITIES[sp.ability].name : '—'}</div>
    </div>`;
  }).join('');
  const wrap = $('#starter-cards');
  wrap.innerHTML = cards;
  paintThumbs(wrap);
  wrap.querySelectorAll('.starter-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.starter;
      if (starterPick === id) { confirmStarter(id); return; }
      starterPick = id;
      Sfx.click();
      wrap.querySelectorAll('.starter-card').forEach(c => c.classList.toggle('sel', c.dataset.starter === id));
      $('#btn-pick').classList.remove('hidden');
      $('#btn-pick').textContent = `${SPECIES[id].name} に きめた！`;
    });
  });
  const actions = $('.intro-actions');
  if (!$('#btn-pick')) {
    const b = document.createElement('button');
    b.className = 'btn btn-yellow btn-big';
    b.id = 'btn-pick';
    b.textContent = 'パチモンを えらぶ';
    actions.appendChild(b);
  }
  $('#btn-pick').classList.add('hidden');
  $('#btn-pick').onclick = () => { if (starterPick) confirmStarter(starterPick); };
}

async function confirmStarter(id) {
  if (pendingNewSlot) { activeSlot = clampSlot(pendingNewSlot); pendingNewSlot = null; }
  writeActiveSlot(activeSlot);
  G.starter = id;
  const mon = makeMon(id, 5);
  G.party = [mon];
  G.box = [];
  G.items = defaultItems();
  G.money = 300;
  G.dex.seen = new Set([id]);
  G.dex.caught = new Set([id]);
  G.flags = {};
  G.playTime = 0;
  G.badges = [];
  G.bikeOn = false;
  G.lastCenter = null;
  G.lowHpWarned = false;
  G.started = true;
  player.tx = START_POS.x; player.ty = START_POS.y;
  player.px = player.tx * TILE + TILE / 2;
  player.py = player.ty * TILE + TILE / 2;
  player.dir = 'down'; player.moving = false;
  G.zone = zoneAt(player.tx, player.ty);
  starterPick = null;
  setScreen('world');
  cam.x = clamp(player.px - worldCanvas.clientWidth / 2, 0, Math.max(0, MAP_W * TILE - worldCanvas.clientWidth));
  cam.y = clamp(player.py - worldCanvas.clientHeight / 2, 0, Math.max(0, MAP_H * TILE - worldCanvas.clientHeight));
  syncHUD();
  Sfx.catchOk();
  await dialog(`${SPECIES[id].name}を えらんだ！ これから よろしくな！`, 'ハカセ');
  await dialog('ここは パチもん とう。くさむらで パチモンを みつけたら、パチボールで つかまえるんだ！', 'ハカセ');
  await dialog('パチモンセンターで キズを なおせる。パチマートで パチボールを かえることも できるぞ。', 'ハカセ');
  await dialog('それじゃ でかけて おいで！ ゆめの パチモンマスター まで あと いっぽ！', 'ハカセ');
  saveGame(true);
}

/* ============================================================
   セーブスロット えらび（タイトル）
   ============================================================ */
let slotPickerMode = 'continue';
let pendingNewSlot = null;

function fmtPlayTime(sec) {
  const m = Math.floor((sec || 0) / 60);
  if (m < 60) return `${m}ふん`;
  return `${Math.floor(m / 60)}じかん ${m % 60}ふん`;
}
function fmtSaveDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function updateTitleButtons() {
  const b = $('#btn-continue');
  if (b) b.disabled = !hasAnySave();
}
function openSlotPicker(mode) {
  slotPickerMode = mode;
  $('#title-screen').classList.add('slot-mode');
  $('#slot-picker').classList.remove('hidden');
  renderSlotPicker();
  setTimeout(() => { focusFirst($('#slot-list')) || focusFirst($('#slot-picker')); }, 0);
}
function closeSlotPicker() {
  $('#title-screen').classList.remove('slot-mode');
  $('#slot-picker').classList.add('hidden');
  updateTitleButtons();
  setTimeout(() => {
    if (G.screen !== 'title') return;
    const target = !$('#btn-continue').disabled ? $('#btn-continue') : $('#btn-new');
    if (target) target.focus({ preventScroll: true });
  }, 0);
}
function renderSlotPicker() {
  const isNew = slotPickerMode === 'new';
  $('#slot-picker-title').textContent = isNew ? 'どの スロットで はじめる？' : 'どの レポートを つづける？';
  $('#slot-picker-sub').textContent = isNew
    ? 'えらんだ スロットに セーブします。ほかの スロットは そのまま のこります。'
    : 'セーブした スロットを えらんでください。';
  const list = $('#slot-list');
  list.innerHTML = '';
  for (let i = 1; i <= SAVE_SLOT_COUNT; i++) {
    const s = slotSummary(i);
    const disabled = !isNew && !s;
    const el = document.createElement('div');
    el.className = 'slot-card' + (!s ? ' empty' : '') + (disabled ? ' disabled' : '');
    el.dataset.slot = String(i);
    if (!disabled) {
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('data-kbd', '');
    }
    el.innerHTML = `
      <div class="slot-no">スロット<b>${i}</b></div>
      <div class="slot-main">
        ${s ? `
          <b>${s.leadName} <span style="color:var(--sub);font-size:12px">Lv${s.leadLevel}</span>${s.partyCount > 1 ? ` <span style="color:var(--sub);font-size:11px">ほか ${s.partyCount - 1}ひき</span>` : ''}</b>
          <div class="slot-meta"><span>ずかん ${s.caught}/${DEX_ORDER.length}</span><span>${fmtPlayTime(s.playTime)}</span><span>${s.zone}</span></div>
          <div class="slot-date">${fmtSaveDate(s.savedAt)}${isNew ? ' ・ えらぶと うわがき' : ''}</div>
        ` : `
          <b style="color:var(--sub)">からっぽ</b>
          <div class="slot-meta"><span>${isNew ? 'ここに あたらしく はじめる' : 'レポートが ありません'}</span></div>
        `}
      </div>
      ${s ? `<button class="btn btn-red slot-del" data-del="${i}" title="スロット${i}を けす">けす</button>` : ''}
    `;
    if (!disabled) {
      el.addEventListener('click', e => {
        if (e.target.closest('[data-del]')) return;
        chooseSlot(i);
      });
    }
    list.appendChild(el);
  }
  list.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const n = Number(btn.dataset.del);
      if (!confirm(`スロット${n}の レポートを けしても いい？`)) return;
      deleteSlot(n);
      Sfx.click();
      renderSlotPicker();
      toast(`スロット${n}の レポートを けした`);
      setTimeout(() => {
        const f = $('#slot-list .slot-card:not(.disabled)');
        if (f) f.focus({ preventScroll: true });
      }, 0);
    });
  });
}
function chooseSlot(n) {
  const s = slotSummary(n);
  if (slotPickerMode === 'continue') {
    if (!s) return;
    Sfx.click();
    if (loadGame(n)) {
      closeSlotPicker();
      setScreen('world');
      showZone(currentZoneName());
      toast(`スロット${n}から つづき！`);
    }
    return;
  }
  if (s && !confirm(`スロット${n}には レポートが あります。うわがきして はじめから はじめますか？`)) return;
  Sfx.click();
  pendingNewSlot = clampSlot(n);
  closeSlotPicker();
  setScreen('intro');
}

/* ============================================================
   しいき
   ============================================================ */
function init() {
  buildMap();
  applyNpcState();
  bakeTerrain();
  resizeWorld();
  bindPad();
  renderStarters();
  wipeSavesOnce();
  migrateLegacySave();
  activeSlot = readActiveSlot();
  setScreen('title');
  updateTitleButtons();

  $('#btn-new').addEventListener('click', () => { Sfx.click(); openSlotPicker('new'); });
  $('#btn-bike').addEventListener('click', () => toggleBike());
  $('#btn-continue').addEventListener('click', () => { Sfx.click(); openSlotPicker('continue'); });
  $('#btn-slot-back').addEventListener('click', () => { Sfx.click(); closeSlotPicker(); });
  $('#slot-picker').addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); closeSlotPicker(); }
  });
  $('#btn-back-title').addEventListener('click', () => {
    Sfx.click();
    pendingNewSlot = null;
    setScreen('title');
    updateTitleButtons();
  });
  $('#btn-menu').addEventListener('click', () => openMenu());
  const mapBtn = $('#btn-map');
  if (mapBtn) mapBtn.addEventListener('click', () => openWorldMap());

  window.addEventListener('pointerdown', () => Sfx.ensure(), { once: true });
  requestAnimationFrame(loop);
}
document.addEventListener('DOMContentLoaded', init);
