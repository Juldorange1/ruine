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

  return {
    LEVELS,
    levelLabel,
    applyAnswer,
    accuracy,
    buildDueQueue,
    buildWeaknessList,
  };
})();
