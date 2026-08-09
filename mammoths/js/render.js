// Affichage : lit l'état produit par engine.js et met à jour le DOM.
// Ce fichier ne modifie jamais l'état du jeu, il ne fait que le dessiner.

// Taille de case recalculée à chaque chargement/redimensionnement (voir player.js)
// pour que le plateau remplisse le maximum de place disponible à l'écran.
let TILE = 40;

function computeTile(availWidth, availHeight) {
  const maxByWidth = Math.floor(availWidth / LEVEL.cols);
  const maxByHeight = Math.floor(availHeight / LEVEL.rows);
  TILE = Math.max(14, Math.min(maxByWidth, maxByHeight));
  return TILE;
}

// Chaque bouton a sa propre couleur (définie dans levels.js/l'éditeur) ; une
// couleur neutre de secours au cas où un niveau plus ancien n'en a pas.
function buttonColor(button) {
  return button.color || "var(--btn-default)";
}

function buttonGlyph(type) {
  if (type === "destroy") return "💥";
  if (type === "teleport") return "🌀";
  return "?";
}

// SVG posé par-dessus la grille pour dessiner les liens bouton -> cible.
// Reconstruit à chaque buildGrid() ; ses <line> sont mises à jour à chaque render().
let linkSvg = null;

function buildGrid(game, gridEl) {
  gridEl.style.gridTemplateColumns = `repeat(${LEVEL.cols}, ${TILE}px)`;
  gridEl.style.gridTemplateRows = `repeat(${LEVEL.rows}, ${TILE}px)`;
  gridEl.style.width = LEVEL.cols * TILE + "px";
  gridEl.style.height = LEVEL.rows * TILE + "px";
  gridEl.innerHTML = "";

  // Cases de roche placées volontairement (visuel seulement — pour le
  // moteur, roche et case absente ("vide") sont toutes les deux juste "pas
  // dans `cells`", donc infranchissables de la même façon).
  const wallSet = new Set((LEVEL.walls || []).map(([x, y]) => `${x},${y}`));

  for (let y = 0; y < LEVEL.rows; y++) {
    for (let x = 0; x < LEVEL.cols; x++) {
      const t = terrainAt(game, x, y);
      const isWall = t === "#" && wallSet.has(`${x},${y}`);
      const kind = t === "X" ? "exit" : t === "#" ? (isWall ? "wall" : "void") : "floor";
      const cell = document.createElement("div");
      cell.className = `cell ${kind}`;
      cell.dataset.x = x;
      cell.dataset.y = y;
      cell.addEventListener("click", () => onCellClick(x, y));

      const button = buttonAt(game, x, y);
      if (button) {
        const b = document.createElement("div");
        b.className = "button-tile";
        b.dataset.type = button.type;
        b.style.setProperty("--btn-color", buttonColor(button));
        b.innerHTML = `<span class="glyph">${buttonGlyph(button.type)}</span><span class="label">${button.label || ""}</span>`;
        cell.appendChild(b);
      }
      gridEl.appendChild(cell);
    }
  }

  const svgNS = "http://www.w3.org/2000/svg";
  linkSvg = document.createElementNS(svgNS, "svg");
  linkSvg.classList.add("link-layer");
  linkSvg.setAttribute("width", LEVEL.cols * TILE);
  linkSvg.setAttribute("height", LEVEL.rows * TILE);
  gridEl.appendChild(linkSvg);
}

function cellCenter(x, y) {
  return [x * TILE + TILE / 2, y * TILE + TILE / 2];
}

// Retourne la position actuelle de ce à quoi un bouton est relié, ou null.
function linkedTargetPos(game, button) {
  if (button.type === "teleport") {
    return [button.targetX, button.targetY];
  }
  if (button.type === "destroy") {
    const pos = game.ice.get(button.linkedIce);
    return pos ? [pos.x, pos.y] : null;
  }
  return null;
}

// Couleur du bouton destructeur (non utilisé) lié à ce glaçon, ou null.
// Permet de teinter le glaçon pour qu'on voie d'un coup d'œil ce qui le
// détruira si on le pousse au mauvais endroit... ou si on l'utilise exprès.
function linkColorForIce(game, iceId) {
  for (const button of game.buttons) {
    if (button.used || button.type !== "destroy") continue;
    if (button.linkedIce === iceId) return buttonColor(button);
  }
  return null;
}

function renderLinks(game) {
  if (!linkSvg) return;
  const svgNS = "http://www.w3.org/2000/svg";
  linkSvg.innerHTML = "";
  for (const button of game.buttons) {
    if (button.used) continue;
    const target = linkedTargetPos(game, button);
    if (!target) continue;
    const color = buttonColor(button);
    const [x1, y1] = cellCenter(button.x, button.y);
    const [x2, y2] = cellCenter(target[0], target[1]);
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("class", "link-line");
    line.style.stroke = color;
    linkSvg.appendChild(line);

    // petit cercle sur la cible pour bien montrer où le lien arrive
    const dot = document.createElementNS(svgNS, "circle");
    dot.setAttribute("cx", x2);
    dot.setAttribute("cy", y2);
    dot.setAttribute("r", 5);
    dot.setAttribute("class", "link-dot");
    dot.style.fill = color;
    linkSvg.appendChild(dot);
  }
}

// Case ciblée par un téléporteur encore actif -> même couleur en fond que
// son bouton. Ça permet de voir d'un coup d'œil ce qui est relié à quoi.
function teleportTargetColor(game, x, y) {
  for (const button of game.buttons) {
    if (button.used || button.type !== "teleport") continue;
    if (button.targetX === x && button.targetY === y) return buttonColor(button);
  }
  return null;
}

// Un seul élément DOM par id de glaçon, réutilisé et repositionné (transition CSS fluide).
const iceEls = new Map();
// Un seul élément DOM par mammouth, indexé par position dans game.mammoths.
const mammothEls = [];

function clearRenderCaches() {
  iceEls.clear();
  mammothEls.length = 0;
}

function render(game, ui) {
  // Cases dont un bouton a été consommé : griser visuellement.
  // Case ciblée par un téléporteur encore actif : teinter avec sa couleur.
  for (const cell of ui.gridEl.children) {
    if (!cell.dataset || cell.dataset.x === undefined) continue;
    const x = Number(cell.dataset.x);
    const y = Number(cell.dataset.y);
    const b = cell.querySelector(".button-tile");
    if (b) {
      const button = buttonAt(game, x, y);
      b.classList.toggle("spent", button && button.used);
    }
    const teleColor = teleportTargetColor(game, x, y);
    cell.style.setProperty("--tele-color", teleColor || "transparent");
    cell.classList.toggle("teleport-target", !!teleColor);
  }

  // Glaçons
  const liveIds = new Set(game.ice.keys());
  for (const [id, el] of [...iceEls]) {
    if (!liveIds.has(id)) {
      el.remove();
      iceEls.delete(id);
    }
  }
  for (const [id, pos] of game.ice) {
    let el = iceEls.get(id);
    if (!el) {
      el = document.createElement("div");
      el.className = "ice-block";
      ui.gridEl.appendChild(el);
      iceEls.set(id, el);
    }
    el.style.left = pos.x * TILE + "px";
    el.style.top = pos.y * TILE + "px";
    el.style.width = TILE + "px";
    el.style.height = TILE + "px";
    const linkColor = linkColorForIce(game, id);
    el.classList.toggle("linked", !!linkColor);
    el.style.setProperty("--link-color", linkColor || "transparent");
  }

  // Mammouths
  game.mammoths.forEach((m, i) => {
    let el = mammothEls[i];
    if (!el) {
      el = document.createElement("div");
      el.className = "mammoth";
      el.textContent = "🦣";
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onMammothClick(i);
      });
      ui.gridEl.appendChild(el);
      mammothEls[i] = el;
    }
    el.style.width = TILE + "px";
    el.style.height = TILE + "px";
    el.style.left = m.x * TILE + "px";
    el.style.top = m.y * TILE + "px";
    el.classList.toggle("escaped", m.escaped);
    el.classList.toggle("selected", ui.selected === i && !m.escaped);
  });

  const remaining = game.mammoths.filter((m) => !m.escaped).length;
  ui.remainingEl.textContent = remaining;
  ui.msgEl.textContent = game.lastMessage || " ";
  ui.winBanner.classList.toggle("show", game.won);
  renderLinks(game);
}

function shake(frameEl) {
  frameEl.classList.remove("shake");
  void frameEl.offsetWidth;
  frameEl.classList.add("shake");
}
