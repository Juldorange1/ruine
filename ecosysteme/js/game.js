// Boucle de jeu, écrans, entrées clavier/souris.

var chosenBiome = 'oasis';
var dragging = false, dragMoved = false, dragStart = null, camStart = null;
var listeningFor = null;

document.addEventListener('DOMContentLoaded', function(){
  initRender();
  buildMenuScreen();
  wireStaticEvents();
  showScreen('menu');
  requestAnimationFrame(animLoop);
});

function animLoop(){
  if (G && !document.getElementById('screen-game').classList.contains('hidden')){
    drawFrame();
  }
  requestAnimationFrame(animLoop);
}

function showScreen(name){
  ['menu','game','gameover'].forEach(function(s){
    document.getElementById('screen-'+s).classList.toggle('hidden', s !== name);
  });
}

function buildMenuScreen(){
  var html = '<div class="biome-grid">';
  BIOME_ORDER.forEach(function(id){
    var b = BIOMES[id];
    var has = metaHasBiome(id);
    var rankOk = biomeRankOk(id);
    var sel = chosenBiome === id ? ' sel' : '';
    var lockBadge = has ? '' : (rankOk ? ' <span class="badge">🔒 '+b.cost+' pts</span>' : ' <span class="badge bad">🔒 Rang '+b.rankReq+' requis</span>');
    var mods = 'Soleil ×' + b.sunMult + ' · Régén. eau ' + b.waterRegen + ' · Menaces ×' + b.threatMult + ' · Points d\'héritage ×' + b.legacyMult;
    html += '<div class="card biome-card' + sel + (has?'':' disabled') + '" data-biome="' + id + '" title="' + mods + '">' +
      '<div class="card-emoji">' + b.emoji + '</div>' +
      '<div class="card-body"><div class="card-title">' + b.name + lockBadge + '</div>' +
      '<div class="card-desc">' + b.desc + '</div></div></div>';
  });
  html += '</div>';
  document.getElementById('biomeList').innerHTML = html;
  var rankLine = document.getElementById('menuRank');
  rankLine.textContent = '♾️ Rang du Gardien : ' + META.wardenRank + ' (bonus permanent +' + Math.round((wardenMult()-1)*100) + '%)';
  var stats = document.getElementById('menuStats');
  stats.textContent = META.totalRuns > 0
    ? ('Parties jouées : ' + META.totalRuns + ' · Record saisons : ' + META.bestSeasons + ' · Meilleure vitalité : ' + META.bestVitality)
    : 'Première génération... bonne chance.';

  var legacyBits = [];
  var domTrophic = dominantTrophicHistory();
  if (domTrophic) legacyBits.push('+8% pour vos ' + trophicHistoryLabel(domTrophic));
  var famBiome = mostPlayedBiomeHistory();
  if (famBiome === chosenBiome) legacyBits.push('terrain de départ plus fertile (biome familier)');
  if (META.totalRuns > 0 && META.totalRuns % 10 === 0) legacyBits.push('un Vestige ancestral apparaîtra sur la carte');
  var legacyLine = document.getElementById('menuLegacy');
  legacyLine.textContent = legacyBits.length ? ('🧬 Mémoire de l\'écosystème pour cette partie : ' + legacyBits.join(' · ')) : '';
}

function wireStaticEvents(){
  document.getElementById('biomeList').addEventListener('click', function(e){
    var card = e.target.closest('[data-biome]');
    if (!card || card.classList.contains('disabled')) return;
    chosenBiome = card.dataset.biome;
    buildMenuScreen();
  });
  document.getElementById('startBtn').addEventListener('click', function(){
    initGame(chosenBiome);
    UI = { tab:'plant', plantMode:'species', selectedSpecies:null, selectedBuilding:null };
    showScreen('game');
    resizeCanvas();
    renderAll();
    requestAnimationFrame(function(){ resizeCanvas(); drawFrame(); });
  });
  document.getElementById('menuCodexBtn').addEventListener('click', function(){ openCodex(); });
  document.getElementById('goCodexBtn').addEventListener('click', function(){ openCodex(); });
  document.getElementById('goRestartBtn').addEventListener('click', function(){
    buildMenuScreen();
    showScreen('menu');
  });
  document.getElementById('codexCloseBtn').addEventListener('click', closeCodex);
  document.getElementById('hudCodexBtn').addEventListener('click', function(){ openCodex(); });
  document.getElementById('rulesBtn').addEventListener('click', openRules);
  document.getElementById('menuRulesBtn').addEventListener('click', openRules);
  document.getElementById('rulesCloseBtn').addEventListener('click', closeRules);
  document.getElementById('keysBtn').addEventListener('click', openKeybinds);
  document.getElementById('menuKeysBtn').addEventListener('click', openKeybinds);
  document.getElementById('keybindsCloseBtn').addEventListener('click', closeKeybinds);
  document.getElementById('keybindsResetBtn').addEventListener('click', function(){
    KEYBINDS = defaultKeybinds(); saveKeybinds(); listeningFor = null; renderKeybinds(null);
  });
  document.getElementById('keybindsContent').addEventListener('click', function(e){
    var b = e.target.closest('[data-rebind]');
    if (!b) return;
    listeningFor = b.dataset.rebind;
    renderKeybinds(listeningFor);
  });

  document.getElementById('tabs').addEventListener('click', function(e){
    var b = e.target.closest('button[data-tab]');
    if (!b) return;
    UI.tab = b.dataset.tab;
    renderSidePanel();
  });

  document.getElementById('nextSeasonBtn').addEventListener('click', function(){
    if (!G || G.over) return;
    resolveSeason();
    renderAll();
  });

  document.getElementById('panelContent').addEventListener('click', handlePanelClick);
  document.getElementById('tileInfo').addEventListener('click', handlePanelClick);

  document.addEventListener('keydown', function(e){
    if (listeningFor){
      e.preventDefault();
      KEYBINDS[listeningFor] = e.code;
      saveKeybinds();
      var done = listeningFor;
      listeningFor = null;
      renderKeybinds(null);
      return;
    }
    if (e.code === 'Escape'){
      closeKeybinds(); closeCodex(); closeRules();
      if (G){ UI.selectedSpecies = null; UI.selectedBuilding = null; G.selected = null; renderAll(); }
      return;
    }
    if (document.getElementById('screen-game').classList.contains('hidden')) return;
    var action = actionForCode(e.code);
    if (!action) return;
    e.preventDefault();
    if (action === 'nextSeason') document.getElementById('nextSeasonBtn').click();
    else if (action === 'tabPlant'){ UI.tab='plant'; renderSidePanel(); }
    else if (action === 'tabEvolve'){ UI.tab='evolve'; renderSidePanel(); }
    else if (action === 'tabMarket'){ UI.tab='market'; renderSidePanel(); }
    else if (action === 'tabDefend'){ UI.tab='defend'; renderSidePanel(); }
    else if (action === 'tabLog'){ UI.tab='log'; renderSidePanel(); }
    else if (action === 'toggleMode'){ UI.plantMode = UI.plantMode==='species'?'building':'species'; renderAll(); }
    else if (action === 'openCodex') openCodex();
    else if (action === 'openRules') openRules();
    else if (action === 'cancel'){
      closeKeybinds(); closeCodex(); closeRules();
      if (G){ UI.selectedSpecies = null; UI.selectedBuilding = null; G.selected = null; renderAll(); }
    }
  });

  var canvas = document.getElementById('board');
  canvas.addEventListener('mousedown', function(e){
    dragging = true; dragMoved = false;
    dragStart = {x:e.clientX, y:e.clientY};
    camStart = {x:cam.x, y:cam.y};
  });
  window.addEventListener('mousemove', function(e){
    if (!dragging) return;
    var dx = e.clientX-dragStart.x, dy = e.clientY-dragStart.y;
    if (Math.abs(dx)+Math.abs(dy) > 5) dragMoved = true;
    if (dragMoved){
      cam.x = camStart.x - dx/cam.zoom;
      cam.y = camStart.y - dy/cam.zoom;
      drawFrame();
    }
  });
  window.addEventListener('mouseup', function(e){
    if (dragging && !dragMoved){
      var rect = canvas.getBoundingClientRect();
      handleCanvasClick(e.clientX-rect.left, e.clientY-rect.top);
    }
    dragging = false;
  });
  canvas.addEventListener('wheel', function(e){
    e.preventDefault();
    var delta = e.deltaY > 0 ? 0.9 : 1.1;
    cam.zoom = Math.max(0.45, Math.min(2.4, cam.zoom*delta));
    drawFrame();
  }, {passive:false});
}

function handleCanvasClick(x,y){
  if (!G || G.over) return;
  var t = tileAtScreen(x,y);
  if (!t) return;
  G.selected = t.key;
  if (!t.unlocked){
    expandFrontier(t);
  } else if (t.fire){
    extinguishFire(t);
  } else if (t.invasion){
    eradicateInvasion(t);
  } else if (!t.species && !t.building && !t.dead){
    if (UI.plantMode === 'species' && UI.selectedSpecies) plantSpecies(t, UI.selectedSpecies);
    else if (UI.plantMode === 'building' && UI.selectedBuilding) buildBuilding(t, UI.selectedBuilding);
  }
  renderAll();
}

function handlePanelClick(e){
  if (!G) return;
  var modeEl = e.target.closest('[data-plantmode]');
  var plantEl = e.target.closest('[data-plant]');
  var buildEl = e.target.closest('[data-build]');
  var chooseMutEl = e.target.closest('[data-choosemutation]');
  var expedEl = e.target.closest('[data-expedition]');
  var investEl = e.target.closest('[data-investfund]');
  var withdrawEl = e.target.closest('[data-withdrawfund]');
  var actionEl = e.target.closest('[data-action]');
  if (modeEl){
    UI.plantMode = modeEl.dataset.plantmode;
    renderAll();
    return;
  }
  if (plantEl){
    var id = plantEl.dataset.plant;
    UI.selectedSpecies = (UI.selectedSpecies === id) ? null : id;
    renderAll();
    return;
  }
  if (buildEl){
    var bid = buildEl.dataset.build;
    UI.selectedBuilding = (UI.selectedBuilding === bid) ? null : bid;
    renderAll();
    return;
  }
  if (chooseMutEl){
    var parts2 = chooseMutEl.dataset.choosemutation.split(':');
    chooseMutation(parts2[0], parseInt(parts2[1],10));
    renderAll();
    return;
  }
  if (expedEl){
    runExpedition();
    renderAll();
    return;
  }
  if (investEl){
    investFund(parseInt(investEl.dataset.investfund,10));
    renderAll();
    return;
  }
  if (withdrawEl){
    withdrawFund(parseInt(withdrawEl.dataset.withdrawfund,10));
    renderAll();
    return;
  }
  if (actionEl){
    var act = actionEl.dataset.action;
    if (act === 'irrigate') irrigate();
    renderAll();
    return;
  }
}

function openRules(){
  document.getElementById('rulesContent').innerHTML = rulesHTML();
  document.getElementById('screen-rules').classList.remove('hidden');
}
function closeRules(){
  document.getElementById('screen-rules').classList.add('hidden');
}

function openKeybinds(){
  listeningFor = null;
  renderKeybinds(null);
  document.getElementById('screen-keybinds').classList.remove('hidden');
}
function closeKeybinds(){
  listeningFor = null;
  document.getElementById('screen-keybinds').classList.add('hidden');
}

function openCodex(){
  renderCodex();
  document.getElementById('screen-codex').classList.remove('hidden');
}
function closeCodex(){
  document.getElementById('screen-codex').classList.add('hidden');
}
function wireCodexEvents(){
  var c = document.getElementById('codexContent');
  c.onclick = function(e){
    var w = e.target.closest('[data-buywarden]');
    if (w){
      if (buyWardenRank()){ renderCodex(); buildMenuScreen(); }
      return;
    }
    var pk = e.target.closest('[data-buyperk]');
    if (pk){
      if (buyPerk(pk.dataset.buyperk)){ renderCodex(); }
      return;
    }
    var eq = e.target.closest('[data-toggleequip]');
    if (eq){
      var eqParts = eq.dataset.toggleequip.split(':');
      toggleEquip(eqParts[0], eqParts[1]);
      renderCodex();
      return;
    }
    var b = e.target.closest('[data-buy]');
    if (!b) return;
    var parts = b.dataset.buy.split(':');
    if (metaBuy(parts[0], parts[1])){
      renderCodex();
      buildMenuScreen();
    }
  };
}
function wirePanelEvents(){}

function showGameOver(){
  if (G.overHandled){ showScreen('gameover'); return; }
  G.overHandled = true;
  var stats = {
    seasons: G.turn, peakBiodiversity: G.peak.biodiversity, peakVitality: G.peak.vitality,
    prestigeFund: G.prestigeFund, biomeLegacyMult: BIOMES[G.biome].legacyMult || 1
  };
  var lp = applyRunResult(stats);
  document.getElementById('goReason').textContent = G.gameOverReason || 'Votre écosystème s\'est éteint.';
  document.getElementById('goStats').innerHTML =
    '<div class="go-stat"><b>' + stats.seasons + '</b><span>saisons survécues</span></div>' +
    '<div class="go-stat"><b>' + stats.peakBiodiversity + '</b><span>biodiversité max</span></div>' +
    '<div class="go-stat"><b>' + stats.peakVitality + '</b><span>vitalité max</span></div>' +
    '<div class="go-stat"><b>' + Math.round(stats.prestigeFund) + '</b><span>fonds de prestige</span></div>';
  document.getElementById('goLegacy').textContent = '💎 +' + lp + ' points d\'héritage (dépensez-les dans le Codex) · Rang du Gardien ' + META.wardenRank;
  showScreen('gameover');
}
