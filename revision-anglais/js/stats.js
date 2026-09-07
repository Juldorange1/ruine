// Agrégation des statistiques : progression, difficultés, précision par compétence.
(function (global) {
  'use strict';

  function isToday(ts) {
    if (!ts) return false;
    const d = new Date(ts), n = new Date();
    return d.toDateString() === n.toDateString();
  }

  function globalCounts() {
    const items = Store.getAllItems();
    const out = { total: items.length, learned: 0, inProgress: 0, difficult: 0, learnedToday: 0, reviewedToday: 0 };
    items.forEach((it) => {
      if (it.masteryLevel >= 4) out.learned++;
      else if (it.masteryLevel > 0) out.inProgress++;
      const diff = SRS.difficultyFactor(it);
      if (diff > 0.45 && (it.skills.en_fr.reps + it.skills.fr_en.reps) >= 2) out.difficult++;
      let reviewedTodayForThisItem = false;
      SRS.SKILLS.forEach((k) => {
        if (isToday(it.skills[k].lastDate)) { out.reviewedToday++; reviewedTodayForThisItem = true; }
      });
      if (it.masteryLevel >= 4 && reviewedTodayForThisItem) out.learnedToday++;
    });
    return out;
  }

  function accuracy(items) {
    let success = 0, total = 0;
    items.forEach((it) => {
      SRS.SKILLS.forEach((k) => { success += it.skills[k].success; total += it.skills[k].success + it.skills[k].errors; });
    });
    return total ? Math.round((success / total) * 100) : null;
  }

  function competencyTable() {
    const items = Store.getAllItems();
    const buckets = { en_fr: [0, 0], fr_en: [0, 0], traduction: [0, 0], vocabulaire: [0, 0], expressions: [0, 0] };
    items.forEach((it) => {
      const add = (key, s) => { buckets[key][0] += s.success; buckets[key][1] += s.success + s.errors; };
      add('en_fr', it.skills.en_fr);
      add('fr_en', it.skills.fr_en);
      add('vocabulaire', it.skills.en_fr);
      if (it.type === 'expression' || it.type === 'phrasal_verb') {
        add('expressions', it.skills.en_fr);
        add('expressions', it.skills.fr_en);
      }
      add('traduction', it.skills.listening); // approx : la traduction utilise phrase + rappel
    });
    const result = {};
    Object.keys(buckets).forEach((k) => {
      const [s, t] = buckets[k];
      result[k] = t ? Math.round((s / t) * 100) : null;
    });
    return result;
  }

  function difficultWords(limit) {
    const items = Store.getAllItems().filter((it) => {
      const total = SRS.SKILLS.reduce((a, k) => a + it.skills[k].success + it.skills[k].errors, 0);
      return total >= 2;
    });
    const withRate = items.map((it) => {
      let s = 0, t = 0;
      SRS.SKILLS.forEach((k) => { s += it.skills[k].success; t += it.skills[k].success + it.skills[k].errors; });
      return { item: it, rate: t ? Math.round((s / t) * 100) : 100, total: t };
    });
    withRate.sort((a, b) => a.rate - b.rate);
    return withRate.slice(0, limit || 10);
  }

  function lessonProgress(lessonId) {
    const items = Store.getItemsByLesson(lessonId);
    if (!items.length) return 0;
    const sum = items.reduce((acc, it) => acc + it.masteryLevel / 4, 0);
    return Math.round((sum / items.length) * 100);
  }

  function progressHistory(days) {
    days = days || 14;
    const sessions = Store.getSessions();
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(Date.now() - i * 86400000);
      const key = day.toDateString();
      const daySessions = sessions.filter((s) => new Date(s.date).toDateString() === key);
      const correct = daySessions.reduce((a, s) => a + s.correct, 0);
      const total = daySessions.reduce((a, s) => a + s.total, 0);
      out.push({ date: key, label: day.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), reviewed: total, accuracy: total ? Math.round((correct / total) * 100) : null });
    }
    return out;
  }

  function accuracyByExerciseType() {
    const sessions = Store.getSessions();
    const buckets = {};
    sessions.forEach((s) => {
      (s.byKind || []).forEach(([kind, correct, total]) => {
        buckets[kind] = buckets[kind] || [0, 0];
        buckets[kind][0] += correct;
        buckets[kind][1] += total;
      });
    });
    const out = {};
    Object.keys(buckets).forEach((k) => { out[k] = Math.round((buckets[k][0] / Math.max(1, buckets[k][1])) * 100); });
    return out;
  }

  global.Stats = { globalCounts, accuracy, competencyTable, difficultWords, lessonProgress, progressHistory, accuracyByExerciseType, isToday };
})(window);
