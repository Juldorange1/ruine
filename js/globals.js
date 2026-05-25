/* CONSTANTS */
var NAMES=['Juldorange','Kael','Vex','Mira','Zorn'];
var PCOLORS=['#e08060','#6090d8','#80c858','#d8a040','#a060d0'];
var SKINC=['#d4a080','#90b8c0','#a0c880','#c8a868','#b890c8'];
var BD_HP={factory:99999,bank:99999,drill:200,drillfast:200,teleporter:150,meteor:300};
var TEAM_COL=['#6090d0','#d06040'];
var SOLO_DUR=10*60; // overridden by soloDur/coopDur at game start
var gameNum=1;
var gamePaused=false;
var soloDur=10;
var coopDur=10;
var diamondRace=false;   // true = 700 diamond race mode
var mineralQty=5; // 3, 5, or 7 minerals per type
var soloMineralQty=5;
var coopMineralQty=5;
var destructionMode=false; // set by JOUER button
var destroyMode=false;  // true = win by destroying all minerals
var seriesActive=false;  // true = playing 3-game series
var seriesScores=[];     // diamond scores per game in series
var seriesGame=0;        // current game in series (1-3)

/* STATE */
var G=null,keys={},gameRunning=false,logLines=[];
var GAMEMODE='';
var placeQueue=[],placePos=null,placeGen=0;
var shopOpen=null,shopPlayer=null;
var tpMode=false,tpSrc=null,tpPlayer=null;
var bdAtk=null,bdAtkTimer=0,bdAtkPlayer=null;
var blkAtk=null,blkAtkTimer=0,blkAtkPlayer=null;
var metAtk=null,metAtkTimer=0,metAtkPlayer=null;
var piqueMode=false,piquePlayer=null;
var drillingMode=false;
var lastTime=0;
var mouseX=0,mouseY=0;
document.addEventListener('mousemove',function(e){mouseX=e.clientX;mouseY=e.clientY;});