/* RNG */
function mkRng(s){return function(){s=(s^(s<<13))>>>0;s=(s^(s>>17))>>>0;s=(s^(s<<5))>>>0;return s/4294967296};}

/* INIT */
function mkPlayer(name,ci,x,y,team,isHuman){
  var hp=isHuman?100:220;
  return{name:name,ci:ci,color:PCOLORS[ci],skin:SKINC[ci],
    x:x,y:y,vx:0,vy:0,team:team,isHuman:isHuman,dead:false,
    hp:hp,maxHp:hp,dmg:isHuman?10:16,speed:isHuman?1.4:2.2,regen:isHuman?4:8,
    coal:0,gold:0,diamond:0,spdUpg:0,
    atkCharge:1,
    inCombat:false,combatTimer:0,spearTimer:0,spearAng:0,spearSwing:0,spearDir:0,
    aiTimer:0,aiGoal:null,aiOnArr:function(){},aiSt:'idle',aiBdTimer:0};
}

function mkBd(type,gx,gy,owner){
  var lbl={factory:'USINE',bank:'MAGAZIN',drill:'FOREUSE',drillfast:'FOREUSE+',teleporter:'TP'};
  return{id:type+'_'+(Date.now()*Math.random()|0),type:type,gx:gx,gy:gy,x:gx+.5,y:gy+.5,
    owner:owner,label:lbl[type]||type,hp:BD_HP[type]||200,maxHp:BD_HP[type]||200,
    stored:{coal:0,gold:0,diamond:0},drillTimer:0,facing:'down'};
}

function initGame(){
  var rr=mkRng(Date.now()|0),taken={};
  [[6,6],[5,6]].forEach(function(p){taken[p[0]+','+p[1]]=true;});
  [[1,3],[1,4],[1,5],[1,6],[2,3],[2,4],[2,5],[2,6]].forEach(function(p){taken[p[0]+','+p[1]]=true;});
  [[10,3],[10,4],[10,5],[10,6],[9,3],[9,4],[9,5],[9,6]].forEach(function(p){taken[p[0]+','+p[1]]=true;});

  var blocks=[];
  function placeRes(type,n){
    for(var i=0;i<n;i++){
      var gx,gy,k,t=0;
      do{gx=1+Math.floor(rr()*(MAP-2));gy=1+Math.floor(rr()*(MAP-2));k=gx+','+gy;t++;}
      while(taken[k]&&t<400);
      taken[k]=true;
      var bhp=type==='diamond'?600:type==='gold'?400:300;
      blocks.push({gx:gx,gy:gy,x:gx+.5,y:gy+.5,type:type,id:type+i,hp:bhp,maxHp:bhp});
    }
  }
  if(GAMEMODE!=='pvp') placeRes('coal',mineralQty);
  placeRes('gold',mineralQty);
  placeRes('diamond',mineralQty);

  function safeSpawn(px,py){
    var gx=Math.floor(px),gy=Math.floor(py),k=gx+','+gy;
    if(!taken[k]){taken[k]=true;return{x:gx+.5,y:gy+.5};}
    var d=[{dx:0,dy:1},{dx:0,dy:-1},{dx:1,dy:0},{dx:-1,dy:0}];
    for(var i=0;i<d.length;i++){var nx=gx+d[i].dx,ny=gy+d[i].dy,nk=nx+','+ny;if(!taken[nk]){taken[nk]=true;return{x:nx+.5,y:ny+.5};}}
    return{x:px,y:py};
  }

  var s1=safeSpawn(1,5),s2=safeSpawn(10,5);
  var ci1=0,ci2=1+Math.floor(rr()*4);
  var p1=mkPlayer(NAMES[ci1],ci1,s1.x,s1.y,1,true);
  var p2=null;
  if(GAMEMODE==='pvp'){
    p2=mkPlayer(NAMES[ci2],ci2,s2.x,s2.y,2,false);
    p2.isHuman=true;p2.hp=100;p2.maxHp=100;p2.dmg=10;p2.speed=1.4;p2.regen=4;
  // destruction is now just solo with destroyMode flag
  } else if(GAMEMODE==='coop'){
    // Coop: p2 is human, same team as p1 (team 1), no combat between them
    p2=mkPlayer('Joueur 2',ci2,s2.x,s2.y,1,true);
    p2.isHuman=true;p2.hp=100;p2.maxHp=100;p2.dmg=10;p2.speed=1.4;p2.regen=4;
  }
  var buildings=[mkBd('bank',5,6,0)];
  if(GAMEMODE!=='pvp') buildings.push(mkBd('factory',6,6,0));
  return{p1:p1,p2:p2,players:p2?[p1,p2]:[p1],
    blocks:blocks,buildings:buildings,destroyed:[],meteors:[],piques:[],
    time:0,phase:'placement',winner:null,phase_over:false,meteorTimer:20};
}

/* CELL HELPERS */
function cellOcc(gx,gy,skipId){
  if(gx<0||gx>=MAP||gy<0||gy>=MAP)return true;
  if(G.destroyed.some(function(d){return d.gx===gx&&d.gy===gy;}))return true;
  if(G.blocks.some(function(b){return b.gx===gx&&b.gy===gy;}))return true;
  if(G.buildings.some(function(b){return b.id!==skipId&&b.gx===gx&&b.gy===gy;}))return true;
  return false;
}
function cellFreePlace(gx,gy){
  if(cellOcc(gx,gy))return false;
  // Only block the exact cell the player is standing on, not adjacent cells
  return !G.players.some(function(p){return !p.dead&&Math.floor(p.x)===gx&&Math.floor(p.y)===gy;});
}
function drillAdjRes(gx,gy){
  return [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}].some(function(d){
    return G.blocks.some(function(b){return b.gx===gx+d.dx&&b.gy===gy+d.dy;});});
}
function cellOccSolid(gx,gy){
  if(gx<0||gx>=MAP||gy<0||gy>=MAP)return true;
  return G.destroyed.some(function(d){return d.gx===gx&&d.gy===gy;});
}
