'use strict';

/* ============================= CONSTANTES ============================= */

const SAVE_KEY = 'avidite_save_v1';
const BASE_FACES = 50;
const BASE_ENERGY = 10;

const ACTION_BASE_COST = { mine: 4, canal: 12, anti: 7, rejet: 30, rajeun: 10, convert: 1 };
const IMPROVEMENT_BASE_COST = { y: 14, z: 40, luck: 8, extraFaces: 40, x: 30 };

const ACTIONS = [
  { key: 'mine', name: 'Mine', currency: 'energy',
    desc: () => `+1 or dans 10 tours.` },
  { key: 'canal', name: 'Canalisation', currency: 'energy',
    desc: () => `+1 énergie/tour, toute la partie.` },
  { key: 'anti', name: 'Anti-destinée', currency: 'energy',
    desc: () => `Prochain lancer : jamais 1.` },
  { key: 'rejet', name: 'Rejet', currency: 'energy',
    desc: () => `Relance : sauve d'un 1.` },
  { key: 'rajeun', name: 'Rajeunissement', currency: 'energy',
    desc: () => `+1 face au dé, toute la partie.` },
  { key: 'convert', name: 'Alchimie', currency: 'gold', requiresLevel: 'x',
    desc: () => `1 or → ${meta.lvl.x} énergie.` },
];

const IMPROVEMENTS = [
  { key: 'y', name: 'Œil du Trésor',
    desc: 'Dé 45-55 : + or.', unit: (v) => `+${v} or / coup` },
  { key: 'z', name: 'Souffle Vivace',
    desc: 'Dé pair : + énergie au tour suivant.', unit: (v) => `+${v} énergie / coup` },
  { key: 'luck', name: 'Faveur du Sort',
    desc: 'Réduit la chance des chiffres impairs.', unit: (v) => `×${(1/Math.pow(1.10,v)).toFixed(3)} risque` },
  { key: 'extraFaces', name: 'Horloge Agrandie',
    desc: '+1 face de départ, chaque partie.', unit: (v) => `${BASE_FACES + v} faces au départ` },
  { key: 'x', name: 'Alchimie',
    desc: 'Débloque puis améliore l\'Alchimie.', unit: (v) => v > 0 ? `+${v} énergie / or` : 'verrouillée' },
];

const DEFAULT_KEYBINDS = {
  mine: '1', canal: '2', anti: '3', rejet: '4', rajeun: '5', convert: '6',
  double: 'D', cashout: 'T', endturn: 'Enter',
};

const KEYBIND_ORDER = ['mine', 'canal', 'anti', 'rejet', 'rajeun', 'convert', 'double', 'cashout', 'endturn'];
const KEYBIND_LABELS = {
  mine: 'Mine', canal: 'Canalisation', anti: 'Anti-destinée', rejet: 'Rejet',
  rajeun: 'Rajeunissement', convert: 'Alchimie',
  double: "Doubler l'énergie", cashout: 'Terminer la partie', endturn: 'Fin du tour',
};

const DICE_SPEEDS = {
  lente: { label: 'Lente', mult: 1.6 },
  normale: { label: 'Normale', mult: 1 },
  rapide: { label: 'Rapide', mult: 0.5 },
  instant: { label: 'Instantanée', mult: 0.12 },
};
const SPIN_BASE_MS = 1150;
const HOLD_BASE_MS = 1000;

/* ============================= ETAT ============================= */

let meta = loadMeta();
let run = null;
let rebindListenerActive = false;

function defaultMeta() {
  return {
    gold: 0,
    lvl: { y: 0, z: 0, luck: 0, extraFaces: 0, x: 0 },
    cost: { ...IMPROVEMENT_BASE_COST },
    keybinds: { ...DEFAULT_KEYBINDS },
    diceSpeed: 'normale',
  };
}

function loadMeta() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultMeta();
    const parsed = JSON.parse(raw);
    const d = defaultMeta();
    return {
      gold: typeof parsed.gold === 'number' ? parsed.gold : d.gold,
      lvl: { ...d.lvl, ...(parsed.lvl || {}) },
      cost: { ...d.cost, ...(parsed.cost || {}) },
      keybinds: { ...d.keybinds, ...(parsed.keybinds || {}) },
      diceSpeed: DICE_SPEEDS[parsed.diceSpeed] ? parsed.diceSpeed : d.diceSpeed,
    };
  } catch (e) {
    return defaultMeta();
  }
}

function saveMeta() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(meta));
}

function newRun() {
  run = {
    turn: 0,
    turnsPassed: 0,
    energy: 0,
    gold: 0,
    costs: { ...ACTION_BASE_COST },
    canalBonus: 0,
    rajeunBonus: 0,
    antiCharges: 0,
    rerollTokens: 0,
    pendingMines: [],
    pendingZ: 0,
    usedDouble: false,
    alive: true,
    ended: false,
    rolling: false,
  };
  startNewTurn();
}

/* ============================= LOGIQUE DE JEU ============================= */

function currentFaces() {
  return Math.max(1, BASE_FACES + meta.lvl.extraFaces + run.rajeunBonus - run.turnsPassed);
}

function weightedRoll(faces, luckLevel, excludeOne) {
  const oddWeight = 1 / Math.pow(1.10, luckLevel);
  const start = (excludeOne && faces > 1) ? 2 : 1;
  const weights = [];
  let total = 0;
  for (let v = start; v <= faces; v++) {
    const w = (v % 2 === 0) ? 1 : oddWeight;
    weights.push(w);
    total += w;
  }
  let r = Math.random() * total;
  for (let v = start; v <= faces; v++) {
    r -= weights[v - start];
    if (r <= 0) return v;
  }
  return faces;
}

function rollJudgmentDie(faces) {
  if (run.antiCharges > 0 && faces > 1) {
    run.antiCharges -= 1;
    return weightedRoll(faces, meta.lvl.luck, true);
  }
  return weightedRoll(faces, meta.lvl.luck, false);
}

function startNewTurn() {
  // faire mûrir les mines en attente
  const matured = [];
  run.pendingMines.forEach(m => m.left--);
  run.pendingMines = run.pendingMines.filter(m => {
    if (m.left <= 0) { matured.push(m); return false; }
    return true;
  });
  if (matured.length) {
    run.gold += matured.length;
  }

  run.turn++;
  run.energy += BASE_ENERGY + run.canalBonus + run.pendingZ;
  run.pendingZ = 0;
  render();
}

function canAfford(action) {
  const cost = run.costs[action.key];
  if (action.currency === 'gold') return run.gold >= cost;
  return run.energy >= cost;
}

function doAction(key) {
  if (!run || !run.alive || run.ended || run.rolling) return;
  const action = ACTIONS.find(a => a.key === key);
  if (!action) return;
  if (action.requiresLevel && meta.lvl[action.requiresLevel] <= 0) return;
  if (!canAfford(action)) return;

  const cost = run.costs[key];
  if (action.currency === 'gold') run.gold -= cost; else run.energy -= cost;

  switch (key) {
    case 'mine':
      run.pendingMines.push({ left: 10 });
      break;
    case 'canal':
      run.canalBonus += 1;
      break;
    case 'anti':
      run.antiCharges += 1;
      break;
    case 'rejet':
      run.rerollTokens += 1;
      break;
    case 'rajeun':
      run.rajeunBonus += 1;
      break;
    case 'convert':
      run.energy += meta.lvl.x;
      break;
  }

  run.costs[key] = Math.ceil(cost * 1.2);
  render();
}

function doubleEnergy() {
  if (!run || !run.alive || run.ended || run.rolling || run.usedDouble) return;
  run.energy *= 2;
  run.usedDouble = true;
  render();
}

function cashOut() {
  if (!run || !run.alive || run.ended || run.rolling) return;
  const gained = run.gold;
  meta.gold += gained;
  saveMeta();
  run.ended = true;
  document.getElementById('cashoutSummary').textContent =
    gained > 0 ? `${gained} or encaissé.` : `Aucun or, mais vivant.`;
  showOverlay('cashoutOverlay');
  render();
}

function death() {
  const lost = run.gold;
  run.gold = 0;
  run.alive = false;
  document.getElementById('deathSummary').textContent =
    `${run.turnsPassed} tour${run.turnsPassed > 1 ? 's' : ''} survécu${run.turnsPassed > 1 ? 's' : ''}. ${lost} or perdu.`;

  const flash = document.getElementById('deathFlash');
  flash.classList.remove('active');
  void flash.offsetWidth;
  flash.classList.add('active');

  const grid = document.querySelector('.game-grid');
  grid.classList.remove('shake');
  void grid.offsetWidth;
  grid.classList.add('shake');

  showOverlay('deathOverlay');
  render();
}

/* ---- résolution de fin de tour / lancer du dé (tout se joue sur la roue elle-même) ---- */

let dialRotation = 0;

function speedMult() {
  const s = DICE_SPEEDS[meta.diceSpeed] ? meta.diceSpeed : 'normale';
  return DICE_SPEEDS[s].mult;
}
function spinMs() { return Math.round(SPIN_BASE_MS * speedMult()); }
function holdMs() { return Math.round(HOLD_BASE_MS * speedMult()); }

function applyDiceSpeed() {
  document.documentElement.style.setProperty('--spin-duration', (1.1 * speedMult()).toFixed(2) + 's');
}

function endTurn() {
  if (!run || !run.alive || run.ended || run.rolling) return;
  run.rolling = true;
  render();
  // le tour ne fait avancer le compteur de faces que d'une seule unité,
  // quel que soit le nombre de relances internes à ce tour (voir concludeTurn)
  const faces = currentFaces();
  const value = rollJudgmentDie(faces);
  spinDialTo(value, faces);
  setTimeout(() => resolveRoll(value), spinMs());
}

function spinDialTo(value, faces) {
  const angle = (value / faces) * 360;
  const base = dialRotation - (dialRotation % 360);
  dialRotation = base + 3 * 360 + angle;
  document.getElementById('needleGroup').style.transform = `rotate(${dialRotation}deg)`;
}

function showDialNumber(value, kind) {
  document.getElementById('faceCountLabel').textContent = value;
  document.querySelector('.face-word').textContent = 'jugement';
  const wrap = document.getElementById('dialResult');
  wrap.classList.remove('flash-good', 'flash-bad');
  void wrap.offsetWidth;
  wrap.classList.add(kind === 'bad' ? 'flash-bad' : 'flash-good');
}

function resolveRoll(value) {
  showDialNumber(value, value === 1 ? 'bad' : 'good');

  setTimeout(() => {
    if (value === 1) {
      if (run.rerollTokens > 0) {
        run.rerollTokens -= 1;
        const faces = currentFaces();
        const v2 = rollJudgmentDie(faces);
        spinDialTo(v2, faces);
        setTimeout(() => resolveRoll(v2), spinMs());
      } else {
        death();
      }
    } else {
      if (value % 2 === 0 && meta.lvl.z > 0) {
        run.pendingZ += meta.lvl.z;
      }
      if (value >= 45 && value <= 55 && meta.lvl.y > 0) {
        run.gold += meta.lvl.y;
      }
      concludeTurn();
    }
  }, holdMs());
}

function concludeTurn() {
  // un seul incrément par tour : le nombre de faces maximal baisse d'exactement 1
  run.turnsPassed += 1;
  run.rolling = false;
  document.getElementById('dialResult').classList.remove('flash-good', 'flash-bad');
  document.querySelector('.face-word').textContent = 'faces';
  startNewTurn();
}

/* ============================= RENDU ============================= */

function render() {
  if (!run) return;

  document.getElementById('turnNum').textContent = run.turn;
  document.getElementById('energyVal').textContent = run.energy;
  document.getElementById('goldRun').textContent = run.gold;
  document.getElementById('goldBank').textContent = meta.gold;
  if (!run.rolling) {
    document.getElementById('faceCountLabel').textContent = currentFaces();
  }

  const dangerMix = Math.min(1, run.turnsPassed / (BASE_FACES + meta.lvl.extraFaces + run.rajeunBonus - 1));
  document.documentElement.style.setProperty('--danger-mix', isFinite(dangerMix) ? dangerMix.toFixed(3) : '0');

  const antiBadge = document.getElementById('badgeAnti');
  antiBadge.hidden = run.antiCharges <= 0;
  document.getElementById('badgeAntiVal').textContent = run.antiCharges;

  const rerollBadge = document.getElementById('badgeReroll');
  rerollBadge.hidden = run.rerollTokens <= 0;
  document.getElementById('badgeRerollVal').textContent = run.rerollTokens;

  renderMines();
  renderActions();

  const locked = !run.alive || run.ended || run.rolling;
  document.getElementById('btnEndTurn').disabled = locked;
  document.getElementById('btnDouble').disabled = locked || run.usedDouble;
  document.getElementById('btnCashout').disabled = locked;
}

function renderMines() {
  const row = document.getElementById('minesRow');
  row.innerHTML = '';
  run.pendingMines.forEach(m => {
    const chip = document.createElement('div');
    chip.className = 'mine-chip';
    chip.innerHTML = `<span class="badge-icon">⛏</span>${m.left}`;
    row.appendChild(chip);
  });
}

function renderActions() {
  const grid = document.getElementById('actionsGrid');
  grid.innerHTML = '';
  ACTIONS.forEach(action => {
    const cost = run.costs[action.key];
    const locked = action.requiresLevel && meta.lvl[action.requiresLevel] <= 0;
    const affordable = canAfford(action) && !locked && run.alive && !run.ended && !run.rolling;

    const btn = document.createElement('button');
    btn.className = 'action-card';
    btn.disabled = !affordable;
    btn.innerHTML = `
      <span class="action-name">${action.name}</span>
      <span class="action-effect">${locked ? 'Verrouillée.' : action.desc()}</span>
      <span class="action-cost">${cost} ${action.currency === 'gold' ? 'or' : 'énergie'}</span>
    `;
    btn.addEventListener('click', () => doAction(action.key));
    grid.appendChild(btn);
  });
}

function renderShop() {
  document.getElementById('shopGoldBank').textContent = meta.gold;
  const grid = document.getElementById('shopGrid');
  grid.innerHTML = '';
  IMPROVEMENTS.forEach(imp => {
    const lvl = meta.lvl[imp.key];
    const cost = meta.cost[imp.key];
    const div = document.createElement('div');
    div.className = 'shop-card-item';
    div.innerHTML = `
      <span class="name">${imp.name}</span>
      <span class="desc">${imp.desc}</span>
      <span class="level">Niveau <b>${lvl}</b> — ${imp.unit(lvl)}</span>
      <button class="buy-btn" ${meta.gold < cost ? 'disabled' : ''}>Améliorer — ${cost} or</button>
    `;
    div.querySelector('.buy-btn').addEventListener('click', () => buyImprovement(imp.key));
    grid.appendChild(div);
  });
}

function buyImprovement(key) {
  const cost = meta.cost[key];
  if (meta.gold < cost) return;
  meta.gold -= cost;
  meta.lvl[key] += 1;
  meta.cost[key] = Math.ceil(cost * 1.2);
  saveMeta();
  renderShop();
  render();
}

/* ---- overlays ---- */

function showOverlay(id) {
  document.getElementById(id).hidden = false;
}
function hideOverlay(id) {
  document.getElementById(id).hidden = true;
}

/* ============================= RACCOURCIS CLAVIER ============================= */

function normalizeKey(rawKey) {
  if (rawKey === ' ') return 'Espace';
  if (rawKey.length === 1) return rawKey.toUpperCase();
  return rawKey;
}

function keyLabel(k) {
  if (!k) return '—';
  if (k === 'Enter') return '↵';
  if (k === 'Escape') return 'Échap';
  return k;
}

function renderSettings() {
  renderSpeedOptions();

  const list = document.getElementById('keybindList');
  list.innerHTML = '';
  KEYBIND_ORDER.forEach(actionKey => {
    const row = document.createElement('div');
    row.className = 'keybind-row';
    row.innerHTML = `
      <span class="kb-name">${KEYBIND_LABELS[actionKey]}</span>
      <span class="kb-controls">
        <span class="kb-key">${keyLabel(meta.keybinds[actionKey])}</span>
        <button class="kb-change-btn">Changer</button>
      </span>
    `;
    row.querySelector('.kb-change-btn').addEventListener('click', (e) => startRebind(actionKey, e.currentTarget));
    list.appendChild(row);
  });
}

function renderSpeedOptions() {
  const wrap = document.getElementById('speedOptions');
  wrap.innerHTML = '';
  Object.keys(DICE_SPEEDS).forEach(key => {
    const btn = document.createElement('button');
    btn.className = 'speed-btn' + (meta.diceSpeed === key ? ' active' : '');
    btn.textContent = DICE_SPEEDS[key].label;
    btn.addEventListener('click', () => {
      meta.diceSpeed = key;
      saveMeta();
      applyDiceSpeed();
      renderSpeedOptions();
    });
    wrap.appendChild(btn);
  });
}

function startRebind(actionKey, buttonEl) {
  if (rebindListenerActive) return;
  rebindListenerActive = true;
  buttonEl.textContent = 'Appuyez sur une touche…';
  buttonEl.classList.add('listening');

  const handler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.removeEventListener('keydown', handler, true);
    rebindListenerActive = false;
    const newKey = normalizeKey(e.key);
    if (newKey !== 'Escape') {
      Object.keys(meta.keybinds).forEach(k => {
        if (meta.keybinds[k] === newKey) meta.keybinds[k] = '';
      });
      meta.keybinds[actionKey] = newKey;
      saveMeta();
    }
    renderSettings();
  };
  window.addEventListener('keydown', handler, true);
}

function handleGlobalKeydown(e) {
  if (rebindListenerActive) return;
  if (document.querySelector('.overlay:not([hidden])')) return;
  if (!run) return;

  const key = normalizeKey(e.key);
  const kb = meta.keybinds;

  if (key === kb.endturn) { e.preventDefault(); endTurn(); return; }
  if (key === kb.double) { doubleEnergy(); return; }
  if (key === kb.cashout) { cashOut(); return; }
  for (const action of ACTIONS) {
    if (key === kb[action.key]) { doAction(action.key); return; }
  }
}

function handleGlobalEscape(e) {
  if (normalizeKey(e.key) !== 'Escape' || rebindListenerActive) return;
  ['settingsOverlay', 'rulesOverlay', 'shopOverlay'].forEach(id => {
    const el = document.getElementById(id);
    if (!el.hidden) el.hidden = true;
  });
}

/* ============================= DECOR (étoiles + cadran) ============================= */

function buildStars() {
  const wrap = document.getElementById('stars');
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 90; i++) {
    const s = document.createElement('span');
    s.style.left = Math.random() * 100 + '%';
    s.style.top = Math.random() * 65 + '%';
    s.style.animationDelay = (Math.random() * 4).toFixed(2) + 's';
    s.style.animationDuration = (3 + Math.random() * 3).toFixed(2) + 's';
    frag.appendChild(s);
  }
  wrap.appendChild(frag);
}

const ROMAN = ['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];

function buildDial() {
  const ticks = document.getElementById('ticks');
  const numerals = document.getElementById('numerals');
  const cx = 200, cy = 200;
  for (let i = 0; i < 60; i++) {
    const angle = (i / 60) * Math.PI * 2 - Math.PI / 2;
    const major = i % 5 === 0;
    const rOuter = 150;
    const rInner = major ? 134 : 142;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', cx + Math.cos(angle) * rOuter);
    line.setAttribute('y1', cy + Math.sin(angle) * rOuter);
    line.setAttribute('x2', cx + Math.cos(angle) * rInner);
    line.setAttribute('y2', cy + Math.sin(angle) * rInner);
    if (major) line.setAttribute('class', 'major');
    ticks.appendChild(line);
  }
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const r = 118;
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', cx + Math.cos(angle) * r);
    text.setAttribute('y', cy + Math.sin(angle) * r);
    text.textContent = ROMAN[i];
    numerals.appendChild(text);
  }
}

/* ============================= INIT / EVENTS ============================= */

function wireEvents() {
  document.getElementById('btnStart').addEventListener('click', () => {
    hideOverlay('startOverlay');
    newRun();
  });

  document.getElementById('btnEndTurn').addEventListener('click', endTurn);
  document.getElementById('btnDouble').addEventListener('click', doubleEnergy);
  document.getElementById('btnCashout').addEventListener('click', cashOut);

  document.getElementById('btnShop').addEventListener('click', () => {
    renderShop();
    showOverlay('shopOverlay');
  });
  document.getElementById('btnCloseShop').addEventListener('click', () => hideOverlay('shopOverlay'));
  document.getElementById('btnResetSave').addEventListener('click', () => {
    if (confirm('Réinitialiser toute la progression permanente (or banqué et améliorations) ?')) {
      localStorage.removeItem(SAVE_KEY);
      meta = defaultMeta();
      applyDiceSpeed();
      renderShop();
      render();
      document.getElementById('startGoldBank').textContent = meta.gold;
    }
  });

  document.getElementById('btnRules').addEventListener('click', () => showOverlay('rulesOverlay'));
  document.getElementById('btnCloseRules').addEventListener('click', () => hideOverlay('rulesOverlay'));

  document.getElementById('btnSettings').addEventListener('click', () => {
    renderSettings();
    showOverlay('settingsOverlay');
  });
  document.getElementById('btnCloseSettings').addEventListener('click', () => hideOverlay('settingsOverlay'));
  document.getElementById('btnResetKeybinds').addEventListener('click', () => {
    meta.keybinds = { ...DEFAULT_KEYBINDS };
    saveMeta();
    renderSettings();
  });

  document.getElementById('btnDeathRestart').addEventListener('click', () => {
    hideOverlay('deathOverlay');
    newRun();
  });

  document.getElementById('btnCashRestart').addEventListener('click', () => {
    hideOverlay('cashoutOverlay');
    newRun();
  });

  window.addEventListener('keydown', handleGlobalEscape);
  window.addEventListener('keydown', handleGlobalKeydown);
}

function init() {
  buildStars();
  buildDial();
  applyDiceSpeed();
  wireEvents();
  document.getElementById('startGoldBank').textContent = meta.gold;
}

document.addEventListener('DOMContentLoaded', init);
