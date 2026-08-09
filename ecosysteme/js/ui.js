// Mise à jour des panneaux HTML (HUD, palette, mutations, interventions, journal, codex).

var UI = { tab:'plant', plantMode:'species', selectedSpecies:null, selectedBuilding:null };

function trophicLabel(t){
  return {producer:'Producteur', herbivore:'Herbivore', predator:'Prédateur', decomposer:'Décomposeur'}[t];
}
function trophicIcon(t){
  return {producer:'🟢', herbivore:'🟡', predator:'🔴', decomposer:'🟤'}[t];
}

function terrainCharacterText(terrainId){
  var terr = TERRAINS[terrainId];
  var sunTxt = terr.sun >= 1.1 ? '☀️ très lumineux' : (terr.sun >= 1.0 ? '☀️ lumineux' : '🌥️ ombragé');
  var waterTxt = terr.water >= 1.3 ? '💧 gorgé d\'eau' : (terr.water >= 0.9 ? '💧 humidité normale' : '🏜️ sec');
  var fireTxt = terr.flammable >= 0.5 ? '🔥 très inflammable' : (terr.flammable >= 0.2 ? '🔥 inflammable' : '🔥 quasi ininflammable');
  return sunTxt + ' · ' + waterTxt + ' · ' + fireTxt;
}

function speciesFullTooltip(id){
  var sp = SPECIES[id];
  var lines = [];
  if (sp.trophic === 'producer'){
    var affParts = [];
    for (var tid in TERRAINS){
      var mult = (sp.affinity[tid]||1) * TERRAINS[tid].sun;
      var pct = Math.round((mult-1)*100);
      affParts.push(TERRAINS[tid].name + ' ' + (pct>=0?'+':'') + pct + '%');
    }
    lines.push('Rendement par terrain — ' + affParts.join(', '));
  }
  if (sp.synergy){
    var syn = Object.keys(sp.synergy).map(function(k){ return SPECIES[k].name + ' (+' + Math.round(sp.synergy[k]*100) + '%)'; });
    if (syn.length) lines.push('Plus efficace adjacente à : ' + syn.join(', '));
  }
  if (sp.rivalry){
    var riv = Object.keys(sp.rivalry).map(function(k){ return SPECIES[k].name + ' (-' + Math.round(sp.rivalry[k]*100) + '%)'; });
    if (riv.length) lines.push('Moins efficace adjacente à : ' + riv.join(', '));
  }
  if (!lines.length) lines.push('Aucune synergie ou rivalité de voisinage connue.');
  return lines.join('\n');
}

function terrainAffinityLabel(speciesId, terrainId){
  var sp = SPECIES[speciesId];
  var terr = TERRAINS[terrainId];
  var mult = (sp.affinity[terrainId]||1) * terr.sun;
  var pct = Math.round((mult-1)*100);
  var sign = pct >= 0 ? '+' : '';
  var cls = pct >= 8 ? 'good-text' : (pct <= -8 ? 'bad-text' : '');
  return '<span class="' + cls + '">rendement ' + sign + pct + '%</span>';
}

function fmt(n){ return Math.round(n); }

function renderHUD(){
  el('hud-energy').textContent = fmt(G.resources.energy);
  el('hud-water').textContent = fmt(G.resources.water);
  el('hud-biomass').textContent = fmt(G.resources.biomass);
  el('hud-gp').textContent = fmt(G.resources.gp);
  el('hud-gold').textContent = fmt(G.resources.gold);
  var pr = el('hud-pressure');
  pr.textContent = fmt(G.pressure);
  pr.className = G.pressure > 55 ? 'bad' : (G.pressure > 28 ? 'warn' : 'good');
  el('hud-balance-num').textContent = G.balance + '%';
  el('hud-balance-fill').style.width = G.balance + '%';
  el('hud-balance-fill').style.background = G.balance > 55 ? 'var(--good)' : (G.balance > 25 ? 'var(--warn)' : 'var(--bad)');
  var seasonIdx = G.turn % 4, year = Math.floor(G.turn/4) + 1;
  el('hud-season').textContent = SEASON_EMOJI[seasonIdx] + ' ' + SEASON_NAMES[seasonIdx] + ' — An ' + year;
  el('hud-vitality').textContent = fmt(G.lastVitality || 0);
  el('hud-biodiversity').textContent = (G.lastBiodiversity || 0) + ' espèces';
  el('hud-water-bar').style.width = Math.max(0, Math.min(100, G.resources.water)) + '%';
  document.getElementById('boardWrap').classList.toggle('drought', !!G.droughtActive);
  el('nextSeasonBtn').textContent = 'Saison suivante ▶ (' + keyLabel(KEYBINDS.nextSeason) + ')';
}

function el(id){ return document.getElementById(id); }

function renderTabs(){
  document.querySelectorAll('#tabs button').forEach(function(b){
    b.classList.toggle('active', b.dataset.tab === UI.tab);
  });
}

function renderSidePanel(){
  renderTabs();
  var c = el('panelContent');
  if (UI.tab === 'plant') c.innerHTML = plantPanelHTML();
  else if (UI.tab === 'evolve') c.innerHTML = mutationPanelHTML();
  else if (UI.tab === 'market') c.innerHTML = marketHTML();
  else if (UI.tab === 'defend') c.innerHTML = interventionsHTML();
  else if (UI.tab === 'log') c.innerHTML = logHTML();
  wirePanelEvents();
}

function plantPanelHTML(){
  var toggle = '<div class="subtoggle">' +
    '<button class="' + (UI.plantMode==='species'?'active':'') + '" data-plantmode="species">🌱 Espèces</button>' +
    '<button class="' + (UI.plantMode==='building'?'active':'') + '" data-plantmode="building">🏗️ Bâtiments</button>' +
    '</div>';
  return toggle + (UI.plantMode === 'species' ? speciesPaletteHTML() : buildingPaletteHTML());
}

function costBadge(cost){
  return '⚡' + cost.energy + (cost.biomass ? ' 🌾'+cost.biomass : '') + (cost.gold ? ' 💰'+cost.gold : '');
}

function speciesPaletteHTML(){
  var rows = G.roster.species.map(function(id){
    var sp = SPECIES[id];
    var affordable = G.resources.energy >= sp.cost.energy && G.resources.biomass >= sp.cost.biomass;
    var sel = UI.selectedSpecies === id ? ' sel' : '';
    return '<div class="card' + sel + (affordable?'':' disabled') + '" data-plant="' + id + '" title="' + speciesFullTooltip(id) + '">' +
      '<div class="card-emoji">' + sp.emoji + '</div>' +
      '<div class="card-body"><div class="card-title">' + sp.name + ' <span class="badge">' + trophicIcon(sp.trophic) + '</span> <span class="badge">' + costBadge(sp.cost) + '</span></div>' +
      '<div class="card-desc">' + sp.desc + '</div></div>' +
      '</div>';
  }).join('');
  var rest = SPECIES_ORDER.length - G.roster.species.length;
  var restHtml = rest ? '<div class="hint">' + rest + ' autre(s) espèce(s) — changez d\'équipe dans le Codex avant la prochaine partie.</div>' : '';
  return rows + restHtml;
}

function buildingPaletteHTML(){
  var rows = G.roster.buildings.map(function(id){
    var b = BUILDINGS[id];
    var cost = buildingCost(id);
    var affordable = G.resources.energy >= cost.energy && G.resources.biomass >= cost.biomass && G.resources.gold >= cost.gold;
    var sel = UI.selectedBuilding === id ? ' sel' : '';
    var count = 0;
    for (var k in G.tiles) if (G.tiles[k].building === id) count++;
    var scaleNote = count ? ('Vous en avez ' + count + ' — le prochain coûte ' + Math.round((buildingBaseCostMult(id)-1)*100) + '% plus cher que le premier.') : 'Coût de base (chaque exemplaire supplémentaire coûte 35% de plus).';
    return '<div class="card' + sel + (affordable?'':' disabled') + '" data-build="' + id + '" title="' + scaleNote + (b.upkeep.gold?(' Entretien : '+b.upkeep.gold+' or/saison, sinon le bâtiment s\'endort.'):' Aucun entretien nécessaire.') + '">' +
      '<div class="card-emoji">' + b.emoji + '</div>' +
      '<div class="card-body"><div class="card-title">' + b.name + (count?' <span class="badge">×'+count+'</span>':'') + ' <span class="badge">' + costBadge(cost) + (b.upkeep.gold?' /💰'+b.upkeep.gold:'') + '</span></div>' +
      '<div class="card-desc">' + b.desc + '</div></div>' +
      '</div>';
  }).join('');
  var rest = BUILDING_ORDER.length - G.roster.buildings.length;
  var restHtml = rest ? '<div class="hint">' + rest + ' autre(s) bâtiment(s) — changez d\'équipe dans le Codex avant la prochaine partie.</div>' : '';
  return rows + restHtml;
}

function mutationPanelHTML(){
  var known = G.roster.species.filter(function(id){ return G.speciesEverPlanted[id] || mutLevel(id)>0; });
  if (!known.length) return '<div class="panel-title">Évolution</div><div class="hint">Plantez une espèce pour débloquer ses évolutions.</div>';
  var rows = known.map(function(id){
    var sp = SPECIES[id];
    var lvl = mutLevel(id);
    var stars = '★'.repeat(lvl) + '☆'.repeat(MUTATION_SLOTS-lvl);
    var body = '<div class="card-title">' + sp.emoji + ' ' + sp.name + ' <span class="badge">' + stars + '</span></div>';
    var offer = currentMutationOffer(id);
    if (offer){
      offer.forEach(function(poolIdx){
        var entry = sp.mutationPool[poolIdx];
        var cost = mutationCostFor(entry);
        var afford = G.resources.gp >= cost;
        body += '<div class="mutation-option" title="Une fois choisie, cette évolution est permanente pour toute la partie. L\'option non retenue est perdue pour de bon."><b>' + entry.name + '</b> — ' + entry.desc +
          '<button class="mini-btn' + (afford?'':' disabled') + '" data-choosemutation="' + id + ':' + poolIdx + '">Choisir · 🧬' + cost + '</button></div>';
      });
      body += '<div class="hint">L\'option non choisie sera perdue pour cette partie.</div>';
    } else {
      body += '<div class="card-desc">Maximum atteint.</div>';
    }
    return '<div class="card static">' + body + '</div>';
  }).join('');
  return '<div class="panel-title">Évolution <span class="badge">🧬 ' + fmt(G.resources.gp) + '</span></div>' + rows;
}

function marketHTML(){
  var html = '<div class="panel-title">Bourse <span class="badge">💰 ' + fmt(G.resources.gold) + '</span></div>';
  html += '<div class="hint">L\'or vient du Marché et des expéditions.</div>';
  html += '<div class="codex-section-title" style="margin-top:2px">Expédition</div>';
  var exp = EXPEDITIONS.unique;
  var expCost = expeditionCost(), expChance = expeditionChance();
  var canExp = G.resources.gold >= expCost;
  html += '<div class="card static" title="En cas d\'échec, la pression écologique augmente légèrement en plus de perdre la mise."><div class="card-emoji">' + exp.emoji + '</div><div class="card-body">' +
    '<div class="card-title">' + exp.name + ' <span class="badge">' + Math.round(expChance*100) + '% succès</span></div>' +
    '<div class="card-desc">' + exp.desc + '</div>' +
    '<button class="mini-btn' + (canExp?'':' disabled') + '" data-expedition="unique">Tenter · 💰' + expCost + '</button>' +
    '</div></div>';

  html += '<div class="codex-section-title">🏦 Fonds <span class="badge">' + Math.round(G.prestigeFund) + ' (+4%/saison, → ' + Math.floor(G.prestigeFund*0.5) + ' pts)</span></div>';
  [20,50,100].forEach(function(amt){
    var can = G.resources.gold >= amt;
    html += '<button class="mini-btn sell-btn' + (can?'':' disabled') + '" data-investfund="' + amt + '" title="L\'or investi grossit de 4%/saison et devient des points d\'héritage à l\'effondrement.">Investir 💰' + amt + '</button>';
  });
  if (G.prestigeFund >= 20){
    html += '<button class="mini-btn sell-btn risky" data-withdrawfund="' + Math.floor(G.prestigeFund) + '" title="Récupère l\'or investi immédiatement, avec 20% de pénalité.">Retirer (−20%)</button>';
  }
  return html;
}

function interventionsHTML(){
  var html = '<div class="panel-title">Défense <span class="badge ' + (G.pressure>55?'bad':(G.pressure>28?'warn':'good')) + '">🔥 ' + fmt(G.pressure) + '</span></div>';
  html += '<div class="hint">Cliquez directement une case en feu 🔥, envahie 🦗 ou 🔒 pour agir. Tours/remparts réduisent la pression.</div>';
  html += '<button class="mini-btn' + (G.resources.biomass>=interventionCost('irrigate')?'':' disabled') + '" data-action="irrigate" title="Ajoute immédiatement de l\'eau, utile en sécheresse.">💧 Irriguer (+22 eau · 🌾' + interventionCost('irrigate') + ')</button>';

  var threats = [];
  var dormant = 0;
  for (var key in G.tiles){
    var tt = G.tiles[key];
    if (tt.fire) threats.push('🔥 Incendie');
    if (tt.invasion) threats.push('🦗 Invasion');
    if (tt.building && tt.buildingDormant) dormant++;
  }
  if (G.droughtActive) threats.push('🏜️ Sécheresse');
  if (dormant) threats.push('💤 ' + dormant + ' bâtiment(s) en sommeil');
  html += '<div class="panel-title" style="margin-top:14px">Menaces</div>';
  html += threats.length ? threats.map(function(x){ return '<div class="threat-row">' + x + '</div>'; }).join('') : '<div class="hint">Aucune.</div>';
  return html;
}

function logHTML(){
  var rows = G.log.map(function(l){ return '<div class="log-row"><span class="log-turn">S' + l.turn + '</span>' + l.text + '</div>'; }).join('');
  return '<div class="panel-title">Journal</div>' + (rows || '<div class="hint">Rien à signaler.</div>');
}

function renderTileInfo(){
  var box = el('tileInfo');
  if (!G.selected){ box.innerHTML = '<div class="hint">Cliquez une case pour l\'inspecter ou agir.</div>'; return; }
  var t = G.tiles[G.selected];
  if (!t){ box.innerHTML = ''; return; }
  var html = '';
  if (!t.unlocked){
    html = '<div class="card-title">🔒 Inexploré <span class="badge">⚡' + expandCost(t) + '</span></div><div class="card-desc">Clic pour défricher.</div>';
  } else if (t.dead){
    html = '<div class="card-title">🥀 Friche</div><div class="card-desc">Régénère avec le temps ou un décomposeur voisin.</div>';
  } else if (t.invasion){
    html = '<div class="card-title">🦗 Invasion <span class="badge">🌾' + interventionCost('eradicate') + '</span></div><div class="card-desc">Clic pour éradiquer.</div>';
  } else if (t.fire){
    html = '<div class="card-title">🔥 Incendie <span class="badge">🌾' + interventionCost('extinguish') + '</span></div><div class="card-desc">Clic pour éteindre.</div>';
  } else if (t.building){
    var b = BUILDINGS[t.building];
    html = '<div class="card-title">' + b.emoji + ' ' + b.name + (t.buildingDormant?' <span class="badge bad">💤</span>':' <span class="badge good">actif</span>') + '</div><div class="card-desc">' + b.desc + '</div>';
  } else if (t.species){
    var sp = SPECIES[t.species];
    var synMult = neighborSynergyMult(t, t.species);
    var synBadge = synMult > 1.03 ? '<span class="badge good">voisinage +' + Math.round((synMult-1)*100) + '%</span>' : (synMult < 0.97 ? '<span class="badge bad">voisinage ' + Math.round((synMult-1)*100) + '%</span>' : '');
    var terrBadge = sp.trophic === 'producer' ? '<span class="badge">' + terrainAffinityLabel(t.species, t.terrain) + '</span>' : '';
    html = '<div class="card-title">' + sp.emoji + ' ' + sp.name + ' <span class="badge">faim ' + fmt(t.hunger) + '/' + HUNGER_DEATH + '</span> ' + synBadge + ' ' + terrBadge + '</div><div class="card-desc">' + sp.desc + '</div><div class="card-desc">' + TERRAINS[t.terrain].name + ' · ' + terrainCharacterText(t.terrain) + '</div>';
  } else {
    var terrainLine = TERRAINS[t.terrain].name + ' <span class="badge">fertilité ' + fmt(t.fertility) + '</span>';
    var affinityLine = '';
    if (UI.plantMode === 'species' && UI.selectedSpecies && SPECIES[UI.selectedSpecies].trophic === 'producer'){
      affinityLine = '<div class="card-desc">Avec ' + SPECIES[UI.selectedSpecies].emoji + ' ' + SPECIES[UI.selectedSpecies].name + ' ici : <b>' + terrainAffinityLabel(UI.selectedSpecies, t.terrain) + '</b></div>';
    }
    html = '<div class="card-title">' + terrainLine + '</div><div class="card-desc">' + terrainCharacterText(t.terrain) + '</div>' + affinityLine + '<div class="hint">Case libre — sélectionnez une espèce ou un bâtiment puis cliquez ici.</div>';
  }
  box.innerHTML = html;
}

function renderAll(){
  renderHUD();
  renderSidePanel();
  renderTileInfo();
  drawFrame();
  if (G.over) showGameOver();
}

// ---- Codex (méta-progression) ----
function codexHTML(){
  var allRelicCount = 0;
  PLANETS.forEach(function(pl){ for (var k in pl.relics) allRelicCount++; });
  var totalUnlocks = SPECIES_ORDER.length + BIOME_ORDER.length + BUILDING_ORDER.length + allRelicCount;
  var ownedUnlocks = META.unlockedSpecies.length + META.unlockedBiomes.length + META.unlockedBuildings.length + META.relics.length;
  var html = '<div class="codex-points">💎 ' + META.legacyPoints + ' points d\'héritage · ' + ownedUnlocks + '/' + totalUnlocks + ' débloqués</div>';
  if (META.legacyPoints === 0 && META.totalRuns === 0){
    html += '<div class="hint" style="text-align:center">💎 Les points d\'héritage sont différents des 🧬 points génétiques utilisés en partie. Vous en gagnez uniquement <b>à la fin d\'une partie</b> (quand votre écosystème s\'effondre) — jouez une partie jusqu\'au bout pour en obtenir et pouvoir monter de rang ici.</div>';
  }

  html += planetHeaderHTML();

  html += '<div class="codex-section-title">♾️ Rang du Gardien — jamais de plafond</div><div class="codex-grid">' + wardenRankCardHTML() + '</div>';

  html += '<div class="codex-section-title">Espèces <span class="badge">' + META.activeSpecies.length + '/' + ROSTER_CAP.species + ' équipées</span></div>' +
    '<div class="hint">Vous ne pouvez emmener que ' + ROSTER_CAP.species + ' espèces par partie, même en en possédant plus.</div><div class="codex-grid">';
  SPECIES_ORDER.forEach(function(id){
    var sp = SPECIES[id];
    var has = metaHasSpecies(id);
    var cost = metaUnlockCost('species', id);
    html += codexCard(sp.emoji, sp.name, trophicLabel(sp.trophic), has, cost, 'species', id, 'species');
  });
  html += '</div><div class="codex-section-title">Mondes</div><div class="codex-grid">';
  BIOME_ORDER.forEach(function(id){
    var b = BIOMES[id];
    var has = metaHasBiome(id);
    html += codexCardGated(b.emoji, b.name, b.desc, has, b.cost, 'biome', id, '🔒 Rang du Gardien ' + b.rankReq + ' requis', biomeRankOk(id));
  });
  html += '</div><div class="codex-section-title">Bâtiments <span class="badge">' + META.activeBuildings.length + '/' + ROSTER_CAP.building + ' équipés</span></div><div class="codex-grid">';
  BUILDING_ORDER.forEach(function(id){
    var b = BUILDINGS[id];
    var has = metaHasBuilding(id);
    var cost = metaUnlockCost('building', id);
    html += codexCard(b.emoji, b.name, b.desc, has, cost, 'building', id, 'building');
  });
  html += '</div>';

  var planet = currentPlanet();
  html += '<div class="codex-section-title">' + planet.emoji + ' Aptitudes de ' + planet.name + ' — niveaux infinis</div><div class="codex-grid">';
  for (var pid in planet.perks) html += perkCardHTML(pid);
  html += '</div><div class="codex-section-title">🏺 Reliques de ' + planet.name + ' <span class="badge">' + META.activeRelics.length + '/' + ROSTER_CAP.relic + ' équipées</span></div><div class="codex-grid">';
  for (var rid in planet.relics){
    var r = planet.relics[rid];
    var has = ownsRelic(rid);
    var lockMsg = '🔒 encore ' + Math.max(0,(r.rankReqRelative||0) - rankIntoTier()) + ' rang(s) sur ' + planet.name;
    html += codexCardGated(r.emoji, r.name, r.desc, has, r.cost, 'relic', rid, lockMsg, relicRankOk(rid), 'relic');
  }
  html += '</div>';

  html += otherPlanetsHTML();
  return html;
}

function planetHeaderHTML(){
  var planet = currentPlanet();
  var rankInto = rankIntoTier();
  var untilNextPlanet = PLANET_TIER_SIZE - rankInto;
  var nextPlanet = PLANETS[(currentTierIndex()+1) % PLANETS.length];
  return '<div class="planet-header">' +
    '<div class="planet-emoji">' + planet.emoji + '</div>' +
    '<div class="planet-info">' +
      '<div class="planet-title">Planète actuelle : ' + planet.name + ' <span class="badge">Rang ' + META.wardenRank + '</span></div>' +
      '<div class="card-desc">' + planet.desc + '</div>' +
      '<div class="card-desc">Encore <b>' + untilNextPlanet + '</b> rang(s) avant d\'arriver sur ' + nextPlanet.emoji + ' ' + nextPlanet.name + ', qui remplacera les Aptitudes et Reliques ci-dessous. Achetez des rangs juste en dessous 👇</div>' +
    '</div></div>';
}

function wardenRankCardHTML(){
  var nextCost = wardenCost(META.wardenRank);
  var can = META.legacyPoints >= nextCost;
  return '<div class="card static warden-card" title="Dépense des points d\'héritage (💎) pour augmenter définitivement le Rang du Gardien — jamais de plafond, le coût augmente à chaque achat.">' +
    '<div class="card-emoji">♾️</div>' +
    '<div class="card-body"><div class="card-title">Rang actuel : ' + META.wardenRank + ' <span class="badge good">+' + Math.round((wardenMult()-1)*100) + '% économie</span></div>' +
    '<div class="card-desc">Boost permanent à toute votre économie et réduit la pression écologique (jusqu\'à -40%). Achat répétable, sans fin.</div>' +
    '<button class="mini-btn' + (can?'':' disabled') + '" data-buywarden="1">Monter au rang ' + (META.wardenRank+1) + ' · 💎' + nextCost + '</button>' +
    '</div></div>';
}

function otherPlanetsHTML(){
  var others = PLANETS.filter(function(pl){ return pl.id !== currentPlanet().id; });
  if (!others.length) return '';
  var html = '<div class="codex-section-title">Autres planètes (figées jusqu\'à votre retour)</div>';
  others.forEach(function(pl){
    var ownedRelics = 0, totalRelics = 0;
    for (var rid in pl.relics){ totalRelics++; if (ownsRelic(rid)) ownedRelics++; }
    var maxLevel = 0;
    for (var pid in pl.perks){ maxLevel = Math.max(maxLevel, perkLevel(pid)); }
    html += '<div class="card static other-planet">' +
      '<div class="card-emoji">' + pl.emoji + '</div><div class="card-body">' +
      '<div class="card-title">' + pl.name + '</div>' +
      '<div class="card-desc">' + ownedRelics + '/' + totalRelics + ' reliques débloquées · niveau max d\'aptitude atteint : ' + maxLevel + '</div>' +
      '</div></div>';
  });
  return html;
}

function equipButtonHTML(kind, id){
  var eq = isEquipped(kind, id);
  var atCap = rosterLists(kind).active.length >= ROSTER_CAP[kind];
  var disabled = !eq && atCap;
  return '<button class="mini-btn' + (eq?' risky':'') + (disabled?' disabled':'') + '" data-toggleequip="' + kind + ':' + id + '" title="' + (eq?'Retire cette entrée de votre équipe pour la prochaine partie.':'Ajoute cette entrée à votre équipe pour la prochaine partie (dans la limite de la place disponible).') + '">' + (eq?'Retirer de l\'équipe':'Équiper') + '</button>';
}

function perkCardHTML(id){
  var p = perkDef(id);
  var lvl = perkLevel(id);
  var cost = perkCost(id);
  var can = META.legacyPoints >= cost;
  var current = p.mult ? Math.round((1-perkValue(id))*100)+'%' : Math.round(perkValue(id));
  var next = p.mult ? Math.round((1-Math.pow(p.mult, lvl+1))*100)+'%' : Math.round((lvl+1)*p.perLevel);
  var tip = 'Coût ×1.16 à chaque niveau (actuellement 💎' + cost + '). Cumulable avec vos autres aptitudes du même effet, même sur d\'autres planètes.';
  return '<div class="card static" title="' + tip + '">' +
    '<div class="card-emoji">💎</div><div class="card-body">' +
    '<div class="card-title">' + p.name + ' <span class="badge">Nv.' + lvl + '</span></div>' +
    '<div class="card-desc">' + current + ' → ' + next + ' ' + p.unit + '</div>' +
    '<button class="mini-btn' + (can?'':' disabled') + '" data-buyperk="' + id + '">Améliorer · 💎' + cost + '</button>' +
    '</div></div>';
}

function codexCard(emoji, name, desc, owned, cost, kind, id, rosterKind){
  var can = !owned && META.legacyPoints >= cost;
  var tip = owned ? 'Débloqué définitivement — cet achat n\'est jamais perdu, même si vous ne l\'équipez pas.' : 'Achat unique et permanent. Reste ensuite soumis au plafond d\'équipe (' + ROSTER_CAP[rosterKind] + ' max).';
  return '<div class="card static ' + (owned?'owned':'') + '" title="' + tip + '">' +
    '<div class="card-emoji">' + emoji + '</div>' +
    '<div class="card-body"><div class="card-title">' + name + '</div><div class="card-desc">' + desc + '</div>' +
    (owned ? equipButtonHTML(rosterKind, id) : '<button class="mini-btn' + (can?'':' disabled') + '" data-buy="' + kind + ':' + id + '">Débloquer · 💎' + cost + '</button>') +
    '</div></div>';
}

function codexCardGated(emoji, name, desc, owned, cost, kind, id, lockMsg, rankOk, rosterKind){
  var can = !owned && rankOk && META.legacyPoints >= cost;
  var lockLine = (!owned && !rankOk) ? '<div class="badge bad">' + lockMsg + '</div>' : '';
  var tip = owned ? 'Débloqué définitivement — cet achat n\'est jamais perdu.' : (rankOk ? 'Disponible tant que vous êtes sur cette planète.' : 'Redeviendra disponible au prochain passage sur cette planète (le cycle recommence tous les ' + PLANETS.length*PLANET_TIER_SIZE + ' rangs).');
  return '<div class="card static ' + (owned?'owned':'') + '" title="' + tip + '">' +
    '<div class="card-emoji">' + emoji + '</div>' +
    '<div class="card-body"><div class="card-title">' + name + '</div><div class="card-desc">' + desc + '</div>' + lockLine +
    (owned ? (rosterKind ? equipButtonHTML(rosterKind, id) : '<div class="badge good">Débloqué</div>') : (rankOk ? '<button class="mini-btn' + (can?'':' disabled') + '" data-buy="' + kind + ':' + id + '">Débloquer · 💎' + cost + '</button>' : '')) +
    '</div></div>';
}

function renderCodex(){
  el('codexContent').innerHTML = codexHTML();
  wireCodexEvents();
}

// ---- Raccourcis clavier ----
function keybindsHTML(listeningId){
  var rows = KEYBIND_ACTIONS.map(function(a){
    var listening = listeningId === a.id;
    return '<div class="card static keybind-row"><div class="card-body">' +
      '<div class="card-title">' + a.label + '</div></div>' +
      '<span class="key-badge">' + (listening ? '...' : keyLabel(KEYBINDS[a.id])) + '</span>' +
      '<button class="mini-btn' + (listening?' risky':'') + '" data-rebind="' + a.id + '">' + (listening?'Appuyez...':'Changer') + '</button>' +
      '</div>';
  }).join('');
  return rows;
}

function renderKeybinds(listeningId){
  el('keybindsContent').innerHTML = keybindsHTML(listeningId);
}

// ---- Règles (aide, condensée) ----
function rulesHTML(){
  return '' +
  '<div class="rules-block"><h3>🔗 Chaîne trophique</h3>' +
  '<p>🟢 Producteurs nourrissent 🟡 herbivores, qui nourrissent 🔴 prédateurs. 🟤 Décomposeurs régénèrent le sol et les friches. Faim à 10 = mort → friche 🥀.</p>' +
  '<p>Il n\'y a pas de ratio parfait à mémoriser : observez la jauge ⚖️ Équilibre et ajustez.</p></div>' +
  '<div class="rules-block"><h3>🌐 Voisinage</h3>' +
  '<p>Certaines espèces se renforcent quand elles sont adjacentes, d\'autres se gênent (compétition, territoire). Ces liens ne sont pas listés ici — observez et expérimentez.</p></div>' +
  '<div class="rules-block"><h3>🧬 Évolution</h3>' +
  '<p>Chaque espèce a 3 paliers d\'évolution. À chaque palier, 2 options sont tirées au sort — vous n\'en gardez qu\'une, l\'autre est perdue pour la partie.</p></div>' +
  '<div class="rules-block"><h3>💰 Ressources</h3>' +
  '<p>⚡🌾 financent plantations/bâtiments. 💧 doit rester positive. 🧬 finance l\'évolution. 💰 finance bâtiments et expéditions.</p></div>' +
  '<div class="rules-block"><h3>🔥 Pression</h3>' +
  '<p>Augmente avec l\'âge et la taille de l\'écosystème → plus de menaces. Tours/remparts la réduisent.</p></div>' +
  '<div class="rules-block"><h3>🖱️ Contrôles</h3>' +
  '<p>Clic direct sur une case : défriche 🔒, éteint 🔥, éradique 🦗, ou plante/construit si sélectionné. Raccourcis configurables (⌨️ dans le HUD).</p></div>' +
  '<div class="rules-block"><h3>🎲 Risque</h3>' +
  '<p>Expéditions (Bourse) : gain ou incident possible (probabilité affichée).</p></div>' +
  '<div class="rules-block"><h3>♻️ Effondrement & Codex</h3>' +
  '<p>Chaque partie finit par s\'effondrer → 💎 points d\'héritage (différents des 🧬 points génétiques utilisés en partie), dépensables pour toujours dans le Codex : espèces, bâtiments, mondes, aptitudes, reliques.</p></div>' +
  '<div class="rules-block"><h3>🏦 Fonds de Prestige</h3>' +
  '<p>Investissez de l\'or (Bourse) : +4%/saison composé, converti en 💎 points d\'héritage à l\'effondrement. Retrait anticipé : -20%.</p></div>' +
  '<div class="rules-block"><h3>♾️ Rang du Gardien & Planètes</h3>' +
  '<p>Dans le Codex (menu principal ou bouton en jeu), dépensez vos 💎 points d\'héritage pour monter de rang : sans plafond, ça boost toute l\'économie et réduit la pression. Tous les ' + PLANET_TIER_SIZE + ' rangs, vous arrivez sur une <b>nouvelle planète</b> — ses Aptitudes et Reliques remplacent celles de l\'ancienne (rien n\'est perdu, juste mis en pause). Le cycle recommence ensuite indéfiniment.</p></div>' +
  '<div class="rules-block"><h3>🧬 Mémoire de l\'écosystème</h3>' +
  '<p>Chaque partie garde une trace de vos habitudes (ce que vous plantez le plus, le biome que vous jouez le plus). Ces habitudes influencent discrètement les parties suivantes : bonus au type d\'espèce que vous privilégiez, terrain de départ plus fertile sur votre biome favori, et une case exceptionnelle tous les 10 parties. Le journal explique toujours quand un bonus s\'applique.</p></div>';
}
