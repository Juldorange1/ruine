// Éditeur de niveau : peint un terrain case par case (ou en glissant la
// souris), place glaçons, mammouths (autant qu'on veut) et boutons, gère une
// bibliothèque de niveaux nommés dans localStorage, et appelle showPlayer()
// (app.js) pour y jouer directement en mémoire, sans changer de page. Le
// format enregistré est celui que LEVEL utilise dans engine.js (cols, rows,
// cells, exits, mammoths, ice, buttons) + un champ purement visuel (walls).
// `iceMap` est juste le nom de la variable interne de l'éditeur (pour ne pas
// entrer en collision avec le `ice` déclaré au niveau global par levels.js).
// `EDITOR_TILE`/`buildEditorGrid`/`renderEditor`/`onEditorCellClick` sont
// préfixés pour ne pas entrer en collision avec les identifiants du même nom
// dans render.js/player.js (voir Piège technique n°4 dans DESIGN_NOTES.md :
// deux <script> classiques partagent une seule portée globale).
//
// Une case a 4 états possibles :
//   'void'  - n'existe pas (la carte peut avoir n'importe quelle forme) —
//             c'est l'état de départ d'un niveau vierge, rien n'est dessiné
//   'wall'  - roche : existe, dessinée, mais infranchissable (obstacle
//             volontaire à l'intérieur de la carte)
//   'floor' - case libre, on peut y marcher / y poser quelque chose
//   'exit'  - sortie
// Pour le moteur de jeu, 'void' et 'wall' sont équivalentes (ni l'une ni
// l'autre ne sont dans `cells`) ; la distinction ne sert qu'à l'affichage.

const LEVELS_KEY = "mammoths_levels_v1";
const EDITOR_TILE = 40;
const PAINTABLE_TOOLS = new Set(["floor", "wall", "ice", "exit", "eraser"]);

let cols = 16;
let rows = 9;
let terrain = []; // terrain[y][x] = 'void' | 'wall' | 'floor' | 'exit'
let iceMap = new Map(); // id -> {x,y}
let mammoths = []; // [[x,y], ...] — autant qu'on veut
let buttons = []; // [{type,x,y,color,label,targetX?,targetY?}, ...]

let currentTool = "floor";
let pendingLink = null; // {type:'teleport', buttonIndex}
let isPainting = false;
let library = [];
let currentLevelId = null;

const gridEl = document.getElementById("editorGrid");
const msgEl = document.getElementById("msg");

function setMsg(text) {
  msgEl.textContent = text;
}

function isOpen(t) {
  return t === "floor" || t === "exit";
}

function freshTerrain(c, r) {
  const t = [];
  for (let y = 0; y < r; y++) t.push(new Array(c).fill("void"));
  return t;
}

function resetState(c, r) {
  cols = c;
  rows = r;
  terrain = freshTerrain(c, r);
  iceMap = new Map();
  mammoths = [];
  buttons = [];
}

function newIceId() {
  return `ice_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function iceIdAt(x, y) {
  for (const [id, p] of iceMap) if (p.x === x && p.y === y) return id;
  return null;
}

function mammothIndexAt(x, y) {
  return mammoths.findIndex((m) => m[0] === x && m[1] === y);
}

function buttonIndexAt(x, y) {
  return buttons.findIndex((b) => b.x === x && b.y === y);
}

function clearContentAt(x, y) {
  const id = iceIdAt(x, y);
  if (id) iceMap.delete(id);
  const mi = mammothIndexAt(x, y);
  if (mi !== -1) mammoths.splice(mi, 1);
  const bi = buttonIndexAt(x, y);
  if (bi !== -1) buttons.splice(bi, 1);
}

function toolAt(tool, x, y) {
  if (tool === "wall") {
    clearContentAt(x, y);
    terrain[y][x] = "wall";
  } else if (tool === "floor") {
    const id = iceIdAt(x, y);
    if (id) iceMap.delete(id);
    terrain[y][x] = "floor";
  } else if (tool === "exit") {
    const id = iceIdAt(x, y);
    if (id) iceMap.delete(id);
    terrain[y][x] = "exit";
  } else if (tool === "eraser") {
    clearContentAt(x, y);
    terrain[y][x] = "void";
  } else if (tool === "ice") {
    if (mammothIndexAt(x, y) !== -1 || buttonIndexAt(x, y) !== -1) {
      setMsg("Cette case a déjà un mammouth ou un bouton — efface-la d'abord.");
      return;
    }
    if (!isOpen(terrain[y][x])) terrain[y][x] = "floor";
    if (!iceIdAt(x, y)) iceMap.set(newIceId(), { x, y });
  } else if (tool === "mammoth") {
    const mi = mammothIndexAt(x, y);
    if (mi !== -1) {
      mammoths.splice(mi, 1);
      setMsg(`Mammouth retiré (${mammoths.length} placé(s)).`);
      return;
    }
    if (!isOpen(terrain[y][x]) || iceIdAt(x, y) || buttonIndexAt(x, y) !== -1) {
      setMsg("Il faut une case de sol libre pour un mammouth.");
      return;
    }
    mammoths.push([x, y]);
    setMsg(`Mammouth placé (${mammoths.length} placé(s)).`);
  } else if (tool === "teleport" || tool === "destroy") {
    if (!isOpen(terrain[y][x]) || iceIdAt(x, y) || mammothIndexAt(x, y) !== -1 || buttonIndexAt(x, y) !== -1) {
      setMsg("Il faut une case de sol libre pour un bouton.");
      return;
    }
    const color = document.getElementById("btnColor").value;
    const label = tool === "teleport" ? "T" : "D";
    buttons.push({ type: tool, x, y, color, label });
    if (tool === "teleport") {
      pendingLink = { type: "teleport", buttonIndex: buttons.length - 1 };
      setMsg("Maintenant clique la case d'arrivée du téléporteur.");
    } else {
      pendingLink = { type: "destroy", buttonIndex: buttons.length - 1 };
      setMsg("Maintenant clique le glaçon que ce bouton doit détruire.");
    }
  }
}

function onEditorCellClick(x, y) {
  if (pendingLink) {
    if (pendingLink.type === "teleport") {
      if (!isOpen(terrain[y][x])) {
        setMsg("Choisis une case de sol pour la cible du téléporteur.");
        return;
      }
      buttons[pendingLink.buttonIndex].targetX = x;
      buttons[pendingLink.buttonIndex].targetY = y;
      pendingLink = null;
      setMsg("Cible du téléporteur définie.");
      renderEditor();
      return;
    }
    if (pendingLink.type === "destroy") {
      const id = iceIdAt(x, y);
      if (!id) {
        setMsg("Choisis une case contenant un glaçon : c'est lui que ce bouton détruira.");
        return;
      }
      buttons[pendingLink.buttonIndex].linkedIce = id;
      pendingLink = null;
      setMsg("Glaçon lié défini.");
      renderEditor();
      return;
    }
  }
  toolAt(currentTool, x, y);
  renderEditor();
}

function buildEditorGrid() {
  gridEl.style.gridTemplateColumns = `repeat(${cols}, ${EDITOR_TILE}px)`;
  gridEl.style.gridTemplateRows = `repeat(${rows}, ${EDITOR_TILE}px)`;
  gridEl.style.width = cols * EDITOR_TILE + "px";
  gridEl.style.height = rows * EDITOR_TILE + "px";
  gridEl.innerHTML = "";
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = document.createElement("div");
      cell.className = "cell editable";
      cell.dataset.x = x;
      cell.dataset.y = y;
      cell.addEventListener("mousedown", (e) => {
        e.preventDefault();
        isPainting = true;
        onEditorCellClick(x, y);
      });
      cell.addEventListener("mouseenter", () => {
        if (isPainting && !pendingLink && PAINTABLE_TOOLS.has(currentTool)) onEditorCellClick(x, y);
      });
      gridEl.appendChild(cell);
    }
  }
  renderEditor();
}

document.addEventListener("mouseup", () => {
  isPainting = false;
});

function renderEditor() {
  for (const cellEl of gridEl.children) {
    const x = Number(cellEl.dataset.x);
    const y = Number(cellEl.dataset.y);
    const t = terrain[y][x];
    cellEl.className = `cell editable ${t}`;
    cellEl.classList.toggle("picking", !!pendingLink);
    cellEl.innerHTML = "";
  }
  for (const [id, pos] of iceMap) {
    const cellEl = cellAt(pos.x, pos.y);
    if (!cellEl) continue;
    const div = document.createElement("div");
    div.className = "ice-block";
    div.style.position = "absolute";
    div.style.inset = "2px";
    const linkedBtn = buttons.find((b) => b.type === "destroy" && b.linkedIce === id);
    if (linkedBtn) {
      div.classList.add("linked");
      div.style.setProperty("--link-color", linkedBtn.color);
    }
    cellEl.appendChild(div);
  }
  buttons.forEach((b) => {
    const cellEl = cellAt(b.x, b.y);
    if (!cellEl) return;
    const div = document.createElement("div");
    div.className = "button-tile";
    div.style.setProperty("--btn-color", b.color);
    const glyph = b.type === "teleport" ? "🌀" : "💥";
    div.innerHTML = `<span class="glyph">${glyph}</span><span class="label">${b.label}</span>`;
    cellEl.appendChild(div);
  });
  mammoths.forEach(([x, y], i) => {
    const cellEl = cellAt(x, y);
    if (!cellEl) return;
    const div = document.createElement("div");
    div.className = "mammoth";
    div.style.position = "absolute";
    div.style.inset = "0";
    div.style.display = "flex";
    div.style.alignItems = "center";
    div.style.justifyContent = "center";
    div.style.fontSize = "1.3rem";
    div.textContent = "🦣";
    div.title = `Mammouth ${i + 1}`;
    cellEl.appendChild(div);
  });
  document.getElementById("mammothCount").textContent = `${mammoths.length} placé(s) — autant que tu veux`;
}

function cellAt(x, y) {
  const idx = y * cols + x;
  return gridEl.children[idx] || null;
}

function serializeLevel() {
  const cells = [];
  const exits = [];
  const walls = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const t = terrain[y][x];
      if (isOpen(t)) cells.push([x, y]);
      if (t === "exit") exits.push([x, y]);
      if (t === "wall") walls.push([x, y]);
    }
  }
  return {
    cols,
    rows,
    rooms: [],
    cells,
    exits,
    walls,
    mammoths: mammoths.map((m) => [m[0], m[1]]),
    ice: [...iceMap].map(([id, p]) => ({ id, x: p.x, y: p.y })),
    buttons: buttons.map((b) => ({ ...b })),
  };
}

function loadLevelIntoEditor(levelObj) {
  cols = levelObj.cols;
  rows = levelObj.rows;
  document.getElementById("colsInput").value = cols;
  document.getElementById("rowsInput").value = rows;
  terrain = freshTerrain(cols, rows);
  for (const [x, y] of levelObj.cells || []) terrain[y][x] = "floor";
  for (const [x, y] of levelObj.exits || []) terrain[y][x] = "exit";
  for (const [x, y] of levelObj.walls || []) terrain[y][x] = "wall";
  iceMap = new Map((levelObj.ice || []).map((b) => [b.id, { x: b.x, y: b.y }]));
  mammoths = (levelObj.mammoths || []).map((m) => [m[0], m[1]]);
  buttons = (levelObj.buttons || []).map((b) => ({ ...b }));
  buildEditorGrid();
}

function validate(level) {
  const problems = [];
  if (level.mammoths.length === 0) problems.push("Il faut au moins 1 mammouth.");
  if (level.exits.length === 0) problems.push("Il faut au moins une sortie.");
  for (const b of level.buttons) {
    if (b.type === "teleport" && (b.targetX === undefined || b.targetY === undefined)) {
      problems.push("Un téléporteur n'a pas de case d'arrivée.");
    }
    if (b.type === "destroy" && !b.linkedIce) {
      problems.push("Un bouton destructeur n'a pas de glaçon lié.");
    }
  }
  return problems;
}

// --- Bibliothèque de niveaux (localStorage) -----------------------------

function loadLibrary() {
  try {
    const raw = localStorage.getItem(LEVELS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
function saveLibrary() {
  localStorage.setItem(LEVELS_KEY, JSON.stringify(library));
}

function renderLibrary() {
  const container = document.getElementById("levelList");
  container.innerHTML = "";
  if (!library.length) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "Aucun niveau enregistré pour l'instant.";
    container.appendChild(p);
    return;
  }
  library.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "level-row" + (entry.id === currentLevelId ? " active" : "");

    const nameSpan = document.createElement("span");
    nameSpan.className = "level-row-name";
    nameSpan.textContent = entry.name;
    row.appendChild(nameSpan);

    const playBtn = document.createElement("button");
    playBtn.textContent = "▶️ Jouer";
    playBtn.addEventListener("click", () => {
      showPlayer(entry.level, entry.name);
    });
    row.appendChild(playBtn);

    const loadBtn = document.createElement("button");
    loadBtn.textContent = "Charger";
    loadBtn.addEventListener("click", () => {
      currentLevelId = entry.id;
      document.getElementById("levelNameInput").value = entry.name;
      loadLevelIntoEditor(entry.level);
      renderLibrary();
      setMsg(`Niveau "${entry.name}" chargé dans l'éditeur.`);
    });
    row.appendChild(loadBtn);

    const delBtn = document.createElement("button");
    delBtn.textContent = "Supprimer";
    delBtn.addEventListener("click", () => {
      library = library.filter((l) => l.id !== entry.id);
      saveLibrary();
      if (currentLevelId === entry.id) currentLevelId = null;
      renderLibrary();
      setMsg(`Niveau "${entry.name}" supprimé.`);
    });
    row.appendChild(delBtn);

    container.appendChild(row);
  });
}

document.getElementById("saveAsBtn").addEventListener("click", () => {
  const name = document.getElementById("levelNameInput").value.trim() || "Niveau sans nom";
  const level = serializeLevel();
  const problems = validate(level);
  if (!currentLevelId) currentLevelId = `lvl_${Date.now()}`;
  const idx = library.findIndex((l) => l.id === currentLevelId);
  const entry = { id: currentLevelId, name, level };
  if (idx !== -1) library[idx] = entry;
  else library.push(entry);
  saveLibrary();
  renderLibrary();
  setMsg(problems.length ? "Enregistré, mais : " + problems.join(" ") : `Niveau "${name}" enregistré ✓`);
});

document.getElementById("newLevelBtn").addEventListener("click", () => {
  currentLevelId = null;
  document.getElementById("levelNameInput").value = "";
  resetState(Number(document.getElementById("colsInput").value) || 16, Number(document.getElementById("rowsInput").value) || 9);
  buildEditorGrid();
  renderLibrary();
  setMsg("Nouveau niveau vierge (aucune case) — n'oublie pas de l'enregistrer.");
});

// --- Outils / redimensionnement / jeu ------------------------------------

document.querySelectorAll(".tool[data-tool]").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentTool = btn.dataset.tool;
    pendingLink = null;
    document.querySelectorAll(".tool[data-tool]").forEach((b) => b.setAttribute("aria-pressed", b === btn ? "true" : "false"));
    setMsg(" ");
    renderEditor();
  });
});

document.getElementById("resizeBtn").addEventListener("click", () => {
  const c = Math.max(3, Math.min(60, Number(document.getElementById("colsInput").value) || cols));
  const r = Math.max(3, Math.min(60, Number(document.getElementById("rowsInput").value) || rows));
  resetState(c, r);
  buildEditorGrid();
  setMsg("Grille redimensionnée (contenu réinitialisé).");
});

document.getElementById("clearBtn").addEventListener("click", () => {
  resetState(cols, rows);
  buildEditorGrid();
  setMsg("Niveau vidé.");
});

document.getElementById("playBtn").addEventListener("click", () => {
  const level = serializeLevel();
  const problems = validate(level);
  if (problems.length) {
    setMsg("Corrige d'abord : " + problems.join(" "));
    return;
  }
  const name = document.getElementById("levelNameInput").value.trim() || "Niveau sans nom";
  showPlayer(level, name);
});

// --- Démarrage -----------------------------------------------------------

(function init() {
  library = loadLibrary();
  if (!library.length && typeof LEVEL !== "undefined") {
    // Amorce la bibliothèque avec le niveau "La Faille" comme exemple à
    // étudier ou modifier, histoire de ne pas partir d'une page blanche.
    library.push({ id: "example", name: "Exemple — La Faille", level: LEVEL });
    saveLibrary();
  }
  resetState(cols, rows);
  buildEditorGrid();
  document.querySelector('.tool[data-tool="floor"]').setAttribute("aria-pressed", "true");
  renderLibrary();
})();
