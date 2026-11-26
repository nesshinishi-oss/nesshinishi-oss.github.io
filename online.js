/* ============================================================
   パチモン — ネット対戦
   PeerJS (WebRTC DataChannel) で あいてと つながり、
   おたがいの パチモンを Lv50 の コピーにして たたかいます。

   ・けいけんち / おかねは もらえない
   ・たいせん後の パーティ・HP・どうぐは そのまま
   ・わざ / こうかん / どうぐ / こうさん は ふつうどおり
   ============================================================ */
'use strict';

const PVP_LEVEL = 50;
const PVP_ROOM_PREFIX = 'pachimon-';
const PVP_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const Net = {
  libPromise: null,
  peer: null,
  pendingPeer: null,
  conn: null,
  role: null,            // 'host' | 'guest'
  code: '',
  state: 'idle',         // idle | starting | waiting | connected | battle | closed
  lobbyOpen: false,
  session: 0,
  connOpened: false,
  ignoreClose: false,
  oppPartyData: null,
  oppName: 'あいて',
  seed: 0,
  started: false,
  gotStart: false,
  startTimer: null,
  originalParty: null,
  ending: false,
  finished: false,
  actionQueue: [],
  actionWaiters: [],
  switchQueue: [],
  switchWaiters: [],
  checkQueue: [],
  checkWaiters: [],
  stateQueue: [],
  stateWaiters: [],

  send(msg) {
    if (!this.conn || !this.conn.open) return false;
    try { this.conn.send(msg); return true; } catch (e) { return false; }
  },
  waitAction() { return netWait(this.actionQueue, this.actionWaiters); },
  waitSwitch() { return netWait(this.switchQueue, this.switchWaiters); },
  waitCheck() { return netWait(this.checkQueue, this.checkWaiters); },
  waitState() { return netWait(this.stateQueue, this.stateWaiters); },
};

/* ---------------- 小物 ---------------- */
function netWait(queue, waiters) {
  if (queue.length) return Promise.resolve(queue.shift());
  return new Promise(res => waiters.push(res));
}
function netPush(queue, waiters, val) {
  if (waiters.length) waiters.shift()(val);
  else queue.push(val);
}
function netAbortWaiters() {
  for (const w of Net.actionWaiters.splice(0)) w(null);
  for (const w of Net.switchWaiters.splice(0)) w(null);
  for (const w of Net.checkWaiters.splice(0)) w(null);
  for (const w of Net.stateWaiters.splice(0)) w(null);
  Net.actionQueue.length = 0;
  Net.switchQueue.length = 0;
  Net.checkQueue.length = 0;
  Net.stateQueue.length = 0;
}
function netHash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36);
}
function netRandomCode() {
  let s = '';
  for (let i = 0; i < 6; i++) s += PVP_CODE_CHARS[Math.floor(Math.random() * PVP_CODE_CHARS.length)];
  return s;
}
function netNormalizeCode(v) {
  return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}
function netLoadPeerLib() {
  if (window.Peer) return Promise.resolve();
  if (Net.libPromise) return Net.libPromise;
  Net.libPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'peerjs.min.js';
    s.onload = () => window.Peer ? resolve() : reject(new Error('PeerJS not found'));
    s.onerror = () => reject(new Error('PeerJS load failed'));
    document.head.appendChild(s);
  });
  return Net.libPromise;
}
function netPeerOptions() {
  return {
    debug: 0,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
      ],
      iceCandidatePoolSize: 4,
    },
  };
}

/* ---------------- セッション ---------------- */
function netResetSession() {
  Net.session++;
  if (Net.startTimer) { clearTimeout(Net.startTimer); Net.startTimer = null; }
  netAbortWaiters();
  Net.oppPartyData = null;
  Net.oppName = 'あいて';
  Net.seed = 0;
  Net.started = false;
  Net.gotStart = false;
  Net.ending = false;
  Net.finished = false;
  Net.ignoreClose = false;
}
function netDispose() {
  Net.ignoreClose = true;
  try { if (Net.conn) Net.conn.close(); } catch (e) {}
  try { if (Net.pendingPeer) Net.pendingPeer.destroy(); } catch (e) {}
  try { if (Net.peer) Net.peer.destroy(); } catch (e) {}
  Net.conn = null;
  Net.pendingPeer = null;
  Net.peer = null;
  setTimeout(() => { Net.ignoreClose = false; }, 900);
}
function netCancel() {
  Net.session++;
  if (B && B.pvp && !B.over) { pvpAbort('たいせんを ちゅうだんしました…'); return; }
  if (Net.startTimer) { clearTimeout(Net.startTimer); Net.startTimer = null; }
  Net.ignoreClose = true;
  netDispose();
  Net.state = 'idle';
  Net.role = null;
  Net.code = '';
  Net.lobbyOpen = false;
  Net.oppPartyData = null;
  Net.started = false;
  Net.gotStart = false;
  if (modalOpen) closeModal();
}
function netOnClose() {
  if (Net.ignoreClose || Net.ending) return;
  netAbortWaiters();
  if (B && B.pvp && !B.over) {
    pvpAbort('あいてと の つながりが きれてしまった…');
    return;
  }
  const preOpen = !Net.connOpened;
  Net.connOpened = false;
  Net.conn = null;
  /* ホストは、まだ ひらいていない 接続が だめに なっただけなら
     ルームを のこしたまま あいてを まちつづける。 */
  if (preOpen && Net.role === 'host' && Net.state !== 'battle' && Net.lobbyOpen) {
    Net.state = 'waiting';
    netRenderWaiting();
    return;
  }
  Net.state = 'idle';
  Net.role = null;
  Net.code = '';
  netDispose();
  if (Net.lobbyOpen) netRenderError('あいてと の つながりが きれました。');
}

/* ---------------- 通信 ---------------- */
function netAttachConn(conn) {
  Net.conn = conn;
  Net.connOpened = false;
  let connTimer = setTimeout(() => {
    if (Net.conn !== conn || Net.connOpened) return;
    try { conn.close(); } catch (e) {}
    if (Net.conn === conn) Net.conn = null;
    if (Net.role === 'host' && Net.lobbyOpen) {
      Net.state = 'waiting';
      netRenderWaiting();
    } else if (Net.lobbyOpen) {
      Net.state = 'idle';
      netShowError(new Error('つながりませんでした。ルームコードと ネットワークを かくにんしてね。'));
    }
  }, 20000);
  conn.on('open', () => {
    clearTimeout(connTimer);
    if (Net.conn !== conn) return;
    Net.connOpened = true;
    if (Net.state === 'battle') return;
    Net.state = 'connected';
    Net.send({ t: 'hello', party: G.party.map(monData), name: 'あいて' });
    netSetStatus('あいてと つながりました！');
    netRenderMatchup(false);
    netMaybeStart();
  });
  conn.on('data', netHandleMessage);
  conn.on('close', () => {
    clearTimeout(connTimer);
    if (Net.conn !== conn) return;
    netOnClose();
  });
  conn.on('error', err => {
    clearTimeout(connTimer);
    if (Net.conn !== conn) return;
    if (Net.state === 'battle') return;
    netSetStatus('つうしんエラー: ' + (err && err.message ? err.message : String(err)), true);
  });
}
function netHandleMessage(raw) {
  const msg = raw && typeof raw === 'object' ? raw : null;
  if (!msg) return;
  if (msg.t === 'hello') {
    Net.oppPartyData = Array.isArray(msg.party) ? msg.party.slice(0, 6) : null;
    if (msg.name) Net.oppName = String(msg.name).slice(0, 16) || 'あいて';
    netMaybeStart();
    return;
  }
  if (msg.t === 'start') {
    Net.gotStart = true;
    Net.seed = (msg.seed >>> 0) || 1;
    netMaybeStart();
    return;
  }
  if (msg.t === 'action') { netPush(Net.actionQueue, Net.actionWaiters, msg.a); return; }
  if (msg.t === 'switch') { netPush(Net.switchQueue, Net.switchWaiters, msg.idx); return; }
  if (msg.t === 'check') {
    /* sum だけでなく、その ターンの まもる れんぞく カウントも いっしょに 送る。
       ふるい クライアントは sum だけ 送って くる ので、その ばあいも うけとれる
       ように して おく。 */
    netPush(Net.checkQueue, Net.checkWaiters, { sum: msg.sum, pc: msg.pc });
    return;
  }
  if (msg.t === 'state') {
    if (Net.stateWaiters.length) Net.stateWaiters.shift()(msg);
    else Net.stateQueue.push(msg);
    return;
  }
  if (msg.t === 'finish') { pvpRemoteFinish(msg.winner); return; }
  if (msg.t === 'bye') { netOnClose(); return; }
}
function netShowError(err) {
  const type = err && err.type;
  const text = {
    'peer-unavailable': 'その ルームコードの ルームが みつからないよ。コードを かくにんしてね。',
    'unavailable-id': 'その ルームコードは つかわれています。もういちど ためしてね。',
    'browser-incompatible': 'この ブラウザでは ネットたいせんが できません。',
    'network': 'ネットワークに つながりませんでした。',
    'server-error': 'シグナリング サーバーに つながりませんでした。',
    'socket-error': 'つうしんが きれてしまいました。',
    'socket-closed': 'つうしんが おわりました。',
  }[type] || ('つうしんエラー: ' + (err && err.message ? err.message : String(err)));
  if (B && B.pvp && !B.over) { pvpAbort('あいてと の つながりが きれてしまった…'); return; }
  netFatal(text);
}
function netFatal(text) {
  if (B && B.pvp && !B.over) { pvpAbort(text); return; }
  if (Net.startTimer) { clearTimeout(Net.startTimer); Net.startTimer = null; }
  Net.ignoreClose = true;
  netDispose();
  Net.state = 'idle';
  Net.role = null;
  Net.lobbyOpen = true;
  if (!modalOpen) {
    openModal('ネットたいせん', '', { tabs: false });
    modalCloser = () => { if (Net.lobbyOpen) netCancel(); };
  }
  netRenderError(text);
}

/* ---------------- ロビー UI ---------------- */
function netSetStatus(text, isError) {
  const el = document.getElementById('net-status');
  if (el) {
    el.textContent = text;
    el.classList.toggle('err', !!isError);
  } else if (isError) toast(text);
}
function netRenderLobby(html) {
  if (!Net.lobbyOpen || !modalOpen) return;
  const body = $('#modal-body');
  if (!body) return;
  body.innerHTML = html;
  paintThumbs(body);
  setTimeout(() => {
    if (modalOpen && Net.lobbyOpen) focusFirst(body);
  }, 0);
}
function netRenderError(text) {
  netRenderLobby(`
    <div class="net-lobby">
      <div class="net-error">${text}</div>
      <div class="net-btn-row">
        <button class="btn btn-blue" id="net-retry">もういちど</button>
        <button class="btn" id="net-close">とじる</button>
      </div>
    </div>`);
  const retry = $('#net-retry');
  if (retry) retry.addEventListener('click', () => { Sfx.click(); netRenderIdle(); });
  const close = $('#net-close');
  if (close) close.addEventListener('click', () => { Sfx.click(); netCancel(); });
}
function netRenderMenuTab(body) {
  body.innerHTML = `
    <div class="net-menu">
      <div class="net-hero">
        <div class="net-icon">🌐</div>
        <h3>ネットたいせん</h3>
        <p>ルームコードを おしえあって、ほかの パチモントレーナーと たいせん！</p>
        <ul class="net-rules">
          <li>おたがいの パチモンは <b>Lv50 こてい</b></li>
          <li>けいけんち・おかねは <b>もらえない</b></li>
          <li>わざ・こうかん・どうぐ・こうさん は ふつうどおり</li>
          <li>たいせん中に つかった どうぐは へりません</li>
        </ul>
      </div>
      <div class="net-btn-row">
        <button class="btn btn-yellow btn-big" id="net-menu-host">ルームを つくる</button>
        <button class="btn btn-blue btn-big" id="net-menu-join">ルームにはいる</button>
      </div>
      <p class="net-note">インターネットに つながっている ひつようが あります。<br>
        ルームコードは 6もじ。あいてに おしえてね。</p>
    </div>`;
  const host = $('#net-menu-host');
  if (host) host.addEventListener('click', () => { Sfx.click(); if (netOpenLobby()) netHost(); });
  const join = $('#net-menu-join');
  if (join) join.addEventListener('click', () => { Sfx.click(); if (netOpenLobby()) netShowJoinForm(); });
}
function netOpenLobby() {
  if (!G.party.length) { toast('パチモンが いません…'); return false; }
  Net.lobbyOpen = true;
  Net.state = 'idle';
  Net.role = null;
  Net.code = '';
  netResetSession();
  openModal('ネットたいせん', '', { tabs: false });
  modalCloser = () => { if (Net.lobbyOpen) netCancel(); };
  netRenderIdle();
  return true;
}
function netRenderIdle() {
  netRenderLobby(`
    <div class="net-lobby">
      <div class="net-hero">
        <div class="net-icon">🌐</div>
        <h3>ネットたいせん</h3>
        <p>ルームコードを おしえあって、ほかの パチモントレーナーと たいせん！</p>
        <ul class="net-rules">
          <li>おたがいの パチモンは <b>Lv50 こてい</b></li>
          <li>けいけんち・おかねは <b>もらえない</b></li>
          <li>わざ・こうかん・どうぐ・こうさん は ふつうどおり</li>
          <li>たいせん中に つかった どうぐは へりません</li>
        </ul>
      </div>
      <div class="net-btn-row">
        <button class="btn btn-yellow btn-big" id="net-host">ルームを つくる</button>
        <button class="btn btn-blue btn-big" id="net-join-open">ルームにはいる</button>
      </div>
      <div class="net-join-box hidden" id="net-join-box">
        <label for="net-code-input">ルームコード（6もじ）</label>
        <div class="net-join-row">
          <input id="net-code-input" class="net-code-input" maxlength="6" autocomplete="off"
            spellcheck="false" inputmode="text" placeholder="ABC123">
          <button class="btn btn-green" id="net-join-go">つながる</button>
        </div>
      </div>
      <p class="net-status" id="net-status"></p>
      <button class="btn" id="net-close">とじる</button>
    </div>`);
  const host = $('#net-host');
  if (host) host.addEventListener('click', () => { Sfx.click(); netHost(); });
  const joinOpen = $('#net-join-open');
  if (joinOpen) joinOpen.addEventListener('click', () => { Sfx.click(); netShowJoinForm(); });
  const close = $('#net-close');
  if (close) close.addEventListener('click', () => { Sfx.click(); netCancel(); });
}
function netShowJoinForm() {
  const box = $('#net-join-box');
  const input = $('#net-code-input');
  if (!box || !input) return;
  box.classList.remove('hidden');
  input.focus();
  const go = $('#net-join-go');
  if (go) go.onclick = () => { Sfx.click(); netJoin(netNormalizeCode(input.value)); };
  input.oninput = () => {
    const pos = input.selectionStart;
    input.value = netNormalizeCode(input.value);
    try { input.setSelectionRange(pos, pos); } catch (e) {}
  };
  input.onkeydown = e => {
    if (e.key === 'Enter') { e.preventDefault(); Sfx.click(); netJoin(netNormalizeCode(input.value)); }
  };
}
function netRenderConnecting(text) {
  netRenderLobby(`
    <div class="net-lobby">
      <div class="net-hero">
        <div class="net-spinner"></div>
        <h3>${text}</h3>
        <p>すこし まってね…</p>
      </div>
      <p class="net-status" id="net-status"></p>
      <button class="btn btn-red" id="net-cancel">キャンセル</button>
    </div>`);
  const cancel = $('#net-cancel');
  if (cancel) cancel.addEventListener('click', () => { Sfx.click(); netCancel(); });
}
function netRenderWaiting() {
  netRenderLobby(`
    <div class="net-lobby">
      <div class="net-hero">
        <div class="net-icon">📡</div>
        <h3>あいてを まっています…</h3>
        <p>この ルームコードを あいてに おしえてね</p>
      </div>
      <div class="net-code-wrap">
        <div class="net-code" id="net-code">${Net.code}</div>
        <button class="btn btn-blue" id="net-copy">コピー</button>
      </div>
      <p class="net-status" id="net-status">あいてが はいるのを まっています…</p>
      <p class="net-note">あいても パチモンを ひらいて<br>「メニュー → たいせん → ルームにはいる」</p>
      <button class="btn btn-red" id="net-cancel">キャンセル</button>
    </div>`);
  const copy = $('#net-copy');
  if (copy) copy.addEventListener('click', async () => {
    Sfx.click();
    try {
      await navigator.clipboard.writeText(Net.code);
      toast('ルームコードを コピーした！');
    } catch (e) {
      const el = $('#net-code');
      if (el) {
        const r = document.createRange();
        r.selectNodeContents(el);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        toast('コードを えらんだよ。コピーしてね');
      }
    }
  });
  const cancel = $('#net-cancel');
  if (cancel) cancel.addEventListener('click', () => { Sfx.click(); netCancel(); });
}
function netLeadInfo(teamData, isLocal) {
  if (isLocal) {
    const m = G.party[0];
    if (!m) return { name: '—', species: null, count: 0 };
    return { name: SPECIES[m.species] ? SPECIES[m.species].name : '—', species: m.species, count: G.party.length };
  }
  const d = (teamData || [])[0];
  if (!d || !SPECIES[d.species]) return { name: '—', species: null, count: 0 };
  return { name: SPECIES[d.species].name, species: d.species, count: (teamData || []).length };
}
function netRenderMatchup(starting) {
  if (!Net.lobbyOpen) return;
  const my = netLeadInfo(null, true);
  const op = netLeadInfo(Net.oppPartyData, false);
  const mySprite = my.species ? thumb(my.species, 92) : '';
  const opSprite = op.species ? thumb(op.species, 92, '', ' data-flip="1"') : '';
  netRenderLobby(`
    <div class="net-lobby">
      <div class="net-hero">
        <h3>${starting ? 'まもなく たいせん かいし！' : 'マッチング せいこう！'}</h3>
        <p>おたがいの パチモンは Lv${PVP_LEVEL} こてい。けいけんち・おかねは もらえません。</p>
      </div>
      <div class="net-vs">
        <div class="net-side">
          ${mySprite}
          <b>あなた</b>
          <span>${my.name}・${my.count}ひき</span>
        </div>
        <div class="net-vs-mark">VS</div>
        <div class="net-side">
          ${opSprite}
          <b>${Net.oppName}</b>
          <span>${op.name}・${op.count}ひき</span>
        </div>
      </div>
      <p class="net-status" id="net-status">${starting ? 'たいせんを はじめます…' : 'あいての じゅんびを まっています…'}</p>
      <button class="btn btn-red" id="net-cancel">キャンセル</button>
    </div>`);
  const cancel = $('#net-cancel');
  if (cancel) cancel.addEventListener('click', () => { Sfx.click(); netCancel(); });
}

/* ---------------- ホスト / ゲスト ---------------- */
async function netHost() {
  if (Net.state !== 'idle') return;
  if (!G.party.length) { toast('パチモンが いません…'); return; }
  netResetSession();
  const session = Net.session;
  Net.role = 'host';
  Net.state = 'starting';
  Net.lobbyOpen = true;
  netRenderConnecting('ルームを つくっています…');
  try {
    await netLoadPeerLib();
  } catch (e) {
    netFatal('つうしん ライブラリを よみこめませんでした。インターネット接続を かくにんしてね。');
    return;
  }
  if (session !== Net.session) return;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (session !== Net.session) return;
    const code = netRandomCode();
    const peer = new Peer(PVP_ROOM_PREFIX + code, netPeerOptions());
    Net.pendingPeer = peer;
    const res = await new Promise(resolve => {
      let done = false;
      const finish = v => { if (!done) { done = true; clearTimeout(timer); resolve(v); } };
      const timer = setTimeout(() => finish('timeout'), 20000);
      peer.on('open', () => finish('open'));
      peer.on('error', err => finish(err || 'error'));
    });
    if (Net.pendingPeer === peer) Net.pendingPeer = null;
    if (session !== Net.session) { try { peer.destroy(); } catch (e) {} return; }
    if (res === 'open') {
      Net.peer = peer;
      Net.code = code;
      Net.state = 'waiting';
      peer.on('connection', conn => {
        if (Net.peer !== peer) { try { conn.close(); } catch (e) {} return; }
        if (Net.conn) { try { conn.close(); } catch (e) {} return; }
        netAttachConn(conn);
      });
      peer.on('error', err => { if (Net.peer === peer) netShowError(err); });
      peer.on('disconnected', () => {
        if (Net.peer === peer && Net.state !== 'battle') { try { peer.reconnect(); } catch (e) {} }
      });
      netRenderWaiting();
      return;
    }
    try { peer.destroy(); } catch (e) {}
    if (res && res.type === 'unavailable-id') continue;
    netShowError(res && res.type ? res : new Error('room create failed'));
    return;
  }
  netFatal('ルームを つくれませんでした。もういちど ためしてね。');
}

async function netJoin(code) {
  if (Net.state !== 'idle') return;
  if (code.length !== 6) { netSetStatus('ルームコードは 6もじだよ。', true); return; }
  if (!G.party.length) { toast('パチモンが いません…'); return; }
  netResetSession();
  const session = Net.session;
  Net.role = 'guest';
  Net.code = code;
  Net.state = 'starting';
  Net.lobbyOpen = true;
  netRenderConnecting('ルームに はいっています…');
  try {
    await netLoadPeerLib();
  } catch (e) {
    netFatal('つうしん ライブラリを よみこめませんでした。インターネット接続を かくにんしてね。');
    return;
  }
  if (session !== Net.session) return;

  const peer = new Peer(netPeerOptions());
  Net.pendingPeer = peer;
  const res = await new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; clearTimeout(timer); resolve(v); } };
    const timer = setTimeout(() => finish('timeout'), 20000);
    peer.on('open', () => finish('open'));
    peer.on('error', err => finish(err || 'error'));
  });
  if (Net.pendingPeer === peer) Net.pendingPeer = null;
  if (session !== Net.session) { try { peer.destroy(); } catch (e) {} return; }
  if (res !== 'open') {
    try { peer.destroy(); } catch (e) {}
    netShowError(res && res.type ? res : new Error('connect failed'));
    return;
  }
  Net.peer = peer;
  peer.on('error', err => { if (Net.peer === peer) netShowError(err); });
  peer.on('disconnected', () => {
    if (Net.peer === peer && Net.state !== 'battle') { try { peer.reconnect(); } catch (e) {} }
  });
  const conn = peer.connect(PVP_ROOM_PREFIX + code, { reliable: true });
  Net.conn = conn;
  netAttachConn(conn);
  setTimeout(() => {
    if (session !== Net.session) return;
    if (Net.state === 'starting' || Net.state === 'waiting') {
      if (Net.state !== 'battle') netShowError(new Error('つながりませんでした。ルームコードと ネットワークを かくにんしてね。'));
    }
  }, 30000);
}

function netMaybeStart() {
  if (Net.state !== 'connected') return;
  if (!Net.oppPartyData || !G.party.length) return;
  if (Net.role === 'guest') {
    if (Net.gotStart) {
      netRenderMatchup(true);
      netScheduleBattle();
    } else {
      netRenderMatchup(false);
    }
    return;
  }
  if (!Net.started) {
    Net.started = true;
    Net.seed = (Math.random() * 0xFFFFFFFF) >>> 0;
    Net.send({ t: 'start', seed: Net.seed });
    netRenderMatchup(true);
    netScheduleBattle();
  }
}
function netScheduleBattle() {
  if (Net.startTimer) return;
  Net.startTimer = setTimeout(() => {
    Net.startTimer = null;
    if (Net.state === 'connected') netBeginBattle();
  }, 1400);
}
async function netBeginBattle() {
  if (Net.state !== 'connected') return;
  if (!Net.oppPartyData || !G.party.length) return;
  if (battleActive) {
    toast('いまは ネットたいせんを はじめられません…');
    netCancel();
    return;
  }
  Net.state = 'battle';
  Net.lobbyOpen = false;
  if (Net.startTimer) { clearTimeout(Net.startTimer); Net.startTimer = null; }
  modalCloser = null;
  if (modalOpen) closeModal();
  Sfx.catchOk();
  try {
    const started = await startPvpBattle(Net.oppPartyData, {
      mySide: Net.role,
      seed: Net.seed,
      oppName: Net.oppName,
    });
    if (!started) {
      if (Net.originalParty) { G.party = Net.originalParty; Net.originalParty = null; }
      netDispose();
      Net.state = 'idle';
      Net.role = null;
      Net.code = '';
      Net.lobbyOpen = false;
      toast('たいせんを はじめられませんでした…');
    }
  } catch (err) {
    console.error(err);
    pvpAbort('たいせんを はじめられませんでした…');
  }
}

/* ============================================================
   パチモン コピー / ターン 進行
   ============================================================ */
function pvpCloneMon(src) {
  if (!src || !src.species || !SPECIES[src.species]) return null;
  const data = (src.maxHp != null) ? monData(src) : src;
  if (!data || !SPECIES[data.species]) return null;
  const c = hydrateMon(data);
  c.level = PVP_LEVEL;
  c.exp = 0;
  c.status = null;
  c.sleepTurns = 0;
  c.toxicCounter = 0;
  c.moves = (c.moves || []).map(x => ({ id: x.id, pp: MOVES[x.id] ? MOVES[x.id].pp : x.pp }));
  if (!c.moves.length) c.moves = defaultMoves(c.species, PVP_LEVEL);
  resetMonBattleState(c);
  recalcStats(c);
  c.hp = c.maxHp;
  c.evoPending = false;
  return c;
}

function pvpEngineSide(side) { return B && side === B.mySide ? 'player' : 'enemy'; }
function pvpMon(side) { return B && side === B.mySide ? G.party[0] : B.enemy; }
function pvpOther(side) { return B && side === B.mySide ? B.oppSide : B.mySide; }
function pvpTeam(side) { return B && side === B.mySide ? G.party : B.team; }
function pvpSlot(mon, index) {
  if (!mon || index == null) return null;
  const slot = mon.moves[index];
  if (!slot || slot.pp <= 0) return null;
  if (mon.choiceLock && slot.id !== mon.choiceLock) return null;
  return slot;
}
function pvpMoveOf(mon, act) {
  const slot = pvpSlot(mon, act && act.index);
  return slot ? MOVES[slot.id] : STRUGGLE;
}
function pvpWaitUI(text) {
  const a = $('#battle-actions');
  if (!a) return;
  a.className = 'battle-actions';
  a.innerHTML = `<div class="net-wait"><span class="net-dot"></span>${text}</div>`;
}
function pvpChooseAction(st) {
  return new Promise(resolve => {
    st.actionResolve = resolve;
    st.actionChosen = false;
  });
}
function pvpResolveAction(st, action) {
  if (!st || !st.actionResolve || st.actionChosen) return;
  st.actionChosen = true;
  const resolve = st.actionResolve;
  st.actionResolve = null;
  hideActions();
  resolve(action);
}
async function pvpActionClick(act) {
  const st = B;
  if (!st || !st.pvp || st.busy || st.over || st.actionChosen) return;
  if (!st.actionResolve) return;

  if (act === 'run') {
    if (!confirm('こうさんして たいせんを おわりますか？')) { showMainActions(); return; }
    pvpResolveAction(st, { type: 'run' });
    return;
  }
  if (act === 'struggle') {
    pvpResolveAction(st, { type: 'move', index: null });
    return;
  }
  if (act.startsWith('move:')) {
    const index = Number(act.split(':')[1]);
    const me = G.party[0];
    const slot = me && me.moves[index];
    if (!slot || slot.pp <= 0) return;
    if (me.choiceLock && me.choiceLock !== slot.id) return;
    pvpResolveAction(st, { type: 'move', index });
    return;
  }
  if (act === 'switch') {
    const idx = await pickParty({
      title: 'だれと こうかんする？',
      aliveOnly: true,
      cancelable: true,
    });
    if (!B || B !== st || st.over) return;
    if (idx == null) { showMainActions(); return; }
    if (idx === 0) { toast('すでに せんとう中だ！'); showMainActions(); return; }
    pvpResolveAction(st, { type: 'switch', idx });
    return;
  }
  if (act.startsWith('item:')) {
    const id = act.split(':')[1];
    const it = ITEMS[id];
    if (!it || it.kind === 'ball') return;
    const left = (G.items[id] || 0) - ((st.pvpUsed && st.pvpUsed[id]) || 0);
    if (left <= 0) { toast('その どうぐは もう ないよ…'); showBagMenu(); return; }
    if (it.kind === 'battle') {
      pvpResolveAction(st, { type: 'item', id, target: 0 });
      return;
    }
    const idx = await pickParty({
      title: `${it.name}を だれに つかう？`,
      aliveOnly: false,
      cancelable: true,
    });
    if (!B || B !== st || st.over) return;
    if (idx == null) { showBagMenu(); return; }
    if (!pvpCanUseItem(id, G.party[idx])) {
      toast('その パチモンには つかえない…');
      showBagMenu();
      return;
    }
    pvpResolveAction(st, { type: 'item', id, target: idx });
  }
}
function pvpCanUseItem(id, mon) {
  const it = ITEMS[id];
  if (!it || !mon) return false;
  if (it.kind === 'heal') {
    if (mon.hp <= 0) return false;
    const cures = curesFor(it);
    if (mon.status && cures.includes(mon.status)) return true;
    return mon.hp < mon.maxHp;
  }
  if (it.kind === 'status') return !!(mon.status && curesFor(it).includes(mon.status));
  if (it.kind === 'revive') return mon.hp <= 0;
  return false;
}

async function pvpLoop() {
  const st = B;
  if (!st || !st.pvp) return;
  while (B && B === st && !st.over) {
    st.busy = false;
    st.turnInterrupted = false;
    updateBattleUI();
    showMainActions();
    const myAct = await pvpChooseAction(st);
    if (!B || B !== st || st.over) return;
    if (!myAct) return;
    hideActions();
    pvpWaitUI('あいての こうどうを まっています…');
    st.busy = true;
    Net.send({ t: 'action', a: myAct });
    const oppAct = await Net.waitAction();
    if (!oppAct) {
      if (B && B === st && !st.over) pvpAbort('あいての こうどうが とどきませんでした…');
      return;
    }
    if (!B || B !== st || st.over) return;
    pvpWaitUI('たいせん ちゅう…');
    await pvpResolveTurn(myAct, oppAct);
    if (!B || B !== st || st.over) return;
    await pvpSyncTurn(st);
  }
}

async function pvpResolveTurn(myAct, oppAct) {
  const st = B;
  if (!st || !st.pvp) return;
  st.turn++;
  clearTurnState();
  st.rng = makeBattleRng((st.seed ^ Math.imul(st.turn + 1, 0x9E3779B1)) >>> 0);
  const acts = {};
  acts[st.mySide] = myAct;
  acts[st.oppSide] = oppAct;
  const order = ['host', 'guest'];

  /* こうさん */
  if ((myAct && myAct.type === 'run') || (oppAct && oppAct.type === 'run')) {
    if (myAct && myAct.type === 'run' && oppAct && oppAct.type === 'run') {
      await pvpFinish('draw');
    } else {
      const winner = (myAct && myAct.type === 'run') ? st.oppSide : st.mySide;
      await pvpFinish(winner);
    }
    return;
  }

  /* こうかん / どうぐ は わざより さき */
  for (const side of order) {
    const a = acts[side];
    if (!a) continue;
    if (a.type === 'switch') await pvpApplySwitch(side, a.idx);
    else if (a.type === 'item') await pvpApplyItem(side, a);
    if (!B || B !== st || st.over) return;
  }

  /* ふいうちの はんてい用: この ターンに えらんだ わざ
     (こうかん・どうぐ の あとの 場の パチモンに 設定する) */
  for (const side of order) {
    const mon = pvpMon(side);
    const a = acts[side];
    if (!mon) continue;
    if (a && a.type === 'move') {
      const slot = pvpSlot(mon, a.index);
      mon.turnMoveId = mon.charging ? mon.charging.moveId : (slot ? slot.id : 'struggle');
    } else {
      mon.turnMoveId = null;
    }
  }

  const movers = order.filter(s => acts[s] && acts[s].type === 'move');
  if (movers.length) {
    for (const side of order) {
      const a = acts[side];
      if (!a || a.type !== 'move') continue;
      const mon = pvpMon(side);
      const slot = pvpSlot(mon, a.index);
      if (slot && mon && ['choiceband', 'choicespecs', 'choicescarf'].includes(mon.heldItem)) {
        mon.choiceLock = slot.id;
      }
    }
    if (movers.length === 1) {
      const side = movers[0];
      await pvpPerform(side, acts[side]);
      if (!B || B !== st || st.over) return;
      if (st.turnInterrupted) { st.turnInterrupted = false; return; }
    } else {
      const first = pvpFirstSide(acts);
      const second = first === 'host' ? 'guest' : 'host';
      await pvpPerform(first, acts[first]);
      if (!B || B !== st || st.over) return;
      if (st.turnInterrupted) { st.turnInterrupted = false; return; }
      await pvpPerform(second, acts[second]);
      if (!B || B !== st || st.over) return;
      if (st.turnInterrupted) { st.turnInterrupted = false; return; }
    }
  }

  await endOfTurn();
  if (!B || B !== st || st.over) return;
  if (st.turnInterrupted) st.turnInterrupted = false;
}

function pvpFirstSide(acts) {
  const hostMon = pvpMon('host');
  const guestMon = pvpMon('guest');
  const hostMove = pvpMoveOf(hostMon, acts.host);
  const guestMove = pvpMoveOf(guestMon, acts.guest);
  let hostQuick = false, guestQuick = false;
  if (hostMon && hostMon.heldItem === 'quickclaw') hostQuick = brng() < 0.2;
  if (guestMon && guestMon.heldItem === 'quickclaw') guestQuick = brng() < 0.2;
  if (hostQuick !== guestQuick) return hostQuick ? 'host' : 'guest';
  if (hostQuick && guestQuick) return brng() < 0.5 ? 'host' : 'guest';

  const hp = hostMove.priority || 0;
  const gp = guestMove.priority || 0;
  if (hp !== gp) return hp > gp ? 'host' : 'guest';
  const hs = hostMon ? effStat(hostMon, 'spe') : 1;
  const gs = guestMon ? effStat(guestMon, 'spe') : 1;
  if (hs !== gs) return hs > gs ? 'host' : 'guest';
  return brng() < 0.5 ? 'host' : 'guest';
}

async function pvpPerform(side, act) {
  const st = B;
  if (!st) return;
  const attacker = pvpMon(side);
  const defender = pvpMon(pvpOther(side));
  if (!attacker || !defender || attacker.hp <= 0 || defender.hp <= 0) return;
  const slot = pvpSlot(attacker, act && act.index);
  await performMove(attacker, defender, slot, pvpEngineSide(side) === 'player');
}

async function pvpApplySwitch(side, idx) {
  const st = B;
  if (!st) return;
  const local = side === st.mySide;
  const team = local ? G.party : st.team;
  if (!team || team.length < 2) return;
  let i = Number(idx);
  if (!Number.isInteger(i) || i <= 0 || i >= team.length || team[i].hp <= 0) {
    i = team.findIndex((m, k) => k > 0 && m.hp > 0);
  }
  if (i <= 0) return;
  const old = team[0];
  const mon = team.splice(i, 1)[0];
  team.unshift(mon);
  resetMonBattleState(old);
  resetMonBattleState(mon);
  if (local) mon.hasLed = true;
  else st.enemy = mon;
  updateBattleUI();
  enterAnim(local ? '#player-wrap' : '#enemy-wrap');
  await say(local ? `ゆけっ！ ${monName(mon)}！` : `あいては ${monName(mon)} を くりだした！`);
  await onEntry(pvpEngineSide(side));
  updateBattleUI();
}

async function pvpApplyItem(side, act) {
  const st = B;
  if (!st) return;
  const local = side === st.mySide;
  const team = local ? G.party : st.team;
  /* まもる れんぞく カウントは、どうぐを つかった 時点で リセット */
  if (team[0]) team[0].protectCount = 0;
  const it = ITEMS[act.id];
  if (!it || it.kind === 'ball') return;
  if (local) {
    const left = (G.items[act.id] || 0) - ((st.pvpUsed && st.pvpUsed[act.id]) || 0);
    if (left <= 0) return;
    st.pvpUsed[act.id] = ((st.pvpUsed && st.pvpUsed[act.id]) || 0) + 1;
  }
  let target = Number(act.target);
  if (!Number.isInteger(target) || target < 0 || target >= team.length) target = 0;
  const mon = team[target];
  if (!mon) return;
  if (it.kind === 'battle') {
    await say(local ? `${it.name}を つかった！` : `あいては ${it.name}を つかった！`);
    await changeStage(team[0], it.stat, it.stages, true);
    updateBattleUI();
    return;
  }
  const res = applyItemToMon(act.id, mon);
  if (!res.ok) return;
  await say(local ? `${it.name}を つかった！` : `あいては ${it.name}を つかった！`);
  await say(res.msg);
  Sfx.heal();
  updateBattleUI();
}

async function pvpHandleFaint(engineSide) {
  const st = B;
  if (!st || !st.pvp || st.over) return;
  st.turnInterrupted = true;
  const local = engineSide === 'player';
  const ownerSide = local ? st.mySide : st.oppSide;
  const mon = local ? G.party[0] : st.enemy;
  const team = local ? G.party : st.team;
  if (!mon) return;

  Sfx.faint();
  const wrap = $(local ? '#player-wrap' : '#enemy-wrap');
  if (wrap) wrap.classList.add('faint');
  await say(local ? `${monName(mon)} は たおれて たたかえない！` : `${monName(mon)} は たおれた！`);

  const other = local ? st.enemy : G.party[0];
  if (other && other.hp > 0 && other.ability === 'moxie' && ((other.stages && other.stages.atk) || 0) < 6) {
    await changeStage(other, 'atk', 1, true);
    if (!B || B !== st || st.over) return;
  }

  const alive = team.some(m => m.hp > 0);
  if (!alive) {
    const otherTeam = local ? st.team : G.party;
    const otherAlive = otherTeam.some(m => m.hp > 0);
    await pvpFinish(otherAlive ? (local ? st.oppSide : st.mySide) : 'draw');
    return;
  }

  let idx = null;
  if (local) {
    await say('つぎの パチモンを えらんでくれ！');
    idx = await pickParty({
      title: 'つぎの パチモンを えらんでね！',
      aliveOnly: true,
      cancelable: false,
    });
    if (!B || B !== st || st.over) return;
    if (idx == null || idx <= 0 || !team[idx] || team[idx].hp <= 0) {
      idx = team.findIndex((m, i) => i > 0 && m.hp > 0);
    }
    if (idx < 0) { await pvpFinish(st.oppSide); return; }
    Net.send({ t: 'switch', idx });
  } else {
    pvpWaitUI('あいては つぎの パチモンを えらんでいる…');
    idx = await Net.waitSwitch();
    if (!B || B !== st || st.over) return;
    if (idx == null) { pvpAbort('あいてと の つながりが きれてしまった…'); return; }
  }
  await pvpApplySwitch(ownerSide, idx);
  updateBattleUI();
}

async function pvpFinish(winnerSide) {
  const st = B;
  if (!st || !st.pvp || st.pvpEnding) return;
  st.pvpEnding = true;
  st.over = true;
  Net.finished = true;
  Net.send({ t: 'finish', winner: winnerSide });
  hideActions();
  const iWon = winnerSide === st.mySide;
  if (winnerSide === 'draw') {
    await say('ひきわけ だった！', 1200);
  } else if (iWon) {
    Music.play('victory');
    await say(`${st.oppName} との たいせんに かった！`, 1500);
  } else {
    await say(`${st.oppName} に まけてしまった…`, 1500);
  }
  await wait(500);
  await pvpEndBattle();
}
function pvpRemoteFinish(winnerSide) {
  const st = B;
  if (!st || !st.pvp || st.pvpEnding) return;
  st.pvpEnding = true;
  st.over = true;
  Net.finished = true;
  hideActions();
  const iWon = winnerSide === st.mySide;
  (async () => {
    if (winnerSide === 'draw') await say('ひきわけ だった！', 700);
    else if (iWon) await say(`${st.oppName} との たいせんに かった！`, 700);
    else await say(`${st.oppName} に まけてしまった…`, 700);
    await pvpEndBattle();
  })();
}
async function pvpAbort(text) {
  const st = B;
  if (!st || !st.pvp) { netOnClose(); return; }
  if (st.pvpEnding) return;
  st.pvpEnding = true;
  st.over = true;
  Net.finished = true;
  hideActions();
  if (st.actionResolve) { const r = st.actionResolve; st.actionResolve = null; r(null); }
  netAbortWaiters();
  await say(text || 'たいせんを ちゅうだんしました…', 1100);
  await pvpEndBattle();
}
async function pvpEndBattle() {
  if (!B) return;
  const wasPvp = !!B.pvp;
  await endBattleUI();
  Net.state = 'idle';
  Net.role = null;
  Net.code = '';
  Net.lobbyOpen = false;
  Net.originalParty = null;
  if (wasPvp) toast('ネットたいせん おわり！');
}
function pvpCleanupBattle() {
  if (Net.originalParty) {
    G.party = Net.originalParty;
    Net.originalParty = null;
  }
  if (B && B.actionResolve) { const r = B.actionResolve; B.actionResolve = null; r(null); }
  Net.ending = true;
  netAbortWaiters();
  netDispose();
  Net.state = 'idle';
  Net.role = null;
  Net.code = '';
  Net.lobbyOpen = false;
}

/* ---------------- 状態 チェック / ずれ なおし ---------------- */
function pvpMonSnapshot(m) {
  return {
    sp: m.species, lv: m.level, hp: m.hp, mhp: m.maxHp,
    atk: m.atk, def: m.def, spa: m.spa, spd: m.spd, spe: m.spe,
    mv: m.moves.map(x => [x.id, x.pp]),
    st: m.status || null, sl: m.sleepTurns || 0, tox: m.toxicCounter || 0,
    stg: m.stages ? { ...m.stages } : null,
    conf: m.confusion || 0, fl: !!m.flinch, pr: !!m.protect, pc: m.protectCount || 0,
    sub: m.substitute || 0, seed: !!m.leechseed,
    ch: m.charging ? { ...m.charging } : null, rc: !!m.recharge,
    lock: m.choiceLock || null, berry: !!m.berryUsed, focus: !!m.focusUsed,
    held: m.heldItem || null, ab: m.ability || null, sh: !!m.shiny,
  };
}
function pvpApplyMonSnapshot(m, d) {
  if (!m || !d) return;
  m.species = d.sp; m.level = d.lv; m.hp = d.hp; m.maxHp = d.mhp;
  m.atk = d.atk; m.def = d.def; m.spa = d.spa; m.spd = d.spd; m.spe = d.spe;
  m.moves = (d.mv || []).filter(x => x && MOVES[x[0]]).map(x => ({ id: x[0], pp: x[1] }));
  m.status = d.st || null;
  m.sleepTurns = d.sl || 0;
  m.toxicCounter = d.tox || 0;
  m.stages = d.stg ? { ...d.stg } : zeroStages();
  m.confusion = d.conf || 0;
  m.flinch = !!d.fl;
  m.protect = !!d.pr;
  /* まもる れんぞく カウント。ふるい クライアントの スナップショットには
     pc が ない ことが あるので、その ばあいは 上書きしない
     (0 で リセットして しまわない ように)。 */
  if (d.pc != null) m.protectCount = d.pc;
  m.substitute = d.sub || 0;
  m.leechseed = !!d.seed;
  m.charging = d.ch ? { ...d.ch } : null;
  m.recharge = !!d.rc;
  m.choiceLock = d.lock || null;
  m.berryUsed = !!d.berry;
  m.focusUsed = !!d.focus;
  m.heldItem = d.held || null;
  m.ability = d.ab || null;
  m.shiny = !!d.sh;
}
function pvpStateData(st) {
  const hostTeam = st.mySide === 'host' ? G.party : st.team;
  const guestTeam = st.mySide === 'host' ? st.team : G.party;
  const hostScr = st.mySide === 'host' ? st.playerScreens : st.enemyScreens;
  const guestScr = st.mySide === 'host' ? st.enemyScreens : st.playerScreens;
  return {
    turn: st.turn,
    w: st.weather || null,
    wt: st.weatherTurns || 0,
    ps: { reflect: hostScr.reflect || 0, lightscreen: hostScr.lightscreen || 0 },
    es: { reflect: guestScr.reflect || 0, lightscreen: guestScr.lightscreen || 0 },
    host: hostTeam.map(pvpMonSnapshot),
    guest: guestTeam.map(pvpMonSnapshot),
  };
}
function pvpChecksum(st) {
  return netHash(JSON.stringify(pvpStateData(st)));
}
function pvpApplyState(st, data) {
  if (!st || !data) return;
  st.turn = Number(data.turn) || st.turn;
  st.weather = data.w || null;
  st.weatherTurns = Number(data.wt) || 0;
  const hostScr = st.mySide === 'host' ? st.playerScreens : st.enemyScreens;
  const guestScr = st.mySide === 'host' ? st.enemyScreens : st.playerScreens;
  hostScr.reflect = (data.ps && data.ps.reflect) || 0;
  hostScr.lightscreen = (data.ps && data.ps.lightscreen) || 0;
  guestScr.reflect = (data.es && data.es.reflect) || 0;
  guestScr.lightscreen = (data.es && data.es.lightscreen) || 0;
  const hostTeam = st.mySide === 'host' ? G.party : st.team;
  const guestTeam = st.mySide === 'host' ? st.team : G.party;
  if (Array.isArray(data.host) && data.host.length === hostTeam.length) {
    for (let i = 0; i < hostTeam.length; i++) pvpApplyMonSnapshot(hostTeam[i], data.host[i]);
  }
  if (Array.isArray(data.guest) && data.guest.length === guestTeam.length) {
    for (let i = 0; i < guestTeam.length; i++) pvpApplyMonSnapshot(guestTeam[i], data.guest[i]);
  }
  st.enemy = st.team[0];
  updateBattleUI();
}
async function pvpSyncTurn(st) {
  if (!B || B !== st || st.over || !st.pvp) return;
  const sum = pvpChecksum(st);
  const myPc = (G.party[0] && G.party[0].protectCount) || 0;
  Net.send({ t: 'check', sum, pc: myPc });
  const peerCheck = await Net.waitCheck();
  if (!B || B !== st || st.over) return;
  const peerSum = (peerCheck && typeof peerCheck === 'object') ? peerCheck.sum : peerCheck;
  /* まもる れんぞく カウントは、もちぬし の クライアントの 値を 正とする。
     チェックサムが ずれて いなくても、ここで かならず そろえる。 */
  if (peerCheck && typeof peerCheck === 'object' && peerCheck.pc != null && st.enemy) {
    st.enemy.protectCount = peerCheck.pc;
  }
  if (peerSum == null || peerSum === sum) return;
  if (Net.role === 'host') {
    Net.send({ t: 'state', state: pvpStateData(st) });
  } else {
    const msg = await Net.waitState();
    if (!msg || !B || B !== st || st.over) return;
    pvpApplyState(st, msg.state);
    toast('あいてと じょうたいを あわせました');
  }
}
