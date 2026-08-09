// Moteur de simulation : ressources, cycle des saisons, chaîne trophique, menaces, effondrement.

var HARD_MAX_RADIUS = 9;
var HUNGER_DEATH = 10;
var SEASON_NAMES = ['Printemps','Été','Automne','Hiver'];
var SEASON_EMOJI = ['🌱','☀️','🍂','❄️'];

var G = null;

function seasonConfig(idx, biome){
  var cfg = [
    {sun:1.00, water:1.30, frost:false, dry:false, harvest:false},
    {sun:1.25, water:0.65, frost:false, dry:true,  harvest:false},
    {sun:0.90, water:1.00, frost:false, dry:false, harvest:true},
    {sun:0.55, water:0.90, frost:true,  dry:false, harvest:false}
  ][idx];
  return cfg;
}

function newTile(q,r){
  return {
    q:q, r:r, key:axialKey(q,r),
    terrain:'plaine', unlocked:false,
    species:null, hunger:0, pool:0, fertility:20,
    stableTurns:0, dead:false, invasion:false, fire:false, fireSeverity:0,
    building:null, buildingDormant:false
  };
}

function initGame(biomeId){
  var biome = BIOMES[biomeId];
  var tiles = {};
  var coords = hexSpiral({q:0,r:0}, HARD_MAX_RADIUS);
  coords.forEach(function(c){ tiles[axialKey(c.q,c.r)] = newTile(c.q,c.r); });

  G = {
    biome: biomeId,
    tiles: tiles,
    turn: 0,
    roster: {
      species: META.activeSpecies.slice(),
      buildings: META.activeBuildings.slice(),
      relics: META.activeRelics.slice()
    },
    resources: {
      energy: 40 + sumHook('startEnergy'),
      water: 60 + sumHook('startWater'),
      biomass: 20 + sumHook('startBiomass'),
      gp: 0,
      gold: 10 + sumHook('startGold')
    },
    phoenixUsed: false,
    balance: 70,
    stress: 30,
    stressStreak: 0,
    pressure: 0,
    prestigeFund: 0,
    droughtActive: false, droughtTimer: 0,
    speciesEverPlanted: {},
    mutationsChosen: {},
    mutationsSeen: {},
    mutationOffers: {},
    threats: [],
    log: [],
    peak: { biodiversity: 0, vitality: 0 },
    over: false,
    selected: null
  };

  var startRadius = hasRelic('relic_earlyawaken') ? 2 : 1;
  hexSpiral({q:0,r:0}, startRadius).forEach(function(c){
    var t = tiles[axialKey(c.q,c.r)];
    t.unlocked = true;
    t.terrain = weightedTerrain(biome);
    t.fertility = 35;
  });

  if (hasRelic('relic_seedbank')){
    G.mutationsChosen['herbe'] = [0];
    G.mutationsSeen['herbe'] = [0];
  }

  // ---- Mémoire de l'écosystème : votre historique de parties précédentes influence celle-ci ----
  var domTrophic = dominantTrophicHistory();
  var famBiome = mostPlayedBiomeHistory();
  G.legacy = { trophic: domTrophic, biomeFamiliar: (famBiome === biomeId) };
  logMsg('🌍 Un nouvel écosystème germe, biome : ' + biome.name + '.');
  if (domTrophic){
    logMsg('🧬 Mémoire de l\'écosystème : votre habitude de miser sur les ' + trophicHistoryLabel(domTrophic) + ' leur donne +8% d\'efficacité cette partie.');
  }
  if (G.legacy.biomeFamiliar){
    for (var key2 in tiles){ var t2 = tiles[key2]; if (t2.unlocked) t2.fertility = Math.min(100, t2.fertility + 10); }
    logMsg('🏞️ Terrain familier : ' + biome.name + ' est votre biome le plus joué — +10 fertilité de départ.');
  }
  if (META.totalRuns > 0 && META.totalRuns % 10 === 0){
    var candidates = hexRing({q:0,r:0}, 2).map(function(c){ return tiles[axialKey(c.q,c.r)]; }).filter(function(t){ return t && t.unlocked; });
    if (candidates.length){
      var vestige = candidates[Math.floor(Math.random()*candidates.length)];
      vestige.fertility = 100;
      logMsg('✨ Un Vestige ancestral (fertilité maximale) marque cette case, hérité de vos ' + META.totalRuns + ' parties passées.');
    }
  }

  META.biomeRunCounts[biomeId] = (META.biomeRunCounts[biomeId]||0) + 1;
  saveMeta();
  return G;
}

function trophicHistoryLabel(cat){
  return {producer:'producteurs', herbivore:'herbivores', predator:'prédateurs', decomposer:'décomposeurs'}[cat];
}

function legacyTrophicMult(trophic){
  return (G.legacy && G.legacy.trophic === trophic) ? 1.08 : 1;
}

function weightedTerrain(biome){
  var w = biome.terrainWeights;
  var total = 0;
  for (var k in w) total += w[k];
  var roll = Math.random()*total;
  for (var k2 in w){
    roll -= w[k2];
    if (roll <= 0) return k2;
  }
  return 'plaine';
}

function hasRelic(id){ return G.roster.relics.indexOf(id) !== -1; }

function getTile(q,r){ return G.tiles[axialKey(q,r)]; }

function neighborTiles(tile){
  return axialNeighbors(tile.q, tile.r).map(function(c){ return G.tiles[axialKey(c.q,c.r)]; }).filter(Boolean);
}

function tilesInRange(tile, range){
  var out = [];
  for (var key in G.tiles){
    var t = G.tiles[key];
    if (t === tile) continue;
    if (axialDistance(tile, t) <= range) out.push(t);
  }
  return out;
}

// Synergie/rivalité : bonus ou malus selon les espèces voisines. Change à chaque partie selon votre placement.
function neighborSynergyMult(tile, speciesId){
  var sp = SPECIES[speciesId];
  var delta = 0;
  neighborTiles(tile).forEach(function(n){
    if (!n.species) return;
    if (sp.synergy && sp.synergy[n.species]) delta += sp.synergy[n.species];
    if (sp.rivalry && sp.rivalry[n.species]) delta -= sp.rivalry[n.species];
  });
  delta = Math.max(-0.45, Math.min(0.6, delta));
  return 1 + delta;
}

function logMsg(msg){
  G.log.unshift({turn:G.turn, text:msg});
  if (G.log.length > 40) G.log.length = 40;
}

// ---- Évolution : draft aléatoire, 2 options offertes par palier, choix permanent et exclusif ----
var MUTATION_SLOTS = 3;

function mutLevel(speciesId){ return (G.mutationsChosen[speciesId]||[]).length; }

function mutEffects(speciesId){
  var sp = SPECIES[speciesId];
  var chosen = G.mutationsChosen[speciesId] || [];
  var baseSymbiosis = (hasRelic('relic_symbiosis') && (speciesId === 'fleur' || speciesId === 'ver')) ? 0.05 : 0;
  var e = {
    yieldMult:1, foodNeedMult:1, rangeBonus:0, resist:{drought:false, frost:false, fire:false},
    pollinateBonus:baseSymbiosis, fertilityAura:0, fertilityMult:1, spread:false, predationResist:0,
    hungerToleranceBonus:0, efficiencyMult:1, thorns:false, cullsInvasion:false, packBonus:0, stressRelief:0,
    biomassGainMult: hasRelic('relic_compost') ? 1.5 : 1
  };
  chosen.forEach(function(poolIdx){
    var eff = sp.mutationPool[poolIdx].effect;
    for (var k in eff){
      if (k === 'resist'){ for (var rk in eff.resist) e.resist[rk] = e.resist[rk] || eff.resist[rk]; }
      else if (k === 'yieldMult' || k === 'foodNeedMult' || k === 'fertilityMult' || k === 'efficiencyMult' || k === 'biomassGainMult') e[k] *= eff[k];
      else if (typeof eff[k] === 'boolean') e[k] = e[k] || eff[k];
      else if (typeof eff[k] === 'number') e[k] += eff[k];
    }
  });
  return e;
}

function currentMutationOffer(speciesId){
  if (mutLevel(speciesId) >= MUTATION_SLOTS) return null;
  if (G.mutationOffers[speciesId]) return G.mutationOffers[speciesId];
  var sp = SPECIES[speciesId];
  var chosen = G.mutationsChosen[speciesId] || [];
  var seen = G.mutationsSeen[speciesId] || [];
  var pool = [];
  for (var i=0;i<sp.mutationPool.length;i++){
    if (chosen.indexOf(i) === -1 && seen.indexOf(i) === -1) pool.push(i);
  }
  if (!pool.length) return null;
  var offer = [];
  while (offer.length < 2 && pool.length){
    var pick = pool.splice(Math.floor(Math.random()*pool.length), 1)[0];
    offer.push(pick);
  }
  G.mutationOffers[speciesId] = offer;
  return offer;
}

function mutationCostFor(entry){
  var mult = multHook('mutationCostMult') * (hasRelic('relic_memory') ? 0.85 : 1);
  return Math.ceil(entry.cost*mult);
}

function chooseMutation(speciesId, poolIndex){
  var offer = currentMutationOffer(speciesId);
  if (!offer || offer.indexOf(poolIndex) === -1) return false;
  var sp = SPECIES[speciesId];
  var entry = sp.mutationPool[poolIndex];
  var cost = mutationCostFor(entry);
  if (G.resources.gp < cost) return false;
  G.resources.gp -= cost;
  G.mutationsChosen[speciesId] = (G.mutationsChosen[speciesId]||[]).concat([poolIndex]);
  G.mutationsSeen[speciesId] = (G.mutationsSeen[speciesId]||[]).concat(offer);
  delete G.mutationOffers[speciesId];
  logMsg('🧬 Évolution : ' + sp.name + ' — ' + entry.name + '.');
  return true;
}

// ---- Économie (or) ----
function investFund(amount){
  if (amount <= 0 || G.resources.gold < amount) return false;
  G.resources.gold -= amount;
  G.prestigeFund += amount;
  logMsg('🏦 ' + amount + ' or investis dans le Fonds de Prestige.');
  return true;
}

function withdrawFund(amount){
  if (amount <= 0 || G.prestigeFund < amount) return false;
  G.prestigeFund -= amount;
  var back = Math.floor(amount*0.8);
  G.resources.gold += back;
  logMsg('🏦 Retrait du Fonds : ' + back + ' or récupéré (pénalité 20%).');
  return true;
}

function expeditionCost(){
  var exp = EXPEDITIONS.unique;
  return Math.round(exp.cost.gold * (hasRelic('relic_emberheart') ? 0.8 : 1));
}
function expeditionChance(){
  return Math.min(0.95, EXPEDITIONS.unique.chance + (hasRelic('relic_eruption') ? 0.15 : 0));
}

function runExpedition(){
  var exp = EXPEDITIONS.unique;
  var cost = expeditionCost();
  if (G.resources.gold < cost) return false;
  G.resources.gold -= cost;
  var success = Math.random() < expeditionChance();
  if (success){
    var roll = Math.random();
    if (roll < 0.34){ G.resources.energy += 60; G.resources.biomass += 35; logMsg('🧭 Expédition réussie : +60 énergie, +35 biomasse.'); }
    else if (roll < 0.67){ G.resources.gp += 15; logMsg('🧭 Expédition réussie : +15 points génétiques.'); }
    else {
      var freed = 0;
      for (var key in G.tiles){
        var t = G.tiles[key];
        if (freed >= 2) break;
        if (!t.unlocked && neighborTiles(t).some(function(n){ return n.unlocked; })){
          t.unlocked = true; t.terrain = weightedTerrain(BIOMES[G.biome]); t.fertility = 30;
          freed++;
        }
      }
      logMsg('🧭 Expédition réussie : ' + freed + ' territoire(s) défriché(s) gratuitement.');
    }
  } else {
    G.pressure += 6;
    logMsg('🧭 Expédition échouée. Mise perdue.');
    if (Math.random() < 0.35){
      var pool = [];
      for (var k5 in G.tiles){ var t5=G.tiles[k5]; if (t5.unlocked && !t5.invasion && !t5.fire && !(t5.building==='rempart')) pool.push(t5); }
      if (pool.length){
        var spot = pool[Math.floor(Math.random()*pool.length)];
        if (spot.species){ spot.species = null; spot.dead = true; }
        spot.invasion = true;
        logMsg('🦗 Mauvaise rencontre : une invasion apparaît suite à l\'expédition.');
      }
    }
  }
  return true;
}

// ---- Bâtiments ----
function canBuild(tile, buildingId){
  if (!tile || !tile.unlocked || tile.species || tile.building || tile.dead || tile.invasion || tile.fire) return false;
  if (G.roster.buildings.indexOf(buildingId) === -1) return false;
  var cost = buildingCost(buildingId);
  return G.resources.energy >= cost.energy && G.resources.biomass >= cost.biomass && G.resources.gold >= cost.gold;
}

function buildBuilding(tile, buildingId){
  if (!canBuild(tile, buildingId)) return false;
  var cost = buildingCost(buildingId);
  G.resources.energy -= cost.energy;
  G.resources.biomass -= cost.biomass;
  G.resources.gold -= cost.gold;
  tile.building = buildingId;
  tile.buildingDormant = false;
  logMsg('🏗️ Construction : ' + BUILDINGS[buildingId].name + '.');
  return true;
}

function activeBuildingTiles(buildingId){
  var out = [];
  for (var key in G.tiles){
    var t = G.tiles[key];
    if (t.unlocked && t.building === buildingId && !t.buildingDormant) out.push(t);
  }
  return out;
}

function allBuildingTiles(){
  var out = [];
  for (var key in G.tiles){ if (G.tiles[key].unlocked && G.tiles[key].building) out.push(G.tiles[key]); }
  return out;
}

function resolveBuildingUpkeep(){
  var built = allBuildingTiles();
  var discount = multHook('upkeepDiscount');
  built.sort(function(a,b){ return BUILDINGS[a.building].upkeep.gold - BUILDINGS[b.building].upkeep.gold; });
  var gold = G.resources.gold;
  built.forEach(function(t){
    var cost = (t.building === 'rempart' && hasRelic('relic_obsidian')) ? 0 : Math.round(BUILDINGS[t.building].upkeep.gold * discount);
    if (gold >= cost){ gold -= cost; t.buildingDormant = false; }
    else { t.buildingDormant = true; }
  });
  G.resources.gold = gold;
}

// ---- Actions joueur ----
function canPlant(tile, speciesId){
  if (!tile || tile.dead || tile.species || tile.building || !tile.unlocked || tile.invasion || tile.fire) return false;
  var sp = SPECIES[speciesId];
  if (G.roster.species.indexOf(speciesId) === -1) return false;
  return G.resources.energy >= sp.cost.energy && G.resources.biomass >= sp.cost.biomass;
}

function plantSpecies(tile, speciesId){
  if (!canPlant(tile, speciesId)) return false;
  var sp = SPECIES[speciesId];
  G.resources.energy -= sp.cost.energy;
  G.resources.biomass -= sp.cost.biomass;
  tile.species = speciesId;
  tile.hunger = 0;
  tile.pool = 0;
  tile.dead = false;
  tile.stableTurns = 0;
  META.trophicPlantCounts[sp.trophic] = (META.trophicPlantCounts[sp.trophic]||0) + 1;
  saveMeta();
  if (!G.speciesEverPlanted[speciesId]){
    G.speciesEverPlanted[speciesId] = true;
    var gpGain = 2 + sumHook('gpPerNewSpecies');
    G.resources.gp += gpGain;
    logMsg('✨ Nouvelle espèce introduite : ' + sp.name + ' (+' + gpGain + ' gp).');
  }
  return true;
}

function expandCost(tile){
  var dist = axialDistance({q:0,r:0}, tile);
  var base = 12 + dist*5;
  base *= multHook('frontierCostMult');
  if (hasRelic('relic_diplomacy')) base *= 0.75;
  return Math.round(base);
}

function canExpand(tile){
  if (!tile || tile.unlocked) return false;
  var hasUnlockedNeighbor = neighborTiles(tile).some(function(n){ return n.unlocked; });
  if (!hasUnlockedNeighbor) return false;
  return G.resources.energy >= expandCost(tile);
}

function expandFrontier(tile){
  if (!canExpand(tile)) return false;
  var cost = expandCost(tile);
  G.resources.energy -= cost;
  tile.unlocked = true;
  var biome = BIOMES[G.biome];
  var neigh = neighborTiles(tile).filter(function(n){ return n.unlocked; });
  if (neigh.length && Math.random() < 0.55){
    tile.terrain = neigh[Math.floor(Math.random()*neigh.length)].terrain;
  } else {
    tile.terrain = weightedTerrain(biome);
  }
  tile.fertility = 20 + Math.round(Math.random()*15);
  if (hasRelic('relic_glacialmarch')) G.pressure = Math.max(0, G.pressure-1);
  return true;
}

function interventionCost(kind){
  return {irrigate:10, extinguish:14, eradicate:12}[kind] || 10;
}

function irrigate(){
  var cost = interventionCost('irrigate');
  if (G.resources.biomass < cost) return false;
  G.resources.biomass -= cost;
  G.resources.water = Math.min(100, G.resources.water + 22);
  logMsg('💧 Irrigation manuelle : +22 eau.');
  return true;
}

function extinguishFire(tile){
  var cost = interventionCost('extinguish');
  if (!tile || !tile.fire || G.resources.biomass < cost) return false;
  G.resources.biomass -= cost;
  tile.fire = false; tile.fireSeverity = 0;
  logMsg('🧯 Incendie éteint sur une case.');
  return true;
}

function eradicateInvasion(tile){
  var cost = interventionCost('eradicate');
  if (!tile || !tile.invasion || G.resources.biomass < cost) return false;
  G.resources.biomass -= cost;
  tile.invasion = false;
  tile.fertility += 10;
  logMsg('🛡️ Invasion éradiquée sur une case.');
  return true;
}

// ---- Résolution d'une saison ----
function resolveSeason(){
  if (G.over) return;
  var biome = BIOMES[G.biome];
  var seasonIdx = G.turn % 4;
  var cfg = seasonConfig(seasonIdx, biome);

  var allTiles = [];
  for (var key in G.tiles) allTiles.push(G.tiles[key]);
  var unlockedTiles = allTiles.filter(function(t){ return t.unlocked; });

  // 0. Entretien des bâtiments (or)
  resolveBuildingUpkeep();
  var reservoirs = activeBuildingTiles('reservoir');
  var tourCount = activeBuildingTiles('tour').length;

  // 1. Production
  unlockedTiles.forEach(function(t){
    t.pool = 0;
    if (!t.species) return;
    var sp = SPECIES[t.species];
    if (sp.trophic !== 'producer') return;
    var e = mutEffects(t.species);
    var terrainDef = TERRAINS[t.terrain];
    var terAff = sp.affinity[t.terrain] || 1;
    var fertBonus = 1 + t.fertility/200;
    var nearReservoir = reservoirs.some(function(r){ return axialDistance(t,r) <= 2; });
    var terrainWaterRelief = (terrainDef.water - 1) * 0.25;
    var droughtBase = (nearReservoir ? 0.72 : 0.45) + terrainWaterRelief;
    var droughtPenalty = (G.droughtActive && !e.resist.drought) ? Math.min(1, Math.max(0.15, droughtBase + sumHook('droughtResist'))) : 1;
    var frostPenalty = (cfg.frost && !e.resist.frost && !hasRelic('relic_deepfreeze')) ? 0.5 : 1;
    var pollBonus = 1;
    neighborTiles(t).forEach(function(n){
      if (n.species && SPECIES[n.species].pollinator){
        pollBonus += mutEffects(n.species).pollinateBonus;
      }
      if (n.species && SPECIES[n.species].id === 'ver'){
        pollBonus += mutEffects(n.species).pollinateBonus;
      }
    });
    var synergyMult = neighborSynergyMult(t, t.species);
    var yieldAmt = sp.baseYield * e.yieldMult * terAff * terrainDef.sun * fertBonus * cfg.sun * biome.sunMult * droughtPenalty * frostPenalty * pollBonus * synergyMult * legacyTrophicMult('producer');
    t.pool = Math.max(0, yieldAmt);
    t.fertility = Math.min(100, t.fertility + 0.4);
  });

  // 1b. Aura de fertilité (mutation) : booste discrètement les voisins
  unlockedTiles.forEach(function(t){
    if (!t.species) return;
    var e = mutEffects(t.species);
    if (!e.fertilityAura) return;
    neighborTiles(t).forEach(function(n){
      if (n.unlocked) n.fertility = Math.min(100, n.fertility + e.fertilityAura);
    });
  });

  // 2. Consommation herbivores
  unlockedTiles.forEach(function(t){
    if (!t.species) return;
    var sp = SPECIES[t.species];
    if (sp.trophic !== 'herbivore') return;
    var e = mutEffects(t.species);
    var need = sp.foodNeed * e.foodNeedMult / neighborSynergyMult(t, t.species) / legacyTrophicMult('herbivore');
    var range = (sp.range||1) + e.rangeBonus;
    var suppliers = tilesInRange(t, range).filter(function(n){ return n.species && SPECIES[n.species].trophic === 'producer' && n.pool > 0; });
    var available = suppliers.reduce(function(s,n){ return s + n.pool; }, 0);
    var got = Math.min(need, available);
    if (available > 0 && got > 0){
      var ratio = got/available;
      suppliers.forEach(function(n){ n.pool -= n.pool*ratio; });
    }
    var satisfaction = need > 0 ? got/need : 1;
    resolveHunger(t, satisfaction, e);
    t.herbBody = got * sp.efficiency * e.efficiencyMult;
  });

  // 3. Consommation prédateurs
  unlockedTiles.forEach(function(t){
    if (!t.species) return;
    var sp = SPECIES[t.species];
    if (sp.trophic !== 'predator') return;
    var e = mutEffects(t.species);
    var need = sp.foodNeed * e.foodNeedMult / neighborSynergyMult(t, t.species) / legacyTrophicMult('predator') * (hasRelic('relic_bloodmoon') ? 0.8 : 1);
    var range = (sp.range||1) + e.rangeBonus;
    var prey = tilesInRange(t, range).filter(function(n){ return n.species && SPECIES[n.species].trophic === 'herbivore' && n.herbBody > 0; });
    var available = prey.reduce(function(s,n){ return s + n.herbBody; }, 0);
    var got = Math.min(need, available);
    if (available > 0 && got > 0){
      var ratio = got/available;
      prey.forEach(function(n){ n.herbBody -= n.herbBody*ratio; });
    }
    var packBonus = 0;
    if (sp.pack){
      var hasPackmate = neighborTiles(t).some(function(n){ return n.species === t.species; });
      if (hasPackmate) packBonus = e.packBonus;
    }
    if (hasRelic('relic_packinstinct')){
      var anyPredatorAdjacent = neighborTiles(t).some(function(n){ return n.species && SPECIES[n.species].trophic === 'predator'; });
      if (anyPredatorAdjacent) packBonus = Math.max(packBonus, 0.2);
    }
    var satisfaction = need > 0 ? Math.min(1.4, (got/need) * (1+packBonus)) : 1;
    resolveHunger(t, satisfaction, e);
    if (e.cullsInvasion){
      neighborTiles(t).concat(tilesInRange(t, range)).forEach(function(n){
        if (n.invasion && Math.random() < 0.6) { n.invasion = false; n.fertility += 8; }
      });
    }
    if (sp.affinity === undefined) {}
    if (t.species === 'cactus'){} // no-op
  });

  // 3b. Épines (défense passive, hors chaîne trophique)
  unlockedTiles.forEach(function(t){
    if (!t.species) return;
    var e = mutEffects(t.species);
    if (e.thorns){
      neighborTiles(t).forEach(function(n){
        if (n.invasion && Math.random() < 0.35) { n.invasion = false; n.fertility += 6; }
      });
    }
  });

  // 4. Décomposeurs — recyclent la matière morte en fertilité ET en biomasse exploitable
  var decomposerBiomassGain = 0;
  unlockedTiles.forEach(function(t){
    if (!t.species) return;
    var sp = SPECIES[t.species];
    if (sp.trophic !== 'decomposer') return;
    var e = mutEffects(t.species);
    var range = (sp.range||1) + e.rangeBonus;
    var synergyMult = neighborSynergyMult(t, t.species);
    decomposerBiomassGain += (sp.biomassGain||0) * e.biomassGainMult * synergyMult * legacyTrophicMult('decomposer') * (hasRelic('relic_iceroots') ? 1.3 : 1);
    tilesInRange(t, range).forEach(function(n){
      if (n === t) return;
      n.fertility = Math.min(100, n.fertility + 3*e.fertilityMult*synergyMult*legacyTrophicMult('decomposer'));
      if (n.dead && n.fertility >= 45 && Math.random() < 0.5){
        n.dead = false;
        decomposerBiomassGain += 8;
        logMsg('♻️ ' + sp.name + ' régénère une friche en terrain fertile (+8 biomasse).');
      }
    });
    if (e.stressRelief) G.stress = Math.max(0, G.stress - e.stressRelief*0.2);
  });

  // 5. Propagation (mutation "spread")
  unlockedTiles.forEach(function(t){
    if (!t.species) return;
    var e = mutEffects(t.species);
    if (!e.spread) return;
    if (Math.random() > 0.18) return;
    var targets = neighborTiles(t).filter(function(n){ return n.unlocked && !n.species && !n.dead && !n.invasion && !n.fire; });
    if (targets.length){
      var target = targets[Math.floor(Math.random()*targets.length)];
      target.species = t.species;
      target.hunger = 0; target.pool = 0; target.stableTurns = 0;
    }
  });

  // 6. Mortalité (faim) déjà appliquée dans resolveHunger via t.pendingDeath
  unlockedTiles.forEach(function(t){
    if (t.pendingDeath){
      logMsg('💀 ' + SPECIES[t.species].name + ' a disparu (famine) sur une case.');
      t.species = null; t.dead = true; t.hunger = 0; t.pendingDeath = false;
      t.fertility = Math.min(100, t.fertility + 8);
    } else if (t.species) {
      t.stableTurns++;
    }
  });

  // 7. Ressources globales
  var wMult = wardenMult();
  var producers = unlockedTiles.filter(function(t){ return t.species && SPECIES[t.species].trophic === 'producer'; });
  var solarIncome = producers.reduce(function(s,t){ return s + 2 + t.pool*0.12; }, 0) * wMult * (hasRelic('relic_auroralight') ? 1.15 : 1);
  var populated = unlockedTiles.filter(function(t){ return t.species; });
  var waterUpkeep = populated.length * 0.35;
  var reservoirBonus = reservoirs.length * 8;
  var waterIncome = biome.waterRegen * cfg.water + reservoirBonus - waterUpkeep - (G.droughtActive ? 10 : 0);
  var stableProducers = producers.filter(function(t){ return t.stableTurns > 3; });
  var biomassIncome = (stableProducers.length * 0.8 + (cfg.harvest ? stableProducers.length*0.5 : 0) + decomposerBiomassGain) * wMult;

  G.resources.energy = Math.max(0, G.resources.energy + solarIncome);
  G.resources.water = Math.max(0, Math.min(100, G.resources.water + waterIncome));
  G.resources.biomass = Math.max(0, G.resources.biomass + biomassIncome);

  // 8. Biodiversité / GP passif
  var aliveSpeciesSet = {};
  populated.forEach(function(t){ aliveSpeciesSet[t.species] = true; });
  var biodiversity = Object.keys(aliveSpeciesSet).length;
  if (biodiversity >= 5 && G.turn % 3 === 0) G.resources.gp += 1;

  // 8b. Bâtiments économiques (or, gp)
  var marches = activeBuildingTiles('marche');
  if (marches.length){
    var goldGain = marches.length * (2 + populated.length*0.3) * wMult;
    G.resources.gold += goldGain;
  }
  var labos = activeBuildingTiles('labo');
  if (labos.length){
    var gpGain2 = labos.length * (1 + biodiversity*0.4) * wMult;
    G.resources.gp += gpGain2;
  }

  // 8d. Fonds de Prestige : intérêt composé, converti en points d'héritage à l'effondrement
  G.prestigeFund *= 1.04;

  // 9. Équilibre / stress
  var counts = {producer:0, herbivore:0, predator:0, decomposer:0};
  populated.forEach(function(t){ counts[SPECIES[t.species].trophic]++; });
  var total = populated.length || 1;
  var deviation = 0;
  TROPHIC_ORDER.forEach(function(cat){
    var ratio = counts[cat]/total;
    var band = IDEAL_RATIO[cat];
    if (populated.length < 4) return;
    if (ratio < band[0]) deviation += (band[0]-ratio);
    else if (ratio > band[1]) deviation += (ratio-band[1]);
  });
  var targetStress = Math.min(100, deviation*140);
  G.stress = G.stress*0.5 + targetStress*0.5;
  G.balance = Math.round(Math.max(0, 100 - G.stress));

  if (G.balance < 15) G.stressStreak++; else G.stressStreak = 0;

  // 9b. Pression écologique (scaling de la difficulté, visible par le joueur)
  var rempartCount = activeBuildingTiles('rempart').length;
  var rawPressure = (G.turn*1.1 + populated.length*1.3 + unlockedTiles.length*0.35 - tourCount*4 - rempartCount*1.5) * wardenPressureMult() - sumHook('pressureReduction');
  G.pressure = Math.max(0, Math.round(rawPressure*10)/10);

  // 10. Menaces
  updateThreats(cfg, biome, tourCount);

  // 11. Sécheresse (déclenchement / fin)
  if (G.droughtActive){
    G.droughtTimer--;
    if (G.droughtTimer <= 0){ G.droughtActive = false; logMsg('🌦️ La sécheresse prend fin.'); }
  } else if (cfg.dry) {
    var droughtChance = 0.10 * (biome.droughtBias||1) * (G.resources.water < 35 ? 1.8 : 1) * (1 + G.pressure/180);
    if (Math.random() < droughtChance){
      G.droughtActive = true;
      G.droughtTimer = 2 + Math.floor(Math.random()*2);
      logMsg('🏜️ Sécheresse ! Les producteurs non adaptés souffrent.');
    }
  }

  // 12. Score / peaks
  var vitality = Math.round(G.resources.biomass + biodiversity*50 + G.turn*10);
  G.peak.biodiversity = Math.max(G.peak.biodiversity, biodiversity);
  G.peak.vitality = Math.max(G.peak.vitality, vitality);
  G.lastBiodiversity = biodiversity;
  G.lastVitality = vitality;

  // 13. Effondrement
  checkCollapse(populated.length);

  G.turn++;
  if (!G.over && G.turn % 4 === 0) logMsg('📅 Une nouvelle année commence (' + (G.turn/4 + 1) + ').');
}

function resolveHunger(t, satisfaction, e){
  var tolerance = HUNGER_DEATH + (e.hungerToleranceBonus||0) + (hasRelic('relic_resilience') ? 2 : 0);
  if (satisfaction < 0.999){
    var risk = (1-satisfaction);
    if (e.predationResist) risk *= (1-e.predationResist);
    if (hasRelic('relic_hibernation')) risk *= 0.75;
    t.hunger += risk*3.2;
  } else {
    t.hunger = Math.max(0, t.hunger - 2.2);
  }
  if (t.hunger >= tolerance) t.pendingDeath = true;
}

function isRempart(t){ return t.building === 'rempart' && !t.buildingDormant; }

function updateThreats(cfg, biome, tourCount){
  var pressureMult = 1 + G.pressure/140;
  var tourMult = Math.max(0.45, 1 - (tourCount||0)*0.15);

  // Propagation incendie
  var fireTiles = [];
  for (var key in G.tiles){ if (G.tiles[key].fire) fireTiles.push(G.tiles[key]); }
  fireTiles.forEach(function(t){
    var terrain = TERRAINS[t.terrain];
    var spreadChance = 0.22 * terrain.flammable * biome.threatMult * pressureMult;
    neighborTiles(t).forEach(function(n){
      if (n.fire || !n.unlocked || isRempart(n)) return;
      if (TERRAINS[n.terrain].flammable <= 0.05) return;
      if (Math.random() < spreadChance) n.fire = true;
    });
    if (t.species){
      logMsg('🔥 Le feu ravage une case.');
      t.species = null; t.dead = true; t.fertility = Math.min(100, t.fertility + 15);
    }
    if (t.building && !hasRelic('relic_wildfireward')){
      logMsg('🔥 Le feu détruit un bâtiment (' + BUILDINGS[t.building].name + ').');
      t.building = null; t.buildingDormant = false;
    }
    if (Math.random() < 0.3) t.fire = false;
  });

  // Nouvel incendie
  if (!biome.fireDisabled && !hasRelic('relic_permacold') && cfg.dry){
    var candidates = [];
    for (var k2 in G.tiles){
      var t2 = G.tiles[k2];
      if (t2.unlocked && !t2.fire && !isRempart(t2) && TERRAINS[t2.terrain].flammable > 0.3 &&
          ((t2.species && SPECIES[t2.species].trophic === 'producer') || t2.building)) candidates.push(t2);
    }
    var igniteChance = 0.05 * biome.threatMult * (G.stress/100 + 0.3) * pressureMult * tourMult;
    if (candidates.length && Math.random() < igniteChance){
      var pick = candidates[Math.floor(Math.random()*candidates.length)];
      pick.fire = true;
      logMsg('🔥 Un incendie se déclare !');
    }
  }

  // Propagation invasion
  var invTiles = [];
  for (var key3 in G.tiles){ if (G.tiles[key3].invasion) invTiles.push(G.tiles[key3]); }
  invTiles.forEach(function(t){
    var guarded = neighborTiles(t).some(function(n){ return n.species && SPECIES[n.species].trophic === 'predator'; });
    var spreadChance = (guarded ? 0.08 : 0.22) * biome.threatMult * pressureMult;
    neighborTiles(t).forEach(function(n){
      if (n.invasion || !n.unlocked || n.fire || isRempart(n)) return;
      if (Math.random() < spreadChance){
        if (n.species){
          logMsg('🦗 L\'invasion dévore une espèce.');
          n.species = null; n.dead = true;
        }
        if (n.building){
          logMsg('🦗 L\'invasion détruit un bâtiment (' + BUILDINGS[n.building].name + ').');
          n.building = null; n.buildingDormant = false;
        }
        n.invasion = true;
      }
    });
    if (guarded && Math.random() < 0.4) t.invasion = false;
  });

  // Nouvelle invasion
  var invChance = 0.05 * (G.stress/100 + 0.25) * biome.threatMult * (biome.invasionBias||1) * pressureMult * tourMult;
  if (Math.random() < invChance){
    var pool = [];
    for (var k4 in G.tiles){
      var t4 = G.tiles[k4];
      if (t4.unlocked && !t4.invasion && !t4.fire && !isRempart(t4)) pool.push(t4);
    }
    if (pool.length){
      var spot = pool[Math.floor(Math.random()*pool.length)];
      if (spot.species){ spot.species = null; spot.dead = true; }
      if (spot.building){ spot.building = null; spot.buildingDormant = false; }
      spot.invasion = true;
      logMsg('🦗 Une espèce envahissante apparaît !');
    }
  }
}

function checkCollapse(populatedCount){
  if (G.over) return;
  var reason = null;
  if (G.turn > 3 && populatedCount === 0){
    if (hasRelic('relic_phoenix') && !G.phoenixUsed){
      G.phoenixUsed = true;
      var center = G.tiles['0,0'];
      if (center && center.unlocked){ center.species = 'herbe'; center.dead = false; center.hunger = 0; center.pool = 0; center.stableTurns = 0; }
      logMsg('🐦‍🔥 Le Phénix relance l\'écosystème depuis les cendres !');
      return;
    }
    reason = 'Extinction totale : plus aucune espèce ne subsiste.';
  }
  else if (G.stressStreak >= 4) reason = 'Effondrement de l\'équilibre écologique.';
  else if (G.resources.water <= 0 && G.turn > 2) reason = 'Assèchement complet de l\'écosystème.';
  if (reason){
    G.over = true;
    logMsg('☠️ ' + reason);
    G.gameOverReason = reason;
  }
}

function biodiversityIndex(){
  var set = {};
  for (var key in G.tiles){
    var t = G.tiles[key];
    if (t.species) set[t.species] = true;
  }
  return Object.keys(set).length;
}
