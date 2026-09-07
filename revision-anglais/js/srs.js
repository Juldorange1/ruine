// Répétition espacée "maison" : paliers courts au début, dynamiques selon la difficulté,
// + suivi de plusieurs compétences par mot (pas un simple score global).
(function (global) {
  'use strict';

  const MIN = 60 * 1000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  // Paliers d'intervalle (en ms) : quelques minutes -> plus tard dans la session -> demain -> ...
  const STEPS = [2 * MIN, 8 * MIN, 30 * MIN, 4 * HOUR, 1 * DAY, 3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY, 60 * DAY, 120 * DAY];

  const SKILLS = ['en_fr', 'fr_en', 'listening'];

  function newSkillState() {
    return { stepIndex: -1, due: Date.now(), ease: 1.0, reps: 0, success: 0, errors: 0, streak: 0, lastResult: null, lastDate: null };
  }

  function newSrsState() {
    const skills = {};
    SKILLS.forEach((s) => { skills[s] = newSkillState(); });
    return skills;
  }

  // Facteur de difficulté du mot (0 = facile, 1 = très difficile) basé sur son historique global.
  function difficultyFactor(item) {
    let success = 0, errors = 0;
    SKILLS.forEach((s) => { const sk = item.skills[s]; success += sk.success; errors += sk.errors; });
    const total = success + errors;
    if (total === 0) return 0.3; // inconnu -> prudence moyenne
    return Math.min(1, errors / total);
  }

  // Calcule le niveau de maîtrise agrégé 0-4 à partir des compétences.
  // 0 nouveau / 1 reconnu (en->fr) / 2 mémorisé (fr->en) / 3 maîtrisé (écoute) / 4 solide (tout, intervalle long)
  function computeMasteryLevel(item) {
    const s = item.skills;
    const seen = SKILLS.some((k) => s[k].reps > 0);
    if (!seen) return 0;
    if (s.en_fr.success === 0) return 1;
    if (s.fr_en.success === 0) return 2;
    if (s.listening.success === 0) return 3;
    const longEnough = SKILLS.every((k) => s[k].stepIndex >= 5);
    return longEnough ? 4 : 3;
  }

  function applyResult(item, skillName, correct, opts) {
    opts = opts || {};
    const sk = item.skills[skillName];
    sk.reps += 1;
    sk.lastDate = Date.now();
    sk.lastResult = correct;
    const diff = difficultyFactor(item);

    if (correct) {
      sk.success += 1;
      sk.streak += 1;
      sk.ease = Math.min(2.2, sk.ease + 0.05);
      // recul d'un palier de plus si le mot est difficile, pour revoir plus souvent
      const advance = diff > 0.5 ? 1 : 2;
      sk.stepIndex = Math.min(STEPS.length - 1, sk.stepIndex + advance);
    } else {
      sk.errors += 1;
      sk.streak = 0;
      sk.ease = Math.max(0.6, sk.ease - 0.2);
      sk.stepIndex = Math.max(-1, sk.stepIndex - 2);
    }

    const baseIndex = Math.max(0, sk.stepIndex);
    const baseInterval = STEPS[baseIndex];
    // Un mot difficile revient plus souvent : on réduit l'intervalle jusqu'à -50%.
    const difficultyPenalty = 1 - diff * 0.5;
    const jitter = 0.9 + Math.random() * 0.2;
    let interval = baseInterval * sk.ease * difficultyPenalty * jitter;
    if (!correct) interval = Math.min(interval, STEPS[1]); // un échec revient vite, quoi qu'il arrive
    sk.due = Date.now() + interval;

    item.masteryLevel = computeMasteryLevel(item);
    return sk;
  }

  // Prochaine échéance la plus proche parmi les compétences pertinentes pour cet item.
  function nextDue(item) {
    return Math.min(...SKILLS.map((k) => item.skills[k].due));
  }

  function isDue(item, now) {
    now = now || Date.now();
    return nextDue(item) <= now;
  }

  // Choisit une compétence à travailler pour un item, en évitant de répéter toujours
  // la même direction (contre la "fausse mémoire" de reconnaissance).
  function pickSkillToTrain(item) {
    const now = Date.now();
    const due = SKILLS.filter((k) => item.skills[k].due <= now);
    const pool = due.length ? due : SKILLS.slice();
    // priorité : jamais essayé > le moins pratiqué > pas la dernière compétence utilisée
    const untried = pool.filter((k) => item.skills[k].reps === 0);
    if (untried.length) return untried[0];
    pool.sort((a, b) => item.skills[a].reps - item.skills[b].reps);
    if (pool.length > 1 && pool[0] === item.lastSkillUsed) {
      return pool[1];
    }
    return pool[0];
  }

  global.SRS = { SKILLS, STEPS, newSrsState, applyResult, computeMasteryLevel, difficultyFactor, nextDue, isDue, pickSkillToTrain };
})(window);
