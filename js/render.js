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
      // Roche brune avec veinures et pépites dorées
      X.fillStyle='rgba(42,24,3,0.96)';X.beginPath();X.roundRect(bx+4,by+4,TILE-8,TILE-8,5);X.fill();
      X.strokeStyle='rgba(255,188,8,0.9)';X.lineWidth=3;X.beginPath();X.moveTo(bx+8,by+26);X.bezierCurveTo(bx+22,by+15,bx+38,by+35,bx+56,by+22);X.stroke();
      X.strokeStyle='rgba(235,162,5,0.65)';X.lineWidth=2;
      X.beginPath();X.moveTo(bx+12,by+40);X.bezierCurveTo(bx+28,by+30,bx+44,by+44,bx+55,by+36);X.stroke();
      X.beginPath();X.moveTo(bx+10,by+15);X.bezierCurveTo(bx+24,by+11,bx+36,by+22,bx+50,by+13);X.stroke();
      [[cx-10,cy-2],[cx+8,cy+7],[cx-1,cy+11]].forEach(function(gp){
        var _gn=X.createRadialGradient(gp[0]-1,gp[1]-1,0,gp[0],gp[1],5);
        _gn.addColorStop(0,'rgba(255,222,55,0.96)');_gn.addColorStop(1,'rgba(175,105,6,0.45)');
        X.fillStyle=_gn;X.beginPath();X.ellipse(gp[0],gp[1],5,3.5,0.4,0,Math.PI*2);X.fill();
      });
      X.strokeStyle='rgba(218,154,10,0.88)';X.lineWidth=2;X.beginPath();X.roundRect(bx+4,by+4,TILE-8,TILE-8,5);X.stroke();
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
  });

  // Range indicator removed

  // Buildings
  G.buildings.forEach(function(bd){
    if(bd.ghost)X.globalAlpha=0.32;
    drawBd(bd);
    X.globalAlpha=1;
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

  // Pierres en vol (projectiles)
  if(G.rocks)G.rocks.forEach(function(rock){
    var rx=rock.x*TILE,ry=rock.y*TILE;
    var t=rock.totalTime>0?Math.min(rock.time/rock.totalTime,1):1;
    var arcH=Math.sin(t*Math.PI)*22; // arc parabolique max 22px
    // Ombre au sol (s'étale quand la pierre monte)
    X.fillStyle='rgba(0,0,0,0.2)';
    X.beginPath();X.ellipse(rx,ry+4,7*(1-arcH/28),3.5,0,0,Math.PI*2);X.fill();
    // Pierre
    var rg2=X.createRadialGradient(rx-2,ry-arcH-2,1,rx,ry-arcH,5);
    rg2.addColorStop(0,'rgba(168,140,94,0.98)');rg2.addColorStop(1,'rgba(62,48,26,0.93)');
    X.fillStyle=rg2;
    X.beginPath();X.arc(rx,ry-arcH,5,0,Math.PI*2);X.fill();
    X.strokeStyle='rgba(28,20,8,0.55)';X.lineWidth=1;X.stroke();
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
      if(b.type!=='drill'&&b.type!=='drillfast'&&b.type!=='factory')return;
      if(_destructPending&&b.type==='factory')return;
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
        var px=p.x*TILE,py=p.y*TILE,R=2.75*TILE;
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
  if(GAMEMODE!=='solo'&&GAMEMODE!=='coop'){X.fillStyle='rgba(0,0,0,0.58)';X.fillRect(hpX-1,hpY-1,bw+2,bh+2);X.fillStyle=p.hp/p.maxHp>0.55?'rgba(78,208,58,0.95)':p.hp/p.maxHp>0.25?'rgba(218,148,28,0.95)':'rgba(208,38,28,0.95)';X.fillRect(hpX,hpY,bw*(p.hp/p.maxHp),bh);}
  if(p.inCombat&&(p.spearSwing||0)>0.1){var cf=0.5+0.5*Math.sin(G.time*20);X.strokeStyle='rgba(255,80,20,'+cf+')';X.lineWidth=2.5;X.beginPath();X.arc(px,py,sz*.65,0,Math.PI*2);X.stroke();}
}

/* HUD */
function updateHUD(){
  if(!G)return;
  var isRec=(GAMEMODE==='solo'||GAMEMODE==='coop');
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
  // Coûts aléatoires
  if(typeof _updateRandomCostDisplay==='function')_updateRandomCostDisplay();
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

function log(msg){
  logLines.unshift(msg);if(logLines.length>3)logLines.pop();
  for(var i=0;i<3;i++){var el=document.getElementById('l'+i);if(logLines[i]){el.textContent=logLines[i];el.className='le s';}else el.className='le';}
}

/* Pas de son */
function sfx(){}
function resumeAudio(){}
