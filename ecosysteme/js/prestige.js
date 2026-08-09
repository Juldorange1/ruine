// Planètes : tous les PLANET_TIER_SIZE rangs du Gardien, on change complètement de monde —
// nouvelles Aptitudes (perks à niveaux infinis) et nouvelles Reliques à débloquer. Rien n'est jamais perdu,
// mais on ne peut faire progresser QUE les aptitudes/reliques de la planète actuelle. Le cycle recommence ensuite.

var PLANET_TIER_SIZE = 10;

var PLANETS = [
  {
    id:'terra', name:'Terra', emoji:'🌍',
    desc:'Le monde d\'origine, tempéré et généreux.',
    perks:{
      perk_energy:   { name:'Réserve solaire',      unit:'énergie au départ',   baseCost:12, hook:'startEnergy', perLevel:10 },
      perk_water:    { name:'Nappe phréatique',      unit:'eau au départ',       baseCost:12, hook:'startWater', perLevel:8 },
      perk_frontier: { name:'Pionniers',             unit:'coût de défrichage',  baseCost:18, hook:'frontierCostMult', mult:0.92 },
      perk_gp:       { name:'Instinct naturaliste',  unit:'gp par espèce',       baseCost:16, hook:'gpPerNewSpecies', perLevel:1 },
      perk_gold:     { name:'Capital de départ',     unit:'or au départ',        baseCost:14, hook:'startGold', perLevel:12 }
    },
    relics:{
      relic_symbiosis:   { name:'Symbiose universelle', emoji:'🌐', rankReqRelative:3, cost:40, desc:'Fleur et Ver de terre offrent un bonus aux voisins dès leur plantation, même sans évolution.' },
      relic_memory:       { name:'Mémoire génétique',   emoji:'🧠', rankReqRelative:4, cost:45, desc:'Toutes les évolutions coûtent 15% de points génétiques en moins.' },
      relic_packinstinct: { name:'Instinct de meute',   emoji:'🐾', rankReqRelative:5, cost:55, desc:'Tous les prédateurs bénéficient d\'un bonus de chasse si un autre prédateur est adjacent.' },
      relic_seedbank:     { name:'Banque de graines',   emoji:'🌾', rankReqRelative:6, cost:65, desc:'Chaque partie commence avec l\'Herbe déjà évoluée au premier palier.' },
      relic_compost:      { name:'Flux compostant',     emoji:'🪱', rankReqRelative:6, cost:60, desc:'La production de biomasse des décomposeurs est augmentée de 50%.' },
      relic_earlyawaken:  { name:'Éveil précoce',       emoji:'🌅', rankReqRelative:7, cost:70, desc:'Chaque partie démarre avec un territoire deux fois plus grand déjà défriché.' },
      relic_diplomacy:    { name:'Diplomatie territoriale', emoji:'🗺️', rankReqRelative:8, cost:80, desc:'Le coût de défrichage de la frontière est réduit de 25% supplémentaires.' },
      relic_resilience:   { name:'Résilience ancestrale', emoji:'🛡️', rankReqRelative:9, cost:95, desc:'Toutes les espèces tolèrent davantage la faim avant de disparaître.' }
    }
  },
  {
    id:'kryos', name:'Kryos', emoji:'❄️',
    desc:'Monde de glace : tout y est plus dur à démarrer, mais rien n\'y meurt vite.',
    perks:{
      kryos_permafrost: { name:'Permafrost',    unit:'réduction de la sécheresse', baseCost:20, hook:'droughtResist', perLevel:0.03 },
      kryos_stockpile:  { name:'Réserves gelées', unit:'biomasse au départ',  baseCost:14, hook:'startBiomass', perLevel:8 },
      kryos_thermal:    { name:'Isolation thermique', unit:'coût d\'entretien', baseCost:22, hook:'upkeepDiscount', mult:0.94 },
      kryos_clarity:    { name:'Clarté de glace', unit:'coût d\'évolution',   baseCost:20, hook:'mutationCostMult', mult:0.95 },
      kryos_stillness:  { name:'Quiétude polaire', unit:'pression écologique', baseCost:24, hook:'pressureReduction', perLevel:0.6 }
    },
    relics:{
      relic_deepfreeze:   { name:'Grand gel',        emoji:'🧊', rankReqRelative:2, cost:50, desc:'Le gel hivernal ne pénalise plus jamais vos producteurs.' },
      relic_hibernation:  { name:'Hibernation',      emoji:'😴', rankReqRelative:3, cost:55, desc:'Toutes les espèces accumulent la faim 25% plus lentement.' },
      relic_glacialmarch:{ name:'Marche glaciaire',  emoji:'🥾', rankReqRelative:4, cost:45, desc:'Chaque défrichage de frontière apaise légèrement la pression écologique.' },
      relic_permacold:    { name:'Permafrost éternel', emoji:'🏔️', rankReqRelative:6, cost:75, desc:'Les incendies ne peuvent plus jamais se déclarer.' },
      relic_iceroots:      { name:'Racines de glace',  emoji:'🌱', rankReqRelative:5, cost:60, desc:'La production de biomasse des décomposeurs est augmentée de 30% supplémentaires.' },
      relic_auroralight:  { name:'Lumière boréale',   emoji:'🌌', rankReqRelative:8, cost:80, desc:'+15% d\'énergie captée par tous vos producteurs, en permanence.' }
    }
  },
  {
    id:'ember', name:'Ember', emoji:'🔥',
    desc:'Monde volcanique : hauts risques, hautes récompenses.',
    perks:{
      ember_forge:   { name:'Forge magmatique', unit:'énergie au départ', baseCost:16, hook:'startEnergy', perLevel:14 },
      ember_cache:   { name:'Coffre de braises', unit:'or au départ',    baseCost:18, hook:'startGold', perLevel:16 },
      ember_kiln:    { name:'Four à céramique',  unit:'gp par espèce',   baseCost:20, hook:'gpPerNewSpecies', perLevel:1 },
      ember_swift:   { name:'Pas de lave',       unit:'coût de défrichage', baseCost:26, hook:'frontierCostMult', mult:0.90 },
      ember_resolve: { name:'Sang-froid',        unit:'pression écologique', baseCost:28, hook:'pressureReduction', perLevel:0.8 }
    },
    relics:{
      relic_emberheart:    { name:'Cœur de braise',   emoji:'❤️‍🔥', rankReqRelative:2, cost:60, desc:'Les expéditions coûtent 20% d\'or en moins.' },
      relic_phoenix:        { name:'Phénix',            emoji:'🐦‍🔥', rankReqRelative:9, cost:120, desc:'Une fois par partie, une extinction totale relance l\'écosystème depuis les cendres au lieu de mettre fin à la partie.' },
      relic_wildfireward:  { name:'Rempart ignifuge',  emoji:'🧯', rankReqRelative:4, cost:55, desc:'Vos bâtiments ne peuvent plus être détruits par le feu.' },
      relic_bloodmoon:      { name:'Lune rouge',        emoji:'🌕', rankReqRelative:5, cost:65, desc:'Tous les prédateurs sont 20% plus efficaces en permanence.' },
      relic_obsidian:        { name:'Obsidienne',        emoji:'🪨', rankReqRelative:3, cost:58, desc:'Les Remparts n\'ont plus aucun coût d\'entretien.' },
      relic_eruption:        { name:'Éruption',           emoji:'🌋', rankReqRelative:7, cost:70, desc:'+15% de chances de succès pour vos expéditions.' }
    }
  }
];
