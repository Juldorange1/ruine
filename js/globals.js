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
var _inversionPending=false;
var _inversionFirst=null;   // 1er élément sélectionné pour l'inversion (shop)
var _inversionShopMode=false; // true = achat shop (pas ultime)
var randomCostMode=false;
var winResource='diamond';  // 'coal'|'gold'|'diamond' — aléatoire si randomCostMode
var ultimateMode=true;      // toujours actif
var _ultimatePool=[];       // options dans le pool ULTIME
var _ultimateTimer=60;      // secondes avant prochain changement
var _ultimateActiveOpt=null;// option actuellement active
var _ultimateSwitchPending=false;// true quand timer expiré, attend la fin de sélection avant switch
var destructMode=false;     // toutes les 30s: choisir un bloc/foreuse à détruire
var ghostMode=false;        // toutes les 30s: choisir un bloc/foreuse à rendre traversable
var _destructTimer=30;
var _ghostTimer=30;
var _destructPending=false;
var _ghostPending=false;
var _selectionPending=false;
var _selectionDelay=0;
var _startDrillsPlaced=false; // true une fois les 4 foreuses de départ placées
var masterVolume=0.7;
var mineralQty=7;
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
var _survivorWave=0;
var _survivorKillsThisGame=0;

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

/* ── PARAMÈTRES ── */
var playerNickname='';
var gameLanguage='fr';
var gameTheme=0;
var p1Keys={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'};
var p1PauseKey='Escape';
var p1RestartKey='$';
var _capturingKey=null;

/* ── I18N ── */
var I18N={
  fr:{
    placement:'PLACEMENT',combat:'COMBAT',
    ultime:'⚡ ULTIME',
    night:'NOCTURNE',speed:'FRÉNÉSIE',teleport:'TÉLÉPORTEUR',
    random_opt:'ALÉATOIRE',destruct:'DESTRUCTION',ghost:'FANTÔME',inversion:'INVERSION',
    drill:'FOREUSE',drillfast:'FOREUSE+',tp:'TÉLÉPORTEUR',
    placer:'PLACER',clic_case:'cliquer une case',
    msg_detruire:'DÉTRUIRE : cliquer un minerai ou foreuse',
    msg_fantome:'FANTÔME : cliquer un minerai ou foreuse',
    msg_inversion_pick1:'INVERSION : cliquer le 1er élément',
    msg_inversion_pick2:'INVERSION : cliquer le 2e élément',
    shop_inversion:'INVERSION',
    shop_inversion_eff:'Échange 2 éléments (minerais, foreuses, joueur)',
    msg_portail:'PORTAIL : cliquer une case libre',
    dmg_label:'DMG',spd_label:'DPL',
    log_place:'Posé',log_cancel:'Achat annulé, remboursé :',
    log_inversion:'Inversion !',log_portail:'Portail posé !',log_occ:'Case occupée !',
    log_inversion_cancel:'Inversion annulée.',
    params_title:'PARAMÈTRES',lang_title:'LANGUE / LANGUAGE',
    nick_title:'PSEUDONYME',nick_ph:'Ton nom (affiché en jeu)...',
    save_btn:'ENREGISTRER',saved_msg:'✓ Enregistré !',
    keys_title:'TOUCHES DE DÉPLACEMENT',
    key_up:'↑ HAUT',key_down:'↓ BAS',key_left:'← GAUCHE',key_right:'→ DROITE',
    key_pause:'⏸ PAUSE',
    key_restart:'⟳ RELANCER (1s)',
    key_capture:'Appuie sur une touche...',
    close_x:'FERMER ✕',close:'FERMER',
    rules_title:'RÈGLES DU JEU',
    choose_mode:'CHOISISSEZ UN MODE',
    btn_rules:'? RÈGLES',btn_params:'⚙ PARAMÈTRES',
    phase_menu:'MENU',
    phase_placement:'PLACEMENT',
    phase_combat:'COMBAT',
    end_finished:'PARTIE TERMINÉE',
    end_coop:'COOP TERMINÉE',
    time_label:'Temps',
    mode_label:'Mode',
    total_label:'Total',
    pause_title:'PAUSE',
    pause_hint:'ESPACE / ESC pour reprendre',
    btn_resume:'REPRENDRE',
    btn_menu_short:'MENU',
    btn_replay:'REJOUER',
    confirm_abandon:'Abandonner la partie et revenir au menu ?',
    costs_header:'COÛTS',
    cost_drill_label:'Foreuse',
    cost_dmg_label:'Dégâts',
    cost_spd_label:'Vitesse',
    cost_block_label:'Blocs',
    cost_obj:'Objectif',
    shop_title:'USINE',
    shop_close_hint:'ESC pour fermer',
    shop_buy:'ACHETER',
    shop_drilleff:'Extrait 1 ressource / 5s',
    shop_drillfast_eff:'Extrait 1 ressource / 2,5s',
    shop_current:'Actuel',
    shop_dmg_name:'+2 Dégâts',
    shop_spd_name:'+0.2 Vitesse',
    shop_blocks_label:'BLOCS',
    res_coal:'Charbon',
    res_gold:'Or',
    res_diamond:'Diamant',
    role_solo:'Solo',
    role_coop1:'Coop P1',
    role_coop2:'Coop P2',
    theme_title:'DÉCOR',
    theme_desert:'DÉSERT',
    theme_volcanic:'VOLCANIQUE',
    theme_glacial:'GLACIAL',
    pbar_confirm:'CONFIRMER',
    pbar_click:'Cliquez une case',
    mob_pause:'II PAUSE',
    menu_arrow:'← MENU',
    mode_solo:'Solo',
    mode_coop:'Coop',
    kh_text:'P1:Touches+Clic · Clic=activer · Clic-droit=attaquer · ESC=pause',
    vol_title:'VOLUME',
    survivor_title:'SURVIVANT',
    survivor_wave:'VAGUE',
    survivor_best:'Record',
    survivor_kills:'Ennemis tués',
    survivor_survived:'Survécu',
    mode_survivor:'Survivant',
    end_survivor:'PARTIE TERMINÉE'
  },
  en:{
    placement:'PLACEMENT',combat:'COMBAT',
    ultime:'⚡ ULTIMATE',
    night:'NIGHT',speed:'FRENZY',teleport:'TELEPORTER',
    random_opt:'RANDOM',destruct:'DESTRUCTION',ghost:'GHOST',inversion:'SWAP',
    drill:'DRILL',drillfast:'DRILL+',tp:'TELEPORTER',
    placer:'PLACE',clic_case:'click a tile',
    msg_detruire:'DESTROY: click a mineral or drill',
    msg_fantome:'GHOST: click a mineral or drill',
    msg_inversion_pick1:'SWAP: click the 1st element',
    msg_inversion_pick2:'SWAP: click the 2nd element',
    shop_inversion:'SWAP',
    shop_inversion_eff:'Swap 2 elements (minerals, drills, player)',
    msg_portail:'PORTAL: click an empty tile',
    dmg_label:'DMG',spd_label:'SPD',
    log_place:'Placed',log_cancel:'Purchase cancelled, refunded:',
    log_inversion:'Swapped!',log_portail:'Portal placed!',log_occ:'Tile occupied!',
    log_inversion_cancel:'Swap cancelled.',
    params_title:'SETTINGS',lang_title:'LANGUAGE',
    nick_title:'NICKNAME',nick_ph:'Your name (shown in game)...',
    save_btn:'SAVE',saved_msg:'✓ Saved!',
    keys_title:'MOVEMENT KEYS',
    key_up:'↑ UP',key_down:'↓ DOWN',key_left:'← LEFT',key_right:'→ RIGHT',
    key_pause:'⏸ PAUSE',
    key_restart:'⟳ RESTART (1s)',
    key_capture:'Press a key...',
    close_x:'CLOSE ✕',close:'CLOSE',
    rules_title:'GAME RULES',
    choose_mode:'CHOOSE A MODE',
    btn_rules:'? RULES',btn_params:'⚙ SETTINGS',
    phase_menu:'MENU',
    phase_placement:'PLACEMENT',
    phase_combat:'COMBAT',
    end_finished:'GAME OVER',
    end_coop:'COOP FINISHED',
    time_label:'Time',
    mode_label:'Mode',
    total_label:'Total',
    pause_title:'PAUSE',
    pause_hint:'SPACE / ESC to resume',
    btn_resume:'RESUME',
    btn_menu_short:'MENU',
    btn_replay:'PLAY AGAIN',
    confirm_abandon:'Abandon the game and return to menu?',
    costs_header:'COSTS',
    cost_drill_label:'Drill',
    cost_dmg_label:'Damage',
    cost_spd_label:'Speed',
    cost_block_label:'Blocks',
    cost_obj:'Goal',
    shop_title:'FACTORY',
    shop_close_hint:'ESC to close',
    shop_buy:'BUY',
    shop_drilleff:'Extracts 1 resource / 5s',
    shop_drillfast_eff:'Extracts 1 resource / 2.5s',
    shop_current:'Current',
    shop_dmg_name:'+2 Damage',
    shop_spd_name:'+0.2 Speed',
    shop_blocks_label:'BLOCKS',
    res_coal:'Coal',
    res_gold:'Gold',
    res_diamond:'Diamond',
    role_solo:'Solo',
    role_coop1:'Coop P1',
    role_coop2:'Coop P2',
    theme_title:'THEME',
    theme_desert:'DESERT',
    theme_volcanic:'VOLCANIC',
    theme_glacial:'GLACIAL',
    pbar_confirm:'CONFIRM',
    pbar_click:'Click a tile',
    mob_pause:'II PAUSE',
    menu_arrow:'← MENU',
    mode_solo:'Solo',
    mode_coop:'Coop',
    kh_text:'P1:Keys+Click · Click=activate · Right-click=attack · ESC=pause',
    vol_title:'VOLUME',
    survivor_title:'SURVIVOR',
    survivor_wave:'WAVE',
    survivor_best:'Record',
    survivor_kills:'Enemies killed',
    survivor_survived:'Survived',
    mode_survivor:'Survivor',
    end_survivor:'GAME OVER'
  }
};
function t(k){return(I18N[gameLanguage]||I18N.fr)[k]||k;}
function _keyLabel(k){var m={'ArrowUp':'↑','ArrowDown':'↓','ArrowLeft':'←','ArrowRight':'→',' ':'SPC','Shift':'SHIFT','Control':'CTRL','Alt':'ALT','Tab':'TAB','Enter':'ENTER'};return m[k]||(k.length===1?k.toUpperCase():k.slice(0,5));}
function applyLanguage(){
  document.querySelectorAll('[data-i18n]').forEach(function(el){el.textContent=t(el.getAttribute('data-i18n'));});
  document.querySelectorAll('[data-i18n-ph]').forEach(function(el){el.placeholder=t(el.getAttribute('data-i18n-ph'));});
  var fr=document.getElementById('rules-fr'),en=document.getElementById('rules-en');
  if(fr)fr.style.display=gameLanguage==='fr'?'flex':'none';
  if(en)en.style.display=gameLanguage==='en'?'flex':'none';
  ['fr','en'].forEach(function(l){
    var b=document.getElementById('langbtn-'+l);
    if(b){b.style.opacity=gameLanguage===l?'1':'0.38';b.style.borderColor=gameLanguage===l?'rgba(220,170,80,0.85)':'rgba(200,160,50,0.25)';}
  });
  document.documentElement.lang=gameLanguage;
  _updateKeyDisplay();
  setTheme(gameTheme);
  if(typeof _updateRandomCostDisplay==='function'&&typeof G!=='undefined'&&G&&gameRunning)_updateRandomCostDisplay();
}
function _updateKeyDisplay(){
  ['up','down','left','right'].forEach(function(d){
    var b=document.getElementById('keybtn-'+d);if(!b)return;
    var kv=b.querySelector('.kv');if(kv)kv.textContent=_keyLabel(p1Keys[d]);
    b.style.background=(_capturingKey===d)?'rgba(220,170,30,0.22)':'rgba(8,5,2,0.7)';
    b.style.borderColor=(_capturingKey===d)?'rgba(220,170,80,0.9)':'rgba(200,160,50,0.3)';
  });
  var bp=document.getElementById('keybtn-pause');
  if(bp){var kp=bp.querySelector('.kv');if(kp)kp.textContent=_keyLabel(p1PauseKey);
    bp.style.background=(_capturingKey==='pause')?'rgba(220,170,30,0.22)':'rgba(8,5,2,0.7)';
    bp.style.borderColor=(_capturingKey==='pause')?'rgba(220,170,80,0.9)':'rgba(200,160,50,0.3)';}
  var br=document.getElementById('keybtn-restart');
  if(br){var kr=br.querySelector('.kv');if(kr)kr.textContent=_keyLabel(p1RestartKey);
    br.style.background=(_capturingKey==='restart')?'rgba(220,170,30,0.22)':'rgba(8,5,2,0.7)';
    br.style.borderColor=(_capturingKey==='restart')?'rgba(220,170,80,0.9)':'rgba(200,160,50,0.3)';}
  var cm=document.getElementById('key-capture-msg');
  if(cm){cm.style.display=_capturingKey?'block':'none';if(_capturingKey)cm.textContent=t('key_capture');}
}
function captureKey(dir){_capturingKey=dir;_updateKeyDisplay();}
function setLanguage(lang){gameLanguage=lang;try{localStorage.setItem('ruine_lang',lang);}catch(e){}applyLanguage();}
function saveNickname(){
  playerNickname=(document.getElementById('nick-input').value||'').trim().slice(0,16);
  try{localStorage.setItem('ruine_nick',playerNickname);}catch(e){}
  if(typeof G!=='undefined'&&G&&G.p1)G.p1.name=playerNickname;
  var ms=document.getElementById('nick-saved-msg');
  if(ms){ms.style.display='block';setTimeout(function(){ms.style.display='none';},1500);}
}
function openParams(){
  document.getElementById('paramsov').style.display='flex';
  document.getElementById('nick-input').value=playerNickname;
  applyLanguage();
}
function closeParams(){document.getElementById('paramsov').style.display='none';_capturingKey=null;_updateKeyDisplay();}
function setTheme(n){gameTheme=n;
  [0,1,2].forEach(function(i){var b=document.getElementById('themebtn-'+i);
    if(b){b.style.opacity=gameTheme===i?'1':'0.38';b.style.borderColor=gameTheme===i?'rgba(220,170,80,0.85)':'rgba(200,160,50,0.25)';}
  });
  // Teinte les overlays selon le thème
  var _tBg=['rgba(4,2,0,0.97)','rgba(10,1,0,0.97)','rgba(0,3,10,0.97)'];
  var _tPause=['rgba(4,2,0,0.85)','rgba(10,1,0,0.85)','rgba(0,3,10,0.85)'];
  var _tOvBg=['rgba(4,2,0,0.88)','rgba(10,2,0,0.92)','rgba(0,4,12,0.92)'];
  ['rulesov','paramsov'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.background=_tBg[n]||_tBg[0];});
  var pov=document.getElementById('pauseov');if(pov)pov.style.background=_tPause[n]||_tPause[0];
  var ov=document.getElementById('ov');if(ov)ov.style.background=_tOvBg[n]||_tOvBg[0];
  var endov=document.getElementById('endov');if(endov)endov.style.background=_tBg[n]||_tBg[0];
}
