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
  document.getElementById('pbar').style.display='block';
  nextPlace();
}

function nextPlace(){
  placePos=null;document.getElementById('pbc').disabled=true;
  if(!placeQueue.length){
    document.getElementById('pbar').style.display='none';
    G.phase='combat';
    document.getElementById('phase').textContent='COMBAT';
    log(GAMEMODE==='solo'?'Collecte !':GAMEMODE==='coop'?'Coop !':'Combat !');
    return;
  }
  var cur=placeQueue[0];
  var lbl=cur.type==='drill'?'FOREUSE':'TELEPORTEUR';
  document.getElementById('pturn').textContent=cur.who==='p1'?'Joueur 1':'Joueur 2';
  // In pvp, both players place manually. In solo, only p1 exists.
  var dispLabel=lbl;
  if(GAMEMODE==='solo'||cur.who==='p1'){
    document.getElementById('pinfo').textContent='Clic = selectionner  Double-clic = confirmer ('+dispLabel+')';
  } else {
    document.getElementById('pinfo').textContent='J2 : Clic = selectionner  Double-clic = confirmer ('+dispLabel+')';
  }
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
    drillingMode=false;placePos=null;
    document.getElementById('pbar').style.display='none';
    sfx('place');log('Bloc '+btype.toUpperCase()+' pose !');
    return;
  }
  var dtype=(drillingMode==='drillfast'?'drillfast':'drill');
  addBd(dtype,placePos.gx,placePos.gy,G.p1.team);
  drillingMode=false;placePos=null;
  document.getElementById('pbar').style.display='none';
  sfx('buy');log('Foreuse placee !');
}

function selectCell(gx,gy){
  if(!placeQueue.length)return;
  // Both p1 and p2 can select in pvp (only solo is p1-only but p2 doesn't exist there)
  var cur=placeQueue[0];
  var ok=cellFreePlace(gx,gy);
  placePos={gx:gx,gy:gy,ok:ok,locked:true};
  document.getElementById('pbc').disabled=!ok;
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
    // Priority: adjacent coal first, then gold, then diamond, then nearest of any
    var typePriority=['coal','gold','diamond'];
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
  G.buildings.push(bd);return bd.id;
}

/* MOVEMENT */
function moveP(p,dx,dy,dt){
  if(p.dead)return;
  var res=(p.coal||0)+(p.gold||0)+(p.diamond||0);
  var spd=p.speed*Math.max(0.65,1-res*0.03);
  var nx=p.x+dx*spd*dt,ny=p.y+dy*spd*dt;
  var R=0.3;
  function solid(wx,wy){
    var corners=[[wx-R,wy-R],[wx+R,wy-R],[wx-R,wy+R],[wx+R,wy+R]];
    for(var i=0;i<corners.length;i++){
      var cx=corners[i][0],cy=corners[i][1];
      if(cx<0||cx>=MAP||cy<0||cy>=MAP)return true;
      var gx2=Math.floor(cx),gy2=Math.floor(cy);
      if(G.destroyed.some(function(d){return d.gx===gx2&&d.gy===gy2;}))return true;
      if(G.blocks.some(function(b){return b.gx===gx2&&b.gy===gy2;}))return true;
      if(G.buildings.some(function(b){return b.gx===gx2&&b.gy===gy2;}))return true;
    }
    return false;
  }
  if(!solid(nx,ny)){p.x=Math.max(R,Math.min(MAP-R,nx));p.y=Math.max(R,Math.min(MAP-R,ny));}
  else if(!solid(nx,p.y)){p.x=Math.max(R,Math.min(MAP-R,nx));}
  else if(!solid(p.x,ny)){p.y=Math.max(R,Math.min(MAP-R,ny));}
  p.vx=dx;p.vy=dy;
}
