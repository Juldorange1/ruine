// ============================================================================
// ASCENSION — editor.js
// Éditeur de niveaux : pose/retire des blocs voxel sur une grille, caméra à
// l'orbite (glisser la souris, molette pour zoomer, WASD/QE pour déplacer le
// point de visée), palette de types de blocs, sauvegarde/chargement/suppression
// via AS.Storage (localStorage). Le niveau créé se joue avec le même
// contrôleur (AS.Player) via AS.World.buildCustom().
// ============================================================================
window.AS = window.AS || {};

AS.Editor = (function () {
  const CELL = AS.EDITOR_CELL || { x: 3, y: 1.6, z: 3 };
  const TYPE_COLORS = {
    normal: '#9c9484', ice: '#bfe7f2', boost: '#ff8a4c', bounce: '#c86bff',
    crumble: '#9c8060', perfectBounce: '#5df2c8', spike: '#c9463a', orb: '#ff9ed6', spawn: '#6ee7a0', finish: '#f3d98a',
    checkpoint: '#3fa0ff', wind: '#bfe8ff', lowgrav: '#d9c6ff',
    phase: '#6ee7ff', mover: '#6b8ea8',
  };
  const TYPE_LABELS = {
    normal: 'Roche', ice: 'Glace', boost: 'Vitesse', bounce: 'Rebond',
    crumble: 'Fragile', perfectBounce: 'Rebond parfait', spike: 'Pics (mortel)', orb: 'Orbe de rebond', spawn: 'Départ', finish: 'Arrivée',
    checkpoint: 'Checkpoint', wind: 'Vent', lowgrav: 'Gravité faible',
    phase: 'Téléporteur (paire)', mover: 'Plateforme mobile (paire)',
  };
  // Types "marqueurs" : pas de bloc solide, affichés en aperçu translucide
  // dans l'éditeur pour bien les distinguer des blocs qui bloquent le joueur.
  // 'orb' est un marqueur aussi : l'orbe de rebond n'a plus de collision
  // solide (voir world.js), on la traverse librement de côté.
  const MARKER_TYPES = new Set(['checkpoint', 'wind', 'lowgrav', 'phase', 'mover', 'orb']);
  // Types dont l'orientation compte (cyclée avec le bouton de rotation) —
  // 'boost' pour indiquer le sens de la poussée dans l'éditeur ET en jeu.
  const ROTATABLE_TYPES = new Set(['boost', 'wind', 'phase']);
  // Types dont l'intensité compte (cyclée avec le bouton de puissance).
  const POWER_TYPES = new Set(['wind']);
  // Regroupement de la palette par catégorie (au lieu d'une longue liste à
  // plat) : plus facile à parcourir.
  const CATEGORIES = [
    { label: 'Structure', types: ['normal', 'ice', 'boost', 'bounce', 'crumble', 'perfectBounce'] },
    { label: 'Dangers', types: ['spike'] },
    { label: 'Parcours', types: ['spawn', 'finish', 'checkpoint'] },
    { label: 'Mécaniques', types: ['orb', 'wind', 'lowgrav', 'phase', 'mover'] },
  ];
  const POWER_LABELS = ['Faible', 'Moyen', 'Fort'];

  let renderer = null, canvas = null, scene = null, camera = null;
  let blocks = [];           // [{gx,gy,gz,type,rot,mesh}]
  let cellMap = {};          // "gx,gy,gz" -> entry
  let currentType = 'normal';
  let currentRot = 0;        // 0-3, orientation (quart de tour) pour les types directionnels
  let currentPower = 2;      // 1-3, intensité pour les types qui en ont une (vent)
  let currentLevelName = '';
  let currentBackground = AS.BACKGROUND_CHOICES[0].id;
  let currentTheme = 'rock';
  let ghost = null;
  let ghostArrow = null;
  let groundPlane = null;
  let raycaster = null;
  let analysisGroup = null;

  // ---- Caméra orbitale (souris, pas de pointer lock) -----------------------
  const orbit = { az: Math.PI * 0.25, el: 0.55, dist: 26, target: new THREE.Vector3(0, 1, 0) };
  let dragging = false, dragButton = -1, dragMoved = false, lastX = 0, lastY = 0;

  function applyCamera() {
    const el = AS.Util.clamp(orbit.el, -1.3, 1.3);
    const x = orbit.target.x + orbit.dist * Math.cos(el) * Math.sin(orbit.az);
    const y = orbit.target.y + orbit.dist * Math.sin(el);
    const z = orbit.target.z + orbit.dist * Math.cos(el) * Math.cos(orbit.az);
    camera.position.set(x, y, z);
    camera.lookAt(orbit.target);
  }

  function cellKey(gx, gy, gz) { return gx + ',' + gy + ',' + gz; }

  function makeGhost() {
    const geo = new THREE.BoxGeometry(CELL.x * 0.98, CELL.y * 0.98, CELL.z * 0.98);
    const mat = new THREE.MeshBasicMaterial({ color: 0x6ee7ff, transparent: true, opacity: 0.35, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 0.9, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false })
    );
    arrow.rotation.x = Math.PI / 2;
    arrow.position.set(0, 0, CELL.z * 0.55);
    arrow.visible = false;
    mesh.add(arrow);
    ghostArrow = arrow;
    return mesh;
  }

  function blockMaterial(type) {
    if (MARKER_TYPES.has(type)) {
      return new THREE.MeshBasicMaterial({
        color: TYPE_COLORS[type] || '#9c9484', transparent: true, opacity: 0.5,
        depthWrite: false, side: THREE.DoubleSide,
      });
    }
    return new THREE.MeshStandardMaterial({ color: TYPE_COLORS[type] || '#9c9484', roughness: 0.8 });
  }

  // Les marqueurs (checkpoint, vent, gravité, téléporteurs, plateformes
  // mobiles, décor) n'ont pas de collision : un petit repère translucide
  // suffit, plus petit qu'un bloc plein pour bien montrer que
  // le joueur passe au travers.
  function blockGeometry(type) {
    if (type === 'orb') return new THREE.SphereGeometry(CELL.x * 0.42, 16, 12);
    if (MARKER_TYPES.has(type)) return new THREE.BoxGeometry(CELL.x * 0.5, CELL.y * 0.5, CELL.z * 0.5);
    return new THREE.BoxGeometry(CELL.x * 0.96, CELL.y * 0.92, CELL.z * 0.96);
  }

  // Une simple rotation de cube ne se voit pas (géométrie symétrique) : les
  // types orientables portent une petite flèche pour que la direction posée
  // reste visible une fois le bloc en place, pas seulement sur l'aperçu.
  function addDirectionArrow(mesh, type) {
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.55, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false })
    );
    arrow.rotation.x = Math.PI / 2;
    const forward = (MARKER_TYPES.has(type) ? CELL.z * 0.5 : CELL.z * 0.96) / 2 + 0.32;
    arrow.position.set(0, 0, forward);
    mesh.add(arrow);
  }

  function addBlock(gx, gy, gz, type, rot, power) {
    const key = cellKey(gx, gy, gz);
    if (cellMap[key]) return cellMap[key];
    invalidateAnalysis();
    if (type === 'spawn') {
      // un seul départ à la fois
      for (const b of blocks) if (b.type === 'spawn') removeBlockEntry(b);
    }
    const mesh = new THREE.Mesh(blockGeometry(type), blockMaterial(type));
    mesh.position.set(gx * CELL.x, gy * CELL.y, gz * CELL.z);
    if (ROTATABLE_TYPES.has(type)) {
      mesh.rotation.y = (rot || 0) * Math.PI / 2;
      addDirectionArrow(mesh, type);
    }
    mesh.castShadow = !MARKER_TYPES.has(type);
    mesh.receiveShadow = !MARKER_TYPES.has(type);
    scene.add(mesh);
    const entry = { gx, gy, gz, type, rot: rot || 0, power: power || 2, mesh };
    blocks.push(entry);
    cellMap[key] = entry;
    return entry;
  }

  function removeBlockEntry(entry) {
    invalidateAnalysis();
    scene.remove(entry.mesh);
    entry.mesh.geometry.dispose();
    const idx = blocks.indexOf(entry);
    if (idx >= 0) blocks.splice(idx, 1);
    delete cellMap[cellKey(entry.gx, entry.gy, entry.gz)];
  }

  function clearAll() {
    for (const b of blocks.slice()) removeBlockEntry(b);
  }

  function updateHint() {
    const el = document.getElementById('editorCount');
    if (el) el.textContent = blocks.length + ' bloc(s)';
  }

  // ---- Raycast souris -> cellule ciblée -------------------------------------
  function pickTarget(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    const meshes = blocks.map((b) => b.mesh).concat([groundPlane]);
    const hits = raycaster.intersectObjects(meshes, false);
    if (!hits.length) return null;
    const hit = hits[0];
    if (hit.object === groundPlane) {
      return {
        place: { gx: Math.round(hit.point.x / CELL.x), gy: 0, gz: Math.round(hit.point.z / CELL.z) },
        removeEntry: null,
      };
    }
    const entry = blocks.find((b) => b.mesh === hit.object);
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    const place = {
      gx: entry.gx + Math.round(n.x),
      gy: entry.gy + Math.round(n.y),
      gz: entry.gz + Math.round(n.z),
    };
    return { place, removeEntry: entry };
  }

  // ---- Entrées souris / clavier ---------------------------------------------
  function onPointerDown(e) {
    if (e.target !== canvas) return;
    dragging = true; dragButton = e.button; dragMoved = false;
    lastX = e.clientX; lastY = e.clientY;
  }
  function onPointerMove(e) {
    if (!dragging) {
      const t = pickTarget(e.clientX, e.clientY);
      if (t && t.place) {
        ghost.visible = true;
        ghost.position.set(t.place.gx * CELL.x, t.place.gy * CELL.y, t.place.gz * CELL.z);
        ghost.material.color.set(TYPE_COLORS[currentType]);
        ghost.material.opacity = MARKER_TYPES.has(currentType) ? 0.55 : 0.35;
        ghost.rotation.y = ROTATABLE_TYPES.has(currentType) ? currentRot * Math.PI / 2 : 0;
        ghostArrow.visible = ROTATABLE_TYPES.has(currentType);
      } else {
        ghost.visible = false;
      }
      return;
    }
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragMoved = true;
    if (dragButton === 0 || dragButton === 2) {
      orbit.az -= dx * 0.0065;
      orbit.el += dy * 0.0055;
    }
    lastX = e.clientX; lastY = e.clientY;
    applyCamera();
  }
  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    if (dragMoved) return; // c'était un glissé caméra, pas un clic de pose/retrait
    const t = pickTarget(e.clientX, e.clientY);
    if (!t) return;
    if (e.button === 2) {
      if (t.removeEntry) removeBlockEntry(t.removeEntry);
    } else if (e.button === 0) {
      if (t.place) addBlock(t.place.gx, t.place.gy, t.place.gz, currentType, currentRot, currentPower);
    }
    updateHint();
  }
  function onWheel(e) {
    if (e.target !== canvas) return;
    e.preventDefault();
    orbit.dist = AS.Util.clamp(orbit.dist + e.deltaY * 0.02, 6, 70);
    applyCamera();
  }
  function onContextMenu(e) {
    if (e.target === canvas) e.preventDefault();
  }
  const panKeys = new Set();
  function onKeyDown(e) {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(e.code)) panKeys.add(e.code);
    if (e.code === 'KeyR' && !e.repeat && ROTATABLE_TYPES.has(currentType)) {
      currentRot = (currentRot + 1) % 4;
      syncRotUI();
    }
    if (e.code === 'KeyP' && !e.repeat && POWER_TYPES.has(currentType)) {
      currentPower = (currentPower % 3) + 1;
      syncPowerUI();
    }
  }
  function onKeyUp(e) { panKeys.delete(e.code); }
  function rotLabel() {
    const arrows = ['↑ Nord', '→ Est', '↓ Sud', '← Ouest'];
    return 'Orientation (R) : ' + arrows[currentRot];
  }
  function powerLabel() {
    return 'Puissance (P) : ' + POWER_LABELS[currentPower - 1];
  }

  function panStep(dt) {
    const speed = 14 * dt;
    const fwd = new THREE.Vector3(Math.sin(orbit.az), 0, Math.cos(orbit.az));
    const right = new THREE.Vector3(Math.sin(orbit.az + Math.PI / 2), 0, Math.cos(orbit.az + Math.PI / 2));
    if (panKeys.has('KeyW')) orbit.target.addScaledVector(fwd, -speed);
    if (panKeys.has('KeyS')) orbit.target.addScaledVector(fwd, speed);
    if (panKeys.has('KeyA')) orbit.target.addScaledVector(right, -speed);
    if (panKeys.has('KeyD')) orbit.target.addScaledVector(right, speed);
    if (panKeys.has('KeyQ')) orbit.target.y -= speed;
    if (panKeys.has('KeyE')) orbit.target.y += speed;
  }

  function syncRotUI() {
    const btn = document.getElementById('editorRotBtn');
    if (!btn) return;
    const active = ROTATABLE_TYPES.has(currentType);
    btn.hidden = !active;
    if (active) btn.textContent = rotLabel();
  }

  function syncPowerUI() {
    const btn = document.getElementById('editorPowerBtn');
    if (!btn) return;
    const active = POWER_TYPES.has(currentType);
    btn.hidden = !active;
    if (active) btn.textContent = powerLabel();
  }

  function syncBackgroundUI() {
    const bgSelect = document.getElementById('editorBackgroundSelect');
    if (bgSelect) bgSelect.value = currentBackground;
  }

  function syncThemeUI() {
    const themeSelect = document.getElementById('editorThemeSelect');
    if (themeSelect) themeSelect.value = currentTheme;
  }

  // ---- Palette / UI -----------------------------------------------------
  function buildPalette(container) {
    container.innerHTML = '';
    CATEGORIES.forEach((cat) => {
      const section = document.createElement('div');
      section.className = 'editor-palette-section';
      const heading = document.createElement('div');
      heading.className = 'editor-palette-heading';
      heading.textContent = cat.label;
      section.appendChild(heading);
      const group = document.createElement('div');
      group.className = 'editor-palette-group';
      cat.types.forEach((type) => {
        const btn = document.createElement('button');
        btn.className = 'editor-palette-btn' + (type === currentType ? ' selected' : '');
        btn.style.setProperty('--swatch', TYPE_COLORS[type]);
        btn.innerHTML = '<span class="swatch"></span>' + TYPE_LABELS[type];
        btn.addEventListener('click', () => {
          currentType = type;
          container.querySelectorAll('.editor-palette-btn').forEach((b) => b.classList.remove('selected'));
          btn.classList.add('selected');
          syncRotUI();
          syncPowerUI();
        });
        group.appendChild(btn);
      });
      section.appendChild(group);
      container.appendChild(section);
    });
  }

  function refreshLevelSelect(selectEl) {
    const levels = AS.Storage.loadLevels();
    selectEl.innerHTML = '<option value="">— Charger un niveau —</option>';
    Object.keys(levels).sort().forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name + (levels[name].best != null ? ' (' + AS.Hud.fmtTime(levels[name].best) + ')' : '');
      selectEl.appendChild(opt);
    });
  }

  function loadIntoEditor(name) {
    const levels = AS.Storage.loadLevels();
    const lvl = levels[name];
    if (!lvl) return;
    clearAll();
    for (const b of lvl.blocks) addBlock(b.gx, b.gy, b.gz, b.type, b.rot, b.power);
    currentLevelName = name;
    currentBackground = lvl.background || AS.BACKGROUND_CHOICES[0].id;
    currentTheme = lvl.theme || 'rock';
    syncBackgroundUI();
    syncThemeUI();
    updateHint();
  }

  function hasSpawn() { return blocks.some((b) => b.type === 'spawn'); }
  function hasFinish() { return blocks.some((b) => b.type === 'finish'); }

  function exportBlocks() {
    return blocks.map((b) => ({ gx: b.gx, gy: b.gy, gz: b.gz, type: b.type, rot: b.rot, power: b.power }));
  }

  // ---- Trajectoire du bot d'analyse (voir AS.Analyzer) ---------------------
  // Une sphère rouge translucide par image échantillonnée, à la taille du
  // hitbox du joueur (rayon CFG.playerRadius) — un "fantôme" du passage du
  // bot plutôt qu'une simple ligne, pour bien voir la vitesse (densité des
  // sphères) et pas seulement le chemin.
  function clearAnalysisTrail() {
    if (!analysisGroup) return;
    scene.remove(analysisGroup);
    analysisGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    analysisGroup = null;
  }

  // Le niveau a changé (bloc ajouté/retiré) : une analyse précédente ne
  // serait plus valable — efface la trajectoire ET referme le panneau de
  // résultats (contrairement à showAnalysisTrail, qui ne fait que redessiner
  // la trajectoire sans toucher au panneau que main.js vient de remplir).
  function invalidateAnalysis() {
    const panel = document.getElementById('editorAnalysis');
    if (panel) panel.hidden = true;
    clearAnalysisTrail();
  }

  function showAnalysisTrail(points, stuckAt) {
    clearAnalysisTrail();
    if (!scene || !points || !points.length) return;
    analysisGroup = new THREE.Group();
    const radius = (AS.CFG && AS.CFG.playerRadius) || 0.42;
    const stride = Math.max(1, Math.floor(points.length / 260));
    const sampled = points.filter((_, i) => i % stride === 0);
    const geo = new THREE.SphereGeometry(radius, 8, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.35, depthWrite: false });
    const inst = new THREE.InstancedMesh(geo, mat, sampled.length);
    const dummy = new THREE.Object3D();
    sampled.forEach((p, i) => {
      dummy.position.set(p.x, p.y + radius, p.z);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    analysisGroup.add(inst);
    if (stuckAt) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.55, depthWrite: false })
      );
      marker.position.set(stuckAt.x, stuckAt.y + 0.7, stuckAt.z);
      analysisGroup.add(marker);
    }
    scene.add(analysisGroup);
  }

  // ---- Cycle de vie ----------------------------------------------------------
  // _initScene() ne s'exécute qu'une fois : la scène/les blocs restent en
  // mémoire quand on quitte temporairement l'éditeur pour tester un niveau,
  // afin de ne pas perdre le travail en cours.
  function _initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a2233);
    scene.fog = new THREE.Fog(0x1a2233, 60, 260);
    camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 500);
    raycaster = new THREE.Raycaster();
    blocks = []; cellMap = {};

    const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x2a2436, 0.9);
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(20, 30, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
    scene.add(hemi, sun);

    const grid = new THREE.GridHelper(180, 60, 0x6ee7ff, 0x33415c);
    grid.position.y = -CELL.y / 2;
    scene.add(grid);

    groundPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.y = -CELL.y / 2;
    scene.add(groundPlane);

    ghost = makeGhost();
    scene.add(ghost);

    orbit.az = Math.PI * 0.25; orbit.el = 0.55; orbit.dist = 26;
    orbit.target.set(0, 1, 0);
  }

  function newLevel() {
    if (!scene) return;
    clearAll();
    currentLevelName = '';
    currentBackground = AS.BACKGROUND_CHOICES[0].id;
    currentTheme = 'rock';
    syncBackgroundUI();
    syncThemeUI();
    orbit.az = Math.PI * 0.25; orbit.el = 0.55; orbit.dist = 26;
    orbit.target.set(0, 1, 0);
    updateHint();
  }

  function open(sharedRenderer, sharedCanvas) {
    renderer = sharedRenderer;
    canvas = sharedCanvas;
    if (!scene) _initScene();
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    applyCamera();

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const palette = document.getElementById('editorPalette');
    if (palette) buildPalette(palette);
    const select = document.getElementById('editorLevelSelect');
    if (select) refreshLevelSelect(select);
    const rotBtn = document.getElementById('editorRotBtn');
    if (rotBtn && !rotBtn.__wired) {
      rotBtn.__wired = true;
      rotBtn.addEventListener('click', () => {
        currentRot = (currentRot + 1) % 4;
        syncRotUI();
      });
    }
    const powerBtn = document.getElementById('editorPowerBtn');
    if (powerBtn && !powerBtn.__wired) {
      powerBtn.__wired = true;
      powerBtn.addEventListener('click', () => {
        currentPower = (currentPower % 3) + 1;
        syncPowerUI();
      });
    }
    const bgSelect = document.getElementById('editorBackgroundSelect');
    if (bgSelect && !bgSelect.__wired) {
      bgSelect.__wired = true;
      AS.BACKGROUND_CHOICES.forEach((b) => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.label;
        bgSelect.appendChild(opt);
      });
      bgSelect.addEventListener('change', () => { currentBackground = bgSelect.value; });
    }
    const themeSelect = document.getElementById('editorThemeSelect');
    if (themeSelect && !themeSelect.__wired) {
      themeSelect.__wired = true;
      themeSelect.addEventListener('change', () => { currentTheme = themeSelect.value; });
    }
    syncBackgroundUI();
    syncThemeUI();
    syncRotUI();
    syncPowerUI();
    updateHint();
  }

  function close() {
    if (!canvas) return; // jamais ouvert cette session : rien à détacher
    canvas.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('contextmenu', onContextMenu);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    panKeys.clear();
    dragging = false;
  }

  function resize() {
    if (!camera) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }

  function tick(dt) {
    panStep(dt);
    applyCamera();
    renderer.render(scene, camera);
  }

  return {
    open, close, resize, tick,
    addBlock, clearAll, newLevel, loadIntoEditor, refreshLevelSelect,
    hasSpawn, hasFinish, exportBlocks, showAnalysisTrail, clearAnalysisTrail,
    get currentLevelName() { return currentLevelName; },
    set currentLevelName(v) { currentLevelName = v; },
    get currentBackground() { return currentBackground; },
    set currentBackground(v) { currentBackground = v; },
    get currentTheme() { return currentTheme; },
    set currentTheme(v) { currentTheme = v; },
    TYPE_LABELS,
  };
})();
