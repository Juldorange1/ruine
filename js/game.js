/* MAIN LOOP */
function loop(ts){
  requestAnimationFrame(loop);
  var dt=Math.min((ts-lastTime)/1000,.05);lastTime=ts;
  // In record modes, timer runs from placement onward
  var isRecordMode=(GAMEMODE==='solo'||GAMEMODE==='coop');
  if(G&&gameRunning&&(G.phase==='combat'||(G.phase==='placement'&&isRecordMode))&&!gamePaused&&!survivorPickMode){
    G.time+=dt;
  }
  if(G&&gameRunning&&G.phase==='combat'&&!gamePaused&&!survivorPickMode){
    // P1 movement
    if(!drillingMode){
      var dx=0,dy=0;
      if(keys['ArrowLeft'])dx-=1;if(keys['ArrowRight'])dx+=1;
      if(keys['ArrowUp'])dy-=1;if(keys['ArrowDown'])dy+=1;
      if(GAMEMODE==='solo'){if(keys['q']||keys['Q'])dx-=1;if(keys['d']||keys['D'])dx+=1;if(keys['z']||keys['Z'])dy-=1;if(keys['s']||keys['S'])dy+=1;}
      if(dx||dy){var l=Math.hypot(dx,dy);moveP(G.p1,dx/l,dy/l,dt);}else{G.p1.vx=0;G.p1.vy=0;}
    }else{G.p1.vx=0;G.p1.vy=0;}
    // P2 movement in pvp and coop
    if((GAMEMODE==='pvp'||GAMEMODE==='coop')&&G.p2&&!G.p2.dead){
      var dx2=0,dy2=0;
      if(keys['q']||keys['Q'])dx2-=1;if(keys['d']||keys['D'])dx2+=1;
      if(keys['z']||keys['Z'])dy2-=1;if(keys['s']||keys['S'])dy2+=1;
      if(dx2||dy2){var l2=Math.hypot(dx2,dy2);moveP(G.p2,dx2/l2,dy2/l2,dt);}else{G.p2.vx=0;G.p2.vy=0;}
    }
    updCombat(dt);updDrills(dt);updMeteors(dt);updBdAtk(dt);updBlkAtk(dt);updMetAtk(dt);updRocks(dt);updAI(dt);aiAutoCollect();updPiques(dt);
    G.players.forEach(function(p){if(p&&!p.dead&&p.isHuman)p.atkCharge=Math.min(1,(p.atkCharge||0)+dt);});
    if((GAMEMODE==='solo'||GAMEMODE==='coop')&&!G.phase_over){
      var totalDia=(G.p1.diamond||0)+(G.p2&&GAMEMODE==='coop'?(G.p2.diamond||0):0);
      var diaGoal=diamondRace?diamondGoal:99999;
    if(diamondRace&&totalDia>=diaGoal){G.phase='over';G.phase_over=true;G.winner='DIAMOND';}
      else if(!diamondRace&&G.time>=SOLO_DUR){G.phase='over';G.phase_over=true;G.winner='TIME';}
    }
    if(G.phase==='over'){gameRunning=false;showEnd();}
  }
  if(G)draw();
}

function showEnd(){
  var ov=document.getElementById('endov');
  var totalD=(G.p1.diamond||0)+(G.p2&&GAMEMODE==='coop'?(G.p2.diamond||0):0);
  if(GAMEMODE==='solo'||GAMEMODE==='coop'){
    if(seriesActive&&!survivorMode) seriesScores.push(diamondRace?Math.round(G.time):totalD);
    var isLastGame=seriesGame>=4;
    var title='';
    if(survivorMode) title='SURVIVANT TERMINÉ';
    else if(diamondRace&&G.winner==='DIAMOND') title='RUÉE DES '+diamondGoal+' !';
    else title=GAMEMODE==='coop'?'COOP TERMINEE':'PARTIE TERMINEE';
    document.getElementById('endtitle').textContent=title;
    document.getElementById('endtitle').style.color=survivorMode?'#b060e0':diamondRace&&G.winner==='DIAMOND'?'#f0d060':'#80eeff';
    var timeStr=document.getElementById('timer').textContent;
    var sub='';
    if(survivorMode){
      sub='&#9670; '+totalD+'  &middot;  '+survivorMeteorCount+' météorites';
    } else if(GAMEMODE==='coop'){
      sub='Total: '+totalD+' &#9670; (P1:'+(G.p1.diamond||0)+' + P2:'+(G.p2?G.p2.diamond||0:0)+')';
      sub+='  —  '+timeStr;
    } else {
      sub='&#9670; '+totalD;
      if(diamondRace&&G.winner==='DIAMOND') sub+='  —  Temps: '+timeStr;
      else sub+='  —  '+timeStr;
    }
    if(seriesActive&&!survivorMode){
      sub+='  (Partie '+seriesGame+'/4)';
      if(isLastGame){
        var avg=Math.round(seriesScores.reduce(function(a,b){return a+b;},0)/seriesScores.length);
        function fmtSec(s2){return String(Math.floor(s2/60)).padStart(2,'0')+':'+String(s2%60).padStart(2,'0');}
        if(diamondRace){
          var scoreStrs=seriesScores.map(fmtSec).join(' / ');
          sub='<br>Temps: '+scoreStrs+'<br>Moyenne: '+fmtSec(avg);
        } else {
          sub='<br>Scores: '+seriesScores.join(' / ')+'<br>Moyenne: '+avg+' &#9670;';
        }
        document.getElementById('btnreplay').style.display='none';
      } else {
        document.getElementById('btnreplay').textContent='PARTIE SUIVANTE ('+(seriesGame+1)+'/4)';
        document.getElementById('btnreplay').style.display='';
      }
    }
    document.getElementById('endsub').innerHTML=sub;
  } else {
    var win=G.winner==='P1';
    document.getElementById('endtitle').textContent=G.winner==='PERSONNE'?'MATCH NUL':win?'P1 GAGNE !':'P2 GAGNE !';
    document.getElementById('endtitle').style.color=G.winner==='PERSONNE'?'#a0a060':win?'#d4a040':'#c04040';
    document.getElementById('endsub').textContent=G.winner==='PERSONNE'?'Carte saturee':(G.winner+' a gagne  '+document.getElementById('timer').textContent);
  }
  var modeEl=document.getElementById('endmode');
  if(modeEl){
    var modeName=survivorMode?'SURVIVANT':diamondRace?('RUÉE DES '+diamondGoal):
      (GAMEMODE==='solo'?'SOLO '+(SOLO_DUR/60|0)+'min':GAMEMODE==='coop'?'COOP '+(SOLO_DUR/60|0)+'min':'AFFRONTEMENT');
    var scoreStr=GAMEMODE!=='pvp'?'  ·  '+totalD+' ◆'+(survivorMode?' / '+survivorMeteorCount+' ☄':''):'';
    modeEl.innerHTML='Mode : '+modeName+'  ·  '+mineralQty+'/type'+scoreStr;
  }
  sfx(G&&(G.winner==='TIME'||survivorMode)?'end':'win');
  ov.style.display='flex';setTimeout(function(){ov.style.opacity='1';},20);
}
/* INPUT */
document.addEventListener('keydown',function(e){resumeAudio();keys[e.key]=true;
  if(!G||!gameRunning)return;
  if(e.key==='Escape'){
    // If something is open, close it first
    if(shopOpen||tpMode||drillingMode||piqueMode){
      closeShop();tpMode=false;tpSrc=null;tpPlayer=null;
      bdAtk=null;blkAtk=null;metAtk=null;
      if(drillingMode){drillingMode=false;placePos=null;document.getElementById('pbar').style.display='none';log('Placement annule');}
      piqueMode=false;piquePlayer=null;
      return;
    }
    // Otherwise toggle pause
    if(G&&gameRunning&&G.phase==='combat'){
      gamePaused=!gamePaused;
      document.getElementById('pauseov').style.display=gamePaused?'flex':'none';
    }
  }
  // P2 keyboard shortcuts (pvp only)
  if((GAMEMODE==='pvp'||GAMEMODE==='coop')&&G.p2&&!G.p2.dead){
    if(e.key==='f'||e.key==='F'){var bd3=G.buildings.filter(function(b){return Math.hypot(G.p2.x-b.x,G.p2.y-b.y)<=1.6;}).sort(function(a,b2){return Math.hypot(G.p2.x-a.x,G.p2.y-a.y)-Math.hypot(G.p2.x-b2.x,G.p2.y-b2.y);})[0];if(bd3)activateBd(bd3,G.p2);}
    if(e.key==='r'||e.key==='R'){
      if((G.p2.atkCharge||0)>=1){
        var targets=[];
        G.players.forEach(function(p){if(!p.dead&&p!==G.p2)targets.push({x:p.x,y:p.y});});
        G.buildings.forEach(function(b){if(b.type!=='factory'&&b.type!=='bank')targets.push({x:b.x,y:b.y});});
        G.blocks.forEach(function(b){targets.push({x:b.x,y:b.y});});
        if(targets.length){
          var near=targets.reduce(function(a,b){return Math.hypot(G.p2.x-a.x,G.p2.y-a.y)<Math.hypot(G.p2.x-b.x,G.p2.y-b.y)?a:b;});
          spearStrike(G.p2,near.x,near.y);
        } else spearStrike(G.p2,G.p2.x+1,G.p2.y);
        G.p2.atkCharge=0;
      } else {
        G.p2.atkCharge=0;
      }
    }
  }
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].indexOf(e.key)>=0)e.preventDefault();
  // Right Shift = simulate left click at current mouse position
  if(e.key==='ShiftRight'||e.code==='ShiftRight'){
    e.preventDefault();
    C.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:mouseX,clientY:mouseY}));
  }
});
document.addEventListener('keyup',function(e){keys[e.key]=false;});

function getGrid(e){var r=document.getElementById('cw').getBoundingClientRect();return{gx:Math.floor((e.clientX-r.left)/(r.width/CW)/TILE),gy:Math.floor((e.clientY-r.top)/(r.height/CH)/TILE)};}

C.addEventListener('click',function(e){
  if(!G)return;
  var pos=getGrid(e);
  // Mode Survivant : le joueur choisit la cible de la météorite
  if(survivorPickMode){
    var isDrill=G.buildings.some(function(b){return (b.type==='drill'||b.type==='drillfast')&&b.gx===pos.gx&&b.gy===pos.gy;});
    var isBlock=G.blocks.some(function(b){return b.gx===pos.gx&&b.gy===pos.gy;});
    var alreadyHit=G.meteors.some(function(m){return !m.fallen&&m.gx===pos.gx&&m.gy===pos.gy;});
    if((isDrill||isBlock)&&!alreadyHit){
      G.meteors.push({gx:pos.gx,gy:pos.gy,timer:18,fallen:false,cleanAt:0,hp:150,maxHp:150});
      sfx('meteor');
      survivorPickMode=false;
    }
    return;
  }
  if(drillingMode){var ok=cellFreePlace(pos.gx,pos.gy);if(ok){placePos={gx:pos.gx,gy:pos.gy,ok:true,locked:true};confirmDrill();}return;}
  if(G.phase==='placement'&&placeQueue.length){selectCell(pos.gx,pos.gy);if(placePos&&placePos.ok)confirmPlace();return;}
  if(tpMode){doTeleport(pos.gx,pos.gy);return;}
  if(G.phase!=='combat')return;
  if(piqueMode){placePique(pos.gx,pos.gy);return;}
  var bd=G.buildings.filter(function(b){return b.gx===pos.gx&&b.gy===pos.gy;})[0];
  if(!bd)return;
  var actor=G.p1;
  if((GAMEMODE==='pvp'||GAMEMODE==='coop')&&G.p2&&!G.p2.dead){var d1=Math.hypot(G.p1.x-bd.x,G.p1.y-bd.y),d2=Math.hypot(G.p2.x-bd.x,G.p2.y-bd.y);if(d2<d1&&d2<=1.6)actor=G.p2;}
  if(Math.hypot(actor.x-bd.x,actor.y-bd.y)>1.6){log('Trop loin ! (1 case max)');return;}
  activateBd(bd,actor);
});

C.addEventListener('contextmenu',function(e){
  e.preventDefault();
  if(!G||G.phase!=='combat')return;
  var r=document.getElementById('cw').getBoundingClientRect();
  var worldX=(e.clientX-r.left)/(r.width/CW)/TILE;
  var worldY=(e.clientY-r.top)/(r.height/CH)/TILE;
  // Determine which player strikes (closest to click in pvp/coop)
  var actor=G.p1;
  if((GAMEMODE==='pvp'||GAMEMODE==='coop')&&G.p2&&!G.p2.dead){
    var d1=Math.hypot(G.p1.x-worldX,G.p1.y-worldY);
    var d2=Math.hypot(G.p2.x-worldX,G.p2.y-worldY);
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

/* START GAME */
function setMineralQty(mode,qty){
  // Deselect all buttons for this mode, select the clicked one
  [3,5,7].forEach(function(q){
    var btn=document.getElementById(mode+'-mq'+q);
    if(!btn)return;
    var col=mode==='solo'?'rgba(128,230,255,':'rgba(128,224,128,';
    var active=q===qty;
    btn.style.background=active?(col+'0.2)' ):(col+'0.05)');
    btn.style.borderColor=active?(col+'0.7)' ):(col+'0.25)');
    btn.style.color=active?(col+'0.95)' ):(col+'0.45)');
    btn.style.fontWeight=active?'bold':'normal';
    if(q===3||q===7) btn.textContent=(active?'\u2611':'\u2744')+' '+q;
  });
  if(mode==='solo')soloMineralQty=qty;
  else coopMineralQty=qty;
}

function toggleMineral(mode){
  var btn=document.getElementById(mode+'-mineral');
  if(!btn)return;
  var on=btn.getAttribute('data-active')==='1';
  btn.setAttribute('data-active',on?'0':'1');
  var col=mode==='solo'?'rgba(128,230,255,':'rgba(128,224,128,';
  if(!on){
    btn.style.background=col+'0.18)';
    btn.style.borderColor=col+'0.7)';
    btn.style.color=col+'0.9)';
    btn.textContent='\u2611 3 MINERAIS PAR TYPE';
  } else {
    btn.style.background=col+'0.05)';
    btn.style.borderColor=col+'0.3)';
    btn.style.color=col+'0.45)';
    btn.textContent='\u2744 3 MINERAIS PAR TYPE';
  }
}

function startGame(mode){
  GAMEMODE=mode;placeGen++;
  G=initGame();G.phase_over=false;gameRunning=true;logLines=[];
  placeQueue=[];placePos=null;drillingMode=false;
  shopOpen=null;shopPlayer=null;piqueMode=false;piquePlayer=null;
  tpMode=false;tpSrc=null;tpPlayer=null;bdAtk=null;bdAtkTimer=0;bdAtkPlayer=null;
  blkAtk=null;blkAtkTimer=0;blkAtkPlayer=null;
  metAtk=null;metAtkTimer=0;metAtkPlayer=null;
  document.getElementById('shop').style.display='none';
  document.getElementById('pbar').style.display='none';
  document.getElementById('ov').style.display='none';
  document.getElementById('endov').style.display='none';
  document.getElementById('endov').style.opacity='0';
  document.getElementById('phase').textContent='PLACEMENT';
  // Choose map texture based on mode
  var texId;
  if(GAMEMODE==='pvp') texId='tex-stone';
  else if(GAMEMODE==='coop') texId='tex-grass2';
  else texId='tex-desert1'; // solo default
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
      // Murs de ruines sur le contour (border cells)
      for(var wy=0;wy<MAP;wy++)for(var wx=0;wx<MAP;wx++){
        if(wx>0&&wx<MAP-1&&wy>0&&wy<MAP-1)continue;
        var wbx=wx*TILE,wby=wy*TILE,ws=(wx*41+wy*17)%11;
        // Fond pierre sombre
        fc2.fillStyle='rgba(26,18,9,0.97)';fc2.fillRect(wbx,wby,TILE,TILE);
        // Face de la pierre (légèrement plus claire, variable)
        fc2.fillStyle='rgba('+(56+ws*2)+','+(40+ws)+','+(17+ws)+',0.88)';
        fc2.fillRect(wbx+5,wby+5,TILE-10,TILE-10);
        // Joints horizontaux/verticaux alternés
        fc2.fillStyle='rgba(15,10,4,0.52)';
        if(ws%2===0) fc2.fillRect(wbx+5,wby+Math.round(TILE/2)-1,TILE-10,2);
        else          fc2.fillRect(wbx+Math.round(TILE/2)-1,wby+5,2,TILE-10);
        // Fissures (déterministes selon position)
        fc2.strokeStyle='rgba(9,6,2,0.52)';fc2.lineWidth=1;
        fc2.beginPath();
        fc2.moveTo(wbx+7+ws*2,wby+11);
        fc2.lineTo(wbx+15+ws,wby+TILE*.37+ws);
        fc2.lineTo(wbx+11,wby+TILE*.63);
        fc2.stroke();
        if(ws%3!==2){
          fc2.beginPath();
          fc2.moveTo(wbx+TILE-13-ws,wby+9+ws);
          fc2.lineTo(wbx+TILE-19,wby+TILE*.43);
          fc2.stroke();
        }
        // Ombres internes (donne l'épaisseur du mur)
        fc2.fillStyle='rgba(0,0,0,0.45)';
        fc2.fillRect(wbx,wby,TILE,4);
        fc2.fillRect(wbx,wby,4,TILE);
        fc2.fillStyle='rgba(0,0,0,0.22)';
        fc2.fillRect(wbx,wby+TILE-4,TILE,4);
        fc2.fillRect(wbx+TILE-4,wby,4,TILE);
        // Reflet chaud (lumière désert)
        fc2.fillStyle='rgba(210,155,55,0.07)';
        fc2.fillRect(wbx+5,wby+5,TILE-10,3);
      }
      floorReady=true;
    };
    var texEl=document.getElementById(texId)||document.getElementById('tex-desert1');
    if(texEl)img2.src=texEl.src;
    else{floorReady=true;}
  })();
  // Update HUD labels
  document.getElementById('p1role').textContent=GAMEMODE==='solo'?'Solo':GAMEMODE==='coop'?'Coop P1':'P1';
  document.getElementById('p2card').style.display=GAMEMODE==='solo'?'none':'';
  if(mode==='coop')document.getElementById('p2role').textContent='Coop P2';
  else document.getElementById('p2role').textContent='P2';
  // Hide HP bar and PV number in record modes (solo/coop)
  var isRec=(GAMEMODE==='solo'||GAMEMODE==='coop');
  ['p1','p2'].forEach(function(pfx){
    var hf=document.getElementById(pfx+'hf');
    if(hf)hf.parentNode.style.display=isRec?'none':'';
    var hn=document.getElementById(pfx+'hn');
    if(hn)hn.style.display=isRec?'none':'';
  });
  // Detect diamond race or survivor mode
  survivorMeteorCount=0;
  var isDiamondRace=(mode==='solo'&&soloDur===999&&!survivorMode)||(mode==='coop'&&coopDur===999&&!survivorMode);
  diamondRace=isDiamondRace;
  if(mode==='solo') SOLO_DUR=isDiamondRace||survivorMode?999999:soloDur*60;
  else if(mode==='coop') SOLO_DUR=isDiamondRace||survivorMode?999999:coopDur*60;
  // Series logic: no series for survivor
  if((mode==='solo'||mode==='coop')&&!survivorMode&&seriesGame===0){
    seriesActive=true;seriesGame=1;seriesScores=[];
  }
  // Show/hide TERMINER button
  var finEl=document.getElementById('btnfinish');
  if(finEl) finEl.style.display=(mode==='solo'||mode==='coop')?'block':'none';
  var modeLabel=survivorMode?'Survivant':mode==='solo'?'Solo':mode==='coop'?'Coop':'Affrontement';
  var durLabel=survivorMode?'Survivant':isDiamondRace?('Ruée des '+diamondGoal):mode==='solo'?soloDur:mode==='coop'?coopDur:null;
  if(seriesActive&&(mode==='solo'||mode==='coop')&&!survivorMode)
    log(modeLabel+' — Partie '+seriesGame+'/4 — '+(isDiamondRace?durLabel+' !':durLabel+' min !'));
  else
    log(mode==='pvp'?'Affrontement — bonne chance !':modeLabel+(isDiamondRace||survivorMode?' — '+durLabel+' !':' — '+durLabel+'  min !'));

  gameNum=1+Math.floor(Math.random()*6);
  gamePaused=false;
  document.getElementById('pauseov').style.display='none';
  var gn=document.getElementById('gamename');
  if(gn){gn.textContent='#'+gameNum;gn.style.display='block';}
  document.getElementById('btnmidmenu').style.display='block';
  startPlacement();
}

/* WIRE BUTTONS */
// Shop click delegation — wired at end so DOM exists
document.getElementById('shop').addEventListener('click',function(e){
  var el=e.target.closest('[data-action]');
  if(!el||!shopOpen||!shopPlayer)return;
  var a=el.getAttribute('data-action');
  if(a==='drill')buyBd('drill');
  else if(a==='teleporter')buyBd('teleporter');
  else if(a==='buy-coal')buyBlock('coal');
  else if(a==='buy-gold')buyBlock('gold');
  else if(a==='buy-diamond')buyBlock('diamond');
  else if(a==='dmg')buyUpg('dmg');
  else if(a==='hp')buyUpg('hp');
  else if(a==='spd')buyUpg('spd');
  else if(a==='pique')buyPique();
});
document.getElementById('btn-record-play').addEventListener('click',function(){
  var mode='solo';
  mineralQty=recMq;
  survivorMode=false;
  if(recDur==='400d'){diamondRace=true;diamondGoal=400;soloDur=999;coopDur=999;}
  else if(recDur==='800d'){diamondRace=true;diamondGoal=800;soloDur=999;coopDur=999;}
  else if(recDur==='surv'){diamondRace=false;survivorMode=true;soloDur=999;coopDur=999;}
  else{diamondRace=false;if(mode==='solo')soloDur=recDur;else coopDur=recDur;}
  startGame(mode);
});
// Wire pvp jouer button
var pvpJouerBtn=document.getElementById('pvp-jouer');
if(pvpJouerBtn)pvpJouerBtn.addEventListener('click',function(){mineralQty=pvpMq||5;startGame('pvp');});
// btn-pvp-play handles pvp start with mineralQty already wired above
document.getElementById('btnreplay').addEventListener('click',function(){
  if(seriesActive&&seriesGame<4){
    seriesGame++;
    startGame(GAMEMODE);
  } else {
    // New series
    seriesGame=0;seriesActive=false;seriesScores=[];
    document.getElementById('btnreplay').textContent='REJOUER';
    document.getElementById('btnreplay').style.display='';
    startGame(GAMEMODE);
  }
});
function goToMenu(){
  survivorMode=false;survivorMeteorCount=0;survivorPickMode=false;
  gameRunning=false;G=null;
  seriesGame=0;seriesActive=false;seriesScores=[];
  document.getElementById('btnreplay').textContent='REJOUER';
  document.getElementById('btnreplay').style.display='';
  gamePaused=false;
  document.getElementById('pauseov').style.display='none';
  closeShop();
  document.getElementById('endov').style.display='none';
  document.getElementById('endov').style.opacity='0';
  document.getElementById('pbar').style.display='none';
  document.getElementById('shop').style.display='none';
  document.getElementById('btnmidmenu').style.display='none';
  var finEl2=document.getElementById('btnfinish');if(finEl2)finEl2.style.display='none';
  var gn2=document.getElementById('gamename');if(gn2)gn2.style.display='none';
  document.getElementById('ov').style.display='flex';
}

document.getElementById('btnpauseresume').addEventListener('click',function(){
  gamePaused=false;
  document.getElementById('pauseov').style.display='none';
});
document.getElementById('btnpausemenu').addEventListener('click',function(){
  goToMenu();
});
document.getElementById('btnmenu').addEventListener('click',function(){
  gameRunning=false;
  document.getElementById('endov').style.display='none';document.getElementById('endov').style.opacity='0';
  document.getElementById('ov').style.display='flex';
});
document.getElementById('btnmidmenu').addEventListener('click',function(){
  if(confirm('Abandonner la partie et revenir au menu ?')){
    gameRunning=false;G=null;
    document.getElementById('pbar').style.display='none';
    document.getElementById('shop').style.display='none';
    document.getElementById('endov').style.display='none';
    document.getElementById('endov').style.opacity='0';
    document.getElementById('ov').style.display='flex';
  }
});
document.getElementById('pbc').addEventListener('click',function(){if(drillingMode)confirmDrill();else confirmPlace();});
var _finBtn=document.getElementById('btnfinish');
if(_finBtn)_finBtn.addEventListener('click',function(){
  if(!G||!gameRunning||G.phase!=='combat')return;
  if(GAMEMODE==='solo'||GAMEMODE==='coop'){
    G.phase='over';G.phase_over=true;G.winner='TIME';gameRunning=false;showEnd();
  }
});
document.getElementById('sclose').addEventListener('click',closeShop);

// Expose shop fns for onclick
// ── Record menu state ──
var recDur=10;      // 5, 10, '400d', '800d', 'surv'
var recMq=5;        // 3, 5, 7
var pvpMq=5;        // 3, 5, 7 for pvp
function recSetDur(d){
  recDur=d;
  document.querySelectorAll('.rec-dur').forEach(function(btn){
    var bDur=btn.getAttribute('data-dur');
    var active=bDur===String(d);
    var isRace=bDur==='400d'||bDur==='800d';
    var isSurv=bDur==='surv';
    var col=isRace?'rgba(240,210,80,':isSurv?'rgba(160,80,220,':'rgba(128,230,255,';
    btn.style.background=active?(col+'0.22)'):(col+'0.05)');
    btn.style.borderColor=active?(col+'0.8)'):(col+(isRace||isSurv?'0.35':'0.25')+')');
    btn.style.color=active?(col+'1)'):(col+(isRace?'0.6':isSurv?'0.65':'0.55')+')');
    btn.style.fontWeight=active?'bold':'normal';
  });
}

function recSetMq(q){
  recMq=q;
  document.querySelectorAll('.rec-mq').forEach(function(btn){
    var active=parseInt(btn.getAttribute('data-qty'))===q;
    var col='rgba(128,230,255,';
    btn.style.background=active?(col+'0.2)'):(col+'0.05)');
    btn.style.borderColor=active?(col+'0.7)'):(col+'0.25)');
    btn.style.color=active?'#80eeff':(col+'0.45)');
    btn.style.fontWeight=active?'bold':'normal';
    if(q===3||q===7) btn.textContent=(active?'\u2611':'\u2744')+' '+q;
    else btn.textContent=active?'5 (def)':'5 (def)';
  });
}

function pvpSetMq(q){
  pvpMq=q;
  [3,5,7].forEach(function(n){
    var btn=document.getElementById('pvp-mq'+n);
    if(!btn)return;
    var active=n===q;
    var col='rgba(220,128,80,';
    btn.style.background=active?(col+'0.2)'):(col+'0.05)');
    btn.style.borderColor=active?(col+'0.7)'):(col+'0.25)');
    btn.style.color=active?'#e08060':(col+'0.45)');
    btn.style.fontWeight=active?'bold':'normal';
    btn.textContent=(n===3||n===7)?((active?'\u2611':'\u2744')+' '+n):'5 (def)';
  });
}

window.recSetDur=recSetDur;
window.recSetMq=recSetMq;
window.pvpSetMq=pvpSetMq;

window.buyBd=buyBd;window.buyUpg=buyUpg;window.buyPique=buyPique;window.closeShop=closeShop;
window.toggleMineral=toggleMineral;
window.setMineralQty=setMineralQty;

requestAnimationFrame(function(ts){lastTime=ts;requestAnimationFrame(loop);});

/* MENU GEAR */
(function(){
  var gc=document.getElementById('gear-bg');
  if(!gc)return;
  var GS=700;gc.width=GS;gc.height=GS;
  var gx2=gc.getContext('2d');
  var _gAng=0,_gLast=null;
  function animGear(ts){
    if(_gLast!==null)_gAng+=(ts-_gLast)/20000*Math.PI*2;
    _gLast=ts;
    gx2.clearRect(0,0,GS,GS);
    var ang=_gAng;
    gx2.save();gx2.translate(GS/2,GS/2);gx2.rotate(ang);
    var teeth=20,R=310,r=255,rh=65,step=Math.PI*2/teeth,tw=step*0.38;
    /* dents */
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
    /* moyeu */
    gx2.beginPath();gx2.arc(0,0,rh,0,Math.PI*2);
    gx2.fillStyle='rgba(0,0,0,0.25)';gx2.fill();
    gx2.strokeStyle='rgba(200,140,30,0.32)';gx2.lineWidth=2;gx2.stroke();
    /* rayons */
    for(var j=0;j<6;j++){
      var sa=j/6*Math.PI*2;
      gx2.beginPath();
      gx2.moveTo(rh*1.2*Math.cos(sa),rh*1.2*Math.sin(sa));
      gx2.lineTo((r-14)*Math.cos(sa),(r-14)*Math.sin(sa));
      gx2.strokeStyle='rgba(200,140,30,0.15)';gx2.lineWidth=14;gx2.stroke();
    }
    gx2.restore();
    requestAnimationFrame(animGear);
  }
  requestAnimationFrame(animGear);
})();
