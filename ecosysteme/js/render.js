// Rendu canvas : grille hexagonale texturée, éclairage saisonnier, météo ambiante, menaces, sélection.

var HEX_SIZE = 34;
var cam = { x:0, y:0, zoom:1 };
var canvas, ctx;
var animT = 0;
var lastFrameTime = 0;
var ambientParticles = [];

var SEASON_TINT = [
  'rgba(150,220,120,0.05)',   // printemps — vert frais
  'rgba(255,210,90,0.06)',    // été — doré chaud
  'rgba(230,140,60,0.07)',    // automne — orangé
  'rgba(170,200,230,0.10)'    // hiver — bleu froid
];

function initRender(){
  canvas = document.getElementById('board');
  ctx = canvas.getContext('2d');
  buildTerrainTextures();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas(){
  var wrap = document.getElementById('boardWrap');
  var dpr = window.devicePixelRatio || 1;
  var w = wrap.clientWidth, h = wrap.clientHeight;
  canvas.width = w*dpr; canvas.height = h*dpr;
  canvas.style.width = w+'px'; canvas.style.height = h+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
}

function worldToScreen(x,y){
  return { x: canvas.clientWidth/2 + (x-cam.x)*cam.zoom, y: canvas.clientHeight/2 + (y-cam.y)*cam.zoom };
}
function screenToWorld(sx,sy){
  return { x: (sx - canvas.clientWidth/2)/cam.zoom + cam.x, y: (sy - canvas.clientHeight/2)/cam.zoom + cam.y };
}

function tileAtScreen(sx, sy){
  var w = screenToWorld(sx,sy);
  var ax = pixelToAxial(w.x, w.y, HEX_SIZE);
  return G.tiles[axialKey(ax.q, ax.r)] || null;
}

// ---- PRNG déterministe (pour textures reproductibles) ----
function mulberry32(seed){
  return function(){
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed>>>15, 1 | seed);
    t = t + Math.imul(t ^ t>>>7, 61 | t) ^ t;
    return ((t ^ t>>>14) >>> 0) / 4294967296;
  };
}
function hashTile(q,r){
  var h = (q*374761393 + r*668265263) ^ (q*2246822519);
  h = (h ^ (h >>> 13)) >>> 0;
  return h;
}

// ---- Textures procédurales par terrain (générées une fois, mises en cache) ----
var TEX_SIZE = 128;
var TERRAIN_TEXTURES = null;

function buildTerrainTextures(){
  TERRAIN_TEXTURES = {};
  for (var terrainId in TERRAINS){
    TERRAIN_TEXTURES[terrainId] = [0,1,2].map(function(variant){
      return renderTerrainTexture(terrainId, variant);
    });
  }
}

function mkCanvas(){
  var c = document.createElement('canvas');
  c.width = TEX_SIZE; c.height = TEX_SIZE;
  return c;
}

function renderTerrainTexture(terrainId, variant){
  var c = mkCanvas();
  var x = c.getContext('2d');
  var rand = mulberry32(terrainId.length*97 + variant*733 + 17);
  var S = TEX_SIZE;

  if (terrainId === 'plaine'){
    var g = x.createLinearGradient(0,0,0,S);
    g.addColorStop(0, '#3f5230'); g.addColorStop(1, '#2c3a20');
    x.fillStyle = g; x.fillRect(0,0,S,S);
    for (var i=0;i<110;i++){
      var bx = rand()*S, by = rand()*S, len = 4+rand()*7, ang = -1.3+rand()*0.6;
      var shade = rand();
      x.strokeStyle = shade < 0.5 ? 'rgba(120,160,80,'+(0.25+rand()*0.3)+')' : 'rgba(60,90,45,'+(0.3+rand()*0.3)+')';
      x.lineWidth = 1+rand();
      x.beginPath(); x.moveTo(bx,by); x.lineTo(bx+Math.cos(ang)*len, by+Math.sin(ang)*len); x.stroke();
    }
    for (var f=0; f<7; f++){
      x.fillStyle = 'rgba(230,220,140,'+(0.35+rand()*0.3)+')';
      x.beginPath(); x.arc(rand()*S, rand()*S, 1+rand()*1.2, 0, 7); x.fill();
    }
  }
  else if (terrainId === 'foret'){
    var g2 = x.createLinearGradient(0,0,0,S);
    g2.addColorStop(0, '#233826'); g2.addColorStop(1, '#152018');
    x.fillStyle = g2; x.fillRect(0,0,S,S);
    for (var j=0;j<16;j++){
      var cx = rand()*S, cy = rand()*S, r = 14+rand()*22;
      var rg = x.createRadialGradient(cx,cy,0,cx,cy,r);
      var dark = rand() < 0.5;
      rg.addColorStop(0, dark ? 'rgba(20,32,20,0.55)' : 'rgba(70,110,55,0.4)');
      rg.addColorStop(1, 'rgba(20,32,20,0)');
      x.fillStyle = rg;
      x.beginPath(); x.arc(cx,cy,r,0,7); x.fill();
    }
  }
  else if (terrainId === 'humide'){
    var g3 = x.createLinearGradient(0,0,0,S);
    g3.addColorStop(0, '#255560'); g3.addColorStop(1, '#123038');
    x.fillStyle = g3; x.fillRect(0,0,S,S);
    for (var w=0; w<6; w++){
      var yy = rand()*S;
      x.strokeStyle = 'rgba(190,230,235,'+(0.12+rand()*0.15)+')';
      x.lineWidth = 1+rand()*1.5;
      x.beginPath();
      for (var xx=0; xx<=S; xx+=8){
        var yOff = yy + Math.sin(xx*0.09 + w)*4;
        xx===0 ? x.moveTo(xx,yOff) : x.lineTo(xx,yOff);
      }
      x.stroke();
    }
    for (var rd=0; rd<4; rd++){
      x.strokeStyle = 'rgba(40,70,50,0.5)';
      x.lineWidth = 2;
      var rxx = rand()*S, ryy = S-rand()*14;
      x.beginPath(); x.moveTo(rxx,ryy); x.lineTo(rxx+rand()*4-2, ryy-8-rand()*8); x.stroke();
    }
  }
  else if (terrainId === 'rocheux'){
    var g4 = x.createLinearGradient(0,0,0,S);
    g4.addColorStop(0, '#4d483d'); g4.addColorStop(1, '#302c22');
    x.fillStyle = g4; x.fillRect(0,0,S,S);
    for (var k=0;k<18;k++){
      var pxx = rand()*S, pyy = rand()*S, pr = 6+rand()*12;
      var pts = [];
      var n = 5+Math.floor(rand()*3);
      for (var pi=0; pi<n; pi++){
        var pa = (pi/n)*Math.PI*2 + rand()*0.4;
        pts.push([pxx+Math.cos(pa)*pr*(0.7+rand()*0.3), pyy+Math.sin(pa)*pr*(0.7+rand()*0.3)]);
      }
      x.fillStyle = 'rgba(0,0,0,0.18)';
      x.beginPath(); pts.forEach(function(p,pi2){ pi2===0?x.moveTo(p[0]+1.5,p[1]+1.5):x.lineTo(p[0]+1.5,p[1]+1.5); }); x.closePath(); x.fill();
      x.fillStyle = rand()<0.5 ? 'rgba(150,142,120,0.35)' : 'rgba(90,84,70,0.4)';
      x.beginPath(); pts.forEach(function(p,pi2){ pi2===0?x.moveTo(p[0],p[1]):x.lineTo(p[0],p[1]); }); x.closePath(); x.fill();
    }
  }
  else if (terrainId === 'aride'){
    var g5 = x.createLinearGradient(0,0,0,S);
    g5.addColorStop(0, '#6a4f28'); g5.addColorStop(1, '#42300f');
    x.fillStyle = g5; x.fillRect(0,0,S,S);
    for (var d=0; d<9; d++){
      var dy = rand()*S;
      x.strokeStyle = 'rgba(255,220,150,'+(0.08+rand()*0.12)+')';
      x.lineWidth = 1+rand()*2;
      x.beginPath();
      for (var dx2=0; dx2<=S; dx2+=10){
        var yOff2 = dy + Math.sin(dx2*0.05+d*2)*6;
        dx2===0 ? x.moveTo(dx2,yOff2) : x.lineTo(dx2,yOff2);
      }
      x.stroke();
    }
    for (var sp=0; sp<20; sp++){
      x.fillStyle = 'rgba(40,25,10,'+(0.15+rand()*0.2)+')';
      x.beginPath(); x.arc(rand()*S, rand()*S, 0.6+rand()*1.4, 0, 7); x.fill();
    }
  }
  return c;
}

// ---- Boucle de dessin ----
function drawFrame(){
  if (!G) return;
  var now = performance.now();
  var dt = lastFrameTime ? Math.min(0.1,(now-lastFrameTime)/1000) : 0;
  lastFrameTime = now;
  animT += dt;

  ctx.clearRect(0,0,canvas.clientWidth, canvas.clientHeight);
  ctx.save();

  var towers = [];
  for (var key0 in G.tiles){
    var t0 = G.tiles[key0];
    if (t0.unlocked && t0.building === 'tour' && !t0.buildingDormant) towers.push(t0);
  }

  for (var key in G.tiles){
    var t = G.tiles[key];
    var visible = t.unlocked || neighborTiles(t).some(function(n){ return n.unlocked; });
    if (!visible && towers.length){
      visible = towers.some(function(tw){ return axialDistance(t, tw) <= 3; });
    }
    if (!visible) continue;
    drawTile(t);
  }
  ctx.restore();

  drawSeasonLighting();
  updateAndDrawAmbientParticles(dt);
  drawVignette();
}

function drawSeasonLighting(){
  var seasonIdx = G.turn % 4;
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = SEASON_TINT[seasonIdx];
  ctx.fillRect(0,0,canvas.clientWidth, canvas.clientHeight);
  if (G.droughtActive){
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = 'rgba(255,160,60,0.08)';
    ctx.fillRect(0,0,canvas.clientWidth, canvas.clientHeight);
  }
  ctx.restore();
}

function drawVignette(){
  var w = canvas.clientWidth, h = canvas.clientHeight;
  var g = ctx.createRadialGradient(w/2,h/2, Math.min(w,h)*0.35, w/2,h/2, Math.max(w,h)*0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0,0,w,h);
  ctx.restore();
}

function drawTile(t){
  var p = axialToPixel(t.q, t.r, HEX_SIZE);
  var s = worldToScreen(p.x, p.y);
  var size = HEX_SIZE*cam.zoom;
  if (s.x < -size*2 || s.x > canvas.clientWidth+size*2 || s.y < -size*2 || s.y > canvas.clientHeight+size*2) return;

  var corners = hexCorners(s.x, s.y, size-1.2);
  ctx.beginPath();
  corners.forEach(function(pt,i){ i===0 ? ctx.moveTo(pt[0],pt[1]) : ctx.lineTo(pt[0],pt[1]); });
  ctx.closePath();

  if (!t.unlocked){
    ctx.save();
    ctx.clip();
    var fogGrad = ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,size*1.1);
    fogGrad.addColorStop(0, 'rgba(50,58,48,0.55)');
    fogGrad.addColorStop(1, 'rgba(18,22,16,0.7)');
    ctx.fillStyle = fogGrad;
    ctx.fillRect(s.x-size, s.y-size, size*2, size*2);
    ctx.restore();
    ctx.strokeStyle = 'rgba(140,150,130,0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (size > 15){
      ctx.globalAlpha = 0.55 + Math.sin(animT*1.4 + hashTile(t.q,t.r))*0.12;
      ctx.fillStyle = '#c9d4bd';
      ctx.font = (size*0.52)+'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🔒', s.x, s.y);
      ctx.globalAlpha = 1;
    }
    return;
  }

  var variant = hashTile(t.q, t.r) % 3;
  var tex = TERRAIN_TEXTURES[t.terrain][variant];
  ctx.save();
  ctx.clip();
  ctx.drawImage(tex, s.x-size, s.y-size, size*2, size*2);

  var fertGlow = t.fertility/100;
  if (fertGlow > 0.35){
    var fg = ctx.createRadialGradient(s.x, s.y-size*0.2, 0, s.x, s.y, size*1.1);
    fg.addColorStop(0, 'rgba(140,230,120,'+((fertGlow-0.35)*0.28)+')');
    fg.addColorStop(1, 'rgba(140,230,120,0)');
    ctx.fillStyle = fg;
    ctx.fillRect(s.x-size, s.y-size, size*2, size*2);
  }

  if (t.dead){
    ctx.fillStyle = 'rgba(60,45,35,0.55)';
    ctx.fillRect(s.x-size, s.y-size, size*2, size*2);
  }

  if (t.fire){
    var flick = 0.28 + Math.sin(animT*9 + hashTile(t.q,t.r))*0.08;
    var fireGrad = ctx.createRadialGradient(s.x, s.y+size*0.2, 0, s.x, s.y, size*1.15);
    fireGrad.addColorStop(0, 'rgba(255,140,30,'+flick+')');
    fireGrad.addColorStop(1, 'rgba(200,40,10,0.05)');
    ctx.fillStyle = fireGrad;
    ctx.fillRect(s.x-size, s.y-size, size*2, size*2);
    drawEmbers(s, size, t);
  }
  if (t.invasion){
    var pulse = 0.26 + Math.sin(animT*2.2 + hashTile(t.q,t.r))*0.08;
    ctx.fillStyle = 'rgba(150,20,170,'+pulse+')';
    ctx.fillRect(s.x-size, s.y-size, size*2, size*2);
    drawSpores(s, size, t);
  }
  ctx.restore();

  var selected = G.selected === t.key;
  ctx.strokeStyle = selected ? '#ffe066' : 'rgba(0,0,0,0.38)';
  ctx.lineWidth = selected ? 2.6 : 1;
  if (selected){
    ctx.save();
    ctx.shadowColor = 'rgba(255,224,102,0.9)';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.stroke();
  }

  if (t.dead){
    ctx.fillStyle = 'rgba(230,220,200,0.6)';
    ctx.font = (size*0.5)+'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🥀', s.x, s.y);
    return;
  }
  if (t.invasion){
    ctx.font = (size*0.62)+'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🦗', s.x, s.y + Math.sin(animT*6+hashTile(t.q,t.r))*size*0.05);
    return;
  }
  if (t.building){
    drawGroundShadow(s, size*0.42);
    var bc = hexCorners(s.x, s.y, size*0.5);
    ctx.beginPath();
    bc.forEach(function(pt,i){ i===0 ? ctx.moveTo(pt[0],pt[1]) : ctx.lineTo(pt[0],pt[1]); });
    ctx.closePath();
    var active = !t.buildingDormant;
    ctx.fillStyle = active ? 'rgba(255,215,107,0.20)' : 'rgba(80,80,80,0.45)';
    ctx.fill();
    if (active){
      ctx.save();
      ctx.shadowColor = 'rgba(255,215,107,0.55)';
      ctx.shadowBlur = 6 + Math.sin(animT*1.6)*2;
      ctx.strokeStyle = 'rgba(255,215,107,0.75)';
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.strokeStyle = 'rgba(150,150,150,0.5)';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
    ctx.globalAlpha = active ? 1 : 0.5;
    ctx.font = (size*0.6)+'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(BUILDINGS[t.building].emoji, s.x, s.y);
    ctx.globalAlpha = 1;
    return;
  }
  if (t.species){
    var sp = SPECIES[t.species];
    var bob = Math.sin(animT*1.8 + hashTile(t.q,t.r))*size*0.045;
    drawGroundShadow(s, size*0.34);
    ctx.font = (size*0.66)+'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(sp.emoji, s.x, s.y+bob);

    var hungerFrac = Math.min(1, t.hunger/HUNGER_DEATH);
    if (hungerFrac > 0.15 && size > 14){
      drawHungerRing(s, size, hungerFrac);
    }
    var lvl = mutLevel(t.species);
    if (lvl > 0 && size > 14){
      ctx.save();
      ctx.shadowColor = 'rgba(255,224,102,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillStyle = '#ffe066';
      ctx.font = 'bold '+(size*0.26)+'px sans-serif';
      ctx.fillText('★'.repeat(lvl), s.x, s.y+size*0.6);
      ctx.restore();
    }
  }
}

function drawGroundShadow(s, r){
  ctx.save();
  var g = ctx.createRadialGradient(s.x, s.y+r*0.35, 0, s.x, s.y+r*0.35, r);
  g.addColorStop(0, 'rgba(0,0,0,0.32)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(s.x, s.y+r*0.35, r, r*0.42, 0, 0, 7); ctx.fill();
  ctx.restore();
}

function drawHungerRing(s, size, frac){
  var r = size*0.78;
  var color = frac < 0.5 ? '#ffd166' : (frac < 0.8 ? '#ff9f4d' : '#ff5c5c');
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(s.x, s.y, r, -Math.PI/2, Math.PI*2-Math.PI/2); ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.arc(s.x, s.y, r, -Math.PI/2, -Math.PI/2 + frac*Math.PI*2); ctx.stroke();
  ctx.restore();
}

function drawEmbers(s, size, t){
  var seed = hashTile(t.q,t.r);
  for (var i=0;i<3;i++){
    var ph = (animT*0.6 + i*0.33 + seed*0.0001) % 1;
    var ex = s.x + Math.sin(seed+i)*size*0.3;
    var ey = s.y + size*0.5 - ph*size*1.3;
    ctx.fillStyle = 'rgba(255,'+(140+Math.floor(80*(1-ph)))+',60,'+(1-ph)*0.8+')';
    ctx.beginPath(); ctx.arc(ex, ey, 1.4+ (1-ph)*1.5, 0, 7); ctx.fill();
  }
}

function drawSpores(s, size, t){
  var seed = hashTile(t.q,t.r);
  for (var i=0;i<3;i++){
    var ang = animT*0.5 + i*2.1 + seed*0.0001;
    var rad = size*0.35 + Math.sin(animT+i)*size*0.1;
    var ex = s.x + Math.cos(ang)*rad;
    var ey = s.y + Math.sin(ang)*rad*0.6;
    ctx.fillStyle = 'rgba(210,140,230,0.55)';
    ctx.beginPath(); ctx.arc(ex, ey, 1.6, 0, 7); ctx.fill();
  }
}

// ---- Météo ambiante (espace écran) ----
function ambientKindForSeason(){
  if (!G) return null;
  if (G.droughtActive) return 'dust';
  var seasonIdx = G.turn % 4;
  return ['rain','dust','leaves','snow'][seasonIdx];
}

function spawnAmbientParticle(kind, w, h){
  if (kind === 'rain'){
    return { kind:kind, x:Math.random()*w, y:-10, vx:-40, vy:520+Math.random()*160, life:3, size:1 };
  }
  if (kind === 'snow'){
    return { kind:kind, x:Math.random()*w, y:-10, vx:(Math.random()-0.5)*20, vy:26+Math.random()*30, life:8, size:1.5+Math.random()*1.8, sway:Math.random()*6 };
  }
  if (kind === 'leaves'){
    return { kind:kind, x:Math.random()*w, y:-10, vx:(Math.random()-0.5)*30, vy:35+Math.random()*25, life:7, size:3+Math.random()*2, rot:Math.random()*7, spin:(Math.random()-0.5)*3 };
  }
  if (kind === 'dust'){
    return { kind:kind, x:Math.random()*w, y:Math.random()*h, vx:18+Math.random()*22, vy:(Math.random()-0.5)*6, life:5, size:1+Math.random()*1.5 };
  }
  return null;
}

function updateAndDrawAmbientParticles(dt){
  var w = canvas.clientWidth, h = canvas.clientHeight;
  var kind = ambientKindForSeason();
  var targetCount = kind ? (kind==='dust' ? 26 : (kind==='rain' ? 70 : 34)) : 0;

  if (kind && ambientParticles.length < targetCount && Math.random() < 0.9){
    var p = spawnAmbientParticle(kind, w, h);
    if (p) ambientParticles.push(p);
  }

  ctx.save();
  ambientParticles = ambientParticles.filter(function(p){
    p.x += p.vx*dt; p.y += p.vy*dt; p.life -= dt;
    if (p.rot !== undefined) p.rot += p.spin*dt;
    if (p.y > h+20 || p.x < -20 || p.x > w+20 || p.life <= 0) return false;

    if (p.kind === 'rain'){
      ctx.strokeStyle = 'rgba(180,210,230,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x+p.vx*0.02, p.y+p.vy*0.02); ctx.stroke();
    } else if (p.kind === 'snow'){
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      var sx = p.x + Math.sin(animT*1.5+p.sway)*8;
      ctx.beginPath(); ctx.arc(sx, p.y, p.size, 0, 7); ctx.fill();
    } else if (p.kind === 'leaves'){
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = 'rgba(210,130,50,0.7)';
      ctx.beginPath(); ctx.ellipse(0,0,p.size,p.size*0.6,0,0,7); ctx.fill();
      ctx.restore();
    } else if (p.kind === 'dust'){
      ctx.fillStyle = 'rgba(220,190,140,0.25)';
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,7); ctx.fill();
    }
    return true;
  });
  ctx.restore();
}

function mixColor(hex1, hex2, t){
  if (t<=0) return hex1;
  var c1 = hexToRgb(hex1), c2 = hexToRgb(hex2);
  var r = Math.round(c1.r+(c2.r-c1.r)*t);
  var g = Math.round(c1.g+(c2.g-c1.g)*t);
  var b = Math.round(c1.b+(c2.b-c1.b)*t);
  return 'rgb('+r+','+g+','+b+')';
}
function hexToRgb(hex){
  hex = hex.replace('#','');
  return { r:parseInt(hex.substr(0,2),16), g:parseInt(hex.substr(2,2),16), b:parseInt(hex.substr(4,2),16) };
}
