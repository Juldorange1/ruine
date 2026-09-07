// ============================================================================
// ASCENSION — camera.js
// Caméra de jeu à AXE FIXE : elle suit le joueur avec un lissage, évite les
// murs par raycast, mais son orientation (yaw/pitch) ne bouge jamais — pas
// de contrôle souris. Volontaire : un seul axe de vue, toujours le même,
// plus simple à lire et plus fiable (aucune dépendance au pointer lock).
// ============================================================================
window.AS = window.AS || {};

AS.CAMERA_YAW = Math.PI;    // regarde vers -Z (même sens que "avant" par défaut)
AS.CAMERA_PITCH = -0.34;    // légère plongée vers le bas, fixe

AS.FixedCamera = function (camera, collidables) {
  this.camera = camera;
  this.collidables = collidables;
  this.yaw = AS.CAMERA_YAW;
  this.pitch = AS.CAMERA_PITCH;
  this.distance = 7.5;
  this.minDistance = 1.8;
  this.height = 1.7;
  this.currentPos = new THREE.Vector3();
  this.currentTarget = new THREE.Vector3();
  this._ray = new THREE.Raycaster();
  this._initialized = false;
};

AS.FixedCamera.prototype.forwardFlat = function () {
  return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
};
// -PI/2 (pas +PI/2) : la droite de l'écran, vue depuis une caméra qui
// regarde vers "forward", est forward tourné de -90° (sens horaire vu du
// dessus) — l'ancien +PI/2 pointait en fait vers la gauche, inversant les
// touches gauche/droite quel que soit le clavier ou les raccourcis choisis.
AS.FixedCamera.prototype.rightFlat = function () {
  return new THREE.Vector3(Math.sin(this.yaw - Math.PI / 2), 0, Math.cos(this.yaw - Math.PI / 2));
};

AS.FixedCamera.prototype.update = function (dt, playerPos) {
  const target = playerPos.clone();
  target.y += this.height;

  const dir = new THREE.Vector3(
    Math.sin(this.yaw) * Math.cos(this.pitch),
    Math.sin(this.pitch),
    Math.cos(this.yaw) * Math.cos(this.pitch)
  );
  let desiredDist = this.distance;
  const origin = target.clone();
  const backDir = dir.clone().negate();
  this._ray.set(origin, backDir);
  this._ray.far = this.distance + 0.4;
  const hits = this._ray.intersectObjects(this.collidables, false);
  for (const h of hits) {
    if (h.object.userData.disabled) continue;
    desiredDist = Math.min(desiredDist, Math.max(this.minDistance, h.distance - 0.3));
    break;
  }

  const desiredPos = target.clone().add(backDir.clone().multiplyScalar(desiredDist));

  if (!this._initialized) {
    this.currentPos.copy(desiredPos);
    this.currentTarget.copy(target);
    this._initialized = true;
  } else {
    const posLambda = desiredDist < this.distance - 0.1 ? 18 : 9;
    this.currentPos.x = AS.Util.damp(this.currentPos.x, desiredPos.x, posLambda, dt);
    this.currentPos.y = AS.Util.damp(this.currentPos.y, desiredPos.y, posLambda, dt);
    this.currentPos.z = AS.Util.damp(this.currentPos.z, desiredPos.z, posLambda, dt);
    this.currentTarget.x = AS.Util.damp(this.currentTarget.x, target.x, 14, dt);
    this.currentTarget.y = AS.Util.damp(this.currentTarget.y, target.y, 14, dt);
    this.currentTarget.z = AS.Util.damp(this.currentTarget.z, target.z, 14, dt);
  }

  this.camera.position.copy(this.currentPos);
  this.camera.lookAt(this.currentTarget);
};
