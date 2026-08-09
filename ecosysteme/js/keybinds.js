// Raccourcis clavier configurables, persistés en localStorage.

var KEYBINDS_KEY = 'sylva_keybinds_v1';

var KEYBIND_ACTIONS = [
  { id:'nextSeason', label:'Saison suivante', code:'Space' },
  { id:'cancel', label:'Annuler / Fermer', code:'Escape' },
  { id:'tabPlant', label:'Onglet Planter', code:'Digit1' },
  { id:'tabEvolve', label:'Onglet Évolution', code:'Digit2' },
  { id:'tabMarket', label:'Onglet Bourse', code:'Digit3' },
  { id:'tabDefend', label:'Onglet Défense', code:'Digit4' },
  { id:'tabLog', label:'Onglet Journal', code:'Digit5' },
  { id:'toggleMode', label:'Espèces / Bâtiments', code:'KeyB' },
  { id:'openCodex', label:'Ouvrir le Codex', code:'KeyC' },
  { id:'openRules', label:'Ouvrir les Règles', code:'KeyH' }
];

function defaultKeybinds(){
  var m = {};
  KEYBIND_ACTIONS.forEach(function(a){ m[a.id] = a.code; });
  return m;
}

var KEYBINDS = loadKeybinds();

function loadKeybinds(){
  try{
    var raw = localStorage.getItem(KEYBINDS_KEY);
    if (!raw) return defaultKeybinds();
    var parsed = JSON.parse(raw);
    var def = defaultKeybinds();
    for (var k in def) if (!(k in parsed)) parsed[k] = def[k];
    return parsed;
  } catch(e){ return defaultKeybinds(); }
}

function saveKeybinds(){
  try{ localStorage.setItem(KEYBINDS_KEY, JSON.stringify(KEYBINDS)); } catch(e){}
}

function actionForCode(code){
  for (var id in KEYBINDS){ if (KEYBINDS[id] === code) return id; }
  return null;
}

function keyLabel(code){
  if (!code) return '?';
  if (code === 'Space') return 'Espace';
  if (code.indexOf('Digit') === 0) return code.slice(5);
  if (code.indexOf('Key') === 0) return code.slice(3);
  return code;
}
