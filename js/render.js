/* DRAW */
function draw(){
  if(!G)return;
  X.clearRect(0,0,CW,CH);
  if(floorReady)X.drawImage(floorC,0,0);
  else{X.fillStyle='#c08030';X.fillRect(0,0,CW,CH);}

  // Destroyed craters
  G.destroyed.forEach(function(d){
    var bx=d.gx*TILE,by=d.gy*TILE,cx=bx+TILE/2,cy=by+TILE/2;
    X.fillStyle='rgba(14,6,2,0.92)';X.fillRect(bx,by,TILE,TILE);
    var sg=X.createRadialGradient(cx,cy,4,cx,cy,TILE*.5);
    sg.addColorStop(0,'rgba(8,4,1,0.9)');sg.addColorStop(1,'rgba(30,15,5,0)');
    X.fillStyle=sg;X.fillRect(bx,by,TILE,TILE);
    X.strokeStyle='rgba(100,50,15,0.45)';X.lineWidth=1.5;
    X.beginPath();X.moveTo(bx+TILE*.2,by+TILE*.2);X.lineTo(bx+TILE*.8,by+TILE*.8);X.stroke();
    X.beginPath();X.moveTo(bx+TILE*.8,by+TILE*.2);X.lineTo(bx+TILE*.2,by+TILE*.8);X.stroke();
  });

  // Meteors
  G.meteors.forEach(function(m){
    if(m.fallen)return;
    var p2=0.5+0.5*Math.sin(G.time*7),bx=m.gx*TILE,by=m.gy*TILE,cx=bx+TILE/2,cy=by+TILE/2;
    var _rc=m.resType==='diamond'?'80,200,255':m.resType==='gold'?'255,200,30':'180,180,190';
    var mg=X.createRadialGradient(cx,cy,6,cx,cy,TILE*.6);
    mg.addColorStop(0,'rgba('+_rc+','+(0.25+p2*.2)+')');mg.addColorStop(1,'rgba('+_rc.split(',')[0]+','+_rc.split(',')[1]+','+_rc.split(',')[2]+',0)');
    X.fillStyle=mg;X.fillRect(bx,by,TILE,TILE);
    X.fillStyle='rgba(80,50,30,0.9)';X.beginPath();X.arc(cx,cy-8+p2*4,12,0,Math.PI*2);X.fill();
    var hg=X.createRadialGradient(cx,cy-8+p2*4,2,cx,cy-8+p2*4,12);
    hg.addColorStop(0,'rgba(255,180,60,'+(0.6+p2*.3)+')');hg.addColorStop(1,'rgba(200,80,20,0)');
    X.fillStyle=hg;X.beginPath();X.arc(cx,cy-8+p2*4,12,0,Math.PI*2);X.fill();
    X.strokeStyle='rgba(255,120,30,'+(0.4+p2*.4)+')';X.lineWidth=2.5;X.setLineDash([6,4]);
    X.strokeRect(bx+3,by+3,TILE-6,TILE-6);X.setLineDash([]);
    // Countdown hidden — player doesn't know exact timing
    // HP bar always shown so player knows meteors are destroyable
    var bw2=TILE-12;
    X.fillStyle='rgba(0,0,0,0.55)';X.fillRect(bx+6,by+4,bw2,6);
    var hpFracM=m.hp/m.maxHp;
    X.fillStyle=hpFracM>0.5?'rgba(220,80,20,0.9)':'rgba(255,40,10,0.95)';
    X.fillRect(bx+6,by+4,bw2*hpFracM,6);
    X.fillStyle='rgba(255,200,100,0.6)';X.font='bold 8px Courier New';
    X.textAlign='center';X.textBaseline='top';X.fillText(Math.ceil(m.hp)+'PV',cx,by+6);
  });

  // Resource blocks
  G.blocks.forEach(function(bl){
    var bx=bl.gx*TILE,by=bl.gy*TILE,cx=bx+TILE/2,cy=by+TILE/2;
    if(bl.ghost)X.globalAlpha=0.32;
    if(bl.type==='coal'){
      // Masse rocheuse sombre avec facettes anthracite
      X.fillStyle='rgba(10,8,16,0.96)';X.beginPath();X.roundRect(bx+4,by+4,TILE-8,TILE-8,5);X.fill();
      X.fillStyle='rgba(42,36,62,0.82)';X.beginPath();X.moveTo(bx+11,by+10);X.lineTo(bx+37,by+8);X.lineTo(bx+52,by+20);X.lineTo(bx+48,by+46);X.lineTo(bx+26,by+55);X.lineTo(bx+9,by+41);X.closePath();X.fill();
      X.fillStyle='rgba(60,52,86,0.65)';X.beginPath();X.moveTo(bx+15,by+12);X.lineTo(bx+35,by+10);X.lineTo(bx+46,by+24);X.lineTo(bx+28,by+30);X.closePath();X.fill();
      X.fillStyle='rgba(155,142,185,0.28)';X.beginPath();X.ellipse(bx+21,by+15,6,2.5,0.35,0,Math.PI*2);X.fill();
      X.strokeStyle='rgba(108,92,148,0.78)';X.lineWidth=2;X.beginPath();X.roundRect(bx+4,by+4,TILE-8,TILE-8,5);X.stroke();
    } else if(bl.type==='gold'){
      // Amas de pépites dorées brutes sur roche sombre, avec lueur chaude pulsante
      var goldPulse=0.5+0.5*Math.sin(G.time*2.2);
      X.fillStyle='rgba(20,14,10,0.96)';X.beginPath();X.roundRect(bx+4,by+4,TILE-8,TILE-8,5);X.fill();
      var _gh=X.createRadialGradient(cx,cy,2,cx,cy,28);
      _gh.addColorStop(0,'rgba(255,200,60,'+(0.30+goldPulse*0.18)+')');_gh.addColorStop(1,'rgba(150,90,10,0)');
      X.fillStyle=_gh;X.beginPath();X.roundRect(bx+4,by+4,TILE-8,TILE-8,5);X.fill();
      // Pépites brutes (formes irrégulières, tailles variées)
      var _nuggets=[
        {p:[[cx-16,cy-4],[cx-9,cy-12],[cx-1,cy-7],[cx-3,cy+2],[cx-13,cy+4]],sz:1},
        {p:[[cx+2,cy-13],[cx+14,cy-9],[cx+16,cy+1],[cx+6,cy+3],[cx+1,cy-4]],sz:1.05},
        {p:[[cx-7,cy+6],[cx+4,cy+5],[cx+9,cy+15],[cx-2,cy+19],[cx-11,cy+14]],sz:0.95}
      ];
      _nuggets.forEach(function(ng,ni){
        var ctr=ng.p.reduce(function(a,p){return[a[0]+p[0],a[1]+p[1]];},[0,0]).map(function(v){return v/ng.p.length;});
        var ngg=X.createRadialGradient(ctr[0]-2,ctr[1]-2,0,ctr[0],ctr[1],11*ng.sz);
        ngg.addColorStop(0,'rgba(255,232,140,'+(0.95+goldPulse*0.05)+')');
        ngg.addColorStop(0.55,'rgba(232,178,30,0.92)');
        ngg.addColorStop(1,'rgba(140,85,8,0.85)');
        X.fillStyle=ngg;
        X.beginPath();X.moveTo(ng.p[0][0],ng.p[0][1]);for(var pi=1;pi<ng.p.length;pi++)X.lineTo(ng.p[pi][0],ng.p[pi][1]);X.closePath();X.fill();
        X.strokeStyle='rgba(120,70,5,0.55)';X.lineWidth=1;X.stroke();
        // Reflet métallique
        X.fillStyle='rgba(255,250,220,'+(0.55+goldPulse*0.25)+')';
        X.beginPath();X.ellipse(ctr[0]-ng.p[0][0]*0+ (ng.p[1][0]-ctr[0])*0.3,ctr[1]+(ng.p[1][1]-ctr[1])*0.3,2.4,1.3,0.5,0,Math.PI*2);X.fill();
      });
      X.strokeStyle='rgba(220,170,40,'+(0.6+goldPulse*0.25)+')';X.lineWidth=2;X.beginPath();X.roundRect(bx+4,by+4,TILE-8,TILE-8,5);X.stroke();
    } else {
      // Cristal de diamant facetté, fond bleu profond
      var pulse=0.5+0.5*Math.sin(G.time*2.5);
      X.fillStyle='rgba(3,8,28,0.96)';X.beginPath();X.roundRect(bx+4,by+4,TILE-8,TILE-8,5);X.fill();
      var _dh2=X.createRadialGradient(cx,cy,2,cx,cy,26);
      _dh2.addColorStop(0,'rgba(60,210,255,'+(0.32+pulse*0.18)+')');_dh2.addColorStop(1,'rgba(20,100,220,0)');
      X.fillStyle=_dh2;X.beginPath();X.roundRect(bx+4,by+4,TILE-8,TILE-8,5);X.fill();
      X.save();X.translate(cx,cy-2);
      var _dfaces2=[
        {p:[[0,-18],[12,-8],[0,0]],c:'rgba(140,235,255,0.72)'},{p:[[0,-18],[-12,-8],[0,0]],c:'rgba(80,185,245,0.58)'},
        {p:[[12,-8],[12,8],[0,18],[0,0]],c:'rgba(100,220,255,0.68)'},{p:[[-12,-8],[0,0],[0,18],[-12,8]],c:'rgba(58,162,228,0.52)'},
        {p:[[0,0],[12,8],[0,18],[-12,8]],c:'rgba(78,198,248,0.45)'}
      ];
      _dfaces2.forEach(function(f){X.fillStyle=f.c;X.beginPath();X.moveTo(f.p[0][0],f.p[0][1]);for(var _dfi=1;_dfi<f.p.length;_dfi++)X.lineTo(f.p[_dfi][0],f.p[_dfi][1]);X.closePath();X.fill();});
      X.strokeStyle='rgba(175,248,255,'+(0.42+pulse*0.22)+')';X.lineWidth=1;
      X.beginPath();[0,-18,12,-8,12,8,0,18,-12,8,-12,-8].forEach(function(v,i,a){if(i%2===0)i===0?X.moveTo(v,a[i+1]):X.lineTo(v,a[i+1]);});X.closePath();X.stroke();
      X.restore();
      X.strokeStyle='rgba(58,208,255,'+(0.65+pulse*0.28)+')';X.lineWidth=2;X.beginPath();X.roundRect(bx+4,by+4,TILE-8,TILE-8,5);X.stroke();
    }
    if(bl.hp<bl.maxHp){var bw3=TILE-10;X.fillStyle='rgba(0,0,0,0.5)';X.fillRect(bx+5,by+TILE-6,bw3,4);X.fillStyle=bl.hp/bl.maxHp>0.5?'#70b038':'#d07020';X.fillRect(bx+5,by+TILE-6,bw3*(bl.hp/bl.maxHp),4);}
    X.globalAlpha=1;
    if(bl.hitFlash>0){X.fillStyle='rgba(255,30,20,'+(bl.hitFlash/0.2*0.55)+')';X.fillRect(bx+2,by+2,TILE-4,TILE-4);}
  });

  // Range indicator removed

  // Buildings
  G.buildings.forEach(function(bd){
    if(bd.ghost)X.globalAlpha=0.32;
    drawBd(bd);
    X.globalAlpha=1;
    if(bd.hitFlash>0){X.fillStyle='rgba(255,30,20,'+(bd.hitFlash/0.2*0.55)+')';X.fillRect(bd.gx*TILE+2,bd.gy*TILE+2,TILE-4,TILE-4);}
  });

  // TP highlight
  if(tpMode){G.buildings.filter(function(b){return b.type==='teleporter';}).forEach(function(bd){X.strokeStyle=tpSrc===bd?'rgba(200,255,80,0.9)':'rgba(100,200,255,0.7)';X.lineWidth=2.5;X.strokeRect(bd.gx*TILE+2,bd.gy*TILE+2,TILE-4,TILE-4);});}

  // Attack indicators
  if(bdAtk){var bd2=G.buildings.filter(function(b){return b.id===bdAtk;})[0];if(bd2){var p3=0.5+0.5*Math.sin(G.time*8);X.strokeStyle='rgba(255,80,40,'+(0.5+p3*.4)+')';X.lineWidth=2.5;X.strokeRect(bd2.gx*TILE+2,bd2.gy*TILE+2,TILE-4,TILE-4);}}
  if(blkAtk){var bl2=G.blocks.filter(function(b){return b.id===blkAtk;})[0];if(bl2){var p4=0.5+0.5*Math.sin(G.time*8);X.strokeStyle='rgba(255,80,40,'+(0.5+p4*.4)+')';X.lineWidth=2.5;X.strokeRect(bl2.gx*TILE+2,bl2.gy*TILE+2,TILE-4,TILE-4);}}
  if(metAtk){var met2=G.meteors.filter(function(m){return !m.fallen&&m.gx===metAtk.gx&&m.gy===metAtk.gy;})[0];if(met2){var p5=0.5+0.5*Math.sin(G.time*8);X.strokeStyle='rgba(255,80,40,'+(0.5+p5*.4)+')';X.lineWidth=2.5;X.strokeRect(met2.gx*TILE+2,met2.gy*TILE+2,TILE-4,TILE-4);}}

  // Placement ghost
  if((G.phase==='placement'||drillingMode)&&placePos&&placePos.locked){
    X.fillStyle=placePos.ok?'rgba(120,200,80,0.22)':'rgba(200,60,40,0.22)';X.fillRect(placePos.gx*TILE,placePos.gy*TILE,TILE,TILE);
    X.strokeStyle=placePos.ok?'rgba(140,220,80,0.85)':'rgba(220,60,40,0.75)';X.lineWidth=2;X.setLineDash([5,3]);
    X.strokeRect(placePos.gx*TILE+2,placePos.gy*TILE+2,TILE-4,TILE-4);X.setLineDash([]);
  }

  // Piques
  G.piques.forEach(function(pk){
    var bx=pk.gx*TILE,by=pk.gy*TILE,cx=bx+TILE/2,cy=by+TILE/2,pulse=0.5+0.5*Math.sin(G.time*4);
    X.fillStyle='rgba(15,8,4,0.65)';X.fillRect(bx+10,by+10,TILE-20,TILE-20);
    for(var si=0;si<4;si++){var a=si*Math.PI/2;X.strokeStyle='rgba(220,180,80,'+(0.6+pulse*.3)+')';X.lineWidth=2;X.beginPath();X.moveTo(cx,cy);X.lineTo(cx+Math.cos(a)*18,cy+Math.sin(a)*18);X.stroke();X.fillStyle='rgba(255,210,80,'+(0.7+pulse*.2)+')';X.beginPath();X.arc(cx+Math.cos(a)*18,cy+Math.sin(a)*18,3,0,Math.PI*2);X.fill();}
    X.fillStyle='rgba(255,200,80,'+(0.5+pulse*.3)+')';X.beginPath();X.arc(cx,cy,4,0,Math.PI*2);X.fill();
  });

  // Pique mode border
  if(piqueMode){X.strokeStyle='rgba(255,200,50,0.6)';X.lineWidth=2;X.setLineDash([4,3]);X.strokeRect(2,2,CW-4,CH-4);X.setLineDash([]);}

  // Pierres en vol (projectiles) — plus grosses, traînée lumineuse, halo bien visible
  if(G.rocks)G.rocks.forEach(function(rock){
    var rx=rock.x*TILE,ry=rock.y*TILE;
    var t=rock.totalTime>0?Math.min(rock.time/rock.totalTime,1):1;
    var arcH=Math.sin(t*Math.PI)*22; // arc parabolique max 22px
    // Ombre au sol (s'étale quand la pierre monte)
    X.fillStyle='rgba(0,0,0,0.25)';
    X.beginPath();X.ellipse(rx,ry+4,8*(1-arcH/28),4,0,0,Math.PI*2);X.fill();
    // Traînée derrière la pierre (sens du déplacement)
    var tdx=rock.tx-rock.ox,tdy=rock.ty-rock.oy,tdl=Math.hypot(tdx,tdy)||1;
    var trX=rx-(tdx/tdl)*16,trY=ry-arcH-(tdy/tdl)*16;
    var trg=X.createLinearGradient(rx,ry-arcH,trX,trY);
    trg.addColorStop(0,'rgba(255,210,120,0.85)');trg.addColorStop(1,'rgba(255,210,120,0)');
    X.strokeStyle=trg;X.lineWidth=5;X.lineCap='round';
    X.beginPath();X.moveTo(rx,ry-arcH);X.lineTo(trX,trY);X.stroke();
    // Halo lumineux autour de la pierre
    var hg2=X.createRadialGradient(rx,ry-arcH,1,rx,ry-arcH,13);
    hg2.addColorStop(0,'rgba(255,220,140,0.55)');hg2.addColorStop(1,'rgba(255,180,60,0)');
    X.fillStyle=hg2;X.beginPath();X.arc(rx,ry-arcH,13,0,Math.PI*2);X.fill();
    // Pierre (plus grosse, contour net)
    var rg2=X.createRadialGradient(rx-2,ry-arcH-2,1,rx,ry-arcH,7.5);
    rg2.addColorStop(0,'rgba(210,185,140,1)');rg2.addColorStop(0.6,'rgba(168,140,94,0.98)');rg2.addColorStop(1,'rgba(62,48,26,0.95)');
    X.fillStyle=rg2;
    X.beginPath();X.arc(rx,ry-arcH,7.5,0,Math.PI*2);X.fill();
    X.strokeStyle='rgba(255,230,160,0.8)';X.lineWidth=1.5;X.stroke();
  });

  // Surbrillance sélection Destruction / Fantôme
  if(_destructPending||_ghostPending){
    var _sCol=_destructPending?'255,60,40':'80,200,255';
    var _sPulse=0.5+0.5*Math.sin(G.time*7);
    G.blocks.forEach(function(b){
      if(_ghostPending&&b.ghost)return;
      X.strokeStyle='rgba('+_sCol+','+(0.45+_sPulse*0.45)+')';X.lineWidth=2.5;X.setLineDash([5,3]);
      X.strokeRect(b.gx*TILE+2,b.gy*TILE+2,TILE-4,TILE-4);X.setLineDash([]);
    });
    G.buildings.forEach(function(b){
      if(b.type!=='drill'&&b.type!=='drillfast'&&b.type!=='factory'&&b.type!=='portal')return;
      if(_destructPending&&b.type==='factory')return;
      if(_ghostPending&&b.type==='portal')return; // le fantôme ne cible pas les portails
      if(_ghostPending&&b.ghost)return;
      X.strokeStyle='rgba('+_sCol+','+(0.45+_sPulse*0.45)+')';X.lineWidth=2.5;X.setLineDash([5,3]);
      X.strokeRect(b.gx*TILE+2,b.gy*TILE+2,TILE-4,TILE-4);X.setLineDash([]);
    });
  }
  // Surbrillance INVERSION — 1er élément sélectionné en rouge, tout sélectionnable en cyan
  if(_inversionPending){
    var _invPulse=0.5+0.5*Math.sin(G.time*6);
    // Cyan sur tout ce qui est cliquable
    G.blocks.forEach(function(b){X.strokeStyle='rgba(80,200,255,'+(0.35+_invPulse*0.35)+')';X.lineWidth=2;X.setLineDash([4,3]);X.strokeRect(b.gx*TILE+2,b.gy*TILE+2,TILE-4,TILE-4);X.setLineDash([]);});
    G.buildings.forEach(function(b){if(b.type!=='drill'&&b.type!=='drillfast'&&b.type!=='factory'&&b.type!=='teleporter')return;X.strokeStyle='rgba(80,200,255,'+(0.35+_invPulse*0.35)+')';X.lineWidth=2;X.setLineDash([4,3]);X.strokeRect(b.gx*TILE+2,b.gy*TILE+2,TILE-4,TILE-4);X.setLineDash([]);});
    G.players.forEach(function(p){if(p.dead)return;var _px=Math.floor(p.x)*TILE,_py=Math.floor(p.y)*TILE;X.strokeStyle='rgba(80,200,255,'+(0.35+_invPulse*0.35)+')';X.lineWidth=2;X.setLineDash([4,3]);X.strokeRect(_px+2,_py+2,TILE-4,TILE-4);X.setLineDash([]);});
    // Rouge sur le 1er sélectionné
    if(_inversionFirst){
      X.strokeStyle='rgba(255,30,30,0.95)';X.lineWidth=3;X.setLineDash([4,3]);
      var _isPlyr=G.players.indexOf(_inversionFirst)>=0;
      if(_isPlyr){var _phx=Math.floor(_inversionFirst.x)*TILE,_phy=Math.floor(_inversionFirst.y)*TILE;X.strokeRect(_phx+2,_phy+2,TILE-4,TILE-4);}
      else{X.strokeRect(_inversionFirst.gx*TILE+2,_inversionFirst.gy*TILE+2,TILE-4,TILE-4);}
      X.setLineDash([]);
    }
  }

  // Ennemis (mode Survivant)
  if(G.enemies&&G.enemies.length)G.enemies.forEach(drawEnemy);

  // BOSS — case sûre télégraphiée, zones, attaque
  if(GAMEMODE==='boss'&&G.phase==='combat'){
    var _bPulse=0.5+0.5*Math.sin(G.time*5);
    if(bossSafeCell){
      X.fillStyle='rgba(60,255,120,'+(0.18+_bPulse*0.12)+')';
      X.fillRect(bossSafeCell.gx*TILE,bossSafeCell.gy*TILE,TILE,TILE);
      X.strokeStyle='rgba(80,255,140,'+(0.7+_bPulse*0.3)+')';X.lineWidth=3;
      X.strokeRect(bossSafeCell.gx*TILE+2,bossSafeCell.gy*TILE+2,TILE-4,TILE-4);
    }
    if(bossFlashTimer>0){
      // Flash rouge global au moment de l'impact
      X.fillStyle='rgba(255,30,20,'+(0.4*(bossFlashTimer/0.25))+')';
      X.fillRect(0,0,CW,CH);
    }
    // Flammes menaçantes sur les cases attaquées
    if(bossBurnCells&&bossBurnCells.length)bossBurnCells.forEach(function(c){
      var bx=c.gx*TILE,by=c.gy*TILE,cx=bx+TILE/2,cy=by+TILE/2;
      var a=Math.min(1,c.life/1.1);
      var flick=0.5+0.5*Math.sin(G.time*22+c.gx*3+c.gy*5);
      X.fillStyle='rgba(255,90,10,'+(0.28*a)+')';X.fillRect(bx,by,TILE,TILE);
      for(var fi=0;fi<3;fi++){
        var fx=bx+TILE*(0.25+fi*0.25)+Math.sin(G.time*14+fi*2+c.gx)*3;
        var fh=(18+flick*10+fi*3)*a;
        var fg=X.createLinearGradient(fx,cy+10,fx,cy+10-fh);
        fg.addColorStop(0,'rgba(255,60,0,'+(0.95*a)+')');
        fg.addColorStop(0.5,'rgba(255,160,20,'+(0.85*a)+')');
        fg.addColorStop(1,'rgba(255,230,120,0)');
        X.fillStyle=fg;
        X.beginPath();
        X.moveTo(fx,cy+10);
        X.quadraticCurveTo(fx-7,cy+10-fh*0.55,fx,cy+10-fh);
        X.quadraticCurveTo(fx+7,cy+10-fh*0.55,fx,cy+10);
        X.closePath();X.fill();
      }
      X.strokeStyle='rgba(255,120,20,'+(0.5*a)+')';X.lineWidth=2;
      X.strokeRect(bx+2,by+2,TILE-4,TILE-4);
    });
    drawBossSprite();
  }

  // Players
  G.players.forEach(function(p){if(!p.dead)drawPlayer(p);});

  // Mode Nocturne — brouillard de visibilité (2,75 cases de portée)
  if(nightMode&&G.phase==='combat'){
    if(lightningActive){
      // Brouillard levé pendant l'éclair
      // Flash blanc doux
      var flashAlpha=Math.min(0.45,(lightningEnd-G.time)/0.5*0.45);
      if(flashAlpha>0){X.fillStyle='rgba(200,215,255,'+flashAlpha+')';X.fillRect(0,0,CW,CH);}
      // Tracé du bolt de foudre
      if(lightningBolt&&lightningBolt.length>1){
        var boltAge=1-(lightningEnd-G.time)/1.5;
        var boltAlpha=Math.max(0,boltAge<0.3?boltAge/0.3:1-(boltAge-0.3)/0.7);
        X.save();
        // Halo lumineux large
        X.strokeStyle='rgba(200,220,255,'+boltAlpha*0.22+')';X.lineWidth=14;X.lineCap='round';X.lineJoin='round';
        X.beginPath();X.moveTo(lightningBolt[0].x,lightningBolt[0].y);
        for(var bi2=1;bi2<lightningBolt.length;bi2++)X.lineTo(lightningBolt[bi2].x,lightningBolt[bi2].y);
        X.stroke();
        // Halo moyen
        X.strokeStyle='rgba(180,200,255,'+boltAlpha*0.45+')';X.lineWidth=6;
        X.beginPath();X.moveTo(lightningBolt[0].x,lightningBolt[0].y);
        for(var bi3=1;bi3<lightningBolt.length;bi3++)X.lineTo(lightningBolt[bi3].x,lightningBolt[bi3].y);
        X.stroke();
        // Trait principal blanc
        X.strokeStyle='rgba(255,255,255,'+boltAlpha*0.92+')';X.lineWidth=2;
        X.beginPath();X.moveTo(lightningBolt[0].x,lightningBolt[0].y);
        for(var bi4=1;bi4<lightningBolt.length;bi4++)X.lineTo(lightningBolt[bi4].x,lightningBolt[bi4].y);
        X.stroke();
        // Branches secondaires
        for(var bk=2;bk<lightningBolt.length-1;bk+=3){
          if(Math.random()<0.5)continue;
          var bpx=lightningBolt[bk].x,bpy=lightningBolt[bk].y;
          var bda=Math.random()*Math.PI/2-Math.PI/4;
          X.strokeStyle='rgba(220,235,255,'+boltAlpha*0.55+')';X.lineWidth=1.2;
          X.beginPath();X.moveTo(bpx,bpy);
          X.lineTo(bpx+Math.cos(bda)*25,bpy+Math.sin(bda)*25);
          X.stroke();
        }
        X.restore();
      }
    } else {
      if(!_fogC||_fogC.width!==CW){_fogC=document.createElement('canvas');_fogC.width=CW;_fogC.height=CH;}
      var _fx=_fogC.getContext('2d');
      _fx.clearRect(0,0,CW,CH);
      _fx.fillStyle='#000';
      _fx.fillRect(0,0,CW,CH);
      _fx.globalCompositeOperation='destination-out';
      G.players.forEach(function(p){
        if(p.dead)return;
        var px=p.x*TILE,py=p.y*TILE,R=3.25*TILE;
        var grd=_fx.createRadialGradient(px,py,0,px,py,R);
        grd.addColorStop(0,'rgba(0,0,0,1)');
        grd.addColorStop(0.84,'rgba(0,0,0,1)');
        grd.addColorStop(1,'rgba(0,0,0,0)');
        _fx.fillStyle=grd;_fx.beginPath();_fx.arc(px,py,R,0,Math.PI*2);_fx.fill();
      });
      _fx.globalCompositeOperation='source-over';
      X.drawImage(_fogC,0,0);
    }
  }

  updateHUD();
}
var _fogC=null;

function drawBd(bd){
  var bx=bd.gx*TILE,by=bd.gy*TILE,cx=bx+TILE/2,cy=by+TILE/2;
  X.save();X.translate(cx,cy);
  if(bd.type==='factory'){
    X.fillStyle='#3a2c14';X.beginPath();X.roundRect(-28,-24,56,48,3);X.fill();
    X.fillStyle='#4e3c1e';X.fillRect(-24,-20,48,40);
    X.fillStyle='#2a1c0a';X.fillRect(-16,-36,8,18);X.fillRect(8,-32,8,14);
    var fg=X.createRadialGradient(-6,0,2,-6,0,16);fg.addColorStop(0,'rgba(255,140,30,0.5)');fg.addColorStop(1,'rgba(180,80,10,0)');X.fillStyle=fg;X.fillRect(-22,-14,28,28);
    X.fillStyle='rgba(255,175,55,0.32)';X.fillRect(-11,-12,9,12);X.fillRect(2,-12,9,12);
    for(var si=0;si<3;si++){var ta=G.time*.7+si*1.2;X.fillStyle='rgba(155,138,98,'+(0.09-si*.022)+')';X.beginPath();X.arc(-12+Math.sin(ta)*4,-40-si*6,4+si*1.5,0,Math.PI*2);X.fill();}
    X.strokeStyle='rgba(195,158,78,0.48)';X.lineWidth=2;X.beginPath();X.roundRect(-28,-24,56,48,3);X.stroke();
    X.fillStyle='rgba(255,228,158,0.95)';X.font='bold 14px Courier New';X.textAlign='center';X.textBaseline='middle';X.fillText('USINE',0,4);
  } else if(bd.type==='bank'){
    X.fillStyle='#3c2e12';X.beginPath();X.roundRect(-28,-22,56,44,2);X.fill();
    X.fillStyle='#503e1c';X.fillRect(-24,-18,48,36);
    for(var pi=-20;pi<=20;pi+=10){X.fillStyle='#3a2c0e';X.fillRect(pi-4,-18,8,36);X.fillStyle='#2e2208';X.fillRect(pi-5,-22,10,7);X.fillRect(pi-5,15,10,5);}
    X.strokeStyle='rgba(195,158,38,0.52)';X.lineWidth=1.5;X.beginPath();X.roundRect(-28,-22,56,44,2);X.stroke();
    X.fillStyle='rgba(255,218,78,0.97)';X.font='bold 14px Courier New';X.textAlign='center';X.textBaseline='middle';X.fillText('MAGAZIN',0,2);
  } else if(bd.type==='drill'||bd.type==='drillfast'){
    var isFast=bd.type==='drillfast';
    // Background — drillfast slightly brighter/cyan-tinted
    X.fillStyle=isFast?'#0e2030':'#28200e';X.beginPath();X.roundRect(-22,-22,44,44,3);X.fill();
    X.fillStyle=isFast?'#1a3848':'#3c301a';X.fillRect(-17,-17,34,34);
    // Gear — drillfast spins 4x faster and is brighter
    var gSpeed=isFast?8.8:2.2;
    var gAng=G.time*gSpeed;
    X.save();X.rotate(gAng);
    X.strokeStyle=isFast?'rgba(60,200,255,0.95)':'rgba(140,110,58,0.78)';X.lineWidth=2.5;
    for(var gi=0;gi<6;gi++){X.save();X.rotate(gi*Math.PI/3);X.beginPath();X.moveTo(0,5);X.lineTo(0,13);X.stroke();X.restore();}
    X.strokeStyle=isFast?'rgba(40,180,240,0.8)':'rgba(118,98,48,0.58)';X.lineWidth=2;X.beginPath();X.arc(0,0,9,0,Math.PI*2);X.stroke();
    X.fillStyle=isFast?'rgba(80,220,255,0.7)':'rgba(198,158,78,0.48)';X.beginPath();X.arc(0,0,4,0,Math.PI*2);X.fill();
    X.restore();
    // Drill bit arrow
    X.fillStyle=isFast?'rgba(80,220,255,0.9)':'rgba(158,128,68,0.9)';
    var f=bd.facing;
    if(f==='down'){X.beginPath();X.moveTo(-7,10);X.lineTo(7,10);X.lineTo(0,22);X.fill();}
    else if(f==='up'){X.beginPath();X.moveTo(-7,-10);X.lineTo(7,-10);X.lineTo(0,-22);X.fill();}
    else if(f==='right'){X.beginPath();X.moveTo(10,-7);X.lineTo(10,7);X.lineTo(22,0);X.fill();}
    else{X.beginPath();X.moveTo(-10,-7);X.lineTo(-10,7);X.lineTo(-22,0);X.fill();}
    // Border + optional glow for drillfast
    if(isFast){
      var dg=X.createRadialGradient(0,0,10,0,0,24);
      dg.addColorStop(0,'rgba(60,200,255,0.0)');dg.addColorStop(1,'rgba(60,200,255,0.18)');
      X.fillStyle=dg;X.fillRect(-22,-22,44,44);
    }
    X.strokeStyle=isFast?'rgba(60,200,255,0.85)':'rgba(178,148,78,0.42)';X.lineWidth=isFast?2.5:1.5;X.beginPath();X.roundRect(-22,-22,44,44,3);X.stroke();
    var totC=bd.stored.coal||0,totG=bd.stored.gold||0,totD=bd.stored.diamond||0,tot=totC+totG+totD;
    if(tot>0){
      var parts=[];if(totC>0)parts.push({t:totC+'C',col:'#c8c4e8'});if(totG>0)parts.push({t:totG+'G',col:'#f5c830'});if(totD>0)parts.push({t:totD+'D',col:'#80eeff'});
      var startX2=-(parts.length-1)*14;X.font='bold 15px Courier New';X.textAlign='center';X.textBaseline='middle';
      parts.forEach(function(pt){X.fillStyle='rgba(0,0,0,0.48)';X.fillRect(startX2-11,-5,24,14);X.fillStyle=pt.col;X.fillText(pt.t,startX2,4);startX2+=28;});
    }
  } else if(bd.type==='teleporter'){
    var tp=0.5+0.5*Math.sin(G.time*2.4);
    X.fillStyle='#20180a';X.beginPath();for(var ni=0;ni<6;ni++){var an=ni*Math.PI/3;if(ni===0)X.moveTo(Math.cos(an)*24,Math.sin(an)*24);else X.lineTo(Math.cos(an)*24,Math.sin(an)*24);}X.closePath();X.fill();
    var tc2=bd.owner===1?'80,140,255':bd.owner===2?'255,100,60':'120,200,255';
    var tpg=X.createRadialGradient(0,0,3,0,0,15);tpg.addColorStop(0,'rgba('+tc2+','+(0.35+tp*.35)+')');tpg.addColorStop(1,'rgba('+tc2+',0)');
    X.fillStyle=tpg;X.beginPath();X.arc(0,0,15,0,Math.PI*2);X.fill();
    X.strokeStyle='rgba(178,148,78,'+(0.38+tp*.28)+')';X.lineWidth=2;X.beginPath();for(var n2i=0;n2i<6;n2i++){var an2=n2i*Math.PI/3;if(n2i===0)X.moveTo(Math.cos(an2)*24,Math.sin(an2)*24);else X.lineTo(Math.cos(an2)*24,Math.sin(an2)*24);}X.closePath();X.stroke();
    X.fillStyle='rgba(198,228,255,'+(0.68+tp*.24)+')';X.font='bold 9px Courier New';X.textAlign='center';X.textBaseline='middle';X.fillText('TP',0,0);
  } else if(bd.type==='portal'){
    var pp=0.5+0.5*Math.sin(G.time*3);
    // Fond sombre compact
    X.fillStyle='rgba(20,4,38,0.9)';X.beginPath();X.arc(0,0,16,0,Math.PI*2);X.fill();
    // Anneau externe lumineux
    X.strokeStyle='rgba(230,80,255,'+(0.8+pp*.2)+')';X.lineWidth=3;
    X.beginPath();X.arc(0,0,15,0,Math.PI*2);X.stroke();
    // Halo violet
    var pg=X.createRadialGradient(0,0,2,0,0,13);
    pg.addColorStop(0,'rgba(220,100,255,'+(0.6+pp*.3)+')');pg.addColorStop(1,'rgba(80,10,140,0)');
    X.fillStyle=pg;X.beginPath();X.arc(0,0,13,0,Math.PI*2);X.fill();
    // Ellipse de distorsion
    X.strokeStyle='rgba(240,160,255,'+(0.55+pp*.3)+')';X.lineWidth=1.5;
    X.beginPath();X.ellipse(0,0,6,9,0,0,Math.PI*2);X.stroke();
    // Étincelles orbitales (6, rayon réduit)
    for(var _psi=0;_psi<6;_psi++){var _psA=(_psi/6)*Math.PI*2+G.time*2;
      X.fillStyle='rgba(255,160,255,'+(0.5+pp*0.4)+')';
      X.beginPath();X.arc(Math.cos(_psA)*12,Math.sin(_psA)*12,1.8,0,Math.PI*2);X.fill();}
  }
  X.restore();
  if(bd.type!=='factory'&&bd.type!=='bank'&&bd.hp<bd.maxHp){
    var hpP2=bd.hp/bd.maxHp,bwb=TILE-12;
    X.fillStyle='rgba(0,0,0,0.52)';X.fillRect(bx+6,by+TILE-7,bwb,5);
    X.fillStyle=hpP2>0.55?'rgba(78,198,58,0.9)':hpP2>0.25?'rgba(218,148,28,0.9)':'rgba(208,38,28,0.9)';X.fillRect(bx+6,by+TILE-7,bwb*hpP2,5);
  }
  if(bd.type!=='portal'&&bd.type!=='factory'&&bd.type!=='bank'){
    X.fillStyle='rgba(255,240,180,0.97)';X.font='bold 14px Courier New';X.textAlign='center';X.textBaseline='bottom';X.fillText(bd.label,cx,by+TILE-5);
  }
}

function drawEnemy(en){
  var ex=en.x*TILE,ey=en.y*TILE,r=12;
  var pulse=0.5+0.5*Math.sin(G.time*5+en.gx);
  X.save();X.translate(ex,ey);
  X.fillStyle='rgba(0,0,0,0.3)';X.beginPath();X.ellipse(0,r*0.6,r*0.7,r*0.25,0,0,Math.PI*2);X.fill();
  var eg=X.createRadialGradient(0,0,1,0,0,r);
  eg.addColorStop(0,'rgba(255,90,60,'+(0.9+pulse*0.1)+')');eg.addColorStop(1,'rgba(120,10,10,0.95)');
  X.fillStyle=eg;X.beginPath();X.arc(0,0,r,0,Math.PI*2);X.fill();
  X.strokeStyle='rgba(255,180,140,0.85)';X.lineWidth=2;X.beginPath();X.arc(0,0,r,0,Math.PI*2);X.stroke();
  X.fillStyle='#1a0000';X.beginPath();X.arc(-4,-2,2.2,0,Math.PI*2);X.fill();X.beginPath();X.arc(4,-2,2.2,0,Math.PI*2);X.fill();
  if(en.hitFlash>0){X.fillStyle='rgba(255,255,255,'+(en.hitFlash/0.2*0.6)+')';X.beginPath();X.arc(0,0,r,0,Math.PI*2);X.fill();}
  X.restore();
  var bw=TILE-20,hpFrac=en.hp/en.maxHp;
  X.fillStyle='rgba(0,0,0,0.5)';X.fillRect(ex-bw/2,ey-r-10,bw,4);
  X.fillStyle=hpFrac>0.5?'rgba(220,80,30,0.9)':'rgba(255,40,20,0.95)';
  X.fillRect(ex-bw/2,ey-r-10,bw*hpFrac,4);
}

/* ── 10 variantes du boss — mage / mécha / élémentaire, toutes liées au feu (orbe/cœur incandescent) ── */
var _BOSS_SPRITES=[
  {arc:'mage',body:[120,30,20],dark:[50,10,6],accent:[255,210,120],fire:[255,90,10]},
  {arc:'mage',body:[30,20,90],dark:[10,6,40],accent:[180,160,255],fire:[120,80,255]},
  {arc:'mage',body:[20,80,60],dark:[6,30,22],accent:[160,255,200],fire:[60,255,140]},
  {arc:'mage',body:[90,20,90],dark:[36,6,40],accent:[255,160,255],fire:[230,60,255]},
  {arc:'mech',body:[70,70,80],dark:[26,26,32],accent:[255,140,40],fire:[255,120,20]},
  {arc:'mech',body:[40,60,90],dark:[14,22,36],accent:[120,220,255],fire:[80,180,255]},
  {arc:'mech',body:[90,70,30],dark:[40,30,10],accent:[255,220,80],fire:[255,200,40]},
  {arc:'elemental',body:[180,60,10],dark:[80,24,4],accent:[255,200,80],fire:[255,80,0]},
  {arc:'elemental',body:[20,20,24],dark:[6,6,8],accent:[230,230,255],fire:[255,255,255]},
  {arc:'elemental',body:[140,20,140],dark:[54,6,54],accent:[255,140,255],fire:[200,40,220]}
];
var _bossSpriteIdx=0;
var _bossBufCanvas=null; // tampon transparent pour isoler le masque de rougissement du corps du boss
function drawBossSprite(){
  if(!G)return;
  var cx=(MAP/2)*TILE,cy=(MAP/2)*TILE;
  var cfg=_BOSS_SPRITES[_bossSpriteIdx]||_BOSS_SPRITES[0];
  var bob=Math.sin(G.time*2)*4;
  var pulse=0.5+0.5*Math.sin(G.time*3);
  var hit=bossHitFlashTimer>0?bossHitFlashTimer/0.25:0;
  var b=cfg.body,d=cfg.dark,a=cfg.accent,f=cfg.fire;
  function rgba(c,al){return 'rgba('+c[0]+','+c[1]+','+c[2]+','+al+')';}

  // Anneau de menace tournant au sol (toujours centré sur le boss)
  X.save();X.translate(cx,cy+34);
  X.rotate(G.time*0.4);
  X.strokeStyle=rgba(f,0.22+pulse*0.1);X.lineWidth=2;X.setLineDash([10,9]);
  X.beginPath();X.ellipse(0,0,40,15,0,0,Math.PI*2);X.stroke();X.setLineDash([]);
  X.restore();

  // Ombre portée au sol
  X.save();X.translate(cx,cy+30);
  X.fillStyle='rgba(0,0,0,0.45)';X.beginPath();X.ellipse(0,4,30,9,0,0,Math.PI*2);X.fill();
  X.restore();

  // Particules de braise montantes autour du boss
  X.save();X.translate(cx,cy);
  for(var pi=0;pi<9;pi++){
    var ph=(G.time*0.6+pi*0.71)%1;
    var pa=pi*2.4;
    var ppx=Math.sin(pa+G.time*0.5)*(20+pi*2);
    var ppy=34-ph*70;
    var pal=(1-ph)*0.8;
    X.fillStyle=rgba(f,pal);
    X.beginPath();X.arc(ppx,ppy,1.6-ph*1,0,Math.PI*2);X.fill();
  }
  X.restore();

  // Le corps est dessiné sur un canvas tampon transparent à part : ainsi le masque de
  // rougissement (source-atop) ne peut jamais déborder en carré sur le fond/sol déjà opaque.
  if(!_bossBufCanvas){_bossBufCanvas=document.createElement('canvas');_bossBufCanvas.width=160;_bossBufCanvas.height=180;}
  var BOX=80,BOY=100; // origine locale dans le tampon
  var BX=_bossBufCanvas.getContext('2d');
  BX.clearRect(0,0,_bossBufCanvas.width,_bossBufCanvas.height);
  var X_=X;X=BX; // redirige temporairement les appels de dessin du corps vers le tampon
  X.save();X.translate(BOX,BOY);
  // Halo lumineux d'ensemble (impression de puissance)
  X.shadowColor=rgba(f,0.85);X.shadowBlur=22+hit*20;

  // Braise au sol sous le corps
  var eg=X.createRadialGradient(0,30,2,0,30,38);
  eg.addColorStop(0,rgba(f,0.4+pulse*0.18));eg.addColorStop(1,rgba(f,0));
  X.fillStyle=eg;X.beginPath();X.ellipse(0,30,38,13,0,0,Math.PI*2);X.fill();

  if(cfg.arc==='mage'){
    // Cape — pans déchiquetés et flottants
    X.fillStyle=rgba(d,1);
    X.beginPath();X.moveTo(0,-36);
    X.lineTo(26,18);X.lineTo(20,30);X.lineTo(14,20);X.lineTo(7,34);X.lineTo(0,22);
    X.lineTo(-7,34);X.lineTo(-14,20);X.lineTo(-20,30);X.lineTo(-26,18);
    X.closePath();X.fill();
    // Robe principale (dégradé volumétrique)
    var rg=X.createLinearGradient(-22,-32,22,32);
    rg.addColorStop(0,rgba(b,1));rg.addColorStop(0.5,rgba(d,1));rg.addColorStop(1,rgba(b,1));
    X.fillStyle=rg;X.beginPath();X.moveTo(0,-32);X.lineTo(21,26);X.lineTo(-21,26);X.closePath();X.fill();
    X.strokeStyle=rgba(a,0.35);X.lineWidth=1;X.beginPath();X.moveTo(0,-32);X.lineTo(21,26);X.moveTo(0,-32);X.lineTo(-21,26);X.stroke();
    // Bras / manches
    X.fillStyle=rgba(d,1);
    X.beginPath();X.moveTo(16,-2);X.quadraticCurveTo(30,8,26,22);X.lineTo(18,18);X.quadraticCurveTo(20,4,10,-6);X.closePath();X.fill();
    // Capuche profonde avec ombre intérieure
    X.fillStyle=rgba(d,1);X.beginPath();X.moveTo(0,-58);X.quadraticCurveTo(20,-44,16,-16);X.quadraticCurveTo(0,-22,-16,-16);X.quadraticCurveTo(-20,-44,0,-58);X.closePath();X.fill();
    var hg=X.createRadialGradient(0,-22,2,0,-22,20);hg.addColorStop(0,'rgba(0,0,0,0.85)');hg.addColorStop(1,'rgba(0,0,0,0)');
    X.fillStyle=hg;X.beginPath();X.ellipse(0,-22,15,14,0,0,Math.PI*2);X.fill();
    // Yeux incandescents sous la capuche
    X.fillStyle=rgba(a,0.9+hit*0.1);X.shadowColor=rgba(a,1);X.shadowBlur=8;
    X.beginPath();X.ellipse(-6,-24,3,1.8,0,0,Math.PI*2);X.fill();
    X.beginPath();X.ellipse(6,-24,3,1.8,0,0,Math.PI*2);X.fill();
    X.shadowBlur=22+hit*20;X.shadowColor=rgba(f,0.85);
    // Bâton + orbe de feu flottant et tournoyant
    X.strokeStyle=rgba(d,1);X.lineWidth=3;X.beginPath();X.moveTo(24,20);X.lineTo(30,-32);X.stroke();
    X.strokeStyle=rgba(a,0.4);X.lineWidth=1;X.beginPath();
    for(var wi=0;wi<3;wi++){var wy=-30+wi*16;X.moveTo(28-2,wy);X.lineTo(32+2,wy+3);}
    X.stroke();
    var og=X.createRadialGradient(30,-38,1,30,-38,13);
    og.addColorStop(0,'rgba(255,250,220,'+(0.95+hit*0.05)+')');og.addColorStop(0.45,rgba(f,0.9));og.addColorStop(1,rgba(f,0));
    X.fillStyle=og;X.beginPath();X.arc(30,-38,13,0,Math.PI*2);X.fill();
    for(var ti=0;ti<3;ti++){var ta=G.time*5+ti*2.1;X.fillStyle=rgba(f,0.5);X.beginPath();X.arc(30+Math.cos(ta)*9,-38+Math.sin(ta)*9,1.4,0,Math.PI*2);X.fill();}
  } else if(cfg.arc==='mech'){
    // Jambes / pieds
    X.fillStyle=rgba(d,1);X.fillRect(-14,22,8,12);X.fillRect(6,22,8,12);
    // Torse — châssis anguleux avec plaques
    var bg=X.createLinearGradient(-20,-30,20,30);bg.addColorStop(0,rgba(b,1));bg.addColorStop(0.5,rgba(d,1));bg.addColorStop(1,rgba(b,1));
    X.fillStyle=bg;X.beginPath();X.moveTo(-20,-14);X.lineTo(20,-14);X.lineTo(22,24);X.lineTo(-22,24);X.closePath();X.fill();
    X.strokeStyle=rgba(a,0.45);X.lineWidth=1.3;X.strokeRect(-20,-14,40,38);
    X.beginPath();X.moveTo(-20,2);X.lineTo(20,2);X.stroke();
    // Rivets
    X.fillStyle=rgba(a,0.5);[-15,-5,5,15].forEach(function(rx){X.beginPath();X.arc(rx,-9,1.3,0,Math.PI*2);X.fill();X.beginPath();X.arc(rx,18,1.3,0,Math.PI*2);X.fill();});
    // Épaulières
    X.fillStyle=rgba(d,1);X.beginPath();X.roundRect(-30,-18,14,14,4);X.fill();X.beginPath();X.roundRect(16,-18,14,14,4);X.fill();
    X.strokeStyle=rgba(a,0.4);X.strokeRect(-30,-18,14,14);X.strokeRect(16,-18,14,14);
    // Tête anguleuse avec ailerons
    X.fillStyle=rgba(d,1);X.beginPath();X.moveTo(-14,-36);X.lineTo(14,-36);X.lineTo(17,-16);X.lineTo(-17,-16);X.closePath();X.fill();
    X.fillStyle=rgba(b,1);X.beginPath();X.moveTo(-16,-30);X.lineTo(-22,-22);X.lineTo(-14,-22);X.closePath();X.fill();
    X.beginPath();X.moveTo(16,-30);X.lineTo(22,-22);X.lineTo(14,-22);X.closePath();X.fill();
    // Visière lumineuse
    X.fillStyle=rgba(a,0.92+hit*0.08);X.shadowColor=rgba(a,1);X.shadowBlur=10;
    X.fillRect(-10,-29,20,6);
    X.shadowBlur=22+hit*20;X.shadowColor=rgba(f,0.85);
    // Antenne + cœur de feu sommital
    X.strokeStyle=rgba(d,1);X.lineWidth=2.2;X.beginPath();X.moveTo(0,-36);X.lineTo(0,-54);X.stroke();
    var mg=X.createRadialGradient(0,-58,1,0,-58,11);
    mg.addColorStop(0,'rgba(255,250,220,'+(0.95+hit*0.05)+')');mg.addColorStop(0.5,rgba(f,0.9));mg.addColorStop(1,rgba(f,0));
    X.fillStyle=mg;X.beginPath();X.arc(0,-58,11,0,Math.PI*2);X.fill();
    // Cœur de poitrine fissuré et lumineux
    X.fillStyle=rgba(f,0.85+hit*0.15);X.beginPath();X.moveTo(0,-2);X.lineTo(5,4);X.lineTo(0,12);X.lineTo(-5,4);X.closePath();X.fill();
    X.strokeStyle=rgba(a,0.6);X.lineWidth=1;X.stroke();
    // Vapeur / fumée des évents d'épaule
    for(var si=0;si<2;si++){var sx=si===0?-23:23;var sph=(G.time*0.7+si*0.5)%1;
      X.fillStyle='rgba(180,180,190,'+((1-sph)*0.35)+')';X.beginPath();X.arc(sx,-18-sph*20,2.5+sph*3,0,Math.PI*2);X.fill();}
  } else {
    // Élémentaire — créature vivante de feu : corps organique qui respire, visage expressif
    // (volontairement moins "cristal/énergie figée" : silhouette molle et asymétrique, pas d'étoile à pointes)
    var squish=1+Math.sin(G.time*2.2)*0.06;
    X.scale(1/squish,squish);
    var elg=X.createRadialGradient(-3,-4,2,0,-2,30);
    elg.addColorStop(0,'rgba(255,250,220,'+(0.95+hit*0.05)+')');elg.addColorStop(0.4,rgba(f,0.92));elg.addColorStop(0.75,rgba(b,0.88));elg.addColorStop(1,rgba(d,0.92));
    X.fillStyle=elg;
    X.beginPath();
    var nPts=10;
    for(var i=0;i<=nPts;i++){
      var ang=i/nPts*Math.PI*2;
      // Bosses organiques irrégulières (pas de pointes nettes) — silhouette de créature, pas de cristal
      var rr=22+Math.sin(ang*2.3+G.time*1.3)*3.5+Math.sin(ang*5+G.time*2.1)*1.8+Math.sin(G.time*1.7)*1.5;
      var px=Math.cos(ang)*rr,py=Math.sin(ang)*rr*0.86-4;
      if(i===0)X.moveTo(px,py);else X.quadraticCurveTo(Math.cos(ang-0.3)*rr,Math.sin(ang-0.3)*rr*0.86-4,px,py);
    }
    X.closePath();X.fill();
    // Petites flammèches qui s'échappent du dos, comme une crinière vivante
    for(var fj=0;fj<4;fj++){
      var fjx=(fj-1.5)*9;
      var fjh=14+Math.sin(G.time*3.4+fj*2)*7;
      var fjg=X.createLinearGradient(fjx,-22,fjx,-22-fjh);
      fjg.addColorStop(0,rgba(f,0.8));fjg.addColorStop(1,rgba(f,0));
      X.fillStyle=fjg;
      X.beginPath();X.moveTo(fjx-4,-20);X.quadraticCurveTo(fjx-7,-20-fjh*0.6,fjx,-20-fjh);X.quadraticCurveTo(fjx+7,-20-fjh*0.6,fjx+4,-20);X.closePath();X.fill();
    }
    // Visage expressif : sourcils, yeux clignotants, bouche entrouverte
    var blink=((G.time*0.45)%4)>3.85?0.12:1; // clignement bref périodique
    X.strokeStyle=rgba(d,0.9);X.lineWidth=2.2;X.lineCap='round';
    X.beginPath();X.moveTo(-11,-13);X.lineTo(-3,-16);X.stroke();
    X.beginPath();X.moveTo(11,-13);X.lineTo(3,-16);X.stroke();
    X.fillStyle=rgba(a,0.95);X.shadowColor=rgba(a,1);X.shadowBlur=9;
    X.beginPath();X.ellipse(-6,-6,3,2.4*blink,0,0,Math.PI*2);X.fill();
    X.beginPath();X.ellipse(6,-6,3,2.4*blink,0,0,Math.PI*2);X.fill();
    if(blink>0.5){X.fillStyle=rgba(d,1);X.beginPath();X.arc(-6,-6,1.1,0,Math.PI*2);X.fill();X.beginPath();X.arc(6,-6,1.1,0,Math.PI*2);X.fill();}
    X.shadowBlur=22+hit*20;X.shadowColor=rgba(f,0.85);
    var mouthOpen=2+Math.sin(G.time*5)*1.4;
    X.fillStyle=rgba(d,0.85);X.beginPath();X.ellipse(0,4,5,mouthOpen,0,0,Math.PI*2);X.fill();
  }

  X.shadowBlur=0;
  // Rougissement localisé : ne teinte que les pixels déjà dessinés du corps (silhouette exacte,
  // car le tampon est resté transparent partout ailleurs) — jamais un carré, jamais le décor autour.
  if(hit>0){
    X.save();
    X.setTransform(1,0,0,1,0,0); // coordonnées brutes du tampon, indépendantes de la translation locale
    X.globalCompositeOperation='source-atop';
    X.fillStyle='rgba(255,20,20,'+(hit*0.85)+')';
    X.fillRect(0,0,_bossBufCanvas.width,_bossBufCanvas.height);
    X.restore();
  }
  X.restore();
  X=X_; // restaure le contexte du canvas principal
  X.drawImage(_bossBufCanvas,cx-BOX,cy+bob-BOY);

  // Dégâts totaux + temps avant la prochaine attaque, inscrits sous le boss
  // (bien visible mais contenu sur la largeur d'une case pour ne jamais déborder sur les cases voisines)
  X.save();X.translate(cx,cy+60);
  var _bw=Math.min(TILE-6,58);
  X.fillStyle='rgba(0,0,0,0.55)';X.fillRect(-_bw/2,-15,_bw,30);
  X.strokeStyle=rgba(f,0.6);X.lineWidth=1;X.strokeRect(-_bw/2,-15,_bw,30);
  X.textAlign='center';X.textBaseline='middle';
  X.fillStyle=rgba(f,1);X.font='bold 12px Courier New';
  X.fillText(Math.round(bossDmgDealt)+' DMG',0,-5);
  X.fillStyle='rgba(255,210,150,0.95)';X.font='bold 12px Courier New';
  X.fillText(Math.ceil(Math.max(0,bossAttackTimer))+'s',0,9);
  X.restore();
}
function drawPlayer(p){
  var px=p.x*TILE,py=p.y*TILE,sz=28;
  X.save();X.translate(px,py);
  if(p.vx<-0.05)X.scale(-1,1);
  // Halo d'équipe au sol (visibilité)
  var teamRgb=p.team===1?'96,144,208':'208,96,64';
  var halo=X.createRadialGradient(0,sz*.3,0,0,sz*.3,sz*.62);
  halo.addColorStop(0,'rgba('+teamRgb+',0.42)');halo.addColorStop(1,'rgba(0,0,0,0)');
  X.fillStyle=halo;X.beginPath();X.arc(0,sz*.3,sz*.62,0,Math.PI*2);X.fill();
  // Ombre au sol
  X.fillStyle='rgba(0,0,0,0.35)';X.beginPath();X.ellipse(0,sz*.5,sz*.32,sz*.1,0,0,Math.PI*2);X.fill();
  // Outline lumineux autour du corps
  X.strokeStyle='rgba(255,248,200,0.6)';X.lineWidth=2;
  X.beginPath();X.moveTo(-sz*.25,-sz*.3);X.bezierCurveTo(-sz*.28,sz*.1,-sz*.2,sz*.2,-sz*.05,sz*.2);X.lineTo(sz*.05,sz*.2);X.bezierCurveTo(sz*.2,sz*.2,sz*.28,sz*.1,sz*.25,-sz*.3);X.closePath();X.stroke();
  // Corps
  X.fillStyle=p.color;X.beginPath();X.moveTo(-sz*.25,-sz*.3);X.bezierCurveTo(-sz*.28,sz*.1,-sz*.2,sz*.2,-sz*.05,sz*.2);X.lineTo(sz*.05,sz*.2);X.bezierCurveTo(sz*.2,sz*.2,sz*.28,sz*.1,sz*.25,-sz*.3);X.closePath();X.fill();
  if(p.hitFlash>0){X.fillStyle='rgba(255,30,20,'+(p.hitFlash/0.2*0.6)+')';X.beginPath();X.moveTo(-sz*.25,-sz*.3);X.bezierCurveTo(-sz*.28,sz*.1,-sz*.2,sz*.2,-sz*.05,sz*.2);X.lineTo(sz*.05,sz*.2);X.bezierCurveTo(sz*.2,sz*.2,sz*.28,sz*.1,sz*.25,-sz*.3);X.closePath();X.fill();}
  X.fillStyle='rgba(0,0,0,0.18)';X.fillRect(-sz*.04,-sz*.3,sz*.08,sz*.5);
  X.fillStyle=TEAM_COL[p.team-1];X.globalAlpha=0.45;X.fillRect(-sz*.2,-sz*.04,sz*.4,sz*.06);X.globalAlpha=1;
  X.fillStyle='#d8c8a0';X.beginPath();X.arc(0,-sz*.44,sz*.2,0,Math.PI*2);X.fill();
  X.fillStyle=TEAM_COL[p.team-1];X.globalAlpha=0.55;X.fillRect(-sz*.2,-sz*.52,sz*.4,sz*.1);X.globalAlpha=1;
  X.fillStyle=p.skin;X.beginPath();X.arc(sz*.02,-sz*.41,sz*.12,0.2,Math.PI-0.2);X.fill();
  X.fillStyle='#181008';X.beginPath();X.arc(-sz*.05,-sz*.44,sz*.024,0,Math.PI*2);X.fill();X.beginPath();X.arc(sz*.08,-sz*.44,sz*.024,0,Math.PI*2);X.fill();
  // ── ANIMATION BRAS + PIERRE ──
  X.restore(); // pop le flip
  X.save();X.translate(px,py);
  var sw=p.spearSwing||0;
  var cwr=document.getElementById('cw').getBoundingClientRect();
  var _wMx=(mouseX-cwr.left)/(cwr.width/CW)/TILE;
  var _wMy=(mouseY-cwr.top)/(cwr.height/CH)/TILE;
  if(p===G.p1)p.spearDir=Math.atan2(_wMy-p.y,_wMx-p.x);
  var kdir=p.spearDir||0;
  X.save();X.rotate(kdir);
  // Bras très court
  var armLen=sz*(0.14+sw*0.11);
  X.strokeStyle=p.skin;X.lineWidth=sz*0.13;X.lineCap='round';
  X.beginPath();X.moveTo(0,0);X.lineTo(armLen,0);X.stroke();
  // Caillou collé à la main (disparaît quand un caillou est en vol)
  var hasRockInFlight=G.rocks&&G.rocks.some(function(r){return r.owner===p&&!r.done;});
  if(!hasRockInFlight&&sw<0.4){
    var rg=X.createRadialGradient(armLen-sz*0.03,-sz*0.03,1,armLen,0,sz*0.13);
    rg.addColorStop(0,'rgba(162,136,92,0.97)');rg.addColorStop(1,'rgba(68,52,28,0.92)');
    X.fillStyle=rg;
    X.beginPath();X.arc(armLen,0,sz*0.13,0,Math.PI*2);X.fill();
    X.strokeStyle='rgba(32,22,8,0.6)';X.lineWidth=1.2;X.stroke();
  }
  // Traînée d'élan au lancer
  if(sw>0.2){
    X.strokeStyle='rgba(215,178,90,'+(sw*0.55)+')';X.lineWidth=1.2;X.setLineDash([3,3]);
    X.beginPath();X.arc(0,0,armLen,-Math.PI*0.22,Math.PI*0.22);X.stroke();
    X.setLineDash([]);
  }
  X.lineCap='butt';
  X.restore();
  X.restore();
  var bw=38,bh=5,hpX=px-bw/2,hpY=py-sz*.8-4;
  if(GAMEMODE!=='solo'&&GAMEMODE!=='coop'&&GAMEMODE!=='survivor'&&GAMEMODE!=='boss'){X.fillStyle='rgba(0,0,0,0.58)';X.fillRect(hpX-1,hpY-1,bw+2,bh+2);X.fillStyle=p.hp/p.maxHp>0.55?'rgba(78,208,58,0.95)':p.hp/p.maxHp>0.25?'rgba(218,148,28,0.95)':'rgba(208,38,28,0.95)';X.fillRect(hpX,hpY,bw*(p.hp/p.maxHp),bh);}
  if(p.inCombat&&(p.spearSwing||0)>0.1){var cf=0.5+0.5*Math.sin(G.time*20);X.strokeStyle='rgba(255,80,20,'+cf+')';X.lineWidth=2.5;X.beginPath();X.arc(px,py,sz*.65,0,Math.PI*2);X.stroke();}
}

/* HUD */
function updateHUD(){
  if(!G)return;
  var isRec=(GAMEMODE==='solo'||GAMEMODE==='coop'||GAMEMODE==='survivor'||GAMEMODE==='boss');
  var pairs=[[G.p1,'p1']];if(G.p2&&!isRec)pairs.push([G.p2,'p2']);
  pairs.forEach(function(pr){
    var p=pr[0],pfx=pr[1];
    document.getElementById(pfx+'nm').textContent=pfx==='p1'?playerNickname:(p.name||'');
    if(!isRec){
      var pct=p.hp/p.maxHp*100,hf=document.getElementById(pfx+'hf');
      if(hf){hf.style.width=pct+'%';hf.className='hf'+(pct<30?' low':pct<60?' med':'');}
      var hn=document.getElementById(pfx+'hn');if(hn)hn.textContent=Math.ceil(p.hp)+'/'+p.maxHp;
    }
    document.getElementById(pfx+'co').textContent='C '+p.coal;
    document.getElementById(pfx+'go').textContent='G '+p.gold;
    var di=document.getElementById(pfx+'di');if(di)di.textContent='D '+(p.diamond||0);
    var sr=document.getElementById(pfx+'sr');if(sr)sr.textContent=t('dmg_label')+' '+Math.round(p.dmg||10)+'  '+t('spd_label')+' '+(p.speed||1.68).toFixed(1);
  });
  var s;
  if((GAMEMODE==='solo'||GAMEMODE==='coop')&&!diamondRace){var rem=Math.max(0,SOLO_DUR-G.time);s=Math.floor(rem);}
  else{s=Math.floor(G.time);}
  document.getElementById('timer').textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
  // Indicateur de phase
  var phEl=document.getElementById('phase');
  if(G.phase==='placement'){phEl.textContent=t('placement');}
  else if(G.phase==='combat'){phEl.textContent=t('combat');}
  // Panneau SURVIVANT
  var _svh=document.getElementById('survivorhud');
  if(_svh){
    if(GAMEMODE==='survivor'&&gameRunning){
      _svh.innerHTML=t('survivor_wave')+' '+_survivorWave+'<br>'+t('survivor_kills')+' : '+_survivorKillsThisGame;
      _svh.style.display='block';
    } else {_svh.style.display='none';}
  }
  // Panneau ULTIME — gauche de l'écran (dans #leftpanel)
  var _uhud=document.getElementById('ultimatehud');
  if(_uhud){
    if(ultimateMode&&gameRunning&&G&&_ultimatePool.length){
      var _uNames={night:t('night'),speed:t('speed'),teleport:t('teleport'),random:t('random_opt'),destruct:t('destruct'),ghost:t('ghost')};
      var _uc=Math.ceil(Math.max(0,_ultimateTimer));
      var _uhtml='<div style="font-size:13px;letter-spacing:2px;color:rgba(200,60,255,0.7);margin-bottom:6px;border-bottom:1px solid rgba(140,30,180,0.35);padding-bottom:4px;font-weight:bold">'+t('ultime')+'</div>';
      _ultimatePool.forEach(function(opt){
        var _act=opt===_ultimateActiveOpt;
        var _c=_act?'rgba(230,120,255,0.98)':'rgba(150,60,180,0.5)';
        var _b=_act?'&#9658; ':'&nbsp;&nbsp;';
        var _t=_act?' <span style="font-size:13px;color:rgba(200,100,255,0.8);font-weight:bold">'+_uc+'s</span>':'';
        _uhtml+='<div style="color:'+_c+';font-size:15px;margin:3px 0;font-weight:bold">'+_b+(_uNames[opt]||opt)+_t+'</div>';
      });
      _uhud.innerHTML=_uhtml;_uhud.style.display='block';
    } else {_uhud.style.display='none';}
  }
}

// Le fil de messages flottants (foreuse vide, trop loin, posé...) a été désactivé
// définitivement : peu utile et gênant à l'écran pendant la partie.
function log(msg){}

/* Pas de son */
function sfx(){}
function resumeAudio(){}
