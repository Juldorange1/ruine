// Bâtiments, économie (or), expéditions à risque.

var BUILDINGS = {
  reservoir: {
    id:'reservoir', name:'Réservoir', emoji:'🛢️', trophic:'building',
    cost:{energy:20, biomass:10, gold:0}, upkeep:{gold:0},
    unlockedByDefault:true,
    desc:'+8 eau. Adoucit la sécheresse à portée 2.'
  },
  marche: {
    id:'marche', name:'Marché', emoji:'🏪', trophic:'building',
    cost:{energy:18, biomass:14, gold:0}, upkeep:{gold:2},
    unlockedByDefault:true,
    desc:'Génère de l\'or chaque saison.'
  },
  labo: {
    id:'labo', name:'Laboratoire', emoji:'🔬', trophic:'building',
    cost:{energy:26, biomass:16, gold:10}, upkeep:{gold:3},
    unlockedByDefault:false,
    desc:'Génère des points génétiques.'
  },
  rempart: {
    id:'rempart', name:'Rempart', emoji:'🧱', trophic:'building',
    cost:{energy:22, biomass:20, gold:6}, upkeep:{gold:1},
    unlockedByDefault:false,
    desc:'Immunisé au feu/invasions, coupe leur propagation.'
  },
  tour: {
    id:'tour', name:'Tour de guet', emoji:'🗼', trophic:'building',
    cost:{energy:24, biomass:12, gold:8}, upkeep:{gold:2},
    unlockedByDefault:false,
    desc:'Révèle le territoire, réduit les menaces.'
  }
};
var BUILDING_ORDER = ['reservoir','marche','labo','rempart','tour'];

function buildingBaseCostMult(id){
  var count = 0;
  for (var key in G.tiles){ if (G.tiles[key].building === id) count++; }
  return 1 + count*0.35;
}
function buildingCost(id){
  var b = BUILDINGS[id];
  var mult = buildingBaseCostMult(id);
  return {
    energy: Math.round(b.cost.energy*mult),
    biomass: Math.round(b.cost.biomass*mult),
    gold: Math.round(b.cost.gold*mult)
  };
}

var EXPEDITIONS = {
  unique: {
    id:'unique', name:'Expédition', emoji:'🧭', cost:{gold:25}, chance:0.55,
    desc:'Gros gain si succès, mise perdue et risque d\'incident si échec.'
  }
};
