// ============================================================================
// ASCENSION — player.js
// Contrôleur de personnage "kinematic" : pas de moteur physique, tout est
// résolu par raycasts contre les meshes praticables (AS.World.collidables).
//
// Mouvement de base : accélération/friction avec conservation d'élan, saut/
// double saut, wall-jump, dash, surfaces spéciales (glace/boost/rebond),
// vent, gravité locale, portage par plateformes mobiles, respawn.
//
// Mécaniques avancées :
//  - Rebond parfait  : timing d'impact sur une surface compatible -> gros boost.
//  - Glisse orbitale : capture tangentielle sur une structure -> virage en 3D.
//  - Portes de phase : gérées dans main.js (téléportation + direction changée).
// (Impulsion, Point d'ancrage et Surcharge ont été retirées du jeu.)
// ============================================================================
window.AS = window.AS || {};

AS.Player = function (level, spawnPos, abilities) {
  const CFG = AS.CFG;

  this.position = spawnPos.clone();
  this.velocity = new THREE.Vector3();
  this.radius = CFG.playerRadius;
  this.height = CFG.playerHeight;
  this.yaw = 0; // orientation visuelle du personnage (pas la caméra)
  // Seuil de vide relatif à la dernière plateforme solide (voir _checkVoid) —
  // recalé à chaque atterrissage et à chaque respawn.
  this.voidY = spawnPos.y - CFG.voidMargin;

  this.grounded = false;
  this.groundObject = null;
  this.groundSurface = 'normal';
  this.wallNormal = new THREE.Vector3();
  this.wallContactTimer = 0;
  // Vrai pendant la glisse le long d'un mur (voir _verticalForcesAndJump) —
  // exposé sur l'instance pour que main.js puisse jouer une animation
  // dédiée (le personnage se plaque contre le mur) sans dupliquer la
  // condition de détection.
  this.wallSliding = false;
  this.jumpsUsed = 0;
  this.coyoteTimer = 0;
  this.jumpBufferTimer = 0;
  this.dashActive = false;
  this.dashTimer = 0;
  this.dashDir = new THREE.Vector3(0, 0, -1);
  this.dashCharges = CFG.dashCharges;
  this.abilities = abilities; // { doubleJump, wallJump, dash }

  // ---- Rebond parfait --------------------------------------------------
  this.perfectWindowTimer = 0;
  this.lastImpactSpeed = 0;

  // ---- Glisse orbitale -------------------------------------------------
  this.orbitState = 'idle';
  this.orbitObj = null;
  this.orbitAngle = 0;
  this.orbitDir = 1;
  this.orbitSpeed = 0;
  this.orbitVy = 0;
  this.orbitTimer = 0;

  this.justJumped = false;
  this.justDoubleJumped = false;
  this.justWallJumped = false;
  this.justBounced = false;
  this.justLanded = false;
  this.justPerfectBounce = false;
  this.justOrbitExit = false;
  this.justOrbitCapture = false;
  this.justDash = false;
  this.dead = false;

  this.level = level;
  this._ray = new THREE.Raycaster();

  this._prevGroundedFrame = false;
};

AS.Player.prototype._insideZone = function (zone) {
  const p = this.position;
  return p.x >= zone.min.x && p.x <= zone.max.x &&
         p.y >= zone.min.y && p.y <= zone.max.y &&
         p.z >= zone.min.z && p.z <= zone.max.z;
};

AS.Player.prototype._groundRay = function (extraDist) {
  const origin = this.position.clone();
  origin.y += 0.55;
  this._ray.set(origin, new THREE.Vector3(0, -1, 0));
  this._ray.far = 0.55 + extraDist;
  const hits = this._ray.intersectObjects(this.level.collidables, false);
  for (const h of hits) {
    if (h.object.userData.disabled) continue;
    const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
    if (n.y > 0.55) return { hit: h, normal: n };
  }
  return null;
};

// `extraFar` doit couvrir la distance parcourue cette frame : sans ça, un
// mouvement rapide (dash, sortie d'orbite) peut dépasser la portée du rayon
// en une seule frame et traverser un mur fin de part en part. Deux hauteurs
// sont sondées (chevilles/torse) pour ne pas rater un muret bas ou une
// arête qui manquerait un rayon unique.
AS.Player.prototype._wallRay = function (dir, extraFar) {
  if (dir.lengthSq() < 1e-5) return null;
  const d = dir.clone().normalize();
  const far = this.radius + 0.35 + Math.max(0, extraFar || 0);
  let best = null;
  for (const hf of [0.25, 0.85]) {
    const origin = this.position.clone();
    origin.y += this.height * hf;
    this._ray.set(origin, d);
    this._ray.far = far;
    const hits = this._ray.intersectObjects(this.level.collidables, false);
    for (const h of hits) {
      if (h.object.userData.disabled) continue;
      const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3();
      if (Math.abs(n.y) < 0.42 && (!best || h.distance < best.hit.distance)) best = { hit: h, normal: n };
    }
  }
  return best;
};

// Vérifie si le segment [from -> to] traverse un obstacle solide, tous
// angles de surface confondus (sol/mur/plafond) — utilisé pour empêcher la
// glisse orbitale (trajectoire scriptée, qui ne passe pas par
// _integrateAndCollide) de traverser la géométrie. Ignore les colliders
// désactivés (crumble déjà effondré) ; les portes de phase ne sont
// volontairement jamais des colliders (ce sont des déclencheurs), donc
// elles ne bloquent jamais.
AS.Player.prototype._pathBlocked = function (from, to) {
  const delta = new THREE.Vector3().subVectors(to, from);
  const dist = delta.length();
  if (dist < 1e-5) return null;
  const dir = delta.clone().normalize();
  let best = null;
  for (const hf of [0.2, 0.5, 0.9]) {
    const origin = from.clone();
    origin.y += this.height * hf;
    this._ray.set(origin, dir);
    this._ray.far = dist + this.radius;
    const hits = this._ray.intersectObjects(this.level.collidables, false);
    for (const h of hits) {
      if (h.object.userData.disabled) continue;
      if (h.distance <= dist + this.radius && (!best || h.distance < best.distance)) best = h;
    }
  }
  return best;
};

// Utilisé par la glisse orbitale (trajectoire scriptée) : si le déplacement
// de cette frame traverse un obstacle, ramène la position juste avant
// l'impact et signale l'arrêt. Elle ne passe pas par _integrateAndCollide,
// donc sans ce garde-fou rien ne l'empêcherait de traverser un mur ou un sol.
AS.Player.prototype._scriptedMoveGuard = function (prevPos) {
  const hit = this._pathBlocked(prevPos, this.position);
  if (!hit) return false;
  const dir = new THREE.Vector3().subVectors(this.position, prevPos);
  const dist = dir.length();
  if (dist > 1e-5) dir.divideScalar(dist);
  const safeDist = Math.max(0, hit.distance - this.radius);
  this.position.copy(prevPos).addScaledVector(dir, safeDist);
  return true;
};

AS.Player.prototype._ceilingRay = function (extraFar) {
  const origin = this.position.clone();
  origin.y += this.height - 0.1;
  this._ray.set(origin, new THREE.Vector3(0, 1, 0));
  this._ray.far = 0.35 + Math.max(0, extraFar || 0);
  const hits = this._ray.intersectObjects(this.level.collidables, false);
  for (const h of hits) {
    if (h.object.userData.disabled) continue;
    return h;
  }
  return null;
};

AS.Player.prototype.speed = function () {
  return this.velocity.length();
};

// ============================================================================
// Boucle principale : l'état spécial (orbite) prend la main sur toute la
// frame quand actif — pas de saccade, la physique normale reprend dès qu'il
// relâche le joueur.
// ============================================================================
AS.Player.prototype.update = function (dt, input) {
  dt = Math.min(dt, 0.033);
  this.justJumped = false;
  this.justDoubleJumped = false;
  this.justWallJumped = false;
  this.justBounced = false;
  this.justLanded = false;
  this.justPerfectBounce = false;
  this.justOrbitExit = false;
  this.justOrbitCapture = false;
  this.justDash = false;

  if (this.orbitState !== 'orbiting') this._tryOrbitCapture();
  if (this.orbitState === 'orbiting') { this._orbitStep(dt, input); this._checkVoid(); return; }

  this._horizontal(dt, input);
  this._verticalForcesAndJump(dt, input);
  this._integrateAndCollide(dt);
  this._checkVoid();
};

// ---------------------------------------------------------------------------
// Glisse orbitale
// ---------------------------------------------------------------------------
AS.Player.prototype._tryOrbitCapture = function () {
  const CFG = AS.CFG;
  if (this.dashActive) return;
  if (this.speed() < CFG.orbitCaptureSpeed) return;
  for (const orb of this.level.orbitals) {
    const dx = this.position.x - orb.center.x, dz = this.position.z - orb.center.z;
    const distXZ = Math.hypot(dx, dz);
    if (Math.abs(distXZ - orb.radius) > CFG.orbitCaptureBand) continue;
    if (this.position.y < orb.center.y - orb.height / 2 || this.position.y > orb.center.y + orb.height / 2) continue;

    this.orbitState = 'orbiting';
    this.justOrbitCapture = true;
    this.orbitObj = orb;
    this.orbitAngle = Math.atan2(dz, dx);
    const tangent = new THREE.Vector3(-dz, 0, dx).normalize();
    const vTang = this.velocity.x * tangent.x + this.velocity.z * tangent.z;
    this.orbitDir = vTang >= 0 ? 1 : -1;
    this.orbitSpeed = this.speed();
    this.orbitVy = this.velocity.y;
    this.orbitTimer = 0;
    return;
  }
};

AS.Player.prototype._orbitStep = function (dt, input) {
  const CFG = AS.CFG;
  const orb = this.orbitObj;
  const prevPos = this.position.clone();
  this.orbitTimer += dt;
  const angularSpeed = (this.orbitSpeed / Math.max(1, orb.radius)) * this.orbitDir;
  this.orbitAngle += angularSpeed * dt;
  this.position.x = orb.center.x + Math.cos(this.orbitAngle) * orb.radius;
  this.position.z = orb.center.z + Math.sin(this.orbitAngle) * orb.radius;
  this.orbitVy += CFG.gravityFall * CFG.orbitGravityScale * dt;
  this.position.y += this.orbitVy * dt;

  // La structure orbitale elle-même n'est pas un collider (sinon le joueur
  // se ferait bloquer par sa propre trajectoire) ; seul un obstacle tiers
  // (mur, plateforme) coupe l'orbite net.
  const blocked = this._scriptedMoveGuard(prevPos);
  const outOfHeight = this.position.y < orb.center.y - orb.height / 2 || this.position.y > orb.center.y + orb.height / 2;
  if (input.jumpPressedEdge || this.orbitTimer > CFG.orbitMaxDuration || outOfHeight || blocked) {
    const tangent = new THREE.Vector3(-Math.sin(this.orbitAngle), 0, Math.cos(this.orbitAngle)).multiplyScalar(this.orbitDir);
    const speed = blocked ? 0 : this.orbitSpeed;
    this.velocity.set(tangent.x * speed, blocked ? 0 : this.orbitVy, tangent.z * speed);
    this.orbitState = 'idle';
    this.justOrbitExit = !blocked;
    this.jumpsUsed = 0;
    this.grounded = false;
  }
};

// ---------------------------------------------------------------------------
// Mouvement horizontal (sol/air) — accélération + friction, conserve l'élan.
// ---------------------------------------------------------------------------
AS.Player.prototype._horizontal = function (dt, input) {
  const CFG = AS.CFG;
  const moveDir = input.moveDir; // Vector3 déjà horizontal + normalisé (ou longueur 0)

  if (this.dashActive) return; // vitesse pilotée entièrement par le dash

  let accel = this.grounded ? CFG.accelGround : CFG.accelAir;
  let friction = this.grounded ? CFG.frictionGround : CFG.frictionAir;
  let maxSpd = CFG.maxSpeed;
  let forcedDir = null;

  if (this.grounded && this.groundSurface === 'ice') {
    accel = CFG.iceAccel; friction = CFG.iceFriction;
  } else if (this.grounded && this.groundSurface === 'boost' && this.groundObject) {
    accel = CFG.accelGround * 1.4;
    maxSpd = CFG.boostMaxSpeed;
    forcedDir = this.groundObject.userData.boostDir;
  }

  const horiz = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);

  if (forcedDir) {
    const target = forcedDir.clone().multiplyScalar(maxSpd);
    const diff = target.sub(horiz);
    const dLen = diff.length();
    const maxDelta = accel * dt;
    if (dLen > maxDelta) diff.multiplyScalar(maxDelta / dLen);
    horiz.add(diff);
  } else if (moveDir.lengthSq() > 0.0004) {
    const target = moveDir.clone().multiplyScalar(maxSpd);
    const diff = target.sub(horiz);
    const dLen = diff.length();
    const maxDelta = accel * dt;
    if (dLen > maxDelta) diff.multiplyScalar(maxDelta / dLen);
    horiz.add(diff);
  } else {
    const speed = horiz.length();
    if (speed > 0.001) {
      const drop = Math.min(speed, friction * dt);
      horiz.multiplyScalar((speed - drop) / speed);
    } else {
      horiz.set(0, 0, 0);
    }
  }

  this.velocity.x = horiz.x;
  this.velocity.z = horiz.z;

  if (moveDir.lengthSq() > 0.0004) {
    this.yaw = Math.atan2(moveDir.x, moveDir.z);
  }
};

// ---------------------------------------------------------------------------
// Gravité, vent, saut / double saut / wall-jump / rebond parfait.
// ---------------------------------------------------------------------------
AS.Player.prototype._verticalForcesAndJump = function (dt, input) {
  const CFG = AS.CFG;

  // ---- timers de confort (coyote time / jump buffer / fenêtre de rebond) --
  this.coyoteTimer = this.grounded ? CFG.coyoteTime : Math.max(0, this.coyoteTimer - dt);
  this.wallContactTimer = Math.max(0, this.wallContactTimer - dt);
  this.perfectWindowTimer = Math.max(0, this.perfectWindowTimer - dt);
  if (input.jumpPressedEdge) this.jumpBufferTimer = CFG.jumpBuffer;
  else this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);

  // ---- dash : démarrage ------------------------------------------------
  if (input.dashPressedEdge && this.abilities.dash && this.dashCharges > 0 && !this.dashActive) {
    let dir = input.moveDir.lengthSq() > 0.0004 ? input.moveDir.clone() : input.facingFlat.clone();
    dir.y = 0;
    if (dir.lengthSq() < 1e-5) dir.set(0, 0, -1);
    dir.normalize();
    this.dashActive = true;
    this.justDash = true;
    this.dashTimer = CFG.dashDuration;
    this.dashDir = dir;
    // Le personnage se tourne immédiatement dans le sens du dash (au lieu de
    // garder l'orientation d'avant) : sans ça, l'effet visuel de dash — voir
    // main.js — s'étire dans une direction qui ne correspond pas au regard.
    this.yaw = Math.atan2(dir.x, dir.z);
    this.dashCharges--;
    this.velocity.set(dir.x * CFG.dashSpeed, 0, dir.z * CFG.dashSpeed);
    this.grounded = false;
  }

  if (this.dashActive) {
    this.dashTimer -= dt;
    this.velocity.x = this.dashDir.x * CFG.dashSpeed;
    this.velocity.z = this.dashDir.z * CFG.dashSpeed;
    this.velocity.y = 0;
    if (this.dashTimer <= 0) this.dashActive = false;
    return; // pas de gravité ni de saut pendant le dash
  }

  // ---- gravité (variable selon montée/chute + relâchement du saut) -------
  let g;
  this.wallSliding = this.wallContactTimer > 0 && !this.grounded && this.velocity.y < 0 &&
    this.abilities.wallJump && input.holdingIntoWall;
  if (this.wallSliding) {
    g = CFG.gravityWallSlide;
  } else if (this.velocity.y > 0) {
    g = input.jumpHeld ? CFG.gravityRise : CFG.gravityRise * 2.6;
  } else {
    g = CFG.gravityFall;
  }
  for (const z of this.level.gravityZones) {
    if (this._insideZone(z)) g *= z.scale;
  }
  this.velocity.y += g * dt;

  // ---- vent ----------------------------------------------------------------
  for (const z of this.level.windZones) {
    if (this._insideZone(z)) {
      this.velocity.x += z.force.x * dt;
      this.velocity.y += z.force.y * dt;
      this.velocity.z += z.force.z * dt;
    }
  }

  // ---- orbes de rebond -------------------------------------------------
  // Purement immatérielles (jamais dans level.collidables) : on les traverse
  // librement de côté (un dash la traverse même sans ça, vu qu'il coupe court
  // avant d'arriver ici). Le rebond ne se déclenche qu'à l'ENTRÉE dans la
  // sphère (dehors -> dedans cette frame), jamais tant qu'on y reste : sans
  // cette détection de transition, la gravité qui grignote velocity.y à
  // chaque frame redéclencherait un rebond en boucle au lieu d'un seul.
  for (const orb of this.level.bounceOrbs || []) {
    const inside = this.velocity.y <= 0 && this.position.distanceTo(orb.pos) < orb.radius + this.radius;
    if (inside && !orb._playerWasInside) {
      this.velocity.y = orb.force;
      this.justBounced = true;
      this.grounded = false;
    }
    orb._playerWasInside = inside;
  }

  // ---- saut / double saut / wall-jump / rebond parfait ----------------------
  if (this.jumpBufferTimer > 0) {
    if (this.grounded || this.coyoteTimer > 0) {
      if (this.groundSurface === 'perfectBounce' && this.perfectWindowTimer > 0) {
        const power = Math.max(CFG.perfectBounceMin, this.lastImpactSpeed * CFG.perfectBounceMult);
        this.velocity.y = power;
        this.justPerfectBounce = true;
      } else {
        this.velocity.y = CFG.jumpVel;
        this.justJumped = true;
      }
      this.grounded = false;
      this.jumpsUsed = 1;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.perfectWindowTimer = 0;
    } else if (this.wallContactTimer > 0 && this.abilities.wallJump) {
      this.velocity.y = CFG.wallJumpVelY;
      this.velocity.x = this.wallNormal.x * CFG.wallJumpPush;
      this.velocity.z = this.wallNormal.z * CFG.wallJumpPush;
      this.wallContactTimer = 0;
      this.jumpBufferTimer = 0;
      this.jumpsUsed = 1;
      this.justWallJumped = true;
    } else if (this.abilities.doubleJump && this.jumpsUsed < 2) {
      this.velocity.y = CFG.doubleJumpVel;
      this.jumpsUsed = 2;
      this.jumpBufferTimer = 0;
      this.justDoubleJumped = true;
    }
  }
};

// ---------------------------------------------------------------------------
// Intégration + collisions (sol/mur/plafond), portage par plateformes mobiles.
// ---------------------------------------------------------------------------
AS.Player.prototype._integrateAndCollide = function (dt) {
  // ---- portage par plateforme mobile (avant tout autre calcul) ------------
  if (this.grounded && this.groundObject && this.groundObject.userData.isMover) {
    const d = this.groundObject.userData.moverRef.delta;
    this.position.x += d.x;
    this.position.z += d.z;
  }

  // ---- déplacement horizontal + murs ---------------------------------------
  // Deux passes : après avoir annulé la composante de vitesse contre le
  // premier mur touché, un second mur (coin, couloir étroit) peut encore
  // être sur la trajectoire restante — sans cette 2e passe le joueur peut
  // se faufiler en diagonale à travers un angle.
  let dx = this.velocity.x * dt, dz = this.velocity.z * dt;
  this.wallNormal.set(0, 0, 0);
  let hitWallThisFrame = false;
  // 3 passes (pas 2) : dans un angle à trois murs (rare mais possible dans un
  // niveau créé à la main), annuler la vitesse contre les deux premiers peut
  // laisser une composante résiduelle vers un troisième — sans cette passe
  // supplémentaire, cette composante n'est jamais vérifiée et peut faire
  // passer le joueur au travers.
  for (let pass = 0; pass < 3; pass++) {
    const moveLen = Math.hypot(dx, dz);
    if (moveLen <= 1e-5) break;
    const dir = new THREE.Vector3(dx, 0, dz).normalize();
    const w = this._wallRay(dir, moveLen);
    if (!w || w.hit.distance > this.radius + moveLen + 0.05) break;
    if ((w.hit.object.userData.surface || '') === 'spike') { this.dead = true; return; }
    const n = w.normal.clone(); n.y = 0; n.normalize();
    const vDotN = this.velocity.x * n.x + this.velocity.z * n.z;
    this.velocity.x -= n.x * vDotN;
    this.velocity.z -= n.z * vDotN;
    dx = this.velocity.x * dt; dz = this.velocity.z * dt;
    if (!this.grounded) {
      this.wallNormal.copy(n);
      this.wallContactTimer = 0.16;
      hitWallThisFrame = true;
    }
  }
  this.position.x += dx;
  this.position.z += dz;

  // ---- déplacement vertical + sol / plafond --------------------------------
  const wasGrounded = this.grounded;
  this.grounded = false;
  this.groundObject = null;

  if (this.velocity.y <= 0) {
    const fallDist = Math.max(0.15, -this.velocity.y * dt + 0.2);
    const g = this._groundRay(fallDist);
    if (g) {
      const surf = g.hit.object.userData.surface || 'normal';
      if (surf === 'spike') {
        this.position.y = g.hit.point.y;
        this.dead = true;
      } else if (surf === 'bounce') {
        this.position.y = g.hit.point.y;
        this.velocity.y = g.hit.object.userData.bounceForce || 18;
        this.grounded = false;
        this.justBounced = true;
        this.groundObject = g.hit.object;
        this.groundSurface = 'bounce';
      } else {
        // Ne capture l'impact / n'ouvre la fenêtre de rebond parfait que sur
        // la frame de contact réelle — sinon rester debout rafraîchirait la
        // fenêtre indéfiniment et écraserait la vitesse d'impact avec le
        // micro-glissement de gravité de chaque frame au repos.
        if (!wasGrounded) {
          this.lastImpactSpeed = Math.abs(this.velocity.y);
          if (surf === 'perfectBounce') this.perfectWindowTimer = AS.CFG.perfectBounceWindow;
        }
        this.position.y = g.hit.point.y;
        this.velocity.y = 0;
        this.grounded = true;
        this.groundObject = g.hit.object;
        this.groundSurface = surf;
        this.jumpsUsed = 0;
        this.dashCharges = AS.CFG.dashCharges;
        // Le seuil de vide suit la dernière plateforme solide atteinte (pas
        // un seuil absolu fixe) : sans ça, tomber depuis les altitudes
        // élevées de la fin de la zone est une longue chute de plusieurs
        // secondes dans le vide avant le respawn — tout sauf "instantané",
        // et on peut voir passer des morceaux de décor pendant la chute.
        this.voidY = this.position.y - AS.CFG.voidMargin;
      }
    } else {
      this.position.y += this.velocity.y * dt;
    }
  } else {
    const c = this._ceilingRay(this.velocity.y * dt);
    if (c) {
      this.position.y = c.point.y - this.height + 0.05;
      this.velocity.y = Math.min(this.velocity.y, 0);
    }
    this.position.y += Math.max(this.velocity.y, 0) * dt;
  }

  if (this.grounded && !wasGrounded) this.justLanded = true;
  if (!hitWallThisFrame && this.grounded) this.wallContactTimer = 0;

  this._checkCrush();
};

// Écrasement par une plateforme mobile : porté par un mover qui avance vers
// un plafond ou un mur solide, l'espace qui reste au joueur devient très
// petit avant que la collision "normale" ait pu le repousser complètement
// (le portage en tête de _integrateAndCollide déplace la position SANS
// vérifier les collisions). Plutôt que d'essayer de bloquer ce déplacement
// (ce qui ferait juste "coller" le mover, cassant son mouvement scripté),
// on détecte le pincement et on tue instantanément — cohérent avec "toute
// surface est solide, on ne s'y encastre jamais impunément".
AS.Player.prototype._checkCrush = function () {
  if (!this.grounded || !this.groundObject || !this.groundObject.userData.isMover) return;
  const delta = this.groundObject.userData.moverRef.delta;
  if (delta.lengthSq() < 1e-8) return;

  if (delta.y > 0.0005) {
    const c = this._ceilingRay(0.05);
    if (c && c.distance < 0.35) { this.dead = true; return; }
  }
  const horiz = new THREE.Vector3(delta.x, 0, delta.z);
  if (horiz.lengthSq() > 0.0005) {
    const w = this._wallRay(horiz.normalize(), 0);
    if (w && w.hit.object !== this.groundObject && w.hit.distance < this.radius + 0.15) this.dead = true;
  }
};

AS.Player.prototype._checkVoid = function () {
  if (this.position.y < this.voidY) this.dead = true;
};

AS.Player.prototype.respawn = function (pos) {
  this.position.copy(pos);
  this.velocity.set(0, 0, 0);
  this.voidY = pos.y - AS.CFG.voidMargin;
  this.grounded = false;
  this.groundObject = null;
  this.jumpsUsed = 0;
  this.dashActive = false;
  this.dashCharges = AS.CFG.dashCharges;
  this.coyoteTimer = 0;
  this.jumpBufferTimer = 0;
  this.wallContactTimer = 0;
  this.wallSliding = false;
  this.perfectWindowTimer = 0;
  this.orbitState = 'idle';
  this.dead = false;
};
