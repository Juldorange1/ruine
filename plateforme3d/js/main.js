// ============================================================================
// ASCENSION — main.js
// Bootstrap : scène/rendu, entrées clavier (raccourcis reconfigurables),
// machine d'états des écrans (menu, jeu, pause, résultat, éditeur), boucle de
// jeu (physique joueur, plateformes mobiles, déclencheurs, HUD), personnage
// visuel avec un peu de "jus" (squash/stretch, particules).
//
// La caméra est à AXE FIXE (AS.FixedCamera) : pas de pointer lock, pas de
// contrôle souris — juste un suivi lissé du joueur, toujours sous le même
// angle. Les déplacements de l'éditeur utilisent leur propre caméra à
// l'orbite (voir editor.js), pilotée à la souris normale (pas de lock).
// ============================================================================
(function () {
  const $ = AS.Hud.$;
  const canvas = document.getElementById('gameCanvas');

  // ---------------------------------------------------------------------
  // Rendu THREE.js (persistant, partagé entre le jeu et l'éditeur)
  // ---------------------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Tone mapping filmique : sans lui, les surfaces émissives (pads, portes de
  // phase...) et le ciel en plein jour "cramaient" en blanc pur au lieu de
  // garder un dégradé de hautes lumières — un rendu bien plus réaliste pour
  // un coût nul (juste une passe de tonemap intégrée au renderer).
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 400);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    AS.Editor.resize();
  });

  // Un seul écouteur global plutôt qu'un appel dans chaque gestionnaire de
  // bouton : couvre tous les boutons de l'interface (menu, éditeur, pause...)
  // y compris ceux créés dynamiquement (liste des niveaux) sans rien oublier.
  document.addEventListener('click', (e) => {
    if (e.target.closest('button')) AS.Sound.play('uiClick');
  });

  AS.Sound.preload();
  AS.Sound.setMasterVolume(AS.Storage.getSfxVolume());

  // ---------------------------------------------------------------------
  // Skins — variantes d'apparence complètes : corpulence (largeur des
  // épaules/hanches/membres), couleur de peau, coupe de cheveux et couleurs
  // de tenue. Seule la LARGEUR varie avec `build` (jamais la hauteur des
  // segments dérivés de AS.CFG.playerHeight) : la silhouette reste toujours
  // dans le rayon de la capsule de collision, donc la hitbox ne bouge pas
  // d'un skin à l'autre — voir buildPlayerMesh.
  // ---------------------------------------------------------------------
  const SKINS = [
    { id: 'bleu', label: 'Bleu', build: 1.0, skinTone: 0xe8b48c, hairStyle: 'short', hairColor: 0x2b1e18, shirt: 0x3fb7e8, shirtEmissive: 0x0a2230, pants: 0x33455c, shoe: 0x201a16 },
    { id: 'rouge', label: 'Rouge', build: 1.22, skinTone: 0xd79b6e, hairStyle: 'short', hairColor: 0x1a1512, shirt: 0xe8503f, shirtEmissive: 0x330a05, pants: 0x3a2422, shoe: 0x201212 },
    { id: 'foret', label: 'Forêt', build: 0.88, skinTone: 0xf0d3ab, hairStyle: 'long', hairColor: 0x3a2a18, shirt: 0x4fae5c, shirtEmissive: 0x0f2a10, pants: 0x2e3a24, shoe: 0x1c1c16 },
    { id: 'or', label: 'Doré', build: 1.05, skinTone: 0x8a5a3c, hairStyle: 'bald', hairColor: 0x2b1e18, shirt: 0xe8c23f, shirtEmissive: 0x332a05, pants: 0x4a4028, shoe: 0x2a2010 },
    { id: 'ombre', label: 'Ombre', build: 0.92, skinTone: 0xcac2c9, hairStyle: 'mohawk', hairColor: 0x141414, shirt: 0x3a3f52, shirtEmissive: 0x08081a, pants: 0x1c1e28, shoe: 0x101012 },
  ];
  function getSkinById(id) { return SKINS.find((s) => s.id === id) || SKINS[0]; }

  // Coupe de cheveux : renvoie un tableau de meshes (vide pour "bald").
  function buildHair(style, headRadius, headY, mat, cast) {
    const meshes = [];
    if (style === 'bald') return meshes;
    if (style === 'long') {
      const cap = cast(new THREE.Mesh(new THREE.SphereGeometry(headRadius * 1.02, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mat));
      cap.position.set(0, headY, 0);
      const tail = cast(new THREE.Mesh(new THREE.CapsuleGeometry(headRadius * 0.3, headRadius * 1.5, 3, 6), mat));
      tail.position.set(0, headY - headRadius * 1.15, -headRadius * 0.7);
      tail.rotation.x = 0.3;
      meshes.push(cap, tail);
    } else if (style === 'mohawk') {
      const cap = cast(new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.98, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.32), mat));
      cap.position.set(0, headY, 0);
      const ridge = cast(new THREE.Mesh(new THREE.BoxGeometry(headRadius * 0.26, headRadius * 0.85, headRadius * 1.25), mat));
      ridge.position.set(0, headY + headRadius * 0.7, 0);
      meshes.push(cap, ridge);
    } else {
      // 'short' (par défaut)
      const cap = cast(new THREE.Mesh(new THREE.SphereGeometry(headRadius * 1.02, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), mat));
      cap.position.set(0, headY, 0);
      meshes.push(cap);
    }
    return meshes;
  }

  // ---------------------------------------------------------------------
  // Personnage visuel — silhouette humaine construite à partir de formes
  // primitives (tête/cou/torse/bras/jambes), pas un modèle 3D externe : un
  // fichier .obj chargé par OBJLoader/MTLLoader s'est déjà avéré peu fiable
  // (invisible dans le bundle Artifact, casse d'autres réglages si on force
  // les loaders à s'y charger quand même — voir historique). Une géométrie
  // 100% générée en code tourne à l'identique partout, sans dépendance
  // externe ni cas particulier selon l'environnement.
  // ---------------------------------------------------------------------
  function buildPlayerMesh(skinId) {
    const skin = getSkinById(skinId);
    // Proportions calées sur AS.CFG.playerHeight (pieds à y=0, sommet de la
    // tête à playerHeight) : ce que le joueur voit correspond à son hitbox
    // (capsule de rayon playerRadius), sans le dépasser aux épaules/hanches.
    // Ces proportions sont IDENTIQUES pour tous les skins (voir SKINS
    // ci-dessus) : seules les couleurs de matériaux changent.
    const H = AS.CFG.playerHeight;
    const legLength = H * 0.457;
    const torsoLength = H * 0.303;
    const neckLength = H * 0.029;
    const headRadius = (H - legLength - torsoLength - neckLength) / 2;

    const hipY = legLength;
    const shoulderY = hipY + torsoLength;
    const headY = H - headRadius;

    // Seule la largeur (hanches/épaules/membres) suit la corpulence du skin
    // (skin.build) : les longueurs ci-dessus restent fixes, donc la hitbox
    // capsule (playerRadius/playerHeight) ne change jamais.
    const bw = skin.build;
    const hipHalf = 0.16 * bw;
    const shoulderHalf = 0.20 * bw;
    const legRadius = 0.075 * bw;
    const armRadius = 0.058 * bw;
    const armLength = torsoLength + neckLength + headRadius * 0.4;

    const skinMat = new THREE.MeshStandardMaterial({ color: skin.skinTone, roughness: 0.75 });
    const hairMat = new THREE.MeshStandardMaterial({ color: skin.hairColor, roughness: 0.6 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: skin.shirt, roughness: 0.65, emissive: skin.shirtEmissive, emissiveIntensity: 0.2 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: skin.pants, roughness: 0.75 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: skin.shoe, roughness: 0.7 });
    const soleMat = new THREE.MeshStandardMaterial({ color: 0x161311, roughness: 0.85 });
    const beltMat = new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.8 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x14100e, roughness: 0.4 });

    const g = new THREE.Group();
    const cast = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

    // ---- jambes + pieds (semelle + tige, deux tons) -------------------------
    [-1, 1].forEach((side) => {
      const legX = side * hipHalf * 0.6;
      const leg = cast(new THREE.Mesh(
        new THREE.CapsuleGeometry(legRadius, Math.max(0.05, legLength - 2 * legRadius), 3, 6),
        pantsMat
      ));
      leg.position.set(legX, legLength / 2, 0);
      const shoe = cast(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.075, 0.2), shoeMat));
      shoe.position.set(legX, 0.055, 0.035);
      const sole = cast(new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.03, 0.22), soleMat));
      sole.position.set(legX, 0.015, 0.04);
      g.add(leg, shoe, sole);
    });

    // ---- bassin + ceinture -----------------------------------------------
    const hip = cast(new THREE.Mesh(new THREE.BoxGeometry(hipHalf * 2, 0.14, 0.18), pantsMat));
    hip.position.set(0, hipY, 0);
    const belt = cast(new THREE.Mesh(new THREE.BoxGeometry(hipHalf * 2.08, 0.05, 0.185), beltMat));
    belt.position.set(0, hipY + 0.08, 0);

    // ---- torse (conique : plus large aux épaules qu'aux hanches) -----------
    const torso = cast(new THREE.Mesh(
      new THREE.CylinderGeometry(shoulderHalf, hipHalf, torsoLength, 8),
      shirtMat
    ));
    torso.position.set(0, hipY + torsoLength / 2, 0);

    // ---- cou + tête + visage + cheveux --------------------------------------
    const neck = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, neckLength, 8), skinMat));
    neck.position.set(0, shoulderY + neckLength / 2, 0);
    const head = cast(new THREE.Mesh(new THREE.SphereGeometry(headRadius, 16, 12), skinMat));
    head.position.set(0, headY, 0);
    const hairMeshes = buildHair(skin.hairStyle, headRadius, headY, hairMat, cast);
    // Deux points sombres sur l'avant du crâne (+Z, le sens "de face" par
    // défaut — voir la convention de yaw dans _horizontal côté player.js) :
    // un visage lisible d'un coup d'oeil, sans viser un rendu facial complet.
    const eyeGeo = new THREE.SphereGeometry(headRadius * 0.11, 8, 6);
    const eyes = [-1, 1].map((side) => {
      const eye = cast(new THREE.Mesh(eyeGeo, eyeMat));
      eye.position.set(side * headRadius * 0.38, headY + headRadius * 0.05, headRadius * 0.88);
      return eye;
    });

    // ---- bras (légèrement écartés, pose naturelle) + mains -------------------
    const arms = [];
    const hands = [];
    [-1, 1].forEach((side) => {
      const arm = cast(new THREE.Mesh(
        new THREE.CapsuleGeometry(armRadius, Math.max(0.05, armLength - 2 * armRadius), 3, 6),
        shirtMat
      ));
      arm.position.set(side * (shoulderHalf + armRadius * 0.7), shoulderY - armLength / 2, 0);
      arm.rotation.z = side * 0.12;
      // La main est un enfant du bras (dans son repère local, à l'extrémité
      // basse de la capsule) : elle suit donc sa rotation sans code séparé —
      // essentiel pour l'animation d'accroche au mur (voir updateGame), où
      // c'est justement la position de la main qui doit se lire clairement.
      const hand = cast(new THREE.Mesh(new THREE.SphereGeometry(armRadius * 1.2, 10, 8), skinMat));
      hand.position.set(0, -armLength / 2 + armRadius * 0.3, 0);
      arm.add(hand);
      // ---- petite capsule d'épaule : adoucit le raccord bras/torse ----------
      const shoulderCap = cast(new THREE.Mesh(new THREE.SphereGeometry(armRadius * 1.15, 10, 8), shirtMat));
      shoulderCap.position.set(side * shoulderHalf * 0.92, shoulderY, 0);
      g.add(shoulderCap);
      arms.push(arm);
      hands.push(hand);
      g.add(arm);
    });

    g.add(hip, belt, torso, neck, head, ...eyes, ...hairMeshes);
    g.userData.arms = arms;
    g.userData.hands = hands;
    return g;
  }

  // ---------------------------------------------------------------------
  // État global
  // ---------------------------------------------------------------------
  let scene = null, level = null, player = null, tpCam = null, playerMesh = null;
  let abilities = null, difficulty = 'court-1';
  let appState = 'menu'; // menu | playing | paused | result | finish | editor
  let squash = new THREE.Vector3(1, 1, 1);
  let bursts = [];
  // Durée de la poussée visible des mains contre le mur au moment du
  // wall-jump (voir updateGame) — volontairement courte et vive, contraste
  // avec la lenteur de l'accroche qui la précède.
  const WALL_PUSH_DURATION = 0.22;
  let wallPushTimer = 0;

  const state = {
    checkpointIndex: 0,
    lastCheckpointPos: new THREE.Vector3(),
    zoneStart: 0,
    finished: false,
    customLevel: false,
    customLevelName: '',
    // Numéro (1-10) quand la partie en cours est le niveau assigné à cet
    // emplacement principal (voir AS.Storage.getMainLevelFor) — null pour un
    // niveau personnel joué/testé depuis l'éditeur ou le menu.
    mainDifficulty: null,
  };

  const hintByCheckpoint = [
    'Avance, saute, garde ton élan.',
    'Une surface turquoise offre un rebond parfait si tu sautes pile à l\'impact.',
    'Un pad orange donne de la vitesse — file vers le grand saut !',
    "Un couloir entre deux parois : le wall-jump permet d'y grimper vite.",
    "Certaines plateformes fragiles s'effondrent après quelques secondes.",
    'Les colonnes de vent peuvent te porter vers le haut.',
    'Repère les pics au sol ou aux murs : un seul contact est mortel.',
    'Le sommet est en vue.',
  ];

  // ---------------------------------------------------------------------
  // Sélection de difficulté (écran titre)
  // ---------------------------------------------------------------------
  const saved = AS.Storage.load();
  difficulty = saved.settings.difficulty || 'court-1';
  document.querySelectorAll('.diff-btn').forEach((btn) => {
    btn.classList.toggle('selected', btn.dataset.diff === difficulty);
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      difficulty = btn.dataset.diff;
      AS.Storage.setDifficulty(difficulty);
    });

    // Glisser-déposer : attraper un niveau dans "Mes niveaux créés" (voir
    // renderTitleLevels) et le lâcher ici l'assigne directement à cette
    // difficulté — bien plus rapide que le menu déroulant de l'éditeur, qui
    // reste disponible pour qui préfère cette méthode.
    btn.addEventListener('dragover', (e) => {
      e.preventDefault();
      btn.classList.add('drag-over');
    });
    btn.addEventListener('dragleave', () => btn.classList.remove('drag-over'));
    btn.addEventListener('drop', (e) => {
      e.preventDefault();
      btn.classList.remove('drag-over');
      const name = e.dataTransfer.getData('text/plain');
      if (!name) return;
      const diff = btn.dataset.diff;
      AS.Storage.setLevelMainDifficulty(name, diff);
      AS.Hud.toast('"' + name + '" assigné à ' + AS.DIFFS[diff].label);
      renderTitleRecords();
    });
  });

  // Le temps de chaque course (une par difficulté) s'affiche directement sur
  // son bouton — plus visible qu'une ligne de résumé en bas de l'écran.
  function renderTitleRecords() {
    const d = AS.Storage.load();
    Object.keys(AS.DIFFS).forEach((k) => {
      const el = document.querySelector('[data-diff-best="' + k + '"]');
      if (!el) return;
      const t = d.zoneBest[k];
      el.textContent = t != null ? AS.Hud.fmtTime(t) : '—';
      const levelEl = document.querySelector('[data-diff-level="' + k + '"]');
      if (levelEl) {
        const mainLevel = AS.Storage.getMainLevelFor(k);
        levelEl.textContent = mainLevel ? mainLevel.name : 'Aucun niveau';
      }
    });
    renderTitleLevels();
  }
  renderTitleRecords();

  // Jouer un niveau créé dans l'éditeur directement depuis le menu principal,
  // sans avoir à ouvrir l'éditeur puis chercher "Tester le niveau" — c'est ce
  // détour caché qui rendait la fonctionnalité difficile à trouver.
  function renderTitleLevels() {
    const levels = AS.Storage.loadLevels();
    const names = Object.keys(levels).sort();
    const wrap = $('titleLevels');
    const list = $('titleLevelsList');
    if (names.length === 0) { wrap.hidden = true; return; }
    wrap.hidden = false;
    list.innerHTML = '';
    names.forEach((name) => {
      const lvl = levels[name];
      const row = document.createElement('div');
      row.className = 'title-level-row';
      // Glisse cette ligne sur une des 4 difficultés ci-dessus pour l'y
      // assigner directement (voir le "drop" sur .diff-btn plus haut).
      row.draggable = true;
      row.title = 'Glisse ce niveau sur une difficulté pour l\'y assigner';
      row.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', name);
        e.dataTransfer.effectAllowed = 'link';
      });
      const nameEl = document.createElement('span');
      nameEl.className = 'title-level-name';
      nameEl.textContent = name;
      if (lvl.mainDifficulty && AS.DIFFS[lvl.mainDifficulty]) {
        nameEl.textContent += ' ★ ' + AS.DIFFS[lvl.mainDifficulty].label;
      }
      const bestEl = document.createElement('span');
      bestEl.className = 'title-level-best';
      bestEl.textContent = lvl.best != null ? AS.Hud.fmtTime(lvl.best) : '—';
      const playBtn = document.createElement('button');
      playBtn.className = 'title-level-play';
      playBtn.textContent = 'Jouer';
      playBtn.addEventListener('click', () => startCustomLevel(lvl.blocks, name, lvl.background, lvl.theme));
      const editBtn = document.createElement('button');
      editBtn.className = 'title-level-edit';
      editBtn.textContent = 'Modifier';
      editBtn.addEventListener('click', () => openEditor(name));
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'title-level-delete hold-confirm';
      deleteBtn.textContent = 'Supprimer';
      deleteBtn.title = 'Maintenir 0,7s pour supprimer';
      AS.Util.holdToConfirm(deleteBtn, 700, () => {
        AS.Storage.deleteLevel(name);
        renderTitleLevels();
      });
      const actions = document.createElement('div');
      actions.className = 'title-level-actions';
      actions.appendChild(editBtn);
      actions.appendChild(playBtn);
      actions.appendChild(deleteBtn);
      row.appendChild(nameEl);
      row.appendChild(bestEl);
      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  // ---------------------------------------------------------------------
  // Écran Contrôles / raccourcis clavier
  // ---------------------------------------------------------------------
  $('controlsBtn').addEventListener('click', () => {
    AS.Keybinds.buildUI($('keybindList'));
    syncVolumeUI();
    buildSkinPickerUI();
    $('controlsScreen').hidden = false;
  });

  // Sélecteur de skin : tous les skins partagent la même hitbox, seule
  // l'apparence (couleurs) change (voir SKINS/buildPlayerMesh plus haut).
  function buildSkinPickerUI() {
    const wrap = $('skinPicker');
    wrap.innerHTML = '';
    const current = AS.Storage.getSkin();
    SKINS.forEach((skin) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'skin-swatch' + (skin.id === current ? ' selected' : '');
      const dot = document.createElement('span');
      dot.className = 'skin-swatch-dot';
      dot.style.background = '#' + skin.shirt.toString(16).padStart(6, '0');
      const label = document.createElement('span');
      label.className = 'skin-swatch-label';
      label.textContent = skin.label;
      btn.appendChild(dot);
      btn.appendChild(label);
      btn.addEventListener('click', () => {
        AS.Storage.setSkin(skin.id);
        buildSkinPickerUI();
      });
      wrap.appendChild(btn);
    });
  }
  $('closeControlsBtn').addEventListener('click', () => { $('controlsScreen').hidden = true; });
  $('resetKeybindsBtn').addEventListener('click', () => {
    AS.Storage.resetKeybinds();
    AS.Keybinds.buildUI($('keybindList'));
  });

  function syncVolumeUI() {
    const pct = Math.round(AS.Storage.getSfxVolume() * 100);
    $('sfxVolumeRange').value = pct;
    $('sfxVolumeValue').textContent = pct + '%';
  }
  $('sfxVolumeRange').addEventListener('input', (e) => {
    const v = Number(e.target.value) / 100;
    AS.Storage.setSfxVolume(v);
    AS.Sound.setMasterVolume(v);
    $('sfxVolumeValue').textContent = Math.round(v * 100) + '%';
  });
  // Un aperçu au relâchement, pas à chaque cran glissé (sinon rafale de sons
  // qui se chevauchent pendant qu'on fait glisser le curseur).
  $('sfxVolumeRange').addEventListener('change', () => AS.Sound.play('checkpoint'));

  // ---------------------------------------------------------------------
  // Entrées clavier
  // ---------------------------------------------------------------------
  const keys = new Set();

  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
    const kb = AS.Storage.getKeybinds();
    if (appState === 'playing') {
      if (e.code === kb.pause) {
        appState = 'paused';
        $('pauseScreen').hidden = false;
      }
      if (Object.values(kb).includes(e.code)) e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  $('resumeBtn').addEventListener('click', () => {
    appState = 'playing';
    $('pauseScreen').hidden = true;
  });
  $('respawnBtn').addEventListener('click', () => {
    player.respawn(state.lastCheckpointPos);
    appState = 'playing';
    $('pauseScreen').hidden = true;
  });
  $('quitBtn').addEventListener('click', () => backToMenu());

  $('finishReplayBtn').addEventListener('click', () => {
    $('finishScreen').hidden = true;
    if (state.customLevel) startCustomLevel(AS.Editor.exportBlocks(), state.customLevelName, state.customLevelBackground, state.customLevelTheme);
    else startGame(difficulty);
  });
  $('finishEditorBtn').addEventListener('click', () => {
    $('finishScreen').hidden = true;
    openEditor();
  });
  $('finishMenuBtn').addEventListener('click', () => {
    $('finishScreen').hidden = true;
    backToMenu();
  });

  function backToMenu() {
    appState = 'menu';
    $('hud').hidden = true;
    $('pauseScreen').hidden = true;
    $('finishScreen').hidden = true;
    $('editorScreen').hidden = true;
    AS.Editor.close();
    $('titleScreen').hidden = false;
    renderTitleRecords();
  }

  // ---------------------------------------------------------------------
  // Démarrage d'une partie (Zone 1)
  // ---------------------------------------------------------------------
  $('playBtn').addEventListener('click', () => startGame(difficulty));

  // Le ciel/les montagnes peints à la main servent de repli immédiat pendant
  // le chargement (async) de la vraie photo de paysage ; une fois prête, les
  // meshes procéduraux inutiles sont masqués et level.sky pointe vers la
  // nouvelle carte plane (updateGame() la fait suivre le joueur avec un
  // décalage fixe au lieu d'une copie exacte de position — voir followOffset).
  function activateRealSky(currentScene, currentLevel, imagePath) {
    AS.Fx.loadRealSky(currentScene, (bgMesh) => {
      if (currentLevel.sky) currentLevel.sky.visible = false;
      if (currentLevel.mountains) currentLevel.mountains.visible = false;
      currentLevel.sky = bgMesh;
      // Le brouillard violet sombre était calé sur le ciel peint procédural ;
      // sur la photo de paysage (ciel de jour, lumière chaude), il jurerait.
      if (currentScene.fog) currentScene.fog.color.setHex(0xcfe0e8);
    }, imagePath);
  }

  // Il n'y a plus de niveaux principaux codés en dur : chaque difficulté
  // lance le niveau créé dans l'éditeur qui lui a été assigné (voir
  // AS.Storage.getMainLevelFor / setLevelMainDifficulty). Si aucun niveau
  // n'est assigné, on prévient plutôt que de démarrer sur du vide.
  // Chaque lancement repart du tout début du niveau (jamais d'un checkpoint
  // repris d'une session précédente) : un temps mesuré depuis le milieu du
  // niveau n'aurait de toute façon aucun sens à comparer à un record complet.
  function startGame(diff) {
    const mainLevel = AS.Storage.getMainLevelFor(diff);
    if (!mainLevel) {
      const label = AS.DIFFS[diff] ? AS.DIFFS[diff].label : diff;
      AS.Hud.toast('Aucun niveau assigné à "' + label + '" — crée-en un dans l\'éditeur et assigne-le à cette difficulté.');
      return;
    }
    difficulty = diff;
    scene = new THREE.Scene();
    level = AS.World.buildCustom(scene, mainLevel.blocks, mainLevel.theme);
    // Les raycasts de collision s'appuient sur matrixWorld ; sans ce calcul
    // explicite, tout resterait à l'identité tant que render() n'a pas
    // tourné au moins une fois (glitch de collision possible dès la 1re image).
    scene.updateMatrixWorld(true);
    const bgChoice = AS.BACKGROUND_CHOICES.find((b) => b.id === mainLevel.background);
    activateRealSky(scene, level, bgChoice ? bgChoice.path : AS.BACKGROUND_CHOICES[0].path);

    // Tout est disponible dès le départ, rien à débloquer.
    abilities = { doubleJump: true, wallJump: true, dash: true };

    const startPos = level.spawn.clone();
    state.checkpointIndex = 0;
    state.lastCheckpointPos = startPos.clone();
    state.finished = false;
    state.customLevel = false;
    state.customLevelName = mainLevel.name;
    state.mainDifficulty = diff;
    state.zoneStart = performance.now();
    bursts = [];

    player = new AS.Player(level, startPos, abilities);
    tpCam = new AS.FixedCamera(camera, level.collidables);
    playerMesh = buildPlayerMesh(AS.Storage.getSkin());
    scene.add(playerMesh);
    squash.set(1, 1, 1);
    wallPushTimer = 0;

    AS.Hud.setObjective(hintByCheckpoint[0]);
    setTimeout(() => AS.Hud.setObjective(null), 4500);

    $('titleScreen').hidden = true;
    $('controlsScreen').hidden = true;
    $('editorScreen').hidden = true;
    $('hud').hidden = false;
    appState = 'playing';
  }

  // ---------------------------------------------------------------------
  // Éditeur de niveaux
  // ---------------------------------------------------------------------
  $('editorBtn').addEventListener('click', () => openEditor());

  // `loadName` : ouvre directement sur un niveau existant, prêt à modifier
  // (utilisé par le bouton "Modifier" du menu principal) — sans ça, il
  // fallait ouvrir l'éditeur puis chercher soi-même "Charger" dans la liste.
  function openEditor(loadName) {
    $('titleScreen').hidden = true;
    $('hud').hidden = true;
    $('editorScreen').hidden = false;
    scene = null; // l'éditeur gère sa propre scène/caméra
    AS.Editor.open(renderer, canvas);
    if (loadName) {
      AS.Editor.loadIntoEditor(loadName);
      $('editorNameInput').value = loadName;
      $('editorLevelSelect').value = loadName;
    }
    syncMainSlotUI(loadName || AS.Editor.currentLevelName);
    appState = 'editor';
  }

  // Reflète dans le sélecteur la difficulté principale actuellement assignée
  // au niveau `name` (ou aucune sélection si le niveau n'a jamais été
  // sauvegardé, ou n'est assigné à rien).
  function syncMainSlotUI(name) {
    const sel = $('editorMainSlotSelect');
    sel.value = '';
    if (!name) return;
    const levels = AS.Storage.loadLevels();
    if (levels[name] && levels[name].mainDifficulty) sel.value = levels[name].mainDifficulty;
  }

  $('editorMainSlotSelect').addEventListener('change', () => {
    const sel = $('editorMainSlotSelect');
    const name = AS.Editor.currentLevelName;
    if (!name) {
      AS.Hud.toast('Sauvegarde ce niveau avant de l\'assigner à une difficulté.');
      sel.value = '';
      return;
    }
    const diff = sel.value || null;
    AS.Storage.setLevelMainDifficulty(name, diff);
    AS.Hud.toast(diff ? 'Niveau assigné à "' + AS.DIFFS[diff].label + '"' : 'Niveau retiré des difficultés principales');
    renderTitleRecords();
  });

  // window.confirm()/alert() sont peu fiables une fois le jeu embarqué dans
  // un contexte en bac à sable (ex. l'Artifact publié) — ils peuvent être
  // bloqués et renvoyer faux silencieusement, ce qui empêchait ces boutons
  // d'aller au bout de leur action. Remplacés par un "maintenir pour
  // confirmer" (actions destructives) ou un toast (actions informatives).
  $('editorNewBtn').classList.add('hold-confirm');
  $('editorNewBtn').title = 'Maintenir 0,7s pour effacer et repartir de zéro';
  AS.Util.holdToConfirm($('editorNewBtn'), 700, () => {
    AS.Editor.newLevel();
    $('editorNameInput').value = '';
    syncMainSlotUI('');
  });

  $('editorSaveBtn').addEventListener('click', () => {
    const name = $('editorNameInput').value.trim() || AS.Editor.currentLevelName;
    if (!name) { AS.Hud.toast('Donne un nom à ton niveau avant de sauvegarder.'); return; }
    if (!AS.Editor.hasSpawn()) { AS.Hud.toast('Place un bloc "Départ" avant de sauvegarder.'); return; }
    AS.Editor.currentLevelName = name;
    AS.Storage.saveLevel(name, { blocks: AS.Editor.exportBlocks(), background: AS.Editor.currentBackground, theme: AS.Editor.currentTheme });
    AS.Editor.refreshLevelSelect($('editorLevelSelect'));
    $('editorLevelSelect').value = name;
    syncMainSlotUI(name);
    AS.Hud.toast('Niveau sauvegardé');
  });

  $('editorLoadBtn').addEventListener('click', () => {
    const name = $('editorLevelSelect').value;
    if (!name) return;
    AS.Editor.loadIntoEditor(name);
    $('editorNameInput').value = name;
    syncMainSlotUI(name);
  });

  $('editorDeleteBtn').classList.add('hold-confirm');
  $('editorDeleteBtn').title = 'Maintenir 0,7s pour supprimer';
  AS.Util.holdToConfirm($('editorDeleteBtn'), 700, () => {
    const name = $('editorLevelSelect').value;
    if (!name) return;
    AS.Storage.deleteLevel(name);
    AS.Editor.refreshLevelSelect($('editorLevelSelect'));
    if (AS.Editor.currentLevelName === name) {
      AS.Editor.currentLevelName = '';
      $('editorNameInput').value = '';
      syncMainSlotUI('');
    }
    renderTitleRecords();
  });

  $('editorTestBtn').addEventListener('click', () => {
    if (!AS.Editor.hasSpawn()) { AS.Hud.toast('Place un bloc "Départ" avant de tester.'); return; }
    if (!AS.Editor.hasFinish()) AS.Hud.toast('Pas de bloc "Arrivée" — test lancé quand même');
    $('editorScreen').hidden = true;
    startCustomLevel(AS.Editor.exportBlocks(), AS.Editor.currentLevelName || '', AS.Editor.currentBackground, AS.Editor.currentTheme);
  });

  $('editorAnalyzeBtn').addEventListener('click', () => {
    AS.Hud.toast('Analyse en cours…');
    const analyzeBtn = $('editorAnalyzeBtn');
    analyzeBtn.disabled = true;
    // Un setTimeout laisse le toast s'afficher avant le calcul synchrone
    // (potentiellement quelques centaines de ms sur un gros niveau).
    setTimeout(() => {
      let result;
      try {
        result = AS.Analyzer.analyze(AS.Editor.exportBlocks());
      } finally {
        analyzeBtn.disabled = false;
      }
      renderAnalysisResult(result);
    }, 20);
  });

  $('editorAnalysisClearBtn').addEventListener('click', () => {
    $('editorAnalysis').hidden = true;
    AS.Editor.clearAnalysisTrail();
  });

  function renderAnalysisResult(result) {
    const panel = $('editorAnalysis');
    const body = $('editorAnalysisBody');
    panel.hidden = false;
    if (!result.possible) {
      body.innerHTML = '<div class="editor-analysis-impossible">' + result.message + '</div>';
      AS.Editor.showAnalysisTrail(result.trajectory, result.stuckAt);
      AS.Hud.toast('Niveau impossible');
      return;
    }
    const mins = Math.floor(result.timeSeconds / 60);
    const secs = (result.timeSeconds % 60).toFixed(2);
    const timeStr = (mins > 0 ? mins + ':' + secs.padStart(5, '0') : secs + 's');
    body.innerHTML =
      '<div class="editor-analysis-line">Difficulté : ' + result.difficulty +
        ' points <span class="editor-analysis-badge diff-' + result.difficultyLabel + '">' + result.difficultyLabel + '</span></div>' +
      '<div class="editor-analysis-line">Temps parfait estimé : ' + timeStr + '</div>';
    AS.Editor.showAnalysisTrail(result.trajectory, null);
    AS.Hud.toast('Analyse terminée');
  }

  $('editorQuitBtn').addEventListener('click', () => backToMenu());

  function startCustomLevel(blocks, name, background, theme) {
    AS.Editor.close();
    scene = new THREE.Scene();
    level = AS.World.buildCustom(scene, blocks, theme);
    scene.updateMatrixWorld(true);
    const bgChoice = AS.BACKGROUND_CHOICES.find((b) => b.id === background);
    activateRealSky(scene, level, bgChoice ? bgChoice.path : AS.BACKGROUND_CHOICES[0].path);

    abilities = { doubleJump: true, wallJump: true, dash: true };

    state.checkpointIndex = 0;
    state.lastCheckpointPos = level.spawn.clone();
    state.finished = false;
    state.customLevel = true;
    state.customLevelName = name;
    state.customLevelTheme = theme;
    state.customLevelBackground = background;
    state.mainDifficulty = null;
    state.zoneStart = performance.now();
    bursts = [];

    player = new AS.Player(level, level.spawn, abilities);
    tpCam = new AS.FixedCamera(camera, level.collidables);
    playerMesh = buildPlayerMesh(AS.Storage.getSkin());
    scene.add(playerMesh);
    squash.set(1, 1, 1);
    wallPushTimer = 0;

    AS.Hud.setObjective(name ? ('Test : ' + name) : 'Test du niveau');
    setTimeout(() => AS.Hud.setObjective(null), 3000);

    $('titleScreen').hidden = true;
    $('editorScreen').hidden = true;
    $('hud').hidden = false;
    appState = 'playing';
  }

  // ---------------------------------------------------------------------
  // Déclencheurs (checkpoints, orbes, défis, secrets, arrivée)
  // ---------------------------------------------------------------------
  function processTriggers(dt) {
    const p = player.position;
    for (const t of level.triggers) {
      if (t.type === 'phaseGate' && t.cooldown > 0) t.cooldown = Math.max(0, t.cooldown - dt);
    }
    for (const t of level.triggers) {
      const d = p.distanceTo(t.pos);
      if (d > t.radius) continue;

      if (t.type === 'phaseGate' && t.cooldown <= 0) {
        const spd = player.velocity.length();
        player.position.copy(t.pairPos);
        player.velocity.copy(t.dir).multiplyScalar(Math.max(spd, 6));
        player.grounded = false;
        player.jumpsUsed = 0;
        t.cooldown = AS.CFG.phaseGateCooldown;
        for (const other of level.triggers) {
          if (other.type === 'phaseGate' && other.pos === t.pairPos) other.cooldown = AS.CFG.phaseGateCooldown;
        }
        AS.Hud.toast('Porte de phase');
        squash.set(0.7, 1.4, 0.7);
        AS.Sound.play('phaseGate');
      } else if (t.type === 'checkpoint' && !t.activated) {
        // Un checkpoint s'active dès le premier contact, quel que soit son
        // index — utile pour un ordre de passage non linéaire (raccourci,
        // niveau créé où les checkpoints ne sont pas posés dans l'ordre du
        // parcours) — contrairement à avant, où seul un index STRICTEMENT
        // supérieur au dernier activé comptait.
        t.activated = true;
        state.checkpointIndex = t.index;
        state.lastCheckpointPos = level.checkpoints[t.index].pos.clone();
        const cp = level.checkpoints[t.index];
        cp.flagMat.color.setHex(0x3fa0ff);
        cp.flagMat.emissive.setHex(0x113355);
        AS.Hud.toast('Checkpoint');
        AS.Sound.play('checkpoint');
        const hint = hintByCheckpoint[Math.min(t.index, hintByCheckpoint.length - 1)];
        AS.Hud.setObjective(hint);
        clearTimeout(processTriggers._hintTimer);
        processTriggers._hintTimer = setTimeout(() => AS.Hud.setObjective(null), 4500);
      } else if (t.type === 'secret' && !t.done) {
        t.done = true;
        AS.Hud.toast('🔍 Passage secret découvert !');
      } else if (t.type === 'finish' && !state.finished) {
        state.finished = true;
        const ms = performance.now() - state.zoneStart;
        $('finishTime').textContent = AS.Hud.fmtTime(ms);
        let improved = false;
        if (state.mainDifficulty) {
          const label = AS.DIFFS[state.mainDifficulty] ? AS.DIFFS[state.mainDifficulty].label : state.mainDifficulty;
          $('finishTitle').textContent = (state.customLevelName || label) + ' terminé';
          $('finishTeaser').textContent = 'Retourne à l\'éditeur pour l\'améliorer, ou rejoue pour battre ton temps.';
          $('finishEditorBtn').hidden = false;
          improved = AS.Storage.recordZone(state.mainDifficulty, ms);
        } else if (state.customLevel) {
          $('finishTitle').textContent = (state.customLevelName || 'Niveau') + ' terminé';
          $('finishTeaser').textContent = 'Retourne à l\'éditeur pour l\'améliorer, ou rejoue pour battre ton temps.';
          $('finishEditorBtn').hidden = false;
          if (state.customLevelName) improved = AS.Storage.recordLevelBest(state.customLevelName, ms);
        }
        // Un vrai bruit de victoire distinct quand on bat son record, plutôt
        // que le même son d'arrivée à chaque fois.
        AS.Sound.play(improved ? 'victory' : 'finish');
        $('finishScreen').hidden = false;
        appState = 'finish';
      }
    }
  }

  // ---------------------------------------------------------------------
  // Plateformes fragiles (s'effondrent puis reviennent)
  // ---------------------------------------------------------------------
  function updateCrumbles(dt) {
    for (const c of level.crumbles) {
      const st = c.userData.crumbleState || 'idle';
      if (st === 'idle') {
        if (player.grounded && player.groundObject === c) {
          c.userData.crumbleState = 'shaking';
          c.userData.crumbleT = 0;
        }
      } else if (st === 'shaking') {
        c.userData.crumbleT += dt;
        c.position.x += Math.sin(performance.now() * 0.09) * 0.004;
        if (c.userData.crumbleT > 0.45) {
          c.userData.crumbleState = 'gone';
          c.userData.crumbleT = 0;
          c.userData.disabled = true;
          c.visible = false;
        }
      } else if (st === 'gone') {
        c.userData.crumbleT += dt;
        if (c.userData.crumbleT > 3.2) {
          c.userData.crumbleState = 'idle';
          c.userData.disabled = false;
          c.visible = true;
        }
      }
    }
  }

  // ---------------------------------------------------------------------
  // Boucle de jeu
  // ---------------------------------------------------------------------
  let prevJumpHeld = false, prevDashHeld = false;

  function buildInput() {
    const kb = AS.Storage.getKeybinds();
    const f = keys.has(kb.forward) ? 1 : 0;
    const b = keys.has(kb.back) ? 1 : 0;
    const l = keys.has(kb.left) ? 1 : 0;
    const r = keys.has(kb.right) ? 1 : 0;
    const fwd = tpCam.forwardFlat(), right = tpCam.rightFlat();
    const moveDir = new THREE.Vector3()
      .addScaledVector(fwd, f - b)
      .addScaledVector(right, r - l);
    if (moveDir.lengthSq() > 1) moveDir.normalize();

    const jumpHeld = keys.has(kb.jump);
    const jumpPressedEdge = jumpHeld && !prevJumpHeld;
    prevJumpHeld = jumpHeld;

    const dashHeld = keys.has(kb.dash);
    const dashPressedEdge = dashHeld && !prevDashHeld;
    prevDashHeld = dashHeld;

    return {
      moveDir,
      jumpHeld,
      jumpPressedEdge,
      dashPressedEdge,
      facingFlat: fwd,
      holdingIntoWall: moveDir.lengthSq() > 0.0004,
    };
  }

  function updateGame(dt) {
    const input = buildInput();
    player.update(dt, input);

    for (const m of level.movers) m.update(dt);
    updateCrumbles(dt);
    for (const dcor of level.decorations) dcor.mesh.rotation.y += (dcor.spin || 0) * dt;
    for (const fx of level.fx) fx.update(dt, player.position);

    level.sun.position.set(player.position.x + 16, player.position.y + 28, player.position.z + 12);
    level.sun.target.position.copy(player.position);
    level.sun.target.updateMatrixWorld();

    // Le ciel et les montagnes suivent le joueur : la zone jouable peut s'étendre
    // bien au-delà de leur rayon fixe (surtout en difficulté élevée), sans quoi
    // le joueur finirait par sortir du décor et voir le vide derrière. La
    // photo de fond (un panneau plat, pas une sphère) a sa propre logique de
    // suivi géométrique — voir AS.Fx.loadRealSky — plutôt qu'une copie brute.
    if (level.sky) {
      if (level.sky.userData.updateFollow) level.sky.userData.updateFollow(player.position);
      else level.sky.position.copy(player.position);
    }
    if (level.mountains) level.mountains.position.set(player.position.x, level.mountains.position.y, player.position.z);

    // Un seul son de saut pour les 3 variantes (saut/double saut/wall-jump) :
    // moins d'effets sonores différents, mais chacun reste reconnaissable et
    // le léger tremblé de hauteur (rateJitter) évite la répétition identique.
    if (player.justJumped || player.justDoubleJumped || player.justWallJumped) {
      squash.set(0.82, 1.32, 0.82);
      AS.Sound.play('jump', 0.94 + Math.random() * 0.12);
    }
    if (player.justDoubleJumped) {
      // Le double saut doit se voir, pas seulement s'entendre : un anneau
      // d'étincelles qui s'écarte à l'horizontale, bien distinct du nuage
      // d'atterrissage (blanc, retombe) et de la traînée de dash (des
      // traits, derrière le joueur).
      bursts.push(AS.Fx.doubleJumpBurst(scene, player.position));
    }
    if (player.justWallJumped) {
      // Poussée courte et vive des mains contre le mur, bien distincte de la
      // lente accroche qui précède (voir la branche wallSliding plus bas) —
      // ne se déclenche QUE sur l'appui du saut, jamais juste en s'approchant
      // d'un mur.
      wallPushTimer = WALL_PUSH_DURATION;
    }
    if (player.justDash) {
      // Étirement marqué dans le sens du dash (largeur réduite, longueur
      // étirée) + une traînée dans le monde : le dash doit se voir, pas
      // seulement s'entendre.
      squash.set(0.6, 0.78, 1.75);
      playerMesh.rotation.y = player.yaw;
      bursts.push(AS.Fx.dashTrail(scene, player.position.clone(), player.dashDir.clone()));
      AS.Sound.play('dash', 0.95 + Math.random() * 0.1);
    }
    if (player.justLanded) {
      squash.set(1.22, 0.72, 1.22);
      bursts.push(AS.Fx.landingBurst(scene, player.position));
      AS.Sound.play('land', 0.94 + Math.random() * 0.12);
    }
    // Rebond simple et rebond parfait partagent le même son d'impact ; le
    // rebond parfait est joué un ton nettement plus haut (vitesse de lecture
    // fixe) pour se distinguer sans ajouter un fichier supplémentaire.
    if (player.justBounced) {
      squash.set(1.22, 0.72, 1.22);
      bursts.push(AS.Fx.landingBurst(scene, player.position));
      AS.Sound.play('bounce', 0.94 + Math.random() * 0.12);
    }
    if (player.justPerfectBounce) {
      squash.set(0.62, 1.55, 0.62);
      bursts.push(AS.Fx.landingBurst(scene, player.position));
      AS.Hud.toast('🎯 Rebond parfait !');
      AS.Sound.play('bounce', 1.3);
    }
    if (player.justOrbitExit) {
      squash.set(0.85, 1.2, 0.85);
      AS.Hud.toast('Sortie de glisse orbitale');
    }
    squash.x = AS.Util.damp(squash.x, 1, 9, dt);
    squash.y = AS.Util.damp(squash.y, 1, 9, dt);
    squash.z = AS.Util.damp(squash.z, 1, 9, dt);
    playerMesh.position.copy(player.position);
    playerMesh.scale.copy(squash);
    if (wallPushTimer > 0) {
      // ---- Phase 2 : poussée — les mains repartent vivement du mur ---------
      // Contraste volontaire avec la lenteur de l'accroche : cette phase est
      // courte (WALL_PUSH_DURATION) et va decrescendo vers la pose normale.
      wallPushTimer = Math.max(0, wallPushTimer - dt);
      const t = wallPushTimer / WALL_PUSH_DURATION; // 1 -> 0
      if (playerMesh.userData.arms) {
        playerMesh.userData.arms.forEach((arm) => { arm.rotation.x = -1.9 * t; });
      }
      playerMesh.rotation.y = AS.Util.damp(playerMesh.rotation.y, player.yaw, 10, dt);
    } else if (player.wallSliding) {
      // ---- Phase 1 : accroche — lente et bien visible -----------------------
      // Le personnage se tourne face au mur et plaque progressivement ses
      // deux mains dessus (au lieu de suivre l'orientation de déplacement) :
      // un lambda de damp bien plus faible qu'ailleurs (5 au lieu de 16-22)
      // pour qu'on ait le temps de VOIR la prise se former, pas un instantané.
      const wn = player.wallNormal;
      const faceYaw = Math.atan2(-wn.x, -wn.z);
      playerMesh.rotation.y = AS.Util.damp(playerMesh.rotation.y, faceYaw, 5, dt);
      if (playerMesh.userData.arms) {
        playerMesh.userData.arms.forEach((arm) => {
          arm.rotation.x = AS.Util.damp(arm.rotation.x, -1.35, 5, dt);
        });
      }
    } else {
      playerMesh.rotation.y = AS.Util.damp(playerMesh.rotation.y, player.yaw, 16, dt);
      if (playerMesh.userData.arms) {
        // Bras qui remontent légèrement en l'air (chute/saut) : un peu de vie
        // sans animation de marche complète.
        const swing = Math.min(0.6, Math.max(-0.2, -player.velocity.y * 0.025));
        playerMesh.userData.arms.forEach((arm, i) => { arm.rotation.x = swing * (i === 0 ? 1 : -1) * 0.4; });
      }
    }

    bursts = bursts.filter((burst) => !burst.update(dt));

    tpCam.update(dt, player.position);

    processTriggers(dt);

    if (player.dead) {
      player.respawn(state.lastCheckpointPos);
      AS.Hud.toast('Retour au dernier checkpoint');
    }

    AS.Hud.setAltitude(Math.max(0, player.position.y), level.maxAltitude);
    AS.Hud.setSpeed(player.speed(), AS.CFG.maxSpeed);
    AS.Hud.setZoneTimer(performance.now() - state.zoneStart);
  }

  const clock = new THREE.Clock();
  function tick() {
    requestAnimationFrame(tick);
    const dt = clock.getDelta();
    if (appState === 'playing' && player) updateGame(dt);
    if (appState === 'editor') AS.Editor.tick(Math.min(dt, 0.05));
    else if (scene) renderer.render(scene, camera);
  }
  tick();

  // Petit crochet de debug (lecture seule + avance manuelle d'une image) —
  // pratique en développement, sans effet sur le déroulement normal du jeu.
  window.__AS_DEBUG__ = {
    getState: () => ({ appState, difficulty, checkpointIndex: state.checkpointIndex, customLevel: state.customLevel }),
    getPlayer: () => player,
    getLevel: () => level,
    getPlayerMesh: () => playerMesh,
    getCam: () => tpCam,
    setKey: (code, down) => { if (down) keys.add(code); else keys.delete(code); },
    step: (dt) => {
      if (appState === 'playing' && player) updateGame(dt);
      if (appState === 'editor') AS.Editor.tick(dt);
      else if (scene) renderer.render(scene, camera);
    },
  };
})();
