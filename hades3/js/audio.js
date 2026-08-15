// ============================================================================
// Moteur audio — musique et effets sonores entièrement SYNTHÉTISÉS via Web Audio API,
// zéro fichier externe : cohérent avec la contrainte zéro-requête-réseau du jeu (voir
// bundle_arene.py / publication en Artifact, CSP stricte bloquant tout chargement
// réseau). Chaque son est un petit patch d'oscillateurs/bruit filtré avec enveloppe,
// pas un sample.
//
// Contrat avec le reste du jeu :
//   AudioEngine.sfx(name)              joue un effet sonore (voir SFX ci-dessous)
//   AudioEngine.startMusic(themeIdx)   démarre/assure la musique d'ambiance
//   AudioEngine.setMusicTheme(idx)     change de gamme/registre sans interrompre
//   AudioEngine.setMusicVolume(0..1)   AudioEngine.setSfxVolume(0..1)
//   AudioEngine.getMusicVolume()       AudioEngine.getSfxVolume()
// Le contexte audio ne démarre qu'après un premier geste utilisateur (contrainte des
// navigateurs) — voir unlock(), appelée par sfx()/startMusic() et par un écouteur
// global (js/game.js).
// ============================================================================

var AudioEngine = (function () {
  var ctx = null;
  var musicGain = null, sfxGain = null;
  var musicVolume = 0.5, sfxVolume = 0.7;
  var noiseBuffer = null;
  var musicPlaying = false;
  var musicTimer = null;
  var currentTheme = 0;
  var padOsc1 = null, padOsc2 = null, padGain = null, padFilter = null;
  var musicTension = 0; // 0 (salle calme) .. 1 (salle de boss) — pilote densité/dissonance de l'arpège et éclat du filtre du pad
  var roomSeed = 0; // change à chaque salle (pas juste à chaque chapitre) — réservé pour de futures variations

  var saved = (typeof loadAudioSettings === 'function') ? loadAudioSettings() : null;
  if (saved) {
    if (saved.music != null) musicVolume = saved.music;
    if (saved.sfx != null) sfxVolume = saved.sfx;
  }

  function ensureCtx() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      musicGain = ctx.createGain(); musicGain.gain.value = musicVolume; musicGain.connect(ctx.destination);
      sfxGain = ctx.createGain(); sfxGain.gain.value = sfxVolume; sfxGain.connect(ctx.destination);
      noiseBuffer = makeNoiseBuffer();
    } catch (e) { ctx = null; }
    return ctx;
  }

  function makeNoiseBuffer() {
    var len = ctx.sampleRate; // 1 seconde de bruit blanc, réutilisée pour tous les sons percussifs
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function unlock() {
    var c = ensureCtx();
    if (c && c.state === 'suspended') c.resume();
  }

  // ---- Enveloppe attaque/déclin exponentiel, commune à tous les sons — "hold" (option-
  // nel) insère un plateau au pic avant le déclin, pour un impact plus franc/plus "dur"
  // qu'un simple triangle attaque→déclin sur les sons percussifs. ----
  function envGain(dest, attack, decay, peak, hold) {
    var g = ctx.createGain();
    var t = ctx.currentTime;
    var h = hold || 0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    if (h > 0) g.gain.setValueAtTime(peak, t + attack + h);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + h + decay);
    g.connect(dest);
    return g;
  }

  function tone(freq, type, attack, decay, peak, dest, detune, freqEnd, hold) {
    var osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + attack + decay);
    if (detune) osc.detune.value = detune;
    var g = envGain(dest, attack, decay, peak, hold);
    osc.connect(g);
    osc.start();
    osc.stop(ctx.currentTime + attack + (hold || 0) + decay + 0.06);
  }

  function noiseHit(dest, attack, decay, peak, filterFreq, filterType, q) {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    var filt = ctx.createBiquadFilter();
    filt.type = filterType || 'bandpass';
    filt.frequency.value = filterFreq || 1200;
    if (q != null) filt.Q.value = q;
    var g = envGain(dest, attack, decay, peak);
    src.connect(filt); filt.connect(g);
    src.start();
    src.stop(ctx.currentTime + attack + decay + 0.06);
  }

  // Léger flottement aléatoire de fréquence/durée — sans ça, un son rejoué des dizaines
  // de fois par seconde en plein combat (hit, swing...) finit par sonner comme un
  // sample unique qui boucle au lieu d'un vrai impact à chaque coup.
  function jitter(v, pct) { return v * (1 + (Math.random() * 2 - 1) * pct); }

  // ---- Bibliothèque d'effets sonores — un son par FAMILLE d'action (pas une par arme :
  // 8+6 sons distincts aurait été une cacophonie illisible). Chaque son superpose
  // plusieurs couches (transitoire + corps, parfois une queue) plutôt qu'un seul
  // oscillateur/bruit isolé — plus de matière, plus facile à distinguer à l'oreille les
  // uns des autres, avec un léger flottement aléatoire pour ne jamais sonner deux fois
  // à l'identique. ----
  var SFX = {
    // Coup porté à un ennemi/mannequin (throttlé ~90ms, le son le plus rejoué du jeu) —
    // reste bref pour ne jamais fatiguer, mais un tic aigu SEUL sonnait creux : un souffle
    // de bruit clair + un petit corps grave en dessous donnent un vrai sentiment d'impact.
    hit: function () {
      noiseHit(sfxGain, 0.001, jitter(0.055, 0.2), 0.4, jitter(1900, 0.15), 'bandpass', 3.5);
      tone(jitter(210, 0.12), 'triangle', 0.001, 0.05, 0.22, sfxGain, 0, jitter(140, 0.1));
    },
    // Joueur touché — deux tons descendants dissonants + un grain de bruit qui donne du
    // "corps" à l'impact plutôt que deux sinusoïdes propres et froides.
    hurt: function () {
      tone(jitter(220, 0.08), 'sawtooth', 0.001, 0.16, 0.3, sfxGain, 0, 160);
      tone(jitter(140, 0.08), 'sawtooth', 0.001, 0.2, 0.26, sfxGain, -10, 100);
      noiseHit(sfxGain, 0.001, 0.09, 0.22, 900, 'bandpass', 1.2);
    },
    // Armes de mêlée (épée, couteau, charge) — whoosh passe-haut PLUS un corps grave
    // (scie qui plonge en hauteur, façon "swoosh" de lame lourde) pour donner du poids
    // au geste, puis un "thock" d'impact plus marqué à la fin — un simple souffle ne
    // rendait pas justice à un coup d'épée/de charge.
    swing: function () {
      noiseHit(sfxGain, 0.001, jitter(0.11, 0.2), 0.42, jitter(2700, 0.15), 'highpass');
      tone(jitter(300, 0.1), 'sawtooth', 0.001, 0.13, 0.24, sfxGain, -8, jitter(120, 0.15));
      tone(jitter(160, 0.15), 'sine', 0.001, 0.09, 0.22, sfxGain, 0, 80, 0.01);
    },
    // Armes à distance (tourelle, boomerang, onde de piques) — le duo carré+triangle qui
    // chute + le tic de bruit du "snap" restent, mais avec un coup de poing sub-grave en
    // dessous (façon recul d'arme) pour un tir qui claque au lieu de bipper.
    shoot: function () {
      var f = jitter(720, 0.1);
      tone(f, 'square', 0.001, 0.07, 0.22, sfxGain, -6, f * 0.65);
      tone(f * 1.5, 'triangle', 0.001, 0.05, 0.14, sfxGain, 6, f * 0.9);
      noiseHit(sfxGain, 0.001, 0.02, 0.14, 4000, 'highpass');
      tone(jitter(95, 0.1), 'sine', 0.001, 0.09, 0.2, sfxGain, 0, 55);
    },
    // Effets de zone (météore, poussée, attraction) — souffle grave + sub-bass renforcés,
    // un crack aigu au tout début, et une queue de bruit grave RETARDÉE (écho court) qui
    // simule la propagation de l'onde de choc plutôt qu'un boum sec qui s'arrête net.
    blast: function () {
      noiseHit(sfxGain, 0.001, 0.34, 0.56, 380, 'lowpass');
      tone(jitter(78, 0.1), 'sine', 0.001, 0.42, 0.44, sfxGain, 0, 45, 0.03);
      noiseHit(sfxGain, 0.001, 0.05, 0.26, 3200, 'highpass');
      setTimeout(function () { if (ctx) noiseHit(sfxGain, 0.001, 0.22, 0.2, 260, 'lowpass'); }, 90);
    },
    // Grappin / faille / dash — glissando montant doublé d'une seconde voix plus aiguë
    // légèrement décalée (effet "shimmer") + un souffle discret en dessous, pour une
    // vraie sensation de déplacement plutôt qu'un simple bip qui monte.
    teleport: function () {
      tone(300, 'sine', 0.001, 0.2, 0.26, sfxGain, 0, 900);
      tone(450, 'triangle', 0.02, 0.22, 0.14, sfxGain, 8, 1200);
      noiseHit(sfxGain, 0.001, 0.18, 0.1, 2200, 'highpass');
    },
    // Ramassage (relique, équipement d'arme) — trois notes ascendantes (au lieu de deux)
    // + un voile de bruit aigu très doux façon étincelle, pour une lecture "magique" plus
    // nette que deux notes triangle toutes seules.
    pickup: function () {
      tone(660, 'triangle', 0.001, 0.09, 0.26, sfxGain);
      noiseHit(sfxGain, 0.02, 0.12, 0.08, 5200, 'highpass');
      setTimeout(function () { if (ctx) tone(880, 'triangle', 0.001, 0.11, 0.24, sfxGain); }, 65);
      setTimeout(function () { if (ctx) tone(1320, 'triangle', 0.001, 0.16, 0.18, sfxGain); }, 135);
    },
    // Embrasement — déclenché une seule fois à l'ENTRÉE dans une zone de feu (brasier,
    // trace enflammée...), pas à chaque frame de dégâts continus (voir applyZoneEffects/
    // isPlayer._inFlame, combat.js) : un souffle qui monte en hauteur + 3 craquements de
    // bruit décalés façon flammèches qui prennent, plutôt qu'un simple "boum".
    ignite: function () {
      noiseHit(sfxGain, 0.001, 0.16, 0.4, 2600, 'bandpass', 2);
      tone(jitter(180, 0.1), 'sawtooth', 0.001, 0.28, 0.3, sfxGain, -6, 520);
      [0, 55, 120].forEach(function (delay, i) {
        setTimeout(function () { if (ctx) noiseHit(sfxGain, 0.001, 0.06, 0.14 - i * 0.02, jitter(4000, 0.2), 'highpass'); }, delay);
      });
    },
    // Mort d'un ennemi — pop grave étouffé + un thud descendant en dessous, pour une
    // vraie sensation de "chute" plutôt qu'un simple pop isolé.
    kill: function () {
      noiseHit(sfxGain, 0.001, 0.18, 0.34, 650, 'lowpass');
      tone(180, 'sine', 0.001, 0.16, 0.22, sfxGain, 0, 70);
    },
    // Clic d'interface générique (boutons de menu) — reste discret (utilisé à chaque
    // clic), juste un soupçon de deuxième harmonique pour ne pas sonner complètement plat.
    ui: function () {
      tone(520, 'triangle', 0.001, 0.045, 0.13, sfxGain);
      tone(1040, 'sine', 0.001, 0.03, 0.03, sfxGain);
    },
    // Victoire (run ou défi terminé) — fanfare arpégée à deux voix (mélodie + doublure à
    // la tierce en dessous) avec une brève traîne scintillante à la fin, plus étoffée
    // qu'une simple mélodie triangle seule.
    victory: function () {
      [523.3, 659.3, 784, 1046.5].forEach(function (f, i) {
        setTimeout(function () {
          if (!ctx) return;
          tone(f, 'triangle', 0.001, 0.22, 0.26, sfxGain, 0, null, 0.02);
          tone(f * 0.8, 'sine', 0.001, 0.22, 0.12, sfxGain, -4);
        }, i * 100);
      });
      setTimeout(function () {
        if (!ctx) return;
        [1568, 2093, 2637].forEach(function (f, i) {
          setTimeout(function () { if (ctx) tone(f, 'sine', 0.001, 0.3, 0.07, sfxGain); }, i * 55);
        });
      }, 420);
    }
  };

  function sfx(name) {
    if (!ensureCtx()) return;
    unlock();
    if (SFX[name]) SFX[name]();
  }

  // ---- Musique de combat générative, sous tension ----
  // Deux couches qui tournent en continu, toutes deux pilotées par `musicTension`
  // (0 salle calme .. 1 salle de boss) et `roomSeed` (change à CHAQUE salle, pas
  // juste à chaque chapitre — voir setMusicRoom) pour qu'aucune salle ne sonne pareil :
  //   1. Nappe (2 scies légèrement désaccordées), dont le filtre s'éclaircit avec la
  //      tension pour un son plus "tendu"/moins feutré en fin de chapitre.
  //   2. Des notes éparses (l'ancien "arpège") dont la densité et la dissonance (chance
  //      de piocher un intervalle de seconde mineure au lieu de la gamme) montent aussi
  //      avec la tension.
  // (Deux couches supplémentaires ont été essayées ici et retirées : un pouls percussif
  // rythmique, puis une 3e voix de nappe à un DEMI-TON de la fondamentale — les deux
  // signalés comme un bruit continu agaçant façon "mv mv mv". Une voix quasi-unisson
  // avec les 2 scies existantes bat contre elles (interférence audible en continu, pas
  // juste un détail de dissonance) : c'était la vraie source du bruit, pas le pouls
  // rythmique retiré au tour précédent — d'où sa suppression complète ici plutôt qu'un
  // simple réglage de volume.)
  // Une gamme par thème de chapitre (voir CHAPTER_THEMES/CHAPTER_GROUND_PALETTES, même
  // index) pour que l'ambiance sonore suive le changement de décor.
  var SCALE_BY_THEME = [
    [220, 261.6, 293.7, 329.6, 392],     // Sables
    [196, 233.1, 261.6, 293.7, 349.2],   // Marécage
    [246.9, 277.2, 329.6, 370, 415.3],   // Braise
    [207.7, 246.9, 277.2, 311.1, 370]    // Abîme
  ];

  function startPad(theme) {
    stopPad();
    var scale = SCALE_BY_THEME[theme % SCALE_BY_THEME.length];
    var root = scale[0] / 2;
    padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 420 + musicTension * 260;
    padFilter.connect(musicGain);
    padGain = ctx.createGain();
    padGain.gain.value = 0.15;
    padGain.connect(padFilter);
    padOsc1 = ctx.createOscillator(); padOsc1.type = 'sawtooth'; padOsc1.frequency.value = root; padOsc1.detune.value = -6;
    padOsc2 = ctx.createOscillator(); padOsc2.type = 'sawtooth'; padOsc2.frequency.value = root; padOsc2.detune.value = 6;
    padOsc1.connect(padGain); padOsc2.connect(padGain);
    padOsc1.start(); padOsc2.start();
    applyTensionToPad();
  }

  function stopPad() {
    if (padOsc1) { try { padOsc1.stop(); } catch (e) {} padOsc1 = null; }
    if (padOsc2) { try { padOsc2.stop(); } catch (e) {} padOsc2 = null; }
  }

  // Reprojette musicTension sur la nappe déjà en cours (éclat du filtre) sans
  // redémarrer les oscillateurs — appelé au changement de salle ET au démarrage.
  function applyTensionToPad() {
    if (!ctx) return;
    if (padFilter) padFilter.frequency.linearRampToValueAtTime(420 + musicTension * 260, ctx.currentTime + 1.2);
  }

  function scheduleArpNote() {
    if (!musicPlaying || !ctx) return;
    var scale = SCALE_BY_THEME[currentTheme % SCALE_BY_THEME.length];
    var dissonant = Math.random() < 0.12 + musicTension * 0.28;
    var freq = dissonant
      ? scale[Math.floor(Math.random() * scale.length)] * Math.pow(2, 1 / 12) * (Math.random() < 0.3 ? 2 : 1)
      : scale[Math.floor(Math.random() * scale.length)] * (Math.random() < 0.3 ? 2 : 1);
    var peak = 0.07 + musicTension * 0.05;
    tone(freq, 'triangle', 0.03, 1.1, peak, musicGain);
    var gapMax = 1500 - musicTension * 900, gapMin = 900 - musicTension * 500;
    musicTimer = setTimeout(scheduleArpNote, gapMin + Math.random() * (gapMax - gapMin));
  }

  function startMusic(theme) {
    if (!ensureCtx()) return;
    unlock();
    currentTheme = theme || 0;
    if (musicPlaying) { startPad(currentTheme); return; }
    musicPlaying = true;
    startPad(currentTheme);
    scheduleArpNote();
  }

  function setMusicTheme(theme) {
    theme = theme || 0;
    if (currentTheme === theme) return;
    currentTheme = theme;
    if (musicPlaying && ctx) startPad(currentTheme);
  }

  // Appelé à CHAQUE salle (pas juste à chaque chapitre, voir spawnWave dans combat.js) :
  // `tension` 0..1 (0 = salle normale en début de chapitre, 1 = salle de boss) et
  // `seed` un entier qui change à chaque salle, pour varier le motif rythmique du pouls
  // même entre deux salles de tension comparable.
  function setMusicRoom(tension, seed) {
    musicTension = Math.max(0, Math.min(1, tension || 0));
    roomSeed = seed || 0;
    applyTensionToPad();
  }

  function stopMusic() {
    musicPlaying = false;
    if (musicTimer) clearTimeout(musicTimer);
    stopPad();
  }

  // Pause/reprise (bouton Pause, ouverture des réglages en combat, alt-tab...) : coupe le
  // volume de la nappe sans démonter les oscillateurs ni le minuteur d'arpège — évite le
  // bruit continu qu'on entendait derrière un menu de pause/réglages qui ne "quitte" pas
  // vraiment la session (contrairement à backToMenu/exitArmory qui appellent stopMusic).
  function pauseMusic() {
    if (musicGain) musicGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
  }
  function resumeMusic() {
    if (musicGain) musicGain.gain.linearRampToValueAtTime(musicVolume, ctx.currentTime + 0.15);
  }

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function persist() {
    if (typeof saveAudioSettings === 'function') saveAudioSettings({ music: musicVolume, sfx: sfxVolume });
  }

  function setMusicVolume(v) {
    musicVolume = clamp01(v);
    if (musicGain) musicGain.gain.value = musicVolume;
    persist();
  }
  function setSfxVolume(v) {
    sfxVolume = clamp01(v);
    if (sfxGain) sfxGain.gain.value = sfxVolume;
    persist();
  }

  return {
    sfx: sfx,
    unlock: unlock,
    startMusic: startMusic,
    stopMusic: stopMusic,
    pauseMusic: pauseMusic,
    resumeMusic: resumeMusic,
    setMusicTheme: setMusicTheme,
    setMusicRoom: setMusicRoom,
    setMusicVolume: setMusicVolume,
    setSfxVolume: setSfxVolume,
    getMusicVolume: function () { return musicVolume; },
    getSfxVolume: function () { return sfxVolume; }
  };
})();
