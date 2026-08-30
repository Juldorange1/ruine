// Génération et notation du formulaire complet de "Réviser". Toutes les
// données viennent de PokedexData, jamais inventées.
const QuizEngine = (() => {
  // kind: 'numeric' (chiffres/virgule uniquement) | 'picker' (choix en
  // cliquant parmi les possibilités, pas de saisie libre) | 'lineage'
  // (cases de la lignée évolutive) | 'text' (saisie libre).
  const REVIEW_FIELDS = [
    { key: 'numero', label: 'Numéro de Pokédex', kind: 'numeric' },
    { key: 'generation', label: 'Génération', kind: 'picker', multi: false },
    { key: 'region', label: 'Région', kind: 'picker', multi: false },
    { key: 'nom', label: 'Nom', kind: 'text' },
    { key: 'type', label: 'Type(s)', kind: 'picker', multi: true },
    { key: 'lignee', label: 'Lignée', kind: 'lineage' },
    { key: 'taille', label: 'Taille (m)', kind: 'numeric' },
    { key: 'poids', label: 'Poids (kg)', kind: 'numeric' },
  ];

  function genReviewForm(p) {
    return {
      mode: 'reviewform',
      pokemon: p,
      answerType: 'form',
      prompt: 'Remplis ce que tu sais sur ce Pokémon (laisse vide ce que tu ignores) :',
      fields: REVIEW_FIELDS,
    };
  }

  function reviewFieldDisplay(key, p) {
    switch (key) {
      case 'numero': return String(p.number);
      case 'generation': return String(p.generation);
      case 'region': return p.region;
      case 'nom': return p.name;
      case 'type': return p.types.join(', ');
      case 'lignee': {
        const stages = PokedexData.fullEvolutionLine(p);
        return stages.flatMap((stage) => stage.slice().sort((a, b) => a.number - b.number).map((m) => m.name)).join(' → ');
      }
      case 'taille': return `${(p.height_dm / 10).toFixed(1)} m`;
      case 'poids': return `${(p.weight_hg / 10).toFixed(1)} kg`;
      default: return '';
    }
  }

  // Retourne {attempted, correct}. Un champ laissé vide n'est pas noté
  // (attempted:false) : on ne pénalise pas ce qu'on n'a pas essayé.
  function checkReviewField(key, p, rawValue) {
    const value = (rawValue || '').trim();
    if (!value) return { attempted: false, correct: false };
    const norm = PokedexData.normalize;
    switch (key) {
      case 'numero':
        return { attempted: true, correct: value.replace(/\D/g, '') === String(p.number) };
      case 'generation':
        return { attempted: true, correct: value.replace(/\D/g, '') === String(p.generation) };
      case 'region':
        return { attempted: true, correct: norm(value) === norm(p.region) };
      case 'nom':
        return { attempted: true, correct: norm(value) === norm(p.name) };
      case 'type': {
        const given = value.split(/[,/]| et /i).map((s) => norm(s)).filter(Boolean);
        const actual = p.types.map((t) => norm(t));
        const equal = given.length === actual.length && actual.every((t) => given.includes(t));
        return { attempted: true, correct: equal };
      }
      case 'taille': {
        const num = parseFloat(value.replace(',', '.'));
        if (Number.isNaN(num)) return { attempted: true, correct: false };
        const actual = p.height_dm / 10;
        return { attempted: true, correct: Math.abs(num - actual) <= Math.max(0.2, actual * 0.2) };
      }
      case 'poids': {
        const num = parseFloat(value.replace(',', '.'));
        if (Number.isNaN(num)) return { attempted: true, correct: false };
        const actual = p.weight_hg / 10;
        return { attempted: true, correct: Math.abs(num - actual) <= Math.max(1, actual * 0.2) };
      }
      default:
        return { attempted: false, correct: false };
    }
  }

  return {
    REVIEW_FIELDS, genReviewForm, checkReviewField, reviewFieldDisplay,
  };
})();
