/* MAIN LOOP */
function loop(ts){
  requestAnimationFrame(loop);
  var dt=Math.min((ts-lastTime)/1000,.05);lastTime=ts;
  if(speedMode)dt*=1.75;
  var isRecordMode=(GAMEMODE==='solo'||GAMEMODE==='coop'||GAMEMODE==='survivor');
  if(G&&gameRunning&&(G.phase==='combat'||(G.phase==='placement'&&isRecordMode))&&!gamePaused){
    G.time+=dt;
  }
  if(G&&gameRunning&&G.phase==='combat'&&!gamePaused){
    // Auto-pause après 30s d'inactivité (uniquement après les 4 foreuses de départ placées)
    // Le décompte est lui-même en pause pendant le placement d'une foreuse
    if(drillingMode)_lastActivityTime=Date.now();
    if(_startDrillsPlaced&&!drillingMode&&Date.now()-_lastActivityTime>30000){
      gamePaused=true;
      document.getElementById('pauseov').style.display='flex';
    }
    if(!drillingMode&&!_selectionPending){
      var dx=0,dy=0;
      if(keys[p1Keys.left])dx-=1;if(keys[p1Keys.right])dx+=1;
      if(keys[p1Keys.up])dy-=1;if(keys[p1Keys.down])dy+=1;
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
    // ULTIME — à la fin des 30s : déclencher l'effet, puis changer d'option après sélection
    if(ultimateMode&&_ultimatePool.length){
      _ultimateTimer-=dt;
      if(_ultimateTimer<=0&&!_ultimateSwitchPending){
        _ultimateSwitchPending=true;
        var _cur=_ultimateActiveOpt;
        if(_cur==='destruct'&&!_destructPending){_destructPending=true;_selectionPending=true;_selectionDelay=0.6;closeShop();_showPlaceInfo(t('msg_detruire'),'destruct');}
        else if(_cur==='ghost'&&!_ghostPending){_ghostPending=true;_selectionPending=true;_selectionDelay=0.6;closeShop();_showPlaceInfo(t('msg_fantome'),'ghost');}
        else if(_cur==='teleport'&&!_portalPending){_portalPending=true;_selectionPending=true;_selectionDelay=0.6;closeShop();_showPlaceInfo(t('msg_portail'),'portal');}
      }
      if(_ultimateSwitchPending&&!_selectionPending){
        _ultimateSwitchPending=false;
        var _prevOpt=_ultimateActiveOpt;
        _ultimateDeactivate();
        var _up=_ultimatePool.length>1&&_prevOpt?_ultimatePool.filter(function(p){return p!==_prevOpt;}):_ultimatePool.slice();
        var _nextOpt=_up[Math.floor(Math.random()*_up.length)];
        _ultimateActivate(_nextOpt);
        _ultimateTimer=(_nextOpt==='speed')?60:30;
      }
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
    updCombat(dt);updDrills(dt);updMeteors(dt);updBdAtk(dt);updBlkAtk(dt);updMetAtk(dt);updRocks(dt);updAI(dt);aiAutoCollect();updPiques(dt);updEnemies(dt);
    G.players.forEach(function(p){if(p&&!p.dead&&p.isHuman)p.atkCharge=Math.min(1,(p.atkCharge||0)+dt);});
    if((GAMEMODE==='solo'||GAMEMODE==='coop')&&!G.phase_over){
      var totalDia=(G.p1[winResource]||0)+(G.p2&&GAMEMODE==='coop'?(G.p2[winResource]||0):0);
      if(diamondRace){
        var _raceWin;
        if(diamondGoal===1000){
          var _tc=(G.p1.coal||0)+(G.p2&&GAMEMODE==='coop'?(G.p2.coal||0):0);
          var _tg=(G.p1.gold||0)+(G.p2&&GAMEMODE==='coop'?(G.p2.gold||0):0);
          var _td=(G.p1.diamond||0)+(G.p2&&GAMEMODE==='coop'?(G.p2.diamond||0):0);
          _raceWin=Math.min(_tc,_tg,_td)>=1000;
        } else {
          _raceWin=totalDia>=diamondGoal;
        }
        if(_raceWin){G.phase='over';G.phase_over=true;G.winner='DIAMOND';}
      } else if(!diamondRace&&G.time>=SOLO_DUR){G.phase='over';G.phase_over=true;G.winner='TIME';}
    }
    if(GAMEMODE==='survivor'&&!G.phase_over&&_startDrillsPlaced&&G.blocks.length===0){
      G.phase='over';G.phase_over=true;G.winner='SURVIVOR_END';
    }
    if(GAMEMODE==='boss'&&!G.phase_over){updBoss(dt);}
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
// Incrémenter cette version efface automatiquement le tableau de jeu de tous les joueurs
// (à faire à chaque changement de gameplay important affectant l'équilibrage des records)
var STATS_VERSION=8;
(function(){
  try{
    var v=localStorage.getItem('ruine_stats_version');
    if(v!==String(STATS_VERSION)){
      [500,1000,2000,3000].forEach(function(g){localStorage.removeItem('ruine_stats_'+g);}); // 3000 retiré du jeu, on nettoie son ancien stockage aussi
      localStorage.setItem('ruine_stats_version',String(STATS_VERSION));
    }
  }catch(e){}
})();
var SURVIVOR_STATS_VERSION=3;
(function(){
  try{
    var v=localStorage.getItem('ruine_survivor_stats_version');
    if(v!==String(SURVIVOR_STATS_VERSION)){
      localStorage.removeItem('ruine_survivor_stats');
      localStorage.setItem('ruine_survivor_stats_version',String(SURVIVOR_STATS_VERSION));
    }
  }catch(e){}
})();
function _statsKey(goal){return 'ruine_stats_'+goal;}
function _loadStats(goal){
  try{var s=JSON.parse(localStorage.getItem(_statsKey(goal)));return s||{wins:0,best:null};}
  catch(e){return{wins:0,best:null};}
}
function _saveStats(goal,wins,best){
  try{localStorage.setItem(_statsKey(goal),JSON.stringify({wins:wins,best:best!==undefined?best:null}));}catch(e){}
}
function _fmtTime(sec){return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(Math.floor(sec%60)).padStart(2,'0');}
function updateMenuStats(){
  var goals=[500,1000,2000];
  goals.forEach(function(g){
    var s=_loadStats(g);
    var wEl=document.getElementById('stat-wins-'+g);
    var bEl=document.getElementById('stat-best-'+g);
    if(wEl)wEl.textContent=s.wins||0;
    if(bEl)bEl.textContent=s.best!==null&&s.best!==undefined?_fmtTime(s.best):'—';
  });
}

/* STATS SURVIVANT */
function _loadSurvivorStats(){
  try{var s=JSON.parse(localStorage.getItem('ruine_survivor_stats'));return s||{bestKills:null,kills:0};}
  catch(e){return{bestKills:null,kills:0};}
}
function _saveSurvivorStats(bestKills,kills){
  try{localStorage.setItem('ruine_survivor_stats',JSON.stringify({bestKills:bestKills!==undefined?bestKills:null,kills:kills||0}));}catch(e){}
}
function updateSurvivorMenuStats(){
  var s=_loadSurvivorStats();
  var bEl=document.getElementById('stat-survivor-best');
  var kEl=document.getElementById('stat-survivor-kills');
  if(bEl)bEl.textContent=s.bestKills!==null&&s.bestKills!==undefined?s.bestKills:'—';
  if(kEl)kEl.textContent=s.kills||0;
}

/* STATS DÉFI DU JOUR — clé datée : le record d'hier devient automatiquement inaccessible */
function _dailyKey(date){return 'ruine_daily_'+date;}
function _loadDailyStats(date){
  try{var s=JSON.parse(localStorage.getItem(_dailyKey(date)));return s||{best:null};}
  catch(e){return{best:null};}
}
function _saveDailyStats(date,score,mode){
  // score : temps (secondes, lower=better) pour ruée/solo ; dégâts ou kills (higher=better) pour boss/survivor
  var higherBetter=(mode==='boss'||mode==='survivor');
  var s=_loadDailyStats(date);
  s.mode=mode;
  if(s.best===null||s.best===undefined||(higherBetter?score>s.best:score<s.best))s.best=score;
  try{localStorage.setItem(_dailyKey(date),JSON.stringify(s));}catch(e){}
}
function _fmtDailyBest(s){
  if(s.best===null||s.best===undefined)return'—';
  var m=s.mode||'solo';
  if(m==='boss')return Math.round(s.best)+' dmg';
  if(m==='survivor')return Math.round(s.best)+' kills';
  if(m==='solo')return Math.round(s.best)+' ♦';
  return _fmtTime(s.best); // temps pour ruée 500/1000/2000
}
function updateDailyMenuStats(){
  _setupDaily();
  var s=_loadDailyStats(_dailyDate);
  var bEl=document.getElementById('stat-daily-best');
  var dEl=document.getElementById('stat-daily-date');
  if(bEl)bEl.textContent=_fmtDailyBest(s);
  if(dEl)dEl.textContent=_dailyDate.slice(5);
}

/* STATS BOSS */
function _loadBossStats(){
  try{var s=JSON.parse(localStorage.getItem('ruine_boss_stats'));return s||{best:null,total:0};}
  catch(e){return{best:null,total:0};}
}
function _saveBossStats(best,total){
  try{localStorage.setItem('ruine_boss_stats',JSON.stringify({best:best!==undefined?best:null,total:total||0}));}catch(e){}
}
function updateBossMenuStats(){
  var s=_loadBossStats();
  var bEl=document.getElementById('stat-boss-best');
  var kEl=document.getElementById('stat-boss-kills');
  if(bEl)bEl.textContent=s.best!==null&&s.best!==undefined?s.best:'—';
  if(kEl)kEl.textContent=s.total||0;
}

function showEnd(){
  var ov=document.getElementById('endov');
  var totalD=(G.p1.diamond||0)+(G.p2&&GAMEMODE==='coop'?(G.p2.diamond||0):0);
  if(GAMEMODE==='solo'||GAMEMODE==='coop'){
    var _wsym={coal:'■',gold:'★',diamond:'◆'}[winResource]||'◆';
    var _wcol={coal:'#a07840',gold:'#f0c030',diamond:'#80eeff'}[winResource]||'#80eeff';
    var title='';
    if(diamondRace&&G.winner==='DIAMOND') title=diamondGoal+' '+_wsym+' !';
    else title=GAMEMODE==='coop'?t('end_coop'):t('end_finished');
    document.getElementById('endtitle').textContent=title;
    document.getElementById('endtitle').style.color=diamondRace&&G.winner==='DIAMOND'?'#f0d060':_wcol;
    var timeStr=document.getElementById('timer').textContent;
    var sub='';
    var _p1res=G.p1[winResource]||0;
    var _p2res=G.p2?(G.p2[winResource]||0):0;
    if(GAMEMODE==='coop'){
      sub=t('total_label')+': '+totalD+' '+_wsym+'  (P1: '+_p1res+' + P2: '+_p2res+')';
      sub+='  —  '+timeStr;
    } else {
      sub=_wsym+' '+totalD;
      if(diamondRace&&G.winner==='DIAMOND') sub+='  —  '+t('time_label')+': '+timeStr;
      else sub+='  —  '+timeStr;
    }
    document.getElementById('endsub').innerHTML=sub;
    // Enregistrement stats si victoire en diamondRace
    if(diamondRace&&G.winner==='DIAMOND'&&!_isDaily){
      var _sg=_loadStats(diamondGoal);
      // Victoires : toujours comptées (+0.5 si code map, +1 sinon)
      _sg.wins=Math.round(((_sg.wins||0)+(_gameUsedMapCode?0.5:1))*10)/10;
      var _elapsed=Math.round(G.time);
      if(_sg.best===null||_sg.best===undefined||_elapsed<_sg.best)_sg.best=_elapsed;
      _saveStats(diamondGoal,_sg.wins,_sg.best);
      updateMenuStats();
    }
    if(_isDaily&&G.winner==='DIAMOND'){
      _saveDailyStats(_dailyDate,Math.round(G.time),_dailyMode);
      updateDailyMenuStats();
    }
    // Défi solo chronométré (pas de ruée) : score = diamants récoltés
    if(_isDaily&&_dailyMode==='solo'&&!diamondRace){
      var _totalD=(G.p1.diamond||0);
      _saveDailyStats(_dailyDate,_totalD,'solo');
      updateDailyMenuStats();
    }
  } else if(GAMEMODE==='boss'){
    document.getElementById('endtitle').textContent=t('end_boss');
    document.getElementById('endtitle').style.color='#ff5030';
    document.getElementById('endsub').innerHTML=t('boss_dmg')+' : '+Math.round(bossDmgDealt);
    var _sgb=_loadBossStats();
    if(_sgb.best===null||_sgb.best===undefined||bossDmgDealt>_sgb.best)_sgb.best=Math.round(bossDmgDealt);
    _sgb.total=(_sgb.total||0)+Math.round(bossDmgDealt);
    _saveBossStats(_sgb.best,_sgb.total);
    updateBossMenuStats();
    if(_isDaily){
      _saveDailyStats(_dailyDate,Math.round(bossDmgDealt),'boss');
      updateDailyMenuStats();
    }
  } else if(GAMEMODE==='survivor'){
    document.getElementById('endtitle').textContent=t('end_survivor');
    document.getElementById('endtitle').style.color='#e05030';
    var timeStr2=document.getElementById('timer').textContent;
    document.getElementById('endsub').innerHTML=t('survivor_survived')+' : '+timeStr2+'  ·  '+t('survivor_wave')+' '+_survivorWave+'  ·  '+t('survivor_kills')+' : '+_survivorKillsThisGame;
    var _sgv=_loadSurvivorStats();
    if(_sgv.bestKills===null||_sgv.bestKills===undefined||_survivorKillsThisGame>_sgv.bestKills)_sgv.bestKills=_survivorKillsThisGame;
    _sgv.kills=(_sgv.kills||0)+_survivorKillsThisGame;
    _saveSurvivorStats(_sgv.bestKills,_sgv.kills);
    updateSurvivorMenuStats();
    if(_isDaily){
      _saveDailyStats(_dailyDate,_survivorKillsThisGame,'survivor');
      updateDailyMenuStats();
    }
  }
  if(GAMEMODE==='survivor'){
    var modeEl2=document.getElementById('endmode');
    if(modeEl2)modeEl2.innerHTML=t('mode_label')+' : '+t('mode_survivor');
  } else if(GAMEMODE==='boss'){
    var modeEl3=document.getElementById('endmode');
    if(modeEl3)modeEl3.innerHTML=t('mode_label')+' : BOSS';
  } else {
    var modeEl=document.getElementById('endmode');
    if(modeEl){
      var _wsym3={coal:'■',gold:'★',diamond:'◆'}[winResource]||'◆';
      var modeName=_isDaily?'DÉFI DU JOUR':(diamondRace?(diamondGoal+' '+_wsym3):(GAMEMODE==='solo'?'SOLO '+(SOLO_DUR/60|0)+'min':'COOP '+(SOLO_DUR/60|0)+'min'));
      modeEl.innerHTML=t('mode_label')+' : '+modeName+'  ·  '+mineralQty+'/type  ·  '+(totalD)+' '+_wsym3;
    }
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
document.addEventListener('keydown',function(e){
  if(_capturingKey){
    if(_capturingKey==='pause'){
      p1PauseKey=e.key;
      try{localStorage.setItem('ruine_pause_key',e.key);}catch(ex){}
    } else if(_capturingKey==='restart'){
      p1RestartKey=e.key;
      try{localStorage.setItem('ruine_restart_key',e.key);}catch(ex){}
    } else {
      p1Keys[_capturingKey]=e.key;
      try{localStorage.setItem('ruine_keys',JSON.stringify(p1Keys));}catch(ex){}
    }
    _updateKeyDisplay();_capturingKey=null;e.preventDefault();return;
  }
  keys[e.key]=true;
  // Entrée dans le menu = JOUER
  if(e.key==='Enter'&&(!G||!gameRunning)){
    var ov=document.getElementById('ov');
    if(ov&&ov.style.display!=='none'){document.getElementById('btn-record-play').click();}
    return;
  }
  if(!G||!gameRunning)return;
  if(e.key==='Escape'||e.key===p1PauseKey){
    if(e.key==='Escape'&&(shopOpen||tpMode||drillingMode||piqueMode)){
      closeShop();tpMode=false;tpSrc=null;tpPlayer=null;
      bdAtk=null;blkAtk=null;metAtk=null;
      if(drillingMode){
        if(_drillRefund){
          var _rf=_drillRefund;
          _rf.player[_rf.type]=(_rf.player[_rf.type]||0)+_rf.amount;
          if(_rf.blocksBought)_rf.player.blocksBought=Math.max(0,(_rf.player.blocksBought||0)-1);
          log('Achat annulé, remboursé : '+_rf.amount+' '+_cNames[_rf.type]);
          _drillRefund=null;
        }
        drillingMode=false;placePos=null;_hidePlaceInfo();
      }
      piqueMode=false;piquePlayer=null;
      return;
    }
    // ESC annule les sélections d'Ultime en cours (déblocage du joueur)
    if(e.key==='Escape'&&_selectionPending){
      _destructPending=false;_ghostPending=false;_portalPending=false;
      _inversionPending=false;_inversionFirst=null;_selectionPending=false;
      if(!_inversionShopMode)_ultimateSwitchPending=true;
      _inversionShopMode=false;
      _hidePlaceInfo();
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
document.addEventListener('keyup',function(e){keys[e.key]=false;if(e.key===p1RestartKey&&_restartHoldT){clearTimeout(_restartHoldT);_restartHoldT=null;_restartFadeCancel();}});
window.addEventListener('blur',function(){keys={};if(_restartHoldT){clearTimeout(_restartHoldT);_restartHoldT=null;_restartFadeCancel();}});
document.addEventListener('visibilitychange',function(){if(document.hidden){keys={};if(_restartHoldT){clearTimeout(_restartHoldT);_restartHoldT=null;_restartFadeCancel();}}});
var _restartHoldT=null;
var _RESTART_HOLD_MS=1000;
function _restartFadeStart(ms){
  var el=document.getElementById('restartFade');
  if(el){el.style.transition='opacity '+ms+'ms linear';el.style.opacity='1';}
}
function _restartFadeCancel(){
  var el=document.getElementById('restartFade');
  if(el){el.style.transition='opacity 200ms ease';el.style.opacity='0';}
}
function _doRestart(){
  var _gm=GAMEMODE;
  seriesGame=0;seriesActive=false;seriesScores=[];
  // Désactiver l'option active avant de relancer
  if(ultimateMode)_ultimateDeactivate();
  // Défi du jour : relancer avec la même seed (carte identique)
  if(_isDaily){_initSeedOverride=_dailySeed;}
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
  _restartFadeCancel();
}
document.addEventListener('keydown',function(e){
  if(e.key===p1RestartKey&&!_restartHoldT&&gameRunning&&G){
    e.preventDefault();
    _restartFadeStart(_RESTART_HOLD_MS);
    _restartHoldT=setTimeout(function(){
      _restartHoldT=null;
      _doRestart();
    },_RESTART_HOLD_MS);
  }
});
// Reset inactivité sur toute action joueur
function _resetActivity(){if(gameRunning&&G&&G.phase==='combat')_lastActivityTime=Date.now();}

/* Chargement des paramètres sauvegardés */
(function(){
  try{
    var _l=localStorage.getItem('ruine_lang');if(_l)gameLanguage=_l;
    var _n=localStorage.getItem('ruine_nick');if(_n!==null)playerNickname=_n;
    var _k=localStorage.getItem('ruine_keys');if(_k){var _pk=JSON.parse(_k);if(_pk&&_pk.up)p1Keys=_pk;}
    var _psk=localStorage.getItem('ruine_pause_key');if(_psk)p1PauseKey=_psk;
    var _rsk=localStorage.getItem('ruine_restart_key');if(_rsk)p1RestartKey=_rsk;
  }catch(e){}
  applyLanguage();
})();
document.addEventListener('keydown',_resetActivity);
document.addEventListener('mousedown',_resetActivity);
document.addEventListener('touchstart',_resetActivity,{passive:true});

/* Clic molette (bouton du milieu) : ne doit rien faire (pas d'autoscroll, pas d'action jeu) */
document.addEventListener('mousedown',function(e){if(e.button===1)e.preventDefault();});
document.addEventListener('auxclick',function(e){if(e.button===1)e.preventDefault();});

function getGrid(e){var r=document.getElementById('cw').getBoundingClientRect();return{gx:Math.floor((e.clientX-r.left)/(r.width/CW)/TILE),gy:Math.floor((e.clientY-r.top)/(r.height/CH)/TILE)};}

function _inversionIsPlayer(obj){return G&&G.players&&G.players.indexOf(obj)>=0;}
function _inversionPick(gx,gy){
  // Joueur sur cette case ?
  var pl=G.players.filter(function(p){return!p.dead&&Math.floor(p.x)===gx&&Math.floor(p.y)===gy;})[0];
  if(pl)return pl;
  var blk=G.blocks.filter(function(b){return b.gx===gx&&b.gy===gy;})[0];
  if(blk)return blk;
  return G.buildings.filter(function(b){return(b.type==='drill'||b.type==='drillfast'||b.type==='factory'||b.type==='teleporter')&&b.gx===gx&&b.gy===gy;})[0]||null;
}
function _inversionDoSwap(a,b){
  var aIsP=_inversionIsPlayer(a),bIsP=_inversionIsPlayer(b);
  if(!aIsP&&!bIsP){
    var t1gx=a.gx,t1gy=a.gy,t1x=a.x,t1y=a.y;
    a.gx=b.gx;a.gy=b.gy;a.x=b.x;a.y=b.y;
    b.gx=t1gx;b.gy=t1gy;b.x=t1x;b.y=t1y;
  } else if(aIsP&&!bIsP){
    var px=a.x,py=a.y;
    a.x=b.x;a.y=b.y;
    b.gx=Math.max(1,Math.min(MAP-2,Math.floor(px)));b.gy=Math.max(1,Math.min(MAP-2,Math.floor(py)));b.x=b.gx+0.5;b.y=b.gy+0.5;
  } else if(!aIsP&&bIsP){
    var px2=b.x,py2=b.y;
    b.x=a.x;b.y=a.y;
    a.gx=Math.max(1,Math.min(MAP-2,Math.floor(px2)));a.gy=Math.max(1,Math.min(MAP-2,Math.floor(py2)));a.x=a.gx+0.5;a.y=a.gy+0.5;
  } else {
    var px3=a.x,py3=a.y;a.x=b.x;a.y=b.y;b.x=px3;b.y=py3;
  }
}
function _inversionTrySelect(gx,gy){
  var tgt=_inversionPick(gx,gy);
  if(!tgt)return;
  if(!_inversionFirst){_inversionFirst=tgt;_showPlaceInfo(t('msg_inversion_pick2'),'inversion');}
  else if(tgt!==_inversionFirst){
    _inversionDoSwap(_inversionFirst,tgt);
    _inversionPending=false;_inversionFirst=null;_selectionPending=false;_inversionShopMode=false;
    _hidePlaceInfo();sfx('tp');log(t('log_inversion'));
  }
}

/* Overlay placement : capte tous les clics et mouvements pendant la phase de placement */
(function(){
  var ov=document.getElementById('place-overlay');
  ov.addEventListener('click',function(e){
    if(!G||G.phase!=='placement'||!placeQueue.length)return;
    var pos=getGrid(e);
    if(pos.gx<1||pos.gx>=MAP-1||pos.gy<1||pos.gy>=MAP-1)return;
    selectCell(pos.gx,pos.gy);
    if(placePos&&placePos.ok)confirmPlace();
  });
  ov.addEventListener('mousemove',function(e){
    if(!G||G.phase!=='placement'||!placeQueue.length)return;
    var pos=getGrid(e);
    if(pos.gx<0||pos.gx>=MAP||pos.gy<0||pos.gy>=MAP)return;
    var ok=cellFreePlace(pos.gx,pos.gy);
    placePos={gx:pos.gx,gy:pos.gy,ok:ok,locked:true};
  });
})();

document.addEventListener('click',function(e){
  if(!G||!gameRunning)return;
  // Ignorer les clics sur les éléments d'interface (boutons, overlays, shop…)
  if(e.target&&e.target.closest){
    if(e.target.closest('.ovl,#shop,#pbar,#pauseov,#gamebtn,#mob-pause,#rulesov'))return;
  }
  // Ne traiter que les clics dans la zone du canvas
  var _cr=document.getElementById('cw').getBoundingClientRect();
  if(e.clientX<_cr.left||e.clientX>_cr.right||e.clientY<_cr.top||e.clientY>_cr.bottom)return;
  var pos=getGrid(e);
  // PORTAIL : poser le portail sur une case libre
  if(_portalPending&&_selectionDelay<=0){
    if(!cellOcc(pos.gx,pos.gy)){
      var _pb=mkBd('portal',pos.gx,pos.gy,0);_pb.ghost=true;
      G.buildings.push(_pb);
      _portalPending=false;_selectionPending=false;_hidePlaceInfo();sfx('tp');log(t('log_portail'));
    } else log(t('log_occ'));
    return;
  }
  // INVERSION : sélectionner 2 minerais/foreuses et les échanger
  if(_inversionPending&&_selectionDelay<=0){
    _inversionTrySelect(pos.gx,pos.gy);
    return;
  }
  // DESTRUCTION : détruire le bloc/foreuse cliqué
  if(_destructPending&&_selectionDelay<=0){
    var _db=G.blocks.filter(function(b){return b.gx===pos.gx&&b.gy===pos.gy;})[0];
    var _dd=G.buildings.filter(function(b){return(b.type==='drill'||b.type==='drillfast'||b.type==='portal')&&b.gx===pos.gx&&b.gy===pos.gy;})[0];
    if(_db){G.blocks=G.blocks.filter(function(b){return b!==_db;});_destructPending=false;sfx('impact');}
    else if(_dd){G.buildings=G.buildings.filter(function(b){return b!==_dd;});_destructPending=false;sfx('impact');}
    if(!_destructPending){_selectionPending=_ghostPending;if(!_selectionPending)_hidePlaceInfo();else _showPlaceInfo(t('msg_fantome'),'ghost');}
    return;
  }
  // FANTÔME : rendre traversable le bloc/foreuse cliqué
  if(_ghostPending&&_selectionDelay<=0){
    var _gb=G.blocks.filter(function(b){return b.gx===pos.gx&&b.gy===pos.gy&&!b.ghost;})[0];
    var _gd=G.buildings.filter(function(b){return(b.type==='drill'||b.type==='drillfast'||b.type==='factory')&&b.gx===pos.gx&&b.gy===pos.gy&&!b.ghost;})[0];
    if(_gb){_gb.ghost=true;_ghostPending=false;sfx('tp');}
    else if(_gd){_gd.ghost=true;_ghostPending=false;sfx('tp');}
    if(!_ghostPending){_selectionPending=_destructPending;if(!_selectionPending)_hidePlaceInfo();else _showPlaceInfo(t('msg_detruire'),'destruct');}
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

  // ─ Sélection PORTAIL (directement, sans faux clic souris)
  if(_portalPending&&_selectionDelay<=0){
    if(!cellOcc(tg.igx,tg.igy)){
      var _pb2=mkBd('portal',tg.igx,tg.igy,0);_pb2.ghost=true;
      G.buildings.push(_pb2);
      _portalPending=false;_selectionPending=false;_hidePlaceInfo();sfx('tp');log(t('log_portail'));
    } else log(t('log_occ'));
    return;
  }

  // ─ Sélection INVERSION (directement, sans faux clic souris)
  if(_inversionPending&&_selectionDelay<=0){
    _inversionTrySelect(tg.igx,tg.igy);
    return;
  }

  // ─ Sélection DESTRUCTION (directement, sans faux clic souris)
  if(_destructPending&&_selectionDelay<=0){
    var _db=G.blocks.filter(function(b){return b.gx===tg.igx&&b.gy===tg.igy;})[0];
    var _dd=G.buildings.filter(function(b){return(b.type==='drill'||b.type==='drillfast'||b.type==='portal')&&b.gx===tg.igx&&b.gy===tg.igy;})[0];
    if(_db){G.blocks=G.blocks.filter(function(b){return b!==_db;});_destructPending=false;sfx('impact');}
    else if(_dd){G.buildings=G.buildings.filter(function(b){return b!==_dd;});_destructPending=false;sfx('impact');}
    if(!_destructPending){_selectionPending=_ghostPending;if(!_selectionPending)_hidePlaceInfo();else _showPlaceInfo(t('msg_fantome'),'ghost');}
    return;
  }

  // ─ Sélection FANTÔME (directement)
  if(_ghostPending&&_selectionDelay<=0){
    var _gb=G.blocks.filter(function(b){return b.gx===tg.igx&&b.gy===tg.igy&&!b.ghost;})[0];
    var _gd=G.buildings.filter(function(b){return(b.type==='drill'||b.type==='drillfast'||b.type==='factory')&&b.gx===tg.igx&&b.gy===tg.igy&&!b.ghost;})[0];
    if(_gb){_gb.ghost=true;_ghostPending=false;sfx('tp');}
    else if(_gd){_gd.ghost=true;_ghostPending=false;sfx('tp');}
    if(!_ghostPending){_selectionPending=_destructPending;if(!_selectionPending)_hidePlaceInfo();else _showPlaceInfo(t('msg_detruire'),'destruct');}
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
  if(mode==='survivor'){_survivorWave=0;_survivorKillsThisGame=0;}

  // Réinitialiser MAP à la valeur par défaut
  MAP=13;CW=MAP*TILE;CH=MAP*TILE;
  C.width=CW;C.height=CH;
  floorC.width=CW;floorC.height=CH;
  resz();

  costTypes={drill:'coal',dmg:'gold',spd:'gold'};
  winResource='diamond';

  // ULTIME — pool fixe avec toutes les options, tirer la 1ère dès le début
  _ultimateActiveOpt=null;
  _ultimatePool=[];
  nightMode=false;speedMode=false;teleportMode=false;
  destructMode=false;ghostMode=false;
  _portalPending=false;_inversionPending=false;_inversionFirst=null;_inversionShopMode=false;
  ultimateMode=true;
  if(ultimateMode){
    // Le Défi du jour fixe la seed de la carte, mais l'option ULTIME reste totalement
    // aléatoire et change au cours de la partie, comme dans les autres modes.
    _ultimatePool=['night','speed','teleport','destruct','ghost'];
    _destructTimer=30;_ghostTimer=30;_teleportTimer=26;
    costTypes={drill:'coal',dmg:'gold',spd:'gold'};
    _ultimateTimer=30;
  }
  // Reset destruct/ghost/teleport
  _destructTimer=30;_ghostTimer=30;_teleportTimer=26;
  _destructPending=false;_ghostPending=false;_portalPending=false;_inversionPending=false;_inversionFirst=null;_inversionShopMode=false;_selectionPending=false;_ultimateSwitchPending=false;

  _startDrillsPlaced=false;
  _gameUsedMapCode=!!_preloadedBlocks;
  G=initGame();G.phase_over=false;gameRunning=true;logLines=[];
  if(G.p1)G.p1.name=playerNickname;
  _lastActivityTime=Date.now();
  if(mode==='boss')_startBoss();
  // ULTIME — la première option se déclenche après le placement des 4 foreuses (dans nextPlace)
  placeQueue=[];placePos=null;drillingMode=false;
  shopOpen=null;shopPlayer=null;piqueMode=false;piquePlayer=null;
  tpMode=false;tpSrc=null;tpPlayer=null;bdAtk=null;bdAtkTimer=0;bdAtkPlayer=null;
  blkAtk=null;blkAtkTimer=0;blkAtkPlayer=null;metAtk=null;metAtkTimer=0;metAtkPlayer=null;
  // Thème aléatoire à chaque partie
  setTheme(Math.floor(Math.random()*3));
  document.getElementById('shop').style.display='none';
  document.getElementById('pbar').style.display='none';
  var _cwEl2=document.getElementById('cw');if(_cwEl2)_cwEl2.style.visibility='';
  var _hudS=document.querySelector('.hud');if(_hudS)_hudS.style.visibility='';
  var _lpS=document.getElementById('leftpanel');if(_lpS)_lpS.style.visibility='';
  var _khS=document.getElementById('kh');if(_khS)_khS.style.visibility='';
  document.getElementById('ov').style.display='none';
  document.getElementById('endov').style.display='none';
  document.getElementById('endov').style.opacity='0';
  document.getElementById('phase').textContent=t('phase_placement');
  var _mp=document.getElementById('mob-pause');if(_mp&&window.innerWidth<600)_mp.style.display='block';

  document.body.style.backgroundImage='none';
  (function(){
    var fc2=floorC.getContext('2d');
    floorReady=false;
    fc2.clearRect(0,0,CW,CH);

    var _h=function(n){var x=Math.sin(n+13.753)*48271.8;return x-Math.floor(x);};

    if(gameTheme===1){
      /* ── SOL VOLCANIQUE ── */
      var _bg=fc2.createLinearGradient(TILE,TILE,CW-TILE,CH-TILE);
      _bg.addColorStop(0,'#180800');_bg.addColorStop(0.3,'#0e0400');
      _bg.addColorStop(0.65,'#200a02');_bg.addColorStop(1,'#080200');
      fc2.fillStyle=_bg;fc2.fillRect(0,0,CW,CH);
      for(var _pi=0;_pi<28;_pi++){
        var _ppx=TILE+_h(_pi*211.3+3)*(CW-2*TILE),_ppy=TILE+_h(_pi*317.7+9)*(CH-2*TILE);
        var _pr=30+_h(_pi*53.1)*80,_pa=0.14+_h(_pi*19.7)*0.22;
        var _lavaCols=[[255,60,0],[200,30,0],[255,110,10],[180,20,0]];
        var _pc=_lavaCols[_pi%4];
        var _pg=fc2.createRadialGradient(_ppx,_ppy,0,_ppx,_ppy,_pr);
        _pg.addColorStop(0,'rgba('+_pc[0]+','+_pc[1]+','+_pc[2]+','+_pa.toFixed(2)+')');
        _pg.addColorStop(0.5,'rgba('+_pc[0]+','+_pc[1]+','+_pc[2]+','+(_pa*0.22).toFixed(2)+')');
        _pg.addColorStop(1,'rgba(0,0,0,0)');
        fc2.fillStyle=_pg;fc2.fillRect(_ppx-_pr,_ppy-_pr,_pr*2,_pr*2);
      }
      for(var _gi=0;_gi<9000;_gi++){
        var _gx=TILE+_h(_gi*1.618)*(CW-2*TILE),_gy=TILE+_h(_gi*2.718)*(CH-2*TILE);
        var _ga=_h(_gi*3.14)*0.22+0.05,_gsz=_h(_gi*1.41)*2.5+0.35;
        if(_gi%5===0)fc2.fillStyle='rgba(255,80,5,'+_ga+')';
        else if(_gi%5===1)fc2.fillStyle='rgba(30,12,2,'+(_ga*1.2)+')';
        else if(_gi%5===2)fc2.fillStyle='rgba(70,30,5,'+(_ga*0.8)+')';
        else if(_gi%5===3)fc2.fillStyle='rgba(140,50,5,'+(_ga*0.55)+')';
        else fc2.fillStyle='rgba(255,150,30,'+(_ga*0.4)+')';
        fc2.beginPath();fc2.ellipse(_gx,_gy,_gsz,_gsz*0.45,_h(_gi*2.2)*Math.PI,0,Math.PI*2);fc2.fill();
      }
      for(var _ti=0;_ti<45;_ti++){
        var _tx=TILE+_h(_ti*113.7+3)*(CW-2*TILE),_ty=TILE+_h(_ti*97.3+5)*(CH-2*TILE);
        var _tl=20+_h(_ti*43.1)*50,_tang=_h(_ti*67.3)*Math.PI;
        fc2.strokeStyle=(_ti%2===0?'rgba(60,25,5,':'rgba(255,100,10,')+( 0.10+_h(_ti*31.9)*0.14)+')';
        fc2.lineWidth=0.8+_h(_ti*19.7)*1.6;
        fc2.beginPath();fc2.moveTo(_tx,_ty);fc2.lineTo(_tx+Math.cos(_tang)*_tl,_ty+Math.sin(_tang)*_tl);fc2.stroke();
      }
      for(var _di=0;_di<18;_di++){
        var _dby=TILE+(_di*(CH-2*TILE)/18)+_h(_di*47.3)*28-14;
        var _damp=18+_h(_di*31.1)*22,_dfreq=0.012+_h(_di*23.7)*0.018,_dvis=0.22+_h(_di*17.3)*0.28;
        fc2.strokeStyle='rgba(220,60,0,'+_dvis+')';fc2.lineWidth=1.4+_h(_di*53.7)*1.8;fc2.beginPath();
        for(var _ddx=TILE;_ddx<=CW-TILE;_ddx+=2){
          var _ddy=_dby+Math.sin(_ddx*_dfreq+_di*1.35)*_damp+Math.sin(_ddx*(_dfreq*0.55)+_di*2.1)*(_damp*0.48);
          if(_ddx===TILE)fc2.moveTo(_ddx,_ddy);else fc2.lineTo(_ddx,_ddy);
        }fc2.stroke();
        fc2.strokeStyle='rgba(255,200,80,'+(_dvis*0.55)+')';fc2.lineWidth=0.6;fc2.beginPath();
        for(var _ddx2=TILE;_ddx2<=CW-TILE;_ddx2+=2){
          var _ddy2=_dby+Math.sin(_ddx2*_dfreq+_di*1.35)*_damp+Math.sin(_ddx2*(_dfreq*0.55)+_di*2.1)*(_damp*0.48);
          if(_ddx2===TILE)fc2.moveTo(_ddx2,_ddy2);else fc2.lineTo(_ddx2,_ddy2);
        }fc2.stroke();
      }
    } else if(gameTheme===2){
      /* ── SOL GLACIAL ── */
      var _bg=fc2.createLinearGradient(TILE,TILE,CW-TILE,CH-TILE);
      _bg.addColorStop(0,'#a0c0d8');_bg.addColorStop(0.3,'#88aac8');
      _bg.addColorStop(0.65,'#94b8d4');_bg.addColorStop(1,'#6888a8');
      fc2.fillStyle=_bg;fc2.fillRect(0,0,CW,CH);
      for(var _pi=0;_pi<30;_pi++){
        var _ppx=TILE+_h(_pi*211.3+3)*(CW-2*TILE),_ppy=TILE+_h(_pi*317.7+9)*(CH-2*TILE);
        var _pr=45+_h(_pi*53.1)*100,_pa=0.16+_h(_pi*19.7)*0.26;
        var _iceCols=[[255,255,255],[195,225,248],[175,210,238],[220,240,255]];
        var _pc=_iceCols[_pi%4];
        var _pg=fc2.createRadialGradient(_ppx,_ppy,0,_ppx,_ppy,_pr);
        _pg.addColorStop(0,'rgba('+_pc[0]+','+_pc[1]+','+_pc[2]+','+_pa.toFixed(2)+')');
        _pg.addColorStop(0.5,'rgba('+_pc[0]+','+_pc[1]+','+_pc[2]+','+(_pa*0.28).toFixed(2)+')');
        _pg.addColorStop(1,'rgba(0,0,0,0)');
        fc2.fillStyle=_pg;fc2.fillRect(_ppx-_pr,_ppy-_pr,_pr*2,_pr*2);
      }
      for(var _gi=0;_gi<9000;_gi++){
        var _gx=TILE+_h(_gi*1.618)*(CW-2*TILE),_gy=TILE+_h(_gi*2.718)*(CH-2*TILE);
        var _ga=_h(_gi*3.14)*0.24+0.05,_gsz=_h(_gi*1.41)*2.5+0.35;
        if(_gi%5===0)fc2.fillStyle='rgba(255,255,255,'+_ga+')';
        else if(_gi%5===1)fc2.fillStyle='rgba(50,90,130,'+(_ga*0.75)+')';
        else if(_gi%5===2)fc2.fillStyle='rgba(140,195,228,'+(_ga*0.65)+')';
        else if(_gi%5===3)fc2.fillStyle='rgba(30,55,90,'+(_ga*0.8)+')';
        else fc2.fillStyle='rgba(210,238,255,'+(_ga*0.5)+')';
        fc2.beginPath();fc2.ellipse(_gx,_gy,_gsz,_gsz*0.48,_h(_gi*2.2)*Math.PI,0,Math.PI*2);fc2.fill();
      }
      for(var _ti=0;_ti<55;_ti++){
        var _tx=TILE+_h(_ti*113.7+3)*(CW-2*TILE),_ty=TILE+_h(_ti*97.3+5)*(CH-2*TILE);
        var _tl=20+_h(_ti*43.1)*50,_tang=_h(_ti*67.3)*Math.PI*0.55+0.1;
        fc2.strokeStyle=(_ti%3===0?'rgba(255,255,255,':'rgba(90,155,200,')+(0.10+_h(_ti*31.9)*0.16)+')';
        fc2.lineWidth=0.6+_h(_ti*19.7)*1.3;
        fc2.beginPath();fc2.moveTo(_tx,_ty);fc2.lineTo(_tx+Math.cos(_tang)*_tl,_ty+Math.sin(_tang)*_tl);fc2.stroke();
      }
      for(var _di=0;_di<24;_di++){
        var _dby=TILE+(_di*(CH-2*TILE)/24)+_h(_di*47.3)*22-11;
        var _damp=12+_h(_di*31.1)*16,_dfreq=0.018+_h(_di*23.7)*0.022,_dvis=0.16+_h(_di*17.3)*0.22;
        fc2.strokeStyle='rgba(200,230,255,'+_dvis+')';fc2.lineWidth=0.9+_h(_di*53.7)*1.3;fc2.beginPath();
        for(var _ddx=TILE;_ddx<=CW-TILE;_ddx+=3){
          var _ddy=_dby+Math.sin(_ddx*_dfreq+_di*1.35)*_damp+Math.cos(_ddx*(_dfreq*1.4)+_di*0.9)*(_damp*0.35);
          if(_ddx===TILE)fc2.moveTo(_ddx,_ddy);else fc2.lineTo(_ddx,_ddy);
        }fc2.stroke();
        fc2.strokeStyle='rgba(255,255,255,'+(_dvis*0.7)+')';fc2.lineWidth=0.5;fc2.beginPath();
        for(var _ddx2=TILE;_ddx2<=CW-TILE;_ddx2+=3){
          var _ddy2=_dby+Math.sin(_ddx2*_dfreq+_di*1.35)*_damp+Math.cos(_ddx2*(_dfreq*1.4)+_di*0.9)*(_damp*0.35)-1.5;
          if(_ddx2===TILE)fc2.moveTo(_ddx2,_ddy2);else fc2.lineTo(_ddx2,_ddy2);
        }fc2.stroke();
      }
    } else {
      /* ── SOL DÉSERT (défaut) ── */
      var _bg=fc2.createLinearGradient(TILE,TILE,CW-TILE,CH-TILE);
      _bg.addColorStop(0,'#d8b04a');_bg.addColorStop(0.3,'#c49838');
      _bg.addColorStop(0.65,'#d0a83e');_bg.addColorStop(1,'#a87830');
      fc2.fillStyle=_bg;fc2.fillRect(0,0,CW,CH);
      var _patchCols=[[252,225,120],[90,55,8],[215,170,65],[160,100,18],[238,195,85],[75,45,5],[200,145,40],[240,200,95]];
      for(var _pi=0;_pi<32;_pi++){
        var _ppx=TILE+_h(_pi*211.3+3)*(CW-2*TILE),_ppy=TILE+_h(_pi*317.7+9)*(CH-2*TILE);
        var _pr=40+_h(_pi*53.1)*110,_pa=0.18+_h(_pi*19.7)*0.28;
        var _pc=_patchCols[_pi%_patchCols.length];
        var _pg=fc2.createRadialGradient(_ppx,_ppy,0,_ppx,_ppy,_pr);
        _pg.addColorStop(0,'rgba('+_pc[0]+','+_pc[1]+','+_pc[2]+','+_pa.toFixed(2)+')');
        _pg.addColorStop(0.55,'rgba('+_pc[0]+','+_pc[1]+','+_pc[2]+','+(_pa*0.35).toFixed(2)+')');
        _pg.addColorStop(1,'rgba(0,0,0,0)');
        fc2.fillStyle=_pg;fc2.fillRect(_ppx-_pr,_ppy-_pr,_pr*2,_pr*2);
      }
      for(var _gi=0;_gi<9000;_gi++){
        var _gx=TILE+_h(_gi*1.618)*(CW-2*TILE),_gy=TILE+_h(_gi*2.718)*(CH-2*TILE);
        var _ga=_h(_gi*3.14)*0.28+0.06,_gsz=_h(_gi*1.41)*2.8+0.4;
        if(_gi%5===0)fc2.fillStyle='rgba(255,230,140,'+_ga+')';
        else if(_gi%5===1)fc2.fillStyle='rgba(90,52,6,'+(_ga*0.85)+')';
        else if(_gi%5===2)fc2.fillStyle='rgba(200,158,52,'+(_ga*0.65)+')';
        else if(_gi%5===3)fc2.fillStyle='rgba(58,34,4,'+(_ga*0.7)+')';
        else fc2.fillStyle='rgba(245,215,100,'+(_ga*0.55)+')';
        fc2.beginPath();fc2.ellipse(_gx,_gy,_gsz,_gsz*0.48,_h(_gi*2.2)*Math.PI,0,Math.PI*2);fc2.fill();
      }
      for(var _ti=0;_ti<55;_ti++){
        var _tx=TILE+_h(_ti*113.7+3)*(CW-2*TILE),_ty=TILE+_h(_ti*97.3+5)*(CH-2*TILE);
        var _tl=18+_h(_ti*43.1)*48,_tang=_h(_ti*67.3)*Math.PI*0.6+0.1;
        fc2.strokeStyle=(_ti%3===0?'rgba(72,42,6,':'rgba(252,215,95,')+(0.12+_h(_ti*31.9)*0.18)+')';
        fc2.lineWidth=0.7+_h(_ti*19.7)*1.4;
        fc2.beginPath();fc2.moveTo(_tx,_ty);fc2.lineTo(_tx+Math.cos(_tang)*_tl,_ty+Math.sin(_tang)*_tl);fc2.stroke();
      }
      for(var _di=0;_di<22;_di++){
        var _dby=TILE+(_di*(CH-2*TILE)/22)+_h(_di*47.3)*24-12;
        var _damp=14+_h(_di*31.1)*18,_dfreq=0.014+_h(_di*23.7)*0.018,_dvis=0.18+_h(_di*17.3)*0.22;
        fc2.strokeStyle='rgba(100,62,10,'+_dvis+')';fc2.lineWidth=1.2+_h(_di*53.7)*1.4;fc2.beginPath();
        for(var _ddx=TILE;_ddx<=CW-TILE;_ddx+=2){
          var _ddy=_dby+Math.sin(_ddx*_dfreq+_di*1.35)*_damp+Math.sin(_ddx*(_dfreq*0.6)+_di*2.2)*(_damp*0.42);
          if(_ddx===TILE)fc2.moveTo(_ddx,_ddy);else fc2.lineTo(_ddx,_ddy);
        }fc2.stroke();
        fc2.strokeStyle='rgba(252,215,90,'+(_dvis*0.55)+')';fc2.lineWidth=0.8;fc2.beginPath();
        for(var _ddx2=TILE;_ddx2<=CW-TILE;_ddx2+=2){
          var _ddy2=_dby+Math.sin(_ddx2*_dfreq+_di*1.35)*_damp+Math.sin(_ddx2*(_dfreq*0.6)+_di*2.2)*(_damp*0.42)-2;
          if(_ddx2===TILE)fc2.moveTo(_ddx2,_ddy2);else fc2.lineTo(_ddx2,_ddy2);
        }fc2.stroke();
      }
    }


    /* ── MURS (pierres taillées anciennes) ── */
    for(var _wy=0;_wy<MAP;_wy++)for(var _wx=0;_wx<MAP;_wx++){
      if(_wx>0&&_wx<MAP-1&&_wy>0&&_wy<MAP-1)continue;
      var _wbx=_wx*TILE,_wby=_wy*TILE;
      var _ws=(_wx*41+_wy*17)%11;
      var _wr=(_wx*67+_wy*43)%9;
      var _wq=(_wx*29+_wy*83)%7;
      /* base mur selon thème */
      var _wB=gameTheme===1?[30,14,5]:gameTheme===2?[88,112,138]:[46,31,14];
      var _wD=gameTheme===1?[20,8,2]:gameTheme===2?[68,88,112]:[36,24,11];
      var _wK=gameTheme===1?[14,5,2]:gameTheme===2?[52,68,88]:[26,16,7];
      var _wsg=fc2.createLinearGradient(_wbx,_wby,_wbx+TILE,_wby+TILE);
      _wsg.addColorStop(0,'rgb('+(_wB[0]+_ws*2)+','+(_wB[1]+_ws)+','+(_wB[2]+Math.round(_ws/2))+')');
      _wsg.addColorStop(0.5,'rgb('+(_wD[0]+_ws)+','+(_wD[1]+Math.round(_ws*0.7))+','+(_wD[2]+Math.round(_ws/3))+')');
      _wsg.addColorStop(1,'rgb('+(_wK[0]+_wr*2)+','+(_wK[1]+_wr)+','+_wK[2]+')');
      fc2.fillStyle=_wsg;fc2.fillRect(_wbx,_wby,TILE,TILE);
      /* assises (briques horizontales, 3 par tuile) */
      var _bH=Math.round(TILE/3);
      for(var _bi=0;_bi<3;_bi++){
        var _bTop=_wby+_bi*_bH;
        /* joint de mortier */
        fc2.fillStyle='rgba(0,0,0,0.44)';fc2.fillRect(_wbx,_bTop,TILE,2);
        /* chaleur/teinte sur la pierre */
        var _wH=gameTheme===1?[80,30,5]:gameTheme===2?[118,152,182]:[58,40,18];
        fc2.fillStyle='rgba('+(_wH[0]+_ws*2+_wr)+','+(_wH[1]+_ws+_wq)+','+(_wH[2]+_wr/2)+',0.38)';
        fc2.fillRect(_wbx+1,_bTop+2,TILE-2,_bH-4);
        /* joint vertical en alternance */
        var _jx=_wbx+((_bi+(_wy%2))%2===0?Math.round(TILE*0.52):Math.round(TILE*0.28));
        fc2.fillStyle='rgba(0,0,0,0.30)';fc2.fillRect(_jx,_bTop+2,2,_bH-4);
        /* reflet haut de brique */
        fc2.fillStyle='rgba(255,210,130,0.065)';fc2.fillRect(_wbx+2,_bTop+3,TILE-4,3);
      }
      /* craquelure d'érosion */
      if(_ws%3===0||_wr%4===1){
        fc2.strokeStyle='rgba(0,0,0,0.36)';fc2.lineWidth=1;
        fc2.beginPath();fc2.moveTo(_wbx+8+_wr*3,_wby+7+_wq*2);
        fc2.quadraticCurveTo(_wbx+22+_ws,_wby+TILE*0.38,_wbx+6+_wr,_wby+TILE-11-_wq*2);
        fc2.stroke();
        fc2.strokeStyle='rgba(200,165,80,0.055)';
        fc2.beginPath();fc2.moveTo(_wbx+9+_wr*3,_wby+7+_wq*2);
        fc2.quadraticCurveTo(_wbx+23+_ws,_wby+TILE*0.38,_wbx+7+_wr,_wby+TILE-11-_wq*2);
        fc2.stroke();
      }
      /* ombre intérieure (vers le terrain de jeu) */
      var _isx=(_wx===0?1:_wx===MAP-1?-1:0),_isy=(_wy===0?1:_wy===MAP-1?-1:0);
      if(_isx||_isy){
        var _isg=fc2.createLinearGradient(_wbx+TILE/2,_wby+TILE/2,_wbx+TILE/2+_isx*TILE*0.88,_wby+TILE/2+_isy*TILE*0.88);
        _isg.addColorStop(0,'rgba(0,0,0,0.50)');
        _isg.addColorStop(0.55,'rgba(0,0,0,0.18)');
        _isg.addColorStop(1,'rgba(0,0,0,0)');
        fc2.fillStyle=_isg;fc2.fillRect(_wbx,_wby,TILE,TILE);
      }
      /* bord extérieur sombre */
      fc2.fillStyle='rgba(0,0,0,0.58)';
      if(_wx===0)fc2.fillRect(_wbx,_wby,3,TILE);
      if(_wy===0)fc2.fillRect(_wbx,_wby,TILE,3);
      if(_wx===MAP-1)fc2.fillRect(_wbx+TILE-3,_wby,3,TILE);
      if(_wy===MAP-1)fc2.fillRect(_wbx,_wby+TILE-3,TILE,3);
      /* reflet haut-gauche */
      fc2.fillStyle='rgba(255,215,100,0.055)';
      fc2.fillRect(_wbx+3,_wby+3,TILE-6,3);
      fc2.fillRect(_wbx+3,_wby+3,3,TILE-6);
    }

    /* ── OMBRES PORTÉES DES MURS SUR LE SABLE ── */
    var _sW=Math.round(TILE*0.58);
    var _tsg=fc2.createLinearGradient(0,TILE,0,TILE+_sW);
    _tsg.addColorStop(0,'rgba(0,0,0,0.34)');_tsg.addColorStop(1,'rgba(0,0,0,0)');
    fc2.fillStyle=_tsg;fc2.fillRect(TILE,TILE,CW-2*TILE,_sW);
    var _lsg=fc2.createLinearGradient(TILE,0,TILE+_sW,0);
    _lsg.addColorStop(0,'rgba(0,0,0,0.28)');_lsg.addColorStop(1,'rgba(0,0,0,0)');
    fc2.fillStyle=_lsg;fc2.fillRect(TILE,TILE,_sW,CH-2*TILE);
    var _bsg=fc2.createLinearGradient(0,CH-TILE,0,CH-TILE-_sW);
    _bsg.addColorStop(0,'rgba(0,0,0,0.28)');_bsg.addColorStop(1,'rgba(0,0,0,0)');
    fc2.fillStyle=_bsg;fc2.fillRect(TILE,CH-TILE-_sW,CW-2*TILE,_sW);
    var _rsg=fc2.createLinearGradient(CW-TILE,0,CW-TILE-_sW,0);
    _rsg.addColorStop(0,'rgba(0,0,0,0.26)');_rsg.addColorStop(1,'rgba(0,0,0,0)');
    fc2.fillStyle=_rsg;fc2.fillRect(CW-TILE-_sW,TILE,_sW,CH-2*TILE);

    /* ── VIGNETTE ── */
    var _vi=gameTheme===1?'rgba(40,5,0,0)':gameTheme===2?'rgba(0,10,30,0)':'rgba(0,0,0,0)';
    var _vm=gameTheme===1?'rgba(20,3,0,0.10)':gameTheme===2?'rgba(0,8,25,0.08)':'rgba(0,0,0,0.07)';
    var _vo=gameTheme===1?'rgba(8,0,0,0.65)':gameTheme===2?'rgba(0,5,18,0.62)':'rgba(0,0,0,0.58)';
    var _vg=fc2.createRadialGradient(CW/2,CH/2,CW*0.06,CW/2,CH/2,CW*0.80);
    _vg.addColorStop(0,_vi);_vg.addColorStop(0.65,_vm);_vg.addColorStop(1,_vo);
    fc2.fillStyle=_vg;fc2.fillRect(0,0,CW,CH);

    floorReady=true;
  })();

  document.getElementById('p1role').textContent=(GAMEMODE==='solo'||GAMEMODE==='survivor'||GAMEMODE==='boss')?t('role_solo'):t('role_coop1');
  var isRec=(GAMEMODE==='solo'||GAMEMODE==='coop'||GAMEMODE==='survivor'||GAMEMODE==='boss');
  // Masquer le bloc P2 entièrement en solo/survivant/boss (jamais de P2 dans ces modes)
  var t2h=document.getElementById('team2hud');if(t2h)t2h.style.display=(GAMEMODE==='solo'||GAMEMODE==='survivor'||GAMEMODE==='boss')?'none':'';
  if(mode==='coop')document.getElementById('p2role').textContent=t('role_coop2');
  // Masquer les barres de PV et le compteur HP (mode record = pas de mort)
  ['p1','p2'].forEach(function(pfx){
    var hb=document.getElementById(pfx+'hf');if(hb&&hb.parentNode)hb.parentNode.style.display=isRec?'none':'';
    var hn=document.getElementById(pfx+'hn');if(hn)hn.style.display=isRec?'none':'';
    var sr=document.getElementById(pfx+'sr');if(sr)sr.style.display=isRec?'none':'';
  });
  var isDiamondRace=(mode==='solo'&&soloDur===999)||(mode==='coop'&&coopDur===999);
  diamondRace=isDiamondRace;
  if(mode==='solo')SOLO_DUR=isDiamondRace?999999:soloDur*60;
  else if(mode==='coop')SOLO_DUR=isDiamondRace?999999:coopDur*60;


  var finEl=document.getElementById('btnfinish');
  if(finEl)finEl.style.display=(mode==='solo'||mode==='coop'||mode==='survivor')?'block':'none';
  var modeLabel=mode==='survivor'?t('mode_survivor'):mode==='boss'?'BOSS':mode==='solo'?t('mode_solo'):t('mode_coop');
  var durLabel=isDiamondRace?diamondGoal+' ◆':mode==='solo'?soloDur:coopDur;
  if(mode==='survivor'||mode==='boss')log(modeLabel+' !');
  else log(modeLabel+(isDiamondRace?' — '+durLabel+' !':' — '+durLabel+' min !'));
  // Affichage du mode en haut de l'écran
  var _gmd=document.getElementById('gamemodedisp');
  if(_gmd){
    var _gmdSym={coal:'■',gold:'★',diamond:'◆'}[winResource]||'◆';
    var _mn=mode==='survivor'?t('survivor_title'):mode==='boss'?'BOSS':isDiamondRace?(diamondGoal+' '+_gmdSym):(mode==='solo'?soloDur+' MIN':'COOP '+coopDur+' MIN');
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


/* WIRE BUTTONS */
document.getElementById('shop').addEventListener('click',function(e){
  var el=e.target.closest('[data-action]');
  if(!el||!shopOpen||!shopPlayer)return;
  var a=el.getAttribute('data-action');
  if(a==='drill')buyBd('drill');
  else if(a==='buy-coal')buyBlock('coal');
  else if(a==='buy-gold')buyBlock('gold');
  else if(a==='buy-diamond')buyBlock('diamond');
  else if(a==='inversion')buyInversion();
  else if(a==='dmg')buyUpg('dmg');
  else if(a==='spd')buyUpg('spd');
});
document.getElementById('btn-record-play').addEventListener('click',function(){
  mineralQty=7;
  _isDaily=false;
  if(recDur==='survivor'){
    diamondRace=false;
    _survivorWave=0;_survivorKillsThisGame=0;
    _preloadedBlocks=null;_lastMapCode=null;
    startGame('survivor');
    return;
  }
  if(recDur==='boss'){
    _preloadedBlocks=null;_lastMapCode=null;
    startGame('boss');
    return;
  }
  if(recDur==='daily'){
    _setupDaily();
    _isDaily=true;
    _initSeedOverride=_dailySeed;
    _preloadedBlocks=null;_lastMapCode=null;
    diamondRace=false;
    if(_dailyMode==='boss'){startGame('boss');}
    else if(_dailyMode==='survivor'){startGame('survivor');}
    else if(_dailyMode==='500d'){diamondRace=true;diamondGoal=500;soloDur=999;coopDur=999;startGame('solo');}
    else if(_dailyMode==='1000d'){diamondRace=true;diamondGoal=1000;soloDur=999;coopDur=999;startGame('solo');}
    else if(_dailyMode==='2000d'){diamondRace=true;diamondGoal=2000;soloDur=999;coopDur=999;startGame('solo');}
    else{startGame('solo');} // 'solo' — chrono normal
    return;
  }
  if(recDur==='500d'){diamondRace=true;diamondGoal=500;soloDur=999;coopDur=999;}
  else if(recDur==='1000d'){diamondRace=true;diamondGoal=1000;soloDur=999;coopDur=999;}
  else if(recDur==='2000d'){diamondRace=true;diamondGoal=2000;soloDur=999;coopDur=999;}
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
  document.getElementById('btnreplay').textContent=t('btn_replay');
  document.getElementById('btnreplay').style.display='';
  gamePaused=false;
  document.getElementById('pauseov').style.display='none';
  closeShop();
  document.getElementById('endov').style.display='none';document.getElementById('endov').style.opacity='0';
  document.getElementById('pbar').style.display='none';document.getElementById('shop').style.display='none';
  _startDrillsPlaced=false;
  document.getElementById('btnmidmenu').style.display='none';
  var finEl2=document.getElementById('btnfinish');if(finEl2)finEl2.style.display='none';
  var gn2=document.getElementById('gamename');if(gn2)gn2.style.display='none';
  var rcm=document.getElementById('randomcostinfo');if(rcm)rcm.style.display='none';
  var _cwEl=document.getElementById('cw');if(_cwEl)_cwEl.style.visibility='hidden';
  var _hudH=document.querySelector('.hud');if(_hudH)_hudH.style.visibility='hidden';
  var _lpH=document.getElementById('leftpanel');if(_lpH)_lpH.style.visibility='hidden';
  var _logH=document.getElementById('log');if(_logH)_logH.style.display='none';
  var _khH=document.getElementById('kh');if(_khH)_khH.style.visibility='hidden';
  document.getElementById('ov').style.display='flex';
  recSetDur(recDur);
  var _mp2=document.getElementById('mob-pause');if(_mp2)_mp2.style.display='none';
  _touchMoveTarget=null;_touchActivateBd=null;_touchDragging=false;
}
document.getElementById('btnpauseresume').addEventListener('click',function(){gamePaused=false;document.getElementById('pauseov').style.display='none';});
document.getElementById('btnpausemenu').addEventListener('click',function(){goToMenu();});
document.getElementById('btnmenu').addEventListener('click',function(){clearTimeout(window._autoMenuTimer);document.getElementById('endov').style.display='none';document.getElementById('endov').style.opacity='0';goToMenu();});
document.getElementById('btnmidmenu').addEventListener('click',function(){
  if(confirm(t('confirm_abandon'))){
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
    var isRace=bDur==='500d'||bDur==='1000d'||bDur==='2000d';
    var is1000=bDur==='1000d'; // règle différente (mini-minerai au lieu du total diamant) -> couleur distincte
    var isSurv=bDur==='survivor';
    var isDaily=bDur==='daily';
    var isBoss=bDur==='boss';
    var col=isSurv?'rgba(220,80,40,':isDaily?'rgba(140,60,220,':isBoss?'rgba(220,30,30,':is1000?'rgba(80,200,140,':(isRace?'rgba(240,210,80,':'rgba(128,230,255,');
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
  else if(opt==='teleport'){teleportMode=false;if(_portalPending){_portalPending=false;_selectionPending=false;_hidePlaceInfo();}}
  else if(opt==='destruct'){destructMode=false;if(_destructPending){_destructPending=false;_selectionPending=false;_hidePlaceInfo();}}
  else if(opt==='ghost'){ghostMode=false;if(_ghostPending){_ghostPending=false;_selectionPending=false;_hidePlaceInfo();}}
}
function _ultimateActivate(opt){
  // L'effet FANTÔME est permanent pour le reste de la partie (pas d'extinction automatique)
  _ultimateActiveOpt=opt;
  if(opt==='night') nightMode=true;
  else if(opt==='speed') speedMode=true;
  else if(opt==='teleport'){teleportMode=true;_teleportTimer=26;}
  else if(opt==='shuffle') _ultimateShuffleMinerals();
  else if(opt==='destruct'){destructMode=true;}
  else if(opt==='ghost'){ghostMode=true;}
  if(GAMEMODE==='survivor'&&_startDrillsPlaced)_survivorSpawnWave();
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

window.loadMapCode=loadMapCode;
window.copyMapCode=copyMapCode;
window.recSetDur=recSetDur;
window.buyBd=buyBd;window.buyUpg=buyUpg;window.closeShop=closeShop;

requestAnimationFrame(function(ts){lastTime=ts;requestAnimationFrame(loop);});
recSetDur(recDur);updateMenuStats();updateSurvivorMenuStats();updateDailyMenuStats();updateBossMenuStats();

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
