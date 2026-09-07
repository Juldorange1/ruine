// Dictionnaire anglais -> français de secours, 100% local (pas d'appel réseau/API).
// Sert de filet pour l'analyseur : quand un mot anglais est repéré dans la leçon mais qu'aucune
// traduction n'est donnée à côté, on peut quand même proposer un sens grâce à ce dictionnaire
// plutôt que de laisser le mot disparaître silencieusement. Couvre le vocabulaire courant de
// lycée (vie quotidienne, environnement, technologie, salle de classe...).
// Les clés à plusieurs mots (ex: "pencil case") sont cherchées en priorité, avant les mots seuls.
(function (global) {
  'use strict';

  const DICTIONARY = {
    // --- Vie quotidienne / objets ---
    apple: 'pomme', book: 'livre', computer: 'ordinateur', phone: 'téléphone', car: 'voiture',
    house: 'maison', home: 'maison', tree: 'arbre', water: 'eau', money: 'argent', job: 'travail / emploi',
    country: 'pays', world: 'monde', city: 'ville', town: 'ville (petite)', friend: 'ami',
    family: 'famille', parents: 'parents', time: 'temps', weather: 'météo', rain: 'pluie', sun: 'soleil',
    snow: 'neige', wind: 'vent', food: 'nourriture', bread: 'pain', animal: 'animal', dog: 'chien',
    cat: 'chat', bird: 'oiseau', fish: 'poisson', sea: 'mer', ocean: 'océan', mountain: 'montagne',
    island: 'île', river: 'rivière', forest: 'forêt', fire: 'feu', ice: 'glace', earth: 'terre',
    star: 'étoile', moon: 'lune', sky: 'ciel', bridge: 'pont', road: 'route', train: 'train',
    plane: 'avion', boat: 'bateau', ship: 'navire', bike: 'vélo', bicycle: 'vélo', door: 'porte',
    window: 'fenêtre', key: 'clé', clock: 'horloge', bag: 'sac', pen: 'stylo', pencil: 'crayon',
    letter: 'lettre', mail: 'courrier', gift: 'cadeau', present: 'cadeau', birthday: 'anniversaire',
    party: 'fête', market: 'marché', shop: 'magasin', store: 'magasin', bank: 'banque', prison: 'prison',
    police: 'police', fireman: 'pompier', soldier: 'soldat', farmer: 'agriculteur', farm: 'ferme',
    egg: 'œuf', milk: 'lait', meat: 'viande', vegetable: 'légume', fruit: 'fruit', cheese: 'fromage',
    baby: 'bébé', child: 'enfant', man: 'homme', woman: 'femme', people: 'gens', crowd: 'foule',
    heart: 'cœur', brain: 'cerveau', hand: 'main', eye: 'œil', ear: 'oreille', mouth: 'bouche',
    news: 'informations', newspaper: 'journal', radio: 'radio', television: 'télévision',
    camera: 'appareil photo', picture: 'image', photo: 'photo', map: 'carte', flag: 'drapeau',

    // --- École / salle de classe ---
    school: 'école', teacher: 'professeur', student: 'élève', highlighter: 'surligneur',
    ruler: 'règle', rubber: 'gomme', eraser: 'gomme', scissors: 'ciseaux', glue: 'colle',
    stapler: 'agrafeuse', textbook: 'manuel', notebook: 'cahier', timetable: "emploi du temps",
    break: 'récréation', playground: "cour de récréation", classmate: 'camarade de classe',
    subject: 'matière', exam: 'examen', test: 'contrôle', mark: 'note', grade: 'note',
    lesson: 'leçon', term: 'trimestre', holiday: 'vacances', whiteboard: 'tableau blanc',
    blackboard: 'tableau noir', chalk: 'craie', desk: 'bureau', chair: 'chaise',
    classroom: 'salle de classe', library: 'bibliothèque', canteen: 'cantine', uniform: 'uniforme',
    backpack: 'sac à dos', calculator: 'calculatrice', folder: 'classeur', marker: 'marqueur',
    homework: 'devoirs', headteacher: 'proviseur', principal: 'proviseur',
    'pencil case': 'trousse', 'exercise book': 'cahier',

    // --- Société / environnement / politique ---
    environment: 'environnement', pollution: 'pollution', nature: 'nature', technology: 'technologie',
    internet: 'internet', war: 'guerre', peace: 'paix', freedom: 'liberté', law: 'loi', health: 'santé',
    hospital: 'hôpital', doctor: 'médecin', sport: 'sport', music: 'musique', film: 'film',
    movie: 'film', king: 'roi', queen: 'reine', castle: 'château', president: 'président',
    government: 'gouvernement', election: 'élection', congress: 'congrès', court: 'tribunal',
    jury: 'jury', slave: 'esclave', slavery: 'esclavage', immigrant: 'immigré', border: 'frontière',
    wall: 'mur', desert: 'désert', beach: 'plage', jungle: 'jungle', space: 'espace', rocket: 'fusée',
    planet: 'planète', robot: 'robot', factory: 'usine', energy: 'énergie', electricity: 'électricité',
    battery: 'batterie', trash: 'déchets', waste: 'déchets', climate: 'climat', drought: 'sécheresse',
    flood: 'inondation', storm: 'tempête', hurricane: 'ouragan', earthquake: 'tremblement de terre',
    volcano: 'volcan', team: 'équipe', game: 'jeu', race: 'course',

    // --- Adjectifs courants ---
    aware: 'conscient', sure: 'sûr', glad: 'content', afraid: 'effrayé', alone: 'seul',
    alive: 'vivant', asleep: 'endormi', fond: 'affectueux', fit: 'en forme', ill: 'malade',
    well: 'bien / en bonne santé', kind: 'gentil', fair: 'juste / équitable', cheap: 'bon marché',
    rare: 'rare', keen: 'passionné', calm: 'calme', proud: 'fier', brave: 'courageux', rich: 'riche',
    poor: 'pauvre', tired: 'fatigué', bored: 'ennuyé', angry: 'en colère', sad: 'triste',
    happy: 'heureux', young: 'jeune', old: 'vieux', big: 'grand', small: 'petit', hot: 'chaud',
    cold: 'froid', hard: 'dur', soft: 'doux', strong: 'fort', weak: 'faible', safe: 'sûr',
    clean: 'propre', sick: 'malade',

    // --- Verbes courants (réguliers, pas déjà couverts par les verbes irréguliers) ---
    'to help': 'aider', 'to want': 'vouloir', 'to like': 'aimer bien', 'to need': 'avoir besoin de',
    'to try': 'essayer', 'to hope': 'espérer', 'to believe': 'croire', 'to decide': 'décider',
    'to explain': 'expliquer', 'to arrive': 'arriver', 'to travel': 'voyager', 'to visit': 'visiter',
    'to enjoy': 'apprécier', 'to worry': "s'inquiéter", 'to agree': "être d'accord",
    'to improve': 'améliorer', 'to succeed': 'réussir', 'to fail': 'échouer', 'to protect': 'protéger',
    'to pollute': 'polluer', 'to recycle': 'recycler', 'to save': 'sauver / économiser',
    'to waste': 'gaspiller', 'to share': 'partager', 'to create': 'créer', 'to develop': 'développer',
    'to discover': 'découvrir', 'to invent': 'inventer', 'to describe': 'décrire',
    'to compare': 'comparer', 'to imagine': 'imaginer', 'to prepare': 'préparer',
    'to organize': 'organiser', 'to celebrate': 'célébrer', 'to complain': 'se plaindre',
    'to apologize': "s'excuser", 'to warn': 'avertir', 'to advise': 'conseiller',
    'to suggest': 'suggérer', 'to refuse': 'refuser', 'to accept': 'accepter',
    'to allow': 'permettre', 'to prevent': 'empêcher', 'to reduce': 'réduire', 'to increase': 'augmenter',
  };

  // Clés multi-mots, les plus longues d'abord (pour matcher "pencil case" avant "pencil").
  const PHRASE_KEYS = Object.keys(DICTIONARY).filter((k) => k.includes(' ')).sort((a, b) => b.length - a.length);

  // Index des verbes sans le "to" (ex: "help" -> "aider"), pour retrouver "help" tout seul
  // dans le texte alors que la clé du dictionnaire est "to help".
  const BARE_VERB_INDEX = {};
  Object.keys(DICTIONARY).forEach((k) => {
    if (k.startsWith('to ')) BARE_VERB_INDEX[k.slice(3)] = DICTIONARY[k];
  });

  // Retourne {fr, isVerb} ou null. isVerb=true si le mot n'a été trouvé que via sa forme "to ...".
  function lookup(word) {
    const w = (word || '').toLowerCase();
    if (DICTIONARY[w]) return { fr: DICTIONARY[w], isVerb: false };
    if (BARE_VERB_INDEX[w]) return { fr: BARE_VERB_INDEX[w], isVerb: true };
    return null;
  }

  global.Dictionary = { DICTIONARY, PHRASE_KEYS, lookup };
})(window);
