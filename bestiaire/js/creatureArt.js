// Générateur d'apparence procédural : chaque créature a un portrait SVG original, unique et
// déterministe (dérivé de son nom), pour éviter le tout-emoji sans dessiner 100 sprites à la main.
// Le stade d'évolution (0/1/2) enrichit la même silhouette de base (aura, contour plus marqué)
// au lieu de générer une créature complètement différente à chaque évolution.

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function choisir(rng, tableau) {
  return tableau[Math.floor(rng() * tableau.length)];
}

const FORMES_CORPS = {
  rond:     () => `<ellipse cx="30" cy="33" rx="17" ry="15"/>`,
  ovale:    () => `<ellipse cx="30" cy="32" rx="13" ry="19"/>`,
  anguleux: () => `<polygon points="30,14 44,28 38,48 22,48 16,28"/>`,
  allonge:  () => `<ellipse cx="30" cy="35" rx="22" ry="11"/>`,
  trapu:    () => `<rect x="12" y="20" width="36" height="28" rx="10"/>`,
};

function traitDerriere(feature, bodyFill, outline) {
  if (feature === 'ailes') {
    return `<path d="M12,28 Q-2,16 6,38 Q13,35 13,27 Z" fill="${bodyFill}" stroke="${outline}" stroke-width="1.5"/>
      <path d="M48,28 Q62,16 54,38 Q47,35 47,27 Z" fill="${bodyFill}" stroke="${outline}" stroke-width="1.5"/>`;
  }
  if (feature === 'queue') {
    return `<path d="M45,40 Q59,42 55,53 Q47,49 44,40 Z" fill="${bodyFill}" stroke="${outline}" stroke-width="1.5"/>`;
  }
  return '';
}

function traitDevant(feature, outline) {
  if (feature === 'corne') {
    return `<polygon points="30,3 25,19 35,19" fill="${outline}"/>`;
  }
  if (feature === 'nageoire') {
    return `<polygon points="30,5 22,20 38,20" fill="${outline}"/>`;
  }
  if (feature === 'pics') {
    return `<polygon points="18,17 21,7 24,17" fill="${outline}"/>
      <polygon points="27,14 30,4 33,14" fill="${outline}"/>
      <polygon points="36,17 39,7 42,17" fill="${outline}"/>`;
  }
  if (feature === 'antennes') {
    return `<line x1="23" y1="17" x2="17" y2="3" stroke="${outline}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="17" cy="3" r="2.4" fill="${outline}"/>
      <line x1="37" y1="17" x2="43" y2="3" stroke="${outline}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="43" cy="3" r="2.4" fill="${outline}"/>`;
  }
  return '';
}

function motif(pattern, patternColor) {
  if (pattern === 'tachete') {
    return `<circle cx="23" cy="30" r="3" fill="${patternColor}" opacity="0.85"/>
      <circle cx="36" cy="37" r="2.3" fill="${patternColor}" opacity="0.85"/>
      <circle cx="29" cy="23" r="2" fill="${patternColor}" opacity="0.85"/>`;
  }
  if (pattern === 'rayures') {
    return `<path d="M15,28 Q30,24 45,28" stroke="${patternColor}" stroke-width="3" fill="none" opacity="0.8"/>
      <path d="M14,37 Q30,33 46,37" stroke="${patternColor}" stroke-width="3" fill="none" opacity="0.8"/>`;
  }
  return '';
}

function regard(outline) {
  return `<circle cx="24" cy="30" r="4.2" fill="#fff"/><circle cx="24" cy="30" r="2.1" fill="#1c1c22"/>
    <circle cx="36" cy="30" r="4.2" fill="#fff"/><circle cx="36" cy="30" r="2.1" fill="#1c1c22"/>
    <circle cx="25.2" cy="28.6" r="0.9" fill="#fff"/><circle cx="37.2" cy="28.6" r="0.9" fill="#fff"/>
    <path d="M26,40 Q30,43 34,40" stroke="${outline}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
}

function aureole(hue, stade) {
  if (stade <= 0) return '';
  const glowColor = `hsl(${(hue + 40) % 360} 85% 72%)`;
  let rings = `<circle cx="30" cy="32" r="27" fill="none" stroke="${glowColor}" stroke-width="2.2" opacity="0.55"/>`;
  if (stade >= 2) {
    rings += `<circle cx="30" cy="32" r="24" fill="none" stroke="${glowColor}" stroke-width="1.4" opacity="0.4"/>`;
  }
  return rings;
}

// La silhouette (forme, feature, motif, teinte) est fixée par le nom seul, pour que la créature
// reste reconnaissable d'un stade à l'autre — seule l'ornementation (aura, contour) évolue.
function genererApparence(nom, hueBase, stade) {
  stade = stade || 0;
  const rng = mulberry32(hashString(nom));
  const hue = (hueBase + Math.floor(rng() * 44 - 22) + 360) % 360;
  const sat = Math.min(95, 50 + Math.floor(rng() * 28) + stade * 6);
  const light = Math.min(72, 46 + Math.floor(rng() * 16) + stade * 3);
  const bodyFill = `hsl(${hue} ${sat}% ${light}%)`;
  const outline = `hsl(${hue} ${sat}% ${Math.max(8, light - 26)}%)`;
  const patternColor = `hsl(${(hue + 140) % 360} ${Math.max(30, sat - 10)}% ${Math.min(88, light + 22)}%)`;
  const epaisseur = 2 + stade * 0.6;

  const forme = choisir(rng, Object.keys(FORMES_CORPS));
  const feature = choisir(rng, ['ailes', 'corne', 'nageoire', 'pics', 'queue', 'antennes']);
  const pattern = choisir(rng, ['tachete', 'rayures', 'uni', 'uni']);

  return `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
    ${aureole(hue, stade)}
    ${traitDerriere(feature, bodyFill, outline)}
    <g fill="${bodyFill}" stroke="${outline}" stroke-width="${epaisseur}">${FORMES_CORPS[forme]()}</g>
    ${motif(pattern, patternColor)}
    ${traitDevant(feature, outline)}
    ${regard(outline)}
  </svg>`;
}
