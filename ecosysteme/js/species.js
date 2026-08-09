// Définitions des espèces, mutations, terrains et biomes.

var TROPHIC_ORDER = ['producer','herbivore','predator','decomposer'];

var TERRAINS = {
  plaine:   { name:'Plaine',        sun:1.00, water:1.00, flammable:0.5 },
  foret:    { name:'Sous-bois',     sun:0.85, water:1.10, flammable:0.6 },
  humide:   { name:'Zone humide',   sun:0.90, water:1.40, flammable:0.05 },
  rocheux:  { name:'Rocailles',     sun:1.05, water:0.70, flammable:0.15 },
  aride:    { name:'Terre aride',   sun:1.15, water:0.55, flammable:0.85 }
};

// affinity[terrain] = multiplicateur de rendement / robustesse pour l'espèce
// synergy/rivalry[id] = bonus/malus quand cette espèce est adjacente à id (varie chaque partie selon votre placement)
var SPECIES = {
  herbe: {
    id:'herbe', name:'Herbe', emoji:'🌿', trophic:'producer',
    desc:'Nourrit les herbivores voisins. Bon marché.',
    cost:{energy:6, biomass:0}, baseYield:10, foodNeed:0,
    affinity:{plaine:1.1, foret:0.9, humide:1.15, rocheux:0.7, aride:0.5},
    resist:{drought:false, frost:false},
    synergy:{fleur:0.12}, rivalry:{cactus:0.12},
    unlockedByDefault:true,
    mutationPool:[
      {name:'Racines profondes', cost:6, desc:'+25% rendement, résiste à la sécheresse', effect:{yieldMult:1.25, resist:{drought:true}}},
      {name:'Prolifération', cost:12, desc:'peut se propager sur une case vide adjacente', effect:{spread:true}},
      {name:'Photosynthèse dense', cost:20, desc:'+40% rendement', effect:{yieldMult:1.4}},
      {name:'Feuillage dense', cost:10, desc:'+15% rendement, résiste au gel', effect:{yieldMult:1.15, resist:{frost:true}}},
      {name:'Tapis racinaire', cost:14, desc:'fertilise les cases voisines chaque saison', effect:{fertilityAura:4}},
      {name:'Résistance totale', cost:24, desc:'résiste à la sécheresse, au gel et au feu', effect:{resist:{drought:true, frost:true, fire:true}}}
    ]
  },
  fleur: {
    id:'fleur', name:'Fleur', emoji:'🌼', trophic:'producer',
    desc:'Dope ses voisins une fois évoluée.',
    cost:{energy:9, biomass:0}, baseYield:7, foodNeed:0,
    affinity:{plaine:1.05, foret:1.0, humide:1.1, rocheux:0.6, aride:0.6},
    resist:{drought:false, frost:false},
    synergy:{herbe:0.12, ver:0.15},
    unlockedByDefault:true, pollinator:true,
    mutationPool:[
      {name:'Nectar riche', cost:8, desc:'+20% rendement, +bonus aux producteurs voisins', effect:{yieldMult:1.2, pollinateBonus:0.15}},
      {name:'Floraison longue', cost:14, desc:'résiste au gel, fleurit toute l\'année', effect:{resist:{frost:true}}},
      {name:'Essaim pollinisateur', cost:22, desc:'bonus voisin doublé', effect:{pollinateBonus:0.3}},
      {name:'Racines profondes', cost:10, desc:'+10% rendement, résiste à la sécheresse', effect:{yieldMult:1.1, resist:{drought:true}}},
      {name:'Parfum attractif', cost:16, desc:'fertilise les cases voisines chaque saison', effect:{fertilityAura:3}},
      {name:'Floraison éternelle', cost:24, desc:'+15% rendement, gros bonus voisin', effect:{yieldMult:1.15, pollinateBonus:0.25}}
    ]
  },
  arbre: {
    id:'arbre', name:'Arbre', emoji:'🌳', trophic:'producer',
    desc:'Robuste et productif, mais coûteux.',
    cost:{energy:22, biomass:8}, baseYield:22, foodNeed:0,
    affinity:{plaine:1.0, foret:1.3, humide:1.05, rocheux:0.6, aride:0.4},
    resist:{drought:false, frost:true},
    synergy:{champignon:0.18},
    unlockedByDefault:false,
    mutationPool:[
      {name:'Écorce épaisse', cost:10, desc:'résiste à la sécheresse et au feu', effect:{resist:{drought:true, fire:true}}},
      {name:'Canopée', cost:16, desc:'+30% rendement', effect:{yieldMult:1.3}},
      {name:'Racines anciennes', cost:26, desc:'fertilise les cases voisines chaque saison', effect:{fertilityAura:6}},
      {name:'Frondaison', cost:12, desc:'fertilise légèrement les cases voisines', effect:{fertilityAura:3}},
      {name:'Sève résistante', cost:18, desc:'résiste sécheresse/feu, +10% rendement', effect:{resist:{drought:true, fire:true}, yieldMult:1.1}},
      {name:'Géant ancestral', cost:28, desc:'+40% rendement', effect:{yieldMult:1.4}}
    ]
  },
  cactus: {
    id:'cactus', name:'Cactus', emoji:'🌵', trophic:'producer',
    desc:'Insensible à la sécheresse.',
    cost:{energy:10, biomass:0}, baseYield:9, foodNeed:0,
    affinity:{plaine:0.9, foret:0.6, humide:0.5, rocheux:1.05, aride:1.35},
    resist:{drought:true, frost:false},
    rivalry:{herbe:0.12},
    unlockedByDefault:false,
    mutationPool:[
      {name:'Réserve d\'eau', cost:8, desc:'+20% rendement en climat aride', effect:{yieldMult:1.2}},
      {name:'Épines', cost:14, desc:'blesse les envahisseurs adjacents', effect:{thorns:true}},
      {name:'Succulence', cost:20, desc:'+30% rendement', effect:{yieldMult:1.3}},
      {name:'Épiderme cireux', cost:10, desc:'résiste au feu, +10% rendement', effect:{resist:{fire:true}, yieldMult:1.1}},
      {name:'Racines étendues', cost:16, desc:'fertilise les cases voisines chaque saison', effect:{fertilityAura:3}},
      {name:'Sentinelle épineuse', cost:24, desc:'+30% rendement et blesse les envahisseurs', effect:{yieldMult:1.3, thorns:true}}
    ]
  },
  lapin: {
    id:'lapin', name:'Lapin', emoji:'🐇', trophic:'herbivore',
    desc:'Économique, peu exigeant.',
    cost:{energy:10, biomass:4}, baseYield:0, foodNeed:12, range:1, efficiency:0.30,
    affinity:{plaine:1.05, foret:1.0, humide:0.95, rocheux:0.85, aride:0.75},
    resist:{drought:false, frost:false},
    rivalry:{cerf:0.15},
    unlockedByDefault:true,
    mutationPool:[
      {name:'Portée facile', cost:8, desc:'-25% besoin de nourriture', effect:{foodNeedMult:0.75}},
      {name:'Vigilance', cost:14, desc:'-40% de risque face aux menaces', effect:{predationResist:0.4}},
      {name:'Reproduction rapide', cost:20, desc:'peut coloniser une case vide adjacente', effect:{spread:true}},
      {name:'Terrier profond', cost:10, desc:'tolère la faim plus longtemps', effect:{hungerToleranceBonus:4}},
      {name:'Odorat vif', cost:16, desc:'portée de nourrissage +1', effect:{rangeBonus:1}},
      {name:'Colonie prolifique', cost:22, desc:'se propage, -15% besoin de nourriture', effect:{spread:true, foodNeedMult:0.85}}
    ]
  },
  cerf: {
    id:'cerf', name:'Cerf', emoji:'🦌', trophic:'herbivore',
    desc:'Robuste, tolère mieux la faim.',
    cost:{energy:18, biomass:10}, baseYield:0, foodNeed:22, range:1, efficiency:0.34,
    affinity:{plaine:1.0, foret:1.15, humide:1.0, rocheux:0.8, aride:0.6},
    resist:{drought:false, frost:true},
    unlockedByDefault:false,
    mutationPool:[
      {name:'Endurance', cost:10, desc:'tolère la faim plus longtemps', effect:{hungerToleranceBonus:5}},
      {name:'Ramure', cost:16, desc:'-30% de risque face aux menaces', effect:{predationResist:0.3}},
      {name:'Grand troupeau', cost:24, desc:'+25% conversion en biomasse', effect:{efficiencyMult:1.25}},
      {name:'Odorat affûté', cost:12, desc:'portée de nourrissage +1', effect:{rangeBonus:1}},
      {name:'Robustesse', cost:14, desc:'-20% besoin de nourriture', effect:{foodNeedMult:0.8}},
      {name:'Meneur de harde', cost:22, desc:'+20% conversion, tolère mieux la faim', effect:{efficiencyMult:1.2, hungerToleranceBonus:3}}
    ]
  },
  renard: {
    id:'renard', name:'Renard', emoji:'🦊', trophic:'predator',
    desc:'Chasse les herbivores voisins.',
    cost:{energy:16, biomass:8}, baseYield:0, foodNeed:8, range:1, efficiency:0.5,
    affinity:{plaine:1.0, foret:1.05, humide:0.9, rocheux:1.0, aride:0.8},
    resist:{drought:false, frost:false},
    rivalry:{loup:0.20, rapace:0.10},
    unlockedByDefault:true,
    mutationPool:[
      {name:'Odorat fin', cost:9, desc:'portée de chasse +1', effect:{rangeBonus:1}},
      {name:'Discrétion', cost:15, desc:'-25% besoin de nourriture', effect:{foodNeedMult:0.75}},
      {name:'Territoire', cost:22, desc:'éradique une invasion adjacente', effect:{cullsInvasion:true}},
      {name:'Poil d\'hiver', cost:11, desc:'immunisé au gel', effect:{resist:{frost:true}}},
      {name:'Chasseur solitaire', cost:17, desc:'+20% efficacité de chasse', effect:{efficiencyMult:1.2}},
      {name:'Territoire marqué', cost:24, desc:'portée +1, éradique les invasions', effect:{rangeBonus:1, cullsInvasion:true}}
    ]
  },
  loup: {
    id:'loup', name:'Loup', emoji:'🐺', trophic:'predator',
    desc:'Plus fort en meute.',
    cost:{energy:26, biomass:14}, baseYield:0, foodNeed:16, range:1, efficiency:0.46,
    affinity:{plaine:1.0, foret:1.1, humide:0.85, rocheux:1.05, aride:0.75},
    resist:{drought:false, frost:true},
    unlockedByDefault:false, pack:true,
    mutationPool:[
      {name:'Meute', cost:12, desc:'+30% efficacité si un autre loup est adjacent', effect:{packBonus:0.3}},
      {name:'Endurance hivernale', cost:18, desc:'immunisé au gel', effect:{resist:{frost:true}}},
      {name:'Chasse coordonnée', cost:26, desc:'éradique une invasion adjacente', effect:{cullsInvasion:true}},
      {name:'Crocs acérés', cost:13, desc:'+15% efficacité de chasse', effect:{efficiencyMult:1.15}},
      {name:'Meute soudée', cost:19, desc:'+20% bonus de meute, -10% besoin', effect:{packBonus:0.2, foodNeedMult:0.9}},
      {name:'Alpha', cost:27, desc:'portée +1, +20% efficacité', effect:{rangeBonus:1, efficiencyMult:1.2}}
    ]
  },
  rapace: {
    id:'rapace', name:'Rapace', emoji:'🦅', trophic:'predator',
    desc:'Longue portée (2 cases).',
    cost:{energy:24, biomass:12}, baseYield:0, foodNeed:10, range:2, efficiency:0.42,
    affinity:{plaine:1.05, foret:0.9, humide:1.0, rocheux:1.15, aride:1.0},
    resist:{drought:true, frost:false},
    unlockedByDefault:false,
    mutationPool:[
      {name:'Vol plané', cost:14, desc:'portée de chasse +1 (total 3)', effect:{rangeBonus:1}},
      {name:'Vue perçante', cost:20, desc:'-25% besoin de nourriture', effect:{foodNeedMult:0.75}},
      {name:'Serres acérées', cost:28, desc:'éradique une invasion à portée', effect:{cullsInvasion:true}},
      {name:'Plumage isolant', cost:15, desc:'immunisé au gel', effect:{resist:{frost:true}}},
      {name:'Vol silencieux', cost:21, desc:'+20% efficacité de chasse', effect:{efficiencyMult:1.2}},
      {name:'Reine des cieux', cost:30, desc:'portée +1, +15% efficacité', effect:{rangeBonus:1, efficiencyMult:1.15}}
    ]
  },
  champignon: {
    id:'champignon', name:'Champignon', emoji:'🍄', trophic:'decomposer',
    desc:'Régénère le sol, revit les friches, produit de la biomasse.',
    cost:{energy:8, biomass:0}, baseYield:0, foodNeed:0, range:1, biomassGain:1.6,
    affinity:{plaine:1.0, foret:1.2, humide:1.15, rocheux:0.8, aride:0.6},
    resist:{drought:false, frost:true},
    synergy:{arbre:0.18, ver:0.15},
    unlockedByDefault:true,
    mutationPool:[
      {name:'Mycélium étendu', cost:8, desc:'portée d\'action +1', effect:{rangeBonus:1}},
      {name:'Décomposition rapide', cost:14, desc:'régénère 2x plus vite, +biomasse', effect:{fertilityMult:2, biomassGainMult:1.6}},
      {name:'Réseau fongique', cost:22, desc:'réduit le stress global chaque saison', effect:{stressRelief:4}},
      {name:'Mycélium résistant', cost:9, desc:'résiste à la sécheresse', effect:{resist:{drought:true}}},
      {name:'Spores fertiles', cost:15, desc:'+40% biomasse produite', effect:{biomassGainMult:1.4}},
      {name:'Réseau tentaculaire', cost:23, desc:'portée +1, +30% fertilité apportée', effect:{rangeBonus:1, fertilityMult:1.3}}
    ]
  },
  ver: {
    id:'ver', name:'Ver de terre', emoji:'🪱', trophic:'decomposer',
    desc:'Discret, peu coûteux, bonne biomasse.',
    cost:{energy:6, biomass:0}, baseYield:0, foodNeed:0, range:1, biomassGain:1.3,
    affinity:{plaine:1.1, foret:1.05, humide:1.25, rocheux:0.5, aride:0.4},
    resist:{drought:false, frost:false},
    unlockedByDefault:false,
    mutationPool:[
      {name:'Aération du sol', cost:8, desc:'+50% fertilité apportée', effect:{fertilityMult:1.5}},
      {name:'Colonies profondes', cost:14, desc:'résiste à la sécheresse, +biomasse', effect:{resist:{drought:true}, biomassGainMult:1.5}},
      {name:'Symbiose', cost:20, desc:'+20% rendement aux producteurs voisins', effect:{pollinateBonus:0.2}},
      {name:'Galeries profondes', cost:9, desc:'portée d\'action +1', effect:{rangeBonus:1}},
      {name:'Digestion rapide', cost:15, desc:'+30% biomasse produite', effect:{biomassGainMult:1.3}},
      {name:'Bio-indicateur', cost:22, desc:'réduit le stress, +20% fertilité', effect:{stressRelief:3, fertilityMult:1.2}}
    ]
  }
};

var SPECIES_ORDER = ['herbe','fleur','arbre','cactus','lapin','cerf','renard','loup','rapace','champignon','ver'];

var BIOMES = {
  oasis: {
    id:'oasis', name:'Oasis', emoji:'🏞️', cost:0, rankReq:0, legacyMult:1.0,
    desc:'Tempéré et équilibré.',
    sunMult:1.0, waterRegen:16, threatMult:1.0,
    terrainWeights:{plaine:5, foret:3, humide:2, rocheux:1, aride:1}
  },
  desert: {
    id:'desert', name:'Désert', emoji:'🏜️', cost:30, rankReq:0, legacyMult:1.1,
    desc:'Peu d\'eau, sécheresses fréquentes.',
    sunMult:1.2, waterRegen:9, threatMult:1.15, droughtBias:2.2,
    terrainWeights:{aride:5, rocheux:3, plaine:2, foret:1, humide:1}
  },
  toundra: {
    id:'toundra', name:'Toundra', emoji:'🌨️', cost:40, rankReq:0, legacyMult:1.1,
    desc:'Hivers rudes, peu d\'incendies.',
    sunMult:0.8, waterRegen:14, threatMult:0.9, frostBias:2.2, fireDisabled:true,
    terrainWeights:{rocheux:4, plaine:3, foret:2, humide:2, aride:1}
  },
  jungle: {
    id:'jungle', name:'Jungle', emoji:'🌴', cost:50, rankReq:0, legacyMult:1.2,
    desc:'Croissance rapide, invasions agressives.',
    sunMult:1.1, waterRegen:20, threatMult:1.35, invasionBias:2.5,
    terrainWeights:{foret:5, humide:3, plaine:2, rocheux:1, aride:0}
  },
  volcan: {
    id:'volcan', name:'Volcan', emoji:'🌋', cost:70, rankReq:5, legacyMult:1.35,
    desc:'Risque maximal, +35% points d\'héritage.',
    sunMult:1.25, waterRegen:8, threatMult:1.5, droughtBias:1.6,
    terrainWeights:{aride:4, rocheux:4, plaine:1, foret:1, humide:0}
  },
  marais: {
    id:'marais', name:'Marais Profond', emoji:'🌫️', cost:90, rankReq:10, legacyMult:1.55,
    desc:'Le plus exigeant, +55% points d\'héritage.',
    sunMult:0.95, waterRegen:22, threatMult:1.4, invasionBias:2.0,
    terrainWeights:{humide:5, foret:3, plaine:1, rocheux:1, aride:0}
  }
};

var BIOME_ORDER = ['oasis','desert','toundra','jungle','volcan','marais'];

var IDEAL_RATIO = {producer:[0.50,0.72], herbivore:[0.14,0.30], predator:[0.04,0.16], decomposer:[0.05,0.18]};
