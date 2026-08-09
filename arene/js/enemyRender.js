// ============================================================================
// Rendu des ennemis — silhouettes distinctes par type (pas de formes+chiffres).
// ============================================================================
//
// Organisation de ce fichier :
//   1. Couleur (teinte de chapitre)
//   2. Corps de base (silhouette générique par famille de forme)
//   3. "Parties" réutilisables (cornes, bouclier, capuche, yeux...) — vocabulaire
//      visuel commun composé différemment par chaque créature
//   4. Un renderer par type d'ennemi normal (15) puis par boss (5)
//   5. Registre ENEMY_RENDERERS { defId -> fonction } + dispatcher drawEnemyCreature
//
// Chaque renderer a la signature (ctx, e, x, y, r, color, opts, t) :
//   e     l'ennemi (accès à e.tier/e.animPhase/e.def... pour varier l'anim)
//   x, y  position d'affichage (déjà décalée par le rebond de drawEnemy)
//   r     rayon courant (tient compte de l'anim d'apparition)
//   color couleur de base (déjà teintée par le chapitre)
//   opts  { glow, ring, alpha, flashOnly } — flashOnly = flash blanc à l'impact,
//         ne dessiner que la silhouette, sans détails
//   t     CB.elapsed, pour les détails animés (runes en orbite, flammes...)

// ---------------- 1. Couleur ----------------

// Retourne du HEX (pas rgb(...)) : shadeColor/shapeGradient (render.js) attendent un hex
// et échouent silencieusement sur autre chose (parseInt('rgb(...)', 16) -> NaN -> fillStyle
// invalide -> silhouette rendue noire). C'est ce format qui a fait apparaître, pendant la
// mise au point de ce fichier, TOUS les ennemis avec un corps noir au lieu de leur couleur.
function blendColors(hexA, hexB, t) {
  hexA = hexA.replace('#', ''); hexB = hexB.replace('#', '');
  var na = parseInt(hexA, 16), nb = parseInt(hexB, 16);
  var ar = (na >> 16) & 0xFF, ag = (na >> 8) & 0xFF, ab = na & 0xFF;
  var br = (nb >> 16) & 0xFF, bg = (nb >> 8) & 0xFF, bb = nb & 0xFF;
  var r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), b = Math.round(ab + (bb - ab) * t);
  var toHex = function (v) { var s = v.toString(16); return s.length < 2 ? '0' + s : s; };
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

// Teinte légèrement la couleur de tier avec l'accent du chapitre en cours — l'identité
// (tier) reste dominante, le chapitre n'ajoute qu'une nuance d'ambiance.
function chapterTintedColor(baseColor) {
  var theme = (typeof currentChapterTheme === 'function') ? currentChapterTheme() : null;
  if (!theme || !theme.border) return baseColor;
  return blendColors(baseColor, theme.border, 0.18);
}

// ---------------- 2. Corps de base ----------------

function drawCreatureBody(ctx, shape, x, y, r, color, opts) {
  opts = opts || {};
  ctx.save();
  ctx.globalAlpha = opts.alpha != null ? opts.alpha : 1;
  ctx.shadowColor = color;
  ctx.shadowBlur = opts.glow ? (10 + (opts.tier || 1) * 3) : 0;
  ctx.beginPath();
  var gradCx = x, gradCy = y;
  if (shape === 'square') {
    ctx.rect(x - r * 0.82, y - r * 0.82, r * 1.64, r * 1.64);
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
}

// ---------------- 3. Parties réutilisables ----------------
// Chacune dessine en coordonnées ABSOLUES (x,y = centre de la créature), pour rester
// cohérente avec drawCreatureBody plutôt que de jongler avec des transforms.

function partArmorPlates(ctx, x, y, r, color) {
  ctx.save();
  ctx.fillStyle = shadeColor(color, -0.25);
  ctx.strokeStyle = '#1a1420aa';
  ctx.lineWidth = 1.2;
  [-1, 1].forEach(function (side) {
    ctx.beginPath();
    ctx.ellipse(x + side * r * 0.72, y - r * 0.1, r * 0.32, r * 0.42, side * 0.3, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  });
  ctx.restore();
}

function partHorns(ctx, x, y, r, color) {
  ctx.save();
  ctx.fillStyle = shadeColor(color, -0.35);
  ctx.strokeStyle = '#1a1420aa';
  ctx.lineWidth = 1;
  [-1, 1].forEach(function (side) {
    ctx.beginPath();
    ctx.moveTo(x + side * r * 0.32, y - r * 0.72);
    ctx.quadraticCurveTo(x + side * r * 0.85, y - r * 1.25, x + side * r * 0.55, y - r * 1.55);
    ctx.quadraticCurveTo(x + side * r * 0.42, y - r * 1.1, x + side * r * 0.14, y - r * 0.78);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  });
  ctx.restore();
}

function partShield(ctx, x, y, r, color) {
  ctx.save();
  var sx = x - r * 0.78, sy = y + r * 0.05;
  ctx.translate(sx, sy);
  ctx.fillStyle = shadeColor(color, -0.15);
  ctx.strokeStyle = '#e3b968aa';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.55);
  ctx.quadraticCurveTo(r * 0.4, -r * 0.5, r * 0.42, r * 0.05);
  ctx.quadraticCurveTo(r * 0.38, r * 0.5, 0, r * 0.72);
  ctx.quadraticCurveTo(-r * 0.38, r * 0.5, -r * 0.42, r * 0.05);
  ctx.quadraticCurveTo(-r * 0.4, -r * 0.5, 0, -r * 0.55);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.3); ctx.lineTo(0, r * 0.45);
  ctx.strokeStyle = '#00000055';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function partWeaponBlade(ctx, x, y, r, color) {
  ctx.save();
  ctx.translate(x + r * 0.55, y - r * 0.95);
  ctx.rotate(-0.5);
  ctx.fillStyle = '#d8d8e0';
  ctx.strokeStyle = '#1a1420aa';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-r * 0.14, 0);
  ctx.lineTo(r * 0.14, 0);
  ctx.lineTo(r * 0.07, -r * 1.05);
  ctx.lineTo(0, -r * 1.25);
  ctx.lineTo(-r * 0.07, -r * 1.05);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = shadeColor(color, -0.3);
  ctx.fillRect(-r * 0.2, 0, r * 0.4, r * 0.18);
  ctx.restore();
}

function partCracks(ctx, x, y, r, color) {
  ctx.save();
  ctx.strokeStyle = '#ffd98a';
  ctx.lineWidth = 1.4;
  ctx.globalAlpha = 0.75 + Math.sin(Date.now() / 300) * 0.2;
  ctx.shadowColor = '#ffd98a';
  ctx.shadowBlur = 6;
  [[-0.4, -0.3, 0.3, 0.5], [0.2, -0.5, -0.15, 0.2], [-0.1, 0.1, 0.35, -0.4]].forEach(function (c) {
    ctx.beginPath();
    ctx.moveTo(x + c[0] * r, y + c[1] * r);
    ctx.lineTo(x + c[2] * r, y + c[3] * r);
    ctx.stroke();
  });
  ctx.restore();
}

function partHood(ctx, x, y, r, color, length) {
  ctx.save();
  ctx.fillStyle = shadeColor(color, -0.4);
  ctx.globalAlpha = 0.92;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.15);
  ctx.quadraticCurveTo(x + r * 0.62, y - r * 0.6, x + r * 0.4, y + r * (length || 0.5));
  ctx.lineTo(x - r * 0.4, y + r * (length || 0.5));
  ctx.quadraticCurveTo(x - r * 0.62, y - r * 0.6, x, y - r * 1.15);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function partBow(ctx, x, y, r, color) {
  ctx.save();
  ctx.strokeStyle = '#c9a06a';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(x + r * 0.85, y + r * 0.05, r * 0.62, -0.95, 0.95);
  ctx.stroke();
  ctx.strokeStyle = '#eee8d8aa';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x + r * 0.85 + Math.cos(-0.95) * r * 0.62, y + r * 0.05 + Math.sin(-0.95) * r * 0.62);
  ctx.lineTo(x + r * 0.85 + Math.cos(0.95) * r * 0.62, y + r * 0.05 + Math.sin(0.95) * r * 0.62);
  ctx.stroke();
  ctx.restore();
}

function partCrossbow(ctx, x, y, r, color) {
  ctx.save();
  ctx.strokeStyle = '#8a6a4a';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(x + r * 0.3, y + r * 0.1); ctx.lineTo(x + r * 1.15, y + r * 0.1);
  ctx.stroke();
  ctx.strokeStyle = '#c9a06a';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x + r * 0.75, y - r * 0.32); ctx.lineTo(x + r * 0.75, y + r * 0.52);
  ctx.stroke();
  ctx.restore();
}

function partScopeRifle(ctx, x, y, r, color) {
  ctx.save();
  ctx.strokeStyle = '#5a5a68';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + r * 0.1, y + r * 0.15); ctx.lineTo(x + r * 1.35, y - r * 0.1);
  ctx.stroke();
  ctx.fillStyle = '#d94b4b';
  ctx.beginPath();
  ctx.arc(x + r * 1.35, y - r * 0.1, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function partMortarTube(ctx, x, y, r, color) {
  ctx.save();
  ctx.translate(x - r * 0.15, y - r * 0.2);
  ctx.rotate(-0.55);
  ctx.fillStyle = shadeColor(color, -0.35);
  ctx.strokeStyle = '#1a1420aa';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(-r * 0.22, -r * 1.1, r * 0.44, r * 1.1);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#00000077';
  ctx.beginPath();
  ctx.ellipse(0, -r * 1.1, r * 0.22, r * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function partOrbitingRunes(ctx, x, y, r, color, t, count, speed) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  var n = count || 3;
  for (var i = 0; i < n; i++) {
    var a = (t || 0) * (speed || 1.4) + (Math.PI * 2 / n) * i;
    var rx = x + Math.cos(a) * r * 1.25, ry = y + Math.sin(a) * r * 0.55 - r * 0.3;
    ctx.globalAlpha = 0.55 + 0.35 * Math.sin(a * 2);
    ctx.beginPath();
    ctx.moveTo(rx, ry - 3.5); ctx.lineTo(rx + 3, ry); ctx.lineTo(rx, ry + 3.5); ctx.lineTo(rx - 3, ry);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function partEye(ctx, x, y, r, glowColor, t) {
  ctx.save();
  var pulse = 0.8 + Math.sin((t || 0) * 3) * 0.15;
  ctx.fillStyle = '#100a16';
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.5, r * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = glowColor;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 10 * pulse;
  ctx.globalAlpha = pulse;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0a0710';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function partTendrils(ctx, x, y, r, color, t) {
  ctx.save();
  ctx.strokeStyle = shadeColor(color, -0.2);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (var i = 0; i < 3; i++) {
    var a = -0.7 + i * 0.7;
    var wob = Math.sin((t || 0) * 3 + i) * r * 0.12;
    ctx.beginPath();
    ctx.moveTo(x + Math.sin(a) * r * 0.6, y + r * 0.5);
    ctx.quadraticCurveTo(x + Math.sin(a) * r * 0.75 + wob, y + r * 0.95, x + Math.sin(a) * r * 0.55, y + r * 1.25);
    ctx.stroke();
  }
  ctx.restore();
}

function partFlameAura(ctx, x, y, r, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (var i = 0; i < 5; i++) {
    var a = (Math.PI * 2 / 5) * i + (t || 0) * 0.6;
    var flick = 0.6 + Math.sin((t || 0) * 8 + i * 2) * 0.3;
    var fx = x + Math.cos(a) * r * 0.75, fy = y + Math.sin(a) * r * 0.75;
    var g = ctx.createRadialGradient(fx, fy, 0, fx, fy, r * 0.4 * flick);
    g.addColorStop(0, 'rgba(255,170,90,0.55)');
    g.addColorStop(1, 'rgba(255,90,50,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(fx, fy, r * 0.4 * flick, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function partStaff(ctx, x, y, r, color) {
  ctx.save();
  ctx.strokeStyle = '#8a6a4a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + r * 0.7, y + r * 0.9); ctx.lineTo(x + r * 0.95, y - r * 1.05);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(x + r * 0.95, y - r * 1.1, r * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function partGhostRibbons(ctx, x, y, r, color, t) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  for (var i = 0; i < 3; i++) {
    var off = i * 1.4;
    var sway = Math.sin((t || 0) * 2.4 + off) * r * 0.3;
    ctx.beginPath();
    ctx.moveTo(x + (i - 1) * r * 0.35, y + r * 0.4);
    ctx.quadraticCurveTo(x + (i - 1) * r * 0.35 + sway, y + r * 1.1, x + (i - 1) * r * 0.35, y + r * 1.6);
    ctx.stroke();
  }
  ctx.restore();
}

function partSkull(ctx, x, y, r, color) {
  ctx.save();
  ctx.translate(x - r * 0.05, y - r * 0.35);
  ctx.fillStyle = '#e8e2d0';
  ctx.strokeStyle = '#1a1420aa';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1a1420';
  ctx.beginPath(); ctx.arc(-r * 0.08, -r * 0.03, r * 0.05, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(r * 0.08, -r * 0.03, r * 0.05, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---------------- 4. Un renderer par type ----------------

function drawBloc(ctx, e, x, y, r, color, opts) {
  drawCreatureBody(ctx, 'square', x, y, r, color, opts);
  if (opts.flashOnly) return;
  partArmorPlates(ctx, x, y, r, color);
}

function drawBastion(ctx, e, x, y, r, color, opts) {
  drawCreatureBody(ctx, 'square', x, y, r, color, opts);
  if (opts.flashOnly) return;
  partArmorPlates(ctx, x, y, r, color);
  partShield(ctx, x, y, r, color);
}

function drawColosse(ctx, e, x, y, r, color, opts) {
  drawCreatureBody(ctx, 'square', x, y, r, color, opts);
  if (opts.flashOnly) return;
  partHorns(ctx, x, y, r * 0.75, color);
}

function drawGolem(ctx, e, x, y, r, color, opts) {
  drawCreatureBody(ctx, 'square', x, y, r, color, opts);
  if (opts.flashOnly) return;
  partCracks(ctx, x, y, r, color);
}

function drawTitan(ctx, e, x, y, r, color, opts) {
  drawCreatureBody(ctx, 'square', x, y, r, color, opts);
  if (opts.flashOnly) return;
  partHorns(ctx, x, y, r, color);
  partWeaponBlade(ctx, x, y, r, color);
}

function drawTireur(ctx, e, x, y, r, color, opts) {
  drawCreatureBody(ctx, 'triangle', x, y, r, color, opts);
  if (opts.flashOnly) return;
  partHood(ctx, x, y, r, color, 0.4);
  partBow(ctx, x, y, r, color);
}

function drawArbaletrier(ctx, e, x, y, r, color, opts) {
  drawCreatureBody(ctx, 'triangle', x, y, r, color, opts);
  if (opts.flashOnly) return;
  partHood(ctx, x, y, r, color, 0.4);
  partCrossbow(ctx, x, y, r, color);
}

function drawSniper(ctx, e, x, y, r, color, opts) {
  drawCreatureBody(ctx, 'triangle', x, y, r, color, opts);
  if (opts.flashOnly) return;
  partHood(ctx, x, y, r, color, 0.7);
  partScopeRifle(ctx, x, y, r, color);
}

function drawMortier(ctx, e, x, y, r, color, opts) {
  drawCreatureBody(ctx, 'triangle', x, y, r, color, opts);
  if (opts.flashOnly) return;
  partMortarTube(ctx, x, y, r, color);
}

function drawOracle(ctx, e, x, y, r, color, opts, t) {
  drawCreatureBody(ctx, 'triangle', x, y, r, color, opts);
  if (opts.flashOnly) return;
  partHood(ctx, x, y, r, color, 0.55);
  partOrbitingRunes(ctx, x, y, r, '#b34bf2', t, 3, 1.6);
}

function drawRodeur(ctx, e, x, y, r, color, opts, t) {
  drawCreatureBody(ctx, 'circle', x, y, r, color, opts);
  if (opts.flashOnly) return;
  partEye(ctx, x, y, r, '#ffe08a', t);
}

function drawSangsue(ctx, e, x, y, r, color, opts, t) {
  drawCreatureBody(ctx, 'circle', x, y, r, color, opts);
  if (opts.flashOnly) return;
  partTendrils(ctx, x, y, r, color, t);
}

function drawEnflamme(ctx, e, x, y, r, color, opts, t) {
  drawCreatureBody(ctx, 'circle', x, y, r, color, opts);
  // Dessinée par-dessus (mélange additif "lighter" : n'efface jamais le corps, ne fait
  // qu'ajouter de la lumière) pour que les langues de flamme restent visibles.
  if (!opts.flashOnly) partFlameAura(ctx, x, y, r, t);
}

function drawChaman(ctx, e, x, y, r, color, opts, t) {
  drawCreatureBody(ctx, 'circle', x, y, r, color, opts);
  if (opts.flashOnly) return;
  partStaff(ctx, x, y, r, '#8fe3a0');
  partOrbitingRunes(ctx, x, y, r, '#8fe3a0', t, 2, 0.9);
}

function drawSpectre(ctx, e, x, y, r, color, opts, t) {
  var ghostOpts = {};
  for (var k in opts) ghostOpts[k] = opts[k];
  ghostOpts.alpha = (opts.alpha != null ? opts.alpha : 1) * 0.7;
  drawCreatureBody(ctx, 'circle', x, y, r, color, ghostOpts);
  if (opts.flashOnly) return;
  partGhostRibbons(ctx, x, y, r, color, t);
}

// ---------------- Boss ----------------

function drawBossColossaure(ctx, e, x, y, r, color, opts, t) {
  drawCreatureBody(ctx, 'boss', x, y, r, color, opts);
  if (opts.flashOnly) return;
  partHorns(ctx, x, y, r, color);
  partArmorPlates(ctx, x, y, r, color);
  partFlameAura(ctx, x, y, r * 0.5, t);
}

function drawBossGardien(ctx, e, x, y, r, color, opts) {
  drawCreatureBody(ctx, 'boss', x, y, r, color, opts);
  if (opts.flashOnly) return;
  partShield(ctx, x, y, r * 1.2, color);
  partCracks(ctx, x, y, r, color);
}

function drawBossOracleDechue(ctx, e, x, y, r, color, opts, t) {
  drawCreatureBody(ctx, 'boss', x, y, r, color, opts);
  if (opts.flashOnly) return;
  partHood(ctx, x, y, r, color, 0.6);
  partGhostRibbons(ctx, x, y, r, color, t);
  partOrbitingRunes(ctx, x, y, r, '#b34bf2', t, 5, 1.2);
}

function drawBossNecromant(ctx, e, x, y, r, color, opts, t) {
  drawCreatureBody(ctx, 'boss', x, y, r, color, opts);
  if (opts.flashOnly) return;
  partSkull(ctx, x, y, r, color);
  partStaff(ctx, x, y, r, '#8fe3a0');
  partOrbitingRunes(ctx, x, y, r, '#e8e2d0', t, 3, 1.0);
}

function drawBossSpectreAncien(ctx, e, x, y, r, color, opts, t) {
  var ghostOpts = {};
  for (var k in opts) ghostOpts[k] = opts[k];
  ghostOpts.alpha = (opts.alpha != null ? opts.alpha : 1) * 0.75;
  drawCreatureBody(ctx, 'boss', x, y, r, color, ghostOpts);
  if (opts.flashOnly) return;
  partEye(ctx, x, y, r * 0.55, '#bcd8ff', t);
  partGhostRibbons(ctx, x, y, r * 1.3, color, t);
}

// ---------------- 5. Registre + dispatcher ----------------

var ENEMY_RENDERERS = {
  square1: drawBloc, square2: drawBastion, square3: drawColosse, square4: drawGolem, square5: drawTitan,
  triangle1: drawTireur, triangle2: drawArbaletrier, triangle3: drawSniper, triangle4: drawMortier, triangle5: drawOracle,
  circle1: drawRodeur, circle2: drawSangsue, circle3: drawEnflamme, circle4: drawChaman, circle5: drawSpectre,
  boss1: drawBossColossaure, boss2: drawBossGardien, boss3: drawBossOracleDechue, boss4: drawBossNecromant, boss5: drawBossSpectreAncien
};

function drawEnemyCreature(ctx, e, x, y, r, opts) {
  var t = (typeof CB !== 'undefined' && CB) ? CB.elapsed || 0 : 0;
  var color = opts.flashOnly ? '#ffffff' : chapterTintedColor(e.color);
  var renderer = ENEMY_RENDERERS[e.def && e.def.id] || ENEMY_RENDERERS[e.shape + e.tier];
  if (renderer) renderer(ctx, e, x, y, r, color, opts, t);
  else drawCreatureBody(ctx, e.shape, x, y, r, color, opts); // filet de sécurité si un id est inconnu
}
