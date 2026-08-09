// Moteur du jeu : construit l'état à partir de LEVEL (levels.js) et applique
// les règles de déplacement/poussée/boutons. Aucune manipulation du DOM ici —
// c'est render.js qui affiche l'état que ce fichier produit.

// --- Construction du terrain --------------------------------------------

// Construit une grille 2D de caractères ('#' mur, '.' sol, 'X' sortie)
// à partir des rectangles et cases isolées de LEVEL.
function buildTerrain(level) {
  const grid = [];
  for (let y = 0; y < level.rows; y++) {
    grid.push(new Array(level.cols).fill("#"));
  }
  function setFloor(x, y) {
    grid[y][x] = ".";
  }
  for (const [x1, y1, x2, y2] of level.rooms) {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) setFloor(x, y);
    }
  }
  for (const [x, y] of level.cells) setFloor(x, y);
  for (const [ex, ey] of level.exits) grid[ey][ex] = "X";
  return grid;
}

// --- État de la partie ----------------------------------------------------

// game.terrain    : grille figée (ne change jamais après construction)
// game.ice        : Map id -> {x, y}
// game.mammoths   : [{x, y, escaped}]
// game.buttons    : [{...définition LEVEL, used}]
// game.history    : pile d'états précédents, pour Annuler
// game.won        : bool

function newGame() {
  const game = {
    terrain: buildTerrain(LEVEL),
    ice: new Map(LEVEL.ice.map((b) => [b.id, { x: b.x, y: b.y }])),
    mammoths: LEVEL.mammoths.map(([x, y]) => ({ x, y, escaped: false })),
    buttons: LEVEL.buttons.map((b) => ({ ...b, used: false })),
    history: [],
    won: false,
    lastMessage: "",
  };
  return game;
}

function terrainAt(game, x, y) {
  if (y < 0 || y >= LEVEL.rows || x < 0 || x >= LEVEL.cols) return "#";
  return game.terrain[y][x];
}

function iceIdAt(game, x, y) {
  for (const [id, pos] of game.ice) {
    if (pos.x === x && pos.y === y) return id;
  }
  return null;
}

function mammothIndexAt(game, x, y) {
  return game.mammoths.findIndex((m) => !m.escaped && m.x === x && m.y === y);
}

function buttonAt(game, x, y) {
  return game.buttons.find((b) => b.x === x && b.y === y) || null;
}

// Copie profonde suffisante pour l'historique (pas de fonctions à cloner ici).
function snapshot(game) {
  return {
    ice: new Map([...game.ice].map(([id, p]) => [id, { ...p }])),
    mammoths: game.mammoths.map((m) => ({ ...m })),
    buttons: game.buttons.map((b) => ({ ...b })),
  };
}

function restoreSnapshot(game, snap) {
  game.ice = snap.ice;
  game.mammoths = snap.mammoths;
  game.buttons = snap.buttons;
  game.won = false;
}

// --- Boutons ---------------------------------------------------------------

// `mammothIndex` vaut `null` quand le bouton est déclenché par un glaçon
// poussé dessus (plutôt que par un mammouth qui marche dessus) — voir
// checkIceButtonTriggers plus bas.
function triggerButton(game, button, mammothIndex) {
  if (button.used) return;
  button.used = true;

  if (button.type === "teleport") {
    if (mammothIndex === null) {
      // Un glaçon a été poussé sur un téléporteur : il n'y a personne à
      // téléporter, le bouton est simplement gâché.
      game.lastMessage = `Bouton ${button.label} activé par un glaçon : le téléporteur est gâché, plus personne ne pourra s'en servir.`;
      return;
    }
    const m = game.mammoths[mammothIndex];
    m.x = button.targetX;
    m.y = button.targetY;
    if (terrainAt(game, m.x, m.y) === "X") {
      m.escaped = true;
      game.lastMessage = "Téléporté... directement sur la sortie !";
    } else {
      game.lastMessage = `Bouton ${button.label} : téléportation.`;
    }
  } else if (button.type === "destroy") {
    game.ice.delete(button.linkedIce);
    game.lastMessage = `Bouton ${button.label} : le glaçon lié a été détruit.`;
  }
}

// Un glaçon qui atterrit sur la case d'un bouton non encore utilisé
// l'active, exactement comme un mammouth qui marche dessus.
function checkIceButtonTriggers(game, iceIds) {
  for (const id of iceIds) {
    const pos = game.ice.get(id);
    if (!pos) continue;
    const button = buttonAt(game, pos.x, pos.y);
    if (button && !button.used) triggerButton(game, button, null);
  }
}

// --- Déplacement / poussée --------------------------------------------------
//
// Un mammouth seul pousse toujours un glaçon isolé d'une case. Mais pour
// pousser N glaçons collés les uns aux autres dans le sens du déplacement,
// il faut N mammouths alignés juste derrière, qui avancent tous ensemble au
// même coup (chacun prend la place de celui qui le précédait). C'est ce qui
// oblige les mammouths à se regrouper pour certains passages.

// Résultat : { ok: true } si le coup a eu lieu, { ok: false, reason } sinon.
// Ne modifie l'état QUE si le coup est valide.
function attemptMove(game, mammothIndex, dx, dy) {
  if (game.won) return { ok: false, reason: "" };
  const mover = game.mammoths[mammothIndex];
  if (!mover || mover.escaped) return { ok: false, reason: "" };

  const tx = mover.x + dx;
  const ty = mover.y + dy;
  const terrain = terrainAt(game, tx, ty);
  if (terrain === "#") {
    return { ok: false, reason: "Un mur bloque le passage." };
  }

  if (!iceIdAt(game, tx, ty)) {
    // Case simple : pas de glaçon devant.
    if (mammothIndexAt(game, tx, ty) !== -1) {
      return { ok: false, reason: "Un autre mammouth occupe déjà cette case." };
    }
    game.history.push(snapshot(game));
    mover.x = tx;
    mover.y = ty;
    game.lastMessage = "";
    finishMove(game, [mammothIndex]);
    return { ok: true };
  }

  // Un ou plusieurs glaçons collés devant : compter la chaîne.
  const iceChain = [];
  let k = 0;
  while (true) {
    const cx = mover.x + dx * (k + 1);
    const cy = mover.y + dy * (k + 1);
    const id = iceIdAt(game, cx, cy);
    if (!id) break;
    iceChain.push(id);
    k++;
  }
  const landX = mover.x + dx * (k + 1);
  const landY = mover.y + dy * (k + 1);
  const landTerrain = terrainAt(game, landX, landY);
  if (landTerrain === "#") {
    return {
      ok: false,
      reason: k === 1 ? "Le glaçon buterait contre un mur : poussée impossible." : "Les glaçons buteraient contre un mur : poussée impossible.",
    };
  }
  if (mammothIndexAt(game, landX, landY) !== -1) {
    return { ok: false, reason: "Un mammouth occupe la case où le glaçon devrait aller." };
  }

  // Chaîne de mammouths alignés juste derrière le meneur (lui inclus).
  const chain = [mammothIndex];
  {
    let cx = mover.x - dx;
    let cy = mover.y - dy;
    while (true) {
      const idx = mammothIndexAt(game, cx, cy);
      if (idx === -1) break;
      chain.push(idx);
      cx -= dx;
      cy -= dy;
    }
  }
  if (chain.length < k) {
    return {
      ok: false,
      reason: `Il faut ${k} mammouths alignés juste derrière, poussant ensemble, pour déplacer ${k} glaçons collés.`,
    };
  }

  game.history.push(snapshot(game));
  for (const id of iceChain) {
    const pos = game.ice.get(id);
    game.ice.set(id, { x: pos.x + dx, y: pos.y + dy });
  }
  for (const idx of chain) {
    game.mammoths[idx].x += dx;
    game.mammoths[idx].y += dy;
  }
  game.lastMessage = "";
  checkIceButtonTriggers(game, iceChain);
  finishMove(game, chain);
  return { ok: true };
}

function finishMove(game, mammothIndices) {
  for (const idx of mammothIndices) {
    const m = game.mammoths[idx];
    if (!m || m.escaped) continue;
    if (terrainAt(game, m.x, m.y) === "X") {
      m.escaped = true;
      game.lastMessage = "Un mammouth est sorti !";
      continue;
    }
    const button = buttonAt(game, m.x, m.y);
    if (button && !button.used) triggerButton(game, button, idx);
  }
  if (game.mammoths.every((mm) => mm.escaped)) game.won = true;
}

function undo(game) {
  if (!game.history.length) return;
  const snap = game.history.pop();
  restoreSnapshot(game, snap);
}
