// Interface : navigation entre écrans, rendu, entraînement "Apprendre"
// (révélation à la demande, par lignée évolutive complète), moteur de
// session "Jeu" (quiz), raccourcis clavier.
const UI = (() => {
  let currentScreen = 'home';
  let session = null; // session de "Jeu" en cours (voir startPlaySession)
  let learnTraining = null; // entraînement "Apprendre" en cours (voir startLearnLine)

  // ---------- Utilitaires ----------
  function $(sel, root = document) { return root.querySelector(sel); }
  function $all(sel, root = document) { return [...root.querySelectorAll(sel)]; }
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) node.setAttribute(k, v);
    }
    for (const c of [].concat(children)) {
      if (c === null || c === undefined) continue;
      const isPrimitive = typeof c === 'string' || typeof c === 'number';
      node.appendChild(isPrimitive ? document.createTextNode(String(c)) : c);
    }
    return node;
  }
  function imgOrPlaceholder(path, alt, cls) {
    if (path) return `<img src="${path}" alt="${escapeHtml(alt)}" loading="lazy" class="${cls || ''}">`;
    return `<div class="${cls || ''}" style="display:flex;align-items:center;justify-content:center;background:var(--surface-2);color:var(--text-muted);font-size:2rem;">?</div>`;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.add('hidden'), 2600);
  }
  function fmtHeight(dm) { return `${(dm / 10).toFixed(1)} m`; }
  function fmtWeight(hg) { return `${(hg / 10).toFixed(1)} kg`; }

  // ---------- Navigation ----------
  function navigate(screenId) {
    if ((session || learnTraining) && screenId !== 'play') {
      const ok = confirm('Quitter la session en cours ? Ta progression sur les questions déjà répondues est conservée.');
      if (!ok) return;
      if (session) endSession(false);
      if (learnTraining) learnTraining = null;
    }
    currentScreen = screenId;
    $all('.screen').forEach((s) => s.classList.remove('active'));
    $(`#screen-${screenId}`).classList.add('active');
    $all('#main-nav button[data-nav]').forEach((b) => b.setAttribute('aria-current', String(b.dataset.nav === screenId)));
    const renderers = {
      home: renderHome,
      learn: renderLearn,
      review: renderReview,
      'quiz-config': renderQuizConfig,
      pokedex: renderPokedexScreen,
      stats: renderStats,
      settings: renderSettings,
    };
    if (renderers[screenId]) renderers[screenId]();
    window.scrollTo(0, 0);
  }

  function initNav() {
    $all('[data-nav]').forEach((btn) => btn.addEventListener('click', () => navigate(btn.dataset.nav)));
  }

  // ================= ACCUEIL =================
  function renderHome() {
    const all = PokedexData.getAll();
    const progress = Storage.getAllProgress();
    const stats = Storage.getSessionStats();
    const summary = Stats.globalSummary(all, progress, stats);

    $('#home-headline').textContent = `${summary.mastered} / ${summary.total}`;
    $('#home-progress-fill').style.width = `${Math.round((summary.mastered / summary.total) * 100)}%`;
    $('#home-learning').textContent = summary.learning;
    $('#home-toreview').textContent = summary.toReview;
    $('#home-score').textContent = `${summary.masteryScorePct}%`;
    $('#home-accuracy').textContent = summary.accuracyPct === null ? '—' : `${summary.accuracyPct}%`;

    const byGen = Stats.groupProgress(all, progress, (p) => `Gén. ${p.generation}`);
    $('#home-chart-gen').innerHTML = Stats.barChart(byGen);
  }

  // ================= APPRENDRE =================
  // Un groupe = une lignée évolutive complète. Tous les groupes sont
  // disponibles dès le départ (pas de déblocage progressif).
  function renderLearn() {
    const progress = Storage.getAllProgress();
    const query = $('#learn-search').value;
    const lines = PokedexData.allEvolutionLines();
    const filtered = query
      ? lines.filter((line) => line.ids.some((id) => PokedexData.normalize(PokedexData.getById(id).name).includes(PokedexData.normalize(query))))
      : lines;

    const byGen = new Map();
    filtered.forEach((line) => {
      if (!byGen.has(line.generation)) byGen.set(line.generation, []);
      byGen.get(line.generation).push(line);
    });

    const wrap = $('#learn-groups');
    wrap.innerHTML = '';
    if (!filtered.length) {
      wrap.appendChild(el('p', { class: 'headline-sub' }, 'Aucune lignée ne correspond à cette recherche.'));
      return;
    }
    [...byGen.keys()].sort((a, b) => a - b).forEach((gen) => {
      wrap.appendChild(el('div', { class: 'section-title' }, `Génération ${gen}`));
      const grid = el('div', { class: 'line-grid' });
      byGen.get(gen).forEach((line) => grid.appendChild(renderLineCard(line, progress)));
      wrap.appendChild(grid);
    });
  }

  // Carte compacte : beaucoup de lignées visibles à la fois, empilées en
  // grille plutôt qu'en liste verticale.
  function renderLineCard(line, progress) {
    const members = line.ids.map((id) => PokedexData.getById(id));
    const seenCount = members.filter((p) => (progress[p.id]?.timesSeen || 0) > 0).length;
    const allSeen = seenCount === members.length;
    const maxThumbs = 4;
    const card = el('div', { class: 'line-card' });
    const row = el('div', { class: 'line-members' });
    members.slice(0, maxThumbs).forEach((p) => {
      const seen = (progress[p.id]?.timesSeen || 0) > 0;
      row.appendChild(el('div', {
        class: `line-thumb ${seen ? '' : 'unseen'}`, title: p.name,
        onclick: (e) => { e.stopPropagation(); openPokemonDetail(p.id); },
      }, [el('div', { html: imgOrPlaceholder(p.image, p.name, '') })]));
    });
    if (members.length > maxThumbs) {
      row.appendChild(el('div', { class: 'line-thumb-more' }, `+${members.length - maxThumbs}`));
    }
    card.appendChild(row);
    card.appendChild(el('div', { class: 'line-title', title: members.map((m) => m.name).join(' → ') }, members.map((m) => m.name).join(' → ')));
    card.appendChild(el('div', { class: 'line-sub' }, allSeen ? '✅ Vue' : `${seenCount}/${members.length} vus`));
    card.appendChild(el('button', { class: 'btn primary line-train-btn', onclick: () => startLearnLine(members) }, "S'entraîner"));
    return card;
  }

  // ================= REVISER =================
  function renderReview() {
    const all = PokedexData.getAll();
    const progress = Storage.getAllProgress();
    const dueIds = SRS.buildDueQueue(progress, all.map((p) => p.id));
    const weakIds = SRS.buildWeaknessList(progress, all.map((p) => p.id), 20);
    const allModes = Object.keys(QuizEngine.MODE_LABELS);

    $('#review-due-count').textContent = dueIds.length;
    $('#review-start-due').disabled = dueIds.length === 0;
    $('#review-start-due').onclick = () => startPlaySession({ modes: allModes, queue: dueIds.map((id) => PokedexData.getById(id)), format: 'normal', count: dueIds.length, sourceScreen: 'review' });
    $('#review-start-weak').disabled = weakIds.length === 0;
    $('#review-start-weak').onclick = () => startPlaySession({ modes: allModes, queue: weakIds.map((id) => PokedexData.getById(id)), format: 'normal', count: weakIds.length, sourceScreen: 'review' });

    const grid = $('#review-weak-grid');
    grid.innerHTML = '';
    weakIds.forEach((id) => grid.appendChild(pokeCard(PokedexData.getById(id), progress[id])));
  }

  // ================= JEU (quiz) =================
  function renderQuizConfig() {
    const modeWrap = $('#quiz-mode-picker');
    modeWrap.innerHTML = '';
    Object.entries(QuizEngine.MODE_LABELS).forEach(([key, label]) => {
      modeWrap.appendChild(el('label', {}, [
        el('input', { type: 'checkbox', name: 'quiz-mode', value: key, checked: 'checked' }),
        label,
      ]));
    });

    $all('input[name="format"]').forEach((r) => {
      r.onchange = () => $('#quiz-timeattack-durations').classList.toggle('hidden', r.value !== 'timeattack' || !r.checked);
    });

    fillCheckboxGroup('#quiz-filter-gen', PokedexData.getGenerations().map((g) => ({ value: g, label: `Gén. ${g}` })));
    fillCheckboxGroup('#quiz-filter-type', PokedexData.getTypes().map((t) => ({ value: t, label: t })));
    fillCheckboxGroup('#quiz-filter-region', PokedexData.getRegions().map((r) => ({ value: r, label: r })));

    $('#quiz-start-btn').onclick = () => {
      const modes = checkedValues('#quiz-mode-picker');
      if (!modes.length) { toast('Sélectionne au moins un sujet à réviser.'); return; }
      const format = $('input[name="format"]:checked')?.value || 'normal';
      const gens = checkedValues('#quiz-filter-gen').map(Number);
      const types = checkedValues('#quiz-filter-type');
      const regions = checkedValues('#quiz-filter-region');
      let pool = PokedexData.filter({ generations: gens, types, regions });
      pool = pool.filter((p) => Storage.getProgress(p.id).timesSeen > 0);
      if (pool.length < 4) { toast("Pas assez de Pokémon déjà vus avec ces filtres — apprends-en d'abord dans « Apprendre »."); return; }

      let timeLimitMs = null;
      if (format === 'timeattack') {
        const custom = parseInt($('#quiz-duration-custom').value, 10);
        const duration = custom > 0 ? custom : parseInt($('input[name="duration"]:checked')?.value || '60', 10);
        timeLimitMs = duration * 1000;
      }
      startPlaySession({ modes, pool, format, timeLimitMs, count: format === 'normal' ? Math.min(20, pool.length) : Infinity });
    };
  }

  function fillCheckboxGroup(sel, items) {
    const wrap = $(sel);
    wrap.innerHTML = '';
    items.forEach((it) => {
      wrap.appendChild(el('label', {}, [
        el('input', { type: 'checkbox', value: it.value }),
        String(it.label),
      ]));
    });
  }
  function checkedValues(sel) {
    return $all(`${sel} input:checked`).map((i) => i.value);
  }

  // ================= APPRENDRE : entraînement à révélation =================
  function startLearnLine(members) {
    learnTraining = { members, idx: 0, sourceScreen: currentScreen };
    currentScreen = 'play';
    $all('.screen').forEach((s) => s.classList.remove('active'));
    $('#screen-play').classList.add('active');
    $all('#main-nav button[data-nav]').forEach((b) => b.setAttribute('aria-current', 'false'));
    renderLearnTrainingCard();
  }

  function renderLearnTrainingCard() {
    const { members, idx } = learnTraining;
    const p = members[idx];
    applyExposure(p.id);
    $('#play-progress').textContent = `Pokémon ${idx + 1} / ${members.length}`;
    $('#play-score').textContent = '';
    $('#play-feedback').innerHTML = '';
    const stage = $('#play-stage');
    stage.innerHTML = '';
    stage.appendChild(buildRevealCard(p));
    const nextLabel = idx < members.length - 1 ? 'Suivant →' : 'Terminer';
    stage.appendChild(el('div', { class: 'btn-row', style: 'justify-content:center;margin-top:16px;' }, [
      el('button', { class: 'btn primary', onclick: () => learnTrainingAdvance() }, `${nextLabel} (Entrée)`),
    ]));
  }

  function buildRevealCard(p) {
    const card = el('div', {});
    const imgWrap = el('div', { class: 'quiz-image-wrap clickable', style: 'width:240px;height:240px;', title: 'Voir la fiche détaillée', html: imgOrPlaceholder(p.image, p.name, 'stage-img') });
    imgWrap.addEventListener('click', () => openPokemonDetail(p.id));
    card.appendChild(imgWrap);
    const panel = el('div', { class: 'reveal-panel', id: 'reveal-panel' }, [
      el('div', { style: 'font-size:1.5rem;font-weight:800;margin-bottom:10px;text-align:center;' }, `#${String(p.number).padStart(4, '0')} ${p.name}`),
      el('div', { class: 'discovery-info card' }, [
        infoRow('Types', p.types.join(', ')),
        infoRow('Génération', String(p.generation)),
        infoRow('Région', p.region),
        infoRow('Taille', fmtHeight(p.height_dm)),
        infoRow('Poids', fmtWeight(p.weight_hg)),
      ]),
      buildEvolutionStrip(p, { clickable: true }),
    ]);
    card.appendChild(panel);
    card.appendChild(el('button', {
      class: 'btn reveal-btn', type: 'button',
      onmousedown: showReveal, onmouseup: hideReveal, onmouseleave: hideReveal,
      ontouchstart: (e) => { e.preventDefault(); showReveal(); },
      ontouchend: (e) => { e.preventDefault(); hideReveal(); },
      ontouchcancel: hideReveal,
    }, '👁 Maintenir pour révéler'));
    return card;
  }
  function showReveal() { $('#reveal-panel')?.classList.add('revealed'); }
  function hideReveal() { $('#reveal-panel')?.classList.remove('revealed'); }

  function learnTrainingAdvance() {
    if (!learnTraining) return;
    if (learnTraining.idx < learnTraining.members.length - 1) {
      learnTraining.idx += 1;
      renderLearnTrainingCard();
    } else {
      finishLearnTraining();
    }
  }

  function finishLearnTraining() {
    const t = learnTraining;
    learnTraining = null;
    currentScreen = t.sourceScreen;
    $('#play-progress').textContent = '';
    $('#play-score').textContent = '';
    $('#play-feedback').innerHTML = '';
    const stage = $('#play-stage');
    stage.innerHTML = '';
    stage.appendChild(el('div', { class: 'card', style: 'max-width:420px;margin:0 auto;text-align:center;' }, [
      el('h2', {}, 'Lignée terminée !'),
      el('p', {}, `${t.members.length} Pokémon vus.`),
      el('div', { class: 'btn-row', style: 'justify-content:center;margin-top:14px;' }, [
        el('button', { class: 'btn primary', onclick: () => navigate(t.sourceScreen) }, 'Retour'),
      ]),
    ]));
  }

  function quitLearnTraining() {
    if (!learnTraining) return;
    const src = learnTraining.sourceScreen;
    learnTraining = null;
    navigate(src);
  }

  function applyExposure(id) {
    const entry = Storage.getProgress(id);
    if (entry.masteryLevel === 0) entry.masteryLevel = 1;
    entry.timesSeen += 1;
    entry.lastReview = Date.now();
    if (!entry.nextReview) entry.nextReview = Date.now() + 10 * 60 * 1000;
    Storage.setProgress(id, entry);
  }

  function infoRow(k, v) {
    return el('div', { class: 'row' }, [el('span', {}, k), el('b', {}, v)]);
  }

  // Construit la bande de la lignée évolutive complète (une image par
  // étage, embranchements type Évoli inclus). `clickable` ouvre la fiche
  // détail du pokémon cliqué (utilisé uniquement dans le Pokédex).
  function buildEvolutionStrip(p, { clickable } = {}) {
    const stages = PokedexData.fullEvolutionLine(p);
    const strip = el('div', { class: 'evolution-strip' });
    stages.forEach((stage, i) => {
      if (i > 0) strip.appendChild(el('div', { class: 'evo-arrow' }, '→'));
      const stageWrap = el('div', { class: 'evo-stage' });
      stage.forEach((mon) => {
        const attrs = { class: `evo-item ${mon.id === p.id ? 'current' : ''}`, tabindex: '0', title: mon.name };
        if (clickable) attrs.onclick = () => openPokemonDetail(mon.id);
        stageWrap.appendChild(el('div', attrs, [
          el('div', { html: imgOrPlaceholder(mon.image, mon.name, '') }),
          el('div', { class: 'evo-name' }, mon.name),
        ]));
      });
      strip.appendChild(stageWrap);
    });
    return strip;
  }

  // Bloc "lignée évolutive" — utilisé dans la fiche détail du Pokédex,
  // toujours dépliée (chaque pokémon de la lignée cliquable pour ouvrir
  // sa propre fiche).
  function evolutionLineBlock(p) {
    const strip = buildEvolutionStrip(p, { clickable: true });
    return el('div', { class: 'card evo-block', style: 'margin-top:10px;' }, [
      el('div', { class: 'section-title', style: 'margin:0 0 10px;' }, 'Lignée évolutive'),
      strip,
    ]);
  }

  // ================= SESSION DE JEU =================
  function startPlaySession(opts) {
    const pool = opts.pool || opts.queue || PokedexData.getAll();
    let queue;
    if (opts.queue) {
      queue = PokedexData.shuffle(opts.queue.slice());
    } else {
      queue = PokedexData.shuffle(pool.slice());
    }
    session = {
      modes: opts.modes,
      pool,
      queue,
      queueIdx: 0,
      format: opts.format,
      count: opts.count === undefined ? 20 : opts.count,
      timeLimitMs: opts.timeLimitMs || null,
      endAt: opts.timeLimitMs ? Date.now() + opts.timeLimitMs : null,
      asked: 0,
      correct: 0,
      streak: 0,
      sourceScreen: opts.sourceScreen || currentScreen,
      awaitingContinue: false,
      timerHandle: null,
      current: null,
    };
    currentScreen = 'play';
    $all('.screen').forEach((s) => s.classList.remove('active'));
    $('#screen-play').classList.add('active');
    $all('#main-nav button[data-nav]').forEach((b) => b.setAttribute('aria-current', 'false'));
    nextQuestion();
    if (session.endAt) startTimer();
  }

  function startTimer() {
    updateTimerDisplay();
    session.timerHandle = setInterval(() => {
      if (!session) return;
      if (Date.now() >= session.endAt) {
        clearInterval(session.timerHandle);
        finishSession();
      } else {
        updateTimerDisplay();
      }
    }, 250);
  }
  function updateTimerDisplay() {
    if (!session || !session.endAt) return;
    const remaining = Math.max(0, Math.ceil((session.endAt - Date.now()) / 1000));
    $('#play-progress').textContent = `⏱️ ${remaining}s`;
  }

  function nextPokemonFromQueue() {
    if (session.queueIdx >= session.queue.length) {
      session.queue = PokedexData.shuffle(session.pool.slice());
      session.queueIdx = 0;
    }
    return session.queue[session.queueIdx++];
  }

  function nextQuestion() {
    if (!session) return;
    if (session.format !== 'marathon' && session.format !== 'timeattack' && session.asked >= session.count) {
      finishSession();
      return;
    }
    const pokemon = nextPokemonFromQueue();
    const modeToUse = session.modes[Math.floor(Math.random() * session.modes.length)];
    const question = QuizEngine.generateQuestion(modeToUse, pokemon, session.pool.length >= 4 ? session.pool : PokedexData.getAll());
    session.current = question;
    session.awaitingContinue = false;
    renderPlayHeader();
    renderPlayStage(question);
  }

  function renderPlayHeader() {
    if (!session.endAt) {
      const totalLabel = session.format === 'marathon' ? '∞' : session.count;
      $('#play-progress').textContent = `Question ${session.asked + 1} / ${totalLabel}`;
    }
    $('#play-score').textContent = `✅ ${session.correct} · 🔥 série ${session.streak}`;
  }

  const SHOW_SUBJECT = {
    image2nom: 'image', flash: 'image', type: 'image', numero: 'image',
    evolution: 'image', generation: 'image', region: 'image', qcm: 'image', vraifaux: 'image',
    nom2image: 'name',
  };

  function renderPlayStage(q) {
    const stage = $('#play-stage');
    $('#play-feedback').innerHTML = '';
    stage.innerHTML = '';
    const p = q.pokemon;
    const showMode = SHOW_SUBJECT[q.mode] || 'image';

    if (showMode === 'image') {
      const wrap = el('div', { class: 'quiz-image-wrap clickable', id: 'stage-image-wrap', title: 'Voir la fiche détaillée', html: imgOrPlaceholder(p.image, p.name, 'stage-img') });
      wrap.addEventListener('click', () => openPokemonDetail(p.id));
      stage.appendChild(wrap);
      if (q.mode === 'flash') {
        setTimeout(() => {
          if (session && session.current === q) wrap.innerHTML = imgOrPlaceholder(null, '???', 'stage-img');
        }, q.flashMs || 1200);
      }
    } else if (showMode === 'name') {
      stage.appendChild(el('div', { class: 'quiz-image-wrap', style: 'font-size:1.6rem;font-weight:800;' }, p.name));
    }

    stage.appendChild(el('div', { class: 'quiz-prompt' }, q.prompt));

    if (q.answerType === 'text') {
      const input = el('input', { type: 'text', class: 'quiz-text-input', id: 'answer-input', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
      const row = el('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:12px;' }, [
        input,
        el('button', { class: 'btn primary', onclick: () => submitTextAnswer() }, 'Valider (Entrée)'),
      ]);
      stage.appendChild(row);
      setTimeout(() => input.focus(), 30);
    } else if (q.answerType === 'choice') {
      const grid = el('div', { class: 'choice-grid' });
      q.choices.forEach((c, i) => {
        const hasRealPokemon = c.image && typeof c.id === 'number';
        const imgBlock = c.image !== undefined
          ? el('div', { class: 'choice-img-wrap', html: imgOrPlaceholder(c.image, c.label, '') })
          : null;
        if (imgBlock && hasRealPokemon) {
          const infoBtn = el('button', {
            type: 'button', class: 'choice-info-btn', title: 'Voir la fiche détaillée', 'aria-label': 'Voir la fiche détaillée',
            onclick: (e) => { e.stopPropagation(); openPokemonDetail(c.id); },
          }, 'ℹ️');
          imgBlock.appendChild(infoBtn);
        }
        const card = el('div', { class: 'choice-card', tabindex: '0', 'data-choice-id': String(c.id), 'aria-label': c.label }, [
          imgBlock,
          q.hideChoiceLabels && c.image ? null : el('div', {}, c.label),
          el('div', { class: 'kbd-hint' }, `Touche ${i + 1}`),
        ].filter(Boolean));
        card.addEventListener('click', () => submitChoiceAnswer(c.id));
        grid.appendChild(card);
      });
      stage.appendChild(grid);
    } else if (q.answerType === 'multichoice') {
      const grid = el('div', { class: 'choice-grid' });
      const selected = new Set();
      q.choices.forEach((c) => {
        const card = el('div', { class: 'choice-card', 'data-choice-id': c.id }, c.label);
        card.addEventListener('click', () => {
          if (selected.has(c.id)) { selected.delete(c.id); card.classList.remove('selected'); }
          else { selected.add(c.id); card.classList.add('selected'); }
        });
        grid.appendChild(card);
      });
      stage.appendChild(grid);
      stage.appendChild(el('button', { class: 'btn primary', style: 'margin-top:14px', onclick: () => submitMultiAnswer([...selected]) }, 'Valider (Entrée)'));
      stage._selectedSet = selected;
    } else if (q.answerType === 'boolean') {
      stage.appendChild(el('div', { class: 'bool-row' }, [
        el('button', { class: 'btn primary', onclick: () => submitBooleanAnswer(true) }, '✅ Vrai'),
        el('button', { class: 'btn danger', onclick: () => submitBooleanAnswer(false) }, '❌ Faux'),
      ]));
    }
  }

  async function submitTextAnswer() {
    const input = $('#answer-input');
    if (!input || session.awaitingContinue) return;
    const val = input.value;
    const correct = QuizEngine.checkAnswer(session.current, val);
    input.disabled = true;
    await resolveAnswer(correct);
  }

  async function submitChoiceAnswer(choiceId) {
    if (session.awaitingContinue) return;
    const correct = QuizEngine.checkAnswer(session.current, choiceId);
    $all('.choice-card').forEach((c) => {
      c.style.pointerEvents = 'none';
      const cid = c.dataset.choiceId;
      const isCorrectCard = session.current.multiCorrectOk
        ? session.current.correct.map(String).includes(cid)
        : String(session.current.correct) === cid;
      if (isCorrectCard) c.classList.add('correct');
      if (cid === String(choiceId) && !isCorrectCard) c.classList.add('incorrect');
    });
    await resolveAnswer(correct);
  }

  async function submitMultiAnswer(selected) {
    if (session.awaitingContinue) return;
    const correct = QuizEngine.checkAnswer(session.current, selected);
    $all('.choice-card').forEach((c) => {
      const cid = c.dataset.choiceId;
      if (session.current.correct.includes(cid)) c.classList.add('correct');
      else if (selected.includes(cid)) c.classList.add('incorrect');
    });
    await resolveAnswer(correct);
  }

  async function submitBooleanAnswer(val) {
    if (session.awaitingContinue) return;
    const correct = QuizEngine.checkAnswer(session.current, val);
    await resolveAnswer(correct);
  }

  async function resolveAnswer(isCorrect) {
    session.awaitingContinue = true;
    session.asked += 1;
    if (isCorrect) session.correct += 1;
    session.streak = isCorrect ? session.streak + 1 : 0;

    const p = session.current.pokemon;
    const entryBefore = Storage.getProgress(p.id);
    const entryAfter = SRS.applyAnswer(entryBefore, isCorrect);
    await Storage.setProgress(p.id, entryAfter);

    const sstats = Storage.getSessionStats();
    const totals = { ...sstats.totals };
    totals.questionsAnswered = (totals.questionsAnswered || 0) + 1;
    totals[isCorrect ? 'correct' : 'incorrect'] = (totals[isCorrect ? 'correct' : 'incorrect'] || 0) + 1;
    totals.currentStreak = isCorrect ? (totals.currentStreak || 0) + 1 : 0;
    totals.bestStreak = Math.max(totals.bestStreak || 0, totals.currentStreak);
    await Storage.setSessionStats({ totals });

    const feedback = $('#play-feedback');
    const msg = isCorrect ? '✅ Bonne réponse !' : `❌ Raté — la bonne réponse était : ${correctAnswerLabel(session.current)}`;
    feedback.innerHTML = `<div class="feedback-banner ${isCorrect ? 'ok' : 'ko'}">${escapeHtml(msg)}</div>`;
    renderPlayHeader();

    const autoAdvance = session.format === 'timeattack';
    if (autoAdvance) {
      setTimeout(() => { if (session) nextQuestion(); }, isCorrect ? 500 : 1000);
    } else {
      const cont = el('button', { class: 'btn primary', style: 'display:block;margin:12px auto 0;', onclick: () => nextQuestion() }, 'Suivant (Espace)');
      feedback.appendChild(cont);
    }
  }

  function correctAnswerLabel(q) {
    if (q.answerType === 'text') return q.correct;
    if (q.answerType === 'boolean') return q.trueStatement || (q.correct ? 'Vrai' : 'Faux');
    if (q.answerType === 'multichoice') return q.correct.join(', ');
    if (q.answerType === 'choice') {
      const ids = q.multiCorrectOk ? q.correct : [q.correct];
      const labels = q.choices.filter((c) => ids.includes(c.id)).map((c) => c.label);
      return labels.join(' ou ');
    }
    return '';
  }

  async function finishSession() {
    if (session.timerHandle) clearInterval(session.timerHandle);
    const s = session;

    if (s.format === 'marathon') {
      const sstats = Storage.getSessionStats();
      const marathon = { ...sstats.marathon };
      marathon.bestScore = Math.max(marathon.bestScore, s.correct);
      marathon.bestStreak = Math.max(marathon.bestStreak, s.streak);
      await Storage.setSessionStats({ marathon });
    } else if (s.format === 'timeattack') {
      const sstats = Storage.getSessionStats();
      const key = String(Math.round(s.timeLimitMs / 1000));
      const timeAttack = { ...sstats.timeAttack };
      const prevBest = timeAttack[key]?.bestScore || 0;
      timeAttack[key] = { bestScore: Math.max(prevBest, s.correct) };
      await Storage.setSessionStats({ timeAttack });
    }

    session = null;
    currentScreen = s.sourceScreen;
    $all('.screen').forEach((sc) => sc.classList.remove('active'));
    $('#screen-play').classList.add('active');
    const accuracy = s.asked ? Math.round((s.correct / s.asked) * 100) : 0;
    $('#play-stage').innerHTML = '';
    $('#play-progress').textContent = '';
    $('#play-score').textContent = '';
    const summary = el('div', { class: 'card', style: 'max-width:420px;margin:0 auto;text-align:center;' }, [
      el('h2', {}, 'Session terminée !'),
      el('p', {}, `Score : ${s.correct} / ${s.asked} (${accuracy}%)`),
      el('p', {}, `Meilleure série : ${s.streak >= 0 ? s.streak : 0}`),
      el('div', { class: 'btn-row', style: 'justify-content:center;margin-top:14px;' }, [
        el('button', { class: 'btn primary', onclick: () => navigate(s.sourceScreen === 'play' ? 'home' : s.sourceScreen) }, 'Retour'),
      ]),
    ]);
    $('#play-stage').appendChild(summary);
    $('#play-feedback').innerHTML = '';
  }

  function endSession(showSummary = true) {
    if (!session) return;
    if (session.timerHandle) clearInterval(session.timerHandle);
    if (showSummary) { finishSession(); return; }
    session = null;
  }

  function quitPlay() {
    if (learnTraining) { quitLearnTraining(); return; }
    endSession(true);
  }

  // ================= POKEDEX =================
  let pokedexFilters = { generations: [], types: [] };

  function pokeCard(p, progressEntry) {
    const level = progressEntry ? progressEntry.masteryLevel : 0;
    const stepColor = `var(--chart-step-${level})`;
    const card = el('div', { class: `poke-card ${level === 0 ? 'unseen' : ''}`, tabindex: '0' }, [
      el('div', { class: 'mastery-dot', style: `background:${stepColor}`, title: SRS.levelLabel(level) }),
      el('div', { html: imgOrPlaceholder(p.image, p.name, '') }),
      el('div', { class: 'num' }, `#${String(p.number).padStart(4, '0')}`),
      el('div', { class: 'name' }, p.name),
    ]);
    card.addEventListener('click', () => openPokemonDetail(p.id));
    card.addEventListener('keypress', (e) => { if (e.key === 'Enter') openPokemonDetail(p.id); });
    return card;
  }

  function renderPokedexScreen() {
    fillFilterChips('#pokedex-filter-gen', PokedexData.getGenerations().map((g) => ({ value: g, label: `Gén. ${g}` })), 'generations');
    fillFilterChips('#pokedex-filter-type', PokedexData.getTypes().map((t) => ({ value: t, label: t })), 'types');
    $('#pokedex-search').oninput = () => renderPokedexGrid();
    renderPokedexGrid();
  }

  function fillFilterChips(sel, items, filterKey) {
    const wrap = $(sel);
    wrap.innerHTML = '';
    items.forEach((it) => {
      const value = it.value;
      const active = pokedexFilters[filterKey].includes(value);
      const chip = el('button', { class: 'chip', type: 'button', 'aria-pressed': String(active) }, String(it.label));
      chip.addEventListener('click', () => {
        const idx = pokedexFilters[filterKey].indexOf(value);
        if (idx >= 0) pokedexFilters[filterKey].splice(idx, 1);
        else pokedexFilters[filterKey].push(value);
        renderPokedexScreen();
      });
      wrap.appendChild(chip);
    });
  }

  function renderPokedexGrid() {
    const query = $('#pokedex-search').value;
    let list = query ? PokedexData.search(query) : PokedexData.getAll();
    list = PokedexData.filter({ generations: pokedexFilters.generations.map(Number), types: pokedexFilters.types, ids: list.map((p) => p.id) });
    list = list.slice().sort((a, b) => a.number - b.number);
    $('#pokedex-count').textContent = `${list.length} Pokémon`;
    const progress = Storage.getAllProgress();
    const grid = $('#pokedex-grid');
    grid.innerHTML = '';
    const frag = document.createDocumentFragment();
    list.forEach((p) => frag.appendChild(pokeCard(p, progress[p.id])));
    grid.appendChild(frag);
  }

  const STAT_LABELS = { hp: 'PV', attack: 'Attaque', defense: 'Défense', 'special-attack': 'Att. Spé.', 'special-defense': 'Déf. Spé.', speed: 'Vitesse' };
  const STAT_MAX = 180;

  function statBars(baseStats) {
    return el('div', { class: 'stat-bars' }, Object.entries(baseStats).map(([k, v]) => el('div', { class: 'row' }, [
      el('span', {}, STAT_LABELS[k] || k),
      el('div', { class: 'progress-bar' }, el('span', { style: `width:${Math.min(100, (v / STAT_MAX) * 100)}%` })),
      el('b', {}, String(v)),
    ])));
  }

  function abilitiesList(abilities) {
    return abilities.map((a) => a.name + (a.hidden ? ' (cachée)' : '')).join(', ');
  }

  function openPokemonDetail(id) {
    const p = PokedexData.getById(id);
    if (p) { renderSpeciesModal(p); return; }
    const form = PokedexData.getFormById(id);
    if (form) { renderFormModal(form); return; }
  }

  function renderSpeciesModal(p) {
    const entry = Storage.getProgress(p.id);
    const root = $('#modal-root');

    const modal = el('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === modal) closeModal(); } }, [
      el('div', { class: 'modal' }, [
        el('button', { class: 'btn ghost modal-close', onclick: () => closeModal() }, '✕'),
        el('div', { class: 'detail-header' }, [
          el('div', { html: imgOrPlaceholder(p.image, p.name, '') }),
          el('div', {}, [
            el('div', { class: 'headline-sub' }, `#${String(p.number).padStart(4, '0')}`),
            el('h2', { style: 'margin:2px 0;' }, p.name),
            el('div', { class: 'pill' }, p.types.join(' / ')),
            el('div', { style: 'margin-top:8px;' }, el('span', { class: 'pill' }, SRS.levelLabel(entry.masteryLevel))),
          ]),
        ]),
        p.flavor_text ? el('p', { class: 'headline-sub', style: 'margin-top:10px;' }, p.flavor_text) : null,
        el('div', { class: 'detail-grid' }, [
          detailItem('Génération', String(p.generation)),
          detailItem('Région', p.region),
          detailItem('Taille', fmtHeight(p.height_dm)),
          detailItem('Poids', fmtWeight(p.weight_hg)),
          detailItem('Talents', p.abilities?.length ? abilitiesList(p.abilities) : null),
          detailItem('Expérience de base', p.base_experience),
          detailItem('Taux de capture', p.capture_rate),
          detailItem('Bonheur de base', p.base_happiness),
          detailItem('Sexe', p.gender_label),
          detailItem('Groupe(s) d\'œufs', p.egg_groups?.length ? p.egg_groups.join(', ') : null),
          detailItem('Vitesse de croissance', p.growth_rate),
          detailItem('Cycles d\'éclosion', p.hatch_counter),
        ]),
        evolutionLineBlock(p),
        statBars(p.base_stats),
        p.forms.length ? el('div', { style: 'margin-top:16px;' }, [
          el('div', { class: 'section-title' }, 'Formes alternatives'),
          el('div', { class: 'pokemon-grid' }, p.forms.map((f) => el('div', { class: 'poke-card', onclick: () => openPokemonDetail(f.id) }, [
            el('div', { html: imgOrPlaceholder(f.image, f.name, '') }),
            el('div', { class: 'name' }, f.name),
          ]))),
        ]) : null,
        el('div', { class: 'detail-grid', style: 'margin-top:16px;' }, [
          detailItem('Questions répondues', String(entry.timesSeen)),
          detailItem('Bonnes réponses', String(entry.correct)),
          detailItem('Erreurs', String(entry.incorrect)),
          detailItem('Meilleure série', String(entry.bestStreak)),
        ]),
      ].filter(Boolean)),
    ]);
    root.innerHTML = '';
    root.appendChild(modal);
    document.addEventListener('keydown', escCloseOnce);
  }

  // Modale pour une forme alternative (méga-évolution, forme régionale,
  // Gigamax...) : ses propres stats/types/talents, le reste (taux de
  // capture, groupe d'œufs...) hérité de l'espèce de base.
  function renderFormModal(form) {
    const parent = PokedexData.getById(form.parentId);
    const root = $('#modal-root');

    const modal = el('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === modal) closeModal(); } }, [
      el('div', { class: 'modal' }, [
        el('button', { class: 'btn ghost modal-close', onclick: () => closeModal() }, '✕'),
        el('div', { class: 'detail-header' }, [
          el('div', { html: imgOrPlaceholder(form.image, form.name, '') }),
          el('div', {}, [
            el('div', { class: 'headline-sub' }, [
              'Forme de ',
              el('a', { href: '#', onclick: (e) => { e.preventDefault(); openPokemonDetail(parent.id); } }, parent.name),
            ]),
            el('h2', { style: 'margin:2px 0;' }, `${parent.name} — ${form.name}`),
            el('div', { class: 'pill' }, form.types.join(' / ')),
          ]),
        ]),
        el('div', { class: 'detail-grid' }, [
          detailItem('Taille', form.height_dm != null ? fmtHeight(form.height_dm) : null),
          detailItem('Poids', form.weight_hg != null ? fmtWeight(form.weight_hg) : null),
          detailItem('Talents', form.abilities?.length ? abilitiesList(form.abilities) : null),
          detailItem('Expérience de base', form.base_experience),
          detailItem('Taux de capture', parent.capture_rate),
          detailItem('Groupe(s) d\'œufs', parent.egg_groups?.length ? parent.egg_groups.join(', ') : null),
        ]),
        form.base_stats ? statBars(form.base_stats) : null,
      ].filter(Boolean)),
    ]);
    root.innerHTML = '';
    root.appendChild(modal);
    document.addEventListener('keydown', escCloseOnce);
  }

  function escCloseOnce(e) { if (e.key === 'Escape') closeModal(); }
  function closeModal() { $('#modal-root').innerHTML = ''; document.removeEventListener('keydown', escCloseOnce); }
  // Une fiche ne doit jamais afficher un champ vide ("—") : si la donnée
  // n'est pas disponible pour ce pokémon/cette forme, la ligne est
  // simplement omise plutôt que de montrer un espace réservé creux.
  function detailItem(k, v) {
    const isEmpty = v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
    if (isEmpty) return null;
    return el('div', { class: 'item' }, [el('div', { class: 'k' }, k), el('div', { class: 'v' }, v)]);
  }

  // ================= STATISTIQUES =================
  function renderStats() {
    const all = PokedexData.getAll();
    const progress = Storage.getAllProgress();
    const sstats = Storage.getSessionStats();
    const summary = Stats.globalSummary(all, progress, sstats);

    $('#stats-accuracy').textContent = summary.accuracyPct === null ? '—' : `${summary.accuracyPct}%`;
    $('#stats-answered').textContent = summary.questionsAnswered;
    $('#stats-errors').textContent = summary.errors;
    $('#stats-streak').textContent = summary.currentStreak;
    $('#stats-beststreak').textContent = summary.bestStreak;

    const counts = Stats.masteryDistribution(all, progress);
    $('#stats-mastery-chart').innerHTML = Stats.masteryStackedBar(counts, SRS.LEVELS);
    $('#stats-mastery-legend').innerHTML = Stats.masteryLegend(counts, SRS.LEVELS);

    $('#stats-chart-gen').innerHTML = Stats.barChart(Stats.groupProgress(all, progress, (p) => `Gén. ${p.generation}`));
    $('#stats-chart-region').innerHTML = Stats.barChart(Stats.groupProgress(all, progress, (p) => p.region));

    const byType = Stats.groupProgress(all, progress, (p) => p.types[0]);
    const mid = Math.ceil(byType.length / 2);
    $('#stats-chart-type-a').innerHTML = Stats.barChart(byType.slice(0, mid));
    $('#stats-chart-type-b').innerHTML = Stats.barChart(byType.slice(mid));

    const { best, worst } = Stats.bestAndWorst(all, progress, 6);
    $('#stats-best-list').innerHTML = '';
    $('#stats-worst-list').innerHTML = '';
    best.forEach((p) => $('#stats-best-list').appendChild(miniRow(p, progress[p.id])));
    worst.forEach((p) => $('#stats-worst-list').appendChild(miniRow(p, progress[p.id])));
  }
  function miniRow(p, entry) {
    return el('div', { style: 'display:flex;justify-content:space-between;padding:4px 0;font-size:.82rem;border-bottom:1px dashed var(--gridline);cursor:pointer;', onclick: () => openPokemonDetail(p.id) }, [
      el('span', {}, `${p.name} (#${p.number})`),
      el('span', { class: 'pill' }, SRS.levelLabel(entry.masteryLevel)),
    ]);
  }

  // ================= PARAMETRES =================
  function renderSettings() {
    $('#settings-export').onclick = () => {
      const blob = new Blob([Storage.exportBackup()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pokedex-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('Sauvegarde exportée.');
    };
    $('#settings-import-btn').onclick = () => $('#settings-import-file').click();
    $('#settings-import-file').onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      try {
        await Storage.importBackup(text);
        toast('Sauvegarde importée avec succès.');
        navigate('home');
      } catch (err) {
        toast(`Échec de l'import : ${err.message}`);
      }
      e.target.value = '';
    };
    $('#settings-reset').onclick = async () => {
      if (!confirm('Réinitialiser toute ta progression ? Cette action est irréversible.')) return;
      await Storage.resetAll();
      toast('Progression réinitialisée.');
      navigate('home');
    };
  }

  // ================= RACCOURCIS CLAVIER =================
  function initKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (learnTraining) {
        if (e.key === 'Escape') { e.preventDefault(); quitLearnTraining(); return; }
        if (e.key === ' ') { e.preventDefault(); if (!e.repeat) showReveal(); return; }
        if (e.key === 'Enter') { e.preventDefault(); learnTrainingAdvance(); return; }
        return;
      }
      if (!session) return;
      if (e.key === 'Escape') { e.preventDefault(); quitPlay(); return; }
      if (e.target.tagName === 'INPUT' && session.current?.answerType === 'text') {
        if (e.key === 'Enter') submitTextAnswer();
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (session.awaitingContinue) { nextQuestion(); return; }
        if (session.current?.answerType === 'multichoice') {
          const stage = $('#play-stage');
          if (stage._selectedSet) submitMultiAnswer([...stage._selectedSet]);
          return;
        }
      }
      if (['1', '2', '3', '4'].includes(e.key) && session.current?.answerType === 'choice' && !session.awaitingContinue) {
        const idx = Number(e.key) - 1;
        const cards = $all('.choice-card');
        if (cards[idx]) cards[idx].click();
      }
      if (session.current?.answerType === 'boolean' && !session.awaitingContinue) {
        if (e.key.toLowerCase() === 'v') submitBooleanAnswer(true);
        if (e.key.toLowerCase() === 'f') submitBooleanAnswer(false);
      }
    });
    document.addEventListener('keyup', (e) => {
      if (learnTraining && e.key === ' ') { e.preventDefault(); hideReveal(); }
    });
  }

  function init() {
    initNav();
    initKeyboard();
    const quitBtn = document.getElementById('play-quit');
    if (quitBtn) quitBtn.addEventListener('click', () => quitPlay());
    const learnSearch = document.getElementById('learn-search');
    if (learnSearch) learnSearch.addEventListener('input', () => renderLearn());
    navigate('home');
  }

  return { init, navigate, toast };
})();
