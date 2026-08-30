// Interface : navigation entre écrans, rendu, entraînement "Apprendre"
// (révélation à la demande, par lignée évolutive complète), session
// "Réviser" (formulaire complet par pokémon), raccourcis clavier.
const UI = (() => {
  let currentScreen = 'home';
  let session = null; // session de révision en cours (voir startPlaySession)
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

    const facetWrap = $('#review-facet-picker');
    facetWrap.innerHTML = '';
    QuizEngine.REVIEW_FIELDS.forEach((f) => {
      facetWrap.appendChild(el('label', {}, [
        el('input', { type: 'checkbox', name: 'review-facet', value: f.key }),
        f.label,
      ]));
    });

    $('#review-due-count').textContent = dueIds.length;
    $('#review-start-due').disabled = dueIds.length === 0;
    $('#review-start-due').onclick = () => {
      startPlaySession({ queue: dueIds.map((id) => PokedexData.getById(id)), format: 'normal', sourceScreen: 'review', reviewForm: true });
    };
    $('#review-start-weak').disabled = weakIds.length === 0;
    $('#review-start-weak').onclick = () => {
      startPlaySession({ queue: weakIds.map((id) => PokedexData.getById(id)), format: 'normal', sourceScreen: 'review', reviewForm: true });
    };
    $('#review-start-facet').onclick = () => {
      const facets = checkedValues('#review-facet-picker');
      if (!facets.length) { toast('Sélectionne au moins un sujet sur lequel tu es faible.'); return; }
      const ids = SRS.buildFacetWeaknessQueue(progress, all.map((p) => p.id), facets, 30);
      if (!ids.length) { toast('Aucun Pokémon déjà rencontré ne correspond — apprends-en d\'abord dans « Apprendre ».'); return; }
      startPlaySession({ queue: ids.map((id) => PokedexData.getById(id)), format: 'normal', sourceScreen: 'review', reviewForm: true });
    };

    const grid = $('#review-weak-grid');
    grid.innerHTML = '';
    weakIds.forEach((id) => grid.appendChild(pokeCard(PokedexData.getById(id), progress[id])));
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
      el('div', { class: 'evo-strip-discreet' }, buildEvolutionStrip(p, { clickable: true })),
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

  // Pas d'écran de fin : une fois la lignée vue, retour direct au menu
  // principal d'Apprendre pour enchaîner sur la suivante.
  function finishLearnTraining() {
    learnTraining = null;
    navigate('learn');
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

  // ================= SESSION DE REVISION =================
  function startPlaySession(opts) {
    const pool = opts.queue || PokedexData.getAll();
    const queue = PokedexData.shuffle(pool.slice());
    session = {
      pool,
      queue,
      queueIdx: 0,
      asked: 0,
      correct: 0,
      sourceScreen: opts.sourceScreen || currentScreen,
      awaitingContinue: false,
      current: null,
      totalPokemon: pool.length,
      pokemonIndex: 0,
    };
    currentScreen = 'play';
    $all('.screen').forEach((s) => s.classList.remove('active'));
    $('#screen-play').classList.add('active');
    $all('#main-nav button[data-nav]').forEach((b) => b.setAttribute('aria-current', 'false'));
    nextQuestion();
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
    if (session.pokemonIndex >= session.totalPokemon) {
      finishSession();
      return;
    }
    const pokemon = nextPokemonFromQueue();
    session.pokemonIndex += 1;
    session.current = QuizEngine.genReviewForm(pokemon);
    session.awaitingContinue = false;
    renderPlayHeader();
    renderPlayStage(session.current);
  }

  function renderPlayHeader() {
    $('#play-progress').textContent = `Pokémon ${session.pokemonIndex} / ${session.totalPokemon}`;
    $('#play-score').textContent = `✅ ${session.correct}`;
  }

  // Mise en page compacte pensée pour tenir sans défilement : l'image à
  // gauche, tous les champs à droite (largeur de l'écran utilisée plutôt
  // qu'un long empilement vertical).
  function renderPlayStage(q) {
    const stage = $('#play-stage');
    $('#play-feedback').innerHTML = '';
    stage.innerHTML = '';
    const p = q.pokemon;

    const imgWrap = el('div', { class: 'review-image-wrap clickable', title: 'Voir la fiche détaillée', html: imgOrPlaceholder(p.image, p.name, 'stage-img') });
    imgWrap.addEventListener('click', () => openPokemonDetail(p.id));

    const fieldsCol = el('div', { class: 'review-fields-col' });
    fieldsCol.appendChild(el('div', { class: 'quiz-prompt' }, q.prompt));
    const form = el('div', { class: 'review-form' });
    q.fields.forEach((f) => {
      let control;
      let rowClass = 'review-field-row';
      if (f.kind === 'picker') control = buildPickerField(f);
      else if (f.kind === 'lineage') { control = buildLineageField(p); rowClass += ' review-field-row-full'; }
      else control = buildReviewInput(f);
      form.appendChild(el('label', { class: rowClass }, [
        el('span', { class: 'review-field-label' }, f.label),
        control,
      ]));
    });
    fieldsCol.appendChild(form);
    fieldsCol.appendChild(el('button', { class: 'btn primary review-submit-btn', onclick: () => submitReviewForm(q) }, `Valider (${keyDisplay(getKeybindings().submit)})`));

    stage.appendChild(el('div', { class: 'review-layout' }, [imgWrap, fieldsCol]));
    setTimeout(() => stage.querySelector('.review-field-input')?.focus(), 30);
  }

  // La lignée complète du pokémon revu, une case par membre : la case du
  // pokémon affiché montre son image (on voit où il se situe), les autres
  // sont des cases à remplir avec leur nom — pré-évolutions à gauche,
  // évolutions à droite, dans l'ordre de la lignée.
  function buildLineageField(p) {
    const stages = PokedexData.fullEvolutionLine(p);
    const flat = stages.flatMap((stage) => stage.slice().sort((a, b) => a.number - b.number));
    const wrap = el('div', { class: 'lineage-boxes' });
    if (flat.length <= 1) {
      wrap.appendChild(el('div', { class: 'lineage-box lineage-subject' }, [el('div', { html: imgOrPlaceholder(p.image, p.name, '') })]));
      return wrap;
    }
    flat.forEach((mon, i) => {
      if (i > 0) wrap.appendChild(el('div', { class: 'evo-arrow' }, '→'));
      if (mon.id === p.id) {
        wrap.appendChild(el('div', { class: 'lineage-box lineage-subject' }, [el('div', { html: imgOrPlaceholder(mon.image, mon.name, '') })]));
      } else {
        const input = el('input', { type: 'text', class: 'lineage-input', 'data-lineage-id': String(mon.id), autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
        const know = el('label', { class: 'lineage-know', title: 'Je connais ce Pokémon' }, [
          el('input', { type: 'checkbox', class: 'lineage-know-checkbox', 'data-lineage-id': String(mon.id), onchange: (e) => { input.disabled = e.target.checked; } }),
          'connu',
        ]);
        wrap.appendChild(el('div', { class: 'lineage-box' }, [input, know]));
      }
    });
    return wrap;
  }

  // Un membre correct si le nom tapé correspond (ou si la case "connu" est
  // cochée) ; les cases vides et non cochées ne sont ni comptées justes ni
  // fausses. Correct global = TOUTES les cases remplies sont justes (pas de
  // majorité pour la lignée : soit tu la connais entièrement, soit non).
  function computeLineageResult() {
    const inputs = $all('.lineage-input');
    if (!inputs.length) return { attempted: false, correct: false };
    let filled = 0;
    let correctCount = 0;
    inputs.forEach((inp) => {
      const knowBox = $(`.lineage-know-checkbox[data-lineage-id="${inp.dataset.lineageId}"]`);
      inp.disabled = true;
      if (knowBox) knowBox.disabled = true;
      if (knowBox && knowBox.checked) {
        filled += 1;
        correctCount += 1;
        return;
      }
      const val = inp.value.trim();
      if (!val) return;
      filled += 1;
      const target = PokedexData.getById(Number(inp.dataset.lineageId));
      if (target && PokedexData.normalize(val) === PokedexData.normalize(target.name)) correctCount += 1;
    });
    if (!filled) return { attempted: false, correct: false };
    return { attempted: true, correct: correctCount === filled };
  }

  // Numéro/Taille/Poids : saisie libre mais restreinte aux chiffres et à
  // la virgule (les lettres n'ont aucun effet). Nom : texte libre.
  // Une case "Je sais" à côté permet de compter la réponse comme juste
  // sans avoir à l'écrire.
  function buildReviewInput(f) {
    const attrs = { type: 'text', class: 'quiz-text-input review-field-input', 'data-field': f.key, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' };
    if (f.kind === 'numeric') {
      attrs.inputmode = 'decimal';
      attrs.oninput = (e) => { e.target.value = e.target.value.replace(/[^0-9,]/g, ''); };
    }
    const input = el('input', attrs);
    const know = el('label', { class: 'review-know-toggle' }, [
      el('input', { type: 'checkbox', class: 'review-know-checkbox', 'data-field': f.key, onchange: (e) => { input.disabled = e.target.checked; } }),
      'Je sais (sans écrire)',
    ]);
    return el('div', { class: 'review-input-with-know' }, [input, know]);
  }

  function pickerOptionsFor(key) {
    if (key === 'generation') return PokedexData.getGenerations().map(String);
    if (key === 'region') return PokedexData.getRegions();
    if (key === 'type') return PokedexData.getTypes();
    return [];
  }

  // Région/Génération/Type : pas de saisie libre — on clique sur le champ
  // pour dérouler les possibilités, puis sur une ou plusieurs valeurs
  // (Type accepte plusieurs sélections) pour les écrire dans le champ.
  function buildPickerField(f) {
    const options = pickerOptionsFor(f.key);
    const selected = new Set();
    const wrap = el('div', { class: 'review-picker', 'data-field': f.key, 'data-value': '' });
    const display = el('button', { type: 'button', class: 'review-picker-display' }, 'Cliquer pour choisir');
    const panel = el('div', { class: 'review-picker-options hidden' });

    function updateDisplay() {
      display.textContent = selected.size ? [...selected].join(', ') : 'Cliquer pour choisir';
      wrap.setAttribute('data-value', [...selected].join(', '));
    }

    options.forEach((opt) => {
      const chip = el('button', { type: 'button', class: 'chip review-picker-chip', 'aria-pressed': 'false' }, opt);
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        if (f.multi) {
          if (selected.has(opt)) { selected.delete(opt); chip.setAttribute('aria-pressed', 'false'); }
          else { selected.add(opt); chip.setAttribute('aria-pressed', 'true'); }
        } else {
          selected.clear();
          selected.add(opt);
          panel.querySelectorAll('.review-picker-chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
          chip.setAttribute('aria-pressed', 'true');
          panel.classList.add('hidden');
        }
        updateDisplay();
      });
      panel.appendChild(chip);
    });

    display.addEventListener('click', () => panel.classList.toggle('hidden'));
    wrap.appendChild(display);
    wrap.appendChild(panel);
    return wrap;
  }

  // Réviser : lit les 8 champs du formulaire, note chacun indépendamment,
  // et met à jour la maîtrise globale du pokémon sur la base de la
  // majorité des champs réellement tentés (ceux laissés vides ne comptent
  // ni pour ni contre).
  async function submitReviewForm(q) {
    if (session.awaitingContinue) return;
    const p = q.pokemon;
    const results = q.fields.map((f) => {
      if (f.kind === 'lineage') {
        return { ...f, raw: '', ...computeLineageResult() };
      }
      let raw;
      if (f.kind === 'picker') {
        const wrap = $(`.review-picker[data-field="${f.key}"]`);
        raw = wrap ? wrap.getAttribute('data-value') : '';
        if (wrap) {
          wrap.querySelector('.review-picker-options')?.classList.add('hidden');
          wrap.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        }
      } else {
        const knowBox = $(`.review-know-checkbox[data-field="${f.key}"]`);
        const input = $(`.review-field-input[data-field="${f.key}"]`);
        if (input) input.disabled = true;
        if (knowBox && knowBox.checked) {
          knowBox.disabled = true;
          return { ...f, raw: '', attempted: true, correct: true };
        }
        if (knowBox) knowBox.disabled = true;
        raw = input ? input.value : '';
      }
      return { ...f, raw, ...QuizEngine.checkReviewField(f.key, p, raw) };
    });
    await resolveReviewForm(q, results);
  }

  async function resolveReviewForm(q, results) {
    session.awaitingContinue = true;
    const p = q.pokemon;
    const attempted = results.filter((r) => r.attempted);
    const correctCount = attempted.filter((r) => r.correct).length;
    const roundCorrect = attempted.length > 0 && correctCount >= Math.ceil(attempted.length / 2);

    session.asked += 1;
    if (roundCorrect) session.correct += 1;

    let entry = Storage.getProgress(p.id);
    for (const r of attempted) entry = SRS.recordFacet(entry, r.key, r.correct);
    if (attempted.length) entry = SRS.applyAnswer(entry, roundCorrect);
    await Storage.setProgress(p.id, entry);

    if (attempted.length) {
      const sstats = Storage.getSessionStats();
      const totals = { ...sstats.totals };
      totals.questionsAnswered = (totals.questionsAnswered || 0) + 1;
      totals[roundCorrect ? 'correct' : 'incorrect'] = (totals[roundCorrect ? 'correct' : 'incorrect'] || 0) + 1;
      totals.currentStreak = roundCorrect ? (totals.currentStreak || 0) + 1 : 0;
      totals.bestStreak = Math.max(totals.bestStreak || 0, totals.currentStreak);
      await Storage.setSessionStats({ totals });
    }

    const feedback = $('#play-feedback');
    feedback.innerHTML = '';
    // Chaque sujet affiche la bonne réponse, y compris ceux laissés vides —
    // mais "non répondu" reste visuellement distinct d'une vraie erreur.
    feedback.appendChild(el('div', { class: 'review-results' }, results.map((r) => {
      if (!r.attempted) {
        return el('div', { class: 'review-result-row skipped' }, [
          el('span', {}, r.label),
          el('span', {}, [el('span', { class: 'pill' }, 'non répondu'), ` — ${QuizEngine.reviewFieldDisplay(r.key, p)}`]),
        ]);
      }
      return el('div', { class: `review-result-row ${r.correct ? 'ok' : 'ko'}` }, [
        el('span', {}, r.label),
        el('span', {}, r.correct ? '✅' : `❌ ${QuizEngine.reviewFieldDisplay(r.key, p)}`),
      ]);
    })));
    renderPlayHeader();
    const cont = el('button', { class: 'btn primary', style: 'display:block;margin:12px auto 0;', onclick: () => nextQuestion() }, `Suivant (${keyDisplay(getKeybindings().submit)})`);
    feedback.appendChild(cont);
  }

  async function finishSession() {
    const s = session;
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
      el('div', { class: 'btn-row', style: 'justify-content:center;margin-top:14px;' }, [
        el('button', { class: 'btn primary', onclick: () => navigate(s.sourceScreen === 'play' ? 'home' : s.sourceScreen) }, 'Retour'),
      ]),
    ]);
    $('#play-stage').appendChild(summary);
    $('#play-feedback').innerHTML = '';
  }

  function endSession(showSummary = true) {
    if (!session) return;
    if (showSummary) { finishSession(); return; }
    session = null;
  }

  function quitPlay() {
    if (learnTraining) { quitLearnTraining(); return; }
    endSession(true);
  }

  // ================= POKEDEX =================
  // `types` = combinaison en cours de sélection (chips cochées). Plusieurs
  // types cochés ensemble = ET (le pokémon doit avoir tous ces types).
  // `typeCombos` = combinaisons déjà "ajoutées", combinées entre elles en OU.
  let pokedexFilters = { generations: [], types: [], typeCombos: [] };

  function pokeCard(p, progressEntry, opts = {}) {
    const level = progressEntry ? progressEntry.masteryLevel : 0;
    const stepColor = `var(--chart-step-${level})`;
    const hideImage = !!opts.hideUnknown && level === 0;
    const card = el('div', { class: `poke-card ${hideImage ? 'unseen' : ''}`, tabindex: '0' }, [
      el('div', { class: 'mastery-dot', style: `background:${stepColor}`, title: SRS.levelLabel(level) }),
      el('div', { html: imgOrPlaceholder(hideImage ? null : p.image, p.name, '') }),
      el('div', { class: 'num' }, `#${String(p.number).padStart(4, '0')}`),
      el('div', { class: 'name' }, p.name),
    ]);
    card.addEventListener('click', () => openPokemonDetail(p.id));
    card.addEventListener('keypress', (e) => { if (e.key === 'Enter') openPokemonDetail(p.id); });
    return card;
  }

  function renderPokedexScreen() {
    const settings = Storage.getSettings();
    const imageModeWrap = $('#pokedex-image-mode');
    imageModeWrap.innerHTML = '';
    [
      { value: 'all', label: 'Toutes les images' },
      { value: 'known', label: 'Seulement les Pokémon connus' },
    ].forEach((opt) => {
      const checked = (opt.value === 'all') === settings.pokedexShowAllImages;
      imageModeWrap.appendChild(el('label', {}, [
        el('input', {
          type: 'radio', name: 'pokedex-image-mode', value: opt.value,
          ...(checked ? { checked: 'checked' } : {}),
          onchange: async () => { await Storage.setSettings({ pokedexShowAllImages: opt.value === 'all' }); renderPokedexGrid(); },
        }),
        opt.label,
      ]));
    });

    fillFilterChips('#pokedex-filter-gen', PokedexData.getGenerations().map((g) => ({ value: g, label: `Gén. ${g}` })), 'generations');
    fillFilterChips('#pokedex-filter-type', PokedexData.getTypes().map((t) => ({ value: t, label: t })), 'types');

    $('#pokedex-add-combo').disabled = pokedexFilters.types.length === 0;
    $('#pokedex-add-combo').onclick = () => {
      if (!pokedexFilters.types.length) return;
      pokedexFilters.typeCombos.push([...pokedexFilters.types]);
      pokedexFilters.types = [];
      renderPokedexScreen();
    };
    const comboWrap = $('#pokedex-type-combos');
    comboWrap.innerHTML = '';
    pokedexFilters.typeCombos.forEach((combo, i) => {
      const pill = el('button', { type: 'button', class: 'chip', 'aria-pressed': 'true', title: 'Cliquer pour retirer' }, `${combo.join(' + ')} ✕`);
      pill.addEventListener('click', () => {
        pokedexFilters.typeCombos.splice(i, 1);
        renderPokedexScreen();
      });
      comboWrap.appendChild(pill);
    });

    $('#pokedex-search').oninput = () => renderPokedexGrid();
    renderPokedexGrid();
  }

  // Un pokémon correspond si ses types contiennent TOUS les types d'au
  // moins une combinaison (sélection en cours incluse) — ET dans chaque
  // combinaison, OU entre les combinaisons.
  function pokemonMatchesTypeCombos(p) {
    const groups = pokedexFilters.typeCombos.slice();
    if (pokedexFilters.types.length) groups.push(pokedexFilters.types);
    if (!groups.length) return true;
    return groups.some((group) => group.every((t) => p.types.includes(t)));
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
    list = PokedexData.filter({ generations: pokedexFilters.generations.map(Number), ids: list.map((p) => p.id) });
    list = list.filter(pokemonMatchesTypeCombos).sort((a, b) => a.number - b.number);
    $('#pokedex-count').textContent = `${list.length} Pokémon`;
    const progress = Storage.getAllProgress();
    const grid = $('#pokedex-grid');
    grid.innerHTML = '';
    const hideUnknown = !Storage.getSettings().pokedexShowAllImages;
    const frag = document.createDocumentFragment();
    list.forEach((p) => frag.appendChild(pokeCard(p, progress[p.id], { hideUnknown })));
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

  // "Mémoire par sujet" : ce dont tu te souviens précisément sur ce
  // pokémon (nom, type, numéro...), sujet par sujet — pas juste un score
  // global. Alimenté par SRS.recordFacet à chaque réponse.
  function facetBreakdownBlock(entry) {
    const fieldLabels = Object.fromEntries(QuizEngine.REVIEW_FIELDS.map((f) => [f.key, f.label]));
    const rows = Object.entries(entry.facets || {})
      .map(([key, v]) => ({ key, label: fieldLabels[key] || key, total: v.correct + v.incorrect, pct: Math.round((v.correct / (v.correct + v.incorrect)) * 100) }))
      .filter((r) => r.total > 0)
      .sort((a, b) => a.pct - b.pct);
    if (!rows.length) return null;
    return el('div', { style: 'margin-top:16px;' }, [
      el('div', { class: 'section-title' }, 'Mémoire par sujet'),
      el('div', { class: 'stat-bars' }, rows.map((r) => el('div', { class: 'row' }, [
        el('span', {}, r.label),
        el('div', { class: 'progress-bar' }, el('span', { style: `width:${r.pct}%` })),
        el('b', {}, `${r.pct}% (${r.total})`),
      ]))),
    ]);
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
        facetBreakdownBlock(entry),
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

    renderDatasetStats(all);
  }
  function miniRow(p, entry) {
    return el('div', { style: 'display:flex;justify-content:space-between;padding:4px 0;font-size:.82rem;border-bottom:1px dashed var(--gridline);cursor:pointer;', onclick: () => openPokemonDetail(p.id) }, [
      el('span', {}, `${p.name} (#${p.number})`),
      el('span', { class: 'pill' }, SRS.levelLabel(entry.masteryLevel)),
    ]);
  }

  // ---- Statistiques du Pokédex (comparaisons entre pokémon, indépendant
  // de la progression personnelle) ----
  const LEADERBOARD_CONFIGS = [
    { title: 'PV les plus élevés', valueFn: (p) => p.base_stats.hp, fmt: String },
    { title: 'Attaque la plus élevée', valueFn: (p) => p.base_stats.attack, fmt: String },
    { title: 'Défense la plus élevée', valueFn: (p) => p.base_stats.defense, fmt: String },
    { title: 'Att. Spéciale la plus élevée', valueFn: (p) => p.base_stats['special-attack'], fmt: String },
    { title: 'Déf. Spéciale la plus élevée', valueFn: (p) => p.base_stats['special-defense'], fmt: String },
    { title: 'Les plus rapides', valueFn: (p) => p.base_stats.speed, fmt: String },
    { title: 'Total de stats le plus élevé', valueFn: (p) => Stats.statTotal(p.base_stats), fmt: String },
    { title: 'Les plus grands', valueFn: (p) => p.height_dm, fmt: fmtHeight },
    { title: 'Les plus petits', valueFn: (p) => p.height_dm, order: 'asc', fmt: fmtHeight },
    { title: 'Les plus lourds', valueFn: (p) => p.weight_hg, fmt: fmtWeight },
    { title: 'Les plus légers', valueFn: (p) => p.weight_hg, order: 'asc', fmt: fmtWeight },
  ];

  // Tableau des stats de combat moyennes par type, triable en cliquant sur
  // une colonne (du plus haut au plus bas, un second clic inverse le sens).
  let avgStatsSort = { key: 'avgTotal', dir: 'desc' };
  function renderAvgStatsTable(all) {
    const data = Stats.avgStatsByType(all);
    const columns = [
      { key: 'key', label: 'Type', getValue: (g) => g.key, numeric: false },
      ...Stats.BATTLE_STAT_KEYS.map((k) => ({ key: k, label: Stats.BATTLE_STAT_LABELS[k], getValue: (g) => g.avg[k], numeric: true })),
      { key: 'avgTotal', label: 'Total', getValue: (g) => g.avgTotal, numeric: true },
    ];
    const col = columns.find((c) => c.key === avgStatsSort.key);
    const sorted = data.slice().sort((a, b) => {
      const av = col.getValue(a);
      const bv = col.getValue(b);
      const cmp = col.numeric ? av - bv : String(av).localeCompare(String(bv), 'fr');
      return avgStatsSort.dir === 'asc' ? cmp : -cmp;
    });

    const table = el('table', { class: 'stats-table' });
    table.appendChild(el('tr', {}, columns.map((c) => {
      const active = avgStatsSort.key === c.key;
      const arrow = active ? (avgStatsSort.dir === 'desc' ? ' ▼' : ' ▲') : '';
      return el('th', {
        class: `sortable-th${active ? ' active' : ''}`, tabindex: '0', role: 'button',
        onclick: () => {
          if (avgStatsSort.key === c.key) avgStatsSort.dir = avgStatsSort.dir === 'desc' ? 'asc' : 'desc';
          else avgStatsSort = { key: c.key, dir: c.numeric ? 'desc' : 'asc' };
          renderAvgStatsTable(all);
        },
      }, c.label + arrow);
    })));
    sorted.forEach((g) => {
      table.appendChild(el('tr', {}, columns.map((c) => el('td', { class: c.numeric ? '' : 'ta-left' }, String(c.getValue(g))))));
    });
    const container = $('#dex-avg-stats-table');
    container.innerHTML = '';
    container.appendChild(table);
  }

  function renderDatasetStats(all) {
    const overview = Stats.datasetOverview(all);
    const ov = $('#dex-overview');
    ov.innerHTML = '';
    const tile = (label, value) => el('div', { class: 'stat-tile card' }, [el('div', { class: 'value' }, String(value)), el('div', { class: 'label' }, label)]);
    ov.appendChild(tile('Pokémon au total', overview.total));
    ov.appendChild(tile('Mono-type', overview.monoType));
    ov.appendChild(tile('Bi-type', overview.biType));
    ov.appendChild(tile('Légendaires', overview.legendary));
    ov.appendChild(tile('Mythiques', overview.mythical));
    ov.appendChild(tile('Formes alternatives', overview.totalForms));

    const typeCounts = Stats.countBy(all, (p) => p.types, { multi: true }).sort((a, b) => b.count - a.count);
    $('#dex-chart-type-count').innerHTML = Stats.countBarChart(typeCounts);

    const genCounts = Stats.countBy(all, (p) => p.generation)
      .sort((a, b) => a.key - b.key)
      .map((g) => ({ key: `Gén. ${g.key}`, count: g.count }));
    $('#dex-chart-gen-count').innerHTML = Stats.countBarChart(genCounts);

    const regionCounts = Stats.countBy(all, (p) => p.region).sort((a, b) => b.count - a.count);
    $('#dex-chart-region-count').innerHTML = Stats.countBarChart(regionCounts);

    renderAvgStatsTable(all);

    const wrap = $('#dex-leaderboards');
    wrap.innerHTML = '';
    LEADERBOARD_CONFIGS.forEach((cfg) => {
      const entries = Stats.topByStat(all, cfg.valueFn, 5, cfg.order || 'desc');
      wrap.appendChild(el('div', { class: 'card leaderboard-card' }, [
        el('h4', {}, cfg.title),
        ...entries.map((e, i) => el('div', { class: 'leaderboard-row', onclick: () => openPokemonDetail(e.p.id) }, [
          el('span', { class: 'leaderboard-rank' }, `#${i + 1}`),
          el('div', { class: 'leaderboard-thumb', html: imgOrPlaceholder(e.p.image, e.p.name, '') }),
          el('span', { class: 'leaderboard-name' }, e.p.name),
          el('span', { class: 'leaderboard-value' }, cfg.fmt(e.value)),
        ])),
      ]));
    });
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
    renderKeybindSettings();
    $('#keybind-reset').onclick = async () => {
      listeningFor = null;
      await Storage.setSettings({ keybindings: { ...DEFAULT_KEYBINDINGS } });
      renderKeybindSettings();
      toast('Raccourcis réinitialisés.');
    };
  }

  // ================= RACCOURCIS CLAVIER (personnalisables) =================
  const DEFAULT_KEYBINDINGS = { quit: 'Escape', submit: 'Enter', reveal: ' ' };
  const KEYBIND_LABELS = { quit: 'Quitter la session', submit: 'Valider / Continuer', reveal: 'Maintenir pour révéler (Apprendre)' };
  const KEY_DISPLAY_NAMES = { ' ': 'Espace', Escape: 'Échap', Enter: 'Entrée' };
  let listeningFor = null;

  function getKeybindings() {
    return { ...DEFAULT_KEYBINDINGS, ...(Storage.getSettings().keybindings || {}) };
  }
  function keyDisplay(k) {
    return KEY_DISPLAY_NAMES[k] || (k.length === 1 ? k.toUpperCase() : k);
  }

  function renderKeybindSettings() {
    const wrap = $('#keybind-list');
    if (!wrap) return;
    const kb = getKeybindings();
    wrap.innerHTML = '';
    Object.keys(DEFAULT_KEYBINDINGS).forEach((action) => {
      wrap.appendChild(el('div', { class: 'keybind-row' }, [
        el('span', {}, KEYBIND_LABELS[action]),
        el('button', {
          type: 'button', class: `btn ghost keybind-btn${listeningFor === action ? ' listening' : ''}`,
          onclick: () => { listeningFor = action; renderKeybindSettings(); },
        }, listeningFor === action ? 'Appuie sur une touche…' : keyDisplay(kb[action])),
      ]));
    });
  }

  // Si une case de raccourci écoute, la prochaine touche pressée devient
  // la nouvelle valeur (avec vérification de conflit) au lieu de déclencher
  // son action habituelle.
  function captureKeybind(e) {
    if (!listeningFor) return false;
    e.preventDefault();
    const action = listeningFor;
    listeningFor = null;
    if (e.key === 'Tab') { renderKeybindSettings(); return true; }
    const kb = getKeybindings();
    const conflict = Object.keys(kb).find((a) => a !== action && kb[a] === e.key);
    if (conflict) {
      toast(`Déjà utilisé pour « ${KEYBIND_LABELS[conflict]} ».`);
    } else {
      Storage.setSettings({ keybindings: { ...kb, [action]: e.key } });
    }
    renderKeybindSettings();
    return true;
  }

  function initKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (captureKeybind(e)) return;
      const kb = getKeybindings();
      if (learnTraining) {
        if (e.key === kb.quit) { e.preventDefault(); quitLearnTraining(); return; }
        if (e.key === kb.reveal) { e.preventDefault(); if (!e.repeat) showReveal(); return; }
        if (e.key === kb.submit) { e.preventDefault(); learnTrainingAdvance(); return; }
        return;
      }
      if (!session) return;
      if (e.key === kb.quit) { e.preventDefault(); quitPlay(); return; }
      if (e.target.tagName === 'INPUT' && session.current?.answerType === 'form') {
        if (e.key === kb.submit) { e.preventDefault(); if (!session.awaitingContinue) submitReviewForm(session.current); }
        return;
      }
      if (e.key === kb.submit && session.awaitingContinue) {
        e.preventDefault();
        nextQuestion();
      }
    });
    document.addEventListener('keyup', (e) => {
      const kb = getKeybindings();
      if (learnTraining && e.key === kb.reveal) { e.preventDefault(); hideReveal(); }
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
