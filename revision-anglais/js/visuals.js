// Mémoire visuelle : associe un emoji concret quand c'est possible, sinon une astuce
// mnémotechnique générique. Rien n'est téléchargé : tout est local et instantané.
(function (global) {
  'use strict';

  // Dictionnaire volontairement large de vocabulaire concret de lycée -> emoji.
  const EMOJI_DICT = {
    apple: '🍎', book: '📕', school: '🏫', teacher: '🧑‍🏫', student: '🧑‍🎓', computer: '💻',
    phone: '📱', car: '🚗', house: '🏠', home: '🏠', tree: '🌳', water: '💧', run: '🏃',
    eat: '🍽️', sleep: '😴', happy: '😊', sad: '😢', angry: '😠', afraid: '😨', scared: '😱',
    money: '💰', work: '💼', job: '💼', travel: '✈️', country: '🌍', world: '🌍', city: '🏙️',
    town: '🏘️', environment: '🌱', pollution: '🏭', nature: '🌿', technology: '🤖',
    internet: '🌐', friend: '🧑‍🤝‍🧑', family: '👨‍👩‍👧', parents: '👨‍👩‍👧', time: '⏰',
    weather: '🌦️', rain: '🌧️', sun: '☀️', snow: '❄️', wind: '💨', food: '🍔', bread: '🍞',
    animal: '🐾', dog: '🐕', cat: '🐈', bird: '🐦', fish: '🐟', sea: '🌊', ocean: '🌊',
    mountain: '⛰️', war: '⚔️', peace: '☮️', freedom: '🕊️', law: '⚖️', health: '🏥',
    hospital: '🏥', doctor: '🩺', sport: '⚽', music: '🎵', film: '🎬', movie: '🎬',
    king: '👑', queen: '👑', castle: '🏰', island: '🏝️', river: '🏞️', forest: '🌲',
    fire: '🔥', ice: '🧊', earth: '🌎', star: '⭐', moon: '🌙', sky: '🌌', bridge: '🌉',
    road: '🛣️', train: '🚆', plane: '✈️', boat: '⛵', ship: '🚢', bike: '🚲', bicycle: '🚲',
    door: '🚪', window: '🪟', key: '🔑', clock: '🕒', bag: '🎒', pen: '🖊️', pencil: '✏️',
    letter: '✉️', mail: '📧', gift: '🎁', present: '🎁', birthday: '🎂', party: '🎉',
    market: '🏪', shop: '🏪', store: '🏪', hospital2: '🏥', bank: '🏦', prison: '🚔',
    police: '👮', fireman: '🧑‍🚒', soldier: '🪖', farmer: '👨‍🌾', farm: '🚜',
    egg: '🥚', milk: '🥛', meat: '🥩', vegetable: '🥦', fruit: '🍇', cheese: '🧀',
    cold: '🥶', hot: '🥵', tired: '🥱', sick: '🤒', ill: '🤒', strong: '💪',
    baby: '👶', child: '🧒', man: '👨', woman: '👩', people: '👥', crowd: '👥',
    heart: '❤️', brain: '🧠', hand: '✋', eye: '👁️', ear: '👂', mouth: '👄',
    news: '📰', newspaper: '📰', radio: '📻', television: '📺', camera: '📷',
    picture: '🖼️', photo: '📷', map: '🗺️', flag: '🚩', vote: '🗳️', president: '🎩',
    government: '🏛️', election: '🗳️', congress: '🏛️', court: '⚖️', jury: '⚖️',
    slave: '⛓️', slavery: '⛓️', immigrant: '🧳', border: '🚧', wall: '🧱',
    desert: '🏜️', beach: '🏖️', jungle: '🌴', space: '🚀', rocket: '🚀', planet: '🪐',
    robot: '🤖', factory: '🏭', energy: '⚡', electricity: '⚡', battery: '🔋',
    recycle: '♻️', trash: '🗑️', waste: '🗑️', climate: '🌡️', drought: '🏜️',
    flood: '🌊', storm: '⛈️', hurricane: '🌀', earthquake: '🌍', volcano: '🌋',
    laugh: '😂', cry: '😭', smile: '🙂', dream: '💭', think: '🤔', speak: '🗣️',
    listen: '👂', write: '✍️', read: '📖', watch: '👀', look: '👀', see: '👀',
    walk: '🚶', jump: '🤸', swim: '🏊', dance: '💃', sing: '🎤', play: '🎮',
    fight: '🥊', win: '🏆', lose: '📉', race: '🏁', team: '🧑‍🤝‍🧑', game: '🎮',
  };

  // Faux amis fréquents en lycée : astuce toute faite, plus fiable qu'une génération auto.
  const FALSE_FRIENDS = {
    'actually': "« actually » = EN FAIT (pas « actuellement » qui se dit *currently*).",
    'eventually': "« eventually » = FINALEMENT (pas « éventuellement » qui se dit *possibly*).",
    'library': "« library » = BIBLIOTHÈQUE (pas « librairie » qui se dit *bookshop*).",
    'sensible': "« sensible » = RAISONNABLE, SENSÉ (pas « sensible » qui se dit *sensitive*).",
    'achieve': "« achieve » = ATTEINDRE/ACCOMPLIR (pas « acheter »). Retiens : achieve a goal.",
    'large': "« large » = GRAND (taille), pas « large » (largeur) qui se dit *wide*.",
    'attend': "« attend » = ASSISTER À (pas « attendre » qui se dit *wait for*).",
    'assist': "« assist » = AIDER (pas « assister à » qui se dit *attend*).",
    'deception': "« deception » = TROMPERIE (pas « déception » qui se dit *disappointment*).",
    'ignore': "« ignore » = NE PAS TENIR COMPTE DE (pas « ignorer une info » qui peut se dire *not know*).",
    'pretend': "« pretend » = FAIRE SEMBLANT (pas « prétendre » qui se dit *claim*).",
    'resume': "« resume » = REPRENDRE (pas « résumé » qui se dit *summary*).",
    'lecture': "« lecture » = COURS MAGISTRAL (pas « lecture » qui se dit *reading*).",
    'location': "« location » = EMPLACEMENT (pas « location » qui se dit *rental*).",
    'journey': "« journey » = TRAJET/VOYAGE (pas « journée » qui se dit *day*).",
    'novel': "« novel » = ROMAN (pas « nouvelle » qui se dit *short story*).",
    'coin': "« coin » = PIÈCE DE MONNAIE (pas « coin » qui se dit *corner*).",
    'cave': "« cave » = GROTTE (pas « cave » qui se dit *cellar*).",
    'injure': "« injure » = BLESSER (pas « injurier » qui se dit *insult*).",
    'agenda': "« agenda » = ORDRE DU JOUR (pas « agenda/calendrier » qui se dit *diary*).",
    'sympathetic': "« sympathetic » = COMPATISSANT (pas « sympa » qui se dit *nice/friendly*).",
    'chair': "« chair » = CHAISE (pas « chair » (peau) qui se dit *flesh*).",
    'car': "« car » = VOITURE (pas « car » (bus) qui se dit *coach*).",
    'grief': "« grief » = CHAGRIN/DEUIL (pas « grief » qui se dit *grievance*).",
    'apology': "« apology » = EXCUSES (pas « apologie » qui se dit *praise/glorification*).",
  };

  // Emoji par défaut selon la catégorie, pour les mots abstraits sans image évidente.
  const CATEGORY_ICON = {
    verb: '⚡', phrasal_verb: '🧩', adjective: '🎭', noun: '🔷', expression: '💬',
    grammar_rule: '📐', example_sentence: '📝', false_friend: '⚠️', culture: '🏛️',
    phrase_to_produce: '✍️', vocab: '🔷',
  };

  function normalize(word) {
    return (word || '').toLowerCase().replace(/^to\s+/, '').replace(/[^a-z]/g, '');
  }

  function findEmoji(en) {
    const norm = normalize(en);
    if (EMOJI_DICT[norm]) return EMOJI_DICT[norm];
    // essaie chaque mot d'une expression multi-mots
    const words = (en || '').toLowerCase().split(/\s+/);
    for (const w of words) {
      const nw = w.replace(/[^a-z]/g, '');
      if (EMOJI_DICT[nw]) return EMOJI_DICT[nw];
    }
    return null;
  }

  // Découpe grossière en "syllabes" pour une astuce de mémorisation par blocs.
  function chunk(word) {
    const w = (word || '').replace(/^to\s+/, '');
    const parts = w.match(/[^aeiouy]*[aeiouy]+(?:[^aeiouy]*$)?/gi) || [w];
    return parts.filter(Boolean).join(' · ');
  }

  function buildVisual(item) {
    const norm = normalize(item.en);
    const emoji = findEmoji(item.en);
    if (emoji) {
      return { emoji, kind: 'image', mnemonic: `${emoji} associe directement « ${item.en} » à cette image.` };
    }
    const icon = CATEGORY_ICON[item.type] || '🔷';
    if (FALSE_FRIENDS[norm]) {
      return { emoji: '⚠️', kind: 'false_friend', mnemonic: FALSE_FRIENDS[norm] };
    }
    return {
      emoji: icon,
      kind: 'association',
      mnemonic: `Découpe le mot pour le retenir : ${chunk(item.en)} — répète-le 3 fois à voix haute en pensant à « ${item.fr} ».`,
    };
  }

  function getFalseFriendTip(en) {
    return FALSE_FRIENDS[normalize(en)] || null;
  }

  global.Visuals = { buildVisual, getFalseFriendTip, EMOJI_DICT, FALSE_FRIENDS };
})(window);
