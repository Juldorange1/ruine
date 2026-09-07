// ============================================================================
// ASCENSION — particles.js
// Ambiance visuelle : poussière flottante, cascades, eau animée, ciel,
// montagnes d'arrière-plan (silhouettes peintes), brume.
// ============================================================================
window.AS = window.AS || {};

AS.Fx = (function () {

  function buildSky(scene) {
    const tex = AS.Util.skyTexture('#bfe3ff', '#e8c9a0', '#3a2a4a');
    const geo = new THREE.SphereGeometry(400, 24, 16);
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false });
    const sky = new THREE.Mesh(geo, mat);
    scene.add(sky);
    return sky;
  }

  // ---- Arrière-plan photo réel (JPG CC0, Poly Haven — recadrée en une
  // simple image plate) — remplace le ciel/les montagnes peints à la main
  // dès que le fichier est chargé. La caméra a un axe fixe (yaw/pitch
  // constants, voir camera.js) : nul besoin d'un environnement 360°
  // (sphère équirectangulaire) qui donne une impression de "dôme 3D" ;
  // une simple carte plane loin derrière, toujours perpendiculaire à l'axe
  // de vue (comme un panneau de décor face caméra), suffit et se lit sans
  // ambiguïté comme une photo. Le panneau est incliné du même angle que le
  // pitch de la caméra (sinon, avec une caméra qui regarde vers le bas, un
  // panneau vertical "plat" laisserait voir du vide sous son bord bas — vu
  // en biais, il faudrait le rendre bien plus grand pour compenser).
  // `imagePath` : une image différente par difficulté (voir AS.World.BACKGROUNDS)
  // ou choisie dans l'éditeur pour un niveau créé — par défaut celle de la
  // Zone 1 en Facile.
  function loadRealSky(scene, onReady, imagePath) {
    const loader = new THREE.TextureLoader();
    loader.load(
      imagePath || 'assets/hdri/background.jpg',
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        const yaw = AS.CAMERA_YAW, pitch = AS.CAMERA_PITCH;
        const dir = new THREE.Vector3(
          Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)
        );
        const dist = 250;
        // La géométrie respecte le ratio réel de la photo (avec une petite
        // marge de sécurité) au lieu d'un 1400x420 fixe : sans ça, une image
        // 2048x1117 (~1.83:1) étirée sur un panneau ~3.33:1 déformait
        // nettement le paysage (tout paraissait "étiré", flou en largeur).
        const imgAspect = texture.image.width / texture.image.height;
        const panelHeight = 480;
        const panelWidth = panelHeight * imgAspect;
        const geo = new THREE.PlaneGeometry(panelWidth, panelHeight);
        const mat = new THREE.MeshBasicMaterial({ map: texture, depthWrite: false, fog: false, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().negate());
        mesh.userData.updateFollow = (playerPos) => {
          mesh.position.copy(playerPos);
          mesh.position.y += 1.7; // hauteur de visée de la caméra (voir camera.js)
          mesh.position.addScaledVector(dir, dist);
        };
        scene.add(mesh);
        scene.background = new THREE.Color(0x87b8d9); // filet de sécurité derrière les bords du panneau
        if (onReady) onReady(mesh);
      },
      undefined,
      () => { /* échec de chargement : le ciel procédural reste affiché */ }
    );
  }

  // ---- Silhouettes de montagnes peintes sur des cartes verticales ---------
  function mountainRangeTexture(seed, palette) {
    const rng = AS.Util.mulberry32(seed);
    return AS.Util.canvasTexture(512, (ctx, s) => {
      ctx.clearRect(0, 0, s, s);
      const layers = [
        { y: s * 0.62, jag: 0.16, color: palette.far },
        { y: s * 0.74, jag: 0.22, color: palette.mid },
        { y: s * 0.88, jag: 0.30, color: palette.near },
      ];
      layers.forEach((layer, li) => {
        ctx.beginPath();
        ctx.moveTo(0, s);
        const peaks = 7 + Math.floor(rng() * 3);
        const pts = [];
        for (let i = 0; i <= peaks; i++) {
          const x = (i / peaks) * s;
          const h = layer.y - rng() * s * layer.jag - (i % 2 === 0 ? s * 0.04 : 0);
          pts.push([x, h]);
        }
        ctx.moveTo(0, s);
        ctx.lineTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) {
          const midx = (pts[i - 1][0] + pts[i][0]) / 2;
          const midy = (pts[i - 1][1] + pts[i][1]) / 2;
          ctx.quadraticCurveTo(pts[i - 1][0], pts[i - 1][1], midx, midy);
        }
        ctx.lineTo(s, pts[pts.length - 1][1]);
        ctx.lineTo(s, s);
        ctx.closePath();
        ctx.fillStyle = layer.color;
        ctx.fill();
        // calottes neigeuses sur la crête la plus proche
        if (li === 2) {
          ctx.fillStyle = palette.snow;
          for (let i = 1; i < pts.length - 1; i++) {
            if (rng() > 0.4) continue;
            ctx.beginPath();
            ctx.moveTo(pts[i][0] - s * 0.02, pts[i][1] + s * 0.02);
            ctx.lineTo(pts[i][0], pts[i][1]);
            ctx.lineTo(pts[i][0] + s * 0.025, pts[i][1] + s * 0.025);
            ctx.closePath();
            ctx.fill();
          }
        }
      });
    });
  }

  function buildMountainRing(scene, centerX, centerZ, radius, seed, palette) {
    palette = palette || { far: '#5a6b8a', mid: '#465578', near: '#333f66', snow: '#eef3fb' };
    const tex = mountainRangeTexture(seed, palette);
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    });
    const count = 10;
    const group = new THREE.Group();
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const w = radius * 0.75, h = radius * 0.42;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      mesh.position.set(centerX + Math.cos(a) * radius, h * 0.42, centerZ + Math.sin(a) * radius);
      mesh.rotation.y = -a + Math.PI / 2;
      group.add(mesh);
    }
    scene.add(group);
    return group;
  }

  function buildDust(scene, count) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 120;
      positions[i * 3 + 1] = Math.random() * 140 - 4;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const tex = AS.Util.dotSpriteTexture('rgba(255,255,255,0.9)');
    const mat = new THREE.PointsMaterial({
      size: 0.22, map: tex, transparent: true, opacity: 0.5,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    return {
      points: pts,
      update: (dt, playerPos) => {
        const arr = geo.attributes.position.array;
        for (let i = 0; i < count; i++) {
          arr[i * 3 + 1] += dt * 0.35;
          arr[i * 3] += Math.sin(performance.now() * 0.0003 + i) * dt * 0.05;
          if (arr[i * 3 + 1] > playerPos.y + 70) arr[i * 3 + 1] = playerPos.y - 20;
        }
        geo.attributes.position.needsUpdate = true;
        pts.position.x = 0; pts.position.z = 0;
      },
    };
  }

  function buildWaterfall(scene, x, yTop, z, width, height) {
    const geo = new THREE.PlaneGeometry(width, height, 1, 12);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xbfe8ff, transparent: true, opacity: 0.5,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, yTop - height / 2, z);
    scene.add(mesh);
    let t = 0;
    return {
      mesh,
      update: (dt) => {
        t += dt;
        mesh.material.opacity = 0.42 + Math.sin(t * 6) * 0.06;
      },
    };
  }

  function landingBurst(scene, pos) {
    const count = 14;
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x; positions[i * 3 + 1] = pos.y + 0.1; positions[i * 3 + 2] = pos.z;
      const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * 2;
      velocities.push(new THREE.Vector3(Math.cos(a) * r, 2 + Math.random() * 2, Math.sin(a) * r));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.16, color: 0xffffff, transparent: true, opacity: 0.8,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    let life = 0;
    return {
      points: pts,
      done: false,
      update: (dt) => {
        life += dt;
        const arr = geo.attributes.position.array;
        for (let i = 0; i < count; i++) {
          velocities[i].y -= 9 * dt;
          arr[i * 3] += velocities[i].x * dt;
          arr[i * 3 + 1] += velocities[i].y * dt;
          arr[i * 3 + 2] += velocities[i].z * dt;
        }
        geo.attributes.position.needsUpdate = true;
        mat.opacity = Math.max(0, 0.8 - life * 1.4);
        if (life > 0.6) { scene.remove(pts); geo.dispose(); mat.dispose(); return true; }
        return false;
      },
    };
  }

  // ---- Traînée de dash : quelques traits lumineux qui partent de derrière
  // le joueur et s'effacent vite — rend le dash visible dans l'espace du
  // monde, en plus de l'étirement du personnage lui-même (voir main.js).
  function dashTrail(scene, pos, dir, color) {
    const count = 5;
    const group = new THREE.Group();
    const geo = new THREE.PlaneGeometry(0.16, 1.0);
    const meshes = [];
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: color || 0xbfe8ff, transparent: true, opacity: 0.5,
        depthWrite: false, side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(geo, mat);
      const back = 0.35 + i * 0.4;
      m.position.copy(pos).addScaledVector(dir, -back);
      m.position.y += 0.9;
      m.lookAt(m.position.clone().add(dir));
      meshes.push(m);
      group.add(m);
    }
    scene.add(group);
    let life = 0;
    return {
      group,
      update: (dt) => {
        life += dt;
        const fade = Math.max(0, 1 - life / 0.22);
        meshes.forEach((m) => { m.material.opacity = 0.5 * fade; });
        if (life > 0.22) {
          scene.remove(group);
          meshes.forEach((m) => m.material.dispose());
          geo.dispose();
          return true;
        }
        return false;
      },
    };
  }

  // ---- Anneau du double saut : un cercle de petites étincelles cyan qui
  // s'écarte du joueur à l'horizontale — bien distinct du nuage d'atterrissage
  // (blanc, retombe) et de la traînée de dash (des traits, derrière le
  // joueur) : le double saut doit se reconnaître d'un coup d'oeil.
  function doubleJumpBurst(scene, pos) {
    const count = 10;
    const positions = new Float32Array(count * 3);
    const dirs = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      positions[i * 3] = pos.x; positions[i * 3 + 1] = pos.y + 0.9; positions[i * 3 + 2] = pos.z;
      dirs.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const tex = AS.Util.dotSpriteTexture('rgba(140,225,255,0.95)');
    const mat = new THREE.PointsMaterial({
      size: 0.24, map: tex, transparent: true, opacity: 0.9,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    let life = 0;
    const speed = 5;
    return {
      points: pts,
      update: (dt) => {
        life += dt;
        const arr = geo.attributes.position.array;
        for (let i = 0; i < count; i++) {
          arr[i * 3] += dirs[i].x * speed * dt;
          arr[i * 3 + 2] += dirs[i].z * speed * dt;
        }
        geo.attributes.position.needsUpdate = true;
        mat.opacity = Math.max(0, 0.9 - life * 2.5);
        if (life > 0.35) { scene.remove(pts); geo.dispose(); mat.dispose(); return true; }
        return false;
      },
    };
  }

  return {
    buildSky, loadRealSky, buildDust, buildWaterfall, landingBurst,
    buildMountainRing, dashTrail, doubleJumpBurst,
  };
})();
