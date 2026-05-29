/* SHOP */
function openShop(type,p){shopOpen=type;shopPlayer=p;document.getElementById('stitle').textContent=type==='factory'?'USINE - Construire':'MAGAZIN - Ameliorations';renderShop();document.getElementById('shop').style.display='block';}
function closeShop(){shopOpen=null;shopPlayer=null;document.getElementById('shop').style.display='none';}

function renderShop(){
  var p=shopPlayer,el=document.getElementById('sitems'),html='';
  if(shopOpen==='factory'){
    var nd=G.buildings.filter(function(b){return b.type==='drill'||b.type==='drillfast';}).length;
    var nt=G.buildings.filter(function(b){return b.type==='teleporter';}).length;
    var dc=5+nd,tc=8+nt,pc=3;
    var ok1=p.coal>=dc,ok2=p.coal>=tc,ok3=p.coal>=pc;
    html+=sItem(ok1,'FOREUSE (x'+nd+')',dc+' charbon','Mine 1 res/5s','drill');

    var bCost=4+2*(p.blocksBought||0);
    var d3=(p.diamond||0)>=bCost;
    var bstyle='flex:1;background:rgba(220,170,80,0.06);border:1px solid rgba(220,170,80,0.2);border-radius:3px;padding:5px 4px;cursor:pointer;font-family:Courier New,monospace;font-size:11px;transition:all .2s;';
    var bLabel='<div style=\"font-size:10px;opacity:0.5;margin-bottom:3px\">BLOCS  '+bCost+' &#9670;</div><div style=\"display:flex;gap:4px\">';
    bLabel+='<button data-action=\"buy-coal\" style=\"'+bstyle+(d3?'color:#c8c4e8\"':'color:#555;cursor:not-allowed\"')+'>C</button>';
    bLabel+='<button data-action=\"buy-gold\" style=\"'+bstyle+(d3?'color:#f5c830\"':'color:#555;cursor:not-allowed\"')+'>G</button>';
    bLabel+='<button data-action=\"buy-diamond\" style=\"'+bstyle+(d3?'color:#80eeff\"':'color:#555;cursor:not-allowed\"')+'>D</button>';
    bLabel+='</div>';
    html+='<div class=\"si\" style=\"padding:8px 12px\">'+bLabel+'</div>';
    if(GAMEMODE!=='solo'&&GAMEMODE!=='coop')html+=sItem(ok2,'TELEPORTEUR (x'+nt+')',tc+' charbon','Teleporte (1 diamant/utilisation)','teleporter');
    if(GAMEMODE!=='solo'&&GAMEMODE!=='coop')html+=sItem(ok3,'PIQUE',pc+' charbon','Blesse ceux qui marchent dessus (-25PV/s)','pique');
  } else {
    var isPvp=GAMEMODE==='pvp';
    var dmgCost=(GAMEMODE==='solo'||GAMEMODE==='coop')?2:5;
    if(isPvp){
      // PvP: upgrades cost diamonds
      var d5=(p.diamond||0)>=5,dDmg=(p.diamond||0)>=dmgCost;
      html+=sItem(dDmg,'+2 DMG/s',dmgCost+' \u25c6','Actuel: '+p.dmg+'/s','dmg');
      html+=sItem(d5,'+20 PV max','5 \u25c6','Actuel: '+p.maxHp+' PV','hp');
      var sc=(p.spdUpg||0)+1,ds=(p.diamond||0)>=sc;
      html+=sItem(ds,'+0.2 vitesse',sc+' \u25c6','Actuel: '+p.speed.toFixed(1)+' (achat '+(p.spdUpg+1)+')','spd');
    } else {
      var g5=p.gold>=5,gDmg=p.gold>=dmgCost;
      html+=sItem(gDmg,'+2 DMG/s',dmgCost+' or','Actuel: '+p.dmg+'/s','dmg');
      var sc=(p.spdUpg||0)+1,gs=p.gold>=sc;
      html+=sItem(gs,'+0.2 vitesse',sc+' or','Actuel: '+p.speed.toFixed(1)+' (achat '+(p.spdUpg+1)+')','spd');
    }

  }
  el.innerHTML=html;
}

function sItem(ok,name,cost,eff,action){
  var cls='si'+(ok?'':' no');
  return '<div class="'+cls+'" data-action="'+action+'">'+
    '<div>'+name+'</div><div class="co">'+cost+'</div><div class="ef">'+eff+'</div>'+
    '<div class="'+(ok?'ok':'ko')+'">'+(ok?'ACHETER':'manque ressources')+'</div></div>';
}

function buyBlock(btype){
  var p=shopPlayer;if(!p||!G){log('Erreur: shop non ouvert');return;}
  var cost=4+2*(p.blocksBought||0);
  if((p.diamond||0)<cost){log('Pas assez de diamants ! ('+cost+' requis)');return;}
  p.diamond-=cost;p.blocksBought=(p.blocksBought||0)+1;sfx('buy');closeShop();
  drillingMode='block-'+btype;
  placePos=null;
}

function buyBd(type){
  var p=shopPlayer;if(!p||!G){log('Erreur: shop non ouvert');return;}
  var nd=G.buildings.filter(function(b){return b.type==='drill'||b.type==='drillfast';}).length;
  var nt=G.buildings.filter(function(b){return b.type==='teleporter';}).length;
  var baseDrillCost=5+nd;
  var cost=(type==='drill'?baseDrillCost:type==='teleporter'?8+nt:3);
  if(p.coal<cost){log('Pas assez de charbon !');return;}
  if(type==='drill'){
    p.coal-=cost;closeShop();
    drillingMode=type;
    placePos=null;
    return;
  }
  var fac=G.buildings.filter(function(b){return b.type==='factory';})[0];if(!fac){log('Usine detruite !');return;}
  var dirs=[{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1},{dx:2,dy:0},{dx:0,dy:2},{dx:-2,dy:0},{dx:0,dy:-2}];
  var ok=false;
  for(var i=0;i<dirs.length;i++){var gx=fac.gx+dirs[i].dx,gy=fac.gy+dirs[i].dy;if(!cellOcc(gx,gy)){addBd(type,gx,gy,p.team);ok=true;break;}}
  if(!ok){log('Pas de place pres de l usine !');return;}
  p.coal-=cost;sfx('build');log(type+' construit !');renderShop();
}

function buyUpg(t){
  if(!shopPlayer||!G){log('Erreur: shop non ouvert');return;}
  var p=shopPlayer;
  var isRec2=GAMEMODE==='solo'||GAMEMODE==='coop';
  var costs={dmg:isRec2?2:5,hp:5,spd:(p.spdUpg||0)+1};
  if(GAMEMODE==='pvp'){
    if((p.diamond||0)<costs[t]){log('Pas assez de diamants !');return;}
    p.diamond-=costs[t];
  } else {
    if(p.gold<costs[t]){log('Pas assez d or !');return;}
    p.gold-=costs[t];
  }
  sfx('buy');
  if(t==='dmg'){p.dmg+=2;log('DMG +2 -> '+p.dmg);}
  else if(t==='hp'){p.maxHp+=20;p.hp=Math.min(p.hp+20,p.maxHp);log('PV +20');}
  else{p.speed+=0.2;p.spdUpg=(p.spdUpg||0)+1;log('Vitesse +0.2 -> '+p.speed.toFixed(1));}
  renderShop();
}

function buyPique(){
  if(!shopPlayer||!G){log('Erreur: shop non ouvert');return;}
  var p=shopPlayer;if(p.coal<3){log('Pas assez de charbon !');return;}
  p.coal-=3;sfx('buy');closeShop();piqueMode=true;piquePlayer=p;
  log('Clic sur une case pour poser la pique');
}

function placePique(gx,gy){
  if(cellOcc(gx,gy)){log('Case occupee !');piqueMode=false;piquePlayer=null;return;}
  G.piques.push({gx:gx,gy:gy,x:gx+.5,y:gy+.5,owner:piquePlayer.team,dmg:25});
  log('Pique posee !');piqueMode=false;piquePlayer=null;
}

/* TELEPORT */
function doTeleport(gx,gy){
  var tps=G.buildings.filter(function(b){return b.type==='teleporter';});
  var dest=tps.filter(function(b){return b!==tpSrc&&b.gx===gx&&b.gy===gy;})[0];
  var p=tpPlayer;
  if(dest){
    var occ=G.players.some(function(pl){return !pl.dead&&pl!==p&&Math.floor(pl.x)===gx&&Math.floor(pl.y)===gy;});
    if(occ){log('Case occupee !');tpMode=false;tpSrc=null;tpPlayer=null;return;}
    p.diamond=Math.max(0,(p.diamond||0)-1);
    p.x=dest.x;p.y=dest.y;sfx('tp');log(p.name+' teleporte ! (-1 diamant)');
  } else if(!cellOcc(gx,gy)){
    var anyP=G.players.some(function(pl){return !pl.dead&&Math.floor(pl.x)===gx&&Math.floor(pl.y)===gy;});
    if(anyP){log('Joueur sur cette case !');tpMode=false;tpSrc=null;tpPlayer=null;return;}
    tpSrc.gx=gx;tpSrc.gy=gy;tpSrc.x=gx+.5;tpSrc.y=gy+.5;log('TP deplace !');
  }
  tpMode=false;tpSrc=null;tpPlayer=null;
}
