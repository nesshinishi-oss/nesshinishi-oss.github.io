/* ============================================================
   パチモン — データ定義
   ============================================================ */
'use strict';

/* ---------- タイプ ---------- */
const TYPES = {
  normal:  { name:'ノーマル', color:'#9fa39a' },
  fire:    { name:'ほのお',   color:'#f0723c' },
  water:   { name:'みず',     color:'#4a90e2' },
  grass:   { name:'くさ',     color:'#5cb85c' },
  electric:{ name:'でんき',   color:'#e8c12c' },
  flying:  { name:'ひこう',   color:'#9b8cd6' },
  bug:     { name:'むし',     color:'#93a52a' },
  rock:    { name:'いわ',     color:'#b09a4f' },
  ghost:   { name:'ゴースト', color:'#7b5ea7' },
  dragon:  { name:'ドラゴン', color:'#6b4fd8' },
};

/* 攻撃タイプ -> 防御タイプ の相性 */
const TYPE_CHART = {
  normal:  { rock:0.5, ghost:0 },
  fire:    { fire:0.5, water:0.5, grass:2, bug:2, rock:0.5, dragon:0.5 },
  water:   { fire:2, rock:2, water:0.5, grass:0.5, dragon:0.5 },
  grass:   { water:2, rock:2, fire:0.5, grass:0.5, flying:0.5, bug:0.5, dragon:0.5 },
  electric:{ water:2, flying:2, grass:0.5, electric:0.5, dragon:0.5 },
  flying:  { grass:2, bug:2, rock:0.5, electric:0.5 },
  bug:     { grass:2, fire:0.5, flying:0.5, ghost:0.5, rock:0.5 },
  rock:    { fire:2, flying:2, bug:2, grass:0.5 },
  ghost:   { ghost:2, normal:0 },
  dragon:  { dragon:2 },
};

function typeEffect(atkType, defTypes) {
  let m = 1;
  for (const dt of defTypes) {
    const row = TYPE_CHART[atkType];
    if (row && row[dt] !== undefined) m *= row[dt];
  }
  return m;
}

/* ---------- わざ ---------- */
const MOVES = {
  tackle:      { name:'たいあたり',   type:'normal', power:40,  acc:100, pp:35 },
  scratch:     { name:'ひっかく',     type:'normal', power:40,  acc:100, pp:35 },
  quickattack: { name:'でんこうせっか', type:'normal', power:40, acc:100, pp:30, priority:1 },
  headbutt:    { name:'ずつき',       type:'normal', power:70,  acc:100, pp:15 },
  hyperbeam:   { name:'はかいこうせん', type:'normal', power:150, acc:90, pp:5 },
  growl:       { name:'なきごえ',     type:'normal', power:0, acc:100, pp:40, effect:'atkDown' },
  leer:        { name:'にらみつける', type:'normal', power:0, acc:100, pp:30, effect:'defDown' },
  swordsdance: { name:'つるぎのまい', type:'normal', power:0, acc:100, pp:20, effect:'atkUp' },
  harden:      { name:'かたくなる',   type:'normal', power:0, acc:100, pp:30, effect:'defUp' },
  agility:    { name:'こうそくいどう', type:'normal', power:0, acc:100, pp:30, effect:'spdUp' },
  recover:     { name:'じこさいせい', type:'normal', power:0, acc:100, pp:10, effect:'heal' },
  sing:        { name:'うたう',       type:'normal', power:0, acc:55, pp:15, effect:'sleep' },

  ember:       { name:'ひのこ',       type:'fire', power:40,  acc:100, pp:25, burn:0.15 },
  flamethrower:{ name:'かえんほうしゃ', type:'fire', power:90, acc:100, pp:15, burn:0.1 },
  fireblast:   { name:'だいもんじ',   type:'fire', power:110, acc:85,  pp:5,  burn:0.2 },

  watergun:    { name:'みずでっぽう', type:'water', power:40, acc:100, pp:25 },
  surf:        { name:'なみのり',     type:'water', power:90, acc:100, pp:15 },
  hydropump:   { name:'ハイドロポンプ', type:'water', power:110, acc:80, pp:5 },

  vinewhip:    { name:'つるのムチ',   type:'grass', power:45, acc:100, pp:25 },
  razorleaf:   { name:'はっぱカッター', type:'grass', power:55, acc:95, pp:25 },
  sleeppowder: { name:'ねむりごな',   type:'grass', power:0,  acc:75,  pp:15, effect:'sleep' },
  solarbeam:   { name:'ソーラービーム', type:'grass', power:120, acc:100, pp:10 },

  thundershock:{ name:'でんきショック', type:'electric', power:40, acc:100, pp:30, para:0.1 },
  thunderwave: { name:'でんじは',     type:'electric', power:0, acc:90, pp:20, effect:'para' },
  thunderbolt: { name:'10まんボルト', type:'electric', power:90, acc:100, pp:15, para:0.1 },
  thunder:     { name:'かみなり',     type:'electric', power:110, acc:70, pp:10, para:0.2 },

  peck:        { name:'つつく',       type:'flying', power:35, acc:100, pp:35 },
  wingattack:  { name:'つばさでうつ', type:'flying', power:60, acc:100, pp:25 },
  fly:         { name:'そらをとぶ',   type:'flying', power:90, acc:95,  pp:15 },

  bugbite:     { name:'むしくい',     type:'bug', power:60, acc:100, pp:20 },
  xscissor:    { name:'シザークロス', type:'bug', power:80, acc:100, pp:15 },

  rockthrow:   { name:'いわおとし',   type:'rock', power:50, acc:90, pp:15 },
  stoneedge:   { name:'ストーンエッジ', type:'rock', power:100, acc:80, pp:5 },

  lick:        { name:'したでなめる', type:'ghost', power:30, acc:100, pp:30, para:0.3 },
  hypnosis:    { name:'さいみんじゅつ', type:'ghost', power:0, acc:60, pp:20, effect:'sleep' },
  shadowball:   { name:'シャドーボール', type:'ghost', power:80, acc:100, pp:15 },

  dragonbreath:{ name:'りゅうのいぶき', type:'dragon', power:60, acc:100, pp:20 },
  outrage:     { name:'げきりん',     type:'dragon', power:120, acc:100, pp:10 },
};

const STRUGGLE = { name:'わるあがき', type:'normal', power:40, acc:100, pp:Infinity };

/* ---------- パチモン図鑑 ---------- */
const SPECIES = {
  fushigidame: {
    id:'fushigidame', name:'フシギダメ', types:['grass'], base:{hp:45,atk:49,def:49,spd:45},
    catch:45, exp:64, evolve:{ level:16, into:'fushigisou' },
    learn:[[1,'tackle'],[1,'growl'],[5,'vinewhip'],[10,'razorleaf'],[14,'sleeppowder'],[20,'solarbeam']],
    desc:'せなかの タネは 100均で かった もの。そだつと なぜか はなを さかせるらしい。',
  },
  fushigisou: {
    id:'fushigisou', name:'フシギヤバメ', types:['grass'], base:{hp:60,atk:62,def:63,spd:60},
    catch:45, exp:142,
    learn:[[1,'tackle'],[1,'growl'],[1,'vinewhip'],[16,'razorleaf'],[22,'solarbeam']],
    desc:'タネが そだち はなを つけた。はなの アロマは なんと 6位の いい におい。',
  },
  hitokage: {
    id:'hitokage', name:'ヒトカゲン', types:['fire'], base:{hp:39,atk:52,def:43,spd:65},
    catch:45, exp:62, evolve:{ level:16, into:'rizardo' },
    learn:[[1,'scratch'],[1,'growl'],[5,'ember'],[9,'leer'],[14,'flamethrower'],[20,'fireblast']],
    desc:'しっぽの ほのおが いのちの ともし火。ねむるときも けさない よう きをつけている。',
  },
  rizardo: {
    id:'rizardo', name:'ニセザード', types:['fire'], base:{hp:58,atk:64,def:58,spd:80},
    catch:45, exp:142,
    learn:[[1,'scratch'],[1,'ember'],[1,'leer'],[16,'flamethrower'],[24,'fireblast']],
    desc:'あたまの ツノは めったに つかわせない じまんの ツノ。ぶつけると すこし いたい。',
  },
  zenigame: {
    id:'zenigame', name:'ゼニガメラ', types:['water'], base:{hp:44,atk:48,def:65,spd:43},
    catch:45, exp:63, evolve:{ level:16, into:'kameel' },
    learn:[[1,'tackle'],[1,'leer'],[5,'watergun'],[9,'harden'],[14,'surf'],[20,'hydropump']],
    desc:'こうらの なかには ちいさな でんきそうちが はいっている らしい。べんり。',
  },
  kameel: {
    id:'kameel', name:'カメガエル', types:['water'], base:{hp:59,atk:63,def:80,spd:58},
    catch:45, exp:142,
    learn:[[1,'tackle'],[1,'watergun'],[1,'harden'],[16,'surf'],[24,'hydropump']],
    desc:'こうらに ロケットが ついた という うわさ。はっしゃは まだ みたことが ない。',
  },
  pikachun: {
    id:'pikachun', name:'パチュウ', types:['electric'], base:{hp:35,atk:55,def:40,spd:90},
    catch:190, exp:82, evolve:{ level:16, into:'raichun' },
    learn:[[1,'thundershock'],[1,'growl'],[1,'quickattack'],[9,'thunderwave'],[14,'thunderbolt'],[22,'thunder']],
    desc:'ほっぺの でんきパックは どこかの メーカーの なかもの。れいとうで たべると しびれる。',
  },
  raichun: {
    id:'raichun', name:'ドンパチュウ', types:['electric'], base:{hp:60,atk:90,def:55,spd:110},
    catch:45, exp:243,
    learn:[[1,'thundershock'],[1,'quickattack'],[1,'thunderwave'],[16,'thunderbolt'],[26,'thunder']],
    desc:'しっぽで いなずまを とる。どうじに きゃくせき まで とれてしまった ことも ある。',
  },
  poppo: {
    id:'poppo', name:'ポッポン', types:['normal','flying'], base:{hp:40,atk:45,def:40,spd:56},
    catch:255, exp:50, evolve:{ level:18, into:'pijon' },
    learn:[[1,'tackle'],[1,'growl'],[3,'peck'],[9,'wingattack'],[15,'fly']],
    desc:'はばたく おとは「ポッポン」ではなく「プルルルン」。こうさてんでは まだ めいめいされていない。',
  },
  pijon: {
    id:'pijon', name:'ピョンジョ', types:['normal','flying'], base:{hp:63,atk:60,def:55,spd:71},
    catch:120, exp:122,
    learn:[[1,'tackle'],[1,'peck'],[1,'wingattack'],[18,'fly']],
    desc:'あたまの トサカは とりにくい きゅうしょ。ポニーテール ではない。',
  },
  koratta: {
    id:'koratta', name:'コロッケ', types:['normal'], base:{hp:30,atk:56,def:35,spd:72},
    catch:255, exp:51, evolve:{ level:20, into:'ratta' },
    learn:[[1,'tackle'],[1,'leer'],[5,'quickattack'],[10,'headbutt'],[18,'hyperbeam']],
    desc:'まえばは ねずみより わずかに ながい。じつは 4ほん あるそうだ。',
  },
  ratta: {
    id:'ratta', name:'アゲコロッケ', types:['normal'], base:{hp:55,atk:81,def:60,spd:97},
    catch:127, exp:145,
    learn:[[1,'tackle'],[1,'quickattack'],[1,'headbutt'],[20,'hyperbeam']],
    desc:'まえばが いちぶ きんいろ。はが すべて きんいろ という わけでは ない。',
  },
  mushimushi: {
    id:'mushimushi', name:'イモムシン', types:['bug'], base:{hp:45,atk:30,def:35,spd:45},
    catch:255, exp:39, evolve:{ level:10, into:'batafun' },
    learn:[[1,'tackle'],[1,'harden'],[5,'bugbite'],[14,'xscissor']],
    desc:'あたまの あんてんなは FMらじおも うけられる。ただし ちょうしさん が かかっている。',
  },
  batafun: {
    id:'batafun', name:'バタフリン', types:['bug','flying'], base:{hp:60,atk:45,def:50,spd:70},
    catch:120, exp:120,
    learn:[[1,'tackle'],[1,'bugbite'],[1,'harden'],[12,'wingattack'],[18,'xscissor']],
    desc:'はねの うろこは はなびらの うらがえし。チョウチョ という なまえは とられた。',
  },
  ishitsubute: {
    id:'ishitsubute', name:'イシコロ', types:['rock'], base:{hp:40,atk:80,def:100,spd:20},
    catch:255, exp:73, evolve:{ level:25, into:'goroon' },
    learn:[[1,'tackle'],[1,'harden'],[5,'rockthrow'],[10,'headbutt'],[16,'stoneedge']],
    desc:'にぎると すこし ぎざぎざ。ゆび わに ちかい いしを あつめている らしい。',
  },
  goroon: {
    id:'goroon', name:'ゴロゴロン', types:['rock'], base:{hp:55,atk:95,def:115,spd:35},
    catch:120, exp:134,
    learn:[[1,'tackle'],[1,'harden'],[1,'rockthrow'],[20,'stoneedge'],[24,'headbutt']],
    desc:'やまを こうがい して もどってきた。じつは なかまで ない。',
  },
  ghosu: {
    id:'ghosu', name:'ゴースケ', types:['ghost'], base:{hp:30,atk:35,def:30,spd:80},
    catch:190, exp:62, evolve:{ level:25, into:'genga' },
    learn:[[1,'lick'],[1,'growl'],[5,'hypnosis'],[10,'shadowball'],[16,'recover']],
    desc:'ガスじょうの からだ。かぜの つよい ひは しっぽを つかまれても とんでいく。',
  },
  genga: {
    id:'genga', name:'ゲンゴロウ', types:['ghost'], base:{hp:60,atk:65,def:60,spd:110},
    catch:60, exp:190,
    learn:[[1,'lick'],[1,'hypnosis'],[1,'shadowball'],[20,'recover']],
    desc:'くらやみから あらわれる いたずらずき。げんしょう の なかで もっとも よく みられる。',
  },
  yadon: {
    id:'yadon', name:'ヨダレオン', types:['water'], base:{hp:90,atk:65,def:65,spd:15},
    catch:190, exp:63,
    learn:[[1,'tackle'],[1,'growl'],[5,'watergun'],[9,'harden'],[14,'surf'],[18,'recover'],[24,'hydropump']],
    desc:'あたまが かるい ようで ずっと ぼんやり。きゅうに れきしの こうぎを はじめる ことも。',
  },
  purin: {
    id:'purin', name:'プルン', types:['normal'], base:{hp:115,atk:45,def:20,spd:20},
    catch:170, exp:95,
    learn:[[1,'sing'],[1,'tackle'],[5,'growl'],[9,'headbutt'],[14,'recover'],[20,'hyperbeam']],
    desc:'ふうせんの ような からだ。うたうと みんな ねむるが じぶんは ねむらない。ちょっと うらやましい。',
  },
  kairyuu: {
    id:'kairyuu', name:'カイリュドン', types:['dragon','flying'], base:{hp:91,atk:134,def:95,spd:80},
    catch:45, exp:270,
    learn:[[1,'tackle'],[1,'growl'],[5,'dragonbreath'],[10,'wingattack'],[16,'outrage'],[24,'hyperbeam']],
    desc:'うみにも そらにも とべる ドラゴン。ただし ちかてつは まだ だいじょうぶ。',
  },
};

const STARTERS = ['fushigidame', 'hitokage', 'zenigame'];

/* 図鑑のならび順 */
const DEX_ORDER = [
  'fushigidame','fushigisou','hitokage','rizardo','zenigame','kameel',
  'pikachun','raichun','poppo','pijon','koratta','ratta',
  'mushimushi','batafun','ishitsubute','goroon','ghosu','genga',
  'yadon','purin','kairyuu',
];

/* ---------- エンカウント ---------- */
const ENCOUNTERS = {
  field: {
    name:'わかば草原',
    level:[2, 5],
    table:{ koratta:35, poppo:30, mushimushi:25, purin:8, pikachun:2 },
  },
  forest: {
    name:'ざわめきの森',
    level:[6, 10],
    table:{ poppo:28, mushimushi:22, koratta:20, fushigidame:12, ghosu:10, pikachun:8 },
  },
  rock: {
    name:'ガレキ山脈',
    level:[11, 15],
    table:{ ishitsubute:34, ghosu:22, yadon:20, goroon:14, kairyuu:4, ratta:6 },
  },
};

/* ---------- トレーナー ---------- */
const TRAINERS = {
  bugcatcher: {
    name:'ムシトリスト',
    color:'#8bd46b',
    team:[['mushimushi',4],['batafun',6]],
    reward:200,
    pre:'むしさんの うつくしさを きみにも おしえて やるよ！',
    lose:'うわっ、むしが さばけた…',
    after:'こんどは ちょうちょを つれてきて やる。',
  },
  lass: {
    name:'タンバリン',
    color:'#f0a3c8',
    team:[['koratta',6],['poppo',7],['purin',8]],
    reward:280,
    pre:'この みちは とおしゃんよ。のりこしたきゃ たたかうしか ないわね！',
    lose:'うそでしょー！',
    after:'パチモンとの きずなは ね、きんの ボールより ものかいよ。',
  },
  fisher: {
    name:'ウキビト',
    color:'#7fb8e8',
    team:[['yadon',11],['zenigame',13]],
    reward:420,
    pre:'おっ、つれない あいだに きみの まえで 釣った ヨダレオンたちが ぷんぷん してるよ。',
    lose:'くぅー、リールが からまった…',
    after:'ヨダレオンが しびれて かみつく なんて はじめて だよ。',
  },
  rival: {
    name:'ライバル パチロー',
    color:'#e8845c',
    team:[['raichun',16],['kameel',15],['rizardo',16]],
    reward:1200,
    pre:'よう！ おれたちは どっちが パチモンマスターに なれるか、ここで きめようぜ！',
    lose:'くそっ…！ こんど あったら こんどこそ…！',
    after:'きみの パチモン… なんだか ちょっと いい やつらだな。',
    final:true,
  },
};

/* ---------- どうぐ ---------- */
const ITEMS = {
  pachiball:   { name:'パチボール',     price:200, desc:'やせいの パチモンを つかまえられる。だ円。', kind:'ball', bonus:1.0 },
  superball:   { name:'スーパーパチボール', price:600, desc:'パチボールより つかまえやすい。ちょい いい。', kind:'ball', bonus:1.6 },
  potion:      { name:'キズぐすり',     price:300, desc:'HPを 20 かいふくする。', kind:'heal', heal:20 },
  superpotion: { name:'いいキズぐすり', price:700, desc:'HPを 50 かいふくする。', kind:'heal', heal:50 },
};
