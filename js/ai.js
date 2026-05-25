/* AI */
function updAI(dt){
  if(GAMEMODE==='pvp'||GAMEMODE==='coop')return;
  if(G.p2)updSingleAI(G.p2,dt);
}

function updSingleAI(p,dt){
  if(p.dead)return;
  if(p.aiGoal){
    var dx=p.aiGoal.x-p.x,dy=p.aiGoal.y-p.y,d=Math.hypot(dx,dy);
    if(d>0.1)moveP(p,dx/d,dy/d,dt);
    else{p.aiGoal=null;try{p.aiOnArr();}catch(e){p.aiOnArr=function(){};}}
  }
  if((p.aiTimer-=dt)>0)return;
  p.aiTimer=0.25+Math.random()*.15;
  aiDecide(p);
}

function aiDecide(p){
  if(p.dead)return;
  var enemies=G.players.filter(function(q){return q.team!==p.team&&!q.dead;});
  if(!enemies.length)return;
  var target=enemies.reduce(function(a,b){return a.hp<b.hp?a:b;});
  var hpR=p.hp/p.maxHp,enR=target.hp/target.maxHp;
  var dist=Math.hypot(p.x-target.x,p.y-target.y);
  var adv=hpR-enR+(p.dmg-target.dmg)*.05;
  // P0: escape meteor
  var met=G.meteors.filter(function(m){return !m.fallen&&m.timer<5&&m.gx===Math.floor(p.x)&&m.gy===Math.floor(p.y);})[0];
  if(met){for(var i=0,d2=[{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];i<d2.length;i++){var nx=met.gx+d2[i].dx,ny=met.gy+d2[i].dy;if(nx>=0&&nx<MAP&&ny>=0&&ny<MAP&&!cellOcc(nx,ny)){p.aiGoal={x:nx+.5,y:ny+.5};p.aiOnArr=function(){};return;}}return;}
  // P1: escape pique
  var pk=G.piques.filter(function(pk2){return Math.floor(p.x)===pk2.gx&&Math.floor(p.y)===pk2.gy;})[0];
  if(pk){var pd=[{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];for(var i2=0;i2<pd.length;i2++){var pnx=pk.gx+pd[i2].dx,pny=pk.gy+pd[i2].dy;if(pnx>=0&&pnx<MAP&&pny>=0&&pny<MAP&&!cellOcc(pnx,pny)&&!G.piques.some(function(p2){return p2.gx===pnx&&p2.gy===pny;})){p.aiGoal={x:pnx+.5,y:pny+.5};p.aiOnArr=function(){};return;}}}
  // P2: collect richest drill
  var drills=G.buildings.filter(function(b){return b.type==='drill';}),bestD=null,bestV=0;
  drills.forEach(function(b){var v=(b.stored.coal||0)+(b.stored.gold||0)*2+(b.stored.diamond||0)*3;if(v>bestV){bestV=v;bestD=b;}});
  if(bestD&&bestV>=1&&hpR>0.2){p.aiSt='gather';p.aiGoal={x:bestD.x,y:bestD.y};p.aiOnArr=(function(r){return function(){p.coal+=(r.stored.coal||0);p.gold+=(r.stored.gold||0);p.diamond=(p.diamond||0)+(r.stored.diamond||0);r.stored={coal:0,gold:0,diamond:0};sfx('collect');};})(bestD);return;}
  // P3: bank upgrade
  var bank=G.buildings.filter(function(b){return b.type==='bank';})[0];
  if(p.gold>=4&&bank){var db=Math.hypot(p.x-bank.x,p.y-bank.y);if(db<0.9){aiBuy(p);}else{p.aiGoal={x:bank.x,y:bank.y};p.aiOnArr=function(){aiBuy(p);};return;}}
  // P4: build drill
  var fac=G.buildings.filter(function(b){return b.type==='factory';})[0];
  var nd=drills.length,dc=5+nd;
  if(p.coal>=dc&&fac&&nd<8&&hpR>0.35){var df=Math.hypot(p.x-fac.x,p.y-fac.y);if(df<0.9){aiBuildDrill(p);}else{p.aiGoal={x:fac.x,y:fac.y};p.aiOnArr=function(){aiBuildDrill(p);};return;}}
  // P5: pique near enemy
  if(p.coal>=3&&fac&&hpR>0.4&&Math.random()<0.12){var df2=Math.hypot(p.x-fac.x,p.y-fac.y);if(df2<0.9){var cands=[{gx:Math.floor(target.x),gy:Math.floor(target.y)},{gx:Math.floor(target.x)+1,gy:Math.floor(target.y)},{gx:Math.floor(target.x)-1,gy:Math.floor(target.y)},{gx:Math.floor(target.x),gy:Math.floor(target.y)+1},{gx:Math.floor(target.x),gy:Math.floor(target.y)-1}];for(var ci2=0;ci2<cands.length;ci2++){var cg=cands[ci2];if(cg.gx>=0&&cg.gx<MAP&&cg.gy>=0&&cg.gy<MAP&&!cellOcc(cg.gx,cg.gy)&&!G.piques.some(function(pk3){return pk3.gx===cg.gx&&pk3.gy===cg.gy;})){p.coal-=3;G.piques.push({gx:cg.gx,gy:cg.gy,x:cg.gx+.5,y:cg.gy+.5,owner:p.team,dmg:25});break;}}return;}else{p.aiGoal={x:fac.x,y:fac.y};p.aiOnArr=function(){};return;}}
  // P6: TP if diamond
  if((p.diamond||0)>=1&&dist>3.5&&hpR>0.35){var tps=G.buildings.filter(function(b){return b.type==='teleporter';});if(tps.length>=2){var src=tps.reduce(function(a,b2){return Math.hypot(p.x-a.x,p.y-a.y)<Math.hypot(p.x-b2.x,p.y-b2.y)?a:b2;});var dst=tps.filter(function(t){return t!==src;})[0];if(Math.hypot(p.x-src.x,p.y-src.y)<0.9){p.diamond=Math.max(0,p.diamond-1);p.x=dst.x;p.y=dst.y;sfx('teleport');}else{p.aiGoal={x:src.x,y:src.y};p.aiOnArr=(function(s,d3){return function(){if((p.diamond||0)>=1){p.diamond--;p.x=d3.x;p.y=d3.y;sfx('teleport');}};})(src,dst);return;}}}
  // P7: attack
  if(hpR<0.16&&enR>0.25){p.aiSt='retreat';p.aiGoal={x:p.x>target.x?Math.min(MAP-1,p.x+3):Math.max(1,p.x-3),y:p.y>target.y?Math.min(MAP-1,p.y+3):Math.max(1,p.y-3)};p.aiOnArr=function(){};}
  else if(hpR>0.25&&(adv>-0.35||enR<0.65)){p.aiSt='attack';p.aiGoal={x:target.x+(Math.random()*.3-.15),y:target.y+(Math.random()*.3-.15)};p.aiOnArr=function(){};}
  else{if(dist>1.1){p.aiSt='press';p.aiGoal={x:target.x,y:target.y};p.aiOnArr=function(){};}else p.aiGoal=null;}
}

function aiBuy(p){if(p.gold>=5&&p.hp<p.maxHp*.7){p.gold-=5;p.maxHp+=20;p.hp=Math.min(p.hp+20,p.maxHp);}else if(p.gold>=5){p.gold-=5;p.dmg+=2;}else if(p.gold>=4){p.gold-=4;p.speed+=0.2;}}
function aiBuildDrill(p){var n=G.buildings.filter(function(b){return b.type==='drill';}).length,cost=5+n;if(p.coal<cost)return;var fac=G.buildings.filter(function(b){return b.type==='factory';})[0];if(!fac)return;var dirs=[{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1},{dx:2,dy:0},{dx:0,dy:2},{dx:-2,dy:0},{dx:0,dy:-2}];for(var i=0;i<dirs.length;i++){var gx=fac.gx+dirs[i].dx,gy=fac.gy+dirs[i].dy;if(!cellOcc(gx,gy)){addBd('drill',gx,gy,p.team);p.coal-=cost;return;}}}
function aiAutoCollect(){G.players.forEach(function(p){if(!p||p.dead||p.isHuman)return;G.buildings.forEach(function(bd){if(bd.type!=='drill')return;if(Math.hypot(p.x-bd.x,p.y-bd.y)<1.0&&(bd.stored.coal||bd.stored.gold||bd.stored.diamond)){p.coal+=(bd.stored.coal||0);p.gold+=(bd.stored.gold||0);p.diamond=(p.diamond||0)+(bd.stored.diamond||0);bd.stored={coal:0,gold:0,diamond:0};sfx('collect');}});});}
