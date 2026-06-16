/* SHOP */
var _cNames={coal:'Charbon',gold:'Or',diamond:'Diamant'};
var _cCols={coal:'#c8c4e8',gold:'#f5c830',diamond:'#80eeff'};

function openShop(type,p){
  shopOpen=type;shopPlayer=p;
  document.getElementById('stitle').textContent=type==='factory'?'USINE — Construire':'MAGAZIN — Améliorations';
  renderShop();
  document.getElementById('shop').style.display='block';
}
function closeShop(){shopOpen=null;shopPlayer=null;document.getElementById('shop').style.display='none';}

function renderShop(){
  var p=shopPlayer,el=document.getElementById('sitems'),html='';
  if(shopOpen==='factory'){
    var nd=G.buildings.filter(function(b){return b.type==='drill'||b.type==='drillfast';}).length;
    var drillCost=5+nd;
    var dt=costTypes.drill;
    var ok1=(p[dt]||0)>=drillCost;
    var dtLabel=_cNames[dt];
    html+=sItem(ok1,'FOREUSE (x'+nd+')',drillCost+' '+dtLabel,'Extrait 1 ressource / 5s','drill');

    var blockCost=4+2*(p.blocksBought||0);
    var bt=costTypes.block;
    var okB=(p[bt]||0)>=blockCost;
    var btLabel=_cNames[bt];
    var bs='flex:1;background:rgba(220,170,80,0.06);border:1px solid rgba(220,170,80,0.2);border-radius:3px;padding:7px 4px;cursor:pointer;font-family:Courier New,monospace;font-size:13px;font-weight:bold;transition:all .2s;';
    var bLabel='<div style="font-size:12px;opacity:0.6;margin-bottom:5px;color:'+_cCols[bt]+'">BLOCS — '+blockCost+' '+btLabel+'</div><div style="display:flex;gap:4px">';
    bLabel+='<button data-action="buy-coal" style="'+bs+(okB?'color:#c8c4e8"':'color:#444;cursor:not-allowed"')+'>Charbon</button>';
    bLabel+='<button data-action="buy-gold" style="'+bs+(okB?'color:#f5c830"':'color:#444;cursor:not-allowed"')+'>Or</button>';
    bLabel+='<button data-action="buy-diamond" style="'+bs+(okB?'color:#80eeff"':'color:#444;cursor:not-allowed"')+'>Diamant</button>';
    bLabel+='</div>';
    html+='<div class="si" style="padding:10px 14px">'+bLabel+'</div>';
  } else {
    var dt2=costTypes.dmg,dmgCost=2,okDmg=(p[dt2]||0)>=dmgCost;
    html+=sItem(okDmg,'+2 Dégâts/s',dmgCost+' '+_cNames[dt2],'Actuel : '+p.dmg+' dég/s','dmg');

    var st=costTypes.spd,spdCost=(p.spdUpg||0)+1,okSpd=(p[st]||0)>=spdCost;
    html+=sItem(okSpd,'+0.2 Vitesse',spdCost+' '+_cNames[st],'Actuel : '+p.speed.toFixed(1)+' (achat '+(p.spdUpg+1)+')','spd');
  }
  el.innerHTML=html;
}

function sItem(ok,name,cost,eff,action){
  var cls='si'+(ok?'':' no');
  return '<div class="'+cls+'" data-action="'+action+'">'+
    '<div style="font-size:15px;font-weight:bold;margin-bottom:2px">'+name+'</div>'+
    '<div class="co">'+cost+'</div>'+
    '<div class="ef">'+eff+'</div>'+
    (ok?'<div class="ok">ACHETER</div>':'')+'</div>';
}

function buyBlock(btype){
  var p=shopPlayer;if(!p||!G)return;
  var bt=costTypes.block;
  var cost=4+2*(p.blocksBought||0);
  if((p[bt]||0)<cost){log('Pas assez de '+_cNames[bt]+' ! ('+cost+' requis)');return;}
  p[bt]-=cost;p.blocksBought=(p.blocksBought||0)+1;sfx('buy');closeShop();
  drillingMode='block-'+btype;placePos=null;
  _showPlaceInfo('BLOC '+{coal:'CHARBON',gold:'OR',diamond:'DIAMANT'}[btype]);
}

function buyBd(type){
  var p=shopPlayer;if(!p||!G)return;
  if(type!=='drill')return;
  var nd=G.buildings.filter(function(b){return b.type==='drill'||b.type==='drillfast';}).length;
  var cost=5+nd;
  var dt=costTypes.drill;
  if((p[dt]||0)<cost){log('Pas assez de '+_cNames[dt]+' !');return;}
  p[dt]-=cost;closeShop();
  drillingMode=type;placePos=null;
  _showPlaceInfo('FOREUSE');
}

function buyUpg(t){
  if(!shopPlayer||!G)return;
  var p=shopPlayer;
  var ctype=t==='dmg'?costTypes.dmg:costTypes.spd;
  var cost=t==='dmg'?2:(p.spdUpg||0)+1;
  if((p[ctype]||0)<cost){log('Pas assez de '+_cNames[ctype]+' !');return;}
  p[ctype]-=cost;sfx('buy');
  if(t==='dmg'){p.dmg+=2;log('Dégâts +2 → '+p.dmg);}
  else{p.speed+=0.2;p.spdUpg=(p.spdUpg||0)+1;log('Vitesse +0.2 → '+p.speed.toFixed(1));}
  renderShop();
}

/* TELEPORT */
function doTeleport(gx,gy){
  var tps=G.buildings.filter(function(b){return b.type==='teleporter';});
  var dest=tps.filter(function(b){return b!==tpSrc&&b.gx===gx&&b.gy===gy;})[0];
  var p=tpPlayer;
  if(dest){
    var occ=G.players.some(function(pl){return !pl.dead&&pl!==p&&Math.floor(pl.x)===gx&&Math.floor(pl.y)===gy;});
    if(occ){log('Case occupée !');tpMode=false;tpSrc=null;tpPlayer=null;return;}
    p.diamond=Math.max(0,(p.diamond||0)-1);
    p.x=dest.x;p.y=dest.y;sfx('tp');log(p.name+' téléporté ! (-1 ◆)');
  } else if(!cellOcc(gx,gy)){
    var anyP=G.players.some(function(pl){return !pl.dead&&Math.floor(pl.x)===gx&&Math.floor(pl.y)===gy;});
    if(anyP){log('Joueur sur cette case !');tpMode=false;tpSrc=null;tpPlayer=null;return;}
    tpSrc.gx=gx;tpSrc.gy=gy;tpSrc.x=gx+.5;tpSrc.y=gy+.5;log('TP déplacé !');
  }
  tpMode=false;tpSrc=null;tpPlayer=null;
}
