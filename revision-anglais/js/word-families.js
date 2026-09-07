// Familles de mots à apprendre "en bloc" : verbes irréguliers (base/prétérit/participe) et
// comparatifs irréguliers (base/comparatif/superlatif). L'idée : si UNE SEULE des formes
// distinctives (ex: "went" ou "gone") apparaît n'importe où dans la leçon — même loin de "go",
// même dans une phrase d'exemple —, on reconnaît que la leçon parle de ce verbe et on
// regroupe ses formes en un seul élément révisable, plutôt que de créer 2-3 mots isolés
// sans rapport entre eux.
(function (global) {
  'use strict';

  // [base, prétérit, participe passé, sens principal en français]
  const VERB_LIST = [
    ['go','went','gone','aller'], ['come','came','come','venir'], ['see','saw','seen','voir'],
    ['take','took','taken','prendre'], ['give','gave','given','donner'], ['get','got','got','obtenir / avoir'],
    ['make','made','made','faire / fabriquer'], ['know','knew','known','savoir / connaître'],
    ['think','thought','thought','penser'], ['find','found','found','trouver'], ['tell','told','told','dire / raconter'],
    ['become','became','become','devenir'], ['show','showed','shown','montrer'], ['leave','left','left','partir / laisser'],
    ['feel','felt','felt','sentir / ressentir'], ['bring','brought','brought','apporter'],
    ['begin','began','begun','commencer'], ['keep','kept','kept','garder'], ['hold','held','held','tenir'],
    ['write','wrote','written','écrire'], ['stand','stood','stood','se tenir debout'], ['hear','heard','heard','entendre'],
    ['let','let','let','laisser / permettre'], ['mean','meant','meant','signifier'], ['set','set','set','poser / régler'],
    ['meet','met','met','rencontrer'], ['run','ran','run','courir'], ['pay','paid','paid','payer'],
    ['sit','sat','sat',"s'asseoir"], ['speak','spoke','spoken','parler'], ['lie','lay','lain','être allongé'],
    ['lead','led','led','mener / diriger'], ['read','read','read','lire'], ['grow','grew','grown','grandir / cultiver'],
    ['lose','lost','lost','perdre'], ['fall','fell','fallen','tomber'], ['send','sent','sent','envoyer'],
    ['build','built','built','construire'], ['understand','understood','understood','comprendre'],
    ['draw','drew','drawn','dessiner / tirer'], ['break','broke','broken','casser'], ['spend','spent','spent','dépenser / passer (temps)'],
    ['cut','cut','cut','couper'], ['rise','rose','risen',"se lever / s'élever"], ['drive','drove','driven','conduire'],
    ['buy','bought','bought','acheter'], ['wear','wore','worn','porter (vêtement)'], ['choose','chose','chosen','choisir'],
    ['catch','caught','caught','attraper'], ['fight','fought','fought','se battre'], ['teach','taught','taught','enseigner'],
    ['sing','sang','sung','chanter'], ['fly','flew','flown','voler (avion / oiseau)'], ['eat','ate','eaten','manger'],
    ['drink','drank','drunk','boire'], ['forget','forgot','forgotten','oublier'], ['sell','sold','sold','vendre'],
    ['throw','threw','thrown','jeter / lancer'], ['shoot','shot','shot','tirer (arme)'], ['shake','shook','shaken','secouer'],
    ['hide','hid','hidden','cacher'], ['strike','struck','struck','frapper'], ['swim','swam','swum','nager'],
    ['hang','hung','hung','suspendre / pendre'], ['sleep','slept','slept','dormir'], ['win','won','won','gagner'],
    ['dig','dug','dug','creuser'], ['steal','stole','stolen','voler (dérober)'], ['wake','woke','woken','se réveiller'],
    ['ride','rode','ridden','monter (cheval / vélo)'], ['put','put','put','mettre / poser'], ['cost','cost','cost','coûter'],
    ['hurt','hurt','hurt','blesser / faire mal'], ['shut','shut','shut','fermer'], ['spread','spread','spread','étaler / répandre'],
    ['burst','burst','burst','éclater'], ['bet','bet','bet','parier'], ['cast','cast','cast','jeter / lancer (un sort)'],
    ['quit','quit','quit','quitter / arrêter'], ['split','split','split','diviser / fendre'],
    ['broadcast','broadcast','broadcast','diffuser'], ['bite','bit','bitten','mordre'], ['blow','blew','blown','souffler'],
    ['freeze','froze','frozen','geler'], ['forgive','forgave','forgiven','pardonner'], ['forbid','forbade','forbidden','interdire'],
    ['lend','lent','lent','prêter'], ['bend','bent','bent','plier / courber'], ['burn','burnt','burnt','brûler'],
    ['deal','dealt','dealt','traiter / distribuer'], ['dream','dreamt','dreamt','rêver'], ['dive','dove','dived','plonger'],
    ['feed','fed','fed','nourrir'], ['flee','fled','fled','fuir'], ['fling','flung','flung','lancer (violemment)'],
    ['grind','ground','ground','moudre'], ['hit','hit','hit','frapper / toucher'], ['kneel','knelt','knelt',"s'agenouiller"],
    ['lay','laid','laid','poser / pondre'], ['lean','leant','leant','se pencher'], ['leap','leapt','leapt','sauter'],
    ['light','lit','lit','allumer'], ['overcome','overcame','overcome','surmonter'], ['prove','proved','proven','prouver'],
    ['seek','sought','sought','chercher'], ['shine','shone','shone','briller'], ['shrink','shrank','shrunk','rétrécir'],
    ['sink','sank','sunk','couler'], ['slide','slid','slid','glisser'], ['sow','sowed','sown','semer'],
    ['spin','spun','spun','faire tourner'], ['spit','spat','spat','cracher'], ['spoil','spoilt','spoilt','gâter / gâcher'],
    ['stick','stuck','stuck','coller'], ['sting','stung','stung','piquer'], ['stink','stank','stunk','puer'],
    ['swear','swore','sworn','jurer'], ['sweep','swept','swept','balayer'], ['swell','swelled','swollen','gonfler'],
    ['swing','swung','swung','balancer'], ['tear','tore','torn','déchirer'], ['weave','wove','woven','tisser'],
    ['weep','wept','wept','pleurer'], ['wind','wound','wound','enrouler'], ['withdraw','withdrew','withdrawn','retirer'],
    ['wring','wrung','wrung','essorer / tordre'],
  ];

  // [base, comparatif, superlatif, sens]
  const COMPARATIVE_LIST = [
    ['good','better','best','bon'], ['bad','worse','worst','mauvais'], ['far','further','furthest','loin'],
    ['little','less','least','peu'], ['many','more','most','beaucoup (dénombrable)'], ['much','more','most','beaucoup (indénombrable)'],
  ];

  // [singulier, pluriel, sens] — pluriels irréguliers fréquents (ex: "1 axis, 6 axes").
  const PLURAL_LIST = [
    ['man','men','homme'], ['woman','women','femme'], ['child','children','enfant'],
    ['foot','feet','pied'], ['tooth','teeth','dent'], ['mouse','mice','souris'],
    ['goose','geese','oie'], ['person','people','personne'], ['ox','oxen','bœuf'],
    ['die','dice','dé (à jouer)'], ['cactus','cacti','cactus'], ['focus','foci','foyer / centre d\'intérêt'],
    ['fungus','fungi','champignon'], ['nucleus','nuclei','noyau'], ['syllabus','syllabi','programme (scolaire)'],
    ['analysis','analyses','analyse'], ['axis','axes','axe'], ['crisis','crises','crise'],
    ['thesis','theses','thèse'], ['diagnosis','diagnoses','diagnostic'], ['oasis','oases','oasis'],
    ['criterion','criteria','critère'], ['phenomenon','phenomena','phénomène'], ['datum','data','donnée'],
    ['bacterium','bacteria','bactérie'], ['curriculum','curricula','programme scolaire'],
    ['appendix','appendices','annexe'], ['index','indices','index'], ['matrix','matrices','matrice'],
    ['knife','knives','couteau'], ['life','lives','vie'], ['wife','wives','épouse'],
    ['leaf','leaves','feuille'], ['loaf','loaves','miche de pain'], ['half','halves','moitié'],
    ['wolf','wolves','loup'], ['shelf','shelves','étagère'], ['thief','thieves','voleur'],
    ['elf','elves','elfe'], ['calf','calves','veau'], ['sheep','sheep','mouton'],
    ['deer','deer','cerf'], ['series','series','série'], ['species','species','espèce'],
  ];

  // formLabels : intitulés des champs affichés dans l'exercice dédié à chaque type de famille.
  const FORM_LABELS = {
    irregular_verb: ['Base', 'Prétérit', 'Participe passé'],
    irregular_comparative: ['Base', 'Comparatif', 'Superlatif'],
    irregular_plural: ['Singulier', 'Pluriel'],
  };

  function buildFamilies(list, type, label) {
    return list.map((tuple) => {
      const fr = tuple[tuple.length - 1];
      const forms = tuple.slice(0, -1);
      return {
        type, label, base: forms[0], forms,
        formLabels: FORM_LABELS[type],
        distinctive: Array.from(new Set(forms.slice(1))),
        fr, userFr: null,
      };
    });
  }

  const ALL_FAMILIES = [
    ...buildFamilies(VERB_LIST, 'irregular_verb', 'Verbes irréguliers'),
    ...buildFamilies(COMPARATIVE_LIST, 'irregular_comparative', 'Comparatifs irréguliers'),
    ...buildFamilies(PLURAL_LIST, 'irregular_plural', 'Pluriels irréguliers'),
  ];

  const BASE_INDEX = new Map(ALL_FAMILIES.map((f) => [f.base, f]));

  function wholeWordPresent(word, fullText) {
    const re = new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    return re.test(fullText);
  }

  // Scanne le texte entier : une famille est "détectée" dès qu'une de ses formes distinctives
  // (prétérit/participe, ou comparatif/superlatif) apparaît quelque part, même isolément.
  function detect(fullText) {
    const found = [];
    ALL_FAMILIES.forEach((fam) => {
      const hit = fam.distinctive.some((f) => wholeWordPresent(f, fullText));
      if (hit) found.push(Object.assign({}, fam, { userFr: null }));
    });
    return found;
  }

  // Table forme -> famille détectée, pour supprimer la création d'un item isolé en double.
  function formIndex(detectedFamilies) {
    const map = new Map();
    detectedFamilies.forEach((fam) => fam.forms.forEach((f) => map.set(f.toLowerCase(), fam)));
    return map;
  }

  function isKnownBase(word) { return BASE_INDEX.has((word || '').toLowerCase()); }

  global.WordFamilies = { detect, formIndex, isKnownBase, BASE_INDEX };
})(window);
