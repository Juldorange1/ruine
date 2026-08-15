var C=document.getElementById('c'),X=C.getContext('2d');
var TILE=64,MAP=13,CW=MAP*TILE,CH=MAP*TILE;
C.width=CW;C.height=CH;
function resz(){
  var mob=window.innerWidth<600;
  var hudH=mob?58:0;
  var avW=window.innerWidth,avH=window.innerHeight-hudH;
  var s=Math.min(avW/CW,avH/CH)*(mob?0.97:0.91);
  var cw=document.getElementById('cw');
  cw.style.transform='translate(-50%,-50%) scale('+s+')';
  cw.style.top=mob?(hudH+avH/2)+'px':'50%';
}
window.addEventListener('resize',resz);resz();

/* DESERT FLOOR IMAGE */
var floorC=document.createElement('canvas');floorC.width=CW;floorC.height=CH;
var floorReady=false;
(function(){var fc0=floorC.getContext('2d');fc0.fillStyle='#c09040';fc0.fillRect(0,0,CW,CH);})();
(function(){
  var fc=floorC.getContext('2d'),img=new Image();
  img.onload=function(){
    fc.drawImage(img,0,0,CW,CH);
    fc.fillStyle='rgba(0,0,0,0.15)';fc.fillRect(0,0,CW,CH);
    var vg=fc.createRadialGradient(CW/2,CH/2,CW*.05,CW/2,CH/2,CW*.72);
    vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,0.42)');
    fc.fillStyle=vg;fc.fillRect(0,0,CW,CH);
    floorReady=true;
  };
  var d=document.getElementById('tex-desert1');
  if(d) img.src=d.src;
})();
