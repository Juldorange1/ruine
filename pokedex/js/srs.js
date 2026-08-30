// Système de maîtrise + répétition espacée (SRS). Ne dépend que des entrées
// de progression fournies par storage.js (aucun accès direct au
// localStorage ici).
const SRS = (() => {
  const LEVELS = [
    'Jamais vu',
    'Découvert',
    'Reconnu',
    'Retenu',
    'Maîtrisé',
    'Très bien maîtrisé',
  ];

  const LEVEL_INTERVAL_MS = {
    1: 10 * 60 * 1000,
    2: 24 * 60 * 60 * 1000,
    3: 3 * 24 * 60 * 60 * 1000,
    4: 7 * 24 * 60 * 60 * 1000,
    5: 21 * 24 * 60 * 60 * 1000,
  };
  const RETRY_SOON_MS = 5 * 60 * 1000;

  function levelLabel(level) {
    return LEVELS[level] ?? LEVELS[0];
  }

  function applyAnswer(entry, correct, now = Date.now()) {
    const e = { ...entry };
    e.timesSeen += 1;
    e.lastReview = now;
    if (e.masteryLevel === 0) e.masteryLevel = 1;

    if (correct) {
      e.correct += 1;
      e.currentStreak += 1;
      e.bestStreak = Math.max(e.bestStreak, e.currentStreak);
      e.masteryLevel = Math.min(5, e.masteryLevel + 1);
      e.nextReview = now + LEVEL_INTERVAL_MS[e.masteryLevel];
    } else {
      e.incorrect += 1;
      e.currentStreak = 0;
      e.masteryLevel = Math.max(1, e.masteryLevel - 2);
      e.nextReview = now + RETRY_SOON_MS;
    }
    return e;
  }

  // Enregistre le résultat d'une question pour un sujet précis (nom, type,
  // évolution...) sans toucher au niveau de maîtrise global : c'est la
  // mémoire fine "de quoi tu te souviens sur quel pokémon".
  function recordFacet(entry, mode, correct) {
    const facets = { ...(entry.facets || {}) };
    const f = facets[mode] || { correct: 0, incorrect: 0 };
    facets[mode] = { correct: f.correct + (correct ? 1 : 0), incorrect: f.incorrect + (correct ? 0 : 1) };
    return { ...entry, facets };
  }

  function accuracy(entry) {
    const total = entry.correct + entry.incorrect;
    return total ? entry.correct / total : null;
  }

  // Pokémon à réviser maintenant, du plus en retard au moins en retard.
  function buildDueQueue(progressMap, ids, now = Date.now()) {
    return ids
      .map((id) => progressMap[id])
      .filter((e) => e && e.nextReview !== null && e.nextReview <= now)
      .sort((a, b) => {
        const overdueDiff = a.nextReview - b.nextReview; // plus ancien nextReview = plus en retard
        if (overdueDiff !== 0) return overdueDiff;
        return a.masteryLevel - b.masteryLevel;
      })
      .map((e) => e.id);
  }

  // Les `limit` pokémon les moins maîtrisés parmi ceux déjà vus.
  function buildWeaknessList(progressMap, ids, limit = 20) {
    return ids
      .map((id) => progressMap[id])
      .filter((e) => e && e.timesSeen > 0)
      .map((e) => ({ entry: e, err: 1 - (accuracy(e) ?? 1) }))
      .sort((a, b) => {
        if (b.err !== a.err) return b.err - a.err;
        return a.entry.masteryLevel - b.entry.masteryLevel;
      })
      .slice(0, limit)
      .map((x) => x.entry.id);
  }

  // Pokémon déjà rencontrés (Apprendre/Jeu) où tu es faible sur au moins
  // un des sujets choisis (`facetKeys`) — jamais testé sur ce sujet compte
  // comme "faible" (accuracy 0). Triés du plus faible au moins faible.
  function buildFacetWeaknessQueue(progressMap, ids, facetKeys, limit = 30) {
    const scored = ids
      .map((id) => progressMap[id])
      .filter((e) => e && e.timesSeen > 0)
      .map((e) => {
        let worst = 1;
        let matched = false;
        for (const key of facetKeys) {
          const f = e.facets?.[key];
          const total = f ? f.correct + f.incorrect : 0;
          const acc = total > 0 ? f.correct / total : 0;
          if (acc < 0.7) matched = true;
          worst = Math.min(worst, acc);
        }
        return { id: e.id, worst, matched };
      })
      .filter((x) => x.matched)
      .sort((a, b) => a.worst - b.worst);
    return scored.slice(0, limit).map((x) => x.id);
  }

  return {
    LEVELS,
    levelLabel,
    applyAnswer,
    recordFacet,
    accuracy,
    buildDueQueue,
    buildWeaknessList,
    buildFacetWeaknessQueue,
  };
})();
