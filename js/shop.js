/* SHOP */
var _cCols={coal:'#c8c4e8',gold:'#f5c830',diamond:'#80eeff'};
function _cName(r){return t('res_'+r)||r;}

function openShop(type,p){
  shopOpen=type;shopPlayer=p;
  document.getElementById('stitle').textContent=t('shop_title');
  renderShop();
  document.getElementById('shop').style.display='block';
}
function closeShop(){shopOpen=null;shopPlayer=null;document.getElementById('shop').style.display='none';}

function renderShop(){
  var p=shopPlayer,el=document.getElementById('sitems'),html='';
  var nd=G.buildings.filter(function(b){return b.type==='drill'||b.type==='drillfast';}).length;
  var drillCost=5+nd;
  var dt=costTypes.drill;
  var ok1=(p[dt]||0)>=drillCost;
  html+=sItem(ok1,t('drill')+' (x'+nd+')',drillCost+' '+_cName(dt),t('shop_drilleff'),'drill');

  var invCost=6,invT=costTypes.drill,okInv=(p[invT]||0)>=invCost;
  html+=sItem(okInv,t('shop_inversion'),invCost+' '+_cName(invT),t('shop_inversion_eff'),'inversion');

  var dt2=costTypes.dmg,dmgCost=2,okDmg=(p[dt2]||0)>=dmgCost;
  html+=sItem(okDmg,t('shop_dmg_name'),dmgCost+' '+_cName(dt2),t('shop_current')+' : '+p.dmg,'dmg');

  var st=costTypes.spd,spdCost=(p.spdUpg||0)+1,okSpd=(p[st]||0)>=spdCost;
  html+=sItem(okSpd,t('shop_spd_name'),spdCost+' '+_cName(st),t('shop_current')+' : '+p.speed.toFixed(1)+' (x'+(p.spdUpg+1)+')','spd');

  el.innerHTML=html;
}

function sItem(ok,name,cost,eff,action){
  var cls='si'+(ok?'':' no');
  return '<div class="'+cls+'" data-action="'+action+'">'+
    '<div style="font-size:15px;font-weight:bold;margin-bottom:2px">'+name+'</div>'+
    '<div class="co">'+cost+'</div>'+
    '<div class="ef">'+eff+'</div>'+
    (ok?'<div class="ok">'+t('shop_buy')+'</div>':'')+'</div>';
}



function buyBd(type){
  var p=shopPlayer;if(!p||!G)return;
  if(type!=='drill')return;
  var nd=G.buildings.filter(function(b){return b.type==='drill'||b.type==='drillfast';}).length;
  var cost=5+nd;
  var dt=costTypes.drill;
  if((p[dt]||0)<cost){log(t('log_cancel')+' '+_cName(dt)+'!');return;}
  p[dt]-=cost;closeShop();
  drillingMode=type;placePos=null;
  _drillRefund={player:p,type:dt,amount:cost};
  _showPlaceInfo(t('drill'));
}

function buyInversion(){
  var p=shopPlayer;if(!p||!G)return;
  var cost=6,ct=costTypes.drill;
  if((p[ct]||0)<cost){log(t('log_cancel')+' '+_cName(ct)+'!');return;}
  p[ct]-=cost;sfx('buy');closeShop();
  _inversionPending=true;_inversionFirst=null;_inversionShopMode=true;_selectionPending=true;_selectionDelay=0.6;
  _showPlaceInfo(t('msg_inversion_pick1'),'inversion');
}
function buyUpg(upg){
  if(!shopPlayer||!G)return;
  var p=shopPlayer;
  var ctype=upg==='dmg'?costTypes.dmg:costTypes.spd;
  var cost=upg==='dmg'?2:(p.spdUpg||0)+1;
  if((p[ctype]||0)<cost){log(t('log_cancel')+' '+_cName(ctype)+'!');return;}
  p[ctype]-=cost;sfx('buy');
  if(upg==='dmg'){p.dmg+=2;log(t('shop_dmg_name')+' → '+p.dmg);}
  else{p.speed+=0.2;p.spdUpg=(p.spdUpg||0)+1;log(t('shop_spd_name')+' → '+p.speed.toFixed(1));}
  renderShop();
}

/* TELEPORT */
function doTeleport(gx,gy){
  var tps=G.buildings.filter(function(b){return b.type==='teleporter';});
  var dest=tps.filter(function(b){return b!==tpSrc&&b.gx===gx&&b.gy===gy;})[0];
  var p=tpPlayer;
  if(dest){
    var occ=G.players.some(function(pl){return !pl.dead&&pl!==p&&Math.floor(pl.x)===gx&&Math.floor(pl.y)===gy;});
    if(occ){log(t('log_occ'));tpMode=false;tpSrc=null;tpPlayer=null;return;}
    p.diamond=Math.max(0,(p.diamond||0)-1);
    p.x=dest.x;p.y=dest.y;sfx('tp');log(p.name+' → TP (-1 ◆)');
  } else if(!cellOcc(gx,gy)){
    var anyP=G.players.some(function(pl){return !pl.dead&&Math.floor(pl.x)===gx&&Math.floor(pl.y)===gy;});
    if(anyP){log(t('log_occ'));tpMode=false;tpSrc=null;tpPlayer=null;return;}
    tpSrc.gx=gx;tpSrc.gy=gy;tpSrc.x=gx+.5;tpSrc.y=gy+.5;log(t('log_portail'));
  }
  tpMode=false;tpSrc=null;tpPlayer=null;
}
