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

/* METEORS */
function updMeteors(dt){
  G.meteorTimer-=dt;
  if(G.meteorTimer<=0){G.meteorTimer=18;spawnMeteor();}
  G.meteors.forEach(function(m){
    if(!m.fallen){
      m.timer-=dt;
      // Emergency push: player on impact cell — push to nearest free cell
      if(m.timer<1){
        G.players.forEach(function(p){
          if(p.dead)return;
          if(Math.floor(p.x)===m.gx&&Math.floor(p.y)===m.gy){
            pushAway(p,m.gx,m.gy);
          }
        });
      }
      if(m.timer<=0)impactMeteor(m);
    }
  });
  G.meteors=G.meteors.filter(function(m){return!m.fallen||(m.cleanAt>G.time);});
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

  if(survivorMode){
    // ── Mode Survivant : le joueur choisit la cible ──
    // Vérifier qu'il existe au moins une cible valide
    var hasDrillTarget=G.buildings.some(function(bd){
      return (bd.type==='drill'||bd.type==='drillfast')&&!alreadyTargeted(bd.gx,bd.gy);
    });
    var hasBlockTarget=G.blocks.some(function(bl){return !alreadyTargeted(bl.gx,bl.gy);});
    if(!hasDrillTarget&&!hasBlockTarget){G.phase='over';G.phase_over=true;G.winner='TIME';return;}
    // Suspendre le jeu et demander au joueur de cliquer une cible
    // Fin de partie si 60 météorites ont déjà été planifiées
    if(survivorMeteorCount>=60){G.phase='over';G.phase_over=true;G.winner='TIME';return;}
    survivorMeteorCount++;
    survivorPickMode=true;
    survivorPickStartTime=Date.now();
    return;
  }

  // ── Mode normal : case libre aléatoire (jamais sur un joueur) ──
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
  G.meteors.push({gx:chosen.gx,gy:chosen.gy,timer:18,fallen:false,cleanAt:0,hp:150,maxHp:150});
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
  if(!G.destroyed.some(function(d){return d.gx===m.gx&&d.gy===m.gy;}))G.destroyed.push({gx:m.gx,gy:m.gy});
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
