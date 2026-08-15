// Données : zones + bestiaire généré procéduralement (noms, stats, apparence SVG).
// Génération déterministe (même résultat à chaque chargement) via des banques de mots +
// creatureArt.js — un grand bestiaire 100% original, sans emoji et sans rien recopier
// d'un univers existant. Chaque espèce n'a que 2 stats : son prix et son revenu €/s
// (le combat n'existe plus — seules l'économie et l'évolution comptent).

const ESPECES_PAR_ZONE = 24;

// Poids de tirage de la boutique par rareté (plus c'est rare, plus c'est improbable)
const POIDS_RARETE = { 1: 60, 2: 30, 3: 10 };

const PLAGES_TIER = {
  1: { prix: [12, 26], revenu: [0.12, 0.26] },
  2: { prix: [40, 65], revenu: [0.35, 0.55] },
  3: { prix: [110, 160], revenu: [1.0, 1.7] },
};

function melange(min, max, rng) {
  return min + rng() * (max - min);
}

// Parcourt les diagonales de la grille préfixes×suffixes plutôt que ligne par ligne, pour
// mélanger les combinaisons dès le début (au lieu d'épuiser un seul préfixe avant de changer).
function genererNoms(prefixes, suffixes, count) {
  const noms = [];
  const vus = new Set();
  const P = prefixes.length, S = suffixes.length;
  for (let k = 0; k < P + S - 1 && noms.length < count; k++) {
    for (let p = 0; p < P && noms.length < count; p++) {
      const s = k - p;
      if (s < 0 || s >= S) continue;
      const nom = prefixes[p] + suffixes[s];
      if (!vus.has(nom)) { vus.add(nom); noms.push(nom); }
    }
  }
  return noms;
}

function genererEspeces(zoneId, hue, prefixes, suffixes) {
  const noms = genererNoms(prefixes, suffixes, ESPECES_PAR_ZONE);
  const cycleTier = [1, 1, 1, 1, 1, 2, 2, 3];
  return noms.map((nom, i) => {
    const rng = mulberry32(hashString(zoneId + '::' + nom));
    const tier = cycleTier[i % cycleTier.length];
    const plage = PLAGES_TIER[tier];
    return {
      nom,
      rarete: tier,
      prix: Math.round(melange(plage.prix[0], plage.prix[1], rng)),
      revenu: Math.round(melange(plage.revenu[0], plage.revenu[1], rng) * 100) / 100,
      art: genererApparence(nom, hue, 0),
    };
  });
}

const ZONES = [
  {
    id: 'ciel',
    nom: 'Ciel',
    icone: '🌤️',
    ambiance: 'Des courants d\'air balaient la réserve à ciel ouvert.',
    hue: 205,
    especes: genererEspeces('ciel', 205,
      ['Pluma', 'Aéro', 'Nimb', 'Zéphy', 'Strato', 'Vent', 'Cirri', 'Alti'],
      ['ion', 'aile', 'ral', 'rin', 'ix', 'ombre', 'atros', 'ouette']),
  },
  {
    id: 'terre',
    nom: 'Terre',
    icone: '🌾',
    ambiance: 'Une plaine poussiéreuse cerne le coffre enterré au centre.',
    hue: 32,
    especes: genererEspeces('terre', 32,
      ['Rocail', 'Argil', 'Racin', 'Cact', 'Scarab', 'Grani', 'Boueux', 'Terro'],
      ['ours', 'épic', 'tortue', 'sanglier', 'orc', 'ide', 'ax', 'nasse']),
  },
  {
    id: 'mer',
    nom: 'Mer',
    icone: '🌊',
    ambiance: 'La houle roule autour d\'un récif où repose ta cagnotte.',
    hue: 178,
    especes: genererEspeces('mer', 178,
      ['Aqua', 'Corail', 'Abyss', 'Marémo', 'Perli', 'Lagon', 'Écum', 'Sirén'],
      ['ette', 'requin', 'méduse', 'clair', 'ide', 'dauphin', 'écaille', 'ondin']),
  },
  {
    id: 'souterrain',
    nom: 'Souterrain',
    icone: '🕳️',
    ambiance: 'Des galeries obscures serpentent jusqu\'à la salle du trésor.',
    hue: 272,
    especes: genererEspeces('souterrain', 272,
      ['Vermi', 'Chauv', 'Aragn', 'Scorp', 'Taup', 'Golem', 'Spéléo', 'Obscur'],
      ['gnon', 'sonic', 'oin', 'inuit', 'inoire', 'terreux', 'ide', 'ophile']),
  },
];

function especeParNom(zoneId, nom) {
  const zone = ZONES.find(z => z.id === zoneId);
  return zone.especes.find(e => e.nom === nom);
}

function zoneParId(zoneId) {
  return ZONES.find(z => z.id === zoneId);
}
