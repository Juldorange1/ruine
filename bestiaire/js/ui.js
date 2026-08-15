// Rendu DOM + boucle de jeu + interactions.

let toastTimer = null;

function afficherToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2200);
}

function pipsStade(stade) {
  let s = '';
  for (let i = 0; i <= EVOLUTION_STADE_MAX; i++) s += i <= stade ? '●' : '○';
  return s;
}

function creatureCard(z, c) {
  const rev = revenuCreature(c);
  const maxed = c.stade >= EVOLUTION_STADE_MAX;
  const coutEvo = maxed ? null : coutEvolution(c);
  const peutEvoluer = !maxed && etat.argent >= coutEvo;
  return `
    <div class="creature-card">
      <div class="creature-art">${c.art}</div>
      <div class="creature-nom">${c.nom}</div>
      <div class="creature-stade" title="Stade d'évolution">${pipsStade(c.stade)}</div>
      <div class="creature-revenu">${formatNombre(rev)} €/s</div>
      ${maxed
        ? `<div class="evo-max">Forme finale</div>`
        : `<button class="evo-btn" data-zone="${z.id}" data-creature="${c.id}" ${peutEvoluer ? '' : 'disabled'}>Évoluer (${formatNombre(coutEvo)} €)</button>`}
    </div>`;
}

function offerCard(z, e, i, cout, gratuit, abordable) {
  return `
    <div class="offer-card rarete-${e.rarete}">
      <div class="art">${e.art}</div>
      <div class="nom">${e.nom}</div>
      <div class="stats">💰${formatNombre(e.revenu)}/s</div>
      <button class="buy-btn ${gratuit ? 'gratuit' : ''}" data-zone="${z.id}" data-offre="${i}" ${abordable ? '' : 'disabled'}>
        ${gratuit ? 'Recruter (gratuit)' : formatNombre(cout) + ' €'}
      </button>
    </div>`;
}

function renderZone(z) {
  const zone = etat.zones[z.id];
  const revenu = revenuParSeconde(z.id);

  const rosterHtml = zone.creatures.length
    ? zone.creatures.map(c => creatureCard(z, c)).join('')
    : `<span class="roster-empty">Zone vide — recrutement gratuit ci-dessous</span>`;

  const shopHtml = zone.offres.map((nomEspece, i) => {
    const e = especeParNom(z.id, nomEspece);
    const cout = coutAchat(z.id, e);
    const gratuit = cout === 0;
    const abordable = gratuit || etat.argent >= cout;
    return offerCard(z, e, i, cout, gratuit, abordable);
  }).join('');

  const badgeMult = zone.multiplicateurDoubleur > 1 ? `<span class="mult-badge">×${zone.multiplicateurDoubleur}</span>` : '';

  return `
    <div class="zone-card" data-zone="${z.id}">
      <div class="zone-head">
        <h2>${z.icone} ${z.nom}</h2>
        <span class="ambiance">${z.ambiance}</span>
      </div>
      <div class="zone-reserve">
        <span class="revenu-total">${formatNombre(revenu)} €/s</span>
        ${badgeMult}
      </div>
      <button class="doubler-btn" data-zone="${z.id}" ${etat.doubleurs <= 0 ? 'disabled' : ''} title="Consomme un doubleur pour multiplier par 2 le revenu de cette zone, en plus des doubleurs déjà utilisés ici">
        🎟️ Doubler cette zone
      </button>
      <div class="roster">${rosterHtml}</div>
      <div class="shop">${shopHtml}</div>
    </div>`;
}

function ligneAmelioration(type, titre, effetTexte) {
  const cout = coutAmelioration(type);
  const max = cout === null;
  const disabled = max || etat.argent < cout;
  return `
    <div class="upgrade-row">
      <div class="upgrade-info">
        <div class="upgrade-titre">${titre}</div>
        <div class="upgrade-effet">${effetTexte}</div>
      </div>
      <button class="upgrade-btn" data-ameliore="${type}" ${disabled ? 'disabled' : ''}>${max ? 'MAX' : formatNombre(cout) + ' €'}</button>
    </div>`;
}

function renderAmeliorations() {
  const a = etat.ameliorations;
  const lignes = [
    ligneAmelioration('multGlobal', `Multiplicateur global (niv. ${a.multGlobal})`, `Revenu total ×${multiplicateurGlobalActuel().toFixed(2)}`),
    ligneAmelioration('gainIndividuel', `Gain individuel (niv. ${a.gainIndividuel})`, `+${formatNombre(bonusIndividuelActuel())} €/s sur chaque créature`),
    ligneAmelioration('reductionPrix', `Réduction des prix (niv. ${a.reductionPrix}/${NIVEAU_MAX_REDUCTION})`, `-${Math.round(reductionPrixActuelle() * 100)}% sur tous les achats`),
  ].join('');

  const coutD = coutDoubleurAchat();
  const doubleurRow = `
    <div class="upgrade-row">
      <div class="upgrade-info">
        <div class="upgrade-titre">🎟️ Doubleur d'argent</div>
        <div class="upgrade-effet">Tu en as ${etat.doubleurs} — +1 gratuit toutes les minutes</div>
      </div>
      <button class="upgrade-btn" id="acheterDoubleurBtn" ${etat.argent < coutD ? 'disabled' : ''}>${formatNombre(coutD)} €</button>
    </div>`;

  return `<h2>📈 Améliorations</h2><div class="upgrades">${lignes}${doubleurRow}</div>`;
}

function render() {
  document.getElementById('hud-argent').textContent = formatNombre(etat.argent);
  document.getElementById('hud-revenu').textContent = formatNombre(revenuTotalParSeconde());
  document.getElementById('hud-doubleurs').textContent = etat.doubleurs;
  document.getElementById('hud-prochain-doubleur').textContent = Math.max(0, Math.ceil(etat.prochainDoubleurDans)) + 's';

  document.getElementById('ameliorations').innerHTML = renderAmeliorations();
  document.getElementById('zones').innerHTML = ZONES.map(renderZone).join('');

  document.getElementById('journal-list').innerHTML = etat.journal
    .map(j => `<li>${j.texte}</li>`)
    .join('');
}

function onZonesClick(evt) {
  const buyBtn = evt.target.closest('.buy-btn');
  if (buyBtn) {
    if (buyBtn.disabled) return;
    const res = acheterCreature(buyBtn.dataset.zone, parseInt(buyBtn.dataset.offre, 10));
    if (!res.ok) afficherToast(res.raison);
    render();
    return;
  }

  const evoBtn = evt.target.closest('.evo-btn');
  if (evoBtn) {
    if (evoBtn.disabled) return;
    const res = evoluerCreature(evoBtn.dataset.zone, parseInt(evoBtn.dataset.creature, 10));
    if (!res.ok) afficherToast(res.raison);
    render();
    return;
  }

  const doublerBtn = evt.target.closest('.doubler-btn');
  if (doublerBtn) {
    if (doublerBtn.disabled) return;
    const res = utiliserDoubleur(doublerBtn.dataset.zone);
    if (!res.ok) afficherToast(res.raison);
    render();
  }
}

function onAmeliorationsClick(evt) {
  const upBtn = evt.target.closest('.upgrade-btn[data-ameliore]');
  if (upBtn) {
    if (upBtn.disabled) return;
    const res = acheterAmelioration(upBtn.dataset.ameliore);
    if (!res.ok) afficherToast(res.raison);
    render();
    return;
  }

  if (evt.target.closest('#acheterDoubleurBtn')) {
    const btn = evt.target.closest('#acheterDoubleurBtn');
    if (btn.disabled) return;
    const res = acheterDoubleur();
    if (!res.ok) afficherToast(res.raison);
    render();
  }
}

function initUI() {
  document.getElementById('zones').addEventListener('click', onZonesClick);
  document.getElementById('ameliorations').addEventListener('click', onAmeliorationsClick);

  document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm('Effacer la sauvegarde et recommencer une nouvelle partie ?')) {
      reinitialiser();
      render();
    }
  });
}

function demarrerBoucle() {
  let dernier = performance.now();
  let accumulateurSauvegarde = 0;
  setInterval(() => {
    const maintenant = performance.now();
    const delta = Math.min((maintenant - dernier) / 1000, 2);
    dernier = maintenant;

    etat.argent += revenuTotalParSeconde() * delta;

    etat.prochainDoubleurDans -= delta;
    while (etat.prochainDoubleurDans <= 0) {
      etat.doubleurs++;
      ajouterJournal('🎁 Un doubleur gratuit est disponible !');
      etat.prochainDoubleurDans += DOUBLEUR_INTERVALLE;
    }

    render();

    accumulateurSauvegarde += delta;
    if (accumulateurSauvegarde >= 3) {
      accumulateurSauvegarde = 0;
      sauvegarder();
    }
  }, 200);
}

initJeu();
initUI();
render();
demarrerBoucle();
