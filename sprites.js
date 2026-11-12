/* ============================================================
   パチモン — スプライト描画
   すべて さいほうてきに かく。パクリなので ていげん は おく。
   ============================================================ */
'use strict';

const TAU = Math.PI * 2;

/* ローカル座標: 足元が (0,0) 、上向きが -Y 。たかさ だいたい 120 */
const ART = {
  fushigidame: { shape:'seed',   c1:'#7cc576', c2:'#4f9e58', c3:'#b7e6a8', spot:'#3f8a49' },
  fushigisou:  { shape:'seed',   c1:'#69b96d', c2:'#3f8c4a', c3:'#a8dca0', spot:'#3f8c4a', flower:'#f28fc0', petals:'#f28fc0' },
  hitokage:    { shape:'lizard', c1:'#f2913d', c2:'#e0662a', c3:'#ffd27a' },
  rizardo:     { shape:'lizard', c1:'#e2693a', c2:'#c8482a', c3:'#ffcf8a', horn:true },
  zenigame:    { shape:'turtle', c1:'#6fc3e8', c2:'#c98a4b', c3:'#f2e0b8' },
  kameel:      { shape:'turtle', c1:'#5aaede', c2:'#b5723a', c3:'#f7e6c0', big:true },
  pikachun:    { shape:'mouse',  c1:'#f7d63e', c2:'#2f2f36', c3:'#fdf0a8', cheek:'#e8523c' },
  raichun:     { shape:'mouse',  c1:'#efbf24', c2:'#2f2f36', c3:'#ffe98a', cheek:'#e8523c', tuft:true },
  poppo:       { shape:'bird',   c1:'#c9a26b', c2:'#8d6b42', c3:'#f4e3c2', beak:'#e5a13c' },
  pijon:       { shape:'bird',   c1:'#b48a55', c2:'#7b5a36', c3:'#f4e3c2', beak:'#e5a13c', crest:true },
  koratta:     { shape:'rat',    c1:'#9c7fce', c2:'#6d54a0', c3:'#e6d9f7' },
  ratta:       { shape:'rat',    c1:'#8a68c2', c2:'#5c468c', c3:'#e0cef5', big:true },
  mushimushi:  { shape:'worm',   c1:'#8cc63f', c2:'#5f9427', c3:'#d8f0a8' },
  batafun:     { shape:'worm',  c1:'#7fb8e8', c2:'#4b7fb5', c3:'#d9edfb', wings:true },
  ishitsubute: { shape:'rock',   c1:'#8f8a80', c2:'#6e6a62', c3:'#b9b3a8' },
  goroon:      { shape:'rock',   c1:'#7a756c', c2:'#57534c', c3:'#a8a297', big:true },
  ghosu:       { shape:'ghost',  c1:'#8a63c9', c2:'#5f3f96', c3:'#c9b2ea' },
  genga:       { shape:'ghost',  c1:'#6f46b0', c2:'#452a78', c3:'#b294e0', grin:true },
  kairyuu:     { shape:'dragon', c1:'#e8a04f', c2:'#c97a2e', c3:'#ffe0a8' },
  yadon:       { shape:'pink',  c1:'#f2a3c0', c2:'#d97fa8', c3:'#ffe0ec', variant:'slow' },
  purin:       { shape:'pink',  c1:'#f7b4cc', c2:'#e08cb0', c3:'#ffe6f0', variant:'ball' },
};

/* --- 描画ヘルパ --- */
function el(ctx, x, y, rx, ry, fill, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}
function circle(ctx, x, y, r, fill) { el(ctx, x, y, r, r, fill); }
function shadow(ctx, rx = 46, ry = 10, a = 0.18) {
  ctx.fillStyle = `rgba(15,25,18,${a})`;
  ctx.beginPath(); ctx.ellipse(0, 6, rx, ry, 0, 0, TAU); ctx.fill();
}
function eyeDot(ctx, x, y, r = 6) {
  circle(ctx, x, y, r, '#2b2b33');
  circle(ctx, x - r * 0.32, y - r * 0.35, r * 0.34, '#fff');
}
function roundEye(ctx, x, y, r = 9) {
  el(ctx, x, y, r, r * 1.12, '#fff');
  const p = Math.sin(Date.now() / 900) * r * 0.18;
  circle(ctx, x + r * 0.12, y + p, r * 0.46, '#2b2b33');
  circle(ctx, x - r * 0.05, y - r * 0.4, r * 0.16, '#fff');
}
function smile(ctx, x, y, w = 12) {
  ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y, w / 2, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
}
function blush(ctx, x, y, r = 6) {
  ctx.globalAlpha = 0.55; circle(ctx, x, y, r, '#f78c8c'); ctx.globalAlpha = 1;
}

/* ============================================================
   drawPachimon(ctx, speciesId, x, y, scale, time, opts)
   opts: { flip, dead, silhouette }
   ============================================================ */
function drawPachimon(ctx, speciesId, x, y, scale, time, opts = {}) {
  const a = ART[speciesId] || ART.koratta;
  const flip = !!opts.flip;
  const t = time || Date.now();
  ctx.save();
  ctx.translate(x, y);

  const bob = a.shape === 'ghost'
    ? Math.sin(t / 500) * 6 * scale
    : Math.abs(Math.sin(t / 380)) * -2.5 * scale;
  ctx.translate(0, bob);
  if (flip) ctx.scale(-1, 1);
  ctx.scale(scale, scale);

  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 12 * scale;
  ctx.shadowOffsetY = 6 * scale;
  drawShape(ctx, a, t);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.restore();
}

/* キャンバスに シルエット (未発見の ずかん用) を 描く */
function drawSilhouette(canvas, speciesId, scale = 0.62) {
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, canvas.width, canvas.height);
  drawPachimon(c, speciesId, canvas.width / 2, canvas.height - 8, scale, Date.now(), {});
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = '#39406b';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.globalCompositeOperation = 'source-over';
}

function drawShape(ctx, a, t) {
  shadow(ctx, a.shape === 'ghost' ? 34 : 44, 10, a.shape === 'ghost' ? 0.1 : 0.18);
  switch (a.shape) {
    case 'mouse':  return _mouse(ctx, a, t);
    case 'lizard': return _lizard(ctx, a, t);
    case 'turtle': return _turtle(ctx, a, t);
    case 'seed':   return _seed(ctx, a, t);
    case 'bird':   return _bird(ctx, a, t);
    case 'rat':    return _rat(ctx, a, t);
    case 'worm':   return _worm(ctx, a, t);
    case 'rock':   return _rock(ctx, a, t);
    case 'ghost':  return _ghost(ctx, a, t);
    case 'dragon': return _dragon(ctx, a, t);
    case 'pink':   return a.variant === 'ball' ? _purin(ctx, a, t) : _yadon(ctx, a, t);
    default:       return _mouse(ctx, a, t);
  }
}

/* ---------- パチュウ系 ---------- */
function _mouse(ctx, a, t) {
  // かみなりしっぽ
  ctx.fillStyle = a.c3;
  ctx.beginPath();
  ctx.moveTo(-30, -30);
  ctx.lineTo(-46, -46);
  ctx.lineTo(-36, -50);
  ctx.lineTo(-52, -70);
  ctx.lineTo(-40, -70);
  ctx.lineTo(-56, -92);
  ctx.lineTo(-30, -78);
  ctx.lineTo(-42, -62);
  ctx.lineTo(-26, -58);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = a.c2; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
  // からだ
  el(ctx, 0, -32, 33, 33, a.c1);
  el(ctx, 0, -25, 21, 22, a.c3);
  el(ctx, -30, -36, 10, 15, a.c1, 0.5);
  el(ctx, 30, -36, 10, 15, a.c1, -0.5);
  el(ctx, -15, -4, 14, 8, a.c1);
  el(ctx, 15, -4, 14, 8, a.c1);
  // あたま
  circle(ctx, 0, -73, 35, a.c1);
  // みみ
  const earWag = Math.sin(t / 300) * 3;
  for (const s of [-1, 1]) {
    el(ctx, s * 21, -102 + earWag * (s > 0 ? 1 : -1), 10, 27, a.c1, s * 0.3);
    el(ctx, s * 26, -118 + earWag * (s > 0 ? 1 : -1), 6, 11, a.c2, s * 0.3);
  }
  if (a.tuft) { // ドンパチュウの とげとげ
    for (let i = -2; i <= 2; i++) el(ctx, i * 9, -104, 4, 9, a.c2, i * 0.15);
  }
  // かお
  circle(ctx, -24, -68, 8, a.cheek);
  circle(ctx, 24, -68, 8, a.cheek);
  eyeDot(ctx, -12, -80, 6.5);
  eyeDot(ctx, 12, -80, 6.5);
  circle(ctx, 0, -68, 3, a.c2);
  smile(ctx, 0, -64, 14);
}

/* ---------- ヒトカゲン系 ---------- */
function _lizard(ctx, a, t) {
  // しっぽ + ほのお
  ctx.strokeStyle = a.c1; ctx.lineWidth = 13; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-18, -18); ctx.quadraticCurveTo(-44, -22, -52, -44); ctx.stroke();
  const f = Math.sin(t / 120) * 3;
  el(ctx, -54, -52, 12 + f, 16, '#ffd23e', -0.2);
  el(ctx, -55, -56, 7, 11, '#ff8f3c', -0.2);
  el(ctx, -56, -60, 4, 6, '#fff2b0', -0.2);
  // あし
  el(ctx, -13, -3, 11, 7, a.c1);
  el(ctx, 13, -3, 11, 7, a.c1);
  // からだ
  el(ctx, 0, -32, 27, 30, a.c1);
  el(ctx, 2, -26, 17, 21, a.c3);
  el(ctx, -24, -38, 8, 13, a.c1, 0.6);
  el(ctx, 24, -38, 8, 13, a.c1, -0.6);
  // あたま
  circle(ctx, 0, -70, 30, a.c1);
  el(ctx, 0, -60, 21, 14, a.c1);
  if (a.horn) { el(ctx, -6, -102, 5, 12, a.c2, 0.2); el(ctx, 6, -102, 5, 12, a.c2, -0.2); }
  eyeDot(ctx, -12, -77, 6);
  eyeDot(ctx, 12, -77, 6);
  circle(ctx, -6, -58, 1.8, a.c2);
  circle(ctx, 6, -58, 1.8, a.c2);
  smile(ctx, 0, -56, 12);
}

/* ---------- ゼニガメラ系 ---------- */
function _turtle(ctx, a, t) {
  // こうら
  const sw = Math.sin(t / 260) * 2;
  el(ctx, -2 + sw, -36, 36, 34, a.c2);
  el(ctx, -2 + sw, -36, 27, 25, a.c3);
  ctx.strokeStyle = a.c2; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-2 + sw, -58); ctx.lineTo(-2 + sw, -14);
  ctx.moveTo(-20 + sw, -36); ctx.lineTo(16 + sw, -36);
  ctx.stroke();
  // あし・て
  el(ctx, -22, -4, 13, 8, a.c1);
  el(ctx, 22, -4, 13, 8, a.c1);
  el(ctx, -26, -40, 9, 12, a.c1, 0.5);
  el(ctx, 26, -40, 9, 12, a.c1, -0.5);
  // からだ
  el(ctx, 6, -32, 22, 26, a.c1);
  el(ctx, 6, -26, 13, 15, a.c3);
  // あたま
  circle(ctx, 16, -72, 27, a.c1);
  el(ctx, 32, -66, 10, 9, a.c1);
  eyeDot(ctx, 8, -78, 6);
  eyeDot(ctx, 26, -78, 6);
  circle(ctx, 18, -62, 2, a.c2);
  circle(ctx, 27, -62, 2, a.c2);
  smile(ctx, 20, -58, 12);
}

/* ---------- フシギダメ系 ---------- */
function _seed(ctx, a, t) {
  // おんなじ あし
  for (const p of [[-26, -2], [-10, 0], [12, 0], [26, -2]]) el(ctx, p[0], p[1], 11, 7, a.c1);
  // からだ
  el(ctx, 0, -32, 40, 26, a.c1);
  // おむかえの たね
  const bw = Math.sin(t / 320) * 2;
  circle(ctx, -6, -66 + bw, 24, a.c2);
  for (const s of [[-16, -70], [2, -76], [-4, -58]]) circle(ctx, s[0], s[1] + bw, 5, a.spot);
  if (a.flower) {
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * TAU - Math.PI / 2;
      el(ctx, -6 + Math.cos(ang) * 15, -66 + bw + Math.sin(ang) * 15, 10, 10, a.petals);
    }
    circle(ctx, -6, -66 + bw, 8, '#ffe084');
  }
  // あたま
  circle(ctx, 30, -58, 22, a.c1);
  // みみ
  ctx.fillStyle = a.c1;
  ctx.beginPath(); ctx.moveTo(20, -72); ctx.lineTo(14, -92); ctx.lineTo(30, -80); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(42, -74); ctx.lineTo(52, -92); ctx.lineTo(46, -70); ctx.closePath(); ctx.fill();
  // かお
  eyeDot(ctx, 24, -62, 6);
  eyeDot(ctx, 40, -62, 6);
  circle(ctx, 36, -50, 2.4, a.c2);
  smile(ctx, 36, -46, 12);
  blush(ctx, 20, -50, 5);
  blush(ctx, 48, -52, 5);
}

/* ---------- ポッポン系 ---------- */
function _bird(ctx, a, t) {
  const flap = Math.sin(t / 240);
  // しっぽ
  ctx.fillStyle = a.c2;
  ctx.beginPath(); ctx.moveTo(-22, -30); ctx.lineTo(-52, -18); ctx.lineTo(-46, -40); ctx.closePath(); ctx.fill();
  // はね
  el(ctx, -26, -36, 14, 22 + flap * 6, a.c2, 0.5);
  el(ctx, 26, -36, 14, 22 + flap * 6, a.c2, -0.5);
  // からだ
  el(ctx, 0, -32, 28, 28, a.c1);
  el(ctx, 2, -27, 18, 19, a.c3);
  // あし
  ctx.strokeStyle = '#e5a13c'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(-8, 2); ctx.moveTo(8, -8); ctx.lineTo(8, 2); ctx.stroke();
  // あたま
  circle(ctx, 2, -68, 24, a.c1);
  // とさか
  if (a.crest) {
    el(ctx, 2, -92, 5, 12, '#e8788c', 0.1);
    el(ctx, 10, -88, 4, 9, '#e8788c', 0.3);
  }
  // くちばし
  ctx.fillStyle = a.beak;
  ctx.beginPath(); ctx.moveTo(22, -66); ctx.lineTo(42, -62); ctx.lineTo(22, -56); ctx.closePath(); ctx.fill();
  // め
  eyeDot(ctx, 6, -74, 5.5);
  eyeDot(ctx, 20, -74, 5.5);
  blush(ctx, -8, -60, 5);
}

/* ---------- コロッケ系 ---------- */
function _rat(ctx, a, t) {
  const sc = a.big ? 1.12 : 1;
  ctx.save(); ctx.scale(sc, sc);
  // しっぽ
  ctx.strokeStyle = a.c2; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-20, -20); ctx.quadraticCurveTo(-48, -14, -56, -38); ctx.stroke();
  // からだ
  el(ctx, 0, -28, 27, 26, a.c1);
  el(ctx, 4, -24, 16, 16, a.c3);
  el(ctx, -12, -2, 12, 6, a.c1);
  el(ctx, 12, -2, 12, 6, a.c1);
  el(ctx, -22, -32, 7, 11, a.c1, 0.5);
  el(ctx, 22, -32, 7, 11, a.c1, -0.5);
  // あたま
  circle(ctx, 4, -60, 26, a.c1);
  // みみ
  circle(ctx, -12, -80, 12, a.c1);
  circle(ctx, 20, -82, 12, a.c1);
  circle(ctx, -12, -80, 6, a.c3);
  circle(ctx, 20, -82, 6, a.c3);
  // め
  eyeDot(ctx, -4, -66, 5.5);
  eyeDot(ctx, 14, -66, 5.5);
  // まえば
  ctx.fillStyle = '#fff';
  el(ctx, 2, -48, 3.4, 6, '#fff');
  el(ctx, 9, -48, 3.4, 6, '#fff');
  ctx.strokeStyle = a.c2; ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-10, -52); ctx.lineTo(-24, -50);
  ctx.moveTo(-10, -48); ctx.lineTo(-24, -46);
  ctx.stroke();
  ctx.restore();
}

/* ---------- イモムシン系 ---------- */
function _worm(ctx, a, t) {
  const wig = Math.sin(t / 220);
  if (a.wings) { // バタフリン
    const flap = Math.sin(t / 150);
    ctx.globalAlpha = 0.85;
    el(ctx, -26, -70 + flap * 4, 26, 18, a.c3, -0.5 - flap * 0.1);
    el(ctx, 26, -70 - flap * 4, 26, 18, a.c3, 0.5 + flap * 0.1);
    el(ctx, -22, -52 + flap * 3, 18, 12, a.c3, -0.3);
    el(ctx, 22, -52 - flap * 3, 18, 12, a.c3, 0.3);
    ctx.globalAlpha = 1;
  }
  // からだの 節
  const segs = [[0, -8, 15], [wig * 3, -30, 17], [-wig * 3, -50, 17], [wig * 2, -66, 15]];
  for (const s of segs) circle(ctx, s[0], s[1], s[2], a.c1);
  for (const s of segs) circle(ctx, s[0] + 3, s[1] + 3, s[2] * 0.6, a.c3);
  // あたま
  circle(ctx, 0, -80, 17, a.c1);
  // あんてな
  ctx.strokeStyle = a.c2; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-8, -94); ctx.quadraticCurveTo(-14, -106, -20, -104);
  ctx.moveTo(8, -94); ctx.quadraticCurveTo(14, -106, 20, -104);
  ctx.stroke();
  circle(ctx, -20, -104, 4, a.c2);
  circle(ctx, 20, -104, 4, a.c2);
  roundEye(ctx, -7, -82, 8);
  roundEye(ctx, 7, -82, 8);
  smile(ctx, 0, -72, 10);
  blush(ctx, -14, -76, 4);
  blush(ctx, 14, -76, 4);
}

/* ---------- イシコロ系 ---------- */
function _rock(ctx, a, t) {
  const sc = a.big ? 1.15 : 1;
  ctx.save(); ctx.scale(sc, sc);
  // うで
  const wob = Math.sin(t / 300) * 3;
  circle(ctx, -34, -34 + wob, 13, a.c2);
  circle(ctx, -40, -22 + wob, 9, a.c1);
  circle(ctx, 34, -34 - wob, 13, a.c2);
  circle(ctx, 40, -22 - wob, 9, a.c1);
  // いわ
  ctx.fillStyle = a.c1;
  ctx.beginPath();
  ctx.moveTo(-32, -2);
  ctx.lineTo(-36, -34);
  ctx.lineTo(-18, -58);
  ctx.lineTo(10, -64);
  ctx.lineTo(32, -44);
  ctx.lineTo(34, -10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = a.c3;
  ctx.beginPath();
  ctx.moveTo(-20, -54); ctx.lineTo(2, -60); ctx.lineTo(-6, -44); ctx.closePath();
  ctx.fill();
  circle(ctx, 20, -30, 6, a.c3);
  // かお
  ctx.strokeStyle = a.c2; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-14, -44); ctx.lineTo(-2, -38);
  ctx.moveTo(16, -44); ctx.lineTo(4, -38);
  ctx.stroke();
  eyeDot(ctx, -10, -34, 5);
  eyeDot(ctx, 12, -34, 5);
  ctx.beginPath(); ctx.moveTo(-6, -22); ctx.lineTo(8, -22); ctx.stroke();
  ctx.restore();
}

/* ---------- ゴースケ系 ---------- */
function _ghost(ctx, a, t) {
  // ガスのもや
  ctx.globalAlpha = 0.25;
  circle(ctx, -24, -52, 20 + Math.sin(t / 400) * 3, a.c2);
  circle(ctx, 24, -48, 18 - Math.sin(t / 400) * 3, a.c2);
  ctx.globalAlpha = 1;
  // からだ
  ctx.fillStyle = a.c1;
  ctx.beginPath();
  ctx.arc(0, -58, 32, Math.PI, 0);
  ctx.lineTo(32, -22);
  for (let i = 0; i < 4; i++) {
    const x = 32 - i * 16;
    ctx.quadraticCurveTo(x - 8, -8 + Math.sin(t / 200 + i) * 3, x - 16, -22);
  }
  ctx.closePath();
  ctx.fill();
  el(ctx, 0, -48, 22, 12, a.c2, 0);
  // めと くち
  el(ctx, -11, -62, 7, 9, '#fff');
  el(ctx, 11, -62, 7, 9, '#fff');
  circle(ctx, -10, -61, 3.4, '#2b2b33');
  circle(ctx, 12, -61, 3.4, '#2b2b33');
  if (a.grin) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-10, -46); ctx.quadraticCurveTo(0, -38, 10, -46);
    ctx.lineTo(-10, -46);
    ctx.stroke();
    ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = 1.4;
    for (let i = -6; i <= 6; i += 4) {
      ctx.beginPath(); ctx.moveTo(i, -45); ctx.lineTo(i, -40); ctx.stroke();
    }
  } else {
    smile(ctx, 0, -44, 16);
  }
}

/* ---------- カイリュドン ---------- */
function _dragon(ctx, a, t) {
  const flap = Math.sin(t / 200);
  // はね
  ctx.fillStyle = a.c2;
  ctx.beginPath(); ctx.moveTo(-6, -56); ctx.lineTo(-46, -88 - flap * 6); ctx.lineTo(-38, -46); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-6, -56); ctx.lineTo(-44, -60 - flap * 6); ctx.lineTo(-30, -40); ctx.closePath(); ctx.fill();
  // しっぽ
  ctx.strokeStyle = a.c1; ctx.lineWidth = 15; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-14, -16); ctx.quadraticCurveTo(-44, -8, -56, -30); ctx.stroke();
  // あし
  el(ctx, -14, -2, 13, 8, a.c1);
  el(ctx, 14, -2, 13, 8, a.c1);
  // からだ
  el(ctx, 0, -34, 32, 32, a.c1);
  el(ctx, 4, -28, 19, 22, a.c3);
  el(ctx, -24, -40, 9, 14, a.c1, 0.5);
  el(ctx, 24, -40, 9, 14, a.c1, -0.5);
  // あたま
  circle(ctx, 4, -78, 30, a.c1);
  el(ctx, 22, -70, 20, 15, a.c1);
  el(ctx, 36, -66, 9, 8, a.c1);
  // ツノ
  ctx.fillStyle = a.c3;
  ctx.beginPath(); ctx.moveTo(-4, -104); ctx.lineTo(4, -82); ctx.lineTo(12, -98); ctx.closePath(); ctx.fill();
  // みみ
  el(ctx, -14, -94, 7, 12, a.c1, 0.4);
  // かお
  eyeDot(ctx, 0, -84, 6);
  eyeDot(ctx, 18, -84, 6);
  circle(ctx, 30, -72, 2.2, a.c2);
  circle(ctx, 38, -70, 2.2, a.c2);
  smile(ctx, 30, -64, 10);
  blush(ctx, -10, -70, 5);
}

/* ---------- ヨダレオン ---------- */
function _yadon(ctx, a, t) {
  // しっぽ
  ctx.strokeStyle = a.c1; ctx.lineWidth = 12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-24, -18); ctx.quadraticCurveTo(-52, -12, -58, -34); ctx.stroke();
  circle(ctx, -58, -38, 8, a.c3);
  // あし・て
  el(ctx, -16, -2, 13, 7, a.c1);
  el(ctx, 16, -2, 13, 7, a.c1);
  el(ctx, -28, -34, 8, 12, a.c1, 0.4);
  el(ctx, 28, -34, 8, 12, a.c1, -0.4);
  // からだ
  el(ctx, 0, -30, 36, 28, a.c1);
  el(ctx, 4, -26, 20, 16, a.c3);
  // あたま
  circle(ctx, 6, -68, 30, a.c1);
  el(ctx, 26, -60, 20, 15, a.c1);
  el(ctx, 42, -58, 9, 8, a.c3);
  // みみ
  circle(ctx, -8, -90, 8, a.c1);
  circle(ctx, 18, -94, 8, a.c1);
  // とろんとした め
  el(ctx, -4, -74, 8, 7, '#fff');
  el(ctx, 16, -74, 8, 7, '#fff');
  circle(ctx, -2, -72, 3.6, '#2b2b33');
  circle(ctx, 18, -72, 3.6, '#2b2b33');
  ctx.strokeStyle = a.c2; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-12, -80); ctx.quadraticCurveTo(-4, -86, 4, -81); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8, -81); ctx.quadraticCurveTo(16, -86, 24, -80); ctx.stroke();
  smile(ctx, 22, -58, 14);
  blush(ctx, -12, -62, 6);
}

/* ---------- プルン ---------- */
function _purin(ctx, a, t) {
  const breathe = Math.sin(t / 350) * 2;
  el(ctx, -13, -2, 12, 7, a.c2);
  el(ctx, 13, -2, 12, 7, a.c2);
  // からだ
  circle(ctx, 0, -46 + breathe * 0.5, 42, a.c1);
  el(ctx, 8, -30, 22, 16, a.c3);
  // て
  el(ctx, -36, -46 + breathe, 9, 12, a.c1, 0.5);
  el(ctx, 36, -46 - breathe, 9, 12, a.c1, -0.5);
  // みみ
  el(ctx, -16, -84, 10, 13, a.c2);
  el(ctx, 16, -84, 10, 13, a.c2);
  // アホ毛
  ctx.strokeStyle = a.c2; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -86); ctx.quadraticCurveTo(6, -104, 22, -96); ctx.stroke();
  // かお (くりくり 大きな め)
  const blink = (Math.sin(t / 1600) > -0.9) ? 1 : 0.1;
  el(ctx, -14, -60, 11, 12 * blink, '#fff');
  el(ctx, 14, -60, 11, 12 * blink, '#fff');
  if (blink > 0.5) {
    circle(ctx, -12, -58, 5, '#2b4fd8');
    circle(ctx, 16, -58, 5, '#2b4fd8');
    circle(ctx, -12, -58, 2.2, '#111');
    circle(ctx, 16, -58, 2.2, '#111');
    circle(ctx, -14, -63, 1.8, '#fff');
    circle(ctx, 14, -63, 1.8, '#fff');
  }
  ctx.strokeStyle = a.c2; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(-14, -61, 13, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.arc(14, -61, 13, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -42, 9, 0.1 * Math.PI, 0.9 * Math.PI); ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = 2.6; ctx.stroke();
  blush(ctx, -26, -48, 6);
  blush(ctx, 26, -48, 6);
}

/* ============================================================
   人間スプライト (マップ用)
   dir: down/up/left/right, walk: 0..1 の 歩行位相
   ============================================================ */
const PLAYER_LOOK = { cap:'#e8523c', jacket:'#4a90e2', pack:'#ffd23e', skin:'#ffe0c2', hair:'#5a4632' };

function drawTrainerSprite(ctx, x, y, dir, walk, colors, opts = {}) {
  colors = colors || PLAYER_LOOK;
  const step = Math.sin(walk * Math.PI * 2) * 4;
  const bob = walk > 0 ? Math.abs(Math.sin(walk * Math.PI * 2)) * -2 : 0;
  ctx.save();
  ctx.translate(x, y);
  if (opts.scale) ctx.scale(opts.scale, opts.scale);
  // かげ
  el(ctx, 0, 2, 13, 5, 'rgba(15,25,18,0.25)');
  ctx.translate(0, bob);
  const back = dir === 'up';
  // あし
  el(ctx, -5 + step * 0.4, -2, 4.5, 4, colors.jacket);
  el(ctx, 5 - step * 0.4, -2, 4.5, 4, colors.jacket);
  // からだ
  el(ctx, 0, -14, 10, 9, colors.jacket);
  // ザック
  if (!back) { el(ctx, 0, -16, 7, 7, colors.pack); }
  else { el(ctx, 0, -16, 10, 9, colors.pack); }
  // うで
  el(ctx, -11, -14 + (back ? 1 : 0), 3.4, 7, colors.jacket);
  el(ctx, 11, -14 + (back ? 1 : 0), 3.4, 7, colors.jacket);
  // あたま
  circle(ctx, 0, -27, 8.5, colors.skin);
  if (!back) {
    // かお (むき)
    if (dir === 'down') {
      circle(ctx, -3, -28, 1.4, '#2b2b33');
      circle(ctx, 3, -28, 1.4, '#2b2b33');
      smile(ctx, 0, -25, 5);
    } else {
      // よこむき
      const s = dir === 'left' ? -1 : 1;
      circle(ctx, s * 3.5, -28, 1.4, '#2b2b33');
      circle(ctx, s * 7, -28, 1.1, '#2b2b33');
    }
  }
  // ぼうし / かみのけ
  ctx.fillStyle = colors.cap;
  ctx.beginPath();
  ctx.arc(0, -30, 8.8, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  if (!back) {
    el(ctx, dir === 'left' ? -6 : 6, -31, 5, 2.4, colors.cap, 0);
    circle(ctx, 0, -38, 2.6, '#fff');
  } else {
    ctx.fillStyle = colors.hair;
    ctx.beginPath(); ctx.arc(0, -30, 8.8, Math.PI, 0); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
