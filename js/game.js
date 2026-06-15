/* MAIN LOOP */
function loop(ts){
  requestAnimationFrame(loop);
  var dt=Math.min((ts-lastTime)/1000,.05);lastTime=ts;
  if(speedMode)dt*=2;
  var isRecordMode=(GAMEMODE==='solo'||GAMEMODE==='coop');
  if(G&&gameRunning&&(G.phase==='combat'||(G.phase==='placement'&&isRecordMode))&&!gamePaused){
    G.time+=dt;
  }
  if(G&&gameRunning&&G.phase==='combat'&&!gamePaused){
    // Auto-pause après 20s d'inactivité
    if(Date.now()-_lastActivityTime>20000){
      gamePaused=true;
      document.getElementById('pauseov').style.display='flex';
    }
    if(!drillingMode&&!_selectionPending){
      var dx=0,dy=0;
      if(keys['ArrowLeft'])dx-=1;if(keys['ArrowRight'])dx+=1;
      if(keys['ArrowUp'])dy-=1;if(keys['ArrowDown'])dy+=1;
      if(keys['\xe9']||keys['\xc9'])dy-=1;
      if(keys['a']||keys['A'])dx-=1;
      if(keys['u']||keys['U'])dy+=1;
      if(keys['i']||keys['I'])dx+=1;
      if(GAMEMODE==='solo'){if(keys['q']||keys['Q'])dx-=1;if(keys['d']||keys['D'])dx+=1;if(keys['z']||keys['Z'])dy-=1;if(keys['s']||keys['S'])dy+=1;}
      if(dx||dy){var l=Math.hypot(dx,dy);moveP(G.p1,dx/l,dy/l,dt);}else{G.p1.vx=0;G.p1.vy=0;}
    }else{G.p1.vx=0;G.p1.vy=0;}
    if(GAMEMODE==='coop'&&G.p2&&!G.p2.dead&&!_selectionPending){
      var dx2=0,dy2=0;
      if(keys['q']||keys['Q'])dx2-=1;if(keys['d']||keys['D'])dx2+=1;
      if(keys['z']||keys['Z'])dy2-=1;if(keys['s']||keys['S'])dy2+=1;
      if(dx2||dy2){var l2=Math.hypot(dx2,dy2);moveP(G.p2,dx2/l2,dy2/l2,dt);}else{G.p2.vx=0;G.p2.vy=0;}
    }
    // ULTIME — changement d'option toutes les 60 secondes de combat
    if(ultimateMode&&_ultimatePool.length){
      _ultimateTimer-=dt;
      if(_ultimateTimer<=0){
        var _prevOpt=_ultimateActiveOpt;
        _ultimateDeactivate();
        var _up=_ultimatePool.length>1&&_prevOpt?_ultimatePool.filter(function(p){return p!==_prevOpt;}):_ultimatePool.slice();
        var _nextOpt=_up[Math.floor(Math.random()*_up.length)];
        _ultimateActivate(_nextOpt);
        _ultimateTimer=(_nextOpt==='speed')?120:60;
      }
    }
    // DESTRUCTION — toutes les 26s, choisir un bloc ou foreuse à détruire
    if(destructMode&&!_selectionPending){
      _destructTimer-=dt;
      if(_destructTimer<=0){_destructTimer=26;_destructPending=true;_selectionPending=true;_selectionDelay=0.5;closeShop();_showPlaceInfo('DÉTRUIRE : cliquer un minerai ou foreuse');}
    }
    // FANTÔME — toutes les 26s, choisir un bloc ou foreuse à rendre traversable
    if(ghostMode&&!_selectionPending){
      _ghostTimer-=dt;
      if(_ghostTimer<=0){_ghostTimer=26;_ghostPending=true;_selectionPending=true;_selectionDelay=0.5;closeShop();_showPlaceInfo('FANTÔME : cliquer un minerai ou foreuse');}
    }
    // Mouvement tactile mobile
    if(_touchMoveTarget&&!_selectionPending&&!drillingMode){
      var _tdx=_touchMoveTarget.gx-G.p1.x,_tdy=_touchMoveTarget.gy-G.p1.y;
      var _tdd=Math.hypot(_tdx,_tdy);
      if(_tdd>0.12){moveP(G.p1,_tdx/_tdd,_tdy/_tdd,dt);}else{_touchMoveTarget=null;_touchActivateBd=null;G.p1.vx=0;G.p1.vy=0;}
    }
    // Auto-activer bâtiment cible (tap mobile sur bâtiment éloigné)
    if(_touchActivateBd&&G.p1&&!G.p1.dead&&!shopOpen){
      if(Math.hypot(G.p1.x-_touchActivateBd.x,G.p1.y-_touchActivateBd.y)<=1.6){
        activateBd(_touchActivateBd,G.p1);_touchActivateBd=null;_touchMoveTarget=null;
      }
    }
    // Décompte du délai de sélection (0,5s d'invincibilité au clic)
    if(_selectionDelay>0){_selectionDelay=Math.max(0,_selectionDelay-dt);}
    updCombat(dt);updDrills(dt);updMeteors(dt);updBdAtk(dt);updBlkAtk(dt);updMetAtk(dt);updRocks(dt);updAI(dt);aiAutoCollect();updPiques(dt);
    G.players.forEach(function(p){if(p&&!p.dead&&p.isHuman)p.atkCharge=Math.min(1,(p.atkCharge||0)+dt);});
    if((GAMEMODE==='solo'||GAMEMODE==='coop')&&!G.phase_over){
      var totalDia=(G.p1[winResource]||0)+(G.p2&&GAMEMODE==='coop'?(G.p2[winResource]||0):0);
      if(diamondRace){
        if(totalDia>=diamondGoal){G.phase='over';G.phase_over=true;G.winner='DIAMOND';}
      } else if(!diamondRace&&G.time>=SOLO_DUR){G.phase='over';G.phase_over=true;G.winner='TIME';}
    }
    // Éclair nocturne
    if(nightMode){
      lightningTimer-=dt;
      if(lightningTimer<=0){
        lightningTimer=35;lightningActive=true;lightningEnd=G.time+1.5;
        sfx('impact');
        // Générer le tracé de la foudre depuis un bord
        lightningDir=Math.floor(Math.random()*4);
        lightningPos=0.2+Math.random()*0.6;
        lightningBolt=[];
        var _lx,_ly;
        if(lightningDir===0){_lx=lightningPos*CW;_ly=-20;}
        else if(lightningDir===1){_lx=CW+20;_ly=lightningPos*CH;}
        else if(lightningDir===2){_lx=lightningPos*CW;_ly=CH+20;}
        else{_lx=-20;_ly=lightningPos*CH;}
        lightningBolt.push({x:_lx,y:_ly});
        // Cible : zone centrale avec déviation aléatoire
        var _dx=CW/2+(Math.random()-.5)*CW*.35;
        var _dy=CH/2+(Math.random()-.5)*CH*.35;
        for(var _bi=1;_bi<=8;_bi++){
          var _bt=_bi/8;
          lightningBolt.push({
            x:_lx+(_dx-_lx)*_bt+(Math.random()-.5)*60,
            y:_ly+(_dy-_ly)*_bt+(Math.random()-.5)*60
          });
        }
      }
      if(lightningActive&&G.time>=lightningEnd)lightningActive=false;
    }
    if(G.phase==='over'){gameRunning=false;showEnd();}
  }
  if(G)draw();
}

/* STATS localStorage */
function _statsKey(goal){return 'ruine_stats_'+goal;}
function _loadStats(goal){
  try{var s=JSON.parse(localStorage.getItem(_statsKey(goal)));return s||{wins:0,best:null};}
  catch(e){return{wins:0,best:null};}
}
function _saveStats(goal,wins,best){
  try{localStorage.setItem(_statsKey(goal),JSON.stringify({wins:wins,best:best}));}catch(e){}
}
function _fmtTime(sec){return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(Math.floor(sec%60)).padStart(2,'0');}
function resetTableauDeJeu(){
  [500,1000,2000,3000].forEach(function(g){
    try{localStorage.removeItem(_statsKey(g));}catch(e){}
  });
  updateMenuStats();
}
function updateMenuStats(){
  var goals=[500,1000,2000,3000];
  goals.forEach(function(g){
    var s=_loadStats(g);
    var wEl=document.getElementById('stat-wins-'+g);
    var bEl=document.getElementById('stat-best-'+g);
    if(wEl)wEl.textContent=s.wins;
    if(bEl)bEl.textContent=s.best!==null?_fmtTime(s.best):'—';
  });
}

function showEnd(){
  var ov=document.getElementById('endov');
  var totalD=(G.p1.diamond||0)+(G.p2&&GAMEMODE==='coop'?(G.p2.diamond||0):0);
  if(GAMEMODE==='solo'||GAMEMODE==='coop'){
    var _wsym={coal:'■',gold:'★',diamond:'◆'}[winResource]||'◆';
    var _wcol={coal:'#a07840',gold:'#f0c030',diamond:'#80eeff'}[winResource]||'#80eeff';
    var title='';
    if(diamondRace&&G.winner==='DIAMOND') title=diamondGoal+' '+_wsym+' !';
    else title=GAMEMODE==='coop'?'COOP TERMINÉE':'PARTIE TERMINÉE';
    document.getElementById('endtitle').textContent=title;
    document.getElementById('endtitle').style.color=diamondRace&&G.winner==='DIAMOND'?'#f0d060':_wcol;
    var timeStr=document.getElementById('timer').textContent;
    var sub='';
    var _p1res=G.p1[winResource]||0;
    var _p2res=G.p2?(G.p2[winResource]||0):0;
    if(GAMEMODE==='coop'){
      sub='Total: '+totalD+' '+_wsym+'  (P1: '+_p1res+' + P2: '+_p2res+')';
      sub+='  —  '+timeStr;
    } else {
      sub=_wsym+' '+totalD;
      if(diamondRace&&G.winner==='DIAMOND') sub+='  —  Temps: '+timeStr;
      else sub+='  —  '+timeStr;
    }
    document.getElementById('endsub').innerHTML=sub;
    // Enregistrement stats si victoire en diamondRace
    if(diamondRace&&G.winner==='DIAMOND'){
      var _sg=_loadStats(diamondGoal);
      _sg.wins=Math.round(((_sg.wins||0)+(_gameUsedMapCode?0.5:1))*10)/10;
      if(!_gameUsedMapCode){
        var _elapsed=Math.round(G.time);
        if(_sg.best===null||_elapsed<_sg.best)_sg.best=_elapsed;
      }
      _saveStats(diamondGoal,_sg.wins,_sg.best);
      updateMenuStats();
    }
  }
  var modeEl=document.getElementById('endmode');
  if(modeEl){
    var _wsym3={coal:'■',gold:'★',diamond:'◆'}[winResource]||'◆';
    var modeName=diamondRace?(diamondGoal+' '+_wsym3):(GAMEMODE==='solo'?'SOLO '+(SOLO_DUR/60|0)+'min':'COOP '+(SOLO_DUR/60|0)+'min');
    modeEl.innerHTML='Mode : '+modeName+'  ·  '+mineralQty+'/type  ·  '+(totalD)+' '+_wsym3;
  }
  var codeEl=document.getElementById('endmapcode');
  if(codeEl&&G.mapCode){
    codeEl.textContent=G.mapCode;
    var lastEl=document.getElementById('lastmapcode');
    if(lastEl)lastEl.textContent=G.mapCode;
  }
  sfx(G&&G.winner==='TIME'?'end':'win');
  ov.style.display='flex';setTimeout(function(){ov.style.opacity='1';},20);
  clearTimeout(window._autoMenuTimer);
  window._autoMenuTimer=setTimeout(function(){goToMenu();},5000);
}

/* INPUT */
document.addEventListener('keydown',function(e){resumeAudio();keys[e.key]=true;
  // Entrée dans le menu = JOUER
  if(e.key==='Enter'&&(!G||!gameRunning)){
    var ov=document.getElementById('ov');
    if(ov&&ov.style.display!=='none'){document.getElementById('btn-record-play').click();}
    return;
  }
  // $ en partie = relancer avec les mêmes réglages
  if(e.key==='$'&&G&&gameRunning){
    e.preventDefault();
    var _gm=GAMEMODE;
    seriesGame=0;seriesActive=false;seriesScores=[];
    // Désactiver l'option active avant de relancer
    if(ultimateMode)_ultimateDeactivate();
    // Si un code map avait été chargé, relancer avec le même code
    if(_lastMapCode){
      var _B36r='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      var payloadR=_lastMapCode.substring(1,_lastMapCode.length-2);
      var posIdxsR=[];var _pr=0;
      while(_pr<payloadR.length){
        var _remR=payloadR.length-_pr;
        if(_remR===2){posIdxsR.push(_B36r.indexOf(payloadR[_pr])*36+_B36r.indexOf(payloadR[_pr+1]));_pr+=2;}
        else if(_remR>=3){var _v2=_B36r.indexOf(payloadR[_pr])*1296+_B36r.indexOf(payloadR[_pr+1])*36+_B36r.indexOf(payloadR[_pr+2]);posIdxsR.push(Math.floor(_v2/121));posIdxsR.push(_v2%121);_pr+=3;}
        else break;
      }
      var _typesR=['coal','gold','diamond'];var _nR=posIdxsR.length/3;
      var allBlocksR=[];
      posIdxsR.forEach(function(idx,i){var t=_typesR[Math.floor(i/_nR)];var gx=Math.floor(idx/11)+1,gy=idx%11+1;if(gx>=1&&gx<=11&&gy>=1&&gy<=11)allBlocksR.push({gx:gx,gy:gy,type:t});});
      _preloadedBlocks=allBlocksR.length?allBlocksR:null;
    } else {
      _preloadedBlocks=null;
    }
    gameRunning=false;G=null;
    startGame(_gm);
    return;
  }
  if(!G||!gameRunning)return;
  if(e.key==='Escape'){
    if(shopOpen||tpMode||drillingMode||piqueMode){
      closeShop();tpMode=false;tpSrc=null;tpPlayer=null;
      bdAtk=null;blkAtk=null;metAtk=null;
      if(drillingMode){drillingMode=false;placePos=null;_hidePlaceInfo();}
      piqueMode=false;piquePlayer=null;
      return;
    }
    if(G&&gameRunning&&G.phase==='combat'){
      gamePaused=!gamePaused;
      document.getElementById('pauseov').style.display=gamePaused?'flex':'none';
    }
  }
  if(GAMEMODE==='coop'&&G.p2&&!G.p2.dead){
    if(e.key==='f'||e.key==='F'){var bd3=G.buildings.filter(function(b){return Math.hypot(G.p2.x-b.x,G.p2.y-b.y)<=1.6;}).sort(function(a,b2){return Math.hypot(G.p2.x-a.x,G.p2.y-a.y)-Math.hypot(G.p2.x-b2.x,G.p2.y-b2.y);})[0];if(bd3)activateBd(bd3,G.p2);}
    if(e.key==='r'||e.key==='R'){
      if((G.p2.atkCharge||0)>=1){
        var targets=[];
        G.buildings.forEach(function(b){if(b.type!=='factory'&&b.type!=='bank')targets.push({x:b.x,y:b.y});});
        G.blocks.forEach(function(b){targets.push({x:b.x,y:b.y});});
        if(targets.length){var near=targets.reduce(function(a,b){return Math.hypot(G.p2.x-a.x,G.p2.y-a.y)<Math.hypot(G.p2.x-b.x,G.p2.y-b.y)?a:b;});spearStrike(G.p2,near.x,near.y);}
        else spearStrike(G.p2,G.p2.x+1,G.p2.y);
        G.p2.atkCharge=0;
      } else {G.p2.atkCharge=0;}
    }
  }
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].indexOf(e.key)>=0)e.preventDefault();
  if(e.key==='ShiftRight'||e.code==='ShiftRight'){
    e.preventDefault();
    C.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:mouseX,clientY:mouseY}));
  }
});
document.addEventListener('keyup',function(e){keys[e.key]=false;});
// Reset inactivité sur toute action joueur
function _resetActivity(){if(gameRunning&&G&&G.phase==='combat')_lastActivityTime=Date.now();}
document.addEventListener('keydown',_resetActivity);
document.addEventListener('mousedown',_resetActivity);
document.addEventListener('touchstart',_resetActivity,{passive:true});
document.addEventListener('click',resumeAudio); // déclenche la mélodie dès le premier clic

function getGrid(e){var r=document.getElementById('cw').getBoundingClientRect();return{gx:Math.floor((e.clientX-r.left)/(r.width/CW)/TILE),gy:Math.floor((e.clientY-r.top)/(r.height/CH)/TILE)};}

C.addEventListener('click',function(e){
  if(!G)return;
  var pos=getGrid(e);
  // DESTRUCTION : détruire le bloc/foreuse cliqué
  if(_destructPending&&_selectionDelay<=0){
    var _db=G.blocks.filter(function(b){return b.gx===pos.gx&&b.gy===pos.gy;})[0];
    var _dd=G.buildings.filter(function(b){return(b.type==='drill'||b.type==='drillfast')&&b.gx===pos.gx&&b.gy===pos.gy;})[0];
    if(_db){G.blocks=G.blocks.filter(function(b){return b!==_db;});_destructPending=false;sfx('impact');}
    else if(_dd){G.buildings=G.buildings.filter(function(b){return b!==_dd;});_destructPending=false;sfx('impact');}
    if(!_destructPending){_selectionPending=_ghostPending;if(!_selectionPending)_hidePlaceInfo();else _showPlaceInfo('FANTÔME : cliquer un minerai ou foreuse');}
    return;
  }
  // FANTÔME : rendre traversable le bloc/foreuse cliqué
  if(_ghostPending&&_selectionDelay<=0){
    var _gb=G.blocks.filter(function(b){return b.gx===pos.gx&&b.gy===pos.gy&&!b.ghost;})[0];
    var _gd=G.buildings.filter(function(b){return(b.type==='drill'||b.type==='drillfast')&&b.gx===pos.gx&&b.gy===pos.gy&&!b.ghost;})[0];
    if(_gb){_gb.ghost=true;_ghostPending=false;sfx('tp');}
    else if(_gd){_gd.ghost=true;_ghostPending=false;sfx('tp');}
    if(!_ghostPending){_selectionPending=_destructPending;if(!_selectionPending)_hidePlaceInfo();else _showPlaceInfo('DÉTRUIRE : cliquer un minerai ou foreuse');}
    return;
  }
  if(drillingMode){var ok=cellFreePlace(pos.gx,pos.gy);if(ok){placePos={gx:pos.gx,gy:pos.gy,ok:true,locked:true};confirmDrill();}return;}
  if(G.phase==='placement'&&placeQueue.length){selectCell(pos.gx,pos.gy);if(placePos&&placePos.ok)confirmPlace();return;}
  if(tpMode){doTeleport(pos.gx,pos.gy);return;}
  if(G.phase!=='combat')return;
  var bd=G.buildings.filter(function(b){return b.gx===pos.gx&&b.gy===pos.gy;})[0];
  if(!bd)return;
  var actor=G.p1;
  if(GAMEMODE==='coop'&&G.p2&&!G.p2.dead){var d1=Math.hypot(G.p1.x-bd.x,G.p1.y-bd.y),d2=Math.hypot(G.p2.x-bd.x,G.p2.y-bd.y);if(d2<d1&&d2<=1.6)actor=G.p2;}
  if(Math.hypot(actor.x-bd.x,actor.y-bd.y)>1.6){log('Trop loin ! (1 case max)');return;}
  activateBd(bd,actor);
});

C.addEventListener('contextmenu',function(e){
  e.preventDefault();
  if(!G||G.phase!=='combat')return;
  var r=document.getElementById('cw').getBoundingClientRect();
  var worldX=(e.clientX-r.left)/(r.width/CW)/TILE;
  var worldY=(e.clientY-r.top)/(r.height/CH)/TILE;
  var actor=G.p1;
  if(GAMEMODE==='coop'&&G.p2&&!G.p2.dead){
    var d1=Math.hypot(G.p1.x-worldX,G.p1.y-worldY),d2=Math.hypot(G.p2.x-worldX,G.p2.y-worldY);
    if(d2<d1)actor=G.p2;
  }
  if((actor.atkCharge||0)>=1){spearStrike(actor,worldX,worldY);actor.atkCharge=0;}
  else{actor.atkCharge=0;}
});

C.addEventListener('dblclick',function(e){
  if(!G)return;var pos=getGrid(e);
  if(drillingMode){var ok=cellFreePlace(pos.gx,pos.gy);if(ok){placePos={gx:pos.gx,gy:pos.gy,ok:true,locked:true};confirmDrill();}return;}
  if(G.phase!=='placement'||!placeQueue.length)return;
  selectCell(pos.gx,pos.gy);if(placePos&&placePos.ok)confirmPlace();
});

/* CONTRÔLES TACTILES (mobile) */
var _touchMoveTarget=null;
var _touchActivateBd=null;
var _touchStartTime=0,_touchStartGx=0,_touchStartGy=0;
var _touchDragging=false;

function _getTouchGrid(touch){
  var r=document.getElementById('cw').getBoundingClientRect();
  var cx=(touch.clientX-r.left)*(CW/r.width);
  var cy=(touch.clientY-r.top)*(CH/r.height);
  return{gx:cx/TILE,gy:cy/TILE,igx:Math.floor(cx/TILE),igy:Math.floor(cy/TILE)};
}

C.addEventListener('touchstart',function(e){
  e.preventDefault();
  if(!G||!gameRunning)return;
  var t=e.touches[0];
  var tg=_getTouchGrid(t);
  _touchStartTime=Date.now();_touchStartGx=tg.gx;_touchStartGy=tg.gy;
  _touchDragging=false;
  // Prévisualiser la case en phase de placement
  if(G.phase==='placement'&&placeQueue.length){selectCell(tg.igx,tg.igy);}
},{passive:false});

C.addEventListener('touchmove',function(e){
  e.preventDefault();
  if(!G||!gameRunning)return;
  var t=e.touches[0];
  var tg=_getTouchGrid(t);
  var moved=Math.hypot(tg.gx-_touchStartGx,tg.gy-_touchStartGy);
  if(moved>0.3&&G.phase==='combat'&&!_selectionPending){
    _touchDragging=true;
    _touchMoveTarget={gx:tg.gx,gy:tg.gy};
    _touchActivateBd=null;
  }
  // Glisser pendant placement : mettre à jour la case sélectionnée
  if(G.phase==='placement'&&placeQueue.length&&moved>0.3){selectCell(tg.igx,tg.igy);}
},{passive:false});

C.addEventListener('touchend',function(e){
  e.preventDefault();
  if(!G||!gameRunning)return;
  var t=e.changedTouches[0];
  var tg=_getTouchGrid(t);
  var elapsed=Date.now()-_touchStartTime;
  var moved=Math.hypot(tg.gx-_touchStartGx,tg.gy-_touchStartGy);
  var isTap=!_touchDragging&&elapsed<400&&moved<0.5;

  // Fin de glisser : arrêter le mouvement
  if(_touchDragging){_touchDragging=false;_touchMoveTarget=null;return;}
  if(!isTap)return;

  // ─ Sélection DESTRUCTION (directement, sans faux clic souris)
  if(_destructPending&&_selectionDelay<=0){
    var _db=G.blocks.filter(function(b){return b.gx===tg.igx&&b.gy===tg.igy;})[0];
    var _dd=G.buildings.filter(function(b){return(b.type==='drill'||b.type==='drillfast')&&b.gx===tg.igx&&b.gy===tg.igy;})[0];
    if(_db){G.blocks=G.blocks.filter(function(b){return b!==_db;});_destructPending=false;sfx('impact');}
    else if(_dd){G.buildings=G.buildings.filter(function(b){return b!==_dd;});_destructPending=false;sfx('impact');}
    if(!_destructPending){_selectionPending=_ghostPending;if(!_selectionPending)_hidePlaceInfo();else _showPlaceInfo('FANTÔME : cliquer un minerai ou foreuse');}
    return;
  }

  // ─ Sélection FANTÔME (directement)
  if(_ghostPending&&_selectionDelay<=0){
    var _gb=G.blocks.filter(function(b){return b.gx===tg.igx&&b.gy===tg.igy&&!b.ghost;})[0];
    var _gd=G.buildings.filter(function(b){return(b.type==='drill'||b.type==='drillfast')&&b.gx===tg.igx&&b.gy===tg.igy&&!b.ghost;})[0];
    if(_gb){_gb.ghost=true;_ghostPending=false;sfx('tp');}
    else if(_gd){_gd.ghost=true;_ghostPending=false;sfx('tp');}
    if(!_ghostPending){_selectionPending=_destructPending;if(!_selectionPending)_hidePlaceInfo();else _showPlaceInfo('DÉTRUIRE : cliquer un minerai ou foreuse');}
    return;
  }

  // ─ Phase placement : confirmer la case sélectionnée
  if(G.phase==='placement'&&placeQueue.length){
    selectCell(tg.igx,tg.igy);
    if(placePos&&placePos.ok)confirmPlace();
    return;
  }

  // ─ Mode téléporteur
  if(tpMode){doTeleport(tg.igx,tg.igy);return;}

  // ─ Mode foreuse (drilling depuis shop)
  if(drillingMode){
    var _ok=cellFreePlace(tg.igx,tg.igy);
    if(_ok){placePos={gx:tg.igx,gy:tg.igy,ok:true,locked:true};confirmDrill();}
    return;
  }

  if(G.phase!=='combat')return;

  // ─ Tap sur un bâtiment : activer si proche, sinon marcher vers lui
  var bd=G.buildings.filter(function(b){return b.gx===tg.igx&&b.gy===tg.igy&&!b.ghost;})[0];
  if(bd){
    if(Math.hypot(G.p1.x-bd.x,G.p1.y-bd.y)<=1.8){
      activateBd(bd,G.p1);
    } else {
      _touchActivateBd=bd;
      _touchMoveTarget={gx:bd.gx+0.5,gy:bd.gy+0.5};
    }
    return;
  }

  // ─ Tap sur case vide : se déplacer
  _touchMoveTarget={gx:tg.gx,gy:tg.gy};
  _touchActivateBd=null;
},{passive:false});

/* START GAME */

function startGame(mode){
  GAMEMODE=mode;placeGen++;
  lightningTimer=35;lightningActive=false;lightningEnd=0;lightningBolt=[];

  // Réinitialiser MAP à la valeur par défaut
  MAP=13;CW=MAP*TILE;CH=MAP*TILE;
  C.width=CW;C.height=CH;
  floorC.width=CW;floorC.height=CH;
  resz();

  // Coûts aléatoires
  if(randomCostMode){
    var allRes=['coal','gold','diamond'];
    var _ct,_wr,_tries=0,_ok=false;
    while(!_ok&&_tries<500){
      _tries++;
      _wr=allRes[Math.floor(Math.random()*3)];
      _ct={
        drill:allRes[Math.floor(Math.random()*3)],
        dmg:allRes[Math.floor(Math.random()*3)],
        spd:allRes[Math.floor(Math.random()*3)],
        block:allRes[Math.floor(Math.random()*3)]
      };
      // Contrainte 1 : coût foreuse ≠ objectif
      if(_ct.drill===_wr)continue;
      // Contrainte 2 : aucun minerai n'est utilisé pour les 4 coûts à la fois
      var _cnt={coal:0,gold:0,diamond:0};
      ['drill','dmg','spd','block'].forEach(function(k){_cnt[_ct[k]]++;});
      if(Math.max(_cnt.coal,_cnt.gold,_cnt.diamond)>3)continue;
      _ok=true;
    }
    costTypes=_ct;
    winResource=_wr;
  } else {
    costTypes={drill:'coal',dmg:'gold',spd:'gold',block:'diamond'};
    winResource='diamond';
  }

  // ULTIME — pool fixe avec toutes les options, tirer la 1ère dès le début
  _ultimateActiveOpt=null;
  _ultimatePool=[];
  nightMode=false;speedMode=false;quadMineralMode=false;
  destructMode=false;ghostMode=false;
  if(ultimateMode){
    _ultimatePool=['night','speed','quad','destruct','ghost'];
    _destructTimer=26;_ghostTimer=26;
    if(!randomCostMode) costTypes={drill:'coal',dmg:'gold',spd:'gold',block:'diamond'};
    _ultimateTimer=60;
  }
  // Reset destruct/ghost
  _destructTimer=26;_ghostTimer=26;_destructPending=false;_ghostPending=false;_selectionPending=false;

  _gameUsedMapCode=!!_preloadedBlocks;
  G=initGame();G.phase_over=false;gameRunning=true;logLines=[];
  _lastActivityTime=Date.now();
  // ULTIME — tirer la première option dès le début de partie
  if(ultimateMode&&_ultimatePool.length){var _firstPool=randomCostMode?_ultimatePool.filter(function(o){return o!=='quad';}):_ultimatePool.slice();if(!_firstPool.length)_firstPool=_ultimatePool.slice();var _first=_firstPool[Math.floor(Math.random()*_firstPool.length)];_ultimateActivate(_first);_ultimateTimer=(_first==='speed')?120:60;}
  placeQueue=[];placePos=null;drillingMode=false;
  shopOpen=null;shopPlayer=null;piqueMode=false;piquePlayer=null;
  tpMode=false;tpSrc=null;tpPlayer=null;bdAtk=null;bdAtkTimer=0;bdAtkPlayer=null;
  blkAtk=null;blkAtkTimer=0;blkAtkPlayer=null;metAtk=null;metAtkTimer=0;metAtkPlayer=null;
  document.getElementById('shop').style.display='none';
  document.getElementById('pbar').style.display='none';
  document.getElementById('ov').style.display='none';
  document.getElementById('endov').style.display='none';
  document.getElementById('endov').style.opacity='0';
  document.getElementById('phase').textContent='PLACEMENT';
  var _mp=document.getElementById('mob-pause');if(_mp&&window.innerWidth<600)_mp.style.display='block';

  _updateRandomCostDisplay();

  var texId=GAMEMODE==='coop'?'tex-grass2':'tex-desert1';
  (function(){var bg=document.getElementById(texId)||document.getElementById('tex-desert1');
    if(bg)document.body.style.backgroundImage="url('"+bg.src+"')";})();
  (function(){
    var fc2=floorC.getContext('2d'),img2=new Image();
    floorReady=false;
    img2.onload=function(){
      fc2.clearRect(0,0,CW,CH);
      fc2.drawImage(img2,0,0,CW,CH);
      fc2.fillStyle='rgba(0,0,0,0.15)';fc2.fillRect(0,0,CW,CH);
      var vg2=fc2.createRadialGradient(CW/2,CH/2,CW*.05,CW/2,CH/2,CW*.72);
      vg2.addColorStop(0,'rgba(0,0,0,0)');vg2.addColorStop(1,'rgba(0,0,0,0.42)');
      fc2.fillStyle=vg2;fc2.fillRect(0,0,CW,CH);
      for(var wy=0;wy<MAP;wy++)for(var wx=0;wx<MAP;wx++){
        if(wx>0&&wx<MAP-1&&wy>0&&wy<MAP-1)continue;
        var wbx=wx*TILE,wby=wy*TILE,ws=(wx*41+wy*17)%11;
        fc2.fillStyle='rgba(26,18,9,0.97)';fc2.fillRect(wbx,wby,TILE,TILE);
        fc2.fillStyle='rgba('+(56+ws*2)+','+(40+ws)+','+(17+ws)+',0.88)';fc2.fillRect(wbx+5,wby+5,TILE-10,TILE-10);
        fc2.fillStyle='rgba(15,10,4,0.52)';
        if(ws%2===0)fc2.fillRect(wbx+5,wby+Math.round(TILE/2)-1,TILE-10,2);else fc2.fillRect(wbx+Math.round(TILE/2)-1,wby+5,2,TILE-10);
        fc2.strokeStyle='rgba(9,6,2,0.52)';fc2.lineWidth=1;
        fc2.beginPath();fc2.moveTo(wbx+7+ws*2,wby+11);fc2.lineTo(wbx+15+ws,wby+TILE*.37+ws);fc2.lineTo(wbx+11,wby+TILE*.63);fc2.stroke();
        if(ws%3!==2){fc2.beginPath();fc2.moveTo(wbx+TILE-13-ws,wby+9+ws);fc2.lineTo(wbx+TILE-19,wby+TILE*.43);fc2.stroke();}
        fc2.fillStyle='rgba(0,0,0,0.45)';fc2.fillRect(wbx,wby,TILE,4);fc2.fillRect(wbx,wby,4,TILE);
        fc2.fillStyle='rgba(0,0,0,0.22)';fc2.fillRect(wbx,wby+TILE-4,TILE,4);fc2.fillRect(wbx+TILE-4,wby,4,TILE);
        fc2.fillStyle='rgba(210,155,55,0.07)';fc2.fillRect(wbx+5,wby+5,TILE-10,3);
      }
      floorReady=true;
    };
    var texEl=document.getElementById(texId)||document.getElementById('tex-desert1');
    if(texEl)img2.src=texEl.src;else{floorReady=true;}
  })();

  document.getElementById('p1role').textContent=GAMEMODE==='solo'?'Solo':'Coop P1';
  document.getElementById('p2card').style.display=GAMEMODE==='solo'?'none':'';
  if(mode==='coop')document.getElementById('p2role').textContent='Coop P2';
  var isRec=(GAMEMODE==='solo'||GAMEMODE==='coop');
  ['p1','p2'].forEach(function(pfx){
    var hf=document.getElementById(pfx+'hf');if(hf)hf.parentNode.style.display=isRec?'none':'';
    var hn=document.getElementById(pfx+'hn');if(hn)hn.style.display=isRec?'none':'';
  });
  var isDiamondRace=(mode==='solo'&&soloDur===999)||(mode==='coop'&&coopDur===999);
  diamondRace=isDiamondRace;
  if(mode==='solo')SOLO_DUR=isDiamondRace?999999:soloDur*60;
  else if(mode==='coop')SOLO_DUR=isDiamondRace?999999:coopDur*60;


  var finEl=document.getElementById('btnfinish');
  if(finEl)finEl.style.display=(mode==='solo'||mode==='coop')?'block':'none';
  var modeLabel=mode==='solo'?'Solo':'Coop';
  var durLabel=isDiamondRace?diamondGoal+' ◆':mode==='solo'?soloDur:coopDur;
  log(modeLabel+(isDiamondRace?' — '+durLabel+' !':' — '+durLabel+' min !'));
  // Affichage du mode en haut de l'écran
  var _gmd=document.getElementById('gamemodedisp');
  if(_gmd){
    var _gmdSym={coal:'■',gold:'★',diamond:'◆'}[winResource]||'◆';
    var _mn=isDiamondRace?(diamondGoal+' '+_gmdSym):(mode==='solo'?soloDur+' MIN':'COOP '+coopDur+' MIN');
    _gmd.textContent=_mn;
  }

  gameNum=1+Math.floor(Math.random()*6);
  gamePaused=false;
  document.getElementById('pauseov').style.display='none';
  var gn=document.getElementById('gamename');
  if(gn){gn.textContent='#'+gameNum;gn.style.display='block';}
  document.getElementById('btnmidmenu').style.display='block';
  startPlacement();
}

function _updateRandomCostDisplay(){
  var rc=document.getElementById('randomcostinfo');
  if(!rc)return;
  if(randomCostMode&&gameRunning){
    var sym={coal:'■',gold:'★',diamond:'◆'};
    var col={coal:'#7a5828',gold:'#f0c030',diamond:'#80eeff'};
    var kLabels={drill:'Foreuse',dmg:'Dégâts',spd:'Vitesse',block:'Blocs'};
    var lines=Object.keys(costTypes).map(function(k){
      var r=costTypes[k];
      return kLabels[k]+' <span style="color:'+col[r]+'">'+sym[r]+'</span>';
    });
    var wr=winResource;
    var winLine='Objectif <span style="color:'+col[wr]+'">'+sym[wr]+'</span>';
    rc.innerHTML='<div style="opacity:0.5;font-size:11px;margin-bottom:3px;letter-spacing:2px">COÛTS</div>'+lines.join('<br>')+'<hr style="border-color:rgba(255,255,255,0.1);margin:4px 0">'+winLine;
    rc.style.display='block';
  } else {
    rc.style.display='none';
  }
}

/* WIRE BUTTONS */
document.getElementById('shop').addEventListener('click',function(e){
  var el=e.target.closest('[data-action]');
  if(!el||!shopOpen||!shopPlayer)return;
  var a=el.getAttribute('data-action');
  if(a==='drill')buyBd('drill');
  else if(a==='buy-coal')buyBlock('coal');
  else if(a==='buy-gold')buyBlock('gold');
  else if(a==='buy-diamond')buyBlock('diamond');
  else if(a==='dmg')buyUpg('dmg');
  else if(a==='spd')buyUpg('spd');
});
document.getElementById('btn-record-play').addEventListener('click',function(){
  mineralQty=6;
  if(recDur==='500d'){diamondRace=true;diamondGoal=500;soloDur=999;coopDur=999;}
  else if(recDur==='1000d'){diamondRace=true;diamondGoal=1000;soloDur=999;coopDur=999;}
  else if(recDur==='2000d'){diamondRace=true;diamondGoal=2000;soloDur=999;coopDur=999;}
  else if(recDur==='3000d'){diamondRace=true;diamondGoal=3000;soloDur=999;coopDur=999;}
  else{diamondRace=false;soloDur=recDur;coopDur=recDur;}
  var inp=document.getElementById('mapcodeload');
  var code=inp?inp.value.trim():'';
  if(code&&code.length>4&&code[0]==='R'){
    // Appliquer le code map puis lancer
    loadMapCode();
  } else {
    _preloadedBlocks=null;
    _lastMapCode=null;
    startGame('solo');
  }
});
document.getElementById('btnreplay').addEventListener('click',function(){
  clearTimeout(window._autoMenuTimer);
  startGame(GAMEMODE);
});
function goToMenu(){
  gameRunning=false;G=null;
  seriesGame=0;seriesActive=false;seriesScores=[];
  document.getElementById('btnreplay').textContent='REJOUER';
  document.getElementById('btnreplay').style.display='';
  gamePaused=false;
  document.getElementById('pauseov').style.display='none';
  closeShop();
  document.getElementById('endov').style.display='none';document.getElementById('endov').style.opacity='0';
  document.getElementById('pbar').style.display='none';document.getElementById('shop').style.display='none';
  document.getElementById('btnmidmenu').style.display='none';
  var finEl2=document.getElementById('btnfinish');if(finEl2)finEl2.style.display='none';
  var gn2=document.getElementById('gamename');if(gn2)gn2.style.display='none';
  var rcm=document.getElementById('randomcostinfo');if(rcm)rcm.style.display='none';
  document.getElementById('ov').style.display='flex';
  recSetDur(recDur);
  var _mp2=document.getElementById('mob-pause');if(_mp2)_mp2.style.display='none';
  _touchMoveTarget=null;_touchActivateBd=null;_touchDragging=false;
}
document.getElementById('btnpauseresume').addEventListener('click',function(){gamePaused=false;document.getElementById('pauseov').style.display='none';});
document.getElementById('btnpausemenu').addEventListener('click',function(){goToMenu();});
document.getElementById('btnmenu').addEventListener('click',function(){clearTimeout(window._autoMenuTimer);gameRunning=false;document.getElementById('endov').style.display='none';document.getElementById('endov').style.opacity='0';document.getElementById('ov').style.display='flex';});
document.getElementById('btnmidmenu').addEventListener('click',function(){
  if(confirm('Abandonner la partie et revenir au menu ?')){
    gameRunning=false;G=null;
    document.getElementById('pbar').style.display='none';document.getElementById('shop').style.display='none';
    document.getElementById('endov').style.display='none';document.getElementById('endov').style.opacity='0';
    document.getElementById('ov').style.display='flex';
  }
});
document.getElementById('pbc').addEventListener('click',function(){if(drillingMode)confirmDrill();else confirmPlace();});
var _finBtn=document.getElementById('btnfinish');
if(_finBtn)_finBtn.addEventListener('click',function(){
  if(!G||!gameRunning||G.phase!=='combat')return;
  G.phase='over';G.phase_over=true;G.winner='TIME';gameRunning=false;showEnd();
});
document.getElementById('sclose').addEventListener('click',closeShop);

// ── Record menu state ──
var _lastMapCode=null; // dernier code de map utilisé pour relancer avec $
var _gameUsedMapCode=false; // true si la partie en cours utilise un code de map
var _lastActivityTime=0;   // Date.now() de la dernière action joueur
var recDur='500d';
function recSetDur(d){
  recDur=d;
  document.querySelectorAll('.rec-dur').forEach(function(btn){
    var bDur=btn.getAttribute('data-dur');
    var active=bDur===String(d);
    var isRace=bDur==='500d'||bDur==='1000d'||bDur==='2000d'||bDur==='3000d';
    var col=isRace?'rgba(240,210,80,':'rgba(128,230,255,';
    btn.style.background=active?(col+'0.22)'):(col+'0.05)');
    btn.style.borderColor=active?(col+'0.8)'):(col+(isRace?'0.35':'0.25')+')');
    btn.style.color=active?(col+'1)'):(col+(isRace?'0.6':'0.55')+')');
    btn.style.fontWeight=active?'bold':'normal';
  });
}

function _toggleOpt(flag,btnId,colOn,colOff){
  var btn=document.getElementById(btnId);
  if(btn){
    btn.style.background=flag?colOn[0]:colOff[0];
    btn.style.borderColor=flag?colOn[1]:colOff[1];
    btn.style.color=flag?colOn[2]:colOff[2];
    btn.style.fontWeight=flag?'bold':'normal';
  }
}
function _ultimateDeactivate(){
  var opt=_ultimateActiveOpt;
  _ultimateActiveOpt=null;
  if(opt==='night') nightMode=false;
  else if(opt==='speed') speedMode=false;
  else if(opt==='quad'){quadMineralMode=false;if(G)G.blocks.forEach(function(b){delete b.quadTypes;});}
  else if(opt==='random'){randomCostMode=false;costTypes={drill:'coal',dmg:'gold',spd:'gold',block:'diamond'};_updateRandomCostDisplay();}
  else if(opt==='destruct') destructMode=false;
  else if(opt==='ghost') ghostMode=false;
}
function _ultimateActivate(opt){
  _ultimateActiveOpt=opt;
  if(opt==='night') nightMode=true;
  else if(opt==='speed') speedMode=true;
  else if(opt==='quad'){
    quadMineralMode=true;
    if(G){var qt=['coal','gold','diamond'];G.blocks.forEach(function(b){if(!b.quadTypes)b.quadTypes=[0,1,2,3].map(function(){return qt[Math.floor(Math.random()*3)];});});}
  }
  else if(opt==='random'){
    randomCostMode=true;
    var allRes=['coal','gold','diamond'];
    costTypes={drill:allRes[Math.floor(Math.random()*3)],dmg:allRes[Math.floor(Math.random()*3)],spd:allRes[Math.floor(Math.random()*3)],block:allRes[Math.floor(Math.random()*3)]};
    _updateRandomCostDisplay();
  }
  else if(opt==='shuffle') _ultimateShuffleMinerals();
  else if(opt==='destruct'){destructMode=true;_destructTimer=26;}
  else if(opt==='ghost'){ghostMode=true;_ghostTimer=26;}
}
function _ultimateShuffleMinerals(){
  if(!G||!G.blocks.length)return;
  var taken={};
  for(var _wy2=0;_wy2<MAP;_wy2++)for(var _wx2=0;_wx2<MAP;_wx2++){if(isWall(_wx2,_wy2))taken[_wx2+','+_wy2]=true;}
  G.buildings.forEach(function(b){taken[b.gx+','+b.gy]=true;});
  G.players.forEach(function(p){if(!p.dead){taken[Math.floor(p.x)+','+Math.floor(p.y)]=true;}});
  var free=[];
  for(var _cy=1;_cy<MAP-1;_cy++)for(var _cx=1;_cx<MAP-1;_cx++){if(!taken[_cx+','+_cy])free.push({gx:_cx,gy:_cy});}
  for(var _fi=free.length-1;_fi>0;_fi--){var _fj=Math.floor(Math.random()*(_fi+1));var _ft=free[_fi];free[_fi]=free[_fj];free[_fj]=_ft;}
  G.blocks.forEach(function(b,idx){if(idx<free.length){b.gx=free[idx].gx;b.gy=free[idx].gy;b.x=b.gx+.5;b.y=b.gy+.5;}});
}
function toggleRandomCostMode(){
  randomCostMode=!randomCostMode;
  _toggleOpt(randomCostMode,'btn-random',
    ['rgba(0,50,30,0.38)','rgba(50,220,130,0.75)','rgba(80,255,160,0.95)'],
    ['rgba(0,25,15,0.06)','rgba(30,150,80,0.25)','rgba(50,180,100,0.6)']);
}
/* MAP CODE */
function loadMapCode(){
  var inp=document.getElementById('mapcodeload');
  if(!inp)return;
  var code=inp.value.trim().toUpperCase();
  var _B36='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if(!code||code[0]!=='R'||code.length<4){alert('Code invalide.');return;}
  var payload=code.substring(1,code.length-2);
  var chkStr=code.slice(-2);
  var posIdxs=[];
  var _p=0;
  while(_p<payload.length){
    var _rem=payload.length-_p;
    if(_rem===2){
      var _a1=_B36.indexOf(payload[_p]),_b1=_B36.indexOf(payload[_p+1]);
      if(_a1<0||_b1<0){alert('Code invalide.');return;}
      posIdxs.push(_a1*36+_b1);_p+=2;
    } else if(_rem>=3){
      var _a2=_B36.indexOf(payload[_p]),_b2=_B36.indexOf(payload[_p+1]),_c2=_B36.indexOf(payload[_p+2]);
      if(_a2<0||_b2<0||_c2<0){alert('Code invalide.');return;}
      var _v=_a2*1296+_b2*36+_c2;
      if(_v>=14641){alert('Code invalide.');return;}
      posIdxs.push(Math.floor(_v/121));posIdxs.push(_v%121);_p+=3;
    } else {alert('Code invalide.');return;}
  }
  var _chkE=posIdxs.reduce(function(a,v,i){return a+v*(i+1);},0)%1296;
  var _ca=_B36.indexOf(chkStr[0]),_cb=_B36.indexOf(chkStr[1]);
  if(_ca<0||_cb<0||_ca*36+_cb!==_chkE){alert('Code incorrect.');return;}
  if(!posIdxs.length||posIdxs.length%3!==0){alert('Code invalide.');return;}
  var _n=posIdxs.length/3;
  var _types=['coal','gold','diamond'];
  var allBlocks=[];
  posIdxs.forEach(function(idx,i){
    var t=_types[Math.floor(i/_n)];
    var gx=Math.floor(idx/11)+1,gy=idx%11+1;
    if(gx>=1&&gx<=11&&gy>=1&&gy<=11)allBlocks.push({gx:gx,gy:gy,type:t});
  });
  if(!allBlocks.length){alert('Aucun minéral valide.');return;}
  _preloadedBlocks=allBlocks;
  _lastMapCode=code;
  startGame('solo');
  inp.value='';
}
function copyMapCode(){
  var el=document.getElementById('endmapcode');
  if(!el||!el.textContent)return;
  var fn=function(){el.style.color='rgba(128,255,128,0.9)';setTimeout(function(){el.style.color='';},1200);};
  if(navigator.clipboard){navigator.clipboard.writeText(el.textContent).then(fn).catch(function(){var ta=document.createElement('textarea');ta.value=el.textContent;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);fn();});}
  else{var ta=document.createElement('textarea');ta.value=el.textContent;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);fn();}
}

window.toggleRandomCostMode=toggleRandomCostMode;
window.loadMapCode=loadMapCode;
window.copyMapCode=copyMapCode;
window.recSetDur=recSetDur;
window.buyBd=buyBd;window.buyUpg=buyUpg;window.closeShop=closeShop;

requestAnimationFrame(function(ts){lastTime=ts;requestAnimationFrame(loop);});
recSetDur(recDur);updateMenuStats();

/* MENU GEAR */
(function(){
  var gc=document.getElementById('gear-bg');if(!gc)return;
  var GS=700;gc.width=GS;gc.height=GS;
  var gx2=gc.getContext('2d');
  var _gAng=0,_gLast=null;
  function animGear(ts){
    if(_gLast!==null)_gAng+=(ts-_gLast)/33333*Math.PI*2;
    _gLast=ts;
    gx2.clearRect(0,0,GS,GS);
    gx2.save();gx2.translate(GS/2,GS/2);gx2.rotate(_gAng);
    var teeth=20,R=310,r=255,rh=65,step=Math.PI*2/teeth,tw=step*0.38;
    gx2.beginPath();
    for(var i=0;i<teeth;i++){
      var a=i*step,a0=a-step/2+tw;
      if(i===0)gx2.moveTo(r*Math.cos(a0),r*Math.sin(a0));
      else gx2.lineTo(r*Math.cos(a0),r*Math.sin(a0));
      gx2.lineTo(R*Math.cos(a-tw),R*Math.sin(a-tw));
      gx2.lineTo(R*Math.cos(a+tw),R*Math.sin(a+tw));
      gx2.lineTo(r*Math.cos(a+step/2-tw),r*Math.sin(a+step/2-tw));
    }
    gx2.closePath();
    gx2.fillStyle='rgba(200,140,30,0.13)';gx2.fill();
    gx2.strokeStyle='rgba(200,140,30,0.32)';gx2.lineWidth=2;gx2.stroke();
    gx2.beginPath();gx2.arc(0,0,rh,0,Math.PI*2);
    gx2.fillStyle='rgba(0,0,0,0.25)';gx2.fill();
    gx2.strokeStyle='rgba(200,140,30,0.32)';gx2.lineWidth=2;gx2.stroke();
    for(var j=0;j<6;j++){
      var sa=j/6*Math.PI*2;
      gx2.beginPath();gx2.moveTo(rh*1.2*Math.cos(sa),rh*1.2*Math.sin(sa));gx2.lineTo((r-14)*Math.cos(sa),(r-14)*Math.sin(sa));
      gx2.strokeStyle='rgba(200,140,30,0.15)';gx2.lineWidth=14;gx2.stroke();
    }
    gx2.restore();
    requestAnimationFrame(animGear);
  }
  requestAnimationFrame(animGear);
})();
