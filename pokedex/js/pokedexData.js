// Chargement et indexation des données du Pokédex (data/pokedex.json).
// Ce module ne contient aucune donnée en dur : tout vient du fichier JSON
// généré par scripts/fetch_pokedex.py depuis PokeAPI.
const PokedexData = (() => {
  let all = [];
  let byId = new Map();
  let formsById = new Map();
  let allTypes = [];
  let allGenerations = [];
  let allRegions = [];
  let cachedLines = null;

  async function load() {
    if (!window.POKEDEX_JSON) throw new Error('Impossible de charger data/pokedex.js');
    const json = window.POKEDEX_JSON;
    all = json.pokemon;
    byId = new Map(all.map((p) => [p.id, p]));
    formsById = new Map();
    for (const p of all) {
      for (const f of p.forms) formsById.set(f.id, { ...f, parentId: p.id });
    }
    cachedLines = null;

    const typeSet = new Set();
    const genSet = new Set();
    const regionSet = new Set();
    for (const p of all) {
      p.types.forEach((t) => typeSet.add(t));
      genSet.add(p.generation);
      regionSet.add(p.region);
    }
    allTypes = [...typeSet].sort();
    allGenerations = [...genSet].sort((a, b) => a - b);
    allRegions = [...regionSet];
    return json;
  }

  function getAll() {
    return all;
  }

  function getById(id) {
    return byId.get(id);
  }

  function getFormById(id) {
    return formsById.get(id);
  }

  function getTypes() {
    return allTypes;
  }

  function getGenerations() {
    return allGenerations;
  }

  function getRegions() {
    return allRegions;
  }

  function normalize(str) {
    return (str || '')
      .toString()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[♂♀]/g, '') // Nidoran♂/♀ etc. : le symbole ne doit pas être requis pour valider la réponse
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[’']/g, "'");
  }

  function search(query) {
    const q = normalize(query);
    if (!q) return all;
    return all.filter((p) => {
      if (String(p.number).includes(q)) return true;
      return normalize(p.name).includes(q) || normalize(p.name_en).includes(q);
    });
  }

  function filter({ generations, types, regions, ids } = {}) {
    return all.filter((p) => {
      if (ids && !ids.includes(p.id)) return false;
      if (generations && generations.length && !generations.includes(p.generation)) return false;
      if (types && types.length && !p.types.some((t) => types.includes(t))) return false;
      if (regions && regions.length && !regions.includes(p.region)) return false;
      return true;
    });
  }

  function evolutionFamily(p) {
    const from = p.evolves_from ? byId.get(p.evolves_from) : null;
    const to = p.evolves_to.map((id) => byId.get(id)).filter(Boolean);
    return { from, to };
  }

  // Toute la lignée évolutive de `p`, de la base jusqu'aux formes finales,
  // sous forme d'étages (un étage peut contenir plusieurs pokémon en cas
  // d'embranchement, ex: Évoli). Retourne un tableau de tableaux.
  function fullEvolutionLine(p) {
    let root = p;
    while (root.evolves_from) {
      const parent = byId.get(root.evolves_from);
      if (!parent) break;
      root = parent;
    }
    const stages = [];
    const seen = new Set([root.id]);
    let current = [root];
    while (current.length) {
      stages.push(current);
      const next = [];
      for (const node of current) {
        for (const childId of node.evolves_to) {
          if (!seen.has(childId)) {
            seen.add(childId);
            const child = byId.get(childId);
            if (child) next.push(child);
          }
        }
      }
      current = next;
    }
    return stages;
  }

  // Toutes les lignées évolutives du Pokédex, une par pokémon racine
  // (celui qui n'a pas de pré-évolution), triées par numéro de dex du
  // membre le plus bas. Chaque lignée est un groupe d'apprentissage.
  function allEvolutionLines() {
    if (cachedLines) return cachedLines;
    const roots = all.filter((p) => !p.evolves_from);
    cachedLines = roots
      .map((root) => ({
        rootId: root.id,
        generation: root.generation,
        ids: fullEvolutionLine(root).flat().map((m) => m.id),
      }))
      .sort((a, b) => a.rootId - b.rootId);
    return cachedLines;
  }

  // Choisit `count` pokémon "distracteurs" différents de `correct`, en
  // privilégiant une proximité de type ou de numéro de dex (silhouettes /
  // familles visuellement ou thématiquement proches), pour des choix
  // multiples pertinents plutôt que purement aléatoires.
  function pickDistractors(correct, count, pool = all) {
    const candidates = pool.filter((p) => p.id !== correct.id);
    const scored = candidates.map((p) => {
      let score = 0;
      const sharedTypes = p.types.filter((t) => correct.types.includes(t)).length;
      score += sharedTypes * 3;
      const dexGap = Math.abs(p.number - correct.number);
      if (dexGap <= 15) score += 2;
      if (p.name[0] === correct.name[0]) score += 1;
      if (Math.abs(p.name.length - correct.name.length) <= 2) score += 1;
      score += Math.random() * 2; // évite un ordre déterministe
      return { p, score };
    });
    scored.sort((a, b) => b.score - a.score);
    // On prend un mélange : quelques distracteurs "proches" + du hasard pur
    // pour ne pas rendre le jeu prévisible.
    const closePicks = scored.slice(0, Math.max(count * 2, 8));
    shuffle(closePicks);
    const picked = closePicks.slice(0, count).map((s) => s.p);
    if (picked.length < count) {
      const rest = candidates.filter((p) => !picked.includes(p));
      shuffle(rest);
      picked.push(...rest.slice(0, count - picked.length));
    }
    return picked;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  return {
    load,
    getAll,
    getById,
    getFormById,
    getTypes,
    getGenerations,
    getRegions,
    normalize,
    search,
    filter,
    evolutionFamily,
    fullEvolutionLine,
    allEvolutionLines,
    pickDistractors,
    shuffle,
  };
})();
