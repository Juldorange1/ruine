/* CONSTANTS */
var NAMES=['Juldorange','Kael','Vex','Mira','Zorn'];
var PCOLORS=['#e08060','#6090d8','#80c858','#d8a040','#a060d0'];
var SKINC=['#d4a080','#90b8c0','#a0c880','#c8a868','#b890c8'];
var BD_HP={factory:99999,bank:99999,drill:200,drillfast:200,teleporter:150,portal:150,meteor:300};
var TEAM_COL=['#6090d0','#d06040'];
var SOLO_DUR=10*60;
var gameNum=1;
var gamePaused=false;
var soloDur=20;
var coopDur=20;
var diamondRace=false;
var diamondGoal=500;
var nightMode=false;
var speedMode=false;
var teleportMode=false;     // toutes les 26s : poser 1 portail
var _teleportTimer=26;
var _portalPending=false;   // sélection de case en cours pour poser le portail
var inversionMode=false;    // toutes les 26s : choisir 2 minerais/foreuses et inverser leur position
var _inversionTimer=26;
var _inversionPending=false;
var _inversionFirst=null;   // 1er élément sélectionné pour l'inversion
var randomCostMode=false;
var winResource='diamond';  // 'coal'|'gold'|'diamond' — aléatoire si randomCostMode
var ultimateMode=true;      // toujours actif
var _ultimatePool=[];       // options dans le pool ULTIME
var _ultimateTimer=60;      // secondes avant prochain changement
var _ultimateActiveOpt=null;// option actuellement active ('night','speed','teleport','random')
var destructMode=false;     // toutes les 20s: choisir un bloc/foreuse à détruire
var ghostMode=false;        // toutes les 20s: choisir un bloc/foreuse à rendre traversable
var _destructTimer=20;
var _ghostTimer=20;
var _destructPending=false;
var _ghostPending=false;
var _selectionPending=false;
var _selectionDelay=0;
var masterVolume=0.7;
var mineralQty=6;
var seriesActive=false;
var seriesScores=[];
var seriesGame=0;
var lightningTimer=35;
var lightningActive=false;
var lightningEnd=0;
var lightningDir=0;     // 0=haut, 1=droite, 2=bas, 3=gauche
var lightningPos=0.5;   // position 0..1 sur le bord
var lightningBolt=[];   // points du tracé de la foudre [{x,y},...]
var _preloadedBlocks=null;

// Types de minerai requis pour chaque achat (par défaut normaux, modifiés si randomCostMode)
var costTypes={drill:'coal',dmg:'gold',spd:'gold',block:'diamond'};

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
var _drillRefund=null; // {player,type,amount,blocksBought} — remboursement si annulation (ESC)
var lastTime=0;
var mouseX=0,mouseY=0;
document.addEventListener('mousemove',function(e){mouseX=e.clientX;mouseY=e.clientY;});
