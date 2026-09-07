// ============================================================================
// ASCENSION — utils.js
// Helpers génériques : RNG, maths, textures procédurales (canvas).
// Namespace global unique : window.AS
// ============================================================================
window.AS = window.AS || {};

AS.Util = (function () {

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function damp(current, target, lambda, dt) {
    return lerp(current, target, 1 - Math.exp(-lambda * dt));
  }

  // ---- Bruit de valeur 2D léger (pour silhouettes de montagnes, terrain) --
  function valueNoise2D(seed) {
    const rng = mulberry32(seed || 1);
    const grid = {};
    function hash(x, y) {
      const key = x + ',' + y;
      if (grid[key] === undefined) grid[key] = rng();
      return grid[key];
    }
    return function (x, y) {
      const x0 = Math.floor(x), y0 = Math.floor(y);
      const fx = x - x0, fy = y - y0;
      const a = hash(x0, y0), b = hash(x0 + 1, y0);
      const c = hash(x0, y0 + 1), d = hash(x0 + 1, y0 + 1);
      const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      return lerp(lerp(a, b, u), lerp(c, d, u), v);
    };
  }

  // ---- Textures procédurales (canvas 2D -> THREE.CanvasTexture) ----------
  function canvasTexture(size, drawFn) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    drawFn(ctx, size);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    return tex;
  }

  function rockTexture(base, dark, light, seed) {
    const rng = mulberry32(seed || 1234);
    return canvasTexture(256, (ctx, s) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 900; i++) {
        const x = rng() * s, y = rng() * s, r = rng() * rng() * 10 + 1;
        ctx.fillStyle = rng() > 0.5 ? dark : light;
        ctx.globalAlpha = 0.10 + rng() * 0.18;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * (0.5 + rng() * 0.8), rng() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  }

  function grassTexture(base, blade1, blade2, seed) {
    const rng = mulberry32(seed || 4321);
    return canvasTexture(256, (ctx, s) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 500; i++) {
        const x = rng() * s, y = rng() * s;
        ctx.strokeStyle = rng() > 0.5 ? blade1 : blade2;
        ctx.globalAlpha = 0.25 + rng() * 0.4;
        ctx.lineWidth = 1 + rng();
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rng() - 0.5) * 6, y - 5 - rng() * 6);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
  }

  function iceTexture(seed) {
    const rng = mulberry32(seed || 99);
    return canvasTexture(256, (ctx, s) => {
      const g = ctx.createLinearGradient(0, 0, s, s);
      g.addColorStop(0, '#dff3fb');
      g.addColorStop(1, '#aee0f2');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      for (let i = 0; i < 20; i++) {
        ctx.globalAlpha = 0.15 + rng() * 0.3;
        ctx.beginPath();
        const x = rng() * s, y = rng() * s;
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rng() - 0.5) * 60, y + (rng() - 0.5) * 60);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
  }

  function dotSpriteTexture(color) {
    return canvasTexture(64, (ctx, s) => {
      const g = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    });
  }

  function skyTexture(top, mid, bottom) {
    return canvasTexture(512, (ctx, s) => {
      const g = ctx.createLinearGradient(0, 0, 0, s);
      g.addColorStop(0, top);
      g.addColorStop(0.55, mid);
      g.addColorStop(1, bottom);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    });
  }

  // Ajoute un motif "maintenir pour confirmer" à un bouton, plutôt qu'un
  // window.confirm() — peu fiable dans certains contextes intégrés (ex. un
  // Artifact en bac à sable, où confirm()/alert() peuvent être bloqués et
  // renvoyer faux silencieusement, empêchant l'action de continuer). Donne
  // aussi un retour visuel progressif (remplissage CSS) pendant l'appui.
  function holdToConfirm(el, holdMs, onConfirm) {
    let timer = null;
    el.style.setProperty('--hold-ms', holdMs + 'ms');
    const start = (e) => {
      e.preventDefault();
      el.classList.add('holding');
      timer = setTimeout(() => {
        el.classList.remove('holding');
        timer = null;
        onConfirm();
      }, holdMs);
    };
    const cancel = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      el.classList.remove('holding');
    };
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointerup', cancel);
    el.addEventListener('pointerleave', cancel);
    el.addEventListener('pointercancel', cancel);
  }

  return {
    mulberry32, clamp, lerp, smoothstep, damp, valueNoise2D,
    canvasTexture, rockTexture, grassTexture, iceTexture, dotSpriteTexture, skyTexture,
    holdToConfirm,
  };
})();
