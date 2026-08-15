(async function bootstrap() {
  const view = document.getElementById('view');
  try {
    await Storage.init();
    await PokedexData.load();
    UI.init();
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="card"><h2>Erreur de chargement</h2><p>${err.message}</p><p>Vérifie que <code>data/pokedex.json</code> existe (lance <code>scripts/fetch_pokedex.py</code>) et que l'application est servie via un serveur local (pas seulement ouverte en double-clic si ton navigateur bloque les requêtes <code>fetch</code> locales).</p></div>`;
  }
})();
