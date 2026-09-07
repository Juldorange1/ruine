// Analyseur de leçon : transforme un texte collé (souvent long et mal organisé) en une
// liste d'éléments révisables typés (vocabulaire, expressions, grammaire, exemples, ...).
(function (global) {
  'use strict';

  const FRENCH_STOPWORDS = new Set(['le','la','les','un','une','des','du','de','et','ou','mais','donc','car',
    'que','qui','où','à','est','sont','avoir','être','ne','pas','se','sa','son','ses','pour','avec','dans',
    'sur','au','aux','ce','cette','ces','on','nous','vous','ils','elles','il','elle','je','tu','plus','très',
    'bien','comme','quand','si','alors','ainsi','entre','sans','sous','chez']);

  const ENGLISH_STOPWORDS = new Set(['the','a','an','is','are','to','of','in','on','at','for','with','and','or',
    'but','so','because','that','which','who','where','when','if','then','so','not','it','this','these','those',
    'he','she','they','we','you','i','be','have','has','had','will','would','can','could','should','must']);

  const ADJ_SUFFIXES = ['ful','less','ous','ive','able','ible','ish'];
  const ADJ_WORDLIST = new Set(['aware','sure','glad','afraid','alone','alive','asleep','fond','fit','ill',
    'well','kind','fair','cheap','rare','keen','calm','proud','brave','rich','poor','tired','bored','angry',
    'sad','happy','young','old','big','small','hot','cold','hard','soft','strong','weak','safe','clean']);

  const HEADER_HINTS = [
    { re: /verbes? irr[ée]guliers?|irregular verbs?/i, type: 'irregular_verb' },
    { re: /expr(essions?)?/i, type: 'expression' },
    { re: /phrasal/i, type: 'phrasal_verb' },
    { re: /verbe/i, type: 'verb' },
    { re: /adjectif/i, type: 'adjective' },
    { re: /nom(s)?\b/i, type: 'noun' },
    { re: /grammaire|structure/i, type: 'grammar_rule' },
    { re: /culture|civilisation/i, type: 'culture' },
    { re: /faux amis?/i, type: 'false_friend' },
    { re: /vocab/i, type: 'vocab' },
  ];

  const GRAMMAR_KEYWORDS = /\b(règle|grammaire|on utilise|on emploie|structure|attention|ne\s+jamais|toujours|présent simple|prétérit|present perfect|be\s?\+|verbe\s?\+|auxiliaire)\b/i;
  const CULTURE_KEYWORDS = /\b(royaume-uni|etats-unis|états-unis|uk\b|usa\b|angleterre|london|londres|culture|civilisation|traditions?)\b/i;
  const EXAMPLE_PREFIX = /^(ex\s*[:.]|exemple\s*[:.]|e\.g\.)/i;

  function stripBullet(line) {
    return line.replace(/^[\s•*\-–—▪►·]+/, '').trim();
  }

  function hasAccents(s) {
    return /[àâäéèêëïîôöùûüçœæ]/i.test(s);
  }

  function countFrenchStop(s) {
    const words = s.toLowerCase().replace(/[^\wàâäéèêëïîôöùûüçœæ' ]/gi, ' ').split(/\s+/).filter(Boolean);
    return words.filter((w) => FRENCH_STOPWORDS.has(w)).length;
  }

  function countEnglishStop(s) {
    const words = s.toLowerCase().replace(/[^\w' ]/gi, ' ').split(/\s+/).filter(Boolean);
    return words.filter((w) => ENGLISH_STOPWORDS.has(w)).length;
  }

  function frenchScore(s) {
    let score = countFrenchStop(s) * 2;
    if (hasAccents(s)) score += 3;
    if (/[a-z]/i.test(s) && !/[a-z]/i.test(s.replace(/[àâäéèêëïîôöùûüçœæ]/gi, ''))) score += 1;
    return score;
  }

  function englishScore(s) {
    let score = countEnglishStop(s) * 2;
    if (/^to\s+\w/i.test(s.trim())) score += 4;
    if (/ing\b/.test(s)) score += 1;
    return score;
  }

  // Détermine quel côté d'une paire est l'anglais et lequel est le français.
  function splitEnFr(a, b) {
    const scoreAasFr = frenchScore(a) - englishScore(a);
    const scoreBasFr = frenchScore(b) - englishScore(b);
    if (scoreAasFr > scoreBasFr) return { en: b, fr: a };
    return { en: a, fr: b };
  }

  function classifyEnglishSide(en, sectionHint) {
    const trimmed = en.trim();
    const lower = trimmed.toLowerCase();
    if (/^to\s+\w+\s+(up|down|out|in|on|off|away|back|forward|through|over|along|about|around)\b/i.test(trimmed)) {
      return 'phrasal_verb';
    }
    if (/^to\s+\w+/i.test(trimmed)) return 'verb';
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length >= 3) return 'expression';
    const lastWord = words[words.length - 1].replace(/[^a-z]/gi, '').toLowerCase();
    if (words.length === 1 && (ADJ_SUFFIXES.some((suf) => lastWord.endsWith(suf)) || ADJ_WORDLIST.has(lastWord))) return 'adjective';
    if (sectionHint === 'adjective' || sectionHint === 'noun' || sectionHint === 'verb' || sectionHint === 'expression') {
      if (sectionHint !== 'expression' || words.length >= 2) return sectionHint;
    }
    return words.length === 1 ? 'noun' : 'noun'; // les groupes de 2 mots sans marqueur = nom composé
  }

  function detectSectionHint(line) {
    const clean = line.replace(/[:：]\s*$/, '').trim();
    if (clean.length > 40) return null;
    for (const h of HEADER_HINTS) {
      if (h.re.test(clean) && /:$/.test(line.trim())) return h.type;
    }
    return null;
  }

  function computeFrequency(word, fullText) {
    const norm = word.replace(/^to\s+/i, '').trim();
    if (!norm) return 0;
    const re = new RegExp('\\b' + norm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
    const matches = fullText.match(re);
    return matches ? matches.length : 0;
  }

  function guessImportance(en, fullText, markedImportant) {
    if (markedImportant) return 'essential';
    const freq = computeFrequency(en, fullText);
    if (freq >= 3) return 'essential';
    if (freq === 1) return 'secondary';
    return 'important';
  }

  function wordsOf(s) {
    return (s || '').toLowerCase().replace(/^to\s+/, '')
      .split(/[^a-zà-ÿ]+/).map((w) => w.trim()).filter(Boolean);
  }

  // Repère dans la leçon les mots anglais qui n'ont jamais été rattachés à un item (pas de
  // "= traduction" donné, mentionnés seulement dans une phrase ou une liste) et dont on connaît
  // la traduction grâce au dictionnaire de secours. On ne se base QUE sur des lignes où
  // l'anglais domine (et jamais sur un mot déjà traduit ailleurs dans la leçon), pour ne pas
  // confondre un mot français avec un mot anglais qu'on ne connaîtrait pas encore.
  function extractOrphanVocabulary(rawLines, existingItems) {
    const englishText = rawLines.filter((l) => englishScore(l) >= frenchScore(l)).join(' \n ');
    if (!englishText.trim()) return [];

    const covered = new Set();
    const frenchSeen = new Set();
    existingItems.forEach((it) => {
      wordsOf(it.en).forEach((w) => covered.add(w));
      wordsOf(it.fr).forEach((w) => frenchSeen.add(w));
      if (it.forms) it.forms.forEach((f) => wordsOf(f).forEach((w) => covered.add(w)));
    });

    const found = [];
    const addedKeys = new Set();
    function addVocab(en, fr, freq) {
      const key = en.toLowerCase();
      if (addedKeys.has(key)) return;
      addedKeys.add(key);
      found.push(makeItem({
        en, fr, type: classifyEnglishSide(en, null),
        importance: freq >= 3 ? 'essential' : 'important',
        example: null,
      }));
    }

    // 1) Expressions du dictionnaire (les plus longues d'abord, ex: "pencil case" avant "pencil")
    Dictionary.PHRASE_KEYS.forEach((phrase) => {
      const words = phrase.split(' ');
      if (words.some((w) => covered.has(w))) return;
      const re = new RegExp('\\b' + phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      if (re.test(englishText)) {
        addVocab(phrase, Dictionary.DICTIONARY[phrase], computeFrequency(phrase, englishText));
        words.forEach((w) => covered.add(w));
      }
    });

    // 2) Mots isolés reconnus par le dictionnaire
    const tokens = englishText.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
    const seen = new Set();
    tokens.forEach((w) => {
      if (seen.has(w) || covered.has(w) || frenchSeen.has(w) || ENGLISH_STOPWORDS.has(w) || FRENCH_STOPWORDS.has(w)) return;
      seen.add(w);
      const hit = Dictionary.lookup(w);
      if (hit) addVocab(hit.isVerb ? 'to ' + w : w, hit.fr, computeFrequency(w, englishText));
    });

    return found;
  }

  const PAIR_SEPARATOR = /\s(?:=|:|→|=>|--|–|—)\s/;

  const MAX_SENTENCE_WORDS = 22; // au-delà, ce n'est plus "une phrase d'exemple" mais un paragraphe

  function looksLikeSentence(s) {
    const words = s.trim().split(/\s+/).filter(Boolean);
    return words.length >= 4 && words.length <= MAX_SENTENCE_WORDS;
  }

  // Un copié-collé donne parfois un paragraphe entier sur une seule "ligne" (pas de retour à la
  // ligne, ou mise en page à colonnes qui a tout collé ensemble). On découpe alors sur la
  // ponctuation de fin de phrase pour ne jamais transformer un paragraphe entier en un seul item.
  function splitIntoSentences(line) {
    return line.split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Þ0-9«"])/).map((s) => s.trim()).filter(Boolean);
  }

  function expandLongLines(rawTextLines) {
    const out = [];
    rawTextLines.forEach((line) => {
      const wordCount = line.split(/\s+/).filter(Boolean).length;
      if (wordCount > MAX_SENTENCE_WORDS) {
        const parts = splitIntoSentences(line);
        // si la découpe n'a rien donné (pas de ponctuation), on ignore la ligne plutôt que
        // d'en faire un item géant illisible
        if (parts.length > 1) out.push(...parts);
      } else {
        out.push(line);
      }
    });
    return out;
  }

  // Détecte une ligne du type "go - went - gone", "go / went / gone (aller)",
  // "go, went, gone = aller", ou un collage de tableau ("go\twent\tgone\taller").
  // Retourne {w1, w2, w3, trans} ou null.
  function parseTripleLine(line) {
    const m = line.match(/^([A-Za-z]{2,})\s*[\/,\-–—]\s*([A-Za-z]{2,})\s*[\/,\-–—]\s*([A-Za-z]{2,})(?:\s*(?:[-–—=:]\s*(.+?)|\(([^)]+)\))\s*)?$/);
    if (m) return { w1: m[1], w2: m[2], w3: m[3], trans: (m[4] || m[5] || '').trim() };
    const cols = line.split(/\t+| {2,}/).map((s) => s.trim()).filter(Boolean);
    if (cols.length >= 3 && cols.slice(0, 3).every((c) => /^[A-Za-z]{2,}$/.test(c))) {
      return { w1: cols[0], w2: cols[1], w3: cols[2], trans: (cols[3] || '').trim() };
    }
    return null;
  }

  function analyzeLesson(rawText) {
    const fullText = rawText;
    const rawLines = expandLongLines(rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
    const items = [];
    const seenPairs = new Set();
    let sectionHint = null;
    let pendingEnglishSentence = null; // phrase anglaise en attente de sa traduction française (ligne suivante)

    // Familles de mots (verbes irréguliers, comparatifs irréguliers) : une famille est détectée
    // dès qu'une de ses formes distinctives apparaît n'importe où dans le texte, même si ses
    // autres formes sont écrites ailleurs dans la leçon. On regroupera tout ça en UN SEUL item
    // à la fin, plutôt que de créer 2-3 mots isolés sans lien entre eux.
    const detectedFamilies = WordFamilies.detect(fullText);
    let detectedFormsToFamily = WordFamilies.formIndex(detectedFamilies);

    function flushPending() {
      // Une phrase anglaise sans traduction trouvée n'est pas exploitable comme exercice
      // (on ne peut rien lui faire réviser) : on l'abandonne plutôt que de créer un item creux.
      pendingEnglishSentence = null;
    }

    for (let i = 0; i < rawLines.length; i++) {
      let line = stripBullet(rawLines[i]);
      if (!line) continue;

      const hint = detectSectionHint(line);
      if (hint) { sectionHint = hint; continue; }

      const markedImportant = /\*\*|importa?nt|à retenir|clé|indispensable/i.test(line);
      const cleanLine = line.replace(/\*\*/g, '');

      // 0) Une phrase anglaise attend sa traduction : si cette ligne est bien du français, on les associe.
      if (pendingEnglishSentence) {
        if (looksLikeSentence(cleanLine) && frenchScore(cleanLine) > englishScore(cleanLine)) {
          items.push(makeItem({ en: pendingEnglishSentence, fr: cleanLine, type: 'example_sentence', importance: 'secondary', example: { en: pendingEnglishSentence, fr: cleanLine } }));
          pendingEnglishSentence = null;
          continue;
        }
        flushPending();
      }

      // 1) Faux ami mentionné explicitement : on tente d'en extraire la paire mot/traduction
      if (/faux amis?/i.test(cleanLine)) {
        const remainder = cleanLine.replace(/faux amis?\s*[:\-]?\s*/i, '').trim();
        const parts = remainder.split(PAIR_SEPARATOR);
        if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
          const { en, fr } = splitEnFr(parts[0].trim(), parts[1].trim());
          items.push(makeItem({ en, fr, type: 'false_friend', importance: 'important', example: null }));
        } else {
          items.push(makeItem({ en: '', fr: cleanLine, type: 'false_friend', importance: 'important', example: null }));
        }
        continue;
      }

      // 2) Exemple explicite "Ex : ..."
      if (EXAMPLE_PREFIX.test(cleanLine)) {
        const content = cleanLine.replace(EXAMPLE_PREFIX, '').trim();
        const parts = content.split(PAIR_SEPARATOR);
        if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
          const { en, fr } = splitEnFr(parts[0].trim(), parts[1].trim());
          items.push(makeItem({ en, fr, type: 'example_sentence', importance: 'secondary', example: { en, fr } }));
        } else if (frenchScore(content) > englishScore(content)) {
          items.push(makeItem({ en: '', fr: content, type: 'example_sentence', importance: 'secondary', example: null }));
        } else {
          pendingEnglishSentence = content; // sa traduction arrive peut-être à la ligne suivante
        }
        continue;
      }

      // 3) Règle de grammaire (signal fort, prioritaire sur le découpage générique)
      if (GRAMMAR_KEYWORDS.test(cleanLine) || sectionHint === 'grammar_rule') {
        items.push(makeItem({ en: '', fr: cleanLine, type: 'grammar_rule', importance: markedImportant ? 'essential' : 'important', example: null }));
        continue;
      }

      // 4) Info culturelle
      if (CULTURE_KEYWORDS.test(cleanLine) || sectionHint === 'culture') {
        items.push(makeItem({ en: '', fr: cleanLine, type: 'culture', importance: 'secondary', example: null }));
        continue;
      }

      // 4b) Ligne courte qui cite au moins 2 formes d'UNE MÊME famille déjà détectée
      // (ex: "go - went - gone = aller", "went, gone"...) : on la rattache à la famille
      // plutôt que d'en faire un item à part (et on récupère la traduction si présente).
      const tokensGuess = cleanLine.split(/[^A-Za-z]+/).filter(Boolean).map((w) => w.toLowerCase());
      if (tokensGuess.length >= 2 && tokensGuess.length <= 6 && frenchScore(cleanLine) < 3
        && !GRAMMAR_KEYWORDS.test(cleanLine) && !CULTURE_KEYWORDS.test(cleanLine)) {
        const famsHere = tokensGuess.map((t) => detectedFormsToFamily.get(t)).filter(Boolean);
        const uniqueBases = new Set(famsHere.map((f) => f.base));
        if (famsHere.length >= 2 && uniqueBases.size === 1) {
          const fam = famsHere[0];
          const transMatch = cleanLine.match(/(?:=|:|\()\s*([^)=:]+?)\s*\)?\s*$/);
          if (transMatch && transMatch[1] && !fam.userFr) fam.userFr = transMatch[1].trim();
          continue;
        }
      }

      // 4c) Triplet explicite (base / prétérit / participe, ou base / comparatif / superlatif)
      // pour un verbe/adjectif pas forcément dans notre table de référence : on l'accepte si
      // la section en cours parle de verbes irréguliers, ou si le 1er mot est un verbe connu.
      const triple = parseTripleLine(cleanLine);
      if (triple) {
        const key = triple.w1.toLowerCase();
        const already = detectedFormsToFamily.get(key);
        if (already) {
          if (triple.trans && !already.userFr) already.userFr = triple.trans;
          continue;
        }
        if (sectionHint === 'irregular_verb' || WordFamilies.isKnownBase(triple.w1)) {
          const known = WordFamilies.BASE_INDEX.get(key);
          const fam = {
            type: 'irregular_verb', label: 'Verbes irréguliers', base: key,
            forms: [triple.w1, triple.w2, triple.w3], formLabels: ['Base', 'Prétérit', 'Participe passé'],
            fr: triple.trans || (known ? known.fr : ''), userFr: null,
          };
          detectedFamilies.push(fam);
          [triple.w1, triple.w2, triple.w3].forEach((f) => detectedFormsToFamily.set(f.toLowerCase(), fam));
          continue;
        }
      }

      // 5) Paire mot/expression = traduction
      const m = cleanLine.split(PAIR_SEPARATOR);
      if (m.length === 2 && m[0].trim() && m[1].trim() && m[0].trim().length < 80 && m[1].trim().length < 80) {
        const left = m[0].trim();
        const right = m[1].trim();
        const { en, fr } = splitEnFr(left, right);

        // Cette paire ne fait en fait que traduire UNE forme d'une famille déjà détectée
        // (ex: "go = aller" alors que "went"/"gone" apparaissent ailleurs) : on rattache la
        // traduction à la famille au lieu de créer un item isolé et redondant.
        const normEn = en.replace(/^to\s+/i, '').trim().toLowerCase();
        const fam = detectedFormsToFamily.get(normEn);
        if (fam) {
          if (fr && (normEn === fam.base || !fam.userFr)) fam.userFr = fr;
          continue;
        }

        const key = en.toLowerCase() + '|' + fr.toLowerCase();
        if (!seenPairs.has(key) && en && fr) {
          seenPairs.add(key);
          const type = classifyEnglishSide(en, sectionHint);
          items.push(makeItem({
            en, fr, type,
            importance: guessImportance(en, fullText, markedImportant),
            example: null,
          }));
          continue;
        }
        if (seenPairs.has(key)) continue;
      }

      // 6) Phrase anglaise isolée : sa traduction, si elle existe, arrivera à la ligne suivante (cf. cas 0)
      if (looksLikeSentence(cleanLine) && englishScore(cleanLine) > frenchScore(cleanLine)) {
        pendingEnglishSentence = cleanLine;
        continue;
      }

      // sinon : ligne ignorée (bruit, titre de leçon, etc.)
    }
    flushPending();

    // Crée un seul item par famille détectée, qui réunit toutes ses formes — c'est le cœur de
    // la demande "go / went / gone doivent être appris ensemble, même écrits à des endroits
    // différents de la leçon".
    const seenBases = new Set();
    detectedFamilies.forEach((fam) => {
      if (seenBases.has(fam.base)) return;
      seenBases.add(fam.base);
      const freq = fam.forms.reduce((n, f) => n + computeFrequency(f, fullText), 0);
      items.push(makeItem({
        en: fam.base, fr: fam.userFr || fam.fr, type: fam.type,
        importance: freq >= 4 ? 'essential' : 'important',
        example: null, forms: fam.forms, formLabels: fam.formLabels,
      }));
    });

    // Le vocabulaire "orphelin" : des mots anglais présents dans la leçon mais jamais rattachés
    // à un item (pas de "= traduction" donné, mentionnés seulement dans une phrase, une liste
    // sans ponctuation claire, etc.). On ne doit pas les laisser disparaître silencieusement.
    extractOrphanVocabulary(rawLines, items).forEach((it) => items.push(it));

    return items;
  }

  // Filet de sécurité : quel que soit le chemin emprunté par l'analyseur, jamais un item avec
  // un texte démesuré (paragraphe entier, copié-collé corrompu) ne doit atteindre l'interface.
  function clampText(s, max) {
    s = (s || '').trim();
    return s.length > max ? s.slice(0, max).trim() + '…' : s;
  }

  function makeItem({ en, fr, type, importance, example, forms, formLabels }) {
    const item = {
      id: Store.uid('item'),
      lessonId: null,
      type: type || 'vocab',
      en: clampText(en, 180),
      fr: clampText(fr, 180),
      example: example || null,
      importance: importance || 'important',
      tags: [],
      forms: forms && forms.length ? forms.slice() : null,
      formLabels: forms && forms.length ? (formLabels || forms.map((_, i) => 'Forme ' + (i + 1))) : null,
      mnemonicTip: null,
      skills: SRS.newSrsState(),
      masteryLevel: 0,
      lastSkillUsed: null,
      history: [],
      createdAt: Date.now(),
    };
    if (item.en) {
      const v = Visuals.buildVisual(item);
      item.visual = v;
      if (v.kind === 'false_friend') item.mnemonicTip = v.mnemonic;
    } else {
      item.visual = { emoji: '📐', kind: 'text', mnemonic: null };
    }
    if (item.forms) item.visual = { emoji: item.type === 'irregular_comparative' ? '📶' : '🔁', kind: 'forms', mnemonic: null };
    return item;
  }

  global.Analyzer = { analyzeLesson, makeItem, classifyEnglishSide, splitEnFr, parseTripleLine, extractOrphanVocabulary };
})(window);
