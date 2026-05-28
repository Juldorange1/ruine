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
    var mg=X.createRadialGradient(cx,cy,6,cx,cy,TILE*.6);
    mg.addColorStop(0,'rgba(255,100,20,'+(0.2+p2*.2)+')');mg.addColorStop(1,'rgba(200,60,10,0)');
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
    if(bl.type==='coal'){
      X.fillStyle='rgba(20,18,30,0.82)';X.fillRect(bx+4,by+6,TILE-8,TILE-12);
      X.strokeStyle='rgba(100,90,140,0.6)';X.lineWidth=1.5;X.strokeRect(bx+4,by+6,TILE-8,TILE-12);
      X.fillStyle='#c8c0e8';X.font='bold 11px Courier New';X.textAlign='center';X.textBaseline='middle';X.fillText('CHARBON',cx,cy);
    } else if(bl.type==='gold'){
      X.fillStyle='rgba(28,20,6,0.82)';X.fillRect(bx+4,by+6,TILE-8,TILE-12);
      X.strokeStyle='rgba(200,155,20,0.7)';X.lineWidth=1.5;X.strokeRect(bx+4,by+6,TILE-8,TILE-12);
      var gg=X.createRadialGradient(cx,cy,2,cx,cy,10);gg.addColorStop(0,'rgba(255,210,50,0.8)');gg.addColorStop(1,'rgba(180,130,10,0)');X.fillStyle=gg;X.fillRect(cx-8,cy-5,16,10);
      X.fillStyle='#f5c830';X.font='bold 11px Courier New';X.textAlign='center';X.textBaseline='middle';X.fillText('OR',cx,cy);
    } else {
      var pulse=0.5+0.5*Math.sin(G.time*2.5);
      X.fillStyle='rgba(6,10,20,0.85)';X.fillRect(bx+4,by+6,TILE-8,TILE-12);
      X.strokeStyle='rgba(80,200,255,'+(0.5+pulse*.3)+')';X.lineWidth=1.5;X.strokeRect(bx+4,by+6,TILE-8,TILE-12);
      var dg=X.createRadialGradient(cx,cy,2,cx,cy,12);dg.addColorStop(0,'rgba(100,220,255,'+(0.4+pulse*.3)+')');dg.addColorStop(1,'rgba(40,150,220,0)');X.fillStyle=dg;X.beginPath();X.arc(cx,cy,12,0,Math.PI*2);X.fill();
      X.fillStyle='rgba(160,240,255,0.98)';X.font='bold 11px Courier New';X.textAlign='center';X.textBaseline='middle';X.fillText('DIAMANT',cx,cy);
    }
    if(bl.hp<bl.maxHp){var bw3=TILE-10;X.fillStyle='rgba(0,0,0,0.5)';X.fillRect(bx+5,by+TILE-6,bw3,4);X.fillStyle=bl.hp/bl.maxHp>0.5?'#70b038':'#d07020';X.fillRect(bx+5,by+TILE-6,bw3*(bl.hp/bl.maxHp),4);}
  });

  // Range indicator removed

  // Buildings
  G.buildings.forEach(function(bd){drawBd(bd);});

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

  // Players
  G.players.forEach(function(p){if(!p.dead)drawPlayer(p);});
  updateHUD();
}

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
    X.fillStyle='rgba(255,228,158,0.95)';X.font='bold 12px Courier New';X.textAlign='center';X.textBaseline='middle';X.fillText('USINE',0,4);
  } else if(bd.type==='bank'){
    X.fillStyle='#3c2e12';X.beginPath();X.roundRect(-28,-22,56,44,2);X.fill();
    X.fillStyle='#503e1c';X.fillRect(-24,-18,48,36);
    for(var pi=-20;pi<=20;pi+=10){X.fillStyle='#3a2c0e';X.fillRect(pi-4,-18,8,36);X.fillStyle='#2e2208';X.fillRect(pi-5,-22,10,7);X.fillRect(pi-5,15,10,5);}
    X.strokeStyle='rgba(195,158,38,0.52)';X.lineWidth=1.5;X.beginPath();X.roundRect(-28,-22,56,44,2);X.stroke();
    X.fillStyle='rgba(255,218,78,0.97)';X.font='bold 12px Courier New';X.textAlign='center';X.textBaseline='middle';X.fillText('MAGAZIN',0,2);
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
  }
  X.restore();
  if(bd.type!=='factory'&&bd.type!=='bank'){
    var hpP2=bd.hp/bd.maxHp,bwb=TILE-12;
    X.fillStyle='rgba(0,0,0,0.52)';X.fillRect(bx+6,by+TILE-7,bwb,5);
    X.fillStyle=hpP2>0.55?'rgba(78,198,58,0.9)':hpP2>0.25?'rgba(218,148,28,0.9)':'rgba(208,38,28,0.9)';X.fillRect(bx+6,by+TILE-7,bwb*hpP2,5);
  }
  X.fillStyle='rgba(255,240,180,0.97)';X.font='bold 12px Courier New';X.textAlign='center';X.textBaseline='bottom';X.fillText(bd.label,cx,by+TILE-6);
}

function drawPlayer(p){
  var px=p.x*TILE,py=p.y*TILE,sz=28;
  X.save();X.translate(px,py);
  if(p.vx<-0.05)X.scale(-1,1);
  X.fillStyle='rgba(0,0,0,0.3)';X.beginPath();X.ellipse(0,sz*.5,sz*.28,sz*.08,0,0,Math.PI*2);X.fill();
  X.fillStyle=p.color;X.beginPath();X.moveTo(-sz*.25,-sz*.3);X.bezierCurveTo(-sz*.28,sz*.1,-sz*.2,sz*.2,-sz*.05,sz*.2);X.lineTo(sz*.05,sz*.2);X.bezierCurveTo(sz*.2,sz*.2,sz*.28,sz*.1,sz*.25,-sz*.3);X.closePath();X.fill();
  X.fillStyle='rgba(0,0,0,0.18)';X.fillRect(-sz*.04,-sz*.3,sz*.08,sz*.5);
  X.fillStyle=TEAM_COL[p.team-1];X.globalAlpha=0.45;X.fillRect(-sz*.2,-sz*.04,sz*.4,sz*.06);X.globalAlpha=1;
  X.fillStyle='#d8c8a0';X.beginPath();X.arc(0,-sz*.44,sz*.2,0,Math.PI*2);X.fill();
  X.fillStyle=TEAM_COL[p.team-1];X.globalAlpha=0.55;X.fillRect(-sz*.2,-sz*.52,sz*.4,sz*.1);X.globalAlpha=1;
  X.fillStyle=p.skin;X.beginPath();X.arc(sz*.02,-sz*.41,sz*.12,0.2,Math.PI-0.2);X.fill();
  X.fillStyle='#181008';X.beginPath();X.arc(-sz*.05,-sz*.44,sz*.024,0,Math.PI*2);X.fill();X.beginPath();X.arc(sz*.08,-sz*.44,sz*.024,0,Math.PI*2);X.fill();
  // ── SPEAR ANIMATION ──
  // The canvas is already translated to (px,py) and may be X.scale(-1,1)
  // We need to draw the spear in WORLD space so it always points to mouse.
  // Restore the flip before drawing the spear.
  X.restore(); // pop the flip transform
  X.save();    // fresh save at (0,0) world
  X.translate(px,py); // back to player world pos
  var sw=p.spearSwing||0;
  // Always compute angle toward mouse right here in drawPlayer
  var cwr=document.getElementById('cw').getBoundingClientRect();
  var _wMx=(mouseX-cwr.left)/(cwr.width/CW)/TILE;
  var _wMy=(mouseY-cwr.top)/(cwr.height/CH)/TILE;
  if(p===G.p1)p.spearDir=Math.atan2(_wMy-p.y,_wMx-p.x);
  var kdir=p.spearDir||0;
  // Draw spear from body CENTER, rotating toward mouse — same length all directions
  X.save();
  X.rotate(kdir); // rotate so +X = toward mouse

  // Shaft: starts slightly behind center, extends toward mouse
  var shaftBack = -sz*0.15; // behind player
  var shaftFront = sz*0.85 + sw*sz*0.25; // in front, extends on strike
  X.strokeStyle='rgba(100,65,25,0.9)';X.lineWidth=sz*.09;X.lineCap='round';
  X.beginPath();X.moveTo(shaftBack,0);X.lineTo(shaftFront,0);X.stroke();

  // Grip wrap (middle)
  X.strokeStyle='rgba(60,35,10,0.7)';X.lineWidth=sz*.11;
  X.beginPath();X.moveTo(-sz*.1,0);X.lineTo(sz*.1,0);X.stroke();

  // Spear tip (arrowhead) at the front
  var tipX=shaftFront;
  var tipLen=sz*(0.2+sw*0.1);
  var tipW=sz*0.07;
  var shine=0.7+sw*0.3;
  X.fillStyle='rgba(200,215,235,'+shine+')';
  X.beginPath();
  X.moveTo(tipX,0);              // tip point
  X.lineTo(tipX-tipLen,-tipW);   // top base
  X.lineTo(tipX-tipLen,tipW);    // bottom base
  X.closePath();X.fill();
  // Edge shine on tip
  X.strokeStyle='rgba(240,248,255,'+(0.5+sw*0.45)+')';X.lineWidth=1;
  X.beginPath();X.moveTo(tipX,0);X.lineTo(tipX-tipLen*0.7,-tipW*0.5);X.stroke();

  // Butt spike at the back
  X.fillStyle='rgba(150,130,80,0.7)';
  X.beginPath();X.moveTo(shaftBack,0);X.lineTo(shaftBack-sz*.08,-sz*.04);X.lineTo(shaftBack-sz*.08,sz*.04);X.closePath();X.fill();

  // Strike effect
  if(sw>0.25){
    var sa=sw*0.65;
    X.strokeStyle='rgba(255,230,160,'+sa+')';X.lineWidth=1.8;X.setLineDash([5,3]);
    X.beginPath();X.arc(0,0,shaftFront*0.85,-Math.PI*.25,Math.PI*.25);X.stroke();
    X.setLineDash([]);
    X.fillStyle='rgba(255,245,120,'+(sw*0.85)+')';
    X.beginPath();X.arc(tipX,0,sz*.065,0,Math.PI*2);X.fill();
  }

  X.lineCap='butt';
  X.restore();
  X.restore();
  X.restore(); // spear arm
  X.restore(); // world translate (from spear section)
  var bw=38,bh=5,hpX=px-bw/2,hpY=py-sz*.8-4;
  if(GAMEMODE!=='solo'&&GAMEMODE!=='coop'){X.fillStyle='rgba(0,0,0,0.58)';X.fillRect(hpX-1,hpY-1,bw+2,bh+2);X.fillStyle=p.hp/p.maxHp>0.55?'rgba(78,208,58,0.95)':p.hp/p.maxHp>0.25?'rgba(218,148,28,0.95)':'rgba(208,38,28,0.95)';X.fillRect(hpX,hpY,bw*(p.hp/p.maxHp),bh);}
  X.fillStyle='rgba(255,238,188,0.95)';X.font='bold 12px Courier New';X.textAlign='center';X.textBaseline='bottom';X.fillText(p.name,px,hpY-2);
  if(p.inCombat&&(p.spearSwing||0)>0.1){var cf=0.5+0.5*Math.sin(G.time*20);X.strokeStyle='rgba(255,80,20,'+cf+')';X.lineWidth=2.5;X.beginPath();X.arc(px,py,sz*.65,0,Math.PI*2);X.stroke();}
}

/* HUD */
function updateHUD(){
  if(!G)return;
  var pairs=[[G.p1,'p1']];if(G.p2)pairs.push([G.p2,'p2']);
  pairs.forEach(function(pr){
    var p=pr[0],pfx=pr[1];
    document.getElementById(pfx+'nm').textContent=p.name+(p.dead?' [MORT]':'');
    var pct=p.hp/p.maxHp*100,hf=document.getElementById(pfx+'hf');
    if(!(GAMEMODE==='solo'||GAMEMODE==='coop')){hf.style.width=pct+'%';hf.className='hf'+(pct<30?' low':pct<60?' med':'');}
    document.getElementById(pfx+'hn').textContent=(GAMEMODE==='solo'||GAMEMODE==='coop')?'':(Math.ceil(p.hp)+'/'+p.maxHp);
    document.getElementById(pfx+'sr').textContent='DMG '+p.dmg+'  SPD '+p.speed.toFixed(1);
    document.getElementById(pfx+'co').textContent='C '+p.coal;
    document.getElementById(pfx+'go').textContent='G '+p.gold;
    var di=document.getElementById(pfx+'di');if(di)di.textContent='D '+(p.diamond||0);
  });
  if(survivorMode){
    document.getElementById('timer').textContent='☄ '+survivorMeteorCount;
  } else {
    var s;
    if((GAMEMODE==='solo'||GAMEMODE==='coop')&&!diamondRace){var rem=Math.max(0,SOLO_DUR-G.time);s=Math.floor(rem);}
    else if(diamondRace){s=Math.floor(G.time);}
    else s=Math.floor(G.time);
    document.getElementById('timer').textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
  }
}

function log(msg){
  logLines.unshift(msg);if(logLines.length>3)logLines.pop();
  for(var i=0;i<3;i++){var el=document.getElementById('l'+i);if(logLines[i]){el.textContent=logLines[i];el.className='le s';}else el.className='le';}
}

/* SOUND — Web Audio API synthesisé */
var _actx=null;
function _ac(){
  if(!_actx)try{_actx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}
  return _actx;
}

function sfx(name){
  var ctx=_ac();if(!ctx)return;
  var now=ctx.currentTime;

  /* tone(type, f1, f2, vol, atk, sus, rel, del) */
  function tone(type,f1,f2,vol,atk,sus,rel,del){
    del=del||0;
    var o=ctx.createOscillator(),g=ctx.createGain();
    o.connect(g);g.connect(ctx.destination);
    o.type=type;
    o.frequency.setValueAtTime(f1,now+del);
    if(f2&&f2!==f1)o.frequency.exponentialRampToValueAtTime(f2,now+del+atk+sus+rel*0.5);
    g.gain.setValueAtTime(0.0001,now+del);
    g.gain.linearRampToValueAtTime(vol,now+del+atk);
    g.gain.setValueAtTime(vol,now+del+atk+sus);
    g.gain.exponentialRampToValueAtTime(0.0001,now+del+atk+sus+rel);
    o.start(now+del);o.stop(now+del+atk+sus+rel+0.05);
  }

  /* bruit coloré filtré */
  function boom(fHz,vol,atk,dec,del){
    del=del||0;
    var len=Math.ceil(ctx.sampleRate*(atk+dec+0.1));
    var buf=ctx.createBuffer(1,len,ctx.sampleRate);
    var d=buf.getChannelData(0);
    for(var i=0;i<len;i++)d[i]=(Math.random()*2-1);
    var src=ctx.createBufferSource(),filt=ctx.createBiquadFilter(),g=ctx.createGain();
    src.buffer=buf;src.connect(filt);filt.connect(g);g.connect(ctx.destination);
    filt.type='lowpass';filt.frequency.value=fHz;
    g.gain.setValueAtTime(0.0001,now+del);
    g.gain.linearRampToValueAtTime(vol,now+del+atk);
    g.gain.exponentialRampToValueAtTime(0.0001,now+del+atk+dec);
    src.start(now+del);src.stop(now+del+atk+dec+0.1);
  }

  switch(name){
    /* Coup de lance sur bâtiment / bloc */
    case 'strike':
      tone('square',700,150,0.22,0.001,0,0.1);
      boom(500,0.12,0.001,0.07);
      break;
    /* Ramassage de ressources */
    case 'collect':
      tone('sine',520,0,0.2,0.008,0.04,0.14);
      tone('sine',780,0,0.14,0.008,0.04,0.17,0.05);
      tone('sine',1040,0,0.1,0.008,0.04,0.2,0.12);
      break;
    /* Construction de bâtiment */
    case 'build':
    case 'place':
      tone('sine',110,45,0.45,0.003,0,0.3);
      tone('triangle',380,190,0.16,0.001,0,0.12);
      break;
    /* Achat d'amélioration */
    case 'buy':
      tone('sine',830,0,0.18,0.005,0.02,0.13);
      tone('sine',1050,0,0.13,0.005,0.02,0.16,0.07);
      break;
    /* Apparition météore */
    case 'meteor':
      tone('sawtooth',60,38,0.3,0.12,0.2,0.5);
      boom(200,0.22,0.15,0.55);
      break;
    /* Impact météore */
    case 'impact':
      boom(600,0.45,0.001,0.4);
      tone('sine',55,22,0.4,0.001,0,0.45);
      tone('triangle',210,55,0.18,0.001,0,0.28);
      break;
    /* Joueur touché */
    case 'damage':
      tone('sawtooth',260,75,0.28,0.001,0,0.18);
      break;
    /* Mort d'un joueur */
    case 'death':
      tone('sine',370,110,0.28,0.01,0.08,0.6);
      tone('sine',260,75,0.18,0.02,0.08,0.7,0.1);
      break;
    /* Téléportation */
    case 'tp':
      tone('sine',160,950,0.26,0.06,0.06,0.2);
      tone('sine',1200,280,0.16,0.001,0,0.28);
      break;
    /* Marcher sur une pique */
    case 'pique':
      tone('square',460,220,0.16,0.001,0,0.09);
      break;
    /* Foreuse qui mine */
    case 'drill':
      tone('sawtooth',170,80,0.15,0.001,0,0.1);
      break;
    /* Victoire */
    case 'win':
      tone('sine',523,0,0.28,0.01,0.1,0.18);       /* C5 */
      tone('sine',659,0,0.28,0.01,0.1,0.18,0.2);   /* E5 */
      tone('sine',784,0,0.32,0.01,0.16,0.3,0.4);   /* G5 */
      break;
    /* Fin de partie neutre */
    case 'end':
      tone('sine',330,190,0.22,0.01,0.1,0.55);
      break;
  }
}

function resumeAudio(){if(_actx&&_actx.state==='suspended')_actx.resume();}
function startMusic(){}
