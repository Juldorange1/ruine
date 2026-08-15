// État global + économie + achats + évolutions + améliorations + doubleurs.
// (especeParNom/zoneParId vivent dans data.js, à côté du bestiaire généré.)

const SAVE_KEY = 'bestiaire_save_v3';
const MAX_JOURNAL = 40;

const CROISSANCE_PRIX_ZONE = 1.3; // +30% de prix par créature déjà possédée dans la zone
const EVOLUTION_MULT = 3;         // le revenu triple à chaque évolution
const EVOLUTION_STADE_MAX = 2;    // 3 formes au total : 0, 1, 2
const DOUBLEUR_INTERVALLE = 60;   // secondes entre deux doubleurs gratuits

let etat = null;
let idCreatureCompteur = 1;

function tirerEspecePonderee(zoneId) {
  const zone = zoneParId(zoneId);
  const total = zone.especes.reduce((s, e) => s + POIDS_RARETE[e.rarete], 0);
  let tirage = Math.random() * total;
  for (const e of zone.especes) {
    tirage -= POIDS_RARETE[e.rarete];
    if (tirage <= 0) return e.nom;
  }
  return zone.especes[0].nom;
}

function rollOffres(zoneId) {
  const noms = [];
  let garde = 0;
  while (noms.length < 3 && garde < 50) {
    garde++;
    const nom = tirerEspecePonderee(zoneId);
    if (!noms.includes(nom)) noms.push(nom);
  }
  while (noms.length < 3) noms.push(tirerEspecePonderee(zoneId));
  return noms;
}

function etatInitial() {
  const zones = {};
  for (const z of ZONES) {
    zones[z.id] = {
      creatures: [],
      offres: rollOffres(z.id),
      multiplicateurDoubleur: 1,
    };
  }
  return {
    argent: 30,
    doubleurs: 0,
    doubleursAchetesTotal: 0,
    prochainDoubleurDans: DOUBLEUR_INTERVALLE,
    ameliorations: { multGlobal: 0, gainIndividuel: 0, reductionPrix: 0 },
    zones,
    journal: [{ texte: 'Le bestiaire s\'éveille. Recrute tes premières créatures gratuitement dans chaque zone.', ts: Date.now() }],
  };
}

function ajouterJournal(texte) {
  etat.journal.unshift({ texte, ts: Date.now() });
  if (etat.journal.length > MAX_JOURNAL) etat.journal.length = MAX_JOURNAL;
}

// ---- Prix ----

function reductionPrixActuelle() {
  return Math.min(0.70, etat.ameliorations.reductionPrix * 0.05);
}

function coutAchat(zoneId, espece) {
  const zone = etat.zones[zoneId];
  if (zone.creatures.length === 0) return 0;
  const escalade = Math.pow(CROISSANCE_PRIX_ZONE, zone.creatures.length - 1);
  return Math.round(espece.prix * escalade * (1 - reductionPrixActuelle()));
}

function acheterCreature(zoneId, offreIndex) {
  const zone = etat.zones[zoneId];
  const nomEspece = zone.offres[offreIndex];
  const espece = especeParNom(zoneId, nomEspece);
  if (!espece) return { ok: false, raison: 'Espèce introuvable.' };
  const cout = coutAchat(zoneId, espece);
  if (cout > 0 && etat.argent < cout) {
    return { ok: false, raison: 'Pas assez d\'argent.' };
  }
  const gratuit = cout === 0;
  etat.argent -= cout;
  zone.creatures.push({
    id: idCreatureCompteur++,
    nom: espece.nom,
    art: espece.art,
    prixOrigine: espece.prix,
    revenuBase: espece.revenu,
    rarete: espece.rarete,
    stade: 0,
  });
  zone.offres = rollOffres(zoneId);
  ajouterJournal(`${gratuit ? 'Recrutement gratuit' : 'Achat'} : ${espece.nom} rejoint la zone ${zoneParId(zoneId).nom}.`);
  sauvegarder();
  return { ok: true };
}

// ---- Évolution ----

function coutEvolution(creature) {
  return Math.round(creature.prixOrigine * 7 * Math.pow(2.5, creature.stade));
}

function evoluerCreature(zoneId, creatureId) {
  const zone = etat.zones[zoneId];
  const creature = zone.creatures.find(c => c.id === creatureId);
  if (!creature) return { ok: false, raison: 'Créature introuvable.' };
  if (creature.stade >= EVOLUTION_STADE_MAX) return { ok: false, raison: 'Déjà à sa forme finale.' };
  const cout = coutEvolution(creature);
  if (etat.argent < cout) return { ok: false, raison: 'Pas assez d\'argent.' };
  etat.argent -= cout;
  creature.stade++;
  creature.art = genererApparence(creature.nom, zoneParId(zoneId).hue, creature.stade);
  ajouterJournal(`✨ ${creature.nom} évolue (forme ${creature.stade + 1}) dans la zone ${zoneParId(zoneId).nom} !`);
  sauvegarder();
  return { ok: true };
}

// ---- Revenu ----

function bonusIndividuelActuel() {
  return etat.ameliorations.gainIndividuel * 0.05;
}

function multiplicateurGlobalActuel() {
  return 1 + etat.ameliorations.multGlobal * 0.10;
}

function revenuCreature(c) {
  return c.revenuBase * Math.pow(EVOLUTION_MULT, c.stade) + bonusIndividuelActuel();
}

function revenuBrutZone(zoneId) {
  const zone = etat.zones[zoneId];
  const base = zone.creatures.reduce((s, c) => s + revenuCreature(c), 0);
  return base * zone.multiplicateurDoubleur;
}

function revenuParSeconde(zoneId) {
  return revenuBrutZone(zoneId) * multiplicateurGlobalActuel();
}

function revenuTotalParSeconde() {
  return ZONES.reduce((s, z) => s + revenuParSeconde(z.id), 0);
}

// ---- Doubleurs ----

function utiliserDoubleur(zoneId) {
  if (etat.doubleurs <= 0) return { ok: false, raison: 'Aucun doubleur disponible.' };
  etat.doubleurs--;
  const zone = etat.zones[zoneId];
  zone.multiplicateurDoubleur *= 2;
  ajouterJournal(`🎟️ Doubleur utilisé sur la zone ${zoneParId(zoneId).nom} (revenu ×${zone.multiplicateurDoubleur}).`);
  sauvegarder();
  return { ok: true };
}

function coutDoubleurAchat() {
  return Math.round(400 * Math.pow(1.6, etat.doubleursAchetesTotal));
}

function acheterDoubleur() {
  const cout = coutDoubleurAchat();
  if (etat.argent < cout) return { ok: false, raison: 'Pas assez d\'argent.' };
  etat.argent -= cout;
  etat.doubleurs++;
  etat.doubleursAchetesTotal++;
  ajouterJournal(`🎟️ Doubleur acheté (${formatNombre(cout)} €).`);
  sauvegarder();
  return { ok: true };
}

// ---- Améliorations ----

const NIVEAU_MAX_REDUCTION = 14; // 14 * 5% = 70%, le plafond de reductionPrixActuelle()

function coutAmelioration(type) {
  const n = etat.ameliorations[type];
  if (type === 'multGlobal') return Math.round(150 * Math.pow(1.5, n));
  if (type === 'gainIndividuel') return Math.round(120 * Math.pow(1.45, n));
  if (type === 'reductionPrix') return n >= NIVEAU_MAX_REDUCTION ? null : Math.round(300 * Math.pow(1.8, n));
  return null;
}

function acheterAmelioration(type) {
  const cout = coutAmelioration(type);
  if (cout === null) return { ok: false, raison: 'Amélioration au maximum.' };
  if (etat.argent < cout) return { ok: false, raison: 'Pas assez d\'argent.' };
  etat.argent -= cout;
  etat.ameliorations[type]++;
  ajouterJournal(`📈 Amélioration renforcée : ${type} (niveau ${etat.ameliorations[type]}).`);
  sauvegarder();
  return { ok: true };
}

// ---- Utilitaires ----

function formatNombre(n) {
  const neg = n < 0;
  n = Math.abs(n);
  let s;
  if (n >= 1e12) s = (n / 1e12).toFixed(2) + 'T';
  else if (n >= 1e9) s = (n / 1e9).toFixed(2) + 'Md';
  else if (n >= 1e6) s = (n / 1e6).toFixed(2) + 'M';
  else if (n >= 1e3) s = (n / 1e3).toFixed(2) + 'k';
  else s = n.toFixed(n < 10 ? 1 : 0);
  return (neg ? '-' : '') + s;
}

function sauvegarder() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ etat, idCreatureCompteur }));
  } catch (e) { /* stockage indisponible, on ignore */ }
}

function charger() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || !data.etat) return false;
    etat = data.etat;
    idCreatureCompteur = data.idCreatureCompteur || 1;
    for (const z of ZONES) {
      if (!etat.zones[z.id]) {
        etat.zones[z.id] = { creatures: [], offres: rollOffres(z.id), multiplicateurDoubleur: 1 };
      }
    }
    return true;
  } catch (e) {
    return false;
  }
}

function reinitialiser() {
  etat = etatInitial();
  sauvegarder();
}

function initJeu() {
  if (!charger()) {
    etat = etatInitial();
    sauvegarder();
  }
}
