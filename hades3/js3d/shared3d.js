// ============================================================================
// Utilitaires 3D partagés entre js3d/hub3d.js et js3d/combat3d.js (chargé en
// script classique, entre js3d/vendor/three.min.js et les deux fichiers qui
// l'utilisent — voir index.html). Purement des helpers de rendu (textures
// procédurales, réglages de renderer) : aucune logique de jeu ici.
(function () {
  var THREE = window.THREE;

  // Texture de sol procédurale (canvas) : une teinte de base + des taches douces
  // de 2-3 nuances pour un rendu "pierre/terre" organique, sans dépendre d'une
  // image externe (contrainte : zéro requête réseau, voir js3d/hub3d.js).
  function makeGroundTexture(baseHex, spotHexes, repeat) {
    var size = 256;
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, size, size);
    spotHexes.forEach(function (color, idx) {
      var count = 26;
      for (var i = 0; i < count; i++) {
        var x = Math.random() * size, y = Math.random() * size;
        var r = 14 + Math.random() * 34;
        var grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'transparent');
        ctx.globalAlpha = 0.16 + Math.random() * 0.14;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
    var tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat || 6, repeat || 6);
    tex.anisotropy = 4;
    if (tex.colorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // Géométrie de rocher irrégulière : un dodécaèdre subdivisé dont chaque sommet
  // est légèrement décalé au hasard — chaque appel produit une forme unique,
  // bien plus organique qu'un solide parfait répété partout.
  function makeRockGeometry(jitter) {
    var geo = new THREE.DodecahedronGeometry(1, 1);
    var pos = geo.attributes.position;
    var j = jitter != null ? jitter : 0.18;
    for (var i = 0; i < pos.count; i++) {
      pos.setX(i, pos.getX(i) * (1 + (Math.random() - 0.5) * j));
      pos.setY(i, pos.getY(i) * (1 + (Math.random() - 0.5) * j));
      pos.setZ(i, pos.getZ(i) * (1 + (Math.random() - 0.5) * j));
    }
    geo.computeVertexNormals();
    return geo;
  }

  // Texture de "peau" procédurale pour un ennemi (canvas), teintée par sa couleur de
  // tier — casse la surface plate d'un solide unicolore sans ajouter de géométrie.
  // Mise en cache par (baseHex, style) : beaucoup d'ennemis d'un même palier/famille
  // partagent la même couleur, inutile de regénérer un canvas identique à chacun.
  var skinCache = {};
  function makeEnemySkinTexture(baseHex, style) {
    var key = baseHex + '|' + style;
    if (skinCache[key]) return skinCache[key];
    var size = 128;
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, size, size);

    if (style === 'metal') {
      // Panneaux/rayures métalliques : lignes fines horizontales + quelques éraflures.
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 1;
      for (var y = 8; y < size; y += 14) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      for (var i = 0; i < 10; i++) {
        var sx = Math.random() * size, sy = Math.random() * size, len = 8 + Math.random() * 22;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + len, sy + (Math.random() - 0.5) * 6); ctx.stroke();
      }
    } else if (style === 'crystal') {
      // Facettes : triangles clairs/sombres alternés, look taillé/cristallin.
      for (var i2 = 0; i2 < 22; i2++) {
        var cx = Math.random() * size, cy = Math.random() * size, r2 = 10 + Math.random() * 20;
        ctx.globalAlpha = 0.12 + Math.random() * 0.16;
        ctx.fillStyle = Math.random() < 0.5 ? '#ffffff' : '#000000';
        ctx.beginPath();
        ctx.moveTo(cx, cy - r2);
        ctx.lineTo(cx + r2 * 0.87, cy + r2 * 0.5);
        ctx.lineTo(cx - r2 * 0.87, cy + r2 * 0.5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      // 'organic' par défaut : taches douces façon peau/écorce.
      for (var i3 = 0; i3 < 18; i3++) {
        var ox = Math.random() * size, oy = Math.random() * size, orr = 8 + Math.random() * 18;
        var grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, orr);
        grad.addColorStop(0, 'rgba(0,0,0,0.22)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(ox, oy, orr, 0, Math.PI * 2); ctx.fill();
      }
    }

    var tex = new THREE.CanvasTexture(canvas);
    if (tex.colorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
    skinCache[key] = tex;
    return tex;
  }

  // Réglages communs de rendu "réaliste" : tone mapping filmique (au lieu du
  // linéaire brut par défaut, qui écrase les hautes lumières) + ombres douces.
  function setupRenderer(renderer) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  // Reconstruit un maillage animé à partir d'une géométrie+squelette+animation exportés
  // hors-jeu (voir js3d/assets_monsters.js, pipeline scratchpad/monsterpack) : positions/
  // normales/UV/indices/poids de peau bruts + hiérarchie d'os + une piste de marche, plus
  // une texture partagée en data: URI. Pas de GLTFLoader ici (dépendance module non
  // fiable une fois publié, voir js3d/hub3d.js) — juste THREE.BufferGeometry/Bone/
  // Skeleton/SkinnedMesh/AnimationMixer, déjà présents dans le build classique de
  // Three.js (aucun loader requis pour ces classes).
  //
  // Taille/position : la géométrie et les os restent en unités brutes du fichier source
  // (le skinning se calcule en espace local du mesh) — la mise à l'échelle vers la
  // convention du jeu (créature ~2.1 unités de haut, pieds à y=-0.7) s'applique ensuite
  // comme une transform Object3D normale sur le SkinnedMesh, exactement comme pour un
  // maillage statique. Le -30% de taille demandé se règle côté logique de jeu (e.r dans
  // enemies.js), pas ici, pour que la hitbox rétrécisse avec le visuel (voir radiusBase).
  var TARGET_MIN_Y = -0.7;
  var TARGET_HEIGHT = 2.1; // même convention que convert_gltf_skinned.py (scale = TARGET_HEIGHT / raw_height)
  var textureCache = {};
  function textureForAsset(assetKey, asset) {
    var tex = textureCache[assetKey];
    if (!tex && asset.atlas) {
      var img = new Image();
      tex = new THREE.Texture(img);
      img.onload = function () { tex.needsUpdate = true; };
      img.src = asset.atlas;
      if (tex.colorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
      textureCache[assetKey] = tex;
    }
    return tex || null;
  }

  // Accents colorés attachés aux os des extrémités (griffes/doigts, tête) : les modèles
  // du pack utilisent une seule texture "atlas" en petites pastilles de couleur partagée
  // par toute la géométrie (pas de peinture UV par région) — d'où le rendu jugé trop
  // uniforme une fois la teinte globale précédente retirée. Plutôt que de re-teinter tout
  // le corps (ce qui écrasait à nouveau le détail réel de la texture), on pose de petits
  // accents géométriques bien distincts de la peau à des points anatomiques précis —
  // exactement l'exemple donné : "des griffes ne doivent pas être de la même couleur que
  // ce qui est juste à côté". Générique et sûr sur les 3 types de squelette du pack (43
  // os humanoïdes, 38 os volants sans jambes, 4 os "blob" sans doigts) : la recherche par
  // nom d'os ne pose rien si le bout de nom ne correspond à aucun os présent.
  var CLAW_BONE_PREFIXES = ['Index3', 'Middle3', 'Pinky3', 'Thumb2', 'Thumb3'];
  var CLAW_COLOR = 0x15101c; // onyx sombre : contraste sur n'importe quelle teinte de peau
  function attachColorAccents(bones, rawHeight, accentColorHex) {
    var clawMat = new THREE.MeshStandardMaterial({ color: CLAW_COLOR, roughness: 0.35, metalness: 0.25 });
    var accentMat = new THREE.MeshStandardMaterial({ color: accentColorHex, emissive: accentColorHex, emissiveIntensity: 0.55, roughness: 0.4 });
    var clawSize = rawHeight * 0.045;
    var hornSize = rawHeight * 0.16;
    bones.forEach(function (b) {
      var isClawTip = CLAW_BONE_PREFIXES.some(function (pre) { return b.name.indexOf(pre) === 0; });
      if (isClawTip) {
        var claw = new THREE.Mesh(new THREE.ConeGeometry(clawSize * 0.3, clawSize, 6), clawMat);
        claw.rotation.x = Math.PI / 2;
        claw.position.y = clawSize * 0.55;
        b.add(claw);
      } else if (b.name === 'Head') {
        // "Corne"/crête de tête : couleur de palier de l'ennemi, distincte de la peau —
        // sert aussi de repère d'identification rapide (même rôle que l'ancienne teinte
        // globale, mais localisé au lieu d'écraser tout le corps).
        var horn = new THREE.Mesh(new THREE.ConeGeometry(hornSize * 0.32, hornSize, 7), accentMat);
        horn.position.y = hornSize * 0.55;
        b.add(horn);
      }
    });
  }

  function skinnedMeshFromAsset(assetKey, accentColorHex) {
    var asset = window.MonsterAssets && window.MonsterAssets[assetKey];
    if (!asset || !asset.skin) return null;

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(asset.geo.positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(asset.geo.normals, 3));
    if (asset.geo.uvs && asset.geo.uvs.length) geo.setAttribute('uv', new THREE.Float32BufferAttribute(asset.geo.uvs, 2));
    geo.setIndex(asset.geo.indices);
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(asset.geo.skinIndex, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(asset.geo.skinWeight, 4));

    // Toujours totalement opaque et rendu des deux faces : une géométrie extraite à la
    // main peut avoir un ordre de sommets (winding) incertain selon l'export d'origine —
    // THREE.DoubleSide élimine tout risque de faces "invisibles" qui laisseraient voir
    // au travers du modèle (rendu à tort perçu comme transparent).
    // roughness abaissée (0.7 -> 0.5) : accroche davantage de reflets directs du soleil,
    // ce qui fait mieux ressortir le relief réel du modèle (plis, arêtes) au lieu d'un
    // rendu mat et plat qui aplatissait le détail visuel.
    var mat = new THREE.MeshStandardMaterial({
      map: textureForAsset(assetKey, asset), roughness: 0.5, metalness: 0.05,
      transparent: false, opacity: 1, side: THREE.DoubleSide, depthWrite: true
    });

    var nodes = asset.nodes;
    var bones = nodes.map(function (n) {
      var b = new THREE.Bone();
      b.name = n.name;
      b.position.fromArray(n.t);
      b.quaternion.fromArray(n.r);
      b.scale.fromArray(n.s);
      return b;
    });
    var hasParent = new Array(nodes.length);
    nodes.forEach(function (n, i) {
      n.children.forEach(function (ci) { bones[i].add(bones[ci]); hasParent[ci] = true; });
    });
    var rootIndex = asset.skin.skeletonRoot;
    if (rootIndex == null || hasParent[rootIndex]) {
      rootIndex = nodes.findIndex(function (_, i) { return !hasParent[i]; });
    }
    var rootBone = bones[rootIndex];

    var skinBones = asset.skin.joints.map(function (ni) { return bones[ni]; });
    var boneInverses = [];
    for (var i = 0; i < asset.skin.joints.length; i++) {
      boneInverses.push(new THREE.Matrix4().fromArray(asset.skin.inverseBindMatrices.slice(i * 16, i * 16 + 16)));
    }
    var skeleton = new THREE.Skeleton(skinBones, boneInverses);

    if (accentColorHex) attachColorAccents(bones, TARGET_HEIGHT / asset.norm.scale, accentColorHex);

    var mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.add(rootBone);
    mesh.bind(skeleton);

    var scale = asset.norm.scale;
    mesh.scale.setScalar(scale);
    mesh.position.y = TARGET_MIN_Y - asset.norm.rawMinY * scale;

    if (asset.anim && asset.anim.tracks.length) {
      var clipTracks = [];
      asset.anim.tracks.forEach(function (tr) {
        var boneName = nodes[tr.node].name;
        if (tr.path === 'translation') clipTracks.push(new THREE.VectorKeyframeTrack(boneName + '.position', tr.times, tr.values));
        else if (tr.path === 'rotation') clipTracks.push(new THREE.QuaternionKeyframeTrack(boneName + '.quaternion', tr.times, tr.values));
        else if (tr.path === 'scale') clipTracks.push(new THREE.VectorKeyframeTrack(boneName + '.scale', tr.times, tr.values));
      });
      var clip = new THREE.AnimationClip(asset.anim.name || 'anim', asset.anim.duration, clipTracks);
      var mixer = new THREE.AnimationMixer(mesh);
      var action = mixer.clipAction(clip);
      action.play();
      mesh.userData.mixer = mixer;
    }

    return mesh;
  }

  // Sprite emoji (canvas) : icône flottante au-dessus d'un présentoir/repère (voir les
  // présentoirs d'armes de l'armurerie, js3d/combat3d.js), sans fichier image externe —
  // même contrainte zéro-requête-réseau que le reste de ce module. Mis en cache par
  // emoji : plusieurs présentoirs peuvent partager la même icône sans regénérer le canvas.
  var emojiSpriteCache = {};
  function makeEmojiSprite(emoji, worldSize) {
    var tex = emojiSpriteCache[emoji];
    if (!tex) {
      var size = 128;
      var canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      var ctx = canvas.getContext('2d');
      ctx.font = Math.round(size * 0.72) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, size / 2, size * 0.56);
      tex = new THREE.CanvasTexture(canvas);
      if (tex.colorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
      emojiSpriteCache[emoji] = tex;
    }
    var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    var sprite = new THREE.Sprite(mat);
    var s = worldSize || 1;
    sprite.scale.set(s, s, 1);
    return sprite;
  }

  window.Shared3D = {
    makeGroundTexture: makeGroundTexture, makeRockGeometry: makeRockGeometry,
    makeEnemySkinTexture: makeEnemySkinTexture, setupRenderer: setupRenderer,
    skinnedMeshFromAsset: skinnedMeshFromAsset, makeEmojiSprite: makeEmojiSprite
  };
})();
