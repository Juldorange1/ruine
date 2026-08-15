// Calculs statistiques agrégés + petits graphiques SVG "maison" (aucune
// librairie externe). Palette et specs de tracé: cf. tokens CSS --chart-*.
const Stats = (() => {
  const MASTERY_STEP_COLORS = [
    'var(--chart-step-0)',
    'var(--chart-step-1)',
    'var(--chart-step-2)',
    'var(--chart-step-3)',
    'var(--chart-step-4)',
    'var(--chart-step-5)',
  ];

  function globalSummary(allPokemon, progressMap, sessionStats) {
    const now = Date.now();
    let mastered = 0;
    let learning = 0;
    let toReview = 0;
    let neverSeen = 0;
    let masterySum = 0;

    for (const p of allPokemon) {
      const e = progressMap[p.id];
      const level = e ? e.masteryLevel : 0;
      masterySum += level;
      if (level === 0) neverSeen += 1;
      else if (level >= 4) mastered += 1;
      else learning += 1;
      if (e && e.nextReview !== null && e.nextReview <= now) toReview += 1;
    }

    const totalAnswers = sessionStats.totals.correct + sessionStats.totals.incorrect;
    const accuracy = totalAnswers ? sessionStats.totals.correct / totalAnswers : null;

    return {
      total: allPokemon.length,
      mastered,
      learning,
      neverSeen,
      toReview,
      masteryScorePct: Math.round((masterySum / (allPokemon.length * 5)) * 100),
      accuracyPct: accuracy === null ? null : Math.round(accuracy * 100),
      questionsAnswered: totalAnswers,
      errors: sessionStats.totals.incorrect,
      currentStreak: sessionStats.totals.currentStreak || 0,
      bestStreak: sessionStats.totals.bestStreak || 0,
    };
  }

  function groupProgress(allPokemon, progressMap, keyFn) {
    const groups = new Map();
    for (const p of allPokemon) {
      const key = keyFn(p);
      if (!groups.has(key)) groups.set(key, { key, total: 0, masterySum: 0, mastered: 0 });
      const g = groups.get(key);
      const level = progressMap[p.id]?.masteryLevel || 0;
      g.total += 1;
      g.masterySum += level;
      if (level >= 4) g.mastered += 1;
    }
    return [...groups.values()]
      .map((g) => ({ ...g, pct: Math.round((g.masterySum / (g.total * 5)) * 100) }))
      .sort((a, b) => String(a.key).localeCompare(String(b.key), 'fr', { numeric: true }));
  }

  function masteryDistribution(allPokemon, progressMap) {
    const counts = [0, 0, 0, 0, 0, 0];
    for (const p of allPokemon) {
      const level = progressMap[p.id]?.masteryLevel || 0;
      counts[level] += 1;
    }
    return counts;
  }

  function bestAndWorst(allPokemon, progressMap, limit = 10) {
    const seen = allPokemon
      .map((p) => ({ p, e: progressMap[p.id] }))
      .filter((x) => x.e && x.e.timesSeen > 0);
    const byMastery = [...seen].sort((a, b) => b.e.masteryLevel - a.e.masteryLevel);
    const best = byMastery.slice(0, limit).map((x) => x.p);
    const worst = byMastery
      .slice()
      .reverse()
      .slice(0, limit)
      .map((x) => x.p);
    return { best, worst };
  }

  // --- Rendu SVG ---

  function escapeXml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // Graphique en barres horizontales : une seule teinte de série (la
  // magnitude est portée par la longueur, jamais par la couleur).
  function barChart(data, { width = 560, barHeight = 14, gap = 5, valueSuffix = '%' } = {}) {
    const maxVal = Math.max(1, ...data.map((d) => d.pct));
    const labelWidth = 120;
    const plotWidth = width - labelWidth - 50;
    const height = data.length * (barHeight + gap) + gap;
    const rows = data
      .map((d, i) => {
        const y = gap + i * (barHeight + gap);
        const w = Math.max(2, (d.pct / maxVal) * plotWidth);
        return `
        <text x="${labelWidth - 8}" y="${y + barHeight / 2}" text-anchor="end" dominant-baseline="middle" class="chart-label">${escapeXml(d.key)}</text>
        <rect x="${labelWidth}" y="${y}" width="${plotWidth}" height="${barHeight}" rx="4" class="chart-track"></rect>
        <rect x="${labelWidth}" y="${y}" width="${w}" height="${barHeight}" rx="4" class="chart-bar">
          <title>${escapeXml(d.key)}: ${d.pct}${valueSuffix} (${d.mastered}/${d.total} maîtrisés)</title>
        </rect>
        <text x="${labelWidth + w + 6}" y="${y + barHeight / 2}" dominant-baseline="middle" class="chart-value">${d.pct}${valueSuffix}</text>`;
      })
      .join('');
    return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Graphique en barres">${rows}</svg>`;
  }

  // Barre empilée unique pour la répartition des niveaux de maîtrise
  // (échelle ordinale à 6 paliers, une seule teinte du plus clair au plus
  // sombre — jamais une couleur par catégorie arbitraire).
  function masteryStackedBar(counts, labels, width = 560, height = 22) {
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    let x = 0;
    const gapPx = 2;
    const segs = counts
      .map((c, i) => {
        const w = Math.max(0, (c / total) * width - gapPx);
        const rect = c > 0
          ? `<rect x="${x}" y="0" width="${w}" height="${height}" rx="4" fill="${MASTERY_STEP_COLORS[i]}">
              <title>${escapeXml(labels[i])}: ${c}</title>
             </rect>`
          : '';
        x += w + gapPx;
        return rect;
      })
      .join('');
    return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Répartition des niveaux de maîtrise">${segs}</svg>`;
  }

  function masteryLegend(counts, labels) {
    return counts
      .map(
        (c, i) =>
          `<span class="legend-item"><span class="legend-swatch" style="background:${MASTERY_STEP_COLORS[i]}"></span>${escapeXml(labels[i])} (${c})</span>`
      )
      .join('');
  }

  return {
    globalSummary,
    groupProgress,
    masteryDistribution,
    bestAndWorst,
    barChart,
    masteryStackedBar,
    masteryLegend,
  };
})();
