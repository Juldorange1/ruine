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

  // --- Statistiques du Pokédex (dataset complet, indépendant de la
  // progression personnelle) : comparaisons par type/génération/région et
  // stats de combat. ---

  const BATTLE_STAT_KEYS = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'];
  const BATTLE_STAT_LABELS = { hp: 'PV', attack: 'Att.', defense: 'Déf.', 'special-attack': 'Att.Sp', 'special-defense': 'Déf.Sp', speed: 'Vit.' };

  // Compte les pokémon par clé ; `multi:true` pour une fonction qui retourne
  // plusieurs clés par pokémon (ex: les deux types).
  function countBy(allPokemon, keyFn, { multi = false } = {}) {
    const counts = new Map();
    for (const p of allPokemon) {
      const keys = multi ? keyFn(p) : [keyFn(p)];
      for (const key of keys) counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].map(([key, count]) => ({ key, count }));
  }

  function statTotal(baseStats) {
    return BATTLE_STAT_KEYS.reduce((sum, k) => sum + baseStats[k], 0);
  }

  // Moyenne des stats de combat par type (un pokémon bi-type compte dans
  // ses deux types).
  function avgStatsByType(allPokemon) {
    const groups = new Map();
    for (const p of allPokemon) {
      for (const t of p.types) {
        if (!groups.has(t)) {
          groups.set(t, { key: t, count: 0, sums: Object.fromEntries(BATTLE_STAT_KEYS.map((k) => [k, 0])), totalSum: 0 });
        }
        const g = groups.get(t);
        g.count += 1;
        for (const k of BATTLE_STAT_KEYS) g.sums[k] += p.base_stats[k];
        g.totalSum += statTotal(p.base_stats);
      }
    }
    return [...groups.values()]
      .map((g) => ({
        key: g.key,
        count: g.count,
        avg: Object.fromEntries(BATTLE_STAT_KEYS.map((k) => [k, Math.round(g.sums[k] / g.count)])),
        avgTotal: Math.round(g.totalSum / g.count),
      }))
      .sort((a, b) => b.avgTotal - a.avgTotal);
  }

  // Classement des `limit` pokémon avec la plus haute (ou plus basse)
  // valeur de `valueFn`.
  function topByStat(allPokemon, valueFn, limit = 5, order = 'desc') {
    const sorted = allPokemon
      .filter((p) => valueFn(p) !== null && valueFn(p) !== undefined)
      .slice()
      .sort((a, b) => (order === 'desc' ? valueFn(b) - valueFn(a) : valueFn(a) - valueFn(b)));
    return sorted.slice(0, limit).map((p) => ({ p, value: valueFn(p) }));
  }

  function datasetOverview(allPokemon) {
    const monoType = allPokemon.filter((p) => p.types.length === 1).length;
    const biType = allPokemon.filter((p) => p.types.length === 2).length;
    const legendary = allPokemon.filter((p) => p.is_legendary).length;
    const mythical = allPokemon.filter((p) => p.is_mythical).length;
    const totalForms = allPokemon.reduce((sum, p) => sum + p.forms.length, 0);
    return { total: allPokemon.length, monoType, biType, legendary, mythical, totalForms };
  }

  // Graphique en barres horizontales pour un simple dénombrement (pas un
  // pourcentage de maîtrise) : une seule teinte, la longueur porte la valeur.
  function countBarChart(data, { width = 560, barHeight = 14, gap = 5 } = {}) {
    const maxVal = Math.max(1, ...data.map((d) => d.count));
    const labelWidth = 110;
    const plotWidth = width - labelWidth - 50;
    const height = data.length * (barHeight + gap) + gap;
    const rows = data
      .map((d, i) => {
        const y = gap + i * (barHeight + gap);
        const w = Math.max(2, (d.count / maxVal) * plotWidth);
        return `
        <text x="${labelWidth - 8}" y="${y + barHeight / 2}" text-anchor="end" dominant-baseline="middle" class="chart-label">${escapeXml(d.key)}</text>
        <rect x="${labelWidth}" y="${y}" width="${plotWidth}" height="${barHeight}" rx="4" class="chart-track"></rect>
        <rect x="${labelWidth}" y="${y}" width="${w}" height="${barHeight}" rx="4" class="chart-bar">
          <title>${escapeXml(d.key)}: ${d.count}</title>
        </rect>
        <text x="${labelWidth + w + 6}" y="${y + barHeight / 2}" dominant-baseline="middle" class="chart-value">${d.count}</text>`;
      })
      .join('');
    return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Graphique en barres">${rows}</svg>`;
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
    BATTLE_STAT_KEYS,
    BATTLE_STAT_LABELS,
    countBy,
    statTotal,
    avgStatsByType,
    topByStat,
    datasetOverview,
    countBarChart,
  };
})();
