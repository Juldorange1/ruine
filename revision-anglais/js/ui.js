// Contrôleur d'interface : navigation entre écrans, moteur de session de révision,
// et rendu de tous les modes d'exercice. Aucune dépendance externe.
(function (global) {
  'use strict';

  const IMPORTANCE_LABEL = { essential: '🔴 Essentiel', important: '🟠 Important', secondary: '🟢 Secondaire' };
  const TYPE_LABEL = {
    vocab: 'Vocabulaire', verb: 'Verbes', phrasal_verb: 'Phrasal verbs', adjective: 'Adjectifs',
    noun: 'Noms', expression: 'Expressions', grammar_rule: 'Grammaire', example_sentence: 'Exemples',
    false_friend: 'Faux amis', culture: 'Culture', phrase_to_produce: 'Phrases à produire',
    irregular_verb: 'Verbes irréguliers', irregular_comparative: 'Comparatifs irréguliers',
    irregular_plural: 'Pluriels irréguliers',
  };
  const GROUP_SIZE = 8;

  let App = {
    draft: null,          // brouillon d'analyse de leçon en attente d'enregistrement
    currentLessonId: null,
    session: null,        // session de révision en cours
    learn: null,           // état du mode "apprendre une leçon"
    lessonFilterEssentialOnly: false,
  };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function esc(s) { return (s || '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function toast(msg) {
    let el = $('#group-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'group-toast';
      el.className = 'group-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2200);
  }

  // ---------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------
  function go(screen) {
    $all('.screen').forEach((s) => s.classList.remove('active'));
    const target = $('#screen-' + screen);
    if (target) target.classList.add('active');
    $all('#main-nav button').forEach((b) => b.classList.toggle('active', b.dataset.nav === screen));
    const renderer = { home: renderHome, 'new-lesson': renderNewLesson, lessons: renderLessons,
      'lesson-detail': () => renderLessonDetail(App.currentLessonId), stats: renderStats,
      'exam-setup': renderExamSetup, settings: () => {} }[screen];
    if (renderer) renderer();
    window.scrollTo(0, 0);
  }

  // ---------------------------------------------------------------
  // ACCUEIL
  // ---------------------------------------------------------------
  function reviewableItems() { return Store.getAllItems().filter((it) => it.en); }

  function renderHome() {
    $('#home-date').textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    $('#home-streak').textContent = `🔥 ${Store.getSettings().streak} jour(s)`;

    const items = reviewableItems();
    const due = items.filter((it) => SRS.isDue(it));
    $('#home-due-count').textContent = due.length;

    const durWrap = $('#quick-durations');
    durWrap.innerHTML = '';
    [5, 10, 20, 30, 45, 60].forEach((min) => {
      const b = document.createElement('button');
      b.className = 'btn';
      b.textContent = min + ' min';
      b.onclick = () => startSmartReview(min, 'quick');
      durWrap.appendChild(b);
    });

    const lessonsWrap = $('#home-lessons-list');
    const lessons = Store.getLessons();
    lessonsWrap.innerHTML = lessons.length ? lessons.map((l) => {
      const pct = Stats.lessonProgress(l.id);
      return `<div class="lesson-row" data-open-lesson="${l.id}">
        <div><div>${esc(l.title)}</div><div class="mini-progress"><span style="width:${pct}%"></span></div></div>
        <div class="pct">${pct}%</div></div>`;
    }).join('') : '<div class="empty-note">Aucune leçon pour le moment — clique sur "Nouvelle leçon" !</div>';
    $all('[data-open-lesson]', lessonsWrap).forEach((el) => el.onclick = () => openLesson(el.dataset.openLesson));

    const diffWrap = $('#home-difficult-list');
    const diff = Stats.difficultWords(5);
    diffWrap.innerHTML = diff.length ? diff.map((d) => `<div class="diff-row"><span>${esc(d.item.en || d.item.fr.slice(0,40))}</span><span class="rate ${rateClass(d.rate)}">${d.rate}%</span></div>`).join('')
      : '<div class="empty-note">Pas encore assez de données. Continue à réviser !</div>';

    renderBarChart('#home-progress-chart', Stats.progressHistory(14));

    $('#btn-smart-review').onclick = () => startSmartReview(computeMinutesFromDue(due.length), 'smart');
    $('#btn-exam-mode').onclick = () => go('exam-setup');
  }

  function computeMinutesFromDue(n) { return Math.max(10, Math.min(45, Math.round(n / 2))); }
  function rateClass(rate) { return rate < 60 ? 'low' : rate < 80 ? 'mid' : 'high'; }

  function renderBarChart(sel, data) {
    const el = $(sel);
    const max = Math.max(1, ...data.map((d) => d.reviewed));
    el.innerHTML = `<div class="bar-chart">${data.map((d) => {
      const h = Math.round((d.reviewed / max) * 100);
      const color = d.accuracy == null ? 'var(--line)' : d.accuracy < 60 ? 'var(--bad)' : d.accuracy < 80 ? 'var(--warn)' : 'var(--good)';
      return `<div class="bar" title="${d.label} : ${d.reviewed} révisions${d.accuracy != null ? ', ' + d.accuracy + '% de réussite' : ''}">
        <span class="fill" style="height:${h}%;background:${color}"></span><span class="lbl">${d.label}</span></div>`;
    }).join('')}</div>`;
  }

  function openLesson(id) { App.currentLessonId = id; go('lesson-detail'); }

  // ---------------------------------------------------------------
  // NOUVELLE LEÇON
  // ---------------------------------------------------------------
  function renderNewLesson() {
    App.draft = null;
    $('#new-lesson-step-paste').hidden = false;
    $('#new-lesson-step-review').hidden = true;
    $('#new-lesson-title').value = '';
    $('#new-lesson-text').value = '';
  }

  function bindNewLessonButtons() {
    $('#btn-analyze').onclick = () => {
      const text = $('#new-lesson-text').value.trim();
      if (!text) { toast('Colle d\'abord ta leçon.'); return; }
      const title = $('#new-lesson-title').value.trim() || 'Leçon sans titre';
      const items = Analyzer.analyzeLesson(text);
      if (!items.length) { toast('Aucun élément détecté — essaie le format "mot = traduction".'); return; }
      App.draft = { title, rawText: text, items };
      $('#new-lesson-step-paste').hidden = true;
      $('#new-lesson-step-review').hidden = false;
      renderDraftReview();
    };
    $('#btn-cancel-review').onclick = () => renderNewLesson();
    $('#btn-add-manual').onclick = () => {
      App.draft.items.push(Analyzer.makeItem({ en: '', fr: '', type: 'vocab', importance: 'important' }));
      renderDraftReview();
    };
    $('#btn-save-lesson').onclick = () => {
      const valid = App.draft.items.filter((it) => it.en.trim() || it.fr.trim());
      if (!valid.length) { toast('Ajoute au moins un élément avant d\'enregistrer.'); return; }
      const lesson = { id: Store.uid('lesson'), title: App.draft.title, rawText: App.draft.rawText, createdAt: Date.now(), updatedAt: Date.now() };
      Store.addLesson(lesson);
      valid.forEach((it) => { it.lessonId = lesson.id; Store.addItem(it); });
      toast('Leçon enregistrée !');
      App.currentLessonId = lesson.id;
      go('lesson-detail');
    };
  }

  function renderDraftReview() {
    $('#review-count').textContent = App.draft.items.length;
    const groups = {};
    App.draft.items.forEach((it) => { (groups[it.type] = groups[it.type] || []).push(it); });
    const wrap = $('#review-groups');
    wrap.innerHTML = Object.keys(groups).map((type) => `
      <div class="item-group">
        <h4>${TYPE_LABEL[type] || type} (${groups[type].length})</h4>
        ${groups[type].map((it) => itemRowHTML(it, true)).join('')}
      </div>`).join('');
    bindItemRows(wrap, App.draft.items, renderDraftReview);
  }

  function itemRowHTML(it, editable) {
    const enValue = it.forms ? it.forms.join(' / ') : it.en;
    const enPlaceholder = it.forms ? 'base / prétérit / participe' : 'anglais';
    return `<div class="item-row" data-id="${it.id}">
      <span class="imp-dot">${IMPORTANCE_LABEL[it.importance] ? IMPORTANCE_LABEL[it.importance].split(' ')[0] : '🟠'}</span>
      <input class="en-field" data-field="${it.forms ? 'forms' : 'en'}" value="${esc(enValue)}" placeholder="${enPlaceholder}">
      <input class="fr-field" data-field="fr" value="${esc(it.fr)}" placeholder="français">
      <select data-field="type">${Object.keys(TYPE_LABEL).map((t) => `<option value="${t}" ${it.type===t?'selected':''}>${TYPE_LABEL[t]}</option>`).join('')}</select>
      <select data-field="importance">${Object.keys(IMPORTANCE_LABEL).map((k) => `<option value="${k}" ${it.importance===k?'selected':''}>${IMPORTANCE_LABEL[k]}</option>`).join('')}</select>
      <button class="del-btn" data-del="${it.id}" title="Supprimer">✕</button>
    </div>`;
  }

  function bindItemRows(container, itemsArr, onDelete) {
    $all('.item-row', container).forEach((row) => {
      const id = row.dataset.id;
      const item = itemsArr.find((i) => i.id === id);
      $all('[data-field]', row).forEach((field) => {
        field.addEventListener('change', () => {
          if (field.dataset.field === 'forms') {
            const parts = field.value.split('/').map((s) => s.trim()).filter(Boolean);
            item.forms = parts.length ? parts : item.forms;
            item.en = item.forms[0];
          } else {
            item[field.dataset.field] = field.value;
          }
          if (field.dataset.field === 'en' && item.en && !item.forms) {
            const v = Visuals.buildVisual(item);
            item.visual = v;
          }
          if (Store.getItem(id)) Store.updateItem(id, { en: item.en, fr: item.fr, type: item.type, importance: item.importance, forms: item.forms, visual: item.visual });
        });
      });
    });
    $all('[data-del]', container).forEach((btn) => {
      btn.onclick = () => {
        const id = btn.dataset.del;
        const idx = itemsArr.findIndex((i) => i.id === id);
        if (idx >= 0) itemsArr.splice(idx, 1);
        if (Store.getItem(id)) Store.deleteItem(id);
        onDelete();
      };
    });
  }

  // ---------------------------------------------------------------
  // LEÇONS
  // ---------------------------------------------------------------
  function renderLessons() {
    const lessons = Store.getLessons();
    const wrap = $('#lessons-grid');
    if (!lessons.length) { wrap.innerHTML = '<div class="empty-note">Aucune leçon. Crée-en une depuis "Nouvelle leçon".</div>'; return; }
    wrap.innerHTML = `<div class="two-col">${lessons.map((l) => {
      const pct = Stats.lessonProgress(l.id);
      const n = Store.getItemsByLesson(l.id).length;
      return `<div class="card lesson-row" data-open="${l.id}" style="cursor:pointer">
        <div><div style="font-weight:700">${esc(l.title)}</div><div class="sub">${n} élément(s)</div>
        <div class="mini-progress"><span style="width:${pct}%"></span></div></div>
        <div class="pct">${pct}%</div></div>`;
    }).join('')}</div>`;
    $all('[data-open]', wrap).forEach((el) => el.onclick = () => openLesson(el.dataset.open));
  }

  function renderLessonDetail(id) {
    const lesson = Store.getLesson(id);
    if (!lesson) { go('lessons'); return; }
    $('#detail-title').textContent = lesson.title;
    const items = Store.getItemsByLesson(id);

    $('#detail-items').innerHTML = `
      <div class="filter-row" id="detail-filter">
        <button data-f="all" class="active">Tous (${items.length})</button>
        <button data-f="essential">🔴 Essentiel (${items.filter(i=>i.importance==='essential').length})</button>
        <button data-f="important">🟠 Important (${items.filter(i=>i.importance==='important').length})</button>
        <button data-f="secondary">🟢 Secondaire (${items.filter(i=>i.importance==='secondary').length})</button>
      </div>
      <div id="detail-items-list"></div>`;
    renderDetailList(items, 'all');
    $all('#detail-filter button').forEach((b) => b.onclick = () => {
      $all('#detail-filter button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      renderDetailList(items, b.dataset.f);
    });

    $('#chk-essential-only').checked = App.lessonFilterEssentialOnly;
    $('#chk-essential-only').onchange = (e) => { App.lessonFilterEssentialOnly = e.target.checked; };
    $('#btn-review-lesson').onclick = () => startLessonReview(id);
    $('#btn-learn-lesson').onclick = () => startLearnMode(id);
    $('#btn-test-blanc').onclick = () => startTestBlanc(id);
    $('#btn-add-item-detail').onclick = () => {
      const it = Analyzer.makeItem({ en: '', fr: '', type: 'vocab', importance: 'important' });
      it.lessonId = id;
      Store.addItem(it);
      renderLessonDetail(id);
    };
    $('#btn-delete-lesson').onclick = () => {
      if (confirm(`Supprimer la leçon "${lesson.title}" et tous ses éléments ?`)) {
        Store.deleteLesson(id);
        go('lessons');
      }
    };
  }

  function renderDetailList(items, filter) {
    const shown = filter === 'all' ? items : items.filter((i) => i.importance === filter);
    const wrap = $('#detail-items-list');
    if (!shown.length) { wrap.innerHTML = '<div class="empty-note">Rien à afficher.</div>'; return; }
    const groups = {};
    shown.forEach((it) => { (groups[it.type] = groups[it.type] || []).push(it); });
    wrap.innerHTML = Object.keys(groups).map((type) => `
      <div class="item-group"><h4>${TYPE_LABEL[type] || type}</h4>
      ${groups[type].map((it) => itemRowHTML(it, true) + masteryBadge(it)).join('')}</div>`).join('');
    bindItemRows(wrap, items, () => renderDetailList(items, filter));
  }

  function masteryBadge(it) {
    const labels = ['Nouveau', 'Reconnu', 'Mémorisé', 'Maîtrisé', 'Solide'];
    return `<div class="sub" style="margin:-4px 0 8px 6px">Niveau : ${labels[it.masteryLevel] || 'Nouveau'}</div>`;
  }

  // ---------------------------------------------------------------
  // MODE CONTRÔLE DEMAIN
  // ---------------------------------------------------------------
  function renderExamSetup() {
    const sel = $('#exam-lesson-select');
    const lessons = Store.getLessons();
    sel.innerHTML = `<option value="">Toutes mes leçons</option>` + lessons.map((l) => `<option value="${l.id}">${esc(l.title)}</option>`).join('');
    const wrap = $('#exam-durations');
    wrap.innerHTML = '';
    [5, 10, 20, 30, 45, 60].forEach((min) => {
      const b = document.createElement('button');
      b.className = 'btn danger';
      b.textContent = min + ' min';
      b.onclick = () => startExamSession(sel.value || null, min);
      wrap.appendChild(b);
    });
  }

  // On n'apprend jamais tout d'un coup : même en révision "générale" (pas seulement en mode
  // Apprendre), le nombre de mots jamais rencontrés introduits dans UNE session est plafonné.
  // Le reste de la session se concentre sur ce qui est déjà en cours d'apprentissage.
  function hasBeenSeen(item) {
    return SRS.SKILLS.some((k) => item.skills[k].reps > 0);
  }

  function capNewItems(ranked, targetCount) {
    const newCap = Math.max(3, Math.min(8, Math.ceil(targetCount / 3)));
    const selected = [];
    let newCount = 0;
    for (const it of ranked) {
      if (selected.length >= targetCount) break;
      const isNew = !hasBeenSeen(it);
      if (isNew && newCount >= newCap) continue; // assez de mots nouveaux pour cette session
      selected.push(it);
      if (isNew) newCount++;
    }
    return selected;
  }

  function startExamSession(lessonId, minutes) {
    const pool = lessonId ? Store.getItemsByLesson(lessonId).filter((i) => i.en) : reviewableItems();
    if (!pool.length) { toast('Aucun élément à réviser dans cette sélection.'); return; }
    const target = Math.max(6, Math.round(minutes * 2.2));
    const ranked = pool.slice().sort((a, b) => examScore(b) - examScore(a));
    const selected = capNewItems(ranked, target);
    startSession(selected, pool, target, 'exam', `Contrôle demain (${minutes} min)`);
  }

  function examScore(it) {
    const impWeight = { essential: 3, important: 1.5, secondary: 0.5 }[it.importance] || 1;
    const diff = SRS.difficultyFactor(it);
    const recentlyWrong = SRS.SKILLS.some((k) => it.skills[k].lastResult === false && Date.now() - (it.skills[k].lastDate || 0) < 3 * 86400000) ? 2 : 0;
    return impWeight * 2 + diff * 4 + (4 - it.masteryLevel) * 0.6 + recentlyWrong;
  }

  // ---------------------------------------------------------------
  // RÉVISION INTELLIGENTE / RAPIDE / PAR LEÇON
  // ---------------------------------------------------------------
  function smartScore(it, now) {
    const due = SRS.nextDue(it);
    const overdue = Math.max(0, now - due) / 3600000; // heures de retard
    const impWeight = { essential: 2, important: 1, secondary: 0.4 }[it.importance] || 1;
    const diff = SRS.difficultyFactor(it);
    return overdue * 0.6 + diff * 3 + impWeight + (4 - it.masteryLevel) * 0.4;
  }

  function startSmartReview(minutes, mode) {
    const pool = reviewableItems();
    if (!pool.length) { toast('Importe une leçon pour commencer à réviser !'); return; }
    const now = Date.now();
    const target = Math.max(6, Math.round(minutes * 2.2));
    const ranked = pool.slice().sort((a, b) => smartScore(b, now) - smartScore(a, now));
    const selected = capNewItems(ranked, target);
    startSession(selected, pool, target, mode, mode === 'smart' ? 'Révision intelligente' : `Révision rapide (${minutes} min)`);
  }

  function startLessonReview(lessonId) {
    const lesson = Store.getLesson(lessonId);
    let pool = Store.getItemsByLesson(lessonId).filter((i) => i.en);
    if (App.lessonFilterEssentialOnly) pool = pool.filter((i) => i.importance === 'essential');
    if (!pool.length) { toast('Aucun élément révisable dans cette leçon.'); return; }
    const target = Math.max(8, Math.min(pool.length * 2, 40));
    const now = Date.now();
    const ranked = pool.slice().sort((a, b) => smartScore(b, now) - smartScore(a, now));
    const selected = capNewItems(ranked, target);
    startSession(selected, pool, target, 'lesson', lesson.title);
  }

  // ---------------------------------------------------------------
  // TEST BLANC
  // ---------------------------------------------------------------
  function startTestBlanc(lessonId) {
    const lesson = Store.getLesson(lessonId);
    const pool = Store.getItemsByLesson(lessonId).filter((i) => i.en);
    if (pool.length < 3) { toast('Pas assez d\'éléments pour un test blanc (minimum 3).'); return; }
    const target = Math.min(20, Math.max(8, pool.length));
    startSession(Exercises.shuffle(pool).slice(0, target), pool, target, 'test', lesson.title);
  }

  // ---------------------------------------------------------------
  // MOTEUR DE SESSION GÉNÉRIQUE
  // ---------------------------------------------------------------
  function startSession(targetItems, pool, targetCount, mode, label, onEnd) {
    const queue = Exercises.buildSession(targetItems, pool.length ? pool : targetItems, targetCount);
    if (!queue.length) { toast('Pas assez de contenu pour construire une session.'); return; }
    App.session = { queue, index: 0, correct: 0, total: 0, byKind: {}, byCategory: {}, mode, label, startTime: Date.now(), requeued: {}, wrongItems: [], onEnd: onEnd || null };
    go('session');
    renderSessionStep();
  }

  function categoryForKind(kind, item) {
    if (kind === 'translation') return 'traduction';
    if (item && (item.type === 'expression' || item.type === 'phrasal_verb')) return 'expressions';
    return 'vocabulaire';
  }

  function recordResult(step, correct, opts) {
    opts = opts || {};
    const s = App.session;
    s.total++;
    if (correct) s.correct++;
    s.byKind[step.kind] = s.byKind[step.kind] || [0, 0];
    s.byKind[step.kind][1]++;
    if (correct) s.byKind[step.kind][0]++;
    const cat = categoryForKind(step.kind, step.item);
    s.byCategory[cat] = s.byCategory[cat] || [0, 0];
    s.byCategory[cat][1]++;
    if (correct) s.byCategory[cat][0]++;

    if (step.item && step.skillName) {
      SRS.applyResult(step.item, step.skillName, correct, { hesitant: opts.hesitant });
      step.item.lastSkillUsed = step.skillName;
      step.item.history = step.item.history || [];
      step.item.history.push({ date: Date.now(), kind: step.kind, correct });
      if (step.item.history.length > 30) step.item.history.shift();
      Store.markDirty();
    }
    if (!correct && step.item) {
      s.wrongItems.push(step.item);
      const already = s.requeued[step.item.id] || 0;
      if (already < 1 && s.queue.length < s.index + 8) {
        const pos = Math.min(s.queue.length, s.index + 3 + Math.floor(Math.random() * 3));
        const altDirection = step.direction === 'en_fr' ? 'fr_en' : 'en_fr';
        s.queue.splice(pos, 0, Exercises.genActiveRecall(step.item, altDirection));
        s.requeued[step.item.id] = already + 1;
      }
    }
  }

  function skillNameForKind(kind, direction) {
    if (kind === 'listening') return 'listening';
    if (kind === 'translation') return 'fr_en';
    if (direction === 'fr_en') return 'fr_en';
    return 'en_fr';
  }

  function renderSessionStep() {
    const s = App.session;
    if (!s) return;
    if (s.index >= s.queue.length) { endSession(); return; }
    $('#session-index').textContent = s.index + 1;
    $('#session-total').textContent = s.queue.length;
    $('#session-progress-fill').style.width = Math.round((s.index / s.queue.length) * 100) + '%';
    const step = s.queue[s.index];
    step.skillName = skillNameForKind(step.kind, step.direction);
    const body = $('#session-body');
    body.innerHTML = '';
    const renderers = {
      flashcard: renderFlashcard, recall: renderRecall, translation: renderTranslation,
      listening: renderListening, visual: renderVisualEx,
      matching: renderMatching, note: renderNote,
      verbforms: renderVerbForms,
    };
    (renderers[step.kind] || renderNote)(body, step);
  }

  function nextStep() { App.session.index++; renderSessionStep(); }

  function kindTag(label) { return `<div class="exercise-kind-tag">${label}</div>`; }

  // Qu'on ait juste ou faux, la bonne réponse doit toujours être affichée (indispensable
  // notamment avec la case "je sais déjà" : on doit pouvoir vérifier qu'on avait bien raison).
  function feedbackHTML(correct, correctAnswer, tip, close) {
    const cls = correct ? 'good' : 'bad';
    const head = correct
      ? (close ? `✅ Correct (à l'orthographe près) — Réponse : ${esc(correctAnswer)}` : `✅ Correct ! Réponse : ${esc(correctAnswer)}`)
      : `❌ La bonne réponse : ${esc(correctAnswer)}`;
    return `<div class="feedback-box ${cls}">${head}${tip ? `<div class="tip">💡 ${esc(tip)}</div>` : ''}</div>`;
  }

  function continueButton(container) {
    const b = document.createElement('button');
    b.className = 'btn primary';
    b.textContent = 'Continuer →';
    b.style.marginTop = '10px';
    b.onclick = nextStep;
    container.appendChild(b);
    b.focus();
  }

  // --- Flashcard ---
  function renderFlashcard(body, step) {
    body.innerHTML = `<div class="exercise-card">
      ${kindTag('🃏 Flashcard')}
      <div class="exercise-prompt">${esc(step.front)}</div>
      <div id="fc-back" hidden><div class="exercise-answer">${esc(step.back)}</div></div>
      <div class="exercise-actions" id="fc-actions">
        <button class="btn primary" id="fc-reveal">Afficher la réponse</button>
      </div>
    </div>`;
    $('#fc-reveal').onclick = () => {
      $('#fc-back').hidden = false;
      $('#fc-actions').innerHTML = `<div class="self-rate-row">
        <button data-r="no" title="Je ne savais pas">❌</button>
        <button data-r="mid" title="J'ai hésité">😐</button>
        <button data-r="yes" title="Je savais">✅</button>
      </div>`;
      $all('#fc-actions button').forEach((b) => b.onclick = () => {
        const r = b.dataset.r;
        $('#fc-actions').innerHTML = '';
        recordResult(step, r !== 'no', { hesitant: r === 'mid' });
        const box = document.createElement('div');
        box.innerHTML = feedbackHTML(r !== 'no', step.back, r==='no' ? mnemonicFor(step.item) : null, false);
        $('#session-body').appendChild(box);
        continueButton($('#session-body'));
      });
    };
  }

  function mnemonicFor(item) {
    if (!item) return null;
    return item.mnemonicTip || (item.visual ? item.visual.mnemonic : null);
  }

  // --- Rappel actif ---
  // Case à cocher présente sur tous les exercices à réponse tapée : permet de dire "je sais"
  // sans avoir à écrire le mot, plutôt que de forcer la frappe à chaque fois.
  function knowCheckboxHTML() {
    return `<label class="know-toggle"><input type="checkbox" id="know-cb"> Je sais déjà (sans écrire)</label>`;
  }
  function isKnowChecked() {
    const cb = document.getElementById('know-cb');
    return !!(cb && cb.checked);
  }

  function renderRecall(body, step) {
    body.innerHTML = `<div class="exercise-card">
      ${kindTag(step.direction === 'fr_en' ? '🧠 Rappel actif — Français → Anglais' : '🧠 Rappel actif — Anglais → Français')}
      <div class="exercise-prompt">${esc(step.prompt)}</div>
      <input type="text" class="exercise-input" id="recall-input" autocomplete="off" placeholder="Tape ta réponse...">
      ${knowCheckboxHTML()}
      <div class="exercise-actions"><button class="btn primary" id="recall-submit">Valider</button></div>
    </div>`;
    const submit = () => {
      const val = $('#recall-input').value;
      const res = isKnowChecked() ? { correct: true, close: false, closestMatch: step.answer } : Exercises.checkAnswer(val, step.answer);
      recordResult(step, res.correct);
      $('#recall-input').disabled = true;
      $('#recall-submit').remove();
      const box = document.createElement('div');
      box.innerHTML = feedbackHTML(res.correct, res.closestMatch || step.answer, !res.correct ? mnemonicFor(step.item) : null, res.close);
      $('.exercise-card').appendChild(box);
      continueButton($('.exercise-card'));
    };
    $('#recall-submit').onclick = submit;
    $('#recall-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    $('#recall-input').focus();
  }

  // --- Traduction ---
  function renderTranslation(body, step) {
    body.innerHTML = `<div class="exercise-card">
      ${kindTag('✍️ Traduction')}
      <div class="exercise-sub">Traduis en anglais :</div>
      <div class="exercise-prompt">${esc(step.prompt)}</div>
      <input type="text" class="exercise-input" id="tr-input" autocomplete="off" placeholder="Your translation...">
      ${knowCheckboxHTML()}
      <div class="exercise-actions"><button class="btn primary" id="tr-submit">Valider</button></div>
    </div>`;
    const submit = () => {
      const val = $('#tr-input').value;
      const res = isKnowChecked() ? { correct: true, ratio: 1 } : Exercises.checkSentence(val, step.answer);
      recordResult(step, res.correct);
      $('#tr-input').disabled = true;
      $('#tr-submit').remove();
      const tip = !res.correct ? `Compare mot à mot avec ta phrase pour voir la différence.` : null;
      const box = document.createElement('div');
      box.innerHTML = feedbackHTML(res.correct, step.answer, tip, false);
      $('.exercise-card').appendChild(box);
      continueButton($('.exercise-card'));
    };
    $('#tr-submit').onclick = submit;
    $('#tr-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    $('#tr-input').focus();
  }

  // --- Écoute ---
  function speak(text) {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.9;
      global.speechSynthesis.cancel();
      global.speechSynthesis.speak(u);
    } catch (e) { /* synthèse vocale indisponible */ }
  }

  function renderListening(body, step) {
    body.innerHTML = `<div class="exercise-card">
      ${kindTag('👂 Prononciation')}
      <button class="speak-btn" id="ls-speak">🔊</button>
      <div class="exercise-sub">Écoute et écris le mot que tu entends.</div>
      <input type="text" class="exercise-input" id="ls-input" autocomplete="off">
      ${knowCheckboxHTML()}
      <div class="exercise-actions"><button class="btn primary" id="ls-submit">Valider</button></div>
    </div>`;
    speak(step.textToSpeak);
    $('#ls-speak').onclick = () => speak(step.textToSpeak);
    const submit = () => {
      const res = isKnowChecked() ? { correct: true, close: false } : Exercises.checkAnswer($('#ls-input').value, step.answer);
      recordResult(step, res.correct);
      $('#ls-input').disabled = true;
      $('#ls-submit').remove();
      const box = document.createElement('div');
      box.innerHTML = feedbackHTML(res.correct, step.answer, null, res.close);
      $('.exercise-card').appendChild(box);
      continueButton($('.exercise-card'));
    };
    $('#ls-submit').onclick = submit;
    $('#ls-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    $('#ls-input').focus();
  }

  // --- Mémoire visuelle ---
  function renderVisualEx(body, step) {
    body.innerHTML = `<div class="exercise-card">
      ${kindTag('🖼️ Mémoire visuelle')}
      <div class="exercise-emoji">${step.emoji}</div>
      <div class="exercise-sub">Quel est le mot anglais ?</div>
      <input type="text" class="exercise-input" id="vi-input" autocomplete="off">
      ${knowCheckboxHTML()}
      <div class="exercise-actions"><button class="btn primary" id="vi-submit">Valider</button></div>
    </div>`;
    const submit = () => {
      const res = isKnowChecked() ? { correct: true, close: false } : Exercises.checkAnswer($('#vi-input').value, step.answer);
      recordResult(step, res.correct);
      $('#vi-input').disabled = true;
      $('#vi-submit').remove();
      const box = document.createElement('div');
      box.innerHTML = feedbackHTML(res.correct, step.answer, null, res.close);
      $('.exercise-card').appendChild(box);
      continueButton($('.exercise-card'));
    };
    $('#vi-submit').onclick = submit;
    $('#vi-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    $('#vi-input').focus();
  }

  // --- Association ---
  function renderMatching(body, step) {
    let selectedLeft = null, matchedCount = 0;
    const leftItems = step.leftShuffled.map((id) => step.pairs.find((p) => p.id === id));
    const rightItems = step.rightShuffled.map((id) => step.pairs.find((p) => p.id === id));
    body.innerHTML = `<div class="exercise-card">
      ${kindTag('🧩 Association')}
      <div class="matching-grid">
        <div class="matching-col" id="match-left">${leftItems.map((p) => `<div class="match-card" data-id="${p.id}">${esc(p.en)}</div>`).join('')}</div>
        <div class="matching-col" id="match-right">${rightItems.map((p) => `<div class="match-card" data-id="${p.id}">${esc(p.fr)}</div>`).join('')}</div>
      </div>
    </div>`;
    $all('#match-left .match-card').forEach((el) => el.onclick = () => {
      if (el.classList.contains('matched')) return;
      $all('#match-left .match-card').forEach((x) => x.classList.remove('selected'));
      el.classList.add('selected');
      selectedLeft = el.dataset.id;
    });
    $all('#match-right .match-card').forEach((el) => el.onclick = () => {
      if (el.classList.contains('matched') || !selectedLeft) return;
      const leftEl = $(`#match-left [data-id="${selectedLeft}"]`);
      if (selectedLeft === el.dataset.id) {
        el.classList.add('matched'); leftEl.classList.add('matched');
        el.classList.remove('selected'); leftEl.classList.remove('selected');
        matchedCount++;
        selectedLeft = null;
        if (matchedCount === leftItems.length) {
          recordResult(step, true);
          const box = document.createElement('div');
          box.innerHTML = feedbackHTML(true, 'Toutes les paires trouvées !', null, false);
          $('.exercise-card').appendChild(box);
          continueButton($('.exercise-card'));
        }
      } else {
        el.classList.add('wrong-flash');
        setTimeout(() => el.classList.remove('wrong-flash'), 400);
      }
    });
  }

  // --- Note (règle de grammaire / culture) ---
  function renderNote(body, step) {
    const it = step.item;
    const label = it && it.type === 'culture' ? '🌍 Info culturelle' : '📐 Règle importante';
    body.innerHTML = `<div class="exercise-card">
      ${kindTag(label)}
      <div class="exercise-prompt" style="font-size:1.2em">${esc(it ? it.fr : '')}</div>
      <div class="exercise-actions"><button class="btn primary" id="note-ok">J'ai compris</button></div>
    </div>`;
    $('#note-ok').onclick = () => { App.session.total++; App.session.correct++; nextStep(); };
  }

  // --- Formes d'une famille de mots (verbe irrégulier, comparatif irrégulier) ---
  function renderVerbForms(body, step) {
    body.innerHTML = `<div class="exercise-card">
      ${kindTag({ irregular_comparative: '📶 Comparatif irrégulier', irregular_plural: '🔢 Pluriel irrégulier' }[step.item.type] || '🔁 Verbe irrégulier')}
      <div class="exercise-sub">Retrouve les 3 formes pour : <b>${esc(step.meaning)}</b></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:6px;">
        ${step.labels.map((l, i) => `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
          <label style="font-size:.72em;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.03em;">${esc(l)}</label>
          <input type="text" class="exercise-input vf-input" data-idx="${i}" style="max-width:150px;margin-top:0;" autocomplete="off" autocapitalize="off">
        </div>`).join('')}
      </div>
      ${knowCheckboxHTML()}
      <div class="exercise-actions"><button class="btn primary" id="vf-submit">Valider</button></div>
    </div>`;
    const submit = () => {
      const know = isKnowChecked();
      const inputs = $all('.vf-input');
      const results = inputs.map((inp, i) => {
        const res = know ? { correct: true } : Exercises.checkAnswer(inp.value, step.forms[i]);
        inp.disabled = true;
        inp.style.borderColor = res.correct ? 'var(--good)' : 'var(--bad)';
        return res.correct;
      });
      const allCorrect = results.every(Boolean);
      recordResult(step, allCorrect);
      $('#vf-submit').remove();
      const box = document.createElement('div');
      box.innerHTML = feedbackHTML(allCorrect, step.forms.join('  →  '), !allCorrect ? mnemonicFor(step.item) : null, false);
      $('.exercise-card').appendChild(box);
      continueButton($('.exercise-card'));
    };
    $('#vf-submit').onclick = submit;
    const vfInputs = $all('.vf-input');
    vfInputs.forEach((inp, i) => inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const next = vfInputs[i + 1]; if (next) next.focus(); else submit(); }
    }));
    if (vfInputs[0]) vfInputs[0].focus();
  }

  // ---------------------------------------------------------------
  // FIN DE SESSION
  // ---------------------------------------------------------------
  function endSession() {
    const s = App.session;
    Store.touchDailyStreak();
    Store.logSession({
      id: Store.uid('session'), date: Date.now(), mode: s.mode, label: s.label,
      durationSec: Math.round((Date.now() - s.startTime) / 1000),
      itemCount: s.queue.length, correct: s.correct, total: s.total,
      byKind: Object.entries(s.byKind),
    });
    if (s.onEnd) { s.onEnd(s); return; }
    go('session-end');
    const pct = s.total ? Math.round((s.correct / s.total) * 100) : 0;
    let html = `<div class="today-title">${esc(s.label || 'Session terminée')}</div>
      <div class="end-score">${pct}%</div>
      <div class="sub">${s.correct} / ${s.total} bonnes réponses</div>
      <div class="end-breakdown">${Object.keys(s.byKind).map((k) => {
        const [c, t] = s.byKind[k];
        return `<div class="chip">${k} : ${Math.round((c / t) * 100)}%</div>`;
      }).join('')}</div>`;
    if (s.mode === 'test') {
      const cat = s.byCategory;
      const note20 = Math.round(pct / 5 * 10) / 10;
      html += `<div class="end-score" style="font-size:1.8em">Note estimée : ${note20} / 20</div>
        <div class="end-breakdown">${Object.keys(cat).map((k) => `<div class="chip">${k} : ${Math.round(cat[k][0]/cat[k][1]*100)}%</div>`).join('')}</div>`;
      const worst = uniqueBy(s.wrongItems, (i) => i.id).slice(0, 5);
      if (worst.length) {
        html += `<div class="section-title">Voici les ${worst.length} choses à revoir en priorité :</div>
          <ul class="end-list">${worst.map((it) => `<li><b>${esc(it.en || it.fr)}</b> — ${esc(it.fr && it.en ? it.fr : '')}</li>`).join('')}</ul>`;
      }
    }
    $('#session-end-content').innerHTML = html;
  }

  function uniqueBy(arr, keyFn) {
    const seen = new Set(); const out = [];
    arr.forEach((x) => { const k = keyFn(x); if (!seen.has(k)) { seen.add(k); out.push(x); } });
    return out;
  }

  // ---------------------------------------------------------------
  // MODE APPRENDRE UNE LEÇON (depuis zéro, par groupes)
  // ---------------------------------------------------------------
  function startLearnMode(lessonId) {
    const lesson = Store.getLesson(lessonId);
    const items = Store.getItemsByLesson(lessonId).filter((i) => i.en)
      .sort((a, b) => ({essential:0,important:1,secondary:2}[a.importance] - {essential:0,important:1,secondary:2}[b.importance]));
    if (!items.length) { toast('Aucun mot à apprendre dans cette leçon.'); return; }
    const groups = [];
    for (let i = 0; i < items.length; i += GROUP_SIZE) groups.push(items.slice(i, i + GROUP_SIZE));
    App.learn = { lessonId, lessonTitle: lesson.title, groups, groupIndex: 0, wordIndex: 0 };
    renderLearnStudy();
  }

  function renderLearnStudy() {
    go('session');
    const L = App.learn;
    const group = L.groups[L.groupIndex];
    const word = group[L.wordIndex];
    const body = $('#session-body');
    $('#session-index').textContent = L.wordIndex + 1;
    $('#session-total').textContent = group.length;
    $('#session-progress-fill').style.width = Math.round((L.wordIndex / group.length) * 100) + '%';
    const formsLabels = (word.formLabels || ['base', 'prétérit', 'participe passé']).map((l) => l.toLowerCase());
    body.innerHTML = `<div class="exercise-card">
      ${kindTag(`🎓 Apprendre — Groupe ${L.groupIndex + 1}/${L.groups.length}`)}
      <div class="exercise-emoji">${word.visual ? word.visual.emoji : '📘'}</div>
      ${word.forms
        ? `<div class="exercise-prompt" style="font-size:1.3em">${word.forms.map((f) => esc(f)).join('  →  ')}</div>
           <div class="exercise-sub">${word.forms.map((f, i) => formsLabels[i]).join(' · ')}</div>`
        : `<div class="exercise-prompt">${esc(word.en)}</div>`}
      <div class="exercise-answer">${esc(word.fr)}</div>
      <button class="speak-btn" id="learn-speak">🔊</button>
      ${!word.forms && word.example ? `<div class="exercise-sub">Ex : ${esc(word.example.en)}<br>${esc(word.example.fr)}</div>` : ''}
      ${!word.forms && !word.example && Exercises.getExampleSentence(word) ? `<div class="exercise-sub">Ex : ${esc(Exercises.getExampleSentence(word).en)}</div>` : ''}
      ${mnemonicFor(word) ? `<div class="feedback-box good tip" style="background:var(--accent-soft);color:var(--accent)">💡 ${esc(mnemonicFor(word))}</div>` : ''}
      <div class="exercise-actions"><button class="btn primary" id="learn-next">${L.wordIndex + 1 < group.length ? 'Mot suivant →' : 'Passer au petit test →'}</button></div>
    </div>`;
    const speakWord = () => {
      if (word.forms) word.forms.forEach((f, i) => setTimeout(() => speak(f), i * 700));
      else speak(word.en);
    };
    $('#learn-speak').onclick = speakWord;
    speakWord();
    $('#learn-next').onclick = () => {
      L.wordIndex++;
      if (L.wordIndex < group.length) renderLearnStudy();
      else startGroupQuiz();
    };
  }

  function startGroupQuiz() {
    const L = App.learn;
    const group = L.groups[L.groupIndex];
    const previousWords = L.groups.slice(0, L.groupIndex).flat();
    const mixIn = Exercises.shuffle(previousWords).slice(0, Math.min(2, previousWords.length));
    const pool = group.concat(mixIn);
    const target = group.length + mixIn.length + 2;
    startSession(pool, pool, target, 'learn-quiz', `Groupe ${L.groupIndex + 1} — petit test`, (s) => onGroupQuizEnd(s));
  }

  function onGroupQuizEnd(s) {
    const L = App.learn;
    const pct = s.total ? Math.round((s.correct / s.total) * 100) : 0;
    go('session-end');
    const passed = pct >= 70;
    let html = `<div class="today-title">Groupe ${L.groupIndex + 1} — résultat</div>
      <div class="end-score">${pct}%</div>
      <div class="sub">${passed ? '✅ Groupe validé !' : '🔁 Encore un petit effort sur ce groupe.'}</div>`;
    const btn = document.createElement('button');
    btn.className = 'btn primary';
    const hasNext = L.groupIndex + 1 < L.groups.length;
    btn.textContent = passed ? (hasNext ? 'Groupe suivant →' : 'Terminer la leçon 🎉') : 'Revoir ce groupe';
    $('#session-end-content').innerHTML = html;
    $('#session-end-content').appendChild(btn);
    btn.onclick = () => {
      if (passed && hasNext) { L.groupIndex++; L.wordIndex = 0; renderLearnStudy(); }
      else if (passed && !hasNext) { toast('Bravo, leçon terminée !'); App.learn = null; go('home'); }
      else { L.wordIndex = 0; renderLearnStudy(); }
    };
  }

  // ---------------------------------------------------------------
  // STATISTIQUES
  // ---------------------------------------------------------------
  const COMP_LABELS = { en_fr: 'Anglais → Français', fr_en: 'Français → Anglais', traduction: 'Traduction',
    vocabulaire: 'Vocabulaire', expressions: 'Expressions' };

  function renderStats() {
    const g = Stats.globalCounts();
    $('#stats-tiles').innerHTML = [
      ['Mots appris', g.learned], ['En cours', g.inProgress], ['Difficiles', g.difficult],
      ['Révisés aujourd\'hui', g.reviewedToday], ['Série de jours', Store.getSettings().streak],
      ['Sessions', Store.getSessions().length],
    ].map(([l, v]) => `<div class="stat-tile"><div class="value">${v}</div><div class="label">${l}</div></div>`).join('');

    const comp = Stats.competencyTable();
    $('#stats-competency-table').innerHTML = Object.keys(COMP_LABELS).map((k) => `<tr><td>${COMP_LABELS[k]}</td><td>${comp[k] == null ? '—' : comp[k] + '%'}</td></tr>`).join('');

    const diff = Stats.difficultWords(10);
    $('#stats-difficult-list').innerHTML = diff.length ? diff.map((d) => `<div class="diff-row"><span>${esc(d.item.en || d.item.fr.slice(0,40))}</span><span class="rate ${rateClass(d.rate)}">${d.rate}%</span></div>`).join('') : '<div class="empty-note">Pas encore de données.</div>';

    renderBarChart('#stats-chart', Stats.progressHistory(14));

    const lessons = Store.getLessons();
    $('#stats-lessons').innerHTML = lessons.length ? lessons.map((l) => {
      const pct = Stats.lessonProgress(l.id);
      return `<div class="lesson-row"><span>${esc(l.title)}</span><span class="pct">${pct}%</span></div>`;
    }).join('') : '<div class="empty-note">Aucune leçon.</div>';
  }

  // ---------------------------------------------------------------
  // RÉGLAGES
  // ---------------------------------------------------------------
  function bindSettings() {
    $('#btn-export').onclick = () => {
      const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'revision-anglais-export.json';
      a.click();
    };
    $('#btn-reset').onclick = () => {
      if (confirm('Tout supprimer (leçons, progression, statistiques) ? Cette action est irréversible.')) {
        Store.resetAll();
        toast('Données réinitialisées.');
        go('home');
      }
    };
  }

  // ---------------------------------------------------------------
  // INIT
  // ---------------------------------------------------------------
  function init() {
    $all('#main-nav button').forEach((b) => b.onclick = () => go(b.dataset.nav));
    $('#btn-quit-session').onclick = () => { if (confirm('Quitter la session en cours ?')) { App.session = null; go('home'); } };
    bindNewLessonButtons();
    bindSettings();
    Store.touchDailyStreak();
    go('home');
  }

  global.UI = { go, init, App };
})(window);
