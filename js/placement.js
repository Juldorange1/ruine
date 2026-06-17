/* PLACEMENT */
function startPlacement(){
  placeGen++;
  placeQueue=[];
  if(GAMEMODE==='solo'){
    for(var i=0;i<4;i++)placeQueue.push({who:'p1',type:'drill'});
  } else if(GAMEMODE==='coop'){
    // Each player places 2 drills, no teleporters in coop
    placeQueue.push({who:'p1',type:'drill'});
    placeQueue.push({who:'p2',type:'drill'});
    placeQueue.push({who:'p1',type:'drill'});
    placeQueue.push({who:'p2',type:'drill'});
  } else {
    placeQueue.push({who:'p1',type:'drill'});
    placeQueue.push({who:'p2',type:'drill'});
    placeQueue.push({who:'p1',type:'drill'});
    placeQueue.push({who:'p2',type:'drill'});
    placeQueue.push({who:'p1',type:'teleporter'});
    placeQueue.push({who:'p2',type:'teleporter'});
  }
  var _pov=document.getElementById('place-overlay');
  if(_pov)_pov.style.display='block';
  nextPlace();
}

function _showPlaceInfo(txt){
  var el=document.getElementById('placeind');
  if(el){el.textContent='PLACER : '+txt;el.style.display='block';}
}
function _hidePlaceInfo(){
  var el=document.getElementById('placeind');if(el)el.style.display='none';
}

function nextPlace(){
  placePos=null;
  if(!placeQueue.length){
    var _pov2=document.getElementById('place-overlay');
    if(_pov2)_pov2.style.display='none';
    G.phase='combat';
    document.getElementById('phase').textContent='COMBAT';
    _hidePlaceInfo();
    _startDrillsPlaced=true;
    // Activer la première option ULTIME maintenant que les foreuses sont placées
    if(ultimateMode&&_ultimatePool.length&&!_ultimateActiveOpt){
      var _f=_ultimatePool[Math.floor(Math.random()*_ultimatePool.length)];
      _ultimateActivate(_f);_ultimateTimer=(_f==='speed')?60:30;
    }
    return;
  }
  var cur=placeQueue[0];
  var total=(GAMEMODE==='solo'?4:4);
  var placed=total-placeQueue.length;
  var lbl=cur.type==='drill'?'FOREUSE':'TÉLÉPORTEUR';
  var who=(GAMEMODE!=='solo'&&cur.who==='p2')?'J2':'J1';
  var txt=(GAMEMODE!=='solo'?who+' — ':'')+lbl+' ('+(placed+1)+'/'+total+') — cliquer une case';
  _showPlaceInfo(txt);
}

function confirmPlace(){
  if(drillingMode){confirmDrill();return;}
  if(!placePos||!placePos.ok)return;
  if(!placeQueue.length)return;
  var cur=placeQueue[0];
  var owner=cur.who==='p1'?1:2;

  addBd(cur.type,placePos.gx,placePos.gy,owner);
  placeQueue.shift();sfx('place');
  log('Place : '+(cur.type==='drill'?'FOREUSE':cur.type==='drillfast'?'FOREUSE+':'TELEPORTEUR'));
  nextPlace();
}
function confirmDrill(){
  if(!placePos||!placePos.ok)return;
  if(typeof drillingMode==='string'&&drillingMode.indexOf('block-')===0){
    // Place a resource block
    var btype=drillingMode.replace('block-','');
    var bhp=btype==='diamond'?600:btype==='gold'?400:300;
    G.blocks.push({gx:placePos.gx,gy:placePos.gy,x:placePos.gx+.5,y:placePos.gy+.5,
      type:btype,id:btype+Date.now(),hp:bhp,maxHp:bhp});
    drillingMode=false;placePos=null;_drillRefund=null;
    _hidePlaceInfo();sfx('place');
    return;
  }
  var dtype=(drillingMode==='drillfast'?'drillfast':'drill');
  addBd(dtype,placePos.gx,placePos.gy,G.p1.team);
  drillingMode=false;placePos=null;_drillRefund=null;
  _hidePlaceInfo();sfx('buy');
}

function selectCell(gx,gy){
  if(!placeQueue.length)return;
  var ok=cellFreePlace(gx,gy);
  placePos={gx:gx,gy:gy,ok:ok,locked:true};
}

function aiPickPlace(type){
  var best=null,bs=-999;
  for(var gy=0;gy<MAP;gy++)for(var gx=0;gx<MAP;gx++){
    if(!cellFreePlace(gx,gy))continue;
    if(type==='drill'&&!drillAdjRes(gx,gy))continue;
    var sc=0;
    if(type==='drill'){G.blocks.forEach(function(b){var d=Math.hypot(gx-b.gx,gy-b.gy);if(d<3)sc+=5/Math.max(d,.5);});if(gx>6)sc+=2;}
    else{sc+=4-Math.hypot(gx-6,gy-6)*.3;if(gx>6)sc+=2;}
    if(sc>bs){bs=sc;best={gx:gx,gy:gy};}
  }
  return best;
}

function addBd(type,gx,gy,owner){
  var onP=G.players.some(function(p){return !p.dead&&Math.floor(p.x)===gx&&Math.floor(p.y)===gy;});
  if(onP)return null;
  var bd=mkBd(type,gx,gy,owner);
  if(type==='drill'){
    // Priorité : minerai requis pour acheter foreuse > minerai objectif > troisième
    var typePriority=[costTypes.drill,winResource];
    ['coal','gold','diamond'].forEach(function(r){if(typePriority.indexOf(r)===-1)typePriority.push(r);});
    var best=null,bD=99;
    for(var ti=0;ti<typePriority.length;ti++){
      var ttype=typePriority[ti];
      var adj=[{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
      for(var ai=0;ai<adj.length;ai++){
        var nx=gx+adj[ai].dx,ny=gy+adj[ai].dy;
        var found=G.blocks.filter(function(bl){return bl.gx===nx&&bl.gy===ny&&bl.type===ttype;})[0];
        if(found){best=found;break;}
      }
      if(best)break;
    }
    // Fallback: nearest block of any type
    if(!best){G.blocks.forEach(function(bl){var d=Math.hypot(gx-bl.gx,gy-bl.gy);if(d<bD){bD=d;best=bl;}});}
    if(best){var ddx=best.gx-gx,ddy=best.gy-gy;bd.facing=Math.abs(ddx)>=Math.abs(ddy)?(ddx>0?'right':'left'):(ddy>0?'down':'up');}
  }
  G.buildings.push(bd);
  // Pousser tout joueur dont le hitbox chevauche le nouveau bâtiment
  var R=0.3;
  G.players.forEach(function(p){
    if(p.dead)return;
    var ox=p.x-(gx+0.5),oy=p.y-(gy+0.5);
    if(Math.abs(ox)<0.5+R&&Math.abs(oy)<0.5+R){
      if(Math.abs(ox)>=Math.abs(oy)){p.x=gx+0.5+(ox>=0?0.5+R:-(0.5+R));}
      else{p.y=gy+0.5+(oy>=0?0.5+R:-(0.5+R));}
    }
  });
  return bd.id;
}


/* MOVEMENT */
function moveP(p,dx,dy,dt){
  if(p.dead)return;
  var res=(p.coal||0)+(p.gold||0)+(p.diamond||0);
  var spd=p.speed*Math.max(0.65,1-res*0.03);
  var nx=p.x+dx*spd*dt,ny=p.y+dy*spd*dt;
  var R=0.25; // correspond mieux au visuel du personnage
  function solid(wx,wy){
    var corners=[[wx-R,wy-R],[wx+R,wy-R],[wx-R,wy+R],[wx+R,wy+R]];
    for(var i=0;i<corners.length;i++){
      var cx=corners[i][0],cy=corners[i][1];
      if(cx<0||cx>=MAP||cy<0||cy>=MAP)return true;
      var gx2=Math.floor(cx),gy2=Math.floor(cy);
      if(isWall(gx2,gy2))return true;
      if(G.destroyed.some(function(d){return d.gx===gx2&&d.gy===gy2;}))return true;
      if(G.blocks.some(function(b){return b.gx===gx2&&b.gy===gy2&&!b.ghost;}))return true;
      if(G.buildings.some(function(b){return b.gx===gx2&&b.gy===gy2&&!b.ghost;}))return true;
      // météorites en vol = traversables (seuls les cratères bloquent)
    }
    return false;
  }
  if(!solid(nx,ny)){p.x=Math.max(R,Math.min(MAP-R,nx));p.y=Math.max(R,Math.min(MAP-R,ny));}
  else if(!solid(nx,p.y)){p.x=Math.max(R,Math.min(MAP-R,nx));}
  else if(!solid(p.x,ny)){p.y=Math.max(R,Math.min(MAP-R,ny));}
  p.vx=dx;p.vy=dy;
}
