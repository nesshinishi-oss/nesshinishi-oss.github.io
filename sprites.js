/* ============================================================
   パチモン — スプライト描画
   すべて さいほうてきに かく。パクリなので ていげん は おく。
   ============================================================ */
'use strict';

const TAU = Math.PI * 2;

/* ローカル座標: 足元が (0,0) 、上向きが -Y 。たかさ だいたい 120 */
const ART = {
  /* ===== 1-20 ===== */
  fushigidame: { shape:'seed',   c1:'#7cc576', c2:'#4f9e58', c3:'#b7e6a8', spot:'#3f8a49' },
  fushigisou:  { shape:'seed',   c1:'#69b96d', c2:'#3f8c4a', c3:'#a8dca0', spot:'#3f8c4a', flower:'#f28fc0', petals:'#f28fc0', leaves:true, big:true },
  hitokage:    { shape:'lizard', c1:'#f2913d', c2:'#e0662a', c3:'#ffd27a', flame:'big' },
  rizardo:     { shape:'lizard', c1:'#e2693a', c2:'#c8482a', c3:'#ffcf8a', flame:'big', horn:true, mane:true },
  zenigame:    { shape:'turtle', c1:'#6fc3e8', c2:'#c98a4b', c3:'#f2e0b8' },
  kameel:      { shape:'turtle', c1:'#5aaede', c2:'#b5723a', c3:'#f7e6c0', big:true, spikes:true },
  pikachun:    { shape:'mouse',  c1:'#f7d63e', c2:'#2f2f36', c3:'#fdf0a8', cheek:'#e8523c', tail:'bolt' },
  raichun:     { shape:'mouse',  c1:'#efbf24', c2:'#2f2f36', c3:'#ffe98a', cheek:'#e8523c', tail:'bolt', tuft:true, big:true },
  poppo:       { shape:'bird',   c1:'#c9a26b', c2:'#8d6b42', c3:'#f4e3c2', beak:'#e5a13c' },
  pijon:       { shape:'bird',   c1:'#b48a55', c2:'#7b5a36', c3:'#f4e3c2', beak:'#e5a13c', crest:true, tailfan:true },
  koratta:     { shape:'rat',    c1:'#9c7fce', c2:'#6d54a0', c3:'#e6d9f7' },
  ratta:       { shape:'rat',    c1:'#8a68c2', c2:'#5c468c', c3:'#e0cef5', big:true, teeth:true, bushy:true },
  mushimushi:  { shape:'worm',   c1:'#8cc63f', c2:'#5f9427', c3:'#d8f0a8' },
  batafun:     { shape:'worm',   c1:'#7fb8e8', c2:'#4b7fb5', c3:'#d9edfb', wings:true },
  ishitsubute: { shape:'rock',   c1:'#7f9a6a', c2:'#556b40', c3:'#b8d0a0', arms:true },
  goroon:      { shape:'rock',   c1:'#8a6a55', c2:'#5f4436', c3:'#c0a48a', big:true, arms:true, spikes:true },
  ghosu:       { shape:'ghost',  c1:'#8a63c9', c2:'#5f3f96', c3:'#c9b2ea' },
  genga:       { shape:'ghost',  c1:'#4a3f6a', c2:'#2a2340', c3:'#9a8fc0', grin:true, arms:true },
  yadon:       { shape:'pink',   c1:'#e888b0', c2:'#c05f94', c3:'#ffd0e4', variant:'slow' },
  purin:       { shape:'pink',   c1:'#ffc6de', c2:'#f58ec0', c3:'#fff2f8', variant:'ball' },
  /* ===== 21-40 ===== */
  dokudoku:    { shape:'worm',   c1:'#b07bd0', c2:'#7d4fa0', c3:'#e6cdf5', spots:true, horns:true },
  kazeppo:     { shape:'bird',   c1:'#a9d4ef', c2:'#6fa6cc', c3:'#eaf6ff', beak:'#e8b04f', crest:true },
  iwagorou:    { shape:'rock',   c1:'#7f93a8', c2:'#4f6378', c3:'#c3d6e8', big:true, spikes:true },
  sandpan:     { shape:'rat',    c1:'#d79a52', c2:'#a56a2a', c3:'#f2d3a0', bigear:true, big:true },
  yukidama:    { shape:'snowball', c1:'#cfe2ff', c2:'#8fa8e0', c3:'#ffffff', spikes:true },
  kaminarin:   { shape:'mouse',  c1:'#f2a83c', c2:'#7a4a10', c3:'#ffe9b0', cheek:'#e8523c', tail:'zigzag', tuft:true },
  honoo:       { shape:'lizard', c1:'#d84a3c', c2:'#8f2a24', c3:'#ffc27a', flame:'big', horn:true, spikes:true },
  mizugami:    { shape:'turtle', c1:'#5fb8d8', c2:'#3f7fa8', c3:'#dff4ff', big:true, fins:true },
  morino:      { shape:'seed',   c1:'#8ccc6a', c2:'#5a9a42', c3:'#d8f0b0', spot:'#4a8236', flower:'#f2d05c', petals:'#f2d05c', leaves:true },
  tsukiyo:     { shape:'ghost',  c1:'#4f5f9a', c2:'#2f3a6f', c3:'#b8c8f0', grin:true, flame:true },
  hikarin:     { shape:'star',   c1:'#f7d8a8', c2:'#e0b060', c3:'#fff6d8', big:true },
  tetsuo:      { shape:'rock',   c1:'#9aa8b8', c2:'#6f7d8c', c3:'#c9d4e0', big:true, arms:true, metal:true, spikes:true },
  kooriguma:   { shape:'bear',   c1:'#d8eef7', c2:'#8fb8cc', c3:'#ffffff', big:true },
  kairyuu:     { shape:'dragon', c1:'#e8a04f', c2:'#c97a2e', c3:'#ffe0a8' },
  leaflet:     { shape:'treant', c1:'#95d47a', c2:'#5fa84a', c3:'#d8f5bc', small:true, bud:true },
  foliage:     { shape:'treant', c1:'#6fbf62', c2:'#3f8a42', c3:'#c9efb0', flower:'#f2e07a', big:true },
  emberpup:    { shape:'lizard', c1:'#f2a04a', c2:'#d06a2a', c3:'#ffe0a8', flame:'small', frill:true },
  flamehound:  { shape:'lizard', c1:'#b85a2a', c2:'#5a2a18', c3:'#ffcf6a', flame:'big', horn:true, mane:true, big:true },
  droplet:     { shape:'fish',   c1:'#7fd0f0', c2:'#4a90b5', c3:'#e8faff', bubble:true },
  torrent:     { shape:'fish',   c1:'#4aa8d8', c2:'#2f6f9e', c3:'#d8f4ff', big:true, fangs:true },
  /* ===== 41-60 ===== */
  sparkit:     { shape:'mouse',  c1:'#ffe066', c2:'#5a4a2a', c3:'#fff8c0', cheek:'#f07a5c', tail:'whip' },
  voltcat:     { shape:'mouse',  c1:'#f2b42a', c2:'#4a3a2a', c3:'#fff2b0', ears:'point', tail:'bolt', cheek:'#f07a5c', tuft:true, big:true },
  pebblet:     { shape:'rock',   c1:'#a8a29a', c2:'#7d7770', c3:'#d0cac0' },
  boulderon:   { shape:'rock',   c1:'#8a8072', c2:'#5f574c', c3:'#c0b5a2', big:true, spikes:true, arms:true },
  frostmite:   { shape:'snowball', c1:'#e8f8fc', c2:'#a8dce8', c3:'#ffffff', small:true },
  glacier:     { shape:'snowball', c1:'#bfe8f2', c2:'#7fb8cc', c3:'#eafaff', big:true, crystal:true },
  batling:     { shape:'bat',    c1:'#8a6fbc', c2:'#5f468c', c3:'#d8c8f0', fangs:true },
  nocturne:    { shape:'bat',    c1:'#5f468c', c2:'#3a2a5f', c3:'#b8a2e0', big:true, fangs:true, horns:true },
  psylet:      { shape:'orb',    c1:'#c0b4ff', c2:'#8a7ae0', c3:'#f0eaff', ring:true },
  mindra:      { shape:'orb',    c1:'#d8a0e8', c2:'#a86fc0', c3:'#f8e8ff', ring:true, big:true, moon:true },
  crabbo:      { shape:'crab',   c1:'#f08a6a', c2:'#c05a3a', c3:'#ffe0c8' },
  clawdius:    { shape:'crab',   c1:'#c86a4a', c2:'#7f8a9a', c3:'#e8e0d0', big:true, steel:true, spikes:true },
  sandlet:     { shape:'rat',    c1:'#e8cc8a', c2:'#bf9a4f', c3:'#faefc8', bigear:true },
  duneworm:    { shape:'rat',    c1:'#d8b86a', c2:'#a8863f', c3:'#f2e0a8', big:true, bigear:true, spikes:true, sand:true },
  fluffly:     { shape:'sheep',  c1:'#f2f0ec', c2:'#c8c2b8', c3:'#ffffff' },
  cloudram:    { shape:'sheep',  c1:'#e8e8f2', c2:'#b0b8d0', c3:'#ffffff', big:true, horns:true },
  toxifrog:    { shape:'frog',   c1:'#a8d86a', c2:'#6f9e3a', c3:'#e0f5b8' },
  venomtoad:   { shape:'frog',   c1:'#7fae4a', c2:'#4f6f2a', c3:'#d0e8a0', big:true, spikes:true },
  puffball:    { shape:'mushroom', c1:'#f0b8d8', c2:'#c87fa8', c3:'#ffe8f4', spots:true, small:true },
  sporecap:    { shape:'mushroom', c1:'#c88ad8', c2:'#8a4fa8', c3:'#f0d8fa', spots:true, big:true },
  /* ===== 61-84 ===== */
  lavae:       { shape:'worm',   c1:'#f27a3c', c2:'#c04a1a', c3:'#ffd27a', flame:true },
  magmoth:     { shape:'worm',   c1:'#e85a2a', c2:'#a82a0a', c3:'#ffc86a', wings:true, big:true, flame:true },
  snowhare:    { shape:'rabbit', c1:'#f2faff', c2:'#b8dce8', c3:'#ffffff' },
  blizhare:    { shape:'rabbit', c1:'#d8f0fa', c2:'#8ab8cc', c3:'#ffffff', big:true, moon:true },
  steellix:    { shape:'snake',  c1:'#b8c4d0', c2:'#7f8a9a', c3:'#e0e8f0', metal:true },
  ironwyrm:    { shape:'snake',  c1:'#9aa8b8', c2:'#5f6a7a', c3:'#d0dce8', horn:true, big:true, metal:true, wings:true },
  ghostling:   { shape:'ghost',  c1:'#b8a2e0', c2:'#8a6fbc', c3:'#e8dcfa', small:true },
  phantasm:    { shape:'ghost',  c1:'#6f5a9a', c2:'#3f2f66', c3:'#b8a8d8', grin:true, big:true, arms:true },
  brawly:      { shape:'fighter', c1:'#d8a06a', c2:'#a86a3a', c3:'#f8e0c0' },
  championfist:{ shape:'fighter', c1:'#b8a07a', c2:'#7f6a4a', c3:'#e8dcc0', big:true, steel:true },
  grimurtle:   { shape:'turtle', c1:'#6f8f8a', c2:'#4a5f62', c3:'#d8e8e0', skull:true, spikes:true },
  phantomcraw: { shape:'turtle', c1:'#5f7f8a', c2:'#3a4f5f', c3:'#c8dcd8', big:true, skull:true, spikes:true, fins:true, aura:true },
  skitter:     { shape:'spider', c1:'#8a6fbc', c2:'#4f3a70', c3:'#d8c8f0' },
  lynxect:     { shape:'spider', c1:'#5f4a8a', c2:'#2f2448', c3:'#c8b8e0', big:true, blades:true },
  deeptide:    { shape:'seahorse', c1:'#5fc8d8', c2:'#2f8fa8', c3:'#d8f8ff' },
  abysseaegis: { shape:'seahorse', c1:'#3f8fa8', c2:'#1f4f6f', c3:'#bfe8f8', big:true, shell:true },
  glissadee:   { shape:'ray',    c1:'#d8f4ff', c2:'#8fc8e0', c3:'#ffffff', snow:true },
  blizzardforge:{ shape:'ray',   c1:'#a8dcf0', c2:'#5f9ec0', c3:'#eafaff', big:true, snow:true, crown:true },
  caracara:    { shape:'bird',   c1:'#e8c84a', c2:'#a8862a', c3:'#fff6c0', beak:'#e8a04f', crest:true, bolt:true, tailfan:true },
  thunderstorm:{ shape:'bird',   c1:'#c8a82a', c2:'#7a5f1a', c3:'#fff0a0', beak:'#f0b040', crest:true, bolt:true, wingspan:true, big:true },
  dawnwing:    { shape:'owl',    c1:'#e8d8f0', c2:'#a88fc0', c3:'#fff6ff', halo:true },
  terminusraven:{ shape:'owl',   c1:'#6f5a8a', c2:'#3a2a52', c3:'#d8c8e8', halo:true, horns:true, big:true },
  monsoon:     { shape:'snake',  c1:'#5fb8a8', c2:'#2f7f72', c3:'#d8f5ee', fins:true },
  monsoonprime:{ shape:'snake',  c1:'#3f8fa8', c2:'#1f5f72', c3:'#c8f0f8', fins:true, crown:true, big:true },
  /* ===== 85-104 ===== */
  mitsubachi:  { shape:'bee',    c1:'#f2c83c', c2:'#3a3020', c3:'#fff0a8' },
  kabutomushin:{ shape:'beetle', c1:'#8a5a3a', c2:'#4f2f1a', c3:'#d8b07a', horn:true },
  kuwagatan:   { shape:'beetle', c1:'#6f4a5f', c2:'#3a2433', c3:'#c8a0b8', pincers:true },
  hotarubi:    { shape:'bee',    c1:'#f08a3c', c2:'#7a3a1a', c3:'#ffe06a', firefly:true },
  amenbou:     { shape:'spider', c1:'#5fc8b8', c2:'#2f7f72', c3:'#d8fff8', longlegs:true },
  kumonosuke:  { shape:'spider', c1:'#7a5f9a', c2:'#3f2f55', c3:'#d0c0e8', spots:true, big:true },
  katatsumurin:{ shape:'snail',  c1:'#a8c86a', c2:'#7a5a3a', c3:'#e8f0c0' },
  suzumeppo:   { shape:'bird',   c1:'#8f7a5a', c2:'#5a4632', c3:'#f0e8d8', beak:'#c8a04f', small:true },
  karasuke:    { shape:'bird',   c1:'#4a4a5f', c2:'#252533', c3:'#a8a8c0', beak:'#8a8a9a', hood:true, longbeak:true },
  fukurouno:   { shape:'owl',    c1:'#b8a0d0', c2:'#7a5f9a', c3:'#f0e0ff', tufts:true },
  pentarou:    { shape:'penguin', c1:'#5f8fc8', c2:'#2f4f7a', c3:'#f0f8ff', beak:'#f0a040', ice:true },
  kujakun:     { shape:'peacock', c1:'#3fb8b0', c2:'#2f5f9a', c3:'#f0d060' },
  usagitchi:   { shape:'rabbit', c1:'#f0e0c8', c2:'#c8a07a', c3:'#fffaf0', pinkear:true, flop:true },
  moguran:     { shape:'mole',   c1:'#8a6f5a', c2:'#5f4636', c3:'#e0c8b0', claws:true },
  risunon:     { shape:'rat',    c1:'#9a6a4a', c2:'#6a4028', c3:'#e8c8a8', bushy:true },
  nekomata:    { shape:'cat',    c1:'#8a7fa8', c2:'#5f4f7a', c3:'#e8e0f8', tails:2, ghost:true },
  hitsujiin:   { shape:'sheep',  c1:'#f2e2c0', c2:'#c8a882', c3:'#ffffff', spark:true },
  shikanosuke: { shape:'deer',   c1:'#a8c86a', c2:'#6f8a3a', c3:'#e8f5c0', antlers:true },
  pandamaru:   { shape:'panda',  c1:'#f0f0f0', c2:'#3a3a3a', c3:'#d8f0c0' },
  hebin:       { shape:'snake',  c1:'#a86fc0', c2:'#6f3f8a', c3:'#e8c8f5' },
  /* ===== 105-124 ===== */
  wanigame:    { shape:'fish',   c1:'#6f9a4a', c2:'#3f5f2a', c3:'#d8e8a8', big:true, croc:true },
  kamereon:    { shape:'lizard', c1:'#7ac86a', c2:'#3f8a3a', c3:'#d8f5b0', curltail:true, frill:true },
  kaerun:      { shape:'frog',   c1:'#6fc85a', c2:'#3f8a3a', c3:'#d8f5b0', bubble:true },
  imorinu:     { shape:'lizard', c1:'#7a9a5a', c2:'#4f6a38', c3:'#c8d8a8', newt:true, spots:true },
  sakanappa:   { shape:'fish',   c1:'#7fd8a8', c2:'#3f9a6a', c3:'#d8ffe8', leaf:true },
  kuragen:     { shape:'jelly',  c1:'#8ad8f0', c2:'#c88ae8', c3:'#eaffff', glow:true },
  takoyaki:    { shape:'squid',  c1:'#e86a4a', c2:'#a83a2a', c3:'#ffc8a8', fire:true },
  eirian:      { shape:'ray',    c1:'#4a6fa8', c2:'#2a3f6f', c3:'#a8c8f0', big:true },
  hitoden:     { shape:'star',   c1:'#f08a4a', c2:'#c05a2a', c3:'#ffd8a8', arms:true },
  unyoro:      { shape:'star',   c1:'#8a6fc0', c2:'#4f3a7a', c3:'#d8c8f5', spikes:true, urchin:true },
  kinokono:    { shape:'mushroom', c1:'#e86a5a', c2:'#a83a2a', c3:'#f8e8d0', spots:true },
  takenoko:    { shape:'sprout', c1:'#a8d86a', c2:'#6f9a3a', c3:'#e8f5b0', bamboo:true },
  barabara:    { shape:'flower', c1:'#e85a7a', c2:'#a82a4a', c3:'#f5d8e0', thorns:true },
  saboten:     { shape:'cactus', c1:'#5fa85a', c2:'#3f7a3a', c3:'#d8f0b0', bloom:true },
  himawarin:   { shape:'flower', c1:'#f0c83c', c2:'#a8862a', c3:'#fff0a8', sun:true },
  tsutankamen: { shape:'mummy',  c1:'#d8c8a0', c2:'#8a7a5a', c3:'#f0e8d0', vine:true },
  morinoko:    { shape:'flower', c1:'#a8d8a0', c2:'#5f9a5a', c3:'#f0fff0', fairy:true },
  daiyamon:    { shape:'crystal',c1:'#d8f8ff', c2:'#8ad8f0', c3:'#ffffff', big:true, facets:true },
  rubin:       { shape:'crystal',c1:'#f06a7a', c2:'#a82a4a', c3:'#ffd8e0', facets:true, gem:'fire' },
  safai:       { shape:'crystal',c1:'#6a9af0', c2:'#2a4fa8', c3:'#d8e8ff', facets:true, gem:'water' },
  /* ===== 125-134 ===== */
  kurisuta:    { shape:'crystal',c1:'#a8f0f8', c2:'#5fc8d8', c3:'#ffffff', facets:true, gem:'ice' },
  maguman:     { shape:'rock',   c1:'#8a3a2a', c2:'#4f1f1a', c3:'#f08a3c', big:true, arms:true, lava:true },
  denkiunagi:  { shape:'eel',    c1:'#5f8ac8', c2:'#2f4f8a', c3:'#f0e04a' },
  roboton:     { shape:'robot',  c1:'#8a9aa8', c2:'#4f5f6f', c3:'#c8e8f0' },
  giagia:      { shape:'gear',   c1:'#9aa8b8', c2:'#5f6f7f', c3:'#d8e0e8' },
  kagebou:     { shape:'ghost',  c1:'#3a3448', c2:'#1f1a2a', c3:'#8a7fa8', hat:true, arms:true },
  yumemiru:    { shape:'orb',    c1:'#f0c8e8', c2:'#b88ad0', c3:'#fff0ff', ring:true, moon:true, big:true },
  zashikiwarashi:{ shape:'ghost', c1:'#f0e8f8', c2:'#c8a8d8', c3:'#ffffff', kimono:true, small:true },
  kodora:      { shape:'dragon', c1:'#6fc8b8', c2:'#3f8f8a', c3:'#d8fff5', small:true, fins:true },
  ryuujin:     { shape:'dragon', c1:'#3f9a9a', c2:'#1f5f6f', c3:'#f0d060', big:true, whiskers:true, crown:true, fins:true },
}

/* ============================================================
   こたいの こせい (体型 / 目つき / もよう / アクセサリー)
   おなじ かたちでも ひと目で 見わけられる ようにする。
   ============================================================ */
const ART_TWEAKS = {
  /* 1-20 */
  fushigidame:   { wide:1.05, tall:0.97, eyes:'dot' },
  fushigisou:    { tall:1.06, eyes:'sparkle' },
  morino:        { wide:1.04, eyes:'sparkle', pattern:'spots', acc:'bell' },
  hitokage:      { wide:1.05, eyes:'dot' },
  rizardo:       { tall:1.05, eyes:'sharp', pattern:'stripe' },
  zenigame:      { wide:1.05, eyes:'dot' },
  kameel:        { tall:1.06, eyes:'dot', pattern:'stripe' },
  pikachun:      { wide:1.04, eyes:'dot', acc:'cap' },
  raichun:       { tall:1.05, eyes:'sparkle', pattern:'stripe' },
  poppo:         { wide:1.03, eyes:'dot' },
  pijon:         { tall:1.05, eyes:'dot', acc:'scarf' },
  koratta:       { wide:1.04, eyes:'dot' },
  ratta:         { wide:1.08, eyes:'sharp', pattern:'stripe', acc:'collar' },
  mushimushi:    { wide:1.04, eyes:'dot' },
  batafun:       { tall:1.04, eyes:'sparkle', pattern:'spots' },
  ishitsubute:   { wide:1.06, eyes:'dot' },
  goroon:        { wide:1.12, eyes:'sharp', pattern:'patch' },
  ghosu:         { wide:1.04, eyes:'ring' },
  genga:         { wide:1.08, eyes:'sharp', pattern:'stripe' },
  /* 21-40 */
  yadon:         { wide:1.06, eyes:'sleepy', acc:'bandana' },
  purin:         { wide:1.04, eyes:'sparkle', acc:'bell' },
  dokudoku:      { wide:1.06, eyes:'sharp', pattern:'spots' },
  kazeppo:       { tall:1.04, eyes:'sparkle', pattern:'patch' },
  iwagorou:      { tall:1.1, eyes:'sharp', pattern:'stripe' },
  sandpan:       { wide:1.08, eyes:'sleepy', pattern:'patch' },
  yukidama:      { wide:1.06, eyes:'dot', acc:'scarf' },
  kaminarin:     { tall:1.04, eyes:'sharp', pattern:'zigzag' },
  honoo:         { wide:1.08, eyes:'sharp', pattern:'spots' },
  mizugami:      { wide:1.06, eyes:'ring', pattern:'patch' },
  tsukiyo:       { tall:1.06, eyes:'sleepy' },
  hikarin:       { wide:1.04, eyes:'sparkle', acc:'halo' },
  tetsuo:        { tall:1.08, eyes:'ring', pattern:'diamond' },
  kooriguma:     { wide:1.06, eyes:'sleepy', acc:'scarf' },
  kairyuu:       { wide:1.06, eyes:'sharp', pattern:'stripe' },
  leaflet:       { tall:0.9, wide:0.9, eyes:'dot' },
  foliage:       { wide:1.08, eyes:'sleepy', pattern:'spots' },
  emberpup:      { wide:0.96, tall:1.04, eyes:'sparkle', acc:'collar' },
  flamehound:    { tall:1.08, eyes:'sharp', pattern:'stripe' },
  droplet:       { tall:1.04, eyes:'sparkle', pattern:'patch' },
  torrent:       { wide:1.1, eyes:'sharp', pattern:'stripe', acc:'crown' },
  /* 41-60 */
  sparkit:       { wide:1.04, eyes:'sparkle', acc:'collar' },
  voltcat:       { tall:1.08, eyes:'sharp', pattern:'stripe', acc:'goggles' },
  pebblet:       { wide:0.96, tall:0.96, eyes:'dot' },
  boulderon:     { wide:1.12, eyes:'sharp', pattern:'spots' },
  frostmite:     { wide:0.94, tall:0.94, eyes:'sparkle' },
  glacier:       { tall:1.08, eyes:'sharp', acc:'crown' },
  batling:       { tall:1.02, eyes:'sparkle' },
  nocturne:      { wide:1.08, eyes:'sharp', pattern:'patch' },
  psylet:        { wide:1.0, eyes:'ring' },
  mindra:        { wide:1.08, eyes:'ring', pattern:'diamond' },
  crabbo:        { wide:1.06, eyes:'dot', pattern:'spots' },
  clawdius:      { wide:1.1, eyes:'sharp', pattern:'stripe' },
  sandlet:       { tall:0.96, eyes:'sparkle', pattern:'patch' },
  duneworm:      { wide:1.1, eyes:'sharp', pattern:'spots', acc:'collar' },
  fluffly:       { wide:1.06, eyes:'dot', acc:'bell' },
  cloudram:      { wide:1.1, eyes:'sleepy', pattern:'patch' },
  toxifrog:      { wide:1.06, eyes:'dot', pattern:'spots' },
  venomtoad:     { wide:1.12, eyes:'sharp', pattern:'stripe' },
  puffball:      { wide:0.96, tall:0.96, eyes:'sparkle' },
  sporecap:      { wide:1.1, eyes:'sleepy', pattern:'spots' },
  /* 61-84 */
  lavae:         { tall:1.04, eyes:'sharp', pattern:'stripe' },
  magmoth:       { wide:1.08, eyes:'sharp', acc:'crown' },
  snowhare:      { tall:1.06, eyes:'dot', acc:'scarf' },
  blizhare:      { tall:1.1, eyes:'sparkle', pattern:'patch' },
  steellix:      { tall:1.06, eyes:'sharp', pattern:'stripe' },
  ironwyrm:      { tall:1.1, eyes:'sharp', pattern:'stripe' },
  ghostling:     { wide:0.94, tall:0.94, eyes:'sparkle' },
  phantasm:      { wide:1.1, eyes:'sharp', pattern:'patch', aura:true },
  brawly:        { wide:1.04, eyes:'sharp', acc:'bandana' },
  championfist:  { tall:1.08, eyes:'sharp', pattern:'stripe', acc:'collar' },
  grimurtle:     { tall:1.04, eyes:'sharp', pattern:'patch' },
  phantomcraw:   { tall:1.06, eyes:'sharp', pattern:'patch' },
  skitter:       { tall:0.98, eyes:'sharp', pattern:'spots' },
  lynxect:       { wide:1.1, eyes:'sharp', pattern:'stripe' },
  deeptide:      { tall:1.04, eyes:'ring' },
  abysseaegis:   { wide:1.1, eyes:'sharp', pattern:'stripe' },
  glissadee:     { wide:1.06, eyes:'sparkle' },
  blizzardforge: { tall:1.08, eyes:'sharp', pattern:'diamond' },
  caracara:      { tall:1.06, eyes:'sharp', acc:'gem' },
  thunderstorm:  { wide:1.08, eyes:'sharp', pattern:'zigzag', acc:'crown' },
  dawnwing:      { tall:1.06, eyes:'sparkle' },
  terminusraven: { wide:1.1, eyes:'sharp', pattern:'patch', aura:true },
  monsoon:       { wide:1.06, eyes:'ring', pattern:'patch' },
  monsoonprime:  { wide:1.1, eyes:'sharp', pattern:'diamond' },
  /* 85-134 */
  mitsubachi:    { wide:1.04, eyes:'sparkle' },
  kabutomushin:  { wide:1.08, eyes:'sharp', pattern:'patch' },
  kuwagatan:     { tall:1.06, eyes:'sharp', pattern:'stripe' },
  hotarubi:      { tall:1.04, eyes:'dot', pattern:'stripe' },
  amenbou:       { tall:1.12, wide:0.94, eyes:'ring' },
  kumonosuke:    { wide:1.08, eyes:'sleepy', pattern:'spots' },
  katatsumurin:  { wide:1.06, eyes:'sleepy', acc:'scarf' },
  suzumeppo:     { wide:0.96, tall:0.96, eyes:'dot', acc:'bandana' },
  karasuke:      { tall:1.06, eyes:'sharp', acc:'scarf' },
  fukurouno:     { wide:1.04, eyes:'sleepy', acc:'goggles' },
  pentarou:      { wide:1.04, eyes:'sparkle', acc:'goggles' },
  kujakun:       { tall:1.06, eyes:'sparkle', pattern:'diamond' },
  usagitchi:     { wide:1.04, eyes:'sparkle', acc:'flower' },
  moguran:       { wide:1.08, eyes:'sleepy', acc:'goggles' },
  risunon:       { tall:1.04, eyes:'sparkle', pattern:'stripe' },
  nekomata:      { tall:1.06, eyes:'ring', acc:'bell' },
  hitsujiin:     { tall:0.98, eyes:'sparkle', spark:true },
  shikanosuke:   { tall:1.06, eyes:'sparkle', acc:'flower' },
  pandamaru:     { wide:1.08, eyes:'sleepy', pattern:'patch' },
  hebin:         { tall:1.04, eyes:'sleepy', pattern:'diamond' },
  wanigame:      { wide:1.08, eyes:'sharp', pattern:'spots' },
  kamereon:      { wide:1.05, eyes:'ring', pattern:'spots' },
  kaerun:        { wide:1.04, eyes:'sparkle', pattern:'stripe' },
  imorinu:       { wide:0.96, tall:0.96, eyes:'sleepy', pattern:'spots' },
  sakanappa:     { tall:0.96, eyes:'sleepy', pattern:'stripe' },
  kuragen:       { wide:1.04, eyes:'ring', pattern:'spots' },
  takoyaki:      { tall:1.06, eyes:'sharp', pattern:'spots', acc:'gem' },
  eirian:        { wide:1.1, eyes:'ring', pattern:'stripe' },
  hitoden:       { wide:1.06, eyes:'dot', pattern:'spots' },
  unyoro:        { wide:1.06, eyes:'sharp', pattern:'spots' },
  kinokono:      { tall:1.02, eyes:'dot', acc:'flower' },
  takenoko:      { tall:1.06, eyes:'sparkle', pattern:'stripe', acc:'bandana' },
  barabara:      { tall:1.06, eyes:'sharp', pattern:'spots' },
  saboten:       { wide:1.06, eyes:'sleepy', acc:'hat' },
  himawarin:     { wide:1.06, eyes:'sparkle' },
  tsutankamen:   { tall:1.06, eyes:'sleepy', pattern:'stripe' },
  morinoko:      { wide:1.02, eyes:'sleepy', acc:'halo' },
  daiyamon:      { wide:1.08, eyes:'ring', pattern:'diamond' },
  rubin:         { tall:1.06, eyes:'sharp', acc:'gem' },
  safai:         { tall:0.98, eyes:'sparkle', pattern:'diamond' },
  kurisuta:      { tall:1.08, eyes:'sleepy', pattern:'stripe' },
  maguman:       { wide:1.08, eyes:'sharp', pattern:'patch' },
  denkiunagi:    { tall:1.04, eyes:'sharp', pattern:'zigzag' },
  roboton:       { wide:1.06, eyes:'ring', acc:'visor' },
  giagia:        { wide:1.06, eyes:'dot', pattern:'diamond' },
  kagebou:       { tall:1.06, eyes:'sharp', aura:true },
  yumemiru:      { tall:1.06, eyes:'sleepy', pattern:'spots' },
  zashikiwarashi:{ tall:1.04, eyes:'sleepy' },
  kodora:        { tall:0.94, wide:0.94, eyes:'sparkle' },
  ryuujin:       { tall:1.1, eyes:'sharp', pattern:'diamond' },
};
for (const [id, tw] of Object.entries(ART_TWEAKS)) {
  if (ART[id]) Object.assign(ART[id], tw);
}
;

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
let EYE_STYLE = 'dot';
function eyeDot(ctx, x, y, r = 6) {
  if (EYE_STYLE === 'sharp') {
    el(ctx, x, y, r * 0.82, r * 1.1, '#2b2b33');
    ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = Math.max(1.5, r * 0.34); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - r * 0.9, y - r * 1.05); ctx.lineTo(x + r * 0.9, y - r * 0.55); ctx.stroke();
    circle(ctx, x - r * 0.25, y + r * 0.15, r * 0.22, '#fff');
    return;
  }
  if (EYE_STYLE === 'sleepy') {
    ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = Math.max(1.8, r * 0.32); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y, r * 0.9, 0.05 * Math.PI, 0.95 * Math.PI); ctx.stroke();
    circle(ctx, x, y + r * 0.35, r * 0.28, '#2b2b33');
    return;
  }
  if (EYE_STYLE === 'ring') {
    circle(ctx, x, y, r * 1.08, '#ffffff');
    circle(ctx, x + r * 0.12, y + r * 0.1, r * 0.55, '#2b2b33');
    circle(ctx, x - r * 0.12, y - r * 0.22, r * 0.2, '#ffffff');
    return;
  }
  if (EYE_STYLE === 'sparkle') {
    circle(ctx, x, y, r, '#2b2b33');
    circle(ctx, x - r * 0.34, y - r * 0.38, r * 0.38, '#fff');
    circle(ctx, x + r * 0.32, y + r * 0.3, r * 0.17, '#fff');
    return;
  }
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
   シルエットで 見わける 追加パーツ
   おなじ「がた」でも、つの・はね・ひれ・マント・しっぽ・
   アンテナ・ただよう オーブ などが からだの 外側に とびだす
   ので、くろい シルエットだけでも しゅるいが わかる。
   パーツは しゅるい ID から けいさんする ので、毎回 おなじ。
   ============================================================ */
const _SPRITE_KITS = new Map();
function _spriteHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function spriteKit(a, id) {
  const key = id || a._id || a.shape;
  if (_SPRITE_KITS.has(key)) return _SPRITE_KITS.get(key);
  const h = _spriteHash(key + '|' + a.shape);
  const nib = n => (h >>> ((n % 8) * 4)) & 15;
  const sh = a.shape;
  let cat = 'beast';
  if (['bird', 'owl', 'bat', 'bee', 'beetle', 'peacock'].indexOf(sh) >= 0) cat = 'air';
  else if (['fish', 'ray', 'jelly', 'squid', 'crab', 'seahorse', 'eel', 'turtle'].indexOf(sh) >= 0) cat = 'water';
  else if (['ghost', 'orb', 'crystal', 'snowball', 'star'].indexOf(sh) >= 0) cat = 'float';
  else if (['seed', 'sprout', 'treant', 'flower', 'cactus', 'mushroom'].indexOf(sh) >= 0) cat = 'plant';
  else if (['fighter', 'robot', 'mummy', 'gear', 'penguin', 'armor'].indexOf(sh) >= 0) cat = 'human';
  const big = !!a.big;
  const kit = { cat, wings:false, wingStyle:nib(0) % 3, cape:false, tail:false, tailStyle:nib(3) % 3,
    backfin:false, tentacles:false, auraRing:false, horns:false, hornStyle:nib(6) % 3,
    crest:false, crestStyle:nib(7) % 2, antennae:false, orbits:0, shoulders:false,
    spikes:0, plume:false, streamers:false, emblem:0, extra:nib(14) % 4,
    wisp: cat === 'float' ? nib(15) % 3 : 0 };

  if (cat === 'air') kit.wings = true;
  else if (cat === 'float') kit.wings = nib(0) < 5;
  else if (cat === 'beast') kit.wings = big && nib(0) < 5;
  else if (cat === 'human') kit.wings = nib(0) < 3;

  if (cat === 'human') kit.cape = true;
  else if (cat === 'float') kit.cape = nib(1) < 4;
  else if (cat === 'beast' || cat === 'plant') kit.cape = nib(1) >= 13;

  kit.backfin = cat === 'water' || (cat === 'beast' && nib(2) < 4);
  kit.tail = !a.tail && ((cat === 'beast' && nib(3) < 12) || (cat === 'water' && nib(3) < 9));
  kit.tentacles = (cat === 'float' && nib(4) < 8) || (cat === 'water' && nib(4) < 4);
  kit.auraRing = cat === 'float' || (big && nib(5) < 5);

  if (!a.horn) kit.horns = cat !== 'water' && (nib(6) < 6 || (big && nib(6) < 11));
  if (cat === 'air' || cat === 'water') kit.crest = nib(7) < 10;
  else if (cat !== 'plant') kit.crest = nib(7) < 4;
  kit.antennae = (cat === 'air' && nib(8) < 7) || (cat === 'float' && nib(8) < 5) || (cat === 'plant' && nib(8) < 4);
  kit.orbits = cat === 'float' ? 2 + nib(9) % 2 : ((big && nib(9) < 4) ? 1 : 0);
  kit.shoulders = cat === 'human' || (cat === 'beast' && big && nib(10) < 8);
  if (!a.spikes) kit.spikes = ((cat === 'beast' || cat === 'human') && nib(11) < 7) ? 2 + nib(11) % 3 : 0;
  kit.plume = cat === 'plant';
  kit.streamers = (cat === 'air' && nib(12) < 8) || (cat === 'float' && nib(12) < 4);
  kit.emblem = (cat === 'human' || (big && nib(13) < 5)) ? 1 + nib(13) % 3 : 0;

  _SPRITE_KITS.set(key, kit);
  return kit;
}

function _addonScale(ctx, a) {
  const sc = a.big ? 1.13 : 1;
  ctx.save(); ctx.scale(sc, sc);
  return sc;
}

function _addonsBack(ctx, a, kit, t) {
  const an = ANCHORS[a.shape];
  if (!an) return;
  const [x, y, rx, ry] = an.body;
  const [nx, ny] = an.neck;
  _addonScale(ctx, a);
  if (kit.auraRing) {
    ctx.save();
    ctx.globalAlpha = 0.22; ctx.strokeStyle = a.c3; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.ellipse(x, y, rx * 1.5, ry * 1.45, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.1; ctx.fillStyle = a.c3;
    ctx.beginPath(); ctx.ellipse(x, y, rx * 1.5, ry * 1.45, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  if (kit.cape) {
    const sway = Math.sin(t / 460) * 4;
    const topY = ny - 4;
    const bot = y + ry + 14;
    ctx.fillStyle = a.c2;
    ctx.beginPath();
    ctx.moveTo(x - rx * 0.52, topY);
    ctx.quadraticCurveTo(x - rx * 1.25, y + ry * 0.2, x - rx * 1.02 + sway, bot);
    for (let i = 1; i <= 5; i++) {
      const px = x - rx * 1.02 + (i / 5) * rx * 2.04;
      ctx.quadraticCurveTo(px - rx * 0.12, bot + (i % 2 ? 7 : -3), px, bot + (i % 2 ? 2 : 0));
    }
    ctx.quadraticCurveTo(x + rx * 1.25, y + ry * 0.2, x + rx * 0.52, topY);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = a.c3; ctx.globalAlpha = 0.6; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - rx * 0.82 + sway, bot - 1); ctx.lineTo(x + rx * 0.82 + sway, bot - 1); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (kit.wings) {
    const flap = Math.sin(t / 250 + (a.shape === 'bee' ? 2 : 0)) * 0.07;
    for (const sg of [-1, 1]) {
      ctx.save();
      ctx.translate(x + sg * rx * 0.45, y - ry * 0.12);
      ctx.rotate(sg * flap);
      if (kit.wingStyle === 0) {
        ctx.fillStyle = a.c2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(sg * rx * 1.15, -ry * 1.3);
        ctx.lineTo(sg * rx * 1.05, -ry * 0.5);
        ctx.lineTo(sg * rx * 1.55, -ry * 0.72);
        ctx.lineTo(sg * rx * 1.32, -ry * 0.06);
        ctx.lineTo(sg * rx * 1.62, -ry * 0.12);
        ctx.lineTo(sg * rx * 1.3, ry * 0.5);
        ctx.lineTo(sg * rx * 0.88, ry * 0.28);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = a.c3; ctx.globalAlpha = 0.55; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(sg * rx * 1.15, -ry * 1.3);
        ctx.moveTo(0, 0); ctx.lineTo(sg * rx * 1.55, -ry * 0.72);
        ctx.moveTo(0, 0); ctx.lineTo(sg * rx * 1.62, -ry * 0.12);
        ctx.stroke(); ctx.globalAlpha = 1;
      } else if (kit.wingStyle === 1) {
        for (let i = 0; i < 4; i++) {
          const fy = -ry * (1.05 - i * 0.26);
          ctx.fillStyle = i % 2 ? a.c3 : a.c2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(sg * rx * 0.7, fy - ry * 0.1, sg * rx * (1.05 + i * 0.12), fy + ry * 0.18);
          ctx.quadraticCurveTo(sg * rx * 0.62, fy + ry * 0.24, 0, 0);
          ctx.fill();
        }
      } else {
        el(ctx, sg * rx * 0.82, -ry * 0.62, rx * 0.72, ry * 0.34, a.c3, sg * -0.55);
        el(ctx, sg * rx * 0.92, -ry * 0.05, rx * 0.58, ry * 0.27, a.c2, sg * -0.2);
        ctx.strokeStyle = a.c2; ctx.globalAlpha = 0.5; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sg * rx * 1.2, -ry * 0.7); ctx.stroke(); ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  }
  if (kit.tail) {
    const sx = x - rx * 0.62, sy = y + ry * 0.5;
    const ex = x - rx * (1.5 + kit.tailStyle * 0.12);
    const ey = y - ry * (0.15 + kit.tailStyle * 0.25);
    ctx.strokeStyle = a.c2; ctx.lineWidth = Math.max(5, rx * 0.22); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(x - rx * 1.9, y + ry * 0.95, ex, ey);
    ctx.stroke();
    if (kit.tailStyle === 0) {
      poly(ctx, [ex, ey - 12, ex - 14, ey + 2, ex - 4, ey + 3, ex - 10, ey + 14, ex + 2, ey + 5, ex + 10, ey + 12, ex + 4, ey - 2, ex + 12, ey - 3], a.c3);
    } else if (kit.tailStyle === 1) {
      el(ctx, ex - 3, ey - 4, 10, 14, a.c3, -0.3);
      el(ctx, ex - 3, ey - 4, 6, 9, '#ffd23e', -0.3);
      el(ctx, ex - 3, ey - 6, 3, 5, '#fff2b0', -0.3);
    } else {
      circle(ctx, ex, ey, 9, a.c3);
      circle(ctx, ex, ey, 5, a.c2);
      circle(ctx, ex - 2, ey - 2, 2, '#ffffff');
    }
  }
  if (kit.backfin) {
    poly(ctx, [x - rx * 0.5, y - ry * 0.72, x - rx * 0.06, y - ry * 1.55, x + rx * 0.24, y - ry * 0.78], a.c2);
    poly(ctx, [x - rx * 0.2, y - ry * 1.3, x - rx * 0.02, y - ry * 1.62, x + rx * 0.1, y - ry * 1.28], a.c3);
    el(ctx, x - rx * 1.0, y + ry * 0.05, rx * 0.52, ry * 0.22, a.c2, 0.55);
    el(ctx, x + rx * 1.0, y + ry * 0.05, rx * 0.52, ry * 0.22, a.c2, -0.55);
  }
  if (kit.spikes) {
    for (let i = 0; i < kit.spikes; i++) {
      const bx = x + (i - (kit.spikes - 1) / 2) * rx * 0.42;
      const hgt = ry * (0.75 + (i % 2) * 0.3);
      poly(ctx, [bx - rx * 0.16, y - ry * 0.75, bx, y - ry * 0.75 - hgt, bx + rx * 0.16, y - ry * 0.75], i % 2 ? a.c3 : a.c2);
    }
  }
  if (kit.tentacles) {
    for (let i = 0; i < 3; i++) {
      const bx = x + (i - 1) * rx * 0.5;
      const sway = Math.sin(t / 360 + i * 1.8) * 5;
      ctx.strokeStyle = a.c2; ctx.lineWidth = Math.max(4, rx * 0.16); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(bx, y + ry * 0.8);
      ctx.quadraticCurveTo(bx + sway, y + ry * 1.25, bx - sway, y + ry * 1.12 + 20 + i * 3);
      ctx.stroke();
      circle(ctx, bx - sway, y + ry * 1.12 + 20 + i * 3, Math.max(3, rx * 0.1), a.c3);
    }
  }
  if (kit.plume) {
    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI * 0.85 + (i / 4) * Math.PI * 0.95;
      const px = x + Math.cos(ang) * rx * 1.2, py = y + Math.sin(ang) * ry * 1.15;
      el(ctx, px, py, 10, 5, i % 2 ? a.c2 : a.c3, ang);
      el(ctx, px - 4, py - 2, 5, 2.5, a.c3, ang);
    }
  }
  ctx.restore();
}

function _addonsFront(ctx, a, kit, t) {
  const an = ANCHORS[a.shape];
  if (!an) return;
  const [x, y, rx, ry] = an.body;
  const [hx, hy, hr] = an.head;
  _addonScale(ctx, a);
  if (kit.horns) {
    for (const sg of [-1, 1]) {
      const bx = hx + sg * hr * 0.48, by = hy - hr * 0.62;
      const spread = sg * hr * (0.5 + kit.hornStyle * 0.22);
      ctx.fillStyle = a.c3;
      ctx.beginPath();
      ctx.moveTo(bx - sg * hr * 0.1, by + hr * 0.1);
      ctx.quadraticCurveTo(bx + spread, by - hr * 0.5, bx + spread * 0.9, by - hr * (1.0 + kit.hornStyle * 0.14));
      ctx.quadraticCurveTo(bx + spread * 0.3, by - hr * 0.45, bx + sg * hr * 0.06, by);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = a.c2; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(bx, by - hr * 0.15);
      ctx.quadraticCurveTo(bx + spread * 0.6, by - hr * 0.55, bx + spread * 0.88, by - hr * 0.95);
      ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
  if (kit.crest) {
    const n = 3 + kit.crestStyle;
    for (let i = 0; i < n; i++) {
      const bx = hx + (i - (n - 1) / 2) * hr * 0.34;
      const top = hy - hr * (0.85 + (i % 2 ? 0.35 : 0.55));
      poly(ctx, [bx - hr * 0.16, hy - hr * 0.68, bx + hr * 0.04, top, bx + hr * 0.19, hy - hr * 0.7], i % 2 ? a.c3 : a.c2);
    }
  }
  if (kit.antennae) {
    ctx.strokeStyle = a.c2; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    for (const sg of [-1, 1]) {
      const sway = Math.sin(t / 480 + sg * 1.4) * hr * 0.1;
      const ex = hx + sg * hr * 0.55 + sway, ey = hy - hr * 1.45;
      ctx.beginPath(); ctx.moveTo(hx + sg * hr * 0.32, hy - hr * 0.82);
      ctx.quadraticCurveTo(hx + sg * hr * 0.72, hy - hr * 1.2, ex, ey); ctx.stroke();
      circle(ctx, ex, ey, hr * 0.14, a.c3);
      circle(ctx, ex, ey, hr * 0.06, '#ffffff');
    }
  }
  if (kit.shoulders) {
    for (const sg of [-1, 1]) {
      const bx = x + sg * rx * 0.82, by = y - ry * 0.18;
      poly(ctx, [bx - sg * rx * 0.06, by - ry * 0.42, bx + sg * rx * 0.34, by - ry * 0.56, bx + sg * rx * 0.28, by + ry * 0.12], a.c2);
      poly(ctx, [bx + sg * rx * 0.02, by - ry * 0.45, bx + sg * rx * 0.2, by - ry * 0.15, bx + sg * rx * 0.06, by + ry * 0.02], a.c3);
    }
  }
  if (kit.orbits) {
    for (let i = 0; i < kit.orbits; i++) {
      const ang = t / 900 + i * (TAU / Math.max(1, kit.orbits));
      const ox = x + Math.cos(ang) * rx * 1.55;
      const oy = y + Math.sin(ang * 1.2) * ry * 1.25;
      ctx.globalAlpha = 0.32; circle(ctx, ox, oy, 10, a.c3);
      ctx.globalAlpha = 0.9; circle(ctx, ox, oy, 5.5, a.c3);
      circle(ctx, ox - 1.6, oy - 1.6, 2, '#ffffff');
      ctx.globalAlpha = 1;
    }
  }
  if (kit.streamers) {
    for (const sg of [-1, 1]) {
      const bx = x + sg * rx * 0.55, by = y + ry * 0.5;
      const w = Math.sin(t / 380 + sg) * 6;
      ctx.strokeStyle = a.c3; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + sg * 12 + w, by + 16, bx + sg * 8 - w, by + 30);
      ctx.stroke();
    }
  }
  if (kit.emblem) {
    const ey = y - ry * 0.15;
    if (kit.emblem === 1) {
      poly(ctx, [x, ey - 9, x + 7, ey, x, ey + 9, x - 7, ey], a.c3);
      poly(ctx, [x, ey - 9, x + 7, ey, x, ey], '#ffffff');
    } else if (kit.emblem === 2) {
      circle(ctx, x, ey, 8, a.c3); circle(ctx, x, ey, 4.5, a.c2); circle(ctx, x - 2, ey - 2, 2, '#ffffff');
    } else {
      ctx.strokeStyle = a.c3; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, ey, 8, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 4, ey + 5); ctx.lineTo(x, ey - 5); ctx.lineTo(x + 4, ey + 5); ctx.stroke();
    }
  }
  /* しゅるい ごとの ちいさな シルエット差 (ほかの パーツと かさなっても 見わける) */
  if (kit.extra === 1) {
    for (const sg of [-1, 1]) {
      poly(ctx, [hx + sg * hr * 0.74, hy + hr * 0.08, hx + sg * hr * 1.3, hy - hr * 0.42, hx + sg * hr * 0.92, hy + hr * 0.56], a.c2);
    }
  } else if (kit.extra === 2) {
    poly(ctx, [hx - hr * 0.18, hy - hr * 0.72, hx, hy - hr * 1.42, hx + hr * 0.22, hy - hr * 0.7], a.c3);
    poly(ctx, [hx - hr * 0.08, hy - hr * 0.75, hx, hy - hr * 1.2, hx + hr * 0.1, hy - hr * 0.76], a.c2);
  } else if (kit.extra === 3) {
    poly(ctx, [x - rx * 0.12, y - ry * 1.25, x + rx * 0.95, y - ry * 0.12, x + rx * 0.18, y - ry * 0.08], a.c2);
    poly(ctx, [x + rx * 0.05, y - ry * 1.02, x + rx * 0.6, y - ry * 0.3, x + rx * 0.2, y - ry * 0.28], a.c3);
  }
  if (kit.wisp === 1) {
    const wx = hx + hr * 1.55, wy = hy - hr * 0.15 + Math.sin(t / 520) * 5;
    ctx.globalAlpha = 0.3; circle(ctx, wx, wy, hr * 0.3, a.c3);
    ctx.globalAlpha = 1; circle(ctx, wx, wy, hr * 0.15, a.c3); circle(ctx, wx - 1, wy - 1, 1.6, '#ffffff');
  } else if (kit.wisp === 2) {
    const wx = hx - hr * 1.5, wy = hy - hr * 0.3;
    ctx.fillStyle = a.c3;
    ctx.beginPath(); ctx.arc(wx, wy, hr * 0.28, Math.PI * 0.4, Math.PI * 1.6); ctx.arc(wx + hr * 0.12, wy, hr * 0.22, Math.PI * 1.5, Math.PI * 0.5, true); ctx.closePath(); ctx.fill();
  } else if (kit.wisp === 3) {
    for (let i = 0; i < 2; i++) {
      const wx = hx + (i ? hr * 1.35 : -hr * 1.35), wy = hy - hr * (i ? 0.1 : 0.55);
      ctx.save(); ctx.translate(wx, wy); ctx.rotate(t / 900 + i);
      poly(ctx, [0, -5, 2, -2, 5, 0, 2, 2, 0, 5, -2, 2, -5, 0, -2, -2], a.c3);
      ctx.restore();
    }
  }
  ctx.restore();
}


/* ============================================================
   drawPachimon(ctx, speciesId, x, y, scale, time, opts)
   opts: { flip, dead, silhouette }
   ============================================================ */
function drawPachimon(ctx, speciesId, x, y, scale, time, opts = {}) {
  const a = ART[speciesId] || ART.koratta;
  const flip = !!opts.flip;
  const shiny = !!opts.shiny;
  const t = time || Date.now();
  ctx.save();
  ctx.translate(x, y);

  const bob = a.shape === 'ghost'
    ? Math.sin(t / 500) * 6 * scale
    : Math.abs(Math.sin(t / 380)) * -2.5 * scale;
  ctx.translate(0, bob);
  if (flip) ctx.scale(-1, 1);
  ctx.scale(scale, scale);
  if (a.wide || a.tall) ctx.scale(a.wide || 1, a.tall || 1);

  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 12 * scale;
  ctx.shadowOffsetY = 6 * scale;
  if (shiny) ctx.filter = 'hue-rotate(145deg) saturate(1.4) brightness(1.06)';
  drawShape(ctx, a, t, speciesId);
  ctx.filter = 'none';
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  /* いろちがいの きらめき */
  if (shiny) {
    ctx.save();
    ctx.fillStyle = '#fff6a8';
    for (let i = 0; i < 3; i++) {
      const ang = t / 620 + i * 2.1;
      const sx = Math.cos(ang) * (26 + i * 5);
      const sy = -58 + Math.sin(ang * 1.3 + i) * 26;
      const s = 3.5 + (Math.sin(t / 180 + i * 2) + 1) * 1.8;
      ctx.globalAlpha = 0.45 + (Math.sin(t / 240 + i) + 1) * 0.25;
      ctx.beginPath();
      ctx.moveTo(sx, sy - s); ctx.lineTo(sx + s, sy); ctx.lineTo(sx, sy + s); ctx.lineTo(sx - s, sy);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

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

/* --- 描画ヘルパ --- */
function poly(ctx, pts, fill) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
function limb(ctx, x1, y1, x2, y2, color, w) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

function drawShape(ctx, a, t, id) {
  EYE_STYLE = a.eyes || 'dot';
  const floating = a.shape === 'ghost' || a.shape === 'jelly' || a.shape === 'orb';
  shadow(ctx, floating ? 34 : 44, 10, floating ? 0.1 : 0.18);
  const fns = {
    mouse: _mouse, lizard: _lizard, turtle: _turtle, seed: _seed, sprout: _sprout,
    treant: _treant, bird: _bird, owl: _owl, penguin: _penguin, peacock: _peacock,
    bat: _bat, rat: _rat, rabbit: _rabbit, mole: _mole, deer: _deer, bear: _bear,
    panda: _panda, sheep: _sheep, worm: _worm, spider: _spider, beetle: _beetle,
    bee: _bee, snail: _snail, rock: _rock, crystal: _crystal, ghost: _ghost,
    mummy: _mummy, dragon: _dragon, snake: _snake, fish: _fish, ray: _ray,
    jelly: _jelly, squid: _squid, star: _star, eel: _eel, frog: _frog,
    mushroom: _mushroom, flower: _flower, cactus: _cactus, gear: _gear,
    robot: _robot, seahorse: _seahorse, crab: _crab, fighter: _fighter,
    snowball: _snowball, orb: _orb, cat: _cat, fox: _fox, armor: _armor,
  };
  const fn = a.shape === 'pink'
    ? (a.variant === 'ball' ? _purin : _yadon)
    : (fns[a.shape] || _mouse);
  /* シルエットを つくる 追加パーツ (うしろ側 → からだ → まえ側) */
  const kit = spriteKit(a, id);
  _addonsBack(ctx, a, kit, t);
  fn(ctx, a, t);
  _addonsFront(ctx, a, kit, t);
  _signature(ctx, a, t);
}

/* ============================================================
   こたいごとの 見わけ用 デコレーション
   おなじ かたちの パチモンでも、体型・目つき・もよう・
   アクセサリー で ひと目で ちがう ように する。
   ============================================================ */
const ANCHORS = {
  mouse:    { body:[0,-30,27,23],  head:[0,-70,29],  neck:[0,-48] },
  lizard:   { body:[0,-32,22,26],  head:[0,-70,27],  neck:[0,-50] },
  turtle:   { body:[6,-32,19,22],  head:[18,-72,24], neck:[14,-48] },
  seed:     { body:[0,-32,33,21],  head:[30,-58,20], neck:[14,-52] },
  sprout:   { body:[0,-26,19,21],  head:[0,-50,17],  neck:[0,-38] },
  treant:   { body:[0,-38,19,37],  head:[0,-62,27],  neck:[0,-46] },
  bird:     { body:[0,-32,24,25],  head:[2,-68,22],  neck:[2,-46] },
  owl:      { body:[0,-34,29,29],  head:[0,-66,25],  neck:[0,-44] },
  penguin:  { body:[0,-38,27,35],  head:[0,-80,21],  neck:[0,-58] },
  peacock:  { body:[0,-30,15,25],  head:[0,-66,16],  neck:[0,-48] },
  bat:      { body:[0,-34,19,23],  head:[0,-66,22],  neck:[0,-46] },
  rat:      { body:[0,-28,23,22],  head:[4,-60,23],  neck:[2,-40] },
  rabbit:   { body:[0,-28,22,23],  head:[0,-64,22],  neck:[0,-42] },
  mole:     { body:[0,-28,32,21],  head:[0,-56,22],  neck:[0,-38] },
  deer:     { body:[0,-38,19,27],  head:[0,-84,15],  neck:[0,-56] },
  bear:     { body:[0,-32,33,29],  head:[0,-72,26],  neck:[0,-46] },
  panda:    { body:[0,-32,32,28],  head:[0,-70,26],  neck:[0,-46] },
  sheep:    { body:[0,-38,27,25],  head:[0,-72,18],  neck:[0,-50] },
  worm:     { body:[0,-34,16,25],  head:[0,-80,15],  neck:[0,-62] },
  spider:   { body:[0,-36,20,18],  head:[0,-66,16],  neck:[0,-50] },
  beetle:   { body:[0,-38,31,26],  head:[0,-68,15],  neck:[0,-52] },
  bee:      { body:[0,-40,23,21],  head:[0,-72,18],  neck:[0,-54] },
  snail:    { body:[0,-16,37,8],   head:[24,-34,14], neck:[16,-20] },
  rock:     { body:[0,-34,31,25],  head:[0,-34,25],  neck:[0,-18] },
  crystal:  { body:[0,-46,25,41],  head:[0,-46,19],  neck:[0,-20] },
  ghost:    { body:[0,-58,29,27],  head:[0,-62,23],  neck:[0,-40] },
  mummy:    { body:[0,-34,19,25],  head:[0,-70,18],  neck:[0,-48] },
  dragon:   { body:[0,-34,28,28],  head:[4,-78,26],  neck:[4,-50] },
  snake:    { body:[10,-50,21,27], head:[14,-88,16], neck:[8,-68] },
  fish:     { body:[0,-38,37,21],  head:[18,-46,17], neck:[-8,-34] },
  ray:      { body:[0,-46,23,17],  head:[0,-48,17],  neck:[0,-30] },
  jelly:    { body:[0,-62,29,23],  head:[0,-64,21],  neck:[0,-44] },
  squid:    { body:[0,-58,26,25],  head:[0,-60,19],  neck:[0,-40] },
  star:     { body:[0,-48,33,33],  head:[0,-50,19],  neck:[0,-28] },
  eel:      { body:[-4,-50,21,31], head:[-4,-80,14], neck:[-4,-62] },
  frog:     { body:[0,-28,37,23],  head:[0,-48,23],  neck:[0,-36] },
  mushroom: { body:[0,-26,17,23],  head:[0,-58,31],  neck:[0,-42] },
  flower:   { body:[0,-46,15,19],  head:[0,-62,19],  neck:[0,-42] },
  cactus:   { body:[0,-38,21,35],  head:[0,-54,17],  neck:[0,-34] },
  gear:     { body:[-20,-44,23,23], head:[-20,-44,17], neck:[-20,-24] },
  robot:    { body:[0,-44,27,23],  head:[0,-82,15],  neck:[0,-64] },
  seahorse: { body:[4,-46,14,21],  head:[8,-72,14],  neck:[4,-58] },
  crab:     { body:[0,-32,29,19],  head:[0,-44,19],  neck:[0,-46] },
  fighter:  { body:[0,-34,17,24],  head:[0,-70,16],  neck:[0,-52] },
  snowball: { body:[0,-46,31,31],  head:[0,-48,25],  neck:[0,-28] },
  orb:      { body:[0,-50,27,27],  head:[0,-52,23],  neck:[0,-32] },
  pink:     { body:[0,-48,29,27],  head:[0,-60,25],  neck:[0,-42] },
  cat:      { body:[0,-30,25,24],  head:[0,-65,26],  neck:[0,-44] },
  fox:      { body:[0,-30,22,22],  head:[8,-60,22],  neck:[4,-42] },
  armor:    { body:[0,-30,29,29],  head:[0,-30,21],  neck:[0,-58] },
};

function _patColor(a) {
  const n = parseInt((a.c1 || '#888888').slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? a.c2 : a.c3;
}

function _pattern(ctx, a, an) {
  const [x, y, rx, ry] = an.body;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.clip();
  ctx.globalAlpha = 0.45;
  const col = _patColor(a);
  if (a.pattern === 'stripe') {
    for (let i = -1; i <= 1; i++) ctx.fillRect(x - rx, y + i * ry * 0.42 - ry * 0.1, rx * 2, ry * 0.2);
  } else if (a.pattern === 'spots') {
    const pts = [[-0.45,-0.3],[0.25,-0.45],[0.5,0.1],[-0.2,0.35],[-0.6,0.25]];
    for (const [px, py] of pts) circle(ctx, x + px * rx, y + py * ry, Math.max(2, rx * 0.16), col);
  } else if (a.pattern === 'patch') {
    el(ctx, x, y + ry * 0.45, rx * 0.72, ry * 0.5, col);
  } else if (a.pattern === 'diamond') {
    for (const px of [-0.4, 0.3]) {
      const cx = x + px * rx, cy = y;
      poly(ctx, [cx, cy - ry * 0.32, cx + rx * 0.2, cy, cx, cy + ry * 0.32, cx - rx * 0.2, cy], col);
    }
  } else if (a.pattern === 'zigzag') {
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, rx * 0.12); ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const px = x - rx + (i / 6) * rx * 2;
      const py = y + (i % 2 ? -1 : 1) * ry * 0.34;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.stroke();
  } else if (a.pattern === 'band') {
    ctx.fillRect(x - rx * 0.16, y - ry, rx * 0.32, ry * 2);
  }
  ctx.restore();
}

function _acc(ctx, a, an, t) {
  const [hx, hy, hr] = an.head;
  const [nx, ny] = an.neck;
  const COL = {
    scarf: '#e8523c', bell: '#ffd23e', collar: '#8a94a6', goggle: '#3a3f52', lens: '#8ad8ff',
    hat: '#3a2f46', cap: '#4a7fc0', crown: '#ffd23e', halo: '#ffe98a', gem: '#8ad8ff',
    flower: '#f28fc0', petal: '#ffe084', bandana: '#e8523c', earring: '#ffd23e',
  };
  if (a.acc === 'scarf' || a.acc === 'bandana') {
    el(ctx, nx, ny, hr * 0.95, hr * 0.28, COL.bandana);
    poly(ctx, [nx - hr * 0.2, ny, nx - hr * 0.75, ny + hr * 0.9, nx - hr * 0.15, ny + hr * 0.4], COL.bandana);
    if (a.acc === 'scarf') {
      poly(ctx, [nx + hr * 0.2, ny, nx + hr * 0.85, ny + hr * 0.75, nx + hr * 0.25, ny + hr * 0.35], '#f07a5c');
    }
  } else if (a.acc === 'bell') {
    el(ctx, nx, ny, hr * 0.95, hr * 0.24, COL.scarf);
    circle(ctx, nx, ny + hr * 0.34, hr * 0.24, COL.bell);
    circle(ctx, nx, ny + hr * 0.26, hr * 0.08, '#a87a1a');
  } else if (a.acc === 'collar') {
    el(ctx, nx, ny, hr * 1.0, hr * 0.22, COL.collar);
    for (let i = -1; i <= 1; i++) {
      poly(ctx, [nx + i * hr * 0.55 - hr * 0.12, ny + hr * 0.12, nx + i * hr * 0.55, ny + hr * 0.55, nx + i * hr * 0.55 + hr * 0.12, ny + hr * 0.12], '#e8eef8');
    }
  } else if (a.acc === 'goggles') {
    ctx.strokeStyle = COL.goggle; ctx.lineWidth = Math.max(2, hr * 0.14); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx - hr * 1.05, hy - hr * 0.02); ctx.lineTo(hx + hr * 1.05, hy - hr * 0.02); ctx.stroke();
    for (const s of [-1, 1]) {
      circle(ctx, hx + s * hr * 0.46, hy - hr * 0.02, hr * 0.4, COL.goggle);
      circle(ctx, hx + s * hr * 0.46, hy - hr * 0.02, hr * 0.33, COL.lens);
      circle(ctx, hx + s * hr * 0.38, hy - hr * 0.12, hr * 0.1, '#ffffff');
    }
  } else if (a.acc === 'visor') {
    ctx.fillStyle = 'rgba(90,230,255,0.72)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(hx - hr * 0.9, hy - hr * 0.28, hr * 1.8, hr * 0.52, hr * 0.2);
    else ctx.rect(hx - hr * 0.9, hy - hr * 0.28, hr * 1.8, hr * 0.52);
    ctx.fill();
    ctx.strokeStyle = '#2f5f7a'; ctx.lineWidth = Math.max(1.5, hr * 0.1); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(hx - hr * 0.55, hy - hr * 0.16, hr * 0.45, hr * 0.1);
  } else if (a.acc === 'hat') {
    el(ctx, hx, hy - hr * 0.86, hr * 1.2, hr * 0.22, COL.hat);
    ctx.fillStyle = COL.hat;
    ctx.fillRect(hx - hr * 0.52, hy - hr * 1.75, hr * 1.04, hr * 0.92);
    ctx.fillStyle = COL.scarf;
    ctx.fillRect(hx - hr * 0.52, hy - hr * 1.12, hr * 1.04, hr * 0.18);
  } else if (a.acc === 'cap') {
    ctx.fillStyle = COL.cap;
    ctx.beginPath(); ctx.arc(hx, hy - hr * 0.55, hr * 0.82, Math.PI, 0); ctx.closePath(); ctx.fill();
    el(ctx, hx + hr * 0.5, hy - hr * 0.52, hr * 0.7, hr * 0.17, '#2f5f9a', 0.12);
  } else if (a.acc === 'crown') {
    const by = hy - hr * 0.82;
    for (let i = -1; i <= 1; i++) poly(ctx, [hx + i * hr * 0.44 - hr * 0.16, by, hx + i * hr * 0.44, by - hr * 0.5, hx + i * hr * 0.44 + hr * 0.16, by], COL.crown);
    ctx.fillStyle = '#e8a92a';
    ctx.fillRect(hx - hr * 0.62, by, hr * 1.24, hr * 0.14);
  } else if (a.acc === 'halo') {
    ctx.strokeStyle = COL.halo; ctx.lineWidth = Math.max(2, hr * 0.14); ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.ellipse(hx, hy - hr * 1.28, hr * 0.86, hr * 0.24, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (a.acc === 'antenna') {
    ctx.strokeStyle = COL.goggle; ctx.lineWidth = Math.max(2, hr * 0.12); ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      const sway = Math.sin(t / 500 + s) * hr * 0.08;
      ctx.beginPath(); ctx.moveTo(hx + s * hr * 0.34, hy - hr * 0.9); ctx.quadraticCurveTo(hx + s * hr * 0.7, hy - hr * 1.5, hx + s * hr * 0.5 + sway, hy - hr * 1.78); ctx.stroke();
      circle(ctx, hx + s * hr * 0.5 + sway, hy - hr * 1.8, hr * 0.16, COL.bell);
    }
  } else if (a.acc === 'flower') {
    const fx = hx + hr * 0.72, fy = hy - hr * 0.7;
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * TAU;
      el(ctx, fx + Math.cos(ang) * hr * 0.24, fy + Math.sin(ang) * hr * 0.24, hr * 0.18, hr * 0.18, COL.flower);
    }
    circle(ctx, fx, fy, hr * 0.13, COL.petal);
  } else if (a.acc === 'gem') {
    const gy = hy - hr * 0.52;
    poly(ctx, [hx, gy - hr * 0.3, hx + hr * 0.22, gy, hx, gy + hr * 0.3, hx - hr * 0.22, gy], COL.gem);
    poly(ctx, [hx, gy - hr * 0.3, hx + hr * 0.22, gy, hx, gy], '#ffffff');
  } else if (a.acc === 'earring') {
    ctx.strokeStyle = COL.earring; ctx.lineWidth = Math.max(1.5, hr * 0.1);
    ctx.beginPath(); ctx.arc(hx + hr * 0.98, hy + hr * 0.34, hr * 0.16, 0, TAU); ctx.stroke();
  }
}

function _signature(ctx, a, t) {
  const an = ANCHORS[a.shape];
  if (!an) return;
  if (a.aura) {
    ctx.save();
    ctx.globalAlpha = 0.22;
    const [x, y, rx, ry] = an.body;
    for (let i = 0; i < 3; i++) {
      const ang = t / 600 + i * 2.1;
      circle(ctx, x + Math.cos(ang) * rx * 1.2, y + Math.sin(ang) * ry * 1.2, 7 + i * 2, a.c3);
    }
    ctx.globalAlpha = 0.14;
    circle(ctx, x, y, Math.max(rx, ry) * 1.35, a.c3);
    ctx.restore();
  }
  if (a.spark) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    for (const s of [-1, 1]) {
      const bx = (an.body[0] + s * (an.body[2] + 6)), by = an.body[1] - 6;
      poly(ctx, [bx, by - 14, bx + s * 8, by - 24, bx + s * 2, by - 12, bx + s * 10, by - 16, bx + s * 3, by + 2], '#ffe04a');
    }
    ctx.restore();
  }
  if (a.pattern) _pattern(ctx, a, an);
  if (a.acc) _acc(ctx, a, an, t);
}

/* ============================================================
   きほん がた (あし 4ほん)
   ============================================================ */
function _mouse(ctx, a, t) {
  const sc = a.big ? 1.15 : 1;
  ctx.save(); ctx.scale(sc, sc);
  /* しっぽ */
  ctx.strokeStyle = a.c2; ctx.lineWidth = 6; ctx.lineCap = 'round';
  if (a.tail === 'bolt') {
    poly(ctx, [-24,-26, -44,-42, -32,-46, -50,-68, -36,-68, -48,-92, -22,-72, -34,-60, -20,-54], a.c3);
    ctx.stroke();
  } else if (a.tail === 'zigzag') {
    poly(ctx, [-24,-24, -40,-34, -26,-40, -42,-52, -26,-56, -36,-72, -18,-58, -28,-48], a.c3);
    ctx.stroke();
  } else if (a.tail === 'whip') {
    ctx.strokeStyle = a.c2; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-22,-18); ctx.quadraticCurveTo(-48,-10,-50,-38); ctx.stroke();
    circle(ctx, -50, -40, 6, a.c3);
  }
  /* からだ */
  el(ctx, 0, -30, 32, 30, a.c1);
  el(ctx, 0, -24, 21, 20, a.c3);
  el(ctx, -28, -34, 9, 13, a.c1, 0.5);
  el(ctx, 28, -34, 9, 13, a.c1, -0.5);
  el(ctx, -14, -4, 13, 7, a.c1);
  el(ctx, 14, -4, 13, 7, a.c1);
  /* あたま */
  circle(ctx, 0, -70, 32, a.c1);
  const wag = Math.sin(t / 300) * 3;
  for (const s of [-1, 1]) {
    if (a.ears === 'point') {
      poly(ctx, [s*18,-88, s*30,-118, s*38,-86], a.c1);
      poly(ctx, [s*23,-90, s*30,-106, s*33,-89], a.c2);
    } else {
      el(ctx, s * 20, -100 + wag * s, 10, 24, a.c1, s * 0.28);
      el(ctx, s * 24, -114 + wag * s, 6, 9, a.c2, s * 0.28);
    }
  }
  if (a.tuft) for (let i = -1; i <= 1; i++) el(ctx, i * 10, -100, 4, 10, a.c2, i * 0.25);
  if (a.brow) { limb(ctx, -18,-86, -6,-82, a.c2, 3); limb(ctx, 18,-86, 6,-82, a.c2, 3); }
  /* かお */
  circle(ctx, -22, -62, 8, a.cheek);
  circle(ctx, 22, -62, 8, a.cheek);
  eyeDot(ctx, -11, -76, 6);
  eyeDot(ctx, 11, -76, 6);
  circle(ctx, 0, -64, 3, a.c2);
  smile(ctx, 0, -60, 14);
  ctx.restore();
}

function _lizard(ctx, a, t) {
  const sc = a.big ? 1.16 : 1;
  ctx.save(); ctx.scale(sc, sc);
  /* しっぽ */
  ctx.strokeStyle = a.c1; ctx.lineWidth = 13; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-16, -18);
  if (a.curltail) ctx.bezierCurveTo(-46,-14,-52,-46,-34,-56);
  else ctx.quadraticCurveTo(-44, -22, -52, -44);
  ctx.stroke();
  if (a.flame === 'big' || a.flame === 'small') {
    const f = (a.flame === 'big' ? 1 : 0.55) * (Math.sin(t / 120) * 3 + 14);
    el(ctx, -54, -52, f * 0.8, f, '#ffd23e', -0.2);
    el(ctx, -55, -56, f * 0.5, f * 0.7, '#ff8f3c', -0.2);
    el(ctx, -56, -60, f * 0.3, f * 0.45, '#fff2b0', -0.2);
  }
  /* あし */
  el(ctx, -14, -3, 11, 7, a.c1); el(ctx, 14, -3, 11, 7, a.c1);
  /* からだ */
  el(ctx, 0, -32, 26, 30, a.c1);
  el(ctx, 2, -26, 16, 21, a.c3);
  el(ctx, -24, -38, 8, 13, a.c1, 0.6);
  el(ctx, 24, -38, 8, 13, a.c1, -0.6);
  /* あたま */
  circle(ctx, 0, -70, 29, a.c1);
  el(ctx, 0, -60, 20, 14, a.c1);
  if (a.frill) {
    poly(ctx, [-30,-66, -46,-58, -30,-50], a.c2);
    poly(ctx, [30,-66, 46,-58, 30,-50], a.c2);
  }
  if (a.spikes) {
    for (let i = -1; i <= 1; i++) poly(ctx, [i*12-5,-92, i*12,-104, i*12+5,-92], a.c3);
  }
  if (a.mane) {
    for (let i = -2; i <= 2; i++) poly(ctx, [i*11-6,-84, i*11,-72, i*11+6,-84], a.c2);
  }
  if (a.horn) { el(ctx, -7, -100, 5, 12, a.c2, 0.2); el(ctx, 7, -100, 5, 12, a.c2, -0.2); }
  if (a.spots) { circle(ctx, -14, -36, 5, a.c2); circle(ctx, 10, -30, 4, a.c2); circle(ctx, 4, -44, 3, a.c2); }
  eyeDot(ctx, -12, -76, 6);
  eyeDot(ctx, 12, -76, 6);
  if (a.frill) { circle(ctx, -16, -74, 8.5, a.c1); circle(ctx, 16, -74, 8.5, a.c1); }
  circle(ctx, -5, -58, 1.8, a.c2); circle(ctx, 5, -58, 1.8, a.c2);
  smile(ctx, 0, -56, 12);
  ctx.restore();
}

function _turtle(ctx, a, t) {
  const sc = a.big ? 1.16 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const sw = Math.sin(t / 260) * 2;
  if (a.fins) {
    el(ctx, -32, -36, 16, 8, a.c1, 0.7);
    el(ctx, 32, -36, 16, 8, a.c1, -0.7);
  } else {
    el(ctx, -26, -40, 9, 12, a.c1, 0.5);
    el(ctx, 26, -40, 9, 12, a.c1, -0.5);
  }
  el(ctx, -22, -4, 13, 8, a.c1); el(ctx, 22, -4, 13, 8, a.c1);
  /* こうら */
  el(ctx, -2 + sw, -36, 36, 34, a.c2);
  el(ctx, -2 + sw, -36, 27, 25, a.c3);
  ctx.strokeStyle = a.c2; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-2 + sw, -58); ctx.lineTo(-2 + sw, -14);
  ctx.moveTo(-20 + sw, -36); ctx.lineTo(16 + sw, -36);
  ctx.stroke();
  if (a.spikes) for (let i = -1; i <= 1; i++) poly(ctx, [i*16-4,-60, i*16,-74, i*16+4,-60], a.c2);
  if (a.skull) {
    circle(ctx, -2 + sw, -38, 11, '#e8f0e8');
    circle(ctx, -6 + sw, -40, 3, '#2b2b33');
    circle(ctx, 2 + sw, -40, 3, '#2b2b33');
    limb(ctx, -8 + sw, -32, 4 + sw, -32, '#2b2b33', 2);
  }
  /* からだ */
  el(ctx, 6, -32, 22, 26, a.c1);
  el(ctx, 6, -26, 13, 15, a.c3);
  /* あたま */
  circle(ctx, 18, -72, 26, a.c1);
  el(ctx, 34, -66, 11, 9, a.c1);
  eyeDot(ctx, 10, -78, 6);
  eyeDot(ctx, 27, -78, 6);
  circle(ctx, 19, -62, 2, a.c2); circle(ctx, 28, -62, 2, a.c2);
  smile(ctx, 21, -58, 12);
  ctx.restore();
}

function _seed(ctx, a, t) {
  const sc = a.big ? 1.14 : 1;
  ctx.save(); ctx.scale(sc, sc);
  for (const p of [[-26,-2],[-10,0],[12,0],[26,-2]]) el(ctx, p[0], p[1], 11, 7, a.c1);
  el(ctx, 0, -32, 40, 26, a.c1);
  const bw = Math.sin(t / 320) * 2;
  if (a.leaves) {
    for (let i = 0; i < 3; i++) el(ctx, -18 + i * 14, -86 + bw, 12, 5, a.c2, -0.5 + i * 0.5);
  }
  circle(ctx, -6, -66 + bw, 24, a.c2);
  for (const s of [[-16,-70],[2,-76],[-4,-58]]) circle(ctx, s[0], s[1] + bw, 5, a.spot);
  if (a.flower) {
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * TAU - Math.PI / 2;
      el(ctx, -6 + Math.cos(ang) * 15, -66 + bw + Math.sin(ang) * 15, 10, 10, a.petals);
    }
    circle(ctx, -6, -66 + bw, 8, '#ffe084');
  }
  circle(ctx, 30, -58, 22, a.c1);
  poly(ctx, [20,-72, 14,-92, 30,-80], a.c1);
  poly(ctx, [42,-74, 52,-92, 46,-70], a.c1);
  eyeDot(ctx, 24, -62, 6); eyeDot(ctx, 40, -62, 6);
  circle(ctx, 36, -50, 2.4, a.c2);
  smile(ctx, 36, -46, 12);
  blush(ctx, 20, -50, 5); blush(ctx, 48, -52, 5);
  ctx.restore();
}

function _sprout(ctx, a, t) {
  const sway = Math.sin(t / 400) * 3;
  for (const p of [[-16,-2],[16,-2]]) el(ctx, p[0], p[1], 11, 7, a.c1);
  el(ctx, 0, -26, 22, 24, a.c1);
  el(ctx, 0, -22, 13, 14, a.c3);
  if (a.bamboo) {
    circle(ctx, 0, -52, 17, a.c1);
    for (let i = 0; i < 3; i++) limb(ctx, -14, -44 - i * 12, 14, -44 - i * 12, a.c2, 2);
    poly(ctx, [-2,-66, -14,-92, 6,-84], a.c2);
    poly(ctx, [2,-66, 14,-90, 4,-80], a.c2);
  } else {
    el(ctx, 0, -50, 20, 18, a.c1);
    el(ctx, -14 - sway, -70, 14, 7, a.c2, -0.6);
    el(ctx, 14 - sway, -70, 14, 7, a.c2, 0.6);
    circle(ctx, 0 - sway * 0.5, -76, 9, a.c3);
  }
  eyeDot(ctx, -7, -32, 5); eyeDot(ctx, 7, -32, 5);
  smile(ctx, 0, -22, 9);
  blush(ctx, -14, -26, 4); blush(ctx, 14, -26, 4);
}

function _treant(ctx, a, t) {
  const sway = Math.sin(t / 500) * 2;
  ctx.fillStyle = a.c2;
  ctx.fillRect(-10, -44, 20, 44);
  limb(ctx, -6, -40, -28, -20, a.c1, 9);
  limb(ctx, 6, -40, 28, -20, a.c1, 9);
  circle(ctx, 0, -62, 30, a.c1);
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * TAU + sway * 0.02;
    circle(ctx, Math.cos(ang) * 26, -66 + Math.sin(ang) * 22, 17, i % 2 ? a.c3 : a.c2);
  }
  if (a.flower) for (let i = 0; i < 4; i++) circle(ctx, -18 + i * 12, -80 + (i % 2) * 8, 5, a.flower);
  if (a.bud) {
    ctx.fillStyle = a.c2;
    ctx.fillRect(-3, -92, 6, 12);
    el(ctx, -8, -98, 10, 6, a.c3, -0.5);
    el(ctx, 8, -98, 10, 6, a.c3, 0.5);
    circle(ctx, 0, -100, 7, a.c1);
  }
  eyeDot(ctx, -9, -60, 5); eyeDot(ctx, 9, -60, 5);
  smile(ctx, 0, -50, 10);
  el(ctx, -16, -2, 12, 6, a.c2); el(ctx, 16, -2, 12, 6, a.c2);
}

function _bird(ctx, a, t) {
  const sc = a.small ? 0.8 : a.big ? 1.18 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const flap = Math.sin(t / 240);
  /* しっぽ */
  if (a.tailfan) {
    for (let i = -2; i <= 2; i++) el(ctx, -34, -30 + i * 5, 22, 5, i % 2 ? a.c3 : a.c2, i * 0.18);
  } else {
    poly(ctx, [-22,-30, -52,-18, -46,-40], a.c2);
  }
  /* はね */
  if (a.wingspan) {
    el(ctx, -38, -42 + flap * 4, 26, 14, a.c2, 0.5);
    el(ctx, 38, -42 - flap * 4, 26, 14, a.c2, -0.5);
  } else {
    el(ctx, -26, -36, 14, 22 + flap * 6, a.c2, 0.5);
    el(ctx, 26, -36, 14, 22 + flap * 6, a.c2, -0.5);
  }
  el(ctx, 0, -32, 28, 28, a.c1);
  el(ctx, 2, -27, 18, 19, a.c3);
  limb(ctx, -8, -8, -8, 2, '#e5a13c', 4);
  limb(ctx, 8, -8, 8, 2, '#e5a13c', 4);
  circle(ctx, 2, -68, 24, a.c1);
  if (a.hood) { circle(ctx, 2, -72, 26, a.c2); circle(ctx, 2, -70, 22, a.c1); }
  if (a.crest) {
    el(ctx, 2, -92, 5, 12, '#e8788c', 0.1);
    el(ctx, 10, -88, 4, 9, '#e8788c', 0.3);
  }
  if (a.bolt) {
    poly(ctx, [6,-90, 14,-108, 10,-98, 20,-104, 8,-86], '#ffe04a');
  }
  const bl = a.longbeak ? 24 : 10;
  poly(ctx, [22,-66, 22 + bl,-62, 22,-56], a.beak);
  eyeDot(ctx, 6, -74, 5.5);
  eyeDot(ctx, 20, -74, 5.5);
  blush(ctx, -8, -60, 5);
  ctx.restore();
}

function _rat(ctx, a, t) {
  const sc = a.big ? 1.14 : 1;
  ctx.save(); ctx.scale(sc, sc);
  ctx.strokeStyle = a.c2; ctx.lineWidth = 5; ctx.lineCap = 'round';
  if (a.bushy) {
    el(ctx, -34, -40, 20, 12, a.c2, -0.5);
    el(ctx, -44, -52, 14, 10, a.c2, -0.9);
  } else {
    ctx.beginPath(); ctx.moveTo(-20, -20); ctx.quadraticCurveTo(-48, -14, -56, -38); ctx.stroke();
  }
  el(ctx, 0, -28, 27, 26, a.c1);
  el(ctx, 4, -24, 16, 16, a.c3);
  el(ctx, -12, -2, 12, 6, a.c1); el(ctx, 12, -2, 12, 6, a.c1);
  el(ctx, -22, -32, 7, 11, a.c1, 0.5); el(ctx, 22, -32, 7, 11, a.c1, -0.5);
  if (a.spikes) for (let i = 0; i < 3; i++) poly(ctx, [-20 + i * 16, -46, -14 + i * 16, -64, -8 + i * 16, -46], a.c2);
  if (a.sand) {
    ctx.globalAlpha = 0.5;
    for (const [dx, dy, r] of [[-30,-8,5],[34,-12,4],[-40,-24,3]]) circle(ctx, dx, dy, r, a.c3);
    ctx.globalAlpha = 1;
  }
  circle(ctx, 4, -60, 26, a.c1);
  if (a.bigear) {
    el(ctx, -16, -88, 12, 28, a.c1, -0.35);
    el(ctx, 24, -88, 12, 28, a.c1, 0.35);
    el(ctx, -16, -88, 6, 18, a.c3, -0.35);
    el(ctx, 24, -88, 6, 18, a.c3, 0.35);
  } else {
    circle(ctx, -12, -80, 12, a.c1); circle(ctx, 20, -82, 12, a.c1);
    circle(ctx, -12, -80, 6, a.c3); circle(ctx, 20, -82, 6, a.c3);
  }
  eyeDot(ctx, -4, -66, 5.5); eyeDot(ctx, 14, -66, 5.5);
  if (a.teeth) { el(ctx, 2, -48, 3.4, 7, '#fff'); el(ctx, 9, -48, 3.4, 7, '#fff'); }
  ctx.strokeStyle = a.c2; ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-10, -52); ctx.lineTo(-24, -50);
  ctx.moveTo(-10, -48); ctx.lineTo(-24, -46);
  ctx.stroke();
  ctx.restore();
}

function _worm(ctx, a, t) {
  const sc = a.big ? 1.16 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const wig = Math.sin(t / 220);
  if (a.wings) {
    const flap = Math.sin(t / 150);
    ctx.globalAlpha = 0.85;
    el(ctx, -26, -70 + flap * 4, 26, 18, a.c3, -0.5 - flap * 0.1);
    el(ctx, 26, -70 - flap * 4, 26, 18, a.c3, 0.5 + flap * 0.1);
    el(ctx, -22, -52 + flap * 3, 18, 12, a.c3, -0.3);
    el(ctx, 22, -52 - flap * 3, 18, 12, a.c3, 0.3);
    ctx.globalAlpha = 1;
  }
  const segs = [[0,-8,15],[wig*3,-30,17],[-wig*3,-50,17],[wig*2,-66,15]];
  for (const s of segs) circle(ctx, s[0], s[1], s[2], a.c1);
  for (const s of segs) circle(ctx, s[0] + 3, s[1] + 3, s[2] * 0.6, a.c3);
  if (a.legs || a.spikes) {
    for (const s of segs) for (const d of [-1, 1]) limb(ctx, s[0] + d * s[2] * 0.6, s[1], s[0] + d * (s[2] + 9), s[1] + 8, a.c2, 3);
  }
  if (a.spots) for (const s of segs) circle(ctx, s[0] - 4, s[1] - 3, 4, a.c2);
  circle(ctx, 0, -80, 17, a.c1);
  if (a.horns) {
    limb(ctx, -7, -92, -16, -108, a.c2, 4);
    limb(ctx, 7, -92, 16, -108, a.c2, 4);
    circle(ctx, -17, -110, 4, a.c2); circle(ctx, 17, -110, 4, a.c2);
  } else {
    ctx.strokeStyle = a.c2; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-8, -94); ctx.quadraticCurveTo(-14, -106, -20, -104);
    ctx.moveTo(8, -94); ctx.quadraticCurveTo(14, -106, 20, -104);
    ctx.stroke();
    circle(ctx, -20, -104, 4, a.c2); circle(ctx, 20, -104, 4, a.c2);
  }
  if (a.flame) {
    const f = 8 + Math.sin(t / 130) * 2;
    el(ctx, 0, -100, f, f * 1.2, '#ffb03c');
    el(ctx, 0, -104, f * 0.5, f * 0.7, '#fff0a0');
  }
  roundEye(ctx, -7, -82, 8); roundEye(ctx, 7, -82, 8);
  smile(ctx, 0, -72, 10);
  blush(ctx, -14, -76, 4); blush(ctx, 14, -76, 4);
  ctx.restore();
}

function _rock(ctx, a, t) {
  const sc = a.big ? 1.16 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const wob = Math.sin(t / 300) * 3;
  if (a.arms) {
    circle(ctx, -34, -34 + wob, 13, a.c2);
    circle(ctx, -40, -22 + wob, 9, a.c1);
    circle(ctx, 34, -34 - wob, 13, a.c2);
    circle(ctx, 40, -22 - wob, 9, a.c1);
  }
  ctx.fillStyle = a.c1;
  ctx.beginPath();
  ctx.moveTo(-32, -2); ctx.lineTo(-38, -36); ctx.lineTo(-18, -62);
  ctx.lineTo(12, -66); ctx.lineTo(34, -44); ctx.lineTo(34, -10);
  ctx.closePath(); ctx.fill();
  if (a.crystal) {
    poly(ctx, [-18,-52, -6,-84, 8,-56], a.c3);
    poly(ctx, [4,-58, 18,-86, 24,-50], c3bright(a.c3));
  }
  ctx.fillStyle = a.c3;
  ctx.beginPath(); ctx.moveTo(-20, -54); ctx.lineTo(2, -60); ctx.lineTo(-6, -44); ctx.closePath(); ctx.fill();
  circle(ctx, 20, -30, 6, a.c3);
  if (a.metal) {
    ctx.strokeStyle = a.c3; ctx.lineWidth = 2;
    ctx.strokeRect(-20, -54, 26, 22);
    circle(ctx, -8, -43, 3, a.c2); circle(ctx, 4, -43, 3, a.c2);
  }
  if (a.spikes) for (let i = 0; i < 3; i++) poly(ctx, [-26 + i * 20, -62, -20 + i * 20, -80, -14 + i * 20, -62], a.c2);
  if (a.lava) {
    ctx.strokeStyle = '#ffb03c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-24,-40); ctx.lineTo(-10,-32); ctx.lineTo(4,-44); ctx.lineTo(18,-30); ctx.stroke();
    circle(ctx, -8, -30, 4, '#ff8f3c');
    el(ctx, -14, -74, 6, 13, '#ffb03c');
    el(ctx, -14, -79, 3, 6, '#fff0a0');
    el(ctx, 11, -72, 5, 10, '#f07a2a');
    el(ctx, 11, -76, 3, 5, '#fff0a0');
  }
  if (a.moss) { circle(ctx, -20, -52, 8, '#6fae4a'); circle(ctx, 24, -52, 6, '#6fae4a'); }
  ctx.strokeStyle = a.c2; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-14, -44); ctx.lineTo(-2, -38);
  ctx.moveTo(16, -44); ctx.lineTo(4, -38);
  ctx.stroke();
  eyeDot(ctx, -10, -34, 5); eyeDot(ctx, 12, -34, 5);
  ctx.beginPath(); ctx.moveTo(-6, -22); ctx.lineTo(8, -22); ctx.stroke();
  ctx.restore();
}
function c3bright(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + 40);
  const g = Math.min(255, ((n >> 8) & 255) + 40);
  const b = Math.min(255, (n & 255) + 40);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

function _ghost(ctx, a, t) {
  const sc = a.small ? 0.8 : a.big ? 1.15 : 1;
  ctx.save(); ctx.scale(sc, sc);
  if (a.flame) {
    const f = Math.sin(t / 140) * 3;
    el(ctx, 0, -84, 16, 24 + f, a.c3);
    el(ctx, 0, -92, 8, 14, a.c2);
  }
  ctx.globalAlpha = 0.25;
  circle(ctx, -24, -52, 20 + Math.sin(t / 400) * 3, a.c2);
  circle(ctx, 24, -48, 18 - Math.sin(t / 400) * 3, a.c2);
  ctx.globalAlpha = 1;
  ctx.fillStyle = a.c1;
  ctx.beginPath();
  ctx.arc(0, -58, 32, Math.PI, 0);
  ctx.lineTo(32, -22);
  for (let i = 0; i < 4; i++) {
    const x = 32 - i * 16;
    ctx.quadraticCurveTo(x - 8, -8 + Math.sin(t / 200 + i) * 3, x - 16, -22);
  }
  ctx.closePath(); ctx.fill();
  if (a.kimono) {
    poly(ctx, [-34,-44, 34,-44, 26,-6, 0,-16, -26,-6], a.c2);
    limb(ctx, 0, -44, 0, -12, a.c3, 3);
  }
  if (a.arms) {
    el(ctx, -38, -48 + Math.sin(t / 300) * 3, 9, 15, a.c1, 0.5);
    el(ctx, 38, -48 - Math.sin(t / 300) * 3, 9, 15, a.c1, -0.5);
  }
  if (a.hat) {
    el(ctx, 0, -88, 30, 5, a.c2);
    el(ctx, 0, -98, 17, 12, a.c2);
  }
  el(ctx, 0, -48, 22, 12, a.c2, 0);
  el(ctx, -11, -62, 7, 9, '#fff');
  el(ctx, 11, -62, 7, 9, '#fff');
  circle(ctx, -10, -61, 3.4, '#2b2b33');
  circle(ctx, 12, -61, 3.4, '#2b2b33');
  if (a.grin) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-10, -46); ctx.quadraticCurveTo(0, -38, 10, -46); ctx.stroke();
    ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = 1.4;
    for (let i = -6; i <= 6; i += 4) { ctx.beginPath(); ctx.moveTo(i, -45); ctx.lineTo(i, -40); ctx.stroke(); }
  } else smile(ctx, 0, -44, 16);
  ctx.restore();
}

function _dragon(ctx, a, t) {
  const sc = a.small ? 0.82 : a.big ? 1.2 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const flap = Math.sin(t / 200);
  if (a.fins) {
    el(ctx, -30, -62, 14, 26, a.c3, -0.5 + flap * 0.1);
    el(ctx, 30, -62, 14, 26, a.c3, 0.5 - flap * 0.1);
  } else {
    ctx.fillStyle = a.c2;
    ctx.beginPath(); ctx.moveTo(-6, -56); ctx.lineTo(-46, -88 - flap * 6); ctx.lineTo(-38, -46); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-6, -56); ctx.lineTo(-44, -60 - flap * 6); ctx.lineTo(-30, -40); ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = a.c1; ctx.lineWidth = 14; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-14, -16); ctx.quadraticCurveTo(-44, -8, -56, -30); ctx.stroke();
  el(ctx, -14, -2, 13, 8, a.c1); el(ctx, 14, -2, 13, 8, a.c1);
  el(ctx, 0, -34, 32, 32, a.c1);
  el(ctx, 4, -28, 19, 22, a.c3);
  el(ctx, -24, -40, 9, 14, a.c1, 0.5); el(ctx, 24, -40, 9, 14, a.c1, -0.5);
  circle(ctx, 4, -78, 29, a.c1);
  el(ctx, 22, -70, 20, 15, a.c1);
  el(ctx, 36, -66, 9, 8, a.c1);
  if (a.mane) for (let i = -2; i <= 2; i++) poly(ctx, [i*10-6,-92, i*10,-104, i*10+6,-92], a.c2);
  if (a.horn) {
    poly(ctx, [-4,-104, 4,-82, 12,-98], a.c3);
    poly(ctx, [10,-102, 18,-84, 24,-98], a.c3);
  }
  if (a.whiskers) {
    ctx.strokeStyle = a.c3; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(34,-64); ctx.quadraticCurveTo(50,-58, 54,-72); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(32,-60); ctx.quadraticCurveTo(48,-50, 52,-62); ctx.stroke();
  }
  if (a.crown) for (let i = -1; i <= 1; i++) poly(ctx, [i*12-5,-100, i*12,-112, i*12+5,-100], '#ffd23e');
  if (a.metal) { circle(ctx, -6, -70, 4, a.c3); circle(ctx, 8, -70, 4, a.c3); }
  el(ctx, -14, -94, 7, 12, a.c1, 0.4);
  eyeDot(ctx, 0, -84, 6); eyeDot(ctx, 18, -84, 6);
  circle(ctx, 30, -72, 2.2, a.c2); circle(ctx, 38, -70, 2.2, a.c2);
  smile(ctx, 30, -64, 10);
  blush(ctx, -10, -70, 5);
  ctx.restore();
}

function _cat(ctx, a, t) {
  const sc = a.big ? 1.2 : 1;
  ctx.save(); ctx.scale(sc, sc);
  if (a.ghost) {
    ctx.globalAlpha = 0.3;
    circle(ctx, -20, -44, 16 + Math.sin(t / 400) * 3, a.c3);
    el(ctx, 20, -40, 10, 22, a.c2, 0.5);
    ctx.globalAlpha = 1;
  }
  for (let i = 0; i < (a.tails || 1); i++) {
    const ang = (i - (a.tails - 1) / 2) * 0.25;
    el(ctx, -20, -34, 9, 28, a.c2, ang - 0.5);
  }
  el(ctx, 0, -30, 28, 28, a.c1);
  el(ctx, 0, -26, 17, 17, a.c3);
  circle(ctx, 0, -65, 29, a.c1);
  poly(ctx, [-25,-75, -35,-97, -10,-85], a.c1);
  poly(ctx, [25,-75, 35,-97, 10,-85], a.c1);
  poly(ctx, [-23,-78, -29,-90, -15,-83], a.c2);
  poly(ctx, [23,-78, 29,-90, 15,-83], a.c2);
  if (a.coin) circle(ctx, 0, -80, 9, '#ffd23e');
  if (a.bolt) poly(ctx, [-14,-96, -4,-118, -8,-104, 4,-112, -6,-92], '#ffe04a');
  if (a.ghost) { el(ctx, 0, -92, 6, 14, a.c3); el(ctx, 0, -99, 3, 7, a.c2); }
  eyeDot(ctx, -11, -67, 5); eyeDot(ctx, 11, -67, 5);
  circle(ctx, 0, -58, 2.5, a.c2);
  smile(ctx, 0, -54, 11);
  ctx.restore();
}

function _fox(ctx, a, t) {
  const sc = a.big ? 1.2 : 1;
  ctx.save(); ctx.scale(sc, sc);
  for (let i = 0; i < (a.tails || 1); i++) {
    const ang = (i - (a.tails - 1) / 2) * 0.22;
    el(ctx, -20, -34, 10, 30, a.c2, ang - 0.5);
  }
  el(ctx, 0, -30, 25, 25, a.c1);
  circle(ctx, 8, -60, 25, a.c1);
  poly(ctx, [-4,-75, -15,-101, 10,-80], a.c1);
  poly(ctx, [20,-75, 35,-101, 25,-80], a.c1);
  el(ctx, 20, -62, 16, 11, a.c1);
  el(ctx, 34, -60, 7, 6, a.c2);
  eyeDot(ctx, 5, -62, 4); eyeDot(ctx, 20, -62, 4);
  circle(ctx, 32, -58, 2, a.c2);
  smile(ctx, 20, -54, 9);
  ctx.restore();
}

function _armor(ctx, a, t) {
  const sc = a.big ? 1.3 : 1;
  ctx.save(); ctx.scale(sc, sc);
  ctx.fillStyle = a.c1; ctx.fillRect(-30, -60, 60, 60);
  ctx.strokeStyle = a.c2; ctx.lineWidth = 4; ctx.strokeRect(-30, -60, 60, 60);
  if (a.spike) poly(ctx, [-30,-60, 0,-92, 30,-60], a.c1);
  ctx.fillStyle = a.c2; ctx.fillRect(-24, -52, 48, 8);
  circle(ctx, 0, -40, 10, '#ff5c5c');
  ctx.restore();
}

function _crystal(ctx, a, t) {
  const sc = a.big ? 1.2 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const glow = Math.sin(t / 500) * 3;
  if (a.gem === 'fire') el(ctx, 0, -30, 36, 40, 'rgba(255,120,60,0.18)');
  if (a.gem === 'water') el(ctx, 0, -30, 36, 40, 'rgba(80,150,255,0.18)');
  if (a.gem === 'ice') el(ctx, 0, -30, 36, 40, 'rgba(150,240,255,0.22)');
  ctx.fillStyle = a.c1;
  ctx.beginPath();
  ctx.moveTo(0, -96); ctx.lineTo(30, -46); ctx.lineTo(0, 0); ctx.lineTo(-30, -46);
  ctx.closePath(); ctx.fill();
  if (a.facets) {
    poly(ctx, [0,-96, 10,-46, 0,0], a.c2);
    poly(ctx, [0,-96, -10,-46, 0,0], a.c3);
    limb(ctx, -30,-46, 30,-46, a.c3, 2);
  } else {
    ctx.fillStyle = a.c2; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.moveTo(0, -96); ctx.lineTo(15, -46); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
  circle(ctx, 0, -46, 8 + glow, '#ffffff');
  if (a.gem === 'fire') {
    el(ctx, 0, -106, 8, 15, '#ffb03c');
    el(ctx, 0, -113, 4, 8, '#fff0a0');
  } else if (a.gem === 'water') {
    circle(ctx, -36, -54, 5, '#8ad8ff'); circle(ctx, -44, -68, 4, '#8ad8ff'); circle(ctx, 36, -50, 4, '#8ad8ff');
  } else if (a.gem === 'ice') {
    for (let i = -1; i <= 1; i++) poly(ctx, [i*13-4,-94, i*13,-110, i*13+4,-94], '#eaffff');
  }
  if (a.big) { poly(ctx, [-30,-60, -44,-36, -28,-30], a.c1); poly(ctx, [30,-60, 44,-36, 28,-30], a.c1); }
  ctx.restore();
}

function _pink(ctx, a, t) { return a.variant === 'ball' ? _purin(ctx, a, t) : _yadon(ctx, a, t); }


/* ============================================================
   ヨダレオン / プルン
   ============================================================ */
function _yadon(ctx, a, t) {
  ctx.strokeStyle = a.c1; ctx.lineWidth = 12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-24, -18); ctx.quadraticCurveTo(-52, -12, -58, -34); ctx.stroke();
  circle(ctx, -58, -38, 8, a.c3);
  el(ctx, -16, -2, 13, 7, a.c1); el(ctx, 16, -2, 13, 7, a.c1);
  el(ctx, -28, -34, 8, 12, a.c1, 0.4); el(ctx, 28, -34, 8, 12, a.c1, -0.4);
  el(ctx, 0, -30, 36, 28, a.c1);
  el(ctx, 4, -26, 20, 16, a.c3);
  circle(ctx, 6, -68, 30, a.c1);
  el(ctx, 26, -60, 20, 15, a.c1);
  el(ctx, 42, -58, 9, 8, a.c3);
  circle(ctx, -8, -90, 8, a.c1); circle(ctx, 18, -94, 8, a.c1);
  el(ctx, -4, -74, 8, 7, '#fff'); el(ctx, 16, -74, 8, 7, '#fff');
  circle(ctx, -2, -72, 3.6, '#2b2b33'); circle(ctx, 18, -72, 3.6, '#2b2b33');
  ctx.strokeStyle = a.c2; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-12, -80); ctx.quadraticCurveTo(-4, -86, 4, -81); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8, -81); ctx.quadraticCurveTo(16, -86, 24, -80); ctx.stroke();
  smile(ctx, 22, -58, 14);
  blush(ctx, -12, -62, 6);
}

function _purin(ctx, a, t) {
  const breathe = Math.sin(t / 350) * 2;
  el(ctx, -13, -2, 12, 7, a.c2); el(ctx, 13, -2, 12, 7, a.c2);
  circle(ctx, 0, -46 + breathe * 0.5, 42, a.c1);
  el(ctx, 8, -30, 22, 16, a.c3);
  el(ctx, -36, -46 + breathe, 9, 12, a.c1, 0.5);
  el(ctx, 36, -46 - breathe, 9, 12, a.c1, -0.5);
  el(ctx, -16, -84, 10, 13, a.c2); el(ctx, 16, -84, 10, 13, a.c2);
  ctx.strokeStyle = a.c2; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -86); ctx.quadraticCurveTo(6, -104, 22, -96); ctx.stroke();
  const blink = (Math.sin(t / 1600) > -0.9) ? 1 : 0.1;
  el(ctx, -14, -60, 11, 12 * blink, '#fff'); el(ctx, 14, -60, 11, 12 * blink, '#fff');
  if (blink > 0.5) {
    circle(ctx, -12, -58, 5, '#2b4fd8'); circle(ctx, 16, -58, 5, '#2b4fd8');
    circle(ctx, -12, -58, 2.2, '#111'); circle(ctx, 16, -58, 2.2, '#111');
    circle(ctx, -14, -63, 1.8, '#fff'); circle(ctx, 14, -63, 1.8, '#fff');
  }
  ctx.strokeStyle = a.c2; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(-14, -61, 13, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.arc(14, -61, 13, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -42, 9, 0.1 * Math.PI, 0.9 * Math.PI); ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = 2.6; ctx.stroke();
  blush(ctx, -26, -48, 6); blush(ctx, 26, -48, 6);
}

/* ============================================================
   とり・こもり
   ============================================================ */
function _owl(ctx, a, t) {
  const sc = a.big ? 1.2 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const flap = Math.sin(t / 300) * 2;
  if (a.halo) {
    ctx.strokeStyle = '#ffe98a'; ctx.lineWidth = 4; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.ellipse(0, -112, 24, 7, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  el(ctx, -30, -38, 13, 26, a.c2, 0.3 + flap * 0.02);
  el(ctx, 30, -38, 13, 26, a.c2, -0.3 - flap * 0.02);
  el(ctx, 0, -34, 32, 32, a.c1);
  el(ctx, 0, -30, 20, 22, a.c3);
  for (const s of [-1, 1]) {
    poly(ctx, [s*18,-84, s*28,-112, s*34,-82], a.c1);
    if (a.tufts) poly(ctx, [s*22,-90, s*28,-108, s*32,-88], a.c2);
  }
  if (a.horns) { poly(ctx, [-22,-84, -34,-104, -14,-94], '#e8d060'); poly(ctx, [22,-84, 34,-104, 14,-94], '#e8d060'); }
  circle(ctx, -13, -66, 14, '#fff');
  circle(ctx, 13, -66, 14, '#fff');
  circle(ctx, -13, -66, 8, a.c2);
  circle(ctx, 13, -66, 8, a.c2);
  circle(ctx, -13, -66, 4, '#1f1a2a');
  circle(ctx, 13, -66, 4, '#1f1a2a');
  poly(ctx, [-5,-58, 0,-48, 5,-58], '#e8a03c');
  el(ctx, -11, -2, 9, 6, '#e8a03c'); el(ctx, 11, -2, 9, 6, '#e8a03c');
  eyeDot(ctx, -13, -84, 4); eyeDot(ctx, 13, -84, 4);
  ctx.restore();
}

function _penguin(ctx, a, t) {
  const sc = a.big ? 1.15 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const flap = Math.sin(t / 260) * 4;
  el(ctx, -24, -34, 8, 20, a.c2, 0.4 + flap * 0.01);
  el(ctx, 24, -34, 8, 20, a.c2, -0.4 - flap * 0.01);
  el(ctx, 0, -38, 30, 38, a.c1);
  el(ctx, 0, -32, 20, 29, a.c3);
  circle(ctx, 0, -80, 23, a.c1);
  el(ctx, 0, -78, 15, 16, a.c3);
  poly(ctx, [-5,-78, 0,-68, 5,-78], a.beak);
  poly(ctx, [-7,-60, 7,-60, 0,-52], a.beak);
  eyeDot(ctx, -8, -86, 4.5); eyeDot(ctx, 8, -86, 4.5);
  el(ctx, -11, -2, 10, 6, a.beak); el(ctx, 11, -2, 10, 6, a.beak);
  if (a.ice) { poly(ctx, [-30,-54, -38,-70, -24,-62], '#dff8ff'); poly(ctx, [30,-54, 38,-70, 24,-62], '#dff8ff'); }
  ctx.restore();
}

function _peacock(ctx, a, t) {
  const sc = a.big ? 1.15 : 1;
  ctx.save(); ctx.scale(sc, sc);
  for (let i = 0; i < 7; i++) {
    const ang = -Math.PI * 0.9 + (i / 6) * Math.PI * 0.8;
    const x = Math.cos(ang) * 44, y = -40 + Math.sin(ang) * 46;
    el(ctx, x, y, 15, 22, i % 2 ? a.c2 : a.c1, ang + Math.PI / 2);
    circle(ctx, x, y, 6, a.c3);
    circle(ctx, x, y, 3, a.c2);
  }
  el(ctx, 0, -30, 18, 28, a.c1);
  el(ctx, 0, -24, 11, 17, a.c3);
  el(ctx, -9, -2, 9, 6, '#e8a03c'); el(ctx, 9, -2, 9, 6, '#e8a03c');
  circle(ctx, 0, -66, 18, a.c1);
  poly(ctx, [-4,-82, -8,-100, 4,-88], a.c3);
  poly(ctx, [2,-84, 8,-102, 10,-86], a.c3);
  poly(ctx, [12,-64, 26,-60, 12,-56], '#e8b04f');
  eyeDot(ctx, -6, -70, 4); eyeDot(ctx, 6, -70, 4);
  ctx.restore();
}

function _bat(ctx, a, t) {
  const sc = a.big ? 1.2 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const flap = Math.sin(t / 180) * 5;
  ctx.fillStyle = a.c2;
  ctx.beginPath();
  ctx.moveTo(-14, -46);
  ctx.quadraticCurveTo(-54, -78 - flap, -62, -38);
  ctx.quadraticCurveTo(-44, -44, -36, -30);
  ctx.quadraticCurveTo(-26, -38, -16, -24);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(14, -46);
  ctx.quadraticCurveTo(54, -78 + flap, 62, -38);
  ctx.quadraticCurveTo(44, -44, 36, -30);
  ctx.quadraticCurveTo(26, -38, 16, -24);
  ctx.closePath(); ctx.fill();
  el(ctx, 0, -34, 22, 26, a.c1);
  el(ctx, 0, -30, 13, 17, a.c3);
  circle(ctx, 0, -66, 24, a.c1);
  poly(ctx, [-18,-80, -26,-108, -6,-88], a.c1);
  poly(ctx, [18,-80, 26,-108, 6,-88], a.c1);
  poly(ctx, [-18,-84, -22,-99, -10,-88], a.c2);
  poly(ctx, [18,-84, 22,-99, 10,-88], a.c2);
  if (a.horns) for (const s of [-1, 1]) limb(ctx, s * 11, -84, s * 25, -106, a.c3, 5);
  eyeDot(ctx, -8, -68, 5); eyeDot(ctx, 8, -68, 5);
  if (a.fangs) { poly(ctx, [-5,-56, -2,-47, 1,-56], '#fff'); poly(ctx, [5,-56, 2,-47, -1,-56], '#fff'); }
  else smile(ctx, 0, -56, 9);
  el(ctx, -9, -2, 7, 5, a.c2); el(ctx, 9, -2, 7, 5, a.c2);
  ctx.restore();
}

function _rabbit(ctx, a, t) {
  const sc = a.big ? 1.18 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const wag = Math.sin(t / 350) * 3;
  circle(ctx, -18, -20, 10, a.c3);
  el(ctx, 0, -28, 26, 27, a.c1);
  el(ctx, 0, -24, 16, 18, a.c3);
  el(ctx, -24, -32, 8, 12, a.c1, 0.4); el(ctx, 24, -32, 8, 12, a.c1, -0.4);
  el(ctx, -14, -2, 12, 7, a.c1); el(ctx, 14, -2, 12, 7, a.c1);
  circle(ctx, 0, -64, 25, a.c1);
  for (const s of [-1, 1]) {
    const flop = a.flop && s === 1;
    const ex = flop ? 23 : s * 11;
    const ey = flop ? -80 + wag * s * 0.4 : -94 + wag * s * 0.4;
    const er = flop ? 1.05 : s * 0.12;
    el(ctx, ex, ey, 8, flop ? 24 : 30, a.c1, er);
    el(ctx, ex, ey, 4, flop ? 16 : 21, a.pinkear ? '#f0a8b8' : a.c3, er);
  }
  if (a.moon) { circle(ctx, 0, -78, 5, '#fff6b0'); circle(ctx, 3, -79, 4, a.c1); }
  eyeDot(ctx, -10, -67, 5); eyeDot(ctx, 10, -67, 5);
  circle(ctx, 0, -57, 2.4, a.c2);
  smile(ctx, 0, -53, 10);
  blush(ctx, -17, -58, 5); blush(ctx, 17, -58, 5);
  ctx.restore();
}

function _mole(ctx, a, t) {
  const sc = a.big ? 1.15 : 1;
  ctx.save(); ctx.scale(sc, sc);
  el(ctx, 0, -28, 34, 24, a.c1);
  el(ctx, 0, -24, 22, 15, a.c3);
  for (const s of [-1, 1]) {
    el(ctx, s * 34, -26, 11, 14, a.c1, s * 0.4);
    if (a.claws) for (let i = -1; i <= 1; i++) poly(ctx, [s*(40+i*6),-32, s*(52+i*7),-36, s*(40+i*6),-24], a.c3);
    el(ctx, s * 14, -2, 11, 6, a.c1);
  }
  circle(ctx, 0, -56, 24, a.c1);
  el(ctx, 0, -48, 15, 11, a.c3);
  circle(ctx, 0, -46, 6, '#e88a9a');
  eyeDot(ctx, -10, -62, 3); eyeDot(ctx, 10, -62, 3);
  limb(ctx, -18,-58, -30,-54, a.c2, 2); limb(ctx, 18,-58, 30,-54, a.c2, 2);
  ctx.restore();
}

function _deer(ctx, a, t) {
  const sc = a.big ? 1.15 : 1;
  ctx.save(); ctx.scale(sc, sc);
  el(ctx, 0, -38, 22, 30, a.c1);
  el(ctx, 0, -34, 13, 20, a.c3);
  for (const s of [-1, 1]) {
    limb(ctx, s*14, -8, s*14, 0, a.c1, 6);
    el(ctx, s * 16, -1, 7, 4, a.c2);
  }
  el(ctx, 0, -66, 16, 20, a.c1);
  el(ctx, 0, -60, 9, 12, a.c3);
  circle(ctx, 0, -84, 17, a.c1);
  el(ctx, 0, -76, 10, 8, a.c3);
  if (a.antlers) {
    for (const s of [-1, 1]) {
      limb(ctx, s * 8, -96, s * 18, -118, a.c2, 4);
      limb(ctx, s * 13, -106, s * 26, -112, a.c2, 3);
      limb(ctx, s * 16, -112, s * 28, -122, a.c2, 3);
    }
  }
  eyeDot(ctx, -6, -86, 3.5); eyeDot(ctx, 6, -86, 3.5);
  circle(ctx, 0, -78, 2, a.c2);
  for (const s of [-1, 1]) { circle(ctx, s*8, -70, 3, a.c2); }
  ctx.restore();
}

function _bear(ctx, a, t) {
  const sc = a.big ? 1.2 : 1;
  ctx.save(); ctx.scale(sc, sc);
  el(ctx, 0, -32, 36, 32, a.c1);
  el(ctx, 0, -28, 24, 22, a.c3);
  el(ctx, -20, -3, 12, 7, a.c2); el(ctx, 20, -3, 12, 7, a.c2);
  el(ctx, -32, -36, 9, 12, a.c1, 0.5); el(ctx, 32, -36, 9, 12, a.c1, -0.5);
  circle(ctx, 0, -72, 28, a.c1);
  circle(ctx, -18, -92, 10, a.c1); circle(ctx, 18, -92, 10, a.c1);
  circle(ctx, -18, -92, 5, a.c3); circle(ctx, 18, -92, 5, a.c3);
  el(ctx, 0, -60, 13, 10, a.c3);
  circle(ctx, 0, -64, 4, a.c2);
  eyeDot(ctx, -11, -76, 5); eyeDot(ctx, 11, -76, 5);
  smile(ctx, 0, -54, 10);
  ctx.restore();
}

function _panda(ctx, a, t) {
  const sc = a.big ? 1.18 : 1;
  ctx.save(); ctx.scale(sc, sc);
  el(ctx, 0, -32, 35, 31, a.c1);
  el(ctx, 0, -28, 23, 21, a.c3);
  el(ctx, -18, -4, 12, 8, a.c2); el(ctx, 18, -4, 12, 8, a.c2);
  el(ctx, -30, -36, 10, 15, a.c2, 0.5); el(ctx, 30, -36, 10, 15, a.c2, -0.5);
  circle(ctx, 0, -70, 28, a.c1);
  circle(ctx, -19, -90, 11, a.c2); circle(ctx, 19, -90, 11, a.c2);
  el(ctx, -11, -73, 9, 11, a.c2, -0.25);
  el(ctx, 11, -73, 9, 11, a.c2, 0.25);
  circle(ctx, -11, -73, 4, '#fff'); circle(ctx, 11, -73, 4, '#fff');
  circle(ctx, -10, -73, 2, '#111'); circle(ctx, 10, -73, 2, '#111');
  el(ctx, 0, -58, 10, 7, '#e8e8e8');
  circle(ctx, 0, -60, 3, '#3a3a3a');
  smile(ctx, 0, -54, 8);
  poly(ctx, [20,-84, 34,-104, 28,-82], '#6fae4a');
  ctx.restore();
}

function _sheep(ctx, a, t) {
  const sc = a.big ? 1.18 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const wob = Math.sin(t / 350) * 2;
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * TAU;
    circle(ctx, Math.cos(ang) * 24, -42 + Math.sin(ang) * 22 + wob, 14, i % 2 ? a.c1 : a.c3);
  }
  el(ctx, 0, -38, 30, 28, a.c1);
  el(ctx, -14, -3, 10, 6, a.c2); el(ctx, 14, -3, 10, 6, a.c2);
  circle(ctx, 0, -72, 20, a.c2);
  el(ctx, 0, -66, 13, 12, a.c3);
  if (a.horns) {
    ctx.strokeStyle = '#c8b080'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-20, -80, 12, 0.4 * Math.PI, 1.7 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(20, -80, 12, -0.7 * Math.PI, 0.6 * Math.PI); ctx.stroke();
  }
  if (a.spark) {
    poly(ctx, [-30,-58, -22,-72, -24,-62, -14,-68, -26,-52], '#ffe04a');
    poly(ctx, [30,-58, 22,-72, 24,-62, 14,-68, 26,-52], '#ffe04a');
  }
  eyeDot(ctx, -7, -74, 4); eyeDot(ctx, 7, -74, 4);
  smile(ctx, 0, -64, 9);
  ctx.restore();
}

/* ============================================================
   むし・みず
   ============================================================ */
function _spider(ctx, a, t) {
  const sc = a.big ? 1.18 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const legLen = a.longlegs ? 46 : 30;
  ctx.strokeStyle = a.c2; ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const y = -36 + i * 8;
    const k = Math.sin(t / 300 + i) * 2;
    limb(ctx, -10, y, -legLen, y - 18 + k, a.c2, 4);
    limb(ctx, -legLen, y - 18 + k, -legLen - 6, y + 2, a.c2, 4);
    limb(ctx, 10, y, legLen, y - 18 - k, a.c2, 4);
    limb(ctx, legLen, y - 18 - k, legLen + 6, y + 2, a.c2, 4);
  }
  circle(ctx, 0, -36, 22, a.c1);
  if (a.spots) { circle(ctx, -8, -40, 5, a.c3); circle(ctx, 9, -32, 5, a.c3); }
  if (a.blades) {
    poly(ctx, [-20,-44, -34,-64, -12,-50], a.c3);
    poly(ctx, [20,-44, 34,-64, 12,-50], a.c3);
  }
  circle(ctx, 0, -66, 18, a.c1);
  for (let i = -1; i <= 1; i++) {
    circle(ctx, i * 7, -70, 3.5, i === 0 ? '#fff' : a.c3);
    circle(ctx, i * 7, -70, 1.6, '#1f1a2a');
  }
  smile(ctx, 0, -60, 8);
  ctx.restore();
}

function _beetle(ctx, a, t) {
  const sc = a.big ? 1.15 : 1;
  ctx.save(); ctx.scale(sc, sc);
  ctx.strokeStyle = a.c2; ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    limb(ctx, -18, -30 + i * 10, -36, -20 + i * 10, a.c2, 4);
    limb(ctx, 18, -30 + i * 10, 36, -20 + i * 10, a.c2, 4);
  }
  el(ctx, 0, -38, 34, 30, a.c1);
  el(ctx, 0, -42, 28, 22, a.c3);
  poly(ctx, [-2,-62, 2,-62, 8,-40, -8,-40], a.c2);
  if (a.horn) {
    ctx.strokeStyle = a.c3; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(0, -62); ctx.quadraticCurveTo(4, -94, 18, -104); ctx.stroke();
    poly(ctx, [12,-102, 24,-110, 20,-96], a.c3);
  }
  if (a.pincers) {
    ctx.strokeStyle = a.c3; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-6,-64); ctx.quadraticCurveTo(-20,-92,-30,-98); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6,-64); ctx.quadraticCurveTo(20,-92,30,-98); ctx.stroke();
    poly(ctx, [-30,-98, -38,-104, -28,-90], a.c3);
    poly(ctx, [30,-98, 38,-104, 28,-90], a.c3);
  }
  circle(ctx, 0, -68, 17, a.c1);
  eyeDot(ctx, -7, -70, 4); eyeDot(ctx, 7, -70, 4);
  ctx.restore();
}

function _bee(ctx, a, t) {
  const sc = a.big ? 1.15 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const flap = Math.sin(t / 100) * 6;
  ctx.globalAlpha = 0.7;
  el(ctx, -22, -76 + flap, 20, 12, '#e8f8ff', -0.5);
  el(ctx, 22, -76 - flap, 20, 12, '#e8f8ff', 0.5);
  ctx.globalAlpha = 1;
  el(ctx, 0, -40, 26, 24, a.c1);
  for (let i = 0; i < 3; i++) el(ctx, 0, -48 + i * 12, 26 - Math.abs(i - 1) * 4, 5, a.c2);
  poly(ctx, [0,-16, -7,-4, 7,-4], a.c2);
  circle(ctx, 0, -72, 20, a.c1);
  if (a.firefly) {
    const g = 6 + Math.sin(t / 200) * 2;
    ctx.globalAlpha = 0.5; circle(ctx, 0, -20, g + 8, '#fff06a'); ctx.globalAlpha = 1;
    circle(ctx, 0, -20, g, '#fff06a');
  }
  ctx.strokeStyle = a.c2; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-6,-86); ctx.quadraticCurveTo(-14,-102,-22,-100); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6,-86); ctx.quadraticCurveTo(14,-102,22,-100); ctx.stroke();
  circle(ctx, -22, -100, 4, a.c2); circle(ctx, 22, -100, 4, a.c2);
  eyeDot(ctx, -8, -74, 5); eyeDot(ctx, 8, -74, 5);
  smile(ctx, 0, -64, 9);
  ctx.restore();
}

function _snail(ctx, a, t) {
  const sc = a.big ? 1.15 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const wob = Math.sin(t / 400) * 2;
  el(ctx, 0, -14, 44, 12, a.c1);
  el(ctx, 0, -16, 30, 8, a.c3);
  circle(ctx, -22, -38, 28, a.c2);
  ctx.strokeStyle = a.c3; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(-22, -38, 18, 0, Math.PI * 1.6); ctx.stroke();
  ctx.beginPath(); ctx.arc(-22, -38, 9, 0, Math.PI * 1.4); ctx.stroke();
  el(ctx, 24, -34 + wob, 16, 18, a.c1);
  el(ctx, 24, -30 + wob, 10, 12, a.c3);
  ctx.strokeStyle = a.c1; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(28,-50); ctx.lineTo(32,-70); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(20,-50); ctx.lineTo(18,-68); ctx.stroke();
  circle(ctx, 32, -72, 5, '#fff'); circle(ctx, 18, -70, 5, '#fff');
  circle(ctx, 33, -72, 2, '#2b2b33'); circle(ctx, 19, -70, 2, '#2b2b33');
  smile(ctx, 28, -36, 8);
  ctx.restore();
}

function _fish(ctx, a, t) {
  const sc = a.big ? 1.18 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const wag = Math.sin(t / 260) * 5;
  if (a.bubble) {
    ctx.globalAlpha = 0.35;
    circle(ctx, 34, -78, 6, '#dff8ff'); circle(ctx, 44, -94, 4, '#dff8ff'); circle(ctx, 28, -96, 3, '#dff8ff');
    ctx.globalAlpha = 1;
  }
  poly(ctx, [-28,-40, -54,-58 + wag, -48,-36, -54,-14 + wag, -28,-30], a.c2);
  poly(ctx, [-4,-62, 10,-82, 20,-58], a.c2);
  el(ctx, 0, -38, 42, 28, a.c1);
  el(ctx, 2, -32, 30, 16, a.c3);
  if (a.leaf) { el(ctx, -10, -70, 16, 7, a.c3, -0.5); limb(ctx, -10, -64, -10, -54, a.c2, 2); }
  if (a.croc) {
    el(ctx, 32, -32, 26, 11, a.c1);
    for (let i = 0; i < 4; i++) poly(ctx, [22 + i * 9, -24, 26 + i * 9, -18, 30 + i * 9, -24], '#fff');
    limb(ctx, -12, -14, -16, -2, a.c2, 5); limb(ctx, 12, -14, 14, -2, a.c2, 5);
    circle(ctx, 30, -40, 3, a.c2); circle(ctx, 42, -40, 3, a.c2);
    eyeDot(ctx, 12, -48, 5);
  } else if (a.fangs) {
    el(ctx, 20, -34, 16, 14, a.c3);
    poly(ctx, [12,-26, 16,-18, 20,-26], '#fff'); poly(ctx, [24,-26, 28,-18, 32,-26], '#fff');
    eyeDot(ctx, 14, -46, 5);
  } else {
    eyeDot(ctx, 18, -46, 6);
  }
  ctx.restore();
}

function _ray(ctx, a, t) {
  const sc = a.big ? 1.2 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const flap = Math.sin(t / 320) * 6;
  ctx.fillStyle = a.c2;
  ctx.beginPath();
  ctx.moveTo(0, -56);
  ctx.quadraticCurveTo(-54, -74 - flap, -64, -34);
  ctx.quadraticCurveTo(-36, -44, 0, -28);
  ctx.quadraticCurveTo(36, -44, 64, -34);
  ctx.quadraticCurveTo(54, -74 + flap, 0, -56);
  ctx.fill();
  el(ctx, 0, -46, 26, 22, a.c1);
  el(ctx, 0, -42, 17, 13, a.c3);
  ctx.strokeStyle = a.c1; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -28); ctx.quadraticCurveTo(-8, 0, 8, 6); ctx.stroke();
  if (a.snow) for (let i = -1; i <= 1; i++) poly(ctx, [i*18-4,-64, i*18,-80, i*18+4,-64], '#eaffff');
  if (a.crown) for (let i = -1; i <= 1; i++) poly(ctx, [i*10-4,-72, i*10,-84, i*10+4,-72], '#ffe066');
  eyeDot(ctx, -9, -54, 4); eyeDot(ctx, 9, -54, 4);
  smile(ctx, 0, -44, 8);
  ctx.restore();
}

function _jelly(ctx, a, t) {
  const sc = a.big ? 1.2 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const pulse = Math.sin(t / 420) * 3;
  if (a.glow) { ctx.globalAlpha = 0.2; circle(ctx, 0, -60, 44 + pulse, a.c1); ctx.globalAlpha = 1; }
  ctx.fillStyle = a.c1;
  ctx.beginPath();
  ctx.arc(0, -62, 34 + pulse, Math.PI, 0);
  ctx.quadraticCurveTo(34 + pulse, -38, 20, -38);
  ctx.quadraticCurveTo(8, -38, 0, -42);
  ctx.quadraticCurveTo(-8, -38, -20, -38);
  ctx.quadraticCurveTo(-34 - pulse, -38, -34 - pulse, -62);
  ctx.fill();
  for (let i = -2; i <= 2; i++) {
    ctx.strokeStyle = i % 2 ? a.c2 : a.c3; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(i * 12, -40);
    ctx.quadraticCurveTo(i * 12 + Math.sin(t / 300 + i) * 8, -20, i * 12 + Math.sin(t / 260 + i) * 12, -4);
    ctx.stroke();
  }
  eyeDot(ctx, -10, -64, 4); eyeDot(ctx, 10, -64, 4);
  smile(ctx, 0, -54, 8);
  ctx.restore();
}

function _squid(ctx, a, t) {
  const sc = a.big ? 1.15 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const wob = Math.sin(t / 300) * 3;
  for (let i = -2; i <= 2; i++) {
    ctx.strokeStyle = i % 2 ? a.c2 : a.c3; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(i * 8, -34);
    ctx.quadraticCurveTo(i * 10 + wob, -18, i * 12 - wob, 2);
    ctx.stroke();
  }
  el(ctx, 0, -58, 30, 30, a.c1);
  el(ctx, 0, -54, 20, 20, a.c3);
  if (a.fire) {
    const f = Math.sin(t / 140) * 2;
    el(ctx, 0, -88, 12, 14 + f, '#ffb03c');
    el(ctx, 0, -92, 6, 8, '#fff0a0');
  } else {
    poly(ctx, [-6,-86, 0,-98, 6,-86], a.c2);
  }
  eyeDot(ctx, -11, -60, 6); eyeDot(ctx, 11, -60, 6);
  smile(ctx, 0, -48, 10);
  ctx.restore();
}

function _star(ctx, a, t) {
  const sc = a.big ? 1.2 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const pulse = Math.sin(t / 400) * 2;
  if (a.urchin) {
    ctx.strokeStyle = a.c2; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * TAU;
      limb(ctx, Math.cos(ang) * 18, -48 + Math.sin(ang) * 18, Math.cos(ang) * (38 + pulse), -48 + Math.sin(ang) * (38 + pulse), a.c2, 4);
    }
  }
  ctx.fillStyle = a.c1;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + i * Math.PI / 5;
    const r = i % 2 ? 18 : 42 + pulse;
    const x = Math.cos(ang) * r, y = -48 + Math.sin(ang) * r;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath(); ctx.fill();
  if (a.arms) for (let i = 0; i < 5; i++) {
    const ang = -Math.PI / 2 + i * TAU / 5;
    circle(ctx, Math.cos(ang) * 30, -48 + Math.sin(ang) * 30, 4, a.c3);
  }
  eyeDot(ctx, -8, -52, 4); eyeDot(ctx, 8, -52, 4);
  smile(ctx, 0, -42, 8);
  ctx.restore();
}

function _eel(ctx, a, t) {
  const sc = a.big ? 1.15 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const wig = Math.sin(t / 240) * 6;
  ctx.strokeStyle = a.c1; ctx.lineWidth = 18; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-36, -4);
  ctx.bezierCurveTo(-20, -30, 8, -4, 14, -30);
  ctx.bezierCurveTo(20, -54, -12, -56, -4, -78);
  ctx.stroke();
  el(ctx, -4, -80, 17, 15, a.c1);
  el(ctx, 8, -76, 12, 8, a.c1);
  eyeDot(ctx, -2, -84, 4); eyeDot(ctx, 8, -82, 4);
  if (a.spark !== false) {
    poly(ctx, [-30,-20, -20,-34, -22,-24, -10,-30, -22,-14], a.c3);
    poly(ctx, [24,-44, 34,-58, 32,-48, 42,-54, 30,-38], a.c3);
  }
  smile(ctx, 4, -72, 8);
  ctx.restore();
}

function _frog(ctx, a, t) {
  const sc = a.big ? 1.16 : 1;
  ctx.save(); ctx.scale(sc, sc);
  el(ctx, 0, -28, 40, 26, a.c1);
  el(ctx, 0, -24, 27, 16, a.c3);
  for (const s of [-1, 1]) {
    el(ctx, s * 30, -4, 14, 7, a.c1);
    circle(ctx, s * 17, -54, 14, a.c1);
    circle(ctx, s * 17, -54, 10, '#fff');
    circle(ctx, s * 17, -54, 5, '#1f2a1a');
  }
  if (a.spikes) for (let i = -2; i <= 2; i++) poly(ctx, [i*12-4,-48, i*12,-64, i*12+4,-48], a.c2);
  ctx.strokeStyle = a.c2; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, -22, 18, 0.12 * Math.PI, 0.88 * Math.PI); ctx.stroke();
  if (a.bubble) {
    ctx.globalAlpha = 0.4; circle(ctx, 34, -66, 6, '#dff8ff'); circle(ctx, 44, -80, 4, '#dff8ff'); ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/* ============================================================
   くさ・はな
   ============================================================ */
function _mushroom(ctx, a, t) {
  const sc = a.small ? 0.8 : a.big ? 1.16 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const bob = Math.sin(t / 500) * 2;
  el(ctx, 0, -26, 20, 26, a.c3);
  el(ctx, 0, -22, 12, 17, '#fff8f0');
  el(ctx, -22, -2, 10, 6, a.c2); el(ctx, 22, -2, 10, 6, a.c2);
  ctx.fillStyle = a.c1;
  ctx.beginPath(); ctx.ellipse(0, -58 + bob, 40, 26, 0, Math.PI, 0); ctx.fill();
  el(ctx, 0, -58 + bob, 40, 8, a.c2);
  if (a.spots) {
    circle(ctx, -18, -66 + bob, 7, a.c3); circle(ctx, 10, -72 + bob, 6, a.c3); circle(ctx, 24, -62 + bob, 5, a.c3);
  }
  eyeDot(ctx, -7, -30, 5); eyeDot(ctx, 7, -30, 5);
  smile(ctx, 0, -20, 9);
  blush(ctx, -13, -26, 4); blush(ctx, 13, -26, 4);
  ctx.restore();
}

function _flower(ctx, a, t) {
  const sc = a.big ? 1.16 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const sway = Math.sin(t / 450) * 3;
  if (a.thorns) {
    limb(ctx, 0, -6, 0, -46, a.c2, 7);
    for (let i = 0; i < 3; i++) poly(ctx, [-4,-16 - i * 10, -14,-22 - i * 10, -4,-28 - i * 10], a.c2);
  } else {
    limb(ctx, 0 + sway, -6, 0, -48, a.c2, 7);
  }
  el(ctx, -18, -14, 14, 6, a.c2, -0.4);
  el(ctx, 18, -20, 14, 6, a.c2, 0.4);
  const cy = -62 + bob0(t);
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * TAU + sway * 0.01;
    el(ctx, Math.cos(ang) * 21, cy + Math.sin(ang) * 21, 13, 13, a.c1);
  }
  circle(ctx, 0, cy, 16, a.sun ? '#a86a2a' : a.c2);
  if (a.sun) for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * TAU;
    poly(ctx, [Math.cos(ang)*38, cy + Math.sin(ang)*38, Math.cos(ang+0.12)*50, cy + Math.sin(ang+0.12)*50, Math.cos(ang-0.12)*50, cy + Math.sin(ang-0.12)*50], '#f0c83c');
  }
  if (a.fairy) { circle(ctx, -30, cy - 24, 4, '#fff'); circle(ctx, 30, cy - 18, 3, '#fff'); }
  eyeDot(ctx, -6, cy - 2, 4); eyeDot(ctx, 6, cy - 2, 4);
  smile(ctx, 0, cy + 6, 8);
  el(ctx, -10, -2, 9, 6, a.c2); el(ctx, 10, -2, 9, 6, a.c2);
  ctx.restore();
}
function bob0(t) { return Math.sin(t / 420) * 2; }

function _cactus(ctx, a, t) {
  const sc = a.big ? 1.16 : 1;
  ctx.save(); ctx.scale(sc, sc);
  el(ctx, 0, -38, 24, 40, a.c1);
  el(ctx, -30, -42, 10, 20, a.c1, 0.2);
  el(ctx, -30, -58, 10, 14, a.c1, -0.6);
  el(ctx, 30, -34, 10, 18, a.c1, -0.2);
  el(ctx, 30, -48, 10, 12, a.c1, 0.6);
  ctx.strokeStyle = a.c2; ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath(); ctx.moveTo(0, -70 + i * 11); ctx.lineTo(0, -66 + i * 11); ctx.stroke();
  }
  for (let i = -1; i <= 1; i++) { limb(ctx, i*10, -30, i*10, -24, a.c2, 2); }
  if (a.bloom) { circle(ctx, 0, -78, 9, '#f08ab0'); circle(ctx, 0, -78, 4, '#ffe0a0'); }
  eyeDot(ctx, -7, -54, 4); eyeDot(ctx, 7, -54, 4);
  smile(ctx, 0, -44, 8);
  el(ctx, -12, -2, 10, 6, a.c2); el(ctx, 12, -2, 10, 6, a.c2);
  ctx.restore();
}

/* ============================================================
   きかい・その他
   ============================================================ */
function _gear(ctx, a, t) {
  const sc = a.big ? 1.15 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const spin = t / 900;
  const gear = (x, y, r, teeth, color) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(spin);
    for (let i = 0; i < teeth; i++) {
      const ang = (i / teeth) * TAU;
      el(ctx, Math.cos(ang) * r, Math.sin(ang) * r, 6, 6, color);
    }
    circle(ctx, 0, 0, r, color);
    circle(ctx, 0, 0, r * 0.45, a.c3);
    ctx.restore();
  };
  gear(-20, -44, 22, 8, a.c1);
  gear(20, -22, 16, 6, a.c2);
  gear(18, -66, 12, 5, a.c1);
  eyeDot(ctx, -26, -46, 4); eyeDot(ctx, -14, -46, 4);
  smile(ctx, -20, -34, 8);
  el(ctx, -18, -2, 10, 6, a.c2); el(ctx, 18, -2, 10, 6, a.c2);
  ctx.restore();
}

function _robot(ctx, a, t) {
  const sc = a.big ? 1.15 : 1;
  ctx.save(); ctx.scale(sc, sc);
  ctx.fillStyle = a.c1; ctx.fillRect(-28, -66, 56, 46);
  ctx.strokeStyle = a.c2; ctx.lineWidth = 3; ctx.strokeRect(-28, -66, 56, 46);
  ctx.fillStyle = a.c3; ctx.fillRect(-18, -58, 36, 16);
  circle(ctx, -8, -50, 4, '#4af0ff'); circle(ctx, 8, -50, 4, '#4af0ff');
  ctx.fillStyle = a.c2;
  ctx.fillRect(-38, -62, 10, 30); ctx.fillRect(28, -62, 10, 30);
  ctx.fillRect(-18, -20, 12, 20); ctx.fillRect(6, -20, 12, 20);
  ctx.fillRect(-14, -74, 28, 8);
  ctx.fillStyle = a.c1; ctx.fillRect(-14, -92, 28, 20);
  ctx.strokeRect(-14, -92, 28, 20);
  circle(ctx, 0, -82, 6, '#4af0ff');
  limb(ctx, 0, -92, 0, -104, a.c2, 3);
  circle(ctx, 0, -106, 4, '#ff5c5c');
  el(ctx, 0, -26, 12, 5, a.c2);
  ctx.restore();
}

function _seahorse(ctx, a, t) {
  const sc = a.big ? 1.18 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const wob = Math.sin(t / 350) * 3;
  if (a.shell) {
    el(ctx, -18, -44, 20, 24, a.c2, -0.3);
    ctx.strokeStyle = a.c3; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-18, -44, 12, 0, Math.PI * 1.6); ctx.stroke();
  }
  ctx.strokeStyle = a.c1; ctx.lineWidth = 16; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(6, -30);
  ctx.quadraticCurveTo(-18, -22, -14, -6);
  ctx.quadraticCurveTo(-10, 4, 0, 0);
  ctx.stroke();
  el(ctx, 4, -48, 16, 22, a.c1);
  el(ctx, 4, -44, 9, 14, a.c3);
  circle(ctx, 8, -72, 16, a.c1);
  el(ctx, 22, -70, 12, 6, a.c1);
  poly(ctx, [-6,-60, -20,-72, -4,-70], a.c3);
  poly(ctx, [-10,-50, -26,-52, -12,-42], a.c3);
  if (a.crown) for (let i = -1; i <= 1; i++) poly(ctx, [i*8-3,-86, i*8,-96, i*8+3,-86], '#ffe066');
  eyeDot(ctx, 8, -76, 4);
  smile(ctx, 18, -66, 6);
  ctx.restore();
}

function _crab(ctx, a, t) {
  const sc = a.big ? 1.2 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const snap = Math.sin(t / 400) * 4;
  for (const s of [-1, 1]) {
    limb(ctx, s * 20, -34, s * 40, -46 + snap * s, a.c2, 5);
    el(ctx, s * 46, -50 + snap * s, 12, 9, a.c1, s * 0.2);
    poly(ctx, [s*52,-56 + snap*s, s*62,-48 + snap*s, s*50,-44 + snap*s], a.c3);
    for (let i = 0; i < 3; i++) limb(ctx, s*(16 + i*4), -22, s*(30 + i*6), -10 + i * 4, a.c2, 3);
  }
  el(ctx, 0, -32, 32, 22, a.c1);
  el(ctx, 0, -34, 22, 14, a.c3);
  if (a.spikes) for (let i = -1; i <= 1; i++) poly(ctx, [i*14-4,-52, i*14,-66, i*14+4,-52], a.c3);
  if (a.skull) {
    circle(ctx, 0, -36, 9, '#e8f0e8');
    circle(ctx, -3, -38, 2.5, '#2b2b33'); circle(ctx, 3, -38, 2.5, '#2b2b33');
  }
  if (a.steel) { ctx.strokeStyle = a.c3; ctx.lineWidth = 2; ctx.strokeRect(-16, -42, 32, 14); }
  for (const s of [-1, 1]) {
    limb(ctx, s * 8, -50, s * 10, -62, a.c1, 4);
    circle(ctx, s * 10, -64, 6, '#fff');
    circle(ctx, s * 10, -64, 3, '#1f1a2a');
  }
  smile(ctx, 0, -28, 10);
  ctx.restore();
}

function _fighter(ctx, a, t) {
  const sc = a.big ? 1.2 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const bob = Math.sin(t / 400) * 2;
  el(ctx, -11, -3, 10, 6, a.c2); el(ctx, 11, -3, 10, 6, a.c2);
  el(ctx, 0, -34, 20, 26, a.c1);
  el(ctx, 0, -32, 12, 17, a.c3);
  if (a.steel) {
    ctx.fillStyle = a.c2; ctx.fillRect(-22, -56, 44, 20);
    ctx.strokeStyle = a.c3; ctx.lineWidth = 2; ctx.strokeRect(-22, -56, 44, 20);
  }
  circle(ctx, -20, -24 + bob, 9, a.c1); circle(ctx, 20, -24 - bob, 9, a.c1);
  el(ctx, -20, -22 + bob, 7, 5, a.c2); el(ctx, 20, -22 - bob, 7, 5, a.c2);
  el(ctx, -24, -42, 8, 14, a.c1, 0.5); el(ctx, 24, -42, 8, 14, a.c1, -0.5);
  circle(ctx, 0, -70, 18, a.c1);
  limb(ctx, -10, -82, 10, -82, a.c2, 5);
  eyeDot(ctx, -6, -72, 4); eyeDot(ctx, 6, -72, 4);
  ctx.strokeStyle = a.c2; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-6, -62); ctx.lineTo(6, -62); ctx.stroke();
  if (a.steel) { poly(ctx, [-18,-86, 0,-96, 18,-86], a.c2); }
  ctx.restore();
}

function _snowball(ctx, a, t) {
  const sc = a.big ? 1.15 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const pulse = Math.sin(t / 450) * 2;
  if (a.spikes) {
    ctx.strokeStyle = a.c2; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * TAU;
      limb(ctx, Math.cos(ang) * 26, -46 + Math.sin(ang) * 26, Math.cos(ang) * (40 + pulse), -46 + Math.sin(ang) * (40 + pulse), a.c2, 4);
    }
  }
  if (a.crystal) {
    for (let i = 0; i < 4; i++) {
      const ang = -1.9 + i * 0.75;
      const bx = Math.cos(ang) * 30, by = -46 + Math.sin(ang) * 30;
      poly(ctx, [bx - 7, by + 4, bx, by - 26, bx + 7, by + 4], c3bright(a.c3));
    }
  }
  circle(ctx, 0, -46 + pulse * 0.3, 34, a.c1);
  el(ctx, -8, -54, 12, 10, '#fff');
  eyeDot(ctx, -10, -50, 5); eyeDot(ctx, 10, -50, 5);
  poly(ctx, [-4,-40, 0,-32, 4,-40], a.c2);
  el(ctx, -12, -2, 9, 6, a.c2); el(ctx, 12, -2, 9, 6, a.c2);
  ctx.restore();
}

function _orb(ctx, a, t) {
  const sc = a.big ? 1.2 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const bob = Math.sin(t / 500) * 4;
  const pulse = Math.sin(t / 380) * 2;
  if (a.ring) {
    ctx.strokeStyle = a.c2; ctx.lineWidth = 4; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.ellipse(0, -50 + bob, 38 + pulse, 12, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  circle(ctx, 0, -50 + bob, 30, a.c1);
  el(ctx, -8, -58 + bob, 12, 10, '#fff');
  if (a.moon) { circle(ctx, 12, -66 + bob, 8, '#fff6b0'); circle(ctx, 15, -68 + bob, 6, a.c1); }
  eyeDot(ctx, -9, -50 + bob, 4); eyeDot(ctx, 9, -50 + bob, 4);
  smile(ctx, 0, -40 + bob, 8);
  for (let i = 0; i < 3; i++) {
    const ang = t / 700 + i * 2.1;
    circle(ctx, Math.cos(ang) * 38, -58 + Math.sin(ang * 1.3) * 24, 3, a.c2);
  }
  ctx.restore();
}

function _mummy(ctx, a, t) {
  const sc = a.big ? 1.18 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const bob = Math.sin(t / 450) * 2;
  el(ctx, -10, -3, 10, 6, a.c2); el(ctx, 10, -3, 10, 6, a.c2);
  el(ctx, 0, -34, 22, 28, a.c1);
  el(ctx, -26, -34 + bob, 10, 16, a.c1, 0.5);
  el(ctx, 26, -34 - bob, 10, 16, a.c1, -0.5);
  ctx.strokeStyle = a.c2; ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath(); ctx.moveTo(-20, -22 - i * 10); ctx.lineTo(20, -26 - i * 10); ctx.stroke();
  }
  circle(ctx, 0, -70, 20, a.c1);
  ctx.strokeStyle = a.c2; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-18, -76); ctx.lineTo(18, -70); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-18, -64); ctx.lineTo(18, -70); ctx.stroke();
  circle(ctx, -7, -74, 4, '#4af0c8'); circle(ctx, 7, -74, 4, '#4af0c8');
  if (a.vine) {
    ctx.strokeStyle = '#6fae4a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-16,-50); ctx.quadraticCurveTo(-24,-30,-14,-14); ctx.stroke();
    circle(ctx, -14, -12, 5, '#8ad86a');
    ctx.beginPath(); ctx.moveTo(18,-54); ctx.quadraticCurveTo(24,-36,16,-22); ctx.stroke();
    circle(ctx, 16, -20, 4, '#8ad86a');
  }
  ctx.restore();
}

function _snake(ctx, a, t) {
  const sc = a.big ? 1.16 : 1;
  ctx.save(); ctx.scale(sc, sc);
  const sway = Math.sin(t / 380) * 4;
  if (a.wings) {
    const flap = Math.sin(t / 300) * 5;
    ctx.fillStyle = a.c2;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(12, -70);
      ctx.quadraticCurveTo(12 + s * 40, -96 - flap, 12 + s * 52, -62);
      ctx.quadraticCurveTo(12 + s * 34, -66, 12 + s * 28, -52);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.strokeStyle = a.c1; ctx.lineWidth = 20; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-34, -6);
  ctx.bezierCurveTo(-10, -20, 24, -6, 18, -28);
  ctx.bezierCurveTo(12, -48, -18, -40, -8, -62);
  ctx.bezierCurveTo(-2, -76, 14, -70, 12, -84);
  ctx.stroke();
  if (a.metal) {
    ctx.strokeStyle = a.c3; ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-20 + i * 12, -12 - i * 13, 6, 0, Math.PI); ctx.stroke(); }
  }
  if (a.fins) {
    poly(ctx, [-18,-50, -36,-64, -12,-62], a.c3);
    poly(ctx, [4,-70, 24,-86, 8,-60], a.c3);
  }
  if (a.hood) {
    ctx.fillStyle = a.c2;
    ctx.beginPath(); ctx.ellipse(14, -78, 26, 18, -0.2, 0, TAU); ctx.fill();
  }
  circle(ctx, 14, -88, 18, a.c1);
  if (a.horn) for (const s of [-1, 1]) poly(ctx, [14 + s * 8 - 4, -100, 14 + s * 8, -116, 14 + s * 8 + 5, -100], a.c3);
  if (a.crown) for (let i = -1; i <= 1; i++) poly(ctx, [14+i*9-4,-102, 14+i*9,-114, 14+i*9+4,-102], '#ffe066');
  eyeDot(ctx, 8, -90, 4); eyeDot(ctx, 20, -90, 4);
  ctx.strokeStyle = '#e85a7a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(28, -82); ctx.lineTo(40, -84); ctx.lineTo(32, -78); ctx.stroke();
  ctx.restore();
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


/* ============================================================
   しんかごの スプライト (data.js の SPECIES の from つき エントリから 生成)
   もとの かたち・いろを いかしつつ、こうたい・もよう・
   アクセサリー・オーラ で ひと目で 見わけられる ようにする。
   ============================================================ */
function _shadeHex(hex, amt) {
  if (typeof hex !== 'string' || hex[0] !== '#' || hex.length < 7) return hex;
  const n = parseInt(hex.slice(1, 7), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function deriveEvolutionArt() {
  const accs = ['crown', 'gem', 'scarf', 'goggles', 'bandana', 'halo', 'earring'];
  const pats = ['stripe', 'spots', 'diamond', 'zigzag', 'patch'];
  let i = 0;
  const additions = (typeof DEX_ORDER !== 'undefined' && typeof SPECIES !== 'undefined')
    ? DEX_ORDER.map(id => SPECIES[id]).filter(s => s && s.from)
    : [];
  for (const add of additions) {
    if (ART[add.id]) continue;
    const base = ART[add.from] || ART.koratta;
    const a = Object.assign({}, base);
    if (add.evoStage === 3) {
      a.c1 = _shadeHex(a.c1, -20);
      a.c2 = _shadeHex(a.c2, -26);
      a.c3 = _shadeHex(a.c3, 18);
      a.big = true;
      a.aura = true;
      a.eyes = 'sharp';
      a.acc = 'crown';
      a.pattern = 'diamond';
      a.tall = (a.tall || 1) * 1.04;
    } else {
      a.c1 = _shadeHex(a.c1, 14);
      a.c2 = _shadeHex(a.c2, 8);
      a.c3 = _shadeHex(a.c3, 12);
      a.eyes = i % 3 === 0 ? 'sparkle' : i % 3 === 1 ? 'sharp' : 'ring';
      a.acc = accs[i % accs.length];
      a.pattern = pats[i % pats.length];
      if (i % 7 === 0) a.big = true;
      a.tall = (a.tall || 1) * 1.02;
    }
    ART[add.id] = a;
    i++;
  }
}
deriveEvolutionArt();
