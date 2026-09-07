// ============================================================================
// ASCENSION — sound.js
// Effets sonores courts : un son par catégorie d'action plutôt qu'une variante
// par mécanique (saut/double saut/wall-jump partagent un seul son, par
// exemple) — moins d'effets, mais chacun se déclenche plus souvent et reste
// cohérent. Sources CC0/domaine public : Kenney (impacts/bell) et un vrai
// enregistrement de vent (SoundBible, "Wind" par Stilgar, domaine public)
// façonné en un souffle bref pour le dash, plutôt qu'un bruit synthétique.
// Volume réglable (voir setMasterVolume), persisté par main.js.
window.AS = window.AS || {};

AS.Sound = (function () {
  const FILES = {
    jump: 'assets/sfx/jump.wav',       // saut, double saut ET wall-jump
    land: 'assets/sfx/land.wav',
    dash: 'assets/sfx/dash.wav',
    checkpoint: 'assets/sfx/checkpoint.ogg',
    bounce: 'assets/sfx/bounce.ogg',    // rebond simple ET rebond parfait
    phaseGate: 'assets/sfx/phaseGate.wav',
    finish: 'assets/sfx/finish.ogg',
    victory: 'assets/sfx/victory.ogg', // arrivée avec un nouveau record de temps
    uiClick: 'assets/sfx/uiClick.wav',
  };
  const VOLUME = {
    jump: 0.55, land: 0.4, dash: 0.5, checkpoint: 0.5,
    bounce: 0.55, phaseGate: 0.45, finish: 0.7, victory: 0.75, uiClick: 0.3,
  };
  const POOL_SIZE = 4;
  const pools = {};
  const nextIdx = {};
  let ready = false;
  let masterVolume = 1;

  function preload() {
    if (ready) return;
    ready = true;
    Object.keys(FILES).forEach((name) => {
      const pool = [];
      for (let i = 0; i < POOL_SIZE; i++) {
        const a = new Audio(FILES[name]);
        a.preload = 'auto';
        pool.push(a);
      }
      pools[name] = pool;
      nextIdx[name] = 0;
    });
  }

  function setMasterVolume(v) {
    masterVolume = AS.Util.clamp(v, 0, 1);
  }
  function getMasterVolume() { return masterVolume; }

  // Prend la prochaine instance du pool (tourniquet) plutôt que de réutiliser
  // toujours la même — sinon deux déclenchements rapprochés (ex. atterrissages
  // qui s'enchaînent) couperaient le son précédent au lieu de se chevaucher.
  // `rate` change la vitesse de lecture (donc la hauteur) — un léger aléa
  // évite qu'un même son répété (saut, rebond...) sonne identique à chaque
  // fois, et une valeur fixe distingue une variante (ex. rebond parfait)
  // sans ajouter de fichier supplémentaire.
  function play(name, rate) {
    const pool = pools[name];
    if (!pool || masterVolume <= 0) return;
    const i = nextIdx[name] % pool.length;
    nextIdx[name] = i + 1;
    const a = pool[i];
    try {
      a.currentTime = 0;
      a.volume = (VOLUME[name] != null ? VOLUME[name] : 0.5) * masterVolume;
      a.playbackRate = rate || 1;
      const p = a.play();
      if (p && p.catch) p.catch(() => { /* lecture bloquée avant 1re interaction : ignoré */ });
    } catch (e) { /* ignore */ }
  }

  return { preload, play, setMasterVolume, getMasterVolume };
})();
