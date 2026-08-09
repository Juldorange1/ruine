// Logique de la vue "Jeu". Aucune règle ici (tout est dans engine.js) : ce
// fichier pilote juste le DOM du plateau de jeu, le clavier, et les modales
// Règles/Réglages. `startPlaying(levelObj)` est appelée par app.js quand on
// clique "Jouer" — plus aucun passage par localStorage/navigation de page,
// tout se fait en mémoire sur la même page (voir DESIGN_NOTES.md, le bug de
// "jouer ne marche pas" venait du `file://` qui casse localStorage entre deux
// documents distincts).

const KEYBINDINGS_KEY = "mammoths_keybindings_v1";
const DEFAULT_KEYS = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };

function loadKeybindings() {
  try {
    const raw = localStorage.getItem(KEYBINDINGS_KEY);
    return raw ? { ...DEFAULT_KEYS, ...JSON.parse(raw) } : { ...DEFAULT_KEYS };
  } catch (e) {
    return { ...DEFAULT_KEYS };
  }
}
function saveKeybindings(kb) {
  localStorage.setItem(KEYBINDINGS_KEY, JSON.stringify(kb));
}
let keybindings = loadKeybindings();

// `LEVEL` est déclaré (avec `let`) une seule fois dans levels.js — ici on se
// contente de lui RÉAFFECTER une valeur (jamais `let`/`const` une 2e fois,
// sinon SyntaxError de redéclaration qui casserait tout le script).
function startPlaying(levelObj) {
  LEVEL = levelObj;
  game = newGame();
  selected = null;
  resizeToFit();
}

let game = null;
let selected = null;

const ui = {
  gridEl: document.getElementById("grid"),
  frameEl: document.getElementById("frame"),
  remainingEl: document.getElementById("remaining").querySelector("b"),
  msgEl: document.getElementById("msg"),
  winBanner: document.getElementById("winBanner"),
  get selected() {
    return selected;
  },
};

function refresh() {
  if (!game) return;
  render(game, ui);
}

function fullRebuild() {
  if (!game) return;
  clearRenderCaches();
  buildGrid(game, ui.gridEl);
  refresh();
}

function resizeToFit() {
  if (!game) return;
  const playerBoard = document.getElementById("playerView");
  const availWidth = playerBoard.clientWidth - 8;
  const availHeight = playerBoard.clientHeight - 8;
  computeTile(availWidth, availHeight);
  fullRebuild();
}

window.addEventListener("resize", resizeToFit);

function onMammothClick(i) {
  if (!game || game.mammoths[i].escaped) return;
  selected = selected === i ? null : i;
  refresh();
}

function onCellClick(x, y) {
  if (!game || selected === null) return;
  const m = game.mammoths[selected];
  if (!m || m.escaped) return;
  const dist = Math.abs(x - m.x) + Math.abs(y - m.y);
  if (dist !== 1) return;
  tryMove(selected, Math.sign(x - m.x), Math.sign(y - m.y));
}

function tryMove(mammothIndex, dx, dy) {
  const result = attemptMove(game, mammothIndex, dx, dy);
  if (!result.ok) {
    if (result.reason) game.lastMessage = result.reason;
    shake(ui.frameEl);
  }
  refresh();
}

document.getElementById("undoBtn").addEventListener("click", () => {
  if (!game) return;
  undo(game);
  refresh();
});

// --- Règles ------------------------------------------------------------
const rulesBackdrop = document.getElementById("rulesBackdrop");
document.getElementById("rulesBtn").addEventListener("click", () => rulesBackdrop.classList.add("show"));
document.getElementById("closeRulesBtn").addEventListener("click", () => rulesBackdrop.classList.remove("show"));
rulesBackdrop.addEventListener("click", (e) => {
  if (e.target === rulesBackdrop) rulesBackdrop.classList.remove("show");
});

// --- Réglages : personnalisation des 4 touches --------------------------
const settingsBackdrop = document.getElementById("settingsBackdrop");
let capturingDir = null;

function renderKeyButtons() {
  document.querySelectorAll(".key-capture").forEach((btn) => {
    const dir = btn.dataset.dir;
    btn.textContent = capturingDir === dir ? "..." : keybindings[dir];
    btn.classList.toggle("capturing", capturingDir === dir);
  });
}

document.getElementById("settingsBtn").addEventListener("click", () => {
  settingsBackdrop.classList.add("show");
  renderKeyButtons();
});
document.getElementById("closeSettingsBtn").addEventListener("click", () => {
  capturingDir = null;
  settingsBackdrop.classList.remove("show");
});
settingsBackdrop.addEventListener("click", (e) => {
  if (e.target === settingsBackdrop) {
    capturingDir = null;
    settingsBackdrop.classList.remove("show");
  }
});
document.querySelectorAll(".key-capture").forEach((btn) => {
  btn.addEventListener("click", () => {
    capturingDir = btn.dataset.dir;
    renderKeyButtons();
  });
});
document.getElementById("resetKeysBtn").addEventListener("click", () => {
  keybindings = { ...DEFAULT_KEYS };
  saveKeybindings(keybindings);
  renderKeyButtons();
});

// --- Clavier : capture d'une nouvelle touche OU déplacement -------------
document.addEventListener("keydown", (e) => {
  if (capturingDir) {
    e.preventDefault();
    keybindings[capturingDir] = e.key;
    saveKeybindings(keybindings);
    capturingDir = null;
    renderKeyButtons();
    return;
  }
  if (e.key === "Escape") {
    rulesBackdrop.classList.remove("show");
    settingsBackdrop.classList.remove("show");
    return;
  }
  if (settingsBackdrop.classList.contains("show") || rulesBackdrop.classList.contains("show")) return;
  if (!game || selected === null) return;
  const dirMap = {
    [keybindings.up]: [0, -1],
    [keybindings.down]: [0, 1],
    [keybindings.left]: [-1, 0],
    [keybindings.right]: [1, 0],
  };
  const d = dirMap[e.key];
  if (!d) return;
  e.preventDefault();
  tryMove(selected, d[0], d[1]);
});
