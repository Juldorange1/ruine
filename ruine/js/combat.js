/* COMBAT */
function updCombat(dt){
  var pl=G.players;
  var SPEAR_RANGE=0.5; // half of old 1.0
  var SPEAR_RATE=1.0;  // 1 strike per second
  // Update spear timers
  pl.forEach(function(p){
    if(p.dead)return;
    p.spearTimer=Math.max(0,(p.spearTimer||0)-dt);
    // Advance swing animation
    if((p.spearSwing||0)>0){p.spearSwing=Math.max(0,p.spearSwing-dt*5);}
  });
  // No auto-attack — only manual spear strikes via right-click
  pl.forEach(function(p){
    if(p.dead)return;
    if((p.combatTimer-=dt)<=0)p.inCombat=false;
    if(!p.inCombat&&p.hp<p.maxHp&&!p.dead)p.hp=Math.min(p.maxHp,p.hp+p.regen*dt);
    if(p.hp<=0&&!p.dead){p.dead=true;sfx('death');log(p.name+' est mort !');}
  });
  if(GAMEMODE!=='solo'&&GAMEMODE!=='survivor'&&GAMEMODE!=='boss'){
    if(G.p1.dead&&!G.phase_over){G.phase='over';G.phase_over=true;G.winner='P2';}
    if(G.p2&&G.p2.dead&&!G.phase_over){G.phase='over';G.phase_over=true;G.winner='P1';}
  }
}

function updBdAtk(dt){} // replaced by spear system

function updBlkAtk(dt){} // replaced by spear system

// ── LANCER DE PIERRE ──
function spearStrike(actor, worldX, worldY){
  if(!G||!gameRunning||G.phase!=='combat')return;
  if((actor.spearTimer||0)>0)return;
  actor.spearTimer=1.0;
  actor.spearSwing=1;
  var dx=worldX-actor.x, dy=worldY-actor.y;
  var dist=Math.hypot(dx,dy)||1;
  actor.spearDir=Math.atan2(dy,dx);
  var RANGE=1.3; // portée +30%
  var tDist=Math.min(dist,RANGE);
  var tx=actor.x+(dx/dist)*tDist;
  var ty=actor.y+(dy/dist)*tDist;
  var speed=3.5; // cases/seconde (lent — on voit bien le trajet)
  var travelDist=Math.hypot(tx-actor.x,ty-actor.y);
  var totalTime=Math.max(travelDist/speed,0.04);
  G.rocks.push({ox:actor.x,oy:actor.y,x:actor.x,y:actor.y,
    tx:tx,ty:ty,owner:actor,time:0,totalTime:totalTime,done:false});
}

function applyRockHit(rock){
  var RANGE=0.3; // zone d'impact minuscule — précision requise
  var kx=rock.tx,ky=rock.ty,actor=rock.owner;
  // Le boss a la priorité absolue : si l'impact est dans sa zone, seul lui est touché
  // (même si une foreuse/un minerai/un portail se trouve aussi à cet endroit)
  // Hitbox elliptique identique pour les 10 apparences, calée sur la forme/taille du sprite
  if(GAMEMODE==='boss'){
    var _bhdx=(kx-MAP/2)/BOSS_HITBOX_RX,_bhdy=(ky-MAP/2)/BOSS_HITBOX_RY;
    if(_bhdx*_bhdx+_bhdy*_bhdy<=1){
      bossDmgDealt+=actor.dmg;
      bossHitFlashTimer=0.25; // ne rougit que l'apparence du boss, jamais sa hitbox ni l'écran
      sfx('strike');
      return;
    }
  }
  var bestDist=RANGE,bestTarget=null,bestType=null;
  G.players.forEach(function(p){
    if(p===actor||p.dead||p.team===actor.team)return;
    var d=Math.hypot(p.x-kx,p.y-ky);
    if(d<RANGE&&d<bestDist){bestDist=d;bestTarget=p;bestType='player';}
  });
  G.buildings.forEach(function(bd){
    if(bd.type==='factory'||bd.type==='bank')return;
    var d=Math.hypot(bd.x-kx,bd.y-ky);
    if(d<RANGE&&d<bestDist){bestDist=d;bestTarget=bd;bestType='building';}
  });
  G.blocks.forEach(function(bl){
    var d=Math.hypot(bl.x-kx,bl.y-ky);
    if(d<RANGE&&d<bestDist){bestDist=d;bestTarget=bl;bestType='block';}
  });
  G.meteors.forEach(function(m){
    if(m.fallen)return;
    var d=Math.hypot(m.gx+.5-kx,m.gy+.5-ky);
    if(d<RANGE&&d<bestDist){bestDist=d;bestTarget=m;bestType='meteor';}
  });
  if(G.enemies)G.enemies.forEach(function(en){
    var d=Math.hypot(en.x-kx,en.y-ky);
    if(d<RANGE&&d<bestDist){bestDist=d;bestTarget=en;bestType='enemy';}
  });
  if(!bestTarget)return;
  bestTarget.hitFlash=0.2; // flash rouge temporaire pour confirmer l'impact
  if(bestType==='player'){
    bestTarget.hp=Math.max(0,bestTarget.hp-actor.dmg);
    bestTarget.inCombat=true;bestTarget.combatTimer=0.5;
    actor.inCombat=true;actor.combatTimer=0.5;
    sfx('damage');
    if(bestTarget.hp<=0&&!bestTarget.dead){bestTarget.dead=true;}
  } else if(bestType==='building'){
    sfx('strike');
    bestTarget.hp=Math.max(0,bestTarget.hp-actor.dmg);
    if(bestTarget.hp<=0){G.buildings=G.buildings.filter(function(b){return b.id!==bestTarget.id;});}
  } else if(bestType==='block'){
    sfx('strike');
    bestTarget.hp=Math.max(0,bestTarget.hp-actor.dmg);
    if(bestTarget.hp<=0){G.blocks=G.blocks.filter(function(b){return b.id!==bestTarget.id;});}
  } else if(bestType==='enemy'){
    sfx('strike');
    bestTarget.hp=Math.max(0,bestTarget.hp-actor.dmg);
    if(bestTarget.hp<=0){
      G.enemies=G.enemies.filter(function(e){return e!==bestTarget;});
      _survivorKillsThisGame=(_survivorKillsThisGame||0)+1;
      sfx('death');
    }
  }
}

function updRocks(dt){
  if(!G||!G.rocks)return;
  G.rocks.forEach(function(rock){
    if(rock.done)return;
    rock.time+=dt;
    var t=Math.min(rock.time/rock.totalTime,1);
    rock.x=rock.ox+(rock.tx-rock.ox)*t;
    rock.y=rock.oy+(rock.ty-rock.oy)*t;
    if(t>=1){rock.done=true;applyRockHit(rock);}
  });
  G.rocks=G.rocks.filter(function(r){return !r.done;});
  // Décompte du flash rouge d'impact sur toutes les cibles touchées
  function _tickFlash(o){if(o.hitFlash>0)o.hitFlash=Math.max(0,o.hitFlash-dt);}
  G.players.forEach(_tickFlash);
  G.buildings.forEach(_tickFlash);
  G.blocks.forEach(_tickFlash);
  if(G.enemies)G.enemies.forEach(_tickFlash);
}


function updMetAtk(dt){}

function updDrills(dt){
  if(_selectionPending)return;
  G.buildings.forEach(function(bd){
    if(bd.type!=='drill'&&bd.type!=='drillfast')return;
    bd.drillTimer=(bd.drillTimer||0)+dt;
    var drillInterval=bd.type==='drillfast'?2.5:5;
    if(bd.drillTimer<drillInterval)return;
    bd.drillTimer=0;
    var fx=bd.facing==='right'?1:bd.facing==='left'?-1:0;
    var fy=bd.facing==='down'?1:bd.facing==='up'?-1:0;
    var res=G.blocks.filter(function(b){return b.gx===bd.gx+fx&&b.gy===bd.gy+fy;})[0];
    if(res){
      bd.stored[res.type]=(bd.stored[res.type]||0)+1;
    }
  });
}

/* INTERACT */
function activateBd(bd,p){
  if(bd.type==='factory'){openShop('factory',p);}
  else if(bd.type==='drill'||bd.type==='drillfast'){
    var c=bd.stored.coal||0,g=bd.stored.gold||0,d=bd.stored.diamond||0;
    if(c||g||d){p.coal+=c;p.gold+=g;p.diamond=(p.diamond||0)+d;bd.stored={coal:0,gold:0,diamond:0};sfx('collect');log('+'+c+'C +'+g+'G +'+d+'D');}
    else log('Foreuse vide');
  }
  else if(bd.type==='teleporter'){
    if((p.diamond||0)<1){log('Il faut 1 diamant pour teleporter !');return;}
    var tps=G.buildings.filter(function(b){return b.type==='teleporter';});
    if(tps.length<2){log('Il faut 2 teleporteurs !');return;}
    tpMode=true;tpSrc=bd;tpPlayer=p;
    log('TP actif (cout: 1 diamant) - clic sur autre TP');
  }
  else if(bd.type==='portal'){
    p.x=bd.x;p.y=bd.y;sfx('tp');log(p.name+' téléporté au portail !');
  }
}
