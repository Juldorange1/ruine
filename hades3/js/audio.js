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
  var musicTension = 0; // 0 (salle calme) .. 1 (salle de boss) — pilote densité/dissonance de l'arpège et des respirations d'ambiance
  var roomSeed = 0; // change à chaque salle (pas juste à chaque chapitre) — réservé pour de futures variations

  var saved = (typeof loadAudioSettings === 'function') ? loadAudioSettings() : null;
  if (saved) {
    if (saved.music != null) musicVolume = saved.music;
    if (saved.sfx != null) sfxVolume = saved.sfx;
  }

  // Petit réverbérateur algorithmique (ligne à retard + contre-réaction filtrée, pas
  // de fichier de réponse impulsionnelle — cohérent avec la contrainte zéro-asset) :
  // donne un peu d'espace/de corps à TOUS les sons plutôt que de sonner strictement
  // secs, sans machinerie lourde. Mix discret (voir wetGain) pour ne jamais noyer les
  // sons répétés en plein combat (hit...) dans une traîne boueuse.
  var reverbSend = null;
  function makeReverbSend() {
    var input = ctx.createGain();
    var delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0.05;
    var damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 3200;
    var feedback = ctx.createGain();
    feedback.gain.value = 0.32;
    var wetGain = ctx.createGain();
    wetGain.gain.value = 0.16;
    input.connect(delay);
    delay.connect(damp);
    damp.connect(feedback);
    feedback.connect(delay);
    damp.connect(wetGain);
    wetGain.connect(ctx.destination);
    return input;
  }

  function ensureCtx() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      musicGain = ctx.createGain(); musicGain.gain.value = musicVolume; musicGain.connect(ctx.destination);
      sfxGain = ctx.createGain(); sfxGain.gain.value = sfxVolume; sfxGain.connect(ctx.destination);
      reverbSend = makeReverbSend();
      musicGain.connect(reverbSend);
      sfxGain.connect(reverbSend);
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
  function envGain(dest, attack, decay, peak, hold, pan) {
    var g = ctx.createGain();
    var t = ctx.currentTime;
    var h = hold || 0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    if (h > 0) g.gain.setValueAtTime(peak, t + attack + h);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + h + decay);
    // Léger panoramique optionnel (voir jitterPan) : un mixage strictement mono pour
    // tout finissait par sonner plat/artificiel malgré des sons individuellement plus
    // riches — un soupçon de mouvement stéréo donne une vraie sensation d'espace.
    if (pan != null && ctx.createStereoPanner) {
      var p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p);
      p.connect(dest);
    } else {
      g.connect(dest);
    }
    return g;
  }

  function tone(freq, type, attack, decay, peak, dest, detune, freqEnd, hold, pan) {
    var osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + attack + decay);
    if (detune) osc.detune.value = detune;
    var g = envGain(dest, attack, decay, peak, hold, pan);
    osc.connect(g);
    osc.start();
    osc.stop(ctx.currentTime + attack + (hold || 0) + decay + 0.06);
  }

  function noiseHit(dest, attack, decay, peak, filterFreq, filterType, q, pan) {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    var filt = ctx.createBiquadFilter();
    filt.type = filterType || 'bandpass';
    filt.frequency.value = filterFreq || 1200;
    if (q != null) filt.Q.value = q;
    var g = envGain(dest, attack, decay, peak, 0, pan);
    src.connect(filt); filt.connect(g);
    src.start();
    src.stop(ctx.currentTime + attack + decay + 0.06);
  }

  // Léger flottement aléatoire de fréquence/durée — sans ça, un son rejoué des dizaines
  // de fois par seconde en plein combat (hit, swing...) finit par sonner comme un
  // sample unique qui boucle au lieu d'un vrai impact à chaque coup.
  function jitter(v, pct) { return v * (1 + (Math.random() * 2 - 1) * pct); }
  // Panoramique aléatoire léger — voir envGain.
  function jitterPan(spread) { return (Math.random() * 2 - 1) * (spread != null ? spread : 0.35); }

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
      var pan = jitterPan(0.5);
      noiseHit(sfxGain, 0.001, jitter(0.055, 0.2), 0.4, jitter(1900, 0.15), 'bandpass', 3.5, pan);
      tone(jitter(210, 0.12), 'triangle', 0.001, 0.05, 0.22, sfxGain, 0, jitter(140, 0.1), 0, pan);
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
      var pan = jitterPan(0.4);
      noiseHit(sfxGain, 0.001, jitter(0.11, 0.2), 0.42, jitter(2700, 0.15), 'highpass', null, pan);
      tone(jitter(300, 0.1), 'sawtooth', 0.001, 0.13, 0.24, sfxGain, -8, jitter(120, 0.15), 0, pan);
      tone(jitter(160, 0.15), 'sine', 0.001, 0.09, 0.22, sfxGain, 0, 80, 0.01, pan);
    },
    // Armes à distance (tourelle, boomerang, onde de piques) — le duo carré+triangle qui
    // chute + le tic de bruit du "snap" restent, mais avec un coup de poing sub-grave en
    // dessous (façon recul d'arme) pour un tir qui claque au lieu de bipper.
    shoot: function () {
      var f = jitter(720, 0.1);
      var pan = jitterPan(0.45);
      tone(f, 'square', 0.001, 0.07, 0.22, sfxGain, -6, f * 0.65, 0, pan);
      tone(f * 1.5, 'triangle', 0.001, 0.05, 0.14, sfxGain, 6, f * 0.9, 0, pan);
      noiseHit(sfxGain, 0.001, 0.02, 0.14, 4000, 'highpass', null, pan);
      tone(jitter(95, 0.1), 'sine', 0.001, 0.09, 0.2, sfxGain, 0, 55, 0, pan);
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
      var pan = jitterPan(0.4);
      noiseHit(sfxGain, 0.001, 0.18, 0.34, 650, 'lowpass', null, pan);
      tone(180, 'sine', 0.001, 0.16, 0.22, sfxGain, 0, 70, 0, pan);
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
  // AUCUN oscillateur ne joue plus en continu — signalé À TROIS REPRISES comme un
  // "mmmmmm"/bourdonnement permanent agaçant malgré plusieurs tentatives de le
  // localiser (pouls rythmique retiré, puis 3e voix de nappe quasi-unisson retirée) :
  // la vraie cause était plus simple et plus ancienne que ces deux ajouts récents —
  // la nappe de fond ELLE-MÊME (2 scies légèrement désaccordées) jouait sans
  // interruption du début à la fin de chaque session, ce qui EST par construction un
  // bourdonnement permanent, quel que soit le soin apporté à son timbre. Remplacée
  // par des "respirations" ponctuelles (scheduleAmbientSwell) : chaque note d'ambiance
  // monte, tient un court instant, puis s'éteint complètement — silence réel entre
  // deux, jamais un son qui reste ouvert indéfiniment. Deux couches :
  //   1. scheduleAmbientSwell — souffle doux (triangle, pas de scie bruyante) qui
  //      apparaît et disparaît toutes les quelques secondes, plus fréquent/plus
  //      lumineux (filtre) quand `musicTension` monte.
  //   2. scheduleArpNote — notes éparses ponctuelles, densité/dissonance croissantes
  //      avec la tension (inchangé).
  // Une gamme par thème de chapitre (voir CHAPTER_THEMES/CHAPTER_GROUND_PALETTES, même
  // index) pour que l'ambiance sonore suive le changement de décor.
  var SCALE_BY_THEME = [
    [220, 261.6, 293.7, 329.6, 392],     // Sables
    [196, 233.1, 261.6, 293.7, 349.2],   // Marécage
    [246.9, 277.2, 329.6, 370, 415.3],   // Braise
    [207.7, 246.9, 277.2, 311.1, 370]    // Abîme
  ];
  var swellTimer = null;

  function scheduleAmbientSwell() {
    if (!musicPlaying || !ctx) return;
    var scale = SCALE_BY_THEME[currentTheme % SCALE_BY_THEME.length];
    var root = scale[Math.floor(Math.random() * scale.length)] / 2;
    var dur = 2.6 + Math.random() * 2.2;
    var peak = 0.09 + musicTension * 0.06;
    var g = ctx.createGain();
    var filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 800 + musicTension * 500;
    filt.connect(musicGain);
    g.connect(filt);
    var t0 = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    [-4, 4].forEach(function (det) {
      var o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = root;
      o.detune.value = det;
      o.connect(g);
      o.start();
      o.stop(t0 + dur + 0.1);
    });
    // Silence RÉEL entre deux respirations (jamais chaînées bout à bout) — plus
    // rapproché quand la tension monte, mais toujours un vrai creux de silence.
    var gapMin = 1800 - musicTension * 900, gapMax = 4200 - musicTension * 2000;
    swellTimer = setTimeout(scheduleAmbientSwell, dur * 1000 + gapMin + Math.random() * (gapMax - gapMin));
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
    if (musicPlaying) return;
    musicPlaying = true;
    scheduleAmbientSwell();
    scheduleArpNote();
  }

  function setMusicTheme(theme) {
    theme = theme || 0;
    currentTheme = theme;
  }

  // Appelé à CHAQUE salle (pas juste à chaque chapitre, voir spawnWave dans combat.js) :
  // `tension` 0..1 (0 = salle normale en début de chapitre, 1 = salle de boss) et
  // `seed` un entier qui change à chaque salle (réservé pour de futures variations).
  function setMusicRoom(tension, seed) {
    musicTension = Math.max(0, Math.min(1, tension || 0));
    roomSeed = seed || 0;
  }

  function stopMusic() {
    musicPlaying = false;
    if (musicTimer) clearTimeout(musicTimer);
    if (swellTimer) clearTimeout(swellTimer);
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
