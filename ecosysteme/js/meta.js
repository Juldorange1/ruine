// Progression persistante entre les parties (Codex Génétique), via localStorage.

var META_KEY = 'sylva_save_v1';

// ---- Loadout : posséder ne suffit pas, il faut choisir quoi emmener (jamais assez de place) ----
var ROSTER_CAP = { species:5, building:3, relic:3 };

function defaultMeta(){
  var species = SPECIES_ORDER.filter(function(id){ return SPECIES[id].unlockedByDefault; });
  var buildings = BUILDING_ORDER.filter(function(id){ return BUILDINGS[id].unlockedByDefault; });
  return {
    legacyPoints: 0,
    totalRuns: 0,
    bestSeasons: 0,
    bestVitality: 0,
    bestBiodiversity: 0,
    totalLegacyEarned: 0,
    wardenRank: 0,
    unlockedSpecies: species,
    unlockedBiomes: ['oasis'],
    unlockedBuildings: buildings,
    perkLevels: {},
    relics: [],
    activeSpecies: species.slice(0, ROSTER_CAP.species),
    activeBuildings: buildings.slice(0, ROSTER_CAP.building),
    activeRelics: [],
    trophicPlantCounts: {producer:0, herbivore:0, predator:0, decomposer:0},
    biomeRunCounts: {}
  };
}

// ---- Mémoire de l'écosystème : votre historique influence discrètement les prochaines parties ----
function dominantTrophicHistory(){
  var counts = META.trophicPlantCounts;
  var total = counts.producer + counts.herbivore + counts.predator + counts.decomposer;
  if (total < 12) return null;
  var best = null, bestVal = -1;
  TROPHIC_ORDER.forEach(function(cat){ if (counts[cat] > bestVal){ bestVal = counts[cat]; best = cat; } });
  return best;
}
function mostPlayedBiomeHistory(){
  var counts = META.biomeRunCounts;
  var best = null, bestVal = 0;
  for (var id in counts){ if (counts[id] > bestVal){ bestVal = counts[id]; best = id; } }
  return bestVal >= 2 ? best : null;
}

var META = loadMeta();

function loadMeta(){
  try{
    var raw = localStorage.getItem(META_KEY);
    if (!raw) return defaultMeta();
    var parsed = JSON.parse(raw);
    var def = defaultMeta();
    for (var k in def) if (!(k in parsed)) parsed[k] = def[k];
    if (Array.isArray(parsed.perks)){
      parsed.perks.forEach(function(id){ parsed.perkLevels[id] = Math.max(parsed.perkLevels[id]||0, 1); });
      delete parsed.perks;
    }
    return parsed;
  } catch(e){
    return defaultMeta();
  }
}

function saveMeta(){
  try{ localStorage.setItem(META_KEY, JSON.stringify(META)); } catch(e){}
}

function metaHasSpecies(id){ return META.unlockedSpecies.indexOf(id) !== -1; }
function metaHasBiome(id){ return META.unlockedBiomes.indexOf(id) !== -1; }
function metaHasBuilding(id){ return META.unlockedBuildings.indexOf(id) !== -1; }
function ownsRelic(id){ return META.relics.indexOf(id) !== -1; }

function rosterLists(kind){
  return {
    species: {owned:META.unlockedSpecies, active:META.activeSpecies},
    building: {owned:META.unlockedBuildings, active:META.activeBuildings},
    relic: {owned:META.relics, active:META.activeRelics}
  }[kind];
}
function isEquipped(kind, id){ return rosterLists(kind).active.indexOf(id) !== -1; }
function toggleEquip(kind, id){
  var lists = rosterLists(kind);
  if (lists.owned.indexOf(id) === -1) return false;
  var idx = lists.active.indexOf(id);
  if (idx !== -1){ lists.active.splice(idx, 1); }
  else {
    if (lists.active.length >= ROSTER_CAP[kind]) return false;
    lists.active.push(id);
  }
  saveMeta();
  return true;
}
function autoEquipIfRoom(kind, id){
  var lists = rosterLists(kind);
  if (lists.active.length < ROSTER_CAP[kind]) lists.active.push(id);
}

function biomeRankOk(id){ return META.wardenRank >= (BIOMES[id].rankReq||0); }

// ---- Rang du Gardien : prestige infini, jamais de plafond ----
function wardenCost(rank){ return Math.round(18 * Math.pow(1.22, rank)); }
function wardenMult(){ return 1 + META.wardenRank*0.01; }
function wardenPressureMult(){ return Math.max(0.6, 1 - META.wardenRank*0.004); }

function buyWardenRank(){
  var cost = wardenCost(META.wardenRank);
  if (META.legacyPoints < cost) return false;
  META.legacyPoints -= cost;
  META.wardenRank++;
  saveMeta();
  return true;
}

// ---- Planètes : tous les PLANET_TIER_SIZE rangs, on change complètement de monde ----
function currentTierIndex(){ return Math.floor(META.wardenRank / PLANET_TIER_SIZE); }
function tierStartRank(tierIdx){ return tierIdx * PLANET_TIER_SIZE; }
function currentPlanet(){ return PLANETS[currentTierIndex() % PLANETS.length]; }
function rankIntoTier(){ return META.wardenRank - tierStartRank(currentTierIndex()); }
function planetOfPerk(id){
  for (var i=0;i<PLANETS.length;i++) if (PLANETS[i].perks[id]) return PLANETS[i];
  return null;
}
function planetOfRelic(id){
  for (var i=0;i<PLANETS.length;i++) if (PLANETS[i].relics[id]) return PLANETS[i];
  return null;
}
function perkDef(id){ var pl = planetOfPerk(id); return pl ? pl.perks[id] : null; }
function relicDef(id){ var pl = planetOfRelic(id); return pl ? pl.relics[id] : null; }
function isCurrentPlanetPerk(id){ var pl = planetOfPerk(id); return pl && pl.id === currentPlanet().id; }
function relicRankOk(id){
  var pl = planetOfRelic(id);
  if (!pl || pl.id !== currentPlanet().id) return false;
  return rankIntoTier() >= (relicDef(id).rankReqRelative || 0);
}

// ---- Aptitudes (perks) : niveaux infinis, mais seulement pour la planète actuelle ----
function perkLevel(id){ return META.perkLevels[id] || 0; }
function perkCost(id){ var def = perkDef(id); return Math.round(def.baseCost * Math.pow(1.16, perkLevel(id))); }
function perkValue(id){
  var def = perkDef(id);
  if (!def) return 0;
  var lvl = perkLevel(id);
  if (def.mult) return Math.pow(def.mult, lvl);
  return lvl * def.perLevel;
}
function buyPerk(id){
  if (!isCurrentPlanetPerk(id)) return false;
  var cost = perkCost(id);
  if (META.legacyPoints < cost) return false;
  META.legacyPoints -= cost;
  META.perkLevels[id] = perkLevel(id) + 1;
  saveMeta();
  return true;
}

// ---- Agrégation des effets de toutes les aptitudes possédées (peu importe la planète) ----
function sumHook(hookKey){
  var total = 0;
  PLANETS.forEach(function(planet){
    for (var id in planet.perks){
      var def = planet.perks[id];
      if (def.hook === hookKey && !def.mult) total += perkLevel(id) * def.perLevel;
    }
  });
  return total;
}
function multHook(hookKey){
  var total = 1;
  PLANETS.forEach(function(planet){
    for (var id in planet.perks){
      var def = planet.perks[id];
      if (def.hook === hookKey && def.mult) total *= Math.pow(def.mult, perkLevel(id));
    }
  });
  return total;
}

function metaUnlockCost(kind, id){
  if (kind === 'species') return 8 + SPECIES_ORDER.indexOf(id) * 3;
  if (kind === 'biome') return BIOMES[id].cost;
  if (kind === 'building') return 18 + BUILDING_ORDER.indexOf(id) * 8;
  if (kind === 'relic') return relicDef(id).cost;
  return 999;
}

function metaBuy(kind, id){
  var cost = metaUnlockCost(kind, id);
  if (META.legacyPoints < cost) return false;
  if (kind === 'species'){ if (metaHasSpecies(id)) return false; META.unlockedSpecies.push(id); autoEquipIfRoom('species', id); }
  else if (kind === 'biome'){ if (metaHasBiome(id) || !biomeRankOk(id)) return false; META.unlockedBiomes.push(id); }
  else if (kind === 'building'){ if (metaHasBuilding(id)) return false; META.unlockedBuildings.push(id); autoEquipIfRoom('building', id); }
  else if (kind === 'relic'){ if (ownsRelic(id) || !relicRankOk(id)) return false; META.relics.push(id); autoEquipIfRoom('relic', id); }
  else return false;
  META.legacyPoints -= cost;
  saveMeta();
  return true;
}

function computeLegacyPoints(stats){
  var base = stats.seasons*2 + stats.peakBiodiversity*5 + stats.peakVitality/15;
  var fromFund = (stats.prestigeFund||0) * 0.5;
  return Math.floor(base * (stats.biomeLegacyMult||1)) + Math.floor(fromFund);
}

function applyRunResult(stats){
  META.totalRuns++;
  var lp = computeLegacyPoints(stats);
  META.legacyPoints += lp;
  META.totalLegacyEarned += lp;
  META.bestSeasons = Math.max(META.bestSeasons, stats.seasons);
  META.bestVitality = Math.max(META.bestVitality, stats.peakVitality);
  META.bestBiodiversity = Math.max(META.bestBiodiversity, stats.peakBiodiversity);
  saveMeta();
  return lp;
}
