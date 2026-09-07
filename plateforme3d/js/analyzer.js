// ============================================================================
// ASCENSION — analyzer.js
// Bot d'analyse de niveau (éditeur) : construit le niveau exactement comme en
// jeu (AS.World.buildCustom) puis fait "jouer" un AS.Player réel, piloté par
// un script, pour vérifier que le Départ mène bien à l'Arrivée.
//
// Principe : chaque bloc solide est un noeud (le dessus de sa surface). Entre
// deux noeuds, on teste par SIMULATION RÉELLE (pas une formule à la main) si
// un saut/double-saut/dash suffit à relier l'un à l'autre, en démarrant le
// joueur simulé déjà à pleine vitesse au bord du premier bloc — comme un
// joueur qui aurait pris son élan. La combinaison la plus simple qui réussit
// est retenue (un simple saut avant un double saut, avant un dash) : c'est
// ce qu'un joueur parfait ferait aussi, pas la solution la plus difficile.
// Une fois le graphe construit, un plus court chemin (Dijkstra, coût = temps)
// donne à la fois la faisabilité, le temps "parfait" et la trajectoire à
// afficher. Si l'Arrivée n'est pas atteignable, on renvoie le noeud le plus
// proche d'elle parmi ceux qui restent accessibles : c'est là que ça bloque.
//
// Limites assumées (pour rester dans un temps de dev raisonnable) : les
// orbes de rebond ne sont pas routées délibérément (seulement traversées "en
// chemin" si un saut normal passe dedans), et un bloc "Rebond"/"Rebond
// parfait" n'est pas modélisé comme point de départ d'élan (seulement comme
// étape où l'on rebondit en continuant sur sa lancée) — un niveau qui ne
// serait franchissable qu'en enchaînant plusieurs rebonds volontaires depuis
// un rebond immobile pourrait donc être signalé à tort comme impossible.
// Les enchaînements de wall-jump entre blocs empilés ne sont pas non plus
// explorés par le planificateur (seul le contrôleur réel les sait faire).
// ============================================================================
window.AS = window.AS || {};

AS.Analyzer = (function () {
  const DT = 1 / 60;
  const MAX_FRAMES = 300; // 5s de simulation max par arête tentée
  // Marges volontairement larges : une zone de vent ou de gravité faible sur
  // le trajet peut donner bien plus de portée qu'un saut/dash nu, et ce
  // pré-filtrage n'est qu'une optimisation — la simulation reste seule juge.
  const MAX_HORIZ = 30;
  const MAX_RISE = 14;
  const MAX_DROP = 19;    // au-delà, chute mortelle (voidMargin = 20)
  const MOVER_RIDE_TIME = 2.4;

  function fixedControlBasis() {
    const yaw = AS.CAMERA_YAW;
    return {
      fwd: new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)),
      right: new THREE.Vector3(Math.sin(yaw - Math.PI / 2), 0, Math.cos(yaw - Math.PI / 2)),
    };
  }

  // Le joueur ne peut viser que 8 directions (avant/arrière/gauche/droite du
  // repère fixe, combinées) — jamais un angle libre. Sur une grille d'éditeur,
  // beaucoup d'écarts ne sont ALIGNÉS ni sur un axe ni sur une diagonale à 45°
  // (ex. décalage de 1 cellule sur un axe et 2 sur l'autre) : aucune des 8
  // directions ne pointe alors exactement sur la cible. On renvoie les 8
  // candidates triées par alignement (produit scalaire décroissant) pour que
  // l'appelant puisse en essayer plusieurs plutôt qu'une seule, comme un
  // joueur choisirait la touche qui rapproche le plus de la cible.
  function candidateMoveDirs(desired, basis) {
    const combos = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    const dirs = combos.map(([f, r]) => new THREE.Vector3().addScaledVector(basis.fwd, f).addScaledVector(basis.right, r).normalize());
    dirs.sort((a, b) => b.dot(desired) - a.dot(desired));
    return dirs;
  }

  function buildNodes(blocks) {
    const cell = AS.EDITOR_CELL;
    const SOLID = new Set(['normal', 'ice', 'boost', 'bounce', 'crumble', 'perfectBounce', 'spawn', 'finish']);
    const nodes = [];
    blocks.forEach((b, i) => {
      if (!SOLID.has(b.type)) return;
      const topY = b.gy * cell.y + (cell.y * 0.92) / 2;
      const node = {
        id: 'b' + i, kind: 'platform', surface: b.type,
        pos: new THREE.Vector3(b.gx * cell.x, topY, b.gz * cell.z),
        half: { x: cell.x * 0.96 / 2, z: cell.z * 0.96 / 2 },
      };
      if (b.type === 'boost') {
        const rot = (b.rot || 0) * Math.PI / 2;
        node.boostDir = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot));
      }
      nodes.push(node);
    });

    // Plateformes mobiles : les deux extrémités deviennent des noeuds
    // ordinaires (on peut sauter dessus/depuis), reliées en plus entre elles
    // par une arête "trajet" (temps de la traversée du va-et-vient).
    const moverBlocks = blocks.filter((b) => b.type === 'mover');
    const extraEdges = [];
    for (let i = 0; i + 1 < moverBlocks.length; i += 2) {
      const ma = moverBlocks[i], mb = moverBlocks[i + 1];
      const pa = new THREE.Vector3(ma.gx * cell.x, ma.gy * cell.y, ma.gz * cell.z);
      const pb = new THREE.Vector3(mb.gx * cell.x, mb.gy * cell.y, mb.gz * cell.z);
      const na = { id: 'mv' + i + 'a', kind: 'mover', surface: 'normal', pos: pa, half: { x: cell.x * 0.96 / 2, z: cell.z * 0.96 / 2 } };
      const nb = { id: 'mv' + i + 'b', kind: 'mover', surface: 'normal', pos: pb, half: { x: cell.x * 0.96 / 2, z: cell.z * 0.96 / 2 } };
      nodes.push(na, nb);
      extraEdges.push({ from: na.id, to: nb.id, time: MOVER_RIDE_TIME, difficulty: 1, trajectory: [pa.clone(), pb.clone()] });
      extraEdges.push({ from: nb.id, to: na.id, time: MOVER_RIDE_TIME, difficulty: 1, trajectory: [pb.clone(), pa.clone()] });
    }

    return { nodes, extraEdges };
  }

  function addPhaseGateNodes(nodes, extraEdges, level) {
    const gates = (level.triggers || []).filter((t) => t.type === 'phaseGate');
    const gateNodes = gates.map((t, i) => ({
      id: 'gate' + i, kind: 'phase', surface: 'normal',
      pos: t.pos.clone(), half: { x: 0.9, z: 0.9 }, trigger: t, triggerRadius: t.radius,
    }));
    gateNodes.forEach((n) => nodes.push(n));
    gateNodes.forEach((n, i) => {
      const j = gates.findIndex((t) => t.pos.distanceTo(n.trigger.pairPos) < 0.05);
      if (j >= 0 && j !== i) {
        extraEdges.push({
          from: n.id, to: gateNodes[j].id, time: 0.25, difficulty: 2,
          trajectory: [n.pos.clone(), gateNodes[j].pos.clone()],
        });
      }
    });
  }

  // Durée totale d'un saut tenu "th" secondes puis relâché (le jeu réduit la
  // gravité en montée tant que le saut est maintenu — relâcher tôt donne un
  // petit saut, cf. player.js). Renvoie le temps total en l'air pour
  // retomber à une hauteur relative dyTarget, ou null si le sommet atteint
  // est plus bas que dyTarget (saut trop court pour même atteindre la cible).
  function tApexFullSeconds() { return AS.CFG.jumpVel / -AS.CFG.gravityRise; }

  function analyticAirtime(th, dyTarget) {
    const CFG = AS.CFG;
    const tFull = CFG.jumpVel / -CFG.gravityRise;
    th = Math.max(0, Math.min(th, tFull));
    const vRelease = CFG.jumpVel + CFG.gravityRise * th;
    const hTh = CFG.jumpVel * th + 0.5 * CFG.gravityRise * th * th;
    let H, tApexTotal;
    if (vRelease <= 0) {
      H = hTh; tApexTotal = th;
    } else {
      const gReleased = CFG.gravityRise * 2.6;
      const t2 = vRelease / -gReleased;
      H = hTh + (vRelease * vRelease) / (2 * -gReleased);
      tApexTotal = th + t2;
    }
    if (H < dyTarget) return null;
    const t3 = Math.sqrt(2 * (H - dyTarget) / -CFG.gravityFall);
    return tApexTotal + t3;
  }

  // Un joueur parfait ne saute pas toujours au maximum : il relâche le saut
  // au bon moment pour atterrir pile sur la cible (sauter à fond sur un
  // petit écart le ferait systématiquement atterrir trop loin). On cherche
  // par dichotomie la durée de maintien qui donne la bonne portée, puisque
  // la portée croît avec la durée de maintien (fonction monotone).
  function findHoldSeconds(targetDist, runSpeed, dyTarget) {
    const tFull = AS.CFG.jumpVel / -AS.CFG.gravityRise;
    const reachAt = (th) => { const a = analyticAirtime(th, dyTarget); return a == null ? null : a * runSpeed; };
    const reachHi = reachAt(tFull);
    if (reachHi == null || reachHi < targetDist) return tFull; // hors de portée même à fond -> tenter avec assistance
    const reachLo = reachAt(0);
    if (reachLo != null && reachLo >= targetDist) return 0; // même une pichenette suffit/dépasse déjà
    let lo = 0, hi = tFull;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      const r = reachAt(mid);
      if (r == null || r < targetDist) lo = mid; else hi = mid;
    }
    return hi;
  }

  // Simule une tentative réelle (vrai AS.Player, vrai niveau) pour relier A à
  // B : démarre déjà à pleine vitesse au bord de A (comme un joueur qui a
  // pris son élan), tente saut simple / double saut / dash, dans cet ordre
  // (la première combinaison qui marche est la plus simple — donc celle
  // qu'un joueur parfait choisirait). La durée de maintien du saut est
  // ajustée pour ne pas systématiquement dépasser la cible.
  function trySimulateEdge(level, A, B, basis) {
    const horiz = new THREE.Vector3(B.pos.x - A.pos.x, 0, B.pos.z - A.pos.z);
    const horizDist = horiz.length();
    const dy = B.pos.y - A.pos.y;
    if (horizDist < 0.05 && Math.abs(dy) < 0.05) return null;

    const desiredDir = A.boostDir ? A.boostDir.clone() : (horizDist > 1e-4 ? horiz.clone().normalize() : new THREE.Vector3(0, 0, -1));
    // Sur une grille, l'écart n'est pas toujours aligné sur une des 8
    // directions disponibles (ex. 1 cellule sur un axe, 2 sur l'autre) :
    // on essaie les meilleures candidates plutôt qu'une seule, sinon un
    // saut réellement faisable serait signalé à tort comme impossible.
    const dirCandidates = A.boostDir ? [A.boostDir.clone()] : candidateMoveDirs(desiredDir, basis).slice(0, 3);

    const runSpeed = A.surface === 'boost' ? AS.CFG.boostMaxSpeed : AS.CFG.maxSpeed;
    const tol = Math.max(B.half.x, B.half.z) * 0.9 + 0.3;

    const OPTIONS = [
      { label: 'walk', jump: false, doubleJump: false, dash: false, difficulty: 0 },
      { label: 'jump', jump: true, doubleJump: false, dash: false, difficulty: 1 },
      { label: 'jumpDouble', jump: true, doubleJump: true, dash: false, difficulty: 2 },
      { label: 'jumpDash', jump: true, doubleJump: false, dash: true, difficulty: 3 },
      { label: 'jumpDoubleDash', jump: true, doubleJump: true, dash: true, difficulty: 4 },
    ];

    for (const dir of dirCandidates) {
      if (dir.lengthSq() < 0.01) continue; // inatteignable dans cette direction

      const edgeStartOffset = Math.min(A.half.x, A.half.z) * 0.85;
      const startPos = A.pos.clone().addScaledVector(dir, edgeStartOffset);
      startPos.y = A.pos.y + 0.03;
      const flightDist = Math.hypot(B.pos.x - startPos.x, B.pos.z - startPos.z);
      const dyTarget = B.pos.y - startPos.y;
      const tunedHold = findHoldSeconds(flightDist, runSpeed, dyTarget);
      // Pour les options avec assistance (double saut/dash), un saut tenu à
      // fond laisse le plus de marge à combler ensuite ; si ça ne suffit pas
      // non plus, quelques fractions de maintien plus courtes sont tentées.
      const HOLD_CANDIDATES_BY_OPTION = {
        walk: [0], jump: [tunedHold],
        jumpDouble: [tApexFullSeconds(), tunedHold, tApexFullSeconds() * 0.6],
        jumpDash: [tApexFullSeconds(), tunedHold, tApexFullSeconds() * 0.6],
        jumpDoubleDash: [tApexFullSeconds(), tunedHold, tApexFullSeconds() * 0.6],
      };

      for (const opt of OPTIONS) {
        const holdCandidates = HOLD_CANDIDATES_BY_OPTION[opt.label];
        for (const holdSeconds of holdCandidates) {
          const holdFrames = Math.max(1, Math.round(holdSeconds * 60));
          (level.bounceOrbs || []).forEach((o) => { o._playerWasInside = false; });

          const player = new AS.Player(level, startPos, { doubleJump: true, wallJump: true, dash: true });
          player.velocity.set(dir.x * runSpeed, 0, dir.z * runSpeed);
          player.grounded = true;

          let jumped = false, doubleJumped = false, dashed = false;
          const trajectory = [player.position.clone()];
          let success = false, frames = 0;
          for (frames = 0; frames < MAX_FRAMES; frames++) {
            // Direction "poursuite" recalculée chaque image (comme un joueur
            // qui corrige sa trajectoire en l'air) plutôt qu'une direction
            // figée au décollage : sur une grille, la cible n'est presque
            // jamais exactement sur une des 8 directions disponibles, un
            // joueur réel rectifie donc en vol via l'air-control.
            const toTarget = new THREE.Vector3(B.pos.x - player.position.x, 0, B.pos.z - player.position.z);
            const liveDir = toTarget.lengthSq() > 0.01 ? candidateMoveDirs(toTarget.normalize(), basis)[0] : dir;
            const input = {
              moveDir: liveDir.clone(),
              facingFlat: liveDir.lengthSq() > 0.0004 ? liveDir.clone() : new THREE.Vector3(0, 0, -1),
              jumpHeld: opt.jump && frames < holdFrames,
              jumpPressedEdge: false,
              dashPressedEdge: false,
              holdingIntoWall: liveDir.lengthSq() > 0.0004,
            };
            if (opt.jump && !jumped) { input.jumpPressedEdge = true; jumped = true; }
            if (opt.doubleJump && jumped && !doubleJumped && !player.grounded && player.velocity.y <= 0.5) {
              input.jumpPressedEdge = true; doubleJumped = true;
            }
            if (opt.dash && jumped && !dashed && !player.grounded) {
              input.dashPressedEdge = true; dashed = true;
            }

            player.update(DT, input);
            trajectory.push(player.position.clone());

            if (player.dead) { success = false; break; }

            // Une porte de phase est un déclencheur volumique (jamais de sol) :
            // il suffit de passer à portée, pas de s'y "poser".
            if (B.kind === 'phase') {
              if (player.position.distanceTo(B.pos) < B.triggerRadius) { success = true; break; }
              if (player.grounded && frames > 1) { success = false; break; }
              continue;
            }

            const nearB = player.position.distanceTo(B.pos) < tol && Math.abs(player.position.y - B.pos.y) < 0.7;
            if (nearB && (player.grounded || player.justBounced || player.justPerfectBounce)) { success = true; break; }
            if (player.grounded && !nearB && frames > 1) { success = false; break; }
          }

          if (success) {
            let difficulty = opt.difficulty;
            if (B.surface === 'ice') difficulty += 1;
            if (A.surface === 'crumble' || B.surface === 'crumble') difficulty += 2;
            const d = player.position.distanceTo(B.pos);
            if (tol - d < tol * 0.3) difficulty += 1; // atterrissage précis
            return { time: frames * DT, difficulty, trajectory };
          }
        }
      }
    }
    return null;
  }

  function buildEdges(level, nodes, basis) {
    const edges = [];
    for (const A of nodes) {
      for (const B of nodes) {
        if (A === B) continue;
        const dy = B.pos.y - A.pos.y;
        if (dy > MAX_RISE || dy < -MAX_DROP) continue;
        const dxFlat = Math.hypot(B.pos.x - A.pos.x, B.pos.z - A.pos.z);
        if (dxFlat > MAX_HORIZ) continue;
        const r = trySimulateEdge(level, A, B, basis);
        if (r) edges.push({ from: A.id, to: B.id, time: r.time, difficulty: r.difficulty, trajectory: r.trajectory });
      }
    }
    return edges;
  }

  function dijkstra(nodes, edges, startId) {
    const dist = new Map(), prevEdge = new Map(), visited = new Set();
    nodes.forEach((n) => dist.set(n.id, Infinity));
    dist.set(startId, 0);
    const byFrom = new Map();
    edges.forEach((e) => {
      if (!byFrom.has(e.from)) byFrom.set(e.from, []);
      byFrom.get(e.from).push(e);
    });
    while (true) {
      let u = null, best = Infinity;
      for (const n of nodes) {
        if (!visited.has(n.id) && dist.get(n.id) < best) { best = dist.get(n.id); u = n.id; }
      }
      if (u === null) break;
      visited.add(u);
      for (const e of (byFrom.get(u) || [])) {
        const nd = dist.get(u) + e.time;
        if (nd < dist.get(e.to)) { dist.set(e.to, nd); prevEdge.set(e.to, e); }
      }
    }
    return { dist, prevEdge, reached: visited };
  }

  function scoreLabel(points) {
    if (points <= 5) return 'Facile';
    if (points <= 12) return 'Modéré';
    if (points <= 22) return 'Difficile';
    return 'Extrême';
  }

  function analyze(blocks) {
    if (!blocks.some((b) => b.type === 'spawn')) {
      return { possible: false, message: 'Place un bloc "Départ" avant d\'analyser.' };
    }
    if (!blocks.some((b) => b.type === 'finish')) {
      return { possible: false, message: 'Place un bloc "Arrivée" avant d\'analyser.' };
    }

    const scene = new THREE.Scene();
    const level = AS.World.buildCustom(scene, blocks);
    // Sans ça, les matrices monde des meshes ajoutés restent à l'identité
    // (jamais recalculées hors boucle de rendu) et tous les raycasts du
    // contrôleur (sol/murs) testent une géométrie mal positionnée.
    scene.updateMatrixWorld(true);
    const basis = fixedControlBasis();

    const { nodes, extraEdges } = buildNodes(blocks);
    addPhaseGateNodes(nodes, extraEdges, level);

    const spawnNode = nodes.find((n) => n.surface === 'spawn');
    const finishNode = nodes.find((n) => n.surface === 'finish');
    if (!spawnNode || !finishNode) {
      return { possible: false, message: 'Départ ou Arrivée introuvable dans le niveau.' };
    }

    const simEdges = buildEdges(level, nodes, basis);
    const edges = simEdges.concat(extraEdges);

    const { dist, prevEdge, reached } = dijkstra(nodes, edges, spawnNode.id);

    if (!reached.has(finishNode.id) || dist.get(finishNode.id) === Infinity) {
      // Le noeud accessible le plus proche (à vol d'oiseau) de l'Arrivée :
      // c'est là que la progression s'arrête.
      let frontier = spawnNode, bestD = Infinity;
      for (const n of nodes) {
        if (!reached.has(n.id)) continue;
        const d = n.pos.distanceTo(finishNode.pos);
        if (d < bestD) { bestD = d; frontier = n; }
      }
      const trail = [];
      let cur = frontier.id;
      const chain = [];
      while (prevEdge.has(cur)) { const e = prevEdge.get(cur); chain.unshift(e); cur = e.from; }
      chain.forEach((e) => e.trajectory.forEach((p) => trail.push(p)));
      return {
        possible: false,
        stuckAt: frontier.pos.clone(),
        trajectory: trail,
        message: 'Niveau impossible : aucun chemin trouvé au-delà de (' +
          frontier.pos.x.toFixed(1) + ', ' + frontier.pos.y.toFixed(1) + ', ' + frontier.pos.z.toFixed(1) + ').',
      };
    }

    // Reconstruit le chemin complet depuis l'Arrivée.
    const chain = [];
    let cur = finishNode.id;
    while (prevEdge.has(cur)) { const e = prevEdge.get(cur); chain.unshift(e); cur = e.from; }
    const trajectory = [];
    chain.forEach((e) => e.trajectory.forEach((p) => trajectory.push(p)));
    const difficulty = chain.reduce((s, e) => s + e.difficulty, 0);
    const timeSeconds = dist.get(finishNode.id);

    return {
      possible: true,
      difficulty,
      difficultyLabel: scoreLabel(difficulty),
      timeSeconds,
      trajectory,
      message: null,
    };
  }

  return { analyze };
})();
