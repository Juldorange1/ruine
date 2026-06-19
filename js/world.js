/* PUSH HELPER — éjecte un joueur loin d'une case donnée, cherche en spirale */
function pushAway(p,gx,gy){
  function cellFreeForPlayer(nx,ny){
    if(nx<0||nx>=MAP||ny<0||ny>=MAP)return false;
    if(cellOcc(nx,ny))return false;
    // Ne jamais pousser dans une météorite en vol
    if(G.meteors.some(function(m){return !m.fallen&&m.gx===nx&&m.gy===ny;}))return false;
    return true;
  }
  var dirs=[{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1},
            {dx:1,dy:1},{dx:-1,dy:1},{dx:1,dy:-1},{dx:-1,dy:-1},
            {dx:2,dy:0},{dx:-2,dy:0},{dx:0,dy:2},{dx:0,dy:-2}];
  for(var i=0;i<dirs.length;i++){
    var nx=gx+dirs[i].dx,ny=gy+dirs[i].dy;
    if(cellFreeForPlayer(nx,ny)){p.x=nx+.5;p.y=ny+.5;return;}
  }
  // Dernier recours : n'importe quelle case vraiment libre
  for(var fy=0;fy<MAP;fy++)for(var fx=0;fx<MAP;fx++){
    if(cellFreeForPlayer(fx,fy)){p.x=fx+.5;p.y=fy+.5;return;}
  }
}

/* METEORS — plus de météorites, mais effets ambiants toutes les 18 secondes */
function updMeteors(dt){
  G.meteorTimer-=dt;
  if(G.meteorTimer<=0){
    G.meteorTimer=18;
    sfx('meteor');
    setTimeout(function(){sfx('impact');},600);
  }
}

function floodCheck(gx,gy,extra){
  var vis={},q=[{gx:gx,gy:gy}];vis[gx+','+gy]=1;
  while(q.length){var cur=q.shift();var dirs2=[{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
    for(var i=0;i<dirs2.length;i++){var nx=cur.gx+dirs2[i].dx,ny=cur.gy+dirs2[i].dy,k=nx+','+ny;
      if(vis[k]||nx<0||nx>=MAP||ny<0||ny>=MAP)continue;
      if(extra&&extra.gx===nx&&extra.gy===ny)continue;
      if(cellOccSolid(nx,ny))continue;
      vis[k]=1;q.push({gx:nx,gy:ny});}}
  return vis;
}

function spawnMeteor(){
  // Helper: cell already has a pending meteor
  function alreadyTargeted(gx,gy){
    return G.meteors.some(function(m){return !m.fallen&&m.gx===gx&&m.gy===gy;});
  }
  // Helper: cell is currently under a player (never spawn directly on player)
  function onPlayer(gx,gy){
    return G.players.some(function(p){return !p.dead&&Math.floor(p.x)===gx&&Math.floor(p.y)===gy;});
  }

  // ── Case libre aléatoire (jamais sur un joueur) ──
  var free=[];
  for(var gy=0;gy<MAP;gy++)for(var gx=0;gx<MAP;gx++){
    if(cellOcc(gx,gy))continue;
    if(alreadyTargeted(gx,gy))continue;
    if(onPlayer(gx,gy))continue; // ne jamais spawner sur le joueur
    var extra={gx:gx,gy:gy};
    var ok=true;
    G.players.forEach(function(p){
      if(p.dead)return;
      var z0=floodCheck(Math.floor(p.x),Math.floor(p.y),null);
      var z1=floodCheck(Math.floor(p.x),Math.floor(p.y),extra);
      if(Object.keys(z1).length<Object.keys(z0).length*0.5)ok=false;
    });
    if(ok)free.push({gx:gx,gy:gy});
  }
  if(!free.length){G.phase='over';G.phase_over=true;G.winner='PERSONNE';return;}
  var chosen=free[Math.floor(Math.random()*free.length)];
  var _mt=['coal','gold','diamond'][Math.floor(Math.random()*3)];
  G.meteors.push({gx:chosen.gx,gy:chosen.gy,timer:18,fallen:false,cleanAt:0,hp:150,maxHp:150,resType:_mt});
  sfx('meteor');
}

function impactMeteor(m){
  m.fallen=true;m.cleanAt=G.time+5;
  G.players.forEach(function(p){
    if(Math.floor(p.x)===m.gx&&Math.floor(p.y)===m.gy){
      pushAway(p,m.gx,m.gy);
      if(GAMEMODE!=='solo'&&GAMEMODE!=='coop') p.hp=Math.max(1,p.hp-40);
    }
  });
  G.buildings.filter(function(b){return b.gx===m.gx&&b.gy===m.gy;}).forEach(function(k){log(k.label+' detruit !');});
  G.buildings=G.buildings.filter(function(b){return!(b.gx===m.gx&&b.gy===m.gy);});
  G.blocks=G.blocks.filter(function(b){return!(b.gx===m.gx&&b.gy===m.gy);});
  G.piques=G.piques.filter(function(pk){return!(pk.gx===m.gx&&pk.gy===m.gy);});
  // La météorite laisse un minéral aléatoire au lieu d'un cratère
  var rt=m.resType||(['coal','gold','diamond'][Math.floor(Math.random()*3)]);
  var bhp=rt==='diamond'?420:rt==='gold'?280:210;
  G.blocks.push({gx:m.gx,gy:m.gy,x:m.gx+.5,y:m.gy+.5,type:rt,id:rt+Date.now(),hp:bhp,maxHp:bhp});
  sfx('impact');
  // PvP: spawn a random building on a free cell
  if(GAMEMODE==='pvp') setTimeout(spawnPvpBuilding, 300);
}

function spawnPvpBuilding(){
  if(!G||G.phase!=='combat') return;
  var types=['teleporter','drill','bank'];
  var type=types[Math.floor(Math.random()*types.length)];
  // Find a free cell anywhere
  var candidates=[];
  for(var gy2=1;gy2<MAP-1;gy2++) for(var gx2=1;gx2<MAP-1;gx2++){
    if(cellOcc(gx2,gy2)) continue;
    if(G.meteors.some(function(m){return !m.fallen&&m.gx===gx2&&m.gy===gy2;})) continue;
    if(G.players.some(function(p){return !p.dead&&Math.floor(p.x)===gx2&&Math.floor(p.y)===gy2;})) continue;
    // No adjacency constraint for drills
    candidates.push({gx:gx2,gy:gy2});
  }
  // If drill has no valid spot, switch to teleporter or bank
  if(!candidates.length && type==='drill'){
    type=Math.random()<0.5?'teleporter':'bank';
    candidates=[];
    for(var gy3=1;gy3<MAP-1;gy3++) for(var gx3=1;gx3<MAP-1;gx3++){
      if(!cellOcc(gx3,gy3)&&!G.players.some(function(p){return !p.dead&&Math.floor(p.x)===gx3&&Math.floor(p.y)===gy3;})) candidates.push({gx:gx3,gy:gy3});
    }
  }
  if(!candidates.length) return;
  var pick=candidates[Math.floor(Math.random()*candidates.length)];
  addBd(type,pick.gx,pick.gy,0);
  sfx('place');
  log('Un '+{teleporter:'TELEPORTEUR',drill:'FOREUSE',bank:'MAGAZIN'}[type]+' apparait !');
}

/* SURVIVANT — vagues d'ennemis qui détruisent les minerais les plus proches */
function mkEnemy(gx,gy,wave){
  var hp=22+Math.floor(wave*1.5);
  return{gx:gx,gy:gy,x:gx+.5,y:gy+.5,hp:hp,maxHp:hp,
    speed:0.55+Math.min(wave*0.015,0.5),target:null,dmgRate:18+wave*1.5};
}
function _survivorBorderCell(){
  var side=Math.floor(Math.random()*4),gx,gy;
  if(side===0){gx=Math.floor(Math.random()*MAP);gy=0;}
  else if(side===1){gx=Math.floor(Math.random()*MAP);gy=MAP-1;}
  else if(side===2){gx=0;gy=Math.floor(Math.random()*MAP);}
  else{gx=MAP-1;gy=Math.floor(Math.random()*MAP);}
  return{gx:gx,gy:gy};
}
function _survivorSpawnWave(){
  if(!G)return;
  _survivorWave++;
  var n=_survivorWave;
  for(var i=0;i<n;i++){
    var c=_survivorBorderCell();
    G.enemies.push(mkEnemy(c.gx,c.gy,_survivorWave));
  }
  log(t('survivor_wave')+' '+n);
}
function updEnemies(dt){
  if(!G||!G.enemies||!G.enemies.length)return;
  G.enemies.forEach(function(en){
    if(!en.target||G.blocks.indexOf(en.target)===-1){
      var best=null,bd=99999;
      G.blocks.forEach(function(b){
        var d=Math.hypot(en.x-(b.gx+0.5),en.y-(b.gy+0.5));
        if(d<bd){bd=d;best=b;}
      });
      en.target=best;
    }
    if(!en.target)return;
    var tb=en.target;
    var tx=tb.gx+0.5,ty=tb.gy+0.5;
    var dx=tx-en.x,dy=ty-en.y,dist=Math.hypot(dx,dy);
    if(dist>0.75){
      en.x+=dx/dist*en.speed*dt;en.y+=dy/dist*en.speed*dt;
      en.gx=Math.floor(en.x);en.gy=Math.floor(en.y);
    } else {
      tb.hp-=en.dmgRate*dt;
      if(tb.hp<=0){
        G.blocks=G.blocks.filter(function(b){return b!==tb;});
        en.target=null;
      }
    }
  });
}

function updPiques(dt){
  G.players.forEach(function(p){
    if(p.dead)return;
    G.piques.forEach(function(pk){
      if(Math.floor(p.x)===pk.gx&&Math.floor(p.y)===pk.gy){
        p.hp=Math.max(0,p.hp-pk.dmg*dt);
        if(p.hp<=0&&!p.dead){p.dead=true;sfx('death');log(p.name+' meurt sur une pique !');}
      }
    });
  });
}
