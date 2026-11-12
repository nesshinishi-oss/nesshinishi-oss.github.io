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
  click() { this.play(700, .05, 'square', .04); },
  hit() { this.play(200, .13, 'sawtooth', .06, -90); },
  faint() { this.play(220, .45, 'triangle', .07, -160); },
  heal() { this.play(520, .1, 'sine', .07); setTimeout(() => this.play(760, .14, 'sine', .07), 100); },
  throwball() { this.play(900, .08, 'square', .045, -300); },
  pop() { this.play(300, .09, 'square', .06, 240); },
  catchOk() { this.play(523, .09, 'square', .07); setTimeout(() => this.play(659, .09, 'square', .07), 110); setTimeout(() => this.play(880, .2, 'square', .07), 220); },
  levelup() { this.play(392, .08, 'square', .06); setTimeout(() => this.play(523, .08, 'square', .06), 90); setTimeout(() => this.play(659, .08, 'square', .06), 180); setTimeout(() => this.play(784, .18, 'square', .06), 270); },
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
const SAVE_KEY = 'pachimon_save_v1';

const G = {
  started: false, screen: 'title', zone: 'field',
  party: [], box: [],
  items: { pachiball: 5, superball: 0, potion: 3, superpotion: 0 },
  money: 300,
  dex: { seen: new Set(), caught: new Set() },
  flags: {}, starter: null, playTime: 0,
};
let battleActive = false;

/* ---------------- パチモン生成 ---------------- */
function statAt(base, level, isHp) {
  return isHp
    ? Math.floor(base * 2 * level / 100) + level + 10
    : Math.floor(base * 2 * level / 100) + 5;
}
function recalcStats(mon) {
  const b = SPECIES[mon.species].base;
  mon.maxHp = statAt(b.hp, mon.level, true);
  mon.atk = statAt(b.atk, mon.level, false);
  mon.def = statAt(b.def, mon.level, false);
  mon.spd = statAt(b.spd, mon.level, false);
  mon.hp = clamp(mon.hp, 0, mon.maxHp);
}
function defaultMoves(species, level) {
  const learn = SPECIES[species].learn.filter(e => e[0] <= level).map(e => e[1]);
  const uniq = [...new Set(learn)].slice(-4);
  return uniq.map(id => ({ id, pp: MOVES[id].pp }));
}
function makeMon(species, level) {
  const m = {
    species, level, exp: 0, hp: 1,
    moves: defaultMoves(species, level),
    status: null, sleepTurns: 0,
  };
  recalcStats(m);
  m.hp = m.maxHp;
  m.exp = 0;
  return m;
}
function monName(m) { return SPECIES[m.species].name; }
function expToNext(level) { return Math.floor(14 + level * level * 1.35); }
function monData(m) {
  return {
    species: m.species, level: m.level, exp: m.exp, hp: m.hp,
    moves: m.moves.map(x => ({ id: x.id, pp: x.pp })),
    status: m.status || null, sleepTurns: m.sleepTurns || 0,
  };
}
function hydrateMon(d) {
  const m = makeMon(d.species, d.level);
  m.exp = d.exp || 0;
  m.moves = (d.moves || []).filter(x => MOVES[x.id]).map(x => ({ id: x.id, pp: clamp(x.pp, 0, MOVES[x.id].pp) }));
  if (!m.moves.length) m.moves = defaultMoves(d.species, d.level);
  m.status = d.status || null;
  m.sleepTurns = d.sleepTurns || 0;
  m.hp = clamp(d.hp, 0, m.maxHp);
  return m;
}
function activeMon() { return G.party[0]; }

/* ============================================================
   マップ
   ============================================================ */
const TILE = 36;
const MAP_W = 44, MAP_H = 36;
const T = { GRASS:0, TALL:1, TREE:2, WATER:3, PATH:4, ROCKY:5, FLOWER:6, BOULDER:7, WALL:8, DOOR:9 };

const PATCHES = [
  { zone:'field',  x:9,  y:14, w:4, h:3 },
  { zone:'field',  x:24, y:30, w:5, h:3 },
  { zone:'field',  x:7,  y:26, w:4, h:3 },
  { zone:'field',  x:15, y:22, w:4, h:2 },
  { zone:'forest', x:14, y:8,  w:5, h:3 },
  { zone:'forest', x:27, y:7,  w:5, h:3 },
  { zone:'forest', x:6,  y:4,  w:4, h:3 },
  { zone:'forest', x:24, y:12, w:3, h:2 },
  { zone:'rock',   x:34, y:21, w:5, h:3 },
  { zone:'rock',   x:36, y:16, w:4, h:2 },
  { zone:'rock',   x:35, y:28, w:4, h:3 },
];

const BUILDINGS = [
  { x:13, y:21, w:5, h:3, type:'center', name:'パチモンセンター' },
  { x:23, y:21, w:5, h:3, type:'shop',   name:'パチマート' },
];

const NPCS = [
  { id:'prof', x:21, y:28, name:'ハカセ', colors:{ cap:'#8f8f9e', jacket:'#5f5f7e', pack:'#e8e8f0', skin:'#ffe0c2', hair:'#c8c8d4' } },
  { id:'kid', x:16, y:26, name:'ぼうや', colors:{ cap:'#4cc9f0', jacket:'#7cc9ee', pack:'#fff', skin:'#ffd9b8', hair:'#5a4632' } },
  { id:'bugcatcher', x:10, y:19, name:'ムシトリスト', trainer:'bugcatcher', colors:{ cap:'#8bd46b', jacket:'#5f9e4a', pack:'#c8e8b0', skin:'#ffe0c2', hair:'#3a2c1c' } },
  { id:'lass', x:27, y:19, name:'タンバリン', trainer:'lass', colors:{ cap:'#f0a3c8', jacket:'#e88bb0', pack:'#fff', skin:'#ffe0c2', hair:'#8a5a2c' } },
  { id:'fisher', x:37, y:19, name:'ウキビト', trainer:'fisher', colors:{ cap:'#7fb8e8', jacket:'#4a7fa5', pack:'#d8e8f0', skin:'#ffd9b8', hair:'#2c2c34' } },
  { id:'rival', x:38, y:30, name:'パチロー', trainer:'rival', colors:{ cap:'#e8523c', jacket:'#c8482a', pack:'#ffd23e', skin:'#ffe0c2', hair:'#3a2c1c' } },
];

let map = [];
let terrainCanvas = null;

function buildMap() {
  map = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(T.GRASS));
  const inRect = (x, y, r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  const isPatch = (x, y) => PATCHES.some(r => inRect(x, y, r));

  /* 岩場の エリアは もとから 岩の じめん */
  for (let y = 16; y < MAP_H; y++)
    for (let x = 33; x < MAP_W; x++)
      map[y][x] = T.ROCKY;

  /* みち (たて x=20,21 / よこ y=18,19 / まち y=27,28 と x=31,32) */
  const paths = [
    { x:20, y:4,  w:2, h:31 },
    { x:6,  y:18, w:37, h:2 },
    { x:12, y:27, w:21, h:2 },
    { x:31, y:18, w:2, h:11 },
  ];
  for (const p of paths)
    for (let y = p.y; y < p.y + p.h; y++)
      for (let x = p.x; x < p.x + p.w; x++)
        if (y >= 0 && y < MAP_H && x >= 0 && x < MAP_W) map[y][x] = T.PATH;

  /* みずうみ */
  const lake = (cx, cy, rx, ry) => {
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) map[y][x] = T.WATER;
    }
  };
  lake(8, 13, 5.6, 3.6);
  lake(37, 9, 2.8, 2.0);

  /* 草むら */
  for (const p of PATCHES)
    for (let y = p.y; y < p.y + p.h; y++)
      for (let x = p.x; x < p.x + p.w; x++)
        map[y][x] = T.TALL;

  /* 森: めいれい なしの き */
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = map[y][x];
    if (t !== T.GRASS && t !== T.ROCKY) continue;
    if (inRect(x, y, { x:11, y:20, w:22, h:14 })) continue;   // まち
    if (Math.abs(x - 20) <= 1 || Math.abs(x - 21) <= 1) continue;
    if (Math.abs(y - 18) <= 1 || Math.abs(y - 19) <= 1) continue;
    if (Math.abs(x - 31) <= 1 || Math.abs(x - 32) <= 1) continue;
    const forest = (y <= 17 && x < 33);
    if (forest && hash(x, y) < 0.22) map[y][x] = T.TREE;
    if (!forest && x >= 33 && hash(x * 7, y * 3) < 0.09 && map[y][x] === T.ROCKY) map[y][x] = T.BOULDER;
    if (map[y][x] === T.GRASS && hash(x * 3, y * 11) < 0.05) map[y][x] = T.FLOWER;
  }

  /* たてもの */
  for (const b of BUILDINGS) {
    for (let y = b.y; y < b.y + b.h; y++)
      for (let x = b.x; x < b.x + b.w; x++)
        map[y][x] = T.WALL;
    b.doorX = b.x + 2; b.doorY = b.y + b.h - 1;
    map[b.doorY][b.doorX] = T.DOOR;
  }

  /* NPC の いばしょを ふやす */
  for (const n of NPCS) {
    for (const [x, y] of [[n.x, n.y], [n.x, n.y + 1], [n.x, n.y - 1]]) {
      if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
      const t = map[y][x];
      if (t === T.TREE || t === T.BOULDER || t === T.WATER || t === T.WALL) map[y][x] = y >= 16 && x >= 33 ? T.ROCKY : T.PATH;
    }
  }

  /* まわりは き */
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (x < 2 || y < 2 || x >= MAP_W - 2 || y >= MAP_H - 2) map[y][x] = T.TREE;
  }
}

function walkable(x, y) {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return false;
  const t = map[y][x];
  return t === T.GRASS || t === T.TALL || t === T.PATH || t === T.ROCKY || t === T.FLOWER;
}
function zoneAt(x, y) {
  for (const p of PATCHES) {
    if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) return p.zone;
  }
  if (x >= 33 && y >= 16) return 'rock';
  if (y <= 17) return 'forest';
  return 'field';
}

/* ---------------- 地形の 事前描画 ---------------- */
function bakeTerrain() {
  terrainCanvas = document.createElement('canvas');
  terrainCanvas.width = MAP_W * TILE;
  terrainCanvas.height = MAP_H * TILE;
  const c = terrainCanvas.getContext('2d');
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      drawTile(c, tx, ty, map[ty][tx]);
    }
  }
  for (const b of BUILDINGS) drawBuilding(c, b);
}

function drawTile(c, tx, ty, t) {
  const x = tx * TILE, y = ty * TILE;
  const h = hash(tx, ty);
  if (t === T.GRASS || t === T.TALL || t === T.FLOWER) {
    c.fillStyle = h < 0.5 ? '#7ac36a' : '#71ba61';
    c.fillRect(x, y, TILE, TILE);
    c.fillStyle = 'rgba(255,255,255,0.07)';
    if (h < 0.33) c.fillRect(x + 4, y + 6, 5, 3);
    if (h > 0.7) c.fillRect(x + TILE - 14, y + TILE - 12, 6, 3);
  }
  if (t === T.TALL) {
    c.fillStyle = '#4f9e55';
    c.fillRect(x, y, TILE, TILE);
    c.strokeStyle = '#3c7d43'; c.lineWidth = 3; c.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const bx = x + 5 + (i * 7) % (TILE - 8);
      const by = y + TILE - 4 - (i % 3) * 6;
      const sway = (hash(tx + i, ty * 3) - 0.5) * 6;
      c.beginPath();
      c.moveTo(bx, by);
      c.quadraticCurveTo(bx + sway, by - 10, bx + sway * 1.4, by - 18);
      c.stroke();
    }
  }
  if (t === T.FLOWER) {
    c.fillStyle = '#fff'; circle(c, x + TILE / 2 - 5, y + TILE / 2, 4, '#ffd7e8');
    circle(c, x + TILE / 2 + 6, y + TILE / 2 + 6, 4, '#fff0a8');
    circle(c, x + TILE / 2 - 5, y + TILE / 2, 1.6, '#e8a03c');
    circle(c, x + TILE / 2 + 6, y + TILE / 2 + 6, 1.6, '#e8a03c');
  }
  if (t === T.PATH) {
    c.fillStyle = h < 0.5 ? '#d9c08e' : '#d0b785';
    c.fillRect(x, y, TILE, TILE);
    c.fillStyle = 'rgba(120,90,50,.18)';
    if (h < 0.4) c.fillRect(x + 8, y + 10, 4, 4);
    if (h > 0.6) c.fillRect(x + TILE - 16, y + TILE - 14, 5, 5);
  }
  if (t === T.ROCKY) {
    c.fillStyle = h < 0.5 ? '#a8a29a' : '#9b958d';
    c.fillRect(x, y, TILE, TILE);
    c.fillStyle = 'rgba(255,255,255,.08)';
    if (h < 0.4) c.fillRect(x + 6, y + 8, 7, 4);
    if (h > 0.65) c.fillRect(x + TILE - 16, y + TILE - 12, 6, 3);
  }
  if (t === T.WATER) {
    c.fillStyle = '#4aa3df';
    c.fillRect(x, y, TILE, TILE);
    c.fillStyle = 'rgba(255,255,255,.16)';
    c.fillRect(x + 6, y + 10, 14, 3);
    c.fillRect(x + TILE - 20, y + TILE - 12, 12, 3);
  }
  if (t === T.TREE) {
    c.fillStyle = '#6ab35c';
    c.fillRect(x, y, TILE, TILE);
    c.fillStyle = '#5a4632';
    c.fillRect(x + TILE / 2 - 3, y + TILE - 12, 6, 12);
    circle(c, x + TILE / 2, y + TILE / 2 - 4, 16, '#3a925c');
    circle(c, x + TILE / 2 - 10, y + TILE / 2 + 2, 11, '#2f7d4f');
    circle(c, x + TILE / 2 + 10, y + TILE / 2, 12, '#2f7d4f');
    circle(c, x + TILE / 2 - 2, y + TILE / 2 - 12, 9, '#48a468');
  }
  if (t === T.BOULDER) {
    c.fillStyle = '#8f8a80';
    c.beginPath();
    c.moveTo(x + 4, y + TILE - 4);
    c.lineTo(x + 8, y + 10);
    c.lineTo(x + TILE / 2, y + 4);
    c.lineTo(x + TILE - 8, y + 12);
    c.lineTo(x + TILE - 4, y + TILE - 4);
    c.closePath(); c.fill();
    c.fillStyle = '#b9b3a8';
    c.beginPath();
    c.moveTo(x + TILE / 2 - 2, y + 6); c.lineTo(x + TILE - 10, y + 14); c.lineTo(x + TILE / 2 + 4, y + 18);
    c.closePath(); c.fill();
  }
  if (t === T.WALL || t === T.DOOR) { c.fillStyle = '#79c36a'; c.fillRect(x, y, TILE, TILE); }
}

function drawBuilding(c, b) {
  const x = b.x * TILE, y = b.y * TILE, w = b.w * TILE, h = b.h * TILE;
  const isCenter = b.type === 'center';
  c.fillStyle = 'rgba(20,30,20,.25)';
  c.beginPath(); c.ellipse(x + w / 2, y + h, w / 2 + 4, 10, 0, 0, TAU); c.fill();
  // かべ
  c.fillStyle = '#f2e0c2';
  c.fillRect(x, y + h * 0.42, w, h * 0.58);
  c.strokeStyle = '#d8c0a0'; c.lineWidth = 2;
  c.strokeRect(x, y + h * 0.42, w, h * 0.58);
  // やね
  c.fillStyle = isCenter ? '#e85c6c' : '#5c8fd8';
  c.fillRect(x - 4, y + 4, w + 8, h * 0.44);
  c.fillStyle = isCenter ? '#c84858' : '#4870b5';
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
  c.fillText(isCenter ? 'PACHI CENTER' : 'PACHI MART', x + w / 2, y + h * 0.44 - 2);
  if (isCenter) {
    c.fillStyle = '#e85c6c';
    c.fillRect(x + 6, y + 8, 5, 16);
    c.fillRect(x + 15, y + 8, 5, 16);
  }
  c.textAlign = 'left';
}

/* ============================================================
   ワールド ループ
   ============================================================ */
const worldCanvas = $('#world');
const wctx = worldCanvas.getContext('2d');
const player = {
  tx: 20, ty: 30, dir: 'down',
  px: 20 * TILE + TILE / 2, py: 30 * TILE + TILE / 2,
  moving: false, fromX: 0, fromY: 0, toX: 0, toY: 0, t: 0, walk: 0, lastStep: 0,
};
const cam = { x: 0, y: 0, tx: 0, ty: 0 };
const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const keys = new Set();
let worldLocked = () => battleActive || dialogOpen || modalOpen;

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
    if (G.started) { showZone(ENCOUNTERS[zone].name); syncHUD(); }
  }
  const t = map[player.ty][player.tx];
  if (t === T.TALL && G.started && Math.random() < 0.13) {
    triggerEncounter();
  } else if (G.started && Math.random() < 0.008) {
    saveGame(true);
  }
}

function updateWorld(dt) {
  if (G.screen !== 'world' || worldLocked()) { player.walk = 0; return; }
  if (player.moving) {
    const spd = keys.has('shift') ? 1.7 : 1;      /* Shiftで はしる */
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

  if (terrainCanvas) {
    wctx.drawImage(terrainCanvas, 0, 0);
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
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (dialogOpen) {
    if (k === 'enter' || k === ' ' || k === 'e') advanceDialog();
    return;
  }
  if (modalOpen) {
    if (k === 'escape' || k === 'm') { if (!modalLocked) closeModal(); }
    return;
  }
  keys.add(k);
  if (G.screen === 'world' && !battleActive) {
    if (k === 'enter' || k === ' ' || k === 'e') interact();
    else if (k === 'm') openMenu();
  }
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

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
function interact() {
  if (worldLocked() || G.screen !== 'world') return;
  const [dx, dy] = DIRV[player.dir];
  const tx = player.tx + dx, ty = player.ty + dy;
  const npc = NPCS.find(n => n.x === tx && n.y === ty);
  if (npc) { talkToNpc(npc); return; }
  const t = map[ty] ? map[ty][tx] : null;
  if (t === T.DOOR) {
    const b = BUILDINGS.find(b => b.doorX === tx && b.doorY === ty);
    if (b) enterBuilding(b);
  } else if (t === T.TALL) {
    dialog('ざぁ… 草むらが ざわめいている。パチモンが かくれていそうだ。');
  } else if (t === T.WATER) {
    dialog('きれいな みずだ。パチモンが およいでいる かもしれない。');
  } else if (t === T.TREE) {
    dialog('あっという間に きりかぶだった きが そばたっている…。');
  }
}

async function talkToNpc(npc) {
  player.walk = 0;
  if (npc.trainer) {
    const def = TRAINERS[npc.trainer];
    const beaten = !!G.flags['trainer_' + npc.trainer];
    if (!beaten) {
      await dialog(def.pre, def.name);
      await startTrainerBattle(npc.trainer);
    } else {
      await dialog(def.after, def.name);
    }
    return;
  }
  if (npc.id === 'prof') {
    await dialog('パチモンの せかいへ ようこそ！ ここは 「パチもん とう」だ。', 'ハカセ');
    await dialog('まちの みなみが わかば草原。きたは ざわめきの森。ひがしの 岩場には つよいのが いるぞ。', 'ハカセ');
    await dialog('パチボールが たりなくなったら パチマートで かうんだぞ。パチコインは しょうぶに かつと もらえる。', 'ハカセ');
    await dialog('そろそろ ライバルの パチローが きた。きをつけて たびに出るんだぞ！', 'ハカセ');
    return;
  }
  if (npc.id === 'kid') {
    await dialog('ぼく、パチモン マスターに なるんだ！…って いってたら まえの にんじゃ みんな いなくなった。', 'ぼうや');
    await dialog('あのね、でんきタイプは みずと ひこうに よく きくんだよ。ぼく しってるもん。', 'ぼうや');
    return;
  }
  await dialog('…', npc.name);
}

async function enterBuilding(b) {
  Sfx.click();
  if (b.type === 'center') {
    await dialog('いらっしゃいませ！ パチモンセンターへ ようこそ！', 'じょうむいん');
    await wait(200);
    await healPartyFull();
    await dialog('パチモンたちの キズが なおって、げんきに なりました！ また どうぞ！', 'じょうむいん');
    saveGame(true);
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
async function triggerEncounter() {
  if (battleActive) return;
  const zone = zoneAt(player.tx, player.ty);
  const enc = ENCOUNTERS[zone] || ENCOUNTERS.field;
  const speciesId = weightedPick(enc.table);
  const level = ri(enc.level[0], enc.level[1]);
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
   モーダル / メニュー
   ============================================================ */
let modalOpen = false, modalLocked = false, modalTab = 'party';

function openModal(title, html, { tabs = false, locked = false } = {}) {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = html;
  $('#modal-tabs').classList.toggle('hidden', !tabs);
  modalOpen = true; modalLocked = locked;
  $('#modal').classList.remove('hidden');
  paintThumbs($('#modal-body'));
}
function closeModal() {
  $('#modal').classList.add('hidden');
  modalOpen = false; modalLocked = false;
  if (modalCloser) { const f = modalCloser; modalCloser = null; f(null); }
}
let modalCloser = null;
$('#modal-close').addEventListener('click', () => closeModal());
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
  drawPachimon(c, id, cv.width / 2, cv.height - 8, s, performance.now(), { flip: cv.dataset.flip === '1' });
}
function thumb(speciesId, sizePx = 64, cls = '', extra = '') {
  return `<canvas class="${cls}" data-species="${speciesId}" data-scale="1" ${extra} width="${sizePx * 2}" height="${sizePx * 2}" style="width:${sizePx}px;height:${sizePx}px"></canvas>`;
}
function hpClass(r) { return r > 0.5 ? '' : r > 0.2 ? 'warn' : 'danger'; }
function statusTag(m) {
  if (!m.status) return '';
  const n = { slp:'ねむり', par:'まひ', brn:'やけど' }[m.status];
  return `<span class="status-tag ${m.status}">${n}</span>`;
}

/* ------- パーティ ------- */
function partyCardHTML(m, i, opts = {}) {
  const sp = SPECIES[m.species];
  const r = m.hp / m.maxHp;
  const dead = m.hp <= 0;
  return `
  <div class="party-card ${dead ? 'dead' : ''} ${opts.picker ? 'pickable' : ''}" data-idx="${i}">
    ${thumb(m.species, 56)}
    <div class="pc-info">
      <div class="pc-name"><b>${sp.name}</b><span class="lv">Lv${m.level}</span>${statusTag(m)} ${typeChips(sp.types)}</div>
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
    const idx = Number(b.dataset.lead);
    const m = G.party.splice(idx, 1)[0];
    G.party.unshift(m);
    Sfx.click();
    renderMenuTab('party');
    syncHUD();
  }));
  bodyEl.querySelectorAll('[data-detail]').forEach(b => b.addEventListener('click', () => {
    showMonDetail(Number(b.dataset.detail));
  }));
}
function showMonDetail(idx) {
  const m = G.party[idx];
  const sp = SPECIES[m.species];
  const need = expToNext(m.level);
  const statBar = (label, v, max) => `
    <div class="stat-row"><label>${label}</label>
      <div class="stat-bar"><i style="width:${clamp(v / max * 100, 4, 100)}%"></i></div>
      <span style="width:34px;text-align:right">${v}</span></div>`;
  openModal(sp.name, `
    <div class="dex-detail">
      ${thumb(m.species, 120)}
      <div style="flex:1">
        <div class="pc-name"><b>${sp.name}</b><span class="lv">Lv${m.level}</span>${statusTag(m)}</div>
        <div style="margin:4px 0">${typeChips(sp.types)}</div>
        <p style="font-size:12px;color:var(--sub);margin:6px 0">${sp.desc}</p>
        ${statBar('HP', m.hp, 120)}
        ${statBar('HP Max', m.maxHp, 120)}
        ${statBar('こうげき', m.atk, 120)}
        ${statBar('ぼうぎょ', m.def, 120)}
        ${statBar('すばやさ', m.spd, 120)}
        <div style="font-size:12px;color:var(--sub);margin-top:8px">つぎの レベルまで: ${Math.max(0, need - m.exp)} EXP</div>
        <div class="pc-moves" style="margin-top:8px">${m.moves.map(mv => {
          const mvv = MOVES[mv.id];
          return `<span class="mv">${mvv.name} <small style="opacity:.6">${mv.pp}/${mvv.pp}PP</small></span>`;
        }).join('')}</div>
        <div style="margin-top:10px"><button class="btn btn-blue" id="detail-back">もどる</button></div>
      </div>
    </div>`);
  $('#detail-back').addEventListener('click', () => renderMenuTab('party'));
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
  if (tab === 'bag') {
    body.innerHTML = renderBagHTML();
    bindBag(body, renderMenuTab.bind(null, 'bag'));
  }
  if (tab === 'dex') {
    body.innerHTML = renderDexHTML();
    bindDex(body);
  }
  if (tab === 'system') {
    const mins = Math.floor(G.playTime / 60);
    body.innerHTML = `
      <div class="save-info">
        ぞろえ: パーティ ${G.party.length} ひき / ボックス ${G.box.length} ひき<br>
        ずかん: みつけ ${G.dex.seen.size} / つかまえ ${G.dex.caught.size} / ぜん ${DEX_ORDER.length} 種<br>
        プレイじかん: ${mins} ふん ・ パチコイン: ${G.money}<br>
      </div>
      <div class="sys-row">
        <button class="btn btn-yellow" id="sys-save">レポートに きろくする</button>
        <button class="btn ${Sfx.muted ? '' : 'btn-blue'}" id="sys-mute">${Sfx.muted ? 'サウンド: OFF' : 'サウンド: ON'}</button>
        <button class="btn btn-red" id="sys-reset">さいしょから やりなおす</button>
      </div>
      <p style="margin-top:14px;font-size:11px;color:#5a67b5">パチモン © 2026 パチもん製作委員会 — 本家とは いっさい カンケイありません。</p>`;
    $('#sys-save').addEventListener('click', () => { saveGame(); });
    $('#sys-mute').addEventListener('click', () => { Sfx.toggle(); renderMenuTab('system'); });
    $('#sys-reset').addEventListener('click', async () => {
      if (confirm('レポートを けして、さいしょから はじめますか？')) {
        try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
        location.reload();
      }
    });
  }
}

/* ------- バッグ ------- */
function renderBagHTML() {
  const rows = Object.entries(ITEMS).map(([id, it]) => {
    const cnt = G.items[id] || 0;
    const icon = it.kind === 'ball' ? '⚪' : '🧪';
    return `
    <div class="item-row">
      <div class="ic">${icon}</div>
      <div class="info"><b>${it.name}</b><p>${it.desc}</p></div>
      <div class="cnt">×${cnt}</div>
      <button class="btn ${cnt > 0 && it.kind === 'heal' ? 'btn-green' : ''}" data-use="${id}" ${cnt <= 0 || it.kind !== 'heal' ? 'disabled' : ''}>つかう</button>
    </div>`;
  }).join('');
  return rows || '<p style="color:var(--sub)">からっぽだ…</p>';
}
function bindBag(body, rerender) {
  body.querySelectorAll('[data-use]').forEach(b => b.addEventListener('click', async () => {
    const id = b.dataset.use;
    if ((G.items[id] || 0) <= 0) return;
    const idx = await pickParty({ title: 'だれに つかう?', aliveOnly: false, mustHeal: true });
    if (idx == null) return;
    const m = G.party[idx];
    const heal = ITEMS[id].heal;
    if (m.hp <= 0) { toast('ひんしの パチモンには つかえない…'); return; }
    if (m.hp >= m.maxHp) { toast('HPは もう まんたんだ！'); return; }
    G.items[id]--;
    m.hp = Math.min(m.maxHp, m.hp + heal);
    Sfx.heal();
    toast(`${monName(m)} の HPが ${m.hp}/${m.maxHp} に かいふく！`);
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
    return `<div class="dex-cell ${caught ? 'caught' : ''}" data-dex="${id}">
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
    slot.innerHTML = `
      <div class="dex-detail">
        ${thumb(id, 120)}
        <div style="flex:1">
          <div class="pc-name"><b>${caught ? sp.name : '？？？'}</b>${typeChips(sp.types)}</div>
          <p style="font-size:13px;color:var(--sub);margin-top:6px;line-height:1.7">${caught ? sp.desc : 'すがたは まだ みていない…。つかまえて みたい！'}</p>
          ${caught ? `<p style="font-size:12px;margin-top:6px">つかまえやすさ: ${sp.catch < 60 ? 'むずかしい' : sp.catch < 130 ? 'ふつう' : 'かんたん'}</p>` : ''}
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
  const rows = Object.entries(ITEMS).map(([id, it]) => `
    <div class="item-row">
      <div class="ic">${it.kind === 'ball' ? '⚪' : '🧪'}</div>
      <div class="info"><b>${it.name}</b><p>${it.desc}</p></div>
      <div class="cnt">${it.price}パチ</div>
      <button class="btn btn-yellow" data-buy="${id}">かう</button>
    </div>`).join('');
  openModal('パチマート', `<div class="shop-money">しょじきん: ${G.money}パチ</div>${rows}`);
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
  $('#money').textContent = G.money;
  const balls = (G.items.pachiball || 0) + (G.items.superball || 0);
  $('#ballcount').textContent = balls;
  const lead = G.party[0];
  if (lead) {
    $('#lead-name').textContent = `${monName(lead)} Lv${lead.level}`;
    const r = lead.hp / lead.maxHp;
    const bar = $('#lead-hp');
    bar.style.width = (r * 100) + '%';
    bar.className = hpClass(r);
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
function saveGame(silent = false) {
  if (!G.started) return;
  const data = {
    v: 1,
    player: { x: player.tx, y: player.ty, dir: player.dir },
    party: G.party.map(monData),
    box: G.box.map(monData),
    items: G.items, money: G.money,
    seen: [...G.dex.seen], caught: [...G.dex.caught],
    flags: G.flags, starter: G.starter, zone: G.zone,
    playTime: Math.floor(G.playTime),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    if (!silent) { toast('レポートに きろくした！'); Sfx.heal(); }
  } catch (e) { if (!silent) toast('セーブに しっぱいした…'); }
}
function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}
function loadGame() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) {}
  if (!data || data.v !== 1) return false;
  G.party = (data.party || []).map(hydrateMon);
  G.box = (data.box || []).map(hydrateMon);
  G.items = Object.assign({ pachiball:5, superball:0, potion:3, superpotion:0 }, data.items || {});
  G.money = data.money ?? 300;
  G.dex.seen = new Set(data.seen || []);
  G.dex.caught = new Set(data.caught || []);
  G.flags = data.flags || {};
  G.starter = data.starter || null;
  G.playTime = data.playTime || 0;
  G.started = true;
  player.tx = data.player?.x ?? 20;
  player.ty = data.player?.y ?? 30;
  player.dir = data.player?.dir || 'down';
  player.px = player.tx * TILE + TILE / 2;
  player.py = player.ty * TILE + TILE / 2;
  player.moving = false;
  G.zone = zoneAt(player.tx, player.ty);
  return true;
}

/* ============================================================
   しょうぶ まけ (ばたり) — battle.js から よばれる
   ============================================================ */
async function whiteout() {
  const lost = Math.min(G.money, Math.max(50, Math.floor(G.money * 0.2)));
  G.money -= lost;
  await dialog('めのまえが まっくらに なった！…', '');
  await wait(400);
  await healPartyFull();
  player.tx = 15; player.ty = 25;
  player.px = player.tx * TILE + TILE / 2;
  player.py = player.ty * TILE + TILE / 2;
  player.dir = 'down'; player.moving = false;
  G.zone = zoneAt(player.tx, player.ty);
  setScreen('world');
  syncHUD();
  await dialog(`パチモンセンターで たいりょくを かいふくした。パチコインを ${lost}パチ おとしてしまった…`);
  saveGame(true);
}

/* エンディング */
async function showEnding() {
  const mins = Math.floor(G.playTime / 60);
  Music.play('ending');
  await dialog('…きみの パチモンは、ほんとうに そだっていたんだな。', 'パチロー');
  await dialog('パチモン マスターへの みちのりは まだ はじまったばかり。でも きょうの きみなら どこまでも いける！', 'ハカセ');
  await dialog(`しょうりおめでとう！ ずかん みつけ ${G.dex.seen.size} / つかまえ ${G.dex.caught.size} 種、プレイじかん ${mins} ふん。`, 'パチモン');
  toast('★ パチモン しょうり！ これからも まったり あそんでね ★', 5000);
  Music.play('world');
}

/* ============================================================
   画面きりかえ
   ============================================================ */
function setScreen(name) {
  G.screen = name;
  $('#title-screen').classList.toggle('hidden', name !== 'title');
  $('#intro-screen').classList.toggle('hidden', name !== 'intro');
  $('#battle-screen').classList.toggle('hidden', name !== 'battle');
  worldCanvas.classList.toggle('hidden', name !== 'world');
  $('#hud').classList.toggle('hidden', name !== 'world');
  const pad = $('#pad');
  pad.classList.toggle('hidden', !(name === 'world' && isTouchDevice()));
  if (name === 'world') { resizeWorld(); syncHUD(); }
  Music.refresh();
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
      <div class="stat-bar"><i style="width:${clamp(v / 100 * 100, 6, 100)}%"></i></div></div>`;
    return `
    <div class="starter-card" data-starter="${id}">
      ${thumb(id, 120)}
      <div class="sc-name">${sp.name}</div>
      <div>${typeChips(sp.types)}</div>
      <div class="sc-desc">${sp.desc}</div>
      <div class="sc-stats">
        ${bar('HP', sp.base.hp)}${bar('こうげき', sp.base.atk)}${bar('ぼうぎょ', sp.base.def)}${bar('すばやさ', sp.base.spd)}
      </div>
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
  G.starter = id;
  const mon = makeMon(id, 5);
  G.party = [mon];
  G.box = [];
  G.items = { pachiball: 6, superball: 0, potion: 3, superpotion: 0 };
  G.money = 300;
  G.dex.seen = new Set([id]);
  G.dex.caught = new Set([id]);
  G.flags = {};
  G.playTime = 0;
  G.started = true;
  player.tx = 20; player.ty = 30;
  player.px = player.tx * TILE + TILE / 2;
  player.py = player.ty * TILE + TILE / 2;
  player.dir = 'down'; player.moving = false;
  G.zone = zoneAt(player.tx, player.ty);
  starterPick = null;
  setScreen('world');
  cam.x = clamp(player.px - 300, 0, MAP_W * TILE - 600);
  cam.y = clamp(player.py - 300, 0, MAP_H * TILE - 500);
  syncHUD();
  Sfx.catchOk();
  await dialog(`${SPECIES[id].name}を えらんだ！ これから よろしくな！`, 'ハカセ');
  await dialog('ここは パチもん とう。くさむらで パチモンを みつけたら、パチボールで つかまえるんだ！', 'ハカセ');
  await dialog('パチモンセンターで キズを なおせる。パチマートで パチボールを かえることも できるぞ。', 'ハカセ');
  await dialog('それじゃ でかけて おいで！ ゆめの パチモンマスター まで あと いっぽ！', 'ハカセ');
  saveGame(true);
}

/* ============================================================
   しいき
   ============================================================ */
function init() {
  buildMap();
  bakeTerrain();
  resizeWorld();
  bindPad();
  renderStarters();
  setScreen('title');
  $('#btn-continue').disabled = !hasSave();

  $('#btn-new').addEventListener('click', () => {
    Sfx.click();
    if (hasSave() && !confirm('レポートが あるけれど、けして はじめから はじめる？')) return;
    setScreen('intro');
  });
  $('#btn-continue').addEventListener('click', () => {
    Sfx.click();
    if (loadGame()) {
      setScreen('world');
      showZone(currentZoneName());
      toast('つづきから はじめる！');
    }
  });
  $('#btn-back-title').addEventListener('click', () => { Sfx.click(); setScreen('title'); });
  $('#btn-menu').addEventListener('click', () => openMenu());

  window.addEventListener('pointerdown', () => Sfx.ensure(), { once: true });
  requestAnimationFrame(loop);
}
document.addEventListener('DOMContentLoaded', init);
