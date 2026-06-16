/* RNG */
function mkRng(s){return function(){s=(s^(s<<13))>>>0;s=(s^(s>>17))>>>0;s=(s^(s<<5))>>>0;return s/4294967296};}

/* INIT */
function mkPlayer(name,ci,x,y,team,isHuman){
  var hp=isHuman?100:220;
  return{name:name,ci:ci,color:PCOLORS[ci],skin:SKINC[ci],
    x:x,y:y,vx:0,vy:0,team:team,isHuman:isHuman,dead:false,
    hp:hp,maxHp:hp,dmg:isHuman?10:16,speed:isHuman?1.68:2.2,regen:isHuman?4:8,
    coal:0,gold:0,diamond:0,spdUpg:0,blocksBought:0,
    atkCharge:1,
    inCombat:false,combatTimer:0,spearTimer:0,spearAng:0,spearSwing:0,spearDir:0,
    aiTimer:0,aiGoal:null,aiOnArr:function(){},aiSt:'idle',aiBdTimer:0};
}

function mkBd(type,gx,gy,owner){
  var lbl={factory:'USINE',bank:'MAGAZIN',drill:'FOREUSE',drillfast:'FOREUSE+',teleporter:'TP',portal:'PORTAIL'};
  return{id:type+'_'+(Date.now()*Math.random()|0),type:type,gx:gx,gy:gy,x:gx+.5,y:gy+.5,
    owner:owner,label:lbl[type]||type,hp:BD_HP[type]||200,maxHp:BD_HP[type]||200,
    stored:{coal:0,gold:0,diamond:0},drillTimer:0,facing:'down'};
}

function initGame(){
  var rr=mkRng(Date.now()|0),taken={};
  // Marquer tous les murs comme pris
  for(var _wy=0;_wy<MAP;_wy++)for(var _wx=0;_wx<MAP;_wx++){
    if(isWall(_wx,_wy))taken[_wx+','+_wy]=true;
  }
  // Usine + magazin : chacun sur une case libre totalement aléatoire (indépendante)
  var _fGx,_fGy,_bGx,_bGy,_bt=0;
  _fGx=1+Math.floor(rr()*(MAP-2));_fGy=1+Math.floor(rr()*(MAP-2));taken[_fGx+','+_fGy]=true;
  do{
    _bGx=1+Math.floor(rr()*(MAP-2));_bGy=1+Math.floor(rr()*(MAP-2));_bt++;
  }while(taken[_bGx+','+_bGy]&&_bt<400);
  taken[_bGx+','+_bGy]=true;

  var blocks=[];

  if(_preloadedBlocks){
    // Rejouer une map depuis un code — positions explicites
    _preloadedBlocks.forEach(function(b){
      var bhp=b.type==='diamond'?420:b.type==='gold'?280:210;
      taken[b.gx+','+b.gy]=true;
      var block={gx:b.gx,gy:b.gy,x:b.gx+.5,y:b.gy+.5,type:b.type,
        id:b.type+(Date.now()*Math.random()|0),hp:bhp,maxHp:bhp};
      blocks.push(block);
    });
    _preloadedBlocks=null;
  } else {
    function placeRes(type,n){
      for(var i=0;i<n;i++){
        var gx,gy,k,t=0;
        do{
          gx=1+Math.floor(rr()*(MAP-2));gy=1+Math.floor(rr()*(MAP-2));k=gx+','+gy;t++;
          var adjBlock=blocks.some(function(b){return Math.abs(b.gx-gx)+Math.abs(b.gy-gy)===1;});
          var adjBuilding=(Math.abs(gx-_fGx)+Math.abs(gy-_fGy)<=1)||(Math.abs(gx-_bGx)+Math.abs(gy-_bGy)<=1);
        }while((taken[k]||adjBlock||adjBuilding)&&t<400);
        taken[k]=true;
        var bhp=type==='diamond'?420:type==='gold'?280:210;
        var block={gx:gx,gy:gy,x:gx+.5,y:gy+.5,type:type,id:type+i,hp:bhp,maxHp:bhp};
        blocks.push(block);
      }
    }
    placeRes('coal',mineralQty);
    placeRes('gold',mineralQty);
    placeRes('diamond',mineralQty);
  }

  // Flood-fill : compte les cases libres connectées depuis (fx,fy), s'arrête à max+1
  function openArea(fx,fy,max){
    var vis={},stack=[fx+','+fy],count=0;
    while(stack.length){
      var k=stack.pop();if(vis[k])continue;vis[k]=true;
      var sp=k.split(','),cx2=+sp[0],cy2=+sp[1];
      if(cx2<1||cx2>=MAP-1||cy2<1||cy2>=MAP-1||taken[k])continue;
      count++;if(count>max)return count;
      stack.push((cx2+1)+','+(cy2),(cx2-1)+','+(cy2),cx2+','+(cy2+1),cx2+','+(cy2-1));
    }
    return count;
  }

  // Spawn aléatoire sur une case libre avec espace ouvert > 11 cases
  function randFreeCell(){
    for(var _t=0;_t<2000;_t++){
      var fx=1+Math.floor(rr()*(MAP-2)),fy=1+Math.floor(rr()*(MAP-2)),fk=fx+','+fy;
      if(!taken[fk]&&openArea(fx,fy,11)>11){taken[fk]=true;return{x:fx+.5,y:fy+.5};}
    }
    // Repli : prendre la première case libre quelle que soit la taille
    for(var sy=1;sy<MAP-1;sy++)for(var sx=1;sx<MAP-1;sx++){
      var sk=sx+','+sy;if(!taken[sk]){taken[sk]=true;return{x:sx+.5,y:sy+.5};}
    }
    return{x:2.5,y:2.5};
  }

  var s1=randFreeCell(),s2=randFreeCell();
  var ci1=0,ci2=1+Math.floor(rr()*4);
  var p1=mkPlayer(NAMES[ci1],ci1,s1.x,s1.y,1,true);
  var p2=null;
  if(GAMEMODE==='coop'){
    p2=mkPlayer('Joueur 2',ci2,s2.x,s2.y,1,true);
    p2.isHuman=true;p2.hp=100;p2.maxHp=100;p2.dmg=10;p2.speed=1.68;p2.regen=4;
  }
  var buildings=[mkBd('bank',_bGx,_bGy,0),mkBd('factory',_fGx,_fGy,0)];

  // Code map : positions normalisées [0-120] empaquetées 2 par 2 en 3 chars base-36
  // (gx-1)*11+(gy-1) → valeur 0-120 ; paire → v=p1*121+p2 ≤ 14640 < 36^3=46656
  var _B36='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var posIdxs=[];
  ['coal','gold','diamond'].forEach(function(t){
    blocks.filter(function(b){return b.type===t;}).forEach(function(b){
      posIdxs.push((b.gx-1)*11+(b.gy-1));
    });
  });
  var _pl='';
  for(var _pi=0;_pi<posIdxs.length;_pi+=2){
    if(_pi+1<posIdxs.length){
      var _v=posIdxs[_pi]*121+posIdxs[_pi+1];
      _pl+=_B36[Math.floor(_v/1296)]+_B36[Math.floor(_v/36)%36]+_B36[_v%36];
    } else {
      _pl+=_B36[Math.floor(posIdxs[_pi]/36)]+_B36[posIdxs[_pi]%36];
    }
  }
  var _chk=posIdxs.reduce(function(a,v,i){return a+v*(i+1);},0)%1296;
  var mapCode='R'+_pl+_B36[Math.floor(_chk/36)]+_B36[_chk%36];

  return{p1:p1,p2:p2,players:p2?[p1,p2]:[p1],
    blocks:blocks,buildings:buildings,destroyed:[],meteors:[],piques:[],
    time:0,phase:'placement',winner:null,phase_over:false,meteorTimer:18,rocks:[],
    mapCode:mapCode};
}

/* CELL HELPERS */
function isWall(gx,gy){return gx===0||gx===MAP-1||gy===0||gy===MAP-1;}
function cellOcc(gx,gy,skipId){
  if(gx<0||gx>=MAP||gy<0||gy>=MAP)return true;
  if(isWall(gx,gy))return true;
  if(G.destroyed.some(function(d){return d.gx===gx&&d.gy===gy;}))return true;
  if(G.blocks.some(function(b){return b.gx===gx&&b.gy===gy;}))return true;
  if(G.buildings.some(function(b){return b.id!==skipId&&b.gx===gx&&b.gy===gy;}))return true;
  return false;
}
function cellFreePlace(gx,gy){
  if(cellOcc(gx,gy))return false;
  return !G.players.some(function(p){return !p.dead&&Math.floor(p.x)===gx&&Math.floor(p.y)===gy;});
}
function drillAdjRes(gx,gy){
  return [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}].some(function(d){
    return G.blocks.some(function(b){return b.gx===gx+d.dx&&b.gy===gy+d.dy;});});
}
function cellOccSolid(gx,gy){
  if(gx<0||gx>=MAP||gy<0||gy>=MAP)return true;
  if(isWall(gx,gy))return true;
  return G.destroyed.some(function(d){return d.gx===gx&&d.gy===gy;});
}
