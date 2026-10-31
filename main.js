// ⚠ FICHIER ASSEMBLÉ AUTOMATIQUEMENT : ne pas modifier main.js. Modifier les morceaux de src/, puis lancer : python outils/assembler.py (voir MIGRATION.md)
// numéro de version affiché : 167 → « 1.67 » (le numéro interne reste le numéro de construction)
function verName(n) { n = +n; return n > 0 ? (n / 100).toFixed(2) : String(n); }
(() => {
'use strict';
// Moteur 3D r160 : on garde le rendu d'origine (r149), c'est-à-dire les couleurs telles quelles,
// la sortie d'image sans conversion et l'ancienne échelle de lumière. Sans effet sur r149.
if (THREE.ColorManagement) THREE.ColorManagement.enabled = false;
const oldLook = (r, srgb) => {
  if ('outputColorSpace' in r) r.outputColorSpace = srgb ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
  else r.outputEncoding = srgb ? THREE.sRGBEncoding : THREE.LinearEncoding;
  if ('useLegacyLights' in r) r.useLegacyLights = true;
  return r;
};
// .boneTransform() s'appelle .applyBoneTransform() depuis r151
if (!THREE.SkinnedMesh.prototype.applyBoneTransform) THREE.SkinnedMesh.prototype.applyBoneTransform = THREE.SkinnedMesh.prototype.boneTransform;
const $ = id => document.getElementById(id);
const cv = $('game'), ctx = cv.getContext('2d');
const WORLD = 2400, TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const d2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

// ---------- Sauvegarde (dans ce navigateur) ----------
// 3 emplacements de personnage, chacun avec sa propre progression (le 1er garde l'ancienne sauvegarde)
const SLOT_KEY = 'dernier-bastion-slot';
const slotKey = n => n === 1 ? 'dernier-bastion-v1' : 'dernier-bastion-v1-s' + n;
let SLOT = 1;
try { const n = +localStorage.getItem(SLOT_KEY); if (n === 2 || n === 3) SLOT = n; } catch (e) {}
let SAVE_KEY = slotKey(SLOT);
const defaultB = () => ({ hdv: 1, portail: 1, mine: 1, armurerie: 1, infirmerie: 1, forge: 1, labo: 1, caserne: 1, garde: 1, maison: 1 });
const defaultSave = () => ({ appearance: CharacterModels.clean(), coins: 150, gems: 10, testMode: false, diff: 'normal', bzoom: 0.8, camMode: 'tp', best: 0, cls: 'soldat', sound: true, music: true, skin: 'perso', skins: { recrue: true }, colors: { skin: '#f2c29b', hair: '#5a3a26', outfit: '#ff8a1f', accent: '#3a3550', eyes: '#2a1830' }, cosm: { hat: null, cape: null, boots: null }, cosmOwned: {}, speed2: false, npcTalk: true, tutorialDone: false, home: {}, homeOwned: {}, night: false, daily: { last: '', streak: 0 }, wskin: 'dragon', wskins: { standard: true, dragon: true }, weapon: 'standard', weapons: { standard: true }, items: {}, gear: { hat: null, cape: null, boots: null }, pets: {}, pet: null, dragonCol: 'rose', history: [], totalKills: 0,
  b: defaultB(), build: null, mineLast: Date.now() });
function readSave(key) {
  let save = defaultSave();
  try {
  const raw = localStorage.getItem(key);
  if (raw) {
    const s = JSON.parse(raw);
    save = Object.assign(defaultSave(), s);
    save.appearance=CharacterModels.clean(s.appearance);
    save.b = Object.assign(defaultB(), s.b || {});
    // Ancienne version (Atelier + classes achetées) : on rembourse l'Atelier et on garde les classes via la Caserne
    if (s.meta) {
      for (const k in s.meta) for (let i = 0; i < s.meta[k]; i++) save.coins += 80 + i * 90;
      delete save.meta;
    }
    if (s.unlocked) {
      if (s.unlocked.medecin) save.b.caserne = Math.max(save.b.caserne, 3);
      else if (s.unlocked.ingenieur) save.b.caserne = Math.max(save.b.caserne, 2);
      save.b.hdv = Math.max(save.b.hdv, save.b.caserne - 1);
      delete save.unlocked;
    }
    save.skins = Object.assign({ recrue: true }, s.skins || {});
    save.wskins = Object.assign({ standard: true, dragon: true }, s.wskins || {});
    save.weapons = Object.assign({ standard: true }, s.weapons || {});
    // l'Œil de faucon a été retiré du jeu : celui qui l'avait équipé reprend l'arme brute
    delete save.weapons.sniper; if (save.weapon === 'sniper') save.weapon = 'standard';
    save.items = Object.assign({}, s.items || {});
    save.pets = Object.assign({}, s.pets || {});
    save.petLv = Object.assign({}, s.petLv || {});
    save.mounts = Object.assign({}, s.mounts || {});
    save.gear = Object.assign({ hat: null, cape: null, boots: null }, s.gear || {});
    // Objivants et couleurs du personnage (les anciennes tenues sont remplacées par le choix des couleurs)
    save.cosm = Object.assign({ hat: null, cape: null, boots: null }, s.cosm || {});
    save.cosmOwned = Object.assign({}, s.cosmOwned || {});
    save.home = Object.assign({}, s.home || {}); save.homeOwned = Object.assign({}, s.homeOwned || {});
    save.colors = Object.assign(defaultSave().colors, s.colors || {});
    // Les guerriers Viking, Spartiate et Pharaon ont été remplacés par les aventuriers : on donne le plus proche
    const OLD_HERO = { viking: 'barbarian', spartiate: 'knight', pharaon: 'mage' };
    if (OLD_HERO[save.tribe]) { save.oldTribe = save.tribe; save.tribe = OLD_HERO[save.tribe]; save.heroChanged = true; }
    save.skin = 'perso';
    if (save.bzoom > 0.9) save.bzoom = 0.8;
    if (!Array.isArray(save.history)) save.history = [];
  }
  } catch (e) {}
  return save;
}
let save = readSave(SAVE_KEY);
let visitingVillage=null;
// Mode test : pièces et gemmes illimitées (on remplit le porte-monnaie à chaque sauvegarde)
const TEST_COINS = 999999, TEST_GEMS = 99999;
let testUnlocked = false;
function topUp() { if (save.testMode && !testUnlocked) { save.testMode=false; save.coins=Math.min(save.coins,500); save.gems=Math.min(save.gems,10); } if (save.testMode) { save.coins = TEST_COINS; save.gems = TEST_GEMS; } }
function persist() { topUp(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
topUp();
const fmtCoins = () => save.testMode ? '\u221e' : String(save.coins);
const fmtGems = () => save.testMode ? '\u221e' : String(save.gems);

// ---------- Données ----------
const CLASSES = {
  soldat:    { name: 'Soldat',    color: '#ff8a1f', req: 1, hp: 100, speed: 150, dmg: 10, rate: 5.5, range: 360, ultCd: 18, regen: 0,
               ult: 'Barrage', desc: 'Fusil rapide. Ultime : une rafale de balles dans toutes les directions et 4 s de tir doublé.' },
  ingenieur: { name: 'Ingénieur', color: '#3db8ff', req: 2, hp: 90,  speed: 150, dmg: 9,  rate: 4.6, range: 360, ultCd: 20, regen: 0,
               ult: 'Tourelle', desc: 'Commence avec un drone. Ultime : pose une tourelle qui arrose les monstres pendant 15 s.' },
  medecin:   { name: 'Médecin',   color: '#3df5b0', req: 3, hp: 130, speed: 145, dmg: 9,  rate: 4.8, range: 340, ultCd: 16, regen: 1,
               ult: 'Onde de soin', desc: 'Plus de PV et régénération. Ultime : soigne 40 % et repousse tous les monstres autour.' },
  necro:     { name: 'Nécromancien', color: '#9b5cff', req: 4, hp: 95, speed: 145, dmg: 13, rate: 3.6, range: 380, ultCd: 22, regen: 0,
               ult: 'Armée des morts', desc: 'Tirs violets lents mais puissants. Ultime : relève 3 squelettes qui se battent pour toi pendant 12 s.' },
};
// Skins : tenue (null = couleur de la classe), accessoire, peau, coiffe
const SKINS = {
  perso:   { name: 'Mon héros', price: 0, outfit: '#ff8a1f', accent: '#3a3550', skin: '#f2c29b', head: 'hair', headCol: '#5a3a26' },
  recrue:  { name: 'Recrue',  price: 0,    outfit: null,      accent: '#3a3550', skin: '#f2c29b', head: 'cap',     headCol: '#2b2b3a' },
  neon:    { name: 'Néon',    price: 150,  outfit: '#ff4fa3', accent: '#3df5b0', skin: '#c98a5e', head: 'mohawk',  headCol: '#3df5b0' },
  ombre:   { name: 'Ombre',   price: 250,  outfit: '#2b2350', accent: '#ff3a5c', skin: '#f2c29b', head: 'hood',    headCol: '#1d1238' },
  cyber:   { name: 'Cyber',   price: 400,  outfit: '#e8ecff', accent: '#3db8ff', skin: '#f2c29b', head: 'helmet',  headCol: '#ffffff', visor: '#3db8ff' },
  dino:    { name: 'Dino',    price: 600,  outfit: '#7ddc4a', accent: '#ffd23f', skin: '#7ddc4a', head: 'dino',    headCol: '#7ddc4a' },
  legende: { name: 'Légende', price: 1200, outfit: '#ffd23f', accent: '#ff8a1f', skin: '#f2c29b', head: 'helmet',  headCol: '#ffd23f', visor: '#1d1238', crown: true },
  turquoise: { name: 'Vagabond',        price: 200, outfit: '#418e8a', accent: '#836337', skin: '#eac783', head: 'iop',    headCol: '#f3e49b' },
  foret:     { name: 'Rôdeur des bois', price: 200, outfit: '#56593a', accent: '#6c6849', skin: '#efd49f', head: 'iop',    headCol: '#5e4726' },
  braise:    { name: 'Braise',          price: 250, outfit: '#952e1a', accent: '#ea6a58', skin: '#eac783', head: 'iop',    headCol: '#604d34' },
  tribal:    { name: 'Tribal',          price: 250, outfit: '#9c9f47', accent: '#d68996', skin: '#eac783', head: 'iop',    headCol: '#faf0d4' },
  heros:     { name: 'Héros éclatant',  price: 300, outfit: '#009fff', accent: '#ffd500', skin: '#eac783', head: 'iop',    headCol: '#f4c431' },
  samourai:  { name: 'Samouraï',        price: 350, outfit: '#8e2121', accent: '#eae1a2', skin: '#eac783', head: 'kasa',   headCol: '#8e2121' },
  os:        { name: 'Masque d\u2019os', price: 400, outfit: '#ece6d0', accent: '#bc5e51', skin: '#eac783', head: 'skull',  headCol: '#ddd2af' },
  paladin:   { name: 'Paladin solaire', price: 450, outfit: '#ffffff', accent: '#fdcc38', skin: '#eac783', head: 'winged', headCol: '#ffffff' },
};
// ---------- Skins d'armes ----------
const WSKINS = {
  dragon:    { name: 'Dragon ancestral', price: 900, rar: 'légendaire', body: '#4a3434', dark: '#2a1c1c', accent: '#c98a3d', glow: '#ff7a1f', bullet: 'fire', dragon: true },
  standard:  { name: 'Standard',         price: 0,   rar: 'commun',     body: '#3a3550', dark: '#26223a', accent: null,      glow: '#ffd23f', bullet: null },
  bois:      { name: 'Bois ancien',      price: 150, rar: 'commun',     body: '#8a5634', dark: '#5a3a24', accent: '#d9a05a', glow: '#ffcf7a', bullet: '#ffcf7a' },
  arcenciel: { name: 'Arc-en-ciel',      price: 250, rar: 'rare',       body: '#f4f4ff', dark: '#c8cfe6', accent: '#ff4fa3', glow: '#ffd23f', bullet: 'rainbow', rainbow: true },
  neon:      { name: 'Néon toxique',     price: 300, rar: 'rare',       body: '#2b2b3a', dark: '#1a1a26', accent: '#9dff3d', glow: '#9dff3d', bullet: '#9dff3d' },
  ion:       { name: 'Ion',              price: 350, rar: 'rare',       body: '#eef2ff', dark: '#b9c2dd', accent: '#3de0ff', glow: '#3de0ff', bullet: '#3de0ff' },
  spectre:   { name: 'Spectre',          price: 450, rar: 'épique',     body: '#2a2340', dark: '#171228', accent: '#b46bff', glow: '#d29bff', bullet: '#c98aff' },
  souverain: { name: 'Souverain',        price: 550, rar: 'épique',     body: '#fffaf0', dark: '#ddd2b8', accent: '#ffc83d', glow: '#ffd23f', bullet: '#ffd23f' },
};
const wskin = () => WSKINS[(previewBuild && PREVIEW) ? PREVIEW.wskin : save.wskin] || WSKINS.standard;
// Armes : chacune tire à sa façon (les skins, eux, ne changent que l'apparence)
const WEAPONS = {
  standard: { name: 'Arme brute',       price: 0,    rar: 'commun',     desc: 'Ton arme de départ, équilibrée.', mod: {} },
  revolver: { name: 'Rugissant',        price: 400,  rar: 'rare',       desc: 'Revolver : gros dégâts, mais il tire moins vite.', mod: { dmg: 1.6, rate: 0.62 }, model: 'gun_revolver', len: 0.85 },
  assaut:   { name: 'Tempête de plomb', price: 700,  rar: 'épique',     desc: 'Fusil d’assaut : il tire très vite, chaque balle fait moins mal.', mod: { dmg: 0.78, rate: 1.5 }, model: 'gun_assault', len: 1.3 },
};
const weaponId = () => { const id = (previewBuild && PREVIEW && PREVIEW.weapon) || save.weapon; return WEAPONS[id] ? id : 'standard'; };
const weaponLines = W => { const m = W.mod, L = [], f = (k, n) => { if (m[k]) L.push(n + ' ×' + String(m[k]).replace('.', ',')); }; f('dmg', 'Dégâts'); f('rate', 'Cadence'); f('range', 'Portée'); if (m.pierce) L.push('+' + m.pierce + ' monstres traversés'); return L.length ? L : ['Équilibrée']; };
// Copie d'un modèle fixe (chapeau, arme) posée dans un cadre : centrée, à la taille voulue
function fitModel(id, size, axis) {
  const M = MODELS[id]; if (!M) return null;
  const T = THREE, root = M.scene.clone(true), g = new T.Group(), inner = new T.Group(); inner.add(root); g.add(inner);
  root.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(root), sz = box.getSize(new T.Vector3()), c = box.getCenter(new T.Vector3());
  const k = size / Math.max(0.001, axis === 'w' ? Math.max(sz.x, sz.z) : Math.max(sz.x, sz.y, sz.z));
  inner.scale.setScalar(k); inner.position.set(-c.x * k, -box.min.y * k, -c.z * k);
  g.userData.size = sz.clone().multiplyScalar(k); g.userData.long = sz.x >= sz.z ? 'x' : 'z';
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.noOutline = false; } });
  return g;
}
function modelHat(hat) {
  const g = fitModel(hat.model, hat.fit.w, 'w'); if (!g) return null;
  g.position.y = hat.fit.y; g.rotation.y = hat.fit.ry || 0; g.rotation.x = hat.fit.rx || 0;
  if (!hat.fit.under) return g;
  // calotte de tissu sous le chapeau : elle cache le crâne quand le chapeau est étroit
  const T = THREE, h = new T.Group(); h.add(g);
  mk(new T.SphereGeometry(0.38, 18, 8, 0, TAU, 0, Math.PI * 0.5), hat.fit.under, 0, 0.02, -0.01, h);
  return h;
}
// Arme en 3D : le canon vers l'avant (+z), teintée aux couleurs du skin choisi
const GUN_TINT = { Wood: 'accent', DarkWood: 'accent', Green: 'accent', Main: 'accent', Metal: 'body', LightMetal: 'body', Grey: 'body', MainLight: 'body', DarkMetal: 'dark', Black: 'dark', Black2: 'dark', MainDark: 'dark', Glass: 'glow' };
function weaponMesh(wid, skinId) {
  const W = WEAPONS[wid], g = fitModel(W.model, W.len, 'all'); if (!g) return null;
  const T = THREE, holder = new T.Group(); holder.add(g);
  g.position.y = -g.userData.size.y * 0.55;
  if (g.userData.long === 'x') g.rotation.y = W.turn === undefined ? -Math.PI / 2 : W.turn; else if (W.turn) g.rotation.y = W.turn;
  const sid = skinId || wskinId(), k = WSKINS[sid] || WSKINS.standard;
  if (sid !== 'standard') g.traverse(o => {
    if (!o.isMesh) return;
    const tint = m => { const role = GUN_TINT[m.name]; if (!role) return m; const n = m.clone(); const col = role === 'accent' ? (k.accent || k.body) : k[role]; if (col) n.color.set(k.rainbow && role === 'body' ? '#ff8fd0' : col); if (role === 'glow') n.emissive = new T.Color(k.glow); else if (role === 'accent') n.emissive = new T.Color(k.glow).multiplyScalar(0.3); return n; };
    o.material = Array.isArray(o.material) ? o.material.map(tint) : tint(o.material);
  });
  // Skin peint (dragon, arc-en-ciel, néon…) : le dessin de l'arme de base est projeté sur le côté de cette arme
  const art = sid !== 'standard' && artOk('g_' + sid) ? skinArtTex(sid, k) : null;
  if (art) {
    holder.updateMatrixWorld(true);
    const inv = new T.Matrix4().copy(holder.matrixWorld).invert(), v = new T.Vector3(), box = new T.Box3(), meshes = [];
    g.traverse(o => { if (o.isMesh) meshes.push([o, new T.Matrix4().multiplyMatrices(inv, o.matrixWorld)]); });
    for (const [o, M] of meshes) { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(M)); }
    const sz = box.getSize(new T.Vector3());
    for (const [o, M] of meshes) {
      const geo = o.geometry.clone(), p = geo.attributes.position, uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(M); uv[i * 2] = (v.z - box.min.z) / (sz.z || 1); uv[i * 2 + 1] = (v.y - box.min.y) / (sz.y || 1); }
      geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); o.geometry = geo;
      const paint = m => { if (GUN_TINT[m.name] === 'glow') return m; const n = m.clone(); n.color.set('#ffffff'); n.map = art; n.emissive = new T.Color('#000000'); return n; };
      o.material = Array.isArray(o.material) ? o.material.map(paint) : paint(o.material);
    }
  }
  return holder;
}
// Dessin d'un skin d'arme, sans zones vides : les couleurs du bord débordent autour du dessin
const skinArtCache = {};
function skinArtTex(sid, k) {
  if (skinArtCache[sid]) return skinArtCache[sid];
  const im = artImg('g_' + sid); if (!im || !im.complete || !im.naturalWidth) return null;
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  // le liseré clair et semi-transparent du dessin est retiré, puis le vide prend la couleur principale du skin
  try {
    const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
    for (let i = 3; i < a.length; i += 4) if (a[i] < 235 || (a[i - 3] > 225 && a[i - 2] > 225 && a[i - 1] > 225 && !k.rainbow && sid !== 'souverain' && sid !== 'ion')) a[i] = 0;
    g.putImageData(d, 0, 0);
  } catch (e) {}
  g.globalCompositeOperation = 'destination-over'; g.fillStyle = sid === 'souverain' ? '#e9c46f' : k.body; g.fillRect(0, 0, c.width, c.height); g.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
  return (skinArtCache[sid] = t);
}
// Petite photo 3D d'un objet pour la garde-robe
const objSnaps = {};
function snapObj(cnv, key, build, camY) {
  initPreview(); if (!PV.r) return false;
  let img = objSnaps[key + cnv.width];
  if (!img) {
    const T = THREE, o = build(); if (!o) return false;
    const scene = new T.Scene(); scene.add(new T.HemisphereLight('#fffaf0', '#6d5a8a', 0.95)); const dl = new T.DirectionalLight('#fff0d0', 0.8); dl.position.set(3, 5, 6); scene.add(dl);
    const piv = new T.Group(); piv.add(o); piv.rotation.y = 0.6; scene.add(piv); piv.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(piv), c = box.getCenter(new T.Vector3()), R = box.getSize(new T.Vector3()).length() * 0.62;
    const cam = new T.PerspectiveCamera(30, cnv.width / cnv.height, 0.01, 50); cam.position.set(c.x, c.y + R * (camY || 0.7), c.z + R * 2.2); cam.lookAt(c);
    const pr = PV.r.getPixelRatio(), prev = PV.r.getSize(new T.Vector2());
    PV.r.setPixelRatio(1); PV.r.setSize(cnv.width, cnv.height, false); PV.r.setClearColor(0, 0); PV.r.render(scene, cam);
    img = objSnaps[key + cnv.width] = document.createElement('canvas'); img.width = cnv.width; img.height = cnv.height; img.getContext('2d').drawImage(PV.r.domElement, 0, 0);
    PV.r.setPixelRatio(pr); PV.r.setSize(prev.x || 1, prev.y || 1, false);
  }
  const g = cnv.getContext('2d'); g.clearRect(0, 0, cnv.width, cnv.height); g.drawImage(img, 0, 0); return true;
}
function bulletLook() {
  const k = wskin();
  if (k.bullet === 'rainbow') return { col: `hsl(${Math.floor(Math.random() * 360)},95%,62%)` };
  if (k.bullet === 'fire') return { col: '#ff7a1f', fire: true };
  return k.bullet ? { col: k.bullet } : null;
}

// Vue de dessus (Bastion) : repère du héros, +x = devant
function drawGunTop(g, outfitAcc) {
  const k = wskin(), body = k.body, acc = k.accent || outfitAcc;
  g.strokeStyle = INK; g.lineWidth = 3;
  if (k.rainbow) { const gr = g.createLinearGradient(6, 0, 42, 0); ['#ff4f6d', '#ffd23f', '#3df5b0', '#3db8ff', '#b46bff'].forEach((c, i) => gr.addColorStop(i / 4, c)); g.fillStyle = gr; }
  else g.fillStyle = body;
  rrect(g, 6, 2, k.dragon ? 28 : 36, 9, 3); g.fill(); g.stroke();
  g.fillStyle = acc; g.fillRect(15, 3.5, 11, 6);
  g.fillStyle = k.glow; g.fillRect(8, 5.5, 20, 1.6);
  g.fillStyle = k.dark; rrect(g, 13, 9, 6, 8, 2); g.fill(); g.lineWidth = 2; g.stroke();
  if (k.dragon) {
    // Tête de dragon au bout du canon : museau, cornes, yeux qui brillent
    g.fillStyle = k.accent; g.lineWidth = 2;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(36, 6.5 + s * 4); g.lineTo(26, 6.5 + s * 11); g.lineTo(33, 6.5 + s * 3); g.closePath(); g.fill(); g.stroke(); }
    g.fillStyle = body; g.lineWidth = 3;
    g.beginPath(); g.moveTo(32, 0); g.lineTo(44, 1.5); g.lineTo(52, 4.5); g.lineTo(52, 8.5); g.lineTo(44, 11.5); g.lineTo(32, 13); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#fff3dc'; for (const tx of [44, 48]) { g.beginPath(); g.moveTo(tx, 4.5); g.lineTo(tx + 2, 6.5); g.lineTo(tx, 8.5); g.fill(); }
    g.fillStyle = k.glow; g.shadowColor = k.glow; g.shadowBlur = 6;
    g.beginPath(); g.arc(39, 3.2, 1.6, 0, TAU); g.arc(39, 9.8, 1.6, 0, TAU); g.fill(); g.shadowBlur = 0;
  }
}

// Vue de côté pour les vignettes de la Garde-robe (canevas 240 x 110)
function drawGunSide(g, id) {
  const k = WSKINS[id], body = k.body, dark = k.dark, acc = k.accent || '#ff8a1f';
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = 3;
  const fillBody = () => {
    if (!k.rainbow) return body;
    const gr = g.createLinearGradient(10, 0, 230, 40);
    ['#ff4f6d', '#ff8a1f', '#ffd23f', '#3df5b0', '#3db8ff', '#b46bff', '#ff4fa3'].forEach((c, i) => gr.addColorStop(i / 6, c));
    return gr;
  };
  const poly = (pts, fill) => { g.fillStyle = fill; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); g.stroke(); };
  // Crosse
  if (k.dragon) {
    poly([[62, 40], [14, 30], [24, 46], [10, 62], [34, 58], [26, 74], [62, 56]], dark);
    g.strokeStyle = k.accent; g.lineWidth = 2; for (const [x1, y1, x2, y2] of [[56, 44, 22, 34], [56, 50, 18, 60], [56, 54, 30, 70]]) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
    g.strokeStyle = INK; g.lineWidth = 3;
  } else poly([[62, 40], [16, 38], [12, 64], [26, 66], [34, 54], [62, 54]], dark);
  // Poignée et chargeur
  poly([[92, 54], [104, 54], [98, 82], [84, 82]], dark);
  poly([[118, 54], [140, 54], [146, 84], [128, 88]], k.dragon ? '#3a2828' : dark);
  // Corps
  g.fillStyle = fillBody(); rrect(g, 56, 34, 100, 22, 6); g.fill(); g.stroke();
  // Dessus : lunette et rail
  g.fillStyle = dark; rrect(g, 80, 26, 44, 9, 3); g.fill(); g.stroke();
  // Bandes et lueur
  g.fillStyle = acc; g.fillRect(66, 38, 28, 6);
  g.fillStyle = k.glow; g.shadowColor = k.glow; g.shadowBlur = 10; g.fillRect(100, 44, 46, 3); g.shadowBlur = 0;
  if (k.dragon) {
    // Écailles sur le corps
    g.strokeStyle = 'rgba(201,138,61,.7)'; g.lineWidth = 1.5;
    for (let x = 64; x < 150; x += 10) for (let y = 38; y < 54; y += 7) { g.beginPath(); g.arc(x + (y % 14 ? 5 : 0), y, 4, 0, Math.PI); g.stroke(); }
    // Piques sur le dos
    g.strokeStyle = INK; g.lineWidth = 2.5;
    for (let x = 64; x < 150; x += 14) poly([[x, 34], [x + 5, 22], [x + 9, 34]], k.accent);
    // Tête de dragon (gueule ouverte)
    g.lineWidth = 3;
    poly([[150, 30], [176, 26], [206, 30], [232, 40], [226, 46], [200, 44], [170, 48], [150, 52]], body);
    poly([[160, 52], [190, 54], [222, 56], [218, 62], [190, 64], [160, 62]], dark);
    g.fillStyle = '#ff7a1f'; g.shadowColor = '#ff7a1f'; g.shadowBlur = 14; g.beginPath(); g.moveTo(200, 46); g.lineTo(228, 47); g.lineTo(220, 55); g.lineTo(196, 53); g.closePath(); g.fill(); g.shadowBlur = 0;
    g.fillStyle = '#fff3dc'; g.lineWidth = 1.5;
    for (let x = 202; x < 226; x += 6) { g.beginPath(); g.moveTo(x, 45); g.lineTo(x + 3, 51); g.lineTo(x + 6, 45); g.fill(); g.stroke(); }
    for (let x = 196; x < 218; x += 6) { g.beginPath(); g.moveTo(x, 56); g.lineTo(x + 3, 51); g.lineTo(x + 6, 56); g.fill(); g.stroke(); }
    g.lineWidth = 3; poly([[172, 28], [152, 8], [182, 26]], k.accent); poly([[186, 27], [174, 4], [194, 28]], k.accent);
    g.fillStyle = '#ffd23f'; g.shadowColor = '#ff7a1f'; g.shadowBlur = 12; g.beginPath(); g.ellipse(194, 35, 6, 3.5, -0.2, 0, TAU); g.fill(); g.shadowBlur = 0;
    g.fillStyle = INK; g.fillRect(193, 32, 2, 6);
    g.fillStyle = INK; g.beginPath(); g.arc(224, 38, 1.8, 0, TAU); g.fill();
  } else {
    poly([[156, 38], [196, 38], [196, 52], [156, 52]], k.rainbow ? fillBody() : dark);
    g.fillStyle = dark; rrect(g, 196, 41, 34, 7, 2); g.fill(); g.stroke();
    if (id === 'souverain') { g.strokeStyle = '#ffc83d'; g.lineWidth = 3; g.beginPath(); g.moveTo(60, 34); g.quadraticCurveTo(110, 20, 156, 34); g.stroke(); g.beginPath(); g.arc(150, 45, 5, 0, TAU); g.stroke(); }
    if (id === 'spectre') { g.strokeStyle = '#b46bff'; g.lineWidth = 2; g.shadowColor = '#b46bff'; g.shadowBlur = 8; g.beginPath(); g.moveTo(60, 52); g.lineTo(90, 44); g.lineTo(120, 52); g.lineTo(150, 40); g.stroke(); g.shadowBlur = 0; }
    if (id === 'ion') { g.fillStyle = '#3de0ff'; g.beginPath(); g.arc(140, 45, 4, 0, TAU); g.fill(); }
    if (id === 'neon') { g.fillStyle = '#9dff3d'; poly([[156, 38], [176, 38], [168, 52], [156, 52]], '#9dff3d'); }
    if (id === 'bois') { g.strokeStyle = 'rgba(29,18,56,.35)'; g.lineWidth = 1.5; for (let x = 62; x < 150; x += 12) { g.beginPath(); g.moveTo(x, 36); g.quadraticCurveTo(x + 6, 45, x + 2, 54); g.stroke(); } }
  }
  g.restore();
}
function paintGun(cnv, id) {
  if (ART_SRC['g_' + id] && paintArt(cnv, 'g_' + id)) return;
  const g = cnv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cnv.width, cnv.height);
  g.setTransform(cnv.width / 240, 0, 0, cnv.height / 110, 0, 0);
  drawGunSide(g, id);
}

// Arme en 3D (village) : attachée aux mains du héros
function buildGun3D(gun, outfitAcc) {
  const wid = weaponId(); if (wid !== 'standard') { const m = weaponMesh(wid); if (m) { gun.add(m); return; } }
  const gid = wskinId(); if (GUN3D[gid] && artOk('g_' + gid)) { gun.add(artGunMesh(gid)); return; }
  const T = THREE, k = wskin(), acc = k.accent || outfitAcc;
  const bodyCol = k.rainbow ? '#ff8fd0' : k.body;
  mk(BX(0.16, 0.2, k.dragon ? 0.8 : 1.0), bodyCol, 0, 0, k.dragon ? -0.1 : 0, gun);
  mk(BX(0.17, 0.12, 0.32), acc, 0, 0.05, 0.05, gun);
  mk(BX(0.1, 0.24, 0.12), k.dark, 0, -0.18, -0.16, gun);
  mk(BX(0.04, 0.03, 0.5), k.glow, 0.085, 0, -0.05, gun, { emissive: k.glow });
  if (k.rainbow) { mk(BX(0.165, 0.06, 0.25), '#3db8ff', 0, -0.07, 0.3, gun); mk(BX(0.165, 0.06, 0.25), '#ffd23f', 0, -0.07, -0.3, gun); }
  if (k.dragon) {
    const h = new T.Group(); h.position.set(0, 0.02, 0.38); gun.add(h);
    mk(BX(0.2, 0.14, 0.34), k.body, 0, 0.04, 0.12, h);
    const jaw = mk(BX(0.17, 0.06, 0.3), k.dark, 0, -0.07, 0.12, h); jaw.rotation.x = 0.25;
    mk(BX(0.12, 0.04, 0.12), '#ff7a1f', 0, -0.02, 0.24, h, { emissive: '#ff5a00' });
    for (const s of [-1, 1]) {
      const horn = mk(new T.ConeGeometry(0.035, 0.22, 6), k.accent, s * 0.07, 0.14, -0.06, h); horn.rotation.x = -2.2;
      mk(new T.SphereGeometry(0.025, 6, 5), '#ffd23f', s * 0.08, 0.08, 0.14, h, { emissive: '#ff8a00' });
      for (const tz of [0.2, 0.27]) { const t = mk(new T.ConeGeometry(0.015, 0.05, 4), '#fff3dc', s * 0.05, -0.01, tz, h); t.rotation.x = Math.PI; }
    }
    for (let i = 0; i < 4; i++) { const sp = mk(new T.ConeGeometry(0.03, 0.09, 4), k.accent, 0, 0.14, -0.4 + i * 0.16, gun); sp.rotation.x = -0.4; }
  }
}

// ---------- Équipements (Garde-robe) ----------
// Logique des bonus : la tête = précision et sagesse, la cape = protection, les bottes = déplacement.
const ITEMS = {
  bonnet:  { slot: 'hat',   name: 'Bonnet laineux',        price: 120,  rar: 'commun',     look: 'wool',   stats: { xp: 0.05, crit: 0.03 } },
  aventu:  { slot: 'hat',   name: 'Chapeau d’aventurier', price: 260,  rar: 'rare',       look: 'brim',   stats: { xp: 0.1, crit: 0.05 } },
  craq:    { slot: 'hat',   name: 'Casque de roche',     price: 420,  rar: 'épique',     look: 'rock',   kay: ['h_knight', 'Knight_Helmet', '#a08a72'],   stats: { crit: 0.08, res: 0.05 } },
  capeB:   { slot: 'cape',  name: 'Cape de laine',          price: 120,  rar: 'commun',     col: '#fffbe8', trim: '#3b5ea8', stats: { hp: 15 } },
  capeA:   { slot: 'cape',  name: 'Cape d’aventurier',   price: 260,  rar: 'rare',       col: '#3d8bd9', trim: '#ffd23f', stats: { hp: 25, res: 0.05 } },
  capeT:   { slot: 'cape',  name: 'Cape du Soleil',       price: 420,  rar: 'épique',     col: '#ffd23f', trim: '#ff8a1f', stats: { hp: 20, res: 0.08, speed: 0.04 } },
  bottesL: { slot: 'boots', name: 'Bottes en laine',          price: 100,  rar: 'commun',     col: '#e8dcc0', trim: '#6a4a33', stats: { speed: 0.05 } },
  bottesT: { slot: 'boots', name: 'Bottes plume',           price: 240,  rar: 'rare',       col: '#ffd23f', trim: '#ff8a1f', stats: { speed: 0.1 } },
  bottesS: { slot: 'boots', name: 'Bottes de sept lieues',    price: 400,  rar: 'épique',     col: '#5a3a8a', trim: '#c98aff', stats: { speed: 0.12, dash: 0.2 } },
  // chapeaux en 3D (modèles) : w = largeur sur la tête, y = hauteur du bas du chapeau, ry = rotation pour qu'il regarde devant
  casquette: { slot: 'hat', name: 'Casquette du Vagabond',    price: 150,  rar: 'commun',     model: 'hat_cap',      fit: { w: 0.92, y: 0.08, ry: -Math.PI / 2, under: '#1f1f26' },   stats: { speed: 0.04, xp: 0.04 } },
  goupil:    { slot: 'hat', name: 'Bonnet Goupil',            price: 280,  rar: 'rare',       model: 'hat_fox',      fit: { w: 0.9, y: -0.58, ry: 0 },  stats: { hp: 15, speed: 0.05 } },
  pistolero: { slot: 'hat', name: 'Chapeau du Pistolero',     price: 320,  rar: 'rare',       model: 'hat_cowboy',   fit: { w: 1.5, y: 0.02, ry: 0 },    stats: { crit: 0.06, dmg: 0.05 } },
  lunaire:   { slot: 'hat', name: 'Chapeau de la Sorcière lunaire', price: 480, rar: 'épique', model: 'hat_witch', fit: { w: 1.55, y: 0.02, ry: Math.PI, under: '#34303f' },    stats: { xp: 0.15, crit: 0.06 } },
  soleil:    { slot: 'hat', name: 'Sombrero du Soleil',       price: 450,  rar: 'épique',     model: 'hat_sombrero', fit: { w: 1.6, y: -0.04, ry: 0 },    stats: { hp: 25, res: 0.06 } },
  // couvre-chefs des aventuriers KayKit : vraies pièces 3D accrochées à la tête (kay : [modèle, pièce, teinte])
  kHelm:   { slot: 'hat', name: 'Heaume du Chevalier',     price: 320, rar: 'rare',   kay: ['h_knight', 'Knight_Helmet'],     stats: { res: 0.06, crit: 0.04 } },
  kBear:   { slot: 'hat', name: 'Bonnet d’Ours',        price: 300, rar: 'rare',   kay: ['h_barbarian', 'Barbarian_Hat'],  stats: { hp: 20, dmg: 0.04 } },
  kMage:   { slot: 'hat', name: 'Chapeau du Mage',         price: 450, rar: 'épique', kay: ['h_mage', 'Mage_Hat'],            stats: { xp: 0.15, crit: 0.05 } },
  frogH:   { slot: 'hat', name: 'Chapeau Grenouille',      price: 220, rar: 'commun', model: 'hat_frog',    fit: { w: 0.95, y: 0.0, ry: 0 },   stats: { hp: 10, speed: 0.03 } },
  pumpH:   { slot: 'hat', name: 'Tête de Citrouille',      price: 520, rar: 'épique', model: 'hat_pumpkin', fit: { w: 1.05, y: -0.5, ry: 0 },  stats: { hp: 25, crit: 0.05 } },
  // Armure ultime : la panoplie du Dragon ancestral, assortie à l'arme
  dHelm:   { slot: 'hat',   set: 'dragon', name: 'Heaume du Dragon ancestral', price: 1200, rar: 'légendaire', look: 'dragon', kay: ['h_knight', 'Knight_Helmet', '#c9563a'], stats: { crit: 0.15, xp: 0.2, dmg: 0.1 } },
  dCape:   { slot: 'cape',  set: 'dragon', name: 'Cape du Dragon ancestral',   price: 1200, rar: 'légendaire', col: '#8e2121', trim: '#ffc83d', flame: true, stats: { hp: 60, res: 0.15, regen: 1 } },
  dBoots:  { slot: 'boots', set: 'dragon', name: 'Bottes du Dragon ancestral', price: 1200, rar: 'légendaire', col: '#5a1c1c', trim: '#ffc83d', claws: true, stats: { speed: 0.18, dash: 0.35 } },
};
for (const id in ITEMS) ITEMS[id].id = id;
// ---------- Objivants : cosmétiques portés PAR-DESSUS l'équipement (ils changent l'apparence, pas les bonus) ----------
const OW = '#f4efe2', OC = '#e8dcbc', OG = '#8fae2a', OGd = '#5f7a1a', OB = '#8a4a24', OBd = '#5a2e14', OO = '#e8902a', OGo = '#f0b43a', OT = '#2f9a9a', OTd = '#1f6a74';
const COSM = {
  // Chapeaux
  oh1:  { slot: 'hat', name: 'Bandeau Pousse',        price: 150, shape: 'band',  c1: OW, c2: OG },
  oh2:  { slot: 'hat', name: 'Bonnet Bourgeon',       price: 200, shape: 'cap',   c1: OW, c2: OG, curl: 0.6 },
  oh3:  { slot: 'hat', name: 'Toque Feuillue',        price: 250, shape: 'cap',   c1: OW, c2: OG, curl: 1, stripe: OG },
  oh4:  { slot: 'hat', name: 'Chapeau Brindille',     price: 300, shape: 'witch', c1: OB, c2: OW },
  oh5:  { slot: 'hat', name: 'Chapeau Écorce',        price: 350, shape: 'brim',  c1: OB, c2: OW, curl: 0.8 },
  oh6:  { slot: 'hat', name: 'Cornet Lunaire',        price: 400, shape: 'cone',  c1: OW, c2: OGo },
  oh7:  { slot: 'hat', name: 'Capuche d’Automne',     price: 450, shape: 'hood',  c1: OO, c2: OW },
  oh8:  { slot: 'hat', name: 'Heaume Spirale',        price: 500, shape: 'cap',   c1: OW, c2: OGo, curl: 1.5, stripe: OGo },
  oh9:  { slot: 'hat', name: 'Casque Cornu Lagon',    price: 600, shape: 'horn',  c1: OT, c2: OO },
  oh10: { slot: 'hat', name: 'Grand Cornu Abyssal',   price: 800, shape: 'horn',  c1: OTd, c2: OO, big: true },
  // Capes (motifs peints)
  oc1:  { slot: 'cape', name: 'Étendard Pousse',      price: 150, art: 'vine',   c1: OW, c2: OG },
  oc2:  { slot: 'cape', name: 'Étendard Sylvestre',   price: 200, art: 'branch', c1: OW, c2: OG },
  oc3:  { slot: 'cape', name: 'Bannière Brindille',   price: 250, art: 'branch', c1: OC, c2: OB },
  oc4:  { slot: 'cape', name: 'Cape Écorce',          price: 300, art: 'split',  c1: OB, c2: OW },
  oc5:  { slot: 'cape', name: 'Voile en Lambeaux',    price: 350, art: 'tatter', c1: OW, c2: OB },
  oc6:  { slot: 'cape', name: 'Cape Flammèche',       price: 400, art: 'flame',  c1: OW, c2: OO },
  oc7:  { slot: 'cape', name: 'Cape du Soleil',       price: 450, art: 'sun',    c1: OC, c2: OGo },
  oc8:  { slot: 'cape', name: 'Pans d’Automne',       price: 500, art: 'split',  c1: OO, c2: OC },
  oc9:  { slot: 'cape', name: 'Cape Lagon',           price: 600, art: 'tri',    c1: OT, c2: OO },
  oc10: { slot: 'cape', name: 'Cape des Abysses',     price: 800, art: 'harle',  c1: OT, c2: OO },
  // Bottes
  ob1:  { slot: 'boots', name: 'Chaussons Pousse',    price: 150, c1: OW, c2: OW, curl: OG },
  ob2:  { slot: 'boots', name: 'Bottes Bourgeon',     price: 200, c1: OW, c2: OG, curl: OG },
  ob3:  { slot: 'boots', name: 'Bottines Écorce',     price: 250, c1: OB, c2: OW, curl: OB },
  ob4:  { slot: 'boots', name: 'Bottes Racines',      price: 300, c1: OBd, c2: OB, curl: OW },
  ob5:  { slot: 'boots', name: 'Bottes Lune',         price: 350, c1: OW, c2: OGo, curl: OGo },
  ob6:  { slot: 'boots', name: 'Sabots d’Automne',    price: 400, c1: OO, c2: OW },
  ob7:  { slot: 'boots', name: 'Bottes Flamme',       price: 450, c1: OW, c2: OO, curl: OO },
  ob8:  { slot: 'boots', name: 'Bottes Lagon',        price: 500, c1: OT, c2: OW, curl: OO },
  ob9:  { slot: 'boots', name: 'Bottes Cornues',      price: 600, c1: OT, c2: OO, horn: OO },
  ob10: { slot: 'boots', name: 'Bottes des Abysses',  price: 800, c1: OTd, c2: OO, curl: OT, horn: OO },
};
for (const id in COSM) { COSM[id].cosm = true; COSM[id].id = id; }
// Ce qui se voit sur le héros : l'objivant s'il y en a un, sinon l'équipement
const lookItem = slot => {
  if (gearOff) return null;
  const c = ((previewBuild && PREVIEW) ? PREVIEW.cosm : save.cosm || {})[slot];
  return COSM[c] || gearItem(slot);
};
// Couleurs du personnage (comme dans Dofus)
const COLOR_SLOTS = [
  ['skin', 'Peau', ['#fde3c8', '#f2c29b', '#eac783', '#d9a066', '#c98a5e', '#a86a42', '#7a4a2e', '#5a3420', '#b8e0a0', '#a8c8f0', '#d8b0f0', '#f0b0c0']],
  ['hair', 'Cheveux', ['#2a1a14', '#5a3a26', '#8a5634', '#c98a3a', '#f0d070', '#f4efe2', '#9a9aa8', '#d9472f', '#ff7fb0', '#7a4fd9', '#3db8ff', '#4fbf5a']],
  ['outfit', 'Tenue', ['#ff8a1f', '#d9472f', '#ffd23f', '#4fbf5a', '#2f9a9a', '#3d6fd9', '#7a4fd9', '#ff4fa3', '#8a5634', '#f4efe2', '#5a5470', '#2b2350']],
  ['accent', 'Détails', ['#3a3550', '#5a3a26', '#ffd23f', '#f0b43a', '#3df5b0', '#3db8ff', '#ff3a5c', '#ff8fd0', '#ffffff', '#8fae2a', '#e8902a', '#1d1238']],
  ['eyes', 'Yeux', ['#2a1830', '#5a3a26', '#3d6fd9', '#2f9a9a', '#4fbf5a', '#7a4fd9', '#d9472f', '#f0b43a']],
];
const defaultColors = () => ({ skin: '#f2c29b', hair: '#5a3a26', outfit: '#ff8a1f', accent: '#3a3550', eyes: '#2a1830' });
const heroColors = () => ((previewBuild && PREVIEW && PREVIEW.colors) ? PREVIEW.colors : save.colors) || defaultColors();
function persoSkin() { const c = heroColors(); return { name: 'Mon héros', price: 0, outfit: c.outfit, accent: c.accent, skin: c.skin, head: 'hair', headCol: c.hair, eyes: c.eyes }; }

// Spirale en 3D (boucles des objivants) : un tube qui s'enroule
function curl3(parent, col, x, y, z, size, turns, rotY, rotZ, thick) {
  const T = THREE, pts = [];
  for (let i = 0; i <= 24; i++) { const u = i / 24, a = u * turns * TAU, r = size * (1 - u * 0.78); pts.push(new T.Vector3(Math.sin(a) * r, size * 0.9 * u + (1 - Math.cos(a)) * r * 0.5, 0)); }
  const m = mk(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 40, thick || size * 0.16, 8, false), col, x, y, z, parent);
  m.rotation.set(0, rotY || 0, rotZ || 0); return m;
}
function buildCosmHat3D(head, h) {
  if (buildArtHat3D(head, h.id)) return;
  const T = THREE;
  const dome = (col, k) => mk(new T.SphereGeometry(0.4 * (k || 1), 20, 12, 0, TAU, 0, Math.PI * 0.56), col, 0, 0.02, -0.01, head);
  if (h.shape === 'band') {
    const b = mk(new T.TorusGeometry(0.375, 0.065, 8, 26), h.c1, 0, 0.13, 0, head); b.rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) { const t = mk(BX(0.06, 0.05, 0.3), h.c1, s * 0.07, 0.1, -0.5, head); t.rotation.set(0.5, s * 0.4, 0); }
    curl3(head, h.c2, 0.24, 0.3, 0.12, 0.13, 1.1, 0.4, -0.5);
    const lf = mk(new T.SphereGeometry(0.07, 8, 6), h.c2, 0.32, 0.46, 0.1, head); lf.scale.set(1.6, 0.6, 1);
  } else if (h.shape === 'cap') {
    dome(h.c1);
    if (h.stripe) { const s = mk(new T.TorusGeometry(0.385, 0.04, 6, 26), h.stripe, 0, 0.1, 0, head); s.rotation.x = Math.PI / 2; }
    curl3(head, h.c2, 0, 0.38, -0.02, 0.16 * (h.curl || 1), 1.3, Math.PI / 2, 0, 0.045 * Math.sqrt(h.curl || 1));
  } else if (h.shape === 'witch') {
    mk(new T.CylinderGeometry(0.66, 0.68, 0.05, 26), h.c1, 0, 0.2, 0, head);
    const b = mk(new T.CylinderGeometry(0.36, 0.38, 0.12, 20), h.c2, 0, 0.29, 0, head);
    let px = 0, py = 0.34, a = 0;
    for (let i = 0; i < 4; i++) { const r0 = 0.36 - i * 0.085, len = 0.28; const c = mk(new T.CylinderGeometry(r0 - 0.085, r0, len, 16), h.c1, px, py + len / 2, 0, head); c.rotation.z = a; px += -Math.sin(a) * len; py += Math.cos(a) * len; a += 0.35; }
    curl3(head, h.c1, px, py, 0, 0.1, 1.2, Math.PI / 2, 0.6, 0.035);
  } else if (h.shape === 'brim') {
    mk(new T.CylinderGeometry(0.72, 0.72, 0.05, 26), h.c1, 0, 0.18, 0, head);
    mk(new T.CylinderGeometry(0.33, 0.38, 0.32, 20), h.c1, 0, 0.36, 0, head);
    const b = mk(new T.TorusGeometry(0.375, 0.04, 6, 24), h.c2, 0, 0.25, 0, head); b.rotation.x = Math.PI / 2;
    curl3(head, h.c2, 0.3, 0.32, -0.1, 0.17 * (h.curl || 1), 1.4, -0.4, 0.4, 0.04);
  } else if (h.shape === 'cone') {
    dome(h.c1, 1.02);
    mk(new T.ConeGeometry(0.36, 0.75, 20), h.c1, 0, 0.66, -0.04, head).rotation.x = -0.2;
    const b = mk(new T.TorusGeometry(0.39, 0.045, 6, 24), h.c2, 0, 0.12, 0, head); b.rotation.x = Math.PI / 2;
    curl3(head, h.c2, 0, 1.0, -0.13, 0.15, 1.6, Math.PI / 2, 0, 0.04);
  } else if (h.shape === 'hood') {
    mk(new T.SphereGeometry(0.44, 18, 12, Math.PI / 2 + 0.8, TAU - 1.6), h.c1, 0, 0.02, -0.02, head, { side: T.DoubleSide });
    const r = mk(new T.TorusGeometry(0.41, 0.05, 6, 24, Math.PI * 1.2), h.c2, 0, 0.02, 0.02, head); r.rotation.set(0, 0, -Math.PI * 0.1);
    for (const s of [-1, 1]) curl3(head, h.c1, s * 0.3, 0.32, -0.15, 0.16, 1.3, s * Math.PI / 2, s * 0.3, 0.045);
    curl3(head, h.c2, 0, 0.42, -0.3, 0.14, 1.2, Math.PI / 2, 0, 0.04);
  } else if (h.shape === 'horn') {
    dome(h.c1, 1.04);
    const v = mk(new T.TorusGeometry(0.4, 0.05, 6, 24, Math.PI), h.c2, 0, 0.1, 0, head); v.rotation.set(Math.PI / 2, 0, Math.PI);
    const k = h.big ? 1.45 : 1;
    for (const s of [-1, 1]) curl3(head, h.c2, s * 0.36, 0.22, -0.04, 0.2 * k, 1.25, s > 0 ? 0 : Math.PI, -s * 0.35, 0.06 * k);
    if (h.big) { const c = mk(new T.ConeGeometry(0.1, 0.3, 10), h.c1, 0, 0.5, 0.2, head); c.rotation.x = 0.6; }
  }
}
// Motif peint de la cape (sert aussi d'icône dans la boutique)
const capeArtCache = {};
function capeArt(id) {
  if (capeArtCache[id]) return capeArtCache[id];
  const h = COSM[id], c = document.createElement('canvas'); c.width = 160; c.height = 240;
  const g = c.getContext('2d'); g.lineJoin = 'round'; g.lineCap = 'round';
  const W = 160, H = 240, dark = '#3a2418';
  const curl2 = (x, y, r, turns, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); for (let i = 0; i <= 40; i++) { const u = i / 40, a = u * turns * TAU, rr = r * (1 - u * 0.8); g[i ? 'lineTo' : 'moveTo'](x + Math.sin(a) * rr, y - Math.cos(a) * rr); } g.stroke(); };
  // silhouette
  const shape = () => {
    g.beginPath();
    if (h.art === 'tri' || h.art === 'harle') { g.moveTo(14, 12); g.lineTo(W - 14, 12); g.lineTo(W / 2 + 10, H - 8); g.lineTo(W / 2 - 14, H - 30); g.closePath(); }
    else if (h.art === 'split') { g.moveTo(20, 10); g.lineTo(W - 20, 10); g.lineTo(W - 22, H - 10); g.lineTo(W / 2 + 6, H - 40); g.lineTo(W / 2 - 6, H - 40); g.lineTo(22, H - 10); g.closePath(); }
    else if (h.art === 'tatter' || h.art === 'flame') { g.moveTo(16, 10); g.lineTo(W - 16, 10); g.lineTo(W - 16, H - 50); for (let i = 0; i <= 6; i++) g.lineTo(W - 16 - i * (W - 32) / 6, H - 50 + (i % 2 ? 0 : 44) * (h.art === 'flame' ? 0.8 : 1)); g.closePath(); }
    else { g.moveTo(26, 10); g.lineTo(W - 26, 10); g.lineTo(W - 26, H - 24); g.lineTo(W / 2, H - 8); g.lineTo(26, H - 24); g.closePath(); }
  };
  shape(); const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, tint(h.c1, -0.12)); gr.addColorStop(0.4, tint(h.c1, 0.15)); gr.addColorStop(1, tint(h.c1, -0.25));
  g.fillStyle = gr; g.fill();
  g.save(); shape(); g.clip();
  if (h.art === 'vine' || h.art === 'branch') {
    g.strokeStyle = h.c2; g.lineWidth = h.art === 'branch' ? 12 : 9;
    g.beginPath(); g.moveTo(W / 2, 14); g.quadraticCurveTo(W / 2 + 10, H / 2, W / 2 - 4, H - 20); g.stroke();
    if (h.art === 'branch') { g.lineWidth = 8; for (const [y, s] of [[90, -1], [140, 1], [70, 1]]) { g.beginPath(); g.moveTo(W / 2 + 4, y); g.quadraticCurveTo(W / 2 + s * 30, y - 10, W / 2 + s * 42, y - 34); g.stroke(); } }
    curl2(W / 2 + 22, 54, 16, 1.2, h.c2, 6); curl2(W / 2 - 24, 150, 12, 1.2, h.c2, 5);
  } else if (h.art === 'split') {
    g.fillStyle = h.c2; g.fillRect(W / 2 - 8, 0, 16, H);
    curl2(44, 70, 18, 1.3, h.c2, 7); curl2(W - 44, 120, 18, 1.3, h.c2, 7);
  } else if (h.art === 'tatter') {
    g.fillStyle = h.c2; for (let i = 0; i < 4; i++) g.fillRect(28 + i * 30, 0, 9, H);
    curl2(W / 2, 60, 20, 1.3, h.c2, 7);
  } else if (h.art === 'flame') {
    for (const [col, k] of [[h.c2, 1], [OGo, 0.6]]) { g.fillStyle = col; g.beginPath(); g.moveTo(0, H); for (let i = 0; i <= 8; i++) g.lineTo(i * W / 8, H - (i % 2 ? 120 : 70) * k); g.lineTo(W, H); g.closePath(); g.fill(); }
    curl2(W / 2, 64, 22, 1.4, h.c2, 7);
  } else if (h.art === 'sun') {
    g.fillStyle = OO; g.fillRect(0, H - 60, W, 60);
    curl2(W / 2, 100, 40, 2.2, h.c2, 9);
    g.fillStyle = h.c2; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; g.beginPath(); g.arc(W / 2 + Math.cos(a) * 58, 96 + Math.sin(a) * 58, 5, 0, TAU); g.fill(); }
  } else if (h.art === 'tri') {
    g.strokeStyle = h.c2; g.lineWidth = 14; shape(); g.stroke();
    g.fillStyle = tint(h.c1, 0.25); g.beginPath(); g.moveTo(W / 2 - 30, 40); g.lineTo(W / 2 + 30, 40); g.lineTo(W / 2, 150); g.closePath(); g.fill();
  } else if (h.art === 'harle') {
    for (let y = -20; y < H; y += 40) for (let x = -20; x < W; x += 40) { g.fillStyle = ((x + y) / 40) % 2 ? h.c2 : tint(h.c1, 0.2); g.beginPath(); g.moveTo(x + 20, y); g.lineTo(x + 40, y + 20); g.lineTo(x + 20, y + 40); g.lineTo(x, y + 20); g.closePath(); g.fill(); }
    g.strokeStyle = OW; g.lineWidth = 8; shape(); g.stroke();
  }
  // ombre en bas, petit reflet en haut
  const sh = g.createLinearGradient(0, 0, 0, H); sh.addColorStop(0, 'rgba(255,255,240,.25)'); sh.addColorStop(0.3, 'rgba(255,255,240,0)'); sh.addColorStop(1, 'rgba(40,20,60,.3)');
  g.fillStyle = sh; g.fillRect(0, 0, W, H);
  g.restore();
  shape(); g.strokeStyle = dark; g.lineWidth = 5; g.stroke();
  // attaches dorées
  g.fillStyle = OGo; g.strokeStyle = dark; g.lineWidth = 3; for (const x of [30, W - 30]) { g.beginPath(); g.arc(x, 16, 9, 0, TAU); g.fill(); g.stroke(); }
  return (capeArtCache[id] = c);
}
function buildCosmCape3D(body, h, id) {
  const T = THREE, cape = new T.Group(); cape.position.set(0, 1.66, -0.5); cape.rotation.x = 0.14; body.add(cape);
  const tex = new T.CanvasTexture(capeArt(id));
  const m = new T.Mesh(new T.PlaneGeometry(1.0, 1.5), new T.MeshToonMaterial({ map: tex, gradientMap: GRAD, side: T.DoubleSide, alphaTest: 0.5 }));
  m.position.set(0, -0.72, 0); m.rotation.y = Math.PI; m.userData.noOutline = true; m.castShadow = true; cape.add(m);
  // le haut de la cape s'attache aux épaules
  mk(new T.CylinderGeometry(0.05, 0.05, 0.86, 8), h.c2, 0, 0, 0.02, cape).rotation.z = Math.PI / 2;
}
function buildCosmBoot3D(hip, b, side) {
  const T = THREE;
  const cuff = mk(new T.TorusGeometry(0.15, 0.055, 8, 18), b.c2, 0, -0.56, 0.02, hip); cuff.rotation.x = Math.PI / 2;
  if (b.curl) curl3(hip, b.curl, 0, -0.66, 0.3, 0.1, 1.3, Math.PI / 2, 0, 0.035);
  if (b.horn) { const c = mk(new T.ConeGeometry(0.06, 0.24, 8), b.horn, side * 0.12, -0.6, 0.12, hip); c.rotation.set(-0.3, 0, -side * 1.0); }
}
const cosmSnaps = {};
// Vignette d'un objivant : photo 3D (chapeau sur une tête, bottes) ou motif peint (cape)
function snapCosm(cnv, id) {
  if (ART_SRC[id] && paintArt(cnv, id)) return;
  const h = COSM[id], g2 = cnv.getContext('2d');
  g2.setTransform(1, 0, 0, 1, 0, 0); g2.clearRect(0, 0, cnv.width, cnv.height);
  if (h.slot === 'cape') { const a = capeArt(id), k = cnv.height / a.height * 0.9; g2.drawImage(a, (cnv.width - a.width * k) / 2, cnv.height * 0.05, a.width * k, a.height * k); return; }
  initPreview();
  if (!PV.r) return;
  let img = cosmSnaps[id + cnv.width];
  if (!img) {
    const T = THREE;
    if (!PV.csnap) {
      PV.csnap = { scene: new T.Scene(), cam: new T.PerspectiveCamera(30, cnv.width / cnv.height, 0.1, 20) };
      PV.csnap.scene.add(new T.HemisphereLight('#fffaf0', '#6d5a8a', 0.8));
      const dl = new T.DirectionalLight('#fff0d0', 0.85); dl.position.set(3, 5, 6); PV.csnap.scene.add(dl);
    }
    const CS = PV.csnap; if (CS.obj) CS.scene.remove(CS.obj);
    const o = new T.Group();
    if (h.slot === 'hat') {
      mk(new T.SphereGeometry(0.36, 18, 14), '#f2c29b', 0, 0, 0, o);
      buildCosmHat3D(o, h); CS.cam.position.set(0, 0.55, 2.6); CS.cam.lookAt(0, 0.3, 0); o.rotation.y = 0.5;
    } else {
      for (const s of [-1, 1]) { const hip = new T.Group(); hip.position.set(s * 0.24, 0.8, 0); o.add(hip); const bt = mk(new T.SphereGeometry(0.17, 18, 14), h.c1, 0, -0.72, 0.06, hip); bt.scale.set(1.05, 0.72, 1.45); mk(new T.CapsuleGeometry(0.12, 0.2, 6, 12), h.c1, 0, -0.5, 0, hip); buildCosmBoot3D(hip, h, s); }
      CS.cam.position.set(0, 0.6, 2.2); CS.cam.lookAt(0, 0.2, 0); o.rotation.y = 0.6;
    }
    addOutline(o, 0.02); CS.obj = o; CS.scene.add(o);
    CS.cam.aspect = cnv.width / cnv.height; CS.cam.updateProjectionMatrix();
    const pr = PV.r.getPixelRatio(), prev = PV.r.getSize(new T.Vector2());
    PV.r.setPixelRatio(1); PV.r.setSize(cnv.width, cnv.height, false);
    PV.r.render(CS.scene, CS.cam);
    img = document.createElement('canvas'); img.width = cnv.width; img.height = cnv.height; img.getContext('2d').drawImage(PV.r.domElement, 0, 0);
    PV.r.setPixelRatio(pr); PV.r.setSize(prev.x || 1, prev.y || 1, false);
    cosmSnaps[id + cnv.width] = img;
  }
  g2.drawImage(img, 0, 0);
}

const SETS = { dragon: { name: 'Armure ultime : Dragon ancestral', bonus: { dmg: 0.2, res: 0.1, aura: 1 } } };
const SLOTS = [['hat', 'Chapeaux', 'précision et sagesse'], ['cape', 'Capes', 'protection'], ['boots', 'Bottes', 'déplacement']];
let gearOff = false;   // vrai pendant le dessin des aperçus de tenues
const gearItem = slot => gearOff ? null : ITEMS[((previewBuild && PREVIEW) ? PREVIEW.gear : (save.gear || {}))[slot]];
function statLines(st) {
  const L = [], pc = v => Math.round(v * 100);
  if (st.dmg) L.push('+' + pc(st.dmg) + ' % de dégâts');
  if (st.crit) L.push('+' + pc(st.crit) + ' % de coups critiques');
  if (st.xp) L.push('+' + pc(st.xp) + ' % d’XP');
  if (st.hp) L.push('+' + st.hp + ' PV max');
  if (st.res) L.push('+' + pc(st.res) + ' % de résistance');
  if (st.regen) L.push('Régénération +' + st.regen + ' PV/s');
  if (st.speed) L.push('+' + pc(st.speed) + ' % de vitesse');
  if (st.dash) L.push('Roulade −' + pc(st.dash) + ' % de recharge');
  if (st.aura) L.push('Aura de feu qui brûle les monstres proches');
  return L;
}
function setCount(setId) { return SLOTS.filter(([s]) => { const it = ITEMS[(save.gear || {})[s]]; return it && it.set === setId; }).length; }
function gearStats() {
  const st = { dmg: 0, crit: 0, xp: 0, hp: 0, res: 0, regen: 0, speed: 0, dash: 0, aura: 0 };
  for (const [s] of SLOTS) { const it = ITEMS[(save.gear || {})[s]]; if (it) for (const k in it.stats) st[k] += it.stats[k]; }
  for (const id in SETS) if (setCount(id) === 3) for (const k in SETS[id].bonus) st[k] += SETS[id].bonus[k];
  return st;
}

// --- Dessin vu de dessus (Bastion) ---
function bootCol() { const b = gearItem('boots'); return b ? b.col : '#2b2b3a'; }
function drawCapeTop(g, walk, moving) {
  const c = gearItem('cape'); if (!c) return;
  const fl = moving ? Math.sin(walk * 0.8) * 3 : Math.sin(Date.now() / 400) * 1;
  g.fillStyle = c.col; g.strokeStyle = INK; g.lineWidth = 3;
  g.beginPath(); g.moveTo(-3, -17); g.quadraticCurveTo(-24, -23 + fl, -36, -13 + fl); g.lineTo(-38, 12 - fl); g.quadraticCurveTo(-24, 23 - fl, -3, 17); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = c.trim; g.lineWidth = 3; g.beginPath(); g.moveTo(-35, -12 + fl); g.lineTo(-37, 11 - fl); g.stroke();
  if (c.flame) {
    g.fillStyle = '#ff8a1f'; g.strokeStyle = INK; g.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) { const y = i * 5, x = -37 - (Math.abs(i) < 2 ? 0 : 1); const f = 5 + Math.sin(Date.now() / 90 + i) * 2; g.beginPath(); g.moveTo(x, y - 2.5); g.lineTo(x - f, y); g.lineTo(x, y + 2.5); g.closePath(); g.fill(); }
  }
  g.strokeStyle = INK;
}
function drawHatTop(g, hat, hx, R, skin) {
  g.fillStyle = skin; g.lineWidth = 3; g.beginPath(); g.arc(hx, 0, R, 0, TAU); g.fill(); g.stroke();
  if (hat.look === 'wool') {
    g.strokeStyle = '#3b5ea8'; g.lineWidth = 4; for (const s of [-1, 1]) { g.beginPath(); g.arc(hx - 2, s * (R + 1), 4.5, s > 0 ? 0 : Math.PI, s > 0 ? Math.PI : TAU); g.stroke(); }
    g.strokeStyle = INK; g.lineWidth = 2.5;
    for (const [x, y, r] of [[-4, 0, 8], [1, -5, 6.5], [1, 5, 6.5], [-8, -4, 5], [-8, 4, 5], [5, 0, 5.5]]) { g.fillStyle = '#fffbe8'; g.beginPath(); g.arc(hx + x, y, r, 0, TAU); g.fill(); g.stroke(); }
  } else if (hat.look === 'brim') {
    g.fillStyle = '#8a5634'; g.beginPath(); g.arc(hx, 0, R + 7, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#6b4430'; g.beginPath(); g.arc(hx, 0, R - 2, 0, TAU); g.fill(); g.stroke();
    g.strokeStyle = '#d9472f'; g.lineWidth = 3; g.beginPath(); g.arc(hx, 0, R - 0.5, 0, TAU); g.stroke();
  } else if (hat.look === 'rock') {
    g.fillStyle = '#b8a888'; g.beginPath();
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, r = R + 2 + (i % 2) * 2; g.lineTo(hx + Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#ff8a1f'; g.fillRect(hx + R - 3, -6, 3, 12);
    g.fillStyle = '#5fbf4a'; g.beginPath(); g.arc(hx - 5, -5, 3, 0, TAU); g.fill();
  } else if (hat.look === 'dragon') {
    g.fillStyle = '#ffc83d'; g.lineWidth = 2;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(hx - 2, s * 7); g.lineTo(hx - 20, s * 15); g.lineTo(hx - 6, s * 3); g.closePath(); g.fill(); g.stroke(); }
    g.fillStyle = '#8e2121'; g.lineWidth = 3; g.beginPath(); g.arc(hx, 0, R + 1.5, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#ffc83d'; g.beginPath(); g.moveTo(hx - 12, -2); g.lineTo(hx + 6, 0); g.lineTo(hx - 12, 2); g.closePath(); g.fill();
    g.fillStyle = '#ff8a1f'; g.shadowColor = '#ff8a1f'; g.shadowBlur = 6; g.fillRect(hx + R - 3, -6, 3, 12); g.shadowBlur = 0;
  }
}
function headTopExtra(g, k, hx, R, skin) {
  const hc = k.headCol;
  g.lineWidth = 3;
  if (k.head === 'hair') {
    g.fillStyle = skin; g.beginPath(); g.arc(hx, 0, R, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = hc; g.beginPath(); g.arc(hx - 2, 0, R + 1, Math.PI * 0.4, Math.PI * 1.6); g.quadraticCurveTo(hx + 8, 0, hx - 2 + Math.cos(Math.PI * 0.4) * (R + 1), Math.sin(Math.PI * 0.4) * (R + 1)); g.fill(); g.stroke();
  } else if (k.head === 'iop') {
    g.fillStyle = skin; g.beginPath(); g.arc(hx, 0, R, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = hc; g.lineWidth = 2.5; g.beginPath();
    const n = 10;
    for (let i = 0; i <= n; i++) { const a = Math.PI * 0.42 + i / n * Math.PI * 1.16, r1 = i % 2 ? R + 9 : R - 1; g.lineTo(hx + Math.cos(a) * r1, Math.sin(a) * r1); }
    g.lineTo(hx + 3, 0); g.closePath(); g.fill(); g.stroke();
  } else if (k.head === 'kasa') {
    g.fillStyle = skin; g.beginPath(); g.arc(hx, 0, R, 0, TAU); g.fill();
    g.fillStyle = hc; g.beginPath(); g.arc(hx, 0, R + 10, 0, TAU); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(29,18,56,.35)'; g.lineWidth = 2; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.moveTo(hx, 0); g.lineTo(hx + Math.cos(a) * (R + 9), Math.sin(a) * (R + 9)); g.stroke(); }
    g.fillStyle = k.accent; g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.arc(hx, 0, 3.5, 0, TAU); g.fill(); g.stroke();
  } else if (k.head === 'winged') {
    g.fillStyle = k.accent; g.lineWidth = 2;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(hx + 2, s * (R - 2)); g.lineTo(hx - 18, s * (R + 9)); g.lineTo(hx - 12, s * (R + 3)); g.lineTo(hx - 20, s * (R + 4)); g.lineTo(hx - 4, s * (R - 4)); g.closePath(); g.fill(); g.stroke(); }
    g.fillStyle = hc; g.lineWidth = 3; g.beginPath(); g.arc(hx, 0, R + 1, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = k.accent; g.fillRect(hx - 10, -1.5, 18, 3);
  } else if (k.head === 'skull') {
    g.fillStyle = hc; g.lineWidth = 2.5; g.beginPath();
    for (let i = 0; i <= 8; i++) { const a = Math.PI * 0.6 + i / 8 * Math.PI * 0.8, r1 = i % 2 ? R + 8 : R; g.lineTo(hx + Math.cos(a) * r1, Math.sin(a) * r1); }
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#ece6d0'; g.lineWidth = 3; g.beginPath(); g.arc(hx, 0, R + 1, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.ellipse(hx + 5, -4.5, 3, 3.5, 0, 0, TAU); g.ellipse(hx + 5, 4.5, 3, 3.5, 0, 0, TAU); g.fill();
    g.fillRect(hx + R - 2, -4, 2, 8);
  }
}

// ---------- Modèles 3D fidèles aux illustrations (chapeaux, bottes, capes et armes) ----------
// Texture tirée d'une illustration (elle est déjà décodée par l'écran de chargement)
const artTexCache = {};
function artTex(id) {
  if (!ART_SRC[id]) return null;
  let t = artTexCache[id];
  if (!t) {
    artImg(id); const im = ART[id];
    t = artTexCache[id] = new THREE.Texture(im); t.anisotropy = 4;
    if (im.complete && im.naturalWidth) t.needsUpdate = true; else im.addEventListener('load', () => { t.needsUpdate = true; });
  }
  return t;
}
function artReady() {
  return Promise.all(Object.keys(ART_SRC).map(id => { artImg(id); const im = ART[id]; return im.decode ? im.decode().catch(() => {}) : null; }));
}
const artOk = id => !!(ART_SRC[id] && ART[id] && ART[id].complete && ART[id].naturalWidth);
// Tube qui s'affine le long d'une courbe (cornes, tiges, plumes)
function taper(parent, pts, r0, r1, col, opt) {
  const T = THREE, curve = new T.CatmullRomCurve3(pts.map(p => new T.Vector3(p[0], p[1], p[2])));
  const TS = 28, RS = 10, geo = new T.TubeGeometry(curve, TS, 1, RS, false), pos = geo.attributes.position, P = new T.Vector3();
  for (let i = 0; i <= TS; i++) {
    curve.getPointAt(i / TS, P); const r = r0 + (r1 - r0) * i / TS;
    for (let j = 0; j <= RS; j++) { const k = i * (RS + 1) + j; pos.setXYZ(k, P.x + (pos.getX(k) - P.x) * r, P.y + (pos.getY(k) - P.y) * r, P.z + (pos.getZ(k) - P.z) * r); }
  }
  geo.computeVertexNormals();
  const m = mk(geo, col, 0, 0, 0, parent, opt);
  mk(new T.SphereGeometry(r0, 10, 8), col, pts[0][0], pts[0][1], pts[0][2], parent, opt);
  mk(new T.SphereGeometry(Math.max(r1, 0.008), 8, 6), col, pts[pts.length - 1][0], pts[pts.length - 1][1], pts[pts.length - 1][2], parent, opt);
  return m;
}
// Corne de bélier : part du haut, s'enroule vers l'extérieur puis vers le bas, en s'affinant
function ramHorn(parent, col, x, y, z, size, turns, side, thick, yaw) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = side * (yaw || 0); parent.add(g);
  const pts = [];
  for (let i = 0; i <= 30; i++) { const u = i / 30, a = u * turns * TAU, r = size * (1 - 0.72 * u); pts.push([side * r * Math.sin(a), -size + r * Math.cos(a) + size * 0.0, -u * size * 0.35]); }
  // la spirale commence pile au point d'attache
  const dy = pts[0][1]; pts.forEach(p => { p[1] -= dy; });
  taper(g, pts, thick, thick * 0.3, col);
  return g;
}
// Petite feuille (ellipsoïde aplatie avec une nervure)
function leaf3(parent, col, x, y, z, s, rz, ry) {
  const T = THREE, g = new T.Group(); g.position.set(x, y, z); g.rotation.set(0, ry || 0, rz || 0); parent.add(g);
  const m = mk(new T.SphereGeometry(0.06 * s, 12, 8), col, 0.07 * s, 0, 0, g); m.scale.set(1.6, 0.6, 0.28);
  mk(new T.CylinderGeometry(0.006 * s, 0.006 * s, 0.17 * s, 5), tint(col, -0.3), 0.07 * s, 0, 0.012 * s, g).rotation.z = Math.PI / 2;
  return g;
}
// Pousse : tige, boucle et feuille (bandeau, bonnet, bottes…)
function sprout3(parent, col, x, y, z, k) {
  taper(parent, [[x, y, z], [x + 0.03 * k, y + 0.1 * k, z], [x, y + 0.2 * k, z]], 0.04 * k, 0.034 * k, col);
  curl3(parent, col, x + 0.005 * k, y + 0.19 * k, z, 0.12 * k, 1.3, 0.25, -0.15, 0.033 * k);
  leaf3(parent, col, x + 0.02 * k, y + 0.08 * k, z, k * 1.1, 0.5, 0.3);
}
// Bord ondulé (bords de chapeau)
function waveBrim(r, h, waves, amp, up) {
  const geo = new THREE.CylinderGeometry(r, r, h, 48, 1), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z) / r, a = Math.atan2(z, x);
    if (d > 0.5) p.setY(i, p.getY(i) + (Math.sin(a * waves) * amp + (up || 0) * (x / r) * (x / r)) * (d - 0.5) * 2);
  }
  geo.computeVertexNormals(); return geo;
}
// Motifs peints sur les bottes (écailles, étoiles, bois, laine)
const patCache = {};
function patMat(col, kind, opt) {
  const key = col + kind + (opt ? JSON.stringify(opt) : '');
  if (patCache[key]) return patCache[key];
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = col; g.fillRect(0, 0, 128, 128);
  if (kind === 'scales') {
    g.strokeStyle = tint(col, -0.45); g.lineWidth = 3; g.fillStyle = tint(col, 0.12);
    for (let y = 0; y < 140; y += 16) for (let x = -16; x < 144; x += 22) { const ox = (y / 16) % 2 ? 11 : 0; g.beginPath(); g.arc(x + ox, y, 11, 0, Math.PI); g.fill(); g.stroke(); }
  } else if (kind === 'stars') {
    g.fillStyle = '#e8d4ff';
    for (const [x, y, r] of [[20, 24, 7], [80, 40, 5], [50, 90, 8], [104, 100, 5], [100, 14, 4], [24, 70, 4]]) { g.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, rr = i % 2 ? r * 0.3 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); }
  } else if (kind === 'wood') {
    g.strokeStyle = tint(col, -0.35); g.lineWidth = 3;
    for (let x = 6; x < 128; x += 18) { g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= 128; y += 16) g.lineTo(x + Math.sin(y * 0.08 + x) * 4, y); g.stroke(); }
  } else if (kind === 'wool') {
    g.fillStyle = tint(col, 0.15); for (let i = 0; i < 30; i++) { g.beginPath(); g.arc((i * 37) % 128, (i * 53) % 128, 7, 0, TAU); g.fill(); }
    g.strokeStyle = tint(col, -0.4); g.lineWidth = 2; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 128); g.stroke();
  } else if (kind === 'bark') {
    g.strokeStyle = tint(col, -0.4); g.lineWidth = 4;
    for (let x = 4; x < 128; x += 14) { g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= 128; y += 12) g.lineTo(x + Math.sin(y * 0.11 + x * 0.7) * 3, y); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return (patCache[key] = new THREE.MeshToonMaterial(Object.assign({ color: '#ffffff', map: t, gradientMap: GRAD }, opt || {})));
}

// --- Chapeaux (équipements et objivants), d'après les planches ---
const HAT_HAIR = { oh1: true };   // ces coiffes laissent voir tous les cheveux
const HAT_COVER = { bonnet: true, craq: true, dHelm: true, oh7: true };   // celles-ci cachent toute la tête
function buildArtHat3D(head, id) {
  const T = THREE;
  // tout le chapeau est un peu basculé vers l'arrière : le bord avant passe au-dessus des yeux
  const hg = new T.Group(); hg.rotation.x = -0.38; head.add(hg);
  const S = (r, col, x, y, z, sx, sy, sz, parent, opt) => { const m = mk(new T.SphereGeometry(r, 20, 14), col, x, y, z, parent || hg, opt); m.scale.set(sx || 1, sy || 1, sz || 1); return m; };
  const cap = (r, col, cut, opt) => mk(new T.SphereGeometry(r, 30, 16, 0, TAU, 0, Math.PI * cut), col, 0, 0.02, 0, hg, opt);
  const ring = (r, tube, col, y, parent, opt) => { const m = mk(new T.TorusGeometry(r, tube, 10, 40), col, 0, y, 0, parent || hg, opt); m.rotation.x = Math.PI / 2; return m; };
  const band = (r, h, col, y) => mk(new T.CylinderGeometry(r, r * 1.01, h, 36, 1, true), col, 0, y, 0, hg, { side: T.DoubleSide });
  const onSph = (x, y, z, R) => { const v = new T.Vector3(x, y, z).normalize().multiplyScalar(R); return [v.x, v.y, v.z]; };
  const GOLD = '#f0b43a', CREAM = '#f4eedb', GREEN = '#6fae2a', ORANGE = '#f0922a';
  switch (id) {
    case 'bonnet': {   // Bonnet laineux : grosse calotte de laine et cornes bleues enroulées
      cap(0.4, '#f2ead6', 0.52);
      const N = 76;
      for (let i = 0; i < N; i++) {
        const y = 1 - 2 * (i + 0.5) / N; if (y < -0.12) continue;
        const r = Math.sqrt(1 - y * y), a = i * 2.39996, x = Math.cos(a) * r, z = Math.sin(a) * r;
        const s = 0.1 + ((i * 37) % 11) / 11 * 0.05;
        S(s, i % 3 ? '#fffaf0' : '#f3ecda', x * 0.42, y * 0.42 + 0.04, z * 0.42, 1, 0.92, 1);
      }
      for (const s of [-1, 1]) ramHorn(hg, '#5a8ad8', s * 0.42, 0.1, 0.04, 0.15, 1.3, s, 0.065, 0.35);
      break;
    }
    case 'aventu': {   // Chapeau d'aventurier : bord relevé sur les côtés, ruban rouge, grande plume jaune
      mk(waveBrim(0.64, 0.045, 2, 0, 0.16), '#7a4a2a', 0, 0.06, 0, hg);
      const cr = new T.CylinderGeometry(0.3, 0.37, 0.38, 32, 4), p = cr.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i); if (y > 0.1) p.setY(i, y - 0.08 * Math.max(0, 1 - Math.abs(x) / 0.3) * (y + 0.19) / 0.38); }
      cr.computeVertexNormals(); mk(cr, '#6b4026', 0, 0.26, 0, hg);
      band(0.372, 0.1, '#c8322a', 0.13);
      const f = new T.Group(); f.position.set(0.36, 0.22, -0.04); f.rotation.set(-0.3, 0, -0.75); hg.add(f);
      S(0.07, '#f2c234', 0, 0.3, 0, 1.1, 4.4, 0.25, f); S(0.05, '#ffe27a', 0.02, 0.33, 0.012, 1, 3.6, 0.25, f);
      taper(f, [[0, -0.02, 0], [0, 0.3, 0.01], [-0.02, 0.6, 0]], 0.012, 0.004, '#c89a2a');
      break;
    }
    case 'craq': {   // Casque de roche : bloc de pierre, visière en T qui brille, mousse
      const geo = new T.DodecahedronGeometry(0.5, 1), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + 0.07 * Math.sin(x * 13.1 + y * 7.3) * Math.cos(z * 11.7 - y * 5.1); p.setXYZ(i, x * n, y * n, z * n); }
      geo.computeVertexNormals();
      const rk = mk(geo, mat('#c9bc9e', { flatShading: true }), 0, 0.04, 0, head); rk.scale.set(1, 1.04, 0.98);
      mk(BX(0.46, 0.14, 0.1), '#3a2418', 0, 0.03, 0.46, head); mk(BX(0.14, 0.28, 0.1), '#3a2418', 0, -0.1, 0.45, head);
      mk(BX(0.4, 0.07, 0.03), '#ff7a1a', 0, 0.03, 0.51, head, { emissive: '#a03000' }); mk(BX(0.07, 0.22, 0.03), '#ff7a1a', 0, -0.1, 0.5, head, { emissive: '#a03000' });
      for (const [x, y, z, s] of [[-0.24, 0.44, 0.08, 1], [-0.12, 0.5, 0.0, 0.7], [0.26, 0.42, -0.04, 0.9], [0.32, 0.36, 0.12, 0.6]]) S(0.08 * s, '#6ab04c', x, y, z, 1.4, 0.6, 1.1, head);
      hg.removeFromParent(); break;
    }
    case 'dHelm': {   // Heaume du Dragon ancestral : rouge, grandes cornes ivoire, crête dorée, visière en T
      S(0.45, '#9a2a22', 0, 0.04, -0.01, 1, 1, 1, head);
      for (const s of [-1, 1]) S(0.17, '#6e1a16', s * 0.32, -0.16, 0.16, 0.7, 1.25, 1, head);
      mk(BX(0.46, 0.13, 0.08), '#c8862a', 0, 0.04, 0.41, head); mk(BX(0.38, 0.07, 0.04), '#ff7a1a', 0, 0.04, 0.45, head, { emissive: '#a03000' });
      mk(BX(0.14, 0.26, 0.08), '#c8862a', 0, -0.1, 0.39, head); mk(BX(0.07, 0.2, 0.04), '#ff7a1a', 0, -0.1, 0.43, head, { emissive: '#a03000' });
      for (let i = 0; i < 5; i++) {
        const a = 0.35 - i * 0.42, pos = onSph(0, Math.cos(a), Math.sin(a), 0.45);
        const c = mk(new T.ConeGeometry(0.05, 0.17 - Math.abs(i - 1.5) * 0.02, 6), GOLD, pos[0], pos[1] + 0.04, pos[2], head);
        c.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(...pos).normalize());
      }
      for (const s of [-1, 1]) taper(head, [[s * 0.3, 0.26, -0.04], [s * 0.52, 0.42, -0.04], [s * 0.62, 0.7, 0.0], [s * 0.52, 0.95, 0.08]], 0.09, 0.012, '#efe3c4');
      hg.removeFromParent(); break;
    }
    case 'oh1': {   // Bandeau Pousse : bandeau blanc noué, pousse verte
      band(0.415, 0.13, '#f6f2e6', 0.1);
      S(0.06, '#f6f2e6', 0.3, 0.1, -0.3, 1, 1, 1);
      for (const s of [-1, 1]) { const t = mk(BX(0.08, 0.2, 0.02), '#f6f2e6', 0.33 + s * 0.04, -0.02, -0.33, hg); t.rotation.set(0.3, -0.8, s * 0.35); }
      sprout3(hg, GREEN, 0.0, 0.38, 0.02, 1.1);
      break;
    }
    case 'oh2': {   // Bonnet Bourgeon : calotte crème et bourgeon vert
      cap(0.41, CREAM, 0.5); ring(0.405, 0.03, '#e2d6b0', 0.02);
      sprout3(hg, GREEN, 0, 0.4, 0, 1.15);
      break;
    }
    case 'oh3': {   // Toque Feuillue : toque bouffante, bande verte, liane qui s'enroule
      band(0.41, 0.2, CREAM, 0.1); band(0.415, 0.08, GREEN, 0.05);
      S(0.36, CREAM, 0, 0.36, 0, 1.3, 0.72, 1.3); S(0.2, '#fbf6e6', -0.2, 0.42, 0.08); S(0.2, '#fbf6e6', 0.19, 0.43, -0.06); S(0.2, CREAM, 0.02, 0.47, 0.18); S(0.19, '#fbf6e6', -0.05, 0.45, -0.22);
      const vp = []; for (let i = 0; i <= 16; i++) { const u = i / 16, a = 0.6 + u * 1.6 * Math.PI, r = 0.43 - u * 0.12; vp.push([Math.cos(a) * r, 0.1 + u * 0.5, Math.sin(a) * r]); }
      taper(hg, vp, 0.035, 0.025, '#5f9a24');
      curl3(hg, '#5f9a24', vp[16][0], vp[16][1], vp[16][2], 0.13, 1.3, 0.2, 0, 0.03);
      [3, 7, 11, 14].forEach((k, i) => leaf3(hg, '#7cbc34', vp[k][0], vp[k][1], vp[k][2], 1.1, i % 2 ? 0.6 : -0.4, Math.atan2(vp[k][2], vp[k][0])));
      break;
    }
    case 'oh4': {   // Chapeau Brindille : chapeau pointu brun courbé, ruban blanc, pointe en spirale
      mk(waveBrim(0.72, 0.04, 3, 0.03, 0.04), '#7a5232', 0, 0.06, 0, hg);
      band(0.385, 0.12, '#f4efe2', 0.14);
      let px = 0, py = 0.1, a = 0;
      for (let i = 0; i < 6; i++) { const r0 = 0.38 - i * 0.058, len = 0.17; const c = mk(new T.CylinderGeometry(r0 - 0.058, r0, len, 22), '#6e4a2c', px, py + len / 2, 0, hg); c.rotation.z = a; px += -Math.sin(a) * len; py += Math.cos(a) * len; a += 0.22; }
      curl3(hg, '#6e4a2c', px, py - 0.02, 0, 0.12, 1.3, 0, Math.PI / 2 + 0.6, 0.035);
      break;
    }
    case 'oh5': {   // Chapeau Écorce : souche d'arbre en haut-de-forme, ruban blanc, spirale de bois
      mk(waveBrim(0.68, 0.05, 7, 0.035, 0), '#6a4a2c', 0, 0.06, 0, hg);
      mk(new T.CylinderGeometry(0.33, 0.37, 0.46, 24), patMat('#7a5534', 'bark'), 0, 0.32, 0, hg);
      mk(new T.CylinderGeometry(0.33, 0.33, 0.03, 24), '#c09060', 0, 0.56, 0, hg);
      for (const r of [0.22, 0.12]) ring(r, 0.012, '#8a6a40', 0.575);
      band(0.385, 0.1, '#f4efe2', 0.16);
      const sp = curl3(hg, '#9a7448', 0.36, 0.24, 0.02, 0.13, 1.4, Math.PI / 2, 0, 0.04);
      break;
    }
    case 'oh6': {   // Cornet Lunaire : grand cornet nacré, bague et boucle dorées
      cap(0.4, '#e6ecf6', 0.5, { emissive: '#1a2030' });
      mk(new T.ConeGeometry(0.39, 1.1, 36), '#eef2fa', 0, 0.62, -0.03, hg, { transparent: true, opacity: 0.82, emissive: '#2a3040' }).rotation.x = -0.08;
      ring(0.39, 0.045, GOLD, 0.08);
      curl3(hg, GOLD, 0, 1.12, -0.08, 0.1, 1.3, 0, 0, 0.03);
      break;
    }
    case 'oh7': {   // Capuche d'Automne : capuche orange, bord crème, pointe enroulée
      head.remove(hg);
      mk(new T.SphereGeometry(0.46, 24, 16, Math.PI / 2 + 0.78, TAU - 1.56), ORANGE, 0, 0.03, -0.02, head, { side: T.DoubleSide });
      const R = 0.46, ed = [];
      for (let i = 0; i <= 12; i++) { const th = 0.86 * Math.PI - i / 12 * 0.72 * Math.PI, ph = Math.PI / 2 + 0.78; ed.push([-Math.cos(ph) * Math.sin(th) * R, Math.cos(th) * R + 0.03, Math.sin(ph) * Math.sin(th) * R - 0.02]); }
      for (let i = 12; i >= 0; i--) { const th = 0.86 * Math.PI - i / 12 * 0.72 * Math.PI, ph = Math.PI / 2 - 0.78; ed.push([-Math.cos(ph) * Math.sin(th) * R, Math.cos(th) * R + 0.03, Math.sin(ph) * Math.sin(th) * R - 0.02]); }
      taper(head, ed, 0.05, 0.05, CREAM);
      taper(head, [[0, 0.3, -0.3], [0, 0.42, -0.5], [0, 0.34, -0.66]], 0.12, 0.05, ORANGE);
      curl3(head, ORANGE, 0, 0.32, -0.66, 0.1, 1.2, Math.PI / 2, Math.PI, 0.04);
      break;
    }
    case 'oh8': {   // Heaume Spirale : dôme blanc brillant, couronne dorée, spirale d'or
      cap(0.41, '#f6f4ee', 0.5, { emissive: '#1c1c22' }); ring(0.41, 0.055, GOLD, 0.02);
      taper(hg, [[0, 0.4, 0], [0, 0.52, 0]], 0.035, 0.03, GOLD);
      curl3(hg, GOLD, 0, 0.52, 0, 0.13, 1.35, 0.15, 0, 0.035);
      break;
    }
    case 'oh9': case 'oh10': {   // Casque Cornu Lagon / Grand Cornu Abyssal : casque bleu-vert, cadre en M orange, cornes
      const big = id === 'oh10', col = big ? '#1f7f8a' : '#2fa6b0';
      cap(0.43, col, 0.6, { emissive: big ? '#05181a' : '#062022' });
      for (const s of [-1, 1]) S(0.19, col, s * 0.3, -0.1, -0.02, 0.6, 1.1, 1, head);
      const M = [[-0.32, -0.22], [-0.31, 0.06], [-0.27, 0.2], [-0.12, 0.17], [0, 0.07], [0.12, 0.17], [0.27, 0.2], [0.31, 0.06], [0.32, -0.22]].map(([x, y]) => [x, y, Math.sqrt(Math.max(0.01, 0.445 * 0.445 - x * x - y * y))]);
      taper(head, M, 0.045, 0.045, ORANGE);
      if (big) {
        mk(new T.ConeGeometry(0.08, 0.26, 10), '#2fb8c4', 0, 0.48, 0.02, hg);
        for (const s of [-1, 1]) ramHorn(head, ORANGE, s * 0.42, 0.26, 0.0, 0.22, 1.35, s, 0.09, 0.15);
      } else for (const s of [-1, 1]) taper(head, [[s * 0.34, 0.12, -0.02], [s * 0.5, 0.2, -0.02], [s * 0.56, 0.38, 0.0], [s * 0.48, 0.52, 0.03]], 0.075, 0.018, ORANGE);
      break;
    }
    default: head.remove(hg); return false;
  }
  return true;
}

// --- Bottes ---
const BOOT3 = {
  none:    { col: '#2e2838', sole: '#1d1826', h: 0.24, cuff: 'flat', cc: '#3a3346' },
  bottesL: { col: '#dccfae', sole: '#a8946e', h: 0.3, cuff: 'fold', cc: '#8a6a46', tex: 'wool' },
  bottesT: { col: '#f6c83a', sole: '#d88a24', h: 0.3, cuff: 'flat', cc: '#f08a24', wing: '#fff4c8' },
  bottesS: { col: '#8a5ab8', sole: '#4a2a6a', h: 0.32, cuff: 'notch', cc: '#a678d8', toe: true, tex: 'stars' },
  dBoots:  { col: '#9a2a22', sole: '#5a1a14', h: 0.32, cuff: 'flat', cc: '#f0b43a', claws: '#efe3c4', tex: 'scales' },
  ob1:  { col: '#f6f2e6', sole: '#e2dccb', h: 0.12, cuff: 'roll', cc: '#fbf8ef', curl: ['#7cae2a', 'side'] },
  ob2:  { col: '#f6f2e6', sole: '#6aa22a', h: 0.32, cuff: 'flat', cc: '#6aa22a', curl: ['#6aa22a', 'toe'] },
  ob3:  { col: '#7a5232', sole: '#4a3020', h: 0.22, cuff: 'fur', cc: '#f6f2e6', curl: ['#6a4428', 'toe'], tex: 'wood' },
  ob4:  { col: '#4a3020', sole: '#2e1e14', h: 0.3, cuff: 'fold', cc: '#6a4a30', curl: ['#f6f2e6', 'top'] },
  ob5:  { col: '#eef0f6', sole: '#f0b43a', h: 0.32, cuff: 'flat', cc: '#f0b43a', curl: ['#f0b43a', 'toe'], pearl: true },
  ob6:  { col: '#f08a24', sole: '#b85a14', h: 0.2, cuff: 'slouch', cc: '#f3e6c4', clog: true },
  ob7:  { col: '#f6f2e6', sole: '#b8642a', h: 0.32, cuff: 'flame', cc: '#f08a24', curl: ['#f08a24', 'side'] },
  ob8:  { col: '#2fb3bf', sole: '#f08a24', h: 0.3, cuff: 'roll', cc: '#f6f2e6', curl: ['#f08a24', 'side'] },
  ob9:  { col: '#2fb3bf', sole: '#f08a24', h: 0.32, cuff: 'flat', cc: '#f08a24', horn: ['#f08a24', 'toe'] },
  ob10: { col: '#1f7f8a', sole: '#f08a24', h: 0.32, cuff: 'flat', cc: '#f08a24', horn: ['#f08a24', 'side'], curl: ['#2fa6b0', 'toe'] },
};
const bootSpec = () => { const b = lookItem('boots'); return BOOT3[b ? b.id : 'none'] || BOOT3.none; };
function buildBoot3D(hip, B, side) {
  const T = THREE, s = side || 1, y0 = -0.72;
  const body = B.tex ? patMat(B.col, B.tex) : B.pearl ? mat(B.col, { emissive: '#2a2a36' }) : B.col;
  const S = (r, col, x, y, z, sx, sy, sz) => { const m = mk(new T.SphereGeometry(r, 18, 12), col, x, y, z, hip); m.scale.set(sx || 1, sy || 1, sz || 1); return m; };
  // pied et semelle
  S(0.172, B.sole, 0, y0 - 0.06, 0.07, B.clog ? 1.18 : 1.03, 0.32, B.clog ? 1.62 : 1.5);
  S(0.17, body, 0, y0, 0.07, B.clog ? 1.15 : 1, B.clog ? 0.82 : 0.66, B.clog ? 1.58 : 1.48);
  // tige de la botte
  mk(new T.CylinderGeometry(0.15, 0.16, B.h, 20), body, 0, y0 + B.h / 2, 0, hip);
  const yT = y0 + B.h;
  if (B.cuff === 'flat') mk(new T.CylinderGeometry(0.178, 0.172, 0.09, 22), B.cc, 0, yT, 0, hip);
  else if (B.cuff === 'roll') { const r = mk(new T.TorusGeometry(0.155, 0.05, 10, 24), B.cc, 0, yT, 0, hip); r.rotation.x = Math.PI / 2; }
  else if (B.cuff === 'fold') mk(new T.CylinderGeometry(0.19, 0.17, 0.13, 22), B.cc, 0, yT - 0.03, 0, hip);
  else if (B.cuff === 'fur') { const r = mk(new T.TorusGeometry(0.16, 0.06, 10, 24), B.cc, 0, yT, 0, hip); r.rotation.x = Math.PI / 2; for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; S(0.05, B.cc, Math.cos(a) * 0.17, yT + 0.02, Math.sin(a) * 0.17); } }
  else if (B.cuff === 'slouch') { const r = mk(new T.TorusGeometry(0.17, 0.08, 10, 24), B.cc, 0, yT + 0.02, 0, hip); r.rotation.x = Math.PI / 2; r.scale.z = 1.3; }
  else if (B.cuff === 'notch' || B.cuff === 'flame') {
    mk(new T.CylinderGeometry(0.175, 0.17, 0.07, 22), B.cc, 0, yT, 0, hip);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3, c = mk(new T.ConeGeometry(0.05, B.cuff === 'flame' ? 0.15 : 0.1, 6), B.cc, Math.cos(a) * 0.163, yT - 0.08, Math.sin(a) * 0.163, hip); c.rotation.x = Math.PI; }
  }
  // bout recourbé (bottes de sept lieues)
  if (B.toe) taper(hip, [[0, y0 + 0.02, 0.26], [0, y0 + 0.05, 0.38], [0, y0 + 0.14, 0.44], [0, y0 + 0.2, 0.38]], 0.075, 0.02, body === B.col ? B.col : B.col);
  if (B.curl) {
    const [cc, at] = B.curl;
    if (at === 'toe') curl3(hip, cc, s * 0.12, y0 + 0.02, 0.24, 0.07, 1.3, Math.PI / 2, 0, 0.03);
    else if (at === 'side') curl3(hip, cc, s * 0.16, y0 + 0.12, 0.02, 0.08, 1.3, Math.PI / 2, 0, 0.032);
    else curl3(hip, cc, s * 0.02, y0 + 0.1, 0.2, 0.08, 1.4, Math.PI / 2, 0, 0.04);
  }
  if (B.horn) {
    const [hc, at] = B.horn;
    if (at === 'toe') { const c = mk(new T.ConeGeometry(0.05, 0.2, 10), hc, 0, y0 + 0.12, 0.22, hip); c.rotation.x = 0.9; }
    else for (const k of [-1, 1]) { const c = mk(new T.ConeGeometry(0.05, 0.18, 10), hc, k * 0.17, y0 + 0.2, 0.02, hip); c.rotation.z = -k * 1.25; }
  }
  if (B.wing) for (let i = 0; i < 3; i++) { const w = S(0.05, i ? '#fff8dc' : B.wing, s * 0.17, y0 + 0.22 + i * 0.04, -0.05 - i * 0.03, 0.25, 0.55, 1.5 - i * 0.25); w.rotation.x = -0.5 - i * 0.2; }
  if (B.claws) for (const x of [-0.09, 0, 0.09]) { const c = mk(new THREE.ConeGeometry(0.035, 0.12, 6), B.claws, x, y0 - 0.06, 0.32, hip); c.rotation.x = Math.PI / 2 + 0.4; }
}

// --- Capes : l'illustration posée sur un tissu qui s'arrondit autour du dos et s'évase en bas ---
const CAPE_W = { capeB: 1.08, capeA: 1.02, capeT: 1.08, dCape: 1.75 };
function artCapeMesh(id) {
  const T = THREE, d = ART_DIM[id], W = CAPE_W[id] || 0.94, H = W * d[1] / d[0];
  const geo = new T.PlaneGeometry(W, H, 12, 16), p = geo.attributes.position, wing = id === 'dCape';
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), t = (H / 2 - y) / H, u = x / (W / 2);
    p.setZ(i, -u * u * (wing ? 0.3 : 0.16) * (1 - t * 0.4) + t * t * (wing ? 0.12 : 0.3) + Math.sin(u * 5.5 + 0.6) * 0.025 * t);
  }
  geo.translate(0, -H / 2, 0); geo.computeVertexNormals();
  const m = new T.Mesh(geo, new T.MeshToonMaterial({ map: artTex(id), gradientMap: GRAD, side: T.DoubleSide, alphaTest: 0.5 }));
  m.rotation.y = Math.PI; m.userData.noOutline = true; m.castShadow = false; m.receiveShadow = true;
  return m;
}

// --- Armes : vraie arme en volume, découpée sur la silhouette de l'illustration (peinte des deux côtés) ---
const gunGeoCache = {};
function gunArtGeo(id) {
  if (gunGeoCache[id]) return gunGeoCache[id];
  const T = THREE, G = GUN3D[id], ar = G.ar, D = 0.1;
  const sh = new T.Shape(G.p.map(([x, y]) => new T.Vector2(x, y * ar)));
  const uv = (v, ids) => ids.map(i => new T.Vector2(v[i * 3], v[i * 3 + 1] / ar));
  const geo = new T.ExtrudeGeometry(sh, { depth: D, bevelEnabled: false, curveSegments: 2, UVGenerator: { generateTopUV: (g, v, a, b, c) => uv(v, [a, b, c]), generateSideWallUV: (g, v, a, b, c, d) => uv(v, [a, b, c, d]) } });
  geo.translate(-G.a[0], -G.a[1] * ar, -D / 2);
  return (gunGeoCache[id] = geo);
}
const wskinId = () => { const id = (previewBuild && PREVIEW) ? PREVIEW.wskin : save.wskin; return WSKINS[id] ? id : 'standard'; };
function artGunMesh(id) {
  const T = THREE, G = GUN3D[id];
  const cap = new T.MeshToonMaterial({ map: artTex('g_' + id), gradientMap: GRAD, alphaTest: 0.5 });
  const m = new T.Mesh(gunArtGeo(id), [cap, mat(G.side)]);
  m.rotation.y = -Math.PI / 2; m.scale.setScalar(1.6); m.position.set(0, -0.1, -0.14);
  m.userData.noOutline = true; m.castShadow = true;
  return m;
}

// --- 3D (village) ---
function bootCol3() { const b = lookItem('boots'); return b ? (b.cosm ? b.c1 : b.col) : '#1d1238'; }
function bootTrim3(hip, side) {
  const b = lookItem('boots'); if (!b) return;
  if (b.cosm) { buildCosmBoot3D(hip, b, side || 1); return; }
  mk(BX(0.34, 0.12, 0.36), b.trim, 0, -0.58, 0.02, hip);
  if (b.claws) for (const x of [-0.09, 0, 0.09]) { const c = mk(new THREE.ConeGeometry(0.04, 0.12, 5), '#ffc83d', x, -0.8, 0.3, hip); c.rotation.x = Math.PI / 2; }
}
function buildCape3D(body) {
  const c = lookItem('cape'); if (!c) return;
  if (artOk(c.id)) { const cape = new THREE.Group(); cape.position.set(0, 1.64, -0.5); cape.rotation.x = 0.12; body.add(cape); cape.add(artCapeMesh(c.id)); return; }
  if (c.cosm) { buildCosmCape3D(body, c, c.id); return; }
  const T = THREE, cape = new T.Group(); cape.position.set(0, 1.62, -0.55); cape.rotation.x = 0.14; body.add(cape);
  mk(BX(0.86, 1.15, 0.05), c.col, 0, -0.56, 0, cape, { side: T.DoubleSide });
  mk(BX(0.9, 0.1, 0.07), c.trim, 0, -1.12, 0, cape);
  mk(BX(0.86, 0.1, 0.08), c.trim, 0, 0, 0.02, cape);
  if (c.flame) for (let i = 0; i < 5; i++) { const f = mk(new T.ConeGeometry(0.07, 0.22, 6), '#ff8a1f', -0.34 + i * 0.17, -1.25, 0, cape, { emissive: '#e05a00' }); f.rotation.x = Math.PI; f.castShadow = false; }
}
function buildHat3D(head, hat) {
  if (hat.model) { const m = modelHat(hat); if (m) head.add(m); return; }
  if (hat.id && buildArtHat3D(head, hat.id)) return;
  const T = THREE;
  if (hat.look === 'wool') {
    for (const [x, y, z, r] of [[0, 0.3, -0.02, 0.24], [0.17, 0.22, 0.05, 0.17], [-0.17, 0.22, 0.05, 0.17], [0, 0.24, -0.2, 0.2], [0.14, 0.14, -0.2, 0.16], [-0.14, 0.14, -0.2, 0.16]]) mk(new T.SphereGeometry(r, 10, 8), '#fffbe8', x, y, z, head);
    for (const s of [-1, 1]) { const h = mk(new T.TorusGeometry(0.12, 0.05, 6, 12, Math.PI * 1.3), '#3b5ea8', s * 0.36, 0.12, -0.02, head); h.rotation.y = Math.PI / 2; }
  } else if (hat.look === 'brim') {
    mk(new T.CylinderGeometry(0.64, 0.64, 0.05, 20), '#8a5634', 0, 0.2, 0, head);
    mk(new T.CylinderGeometry(0.33, 0.38, 0.32, 16), '#6b4430', 0, 0.38, 0, head);
    mk(new T.CylinderGeometry(0.385, 0.385, 0.08, 16), '#d9472f', 0, 0.26, 0, head);
  } else if (hat.look === 'rock') {
    const h = mk(new T.DodecahedronGeometry(0.47, 0), '#b8a888', 0, 0.1, -0.03, head); h.scale.set(1, 0.85, 1);
    mk(BX(0.36, 0.07, 0.05), '#ff8a1f', 0, 0.02, 0.43, head, { emissive: '#c04a00' });
    mk(new T.SphereGeometry(0.08, 6, 5), '#5fbf4a', -0.2, 0.36, -0.1, head);
  } else if (hat.look === 'dragon') {
    mk(new T.SphereGeometry(0.44, 16, 12), '#8e2121', 0, 0.04, 0, head);
    mk(BX(0.3, 0.07, 0.05), '#ff8a1f', 0, 0.03, 0.43, head, { emissive: '#e05a00' });
    for (let i = 0; i < 4; i++) { const c = mk(new T.ConeGeometry(0.05, 0.16, 5), '#ffc83d', 0, 0.42 - i * 0.05, 0.12 - i * 0.14, head); c.rotation.x = -0.5; }
    for (const s of [-1, 1]) { const h = mk(new T.ConeGeometry(0.07, 0.45, 6), '#f2e3c2', s * 0.26, 0.28, -0.22, head); h.rotation.set(-1.0, 0, -s * 0.35); }
  }
}
function headExtra3D(head, k) {
  const T = THREE, hc = k.headCol;
  if (k.head === 'iop') {
    mk(new T.SphereGeometry(0.385, 16, 8, 0, TAU, 0, Math.PI / 2), hc, 0, 0.03, -0.02, head);
    const up = new T.Vector3(0, 1, 0);
    for (const [x, y, z] of [[0, 1, -0.3], [0.5, 0.8, -0.5], [-0.5, 0.8, -0.5], [0.3, 0.4, -1], [-0.3, 0.4, -1], [0, 0.6, -1], [0.8, 0.3, -0.4], [-0.8, 0.3, -0.4], [0.2, 1, 0.3]]) {
      const d = new T.Vector3(x, y, z).normalize();
      const c = mk(new T.ConeGeometry(0.11, 0.42, 6), hc, d.x * 0.42, d.y * 0.42, d.z * 0.42, head);
      c.quaternion.setFromUnitVectors(up, d);
    }
  } else if (k.head === 'kasa') {
    mk(new T.ConeGeometry(0.82, 0.42, 20), hc, 0, 0.42, 0, head);
    mk(new T.TorusGeometry(0.8, 0.03, 6, 24), k.accent, 0, 0.22, 0, head).rotation.x = Math.PI / 2;
    mk(new T.CylinderGeometry(0.12, 0.12, 0.02, 12), '#ffffff', 0.32, 0.45, 0.32, head).rotation.set(0.5, 0, -0.5);
  } else if (k.head === 'winged') {
    mk(new T.SphereGeometry(0.41, 16, 12), hc, 0, 0.03, 0, head);
    mk(BX(0.06, 0.12, 0.6), k.accent, 0, 0.42, -0.02, head);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const w = mk(BX(0.04, 0.09, 0.42 - i * 0.08), k.accent, s * (0.4 + i * 0.03), 0.18 + i * 0.1, -0.22, head); w.rotation.set(-0.6 - i * 0.2, 0, s * 0.2); }
  } else if (k.head === 'skull') {
    const up = new T.Vector3(0, 1, 0);
    for (const [x, y, z] of [[0, 1, -0.5], [0.5, 0.7, -0.7], [-0.5, 0.7, -0.7], [0, 0.4, -1]]) { const d = new T.Vector3(x, y, z).normalize(); const c = mk(new T.ConeGeometry(0.13, 0.5, 6), hc, d.x * 0.4, d.y * 0.4, d.z * 0.4, head); c.quaternion.setFromUnitVectors(up, d); }
    mk(new T.SphereGeometry(0.41, 16, 12), '#ece6d0', 0, 0.03, 0, head);
    for (const s of [-1, 1]) mk(new T.SphereGeometry(0.09, 8, 6), '#111111', s * 0.14, 0.06, 0.32, head);
    for (let i = -2; i <= 2; i++) mk(BX(0.05, 0.08, 0.04), '#ffffff', i * 0.06, -0.2, 0.37, head);
  }
}

// --- Icônes des objets (vignettes de la boutique, canevas 160 x 120) ---
function drawItemIcon(g, id) {
  const it = ITEMS[id];
  g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = 4;
  const poly = (pts, fill) => { g.fillStyle = fill; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); g.stroke(); };
  g.fillStyle = 'rgba(29,18,56,.25)'; g.beginPath(); g.ellipse(80, 104, 50, 9, 0, 0, TAU); g.fill();
  if (it.slot === 'hat') {
    if (it.look === 'wool') {
      g.strokeStyle = INK; g.lineWidth = 15; for (const s of [-1, 1]) { g.beginPath(); g.arc(80 + s * 44, 72, 13, s > 0 ? -1.2 : Math.PI - 1.9, s > 0 ? 1.9 : Math.PI + 1.2); g.stroke(); }
      g.strokeStyle = '#3b5ea8'; g.lineWidth = 9; for (const s of [-1, 1]) { g.beginPath(); g.arc(80 + s * 44, 72, 13, s > 0 ? -1.2 : Math.PI - 1.9, s > 0 ? 1.9 : Math.PI + 1.2); g.stroke(); }
      g.strokeStyle = INK; g.lineWidth = 4;
      for (const [x, y, r] of [[58, 76, 20], [80, 62, 26], [102, 76, 20], [70, 44, 16], [92, 44, 16], [80, 84, 18]]) { g.fillStyle = '#fffbe8'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke(); }
      g.fillStyle = '#ffffff'; for (const [x, y] of [[74, 54], [64, 70]]) { g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill(); }
    } else if (it.look === 'brim') {
      g.fillStyle = '#8a5634'; g.beginPath(); g.ellipse(80, 84, 66, 15, 0, 0, TAU); g.fill(); g.stroke();
      poly([[46, 82], [52, 34], [80, 26], [108, 34], [114, 82]], '#6b4430');
      g.fillStyle = '#d9472f'; g.fillRect(48, 64, 64, 12); g.strokeRect(48, 64, 64, 12);
      g.strokeStyle = '#ffd23f'; g.lineWidth = 4; g.beginPath(); g.moveTo(104, 64); g.quadraticCurveTo(130, 30, 122, 16); g.stroke();
    } else if (it.look === 'rock') {
      poly([[30, 86], [34, 46], [56, 22], [92, 18], [122, 40], [130, 86], [108, 94], [52, 94]], '#b8a888');
      poly([[56, 22], [70, 50], [92, 18]], '#a89878'); poly([[34, 46], [70, 50], [52, 94], [30, 86]], '#c2b290');
      g.fillStyle = '#ff8a1f'; g.shadowColor = '#ff8a1f'; g.shadowBlur = 12; g.fillRect(62, 62, 52, 9); g.shadowBlur = 0;
      g.fillStyle = '#5fbf4a'; for (const [x, y] of [[44, 40], [52, 34], [112, 36]]) { g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill(); }
    } else if (it.look === 'dragon') {
      for (const s of [-1, 1]) poly([[80 + s * 30, 44], [80 + s * 66, 6], [80 + s * 50, 46]], '#f2e3c2');
      g.fillStyle = '#8e2121'; g.beginPath(); g.ellipse(80, 66, 46, 40, 0, Math.PI, TAU); g.lineTo(126, 92); g.lineTo(34, 92); g.closePath(); g.fill(); g.stroke();
      for (let i = 0; i < 5; i++) poly([[60 + i * 10, 30 - (i === 2 ? 6 : 0) + Math.abs(i - 2) * 4], [64 + i * 10, 14 + Math.abs(i - 2) * 6], [68 + i * 10, 30 + Math.abs(i - 2) * 4]], '#ffc83d');
      poly([[46, 92], [80, 76], [114, 92], [80, 104]], '#5a1c1c');
      g.fillStyle = '#ff8a1f'; g.shadowColor = '#ff7a1f'; g.shadowBlur = 14; g.fillRect(54, 60, 52, 8); g.shadowBlur = 0;
    }
  } else if (it.slot === 'cape') {
    g.fillStyle = it.col; g.beginPath(); g.moveTo(58, 22); g.lineTo(102, 22); g.quadraticCurveTo(124, 60, 132, 98);
    for (let i = 0; i <= 4; i++) g.lineTo(132 - i * 26, 98 + (i % 2 ? 8 : 0));
    g.quadraticCurveTo(36, 60, 58, 22); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(0,0,0,.14)'; g.beginPath(); g.moveTo(80, 26); g.quadraticCurveTo(94, 64, 98, 100); g.lineTo(80, 104); g.quadraticCurveTo(76, 64, 80, 26); g.fill();
    g.fillStyle = it.trim; g.fillRect(54, 14, 52, 12); g.strokeRect(54, 14, 52, 12);
    g.strokeStyle = it.trim; g.lineWidth = 5; g.beginPath(); g.moveTo(32, 96); g.lineTo(130, 96); g.stroke();
    if (it.flame) { g.strokeStyle = INK; g.lineWidth = 2; for (let i = 0; i < 6; i++) poly([[36 + i * 18, 100], [44 + i * 18, 118 - (i % 2) * 6], [52 + i * 18, 100]], i % 2 ? '#ffd23f' : '#ff8a1f'); }
  } else {
    for (const ox of [0, 46]) {
      poly([[28 + ox, 24], [58 + ox, 24], [60 + ox, 78], [80 + ox, 84], [82 + ox, 98], [26 + ox, 98]], it.col);
      g.fillStyle = it.trim; g.fillRect(26 + ox, 20, 34, 12); g.strokeRect(26 + ox, 20, 34, 12);
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(28 + ox, 88, 52, 8);
      if (it.claws) poly([[78 + ox, 86], [92 + ox, 92], [80 + ox, 96]], '#ffc83d');
      if (it.id === 'bottesS' || it.trim === '#c98aff') { g.fillStyle = '#c98aff'; poly([[30 + ox, 40], [18 + ox, 34], [30 + ox, 50]], '#e8dcff'); }
    }
  }
}
// Illustrations peintes (planches générées puis détourées) : cartes de la garde-robe, textures des capes et des armes 3D
const ART_SRC = {
  bonnet: 'art/bonnet.webp',
  aventu: 'art/aventu.webp',
  craq: 'art/craq.webp',
  dHelm: 'art/dHelm.webp',
  capeB: 'art/capeB.webp',
  capeA: 'art/capeA.webp',
  capeT: 'art/capeT.webp',
  dCape: 'art/dCape.webp',
  bottesL: 'art/bottesL.webp',
  bottesT: 'art/bottesT.webp',
  bottesS: 'art/bottesS.webp',
  dBoots: 'art/dBoots.webp',
  g_dragon: 'art/g_dragon.webp',
  g_standard: 'art/g_standard.webp',
  g_bois: 'art/g_bois.webp',
  g_arcenciel: 'art/g_arcenciel.webp',
  g_neon: 'art/g_neon.webp',
  g_ion: 'art/g_ion.webp',
  g_spectre: 'art/g_spectre.webp',
  g_souverain: 'art/g_souverain.webp',
  oh1: 'art/oh1.webp',
  oh2: 'art/oh2.webp',
  oh3: 'art/oh3.webp',
  oh4: 'art/oh4.webp',
  oh5: 'art/oh5.webp',
  oh6: 'art/oh6.webp',
  oh7: 'art/oh7.webp',
  oh8: 'art/oh8.webp',
  oh9: 'art/oh9.webp',
  oh10: 'art/oh10.webp',
  oc1: 'art/oc1.webp',
  oc2: 'art/oc2.webp',
  oc3: 'art/oc3.webp',
  oc4: 'art/oc4.webp',
  oc5: 'art/oc5.webp',
  oc6: 'art/oc6.webp',
  oc7: 'art/oc7.webp',
  oc8: 'art/oc8.webp',
  oc9: 'art/oc9.webp',
  oc10: 'art/oc10.webp',
  ob1: 'art/ob1.webp',
  ob2: 'art/ob2.webp',
  ob3: 'art/ob3.webp',
  ob4: 'art/ob4.webp',
  ob5: 'art/ob5.webp',
  ob6: 'art/ob6.webp',
  ob7: 'art/ob7.webp',
  ob8: 'art/ob8.webp',
  ob9: 'art/ob9.webp',
  ob10: 'art/ob10.webp',
  tab_gear: 'art/tab_gear.webp',
  tab_weapon: 'art/tab_weapon.webp',
  tab_pet: 'art/tab_pet.webp',
  tab_cosm: 'art/tab_cosm.webp',
  tab_look: 'art/tab_look.webp',
  wardrobe_bg: 'art/wardrobe_bg.webp',
};
const ART_DIM = {"bonnet":[243,217],"aventu":[232,201],"craq":[207,206],"dHelm":[219,245],"capeB":[226,275],"capeA":[233,270],"capeT":[240,277],"dCape":[232,270],"bottesL":[220,202],"bottesT":[236,202],"bottesS":[225,205],"dBoots":[221,205],"g_dragon":[481,217],"g_standard":[480,193],"g_bois":[480,199],"g_arcenciel":[480,199],"g_neon":[480,210],"g_ion":[480,199],"g_spectre":[480,199],"g_souverain":[480,227],"boufton":[289,269],"piou":[225,247],"chacha":[296,269],"wabbit":[221,299],"panda":[256,273],"glacon":[211,284],"bwak":[287,270],"dragon":[270,283],"dragon_rouge":[272,285],"oh1":[208,248],"oh2":[205,243],"oh3":[211,278],"oh4":[248,243],"oh5":[256,218],"oh6":[162,278],"oh7":[240,230],"oh8":[189,268],"oh9":[213,207],"oh10":[263,215],"oc1":[160,318],"oc2":[172,319],"oc3":[171,320],"oc4":[227,320],"oc5":[221,318],"oc6":[220,320],"oc7":[235,320],"oc8":[236,320],"oc9":[228,320],"oc10":[224,320],"ob1":[245,225],"ob2":[238,299],"ob3":[251,282],"ob4":[250,300],"ob5":[244,296],"ob6":[251,274],"ob7":[234,300],"ob8":[238,300],"ob9":[231,300],"ob10":[241,300],"tab_gear":[272,300],"tab_weapon":[279,300],"tab_pet":[281,300],"tab_cosm":[280,300],"tab_look":[273,300]};
// Silhouette de chaque arme (points du contour, en largeur d'image), point de la main et couleur des tranches
const GUN3D = {"dragon":{"ar":0.4511,"a":[0.384,0.396],"side":"#7a492f","p":[[0.9875,0.7097],[0.9751,0.7742],[0.9356,0.8433],[0.9231,0.8433],[0.9231,0.8018],[0.9189,0.7926],[0.9002,0.7926],[0.8898,0.8018],[0.8732,0.8433],[0.8586,0.8525],[0.8545,0.8802],[0.8378,0.8986],[0.8316,0.8756],[0.8212,0.8756],[0.8067,0.9171],[0.7921,0.9124],[0.79,0.894],[0.7443,0.9217],[0.7193,0.977],[0.7131,0.9724],[0.7131,0.9032],[0.6944,0.9124],[0.6715,0.9677],[0.6632,0.9631],[0.6632,0.9217],[0.6715,0.8664],[0.6819,0.8387],[0.6798,0.8157],[0.6507,0.8111],[0.6383,0.8479],[0.6154,0.8664],[0.6133,0.8157],[0.6008,0.8111],[0.5842,0.8664],[0.5696,0.894],[0.5572,0.894],[0.5551,0.9078],[0.5343,0.8986],[0.5426,0.8295],[0.526,0.8203],[0.5073,0.8756],[0.4636,0.9124],[0.4595,0.8986],[0.4678,0.8479],[0.4636,0.7972],[0.4553,0.7972],[0.4345,0.8571],[0.4179,0.871],[0.4012,0.8618],[0.4012,0.8018],[0.395,0.7926],[0.3784,0.7972],[0.368,0.8295],[0.343,0.8479],[0.3326,0.8387],[0.3285,0.7788],[0.3077,0.7742],[0.2973,0.7926],[0.2723,0.788],[0.2744,0.7235],[0.2703,0.7143],[0.2349,0.7235],[0.2308,0.659],[0.2162,0.659],[0.21,0.6774],[0.1975,0.682],[0.185,0.6498],[0.1663,0.6636],[0.1435,0.6636],[0.0769,0.6406],[0.0291,0.6452],[0.0208,0.6359],[0.0104,0.6083],[0.0104,0.5438],[0.0249,0.3825],[0.0249,0.2258],[0.0312,0.2028],[0.052,0.1935],[0.1185,0.2719],[0.2183,0.4332],[0.2391,0.4562],[0.2557,0.4562],[0.2703,0.4286],[0.2703,0.3963],[0.2183,0.2442],[0.2121,0.1705],[0.2204,0.1382],[0.262,0.0876],[0.2952,0.0691],[0.3056,0.0737],[0.3181,0.106],[0.3181,0.2074],[0.3326,0.2488],[0.3347,0.2857],[0.341,0.2995],[0.3971,0.2995],[0.4179,0.3318],[0.4262,0.3318],[0.447,0.1705],[0.4719,0.0737],[0.4782,0.0046],[0.5156,0.0046],[0.5198,0.023],[0.5468,0.0507],[0.5946,0.1336],[0.5904,0.1751],[0.5717,0.2074],[0.5468,0.3456],[0.5468,0.3871],[0.5634,0.4055],[0.6029,0.4101],[0.6195,0.4332],[0.659,0.4286],[0.6715,0.447],[0.6861,0.4378],[0.7193,0.4424],[0.7235,0.4147],[0.7401,0.4194],[0.7526,0.4378],[0.7692,0.4378],[0.7817,0.4194],[0.8067,0.4194],[0.842,0.4009],[0.8649,0.3733],[0.8815,0.318],[0.9044,0.318],[0.9252,0.3364],[0.9439,0.3779],[0.9459,0.4009],[0.9418,0.4147],[0.9439,0.4654],[0.9293,0.4747],[0.9231,0.5115],[0.9127,0.5115],[0.9127,0.4931],[0.9064,0.4839],[0.8919,0.4931],[0.8919,0.5161],[0.9064,0.5253],[0.9106,0.5392],[0.9106,0.5622],[0.9002,0.576],[0.9002,0.6037],[0.9106,0.6267],[0.9189,0.6267],[0.9231,0.5576],[0.9356,0.5576],[0.9522,0.5945],[0.9647,0.5991],[0.9709,0.6221],[0.9875,0.6313]]},"standard":{"ar":0.4021,"a":[0.388,0.45],"side":"#3c4f5e","p":[[0.0229,0.2746],[0.0271,0.2383],[0.0354,0.2228],[0.0604,0.228],[0.1167,0.3005],[0.2146,0.4819],[0.2375,0.513],[0.2521,0.5181],[0.2708,0.4819],[0.2708,0.4508],[0.2188,0.2435],[0.2146,0.1917],[0.225,0.1451],[0.2792,0.0881],[0.3063,0.0829],[0.3187,0.1192],[0.3146,0.1969],[0.3354,0.2902],[0.3396,0.3368],[0.4021,0.3368],[0.4188,0.3731],[0.4271,0.3731],[0.4479,0.2021],[0.4729,0.0829],[0.4792,0.0052],[0.5167,0.0052],[0.5188,0.0207],[0.5708,0.0933],[0.5958,0.1503],[0.5958,0.1917],[0.5729,0.2383],[0.5458,0.4145],[0.5479,0.4456],[0.5687,0.4611],[0.6021,0.4611],[0.6333,0.4974],[0.7688,0.5026],[0.7937,0.513],[0.8042,0.5389],[0.8562,0.5389],[0.8708,0.5855],[0.875,0.6373],[0.9771,0.6425],[0.9896,0.6891],[0.9875,0.7979],[0.975,0.8497],[0.9479,0.8653],[0.9479,0.9326],[0.9417,0.9482],[0.9146,0.9378],[0.8854,0.8497],[0.5813,0.8446],[0.5625,0.8808],[0.4042,0.8756],[0.3979,0.9275],[0.3875,0.9585],[0.3396,0.9741],[0.3312,0.9585],[0.3146,0.8756],[0.3,0.8653],[0.2458,0.7617],[0.2375,0.7617],[0.2104,0.7202],[0.1875,0.715],[0.1667,0.7461],[0.0208,0.715],[0.0104,0.6684],[0.0104,0.6114],[0.0229,0.456]]},"bois":{"ar":0.4146,"a":[0.388,0.465],"side":"#803f2a","p":[[0.025,0.2714],[0.0292,0.2513],[0.0396,0.2412],[0.0708,0.2513],[0.0729,0.2663],[0.1104,0.3116],[0.2083,0.4874],[0.2354,0.5226],[0.2542,0.5276],[0.2687,0.5025],[0.2708,0.4623],[0.2333,0.3467],[0.2146,0.2362],[0.2167,0.191],[0.2333,0.1558],[0.2729,0.1156],[0.3083,0.1106],[0.3187,0.1457],[0.3167,0.2412],[0.3417,0.3518],[0.3979,0.3518],[0.4188,0.392],[0.4271,0.392],[0.4479,0.2211],[0.4729,0.1055],[0.475,0.0603],[0.4833,0.0302],[0.4979,0.0251],[0.5563,0.0955],[0.5958,0.1809],[0.5917,0.2211],[0.575,0.2462],[0.5479,0.402],[0.5479,0.4523],[0.6042,0.4774],[0.6292,0.5075],[0.6583,0.5226],[0.7833,0.5276],[0.7896,0.5126],[0.8125,0.5126],[0.825,0.5477],[0.85,0.5477],[0.8667,0.5628],[0.8771,0.6482],[0.9771,0.6482],[0.9896,0.7236],[0.9875,0.804],[0.9792,0.8492],[0.9479,0.8593],[0.95,0.9296],[0.9437,0.9497],[0.9187,0.9397],[0.8875,0.8543],[0.8229,0.8543],[0.8146,0.8794],[0.7896,0.8794],[0.7792,0.8543],[0.5813,0.8543],[0.5646,0.8945],[0.5479,0.8945],[0.5417,0.8794],[0.4083,0.8794],[0.4,0.8945],[0.3958,0.9397],[0.375,0.9698],[0.3417,0.9749],[0.3312,0.9648],[0.3167,0.8794],[0.2979,0.8693],[0.2542,0.7839],[0.2271,0.7588],[0.2229,0.7387],[0.2125,0.7286],[0.1854,0.7236],[0.1646,0.7538],[0.0813,0.7286],[0.0208,0.7337],[0.0104,0.6834],[0.0104,0.6231],[0.025,0.4422]]},"arcenciel":{"ar":0.4146,"a":[0.389,0.465],"side":"#c6afc1","p":[[0.0229,0.2864],[0.0271,0.2613],[0.0396,0.2412],[0.0583,0.2462],[0.1104,0.3116],[0.2146,0.4975],[0.2521,0.5327],[0.2708,0.4975],[0.2708,0.4623],[0.2188,0.2663],[0.2167,0.191],[0.25,0.1357],[0.3042,0.1055],[0.3187,0.1407],[0.3146,0.2211],[0.3417,0.3518],[0.3958,0.3467],[0.4188,0.392],[0.4271,0.392],[0.4458,0.2362],[0.475,0.1005],[0.475,0.0603],[0.4854,0.0302],[0.4979,0.0251],[0.5521,0.0905],[0.5813,0.1357],[0.5958,0.1759],[0.5917,0.2161],[0.5729,0.2563],[0.5458,0.4221],[0.55,0.4623],[0.5729,0.4774],[0.6042,0.4774],[0.6375,0.5126],[0.7833,0.5176],[0.8021,0.5477],[0.8479,0.5427],[0.8667,0.5729],[0.875,0.6482],[0.9729,0.6432],[0.9875,0.6935],[0.9875,0.799],[0.9771,0.8492],[0.9479,0.8593],[0.9479,0.9397],[0.9229,0.9447],[0.8812,0.8492],[0.6396,0.8492],[0.6312,0.8894],[0.6208,0.8794],[0.6125,0.8492],[0.5792,0.8492],[0.5729,0.8693],[0.5563,0.8844],[0.4042,0.8794],[0.3937,0.9497],[0.3417,0.9749],[0.3312,0.9548],[0.3167,0.8794],[0.2771,0.8392],[0.2708,0.8141],[0.2458,0.7688],[0.2104,0.7286],[0.1854,0.7236],[0.1729,0.7538],[0.0833,0.7286],[0.0292,0.7337],[0.0187,0.7186],[0.0104,0.6834],[0.0104,0.6231],[0.0229,0.4673]]},"neon":{"ar":0.4375,"a":[0.385,0.435],"side":"#30402c","p":[[0.9875,0.7619],[0.975,0.8048],[0.95,0.8143],[0.9458,0.8952],[0.9229,0.8952],[0.8854,0.8048],[0.8104,0.8048],[0.8021,0.8238],[0.7708,0.8238],[0.7625,0.8],[0.7375,0.8],[0.7292,0.8429],[0.7271,0.9048],[0.7125,0.9571],[0.7,0.9714],[0.4625,0.9714],[0.4479,0.9619],[0.4354,0.9333],[0.4229,0.8286],[0.4042,0.8286],[0.3896,0.9],[0.3542,0.919],[0.3396,0.919],[0.3187,0.8333],[0.3021,0.819],[0.2792,0.8381],[0.2729,0.8667],[0.2625,0.881],[0.2479,0.881],[0.2313,0.8381],[0.2354,0.8048],[0.2458,0.7857],[0.2437,0.7381],[0.2208,0.7333],[0.2146,0.7143],[0.1604,0.7048],[0.1417,0.6905],[0.0521,0.6857],[0.0354,0.6952],[0.0146,0.6667],[0.0104,0.5952],[0.025,0.4143],[0.025,0.2571],[0.0333,0.2333],[0.0542,0.2286],[0.0979,0.281],[0.1354,0.3429],[0.1437,0.3429],[0.1708,0.2476],[0.2042,0.2095],[0.2354,0.1476],[0.2729,0.1095],[0.3063,0.1],[0.3187,0.1381],[0.3146,0.2143],[0.3354,0.2952],[0.3396,0.3333],[0.3979,0.3333],[0.4188,0.3667],[0.4271,0.3667],[0.4458,0.2238],[0.4729,0.1],[0.4729,0.0667],[0.4875,0.0238],[0.4979,0.0238],[0.5479,0.081],[0.5813,0.1333],[0.5958,0.1714],[0.5917,0.2048],[0.5729,0.2429],[0.5604,0.3],[0.5458,0.4],[0.5479,0.4333],[0.5687,0.4476],[0.5813,0.481],[0.6021,0.4905],[0.7458,0.4905],[0.7771,0.4762],[0.7688,0.3905],[0.7771,0.3714],[0.7937,0.3667],[0.8042,0.3762],[0.8042,0.4143],[0.7917,0.4905],[0.8104,0.5429],[0.8146,0.6143],[0.8708,0.6143],[0.8938,0.5714],[0.9313,0.5619],[0.9521,0.6095],[0.9729,0.6095],[0.9812,0.6238],[0.9896,0.681]]},"ion":{"ar":0.4146,"a":[0.388,0.463],"side":"#87a2ac","p":[[0.0229,0.2814],[0.0333,0.2462],[0.0542,0.2412],[0.1229,0.3317],[0.2208,0.5075],[0.2521,0.5276],[0.2687,0.5025],[0.2687,0.4523],[0.2354,0.3367],[0.2292,0.3317],[0.2271,0.2965],[0.2167,0.2563],[0.2146,0.206],[0.225,0.1658],[0.2792,0.1106],[0.3083,0.1055],[0.3187,0.1256],[0.3146,0.2211],[0.3354,0.3065],[0.3396,0.3518],[0.4,0.3518],[0.4188,0.3869],[0.4271,0.3869],[0.4562,0.1658],[0.4729,0.1055],[0.4771,0.0402],[0.5,0.0251],[0.5729,0.1206],[0.5958,0.1759],[0.5917,0.2211],[0.575,0.2513],[0.575,0.2714],[0.5687,0.2764],[0.5458,0.4221],[0.5458,0.4472],[0.5521,0.4623],[0.5708,0.4774],[0.5979,0.4724],[0.6333,0.5075],[0.7792,0.5126],[0.7937,0.5226],[0.8042,0.5477],[0.8521,0.5477],[0.8667,0.5729],[0.875,0.6432],[0.9771,0.6482],[0.9875,0.6935],[0.9896,0.7739],[0.9771,0.8442],[0.9479,0.8543],[0.9479,0.9397],[0.9187,0.9347],[0.9042,0.9095],[0.9042,0.8945],[0.8854,0.8492],[0.5813,0.8442],[0.5708,0.8744],[0.4042,0.8794],[0.3958,0.9347],[0.3875,0.9548],[0.3438,0.9749],[0.3292,0.9548],[0.3146,0.8744],[0.2979,0.8643],[0.25,0.7739],[0.2104,0.7286],[0.1792,0.7337],[0.1562,0.7538],[0.0917,0.7286],[0.0208,0.7236],[0.0104,0.6784],[0.0104,0.6231],[0.025,0.4171]]},"spectre":{"ar":0.4146,"a":[0.388,0.465],"side":"#50415f","p":[[0.025,0.2764],[0.0417,0.2412],[0.0667,0.2563],[0.1313,0.3467],[0.2167,0.5025],[0.2396,0.5276],[0.2562,0.5276],[0.2708,0.4975],[0.2708,0.4673],[0.2375,0.3568],[0.2146,0.2513],[0.2146,0.206],[0.2229,0.1759],[0.2583,0.1307],[0.3042,0.1055],[0.3187,0.1457],[0.3167,0.2312],[0.3604,0.2211],[0.3917,0.2814],[0.4125,0.2915],[0.4229,0.2764],[0.4167,0.196],[0.4562,0.1759],[0.4729,0.1055],[0.4792,0.0452],[0.4875,0.0251],[0.4979,0.0251],[0.5292,0.0553],[0.5958,0.1759],[0.5854,0.2563],[0.6146,0.3166],[0.6062,0.407],[0.6396,0.4523],[0.6646,0.4523],[0.6854,0.402],[0.7229,0.397],[0.7625,0.4322],[0.8125,0.5176],[0.8438,0.5025],[0.8667,0.5126],[0.9,0.5729],[0.9083,0.6432],[0.9771,0.6482],[0.9896,0.7186],[0.9875,0.799],[0.9771,0.8442],[0.95,0.8543],[0.9458,0.9397],[0.9208,0.9347],[0.8875,0.8492],[0.75,0.8492],[0.7188,0.9146],[0.7146,0.9095],[0.7354,0.8744],[0.7333,0.8442],[0.6979,0.8442],[0.6958,0.8543],[0.5792,0.8492],[0.5646,0.8794],[0.5396,0.8844],[0.4062,0.8794],[0.4,0.8945],[0.3958,0.9397],[0.3854,0.9598],[0.3417,0.9749],[0.3312,0.9598],[0.325,0.9095],[0.3146,0.8844],[0.3021,0.8794],[0.25,0.7789],[0.2083,0.7286],[0.1875,0.7286],[0.1667,0.7588],[0.1437,0.7588],[0.1417,0.7487],[0.0833,0.7387],[0.0813,0.7487],[0.075,0.7286],[0.025,0.7286],[0.0104,0.6784],[0.025,0.4372]]},"souverain":{"ar":0.4729,"a":[0.388,0.406],"side":"#c19a50","p":[[0.9875,0.7093],[0.9729,0.7445],[0.95,0.7533],[0.9458,0.8238],[0.9208,0.8194],[0.9,0.7885],[0.8875,0.7445],[0.5771,0.7489],[0.5625,0.7709],[0.5375,0.7753],[0.5458,0.8238],[0.5437,0.8722],[0.55,0.8855],[0.5521,0.9163],[0.5479,0.9251],[0.5229,0.9163],[0.5167,0.9383],[0.4979,0.9251],[0.4896,0.9692],[0.4792,0.978],[0.4688,0.9692],[0.4625,0.9251],[0.4417,0.9339],[0.4375,0.9119],[0.4104,0.9207],[0.4125,0.8326],[0.4208,0.8018],[0.4188,0.7709],[0.4062,0.7709],[0.3979,0.7974],[0.3979,0.8194],[0.3875,0.837],[0.3375,0.8546],[0.3312,0.8458],[0.3167,0.7753],[0.2833,0.7445],[0.2812,0.7313],[0.2667,0.7225],[0.2521,0.6828],[0.2083,0.6388],[0.1875,0.6388],[0.1708,0.6608],[0.1437,0.6608],[0.0708,0.6388],[0.0333,0.6432],[0.0104,0.63],[0.0104,0.5507],[0.0229,0.4185],[0.0229,0.2467],[0.0312,0.2159],[0.0646,0.2203],[0.1479,0.326],[0.1542,0.348],[0.1729,0.3656],[0.2104,0.4317],[0.2333,0.4581],[0.2521,0.4626],[0.2667,0.4405],[0.2667,0.3965],[0.25,0.3612],[0.2188,0.2467],[0.2146,0.1806],[0.2229,0.1498],[0.2583,0.1101],[0.3063,0.0925],[0.3187,0.1233],[0.3146,0.1982],[0.3396,0.3084],[0.3979,0.3084],[0.4188,0.3392],[0.4271,0.3392],[0.4458,0.2026],[0.4667,0.1189],[0.475,0.0396],[0.4875,0.022],[0.5,0.022],[0.5771,0.1057],[0.5958,0.1542],[0.5896,0.2026],[0.5708,0.2379],[0.55,0.3392],[0.5458,0.3921],[0.5521,0.4053],[0.5979,0.4141],[0.6354,0.4449],[0.7812,0.4493],[0.7958,0.4581],[0.8042,0.4802],[0.8542,0.4802],[0.8667,0.4934],[0.875,0.5595],[0.9729,0.5595],[0.9833,0.5771],[0.9875,0.6035]]}};
// Modèles 3D importés, compressés (meshopt) : chauve-souris, canards, carnotaure, chat, renard, diablotin,
// cocatrix, tigre sorcier, fantôme, chat voyageur, renard à lunettes,
// et une sélection d'objets et de plantes des packs Quaternius (CC0) pour décorer le village
const MODEL_SRC = {};
// ---------- Modèles 3D importés (téléchargés puis allégés) : chargés pendant l'écran de chargement ----------
// h = hauteur voulue, rot = rotation pour qu'ils regardent devant (+z), light = éclaircir une texture trop sombre
// boss/*.bin : modèles CGTrader chiffrés (licence : le joueur ne doit pas pouvoir les récupérer tels quels)
const MODEL_FILES = { hat_frog: 'models/equip/frog_hat.glb', hat_pumpkin: 'models/equip/pumpkin.glb', boots_pair: 'models/equip/boots.glb', h_knight: 'models/heroes/knight.glb', h_barbarian: 'models/heroes/barbarian.glb', h_mage: 'models/heroes/mage.glb', h_rogue: 'models/heroes/rogue.glb', h_rogue_hooded: 'models/heroes/rogue_hooded.glb', skel: 'models/skeleton.glb', ghoul: 'models/ghoul.glb', mount_carno: 'models/mounts/carno.glb', mount_fel: 'models/mounts/fel.glb', mount_dragon: 'models/mounts/dragon.glb', boss_creep: 'models/boss/creep.bin', boss_guard: 'models/boss/guard.bin', w_viking: 'models/boss/w_viking.bin', w_roman: 'models/boss/w_roman.bin', w_egypt: 'models/boss/w_egypt.bin', goblin: 'models/goblin.glb', dungeon_orc:'models/dungeon/orc_skull.glb', dungeon_shaman:'models/dungeon/tribal.glb' };
for(const id of ["body_female", "body_male", "hair_beard", "hair_buns", "hair_buzzed", "hair_buzzedfemale", "hair_long", "hair_simpleparted", "head_female", "head_male", "peasant_female", "peasant_male", "ranger_female", "ranger_male"])MODEL_FILES['q_'+id]='models/characters/'+id+'.glb';
for(const id of ["hat_cap", "hat_cowboy", "hat_fox", "hat_witch", "hat_sombrero", "gun_revolver", "gun_assault", "pet_chacha", "pet_renard", "pet_bwak", "pet_piou", "pet_boufton", "pet_wabbit", "pet_panda", "pet_glacon", "pet_bat", "pet_imp", "pet_dragon", "um_boss_mushking", "um_boss_tiki", "um_boss_demon", "um_boss_dragon", "um_blob", "um_mushnub", "um_pinkblob", "um_ninja", "um_bee", "um_wizard", "um_cactoro", "um_yeti", "um_orc", "canards", "chat", "tigre", "chatbleu", "renardlunettes", "props", "medieval", "interior", "camp", "nature2", "chest", "puglin", "imp2", "bunker"])MODEL_FILES[id]='models/'+id+'.glb';
const MODEL_CFG = {
  mount_carno: { h: 2.8, rot: 0, light: 1.5 }, mount_fel: { h: 3.4, rot: 0, light: 1.3 }, mount_dragon: { h: 4.2, rot: 0, light: 1.2 },
  boss_creep: { h: 2.3, rot: 0, light: 0.8 }, boss_guard: { h: 2.3, rot: 0 },
  goblin: { h: 1.45, rot: 0 }, dungeon_orc:{h:1.4,rot:0}, dungeon_shaman:{h:1.2,rot:0},
  canards: { h: 0.75, rot: 0 },
  chat:    { h: 1.5, rot: -Math.PI / 2, statue: '#c9c1ae' },
  tigre:   { h: 2.0, rot: 0, light: 1.25 },
  chatbleu: { h: 1.7, rot: 0 },
  renardlunettes: { h: 2.0, rot: 0 },
  props:   { raw: true },
  medieval: { raw: true },
  interior: { raw: true },
  nature2: { raw: true },
  camp:    { raw: true },
  chest:   { h: 0.7, rot: 0 },
  w_viking: { h: 2.55, rot: 0, light: 1.1 },
  w_roman:  { h: 2.55, rot: 0, light: 1.1 },
  w_egypt:  { h: 2.45, rot: 0, light: 1.1 },
  bunker:  { raw: true, light: 1.15 },
  puglin:  { h: 1.5, rot: 0 },
  imp2:    { h: 1.6, rot: 0 },
  um_blob: { h: 1, rot: 0 },
  // couleurs enregistrées en « linéaire » dans ces fichiers : on les remet comme prévu par l'auteur
  gun_revolver: { srgb: true }, gun_assault: { srgb: true },
  hat_cap: { srgb: true, light: 1.6 }, hat_cowboy: { srgb: true }, hat_fox: { srgb: true }, hat_witch: { srgb: true },
  pet_chacha: { h: 0.75, rot: 0 },
  pet_renard: { h: 0.75, rot: 0 },
  pet_bwak: { h: 0.75, rot: 0 },
  pet_piou: { h: 0.8, rot: 0 },
  pet_boufton: { h: 0.85, rot: 0 },
  pet_wabbit: { h: 1.0, rot: 0 },
  pet_panda: { h: 0.8, rot: 0 },
  pet_glacon: { h: 0.85, rot: 0 },
  pet_bat: { h: 0.85, rot: 0 },
  pet_imp: { h: 0.85, rot: 0 },
  pet_dragon: { h: 1.0, rot: 0 },
  um_boss_mushking: { h: 2.2, rot: 0 },
  um_boss_tiki: { h: 2.2, rot: 0 },
  um_boss_demon: { h: 2.2, rot: 0 },
  um_boss_dragon: { h: 2.4, rot: 0 },
  um_mushnub: { h: 1, rot: 0 },
  um_pinkblob: { h: 1, rot: 0 },
  um_ninja: { h: 1, rot: 0 },
  um_bee: { h: 1, rot: 0 },
  um_wizard: { h: 1, rot: 0 },
  um_cactoro: { h: 1, rot: 0 },
  um_yeti: { h: 1, rot: 0 },
  um_orc: { h: 1, rot: 0 },
  skel: { h: 1.45, rot: 0, clip: 'idle' },
  ghoul: { h: 1, rot: 0, clip: 'Walk' },
  // équipements : Chapeau Grenouille (J-Toastie, CC BY), citrouille (KayKit Halloween, CC0), bottes (Isa Lousberg, CC0)
  hat_frog: {}, hat_pumpkin: {}, boots_pair: {},
  // aventuriers jouables (KayKit Adventurers, CC0)
  h_knight: { h: 2.4, rot: 0, clip: 'Idle' }, h_barbarian: { h: 2.4, rot: 0, clip: 'Idle' }, h_mage: { h: 2.4, rot: 0, clip: 'Idle' }, h_rogue: { h: 2.4, rot: 0, clip: 'Idle' }, h_rogue_hooded: { h: 2.4, rot: 0, clip: 'Idle' },   // goule (« Zombie » de Quaternius, CC0)   // squelette du nécromancien (KayKit, CC0)
};
for(const id of Object.keys(MODEL_FILES).filter(k=>k.startsWith('q_')))MODEL_CFG[id]={raw:true};
const MODELS = {};
let modelsP = null;
function modelsReady() {
  if (modelsP) return modelsP;
  return (modelsP = new Promise(res => {
    if (!window.THREE || !THREE.GLTFLoader || !THREE.MeshoptDecoder) { res(); return; }
    THREE.MeshoptDecoder.ready.then(() => {
      const L = new THREE.GLTFLoader(); L.setMeshoptDecoder(THREE.MeshoptDecoder);
      const ids = [...Object.keys(MODEL_SRC), ...Object.keys(MODEL_FILES)]; let left = ids.length;
      const done = () => { if (!--left) res(); };
      ids.forEach(id => {
        if (MODEL_FILES[id] && MODEL_FILES[id].endsWith('.bin')) {
          fetch(MODEL_FILES[id]).then(r => r.arrayBuffer()).then(ab => {
            const b = new Uint8Array(ab), n = b.length - 4, out = new Uint8Array(n); let s = 0x5eed1a7b ^ n;
            for (let i = 0; i < n; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; out[i] = b[i + 4] ^ (s & 255); }
            L.parse(out.buffer, '', g => { try { MODELS[id] = prepModel(id, g); } catch (e) { console.warn(e); } done(); }, e => { console.warn(e); done(); });
          }).catch(e => { console.warn(e); done(); });
          return;
        }
        if (MODEL_FILES[id]) { L.load(MODEL_FILES[id], g => { try { MODELS[id] = prepModel(id, g); } catch (e) { console.warn(e); } done(); }, undefined, e => { console.warn(e); done(); }); return; }
        try {
          const s = atob(MODEL_SRC[id].slice(MODEL_SRC[id].indexOf(',') + 1)), buf = new Uint8Array(s.length);
          for (let i = 0; i < s.length; i++) buf[i] = s.charCodeAt(i);
          L.parse(buf.buffer, '', g => { try { MODELS[id] = prepModel(id, g); } catch (e) { console.warn(e); } done(); }, e => { console.warn(e); done(); });
        } catch (e) { console.warn(e); done(); }
      });
    }, () => res());
  }));
}
// Matériaux passés au rendu du jeu (aplats), taille et position normalisées (pieds au sol, centré)
function prepModel(id, gltf) {
  const T = THREE, C = MODEL_CFG[id] || {}, root = gltf.scene, cache = new Map();
  root.traverse(o => {
    if (!o.isMesh) return;
    const conv = m => {
      if (cache.has(m)) return cache.get(m);
      if (m.map) m.map.encoding = T.LinearEncoding;
      const col = C.statue ? new T.Color(C.statue) : (m.color ? m.color.clone() : new T.Color('#ffffff'));
      if (C.srgb) col.convertLinearToSRGB();
      if (C.light && !C.statue) col.multiplyScalar(C.light);
      const n = new T.MeshToonMaterial({ color: col, map: C.statue ? null : m.map, gradientMap: GRAD, transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest, side: m.side, vertexColors: m.vertexColors }); n.name = m.name;
      if (m.emissiveMap) { m.emissiveMap.encoding = T.LinearEncoding; n.emissive = new T.Color('#ffffff'); n.emissiveMap = m.emissiveMap; }
      cache.set(m, n); return n;
    };
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = !o.isSkinnedMesh;
  });
  if (C.raw) { const parts = {}; root.children.forEach(n => { parts[n.name] = n; }); return { scene: root, clips: gltf.animations, k: 1, c: new T.Vector3(), minY: 0, rot: 0, parts }; }
  // boîte englobante de la pose de départ (on suit les os pour les modèles animés)
  const mixer = new T.AnimationMixer(root);
  const pose = (C.clip && gltf.animations.find(a => a.name === C.clip)) || gltf.animations[0];
  if (pose) { mixer.clipAction(pose).play(); mixer.setTime(0); }
  root.updateMatrixWorld(true);
  const box = new T.Box3(), v = new T.Vector3();
  root.traverse(o => {
    if (o.isSkinnedMesh) { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i += 3) { v.fromBufferAttribute(p, i); o.applyBoneTransform(i, v); v.applyMatrix4(o.matrixWorld); box.expandByPoint(v); } }
    else if (o.isMesh) box.expandByObject(o);
  });
  mixer.stopAllAction();
  const size = box.getSize(new T.Vector3()), c = box.getCenter(new T.Vector3());
  return { scene: root, clips: gltf.animations, k: (C.h || 1) / Math.max(0.001, size.y), c, minY: box.min.y, rot: C.rot || 0 };
}
// Une copie du modèle, prête à poser dans une scène, avec ses animations
function modelInst(id) {
  const M = MODELS[id]; if (!M) return null;
  const T = THREE, root = THREE.cloneSkinned(M.scene), g = new T.Group(), turn = new T.Group(), inner = new T.Group();
  inner.add(root); inner.scale.setScalar(M.k); inner.position.set(-M.c.x * M.k, -M.minY * M.k, -M.c.z * M.k);
  turn.rotation.y = M.rot; turn.add(inner); g.add(turn);
  const mixer = new T.AnimationMixer(root), acts = {};
  for (const c of M.clips) acts[c.name] = mixer.clipAction(c);
  let cur = null;
  const play = (name, fade) => {
    const a = acts[name] || Object.values(acts)[0]; if (!a || a === cur) return;
    a.reset().play(); if (cur && fade) { a.crossFadeFrom(cur, fade, false); } else if (cur) cur.stop();
    cur = a;
  };
  g.userData.inst = { mixer, acts, play, clip: name => (M.clips.find(c => c.name === name) || M.clips[0]) };
  return g;
}

// Un objet du pack (tonneau, enclume…) à la taille du village
const PROP_K = 1.5;
function propInst(name, k) {
  const M = MODELS.props; if (!M || !M.parts[name]) return null;
  // un objet articulé (le coffre et son couvercle) doit garder son propre squelette : avec un simple clone,
  // il restait accroché à celui du modèle d'origine et s'affichait au centre du village, sur la route
  let skinned = false; M.parts[name].traverse(o => { if (o.isSkinnedMesh) skinned = true; });
  const g = skinned ? THREE.cloneSkinned(M.parts[name]) : M.parts[name].clone(true); g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); g.scale.setScalar(PROP_K * (k || 1));
  return g;
}
// Objets posés autour de chaque bâtiment : [objet, devant (× taille), côté (× taille), rotation, taille]
const PROPS_AT = {
  forge:      [['Anvil', 0.45, 1.25, 0.4], ['Whetstone', 0.1, 1.45, -0.5], ['Barrel', -0.35, 1.3, 0], ['Workbench', 0.75, -1.3, 0.2]],
  armurerie:  [['WeaponStand', 0.45, -1.3, 0.3], ['Dummy', 1.05, -1.15, 0.6], ['Crate_Wooden', -0.2, 1.3, 0.4]],
  caserne:    [['Dummy', 0.95, 1.15, -0.5], ['Bench', 0.45, -1.3, Math.PI / 2], ['Barrel_Holder', -0.2, 1.35, 0]],
  labo:       [['Cauldron', 0.5, 1.3, 0]],
  mine:       [['Crate_Metal', 0.35, -1.3, 0.3], ['Bucket_Metal', 0.8, -1.45, 0], ['Barrel', -0.2, -1.35, 0]],
  infirmerie: [['Bucket_Wooden_1', 0.5, 1.3, 0], ['Barrel', 0.1, 1.45, 0]],
  maison:     [['Barrel_Apples', 0.45, -1.3, 0], ['Bench', 0.55, 1.35, Math.PI / 2]],
};
function decorateVillage() {
  if (!MODELS.props) return;
  const put = (name, x, z, ry, k, y) => { const o = propInst(name, k); if (!o) return null; o.position.set(x, y || 0, z); o.rotation.y = ry || 0; V.scene.add(o); (V.cull || (V.cull = [])).push({ o, r: 0 }); return o; };
  for (const id in PROPS_AT) {
    const b = V.bld[id]; if (!b || !BUILD[id]) continue;
    const R = BUILD[id].collide, a = b.group.rotation.y, p = b.group.position;
    const fx = Math.sin(a), fz = Math.cos(a), rx = Math.cos(a), rz = -Math.sin(a);
    for (const [name, f, r, ry, k] of PROPS_AT[id]) {
      const x = p.x + fx * f * R + rx * r * R, z = p.z + fz * f * R + rz * r * R;
      const o = put(name, x, z, a + (ry || 0), k);
      // des fioles sur la table du laboratoire
      if (o && name === 'Table_Large') ['Potion_1', 'Potion_2', 'Potion_4'].forEach((n, i) => put(n, x + rx * (i - 1) * 0.55, z + rz * (i - 1) * 0.55, i, 0.9, 1.25));
    }
  }
  // petit marché de chaque côté de la place
  const face = (x, z) => Math.atan2(PLAZA[0] - x, PLAZA[1] - z);
  const sx = -7.4, sz = 1.2, sa = face(sx, sz);
  put('Stall_Empty', sx, sz, sa);
  put('FarmCrate_Apple', sx + Math.cos(sa) * 1.6, sz - Math.sin(sa) * 1.6, sa + 0.3);
  put('FarmCrate_Carrot', sx - Math.cos(sa) * 1.7, sz + Math.sin(sa) * 1.7, sa - 0.2);
  put('Barrel_Apples', sx - Math.cos(sa) * 2.9, sz + Math.sin(sa) * 2.9, 0);
  put('Stall_Cart_Empty', 7.6, 0.6, face(7.6, 0.6));
  // fleurs, champignons et buissons semés entre les bâtiments (loin des allées et des maisons)
  const R = seeded(4242), plants = ['Mushroom_Common', 'Mushroom_Laetiporus', 'Flower_3_Group', 'Flower_4_Group', 'Bush_Common_Flowers', 'Clover_2', 'Plant_7_Big', 'Fern_1', 'Plant_1_Big', 'Rock_Medium_1'];
  let n = 0;
  for (let tries = 0; tries < 400 && n < 34; tries++) {
    const ang = R() * TAU, rad = 9 + R() * 9.5, x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
    if (Math.abs(x) > WALL - 1.5 || Math.abs(z) > WALL - 1.5) continue;
    let ok = Math.hypot(x - PLAZA[0], z - PLAZA[1]) > 8 && Math.hypot(x - HATCH.x, z - HATCH.z) > 2.5;
    for (const id in V.bld) { const b = V.bld[id], R2 = (BUILD[id] ? BUILD[id].collide : 3) + 2.2; if (Math.hypot(x - b.group.position.x, z - b.group.position.z) < R2 || distToSeg(x, z, PLAZA[0], PLAZA[1], b.ix, b.iz) < 1.6) ok = false; }
    if (!ok) continue;
    const pl = plants[n % plants.length], big = /Mushroom|Rock/.test(pl) ? 0.45 : 0.3;
    put(pl, x, z, R() * TAU, big + R() * 0.15); n++;
  }
}
const KIT_TEX = {"cobble":"textures/jeu/cobble.jpg","stone":"textures/jeu/stone.jpg","tiles":"textures/jeu/tiles.jpg"};
// ---------- Village médiéval : chaque bâtiment est monté avec les pièces du kit « Medieval Village » (Quaternius, CC0) ----------
// nx, nz : largeur et profondeur en modules de 2 m ; low / high : murs du rez-de-chaussée et des étages ; roof : teinte des tuiles
const MED = {
  hdv:        { sc: 0.72, nx: 3, nz: 3, floors: 2, low: 'stone', high: 'plaster', chimney: [1.6, -1.2], tower: { z: -3.6, floors: 3 } },
  maison:     { sc: 0.8,  nx: 2, nz: 3, floors: 2, low: 'stone', high: 'plaster', chimney: [1.15, -1.6], balcony: 1, vine: 1 },
  armurerie:  { sc: 0.75, nx: 3, nz: 3, floors: 1, low: 'stone', high: 'stone', roof: '#e0503a', chimney: [-1.6, -1] },
  forge:      { sc: 0.75, nx: 3, nz: 3, floors: 1, low: 'stone', high: 'stone', roof: '#7a7f99', chimney: [1.8, -1.4] },
  infirmerie: { sc: 0.78, nx: 2, nz: 3, floors: 2, low: 'plaster', high: 'plaster', roof: '#3fbf8f' },
  caserne:    { sc: 0.72, nx: 3, nz: 3, floors: 2, low: 'stone', high: 'plaster' },
  labo:       { sc: 0.8,  nx: 2, nz: 2, floors: 1, low: 'stone', high: 'stone', roof: '#9a5ad9', towerRoof: 1 },
  garde:      { sc: 0.8,  nx: 2, nz: 2, floors: 2, low: 'plaster', high: 'plaster', roof: '#ff6fb0', balcony: 1 },
};
const KIT_WALL = {
  stone:   { plain: 'Wall_UnevenBrick_Straight', door: 'Wall_UnevenBrick_Door_Round', wide: 'Wall_UnevenBrick_Window_Wide_Round', thin: 'Wall_UnevenBrick_Window_Thin_Round', corner: 'Corner_Exterior_Brick' },
  plaster: { plain: 'Wall_Plaster_Straight', door: 'Wall_Plaster_Door_Round', wide: 'Wall_Plaster_Window_Wide_Round', thin: 'Wall_Plaster_Window_Thin_Round', corner: 'Corner_Exterior_Wood' },
};
const KIT_H = 3.12, KIT_ROOF_TOP = { 4: 3.73, 6: 4.89 }, KIT_TOWER_TOP = 6.79;
// Monte un bloc (murs, fenêtres, porte, toit) ; P(nom, x, y, z, rotation) pose une pièce
function kitBlock(P, o, ox, oz) {
  const W = o.nx, D = o.nz, H = KIT_H, xs = [], zs = [];
  for (let i = 0; i < o.nx; i++) xs.push(-W + 1 + i * 2);
  for (let i = 0; i < o.nz; i++) zs.push(-D + 1 + i * 2);
  const doorX = o.door === false ? null : xs.reduce((b, x) => (x <= 0 && Math.abs(x) < Math.abs(b) ? x : b), xs[0]);
  for (let fl = 0; fl < o.floors; fl++) {
    const y = fl * H, K = KIT_WALL[fl ? o.high : o.low];
    const wall = (kind, x, z, ry) => {
      P(K[kind] || K.plain, ox + x, y, oz + z, ry);
      if (kind === 'wide') { P('Window_Wide_Round1', ox + x, y, oz + z, ry); P('WindowShutters_Wide_Round_Open', ox + x, y, oz + z, ry); }
      if (kind === 'thin') { P('Window_Thin_Round1', ox + x, y, oz + z, ry); P('WindowShutters_Thin_Round_Open', ox + x, y, oz + z, ry); }
    };
    // façade : la porte au rez-de-chaussée, des fenêtres partout ailleurs
    for (const x of xs) wall(!fl && x === doorX ? 'door' : 'wide', x, D, 0);
    // arrière : une fenêtre sur deux
    xs.forEach((x, i) => wall(i % 2 ? 'plain' : 'wide', -x, -D, Math.PI));
    // côtés : fenêtres étroites au milieu
    zs.forEach((z, i) => { const k = (i === Math.floor(zs.length / 2)) ? 'thin' : 'plain'; wall(k, -W, -z, -Math.PI / 2); wall(k, W, z, Math.PI / 2); });
    for (const [cx, cz, ry] of [[W, D, 0], [W, -D, Math.PI / 2], [-W, -D, Math.PI], [-W, D, -Math.PI / 2]]) P(K.corner, ox + cx, y, oz + cz, ry);
    if (fl) { for (const x of xs) { P('Wall_BottomCover', ox + x, y, oz + D, 0); P('Wall_BottomCover', ox - x, y, oz - D, Math.PI); } for (const z of zs) { P('Wall_BottomCover', ox - W, y, oz - z, -Math.PI / 2); P('Wall_BottomCover', ox + W, y, oz + z, Math.PI / 2); } }
  }
  if (doorX !== null) P('Door_1_Round', ox + doorX - 0.52, 0, oz + D, 0);
  const top = o.floors * H;
  if (o.towerRoof) P('Roof_Tower_RoundTiles', ox, top, oz, 0);
  else { P(`Roof_RoundTiles_${2 * W}x${2 * D}`, ox, top, oz, 0); P(`Roof_Front_Brick${2 * W}`, ox, top, oz + D, 0); P(`Roof_Front_Brick${2 * W}`, ox, top, oz - D, Math.PI); }
  return top + (o.towerRoof ? KIT_TOWER_TOP : KIT_ROOF_TOP[2 * W]);
}
// Toutes les pièces d'un bâtiment fondues en un seul objet par matière (quelques dessins au lieu de centaines : fluide sur tablette)
function bakeMerged(root, swap) {
  const T = THREE, inv = new T.Matrix4(), M = new T.Matrix4(), N = new T.Matrix3(), v = new T.Vector3(), buckets = new Map();
  root.updateMatrixWorld(true); inv.copy(root.matrixWorld).invert();
  root.traverse(o => { if (!o.isMesh || !o.geometry.attributes.position) return; const m = swap(o.material); if (!buckets.has(m)) buckets.set(m, []); buckets.get(m).push(o); });
  const out = new T.Group();
  for (const [m, list] of buckets) {
    let nv = 0, ni = 0;
    for (const o of list) { const gg = o.geometry; nv += gg.attributes.position.count; ni += gg.index ? gg.index.count : gg.attributes.position.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni);
    const hasCol = list.some(o => o.geometry.attributes.color), col = hasCol ? new Float32Array(nv * 3).fill(1) : null;
    let vo = 0, io = 0;
    for (const o of list) {
      const gg = o.geometry, P = gg.attributes.position, Nn = gg.attributes.normal, U = gg.attributes.uv;
      M.multiplyMatrices(inv, o.matrixWorld); N.getNormalMatrix(M);
      for (let i = 0; i < P.count; i++) {
        const k = (vo + i) * 3;
        v.fromBufferAttribute(P, i).applyMatrix4(M); pos[k] = v.x; pos[k + 1] = v.y; pos[k + 2] = v.z;
        if (Nn) { v.fromBufferAttribute(Nn, i).applyMatrix3(N).normalize(); nor[k] = v.x; nor[k + 1] = v.y; nor[k + 2] = v.z; } else nor[k + 1] = 1;
        if (U) { uv[(vo + i) * 2] = U.getX(i); uv[(vo + i) * 2 + 1] = U.getY(i); }
        const Cc = col && gg.attributes.color; if (Cc) { col[k] = Cc.getX(i); col[k + 1] = Cc.getY(i); col[k + 2] = Cc.getZ(i); }
      }
      if (gg.index) for (let i = 0; i < gg.index.count; i++) idx[io + i] = gg.index.getX(i) + vo;
      else for (let i = 0; i < P.count; i++) idx[io + i] = vo + i;
      vo += P.count; io += gg.index ? gg.index.count : P.count;
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.BufferAttribute(nor, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
    if (col) geo.setAttribute('color', new T.BufferAttribute(col, 3));
    geo.setIndex(new T.BufferAttribute(idx, 1)); geo.computeBoundingSphere();
    const mesh = new T.Mesh(geo, m); mesh.castShadow = true; mesh.receiveShadow = true; out.add(mesh);
  }
  return out;
}
// Tuiles recolorées (garde le relief et les ombres, change seulement la teinte)
const kitTint = {};
function kitRoofMat(m, hex) {
  const key = m.uuid + hex; if (kitTint[key]) return kitTint[key];
  const T = THREE, n = m.clone();
  if (m.map && m.map.image) {
    const im = m.map.image, c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d');
    g.drawImage(im, 0, 0); g.globalCompositeOperation = 'color'; g.fillStyle = hex; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(im, 0, 0);
    const t = new T.CanvasTexture(c); t.flipY = m.map.flipY; t.wrapS = m.map.wrapS; t.wrapT = m.map.wrapT; t.encoding = m.map.encoding; n.map = t;
  }
  return (kitTint[key] = n);
}
function medBuilding(g, id, l) {
  const T = THREE, M = MODELS.medieval, o0 = MED[id], o = Object.assign({}, o0), raw = new T.Group();
  if ((id === 'armurerie' || id === 'forge') && l >= 5) o.floors = 2;
  if (id === 'labo' && l >= 3) o.floors = 2;
  const P = (name, x, y, z, ry) => { const src = M.parts[name]; if (!src) return null; const p = src.clone(true); p.position.set(x, y, z); p.rotation.y = ry || 0; raw.add(p); return p; };
  let top = kitBlock(P, o, 0, 0);
  if (o.tower) top = Math.max(top, kitBlock(P, { nx: 2, nz: 2, floors: o.tower.floors, low: 'stone', high: 'stone', towerRoof: 1, door: false }, 0, o.tower.z));
  if (o.chimney) P('Prop_Chimney', o.chimney[0], o.floors * KIT_H + 0.4, o.chimney[1], 0);
  if (o.balcony || l >= 3) if (o.floors > 1) P('Balcony_Simple_Straight', o.nx - 1, KIT_H, o.nz, 0);
  if (o.vine || l >= 2) { P('Prop_Vine2', -o.nx + 0.05, KIT_H + 0.4, o.nz + 0.12, 0); if (o.floors > 1) P('Prop_Vine5', o.nx + 0.1, KIT_H * 1.5, -o.nz + 0.6, Math.PI / 2); }
  const merged = bakeMerged(raw, m => m.name === 'MI_WindowGlass' ? V.winMat : (m.name === 'MI_RoundTiles' && o.roof) ? kitRoofMat(m, o.roof) : m);
  const k = o.sc * (1 + 0.03 * (Math.min(l, 5) - 1));
  merged.scale.setScalar(k); g.add(merged);
  // repères (en mètres, dans le repère du bâtiment) pour les décorations propres à chaque bâtiment
  const fw = o.nx * k, fd = o.nz * k + 0.1, h1 = KIT_H * k, roofY = o.floors * KIT_H * k;
  if (id === 'hdv') {
    mk(new T.CylinderGeometry(0.5, 0.5, 0.1, 20), '#ffd23f', 0, h1 * 0.93, fd + 0.05, g, { emissive: '#4a3a00' }).rotation.x = Math.PI / 2;
    const towerTop = (o.tower.floors * KIT_H + KIT_TOWER_TOP) * k;
    flag(g, 0, towerTop - 0.25, o.tower.z * k, '#ff4fa3', 1.8);
    if (l >= 5) mk(new T.SphereGeometry(0.55, 16, 10), '#ffd23f', 0, towerTop + 2.1, o.tower.z * k, g, { emissive: '#5a4200' });
  } else if (id === 'armurerie') {
    const sh = mk(new T.CylinderGeometry(0.42, 0.42, 0.1, 16), '#3d6fd9', 0, h1 * 0.88, fd + 0.08, g); sh.rotation.x = Math.PI / 2;
    for (const r of [-0.75, 0.75]) { const sw = mk(BX(0.1, 1.2, 0.05), '#e8ecff', 0, h1 * 0.88, fd + 0.14, g); sw.rotation.z = r; }
  } else if (id === 'infirmerie') {
    mk(BX(0.8, 0.24, 0.08), '#ff4f6d', 0, h1 * 1.5, fd + 0.06, g); mk(BX(0.24, 0.8, 0.08), '#ff4f6d', 0, h1 * 1.5, fd + 0.06, g);
  } else if (id === 'forge') {
    const cx = o.chimney[0] * k, cz = o.chimney[1] * k, cy = (o.floors * KIT_H + 0.4 + 3.18) * k;
    mk(BX(0.62, 0.14, 0.62), '#ff8a1f', cx, cy, cz, g, { emissive: '#a03a00' });
    V.smokeAt = { id, lx: cx, ly: cy + 0.1, lz: cz };
    mk(new T.CylinderGeometry(0.7, 0.85, 0.5, 10), STONE(3, 0.5), fw + 0.7, 0.25, fd + 0.7, g);
    V.forgeFire = mk(new T.SphereGeometry(0.5, 8, 6), mat('#ff8a1f', { emissive: '#e05a00' }), fw + 0.7, 0.55, fd + 0.7, g);
    V.forgeFire.castShadow = false;
  } else if (id === 'labo') {
    const tank = new T.Group(); tank.position.set(fw + 0.9, 0, 0.5); g.add(tank);
    mk(new T.CylinderGeometry(0.75, 0.8, 0.3, 12), STONE(2, 0.3), 0, 0.15, 0, tank);
    mk(new T.CylinderGeometry(0.62, 0.62, 2.0, 14), mat('#e8f6ff', { transparent: true, opacity: 0.45 }), 0, 1.3, 0, tank);
    V.elixir = mk(new T.CylinderGeometry(0.55, 0.55, 1.5, 14), mat('#ff4fd8', { emissive: '#7a0a60' }), 0, 1.05, 0, tank);
    mk(new T.CylinderGeometry(0.7, 0.7, 0.18, 14), '#ffd23f', 0, 2.35, 0, tank);
    mk(new T.SphereGeometry(0.22, 10, 8), '#ff4fa3', 0, top * k + 0.25, 0, g, { emissive: '#901050' });
    const cols = ['#3df5b0', '#ff4fa3', '#ffd23f']; V.flasks = [];
    for (let i = 0; i < 2 + Math.min(l, 3); i++) { const a = 2.2 + i * 0.45, r = fw + 1.0; V.flasks.push(mk(new T.SphereGeometry(0.28, 10, 8), cols[i % 3], Math.sin(a) * r, 0.3, Math.cos(a) * r, g, { emissive: '#303030' })); }
  } else if (id === 'caserne') {
    for (const r of [-0.7, 0.7]) { const sw = mk(BX(0.12, 1.3, 0.05), '#e8ecff', 0, h1 * 0.9, fd + 0.08, g); sw.rotation.z = r; }
    flag(g, -fw - 0.5, 0, fd + 0.4, '#ff8a1f', 3); flag(g, fw + 0.5, 0, fd + 0.4, '#3d8bd9', 3);
    if (l >= 3) for (const sx of [-1, 1]) { const tent = mk(new T.ConeGeometry(1.1, 1.7, 4), mat(sx < 0 ? '#f2e3c2' : '#e7d2a8', { tex: 'plaster', rep: [1, 1] }), sx * (fw + 1.7), 0.85, -1.3, g); tent.rotation.y = Math.PI / 4; }
  } else if (id === 'garde') {
    const w = fw * 2;
    for (let i = 0; i < 6; i++) { const aw = mk(BX(w / 6, 0.07, 0.9), i % 2 ? '#ffffff' : '#ff4fa3', -w / 2 + w / 12 + i * w / 6, h1 * 0.86, fd + 0.42, g); aw.rotation.x = 0.35; }
    const stand = new T.Group(); stand.position.set(fw + 1.2, 0, fd + 0.4); g.add(stand);
    mk(new T.CylinderGeometry(0.6, 0.7, 0.25, 14), '#ff4fa3', 0, 0.12, 0, stand);
    const man = buildHero3D(save.skin, CLASSES[save.cls].color); man.position.y = 0.25; man.rotation.y = -0.4; stand.add(man); (V.farHide || (V.farHide = [])).push(man);
  }
  const depth = o.tower ? Math.max(o.nz, -o.tower.z + 2) : o.nz;
  return { top: top * k + 0.4, size: Math.max(o.nx, depth) * 2 * k };
}
// Sol pavé, pierre et tuiles du kit pour tout le reste du village (en gris : la couleur du jeu s'applique par-dessus)
function applyKitTextures() {
  for (const key in KIT_TEX) {
    if(key==='cobble')continue; // Ground pavement comes from Poly Haven.
    const t = TEX[key]; if (!t) continue;
    const im = new Image();
    im.onload = () => { const c = t.image; c.width = c.height = 512; c.getContext('2d').drawImage(im, 0, 0, 512, 512); t.dispose(); t.needsUpdate = true; (TEXC[key] || []).forEach(x => { x.dispose(); x.needsUpdate = true; }); };
    im.src = KIT_TEX[key];
  }
}
// ---------- Meubles, nature, coffre et monstres tirés des packs Quaternius (Fantasy Props, Stylized Nature, Bestiary) ----------
// Une pièce d'un fichier « raw » (meubles, nature…)
function kitPiece(model, name, k) {
  const M = MODELS[model]; if (!M || !M.parts[name]) return null;
  const o = M.parts[name].clone(true); o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.setScalar(k || 1);
  return o;
}
// Recolore une matière (garde le relief et les ombres de la texture, change la teinte)
const kitRecol = {};
function kitRecolor(m, hex, amt) {
  const key = m.uuid + hex + amt; if (kitRecol[key]) return kitRecol[key];
  const n = m.clone();
  if (m.map && m.map.image) {
    const im = m.map.image, c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d');
    g.drawImage(im, 0, 0); g.globalAlpha = amt; g.globalCompositeOperation = 'color'; g.fillStyle = hex; g.fillRect(0, 0, c.width, c.height);
    g.globalAlpha = 1; g.globalCompositeOperation = 'destination-in'; g.drawImage(im, 0, 0);
    const t = new THREE.CanvasTexture(c); t.flipY = m.map.flipY; t.wrapS = m.map.wrapS; t.wrapT = m.map.wrapT; t.encoding = m.map.encoding; n.map = t;
  } else n.color = new THREE.Color(hex);
  return (kitRecol[key] = n);
}
// Habille un meuble au style choisi : bois et tissus prennent les couleurs du style
function styleKit(o, st) {
  if (!o) return o;
  o.traverse(c => {
    if (!c.isMesh) return;
    const m = c.material, n = m.name || '';
    if (/Cloth|Banner/.test(n)) c.material = kitRecolor(m, st.fabric, 1);
    else if (/Furniture/.test(n) && st.wood !== '#9a6a3a') c.material = kitRecolor(m, st.wood, 0.75);
  });
  return o;
}

// --- Intérieur de la maison : vrais meubles (le style choisi dans le catalogue les recolore) ---
const HOME_K = 1.15;
function kitFurniture(slot, st, g) {
  const T = THREE, add = (name, x, y, z, ry, k) => { const o = styleKit(kitPiece('interior', name, k || HOME_K), st); if (!o) return null; o.position.set(x, y, z); o.rotation.y = ry || 0; g.add(o); return o; };
  const extra = (x, y, z, n) => { for (let i = 0; i < (n || 4); i++) { if (st.wool) mk(new T.SphereGeometry(0.16, 8, 6), '#fffbe8', x + (i - (n || 4) / 2 + 0.5) * 0.34, y, z, g); else if (st.flowers) { mk(new T.SphereGeometry(0.08, 8, 6), st.fabric, x + (i - (n || 4) / 2 + 0.5) * 0.3, y, z, g); } } };
  if (slot === 'bed') {
    add('Bed_Twin1', 0, 0, 0, 0, 1.2);
    add('Nightstand_Shelf', 1.6, 0, -1.15, 0, 1.0);
    add('CandleStick_Triple', 1.6, 1.21, -1.15, 0, 1.0);
    add('Book_Stack_1', 1.6, 0.42, -1.12, 0.4, 1.2);
    extra(0, 1.05, -1.4, 5);
  } else if (slot === 'sofa') {
    add('Bench', 0, 0, 0.1, 0, 0.95);
    for (const x of [-0.62, 0.62]) mk(BX(1.15, 0.14, 0.5), st.soft, x, 0.56, 0.1, g);
    mk(BX(2.5, 0.75, 0.22), st.fabric, 0, 0.92, -0.3, g);
    for (const x of [-0.85, 0, 0.85]) mk(new T.SphereGeometry(0.24, 12, 8), st.soft, x, 0.85, -0.12, g).scale.set(1.2, 1, 0.6);
    extra(0, 1.35, -0.3, 6);
  } else if (slot === 'table') {
    add('Table_Large', 0, 0, 0, Math.PI / 2, 0.95);
    mk(BX(0.5, 0.02, 2.4), st.fabric, 0, 0.785, 0, g);
    add('Table_Plate', 0.12, 0.79, -0.6, 0, 1.2); add('Table_Plate', -0.12, 0.79, 0.6, 0, 1.2);
    add('Mug', 0.25, 0.79, -0.25, 0.5, 1.4); add('Mug', -0.25, 0.79, 0.3, 2.5, 1.4);
    add('CandleStick_Triple', 0, 0.79, 0, Math.PI / 2, 1.0);
  } else if (slot === 'chairs') {
    for (const [x, rot] of [[-1.35, Math.PI / 2], [1.35, -Math.PI / 2]]) { const c = add('Chair_1', x, 0, 0, rot, 1.0); if (c) mk(BX(0.46, 0.06, 0.46), st.fabric, x, 0.53, 0, g); }
  } else if (slot === 'wardrobe') {
    add('Bookcase_2', 0, 0, 0, 0, 1.0);
    for (const [y, n] of [[0.55, 'BookGroup_Medium_1'], [1.27, 'BookGroup_Medium_1'], [1.98, 'Book_Stack_1']]) add(n, 0, y, 0.02, 0, 1.0);
    extra(0, 2.65, 0, 4);
  } else if (slot === 'lamp') {
    add('CandleStick_Stand', 0, 0, 0, 0, 1.35);
    mk(new T.SphereGeometry(0.16, 10, 8), '#fff4c0', 0, 1.82, 0, g, { emissive: '#ffd27a' }).castShadow = false;
  } else if (slot === 'plant') {
    add('Vase_4', 0, 0, 0, 0, 1.5);
    const pl = kitPiece('interior', st.flowers ? 'Flower_3_Group' : 'Plant_1_Big', st.flowers ? 0.5 : 0.42); if (pl) { pl.position.y = 0.66; g.add(pl); }
  } else return false;
  return true;
}
// Décor fixe de la maison (étagère à fioles, lanternes, bannière, tabouret)
function kitHomeDecor(H) {
  if (!MODELS.interior) return;
  // la table est maintenant rectangulaire : on bloque aussi ses deux bouts
  if (!HOME_COLL.kit) { HOME_COLL.push([-3.5, -0.55, 0.5], [-3.5, 1.75, 0.5]); HOME_COLL.kit = true; }
  const add = (name, x, y, z, ry, k) => { const o = kitPiece('interior', name, k || HOME_K); if (!o) return; o.position.set(x, y, z); o.rotation.y = ry || 0; H.add(o); };
  add('Shelf_Small_Bottles', 1.5, 1.55, -5.0, 0, 1.1);
  add('Lantern_Wall', -1.6, 1.1, -5.0, 0, 1.0); add('Lantern_Wall', 6.98, 1.1, -1.5, -Math.PI / 2, 1.0);
  add('Banner_2', -6.98, 2.7, -3.6, 0, 1.0);
  add('Stool', -5.3, 0, 2.6, 0.4, 1.0);
  add('Coin_Pile_2', -5.3, 0.67, 2.6, 0, 1.6);
}

// Touffe d'herbe allégée : on garde environ un brin sur deux (chaque brin est un morceau séparé du modèle).
// Les touffes Quaternius font 600 à 1 100 triangles ; le village en compte ~160, soit près d'un tiers des triangles à l'écran.
function thinBlades(geo, keep) {
  const P = geo.attributes.position, idx = geo.index; if (!idx) return geo;
  // morceaux reliés : deux sommets au même endroit ou dans un même triangle appartiennent au même brin
  const par = new Int32Array(P.count).map((_, i) => i), find = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; }, join = (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b; };
  const at = new Map(); for (let i = 0; i < P.count; i++) { const k = P.getX(i).toFixed(4) + ',' + P.getY(i).toFixed(4) + ',' + P.getZ(i).toFixed(4); if (at.has(k)) join(i, at.get(k)); else at.set(k, i); }
  for (let i = 0; i < idx.count; i += 3) { join(idx.getX(i), idx.getX(i + 1)); join(idx.getX(i), idx.getX(i + 2)); }
  const roots = [...new Set(Array.from({ length: P.count }, (_, i) => find(i)))]; if (roots.length < 6) return geo;
  const kept = new Set(roots.filter((_, i) => (i * 0.618034) % 1 < keep)), out = [];
  for (let i = 0; i < idx.count; i += 3) if (kept.has(find(idx.getX(i)))) out.push(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
  const g = geo.clone(); g.setIndex(out); return g;
}
// --- Petits instanciés : une pièce copiée beaucoup de fois en un seul dessin (herbes, galets, arbres morts) ---
function kitInstances(model, name, list, parent) {
  const src = kitPiece(model, name, 1); if (!src) return null;
  const T = THREE, merged = bakeMerged(src, m => m), g = new T.Group(), M = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
  merged.children.forEach(mesh => {
    const im = new T.InstancedMesh(/^Grass/.test(name) ? thinBlades(mesh.geometry, 0.45) : mesh.geometry, mesh.material, list.length);
    list.forEach(([x, y, z, ry, s], i) => { e.set(0, ry || 0, 0); q.setFromEuler(e); M.compose(new T.Vector3(x, y, z), q, Array.isArray(s) ? new T.Vector3(...s) : new T.Vector3(s, s, s)); im.setMatrixAt(i, M); });
    im.castShadow = !/Grass|Pebble|RockPath/.test(name); im.receiveShadow = true; im.frustumCulled = false; g.add(im);
  });
  parent.add(g); return g;
}
// Herbes hautes au pied des remparts et au bord de la rivière, galets le long des allées, chemins de pierres entre les maisons
function natureVillage() {
  if (!MODELS.nature2 || V.nature2) return;
  V.nature2 = true;
  const R = seeded(909), grassA = [], grassB = [], grassC = [], peb = {}, pathPieces = {};
  const free = (x, z, pad) => {
    if (Math.hypot(x - PLAZA[0], z - PLAZA[1]) < 4.5 || Math.hypot(x - HATCH.x, z - HATCH.z) < 2.2) return false;
    for (const id in V.bld) { const b = V.bld[id], r = (BUILD[id] ? BUILD[id].collide : 3) + (pad || 0.6); if (Math.hypot(x - b.group.position.x, z - b.group.position.z) < r) return false; }
    return true;
  };
  // herbes hautes le long des remparts (à l'intérieur)
  for (let i = 0; i < 90; i++) {
    const side = i % 4, u = (R() * 2 - 1) * (WALL - 2), off = WALL - 0.9 - R() * 1.4;
    const [x, z] = side === 0 ? [u, -off] : side === 1 ? [u, off] : side === 2 ? [-off, u] : [off, u];
    if (!free(x, z)) continue;
    (i % 3 === 0 ? grassB : i % 3 === 1 ? grassA : grassC).push([x, 0, z, R() * TAU, 0.5 + R() * 0.35]);
  }
  // touffes au bord de la rivière (dehors, au sud)
  const riverZ = x => WALL + 5.2 + Math.sin(x * 0.13) * 1.4 + Math.sin(x * 0.37) * 0.5;
  for (let i = 0; i < 70; i++) { const x = -34 + R() * 68, s = R() < 0.5 ? -1 : 1, z = riverZ(x) + s * (1.4 + R() * 1.2); (i % 2 ? grassA : grassB).push([x, 0, z, R() * TAU, 0.55 + R() * 0.4]); }
  kitInstances('nature2', 'Grass_Common_Tall', grassA, V.scene);
  kitInstances('nature2', 'Grass_Wispy_Tall', grassB, V.scene);
  kitInstances('nature2', 'Grass_Common_Short', grassC, V.scene);
  // galets le long des allées qui partent de la place
  const pebNames = ['Pebble_Round_1', 'Pebble_Round_2', 'Pebble_Round_3', 'Pebble_Round_4', 'Pebble_Square_1'];
  for (const id in V.bld) {
    const b = V.bld[id]; if (id === 'portail') continue;
    for (let k = 0; k < 6; k++) {
      const u = 0.2 + R() * 0.7, x = PLAZA[0] + (b.ix - PLAZA[0]) * u, z = PLAZA[1] + (b.iz - PLAZA[1]) * u;
      const dx = b.iz - PLAZA[1], dz = -(b.ix - PLAZA[0]), L = Math.hypot(dx, dz) || 1, s = (R() < 0.5 ? -1 : 1) * (1.25 + R() * 0.5);
      const px = x + dx / L * s, pz = z + dz / L * s; if (!free(px, pz, 0.3)) continue;
      const n = pebNames[Math.floor(R() * pebNames.length)]; (peb[n] || (peb[n] = [])).push([px, 0, pz, R() * TAU, 0.8 + R() * 0.6]);
    }
  }
  for (const n in peb) kitInstances('nature2', n, peb[n], V.scene);
  // chemins de pierres plates : de la place vers la cabane de l'ouvrier, entre l'infirmerie et la maison, vers la mine
  const lay = (ax, az, bx, bz) => {
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.round(L / 1.6)), a = Math.atan2(bx - ax, bz - az);
    for (let i = 0; i <= n; i++) { const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n; if (!free(x, z, 0.2)) continue; const nm = ['RockPath_Round_Small_1', 'RockPath_Round_Small_2', 'RockPath_Round_Small_3'][i % 3]; (pathPieces[nm] || (pathPieces[nm] = [])).push([x, 0.02, z, a + (R() - 0.5) * 0.6, 1.25]); }
  };
  if (V.hutDoor) lay(PLAZA[0] + 3, PLAZA[1] - 4, V.hutDoor[0], V.hutDoor[1]);
  if (V.bld.infirmerie && V.bld.maison) lay(V.bld.infirmerie.ix, V.bld.infirmerie.iz, V.bld.maison.ix, V.bld.maison.iz);
  if (V.bld.mine && V.bld.forge) lay(V.bld.mine.ix, V.bld.mine.iz, V.bld.forge.ix, V.bld.forge.iz);
  for (const n in pathPieces) kitInstances('nature2', n, pathPieces[n], V.scene);
}
// Arbres morts dans la forêt du Loup-Garou
function deadTreesWolf(sc) {
  if (!MODELS.nature2) return;
  const R = seeded(77), H = { DeadTree_1: 9.5, DeadTree_3: 13.3, DeadTree_5: 16.4 }, lists = { DeadTree_1: [], DeadTree_3: [], DeadTree_5: [] }, names = Object.keys(lists);
  for (let i = 0; i < 22; i++) { const a = R() * TAU, r = 9 + R() * 18, n = names[i % 3]; lists[n].push([Math.cos(a) * r, 0, Math.sin(a) * r, R() * TAU, (5.5 + R() * 2.5) / H[n]]); }
  for (const n of names) { const g = kitInstances('nature2', n, lists[n], sc); if (g) g.traverse(o => { if (o.isMesh) o.material = kitRecolor(o.material, '#4a3a4a', 0.7); }); }
}
// Arbres morts du Bastion : le modèle 3D photographié, avec le contour foncé du jeu
const deadTreeSpr = {};
function deadTreeSprite(v) {
  if (!MODELS.nature2) return null;
  const key = v % 3; if (deadTreeSpr[key]) return deadTreeSpr[key];
  initPreview(); if (!PV.r) return null;
  const T = THREE, name = ['DeadTree_1', 'DeadTree_3', 'DeadTree_5'][key], o = kitPiece('nature2', name, 1);
  const W = 120, H = 140, px = Math.ceil(W * DPX), py = Math.ceil(H * DPX);
  const scene = new T.Scene(); scene.add(new T.HemisphereLight('#fff0e0', '#4a3040', 1.0)); const dl = new T.DirectionalLight('#ffd0a0', 0.8); dl.position.set(-3, 6, 5); scene.add(dl); scene.add(o);
  o.traverse(c => { if (c.isMesh) c.material = kitRecolor(c.material, '#5a3a3a', 0.6); });
  o.updateMatrixWorld(true); const box = new T.Box3().setFromObject(o), h = box.max.y, w = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
  const ext = Math.max(h * 0.55, w * 0.6), cam = new T.OrthographicCamera(-ext * W / H, ext * W / H, ext, -ext, 0.1, 200);
  cam.position.set(0, h * 0.45 + Math.sin(0.5) * 60, Math.cos(0.5) * 60); cam.lookAt(0, h * 0.45, 0);
  const pr = PV.r.getPixelRatio(), prev = PV.r.getSize(new T.Vector2());
  PV.r.setPixelRatio(1); PV.r.setSize(px, py, false); PV.r.setClearColor(0x000000, 0); PV.r.render(scene, cam);
  const c = document.createElement('canvas'); c.width = px; c.height = py; const g = c.getContext('2d');
  // contour : la silhouette en foncé, décalée tout autour, puis l'arbre par-dessus
  const sil = document.createElement('canvas'); sil.width = px; sil.height = py; const sg = sil.getContext('2d');
  sg.drawImage(PV.r.domElement, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = DOUT; sg.fillRect(0, 0, px, py);
  for (let a = 0; a < 8; a++) g.drawImage(sil, Math.cos(a / 8 * TAU) * 2 * DPX, Math.sin(a / 8 * TAU) * 2 * DPX);
  g.drawImage(PV.r.domElement, 0, 0);
  PV.r.setPixelRatio(pr); PV.r.setSize(prev.x || 1, prev.y || 1, false);
  const foot = new T.Vector3(0, 0, 0).project(cam), ay = (1 - foot.y) / 2 * H;
  return (deadTreeSpr[key] = { top: c, w: W, h: H, ax: W / 2, ay, pivot: ay, sway: 0.12 });
}

// --- Coffre du jour en 3D (s'ouvre vraiment) ---
function chestRender(W, H, open, shake, look, t) {
  if (!MODELS.chest) return null;
  const T = THREE;
  if (!CH.r) {
    try { CH.r = oldLook(new T.WebGLRenderer({ antialias: true, alpha: true })); } catch (e) { CH.r = null; return null; }
    CH.r.setPixelRatio(1); CH.scene = new T.Scene();
    CH.hemi = new T.HemisphereLight('#fffaf0', '#6d5a8a', 0.85); CH.scene.add(CH.hemi); const dl = CH.dl = new T.DirectionalLight('#fff0d0', 1.0); dl.position.set(2, 5, 4); CH.scene.add(dl);
    CH.glow = new T.PointLight('#ffd23f', 0, 4); CH.glow.position.set(0, 0.9, 0.2); CH.scene.add(CH.glow);
    CH.obj = modelInst('chest'); CH.scene.add(CH.obj);
    const I = CH.obj.userData.inst, c = I.clip('Chest_Open'); CH.act = I.mixer.clipAction(c); CH.act.play(); CH.dur = c.duration;
    CH.cam = new T.PerspectiveCamera(30, W / H, 0.05, 50); CH.cam.position.set(0, 1.25, 2.6); CH.cam.lookAt(0, 0.42, 0);
  }
  if (CH.r.domElement.width !== W) CH.r.setSize(W, H, false);
  // apparence selon le jour de la série : bois, renforcé (reflets argentés), légendaire (lueur dorée)
  const lvl = look.name.includes('légendaire') ? 2 : look.name.includes('renforcé') ? 1 : 0;
  CH.obj.scale.setScalar(1 + lvl * 0.12);
  CH.obj.traverse(o => { if (o.isMesh && o.material.emissive) o.material.emissive.set(lvl === 2 ? '#3a2400' : lvl === 1 ? '#15151f' : '#000000'); });
  CH.obj.rotation.set(0, -0.35 + Math.sin(t * 0.8) * 0.05, shake ? Math.sin(t * 40) * shake * 0.07 : 0);
  CH.obj.userData.inst.mixer.setTime(Math.min(1, open) * CH.dur * 0.999);
  // une fois la récompense sortie, le coffre retombe dans la pénombre
  const d = CH.dim || 0;
  CH.hemi.intensity = 0.85 * (1 - 0.45 * d); CH.dl.intensity = 1.0 * (1 - 0.55 * d);
  CH.glow.intensity = open > 0 ? (CH.opening && !CH.revealed ? 2.2 : 0.6 * (1 - d)) * Math.min(1, open) : 0;
  CH.r.render(CH.scene, CH.cam);
  return CH.r.domElement;
}
function drawChest3D(g, W, H, t, open, shake, look) {
  const img = chestRender(W, H, open, shake, look, t);
  if (!img) { drawChest(g, W, H, t, open, shake, look); return; }
  g.clearRect(0, 0, W, H);
  if (open > 0) {
    g.save(); g.translate(W / 2, H * 0.55); g.rotate(t * 0.6); g.globalAlpha = Math.min(1, open) * 0.55 * (1 - 0.8 * (CH.dim || 0));
    for (let i = 0; i < 12; i++) { g.rotate(TAU / 12); g.fillStyle = i % 2 ? '#fff2a8' : '#ffd23f'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-22, -260); g.lineTo(22, -260); g.closePath(); g.fill(); }
    g.restore(); g.globalAlpha = 1;
  }
  g.fillStyle = 'rgba(20,10,40,.35)'; g.beginPath(); g.ellipse(W / 2, H * 0.8, W * 0.3, 16, 0, 0, TAU); g.fill();
  g.drawImage(img, 0, 0, W, H);
}

// --- Puglin et Imp : monstres du Bastion, le modèle 3D posé os par os (bras le long du corps, marche) et photographié de profil ---
const MONSTER3D = { goblin:{model:'goblin',clip:'Walk',ext:1.1,sc:1}, dungeon_orc:{model:'dungeon_orc',clip:'Walk',ext:1.1,sc:1.1}, dungeon_shaman:{model:'dungeon_shaman',clip:'Flying_Idle',ext:1,sc:1}, puglin: { model: 'puglin', arms: 1.15, ext: 1.15 }, imp: { model: 'imp2', arms: 1.2, ext: 1.2 },
  // monstres « Ultimate Monsters » : ils remplacent les Bouftous des vagues (mêmes comportements, autre apparence)
  um_blob: { model: 'um_blob', clip: 'Walk', ext: 0.85, sc: 0.85 }, um_mushnub: { model: 'um_mushnub', clip: 'Walk', ext: 0.85, sc: 0.95 }, um_pinkblob: { model: 'um_pinkblob', clip: 'Walk', ext: 0.85, sc: 0.85 },
  um_ninja: { model: 'um_ninja', clip: 'Walk', ext: 0.85, sc: 1.1 }, um_bee: { model: 'um_bee', clip: 'Fast_Flying', ext: 0.95, sc: 1.15 },
  um_wizard: { model: 'um_wizard', clip: 'Walk', ext: 0.85, sc: 1.25 }, um_cactoro: { model: 'um_cactoro', clip: 'Walk', ext: 0.95, sc: 1.55 },
  um_yeti: { model: 'um_yeti', clip: 'Walk', ext: 0.95, sc: 1.3 }, um_orc: { model: 'um_orc', clip: 'Walk', ext: 0.95, sc: 1.3 },
  // goule : elle marche, et quand on la tue une 1re fois elle tombe au sol (images de sa chute) puis se relève
  ghoul: { model: 'ghoul', clip: 'Walk', ext: 0.95, sc: 1.25 }, ghoul_down: { model: 'ghoul', clip: 'Death', ext: 0.95, sc: 1.25 } };
// lents, rapides, tireurs, costauds : chaque monstre des vagues prend une de ces apparences
const MON_SKINS = { walker: ['um_blob', 'um_mushnub', 'um_pinkblob'], runner: ['um_ninja', 'um_bee'], spitter: ['um_wizard', 'um_cactoro'], tank: ['um_yeti', 'um_orc'] };
const monFrames = {};
function monsterFrames(type) {
  if (monFrames[type]) return monFrames[type];
  const D = MONSTER3D[type]; if (!MODELS[D.model]) return null;
  initPreview(); if (!PV.r) return null;
  const T = THREE, N = 200, g = modelInst(D.model), bones = {};
  g.traverse(o => { if (o.isBone) bones[o.name] = o; });
  const rest = {}; for (const n in bones) rest[n] = bones[n].quaternion.clone();
  const X = new T.Vector3(1, 0, 0), Z = new T.Vector3(0, 0, 1), q = new T.Quaternion(), pq = new T.Quaternion();
  const rotW = (n, axis, a) => { const b = bones[n]; if (!b || !a) return; g.updateMatrixWorld(true); b.parent.getWorldQuaternion(pq); q.setFromAxisAngle(axis.clone().applyQuaternion(pq.invert()), a); b.quaternion.premultiply(q); };
  const scene = new T.Scene(); scene.add(new T.HemisphereLight('#fffaf0', '#6d5a8a', 0.9)); const dl = new T.DirectionalLight('#fff0d0', 0.9); dl.position.set(-3, 6, 5); scene.add(dl); scene.add(g);
  const ext = D.ext, cam = new T.OrthographicCamera(-ext, ext, ext, -ext, 0.1, 60), ly = 0.6 * ext / Math.cos(0.45);
  cam.position.set(0, ly + Math.sin(0.45) * 20, Math.cos(0.45) * 20); cam.lookAt(0, ly, 0);
  const pr = PV.r.getPixelRatio(), prev = PV.r.getSize(new T.Vector2());
  PV.r.setPixelRatio(1); PV.r.setSize(N, N, false); PV.r.setClearColor(0x000000, 0);
  const frames = [], flash = [];
  const clipName=D.clip&&Object.keys(g.userData.inst.acts).find(n=>n===D.clip||n.endsWith('|'+D.clip));
  const clip = clipName && g.userData.inst.clip(clipName);
  if (clip) { g.userData.inst.mixer.clipAction(clip).play(); g.rotation.y = Math.PI / 2; }
  for (let f = 0; f < 8; f++) {
    const a = f / 8 * TAU, s = Math.sin(a);
    if (clip) {
      g.userData.inst.mixer.setTime(clip.duration * f / 8);
      PV.r.render(scene, cam);
      const c = document.createElement('canvas'); c.width = c.height = N; c.getContext('2d').drawImage(PV.r.domElement, 0, 0); frames.push(c);
      const w = document.createElement('canvas'); w.width = w.height = N; const wg = w.getContext('2d'); wg.drawImage(c, 0, 0); wg.globalCompositeOperation = 'source-atop'; wg.fillStyle = 'rgba(255,255,255,.65)'; wg.fillRect(0, 0, N, N); flash.push(w);
      continue;
    }
    for (const n in bones) bones[n].quaternion.copy(rest[n]);
    g.rotation.y = 0; g.position.y = 0;
    rotW('spine_01', X, 0.12); rotW('spine_02', Z, s * 0.06);
    rotW('upperarm_l', Z, -D.arms); rotW('upperarm_r', Z, D.arms);
    rotW('upperarm_l', X, -s * 0.45); rotW('upperarm_r', X, s * 0.45);
    rotW('lowerarm_l', X, -0.5); rotW('lowerarm_r', X, -0.5);
    rotW('thigh_l', X, -s * 0.55); rotW('thigh_r', X, s * 0.55);
    rotW('calf_l', X, Math.max(0, Math.cos(a)) * 0.6); rotW('calf_r', X, Math.max(0, -Math.cos(a)) * 0.6);
    g.position.y = Math.abs(Math.cos(a)) * 0.05;
    g.rotation.y = Math.PI / 2;   // de profil, il regarde vers la droite de l'image
    PV.r.render(scene, cam);
    const c = document.createElement('canvas'); c.width = c.height = N; c.getContext('2d').drawImage(PV.r.domElement, 0, 0); frames.push(c);
    const w = document.createElement('canvas'); w.width = w.height = N; const wg = w.getContext('2d'); wg.drawImage(c, 0, 0); wg.globalCompositeOperation = 'source-atop'; wg.fillStyle = 'rgba(255,255,255,.65)'; wg.fillRect(0, 0, N, N); flash.push(w);
  }
  PV.r.setPixelRatio(pr); PV.r.setSize(prev.x || 1, prev.y || 1, false);
  return (monFrames[type] = { frames, flash, fps: clip ? Math.min(16, 8 / clip.duration) : 0 });
}
// image de la chute de la goule : elle tombe (0,45 s), reste au sol, puis se relève (0,5 s)
function ghoulDownFrame(z) {
  const t = GHOUL_DOWN - z.down;
  if (z.down < 0.5) return Math.max(0, Math.min(7, Math.floor(z.down / 0.5 * 8)));
  return Math.min(7, Math.floor(t / 0.45 * 8));
}
function drawModelMinion(z, tx) {
  if (z.down > 0) {
    const F = monsterFrames('ghoul_down');
    if (F) {
      const S = z.r * 5.6 * MONSTER3D.ghoul_down.sc, pulse = 0.5 + Math.sin((G ? G.t : 0) * 10) * 0.5;
      ctx.save(); ctx.globalAlpha = 0.35 + pulse * 0.35; circle(z.x, z.y + z.r * 0.6, z.r * 1.7, 'rgba(143,184,106,.25)', '#b6ff7a', 3); ctx.restore();
      ctx.save(); ctx.translate(z.x, z.y + z.r * 0.95); ctx.scale(tx < z.x ? -1 : 1, 1);
      ctx.drawImage((z.flash > 0 ? F.flash : F.frames)[ghoulDownFrame(z)], -S / 2, -S * 0.8, S, S); ctx.restore();
      return;
    }
  }
  const F = monsterFrames(z.skin || z.type);
  if (!F) { drawWoolly(Object.assign({}, z, { type: z.skin ? z.type : 'walker' }), tx); return; }
  const t = (G ? G.t : demoT) + z.wob, f = Math.floor(t * (F.fps || (z.type === 'imp' ? 14 : 10))) % 8, S = z.r * 5.6 * (MONSTER3D[z.skin || z.type].sc || 1);
  ctx.fillStyle = 'rgba(29,18,56,.22)'; ctx.beginPath(); ctx.ellipse(z.x, z.y + z.r * 0.95, z.r * 1.15, z.r * 0.42, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(z.x, z.y + z.r * 0.95); ctx.scale(tx < z.x ? -1 : 1, 1);
  ctx.drawImage((z.flash > 0 ? F.flash : F.frames)[f], -S / 2, -S * 0.8, S, S);
  ctx.restore();
  if (z.hp < z.maxHp && (z.type === 'puglin' || z.type === 'tank' || (z.type === 'ghoul' && !z.down))) { const w = z.r * 2; ctx.fillStyle = INK; ctx.fillRect(z.x - w / 2, z.y - z.r * 2.6 - 10, w, 7); ctx.fillStyle = '#ff5b3a'; ctx.fillRect(z.x - w / 2 + 1, z.y - z.r * 2.6 - 9, (w - 2) * Math.max(0, z.hp / z.maxHp), 5); }
}

// ---------- Bunker secret : une trappe cachée derrière l'Hôtel de ville, fermée par un code ----------
// (modèle « Underground Bunker » de Bohdan Lvov, Sketchfab, CC BY 4.0 — toit et herbe retirés pour voir l'intérieur)
const HATCH = { x: 8.6, z: -18.2 };
const BUNKER = { x: 200, z: 0, k: 1.15, code: '9507' };
function buildHatch() {
  if (V.hatch) return;
  const T = THREE, g = new T.Group(); g.position.set(HATCH.x, 0, HATCH.z); g.rotation.y = 0.3; V.scene.add(g);
  mk(new T.CylinderGeometry(0.95, 1.05, 0.1, 18), STONE(2, 0.2, '#8f8a9c'), 0, 0.05, 0, g);
  const lid = mk(BX(1.2, 0.08, 1.2), mat('#6a6e78', { tex: 'stone', rep: [1, 1] }), 0, 0.13, 0, g);
  for (const z of [-0.35, 0, 0.35]) mk(BX(1.22, 0.03, 0.08), '#4a4e58', 0, 0.18, z, g);
  const ring = mk(new T.TorusGeometry(0.14, 0.03, 6, 14), '#c9a040', 0.3, 0.2, 0, g); ring.rotation.x = Math.PI / 2;
  // cadenas à code
  mk(BX(0.22, 0.2, 0.08), '#c9a040', -0.42, 0.25, 0.62, g);
  // à moitié cachée par des buissons
  for (const [x, z, r] of [[-1.3, -0.5, 0.55], [1.25, -0.7, 0.5], [-0.9, 1.0, 0.45], [1.1, 0.9, 0.4], [0, -1.35, 0.5]]) mk(new T.SphereGeometry(r, 10, 8), '#4f9f3a', x, r * 0.7, z, g);
  V.hatch = { g, lid };
}
// L'intérieur, construit loin du village (comme la maison)
function buildBunker() {
  if (V.bunker || !MODELS.bunker) return !!V.bunker;
  const T = THREE, M = MODELS.bunker, g = new T.Group(); g.position.set(BUNKER.x, 0, BUNKER.z); V.scene.add(g);
  const root = THREE.cloneSkinned(M.scene); root.rotation.y = Math.PI / 2; root.scale.setScalar(BUNKER.k); g.add(root);
  // le bunker est posé au sol et centré
  g.updateMatrixWorld(true); const box = new T.Box3().setFromObject(root), c = box.getCenter(new T.Vector3());
  root.position.x += BUNKER.x - c.x; root.position.z += BUNKER.z - c.z; root.position.y -= box.min.y;
  g.updateMatrixWorld(true); const box2 = new T.Box3().setFromObject(root);
  // vue de maison de poupée : le mur de devant est coupé au ras du sol pour voir dedans
  V.renderer.localClippingEnabled = true;
  const cuts = [new T.Plane(new T.Vector3(0, 0, -1), box2.max.z - 0.9), new T.Plane(new T.Vector3(0, -1, 0), 0.45)];
  const done = new Set();
  root.traverse(o => { if (o.isMesh && /Shadows|LightReflectd/.test(o.material.name)) o.visible = false; });
  root.traverse(o => { if (!o.isMesh) return; o.frustumCulled = false; (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (done.has(m)) return; done.add(m); m.clippingPlanes = cuts; m.clipIntersection = true; m.side = T.DoubleSide; }); });
  // sol sombre autour (comme pour la maison)
  const floor = new T.Mesh(new T.PlaneGeometry(80, 80), new T.MeshBasicMaterial({ color: '#141824' })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, -0.25, 0); g.add(floor);
  // l'échelle de la trappe : c'est par là qu'on arrive et qu'on repart
  let ladder = null; root.traverse(o => { if (!ladder && /Ladder/i.test(o.name)) ladder = o; });
  const lp = ladder ? new T.Box3().setFromObject(ladder).getCenter(new T.Vector3()) : new T.Vector3(BUNKER.x + 4, 0, BUNKER.z);
  const light = new T.PointLight('#d8f0ff', 1.3, 22, 1.4); light.position.set(0, 4.5, 0); g.add(light);
  const mixer = new T.AnimationMixer(root); if (M.clips[0]) mixer.clipAction(M.clips[0]).play();
  // coffre secret (une seule fois)
  const chest = modelInst('chest'); chest.scale.setScalar(1.3);
  const cx = (box2.min.x + box2.max.x) / 2 - (lp.x - BUNKER.x > 0 ? 1 : -1) * 3.6, cz = box2.min.z + 1.5;
  if (chest) { chest.position.set(cx - BUNKER.x, 0, cz - BUNKER.z); g.add(chest); const I = chest.userData.inst, cl = I.clip('Chest_Open'); I.mixer.clipAction(cl).play(); I.mixer.setTime(save.bunkerLoot ? cl.duration * 0.999 : 0); }
  V.bunker = { g, mixer, ladder: { x: lp.x, z: Math.min(lp.z + 1.2, box2.max.z - 1.4) }, chest, chestPos: { x: cx, z: cz + 1.1 },
    min: { x: box2.min.x + 0.7, z: box2.min.z + 0.7 }, max: { x: box2.max.x - 0.7, z: box2.max.z - 0.7 } };
  g.visible = false;
  return true;
}
function enterBunker() {
  if (!buildBunker()) return;
  const B = V.bunker; B.g.visible = true;
  V.inside = 'bunker'; V.pose = null; V.yawOut = V.yaw; V.yaw = 0;
  V.P.x = B.ladder.x; V.P.z = B.ladder.z; V.P.rot = Math.PI;
  placeHeroCam(true); snapPet(); V.near = null; renderPanel(); sfx('coin');
}
function exitBunker() {
  V.inside = false; V.pose = null; resetPose(); if (V.bunker) V.bunker.g.visible = false;
  V.P.x = HATCH.x + 1.6; V.P.z = HATCH.z + 1.2; V.P.rot = 0.8; V.yaw = V.yawOut || 0;
  placeHeroCam(true); snapPet(); V.near = null; renderPanel();
}
function updateBunker(moving, dt) {
  const B = V.bunker, P = V.P;
  B.mixer.update(dt || 0.016);
  P.x = clamp(P.x, B.min.x, B.max.x); P.z = clamp(P.z, B.min.z, B.max.z);
  if (Math.hypot(P.x - B.ladder.x, P.z - B.ladder.z) < 1.6) return 'ladder';
  if (B.chest && Math.hypot(P.x - B.chestPos.x, P.z - B.chestPos.z) < 1.7) return 'secret';
  return null;
}
function renderBunkerPanel() {
  const el = $('vpanel'); $('vhint').hidden = true;
  let html;
  if (V.near === 'ladder') html = `<div class="vp-head"><h3>Échelle</h3></div><p class="vp-desc">Remonter par la trappe, derrière l’Hôtel de ville.</p><div class="vp-btns"><button class="btn big-ish" data-act="exit">Remonter</button></div>`;
  else if (V.near === 'secret') html = save.bunkerLoot ? `<div class="vp-head"><h3>Coffre secret</h3></div><p class="vp-desc">Déjà vidé… mais tu connais maintenant le repaire secret du village.</p>`
    : `<div class="vp-head"><h3>Coffre secret</h3></div><p class="vp-desc">Quelqu’un a caché un trésor ici !</p><div class="vp-btns"><button class="btn big-ish" data-act="loot">Ouvrir</button></div>`;
  else html = `<div class="vp-head"><h3>Bunker secret</h3></div><p class="vp-desc">Un vieux repaire caché sous le village : écrans, machines… et peut-être un trésor.</p>`;
  if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
  el.hidden = false;
}
function bunkerAction(act) {
  if (act === 'exit') exitBunker();
  else if (act === 'loot' && !save.bunkerLoot) {
    save.bunkerLoot = true; save.coins += 500; save.gems += 15; persist(); updateVhud(); sfx('coin');
    const I = V.bunker.chest.userData.inst, cl = I.clip('Chest_Open'); let t = 0;
    const tick = () => { t += 0.03; I.mixer.setTime(Math.min(cl.duration * 0.999, t)); if (t < cl.duration) requestAnimationFrame(tick); };
    tick();
    const f = $('fade'); f.hidden = false; f.textContent = '+500 pièces · +15 gemmes'; requestAnimationFrame(() => f.classList.add('on'));
    setTimeout(() => { f.classList.remove('on'); setTimeout(() => { f.hidden = true; }, 900); }, 1600);
    V.panelT = 0;
  }
}
// Panneau de la trappe : un cadenas à 4 chiffres
function hatchPanelHtml() {
  return `<div class="vp-head"><h3>Trappe mystérieuse</h3></div><p class="vp-desc">Une vieille trappe en métal à moitié cachée dans les buissons. Un cadenas à code l’empêche de s’ouvrir.</p>
    <div class="vp-btns"><input id="hatchCode" type="tel" inputmode="numeric" maxlength="4" placeholder="Code" autocomplete="off" onkeydown="if(event.key==='Enter')this.nextElementSibling.click()" style="width:6.5em;font-size:1.2rem;text-align:center;letter-spacing:.3em;border-radius:12px;border:3px solid #1d1238;padding:.3em"><button class="btn big-ish" data-act="hatch">Ouvrir</button></div><p class="vp-desc" id="hatchMsg"></p>`;
}
function tryHatch() {
  const inp = $('hatchCode'), v = inp ? inp.value.trim() : '';
  if (v === BUNKER.code) { if (!buildBunker()) { $('hatchMsg').textContent = 'La trappe est coincée… réessaie dans un instant.'; return; } resetVjoy(); enterBunker(); }
  else { $('hatchMsg').textContent = v ? 'Mauvais code… le cadenas ne bouge pas.' : 'Entre les 4 chiffres du code.'; if (inp) { inp.value = ''; inp.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 250 }); } sfx('hit'); }
}

// Textures des tribus bleues et vertes (« Free Warriors », CGTrader)
const W_TEX = {"viking_blue":"textures/jeu/viking_blue.jpg","viking_w_blue":"textures/jeu/viking_w_blue.jpg","roman_blue":"textures/jeu/roman_blue.jpg","roman_c_blue":"textures/jeu/roman_c_blue.jpg","egypt_blue":"textures/jeu/egypt_blue.jpg","viking_green":"textures/jeu/viking_green.jpg","viking_w_green":"textures/jeu/viking_w_green.jpg","roman_green":"textures/jeu/roman_green.jpg","roman_c_green":"textures/jeu/roman_c_green.jpg","egypt_green":"textures/jeu/egypt_green.jpg"};
// ---------- Tribus : le héros est un guerrier chibi (Viking, Spartiate ou Pharaon) — modèles « Free Warriors » (CGTrader) ----------
const TRIBES = {
  viking:    { name: 'Viking',    model: 'w_viking', head: [1.72, -0.06, 0.4], back: -0.45, cut: { neck: 1.3, fz: 0.0, fx: 0.32, fy: 1.5, fyMin: 1.0, skinTop: 1.5, beard: 1.52 }, headLook: { fullSkull: true, eyes: -0.02, braids: true }, weapon: 'sword', tex: { viking_C_texture: 'viking', wiking_weapons_texture: 'viking_w' }, desc: 'Costaud, grande barbe rousse. Il fonce dans le tas ; ses troupes portent le casque à cornes.' },
  spartiate: { name: 'Spartiate', model: 'w_roman',  head: [1.74, -0.04, 0.41], back: -0.53, hide: /^mesh_0_1$/, cut: { neck: 1.3, fz: 9, fx: 0, fy: 0, fyMin: 9, skinTop: 0 }, skinCol: '#e3a57a', headLook: { fullSkull: true, skullR: 0.355, eyes: -0.01, mouth: true }, weapon: 'spear', tex: { roman_D_texture: 'roman', roman_clothes_texture: 'roman_c' },   desc: 'Discipline et courage. Ses troupes portent le casque à crête et la grande cape.' },
  pharaon:   { name: 'Pharaon',   model: 'w_egypt',  head: [1.8, -0.16, 0.42], back: -0.6, bootS: 1.15, cut: { neck: 1.45, fz: 0.05, fx: 0.27, fy: 2.0, fyMin: 1.0, skinTop: 2.1, dropRed: 1.25 }, headLook: { cap: 0.3 }, weapon: 'sword', tex: { egyptian_red_B_texture: 'egypt' },                              desc: 'Rusé, il règne sur le sable. Ses troupes portent la coiffe royale rayée.' },
  // aventuriers KayKit : modèles complets (pas de tête refaite), chapeau et cape d'origine, sans classe imposée
  knight:       { name: 'Chevalier', model: 'h_knight',       kay: true, desc: 'Armure solide et cape rouge : il protège ses amis.' },
  barbarian:    { name: 'Barbare',   model: 'h_barbarian',    kay: true, desc: 'Bonnet d’ours et grosse barbe : il fonce dans le tas !' },
  mage:         { name: 'Mage',      model: 'h_mage',         kay: true, desc: 'Grand chapeau pointu et cape pourpre : la tête pensante.' },
  rogue:        { name: 'Voleuse',   model: 'h_rogue',        kay: true, desc: 'Rapide et discrète, toujours un tour d’avance.' },
  rogue_hooded: { name: 'Rôdeur',    model: 'h_rogue_hooded', kay: true, desc: 'Caché sous sa capuche verte, il surveille la forêt.' },
};
const ADV_WEAPONS = /Shield|Axe|Sword|Mug|Spellbook|Wand|Staff|Crossbow|Knife|Throwable/;
const TRIBE_COLS = { red: ['Rouge', '#d9472f'], blue: ['Bleu', '#3d6fd9'], green: ['Vert', '#4fbf5a'] };
const tribeId = () => (TRIBES[save.tribe] ? save.tribe : null);
const tribeCol = () => { const c = heroColors().tribe; return TRIBE_COLS[c] ? c : 'red'; };
// Les animations sont toutes dans une seule piste (30 images par seconde) : repos, course, mort, attaque
const WCLIP = { idle: [0, 338], run: [339, 362], death: [363, 441], attack: [442, 514] };
const wTime = (k, u) => (WCLIP[k][0] + (WCLIP[k][1] - WCLIP[k][0]) * (u % 1)) / 30;
// Textures des autres couleurs (le modèle contient déjà la rouge)
const wTexCache = {}, wMatCache = {};
function wTex(key) {
  if (!W_TEX[key]) return null;
  let t = wTexCache[key];
  if (!t) { const im = new Image(); t = wTexCache[key] = new THREE.Texture(im); t.flipY = false; t.encoding = THREE.LinearEncoding; im.onload = () => { t.needsUpdate = true; }; im.src = W_TEX[key]; }
  return t;
}
function wMat(m, Tr, col) {
  const base = Tr.tex[m.name]; if (!base || col === 'red') return m;
  const key = m.uuid + col; if (wMatCache[key]) return wMatCache[key];
  const t = wTex(base + '_' + col); if (!t) return m;
  const n = m.clone(); n.map = t; return (wMatCache[key] = n);
}
// Os du modèle, sans le suffixe propre à chaque fichier (« Head_vC_green » → « Head »)
function wBones(g) {
  const B = {};
  g.traverse(o => { if (o.isBone) { const m = o.name.match(/^(HeadTop_End|Head|Neck|Spine2|Spine1|Spine|Hips|RightHand|LeftHand|RightFoot|LeftFoot?|RightUpLeg|LeftUpLeg)(?![a-zA-Z])/); const k = m && (m[1] === 'LeftFoo' ? 'LeftFoot' : m[1]); if (k && !B[k]) B[k] = o; } });
  return B;
}
// Accroche un groupe « debout » à un os : centre (monde), échelle (monde)
function wAttach(bone, g, worldPos, worldScale) {
  const T = THREE, holder = new T.Group(); bone.add(holder);
  g.updateMatrixWorld(true);
  const bq = new T.Quaternion(), bs = new T.Vector3(); bone.getWorldQuaternion(bq); bone.getWorldScale(bs);
  holder.position.copy(bone.worldToLocal(worldPos.clone()));
  holder.quaternion.copy(bq.invert().multiply(g.getWorldQuaternion(new T.Quaternion())));
  holder.scale.setScalar(worldScale / bs.x);
  return holder;
}
// --- Guerriers sans casque : on découpe le casque (et la coiffe) dans le modèle, puis on refait crâne et cheveux ---
// Couleur d'un point de la texture (teinte, saturation, luminosité)
function texHSV(td, u, v) {
  const px = Math.min(td.w - 1, Math.max(0, Math.floor((u % 1 + 1) % 1 * td.w))), py = Math.min(td.h - 1, Math.max(0, Math.floor((v % 1 + 1) % 1 * td.h)));
  const j = (py * td.w + px) * 4, r = td.data[j] / 255, g = td.data[j + 1] / 255, b = td.data[j + 2] / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), s = mx ? (mx - mn) / mx : 0;
  let h = 0; if (mx > mn) { if (mx === r) h = ((g - b) / (mx - mn)) % 6; else if (mx === g) h = (b - r) / (mx - mn) + 2; else h = (r - g) / (mx - mn) + 4; }
  return { h: (h * 60 + 360) % 360, s, v: mx, r, g, b };
}
function cutHelmet(Tr) {
  const T = THREE, M = MODELS[Tr.model], P = Tr.cut; if (!M || M.cut) return;
  const g = modelInst(Tr.model), I = g.userData.inst; I.mixer.clipAction(I.clip('Take 001')).play(); I.mixer.setTime(0); g.updateMatrixWorld(true);
  const pix = new Map(), texData = tex => {
    if (!pix.has(tex)) { const im = tex.image, c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const cg = c.getContext('2d'); cg.drawImage(im, 0, 0); pix.set(tex, { w: c.width, h: c.height, data: cg.getImageData(0, 0, c.width, c.height).data }); }
    return pix.get(tex);
  };
  const srcs = [], insts = []; M.scene.traverse(o => { if (o.isSkinnedMesh) srcs.push(o); }); g.traverse(o => { if (o.isSkinnedMesh) insts.push(o); });
  const skin = [0, 0, 0, 0], v = new T.Vector3(), c = new T.Vector3();
  srcs.forEach((src, mi) => {
    const o = insts[mi], geo = src.geometry, pos = geo.attributes.position, uv = geo.attributes.uv, idx = geo.index;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material; if (!mat.map || !mat.map.image) return;
    const td = texData(mat.map), n = (idx ? idx.count : pos.count) / 3, vi = t => idx ? idx.getX(t) : t, keep = [];
    for (let t = 0; t < n; t++) {
      c.set(0, 0, 0); let u = 0, w = 0;
      for (let k = 0; k < 3; k++) { const i = vi(t * 3 + k); v.fromBufferAttribute(pos, i); o.applyBoneTransform(i, v); v.applyMatrix4(o.matrixWorld); c.add(v); u += uv.getX(i); w += uv.getY(i); }
      c.multiplyScalar(1 / 3);
      let ok = c.y < P.neck;
      if (ok && P.dropRed && c.y > P.dropRed) { const col = texHSV(td, u / 3, w / 3); if ((col.h < 14 || col.h > 345) && col.s > 0.6) ok = false; }
      if (!ok && !(P.dropRed && c.y < P.neck)) {
        const col = texHSV(td, u / 3, w / 3);
        const isSkin = col.h >= 5 && col.h <= 38 && col.s > 0.15 && col.s < 0.62 && col.v > 0.4;
        const detail = col.v < 0.45 || col.s < 0.3;   // yeux, sourcils, bouche
        const face = c.z > P.fz && Math.abs(c.x) < P.fx && c.y < P.fy && c.y > P.fyMin;
        const eyes = !P.eyeBand || (c.y > P.eyeBand[0] && c.y < P.eyeBand[1] && Math.abs(c.x) < P.eyeBand[2] && c.z > (P.eyeBand[3] || -9));
        ok = (isSkin && c.y < P.skinTop && (!P.skinFront || c.z > P.skinFront)) || (face && (isSkin || (detail && eyes))) || (P.beard && c.y < P.beard && c.z > P.fz);
        if (ok && isSkin && c.y > P.neck + 0.1) { skin[0] += col.r; skin[1] += col.g; skin[2] += col.b; skin[3]++; }
      }
      if (ok) for (let k = 0; k < 3; k++) keep.push(vi(t * 3 + k));
    }
    if (keep.length < n * 3) { const ng = geo.clone(); ng.setIndex(keep); src.userData.fullGeo = geo; src.geometry = ng; }
  });
  M.skinCol = skin[3] ? new T.Color(skin[0] / skin[3], skin[1] / skin[3], skin[2] / skin[3]) : new T.Color(Tr.skinCol || '#e8b08a');
  M.cut = true;
}
// Crâne et cheveux posés sur l'os de la tête (repère : tête de rayon 0,36 comme le héros de base)
function buildWarriorHead(head, Tr, M, hatOn) {
  const T = THREE, hc = heroColors().hair, sk = '#' + M.skinCol.getHexString(), H = Tr.headLook || {};
  // le crâne comble l'arrière de la tête (et tout le visage pour le viking, qui n'en avait pas)
  if (H.fullSkull) mk(new T.SphereGeometry(H.skullR || 0.34, 18, 14), sk, 0, 0, H.skullZ || 0, head);
  else mk(new T.SphereGeometry(H.skullR || 0.34, 18, 12, Math.PI * 0.85, Math.PI * 1.3), sk, 0, 0, H.skullZ || -0.02, head);
  if (H.eyes) for (const s of [-1, 1]) {
    const e = mk(new T.SphereGeometry(0.075, 12, 10), '#ffffff', s * 0.13, H.eyes, 0.3, head); e.scale.set(0.9, 1.15, 0.6);
    const p = mk(new T.SphereGeometry(0.046, 10, 8), '#2a1830', s * 0.13, H.eyes - 0.008, 0.335, head); p.scale.set(0.9, 1.1, 0.5);
    mk(new T.SphereGeometry(0.016, 6, 5), '#ffffff', s * 0.13 + 0.016, H.eyes + 0.03, 0.36, head).userData.noOutline = true;
    const br = mk(BX(0.13, 0.035, 0.04), hc, s * 0.13, H.eyes + 0.11, 0.31, head); br.rotation.z = -s * 0.15;
  }
  if (H.mouth) { const m = mk(new T.TorusGeometry(0.045, 0.012, 4, 10, Math.PI), '#2a1830', 0, H.eyes - 0.14, 0.325, head); m.rotation.z = Math.PI; m.userData.noOutline = true; }
  // cheveux : calotte, arrière de la tête, mèches sur le front et sur les côtés
  // avec un chapeau, on ne garde que les cheveux qui dépassent dessous (sinon ils traversent le chapeau)
  if (!hatOn) {
    mk(new T.SphereGeometry(0.375, 18, 8, 0, TAU, 0, Math.PI * (H.cap || 0.36)), hc, 0, 0.03, -0.02, head);
    for (const i of [-1, 0, 1]) { const cn = mk(new T.ConeGeometry(0.08, 0.24, 8), hc, i * 0.14, H.fringe || 0.25, 0.25, head); cn.rotation.set(1.9, 0, -i * 0.45); }
  }
  mk(new T.SphereGeometry(hatOn ? 0.355 : 0.37, 18, 12, Math.PI, Math.PI, Math.PI * (hatOn ? 0.3 : 0), Math.PI * ((H.back || 0.62) - (hatOn ? 0.3 : 0))), hc, 0, 0, -0.03, head);
  for (const sx of [-1, 1]) { const cn = mk(new T.ConeGeometry(0.09, 0.26, 8), hc, sx * 0.31, -0.02, -0.02, head); cn.rotation.set(0.1, 0, Math.PI + sx * 0.18); }
  if (H.braids) for (const sx of [-1, 1]) { const b = mk(new T.CapsuleGeometry(0.05, 0.22, 4, 8), hc, sx * 0.27, -0.28, -0.08, head); b.rotation.z = sx * 0.12; }
}
// Les troupes, elles, gardent leur casque
function wFullGeo(g, Tr) {
  const srcs = [], insts = []; MODELS[Tr.model].scene.traverse(o => { if (o.isSkinnedMesh) srcs.push(o); }); g.traverse(o => { if (o.isSkinnedMesh) insts.push(o); });
  insts.forEach((o, i) => { if (srcs[i] && srcs[i].userData.fullGeo) o.geometry = srcs[i].userData.fullGeo; });
}
// Une pièce rigide faite de nombreux petits morceaux (arme, chapeau, cape, bottes…) : un seul dessin par couleur
// au lieu d'un par morceau (le héros seul en coûtait près de 100 par image, autant pour son ombre). Même apparence.
function compactRigid(root) {
  if (!root) return;
  let ok = true, n = 0;
  root.traverse(o => {
    if (o === root) return;
    // un morceau caché, animé ou repéré ailleurs (clé dans userData) : on ne touche à rien
    if (!o.visible || Object.keys(o.userData).some(k => k !== 'outline' && k !== 'noOutline')) { ok = false; return; }
    if (o.isMesh) { if (o.isSkinnedMesh || o.isInstancedMesh || Array.isArray(o.material) || !o.geometry.attributes.position || o.morphTargetInfluences) ok = false; else n++; }
    else if (!o.isGroup && o.type !== 'Object3D') ok = false;
  });
  if (!ok || n < 3) return;
  const out = bakeMerged(root, m => m);
  for (const c of [...root.children]) root.remove(c);
  for (const m of [...out.children]) {
    if (m.material === OUTLINE_MAT) { m.castShadow = false; m.userData.outline = true; }
    else if (m.material.transparent) m.castShadow = false;
    root.add(m);
  }
}
// Os des aventuriers sous les noms utilisés par le reste du jeu (ceux des guerriers) ; three.js retire les points des noms (« hand.r » → « handr »)
function advBones(g) {
  const b = {}; g.traverse(o => { if (o.isBone) b[o.name] = o; });
  return { Head: b.head, Neck: b.head, Spine2: b.chest, Spine1: b.spine, Spine: b.spine, Hips: b.hips, RightHand: b.handr, LeftHand: b.handl,
    RightFoot: b.footr, LeftFoot: b.footl, RightUpLeg: b.upperlegr, LeftUpLeg: b.upperlegl };
}
// Boîte d'un morceau du modèle dans sa pose actuelle (en suivant les os), dans le repère du modèle
function advBox(g, re) {
  const T = THREE, box = new T.Box3(), v = new T.Vector3(); g.updateMatrixWorld(true);
  g.traverse(o => { if (!o.isSkinnedMesh || !re.test(o.name)) return; const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i += 2) { v.fromBufferAttribute(p, i); o.applyBoneTransform(i, v); v.applyMatrix4(o.matrixWorld); box.expandByPoint(g.worldToLocal(v)); } });
  return box;
}
// Copie d'une pièce d'un aventurier (chapeau, casque, cape). teinte : multipliée (casques) ou couleur unie (capes)
// g : le héros qui la porte. Une pièce articulée (cape) est rattachée à SES os ; sans héros (vignette), elle est figée dans sa pose
function kayPiece(model, name, tint, flat, g) {
  const M = MODELS[model]; if (!M) return null;
  let src = null; M.scene.traverse(o => { if (!src && o.name === name) src = o; }); if (!src) return null;
  const T = THREE, srcs = [], c = src.clone(true), outs = [];
  src.traverse(o => { if (o.isMesh) srcs.push(o); }); c.traverse(o => { if (o.isMesh) outs.push(o); });
  const mat = m => !tint ? m : flat ? new T.MeshToonMaterial({ color: tint, gradientMap: GRAD, side: T.DoubleSide }) : (m = m.clone(), m.color.set(tint), m);
  if (!srcs.some(o => o.isSkinnedMesh)) { outs.forEach(o => { o.material = mat(o.material); }); return c; }
  const res = new T.Group();
  if (g) {
    const gb = {}; g.traverse(o => { if (o.isBone) gb[o.name] = o; });
    let host = null; g.traverse(o => { if (!host && o.isSkinnedMesh) host = o.parent; });
    srcs.forEach(s => { if (!s.isSkinnedMesh) return;
      const m = new T.SkinnedMesh(s.geometry, mat(s.material)); m.frustumCulled = false; m.castShadow = true;
      (host || g).add(m); m.bind(new T.Skeleton(s.skeleton.bones.map(b => gb[b.name] || b), s.skeleton.boneInverses), s.bindMatrix); });
    res.userData.attached = true; return res;
  }
  // vignette : sommets calculés dans la pose du modèle d'origine
  M.scene.updateMatrixWorld(true);
  srcs.forEach(s => { const geo = s.geometry.clone(), p = geo.attributes.position, out = new Float32Array(p.count * 3), v = new T.Vector3();
    s.skeleton.update();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); if (s.isSkinnedMesh) s.applyBoneTransform(i, v); v.applyMatrix4(s.matrixWorld); out.set([v.x, v.y, v.z], i * 3); }
    geo.setAttribute('position', new T.BufferAttribute(out, 3)); geo.deleteAttribute('skinIndex'); geo.deleteAttribute('skinWeight'); geo.computeVertexNormals();
    res.add(new T.Mesh(geo, mat(s.material))); });
  return res;
}
// Capes de la garde-robe : la forme d'une cape KayKit (selon sa valeur), aux couleurs de l'objet
function kayCape(it, g) {
  const v = it.rar === 'légendaire' ? 3 : it.rar === 'épique' ? 2 : it.rar === 'rare' ? 1 : it.cosm ? (it.price <= 250 ? 0 : it.price <= 450 ? 1 : 2) : 0;
  const [m, n] = [['h_rogue', 'Rogue_Cape'], ['h_knight', 'Knight_Cape'], ['h_mage', 'Mage_Cape'], ['h_knight', 'Knight_Cape']][v];
  return kayPiece(m, n, it.col || it.c1 || '#8e2121', true, g);
}
// Bottes des aventuriers : une botte de la paire (modèle « Boots », CC0), coupée en deux une fois pour toutes
const BOOT_HALF = {};
function bootHalf(side) {
  if (BOOT_HALF[side]) return BOOT_HALF[side];
  const M = MODELS.boots_pair; if (!M) return null;
  const T = THREE, src = M.scene.clone(true); src.updateMatrixWorld(true);
  const geos = [], box = new T.Box3(), v = new T.Vector3();
  src.traverse(o => { if (!o.isMesh) return;
    const geo = o.geometry.clone().applyMatrix4(o.matrixWorld), p = geo.attributes.position, idx = geo.index, keep = [];
    for (let i = 0; i < idx.count; i += 3) { const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2); if (((p.getX(a) + p.getX(b) + p.getX(c)) / 3 < 0) === (side < 0)) keep.push(a, b, c); }
    geo.setIndex(keep); for (const i of keep) { v.fromBufferAttribute(p, i); box.expandByPoint(v); } geos.push(geo); });
  const c = box.getCenter(new T.Vector3()); geos.forEach(g => g.translate(-c.x, -box.min.y, -c.z));
  return (BOOT_HALF[side] = { geos, size: box.getSize(new T.Vector3()) });
}
// pose les bottes sur les pieds : elles suivent l'os du pied et couvrent le bas de la jambe
function advBoots(g, B, it) {
  const T = THREE, mat = new T.MeshToonMaterial({ color: it.col || it.c1 || '#8a5634', gradientMap: GRAD }), out = [];
  for (const [k, re, side] of [['LeftFoot', /LegLeft/, 1], ['RightFoot', /LegRight/, -1]]) {
    const H = bootHalf(side), lb = advBox(g, re); if (!H || !B[k] || lb.isEmpty()) return null;
    const hy = 0.92 * (lb.max.y - lb.min.y) / H.size.y, hw = 1.12 * (lb.max.x - lb.min.x) / H.size.x;
    const boot = new T.Group(); H.geos.forEach(geo => boot.add(new T.Mesh(geo, mat))); boot.scale.set(hw, hy, hw);
    const want = g.localToWorld(new T.Vector3((lb.min.x + lb.max.x) / 2, lb.min.y, (lb.min.z + lb.max.z) / 2));
    const hold = wAttach(B[k], g, want, g.getWorldScale(new T.Vector3()).x); hold.add(boot); out.push(hold);
  }
  return out;
}
function buildAdventurer3D(Tr, clsColor) {
  const T = THREE, g = modelInst(Tr.model); if (!g) return null;
  const I = g.userData.inst, idle = I.acts.Idle, run = I.acts.Run;
  idle.play(); if (run) { run.play(); run.weight = 0; } I.mixer.setTime(0.2);
  const B = advBones(g);
  const hat = lookItem('hat'), cape = lookItem('cape'), drop = [];
  // ses armes d'origine sont retirées (il tient l'arme du jeu) ; son chapeau et sa cape laissent la place à ceux de la garde-robe
  g.traverse(o => { if (o.isMesh && (ADV_WEAPONS.test(o.name) || (hat && /_Hat$|_Helmet$/.test(o.name)) || (cape && /_Cape$/.test(o.name)))) drop.push(o); });
  drop.forEach(o => o.parent.remove(o));
  g.updateMatrixWorld(true);
  const gunH = new T.Group(); gunH.scale.setScalar(0.85); g.add(gunH);
  const gun = new T.Group(); gunH.add(gun); buildGun3D(gun, '#3a3550'); gunH.userData.size = gripGun(gunH, gun); const rigid = [gun];
  const kh = hat && hat.kay && kayPiece(hat.kay[0], hat.kay[1], hat.kay[2]);
  if (kh) B.Head.add(kh);
  else if (hat) {
    // le chapeau se pose sur la tête, à sa taille (mesurée sur le modèle)
    const hb = advBox(g, /_Head/), c = hb.getCenter(new T.Vector3()), r = Math.max(0.05, (hb.max.x - hb.min.x) / 2);
    const hh = wAttach(B.Head, g, g.localToWorld(c.clone()), r / 0.36);
    if (hat.cosm) buildCosmHat3D(hh, hat); else buildHat3D(hh, hat); rigid.push(hh);
  }
  const kc = cape && !cape.cosm && kayCape(cape, g);
  if (kc) { if (!kc.userData.attached) B.Spine2.add(kc); }
  else if (cape) {
    // cape à motif (objivants) : centrée sur le dos, le haut aux épaules, assez longue pour descendre aux mollets
    const bb = advBox(g, /_Body/), sh = advBox(g, /_Arm(Left|Right)$/), sc = bb.max.y / 1.64, L = 1.3, cx = sh.isEmpty() ? (bb.min.x + bb.max.x) / 2 : (sh.min.x + sh.max.x) / 2;
    const body = wAttach(B.Spine2, g, g.localToWorld(new T.Vector3(cx, 1.66 * sc * (1 - L), bb.min.z + 0.5 * sc - 0.03)), sc);
    body.scale.y *= L; body.scale.x *= 1.2; buildCape3D(body); rigid.push(body);
  }
  const boots = lookItem('boots'), kb = boots && advBoots(g, B, boots);
  if (boots && !kb) for (const [k, s] of [['LeftFoot', 1], ['RightFoot', -1]]) {
    const f = B[k].getWorldPosition(new T.Vector3()), fh = wAttach(B[k], g, new T.Vector3(f.x, 0.8, f.z + 0.03), 1.05);
    buildBoot3D(fh, bootSpec(), s); rigid.push(fh);
  }
  addOutline(g, 0.02);
  for (const r of rigid) compactRigid(r);
  g.userData = Object.assign(g.userData, { legs: [], arms: [], body: g, gun, head: null, warrior: { I, act: idle, B, gunH, kay: { idle, run }, present: previewBuild ? { wid: weaponId() } : null } });
  wGunFollow(g);
  return g;
}
function buildWarrior3D(clsColor) {
  const T0 = TRIBES[tribeId()]; if (T0 && T0.kay) return MODELS[T0.model] ? buildAdventurer3D(T0, clsColor) : null;
  if (T0 && MODELS[T0.model]) cutHelmet(T0);
  const T = THREE, Tr = T0, g = modelInst(Tr.model);
  if (!g) return null;
  const col = tribeCol();
  g.traverse(o => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(m => wMat(m, Tr, col)) : wMat(o.material, Tr, col); });
  const I = g.userData.inst, act = I.mixer.clipAction(I.clip('Take 001')); act.play(); I.mixer.setTime(wTime('idle', 0));
  const B = wBones(g); g.updateMatrixWorld(true);
  const wp = b => b.getWorldPosition(new T.Vector3());
  // l'arme de la garde-robe remplace l'épée ou la lance ; plus de bouclier ni de cape d'origine (ils cachaient les objivants)
  g.traverse(o => { if (o.isMesh && (/^(sword|spear|shield)/i.test(o.name) || (Tr.hide && Tr.hide.test(o.name)))) o.visible = false; });
  // l'arme suit la main droite mais reste pointée devant le guerrier (accrochée à la main, elle partait sur le côté avec le bras)
  const gunH = new T.Group(); gunH.scale.setScalar(0.85); g.add(gunH);
  const gun = new T.Group(); gunH.add(gun); buildGun3D(gun, '#3a3550'); gunH.userData.size = gripGun(gunH, gun); const rigid = [gun];
  // objivants et équipements : chapeau sur la tête, cape dans le dos, bottes aux pieds
  const hat = lookItem('hat');
  // centre et rayon de la tête (casque compris) : le chapeau se pose dessus
  const H = Tr.head, hh = wAttach(B.Head, g, new T.Vector3(0, H[0], H[1]), H[2] / 0.36);
  if (MODELS[Tr.model].cut) buildWarriorHead(hh, Tr, MODELS[Tr.model], !!hat && hat.shape !== 'band');
  if (hat) { if (hat.cosm) buildCosmHat3D(hh, hat); else buildHat3D(hh, hat); }
  rigid.push(hh);
  // la cape part des épaules et tombe juste derrière le dos
  // le haut de la cape se cale à la base du cou (hauteur des épaules), et non plus au milieu du dos
  const sp = wp(B.Spine2), top = B.Neck ? wp(B.Neck).y + 0.06 : sp.y + 0.2, sc = top / 1.64;
  if (lookItem('cape')) { const body = wAttach(B.Spine2, g, new T.Vector3(0, 0, Tr.back + 0.5 * sc - 0.03), sc); buildCape3D(body); rigid.push(body); }
  if (lookItem('boots')) for (const [k, s] of [['LeftFoot', 1], ['RightFoot', -1]]) {
    // bottes à la taille des pieds des guerriers (assez grandes pour recouvrir leurs chaussures)
    const bs = Tr.bootS || 1.05, f = wp(B[k]), fh = wAttach(B[k], g, new T.Vector3(f.x, 0.8 * bs, f.z + 0.03), bs);
    buildBoot3D(fh, bootSpec(), s); rigid.push(fh);
  }
  addOutline(g, 0.02);
  for (const r of rigid) compactRigid(r);
  // dans la garde-robe, le guerrier présente son arme d'une main, de profil
  g.userData = Object.assign(g.userData, { legs: [], arms: [], body: g, gun, head: null, warrior: { I, act, B, gunH, present: previewBuild ? { wid: weaponId() } : null } });
  wGunFollow(g);
  return g;
}
function animWarrior(h, walk, moving) {
  const W = h.userData.warrior;
  if (W.kay) {
    const K = W.kay, run = K.run && moving;
    K.idle.weight = run ? 0 : 1; if (K.run) K.run.weight = run ? 1 : 0;
    if (K.run) K.run.time = (((walk / TAU) % 1) + 1) % 1 * K.run.getClip().duration;
    K.idle.time = (V.time || 0) % K.idle.getClip().duration;
    W.I.mixer.update(0); wGunFollow(h); return;
  }
  W.I.mixer.setTime(moving ? wTime('run', walk / TAU) : wTime('idle', ((V.time || 0) / 11.3)));
  wGunFollow(h);
}
// Bras en 1re personne : le vrai avant-bras et la vraie main du guerrier (modèle 3D, texture de sa tribu),
// découpés dans son modèle et posés pour que la main tienne la poignée de l'arme
// Toutes les armes ont la même présence à l'écran (un pistolet n'est plus minuscule) et sont un peu tournées
// pour montrer leur flanc et leur skin
const FP_GUN_YAW = 0.32, fpGunScale = s => !s ? 0.27 : s.z > 1.4 && s.y < 0.35 ? 0.75 / s.z : Math.min(0.5 / s.z, 0.26 / s.y);   // fusil long et fin : plus grand
const FP_ARM_ROLL = Math.PI / 2, FP_ARM_LEN = 0.085, FP_ARM_OFF = new THREE.Vector3(0.012, -0.03, 0.035), FP_ARM_EULER = new THREE.Euler(-0.55, -0.3, 0);
function buildFpArm(arm, roll = FP_ARM_ROLL, side = 'Right', wantDir = null, lenMul = 1, stretch = 1) {
  const T = THREE; for (const o of [...arm.children]) arm.remove(o);
  arm.scale.setScalar(1);
  const Tr = tribeId() && TRIBES[tribeId()];
  const g = Tr && MODELS[Tr.model] && modelInst(Tr.model);
  if (!g) { if (side === 'Right') buildFpArmSimple(arm); return; }
  const col = tribeCol(), I = g.userData.inst;
  if (Tr.kay) {
    const drop = []; g.traverse(o => { if (o.isMesh && (ADV_WEAPONS.test(o.name) || !o.isSkinnedMesh)) drop.push(o); }); drop.forEach(o => o.parent.remove(o));
    I.acts.Idle.play(); I.mixer.setTime(0.2);
  } else {
    g.traverse(o => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(m => wMat(m, Tr, col)) : wMat(o.material, Tr, col); });
    I.mixer.clipAction(I.clip('Take 001')).play(); I.mixer.setTime(wTime('idle', 0));
  }
  g.updateMatrixWorld(true);
  const bone = re => { let b = null; g.traverse(o => { if (!b && o.isBone && re.test(o.name)) b = o; }); return b; };
  const sx = side === 'Right' ? 'r' : 'l', K = re => new RegExp(re);
  const upperB = Tr.kay ? bone(K('^upperarm' + sx + '$')) : bone(new RegExp('^' + side + 'Arm')),
    elbowB = Tr.kay ? bone(K('^lowerarm' + sx + '$')) : bone(new RegExp('^' + side + 'ForeArm')),
    wristB = Tr.kay ? bone(K('^wrist' + sx + '$')) : bone(new RegExp('^' + side + 'Hand')),
    tipB = Tr.kay ? bone(K('^hand' + sx + '$')) : bone(new RegExp('^' + side + 'tip'));
  if (!elbowB || !wristB) { if (side === 'Right') buildFpArmSimple(arm); return; }
  // haut du bras allongé (l'avant-bras garde sa taille) pour qu'il sorte de l'écran au lieu de s'arrêter en l'air
  if (stretch !== 1 && upperB) { upperB.scale.y *= stretch; elbowB.scale.y /= stretch; g.updateMatrixWorld(true); }
  // on ne garde que le bras droit : haut du bras (il sort de l'écran), avant-bras et main
  const keepBones = new Set([upperB, elbowB, wristB, tipB].filter(Boolean));
  // l'épée, la lance et le bouclier d'origine restent cachés (comme sur le guerrier)
  g.traverse(o => { if (o.isMesh && (!o.isSkinnedMesh || /^(sword|spear|shield)/i.test(o.name) || (Tr.hide && Tr.hide.test(o.name)))) o.visible = false; });
  g.traverse(o => {
    if (!o.isSkinnedMesh || !o.visible) return;
    const geo = o.geometry.clone(), si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, idx = geo.index, keep = [];
    const C = ['getX', 'getY', 'getZ', 'getW'], main = v => { let bi = 0, bw = -1; for (const c of C) { const w = sw[c](v); if (w > bw) { bw = w; bi = si[c](v); } } return o.skeleton.bones[bi]; };
    const n = idx ? idx.count : geo.attributes.position.count;
    for (let i = 0; i < n; i += 3) { const tri = [0, 1, 2].map(k => idx ? idx.getX(i + k) : i + k); if (tri.every(v => keepBones.has(main(v)))) keep.push(...tri); }
    geo.setIndex(keep); o.geometry = geo; o.frustumCulled = false; o.castShadow = o.receiveShadow = false; o.renderOrder = 10;
  });
  // repère : du coude vers le poignet = vers l'avant (−z), la poignée à l'origine
  const wp = b => b.getWorldPosition(new T.Vector3());
  const elbow = wp(elbowB), wrist = wp(wristB), len = elbow.distanceTo(wrist) || 1;
  // centre du poing (sommets portés par la main) : les mains des trois tribus n'ont pas la même forme
  const fist = new T.Vector3(); let nf = 0;
  g.traverse(o => {
    if (!o.isSkinnedMesh || !o.visible) return;
    o.skeleton.update(); const hb = o.skeleton.bones.indexOf(wristB), si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight, pos = o.geometry.attributes.position, v = new T.Vector3();
    for (let i = 0; i < pos.count; i++) if (si.getX(i) === hb && sw.getX(i) > 0.6) { v.fromBufferAttribute(pos, i); o.applyBoneTransform(i, v); v.applyMatrix4(o.matrixWorld); fist.add(v); nf++; }
  });
  if (nf) fist.multiplyScalar(1 / nf); else fist.copy(wrist).add(wrist.clone().sub(elbow).multiplyScalar(0.6));
  const grip = wrist.clone().lerp(fist, 0.45), size = len * 0.5 + wrist.distanceTo(fist) * 0.7;
  // l'avant-bras arrive du bas à droite de l'écran et monte vers l'arme (le support FP.arm est tourné de FP_ARM_EULER)
  const want = wantDir || new T.Vector3(-0.25, 0.33, -0.91).normalize().applyQuaternion(new T.Quaternion().setFromEuler(FP_ARM_EULER).invert());
  const fit = new T.Group(), s = FP_ARM_LEN * lenMul / size, dir = wrist.clone().sub(elbow).normalize();
  fit.quaternion.setFromUnitVectors(dir, want);
  fit.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(want, roll));
  fit.scale.setScalar(s);
  fit.position.copy(grip).applyQuaternion(fit.quaternion).multiplyScalar(-s);
  fit.add(g); arm.add(fit);
}
// 1re personne : bras du guerrier et arme forment un seul ensemble, l'arme étant fixée DANS la main (comme dans les jeux
// de tir) : la poignée traverse le creux du poing (axe x de l'os de la main, pouce du côté +x), le canon prolonge l'avant-bras.
// Longueur de chaque arme en longueurs d'avant-bras ; l'ensemble est ensuite posé en bas à droite de l'écran.
const FP_SHOT_JOIN = 12;
let FP_WRIST = -0.5;   // canon relevé par rapport au poignet : la crosse passe au-dessus de l'avant-bras
const FP_AIM_BTN = false;   // bouton Viser mis de côté pour plus tard (tout le code est prêt : passer à true pour le remettre)
let FP_AIM = [0.13, 0.035, 0.02, -0.16, 0.45, 0.05];   // visée : décalage de l'arme vers le centre (x, y, z), canon redressé (rotation), arme réduite (le zoom la grossit)
 const FP_GUN_LEN = { standard: 4.7, revolver: 3.6, assaut: 7.4 }, FP_HAND = { revolver: 0.78 }, FP_FOREARM = 0.15;
function buildFpRig(root, wid) {
  const T = THREE, Tr = tribeId() && TRIBES[tribeId()], g = Tr && MODELS[Tr.model] && modelInst(Tr.model);
  if (!g) return false;
  const col = tribeCol();
  g.traverse(o => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(m => wMat(m, Tr, col)) : wMat(o.material, Tr, col); });
  const I = g.userData.inst; I.mixer.clipAction(I.clip('Take 001')).play(); I.mixer.setTime(wTime('idle', 0));
  g.traverse(o => { if (o.isMesh && (!o.isSkinnedMesh || /^(sword|spear|shield)/i.test(o.name) || (Tr.hide && Tr.hide.test(o.name)))) o.visible = false; });
  g.updateMatrixWorld(true);
  const bone = re => { let b = null; g.traverse(o => { if (!b && o.isBone && re.test(o.name)) b = o; }); return b; };
  const side = sd => ({ a: bone(new RegExp('^' + sd + 'Arm')), f: bone(new RegExp('^' + sd + 'ForeArm')), h: bone(new RegExp('^' + sd + 'Hand')), t: bone(new RegExp('^' + sd + 'tip')) });
  const Rb = side('Right'), Lb = side('Left'); if (!Rb.f || !Rb.h) return false;
  const wp = b => b.getWorldPosition(new T.Vector3());
  // bras droit tendu : le haut du bras prolonge l'avant-bras et part vers la caméra (il sort de l'écran)
  if (Rb.a) aimBone(Rb.a, wp(Rb.f).sub(wp(Rb.a)), wp(Rb.h).sub(wp(Rb.f)));
  // main plus petite pour une petite poignée (revolver)
  if (FP_HAND[wid]) { Rb.h.scale.multiplyScalar(FP_HAND[wid]); g.updateMatrixWorld(true); }
  const worldTurn = (b, q) => { const pq = b.parent.getWorldQuaternion(new T.Quaternion()).invert(), bq = b.getWorldQuaternion(new T.Quaternion()); b.quaternion.copy(pq.multiply(q.clone().multiply(bq))); b.updateMatrixWorld(true); };
  // centre du poing droit (sommets portés par la main)
  const fist = new T.Vector3(); let nf = 0;
  g.traverse(o => {
    if (!o.isSkinnedMesh || !o.visible) return;
    o.skeleton.update(); const hb = o.skeleton.bones.indexOf(Rb.h), si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight, pos = o.geometry.attributes.position, v = new T.Vector3();
    for (let i = 0; i < pos.count; i++) if (si.getX(i) === hb && sw.getX(i) > 0.6) { v.fromBufferAttribute(pos, i); o.applyBoneTransform(i, v); v.applyMatrix4(o.matrixWorld); fist.add(v); nf++; }
  });
  if (!nf) return false; fist.multiplyScalar(1 / nf);
  const Lf = wp(Rb.f).distanceTo(wp(Rb.h));
  // l'arme, poignée à l'origine du support
  const holder = new T.Group(), inner = new T.Group(); holder.add(inner); buildGun3D(inner, '#3a3550');
  g.add(holder); const sz = gripGun(holder, inner); if (!sz) return false;
  const hq = Rb.h.getWorldQuaternion(new T.Quaternion()), ax = v => new T.Vector3(...v).applyQuaternion(hq);
  const up = ax([1, 0, 0]), barrel = ax([0, -1, 0]).applyAxisAngle(ax([0, 0, 1]), FP_WRIST).normalize();
  const gx = new T.Vector3().crossVectors(up, barrel).normalize(), gy = new T.Vector3().crossVectors(barrel, gx).normalize();
  holder.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(gx, gy, barrel));
  holder.position.copy(fist); holder.scale.setScalar(Lf * (FP_GUN_LEN[wid] || 5) / sz.z);
  holder.updateMatrixWorld(true); Rb.h.attach(holder);
  const muzzle = new T.Object3D(); muzzle.position.copy(gunPoint(sz, GUN_MUZZLE[wid] || [1, 0.6])); holder.add(muzzle); root.userData.muzzle = muzzle;
  // orientation finale (canon vers l'avant, un peu tourné pour montrer le flanc)
  g.updateMatrixWorld(true);
  const q = holder.getWorldQuaternion(new T.Quaternion());
  const b0 = new T.Vector3(0, 0, 1).applyQuaternion(q), u0 = new T.Vector3(0, 1, 0).applyQuaternion(q);
  const B = new T.Vector3(-Math.sin(FP_GUN_YAW), 0.04, -Math.cos(FP_GUN_YAW)).normalize(), U = new T.Vector3(0, 1, 0);
  const basis = (b, u) => { const x = new T.Vector3().crossVectors(u, b).normalize(), y = new T.Vector3().crossVectors(b, x); return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, b)); };
  const Q = basis(B, U).multiply(basis(b0, u0).invert());
  // seconde main sous le garde-main (Œil de faucon) : bras gauche tendu qui arrive du bas à gauche de l'écran,
  // poing tourné pour que le garde-main passe dans son creux
  const fore = GUN_FORE[wid], keep = new Set([Rb.a, Rb.f, Rb.h, Rb.t].filter(Boolean));
  if (fore && Lb.a && Lb.f && Lb.h) {
    // le garde-main repose sur le haut du poing (au lieu de le traverser)
    const target = holder.localToWorld(gunPoint(sz, fore)).sub(u0.clone().multiplyScalar(lb * 0.3));
    const back = new T.Vector3(-0.32, -0.5, 0.8).normalize().applyQuaternion(Q.clone().invert());
    const la = wp(Lb.a).distanceTo(wp(Lb.f)), lb = wp(Lb.f).distanceTo(wp(Lb.h));
    const shoulder = target.clone().add(back.clone().multiplyScalar(lb * 0.65 + lb + la));
    Lb.a.position.copy(Lb.a.parent.worldToLocal(shoulder)); g.updateMatrixWorld(true);
    const fwd = back.clone().negate();
    aimBone(Lb.a, wp(Lb.f).sub(wp(Lb.a)), fwd); aimBone(Lb.f, wp(Lb.h).sub(wp(Lb.f)), fwd);
    const barrel = b0.clone(), hx = new T.Vector3(1, 0, 0).applyQuaternion(Lb.h.getWorldQuaternion(new T.Quaternion()));
    const pa = hx.projectOnPlane(fwd).normalize(), pb = barrel.projectOnPlane(fwd).normalize();
    const ang = Math.atan2(new T.Vector3().crossVectors(pa, pb).dot(fwd), pa.dot(pb));
    worldTurn(Lb.f, new T.Quaternion().setFromAxisAngle(fwd, ang));
    [Lb.a, Lb.f, Lb.h, Lb.t].filter(Boolean).forEach(b => keep.add(b));
  }
  // on ne garde que les bras
  g.traverse(o => {
    if (!o.isSkinnedMesh || !o.visible) return;
    const geo = o.geometry.clone(), si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, idx = geo.index, kept = [];
    const C = ['getX', 'getY', 'getZ', 'getW'], main = v => { let bi = 0, bw = -1; for (const c of C) { const w = sw[c](v); if (w > bw) { bw = w; bi = si[c](v); } } return o.skeleton.bones[bi]; };
    const n = idx ? idx.count : geo.attributes.position.count;
    for (let i = 0; i < n; i += 3) { const tri = [0, 1, 2].map(k => idx ? idx.getX(i + k) : i + k); if (tri.every(v => keep.has(main(v)))) kept.push(...tri); }
    geo.setIndex(kept); o.geometry = geo; o.frustumCulled = false; o.castShadow = o.receiveShadow = false;
  });
  g.traverse(o => { if (o.isMesh) o.renderOrder = 10; });
  // pose dans l'écran : canon vers l'avant, un peu tourné pour montrer le flanc, poignée à l'origine du groupe
  g.updateMatrixWorld(true);
  const gripW = holder.getWorldPosition(new T.Vector3());
  const fit = new T.Group(), s = FP_FOREARM / Lf;
  fit.quaternion.copy(Q); fit.scale.setScalar(s);
  fit.position.copy(gripW).applyQuaternion(fit.quaternion).multiplyScalar(-s);
  fit.add(g); root.add(fit);
  return true;
}
// Bras de secours (personnage sans tribu) : avant-bras, brassard et main en formes simples
function buildFpArmSimple(arm) {
  const T = THREE; for (const o of [...arm.children]) arm.remove(o);
  const Tr = tribeId() && TRIBES[tribeId()], M = Tr && MODELS[Tr.model];
  const skin = M && M.skinCol ? '#' + M.skinCol.getHexString() : '#e4a37a';
  const sleeveCol = tribeId() === 'spartiate' ? '#c9952f' : tribeId() === 'pharaon' ? '#e8d9b0' : skin;
  const m = c => new T.MeshToonMaterial({ color: c, gradientMap: GRAD });
  const cyl = (r1, r2, l, c, z) => { const o = new T.Mesh(new T.CylinderGeometry(r1, r2, l, 12), m(c)); o.rotation.x = Math.PI / 2; o.position.z = z; arm.add(o); return o; };
  cyl(0.04, 0.05, 0.36, sleeveCol, 0.24);                     // avant-bras
  cyl(0.045, 0.047, 0.11, '#6b4429', 0.1);                   // brassard de cuir
  cyl(0.047, 0.047, 0.015, '#c9a040', 0.05);                 // liseré doré
  const palm = new T.Mesh(new T.SphereGeometry(0.038, 12, 9), m(skin)); palm.scale.set(1.05, 0.9, 1.25); palm.position.set(0.012, 0, 0.01); arm.add(palm);
  // quatre doigts repliés autour de la poignée, et le pouce par-dessus
  for (let i = 0; i < 4; i++) {
    const f = new T.Mesh(new T.CapsuleGeometry(0.0115, 0.03, 4, 8), m(skin));
    f.position.set(-0.03, -0.012 - i * 0.005, -0.012 + i * 0.019 - 0.02); f.rotation.set(0, 0, Math.PI / 2 - 0.35); arm.add(f);
  }
  const th = new T.Mesh(new T.CapsuleGeometry(0.012, 0.035, 4, 8), m(skin)); th.position.set(0.012, 0.03, -0.018); th.rotation.set(0.9, 0, 0.3); arm.add(th);
  arm.traverse(o => { if (o.isMesh) { o.renderOrder = 10; o.castShadow = o.receiveShadow = false; } });
  arm.scale.setScalar(0.55);
}
// L'arme est décalée pour que sa poignée (vers l'arrière, en bas) soit à l'origine du support : la main la tient par là.
// Renvoie la taille de l'arme dans le repère du support.
// Où la main tient chaque arme (fractions de la longueur depuis l'arrière, de la hauteur depuis le bas), relevé sur les modèles :
// poignée-pistolet, crosse du revolver ; GUN_FORE/GUN_STOCK : seconde main et crosse (aucune arme actuelle)
const GUN_GRIP = { standard: [0.26, 0.28], revolver: [0.12, 0.3], assaut: [0.31, 0.5] };
// bouche du canon (d'où partent l'éclair et les balles)
const GUN_MUZZLE = { standard: [1, 0.55], revolver: [1, 0.75], assaut: [1, 0.86] };
const GUN_FORE = {}, GUN_STOCK = {};
// un point de l'arme (mêmes fractions) dans le repère du support, la poignée étant à l'origine
const gunPoint = (s, at) => new THREE.Vector3(0, (at[1] - s.at[1]) * s.y, (at[0] - s.at[0]) * s.z);
function gripGun(holder, inner, at = GUN_GRIP[weaponId()] || [0.3, 0.35]) {
  const T = THREE; holder.updateMatrixWorld(true);
  const inv = holder.matrixWorld.clone().invert(), rel = new T.Matrix4(), b = new T.Box3();
  inner.traverse(o => { if (!o.isMesh) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); b.union(o.geometry.boundingBox.clone().applyMatrix4(rel.multiplyMatrices(inv, o.matrixWorld))); });
  const s = b.getSize(new T.Vector3()); if (b.isEmpty() || !isFinite(s.y)) return null;
  inner.position.set(-(b.min.x + b.max.x) / 2, -(b.min.y + s.y * at[1]), -(b.min.z + s.z * at[0]));
  s.at = at; return s;
}
// Bras posés « à la main » : le haut du bras puis l'avant-bras sont tournés pour que la main atteigne la cible,
// le coude plié du côté indiqué (pôle)
function aimBone(bone, from, to) {
  const T = THREE, q = new T.Quaternion().setFromUnitVectors(from.normalize(), to.normalize());
  const pq = bone.parent.getWorldQuaternion(new T.Quaternion()), bq = bone.getWorldQuaternion(new T.Quaternion());
  bone.quaternion.copy(pq.invert().multiply(q.multiply(bq))); bone.updateMatrixWorld(true);
}
function armIK(upper, fore, hand, target, pole) {
  const T = THREE, wp = b => b.getWorldPosition(new T.Vector3());
  const S = wp(upper), E = wp(fore), H = wp(hand), la = S.distanceTo(E), lb = E.distanceTo(H);
  const d = Math.max(0.01, Math.min(S.distanceTo(target), (la + lb) * 0.999)), dir = target.clone().sub(S).normalize();
  const ca = (la * la + d * d - lb * lb) / (2 * la * d), sa = Math.sqrt(Math.max(0, 1 - ca * ca));
  const perp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  const elbow = S.clone().add(dir.clone().multiplyScalar(la * ca)).add(perp.multiplyScalar(la * sa));
  aimBone(upper, E.clone().sub(S), elbow.sub(S));
  const E2 = wp(fore), H2 = wp(hand);
  aimBone(fore, H2.clone().sub(E2), S.clone().add(dir.multiplyScalar(d)).sub(E2));
}
// Garde-robe : l'arme est tenue d'une main, dans le prolongement du bras, et vise devant le héros (canon un peu relevé)
function presentGun(g) {
  const T = THREE, W = g.userData.warrior, P = W.present;
  if (!P.b) { const f = re => { let b = null; g.traverse(o => { if (!b && o.isBone && re.test(o.name)) b = o; }); return b; };
    P.b = { rA: f(/^RightArm|^upperarmr$/), rF: f(/^RightForeArm|^lowerarmr$/), rH: f(/^RightHand|^handr$/), sp: f(/^Spine2|^chest$/) }; }
  const B = P.b, s = W.gunH.userData.size; if (!B.rA || !B.sp || !s) return;
  g.updateMatrixWorld(true);
  const len = s.z, k = (len > 1.1 ? 1.15 : 0.75) / len, hold = GUN_STOCK[P.wid] ? gunPoint(s, GUN_STOCK[P.wid]) : new T.Vector3();
  const sp = g.worldToLocal(B.sp.getWorldPosition(new T.Vector3()));
  // repère de l'arme : canon (z) qui vise devant le héros, un peu relevé ; dessus de l'arme (y) vers le haut
  const bz = new T.Vector3(0, 0.35, 0.94).normalize(), bx = new T.Vector3(1, 0, 0), by = new T.Vector3().crossVectors(bz, bx);
  W.gunH.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(bx, by, bz)); W.gunH.scale.setScalar(k);
  const grip = new T.Vector3(-0.34, sp.y - 0.28, sp.z + 0.32);
  W.gunH.position.copy(grip).sub(hold.clone().multiplyScalar(k).applyQuaternion(W.gunH.quaternion));
  g.updateMatrixWorld(true);
  const gq = g.getWorldQuaternion(new T.Quaternion());
  armIK(B.rA, B.rF, B.rH, W.gunH.localToWorld(hold.clone().add(new T.Vector3(0, -0.04, 0))), new T.Vector3(-0.7, -1, -0.3).applyQuaternion(gq));
}
// Au village, l'arme pend le long du corps, canon vers le bas ; une arme trop longue est un peu réduite
function villageGunPose(h) {
  const W = h && h.userData.warrior; if (!W || !W.gunH) return;
  W.gunH.rotation.x = 1.4;
  const s = W.gunH.userData.size; if (s && s.z * 0.85 > 0.95) W.gunH.scale.setScalar(0.95 / s.z);
}
function wGunFollow(g) {
  const W = g.userData.warrior; if (!W || !W.gunH) return;
  if (W.present) { presentGun(g); return; }
  g.updateMatrixWorld(true);
  const p = g.worldToLocal(W.B.RightHand.getWorldPosition(new THREE.Vector3()));
  W.gunH.position.set(p.x, p.y, p.z + 0.02);   // la poignée est au creux de la main
}

// --- Choix de la tribu (au premier lancement, ou plus tard si l'option est activée) ---
function tribePortrait(cnv, id, col) {
  initPreview(); if (!PV.r || !MODELS[TRIBES[id].model]) return;
  const T = THREE, prev = save.tribe, pc = save.colors && save.colors.tribe;
  save.tribe = id; save.colors = Object.assign({}, save.colors, { tribe: col || 'red' });
  let h; gearOff = true; try { h = buildWarrior3D(CLASSES[save.cls].color); } finally { gearOff = false; save.tribe = prev; if (save.colors) save.colors.tribe = pc; }
  if (!h) return;
  const scene = new T.Scene(); scene.add(new T.HemisphereLight('#fffaf0', '#6d5a8a', 0.85)); const dl = new T.DirectionalLight('#fff0d0', 0.9); dl.position.set(3, 5, 6); scene.add(dl);
  h.rotation.y = 0.35; scene.add(h);
  const cam = new T.PerspectiveCamera(28, cnv.width / cnv.height, 0.1, 50); cam.position.set(0, 1.55, 6.2); cam.lookAt(0, 1.2, 0);
  const pr = PV.r.getPixelRatio(), ps = PV.r.getSize(new T.Vector2());
  PV.r.setPixelRatio(1); PV.r.setSize(cnv.width, cnv.height, false); PV.r.setClearColor(0x000000, 0); PV.r.render(scene, cam);
  const g = cnv.getContext('2d'); g.clearRect(0, 0, cnv.width, cnv.height); g.drawImage(PV.r.domElement, 0, 0);
  PV.r.setPixelRatio(pr); PV.r.setSize(ps.x || 1, ps.y || 1, false);
}
function openTribePicker(force, appearanceOnly=false) {
  if (!force && tribeId()) return;
  if (!MODELS.h_knight) { setTimeout(() => openTribePicker(force, appearanceOnly), 800); return; }
  const list = $('tribeList');
  list.innerHTML = Object.entries(TRIBES).filter(([id, Tr])=>appearanceOnly?id===save.tribe:Tr.kay).map(([id, Tr]) => `<div class="tribe-card" data-tribe="${id}"><canvas width="300" height="340" data-tribeprev="${id}"></canvas><h3>${Tr.name}</h3><p>${Tr.desc || {viking:'Costaud, grande barbe rousse. Il fonce dans le tas !',spartiate:'Discipline et courage, une armure dorée pour affronter le danger.',pharaon:'Rusé, il règne sur le sable et les mystères du désert.'}[id]}</p><button class="btn big-ish" data-tribe="${id}">Choisir</button></div>`).join('');
  $('tribeName').value = SM.create ? '' : (save.name || '');
  $('tribeX').hidden = !(SM.create || tribeId());
  openModal('tribeM');
  requestAnimationFrame(() => list.querySelectorAll('[data-tribeprev]').forEach(c => tribePortrait(c, c.dataset.tribeprev, 'red')));
}
function chooseTribe(id) {
  const name = $('tribeName').value.trim().slice(0, 16) || TRIBE_NAMES[id];
  if (SM.create) {
    // nouveau personnage dans un emplacement libre
    const n = SM.create; SM.create = 0;
    const ns = defaultSave(); ns.tribe = id; ns.name = name; ns.colors.tribe = 'red'; ns.firstPet = true; ns.pickClass = true;
    try { localStorage.setItem(slotKey(n), JSON.stringify(ns)); } catch (e) {}
    $('tribeM').hidden = true; enterSlot(n, true); return;
  }
  save.name = name;
  save.tribe = id; save.colors = Object.assign({}, save.colors || defaultColors(), { tribe: (save.colors && save.colors.tribe) || 'red' });
  persist(); $('tribeM').hidden = true;
  HS.key = null; for (const k in snapCache) delete snapCache[k];
  if (V.ok) { rebuildHero(); spawnTroops(true); }
  updateVhud(); whenLoaded(()=>startTutorial());
}

// --- Écran d'accueil : 3 emplacements de personnage (le jeu se charge derrière pendant le choix) ---
const SM = { create: 0, loaded: false, cbs: [], del: 0 };
const TRIBE_NAMES = { viking: 'Ragnar', spartiate: 'Léonidas', pharaon: 'Ramsès', knight: 'Arthur', barbarian: 'Bjorn', mage: 'Merlin', rogue: 'Lyra', rogue_hooded: 'Robin' };
// Les trois tribus (identifiants d'origine gardés pour les sauvegardes) : chacune donne sa tenue de départ
const TRIBE_LOOK = {
  viking:    { name: 'Gardiens',   desc: 'Guerriers robustes du Nord : armure de rôdeur et étoffe rouge.', outfit: 'ranger', hood: false, cloth: 'red' },
  spartiate: { name: 'Éclaireurs', desc: 'Agiles et discrets : tenue de rôdeur verte et capuche.', outfit: 'ranger', hood: true, cloth: 'green' },
  pharaon:   { name: 'Mystiques',  desc: 'Sages et guérisseurs : tunique de lin aux reflets violets.', outfit: 'peasant', hood: false, cloth: 'purple' },
};

const escH = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const heroName = s => (s && s.name) || (s && TRIBES[s.tribe] ? TRIBE_NAMES[s.tribe] : 'Héros');
function slotSave(n) {
  if (n === SLOT && SAVE_KEY) return save;
  try { return localStorage.getItem(slotKey(n)) ? readSave(slotKey(n)) : null; } catch (e) { return null; }
}
function renderSlotMenu() {
  $('smSlots').innerHTML = [1, 2, 3].map(n => {
    const s = slotSave(n);
    if (!s) return `<div class="sm-card empty" data-slot="${n}"><div class="sm-por"><span class="sm-plus">+</span></div><h3>Emplacement ${n}</h3><p>Libre</p><button class="btn big-ish" data-slot="${n}">Créer un personnage</button></div>`;
    const Tr = TRIBES[s.tribe];
    return `<div class="sm-card${n === SLOT && SAVE_KEY ? ' cur' : ''}" data-slot="${n}"><button class="sm-del" data-del="${n}" aria-label="Supprimer ce personnage">${SM.del === n ? 'Supprimer ?' : '✕'}</button>
      <canvas class="sm-por" width="240" height="240" data-slotpor="${n}"></canvas><h3>${escH(heroName(s))}</h3>
      <p>${Tr ? Tr.name : 'Héros'} · Hôtel de ville niv. ${s.b.hdv} · record : vague ${s.best || 0}</p><button class="btn big-ish" data-slot="${n}">Jouer</button></div>`;
  }).join('');
  drawSlotPortraits();
}
// Portrait 3D de chaque personnage (dès que les modèles sont prêts)
function drawSlotPortraits() {
  if (!MODELS.w_viking) { modelsReady().then(() => { if (MODELS.w_viking && !$('slotMenu').hidden) drawSlotPortraits(); }); return; }
  document.querySelectorAll('[data-slotpor]').forEach(c => {
    const s = slotSave(+c.dataset.slotpor); if (!s) return;
    const prev = save; save = s;
    try { snapHero(c, 'perso', (CLASSES[save.cls] || CLASSES.soldat).color); } catch (e) { console.warn(e); } finally { save = prev; }
  });
}
function openSlotMenu(fromGame) {
  SM.del = 0; renderSlotMenu();
  $('smBack').hidden = !fromGame || !SAVE_KEY;
  $('slotMenu').classList.toggle('ready', SM.loaded);
  $('slotMenu').hidden = false;
}
function whenLoaded(f) { if (SM.loaded) f(); else SM.cbs.push(f); }
function gameLoaded() {
  SM.loaded = true; $('slotMenu').classList.add('ready');
  const c = SM.cbs; SM.cbs = []; c.forEach(f => f());
}
function pickSlot(n) {
  if (!slotSave(n)) { SM.create = n; openTribePicker(true); return; }
  enterSlot(n);
}
function enterSlot(n, fresh) {
  if (n !== SLOT || fresh || !SAVE_KEY) switchSave(n);
  $('slotMenu').classList.add('wait');
  whenLoaded(() => {
    $('slotMenu').hidden = true; $('slotMenu').classList.remove('wait');
    if (!save.name && tribeId()) { save.name = TRIBE_NAMES[save.tribe]; persist(); }
    if (!tribeId()) openTribePicker(true);
    else if (save.pickClass) { save.pickClass = false; persist(); openModal('classesM'); classTitle(true); }
    else if (save.tutorialDone && (notesSeen() < PATCH_NOTES[0].id || save.heroChanged)) openNotes();
    else startTutorial();
  });
}
// Fenêtre des classes : à la création du personnage, on l'invite à choisir sa spécialité
function classTitle(first) {
  const m = $('classesM'); m.querySelector('h2').textContent = first ? 'Choisis ta classe' : 'Caserne';
  m.querySelector('.sub').textContent = first ? 'Ton aventurier se spécialise : chaque classe a son arme et son ultime. Les autres se débloquent en améliorant la Caserne, et tu pourras en changer quand tu veux.' : 'Améliore la Caserne pour débloquer de nouvelles classes.';
}
// --- Notes de mise à jour : affichées une fois après chaque nouveauté, et depuis les Paramètres ---
const PATCH_NOTES = [
  { id: 6, date: '31 octobre', title: 'Petites retouches', items: [
    'Mode du Gobelin têtu (hardcore) : tous les bonbons du Royaume Sucré en roses, seules leurs formes changent.',
    'La boule arc-en-ciel lance des paillettes ; touche l’écran pour passer le délice final de fin de niveau.',
    'Coffre du jour : touche l’écran pour le fermer.',
    'Au village, ton familier marche un peu plus loin de ton héros.',
  ] },
  { id: 5, date: '31 octobre', title: 'Royaume Sucré', items: [
    'Nouveaux bonbons tout ronds et brillants, façon Candy Crush (rayés, emballés et boule arc-en-ciel compris).',
    'Un seul objectif par niveau : des points OU des bonbons à récolter (plus les deux à la fois).',
    'Dès que l’objectif est atteint, le niveau est gagné avec 3 étoiles, sans devoir finir ses coups.',
    'Nouveau : le mode du Gobelin têtu (hardcore, bouton en haut de la carte) met tout en rose, bonbons compris : seules leurs formes les distinguent !',
    'La boule arc-en-ciel lance des paillettes au lieu d’éclairs.',
    'Fin de niveau : touche l’écran pour passer le délice final.',
    'Coffre du jour : touche l’écran pour le fermer.',
    'Taille de l’écran : 100 % par défaut, idéal sur téléphone. Sur tablette, essaie « Auto » dans les Paramètres.',
  ] },
  { id: 4, date: '31 octobre', title: 'Capes ajustées', items: [
    'Les capes d’objivants sont maintenant bien centrées dans le dos, plus larges, et descendent jusqu’aux mollets.',
  ] },
  { id: 3, date: '31 octobre', title: 'Corrections de la Garde-robe', items: [
    'Les capes d’équipement s’affichent de nouveau dans le dos de ton héros.',
    'Les capes d’objivants retrouvent leurs motifs.',
    'Les bottes montent maintenant jusqu’aux genoux et tombent bien sur les pieds.',
    'Dans l’aperçu, ton familier flotte un peu plus haut, à côté de ton héros.',
  ] },
  { id: 2, date: '31 octobre', title: 'Grande mise à jour des héros', items: [
    'Nouveaux héros : Chevalier, Barbare, Mage, Voleuse et Rôdeur. Choisis ton aventurier, puis ta classe.',
    'Les anciens guerriers deviennent des aventuriers : le Viking devient Barbare, le Spartiate Chevalier et le Pharaon Mage. Ta progression est gardée, et tu peux changer d\u2019aventurier dans la Garde-robe (onglet Apparence).',
    'Nouvelle classe : le Nécromancien (Caserne niveau 4). Son ultime « Armée des morts » relève 3 squelettes qui partent chasser les monstres.',
    'Nouveau monstre : la goule, dès la vague 7. Quand elle tombe, achève-la vite ou elle se relève !',
    'Équipements redessinés : nouvelles capes, casques, chapeaux (Heaume du Chevalier, Bonnet d\u2019Ours, Chapeau du Mage, Chapeau Grenouille, Tête de Citrouille) et bottes.',
    'Moteur 3D mis à jour et appli prête pour Android 16.',
  ] },
];
const NOTES_KEY = 'dernier-bastion-notes';
const notesSeen = () => { try { return +localStorage.getItem(NOTES_KEY) || 0; } catch (e) { return 0; } };
function openNotes() {
  const hc = save.heroChanged && TRIBES[save.tribe] ? `<p class="lookbox">Ton héros est devenu ${TRIBES[save.tribe].name === 'Voleuse' ? 'une' : 'un'} <b>${TRIBES[save.tribe].name}</b> ! Tu peux choisir un autre aventurier dans la Garde-robe (onglet Apparence).</p>` : '';
  $('patchList').innerHTML = hc + PATCH_NOTES.map(n => `<section class="patch-note"><h3>${escH(n.title)} <small>${escH(n.date)}</small></h3><ul>${n.items.map(i => `<li>${escH(i)}</li>`).join('')}</ul></section>`).join('');
  try { localStorage.setItem(NOTES_KEY, String(PATCH_NOTES[0].id)); } catch (e) {}
  if (save.heroChanged) { save.heroChanged = false; persist(); }
  openModal('patchM');
}
function deleteSlot(n) {
  if (SM.del !== n) { SM.del = n; renderSlotMenu(); return; }
  SM.del = 0;
  try { localStorage.removeItem(slotKey(n)); } catch (e) {}
  if (n === SLOT) SAVE_KEY = '';   // plus rien n'est enregistré tant qu'on n'a pas choisi un autre personnage
  $('smBack').hidden = true;
  renderSlotMenu();
}
// Change de sauvegarde sans recharger : on reconstruit ce qui dépend de la progression
function switchSave(n) {
  persist();
  const keep = {}; for (const k of ['sound', 'music', 'gfx', 'gfxManual', 'camMode', 'bzoom']) keep[k] = save[k];
  SLOT = n; SAVE_KEY = slotKey(n); try { localStorage.setItem(SLOT_KEY, String(n)); } catch (e) {}
  save = readSave(SAVE_KEY); Object.assign(save, keep); topUp(); persist();
  HS.key = null; for (const k in snapCache) delete snapCache[k]; PREVIEW = null;
  if (V.ok) {
    for (const id in V.bld) buildBuilding(id);
    if (V.troops) { V.troops.forEach(t => V.scene.remove(t.g)); V.troops = null; }
    rebuildHero(); if (tribeId()) spawnTroops();
    refreshPetSprite();
    if (V.homeShell) { buildHomeShell(); for (const [slot] of DECO_SLOTS) if (slot !== 'walls') buildHomeFurniture(slot); }
    if (V.bunker && V.bunker.chest) { const I = V.bunker.chest.userData.inst, cl = I.clip('Chest_Open'); I.mixer.setTime(save.bunkerLoot ? cl.duration * 0.999 : 0); }
    V.P.x = 0; V.P.z = -11; V.P.rot = 0; placeHeroCam(true);
  }
  updateVhud(); refreshChestBtn(); refreshSoundBtn(); applyGfx();
}

// ---------- Métiers (pré-version : activés dans les Paramètres) ----------
// Les ressources tombent à la fin d'une partie du Bastion : plus la vague est haute, plus il y en a et plus elles sont rares.
const RES_TIERS = [
  { name: 'commun', p: 0.66, col: '#cfc9de' }, { name: 'peu commun', p: 0.45, col: '#4fbf5a' },
  { name: 'rare', p: 0.25, col: '#3db8ff' }, { name: 'épique', p: 0.12, col: '#c98aff' },
];
const RES = {
  plume:   { name: 'Plume',              ico: '🪶', tier: 0, w: 1,  kind: 'monstre' },
  bois:    { name: 'Morceau de bois',    ico: '🪵', tier: 0, w: 1,  kind: 'bois' },
  laine:   { name: 'Laine épaisse',   ico: '🧶', tier: 0, w: 1,  kind: 'monstre' },
  pierre:  { name: 'Pierre',             ico: '🪨', tier: 0, w: 1,  kind: 'mine' },
  herbe:   { name: 'Herbe médicinale',   ico: '🌿', tier: 0, w: 1,  kind: 'bois' },
  cuir:    { name: 'Cuir de sanglier',   ico: '🐗', tier: 1, w: 10, kind: 'monstre' },
  fer:     { name: 'Minerai de fer',     ico: '⛓️', tier: 1, w: 10, kind: 'mine' },
  os:      { name: 'Os',                 ico: '🦴', tier: 1, w: 10, kind: 'monstre' },
  champi:  { name: 'Champignon lumineux', ico: '🍄', tier: 1, w: 10, kind: 'bois' },
  ecaille: { name: 'Écaille de dragon',  ico: '🐉', tier: 2, w: 20, kind: 'monstre' },
  cristal: { name: 'Cristal',            ico: '🔮', tier: 2, w: 20, kind: 'mine' },
  seve:    { name: 'Sève ancienne',      ico: '🍯', tier: 2, w: 20, kind: 'bois' },
  etoile:  { name: 'Poussière d’étoile', ico: '✨', tier: 3, w: 30, kind: 'mine' },
  dent:    { name: 'Croc de Dragon',     ico: '🦷', tier: 3, w: 40, kind: 'monstre' },
  plumeC:  { name: 'Corne de Démon',     ico: '😈', tier: 3, w: 45, kind: 'monstre' },
};
const JOBS = {
  bucheron:   { name: 'Bûcheron',   ico: '🪓', kind: 'bois', desc: 'Trouve plus de bois, d’herbes et de sève dans le butin.' },
  mineur:     { name: 'Mineur',     ico: '⛏️', kind: 'mine', desc: 'Trouve plus de pierre, de minerai et de cristaux dans le butin.' },
  alchimiste: { name: 'Alchimiste', ico: '⚗️', desc: 'Prépare des potions bues au début de la partie suivante.' },
  forgeron:   { name: 'Forgeron',   ico: '🔨', desc: 'Fabrique les équipements (chapeaux, capes, bottes) : ils ne s’achètent plus.' },
};
// Recettes du Forgeron : chaque équipement de la garde-robe
const GEAR_RECIPES = {
  bonnet:  { lvl: 1,  need: { plume: 1, bois: 1 } },
  capeB:   { lvl: 1,  need: { laine: 2, plume: 1 } },
  bottesL: { lvl: 1,  need: { laine: 1, bois: 1 } },
  aventu:  { lvl: 3,  need: { cuir: 2, plume: 3, bois: 2 } },
  capeA:   { lvl: 3,  need: { cuir: 3, laine: 3 } },
  bottesT: { lvl: 3,  need: { cuir: 2, os: 2 } },
  craq:    { lvl: 6,  need: { fer: 4, pierre: 6, cristal: 1 } },
  capeT:   { lvl: 6,  need: { seve: 2, cuir: 4, ecaille: 1 } },
  bottesS: { lvl: 6,  need: { ecaille: 2, fer: 3, champi: 3 } },
  casquette: { lvl: 1, need: { laine: 2, bois: 1 } },
  goupil:  { lvl: 3,  need: { cuir: 2, laine: 3 } },
  pistolero: { lvl: 3, need: { cuir: 3, plume: 2 } },
  lunaire: { lvl: 6,  need: { cristal: 2, seve: 1, laine: 4 } },
  soleil:  { lvl: 6,  need: { seve: 2, bois: 6, ecaille: 1 } },
  dHelm:   { lvl: 10, need: { dent: 2, ecaille: 4, etoile: 2 } },
  dCape:   { lvl: 10, need: { plumeC: 2, ecaille: 5, seve: 3 } },
  dBoots:  { lvl: 10, need: { dent: 1, plumeC: 1, cristal: 4, etoile: 1 } },
};
// Potions de l'Alchimiste : une de chaque est bue au début de la partie suivante
const POTIONS = {
  vie:     { name: 'Potion de vie',     ico: '❤️', lvl: 1,  need: { herbe: 3, bois: 1 },              desc: '+25 % de PV max' },
  vitesse: { name: 'Potion de vitesse', ico: '💨', lvl: 3,  need: { herbe: 2, champi: 2, plume: 2 },  desc: '+12 % de vitesse' },
  force:   { name: 'Potion de force',   ico: '💪', lvl: 6,  need: { champi: 3, os: 2, cristal: 1 },   desc: '+20 % de dégâts' },
  chance:  { name: 'Potion de chance',  ico: '🍀', lvl: 10, need: { etoile: 1, seve: 2 },             desc: '+50 % de butin à la fin' },
};
const jobsOn = () => !!save.jobs;
const jobXp = id => (save.jobXp || {})[id] || 0;
const jobLvl = id => Math.min(20, 1 + Math.floor(Math.sqrt(jobXp(id) / 25)));
const jobXpAt = l => 25 * (l - 1) * (l - 1);
function addJobXp(id, n) {
  const before = jobLvl(id);
  save.jobXp = Object.assign({}, save.jobXp); save.jobXp[id] = jobXp(id) + n;
  return jobLvl(id) > before;
}
const resHave = id => (save.res || {})[id] || 0;
const canPay = need => Object.entries(need).every(([id, n]) => resHave(id) >= n);
function pay(need) { save.res = Object.assign({}, save.res); for (const [id, n] of Object.entries(need)) save.res[id] = resHave(id) - n; }
// Butin de fin de partie
function rollLoot(wave, mult) {
  const out = {};
  if (wave < 1) return out;
  for (const id in RES) {
    const r = RES[id], T = RES_TIERS[r.tier]; if (wave < r.w) continue;
    const job = r.kind === 'bois' ? 'bucheron' : r.kind === 'mine' ? 'mineur' : null, L = job ? jobLvl(job) : 1;
    const p = T.p * Math.min(1, 0.5 + 0.5 * (wave - r.w + 1) / 10) * (1 + 0.03 * (L - 1)) * (mult || 1);
    if (Math.random() < Math.min(0.95, p)) out[id] = 1 + Math.floor(Math.random() * (1 + (wave - r.w) / (6 + r.tier * 4))) + (job ? Math.floor(L / 5) : 0);
  }
  return out;
}
function gainLoot(loot) {
  save.res = Object.assign({}, save.res); const ups = [];
  for (const [id, n] of Object.entries(loot)) {
    save.res[id] = resHave(id) + n;
    const kind = RES[id].kind, job = kind === 'bois' ? 'bucheron' : kind === 'mine' ? 'mineur' : null;
    if (job && addJobXp(job, n * 8)) ups.push(job);
  }
  return ups;
}
// Potions bues au début d'une partie
function drinkPotions(p) {
  const used = [];
  if (!jobsOn() || !save.potions) return used;
  save.potions = Object.assign({}, save.potions);
  for (const id in POTIONS) {
    if (!(save.potions[id] > 0)) continue;
    save.potions[id]--; used.push(id);
    if (id === 'vie') p.maxHp *= 1.25; else if (id === 'vitesse') p.speed *= 1.12; else if (id === 'force') p.dmg *= 1.2; else if (id === 'chance') p.lootMult = 1.5;
  }
  if (used.length) persist();
  return used;
}
const resChip = (id, n, have) => `<span class="rchip${have !== undefined && have < n ? ' miss' : ''}" style="--tc:${RES_TIERS[RES[id].tier].col}" title="${RES[id].name}"><i>${RES[id].ico}</i>${have !== undefined ? have + ' / ' + n : '×' + n}</span>`;
let jobsTab = 'res';
function openJobs(tab) { if (tab) jobsTab = tab; renderJobs(); openModal('jobsM'); }
function renderJobs() {
  $('jobsList').innerHTML = Object.entries(JOBS).map(([id, J]) => {
    const l = jobLvl(id), a = jobXpAt(l), b = jobXpAt(l + 1), pc = l >= 20 ? 100 : Math.round((jobXp(id) - a) / (b - a) * 100);
    return `<div class="job"><span class="jico">${J.ico}</span><b>${J.name}</b><small>Niveau ${l}</small><span class="jbar"><i style="width:${pc}%"></i></span><p>${J.desc}</p></div>`;
  }).join('');
  document.querySelectorAll('#jobsTabs [data-jtab]').forEach(b => b.classList.toggle('on', b.dataset.jtab === jobsTab));
  let html = '';
  if (jobsTab === 'res') {
    html = `<p class="jhint">Les ressources tombent à la fin d’une partie du Bastion. Plus tu vas loin dans les vagues, plus il y en a, et plus elles sont rares (mais plus difficiles à obtenir).</p><div class="rgrid">` +
      Object.entries(RES).map(([id, r]) => `<div class="rcell${resHave(id) ? '' : ' none'}" style="--tc:${RES_TIERS[r.tier].col}"><i>${r.ico}</i><b>${resHave(id)}</b><span>${r.name}</span><small>${RES_TIERS[r.tier].name} · dès la vague ${r.w}</small></div>`).join('') + '</div>';
  } else if (jobsTab === 'forge') {
    const L = jobLvl('forgeron');
    html = `<div class="recipes">` + Object.entries(GEAR_RECIPES).map(([id, R]) => {
      const it = ITEMS[id], owned = save.items[id], ok = L >= R.lvl && canPay(R.need);
      const btn = owned ? `<button class="btn alt" disabled>Déjà fabriqué</button>` : L < R.lvl ? `<button class="btn" disabled>Forgeron niv. ${R.lvl}</button>` : `<button class="btn" data-craft="${id}" ${ok ? '' : 'disabled'}>Fabriquer</button>`;
      return `<div class="recipe ${RAR[it.rar].cls}"><div class="rtop"><b>${it.name}</b><span class="rar">${it.rar}</span></div><small>${statLines(it.stats).join(' · ')}</small><div class="rneed">${Object.entries(R.need).map(([r, n]) => resChip(r, n, resHave(r))).join('')}</div>${btn}</div>`;
    }).join('') + '</div>';
  } else {
    const L = jobLvl('alchimiste');
    html = `<p class="jhint">Une potion de chaque sorte est bue automatiquement au début de ta prochaine partie du Bastion.</p><div class="recipes">` + Object.entries(POTIONS).map(([id, P]) => {
      const n = (save.potions || {})[id] || 0, ok = L >= P.lvl && canPay(P.need);
      const btn = L < P.lvl ? `<button class="btn" disabled>Alchimiste niv. ${P.lvl}</button>` : `<button class="btn" data-brew="${id}" ${ok ? '' : 'disabled'}>Préparer</button>`;
      return `<div class="recipe"><div class="rtop"><b>${P.ico} ${P.name}</b><span class="rar">en stock : ${n}</span></div><small>${P.desc}</small><div class="rneed">${Object.entries(P.need).map(([r, q]) => resChip(r, q, resHave(r))).join('')}</div>${btn}</div>`;
    }).join('') + '</div>';
  }
  $('jobsBody').innerHTML = html;
}
function craftGear(id) {
  const R = GEAR_RECIPES[id]; if (!R || save.items[id] || jobLvl('forgeron') < R.lvl || !canPay(R.need)) return;
  pay(R.need); save.items[id] = true;
  const up = addJobXp('forgeron', [20, 40, 70, 120][Math.min(3, Math.floor(R.lvl / 3))]);
  persist(); sfx('level'); renderJobs();
  banner('', ITEMS[id].name + ' fabriqué !' + (up ? ' · Forgeron niveau ' + jobLvl('forgeron') : ''));
}
function brewPotion(id) {
  const P = POTIONS[id]; if (!P || jobLvl('alchimiste') < P.lvl || !canPay(P.need)) return;
  pay(P.need); save.potions = Object.assign({}, save.potions); save.potions[id] = (save.potions[id] || 0) + 1;
  const up = addJobXp('alchimiste', 15 + P.lvl * 3);
  persist(); sfx('coin'); renderJobs();
  banner('', P.name + ' prête !' + (up ? ' · Alchimiste niveau ' + jobLvl('alchimiste') : ''));
}

// --- Troupes de la tribu qui vivent au village ---
function spawnTroops(reset) {
  if (!V.ok || !tribeId()) return;
  if (V.troops && !reset) return;
  if (V.troops) V.troops.forEach(t => { V.scene.remove(t.g); if (t.g.userData.quaternius) CharacterModels.dispose(t.g); });
  V.troops = [];
  // plus d'humains au village : les troupes ne sont plus affichées
}
function updateTroops(dt) {
  if (!V.troops) return;
  const P = V.P, far = CULL_FAR() + 4;
  for (const tr of V.troops) {
    tr.t += dt;
    const d0 = Math.hypot(tr.g.position.x - P.x, tr.g.position.z - P.z); tr.g.visible = !V.inside && d0 < far;
    if (!tr.g.visible) continue;
    if (tr.pause > 0) { tr.pause -= dt; if(tr.g.userData.quaternius)CharacterModels.animate(THREE,tr.g,tr.t*7,false);else tr.I.mixer.setTime(wTime('idle', tr.t / 11.3)); continue; }
    const tgt = tr.pts[tr.i], dx = tgt[0] - tr.g.position.x, dz = tgt[1] - tr.g.position.z, d = Math.hypot(dx, dz);
    if (d < 0.25) { tr.i = (tr.i + 1) % tr.pts.length; tr.pause = 2 + Math.random() * 4; continue; }
    const st = Math.min(d, 2.2 * dt); tr.g.position.x += dx / d * st; tr.g.position.z += dz / d * st;
    let a = Math.atan2(dx, dz) - tr.g.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); tr.g.rotation.y += a * Math.min(1, dt * 6);
    if(tr.g.userData.quaternius)CharacterModels.animate(THREE,tr.g,tr.t*7,true);else tr.I.mixer.setTime(wTime('run', tr.t * 1.25));
  }
}

// --- Musique : fichiers à part (dossier music/), libres de droits (CC0) ---
// village : « Town Theme RPG » et combat : « Battle Theme A » de cynicmusic ; Loup-Garou : « Dark Shrine Loop » de qubodup
// Royaume Sucré : « Happy Adventure (Loop) » de TinyWorlds
const MUSIC = { village: ['music/village.mp3', 0.4], loup: ['music/loup-garou.mp3', 0.6], combat: ['music/combat.mp3', 0.3], candy: ['music/candy.mp3', 0.35] };
const MU = { el: {}, on: false };
function musicWant() {
  if (!save.music || !save.sound || document.hidden) return null;
  return state === 'wolf' ? 'loup' : state === 'candy' ? 'candy' : (state === 'play' || state === 'levelup' || state === 'pause') ? 'combat' : 'village';
}
function updateMusic() {
  if (!MU.on) return;
  const want = musicWant();
  for (const id in MUSIC) {
    const target = id === want ? MUSIC[id][1] * (state === 'pause' ? 0.4 : 1) : 0;
    let a = MU.el[id];
    if (!a) { if (!target) continue; a = MU.el[id] = new Audio(MUSIC[id][0]); a.loop = true; a.volume = 0; }
    // fondu enchaîné d'environ une seconde
    a.volume = Math.max(0, Math.min(1, a.volume + Math.max(-0.05, Math.min(0.05, target - a.volume))));
    if (target > 0 && a.paused) { if (id !== 'village') a.currentTime = 0; a.play().catch(() => {}); }
    if ((!target && a.volume < 0.01 && !a.paused) || document.hidden) { a.volume = target ? a.volume : 0; if (!a.paused) a.pause(); }
  }
}
// le navigateur n'autorise le son qu'après un premier geste du joueur
const musicUnlock = () => { if (MU.on) return; MU.on = true; updateMusic(); };
addEventListener('pointerdown', musicUnlock, true); addEventListener('keydown', musicUnlock, true);
document.addEventListener('visibilitychange', updateMusic);
setInterval(updateMusic, 100);

// --- Taille de l'interface : la même interface sur tablette et sur téléphone (zoom CSS des fenêtres et menus) ---
// (réglage propre à l'appareil, gardé à part des emplacements de personnage)
let UIZ = 1;
// par défaut 100 % (bien sur téléphone dès le premier lancement) ; sur tablette, « Auto » peut être choisi dans les Paramètres
const uizPref = () => { let v = '1'; try { v = localStorage.getItem('dernier-bastion-uiz') || '1'; } catch (e) {} return v === 'auto' ? v : +v || 'auto'; };
const uiAuto = () => Math.round(Math.max(0.55, Math.min(1, innerWidth / 1100, innerHeight / 600)) * 100) / 100;
function applyUI() {
  const pref = uizPref(); UIZ = pref === 'auto' ? uiAuto() : pref;
  document.documentElement.style.setProperty('--uiz', UIZ);
  if (state === 'candy' && CC.view === 'play') ccResize();
}
addEventListener('resize', () => { if (uizPref() === 'auto') applyUI(); });
// --- Paramètres du jeu ---
let devOpen = false;
function renderSettings() {
  const row = (key, title, desc) => `<label class="set-row"><span><b>${title}</b><small>${desc}</small></span><button class="toggle${save[key] ? ' on' : ''}" data-set="${key}" aria-pressed="${!!save[key]}">${save[key] ? 'On' : 'Off'}</button></label>`;
  $('setList').innerHTML =
    `<label class="set-row"><span><b>Nom du personnage</b><small>Affiché sur l’écran d’accueil et à la fin des combats.</small></span><input id="setName" class="set-name" maxlength="16" value="${escH(heroName(save))}"></label>` +
    `<div class="set-row uiz-row"><span><b>Taille de l’interface</b><small>Réduis-la si les fenêtres dépassent de l’écran (téléphone). « Normal » = 100 %, conseillé sur téléphone. Sur tablette, essaie « Auto » : il s’adapte à l’écran : ${Math.round(uiAuto() * 100)} % ici.</small></span><div class="uiz-btns">${['auto', 1, 0.85, 0.7, 0.6, 0.5].map(v => `<button class="toggle${uizPref() === v ? ' on' : ''}" data-uiz="${v}">${v === 'auto' ? 'Auto' : v === 1 ? 'Normal (100 %)' : Math.round(v * 100) + ' %'}</button>`).join('')}</div></div>` +
    (window.BastionAndroid && BastionAndroid.gameVersion ? `<p class="set-version" data-ver>Version du jeu : ${verName(BastionAndroid.gameVersion())}${BastionAndroid.updateChannel && BastionAndroid.updateChannel() === 'test' ? ' (test)' : ''} · les mises à jour s’installent toutes seules.</p>` : '') +
    // réglage caché (5 touches sur la ligne de version) : recevoir les versions de test avant tout le monde
    (save.devMode && window.BastionAndroid && BastionAndroid.setUpdateChannel ? `<div class="set-row"><span><b>Canal des mises à jour</b><small>« Test » reçoit chaque nouvelle version tout de suite ; « Stable » seulement celles publiées pour tout le monde.</small></span><div class="row-btns"><button class="btn${BastionAndroid.updateChannel() === 'test' ? ' alt' : ''}" data-chan="stable">Stable</button><button class="btn${BastionAndroid.updateChannel() === 'test' ? '' : ' alt'}" data-chan="test">Test</button></div></div>` : '') +
    `<div class="row-btns"><button class="btn alt" data-bench>Test de performance du village (1 min)</button></div>` +
    `<div class="row-btns"><button class="btn alt" data-tutorial>Revoir le tutoriel</button><button class="btn alt" data-slots>Changer de personnage</button></div>` +
    row('music', 'Musique', 'Douce au village, inquiétante au Loup-Garou, entraînante au combat, joyeuse au Royaume Sucré (le bouton « Son » coupe tout).') +
    row('npcTalk', 'Dialogues automatiques des PNJ', 'Petites bulles humoristiques au village. Tessa peut aussi lancer ses répliques pendant ses promenades. Lui parler reste possible avec les bulles automatiques coupées.') +
    row('fps', 'Compteur d’images par seconde', 'Affiche la fluidité en haut de l’écran (60 = parfait, moins de 30 = ça rame).') +
    `<div class="row-btns"><button class="btn alt" data-appearance>Modifier mon personnage</button></div>` +
    '<div class="row-btns"><button class="btn alt" data-notes>Notes de mise à jour</button></div>' +
    row('tribeSwap', 'Changer de tribu', 'Ajoute un bouton « Changer de tribu » à la caserne.') +
    (save.tribeSwap ? `<div class="row-btns"><button class="btn alt" data-retribe>Changer de tribu maintenant</button></div>` : '') +
    // mode développeur : ce qui n'est pas encore terminé (métiers, attaques surprises, mode test)
    `<div class="row-btns"><button class="btn${devOpen ? '' : ' alt'}" data-devmode>${devOpen ? 'Fermer le mode développeur' : 'Mode développeur'}</button></div>` +
    (devOpen ? `<p class="sub">Fonctions en cours de développement : elles peuvent changer ou mal marcher.</p>` +
      row('jobs', 'Métiers (pré-version)', 'Bûcheron, Mineur, Alchimiste, Forgeron : butin en fin de combat, les équipements se fabriquent au lieu de s’acheter.') +
      (save.jobs ? `<div class="row-btns"><button class="btn" data-jobs>Ouvrir les métiers</button></div>` : '') +
      `<div class="row-btns"><button class="btn alt" data-updates>Mises à jour GitHub</button></div><p class="sub">Ouvre la page de téléchargement de l’application (APK). Le jeu, lui, se met à jour tout seul : ce bouton ne sert que si l’application Android elle-même change.</p>` +
      `<div class="set-row"><span><b>Tester un boss</b><small>Lance une partie avec ce boss tout de suite (pour voir son modèle et ses attaques).</small></span><div class="row-btns">${BOSSES.map((B, i) => `<button class="btn alt" data-devboss="${i}">${B.name}</button>`).join('')}</div></div>` +
      row('raids', 'Attaques surprises', 'Test : de temps en temps, une alerte prévient que le village est attaqué.') +
      `<label class="set-row"><span><b>Mode test</b><small>Pièces et gemmes illimitées (code demandé). En le quittant, tu repars avec 500 pièces et 10 gemmes.</small></span><button class="toggle${save.testMode ? ' on' : ''}" data-testmode aria-pressed="${!!save.testMode}">${save.testMode ? 'On' : 'Off'}</button></label>` : '') +
    `<details class="credits"><summary>Crédits</summary>
      <p><b>Musiques</b> (CC0, domaine public) : « Town Theme RPG » et « Battle Theme A » par cynicmusic (cynicmusic.com, pixelsphere.org) · « Dark Shrine Loop » par qubodup, d’après « Shrine » de yd · « Happy Adventure (Loop) » par TinyWorlds — OpenGameArt.org</p>
      <p><b>Gobelin de la maison</b> : « Goblin » par Quaternius, téléchargé sur Poly Pizza, licence CC0.</p>
      <p><b>Aventuriers (Chevalier, Barbare, Mage, Voleuse, Rôdeur) et squelettes du Nécromancien</b> : packs « KayKit Adventurers » et « KayKit Skeletons » par Kay Lousberg, www.kaylousberg.com, licence CC0.</p>
      <p><b>Goules</b> : « Zombie » par Quaternius, licence CC0.</p>
      <p><b>Équipements</b> : « Frog Hat » par J-Toastie (Poly Pizza, licence CC BY 4.0) · citrouille « KayKit Halloween Bits » par Kay Lousberg (CC0) · « Boots » par Isa Lousberg (CC0).</p>
      <p><b>Village, meubles, nature, coffre, monstres</b> (CC0) : packs de Quaternius (quaternius.com)</p>
      <p><b>Sols</b> (terre de forêt, sable, galets, terrain rocheux, sillons de champ) : textures Poly Haven 1K, licence CC0 (herbe, terre, sable, galets, roche, neige, sillons, sol fissuré, pavés et parquet). Fichiers embarqués hors ligne.</p>
      <p><b>Feu de camp du Loup-Garou</b> (feu, sapins, souches, rondins) : modèle « Stylized Campfire »</p>
      <p><b>Bunker secret</b> : « Underground Bunker » par Bohdan Lvov, Sketchfab, licence CC BY 4.0 (toit et herbe retirés)</p>
      <p><b>Personnages, coiffures et tenues</b> : Quaternius · Universal Base Characters et Modular Character Outfits Fantasy, versions Standard CC0.</p>
      <p><b>Montures</b> (Sketchfab, licence CC BY 4.0) : « Basic Carnotaurus Model » par Jazzi Crystol · « Felstrider Mount » par Spinnee · « Mountain Dragon » par Alexey Zaika</p>
      <p><b>Boss</b> : « Creep Creature » et « Forest Guard » (CGTrader, licence Royalty Free)</p>
      <p><b>Anciens guerriers de tribu</b> : « Free Warriors » (CGTrader) · familiers et habitants : modèles 3D de Sketchfab et Fab</p>
      <p><b>Chapeaux et armes</b> : packs « Cosmetic Pack Two » et « Ultimate Guns Pack » (Quaternius) · « Sombrero » par hat my guy (Poly Pizza)</p>
      <p><b>Moteur 3D</b> : three.js (licence MIT)</p>
    </details>`;
}
// --- Attaques surprises (pré-test) : une alerte, puis on part défendre au Bastion ---
function updateRaids(dt) {
  if (!save.raids || V.inside || state !== 'village') return;
  V.raidT = (V.raidT === undefined ? 90 + Math.random() * 120 : V.raidT) - dt;
  if (V.raidT > 0 || !$('raidAlert').hidden) return;
  V.raidT = 180 + Math.random() * 240;
  $('raidAlert').hidden = false; sfx('hurt');
}

const TUTORIAL_STEPS = [
  ['Bienvenue au Bastion !','Voici ton village. Ce petit tour explique les commandes et les activités. Tu peux passer le tutoriel à tout moment et le retrouver dans les paramètres.'],
  ['Se déplacer','Sur tablette ou téléphone : le pouce gauche déplace le héros, glisser à droite tourne la caméra. Sur ordinateur : utilise ZQSD, WASD ou les flèches. Approche-toi des bâtiments pour afficher leurs actions.'],
  ['Le portail','Approche-toi de la fontaine-portail pour choisir Le Bastion, Loup-Garou ou Royaume Sucré. Dans Le Bastion, les tirs sont automatiques : évite les ennemis et utilise tes compétences. Tu peux choisir au maximum une amélioration par vague.'],
  ['Faire grandir le village','La mine produit des pièces. Les bâtiments améliorent ton héros. La garde-robe change son apparence. Dans ta maison, approche-toi du gobelin et choisis « Parler à Tessa ».'],
  ['Inviter un ami','Ouvre Amis, crée une session avec ton #identifiant et garde le jeu ouvert. Ton ami demande à rejoindre : accepte sa demande pour le laisser entrer. Une visite ne lui permet pas de modifier ton village.'],
  ['Prêt à jouer !','Le chat écrit et le micro se trouvent dans le panneau Amis. Les petites bulles des PNJ se désactivent dans les paramètres. Ta progression est enregistrée sur cet appareil, séparément pour chaque personnage.']
];
let tutorialStep=0;
function drawTutorial(){const step=TUTORIAL_STEPS[tutorialStep];$('tutorialTitle').textContent=step[0];$('tutorialText').textContent=step[1];$('tutorialProgress').textContent=(tutorialStep+1)+' / '+TUTORIAL_STEPS.length;$('tutorialPrev').disabled=tutorialStep===0;$('tutorialNext').textContent=tutorialStep===TUTORIAL_STEPS.length-1?'Jouer !':'Suivant';}
function startTutorial(force=false){if(!force&&(save.tutorialDone||!tribeId()||!$('slotMenu').hidden))return;tutorialStep=0;resetVjoy();$('tutorialM').hidden=false;drawTutorial();}
function endTutorial(){save.tutorialDone=true;persist();$('tutorialM').hidden=true;}
$('tutorialNext').onclick=()=>{if(tutorialStep===TUTORIAL_STEPS.length-1)endTutorial();else{tutorialStep++;drawTutorial();}};
$('tutorialPrev').onclick=()=>{tutorialStep=Math.max(0,tutorialStep-1);drawTutorial();};
$('tutorialSkip').onclick=endTutorial;
document.addEventListener('click',e=>{if(e.target.closest('[data-tutorial]')){$('setM').hidden=true;startTutorial(true);}});
document.addEventListener('click',e=>{if(e.target.closest('[data-bench]')){$('setM').hidden=true;perfBench();}});
const devTap = { n: 0, t: 0 };
document.addEventListener('click', e => {
  if (e.target.closest('[data-ver]')) { const now = Date.now(); devTap.n = now - devTap.t < 1500 ? devTap.n + 1 : 1; devTap.t = now; if (devTap.n >= 5 && !save.devMode) { save.devMode = true; persist(); renderSettings(); banner('Mode créateur', 'Le canal des mises à jour est dans les Paramètres.'); } }
  const ch = e.target.closest('[data-chan]');
  if (ch && window.BastionAndroid && BastionAndroid.setUpdateChannel) { BastionAndroid.setUpdateChannel(ch.dataset.chan); renderSettings(); banner(ch.dataset.chan === 'test' ? 'Versions de test' : 'Versions stables', ch.dataset.chan === 'test' ? 'La dernière version est vérifiée…' : 'Tu recevras la prochaine version publiée pour tout le monde.'); }
});
// Test de performance : on coupe tour à tour chaque élément du village pendant quelques secondes et on compte
// les images par seconde, pour savoir exactement ce qui coûte sur l'appareil (le héros reste immobile).
async function perfBench() {
  if (!V.ok || V.inside) { banner('Test de performance', 'Lance-le dehors, au village.'); return; }
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:10px;top:10px;z-index:1000;background:rgba(20,12,40,.9);color:#fff;font:600 13px/1.45 Nunito,sans-serif;padding:10px 12px;border-radius:12px;max-width:min(92vw,420px);white-space:pre-wrap';
  document.body.appendChild(box);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const fps = () => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3500) requestAnimationFrame(f); else r(Math.round(n * 1000 / (performance.now() - t0))); }; requestAnimationFrame(f); });
  const hideAll = list => { const was = list.map(o => [o, o.visible]); list.forEach(o => { o.visible = false; }); return () => was.forEach(([o, v]) => { o.visible = v; }); };
  const meshes = f => { const out = []; V.scene.traverse(o => { if (f(o)) out.push(o); }); return out; };
  const chars = () => [V.hero, V.pet3D, V.homeGoblin, V.builder, ...(V.troops || []).map(t => t.g), ...V.scene.children.filter(g => g.userData && (g.userData.quaternius || g.userData.inst))].filter(Boolean);
  const tests = [
    ['Normal', () => () => {}],
    ['Sans ombres', () => { V.sun.castShadow = false; return () => { V.sun.castShadow = true; }; }],
    ['Ombres sans mémoire', () => { shadowCacheRestore(); SHC.on = false; return () => { SHC.on = true; SHC.next = 0; }; }],
    ['Ombres à chaque image', () => { const o = save.gfx; V.shEvery = true; return () => { V.shEvery = false; }; }],
    ['Résolution × 0,75', () => { V.renderer.setPixelRatio(gfxPixelRatio() * 0.75); return () => applyGfx(); }],
    ['Sans herbe ni plantes (instances)', () => hideAll(meshes(o => o.isInstancedMesh))],
    ['Sans personnages', () => hideAll(chars())],
    ['Sans petits objets', () => { const c = V.cull; V.cull = null; const back = hideAll(c.map(x => x.o)); return () => { V.cull = c; back(); }; }],
    ['Sans contours noirs', () => hideAll(meshes(o => o.userData && o.userData.outline))],
    ['Sans bâtiments', () => hideAll(Object.values(V.bld).map(b => b.group))],
  ];
  const rows = []; V.bench = true;
  for (const [name, apply] of tests) {
    box.textContent = 'Test de performance… ne touche à rien\n\n' + rows.join('\n') + '\n▶ ' + name;
    const undo = apply(); await wait(1200);
    const f = await fps();
    rows.push(name + ' : ' + f + ' img/s'); undo(); await wait(400);
  }
  V.bench = false; const r = V.renderer, sz = r.getDrawingBufferSize(new THREE.Vector2());
  box.textContent = 'Résultats (' + (save.gfx === 'fast' ? 'fluide' : 'beau') + ', image ' + sz.x + '×' + sz.y + ')\n\n' + rows.join('\n') + '\n\nFais une capture d’écran et envoie-la. Touche pour fermer.';
  box.onclick = () => box.remove();
}
const NPC_LINES={
  tigre:{name:'La sorcière',lines:['Venez acheter vos familiers ! Garantis presque sans malédiction.','J’ai de bons œufs : soit pour la compagnie, soit pour l’omelette. À vous de voir.','Un œuf de la nuit ? Il en sort parfois un dragon. Parfois une chauve-souris. Jamais d’omelette.','Les familiers, c’est comme les potions : on en prend un, on en veut dix.','Œufs frais du jour ! Enfin… du siècle. Mais très bien conservés.','Mon dernier client voulait un dragon. Il est reparti avec un champignon. Il l’adore.','Ma potion rend invisible. Enfin… surtout les pièces de ton porte-monnaie.']},
  renardlunettes:{name:'Le renard',lines:['Ces lunettes ? Pour voir les promotions avant tout le monde.','La cape est héroïque. La facture aussi.','J’ai essayé un casque invisible. Impossible de le retrouver.']},
  chatbleu:{name:'Le chat voyageur',lines:['Je suis venu sauver le monde. Mais d’abord : une petite sieste.','Ne touche pas à ma statue. Elle travaille ma réputation.','Neuf vies, et toujours pas assez de vacances.']},
  builder:{name:'L’ouvrier',lines:['Je construis solide. Sauf mes excuses pour la pause.','Le marteau travaille. Moi, je supervise.','La cabane tient debout : c’est déjà un excellent début.']}
};
const TESSA_LINES=['Moi, c’est Tessa ! Je paie mon loyer en bonne humeur. Et parfois en miettes.','J’ai rangé la maison. Si tu ne retrouves rien, c’est que j’ai très bien rangé.','Je garde les trésors. Les biscuits comptent comme des trésors, oui ?','Les loups-garous me font peur. Surtout quand ils demandent le Wi-Fi.','Une amélioration par vague ? Moi, j’améliore ma sieste à chaque repas.','As-tu un plaid rose ? Je fais une collection. Pour l’instant, j’en ai zéro.'];
const npcTalk={active:null,next:8,counters:{},tessa:0,turn:0};
function sayNpc(key,obj,name,text,manual=false){npcTalk.active={obj,name,text,left:6,manual};$('npcSpeaker').textContent=name;$('npcWords').textContent=text;}
function talkTessa(){if(!V.homeGoblin||V.inside==='bunker'||(V.inside===true)!==V.homeGoblin.userData.roam.inside||Math.hypot(V.P.x-V.homeGoblin.position.x,V.P.z-V.homeGoblin.position.z)>2.5)return;sayNpc('tessa',V.homeGoblin,'Tessa',TESSA_LINES[npcTalk.tessa++%TESSA_LINES.length],true);}
function updateNpcTalk(dt){
  const bubble=$('npcBubble');
  if(state!=='village'||!V.ok||anyModalOpen()||!$('slotMenu').hidden){bubble.hidden=true;return;}
  if(npcTalk.active){const a=npcTalk.active;a.left-=dt;if(a.left<=0||(!a.manual&&!save.npcTalk)||!a.obj.visible||Math.hypot(V.P.x-a.obj.position.x,V.P.z-a.obj.position.z)>9)npcTalk.active=null;}
  if(!npcTalk.active&&!V.inside&&save.npcTalk!==false){
    npcTalk.next-=dt;
    if(npcTalk.next<=0){
      const list=(V.extras||[]).filter(e=>NPC_LINES[e.id]&&!e.culled).map(e=>({key:e.id,obj:e.g}));if(V.builder)list.push({key:'builder',obj:V.builder});
      const near=list.filter(e=>Math.hypot(V.P.x-e.obj.position.x,V.P.z-e.obj.position.z)<8);
      if(near.length){const n=near[npcTalk.turn++%near.length],d=NPC_LINES[n.key],i=npcTalk.counters[n.key]||0;npcTalk.counters[n.key]=i+1;sayNpc(n.key,n.obj,d.name,d.lines[i%d.lines.length]);}
      npcTalk.next=16;
    }
  }
  const a=npcTalk.active;if(!a){bubble.hidden=true;return;}
  const p=a.obj.position.clone();p.y+=a.manual?2.2:3.1;p.project(V.camera);
  if(p.z<-1||p.z>1||Math.abs(p.x)>1.1||Math.abs(p.y)>1.1){bubble.hidden=true;return;}
  bubble.hidden=false;
  const width=bubble.offsetWidth,height=bubble.offsetHeight;
  bubble.style.left=clamp((p.x+1)*innerWidth/2-width/2,8,innerWidth-width-8)+'px';
  bubble.style.top=clamp((1-p.y)*innerHeight/2-height,85,innerHeight-height-12)+'px';
}
// --- Figurants du village : canards sur la rivière, statue du chat voyageur ---
function spawnVillageModels() {
  if (!V.ok || V.extras) return;
  V.extras = [];
  const T = THREE, riverZ = x => WALL + 5.2 + Math.sin(x * 0.13) * 1.4 + Math.sin(x * 0.37) * 0.5;
  const add = (id, x, z, ry, kind, extra) => {
    const g = modelInst(id); if (!g) return null;
    g.position.set(x, 0, z); g.rotation.y = ry || 0; V.scene.add(g);
    const e = Object.assign({ g, id, kind, t: Math.random() * 10 }, extra || {}); V.extras.push(e);
    const I = g.userData.inst; if (Object.keys(I.acts).length) I.play(Object.keys(I.acts)[0]);
    return e;
  };
  // deux canards qui nagent tranquillement sur la rivière
  add('canards', -6, riverZ(-6), Math.PI / 2, 'duck', { x: -6, dir: 1, riverZ });
  // statue du chat voyageur, sur un socle de pierre devant l'Hôtel de ville
  const face = (x, z) => Math.atan2(PLAZA[0] - x, PLAZA[1] - z);
  // la sorcière tigrée entre la forge et le laboratoire, le renard à lunettes devant la garde-robe
  add('tigre', 12.4, 9.2, face(12.4, 9.2), 'idle');
  add('renardlunettes', 3.4, 12.4, face(3.4, 12.4), 'still');
  // le chat voyageur à côté de sa propre statue
  add('chatbleu', -6.8, -3.2, face(-6.8, -3.2), 'still');
  for (const id in MED) if (V.bld[id]) buildBuilding(id);
  decorateVillage();
  natureVillage();
  // le familier avait peut-être été posé avant la fin du chargement (boule violette d'attente) : on le refait avec son modèle
  if (V.pet3D && V.pet3D.userData.id && PETS[V.pet3D.userData.id] && PETS[V.pet3D.userData.id].model && !V.pet3D.userData.mixer) { const old = V.pet3D.position.clone(); refreshPetSprite(); if (V.pet3D) V.pet3D.position.copy(old); }
  if (tribeId()) { rebuildHero(); spawnTroops(); }
  buildHatch();
  if (V.homeShell) { buildHomeShell(); for (const [slot] of DECO_SLOTS) if (slot !== 'walls') buildHomeFurniture(slot); }
  const st = add('chat', -8.2, -4.6, 0.9, 'statue');
  if (st) {
    st.g.position.y = 0.7; addOutline(st.g, 0.02);
    mk(new T.CylinderGeometry(0.75, 0.85, 0.7, 10), STONE(2, 1, '#cfc9de'), st.g.position.x, 0.35, st.g.position.z, V.scene);
  }
  spawnHomeGoblin();
  // les personnages et objets ajoutés ici ne projettent pas d'ombre s'ils sont petits
  lightenVillage(); applyGfx();
}
// ---------- Allègement : ce qui est loin du héros n'est ni dessiné ni animé ----------
const CULL_FAR = () => save.gfx === 'fast' ? 17 : 24;
function updateCull() {
  if (!V.cull && !V.extras) return;
  const P = V.P, far = CULL_FAR(), out = !!V.inside;
  if (V.cull) for (const c of V.cull) { const d = Math.hypot(c.o.position.x - P.x, c.o.position.z - P.z); c.o.visible = !out && (d < far || !!c.o.userData.vbWorld); }
  // le héros exposé devant la garde-robe (23 000 triangles) n'est dessiné que quand on passe à côté
  if (V.farHide) { const w = new THREE.Vector3(); V.farHide = V.farHide.filter(o => { for (let p = o; p; p = p.parent) if (p === V.scene) { o.getWorldPosition(w); o.visible = !out && Math.hypot(w.x - P.x, w.z - P.z) < 18; return true; } return false; }); }
  if (V.extras) for (const e of V.extras) { const d = Math.hypot(e.g.position.x - P.x, e.g.position.z - P.z); e.culled = out || d > far + 6; if (e.culled) e.g.visible = false; else e.g.visible = true; }
}
function updateVillageModels(dt) {
  if (!V.extras) return;
  V.cullT = (V.cullT || 0) - dt; if (V.cullT <= 0) { V.cullT = 0.3; updateCull(); }
  for (const e of V.extras) {
    const I = e.g.userData.inst; e.t += dt;
    if (e.culled) continue;
    if (e.kind === 'duck') {
      e.x += e.dir * dt * 0.7; if (e.x > 14) e.dir = -1; if (e.x < -14) e.dir = 1;
      e.g.position.set(e.x, 0.12 + Math.sin(e.t * 2.4) * 0.04, e.riverZ(e.x));
      const want = e.dir > 0 ? Math.PI / 2 : -Math.PI / 2; e.g.rotation.y += (want - e.g.rotation.y) * Math.min(1, dt * 2);
      e.g.rotation.z = Math.sin(e.t * 2.4) * 0.05;
    } else if (e.kind === 'walker') {
      const tgt = e.pts[e.i], dx = tgt[0] - e.g.position.x, dz = tgt[1] - e.g.position.z, d = Math.hypot(dx, dz);
      if (d < 0.2) e.i = (e.i + 1) % e.pts.length;
      else { const st = Math.min(d, e.sp * dt); e.g.position.x += dx / d * st; e.g.position.z += dz / d * st; let a = Math.atan2(dx, dz) - e.g.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); e.g.rotation.y += a * Math.min(1, dt * 5); }
    } else if (e.kind === 'still') {
      e.g.position.y = Math.abs(Math.sin(e.t * 1.6)) * 0.03;
    }
    I.mixer.update(dt);
  }
}

// --- Boss en 3D (Roi Champignon, Chef Tiki, Démon Rouge, Dragon Ancestral) : le modèle photographié de profil pour chaque image de ses animations ---
const BOSS3D = {
  mushking: { model: 'um_boss_mushking', ext: 1.55, clips: { walk: 'Walk', act: 'Punch', prep: 'Weapon', hit: 'HitReact' } },
  tiki:     { model: 'um_boss_tiki',     ext: 1.55, clips: { walk: 'Walk', act: 'Punch', prep: 'Weapon', hit: 'HitReact' } },
  demon:    { model: 'um_boss_demon',    ext: 1.55, clips: { walk: 'Walk', act: 'Punch', prep: 'Weapon', hit: 'HitReact' } },
  dragon:   { model: 'um_boss_dragon',   ext: 1.75, clips: { walk: 'Fast_Flying', act: 'Headbutt', prep: 'Punch', hit: 'HitReact' } },
  creep:    { model: 'boss_creep', ext: 1.75, walkSpan: 1.27, clips: { walk: 'Creep|Creep|Walk1_Action', act: 'Creep|Creep|Bite_Action', prep: 'Creep|Creep|Roar_Action', hit: 'Creep|Creep|Damage_Action' } },
  guard:    { model: 'boss_guard', ext: 1.6,  clips: { walk: 'Walk', act: 'Attack1', prep: 'Attack2', hit: 'Hit' } },
};
const bossSheets = {};
function bossSheet(id) {
  const B = BOSS3D[id]; if (!B) return null;
  if (bossSheets[id]) return bossSheets[id];
  const N = 220, ROWS = [['walk', 8], ['act', 8], ['prep', 8], ['hit', 4]];
  const mem = dcGet('boss:' + id);
  if (mem) {
    // découpe de la planche gardée en mémoire
    const sheet = {};
    ROWS.forEach(([key, n], r) => { sheet[key] = []; for (let f = 0; f < n; f++) { const cv = document.createElement('canvas'); cv.width = cv.height = N; cv.getContext('2d').drawImage(mem, f * N, r * N, N, N, 0, 0, N, N); sheet[key].push(cv); } });
    return (bossSheets[id] = sheet);
  }
  if (!MODELS[B.model]) return null;
  initPreview(); if (!PV.r) return null;
  const T = THREE, g = modelInst(B.model), I = g.userData.inst;
  g.rotation.y = Math.PI / 2;    // de profil, il regarde vers la droite de l'image
  const scene = new T.Scene(); scene.add(new T.HemisphereLight('#fffaf0', '#6d5a8a', 0.85));
  const dl = new T.DirectionalLight('#fff0d0', 0.9); dl.position.set(-3, 6, 5); scene.add(dl); scene.add(g);
  // cadrage : tout le corps tient dans l'image, les pieds tombent aux 4/5 de la hauteur
  const ext = B.ext, cam = new T.OrthographicCamera(-ext, ext, ext, -ext, 0.1, 60), ly = 0.6 * ext / Math.cos(0.45);
  cam.position.set(0, ly + Math.sin(0.45) * 20, Math.cos(0.45) * 20); cam.lookAt(0, ly, 0);
  const pr = PV.r.getPixelRatio(), prev = PV.r.getSize(new T.Vector2());
  PV.r.setPixelRatio(1); PV.r.setSize(N, N, false);
  const sheet = {};
  for (const [key, n] of ROWS) {
    const c = I.clip(B.clips[key]); I.mixer.stopAllAction(); I.mixer.clipAction(c).play();
    const span = key === 'walk' && B.walkSpan ? Math.min(B.walkSpan, c.duration) : c.duration;
    sheet[key] = [];
    for (let f = 0; f < n; f++) {
      I.mixer.setTime(span * f / n);
      PV.r.render(scene, cam);
      const cv = document.createElement('canvas'); cv.width = cv.height = N; cv.getContext('2d').drawImage(PV.r.domElement, 0, 0); sheet[key].push(cv);
    }
  }
  PV.r.setPixelRatio(pr); PV.r.setSize(prev.x || 1, prev.y || 1, false);
  const atlas = document.createElement('canvas'); atlas.width = N * 8; atlas.height = N * ROWS.length; const ag = atlas.getContext('2d');
  ROWS.forEach(([key], r) => sheet[key].forEach((cv, f) => ag.drawImage(cv, f * N, r * N)));
  dcPut('boss:' + id, atlas);
  return (bossSheets[id] = sheet);
}
function drawModelBoss(z, g, t) {
  const S = bossSheet(z.def.id);
  if (!S) { g.fillStyle = '#5a2a2a'; g.beginPath(); g.ellipse(0, -20, 70, 45, 0, 0, TAU); g.fill(); return; }
  const set = z.flash > 0.05 ? S.hit : z.mode === 'prep' ? S.prep : z.mode === 'act' ? S.act : S.walk;
  const f = set[Math.floor(t * (set === S.walk ? 10 : 8)) % set.length];
  g.drawImage(f, -100, -110, 200, 200);
}

const ART = {};
function artImg(id) {
  if (!ART_SRC[id]) return null;
  let im = ART[id];
  if (!im) {
    im = ART[id] = new Image();
    im.onload = () => {
      document.querySelectorAll(`[data-item="${id}"],[data-cosmprev="${id}"],[data-petprev="${id}"]`).forEach(c => paintArt(c, id));
      if (id.startsWith('g_')) document.querySelectorAll(`[data-gunprev="${id.slice(2)}"]`).forEach(c => paintGun(c, id.slice(2)));
    };
    im.src = ART_SRC[id];
  }
  return im.complete && im.naturalWidth ? im : null;
}
function paintArt(cnv, id) {
  const im = artImg(id); if (!im) return false;
  const g = cnv.getContext('2d'), k = Math.min(cnv.width * 0.84 / im.width, cnv.height * 0.84 / im.height);
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cnv.width, cnv.height);
  g.drawImage(im, (cnv.width - im.width * k) / 2, (cnv.height - im.height * k) / 2 - cnv.height * 0.03, im.width * k, im.height * k);
  return true;
}
function paintItem(cnv, id) {
  const K = ITEMS[id];
  if (K && (K.kay || K.slot === 'cape') && MODELS.h_knight) {
    const ok = snapObj(cnv, 'kay:' + id, () => K.slot === 'cape' ? kayCape(K) : kayPiece(K.kay[0], K.kay[1], K.kay[2]), 0.35);
    if (ok) return;
  }
  if (ITEMS[id] && ITEMS[id].model) { if (!snapObj(cnv, 'hat:' + id, () => modelHat(ITEMS[id]), 0.5)) cnv.getContext('2d').clearRect(0, 0, cnv.width, cnv.height); return; }
  if (ART_SRC[id] && paintArt(cnv, id)) return;
  const g = cnv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cnv.width, cnv.height);
  g.setTransform(cnv.width / 160, 0, 0, cnv.height / 120, 0, 0);
  drawItemIcon(g, id);
}

// ---------- Familiers (un seul à la fois, il suit le héros et a sa compétence) ----------
const PETS = {
  boufton: { name: 'Champichon',  price: 120,  rar: 'commun',     skill: 'Chapeau protecteur', desc: '+20 PV max et +5 % de résistance', stats: { hp: 20, res: 0.05 }, model: 'pet_boufton', clips: { move: 'Walk', idle: 'Idle' } },
  piou:    { name: 'Roucouli',    price: 180,  rar: 'commun',     skill: 'Plume tranchante',  desc: 'Lance une plume sur le monstre le plus proche', fly: true, shot: { cd: 1.3, dmg: 0.45, col: '#b98aff' }, model: 'pet_piou', clips: { move: 'Fast_Flying', idle: 'Flying_Idle' } },
  chacha:  { name: 'Minouflet',   price: 250,  rar: 'rare',       skill: 'Chasseur de trésors', desc: 'Attire l’XP de plus loin et +15 % de pièces en fin de partie', stats: { magnet: 0.5, coins: 0.15 }, model: 'pet_chacha', clips: { move: 'Walk', idle: 'Idle' } },
  wabbit:  { name: 'Bondilou',    price: 300,  rar: 'rare',       skill: 'Bond du lapin',     desc: '+8 % de vitesse et roulade −15 % de recharge', stats: { speed: 0.08, dash: 0.15 }, model: 'pet_wabbit', clips: { move: 'Walk', idle: 'Idle' } },
  panda:   { name: 'Glubulle',    price: 350,  rar: 'rare',       skill: 'Bulle de soin',     desc: 'Te soigne de 10 PV toutes les 5 secondes', fly: true, heal: { cd: 5, hp: 10 }, model: 'pet_panda', clips: { move: 'Fast_Flying', idle: 'Flying_Idle' } },
  glacon:  { name: 'Frissombre',  price: 400,  rar: 'épique',     skill: 'Frisson glacé',     desc: 'Les monstres proches de toi sont ralentis de 30 %', fly: true, slow: 170, model: 'pet_glacon', clips: { move: 'Fast_Flying', idle: 'Flying_Idle' } },
  renard:  { name: 'Wouffon',     price: 350,  rar: 'rare',       skill: 'Flair du chien',    desc: '+6 % de vitesse et +10 % de pièces en fin de partie', stats: { speed: 0.06, coins: 0.1 }, model: 'pet_renard', clips: { move: 'Walk', idle: 'Idle' } },
  bat:     { name: 'Vampichou',   price: 500,  rar: 'épique',     skill: 'Morsure vampire',   desc: 'Mord le monstre le plus proche et te rend 1 PV à chaque morsure', fly: true, shot: { cd: 1.1, dmg: 0.55, col: '#b46bff' }, leech: 1, model: 'pet_bat', clips: { move: 'Fast_Flying', idle: 'Flying_Idle' } },
  imp:     { name: 'Diablinet',   price: 550,  rar: 'épique',     skill: 'Boule de soufre',   desc: 'Lance une petite boule de feu toutes les 0,8 seconde', fly: true, shot: { cd: 0.8, dmg: 0.4, fire: true }, model: 'pet_imp', clips: { move: 'Flying_Idle', idle: 'Flying_Idle' } },
  bwak:    { name: 'Poulflam',    price: 450,  rar: 'épique',     skill: 'Flamme',            desc: 'Crache une boule de feu sur le monstre le plus proche', shot: { cd: 1.0, dmg: 0.75, fire: true }, model: 'pet_bwak', clips: { move: 'Walk', idle: 'Idle' } },
  dragon:  { name: 'Pyrolin',     price: 1500, rar: 'légendaire', skill: 'Souffle du dragon', desc: '+10 % de dégâts et un souffle de feu en éventail toutes les 3 secondes', fly: true, stats: { dmg: 0.1 }, breath: { cd: 3, dmg: 0.9 }, model: 'pet_dragon', clips: { move: 'Fast_Flying', idle: 'Flying_Idle' } },
};
const DRAGON_COLS = { rose: { body: '#ff86bd', belly: '#ffe0ec', wing: '#a85ad9', horn: '#fff1d6', iris: '#ff9f2e' }, rouge: { body: '#e8424f', belly: '#ffd6a8', wing: '#ff9a2e', horn: '#fff1d6', iris: '#ffd23f' } };
// niveaux des familiers (1 à 10) : +10 % sur tous leurs effets par niveau, payés en pièces chez la sorcière
const PET_MAXLV = 10, PET_LVCOST = { commun: 120, rare: 220, 'épique': 380, 'légendaire': 900 };
const petLv = id => clamp((save.petLv && save.petLv[id]) || 1, 1, PET_MAXLV);
const petMul = id => 1 + 0.1 * (petLv(id) - 1);
const petUpCost = id => Math.round(PET_LVCOST[PETS[id].rar] * petLv(id));
// les 3 œufs de la sorcière : 4 familiers chacun, chances en % (total 100)
const EGGS = [
  { id: 'mousse', name: 'Œuf moussu', price: 300, col: '#7ddc4a', spot: '#3f8f2a', pets: [['boufton', 60], ['piou', 30], ['chacha', 9], ['renard', 1]] },
  { id: 'ambre', name: 'Œuf d’ambre', price: 900, col: '#ffb347', spot: '#c4621d', pets: [['wabbit', 55], ['panda', 35], ['bwak', 9], ['glacon', 1]] },
  { id: 'nuit', name: 'Œuf de la nuit', price: 2500, col: '#8a5cff', spot: '#2b1660', pets: [['bat', 89.999], ['imp', 9], ['glacon', 1], ['dragon', 0.001]] },
];
function rollEgg(E) {
  let r = Math.random() * 100;
  for (const [id, pc] of E.pets) { if (r < pc) return id; r -= pc; }
  return E.pets[0][0];
}
function petStats() {
  const P = PETS[save.pet], st = { hp: 0, res: 0, magnet: 0, coins: 0, speed: 0, dash: 0, dmg: 0 };
  if (P && P.stats) for (const k in P.stats) st[k] += P.stats[k] * petMul(save.pet);
  return st;
}

// --- Peinture façon Dofus : volumes en dégradé, contours foncés de la même teinte, gros yeux brillants ---
function tint(hex, amt) {
  const n = parseInt(hex.slice(1), 16), to = amt < 0 ? 0 : 255, p = Math.abs(amt);
  const c = v => Math.round(v + (to - v) * p);
  return `rgb(${c(n >> 16)},${c(n >> 8 & 255)},${c(n & 255)})`;
}
function ball(g, x, y, rx, ry, col, rot, lw) {
  const gr = g.createRadialGradient(x - rx * 0.35, y - ry * 0.45, Math.min(rx, ry) * 0.08, x, y, Math.max(rx, ry) * 1.05);
  gr.addColorStop(0, tint(col, 0.45)); gr.addColorStop(0.55, col); gr.addColorStop(1, tint(col, -0.32));
  g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, TAU); g.fill();
  g.strokeStyle = tint(col, -0.58); g.lineWidth = lw || 1.8; g.stroke();
}
function shapeFill(g, build, col, x0, y0, x1, y1, lw) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, tint(col, 0.4)); gr.addColorStop(0.6, col); gr.addColorStop(1, tint(col, -0.3));
  g.fillStyle = gr; g.beginPath(); build(); g.closePath(); g.fill();
  g.strokeStyle = tint(col, -0.58); g.lineWidth = lw || 1.8; g.stroke();
}
function shine(g, x, y, rx, ry, a) { g.fillStyle = `rgba(255,255,255,${a || 0.55})`; g.beginPath(); g.ellipse(x, y, rx, ry, -0.5, 0, TAU); g.fill(); }
function blush(g, x, y, r) { g.fillStyle = 'rgba(255,105,140,.35)'; g.beginPath(); g.ellipse(x, y, r, r * 0.6, 0, 0, TAU); g.fill(); }
function dEye(g, x, y, r, iris, lid) {
  const sg = g.createLinearGradient(x, y - r, x, y + r); sg.addColorStop(0, '#ffffff'); sg.addColorStop(1, '#dfe4f0');
  g.fillStyle = sg; g.beginPath(); g.ellipse(x, y, r * 0.82, r, 0, 0, TAU); g.fill();
  g.strokeStyle = '#3a2630'; g.lineWidth = 1.4; g.stroke();
  const ig = g.createRadialGradient(x + r * 0.15, y + r * 0.35, r * 0.05, x + r * 0.15, y + r * 0.1, r * 0.75);
  ig.addColorStop(0, tint(iris, 0.5)); ig.addColorStop(0.6, iris); ig.addColorStop(1, tint(iris, -0.5));
  g.fillStyle = ig; g.beginPath(); g.ellipse(x + r * 0.15, y + r * 0.12, r * 0.56, r * 0.72, 0, 0, TAU); g.fill();
  g.fillStyle = '#140c14'; g.beginPath(); g.ellipse(x + r * 0.2, y + r * 0.15, r * 0.28, r * 0.4, 0, 0, TAU); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + r * 0.38, y - r * 0.25, r * 0.24, 0, TAU); g.fill();
  g.beginPath(); g.arc(x - r * 0.02, y + r * 0.42, r * 0.11, 0, TAU); g.fill();
  g.strokeStyle = '#2a1820'; g.lineWidth = r * 0.28; g.lineCap = 'round';
  g.beginPath(); g.ellipse(x, y + (lid ? r * 0.25 : 0), r * 0.86, r * (lid ? 0.8 : 1.02), 0, Math.PI * 1.12, Math.PI * 1.88); g.stroke();
}
function thickLine(g, build, col, w) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = tint(col, -0.55); g.lineWidth = w + 3; g.beginPath(); build(); g.stroke();
  g.strokeStyle = col; g.lineWidth = w; g.beginPath(); build(); g.stroke();
  g.strokeStyle = tint(col, 0.35); g.lineWidth = w * 0.3; g.beginPath(); build(); g.stroke();
}

// Dessin de profil (tourné vers la droite) : corps d'environ 22 de rayon, pieds vers y = +24
function drawPetSide(g, id, t) {
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
  const flap = Math.sin(t * 14), breathe = 1 + Math.sin(t * 3) * 0.02;
  if (id === 'dragon') {
    const D = DRAGON_COLS[save.dragonCol] || DRAGON_COLS.rose;
    // Queue enroulée avec pointe en fer de lance
    thickLine(g, () => { g.moveTo(-8, 14); g.quadraticCurveTo(-30, 22, -34, 6); g.quadraticCurveTo(-36, -6, -26, -8); }, D.body, 7);
    shapeFill(g, () => { g.moveTo(-26, -8); g.lineTo(-20, -16); g.lineTo(-18, -6); g.lineTo(-22, -2); }, D.wing, -26, -16, -18, -2, 1.5);
    // Aile du fond
    g.save(); g.translate(-4, -8); g.rotate(-0.5 + flap * 0.35); g.globalAlpha = 0.75;
    shapeFill(g, () => { g.moveTo(0, 0); g.quadraticCurveTo(-10, -30, -26, -34); g.lineTo(-22, -22); g.lineTo(-30, -20); g.lineTo(-22, -10); g.lineTo(-28, -4); g.quadraticCurveTo(-12, 2, 0, 0); }, D.wing, -26, -34, 0, 0);
    g.restore(); g.globalAlpha = 1;
    // Pattes arrière
    for (const [lx, ly] of [[-7, 19], [8, 20]]) { ball(g, lx, ly, 6.5, 6, D.body); g.fillStyle = D.horn; for (const c of [-3, 0, 3]) { g.beginPath(); g.ellipse(lx + c + 2, ly + 5.5, 1.6, 1.2, 0, 0, TAU); g.fill(); } }
    // Corps en poire + ventre à écailles
    g.save(); g.translate(0, 6); g.scale(1, breathe);
    ball(g, 0, 0, 16, 18.5, D.body);
    ball(g, 5, 3, 9.5, 13, D.belly, 0, 1.2);
    g.strokeStyle = tint(D.belly, -0.3); g.lineWidth = 1.2;
    for (const yy of [-6, -1, 4, 9]) { g.beginPath(); g.moveTo(-2, yy); g.quadraticCurveTo(5, yy + 2.5, 12, yy - 1); g.stroke(); }
    g.restore();
    // Petit bras avec griffes
    ball(g, 12, 6, 4, 6.5, D.body, -0.5);
    // Tête
    ball(g, 6, -18, 16, 14.5, D.body);
    // Collerette de piques sur la nuque
    for (const [sx, sy, a] of [[-7, -26, -0.9], [-10, -18, -1.3], [-9, -10, -1.7]]) { g.save(); g.translate(sx, sy); g.rotate(a); shapeFill(g, () => { g.moveTo(-3.5, 0); g.lineTo(0, -8); g.lineTo(3.5, 0); }, D.wing, 0, -8, 0, 0, 1.2); g.restore(); }
    // Cornes recourbées vers l'arrière
    shapeFill(g, () => { g.moveTo(0, -29); g.quadraticCurveTo(-6, -40, -14, -42); g.quadraticCurveTo(-6, -36, 5, -31); }, D.horn, -14, -42, 5, -29, 1.4);
    shapeFill(g, () => { g.moveTo(9, -31); g.quadraticCurveTo(6, -42, -1, -46); g.quadraticCurveTo(5, -38, 13, -31); }, D.horn, -1, -46, 13, -31, 1.4);
    // Museau
    ball(g, 18, -13, 9, 7, D.body);
    g.fillStyle = tint(D.body, -0.45); g.beginPath(); g.ellipse(23, -15, 1.3, 1, 0, 0, TAU); g.ellipse(19.5, -16, 1.1, 0.9, 0, 0, TAU); g.fill();
    g.strokeStyle = tint(D.body, -0.55); g.lineWidth = 1.4; g.beginPath(); g.moveTo(11, -9); g.quadraticCurveTo(18, -6, 25, -10); g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(20, -8.5); g.lineTo(21.2, -5.8); g.lineTo(22.4, -9); g.fill();
    // Yeux
    dEye(g, 15, -22, 4.2, D.iris);
    dEye(g, 4, -20, 6.5, D.iris);
    blush(g, 9, -12, 3.6);
    shine(g, 0, -27, 5, 3, 0.4);
    // Aile du premier plan
    g.save(); g.translate(-2, -4); g.rotate(-0.3 + flap * 0.45);
    shapeFill(g, () => { g.moveTo(0, 0); g.quadraticCurveTo(-8, -26, -24, -32); g.lineTo(-20, -20); g.lineTo(-29, -18); g.lineTo(-21, -9); g.lineTo(-27, -3); g.quadraticCurveTo(-12, 3, 0, 0); }, D.wing, -24, -32, 0, 0);
    g.strokeStyle = tint(D.wing, -0.45); g.lineWidth = 1.3;
    for (const [ex, ey] of [[-20, -20], [-21, -9]]) { g.beginPath(); g.moveTo(-1, -1); g.lineTo(ex, ey); g.stroke(); }
    g.restore();
  } else if (id === 'piou') {
    const C = '#ff5468';
    g.strokeStyle = '#e8862a'; g.lineWidth = 2.6; for (const lx of [-5, 5]) { g.beginPath(); g.moveTo(lx, 15); g.lineTo(lx, 23); g.lineTo(lx + 4, 24); g.stroke(); }
    // Grande plume sur la tête
    g.save(); g.translate(-1, -14); g.rotate(-0.25 + Math.sin(t * 4) * 0.08);
    shapeFill(g, () => { g.moveTo(0, 0); g.quadraticCurveTo(-12, -18, -8, -40); g.quadraticCurveTo(-2, -22, 4, -2); }, C, -8, -40, 4, 0, 1.4);
    g.strokeStyle = tint(C, -0.4); g.lineWidth = 1; g.beginPath(); g.moveTo(1, -1); g.quadraticCurveTo(-6, -20, -7.5, -38); g.stroke();
    g.restore();
    ball(g, 0, 2, 18, 17 * breathe, C);
    ball(g, 5, 8, 11, 8.5, '#ffd0d6', 0, 1.2);
    g.save(); g.translate(-8, 4); g.rotate(-0.5 + flap * 0.5); ball(g, -6, 0, 10, 5.5, '#e0405a'); g.restore();
    shapeFill(g, () => { g.moveTo(15, -4); g.quadraticCurveTo(26, -2, 27, 2); g.quadraticCurveTo(22, 5, 15, 4); }, '#ffc23a', 15, -4, 27, 4, 1.4);
    dEye(g, 14, -7, 4, '#5a3220'); dEye(g, 6, -6, 6, '#5a3220');
    blush(g, 10, 2, 3.5); shine(g, -6, -8, 6, 3.5);
  } else if (id === 'chacha') {
    const C = '#34304a';
    thickLine(g, () => { g.moveTo(-12, 10); g.quadraticCurveTo(-30, 6, -26, -14 + Math.sin(t * 3) * 3); }, C, 5);
    for (const [lx, ly] of [[-9, 20], [6, 21]]) ball(g, lx, ly, 5, 4.5, C);
    ball(g, -2, 8, 15, 12 * breathe, C);
    ball(g, 7, 7, 6.5, 8.5, '#f2eefc', 0, 1.2);
    for (const [ex, a] of [[-2, -0.25], [15, 0.2]]) { g.save(); g.translate(ex, -24); g.rotate(a); shapeFill(g, () => { g.moveTo(-6, 4); g.lineTo(0, -12); g.lineTo(6, 4); }, C, 0, -12, 0, 4); shapeFill(g, () => { g.moveTo(-3, 2); g.lineTo(0, -7); g.lineTo(3, 2); }, '#ff9fc4', 0, -7, 0, 2, 0.8); g.restore(); }
    ball(g, 7, -12, 16.5, 14.5, C);
    ball(g, 16, -6, 7.5, 5.5, '#f2eefc', 0, 1.1);
    g.fillStyle = '#ff7fa8'; g.beginPath(); g.ellipse(21, -8, 2, 1.5, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 0.9; for (const dy of [-1, 2]) { g.beginPath(); g.moveTo(19, -5 + dy); g.lineTo(30, -6 + dy * 1.8); g.stroke(); }
    dEye(g, 17, -15, 4.5, '#8fe04a'); dEye(g, 5, -14, 6.2, '#8fe04a');
    blush(g, 11, -6, 3); shine(g, 0, -20, 6, 3.5, 0.35);
  } else if (id === 'wabbit') {
    const C = '#dcc6ff';
    for (const [ex, a] of [[-4, -0.25], [7, 0.12]]) { g.save(); g.translate(ex, -24); g.rotate(a + Math.sin(t * 4 + ex) * 0.07); ball(g, 0, -15, 5.8, 16, C); ball(g, 0, -14, 2.8, 11, '#ffa6d2', 0, 0.8); g.restore(); }
    for (const lx of [-9, 8]) ball(g, lx, 21, 7, 4, C);
    ball(g, 0, 7, 16, 14 * breathe, C);
    ball(g, 4, 10, 9, 8, '#ffffff', 0, 1);
    ball(g, 4, -12, 16, 14, C);
    g.fillStyle = '#ffffff'; g.strokeStyle = tint(C, -0.5); g.lineWidth = 1; g.beginPath(); g.rect(13, -4, 3.2, 4.5); g.rect(16.2, -4, 3.2, 4.5); g.fill(); g.stroke();
    g.fillStyle = '#ff7fa8'; g.beginPath(); g.ellipse(18, -9, 2, 1.4, 0, 0, TAU); g.fill();
    dEye(g, 14, -15, 4.5, '#a15ad9'); dEye(g, 2, -14, 6, '#a15ad9');
    blush(g, 9, -6, 3.2);
    shapeFill(g, () => { g.moveTo(14, 6); g.lineTo(24, 2); g.lineTo(16, 12); }, '#ff8a1f', 14, 2, 24, 12, 1.2);
    g.fillStyle = '#5fbf4a'; g.beginPath(); g.ellipse(25, 1, 3, 1.5, -0.6, 0, TAU); g.fill();
  } else if (id === 'panda') {
    const B = '#2b2830';
    for (const lx of [-9, 8]) ball(g, lx, 20, 7, 5, B);
    ball(g, 0, 6, 17, 15 * breathe, '#fbfbff');
    ball(g, 14, 6, 5, 8, B, -0.4);
    for (const ex of [-8, 12]) ball(g, ex, -26, 6, 5.5, B);
    ball(g, 3, -13, 17, 15, '#fbfbff');
    for (const [ex, a] of [[-2, 0.4], [12, -0.3]]) { g.fillStyle = B; g.beginPath(); g.ellipse(ex, -13, 5.5, 7, a, 0, TAU); g.fill(); }
    for (const ex of [-1, 12]) { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(ex + 1, -14, 2.6, 0, TAU); g.fill(); g.fillStyle = '#3a2a20'; g.beginPath(); g.arc(ex + 1.5, -13.6, 1.6, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + 2, -14.4, 0.6, 0, TAU); g.fill(); }
    g.fillStyle = B; g.beginPath(); g.ellipse(9, -6, 2.5, 1.7, 0, 0, TAU); g.fill();
    blush(g, 16, -7, 3); blush(g, -6, -7, 3);
    g.save(); g.translate(19, 2); g.rotate(-0.5);
    shapeFill(g, () => { g.rect(-2.2, -18, 4.4, 30); }, '#7ddc4a', -2, 0, 2, 0, 1.2);
    g.strokeStyle = '#3f8f2a'; g.lineWidth = 1.2; for (const yy of [-8, 2]) { g.beginPath(); g.moveTo(-2.2, yy); g.lineTo(2.2, yy); g.stroke(); }
    g.restore();
  } else if (id === 'glacon') {
    const sq = 1 + Math.sin(t * 5) * 0.04;
    g.save(); g.scale(1 / sq, sq);
    const gr = g.createLinearGradient(-20, -24, 20, 22); gr.addColorStop(0, '#f2fcff'); gr.addColorStop(0.5, '#a6e2ff'); gr.addColorStop(1, '#5fb4e8');
    g.fillStyle = gr; g.globalAlpha = 0.93; g.beginPath(); g.roundRect ? g.roundRect(-20, -22, 40, 44, 11) : g.rect(-20, -22, 40, 44); g.fill(); g.globalAlpha = 1;
    g.strokeStyle = '#3f86b8'; g.lineWidth = 1.8; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.moveTo(-16, -18); g.lineTo(6, -18); g.lineTo(-2, -10); g.lineTo(-16, -10); g.closePath(); g.fill();
    g.fillStyle = 'rgba(63,134,184,.18)'; g.beginPath(); g.moveTo(-20, 10); g.lineTo(20, 4); g.lineTo(20, 22); g.lineTo(-20, 22); g.closePath(); g.fill();
    dEye(g, 0, -2, 5.5, '#2f6fd9'); dEye(g, 12, -2, 4.5, '#2f6fd9');
    g.strokeStyle = '#2a4a6a'; g.lineWidth = 1.5; g.beginPath(); g.arc(7, 8, 3, 0.2, Math.PI - 0.2); g.stroke();
    blush(g, -6, 6, 2.8); blush(g, 17, 6, 2.4);
    g.restore();
    g.fillStyle = '#ffffff'; for (const [sx, sy, s] of [[-24, -20, 3.5], [22, -26, 2.6], [26, 6, 2]]) { const k = s * (0.7 + Math.abs(Math.sin(t * 3 + sx)) * 0.5); g.beginPath(); g.moveTo(sx, sy - k * 2); g.lineTo(sx + k * 0.6, sy); g.lineTo(sx, sy + k * 2); g.lineTo(sx - k * 0.6, sy); g.closePath(); g.fill(); }
  } else if (id === 'bwak') {
    const C = '#d9743a';
    g.strokeStyle = '#e8862a'; g.lineWidth = 2.6; for (const lx of [-6, 4]) { g.beginPath(); g.moveTo(lx, 14); g.lineTo(lx, 23); g.lineTo(lx + 4, 24); g.stroke(); }
    ball(g, -2, 2, 17, 16 * breathe, C);
    ball(g, 1, 8, 10, 8, '#ffe2b0', 0, 1.1);
    g.save(); g.translate(-10, 3); g.rotate(-0.5 + flap * 0.5); ball(g, -5, 0, 10, 5.5, '#8a4a20'); g.restore();
    shapeFill(g, () => { g.moveTo(10, -10); g.quadraticCurveTo(34, -10, 34, 6); g.quadraticCurveTo(24, 0, 10, 4); }, '#ffcf3a', 10, -10, 34, 6, 1.5);
    g.fillStyle = '#3a2a20'; g.beginPath(); g.moveTo(33, 1); g.quadraticCurveTo(35, 4, 34, 6); g.lineTo(31, 3); g.fill();
    dEye(g, 5, -6, 5.2, '#3a2a20');
    blush(g, 6, 2, 2.8); shine(g, -8, -8, 6, 3.5, 0.4);
    // Bougie et flamme sur la tête
    shapeFill(g, () => { g.rect(-6, -26, 7, 12); }, '#fff3dc', -6, 0, 1, 0, 1.2);
    const f = 1 + Math.sin(t * 13) * 0.12;
    g.save(); g.shadowColor = '#ff8a1f'; g.shadowBlur = 12;
    const fg = g.createRadialGradient(-2.5, -30, 1, -2.5, -32, 9 * f); fg.addColorStop(0, '#fff6b0'); fg.addColorStop(0.45, '#ffb02e'); fg.addColorStop(1, 'rgba(255,90,31,0)');
    g.fillStyle = fg; g.beginPath(); g.moveTo(-2.5, -44 * f + 4); g.quadraticCurveTo(4, -32, -2.5, -26); g.quadraticCurveTo(-9, -32, -2.5, -44 * f + 4); g.fill();
    g.restore();
  } else if (id === 'boufton') {
    const W = '#5a3e2e';
    for (const [lx, ly] of [[-12, 20], [-2, 22], [9, 22], [16, 19]]) ball(g, lx, ly, 4.2, 5, '#3c4a66', 0, 1.2);
    for (const [x, y, r] of [[-12, 0, 11], [-2, -6, 13], [10, -2, 11], [-6, 8, 11], [7, 8, 12], [15, 4, 8], [-17, 6, 7.5], [0, -16, 8], [-10, -12, 8], [10, -13, 7]]) ball(g, x, y, r, r * breathe, W, 0, 1.4);
    for (const s of [-1, 1]) thickLine(g, () => { g.moveTo(s < 0 ? -11 : 13, -10); g.quadraticCurveTo(s < 0 ? -24 : 26, -16, s < 0 ? -21 : 24, 0); }, '#e8dcae', 4);
    dEye(g, 9, 2, 7.5, '#3a2a20', true);
    ball(g, 6, -7, 10, 5.5, W, -0.1, 1.2);
  }
  g.restore();
}

function paintPet(cnv, id) {
  const g = cnv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cnv.width, cnv.height);
  const sc = cnv.width / 110;
  g.setTransform(sc, 0, 0, sc, cnv.width / 2, cnv.height * 0.56);
  g.fillStyle = 'rgba(29,18,56,.25)'; g.beginPath(); g.ellipse(0, 28, 26, 6, 0, 0, TAU); g.fill();
  drawPetSide(g, id, (G ? G.t : 0) + performance.now() / 1000);
}

// Compétences du familier dans le Bastion
function updatePet(dt) {
  const pet = G.pet; if (!pet) return;
  const P = PETS[pet.id], p = G.p;
  pet.t += dt;
  // en 1re personne, le familier se place devant, un peu à gauche, pour rester visible
  const fpp = fpOn() && !(coop.active && session.role === 'guest');
  const tx = fpp ? p.x + Math.cos(FP.yaw) * 85 + Math.cos(FP.yaw - Math.PI / 2) * 55 : p.x - p.lastDy * 42 - p.lastDx * 8;
  const ty = fpp ? p.y + Math.sin(FP.yaw) * 85 + Math.sin(FP.yaw - Math.PI / 2) * 55 : p.y + p.lastDx * 42 - p.lastDy * 8;
  const mvx = tx - pet.x, mvy = ty - pet.y; pet.moving = Math.hypot(mvx, mvy) > 4; if (pet.moving) pet.dir = Math.atan2(mvy, mvx);
  pet.x += (tx - pet.x) * Math.min(1, dt * 6); pet.y += (ty - pet.y) * Math.min(1, dt * 6);
  pet.cd -= dt;
  if (P.shot && pet.cd <= 0) {
    const z = nearest(pet.x, pet.y, 420);
    if (z) {
      pet.cd = P.shot.cd; fireBullet(pet.x, pet.y, Math.atan2(z.y - pet.y, z.x - pet.x), p.dmg * P.shot.dmg * petMul(pet.id), 0, { range: 440, noExplo: true, col: P.shot.col, fire: P.shot.fire });
      if (P.leech && p.hp < p.maxHp) { const lh = Math.round(P.leech * petMul(pet.id)); p.hp = Math.min(p.maxHp, p.hp + lh); addText(p.x, p.y - 34, '+' + lh + ' PV', true); }
    }
  }
  if (P.breath && pet.cd <= 0) {
    const z = nearest(pet.x, pet.y, 320);
    if (z) {
      pet.cd = P.breath.cd; const a0 = Math.atan2(z.y - pet.y, z.x - pet.x);
      for (let i = -4; i <= 4; i++) fireBullet(pet.x, pet.y, a0 + i * 0.12, p.dmg * P.breath.dmg * petMul(pet.id), 1, { range: 340, noExplo: true, fire: true });
      sfx('boom');
    }
  }
  if (P.heal && pet.cd <= 0) { pet.cd = P.heal.cd; if (p.hp < p.maxHp) { const hh = Math.round(P.heal.hp * petMul(pet.id)); p.hp = Math.min(p.maxHp, p.hp + hh); addText(p.x, p.y - 34, '+' + hh + ' PV', true); burst(p.x, p.y, '#7ddc4a', 8, 90); } }
}
// Éclairage peint par-dessus un dessin déjà fait (garde les contours, ajoute lumière et ombre)
function litPass(g, cx, cy, r) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop';
  const sh = g.createRadialGradient(cx - r * 0.3, cy - r * 0.45, 0, cx - r * 0.3, cy - r * 0.45, r * 1.25);
  sh.addColorStop(0, 'rgba(255,248,220,.38)'); sh.addColorStop(0.3, 'rgba(255,248,220,0)'); sh.addColorStop(0.62, 'rgba(40,20,80,0)'); sh.addColorStop(1, 'rgba(40,20,80,.4)');
  g.fillStyle = sh; g.fillRect(0, 0, g.canvas.width, g.canvas.height); g.restore();
}
let petCanvas = null;
function drawPetGame() {
  const pet = G.pet; if (!pet) return;
  const ps = petSheet(pet.id);
  if (ps) {
    const P = PETS[pet.id], N = ps.size, k = 36 / ps.unit, hover = P.fly ? 24 + Math.sin(pet.t * 3) * 4 : 0;
    const dirA = pet.moving ? pet.dir : G.p.aim, d = Math.round(((dirA % TAU) + TAU) % TAU / TAU * ps.dirs) % ps.dirs;
    const f = (pet.moving || P.fly) ? Math.floor(pet.t * (P.fly ? 12 : 9)) % ps.frames : 0;
    ctx.fillStyle = 'rgba(29,18,56,.22)'; ctx.beginPath(); ctx.ellipse(pet.x, pet.y + 12, 13, 5, 0, 0, TAU); ctx.fill();
    ctx.drawImage(ps.sheet, d * N, f * N, N, N, pet.x - N * k / 2, pet.y + 12 - hover - ps.foot * k, N * k, N * k);
    return;
  }
  const P = PETS[pet.id], hover = P.fly ? 16 + Math.sin(pet.t * 4) * 4 : Math.abs(Math.sin(pet.t * 9)) * 3;
  ctx.fillStyle = 'rgba(29,18,56,.2)'; ctx.beginPath(); ctx.ellipse(pet.x, pet.y + 16, 14, 5, 0, 0, TAU); ctx.fill();
  const pc = petCanvas || (petCanvas = document.createElement('canvas')); pc.width = pc.height = 240;
  const pg = pc.getContext('2d'); pg.setTransform(2.4, 0, 0, 2.4, 120, 130); drawPetSide(pg, pet.id, pet.t);
  litPass(pg, 120, 120, 110);
  ctx.save(); ctx.translate(pet.x, pet.y - hover); ctx.scale((Math.cos(G.p.aim) < 0 ? -1 : 1) * 0.86, 0.86);
  ctx.drawImage(pc, -50, -54, 100, 100);
  ctx.restore();
}

const ZT = {
  walker:  { hp: 22,   speed: 58,  r: 16, dmg: 10, xp: 1,  color: '#6a4a33', dark: '#3f2a1c', wool: 'dark' },
  runner:  { hp: 13,   speed: 115, r: 13, dmg: 8,  xp: 1,  color: '#4a3326', dark: '#2e1f15', wool: 'black' },
  tank:    { hp: 150,  speed: 40,  r: 28, dmg: 22, xp: 5,  color: '#fff3c8', dark: '#e6d9a8', wool: 'light' },
  spitter: { hp: 30,   speed: 52,  r: 15, dmg: 9,  xp: 2,  color: '#6a4a33', dark: '#3f2a1c', wool: 'spit' },
  jelly:   { hp: 16,   speed: 72,  r: 13, dmg: 8,  xp: 1,  color: '#4fb8ff', dark: '#2f7fc0' },
  tofu:    { hp: 9,    speed: 150, r: 11, dmg: 6,  xp: 1,  color: '#ffd23f', dark: '#ff8a1f' },
  ghoul:   { hp: 60,   speed: 46,  r: 18, dmg: 14, xp: 3,  color: '#8fb86a', dark: '#4a6a30' },
  puglin:  { hp: 70,   speed: 60,  r: 19, dmg: 15, xp: 3,  color: '#7a9a3a', dark: '#4a6a20' },
  imp:     { hp: 18,   speed: 128, r: 13, dmg: 9,  xp: 2,  color: '#c0403a', dark: '#7a2020' },
  boss:    { hp: 1500, speed: 52,  r: 46, dmg: 30, xp: 40, color: '#ff5b3a', dark: '#a3220c' },
};

const RAR = { commun: { w: 60, cls: '' }, rare: { w: 28, cls: 'rare' }, 'épique': { w: 10, cls: 'epic' }, 'légendaire': { w: 3, cls: 'legend' } };
// Chaque amélioration a un niveau maximum ; au total il y en a assez pour monter très haut en niveau.
const UPG = [
  { id: 'dmg',    name: 'Balles lourdes',     desc: '+20 % de dégâts',                                  rar: 'commun', max: 10, apply: p => p.dmg *= 1.2 },
  { id: 'rate',   name: 'Gâchette rapide',    desc: '+15 % de cadence de tir',                          rar: 'commun', max: 10, apply: p => p.rate *= 1.15 },
  { id: 'hp',     name: 'Bandages',           desc: '+20 PV max et soin complet',                       rar: 'commun', max: 10, apply: p => { p.maxHp += 20; p.hp = p.maxHp; } },
  { id: 'armor',  name: 'Cuirasse',           desc: '+6 % de résistance aux dégâts',                    rar: 'commun', max: 6,  apply: p => p.res = Math.min(0.75, (p.res || 0) + 0.06) },
  { id: 'xp',     name: 'Sagesse',            desc: '+15 % d\u2019XP gagnée',                            rar: 'commun', max: 5,  apply: p => p.xpMult *= 1.15 },
  { id: 'speed',  name: 'Sprint',             desc: '+10 % de vitesse de déplacement',                  rar: 'commun', max: 6,  apply: p => p.speed *= 1.1 },
  { id: 'magnet', name: 'Aimant',             desc: 'Ramasse l\u2019XP de plus loin (+50 %)',            rar: 'commun', max: 5,  apply: p => p.magnet *= 1.5 },
  { id: 'range',  name: 'Lunette',            desc: '+15 % de portée de tir',                           rar: 'commun', max: 6,  apply: p => p.range *= 1.15 },
  { id: 'regen',  name: 'Adrénaline',         desc: 'Régénère 1 PV de plus par seconde',                rar: 'rare',   max: 8,  apply: p => p.regen += 1 },
  { id: 'crit',   name: 'Tir précis',         desc: '+10 % de chance de coup critique (dégâts x2)',     rar: 'rare',   max: 6,  apply: p => p.crit = Math.min(1, p.crit + 0.1) },
  { id: 'multi',  name: 'Double canon',       desc: '+1 balle à chaque tir',                            rar: 'rare',   max: 4,  apply: p => p.projCount++ },
  { id: 'pierce', name: 'Balles perforantes', desc: 'Les balles traversent 1 monstre de plus',           rar: 'rare',   max: 4,  apply: p => p.pierce++ },
  { id: 'gren',   name: 'Artificier',         desc: 'Grenades : +40 % de dégâts, recharge −20 %',       rar: 'rare',   max: 5,  apply: p => { p.grenDmg *= 1.4; p.grenCdMax *= 0.8; } },
  { id: 'dashup', name: 'Esquive',            desc: 'Roulade : recharge −15 %',                         rar: 'rare',   max: 4,  apply: p => p.dashCdMax *= 0.85 },
  { id: 'luck',   name: 'Trèfle',             desc: '+30 % de chances que les monstres lâchent des pièces', rar: 'rare', max: 4, apply: p => p.luck = (p.luck || 1) + 0.3 },
  { id: 'bigb',   name: 'Gros calibre',       desc: 'Balles 30 % plus grosses, plus faciles à placer',  rar: 'rare',   max: 3,  apply: p => p.bulletR = (p.bulletR || 6) * 1.3 },
  { id: 'drone',  name: 'Drone de combat',    desc: '+1 drone qui t\u2019accompagne et tire tout seul',  rar: 'épique', max: 4,  apply: p => p.drones++ },
  { id: 'boom',   name: 'Balles explosives',  desc: 'Chaque impact fait une petite explosion',          rar: 'épique', max: 3,  apply: p => p.explosive++ },
  { id: 'ultcd',  name: 'Charge rapide',      desc: 'L\u2019ultime recharge 25 % plus vite',             rar: 'épique', max: 4,  apply: p => p.ultCdMax *= 0.75 },
  { id: 'vamp',   name: 'Vampire',            desc: 'Chaque monstre éliminé te rend 1 PV',               rar: 'légendaire', max: 1, apply: p => p.vamp = 1 },
  { id: 'fury',   name: 'Fureur',             desc: '+50 % de cadence et +25 % de dégâts',              rar: 'légendaire', max: 1, apply: p => { p.rate *= 1.5; p.dmg *= 1.25; } },
];
// Cartes de secours, sans limite, quand il ne reste plus assez d'améliorations à proposer
const FILLER = [
  { id: 'heal',   name: 'Pause bien méritée', desc: 'Soin complet',                         rar: 'commun', filler: true, apply: p => { p.hp = p.maxHp; } },
  { id: 'bourse', name: 'Petite bourse',      desc: '+15 pièces à la fin de la partie',     rar: 'commun', filler: true, apply: () => { G.coinsRun += 15; } },
  { id: 'pepite', name: 'Pépite d\u2019or',    desc: '+40 pièces à la fin de la partie',     rar: 'rare',   filler: true, apply: () => { G.coinsRun += 40; } },
];

// ---------- Écran ----------
let W = 0, H = 0, DPR = 1, S = 1;
function resize() {
  try { if (V.ok) { V.renderer.setSize(window.innerWidth, window.innerHeight, false); V.camera.aspect = window.innerWidth / window.innerHeight; V.camera.updateProjectionMatrix(); } } catch (e) {}
  DPR = Math.min(window.devicePixelRatio || 1, save.gfx === 'fast' ? 1 : 1.5);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  S = clamp(Math.min(W, H) / 620, 0.62, 1.35) * (save.bzoom || 0.8);
}
addEventListener('resize', resize);
resize();

// Sols Poly Haven CC0 locaux (1K). Eau stylisée intégrée ; aucun téléchargement pendant le jeu.
const GTEX_SRC = {
  water: 'data:image/jpeg;base64,/9j/4QC8RXhpZgAASUkqAAgAAAAGABIBAwABAAAAAQAAABoBBQABAAAAVgAAABsBBQABAAAAXgAAACgBAwABAAAAAgAAABMCAwABAAAAAQAAAGmHBAABAAAAZgAAAAAAAABIAAAAAQAAAEgAAAABAAAABgAAkAcABAAAADAyMTABkQcABAAAAAECAwAAoAcABAAAADAxMDABoAMAAQAAAP//AAACoAQAAQAAAMgAAAADoAQAAQAAAMgAAAAAAAAA/+IL+ElDQ19QUk9GSUxFAAEBAAAL6AAAAAACAAAAbW50clJHQiBYWVogB9kAAwAbABUAJAAfYWNzcAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAPbWAAEAAAAA0y0AAAAAKfg93q/yVa54QvrkyoM5DQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQZGVzYwAAAUQAAAB5YlhZWgAAAcAAAAAUYlRSQwAAAdQAAAgMZG1kZAAACeAAAACIZ1hZWgAACmgAAAAUZ1RSQwAAAdQAAAgMbHVtaQAACnwAAAAUbWVhcwAACpAAAAAkYmtwdAAACrQAAAAUclhZWgAACsgAAAAUclRSQwAAAdQAAAgMdGVjaAAACtwAAAAMdnVlZAAACugAAACHd3RwdAAAC3AAAAAUY3BydAAAC4QAAAA3Y2hhZAAAC7wAAAAsZGVzYwAAAAAAAAAfc1JHQiBJRUM2MTk2Ni0yLTEgYmxhY2sgc2NhbGVkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFhZWiAAAAAAAAAkoAAAD4QAALbPY3VydgAAAAAAAAQAAAAABQAKAA8AFAAZAB4AIwAoAC0AMgA3ADsAQABFAEoATwBUAFkAXgBjAGgAbQByAHcAfACBAIYAiwCQAJUAmgCfAKQAqQCuALIAtwC8AMEAxgDLANAA1QDbAOAA5QDrAPAA9gD7AQEBBwENARMBGQEfASUBKwEyATgBPgFFAUwBUgFZAWABZwFuAXUBfAGDAYsBkgGaAaEBqQGxAbkBwQHJAdEB2QHhAekB8gH6AgMCDAIUAh0CJgIvAjgCQQJLAlQCXQJnAnECegKEAo4CmAKiAqwCtgLBAssC1QLgAusC9QMAAwsDFgMhAy0DOANDA08DWgNmA3IDfgOKA5YDogOuA7oDxwPTA+AD7AP5BAYEEwQgBC0EOwRIBFUEYwRxBH4EjASaBKgEtgTEBNME4QTwBP4FDQUcBSsFOgVJBVgFZwV3BYYFlgWmBbUFxQXVBeUF9gYGBhYGJwY3BkgGWQZqBnsGjAadBq8GwAbRBuMG9QcHBxkHKwc9B08HYQd0B4YHmQesB78H0gflB/gICwgfCDIIRghaCG4IggiWCKoIvgjSCOcI+wkQCSUJOglPCWQJeQmPCaQJugnPCeUJ+woRCicKPQpUCmoKgQqYCq4KxQrcCvMLCwsiCzkLUQtpC4ALmAuwC8gL4Qv5DBIMKgxDDFwMdQyODKcMwAzZDPMNDQ0mDUANWg10DY4NqQ3DDd4N+A4TDi4OSQ5kDn8Omw62DtIO7g8JDyUPQQ9eD3oPlg+zD88P7BAJECYQQxBhEH4QmxC5ENcQ9RETETERTxFtEYwRqhHJEegSBxImEkUSZBKEEqMSwxLjEwMTIxNDE2MTgxOkE8UT5RQGFCcUSRRqFIsUrRTOFPAVEhU0FVYVeBWbFb0V4BYDFiYWSRZsFo8WshbWFvoXHRdBF2UXiReuF9IX9xgbGEAYZRiKGK8Y1Rj6GSAZRRlrGZEZtxndGgQaKhpRGncanhrFGuwbFBs7G2MbihuyG9ocAhwqHFIcexyjHMwc9R0eHUcdcB2ZHcMd7B4WHkAeah6UHr4e6R8THz4faR+UH78f6iAVIEEgbCCYIMQg8CEcIUghdSGhIc4h+yInIlUigiKvIt0jCiM4I2YjlCPCI/AkHyRNJHwkqyTaJQklOCVoJZclxyX3JicmVyaHJrcm6CcYJ0kneierJ9woDSg/KHEooijUKQYpOClrKZ0p0CoCKjUqaCqbKs8rAis2K2krnSvRLAUsOSxuLKIs1y0MLUEtdi2rLeEuFi5MLoIuty7uLyQvWi+RL8cv/jA1MGwwpDDbMRIxSjGCMbox8jIqMmMymzLUMw0zRjN/M7gz8TQrNGU0njTYNRM1TTWHNcI1/TY3NnI2rjbpNyQ3YDecN9c4FDhQOIw4yDkFOUI5fzm8Ofk6Njp0OrI67zstO2s7qjvoPCc8ZTykPOM9Ij1hPaE94D4gPmA+oD7gPyE/YT+iP+JAI0BkQKZA50EpQWpBrEHuQjBCckK1QvdDOkN9Q8BEA0RHRIpEzkUSRVVFmkXeRiJGZ0arRvBHNUd7R8BIBUhLSJFI10kdSWNJqUnwSjdKfUrESwxLU0uaS+JMKkxyTLpNAk1KTZNN3E4lTm5Ot08AT0lPk0/dUCdQcVC7UQZRUFGbUeZSMVJ8UsdTE1NfU6pT9lRCVI9U21UoVXVVwlYPVlxWqVb3V0RXklfgWC9YfVjLWRpZaVm4WgdaVlqmWvVbRVuVW+VcNVyGXNZdJ114XcleGl5sXr1fD19hX7NgBWBXYKpg/GFPYaJh9WJJYpxi8GNDY5dj62RAZJRk6WU9ZZJl52Y9ZpJm6Gc9Z5Nn6Wg/aJZo7GlDaZpp8WpIap9q92tPa6dr/2xXbK9tCG1gbbluEm5rbsRvHm94b9FwK3CGcOBxOnGVcfByS3KmcwFzXXO4dBR0cHTMdSh1hXXhdj52m3b4d1Z3s3gReG54zHkqeYl553pGeqV7BHtje8J8IXyBfOF9QX2hfgF+Yn7CfyN/hH/lgEeAqIEKgWuBzYIwgpKC9INXg7qEHYSAhOOFR4Wrhg6GcobXhzuHn4gEiGmIzokziZmJ/opkisqLMIuWi/yMY4zKjTGNmI3/jmaOzo82j56QBpBukNaRP5GokhGSepLjk02TtpQglIqU9JVflcmWNJaflwqXdZfgmEyYuJkkmZCZ/JpomtWbQpuvnByciZz3nWSd0p5Anq6fHZ+Ln/qgaaDYoUehtqImopajBqN2o+akVqTHpTilqaYapoum/adup+CoUqjEqTepqaocqo+rAqt1q+msXKzQrUStuK4trqGvFq+LsACwdbDqsWCx1rJLssKzOLOutCW0nLUTtYq2AbZ5tvC3aLfguFm40blKucK6O7q1uy67p7whvJu9Fb2Pvgq+hL7/v3q/9cBwwOzBZ8Hjwl/C28NYw9TEUcTOxUvFyMZGxsPHQce/yD3IvMk6ybnKOMq3yzbLtsw1zLXNNc21zjbOts83z7jQOdC60TzRvtI/0sHTRNPG1EnUy9VO1dHWVdbY11zX4Nhk2OjZbNnx2nba+9uA3AXcit0Q3ZbeHN6i3ynfr+A24L3hROHM4lPi2+Nj4+vkc+T85YTmDeaW5x/nqegy6LzpRunQ6lvq5etw6/vshu0R7ZzuKO6070DvzPBY8OXxcvH/8ozzGfOn9DT0wvVQ9d72bfb794r4Gfio+Tj5x/pX+uf7d/wH/Jj9Kf26/kv+3P9t//9kZXNjAAAAAAAAAC5JRUMgNjE5NjYtMi0xIERlZmF1bHQgUkdCIENvbG91ciBTcGFjZSAtIHNSR0IAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWFlaIAAAAAAAAGKZAAC3hQAAGNpYWVogAAAAAAAAAAAAUAAAAAAAAG1lYXMAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlhZWiAAAAAAAAADFgAAAzMAAAKkWFlaIAAAAAAAAG+iAAA49QAAA5BzaWcgAAAAAENSVCBkZXNjAAAAAAAAAC1SZWZlcmVuY2UgVmlld2luZyBDb25kaXRpb24gaW4gSUVDIDYxOTY2LTItMQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWFlaIAAAAAAAAPbWAAEAAAAA0y10ZXh0AAAAAENvcHlyaWdodCBJbnRlcm5hdGlvbmFsIENvbG9yIENvbnNvcnRpdW0sIDIwMDkAAHNmMzIAAAAAAAEMRAAABd////MmAAAHlAAA/Y////uh///9ogAAA9sAAMB1/9sAQwAIBgYHBgUIBwcHCQkICgwUDQwLCwwZEhMPFB0aHx4dGhwcICQuJyAiLCMcHCg3KSwwMTQ0NB8nOT04MjwuMzQy/9sAQwEJCQkMCwwYDQ0YMiEcITIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy/8AAEQgAyADIAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/aAAwDAQACEQMRAD8A6OW7Vpcxu6DONwHWtaCSAWgYITNnh8AcepFc615LHIVAUIeOB0/GrFrctG5Vedww2T1FdU6d0fn9OrZ3G3al5DtkB9OetUWs5HlHUDt3rdOlmRRKo+T1I6VZaS0tLX5v3ko6YxwPX3pe1tohOi3q9DD8tbZNvmYkOQw9PY09JTdW+0MdyjA9xTHtvtDkpyg5JB4pGhljP7sdOpx0+nr9a1un6mSTQkTXCuIxkkHjBroYBH9jxeMVYHK4H+eKz7GSRn3ycqoJwef8is+6vJHl5ZsZ7mspxcnZGsJqCvuaOo286oki48oH5VX5h+J7mp9NadjuaKDaf73y/lTdNuiYJEeQ+WVyT2HoSO/NZ897JHNhTyp6nrUJSfulOcU1NFnUbyeQSuI/IcHBVQBx9ayYDO84XBYenrWxbyteqEcZduAe4/8Are1ZEkMkcgUOFH94A1vCyVjKcnJ8zdyyJo7Zm3wfMoyA3OT7Usd09wVVcI30wB7VDFvJKnnHCs1TG5jikCIoWQZDEDIP4H+dJlIe1rcnne2fbpVm3t5IwZJZDtUd+c06xvWdhHJ93tnpU+phVBB4UjgKeQKzc3flZooR5edFaW+WVtj4IxgduabHpf2h1KSguf4D1rJyPNwpb2yK1rSY2wD7l3DoMZ5rRrlXumalzP3hbq1hsyVkVHIblc42n0J9aoSiSaQyRyZOOVxj8AO9XNRtnuR54wu/naDkr9az4bSeMszE7Ryc9BTjtdsU171ktCxaWtzM+35lJPHX+VaUzrZwmFtrPnLEHkHHasg6jMibVICD36miOb7SB5hLN/CRxj2qJQbd2UpRitNyRVM8pIk3HqQeK3bdxDZHz9snGVTdz9apR6eEUXLttB7+vtiqNzeJ9p42r/u9BU259EVGTpe89y896GUqv7odlUYBP4UVBlZrV3gAEiqS307kelFaRgiJ1H1GtYNkhVOehxSx2JjYM+AM9egrphdWi24hlRTccgSY4HoD6/Wuf1FbiOU7lfnkHd1Ht7VkqjehtUoRppNO/wChdmM32ZNkm6MH5gePp+FZE4KsS/3ug54NXdNlZHV5yVQ93PX2xWfeGeGZhhhz0I6U4KzsZ1HdKTHQnZIGUFc/NnGAP8an+2QyyBGU8HJYHB/KqHzrbszEgZ5wD1/wqOyhlnbucHr3Fa8qerIUnsi3NqTKpjVAq7uvr7Gq4iWVw0Z3N/dI5oukhaRtueOvHBqxYqplVQPQDBxT0SuiHduzLsMVwkLbQFGAcFf0PtWdcxOrglTx0Vs/5xWxqN556CONQ6IMbcfN9feotNbfcJ5oDIf4XOAPp6VnFtLmZtKCclGLKVpK29V27QT/AAjk1q39vaT/AD7gsu3L8fLn8KzL27SGeRIhtQMQpxzj3quZPMBmL5I4K+3rQ4tvm2IUuVOL1LQhgtZB824MOR2I/GrBtYLh8oNu49Mc/wD16yIbli5AAZPRhWxpsccmCzuv4ilNNK5dNqTsSi1GnwmeRULAfKCDz7+1ZLX5aYs5Jyck4zn8K2tTvHzg5kix+7J7j1rFeCOb51GPbGOainrrIutZPlhsiwIba7XfvVCOeelMkT7KwITcB/e5/Sora2mDbmBIHI7c9qkMs7zsnO3ptboa067mbaavbUdaXBmuRuDFjxnHH4025try2kJw2Dyc1aS2iiZZJPkz2Pf6VbaeyvG8st5e0YyO/vSc7PRBGndWb1MFrbzzkxpvyTtNTW9jLGQ53CNT17D8a10Nra7ZG3Ov3gO351BqN5FdAyQnyl7KucD6/wCNHtG3ZD9nFRu3r2I5J3KIiTblHQ4PWqc2mtIN2RnvtGarPNOjcNnPcVbtJ32FFOCfvNnB+marWOxKtLRkllHlZIEDF3XaGPAHtRVyKOXcAWz9TRUubvoXGkmrNEd7MN3yNhhyB/SgLO9luEgAU5Jc8HPYVVSAXUqshPzHOOtSX8whJhHy7OPlOee5qVrohNvWXQiFwI5N+EaQ9DjgVp288M8TteZbAwH/AIj7e9c/HIBKTKFAPU54NJdSsX/dLsB+7nuPbNaSpqWhMKjjqaN4NuBiRFb7pQ8MP61XhhmSIssjYztUL1zUUN1MRtZsDvnpx7etadtqsSp5f2ddpGOOv/1vwpOMoqyBOMpXbsQLYmWTaWCv6H/GrNvZC1Yl5AGxwD3rWtoLeW1MsCsWAy3T5ff3rEvWWObBJEZ9+tZKo5OxtKgoJSfUrSQSzTFvMyM53D/61X0t2gt/tEbCRlPCE859arTFZogIOCvt29zUbRy3EYEUZAXgnOcn1FaKXMZ8qj5le882UmQfvFIxvxg/j71HawSSMqLGzA9MNzn1q0pMAIcEy9Np6496WW5uAhwuxM9AOta36IyVr6iJZqshKMoIGWOM/pU8NyF+QSfIeGPc+lZ4ndG8x8hj0AFSpHJPOv7jaTz83G6oa7lJ/wApbNwYmZZADu6rjgf/AF60dOtItQYJG3GeVz/Kse+aPeqq3IGDg5yRWhp139mtXaMgAYGe4zWc4vlujWk0qlp7Fy5i/s9GV2EhUkbc8D2J/pWc94kiFQoifGMgZzTnnNyhLMdxHXs3sazXSUvt8vJPGw0Qh33CrU193YcshkRo5DgdiTzmqLGSOYr0IPOam+yyK7M+7C8kHt9auW8S3IYK+2YLxGOQ349q6VojDlcia2mX7JtmBYZ+UA8j14pivECWhbCA8hj1PpjvVUi6kfbv+ZfU9amQeapMqrGQevSs3FLUtNtGnDpkN1bvOF8uNOWGM/l/hWbPOkEmI0Xj1/w6VoWziOFVdnKNwADwo9cetQXNhhy2AynkHtWSlZ6ms43iuVa9RlvfzSsAxyvv0oqORorZQp2h8ZwRmina+qI5mt2W4b620wjCCWQH7xzgfh3pklol6hlhIIPRT1H+IqCVLe5uHUhlOcDHIzWnYwHTsySYxjKj1+lEvd1W41eXuvYxH0yUt86nCjoe1IGgtlZXQybhgc8D3rRu9QaRim87Ce4FNjggdCWO1T1BORVpu3vGair+6Zfm5OAo8seq1qWMFuQGKvjoTjg02O1tw2ARwcYPer11IllEIkXEm3kdQe9TUbekS4RSvKWwl1dGyTyrd1KbuSvBPv8ASsrUV3IHJT5+Rjgj8KkM8UxzgBgO/T8ahZ5JJjE33SQcev0opwtvuKpU5vQLIoR5TyZHTB4zWtDpbIRLFcgxjOAflAPp9apQ2cCOiSFvMbBC8HIqzqL+WyojnYowAT375x3omru0SoNJXkiO5EEcjMMsemCeVPrjvSxXccgUSRpIfpjArJuVlHy7Cf7uTyKjtpnVwGOD34zT9noZupZ6G3eQwRxLN5ZxJnaF6jHesyS6ZIWU/N/u8VsvFHeWCkFwQOePy4rLmtZoukXHrLz+OKUGtmXNO91sVUKt81wrKx7Y7Vaiul2nauyIDJBHJpY1ijBS4jUgjOV4p5EB2i3jY8Z2g8/XiqbuSo2W5UdjjzY5D5WcdMc/StHT7xvtC7498fHyY6is9LZ/PI2ZYnPetOLy4ELFURwSo5yQ3uO1OTVrChfmuiPWmkluWTH3SQEX9OnWsRWMUnz5DD+Eda0HkdpiMck8gimlQXcA49fQ/jWkXZWJnLmk5C2ss00mM4bja/YUTeZE7MwBlb05P4//AFq0dM0wSOX3A7RuO054qnqNyWnZmUDceeP61ndOVkNpqPMxtosjHLhsk5JBrYbVUht/I+VlyTkjr9PSsOK8JGCo29AqkDNQTmVpc7HCZ6sKiVLmeppCr7Ne6aj20N4cxlF9cnr+NFQWEm1gMk9sEcUU2nHRAuWWrNK0hjmnGZEQ5+h+tRXstwf3Y+dEJxg8gelZ8N55Khtx356EVoGRdSQYyrkc5H3j/Sk1Z3KUk42W5nvCJmXdtT/ffmiWOUxnYwCKcDAINW1sTASFjxngs1IU8ufLGTGMAk7ce1Pn1Ice5DaRSllBzg9zVnVSsojiDYkRdrdvoB9Kmkure3t8ICWYcnHb2rKaXc2QC2aabk7ilaK5Vrcppby+YUDNljjGKuW4eDLsEGw4+bnkdsVo2TIJFaXp6N6VPqT6fcSHYCiD7ueR/jQ6mtrDVP3ea/yMdroTTDGdy8k54zV2xUzTjcy7T97JzVU2W9yEBwDzgZ/lWlHD/Ztv5gXMjDK5Xp70TkrWRMItyu9hdQsrYSuokTcuOazgkFvIVYhmxwRyPzoW782TDHGO7dqku7m2iUKIwZAeoPFRG691lvlleS0LmnzTGdcqNg5welaOpy2pfdGyhsfMeoz7e1YlvK0qljgRAHKhT+dR4PnYUgKQM9w1RKneVzSFZqHIle4l1FvcCNlO48Mh4qCEyQTFQjA5+9/hVu4heDAtlZsjJakSU52vGpk/iIH3a0T0MnHXXQ0rO385C2AWAwoJ5J+n51nXNvMWYOMnPDZ6/X3rWs7iCGGSFmUMeMr1U+uayrvTpHBdZ1KHnO7+lZxm+Zm04LkTWr6lEiSPeuxix6ZP6UiwtGPmR9w55PFSO08bxhJc+XkKBx+daVvIXx50Xy9T2yPWtHNoxUIvQZFLMoVI8rn72OKs3MdnLCJWJyDtJUcE4/lWVqF3l/lyAOijgCo4LmRiUkGVbqucZoUW/eFzpXjuSyKdjLGiBM8so3H2+lS21rMUA+Z17qTxUsViABNv2pnqTg1swTW0cLBfnnIwpz1pTqcuiNKVLnfvOxQeG3ghMitzjG3GSCfWisq9uJPNfzQck/e70VpGN1dmc5K+iNJ7e2f90jhT15Uc/jSx2QR+FfA5JJwKmt7ZGtGlcgmLnB757fSsq5vppZQkrFgDhcDBH0rFXlombSaik5Lc6O5ubeTSlCfNKvyltvJ/z0zXKXU0r4BYjjAyM8fWrkF6YsmQtkAqhY9D7010DEhwAxIwB90g0QjyMVar7WzM+3lYnZIMc/eYnArRgha4AAznrkHaDTf7P8/ClGAXgY6fhip57Z7KBVBYFxzz29ParlJPRGUYtataD9qRx4aU4b72DyB/Wqk9iSA6MWJ9KpsXkk2tkehxV6y85JRu3j3FCTjrcLqWlhLYSQSj5TketbU7i/thubdKowwA7Dpj6VU1KRrYhETbxywHX/61ZdveSCUnBIz0zUuLqe8aqXsm4MZPCEmZBLj8cCrNvp0coMjupVRnIJPT61cea2mGJIx5n8WDiryPaPYtbw5WVu5HUelDnKKCFKMpbnN3tyC7JEvlAcc9T7NVSGSdJSSCpI/CtGbT9spDlWC8lSp5+lU55VDBEjYQk9c8/StotNWMHFrVlmO/dYxEG+c/eKtn8K07K3UxSSSOq4XKnoB/9es2ws4ZZlQcbjwWp91eTQTiLa3lLxgDis3G7tEuM38UhlyFt2Lq7N/dA6fXNS2N1IGDOqgf3mxzWbI7I3yNmNunoalt5kQgscAeoyapw0JUveujq2tbe4003UZ3uhwVA/XPpWDcaiRviKgIeDtyKkfVvlMMI+QNyem76/4VFLLFfllEYQf3j/nNZQptP3jerUjJLk0fXzM4osm7ZKDjlVHWkgMquCQvXrxWlaac4ZioymMkg1P9j+yuJJwD7cA/WtfaJaHP7OTVwvHkW1iJbkLwAOevPFZq3bRyKwPA9Ks3N0s8hIO7jCj0qstqrzbogzDHII6GiKSWoNtvQ1oruG6QebH83Qv6+3vRVBUeOQE5YDoewoqHFLZmym+qNmSVIrRyrRPI648tuu3uf0rAedPOXarcHg4ztP8AWrk8SzTlxOhOcnHBFRSvCXwuWf8AvrwD+FVGCiTUm5fIijjkuJi7Z3DrtH8qsy3MUSCNSCwHEgPNaFpbxz2UjRyN5wGAW4/AetYtxHKkjZUhqlS5nZ9CZRcEpdy/ayHgk727cYrcKwS6fi7YK2flIGT+Nc3YbjIAw78tjNT390WlO0YXtjoR7VE4NysjalWUYttXLY0mOVyEnUp7nBNDlLFQsJyezdvwrJhvHWYbWOFPAPrWlexoyhxMFLLlh1/z9aHFppSYRcXFuKsymdQbcUkG9M8g/wCNWzDDJAWgKRkfeDen1rKkCmTaqsfVhWpp1rEYW81pAuDlm/zz9K2aSV0Zwbb5XqUFtZlcsW3LnsOtW7mUW0Kx7WViMkseT7U7zI7Yboyrf3XXjafcVR883TMsgLN2Pr9ar4tSPh0W5NFKbtfLZym0fKxJwPapls5+A8Qfd90+1Zyr9nblmJ7qMmt3SryQh1UkyFTtXHf+lRO6V0XSSk7SEgs4rVi8qlWHRD1P0rKuQbiRxuw27BUDAPvS3d64c+Zk85BNSW1xHO6hgS3qVz/9elGMl7zFJxekRkNp9mhLXAOw/wAH978api72SkIgRTn7vJwfrW7qKl4I9iEoONw7HuPesNoMrl1+UdMYBNXCSerJnBxdkWIXt5HVCAAfvSYxgfTp+NTvbKJcpIQP4cHBPvzWb8qsWyVjx+dWllV3EsuVDfdUd/pRIIvozd0+CQFnjKvIo3BQeazLwSuzB+MnsvB/wq1YyTNMgUnCt91SBVrU723mkIVdvHzYOAT3wPSudNqZ1OMXS3t+pzX2JjJyrq30xQsrQSCMKwUH5ic81omIvyrAx4ztPUf4fhUf2Avk/OR3BOdtb899zn5bfCSwXSTAKQvHXtRTk01LQiSaUIcZCkE/TIoqGk/hNE5L4iOSCLG8PuPVQpqodjuzGNotvVQualks7ksHViVPRh0qaO2nBG5X3HkHPBrV6dTLfdEbSu6ERj5RgsAOlaOmZuJVWZN6k4Jb+eaLeATPkMyMoxyRj/8AVS30z2ivBEFVujMvGT6VjN391GkYuPvvYTU5oLdmhtGV/wDaHf8Awrm2nmSTDA8mrALmRgCWVuoz1qx9ikK5A8xSOCBlh7GtIJU1YzlepK6RX8+KKIELmTjvxStJLKPNi2jJ5wentU0tsLaNX2neeqk8CohOFIcRxjPO0DNWrPVIlpp2Zes4d2N2c54wf6VY1e3kCoYhlNox/U0yykE2MsF9eAKs6hfAW6W8T8Kc88Ek+9YOUudG6hD2buzBjiutjMVwM8knFOiuBbt/C7HuR0qxBGLmfEhYknGCeT7elTzaY8ZAaPGDWjqLZmSg7XiOR47lAzRjLdTn+lTOkVpEQrFXx1Bxg+9JbWccHzyduSP/AK1Z95IZrg+WdyA5PtUrV2WxTbSu1qOnZ2fE0e4EZz3/APr1PaIjOvlwsAfQ/wBamsp0hi2PGjqBkBmHX2qKfUFcARhVGcEDrmiTb0SGopatlm81IxssSMdmOhGaosDcudjLk9VY8fh6VVdzNKNinGfmBzwavpcfZEGFXzCMZPQVFuVaD5nN+89CSLS5Fg80wtjOApHf/Cqw0yd5izgDPd+K1dOuZYJDcyMFT+LnOfbFV9RuY7+RpI5tpzwCen0qIzlzWNJU6fs0+vYjivLWzQbWJlHQ44U/j1qnPKLk9VBJ4zx+tUbmBlyWkG7tnPNMhdlOG6+p/pXQqa3OZ1Hbl6Gzb2syr8zkxr8xz2rSi1KC2ty6IryZ++wyPwqlZbmtpEZSARncT6f5xWcSsMpjlztbgjPNRyc7szSNR07SiaVxLFd7pS2MnJUnkf40VlKrbztJZTxle9FbKCWhlKbk7tGzue1n3biFHIwal1G9e5tw6AIu0cRjAP1qoYpBCWcglcMFxz+FU571pd4jIV1HTpxWKV3c2lNxi4rZjYdSeMlQB+XSr0x+22e9GzJj58/xe4/rWIzs5BK7JPccGr9nNLCpYFtw/j6Y9hWko9UYwnbR7FPLW2WzhuwP9KmW7uJHRsBfp/PitF4reZwLiPYyqAdpzz7jtUv2W0gUGAGV8cjO0/8A16hyXVGkYy6PQgkgmkQSPzu4facg1FHp68/r15qa2uJVuDhQqd1UYH4it+P7LDZiWcFZGyFUdCPWs5VHA3p0o1b6/ec7LJFYKPKI398jIH+NZbziSQjA5PIzWpfWfzeZGAy+1Z32QbgVGM9SRWkGrXZzTi72Lti0iSjqFB/iIFbLa9BtEMsYfB4cDB/XtXNGRYgEBVByrsMk/SocmSXJbI9elJ0lJ3ZcK8qStE6O4AmTzIZMjuccj6+1Yd1GqudsTsxOD1Fa+khOFdshsqABnrVS+0+UXLBdwHrnjFELRdgneUeexDDERHvkVhGByOg+gqncmKORTl2VuqnjH41NLOysyyzLIp6jBIH0qMW0cwUDMhJxya2WmrMnZrQnhuy+xItoI7nPPsacthcCcs7fNnkjt+NNtrb7NKPkLH9K0NRM6RxFDuXYMZGPrUOyeg1drXoNvbhfJS3UghckkHrn+lZ32TzOYzk9celU5XkDHP3jxk1Yjdo4zjoP4iOTTUOVaCb5nqaFras7CJxuX6/yqe70hbJVkcHa3Tjr+FRWMjSN5jPjbjnB4/EU/UtTEku1QRCuMA5ww7Go95ysjXlpqDb36GVJdmIsqrtB7CkEn2g4OST371L5AvCdkmP9k45/GojA6ONkZXA7nNbXSMLPdmrbRJFFhX3MeuOP0oqnbmUjbtJH8qKyd76s1TjbRE17PMkxLI6kfrVQSo82+ZCB2U55rZeUrsSRFdFX7zdcexqlLaRzSbopQ2f4X4IpJpDknfQjECMRsJA9Ow/GtCY/Y4ECxDzSoO844BpltYlBvd1RQRyB/nNN1C6jluMREDYNgB6Ee9S5XdkNRtFt6MyJpJmkyQSO/tT4JXY/wlf0rR8uNoSxRgyjkqen4+lZfnGEjC4IOfrWkZc2hnKLi9TYSd4MNIPcA9f16VYeV9Qi3kfvFXDBeOOxrIhlaU9GweTn+da1rPb2y7pTkYIAA7njPvis5Qtr1NYTv7t9Cn572jYkJIPXFBvrUuHkhVSOyk4/Kqd0zyt8u1wePm45quzIiCKRMux6gcfhVqmnuR7RrRGi0mlyyBmLgZ5QDB/OmpHAXxCAcnjK8gVT+zxkgo3XqvpWjZ2jRAyMGAAzj/Cm1yrcm7k7WLcpOnoFUglk+9jsfSqC6luUwt9zOfY/X2pLy/LgqVBQcLnjbVRlRkLIF8zH3QRzShDS8hynd+7saHlw3/MQVXPVWPH4Ht+NMGnTq20Jwvb/AOvVOLzEjDIr5P3uehrSsLm5V15PHGAaUrpaDXK37xbhgFvB5lxgDt7+3/16oXerCQlFAWP+FCMgVpa1MJyrKyeYFAdV4APcfT+tcxNBlWYZU5xz/I1NNX1kaV3yvkhsX4wLkqueWPboPb1pDEyXLKoUr02Dn9ap2rSRNtUfMR9cVNtmlcnyiCB83PX3rVmS2LSb/IdxlyOoJwuPY1DAjMx87aqnoD2rQtjFBGPNycjhWb+lU33ST/utrDPoMj8amMtRyhomWzozeV59uQ0ROMtx+dW4bOJYfMlZSinkA8g+1UNRuJooI4ywwfm4PeqdvdNL8hJYEbeDz9aOWUluWp04y0RsGa2KsYeZD09/8DRWXiRZMllyfUdfeip5Eg9pc1biRLi2VkHCoB+XesgJKJTtACHqCaZaXMsUiKSxA/hAroQbR7RZmVWfOCity3rkf4USvAaXtdb2Mi4k8uERsSCTkLjGPc/WsuZnWfjKt6npWtfxpc7njJ2jkgdQPpVKSKL7OrxZJPGT1zVxaSMZJ3J0untrfJVRKf4lI4FMiNvcD51/eE9Rx+lRWqCRgJRxnqRwDWrHYQKytuAOOdxxmk+WJXvTRIkFnZ2ySyZbzCVwB90juf8ACsm6MzPujAZSf0q/q8EtsQkchKEZCkfrVC0eRXxtOT6Dr+FEduYc0ubktaxds4PPjPHz4wu7nPtVSbSpElJYc9eOAP8ACtWO4SEF1I3jqPQ1Uvrt5SJNu/fznP8AXtUqUr6FSjBR13M1PLhk253LjPIHWtGC9QxyWxOwSY5yflI71S8hJG80uVODnd0qADyWwoYyDuwrbSWhhdx1RYuIpYnKuCfywaRLZZFxFhTnOw9R9DVy0m/dqk6h16gN6/0rTjt7eO1+0oqyPnHlkcD3JqJT5TSEObYz9PsWeQ/NsK85K5B9cmorq+aOQpANq9mH3vzonvpI3Ybm2txgHAFNfbclTj94x5P8OPf0oSu7sV1a0dyqt60jFeQxGDnjFaNnAHCkA8/eOcjFVWsIdodXw2ccnNMeZ4AfKaQkcHKYAH0pS10QR913kW76xdd0cWAMk5Ufe/Gora3lVVBJwfQc1JZahOrbSASevfite/liaAC3UKpXJ5+Yen0FZOUo+6bqMJpyT2MvULIkAREM7AbmBxg/Tsaz41NvIQ3zZwRtPH4mnzvNIwO8MB1OaFiuJ12gruP8PHzD1raOi1MZWk9EWpmS6UebJhj6DgD0+lVorCQMMfcz1XmrEenEHzGYqw5JPIH41rQxpDbOTKN7LgAc5/H1pOaitCo03N3ZimXE58zg56A5FFQ3VvNvLbG3HuRwaKuyZk20zVGlia4ZkbJUFmAGCQPSqV3JIsirt2lDhfp71aiuJBdnccL13E8YqtqsyPIzorCNuV2nHFZxbvqaz5eW6IZCBtkWQe6+hq/aiOaPa0agdnA5P4d6ybd0TdgsznsOlacUgUAIWLnrk9KJ7EwtuTTWiae+HXDDnPbB96qrPCjboyS3YMc8/hWnfRC+gQmTM5HzDPJ9DWBPp7W8haSXy+2ByamDT3NKq5X7q0Nd5Jrm1ILCSdedq8lVrIa4CMVlyuefrirunRuFLqxTH8RqveLCZWGwcsSuD/jWkUk7Gc23aRVaRnbIIOexPNbOkRo74lQYbgljwax4bUEgxzpgnkDr+XetOxSY3K+Z1HTNFTaw6S95NkepW0ocq+R9RwKigdIYgtxkqemD/nFbF5exPGAFVtq4x0ZvesidEmTktg8424Yfh3qISbWpVSMYybi7jpJYPPwqkccZ5FaNu+LRpARhchwT97PT8qyIdN2q0m47QMk4xV2LUoba2aBQ22T7zN1/L0omr6RFCVneWhlXUgZyGBQ+/Iot/OUYA4PvjNT3Ati4+9nrkcj8KsWG15BGvmBj/tYGa1eiMopOViW3jSGFmMmZHHQ80weW0pG0hsc5GR+FMuNMuGbJmBbOcZ7/AFp9pp8xJZnIH8RPpWT73N0m7RSLxtlit/MjVWbqCOo+tYt1dzrIWYMcd+5/Gt17iNI/LjkUs2N3HSsq6DKTuiEink4/w71MHrqOrFW90qB1uSDLjp1zg1ZtvKWYbTujPvg1UMSSuTG4Ut1yuK0rOwMW2ZzgDkf/AFquU0jFRbeiJZHfz2adgFUYAbp7ZqtHK73O8uHZeAQflH0qG+vxcStujA54A9PrTLWJJOdxRge+ePr6U1HTUbleWmpsNc+fIqMu9cYDDjNFP8sxWznejOMfKvUe9FZryN5f3iC9acMQE+TsMf5zUEDuw2zQ8D1H8vSiihbET0kLLb2sTDa5U9RuWokuYrN225b3bt+FFFXFX3Mpys9CxYTm5uy7Phj0qW/A3kLGmOmc8miik0lLQuDbp6k9oqLEysqqGXA7/pVC4tCJivlEKTzjmiipTszSUU4ohktFtyWQscflmrWnzSFWjKEFhjNFFW3eOpmvdmrFa4hfzWJBjOeeMg/UVMpggTMxUuOmCePrRRS30E3y3ZMt7HcxmJvlQfdwM1n3Fg/mHHXrjv8Ah6iiihe69B/Grsie1mRVIDEe4q7psUhbLISPVqKKqUnyihFc5fuWMJIKgrjmse7vHaTIc9MZxzRRRTSauVWk07IpRzPuwSevWtWC4GNkuGB/T/CiiqmkYwky3H9miJZId575OTVe4vDd/unBQgYQ7eB7GiisFBXubupLl5ehSOnzOclTv9BwR7+9WYbKUW5Ys4PTJ45ooquZhGmiS2t50fG8tz1HWiiihsuEdD//2Q==',
  // sols Poly Haven (CC0) : galets de rivière, terrain rocheux, sillons de champ
  grass: 'textures/grass.jpg',
  dirt: 'textures/dirt.jpg',
  sand: 'textures/sand.jpg',
  pebbles: 'textures/pebbles.jpg',
  rocky: 'textures/rocky.jpg',
  furrows: 'textures/furrows.jpg',
  lava: 'textures/lava.jpg',
  snow: 'textures/snow.jpg',
  floor: 'textures/floor.jpg',
  cobble: 'textures/cobble.jpg',
};
const GTEX = { ready: false, img: {}, wait: [] };
const whenTex = f => GTEX.ready ? f() : GTEX.wait.push(f);
(function loadGroundTextures() {
  const keys = Object.keys(GTEX_SRC); let left = keys.length;
  for (const k of keys) {
    const im = new Image();
    im.onload = im.onerror = () => {
      if (--left) return;
      GTEX.ready = keys.every(n => GTEX.img[n].naturalWidth > 0);
      if (!GTEX.ready) return;
      for (const f of GTEX.wait) f(); GTEX.wait.length = 0;
      for (const k in BIOME_CACHE) delete BIOME_CACHE[k];
      if (biome) setBiome(biomeKey);
      // L'herbe du village prend aussi la peinture
      if (TEX.grass && TEX.grass.image.width !== 1024) { const c = document.createElement('canvas'); c.width = c.height = 1024; villageGrass(c.getContext('2d')); TEX.grass.image = c; TEX.grass.dispose(); TEX.grass.needsUpdate = true; (TEXC.grass || []).forEach(x => { x.dispose(); x.needsUpdate = true; }); }
      // Prépare à l'avance les textures de toutes les zones (petit à petit), pour ne pas ralentir le jeu au changement de zone
      const jobs = [causticTile];
      for (const B of BIOMES) {
        const tc = c => B.raw ? null : c;
        jobs.push(() => B.ground === 'sand' ? texTile('sand', B.base, 0.8, 0.35) : texTile(B.ground, tc(B.base), B.gk || 0.9), () => texTile('dirt', tc(B.path), 1));
        if (B.feature === 'beach') jobs.push(() => texTile('sand', tc(B.sand), 0.8, 0.35));
        if (B.feature === 'fields') jobs.push(() => texTile('furrows', tc(B.crop), 1, 'tile'));
      }
      const next = () => { const j = jobs.shift(); if (j) { j(); setTimeout(next, 120); } };
      setTimeout(next, 400);
    };
    GTEX.img[k] = im; im.src = GTEX_SRC[k];
  }
})();
// Tuile sans raccord : on « tamponne » des morceaux ronds de la peinture, tournés au hasard, en bouclant sur les bords
// (pas de motif en miroir visible). Avec une teinte : on garde le relief de la peinture et on change la couleur.
const texCache = {};
function texTile(name, tintCol, k, spin) {
  const key = [name, tintCol, k, spin].join();
  if (texCache[key]) return texCache[key];
  const mem = dcGet('tex:' + key); if (mem) return (texCache[key] = mem);
  const im = GTEX.img[name], n = im.naturalWidth, T = 512, rad = n * 0.34, R = seeded(name.length * 131 + 7);
  const c = document.createElement('canvas'); c.width = c.height = T;
  const g = c.getContext('2d');
  const seamless=GTEX_SRC[name].startsWith('textures/');
  if(seamless) g.drawImage(im,0,0,T,T);
  else for (let x = 0; x < T; x += n) for (let y = 0; y < T; y += n) g.drawImage(im, x, y);
  const st = document.createElement('canvas'); st.width = st.height = rad * 2;
  const sg = st.getContext('2d'), mask = sg.createRadialGradient(rad, rad, rad * 0.45, rad, rad, rad);
  mask.addColorStop(0, 'rgba(0,0,0,1)'); mask.addColorStop(1, 'rgba(0,0,0,0)');
  const rot = spin === undefined ? Math.PI : spin;
  // 'tile' : la peinture se raccorde déjà toute seule (sillons, rangées), on la répète telle quelle
  for (let s = 0; !seamless && spin !== 'tile' && s < 150; s++) {
    sg.globalCompositeOperation = 'copy';
    sg.drawImage(im, rad + R() * (n - 2 * rad), rad + R() * (n - 2 * rad), rad * 2, rad * 2, 0, 0, rad * 2, rad * 2);
    sg.globalCompositeOperation = 'destination-in'; sg.fillStyle = mask; sg.fillRect(0, 0, rad * 2, rad * 2);
    const x = R() * T, y = R() * T, a = (R() * 2 - 1) * rot;
    for (const ox of [-T, 0, T]) for (const oy of [-T, 0, T]) {
      if (x + ox < -rad * 1.5 || x + ox > T + rad * 1.5 || y + oy < -rad * 1.5 || y + oy > T + rad * 1.5) continue;
      g.setTransform(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), x + ox, y + oy); g.drawImage(st, -rad, -rad);
    }
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (tintCol) try {
    const d = g.getImageData(0, 0, T, T), a = d.data, v = parseInt(tintCol.slice(1), 16);
    const r = v >> 16, gr = v >> 8 & 255, b = v & 255; let sum = 0;
    for (let i = 0; i < a.length; i += 4) sum += a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11;
    const avg = sum / (a.length / 4) || 1;
    for (let i = 0; i < a.length; i += 4) { const f = 1 + (k || 1) * ((a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11) / avg - 1); a[i] = r * f; a[i + 1] = gr * f; a[i + 2] = b * f; }
    g.putImageData(d, 0, 0);
  } catch (e) {
    // image illisible (page ouverte en fichier local) : teinte posée par-dessus, sans lire les pixels
    g.globalCompositeOperation = 'color'; g.fillStyle = tintCol; g.fillRect(0, 0, T, T); g.globalCompositeOperation = 'source-over';
  }
  if (GTEX.ready) dcPut('tex:' + key, c);
  return texCache[key] = c;
}
// Seulement les reflets clairs de l'eau, pour les faire onduler par-dessus
function causticTile() {
  if (texCache.caustic) return texCache.caustic;
  const src = texTile('water'), c = document.createElement('canvas'); c.width = c.height = src.width;
  const g = c.getContext('2d'); g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
  let mx = 0; for (let i = 0; i < a.length; i += 4) mx = Math.max(mx, a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11);
  for (let i = 0; i < a.length; i += 4) { const l = (a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11) / mx, v = Math.max(0, (l - 0.72) / 0.28); a[i] = a[i + 1] = a[i + 2] = 255; a[i + 3] = Math.min(255, v * v * 400); }
  g.putImageData(d, 0, 0);
  return texCache.caustic = c;
}

// ---------- Terrains du Bastion : une zone par boss, elle change après chaque boss ----------
const BIOMES = [
  { name: 'Prairie des Champignons', ground: 'grass', raw: true, base: '#b8d14e', base2: '#a3c03c', speck: ['#cfe26a', '#98b334', '#e2ee98'], blades: true,
    path: '#d9a066', pathEdge: '#bf8350', feature: 'beach', sand: '#f3e5a4', water: '#86d9e0', water2: '#b9eef0',
    leaves: ['#6cb83f', '#4f9f3a', '#f29abb', '#86c64a'], blossom: true, trunk: '#8a5a3a', rock: '#b3aca2', flowers: ['#ffffff', '#ff6f9f', '#ffd23f'],
    out: '#3e5a2a', edge: '#5f8f32', decor: { tree: 34, flowers: 34, rock: 12, bush: 16 } },
  { name: 'Marais des Blobs', ground: 'grass', base: '#9fd8c4', base2: '#88c7b1', speck: ['#b6e6d6', '#7bbca6', '#d0f2e6'],
    path: '#c9b3e6', pathEdge: '#a98fd0', feature: 'puddles', jelly: ['#4fb8ff', '#ff4f6d', '#ffd23f', '#4fe0a0'],
    leaves: ['#5fae8a', '#4f9f9a', '#7fc0a0'], bush: ['#4f9f7a', '#5fae8a', '#6fb89a'], berry: '#4fb8ff', trunk: '#6a5a4a', rock: '#a9b8c8', flowers: ['#ff8fd0', '#9ad8ff', '#ffffff'],
    out: '#2e5a52', edge: '#4f9f8a', decor: { tree: 22, bush: 22, flowers: 22, rock: 10, reed: 26 } },
  { name: 'Champs dorés', ground: 'grass', base: '#e3c75e', base2: '#d3b44a', speck: ['#f0d878', '#c6a63e', '#f6e6a0'], blades: true,
    path: '#b98a4f', pathEdge: '#9a6f3c', feature: 'fields', crop: '#c9a13a', crop2: '#ecd06a',
    leaves: ['#8fc04a', '#a8c84a', '#f0b43a'], trunk: '#9a6a3a', fruit: '#ff8a1f', rock: '#b8a888', flowers: ['#ff8a1f', '#ffffff', '#ffd23f'],
    out: '#6a5a2a', edge: '#a8903f', decor: { tree: 16, hay: 22, flowers: 26, bush: 10, rock: 8 } },
  { name: 'Antre du Démon', ground: 'lava', base: '#6a4a50', base2: '#58393f', speck: ['#7a5860', '#462e34', '#8a6a70'],
    path: '#3e2c32', pathEdge: '#2a1c22', feature: 'lava', leaves: ['#5a3a3a'], rock: '#4a3a40', flowers: ['#ff8a1f'],
    out: '#1e1216', edge: '#2a1c22', decor: { lavarock: 34, deadtree: 16, rock: 22 } },
  { name: 'Clairière Tiki', ground: 'rocky', base: '#5c9a42', base2: '#4c8836', speck: ['#6fae50', '#427628', '#86c060'], blades: true,
    path: '#86603e', pathEdge: '#6b4a30', feature: 'leaves', leaves: ['#3f8a3a', '#5fa04a', '#2f7a38', '#d98a2a'], trunk: '#6a4a30', bush: ['#3f8a3a', '#4f9a42', '#2f7a38'],
    rock: '#9a9a8a', flowers: ['#ff4f4f', '#ffffff'], out: '#1e3a1a', edge: '#2f6a2a', decor: { tree: 44, mushroom: 34, bush: 20, rock: 8 } },
  { name: 'Pics du Yéti', ground: 'snow', gk: 0.65, base: '#e5ecf1', base2: '#cbd9e5', speck: ['#d8c49a', '#ad9468', '#e2d2ae'],
    path: '#a8916a', pathEdge: '#8f7a56', feature: 'cracks', rock: '#a89878', leaves: ['#8fae5a'], bush: ['#8fae5a', '#9fb86a', '#7f9e4a'], flowers: ['#ffffff', '#c9a0ff'],
    out: '#5a4a32', edge: '#8a7656', decor: { boulder: 36, rock: 30, bush: 8, crystal: 12 } },
  { name: 'Côte des Glubs', ground: 'sand', base: '#ead9a6', base2: '#dac692', speck: ['#f4e6bc', '#cbb782', '#fff2cc'],
    path: '#d4bf8a', pathEdge: '#bfa874', feature: 'sea', water: '#3fa9d9', water2: '#7fd0ec',
    leaves: ['#5fbf5a'], rock: '#a8a2b0', flowers: ['#ff9fc0'], out: '#1f5a7a', edge: '#3f8fb0', decor: { palm: 20, coral: 22, shell: 26, rock: 14 } },
];
let biome = null, biomeIdx = -1, biomeKey = -1;
// Zone de la vague n : elle change à chaque vague de boss (5, 10, 15…).
// Vague 25 (les deux premiers boss) : la carte est coupée en deux, avec le sol des zones de ces deux boss ;
// vague 50 (les quatre boss) : quatre quarts. Ensuite le cycle reprend normalement.
const bossZone = bi => bi + 1;   // zone où le boss apparaît la première fois (vagues 5, 10, 15, 20)
function mapOfWave(n) {
  if (n % 5 === 0 && n >= 25) { const l = bossesOfWave(n); if (l.length > 1) return l.map(bossZone); }
  return Math.floor(n / 5);
}
function seeded(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// Zones du Bastion : chaque zone est peinte une fois (sol, chemins, eau, décor) puis gardée prête.
// On garde au plus la zone en cours et la suivante, préparée pendant la pause qui suit le boss.
const BIOME_CACHE = {}, DSPR_ALL = {};
function prepareBiome(i) { const key = String(i); if (!BIOME_CACHE[key]) BIOME_CACHE[key] = Array.isArray(i) ? buildMixed(i) : buildBiome(i); return BIOME_CACHE[key]; }
// Carte partagée entre plusieurs zones : deux moitiés (gauche / droite) ou quatre quarts, séparés par une bordure
function buildMixed(list) {
  const n = list.length, h = WORLD / 2;
  const rect = k => n === 2 ? [k * h, 0, h, WORLD] : [(k % 2) * h, Math.floor(k / 2) * h, h, h];
  const layer = document.createElement('canvas'); layer.width = layer.height = WORLD;
  const lg = layer.getContext('2d'), tall = [];
  let lava = [], lavaClip = null;
  list.forEach((zi, k) => {
    const part = buildBiome(zi), [x, y, w, hh] = rect(k);   // une zone à la fois, pour ne pas garder trop d'images en mémoire
    lg.drawImage(part.layer, x, y, w, hh, x, y, w, hh);
    for (const d of part.tall) if (d.x >= x && d.x < x + w && d.y >= y && d.y < y + hh) { d.bi = zi; tall.push(d); }
    if (part.lava.length) { lava = part.lava; lavaClip = [x, y, w, hh]; }
  });
  // bordure entre les zones
  lg.lineCap = 'round';
  const seams = n === 2 ? [[h, 0, h, WORLD]] : [[h, 0, h, WORLD], [0, h, WORLD, h]];
  for (const [col, wd] of [['rgba(29,18,56,.35)', 34], ['rgba(255,248,220,.55)', 6]]) { lg.strokeStyle = col; lg.lineWidth = wd; for (const [a, b, c, d] of seams) { lg.beginPath(); lg.moveTo(a, b); lg.lineTo(c, d); lg.stroke(); } }
  const B = BIOMES[list[0] % BIOMES.length];
  return { B, layer, lava, lavaClip, amb: [], tall: tall.sort((a, b) => a.y - b.y), water: null, mix: list };
}
function setBiome(i) {
  const b = prepareBiome(i), key = String(i);
  for (const k in BIOME_CACHE) if (k !== key) delete BIOME_CACHE[k];
  biome = b; biomeKey = i; biomeIdx = Array.isArray(i) ? i[0] : i; DSPR = DSPR_ALL[biomeIdx % BIOMES.length] || (DSPR_ALL[biomeIdx % BIOMES.length] = {});
  b.amb.length = 0;
}
function buildBiome(i) {
  const B = BIOMES[i % BIOMES.length], R = seeded(4242 + i * 977), rr = (a, b) => a + R() * (b - a);
  const prevIdx = biomeIdx, prevD = DSPR;
  biomeIdx = i; DSPR = DSPR_ALL[i % BIOMES.length] || (DSPR_ALL[i % BIOMES.length] = {});
  const TX = GTEX.ready, tile = (name, col, k) => ctx.createPattern(texTile(name, B.raw ? null : col, k), 'repeat');
  // Sol de base : peinture Canva teintée pour la zone, sinon motif dessiné
  let groundFill;
  if (TX) groundFill = B.ground === 'sand' ? ctx.createPattern(texTile('sand', B.base, 0.8, 0.35), 'repeat') : tile(B.ground, B.base, B.gk || 0.9);
  else {
    const t = document.createElement('canvas'); t.width = t.height = 256;
    const g = t.getContext('2d');
    g.fillStyle = B.base; g.fillRect(0, 0, 256, 256);
    g.fillStyle = B.base2; g.globalAlpha = 0.45;
    for (let k = 0; k < 12; k++) {
      const x = rr(0, 256), y = rr(0, 256), a = rr(18, 55), b = rr(12, 36), r = rr(0, 3);
      for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) { g.beginPath(); g.ellipse(x + ox, y + oy, a, b, r, 0, TAU); g.fill(); }
    }
    g.globalAlpha = 1;
    for (let k = 0; k < 420; k++) { g.fillStyle = B.speck[k % B.speck.length]; const x = rr(0, 256), y = rr(0, 256); if (B.blades) g.fillRect(x, y, 2, rr(4, 7)); else { g.beginPath(); g.arc(x, y, rr(1, 2.6), 0, TAU); g.fill(); } }
    groundFill = ctx.createPattern(t, 'repeat');
  }
  const pathFill = TX ? tile(B.ground==='snow'?'pebbles':'dirt', B.path, 1) : B.path;
  const shapes = [], pathPts = [], lavaPaths = [];
  // Grandes taches d'ombre et de lumière, pour casser la répétition
  for (let k = 0; k < 34; k++) { const x = rr(0, WORLD), y = rr(0, WORLD), a = rr(120, 300), b = rr(80, 200); if (TX) { shapes.push({ blob: [x, y, a * 1.3, b * 1.3, k % 3 ? 'rgba(30,50,10,' : 'rgba(255,248,200,', k % 3 ? 0.16 : 0.17] }); continue; } const p = new Path2D(); p.ellipse(x, y, a, b, rr(0, 3), 0, TAU); shapes.push({ fill: B.base2, alpha: 0.45, p }); }
  if (TX && B.blades) shapes.push({ tufts: true });
  // Chemins de terre sinueux
  for (let k = 0; k < 3; k++) {
    const p = new Path2D(); let x = rr(0, WORLD), y = k % 2 ? 0 : WORLD; p.moveTo(x, y);
    let px = x, py = y;
    for (let s = 0; s < 5; s++) {
      const nx = rr(200, WORLD - 200), ny = k % 2 ? (s + 1) * WORLD / 5 : WORLD - (s + 1) * WORLD / 5, mx = (x + nx) / 2, my = (y + ny) / 2;
      p.quadraticCurveTo(x, y, mx, my);
      for (let u = 0; u < 1; u += 0.04) pathPts.push([(1 - u) * (1 - u) * px + 2 * u * (1 - u) * x + u * u * mx, (1 - u) * (1 - u) * py + 2 * u * (1 - u) * y + u * u * my]);
      px = mx; py = my; x = nx; y = ny;
    }
    shapes.push({ strokes: TX ? [['rgba(40,25,10,.28)', 96], [B.pathEdge, 84], [pathFill, 72]] : [[B.pathEdge, 92], [B.path, 72]], p });
  }
  if (TX) shapes.push({ pebbles: true });
  let water = null;
  const waterFill = TX ? ctx.createPattern(texTile('water'), 'repeat') : null;
  if (B.feature === 'beach') {
    const sand = new Path2D(), shallow = new Path2D(), deep = new Path2D();
    for (const [path, r0] of [[sand, 980], [shallow, 800], [deep, 720]]) {
      path.moveTo(WORLD + 60, WORLD + 60);
      for (let a = Math.PI; a <= Math.PI * 1.5 + 0.001; a += 0.05) { const r = r0 + Math.sin(a * 9) * 40 + Math.sin(a * 23) * 14; path.lineTo(WORLD + Math.cos(a) * r, WORLD + Math.sin(a) * r); }
      path.closePath();
    }
    if (TX) shapes.push({ fill: ctx.createPattern(texTile('sand', B.raw ? null : B.sand, 0.8, 0.35), 'repeat'), p: sand }, { fill: 'rgba(110,70,20,.12)', p: shallow, grow: 26 });
    else shapes.push({ fill: B.sand, p: sand });
    water = { shore: shallow, deep, box: [WORLD - 1060, WORLD - 1060, WORLD, WORLD] };
  } else if (B.feature === 'sea') {
    const mk2 = off => { const p = new Path2D(); p.moveTo(WORLD + 60, -60); for (let y = -60; y <= WORLD + 60; y += 40) p.lineTo(WORLD * 0.72 + off + Math.sin(y / 170) * 70 + Math.sin(y / 53) * 18, y); p.lineTo(WORLD + 60, WORLD + 60); p.closePath(); return p; };
    const shallow = mk2(0), deep = mk2(110);
    if (TX) shapes.push({ fill: 'rgba(110,80,30,.12)', p: shallow, grow: 30 });
    water = { shore: shallow, deep, box: [WORLD * 0.72 - 120, 0, WORLD, WORLD] };
  } else if (B.feature === 'puddles') {
    for (let k = 0; k < 34; k++) {
      const x = rr(100, WORLD - 100), y = rr(100, WORLD - 100), a = rr(40, 110), b = a * rr(0.5, 0.8), col = B.jelly[k % 4];
      const p = new Path2D(); for (let q = 0; q <= 24; q++) { const an = q / 24 * TAU, w = 1 + Math.sin(an * 3 + k) * 0.06; p[q ? 'lineTo' : 'moveTo'](x + Math.cos(an) * a * w, y + Math.sin(an) * b * w); } p.closePath();
      const gr = ctx.createRadialGradient(x - a * 0.3, y - b * 0.35, 2, x, y, a);
      gr.addColorStop(0, tint(col, 0.6)); gr.addColorStop(0.55, col); gr.addColorStop(1, tint(col, -0.35));
      const h = new Path2D(); h.ellipse(x - a * 0.38, y - b * 0.38, a * 0.28, b * 0.13, -0.3, 0, TAU);
      const h2 = new Path2D(); h2.ellipse(x + a * 0.45, y + b * 0.3, a * 0.1, b * 0.06, -0.3, 0, TAU);
      shapes.push({ fill: 'rgba(30,20,60,.1)', p, grow: 6 }, { fill: gr, alpha: 0.82, p, line: tint(col, -0.5), lw: 3 }, { fill: '#ffffff', alpha: 0.75, p: h }, { fill: '#ffffff', alpha: 0.55, p: h2 });
    }
  } else if (B.feature === 'fields') {
    const crop = TX ? ctx.createPattern(texTile('furrows', B.raw ? null : B.crop, 1, 'tile'), 'repeat') : B.crop;
    for (let k = 0; k < 9; k++) {
      const x = rr(80, WORLD - 420), y = rr(80, WORLD - 340), w = rr(220, 400), h = rr(160, 300);
      const p = new Path2D(); p.rect(x, y, w, h);
      const rows = new Path2D(); for (let yy = y + 12; yy < y + h; yy += 22) { rows.moveTo(x + 6, yy); rows.lineTo(x + w - 6, yy); }
      shapes.push({ fill: crop, p, line: B.pathEdge, lw: 5 });
      if (!TX) shapes.push({ strokes: [[B.crop2, 9]], p: rows });
    }
  } else if (B.feature === 'lava') {
    for (let k = 0; k < 3; k++) {
      const p = new Path2D(); let x = k % 2 ? 0 : rr(0, WORLD), y = k % 2 ? rr(0, WORLD) : 0; p.moveTo(x, y);
      for (let s = 0; s < 6; s++) { const nx = k % 2 ? (s + 1) * WORLD / 6 : rr(150, WORLD - 150), ny = k % 2 ? rr(150, WORLD - 150) : (s + 1) * WORLD / 6; p.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2); x = nx; y = ny; }
      shapes.push({ strokes: [['#2a1414', 80], ['#7a1a10', 66], ['#e8401a', 52], ['#ff8a2a', 30], ['#ffd86a', 10]], p, glow: true }); lavaPaths.push(p);
    }
    for (let k = 0; k < 40; k++) { const p = new Path2D(); let x = rr(0, WORLD), y = rr(0, WORLD); p.moveTo(x, y); for (let s = 0; s < 3; s++) { x += rr(-50, 50); y += rr(-50, 50); p.lineTo(x, y); } shapes.push({ strokes: [['#2a1414', 10], ['#a8301a', 6], ['#ffb02e', 2.2]], p, glow: true }); }
  } else if (B.feature === 'cracks') {
    for (let k = 0; k < 40; k++) { const p = new Path2D(); let x = rr(0, WORLD), y = rr(0, WORLD); p.moveTo(x, y); for (let s = 0; s < 4; s++) { x += rr(-70, 70); y += rr(-70, 70); p.lineTo(x, y); } shapes.push({ strokes: [['#e2d2ae', 9], ['#7a6446', 5]], p }); }
  }
  if (water) {
    // Eau peinte : claire près du bord, plus profonde au large
    if (TX) shapes.push({ fill: waterFill, p: water.shore }, { fill: B.water, alpha: 0.3, p: water.shore }, { fill: B.water, alpha: 0.35, p: water.deep }, { fill: 'rgba(10,50,110,.22)', p: water.deep });
    else shapes.push({ fill: B.water2, p: water.shore }, { fill: B.water, p: water.deep, waves: true });
  }
  // Décor
  const decor = [];
  for (const [type, n] of Object.entries(B.decor)) for (let k = 0; k < n * 3; k++) {
    let x = rr(0, WORLD), y = rr(0, WORLD);
    if (R() < 0.5) { const e = Math.floor(R() * 4), d = rr(20, 260); if (e === 0) x = d; else if (e === 1) x = WORLD - d; else if (e === 2) y = d; else y = WORLD - d; }
    // Pas d'arbres dans l'eau, et les coraux restent dans l'eau
    const wet = B.feature === 'beach' ? Math.hypot(WORLD - x, WORLD - y) < 820
      : B.feature === 'sea' ? x > WORLD * 0.72 + Math.sin(y / 170) * 70 + Math.sin(y / 53) * 18 - 10 : false;
    if (wet && !['rock', 'coral', 'shell'].includes(type)) continue;
    if (type === 'coral' && !wet) continue;
    decor.push({ type, x, y, s: rr(0.75, 1.3), c: Math.floor(R() * 8), r: rr(0, TAU), deco: !!TALL[type] });
  }
  if (B.feature === 'leaves') for (let k = 0; k < 260; k++) decor.push({ type: 'leaf', x: rr(0, WORLD), y: rr(0, WORLD), s: 1, c: Math.floor(R() * 8), r: rr(0, TAU) });
  decor.sort((a, b) => (a.type === 'leaf' ? -1 : 0) - (b.type === 'leaf' ? -1 : 0) || a.y - b.y);
  // Tout le sol est peint une fois dans une grande image ; à chaque image on n'en copie que la partie visible
  const layer = document.createElement('canvas'); layer.width = layer.height = WORLD;
  const lg = layer.getContext('2d'); lg.lineCap = 'round'; lg.lineJoin = 'round';
  lg.fillStyle = groundFill; lg.fillRect(0, 0, WORLD, WORLD);
  const dark = B.speck[1], light = B.speck[2];
  for (const sh of shapes) {
    if (sh.tufts) {
      // Touffes d'herbe nettes par-dessus la peinture
      for (let k = 0; k < 2600; k++) {
        const x = rr(0, WORLD), y = rr(0, WORLD), h = rr(7, 13);
        lg.strokeStyle = k % 3 ? dark : light; lg.lineWidth = 2;
        lg.beginPath(); for (const dx of [-4, 0, 4]) { lg.moveTo(x + dx * 0.4, y); lg.quadraticCurveTo(x + dx * 0.6, y - h * 0.5, x + dx + rr(-1, 1), y - h * (dx ? 0.8 : 1)); } lg.stroke();
      }
      continue;
    }
    if (sh.blob) { softBlob(lg, ...sh.blob); continue; }
    if (sh.pebbles) {
      // Cailloux et herbe en bordure des chemins
      for (let k = 0; k < pathPts.length * 1.4; k++) {
        const [px, py] = pathPts[Math.floor(R() * pathPts.length)], a = rr(0, TAU), d = rr(0, 30), x = px + Math.cos(a) * d, y = py + Math.sin(a) * d, s = rr(2, 5);
        lg.fillStyle = 'rgba(40,25,10,.3)'; lg.beginPath(); lg.ellipse(x + 1, y + 1.5, s, s * 0.7, 0, 0, TAU); lg.fill();
        lg.fillStyle = k % 2 ? '#c9b8a0' : '#a8957c'; lg.beginPath(); lg.ellipse(x, y, s, s * 0.7, 0, 0, TAU); lg.fill();
        lg.fillStyle = 'rgba(255,255,255,.45)'; lg.beginPath(); lg.ellipse(x - s * 0.3, y - s * 0.3, s * 0.4, s * 0.25, 0, 0, TAU); lg.fill();
      }
      if (B.blades) for (let k = 0; k < pathPts.length * 2; k++) {
        const [px, py] = pathPts[Math.floor(R() * pathPts.length)], a = rr(0, TAU), x = px + Math.cos(a) * rr(40, 50), y = py + Math.sin(a) * rr(40, 50), h = rr(8, 14);
        lg.strokeStyle = k % 2 ? dark : B.base2; lg.lineWidth = 2.2;
        lg.beginPath(); for (const dx of [-4, 0, 4]) { lg.moveTo(x, y); lg.quadraticCurveTo(x + dx * 0.6, y - h * 0.5, x + dx, y - h); } lg.stroke();
      }
      continue;
    }
    if (sh.fill) {
      lg.globalAlpha = sh.alpha || 1; lg.fillStyle = sh.fill;
      if (sh.grow) { lg.strokeStyle = sh.fill; for (const f of [2, 1.4, 0.8]) { lg.lineWidth = sh.grow * f; lg.stroke(sh.p); } }
      lg.fill(sh.p); lg.globalAlpha = 1;
      if (sh.line) { lg.strokeStyle = sh.line; lg.lineWidth = sh.lw || 3; lg.stroke(sh.p); }
    }
    if (sh.waves) { lg.strokeStyle = 'rgba(255,255,255,.55)'; lg.lineWidth = 8; lg.setLineDash([34, 44]); lg.stroke(sh.p); lg.setLineDash([]); }
    if (sh.strokes) { lg.globalAlpha = sh.alpha || 1; for (const [col, w] of sh.strokes) { lg.strokeStyle = col; lg.lineWidth = w; lg.stroke(sh.p); } lg.globalAlpha = 1; }
    if(sh.glow&&TX){lg.save();lg.globalAlpha=.55;lg.strokeStyle=tile('lava','#ff791f',1);lg.lineWidth=42;lg.stroke(sh.p);lg.restore();}
  }
  bakeGroundDecor(lg, B, decor);
  if (water && TX) {
    // Reflets qui scintillent à la surface
    water.fill = ctx.createPattern(causticTile(), 'repeat'); water.glints = [];
    for (let k = 0; k < 400 && water.glints.length < 70; k++) { const x = rr(water.box[0], WORLD), y = rr(water.box[1], WORLD); if (lg.isPointInPath(water.shore, x, y)) water.glints.push([x, y, rr(0, TAU), rr(0.6, 1.3)]); }
  }
  biomeIdx = prevIdx; DSPR = prevD;
  return { B, layer, lava: lavaPaths, amb: [], tall: decor.filter(d => d.deco).sort((a, b) => a.y - b.y), water: TX ? water : null };
}

// ---------- Décor peint façon Dofus : chaque élément est peint une fois (dégradés, contours bruns, reflets) puis réutilisé ----------
const DPX = 1.75;            // pixels de sprite par unité du monde
let DSPR = {};               // sprites du décor de la zone en cours
const DOUT = '#3a2418';      // contour brun chaud, plus doux que le noir
// Les éléments hauts sont triés avec les personnages (on peut passer derrière un arbre) ; les petits sont peints dans le sol
const TALL = { tree: 1, palm: 1, deadtree: 1, bush: 1, boulder: 1, hay: 1, crystal: 1, mushroom: 1, reed: 1, coral: 1, lavarock: 1 };
function mixc(a, b, t) {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), m = (s) => Math.round((x >> s & 255) + ((y >> s & 255) - (x >> s & 255)) * t);
  return `rgb(${m(16)},${m(8)},${m(0)})`;
}
const hexOf = rgb => { const m = rgb.match(/\d+/g); return m ? '#' + m.slice(0, 3).map(v => (+v).toString(16).padStart(2, '0')).join('') : rgb; };
// Lumière chaude en haut à gauche, ombre froide en bas à droite
const lit = (c, k) => mixc(c, '#fff3c4', k);
const dim = (c, k) => mixc(c, '#2a1f4a', k);
function sprCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.ceil(w * DPX); c.height = Math.ceil(h * DPX); const g = c.getContext('2d'); g.scale(DPX, DPX); g.lineJoin = 'round'; g.lineCap = 'round'; return [c, g]; }
// Une touffe de feuillage : ombre, dégradé, petites feuilles en écailles, reflet
function clumps(g, list, col, R) {
  g.fillStyle = DOUT; for (const [x, y, r] of list) { g.beginPath(); g.arc(x, y, r + 2.6, 0, TAU); g.fill(); }
  for (const [x, y, r] of list) {
    const gr = g.createRadialGradient(x - r * 0.4, y - r * 0.5, r * 0.1, x, y, r * 1.1);
    gr.addColorStop(0, lit(col, 0.45)); gr.addColorStop(0.5, col); gr.addColorStop(1, dim(col, 0.45));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.strokeStyle = dim(col, 0.6); g.globalAlpha = 0.55; g.lineWidth = 1.6;
    g.beginPath(); g.arc(x, y, r - 0.5, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); g.globalAlpha = 1;
    // écailles de feuilles
    for (let k = 0; k < r * 0.9; k++) {
      const a = R() * TAU, d = R() * r * 0.8, lx = x + Math.cos(a) * d, ly = y + Math.sin(a) * d, up = ly < y - r * 0.1 && lx < x + r * 0.2;
      g.strokeStyle = up ? lit(col, 0.7) : dim(col, 0.35); g.globalAlpha = up ? 0.75 : 0.5; g.lineWidth = 1.3;
      g.beginPath(); g.arc(lx, ly, 2.6 + R() * 2, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    }
    g.globalAlpha = 1;
  }
  // brillance sur le haut
  const [x0, y0, r0] = list.reduce((a, b) => (b[1] - b[2] < a[1] - a[2] ? b : a));
  g.fillStyle = 'rgba(255,250,220,.35)'; g.beginPath(); g.ellipse(x0 - r0 * 0.3, y0 - r0 * 0.45, r0 * 0.38, r0 * 0.2, -0.5, 0, TAU); g.fill();
}
function trunkPath(g, bx, by, w, h, bend) {
  g.beginPath();
  g.moveTo(bx - w * 1.9, by + 2);
  g.quadraticCurveTo(bx - w * 1.0, by - 2, bx - w * 0.9, by - h * 0.25);
  g.quadraticCurveTo(bx - w * 0.8 + bend, by - h * 0.7, bx - w * 0.65 + bend * 1.5, by - h);
  g.lineTo(bx + w * 0.65 + bend * 1.5, by - h);
  g.quadraticCurveTo(bx + w * 0.8 + bend, by - h * 0.7, bx + w * 0.9, by - h * 0.25);
  g.quadraticCurveTo(bx + w * 1.0, by - 2, bx + w * 2.0, by + 2);
  g.quadraticCurveTo(bx + w * 0.7, by + 5, bx + w * 0.3, by + 1);
  g.quadraticCurveTo(bx, by + 6, bx - w * 0.5, by + 2);
  g.quadraticCurveTo(bx - w * 1.1, by + 5, bx - w * 1.9, by + 2);
  g.closePath();
}
function paintTrunk(g, bx, by, w, h, bend, col, R) {
  trunkPath(g, bx, by, w, h, bend);
  const gr = g.createLinearGradient(bx - w * 1.2, 0, bx + w * 1.2, 0);
  gr.addColorStop(0, dim(col, 0.35)); gr.addColorStop(0.35, lit(col, 0.3)); gr.addColorStop(0.65, col); gr.addColorStop(1, dim(col, 0.5));
  g.fillStyle = gr; g.fill(); g.strokeStyle = DOUT; g.lineWidth = 2.4; g.stroke();
  g.save(); trunkPath(g, bx, by, w, h, bend); g.clip();
  g.strokeStyle = dim(col, 0.55); g.lineWidth = 1.3; g.globalAlpha = 0.7;
  for (let k = 0; k < 5; k++) { const x = bx + (R() - 0.5) * w * 1.4, y = by - R() * h * 0.8; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (R() - 0.5) * 4, y - 8, x + (R() - 0.5) * 3, y - 14 - R() * 8); g.stroke(); }
  g.restore(); g.globalAlpha = 1;
}
// Arbre feuillu : tronc, branches, couronne de touffes ; variantes avec fleurs ou fruits
function makeTree(B, v) {
  const R = seeded(biomeIdx * 100 + v * 7 + 1), W = 170, H = 190, bx = W / 2, by = H - 8;
  const leaves = B.leaves.filter(c => c), col = leaves[v % leaves.length];
  const trunk = B.trunk || '#8a5a3a';
  const [tc, tg] = sprCanvas(W, H), [cc, cg] = sprCanvas(W, H);
  const cy = by - 100, bend = (R() - 0.5) * 8;
  paintTrunk(tg, bx, by, 9, 70, bend, trunk, R);
  // branches qui partent dans le feuillage
  tg.strokeStyle = DOUT; tg.lineWidth = 7; for (const s of [-1, 1]) { tg.beginPath(); tg.moveTo(bx + bend, by - 52); tg.quadraticCurveTo(bx + s * 16, by - 66, bx + s * 26, by - 84); tg.stroke(); }
  tg.strokeStyle = trunk; tg.lineWidth = 4; for (const s of [-1, 1]) { tg.beginPath(); tg.moveTo(bx + bend, by - 52); tg.quadraticCurveTo(bx + s * 16, by - 66, bx + s * 26, by - 84); tg.stroke(); }
  const list = [];
  const base = [[-34, 10, 27], [34, 10, 27], [0, 18, 30], [-44, -12, 22], [44, -12, 22], [-20, -20, 30], [22, -22, 30], [0, -44, 28], [-26, -46, 20], [26, -44, 20]];
  for (const [x, y, r] of base) list.push([bx + x + (R() - 0.5) * 6, cy + y + (R() - 0.5) * 6, r * (0.9 + R() * 0.2)]);
  list.sort((a, b) => a[1] - b[1]);   // le haut d'abord, le devant par-dessus
  clumps(cg, list, col, R);
  // fleurs ou fruits
  const deco = B.blossom && v % 3 === 1 ? 'flower' : v % 4 === 2 ? 'fruit' : null;
  if (deco) for (let k = 0; k < 16; k++) {
    const [x, y, r] = list[Math.floor(R() * list.length)], a = R() * TAU, d = R() * r * 0.7, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    if (deco === 'flower') { cg.fillStyle = '#fff4f8'; for (let i = 0; i < 5; i++) { const q = i / 5 * TAU; cg.beginPath(); cg.arc(px + Math.cos(q) * 2.4, py + Math.sin(q) * 2.4, 2.1, 0, TAU); cg.fill(); } cg.fillStyle = '#ffd23f'; cg.beginPath(); cg.arc(px, py, 1.4, 0, TAU); cg.fill(); }
    else { cg.fillStyle = DOUT; cg.beginPath(); cg.arc(px, py, 4.4, 0, TAU); cg.fill(); cg.fillStyle = B.fruit || '#ff5a4a'; cg.beginPath(); cg.arc(px, py, 3.4, 0, TAU); cg.fill(); cg.fillStyle = 'rgba(255,255,255,.7)'; cg.beginPath(); cg.arc(px - 1.2, py - 1.2, 1.1, 0, TAU); cg.fill(); }
  }
  return { trunk: tc, top: cc, w: W, h: H, ax: bx, ay: by, pivot: cy + 30, fade: [cy - 70, cy + 40, 70] };
}
function makePalm(B, v) {
  const R = seeded(biomeIdx * 100 + v * 13 + 5), W = 190, H = 200, bx = W / 2, by = H - 8, lean = (v % 2 ? 1 : -1) * (14 + R() * 12);
  const [tc, tg] = sprCanvas(W, H), [cc, cg] = sprCanvas(W, H);
  const tx = bx + lean, ty = by - 120;
  // tronc en anneaux
  for (let i = 0; i <= 12; i++) {
    const u = i / 12, x = bx + (tx - bx) * u * u, y = by - 120 * u, r = 9 - u * 3;
    const gr = tg.createLinearGradient(x - r, 0, x + r, 0); gr.addColorStop(0, '#7a5232'); gr.addColorStop(0.4, '#d9a86a'); gr.addColorStop(1, '#6a4428');
    tg.fillStyle = gr; tg.strokeStyle = DOUT; tg.lineWidth = 2;
    tg.beginPath(); tg.ellipse(x, y, r + 1.5, 6, 0, 0, TAU); tg.fill(); tg.stroke();
  }
  // noix de coco
  for (const [ox, oy] of [[-6, 4], [5, 5], [0, -1]]) { cg.fillStyle = DOUT; cg.beginPath(); cg.arc(tx + ox, ty + oy, 6.4, 0, TAU); cg.fill(); const gr = cg.createRadialGradient(tx + ox - 2, ty + oy - 2, 1, tx + ox, ty + oy, 6); gr.addColorStop(0, '#a87a4a'); gr.addColorStop(1, '#4a2e1a'); cg.fillStyle = gr; cg.beginPath(); cg.arc(tx + ox, ty + oy, 5, 0, TAU); cg.fill(); }
  // palmes : derrière d'abord, puis devant
  const fr = [];
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + R() * 0.3; fr.push([a, 62 + R() * 18]); }
  fr.sort((a, b) => Math.sin(a[0]) - Math.sin(b[0]));
  const col = '#6fcf4a';
  for (const [a, L] of fr) {
    const ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * 0.45 + 26, mx = tx + Math.cos(a) * L * 0.5, my = ty + Math.sin(a) * L * 0.25 - 16;
    const side = Math.sin(a) > 0 ? col : dim(col, 0.25);
    // contour de la palme
    const leaf = (w) => { cg.beginPath(); cg.moveTo(tx, ty); cg.quadraticCurveTo(mx - Math.sin(a) * w, my + Math.cos(a) * w * 0.5 - w * 0.4, ex, ey); cg.quadraticCurveTo(mx + Math.sin(a) * w, my - Math.cos(a) * w * 0.5 + w * 0.4, tx, ty); cg.closePath(); };
    leaf(14); const gr = cg.createLinearGradient(tx, ty - 20, ex, ey); gr.addColorStop(0, lit(side, 0.4)); gr.addColorStop(1, side); cg.fillStyle = gr; cg.fill();
    cg.strokeStyle = DOUT; cg.lineWidth = 1.8; cg.stroke();
    // nervure et découpes
    cg.strokeStyle = dim(side, 0.5); cg.lineWidth = 1.4; cg.beginPath(); cg.moveTo(tx, ty); cg.quadraticCurveTo(mx, my, ex, ey); cg.stroke();
    cg.strokeStyle = dim(side, 0.45); cg.lineWidth = 1.2;
    for (let k = 1; k < 8; k++) { const u = k / 8, px = (1 - u) * (1 - u) * tx + 2 * u * (1 - u) * mx + u * u * ex, py = (1 - u) * (1 - u) * ty + 2 * u * (1 - u) * my + u * u * ey; cg.beginPath(); cg.moveTo(px, py); cg.lineTo(px + Math.sin(a) * 9 * (1 - u), py - Math.cos(a) * 5 * (1 - u) + 4); cg.stroke(); }
  }
  return { trunk: tc, top: cc, w: W, h: H, ax: bx, ay: by, pivot: ty + 10, fade: [ty - 50, ty + 40, 80] };
}
function makeBush(B, v) {
  const R = seeded(biomeIdx * 100 + v * 17 + 3), W = 80, H = 60, bx = W / 2, by = H - 6;
  const leaves = B.bush || ['#4f9f42', '#5fae4a', '#6fae50'], col = leaves[v % leaves.length];
  const [c, g] = sprCanvas(W, H);
  const list = [[-18, -10, 13], [18, -10, 13], [0, -16, 16], [-8, -6, 13], [10, -5, 12]].map(([x, y, r]) => [bx + x + (R() - 0.5) * 4, by + y, r * (0.9 + R() * 0.2)]);
  list.sort((a, b) => a[1] - b[1]);
  clumps(g, list, col, R);
  if (v % 3 === 0) for (let k = 0; k < 7; k++) { const [x, y, r] = list[Math.floor(R() * list.length)], px = x + (R() - 0.5) * r, py = y + (R() - 0.5) * r; g.fillStyle = DOUT; g.beginPath(); g.arc(px, py, 3.2, 0, TAU); g.fill(); g.fillStyle = B.berry || '#ff4f6d'; g.beginPath(); g.arc(px, py, 2.4, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(px - 0.8, py - 0.8, 0.8, 0, TAU); g.fill(); }
  return { top: c, w: W, h: H, ax: bx, ay: by, pivot: by, sway: 0.5 };
}
function rockShape(R, n, rx, ry) { const pts = []; for (let i = 0; i < n; i++) { const a = Math.PI + i / (n - 1) * Math.PI, r = 0.8 + R() * 0.25; pts.push([Math.cos(a) * rx * r, Math.sin(a) * ry * r * (1.2 + R() * 0.3)]); } return pts; }
function makeRock(B, v, big, lava) {
  const R = seeded(biomeIdx * 100 + v * 23 + (big ? 9 : 2)), k = big ? 2.1 : 1, W = 60 * k, H = 52 * k, bx = W / 2, by = H - 8 * k;
  const col = lava ? '#4a3a42' : B.rock, [c, g] = sprCanvas(W, H);
  const pts = rockShape(R, 7, 24 * k, 22 * k);
  const path = () => { g.beginPath(); g.moveTo(bx - 25 * k, by); for (const [x, y] of pts) g.lineTo(bx + x, by + y); g.lineTo(bx + 25 * k, by); g.quadraticCurveTo(bx, by + 7 * k, bx - 25 * k, by); g.closePath(); };
  path(); const gr = g.createLinearGradient(bx - 20 * k, by - 30 * k, bx + 20 * k, by + 6 * k);
  gr.addColorStop(0, lit(col, 0.45)); gr.addColorStop(0.5, col); gr.addColorStop(1, dim(col, 0.5)); g.fillStyle = gr; g.fill();
  g.strokeStyle = DOUT; g.lineWidth = 2.4; g.stroke();
  g.save(); path(); g.clip();
  // facette du dessus, plus claire
  g.fillStyle = lit(col, 0.35); g.globalAlpha = 0.6; g.beginPath(); g.moveTo(bx - 18 * k, by - 12 * k); for (const [x, y] of pts.slice(1, -1)) g.lineTo(bx + x * 0.75, by + y * 0.85 - 2 * k); g.lineTo(bx + 14 * k, by - 10 * k); g.closePath(); g.fill(); g.globalAlpha = 1;
  g.strokeStyle = dim(col, 0.55); g.lineWidth = 1.5; g.beginPath(); g.moveTo(bx - 4 * k, by - 18 * k); g.lineTo(bx + 2 * k, by - 8 * k); g.lineTo(bx - 2 * k, by); g.stroke();
  // mousse
  if (B.blades && !lava) { g.fillStyle = '#6fae3a'; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(bx - 10 * k + i * 6 * k, by - 22 * k + Math.abs(i - 1.5) * 3 * k, 6 * k, 3 * k, 0, 0, TAU); g.fill(); } }
  g.restore();
  const res = { top: c, w: W, h: H, ax: bx, ay: by, pivot: by, sway: 0 };
  if (lava) {
    const [gc, gg] = sprCanvas(W, H);
    gg.strokeStyle = '#ffb02e'; gg.lineWidth = 2.6; gg.shadowColor = '#ff5a1f'; gg.shadowBlur = 8;
    gg.beginPath(); gg.moveTo(bx - 12, by - 16); gg.lineTo(bx - 3, by - 8); gg.lineTo(bx + 4, by - 14); gg.lineTo(bx + 12, by - 6); gg.moveTo(bx - 3, by - 8); gg.lineTo(bx - 5, by); gg.stroke();
    res.glow = gc;
  }
  return res;
}
function makeMushrooms(B, v) {
  const R = seeded(biomeIdx * 100 + v * 29 + 4), W = 70, H = 70, [c, g] = sprCanvas(W, H);
  const cap = v % 3 ? '#e8403a' : '#ff9f3a';
  const set = [[W / 2 + 10, H - 10, 0.75], [W / 2 - 8, H - 6, 1]].slice(v % 2);
  for (const [x, y, s] of set) {
    // pied
    g.fillStyle = DOUT; g.beginPath(); g.ellipse(x, y - 9 * s, 7 * s, 11 * s, 0, 0, TAU); g.fill();
    const sg = g.createLinearGradient(x - 6 * s, 0, x + 6 * s, 0); sg.addColorStop(0, '#d8c8a8'); sg.addColorStop(0.4, '#fff8e8'); sg.addColorStop(1, '#bfa888');
    g.fillStyle = sg; g.beginPath(); g.ellipse(x, y - 9 * s, 5.4 * s, 9.5 * s, 0, 0, TAU); g.fill();
    // chapeau
    const cy = y - 20 * s;
    g.fillStyle = DOUT; g.beginPath(); g.ellipse(x, cy, 21 * s, 17 * s, 0, Math.PI, 0); g.quadraticCurveTo(x, cy + 9 * s, x - 21 * s, cy); g.fill();
    const cg = g.createRadialGradient(x - 7 * s, cy - 9 * s, 1, x, cy, 20 * s); cg.addColorStop(0, lit(cap, 0.5)); cg.addColorStop(0.6, cap); cg.addColorStop(1, dim(cap, 0.45));
    g.fillStyle = cg; g.beginPath(); g.ellipse(x, cy, 18.5 * s, 14.5 * s, 0, Math.PI, 0); g.quadraticCurveTo(x, cy + 6.5 * s, x - 18.5 * s, cy); g.fill();
    g.fillStyle = '#fff8ec'; for (const [ox, oy, r] of [[-8, -6, 3.4], [4, -10, 2.8], [10, -3, 2.4], [-1, -2, 2]]) { g.beginPath(); g.ellipse(x + ox * s, cy + oy * s, r * s, r * 0.75 * s, 0, 0, TAU); g.fill(); }
  }
  return { top: c, w: W, h: H, ax: W / 2, ay: H - 6, pivot: H, sway: 0.3 };
}
function makeHay(B, v) {
  const W = 70, H = 60, bx = W / 2, by = H - 8, [c, g] = sprCanvas(W, H), R = seeded(v + 77);
  g.fillStyle = DOUT; g.beginPath(); g.ellipse(bx, by - 18, 29, 24, 0, 0, TAU); g.fill();
  const gr = g.createRadialGradient(bx - 9, by - 28, 2, bx, by - 18, 28); gr.addColorStop(0, '#fff0a0'); gr.addColorStop(0.55, '#e8c25a'); gr.addColorStop(1, '#a8802f');
  g.fillStyle = gr; g.beginPath(); g.ellipse(bx, by - 18, 26.5, 21.5, 0, 0, TAU); g.fill();
  g.strokeStyle = '#b8902f'; g.lineWidth = 1.5; for (let i = 0; i < 26; i++) { const a = R() * TAU, r = R() * 20; const x = bx + Math.cos(a) * r, y = by - 18 + Math.sin(a) * r * 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 5, y + (R() - 0.5) * 3); g.stroke(); }
  g.strokeStyle = '#8a5a2a'; g.lineWidth = 2.2; g.beginPath(); g.ellipse(bx, by - 18, 26.5, 7, 0, 0, Math.PI); g.stroke();
  return { top: c, w: W, h: H, ax: bx, ay: by, pivot: by, sway: 0 };
}
function makeDeadTree(B, v) {
  const R = seeded(v * 31 + 6), W = 120, H = 140, bx = W / 2, by = H - 8, [c, g] = sprCanvas(W, H);
  const branch = (x, y, a, l, w, d) => {
    const ex = x + Math.cos(a) * l, ey = y + Math.sin(a) * l, mx = (x + ex) / 2 + (R() - 0.5) * 10, my = (y + ey) / 2;
    for (const [col, lw] of [[DOUT, w + 3], ['#4a3434', w], ['#6a5050', w * 0.35]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(x - (col === '#6a5050' ? w * 0.2 : 0), y); g.quadraticCurveTo(mx, my, ex, ey); g.stroke(); }
    if (d > 0) for (const s of [-1, 1]) branch(ex, ey, a + s * (0.4 + R() * 0.3), l * 0.62, w * 0.62, d - 1);
  };
  branch(bx, by, -Math.PI / 2 + (R() - 0.5) * 0.3, 52, 11, 2);
  return { top: c, w: W, h: H, ax: bx, ay: by, pivot: by, sway: 0.15 };
}
function makeCrystals(B, v) {
  const R = seeded(v * 37 + 8), W = 70, H = 80, bx = W / 2, by = H - 8, [c, g] = sprCanvas(W, H);
  const col = ['#c9a0ff', '#8fd8ff', '#ff9fd0'][v % 3];
  for (const [ox, h, a] of [[-12, 30, -0.35], [12, 26, 0.3], [0, 44, 0.02], [-4, 20, -0.1]]) {
    g.save(); g.translate(bx + ox, by); g.rotate(a);
    const w = 7 + h * 0.08;
    g.fillStyle = DOUT; g.beginPath(); g.moveTo(-w - 2, 2); g.lineTo(-w - 2, -h * 0.7); g.lineTo(0, -h - 3); g.lineTo(w + 2, -h * 0.7); g.lineTo(w + 2, 2); g.closePath(); g.fill();
    g.fillStyle = lit(col, 0.35); g.beginPath(); g.moveTo(-w, 0); g.lineTo(-w, -h * 0.7); g.lineTo(0, -h); g.lineTo(0, 0); g.closePath(); g.fill();
    g.fillStyle = dim(col, 0.25); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -h); g.lineTo(w, -h * 0.7); g.lineTo(w, 0); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(-w * 0.6, -h * 0.65, 2, h * 0.5);
    g.restore();
  }
  return { top: c, w: W, h: H, ax: bx, ay: by, pivot: by, sway: 0, halo: col };
}
function makeReeds(B, v) {
  const R = seeded(v * 41 + 9), W = 60, H = 80, bx = W / 2, by = H - 6, [c, g] = sprCanvas(W, H);
  for (let i = 0; i < 7; i++) {
    const x = bx + (i - 3) * 4, h = 40 + R() * 25, bend = (R() - 0.5) * 18;
    g.strokeStyle = DOUT; g.lineWidth = 5; g.beginPath(); g.moveTo(x, by); g.quadraticCurveTo(x, by - h * 0.6, x + bend, by - h); g.stroke();
    g.strokeStyle = i % 2 ? '#5f9f6a' : '#7fbf7a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, by); g.quadraticCurveTo(x, by - h * 0.6, x + bend, by - h); g.stroke();
    if (i % 3 === 1) { g.fillStyle = DOUT; g.beginPath(); g.ellipse(x + bend * 0.8, by - h * 0.85, 4.6, 9.5, bend * 0.02, 0, TAU); g.fill(); g.fillStyle = '#8a5a3a'; g.beginPath(); g.ellipse(x + bend * 0.8, by - h * 0.85, 3.2, 8, bend * 0.02, 0, TAU); g.fill(); }
  }
  return { top: c, w: W, h: H, ax: bx, ay: by, pivot: by, sway: 1.2 };
}
function makeCoral(B, v) {
  const R = seeded(v * 43 + 11), W = 70, H = 60, bx = W / 2, by = H - 6, [c, g] = sprCanvas(W, H);
  const col = ['#ff7fa8', '#ff9f6a', '#c96ad9'][v % 3];
  const br = (x, y, a, l, w, d) => { const ex = x + Math.cos(a) * l, ey = y + Math.sin(a) * l; for (const [cl, lw] of [[DOUT, w + 3], [col, w], [lit(col, 0.4), w * 0.35]]) { g.strokeStyle = cl; g.lineWidth = lw; g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke(); } if (d) for (const s of [-1, 1]) br(ex, ey, a + s * 0.5, l * 0.7, w * 0.75, d - 1); else { g.fillStyle = lit(col, 0.5); g.beginPath(); g.arc(ex, ey, w * 0.6, 0, TAU); g.fill(); } };
  br(bx, by, -Math.PI / 2, 16, 7, 2);
  return { top: c, w: W, h: H, ax: bx, ay: by, pivot: by, sway: 0.8 };
}
function decorSprite(type, B, v) {
  const key = type + v;
  if (DSPR[key]) return DSPR[key];
  const f = { rock: (B, v) => makeRock(B, v), tree: makeTree, palm: makePalm, bush: makeBush, boulder: (B, v) => makeRock(B, v, true), lavarock: (B, v) => makeRock(B, v, false, true), mushroom: makeMushrooms, hay: makeHay, deadtree: (B, v) => deadTreeSprite(v) || makeDeadTree(B, v), crystal: makeCrystals, reed: makeReeds, coral: makeCoral }[type];
  return (DSPR[key] = f(B, v));
}
// ---------- Ambiance : nuages qui passent, petites bêtes et particules propres à chaque zone, lumière ----------
const AMB_KIND = ['butterfly', 'firefly', 'butterfly', 'ember', 'leaf', 'dust', 'sparkle'];
let cloudSpr = null, vignette = null;
function cloudSprite() {
  if (cloudSpr) return cloudSpr;
  const c = document.createElement('canvas'); c.width = 512; c.height = 300; const g = c.getContext('2d');
  for (const [x, y, r] of [[150, 160, 110], [260, 130, 130], [370, 165, 105], [220, 200, 90], [320, 205, 85]]) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(20,20,60,.5)'); gr.addColorStop(0.6, 'rgba(20,20,60,.35)'); gr.addColorStop(1, 'rgba(20,20,60,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 300);
  }
  return (cloudSpr = c);
}
function drawClouds(vx, vy, vw, vh, t) {
  if (biome.B.feature === 'lava') return;
  const c = cloudSprite();
  ctx.globalAlpha = 0.32;
  for (let i = 0; i < 6; i++) {
    const sx = 1.6 + (i % 3) * 0.5, x = ((i * 977 + t * 22) % (WORLD + 1400)) - 700, y = (i * 613) % WORLD + Math.sin(t * 0.05 + i) * 60;
    if (x + 512 * sx < vx || x > vx + vw || y + 300 * sx < vy || y > vy + vh) continue;
    ctx.drawImage(c, x, y, 512 * sx, 300 * sx);
  }
  ctx.globalAlpha = 1;
}
function updateAmbient(dt, vx, vy, vw, vh) {
  const A = biome.amb, kind = AMB_KIND[biomeIdx % AMB_KIND.length], want = kind === 'firefly' || kind === 'sparkle' ? 26 : kind === 'leaf' ? 22 : kind === 'ember' ? 34 : 14;
  for (let i = A.length - 1; i >= 0; i--) {
    const a = A[i]; a.t += dt; a.x += a.vx * dt; a.y += a.vy * dt;
    if (kind === 'butterfly') { a.vx += Math.sin(a.t * 1.7 + a.ph) * 40 * dt; a.vy += Math.cos(a.t * 1.3 + a.ph) * 40 * dt; a.vx *= 0.99; a.vy *= 0.99; }
    if (kind === 'leaf') a.vx = Math.sin(a.t * 1.5 + a.ph) * 30 + 10;
    if (a.t > a.life || a.x < vx - 200 || a.x > vx + vw + 200 || a.y < vy - 200 || a.y > vy + vh + 200) A.splice(i, 1);
  }
  while (A.length < want) {
    const a = { x: vx + Math.random() * vw, y: vy + Math.random() * vh, t: 0, ph: Math.random() * TAU, life: 6 + Math.random() * 8, c: Math.floor(Math.random() * 4), vx: 0, vy: 0 };
    if (kind === 'butterfly') { a.vx = (Math.random() - 0.5) * 60; a.vy = (Math.random() - 0.5) * 60; a.life = 20; }
    else if (kind === 'firefly') { a.vx = (Math.random() - 0.5) * 14; a.vy = -6 - Math.random() * 8; }
    else if (kind === 'ember') { a.vx = (Math.random() - 0.5) * 20; a.vy = -30 - Math.random() * 40; a.life = 3 + Math.random() * 3; }
    else if (kind === 'leaf') { a.y = vy - 40 + Math.random() * vh * 0.5; a.vy = 26 + Math.random() * 18; a.life = 12; }
    else if (kind === 'dust') { a.vx = 18 + Math.random() * 20; a.vy = (Math.random() - 0.5) * 8; }
    else { a.life = 1.5 + Math.random() * 2; }
    A.push(a);
  }
}
function drawAmbient() {
  const kind = AMB_KIND[biomeIdx % AMB_KIND.length];
  for (const a of biome.amb) {
    const fade = Math.min(1, a.t * 1.5, (a.life - a.t) * 1.5);
    if (fade <= 0) continue;
    ctx.globalAlpha = fade;
    if (kind === 'butterfly') {
      const flap = Math.abs(Math.sin(a.t * 14 + a.ph)), col = ['#ffd23f', '#ff8fc8', '#8fd8ff', '#ffffff'][a.c], ang = Math.atan2(a.vy, a.vx);
      ctx.save(); ctx.translate(a.x, a.y - 30 - Math.sin(a.t * 3) * 6); ctx.rotate(ang + Math.PI / 2);
      ctx.fillStyle = col; ctx.strokeStyle = DOUT; ctx.lineWidth = 1;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 5 * flap, -2, 5.5 * flap + 0.8, 4.5, s * 0.4, 0, TAU); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.ellipse(s * 3.5 * flap, 4, 3.5 * flap + 0.6, 3, -s * 0.4, 0, TAU); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = DOUT; ctx.fillRect(-1, -5, 2, 11);
      ctx.restore();
      ctx.globalAlpha = fade * 0.18; ctx.fillStyle = '#1e1432'; ctx.beginPath(); ctx.ellipse(a.x, a.y, 5 * flap + 1.5, 2.5, 0, 0, TAU); ctx.fill();
    } else if (kind === 'firefly' || kind === 'sparkle' || kind === 'ember') {
      const pulse = kind === 'firefly' ? 0.5 + Math.sin(a.t * 3 + a.ph) * 0.5 : kind === 'sparkle' ? Math.sin(a.t / a.life * Math.PI) : 1;
      const col = kind === 'ember' ? '255,140,40' : kind === 'firefly' ? '200,255,120' : '255,255,230', r = kind === 'ember' ? 3 : kind === 'firefly' ? 3.2 : 2.6;
      ctx.globalAlpha = Math.max(0, fade * pulse); ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, r * 5); gr.addColorStop(0, 'rgba(' + col + ',.9)'); gr.addColorStop(0.25, 'rgba(' + col + ',.35)'); gr.addColorStop(1, 'rgba(' + col + ',0)');
      ctx.fillStyle = gr; ctx.fillRect(a.x - r * 5, a.y - r * 5, r * 10, r * 10);
      ctx.globalCompositeOperation = 'source-over';
    } else if (kind === 'leaf') {
      ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.t * 2 + a.ph); ctx.scale(1, Math.sin(a.t * 3 + a.ph) || 0.01);
      ctx.fillStyle = ['#e8a03a', '#c9702a', '#d9b04a', '#6fae50'][a.c];
      ctx.beginPath(); ctx.moveTo(-7, 0); ctx.quadraticCurveTo(0, -5, 7, 0); ctx.quadraticCurveTo(0, 5, -7, 0); ctx.fill();
      ctx.restore();
    } else if (kind === 'dust') {
      ctx.globalAlpha = fade * 0.5; ctx.fillStyle = '#fff4dc'; ctx.beginPath(); ctx.arc(a.x, a.y, 2 + a.c * 0.5, 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
// Lumière chaude venant d'en haut à gauche et coins assombris (rouge et sombre dans l'antre du dragon)
function drawLight() {
  const key = W + 'x' + H + ':' + biomeIdx;
  if (!vignette || vignette.key !== key) {
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(W / 2)); c.height = Math.max(1, Math.round(H / 2));
    const g = c.getContext('2d'), w = c.width, h = c.height, lava = biome.B.feature === 'lava';
    const sun = g.createRadialGradient(w * 0.15, -h * 0.1, 0, w * 0.15, -h * 0.1, Math.max(w, h) * 0.9);
    sun.addColorStop(0, lava ? 'rgba(255,120,40,.10)' : 'rgba(255,240,190,.20)'); sun.addColorStop(1, 'rgba(255,240,190,0)');
    g.fillStyle = sun; g.fillRect(0, 0, w, h);
    const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.hypot(w, h) * 0.58);
    v.addColorStop(0, 'rgba(30,15,50,0)'); v.addColorStop(1, lava ? 'rgba(40,5,0,.55)' : 'rgba(30,15,50,.32)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
    vignette = { key, c };
  }
  ctx.drawImage(vignette.c, 0, 0, W, H);
}
// Tache douce (dégradé radial, sans filtre de flou : rapide même sur tablette)
function softBlob(g, x, y, rx, ry, rgbaHead, a) {
  g.save(); g.translate(x, y); g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx); gr.addColorStop(0, rgbaHead + a + ')'); gr.addColorStop(0.6, rgbaHead + (a * 0.75) + ')'); gr.addColorStop(1, rgbaHead + '0)');
  g.fillStyle = gr; g.fillRect(-rx, -rx, rx * 2, rx * 2); g.restore();
}
// Petits éléments peints directement dans le sol (fleurs, feuilles mortes, cailloux, coquillages) + ombres des grands
function bakeGroundDecor(lg, B, decor) {
  for (const d of decor) {
    const x = d.x, y = d.y, s = d.s, R = seeded(Math.floor(x * 7 + y));
    if (TALL[d.type]) {
      const r = { tree: 58, palm: 40, bush: 30, boulder: 46, hay: 30, deadtree: 30, crystal: 26, mushroom: 22, reed: 18, coral: 0, lavarock: 24 }[d.type] * s;
      if (!r) continue;
      softBlob(lg, x + r * 0.25, y + 2, r * 1.15, r * 0.48, 'rgba(30,20,50,', 0.32);
      continue;
    }
    if (d.type === 'flowers') {
      for (let i = 0; i < 6; i++) {
        const px = x + (R() - 0.5) * 30 * s, py = y + (R() - 0.5) * 22 * s, col = B.flowers[(d.c + i) % B.flowers.length];
        lg.strokeStyle = '#3f7a2a'; lg.lineWidth = 1.6; lg.beginPath(); lg.moveTo(px, py + 9); lg.quadraticCurveTo(px - 1, py + 4, px, py); lg.stroke();
        lg.fillStyle = '#4f9a32'; lg.beginPath(); lg.ellipse(px + 3, py + 6, 3.4, 1.6, -0.5, 0, TAU); lg.fill();
        lg.fillStyle = DOUT; lg.beginPath(); lg.arc(px, py, 5.4, 0, TAU); lg.fill();
        for (let k = 0; k < 5; k++) { const a = k / 5 * TAU + d.r; lg.fillStyle = col; lg.beginPath(); lg.arc(px + Math.cos(a) * 2.6, py + Math.sin(a) * 2.6, 2.5, 0, TAU); lg.fill(); }
        lg.fillStyle = '#ffd23f'; lg.beginPath(); lg.arc(px, py, 1.5, 0, TAU); lg.fill();
      }
    } else if (d.type === 'leaf') {
      const col = ['#e8a03a', '#c9702a', '#d9b04a', '#b8582a'][d.c % 4];
      lg.save(); lg.translate(x, y); lg.rotate(d.r);
      lg.fillStyle = 'rgba(40,25,10,.25)'; lg.beginPath(); lg.ellipse(1.5, 2, 8, 4, 0, 0, TAU); lg.fill();
      lg.fillStyle = col; lg.beginPath(); lg.moveTo(-8, 0); lg.quadraticCurveTo(0, -6, 8, 0); lg.quadraticCurveTo(0, 6, -8, 0); lg.fill();
      lg.strokeStyle = dim(col, 0.4); lg.lineWidth = 1; lg.beginPath(); lg.moveTo(-8, 0); lg.lineTo(8, 0); lg.stroke();
      lg.restore();
    } else if (d.type === 'rock') {
      const sp = decorSprite('rock', B, d.c % 4);
      lg.fillStyle = 'rgba(30,20,50,.25)'; lg.beginPath(); lg.ellipse(x + 4, y + 2, 24 * s, 8 * s, 0, 0, TAU); lg.fill();
      lg.drawImage(sp.top, x - sp.ax * s, y - sp.ay * s, sp.w * s, sp.h * s);
    } else if (d.type === 'shell') {
      const col = ['#ffd0e4', '#fff3dc', '#ffc4a0'][d.c % 3];
      lg.save(); lg.translate(x, y); lg.rotate(d.r * 0.3); lg.scale(s, s);
      lg.fillStyle = DOUT; lg.beginPath(); lg.arc(0, 0, 8.5, Math.PI, 0); lg.quadraticCurveTo(0, 5, -8.5, 0); lg.fill();
      const gr = lg.createRadialGradient(-2, -4, 1, 0, 0, 8); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, col);
      lg.fillStyle = gr; lg.beginPath(); lg.arc(0, 0, 7, Math.PI, 0); lg.quadraticCurveTo(0, 4, -7, 0); lg.fill();
      lg.strokeStyle = dim(col, 0.35); lg.lineWidth = 1; for (const a of [-0.9, -0.45, 0, 0.45, 0.9]) { lg.beginPath(); lg.moveTo(0, 2); lg.lineTo(Math.sin(a) * 6.5, -Math.cos(a) * 6.5 + 1); lg.stroke(); }
      lg.restore();
    }
  }
}
// Dessin d'un grand élément (appelé dans l'ordre de profondeur, avec les personnages)
function drawTall(d, B, t, fadeTo) {
  const sp = decorSprite(d.type, B, d.c % 4), s = d.s, x = d.x, y = d.y;
  const L = x - sp.ax * s, T = y - sp.ay * s, w = sp.w * s, h = sp.h * s;
  if (sp.trunk) ctx.drawImage(sp.trunk, L, T, w, h);
  if (fadeTo < 1) ctx.globalAlpha = fadeTo;
  const sw = (sp.sway === undefined ? 1 : sp.sway) * Math.sin(t * 1.3 + d.r * 3 + x * 0.002) * 0.035;
  if (sw) {
    const py = T + sp.pivot * s;
    ctx.save(); ctx.translate(x, py); ctx.transform(1, 0, sw, 1, 0, 0); ctx.translate(-x, -py);
    ctx.drawImage(sp.top, L, T, w, h); ctx.restore();
  } else ctx.drawImage(sp.top, L, T, w, h);
  if (sp.glow) { ctx.globalAlpha = (0.55 + Math.sin(t * 3 + d.r) * 0.45) * fadeTo; ctx.drawImage(sp.glow, L, T, w, h); }
  if (sp.halo) {
    ctx.globalAlpha = (0.25 + Math.sin(t * 2 + d.r) * 0.12) * fadeTo; ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createRadialGradient(x, y - 25 * s, 2, x, y - 25 * s, 45 * s); gr.addColorStop(0, sp.halo); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(x - 45 * s, y - 70 * s, 90 * s, 90 * s); ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
}

// ---------- Audio ----------
let actx = null;
const lastSfx = {};
function sfx(kind) {
  if (!save.sound) return;
  try {
    if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; actx = new AC(); }
    if (actx.state === 'suspended') actx.resume();
    const now = actx.currentTime;
    const P = {
      shoot: [880, 440, 0.05, 0.02, 'square', 0.08],
      hit:   [240, 110, 0.06, 0.035, 'triangle', 0.05],
      boom:  [170, 40, 0.35, 0.16, 'sawtooth', 0.1],
      hurt:  [210, 80, 0.2, 0.12, 'sawtooth', 0.1],
      pick:  [900, 1300, 0.05, 0.025, 'sine', 0.04],
      coin:  [1200, 1800, 0.09, 0.05, 'square', 0.05],
      level: [520, 1040, 0.3, 0.08, 'triangle', 0.1],
      ult:   [300, 900, 0.4, 0.1, 'sawtooth', 0.2],
    }[kind];
    if (!P) return;
    if (lastSfx[kind] && now - lastSfx[kind] < P[5]) return;
    lastSfx[kind] = now;
    const o = actx.createOscillator(), g = actx.createGain();
    o.connect(g); g.connect(actx.destination);
    o.type = P[4];
    o.frequency.setValueAtTime(P[0], now);
    o.frequency.exponentialRampToValueAtTime(P[1], now + P[2]);
    g.gain.setValueAtTime(P[3], now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + P[2]);
    o.start(now); o.stop(now + P[2] + 0.02);
  } catch (e) {}
}

// ---------- État ----------
let state = 'village';
let G = null;
const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0, dx: 0, dy: 0 };
const keys = {};
// Co-op uses host-authoritative simulation. Guests only send bounded controls.
const coop = { mode:'bastion', active:false, input:{mx:0,my:0}, inputAt:0, elapsed:0, run:0, ended:false, acting:false };
const guestMotion = new CoopMotion();
const networkIds = new WeakMap(); let nextNetworkId=1;
let deviceId;try{deviceId=localStorage.getItem('bastion-device');if(!deviceId){deviceId=crypto.randomUUID();localStorage.setItem('bastion-device',deviceId);}}catch(e){deviceId=crypto.randomUUID();}
const incomingLimits=new JoinLimits(localStorage,'bastion-incoming'),outgoingLimits=new JoinLimits(localStorage,'bastion-outgoing');
let socialDecision=null,friendRequested=false,friendReceived=false;
function friendBook(){return new FriendBook(localStorage,'bastion-friends-'+SLOT);}
function localProfile(){const alias=(save.friendAlias||heroName(save)).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]/g,'').toUpperCase().slice(0,24);return {id:deviceId+'-'+SLOT,name:heroName(save),code:alias.length>=3?'#'+alias:''};}
function hideSocial(){socialDecision=null;$('socialPrompt').hidden=true;}
function askSocial(text,decide){socialDecision=decide;$('socialPromptText').textContent=text;$('socialPrompt').hidden=false;}
$('socialYes').onclick=()=>{const f=socialDecision;hideSocial();f?.(true);};
$('socialNo').onclick=()=>{const f=socialDecision;hideSocial();f?.(false);};
function renderFriends(){const box=$('friendsList');box.replaceChildren();for(const p of friendBook().read()){const row=document.createElement('div'),name=document.createElement('b'),code=document.createElement('small'),btns=document.createElement('div'),join=document.createElement('button'),remove=document.createElement('button');row.className='friend-row';btns.className='row-btns';name.textContent=p.name;code.textContent=p.code;join.className='btn';remove.className='btn alt';join.textContent='Rejoindre';remove.textContent='Retirer';join.onclick=()=>{$('coopCode').value=p.code;openCoop('guest');};remove.onclick=()=>{friendBook().remove(p.id);renderFriends();};btns.append(join,remove);row.append(name,code,btns);box.append(row);}if(!box.children.length)box.textContent='Aucun ami ajouté pour l’instant.';}
function receiveFriend(msg){
 if(msg.type==='friendRequest'){if(friendReceived)return true;friendReceived=true;askSocial(session.remoteProfile.name+' souhaite t’ajouter à ses amis.',yes=>{if(yes){friendBook().add(session.remoteProfile);renderFriends();}session.send({type:'friendAnswer',accepted:yes});});return true;}
 if(msg.type==='friendAnswer'){if(friendRequested){friendRequested=false;if(msg.accepted===true){friendBook().add(session.remoteProfile);renderFriends();}$('friendAddStatus').textContent=msg.accepted===true?'Ami ajouté.':'Invitation refusée.';}return true;}return false;
}
const session = new BastionSession(window.Peer, {
  profile:localProfile,
  joinRequest:(profile,decide)=>{const limit=incomingLimits.take(profile.id);if(!limit.ok){decide(false);return;}askSocial(profile.name+' souhaite rejoindre ta partie. Accepter ? (45 secondes)',decide);},
  joinClosed:hideSocial,
  status: message => { $('coopStatus').textContent = message; },
  ready: () => { friendRequested=friendReceived=false;$('friendAdd').disabled=false;$('friendAddStatus').textContent=''; comms.attach(); $('friendBar').hidden=false; $('friendLog').replaceChildren(); $('friendUnread').textContent=''; if(coop.mode==='village'&&session.role==='host')sendVillageWelcome(); $('coopStart').hidden = session.role !== 'host'; if(session.role==='host')session.send({type:'lobby',mode:coop.mode}); },
  closed: message => {
    const playing = coop.active;
    stopCoop();
    if (playing) { toVillage(); openModal('portalM'); $('coopPanel').open = true; banner('Partie interrompue', message); }
    $('coopStatus').textContent = message;
  },
  message: receiveCoop,
});
function localInput() {
  const fp = fpOn();
  let mx = joy.dx, my = joy.dy;
  // en 1re personne, les flèches gauche/droite tournent la tête (Q/A et D : pas de côté)
  if ((!fp && keys.ArrowLeft) || keys.KeyA || keys.KeyQ) mx--;
  if ((!fp && keys.ArrowRight) || keys.KeyD) mx++;
  if (keys.ArrowUp || keys.KeyW || keys.KeyZ) my--;
  if (keys.ArrowDown || keys.KeyS) my++;
  const length = Math.max(1, Math.hypot(mx, my));
  mx /= length; my /= length;
  // en 1re personne : « haut » = avancer dans la direction du regard
  if (fp) { const c = Math.cos(FP.yaw), s = Math.sin(FP.yaw), f = -my, r = mx; return { mx: c * f - s * r, my: s * f + c * r }; }
  return { mx, my };
}
function teamHeroes() { return G.ally ? [G.p, G.ally] : [G.p]; }
function closestHero(x, y) { return G.ally && d2(x,y,G.ally.x,G.ally.y) < d2(x,y,G.p.x,G.p.y) ? G.ally : G.p; }
function withAlly(fn) {
  const host = G.p, ally = G.ally;
  // Reuse weapons and cooldown rules without updating enemies a second time.
  ally.hp = host.hp; G.p = ally; coop.acting = true;
  try { fn(); } finally { host.hp = ally.hp; G.p = host; coop.acting = false; }
}
function coopAction(action) {
  if (!coop.active || session.role !== 'guest' || coop.acting) return false;
  if (state === 'play') session.send({type:'action', action, run:coop.run});
  return true;
}
function stopCoop() {
  guestMotion.reset(); comms.stop(); leaveVisit(); $('friendBar').hidden=true; coop.lu=null;
  $('wolfDuoGame').hidden=true; wolfDuoEngine=null; wolfDuoView=null; wolfRewarded=false;
  coop.active = false; refreshSpeedBtn(); coop.shownState=null; coop.ended = false; coop.input = {mx:0,my:0}; coop.elapsed = 0;
  session.close();
  $('coopStart').hidden = $('coopCancel').hidden = true;
  $('coopHost').disabled = $('coopJoin').disabled = false;
  $('coopNotice').hidden = true;
  $('againBtn').hidden = false;
  $('coopStatus').textContent = 'Crée une partie ou saisis le code de ton ami.';
}
function openCoop(role) {
  stopCoop();
  const bytes = new Uint8Array(8); crypto.getRandomValues(bytes);
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const alias=$('coopAlias').value.trim().replace(/^#/, '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  const code = role==='host' ? (alias?'#'+alias:Array.from(bytes,n=>alphabet[n%alphabet.length]).join('')) : $('coopCode').value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  if(!/^(?:[A-Z0-9]{8}|#[A-Z0-9_-]{3,24})$/.test(code)){ $('coopStatus').textContent='Identifiant : 3 à 24 lettres, chiffres, tirets ou _. Sinon utilise un code de 8 caractères.';return; }
  if(role==='guest'){const limit=outgoingLimits.take(code);if(!limit.ok){$('coopStatus').textContent='3 demandes maximum en 10 minutes, espacées de 10 secondes. Réessaie dans '+limit.wait+' secondes.';return;}}
  if(role==='host'){save.friendAlias=alias;persist();if(alias)coop.mode='village';}
  $('coopHost').disabled = $('coopJoin').disabled = true; $('coopCancel').hidden = false;
  session.open(role, code);
}
function coopSnapshot() {
  const entity=q=>{if(!networkIds.has(q))networkIds.set(q,nextNetworkId++);return {...q,netId:networkIds.get(q)};};
  // Limit purely cosmetic traffic and round coordinates without changing host physics.
  return JSON.parse(JSON.stringify({...G, zombies:G.zombies.map(entity),bullets:G.bullets.map(entity),ebullets:G.ebullets.map(entity),parts:G.parts.slice(-30),texts:G.texts.slice(-12)},
    (key,value)=>key==='hits'||key==='picks'||key==='droneT'||key==='allyChoices'||key==='allyPicks'?undefined:typeof value==='number'&&Number.isFinite(value)?Math.round(value*100)/100:value));
}
function sendCoopState(type = 'state') {
  session.send({type, run:coop.run, game:coopSnapshot(), zone:biomeKey, state}, type === 'state');
}
function beginCoop() {
  if (!session.ready || session.role !== 'host' || coop.active) return;
  coop.mode='bastion'; leaveVisit(); coop.active = true; refreshSpeedBtn();
  newRun(); G.duo = true; G.lives = {easy:3,normal:2,hard:1}[save.diff || 'normal']; G.runDiff = save.diff || 'normal'; G.coopClass = save.cls;
  G.ally = {...G.p, x:G.p.x + 60};
  coop.active = true; coop.ended = false; coop.run++; coop.inputAt = 0;
  $('coopM').hidden = true;
  state = 'play'; resetJoy(); showOnly('play');
  $('ultLabel').textContent = CLASSES[G.coopClass].ult;
  $('againBtn').hidden = true;
  session.send({type:'start', run:coop.run, game:coopSnapshot(), zone:biomeKey});
}
function validSnapshot(msg) {
  const g = msg.game;
  return g && Number.isFinite(g.p?.x) && Number.isFinite(g.p?.hp) && Number.isFinite(g.ally?.x)
    && ['zombies','bullets','ebullets','pickups','parts','texts','grenades','turrets','blasts'].every(k => Array.isArray(g[k]) && g[k].length < 10000)
    && Number.isInteger(msg.zone) && msg.zone >= 0 && msg.zone < 100000
    && DIFFS[g.runDiff] && CLASSES[g.coopClass];
}
function receiveCoop(msg) {
  if(receiveFriend(msg))return;
  if(comms.receive(msg)||receiveVillage(msg))return;
  if(msg.type==='lobby' && session.role==='guest' && !coop.active){coop.mode=['wolf','village'].includes(msg.mode)?msg.mode:'bastion';$('coopTitle').textContent=coop.mode==='wolf'?'Loup-Garou à deux':'Le Bastion à deux';return;}
  if(msg.type==='wolfView'||msg.type==='wolfAction'){receiveWolfDuo(msg);return;}
  if (session.role === 'host') {
    if (!coop.active || coop.ended) return;
    if (msg.type === 'pause') { pauseGame(); return; }
    if (msg.type === 'pick' && msg.run === coop.run && state === 'levelup' && G.allyChoices && !G.luAllyDone && Number.isInteger(msg.i) && G.allyChoices[msg.i]) {
      const u = G.allyChoices[msg.i]; u.apply(G.ally); G.allyPicks[u.id] = (G.allyPicks[u.id] || 0) + 1; G.luAllyDone = true;
      if (G.luHostDone) finishLevelUp();
      return;
    }
    if (msg.run !== coop.run || state !== 'play') return;
    if (msg.type === 'input' && Number.isFinite(msg.mx) && Number.isFinite(msg.my)) {
      const length = Math.max(1, Math.hypot(msg.mx, msg.my));
      coop.input = {mx:msg.mx/length, my:msg.my/length}; coop.inputAt = Date.now();
    } else if (msg.type === 'action') {
      const action = {dash:doDash, grenade:doGrenade, ult:doUlt}[msg.action];
      if (Object.hasOwn({dash:1,grenade:1,ult:1}, msg.action) && action) withAlly(action);
    }
    return;
  }
  if (msg.type === 'levelup' && coop.active && msg.run === coop.run && Array.isArray(msg.cards) && msg.cards.length < 8) {
    const cards = msg.cards.filter(c => c && RAR[c.rar]).map(c => ({ rar: c.rar, cls: RAR[c.rar].cls, name: String(c.name).slice(0, 60), desc: String(c.desc).slice(0, 200), lv: String(c.lv).slice(0, 80) }));
    coop.lu = { cards, picked: false }; showLuCards(String(msg.title || 'Amélioration').slice(0, 40), cards); showOnly('levelup'); $('coopNotice').hidden = true; resetJoy(); sfx('level');
    return;
  }
  if (!['start','state','end'].includes(msg.type) || !validSnapshot(msg)) return;
  if (msg.type === 'start') {
    if (coop.active || !Number.isInteger(msg.run)) return;
    leaveVisit();coop.mode='bastion';coop.run = msg.run; coop.active = true; coop.ended = false; $('coopM').hidden=true;
  } else if (!coop.active || coop.ended || msg.run !== coop.run) return;
  G = guestMotion.accept(msg.game); if(msg.type==='start')refreshSpeedBtn();
  if (String(biomeKey) !== String(msg.zone) || !biome) setBiome(msg.zone);
  $('ultLabel').textContent = CLASSES[G.coopClass].ult;
  $('againBtn').hidden = true;
  if (msg.type === 'end') { coop.ended = true; gameOver(); $('coopNotice').hidden = true; return; }
  const waiting = msg.state === 'pause' || msg.state === 'levelup';
  state = waiting ? 'coopwait' : 'play';
  // pendant le choix des améliorations, le coéquipier garde ses cartes à l'écran
  const myCards = msg.state === 'levelup' && coop.lu;
  if (!myCards) coop.lu = null;
  if(!myCards&&(msg.type==='start'||coop.shownState!==state)){showOnly('play');coop.shownState=state;}
  if(myCards)coop.shownState='levelup';
  $('coopNotice').hidden = !waiting || !!myCards;
  if($('coopNotice').dataset.phase!==msg.state){
    $('coopNotice').dataset.phase=msg.state;
    $('coopNotice').replaceChildren(document.createTextNode(msg.state==='levelup'?'Ton ami choisit une amélioration… ':'Partie en pause. Ton ami peut la reprendre. '));
    const leave=document.createElement('button');leave.className='btn alt';leave.textContent='Quitter';leave.onclick=toVillage;$('coopNotice').appendChild(leave);
  }
  if (waiting) resetJoy();
  updateHud();
}
function coopTick(dt) {
  if (!coop.active || coop.mode==='wolf' || !session.ready || coop.ended || state === 'over') return;
  coop.elapsed += dt;
  if (coop.elapsed < 0.1) return;
  coop.elapsed = 0;
  if (session.role === 'host') sendCoopState();
  else session.send({type:'input', run:coop.run, ...(state === 'play' ? localInput() : {mx:0,my:0})}, true);
}
const comms=new CoopComms(session,{
  localName:()=>heroName(save),remoteName:()=>session.remoteProfile?.name||'Ami',
  line:(who,text)=>{const p=document.createElement('p');p.textContent=who+' : '+text;$('friendLog').appendChild(p);while($('friendLog').children.length>50)$('friendLog').firstChild.remove();$('friendLog').scrollTop=$('friendLog').scrollHeight;if(!$('friendChat').open)$('friendUnread').textContent='•';},
  status:text=>$('friendVoice').textContent=text,
  enabled:on=>$('friendMic').textContent=on?'Couper mon micro':'Activer mon micro',
  audio:stream=>{const audio=$('friendAudio');audio.srcObject=stream;if(stream)audio.play().catch(()=>$('friendVoice').textContent='Touche le chat pour écouter le vocal.');}
});
$('friendForm').addEventListener('submit',e=>{e.preventDefault();if(comms.send($('friendText').value))$('friendText').value='';});
$('friendText').addEventListener('focus',()=>{resetJoy();resetVjoy();for(const key in keys)delete keys[key];});
$('friendChat').addEventListener('toggle',()=>{if($('friendChat').open){$('friendUnread').textContent='';if($('friendAudio').srcObject)$('friendAudio').play().catch(()=>{});}});
$('friendAdd').onclick=()=>{if(!session.ready)return;if(!session.remoteProfile?.code||!localProfile().code){$('friendAddStatus').textContent='Choisissez chacun un identifiant de 3 caractères minimum avant de vous connecter.';return;}friendRequested=true;$('friendAdd').disabled=true;session.send({type:'friendRequest'});$('friendAddStatus').textContent='Invitation envoyée.';};
$('friendMic').onclick=()=>comms.stream||comms.requesting?comms.disable():comms.enable();
$('friendLeave').onclick=toVillage;
$('friendBastion').onclick=beginCoop;
$('friendWolf').onclick=beginWolfDuo;
document.addEventListener('visibilitychange',()=>{if(document.hidden)comms.disable();});
document.addEventListener('bastion-background',()=>comms.disable());
const villageFriend={avatar:null,pose:null,elapsed:0,refresh:0};
function enterSharedVillage(){
  if(!session.ready)return;
  state='village';showOnly('village');$('coopM').hidden=true;$('portalM').hidden=true;
  $('friendLaunch').hidden=session.role!=='host';
  $('friendPlace').textContent=session.role==='host'?'Ton ami visite ton village. Toi seul peux le modifier et lancer un jeu.':'Village de ton ami · visite sans modification';
  if(V.ok){resetVjoy();V.P.x=2;V.P.z=-11;V.inside=false;placeHeroCam(true);}
}
function sendVillageWelcome(){
  if(session.role!=='host'||!session.ready)return;
  session.send({type:'village',b:{...save.b},home:{...save.home},night:!!save.night});
  enterSharedVillage();
}
function rebuildVisitedVillage(){
  if(!V.ok)return;
  for(const id of Object.keys(POS))buildBuilding(id);
  buildHomeShell();for(const [slot] of DECO_SLOTS)if(slot!=='walls')buildHomeFurniture(slot);
  applyNight();lightenVillage();renderPanel();updateVhud();
}
function leaveVisit(){
  const had=visitingVillage;visitingVillage=null;villageFriend.pose=null;
  if(villageFriend.avatar){villageFriend.avatar.parent?.remove(villageFriend.avatar);villageFriend.avatar=null;}
  if(had){if(V.ok&&V.inside)exitHome();rebuildVisitedVillage();}
  $('friendLaunch').hidden=true;
}
function receiveVillage(msg){
  if(msg.type==='village'){
    if(session.role!=='guest'||coop.active||!msg.b||!msg.home)return true;
    const view={b:{},home:{},night:msg.night===true};
    for(const id of Object.keys(BUILD)){const level=msg.b[id];view.b[id]=Number.isInteger(level)?clamp(level,1,BUILD[id].max):1;}
    for(const [slot] of DECO_SLOTS)if(Object.hasOwn(DECO_STYLES,msg.home[slot]))view.home[slot]=msg.home[slot];
    const first=!visitingVillage,changed=JSON.stringify(view)!==JSON.stringify(visitingVillage);
    visitingVillage=view;coop.mode='village';if(first)enterSharedVillage();if(changed)rebuildVisitedVillage();
    return true;
  }
  if(msg.type==='presence'){
    if(coop.mode!=='village'||coop.active||!Number.isFinite(msg.x)||!Number.isFinite(msg.z)||!Number.isFinite(msg.rot))return true;
    villageFriend.pose={x:clamp(msg.x,-250,250),z:clamp(msg.z,-250,250),rot:msg.rot,inside:msg.inside===true,moving:msg.moving===true,tribe:TRIBES[msg.tribe]?msg.tribe:null,appearance:CharacterModels.clean(msg.appearance),hairColor:typeof msg.hairColor==='string'&&/^#[0-9a-f]{6}$/i.test(msg.hairColor)?msg.hairColor:'#5a3a26'};
    return true;
  }
  return false;
}
function friendWarrior(tribe){
  if(!TRIBES[tribe]||!MODELS[TRIBES[tribe].model])return null;
  const was=save.tribe,off=gearOff;save.tribe=tribe;gearOff=true;
  try{return buildWarrior3D(CLASSES[save.cls].color);}catch(e){return null;}finally{save.tribe=was;gearOff=off;}
}
function villageNetworkTick(dt){
  if(!session.ready||coop.mode!=='village'||coop.active||state!=='village')return;
  villageFriend.elapsed+=dt;villageFriend.refresh+=dt;
  if(villageFriend.elapsed>=.1){villageFriend.elapsed=0;if(V.ok)session.send({type:'presence',tribe:tribeId(),appearance:CharacterModels.clean(save.appearance),hairColor:heroColors().hair,x:V.P.x,z:V.P.z,rot:V.P.rot,inside:V.inside===true,moving:Math.hypot(vjoy.dx,vjoy.dy)>0||Object.values(keys).some(Boolean)},true);}
  if(villageFriend.refresh>=3){villageFriend.refresh=0;if(session.role==='host')session.send({type:'village',b:{...save.b},home:{...save.home},night:!!save.night});}
  if(V.ok&&villageFriend.pose){
    const appearanceKey=String(villageFriend.pose.tribe);if(villageFriend.avatar&&villageFriend.avatar.userData.appearanceKey!==appearanceKey){V.scene.remove(villageFriend.avatar);villageFriend.avatar=null;}
    // l'ami apparaît avec le guerrier de sa tribu (plus d'humains au village)
    if(!villageFriend.avatar){villageFriend.avatar=friendWarrior(villageFriend.pose.tribe)||buildHero3D('recrue','#3db8ff');addFootShadow(villageFriend.avatar,0.6);villageGunPose(villageFriend.avatar);
      // son pseudo, en petit au-dessus de sa tête (lui voit le nôtre de la même façon)
      const tag=wLabel(String(session.remoteProfile?.name||'Ami').slice(0,16));tag.scale.set(1.25,0.375,1);tag.position.y=3.05;villageFriend.avatar.add(tag);
      villageFriend.avatar.userData.appearanceKey=appearanceKey;V.scene.add(villageFriend.avatar);villageFriend.avatar.position.set(villageFriend.pose.x,0,villageFriend.pose.z);}
    const a=villageFriend.avatar,p=villageFriend.pose,k=1-Math.exp(-dt*15);
    a.visible=(V.inside===true)===p.inside;a.position.x+=(p.x-a.position.x)*k;a.position.z+=(p.z-a.position.z)*k;a.rotation.y=p.rot;animHero(a,V.time*11,p.moving,dt);
  }
}
$('vFriends').onclick=()=>{
  if(session.ready){$('friendChat').open=true;return;}
  showCoopLobby('village');$('coopTitle').textContent='Inviter un ami au village';
  $('coopRules').textContent='Choisis ton #identifiant puis crée la session. Ton ami le saisit pour visiter ton village. Visite en lecture seule, deux joueurs maximum. Garde le jeu ouvert.';
};
$('coopHost').addEventListener('click', () => openCoop('host'));
$('coopJoin').addEventListener('click', () => openCoop('guest'));
$('coopCancel').addEventListener('click', stopCoop);
$('coopStart').addEventListener('click', () => coop.mode === 'village' ? enterSharedVillage() : coop.mode === 'wolf' ? beginWolfDuo() : beginCoop());
$('bastionDuo').addEventListener('click', () => showCoopLobby('bastion'));
$('wolfDuo').addEventListener('click', () => showCoopLobby('wolf'));
$('coopBack').addEventListener('click', () => { stopCoop(); $('coopM').hidden=true; state='village'; showOnly('village'); });
function showCoopLobby(mode) {
  renderFriends();
  if(session.ready&&coop.mode==='village'){if(session.role==='host'){if(mode==='wolf')beginWolfDuo();else beginCoop();}else banner('Ton ami choisit le jeu','Vous restez connectés.');return;}
  stopCoop(); coop.mode=mode; $('coopAlias').value=save.friendAlias?'#'+save.friendAlias:save.name?'#'+save.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,24):''; $('portalM').hidden=true; $('coopM').hidden=false;
  $('coopTitle').textContent=mode==='wolf'?'Loup-Garou à deux':'Le Bastion à deux';
  $('coopRules').textContent=mode==='wolf'?'Deux humains et sept bots. Chacun garde son rôle secret et joue sur son appareil. Internet requis.':'Vies communes : 3 en Facile, 2 en Moyen, 1 en Hardcore. Chaque boss a 37 % de chance de donner une vie. Difficulté renforcée à deux. L’hôte choisit les améliorations.';
}
const coopNotice = document.createElement('div'); coopNotice.id = 'coopNotice'; coopNotice.hidden = true;
coopNotice.setAttribute('role', 'status');
coopNotice.style.cssText = 'position:fixed;z-index:90;top:40%;left:10%;right:10%;padding:20px;text-align:center;background:#24164f;color:white;border:3px solid #ffd23f;border-radius:18px;font-size:1.2rem;pointer-events:auto';
document.body.appendChild(coopNotice);
addEventListener('blur', () => { resetJoy(); for (const key in keys) delete keys[key]; });
addEventListener('beforeunload', () => session.close());


function newRun() {
  G = null;resize();
  setBiome(0);
  if (CLASSES[save.cls].req > lvl('caserne')) save.cls = 'soldat';
  const c = CLASSES[save.cls];
  // Bonus des bâtiments du village
  const A = lvl('armurerie'), I = lvl('infirmerie'), F = lvl('forge'), Lb = lvl('labo'), C = lvl('caserne');
  const p = {
    x: WORLD / 2, y: WORLD / 2, r: 18, aim: 0, lastDx: 1, lastDy: 0, walk: 0, moving: false,
    maxHp: c.hp + 15 * (I - 1), hp: 0, speed: c.speed * (1 + LV.speed(C)),
    dmg: c.dmg * (1 + 0.1 * (A - 1)), rate: c.rate, range: c.range,
    projCount: 1, pierce: LV.pierce(A), crit: 0.05 + LV.crit(A), regen: c.regen + LV.regen(I), magnet: 90 * (1 + LV.magnet(Lb)), explosive: 0, orbs: 0,
    drones: (save.cls === 'ingenieur' ? 1 : 0) + LV.drones(C), vamp: 0, xpMult: 1 + 0.1 * (Lb - 1), choices: LV.choices(Lb),
    fireT: 0, inv: 0, dashT: 0, dashCd: 0, dashCdMax: 3 * (1 - LV.dash(F)), dashDx: 0, dashDy: 0,
    grenCd: 0, grenCdMax: 7, grenDmg: 45 * (1 + 0.2 * (F - 1)), ultCd: 6, ultCdMax: c.ultCd * (1 - LV.ult(F)),
  };
  // l'arme choisie change la façon de tirer
  const wm = (WEAPONS[save.weapon] || WEAPONS.standard).mod;
  if (wm.dmg) p.dmg *= wm.dmg; if (wm.rate) p.rate *= wm.rate; if (wm.range) p.range *= wm.range; if (wm.pierce) p.pierce += wm.pierce;
  const gs = gearStats();
  p.dmg *= 1 + gs.dmg; p.crit += gs.crit; p.xpMult *= 1 + gs.xp; p.maxHp += gs.hp; p.res = Math.min(0.6, gs.res); p.regen += gs.regen;
  p.speed *= 1 + gs.speed; p.dashCdMax *= 1 - gs.dash; p.aura = gs.aura;
  const ps = petStats();
  p.maxHp += ps.hp; p.res = Math.min(0.6, p.res + ps.res); p.magnet *= 1 + ps.magnet; p.speed *= 1 + ps.speed; p.dashCdMax *= 1 - ps.dash; p.dmg *= 1 + ps.dmg; p.coinBonus = ps.coins;
  // Hardcore : moins de PV et moins de régénération
  p.maxHp = Math.round(p.maxHp * (diffOf().php || 1)); p.regen *= diffOf().regen === undefined ? 1 : diffOf().regen;
  const potions = drinkPotions(p);
  p.hp = p.maxHp;
  G = {
    t: 0, wave: 0, waveState: 'intro', waveTimer: 1.6, toSpawn: 0, spawnTimer: 0, waveTotal: 0,
    kills: 0, coinsRun: 0, level: 1, xp: 0, xpNext: xpNeed(1), pending: 0, upgradedWave: -1, picks: {},
    p, zombies: [], bullets: [], ebullets: [], pickups: [], parts: [], texts: [], grenades: [], turrets: [], blasts: [],
    droneT: [0, 0, 0, 0], rage: 0, shake: 0, boss: null, potions,
  };
  const pd = PETS[save.pet];
  G.pet = pd ? { id: save.pet, x: p.x - 40, y: p.y + 20, cd: 1.5, t: 0 } : null;
  G.slowR = pd && pd.slow ? pd.slow * (1 + 0.05 * (petLv(save.pet) - 1)) : 0;   // niveau : la zone glacée s'élargit
}
const xpNeed = l => Math.floor(5 + l * 3 + l * l * 0.3);

// ---------- Grille spatiale ----------
const CELL = 80, grid = new Map();
function gridBuild() {
  grid.clear();
  for (const z of G.zombies) {
    if (z.dead) continue;
    const k = ((z.x / CELL) | 0) * 1000 + ((z.y / CELL) | 0);
    let a = grid.get(k); if (!a) { a = []; grid.set(k, a); } a.push(z);
  }
}
function query(x, y, r, cb) {
  const x0 = Math.max(0, ((x - r) / CELL) | 0), x1 = ((x + r) / CELL) | 0;
  const y0 = Math.max(0, ((y - r) / CELL) | 0), y1 = ((y + r) / CELL) | 0;
  for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) {
    const a = grid.get(i * 1000 + j); if (a) for (const z of a) if (!z.dead) cb(z);
  }
}
function nearest(x, y, range) {
  let best = null, bd = range * range;
  for (const z of G.zombies) { if (z.dead) continue; const d = d2(x, y, z.x, z.y); if (d < bd) { bd = d; best = z; } }
  return best;
}

// ---------- Vagues ----------
function pickType() {
  const n = G.wave, r = Math.random();
  if (n >= 4 && r < Math.min(0.14, 0.03 + n * 0.01)) return 'tank';
  // goules à partir de la vague 7 : lentes, solides, elles se relèvent une fois si on ne les achève pas
  if (n >= 7 && Math.random() < Math.min(0.12, 0.04 + n * 0.004)) return 'ghoul';
  // gobelins Puglin à partir de la vague 6, diablotins Imp à partir de la vague 8
  const r2 = Math.random();
  if (n >= 6 && r2 < 0.12) return 'puglin';
  if (n >= 8 && r2 < 0.22) return 'imp';
  if (n >= 3 && r < 0.3) return 'spitter';
  if (n >= 2 && r < 0.55) return 'runner';
  return 'walker';
}
function spawnZombie(type, nx, ny, bossI) {
  const T = ZT[type], p = G.p;
  let x = nx, y = ny;
  if (x === undefined) {
    const a = rnd(0, TAU), dd = Math.max(W, H) / S / 2 + rnd(60, 160);
    x = clamp(p.x + Math.cos(a) * dd, 20, WORLD - 20); y = clamp(p.y + Math.sin(a) * dd, 20, WORLD - 20);
  }
  const scale = (type === 'boss' ? Math.max(1, G.wave / 5) * (1 + (G.wave / 5 - 1) * 0.35) : 1 + (G.wave - 1) * 0.2) * diffOf().hp;
  const z = { type, x, y, r: T.r, hp: T.hp * scale, maxHp: T.hp * scale, speed: T.speed * (1 + Math.min(0.4, G.wave * 0.012)) * rnd(0.9, 1.1) * (diffOf().speed || 1),
    dmg: T.dmg * (1 + G.wave * 0.04) * diffOf().dmg, kx: 0, ky: 0, flash: 0, shootT: rnd(1, 2.5), orbT: 0, wob: rnd(0, TAU) };
  if (type === 'boss') {
    const def = BOSSES[bossI === undefined ? bossesOfWave(G.wave)[0] : bossI];
    Object.assign(z, { def, r: def.r, hp: z.hp * def.hp, maxHp: z.hp * def.hp, speed: def.speed * (1 + Math.min(0.4, G.wave * 0.012)),
      mode: 'walk', aiT: 2.5, summonT: 6, cdx: 0, cdy: 0, lift: 0, tele: null, name: def.name, jcol: def.col });
    G.boss = z;
  }
  if (type === 'jelly') z.jcol = JELLY_COLS[Math.floor(Math.random() * 4)];
  if (MON_SKINS[type]) z.skin = MON_SKINS[type][Math.floor(Math.random() * MON_SKINS[type].length)];
  G.zombies.push(z);
  return z;
}
function startWave() {
  G.wave++;
  const n = G.wave, bossWave = n % 5 === 0;
  G.toSpawn = Math.round((6 + Math.floor(n * 3.6) - (bossWave ? 6 * bossesOfWave(n).length : 0)) * diffOf().spawn);
  G.waveTotal = G.toSpawn + (bossWave ? 1 : 0);
  G.spawnTimer = 0.3; G.waveState = 'fight';
  // Nouvelle zone à chaque boss (et cartes partagées aux vagues 25 et 50)
  const map = mapOfWave(n), zone = Array.isArray(map) ? map[0] : map, newZone = String(map) !== String(biomeKey);
  if (newZone) { try { setBiome(map); } catch (e) { console.warn(e); } G.zoneFlash = 1; }
  if (bossWave) {
    // un, deux ou quatre boss d'un coup (un peu moins de PV chacun quand ils sont plusieurs)
    const list = bossesOfWave(n), p = G.p, hpk = list.length === 1 ? 1 : list.length === 2 ? 0.8 : 0.65;
    const zs = list.map((bi, k) => {
      const a = k / list.length * TAU + 0.6, dd = Math.max(W, H) / S / 2 + 120;
      const z = spawnZombie('boss', clamp(p.x + Math.cos(a) * dd, 40, WORLD - 40), clamp(p.y + Math.sin(a) * dd, 40, WORLD - 40), bi);
      z.hp *= hpk; z.maxHp *= hpk; z.aiT += k * 0.9; z.summonT += k * 2;
      return z;
    });
    G.boss = zs[0]; G.waveTotal += zs.length - 1;
    banner('Vague ' + n, zs.map(z => z.name).join(' et ') + (zs.length > 1 ? ' arrivent !' : ' arrive !'));
  } else banner('Vague ' + n, newZone || n === 1 ? BIOMES[zone % BIOMES.length].name : '');
  if (bossWave && newZone) setTimeout(() => { if (G && state === 'play') banner('', Array.isArray(map) ? map.map(i => BIOMES[i % BIOMES.length].name).join(' · ') : BIOMES[zone % BIOMES.length].name); }, 2400);
}

// ---------- Combat ----------
function fireBullet(x, y, a, dmg, pierce, opt) {
  const crit = Math.random() < G.p.crit, sp = 760;
  G.bullets.push({ x, y, ox: x, oy: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: crit ? dmg * 2 : dmg, crit,
    life: (opt && opt.range || G.p.range) / sp + 0.08, pierce, r: G.p.bulletR || 6, explo: opt && opt.noExplo ? 0 : G.p.explosive, hits: null, col: opt && opt.col, fire: opt && opt.fire });
}
const GHOUL_DOWN = 3;   // secondes au sol avant que la goule se relève
function hitZombie(z, dmg, crit, kx, ky, kb) {
  if (z.dead) return;
  if(G.dungeon)DungeonRules.hit(G.dungeon,z.hp,dmg);
  z.hp -= dmg; z.flash = 0.08;
  const l = Math.hypot(kx, ky) || 1;
  const k = (kb || 140) * (z.type === 'boss' ? 0.12 : z.type === 'tank' ? 0.4 : 1);
  z.kx += kx / l * k; z.ky += ky / l * k;
  addText(z.x + rnd(-8, 8), z.y - z.r, Math.max(1, Math.round(dmg)), crit);
  if (G.parts.length < 400) for (let i = 0; i < 3; i++) { const a = Math.atan2(-ky, -kx) + rnd(-0.9, 0.9), v = rnd(120, 260); G.parts.push({ kind: 'spark', x: z.x, y: z.y - z.r * 0.6, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.22, max: 0.22, r: crit ? 5 : 3.5, color: crit ? '#ffd23f' : '#fff2a8' }); }
  sfx('hit');
  if (z.hp <= 0) killZombie(z);
}
function killZombie(z) {
  if (z.type === 'ghoul' && !z.revived) {
    z.revived = true; z.down = GHOUL_DOWN; z.hp = 1; z.kx = z.ky = 0;
    burst(z.x, z.y, '#8fb86a', 10, 140); addText(z.x, z.y - z.r * 2.2, 'Achève-la !', true);
    return;
  }
  z.dead = true; G.kills++;
  const T = ZT[z.type], p = G.p;
  if (p.vamp) p.hp = Math.min(p.maxHp, p.hp + 1);
  burst(z.x, z.y, T.color, z.type === 'boss' ? 40 : 10, z.type === 'boss' ? 260 : 160);
  // Touffes de laine qui s'envolent
  const wp = WOOL[T.wool];
  if (wp) for (let i = 0; i < 7; i++) { const a = rnd(0, TAU), v = rnd(60, 190); G.parts.push({ kind: 'wool', x: z.x, y: z.y - z.r * 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: rnd(0.45, 0.75), max: 0.75, r: rnd(5, 10) * z.r / 30, color: wp.wool, shade: wp.shade }); }
  G.blasts.push({ x: z.x, y: z.y, r: z.r * 1.6, t: 0.12, color: '#fff8ec' });
  if (z.type === 'boss') {
    if (G.duo && Math.random() < 0.37) G.pickups.push({kind:'life', x:z.x+25, y:z.y, v:1, mag:false});
    for (let i = 0; i < 16; i++) dropGem(z.x + rnd(-50, 50), z.y + rnd(-50, 50), 3);
    for (let i = 0; i < 15; i++) G.pickups.push({ kind: 'coin', x: z.x + rnd(-60, 60), y: z.y + rnd(-60, 60), v: 1, mag: false });
    G.pickups.push({ kind: 'heart', x: z.x, y: z.y, v: 40, mag: false });
    G.boss = G.zombies.find(o => o.type === 'boss' && !o.dead) || null; G.shake = 16; sfx('boom');
    G.gemsRun = (G.gemsRun || 0) + 3;
    banner('Boss vaincu !', '+15 pièces · +3 gemmes');
    return;
  }
  dropGem(z.x, z.y, T.xp);
  if (Math.random() < 0.09 * (G.p.luck || 1)) G.pickups.push({ kind: 'coin', x: z.x + rnd(-8, 8), y: z.y + rnd(-8, 8), v: 1, mag: false });
  if (!diffOf().noHearts && Math.random() < 0.022) G.pickups.push({ kind: 'heart', x: z.x, y: z.y, v: 25, mag: false });
}
function dropGem(x, y, v) { G.pickups.push({ kind: 'gem', x, y, v, mag: false }); }
function explode(x, y, r, dmg, color, small) {
  query(x, y, r + 50, z => { const rr = r + z.r; if (d2(x, y, z.x, z.y) < rr * rr) hitZombie(z, dmg, false, z.x - x, z.y - y, small ? 60 : 260); });
  if (small) { G.blasts.push({ x, y, r: r * 0.8, t: 0.15, color: color || '#ffd23f' }); burst(x, y, color || '#ffb03f', 4, 110); return; }
  G.blasts.push({ x, y, r, t: 0, color: color || '#ffd23f' });
  burst(x, y, color || '#ffb03f', 14, 220);
  G.shake = Math.max(G.shake, 7);
  sfx('boom');
}
function damagePlayer(dmg, p = G.p) {
  if (p.inv > 0 || p.dashT > 0 || state !== 'play') return;
  G.p.hp -= dmg * (1 - (p.res || 0)); p.inv = 0.7; G.shake = Math.max(G.shake, 9);
  sfx('hurt');
  const h = $('hurt'); h.style.opacity = 1; setTimeout(() => h.style.opacity = 0, 160);
  if (G.p.hp <= 0) {
    G.p.hp = 0;
    if (G.duo && --G.lives > 0) {
      G.p.hp = G.p.maxHp;
      G.p.x = WORLD/2-35; G.p.y = WORLD/2; G.p.inv = 3;
      G.ally.x = WORLD/2+35; G.ally.y = WORLD/2; G.ally.inv = 3;
      G.ebullets.length = 0; resetJoy();
      banner('Nouvelle vie !', G.lives + ' vie(s) restante(s)');
    } else gameOver();
  }
}
function burst(x, y, color, n, sp) {
  for (let i = 0; i < n; i++) {
    if (G.parts.length > 420) G.parts.shift();
    const a = rnd(0, TAU), v = rnd(sp * 0.3, sp);
    G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.3, 0.6), max: 0.6, r: rnd(3, 7), color });
  }
}
function addText(x, y, txt, crit) {
  if (G.texts.length > 50) G.texts.shift();
  G.texts.push({ x, y, txt, crit, life: 0.7 });
}

// ---------- Actions ----------
function doDash() {
  if (coopAction('dash')) return;
  const p = G.p; if (state !== 'play' || p.dashCd > 0) return;
  p.dashT = 0.2; p.dashCd = p.dashCdMax; p.dashDx = p.lastDx; p.dashDy = p.lastDy;
  burst(p.x, p.y, '#8fd8ff', 8, 120);
}
function doGrenade() {
  if (coopAction('grenade')) return;
  const p = G.p; if (state !== 'play' || p.grenCd > 0) return;
  p.grenCd = p.grenCdMax;
  const fp = !coop.acting && fpOn(), t = fp ? nearestAhead(p.x, p.y, 520) : nearest(p.x, p.y, 520);
  let tx, ty;
  if (t) { tx = t.x; ty = t.y; } else if (fp) { tx = p.x + Math.cos(FP.yaw) * 260; ty = p.y + Math.sin(FP.yaw) * 260; } else { tx = p.x + p.lastDx * 220; ty = p.y + p.lastDy * 220; }
  G.grenades.push({ x0: p.x, y0: p.y, x1: tx, y1: ty, t: 0, dur: 0.55, dmg: p.grenDmg + p.dmg * 2 });
}
// direction où regarde le héros : la caméra en vue 3D (en duo, l'invité n'a pas de caméra ici), sinon sa visée
const skelFacing = p => (!coop.acting && p === G.p && fpOn()) ? FP.yaw : (p.aim || 0);
function doUlt() {
  if (coopAction('ult')) return;
  const p = G.p; if (state !== 'play' || p.ultCd > 0) return;
  p.ultCd = p.ultCdMax; sfx('ult');
  if ((G.coopClass || save.cls) === 'soldat') {
    for (let i = 0; i < 40; i++) fireBullet(p.x, p.y, i / 40 * TAU, p.dmg * 1.8, 2, { range: 520, col: '#ff8a1f' });
    G.rage = 4; banner('', 'Barrage !');
  } else if ((G.coopClass || save.cls) === 'ingenieur') {
    G.turrets.push({ x: p.x, y: p.y, life: 15, fireT: 0, aim: 0 });
    banner('', 'Tourelle posée !');
  } else if ((G.coopClass || save.cls) === 'necro') {
    for (let i = 0; i < 3; i++) {
      // en éventail devant le héros (bien visible en vue 3D, pas collé à la caméra)
      const slot = (i - 1) * 0.7, a = skelFacing(p) + slot, x = p.x + Math.cos(a) * 120, y = p.y + Math.sin(a) * 120;
      G.turrets.push({ kind: 'skel', x, y, life: 12, fireT: 0.3 + i * 0.15, aim: skelFacing(p), slot, walk: 0 });
      burst(x, y, '#9b5cff', 14, 160);
    }
    banner('', 'Armée des morts !');
  } else {
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.4);
    const R = 290;
    query(p.x, p.y, R + 60, z => { const rr = R + z.r; if (d2(p.x, p.y, z.x, z.y) < rr * rr) hitZombie(z, p.dmg * 3, false, z.x - p.x, z.y - p.y, 700); });
    G.blasts.push({ x: p.x, y: p.y, r: R, t: 0, color: '#3df5b0' });
    burst(p.x, p.y, '#3df5b0', 30, 300);
  }
}

function updateHero(dt, input, remote) {
  const p = G.p;
  // Déplacement
  let {mx, my} = input;
  const ml = Math.hypot(mx, my);
  if (ml > 1) { mx /= ml; my /= ml; }
  if (ml > 0.1) { const l = Math.hypot(mx, my); p.lastDx = mx / l; p.lastDy = my / l; }
  if (p.dashT > 0) {
    p.dashT -= dt;
    p.x += p.dashDx * p.speed * 3.6 * dt; p.y += p.dashDy * p.speed * 3.6 * dt;
    if (Math.random() < 0.6) G.parts.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.25, max: 0.25, r: p.r * 0.8, color: 'rgba(143,216,255,.6)' });
  } else { p.x += mx * p.speed * dt; p.y += my * p.speed * dt; }
  const bounds=combatBounds();p.x=clamp(p.x,bounds.x+p.r,bounds.x+bounds.w-p.r);p.y=clamp(p.y,bounds.y+p.r,bounds.y+bounds.h-p.r);
  p.moving = ml > 0.1;
  if (p.moving || p.dashT > 0) p.walk += dt * (p.dashT > 0 ? 26 : 13);

  p.inv = Math.max(0, p.inv - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.grenCd = Math.max(0, p.grenCd - dt);
  p.ultCd = Math.max(0, p.ultCd - dt);
  if (!remote && p.regen) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);


  // Tir automatique
  const target = !remote && fpOn() ? nearestAhead(p.x, p.y, p.range) : nearest(p.x, p.y, p.range);
  p.fireT = Math.max(0, p.fireT - dt);
  if (target) {
    p.aim = Math.atan2(target.y - p.y, target.x - p.x);
    if (p.fireT <= 0) {
      p.fireT = 1 / (p.rate * (G.rage > 0 ? 2 : 1));
      const n = p.projCount;
      const spread = !remote && FP.aim && fpOn() ? 0.06 : 0.13;
      for (let i = 0; i < n; i++) { fireBullet(p.x + Math.cos(p.aim) * 22, p.y + Math.sin(p.aim) * 22, p.aim + (i - (n - 1) / 2) * spread, p.dmg, p.pierce, (G.coopClass || save.cls) === 'necro' ? Object.assign({}, bulletLook(), { col: '#b78cff' }) : bulletLook()); G.bullets[G.bullets.length - 1].hero = p === G.ally ? 2 : 1; }
      G.parts.push({ kind: 'flash', x: p.x + Math.cos(p.aim) * 44, y: p.y + Math.sin(p.aim) * 30, a: p.aim, vx: 0, vy: 0, life: 0.07, max: 0.07, r: 15, color: '#fff2a8' });
      sfx('shoot');
    }
  } else if (!remote && fpOn()) p.aim = FP.yaw;
  else if (ml > 0.1) p.aim = Math.atan2(my, mx);

}

// ---------- Mise à jour ----------
function updateHeroSupport(dt) {
  const p = G.p;
  p.droneT = p.droneT || [0,0,0,0];
  // Drones
  for (let i = 0; i < p.drones; i++) {
    const a = G.t * 1.6 + i * TAU / p.drones;
    const dx = p.x + Math.cos(a) * 46, dy = p.y + Math.sin(a) * 46 - 10;
    p.droneT[i] -= dt;
    if (p.droneT[i] <= 0) {
      const t = nearest(dx, dy, 400);
      if (t) { p.droneT[i] = 0.75; fireBullet(dx, dy, Math.atan2(t.y - dy, t.x - dx), p.dmg * 0.7, 0, { range: 420, noExplo: true, col: '#8fd8ff' }); }
    }
  }
  // Orbes
  if (p.orbs > 0) {
    const R = 80;
    for (let i = 0; i < p.orbs; i++) {
      const a = G.t * 3 + i * TAU / p.orbs, ox = p.x + Math.cos(a) * R, oy = p.y + Math.sin(a) * R;
      query(ox, oy, 60, z => { const rr = z.r + 13; if (z.orbT < G.t && d2(ox, oy, z.x, z.y) < rr * rr) { z.orbT = G.t + 0.35; hitZombie(z, p.dmg * 1.1, false, z.x - p.x, z.y - p.y, 200); } });
    }
  }

  // Aura de feu (armure ultime complète)
  if (p.aura) {
    p.auraT = (p.auraT || 0) - dt;
    if (p.auraT <= 0) { p.auraT = 0.45; query(p.x, p.y, 120, z => { const rr = 78 + z.r; if (d2(p.x, p.y, z.x, z.y) < rr * rr) hitZombie(z, p.dmg * 0.6, false, z.x - p.x, z.y - p.y, 60); }); }
    if (G.parts.length < 420 && Math.random() < 0.6) { const a = rnd(0, TAU); G.parts.push({ x: p.x + Math.cos(a) * 74, y: p.y + Math.sin(a) * 74, vx: 0, vy: -40, life: 0.4, max: 0.4, r: rnd(3, 6), color: Math.random() < 0.5 ? '#ff7a1f' : '#ffd23f' }); }
  }
}

function update(dt) {
  G.t += dt;
  const p = G.p;

  // Vagues
  if(G.dungeon){ /* finite room roster, no wave spawner */ } else if (G.waveState !== 'fight') {
    G.waveTimer -= dt;
    if (G.waveTimer <= 0) startWave();
  } else if (G.toSpawn > 0) {
    G.spawnTimer -= dt;
    if (G.spawnTimer <= 0) {
      G.spawnTimer = Math.max(0.2, 1.0 - G.wave * 0.05);
      const n = 1 + Math.floor(G.wave / 4);
      for (let i = 0; i < n && G.toSpawn > 0; i++) { spawnZombie(pickType()); G.toSpawn--; }
    }
  } else if (G.zombies.length === 0) {
    G.waveState = 'break'; G.waveTimer = 3.2;
    { const nm = mapOfWave(G.wave + 1); if (String(nm) !== String(biomeKey)) setTimeout(() => { if (G && state === 'play') try { prepareBiome(nm); } catch (e) {} }, 500); }
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.1);
    for (const k of G.pickups) if (k.kind !== 'heart') k.mag = true;
    banner('Vague ' + G.wave + ' terminée', '+10 % PV');
    sfx('level'); unlockWaveUpgrade(true);
  }

  G.rage = Math.max(0, G.rage - dt);
  gridBuild();
  updateHero(dt, localInput(), false);
  if (G.ally) withAlly(() => { updateHero(dt, Date.now() - coop.inputAt < 500 ? coop.input : {mx:0,my:0}, true); updateHeroSupport(dt); });

  updateHeroSupport(dt);
  // Tourelles
  for (const t of G.turrets) {
    t.life -= dt; t.fireT -= dt;
    if (t.kind === 'skel') {
      t.age = (t.age || 0) + dt; t.atkT = Math.max(0, (t.atkT || 0) - dt);
      if (t.age < 1.1) continue;   // il sort de terre
      // squelette du nécromancien : part chasser le monstre le plus proche de lui, même loin (ceux qui arrivent) ;
      // s'il n'y a plus de monstre, il revient se placer devant le héros
      const z = nearest(t.x, t.y, 2400);
      const gx = z ? z.x : p.x + Math.cos(skelFacing(p) + (t.slot || 0)) * 120, gy = z ? z.y : p.y + Math.sin(skelFacing(p) + (t.slot || 0)) * 120;
      const dx = gx - t.x, dy = gy - t.y, l = Math.hypot(dx, dy) || 1, reach = z ? z.r + 22 : 50;
      t.aim = Math.atan2(dy, dx);
      if (l > reach) { const v = Math.min(l - reach, (z ? 205 : 230) * dt); t.x += dx / l * v; t.y += dy / l * v; t.walk += dt * 9; }
      else if (z && t.fireT <= 0) { t.fireT = 0.55; t.atkT = 0.5; hitZombie(z, p.dmg * 1.4, false, dx, dy, 160); burst(z.x, z.y - z.r * 0.5, '#d9c9ff', 5, 120); }
      continue;
    }
    const z = nearest(t.x, t.y, 460);
    if (z) {
      t.aim = Math.atan2(z.y - t.y, z.x - t.x);
      if (t.fireT <= 0) { t.fireT = 1 / 8; fireBullet(t.x + Math.cos(t.aim) * 24, t.y + Math.sin(t.aim) * 24, t.aim + rnd(-0.05, 0.05), p.dmg * 0.75, 0, { range: 480, col: '#3db8ff' }); }
    }
  }
  G.turrets = G.turrets.filter(t => t.life > 0);

  updatePet(dt);
  // Balles
  for (const b of G.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.fire && G.parts.length < 420 && Math.random() < 0.6) G.parts.push({ x: b.x, y: b.y, vx: rnd(-40, 40), vy: rnd(-40, 40), life: 0.25, max: 0.25, r: rnd(3, 6), color: Math.random() < 0.5 ? '#ff7a1f' : '#ffd23f' });
    if (b.life <= 0) { b.dead = true; continue; }
    query(b.x, b.y, 56, z => {
      if (b.dead || z.dead || (b.hits && b.hits.includes(z))) return;
      const rr = z.r + b.r;
      if (d2(b.x, b.y, z.x, z.y) < rr * rr) {
        hitZombie(z, b.dmg, b.crit, b.vx, b.vy);
        if (b.explo) explode(b.x, b.y, 26 + b.explo * 8, b.dmg * 0.22 * b.explo, '#ff9d4d', true);
        if (b.pierce > 0) { b.pierce--; (b.hits || (b.hits = [])).push(z); } else b.dead = true;
      }
    });
  }
  G.bullets = G.bullets.filter(b => !b.dead);

  // Grenades
  for (const g of G.grenades) {
    g.t += dt;
    if (g.t >= g.dur) { g.dead = true; explode(g.x1, g.y1, 115, g.dmg, '#ffd23f'); }
  }
  G.grenades = G.grenades.filter(g => !g.dead);

  // Zombies
  for (const z of G.zombies) {
    if (z.dead) continue;
    if (z.down > 0) {   // goule au sol : immobile et inoffensive, puis elle se relève avec la moitié de sa vie
      z.down -= dt; z.flash = Math.max(0, z.flash - dt);
      if (z.down <= 0) { z.down = 0; z.hp = z.maxHp * 0.5; burst(z.x, z.y, '#8fb86a', 12, 160); addText(z.x, z.y - z.r * 2.2, 'Elle se relève !', false); }
      continue;
    }
    const victim = closestHero(z.x, z.y);
    const dx = victim.x - z.x, dy = victim.y - z.y, d = Math.hypot(dx, dy) || 1;
    let ux = dx / d, uy = dy / d, sp = z.speed;
    if (G.slowR && d < G.slowR) sp *= z.type === 'boss' ? 0.85 : 0.7;
    if (z.type === 'spitter') {
      if (d < 220) { ux = -ux * 0.6; uy = -uy * 0.6; } else if (d < 290) { ux *= 0.1; uy *= 0.1; }
      z.shootT -= dt;
      if (z.shootT <= 0 && d < 440) {
        z.shootT = 2.4;
        G.ebullets.push({ x: z.x, y: z.y, vx: dx / d * 260, vy: dy / d * 260, life: 2.2, r: 9, dmg: z.dmg });
      }
    } else if (z.type === 'boss') {
      [ux, uy, sp] = bossAI(z, dt, ux, uy, victim);
    }
    let sx = 0, sy = 0;
    query(z.x, z.y, z.r + 50, o => {
      if (o === z) return;
      const ox = z.x - o.x, oy = z.y - o.y, dd = ox * ox + oy * oy, rr = z.r + o.r;
      if (dd < rr * rr && dd > 0.01) { const dl = Math.sqrt(dd), push = (rr - dl) / rr; sx += ox / dl * push; sy += oy / dl * push; }
    });
    z.x += (ux * sp + sx * 90 + z.kx) * dt;
    z.y += (uy * sp + sy * 90 + z.ky) * dt;
    const decay = Math.min(1, dt * 9);
    z.kx -= z.kx * decay; z.ky -= z.ky * decay;
    const bounds=combatBounds();z.x=clamp(z.x,bounds.x+z.r,bounds.x+bounds.w-z.r);z.y=clamp(z.y,bounds.y+z.r,bounds.y+bounds.h-z.r);
    z.flash = Math.max(0, z.flash - dt);
    const rr = z.r + p.r - 4;
    for (const hero of teamHeroes()) if (d2(hero.x, hero.y, z.x, z.y) < rr * rr && !(z.lift > 20)) damagePlayer(z.dmg, hero);
  }
  G.zombies = G.zombies.filter(z => !z.dead);

  // Crachats acides
  for (const e of G.ebullets) {
    e.x += e.vx * dt; e.y += e.vy * dt; e.life -= dt;
    const rr = e.r + p.r;
    for (const hero of teamHeroes()) if (e.life > 0 && d2(e.x, e.y, hero.x, hero.y) < rr * rr) { e.life = 0; damagePlayer(e.dmg, hero); burst(e.x, e.y, e.col || '#ff6fb5', 6, 100); }
  }
  G.ebullets = G.ebullets.filter(e => e.life > 0);

  // Butin
  const magR = p.magnet;
  for (const k of G.pickups) {
    const collector = closestHero(k.x, k.y);
    const dd = Math.sqrt(d2(k.x, k.y, collector.x, collector.y)) || 1;
    if (k.mag || dd < magR) {
      k.mag = true;
      const sp = 560 * dt;
      k.x += (collector.x - k.x) / dd * Math.min(sp, dd); k.y += (collector.y - k.y) / dd * Math.min(sp, dd);
    }
    if (dd < p.r + 10) {
      k.dead = true;
      if (k.kind === 'gem') { gainXp(k.v); sfx('pick'); }
      else if (k.kind === 'coin') { G.coinsRun += k.v; sfx('coin'); }
      else if (k.kind === 'life') { G.lives++; banner('+1 vie !', G.lives + ' vies pour l’équipe'); sfx('level'); }
      else { p.hp = Math.min(p.maxHp, p.hp + k.v); addText(p.x, p.y - 30, '+' + k.v + ' PV', true); sfx('level'); }
    }
  }
  G.pickups = G.pickups.filter(k => !k.dead);
  if (G.pickups.length > 260) for (let i = 0; i < 40; i++) G.pickups[i].mag = true;

  // Effets
  for (const q of G.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.9; q.vy *= 0.9; q.life -= dt; }
  G.parts = G.parts.filter(q => q.life > 0);
  for (const t of G.texts) { t.y -= 40 * dt; t.life -= dt; }
  G.texts = G.texts.filter(t => t.life > 0);
  for (const b of G.blasts) b.t += dt;
  G.blasts = G.blasts.filter(b => b.t < 0.4);
  G.shake = Math.max(0, G.shake - dt * 40);
  G.zoneFlash = Math.max(0, (G.zoneFlash || 0) - dt * 1.2);

  if(G.dungeon?.room===5&&state==='play'&&!G.zombies.length){completeDungeonRoom();return;}
  if(G.dungeon)dungeonPortal();
  if (G.pending > 0 && state === 'play') openLevelUp();
  else if(G.dungeon&&state==='play'&&!G.zombies.length)completeDungeonRoom();
}
// Une amélioration par vague jusqu'à la 24, puis une toutes les 2 vagues (25, 27…), puis toutes les 3 dès la 50 (50, 53…)
function upgradeWave(n){ return n<25 || (n<50 ? (n-25)%2===0 : (n-50)%3===0); }
function nextUpgradeWave(n){ let w=n+1; while(!upgradeWave(w)) w++; return w; }
function unlockWaveUpgrade(waveEnd){
  if(G.wave<1||G.pending||G.upgradedWave===G.wave||G.xp<G.xpNext)return;
  // au Bastion, l'amélioration se choisit à la fin de la vague (jamais deux presque d'affilée en début de partie)
  if(!G.dungeon&&((!waveEnd&&G.waveState!=='break')||!upgradeWave(G.wave)))return;   /* aussi pendant la pause entre deux vagues (XP ramassée après le dernier monstre) */
  G.xp-=G.xpNext;G.level++;G.xpNext=xpNeed(G.level);G.pending=1;
}
// l'XP ne s'accumule pas au-delà d'une barre pleine : elle attend la prochaine vague à amélioration
function gainXp(v) { G.xp=Math.min(G.xpNext,G.xp+v*G.p.xpMult);unlockWaveUpgrade(); }

// ---------- Rendu ----------
const INK = '#1d1238';
function circle(x, y, r, fill, stroke, lw) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = lw || 3; ctx.strokeStyle = stroke; ctx.stroke(); }
}
function drawFloor(vx, vy, vw, vh) {
  if (!biome) setBiome(0);
  const B = biome.B, t = G ? G.t : 0;
  const x0 = Math.max(0, Math.floor(vx)), y0 = Math.max(0, Math.floor(vy)), x1 = Math.min(WORLD, Math.ceil(vx + vw)), y1 = Math.min(WORLD, Math.ceil(vy + vh));
  if (x1 > x0 && y1 > y0) ctx.drawImage(biome.layer, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
  const Wt = biome.water;
  if (Wt && x1 > Wt.box[0] && y1 > Wt.box[1]) {
    // Eau vivante : deux couches de reflets qui dérivent, écume qui roule sur la plage, éclats de soleil
    const ax = Math.max(x0, Wt.box[0]), ay = Math.max(y0, Wt.box[1]);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, WORLD, WORLD); ctx.clip(); ctx.clip(Wt.shore);
    for (const [k, dx, dy, al] of [[0, 13, 7, 0.75], [1, -9, 11, 0.5]]) {
      const ox = (t * dx + k * 190) % 512, oy = (t * dy + k * 110) % 512;
      ctx.save(); ctx.translate(ox, oy); ctx.globalAlpha = al;
      ctx.fillStyle = Wt.fill; ctx.fillRect(ax - ox, ay - oy, x1 - ax, y1 - ay); ctx.restore();
    }
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.35 + Math.sin(t * 1.6) * 0.15) + ')'; ctx.lineWidth = 24 + Math.sin(t * 1.6) * 8; ctx.stroke(Wt.shore);
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 10; ctx.setLineDash([46, 30]); ctx.lineDashOffset = -t * 22; ctx.stroke(Wt.shore);
    ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 6; ctx.setLineDash([30, 60]); ctx.lineDashOffset = t * 16; ctx.stroke(Wt.deep); ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    for (const [gx, gy, ph, sz] of Wt.glints) {
      if (gx < x0 - 10 || gx > x1 + 10 || gy < y0 - 10 || gy > y1 + 10) continue;
      const a = Math.sin(t * 2.2 + ph); if (a < 0.4) continue;
      const r = 7 * sz * (a - 0.4) / 0.6;
      ctx.globalAlpha = a; ctx.beginPath(); ctx.moveTo(gx - r, gy); ctx.lineTo(gx - r * 0.18, gy - r * 0.18); ctx.lineTo(gx, gy - r); ctx.lineTo(gx + r * 0.18, gy - r * 0.18); ctx.lineTo(gx + r, gy); ctx.lineTo(gx + r * 0.18, gy + r * 0.18); ctx.lineTo(gx, gy + r); ctx.lineTo(gx - r * 0.18, gy + r * 0.18); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  if (biome.lava.length) {
    // Lave qui coule : vagues claires qui avancent et lueur qui respire
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (biome.lavaClip) { ctx.beginPath(); ctx.rect(...biome.lavaClip); ctx.clip(); }
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,120,30,' + (0.18 + Math.sin(t * 2) * 0.08) + ')'; ctx.lineWidth = 90;
    for (const lp of biome.lava) ctx.stroke(lp);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(255,230,140,.75)'; ctx.lineWidth = 7; ctx.setLineDash([18, 46]); ctx.lineDashOffset = -t * 34;
    for (const lp of biome.lava) ctx.stroke(lp);
    ctx.strokeStyle = 'rgba(255,190,80,.6)'; ctx.lineWidth = 16; ctx.setLineDash([6, 70]); ctx.lineDashOffset = -t * 22 + 30;
    for (const lp of biome.lava) ctx.stroke(lp);
    ctx.restore();
  }
  // Bordure de la zone
  ctx.lineWidth = 46; ctx.strokeStyle = B.edge; ctx.strokeRect(-23, -23, WORLD + 46, WORLD + 46);
  ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeRect(-2, -2, WORLD + 4, WORLD + 4);
}
// ---------- Monstres en laine (dessinés une fois, puis réutilisés) ----------
const WOOL = {
  dark:  { wool: '#6a4a33', shade: '#4a3324', hi: '#8a6648', horn: '#e2d6a4', hornS: '#b3a571', leg: '#34465f', socket: '#d8c98f' },
  black: { wool: '#4a3326', shade: '#2e1f15', hi: '#654634', horn: '#e2d6a4', hornS: '#b3a571', leg: '#2b3a50', socket: '#cdbd83' },
  spit:  { wool: '#5e4130', shade: '#3f2a1c', hi: '#7d5a40', horn: '#ff6fb5', hornS: '#c23f84', leg: '#34465f', socket: '#d8c98f' },
  royal: { wool: '#fffbe8', shade: '#e2d09a', hi: '#ffffff', horn: '#3b5ea8', hornS: '#24407a', leg: '#3b5ea8', socket: '#f1e8bc' },
  light: { wool: '#fffbe8', shade: '#e2d4aa', hi: '#ffffff', horn: '#4f78a8', hornS: '#2f5584', leg: '#46699a', socket: '#f1e8bc' },
};
const woolCache = {};
function woolSprite(kind, flash) {
  const key = kind + (flash ? 'f' : '');
  if (woolCache[key]) return woolCache[key];
  const pal = WOOL[kind], c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.translate(64, 70); g.lineJoin = 'round'; g.lineCap = 'round';
  const horn = (bx, by, cx, cy, tx, ty) => {
    for (const [col, w] of [[INK, 17], [pal.hornS, 12], [pal.horn, 7]]) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(cx, cy, tx, ty); g.stroke(); }
  };
  // Pattes
  for (const [lx, ly] of [[-24, 26], [-6, 31], [16, 30], [32, 22]]) {
    g.fillStyle = pal.leg; g.strokeStyle = INK; g.lineWidth = 3;
    g.beginPath(); g.roundRect ? g.roundRect(lx - 7, ly - 8, 14, 17, 6) : g.rect(lx - 7, ly - 8, 14, 17); g.fill(); g.stroke();
  }
  horn(-24, -20, -48, -28, -44, -2);   // corne arrière
  // Toison : un nuage de boules de laine
  const puffs = [[-24, -2, 21], [-2, -14, 25], [21, -6, 21], [-14, 13, 21], [12, 13, 23], [31, 8, 15], [-33, 11, 14], [4, -31, 14], [-18, -26, 15], [22, -26, 12]];
  g.fillStyle = '#2a1830'; for (const [x, y, r] of puffs) { g.beginPath(); g.arc(x, y, r + 3, 0, TAU); g.fill(); }
  // Chaque boule de laine : dégradé (lumière en haut à gauche), boucles, petit reflet
  const RW = seeded(kind.length * 17);
  for (const [x, y, r] of puffs) {
    const gr = g.createRadialGradient(x - r * 0.4, y - r * 0.5, r * 0.1, x, y, r * 1.05);
    gr.addColorStop(0, pal.hi); gr.addColorStop(0.6, pal.wool); gr.addColorStop(1, pal.shade);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.strokeStyle = pal.shade; g.lineWidth = 1.3; g.globalAlpha = 0.45;
    for (let k = 0; k < r * 0.22; k++) { const a = RW() * TAU, d = RW() * r * 0.75; g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 2.5 + RW() * 2.5, 0.2, Math.PI * 1.1); g.stroke(); }
    g.globalAlpha = 1;
  }
  g.fillStyle = 'rgba(255,255,255,.55)'; for (const [x, y, r] of puffs) if (y < 0) { g.beginPath(); g.ellipse(x - r * 0.35, y - r * 0.45, r * 0.3, r * 0.16, -0.5, 0, TAU); g.fill(); }
  horn(28, -20, 52, -30, 47, -4);      // corne avant
  // Grand œil sur le côté
  g.fillStyle = pal.socket; g.strokeStyle = pal.shade; g.lineWidth = 3;
  g.beginPath(); g.ellipse(15, 8, 19, 21, -0.15, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(17, 9, 14, 17, -0.15, 0, TAU); g.fill();
  g.fillStyle = '#111111'; g.beginPath(); g.ellipse(21, 11, 8, 11.5, -0.1, 0, TAU); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(23.5, 5, 3.2, 0, TAU); g.fill();
  // Mèche de laine qui tombe sur le haut de l'œil (paupière endormie)
  g.save(); g.beginPath(); g.ellipse(15, 8, 19, 21, -0.15, 0, TAU); g.clip();
  g.fillStyle = pal.shade; g.beginPath(); g.ellipse(13, -12, 22, 13, -0.1, 0, TAU); g.fill();
  g.fillStyle = pal.wool; g.beginPath(); g.ellipse(11, -15, 20, 11, -0.1, 0, TAU); g.fill();
  g.restore();
  g.strokeStyle = pal.shade; g.lineWidth = 2.5; g.beginPath(); g.ellipse(13, -12, 22, 13, -0.1, 0.35, Math.PI - 0.35); g.stroke();
  if (flash) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(-64, -70, 128, 128); }
  return (woolCache[key] = c);
}
function drawWoolly(z, tx) {
  const T = ZT[z.type], r = z.r, k = r / 34;
  const hop = Math.abs(Math.sin((G ? G.t : demoT) * (z.type === 'runner' ? 14 : 9) + z.wob));
  ctx.fillStyle = 'rgba(29,18,56,.22)';
  ctx.beginPath(); ctx.ellipse(z.x, z.y + r * 0.95, r * (1.15 - hop * 0.15), r * 0.42, 0, 0, TAU); ctx.fill();
  ctx.save();
  ctx.translate(z.x, z.y - hop * r * 0.3);
  ctx.scale((tx < z.x ? -1 : 1) * k * (1 + (1 - hop) * 0.05), k * (1 - (1 - hop) * 0.07));
  ctx.drawImage(woolSprite(T.wool, z.flash > 0), -64, -70);
  ctx.restore();
  if (z.type === 'tank' && z.hp < z.maxHp) {
    const w = r * 2;
    ctx.fillStyle = INK; ctx.fillRect(z.x - w / 2, z.y - r * 1.5 - 10, w, 7);
    ctx.fillStyle = '#ff5b3a'; ctx.fillRect(z.x - w / 2 + 1, z.y - r * 1.5 - 9, (w - 2) * Math.max(0, z.hp / z.maxHp), 5);
  }
}
// ---------- Boss (un nouveau toutes les 5 vagues, du plus facile au plus dur) ----------
// Les 4 boss, du plus facile au plus dur. Vagues 5-10-15-20 : un boss ; vague 25 : les deux premiers ensemble ;
// 30-35-40-45 : de nouveau un boss ; vague 50 : les quatre ensemble ; puis tout recommence (de plus en plus forts).
const BOSSES = [
  { id: 'mushking', name: 'Roi Champignon',   hp: 1.0,  speed: 42, r: 52, minion: 'walker', minionSkin: 'um_mushnub', count: 4, moves: ['leaves', 'hop'], col: '#3db8ff', ring: '#8ad0ff' },
  { id: 'tiki',     name: 'Chef Tiki',        hp: 1.15, speed: 50, r: 50, minion: 'spitter', minionSkin: 'um_cactoro', count: 3, moves: ['charge', 'fire'], col: '#e8902a', fire: '#c98a3a' },
  { id: 'demon',    name: 'Démon Rouge',      hp: 1.3,  speed: 58, r: 50, minion: 'spitter', minionSkin: 'um_wizard', count: 3, moves: ['fire', 'dash', 'dash', 'fire'], col: '#d9472f', fire: '#ff4f2f' },
  { id: 'dragon',   name: 'Dragon Ancestral', hp: 1.6,  speed: 50, r: 62, minion: 'runner', minionSkin: 'um_bee', count: 4, moves: ['fire', 'charge', 'slam'], col: '#ff8a1f', fire: '#ff8a1f' },
  { id: 'creep',    name: 'Rôdeur des cavernes', hp: 1.45, speed: 60, r: 80, minion: 'tank', minionSkin: 'um_orc', count: 3, moves: ['charge', 'slam', 'dash'], col: '#8a7a6a', ring: '#c9b89a' },
  { id: 'guard',    name: 'Gardien de la forêt', hp: 1.35, speed: 66, r: 70, minion: 'runner', minionSkin: 'um_ninja', count: 4, moves: ['dash', 'charge', 'leaves', 'dash'], col: '#6a8a4a', ring: '#a8d080' },
];
// un boss toutes les 5 vagues : chacun son tour (dont le Rôdeur et le Gardien), puis des duos, puis quatre à la fois
function bossesOfWave(n) {
  const c = (Math.floor(n / 5) - 1) % 12;
  return c < 6 ? [c] : c === 6 ? [0, 1] : c === 7 ? [4, 5] : c === 8 ? [2, 3] : c === 9 ? [1, 4] : c === 10 ? [3, 5] : [0, 2, 4, 5];
}
const JELLY_COLS = ['#4fb8ff', '#ff4f6d', '#ffd23f', '#4fe0a0'];

function bossShot(z, a, sp, col, r) {
  G.ebullets.push({ x: z.x + Math.cos(a) * z.r * 0.6, y: z.y + Math.sin(a) * z.r * 0.6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 3, r: r || 10, dmg: z.dmg * 0.6, col });
}
function bossAI(z, dt, ux, uy, p = G.p) {
  const B = z.def;
  let sp = z.speed;
  z.aiT -= dt; z.summonT -= dt;
  if (z.mode === 'walk') {
    if (z.aiT <= 0) {
      z.move = B.moves[(z.moveI = (z.moveI || 0) + 1) % B.moves.length];
      if (z.move === 'charge') { z.mode = 'prep'; z.aiT = 0.75; z.tele = { type: 'line' }; }
      else if (z.move === 'hop') { z.mode = 'prep'; z.aiT = 0.6; z.hx1 = p.x; z.hy1 = p.y; z.tele = { type: 'circle', x: p.x, y: p.y, r: 115 }; }
      else if (z.move === 'dash') { z.mode = 'act'; z.aiT = 0.32; const a = Math.atan2(uy, ux) + rnd(-0.8, 0.8); z.cdx = Math.cos(a); z.cdy = Math.sin(a); }
      else if (z.move === 'fire') { z.mode = 'prep'; z.aiT = 0.65; z.tele = { type: 'cone' }; }
      else if (z.move === 'leaves') { z.mode = 'prep'; z.aiT = 0.6; z.tele = { type: 'ring' }; }
      else if (z.move === 'slam') { z.mode = 'prep'; z.aiT = 1.0; z.tele = { type: 'circle', follow: true, r: 200 }; }
      else if (z.move === 'ink') { z.mode = 'act'; z.aiT = 2.2; z.inkT = 0; z.inkA = Math.atan2(uy, ux); }
      z.teleT = 0; z.teleMax = z.aiT;
    }
  } else if (z.mode === 'prep') {
    sp = 0; z.teleT += dt;
    if (z.move === 'charge' || z.move === 'fire') { z.cdx = ux; z.cdy = uy; }
    if (z.aiT <= 0) {
      z.tele = null;
      if (z.move === 'charge') { z.mode = 'act'; z.aiT = 0.7; }
      else if (z.move === 'hop') { z.mode = 'act'; z.aiT = 0.6; z.hopT = 0; z.hx0 = z.x; z.hy0 = z.y; z.landed = false; }
      else {
        if (z.move === 'fire') { const a0 = Math.atan2(z.cdy, z.cdx); for (let i = -3; i <= 3; i++) bossShot(z, a0 + i * 0.15, 320, B.fire || '#ff8a1f', 12); sfx('boom'); }
        else if (z.move === 'leaves') { const n = 18, off = rnd(0, TAU); for (let i = 0; i < n; i++) bossShot(z, off + i / n * TAU, 190, B.ring || '#5fd36a', 10); }
        else if (z.move === 'slam') {
          const R = 200;
          for (const hero of teamHeroes()) if (d2(hero.x, hero.y, z.x, z.y) < (R + hero.r) ** 2) damagePlayer(z.dmg * 1.2, hero);
          G.blasts.push({ x: z.x, y: z.y, r: R, t: 0, color: '#d9b77a' }); burst(z.x, z.y, '#b8a888', 26, 300);
          G.shake = Math.max(G.shake, 15); sfx('boom');
        }
        z.mode = 'walk'; z.aiT = rnd(2.6, 3.6);
      }
    }
  } else {
    if (z.move === 'charge') { ux = z.cdx; uy = z.cdy; sp = z.speed * 5.2; }
    else if (z.move === 'dash') { ux = z.cdx; uy = z.cdy; sp = z.speed * 5; }
    else if (z.move === 'hop') {
      sp = 0; z.hopT += dt;
      const k = Math.min(1, z.hopT / 0.6);
      z.x = z.hx0 + (z.hx1 - z.hx0) * k; z.y = z.hy0 + (z.hy1 - z.hy0) * k;
      z.lift = Math.sin(k * Math.PI) * 90;
      if (k >= 1 && !z.landed) {
        z.landed = true; z.lift = 0;
        for (const hero of teamHeroes()) if (d2(hero.x, hero.y, z.x, z.y) < (115 + hero.r) ** 2) damagePlayer(z.dmg, hero);
        G.blasts.push({ x: z.x, y: z.y, r: 115, t: 0, color: z.jcol }); burst(z.x, z.y, z.jcol, 18, 220);
        G.shake = Math.max(G.shake, 10); sfx('boom');
      }
    } else if (z.move === 'ink') {
      sp = z.speed * 0.3; z.inkT -= dt;
      if (z.inkT <= 0) { z.inkT = 0.09; z.inkA += 0.42; bossShot(z, z.inkA, 230, '#5b3a8a', 9); bossShot(z, z.inkA + Math.PI, 230, '#5b3a8a', 9); }
    }
    if (z.aiT <= 0) { z.mode = 'walk'; z.lift = 0; z.aiT = z.move === 'dash' ? rnd(0.4, 0.9) : rnd(2.8, 4.0); }
  }
  if (z.summonT <= 0) {
    z.summonT = 8;
    for (let i = 0; i < B.count; i++) { const a = rnd(0, TAU); const m = spawnZombie(B.minion, clamp(z.x + Math.cos(a) * 80, 20, WORLD - 20), clamp(z.y + Math.sin(a) * 80, 20, WORLD - 20)); if (B.minionSkin) m.skin = B.minionSkin; }
  }
  return [ux, uy, sp];
}
function drawTele(z) {
  const t = z.tele, k = clamp(z.teleT / (z.teleMax || 1), 0, 1);
  ctx.save();
  if (t.type === 'line') {
    ctx.strokeStyle = 'rgba(255,58,58,.5)'; ctx.lineWidth = z.r * 1.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(z.x, z.y); ctx.lineTo(z.x + z.cdx * 360, z.y + z.cdy * 360); ctx.stroke();
  } else if (t.type === 'circle') {
    const x = t.follow ? z.x : t.x, y = t.follow ? z.y : t.y;
    ctx.fillStyle = 'rgba(255,58,58,.16)'; ctx.beginPath(); ctx.arc(x, y, t.r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,58,58,.28)'; ctx.beginPath(); ctx.arc(x, y, t.r * k, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,58,58,.8)'; ctx.lineWidth = 4; ctx.setLineDash([16, 10]); ctx.beginPath(); ctx.arc(x, y, t.r, 0, TAU); ctx.stroke();
  } else if (t.type === 'cone') {
    const a = Math.atan2(z.cdy, z.cdx);
    ctx.fillStyle = 'rgba(255,138,31,.28)'; ctx.beginPath(); ctx.moveTo(z.x, z.y); ctx.arc(z.x, z.y, 380, a - 0.5, a + 0.5); ctx.closePath(); ctx.fill();
  } else if (t.type === 'ring') {
    ctx.strokeStyle = 'rgba(95,211,106,.7)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(z.x, z.y, z.r + 20 + k * 40, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

// ---------- Dessins des boss et de leurs sbires (repère local : corps d'environ 50 de rayon, tourné vers la droite) ----------
function crown(g, x, y, w) {
  const h = w * 0.55;
  g.fillStyle = '#ffd23f'; g.strokeStyle = INK; g.lineWidth = 3; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x - w / 2, y - h); g.lineTo(x - w / 4, y - h * 0.45); g.lineTo(x, y - h * 1.15); g.lineTo(x + w / 4, y - h * 0.45); g.lineTo(x + w / 2, y - h); g.lineTo(x + w / 2, y); g.closePath();
  g.fill(); g.stroke();
  for (const [gx, col] of [[-w / 4, '#ff4f6d'], [0, '#3db8ff'], [w / 4, '#ff4f6d']]) { g.fillStyle = col; g.beginPath(); g.arc(x + gx, y - h * 0.22, w * 0.07, 0, TAU); g.fill(); g.stroke(); }
  for (const gx of [-w / 2, 0, w / 2]) { g.fillStyle = '#fff2a8'; g.beginPath(); g.arc(x + gx, y - (gx === 0 ? h * 1.15 : h), w * 0.06, 0, TAU); g.fill(); g.stroke(); }
}
function eye(g, x, y, rx, ry, angry, iris) {
  g.fillStyle = '#ffffff'; g.strokeStyle = INK; g.lineWidth = 3;
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = iris || '#111'; g.beginPath(); g.ellipse(x + rx * 0.3, y + ry * 0.1, rx * 0.5, ry * 0.6, 0, 0, TAU); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(x + rx * 0.45, y - ry * 0.25, rx * 0.18, 0, TAU); g.fill();
  if (angry) { g.strokeStyle = INK; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - rx, y - ry - 4); g.lineTo(x + rx, y - ry + 6); g.stroke(); }
}
function jellyBody(g, col, withCrown, t) {
  const sq = 1 + Math.sin(t * 6) * 0.05;
  g.save(); g.scale(1 / sq, sq);
  g.fillStyle = INK; rrect(g, -46, -40, 92, 86, 26); g.fill();
  const jg = g.createLinearGradient(0, -36, 0, 42); jg.addColorStop(0, tint(col, 0.35)); jg.addColorStop(0.55, col); jg.addColorStop(1, tint(col, -0.25));
  g.globalAlpha = 0.94; g.fillStyle = jg; rrect(g, -42, -36, 84, 78, 22); g.fill(); g.globalAlpha = 1;
  // petites bulles prises dans la gelée
  g.fillStyle = 'rgba(255,255,255,.4)'; for (const [bx, by, br] of [[-26, 8, 4], [24, 14, 3], [-14, 26, 2.5], [30, -10, 2.5]]) { g.beginPath(); g.arc(bx, by, br, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(0,0,0,.15)'; rrect(g, -42, 14, 84, 28, 18); g.fill();
  g.fillStyle = 'rgba(255,255,255,.35)'; rrect(g, -36, -32, 72, 20, 12); g.fill();
  g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(-24, -20, 9, 5, -0.4, 0, TAU); g.fill();
  eye(g, -6, -2, 9, 11, true); eye(g, 18, -2, 9, 11, true);
  g.fillStyle = INK; g.beginPath(); g.ellipse(8, 20, 12, 7, 0, 0, Math.PI); g.fill();
  g.fillStyle = '#ff7fa8'; g.beginPath(); g.ellipse(8, 22, 6, 3, 0, 0, Math.PI); g.fill();
  if (withCrown) crown(g, 0, -38, 46);
  g.restore();
}
function tofuBody(g, withCrown, t) {
  const flap = Math.sin(t * 18) * 0.5;
  g.strokeStyle = '#ff8a1f'; g.lineWidth = 5; g.lineCap = 'round';
  for (const lx of [-12, 10]) { g.beginPath(); g.moveTo(lx, 30); g.lineTo(lx, 46); g.lineTo(lx + 9, 48); g.stroke(); }
  g.fillStyle = '#ffd23f'; g.strokeStyle = INK; g.lineWidth = 4;
  g.beginPath(); g.arc(0, 0, 40, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = '#fff2a8'; g.beginPath(); g.ellipse(6, 14, 22, 18, 0, 0, TAU); g.fill();
  g.save(); g.translate(-14, 4); g.rotate(-0.5 + flap); g.fillStyle = '#ffb02e'; g.beginPath(); g.ellipse(-14, 0, 20, 11, 0, 0, TAU); g.fill(); g.stroke(); g.restore();
  g.fillStyle = '#ff8a1f'; g.beginPath(); g.moveTo(34, -6); g.lineTo(58, 2); g.lineTo(34, 10); g.closePath(); g.fill(); g.stroke();
  eye(g, 18, -12, 10, 12, false);
  g.fillStyle = '#ff8a1f'; for (const [fx, fr] of [[-10, -0.5], [-2, -0.15], [6, 0.2]]) { g.save(); g.translate(fx, -38); g.rotate(fr); g.beginPath(); g.ellipse(0, -8, 5, 12, 0, 0, TAU); g.fill(); g.stroke(); g.restore(); }
  if (withCrown) crown(g, -2, -44, 40);
}
function drawBossBody(z, g, t) {
  if (BOSS3D[z.def.id]) { drawModelBoss(z, g, t); return; }
  g.fillStyle = '#5a2a2a'; g.beginPath(); g.ellipse(0, -20, 70, 45, 0, 0, TAU); g.fill();
}
let bossCanvas = null;
function drawBoss(z, tx) {
  const t = G ? G.t : demoT, lift = z.lift || 0, k = z.r / 50;
  ctx.fillStyle = 'rgba(29,18,56,.25)';
  ctx.beginPath(); ctx.ellipse(z.x, z.y + z.r * 0.95, z.r * 1.15 * (1 - lift / 300), z.r * 0.42 * (1 - lift / 300), 0, 0, TAU); ctx.fill();
  ctx.save();
  ctx.translate(z.x, z.y - lift);
  ctx.scale((tx < z.x ? -1 : 1) * k, k);
  if (z.mode === 'prep') ctx.translate(Math.sin(t * 60) * 2, 0);
  // Le boss est peint à part puis éclairé (lumière en haut à gauche, ombre en bas à droite) pour lui donner du volume
  const bc = bossCanvas || (bossCanvas = document.createElement('canvas')); bc.width = bc.height = 400;
  const bg = bc.getContext('2d'); bg.setTransform(2, 0, 0, 2, 200, 220); bg.lineJoin = 'round';
  drawBossBody(z, bg, t);
  bg.globalCompositeOperation = 'source-atop';
  const sh = bg.createRadialGradient(-35, -60, 0, -35, -60, 170);
  sh.addColorStop(0, 'rgba(255,248,220,.42)'); sh.addColorStop(0.32, 'rgba(255,248,220,0)'); sh.addColorStop(0.62, 'rgba(40,20,80,0)'); sh.addColorStop(1, 'rgba(40,20,80,.45)');
  bg.fillStyle = sh; bg.fillRect(-100, -110, 200, 200);
  // éclair blanc quand il est touché : léger, sinon avec un tir rapide le boss paraît blanc et transparent en permanence
  if (z.flash > 0) { bg.fillStyle = 'rgba(255,255,255,.22)'; bg.fillRect(-100, -110, 200, 200); }
  bg.globalCompositeOperation = 'source-over';
  ctx.drawImage(bc, -100, -110, 200, 200);
  ctx.restore();
}
// Gelées et tofus : 8 images d'animation peintes et éclairées une fois, puis réutilisées (fluide même avec beaucoup de monstres)
const minionCache = {};
function minionFrame(type, col, f, flash) {
  const key = type + col + f + (flash ? 'f' : '');
  if (minionCache[key]) return minionCache[key];
  const c = document.createElement('canvas'); c.width = c.height = 200;
  const g = c.getContext('2d'); g.setTransform(1.6, 0, 0, 1.6, 100, 104); g.lineJoin = 'round';
  const t = type === 'jelly' ? f / 8 * TAU / 6 : f / 8 * TAU / 18;
  if (type === 'jelly') jellyBody(g, col, false, t); else tofuBody(g, false, t);
  litPass(g, 100, 100, 95);
  if (flash) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(0, 0, 200, 200); }
  return (minionCache[key] = c);
}
function drawMinion(z, tx) {
  const T = ZT[z.type], t = (G ? G.t : demoT) + z.wob, k = z.r / 44;
  const hop = Math.abs(Math.sin(t * (z.type === 'tofu' ? 16 : 8)));
  ctx.fillStyle = 'rgba(29,18,56,.22)';
  ctx.beginPath(); ctx.ellipse(z.x, z.y + z.r * 0.95, z.r * 1.1, z.r * 0.4, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(z.x, z.y - hop * z.r * 0.3); ctx.scale((tx < z.x ? -1 : 1) * k, k);
  const sp = z.type === 'jelly' ? 6 : 18, f = Math.floor(((t * sp) % TAU + TAU) % TAU / TAU * 8) % 8;
  ctx.drawImage(minionFrame(z.type, z.type === 'jelly' ? (z.jcol || T.color) : '', f, z.flash > 0), -62.5, -65, 125, 125);
  ctx.restore();
}
function drawZombie(z, tx, ty) {
  if(z.def?.id==='goblin-chief'){drawModelMinion(z,tx);ctx.save();ctx.fillStyle='#ffd23f';ctx.font='bold 28px sans-serif';ctx.textAlign='center';ctx.fillText('♛',z.x,z.y-z.r*2.7);ctx.restore();return;}
  if (z.type === 'boss') { drawBoss(z, tx); return; }
  if (z.type === 'jelly' || z.type === 'tofu') { drawMinion(z, tx); return; }
  if (MONSTER3D[z.skin || z.type]) { drawModelMinion(z, tx); return; }
  drawWoolly(z, tx);
}
function drawOldBoss(z, tx, ty) {
  const T = ZT[z.type], a = Math.atan2(ty - z.y, tx - z.x), r = z.r;
  const wob = Math.sin((G ? G.t : demoT) * 8 + z.wob) * 0.12;
  ctx.fillStyle = 'rgba(29,18,56,.22)';
  ctx.beginPath(); ctx.ellipse(z.x, z.y + r * 0.75, r * 0.95, r * 0.4, 0, 0, TAU); ctx.fill();
  for (const s of [-1, 1]) circle(z.x + Math.cos(a + s * (0.62 + wob)) * r * 1.05, z.y + Math.sin(a + s * (0.62 + wob)) * r * 1.05, r * 0.34, T.dark, INK, 2.5);
  if (z.type === 'boss' && z.mode === 'prep') circle(z.x, z.y, r + 8, 'rgba(255,58,58,.35)');
  circle(z.x, z.y, r, z.flash > 0 ? '#ffffff' : T.color, INK, z.type === 'boss' ? 5 : 3);
  ctx.fillStyle = T.dark; ctx.globalAlpha = 0.45;
  ctx.beginPath(); ctx.arc(z.x - Math.cos(a) * r * 0.3, z.y - Math.sin(a) * r * 0.3, r * 0.55, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  const ex = Math.cos(a) * r * 0.38, ey = Math.sin(a) * r * 0.38, px = -Math.sin(a) * r * 0.32, py = Math.cos(a) * r * 0.32;
  for (const s of [-1, 1]) {
    const cx = z.x + ex + px * s, cy = z.y + ey + py * s;
    circle(cx, cy, r * 0.22, z.type === 'boss' ? '#ffe066' : '#fff8ec', INK, 2);
    circle(cx + Math.cos(a) * r * 0.08, cy + Math.sin(a) * r * 0.08, r * 0.1, INK);
  }
  if (z.type === 'tank' && z.hp < z.maxHp) {
    const w = r * 2;
    ctx.fillStyle = INK; ctx.fillRect(z.x - w / 2, z.y - r - 14, w, 7);
    ctx.fillStyle = '#ff5b3a'; ctx.fillRect(z.x - w / 2 + 1, z.y - r - 13, (w - 2) * Math.max(0, z.hp / z.maxHp), 5);
  }
  if (z.type === 'boss') {
    ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath();
    const cx = z.x, cy = z.y - r - 4;
    ctx.moveTo(cx - 24, cy + 6); ctx.lineTo(cx - 24, cy - 12); ctx.lineTo(cx - 12, cy - 2); ctx.lineTo(cx, cy - 18); ctx.lineTo(cx + 12, cy - 2); ctx.lineTo(cx + 24, cy - 12); ctx.lineTo(cx + 24, cy + 6); ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
}
// Le héros du Bastion : le modèle 3D photographié sous 16 angles et en 4 pas de marche, vu de 3/4 comme dans Dofus
const HS = { key: null, sheet: null, dirs: 16, frames: 5, size: 160, foot: 0, unit: 0 };
function heroSheet() {
  if (!window.THREE || !GRAD) return null;
  const key = [JSON.stringify(save.appearance),save.skin, save.cls, JSON.stringify(save.gear), JSON.stringify(save.cosm), JSON.stringify(save.colors), save.wskin, save.weapon, artOk('g_standard') ? 'art' : '', tribeId() && MODELS.w_viking ? tribeId() : ''].join('|');
  if (HS.key === key) return HS.sheet ? HS : null;
  HS.key = key; HS.sheet = null;
  initPreview(); if (!PV.r) return null;
  const T = THREE, N = HS.size, ext = 1.95;
  if (!HS.scene) {
    HS.scene = new T.Scene();
    HS.scene.add(new T.HemisphereLight('#fffaf0', '#6d5a8a', 0.78));
    const dl = new T.DirectionalLight('#fff0d0', 0.85); dl.position.set(-4, 7, 5); HS.scene.add(dl);
    HS.cam = new T.OrthographicCamera(-ext, ext, ext, -ext, 0.1, 60);
    const pitch = 0.6; HS.cam.position.set(0, 1.35 + Math.sin(pitch) * 20, Math.cos(pitch) * 20); HS.cam.lookAt(0, 1.35, 0);
    HS.cam.updateMatrixWorld(); HS.cam.updateProjectionMatrix();
    const f = new T.Vector3(0, 0, 0).project(HS.cam);
    HS.foot = (1 - f.y) / 2 * N; HS.unit = N / (ext * 2);
  }
  const mem = dcGet('hero:' + key); if (mem) { HS.sheet = mem; return HS; }
  if (HS.hero) { HS.scene.remove(HS.hero); if(HS.hero.userData.quaternius)CharacterModels.dispose(HS.hero);else HS.hero.traverse(o => { if (o.geometry && !o.userData.outline) o.geometry.dispose(); }); }
  HS.hero = buildHero3D(save.skin, CLASSES[save.cls].color); HS.scene.add(HS.hero);
  const sheet = document.createElement('canvas'); sheet.width = N * HS.dirs; sheet.height = N * HS.frames;
  const sg = sheet.getContext('2d');
  const pr = PV.r.getPixelRatio(), prev = PV.r.getSize(new T.Vector2());
  PV.r.setPixelRatio(1); PV.r.setSize(N, N, false);
  for (let f = 0; f < HS.frames; f++) {
    animHero(HS.hero, f ? (f - 1) * Math.PI / 2 + Math.PI / 4 : 0, f > 0, 1);
    for (let d = 0; d < HS.dirs; d++) {
      HS.hero.rotation.y = Math.PI / 2 - d / HS.dirs * TAU;
      PV.r.render(HS.scene, HS.cam);
      sg.drawImage(PV.r.domElement, d * N, f * N);
    }
  }
  PV.r.setPixelRatio(pr); PV.r.setSize(prev.x || 1, prev.y || 1, false);
  HS.sheet = sheet;
  if (key.endsWith('|art')) dcPut('hero:' + key, sheet, 'hero:');
  // image figée pour la carte graphique : envoyée une seule fois au lieu d'être relue à chaque image
  if (window.createImageBitmap) createImageBitmap(sheet).then(bm => { if (HS.key === key && HS.sheet === sheet) HS.sheet = bm; }).catch(() => {});
  return HS;
}
// Squelette du nécromancien en vue de dessus : le modèle 3D photographié sous 8 angles, dans chaque pose
// lignes : 0 attente · 1-4 course · 5-7 coup · 8-10 sortie de terre · 11-12 effondrement
const SKS = { sheet: null, dirs: 8, size: 128, foot: 0, unit: 0, tried: false };
const SKS_POSES = [['idle', 0.5], ['run', 0], ['run', 0.2], ['run', 0.4], ['run', 0.6], ['attack', 0.4], ['attack', 0.7], ['attack', 1.0],
  ['spawn', 0.6], ['spawn', 1.6], ['spawn', 2.8], ['death', 0.7], ['death', 1.8]];
function skelSheet() {
  if (SKS.sheet || SKS.tried) return SKS.sheet ? SKS : null;
  if (!window.THREE || !GRAD || !MODELS.skel) return null;
  SKS.tried = true;
  initPreview(); if (!PV.r) return null;
  const T = THREE, N = SKS.size, ext = 1.5;
  const scene = new T.Scene();
  scene.add(new T.HemisphereLight('#fffaf0', '#6d5a8a', 0.85));
  const dl = new T.DirectionalLight('#fff0d0', 0.9); dl.position.set(-4, 7, 5); scene.add(dl);
  const cam = new T.OrthographicCamera(-ext, ext, ext, -ext, 0.1, 60), pitch = 0.6;
  cam.position.set(0, 0.9 + Math.sin(pitch) * 20, Math.cos(pitch) * 20); cam.lookAt(0, 0.9, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const f0 = new T.Vector3(0, 0, 0).project(cam); SKS.foot = (1 - f0.y) / 2 * N; SKS.unit = N / (ext * 2);
  const m = skelModel(); if (!m) return null; scene.add(m);
  const I = m.userData.inst;
  const sheet = document.createElement('canvas'); sheet.width = N * SKS.dirs; sheet.height = N * SKS_POSES.length;
  const sg = sheet.getContext('2d'), pr = PV.r.getPixelRatio(), prev = PV.r.getSize(new T.Vector2());
  PV.r.setPixelRatio(1); PV.r.setSize(N, N, false);
  SKS_POSES.forEach(([name, time], row) => {
    I.mixer.stopAllAction(); const a = I.acts[name]; if (a) { a.reset().play(); I.mixer.setTime(time); }
    for (let d = 0; d < SKS.dirs; d++) {
      m.rotation.y = Math.PI / 2 - d / SKS.dirs * TAU;
      PV.r.render(scene, cam); sg.drawImage(PV.r.domElement, d * N, row * N);
    }
  });
  PV.r.setPixelRatio(pr); PV.r.setSize(prev.x || 1, prev.y || 1, false);
  m.traverse(o => { if (o.isMesh && o.material && o.material.isMeshBasicMaterial) o.material.dispose(); });
  SKS.sheet = sheet;
  if (window.createImageBitmap) createImageBitmap(sheet).then(bm => { SKS.sheet = bm; }).catch(() => {});
  return SKS;
}
const SKS_WALK = new WeakMap();
// En duo en ligne, le pseudo de chaque joueur au-dessus de sa tête (G.p est toujours l'hôte, G.ally l'invité)
function duoLabel(o) {
  if (!coop.active) return o === G.p ? 'J1' : 'J2';
  const mine = (o === G.p) === (session.role === 'host');
  return String(mine ? heroName(save) : (session.remoteProfile?.name || 'Ami')).slice(0, 16);
}
function drawPlayer(p) {
  const hs = heroSheet();
  if (p.inv > 0 && p.dashT <= 0 && ((G.t * 18) | 0) % 2) ctx.globalAlpha = 0.45;
  if (!hs) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1.18, 1.18);
    drawHero(ctx, 0, 0, p.aim, save.skin, CLASSES[save.cls].color, p.walk, p.moving || p.dashT > 0);
    ctx.restore(); ctx.globalAlpha = 1; return;
  }
  const N = hs.size, k = 33 / hs.unit, d = Math.round(((p.aim % TAU) + TAU) % TAU / TAU * hs.dirs) % hs.dirs;
  const moving = p.moving || p.dashT > 0, f = moving ? 1 + (Math.floor(p.walk / (Math.PI / 2)) % 4) : 0;
  const fy = p.y + 16, breathe = moving ? 1 : 1 + Math.sin(G.t * 2.4) * 0.015;
  ctx.save(); ctx.globalAlpha *= 0.28; ctx.fillStyle = '#1d1238';
  ctx.beginPath(); ctx.ellipse(p.x, fy, 24, 9, 0, 0, TAU); ctx.fill(); ctx.restore();
  if (p.dashT > 0) for (let i = 1; i <= 2; i++) {
    const gx = p.x - p.lastDx * 22 * i, gy = fy - p.lastDy * 22 * i;
    ctx.save(); ctx.globalAlpha = 0.25 / i; ctx.drawImage(hs.sheet, d * N, f * N, N, N, gx - N * k / 2, gy - hs.foot * k, N * k, N * k); ctx.restore();
  }
  ctx.save(); ctx.translate(p.x, fy); ctx.scale(1 / breathe, breathe);
  ctx.drawImage(hs.sheet, d * N, f * N, N, N, -N * k / 2, -hs.foot * k, N * k, N * k);
  ctx.restore();
  ctx.globalAlpha = 1;
}

// Personnage vu de dessus, tourné vers la visée (+x = devant, +y = côté droit)
function rrect(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
function seg(g, x1, y1, x2, y2) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
function drawHero(g, x, y, aim, skinId, clsColor, walk, moving) {
  const k = skinId === 'perso' ? persoSkin() : (SKINS[skinId] || SKINS.recrue);
  const outfit = k.outfit || clsColor, acc = k.accent, skin = k.skin;
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(29,18,56,.25)';
  g.beginPath(); g.ellipse(0, 16, 21, 8, 0, 0, TAU); g.fill();
  g.rotate(aim);
  g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = INK;
  // Pieds
  const st = moving ? Math.sin(walk) * 7 : 0;
  for (const s of [-1, 1]) {
    g.fillStyle = bootCol(); g.beginPath(); g.ellipse(st * s, s * 9, 7.5, 5, 0, 0, TAU); g.fill(); g.lineWidth = 2.5; g.stroke();
  }
  // Sac à dos
  g.fillStyle = acc; g.lineWidth = 3; rrect(g, -22, -10, 12, 20, 4); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(-20, -7, 3, 14);
  drawCapeTop(g, walk, moving);
  // Torse
  g.fillStyle = outfit; g.beginPath(); g.ellipse(-1, 0, 12.5, 19, 0, 0, TAU); g.fill(); g.lineWidth = 3.5; g.stroke();
  if (k.head === 'dino') {
    g.fillStyle = acc; g.lineWidth = 2;
    for (const sx of [-8, -15]) { g.beginPath(); g.moveTo(sx + 4, 0); g.lineTo(sx - 3, -4); g.lineTo(sx - 3, 4); g.closePath(); g.fill(); g.stroke(); }
  }
  // Épaulettes à la couleur de la classe
  for (const s of [-1, 1]) { g.fillStyle = clsColor; g.beginPath(); g.arc(-1, s * 15, 5.5, 0, TAU); g.fill(); g.lineWidth = 2.5; g.stroke(); }
  // Arme
  drawGunTop(g, acc);
  // Bras + mains
  for (const [sx, sy, hx, hy] of [[-1, -15, 30, 6], [-1, 15, 14, 9]]) {
    g.strokeStyle = INK; g.lineWidth = 10; seg(g, sx, sy, hx, hy);
    g.strokeStyle = outfit; g.lineWidth = 5; seg(g, sx, sy, hx, hy);
    g.strokeStyle = INK; g.fillStyle = skin; g.beginPath(); g.arc(hx, hy, 4.5, 0, TAU); g.fill(); g.lineWidth = 2; g.stroke();
  }
  // Tête
  const hx = 2, R = 11;
  g.lineWidth = 3;
  const hat = gearItem('hat');
  if (hat) drawHatTop(g, hat, hx, R, skin);
  else if (k.head === 'cap') {
    g.fillStyle = skin; g.beginPath(); g.arc(hx, 0, R, 0, TAU); g.fill();
    g.fillStyle = k.headCol; g.beginPath(); g.arc(hx, 0, R, Math.PI * 0.42, Math.PI * 1.58); g.closePath(); g.fill();
    g.beginPath(); g.ellipse(hx + 9, 0, 6, 9.5, 0, -Math.PI / 2, Math.PI / 2); g.fill(); g.stroke();
    g.beginPath(); g.arc(hx, 0, R, 0, TAU); g.stroke();
    g.fillStyle = clsColor; g.beginPath(); g.arc(hx - 3, 0, 3, 0, TAU); g.fill();
  } else if (k.head === 'mohawk') {
    g.fillStyle = skin; g.beginPath(); g.arc(hx, 0, R, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = k.headCol; g.lineWidth = 2;
    g.beginPath(); g.moveTo(hx - 13, 0);
    for (let i = 0; i < 5; i++) { const px = hx - 11 + i * 4.5; g.lineTo(px, i % 2 ? -4.5 : -2.5); }
    g.lineTo(hx + 9, 0);
    for (let i = 4; i >= 0; i--) { const px = hx - 11 + i * 4.5; g.lineTo(px, i % 2 ? 4.5 : 2.5); }
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = INK; rrect(g, hx + 6, -9, 5, 18, 2); g.fill();
    g.fillStyle = acc; g.fillRect(hx + 7, -7, 2, 5); g.fillRect(hx + 7, 2, 2, 5);
  } else if (k.head === 'hood') {
    const fl = Math.sin(walk * 0.7) * 3;
    g.strokeStyle = acc; g.lineWidth = 3;
    seg(g, hx - 9, -2, hx - 24, -5 + fl); seg(g, hx - 9, 2, hx - 22, 6 - fl);
    g.strokeStyle = INK; g.lineWidth = 3;
    g.fillStyle = k.headCol; g.beginPath(); g.arc(hx, 0, R + 1, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = skin; g.beginPath(); g.ellipse(hx + 6.5, 0, 4, 7.5, 0, 0, TAU); g.fill();
    g.fillStyle = acc; g.fillRect(hx + 2, -10.5, 3.5, 21);
    g.fillStyle = INK; g.fillRect(hx + 8, -5, 2, 3); g.fillRect(hx + 8, 2, 2, 3);
  } else if (k.head === 'helmet') {
    g.fillStyle = k.headCol; g.beginPath(); g.arc(hx, 0, R + 1, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = k.visor; g.beginPath(); g.arc(hx, 0, R - 1, -1.15, 1.15); g.arc(hx, 0, 5, 1.15, -1.15, true); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(hx + 6, -6, 2, 4);
    g.strokeStyle = 'rgba(29,18,56,.35)'; g.lineWidth = 2; seg(g, hx - 9, 0, hx + 3, 0);
    if (k.crown) {
      g.fillStyle = acc; g.strokeStyle = INK; g.lineWidth = 2;
      g.beginPath(); g.moveTo(hx - 7, -6); g.lineTo(hx - 3, -2.5); g.lineTo(hx - 7, 0); g.lineTo(hx - 3, 2.5); g.lineTo(hx - 7, 6); g.lineTo(hx + 1, 4); g.lineTo(hx + 1, -4); g.closePath(); g.fill(); g.stroke();
    }
  } else if (k.head === 'dino') {
    g.fillStyle = k.headCol; g.beginPath(); g.arc(hx, 0, R + 1, 0, TAU); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(hx + 11, 0, 7, 8, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(hx + 15, -3, 1.3, 0, TAU); g.arc(hx + 15, 3, 1.3, 0, TAU); g.fill();
    for (const s of [-1, 1]) { g.fillStyle = '#fff8ec'; g.beginPath(); g.arc(hx + 4, s * 6.5, 3.6, 0, TAU); g.fill(); g.lineWidth = 2; g.stroke(); g.fillStyle = INK; g.beginPath(); g.arc(hx + 5.5, s * 6.5, 1.6, 0, TAU); g.fill(); }
    g.fillStyle = acc; g.strokeStyle = INK; g.lineWidth = 2;
    g.beginPath(); g.moveTo(hx - 2, 0); g.lineTo(hx - 9, -4); g.lineTo(hx - 9, 4); g.closePath(); g.fill(); g.stroke();
  } else headTopExtra(g, k, hx, R, skin);
  g.restore();
}
function paintHero(cnv, skinId, clsColor) {
  const g = cnv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cnv.width, cnv.height);
  const sc = cnv.width / 60;
  g.setTransform(sc, 0, 0, sc, cnv.width / 2, cnv.height / 2);
  drawHero(g, -6, 8, -Math.PI / 2 + 0.5, skinId, clsColor, 0, false);
}
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = biome ? biome.B.out : '#24164f'; ctx.fillRect(0, 0, W, H);
  if (!G) return;
  const p = coop.active && session.role === 'guest' ? G.ally : G.p;
  const sx = G.shake ? rnd(-G.shake, G.shake) : 0, sy = G.shake ? rnd(-G.shake, G.shake) : 0;
  if(G.dungeon)S=Math.min(W/1020,H/810);
  const vw = W / S, vh = H / S;
  const camX = G.dungeon ? WORLD/2-vw/2 : vw >= WORLD + 80 ? (WORLD - vw) / 2 : clamp(p.x - vw / 2, -40, WORLD - vw + 40);
  const camY = G.dungeon ? WORLD/2-vh/2 : vh >= WORLD + 80 ? (WORLD - vh) / 2 : clamp(p.y - vh / 2, -40, WORLD - vh + 40);
  const vx = camX + sx, vy = camY + sy;
  ctx.save(); ctx.scale(S, S); ctx.translate(-vx, -vy);
  if(G.dungeon)drawDungeonFloor();else drawFloor(vx, vy, vw, vh);
  const inView = (x, y, m) => x > vx - m && x < vx + vw + m && y > vy - m && y < vy + vh + m;

  for (const b of G.blasts) {
    const k = b.t / 0.4;
    ctx.globalAlpha = 1 - k;
    circle(b.x, b.y, b.r * (0.4 + 0.6 * k), null, b.color, 10 * (1 - k) + 2);
    ctx.globalAlpha = (1 - k) * 0.35; circle(b.x, b.y, b.r * (0.4 + 0.6 * k), b.color);
    ctx.globalAlpha = 1;
  }
  for (const k of G.pickups) {
    if (!inView(k.x, k.y, 20)) continue;
    const bob = Math.sin(G.t * 6 + k.x) * 2;
    if (k.kind === 'life') { circle(k.x,k.y+bob,13,'#3df5b0',INK,2); ctx.save(); ctx.fillStyle=INK; ctx.font='bold 16px sans-serif'; ctx.textAlign='center'; ctx.fillText('+1',k.x,k.y+bob+5); ctx.restore(); }
    else if (k.kind === 'gem') {
      const c = k.v >= 5 ? '#ff4fa3' : k.v >= 2 ? '#3df5b0' : '#3db8ff', s = k.v >= 5 ? 9 : 7;
      ctx.fillStyle = c; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(k.x, k.y - s + bob); ctx.lineTo(k.x + s * 0.75, k.y + bob); ctx.lineTo(k.x, k.y + s + bob); ctx.lineTo(k.x - s * 0.75, k.y + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (k.kind === 'coin') {
      circle(k.x, k.y + bob, 8, '#ffd23f', INK, 2.5); circle(k.x, k.y + bob, 3.5, '#e0a800');
    } else {
      ctx.fillStyle = '#ff4f6d'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      const x = k.x, y = k.y + bob;
      ctx.beginPath(); ctx.moveTo(x, y + 9); ctx.bezierCurveTo(x - 16, y - 2, x - 8, y - 14, x, y - 5); ctx.bezierCurveTo(x + 8, y - 14, x + 16, y - 2, x, y + 9); ctx.fill(); ctx.stroke();
    }
  }
  for (const t of G.turrets) {
    if (t.kind === 'skel') { drawSkel(t); continue; }
    circle(t.x, t.y, 22, '#3a3550', INK, 3);
    ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.aim);
    ctx.fillStyle = '#3db8ff'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.fillRect(0, -6, 30, 12); ctx.strokeRect(0, -6, 30, 12);
    ctx.restore();
    circle(t.x, t.y, 12, '#3db8ff', INK, 3);
    ctx.fillStyle = INK; ctx.fillRect(t.x - 20, t.y + 28, 40, 6);
    ctx.fillStyle = '#3df5b0'; ctx.fillRect(t.x - 19, t.y + 29, 38 * (t.life / 15), 4);
  }
  for (const z of G.zombies) if (z.tele && inView(z.x, z.y, z.r + 30)) drawTele(z);
  // squelette du nécromancien (vue de dessus) : corps en os, crâne aux yeux violets, jauge de durée de vie
  function drawSkel(t) {
    const sk = skelSheet();
    if (sk) {
      const moving = SKS_WALK.get(t) !== t.walk; SKS_WALK.set(t, t.walk);
      const age = t.age || 0, row = t.life < 0.6 ? (t.life > 0.3 ? 11 : 12)
        : age < 1.1 ? 8 + Math.min(2, Math.floor(age / 1.1 * 3))
        : t.atkT > 0 ? 5 + Math.min(2, Math.floor((0.5 - t.atkT) / 0.5 * 3))
        : moving ? 1 + (Math.floor(t.walk / (Math.PI / 2)) % 4) : 0;
      const N = sk.size, k = 40 / sk.unit, d = Math.round(((t.aim % TAU) + TAU) % TAU / TAU * sk.dirs) % sk.dirs, fy = t.y + 14;
      ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = '#5a2a9a';
      ctx.beginPath(); ctx.ellipse(t.x, fy, 20, 8, 0, 0, TAU); ctx.fill(); ctx.restore();
      if (age < 1.1) { ctx.save(); ctx.globalAlpha = 0.5 * (1 - age / 1.1); circle(t.x, fy, 26 * (0.6 + age / 1.1), 'rgba(155,92,255,.35)', '#9b5cff', 3); ctx.restore(); }
      ctx.drawImage(sk.sheet, d * N, row * N, N, N, t.x - N * k / 2, fy - sk.foot * k, N * k, N * k);
      ctx.fillStyle = INK; ctx.fillRect(t.x - 16, fy + 8, 32, 5);
      ctx.fillStyle = '#b78cff'; ctx.fillRect(t.x - 15, fy + 9, 30 * Math.max(0, t.life / 12), 3);
      return;
    }
    const fade = Math.min(1, t.life * 2), sw = Math.sin(t.walk) * 4;
    ctx.globalAlpha = fade;
    ctx.globalAlpha = fade * 0.35; circle(t.x, t.y + 4, 20, 'rgba(155,92,255,.35)'); ctx.globalAlpha = fade;
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.fillStyle = '#efe8d8';
    ctx.fillRect(t.x - 9 + sw * 0.3, t.y - 4, 5, 16); ctx.strokeRect(t.x - 9 + sw * 0.3, t.y - 4, 5, 16);
    ctx.fillRect(t.x + 4 - sw * 0.3, t.y - 4, 5, 16); ctx.strokeRect(t.x + 4 - sw * 0.3, t.y - 4, 5, 16);
    circle(t.x, t.y - 10, 11, '#efe8d8', INK, 3);
    circle(t.x, t.y - 27, 12, '#f6f1e4', INK, 3);
    circle(t.x - 4.5, t.y - 28, 3.2, '#9b5cff'); circle(t.x + 4.5, t.y - 28, 3.2, '#9b5cff');
    ctx.fillStyle = INK; ctx.fillRect(t.x - 4, t.y - 21, 8, 2);
    ctx.fillRect(t.x - 16, t.y + 18, 32, 5);
    ctx.fillStyle = '#b78cff'; ctx.fillRect(t.x - 15, t.y + 19, 30 * Math.max(0, t.life / 12), 3);
    ctx.globalAlpha = 1;
  }
  if (G.slowR) { ctx.globalAlpha = 0.3; circle(p.x, p.y, G.slowR, 'rgba(191,232,255,.12)', '#bfe8ff', 3); ctx.globalAlpha = 1; }
  if (p.aura) { ctx.globalAlpha = 0.35 + Math.sin(G.t * 6) * 0.12; circle(p.x, p.y, 78, 'rgba(255,122,31,.12)', '#ff7a1f', 4); ctx.globalAlpha = 1; }
  // Tout ce qui est debout est dessiné du fond vers le devant : on peut passer derrière un arbre
  const depth = [];
  for (const d of (G.dungeon?[]:biome.tall)) if (d.x > vx - 120 && d.x < vx + vw + 120 && d.y > vy - 20 && d.y < vy + vh + 220) depth.push(d);
  for (const z of G.zombies) if (inView(z.x, z.y, z.r + 30)) depth.push(z);
  depth.push(G.p); if (G.ally) depth.push(G.ally); if (G.pet) depth.push(G.pet);
  depth.sort((a, b) => a.y - b.y);
  ctx.save(); ctx.beginPath(); ctx.rect(-30, -200, WORLD + 60, WORLD + 230); ctx.clip();
  for (const o of depth) {
    if (o === G.p || o === G.ally) {
      drawPlayer(o);
      if (G.ally) { circle(o.x, o.y + 14, 25, null, o === G.p ? '#ffd23f' : '#3db8ff', 3); ctx.save(); ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.textAlign = 'center'; ctx.font = 'bold 14px sans-serif'; const label = duoLabel(o); ctx.strokeText(label, o.x, o.y - 48); ctx.fillText(label, o.x, o.y - 48); ctx.restore(); }
    }
    else if (o === G.pet) drawPetGame();
    else if (o.deco) {
      // Le feuillage devient transparent quand le héros est caché derrière
      const pI = biomeIdx, pD = DSPR, oB = o.bi === undefined ? biome.B : BIOMES[o.bi % BIOMES.length];
      if (o.bi !== undefined) { biomeIdx = o.bi; DSPR = DSPR_ALL[o.bi % BIOMES.length] || (DSPR_ALL[o.bi % BIOMES.length] = {}); }
      const sp = decorSprite(o.type, oB, o.c % 4), hw = sp.w * o.s * 0.42;
      const hid = p.y < o.y - 4 && p.y > o.y - sp.h * o.s && Math.abs(p.x - o.x) < hw;
      o.fade = (o.fade === undefined ? 1 : o.fade) + ((hid ? 0.42 : 1) - (o.fade === undefined ? 1 : o.fade)) * 0.2;
      drawTall(o, oB, G.t, o.fade);
      biomeIdx = pI; DSPR = pD;
    } else drawZombie(o, p.x, p.y);
  }
  ctx.restore();
  if(!G.dungeon&&save.gfx!=='fast')drawClouds(vx, vy, vw, vh, G.t);
  for (let i = 0; i < p.drones; i++) {
    const a = G.t * 1.6 + i * TAU / p.drones;
    const dx = p.x + Math.cos(a) * 46, dy = p.y + Math.sin(a) * 46 - 10;
    circle(dx, dy, 9, '#8fd8ff', INK, 2.5); circle(dx, dy, 3, INK);
  }
  if (p.orbs > 0) for (let i = 0; i < p.orbs; i++) {
    const a = G.t * 3 + i * TAU / p.orbs, ox = p.x + Math.cos(a) * 80, oy = p.y + Math.sin(a) * 80;
    circle(ox, oy, 16, 'rgba(180,107,255,.3)'); circle(ox, oy, 10, '#e3c8ff', '#b46bff', 3);
  }
  for (const g of G.grenades) {
    const k = g.t / g.dur, x = g.x0 + (g.x1 - g.x0) * k, y = g.y0 + (g.y1 - g.y0) * k - Math.sin(k * Math.PI) * 70;
    circle(g.x1, g.y1, 115 * (0.3 + 0.7 * k), null, 'rgba(255,210,63,.5)', 3);
    circle(x, y, 9, '#3a8f3a', INK, 3);
  }
  ctx.lineCap = 'round';
  // Les balles volent à hauteur d'arme (petite ombre au sol) et brillent
  const BH = 26;
  ctx.fillStyle = 'rgba(30,20,50,.18)';
  for (const b of G.bullets) { ctx.beginPath(); ctx.ellipse(b.x, b.y, 5, 2.2, 0, 0, TAU); ctx.fill(); }
  for (const b of G.bullets) {
    const l = 0.03, by = b.y - BH, col = b.col || (b.crit ? '#ff4fa3' : '#ffd23f');
    if (b.fire) { circle(b.x, by, b.crit ? 10 : 8, '#ff5a1f'); circle(b.x, by, b.crit ? 6 : 4.5, '#ffe066'); continue; }
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35;
    ctx.strokeStyle = col; ctx.lineWidth = (b.crit ? 18 : 14) * b.r / 6;
    ctx.beginPath(); ctx.moveTo(b.x - b.vx * l, by - b.vy * l); ctx.lineTo(b.x, by); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.lineWidth = (b.crit ? 8 : 6) * b.r / 6;
    ctx.beginPath(); ctx.moveTo(b.x - b.vx * l * 0.8, by - b.vy * l * 0.8); ctx.lineTo(b.x, by); ctx.stroke();
    ctx.strokeStyle = '#fffbe8'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(b.x - b.vx * l * 0.5, by - b.vy * l * 0.5); ctx.lineTo(b.x, by); ctx.stroke();
  }
  ctx.lineCap = 'butt';
  for (const e of G.ebullets) { if (e.col) { circle(e.x, e.y, e.r, e.col, INK, 2.5); circle(e.x - e.r * 0.3, e.y - e.r * 0.3, e.r * 0.3, 'rgba(255,255,255,.6)'); continue; } circle(e.x, e.y, e.r, '#ff8fc8', INK, 2.5); circle(e.x - 3, e.y - 3, 3.5, '#ffe3f1'); circle(e.x + 3, e.y + 2, 2.5, '#ffe3f1'); }
  updateAmbient(Math.min(0.05, G.t - (G.ambT || G.t)), vx, vy, vw, vh); G.ambT = G.t;
  if(!G.dungeon&&save.gfx!=='fast')drawAmbient();
  for (const q of G.parts) {
    const k = Math.max(0, q.life / q.max); ctx.globalAlpha = k;
    if (q.kind === 'flash') {
      // Éclair au bout du canon
      ctx.save(); ctx.translate(q.x, q.y - 26); ctx.rotate(q.a); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#ffcf4a'; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, -9); ctx.lineTo(26, 0); ctx.lineTo(4, 9); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fffbe0'; ctx.beginPath(); ctx.arc(2, 0, 7, 0, TAU); ctx.fill();
      ctx.restore();
    } else if (q.kind === 'spark') {
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = q.color; ctx.lineWidth = q.r * k + 0.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 0.04, q.y - q.vy * 0.04); ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
    } else if (q.kind === 'wool') {
      const r = q.r * (0.6 + 0.4 * k);
      ctx.fillStyle = '#2a1830'; ctx.beginPath(); ctx.arc(q.x, q.y, r + 1.6, 0, TAU); ctx.fill();
      ctx.fillStyle = q.shade; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x - r * 0.2, q.y - r * 0.25, r * 0.72, 0, TAU); ctx.fill();
    } else circle(q.x, q.y, q.r * (0.5 + 0.5 * k), q.color);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  for (const t of G.texts) {
    ctx.globalAlpha = Math.min(1, t.life * 3);
    ctx.font = (t.crit ? 24 : 18) + 'px "Lilita One", Impact, sans-serif';
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText(t.txt, t.x, t.y);
    ctx.fillStyle = t.crit ? '#ffd23f' : '#fff8ec'; ctx.fillText(t.txt, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  // Flèche vers le boss hors écran
  if (G.boss && !inView(G.boss.x, G.boss.y, -20)) {
    const a = Math.atan2(G.boss.y - p.y, G.boss.x - p.x), R = Math.min(vw, vh) / 2 - 40;
    ctx.save(); ctx.translate(p.x + Math.cos(a) * R, p.y + Math.sin(a) * R); ctx.rotate(a);
    ctx.fillStyle = '#ff5b3a'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -12); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  drawLight();
  if (G.zoneFlash > 0) { ctx.fillStyle = `rgba(255,255,255,${(G.zoneFlash * 0.85).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
  // Joystick
  if (joy.id !== null) {
    ctx.globalAlpha = 0.5; circle(joy.ox, joy.oy, 62, 'rgba(29,18,56,.45)', '#fff8ec', 3);
    ctx.globalAlpha = 0.9; circle(joy.ox + joy.dx * 62, joy.oy + joy.dy * 62, 28, '#fff8ec', INK, 3);
    ctx.globalAlpha = 1;
  }
}

let demoT = 0;

// ---------- Interface ----------
const setText = (() => { const cache = {}; return (id, v) => { if (cache[id] !== v) { cache[id] = v; $(id).textContent = v; } }; })();
function updateHud() {
  const p = coop.active && session.role === 'guest' ? {...G.ally, hp:G.p.hp, maxHp:G.p.maxHp} : G.p;
  $('hpFill').style.width = (p.hp / p.maxHp * 100).toFixed(1) + '%';
  setText('hpText', Math.ceil(p.hp) + ' / ' + Math.round(p.maxHp));
  $('xpFill').style.width = Math.min(100,G.xp / G.xpNext * 100).toFixed(1) + '%';
  setText('lvlText', 'Niv. ' + G.level);
  const waitUp = !G.dungeon && G.xp >= G.xpNext && !G.pending;
  setText('xpText', waitUp ? 'Prêt · fin de vague ' + (G.upgradedWave !== G.wave && upgradeWave(G.wave) && G.waveState === 'fight' ? G.wave : nextUpgradeWave(G.wave)) : Math.floor(G.xp) + ' / ' + G.xpNext);
  setText('waveText', G.dungeon?'Salle '+G.dungeon.room+' / 5':(G.wave ? 'Vague ' + G.wave : 'Prépare-toi') + (G.duo ? ' · ♥ ' + G.lives : ''));
  setText('leftText', G.waveState === 'fight' ? (G.toSpawn + G.zombies.length) + ' monstres restants' : 'Prochaine vague…');
  setText('killText', String(G.kills));
  setText('coinRunText', String(G.coinsRun));
  $('bDash').style.setProperty('--cd', (p.dashCd / p.dashCdMax).toFixed(3));
  $('bGren').style.setProperty('--cd', (p.grenCd / p.grenCdMax).toFixed(3));
  $('bUlt').style.setProperty('--cd', (p.ultCd / p.ultCdMax).toFixed(3));
  $('bUlt').classList.toggle('ready', p.ultCd <= 0);
  const bb = $('bossBar');
  const bs = G.boss ? G.zombies.filter(o => o.type === 'boss' && !o.dead) : [];
  if (bs.length) { bb.hidden = false; setText('bossName', bs.map(o => o.name).join(' · ')); $('bossFill').style.width = (bs.reduce((s, o) => s + Math.max(0, o.hp), 0) / bs.reduce((s, o) => s + o.maxHp, 0) * 100).toFixed(1) + '%'; }
  else bb.hidden = true;
}
let bannerTimer = null;
function banner(big, sub) {
  const b = $('banner');
  $('bannerBig').textContent = big; $('bannerSub').textContent = sub || '';
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.remove('show'), 2300);
}
function showOnly(name) {
  const vil = name === 'village';
  if (vil && UPD.ready) setTimeout(forceUpdate, 600);   // mise à jour obligatoire en attente : on l'installe au retour au village
  $('village').hidden = !vil; $('vhud').hidden = !vil; $('game').hidden = vil;
  if (!vil) for (const id of ['portalM', 'classesM', 'skinsM']) $(id).hidden = true;
  $('hud').hidden = !(name === 'play' || name === 'levelup' || name === 'pause');
  $('levelup').hidden = name !== 'levelup';
  $('pause').hidden = name !== 'pause';
  $('over').hidden = name !== 'over';
}
function resetJoy() { joy.id = null; joy.dx = joy.dy = 0; }

function refreshSoundBtn() { $('soundBtn').textContent = 'Son : ' + (save.sound ? 'oui' : 'non'); }
$('soundBtn').addEventListener('click', () => { save.sound = !save.sound; persist(); refreshSoundBtn(); if (save.sound) sfx('coin'); });
$('pmClassBtn').addEventListener('click', () => openModal('classesM'));
const DIFFS = {
  easy:   { name: 'Facile',   hp: 0.7, dmg: 0.6, spawn: 0.85, reward: 0.7, gems: 1, desc: 'Monstres plus faibles et moins nombreux · pièces ×0,7' },
  normal: { name: 'Moyen',    hp: 1,   dmg: 1,   spawn: 1,    reward: 1,   gems: 1, desc: 'Le jeu tel qu\u2019il est prévu' },
  hard:   { name: 'Hardcore', hp: 2.4, dmg: 2.2, spawn: 1.7,  speed: 1.22, reward: 2.2, gems: 3, noHearts: true, php: 0.8, regen: 0.5, desc: 'Vrai mode hardcore : monstres ×2,4 PV et ×2,2 dégâts, plus rapides et bien plus nombreux, aucun cœur de soin (sauf sur les boss), ton héros a 20 % de PV en moins et récupère deux fois moins vite · pièces ×2,2 · gemmes ×3' },
};
const diffOf = () => {
  const id = G && G.runDiff || save.diff || 'normal', base = DIFFS[id] || DIFFS.normal;
  if (!(G && G.duo) && !(coop.active && coop.mode === 'bastion')) return base;
  const combat = id === 'easy' ? DIFFS.normal : id === 'normal' ? DIFFS.hard : {...DIFFS.hard, hp:3.4, dmg:3.2, spawn:2.7};
  return {...combat, name:base.name + ' · Duo', reward:base.reward, gems:base.gems};
};
function refreshDiff() {
  document.querySelectorAll('#diffRow [data-diff]').forEach(b => { b.classList.toggle('sel', b.dataset.diff === (save.diff || 'normal')); b.setAttribute('aria-checked', b.dataset.diff === save.diff); });
  $('diffInfo').textContent = diffOf().desc;
}
$('diffRow').addEventListener('click', e => { const b = e.target.closest('[data-diff]'); if (b) { save.diff = b.dataset.diff; persist(); refreshDiff(); } });
refreshDiff();
function refreshCamBtn() { $('vCam').textContent = 'Vue : ' + (save.camMode === 'fp' ? '1re personne' : '3e personne'); }
$('vCam').addEventListener('click', () => {
  save.camMode = save.camMode === 'fp' ? 'tp' : 'fp'; persist(); refreshCamBtn();
  if (V.ok) { V.camera.near = save.camMode === 'fp' ? 0.1 : 0.5; V.camera.updateProjectionMatrix(); placeHeroCam(true); }
});
const toggleGfx = () => { save.gfx = save.gfx === 'fast' ? 'pretty' : 'fast'; save.gfxManual = true; persist(); applyGfx(); };
$('vGfx').addEventListener('click', toggleGfx);
$('pmGfx').addEventListener('click', toggleGfx);
refreshCamBtn();
$('vTest').addEventListener('click', () => {
  if (!save.testMode) { $('testM').hidden=false; $('testCode').value=''; $('testMsg').textContent=''; return; }
  save.testMode = false;
  if (!save.testMode) { save.coins = 500; save.gems = 10; }
  persist(); updateVhud(); renderPanel();
  banner(save.testMode ? 'Mode test' : 'Mode normal', save.testMode ? 'Pièces et gemmes illimitées' : 'Tu repars avec 500 pièces et 10 gemmes');
});
let wolfDuoEngine=null, wolfDuoView=null, wolfRewarded=false;
function beginWolfDuo(){
  if(!session.ready || session.role!=='host' || coop.active)return;
  leaveVisit();coop.mode='wolf';coop.active=true;coop.run++;wolfRewarded=false;
  wolfDuoEngine=new WolfDuo();pushWolfDuo();
}
function pushWolfDuo(){
  if(!wolfDuoEngine)return;
  showWolfDuo(wolfDuoEngine.view(0));
  session.send({type:'wolfView',run:coop.run,view:wolfDuoEngine.view(1)});
}
function receiveWolfDuo(msg){
  if(msg.type==='wolfAction' && session.role==='host' && coop.active && coop.mode==='wolf' && msg.run===coop.run){
    if(wolfDuoEngine?.act(1,msg.token,msg.choice))pushWolfDuo();return;
  }
  if(msg.type==='wolfView' && session.role==='guest'){
    if(!Number.isInteger(msg.run) || (coop.active && (coop.mode!=='wolf'||msg.run!==coop.run)))return;
    const v=msg.view;if(!v || !Array.isArray(v.players) || v.players.length!==9 || v.seat!==1 || !Array.isArray(v.log))return;
    if(!coop.active){leaveVisit();coop.active=true;coop.mode='wolf';coop.run=msg.run;wolfRewarded=false;}
    showWolfDuo(v);
  }
}
function wolfDuoChoose(value){
  if(!wolfDuoView?.prompt)return;
  if(session.role==='host'){if(wolfDuoEngine.act(0,wolfDuoView.token,value))pushWolfDuo();}
  else {session.send({type:'wolfAction',run:coop.run,token:wolfDuoView.token,choice:value});$('wdChoices').replaceChildren();$('wdPrompt').textContent='Choix envoyé…';}
}
function showWolfDuo(view){
  wolfDuoView=view;state='wolfduo';resetJoy();resetVjoy();
  for(const id of ['coopM','portalM','vhud','hud','pause','over','levelup'])$(id).hidden=true;
  $('wolfDuoGame').hidden=false;
  $('wdPhase').textContent=view.winner?'Partie terminée':(view.phase==='reveal'?'Distribution des rôles':( ['discussion','vote','hunter'].includes(view.phase)?'Jour ':'Nuit ')+view.day);
  const me=view.players[view.seat],role=WROLES[me.role];
  $('wdRole').textContent='Ton rôle : '+(role?.name||me.role)+(me.alive?'':' · spectateur');
  $('wdRoleHelp').textContent=role?.desc||'';
  $('wdPlayers').replaceChildren();
  for(const player of view.players){
    const card=document.createElement('div');card.className='wd-seat'+(player.alive?'':' dead');
    const name=document.createElement('b');name.textContent=player.name+(player.id===view.seat?' (toi)':'');
    const info=document.createElement('span');info.textContent=player.role?(WROLES[player.role]?.name||player.role):'Rôle secret';
    const icon=document.createElement('span');icon.className='wd-face';icon.textContent=!player.alive?'🪦':player.id<2?'🧑':'👤';
    card.append(icon,name,info);$('wdPlayers').appendChild(card);
  }
  $('wdLog').replaceChildren();for(const line of view.log){const row=document.createElement('p');row.textContent=line;$('wdLog').appendChild(row);}
  $('wdLog').scrollTop=$('wdLog').scrollHeight;
  $('wdPrompt').textContent=view.prompt?.text||(view.winner?(view.won?'Ton camp a gagné !':'Ton camp a perdu.'):'Attends les autres joueurs…');
  $('wdChoices').replaceChildren();
  if(view.prompt){
    const groups={};
    for(const option of view.prompt.options){
      let parent=$('wdChoices');
      if(option.kind && view.prompt.options.filter(o=>o.kind===option.kind).length>1){
        if(!groups[option.kind]){const detail=document.createElement('details'),summary=document.createElement('summary');summary.textContent=WolfSocial.KIND_LABELS[option.kind];detail.appendChild(summary);parent.appendChild(detail);groups[option.kind]=detail;}
        parent=groups[option.kind];
      }
      const button=document.createElement('button');button.className='btn alt';button.textContent=option.label;button.onclick=()=>wolfDuoChoose(option.value);parent.appendChild(button);
    }
  }
  $('wdVotes').replaceChildren();
  for(const vote of view.votes||[]){const row=document.createElement('p');row.textContent='Jour '+vote.day+' : '+Object.entries(vote.choices).map(([id,target])=>view.players[id].name+' → '+view.players[target].name).join(' · ');$('wdVotes').appendChild(row);}
  if(view.winner&&!wolfRewarded){wolfRewarded=true;save.coins+=view.won?80:25;save.gems+=view.won?3:0;save.wolfWins=(save.wolfWins||0)+(view.won?1:0);persist();}
  $('wdReward').textContent=view.winner?(view.won?'+80 pièces · +3 gemmes':'+25 pièces'):'';
}
$('wdQuit').addEventListener('click',toVillage);
let testAttempts=0, testBlockedUntil=0;
$('testUnlock').addEventListener('click', () => {
  if(Date.now()<testBlockedUntil){$('testMsg').textContent='Patiente une minute avant de réessayer.';return;}
  if($('testCode').value !== BUNKER.code){testAttempts++;if(testAttempts>=5){testBlockedUntil=Date.now()+60000;testAttempts=0;}$('testMsg').textContent='Code incorrect.';return;}
  testUnlocked=true; testAttempts=0; save.testMode=true; persist(); updateVhud(); renderPanel(); $('testM').hidden=true; banner('Mode test','Activé pour cette session');
});
$('fsBtn').addEventListener('click', () => {
  const el = document.documentElement;
  try {
    const r = el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen && el.webkitRequestFullscreen();
    if (r && r.then) r.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }).catch(() => {});
  } catch (e) {}
});

let wakeLock = null;
function startGame() {
  stopCoop();
  newRun();refreshSpeedBtn();FP.yaw=-Math.PI/2;if(save.cls==='necro')setTimeout(skelSheet,400);
  if (G.potions.length) setTimeout(() => banner('', 'Potions bues : ' + G.potions.map(id => POTIONS[id].ico + ' ' + POTIONS[id].desc).join(' · ')), 1800);
  $('ultLabel').textContent = CLASSES[save.cls].ult;
  resetJoy();
  state = 'play'; showOnly('play');
  sfx('level');
  try { navigator.wakeLock && navigator.wakeLock.request('screen').then(w => wakeLock = w).catch(() => {}); } catch (e) {}
}
$('playBtn').addEventListener('click', startGame);
$('againBtn').addEventListener('click', startGame);
$('menuBtn').addEventListener('click', toVillage);
$('vFallback').addEventListener('click', () => openModal('portalM'));
function toVillage() {
  for(const id of ['dungeonIntro','dungeonClear','dungeonReport'])$(id).hidden=true;
  stopCoop();
  G = null;resize();refreshSpeedBtn(); state = 'village'; resetJoy(); showOnly('village');
  setTimeout(() => { if (state === 'village') setBiome(0); }, 1500);
  if (V.ok) { resetVjoy(); V.P.x = 0; V.P.z = -11; V.P.rot = 0; placeHeroCam(true); updateVhud(); }
  try { wakeLock && wakeLock.release(); } catch (e) {} wakeLock = null;
}

const DUNGEON_BOUNDS={x:750,y:875,w:900,h:650};
const combatBounds=()=>G?.dungeon?DUNGEON_BOUNDS:{x:0,y:0,w:WORLD,h:WORLD};
let dungeonDiff='normal';
function openDungeon(){
  if(session.ready){banner('Donjon en solo','Quitte la session Amis pour commencer ce chapitre.');return;}
  $('portalM').hidden=true;$('dungeonIntro').hidden=false;
  const done=dungeonDone();dungeonDiff=dungeonUnlocked(save.diff)?save.diff:[...DUNGEON_ORDER].reverse().find(dungeonUnlocked);refreshDungeonDiff();
  $('dungeonProgress').textContent=done.hard?'Chapitre terminé dans les trois modes · Tu peux le rejouer.':done.normal?'Mode moyen terminé · Le mode hardcore est ouvert.':done.easy?'Mode facile terminé · Le mode moyen est ouvert.':'Commence par le mode facile.';
}
// Facile, puis moyen, puis hardcore : chaque mode s'ouvre quand le précédent est terminé
const DUNGEON_ORDER=['easy','normal','hard'];
function dungeonDone(){const st=save.story=save.story||{};if(!st.dungeonDone)st.dungeonDone=st.goblinCleared?{easy:true}:{};return st.dungeonDone;}
function dungeonUnlocked(dd){const i=DUNGEON_ORDER.indexOf(dd);return i===0||(i>0&&!!dungeonDone()[DUNGEON_ORDER[i-1]]);}
function refreshDungeonDiff(){for(const b of $('dungeonDiff').querySelectorAll('button')){b.classList.toggle('sel',b.dataset.dd===dungeonDiff);b.classList.toggle('locked',!dungeonUnlocked(b.dataset.dd));b.setAttribute('aria-checked',String(b.dataset.dd===dungeonDiff));b.textContent=(dungeonUnlocked(b.dataset.dd)?'':'🔒 ')+DIFFS[b.dataset.dd].name+(dungeonDone()[b.dataset.dd]?' ✓':'');}}
$('dungeonDiff').onclick=e=>{const b=e.target.closest('[data-dd]');if(!b)return;
  if(!dungeonUnlocked(b.dataset.dd)){const prev=DUNGEON_ORDER[DUNGEON_ORDER.indexOf(b.dataset.dd)-1];$('dungeonProgress').textContent='Mode '+DIFFS[prev].name.toLowerCase()+' pas terminé';sfx('hit');return;}
  dungeonDiff=b.dataset.dd;refreshDungeonDiff();};
$('dungeonBtn').onclick=openDungeon;
$('dungeonBack').onclick=()=>{$('dungeonIntro').hidden=true;openModal('portalM');};
$('dungeonStart').onclick=()=>{if(dungeonUnlocked(dungeonDiff))startDungeon(dungeonDiff);};
$('dungeonReplay').onclick=()=>{if(dungeonUnlocked(dungeonDiff))startDungeon(dungeonDiff);};
$('dungeonHome').onclick=toVillage;
$('dungeonLeave').onclick=()=>finishDungeon(false);
$('dungeonNext').onclick=()=>{if(G?.dungeon&&state==='dungeonclear'){G.dungeon.room++;enterDungeonRoom();}};
function startDungeon(difficulty){
  stopCoop();save.diff=difficulty;dungeonDiff=difficulty;newRun();G.runDiff=difficulty;G.dungeon=DungeonRules.create(difficulty);
  for(const id of ['dungeonIntro','dungeonReport','dungeonClear'])$(id).hidden=true;
  $('ultLabel').textContent=CLASSES[save.cls].ult;enterDungeonRoom();
}
function enterDungeonRoom(){
  const d=G.dungeon,plan=DungeonRules.plan(d.difficulty,d.room),b=DUNGEON_BOUNDS;
  $('dungeonClear').hidden=true;G.wave=d.room;G.waveState='fight';G.toSpawn=0;G.boss=null;G.pending=0;
  for(const key of ['zombies','bullets','ebullets','pickups','grenades','turrets','parts','texts','blasts'])G[key]=[];
  G.p.x=WORLD/2;G.p.y=b.y+b.h-75;G.p.inv=2;G.p.dashT=0;G.p.dashCd=0;d.started=G.t;d.damage=0;d.cleared=false;d.portalOpen=false;d.enterT=G.t;
  const roster=[...Array(plan.goblins).fill('goblin'),...Array(plan.shamans).fill('shaman'),...Array(plan.guards).fill('guard')];
  roster.forEach((kind,i)=>{
    const x=b.x+90+(i%6)*(b.w-180)/5,y=b.y+100+Math.floor(i/6)*65;
    const type=kind==='shaman'?'spitter':kind==='guard'?'tank':'walker',z=spawnZombie(type,x,y);
    z.skin=kind==='goblin'?'goblin':kind==='shaman'?'dungeon_shaman':'dungeon_orc';
    if(kind==='goblin'){z.hp=z.maxHp=30*(1+(d.room-1)*.08)*diffOf().hp;z.speed=65*(diffOf().speed||1);}
  });
  if(plan.boss){
    const z=spawnZombie('boss',WORLD/2,b.y+150,0);
    z.def={id:'goblin-chief',name:'Gribouille, chef des gobelins',moves:['charge','slam','leaves'],minion:'walker',count:0,col:'#95ba46',ring:'#b4ed63'};
    Object.assign(z,{name:z.def.name,skin:'goblin',r:43,hp:1150*diffOf().hp,maxHp:1150*diffOf().hp,speed:48,summonT:Infinity});G.boss=z;
  }
  G.waveTotal=G.zombies.length;unlockWaveUpgrade();refreshSpeedBtn();state='play';resetJoy();showOnly('play');
  FP.yaw=-Math.PI/2;
  if(d.room===1||plan.boss)banner(plan.boss?'Dernière salle':'Donjon des gobelins',plan.title);updateHud();
}
function collectDungeonPickups(){for(const k of G.pickups){if(k.kind==='coin')G.coinsRun+=k.v;else if(k.kind==='gem')G.xp+=k.v*G.p.xpMult;}G.pickups=[];}
function completeDungeonRoom(){
  const d=G.dungeon;if(d.finished||d.cleared)return;d.cleared=true;DungeonRules.closeRoom(d,G.t,true);collectDungeonPickups();
  if(d.room===5){finishDungeon(true);return;}
  // plus de fenêtre : le portail du fond s'ouvre, on marche dedans pour passer à la salle suivante
  d.portalOpen=true;d.portalT=G.t;sfx('level');
}
function dungeonPortal(){
  const d=G.dungeon,b=DUNGEON_BOUNDS;if(!d.portalOpen||state!=='play')return;
  if(Math.abs(G.p.x-WORLD/2)<70&&G.p.y<b.y+G.p.r+30){d.portalOpen=false;d.room++;G.p.hp=Math.min(G.p.maxHp,G.p.hp+G.p.maxHp*.1);enterDungeonRoom();}
}
function dungeonTime(seconds){return Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0');}
function finishDungeon(won){
  const d=G?.dungeon;if(!d||d.finished)return;DungeonRules.closeRoom(d,G.t,false);d.finished=true;collectDungeonPickups();
  state='dungeonend';resetJoy();showOnly('dungeonend');$('dungeonClear').hidden=true;
  const coins=Math.floor(G.coinsRun*diffOf().reward),gems=G.gemsRun||0;save.coins+=coins;save.gems=(save.gems||0)+gems;
  if(won){save.story=save.story||{};dungeonDone()[d.difficulty]=true;save.story.goblinCleared=true;save.story.goblinWins=(save.story.goblinWins||0)+1;}persist();
  $('dungeonResult').textContent=won?'Donjon des gobelins terminé !':'Expédition interrompue';
  const elapsed=d.rows.reduce((n,r)=>n+(r.seconds||0),0),damage=d.rows.reduce((n,r)=>n+r.damage,0);
  $('dungeonTotal').textContent=DIFFS[d.difficulty].name+' · '+dungeonTime(elapsed)+' · '+Math.round(damage)+' dégâts · +'+coins+' pièces · +'+gems+' gemmes';
  $('dungeonRows').replaceChildren();
  for(const row of d.rows){const el=document.createElement('section');el.className='dungeon-row';const h=document.createElement('h3'),p=document.createElement('p'),loot=document.createElement('div');h.textContent='Salle '+row.room+' — '+row.title;p.textContent=row.seconds===null?'Non visitée':(row.status==='cleared'?'Terminée':'Inachevée')+' · '+dungeonTime(row.seconds)+' · '+Math.round(row.damage)+' dégâts infligés';loot.className='dungeon-loot';loot.setAttribute('aria-label','Quatre emplacements de ressources vides');for(let i=0;i<4;i++)loot.appendChild(document.createElement('span'));el.append(h,p,loot);$('dungeonRows').appendChild(el);}
  renderReplayDiff();$('dungeonReport').hidden=false;
}
// écran de fin : on rejoue dans le mode de son choix parmi ceux débloqués (facile, puis moyen, puis hardcore)
function renderReplayDiff(){const box=$('dungeonReplayDiff');if(!dungeonUnlocked(dungeonDiff))dungeonDiff='easy';box.innerHTML=DUNGEON_ORDER.filter(dungeonUnlocked).map(dd=>`<button data-rd="${dd}" class="${dd===dungeonDiff?'sel':''}">${DIFFS[dd].name}${dungeonDone()[dd]?' ✓':''}</button>`).join('');}
$('dungeonReplayDiff').onclick=e=>{const b=e.target.closest('[data-rd]');if(b){dungeonDiff=b.dataset.rd;renderReplayDiff();}};
function dungeonPortalFx(x,y,k){
  if(k<=0)return;ctx.save();ctx.translate(x,y);ctx.scale(k,k*.62);
  const gr=ctx.createRadialGradient(0,0,4,0,0,70);gr.addColorStop(0,'#fff6c8');gr.addColorStop(.35,'#b06cff');gr.addColorStop(.8,'#4a2a9a');gr.addColorStop(1,'rgba(40,20,90,0)');
  ctx.fillStyle=gr;ctx.beginPath();ctx.arc(0,0,70,0,TAU);ctx.fill();
  ctx.lineWidth=5;for(let i=0;i<3;i++){ctx.strokeStyle=`rgba(230,200,255,${.75-i*.2})`;ctx.beginPath();ctx.arc(0,0,22+i*15,G.t*(3-i)+i*2,G.t*(3-i)+i*2+3.6);ctx.stroke();}
  ctx.restore();
}
function drawDungeonFloor(){
  const b=DUNGEON_BOUNDS,d=G.dungeon;ctx.save();ctx.fillStyle='#11151b';ctx.fillRect(b.x-500,b.y-500,b.w+1000,b.h+1000);
  ctx.fillStyle=GTEX.ready?ctx.createPattern(texTile(d.room===1?'dirt':'cobble',d.room===5?'#73634c':'#68735c',.6),'repeat'):'#68735c';ctx.fillRect(b.x,b.y,b.w,b.h);
  ctx.strokeStyle='#252d2c';ctx.lineWidth=34;ctx.strokeRect(b.x-17,b.y-17,b.w+34,b.h+34);ctx.strokeStyle='#9b9b7e';ctx.lineWidth=3;
  for(let x=b.x-30;x<b.x+b.w+30;x+=75){ctx.strokeRect(x,b.y-34,75,30);ctx.strokeRect(x,b.y+b.h+4,75,30);}
  ctx.fillStyle='#1b1b23';ctx.fillRect(WORLD/2-52,b.y-38,104,42);ctx.strokeStyle='#aa9160';ctx.lineWidth=8;ctx.strokeRect(WORLD/2-52,b.y-38,104,42);
  for(const x of [b.x+45,b.x+b.w-45])for(const y of [b.y+50,b.y+b.h-50]){circle(x,y,20,'#332c28','#9a7f4b',4);circle(x,y-12,10+Math.sin(G.t*6)*2,'#ffb342');}
  // portail ouvert au fond quand la salle est vidée, et celui d'où l'on vient qui se referme derrière soi
  if(d.portalOpen)dungeonPortalFx(WORLD/2,b.y+6,Math.min(1,(G.t-d.portalT)*2));
  if(d.room>1&&G.t-d.enterT<1.2)dungeonPortalFx(WORLD/2,b.y+b.h-22,1-(G.t-d.enterT)/1.2);
  ctx.restore();
}

// Montée de niveau
let luChoices = [];
function rollUpgrades(picks = G.picks, hero = G.p) {
  const pool = UPG.filter(u => (!u.max || (picks[u.id] || 0) < u.max) && (u.rar !== 'légendaire' || G.level >= 5));
  const out = [];
  while (out.length < hero.choices && pool.length) {
    const total = pool.reduce((s, u) => s + RAR[u.rar].w, 0);
    let r = Math.random() * total, i = 0;
    for (; i < pool.length; i++) { r -= RAR[pool[i].rar].w; if (r <= 0) break; }
    out.push(pool.splice(Math.min(i, pool.length - 1), 1)[0]);
  }
  for (const f of FILLER) if (out.length < hero.choices) out.push(f);
  return out;
}
// carte d'amélioration (aussi envoyée au coéquipier en duo, sous forme de simples textes)
const luCardData = (u, picks) => { const have = picks[u.id] || 0; return { rar: u.rar, cls: RAR[u.rar].cls, name: u.name, desc: u.desc,
  lv: u.filler ? 'Carte bonus : presque tout est au max' : (have ? 'Déjà pris : ' + have + ' / ' + u.max : 'Nouveau · 0 / ' + u.max) + (have + 1 === u.max ? ' · dernier niveau' : '') }; };
function showLuCards(title, cards) {
  $('luTitle').textContent = title;
  $('luCards').replaceChildren(...cards.map((c, i) => {
    const b = document.createElement('button'); b.className = 'card ' + c.cls; b.dataset.i = i;
    for (const [k, t] of [['rar', c.rar], ['t', c.name], ['d', c.desc], ['lv', c.lv]]) { const sp = document.createElement('span'); sp.className = k; sp.textContent = t; b.appendChild(sp); }
    return b;
  }));
  startLuTimer();
}
// 6 secondes pour choisir : quand la barre est vide, une carte est prise au hasard
let luTimer = 0;
function startLuTimer() {
  clearTimeout(luTimer);
  const bar = $('luTimer'), fill = bar.firstElementChild; bar.hidden = false;
  fill.style.animation = 'none'; void fill.offsetWidth; fill.style.animation = '';
  luTimer = setTimeout(() => {
    const cards = $('luCards').querySelectorAll('[data-i]');
    if (!$('levelup').hidden && cards.length) cards[Math.floor(Math.random() * cards.length)].click();
  }, 6000);
}
function stopLuTimer() { clearTimeout(luTimer); $('luTimer').hidden = true; }
function luWait() { stopLuTimer(); const p = document.createElement('p'); p.className = 'sub'; p.textContent = 'Ton ami choisit son amélioration…'; $('luCards').replaceChildren(p); }
function openLevelUp() {
  if(G.upgradedWave===G.wave||G.pending<1)return;
  state = 'levelup'; resetJoy();
  luChoices = rollUpgrades();
  const title = 'Niveau ' + (G.level - G.pending + 1) + ' !';
  showLuCards(title, luChoices.map(u => luCardData(u, G.picks)));
  // en duo, chacun choisit sa propre amélioration : on tire aussi les cartes du coéquipier et on les lui envoie
  G.luHostDone = false; G.luAllyDone = true;
  if (coop.active && G.ally && session.role === 'host') {
    G.allyPicks = G.allyPicks || {}; G.allyChoices = rollUpgrades(G.allyPicks, G.ally); G.luAllyDone = false;
    session.send({ type: 'levelup', run: coop.run, title, cards: G.allyChoices.map(u => luCardData(u, G.allyPicks)) });
  }
  showOnly('levelup'); sfx('level');
}
function finishLevelUp() { stopLuTimer(); G.pending = 0; G.upgradedWave = G.wave; G.allyChoices = null; state = 'play'; showOnly('play'); }
$('luCards').addEventListener('click', e => {
  const c = e.target.closest('[data-i]'); if (!c) return;
  // coéquipier : son choix part chez l'hôte, qui l'applique à son héros
  if (coop.lu && !coop.lu.picked && session.role === 'guest') { coop.lu.picked = true; session.send({ type: 'pick', run: coop.run, i: +c.dataset.i }); luWait(); return; }
  if (state !== 'levelup' || G.luHostDone) return;
  const u = luChoices[+c.dataset.i];
  u.apply(G.p); if (G.ally && !(coop.active && session.role === 'host')) u.apply(G.ally); G.picks[u.id] = (G.picks[u.id] || 0) + 1;
  G.luHostDone = true;
  if (!G.luAllyDone) { luWait(); return; }
  finishLevelUp();
});

// Pause
function pauseGame() {
  if (coop.active && session.role === 'guest') { session.send({type:'pause'}); resetJoy(); return; }
  if (state !== 'play') return;
  state = 'pause'; resetJoy();
  $('pauseInfo').textContent = diffOf().name + ' · ' + BIOMES[biomeIdx % BIOMES.length].name + ' · vague ' + G.wave + ' · ' + G.kills + ' monstres éliminés · niveau ' + G.level;
  showOnly('pause');
}
$('pauseBtn').addEventListener('click', pauseGame);
const ZOOMS = [[0.8, 'normale'], [0.65, 'éloignée']];
function refreshZoomBtn() { const z = ZOOMS.find(([v]) => Math.abs(v - (save.bzoom || 0.8)) < 0.01) || ZOOMS[0]; $('zoomBtn').textContent = 'Caméra : ' + z[1]; }
$('zoomBtn').addEventListener('click', () => {
  const i = ZOOMS.findIndex(([v]) => Math.abs(v - (save.bzoom || 0.8)) < 0.01);
  save.bzoom = ZOOMS[(i + 1) % ZOOMS.length][0]; persist(); resize(); refreshZoomBtn();
});
refreshZoomBtn();
// Vitesse de jeu ×2 (le jeu avance deux fois par image)
function refreshSpeedBtn() { const locked=coop.active||!!G?.dungeon; $('speedBtn').disabled=locked; $('speedBtn').textContent=locked?(G?.dungeon?'Vitesse : ×1 (donjon)':'Vitesse : ×1 (duo)'): 'Vitesse : '+(save.speed2?'×2':'×1'); $('speedChip').hidden=true; $('speedHud').hidden=locked; $('speedHud').classList.toggle('on',!!save.speed2); $('viewBtn').classList.toggle('on',save.bview==='fp'); }
$('speedBtn').addEventListener('click', () => { if(coop.active||G?.dungeon)return; save.speed2 = !save.speed2; persist(); refreshSpeedBtn(); });
refreshSpeedBtn();
$('resumeBtn').addEventListener('click', () => { if (state === 'pause') { state = 'play'; showOnly('play'); } });
$('quitBtn').addEventListener('click', () => { if (state === 'pause') gameOver(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

function gameOver() {
  if(G?.dungeon){finishDungeon(false);return;}
  if (!G || state === 'over') return;
  const finishedRun = G;
  if (coop.active && session.role === 'host') sendCoopState('end');
  if (G !== finishedRun) return;
  state = 'over'; resetJoy();
  // partie de test (mode développeur) : ni pièces, ni gemmes, ni record
  const earned = G.devTest ? 0 : Math.floor((G.coinsRun + G.wave * 4 + G.kills / 5) * (1 + (G.p.coinBonus || 0)) * diffOf().reward);
  G.gemsRun = G.devTest ? 0 : (G.gemsRun || 0) * diffOf().gems;
  const reached = Math.max(0, G.wave);
  const record = !G.devTest && reached > save.best;
  save.coins += earned; save.gems = (save.gems || 0) + (G.gemsRun || 0); if (record) save.best = reached;
  save.totalKills = (save.totalKills || 0) + G.kills;
  save.history.unshift({ w: reached, k: G.kills, l: G.level, c: save.cls, d: Date.now(), df: save.diff || 'normal' });
  save.history = save.history.slice(0, 8);
  persist();
  $('rWave').textContent = reached; $('rKills').textContent = G.kills; $('rLevel').textContent = G.level; $('rCoins').textContent = '+' + earned; $('rGems').textContent = '+' + (G.gemsRun || 0);
  $('recordText').hidden = !record;
  // récapitulatif façon Dofus : qui, combien de temps, et le butin (métiers)
  const secs = Math.round(G.t || 0);
  $('rTime').textContent = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
  $('rName').textContent = heroName(save);
  $('rSub').textContent = (TRIBES[save.tribe] ? TRIBES[save.tribe].name + ' · ' : '') + CLASSES[save.cls].name + ' · ' + diffOf().name + ' · ' + BIOMES[biomeIdx % BIOMES.length].name;
  try { snapHero($('rHero'), save.skin, CLASSES[save.cls].color); } catch (e) {}
  $('rLootBox').hidden = !jobsOn();
  if (jobsOn()) {
    const loot = rollLoot(reached, G.p.lootMult), ups = gainLoot(loot), ids = Object.keys(loot);
    $('rLoot').innerHTML = ids.length ? ids.map((id, i) => resChip(id, loot[id]).replace('class="rchip"', `class="rchip" style="--tc:${RES_TIERS[RES[id].tier].col};animation-delay:${0.9 + i * 0.12}s"`)).join('') : '<span class="rnote">Rien cette fois… va plus loin dans les vagues !</span>';
    $('rNote').textContent = (G.p.lootMult > 1 ? 'Potion de chance : butin ×1,5. ' : '') + (ups.length ? ups.map(j => JOBS[j].name + ' passe niveau ' + jobLvl(j) + ' !').join(' ') : 'Les ressources servent au Forgeron et à l’Alchimiste (forge et laboratoire du village).');
    persist();
  }
  setTimeout(() => { if (state === 'over') showOnly('over'); }, 700);
}


// ---------- Vue à la 1re personne (Bastion et donjon) ----------
// Le jeu reste le même (mêmes règles, mêmes coordonnées) : seul l'affichage change. Le sol peint du Bastion
// devient le sol 3D, arbres et monstres sont des images toujours tournées vers la caméra, les tirs des boules
// lumineuses. Moitié gauche de l'écran : se déplacer ; moitié droite : glisser pour tourner la tête.
// Le tir reste automatique, mais seulement sur les monstres devant soi.
const FPK = 1 / 40;                       // 40 pixels du jeu = 1 mètre
const FP = { r: null, yaw: -Math.PI / 2, look: { id: null, x: 0 }, tex: new Map(), snaps: new Map(), sprites: [], used: 0, key: '', fire: 0, mon: new Map(), pool: {} };
const fpOn = () => save.bview === 'fp' && !!window.THREE && !!G && (state === 'play' || state === 'levelup' || state === 'pause' || state === 'dungeonend' || state === 'over');
function fpTex(img) {
  let t = FP.tex.get(img);
  if (!t) { t = new THREE.CanvasTexture(img); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; FP.tex.set(img, t); }
  return t;
}
function fpInit() {
  if (FP.r) return true;
  const T = THREE;
  try { FP.r = oldLook(new T.WebGLRenderer({ canvas: $('fpv'), antialias: true }), true); } catch (e) { FP.r = null; return false; }
  FP.scene = new T.Scene(); FP.cam = new T.PerspectiveCamera(72, 1, 0.05, 140); FP.scene.add(FP.cam);
  FP.scene.add(new T.HemisphereLight('#fffaf0', '#6d5a8a', 0.9)); const dl = new T.DirectionalLight('#fff0d0', 0.7); dl.position.set(-3, 6, 4); FP.scene.add(dl);
  FP.world = new T.Group(); FP.scene.add(FP.world);
  // tirs, tirs ennemis, objets à ramasser : un seul dessin chacun
  const ball = new T.SphereGeometry(1, 10, 8);
  // tirs : traînées lumineuses étirées dans le sens du vol (comme vue de dessus)
  const tracer = new T.CylinderGeometry(1, 1, 1, 6, 1); tracer.rotateX(Math.PI / 2);
  const glow = () => new T.MeshBasicMaterial({ toneMapped: false, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
  FP.shots = new T.InstancedMesh(tracer, glow(), 600); FP.shots.frustumCulled = false; FP.scene.add(FP.shots);
  FP.cores = new T.InstancedMesh(ball, new T.MeshBasicMaterial({ toneMapped: false }), 600); FP.cores.frustumCulled = false; FP.scene.add(FP.cores);
  FP.sparks = new T.InstancedMesh(ball, glow(), 500); FP.sparks.frustumCulled = false; FP.scene.add(FP.sparks);
  FP.booms = new T.InstancedMesh(ball, glow(), 40); FP.booms.frustumCulled = false; FP.scene.add(FP.booms);
  const wall = new T.CylinderGeometry(1, 1, 1, 48, 1, true); wall.translate(0, 0.5, 0);
  const wm = glow(); wm.side = T.DoubleSide; FP.waves = new T.InstancedMesh(wall, wm, 12); FP.waves.frustumCulled = false; FP.scene.add(FP.waves);
  FP.turrets = [];
  FP.eshots = new T.InstancedMesh(ball, new T.MeshBasicMaterial({ toneMapped: false }), 400); FP.eshots.frustumCulled = false; FP.scene.add(FP.eshots);
  FP.loot = new T.InstancedMesh(new T.OctahedronGeometry(1, 0), new T.MeshLambertMaterial(), 300); FP.loot.frustumCulled = false; FP.scene.add(FP.loot);
  for (const m of [FP.shots, FP.cores, FP.sparks, FP.booms, FP.waves, FP.eshots, FP.loot]) m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(m.count * 3), 3);
  // anneaux au sol (explosions, zones dangereuses) et portail du donjon
  FP.rings = []; FP.ringGeo = new T.RingGeometry(0.86, 1, 48); FP.ringGeo.rotateX(-Math.PI / 2);
  FP.portal = new T.Mesh(new T.TorusGeometry(1.6, 0.18, 10, 40), new T.MeshBasicMaterial({ color: '#c08cff' }));
  FP.portalIn = new T.Mesh(new T.CircleGeometry(1.5, 32), new T.MeshBasicMaterial({ color: '#7a3cff', transparent: true, opacity: 0.55, side: T.DoubleSide }));
  FP.portal.add(FP.portalIn); FP.scene.add(FP.portal);
  // l'arme du héros, en bas à droite de l'écran
  FP.gun = new T.Group(); FP.cam.add(FP.gun); FP.gunKey = '';
  // bras du héros qui tient l'arme par la poignée (refait quand l'arme ou la tribu change)
  FP.arm = new T.Group(); FP.cam.add(FP.arm);
  // seconde main (sous le garde-main de l'Œil de faucon)
  FP.arm2 = new T.Group(); FP.cam.add(FP.arm2); FP.arm2.visible = false;
  const fl = document.createElement('canvas'); fl.width = fl.height = 64; const fg = fl.getContext('2d'), gr = fg.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, '#fff2a8'); gr.addColorStop(0.7, 'rgba(255,170,40,.6)'); gr.addColorStop(1, 'rgba(255,120,0,0)'); fg.fillStyle = gr;
  for (let i = 0; i < 6; i++) { fg.beginPath(); const a = i / 6 * TAU; fg.moveTo(32, 32); fg.lineTo(32 + Math.cos(a - 0.25) * 30, 32 + Math.sin(a - 0.25) * 30); fg.lineTo(32 + Math.cos(a + 0.25) * 30, 32 + Math.sin(a + 0.25) * 30); fg.fill(); }
  fg.beginPath(); fg.arc(32, 32, 14, 0, TAU); fg.fill();
  FP.flash = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(fl), transparent: true, opacity: 0, depthTest: false, blending: T.AdditiveBlending })); FP.flash.scale.set(0.3, 0.3, 1); FP.flash.renderOrder = 11; FP.cam.add(FP.flash);
  return true;
}
// sol du Bastion (la grande peinture du biome) ou de la salle du donjon, reconstruit quand il change
function fpBuildWorld() {
  const T = THREE, d = G.dungeon, key = d ? 'd' + d.room : 'b' + biomeKey + (biome && biome.layer ? biome.layer.width : 0);
  if (FP.key === key) return; FP.key = key;
  for (const o of [...FP.world.children]) { FP.world.remove(o); if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map && !FP.tex.has(o.material.map.image)) o.material.map.dispose(); }
  const add = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); FP.world.add(m); return m; };
  if (d) {
    const b = DUNGEON_BOUNDS, c = document.createElement('canvas'), k = 1024 / b.w; c.width = 1024; c.height = Math.round(b.h * k);
    const g = c.getContext('2d');
    // on réutilise le dessin du sol du donjon (dalles, torches au sol) dans une image
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); ctx.setTransform(k, 0, 0, k, -b.x * k, -b.y * k);
    const was = d.portalOpen; d.portalOpen = false; drawDungeonFloor(); d.portalOpen = was; ctx.restore();
    g.drawImage(cv, 0, 0, c.width, c.height, 0, 0, c.width, c.height);
    const floor = add(new T.PlaneGeometry(b.w * FPK, b.h * FPK), new T.MeshBasicMaterial({ map: fpTex(c) }), (b.x + b.w / 2) * FPK, 0, (b.y + b.h / 2) * FPK); floor.rotation.x = -Math.PI / 2;
    let wmap = null; if (GTEX.ready) { wmap = new T.CanvasTexture(texTile('cobble', '#6a6f78', 0.6)); wmap.wrapS = wmap.wrapT = T.RepeatWrapping; wmap.repeat.set(6, 1); wmap.encoding = T.sRGBEncoding; }
    const wall = new T.MeshLambertMaterial({ color: wmap ? '#ffffff' : '#4a4d52', map: wmap }), H = 3.2, t = 0.6, W = b.w * FPK, D = b.h * FPK, cx = (b.x + b.w / 2) * FPK, cz = (b.y + b.h / 2) * FPK;
    add(new T.BoxGeometry(W + 2 * t, H, t), wall, cx, H / 2, b.y * FPK - t / 2); add(new T.BoxGeometry(W + 2 * t, H, t), wall, cx, H / 2, (b.y + b.h) * FPK + t / 2);
    add(new T.BoxGeometry(t, H, D), wall, b.x * FPK - t / 2, H / 2, cz); add(new T.BoxGeometry(t, H, D), wall, (b.x + b.w) * FPK + t / 2, H / 2, cz);
    // torches aux murs
    for (const [x, z] of [[b.x + 45, b.y], [b.x + b.w - 45, b.y], [b.x + 45, b.y + b.h], [b.x + b.w - 45, b.y + b.h]]) { const f = add(new T.SphereGeometry(0.16, 8, 6), new T.MeshBasicMaterial({ color: '#ffb342' }), x * FPK, 1.9, z * FPK); f.userData.torch = true; }
    FP.scene.background = new T.Color('#151821'); FP.scene.fog = new T.Fog('#151821', 12, 34);
    return;
  }
  if (!biome) setBiome(0);
  const B = biome.B, src = biome.layer, c = document.createElement('canvas'); c.width = c.height = 2048;
  c.getContext('2d').drawImage(src, 0, 0, src.width, src.height, 0, 0, 2048, 2048);
  const floor = add(new T.PlaneGeometry(WORLD * FPK, WORLD * FPK), new T.MeshBasicMaterial({ map: fpTex(c) }), WORLD / 2 * FPK, 0, WORLD / 2 * FPK); floor.rotation.x = -Math.PI / 2;
  const out = add(new T.PlaneGeometry(400, 400), new T.MeshBasicMaterial({ color: B.out }), WORLD / 2 * FPK, -0.02, WORLD / 2 * FPK); out.rotation.x = -Math.PI / 2;
  // arbres, buissons et rochers en 3D comme au village (touffes rondes, de la couleur de l'arbre vu de dessus) ;
  // le reste du petit décor (fleurs, roseaux, champignons…) : la même image que vue de dessus, debout face à la caméra
  const lumps = [], bark = [], rocks = [];
  for (const d0 of biome.tall) {
    const pI = biomeIdx, pD = DSPR, oB = d0.bi === undefined ? B : BIOMES[d0.bi % BIOMES.length];
    if (d0.bi !== undefined) { biomeIdx = d0.bi; DSPR = DSPR_ALL[d0.bi % BIOMES.length] || (DSPR_ALL[d0.bi % BIOMES.length] = {}); }
    const sp = decorSprite(d0.type, oB, d0.c % 4); biomeIdx = pI; DSPR = pD;
    if (!sp.fpImg) { const c2 = document.createElement('canvas'); c2.width = sp.w; c2.height = sp.h; const g2 = c2.getContext('2d'); if (sp.trunk) g2.drawImage(sp.trunk, 0, 0); g2.drawImage(sp.top, 0, 0); sp.fpImg = c2; }
    const X = d0.x * FPK, Z = d0.y * FPK, H = sp.h * d0.s * FPK, rot = (d0.r || 0) * TAU;
    if (/^(tree|bush|rock|boulder|lavarock)$/.test(d0.type)) {
      if (!sp.fpCol) sp.fpCol = fpSpriteColor(sp);
      if (d0.type === 'tree') {
        // feuillage toujours au-dessus des yeux (1,5 m) : sinon, sous un petit arbre, la caméra se retrouve dans les feuilles
        const k = H / 4.4, lift = Math.max(0, 2.05 - 1.25 * k); bark.push({ x: X, z: Z, k, lift });
        for (const [lx, ly, lz, lr] of [[0, 2.7, 0, 1.3], [0.95, 2.3, 0.3, 1.0], [-0.9, 2.35, -0.2, 1.0], [-0.15, 3.45, 0.1, 0.92], [0.15, 2.2, 0.85, 0.95]]) {
          const c = Math.cos(rot), sn = Math.sin(rot);
          lumps.push({ x: X + (lx * c - lz * sn) * k, y: ly * k + lift, z: Z + (lx * sn + lz * c) * k, r: lr * k, col: sp.fpCol });
        }
      } else if (d0.type === 'bush') {
        const k = H / 1.1;
        for (const [lx, ly, lz, lr] of [[0, 0.45, 0, 0.6], [0.5, 0.35, 0.1, 0.45], [-0.45, 0.35, -0.1, 0.45]]) lumps.push({ x: X + lx * k, y: ly * k, z: Z + lz * k, r: lr * k, col: sp.fpCol });
      } else rocks.push({ x: X, z: Z, r: H * 0.55, rot, col: sp.fpCol });
      continue;
    }
    const m = new T.Sprite(new T.SpriteMaterial({ map: fpTex(sp.fpImg), alphaTest: 0.45 }));
    m.center.set(sp.ax / sp.w, 1 - sp.ay / sp.h); m.scale.set(sp.w * d0.s * FPK, sp.h * d0.s * FPK, 1); m.position.set(d0.x * FPK, 0, d0.y * FPK);
    FP.world.add(m);
  }
  fpNature(lumps, bark, rocks);
  const sky = new T.Color('#a9dcff'); FP.scene.background = sky; FP.scene.fog = new T.Fog(sky, 30, 70);
}
// couleur principale d'un arbre vu de dessus (son feuillage), pour l'arbre 3D
function fpSpriteColor(sp) {
  try {
    const N = 32, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); g.drawImage(sp.top, 0, 0, N, N);
    const d = g.getImageData(0, 0, N, N).data; let r = 0, gg = 0, b = 0, n = 0;
    for (let y = 5; y < 19; y++) for (let x = 8; x < 24; x++) { const i = (y * N + x) * 4; if (d[i + 3] > 200) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; } }
    if (n) return new THREE.Color(r / n / 255, gg / n / 255, b / n / 255).convertSRGBToLinear();
  } catch (e) {}
  return new THREE.Color('#58c04a');
}
// touffes de feuillage, troncs et rochers en quelques dessins (instanciés), avec le contour sombre du style du jeu
function fpNature(lumps, bark, rocks) {
  const T = THREE, dm = new T.Object3D();
  if (!FP.leafTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = 3;
    for (let i = 0; i < 40; i++) { const x = Math.random() * 128, y = Math.random() * 128, r = 6 + Math.random() * 6; g.beginPath(); g.arc(x, y, r, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
    FP.leafTex = new T.CanvasTexture(c); FP.leafTex.wrapS = FP.leafTex.wrapT = T.RepeatWrapping; FP.leafTex.repeat.set(2, 1);
  }
  const inst = (geo, mat, list, f) => { if (!list.length) return; const im = new T.InstancedMesh(geo, mat, list.length); list.forEach((it, i) => { f(dm, it); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix); if (it.col && !mat.side) im.setColorAt(i, it.col); }); FP.world.add(im); };
  const leaf = new T.MeshToonMaterial({ color: '#ffffff', map: FP.leafTex, gradientMap: GRAD }), line = new T.MeshBasicMaterial({ color: '#23301a', side: T.BackSide });
  const sph = new T.SphereGeometry(1, 10, 7), sphO = new T.SphereGeometry(1.07, 8, 6);
  inst(sph, leaf, lumps, (d, it) => { d.position.set(it.x, it.y, it.z); d.scale.set(it.r, it.r * 0.92, it.r); d.rotation.set(0, it.x, 0); });
  inst(sphO, line, lumps, (d, it) => { d.position.set(it.x, it.y, it.z); d.scale.set(it.r, it.r * 0.92, it.r); });
  const trunk = new T.CylinderGeometry(0.16, 0.26, 2.4, 8); trunk.translate(0, 1.2, 0);
  inst(trunk, new T.MeshToonMaterial({ color: '#5e3c24', gradientMap: GRAD }), bark, (d, it) => { d.position.set(it.x, 0, it.z); d.scale.set(it.k, it.k + it.lift / 2.4, it.k); d.rotation.set(0, 0, 0); });
  const rock = new T.DodecahedronGeometry(1, 0);
  inst(rock, new T.MeshToonMaterial({ color: '#ffffff', gradientMap: GRAD }), rocks, (d, it) => { d.position.set(it.x, it.r * 0.45, it.z); d.scale.set(it.r, it.r * 0.75, it.r * 0.9); d.rotation.set(0, it.rot, 0); });
  inst(new T.DodecahedronGeometry(1.06, 0), line, rocks, (d, it) => { d.position.set(it.x, it.r * 0.45, it.z); d.scale.set(it.r, it.r * 0.75, it.r * 0.9); d.rotation.set(0, it.rot, 0); });
}
// image d'un monstre : ses images animées s'il en a, sinon une photo de son dessin vu de dessus
// boss en 1re personne : son vrai modèle 3D animé, posé au sol (et non plus une image plate enfoncée dans le sol)
const fpBossDefs = {};
function fpBossDef(z) {
  const B = z.def && BOSS3D[z.def.id]; if (!B) return z.skin ? MONSTER3D[z.skin] : null;   // chef des gobelins : son modèle de gobelin, tourné vers le joueur
  return fpBossDefs[z.def.id] || (fpBossDefs[z.def.id] = { model: B.model, clip: B.clips.walk, ext: B.ext, sc: 0.72 });
}
function fpMonsterImg(z) {
  const F = MONSTER3D[z.skin || z.type] && z.type !== 'boss' ? monsterFrames(z.skin || z.type) : null;
  if (F) { const f = Math.floor((G.t + z.wob) * (F.fps || 10)) % 8; return { img: (z.flash > 0 ? F.flash : F.frames)[f], h: z.r * 5.6 * (MONSTER3D[z.skin || z.type].sc || 1), cy: 0.2 }; }
  const key = z.type + '|' + (z.skin || '') + '|' + (z.def ? z.def.id + z.def.col : '') + '|' + Math.round(z.r);
  let img = FP.snaps.get(key);
  if (!img) {
    const C = Math.ceil(z.r * 7), Hh = Math.ceil(C * 1.25); img = document.createElement('canvas'); img.width = C; img.height = Hh;
    const fake = Object.assign(Object.create(Object.getPrototypeOf(z)), z, { x: C / 2, y: Hh - z.r * 1.4, flash: 0, tele: null });
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, C, Hh); try { drawZombie(fake, C / 2, Hh); } catch (e) {} ctx.restore();
    img.getContext('2d').drawImage(cv, 0, 0, C, Hh, 0, 0, C, Hh); FP.snaps.set(key, img);
  }
  return { img, h: img.height, cy: (z.type === 'boss' ? z.r * 0.4 : z.r * 1.4 - z.r * 0.6) / img.height };
}
function fpSprite() {
  let m = FP.sprites[FP.used];
  if (!m) { m = new THREE.Sprite(new THREE.SpriteMaterial({ alphaTest: 0.45 })); FP.sprites.push(m); FP.scene.add(m); }
  FP.used++; m.visible = true; return m;
}
function renderFP(dt) {
  if (!fpInit()) { save.bview = 'top'; return; }
  const FPC = FP.col || (FP.col = new THREE.Color());
  const T = THREE, r = FP.r, p = coop.active && session.role === 'guest' ? G.ally : G.p;
  const dpr = save.gfx === 'fast' ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
  if (r.getPixelRatio() !== dpr) r.setPixelRatio(dpr);
  const sz = r.getSize(new T.Vector2()); if (sz.x !== innerWidth || sz.y !== innerHeight) { r.setSize(innerWidth, innerHeight, false); FP.cam.aspect = innerWidth / innerHeight; FP.cam.updateProjectionMatrix(); }
  fpBuildWorld();
  // flèches gauche/droite (clavier) : tourner
  const turn = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0); if (turn) FP.yaw += turn * 2.4 * dt;
  // caméra dans les yeux du héros (léger balancement en marchant)
  const bob = p.moving ? Math.sin(p.walk * 0.5) * 0.04 : 0, sh = G.shake ? G.shake * 0.004 : 0;
  FP.cam.position.set(p.x * FPK + (Math.random() - 0.5) * sh, 1.5 + bob, p.y * FPK + (Math.random() - 0.5) * sh);
  FP.cam.lookAt(FP.cam.position.x + Math.cos(FP.yaw), 1.42 + bob, FP.cam.position.z + Math.sin(FP.yaw));
  // torches du donjon qui vacillent
  for (const o of FP.world.children) if (o.userData.torch) o.scale.setScalar(1 + Math.sin(G.t * 9 + o.position.x) * 0.15);
  // monstres (et le coéquipier en duo)
  FP.used = 0;
  FP.frame = (FP.frame || 0) + 1;
  for (const z of G.zombies) {
    if (z.dead) continue;
    const dx = z.x - p.x, dy = z.y - p.y; if (dx * dx + dy * dy > 3000 * 3000) continue;
    // vrais modèles 3D animés, tournés vers le joueur (les images sont faites pour la vue de dessus, donc de profil)
    const D = z.type === 'boss' ? fpBossDef(z) : MONSTER3D[z.skin || z.type];
    if (D && MODELS[D.model] && dx * dx + dy * dy < 1400 * 1400 && fpMonster3D(z, D, p)) continue;
    const I = fpMonsterImg(z), m = fpSprite(), w = I.h * I.img.width / I.img.height;
    if (m.material.map !== fpTex(I.img)) { m.material.map = fpTex(I.img); m.material.needsUpdate = true; }
    m.material.color.set(z.flash > 0 ? '#ffd0d0' : '#ffffff');
    m.center.set(0.5, I.cy); m.scale.set(w * FPK * 1.3, I.h * FPK * 1.3, 1); m.position.set(z.x * FPK, 0, z.y * FPK);
  }
  const other = coop.active && G.ally ? (p === G.p ? G.ally : G.p) : null, hs = other && heroSheet();
  if (hs) {
    const m = fpSprite(), N = hs.size, a = Math.atan2(p.y - other.y, p.x - other.x), dIdx = Math.round((((other.aim - a) % TAU) + TAU) % TAU / TAU * hs.dirs) % hs.dirs;
    if (!FP.allyImg) { FP.allyImg = document.createElement('canvas'); FP.allyImg.width = FP.allyImg.height = N; }
    if (FP.allyD !== dIdx) { FP.allyD = dIdx; const g = FP.allyImg.getContext('2d'); g.clearRect(0, 0, N, N); g.drawImage(hs.sheet, dIdx * N, 0, N, N, 0, 0, N, N); const t = fpTex(FP.allyImg); t.needsUpdate = true; }
    m.material.map = fpTex(FP.allyImg); m.material.color.set('#ffffff'); m.center.set(0.5, 1 - hs.foot / N); m.scale.set(2.6, 2.6, 1); m.position.set(other.x * FPK, 0, other.y * FPK);
  }
  for (let i = FP.used; i < FP.sprites.length; i++) FP.sprites[i].visible = false;
  for (const [z, e] of FP.mon) if (e.seen !== FP.frame) { e.g.visible = false; (FP.pool[e.model] || (FP.pool[e.model] = [])).push(e.g); FP.mon.delete(z); }
  fpPet(dt);
  // tirs du héros (à hauteur d'arme), tirs ennemis, objets à ramasser
  const mtx = new T.Matrix4(), put = (mesh, i, x, y, z, s, col) => { mtx.makeScale(s, s, s).setPosition(x, y, z); mesh.setMatrixAt(i, mtx); mesh.setColorAt(i, FPC.set(col)); };
  let n = 0, nc = 0;
  const q = FP.q || (FP.q = new T.Quaternion()), up = FP.up || (FP.up = new T.Vector3(0, 0, 1)), dir = FP.dir || (FP.dir = new T.Vector3()), sc = FP.sc || (FP.sc = new T.Vector3()), pos = FP.pos || (FP.pos = new T.Vector3());
  // les balles du héros partent de la bouche du canon : l'écart entre le canon et leur vraie trajectoire (hauteur et côté)
  // s'efface peu à peu sur FP_SHOT_JOIN mètres, sans qu'elles plongent sous l'arme
  const mz = FP.gun.userData.muzzle, mw = FP.mw || (FP.mw = new T.Vector3()), off = FP.off || (FP.off = new T.Vector3()), vis = FP.vis || (FP.vis = new T.Vector3());
  if (mz) mz.getWorldPosition(mw);
  for (const b of G.bullets) {
    if (n >= 600) break;
    const col = b.fire ? '#ff7a1f' : b.col || (b.crit ? '#ff4fa3' : '#ffd23f'), sp = Math.hypot(b.vx, b.vy) || 1;
    let len = Math.min(1.6, sp * 0.03 * FPK * 1.4); const w = (b.crit ? 0.07 : 0.05) * (b.r || 6) / 6;
    dir.set(b.vx / sp, 0, b.vy / sp); vis.set(b.x * FPK, 0.65, b.y * FPK);
    // seulement les tirs de l'arme du joueur qui regarde (pas ceux du familier, des drones ni de la tourelle)
    if (mz && b.hero === (p === G.ally ? 2 : 1)) {
      const t = Math.hypot(b.x - b.ox, b.y - b.oy) * FPK, k = Math.max(0, 1 - t / FP_SHOT_JOIN);
      len = Math.min(len, t + 0.02);   // la traînée ne repart pas en arrière dans l'arme
      off.set(mw.x - b.ox * FPK, mw.y - 0.65, mw.z - b.oy * FPK);
      vis.addScaledVector(off, k);
      // la traînée suit la direction réellement parcourue à l'écran
      dir.addScaledVector(off, -1 / FP_SHOT_JOIN).normalize();
    } else if (FP.pet && FP.pet.visible && G.pet && b.ox !== undefined && Math.hypot(b.ox - G.pet.x, b.oy - G.pet.y) < 40) {
      // tirs du familier : ils partent de sa gueule (à sa hauteur), pas du sol juste devant la caméra
      const t = Math.hypot(b.x - b.ox, b.y - b.oy) * FPK, k = Math.max(0, 1 - t / FP_SHOT_JOIN);
      off.set(0, FP.pet.position.y + 0.45 - 0.65, 0); vis.addScaledVector(off, k);
      len = Math.min(len, t + 0.02);
    }
    q.setFromUnitVectors(up, dir); pos.copy(vis).addScaledVector(dir, -len / 2); sc.set(w, w, len);
    mtx.compose(pos, q, sc); FP.shots.setMatrixAt(n, mtx); FP.shots.setColorAt(n++, FPC.set(col));
    put(FP.cores, nc++, vis.x, vis.y, vis.z, w * 0.9, '#fffbe8');
  }
  // grenade lancée : elle vole en cloche jusqu'à sa cible
  for (const g of G.grenades) { if (nc >= 600) break; const k = g.t / g.dur; put(FP.cores, nc++, (g.x0 + (g.x1 - g.x0) * k) * FPK, 0.9 + Math.sin(k * Math.PI) * 1.8, (g.y0 + (g.y1 - g.y0) * k) * FPK, 0.16, '#3a8f3a'); }
  FP.shots.count = n; FP.cores.count = nc; n = 0;
  // étincelles, éclats, fumée (les particules de la vue de dessus)
  for (const q2 of G.parts) { if (n >= 500) break; const k = q2.max ? Math.max(0, q2.life / q2.max) : 1; if (q2.kind === 'flash') continue; put(FP.sparks, n++, q2.x * FPK, 0.35 + (1 - k) * 0.5, q2.y * FPK, Math.max(0.03, (q2.r || 4) * FPK * 0.6 * (0.4 + k)), q2.color || '#ffd23f'); }
  FP.sparks.count = n; n = 0;
  // explosions (grenade, soin, Barrage…) : une boule lumineuse qui grossit et s'efface
  let nw = 0;
  for (const b of G.blasts) {
    const k = b.t / 0.4, col = FPC.set(b.color).multiplyScalar(1 - k).getStyle();
    // petite explosion : boule de lumière ; grande onde (soin du médecin…) : mur lumineux qui s'élargit autour du joueur
    if (b.r < 150) { if (n < 40) put(FP.booms, n++, b.x * FPK, 0.3, b.y * FPK, b.r * FPK * (0.3 + 0.7 * k) * 0.6, col); continue; }
    if (nw < 12) { const rr = b.r * (0.4 + 0.6 * k) * FPK; mtx.makeScale(rr, 1.4 * (1 - k * 0.5), rr).setPosition(b.x * FPK, 0, b.y * FPK); FP.waves.setMatrixAt(nw, mtx); FP.waves.setColorAt(nw++, FPC.set(col)); }
  }
  FP.booms.count = n; FP.waves.count = nw; n = 0;
  for (const e of G.ebullets) { if (n >= 400) break; put(FP.eshots, n++, e.x * FPK, 0.7, e.y * FPK, Math.max(0.12, (e.r || 8) * FPK), e.col || '#ff5fa8'); }
  FP.eshots.count = n; n = 0;
  for (const k of G.pickups) { if (n >= 300) break; const c = k.kind === 'coin' ? '#ffd23f' : k.kind === 'life' ? '#3df5b0' : k.kind === 'gem' ? (k.v >= 5 ? '#ff4fa3' : k.v >= 2 ? '#3df5b0' : '#3db8ff') : '#ff4f6d'; put(FP.loot, n++, k.x * FPK, 0.35 + Math.sin(G.t * 5 + k.x) * 0.08, k.y * FPK, k.kind === 'coin' ? 0.16 : 0.2, c); }
  FP.loot.count = n;
  for (const m of [FP.shots, FP.cores, FP.sparks, FP.booms, FP.waves, FP.eshots, FP.loot]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  fpTurrets(); fpWater();
  // explosions, zones d'attaque des boss, ralentissement : des anneaux au sol
  let ri = 0;
  const ring = (x, y, rad, col, op) => {
    let m = FP.rings[ri]; if (!m) { m = new T.Mesh(FP.ringGeo, new T.MeshBasicMaterial({ transparent: true, depthWrite: false })); FP.rings.push(m); FP.scene.add(m); }
    ri++; m.visible = true; m.material.color.set(col); m.material.opacity = op; m.scale.setScalar(Math.max(0.05, rad * FPK)); m.position.set(x * FPK, 0.03, y * FPK);
  };
  for (const b of G.blasts) { const k = b.t / 0.4; ring(b.x, b.y, b.r * (0.4 + 0.6 * k), b.color, 1 - k); }
  for (const z of G.zombies) if (z.tele) {
    const t = z.tele, k = clamp(z.teleT / (z.teleMax || 1), 0, 1);
    if (t.type === 'circle') { ring(t.x === undefined ? z.x : t.x, t.y === undefined ? z.y : t.y, t.r || z.r * 3, '#ff3a3a', 0.4 + k * 0.5); ring(t.x === undefined ? z.x : t.x, t.y === undefined ? z.y : t.y, (t.r || z.r * 3) * k, '#ff3a3a', 0.6); }
    else if (t.type === 'line') for (let i = 1; i <= 8; i++) ring(z.x + z.cdx * i * 45, z.y + z.cdy * i * 45, z.r * 0.8, '#ff3a3a', 0.55);
    else ring(z.x, z.y, z.r * 2.5, '#ff3a3a', 0.5);
  }
  if (G.slowR) ring(p.x, p.y, G.slowR, '#bfe8ff', 0.35);
  for (let i = ri; i < FP.rings.length; i++) FP.rings[i].visible = false;
  // portail du donjon (ouvert au fond quand la salle est vidée)
  const d = G.dungeon; FP.portal.visible = !!(d && d.portalOpen);
  if (FP.portal.visible) { FP.portal.position.set(WORLD / 2 * FPK, 1.7, (DUNGEON_BOUNDS.y + 6) * FPK); FP.portal.rotation.z = G.t; FP.portalIn.material.opacity = 0.45 + Math.sin(G.t * 4) * 0.15; }
  // arme en main : recul et éclair à chaque tir
  const gk = save.weapon + '|' + save.wskin + '|' + (artOk('g_standard') ? 1 : 0) + '|' + (tribeId() || '') + (tribeId() && MODELS[TRIBES[tribeId()].model] ? '+' : '');   // refait quand le modèle du guerrier est chargé
  if (FP.gunKey !== gk) {
    FP.gunKey = gk; for (const o of [...FP.gun.children]) FP.gun.remove(o);
    for (const o of [...FP.arm.children]) FP.arm.remove(o);
    for (const o of [...FP.arm2.children]) FP.arm2.remove(o);
    FP.arm2.visible = false;
    FP.gun.userData.muzzle = null;
    let rig = false; try { rig = buildFpRig(FP.gun, weaponId()); } catch (e) { rig = false; }
    if (!rig) {
      for (const o of [...FP.gun.children]) FP.gun.remove(o);
      const holder = new T.Group(); holder.rotation.y = Math.PI + FP_GUN_YAW; FP.gun.add(holder);
      const g = new T.Group(); holder.add(g); try { buildGun3D(g, '#3a3550'); } catch (e) {}
      const sz = gripGun(holder, g); holder.scale.setScalar(fpGunScale(sz)); buildFpArm(FP.arm);
    }
  }
  if (p.fireT > FP.fire + 0.001) FP.kick = 1; FP.fire = p.fireT; FP.kick = Math.max(0, (FP.kick || 0) - dt * 9);
  const sw = p.moving ? Math.sin(p.walk * 0.5) : 0;
  // visée : on zoome et l'arme vient se placer sous le réticule
  FP.aimK = clamp((FP.aimK || 0) + (FP.aim ? dt : -dt) * 6, 0, 1); const ak = FP.aimK * FP.aimK * (3 - 2 * FP.aimK);
  const fov = 72 - 30 * ak; if (Math.abs(FP.cam.fov - fov) > 0.01) { FP.cam.fov = fov; FP.cam.updateProjectionMatrix(); }
  FP.gun.position.set(0.21 - FP_AIM[0] * ak + sw * 0.012 * (1 - ak * 0.7), -0.21 + FP_AIM[1] * ak + Math.abs(sw) * 0.01, -0.5 + FP_AIM[2] * ak + FP.kick * 0.05);
  FP.gun.rotation.set(FP.kick * 0.12 * (1 - ak * 0.5), FP_AIM[3] * ak, 0); FP.gun.scale.setScalar(1 - FP_AIM[4] * ak);
  // en visée, la bouche du canon vient se poser juste sous le réticule, quelle que soit l'arme
  if (ak > 0 && FP.gun.userData.muzzle) { FP.gun.updateMatrixWorld(true); const mc = FP.cam.worldToLocal(FP.gun.userData.muzzle.getWorldPosition(FP.mw || (FP.mw = new T.Vector3()))); FP.gun.position.x -= mc.x * ak; FP.gun.position.y += (mc.z * FP_AIM[5] - mc.y) * ak; }
  if (FP.arm2.visible && FP.holder) { FP.holder.updateMatrix(); FP.gun.updateMatrix(); FP.arm2.position.copy(FP.fore).applyMatrix4(FP.holder.matrix).applyMatrix4(FP.gun.matrix); FP.arm2.position.y -= 0.015; }
  FP.arm.position.copy(FP.gun.position).add(FP_ARM_OFF); FP.arm.rotation.set(FP.kick * 0.12 - 0.55, -0.3, 0);
  if (FP.gun.userData.muzzle) { FP.gun.updateMatrixWorld(true); FP.flash.position.copy(FP.cam.worldToLocal(FP.gun.userData.muzzle.getWorldPosition(FP.mw || (FP.mw = new T.Vector3())))); }
  else FP.flash.position.set(0.27, -0.2, -1.0 + FP.kick * 0.05); FP.flash.material.opacity = FP.kick > 0.55 ? 1 : 0; FP.flash.material.rotation = Math.random() * TAU; FP.flash.scale.setScalar(0.22 + Math.random() * 0.12);
  if (G.rage > 0) FP.flash.material.color.set('#ffb070'); else FP.flash.material.color.set('#ffffff');
  r.render(FP.scene, FP.cam);
}
// tourelle de l'ingénieur : socle, tête et canon qui vise, jauge de durée de vie
function fpTurrets() {
  const T = THREE;
  G.turrets.forEach((t, i) => {
    let g = FP.turrets[i];
    if (g && g.userData.skel !== (t.kind === 'skel')) { FP.scene.remove(g); g = FP.turrets[i] = null; }
    if (!g && t.kind === 'skel') g = FP.turrets[i] = fpSkel();
    if (!g) {
      g = new T.Group(); const tm = c => new T.MeshToonMaterial({ color: c, gradientMap: GRAD });
      const base = new T.Mesh(new T.CylinderGeometry(0.42, 0.55, 0.45, 16), tm('#3a3550')); base.position.y = 0.22; g.add(base);
      const head = new T.Group(); head.position.y = 0.7; g.add(head); g.userData.head = head;
      head.add(new T.Mesh(new T.SphereGeometry(0.3, 16, 12), tm('#3db8ff')));
      const barrel = new T.Mesh(new T.BoxGeometry(0.16, 0.16, 0.75), tm('#3db8ff')); barrel.position.z = 0.4; head.add(barrel);
      const tip = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 0.12, 10), tm('#1d1238')); tip.rotation.x = Math.PI / 2; tip.position.z = 0.8; head.add(tip);
      const bar = new T.Mesh(new T.PlaneGeometry(0.9, 0.08), new T.MeshBasicMaterial({ color: '#3df5b0' })); bar.position.y = 1.25; g.add(bar); g.userData.bar = bar;
      FP.scene.add(g); FP.turrets[i] = g;
    }
    g.visible = true; g.position.set(t.x * FPK, 0, t.y * FPK);
    const bar = g.userData.bar; bar.quaternion.copy(FP.cam.quaternion);
    if (g.userData.skel) {
      g.rotation.y = Math.PI / 2 - t.aim; bar.scale.x = Math.max(0.02, t.life / 12);
      const I = g.userData.inst;
      if (I) {
        const now = performance.now(), dt = Math.min(0.1, (now - (g.userData.last || now)) / 1000); g.userData.last = now;
        const moving = t.walk !== g.userData.walk; g.userData.walk = t.walk;
        const anim = t.life < 0.6 ? 'death' : (t.age || 0) < 1.1 ? 'spawn' : t.atkT > 0 ? 'attack' : moving ? 'run' : 'idle';
        if (anim !== g.userData.anim) {
          const a = I.acts[anim]; g.userData.anim = anim;
          if (a) { a.setLoop(anim === 'run' || anim === 'idle' ? THREE.LoopRepeat : THREE.LoopOnce); a.clampWhenFinished = true; }
          I.play(anim, anim === 'spawn' ? 0 : 0.15);
        }
        I.mixer.update(dt * ({ spawn: 3.2, death: 3.4 }[g.userData.anim] || 1));
        return;
      }
      const s = Math.sin(t.walk) * 0.5; g.userData.legs[0].rotation.x = s; g.userData.legs[1].rotation.x = -s;
      g.userData.arms[0].rotation.x = -s - (t.fireT > 0.4 ? 1.2 : 0); g.userData.arms[1].rotation.x = s;
      return;
    }
    g.userData.head.rotation.y = Math.PI / 2 - t.aim;
    bar.scale.x = Math.max(0.02, t.life / 15);
  });
  for (let i = G.turrets.length; i < FP.turrets.length; i++) FP.turrets[i].visible = false;
}
// squelette du nécromancien en 3D : os clairs, crâne aux yeux violets, jauge violette
// squelette KayKit aux couleurs du nécromancien : yeux violets lumineux, cape violette
function skelModel() {
  const m = modelInst('skel'); if (!m) return null;
  const eye = new THREE.MeshBasicMaterial({ color: '#c79bff' });
  m.traverse(o => {
    if (!o.isMesh) return;
    if (/Eyes/.test(o.name)) o.material = eye;
    else if (/Cloak/.test(o.name)) { o.material = o.material.clone(); o.material.color.set('#b98cff'); }
  });
  return m;
}
function fpSkel() {
  const T = THREE;
  const m = skelModel();
  if (m) {
    const bar = new T.Mesh(new T.PlaneGeometry(0.8, 0.07), new T.MeshBasicMaterial({ color: '#b78cff' })); bar.position.y = 1.75; m.add(bar);
    m.userData.bar = bar; m.userData.skel = true; FP.scene.add(m); return m;
  }
  const g = new T.Group(), bone = new T.MeshToonMaterial({ color: '#efe8d8', gradientMap: GRAD });
  const eye = new T.MeshBasicMaterial({ color: '#b78cff' });
  const limb = (x, y, h) => { const piv = new T.Group(); piv.position.set(x, y, 0); const m = new T.Mesh(new T.CylinderGeometry(0.06, 0.05, h, 6), bone); m.position.y = -h / 2; piv.add(m); g.add(piv); return piv; };
  g.userData.legs = [limb(-0.13, 0.55, 0.55), limb(0.13, 0.55, 0.55)];
  g.userData.arms = [limb(-0.3, 1.05, 0.5), limb(0.3, 1.05, 0.5)];
  const ribs = new T.Mesh(new T.CylinderGeometry(0.22, 0.16, 0.5, 8), bone); ribs.position.y = 0.82; g.add(ribs);
  const skull = new T.Mesh(new T.SphereGeometry(0.24, 12, 10), bone); skull.position.y = 1.3; g.add(skull);
  for (const x of [-0.09, 0.09]) { const e = new T.Mesh(new T.SphereGeometry(0.05, 8, 6), eye); e.position.set(x, 1.32, 0.2); g.add(e); }
  const bar = new T.Mesh(new T.PlaneGeometry(0.8, 0.07), new T.MeshBasicMaterial({ color: '#b78cff' })); bar.position.y = 1.75; g.add(bar); g.userData.bar = bar;
  g.userData.skel = true; FP.scene.add(g); return g;
}
// eau et lave qui bougent : la zone est redessinée (même dessin animé que vue de dessus) et posée sur le sol 3D
function fpWater() {
  const T = THREE, Wt = biome && !G.dungeon ? biome.water : null, lava = biome && !G.dungeon && biome.lava && biome.lava.length;
  if (!Wt && !lava) { if (FP.water) FP.water.visible = false; return; }
  const box = lava ? [0, 0, WORLD, WORLD] : [Math.max(0, Wt.box[0]), Math.max(0, Wt.box[1]), Math.min(WORLD, Wt.box[2]), Math.min(WORLD, Wt.box[3])];
  const w = box[2] - box[0], h = box[3] - box[1], k = Math.min(lava ? 0.3 : 0.5, cv.width / w, cv.height / h), cw = Math.floor(w * k), ch = Math.floor(h * k);
  if (!FP.water || FP.waterKey !== FP.key + '|' + cw + 'x' + ch) {
    if (FP.water) { FP.scene.remove(FP.water); FP.water.geometry.dispose(); FP.water.material.map.dispose(); }
    FP.waterKey = FP.key + '|' + cw + 'x' + ch; FP.waterC = document.createElement('canvas'); FP.waterC.width = cw; FP.waterC.height = ch;
    const tex = new T.CanvasTexture(FP.waterC); tex.encoding = T.sRGBEncoding;
    FP.water = new T.Mesh(new T.PlaneGeometry(w * FPK, h * FPK), new T.MeshBasicMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -2 }));
    FP.water.rotation.x = -Math.PI / 2; FP.water.position.set((box[0] + w / 2) * FPK, 0.005, (box[1] + h / 2) * FPK); FP.scene.add(FP.water); FP.waterT = 0;
  }
  FP.water.visible = true;
  if ((FP.waterT = (FP.waterT || 0) + 1) % 3 !== 1) return;
  ctx.save(); ctx.setTransform(k, 0, 0, k, -box[0] * k, -box[1] * k); try { drawFloor(box[0], box[1], w, h); } catch (e) {} ctx.restore();
  const g = FP.waterC.getContext('2d'); g.clearRect(0, 0, cw, ch); g.drawImage(cv, 0, 0, cw, ch, 0, 0, cw, ch); FP.water.material.map.needsUpdate = true;
}
// un monstre en 3D : pris dans une réserve par modèle (pas de création à chaque vague), animé, tourné vers le joueur
function fpMonster3D(z, D, p) {
  let e = FP.mon.get(z);
  if (!e) {
    const pool = FP.pool[D.model] || (FP.pool[D.model] = []); let g = pool.pop();
    if (!g) {
      g = modelInst(D.model); if (!g) return false;
      const I = g.userData.inst, name = D.clip && Object.keys(I.acts).find(n => n === D.clip || n.endsWith('|' + D.clip));
      g.userData.fpClip = name ? I.clip(name) : null; if (g.userData.fpClip) I.mixer.clipAction(g.userData.fpClip).play();
      g.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
      FP.scene.add(g);
    }
    e = { g, model: D.model }; FP.mon.set(z, e);
  }
  const g = e.g, c = g.userData.fpClip, S = z.r * 5.6 * (D.sc || 1);
  e.seen = FP.frame; g.visible = true;
  // un boss collé au joueur reste devant lui (sinon la caméra se retrouve dans son corps)
  let bx = z.x, by = z.y;
  if (z.type === 'boss') { const dx = z.x - p.x, dy = z.y - p.y, d = Math.hypot(dx, dy), m = z.r * 1.6; if (d < m) { const ux = d > 1 ? dx / d : Math.cos(FP.yaw), uy = d > 1 ? dy / d : Math.sin(FP.yaw); bx = p.x + ux * m; by = p.y + uy * m; } }
  g.position.set(bx * FPK, (z.lift || 0) * FPK, by * FPK); g.rotation.y = Math.atan2(p.x - bx, p.y - by);
  g.scale.setScalar(S / (2 * D.ext) * FPK * 1.3 * (z.flash > 0 ? 1.08 : 1));
  const I = g.userData.inst;
  if (z.down > 0) {
    const dc = I.clip('Death');
    if (!g.userData.downPlay) { I.mixer.stopAllAction(); I.mixer.clipAction(dc).play(); g.userData.downPlay = true; }
    I.mixer.setTime(dc.duration * Math.min(0.999, ghoulDownFrame(z) / 7));
    return true;
  }
  if (g.userData.downPlay) { I.mixer.stopAllAction(); if (c) I.mixer.clipAction(c).play(); g.userData.downPlay = false; }
  if (c) I.mixer.setTime(((G.t + (z.wob || 0)) * (z.speed > 90 ? 1.6 : 1)) % c.duration);
  else g.position.y = Math.abs(Math.sin((G.t + (z.wob || 0)) * 8)) * 0.06;
  return true;
}
// familier en 3D : il marche devant, un peu à gauche, pour qu'on le voie tirer
function fpPet(dt) {
  const pet = G.pet;
  if (!pet || !PETS[pet.id]) { if (FP.pet) FP.pet.visible = false; return; }
  if (!FP.pet || FP.pet.userData.petId !== pet.id) {
    if (FP.pet) FP.scene.remove(FP.pet);
    FP.pet = buildPet3D(pet.id); FP.pet.userData.petId = pet.id; FP.pet.scale.setScalar(0.75); FP.scene.add(FP.pet);
  }
  const P = PETS[pet.id], g = FP.pet; g.visible = true;
  g.position.set(pet.x * FPK, P.fly ? 0.5 : 0, pet.y * FPK);
  const z = nearest(pet.x, pet.y, 420), a = z ? Math.atan2(z.y - pet.y, z.x - pet.x) : (pet.moving ? pet.dir : FP.yaw);
  g.rotation.y = Math.PI / 2 - a;
  animPet3D(g, pet.t, pet.moving);
}
// tir automatique en 1re personne : seulement les monstres dans le champ de vision (devant soi)
function nearestAhead(x, y, range) {
  // en visée : le monstre le plus près du réticule (cône étroit, un peu plus loin) ; sinon le tir continue comme d'habitude
  if (FP.aim) {
    let best = null, ba = 0.2; const R = range * 1.25;
    for (const z of G.zombies) {
      if (z.dead || d2(x, y, z.x, z.y) >= R * R) continue;
      let da = Math.atan2(z.y - y, z.x - x) - FP.yaw; da = Math.abs(Math.atan2(Math.sin(da), Math.cos(da)));
      if (da < ba) { ba = da; best = z; }
    }
    if (best) return best;
  }
  let best = null, bd = range * range;
  for (const z of G.zombies) {
    if (z.dead) continue; const dd = d2(x, y, z.x, z.y); if (dd >= bd) continue;
    let da = Math.atan2(z.y - y, z.x - x) - FP.yaw; da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) < 0.55 || dd < 70 * 70) { bd = dd; best = z; }
  }
  return best;
}
// bouton Viser (1re personne) : zoom, arme ramenée au centre, tir resserré sur le réticule
function setAim(on) {
  FP.aim = !!on && fpOn(); $('bAim').classList.toggle('on', FP.aim); $('fpCross').classList.toggle('aim', FP.aim);
}
function setView(v) {
  save.bview = v; persist(); setAim(false);
  $('viewBtn').classList.toggle('on', v === 'fp'); $('fpCross').hidden = v !== 'fp';
  if (v === 'fp' && G) { const p = coop.active && session.role === 'guest' ? G.ally : G.p; if (p) FP.yaw = G.dungeon ? -Math.PI / 2 : (p.aim || -Math.PI / 2); }
  $('fpv').hidden = v !== 'fp' || !G;
  resetJoy();
}
$('viewBtn').addEventListener('click', e => { e.stopPropagation(); setView(save.bview === 'fp' ? 'top' : 'fp'); });
$('speedHud').addEventListener('click', e => { e.stopPropagation(); if (coop.active || G?.dungeon) return; save.speed2 = !save.speed2; persist(); refreshSpeedBtn(); });

// ---------- Contrôles ----------
const JOY_R = 62;
cv.addEventListener('pointerdown', e => {
  if (state !== 'play') return;
  // en 1re personne, la moitié droite de l'écran sert à tourner la tête
  if (fpOn() && e.clientX > innerWidth * 0.5 && FP.look.id === null) { e.preventDefault(); FP.look.id = e.pointerId; FP.look.x = e.clientX; try { cv.setPointerCapture(e.pointerId); } catch (err) {} return; }
  if (joy.id !== null) return;
  e.preventDefault();
  joy.id = e.pointerId; joy.ox = joy.x = e.clientX; joy.oy = joy.y = e.clientY; joy.dx = joy.dy = 0;
  try { cv.setPointerCapture(e.pointerId); } catch (err) {}
});
cv.addEventListener('pointermove', e => {
  if (e.pointerId === FP.look.id) { FP.yaw += (e.clientX - FP.look.x) * (FP.aim ? 0.003 : 0.0062); FP.look.x = e.clientX; return; }
  if (e.pointerId !== joy.id) return;
  let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
  const l = Math.hypot(dx, dy);
  if (l > JOY_R * 1.6) { joy.ox = e.clientX - dx / l * JOY_R * 1.6; joy.oy = e.clientY - dy / l * JOY_R * 1.6; dx = e.clientX - joy.ox; dy = e.clientY - joy.oy; }
  const m = Math.min(1, Math.hypot(dx, dy) / JOY_R), a = Math.atan2(dy, dx);
  joy.dx = m < 0.12 ? 0 : Math.cos(a) * m; joy.dy = m < 0.12 ? 0 : Math.sin(a) * m;
});
const endJoy = e => { if (e.pointerId === FP.look.id) FP.look.id = null; if (e.pointerId === joy.id) resetJoy(); };
cv.addEventListener('pointerup', endJoy);
cv.addEventListener('pointercancel', endJoy);
cv.addEventListener('lostpointercapture', endJoy);
document.addEventListener('contextmenu', e => e.preventDefault());

function bindAct(id, fn) {
  const el = $(id);
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('pressed'); fn(); });
  const up = () => el.classList.remove('pressed');
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
}
bindAct('bDash', doDash); bindAct('bGren', doGrenade); bindAct('bUlt', doUlt); bindAct('bAim', () => setAim(!FP.aim));

addEventListener('keydown', e => {
  if(e.target.closest?.('input,textarea,[contenteditable=true]'))return;
  keys[e.code] = true;
  if (state === 'play') {
    if (e.code === 'Space') { e.preventDefault(); doDash(); }
    else if (e.code === 'KeyE') doGrenade();
    else if (e.code === 'KeyR') doUlt();
    else if (e.code === 'Escape' || e.code === 'KeyP') pauseGame();
  } else if (state === 'pause' && (e.code === 'Escape' || e.code === 'KeyP')) { state = 'play'; showOnly('play'); }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// =====================================================================
// ---------- Village 3D ----------
// =====================================================================
const BUILD = {
  hdv:        { name: 'Hôtel de ville', max: 5, cost: [0, 0, 250, 600, 1200, 2000], time: [0, 0, 30, 120, 300, 600], collide: 4.3,
                desc: 'Le cœur du village. Son niveau fixe le niveau maximum des autres bâtiments.' },
  portail:    { name: 'Portail', max: 1, collide: 1.8, desc: 'La fontaine magique de la place : plonge dans ses eaux pour défendre le bastion contre les vagues de monstres.' },
  mine:       { name: 'Mine d’or', max: 5, cost: [0, 0, 80, 200, 450, 800], time: [0, 0, 15, 60, 180, 420], collide: 3.3,
                desc: 'Produit des pièces même quand tu ne joues pas. Viens les récolter.' },
  armurerie:  { name: 'Armurerie', max: 5, cost: [0, 0, 120, 300, 600, 1000], time: [0, 0, 20, 60, 180, 480], collide: 3.1,
                desc: 'Des armes plus puissantes dans le Bastion. Boutique d’armes et de skins d’armes.' },
  infirmerie: { name: 'Infirmerie', max: 5, cost: [0, 0, 120, 300, 600, 1000], time: [0, 0, 20, 60, 180, 480], collide: 3.1,
                desc: 'Plus de PV et de la régénération dans le Bastion.' },
  forge:      { name: 'Forge', max: 5, cost: [0, 0, 120, 300, 600, 1000], time: [0, 0, 20, 60, 180, 480], collide: 3.1,
                desc: 'Grenades plus fortes, ultime et roulade qui rechargent plus vite.' },
  labo:       { name: 'Laboratoire', max: 5, cost: [0, 0, 120, 300, 600, 1000], time: [0, 0, 20, 60, 180, 480], collide: 2.9,
                desc: 'Plus d’XP en partie et plus de choix d’amélioration.' },
  caserne:    { name: 'Caserne', max: 5, cost: [0, 0, 150, 350, 650, 1100], time: [0, 0, 20, 60, 180, 480], collide: 3.1,
                desc: 'Débloque les classes et entraîne ta vitesse.' },
  maison:     { name: 'Ma maison', max: 1, collide: 2.8, desc: 'Ta maison : entre, décore-la, assieds-toi, et va dormir (au réveil, le jour ou la nuit est tombé).' },
  garde:      { name: 'Garde-robe', max: 1, collide: 2.9, desc: 'Apparence, équipements et objivants : essaie tout et achète ici.' },
};
const POS = { hdv: [0, -15.5], portail: [0, 6.5], mine: [13.5, -10.5], armurerie: [-13.5, -10.5], infirmerie: [-14.5, 3.5], forge: [14.5, 3.5],
  labo: [11.5, 14], caserne: [-11.5, 14], garde: [0, 15.5], maison: [-14.5, -3.5] };
const PLAZA = [0, 6.5];
const WALL = 20.5;          // demi-côté du rempart carré
const HUT = [7, -10];       // cabane de l'ouvrier
const CAMP = [-6.8, -10];   // feu de camp
const MINE_RATE = [0, 120, 200, 320, 480, 700], MINE_CAP = [0, 40, 90, 180, 320, 500];
// Les bâtiments montent jusqu'au niveau 15 : on prolonge les coûts, durées et productions des niveaux 6 à 15
const LVL_MAX = 15;
for (let l = 6; l <= LVL_MAX; l++) { MINE_RATE[l] = Math.round(MINE_RATE[l - 1] * 1.28 / 10) * 10; MINE_CAP[l] = Math.round(MINE_CAP[l - 1] * 1.3 / 10) * 10; }
for (const id in BUILD) {
  const B = BUILD[id]; if (B.max === 1) continue;
  B.max = LVL_MAX;
  for (let l = 6; l <= LVL_MAX; l++) { B.cost[l] = Math.round(B.cost[l - 1] * 1.32 / 50) * 50; B.time[l] = Math.min(4 * 3600, Math.round(B.time[l - 1] * 1.45 / 30) * 30); }
}
// Bonus des bâtiments (les mêmes formules servent pour la partie et pour les textes du panneau)
const LV = {
  crit: A => 0.05 * ((A >= 3) + (A >= 8) + (A >= 13)),
  pierce: A => (A >= 5) + (A >= 10) + (A >= 15),
  regen: I => I >= 15 ? 3 : I >= 11 ? 2 : I >= 8 ? 1.5 : I >= 5 ? 1 : I >= 3 ? 0.5 : 0,
  ult: F => 0.07 * (Math.min(F, 5) - 1) + 0.03 * Math.max(0, F - 5),
  dash: F => F >= 12 ? 0.45 : F >= 9 ? 0.35 : F >= 4 ? 0.2 : 0,
  speed: C => 0.03 * (Math.min(C, 5) - 1) + 0.02 * Math.max(0, C - 5),
  // la Caserne ne donne plus de drones : les 3 boules qui tournaient autour du héros gênaient la vue sans servir
  drones: C => 0,
  magnet: L => 0.08 * Math.max(0, L - 5),
  choices: L => L >= 12 ? 5 : L >= 4 ? 4 : 3,
};
const lvl = id => (visitingVillage?.b||save.b)[id] || 1;
const fmtTime = s => { s = Math.max(0, Math.ceil(s)); const m = Math.floor(s / 60), r = s % 60; return m >= 60 ? Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') : m + ':' + String(r).padStart(2, '0'); };

function bonus(id, l) {
  const out = [];
  const pc = v => Math.round(v * 100), fr = v => String(v).replace('.', ',');
  if (id === 'armurerie') { if (l > 1) out.push('+' + 10 * (l - 1) + ' % de dégâts'); if (LV.crit(l)) out.push('+' + pc(LV.crit(l)) + ' % de coups critiques'); if (LV.pierce(l)) out.push('Balles perforantes (+' + LV.pierce(l) + ')'); }
  else if (id === 'infirmerie') { if (l > 1) out.push('+' + 15 * (l - 1) + ' PV max'); if (LV.regen(l)) out.push('Régénération +' + fr(LV.regen(l)) + ' PV/s'); }
  else if (id === 'forge') { if (l > 1) { out.push('Grenades +' + 20 * (l - 1) + ' %'); out.push('Ultime −' + pc(LV.ult(l)) + ' % de recharge'); } if (LV.dash(l)) out.push('Roulade −' + pc(LV.dash(l)) + ' % de recharge'); }
  else if (id === 'labo') { if (l > 1) out.push('+' + 10 * (l - 1) + ' % d’XP'); if (LV.choices(l) > 3) out.push(LV.choices(l) + ' choix d’amélioration au lieu de 3'); if (LV.magnet(l)) out.push('Aimant à gemmes +' + pc(LV.magnet(l)) + ' %'); }
  else if (id === 'caserne') {
    out.push('Classes : ' + Object.values(CLASSES).filter(c => c.req <= l).map(c => c.name).join(', '));
    if (l > 1) out.push('+' + pc(LV.speed(l)) + ' % de vitesse');
    if (LV.drones(l)) out.push('+' + LV.drones(l) + ' drone' + (LV.drones(l) > 1 ? 's' : '') + ' de combat');
  }
  else if (id === 'mine') { out.push(MINE_RATE[l] + ' pièces par heure'); out.push('Stock max : ' + MINE_CAP[l]); }
  else if (id === 'hdv') { out.push('Bâtiments jusqu’au niveau ' + Math.min(LVL_MAX, l + 1)); }
  return out.length ? out : ['Pas encore de bonus'];
}
function mineStock() {
  const l = lvl('mine');
  return Math.min(MINE_CAP[l], Math.floor((Date.now() - save.mineLast) / 3600000 * MINE_RATE[l]));
}
function canUpgrade(id) {
  const B = BUILD[id], l = lvl(id);
  if (l >= B.max) return { ok: false, why: B.max === 1 ? '' : 'Niveau maximum atteint' };
  if (save.build) return { ok: false, why: 'L’ouvrier construit déjà : ' + BUILD[save.build.id].name };
  if (id !== 'hdv' && l + 1 > lvl('hdv') + 1) return { ok: false, why: 'Il faut l’Hôtel de ville niveau ' + l };
  if (save.coins < B.cost[l + 1]) return { ok: false, why: 'Il te manque ' + (B.cost[l + 1] - save.coins) + ' pièces' };
  return { ok: true };
}

const V = { ok: false, yaw: 0.35, zoom: 1.3, near: null, panelT: 0, labelT: 0, cam: null, P: { x: 2.5, z: 10, rot: Math.PI, walk: 0 }, bld: {}, colliders: [], smoke: [], time: 0 };
const vjoy = { id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
const vcam = { id: null, x: 0, pts: new Map(), pinch: 0, z0: 1 };

function initVillage() {
  if (!window.THREE) throw new Error('three manquant');
  const T = THREE;
  const canvas = $('village');
  const renderer = oldLook(new T.WebGLRenderer({ canvas, antialias: true, alpha: true }));
  renderer.setPixelRatio(gfxPixelRatio());
  renderer.setSize(W, H, false);
  renderer.setClearColor(0x000000, 0);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;   // les ombres sont recalculées une image sur deux (ou quatre en mode fluide)
  const scene = new T.Scene();
  scene.fog = new T.Fog('#bfe9ff', 48, 90);
  const camera = new T.PerspectiveCamera(45, W / H, 0.5, 220);
  const hemi = new T.HemisphereLight('#ffeed6', '#3d4f7a', 0.38), amb = new T.AmbientLight('#ffffff', 0.05);
  scene.add(hemi); scene.add(amb);
  const sun = new T.DirectionalLight('#fff2c8', 1.15);
  sun.position.set(-16, 34, 20); sun.castShadow = true;
  sun.shadow.mapSize.set(768, 768);
  Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 100 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  scene.add(sun);
  const rim = new T.DirectionalLight('#7fc4ff', 0.32); rim.position.set(20, 13, -24); scene.add(rim);
  Object.assign(V, { sun, hemi, amb });
  Object.assign(V, { T, renderer, scene, camera, ok: true });
  try {
    const vb = document.createElement('div'); vb.id = 'dbVersionBadge'; vb.textContent = 'v…';
    vb.style.cssText = 'position:fixed;right:8px;bottom:44px;padding:3px 8px;border-radius:8px;background:rgba(20,14,40,.45);font:600 11px/1.2 system-ui,sans-serif;color:rgba(255,233,168,.75);pointer-events:none;z-index:99999;transition:opacity .6s';
    document.body.appendChild(vb);
    fetch('manifest.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => { if (j && j.version) vb.textContent = 'v' + verName(j.version); }).catch(() => {});
    setTimeout(() => { vb.style.opacity = '0'; setTimeout(() => { try { vb.remove(); } catch (e) {} }, 800); }, 12000);
  } catch (e) {}
  GRAD = new T.DataTexture(new Uint8Array([86, 86, 98, 255, 176, 176, 188, 255, 255, 255, 255, 255]), 3, 1, T.RGBAFormat);
  GRAD.minFilter = GRAD.magFilter = T.NearestFilter; GRAD.generateMipmaps = false; GRAD.needsUpdate = true;
  makeTextures(); whenTex(applyGroundSurfaces); applyKitTextures();

  // Prairie en damier (grande, elle se perd dans la brume)
  const ground = new T.Mesh(new T.PlaneGeometry(140, 140), mat('#ffffff', { tex: 'grass', rep: [11, 11] }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  // Place pavée + fontaine
  const plaza = new T.Mesh(new T.CircleGeometry(3.6, 28), mat('#e9dcc0', { tex: 'cobble', rep: [2.4, 2.4], polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1 }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(PLAZA[0], 0.07, PLAZA[1]); plaza.receiveShadow = true; scene.add(plaza);
  const fountain = new T.Group(); fountain.position.set(PLAZA[0], 0, PLAZA[1]); scene.add(fountain);
  mk(new T.CylinderGeometry(1.6, 1.75, 0.7, 16), mat('#d9d3e6', { tex: 'stone', rep: [4, 0.6] }), 0, 0.35, 0, fountain);
  // Textures d'eau animées (la peinture Canva, et ses reflets clairs par-dessus)
  const wc = document.createElement('canvas'), cc = document.createElement('canvas'); wc.width = wc.height = cc.width = cc.height = 512;
  wc.getContext('2d').fillStyle = '#4fc8e0'; wc.getContext('2d').fillRect(0, 0, 512, 512);
  V.waterTex = new T.CanvasTexture(wc); V.causTex = new T.CanvasTexture(cc);
  for (const tx of [V.waterTex, V.causTex]) { tx.wrapS = tx.wrapT = T.RepeatWrapping; }
  whenTex(() => { wc.getContext('2d').drawImage(texTile('water'), 0, 0); cc.getContext('2d').drawImage(causticTile(), 0, 0); V.waterTex.needsUpdate = V.causTex.needsUpdate = true; });
  const waterMat = new T.MeshToonMaterial({ color: '#9fd0e0', map: V.waterTex, gradientMap: GRAD });
  const causMat = new T.MeshBasicMaterial({ map: V.causTex, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false });
  const wTop = new T.Mesh(new T.CircleGeometry(1.36, 24), waterMat); wTop.rotation.x = -Math.PI / 2; wTop.position.y = 0.715; fountain.add(wTop);
  const cTop = new T.Mesh(new T.CircleGeometry(1.36, 24), causMat); cTop.rotation.x = -Math.PI / 2; cTop.position.y = 0.72; fountain.add(cTop);
  // Gouttes qui jaillissent de la vasque et retombent dans le bassin
  V.drops = new T.InstancedMesh(new T.SphereGeometry(0.07, 6, 5), mat('#c8f2ff', { emissive: '#3a8aa8' }), 36);
  V.drops.position.set(PLAZA[0], 0, PLAZA[1]); scene.add(V.drops);
  mk(new T.CylinderGeometry(0.28, 0.36, 1.5, 10), mat('#d9d3e6', { tex: 'stone', rep: [1, 1] }), 0, 1.1, 0, fountain);
  mk(new T.CylinderGeometry(0.7, 0.45, 0.25, 12), mat('#d9d3e6', { tex: 'stone', rep: [2, 0.3] }), 0, 1.9, 0, fountain);
  V.spout = mk(new T.SphereGeometry(0.32, 12, 10), mat('#8fe0ff', { transparent: true, opacity: 0.85 }), 0, 2.2, 0, fountain);
  V.colliders.push({ x: PLAZA[0], z: PLAZA[1], r: 1.8 });
  // Chemins pavés vers chaque porte (posés après la création des bâtiments, voir plus bas)

  // Deux parterres fleuris de chaque côté de l'allée de l'Hôtel de ville
  const fcols = ['#ff5fa8', '#ffd23f', '#ffffff', '#b46bff', '#ff7a45'];
  for (const s of [-1, 1]) {
    const gdn = new T.Group(); gdn.position.set(s * 3.0, 0, -2.2); scene.add(gdn);
    mk(new T.CylinderGeometry(1.15, 1.25, 0.35, 20), mat('#d9d3e6', { tex: 'stone', rep: [3, 0.4] }), 0, 0.17, 0, gdn);
    mk(new T.CylinderGeometry(1.02, 1.02, 0.06, 20), '#6a4a30', 0, 0.36, 0, gdn);
    for (let i = 0; i < 20; i++) { const a = i * 2.4, r = 0.3 + (i % 3) * 0.25; mk(new T.SphereGeometry(0.09, 6, 5), fcols[i % 5], Math.cos(a) * r, 0.45, Math.sin(a) * r, gdn).userData.noOutline = true; }
    mk(new T.CylinderGeometry(0.07, 0.1, 0.8, 8), '#7a4a2a', 0, 0.75, 0, gdn);
    for (const [x, y, z, r] of [[0, 1.35, 0, 0.45], [0.25, 1.2, 0.15, 0.32], [-0.25, 1.22, -0.1, 0.32]]) mk(new T.SphereGeometry(r, 14, 10), s > 0 ? '#f29abb' : '#4cae3f', x, y, z, gdn);
    V.colliders.push({ x: s * 3.0, z: -2.2, r: 1.3 });
  }

  // Rempart en pierre (carré) avec piliers et torches
  const segGeo = BX(2.0, 1.1, 0.8), postGeo = BX(1.05, 1.5, 1.05), capGeo = BX(1.2, 0.22, 1.2);
  const segs = [], posts = [];
  for (let i = -WALL; i <= WALL + 0.01; i += 2.05) {
    posts.push([i, -WALL], [i, WALL]);
    if (Math.abs(i) < WALL - 0.1) posts.push([-WALL, i], [WALL, i]);
  }
  for (let i = -WALL + 1.025; i < WALL; i += 2.05) segs.push([i, -WALL, 0], [i, WALL, 0], [-WALL, i, 1], [WALL, i, 1]);
  const wallMat = mat('#c9c3d8', { tex: 'stone', rep: [1.6, 0.9] }), postMat = mat('#b3abc8', { tex: 'stone', rep: [0.9, 1.2] });
  const segIM = new T.InstancedMesh(segGeo, wallMat, segs.length), postIM = new T.InstancedMesh(postGeo, postMat, posts.length), capIM = new T.InstancedMesh(capGeo, mat('#ece6f5'), posts.length);
  const dm = new T.Object3D();
  segs.forEach(([a, b, rot], i) => { if (rot) { dm.position.set(a, 0.55, b); dm.rotation.set(0, Math.PI / 2, 0); } else { dm.position.set(a, 0.55, b); dm.rotation.set(0, 0, 0); } dm.updateMatrix(); segIM.setMatrixAt(i, dm.matrix); });
  posts.forEach(([x, z], i) => {
    dm.rotation.set(0, 0, 0); dm.position.set(x, 0.75, z); dm.updateMatrix(); postIM.setMatrixAt(i, dm.matrix);
    dm.position.set(x, 1.6, z); dm.updateMatrix(); capIM.setMatrixAt(i, dm.matrix);
  });
  for (const im of [segIM, postIM, capIM]) { im.castShadow = true; im.receiveShadow = true; scene.add(im); }
  V.torches = [];
  for (const [x, z] of [[-WALL, -8], [-WALL, 8], [WALL, -8], [WALL, 8], [-8, WALL], [8, WALL], [-8, -WALL], [8, -WALL]]) {
    mk(new T.CylinderGeometry(0.07, 0.09, 0.7, 6), '#6b4430', x, 2.05, z, scene);
    V.torches.push(mk(new T.ConeGeometry(0.2, 0.5, 7), mat('#ffb02e', { emissive: '#ff7a00' }), x, 2.6, z, scene));
  }

  // Rivière qui serpente au sud du village, avec ses berges de sable
  const riverZ = x => WALL + 5.2 + Math.sin(x * 0.13) * 1.4 + Math.sin(x * 0.37) * 0.5;
  const strip = (half, y, tex, rep) => {
    const pos = [], uv = [], idx = [];
    for (let i = 0, x = -70; x <= 70; x += 1, i++) {
      const z = riverZ(x);
      pos.push(x, y, z - half, x, y, z + half); uv.push(x / rep, 0, x / rep, half * 2 / rep);
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  };
  const sandC = document.createElement('canvas'); sandC.width = sandC.height = 512; sandC.getContext('2d').fillStyle = '#e8d49a'; sandC.getContext('2d').fillRect(0, 0, 512, 512);
  const sandTex = new T.CanvasTexture(sandC); sandTex.wrapS = sandTex.wrapT = T.RepeatWrapping;
  whenTex(() => { sandC.getContext('2d').drawImage(texTile('sand', '#e8d49a', 0.7, 0.35), 0, 0); sandTex.needsUpdate = true; });
  const bank = new T.Mesh(strip(1.75, 0.02, null, 6), new T.MeshToonMaterial({ color: '#ffffff', map: sandTex, gradientMap: GRAD })); bank.receiveShadow = true; scene.add(bank);
  const river = new T.Mesh(strip(1.15, 0.05, null, 5), new T.MeshToonMaterial({ color: '#86b8cc', map: V.waterTex, gradientMap: GRAD })); river.receiveShadow = true; scene.add(river);
  const rCaus = new T.Mesh(strip(1.15, 0.06, null, 4), new T.MeshBasicMaterial({ map: V.causTex, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false })); scene.add(rCaus);
  V.riverMats = [river.material.map, rCaus.material.map];
  // Écume le long des berges
  const foam = new T.Mesh(strip(1.3, 0.045, null, 5), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, depthWrite: false })); scene.add(foam);
  V.foam = foam;
  // Petits galets sur les berges
  for (let i = 0; i < 40; i++) { const x = rnd(-60, 60), s = Math.random() < 0.5 ? -1 : 1, z = riverZ(x) + s * rnd(1.3, 1.75); const r = mk(new T.DodecahedronGeometry(rnd(0.1, 0.22), 0), '#b8b0a8', x, 0.08, z, scene); r.scale.y = 0.6; }
  // Forêt tout autour du village
  const pines = [], rounds = [], bushes = [];
  const nearRiver = (x, z) => Math.abs(z - riverZ(x)) < 2.3;
  for (let i = 0; i < 260; i++) {
    const x = rnd(-46, 46), z = rnd(-46, 46), m = Math.max(Math.abs(x), Math.abs(z));
    if (m < WALL + 2.4) continue;
    if (nearRiver(x, z)) continue;
    (Math.random() < 0.25 ? pines : rounds).push([x, z, rnd(0.8, 1.5), rnd(0, TAU)]);
  }
  for (let i = 0; i < 70; i++) {
    const side = i % 4, t = rnd(-WALL + 1.5, WALL - 1.5), off = WALL - 1.25;
    const [x, z] = side === 0 ? [t, -off] : side === 1 ? [t, off] : side === 2 ? [-off, t] : [off, t];
    if (Object.entries(POS).some(([id, p]) => Math.hypot(x - p[0], z - p[1]) < BUILD[id].collide + 1)) continue;
    if (Math.abs(x) < 4.5 && z < 0) continue;
    bushes.push([x, z, rnd(0.6, 1.0), rnd(0, TAU)]);
  }
  for (let i = 0; i < 60; i++) {
    const x = rnd(-WALL - 6, WALL + 6), z = rnd(-WALL - 6, WALL + 6), m = Math.max(Math.abs(x), Math.abs(z));
    if (m > WALL + 1.6 && m < WALL + 6 && !nearRiver(x, z)) bushes.push([x, z, rnd(0.7, 1.2), rnd(0, TAU)]);
  }
  // La forêt est découpée en grandes parcelles de 32 m : la tablette ne dessine que celles que la caméra voit
  const chunked = (geo, material, list, posOf, put) => {
    const cells = new Map();
    list.forEach(it => { const [x, , z] = posOf(it), k = Math.floor(x / 32) + "," + Math.floor(z / 32); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(it); });
    const out = [];
    for (const items of cells.values()) {
      const g2 = new T.BufferGeometry(); for (const n in geo.attributes) g2.setAttribute(n, geo.attributes[n]); g2.setIndex(geo.index);
      const im = new T.InstancedMesh(g2, material, items.length), box = new T.Box3(), v = new T.Vector3();
      items.forEach((it, i) => { put(im, i, it); im.getMatrixAt(i, dm.matrix); v.setFromMatrixPosition(dm.matrix); box.expandByPoint(v); });
      g2.boundingSphere = box.getBoundingSphere(new T.Sphere()); g2.boundingSphere.radius += 6;
      scene.add(im); out.push(im);
    }
    return out;
  };
  const inst = (geo, material, list, f) => {
    const im = new T.InstancedMesh(geo, material, list.length);
    list.forEach((it, i) => { f(dm, it); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix); });
    im.castShadow = true; im.receiveShadow = true; scene.add(im); return im;
  };
  // Arbres façon Dofus : touffes rondes couvertes de petites feuilles peintes, contour sombre, qui ondulent au vent
  const leafTex = canvasTex(256, (g, n) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, n, n);
    const R = seeded(99);
    for (let k = 0; k < 420; k++) {
      const x = R() * n, y = R() * n, r = 7 + R() * 9, dark = R() < 0.6;
      for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) {
        g.strokeStyle = dark ? 'rgba(60,80,40,.35)' : 'rgba(255,255,220,.8)'; g.lineWidth = 2.4;
        g.beginPath(); g.arc(x + ox, y + oy, r, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
      }
    }
  });
  leafTex.repeat.set(2, 1);
  const wind = (m) => { m.onBeforeCompile = sh => { sh.uniforms.uTime = V.wind; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    #ifdef USE_INSTANCING
      float wph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
    #else
      float wph = 0.0;
    #endif
    transformed.x += sin(uTime * 1.4 + wph) * 0.06 * (position.y + 1.0);
    transformed.z += cos(uTime * 1.1 + wph) * 0.045 * (position.y + 1.0);`); }; return m; };
  V.wind = { value: 0 };
  const leafMat = wind(new T.MeshToonMaterial({ color: '#ffffff', map: leafTex, gradientMap: GRAD }));
  const lineMat = wind(new T.MeshBasicMaterial({ color: '#23301a', side: T.BackSide }));
  const trunkMat = mat('#8a5a3a', { tex: 'wood', rep: [1, 1] });
  // touffes : position (relative au pied, à l'échelle de l'arbre), rayon
  // 5 touffes par arbre (les deux cachées au cœur du feuillage ont été retirées : moins de triangles pour la tablette)
  const roundLumps = [[0, 2.7, 0, 1.3], [0.95, 2.3, 0.3, 1.0], [-0.9, 2.35, -0.2, 1.0], [-0.15, 3.45, 0.1, 0.92], [0.15, 2.2, 0.85, 0.95]];
  const pal = ['#58c04a', '#4cae3f', '#6fcf4a', '#3f9f4a', '#58c04a', '#f29abb', '#4cae3f', '#f0b43a'].map(c => new T.Color(c));
  const lumps = [];
  for (const [x, z, s, r] of rounds) {
    const hh = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453, col = pal[Math.floor((hh - Math.floor(hh)) * pal.length)];
    for (const [lx, ly, lz, lr] of roundLumps) {
      const c = Math.cos(r), sn = Math.sin(r);
      lumps.push({ p: [x + (lx * c - lz * sn) * s, ly * s, z + (lx * sn + lz * c) * s], r: lr * s, col: col.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.06) });
    }
  }
  const pineCols = ['#2f8a4a', '#3a9a52', '#2a7a48'].map(c => new T.Color(c));
  const tiers = [];
  for (const [x, z, s, r] of pines) {
    const col = pineCols[Math.floor(Math.abs(Math.sin(x * 3.1 + z)) * 3)];
    for (const [y, w, h] of [[1.7, 1.75, 1.9], [2.7, 1.35, 1.7], [3.6, 0.9, 1.4]]) tiers.push({ p: [x, y * s, z], w: w * s, h: h * s, r, col: col.clone().offsetHSL(0, 0, (3.6 - y) * 0.03) });
  }
  const bLumps = [];
  for (const [x, z, s, r] of bushes) for (const [lx, ly, lz, lr] of [[0, 0.45, 0, 0.6], [0.5, 0.35, 0.1, 0.45], [-0.45, 0.35, -0.1, 0.45]]) {
    const c = Math.cos(r), sn = Math.sin(r);
    bLumps.push({ p: [x + (lx * c - lz * sn) * s, ly * s, z + (lx * sn + lz * c) * s], r: lr * s, col: new T.Color(i3(x, z) ? '#4cae3f' : '#5fbf4a') });
  }
  function i3(x, z) { return Math.sin(x * 5 + z * 3) > 0; }
  const instList = (geo, material, list, f, cast) => chunked(geo, material, list, it => it.p || [it[0], 0, it[1]], (im, i, it) => {
    f(dm, it); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix); if (it.col && material !== lineMat) im.setColorAt(i, it.col);
    im.castShadow = cast !== false; im.receiveShadow = material !== lineMat;
  })[0];
  // touffes un peu moins découpées (914 touffes dans la forêt : 146 → 106 triangles chacune avec leur contour)
  const sph = new T.SphereGeometry(1, 8, 5), sphO = new T.SphereGeometry(1.07, 7, 4);
  for (const [geo, m] of [[sph, leafMat], [sphO, lineMat]]) {
    instList(geo, m, lumps, (d, it) => { d.position.set(...it.p); d.scale.set(it.r, it.r * 0.92, it.r); d.rotation.set(0, it.p[0], 0); }, m === leafMat);
    instList(geo, m, bLumps, (d, it) => { d.position.set(...it.p); d.scale.set(it.r, it.r * 0.85, it.r); d.rotation.set(0, it.p[2], 0); }, m === leafMat);
  }
  const cone = new T.ConeGeometry(1, 1, 8), coneO = new T.ConeGeometry(1.08, 1.1, 8);
  coneO.translate(0, 0.02, 0);
  for (const [geo, m] of [[cone, leafMat], [coneO, lineMat]]) instList(geo, m, tiers, (d, it) => { d.position.set(...it.p); d.scale.set(it.w, it.h, it.w); d.rotation.set(0, it.r, 0); }, m === leafMat);
  const trunk = new T.CylinderGeometry(0.2, 0.34, 2.2, 8), trunkO = new T.CylinderGeometry(0.25, 0.4, 2.2, 8);
  for (const [geo, m] of [[trunk, trunkMat], [trunkO, lineMat]]) {
    instList(geo, m, rounds, (d, [x, z, s]) => { d.position.set(x, 1.1 * s, z); d.scale.setScalar(s); d.rotation.set(0, 0, 0); }, m !== lineMat);
    instList(geo, m, pines, (d, [x, z, s]) => { d.position.set(x, 0.9 * s, z); d.scale.set(s, s * 0.8, s); d.rotation.set(0, 0, 0); }, m !== lineMat);
  }
  // Fleurs, champignons, rochers dans l'herbe du village
  const flowers = [], rocks = [], shrooms = [];
  for (let i = 0; i < 160; i++) {
    const x = rnd(-WALL + 1, WALL - 1), z = rnd(-WALL + 1, WALL - 1);
    if (Object.entries(POS).some(([id, p]) => Math.hypot(x - p[0], z - p[1]) < BUILD[id].collide + 0.8)) continue;
    if (Math.hypot(x - PLAZA[0], z - PLAZA[1]) < 4) continue;
    if (i % 11 === 0) rocks.push([x, z, rnd(0.5, 1.1), rnd(0, TAU)]);
    else if (i % 7 === 0) shrooms.push([x, z, rnd(0.7, 1.1), 0]);
    else flowers.push([x, z, 1, rnd(0, TAU)]);
  }
  const fl = inst(new T.SphereGeometry(0.12, 6, 5), mat('#ffffff'), flowers, (d, [x, z]) => { d.position.set(x, 0.12, z); d.scale.setScalar(1); d.rotation.set(0, 0, 0); });
  fl.castShadow = false;
  const flowerCols = ['#ff5fa8', '#ffd23f', '#ffffff', '#b46bff', '#ff7a45'].map(c => new T.Color(c));
  flowers.forEach((_, i) => fl.setColorAt(i, flowerCols[i % flowerCols.length]));
  inst(new T.DodecahedronGeometry(0.55, 0), mat('#b8b0cc'), rocks, (d, [x, z, s, r]) => { d.position.set(x, 0.2 * s, z); d.scale.set(s * 1.2, s * 0.7, s); d.rotation.set(0, r, 0); });
  inst(new T.CylinderGeometry(0.06, 0.08, 0.3, 6), mat('#fff3dc'), shrooms, (d, [x, z, s]) => { d.position.set(x, 0.15 * s, z); d.scale.setScalar(s); d.rotation.set(0, 0, 0); });
  inst(new T.SphereGeometry(0.2, 10, 6, 0, TAU, 0, Math.PI / 2), mat('#ff4f4f'), shrooms, (d, [x, z, s]) => { d.position.set(x, 0.3 * s, z); d.scale.setScalar(s); d.rotation.set(0, 0, 0); });

  // Décor défensif : tours d'archers et canons dans les coins, feu de camp, cabane de l'ouvrier
  for (const [x, z] of [[-17.3, -17.3], [17.3, -17.3]]) { buildArcherTower(x, z); V.colliders.push({ x, z, r: 1.6 }); }
  for (const [x, z, r] of [[-17.3, 17.3, -2.4], [17.3, 17.3, 2.4]]) { buildCannon(x, z, r); V.colliders.push({ x, z, r: 1.4 }); }
  buildCampfire(CAMP[0], CAMP[1]); V.colliders.push({ x: CAMP[0], z: CAMP[1], r: 1.7 });
  buildHut(HUT[0], HUT[1]); V.colliders.push({ x: HUT[0], z: HUT[1], r: 1.7 });

  for (const id of Object.keys(POS)) buildBuilding(id);
  // Chemins pavés : de la place jusqu'à la porte de chaque bâtiment
  for (const id of Object.keys(POS)) {
    if (id === 'portail') continue;
    const b = V.bld[id], dx = b.ix - PLAZA[0], dz = b.iz - PLAZA[1], len = Math.hypot(dx, dz) - 2.5;
    if (len < 0.5) continue;
    const ux = dx / Math.hypot(dx, dz), uz = dz / Math.hypot(dx, dz);
    const p = new T.Mesh(new T.PlaneGeometry(1.9, len), mat('#e9dcc0', { tex: 'cobble', rep: [1.2, len / 1.6], polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1 }));
    p.rotation.order = 'YXZ'; p.rotation.set(-Math.PI / 2, Math.atan2(dx, dz), 0);
    p.position.set(PLAZA[0] + ux * (2.5 + len / 2), 0.06, PLAZA[1] + uz * (2.5 + len / 2)); p.receiveShadow = true; scene.add(p);
  }

  // Ma maison (intérieur), lampadaires, jour ou nuit
  V.winMat = mat('#ffe48a', { emissive: '#8a5a00' });
  buildHome(); buildLamps(); applyNight();

  // Nuages qui passent (on ne voit que leur ombre glisser sur le village)
  V.clouds = [];
  for (let i = 0; i < 5; i++) {
    const c = new T.Group();
    for (let k = 0; k < 4; k++) { const s = mk(new T.SphereGeometry(rnd(1.8, 2.8), 8, 6), mat('#ffffff'), k * 2.2 - 3, rnd(-0.4, 0.4), rnd(-1, 1), c); s.receiveShadow = false; }
    c.position.set(rnd(-40, 40), 26, rnd(-30, 30)); scene.add(c); V.clouds.push(c);
  }

  // Joueur + ouvrier
  V.hero = buildHero3D(save.skin, CLASSES[save.cls].color); addFootShadow(V.hero, 0.6); villageGunPose(V.hero);
  scene.add(V.hero);
  refreshPetSprite();
  V.builder = buildBuilder3D(); V.builder.position.set(V.chair ? V.chair.x : HUT[0] - 0.5, 0, V.chair ? V.chair.z : HUT[1] + 2.2); if (V.chair) V.builder.rotation.y = V.chair.rot; scene.add(V.builder);
  // Fumée de la forge
  for (let i = 0; i < 7; i++) {
    const s = new T.Mesh(new T.SphereGeometry(0.35, 8, 6), new T.MeshLambertMaterial({ color: '#efeaf7', transparent: true, opacity: 0.8 }));
    s.userData.t = i / 7; scene.add(s); V.smoke.push(s);
  }
  V.cam = new T.Vector3();
  placeHeroCam(true);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { for (const id in V.bld) { V.bld[id].labelKey = ''; refreshLabel(id); } if (V.bld.mine) { V.bld.mine.bubbleKey = ''; refreshBubble(); } });
}

// ---------- Textures dessinées (neutres, teintées par la couleur du matériau) ----------
let GRAD = null;
const TEX = {};
function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
// Herbe peinte du village : grande tuile (moins de répétition visible), teinte douce, taches d'ombre et de lumière
function villageGrass(g) {
  const t = texTile('grass', null, 1);
  for (let x = 0; x < 1024; x += 512) for (let y = 0; y < 1024; y += 512) g.drawImage(t, x, y);
  const R = seeded(321);
  for (let k = 0; k < 22; k++) {
    const x = R() * 1024, y = R() * 1024, r = 80 + R() * 160, light = k % 2;
    for (const ox of [-1024, 0, 1024]) for (const oy of [-1024, 0, 1024]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      gr.addColorStop(0, light ? 'rgba(255,245,170,.16)' : 'rgba(30,70,20,.14)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
}
function makeTextures() {
  TEX.grass = canvasTex(256, (g, s) => {
    if (GTEX.ready) { g.canvas.width = g.canvas.height = 1024; villageGrass(g); return; }
    const n = 4, c = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? '#7cc644' : '#86cf4b'; g.fillRect(i * c, j * c, c, c); }
    const cols = ['#6fb83c', '#94d958', '#73bd40', '#9ee060'];
    for (let k = 0; k < 900; k++) { g.fillStyle = cols[k % 4]; const x = Math.random() * s, y = Math.random() * s; g.fillRect(x, y, 2, 5); }
  });
  TEX.floor = canvasTex(512,(g,n)=>{g.fillStyle='#c9ab82';g.fillRect(0,0,n,n);});
  TEX.stone = canvasTex(256, (g, s) => {
    g.fillStyle = '#8f8a9c'; g.fillRect(0, 0, s, s);
    const rows = 4, rh = s / rows;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? s / 6 : 0;
      for (let x = -s / 3; x < s; x += s / 3) {
        const v = 215 + Math.floor(Math.random() * 35);
        g.fillStyle = `rgb(${v},${v},${v + 6})`;
        g.beginPath(); g.roundRect ? g.roundRect(x + off + 4, r * rh + 4, s / 3 - 8, rh - 8, 10) : g.rect(x + off + 4, r * rh + 4, s / 3 - 8, rh - 8); g.fill();
        g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + off + 10, r * rh + 8, s / 3 - 26, 5);
      }
    }
  });
  TEX.wood = canvasTex(256, (g, s) => {
    const pw = s / 5;
    for (let i = 0; i < 5; i++) {
      const v = 200 + Math.floor(Math.random() * 40);
      g.fillStyle = `rgb(${v},${v - 4},${v - 10})`; g.fillRect(i * pw, 0, pw, s);
      g.fillStyle = 'rgba(80,50,30,.5)'; g.fillRect(i * pw, 0, 4, s);
      g.fillStyle = 'rgba(80,50,30,.18)'; for (let k = 0; k < 4; k++) g.fillRect(i * pw + 10 + Math.random() * (pw - 20), Math.random() * s, 2, 30 + Math.random() * 60);
      g.fillStyle = 'rgba(80,50,30,.45)'; g.beginPath(); g.arc(i * pw + pw / 2, Math.random() * s, 4, 0, TAU); g.fill();
    }
  });
  TEX.plaster = canvasTex(256, (g, s) => {
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, s, s);
    for (let k = 0; k < 120; k++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; g.beginPath(); g.arc(Math.random() * s, Math.random() * s, 4 + Math.random() * 14, 0, TAU); g.fill(); }
  });
  TEX.tiles = canvasTex(256, (g, s) => {
    g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, s, s);
    const rows = 6, rh = s / rows, tw = s / 6;
    for (let r = 0; r < rows; r++) for (let x = -tw; x < s + tw; x += tw) {
      const off = r % 2 ? tw / 2 : 0, v = 220 + Math.floor(Math.random() * 35);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.beginPath(); g.moveTo(x + off + 2, r * rh); g.lineTo(x + off + tw - 2, r * rh); g.lineTo(x + off + tw - 2, r * rh + rh * 0.6);
      g.quadraticCurveTo(x + off + tw / 2, r * rh + rh * 1.15, x + off + 2, r * rh + rh * 0.6); g.closePath(); g.fill();
    }
  });
  TEX.thatch = canvasTex(256, (g, s) => {
    g.fillStyle = '#d9d9d9'; g.fillRect(0, 0, s, s);
    for (let k = 0; k < 700; k++) { const v = 170 + Math.floor(Math.random() * 85); g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 2; const x = Math.random() * s, y = Math.random() * s; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(-3, 3), y + 18); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let r = 0; r < 4; r++) g.fillRect(0, r * s / 4, s, 4);
  });
  TEX.cobble = canvasTex(512, (g, s) => {
    g.fillStyle = '#a69c86'; g.fillRect(0, 0, s, s);
    for (let k = 0; k < 70; k++) {
      const v = 215 + Math.floor(Math.random() * 40);
      g.fillStyle = `rgb(${v},${v - 6},${v - 18})`;
      g.beginPath(); g.ellipse(Math.random() * s, Math.random() * s, 14 + Math.random() * 10, 11 + Math.random() * 8, Math.random() * 3, 0, TAU); g.fill();
    }
  });
}
const matCache = {}, TEXC = {};
function applyGroundSurfaces(){
  // Keep the GPU allocation and shared canvas size stable, including on Android.
  // Disposing shared texture sources after their first upload can leave clones black.
  for(const key of ['floor','cobble']){
    const texture=TEX[key];if(!texture)continue;
    const c=texture.image,g=c.getContext('2d');
    g.drawImage(texTile(key),0,0,c.width,c.height);
    texture.needsUpdate=true;
    for(const copy of TEXC[key]||[])copy.needsUpdate=true;
  }
}
function mat(color, opt) {
  const key = color + (opt ? JSON.stringify(opt) : '');
  if (!matCache[key]) {
    const o = Object.assign({}, opt || {});
    let map = null;
    if (o.tex) { map = TEX[o.tex].clone(); map.needsUpdate = true; (TEXC[o.tex] || (TEXC[o.tex] = [])).push(map); const r = o.rep || [1, 1]; map.repeat.set(r[0], r[1]); }
    delete o.tex; delete o.rep;
    matCache[key] = new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: GRAD }, map ? { map } : {}, o));
  }
  return matCache[key];
}
function mk(geo, color, x, y, z, parent, opt) {
  const m = new THREE.Mesh(geo, typeof color === 'string' ? mat(color, opt) : color);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
const BX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function distToSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1);
  return Math.hypot(px - ax - t * dx, pz - az - t * dz);
}
const STONE = (w, h, c) => mat(c || '#cfc9de', { tex: 'stone', rep: [Math.max(1, w / 1.4), Math.max(0.5, h / 1.1)] });
const WOOD = (w, h, c) => mat(c || '#b07a4a', { tex: 'wood', rep: [Math.max(1, w / 1.6), Math.max(0.5, h / 2)] });
const PLASTER = c => mat(c || '#fbeed2', { tex: 'plaster', rep: [1, 1] });

// Toit à deux pans (tuiles ou chaume)
function gable(w, d, h, color, texName) {
  const s = new THREE.Shape(); s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, h); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  geo.translate(0, 0, -w / 2); geo.rotateY(Math.PI / 2);
  return new THREE.Mesh(geo, mat(color, { tex: texName || 'tiles', rep: [0.7, 0.7] }));
}
// Maison à colombages : socle en pierre, murs, poutres, toit à deux pans, porte, fenêtres
function house(g, w, d, h, o) {
  const T = THREE, base = 0.55;
  mk(BX(w + 0.5, base, d + 0.5), STONE(w + 0.5, base), 0, base / 2, 0, g);
  const wallMat = o.wallTex === 'stone' ? STONE(w, h, o.wall) : o.wallTex === 'wood' ? WOOD(w, h, o.wall) : PLASTER(o.wall);
  mk(BX(w, h, d), wallMat, 0, base + h / 2, 0, g);
  const beam = o.beam || '#7a4a2a';
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mk(BX(0.3, h + 0.05, 0.3), beam, sx * (w / 2), base + h / 2, sz * (d / 2), g);
  mk(BX(w + 0.3, 0.24, d + 0.3), beam, 0, base + h, 0, g);
  if (o.wallTex !== 'stone' && o.wallTex !== 'wood') { const x = mk(BX(w * 0.98, 0.16, 0.06), beam, 0, base + h * 0.5, d / 2 + 0.02, g); }
  const roofH = o.roofH || 2, roof = gable(w + 0.7, d + 0.9, roofH, o.roof, o.roofTex);
  roof.position.y = base + h + 0.1; roof.castShadow = roof.receiveShadow = true; g.add(roof);
  mk(BX(w + 0.85, 0.2, 0.26), beam, 0, base + h + 0.1 + roofH, 0, g);
  // Porte en arc
  mk(BX(1.15, 1.35, 0.14), WOOD(1, 1.3, '#8a5634'), 0, base + 0.68, d / 2 + 0.05, g);
  const arch = mk(new T.CylinderGeometry(0.575, 0.575, 0.14, 14, 1, false, 0, Math.PI), WOOD(1, 0.6, '#8a5634'), 0, base + 1.35, d / 2 + 0.05, g);
  arch.rotation.set(Math.PI / 2, Math.PI / 2, 0);
  mk(BX(1.4, 0.16, 0.3), beam, 0, base + 0.08 - 0.2, d / 2 + 0.25, g);
  mk(new T.SphereGeometry(0.07, 6, 5), '#ffd23f', 0.32, base + 0.75, d / 2 + 0.14, g);
  // Fenêtres avec volets
  for (const sx of [-1, 1]) {
    const fx = sx * w * 0.3, fy = base + h * 0.58;
    mk(BX(0.8, 0.75, 0.1), beam, fx, fy, d / 2 + 0.03, g);
    mk(BX(0.6, 0.55, 0.1), mat('#ffe48a', { emissive: '#8a5a00' }), fx, fy, d / 2 + 0.06, g);
    mk(BX(0.06, 0.55, 0.12), beam, fx, fy, d / 2 + 0.08, g);
    for (const ss of [-1, 1]) mk(BX(0.22, 0.75, 0.06), o.shutter || '#3d8bd9', fx + ss * 0.53, fy, d / 2 + 0.06, g);
  }
  return base + h + roofH + 0.3;
}
function pyramidRoof(g, r, h, color, y, texName) {
  const geo = new THREE.ConeGeometry(r, h, 4, 1); geo.rotateY(Math.PI / 4);
  return mk(geo, mat(color, { tex: texName || 'tiles', rep: [3, 1.5] }), 0, y + h / 2, 0, g);
}
function flag(g, x, y, z, color, h) {
  mk(new THREE.CylinderGeometry(0.05, 0.05, h || 2, 6), '#5a4a3a', x, y + (h || 2) / 2, z, g);
  const f = mk(BX(0.9, 0.55, 0.05), color, x + 0.47, y + (h || 2) - 0.32, z, g);
  (V.flags || (V.flags = [])).push(f);
  return f;
}

function buildArcherTower(x, z) {
  const T = THREE, g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z);
  mk(new T.CylinderGeometry(1.5, 1.6, 0.5, 8), STONE(4, 0.5), 0, 0.25, 0, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = mk(BX(0.3, 3.6, 0.3), WOOD(0.3, 3.6), sx * 0.9, 2.3, sz * 0.9, g); p.rotation.z = -sx * 0.06; p.rotation.x = sz * 0.06; }
  for (const y of [1.4, 2.7]) for (const r of [0, Math.PI / 2]) { const b = mk(BX(2.2, 0.16, 0.16), '#7a4a2a', 0, y, 0, g); b.rotation.y = r; b.rotation.z = 0.5; }
  mk(BX(2.5, 0.25, 2.5), WOOD(2.5, 0.5), 0, 4.1, 0, g);
  for (const [sx, sz, w, d] of [[0, 1.2, 2.5, 0.15], [0, -1.2, 2.5, 0.15], [1.2, 0, 0.15, 2.5], [-1.2, 0, 0.15, 2.5]]) mk(BX(w, 0.8, d), WOOD(2.5, 0.8), sx, 4.6, sz, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mk(BX(0.16, 1.6, 0.16), '#7a4a2a', sx * 1.15, 5, sz * 1.15, g);
  pyramidRoof(g, 2.0, 1.4, '#3d8bd9', 5.7);
  flag(g, 0, 7.1, 0, '#ff4fa3', 1.4);
  V.scene.add(g);
}
function buildCannon(x, z, rot) {
  const T = THREE, g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
  mk(new T.CylinderGeometry(1.3, 1.4, 0.45, 10), STONE(4, 0.45), 0, 0.22, 0, g);
  mk(BX(1.2, 0.5, 1.4), WOOD(1.2, 0.5), 0, 0.7, 0, g);
  for (const sx of [-1, 1]) { const w = mk(new T.CylinderGeometry(0.42, 0.42, 0.16, 12), WOOD(1, 0.2, '#8a5634'), sx * 0.68, 0.62, 0, g); w.rotation.z = Math.PI / 2; }
  const barrel = mk(new T.CylinderGeometry(0.32, 0.42, 1.8, 14), '#3a3550', 0, 1.15, 0.35, g); barrel.rotation.x = Math.PI / 2.4;
  mk(new T.TorusGeometry(0.34, 0.07, 6, 14), '#ffd23f', 0, 1.47, 1.15, g).rotation.x = Math.PI / 2.4 - Math.PI / 2;
  V.scene.add(g);
}
function buildCampfire(x, z) {
  const T = THREE, g = new T.Group(); g.position.set(x, 0, z);
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; mk(new T.DodecahedronGeometry(0.28, 0), '#a59cc0', Math.cos(a) * 1.05, 0.15, Math.sin(a) * 1.05, g); }
  for (let i = 0; i < 4; i++) { const l = mk(new T.CylinderGeometry(0.12, 0.12, 1.2, 6), '#7a4a2a', 0, 0.22, 0, g); l.rotation.set(Math.PI / 2, i * Math.PI / 4, 0.25); }
  V.flames = [];
  for (const [fx, fz, s] of [[0, 0, 1], [0.2, 0.15, 0.7], [-0.2, -0.1, 0.75]]) V.flames.push(mk(new T.ConeGeometry(0.32 * s, 1.0 * s, 7), mat(s === 1 ? '#ffb02e' : '#ff6a2e', { emissive: s === 1 ? '#ff8a00' : '#d03a00' }), fx, 0.6 * s, fz, g));
  V.flames.forEach(f => { f.castShadow = false; });
  for (const a of [0.7, 2.4, 4.1]) { const lg = mk(new T.CylinderGeometry(0.25, 0.25, 1.4, 8), WOOD(1, 1.4), Math.cos(a) * 2.2, 0.25, Math.sin(a) * 2.2, g); lg.rotation.set(0, -a, Math.PI / 2); }
  V.fireLight = new T.PointLight('#ff9a3a', 0.9, 8, 2); V.fireLight.position.set(x, 1.3, z); V.scene.add(V.fireLight);
  V.scene.add(g);
}
function buildHut(x, z) {
  const T = THREE, g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = Math.atan2(PLAZA[0] - x, PLAZA[1] - z);
  mk(new T.CylinderGeometry(1.45, 1.55, 1.6, 10), WOOD(4, 1.6), 0, 0.8, 0, g);
  mk(new T.ConeGeometry(1.95, 1.7, 10), mat('#e8c25a', { tex: 'thatch', rep: [3, 1] }), 0, 2.45, 0, g);
  mk(BX(0.8, 1.1, 0.12), WOOD(0.8, 1.1, '#8a5634'), 0, 0.55, 1.45, g);
  mk(BX(1.2, 0.3, 0.3), '#7a4a2a', 0, 3.25, 0, g).rotation.z = 0.2;
  const sign = mk(BX(0.9, 0.5, 0.06), '#ffd23f', 0.95, 1.3, 1.25, g); sign.rotation.y = -0.3;
  // Marteau sur le panneau
  mk(BX(0.08, 0.38, 0.04), '#5a4a3a', 0.95, 1.3, 1.3, g).rotation.set(0, -0.3, 0.6);
  // Chaise de l'ouvrier devant la cabane (il s'y assoit quand il n'a rien à construire)
  const chair = new T.Group(); chair.position.set(-1.35, 0, 2.05); g.add(chair);
  mk(BX(0.62, 0.08, 0.58), WOOD(0.6, 0.6, '#a8703a'), 0, 0.5, 0, chair);
  mk(BX(0.62, 0.62, 0.08), WOOD(0.6, 0.6, '#a8703a'), 0, 0.84, -0.27, chair);
  for (const [lx, lz] of [[-0.26, -0.24], [0.26, -0.24], [-0.26, 0.24], [0.26, 0.24]]) mk(BX(0.07, 0.5, 0.07), '#6a4428', lx, 0.25, lz, chair);
  V.scene.add(g);
  V.hutDoor = [x + Math.sin(g.rotation.y) * 2.4, z + Math.cos(g.rotation.y) * 2.4];
  const ry = g.rotation.y, cx = -1.35, cz = 2.05;
  V.chair = { x: x + cx * Math.cos(ry) + cz * Math.sin(ry), z: z - cx * Math.sin(ry) + cz * Math.cos(ry), rot: ry };
}
// L'ouvrier : casque jaune, salopette bleue, marteau
function buildBuilder3D() {
  const T = THREE, g = new T.Group(), legs = [], arms = [];
  const knees = [];
  for (const sx of [-1, 1]) {
    // cuisse + genou articulé (pour pouvoir s'asseoir les jambes pliées)
    const hip = new T.Group(); hip.position.set(sx * 0.17, 0.7, 0); g.add(hip);
    mk(BX(0.24, 0.36, 0.26), '#3d6fd9', 0, -0.17, 0, hip);
    const knee = new T.Group(); knee.position.set(0, -0.34, 0); hip.add(knee);
    mk(BX(0.23, 0.3, 0.25), '#3d6fd9', 0, -0.14, 0, knee);
    mk(BX(0.27, 0.12, 0.36), '#5a3a2a', 0, -0.3, 0.05, knee);
    legs.push(hip); knees.push(knee);
  }
  const body = new T.Group(); g.add(body);
  mk(BX(0.66, 0.66, 0.4), '#3d6fd9', 0, 1.02, 0, body);
  mk(BX(0.68, 0.3, 0.42), '#ff8a1f', 0, 1.25, 0, body);
  for (const sx of [-1, 1]) {
    const sh = new T.Group(); sh.position.set(sx * 0.42, 1.3, 0); body.add(sh);
    mk(BX(0.18, 0.52, 0.18), '#ff8a1f', 0, -0.24, 0, sh);
    mk(new T.SphereGeometry(0.11, 8, 6), '#f2c29b', 0, -0.52, 0, sh);
    if (sx > 0) { mk(BX(0.06, 0.06, 0.55), '#7a4a2a', 0, -0.55, 0.22, sh); mk(BX(0.12, 0.14, 0.26), '#5a5470', 0, -0.55, 0.48, sh); }
    arms.push(sh);
  }
  const head = new T.Group(); head.position.set(0, 1.7, 0); body.add(head);
  mk(new T.SphereGeometry(0.3, 14, 10), '#f2c29b', 0, 0, 0, head);
  mk(new T.SphereGeometry(0.32, 14, 8, 0, TAU, 0, Math.PI / 2), '#ffd23f', 0, 0.06, 0, head);
  mk(BX(0.5, 0.05, 0.3), '#ffd23f', 0, 0.07, 0.3, head);
  mk(BX(0.34, 0.12, 0.1), '#8a5634', 0, -0.13, 0.27, head);
  for (const sx of [-1, 1]) mk(BX(0.06, 0.09, 0.04), '#1d1238', sx * 0.11, 0.0, 0.29, head);
  // Brin de paille au coin de la bouche (visible quand il se repose)
  const straw = new T.Group(); straw.position.set(0.08, -0.1, 0.3); head.add(straw);
  const st = mk(new T.CylinderGeometry(0.014, 0.018, 0.42, 6), '#f0d070', 0.13, 0, 0.1, straw); st.rotation.set(Math.PI / 2 - 0.35, 0, -1.0);
  mk(new T.ConeGeometry(0.035, 0.08, 6), '#e8c25a', 0.3, 0.07, 0.2, straw).rotation.z = -1.0;
  straw.visible = false;
  g.userData = { legs, knees, arms, body, head, straw };
  return g;
}

// ---------- Familiers en 3D (même style que le héros : formes rondes, grands yeux, contour encré) ----------
function buildPet3D(id) {
  const T = THREE, g = new T.Group(), body = new T.Group(); g.add(body);
  const U = { legs: [], wings: [], tail: null, body, fly: !!(PETS[id] && PETS[id].fly), id };
  const ball = (r, col, x, y, z, sx, sy, sz, parent, opt) => { const m = mk(new T.SphereGeometry(r, 16, 12), col, x, y, z, parent || body, opt); m.scale.set(sx || 1, sy || 1, sz || 1); return m; };
  const PM = PETS[id] && PETS[id].model;
  if (PM) {
    // familier venu d'un modèle 3D animé (pack « Ultimate Monsters »)
    const mg = modelInst(PM);
    if (mg) {
      const P = PETS[id], cl = P.clips || {}, I = mg.userData.inst;
      mg.position.y = P.fly ? 0.35 : 0; body.add(mg); U.mixer = I.mixer; U.acts = {}; U.range = P.range || null;
      for (const k of ['move', 'idle']) { const c = I.clip(cl[k] || cl.move); U.acts[k] = { a: I.mixer.clipAction(c), d: c.duration }; }
    }
    else ball(0.3, '#7a4fd9', 0, 0.6, 0);
    g.userData = U; return g;
  }
  // modèle pas encore chargé : petite boule en attendant
  ball(0.3, '#7a4fd9', 0, 0.6, 0);
  addOutline(g, 0.022);
  g.userData = U;
  return g;
}
// Animation : petits bonds et pattes qui bougent en marchant, ailes qui battent en volant, queue qui remue
function animPet3D(g, t, moving) {
  const U = g.userData; if (!U || !U.body) return;
  const k = moving ? 1 : 0;
  U.body.position.y = U.fly ? Math.sin(t * 3) * 0.06 : (moving ? Math.abs(Math.sin(t * 11)) * 0.1 : Math.sin(t * 2) * 0.015);
  U.legs.forEach((l, i) => { l.rotation.x = k * Math.sin(t * 11 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.6; });
  U.wings.forEach(w => { const s = w.userData.s; if (w.userData.ear) w.rotation.x = Math.sin(t * (moving ? 10 : 2) + s) * (moving ? 0.25 : 0.08); else w.rotation.z = s * (U.fly ? 0.15 + Math.sin(t * 14) * 0.55 : 0.1 + Math.sin(t * 2) * 0.08); });
  if (U.tail) U.tail.rotation.y = Math.sin(t * (moving ? 9 : 3)) * 0.35;
  if (U.mixer) {
    // familier animé : marche quand il bouge, attente sinon
    const A = U.acts[moving ? 'move' : 'idle'];
    if (U.cur !== A) { if (U.cur) U.cur.a.stop(); A.a.play(); U.cur = A; }
    U.mixer.setTime(U.range ? U.range[0] + t % (U.range[1] - U.range[0]) : (t * (U.fly ? 1.4 : 1)) % A.d);
    if (!U.fly) U.body.position.y = 0;
  }
}
// Vignette de la boutique : photo 3D du familier
const petSnaps = {};
function snapPet3D(cnv, id) {
  const aid = id === 'dragon' && save.dragonCol === 'rouge' ? 'dragon_rouge' : id;
  if (ART_SRC[aid] && paintArt(cnv, aid)) return;
  initPreview();
  if (!PV.r) { paintPet(cnv, id); return; }
  const key = id + cnv.width + (id === 'dragon' ? save.dragonCol : '');
  let img = petSnaps[key];
  if (!img) {
    const T = THREE;
    if (!PV.psnap) { PV.psnap = { scene: new T.Scene(), cam: new T.PerspectiveCamera(30, 4 / 3, 0.1, 20) }; PV.psnap.scene.add(new T.HemisphereLight('#fffaf0', '#6d5a8a', 0.8)); const dl = new T.DirectionalLight('#fff0d0', 0.85); dl.position.set(3, 5, 6); PV.psnap.scene.add(dl); }
    const S = PV.psnap; if (S.obj) S.scene.remove(S.obj);
    S.obj = buildPet3D(id); S.obj.rotation.y = 0.5; animPet3D(S.obj, 0.4, false); if (S.obj.userData.fly) S.obj.userData.wings.forEach(w => { w.rotation.z = w.userData.s * 0.5; });
    S.scene.add(S.obj);
    S.cam.aspect = cnv.width / cnv.height; S.cam.updateProjectionMatrix(); S.cam.position.set(0, 0.85, 2.25); S.cam.lookAt(0, 0.5, 0);
    const pr = PV.r.getPixelRatio(), prev = PV.r.getSize(new T.Vector2());
    PV.r.setPixelRatio(1); PV.r.setSize(cnv.width, cnv.height, false); PV.r.render(S.scene, S.cam);
    img = document.createElement('canvas'); img.width = cnv.width; img.height = cnv.height; img.getContext('2d').drawImage(PV.r.domElement, 0, 0);
    PV.r.setPixelRatio(pr); PV.r.setSize(prev.x || 1, prev.y || 1, false);
    petSnaps[key] = img;
  }
  const g2 = cnv.getContext('2d'); g2.clearRect(0, 0, cnv.width, cnv.height); g2.drawImage(img, 0, 0);
}
// Images du familier pour le Bastion : le modèle 3D photographié sous 8 angles et 4 poses
const PS = { key: null, sheet: null, dirs: 8, frames: 4, size: 112 };
function petSheet(id) {
  if (!window.THREE || !GRAD || !PETS[id]) return null;
  const PM = PETS[id].model, key = id + (id === 'dragon' ? save.dragonCol : '') + (PM && !MODELS[PM] ? '-attente' : '');
  if (PS.key === key) return PS.sheet ? PS : null;
  PS.key = key; PS.sheet = null;
  initPreview(); if (!PV.r) return null;
  const T = THREE, N = PS.size, ext = 0.85;
  if (!PS.scene) {
    PS.scene = new T.Scene(); PS.scene.add(new T.HemisphereLight('#fffaf0', '#6d5a8a', 0.8));
    const dl = new T.DirectionalLight('#fff0d0', 0.85); dl.position.set(-4, 7, 5); PS.scene.add(dl);
    PS.cam = new T.OrthographicCamera(-ext, ext, ext, -ext, 0.1, 60);
    const pitch = 0.6; PS.cam.position.set(0, 0.6 + Math.sin(pitch) * 20, Math.cos(pitch) * 20); PS.cam.lookAt(0, 0.6, 0); PS.cam.updateMatrixWorld(); PS.cam.updateProjectionMatrix();
    const f = new T.Vector3(0, 0, 0).project(PS.cam); PS.foot = (1 - f.y) / 2 * N; PS.unit = N / (ext * 2);
  }
  const mem = dcGet('pet:' + key); if (mem) { PS.sheet = mem; return PS; }
  if (PS.obj) PS.scene.remove(PS.obj);
  PS.obj = buildPet3D(id); PS.scene.add(PS.obj);
  const sheet = document.createElement('canvas'); sheet.width = N * PS.dirs; sheet.height = N * PS.frames; const sg = sheet.getContext('2d');
  const pr = PV.r.getPixelRatio(), prev = PV.r.getSize(new T.Vector2());
  PV.r.setPixelRatio(1); PV.r.setSize(N, N, false);
  for (let f = 0; f < PS.frames; f++) {
    animPet3D(PS.obj, f / PS.frames * (TAU / 11) + 0.05, true);
    if (PS.obj.userData.fly) PS.obj.userData.wings.forEach(w => { w.rotation.z = w.userData.s * (0.15 + Math.sin(f / PS.frames * TAU) * 0.55); });
    for (let d = 0; d < PS.dirs; d++) { PS.obj.rotation.y = Math.PI / 2 - d / PS.dirs * TAU; PV.r.render(PS.scene, PS.cam); sg.drawImage(PV.r.domElement, d * N, f * N); }
  }
  PV.r.setPixelRatio(pr); PV.r.setSize(prev.x || 1, prev.y || 1, false);
  PS.sheet = sheet; if (!key.endsWith('-attente')) dcPut('pet:' + key, sheet, 'pet:'); return PS;
}

// ---------- Textures dessinées pour l'interface (parchemin, bois) ----------
(function uiTextures() {
  const mkTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return 'url(' + c.toDataURL('image/png') + ')'; };
  const R = seeded(77);
  const parch = mkTex(256, 256, (g, w, h) => {
    g.fillStyle = '#f2e0b8'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 60; k++) { const x = R() * w, y = R() * h, r = 20 + R() * 60; for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, R() < 0.5 ? 'rgba(200,150,80,.10)' : 'rgba(255,250,230,.14)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2); } }
    g.strokeStyle = 'rgba(150,100,50,.08)'; g.lineWidth = 1; for (let k = 0; k < 140; k++) { const x = R() * w, y = R() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 30, y + (R() - 0.5) * 6); g.stroke(); }
  });
  const wood = mkTex(256, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#8a5634'); gr.addColorStop(0.5, '#7a4826'); gr.addColorStop(1, '#6a3c1e'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 40; k++) { const y = R() * h; g.strokeStyle = R() < 0.5 ? 'rgba(40,20,8,.35)' : 'rgba(200,140,80,.18)'; g.lineWidth = 1 + R() * 2; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + k) * 3); g.stroke(); }
    for (const y of [0, h / 2]) { g.fillStyle = 'rgba(30,15,5,.45)'; g.fillRect(0, y, w, 2); }
    for (let k = 0; k < 4; k++) { const x = R() * w, y = R() * h; g.fillStyle = 'rgba(40,20,8,.4)'; g.beginPath(); g.ellipse(x, y, 7, 4, 0, 0, TAU); g.fill(); }
  });
  document.documentElement.style.setProperty('--parch', parch);
  document.documentElement.style.setProperty('--wood', wood);
})();

// ---------- Écran de chargement : tout ce qui est lourd est préparé au lancement ----------
function prepHeroLater() { clearTimeout(prepHeroLater.t); prepHeroLater.t = setTimeout(() => { try { heroSheet(); if (PETS[save.pet]) petSheet(save.pet); } catch (e) {} }, 500); }
const LOAD_TIPS = [
  'Astuce : la sorcière, entre la Forge et le Laboratoire, vend des œufs qui cachent des familiers. Parfois même un dragon !',
  'Astuce : un familier en double gagne un niveau. Chaque niveau rend ses pouvoirs 10 % plus forts.',
  'Astuce : le Laboratoire abrite l’animalerie, pour adopter un familier directement avec tes pièces.',
  'Astuce : nouvelles armes et skins d’armes t’attendent à la boutique de l’Armurerie.',
  'Astuce : améliore la Forge pour que ta roulade et ton ultime rechargent plus vite.',
  'Astuce : la Mine produit des pièces même quand tu ne joues pas. Pense à la récolter !',
  'Astuce : un coffre gratuit t’attend chaque jour, et il est encore plus beau si tu reviens chaque jour.',
  'Astuce : un boss surgit toutes les 5 vagues dans le Bastion. Garde ta grenade pour lui !',
  'Astuce : touche l’œil en haut de l’écran pour jouer en 1re personne.',
  'Astuce : ajoute tes amis une fois, puis rejoins-les d’un seul geste depuis la liste « Mes amis ».',
  'Astuce : termine le donjon en facile pour débloquer le mode moyen, puis le hardcore.',
  'Astuce : en Loup-Garou, méfie-toi de celui qui accuse tout le monde…',
  'Astuce : dors dans ton lit pour voir le village de nuit.',
  'Astuce : les objivants changent ton apparence sans enlever les bonus de ton équipement.',
  'Astuce : en Hardcore, il n’y a plus de cœurs de soin. Bonne chance !',
];
// ---------- Mémoire de l'appareil : ce qui est long à préparer est gardé après le 1er lancement ----------
// (héros et familier sous tous les angles, boss en 3D, sols peints). Une nouvelle version du jeu vide la mémoire.
const BUILD_ID = (() => {
  const t = (document.currentScript && document.currentScript.textContent) || ''; let h = t.length;
  for (let i = 0; i < t.length; i++) h = (Math.imul(h, 31) + t.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
})();
const DC = { mem: new Map(), fresh: new Map(), db: null, timer: 0, hits: 0 };
function dcOpen() {
  return new Promise(res => {
    try { const r = indexedDB.open('dernier-bastion-cache', 1); r.onupgradeneeded = () => r.result.createObjectStore('img'); r.onsuccess = () => { DC.db = r.result; res(DC.db); }; r.onerror = () => res(null); }
    catch (e) { res(null); }
  });
}
async function dcLoad() {
  const db = await dcOpen(); if (!db) return;
  const entries = await new Promise(res => {
    const out = [];
    try { const cur = db.transaction('img', 'readonly').objectStore('img').openCursor(); cur.onsuccess = () => { const c = cur.result; if (!c) return res(out); out.push([c.key, c.value]); c.continue(); }; cur.onerror = () => res(out); }
    catch (e) { res(out); }
  });
  const stale = [], pre = BUILD_ID + '|';
  await Promise.all(entries.map(async ([k, v]) => {
    if (!String(k).startsWith(pre)) { stale.push(k); return; }
    try { DC.mem.set(k.slice(pre.length), await createImageBitmap(v)); } catch (e) { stale.push(k); }
  }));
  if (stale.length) try { const st = db.transaction('img', 'readwrite').objectStore('img'); stale.forEach(k => st.delete(k)); } catch (e) {}
}
function dcGet(k) { const v = DC.mem.get(k); if (v) DC.hits++; return v || null; }
// group : une seule image gardée par groupe (par exemple la tenue actuelle du héros)
function dcPut(k, canvas, group) {
  if (group) for (const old of [...DC.mem.keys()]) if (old !== k && old.startsWith(group)) { DC.mem.delete(old); DC.fresh.delete(old); if (DC.db) try { DC.db.transaction('img', 'readwrite').objectStore('img').delete(BUILD_ID + '|' + old); } catch (e) {} }
  DC.mem.set(k, canvas); DC.fresh.set(k, canvas);
  clearTimeout(DC.timer); DC.timer = setTimeout(dcSave, 2500);
}
async function dcSave() {
  if (!DC.db || !DC.fresh.size) return;
  if (window.__loading) { DC.timer = setTimeout(dcSave, 2500); return; }
  // d'abord ce qui est le plus long à refaire : héros, boss, familier, puis les sols
  const rank = k => k.startsWith('tex:') ? 1 : 0;
  const items = [...DC.fresh].sort((a, b) => rank(a[0]) - rank(b[0])); DC.fresh.clear();
  // par petits paquets encodés en parallèle (l'encodage se fait hors du fil principal)
  for (let i = 0; i < items.length; i += 4) {
    const pack = items.slice(i, i + 4);
    const blobs = await Promise.all(pack.map(([k, c]) => new Promise(r => { try { c.toBlob(r, k.startsWith('tex:') ? 'image/jpeg' : 'image/webp', 0.9); } catch (e) { r(null); } })));
    try { const st = DC.db.transaction('img', 'readwrite').objectStore('img'); pack.forEach(([k], j) => { if (blobs[j]) st.put(blobs[j], BUILD_ID + '|' + k); }); } catch (e) {}
    await new Promise(r => setTimeout(r, 30));
  }
}
function flushCanvas(c) { try { const s = flushCanvas.s || (flushCanvas.s = document.createElement('canvas').getContext('2d', { willReadFrequently: true })); s.drawImage(c, 0, 0, 1, 1); s.getImageData(0, 0, 1, 1); } catch (e) {} }
// Garde-robe : icônes peintes des onglets et décor de la boutique derrière le héros
function applyWardrobeArt() {
  document.querySelectorAll('#skinsM .tab').forEach(b => { const src = ART_SRC['tab_' + b.dataset.tab], svg = b.querySelector('svg'); if (src && svg) { const im = new Image(); im.src = src; im.alt = ''; svg.replaceWith(im); } });
  const pv = document.querySelector('#skinsM .pv');
  if (pv && ART_SRC.wardrobe_bg) { pv.style.setProperty('--room', `url(${ART_SRC.wardrobe_bg})`); pv.classList.add('room'); }
}
async function preloadAll() {
  applyWardrobeArt();
  if (!window.__noPreload) await Promise.race([dcLoad(), new Promise(r => setTimeout(r, 2500))]);
  const L = $('loader');
  if (window.__noPreload) { L.hidden = true; artReady().then(() => { if (V.ok) rebuildHero(); }); modelsReady().then(() => { spawnVillageModels(); gameLoaded(); if (!window.__noTribePick) openTribePicker(); }); return; }
  // une astuce en bas de l'écran, qui change toutes les 5 secondes pendant le chargement
  let tipI = Math.floor(Math.random() * LOAD_TIPS.length); $('ldTip').textContent = LOAD_TIPS[tipI];
  const tipT = setInterval(() => { const t = $('ldTip'); t.classList.add('fade'); setTimeout(() => { tipI = (tipI + 1) % LOAD_TIPS.length; t.textContent = LOAD_TIPS[tipI]; t.classList.remove('fade'); }, 400); }, 5000);
  try { const s = woolSprite('royal', false), c = $('ldSheep'), g = c.getContext('2d'); g.drawImage(s, 0, 0, c.width, c.height); } catch (e) {}
  const steps = [];
  const add = (label, fn) => steps.push([label, fn]);
  add('Préparation des peintures…', () => new Promise(r => { whenTex(r); setTimeout(r, 4000); }));
  add('Les illustrations de la garde-robe…', async () => { await artReady(); if (V.ok) rebuildHero(); });
  add('Les habitants du village…', async () => { await modelsReady(); spawnVillageModels(); });
  add('Les boss se réveillent…', () => { for (const id in BOSS3D) bossSheet(id); });
  add('Les monstres du Bastion…', () => { for (const t in MONSTER3D) monsterFrames(t); });
  for (const B of BIOMES) add('Peinture du sol : ' + B.name, () => {
    if (!GTEX.ready) return;
    const tc = c => B.raw ? null : c;
    flushCanvas(B.ground === 'sand' ? texTile('sand', B.base, 0.8, 0.35) : texTile(B.ground, tc(B.base), B.gk || 0.9)); flushCanvas(texTile('dirt', tc(B.path), 1));
    if (B.feature === 'beach') flushCanvas(texTile('sand', tc(B.sand), 0.8, 0.35));
    if (B.feature === 'fields') flushCanvas(texTile('furrows', tc(B.crop), 1, 'tile'));
  });
  add('Reflets de l’eau…', () => { if (GTEX.ready) flushCanvas(causticTile()); });
  BIOMES.forEach((B, i) => add('Arbres et décor : ' + B.name, () => {
    const pI = biomeIdx, pD = DSPR;
    biomeIdx = i; DSPR = DSPR_ALL[i] || (DSPR_ALL[i] = {});
    try { for (const type of Object.keys(B.decor).concat(['rock'])) if (TALL[type] || type === 'rock') for (let v = 0; v < 4; v++) { const sp = decorSprite(type, B, v); flushCanvas(sp.top); if (sp.trunk) flushCanvas(sp.trunk); } }
    finally { biomeIdx = pI; DSPR = pD; }
  }));
  add('Les moutons de laine…', () => { for (const k in WOOL) { flushCanvas(woolSprite(k, false)); flushCanvas(woolSprite(k, true)); } });
  add('Ton héros essaie ses tenues…', () => { heroSheet(); });
  add('Ton familier se prépare…', () => { if (PETS[save.pet]) petSheet(save.pet); });
  add('Première zone du Bastion…', () => { setBiome(0); flushCanvas(biome.layer); });
  add('Le village s’éveille…', () => { if (V.ok) V.renderer.compile(V.scene, V.camera); });
  add('La forêt du Loup-Garou…', () => { if (V.ok) { if (!WS) buildWolfScene(); V.renderer.compile(WS.scene, WS.cam); } });
  add('La garde-robe…', () => { initPreview(); if (PV.r) PV.r.compile(PV.scene, PV.cam); });
  const t0 = performance.now();
  window.__loading = true;   // pendant le chargement, on ne redessine pas le village derrière l'écran
  let lastYield = 0;
  for (let i = 0; i < steps.length; i++) {
    // on rend la main au navigateur (pour faire avancer la barre) seulement toutes les ~60 ms de travail
    if (performance.now() - lastYield > 60) {
      $('ldStep').textContent = steps[i][0];
      $('ldFill').style.width = $('smFill').style.width = Math.round(i / steps.length * 100) + '%';
      $('smStep').textContent = steps[i][0];
      await new Promise(r => setTimeout(r, 0)); lastYield = performance.now();
    }
    const ts = performance.now();
    try { await steps[i][1](); } catch (e) {}
    (window.__steps || (window.__steps = [])).push(steps[i][0] + ' ' + Math.round(performance.now() - ts));
  }
  window.__loading = false;
  $('ldFill').style.width = '100%'; $('ldStep').textContent = 'Prêt !';
  window.__preloadMs = Math.round(performance.now() - t0); window.__cacheHits = DC.hits;
  clearTimeout(DC.timer); DC.timer = setTimeout(dcSave, 1500);
  await new Promise(r => setTimeout(r, 350));
  // le chargement d'abord, puis le choix du personnage (le jeu est prêt : on entre tout de suite)
  clearInterval(tipT); gameLoaded(); if (!window.__noMenu) openSlotMenu();
  L.classList.add('out'); setTimeout(() => { L.hidden = true; if ($('slotMenu').hidden && !window.__noTribePick) openTribePicker(); }, 600);
  setTimeout(() => { if (!window.__noChest && state === 'village' && chestState().ready && !anyModalOpen()) openChestModal(); }, 900);
}

// ---------- Coffre du jour : un coffre gratuit par jour, de mieux en mieux si on revient plusieurs jours de suite ----------
const dayKey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function chestState() {
  const D = save.daily || (save.daily = { last: '', streak: 0 });
  const today = dayKey(), y = new Date(); y.setDate(y.getDate() - 1);
  const ready = D.last !== today;
  // Série : on garde le compte si on est venu hier, sinon on recommence au jour 1 (maximum 7)
  const next = ready ? (D.last === dayKey(y) ? Math.min(7, D.streak + 1) : 1) : D.streak;
  return { ready, day: next };
}
// Récompense selon le jour de la série (les prix du jeu vont de 100 à 1 500 pièces ; les gemmes servent à finir les constructions)
function rollChest(day) {
  const k = 1 + 0.15 * (day - 1), r = Math.random(), ri = (a, b) => Math.round(a + Math.random() * (b - a));
  let coins = 0, gems = 0, kind;
  if (day === 7 || r < 0.15) { kind = 'mix'; coins = ri(60, 140) * k; gems = ri(2, 5) * k; }
  else if (r < 0.75) { kind = 'coins'; coins = ri(80, 200) * k; }
  else { kind = 'gems'; gems = ri(3, 8) * k; }
  const jackpot = Math.random() < 0.05;
  if (jackpot) { coins *= 3; gems *= 3; }
  return { kind, coins: Math.round(coins / 5) * 5, gems: Math.round(gems), jackpot };
}
const CH = { anim: null };
function chestLook(day) { return day >= 6 ? { band: '#ffd23f', wood: '#7a3a9a', name: 'Coffre légendaire' } : day >= 3 ? { band: '#d8dcef', wood: '#a0602f', name: 'Coffre renforcé' } : { band: '#c98a3a', wood: '#9a6a3a', name: 'Coffre en bois' }; }
// Dessin du coffre (vu de face, un peu de dessus), couvercle qui s'ouvre de 0 à 1
function drawChest(g, W, H, t, open, shake, look) {
  g.clearRect(0, 0, W, H);
  const cx = W / 2 + (shake ? Math.sin(t * 40) * shake * 6 : 0), by = H * 0.78, w = 190, h = 92;
  // rayons de lumière derrière quand il est ouvert
  if (open > 0) {
    g.save(); g.translate(W / 2, by - h); g.rotate(t * 0.6); g.globalAlpha = Math.min(1, open) * 0.55 * (1 - 0.8 * (CH.dim || 0));
    for (let i = 0; i < 12; i++) { g.rotate(TAU / 12); g.fillStyle = i % 2 ? '#fff2a8' : '#ffd23f'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-22, -260); g.lineTo(22, -260); g.closePath(); g.fill(); }
    g.restore(); g.globalAlpha = 1;
  }
  g.fillStyle = 'rgba(20,10,40,.35)'; g.beginPath(); g.ellipse(cx, by + 8, w * 0.62, 16, 0, 0, TAU); g.fill();
  const box = (x, y, bw, bh, r, fill) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, bw, bh, r) : g.rect(x, y, bw, bh); g.fillStyle = fill; g.fill(); g.lineWidth = 5; g.strokeStyle = '#2a1830'; g.stroke(); };
  // intérieur lumineux
  if (open > 0) { const gr = g.createRadialGradient(cx, by - h, 4, cx, by - h, w * 0.6); gr.addColorStop(0, '#fffbe0'); gr.addColorStop(1, '#ffb02e'); g.fillStyle = gr; g.beginPath(); g.ellipse(cx, by - h + 2, w / 2 - 6, 18, 0, 0, TAU); g.fill(); }
  // caisse
  const wg = g.createLinearGradient(0, by - h, 0, by); wg.addColorStop(0, tint(look.wood, 0.2)); wg.addColorStop(1, tint(look.wood, -0.3));
  box(cx - w / 2, by - h, w, h, 10, wg);
  g.strokeStyle = 'rgba(40,20,10,.35)'; g.lineWidth = 3; for (const yy of [by - h * 0.62, by - h * 0.3]) { g.beginPath(); g.moveTo(cx - w / 2 + 8, yy); g.lineTo(cx + w / 2 - 8, yy); g.stroke(); }
  for (const bx of [cx - w / 2 + 26, cx + w / 2 - 26]) box(bx - 11, by - h, 22, h, 4, look.band);
  // couvercle (il bascule vers l'arrière : on l'écrase verticalement et on le remonte)
  const a = open * 1.45, lh = 62, sy = Math.max(0.12, Math.cos(a)), lift = Math.sin(a) * 30;
  g.save(); g.translate(cx, by - h - lift); g.scale(1, sy);
  const lg = g.createLinearGradient(0, -lh, 0, 0); lg.addColorStop(0, tint(look.wood, 0.35)); lg.addColorStop(1, look.wood);
  g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(-w / 2, -lh * 0.45); g.quadraticCurveTo(0, -lh * 1.35, w / 2, -lh * 0.45); g.lineTo(w / 2, 0); g.closePath();
  g.fillStyle = lg; g.fill(); g.lineWidth = 5; g.strokeStyle = '#2a1830'; g.stroke();
  for (const bx of [-w / 2 + 26, w / 2 - 26]) { g.beginPath(); g.moveTo(bx - 11, 0); g.lineTo(bx - 11, -lh * 0.85); g.lineTo(bx + 11, -lh * 0.88); g.lineTo(bx + 11, 0); g.closePath(); g.fillStyle = look.band; g.fill(); g.stroke(); }
  g.restore();
  // serrure
  if (open < 0.3) { box(cx - 17, by - h - 14, 34, 36, 8, look.band); g.fillStyle = '#2a1830'; g.beginPath(); g.arc(cx, by - h + 0, 5, 0, TAU); g.fill(); g.fillRect(cx - 2, by - h + 2, 4, 10); }
  // reflets
  g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(cx - w / 2 + 8, by - h + 6, w - 16, 6);
}
$('chestM').addEventListener('click', e => {
  if (e.target.closest('button')) return;
  if (e.target === $('chestM') || $('chestOpen').hidden) $('chestM').hidden = true;
});
function openChestModal() {
  const st = chestState(), look = chestLook(st.day);
  $('chestTitle').textContent = st.ready ? look.name + ' du jour' : 'Coffre du jour';
  $('chestStreak').innerHTML = [1, 2, 3, 4, 5, 6, 7].map(d => `<span class="cday${d < st.day || (!st.ready && d === st.day) ? ' done' : ''}${st.ready && d === st.day ? ' now' : ''}">${d === 7 ? '★' : d}</span>`).join('');
  $('chestSub').textContent = st.ready ? `Jour ${st.day} de suite · plus tu reviens chaque jour, plus le coffre est beau (jour 7 : coffre légendaire)` : `Déjà ouvert aujourd’hui · série de ${st.day} jour${st.day > 1 ? 's' : ''}`;
  $('chestRes').innerHTML = st.ready ? 'Touche le coffre pour l’ouvrir !' : `Prochain coffre dans <b>${nextChestIn()}</b>`;
  $('chestOpen').hidden = !st.ready; $('chestOpen').disabled = false;
  openModal('chestM');
  const cv = $('chestCv'), g = cv.getContext('2d');
  CH.look = look; CH.open = st.ready ? 0 : 1; CH.dim = st.ready ? 0 : 1; CH.t = 0; CH.parts = []; CH.shake = 0; CH.opening = false;
  if (!CH.anim) {
    let last = performance.now();
    const loop = now => {
      if ($('chestM').hidden) { CH.anim = null; return; }
      const dt = Math.min(0.1, (now - last) / 1000); last = now; CH.t += dt;
      if (CH.opening) { CH.ot += dt; CH.shake = CH.ot < 0.8 ? CH.ot / 0.8 : 0; if (CH.ot > 0.8) { CH.open = Math.min(1, CH.open + dt * 2.5); if (!CH.revealed) { CH.revealed = true; revealChest(); } if (CH.ot > 1.5) CH.dim = Math.min(1, CH.dim + dt * 0.8); } }
      drawChest3D(g, cv.width, cv.height, CH.t, CH.open, CH.shake, CH.look);
      for (const p of CH.parts) {
        p.vy += 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 6;
        if (p.gem) { g.save(); g.translate(p.x, p.y); g.rotate(p.r * 0.3); g.fillStyle = '#3db8ff'; g.strokeStyle = '#2a1830'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, -9); g.lineTo(7, 0); g.lineTo(0, 9); g.lineTo(-7, 0); g.closePath(); g.fill(); g.stroke(); g.restore(); }
        else { g.fillStyle = '#ffd23f'; g.strokeStyle = '#2a1830'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(p.x, p.y, 8 * Math.abs(Math.cos(p.r)) + 1.5, 8, 0, 0, TAU); g.fill(); g.stroke(); }
      }
      CH.parts = CH.parts.filter(p => p.y < cv.height + 20);
      CH.anim = requestAnimationFrame(loop);
    };
    CH.anim = requestAnimationFrame(loop);
  }
}
function claimChest() {
  const st = chestState(); if (!st.ready || CH.opening) return;
  const R = rollChest(st.day);
  save.daily = { last: dayKey(), streak: st.day };
  save.coins += R.coins; save.gems += R.gems;
  persist(); updateVhud(); refreshChestBtn();
  CH.opening = true; CH.ot = 0; CH.revealed = false; CH.reward = R; $('chestOpen').disabled = true;
  $('chestRes').textContent = '…';
}
// Le coffre s'ouvre : pièces et gemmes jaillissent, la récompense s'affiche
function revealChest() {
  const R = CH.reward;
  {
    sfx('coin');
    const cv = $('chestCv');
    for (let i = 0; i < (R.coins ? 26 : 0) + (R.gems ? 14 : 0); i++) CH.parts.push({ x: cv.width / 2 + (Math.random() - 0.5) * 60, y: cv.height * 0.55, vx: (Math.random() - 0.5) * 420, vy: -300 - Math.random() * 320, r: Math.random() * 6, gem: R.gems && (i >= 26 || !R.coins) });
    // une fois ouvert, le coffre s'assombrit et les gains s'affichent en grand
    const COIN = '<svg viewBox="0 0 64 64"><ellipse cx="32" cy="36" rx="26" ry="24" fill="#b8700a" stroke="#2a1830" stroke-width="4"/><ellipse cx="32" cy="30" rx="26" ry="24" fill="#ffd23f" stroke="#2a1830" stroke-width="4"/><ellipse cx="32" cy="30" rx="17" ry="15" fill="none" stroke="#e8a020" stroke-width="4"/><path d="M22 20q6-6 14-5" stroke="#fff6c0" stroke-width="5" fill="none" stroke-linecap="round"/></svg>';
    const GEM = '<svg viewBox="0 0 64 64"><path d="M14 22 24 8h16l10 14-18 34z" fill="#3db8ff" stroke="#2a1830" stroke-width="4" stroke-linejoin="round"/><path d="M14 22h36L32 56z" fill="#1f86d9"/><path d="M24 8l-4 14 12 34 12-34-4-14" fill="none" stroke="#2a1830" stroke-width="2.5" stroke-linejoin="round"/><path d="M14 22h36" stroke="#2a1830" stroke-width="3"/><path d="M27 12h8l-3 8z" fill="#c8f0ff"/></svg>';
    const card = (svg, n, label) => `<div class="loot-card">${svg}<span class="lx">×${n}</span><span class="ln">${label}</span></div>`;
    const bits = [];
    if (R.coins) bits.push(card(COIN, R.coins, 'pièces'));
    if (R.gems) bits.push(card(GEM, R.gems, 'gemmes'));
    $('chestRes').innerHTML = (R.jackpot ? '<b class="jack">JACKPOT ×3 !</b>' : '') + `<div class="loot">${bits.join('')}</div>` + (save.testMode ? '<br><small>(mode test : ton porte-monnaie est déjà illimité)</small>' : '');
    $('chestOpen').hidden = true;
    $('chestStreak').querySelectorAll('.now').forEach(e => { e.classList.remove('now'); e.classList.add('done'); });
  }
}
function nextChestIn() {
  const n = new Date(); const m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
  const s = Math.max(0, (m - n) / 1000), h = Math.floor(s / 3600), mn = Math.floor(s % 3600 / 60);
  return h ? h + ' h ' + String(mn).padStart(2, '0') : mn + ' min';
}
function refreshChestBtn() {
  const st = chestState(), b = $('vChest');
  b.innerHTML = st.ready ? 'Coffre du jour !' : 'Coffre : ' + nextChestIn();
  b.classList.toggle('ready', st.ready);
}

// ---------- Loup-Garou : une soirée au coin du feu dans la forêt, la nuit, avec 8 bots ----------
const WROLES = {
  loup:       { name: 'Loup-Garou', team: 'loups',   color: '#ff5b4a', desc: 'Chaque nuit, avec ton complice, tu choisis un villageois à dévorer. Le jour, fais-toi passer pour quelqu’un du village !' },
  voyante:    { name: 'Voyante',    team: 'village', color: '#c9a0ff', desc: 'Chaque nuit, tu découvres le vrai rôle d’un joueur de ton choix.' },
  sorciere:   { name: 'Sorcière',   team: 'village', color: '#3df5b0', desc: 'Tu as une potion de vie (sauver la victime des loups) et une potion de mort (éliminer quelqu’un). Une seule fois chacune.' },
  chasseur:   { name: 'Chasseur',   team: 'village', color: '#ff9a3a', desc: 'Si tu meurs, tu tires une dernière fois et tu emportes quelqu’un avec toi.' },
  villageois: { name: 'Villageois', team: 'village', color: '#ffd23f', desc: 'Pas de pouvoir, mais ta voix compte : trouve les loups et vote contre eux !' },
};
const WNAMES = ['Pépin', 'Rosalie', 'Gustave', 'Mila', 'Barnabé', 'Lou', 'Octave', 'Iris', 'Céleste', 'Firmin', 'Nina', 'Augustin'];
const WBOTSKINS = ['recrue', 'neon', 'ombre', 'cyber', 'turquoise', 'foret', 'braise', 'tribal', 'heros', 'samourai', 'os', 'paladin', 'legende', 'dino'];
const NSEAT = 9, SEAT_R = 4.4;
let WG = null, WS = null;
const wsleep = ms => new Promise(r => setTimeout(r, ms));
const wpick = a => a[Math.floor(Math.random() * a.length)];
// --- La scène : clairière, feu de camp, forêt sombre, lune
function buildWolfScene() {
  const T = THREE, sc = new T.Scene();
  sc.fog = new T.Fog('#0a0f26', 16, 46);
  sc.add(new T.HemisphereLight('#5a6ab8', '#141428', 0.42));
  const moon = new T.DirectionalLight('#9fb0ff', 0.4); moon.position.set(-12, 22, -10); sc.add(moon);
  const fire = new T.PointLight('#ff9a3a', 2.4, 20, 1.5); fire.position.set(0, 1.5, 0); sc.add(fire);
  const gtex = c => { const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t; };
  let grass = null, dirt = null;
  if (GTEX.ready) { grass = gtex(texTile('grass', '#2d4a2a', 0.8)); grass.repeat.set(10, 10); dirt = gtex(texTile('dirt', '#6a4a32', 0.8)); dirt.repeat.set(2, 2); }
  const gnd = new T.Mesh(new T.CircleGeometry(60, 40), new T.MeshToonMaterial({ color: '#ffffff', map: grass, gradientMap: GRAD })); if (!grass) gnd.material.color.set('#2d4a2a');
  gnd.rotation.x = -Math.PI / 2; sc.add(gnd);
  const clr = new T.Mesh(new T.CircleGeometry(7.2, 36), new T.MeshToonMaterial({ color: '#ffffff', map: dirt, gradientMap: GRAD })); if (!dirt) clr.material.color.set('#6a4a32');
  clr.rotation.x = -Math.PI / 2; clr.position.y = 0.02; sc.add(clr);
  // feu : pierres, bûches, flammes, braises (le feu de camp 3D quand il est chargé)
  const camp = !!(MODELS.camp && MODELS.camp.parts.fire);
  if (camp) sc.add(kitPiece('camp', 'fire', 70));
  else for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, s = mk(new T.DodecahedronGeometry(0.28, 0), '#7a7488', Math.cos(a) * 1.05, 0.15, Math.sin(a) * 1.05, sc); s.rotation.set(i, i * 2, 0); }
  if (!camp) for (let i = 0; i < 4; i++) { const l = mk(new T.CylinderGeometry(0.12, 0.14, 1.6, 8), '#5a3a26', 0, 0.3, 0, sc); l.rotation.set(Math.PI / 2 - 0.35, i * Math.PI / 4, 0); }
  const flames = [];
  for (const [r, h, c, y] of [[0.55, 1.5, '#ff5a1f', 0.75], [0.4, 1.2, '#ff9a2a', 0.7], [0.25, 0.85, '#ffe066', 0.6]]) {
    const f = new T.Mesh(new T.ConeGeometry(r, h, 10), new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.92 })); f.position.y = y + (camp ? 0.12 : 0); sc.add(f); flames.push(f);
  }
  const embers = [];
  for (let i = 0; i < 24; i++) { const e = new T.Mesh(new T.SphereGeometry(0.035, 5, 4), new T.MeshBasicMaterial({ color: '#ffb040' })); e.userData = { t: Math.random(), a: Math.random() * TAU, r: Math.random() * 0.4 }; sc.add(e); embers.push(e); }
  // halo du feu au sol
  const hc = document.createElement('canvas'); hc.width = hc.height = 128; const hg = hc.getContext('2d');
  const gr = hg.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,160,60,.55)'); gr.addColorStop(1, 'rgba(255,160,60,0)'); hg.fillStyle = gr; hg.fillRect(0, 0, 128, 128);
  const halo = new T.Mesh(new T.PlaneGeometry(9, 9), new T.MeshBasicMaterial({ map: new T.CanvasTexture(hc), transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = 0.04; sc.add(halo);
  // bûches pour s'asseoir
  if (camp) {
    // rondins du feu de camp, posés en arc de cercle face au feu
    kitInstances('camp', 'log2', [...Array(NSEAT)].map((_, i) => { const a = Math.PI / 2 + i * TAU / NSEAT; return [Math.cos(a) * (SEAT_R + 0.1), 0, Math.sin(a) * (SEAT_R + 0.1), -a - Math.PI / 2, [25, 45, 45]]; }), sc);
    // forêt de sapins tout autour, et quelques souches au bord de la clairière
    const R = seeded(515), trees = { tree0: [], tree4: [], tree8: [], tree11: [] }, tn = Object.keys(trees), stumps = { stump1: [], stump3: [] };
    for (let i = 0; i < 64; i++) { const a = R() * TAU, r = 9.5 + R() * 24; trees[tn[i % 4]].push([Math.cos(a) * r, 0, Math.sin(a) * r, R() * TAU, 62 + R() * 30]); }
    for (let i = 0; i < 9; i++) { const a = (i + 0.5) * TAU / 9 + (R() - 0.5) * 0.3, r = 7.6 + R() * 1.4; stumps[i % 2 ? 'stump1' : 'stump3'].push([Math.cos(a) * r, 0, Math.sin(a) * r, R() * TAU, 32 + R() * 10]); }
    for (const n of tn) kitInstances('camp', n, trees[n], sc);
    for (const n in stumps) kitInstances('camp', n, stumps[n], sc);
  } else {
    for (let i = 0; i < NSEAT; i++) { const a = Math.PI / 2 + i * TAU / NSEAT, x = Math.cos(a) * (SEAT_R + 0.1), z = Math.sin(a) * (SEAT_R + 0.1); const l = mk(new T.CylinderGeometry(0.26, 0.28, 1.3, 10), '#6a4428', x, 0.26, z, sc); l.rotation.set(0, -a, Math.PI / 2); }
    // forêt sombre tout autour
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * TAU, r = 10 + Math.random() * 22, x = Math.cos(a) * r, z = Math.sin(a) * r, s = 0.9 + Math.random() * 0.8;
      mk(new T.CylinderGeometry(0.2 * s, 0.32 * s, 2 * s, 7), '#3a2a22', x, s, z, sc);
      if (i % 3) { for (const [y, w, h] of [[2.2, 1.7, 2.0], [3.3, 1.3, 1.8], [4.3, 0.85, 1.5]]) mk(new T.ConeGeometry(w * s, h * s, 8), '#1f4438', x, y * s, z, sc); }
      else for (const [ox, oy, oz, rr] of [[0, 3.1, 0, 1.4], [0.8, 2.6, 0.3, 1.0], [-0.8, 2.7, -0.2, 1.0]]) mk(new T.SphereGeometry(rr * s, 10, 8), '#28503a', x + ox * s, oy * s, z + oz * s, sc);
    }
  }
  deadTreesWolf(sc);
  // lune et lucioles
  const mc = document.createElement('canvas'); mc.width = mc.height = 128; const mg = mc.getContext('2d');
  const mgr = mg.createRadialGradient(64, 64, 0, 64, 64, 64); mgr.addColorStop(0, '#ffffff'); mgr.addColorStop(0.35, '#f4f0d8'); mgr.addColorStop(0.42, 'rgba(220,230,255,.5)'); mgr.addColorStop(1, 'rgba(200,210,255,0)'); mg.fillStyle = mgr; mg.fillRect(0, 0, 128, 128);
  const moonS = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(mc), transparent: true, fog: false })); moonS.scale.set(12, 12, 1); moonS.position.set(-14, 20, -34); sc.add(moonS);
  const flies = [];
  for (let i = 0; i < 18; i++) { const f = new T.Mesh(new T.SphereGeometry(0.05, 5, 4), new T.MeshBasicMaterial({ color: '#d8ff8a' })); f.userData = { a: Math.random() * TAU, r: 7 + Math.random() * 5, h: 0.8 + Math.random() * 2, s: 0.1 + Math.random() * 0.2 }; sc.add(f); flies.push(f); }
  // le Conteur : vieux sage encapuchonné, barbe blanche, lanterne
  const nar = new T.Group(); nar.position.set(0, 0, -6.6); sc.add(nar);
  mk(new T.ConeGeometry(0.75, 2.0, 14), '#4a2a7a', 0, 1.0, 0, nar);
  mk(new T.SphereGeometry(0.42, 16, 12), '#f2c29b', 0, 2.15, 0, nar);
  mk(new T.SphereGeometry(0.47, 16, 10, 0, TAU, 0, Math.PI * 0.62), '#3a1f66', 0, 2.2, -0.04, nar);
  mk(new T.ConeGeometry(0.3, 0.9, 10), '#3a1f66', 0, 2.75, -0.15, nar).rotation.x = -0.5;
  const beard = mk(new T.ConeGeometry(0.3, 0.8, 10), '#f4f0e8', 0, 1.7, 0.3, nar); beard.rotation.x = Math.PI + 0.25;
  for (const s of [-1, 1]) mk(new T.SphereGeometry(0.05, 8, 6), '#2a1830', s * 0.14, 2.2, 0.38, nar);
  mk(new T.CylinderGeometry(0.04, 0.05, 2.2, 6), '#6a4428', 0.7, 1.1, 0.2, nar);
  const lant = mk(BX(0.24, 0.3, 0.24), '#ffd27a', 0.7, 2.15, 0.2, nar, { emissive: '#ffa030' });
  const nl = new T.PointLight('#ffc070', 0.7, 6, 1.6); nl.position.set(0.7, 2.2, 0.5); nar.add(nl);
  nar.rotation.y = 0;
  addOutline(nar, 0.03);
  const cam = new T.PerspectiveCamera(44, 1, 0.3, 120);
  WS = { scene: sc, cam, fire, flames, embers, flies, nar, lant, t: 0, camp };
}
// --- Étiquette de nom au-dessus d'un joueur
function wLabel(text, sub, col) {
  const c = document.createElement('canvas'); c.width = 320; c.height = 96; const g = c.getContext('2d');
  g.fillStyle = 'rgba(20,12,40,.82)'; g.beginPath(); g.roundRect ? g.roundRect(8, 8, 304, sub ? 80 : 54, 22) : g.rect(8, 8, 304, 80); g.fill();
  g.textAlign = 'center'; g.fillStyle = col || '#fff8ec'; g.font = '40px "Lilita One", sans-serif'; g.fillText(text, 160, 48);
  if (sub) { g.font = '800 24px Nunito, sans-serif'; g.fillStyle = '#ffd23f'; g.fillText(sub, 160, 78); }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
  s.scale.set(1.9, 0.57, 1); s.renderOrder = 10; return s;
}
function wRefreshLabel(i) {
  const p = WG.P[i], me = WG.P[0];
  let sub = '', col = '#fff8ec';
  if (!p.alive) { sub = '✝ ' + WROLES[p.role].name; col = '#9a94b0'; }
  else if (i === 0) { sub = 'Toi · ' + WROLES[p.role].name; col = '#ffd23f'; }
  else if (WG.revealed && me.role === 'loup' && p.role === 'loup') { sub = 'Ton complice loup'; col = '#ff8a7a'; }
  else if (WG.known[i]) { sub = 'Vu : ' + WROLES[p.role].name; }
  if (p.label) WS.scene.remove(p.label);
  if (i === 0 && p.alive) { p.label = null; return; }   // ton rôle est affiché en haut de l'écran
  p.label = wLabel(i === 0 ? 'Toi' : p.name, sub, col);
  p.label.position.set(p.x, 2.95, p.z); WS.scene.add(p.label);
}
// --- Personnages autour du feu
function placeWolfPlayers() {
  for (const p of WG.P) { if (p.char) WS.scene.remove(p.char); if (p.label) WS.scene.remove(p.label); if (p.grave) WS.scene.remove(p.grave); }
  WG.P.forEach((p, i) => {
    const a = Math.PI / 2 + i * TAU / NSEAT; p.x = Math.cos(a) * SEAT_R; p.z = Math.sin(a) * SEAT_R;
    if (i === 0) p.char = buildHero3D('perso', CLASSES[save.cls].color);
    else { gearOff = true; try { p.char = buildHero3D(p.skin, p.cls); } finally { gearOff = false; } }
    const u = p.char.userData;
    if (u.gun) u.gun.visible = false;
    u.arms.forEach((sh, k) => { sh.quaternion.identity(); sh.scale.set(1, 1, 1); sh.children.forEach(c => c.scale.set(1, 1, 1)); sh.rotation.set(-1.1, 0, (k ? -1 : 1) * 0.25); });
    u.body.rotation.y = 0; if (u.head) u.head.rotation.y = 0;
    u.legs.forEach(l => { l.rotation.x = -1.45; });
    p.char.position.set(p.x, -0.28, p.z); p.char.rotation.y = Math.atan2(-p.x, -p.z);
    WS.scene.add(p.char);
    wRefreshLabel(i);
  });
}
function wShowDead(i) {
  const p = WG.P[i], T = THREE;
  p.char.visible = false;
  const g = new T.Group(); g.position.set(p.x * 1.08, 0, p.z * 1.08); g.rotation.y = Math.atan2(-p.x, -p.z);
  mk(BX(0.7, 0.9, 0.18), '#8a8698', 0, 0.45, 0, g); mk(new T.CylinderGeometry(0.35, 0.35, 0.18, 14, 1, false, 0, Math.PI), '#8a8698', 0, 0.9, 0, g).rotation.set(Math.PI / 2, 0, Math.PI / 2);
  mk(BX(0.08, 0.4, 0.04), '#5a5468', 0, 0.6, 0.1, g); mk(BX(0.26, 0.08, 0.04), '#5a5468', 0, 0.68, 0.1, g);
  WS.scene.add(g); p.grave = g;
  wRefreshLabel(i);
}
// --- Interface : texte du Conteur et des joueurs, boutons de choix, bulles
let wSkip = null;
function wAlive(g) { if (WG !== g) throw 'quit'; }
function wSpeakerName(who) { return who === 'nar' ? 'Le Conteur' : who === 0 ? 'Toi' : WG.P[who].name; }
async function wSay(who, text, wait) {
  const g = WG;
  $('wWho').textContent = wSpeakerName(who); $('wWho').style.color = who === 'nar' ? '#c9a0ff' : who === 0 ? '#ffd23f' : '#8fd8ff';
  $('wText').textContent = text; $('wBtns').innerHTML = '';
  WG.speaker = who;
  if (who !== 'nar') wBubble(who, text);
  if (wait) {
    $('wBtns').innerHTML = `<button class="btn" data-wnext>${wait === true ? 'Suivant' : wait}</button>`;
    await new Promise(r => { wSkip = r; });
  } else {
    const ms = clamp(1300 + text.length * 38, 1800, 5200);
    await new Promise(r => { wSkip = r; setTimeout(r, ms); });
  }
  wSkip = null; wAlive(g);
}
async function wChoose(text, options, who) {
  const g = WG;
  $('wWho').textContent = wSpeakerName(who || 'nar'); $('wWho').style.color = '#c9a0ff';
  $('wText').textContent = text;
  $('wBtns').innerHTML = options.map((o, k) => `<button class="btn${o.alt ? ' alt' : ''}" data-wopt="${k}">${o.label}</button>`).join('');
  const v = await new Promise(r => { WG.choose = k => r(options[k].value); });
  WG.choose = null; wAlive(g);
  return v;
}
const wPlayerOpts = list => list.map(i => ({ label: WG.P[i].name + (WG.known[i] ? ' (' + WROLES[WG.P[i].role].name + ')' : ''), value: i }));
function wBubble(i, text) {
  const d = document.createElement('div'); d.className = 'w-bubble'; d.textContent = text; $('wBubbles').appendChild(d);
  WG.bubbles.push({ el: d, i, until: performance.now() + clamp(1600 + text.length * 40, 2200, 5500) });
}
function wPhase(t) { $('wPhase').textContent = t; }
function wNight(on) { WG.night = on; $('wNight').classList.toggle('on', on); }
// --- Logique des bots : soupçons
const wLiving = () => WG.P.map((p, i) => p.alive ? i : -1).filter(i => i >= 0);
const isWolf = i => WG.P[i].role === 'loup';
function wSus(l, t, d) { if (l === t || !WG.P[l].bot) return; WG.sus[l][t] = clamp(WG.sus[l][t] + d, 0, 1); }
function wTop(l, list) { return WG.social.chooseTarget(l, list); }
// --- Déroulement d'une partie
function startWolf() {
  if (!V.ok || !window.THREE) { banner('Loup-Garou', 'Il faut la 3D pour jouer'); return; }
  if (WS && !WS.camp && MODELS.camp) WS = null;   // scène construite avant le chargement du feu de camp 3D
  if (!WS) buildWolfScene();
  const roles = ['loup', 'loup', 'voyante', 'sorciere', 'chasseur', 'villageois', 'villageois', 'villageois', 'villageois'].sort(() => Math.random() - 0.5);
  const names = WNAMES.slice().sort(() => Math.random() - 0.5), skins = WBOTSKINS.slice().sort(() => Math.random() - 0.5), cols = Object.values(CLASSES).map(c => c.color);
  WG = { P: roles.map((r, i) => ({ role: r, alive: true, bot: i > 0, name: i ? names[i - 1] : 'Toi', skin: skins[i % skins.length], cls: wpick(cols) })),
    sus: [...Array(NSEAT)].map(() => [...Array(NSEAT)].map(() => 0.3 + Math.random() * 0.2)), known: {}, botKnown: {}, potions: { life: true, death: true },
    claimed: -1, bubbles: [], night: true, day: 0, speaker: null, choose: null };
  WG.P.forEach(p => { p.known = {}; });
  WG.P[0].known = WG.known;
  WG.social = new WolfSocial(WG.P); WG.sus = WG.social.suspicion;
  // les loups se connaissent
  for (let l = 0; l < NSEAT; l++) for (let j = 0; j < NSEAT; j++) if (isWolf(l) && isWolf(j)) WG.sus[l][j] = 0;
  state = 'wolf'; resetVjoy();
  for (const id of ['portalM', 'classesM', 'skinsM', 'decoM', 'chestM']) $(id).hidden = true;
  $('vhud').hidden = true; $('vpanel').hidden = true; $('village').hidden = false; $('game').hidden = true;
  $('village').style.background = 'radial-gradient(1px 1px at 20% 15%,#fff,transparent),radial-gradient(1px 1px at 70% 8%,#fff,transparent),radial-gradient(1.5px 1.5px at 45% 22%,#fff,transparent),radial-gradient(1px 1px at 85% 30%,#fff,transparent),linear-gradient(180deg,#05071a,#141a44 70%)';
  $('wolf').hidden = false; $('wBubbles').innerHTML = ''; $('wRole').textContent = ''; $('wRole').hidden = true;
  placeWolfPlayers(); wNight(true); wPhase('Au coin du feu');
  runWolf(WG).catch(e => { if (e !== 'quit') console.error(e); });
}
function quitWolf() {
  WG = null; wSkip = null;
  $('wolf').hidden = true; $('wCard').hidden = true;
  state = 'village'; showOnly('village'); applyNight();
  if (V.ok) { resetVjoy(); placeHeroCam(true); updateVhud(); }
}
async function runWolf(g) {
  // Le Conteur explique les règles
  wPhase('Au coin du feu');
  const intro = [
    'Bienvenue au coin du feu, voyageur ! Je suis le Conteur. Ce soir, nous jouons au Loup-Garou…',
    'Parmi nous se cachent des loups-garous. Chaque nuit, pendant que tout le monde dort, ils dévorent un villageois.',
    'Chaque jour, le village se réveille, découvre qui a disparu, discute… puis vote pour éliminer un suspect.',
    'La Voyante peut découvrir le rôle d’un joueur chaque nuit. La Sorcière a une potion de vie et une potion de mort. Le Chasseur, s’il meurt, emporte quelqu’un avec lui.',
    'Le village gagne s’il élimine tous les loups. Les loups gagnent s’ils sont aussi nombreux que les villageois.',
    'Nous sommes 9 ce soir : 2 loups-garous, 1 voyante, 1 sorcière, 1 chasseur et 4 villageois. Voici ta carte…',
  ];
  for (let k = 0; k < intro.length; k++) {
    const r = await wChoose(intro[k], k < intro.length - 1 ? [{ label: 'Suivant', value: 'n' }, { label: 'Passer l’explication', value: 's', alt: true }] : [{ label: 'Voir ma carte', value: 'n' }]);
    if (r === 's') { await wSay('nar', 'D’accord ! Nous sommes 9 : 2 loups-garous, 1 voyante, 1 sorcière, 1 chasseur et 4 villageois. Voici ta carte…', 'Voir ma carte'); break; }
  }
  // Carte du rôle
  const me = WG.P[0], R = WROLES[me.role];
  $('wCardName').textContent = R.name; $('wCardName').style.color = R.color; $('wCardDesc').textContent = R.desc;
  $('wCard').style.setProperty('--rc', R.color); $('wCard').hidden = false;
  drawRoleArt($('wCardArt'), me.role);
  if (me.role === 'loup') { const mate = WG.P.findIndex((p, i) => i && p.role === 'loup'); $('wCardDesc').textContent += ' Ton complice : ' + WG.P[mate].name + '.'; }
  await new Promise(r => { wSkip = r; }); wSkip = null; wAlive(g);
  $('wCard').hidden = true;
  WG.revealed = true; $('wRole').textContent = 'Ton rôle : ' + R.name; $('wRole').style.color = R.color; $('wRole').hidden = false;
  WG.P.forEach((_, i) => wRefreshLabel(i));
  for (let n = 1; ; n++) {
    const deaths = await wNightPhase(n, g);
    WG.day = n; wNight(false); wPhase('Jour ' + n);
    await wSay('nar', 'Le soleil se lève… enfin, la lune pâlit. Le village se réveille !');
    if (!deaths.length) await wSay('nar', 'Miracle ! Personne n’est mort cette nuit.');
    for (const d of deaths) { await wKill(d, 'nuit', g); }
    if (await wCheckWin(g)) return;
    await wDayPhase(n, g);
    if (await wCheckWin(g)) return;
  }
}
async function wNightPhase(n, g) {
  WG.social.startDay(n);
  wNight(true); wPhase('Nuit ' + n);
  await wSay('nar', 'La nuit tombe sur la forêt… Tout le monde ferme les yeux.');
  const A = wLiving(), me = WG.P[0];
  // Voyante
  const seer = A.find(i => WG.P[i].role === 'voyante');
  if (seer !== undefined) {
    await wSay('nar', 'La Voyante se réveille et désigne un joueur dont elle veut connaître le rôle.');
    if (seer === 0 && A.some(i => i !== 0 && !WG.known[i])) {
      const t = await wChoose('Toi, la Voyante : de qui veux-tu voir la carte ?', wPlayerOpts(A.filter(i => i !== 0 && !WG.known[i])));
      WG.known[t] = true; wRefreshLabel(t);
      await wSay('nar', WG.P[t].name + ' est… ' + WROLES[WG.P[t].role].name + ' !', true);
    } else if (seer !== 0) {
      const cand = A.filter(i => i !== seer && !WG.botKnown[i]);
      if (cand.length) { const t = wTop(seer, cand); WG.botKnown[t] = true; WG.P[seer].known[t] = true; WG.sus[seer][t] = isWolf(t) ? 1 : 0; }
      await wsleep(900); wAlive(g);
    }
    await wSay('nar', 'La Voyante se rendort.');
  }
  // Loups
  await wSay('nar', 'Les Loups-Garous se réveillent… et choisissent leur victime.');
  let victim;
  const nonWolves = A.filter(i => !isWolf(i));
  if (me.alive && me.role === 'loup') {
    victim = await wChoose('Toi et ton complice : qui dévorez-vous cette nuit ?', wPlayerOpts(nonWolves));
  } else {
    victim = WG.social.nightTarget(A.filter(isWolf), nonWolves);
    await wsleep(1000); wAlive(g);
  }
  await wSay('nar', 'Les Loups-Garous se rendorment, le ventre plein…');
  const deaths = [victim];
  // Sorcière
  const witch = A.find(i => WG.P[i].role === 'sorciere');
  if (witch !== undefined && (WG.potions.life || WG.potions.death)) {
    await wSay('nar', 'La Sorcière se réveille…');
    if (witch === 0) {
      if (WG.potions.life) {
        const s = await wChoose('Cette nuit, les loups ont attaqué ' + (victim === 0 ? 'toi !' : WG.P[victim].name + '.') + ' Utiliser ta potion de vie ?', [{ label: 'Sauver ' + (victim === 0 ? 'ma vie' : WG.P[victim].name), value: true }, { label: 'Ne rien faire', value: false, alt: true }]);
        if (s) { WG.potions.life = false; deaths.length = 0; }
      } else await wSay('nar', 'Les loups ont attaqué ' + WG.P[victim].name + '. Tu n’as plus de potion de vie.', true);
      if (WG.potions.death) {
        const k = await wChoose('Utiliser ta potion de mort sur quelqu’un ?', [{ label: 'Non, garder la potion', value: -1, alt: true }, ...wPlayerOpts(A.filter(i => i !== 0))]);
        if (k >= 0) { WG.potions.death = false; if (!deaths.includes(k)) deaths.push(k); }
      }
    } else {
      if (WG.potions.life && (victim === witch || WG.social.score(witch, victim) < 0.4)) { WG.potions.life = false; deaths.length = 0; }
      if (WG.potions.death && n >= 2) { const t = wTop(witch, A.filter(i => i !== witch)); if (t >= 0 && WG.social.score(witch, t) > 0.72) { WG.potions.death = false; if (!deaths.includes(t)) deaths.push(t); } }
      await wsleep(1000); wAlive(g);
    }
    await wSay('nar', 'La Sorcière se rendort.');
  }
  return deaths;
}
async function wKill(i, cause, g) {
  const p = WG.P[i]; if (!p.alive) return;
  p.alive = false; WG.social.reveal(i, cause); wShowDead(i);
  const r = WROLES[p.role].name;
  if (cause === 'nuit') await wSay('nar', (i === 0 ? 'Tu as été éliminé(e) cette nuit…' : 'Cette nuit, ' + p.name + ' a disparu…') + ' C’était : ' + r + '.', i === 0 ? 'Continuer en spectateur' : false);
  else if (cause === 'vote') await wSay('nar', (i === 0 ? 'Le village t’a éliminé(e)…' : 'Le village a éliminé ' + p.name + '.') + ' C’était : ' + r + ' !', i === 0 ? 'Continuer en spectateur' : false);
  else await wSay('nar', p.name + ' tombe sous la flèche du Chasseur. C’était : ' + r + '.');
  if (p.role === 'chasseur') {
    const A = wLiving();
    if (!A.length) return;
    let t;
    if (i === 0) t = await wChoose('Tu es le Chasseur ! Sur qui tires-tu ta dernière flèche ?', wPlayerOpts(A));
    else { t = wTop(i, A); await wSay(i, 'Je suis le Chasseur… et j’emporte ' + WG.P[t].name + ' avec moi !'); }
    await wKill(t, 'chasseur', g);
  }
}
async function wDayPhase(n, g) {
  await wSay('nar', 'Place au débat ! Vos paroles changent les soupçons. Les rôles révélés permettront de vérifier vos accusations et vos votes.');
  for (let round = 1; round <= 2; round++) {
    wPhase('Jour ' + n + ' · débat ' + round + '/2');
    const bots = wLiving().filter(i => i !== 0), offset = (n + round) % Math.max(1, bots.length);
    for (const actor of [...bots.slice(offset), ...bots.slice(0, offset)].slice(0, 4)) {
      wAlive(g);
      const speech = WG.social.botSpeech(actor);
      if (speech) await wSay(actor, speech.text);
    }
    if (WG.P[0].alive) {
      const options = WG.social.options(0), kinds = [...new Set(options.map(o => o.kind))];
      const kind = await wChoose('À toi de parler — tour ' + round + '/2. Que veux-tu dire ?', kinds.map(k => ({label: WolfSocial.KIND_LABELS[k], value: k})));
      wAlive(g);
      const choices = options.filter(o => o.kind === kind);
      const value = choices.length === 1 ? choices[0].value : await wChoose('Choisis ta déclaration. Un bluff découvert peut se retourner contre toi.', choices);
      wAlive(g);
      const text = WG.social.speak(0, value);
      if (text) await wSay(0, text);
    }
  }
  wPhase('Jour ' + n + ' · vote');
  await wSay('nar', 'Le moment est venu de voter. Chacun désigne celui qu’il veut éliminer.');
  const A = wLiving(), votes = [];
  if (WG.P[0].alive) votes.push([0, await wChoose('Contre qui votes-tu ?', wPlayerOpts(A.filter(i => i !== 0)))]);
  wAlive(g);
  for (const v of A) if (v !== 0) votes.push([v, wTop(v, A)]);
  WG.lastVotes = votes; WG.social.recordVotes(Object.fromEntries(votes));
  await wSay('nar', 'Votes publics — ' + votes.map(([v, t]) => WG.P[v].name + ' → ' + WG.P[t].name).join(' · '), true);
  const tally = {};
  for (const [v, t] of votes) tally[t] = (tally[t] || 0) + 1;
  const max = Math.max(...Object.values(tally)), top = Object.keys(tally).filter(t => tally[t] === max).map(Number);
  if (top.length > 1) { await wSay('nar', 'Égalité ! Le village n’arrive pas à se décider : personne n’est éliminé aujourd’hui.'); return; }
  await wKill(top[0], 'vote', g);
}
async function wCheckWin(g) {
  const A = wLiving(), wolves = A.filter(isWolf).length, others = A.length - wolves;
  let win = null;
  if (!wolves) win = 'village'; else if (wolves >= others) win = 'loups';
  if (!win) return false;
  wPhase('Fin de la partie'); wNight(win === 'loups');
  const myTeam = WROLES[WG.P[0].role].team, won = myTeam === win;
  await wSay('nar', win === 'village' ? 'Le dernier loup-garou est démasqué : le village a gagné !' : 'Les loups-garous sont maintenant aussi nombreux que les villageois… les loups ont gagné !', true);
  WG.P.forEach((p, i) => { WG.known[i] = true; wRefreshLabel(i); });
  const coins = won ? 80 : 25, gems = won ? 3 : 0;
  save.coins += coins; save.gems += gems; save.wolfWins = (save.wolfWins || 0) + (won ? 1 : 0); persist();
  sfx(won ? 'level' : 'coin');
  const roles = WG.P.map(p => (p.bot ? p.name : 'Toi') + ' : ' + WROLES[p.role].name).join(' · ');
  const r = await wChoose((won ? 'Bravo, ton camp a gagné ! ' : 'Ton camp a perdu… ') + '+' + coins + ' pièces' + (gems ? ', +' + gems + ' gemmes' : '') + '. Les rôles étaient : ' + roles, [{ label: 'Rejouer', value: 'again' }, { label: 'Retour au village', value: 'out', alt: true }]);
  if (r === 'again') startWolf(); else quitWolf();
  return true;
}
// Dessin de la carte de rôle
function drawRoleArt(cv, role) {
  const g = cv.getContext('2d'), w = cv.width, h = cv.height, c = WROLES[role].color;
  g.clearRect(0, 0, w, h);
  const bg = g.createRadialGradient(w / 2, h * 0.45, 10, w / 2, h / 2, w * 0.7); bg.addColorStop(0, tint(c, -0.2)); bg.addColorStop(1, '#141030'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = '#f4f0d8'; g.beginPath(); g.arc(w * 0.75, h * 0.2, 18, 0, TAU); g.fill();
  g.lineJoin = 'round'; g.lineWidth = 5; g.strokeStyle = '#2a1830';
  const cx = w / 2, cy = h * 0.58;
  if (role === 'loup') {
    g.fillStyle = '#6a6a7a'; g.beginPath(); g.moveTo(cx - 50, cy + 40); g.lineTo(cx - 44, cy - 50); g.lineTo(cx - 20, cy - 20); g.lineTo(cx + 20, cy - 20); g.lineTo(cx + 44, cy - 50); g.lineTo(cx + 50, cy + 40); g.quadraticCurveTo(cx, cy + 80, cx - 50, cy + 40); g.fill(); g.stroke();
    g.fillStyle = '#ffd23f'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * 20, cy + 8, 9, 6, s * 0.4, 0, TAU); g.fill(); }
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(cx - 12, cy + 44); g.lineTo(cx - 6, cy + 58); g.lineTo(cx, cy + 44); g.lineTo(cx + 6, cy + 58); g.lineTo(cx + 12, cy + 44); g.fill();
  } else if (role === 'voyante') {
    g.fillStyle = '#8fd8ff'; g.beginPath(); g.arc(cx, cy, 44, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(cx - 14, cy - 14, 12, 0, TAU); g.fill();
    g.fillStyle = '#7a4fd9'; g.beginPath(); g.ellipse(cx, cy + 50, 50, 12, 0, 0, TAU); g.fill(); g.stroke();
  } else if (role === 'sorciere') {
    for (const [x, col] of [[-30, '#3df5b0'], [30, '#ff4f6d']]) { g.fillStyle = col; g.beginPath(); g.arc(cx + x, cy + 14, 28, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#c9b8a0'; g.fillRect(cx + x - 8, cy - 30, 16, 20); g.strokeRect(cx + x - 8, cy - 30, 16, 20); }
  } else if (role === 'chasseur') {
    g.strokeStyle = '#8a5634'; g.lineWidth = 8; g.beginPath(); g.arc(cx - 20, cy, 50, -1.1, 1.1); g.stroke();
    g.strokeStyle = '#2a1830'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx + 3, cy - 45); g.lineTo(cx + 3, cy + 45); g.stroke();
    g.lineWidth = 5; g.beginPath(); g.moveTo(cx - 40, cy); g.lineTo(cx + 50, cy); g.stroke();
    g.fillStyle = '#ff9a3a'; g.beginPath(); g.moveTo(cx + 60, cy); g.lineTo(cx + 44, cy - 9); g.lineTo(cx + 44, cy + 9); g.fill();
  } else {
    g.fillStyle = '#e8c25a'; g.beginPath(); g.moveTo(cx - 50, cy + 50); g.lineTo(cx - 50, cy - 5); g.lineTo(cx, cy - 45); g.lineTo(cx + 50, cy - 5); g.lineTo(cx + 50, cy + 50); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#8a5634'; g.fillRect(cx - 12, cy + 15, 24, 35); g.strokeRect(cx - 12, cy + 15, 24, 35);
    g.fillStyle = '#ffe48a'; g.fillRect(cx + 20, cy + 5, 16, 14); g.strokeRect(cx + 20, cy + 5, 16, 14);
  }
}
// --- Animation et rendu
function renderWolf(dt) {
  if (!WS || !WG) return;
  const T = THREE, t = (WS.t += dt), cv = $('village');
  const w = cv.clientWidth || window.innerWidth, h = cv.clientHeight || window.innerHeight;
  if (WS.cam.aspect !== w / h) { WS.cam.aspect = w / h; WS.cam.updateProjectionMatrix(); }
  WS.fire.intensity = 2.3 + Math.sin(t * 13) * 0.25 + Math.sin(t * 7.1) * 0.2;
  WS.flames.forEach((f, i) => { const k = 1 + Math.sin(t * (9 + i * 2) + i) * 0.12; f.scale.set(k, 1 + Math.sin(t * 11 + i * 1.7) * 0.18, k); f.rotation.y = t * (0.5 + i); });
  for (const e of WS.embers) { const u = e.userData; u.t = (u.t + dt * 0.45) % 1; e.position.set(Math.cos(u.a + u.t * 3) * (u.r + u.t * 0.5), 0.8 + u.t * 3.4, Math.sin(u.a + u.t * 3) * (u.r + u.t * 0.5)); e.material.opacity = 1 - u.t; e.material.transparent = true; }
  for (const f of WS.flies) { const u = f.userData; u.a += dt * u.s; f.position.set(Math.cos(u.a) * u.r, u.h + Math.sin(t * 2 + u.r) * 0.3, Math.sin(u.a * 1.3) * u.r); f.visible = Math.sin(t * 3 + u.r * 5) > -0.3; }
  WS.nar.rotation.y = Math.sin(t * 0.5) * 0.2; WS.nar.position.y = WG.speaker === 'nar' ? Math.abs(Math.sin(t * 6)) * 0.05 : 0;
  WG.P.forEach((p, i) => { if (p.char && p.alive) { const u = p.char.userData; u.body.position.y = WG.speaker === i ? Math.abs(Math.sin(t * 9)) * 0.08 : Math.sin(t * 2 + i) * 0.01; u.body.rotation.x = WG.night && i !== 0 ? 0.35 : 0; } });
  const sway = Math.sin(t * 0.12) * 0.8;
  WS.cam.position.set(sway, 9.2, 10.4); WS.cam.lookAt(0, 0.2, -1.4);
  V.renderer.render(WS.scene, WS.cam);
  // bulles au-dessus des têtes
  const now = performance.now(), v = new T.Vector3();
  WG.bubbles = WG.bubbles.filter(b => { if (now > b.until) { b.el.remove(); return false; } return true; });
  for (const b of WG.bubbles) {
    const p = WG.P[b.i]; v.set(p.x, 3.5, p.z).project(WS.cam);
    b.el.style.left = ((v.x + 1) / 2 * w / UIZ) + 'px'; b.el.style.top = ((1 - v.y) / 2 * h / UIZ) + 'px';
  }
}

// ---------- Ma maison : intérieur meublé (salon + chambre), décoration, s'asseoir, dormir ; jour et nuit ----------
const HOME = { x: 0, z: 200 };   // l'intérieur est construit loin du village : on ne le voit pas depuis la place
const DECO_STYLES = {
  rustique:  { name: 'Rustique',  price: 0,   wood: '#9a6a3a', fabric: '#c9503a', accent: '#e8c25a', soft: '#f0e0c0', wall: '#f4e4c8', floor: '#b07a4a' },
  bouftou:   { name: 'Laineux',   price: 300, wood: '#e8dcc0', fabric: '#fffbe8', accent: '#3b5ea8', soft: '#d8e4ff', wall: '#e8f0ff', floor: '#d8c8a0', wool: true },
  champetre: { name: 'Champêtre', price: 450, wood: '#7a9a4a', fabric: '#ff8fb0', accent: '#ffffff', soft: '#e8f8c8', wall: '#e8f8d8', floor: '#a8c070', flowers: true },
  royal:     { name: 'Royal',     price: 600, wood: '#5a2a6a', fabric: '#7a4fd9', accent: '#ffd23f', soft: '#c9a0ff', wall: '#e0d0f4', floor: '#6a3a5a', gold: true },
  dragon:    { name: 'Dragon',    price: 900, wood: '#3a2424', fabric: '#8e2121', accent: '#ffc83d', soft: '#ffb0a0', wall: '#6a3a3a', floor: '#3a2a2a', gold: true },
};
const DECO_SLOTS = [['bed', 'Lit'], ['sofa', 'Canapé'], ['table', 'Table'], ['chairs', 'Chaises'], ['rug', 'Tapis'], ['wardrobe', 'Armoire'], ['lamp', 'Lampe'], ['plant', 'Plante'], ['painting', 'Tableau'], ['walls', 'Murs et sol']];
const homeStyle = slot => DECO_STYLES[(visitingVillage?.home || save.home || {})[slot]] || DECO_STYLES.rustique;
// Emplacements fixes (coordonnées dans la maison : x de −7 à 7, z de −5 au fond à 5 devant)
const HOME_SPOTS = {
  bed: [4.6, -3.15, 0], sofa: [-3.2, -4.1, 0], table: [-3.5, 0.6, 0], rug: [-3.4, 0.6, 0], wardrobe: [6.45, 1.8, -Math.PI / 2],
  lamp: [6.35, -4.35, 0], plant: [-6.35, -4.4, 0], painting: [-3.2, -4.92, 0],
};
// Ce qu'on peut faire dans la maison (point d'action, rayon)
const HOME_ACTS = [
  { id: 'tessa', x: -0.6, z: 2.8, r: 2.1, name: 'Tessa', desc: 'Ton gobelin a toujours quelque chose à raconter.' },
  { id: 'door', x: -4, z: 4.3, r: 1.4, name: 'Porte', desc: 'Retourner dans le village.' },
  { id: 'deco', x: -5.5, z: 3.4, r: 1.3, name: 'Catalogue de décoration', desc: 'Change le style de chaque meuble de ta maison.' },
  { id: 'bed', x: 3.3, z: -2.5, r: 1.5, name: 'Lit', desc: 'Faire une sieste… au réveil, le jour ou la nuit sera tombé(e).' },
  { id: 'chairL', x: -4.85, z: 0.6, r: 1.1, name: 'Chaise', desc: 'S’asseoir un moment.', seat: [-4.85, 0.6, Math.PI / 2, 0.5] },
  { id: 'chairR', x: -2.15, z: 0.6, r: 1.1, name: 'Chaise', desc: 'S’asseoir un moment.', seat: [-2.15, 0.6, -Math.PI / 2, 0.5] },
  { id: 'sofa', x: -3.2, z: -3.2, r: 1.6, name: 'Canapé', desc: 'S’installer confortablement.', seat: [-3.2, -3.85, 0, 0.5] },
];
const HOME_COLL = [ [4.6, -3.9, 1.0], [4.6, -2.6, 1.0], [-3.5, 0.6, 0.75], [-4.85, 0.6, 0.3], [-2.15, 0.6, 0.3], [-3.9, -4.1, 0.6], [-2.5, -4.1, 0.6],
  [6.45, 1.4, 0.6], [6.45, 2.2, 0.6], [-6.35, -4.4, 0.45], [6.35, -4.35, 0.3], [-6.2, 3.5, 0.4]];

function furniture(slot) {
  const T = THREE, st = homeStyle(slot), g = new T.Group();
  if (MODELS.interior && kitFurniture(slot, st, g)) return g;
  const knob = (x, y, z, p) => mk(new T.SphereGeometry(0.07, 8, 6), st.accent, x, y, z, p || g, st.gold ? { emissive: '#5a4200' } : undefined);
  const puff = (x, y, z, r) => mk(new T.SphereGeometry(r, 10, 8), '#fffbe8', x, y, z, g);
  const flower = (x, y, z) => { mk(new T.SphereGeometry(0.08, 8, 6), st.fabric, x, y, z, g); mk(new T.SphereGeometry(0.035, 6, 5), '#ffd23f', x, y + 0.02, z + 0.06, g); };
  if (slot === 'bed') {
    mk(BX(2.0, 0.42, 2.9), WOOD(2, 0.4, st.wood), 0, 0.3, 0, g);
    mk(BX(2.0, 1.4, 0.16), WOOD(2, 1.4, st.wood), 0, 0.8, -1.45, g);
    mk(BX(2.0, 0.7, 0.14), WOOD(2, 0.7, st.wood), 0, 0.55, 1.45, g);
    mk(BX(1.86, 0.24, 2.7), st.soft, 0, 0.62, 0, g);
    mk(BX(1.92, 0.14, 1.75), st.fabric, 0, 0.76, 0.42, g);
    mk(BX(1.92, 0.05, 0.3), st.accent, 0, 0.84, -0.42, g);
    mk(BX(0.8, 0.2, 0.42), '#ffffff', -0.45, 0.82, -1.05, g); mk(BX(0.8, 0.2, 0.42), '#ffffff', 0.45, 0.82, -1.05, g);
    for (const x of [-0.95, 0.95]) knob(x, 1.55, -1.45);
    if (st.wool) for (let i = 0; i < 5; i++) puff(-0.8 + i * 0.4, 1.5, -1.45, 0.2);
    if (st.flowers) for (let i = 0; i < 6; i++) flower(-0.8 + i * 0.32, 1.35, -1.36);
  } else if (slot === 'sofa') {
    mk(BX(2.6, 0.42, 0.95), st.fabric, 0, 0.3, 0, g);
    mk(BX(2.6, 0.8, 0.26), st.fabric, 0, 0.75, -0.36, g);
    for (const x of [-1.3, 1.3]) mk(BX(0.26, 0.6, 0.95), st.fabric, x, 0.45, 0, g);
    for (const x of [-0.62, 0.62]) mk(BX(1.15, 0.14, 0.78), st.soft, x, 0.56, 0.05, g);
    for (const x of [-1.15, 1.15]) for (const z of [-0.38, 0.38]) mk(BX(0.12, 0.12, 0.12), st.wood, x, 0.06, z, g);
    for (const x of [-1.3, 1.3]) knob(x, 0.78, 0.4);
    if (st.wool) for (let i = 0; i < 6; i++) puff(-1.05 + i * 0.42, 1.18, -0.36, 0.18);
    if (st.flowers) for (let i = 0; i < 5; i++) flower(-0.9 + i * 0.45, 1.1, -0.24);
  } else if (slot === 'table') {
    mk(new T.CylinderGeometry(0.85, 0.85, 0.1, 22), WOOD(2, 0.2, st.wood), 0, 0.8, 0, g);
    mk(new T.CylinderGeometry(0.1, 0.14, 0.75, 10), st.wood, 0, 0.4, 0, g);
    mk(new T.CylinderGeometry(0.42, 0.5, 0.06, 16), st.wood, 0, 0.03, 0, g);
    mk(new T.CylinderGeometry(0.9, 0.95, 0.06, 22), st.fabric, 0, 0.86, 0, g).scale.set(1, 1, 0.55);
    mk(new T.CylinderGeometry(0.1, 0.07, 0.3, 10), st.accent, 0.2, 1.04, 0, g);
    for (let i = 0; i < 3; i++) mk(new T.SphereGeometry(0.07, 8, 6), ['#ff5fa8', '#ffd23f', '#b46bff'][i], 0.2 + (i - 1) * 0.08, 1.24, (i % 2) * 0.05, g);
  } else if (slot === 'chairs') {
    for (const [x, rot] of [[-4.85 + 3.5, Math.PI / 2], [-2.15 + 3.5, -Math.PI / 2]]) {
      const c = new T.Group(); c.position.set(x, 0, 0); c.rotation.y = rot; g.add(c);
      mk(BX(0.62, 0.08, 0.6), WOOD(0.6, 0.6, st.wood), 0, 0.48, 0, c);
      mk(BX(0.62, 0.75, 0.08), WOOD(0.6, 0.8, st.wood), 0, 0.88, -0.27, c);
      mk(BX(0.54, 0.07, 0.52), st.fabric, 0, 0.55, 0.02, c);
      for (const [lx, lz] of [[-0.26, -0.24], [0.26, -0.24], [-0.26, 0.24], [0.26, 0.24]]) mk(BX(0.07, 0.46, 0.07), st.wood, lx, 0.23, lz, c);
      knob(-0.27, 1.27, -0.27, c); knob(0.27, 1.27, -0.27, c);
    }
  } else if (slot === 'rug') {
    const r = mk(new T.CylinderGeometry(2.3, 2.3, 0.02, 32), st.fabric, 0, 0.012, 0, g); r.scale.z = 0.72; r.castShadow = false;
    const r2 = mk(new T.CylinderGeometry(1.7, 1.7, 0.02, 32), st.soft, 0, 0.02, 0, g); r2.scale.z = 0.72; r2.castShadow = false;
    const r3 = mk(new T.TorusGeometry(2.0, 0.05, 6, 40), st.accent, 0, 0.03, 0, g); r3.rotation.x = Math.PI / 2; r3.scale.y = 0.72;
  } else if (slot === 'wardrobe') {
    mk(BX(1.7, 2.3, 0.85), WOOD(1.7, 2.3, st.wood), 0, 1.15, 0, g);
    mk(BX(1.8, 0.14, 0.95), st.wood, 0, 2.35, 0, g);
    for (const x of [-0.42, 0.42]) { mk(BX(0.76, 1.9, 0.04), WOOD(0.8, 1.9, tint(st.wood, 0.12)), x, 1.15, 0.44, g); knob(x * 0.25, 1.15, 0.48); }
    if (st.wool) for (let i = 0; i < 4; i++) puff(-0.6 + i * 0.4, 2.5, 0, 0.17);
    if (st.flowers) for (let i = 0; i < 4; i++) flower(-0.6 + i * 0.4, 2.47, 0.3);
  } else if (slot === 'lamp') {
    mk(new T.CylinderGeometry(0.28, 0.32, 0.08, 14), st.wood, 0, 0.04, 0, g);
    mk(new T.CylinderGeometry(0.04, 0.04, 1.7, 8), st.accent, 0, 0.9, 0, g);
    const shade = mk(new T.CylinderGeometry(0.22, 0.42, 0.45, 16, 1, true), st.fabric, 0, 1.8, 0, g, { side: THREE.DoubleSide, emissive: tint(st.fabric, -0.4) });
    shade.castShadow = false;
    mk(new T.SphereGeometry(0.12, 10, 8), '#fff4c0', 0, 1.7, 0, g, { emissive: '#ffd27a' });
  } else if (slot === 'plant') {
    mk(new T.CylinderGeometry(0.32, 0.24, 0.5, 14), st.accent === '#ffffff' ? '#e8907a' : st.accent, 0, 0.25, 0, g);
    mk(new T.CylinderGeometry(0.3, 0.3, 0.04, 14), '#5a3a26', 0, 0.48, 0, g);
    for (const [x, y, z, r] of [[0, 0.95, 0, 0.36], [0.22, 0.78, 0.1, 0.26], [-0.2, 0.8, -0.05, 0.26], [0.05, 1.25, 0.05, 0.24]]) mk(new T.SphereGeometry(r, 12, 9), st.flowers ? '#5fbf4a' : '#4cae3f', x, y, z, g);
    if (st.flowers || st.gold) for (let i = 0; i < 6; i++) { const a = i * 1.1; mk(new T.SphereGeometry(0.07, 8, 6), st.flowers ? st.fabric : st.accent, Math.cos(a) * 0.3, 0.95 + (i % 3) * 0.15, Math.sin(a) * 0.3, g); }
  } else if (slot === 'painting') {
    const c = document.createElement('canvas'); c.width = 192; c.height = 128; const p = c.getContext('2d');
    const sky = p.createLinearGradient(0, 0, 0, 128); sky.addColorStop(0, st.soft); sky.addColorStop(1, '#ffffff'); p.fillStyle = sky; p.fillRect(0, 0, 192, 128);
    p.fillStyle = st.accent; p.beginPath(); p.arc(150, 34, 16, 0, TAU); p.fill();
    p.fillStyle = '#7cc644'; p.beginPath(); p.moveTo(0, 128); p.quadraticCurveTo(50, 60, 110, 100); p.quadraticCurveTo(150, 70, 192, 92); p.lineTo(192, 128); p.closePath(); p.fill();
    p.fillStyle = '#4f9f3a'; p.beginPath(); p.moveTo(0, 128); p.quadraticCurveTo(80, 88, 192, 118); p.lineTo(192, 128); p.closePath(); p.fill();
    p.fillStyle = st.wool ? '#fffbe8' : st.fabric; p.beginPath(); p.arc(60, 100, 9, 0, TAU); p.arc(70, 96, 8, 0, TAU); p.fill();
    mk(BX(1.75, 1.2, 0.08), st.gold ? mat(st.accent, { emissive: '#4a3a00' }) : WOOD(1.7, 1.2, st.wood), 0, 2.1, 0, g);
    const pic = new T.Mesh(new T.PlaneGeometry(1.5, 0.98), new T.MeshToonMaterial({ map: new T.CanvasTexture(c), gradientMap: GRAD }));
    pic.position.set(0, 2.1, 0.05); g.add(pic);
  }
  return g;
}
function buildHomeShell() {
  const T = THREE, st = homeStyle('walls'), H = V.homeShell || (V.homeShell = new T.Group());
  H.clear(); V.homeWins = []; H.position.set(HOME.x, 0, HOME.z); if (!H.parent) V.scene.add(H);
  // sol, murs du fond (hauts), murs de devant (bas, pour voir dedans), cloison avec passage
  mk(BX(14.4, 0.2, 10.4), mat(st.floor, {tex:'floor',rep:[4,3]}), 0, -0.1, 0, H).castShadow = false;
  const wall = (w, h, x, z, ry) => { const m = mk(BX(w, h, 0.3), PLASTER(st.wall), x, h / 2, z, H); m.rotation.y = ry || 0; return m; };
  wall(14.4, 3.2, 0, -5.15); wall(10.6, 3.2, -7.15, 0, Math.PI / 2); wall(10.6, 3.2, 7.15, 0, Math.PI / 2);
  wall(8.8, 0.55, 2.5, 5.15); wall(1.9, 0.55, -6.2, 5.15);
  wall(5.2, 2.4, 1.15, -2.6, Math.PI / 2); wall(2.6, 2.4, 1.15, 3.85, Math.PI / 2);
  // plinthes et poutres
  mk(BX(14.4, 0.25, 0.08), st.wood || '#7a4a2a', 0, 0.12, -4.98, H);
  for (const x of [-4.5, 0, 4.5]) mk(BX(0.25, 3.2, 0.25), WOOD(0.3, 3.2, '#7a4a2a'), x, 1.6, -4.98, H);
  // fenêtres du fond (lumineuses la nuit)
  for (const x of [-0.3, 3]) { mk(BX(1.4, 1.1, 0.1), '#7a4a2a', x, 1.9, -4.97, H); V.homeWins.push(mk(BX(1.2, 0.9, 0.1), V.winMat, x, 1.9, -4.94, H)); }
  // seuil de porte, catalogue de décoration sur un pupitre
  mk(BX(1.6, 0.05, 0.6), '#7a4a2a', -4, 0.01, 4.85, H);
  const lec = new T.Group(); lec.position.set(-6.2, 0, 3.5); lec.rotation.y = 0.6; H.add(lec);
  mk(new T.CylinderGeometry(0.1, 0.16, 1.0, 8), '#7a4a2a', 0, 0.5, 0, lec);
  const top = mk(BX(0.7, 0.06, 0.5), '#7a4a2a', 0, 1.05, 0, lec); top.rotation.x = 0.4;
  const book = mk(BX(0.6, 0.06, 0.42), '#ff4fa3', 0, 1.1, 0.02, lec); book.rotation.x = 0.4;
  // sol sombre autour (comme une maison de poupée)
  const v = new T.Mesh(new T.PlaneGeometry(80, 80), new T.MeshBasicMaterial({ color: '#241a3a' })); v.rotation.x = -Math.PI / 2; v.position.y = -0.25; H.add(v);
  kitHomeDecor(H);
}
function buildHomeFurniture(slot) {
  V.homeFurn = V.homeFurn || {};
  if (V.homeFurn[slot]) V.homeFurn[slot].parent.remove(V.homeFurn[slot]);
  const sp = slot === 'chairs' ? [-3.5, 0.6, 0] : HOME_SPOTS[slot];
  const f = furniture(slot); f.position.set(HOME.x + sp[0], 0, HOME.z + sp[1]); f.rotation.y = sp[2];
  V.scene.add(f); V.homeFurn[slot] = f;
  if (slot === 'lamp') { const st = homeStyle('lamp'); V.homeLight.color.set(tint(st.fabric, 0.5)); }
}
function buildHome() {
  const T = THREE;
  V.homeWins = [];
  V.homeLight = new T.PointLight('#ffd9a0', 0.7, 16, 1.6); V.homeLight.position.set(HOME.x + 2, 3.4, HOME.z - 1); V.scene.add(V.homeLight);
  buildHomeShell();
  for (const [slot] of DECO_SLOTS) if (slot !== 'walls') buildHomeFurniture(slot);
}
// Le gobelin est un habitant paisible de la maison, également visible en visite.
function spawnHomeGoblin() {
  if (!V.ok || V.homeGoblin || !MODELS.goblin) return;
  const g = modelInst('goblin');
  g.name = 'Gobelin de la maison'; g.position.set(HOME.x - 0.6, 0, HOME.z + 2.8);
  const idle = Object.keys(g.userData.inst.acts).find(name => /(?:^|\|)Idle$/i.test(name));
  if (idle) g.userData.inst.play(idle);
  g.userData.roam={inside:true,index:1,wait:20,shout:6,line:0,moving:false};
  g.visible = V.inside === true; V.scene.add(g); V.homeGoblin = g;
}
const TESSA_SHOUTS=[
  'JE SUIS UN GOBELIN LIBRE, LIIIIIBRE !',
  'As-tu un plaid rose ?',
  'Je ne fugue pas. Je vérifie la qualité des chemins !',
  'LIBERTÉ ! BISCUITS ! ET UNE PETITE SIESTE !',
  'Qui a mis des maisons autour de MON jardin ?',
  'Je pars à l’aventure ! Enfin… jusqu’au prochain goûter.'
];
function tessaRoute(){
  const b=V.bld.maison,door={x:b.ix,z:b.iz,inside:false,wait:1};
  return [{x:HOME.x-.6,z:HOME.z+2.8,inside:true,wait:20},
    {x:HOME.x-4,z:HOME.z+3.4,inside:true,wait:0},door,
    {x:-8,z:-3.5,inside:false,wait:8},{x:-6,z:-1,inside:false,wait:10},
    {x:-7,z:-5,inside:false,wait:8},door,
    {x:HOME.x-4,z:HOME.z+3.4,inside:true,wait:0}];
}
function updateHomeGoblin(dt) {
  const g=V.homeGoblin;if(!g||!V.bld.maison)return;
  const r=g.userData.roam,route=tessaRoute();let moving=false;
  const chatting=npcTalk.active?.obj===g;
  if(!chatting&&!anyModalOpen()){
    if(r.wait>0)r.wait=Math.max(0,r.wait-dt);
    else {
      const target=route[r.index],dx=target.x-g.position.x,dz=target.z-g.position.z,d=Math.hypot(dx,dz);
      if(r.inside!==target.inside){r.inside=target.inside;g.position.set(target.x,0,target.z);}
      else if(d>.06){const step=Math.min(d,dt*1.15);g.position.x+=dx/d*step;g.position.z+=dz/d*step;g.rotation.y=Math.atan2(dx,dz);moving=true;}
      if(!moving){r.wait=target.wait;r.index=(r.index+1)%route.length;}
    }
  }
  g.visible=V.inside!=='bunker'&&(V.inside===true)===r.inside;
  if(moving!==r.moving){r.moving=moving;const clip=Object.keys(g.userData.inst.acts).find(n=>new RegExp('(?:^|\\|)'+(moving?'Walk':'Idle')+'$','i').test(n));if(clip)g.userData.inst.play(clip);}
  if(g.visible)g.userData.inst.mixer.update(dt);
  if(!r.inside&&g.visible&&save.npcTalk!==false&&!anyModalOpen()&&!npcTalk.active){
    r.shout-=dt;
    if(r.shout<=0&&Math.hypot(V.P.x-g.position.x,V.P.z-g.position.z)<10){sayNpc('tessa',g,'Tessa',TESSA_SHOUTS[r.line++%TESSA_SHOUTS.length]);r.shout=16;}
  }
}
// Entrer / sortir
function enterHome() {
  V.inside = true; V.pose = null; V.yawOut = V.yaw; V.yaw = 0;
  V.P.x = HOME.x - 4; V.P.z = HOME.z + 3.4; V.P.rot = Math.PI;
  placeHeroCam(true); snapPet(); V.near = null; renderPanel();
}
function exitHome() {
  const b = V.bld.maison; V.inside = false; V.pose = null; resetPose();
  V.P.x = b.ix; V.P.z = b.iz; V.P.rot = b.group.rotation.y; V.yaw = b.group.rotation.y;
  placeHeroCam(true); snapPet(); V.near = null; renderPanel();
}
function snapPet() { const g = V.pet3D; if (g) { g.position.x = V.P.x - 3.0; g.position.z = V.P.z; } }
function resetPose() { if (!V.hero) return; V.hero.position.y = 0; V.hero.rotation.x = 0; V.hero.rotation.order = 'XYZ'; }
// Mouvements et actions dans la maison
function updateHome(moving) {
  const P = V.P;
  let lx = P.x - HOME.x, lz = P.z - HOME.z;
  for (const [cx, cz, r] of HOME_COLL) { const dx = lx - cx, dz = lz - cz, d = Math.hypot(dx, dz), rr = r + 0.4; if (d < rr && d > 0.0001) { lx = cx + dx / d * rr; lz = cz + dz / d * rr; } }
  // cloison entre le salon et la chambre, avec un passage au milieu
  if (Math.abs(lx - 1.15) < 0.55 && !(lz > -0.05 && lz < 2.45)) lx = lx < 1.15 ? 0.6 : 1.7;
  lx = clamp(lx, -6.5, 6.5); lz = clamp(lz, -4.5, 4.6);
  P.x = HOME.x + lx; P.z = HOME.z + lz;
  let near = null, nd = 99;
  for (const a of HOME_ACTS) { if(a.id==='tessa'&&(!V.homeGoblin||!V.homeGoblin.userData.roam.inside))continue;const d = a.id==='tessa'?Math.hypot(P.x-V.homeGoblin.position.x,P.z-V.homeGoblin.position.z):Math.hypot(lx - a.x, lz - a.z); if (d < a.r && d < nd) { nd = d; near = a.id; } }
  return near;
}
function homeAction(act) {
  const a = HOME_ACTS.find(h => h.id === V.near);
  if (act === 'talkTessa') talkTessa();
  else if (act === 'exit') exitHome();
  else if (act === 'deco') openModal('decoM');
  else if (act === 'sit' && a && a.seat) {
    V.pose = { type: 'sit', x: HOME.x + a.seat[0], z: HOME.z + a.seat[1], rot: a.seat[2] };
    V.P.x = V.pose.x; V.P.z = V.pose.z; V.P.rot = V.pose.rot; renderPanel();
  } else if (act === 'stand') { V.pose = null; resetPose(); renderPanel(); }
  else if (act === 'sleep') sleepInBed();
}
// Se coucher : écran noir, « Zzz… », le jour devient la nuit (ou l'inverse), puis réveil à côté du lit
function sleepInBed() {
  if (V.sleeping) return;
  V.sleeping = true;
  V.pose = { type: 'sleep', x: HOME.x + 4.6, z: HOME.z - 1.75, rot: Math.PI };
  V.P.x = V.pose.x; V.P.z = V.pose.z; V.P.rot = Math.PI;
  $('vpanel').hidden = true;
  const f = $('fade'); f.hidden = false; f.textContent = '';
  requestAnimationFrame(() => f.classList.add('on'));
  setTimeout(() => { f.textContent = 'Zzz…'; }, 1100);
  setTimeout(() => {
    save.night = !save.night; persist(); applyNight();
    f.textContent = save.night ? 'La nuit est tombée' : 'Bonjour !';
  }, 2600);
  setTimeout(() => {
    V.pose = null; resetPose(); V.P.x = HOME.x + 3.3; V.P.z = HOME.z - 1.6; V.P.rot = Math.PI / 2;
    f.classList.remove('on'); V.sleeping = false; V.near = null; renderPanel();
    setTimeout(() => { f.hidden = true; }, 900);
  }, 3800);
}
function applyPose() {
  const h = V.hero, pz = V.pose; if (!pz) return;
  V.P.x = pz.x; V.P.z = pz.z; V.P.rot = pz.rot;
  h.position.set(pz.x, 0, pz.z);
  const u = h.userData;
  if (pz.type === 'sit') {
    h.rotation.order = 'XYZ'; h.rotation.x = 0; h.rotation.y = pz.rot; h.position.y = -0.3;
    u.legs.forEach(l => { l.rotation.x = -1.45; });
  } else {
    // allongé sur le dos, la tête vers l'oreiller
    h.rotation.order = 'YXZ'; h.rotation.y = 0; h.rotation.x = -Math.PI / 2; h.position.y = 0.92;
    u.legs.forEach(l => { l.rotation.x = 0; });
  }
}
// Panneau d'action dans la maison
function renderHomePanel() {
  const el = $('vpanel');
  $('vhint').hidden = true;
  if (V.sleeping) { el.hidden = true; return; }
  let a = HOME_ACTS.find(h => h.id === V.near);
  let html, btns = [];
  if (V.pose && V.pose.type === 'sit') { html = `<div class="vp-head"><h3>Assis</h3></div><p class="vp-desc">Bouge le pouce gauche ou touche « Se lever ».</p>`; btns.push(`<button class="btn" data-act="stand">Se lever</button>`); }
  else if (!a) { html = `<div class="vp-head"><h3>Ma maison</h3></div><p class="vp-desc">Approche-toi d’un meuble : chaises, canapé, lit… Le catalogue près de la porte sert à décorer.</p>`; }
  else {
    html = `<div class="vp-head"><h3>${a.name}</h3></div><p class="vp-desc">${a.desc}</p>`;
    if (a.id === 'tessa') btns.push(`<button class="btn big-ish" data-act="talkTessa">Parler à Tessa</button>`);
    if (a.id === 'door') btns.push(`<button class="btn big-ish" data-act="exit">Sortir</button>`);
    if (a.id === 'deco') btns.push(`<button class="btn big-ish" data-act="deco">Décorer</button>`);
    if (a.id === 'bed') btns.push(`<button class="btn big-ish" data-act="sleep">${save.night ? 'Dormir jusqu’au matin' : 'Faire une sieste jusqu’à la nuit'}</button>`);
    if (a.seat) btns.push(`<button class="btn big-ish" data-act="sit">S’asseoir</button>`);
  }
  html += `<div class="vp-btns">${btns.join('')}</div>`;
  if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
  el.hidden = false;
}
// Boutique de décoration : un style par emplacement
function renderDeco() {
  $('decoCoins').textContent = fmtCoins();
  $('decoList').innerHTML = DECO_SLOTS.map(([slot, title]) => `<section class="gsec"><h3>${title}</h3><div class="deco-row">` +
    Object.entries(DECO_STYLES).map(([sid, s]) => {
      const on = (save.home[slot] || 'rustique') === sid, owned = s.price === 0 || save.homeOwned[slot + ':' + sid];
      return `<button class="deco${on ? ' on' : ''}" data-deco="${slot}:${sid}" ${!owned && save.coins < s.price ? 'disabled' : ''}>
        <span class="sw3"><i style="background:${s.wood}"></i><i style="background:${s.fabric}"></i><i style="background:${s.accent}"></i></span>
        <span class="sn">${s.name}</span><span class="sp">${on ? 'Installé' : owned ? 'Installer' : '<i class="coin"></i>' + s.price}</span></button>`;
    }).join('') + '</div></section>').join('');
}
function buyDeco(slot, sid) {
  const s = DECO_STYLES[sid], key = slot + ':' + sid;
  if (s.price && !save.homeOwned[key]) { if (save.coins < s.price) return; save.coins -= s.price; save.homeOwned[key] = true; sfx('coin'); }
  save.home[slot] = sid; persist();
  if (slot === 'walls') { buildHomeShell(); applyNight(); } else buildHomeFurniture(slot);
  lightenVillage(); renderDeco(); updateVhud();
}
// Lampadaires du village (allumés la nuit) et ambiance de nuit
function buildLamps() {
  const T = THREE, spots = [];
  const dirs = Object.keys(POS).filter(id => id !== 'portail' && V.bld[id]).map(id => Math.atan2(V.bld[id].ix - PLAZA[0], V.bld[id].iz - PLAZA[1]));
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; if (dirs.every(d => Math.abs(Math.atan2(Math.sin(a - d), Math.cos(a - d))) > 0.3)) spots.push([PLAZA[0] + Math.sin(a) * 4.4, PLAZA[1] + Math.cos(a) * 4.4]); }
  spots.push([1.5, -8.5], [-1.5, -8.5]);
  if (V.bld.maison) { const b = V.bld.maison, a = b.group.rotation.y; spots.push([b.ix + Math.cos(a) * 1.6, b.iz - Math.sin(a) * 1.6]); }
  V.lampMat = new T.MeshToonMaterial({ color: '#fff2b0', gradientMap: GRAD });
  const halo = document.createElement('canvas'); halo.width = halo.height = 64; const hg = halo.getContext('2d');
  const gr = hg.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,220,140,.9)'); gr.addColorStop(0.4, 'rgba(255,190,90,.35)'); gr.addColorStop(1, 'rgba(255,190,90,0)');
  hg.fillStyle = gr; hg.fillRect(0, 0, 64, 64);
  const hmat = new T.SpriteMaterial({ map: new T.CanvasTexture(halo), transparent: true, blending: T.AdditiveBlending, depthWrite: false });
  V.halos = [];
  for (const [x, z] of spots) {
    const g = new T.Group(); g.position.set(x, 0, z); V.scene.add(g);
    mk(new T.CylinderGeometry(0.22, 0.28, 0.2, 10), '#3a3550', 0, 0.1, 0, g);
    mk(new T.CylinderGeometry(0.07, 0.09, 2.6, 8), '#3a3550', 0, 1.4, 0, g);
    mk(BX(0.42, 0.5, 0.42), '#3a3550', 0, 2.85, 0, g);
    mk(BX(0.34, 0.42, 0.34), V.lampMat, 0, 2.85, 0, g).castShadow = false;
    mk(new T.ConeGeometry(0.36, 0.3, 4), '#3a3550', 0, 3.25, 0, g).rotation.y = Math.PI / 4;
    const h = new T.Sprite(hmat); h.scale.set(2.6, 2.6, 1); h.position.set(x, 2.85, z); h.visible = false; V.scene.add(h); V.halos.push(h);
  }
  V.nightLights = [];
  for (const [x, z] of [[PLAZA[0] - 3, PLAZA[1] - 2], [PLAZA[0] + 3, PLAZA[1] + 2]]) { const l = new T.PointLight('#ffc070', 0, 16, 1.4); l.position.set(x, 3.2, z); V.scene.add(l); V.nightLights.push(l); }
}
function applyNight() {
  if (!V.ok || !V.sun) return;
  const n = visitingVillage ? visitingVillage.night : !!save.night;
  V.sun.intensity = n ? 0.22 : 0.85; V.sun.color.set(n ? '#9fb0ff' : '#fff0d0');
  V.hemi.intensity = n ? 0.3 : 0.55; V.hemi.color.set(n ? '#7a88d8' : '#fffaf0'); V.hemi.groundColor.set(n ? '#2a2a50' : '#6d8f3a');
  V.amb.intensity = n ? 0.1 : 0.12;
  V.scene.fog.color.set(n ? '#1c2048' : '#bfe9ff');
  $('village').style.background = n ? 'radial-gradient(1px 1px at 20% 15%,#fff,transparent),radial-gradient(1px 1px at 70% 8%,#fff,transparent),radial-gradient(1.5px 1.5px at 45% 22%,#fff,transparent),radial-gradient(1px 1px at 85% 30%,#fff,transparent),linear-gradient(180deg,#0e1235,#2a2f6a 70%)' : '';
  V.lampMat.emissive.set(n ? '#ffb040' : '#000000');
  V.winMat.emissive.set(n ? '#ffb040' : '#8a5a00');
  V.halos.forEach(h => { h.visible = n; });
  V.nightLights.forEach(l => { l.intensity = n ? 1.1 : 0; });
  if (V.homeLight) V.homeLight.intensity = n ? 1.1 : 0.6;
}

function buildBuilding(id) {
  const T = THREE, old = V.bld[id];
  if (old) V.scene.remove(old.group);
  if (old && old.flagList) V.flags = (V.flags || []).filter(f => !old.flagList.includes(f));
  const flagsBefore = (V.flags || []).length;
  const g = new T.Group(), l = lvl(id), s = 1 + 0.07 * (Math.min(l, 5) - 1);
  const [x, z] = POS[id];
  g.position.set(x, 0, z);
  g.rotation.y = id === 'portail' ? Math.PI : Math.atan2(PLAZA[0] - x, PLAZA[1] - z);
  let top = 4, size = 4;
  if (MED[id] && MODELS.medieval) { const r = medBuilding(g, id, l); top = r.top; size = r.size; }
  else if (id === 'hdv') {
    const w = 6.2 * s, d = 5.0 * s; size = w;
    const roofCol = l >= 5 ? '#7a4fd9' : l >= 4 ? '#3d6fd9' : '#d9472f';
    top = house(g, w, d, 2.8 * s, { wall: '#fbeed2', wallTex: l >= 4 ? 'stone' : 'plaster', roof: roofCol, roofH: 2.3 * s, shutter: '#d9472f' });
    // Donjon central à l'arrière
    const tw = 2.4 * s, th = 5.6 * s;
    const keep = new T.Group(); keep.position.set(0, 0, -d * 0.18); g.add(keep);
    mk(BX(tw, th, tw), STONE(tw, th), 0, th / 2, 0, keep);
    for (let i = 0; i < 4; i++) for (let k = -1; k <= 1; k += 2) {
      const a = i * Math.PI / 2, mx = Math.sin(a) * (tw / 2) + Math.cos(a) * k * tw * 0.3, mz = Math.cos(a) * (tw / 2) - Math.sin(a) * k * tw * 0.3;
      mk(BX(0.45, 0.5, 0.45), STONE(0.5, 0.5), mx, th + 0.25, mz, keep);
    }
    pyramidRoof(keep, tw * 0.95, 2.0 * s, roofCol, th + 0.1);
    mk(new T.CylinderGeometry(0.55, 0.55, 0.12, 20), '#ffd23f', 0, th * 0.72, tw / 2 + 0.02, keep, { emissive: '#4a3a00' }).rotation.x = Math.PI / 2;
    flag(keep, 0, th + 2.0 * s, 0, '#ff4fa3', 1.8);
    top = Math.max(top, th + 2 * s + 1.6);
    if (l >= 2) { mk(BX(0.7, 1.6, 0.7), STONE(0.7, 1.6), w * 0.3, 0.55 + 2.8 * s + 0.9, -d * 0.1, g); }
    if (l >= 3) for (const sx of [-1, 1]) {
      const tg = new T.Group(); tg.position.set(sx * (w / 2 + 0.5), 0, d / 2 - 0.6); g.add(tg);
      mk(new T.CylinderGeometry(0.85, 0.95, 4.2 * s, 12), STONE(5, 4.2 * s), 0, 2.1 * s, 0, tg);
      mk(new T.ConeGeometry(1.15, 1.8, 12), mat(roofCol, { tex: 'tiles', rep: [4, 1.5] }), 0, 4.2 * s + 0.9, 0, tg);
    }
    if (l >= 4) for (const sx of [-1, 1]) mk(BX(0.7, 1.5, 0.06), '#ffd23f', sx * 1.5, 0.55 + 2 * s, d / 2 + 0.07, g);
    if (l >= 5) { mk(new T.SphereGeometry(0.7, 16, 10), '#ffd23f', 0, 0.55 + 2.8 * s + 2.3 * s + 0.4, 0, g, { emissive: '#5a4200' }); }
  } else if (id === 'maison') {
    // Ta maison : petite chaumière rose avec cheminée, jardinières et lanterne
    const w = 4.4, d = 3.4; size = w;
    top = house(g, w, d, 2.3, { wall: '#ffe0e8', roof: '#3d8bd9', roofH: 1.9, shutter: '#ff7fa8' });
    mk(BX(0.6, 1.6, 0.6), STONE(0.6, 1.6), w * 0.28, 0.55 + 2.3 + 1.4, -d * 0.15, g);
    for (const sx of [-1, 1]) { mk(BX(0.9, 0.22, 0.3), '#8a5634', sx * w * 0.3, 0.55 + 2.3 * 0.58 - 0.5, d / 2 + 0.2, g); for (let i = 0; i < 4; i++) mk(new T.SphereGeometry(0.09, 6, 5), ['#ff5fa8', '#ffd23f', '#ffffff', '#b46bff'][i], sx * w * 0.3 - 0.33 + i * 0.22, 0.55 + 2.3 * 0.58 - 0.33, d / 2 + 0.22, g); }
    mk(BX(0.5, 0.06, 0.3), '#ffd23f', 0, 0.55 + 1.75, d / 2 + 0.3, g);
  } else if (id === 'portail') {
    // La fontaine de la place sert de portail : tourbillon violet dans l'eau, orbes qui tournent, colonne de lumière
    size = 4;
    const sc = document.createElement('canvas'); sc.width = sc.height = 256; const sg = sc.getContext('2d');
    for (let arm = 0; arm < 4; arm++) { sg.strokeStyle = arm % 2 ? 'rgba(255,143,208,.9)' : 'rgba(180,107,255,.95)'; sg.lineWidth = 14; sg.lineCap = 'round'; sg.beginPath(); for (let i = 0; i <= 40; i++) { const u = i / 40, a = arm * Math.PI / 2 + u * Math.PI * 1.6, r = 10 + u * 112; sg[i ? 'lineTo' : 'moveTo'](128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } sg.stroke(); }
    const glow = sg.createRadialGradient(128, 128, 0, 128, 128, 128); glow.addColorStop(0, 'rgba(255,220,255,.9)'); glow.addColorStop(0.35, 'rgba(180,107,255,.35)'); glow.addColorStop(1, 'rgba(180,107,255,0)');
    sg.fillStyle = glow; sg.fillRect(0, 0, 256, 256);
    const disc = new T.Mesh(new T.CircleGeometry(1.34, 32), new T.MeshBasicMaterial({ map: new T.CanvasTexture(sc), transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.735; g.add(disc);
    const inner = new T.Mesh(new T.CylinderGeometry(0.5, 1.1, 3.2, 24, 1, true), new T.MeshBasicMaterial({ color: '#d9a0ff', transparent: true, opacity: 0.25, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    inner.position.y = 2.3; g.add(inner);
    const ring = new T.Group(); ring.position.y = 1.15; g.add(ring);
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; mk(new T.SphereGeometry(0.11, 10, 8), i % 2 ? '#ff8fd0' : '#b46bff', Math.cos(a) * 1.95, Math.sin(i * 1.7) * 0.15, Math.sin(a) * 1.95, ring, { emissive: i % 2 ? '#a0306a' : '#5a2a9a' }).userData.noOutline = true; }
    V.portal = { disc, inner, ring };
    top = 3.6;
  } else if (id === 'mine') {
    size = 5;
    mk(new T.CylinderGeometry(2.4 * s, 2.6 * s, 0.6, 12), STONE(8, 0.6), 0, 0.3, 0, g);
    mk(new T.CylinderGeometry(1.5 * s, 1.5 * s, 0.1, 16), '#2a1f1a', 0, 0.62, 0, g);
    const hgt = 4.2 * s;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = mk(BX(0.32, hgt, 0.32), WOOD(0.3, hgt), sx * 1.5 * s, hgt / 2 + 0.5, sz * 1.5 * s, g); p.rotation.z = -sx * 0.1; p.rotation.x = sz * 0.1; }
    for (const y of [1.6, 3.2]) for (const sz of [-1, 1]) mk(BX(3.2 * s, 0.2, 0.2), '#7a4a2a', 0, y * s + 0.5, sz * 1.42 * s, g);
    mk(BX(2.6 * s, 0.3, 2.6 * s), WOOD(2.6, 0.3), 0, hgt + 0.55, 0, g);
    pyramidRoof(g, 2.1 * s, 1.3, '#d9472f', hgt + 0.7);
    const wheel = new T.Group(); wheel.position.set(1.75 * s, 2.6 * s, 0); g.add(wheel);
    mk(new T.TorusGeometry(1.0 * s, 0.1, 6, 20), '#7a4a2a', 0, 0, 0, wheel).rotation.y = Math.PI / 2;
    for (let i = 0; i < 4; i++) { const sp = mk(BX(0.1, 2 * s, 0.1), '#8a5634', 0, 0, 0, wheel); sp.rotation.x = i * Math.PI / 4; }
    V.wheel = wheel;
    mk(new T.CylinderGeometry(0.25, 0.2, 0.4, 8), WOOD(1, 0.4), 0, 2.0 * s, 0, g);
    mk(new T.CylinderGeometry(0.02, 0.02, hgt - 2.2 * s, 4), '#3a3550', 0, (hgt + 2.2 * s) / 2 + 0.4, 0, g);
    for (const sx of [-1, 1]) mk(BX(0.1, 0.06, 4), '#5a5470', sx * 0.45, 0.05, 3.6, g);
    const cart = new T.Group(); cart.position.set(0, 0, 3.6); g.add(cart);
    mk(BX(1.2, 0.7, 1.0), WOOD(1.2, 0.7, '#8a5634'), 0, 0.55, 0, cart);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mk(new T.CylinderGeometry(0.18, 0.18, 0.1, 10), '#3a3550', sx * 0.62, 0.2, sz * 0.35, cart).rotation.z = Math.PI / 2;
    for (let i = 0; i < 2 + l; i++) mk(new T.DodecahedronGeometry(0.26, 0), '#ffd23f', rnd(-0.4, 0.4), 0.95 + (i > 3 ? 0.18 : 0), rnd(-0.25, 0.25), cart, { emissive: '#5a4200' });
    for (let i = 0; i < l + 1; i++) mk(new T.DodecahedronGeometry(0.34, 0), '#ffd23f', -2.6 + rnd(-0.5, 0.5), 0.25, 1.6 + rnd(-0.7, 0.7), g, { emissive: '#5a4200' });
    top = hgt + 2.4;
  } else if (id === 'armurerie') {
    const w = 4.6 * s, d = 3.8 * s; size = w;
    top = house(g, w, d, 2.5 * s, { wall: '#d9d3e6', wallTex: 'stone', roof: '#d9472f', roofH: 1.8 * s, shutter: '#3a3550' });
    const sh = mk(new T.CylinderGeometry(0.55, 0.55, 0.12, 16), '#3d6fd9', 0, 0.55 + 2.0 * s, d / 2 + 0.08, g); sh.rotation.x = Math.PI / 2;
    for (const r of [-0.75, 0.75]) { const sw = mk(BX(0.12, 1.5, 0.06), '#e8ecff', 0, 0.55 + 2.0 * s, d / 2 + 0.16, g); sw.rotation.z = r; }
    const c = new T.Group(); c.position.set(w / 2 + 1.1, 0, d / 2 + 0.6); c.rotation.y = 0.4; g.add(c);
    mk(BX(0.9, 0.4, 1.1), WOOD(0.9, 0.4), 0, 0.4, 0, c);
    const b = mk(new T.CylinderGeometry(0.22, 0.3, 1.3, 12), '#3a3550', 0, 0.8, 0.3, c); b.rotation.x = Math.PI / 2.3;
    if (l >= 3) { mk(BX(1.0, 0.5, 0.6), WOOD(1, 0.5, '#8a5634'), -w / 2 - 0.9, 0.25, d / 2, g); for (let i = 0; i < 3; i++) mk(new T.SphereGeometry(0.18, 8, 6), '#3a3550', -w / 2 - 1.2 + i * 0.3, 0.62, d / 2, g); }
    if (l >= 5) mk(BX(w + 0.4, 0.2, d + 0.4), '#ffd23f', 0, 0.56, 0, g, { emissive: '#4a3a00' });
  } else if (id === 'infirmerie') {
    const w = 4.6 * s, d = 3.8 * s; size = w;
    top = house(g, w, d, 2.5 * s, { wall: '#ffffff', roof: '#3fbf8f', roofH: 1.8 * s, shutter: '#3fbf8f' });
    mk(BX(1.0, 0.3, 0.08), '#ff4f6d', 0, 0.55 + 2.05 * s, d / 2 + 0.08, g);
    mk(BX(0.3, 1.0, 0.08), '#ff4f6d', 0, 0.55 + 2.05 * s, d / 2 + 0.08, g);
    for (const sx of [-1, 1]) {
      mk(BX(1.2, 0.35, 0.6), WOOD(1.2, 0.35), sx * (w / 2 - 0.5), 0.17, d / 2 + 1.2, g);
      for (let i = 0; i < 3; i++) mk(new T.SphereGeometry(0.18, 8, 6), i % 2 ? '#7ddc4a' : '#ff8fd0', sx * (w / 2 - 0.5) - 0.4 + i * 0.4, 0.45, d / 2 + 1.2, g);
    }
    if (l >= 3) { const wing = new T.Group(); wing.position.set(-w / 2 - 1.2, 0, -0.4); wing.rotation.y = Math.PI / 2; g.add(wing); house(wing, 2.8, 2.2, 1.8, { wall: '#ffffff', roof: '#3fbf8f', roofH: 1.2, shutter: '#3fbf8f' }); }
    if (l >= 5) mk(new T.TorusGeometry(0.45, 0.1, 6, 16), '#ffd23f', 0, top + 0.2, 0, g, { emissive: '#4a3a00' });
  } else if (id === 'forge') {
    const w = 4.6 * s, d = 3.8 * s; size = w;
    top = house(g, w, d, 2.3 * s, { wall: '#b3abc8', wallTex: 'stone', roof: '#4a4560', roofH: 1.7 * s, shutter: '#ff8a1f' });
    const ch = 3.4 * s;
    mk(BX(1.0, ch, 1.0), STONE(1, ch, '#a59cc0'), w * 0.3, 0.55 + 2.3 * s + ch / 2 - 0.4, -d * 0.2, g);
    mk(BX(1.15, 0.2, 1.15), '#ff8a1f', w * 0.3, 0.55 + 2.3 * s + ch - 0.3, -d * 0.2, g, { emissive: '#a03a00' });
    V.smokeAt = { id, lx: w * 0.3, ly: 0.55 + 2.3 * s + ch - 0.1, lz: -d * 0.2 };
    mk(BX(0.8, 0.45, 0.45), '#3a3550', -w / 2 + 0.1, 0.62, d / 2 + 1.1, g);
    mk(new T.CylinderGeometry(0.28, 0.36, 0.4, 8), WOOD(1, 0.4), -w / 2 + 0.1, 0.2, d / 2 + 1.1, g);
    mk(new T.CylinderGeometry(0.7, 0.85, 0.5, 10), STONE(3, 0.5), w / 2 + 0.6, 0.25, d / 2 + 0.6, g);
    V.forgeFire = mk(new T.SphereGeometry(0.5, 8, 6), mat('#ff8a1f', { emissive: '#e05a00' }), w / 2 + 0.6, 0.55, d / 2 + 0.6, g);
    V.forgeFire.castShadow = false;
    if (l >= 4) mk(BX(w + 0.2, 0.2, d + 0.2), '#ff8a1f', 0, 0.56, 0, g, { emissive: '#702a00' });
  } else if (id === 'labo') {
    size = 4.4 * s;
    mk(new T.CylinderGeometry(2.3 * s, 2.45 * s, 0.6, 16), STONE(8, 0.6), 0, 0.3, 0, g);
    mk(new T.CylinderGeometry(2 * s, 2 * s, 2.2 * s, 16), STONE(7, 2.2 * s, '#e8e2f5'), 0, 0.6 + 1.1 * s, 0, g);
    mk(new T.CylinderGeometry(2.1 * s, 2.1 * s, 0.2, 16), '#ffd23f', 0, 0.6 + 2.2 * s, 0, g);
    mk(new T.SphereGeometry(2.0 * s, 20, 12, 0, TAU, 0, Math.PI / 2), mat('#b46bff', { transparent: true, opacity: 0.8 }), 0, 0.7 + 2.2 * s, 0, g);
    mk(BX(1.1, 1.6, 0.14), WOOD(1, 1.6, '#5a4a7a'), 0, 1.4, 2 * s - 0.02, g);
    // Cuve d'élixir rose
    const tank = new T.Group(); tank.position.set(2.6 * s, 0, 0.6); g.add(tank);
    mk(new T.CylinderGeometry(0.75, 0.8, 0.3, 12), STONE(2, 0.3), 0, 0.15, 0, tank);
    mk(new T.CylinderGeometry(0.62, 0.62, 2.0, 14), mat('#e8f6ff', { transparent: true, opacity: 0.45 }), 0, 1.3, 0, tank);
    V.elixir = mk(new T.CylinderGeometry(0.55, 0.55, 1.5, 14), mat('#ff4fd8', { emissive: '#7a0a60' }), 0, 1.05, 0, tank);
    mk(new T.CylinderGeometry(0.7, 0.7, 0.18, 14), '#ffd23f', 0, 2.35, 0, tank);
    mk(new T.CylinderGeometry(0.05, 0.05, 1.6, 6), '#5a5470', 0, 0.7 + 4.0 * s, 0, g);
    mk(new T.SphereGeometry(0.2, 8, 6), '#ff4fa3', 0, 0.7 + 4.8 * s, 0, g, { emissive: '#901050' });
    const cols = ['#3df5b0', '#ff4fa3', '#ffd23f'];
    V.flasks = [];
    for (let i = 0; i < 2 + Math.min(l, 3); i++) {
      const a = 2.2 + i * 0.45, fx = Math.sin(a) * 2.7 * s, fz = Math.cos(a) * 2.7 * s;
      V.flasks.push(mk(new T.SphereGeometry(0.28, 10, 8), cols[i % 3], fx, 0.3, fz, g, { emissive: '#303030' }));
    }
    top = 0.7 + 5.2 * s;
  } else if (id === 'caserne') {
    const w = 5.0 * s, d = 3.9 * s; size = w;
    top = house(g, w, d, 2.4 * s, { wall: '#c98a50', wallTex: 'wood', roof: '#d9472f', roofH: 1.9 * s, shutter: '#ff8a1f' });
    for (const r of [-0.7, 0.7]) { const sw = mk(BX(0.14, 1.5, 0.06), '#e8ecff', 0, 0.55 + 2.0 * s, d / 2 + 0.1, g); sw.rotation.z = r; }
    flag(g, -w / 2 - 0.5, 0, d / 2 + 0.5, '#ff8a1f', 3);
    flag(g, w / 2 + 0.5, 0, d / 2 + 0.5, '#3d8bd9', 3);
    const dm = new T.Group(); dm.position.set(-w / 2 - 1.3, 0, d / 2 + 1.7); g.add(dm);
    mk(new T.CylinderGeometry(0.08, 0.08, 1.2, 6), '#7a4a2a', 0, 0.6, 0, dm);
    mk(new T.CylinderGeometry(0.33, 0.33, 0.8, 10), mat('#e8c25a', { tex: 'thatch', rep: [1, 1] }), 0, 1.5, 0, dm);
    mk(new T.SphereGeometry(0.27, 10, 8), mat('#e8c25a', { tex: 'thatch', rep: [1, 1] }), 0, 2.1, 0, dm);
    mk(BX(1.2, 0.1, 0.1), '#7a4a2a', 0, 1.65, 0, dm);
    if (l >= 3) for (const sx of [-1, 1]) {
      const tent = mk(new T.ConeGeometry(1.1, 1.7, 4), mat(sx < 0 ? '#f2e3c2' : '#e7d2a8', { tex: 'plaster', rep: [1, 1] }), sx * (w / 2 + 1.7), 0.85, -1.3, g);
      tent.rotation.y = Math.PI / 4;
    }
  } else if (id === 'garde') {
    const w = 4.2, d = 3.4; size = w;
    top = house(g, w, d, 2.3, { wall: '#f6dcf0', roof: '#e8c25a', roofTex: 'thatch', roofH: 1.8, shutter: '#ff4fa3' });
    for (let i = 0; i < 6; i++) { const aw = mk(BX(w / 6, 0.08, 1.0), i % 2 ? '#ffffff' : '#ff4fa3', -w / 2 + w / 12 + i * w / 6, 0.55 + 2.0, d / 2 + 0.5, g); aw.rotation.x = 0.35; }
    const hang = mk(new T.TorusGeometry(0.3, 0.06, 6, 16, Math.PI), '#ffd23f', 0, 0.55 + 2.45, d / 2 + 0.06, g);
    mk(BX(0.8, 0.07, 0.07), '#ffd23f', 0, 0.55 + 2.2, d / 2 + 0.06, g);
    const stand = new T.Group(); stand.position.set(w / 2 + 1.2, 0, d / 2 + 0.4); g.add(stand);
    mk(new T.CylinderGeometry(0.6, 0.7, 0.25, 14), '#ff4fa3', 0, 0.12, 0, stand);
    const man = buildHero3D(save.skin, CLASSES[save.cls].color); man.position.y = 0.25; man.rotation.y = -0.4; stand.add(man); (V.farHide || (V.farHide = [])).push(man);
  }
  V.scene.add(g);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(document.createElement('canvas')), depthTest: false, transparent: true, sizeAttenuation: false }));
  const signAngle = g.rotation.y, signOffset = BUILD[id].collide * 0.85;
  label.position.set(x + Math.sin(signAngle) * signOffset, Math.min(2.8, top - 0.4), z + Math.cos(signAngle) * signOffset); label.scale.set(0.19, 0.06, 1); label.renderOrder = 10;
  V.scene.add(label);
  if (old && old.label) V.scene.remove(old.label);
  if (old && old.scaffold) V.scene.remove(old.scaffold);
  if (old && old.bubble) V.scene.remove(old.bubble);
  if (l >= 10 && BUILD[id].max > 1) flag(g, BUILD[id].collide * 0.55, top - 0.6, 0, '#ffd23f', 1.4);
  if (l >= 15 && BUILD[id].max > 1) mk(new T.OctahedronGeometry(0.4, 0), '#ffd23f', -BUILD[id].collide * 0.55, top - 0.2, 0, g, { emissive: '#8a6a00' });
  const ang = g.rotation.y, R = BUILD[id].collide;
  V.bld[id] = { group: g, label, top, size, ix: x + Math.sin(ang) * (R + 1.2), iz: z + Math.cos(ang) * (R + 1.2), labelKey: '', flagList: (V.flags || []).slice(flagsBefore) };
  if (id === 'mine') {
    const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(document.createElement('canvas')), depthTest: false, transparent: true }));
    bubble.material.sizeAttenuation = false; bubble.scale.set(0.085, 0.085, 1); bubble.renderOrder = 11; bubble.position.copy(label.position); bubble.position.y += 1.5; V.scene.add(bubble);
    V.bld.mine.bubble = bubble; V.bld.mine.bubbleKey = '';
  }
  V.colliders = V.colliders.filter(c => c.b !== id);
  V.colliders.push({ x, z, r: R, b: id });
  refreshScaffold(id);
  refreshLabel(id);
}
function refreshScaffold(id) {
  const b = V.bld[id], T = THREE;
  const on = !visitingVillage && save.build && save.build.id === id;
  if (!on && b.scaffold) { V.scene.remove(b.scaffold); b.scaffold = null; }
  if (on && !b.scaffold) {
    const sc = new T.Group(), half = b.size / 2 + 0.5, h = Math.min(b.top, 6);
    sc.position.copy(b.group.position); sc.rotation.y = b.group.rotation.y;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mk(new T.CylinderGeometry(0.08, 0.08, h, 6), '#ffd23f', sx * half, h / 2, sz * half, sc);
    for (const y of [h * 0.4, h * 0.8]) for (const sz of [-1, 1]) mk(BX(half * 2, 0.12, 0.12), '#ff8a1f', 0, y, sz * half, sc);
    for (const y of [h * 0.4, h * 0.8]) for (const sx of [-1, 1]) mk(BX(0.12, 0.12, half * 2), '#ff8a1f', sx * half, y, 0, sc);
    V.scene.add(sc); b.scaffold = sc;
  }
}
function refreshLabel(id) {
  const b = V.bld[id]; if (!b) return;
  const B = BUILD[id], l = lvl(id);
  let sub, prog = -1;
  if (!visitingVillage && save.build && save.build.id === id) {
    const left = (save.build.end - Date.now()) / 1000, total = B.time[l + 1];
    sub = 'Construction ' + fmtTime(left); prog = clamp(1 - left / total, 0, 1);
  } else sub = B.max === 1 ? (id === 'portail' ? 'Mini-jeu' : id === 'maison' ? 'Chez moi' : 'Boutique') : 'Niveau ' + l;
  const key = B.name + sub + (prog >= 0 ? Math.round(prog * 50) : '');
  if (key === b.labelKey) return;
  b.labelKey = key;
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.font = '56px "Lilita One", Impact, sans-serif';
  const tw = Math.min(480, Math.max(g.measureText(B.name).width + 60, 260));
  const x0 = (512 - tw) / 2;
  g.fillStyle = 'rgba(29,18,56,.88)'; g.strokeStyle = '#1d1238'; g.lineWidth = 6;
  rrect(g, x0, 8, tw, 92, 26); g.fill(); g.stroke();
  g.fillStyle = '#fff8ec'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(B.name, 256, 56, tw - 30);
  g.font = '800 34px Nunito, sans-serif';
  const sw = g.measureText(sub).width + 36;
  g.fillStyle = prog >= 0 ? '#ff8a1f' : '#ffd23f'; rrect(g, 256 - sw / 2, 100, sw, 50, 25); g.fill(); g.stroke();
  if (prog >= 0) { g.fillStyle = '#ffd23f'; rrect(g, 256 - sw / 2 + 5, 105, (sw - 10) * prog, 40, 20); g.fill(); }
  g.fillStyle = '#1d1238'; g.fillText(sub, 256, 127);
  b.label.material.map.dispose();
  b.label.material.map = new THREE.CanvasTexture(c); b.label.material.needsUpdate = true;
}
function refreshBubble() {
  const b = V.bld.mine; if (!b || !b.bubble) return;
  const n = mineStock(), full = n >= MINE_CAP[lvl('mine')];
  b.bubble.visible = n > 0;
  const key = n + (full ? 'f' : '');
  if (key === b.bubbleKey) return;
  // une Mine de haut niveau gagne plusieurs pièces par seconde : on redessine la même image (sans nouvelle texture
  // ni recompilation de la matière, ce qui faisait saccader tout le village), et au plus une fois toutes les 2 s
  const now = performance.now(); if (b.bubbleKey && !full && now - (b.bubbleT || 0) < 2000) return;
  b.bubbleKey = key; b.bubbleT = now;
  const fresh = !b.bubbleCanvas, c = b.bubbleCanvas || (b.bubbleCanvas = document.createElement('canvas')); if (fresh) c.width = c.height = 160;
  const g = c.getContext('2d'); g.clearRect(0, 0, 160, 160);
  g.fillStyle = full ? '#ff4fa3' : '#fff8ec'; g.strokeStyle = '#1d1238'; g.lineWidth = 7;
  g.beginPath(); g.arc(80, 72, 62, 0, TAU); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(66, 130); g.lineTo(80, 152); g.lineTo(94, 130); g.fill();
  g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(80, 50, 22, 0, TAU); g.fill(); g.lineWidth = 5; g.stroke();
  g.fillStyle = '#1d1238'; g.font = '44px "Lilita One", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(n), 80, 104);
  if (b.bubble.material.map && b.bubble.material.map.image === c) { b.bubble.material.map.needsUpdate = true; return; }
  if (b.bubble.material.map) b.bubble.material.map.dispose();
  b.bubble.material.map = new THREE.CanvasTexture(c); b.bubble.material.needsUpdate = true;
}

// Héros en 3D (mêmes skins que dans le Bastion)
// Contour encré façon dessin animé : une copie un peu plus grosse de chaque pièce, vue de l'intérieur, en sombre
let OUTLINE_MAT = null;
const SKIN_OUT = {};
function skinOutlineMat(w) {
  const k = w.toPrecision(2); if (SKIN_OUT[k]) return SKIN_OUT[k];
  const m = new THREE.MeshBasicMaterial({ color: '#2a1830', side: THREE.BackSide });
  m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <skinning_vertex>', '#include <skinning_vertex>\n  transformed += normalize(objectNormal) * ' + (+k).toFixed(6) + ';'); };
  m.customProgramCacheKey = () => 'skinout' + k;
  return (SKIN_OUT[k] = m);
}
function addOutline(root, thick, minR) {
  if (!OUTLINE_MAT) OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: '#2a1830', side: THREE.BackSide });
  const list = []; root.traverse(o => { if (o.isMesh && !o.isInstancedMesh && !o.userData.outline && !o.userData.noOutline && !(o.material && o.material.transparent)) list.push(o); });
  for (const m of list) {
    if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
    if (minR && m.geometry.boundingSphere.radius * Math.max(m.scale.x, m.scale.y, m.scale.z) < minR) continue;
    if (m.isSkinnedMesh) {
      // modèle animé : le contour suit le squelette et gonfle le long des normales
      const ws = m.getWorldScale(new THREE.Vector3()).x / (root.getWorldScale(new THREE.Vector3()).x || 1);
      const o = new THREE.SkinnedMesh(m.geometry, skinOutlineMat((thick || 0.03) / (ws || 1)));
      o.bind(m.skeleton, m.bindMatrix); o.userData.outline = true; o.castShadow = false; o.frustumCulled = false; m.add(o);
      continue;
    }
    const r = Math.max(0.03, m.geometry.boundingSphere.radius), o = new THREE.Mesh(m.geometry, OUTLINE_MAT);
    o.scale.setScalar(1 + (thick || 0.03) / r); o.userData.outline = true; o.castShadow = false; m.add(o);
  }
  return root;
}
const Q_HAT_FIT={craq:[.3,.1],dHelm:[.34,.06],oh7:[.35,.04],oh9:[.36,.05],oh10:[.34,.06],bonnet:[.38,.03],goupil:[.4,.02]};
function buildQuaterniusHero(){
 const a=CharacterModels.clean(save.appearance),hat=lookItem('hat');if(hat)a.hood=false;
 const g=CharacterModels.build(THREE,MODELS,a,false,heroColors().hair,!!hat);if(!g)return null;
 const bones=g.userData.quaternius.bones,find=n=>bones.find(b=>b.o.name===n)?.o;
 // pose « arme en main » avant d'accrocher les objets, pour qu'ils suivent les os dans la bonne position
 g.userData.gun=true;CharacterModels.animate(THREE,g,0,false);
 g.updateMatrixWorld(true);
 // casques et coiffes enveloppantes : plus petits et un peu plus haut, pour ne pas cacher le visage
 const fit=Q_HAT_FIT[hat&&hat.id]||[.43,0];
 if(hat){const holder=wAttach(find('Head'),g,new THREE.Vector3(0,(a.body==='female'?2.37:2.44)+fit[1],0),fit[0]*(a.body==='female'?.92:1));if(hat.cosm)buildCosmHat3D(holder,hat);else buildHat3D(holder,hat);}
 if(lookItem('cape')){const holder=wAttach(find('spine_03'),g,new THREE.Vector3(0,.66,.33),.82);buildCape3D(holder);}
 if(lookItem('boots'))g.traverse(o=>{if(!o.isMesh||!/_Feet/.test(o.name))return;const geo=o.geometry.clone(),p=geo.attributes.position,idx=geo.index,keep=[];for(let i=0;i<(idx?idx.count:p.count);i+=3){const tri=[0,1,2].map(k=>idx?idx.getX(i+k):i+k);if(tri.every(v=>p.getY(v)>=.13))keep.push(...tri)}geo.setIndex(keep);geo.userData.characterCrop=true;o.geometry=geo;
  // la tige de la tenue prend la couleur des bottes équipées, pour qu'elles forment une seule paire
  const bc=new THREE.Color(bootCol3()).lerp(new THREE.Color('#ffffff'),.3),tintB=m=>{const c=m.clone();c.color.copy(bc);c.userData.characterOwned=true;return c;};o.material=Array.isArray(o.material)?o.material.map(tintB):tintB(o.material);});
 if(lookItem('boots'))for(const [n,side] of [['foot_l',1],['foot_r',-1]]){const bone=find(n),p=bone.getWorldPosition(new THREE.Vector3());const holder=wAttach(bone,g,new THREE.Vector3(p.x,.48,p.z+.18),.63);buildBoot3D(holder,bootSpec(),side);}
 // l'arme est tenue par sa poignée (arrière-bas de l'arme), au creux de la main
 const hand=find('hand_r'),knuckle=find('middle_01_r'),palm=hand.getWorldPosition(new THREE.Vector3());if(knuckle)palm.lerp(knuckle.getWorldPosition(new THREE.Vector3()),.55);
 const gun=wAttach(hand,g,palm,.65),inner=new THREE.Group();gun.add(inner);buildGun3D(inner,'#3a3550');
 const gb=new THREE.Box3().setFromObject(inner),gs=gb.getSize(new THREE.Vector3()),gi=gun.matrixWorld.clone().invert();gb.applyMatrix4(gi);gb.getSize(gs);
 if(isFinite(gs.y))inner.position.set(-(gb.min.x+gb.max.x)/2,-(gb.min.y+gs.y*.35),-(gb.min.z+gs.z*.3));
 g.userData.gun=gun;
 return g;
}
function buildHero3D(skinId, clsColor) {
  if (tribeId() && MODELS[TRIBES[tribeId()].model]) { const w = buildWarrior3D(clsColor); if (w) return w; }
  const T = THREE, k = skinId === 'perso' ? persoSkin() : (SKINS[skinId] || SKINS.recrue);
  const outfit = k.outfit || clsColor, acc = k.accent, skin = k.skin;
  const g = new T.Group(), legs = [], arms = [];
  const ball = (r, col, x, y, z, parent, sx, sy, sz, opt) => { const m = mk(new T.SphereGeometry(r, 18, 14), col, x, y, z, parent, opt); m.scale.set(sx || 1, sy || 1, sz || 1); return m; };
  const caps = (r, l, col, x, y, z, parent) => mk(new T.CapsuleGeometry(r, l, 6, 12), col, x, y, z, parent);
  for (const sx of [-1, 1]) {
    const hip = new T.Group(); hip.position.set(sx * 0.19, 0.8, 0); g.add(hip);
    caps(0.12, 0.38, '#3a3046', 0, -0.33, 0, hip);
    buildBoot3D(hip, bootSpec(), sx);
    legs.push(hip);
  }
  const body = new T.Group(); g.add(body);
  // Tunique arrondie qui s'évase un peu en bas, ceinture et boucle
  ball(0.42, outfit, 0, 1.3, 0, body, 1, 1.12, 0.78);
  mk(new T.CylinderGeometry(0.36, 0.47, 0.36, 20), outfit, 0, 0.98, 0, body);
  const belt = mk(new T.TorusGeometry(0.385, 0.055, 8, 24), '#5a3a26', 0, 1.06, 0, body); belt.rotation.x = Math.PI / 2; belt.scale.set(1, 0.8, 1);
  mk(BX(0.14, 0.12, 0.06), '#ffd23f', 0, 1.06, 0.33, body);
  if (!lookItem('cape')) {
    // Sac à dos avec ses bretelles, comme sur les illustrations du héros (caché sous une cape)
    const pk = caps(0.2, 0.22, acc, 0, 1.34, -0.4, body); pk.scale.set(1.25, 1, 0.62);
    ball(0.17, tint(acc, 0.14), 0, 1.5, -0.45, body, 1.35, 0.55, 0.7);
    mk(BX(0.13, 0.08, 0.05), '#ffd23f', 0, 1.42, -0.55, body);
    for (const sx of [-1, 1]) {
      const st = mk(new T.TorusGeometry(0.34, 0.035, 6, 20, Math.PI), tint(acc, -0.25), sx * 0.2, 1.36, 0, body); st.rotation.y = Math.PI / 2;
      mk(BX(0.07, 0.24, 0.035), tint(acc, -0.25), sx * 0.2, 1.24, 0.31, body);
    }
  }
  buildCape3D(body);
  for (const sx of [-1, 1]) {
    ball(0.17, clsColor, sx * 0.44, 1.62, 0, body);
    const sh = new T.Group(); sh.position.set(sx * 0.48, 1.56, 0); body.add(sh);
    caps(0.1, 0.38, outfit, 0, -0.27, 0, sh);
    ball(0.13, skin, 0, -0.6, 0, sh);
    arms.push(sh);
  }
  // L'arme se tient sur le côté droit, à deux mains : le buste pivote un peu, main droite sur la poignée, main gauche dessous
  const tw = 0.5, toLocal = (x, y, z) => new T.Vector3(x * Math.cos(tw) - z * Math.sin(tw), y, x * Math.sin(tw) + z * Math.cos(tw));
  body.rotation.y = tw;
  const gun = new T.Group(); gun.position.copy(toLocal(0.3, 1.08, 0.5)); gun.rotation.y = -tw; body.add(gun);
  buildGun3D(gun, acc);
  const aimArm = (sh, target) => {
    const d = target.clone().sub(sh.position), len = d.length();
    sh.quaternion.setFromUnitVectors(new T.Vector3(0, -1, 0), d.normalize());
    sh.scale.set(1, Math.min(1.6, Math.max(0.8, len / 0.6)), 1);
    sh.children.forEach(c => { if (c.geometry && c.geometry.type === 'SphereGeometry') c.scale.set(1, 1 / sh.scale.y, 1); });
  };
  aimArm(arms[1], toLocal(0.3, 0.9, 0.32));   // main droite : poignée
  aimArm(arms[0], toLocal(0.3, 0.98, 0.62));  // main gauche : sous le canon
  // Grosse tête (style chibi), grands yeux brillants
  const head = new T.Group(); head.position.set(0, 2.12, 0); head.scale.setScalar(1.28); head.rotation.y = -tw * 0.85; body.add(head);
  ball(0.36, skin, 0, 0, 0, head);
  for (const sx of [-1, 1]) {
    ball(0.075, '#ffffff', sx * 0.135, 0.02, 0.315, head, 0.9, 1.3, 0.5);
    ball(0.05, k.eyes || '#2a1830', sx * 0.135, 0.005, 0.345, head, 0.9, 1.25, 0.5);
    ball(0.018, '#ffffff', sx * 0.135 + 0.018, 0.04, 0.37, head).userData.noOutline = true;
    ball(0.05, '#ff8fa0', sx * 0.22, -0.1, 0.275, head, 1, 0.55, 0.3, { transparent: true, opacity: 0.55 }).userData.noOutline = true;
  }
  const mouth = mk(new T.TorusGeometry(0.045, 0.012, 4, 10, Math.PI), '#2a1830', 0, -0.11, 0.33, head); mouth.rotation.z = Math.PI; mouth.userData.noOutline = true;
  const hc = k.headCol, dbl = { side: T.DoubleSide };
  const hat3 = lookItem('hat');
  if (hat3) { if (hat3.cosm) buildCosmHat3D(head, hat3); else buildHat3D(head, hat3); }
  if (hat3 && !(HAT_HAIR[hat3.id] && k.head === 'hair')) {
    // sous un chapeau, on voit encore les cheveux derrière la tête et sur les côtés
    if (k.head === 'hair' && !HAT_COVER[hat3.id]) {
      mk(new T.SphereGeometry(0.39, 18, 10, Math.PI, Math.PI, 0.42 * Math.PI, 0.32 * Math.PI), hc, 0, 0, -0.02, head);
      for (const sx of [-1, 1]) { const c = mk(new T.ConeGeometry(0.1, 0.3, 8), hc, sx * 0.31, -0.04, 0.04, head); c.rotation.set(0.1, 0, Math.PI + sx * 0.18); }
    }
  }
  else if (k.head === 'hair') {
    // Cheveux façon Dofus : calotte, arrière de la tête, mèches en pointe sur le front et une boucle sur le dessus
    mk(new T.SphereGeometry(0.39, 18, 8, 0, TAU, 0, Math.PI * 0.42), hc, 0, 0.03, -0.01, head);
    mk(new T.SphereGeometry(0.385, 18, 12, Math.PI, Math.PI, 0, Math.PI * 0.72), hc, 0, 0.0, -0.02, head);
    for (const i of [-1, 0, 1]) { const c = mk(new T.ConeGeometry(0.085, 0.26, 8), hc, i * 0.15, 0.24, 0.27, head); c.rotation.set(1.9, 0, -i * 0.45); }
    curl3(head, hc, 0.04, 0.36, -0.02, 0.15, 1.15, Math.PI / 2, -0.35, 0.05);
    // mèches sur les côtés, par-dessus les oreilles
    for (const sx of [-1, 1]) { const c = mk(new T.ConeGeometry(0.1, 0.3, 8), hc, sx * 0.31, -0.04, 0.04, head); c.rotation.set(0.1, 0, Math.PI + sx * 0.18); }
  } else if (k.head === 'cap') {
    mk(new T.SphereGeometry(0.385, 16, 8, 0, TAU, 0, Math.PI / 2), hc, 0, 0.04, 0, head);
    mk(BX(0.5, 0.05, 0.36), hc, 0, 0.1, 0.36, head);
    mk(new T.SphereGeometry(0.07, 8, 6), clsColor, 0, 0.43, 0, head);
  } else if (k.head === 'mohawk') {
    mk(BX(0.12, 0.3, 0.66), hc, 0, 0.38, -0.02, head);
    mk(BX(0.64, 0.11, 0.06), '#1d1238', 0, 0.05, 0.34, head);
    for (const sx of [-1, 1]) mk(BX(0.18, 0.05, 0.02), acc, sx * 0.15, 0.07, 0.375, head);
  } else if (k.head === 'hood') {
    mk(new T.SphereGeometry(0.42, 16, 12, Math.PI / 2 + 0.75, TAU - 1.5), hc, 0, 0.02, -0.02, head, dbl);
    const band = mk(new T.TorusGeometry(0.385, 0.05, 6, 20), acc, 0, 0.14, 0, head); band.rotation.x = Math.PI / 2;
    for (const sx of [-1, 1]) { const t = mk(BX(0.08, 0.06, 0.45), acc, sx * 0.08, 0.1, -0.55, head); t.rotation.y = sx * 0.3; }
  } else if (k.head === 'helmet') {
    mk(new T.SphereGeometry(0.41, 16, 12), hc, 0, 0.02, 0, head);
    mk(new T.SphereGeometry(0.425, 16, 8, Math.PI / 2 - 0.85, 1.7, 1.2, 0.75), k.visor, 0, 0.02, 0, head, dbl);
    if (k.crown) for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; mk(new T.ConeGeometry(0.07, 0.24, 6), acc, Math.cos(a) * 0.22, 0.47, Math.sin(a) * 0.22, head); }
  } else if (k.head === 'dino') {
    mk(new T.SphereGeometry(0.44, 16, 12), hc, 0, 0.04, 0, head);
    mk(BX(0.44, 0.3, 0.4), hc, 0, -0.04, 0.42, head);
    for (const sx of [-1, 1]) {
      mk(new T.SphereGeometry(0.1, 8, 6), '#fff8ec', sx * 0.18, 0.22, 0.33, head);
      mk(new T.SphereGeometry(0.05, 6, 5), '#1d1238', sx * 0.18, 0.23, 0.42, head);
    }
    for (let i = 0; i < 4; i++) { const sp = mk(new T.ConeGeometry(0.1, 0.28, 6), acc, 0, 1.75 - i * 0.28, -0.42 - (i === 0 ? 0 : 0.08), body); sp.rotation.x = -Math.PI / 2.4; }
  } else headExtra3D(head, k);
  addOutline(g, 0.028);
  g.userData = { legs, arms, body, gun, head };
  return g;
}
// Ombre douce sous les pieds : l'ombre du soleil est trop grossière pour toucher les pieds (surtout en mode fluide),
// le personnage semblait flotter au-dessus du sol
let FOOT_SHADOW_MAT = null;
function addFootShadow(g, r) {
  const T = THREE;
  if (!FOOT_SHADOW_MAT) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(25,15,35,0.8)'); gr.addColorStop(0.5, 'rgba(25,15,35,0.55)'); gr.addColorStop(1, 'rgba(25,15,35,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    FOOT_SHADOW_MAT = new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  }
  const m = new T.Mesh(new T.PlaneGeometry(r * 2, r * 2), FOOT_SHADOW_MAT);
  m.rotation.x = -Math.PI / 2; m.position.y = 0.1; m.renderOrder = 1;   // au-dessus des pavés (posés à 0,07)
  m.castShadow = m.receiveShadow = false; m.userData.noOutline = true;
  g.add(m); return m;
}
// ---------- Montures (village) : on monte dessus, on va plus vite ----------
// saddle : hauteur de la selle (en mètres, monture à sa taille du jeu) ; back : selle reculée vers la queue
const MOUNTS = {
};
const riding = () => false; // montures retirees
function updateMount(moving, dt) {
  if (V.mount) V.mount.visible = false; return;
  const M = riding() && MOUNTS[save.mount];
  if (!M || !MODELS[M.model]) { if (V.mount) V.mount.visible = false; return; }
  if (!V.mount || V.mount.userData.id !== save.mount) {
    if (V.mount) V.scene.remove(V.mount);
    V.mount = modelInst(M.model); if (!V.mount) return; V.mount.userData.id = save.mount; V.scene.add(V.mount);
    const I = V.mount.userData.inst; V.mount.userData.acts = {};
    // une seule animation (Felstrider, Dragon) : elle tourne en continu, à l'arrêt comme en marche
    if (M.walk === M.idle) { const a = I.mixer.clipAction(I.clip(M.walk)); a.play(); V.mount.userData.acts = { walk: a, idle: a, one: true }; }
    else for (const k of ['walk', 'idle']) { const a = I.mixer.clipAction(I.clip(M[k])); a.play(); a.weight = k === 'idle' ? 1 : 0; V.mount.userData.acts[k] = a; }
  }
  const g = V.mount, A = g.userData.acts, P = V.P;
  g.visible = true; g.position.set(P.x, 0, P.z); g.rotation.y = P.rot;
  if (!A.one) { const w = A.walk.weight + ((moving ? 1 : 0) - A.walk.weight) * Math.min(1, dt * 8); A.walk.weight = w; A.idle.weight = 1 - w; }
  g.userData.inst.mixer.update(dt * (moving ? 1.3 : 1));
  // le héros assis sur son dos : jambes écartées et pliées vers l'avant
  const h = V.hero; h.position.set(P.x - Math.sin(P.rot) * M.back, M.saddle + Math.sin(V.time * (moving ? 12 : 2)) * (moving ? 0.04 : 0.01), P.z - Math.cos(P.rot) * M.back);
  const W = h.userData.warrior;
  if (W) { const B = W.B || (W.B = wBones(W.root || h)); for (const [k, z] of [['LeftUpLeg', -0.55], ['RightUpLeg', 0.55]]) if (B[k]) { B[k].rotation.x = -1.2; B[k].rotation.z += z; } }
  else if (h.userData.legs) h.userData.legs.forEach((l, i) => { l.rotation.x = -1.3; l.rotation.z = i ? 0.4 : -0.4; });
}
function animHero(h, walk, moving, dt) {
  if(h.userData.quaternius){CharacterModels.animate(THREE,h,walk,moving);return;}
  if (h.userData.warrior) { animWarrior(h, walk, moving); return; }
  const u = h.userData, sw = moving ? Math.sin(walk) * 0.7 : 0;
  u.legs[0].rotation.x += (sw - u.legs[0].rotation.x) * Math.min(1, dt * 14);
  u.legs[1].rotation.x += (-sw - u.legs[1].rotation.x) * Math.min(1, dt * 14);
  u.body.position.y = moving ? Math.abs(Math.sin(walk)) * 0.06 : Math.sin(V.time * 2) * 0.015;
}
function refreshPetSprite() {
  if (!V.ok) return;
  if (V.pet3D) { V.scene.remove(V.pet3D); V.pet3D = null; }
  if (!PETS[save.pet]) return;
  const g = buildPet3D(save.pet); g.scale.setScalar(1.15);
  g.position.set(V.P.x - 1.4, 0, V.P.z); g.userData.st = { t: 0 };
  V.scene.add(g); V.pet3D = g;
}
function updatePetSprite(dt) {
  const g = V.pet3D; if (!g) return;
  const s = g.userData.st, H = V.P; s.t += dt;
  let tx, tz;
  if (save.camMode === 'fp' && !V.inside) {
    // En 1re personne, le familier marche devant, un peu sur le côté, pour rester visible
    const fx = -Math.sin(V.yaw), fz = -Math.cos(V.yaw), rx = Math.cos(V.yaw), rz = -Math.sin(V.yaw);
    tx = H.x + fx * 4.2 + rx * 2.0; tz = H.z + fz * 4.2 + rz * 2.0;
  } else {
    // à côté du héros (du côté opposé à l'arme), un peu en retrait, avec de la place entre eux
    const c = Math.cos(H.rot), sn = Math.sin(H.rot), lx = -3.0, lz = -0.7;
    tx = H.x + lx * c + lz * sn; tz = H.z - lx * sn + lz * c;
  }
  const dx = tx - g.position.x, dz = tz - g.position.z, d = Math.hypot(dx, dz), moving = d > 0.12;
  if (d > 12) { g.position.x = tx; g.position.z = tz; }
  else if (moving) { const sp = Math.min(d, Math.max(3.5, d * 5) * dt); g.position.x += dx / d * sp; g.position.z += dz / d * sp; }
  let want = moving ? Math.atan2(dx, dz) : H.rot, a = want - g.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a));
  g.rotation.y += a * Math.min(1, dt * 8);
  g.position.y = g.userData.fly ? 1.15 + Math.sin(s.t * 2.5) * 0.12 : 0;
  animPet3D(g, s.t, moving || g.userData.fly);
}
function rebuildHero() {
  if (!V.ok) return;
  const pos = V.hero.position.clone(), rot = V.hero.rotation.y;
  V.scene.remove(V.hero);
  V.hero = buildHero3D(save.skin, CLASSES[save.cls].color); addFootShadow(V.hero, 0.6); villageGunPose(V.hero);
  V.hero.position.copy(pos); V.hero.rotation.y = rot; V.scene.add(V.hero);
  buildBuilding('garde');
}
function placeHeroCam(snap) {
  const P = V.P, z = V.zoom;
  V.hero.position.set(P.x, 0, P.z); V.hero.rotation.y = P.rot;
  if (V.inside) {
    // Dans la maison : vue de haut, de face, comme une maison de poupée
    V.hero.visible = true;
    const C = V.inside === 'bunker' ? BUNKER : HOME;
    const lx = clamp(P.x - C.x, -3.5, 3.5) * 0.45, tx = C.x + lx, ty = 14.5, tz = C.z + 12.5;
    if (snap) V.cam.set(tx, ty, tz); else V.cam.lerp(new THREE.Vector3(tx, ty, tz), 0.1);
    V.camera.position.copy(V.cam); V.camera.lookAt(C.x + lx, 0, C.z + 0.4);
    return;
  }
  if (save.camMode === 'fp') {
    // 1re personne : la caméra est dans la tête du héros et regarde devant
    V.hero.visible = false;
    const dx = -Math.sin(V.yaw), dz = -Math.cos(V.yaw);
    V.camera.position.set(P.x + dx * 0.25, 2.05, P.z + dz * 0.25);
    V.camera.lookAt(P.x + dx * 6, 1.75, P.z + dz * 6);
    V.cam.copy(V.camera.position);
    return;
  }
  V.hero.visible = true;
  const tx = P.x + Math.sin(V.yaw) * 13 * z, tz = P.z + Math.cos(V.yaw) * 13 * z, ty = 13.5 * z;
  if (snap) V.cam.set(tx, ty, tz);
  else V.cam.lerp(new THREE.Vector3(tx, ty, tz), 0.15);
  V.camera.position.copy(V.cam);
  V.camera.lookAt(P.x, 1.6, P.z);
}

// L'ouvrier va sur le chantier en passant par la place, tape au marteau, puis rentre à sa cabane
function ringPoint(x, z) { const a = Math.atan2(z - PLAZA[1], x - PLAZA[0]); return a; }
function builderRoute(fx, fz, tx, tz) {
  const R = 3.4, a1 = ringPoint(fx, fz), a2 = ringPoint(tx, tz);
  let d = a2 - a1; d = Math.atan2(Math.sin(d), Math.cos(d));
  const steps = Math.max(1, Math.ceil(Math.abs(d) / (Math.PI / 4))), pts = [];
  for (let i = 0; i <= steps; i++) { const a = a1 + d * i / steps; pts.push([PLAZA[0] + Math.cos(a) * R, PLAZA[1] + Math.sin(a) * R]); }
  pts.push([tx, tz]);
  return pts;
}
function updateBuilder(dt) {
  const B = V.builder; if (!B) return;
  const u = B.userData;
  let tx, tz, key;
  if (save.build && V.bld[save.build.id]) {
    const b = V.bld[save.build.id], a = b.group.rotation.y, R = BUILD[save.build.id].collide;
    tx = b.group.position.x + Math.sin(a) * (R + 0.4) + Math.cos(a) * 1.6; tz = b.group.position.z + Math.cos(a) * (R + 0.4) - Math.sin(a) * 1.6;
    key = save.build.id;
  } else if (V.chair) {
    // Rien à construire : il va s'asseoir sur sa chaise, devant la cabane (on s'arrête juste devant, puis on s'installe)
    tx = V.chair.x + Math.sin(V.chair.rot) * 0.5; tz = V.chair.z + Math.cos(V.chair.rot) * 0.5; key = 'chair';
  } else { tx = V.hutDoor[0]; tz = V.hutDoor[1]; key = 'hut'; }
  if (u.key !== key) { u.key = key; u.route = Math.hypot(tx - B.position.x, tz - B.position.z) < 6 ? [[tx, tz]] : builderRoute(B.position.x, B.position.z, tx, tz); }
  let wp = u.route[0];
  let dx = wp[0] - B.position.x, dz = wp[1] - B.position.z, d = Math.hypot(dx, dz);
  if (d < 0.35 && u.route.length > 1) { u.route.shift(); wp = u.route[0]; dx = wp[0] - B.position.x; dz = wp[1] - B.position.z; d = Math.hypot(dx, dz); }
  const walking = d > 0.35 && !(key === 'chair' && Math.hypot(V.chair.x - B.position.x, V.chair.z - B.position.z) < 0.7);
  if (walking) {
    const sp = Math.min(d, 4.2 * dt);
    B.position.x += dx / d * sp; B.position.z += dz / d * sp;
    let a = Math.atan2(dx, dz) - B.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a));
    B.rotation.y += a * Math.min(1, dt * 10);
    u.walk = (u.walk || 0) + dt * 12;
  } else if (save.build) {
    const b = V.bld[save.build.id].group.position;
    let a = Math.atan2(b.x - B.position.x, b.z - B.position.z) - B.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a));
    B.rotation.y += a * Math.min(1, dt * 8);
  }
  const sitting = !walking && key === 'chair';
  u.sit = (u.sit || 0) + ((sitting ? 1 : 0) - (u.sit || 0)) * Math.min(1, dt * 4);
  if (u.straw) u.straw.visible = u.sit > 0.5;
  if (u.sit > 0.01) {
    // S'asseoir : il recule sur la chaise, plie les jambes, le brin de paille remue
    const cx = V.chair.x, cz = V.chair.z;
    B.position.x += (cx + Math.sin(V.chair.rot) * 0.08 - B.position.x) * u.sit * Math.min(1, dt * 6);
    B.position.z += (cz + Math.cos(V.chair.rot) * 0.08 - B.position.z) * u.sit * Math.min(1, dt * 6);
    let a = V.chair.rot - B.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); B.rotation.y += a * Math.min(1, dt * 6);
    B.position.y = -0.07 * u.sit;
    u.legs[0].rotation.x = u.legs[1].rotation.x = -1.5 * u.sit;
    u.knees[0].rotation.x = u.knees[1].rotation.x = 1.55 * u.sit;
    u.arms[0].rotation.x = u.arms[1].rotation.x = -0.5 * u.sit;
    u.body.position.y = 0; u.body.rotation.x = -0.12 * u.sit;
    if (u.straw) u.straw.rotation.z = Math.sin(V.time * 2.2) * 0.25;
    if (u.head) u.head.rotation.y = Math.sin(V.time * 0.4) * 0.35;
    if (u.sit > 0.5) return;
  } else { B.position.y = 0; u.body.rotation.x = 0; if (u.head) u.head.rotation.y = 0; u.knees[0].rotation.x = u.knees[1].rotation.x = 0; }
  const sw = walking ? Math.sin(u.walk) * 0.7 : 0;
  u.legs[0].rotation.x = sw; u.legs[1].rotation.x = -sw;
  // Coup de marteau
  u.arms[1].rotation.x = !walking && save.build ? -1.6 + Math.abs(Math.sin(V.time * 7)) * 1.4 : walking ? -sw * 0.8 : 0;
  u.arms[0].rotation.x = walking ? sw * 0.8 : 0;
  u.body.position.y = walking ? Math.abs(Math.sin(u.walk)) * 0.05 : 0;
}

function updateVillage(dt) {
  updateHomeGoblin(dt);
  V.time += dt; if (V.wind) V.wind.value = V.time;
  updateVillageModels(dt); if(!visitingVillage){updateTroops(dt); updateRaids(dt);}
  const P = V.P;
  let mx = vjoy.dx, my = vjoy.dy;
  if (!anyModalOpen()) {
    if (keys.ArrowLeft || keys.KeyA || keys.KeyQ) mx -= 1;
    if (keys.ArrowRight || keys.KeyD) mx += 1;
    if (keys.ArrowUp || keys.KeyW || keys.KeyZ) my -= 1;
    if (keys.ArrowDown || keys.KeyS) my += 1;
  } else { mx = my = 0; }
  if (V.sleeping) mx = my = 0;
  const ml = Math.hypot(mx, my);
  if (ml > 1) { mx /= ml; my /= ml; }
  const moving = ml > 0.1;
  if (moving && V.pose && V.pose.type === 'sit') { V.pose = null; resetPose(); V.near = null; }
  if (moving) {
    const c = Math.cos(V.yaw), s = Math.sin(V.yaw);
    const wx = mx * c + my * s, wz = -mx * s + my * c;
    const spd = 7 * (riding() ? MOUNTS[save.mount].speed : 1);
    P.x += wx * spd * dt; P.z += wz * spd * dt;
    const target = Math.atan2(wx, wz);
    let d = target - P.rot; d = Math.atan2(Math.sin(d), Math.cos(d));
    P.rot += d * Math.min(1, dt * 12);
    P.walk += dt * 11;
    V.idle = 0;
  } else V.idle = (V.idle || 0) + dt;
  // À l'arrêt devant un bâtiment, la caméra se place doucement face à sa porte
  if (V.near && V.bld[V.near] && !V.inside && V.idle > 0.4 && vcam.id === null && save.camMode !== 'fp') {
    let d = V.bld[V.near].group.rotation.y - V.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    V.yaw += d * Math.min(1, dt * 2.5);
  }
  let homeNear = null;
  if (V.inside) homeNear = V.inside === 'bunker' ? updateBunker(moving, dt) : updateHome(moving);
  else {
    for (const c of V.colliders) {
      const dx = P.x - c.x, dz = P.z - c.z, d = Math.hypot(dx, dz), r = c.r + 0.45;
      if (d < r && d > 0.0001) { P.x = c.x + dx / d * r; P.z = c.z + dz / d * r; }
    }
    const lim = WALL - 1.0;
    P.x = clamp(P.x, -lim, lim); P.z = clamp(P.z, -lim, lim);
  }
  animHero(V.hero, riding() ? 0 : P.walk, riding() ? false : moving, dt);
  updatePetSprite(dt);
  placeHeroCam(false);
  applyPose();
  updateMount(moving, dt);
  updateBuilder(dt);

  // Bâtiment (ou meuble) le plus proche
  let near = null, nd = 3.2;
  if (V.inside) near = V.pose ? null : homeNear;
  else {
    for (const id in V.bld) { const b = V.bld[id], d = Math.hypot(P.x - b.ix, P.z - b.iz); if (d < nd) { nd = d; near = id; } }
    if (V.hatch && Math.hypot(P.x - HATCH.x, P.z - HATCH.z) < 2.2) near = 'trappe';
    if(V.homeGoblin?.visible&&!V.homeGoblin.userData.roam.inside&&Math.hypot(P.x-V.homeGoblin.position.x,P.z-V.homeGoblin.position.z)<2.1)near='tessa';
    const witch = (V.extras || []).find(e => e.id === 'tigre'); if (witch && Math.hypot(P.x - witch.g.position.x, P.z - witch.g.position.z) < 2.4) near = 'sorciere';
  }
  V.panelT -= dt;
  if (near !== V.near || V.panelT <= 0) { V.near = near; V.panelT = 0.25; renderPanel(); }

  // Construction terminée ?
  if (!visitingVillage && save.build && Date.now() >= save.build.end) finishBuild();
  V.labelT -= dt;
  if (V.labelT <= 0) { V.labelT = 0.5; if (save.build) refreshLabel(save.build.id); refreshBubble(); updateVhud();
    if (save.firstPet && !V.petHint && !visitingVillage && $('tutorialM').hidden && !anyModalOpen()) { V.petHint = true; banner('Ton premier familier', 'Va voir la sorcière, entre la Forge et le Laboratoire : elle t’offre ton premier œuf !'); } }

  // Étiquettes : nettes près du joueur, estompées au loin
  for (const id in V.bld) {
    const b = V.bld[id], d = Math.hypot(P.x - b.group.position.x, P.z - b.group.position.z);
    b.label.material.opacity = id === V.near ? 1 : clamp(1.6 - d / 16, 0.25, 1);
  }
  // Animations du décor
  const t = V.time;
  if (V.portal) { V.portal.ring.rotation.y += dt * 0.9; V.portal.disc.rotation.z -= dt * 1.4; V.portal.inner.material.opacity = 0.2 + Math.sin(t * 3) * 0.08; const ps = 1 + Math.sin(t * 2) * 0.1; V.portal.inner.scale.set(ps, 1, ps); }
  if (V.spout) V.spout.scale.setScalar(1 + Math.sin(t * 6) * 0.15);
  if (V.waterTex) { V.waterTex.offset.set(t * 0.02, t * 0.012); V.causTex.offset.set(-t * 0.035, t * 0.025); }
  if (V.riverMats) { V.riverMats[0].offset.x = -t * 0.08; V.riverMats[1].offset.set(-t * 0.13, Math.sin(t * 0.7) * 0.05); V.foam.material.opacity = 0.35 + Math.sin(t * 1.8) * 0.12; }
  if (V.drops) {
    const dm2 = V.dropDummy || (V.dropDummy = new THREE.Object3D());
    for (let i = 0; i < 36; i++) {
      const u = (t * 0.9 + i / 36 * 3) % 1, a = i / 36 * TAU * 3, r = 0.6 + u * 0.7;
      dm2.position.set(Math.cos(a) * r, 2.0 + u * 1.1 - u * u * 2.4, Math.sin(a) * r); dm2.scale.setScalar(1 - u * 0.4); dm2.updateMatrix(); V.drops.setMatrixAt(i, dm2.matrix);
    }
    V.drops.instanceMatrix.needsUpdate = true;
  }
  if (V.flasks) V.flasks.forEach((f, i) => { f.position.y = 0.3 + Math.abs(Math.sin(t * 3 + i)) * 0.25; });
  if (V.elixir) V.elixir.scale.y = 1 + Math.sin(t * 2.2) * 0.08;
  if (V.wheel) V.wheel.rotation.x += dt * 1.6;
  if (V.flags) V.flags.forEach((f, i) => { f.rotation.y = Math.sin(t * 3 + i) * 0.35; });
  if (V.torches) V.torches.forEach((f, i) => { const k = 1 + Math.sin(t * 13 + i * 2) * 0.12 + Math.sin(t * 7.3 + i) * 0.08; f.scale.set(k, 1 + (k - 1) * 2, k); });
  if (V.flames) V.flames.forEach((f, i) => { const k = 1 + Math.sin(t * 11 + i * 1.7) * 0.15; f.scale.set(k, 1 + Math.sin(t * 9 + i) * 0.2, k); });
  if (V.fireLight) V.fireLight.intensity = 0.8 + Math.sin(t * 12) * 0.15 + Math.sin(t * 5.3) * 0.1;
  if (V.forgeFire) V.forgeFire.scale.setScalar(1 + Math.sin(t * 9) * 0.12);
  if (V.clouds) V.clouds.forEach((c, i) => { c.position.x += dt * (0.8 + i * 0.15); if (c.position.x > 50) c.position.x = -50; });
  if (V.bld.mine && V.bld.mine.bubble) V.bld.mine.bubble.position.y = V.bld.mine.top + 2.2 + Math.sin(t * 3) * 0.2;
  if (V.smokeAt) {
    const b = V.bld.forge.group, a = b.rotation.y, sa = V.smokeAt;
    const bx = b.position.x + sa.lx * Math.cos(a) + sa.lz * Math.sin(a), bz = b.position.z - sa.lx * Math.sin(a) + sa.lz * Math.cos(a);
    for (const s of V.smoke) {
      s.userData.t = (s.userData.t + dt * 0.35) % 1;
      const k = s.userData.t;
      s.position.set(bx + Math.sin(k * 6 + s.id) * 0.3, sa.ly + k * 4, bz + k * 0.8);
      s.scale.setScalar(0.5 + k * 1.6); s.material.opacity = 0.75 * (1 - k);
    }
  }
}
// Regroupement du décor immobile : les morceaux d'un même bâtiment ou objet qui partagent la même matière sont
// fusionnés en un seul objet à dessiner (le petit décor posé directement au sol est regroupé par zone de 16 m).
// L'image est identique, mais la carte graphique reçoit beaucoup moins d'ordres de dessin.
// Les morceaux d'origine restent en place (simplement plus dessinés) : si le jeu en bouge, en cache ou en remplace un,
// le regroupement de cet objet est défait aussitôt et l'objet redevient normal.
const VB = { next: 0, seen: new Map(), batches: [], calls: 0 };
function vbDenorm(v, arr) {
  if (arr instanceof Uint8Array || arr instanceof Uint8ClampedArray) return v / 255;
  if (arr instanceof Uint16Array) return v / 65535;
  if (arr instanceof Int8Array) return Math.max(v / 127, -1);
  if (arr instanceof Int16Array) return Math.max(v / 32767, -1);
  return v;
}
function vbRead(attr, i, c) {
  const a = attr.isInterleavedBufferAttribute ? attr.data.array : attr.array;
  const v = attr.isInterleavedBufferAttribute ? a[i * attr.data.stride + attr.offset + c] : a[i * attr.itemSize + c];
  return attr.normalized ? vbDenorm(v, a) : v;
}
// éléments à fusionner pour un objet : lui-même, ou chacune de ses copies s'il s'agit d'un objet instancié (herbe, plantes…)
// Three.js r149 dessine un objet instancié (herbes, galets, forêt…) même quand il est hors de l'écran : il ne connaît pas
// l'étendue de ses copies. On la calcule (une sphère qui les englobe toutes) pour qu'il soit sauté quand la caméra ne le voit pas.
function cullInstances() {
  const T = THREE, M = new T.Matrix4(), v = new T.Vector3();
  V.scene.traverse(m => {
    if (!m.isInstancedMesh || !m.count || m === V.drops || m.userData.noCull) return;
    const ver = m.instanceMatrix.version + ':' + m.count; if (m.userData.cullVer === ver) return;
    m.geometry.boundingSphere || m.geometry.computeBoundingSphere();
    const r0 = m.geometry.boundingSphere.radius, c0 = m.geometry.boundingSphere.center, box = new T.Box3();
    let scale = 1;
    for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, M); v.copy(c0).applyMatrix4(M); box.expandByPoint(v); scale = Math.max(scale, M.getMaxScaleOnAxis()); }
    // géométrie propre à cet objet (mêmes données, rien n'est copié) pour ne pas changer la sphère des autres qui la partagent
    if (!m.userData.cullVer) { const g = new T.BufferGeometry(); for (const n in m.geometry.attributes) g.setAttribute(n, m.geometry.attributes[n]); g.setIndex(m.geometry.index); g.groups = m.geometry.groups; m.geometry = g; }
    const sp = box.getBoundingSphere(new T.Sphere()); sp.radius += r0 * scale + 2;   // + marge pour le vent qui fait onduler les feuilles
    m.geometry.boundingSphere = sp; m.frustumCulled = true; m.userData.cullVer = ver;
  });
}
function vbItems(o, rootInv) {
  const T = THREE, rel = new T.Matrix4().multiplyMatrices(rootInv, o.matrixWorld);
  if (!o.isInstancedMesh) return [{ m: o, rel }];
  const out = [], im = new T.Matrix4();
  for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, im); out.push({ m: o, rel: rel.clone().multiply(im), base: rel }); }
  return out;
}
function vbSrc(m) {
  // d'où vient un objet : le bâtiment du village qui le contient, sinon le nom du modèle, sinon sa place sur la carte
  let top = m; while (top.parent && top.parent !== V.scene) top = top.parent;
  if (V.bld) for (const id in V.bld) if (V.bld[id].group === top) return id;
  for (let p = m; p && p !== V.scene; p = p.parent) if (p.name && !/^(Object_|Mesh|mesh_|Cube|Cylinder|Plane|Sphere|Group|Scene|RootNode|lot)/i.test(p.name)) return p.name.slice(0, 18);
  return (m.isInstancedMesh ? 'inst' : 'décor') + '@' + Math.round(top.position.x / 8) * 8 + ',' + Math.round(top.position.z / 8) * 8;
}
function vbSig(g) { return Object.keys(g.attributes).sort().map(n => n + g.attributes[n].itemSize).join(','); }
function vbMerge(list) {
  const T = THREE, names = Object.keys(list[0].geo.attributes);
  let nv = 0, ni = 0;
  for (const it of list) { const g = it.geo; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const out = {}; for (const n of names) out[n] = new Float32Array(nv * list[0].geo.attributes[n].itemSize);
  const index = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const v = new T.Vector3(), nm = new T.Matrix3();
  let vo = 0, io = 0;
  for (const { geo: g, rel } of list) {
    const cnt = g.attributes.position.count; nm.getNormalMatrix(rel);
    for (const n of names) {
      const at = g.attributes[n], k = at.itemSize, dst = out[n];
      for (let i = 0; i < cnt; i++) {
        if (n === 'position') { v.set(vbRead(at, i, 0), vbRead(at, i, 1), vbRead(at, i, 2)).applyMatrix4(rel); dst[(vo + i) * 3] = v.x; dst[(vo + i) * 3 + 1] = v.y; dst[(vo + i) * 3 + 2] = v.z; }
        else if (n === 'normal') { v.set(vbRead(at, i, 0), vbRead(at, i, 1), vbRead(at, i, 2)).applyMatrix3(nm).normalize(); dst[(vo + i) * 3] = v.x; dst[(vo + i) * 3 + 1] = v.y; dst[(vo + i) * 3 + 2] = v.z; }
        else for (let c = 0; c < k; c++) dst[(vo + i) * k + c] = vbRead(at, i, c);
      }
    }
    // un objet en miroir (échelle négative) : on retourne les triangles pour garder les bonnes faces visibles
    const flip = rel.determinant() < 0, idx = g.index, m = idx ? idx.count : cnt;
    for (let i = 0; i < m; i += 3) {
      const a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2;
      index[io++] = vo + a; index[io++] = vo + (flip ? c : b); index[io++] = vo + (flip ? b : c);
    }
    vo += cnt;
  }
  const geo = new T.BufferGeometry();
  for (const n of names) geo.setAttribute(n, new T.BufferAttribute(out[n], list[0].geo.attributes[n].itemSize));
  geo.setIndex(new T.BufferAttribute(index, 1)); geo.computeBoundingSphere(); geo.computeBoundingBox();
  return geo;
}
// objets que le jeu manipule lui-même (animations, bulles, halos, objets portés…) : on n'y touche jamais
function vbDynamic() {
  const dyn = new Set(), skip = new Set(['group', 'o']);
  const add = (v, d) => {
    if (!v || d > 2) return;
    if (v.isObject3D) { if (v !== V.scene && !v.isCamera) dyn.add(v); return; }
    if (Array.isArray(v)) { for (const e of v) add(e, d + 1); return; }
    if (typeof v === 'object' && v.constructor === Object) for (const k in v) if (!skip.has(k)) add(v[k], d + 1);
  };
  for (const k in V) if (k !== 'scene' && k !== 'camera') add(V[k], 0);
  V.scene.traverse(o => { const u = o.userData; if (u) for (const k in u) { const x = u[k]; if (x && x.isObject3D && x !== o) dyn.add(x); else if (Array.isArray(x)) x.forEach(e => { if (e && e.isObject3D) dyn.add(e); }); } });
  return dyn;
}
function vbUnbatch(B) {
  for (const m of B.merged) { if (m.parent) m.parent.remove(m); m.geometry.dispose(); }
  for (const it of B.items) { it.m.layers.mask = it.mask; if (it.root && it.root.userData.vbWorld) it.root.userData.vbWorld--; }
  SHC.next = 0;
  if (B.root !== V.scene) B.root.userData.noBatch = true;
  VB.batches.splice(VB.batches.indexOf(B), 1);
}
function batchVillage() {
  if (!V.ok || V.frameN < 120) return;
  const now = performance.now(); if (now < VB.next) return; VB.next = now + 2000;
  cullInstances();
  const T = THREE, inScene = o => { for (let p = o; p; p = p.parent) if (p === V.scene) return true; return false; };
  // 1. les regroupements existants sont-ils toujours valables ?
  for (const B of [...VB.batches]) {
    if (!inScene(B.root) && B.root !== V.scene) { for (const m of B.merged) m.geometry.dispose(); VB.batches.splice(VB.batches.indexOf(B), 1); continue; }
    // (un petit objet caché par la distance garde son regroupement : on ne regarde qu'à l'intérieur de l'objet)
    const shownAll = o => { for (let p = o; p && p !== B.root && p !== V.scene; p = p.parent) if (!p.visible) return false; return true; };
    const bad = B.items.some(it => !inScene(it.m) || !shownAll(it.m) || it.m.material !== it.mat || it.m.geometry !== it.geo ||
      (it.m.isInstancedMesh ? (it.m.instanceMatrix.version + ':' + it.m.count) !== it.ver || !B.relOf(it.m).equals(it.base) : !B.relOf(it.m).equals(it.rel)));
    if (bad) { vbUnbatch(B); VB.undone = (VB.undone || 0) + 1; }
  }
  // 2. nouveaux regroupements (seulement pour ce qui n'a pas bougé depuis 2 s)
  V.scene.updateMatrixWorld();
  const dyn = vbDynamic();
  const eligible = m => m.isMesh && !m.isSkinnedMesh && !(m.isInstancedMesh && (m.instanceColor || !m.count)) && !Array.isArray(m.material) && m.material && !m.material.transparent &&
    m.layers.mask === 1 && m.renderOrder === 0 && !m.customDepthMaterial && !m.userData.noBatch && !dyn.has(m) && m !== SHC.quad &&
    m.geometry && m.geometry.attributes.position && !m.geometry.attributes.tangent && !Object.keys(m.geometry.morphAttributes).length;
  const collect = (root, rootInv) => {
    const items = [];
    const walk = o => {
      if (!o.visible || dyn.has(o) || (o.userData && (o.userData.quaternius || o.userData.inst || o.userData.warrior || o.userData.legs)) || o.isBone) return;
      if (o !== root && eligible(o)) items.push(...vbItems(o, rootInv));
      for (const c of o.children) walk(c);
    };
    walk(root); return items;
  };
  const build = (root, items, keyOf, budget = Infinity) => {
    const groups = new Map();
    // (une pièce mise de côté par l'ombre fixe projette quand même son ombre)
    for (const it of items) it.cs = it.m.castShadow || SHC.off.includes(it.m);
    for (const it of items) { const k = keyOf(it) + '|' + it.m.material.uuid + '|' + it.cs + it.m.receiveShadow + it.m.frustumCulled + '|' + vbSig(it.m.geometry) + '|' + !!it.m.geometry.index; (groups.get(k) || groups.set(k, []).get(k)).push(it); }
    const merged = [], used = [];
    for (const list of groups.values()) {
      const inst = list.some(it => it.m.isInstancedMesh);
      if (list.length < 2 && !inst) continue;
      if (!inst) { if (budget <= 0) continue; for (const it of list) budget -= it.m.geometry.attributes.position.count; }
      const geo = vbMerge(list.map(it => ({ geo: it.m.geometry, rel: it.rel }))), m0 = list[0].m;
      VB.made = (VB.made || 0) + 1; const mesh = new T.Mesh(geo, m0.material); Object.assign(mesh, { castShadow: list[0].cs, receiveShadow: m0.receiveShadow, frustumCulled: true, name: 'lot' });
      mesh.userData.noBatch = true; mesh.userData.vbLot = true; mesh.userData.srcs = {}; for (const it of list) { const g = it.m.geometry, k = vbSrc(it.m); mesh.userData.srcs[k] = (mesh.userData.srcs[k] || 0) + (g.index ? g.index.count : g.attributes.position.count) / 3; } root.add(mesh); merged.push(mesh);
      for (const it of list) { used.push({ m: it.m, rel: it.rel, mask: it.m.layers.mask, mat: it.m.material, geo: it.m.geometry, root: it.root, ver: it.m.isInstancedMesh ? it.m.instanceMatrix.version + ':' + it.m.count : '', base: it.base }); it.m.layers.mask = 0; if (it.root) it.root.userData.vbWorld = (it.root.userData.vbWorld || 0) + 1; }
    }
    if (!merged.length) return;
    SHC.next = 0;
    const inv = new T.Matrix4();
    VB.batches.push({ root, merged, items: used, relOf: m => { inv.copy(root.matrixWorld).invert(); return new T.Matrix4().multiplyMatrices(inv, m.matrixWorld); } });
  };
  // n'est regroupé que ce qui n'a pas bougé depuis le passage précédent (2 s)
  const seen = new Map(), stable = it => {
    if (seen.has(it.m)) return seen.get(it.m).ok;
    const e = it.m.matrixWorld.elements, old = VB.seen.get(it.m), ver = it.m.isInstancedMesh ? it.m.instanceMatrix.version + ':' + it.m.count : '';
    const ok = !!old && old.ver === ver && old.e.every((x, i) => x === e[i]); seen.set(it.m, { e: Float64Array.from(e), ver, ok }); return ok;
  };
  // tout le décor immobile (petits objets compris) : regroupé par matière et par zone de 32 m, tous bâtiments confondus
  const items = [];
  for (const root of V.scene.children) {
    if (dyn.has(root) || root.isLight || root.isCamera || !root.visible || root.userData.noBatch) continue;
    if (root.userData && (root.userData.quaternius || root.userData.inst || root.userData.warrior || root.userData.legs)) continue;
    if (root.isMesh) { if (eligible(root) && !root.userData.vbLot) for (const it of vbItems(root, new T.Matrix4())) { it.root = root; items.push(it); } }
    else for (const it of collect(root, new T.Matrix4())) { it.root = root; items.push(it); }
  }
  const ready = items.filter(stable);
  VB.seen = seen;
  // pas trop de travail d'un coup (le reste sera regroupé aux passages suivants) ; une herbe instanciée est prise en entier
  let ib = 60000; const take = new Set();
  for (const it of ready) if (it.m.isInstancedMesh && !take.has(it.m)) { const v = it.m.count * it.m.geometry.attributes.position.count; if (ib - v < 0 && take.size) continue; ib -= v; take.add(it.m); }
  for (let i = ready.length - 1; i >= 0; i--) if (ready[i].m.isInstancedMesh && !take.has(ready[i].m)) ready.splice(i, 1);
  if (ready.length >= 2) build(V.scene, ready, it => it.m.isInstancedMesh ? 'i' : Math.floor(it.rel.elements[12] / 32) + ',' + Math.floor(it.rel.elements[14] / 32), 60000);
}
// Mise à jour automatique et obligatoire (appli Android) : la nouvelle version est téléchargée en arrière-plan par
// l'appli ; on l'installe aussitôt si le joueur est au village, sinon dès son retour au village (fin de partie, duo terminé)
const UPD = { ready: 0, told: false };
window.onBastionUpdate = v => { UPD.ready = v; forceUpdate(); };
function forceUpdate() {
  if (!UPD.ready || !window.BastionAndroid || !BastionAndroid.applyUpdate) return;
  if (state !== 'village' || session.ready) {
    if (!UPD.told) { UPD.told = true; banner('Mise à jour obligatoire', 'Elle s’installera dès ton retour au village.'); }
    return;
  }
  if (document.getElementById('updForce')) return;
  const box = document.createElement('div'); box.id = 'updForce';
  box.style.cssText = 'position:fixed;inset:0;z-index:2000;display:grid;place-items:center;background:rgba(29,18,56,.92);color:#fff;font:800 1.3rem/1.4 Nunito,sans-serif;text-align:center;padding:20px';
  box.textContent = 'Mise à jour du jeu (version ' + verName(UPD.ready) + ')…';
  document.body.appendChild(box);
  try { persist(); } catch (e) {}
  setTimeout(() => BastionAndroid.applyUpdate(), 900);
}
// Compteur d'images par seconde (Paramètres) : pour vérifier la fluidité sur téléphone et tablette
const FPSM = { n: 0, t: 0, el: null };
// détail des dessins du village (compteur d'images) : ce qui est à l'écran, par sorte d'objet
function drawBreakdown() {
  const cam = V.camera, fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)), n = {}, src = {};
  const walk = (o, anim) => {
    if (!o.visible) return;
    const u = o.userData; const a = anim || (u && (u.quaternius ? 'perso' : u.warrior ? 'guerrier' : u.legs ? 'perso-cubes' : u.inst ? 'modele' : '')) || '';
    if (o.isMesh && o.layers.test(cam.layers) && (!o.frustumCulled || fr.intersectsObject(o))) {
      const k = o.name === 'lot' ? 'lots' : a || (o.isInstancedMesh ? 'instances' : o.material && o.material.transparent ? 'transparents' : 'autres');
      const g = o.geometry, t = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
      const e = n[k] || (n[k] = [0, 0]); e[0]++; e[1] += t;
      if (o.userData.srcs) for (const sk in o.userData.srcs) src[sk] = (src[sk] || 0) + o.userData.srcs[sk]; else { const sk = vbSrc(o); src[sk] = (src[sk] || 0) + t; }
    }
    for (const c of o.children) walk(c, a);
  };
  walk(V.scene, '');
  const kt = v => Math.round(v / 1000) + 'k';
  return Object.entries(n).sort((x, y) => y[1][1] - x[1][1]).map(([k, v]) => k + ' ' + v[0] + '/' + kt(v[1])).join(' · ') + ' ¦ ' + Object.entries(src).sort((x, y) => y[1] - x[1]).slice(0, 10).map(([k, v]) => k + ' ' + kt(v)).join(' · ');
}
function fpsTick(now) {
  if (!FPSM.el) { FPSM.el = document.createElement('div'); FPSM.el.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:999;pointer-events:none;background:rgba(20,12,40,.75);color:#fff;font:700 12px/1 Nunito,sans-serif;padding:4px 8px;border-radius:8px;max-width:calc(100vw - 20px);line-height:1.3'; document.body.appendChild(FPSM.el); }
  FPSM.n++; if (!FPSM.t) FPSM.t = now;
  // à-coups : pire écart entre deux images sur la dernière seconde, et le temps passé dans le jeu pour cette image-là
  const gap = FPSM.prev ? now - FPSM.prev : 0; FPSM.prev = now; FPSM.half = PACE.half;
  if (gap > (FPSM.worst || 0)) { FPSM.worst = gap; FPSM.wjs = FPSM.js || 0; FPSM.wpart = FPSM.part || ''; }
  if (gap > 40) FPSM.spikes = (FPSM.spikes || 0) + 1;
  if (now - FPSM.t >= 1000) { FPSM.el.textContent = Math.round(FPSM.n * 1000 / (now - FPSM.t)) + ' images/s · ' + (save.gfx === 'fast' ? 'fluide' : 'beau') + (PACE.half ? ' · régulier' : '') + ' · pire ' + Math.round(FPSM.worst || 0) + ' ms (jeu ' + Math.round(FPSM.wjs || 0) + ' ms' + (FPSM.wpart ? ' · ' + FPSM.wpart : '') + ') · à-coups ' + (FPSM.spikes || 0) + ' · lots ' + (VB.made || 0) + '/' + (VB.undone || 0) + (state === 'village' ? ' · ombre ' + (SHC.bakes || 0) + ' · dessins ' + (FPSM.calls || 0) + ' · ' + Math.round((FPSM.tris || 0) / 1000) + 'k tri · anim ' + (V.extras ? V.extras.filter(e => !e.culled).length : 0) : ''); SHC.bakes = 0; FPSM.calls = 0; if (state === 'village' && V.ok) try { FPSM.el.textContent += ' ¦ ' + drawBreakdown(); } catch (e) {} FPSM.n = 0; FPSM.t = now; FPSM.worst = 0; FPSM.spikes = 0; }
}
function renderVillage() {
  V.frameN = (V.frameN || 0) + 1;
  batchVillage();
  if (shadowCacheBake()) return;
  // « beau » : ombres à chaque image. Une image sur deux donnait des images alternativement lourdes et légères
  // (saccades), pour la même moyenne (test de performance : 73 img/s dans les deux cas)
  // « beau » : on ne refait les ombres que si le héros a bougé (ou 1 image sur 6). Avant, elles étaient
  // recalculées à CHAQUE image, ce qui coûtait 30-45 ms par seconde sur tablette (mesuré : 91 img/s et
  // 0 à-coup en « fluide » contre 78 img/s et jusqu'a 6 à-coups en « beau »).
  if (V.shEvery || V.frameN % 6 === 1) V.renderer.shadowMap.needsUpdate = true;
  else if (save.gfx !== 'fast') {
    const hp = V.hero && V.hero.position, hr = V.hero && V.hero.rotation;
    if (!hp || hp.x !== V._shx || hp.z !== V._shz || (hr && hr.y !== V._shry)) V.renderer.shadowMap.needsUpdate = true;
    if (hp) { V._shx = hp.x; V._shz = hp.z; }
    if (hr) V._shry = hr.y;
  }
  V.renderer.render(V.scene, V.camera);
  if (save.fps) { const ri = V.renderer.info.render; if (ri.calls > (FPSM.calls || 0)) { FPSM.calls = ri.calls; FPSM.tris = ri.triangles; } }
}
// Ombres du village : tout ce qui ne bouge pas (maisons, arbres, décor…) est dessiné de temps en temps dans une
// « ombre fixe » gardée en mémoire ; ensuite, seuls les personnages et objets animés sont redessinés par-dessus.
// Même image qu'avant, mais l'ombre coûte quelques dizaines de dessins au lieu de plusieurs centaines.
const SHC = { on: null, next: 0, off: [], snap: new Map() };
function shadowCacheInit() {
  const T = THREE, r = V.renderer;
  SHC.on = !!(r.capabilities.isWebGL2 && V.sun && V.sun.castShadow); if (!SHC.on) return;
  const vs = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
  SHC.copyMat = new T.ShaderMaterial({ uniforms: { t: { value: null } }, vertexShader: vs, fragmentShader: 'uniform sampler2D t;varying vec2 vUv;void main(){gl_FragColor=texture2D(t,vUv);}', depthTest: false, depthWrite: false });
  SHC.copyScene = new T.Scene(); const cq = new T.Mesh(new T.PlaneGeometry(2, 2), SHC.copyMat); cq.frustumCulled = false; SHC.copyScene.add(cq); SHC.copyCam = new T.Camera();
  // pendant le calcul des ombres, ce carré recopie l'ombre fixe (couleur et profondeur) dans la carte des ombres
  const quad = new T.Mesh(new T.PlaneGeometry(2, 2), new T.MeshBasicMaterial({ side: T.DoubleSide, colorWrite: false, depthWrite: false }));
  quad.customDepthMaterial = new T.ShaderMaterial({ uniforms: { t: { value: null } }, vertexShader: vs, fragmentShader: '#include <packing>\nuniform sampler2D t;varying vec2 vUv;void main(){vec4 c=texture2D(t,vUv);gl_FragColor=c;gl_FragDepth=unpackRGBAToDepth(c);}' });
  quad.frustumCulled = false; quad.castShadow = false; quad.receiveShadow = false; quad.renderOrder = -1; quad.name = 'ombre fixe';
  V.scene.add(quad); SHC.quad = quad;
}
function shadowCacheRestore() { for (const m of SHC.off) m.castShadow = true; SHC.off.length = 0; if (SHC.quad) SHC.quad.castShadow = false; SHC.next = 0; }
function shadowCacheBake() {
  if (SHC.on === null) shadowCacheInit();
  if (!SHC.on || V.frameN < 3) return false;
  const now = performance.now(), map = V.sun.shadow.map;
  const fresh = map && SHC.rt && SHC.rt.width === map.width;
  if (fresh && now < SHC.next) return false;
  // les petits objets qui apparaissent/disparaissent selon la distance (V.cull) restent toujours « animés »
  // ainsi que tout ce qui est porté par un personnage ou un modèle animé (chapeau, arme, bottes…), même à l'arrêt
  const roam = new Set(), all = g => g.traverse(m => { if (m.isMesh) roam.add(m); });
  if (V.cull) for (const c of V.cull) all(c.o);
  for (const g of [V.hero, V.pet3D, V.homeGoblin, V.builder]) if (g) all(g);
  for (const g of V.scene.children) if (g.userData && (g.userData.quaternius || g.userData.inst || g.userData.warrior || g.userData.legs)) all(g);
  const inScene = o => { for (let p = o; p; p = p.parent) { if (p === V.scene) return true; } return false; };
  const shown = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const same = (o, snap) => { const old = snap.get(o), e = o.matrixWorld.elements; return !!old && old.every((v, i) => v === e[i]); };
  // on ne refait l'ombre fixe que si le décor a vraiment changé : un élément figé a bougé, disparu ou été caché,
  // ou plusieurs nouveaux éléments immobiles sont apparus (bâtiment construit, décoration posée…)
  if (fresh) {
    let dirty = SHC.off.some(m => !inScene(m) || !shown(m) || !same(m, SHC.snap)), still = 0;
    if (!dirty) V.scene.traverse(o => {
      if (!o.isMesh || !o.castShadow || o.isSkinnedMesh || o === SHC.quad || roam.has(o) || !shown(o)) return;
      if (same(o, SHC.snap)) still++; else SHC.snap.set(o, Float64Array.from(o.matrixWorld.elements));
    });
    SHC.next = now + 8000;
    if (!dirty && still < 6) return false;
  }
  const T = THREE, r = V.renderer;
  // 1. ombre complète (tout le monde projette son ombre)
  shadowCacheRestore(); r.shadowMap.needsUpdate = true; r.render(V.scene, V.camera);
  const sm = V.sun.shadow.map; if (!sm) return true;
  if (!SHC.rt || SHC.rt.width !== sm.width) { if (SHC.rt) SHC.rt.dispose(); SHC.rt = new T.WebGLRenderTarget(sm.width, sm.height, { minFilter: T.NearestFilter, magFilter: T.NearestFilter, depthBuffer: false }); }
  // 2. on la garde en mémoire
  const prev = r.getRenderTarget(); SHC.copyMat.uniforms.t.value = sm.texture; r.setRenderTarget(SHC.rt); r.render(SHC.copyScene, SHC.copyCam); r.setRenderTarget(prev);
  SHC.quad.customDepthMaterial.uniforms.t.value = SHC.rt.texture;
  // 3. ce qui n'a pas bougé depuis le dernier passage ne sera plus redessiné dans les ombres
  const snap = new Map();
  V.scene.traverse(o => {
    if (!o.isMesh || !o.castShadow || o.isSkinnedMesh || o === SHC.quad || roam.has(o) || !shown(o)) return;
    const st = same(o, SHC.snap); snap.set(o, Float64Array.from(o.matrixWorld.elements));
    if (st) { o.castShadow = false; SHC.off.push(o); }
  });
  SHC.snap = snap; SHC.quad.castShadow = SHC.off.length > 0; SHC.bakes = (SHC.bakes || 0) + 1;
  SHC.next = now + (SHC.off.length ? 4000 : 1500);
  return true;
}
// Qualité graphique : « Beau » ou « Fluide » (moins de pixels, ombres plus rares)
function gfxPixelRatio() { return save.gfx === 'fast' ? (V.resScale || 1) : Math.min(window.devicePixelRatio || 1, 1.25); }
function applyGfx() {
  shadowCacheRestore();
  $('vGfx').textContent = $('pmGfx').textContent = 'Graphismes : ' + (save.gfx === 'fast' ? 'fluide' : 'beau');
  resize(); if (state === 'candy' && CC.view === 'play') ccResize();
  if (V.ok) {
    V.renderer.setPixelRatio(gfxPixelRatio()); V.renderer.setSize(window.innerWidth, window.innerHeight, false);
    const ms = save.gfx === 'fast' ? 512 : 1024;
    if (V.sun && V.sun.shadow.mapSize.x !== ms) { V.sun.shadow.mapSize.set(ms, ms); if (V.sun.shadow.map) { V.sun.shadow.map.dispose(); V.sun.shadow.map = null; } }
    // en mode fluide, seuls les bâtiments et les personnages projettent une ombre
    if (V.cull) V.cull.forEach(c => c.o.traverse(m => { if (m.isMesh) m.castShadow = save.gfx !== 'fast' && !!m.userData.bigShadow; }));
  }
}
// Si le village rame (moins de ~40 images par seconde pendant 4 s), on passe tout seul en mode fluide
const gfxWatch = { t: 0, n: 0 };
function watchGfx(dt) {
  if (V.bench) return;
  gfxWatch.t += dt; gfxWatch.n++;
  if (gfxWatch.t < (save.gfx === 'fast' ? 2 : 4)) return;
  const avg = gfxWatch.t / gfxWatch.n; gfxWatch.t = gfxWatch.n = 0;
  if (save.gfx !== 'fast') { if (avg > 0.025 && !save.gfxManual) { save.gfx = 'fast'; persist(); applyGfx(); } return; }
  // en mode fluide, la résolution s'adapte toute seule : plus basse si ça rame, plus fine dès que ça va mieux
  // (seulement si ça dure 3 mesures de suite : chaque changement de résolution provoque lui-même un à-coup)
  const r = V.resScale || 1, want = avg > 0.024 ? -1 : avg < 0.016 ? 1 : 0;
  gfxWatch.dir = want && want === gfxWatch.lastDir ? (gfxWatch.dir || 0) + 1 : 0; gfxWatch.lastDir = want;
  if (gfxWatch.dir < 2) return; gfxWatch.dir = 0;
  const nr = want < 0 ? Math.max(0.6, r - 0.1) : Math.min(1, r + 0.1);
  // on change juste la taille de l'image (pas tout le réglage graphique, qui reparcourt tout le décor)
  if (Math.abs(nr - r) > 0.01) { V.resScale = nr; V.renderer.setPixelRatio(gfxPixelRatio()); V.renderer.setSize(window.innerWidth, window.innerHeight, false); }
}

function finishBuild() {
  const id = save.build.id;
  if (id === 'mine') collectMine(true);
  save.b[id] = lvl(id) + 1; save.build = null; persist();
  buildBuilding(id);
  banner(BUILD[id].name, 'Niveau ' + lvl(id) + ' !');
  sfx('level');
  renderPanel(); updateVhud();
}
function startBuild(id) {
  const ck = canUpgrade(id); if (!ck.ok) return;
  const l = lvl(id);
  if (id === 'mine') collectMine(true);
  save.coins -= BUILD[id].cost[l + 1];
  save.build = { id, end: Date.now() + BUILD[id].time[l + 1] * 1000 };
  persist(); sfx('coin');
  refreshScaffold(id); refreshLabel(id); renderPanel(); updateVhud();
}
const rushCost = () => save.build ? Math.max(1, Math.ceil((save.build.end - Date.now()) / 1000 / 30)) : 0;
function rushBuild() {
  const c = rushCost(); if (!save.build || save.gems < c) return;
  save.gems -= c; save.build.end = Date.now(); persist();
  finishBuild();
}
function collectMine(silent) {
  const n = mineStock();
  save.mineLast = Date.now();
  if (n > 0) { save.coins += n; if (!silent) { sfx('coin'); banner('', '+' + n + ' pièces'); } }
  persist(); refreshBubble(); updateVhud();
}

// Panneau du bâtiment proche
function renderPanel() {
  if(visitingVillage){
    const panel=$('vpanel');panel.replaceChildren();const p=document.createElement('p');p.textContent='Village de ton ami · lecture seule';panel.appendChild(p);
    if(V.inside||V.near==='maison'){const b=document.createElement('button');b.className='btn';b.textContent=V.inside?'Sortir de la maison':'Visiter la maison';b.onclick=()=>V.inside?exitHome():enterHome();panel.appendChild(b);}
    if(V.near==='tessa'){const b=document.createElement('button');b.className='btn';b.textContent='Parler à Tessa';b.onclick=talkTessa;panel.appendChild(b);}
    panel.hidden=false;return;
  }
  if (V.inside) { if (V.inside === 'bunker') renderBunkerPanel(); else renderHomePanel(); return; }
  const el = $('vpanel'), id = V.near;
  $('vhint').hidden = !!id;
  if (!id) { if (!el.hidden) { el.hidden = true; el.dataset.id = ''; } return; }
  if (id === 'trappe') { const html = hatchPanelHtml(); if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; } el.hidden = false; return; }
  if (id === 'sorciere') { const html = `<div class="vp-head"><h3>La sorcière</h3></div><p class="vp-desc">Elle couve trois œufs mystérieux… et fait grandir tes familiers, contre quelques pièces.</p><div class="vp-btns"><button class="btn big-ish" data-act="witch">Parler à la sorcière</button></div>`; if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; } el.hidden = false; return; }
  if(id==='tessa'){el.replaceChildren();const title=document.createElement('h3'),button=document.createElement('button');title.textContent='Tessa, gobelin libre';button.textContent='Parler à Tessa';button.className='btn';button.onclick=talkTessa;el.append(title,button);el.dataset.html='';el.hidden=false;return;}
  const B = BUILD[id], l = lvl(id), building = save.build && save.build.id === id;
  let html = `<div class="vp-head"><h3>${B.name}</h3>${B.max > 1 ? `<span class="lvl-badge">Niv. ${l}${l >= B.max ? ' · max' : ''}</span>` : ''}</div><p class="vp-desc">${B.desc}</p>`;
  if (B.max > 1) {
    html += `<div class="vp-cols"><div class="vp-box"><b>Maintenant</b><ul>${bonus(id, l).map(t => `<li>${t}</li>`).join('')}</ul></div>`;
    html += l < B.max ? `<div class="vp-box next"><b>Niveau ${l + 1}</b><ul>${bonus(id, l + 1).map(t => `<li>${t}</li>`).join('')}</ul></div></div>` : `<div class="vp-box"><b>Niveau max</b><ul><li>Bâtiment au top</li></ul></div></div>`;
  }
  const btns = [];
  if (id === 'portail') btns.push(`<button class="btn big-ish" data-act="portal">Entrer dans le portail</button>`);
  if (id === 'mine') { const n = mineStock(); btns.push(`<button class="btn" data-act="collect" ${n ? '' : 'disabled'}><i class="coin"></i>Récolter <span id="vpMine"></span></button>`); }
  if (id === 'caserne') btns.push(`<button class="btn alt" data-act="classes">Choisir la classe</button>`);
  if (id === 'caserne' && save.tribeSwap) btns.push(`<button class="btn alt" data-act="tribe">Changer de tribu</button>`);
  if ((id === 'forge' || id === 'labo') && jobsOn()) btns.push(`<button class="btn" data-act="jobs">Métiers</button>`);
  if (id === 'garde') btns.push(`<button class="btn big-ish" data-act="skins">Ouvrir la garde-robe</button>`);
  if (id === 'labo') btns.push(`<button class="btn big-ish" data-act="pets">Familiers</button>`);
  if (id === 'armurerie') btns.push(`<button class="btn big-ish" data-act="guns">Boutique d’armes</button>`);
  if (id === 'maison') btns.push(`<button class="btn big-ish" data-act="enter">Entrer chez moi</button>`);
  let why = '';
  if (building) {
    const left = (save.build.end - Date.now()) / 1000, rc = rushCost();
    html += `<div class="vp-prog"><div class="meter"><div class="fill" id="vpFill" style="background:linear-gradient(180deg,#ffe066,#ff8a1f)"></div><div class="lbl"><span>Construction</span><span id="vpTime"></span></div></div></div>`;
    btns.push(`<button class="btn pink" data-act="rush" ${save.gems >= rc ? '' : 'disabled'}>Finir maintenant · <i class="gem"></i><span id="vpRush"></span></button>`);
  } else if (l < B.max) {
    const ck = canUpgrade(id);
    btns.push(`<button class="btn" data-act="up" ${ck.ok ? '' : 'disabled'}>Améliorer · <i class="coin"></i>${B.cost[l + 1]} · ${fmtTime(B.time[l + 1])}</button>`);
    why = ck.ok ? '' : ck.why;
  }
  html += `<div class="vp-btns">${btns.join('')}</div>${why ? `<p class="vp-why">${why}</p>` : ''}`;
  // On ne reconstruit le panneau que si son contenu change (sinon un bouton pourrait disparaître sous le doigt)
  if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
  if (building) {
    const left = (save.build.end - Date.now()) / 1000;
    $('vpFill').style.width = (clamp(1 - left / B.time[l + 1], 0, 1) * 100).toFixed(1) + '%';
    $('vpTime').textContent = fmtTime(left);
    $('vpRush').textContent = rushCost();
  }
  if (id === 'mine') $('vpMine').textContent = mineStock();
  el.hidden = false;
}
$('vpanel').addEventListener('click', e => {
  if(visitingVillage)return;
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const id = V.near, act = b.dataset.act;
  if (V.inside) { if (V.inside === 'bunker') bunkerAction(act); else homeAction(act); return; }
  if (act === 'hatch') { tryHatch(); return; }
  if (act === 'enter') { resetVjoy(); enterHome(); return; }
  if (act === 'up') startBuild(id);
  else if (act === 'rush') rushBuild();
  else if (act === 'collect') collectMine(false);
  else if (act === 'classes') openModal('classesM');
  else if (act === 'tribe') openTribePicker(true);
  else if (act === 'buymount') { const mid = b.dataset.mount, M = MOUNTS[mid]; if (M && save.coins >= M.price && !(save.mounts && save.mounts[mid])) { save.coins -= M.price; save.mounts = save.mounts || {}; save.mounts[mid] = true; save.mount = mid; sfx('coin'); persist(); updateVhud(); banner(M.name, 'Ta monture t’attend : tu vas bien plus vite au village !'); } renderPanel(); }
  else if (act === 'ride') { const mid = b.dataset.mount; save.mount = save.mount === mid ? null : mid; persist(); if (!save.mount) resetPose(); renderPanel(); }
  else if (act === 'jobs') openJobs(id === 'labo' ? 'alch' : 'forge');
  else if (act === 'skins') openShop('look', 'Garde-robe');
  else if (act === 'pets') openShop('pet', 'Animalerie');
  else if (act === 'guns') openShop('weapon', 'Armurerie');
  else if (act === 'portal') openModal('portalM');
  else if (act === 'witch') openModal('witchM');
});
function updateVhud() {
  setText('vCoins', fmtCoins());
  setText('vGems', fmtGems());
  $('vTest').textContent = 'Mode test : ' + (save.testMode ? 'oui' : 'non'); $('vTest').classList.toggle('on', !!save.testMode);
  setText('vHdv', (visitingVillage?'Village visité · ':'')+'Hôtel de ville niv. ' + lvl('hdv'));
  setText('vBuilder', save.build ? 'Ouvrier : ' + BUILD[save.build.id].name + ' · ' + fmtTime((save.build.end - Date.now()) / 1000) : 'Ouvrier disponible');
  $('vBuilderChip').classList.toggle('busy', !!save.build);
}

// Fenêtres du village
function anyModalOpen() { if(!$('tutorialM').hidden)return true; if(document.activeElement?.matches('input,textarea')||$('friendChat').open||!$('coopM').hidden)return true; return ['patchM','dungeonIntro','dungeonReport','dungeonClear','setM', 'classesM', 'skinsM', 'portalM', 'decoM', 'chestM', 'witchM'].some(id => !$(id).hidden); }
function openModal(id) {
  if(visitingVillage&&!['setM'].includes(id)){banner('Village de ton ami','Visite en lecture seule. Quitte la session pour retrouver ton village.');return;}
  resetVjoy();
  if (id === 'classesM') { renderClasses(); classTitle(false); }
  if (id === 'skinsM') renderSkins();
  if (id === 'portalM') renderPortal();
  if (id === 'decoM') renderDeco();
  if (id === 'witchM') { WITCH.tab = 'eggs'; WITCH.res = null; renderWitch(); }
  $(id).hidden = false;
}
document.addEventListener('click', e => { const c = e.target.closest('[data-close]'); if (c) c.closest('.modal').hidden = true; });
$('tribeList').addEventListener('click', e => { const b=e.target.closest('[data-tribe]'); if(b)chooseTribe(b.dataset.tribe); });
$('vSet').addEventListener('click', () => { renderSettings(); openModal('setM'); });
$('setList').addEventListener('click', e => {
  if (e.target.closest('[data-devmode]')) { devOpen = !devOpen; renderSettings(); return; }
  const db = e.target.closest('[data-devboss]'); if (db) { $('setM').hidden = true; startGame(); const i = +db.dataset.devboss; setTimeout(() => { if (!G || !G.p) return; G.devTest = true; G.wave = Math.max(G.wave, 25); G.zombies.length = 0; G.toSpawn = 0; G.p.maxHp = G.p.hp = G.p.maxHp * 30; spawnZombie('boss', clamp(G.p.x + 620, 40, WORLD - 40), G.p.y, i); }, 1500);   /* force d'un boss de la vague 25, loin devant */ return; }
  if (e.target.closest('[data-testmode]')) { e.preventDefault(); $('setM').hidden = true; $('vTest').click(); return; }
  if(e.target.closest('[data-updates]')) { if(window.BastionAndroid) BastionAndroid.openUpdates(); else window.open('https://github.com/downloadall29-spec/Tiktok/releases/tag/apk-latest','_blank','noopener'); return; }
  const z = e.target.closest('[data-uiz]'); if (z) { e.preventDefault(); try { localStorage.setItem('dernier-bastion-uiz', z.dataset.uiz); } catch (err) {} applyUI(); renderSettings(); return; }
  const t = e.target.closest('[data-set]'); if (t) { e.preventDefault(); save[t.dataset.set] = !save[t.dataset.set]; persist(); renderSettings(); if (t.dataset.set === 'fps' && FPSM.el) { FPSM.el.remove(); FPSM.el = null; FPSM.t = 0; FPSM.n = 0; } if (t.dataset.set === 'raids') { V.raidT = undefined; if (!save.raids) $('raidAlert').hidden = true; } return; }
  if(e.target.closest('[data-appearance]')){ $('setM').hidden=true;openTribePicker(true,true); }
  if (e.target.closest('[data-retribe]')) { $('setM').hidden = true; openTribePicker(true); }
  if (e.target.closest('[data-notes]')) { $('setM').hidden = true; openNotes(); }
  if (e.target.closest('[data-slots]')) { $('setM').hidden = true; persist(); openSlotMenu(true); }
  if (e.target.closest('[data-jobs]')) { $('setM').hidden = true; openJobs(); }
});
$('setList').addEventListener('change', e => {
  if (e.target.id === 'setName') { save.name = e.target.value.trim().slice(0, 16) || heroName(Object.assign({}, save, { name: '' })); persist(); }
});
$('smSlots').addEventListener('click', e => {
  const d = e.target.closest('[data-del]'); if (d) { deleteSlot(+d.dataset.del); return; }
  const b = e.target.closest('[data-slot]'); if (b && !$('slotMenu').classList.contains('wait')) pickSlot(+b.dataset.slot);
});
$('smBack').addEventListener('click', () => { $('slotMenu').hidden = true; });
$('tribeX').addEventListener('click', () => { SM.create = 0; });
$('jobsTabs').addEventListener('click', e => { const b = e.target.closest('[data-jtab]'); if (b) { jobsTab = b.dataset.jtab; renderJobs(); } });
$('jobsBody').addEventListener('click', e => {
  const c = e.target.closest('[data-craft]'); if (c && !c.disabled) craftGear(c.dataset.craft);
  const b = e.target.closest('[data-brew]'); if (b && !b.disabled) brewPotion(b.dataset.brew);
});
$('raidGo').addEventListener('click', () => { $('raidAlert').hidden = true; resetVjoy(); startGame(); });
$('raidNo').addEventListener('click', () => { $('raidAlert').hidden = true; });
function renderClasses() {
  const C = lvl('caserne'), maxS = { hp: 130, speed: 150, dmg: 13, rate: 5.5 };
  $('classList').innerHTML = Object.entries(CLASSES).map(([id, c]) => {
    const owned = c.req <= C;
    const bars = [['PV', c.hp / maxS.hp], ['Dégâts', c.dmg / maxS.dmg], ['Cadence', c.rate / maxS.rate], ['Vitesse', c.speed / maxS.speed]]
      .map(([n, v]) => `<span>${n}</span><span class="bar"><i style="width:${Math.round(v * 100)}%"></i></span>`).join('');
    return `<button class="cls${save.cls === id ? ' sel' : ''}" data-cls="${id}" aria-pressed="${save.cls === id}">
      <canvas class="hero" width="144" height="144" data-hero="${id}"></canvas>
      <span class="name">${c.name}</span>
      <span class="ult">Ultime : ${c.ult}</span>
      <span class="desc">${c.desc}</span>
      <span class="stats">${bars}</span>
      ${owned ? '' : `<span class="lock"><b>Verrouillé</b><span>Caserne niveau ${c.req}</span></span>`}
    </button>`;
  }).join('');
  document.querySelectorAll('#classList [data-hero]').forEach(c => snapHero(c, save.skin, CLASSES[c.dataset.hero].color));
}
$('classList').addEventListener('click', e => {
  const card = e.target.closest('[data-cls]');
  if (card && CLASSES[card.dataset.cls].req <= lvl('caserne')) { save.cls = card.dataset.cls; persist(); renderClasses(); rebuildHero(); }
});
// ---------- Cabine d'essayage (aperçu 3D dans la boutique) ----------
let PREVIEW = null, previewBuild = false;
const PV = { r: null, yaw: 0.6, target: 0.6, drag: null, t: 0, spin: 0 };
function resetPreview() {
  PREVIEW = { skin: save.skin, wskin: save.wskin, weapon: save.weapon, gear: Object.assign({}, save.gear), cosm: Object.assign({}, save.cosm), colors: Object.assign({}, save.colors), pet: save.pet, focus: null };
}
function initPreview() {
  if (PV.r || !window.THREE) return;
  try {
    const T = THREE, cv = $('pvCanvas');
    PV.r = oldLook(new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }));
    PV.r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    PV.scene = new T.Scene();
    PV.scene.add(new T.HemisphereLight('#fffaf0', '#6d5a8a', 0.7));
    const d = new T.DirectionalLight('#fff0d0', 0.85); d.position.set(3, 6, 5); PV.scene.add(d);
    PV.cam = new T.PerspectiveCamera(30, 0.75, 0.1, 50);
    PV.base = new T.Group(); PV.scene.add(PV.base);
    mk(new T.CylinderGeometry(1.3, 1.42, 0.28, 36), mat('#8a5634', { tex: 'wood', rep: [4, 0.5] }), 0, -0.14, 0, PV.base);
    mk(new T.CylinderGeometry(1.36, 1.36, 0.06, 36), '#c9a06a', 0, 0.02, 0, PV.base);
    const rim = mk(new T.TorusGeometry(1.36, 0.05, 8, 48), '#ffd23f', 0, 0.04, 0, PV.base, { emissive: '#4a3a00' }); rim.rotation.x = Math.PI / 2;
    PV.pet = null;
    cv.addEventListener('pointerdown', e => { PV.drag = e.clientX; try { cv.setPointerCapture(e.pointerId); } catch (err) {} });
    cv.addEventListener('pointermove', e => { if (PV.drag !== null) { PV.yaw += (e.clientX - PV.drag) * 0.012; PV.target = PV.yaw; PV.drag = e.clientX; } });
    const up = () => { PV.drag = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  } catch (e) { PV.r = null; }
}
function rebuildPreview() {
  if (!PV.r) return;
  if (PV.hero) {PV.base.remove(PV.hero);if(PV.hero.userData.quaternius)CharacterModels.dispose(PV.hero);}
  previewBuild = true;
  try { PV.hero = buildHero3D(PREVIEW.skin, CLASSES[save.cls].color); } finally { previewBuild = false; }
  PV.hero.position.y = 0.05; PV.base.add(PV.hero);
  const pk = PREVIEW.pet + (PREVIEW.pet === 'dragon' ? save.dragonCol : '');
  if (PV.petKey !== pk) {
    if (PV.pet) PV.base.remove(PV.pet);
    PV.pet = PETS[PREVIEW.pet] ? buildPet3D(PREVIEW.pet) : null; PV.petKey = pk;
    if (PV.pet) { PV.pet.position.set(1.0, 0.6, 0.45); PV.pet.rotation.y = -0.25; PV.base.add(PV.pet); }
  }
  updatePvPanel();
}
function renderPreview(dt) {
  if (!PV.r || $('skinsM').hidden) return;
  const cv = $('pvCanvas'), w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  if (cv.width !== Math.round(w * PV.r.getPixelRatio())) { PV.r.setSize(w, h, false); PV.cam.aspect = w / h; PV.cam.updateProjectionMatrix(); }
  PV.t += dt;
  // Le héros ne tourne plus tout seul : flèches (un appui = un quart de tour, appui long = tourne en continu) ou glisser du doigt
  if (PV.spin) PV.target += PV.spin * dt * 2.2;
  if (PV.drag === null) PV.yaw += (PV.target - PV.yaw) * Math.min(1, dt * 8);
  PV.base.rotation.y = PV.yaw;
  PV.cam.position.set(0, 2.2, 8.2); PV.cam.lookAt(0, 1.25, 0);
  if (PV.hero) animHero(PV.hero, 0, false, dt);
  if (PV.pet) { PV.pet.position.y = (PV.pet.userData.fly ? 1.35 : 0.6) + Math.sin(PV.t * 2.5) * 0.08; animPet3D(PV.pet, PV.t, PV.pet.userData.fly); }
  PV.r.render(PV.scene, PV.cam);
}
// Ce qui est essayé : un objet à la fois mis en avant, avec son bouton d'achat ou d'équipement
function focusInfo() {
  const f = PREVIEW && PREVIEW.focus; if (!f) return null;
  if (f.kind === 'skin') { const k = SKINS[f.id]; return { name: 'Tenue · ' + k.name, owned: save.skins[f.id], on: save.skin === f.id, price: k.price }; }
  if (f.kind === 'weapon') { const W = WEAPONS[f.id]; return { name: 'Arme · ' + W.name, owned: save.weapons[f.id], on: save.weapon === f.id, price: W.price, sub: weaponLines(W).join(' · ') }; }
  if (f.kind === 'wskin') { const k = WSKINS[f.id]; return { name: 'Arme · ' + k.name, owned: save.wskins[f.id], on: save.wskin === f.id, price: k.price }; }
  if (f.kind === 'gear') { const k = ITEMS[f.id]; return { name: k.name, owned: save.items[f.id], on: save.gear[k.slot] === f.id, price: k.price, sub: statLines(k.stats).join(' · ') }; }
  if (f.kind === 'pet') { const k = PETS[f.id]; return { name: 'Familier · ' + k.name, owned: save.pets[f.id], on: save.pet === f.id, price: k.price, sub: k.skill + ' : ' + k.desc }; }
  if (f.kind === 'cosm') { const k = COSM[f.id]; return { name: 'Objivant · ' + k.name, owned: save.cosmOwned[f.id], on: save.cosm[k.slot] === f.id, price: k.price, sub: 'Cosmétique : ton équipement garde ses bonus' }; }
  if (f.kind === 'color') return { name: 'Couleurs du héros', owned: true, on: false, price: 0, sub: 'Gratuit' };
  return null;
}
const SHOP_TABLES = { skin: [SKINS, 'skins'], wskin: [WSKINS, 'wskins'], weapon: [WEAPONS, 'weapons'], gear: [ITEMS, 'items'], pet: [PETS, 'pets'], cosm: [COSM, 'cosmOwned'], colors: [{}, 'colors'] };
// Différences entre l'essai et ce qui est vraiment équipé
function previewDiff() {
  const d = []; if (!PREVIEW) return d;
  if (PREVIEW.skin !== save.skin) d.push(['skin', PREVIEW.skin]);
  if (PREVIEW.wskin !== save.wskin) d.push(['wskin', PREVIEW.wskin]);
  if ((PREVIEW.weapon || 'standard') !== save.weapon) d.push(['weapon', PREVIEW.weapon || 'standard']);
  for (const [slot] of SLOTS) if ((PREVIEW.gear[slot] || null) !== (save.gear[slot] || null)) d.push(['gear', PREVIEW.gear[slot] || null, slot]);
  if ((PREVIEW.pet || null) !== (save.pet || null)) d.push(['pet', PREVIEW.pet || null]);
  for (const [slot] of SLOTS) if ((PREVIEW.cosm[slot] || null) !== (save.cosm[slot] || null)) d.push(['cosm', PREVIEW.cosm[slot] || null, slot]);
  if (JSON.stringify(PREVIEW.colors) !== JSON.stringify(save.colors)) d.push(['colors', null]);
  return d;
}
function diffCost(d) {
  let c = 0;
  for (const [k, id] of d) if (id && !save[SHOP_TABLES[k][1]][id]) c += SHOP_TABLES[k][0][id].price;
  return c;
}
function updatePvPanel() {
  const fi = focusInfo(), act = $('pvAct'), d = previewDiff(), cost = diffCost(d);
  $('pvName').textContent = fi ? fi.name : 'Ton héros';
  $('pvSub').textContent = d.length ? d.length + (d.length > 1 ? ' changements' : ' changement') + ' à valider' + (cost ? ' (achat compris)' : '') : (fi ? (fi.sub || 'Déjà équipé') : 'Touche un objet pour l\u2019essayer');
  act.hidden = !d.length;
  $('pvReset').hidden = !d.length;
  act.disabled = save.coins < cost;
  act.innerHTML = cost ? `Valider · <i class="coin"></i>${cost}` : 'Valider';
}
function applyPreview() {
  const d = previewDiff(), cost = diffCost(d);
  if (!d.length || save.coins < cost) return;
  if (jobsOn() && d.some(([k, id]) => k === 'gear' && id && !save.items[id])) { banner('', 'Avec les métiers, cet équipement se fabrique chez le Forgeron'); return; }
  for (const [k, id, slot] of d) {
    if (id && !save[SHOP_TABLES[k][1]][id]) { save.coins -= SHOP_TABLES[k][0][id].price; save[SHOP_TABLES[k][1]][id] = true; }
    if (k === 'skin') save.skin = id; else if (k === 'wskin') save.wskin = id; else if (k === 'weapon') save.weapon = id; else if (k === 'gear') save.gear[slot] = id;
    else if (k === 'cosm') save.cosm[slot] = id; else if (k === 'colors') save.colors = Object.assign({}, PREVIEW.colors); else save.pet = id;
  }
  sfx(cost ? 'coin' : 'level');
  persist(); renderSkins(); rebuildHero(); refreshPetSprite(); updateVhud(); rebuildPreview();
  prepHeroLater();
  banner('', 'Changement validé !');
}
function tryOn(kind, id) {
  if (!PREVIEW) resetPreview();
  if (kind === 'skin') PREVIEW.skin = id;
  else if (kind === 'wskin') PREVIEW.wskin = id;
  else if (kind === 'weapon') PREVIEW.weapon = id;
  else if (kind === 'gear') PREVIEW.gear[ITEMS[id].slot] = id;
  else if (kind === 'pet') PREVIEW.pet = id;
  else if (kind === 'cosm') { const s = COSM[id].slot; PREVIEW.cosm[s] = PREVIEW.cosm[s] === id ? null : id; }
  PREVIEW.focus = { kind, id };
  rebuildPreview(); markTried();
}
function markTried() {
  document.querySelectorAll('#skinsM .tried').forEach(el => el.classList.remove('tried'));
  const f = PREVIEW && PREVIEW.focus; if (!f) return;
  const sel = { skin: `[data-skin="${f.id}"]`, wskin: `[data-wskin="${f.id}"]`, weapon: `[data-weaponcard="${f.id}"]`, gear: `[data-gearcard="${f.id}"]`, pet: `[data-petcard="${f.id}"]`, cosm: `[data-cosmcard="${f.id}"]` }[f.kind];
  if (!sel) return;
  const el = document.querySelector('#skinsM ' + sel); if (el) el.classList.add('tried');
}
// Acheter si besoin, puis équiper
function shopAction(kind, id, toggle) {
  const table = SHOP_TABLES[kind];
  const k = table[0][id], owned = save[table[1]];
  if (!owned[id] && kind === 'gear' && jobsOn()) { banner('', 'Avec les métiers, cet équipement se fabrique chez le Forgeron'); return; }
  if (!owned[id]) { if (save.coins < k.price) return; save.coins -= k.price; owned[id] = true; sfx('coin'); }
  else if (!toggle) { /* déjà acheté : on équipe */ }
  if (kind === 'skin') save.skin = id;
  else if (kind === 'wskin') save.wskin = id;
  else if (kind === 'weapon') save.weapon = id;
  else if (kind === 'gear') save.gear[k.slot] = toggle && save.gear[k.slot] === id ? null : id;
  else if (kind === 'pet') save.pet = toggle && save.pet === id ? null : id;
  else if (kind === 'cosm') save.cosm[k.slot] = toggle && save.cosm[k.slot] === id ? null : id;
  persist(); renderSkins(); rebuildHero(); refreshPetSprite(); updateVhud(); prepHeroLater();
  if (PREVIEW) {
    // On garde les autres essais en cours, seul l'objet acheté ou équipé suit la sauvegarde
    if (kind === 'skin') PREVIEW.skin = save.skin;
    else if (kind === 'wskin') PREVIEW.wskin = save.wskin;
    else if (kind === 'weapon') PREVIEW.weapon = save.weapon;
    else if (kind === 'gear') PREVIEW.gear[k.slot] = save.gear[k.slot];
    else if (kind === 'cosm') PREVIEW.cosm[k.slot] = save.cosm[k.slot];
    else PREVIEW.pet = save.pet;
    PREVIEW.focus = { kind, id };
    rebuildPreview(); markTried();
  }
}

// Photo de face du héros en 3D, pour les vignettes (mise en cache)
const snapCache = {};
function snapHero(cnv, skinId, clsColor, noGear) {
  initPreview();
  if (!PV.r) { paintHero(cnv, skinId, clsColor); return; }
  const key = [JSON.stringify(save.appearance),skinId, clsColor, noGear ? '' : JSON.stringify(save.gear) + JSON.stringify(save.cosm), JSON.stringify(save.colors), save.wskin, save.weapon, cnv.width, tribeId() && MODELS.w_viking ? tribeId() : ''].join('|');
  let img = snapCache[key];
  if (!img) {
    const T = THREE, size = cnv.width;
    if (!PV.snap) {
      PV.snap = { scene: new T.Scene(), cam: new T.PerspectiveCamera(26, 1, 0.1, 50) };
      PV.snap.scene.add(new T.HemisphereLight('#fffaf0', '#6d5a8a', 0.75));
      const dl = new T.DirectionalLight('#fff0d0', 0.85); dl.position.set(3, 5, 6); PV.snap.scene.add(dl);
    }
    const SN = PV.snap;
    if (SN.hero) { SN.scene.remove(SN.hero); if(SN.hero.userData.quaternius)CharacterModels.dispose(SN.hero);else SN.hero.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    gearOff = !!noGear;
    try { SN.hero = buildHero3D(skinId, clsColor); } finally { gearOff = false; }
    SN.hero.rotation.y = 0.45; SN.scene.add(SN.hero);
    SN.cam.position.set(0, 1.35, 5.7); SN.cam.lookAt(0, 1.22, 0);
    const pr = PV.r.getPixelRatio(), prev = PV.r.getSize(new T.Vector2());
    PV.r.setPixelRatio(1); PV.r.setSize(size, size, false);
    PV.r.render(SN.scene, SN.cam);
    img = document.createElement('canvas'); img.width = img.height = size;
    img.getContext('2d').drawImage(PV.r.domElement, 0, 0, size, size);
    PV.r.setPixelRatio(pr); PV.r.setSize(prev.x || 1, prev.y || 1, false);
    snapCache[key] = img;
  }
  const g = cnv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cnv.width, cnv.height); g.drawImage(img, 0, 0);
}
function renderSkins() {
  $('skinCoins').textContent = fmtCoins(); $('skinGems').textContent = fmtGems();
  renderLook();
  renderCosm();
  renderGear();
  renderPets();
  $('weaponList').innerHTML = `<p class="cosmnote">Chaque arme tire à sa façon. Les skins d’armes (onglet suivant) changent seulement leurs couleurs.</p><div class="gitems">` + Object.entries(WEAPONS).map(([id, W]) => {
    const owned = save.weapons[id], on = save.weapon === id;
    const btn = on ? `<button class="btn alt" disabled>Équipée</button>` : owned ? `<button class="btn" data-weapon="${id}">Équiper</button>`
      : `<button class="btn" data-weapon="${id}" ${save.coins >= W.price ? '' : 'disabled'}>Acheter · <i class="coin"></i>${W.price}</button>`;
    return `<div class="gitem ${RAR[W.rar].cls}${on ? ' on' : ''}" data-weaponcard="${id}"><canvas width="320" height="200" data-weaponprev="${id}"></canvas>
      <span class="row"><span class="sn">${W.name}</span><span class="rar">${W.rar}</span></span>
      <ul><li>${W.desc}</li>${weaponLines(W).map(t => `<li>${t}</li>`).join('')}</ul>${btn}</div>`;
  }).join('') + '</div>';
  document.querySelectorAll('[data-weaponprev]').forEach(c => { const id = c.dataset.weaponprev; if (id === 'standard') paintGun(c, 'standard'); else snapObj(c, 'gun:' + id + ':standard', () => weaponMesh(id, 'standard'), 0.35); });
  $('wskinList').innerHTML = `<p class="cosmnote" style="grid-column:1/-1">Les skins changent les couleurs de ton arme (et la couleur des tirs), sans changer sa façon de tirer.</p>` + Object.entries(WSKINS).map(([id, k]) => {
    const owned = save.wskins[id], sel = save.wskin === id;
    const tag = sel ? 'Équipée' : owned ? 'Équiper' : `<i class="coin"></i>${k.price}`;
    return `<button class="wskin ${RAR[k.rar].cls}${sel ? ' sel' : ''}${owned ? '' : ' locked'}" data-wskin="${id}" aria-pressed="${sel}">
      <canvas width="480" height="220" data-gunprev="${id}"></canvas>
      <span class="row"><span class="sn">${k.name}</span><span class="rar">${k.rar}</span></span>
      <span class="sp${!owned && save.coins >= k.price ? ' can' : ''}">${tag}</span></button>`;
  }).join('');
  document.querySelectorAll('[data-gunprev]').forEach(c => { const sk = c.dataset.gunprev, w = save.weapon; if (w === 'standard' || !WEAPONS[w]) paintGun(c, sk); else snapObj(c, 'gun:' + w + ':' + sk, () => weaponMesh(w, sk), 0.35); });
  markTried();
}
// Apparence : 5 couleurs à choisir, comme dans Dofus (gratuit, on valide avec le bouton de l'aperçu)
function renderLook() {
  const cur = (PREVIEW && PREVIEW.colors) || save.colors;
  if (tribeId() && TRIBES[tribeId()].kay) {
    $('skinList').innerHTML = `<p class="lookbox">Ton héros est ${TRIBES[tribeId()].name === 'Voleuse' ? 'une' : 'un'} ${TRIBES[tribeId()].name}. Tu peux changer de personnage à tout moment : ta progression est gardée.</p><div class="row-btns"><button class="btn alt" data-retribe>Changer de personnage</button></div>`;
    return;
  }
  if (tribeId()) {
    const tc = TRIBE_COLS[cur.tribe] ? cur.tribe : 'red';
    $('skinList').innerHTML = `<p class="lookbox">Ton héros est un ${TRIBES[tribeId()].name}. Choisis la couleur de ta tribu et de tes cheveux, puis touche « Valider » sous l’aperçu.</p><section class="colrow"><h3>Couleur de la tribu</h3><div class="sw">` +
      Object.entries(TRIBE_COLS).map(([k, [n, hex]]) => `<button class="swatch${tc === k ? ' sel' : ''}" data-col="tribe" data-hex="${k}" style="background:${hex}" aria-label="${n}"></button>`).join('') + '</div></section>' +
      COLOR_SLOTS.filter(([slot]) => slot === 'hair').map(([slot, title, pal]) => `<section class="colrow"><h3>${title}</h3><div class="sw">` +
        pal.map(c => `<button class="swatch${cur[slot] === c ? ' sel' : ''}" data-col="${slot}" data-hex="${c}" style="background:${c}" aria-label="${title} ${c}"></button>`).join('') + '</div></section>').join('') +
      '<section class="colrow"><h3>Nouveaux personnages</h3><p>Chevalier, Barbare, Mage, Voleuse ou Rôdeur : ta progression est gardée.</p><div class="row-btns"><button class="btn alt" data-retribe>Changer de personnage</button></div></section>';
    return;
  }
  $('skinList').innerHTML = `<p class="lookbox">Choisis les couleurs de ton héros. C’est gratuit : essaie, puis touche « Valider » sous l’aperçu.</p>` +
    COLOR_SLOTS.map(([slot, title, pal]) => `<section class="colrow"><h3>${title}</h3><div class="sw">` +
      pal.map(c => `<button class="swatch${cur[slot] === c ? ' sel' : ''}" data-col="${slot}" data-hex="${c}" style="background:${c}" aria-label="${title} ${c}"></button>`).join('') + '</div></section>').join('') +
    `<div><button class="btn alt" data-colreset>Couleurs de base</button></div>`;
}
// Objivants : 10 chapeaux, 10 capes, 10 bottes, portés par-dessus l'équipement
function renderCosm() {
  let html = `<p class="cosmnote">Les objivants changent seulement l’apparence : ton équipement garde tous ses bonus. Retire un objivant pour revoir ton équipement.</p>`;
  for (const [slot, title] of SLOTS) {
    html += `<section class="gsec"><h3>${title} <small>objivants</small></h3><div class="gitems">` + Object.entries(COSM).filter(([, it]) => it.slot === slot).map(([id, it]) => {
      const owned = save.cosmOwned[id], on = save.cosm[slot] === id;
      const btn = on ? `<button class="btn alt" data-cosm="${id}">Retirer</button>` : owned ? `<button class="btn" data-cosm="${id}">Porter</button>`
        : `<button class="btn" data-cosm="${id}" ${save.coins >= it.price ? '' : 'disabled'}>Acheter · <i class="coin"></i>${it.price}</button>`;
      return `<div class="gitem cosmc${on ? ' on' : ''}" data-cosmcard="${id}"><canvas width="240" height="180" data-cosmprev="${id}"></canvas>
        <span class="row"><span class="sn">${it.name}</span><span class="rar">objivant</span></span>${btn}</div>`;
    }).join('') + '</div></section>';
  }
  $('cosmList').innerHTML = html;
  document.querySelectorAll('[data-cosmprev]').forEach(c => snapCosm(c, c.dataset.cosmprev));
}
function setShopTab(tab) {
  document.querySelectorAll('#skinsM .tab').forEach(b => b.classList.toggle('sel', b.dataset.tab === tab));
  $('petList').hidden = tab !== 'pet';
  $('gearList').hidden = tab !== 'gear'; $('skinList').hidden = tab !== 'look'; $('cosmList').hidden = tab !== 'cosm'; $('wskinList').hidden = tab !== 'wskin'; $('weaponList').hidden = tab !== 'weapon';
}
function openShop(tab, title) {
  // trois boutiques : l'animalerie (laboratoire), l'armurerie (armes et skins d'armes), la garde-robe (le reste)
  const tabs = tab === 'pet' ? ['pet'] : tab === 'weapon' || tab === 'wskin' ? ['weapon', 'wskin'] : ['look', 'gear', 'cosm'];
  document.querySelectorAll('#skinsM .tab').forEach(b => { b.hidden = !tabs.includes(b.dataset.tab); });
  resetPreview(); openModal('skinsM'); $('shopTitle').textContent = title; setShopTab(tab); initPreview(); rebuildPreview(); }
document.querySelector('#skinsM .tabs').addEventListener('click', e => { const t = e.target.closest('[data-tab]'); if (t) setShopTab(t.dataset.tab); });
// ---------- La sorcière : œufs de familiers et niveaux ----------
const WITCH = { tab: 'eggs', res: null };
const pctTxt = v => v.toLocaleString('fr-FR', { maximumFractionDigits: 3 }) + ' %';
function renderWitch() {
  setText('witchCoins', fmtCoins());
  document.querySelectorAll('#witchTabs .tab').forEach(b => b.classList.toggle('sel', b.dataset.wtab === WITCH.tab));
  const el = $('witchList'); let html = '';
  if (WITCH.res) {
    const r = WITCH.res, P = PETS[r.id];
    html = `<div class="egg-open" id="eggOpen" style="--ec:${r.egg.col};--es:${r.egg.spot}"><div class="egg-shape"></div><div id="eggRes" hidden>
      <canvas width="480" height="360" data-eggpet="${r.id}"></canvas>
      <div class="big">${P.name}</div><p>${P.rar} · ${P.skill} : ${P.desc}</p>
      <p>${r.isNew ? 'Nouveau familier !' : r.up ? 'Déjà adopté : il passe niveau ' + r.lv + ' !' : 'Déjà au niveau max : la sorcière te rend ' + r.refund + ' pièces.'}</p>
      <div class="vp-btns"><button class="btn" data-wequip="${r.id}">${save.pet === r.id ? 'Déjà avec toi' : 'Le prendre avec moi'}</button><button class="btn alt" data-wback>Retour aux œufs</button></div></div></div>`;
  } else if (WITCH.tab === 'eggs') {
    const gift = !!save.firstPet;
    html = (gift ? '<p class="sub" style="color:var(--sun);margin-bottom:10px">« Bienvenue ! Ton premier œuf moussu est un cadeau de ma part. »</p>' : '') + '<div class="eggs">' + EGGS.map((E, i) => `<div class="egg" style="--ec:${E.col};--es:${E.spot}"><h3>${E.name}</h3><div class="egg-shape"></div>
      <ul>${E.pets.map(([id, pc]) => `<li class="${save.pets[id] ? 'own' : ''}"><span>${save.pets[id] ? '✓ ' : ''}${PETS[id].name} <small>(${PETS[id].rar})</small></span><b>${pctTxt(pc)}</b></li>`).join('')}</ul>
      ${gift && i === 0 ? `<button class="btn" data-egg="0">Ouvrir · offert !</button>` : `<button class="btn" data-egg="${i}" ${save.coins >= E.price ? '' : 'disabled'}>Ouvrir · <i class="coin"></i>${E.price}</button>`}</div>`).join('') + '</div>'
      + '<p class="sub" style="margin-top:10px">Un familier que tu as déjà gagne un niveau. Au niveau max, la sorcière te rend la moitié du prix.</p>';
  } else {
    const own = Object.keys(PETS).filter(id => save.pets[id]);
    html = own.length ? '<div class="gitems">' + own.map(id => {
      const P = PETS[id], lv = petLv(id), on = save.pet === id, c = petUpCost(id);
      return `<div class="gitem ${RAR[P.rar].cls}${on ? ' on' : ''}"><canvas width="320" height="240" data-wpet="${id}"></canvas>
        <span class="row"><span class="sn">${P.name}</span><span class="rar">Niv. ${lv}</span></span>
        <ul><li><b>${P.skill}</b> : ${P.desc}</li><li>Effets +${Math.round((petMul(id) - 1) * 100)} %${lv < PET_MAXLV ? ' → +' + Math.round(lv * 10) + ' % au niveau ' + (lv + 1) : ' · niveau max'}</li></ul>
        ${lv < PET_MAXLV ? `<button class="btn" data-wup="${id}" ${save.coins >= c ? '' : 'disabled'}>Niveau ${lv + 1} · <i class="coin"></i>${c}</button>` : ''}
        <button class="btn alt" data-wequip="${id}">${on ? 'Ranger' : 'Sortir'}</button></div>`;
    }).join('') + '</div>' : '<p class="sub">Tu n’as pas encore de familier : ouvre un œuf !</p>';
  }
  el.innerHTML = html;
  el.querySelectorAll('[data-wpet]').forEach(c => snapPet3D(c, c.dataset.wpet));
  if (WITCH.res && !WITCH.res.shown) { WITCH.res.shown = true; setTimeout(() => { const o = $('eggOpen'); if (!o) return; o.classList.add('done'); $('eggRes').hidden = false; const c = o.querySelector('[data-eggpet]'); if (c) snapPet3D(c, c.dataset.eggpet); sfx('coin'); }, 1300); }
  else if (WITCH.res) { $('eggOpen').classList.add('done'); $('eggRes').hidden = false; const c = el.querySelector('[data-eggpet]'); if (c) snapPet3D(c, c.dataset.eggpet); }
}
function openEgg(i) {
  const E = EGGS[i], gift = save.firstPet && i === 0; if (!E || (!gift && save.coins < E.price)) return;
  if (gift) delete save.firstPet; else save.coins -= E.price; save.petLv = save.petLv || {}; const id = rollEgg(E), res = { egg: E, id, isNew: !save.pets[id] };
  if (res.isNew) { save.pets[id] = true; save.petLv[id] = 1; }
  else if (petLv(id) < PET_MAXLV) { save.petLv[id] = petLv(id) + 1; res.up = true; res.lv = save.petLv[id]; }
  else { res.refund = Math.round(E.price / 2); save.coins += res.refund; }
  if (!save.pet) { save.pet = id; refreshPetSprite(); }   // premier familier : il te suit tout de suite
  persist(); updateVhud(); WITCH.res = res; renderWitch();
}
$('witchM').addEventListener('click', e => {
  const t = e.target.closest('[data-wtab]'); if (t) { WITCH.tab = t.dataset.wtab; WITCH.res = null; renderWitch(); return; }
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.egg !== undefined) openEgg(+b.dataset.egg);
  else if (b.dataset.wup) { const id = b.dataset.wup, c = petUpCost(id); if (petLv(id) < PET_MAXLV && save.coins >= c) { save.coins -= c; save.petLv = save.petLv || {}; save.petLv[id] = petLv(id) + 1; sfx('coin'); persist(); updateVhud(); renderWitch(); } }
  else if (b.dataset.wequip) { const id = b.dataset.wequip; save.pet = save.pet === id && !WITCH.res ? null : id; persist(); refreshPetSprite(); renderWitch(); }
  else if (b.dataset.wback !== undefined) { WITCH.res = null; renderWitch(); }
});
function renderPets() {
  $('petList').innerHTML = '<div class="gitems">' + Object.entries(PETS).map(([id, P]) => {
    const owned = save.pets[id], on = save.pet === id;
    const btn = on ? `<button class="btn alt" data-pet="${id}">Ranger</button>` : owned ? `<button class="btn" data-pet="${id}">Sortir</button>`
      : `<button class="btn" data-pet="${id}" ${save.coins >= P.price ? '' : 'disabled'}>Adopter · <i class="coin"></i>${P.price}</button>`;
    return `<div class="gitem ${RAR[P.rar].cls}${on ? ' on' : ''}" data-petcard="${id}"><canvas width="320" height="240" data-petprev="${id}"></canvas>
      <span class="row"><span class="sn">${P.name}</span><span class="rar">${P.rar}</span></span>
      <ul><li><b>${P.skill}</b> : ${P.desc}</li>${owned ? `<li>Niveau ${petLv(id)} / ${PET_MAXLV} · effets +${Math.round((petMul(id) - 1) * 100)} %</li>` : ''}</ul>${btn}</div>`;
  }).join('') + '</div>';
  document.querySelectorAll('[data-petprev]').forEach(c => snapPet3D(c, c.dataset.petprev));
}
$('petList').addEventListener('click', e => {
  const b = e.target.closest('[data-pet]');
  if (b) { if (!b.disabled) shopAction('pet', b.dataset.pet, true); return; }
  const card = e.target.closest('[data-petcard]'); if (card) tryOn('pet', card.dataset.petcard);
});
function renderGear() {
  const sc = setCount('dragon'), S = SETS.dragon;
  let html = `<div class="setbox"><b>${S.name}</b><p>Heaume, cape et bottes légendaires à porter ensemble. Bonus des 3 pièces : <span class="pc">${statLines(S.bonus).join(' · ')}</span></p><p>Pièces portées : ${sc} / 3${sc === 3 ? ' · bonus actif !' : ''}</p></div>`;
  for (const [slot, title, sub] of SLOTS) {
    html += `<section class="gsec"><h3>${title} <small>${sub}</small></h3><div class="gitems">` + Object.entries(ITEMS).filter(([, it]) => it.slot === slot).map(([id, it]) => {
      const owned = save.items[id], on = save.gear[slot] === id;
      const btn = on ? `<button class="btn alt" data-gear="${id}">Retirer</button>` : owned ? `<button class="btn" data-gear="${id}">Équiper</button>`
        : jobsOn() ? `<button class="btn alt" data-forge="${id}">À fabriquer (Forgeron)</button>`
        : `<button class="btn" data-gear="${id}" ${save.coins >= it.price ? '' : 'disabled'}>Acheter · <i class="coin"></i>${it.price}</button>`;
      return `<div class="gitem ${RAR[it.rar].cls}${on ? ' on' : ''}" data-gearcard="${id}"><canvas width="320" height="240" data-item="${id}"></canvas>
        <span class="row"><span class="sn">${it.name}</span><span class="rar">${it.rar}</span></span>
        <ul>${statLines(it.stats).map(t => `<li>${t}</li>`).join('')}</ul>${btn}</div>`;
    }).join('') + '</div></section>';
  }
  $('gearList').innerHTML = html;
  document.querySelectorAll('[data-item]').forEach(c => paintItem(c, c.dataset.item));
}
$('gearList').addEventListener('click', e => {
  const b = e.target.closest('[data-gear]');
  if (b) { if (!b.disabled) shopAction('gear', b.dataset.gear, true); return; }
  if (e.target.closest('[data-forge]')) { $('skinsM').hidden = true; openJobs('forge'); return; }
  const card = e.target.closest('[data-gearcard]'); if (card) tryOn('gear', card.dataset.gearcard);
});
$('weaponList').addEventListener('click', e => {
  const b = e.target.closest('[data-weapon]'); if (b) { if (!b.disabled) shopAction('weapon', b.dataset.weapon); return; }
  const card = e.target.closest('[data-weaponcard]'); if (card) tryOn('weapon', card.dataset.weaponcard);
});
$('wskinList').addEventListener('click', e => {
  const b = e.target.closest('[data-wskin]'); if (b) tryOn('wskin', b.dataset.wskin);
});
$('skinList').addEventListener('click', e => {
  if (e.target.closest('[data-retribe]')) { $('skinsM').hidden = true; openTribePicker(true); return; }
  if (!PREVIEW) resetPreview();
  const b = e.target.closest('[data-col]');
  if (b) PREVIEW.colors[b.dataset.col] = b.dataset.hex;
  else if (e.target.closest('[data-colreset]')) PREVIEW.colors = defaultColors();
  else return;
  PREVIEW.focus = { kind: 'color' };
  rebuildPreview(); renderLook();
});
$('cosmList').addEventListener('click', e => {
  const b = e.target.closest('[data-cosm]');
  if (b) { if (!b.disabled) shopAction('cosm', b.dataset.cosm, true); return; }
  const card = e.target.closest('[data-cosmcard]'); if (card) tryOn('cosm', card.dataset.cosmcard);
});
$('pvAct').addEventListener('click', applyPreview);
$('wolfBtn').addEventListener('click', startWolf);
$('candyBtn').addEventListener('click', startCandy);
$('wQuit').addEventListener('click', quitWolf);
$('wBtns').addEventListener('click', e => {
  const n = e.target.closest('[data-wnext]'); if (n && wSkip) { wSkip(); return; }
  const o = e.target.closest('[data-wopt]'); if (o && WG && WG.choose) WG.choose(+o.dataset.wopt);
});
$('wText').addEventListener('click', () => { if (wSkip && !$('wBtns').children.length) wSkip(); });
$('wCard').addEventListener('click', () => { if (wSkip) wSkip(); });
$('vChest').addEventListener('click', openChestModal);
$('chestOpen').addEventListener('click', claimChest);
$('chestCv').addEventListener('click', claimChest);
refreshChestBtn(); setInterval(refreshChestBtn, 30000);
// À l'arrivée dans le jeu, le coffre du jour s'ouvre tout seul s'il est disponible
// (le coffre s'ouvre à la fin de l'écran de chargement)
$('decoList').addEventListener('click', e => { const b = e.target.closest('[data-deco]'); if (!b || b.disabled) return; const [slot, sid] = b.dataset.deco.split(':'); buyDeco(slot, sid); });
for (const [id, dir] of [['pvLeft', -1], ['pvRight', 1]]) {
  const el = $(id); let hold = null;
  el.addEventListener('pointerdown', e => { e.preventDefault(); PV.target += dir * Math.PI / 4; hold = setTimeout(() => { PV.spin = dir; }, 350); });
  const stop = () => { clearTimeout(hold); PV.spin = 0; };
  el.addEventListener('pointerup', stop); el.addEventListener('pointerleave', stop); el.addEventListener('pointercancel', stop);
}
$('pvReset').addEventListener('click', () => { resetPreview(); rebuildPreview(); markTried(); renderLook(); });
function renderPortal() {
  renderCandyCard();
  $('pmBest').textContent = save.best;
  $('pmCls').textContent = CLASSES[save.cls].name;
  snapHero($('pmHero'), save.skin, CLASSES[save.cls].color);
  const tb = [];
  for (const id of ['armurerie', 'infirmerie', 'forge', 'labo', 'caserne']) { const l = lvl(id); if (l > 1) tb.push(BUILD[id].name + ' ' + l); }
  const gl = statLines(gearStats());
  if (PETS[save.pet]) gl.push('familier ' + PETS[save.pet].name + ' (' + PETS[save.pet].skill + ')');
  $('pmBonus').textContent = (tb.length ? 'Bonus du village actifs : ' + tb.join(' · ') : 'Améliore les bâtiments du village pour être plus fort ici.') + (gl.length ? ' Équipement : ' + gl.join(', ') + '.' : '');
  $('totalKills').textContent = save.totalKills ? save.totalKills + (save.totalKills > 1 ? ' monstres' : ' monstre') + ' au total' : '';
  $('histList').innerHTML = save.history.length ? save.history.map(h => {
    let when = '';
    try { when = new Date(h.d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) {}
    const c = CLASSES[h.c] ? CLASSES[h.c].name : '';
    return `<li><span class="w">Vague ${h.w}</span><span class="m">${h.k} monstre${h.k > 1 ? 's' : ''} · niv. ${h.l} · ${c}${h.df && h.df !== 'normal' ? ' · ' + DIFFS[h.df].name : ''}</span><span class="dt">${when}</span></li>`;
  }).join('') : '<li class="empty" style="background:none;border:0;padding:0">Aucune partie pour l’instant. Lance-toi !</li>';
}

// Contrôles du village : pouce gauche = déplacement, glisser à droite = tourner la caméra
const vcv = $('village');
function resetVjoy() { vjoy.id = null; vjoy.dx = vjoy.dy = 0; vcam.id = null; vcam.pts.clear(); vcam.pinch = 0; $('vjoy').hidden = true; }
vcv.addEventListener('pointerdown', e => {
  if (state !== 'village') return;
  e.preventDefault();
  if (e.clientX < W * 0.5 && vjoy.id === null) {
    vjoy.id = e.pointerId; vjoy.ox = e.clientX; vjoy.oy = e.clientY; vjoy.dx = vjoy.dy = 0;
    const j = $('vjoy'); j.style.left = vjoy.ox + 'px'; j.style.top = vjoy.oy + 'px'; $('vjoyKnob').style.transform = ''; j.hidden = false;
  } else {
    vcam.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (vcam.id === null) { vcam.id = e.pointerId; vcam.x = e.clientX; }
    if (vcam.pts.size === 2) { const [a, b] = [...vcam.pts.values()]; vcam.pinch = Math.hypot(a.x - b.x, a.y - b.y); vcam.z0 = V.zoom; }
  }
  try { vcv.setPointerCapture(e.pointerId); } catch (err) {}
});
vcv.addEventListener('pointermove', e => {
  if (e.pointerId === vjoy.id) {
    let dx = e.clientX - vjoy.ox, dy = e.clientY - vjoy.oy;
    const l = Math.hypot(dx, dy), R = 62;
    if (l > R * 1.6) { vjoy.ox = e.clientX - dx / l * R * 1.6; vjoy.oy = e.clientY - dy / l * R * 1.6; dx = e.clientX - vjoy.ox; dy = e.clientY - vjoy.oy; const j = $('vjoy'); j.style.left = vjoy.ox + 'px'; j.style.top = vjoy.oy + 'px'; }
    const m = Math.min(1, Math.hypot(dx, dy) / R), a = Math.atan2(dy, dx);
    vjoy.dx = m < 0.12 ? 0 : Math.cos(a) * m; vjoy.dy = m < 0.12 ? 0 : Math.sin(a) * m;
    $('vjoyKnob').style.transform = `translate(${Math.cos(a) * m * R}px,${Math.sin(a) * m * R}px)`;
  } else if (vcam.pts.has(e.pointerId)) {
    vcam.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (vcam.pts.size >= 2 && vcam.pinch) {
      // Pincer pour zoomer
      const [a, b] = [...vcam.pts.values()];
      V.zoom = clamp(vcam.z0 * vcam.pinch / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), 0.6, 1.8);
    } else if (e.pointerId === vcam.id) { V.yaw -= (e.clientX - vcam.x) * 0.008; vcam.x = e.clientX; }
  }
});
const vEnd = e => {
  if (e.pointerId === vjoy.id) { vjoy.id = null; vjoy.dx = vjoy.dy = 0; $('vjoy').hidden = true; }
  vcam.pts.delete(e.pointerId);
  if (vcam.pts.size < 2) vcam.pinch = 0;
  if (e.pointerId === vcam.id) { vcam.id = null; const n = vcam.pts.entries().next(); if (!n.done) { vcam.id = n.value[0]; vcam.x = n.value[1].x; } }
};
vcv.addEventListener('pointerup', vEnd); vcv.addEventListener('pointercancel', vEnd); vcv.addEventListener('lostpointercapture', vEnd);
vcv.addEventListener('wheel', e => { e.preventDefault(); V.zoom = clamp(V.zoom * (e.deltaY > 0 ? 1.08 : 0.93), 0.6, 1.8); }, { passive: false });

function villageFailed() {
  $('vhint').textContent = 'Le village 3D n’a pas pu se charger sur cet appareil. Tu peux quand même jouer au Bastion.';
  $('vhint').hidden = false;
  $('vFallback').hidden = false;
}

// ---------- Royaume Sucré : aligne 3 bonbons ou plus (mini-jeu du portail) ----------
// Bonbons spéciaux : 4 alignés = rayé (vide une ligne ou une colonne), en L ou en T = emballé (explose autour),
// 5 alignés = boule arc-en-ciel (fait disparaître une couleur). Gelée et meringues à détruire selon les niveaux.
const CC_COLS_NORMAL = ['#ff4d6d', '#ff9a3c', '#ffd23f', '#4cd964', '#3fa9ff', '#b56cff'];
// mode du Gobelin têtu (hardcore) : six roses différents, du plus pâle au plus foncé
const CC_COLS_PINK = ['#ff3d7f', '#ffa3c7', '#e0247a', '#ffc6de', '#b81463', '#ff6fae'];
const CC_COLS = CC_COLS_NORMAL.slice();
const CC_NAMES = ['rouges', 'orange', 'jaunes', 'verts', 'bleus', 'violets'];
const CC_BOOST = {
  hammer:  { name: 'Maillet sucré',     desc: 'Écrase le bonbon (ou la meringue) de ton choix, sans utiliser de coup', gems: 8,  ico: '🔨' },
  shuffle: { name: 'Tourbillon',        desc: 'Mélange tous les bonbons du plateau', gems: 6, ico: '🌀' },
  moves:   { name: '+5 coups',          desc: 'Ajoute 5 coups à la partie', gems: 10, ico: '+5' },
  duo:     { name: 'Duo sucré',         desc: 'Un bonbon rayé et un bonbon emballé dès le début du niveau', gems: 8, pre: true },
  bomb:    { name: 'Boule arc-en-ciel', desc: 'Une boule arc-en-ciel dès le début du niveau', gems: 12, pre: true },
};
const CC_STREAK = [['h', 'Bonbon rayé'], ['w', 'Bonbon emballé'], ['b', 'Boule arc-en-ciel']];
const CC_GIFTS = [{ hammer: 2 }, { shuffle: 1, moves: 1 }, { duo: 2 }, { bomb: 1, hammer: 1 }, { moves: 2, shuffle: 1 }, { bomb: 2 }];
const CC_WHEEL = [
  { inv: { hammer: 1 }, w: 16, col: '#ff4f8b' },
  { coins: 150, w: 16, col: '#ffb020' },
  { inv: { shuffle: 1 }, w: 16, col: '#ffe14a' },
  { inv: { bomb: 1 }, w: 9, col: '#3fd884' },
  { inv: { moves: 1 }, w: 14, col: '#3fb8ff' },
  { gems: 5, w: 10, col: '#a66bff' },
  { inv: { duo: 1 }, w: 14, col: '#ff7ac8' },
  { inv: { hammer: 2, bomb: 1, moves: 1 }, w: 5, col: '#2fd6d6', big: true },
];
const CC_WHEEL_MS = 10 * 3600e3;
const CC_WORDS = ['', '', 'Sucré !', 'Délicieux !', 'Divin !', 'Fabuleux !'];
const CC_SHAPES = [
  { R: 8, C: 8, f: () => true },
  { R: 8, C: 8, f: (r, c) => !((r === 0 || r === 7) && (c === 0 || c === 7)) },
  { R: 9, C: 9, f: (r, c) => Math.abs(r - 4) + Math.abs(c - 4) <= 6 },
  { R: 8, C: 8, f: (r, c) => !(r >= 3 && r <= 4 && c >= 3 && c <= 4) },
  { R: 7, C: 9, f: () => true },
  { R: 9, C: 8, f: (r, c) => !(r === 4 && (c < 2 || c > 5)) },
  { R: 9, C: 9, f: (r, c) => !((r < 2 || r > 6) && (c < 2 || c > 6)) },
  { R: 8, C: 9, f: (r, c) => !(r === 0 && (c === 0 || c === 4 || c === 8)) && !(r >= 5 && (c < r - 4 || c > 12 - r)) },  // cœur
];
const CC = { fast: false, waits: [], t: 0, uid: 0, parts: [], fx: [], texts: [], spr: {}, icons: {}, S: 60, px: 60, dpr: 1, tool: null, drag: null, pre: {}, wheel: null, view: 'map' };
let CB = null;   // plateau de la partie en cours

function ccData() {
  const d = save.cc || (save.cc = {});
  if (!d.inv) { d.inv = { hammer: 1, shuffle: 1, moves: 1, duo: 1, bomb: 1 }; d.welcome = true; }   // cadeau de bienvenue
  for (const k in CC_BOOST) d.inv[k] = d.inv[k] || 0;
  if (!d.lvl) d.lvl = 1;
  if (!d.stars) d.stars = {};
  if (!d.best) d.best = {};
  if (d.wheel === undefined) d.wheel = 0;
  if (!d.streak) d.streak = 0;
  return d;
}
function ccRng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function ccMix(hex, to, t) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
  const ch = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

// --- Niveaux (générés, toujours les mêmes pour un numéro donné)
function ccLevel(n) {
  const rnd = ccRng(n * 9973 + 7), pick = a => a[Math.floor(rnd() * a.length)];
  const d = Math.min(1, (n - 1) / 45);
  const sh = n <= 4 ? CC_SHAPES[0] : n <= 8 ? CC_SHAPES[1 + (n % 2)] : pick(CC_SHAPES);
  const R = sh.R, C = sh.C, ok = [], jelly = [], block = [];
  for (let r = 0; r < R; r++) { ok.push([]); jelly.push([]); block.push([]); for (let c = 0; c < C; c++) { ok[r].push(sh.f(r, c)); jelly[r].push(0); block[r].push(0); } }
  // un seul objectif : niveaux impairs = points, pairs = bonbons ; tous les 10 niveaux, une gelée (x4) et des meringues (x8) pour varier
  const type = n % 10 === 4 ? 'jelly' : n % 10 === 8 ? 'block' : n % 2 ? 'score' : 'col';
  const mix = false;
  const colors = n <= 3 ? 4 : n < 22 ? 5 : n % 4 === 2 ? 6 : 5;
  const goals = []; let moves = 0;
  const each = f => { for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (ok[r][c]) f(r, c); };
  const addBlocks = () => {
    const pats = [
      (r, c) => r === Math.floor(R / 2) && c % 3 !== 1,
      (r, c) => r >= R - 2,
      (r, c) => (c === 1 || c === C - 2) && r >= 2 && r <= R - 3,
      (r, c) => (r === 2 || r === R - 3) && (c <= 2 || c >= C - 3) && c > 0 && c < C - 1,
    ];
    const f = n <= 8 ? pats[n % 2] : pick(pats); let tot = 0;
    each((r, c) => { if (r > 0 && f(r, c) && !jelly[r][c]) { block[r][c] = n >= 12 && !mix && rnd() < 0.2 + 0.4 * d ? 2 : 1; tot += block[r][c]; } });
    if (tot) goals.push({ t: 'block', n: tot });
    moves += 14 + tot * 0.75;
  };
  const addJelly = () => {
    const cr = (R - 1) / 2, cc = (C - 1) / 2, ext = 1 + d * 1.6;
    const pats = [
      (r, c) => Math.abs(r - cr) <= ext && Math.abs(c - cc) <= ext,
      (r, c) => r >= R - 2 - Math.round(d * 2),
      (r, c) => Math.abs(r - c * (R - 1) / (C - 1)) < 0.6 || Math.abs(r - (C - 1 - c) * (R - 1) / (C - 1)) < 0.6,
      (r, c) => (r + c) % 2 === 0 && Math.abs(r - cr) <= 2.5 && Math.abs(c - cc) <= 3,
      (r, c) => r < 2 + Math.round(d * 2),
    ];
    const f = n <= 10 ? pats[n % 2] : pick(pats); let tot = 0;
    each((r, c) => { if (f(r, c) && !block[r][c]) { jelly[r][c] = n >= 14 && rnd() < 0.2 + 0.4 * d ? 2 : 1; tot += jelly[r][c]; } });
    goals.push({ t: 'jelly', n: tot });
    moves += 16 + tot * 0.48;
  };
  if (type === 'score') moves = 20 + (n % 3) * 2;
  else if (type === 'col') {
    const cs = [...Array(colors).keys()].sort(() => rnd() - 0.5).slice(0, n > 20 && !mix ? 3 : 2);
    for (const c of cs) goals.push({ t: 'col', c, n: Math.round((12 + 10 * d) * (mix ? 0.75 : 1) * (colors === 6 ? 0.85 : 1)) });
    moves = cs.length === 3 ? 26 : 21;
    if (mix) addBlocks();
  } else if (type === 'jelly') { addJelly(); if (mix) addBlocks(); }
  else { addBlocks(); if (mix) addJelly(); }
  moves = Math.max(16, Math.min(45, Math.round(moves * (1.08 - 0.2 * d))));
  let st;
  if (type === 'score') { const t = Math.round(moves * (240 + 90 * d) / 100) * 100; goals.push({ t: 'score', n: t }); st = [t, t, t]; }
  else st = [0, 0, 0];
  return { n, R, C, ok, jelly, block, colors, moves, goals, stars: st, type, gift: n % 5 === 0 ? CC_GIFTS[(n / 5 - 1) % CC_GIFTS.length] : null };
}

// --- Plateau
const ccCell = (r, c) => CB && r >= 0 && c >= 0 && r < CB.R && c < CB.C ? CB.g[r][c] : null;
const ccMov = cl => !!(cl && cl.ok && !cl.block && cl.k && !cl.k.dead);
const ccRandColor = () => Math.floor(Math.random() * CB.colors);
function ccNewCandy(c, s) { return { c, s: s || '', x: 0, y: 0, vy: 0, id: ++CC.uid, die: 0, grow: 1, land: 0, tw: null }; }
function ccColorAt(r, c) { const cl = ccCell(r, c); return ccMov(cl) && cl.k.s !== 'b' ? cl.k.c : -1; }
function ccMatchAt(r, c) {
  const k = ccColorAt(r, c); if (k < 0) return false;
  let h = 1, v = 1;
  for (let i = c - 1; ccColorAt(r, i) === k; i--) h++;
  for (let i = c + 1; ccColorAt(r, i) === k; i++) h++;
  for (let i = r - 1; ccColorAt(i, c) === k; i--) v++;
  for (let i = r + 1; ccColorAt(i, c) === k; i++) v++;
  return h >= 3 || v >= 3;
}
function ccBuild(L) {
  CB = { L, R: L.R, C: L.C, colors: L.colors, moves: L.moves, score: 0, cascade: 0, g: [], sel: null, moved: null, hint: null, idle: 0, busy: true, done: false, used5: 0,
    goals: L.goals.map(g => ({ ...g, left: g.n })) };
  for (let r = 0; r < L.R; r++) { const row = []; for (let c = 0; c < L.C; c++) row.push({ ok: L.ok[r][c], jelly: L.jelly[r][c], block: L.block[r][c], k: null }); CB.g.push(row); }
  for (let tries = 0; tries < 40; tries++) {
    for (let r = 0; r < CB.R; r++) for (let c = 0; c < CB.C; c++) {
      const cl = CB.g[r][c]; if (!cl.ok || cl.block) continue;
      cl.k = ccNewCandy(0);
      do cl.k.c = ccRandColor(); while (ccMatchAt(r, c));
      cl.k.x = c; cl.k.y = r - CB.R - 1;
    }
    if (ccFindMove()) break;
  }
}
// Alignements (les L, T et + sont regroupés)
function ccFindGroups() {
  const runs = [];
  for (let r = 0; r < CB.R; r++) for (let c = 0; c < CB.C;) {
    const k = ccColorAt(r, c); let e = c + 1;
    if (k >= 0) while (e < CB.C && ccColorAt(r, e) === k) e++;
    if (k >= 0 && e - c >= 3) runs.push({ d: 'h', cells: Array.from({ length: e - c }, (_, i) => r * 64 + c + i) });
    c = e;
  }
  for (let c = 0; c < CB.C; c++) for (let r = 0; r < CB.R;) {
    const k = ccColorAt(r, c); let e = r + 1;
    if (k >= 0) while (e < CB.R && ccColorAt(e, c) === k) e++;
    if (k >= 0 && e - r >= 3) runs.push({ d: 'v', cells: Array.from({ length: e - r }, (_, i) => (r + i) * 64 + c) });
    r = e;
  }
  let groups = [];
  for (const run of runs) {
    const hits = groups.filter(g => run.cells.some(k => g.keys.has(k)));
    const g = { keys: new Set(run.cells), runs: [run] };
    for (const h of hits) { h.keys.forEach(k => g.keys.add(k)); g.runs.push(...h.runs); }
    groups = groups.filter(x => !hits.includes(x)); groups.push(g);
  }
  return groups;
}
function ccFindMove() {
  for (let r = 0; r < CB.R; r++) for (let c = 0; c < CB.C; c++) {
    const a = CB.g[r][c]; if (!ccMov(a)) continue;
    for (const [dr, dc] of [[0, 1], [1, 0]]) {
      const b = ccCell(r + dr, c + dc); if (!ccMov(b)) continue;
      if ((a.k.s && b.k.s) || a.k.s === 'b' || b.k.s === 'b') return [r, c, r + dr, c + dc];
      [a.k, b.k] = [b.k, a.k];
      const m = ccMatchAt(r, c) || ccMatchAt(r + dr, c + dc);
      [a.k, b.k] = [b.k, a.k];
      if (m) return [r, c, r + dr, c + dc];
    }
  }
  return null;
}

// --- Attentes (animations) : en mode rapide (tests), tout est instantané
function ccSleep(d) { return CC.fast ? Promise.resolve() : new Promise(res => CC.waits.push({ t: CC.t + d, res })); }
function ccSettle() { return CC.fast ? Promise.resolve() : new Promise(res => CC.waits.push({ f: () => !ccAnimating(), res })); }
function ccAnimating() {
  for (let r = 0; r < CB.R; r++) for (let c = 0; c < CB.C; c++) {
    const k = CB.g[r][c].k;
    if (k && (k.tw || k.y < r - 0.001 || Math.abs(k.x - c) > 0.001 || (k.dead && k.die < 1))) return true;
  }
  return false;
}
function ccTween(k, c, r, d) { if (!CC.fast) k.tw = { fx: k.x, fy: k.y, t: 0, d: d || 0.16 }; else { k.x = c; k.y = r; } }

// --- Destruction d'une liste de cases (les bonbons spéciaux touchés se déclenchent en chaîne)
function ccEffect(r, c, k) {
  const out = [], s = k.s;
  if (s === 'h' || s === 'x') { for (let i = 0; i < CB.C; i++) out.push([r, i]); CC.fx.push({ k: 'h', r, c, life: 0.45, col: CC_COLS[k.c] || '#fff' }); }
  if (s === 'v' || s === 'x') { for (let i = 0; i < CB.R; i++) out.push([i, c]); CC.fx.push({ k: 'v', r, c, life: 0.45, col: CC_COLS[k.c] || '#fff' }); }
  if (s === '3') for (let i = -1; i <= 1; i++) {
    for (let j = 0; j < CB.C; j++) out.push([r + i, j]);
    for (let j = 0; j < CB.R; j++) out.push([j, c + i]);
    CC.fx.push({ k: 'h', r: r + i, c, life: 0.5, col: '#fff' }, { k: 'v', r, c: c + i, life: 0.5, col: '#fff' });
  }
  if (s === 'w' || s === 'W') {
    const R = s === 'W' ? 2 : 1;
    for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) out.push([r + i, c + j]);
    if (s === 'w') out.push([r - 2, c], [r + 2, c], [r, c - 2], [r, c + 2]);
    CC.fx.push({ k: 'o', r, c, life: 0.5, rad: R + 1, col: CC_COLS[k.c] || '#fff' });
  }
  if (s === 'b' || s === 'B') {
    let col = k.target;
    if (s === 'b' && col === undefined) {
      const cnt = new Array(6).fill(0);
      for (const row of CB.g) for (const cl of row) if (ccMov(cl) && cl.k.c >= 0) cnt[cl.k.c]++;
      col = cnt.indexOf(Math.max(...cnt));
    }
    for (let i = 0; i < CB.R; i++) for (let j = 0; j < CB.C; j++) {
      const cl = CB.g[i][j];
      if (s === 'B' || (ccMov(cl) && cl.k.c === col)) { out.push([i, j]); if (s === 'b' && !CC.fast) CC.fx.push({ k: 'l', r, c, r2: i, c2: j, life: 0.4 }); }
    }
  }
  if (!CC.fast) sfx(s === 'b' || s === 'B' || s === 'W' ? 'ult' : 'boom');
  return out;
}
function ccGoal(t, c) {
  const g = CB.goals.find(g => g.t === t && g.left > 0 && (t !== 'col' || g.c === c));
  if (g) g.left--;
}
async function ccClear(list, o = {}) {
  const hit = new Set(), q = list.slice(), dmg = new Set(), orig = new Set(list.map(([r, c]) => r * 64 + c));
  let n = 0, sx = 0, sy = 0;
  const hitBlock = (r, c) => {
    const cl = ccCell(r, c), key = r * 64 + c;
    if (!cl || !cl.ok || !cl.block || dmg.has(key)) return;
    dmg.add(key); cl.block--; CB.score += 60; ccGoal('block');
    ccBurst(c, r, '#ffffff', 7); ccBurst(c, r, '#ffb3d9', 5);
  };
  while (q.length) {
    const [r, c] = q.shift(), key = r * 64 + c, cl = ccCell(r, c);
    if (!cl || !cl.ok || hit.has(key)) continue;
    if (cl.block) { hitBlock(r, c); continue; }
    hit.add(key);
    if (cl.jelly) { cl.jelly--; CB.score += 100; ccGoal('jelly'); }
    const k = cl.k; if (!k || k.dead) continue;
    k.dead = true; k.die = 0; n++; sx += c; sy += r;
    if (k.c >= 0) { ccGoal('col', k.c); ccBurst(c, r, CC_COLS[k.c], 6); }
    if (k.s) for (const cell of ccEffect(r, c, k)) q.push(cell);
    if (o.adjacent && orig.has(key)) for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) hitBlock(r + dr, c + dc);
  }
  const pts = n * 20 * Math.max(1, CB.cascade);
  CB.score += pts;
  if (n && !CC.fast) { CC.texts.push({ x: sx / n + 0.5, y: sy / n + 0.5, txt: '+' + pts, col: '#fff', t: 0 }); sfx('pick'); }
  ccHud();
  await ccSleep(0.22);
  for (const row of CB.g) for (const cl of row) if (cl.k && cl.k.dead) cl.k = null;
  for (const m of o.made || []) {
    const cl = CB.g[m.r][m.c];
    if (cl.k || cl.block) continue;
    m.k.x = m.c; m.k.y = m.r; m.k.grow = 0; cl.k = m.k;
    CB.score += m.k.s === 'b' ? 200 : m.k.s === 'w' ? 120 : 60;
  }
}
// Chute des bonbons (avec glissade en diagonale sous les meringues) et nouveaux bonbons par le haut
async function ccFall() {
  const spawned = new Array(CB.C).fill(0);
  for (let moved = true, guard = 0; moved && guard < 200; guard++) {
    moved = false; const done = new Set();
    for (let r = CB.R - 1; r >= 0; r--) for (let c = 0; c < CB.C; c++) {
      const cl = CB.g[r][c];
      if (!cl.ok || cl.block || cl.k) continue;
      let ra = r - 1; while (ra >= 0 && !CB.g[ra][c].ok) ra--;
      if (ra < 0) { const k = ccNewCandy(ccRandColor()); k.x = c; k.y = r - 1 - spawned[c]++; cl.k = k; done.add(k); moved = true; continue; }
      const a = CB.g[ra][c];
      if (a.k && !a.block) { if (!done.has(a.k)) { cl.k = a.k; a.k = null; done.add(cl.k); moved = true; } continue; }
      if (!a.block) continue;
      for (const dc of Math.random() < 0.5 ? [-1, 1] : [1, -1]) {
        const s = ccCell(r - 1, c + dc), below = ccCell(r, c + dc);
        if (ccMov(s) && !done.has(s.k) && (!below || !below.ok || below.block || below.k)) { cl.k = s.k; s.k = null; done.add(cl.k); moved = true; break; }
      }
    }
  }
  if (CC.fast) for (let r = 0; r < CB.R; r++) for (let c = 0; c < CB.C; c++) { const k = CB.g[r][c].k; if (k) { k.x = c; k.y = r; } }
  await ccSettle();
}
// Résout les alignements en cascade
async function ccResolve() {
  for (let guard = 0; guard < 60; guard++) {
    const groups = ccFindGroups();
    if (!groups.length) break;
    CB.cascade++;
    const hits = [], made = [];
    for (const g of groups) {
      const maxLen = Math.max(...g.runs.map(x => x.cells.length));
      const hv = g.runs.some(x => x.d === 'h') && g.runs.some(x => x.d === 'v');
      const long = g.runs.reduce((a, b) => b.cells.length > a.cells.length ? b : a);
      const sp = maxLen >= 5 ? 'b' : hv ? 'w' : maxLen === 4 ? (long.d === 'h' ? 'v' : 'h') : '';
      const any = [...g.keys][0], col = CB.g[any >> 6][any & 63].k.c;
      for (const key of g.keys) hits.push([key >> 6, key & 63]);
      if (!sp) continue;
      let pos = null;
      if (CB.moved) for (const [r, c] of CB.moved) if (g.keys.has(r * 64 + c)) pos = r * 64 + c;
      if (pos === null && hv) { const hs = new Set(g.runs.filter(x => x.d === 'h').flatMap(x => x.cells)); pos = g.runs.filter(x => x.d === 'v').flatMap(x => x.cells).find(k => hs.has(k)); }
      if (pos === null || pos === undefined) pos = long.cells[Math.floor(long.cells.length / 2)];
      made.push({ r: pos >> 6, c: pos & 63, k: ccNewCandy(sp === 'b' ? -1 : col, sp) });
    }
    CB.moved = null;
    if (CB.cascade >= 2 && !CC.fast) ccWord(CC_WORDS[Math.min(5, CB.cascade)]);
    await ccClear(hits, { adjacent: true, made });
    await ccFall();
  }
}
// Deux bonbons spéciaux échangés l'un avec l'autre
async function ccCombo(ka, ra, ca, kb, rb, cb) {
  CB.cascade = 1;
  let hits;
  if (ka.s === 'b' || kb.s === 'b') {
    const [bomb, other, br, bc] = ka.s === 'b' ? [ka, kb, ra, ca] : [kb, ka, rb, cb];
    if (other.s === 'b') { bomb.s = 'B'; other.s = ''; hits = [[br, bc]]; ccWord('Méga sucre !'); }
    else {
      const col = other.c, targets = [];
      for (let i = 0; i < CB.R; i++) for (let j = 0; j < CB.C; j++) {
        const cl = CB.g[i][j];
        if (ccMov(cl) && cl.k.c === col) {
          targets.push([i, j]);
          if (other.s && cl.k !== other) { cl.k.s = other.s === 'w' ? 'w' : Math.random() < 0.5 ? 'h' : 'v'; cl.k.grow = 0.3; }
          if (!CC.fast) CC.fx.push({ k: 'l', r: br, c: bc, r2: i, c2: j, life: 0.5 });
        }
      }
      bomb.s = ''; bomb.c = -1;
      if (!CC.fast) sfx('ult');
      await ccSleep(other.s ? 0.45 : 0.25);
      hits = [[br, bc], ...targets];
    }
  } else {
    const st = x => x === 'h' || x === 'v';
    ka.s = st(ka.s) && st(kb.s) ? 'x' : st(ka.s) || st(kb.s) ? '3' : 'W';
    kb.s = ''; hits = [[ra, ca], [rb, cb]];
  }
  await ccClear(hits);
  await ccFall();
}

// --- Actions du joueur
async function ccTrySwap(r1, c1, r2, c2) {
  if (!CB || CB.busy || CB.done) return false;
  const a = ccCell(r1, c1), b = ccCell(r2, c2);
  if (!ccMov(a) || !ccMov(b) || Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return false;
  CB.busy = true; CB.hint = null; CB.idle = 0; CB.sel = null;
  const ka = a.k, kb = b.k;
  a.k = kb; b.k = ka; ccTween(ka, c2, r2); ccTween(kb, c1, r1);
  await ccSettle();
  const combo = (ka.s && kb.s) || ka.s === 'b' || kb.s === 'b';
  if (!combo && !ccFindGroups().length) {
    a.k = ka; b.k = kb; ccTween(ka, c1, r1); ccTween(kb, c2, r2);
    await ccSettle(); CB.busy = false; return false;
  }
  CB.moves--; CB.cascade = 0; CB.moved = [[r1, c1], [r2, c2]];
  if (combo) await ccCombo(ka, r2, c2, kb, r1, c1);
  else CB.cascade = 0;
  if (CB.cascade) CB.cascade = 1;
  await ccResolve();
  await ccAfter();
  return true;
}
async function ccAfter() {
  ccHud();
  const L = CB.L, score = L.type === 'score';
  const goalsOk = CB.goals.every(g => g.t === 'score' ? CB.score >= g.n : g.left <= 0);
  if (goalsOk) { CB.done = true; if (!score) await ccFinale(); return ccEnd(true); }
  if (CB.moves <= 0) { CB.busy = false; return ccEnd(false); }
  if (!ccFindMove()) { if (!CC.fast) ccWord('On mélange !'); await ccShuffle(); }
  CB.busy = false;
}
async function ccShuffle() {
  const cells = [];
  for (let r = 0; r < CB.R; r++) for (let c = 0; c < CB.C; c++) if (ccMov(CB.g[r][c])) cells.push([r, c]);
  const ks = cells.map(([r, c]) => CB.g[r][c].k);
  for (let tries = 0; tries < 80; tries++) {
    ks.sort(() => Math.random() - 0.5);
    cells.forEach(([r, c], i) => { CB.g[r][c].k = ks[i]; });
    if (tries > 40) for (const k of ks) if (!k.s) k.c = ccRandColor();
    if (!ccFindGroups().length && ccFindMove()) break;
  }
  cells.forEach(([r, c]) => ccTween(CB.g[r][c].k, c, r, 0.45));
  await ccSettle();
  await ccResolve();
}
// Délice final : les coups restants deviennent des bonbons rayés qui explosent
async function ccFinale() {
  CB.hint = null; CB.finale = true; const wasFast = CC.fast;
  const skip = () => { if (CB.skip && !CC.fast) { CC.fast = true; CC.fx = []; CC.parts = []; CC.texts = []; } };
  if (CB.moves > 0) { if (!CC.fast) ccWord('Délice final ! (touche pour passer)'); await ccSleep(0.7); }
  try { await ccFinaleRun(skip); } finally { CB.finale = false; CC.fast = wasFast; for (const row of CB.g) for (const cl of row) if (cl.k) { cl.k.tw = null; cl.k.grow = 1; } ccHud(); }
}
async function ccFinaleRun(skip) {
  skip();
  for (let guard = 0; CB.moves > 0 && guard < 40; guard++) {
    const cands = [];
    for (let r = 0; r < CB.R; r++) for (let c = 0; c < CB.C; c++) { const cl = CB.g[r][c]; if (ccMov(cl) && !cl.k.s) cands.push(cl); }
    if (!cands.length) break;
    const cl = cands[Math.floor(Math.random() * cands.length)];
    skip(); cl.k.s = Math.random() < 0.5 ? 'h' : 'v'; cl.k.grow = 0.2; CB.moves--; CB.score += 120;
    ccHud(); if (!CC.fast) sfx('pick');
    await ccSleep(0.07);
  }
  for (let i = 0; i < 25; i++) {
    const sp = [];
    for (let r = 0; r < CB.R; r++) for (let c = 0; c < CB.C; c++) { const cl = CB.g[r][c]; if (ccMov(cl) && cl.k.s) sp.push([r, c]); }
    if (!sp.length) break;
    CB.cascade = 1;
    skip(); await ccClear(sp.slice(0, 5)); await ccFall(); await ccResolve();
  }
  ccHud();
}
async function ccHammer(r, c) {
  const cl = ccCell(r, c), d = ccData();
  if (!cl || !cl.ok || (!cl.block && !ccMov(cl)) || d.inv.hammer <= 0) return;
  CC.tool = null; CB.busy = true; d.inv.hammer--; persist(); ccBoostBar();
  CC.fx.push({ k: 'o', r, c, life: 0.4, rad: 1, col: '#fff' });
  CB.cascade = 1; await ccClear([[r, c]]); await ccFall(); CB.cascade = 0; await ccResolve(); await ccAfter();
}
function ccStartCandies(list) {
  // place les bonbons de départ (série de victoires et boosters) sur des bonbons ordinaires
  const cells = [];
  for (let r = 0; r < CB.R; r++) for (let c = 0; c < CB.C; c++) { const cl = CB.g[r][c]; if (ccMov(cl) && !cl.k.s) cells.push(cl); }
  cells.sort(() => Math.random() - 0.5);
  for (const s of list) {
    const cl = cells.pop(); if (!cl) break;
    if (s === 'h') cl.k.s = Math.random() < 0.5 ? 'h' : 'v'; else cl.k.s = s;
    if (s === 'b') cl.k.c = -1;
  }
}

// --- Dessin des bonbons (images préparées à la taille d'une case)
function ccRR(g, x, y, w, h, r) { g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
// Bonbons « façon Candy Crush », dessinés pour le jeu : formes rondes et douces, gros reflet brillant,
// bord de la même couleur en plus foncé (pas de noir), ombre douce
// 0 dragée rouge · 1 pastille orange · 2 goutte jaune · 3 carré vert arrondi · 4 boule bleue · 5 fleur violette
function ccPath(g, c, R) {
  g.beginPath();
  if (c === 0) { g.save(); g.rotate(-0.55); g.ellipse(0, 0, R * 1.0, R * 0.62, 0, 0, TAU); g.restore(); }
  else if (c === 1) g.ellipse(0, 0, R * 0.98, R * 0.72, 0, 0, TAU);
  else if (c === 2) { g.moveTo(0, -R * 0.98); g.bezierCurveTo(R * 0.55, -R * 0.45, R * 0.95, R * 0.1, R * 0.82, R * 0.48); g.bezierCurveTo(R * 0.62, R * 0.98, -R * 0.62, R * 0.98, -R * 0.82, R * 0.48); g.bezierCurveTo(-R * 0.95, R * 0.1, -R * 0.55, -R * 0.45, 0, -R * 0.98); g.closePath(); }
  else if (c === 3) ccRR(g, -R * 0.8, -R * 0.8, R * 1.6, R * 1.6, R * 0.5);
  else if (c === 4) g.arc(0, 0, R * 0.88, 0, TAU);
  else { for (let i = 0; i <= 72; i++) { const a = i / 72 * TAU - Math.PI / 2, rr = R * (0.8 + 0.13 * Math.cos(a * 5)); i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); }
}
// corps d'un bonbon (ombre, dégradé, bord, lueur du bas, reflets) ; stripes : 'h' ou 'v' pour les bonbons rayés
function ccCandyBody(g, s, c, R, stripes) {
  const col = CC_COLS[c], rim = ccMix(col, '#5a0030', 0.45);
  g.save(); g.translate(0, R * 0.12); g.filter = 'blur(' + Math.max(1, s * 0.03) + 'px)'; ccPath(g, c, R); g.fillStyle = 'rgba(60,0,60,.28)'; g.fill(); g.restore();
  ccPath(g, c, R);
  const gr = g.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.1, 0, R * 0.1, R * 1.15);
  gr.addColorStop(0, ccMix(col, '#ffffff', 0.55)); gr.addColorStop(0.45, col); gr.addColorStop(1, ccMix(col, '#5a0030', 0.38));
  g.fillStyle = gr; g.fill();
  g.save(); ccPath(g, c, R); g.clip();
  if (stripes) {
    // bonbon rayé : bandes blanches douces dans le sens de son explosion
    g.fillStyle = 'rgba(255,255,255,.82)';
    for (let i = -3; i <= 3; i++) { if (stripes === 'h') g.fillRect(-R * 1.3, i * R * 0.4 - R * 0.09, R * 2.6, R * 0.18); else g.fillRect(i * R * 0.4 - R * 0.09, -R * 1.3, R * 0.18, R * 2.6); }
  }
  const gb = g.createLinearGradient(0, R * 0.2, 0, R * 1.1); gb.addColorStop(0, 'rgba(255,255,255,0)'); gb.addColorStop(1, 'rgba(255,255,255,.28)');
  g.fillStyle = gb; g.fillRect(-R * 1.3, -R * 1.3, R * 2.6, R * 2.6);
  g.restore();
  ccPath(g, c, R); g.lineWidth = Math.max(1.2, s * 0.03); g.strokeStyle = rim; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(-R * 0.28, -R * 0.42, R * 0.38, R * 0.17, -0.5, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(R * 0.36, R * 0.3, R * 0.08, 0, TAU); g.fill();
}
function ccDrawCandy(g, s, c, sp) {
  const R = s * 0.42;
  g.save(); g.translate(s / 2, s / 2);
  if (sp === 'b' || c < 0) {
    // boule arc-en-ciel : boule de chocolat couverte de vermicelles de toutes les couleurs
    g.save(); g.translate(0, R * 0.1); g.filter = 'blur(' + Math.max(1, s * 0.03) + 'px)'; g.fillStyle = 'rgba(40,10,0,.35)'; g.beginPath(); g.arc(0, 0, R * 0.9, 0, TAU); g.fill(); g.restore();
    const gr = g.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.1, 0, 0, R * 0.95);
    gr.addColorStop(0, '#b07a4f'); gr.addColorStop(0.55, '#6b3a17'); gr.addColorStop(1, '#3a1d08');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R * 0.9, 0, TAU); g.fill();
    g.lineWidth = Math.max(1.2, s * 0.03); g.strokeStyle = '#2a1204'; g.stroke();
    const rnd = ccRng(5);
    for (let i = 0; i < 20; i++) {
      const a = rnd() * TAU, d = Math.sqrt(rnd()) * R * 0.72;
      g.save(); g.translate(Math.cos(a) * d, Math.sin(a) * d); g.rotate(rnd() * TAU);
      g.fillStyle = CC_COLS[i % 6]; g.beginPath(); ccRR(g, -R * 0.12, -R * 0.045, R * 0.24, R * 0.09, R * 0.045); g.fill(); g.restore();
    }
    g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(-R * 0.32, -R * 0.42, R * 0.3, R * 0.13, -0.6, 0, TAU); g.fill();
    g.restore(); return;
  }
  if (sp === 'w') {
    // bonbon emballé : papier transparent torsadé des deux côtés
    const col = CC_COLS[c], light = ccMix(col, '#ffffff', 0.45), rim = ccMix(col, '#5a0030', 0.4);
    for (const sx of [-1, 1]) {
      g.beginPath(); g.moveTo(sx * R * 0.45, 0); g.quadraticCurveTo(sx * R * 0.95, -R * 0.75, sx * R * 1.12, -R * 0.55);
      g.quadraticCurveTo(sx * R * 0.92, 0, sx * R * 1.12, R * 0.55); g.quadraticCurveTo(sx * R * 0.95, R * 0.75, sx * R * 0.45, 0); g.closePath();
      g.fillStyle = light; g.fill(); g.lineWidth = Math.max(1.2, s * 0.028); g.strokeStyle = rim; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(sx * R * 0.86, -R * 0.3, R * 0.12, R * 0.05, sx * 0.6, 0, TAU); g.fill();
    }
    ccCandyBody(g, s, c, R * 0.72, '');
    // reflet du papier par-dessus le bonbon
    g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.ellipse(0, 0, R * 0.7, R * 0.62, 0, 0, TAU); g.fill();
    g.restore(); return;
  }
  ccCandyBody(g, s, c, R, sp === 'h' || sp === 'v' ? sp : '');
  g.restore();
}
function ccDrawBlock(g, s, lv) {
  const R = s * 0.44, base = lv > 1 ? '#ff9fcf' : '#fff4fa', edge = lv > 1 ? '#c2407f' : '#d98cb5';
  g.save(); g.translate(s / 2, s / 2);
  g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); ccRR(g, -R, -R * 0.85, R * 2, R * 1.95, R * 0.4); g.fill();
  const gr = g.createLinearGradient(0, -R, 0, R); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, base);
  g.fillStyle = gr; g.beginPath(); ccRR(g, -R, -R, R * 2, R * 1.9, R * 0.42); g.fill();
  g.lineWidth = Math.max(1.5, s * 0.035); g.strokeStyle = edge; g.stroke();
  g.strokeStyle = edge; g.lineWidth = Math.max(1.5, s * 0.045); g.lineCap = 'round';
  g.beginPath(); g.arc(0, -R * 0.05, R * 0.5, Math.PI * 0.9, Math.PI * 2.3); g.stroke();
  g.beginPath(); g.arc(R * 0.05, -R * 0.05, R * 0.22, Math.PI * 1.1, Math.PI * 2.6); g.stroke();
  if (lv > 1) { const rnd = ccRng(9); for (let i = 0; i < 8; i++) { g.fillStyle = CC_COLS[i % 6]; g.beginPath(); g.arc((rnd() - 0.5) * R * 1.5, (rnd() - 0.5) * R * 1.4, R * 0.07, 0, TAU); g.fill(); } }
  g.restore();
}
function ccSpr(key, draw) {
  let cv = CC.spr[key];
  if (!cv) { cv = CC.spr[key] = document.createElement('canvas'); cv.width = cv.height = CC.px; draw(cv.getContext('2d'), CC.px); }
  return cv;
}
const ccCandySpr = (c, s) => ccSpr('c' + c + s, (g, px) => ccDrawCandy(g, px, c, s));
function ccIcon(key) {
  if (CC.icons[key]) return CC.icons[key];
  const cv = document.createElement('canvas'); cv.width = cv.height = 72; const g = cv.getContext('2d');
  if (key === 'jelly') { g.fillStyle = '#ff5fb0'; g.globalAlpha = 0.85; g.beginPath(); ccRR(g, 8, 8, 56, 56, 14); g.fill(); g.globalAlpha = 1; g.strokeStyle = '#c21672'; g.lineWidth = 4; g.stroke(); g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(26, 22, 12, 6, -0.5, 0, TAU); g.fill(); }
  else if (key === 'block') ccDrawBlock(g, 72, 1);
  else if (key === 'star') { g.translate(36, 38); g.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 14 : 31; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fillStyle = '#ffd21f'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#c47a00'; g.stroke(); }
  else { const [c, s] = key.split(':'); ccDrawCandy(g, 72, +c, s || ''); }
  return CC.icons[key] = cv.toDataURL();
}

// --- Rendu et animations
const ccv = $('ccCanvas'), cctx = ccv.getContext('2d');
function ccResize() {
  if (!CB) return;
  const wrap = $('ccWrap'), w = wrap.clientWidth - 8, h = wrap.clientHeight - 8;
  const S = Math.max(24, Math.floor(Math.min(w / CB.C, h / CB.R))), dpr = Math.min(save.gfx === 'fast' ? 1 : 2, window.devicePixelRatio || 1);
  CC.S = S; CC.dpr = dpr;
  ccv.width = Math.round(S * CB.C * dpr); ccv.height = Math.round(S * CB.R * dpr);
  ccv.style.width = S * CB.C + 'px'; ccv.style.height = S * CB.R + 'px';
  const px = Math.round(S * dpr);
  if (px !== CC.px) { CC.px = px; CC.spr = {}; }
}
function ccBurst(c, r, col, n) {
  if (CC.fast) return;
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 1.5 + Math.random() * 3.5; CC.parts.push({ x: c + 0.5, y: r + 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, col, life: 0.5 + Math.random() * 0.4, sz: 0.05 + Math.random() * 0.07, star: Math.random() < 0.25 }); }
}
function ccWord(txt) {
  if (!txt || CC.fast) return;
  const el = document.createElement('div'); el.className = 'cc-word'; el.textContent = txt;
  $('ccFx').appendChild(el); setTimeout(() => el.remove(), 1300);
}
function ccFrame(dt) {
  CC.t += dt;
  if (CC.wheel && CC.wheel.spin) ccWheelStep(dt);
  if (CC.view === 'map') { CC.tick = (CC.tick || 0) + dt; if (CC.tick > 1) { CC.tick = 0; ccWheelLabel(); } }
  if (!CB || CC.view !== 'play') { ccRunWaits(); return; }
  const S = CC.S * CC.dpr, g = cctx;
  // animations des bonbons
  for (let r = 0; r < CB.R; r++) for (let c = 0; c < CB.C; c++) {
    const k = CB.g[r][c].k; if (!k) continue;
    if (k.tw) {
      k.tw.t += dt / k.tw.d; const t = Math.min(1, k.tw.t), e = t * t * (3 - 2 * t);
      k.x = k.tw.fx + (c - k.tw.fx) * e; k.y = k.tw.fy + (r - k.tw.fy) * e;
      if (t >= 1) { k.tw = null; k.x = c; k.y = r; }
    } else if (k.y < r - 0.001 || Math.abs(k.x - c) > 0.001) {
      if (k.y > r) { k.tw = { fx: k.x, fy: k.y, t: 0, d: 0.15 }; continue; }
      if (k.fy0 === undefined || k.fy0 === null) { k.fy0 = k.y; k.fx0 = k.x; }
      k.vy = Math.min(20, k.vy + 50 * dt); k.y = Math.min(r, k.y + k.vy * dt);
      k.x = r > k.fy0 ? k.fx0 + (c - k.fx0) * clamp((k.y - k.fy0) / (r - k.fy0), 0, 1) : c;
      if (k.y >= r) { k.x = c; k.y = r; k.vy = 0; k.fy0 = null; k.land = 1; }
    }
    if (k.dead) k.die = Math.min(1, k.die + dt / 0.22);
    if (k.grow < 1) k.grow = Math.min(1, k.grow + dt / 0.25);
    if (k.land > 0) k.land = Math.max(0, k.land - dt * 6);
  }
  ccRunWaits();
  if (!CB.busy && !CB.done) { CB.idle += dt; if (CB.idle > 6 && !CB.hint) CB.hint = ccFindMove(); }
  // plateau
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, ccv.width, ccv.height);
  const pad = S * 0.07;
  g.fillStyle = ccData().goblin ? 'rgba(214,40,130,.55)' : 'rgba(70,20,110,.55)';
  for (let r = 0; r < CB.R; r++) for (let c = 0; c < CB.C; c++) if (CB.g[r][c].ok) { g.beginPath(); ccRR(g, c * S - pad * 0.3, r * S - pad * 0.3, S + pad * 0.6, S + pad * 0.6, S * 0.2); g.fill(); }
  for (let r = 0; r < CB.R; r++) for (let c = 0; c < CB.C; c++) {
    const cl = CB.g[r][c]; if (!cl.ok) continue;
    g.fillStyle = ccData().goblin ? ((r + c) % 2 ? 'rgba(255,214,236,.62)' : 'rgba(255,170,215,.5)') : (r + c) % 2 ? 'rgba(255,255,255,.26)' : 'rgba(255,255,255,.16)';
    g.beginPath(); ccRR(g, c * S + 2, r * S + 2, S - 4, S - 4, S * 0.16); g.fill();
    if (cl.jelly) {
      g.fillStyle = cl.jelly > 1 ? 'rgba(214,30,140,.8)' : 'rgba(255,110,190,.7)';
      g.beginPath(); ccRR(g, c * S + pad, r * S + pad, S - pad * 2, S - pad * 2, S * 0.18); g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(c * S + S * 0.33, r * S + S * 0.27, S * 0.15, S * 0.07, -0.5, 0, TAU); g.fill();
    }
  }
  // sélection et indice
  const glow = (r, c, a) => { g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = S * 0.06; g.beginPath(); ccRR(g, c * S + 3, r * S + 3, S - 6, S - 6, S * 0.18); g.stroke(); };
  if (CB.sel) glow(CB.sel[0], CB.sel[1], 0.95);
  const hint = CB.hint && !CB.busy ? CB.hint : null;
  // bonbons
  for (let r = 0; r < CB.R; r++) for (let c = 0; c < CB.C; c++) {
    const cl = CB.g[r][c];
    if (cl.block) { g.drawImage(ccSpr('blk' + cl.block, (gg, px) => ccDrawBlock(gg, px, cl.block)), c * S, r * S, S, S); continue; }
    const k = cl.k; if (!k) continue;
    let sc = k.grow < 1 ? 0.3 + 0.7 * Math.sin(k.grow * Math.PI / 2) + Math.sin(k.grow * Math.PI) * 0.2 : 1, sy = 1, al = 1, ox = 0;
    if (k.dead) { sc = k.die < 0.35 ? 1 + k.die * 0.6 : 1.2 * (1 - (k.die - 0.35) / 0.65); al = 1 - k.die * 0.6; }
    if (k.land) sy = 1 - 0.13 * k.land;
    if (hint && ((hint[0] === r && hint[1] === c) || (hint[2] === r && hint[3] === c))) { sc *= 1 + Math.sin(CC.t * 9) * 0.08; ox = Math.sin(CC.t * 18) * S * 0.03; }
    if (k.s && k.s !== 'b' && !k.dead) sc *= 1 + Math.sin(CC.t * 4 + k.id) * 0.03;
    if (sc <= 0.01) continue;
    const spr = ccCandySpr(k.c, k.s === 'b' ? 'b' : k.s === 'w' ? 'w' : k.s === 'h' || k.s === 'v' ? k.s : '');
    const w = S * sc, h = S * sc * sy, x = k.x * S + (S - w) / 2 + ox, y = k.y * S + (S - h) / 2 + (S * sc - h) / 2;
    g.globalAlpha = al; g.drawImage(spr, x, y, w, h); g.globalAlpha = 1;
    if (k.s === 'b' && !k.dead) { g.strokeStyle = `hsla(${(CC.t * 200) % 360},100%,70%,.9)`; g.lineWidth = S * 0.05; g.beginPath(); g.arc(k.x * S + S / 2, k.y * S + S / 2, S * 0.43, 0, TAU); g.stroke(); }
  }
  // effets : rayons, explosions, éclairs
  for (const f of CC.fx) {
    f.life -= dt; const a = Math.max(0, f.life / 0.45);
    g.globalAlpha = Math.min(1, a);
    if (f.k === 'h') { const gr = g.createLinearGradient(0, f.r * S, 0, f.r * S + S); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, f.r * S + S * 0.15, ccv.width, S * 0.7); }
    else if (f.k === 'v') { const gr = g.createLinearGradient(f.c * S, 0, f.c * S + S, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(f.c * S + S * 0.15, 0, S * 0.7, ccv.height); }
    else if (f.k === 'o') { g.strokeStyle = f.col; g.lineWidth = S * 0.25 * a; g.beginPath(); g.arc(f.c * S + S / 2, f.r * S + S / 2, S * (f.rad + 0.6) * (1 - a * 0.7), 0, TAU); g.stroke(); }
    else if (f.k === 'l') {
      // traînée de paillettes : petites étoiles scintillantes qui filent de la boule vers le bonbon
      const x0 = f.c * S + S / 2, y0 = f.r * S + S / 2, x1 = f.c2 * S + S / 2, y1 = f.r2 * S + S / 2, pr = 1 - Math.max(0, f.life) / (f.max || (f.max = f.life + 1e-6) || 1);
      for (let i = 0; i < 7; i++) {
        const u = Math.max(0, Math.min(1, pr * 1.5 - i * 0.07)), x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u, rr = S * (0.16 - i * 0.015) * (0.7 + 0.3 * Math.sin(CC.t * 30 + i));
        g.fillStyle = i % 3 === 0 ? '#fff6c4' : `hsl(${(i * 55 + f.c2 * 40) % 360},100%,82%)`;
        g.beginPath(); for (let k = 0; k < 8; k++) { const ang = k * Math.PI / 4, q = k % 2 ? rr * 0.32 : rr; g.lineTo(x + Math.cos(ang) * q, y + Math.sin(ang) * q); } g.closePath(); g.fill();
      }
    }
  }
  g.globalAlpha = 1; CC.fx = CC.fx.filter(f => f.life > 0);
  for (const p of CC.parts) {
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 9 * dt;
    g.globalAlpha = Math.min(1, p.life * 2); g.fillStyle = p.col;
    if (p.star) { g.save(); g.translate(p.x * S, p.y * S); g.rotate(CC.t * 5); g.fillRect(-p.sz * S, -p.sz * S * 0.3, p.sz * S * 2, p.sz * S * 0.6); g.fillRect(-p.sz * S * 0.3, -p.sz * S, p.sz * S * 0.6, p.sz * S * 2); g.restore(); }
    else { g.beginPath(); g.arc(p.x * S, p.y * S, p.sz * S, 0, TAU); g.fill(); }
  }
  g.globalAlpha = 1; CC.parts = CC.parts.filter(p => p.life > 0);
  g.font = `${Math.round(S * 0.42)}px Lilita One, Arial Black, sans-serif`; g.textAlign = 'center'; g.lineJoin = 'round';
  for (const t of CC.texts) {
    t.t += dt; const y = (t.y - t.t * 0.8) * S;
    g.globalAlpha = Math.max(0, 1 - t.t / 0.9); g.lineWidth = S * 0.1; g.strokeStyle = '#8a1458'; g.strokeText(t.txt, t.x * S, y); g.fillStyle = t.col; g.fillText(t.txt, t.x * S, y);
  }
  g.globalAlpha = 1; CC.texts = CC.texts.filter(t => t.t < 0.9);
}
function ccRunWaits() {
  if (!CC.waits.length) return;
  const keep = [];
  for (const w of CC.waits) { if ((w.f && w.f()) || (w.t !== undefined && CC.t >= w.t)) w.res(); else keep.push(w); }
  CC.waits = keep;
}

// --- Interface : HUD, boosters, carte, fenêtres
function ccGoalHTML(g, big) {
  const ico = g.t === 'col' ? ccIcon(g.c + ':') : g.t === 'jelly' ? ccIcon('jelly') : g.t === 'block' ? ccIcon('block') : ccIcon('star');
  const left = g.t === 'score' ? (CB ? Math.max(0, g.n - CB.score) : g.n) : g.left !== undefined ? g.left : g.n;
  const done = g.t === 'score' ? CB && CB.score >= g.n : left <= 0;
  const txt = big ? (g.t === 'col' ? `Récolte ${g.n} bonbons ${CC_NAMES[g.c]}` : g.t === 'jelly' ? 'Fais fondre toute la gelée' : g.t === 'block' ? 'Casse toutes les meringues' : `Atteins ${g.n.toLocaleString('fr-FR')} points`) : '';
  return `<div class="cc-goal${done ? ' done' : ''}"><img src="${ico}" alt=""><b>${done ? '✔' : g.t === 'score' ? g.n.toLocaleString('fr-FR') : left}</b>${txt ? `<span>${txt}</span>` : ''}</div>`;
}
// avancement vers l'objectif du niveau (0 à 1)
function ccProgress() {
  if (!CB) return 0;
  let tot = 0, got = 0;
  for (const g of CB.goals) { if (g.t === 'score') { tot += 1; got += Math.min(1, CB.score / g.n); } else { tot += 1; got += Math.min(1, (g.n - Math.max(0, g.left)) / g.n); } }
  return tot ? got / tot : 0;
}
function ccHud() {
  if (!CB || CC.fast) return;
  $('ccMoves').textContent = CB.moves;
  $('ccScore').textContent = CB.score.toLocaleString('fr-FR');
  const pr = ccProgress();
  $('ccBarFill').style.width = Math.min(100, pr * 100) + '%';
  const marks = $('ccBar').querySelectorAll('s');
  [1 / 3, 2 / 3, 1].forEach((v, i) => { if (marks[i]) { marks[i].style.left = v * 100 + '%'; marks[i].classList.toggle('on', pr >= v - 1e-6); } });
  $('ccGoals').innerHTML = CB.goals.map(g => ccGoalHTML(g)).join('');
  $('ccMoves').parentNode.classList.toggle('low', CB.moves <= 5);
}
function ccBoostBar() {
  const d = ccData();
  $('ccBoost').innerHTML = ['hammer', 'shuffle', 'moves'].map(id => {
    const B = CC_BOOST[id], n = d.inv[id];
    return `<button class="cc-bst${CC.tool === id ? ' sel' : ''}" data-cc="use:${id}" title="${B.name} : ${B.desc}"><i>${B.ico}</i><span>${B.name}</span><b class="${n ? '' : 'buy'}">${n || '+'}</b></button>`;
  }).join('');
}
function ccPreIcon(id) { return id === 'duo' ? `<img src="${ccIcon('0:h')}" alt=""><img src="${ccIcon('4:w')}" alt="">` : `<img src="${ccIcon('-1:b')}" alt="">`; }
function ccInvHTML() {
  const d = ccData();
  return Object.keys(CC_BOOST).map(id => `<span class="cc-chip" title="${CC_BOOST[id].name}">${CC_BOOST[id].pre ? ccPreIcon(id) : `<i>${CC_BOOST[id].ico}</i>`}<b>${d.inv[id]}</b></span>`).join('');
}
function ccStreakHTML(n) {
  return `<div class="cc-streak"><div class="cc-streak-t">🔥 Série de victoires : <b>${n}</b></div><div class="cc-streak-row">${CC_STREAK.map(([s, name], i) =>
    `<div class="cc-sk${n > i ? ' on' : ''}"><img src="${ccIcon((i === 2 ? -1 : [0, 4][i]) + ':' + s)}" alt=""><span>${i + 1} victoire${i ? 's' : ''}</span><em>${name}</em></div>`).join('')}</div>
    <p>Gagne des niveaux d’affilée : tu commences les suivants avec ces bonbons en cadeau. Une défaite remet la série à zéro.</p></div>`;
}
function ccGiftText(gift) { return Object.entries(gift).map(([k, v]) => `${v} × ${CC_BOOST[k].name}`).join(' + '); }
function ccRenderMap() {
  const d = ccData(), N = Math.max(30, d.lvl + 12), H = 96, list = $('ccPath');
  const pos = i => ({ x: 50 + Math.sin(i * 0.85) * 30, y: (N - i) * H + 50 });
  let svg = '', html = '';
  for (let i = 1; i <= N; i++) { const p = pos(i); svg += (i === 1 ? 'M' : 'L') + p.x + ' ' + p.y + ' '; }
  for (let i = 1; i <= N; i++) {
    const p = pos(i), st = d.stars[i] || 0, lock = i > d.lvl, gift = i % 5 === 0;
    html += `<button class="cc-node${lock ? ' lock' : ''}${i === d.lvl ? ' cur' : ''}${gift ? ' gift' : ''}" style="left:${p.x}%;top:${p.y}px;--h:${(i * 37) % 360}" data-cc="lvl:${i}" ${lock ? 'disabled' : ''}>
      <span>${i}</span>${gift ? `<i class="cc-gifti">${lock || !d.best[i] ? '🎁' : '✔'}</i>` : ''}<em>${[0, 1, 2].map(k => `<s class="${k < st ? 'on' : ''}">★</s>`).join('')}</em></button>`;
  }
  const deco = [];
  const rnd = ccRng(3), em = ['🍭', '🍬', '🧁', '🍩', '🍪', '🍫', '🍰', '🍡'];
  for (let i = 0; i < N * 0.9; i++) { const left = rnd() < 0.5; deco.push(`<i class="cc-deco" style="left:${left ? 2 + rnd() * 14 : 84 + rnd() * 13}%;top:${rnd() * N * H}px;font-size:${28 + rnd() * 26}px;transform:rotate(${(rnd() - 0.5) * 50}deg)">${em[Math.floor(rnd() * em.length)]}</i>`); }
  list.innerHTML = `<div class="cc-pathin" style="height:${(N + 1) * H}px"><svg viewBox="0 0 100 ${(N + 1) * H}" preserveAspectRatio="none"><path d="${svg}" class="r1"/><path d="${svg}" class="r2"/></svg>${deco.join('')}${html}</div>`;
  $('ccInv').innerHTML = ccInvHTML();
  $('ccStreakMap').innerHTML = `🔥 Série : <b>${d.streak}</b>`;
  const tot = Object.values(d.stars).reduce((a, b) => a + b, 0);
  $('ccStarsTot').textContent = tot;
  ccWheelLabel();
  requestAnimationFrame(() => { const cur = list.querySelector('.cur') || list.querySelector('.cc-node:not(.lock)'); if (cur) list.scrollTop = cur.offsetTop - list.clientHeight * 0.55; });
}
function ccWheelReady() { return Date.now() - ccData().wheel >= CC_WHEEL_MS; }
function ccWheelLabel() {
  const el = $('ccWheelTime'); if (!el) return;
  const left = CC_WHEEL_MS - (Date.now() - ccData().wheel);
  $('ccWheelBtn').classList.toggle('ready', left <= 0);
  if (left <= 0) { el.textContent = 'Roue prête !'; return; }
  const h = Math.floor(left / 3600e3), m = Math.floor(left % 3600e3 / 60e3), s = Math.floor(left % 60e3 / 1000);
  el.textContent = h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min ${String(s).padStart(2, '0')}`;
}
function ccPop(html) { CC.pop = true; $('ccPopIn').innerHTML = html; $('ccPop').hidden = false; }
function ccClosePop() { CC.pop = false; $('ccPop').hidden = true; CC.wheel = null; }
function ccOpenLevel(n) {
  const d = ccData(), L = ccLevel(n);
  CC.pre = CC.pre || {}; CC.lastOpen = n;
  for (const id of ['duo', 'bomb']) if (!d.inv[id]) CC.pre[id] = false;
  const best = d.stars[n] || 0;
  ccPop(`<div class="cc-card"><div class="cc-ribbon">Niveau ${n}</div>
    <div class="cc-stars big">${[0, 1, 2].map(k => `<s class="${k < best ? 'on' : ''}">★</s>`).join('')}</div>
    ${L.gift ? `<div class="cc-giftbox">🎁 <b>Niveau récompense</b> · gagne-le pour recevoir : ${ccGiftText(L.gift)} et 3 gemmes</div>` : ''}
    <div class="cc-goalbox"><h4>Objectif${L.goals.length > 1 ? 's' : ''} · ${L.moves} coups</h4>${L.goals.map(g => ccGoalHTML(g, true)).join('')}</div>
    <h4 class="cc-h">Boosters de départ</h4>
    <div class="cc-pres">${['duo', 'bomb'].map(id => `<button class="cc-pre${CC.pre[id] ? ' sel' : ''}" data-cc="pre:${id}"><span class="cc-preimg">${ccPreIcon(id)}</span><b>${CC_BOOST[id].name}</b><small>${d.inv[id] ? '× ' + d.inv[id] : CC_BOOST[id].gems + ' gemmes'}</small></button>`).join('')}</div>
    ${ccStreakHTML(d.streak)}
    <div class="cc-btns"><button class="cc-btn blue" data-cc="close">Carte</button><button class="cc-btn green" data-cc="play:${n}">Jouer !</button></div></div>`);
}
function ccStart(n) {
  const d = ccData(), L = ccLevel(n);
  ccClosePop();
  CC.view = 'play'; CC.level = n; CC.tool = null; CC.parts = []; CC.fx = []; CC.texts = []; CC.waits = [];
  $('ccMap').hidden = true; $('ccPlay').hidden = false; $('ccLvl').textContent = 'Niveau ' + n;
  ccBuild(L);
  const extra = [];
  if (d.streak >= 1) extra.push('h');
  if (d.streak >= 2) extra.push('w');
  if (d.streak >= 3) extra.push('b');
  for (const id of ['duo', 'bomb']) if (CC.pre[id] && d.inv[id] > 0) { d.inv[id]--; extra.push(...(id === 'duo' ? ['h', 'w'] : ['b'])); }
  CC.pre = {}; persist();
  ccStartCandies(extra);
  ccResize(); ccHud(); ccBoostBar();
  if (!CC.fast) ccWord(extra.length ? 'Bonus de départ !' : 'C’est parti !');
  ccSettle().then(() => { if (CB && CB.L === L) CB.busy = false; });
}
function ccEnd(win) {
  const d = ccData(), n = CC.level, L = CB.L;
  if (!win) {
    const goalsTxt = CB.goals.filter(g => g.t === 'score' ? CB.score < g.n : g.left > 0).map(g => ccGoalHTML(g)).join('');
    if (CC.fast) { d.streak = 0; persist(); CB.result = 'lose'; return; }
    ccPop(`<div class="cc-card"><div class="cc-ribbon sad">Plus de coups…</div>
      <p class="cc-msg">Il te manquait encore :</p><div class="cc-goals inline">${goalsTxt}</div>
      <button class="cc-btn wide" data-cc="more5">${d.inv.moves ? `Utiliser « +5 coups » (il t’en reste ${d.inv.moves})` : `+5 coups pour ${CC_BOOST.moves.gems} gemmes`}</button>
      ${d.streak ? `<p class="cc-warn">Si tu abandonnes, ta série de ${d.streak} victoire${d.streak > 1 ? 's' : ''} sera perdue.</p>` : ''}
      <div class="cc-btns"><button class="cc-btn blue" data-cc="giveup">Abandonner</button></div></div>`);
    return;
  }
  const stars = 3;   // objectif atteint = 3 étoiles
  const first = !d.best[n], old = d.stars[n] || 0;
  let coins = first ? 15 + stars * 10 : Math.max(5, (stars - old) * 10), gems = 0; const got = [];
  if (L.gift && first) { for (const k in L.gift) { d.inv[k] += L.gift[k]; got.push(L.gift[k] + ' × ' + CC_BOOST[k].name); } gems = 3; }
  d.stars[n] = Math.max(old, stars); d.best[n] = Math.max(d.best[n] || 0, CB.score);
  if (n === d.lvl) d.lvl = n + 1;
  d.streak++;
  save.coins += coins; save.gems += gems; persist(); updateVhud();
  CB.result = 'win';
  if (CC.fast) return;
  sfx('level'); setTimeout(() => sfx('coin'), 300);
  const sk = Math.min(3, d.streak);
  ccPop(`<div class="cc-card win"><div class="cc-ribbon">Niveau ${n} réussi !</div>
    <div class="cc-stars big anim">${[0, 1, 2].map(k => `<s class="${k < stars ? 'on' : ''}" style="animation-delay:${0.2 + k * 0.35}s">★</s>`).join('')}</div>
    <p class="cc-score">${CB.score.toLocaleString('fr-FR')} points${d.best[n] === CB.score && !first ? ' · nouveau record !' : ''}</p>
    <div class="cc-rew"><span class="chip"><i class="coin"></i>+${coins} pièces</span>${gems ? `<span class="chip"><i class="gem"></i>+${gems} gemmes</span>` : ''}</div>
    ${got.length ? `<div class="cc-giftbox">🎁 Cadeau du niveau : ${got.join(' + ')}</div>` : ''}
    <div class="cc-giftbox streak">🔥 Série de ${d.streak} victoire${d.streak > 1 ? 's' : ''} : au prochain niveau tu commences avec ${CC_STREAK.slice(0, sk).map(x => x[1].toLowerCase()).join(', ')}${d.streak < 3 ? ` (encore 1 victoire pour ajouter : ${CC_STREAK[sk][1].toLowerCase()})` : ''}.</div>
    <div class="cc-btns"><button class="cc-btn blue" data-cc="tomap">Carte</button><button class="cc-btn green" data-cc="next">Niveau suivant</button></div></div>`);
}
function ccGiveUp() { const d = ccData(); d.streak = 0; persist(); ccToMap(); }
// Mode du Gobelin têtu (le mode de Tessa) : tous les reliefs en rose
function ccGoblin(on) {
  const d = ccData(); if (on !== undefined) { d.goblin = on; persist(); }
  const pal = d.goblin ? CC_COLS_PINK : CC_COLS_NORMAL; pal.forEach((c, i) => { CC_COLS[i] = c; });
  CC.spr = {}; CC.icons = {};
  $('candy').classList.toggle('goblin', !!d.goblin);
  $('ccGobBtn').setAttribute('aria-pressed', String(!!d.goblin)); $('ccGobBtn').classList.toggle('on', !!d.goblin);
}
$('ccGobBtn').addEventListener('click', () => { const on = !ccData().goblin; ccGoblin(on); if (on && !CC.fast) ccWord('Mode du Gobelin têtu !'); if (CC.view === 'map') ccRenderMap(); sfx('pick'); });
// pendant le délice final, toucher n'importe où sur l'écran de jeu le fait passer
$('ccPlay').addEventListener('pointerdown', () => { if (CB && CB.finale) CB.skip = true; });
function ccToMap() {
  ccClosePop(); CB = null; CC.view = 'map'; CC.waits = []; CC.tool = null;
  $('ccPlay').hidden = true; $('ccMap').hidden = false; ccRenderMap();
}
function ccBuy(id, then) {
  const B = CC_BOOST[id];
  if (save.gems < B.gems) { ccWord('Pas assez de gemmes'); return false; }
  save.gems -= B.gems; ccData().inv[id]++; persist(); updateVhud(); sfx('coin');
  if (then) then();
  return true;
}
function ccUse(id) {
  if (!CB || CB.busy || CB.done) return;
  const d = ccData();
  if (!d.inv[id]) {
    ccPop(`<div class="cc-card"><div class="cc-ribbon">${CC_BOOST[id].name}</div><p class="cc-msg">${CC_BOOST[id].desc}.</p><p class="cc-msg">Tu n’en as plus : gagne-en avec la roue et les niveaux récompenses, ou achète-en un.</p>
      <div class="cc-btns"><button class="cc-btn blue" data-cc="close">Retour</button><button class="cc-btn green" data-cc="buy:${id}">Acheter (${CC_BOOST[id].gems} gemmes)</button></div></div>`);
    return;
  }
  if (id === 'hammer') { CC.tool = CC.tool === 'hammer' ? null : 'hammer'; ccBoostBar(); if (CC.tool) ccWord('Touche un bonbon'); return; }
  d.inv[id]--; persist();
  if (id === 'moves') { CB.moves += 5; ccWord('+5 coups !'); sfx('level'); ccHud(); }
  if (id === 'shuffle') { CB.busy = true; ccWord('Tourbillon !'); ccShuffle().then(() => { CB.busy = false; CB.hint = null; CB.idle = 0; }); }
  ccBoostBar();
}
function ccMore5() {
  const d = ccData();
  if (!d.inv.moves && !ccBuy('moves')) return;
  d.inv.moves--; persist(); ccClosePop();
  CB.moves += 5; CB.used5++; ccWord('+5 coups !'); ccHud(); ccBoostBar();
}
// --- Roue des boosters (toutes les 10 heures)
function ccPrizeText(p) { return p.coins ? `${p.coins} pièces` : p.gems ? `${p.gems} gemmes` : Object.entries(p.inv).map(([k, v]) => (v > 1 ? v + ' × ' : '') + CC_BOOST[k].name).join(' + '); }
function ccOpenWheel() {
  const ready = ccWheelReady();
  CC.wheel = { a: CC.wheel ? CC.wheel.a : 0, spin: false };
  ccPop(`<div class="cc-card wheel"><div class="cc-ribbon">Roue sucrée</div>
    <div class="cc-wheel"><canvas id="ccWheelCv" width="560" height="560"></canvas><i class="cc-pin"></i></div>
    <p class="cc-msg" id="ccWheelMsg">${ready ? 'Un tour gratuit toutes les 10 heures. Bonne chance !' : 'La roue se recharge… reviens dans <b id="ccWheelLeft"></b>.'}</p>
    <div class="cc-btns"><button class="cc-btn blue" data-cc="close">Fermer</button><button class="cc-btn green" id="ccSpin" data-cc="spin" ${ready ? '' : 'disabled'}>Tourner !</button></div></div>`);
  ccDrawWheel();
  if (!ready) { const left = CC_WHEEL_MS - (Date.now() - ccData().wheel); $('ccWheelLeft').textContent = Math.floor(left / 3600e3) + ' h ' + String(Math.floor(left % 3600e3 / 60e3)).padStart(2, '0'); }
}
function ccDrawWheel() {
  const cv = $('ccWheelCv'); if (!cv || !CC.wheel) return;
  const g = cv.getContext('2d'), R = 270, n = CC_WHEEL.length, seg = TAU / n;
  g.setTransform(1, 0, 0, 1, 280, 280); g.clearRect(-280, -280, 560, 560);
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, R + 8, 0, TAU); g.fill();
  g.rotate(CC.wheel.a);
  CC_WHEEL.forEach((p, i) => {
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, i * seg - Math.PI / 2 - seg / 2, (i + 1) * seg - Math.PI / 2 - seg / 2); g.closePath();
    const gr = g.createRadialGradient(0, 0, 20, 0, 0, R); gr.addColorStop(0, ccMix(p.col, '#ffffff', 0.5)); gr.addColorStop(1, p.col);
    g.fillStyle = gr; g.fill(); g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.stroke();
    g.save(); g.rotate(i * seg); g.translate(0, -R * 0.66);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const key = p.inv ? Object.keys(p.inv)[0] : null;
    if (p.big) { g.font = '58px sans-serif'; g.fillText('🎁', 0, 0); }
    else if (p.coins || p.gems) {
      g.beginPath(); if (p.coins) g.arc(0, -8, 26, 0, TAU); else { g.moveTo(0, -36); g.lineTo(24, -12); g.lineTo(0, 18); g.lineTo(-24, -12); g.closePath(); }
      g.fillStyle = p.coins ? '#ffd23f' : '#7ef0ff'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#5a2a6a'; g.stroke();
    } else if (CC_BOOST[key].pre) { const im = CC.wheelImgs && CC.wheelImgs[key]; if (im) g.drawImage(im, -36, -40, 72, 72); }
    else { g.font = key === 'moves' ? '44px Lilita One, Arial Black, sans-serif' : '54px sans-serif'; g.fillStyle = '#fff'; g.strokeStyle = '#5a2a6a'; g.lineWidth = 8; if (key === 'moves') g.strokeText('+5', 0, -4); g.fillText(CC_BOOST[key].ico, 0, -4); }
    g.font = '30px Lilita One, Arial Black, sans-serif'; g.lineWidth = 7; g.strokeStyle = '#5a2a6a'; g.fillStyle = '#ffffff';
    const lab = p.big ? 'Gros lot' : p.coins ? '+' + p.coins : p.gems ? '+' + p.gems : (p.inv[key] > 1 ? p.inv[key] + '×' : '×1');
    g.strokeText(lab, 0, 52); g.fillText(lab, 0, 52);
    g.restore();
  });
  g.setTransform(1, 0, 0, 1, 280, 280);
  const gr = g.createRadialGradient(-10, -10, 4, 0, 0, 50); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#ff5fb0');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 46, 0, TAU); g.fill(); g.lineWidth = 6; g.strokeStyle = '#ffffff'; g.stroke();
  g.font = '40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🍬', 0, 2);
}
function ccSpin() {
  if (!ccWheelReady() || !CC.wheel || CC.wheel.spin) return;
  const tot = CC_WHEEL.reduce((a, p) => a + p.w, 0); let x = Math.random() * tot, idx = 0;
  while (x >= CC_WHEEL[idx].w) { x -= CC_WHEEL[idx].w; idx++; }
  const d = ccData(); d.wheel = Date.now(); persist();
  const seg = TAU / CC_WHEEL.length, cur = CC.wheel.a % TAU;
  const end = CC.wheel.a - cur + TAU * 6 + (TAU - idx * seg) + (Math.random() - 0.5) * seg * 0.6;
  Object.assign(CC.wheel, { spin: true, from: CC.wheel.a, to: end, t: 0, idx, last: -1 });
  $('ccSpin').disabled = true;
}
function ccWheelStep(dt) {
  const W = CC.wheel; W.t += dt / 4.6;
  const t = Math.min(1, W.t), e = 1 - Math.pow(1 - t, 4);
  W.a = W.from + (W.to - W.from) * e;
  const tick = Math.floor(W.a / (TAU / CC_WHEEL.length)); if (tick !== W.last) { W.last = tick; sfx('pick'); }
  ccDrawWheel();
  if (t >= 1) {
    W.spin = false;
    const p = CC_WHEEL[W.idx], d = ccData();
    if (p.inv) for (const k in p.inv) d.inv[k] += p.inv[k];
    if (p.coins) save.coins += p.coins;
    if (p.gems) save.gems += p.gems;
    persist(); updateVhud(); sfx('level'); setTimeout(() => sfx('coin'), 250);
    const m = $('ccWheelMsg'); if (m) m.innerHTML = `<span class="cc-won">Gagné : ${ccPrizeText(p)} !</span>`;
    if (CC.view === 'map') { $('ccInv').innerHTML = ccInvHTML(); ccWheelLabel(); } else ccBoostBar();
  }
}
// --- Entrée / sortie du mini-jeu
function startCandy() {
  ccGoblin();
  const d = ccData();
  state = 'candy'; resetVjoy();
  for (const id of ['portalM', 'classesM', 'skinsM', 'decoM', 'chestM']) $(id).hidden = true;
  $('vhud').hidden = true; $('vpanel').hidden = true; $('village').hidden = true; $('game').hidden = true;
  $('candy').hidden = false;
  if (!CC.wheelImgs) { CC.wheelImgs = {}; for (const id of ['duo', 'bomb']) { const im = new Image(); im.onload = ccDrawWheel; im.src = ccIcon(id === 'duo' ? '0:w' : '-1:b'); CC.wheelImgs[id] = im; } }
  ccToMap();
  if (d.welcome) {
    d.welcome = false; persist();
    ccPop(`<div class="cc-card"><div class="cc-ribbon">Bienvenue !</div>
      <p class="cc-msg">Aligne au moins 3 bonbons de la même couleur en les faisant glisser. Avec 4 bonbons tu obtiens un <b>bonbon rayé</b>, en L ou en T un <b>bonbon emballé</b>, et avec 5 une <b>boule arc-en-ciel</b>. Échange deux bonbons spéciaux pour un effet géant !</p>
      <div class="cc-giftbox">🎁 Cadeau de bienvenue : 1 booster de chaque sorte</div>
      <div class="cc-rew">${ccInvHTML()}</div>
      <p class="cc-msg">Tous les 5 niveaux, un <b>niveau récompense</b> 🎁 t’offre des boosters, et la <b>roue sucrée</b> se recharge toutes les 10 heures.</p>
      <div class="cc-btns"><button class="cc-btn green" data-cc="close">C’est parti !</button></div></div>`);
  }
}
function quitCandy() {
  if (CB && !CB.done && CC.view === 'play') { const d = ccData(); d.streak = 0; persist(); }
  CB = null; CC.waits = []; CC.view = 'map'; ccClosePop();
  $('candy').hidden = true;
  state = 'village'; showOnly('village');
  if (V.ok) { resetVjoy(); placeHeroCam(true); updateVhud(); }
}
$('ccBack').addEventListener('click', quitCandy);
$('ccWheelBtn').addEventListener('click', ccOpenWheel);
$('ccQuit').addEventListener('click', () => {
  if (!CB) return;
  if (CB.done) return;
  const d = ccData();
  ccPop(`<div class="cc-card"><div class="cc-ribbon sad">Quitter le niveau ?</div><p class="cc-msg">Le niveau sera perdu${d.streak ? ` et ta série de ${d.streak} victoire${d.streak > 1 ? 's' : ''} retombera à zéro` : ''}.</p>
    <div class="cc-btns"><button class="cc-btn blue" data-cc="giveup">Quitter</button><button class="cc-btn green" data-cc="close">Continuer</button></div></div>`);
});
$('candy').addEventListener('click', e => {
  const b = e.target.closest('[data-cc]'); if (!b || b.disabled) return;
  const [act, arg] = b.dataset.cc.split(':');
  if (act === 'lvl') ccOpenLevel(+arg);
  else if (act === 'play') ccStart(+arg);
  else if (act === 'close') { ccClosePop(); if (CC.view === 'map') { $('ccInv').innerHTML = ccInvHTML(); ccWheelLabel(); } }
  else if (act === 'pre') {
    const d = ccData();
    if (!d.inv[arg]) { if (ccBuy(arg)) CC.pre[arg] = true; }
    else CC.pre[arg] = !CC.pre[arg];
    ccOpenLevel(CC.lastOpen);
  }
  else if (act === 'use') ccUse(arg);
  else if (act === 'buy') { if (ccBuy(arg)) { ccClosePop(); ccBoostBar(); } }
  else if (act === 'more5') ccMore5();
  else if (act === 'giveup') ccGiveUp();
  else if (act === 'tomap') ccToMap();
  else if (act === 'next') { const n = CC.level + 1; ccToMap(); ccOpenLevel(n); }
  else if (act === 'spin') ccSpin();
  sfx('pick');
});
ccv.addEventListener('pointerdown', e => {
  if (CB && CB.finale) { CB.skip = true; return; }
  if (!CB || CB.busy || CB.done || CC.pop) return;
  e.preventDefault();
  const rc = ccv.getBoundingClientRect(), sz = rc.width / CB.C, c = Math.floor((e.clientX - rc.left) / sz), r = Math.floor((e.clientY - rc.top) / sz), cl = ccCell(r, c);
  if (!cl || !cl.ok) return;
  CB.idle = 0; CB.hint = null;
  if (CC.tool === 'hammer') { ccHammer(r, c); return; }
  if (CB.sel && Math.abs(CB.sel[0] - r) + Math.abs(CB.sel[1] - c) === 1) { const s = CB.sel; CB.sel = null; ccTrySwap(s[0], s[1], r, c); return; }
  CB.sel = ccMov(cl) ? [r, c] : null;
  CC.drag = CB.sel ? { r, c, x: e.clientX, y: e.clientY } : null;
  try { ccv.setPointerCapture(e.pointerId); } catch (err) {}
});
ccv.addEventListener('pointermove', e => {
  const D = CC.drag; if (!D || !CB) return;
  const dx = e.clientX - D.x, dy = e.clientY - D.y;
  if (Math.hypot(dx, dy) < CC.S * UIZ * 0.32) return;
  CC.drag = null; CB.sel = null;
  const [r2, c2] = Math.abs(dx) > Math.abs(dy) ? [D.r, D.c + Math.sign(dx)] : [D.r + Math.sign(dy), D.c];
  ccTrySwap(D.r, D.c, r2, c2);
});
ccv.addEventListener('pointerup', () => { CC.drag = null; });
ccv.addEventListener('pointercancel', () => { CC.drag = null; });
window.addEventListener('resize', () => { if (state === 'candy' && CC.view === 'play') ccResize(); });
function renderCandyCard() {
  const d = ccData(), tot = Object.values(d.stars).reduce((a, b) => a + b, 0);
  $('pmCandy').textContent = `Niveau ${d.lvl} · ${tot} ★`;
  const art = $('ccArt');
  if (!art.dataset.done) { art.dataset.done = 1; art.innerHTML = [0, 1, 2, 3, 4, 5].map(c => `<img src="${ccIcon(c + ':' + (c === 1 ? 'h' : c === 4 ? 'w' : ''))}" alt="">`).join('') + `<img src="${ccIcon('-1:b')}" alt="">`; }
}

// ---------- Boucle ----------
let last = performance.now();
// Rythme régulier au village : sur un écran 90/120 Hz, si l'appareil ne tient pas une image à chaque rafraîchissement,
// les images alternent 11 et 22 ms (saccades). On dessine alors une fois sur deux : 45/60 images/s, mais bien régulières.
const PACE = { vs: 1000, half: false, skip: false, slow: 0, fast: 0 };
function paceSkip(now) {
  const g = PACE.last ? now - PACE.last : 16; PACE.last = now;
  if (g > 6 && g < PACE.vs) PACE.vs = g;   // plus petit intervalle vu = rafraîchissement de l'écran
  if (PACE.half) { PACE.skip = !PACE.skip; if (PACE.skip) return true; }
  return false;
}
function paceAdjust(gap) {
  const vs = PACE.vs; if (vs > 30) return;
  if (!PACE.half) { PACE.slow = gap > vs * 1.5 ? PACE.slow + 1 : Math.max(0, PACE.slow - 1); if (PACE.slow > 20) { PACE.half = true; PACE.slow = 0; PACE.fast = 0; } }
  // en demi-cadence, on retente la pleine cadence de temps en temps (toutes les ~60 s) si les images sont toutes à l'heure
  else { PACE.fast = gap < vs * 2.3 ? PACE.fast + 1 : 0; if (PACE.fast > 2700) { PACE.half = false; PACE.fast = 0; } }
}
function frame(now) {
  if (state === 'village' && V.ok && !window.__loading && paceSkip(now)) { requestAnimationFrame(frame); return; }
  if (save.fps) fpsTick(now);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  coopTick(dt);villageNetworkTick(dt);
  if (state === 'wolf') { if (V.ok) renderWolf(dt); }
  else if (state === 'wolfduo') { /* event-driven network game */ }
  else if (state === 'candy') ccFrame(dt);
  else if (state === 'village') {
    if (V.ok && !window.__loading) {
      // mesure des à-coups (compteur d'images des paramètres) : quelle partie de l'image a pris le plus de temps
      { const gp = PACE.prevR ? now - PACE.prevR : 0; PACE.prevR = now; if (gp) paceAdjust(gp); }
      const t0 = performance.now(); updateVillage(dt); const t1 = performance.now(); renderVillage(); const t2 = performance.now(); renderPreview(dt); if (document.visibilityState === 'visible') watchGfx(dt); const t3 = performance.now();
      if (save.fps) { FPSM.js = t3 - t0; const parts = [['village', t1 - t0], ['dessin', t2 - t1], ['réglages', t3 - t2]].sort((a, b) => b[1] - a[1]); FPSM.part = parts[0][1] > 8 ? parts[0][0] + ' ' + Math.round(parts[0][1]) : ''; }
    }
  } else {
    if (state === 'play' && G) { if (!coop.active || session.role === 'host') { update(dt); if (save.speed2 && !coop.active && !G.dungeon && state === 'play') update(dt); } else { G=guestMotion.step(dt,localInput()); } updateHud(); }
    else if (G && state === 'over') { G.t += dt; for (const q of G.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; } G.parts = G.parts.filter(q => q.life > 0); }
    // vue à la 1re personne (Bastion, donjon) ou vue de dessus
    const fp = fpOn(); $('fpv').hidden = !fp; $('fpCross').hidden = !fp; $('bAim').hidden = !fp || !FP_AIM_BTN; if ((!fp || !FP_AIM_BTN) && FP.aim) setAim(false);
    if (fp) renderFP(dt); else render();
    if (save.fps) FPSM.js = performance.now() - now;
  }
  if (state === 'village' && !$('fpv').hidden) { $('fpv').hidden = true; $('fpCross').hidden = true; }
  updateNpcTalk(dt);
  requestAnimationFrame(frame);
}
applyUI();
refreshSoundBtn();
showOnly('village');
applyGfx();
try { initVillage(); lightenVillage(); updateVhud(); } catch (e) { console.error(e); V.ok = false; villageFailed(); }
preloadAll();
function lightenVillage() {
  V.scene.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    const s = o.getWorldScale(new THREE.Vector3()), r = o.geometry.boundingSphere.radius * Math.max(s.x, s.y, s.z);
    if (r < 0.45) o.castShadow = false; else if (o.castShadow) o.userData.bigShadow = true;
    if (r < 0.2) o.receiveShadow = false;
  });
}
requestAnimationFrame(frame);
})();