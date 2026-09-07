// Génération des exercices (les 7 modes) + correction des réponses (tolérante aux variantes
// et fautes de frappe) + gabarits de phrases pour les items sans exemple fourni.
(function (global) {
  'use strict';

  // ---------- Comparaison de texte tolérante ----------
  function normalizeAnswer(s) {
    return (s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // enlève les accents pour la comparaison
      .replace(/^to\s+/, '')
      .replace(/[^a-z0-9 ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = new Array(n + 1);
    for (let j = 0; j <= n; j++) dp[j] = j;
    for (let i = 1; i <= m; i++) {
      let prev = dp[0];
      dp[0] = i;
      for (let j = 1; j <= n; j++) {
        const tmp = dp[j];
        dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
        prev = tmp;
      }
    }
    return dp[n];
  }

  // Sépare "atteindre / accomplir" ou "atteindre, accomplir" en variantes acceptées.
  function acceptedVariants(reference) {
    return (reference || '')
      .split(/\/|,|;|\bou\b|\bor\b/i)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Retourne {correct, close, closestMatch, distance}
  function checkAnswer(userInput, reference) {
    const variants = acceptedVariants(reference);
    const userNorm = normalizeAnswer(userInput);
    if (!userNorm) return { correct: false, close: false, closestMatch: variants[0] || reference, distance: 99 };
    let best = { distance: Infinity, variant: variants[0] || reference };
    for (const v of variants) {
      const vNorm = normalizeAnswer(v);
      const dist = levenshtein(userNorm, vNorm);
      if (dist < best.distance) best = { distance: dist, variant: v };
    }
    const tolerance = Math.max(1, Math.floor(normalizeAnswer(best.variant).length / 6));
    if (best.distance === 0) return { correct: true, close: false, closestMatch: best.variant, distance: 0 };
    if (best.distance <= tolerance) return { correct: true, close: true, closestMatch: best.variant, distance: best.distance };
    return { correct: false, close: best.distance <= tolerance + 2, closestMatch: best.variant, distance: best.distance };
  }

  // Comparaison plus souple pour des phrases entières (chevauchement de mots).
  function checkSentence(userInput, reference) {
    const norm = (s) => normalizeAnswer(s).split(' ').filter(Boolean);
    const u = norm(userInput);
    const r = norm(reference);
    if (!u.length || !r.length) return { correct: false, ratio: 0 };
    const rSet = new Set(r);
    const hit = u.filter((w) => rSet.has(w)).length;
    const ratio = hit / r.length;
    return { correct: ratio >= 0.75, ratio };
  }

  // ---------- Gabarits de phrases pour la traduction / le mot à trous ----------
  const TEMPLATES = {
    verb: [
      { fr: 'Il est important de ___ chaque jour.', en: 'It is important to ___ every day.' },
      { fr: "Elle a réussi à ___.", en: 'She managed to ___.' },
    ],
    phrasal_verb: [
      { fr: 'Il ne faut jamais ___.', en: 'You should never ___.' },
      { fr: 'Ils ont décidé de ___.', en: 'They decided to ___.' },
    ],
    noun: [
      { fr: "C'est un sujet lié à ___.", en: 'This is a topic related to ___.' },
      { fr: '___ est très important pour eux.', en: '___ is very important to them.' },
    ],
    adjective: [
      { fr: 'Cette situation est ___.', en: 'This situation is ___.' },
      { fr: 'Il se sent ___ aujourd\'hui.', en: 'He feels ___ today.' },
    ],
    expression: [
      { fr: "On utilise souvent l'expression « ___ ».", en: 'People often use the expression "___".' },
    ],
  };

  function fillWord(str, word) { return str.replace('___', word); }

  function getExampleSentence(item) {
    if (item.example && item.example.en && item.example.fr) return item.example;
    const bank = TEMPLATES[item.type] || TEMPLATES.noun;
    const t = bank[Math.abs(hashCode(item.id)) % bank.length];
    const enWord = item.en.replace(/^to\s+/, '');
    return { en: fillWord(t.en, enWord), fr: fillWord(t.fr, item.fr.split('/')[0].trim()) };
  }

  function hashCode(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i); return h; }

  // ---------- Générateurs d'exercices ----------
  // Chaque générateur retourne un objet { kind, item, prompt, ...données propres au mode }

  function genFlashcard(item, direction) {
    direction = direction || 'en_fr';
    const enSide = item.forms ? item.forms.join('  →  ') : item.en;
    const front = direction === 'en_fr' ? enSide : item.fr;
    const back = direction === 'en_fr' ? item.fr : enSide;
    return { kind: 'flashcard', item, direction, front, back };
  }

  // Exercice dédié aux "familles de formes" (verbes irréguliers, comparatifs irréguliers) :
  // on doit retrouver LES 3 formes ensemble, pas juste reconnaître un mot isolé.
  function genVerbForms(item) {
    return { kind: 'verbforms', item, meaning: item.fr, forms: item.forms, labels: item.formLabels || item.forms.map((_, i) => 'Forme ' + (i + 1)) };
  }

  function genActiveRecall(item, direction) {
    direction = direction || 'fr_en';
    const prompt = direction === 'fr_en' ? item.fr : item.en;
    const answer = direction === 'fr_en' ? item.en : item.fr;
    return { kind: 'recall', item, direction, prompt, answer };
  }

  function genTranslation(item) {
    const ex = getExampleSentence(item);
    return { kind: 'translation', item, prompt: ex.fr, answer: ex.en };
  }

  function genListening(item) {
    return { kind: 'listening', item, textToSpeak: item.en, answer: item.en };
  }

  function genVisual(item) {
    return { kind: 'visual', item, emoji: item.visual ? item.visual.emoji : '❓', answer: item.en };
  }

  function genMatching(items) {
    const pairs = items.slice(0, 6).map((it) => ({ id: it.id, en: it.en, fr: it.fr }));
    return { kind: 'matching', pairs, leftShuffled: shuffle(pairs.map((p) => p.id)), rightShuffled: shuffle(pairs.map((p) => p.id)) };
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Construit une session mélangée d'exercices à partir d'une liste d'items ciblés.
  const MODE_CYCLE = ['flashcard', 'recall', 'visual', 'recall', 'translation', 'flashcard', 'listening', 'matching'];

  function buildSession(items, pool, targetCount) {
    const queue = [];
    const usable = items.filter((it) => it.en); // items sans "en" (règles/culture) traités à part
    const noEnItems = items.filter((it) => !it.en);
    const wordPool = usable.filter((it) => it.type !== 'example_sentence'); // pour l'association
    let cycleIdx = 0;
    let i = 0;
    while (queue.length < targetCount && usable.length) {
      const item = usable[i % usable.length];
      const kind = MODE_CYCLE[cycleIdx % MODE_CYCLE.length];
      cycleIdx++;
      // Une phrase d'exemple entière n'est jamais une "carte-mot" : elle ne sert que pour
      // l'exercice de traduction (1 phrase à traduire), jamais pour flashcard/rappel/écoute/
      // association qui doivent porter sur 1 à 3 mots maximum.
      if (item.type === 'example_sentence' && kind !== 'matching') {
        queue.push(genTranslation(item));
      } else if (item.forms && kind !== 'matching' && kind !== 'listening' && kind !== 'flashcard') {
        // Les "familles de formes" (verbes irréguliers, comparatifs) se révisent avec leur
        // exercice dédié — un simple mot isolé ne suffit pas à vérifier qu'on les connaît toutes.
        queue.push(genVerbForms(item));
      } else if (kind === 'matching') {
        if (wordPool.length >= 4) queue.push(genMatching(shuffle(wordPool).slice(0, Math.min(6, wordPool.length))));
      } else if (kind === 'flashcard') {
        queue.push(genFlashcard(item, item.lastSkillUsed === 'en_fr' ? 'fr_en' : 'en_fr'));
      } else if (kind === 'recall') {
        queue.push(genActiveRecall(item, SRS.pickSkillToTrain(item) === 'fr_en' ? 'fr_en' : 'en_fr'));
      } else if (kind === 'translation') {
        queue.push(genTranslation(item));
      } else if (kind === 'listening') {
        queue.push(genListening(item));
      } else if (kind === 'visual') {
        if (item.visual && item.visual.kind === 'image') queue.push(genVisual(item));
        else queue.push(genActiveRecall(item, 'en_fr'));
      }
      i++;
      if (i > usable.length * 6) break; // garde-fou
    }
    // Insère les règles/notes de grammaire/culture en fin, présentées comme rappels courts.
    noEnItems.slice(0, Math.max(0, targetCount - queue.length)).forEach((it) => {
      queue.push({ kind: 'note', item: it });
    });
    return queue.slice(0, targetCount);
  }

  global.Exercises = {
    normalizeAnswer, levenshtein, checkAnswer, checkSentence, getExampleSentence,
    genFlashcard, genActiveRecall, genTranslation, genListening, genVisual, genMatching, genVerbForms,
    shuffle, buildSession, MODE_CYCLE,
  };
})(window);
