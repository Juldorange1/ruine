// ============================================================================
// Rendu canvas (arène, entités, particules, écran de fond) + mise à jour du HUD DOM.
// ============================================================================
//
// Plan de ce fichier :
//   - Conversion souris écran <-> monde (canvasToWorld/combatMouseToWorld)
//   - Fond d'arène : texture de sol (herbe/cailloux, une fois par thème de
//     chapitre), poussière ambiante, thème par chapitre (drawArenaBackground)
//   - Helpers de couleur/forme génériques (shadeColor, shapeGradient,
//     drawGroundShadow, drawShapeCanvas — la silhouette générique par forme,
//     dont drawCreatureBody dans enemyRender.js réutilise la même logique)
//   - Terrain/effets : zones, blocs, traînées, cordes de grappin, mines,
//     brasier, coups d'épée, laser du joueur, projectiles, blasts, lasers,
//     particules — une fonction drawXxx par type d'élément
//   - Entités : drawEnemy (délègue la silhouette à drawEnemyCreature, voir
//     enemyRender.js) et drawPlayer
//   - renderCombat(ctx, w, h, t) : orchestre tout ce qui précède, une fois par
//     frame — c'est le seul point d'entrée appelé depuis game.js
//   - updateHUD() : partie DOM (hors canvas) du HUD, chronomètre, jauges

var _torchFlicker = 0;

function canvasToWorld(canvas, clientX, clientY) {
  var rect = canvas.getBoundingClientRect();
  var scaleX = canvas.width / rect.width;
  var scaleY = canvas.height / rect.height;
  return [(clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY];
}

function combatMouseToWorld(canvas, clientX, clientY) {
  var px = canvasToWorld(canvas, clientX, clientY);
  var scale = (CB && CB.viewScale) || 1;
  var scaleY = (CB && CB.viewScaleY) || scale;
  var offX = (CB && CB.viewOffX) || 0;
  var offY = (CB && CB.viewOffY) || 0;
  return [(px[0] - offX) / scale, (px[1] - offY) / scaleY];
}

// Compression verticale du sol : simule une caméra légèrement inclinée façon Hades 1
// plutôt qu'une vue du dessus parfaitement plate. Purement un effet de rendu — les
// coordonnées de jeu (déplacement, collisions, visée) restent en repère plat classique,
// combatMouseToWorld inverse cette même compression pour que le viseur reste précis.
var ARENA_TILT_Y = 0.72;


var _floorTextureCache = null;

// Une touffe d'herbe (quelques brins courbes) — décor au sol discret, sans forme
// géométrique marquée, qui ne gêne jamais la lecture des ennemis/terrain par-dessus.
function drawGrassTuft(fx, x, y, scale, color) {
  fx.save();
  fx.translate(x, y);
  fx.scale(scale, scale);
  fx.strokeStyle = color;
  fx.lineWidth = 1.3;
  fx.lineCap = 'round';
  var bladeCount = 3 + Math.floor(Math.random() * 3);
  for (var i = 0; i < bladeCount; i++) {
    var lean = (Math.random() - 0.5) * 7;
    var height = 5 + Math.random() * 5;
    var baseX = (i - bladeCount / 2) * 1.7;
    fx.beginPath();
    fx.moveTo(baseX, 0);
    fx.quadraticCurveTo(baseX + lean * 0.6, -height * 0.6, baseX + lean, -height);
    fx.stroke();
  }
  fx.restore();
}

function drawPebble(fx, x, y, r) {
  fx.save();
  fx.fillStyle = '#00000050';
  fx.beginPath();
  fx.ellipse(x, y + r * 0.3, r, r * 0.6, 0, 0, Math.PI * 2);
  fx.fill();
  fx.fillStyle = '#ffffff1c';
  fx.beginPath();
  fx.ellipse(x - r * 0.2, y - r * 0.15, r * 0.5, r * 0.32, 0, 0, Math.PI * 2);
  fx.fill();
  fx.restore();
}

// Fond généré une seule fois par thème de chapitre sur un canvas hors-écran puis recopié
// chaque frame : variations douces + décor d'herbe/cailloux discret, jamais de grille ni
// de dallage qui gênerait la lecture des ennemis et du terrain.
function buildFloorTexture(w, h, theme) {
  var off = document.createElement('canvas');
  off.width = w; off.height = h;
  var fx = off.getContext('2d');

  var grd = fx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, Math.max(w, h) * 0.75);
  grd.addColorStop(0, '#2c2234');
  grd.addColorStop(0.55, '#180f1e');
  grd.addColorStop(1, '#0a0710');
  fx.fillStyle = grd;
  fx.fillRect(0, 0, w, h);

  fx.save();
  fx.globalCompositeOperation = 'lighter';
  for (var i = 0; i < 16; i++) {
    var bx = Math.random() * w, by = Math.random() * h;
    var br = 100 + Math.random() * 170;
    var tint = Math.random() > 0.5 ? '255,150,90' : '150,120,220';
    var blotch = fx.createRadialGradient(bx, by, 0, bx, by, br);
    blotch.addColorStop(0, 'rgba(' + tint + ',0.035)');
    blotch.addColorStop(1, 'rgba(' + tint + ',0)');
    fx.fillStyle = blotch;
    fx.beginPath();
    fx.arc(bx, by, br, 0, Math.PI * 2);
    fx.fill();
  }
  fx.restore();

  fx.save();
  fx.globalAlpha = 0.045;
  for (var g = 0; g < 500; g++) {
    fx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#000000';
    fx.fillRect(Math.random() * w, Math.random() * h, 1.2, 1.2);
  }
  fx.restore();

  var grassColor = (theme && theme.grass) || '#5a6b3c';
  fx.save();
  fx.globalAlpha = 0.24;
  for (var gt = 0; gt < 60; gt++) {
    drawGrassTuft(fx, Math.random() * w, Math.random() * h, 0.85 + Math.random() * 0.7, grassColor);
  }
  fx.restore();

  fx.save();
  fx.globalAlpha = 0.3;
  for (var pb = 0; pb < 26; pb++) {
    drawPebble(fx, Math.random() * w, Math.random() * h, 2 + Math.random() * 3);
  }
  fx.restore();

  return off;
}

function getFloorTexture(w, h, theme) {
  var themeName = theme ? theme.name : '';
  if (!_floorTextureCache || _floorTextureCache.w !== w || _floorTextureCache.h !== h || _floorTextureCache.theme !== themeName) {
    _floorTextureCache = { w: w, h: h, theme: themeName, canvas: buildFloorTexture(w, h, theme) };
  }
  return _floorTextureCache.canvas;
}

// Poussière/braises flottantes, purement fonction du temps écoulé (pas d'état à mettre
// à jour) : dérive lente en boucle, pour une arène qui respire même hors combat.
function drawAmbientMotes(ctx, w, h, t) {
  ctx.save();
  for (var i = 0; i < 46; i++) {
    var seed = i * 97.13;
    var speed = 0.15 + (i % 5) * 0.05;
    var amp = 26 + (i % 7) * 11;
    var baseX = (seed * 53) % w;
    var baseY = (seed * 29) % h;
    var x = baseX + Math.sin(t * speed + seed) * amp;
    var y = (baseY + t * (5 + (i % 4) * 3)) % (h + 40) - 20;
    var alpha = 0.1 + 0.09 * Math.sin(t * 0.7 + seed);
    if (alpha <= 0) continue;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = i % 6 === 0 ? '#ff9d6e' : '#f2d38f';
    ctx.beginPath();
    ctx.arc(x, y, 1.3 + (i % 3) * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Un thème par chapitre (couleur de torche/lueur ambiante/bordure) : le décor change
// nettement d'atmosphère à chaque transition, en plus du terrain qui se régénère.
var CHAPTER_THEMES = [
  { name: 'Sables', torch: '255,150,70', wash: '255,120,60', border: '#e3b968', grass: '#8a7a3c' },
  { name: 'Marécage', torch: '110,220,150', wash: '70,200,120', border: '#8fe3a0', grass: '#3e6b3a' },
  { name: 'Braise', torch: '255,80,70', wash: '255,50,50', border: '#ff5a3c', grass: '#5c3222' },
  { name: 'Abîme', torch: '160,120,255', wash: '140,90,255', border: '#b34bf2', grass: '#4a3f5c' }
];

function currentChapterTheme() {
  if (typeof CB === 'undefined' || !CB) return CHAPTER_THEMES[0];
  var idx = Math.floor(Math.min(CB.waveIndex, CB.totalWaves - 1) / ROOMS_PER_CHAPTER);
  return CHAPTER_THEMES[idx % CHAPTER_THEMES.length];
}

function drawArenaBackground(ctx, w, h, t) {
  var theme = currentChapterTheme();
  ctx.drawImage(getFloorTexture(w, h, theme), 0, 0);

  ctx.save();
  var wash = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.75);
  wash.addColorStop(0, 'rgba(' + theme.wash + ',0)');
  wash.addColorStop(1, 'rgba(' + theme.wash + ',0.10)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  drawAmbientMotes(ctx, w, h, t || 0);

  _torchFlicker = 0.75 + Math.sin((t || 0) * 6) * 0.08 + Math.sin((t || 0) * 13.7) * 0.04;
  var corners = [[26, 26], [w - 26, 26], [26, h - 26], [w - 26, h - 26]];
  corners.forEach(function (c) {
    var tg = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], 150);
    tg.addColorStop(0, 'rgba(' + theme.torch + ',' + (0.22 * _torchFlicker) + ')');
    tg.addColorStop(1, 'rgba(' + theme.torch + ',0)');
    ctx.fillStyle = tg;
    ctx.fillRect(0, 0, w, h);
  });

  ctx.save();
  ctx.strokeStyle = theme.border + '33';
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, w - 12, h - 12);
  ctx.restore();
}

function shadeColor(hex, percent) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
  var num = parseInt(hex, 16);
  var r = clamp((num >> 16) + Math.round(255 * percent), 0, 255);
  var g = clamp(((num >> 8) & 0xFF) + Math.round(255 * percent), 0, 255);
  var b = clamp((num & 0xFF) + Math.round(255 * percent), 0, 255);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

function shapeGradient(ctx, cx, cy, r, color) {
  var grd = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.25);
  grd.addColorStop(0, shadeColor(color, 0.32));
  grd.addColorStop(0.55, color);
  grd.addColorStop(1, shadeColor(color, -0.3));
  return grd;
}

function drawGroundShadow(ctx, x, y, r) {
  ctx.save();
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.72, r * 0.85, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawShapeCanvas(ctx, shape, x, y, r, color, opts) {
  opts = opts || {};
  ctx.save();
  ctx.globalAlpha = opts.alpha != null ? opts.alpha : 1;
  ctx.shadowColor = color;
  ctx.shadowBlur = opts.glow ? (10 + (opts.tier || 1) * 3) : 0;
  ctx.beginPath();
  var gradCx = x, gradCy = y;
  if (shape === 'square') {
    ctx.translate(x, y);
    if (opts.rotation) ctx.rotate(opts.rotation);
    ctx.rect(-r * 0.82, -r * 0.82, r * 1.64, r * 1.64);
    gradCx = 0; gradCy = 0;
  } else if (shape === 'triangle') {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.92, y + r * 0.78);
    ctx.lineTo(x - r * 0.92, y + r * 0.78);
    ctx.closePath();
  } else if (shape === 'boss') {
    var spikes = 10;
    for (var si = 0; si < spikes; si++) {
      var a0 = (Math.PI * 2 / spikes) * si;
      var a1 = a0 + (Math.PI * 2 / spikes) / 2;
      var a2 = a0 + (Math.PI * 2 / spikes);
      var mx = x + Math.cos(a1) * r * 1.28, my = y + Math.sin(a1) * r * 1.28;
      if (si === 0) ctx.moveTo(x + Math.cos(a0) * r * 0.82, y + Math.sin(a0) * r * 0.82);
      else ctx.lineTo(x + Math.cos(a0) * r * 0.82, y + Math.sin(a0) * r * 0.82);
      ctx.lineTo(mx, my);
      ctx.lineTo(x + Math.cos(a2) * r * 0.82, y + Math.sin(a2) * r * 0.82);
    }
    ctx.closePath();
  } else {
    ctx.arc(x, y, r * 0.85, 0, Math.PI * 2);
  }
  ctx.fillStyle = shapeGradient(ctx, gradCx, gradCy, r, color);
  ctx.fill();
  if (opts.ring) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = opts.ring;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(gradCx, gradCy, r + 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  if (opts.number != null) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1a1420';
    ctx.font = '700 ' + Math.round(r * 0.85) + 'px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = opts.alpha != null ? opts.alpha : 1;
    ctx.fillText(opts.number, x, y + r * 0.06);
    ctx.restore();
  }
}

var ZONE_STYLES = {
  slow: { rgb: '120,180,255', ring: '#7db4ff', icon: '#dbeaff' },
  speed: { rgb: '255,224,120', ring: '#f2d060', icon: '#fff6d9' },
  heal: { rgb: '140,230,160', ring: '#8fe3a0', icon: '#e8ffec' },
  flame: { rgb: '255,110,70', ring: '#ff6e46', icon: '#ffe3d2' },
  grapple: { rgb: '155,92,240', ring: '#9b5cf0', icon: '#ecdcff' }
};

// Pièges : éléments mécaniques/environnementaux, pas des auras magiques — rendu séparé
// du système ZONE_STYLES, synchronisé sur CB.elapsed (même horloge que la logique de dégâts
// dans combat.js) pour que l'animation reflète fidèlement le danger réel.
function drawSpikeTrap(ctx, z, alphaOverride) {
  var elapsed = (typeof CB !== 'undefined' && CB) ? (CB.elapsed || 0) : 0;
  var cyclePos = (elapsed + (z.phaseOffset || 0)) % SPIKE_TRAP_CYCLE;
  var activeStart = SPIKE_TRAP_CYCLE - SPIKE_TRAP_ACTIVE_DUR;
  var riseTime = SPIKE_TRAP_ACTIVE_DUR * 0.3;
  var raised = clamp((cyclePos - activeStart) / riseTime, 0, 1);
  var danger = cyclePos > activeStart;
  var baseAlpha = alphaOverride != null ? alphaOverride : 1;
  ctx.save();
  ctx.globalAlpha = baseAlpha;
  ctx.fillStyle = '#3a352f';
  ctx.strokeStyle = '#1e1b17';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(z.x, z.y, z.r * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  var spikeCount = 7;
  for (var i = 0; i < spikeCount; i++) {
    var a = (Math.PI * 2 / spikeCount) * i;
    var bx = z.x + Math.cos(a) * z.r * 0.38, by = z.y + Math.sin(a) * z.r * 0.38;
    var h = 4 + raised * 15;
    var w = 5;
    var perpX = -Math.sin(a), perpY = Math.cos(a);
    ctx.fillStyle = danger ? '#d9dbe0' : '#6a6a6a';
    ctx.beginPath();
    ctx.moveTo(bx + perpX * w, by + perpY * w);
    ctx.lineTo(bx - perpX * w, by - perpY * w);
    ctx.lineTo(bx + Math.cos(a) * h, by + Math.sin(a) * h);
    ctx.closePath();
    ctx.fill();
  }
  if (danger) {
    ctx.globalAlpha = baseAlpha * 0.4 * raised;
    ctx.fillStyle = '#ff4433';
    ctx.beginPath();
    ctx.arc(z.x, z.y, z.r * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawArrowTrap(ctx, z, alphaOverride) {
  var baseAlpha = alphaOverride != null ? alphaOverride : 1;
  ctx.save();
  ctx.globalAlpha = baseAlpha;
  ctx.fillStyle = '#5a4630';
  ctx.strokeStyle = '#2c2114';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(z.x - 9, z.y - 9, 18, 18);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#17130d';
  ctx.beginPath();
  ctx.arc(z.x, z.y, 4, 0, Math.PI * 2);
  ctx.fill();
  if (z.telegraphOn) {
    var frac = 1 - clamp(z.telegraphTimer / TRAP_ARROW_TELEGRAPH, 0, 1);
    var p = (typeof CB !== 'undefined' && CB) ? CB.player : null;
    if (p) {
      var n = norm(p.x - z.x, p.y - z.y);
      var ex = z.x + n[0] * 900, ey = z.y + n[1] * 900;
      ctx.strokeStyle = '#c9503f';
      ctx.globalAlpha = baseAlpha * (0.3 + 0.4 * frac);
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(z.x, z.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = baseAlpha * (0.4 + 0.5 * frac);
    ctx.fillStyle = '#ff5a3d';
    ctx.beginPath();
    ctx.arc(z.x, z.y, 12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawZones(ctx, zones, t, alphaOverride) {
  zones.forEach(function (z) {
    if (z.kind === 'wall') {
      drawBlocks(ctx, [{ x: z.x, y: z.y, r: z.r * 0.55 }]);
      return;
    }
    if (z.kind === 'trailflame' || z.kind === 'trailmud') {
      var trailFade = z.life != null && z.maxLife ? clamp(z.life / z.maxLife, 0, 1) : 1;
      ctx.save();
      ctx.globalAlpha = (alphaOverride != null ? alphaOverride : 1) * trailFade * 0.5;
      ctx.fillStyle = z.kind === 'trailflame' ? '#ff6e46' : '#7a5a3a';
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    if (z.kind === 'trap_spike') { drawSpikeTrap(ctx, z, alphaOverride); return; }
    if (z.kind === 'trap_arrow') { drawArrowTrap(ctx, z, alphaOverride); return; }
    var style = ZONE_STYLES[z.kind];
    if (!style) return;
    var pulse = 0.85 + Math.sin(t * 2.4 + z.x * 0.01) * 0.15;
    var baseAlpha = alphaOverride != null ? alphaOverride : 1;
    ctx.save();
    ctx.globalAlpha = baseAlpha;
    var fillGrd = ctx.createRadialGradient(z.x, z.y, 0, z.x, z.y, z.r);
    fillGrd.addColorStop(0, 'rgba(' + style.rgb + ',0.3)');
    fillGrd.addColorStop(0.7, 'rgba(' + style.rgb + ',0.12)');
    fillGrd.addColorStop(1, 'rgba(' + style.rgb + ',0)');
    ctx.fillStyle = fillGrd;
    ctx.beginPath();
    ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = style.ring;
    ctx.lineWidth = 3;
    ctx.shadowColor = style.ring;
    ctx.shadowBlur = 10 * pulse;
    ctx.globalAlpha = baseAlpha * pulse;
    ctx.setLineDash([12, 9]);
    ctx.beginPath();
    ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 6;
    ctx.globalAlpha = baseAlpha;

    ctx.fillStyle = style.icon;
    ctx.strokeStyle = style.icon;
    ctx.lineWidth = 3.6;
    ctx.lineCap = 'round';
    if (z.kind === 'heal') {
      // Petite pousse organique (pétales autour d'un cœur) + lucioles montantes, plus
      // vivant qu'une simple croix.
      for (var pi = 0; pi < 5; pi++) {
        var pa = (Math.PI * 2 / 5) * pi + t * 0.3;
        ctx.save();
        ctx.translate(z.x + Math.cos(pa) * 8, z.y + Math.sin(pa) * 8);
        ctx.rotate(pa);
        ctx.beginPath();
        ctx.ellipse(0, -6, 2.8, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(z.x, z.y, 3.6, 0, Math.PI * 2);
      ctx.fill();
      for (var fi = 0; fi < 4; fi++) {
        var fCycle = ((t * 16 + fi * 23) % (z.r * 1.1)) / (z.r * 1.1);
        var fx = z.x + Math.sin(t * 1.3 + fi * 2.1) * z.r * 0.4;
        var fy = z.y + z.r * 0.6 - fCycle * z.r * 1.1;
        ctx.globalAlpha = baseAlpha * (1 - fCycle) * 0.85;
        ctx.beginPath();
        ctx.arc(fx, fy, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (z.kind === 'flame') {
      ctx.beginPath();
      ctx.moveTo(z.x, z.y + 18);
      ctx.quadraticCurveTo(z.x - 16, z.y - 3, z.x - 3, z.y - 21);
      ctx.quadraticCurveTo(z.x + 5, z.y - 8, z.x + 4, z.y - 3);
      ctx.quadraticCurveTo(z.x + 16, z.y - 8, z.x, z.y + 18);
      ctx.fill();
      for (var ei = 0; ei < 3; ei++) {
        var eCycle = ((t * 22 + ei * 31) % (z.r * 0.9)) / (z.r * 0.9);
        var ex = z.x + Math.sin(ei * 4.7 + t * 2) * z.r * 0.3;
        ctx.globalAlpha = baseAlpha * (1 - eCycle) * 0.8;
        ctx.beginPath();
        ctx.arc(ex, z.y + z.r * 0.4 - eCycle * z.r * 0.9, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (z.kind === 'speed') {
      ctx.save();
      for (var si = 0; si < 3; si++) {
        var sCycle = ((t * 3.2 + si * 0.33) % 1);
        ctx.globalAlpha = baseAlpha * pulse * (1 - sCycle) * 0.6;
        var sy = z.y - 15 + si * 15;
        ctx.beginPath();
        ctx.moveTo(z.x - 22 + sCycle * 30, sy);
        ctx.lineTo(z.x - 8 + sCycle * 30, sy);
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = baseAlpha;
      [-10, 5].forEach(function (off) {
        ctx.beginPath();
        ctx.moveTo(z.x - 8, z.y - 16); ctx.lineTo(z.x + 10, z.y + off); ctx.lineTo(z.x - 8, z.y + 16);
        ctx.stroke();
      });
    } else if (z.kind === 'slow') {
      ctx.beginPath();
      for (var i = 0; i <= 3; i++) ctx.arc(z.x, z.y, 6 + i * 8, 0.9 * Math.PI, 2.1 * Math.PI);
      ctx.stroke();
      for (var bi = 0; bi < 3; bi++) {
        var bCycle = ((t * 8 + bi * 17) % (z.r * 0.8)) / (z.r * 0.8);
        var bx = z.x + Math.sin(bi * 3.1 + 1) * z.r * 0.35;
        ctx.globalAlpha = baseAlpha * (1 - bCycle) * 0.6;
        ctx.beginPath();
        ctx.arc(bx, z.y + z.r * 0.45 - bCycle * z.r * 0.8, 2.2, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (z.kind === 'grapple') {
      ctx.beginPath();
      ctx.arc(z.x, z.y - 17, 5, 0, Math.PI * 2);
      ctx.moveTo(z.x, z.y - 12); ctx.lineTo(z.x, z.y + 12);
      ctx.moveTo(z.x - 8, z.y - 5); ctx.lineTo(z.x + 8, z.y - 5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(z.x - 8, z.y + 11, 8, -0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(z.x + 8, z.y + 11, 8, 0.15 * Math.PI, 1.15 * Math.PI, true);
      ctx.stroke();
      // Petits éclats qui tournent lentement autour de l'ancre — signale "utilisable"
      // de plus loin qu'un simple pictogramme statique.
      for (var gi = 0; gi < 3; gi++) {
        var ga = t * 1.1 + (Math.PI * 2 / 3) * gi;
        ctx.globalAlpha = baseAlpha * (0.5 + 0.4 * Math.sin(ga * 2));
        ctx.beginPath();
        ctx.arc(z.x + Math.cos(ga) * z.r * 0.7, z.y + Math.sin(ga) * z.r * 0.7, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  });
}

// Rocher "extrudé" : une base sombre posée au sol + un sommet éclairé nettement
// surélevé, reliés par des faces verticales pleines — un simple cercle plat au sol
// ne lit jamais comme un objet en 3D, un vrai bloc surélevé avec des flancs si.
var BLOCK_HEIGHT_MULT = 0.85;

function drawBlocks(ctx, blocks) {
  blocks.forEach(function (b) {
    var h = b.r * BLOCK_HEIGHT_MULT;
    var baseVerts = [
      [b.x - b.r, b.y - b.r * 0.6], [b.x - b.r * 0.5, b.y - b.r], [b.x + b.r * 0.6, b.y - b.r * 0.7],
      [b.x + b.r, b.y + b.r * 0.4], [b.x + b.r * 0.3, b.y + b.r], [b.x - b.r * 0.7, b.y + b.r * 0.6]
    ];
    drawGroundShadow(ctx, b.x, b.y + b.r * 0.15, b.r * 1.1);

    ctx.save();

    // Flancs verticaux : une face pleine sombre entre chaque paire de sommets du bas
    // (base) et du haut (sommet surélevé), qui donne réellement du volume au rocher.
    ctx.fillStyle = '#241c2c';
    ctx.strokeStyle = '#00000088';
    ctx.lineWidth = 1;
    for (var i = 0; i < baseVerts.length; i++) {
      var v1 = baseVerts[i], v2 = baseVerts[(i + 1) % baseVerts.length];
      ctx.beginPath();
      ctx.moveTo(v1[0], v1[1]);
      ctx.lineTo(v2[0], v2[1]);
      ctx.lineTo(v2[0], v2[1] - h);
      ctx.lineTo(v1[0], v1[1] - h);
      ctx.closePath();
      ctx.fill();
    }

    // Base au contact du sol, légèrement plus sombre, pour ancrer le bloc visuellement.
    ctx.fillStyle = '#1c1522';
    ctx.beginPath();
    ctx.moveTo(baseVerts[0][0], baseVerts[0][1]);
    baseVerts.slice(1).forEach(function (v) { ctx.lineTo(v[0], v[1]); });
    ctx.closePath();
    ctx.fill();

    // Sommet éclairé, décalé vers le haut de la hauteur du bloc — c'est la face que
    // la lumière frappe directement, donc la plus claire.
    ctx.translate(0, -h);
    ctx.fillStyle = shapeGradient(ctx, b.x - b.r * 0.25, b.y - b.r * 0.3, b.r * 1.3, '#5a4868');
    ctx.strokeStyle = '#00000088';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(baseVerts[0][0], baseVerts[0][1]);
    baseVerts.slice(1).forEach(function (v) { ctx.lineTo(v[0], v[1]); });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(baseVerts[1][0], baseVerts[1][1]);
    ctx.lineTo(baseVerts[2][0], baseVerts[2][1]);
    ctx.stroke();

    ctx.restore();
  });
}

function drawDashTrails(ctx, trails) {
  trails.forEach(function (t) {
    var frac = clamp(t.life / t.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = frac;
    ctx.shadowColor = '#e3b968';
    ctx.shadowBlur = 22 * frac;
    ctx.strokeStyle = '#f2d38f';
    ctx.lineWidth = 10 * frac + 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);
    ctx.stroke();
    ctx.restore();
  });
}

function drawGrappleRopes(ctx, ropes) {
  ropes.forEach(function (r) {
    var frac = clamp(r.life / r.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = frac;
    ctx.shadowColor = '#9b5cf0';
    ctx.shadowBlur = 18 * frac;
    ctx.strokeStyle = '#c9a8ff';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.setLineDash([14, 10]);
    ctx.lineDashOffset = -performance.now() / 20;
    ctx.beginPath();
    ctx.moveTo(r.x1, r.y1);
    ctx.lineTo(r.x2, r.y2);
    ctx.stroke();
    ctx.restore();
  });
}

function drawPulseRings(ctx, rings) {
  rings.forEach(function (r) {
    var frac = clamp(r.life / r.maxLife, 0, 1);
    var grownRadius = r.radius * (1 - frac);
    ctx.save();
    ctx.globalAlpha = frac * 0.85;
    ctx.strokeStyle = '#bfe6ff';
    ctx.shadowColor = '#88d4ff';
    ctx.shadowBlur = 20;
    ctx.lineWidth = 3 + 6 * frac;
    ctx.beginPath();
    ctx.arc(r.x, r.y, grownRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

function drawMines(ctx, mines) {
  mines.forEach(function (m) {
    var pulse = 0.7 + Math.sin(performance.now() / 130) * 0.3;
    ctx.save();
    ctx.globalAlpha = m.armed ? 1 : 0.5;
    ctx.shadowColor = '#f2b84b';
    ctx.shadowBlur = m.armed ? 10 * pulse : 4;
    ctx.fillStyle = '#3a2e42';
    ctx.beginPath();
    ctx.arc(m.x, m.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = m.armed ? '#f2b84b' : '#8a7a52';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = m.armed ? '#f2b84b' : '#8a7a52';
    ctx.beginPath();
    ctx.arc(m.x, m.y, 3, 0, Math.PI * 2);
    ctx.fill();
    if (m.armed) {
      ctx.globalAlpha = 0.35 * pulse;
      ctx.strokeStyle = '#f2b84b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(m.x, m.y, MINE_TRIGGER_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  });
}

function drawBrasier(ctx, b) {
  if (!b) return;
  ctx.save();
  ctx.shadowColor = '#ff6e46';
  ctx.shadowBlur = 22;
  var grd = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, BRASIER_RADIUS);
  grd.addColorStop(0, 'rgba(255,224,150,0.95)');
  grd.addColorStop(0.5, 'rgba(255,110,70,0.75)');
  grd.addColorStop(1, 'rgba(255,60,30,0)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(b.x, b.y, BRASIER_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSwordSwings(ctx, swings) {
  swings.forEach(function (s) {
    var frac = clamp(s.life / s.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = frac * 0.7;
    ctx.strokeStyle = '#fff2c8';
    ctx.shadowColor = '#fff2c8';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.range, s.angle - s.arc / 2, s.angle + s.arc / 2);
    ctx.stroke();
    ctx.restore();
  });
}

function drawPlayerLaser(ctx, p) {
  if (!p.laserActive) return;
  ctx.save();
  ctx.shadowColor = '#fff2c8';
  ctx.shadowBlur = 16;
  ctx.strokeStyle = '#fff8e0';
  ctx.lineWidth = LASER_WIDTH_PLAYER * 0.5;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.laserEndX, p.laserEndY);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = LASER_WIDTH_PLAYER * 0.22;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.laserEndX, p.laserEndY);
  ctx.stroke();
  ctx.restore();
}

function drawProjectiles(ctx, projectiles) {
  projectiles.forEach(function (pr) {
    ctx.save();
    ctx.shadowColor = pr.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = pr.color;
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawBlasts(ctx, blasts) {
  blasts.forEach(function (b) {
    var frac = 1 - clamp(b.delay / b.maxDelay, 0, 1);
    ctx.save();
    ctx.strokeStyle = b.color;
    ctx.globalAlpha = 0.35 + 0.4 * Math.sin(frac * Math.PI);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * (0.3 + frac * 0.7), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

function drawLasers(ctx, lasers) {
  lasers.forEach(function (l) {
    var ex = l.x + Math.cos(l.angle) * l.length, ey = l.y + Math.sin(l.angle) * l.length;
    ctx.save();
    if (!l.firing) {
      var frac = 1 - clamp(l.telegraph / l.telegraphMax, 0, 1);
      ctx.strokeStyle = l.color;
      ctx.globalAlpha = 0.3 + 0.35 * frac;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    } else {
      var fadeOut = clamp(l.fireTimer / l.fireMax, 0, 1);
      ctx.shadowColor = l.color;
      ctx.shadowBlur = 22;
      ctx.strokeStyle = l.color;
      ctx.globalAlpha = 0.55 + 0.4 * fadeOut;
      ctx.lineWidth = l.width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 0.7 * fadeOut + 0.2;
      ctx.lineWidth = l.width * 0.28;
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
    ctx.restore();
  });
}

function drawParticles(ctx, particles) {
  particles.forEach(function (pt) {
    ctx.save();
    ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawEnemy(ctx, e) {
  var isBoss = e.shape === 'boss';
  var spawnFrac = clamp((e.spawnTimer || 0) / SPAWN_ANIM_DUR, 0, 1);
  var scale = 1 - spawnFrac * spawnFrac; // pop-in : démarre petit, accélère vers la taille finale
  var r = e.r * (0.15 + 0.85 * scale);

  // Respiration/pas : un léger rebond au-dessus de son ombre (qui, elle, reste au sol),
  // plus ample et plus rapide en mouvement qu'à l'arrêt — rend la scène vivante même
  // hors combat direct, sans jamais gêner la lecture des positions/collisions réelles.
  var t = (typeof CB !== 'undefined' && CB) ? CB.elapsed || 0 : 0;
  var phase = e.animPhase || 0;
  var isMoving = Math.abs(e.vx || 0) + Math.abs(e.vy || 0) > 6;
  var bobSpeed = isMoving ? 7.5 : 2.4;
  var bobAmp = (isBoss ? 3.4 : 2) * (isMoving ? 1 : 0.55);
  var bob = Math.max(0, Math.sin(t * bobSpeed + phase)) * bobAmp;

  var opts = { glow: true, tier: isBoss ? 5 : e.tier };
  if (e.invulnOn) opts.alpha = 0.45 + Math.sin(Date.now() / 60) * 0.15;
  if (e.speedBuffTimer > 0) opts.ring = '#8fe3a0';
  if (e.shieldOn) opts.ring = '#88d4ff';
  if (e.telegraphOn || e.chargeTelegraphOn || e.slamTelegraphOn) opts.ring = '#ff5a3c';
  drawGroundShadow(ctx, e.x, e.y, r * (1 - bob / (bobAmp * 6 + 40)));

  // Hauteur "debout" permanente au-dessus de l'ombre (distincte du petit rebond de pas) :
  // c'est elle qui donne l'impression d'un corps vu depuis une caméra inclinée façon
  // Hades plutôt qu'une pure vue de dessus, où tout collerait à son ombre.
  var standH = r * (isBoss ? 0.95 : 0.72);
  var drawY = e.y - bob - standH;

  // Masse effilée reliant l'ombre au sol au corps surélevé : sans elle, la créature
  // n'est qu'un sprite plat qui flotte au-dessus de son ombre. Avec, elle a un vrai
  // volume vertical façon caméra inclinée, comme les rochers extrudés (drawBlocks).
  ctx.save();
  ctx.fillStyle = 'rgba(8,5,12,0.5)';
  ctx.beginPath();
  ctx.ellipse(e.x, e.y - (bob + standH) * 0.5, r * 0.6, (bob + standH) * 0.62 + r * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Petit écrasement/étirement au moment de l'impact — une réaction physique brève,
  // en plus du flash blanc déjà existant.
  var hitSquash = e.hitFlash > 0 ? clamp(e.hitFlash / HIT_FLASH_DUR, 0, 1) : 0;
  ctx.save();
  if (hitSquash > 0) {
    ctx.translate(e.x, drawY);
    ctx.scale(1 + hitSquash * 0.2, 1 - hitSquash * 0.16);
    ctx.translate(-e.x, -drawY);
  }
  drawEnemyCreature(ctx, e, e.x, drawY, r, opts);
  if (hitSquash > 0) {
    var flashOpts = { alpha: hitSquash * 0.75, tier: e.tier, flashOnly: true };
    drawEnemyCreature(ctx, e, e.x, drawY, r, flashOpts);
  }
  ctx.restore();

  if (spawnFrac > 0) {
    ctx.save();
    ctx.globalAlpha = spawnFrac;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, drawY, e.r * (1 + spawnFrac * 0.8), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  var barW = e.r * 1.9;
  var hpFrac = clamp(e.hp / e.maxHp, 0, 1);
  ctx.save();
  ctx.fillStyle = '#00000099';
  ctx.fillRect(e.x - barW / 2, drawY - e.r - 12, barW, 4);
  var barColor = hpFrac > 0.5 ? '#8fe3a0' : (hpFrac > 0.2 ? '#f2b84b' : '#c9364f');
  ctx.shadowColor = barColor;
  ctx.shadowBlur = 5;
  ctx.fillStyle = barColor;
  ctx.fillRect(e.x - barW / 2, drawY - e.r - 12, barW * hpFrac, 4);
  ctx.restore();
}

function drawPlayer(ctx, p) {
  // Petit rebond de marche (arrêté pendant le dash, où la traînée porte déjà le mouvement) —
  // l'ombre, elle, reste fidèle à la position réelle au sol.
  var pt = (typeof CB !== 'undefined' && CB) ? CB.elapsed || 0 : 0;
  var pMoving = Math.abs(p.vx || 0) + Math.abs(p.vy || 0) > 8;
  var pBobAmp = p.isDashing ? 0 : (pMoving ? 3 : 1.2);
  var pBobSpeed = pMoving ? 9 : 2.2;
  var pBob = Math.max(0, Math.sin(pt * pBobSpeed)) * pBobAmp;

  drawGroundShadow(ctx, p.x, p.y, p.r * 1.15);

  var ang = Math.atan2(p.facingY, p.facingX);
  var flicker = p.invulnTimer > 0 ? 0.55 + Math.sin(Date.now() / 40) * 0.2 : 1;

  // Hauteur "debout" permanente au-dessus de l'ombre, comme pour les ennemis : le
  // personnage se détache nettement du sol plutôt que d'y coller, cohérent avec la
  // légère inclinaison de caméra (ARENA_TILT_Y) appliquée à toute la scène.
  var standH = p.r * 0.8;

  ctx.save();
  ctx.translate(p.x, p.y - pBob - standH);
  ctx.rotate(ang);
  ctx.globalAlpha = flicker;

  // Écharpe/pan de tissu rouge sombre qui traîne à l'arrière, s'évase pendant le dash —
  // accent Underworld plutôt qu'une cape de mage complète.
  var flare = p.isDashing ? 1.6 : 1;
  ctx.save();
  ctx.globalAlpha *= 0.8;
  ctx.fillStyle = shadeColor('#7a1f22', -0.1);
  ctx.beginPath();
  ctx.moveTo(-p.r * 0.2, -p.r * 0.4);
  ctx.quadraticCurveTo(-p.r * 1.7 * flare, 0, -p.r * 0.2, p.r * 0.4);
  ctx.quadraticCurveTo(-p.r * 0.55, 0, -p.r * 0.2, -p.r * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Torse : harnais de cuir sombre à la Zagreus (buste humain nu, pas de robe).
  ctx.shadowColor = '#e3b968';
  ctx.shadowBlur = p.isDashing ? 28 : 15;
  ctx.fillStyle = shapeGradient(ctx, -p.r * 0.12, 0, p.r * 0.95, '#c98a68');
  ctx.beginPath();
  ctx.ellipse(-p.r * 0.12, 0, p.r * 0.68, p.r * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();

  // Harnais croisé sur le torse : deux sangles de cuir sombre avec liseré rouge.
  ctx.shadowBlur = 0;
  ctx.save();
  ctx.strokeStyle = '#241b22';
  ctx.lineWidth = p.r * 0.22;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-p.r * 0.5, -p.r * 0.6); ctx.lineTo(p.r * 0.22, p.r * 0.55);
  ctx.stroke();
  ctx.strokeStyle = '#7a1f22';
  ctx.lineWidth = p.r * 0.06;
  ctx.beginPath();
  ctx.moveTo(-p.r * 0.5, -p.r * 0.6); ctx.lineTo(p.r * 0.22, p.r * 0.55);
  ctx.stroke();
  ctx.restore();

  // Épaules : peau nue, dessinées après le torse pour bien dépasser de sa silhouette.
  ctx.fillStyle = shadeColor('#c98a68', -0.05);
  ctx.beginPath(); ctx.arc(-p.r * 0.05, -p.r * 0.78, p.r * 0.36, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-p.r * 0.05, p.r * 0.78, p.r * 0.36, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1a1420aa';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(-p.r * 0.05, -p.r * 0.78, p.r * 0.36, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(-p.r * 0.05, p.r * 0.78, p.r * 0.36, 0, Math.PI * 2); ctx.stroke();

  // Tête à visage découvert (pas de capuche) : peau pâle, mâchoire nette, décalée vers
  // l'avant pour rester lisible même en mouvement rapide.
  ctx.shadowColor = '#e3b968';
  ctx.shadowBlur = 8;
  ctx.fillStyle = shapeGradient(ctx, p.r * 0.65, 0, p.r * 0.46, '#d9ab84');
  ctx.beginPath();
  ctx.arc(p.r * 0.65, 0, p.r * 0.46, 0, Math.PI * 2);
  ctx.fill();

  // Chevelure sombre et ébouriffée, balayée vers l'arrière — la marque de fabrique du
  // personnage, bien plus reconnaissable vu de haut qu'un simple contour de visage.
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#241d28';
  ctx.beginPath();
  ctx.moveTo(p.r * 0.42, -p.r * 0.4);
  ctx.quadraticCurveTo(p.r * 0.05, -p.r * 0.5, -p.r * 0.15, -p.r * 0.18);
  ctx.quadraticCurveTo(p.r * 0.02, 0, -p.r * 0.18, p.r * 0.05);
  ctx.quadraticCurveTo(p.r * 0.02, p.r * 0.5, p.r * 0.42, p.r * 0.4);
  ctx.quadraticCurveTo(p.r * 0.62, 0, p.r * 0.42, -p.r * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#120e15aa';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Lueur rouge des yeux, visible même de loin — seul détail de visage nécessaire
  // à cette échelle et cette distance de caméra.
  ctx.fillStyle = '#ff4d4d';
  ctx.shadowColor = '#ff4d4d';
  ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.arc(p.r * 0.78, -p.r * 0.14, p.r * 0.06, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(p.r * 0.78, p.r * 0.14, p.r * 0.06, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore();
}

// Barre de charge au-dessus du joueur pendant la charge du météore (arme de type 1) —
// visible en jeu, pas juste dans le HUD, puisque le joueur doit rester immobile pour charger.
function drawMeteorChargeBar(ctx, p) {
  if (p.weapon1 !== 'meteor' || !p.w1Charging) return;
  var frac = clamp(p.w1ChargeTime / METEOR_MAX_CHARGE, 0, 1);
  var barW = 46, barH = 7;
  var x = p.x - barW / 2, y = p.y - p.r * 1.8 - 24;
  ctx.save();
  ctx.fillStyle = '#15101cdd';
  ctx.strokeStyle = '#ffffff40';
  ctx.lineWidth = 1.5;
  ctx.fillRect(x, y, barW, barH);
  ctx.strokeRect(x, y, barW, barH);
  var full = frac >= 1;
  ctx.fillStyle = full ? '#ffcf6b' : '#ff8a4a';
  ctx.shadowColor = full ? '#ffcf6b' : '#ff8a4a';
  ctx.shadowBlur = full ? 14 : 8;
  ctx.fillRect(x + 1.5, y + 1.5, Math.max(0, (barW - 3) * frac), barH - 3);
  ctx.restore();
}

function renderCombat(ctx, w, h, t) {
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  var shakeX = 0, shakeY = 0;
  if (CB.shakeTime > 0) {
    shakeX = (Math.random() * 2 - 1) * CB.shakeMag;
    shakeY = (Math.random() * 2 - 1) * CB.shakeMag;
  }
  // h / (ARENA_H * ARENA_TILT_Y) plutôt que h / ARENA_H : une fois la compression
  // verticale appliquée, l'arène remplit quand même toute la hauteur disponible au
  // lieu de laisser des bandes noires en haut/bas.
  var scale = Math.min(w / ARENA_W, h / (ARENA_H * ARENA_TILT_Y));
  var scaleY = scale * ARENA_TILT_Y;
  var offX = (w - ARENA_W * scale) / 2;
  var offY = (h - ARENA_H * scaleY) / 2;
  CB.viewScale = scale; CB.viewScaleY = scaleY; CB.viewOffX = offX; CB.viewOffY = offY;
  ctx.translate(offX + shakeX, offY + shakeY);
  ctx.scale(scale, scaleY);

  drawArenaBackground(ctx, ARENA_W, ARENA_H, t);
  drawZones(ctx, CB.zones || [], t);
  drawBlocks(ctx, CB.blocks);
  drawBlasts(ctx, CB.blasts);
  drawMines(ctx, CB.mines || []);
  drawBrasier(ctx, CB.brasier);
  drawDashTrails(ctx, CB.dashTrails);
  drawGrappleRopes(ctx, CB.grappleRopes || []);
  drawSwordSwings(ctx, CB.swordSwings || []);
  CB.enemies.forEach(function (e) { drawEnemy(ctx, e); });
  drawPlayer(ctx, CB.player);
  drawMeteorChargeBar(ctx, CB.player);
  drawPlayerLaser(ctx, CB.player);
  drawProjectiles(ctx, CB.projectiles);
  drawLasers(ctx, CB.lasers || []);
  drawPulseRings(ctx, CB.pulseRings || []);
  drawParticles(ctx, CB.particles);

  if (CB.phase === 'transition') {
    ctx.save();
    ctx.globalAlpha = clamp(CB.transitionTimer / WAVE_TRANSITION_DUR, 0, 1);
    ctx.fillStyle = '#f2d38f';
    ctx.font = '700 40px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#e3b968';
    ctx.shadowBlur = 18;
    ctx.fillText(describeWaveIndex(CB.waveIndex) + ' terminé(e)', ARENA_W / 2, ARENA_H / 2);
    ctx.restore();
  }

  if (CB.paused) {
    ctx.save();
    ctx.fillStyle = 'rgba(6,4,10,0.6)';
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    ctx.fillStyle = '#f2d38f';
    ctx.font = '800 52px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#e3b968';
    ctx.shadowBlur = 20;
    ctx.fillText('PAUSE', ARENA_W / 2, ARENA_H / 2 - 10);
    ctx.font = '600 16px Inter, sans-serif';
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#b6a99a';
    ctx.fillText(keyLabel(KEYBINDS.pause) + ' pour reprendre', ARENA_W / 2, ARENA_H / 2 + 26);
    ctx.restore();
  }

  ctx.restore();

  // Vignette de laisse anti-fuite : prévient avant que la sortie de zone ne pique vraiment.
  if (CB.leashWarning > 0) {
    ctx.save();
    var lw = CB.leashWarning;
    var lg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.6);
    lg.addColorStop(0, 'rgba(180,60,220,0)');
    lg.addColorStop(1, 'rgba(180,60,220,' + (0.4 * lw) + ')');
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, w, h);
    if (lw > 0.6) {
      ctx.globalAlpha = (lw - 0.6) / 0.4;
      ctx.font = '700 20px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e3b3ff';
      ctx.fillText('⚠ Trop loin du combat !', w / 2, 46);
    }
    ctx.restore();
  }

  // Flash de bordure, discret et bref, pour signaler un coup reçu sans gêner la lecture du jeu.
  if (CB.damageFlashTime > 0) {
    var flashFrac = clamp(CB.damageFlashTime / DAMAGE_FLASH_DUR, 0, 1);
    ctx.save();
    var vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.62);
    vg.addColorStop(0, 'rgba(255,60,60,0)');
    vg.addColorStop(1, 'rgba(255,40,40,' + (0.32 * flashFrac) + ')');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

function updateHUD() {
  var p = CB.player;
  document.getElementById('hpLabel').innerHTML = '<b>' + Math.round(CB.totalDamageTaken) + '</b> dégâts subis';
  document.getElementById('hpLabel').classList.toggle('hit', CB.damageFlashTime > 0);
  document.getElementById('waveIndicator').textContent = describeWaveIndex(Math.min(CB.waveIndex, CB.totalWaves - 1));
  document.getElementById('timerLabel').textContent = formatTime(CB.elapsed);

  setAbilityRing('abilityDash', p.dashCd, p.dashCdMax || 1);
  setAbilityRing('abilitySpecial', p.specialCd, p.specialCdMax);
  if (p.weapon2 === 'sprint') {
    setAbilityRing('abilityPulse', p.w2ResourceMax - p.w2Resource, p.w2ResourceMax);
  } else {
    setAbilityRing('abilityPulse', p.pulseCd, p.pulseCdMax || 1);
  }
}

function setAbilityRing(id, cd, cdMax) {
  var el = document.getElementById(id);
  var ring = el.querySelector('.ring-fill');
  var frac = clamp(cd / cdMax, 0, 1);
  ring.style.strokeDashoffset = (100.5 * frac).toFixed(1);
  el.classList.toggle('on-cooldown', cd > 0);
}
