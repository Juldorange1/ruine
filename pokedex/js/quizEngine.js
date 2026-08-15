// Génération des questions pour les modes du "Jeu" (quiz), et vérification
// des réponses. Toutes les questions sont dérivées des données de
// PokedexData, jamais inventées. L'exposition sans question ("Apprendre")
// est gérée séparément dans ui.js, pas ici.
const QuizEngine = (() => {
  const MODE_LABELS = {
    image2nom: 'Image → Nom',
    nom2image: 'Nom → Image',
    type: 'Type',
    numero: 'Numéro',
    evolution: 'Évolution',
    generation: 'Génération',
    region: 'Région',
    flash: 'Reconnaissance rapide',
    qcm: 'Choix multiple',
    vraifaux: 'Vrai / Faux',
  };

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function genImage2Nom(p) {
    return {
      mode: 'image2nom',
      pokemon: p,
      prompt: 'Quel est ce Pokémon ?',
      answerType: 'text',
      correct: p.name,
    };
  }

  function genNom2Image(p, pool) {
    const distractors = PokedexData.pickDistractors(p, 3, pool.filter((x) => x.image));
    const choices = PokedexData.shuffle([
      { id: p.id, image: p.image, label: p.name },
      ...distractors.map((d) => ({ id: d.id, image: d.image, label: d.name })),
    ]);
    return {
      mode: 'nom2image',
      pokemon: p,
      prompt: `Sélectionne l'image de ${p.name}.`,
      answerType: 'choice',
      choices,
      correct: p.id,
      hideChoiceLabels: true,
    };
  }

  function genType(p) {
    const allTypes = PokedexData.getTypes();
    const wrongPool = allTypes.filter((t) => !p.types.includes(t));
    PokedexData.shuffle(wrongPool);
    const wrongCount = Math.max(3, 6 - p.types.length);
    const choices = PokedexData.shuffle([...p.types, ...wrongPool.slice(0, wrongCount)]);
    return {
      mode: 'type',
      pokemon: p,
      prompt: p.types.length > 1 ? 'Quels sont ses types ?' : 'Quel est son type ?',
      answerType: 'multichoice',
      choices: choices.map((t) => ({ id: t, label: t })),
      correct: [...p.types],
    };
  }

  function genNumero(p) {
    return {
      mode: 'numero',
      pokemon: p,
      prompt: 'Quel est son numéro de Pokédex ?',
      answerType: 'text',
      correct: String(p.number),
    };
  }

  function genEvolution(p, pool) {
    const targets = p.evolves_to.map((id) => PokedexData.getById(id)).filter(Boolean);
    const hasEvolution = targets.length > 0;
    const distractorPool = pool.filter((x) => x.image && x.id !== p.id && !p.evolves_to.includes(x.id) && x.id !== p.evolves_from);
    const distractors = PokedexData.pickDistractors(p, 3, distractorPool);
    let choices;
    let correct;
    if (hasEvolution) {
      const correctChoice = pick(targets);
      choices = PokedexData.shuffle([
        { id: correctChoice.id, image: correctChoice.image, label: correctChoice.name },
        ...distractors.map((d) => ({ id: d.id, image: d.image, label: d.name })),
      ]);
      correct = targets.map((t) => t.id);
    } else {
      choices = PokedexData.shuffle([
        { id: 'none', image: null, label: "N'évolue pas" },
        ...distractors.map((d) => ({ id: d.id, image: d.image, label: d.name })),
      ]);
      correct = ['none'];
    }
    return {
      mode: 'evolution',
      pokemon: p,
      prompt: hasEvolution ? `Quelle est l'évolution de ${p.name} ?` : `${p.name} évolue-t-il ?`,
      answerType: 'choice',
      choices,
      correct,
      multiCorrectOk: true,
    };
  }

  function genGeneration(p) {
    const gens = PokedexData.getGenerations();
    const wrong = PokedexData.shuffle(gens.filter((g) => g !== p.generation)).slice(0, 3);
    const choices = PokedexData.shuffle([p.generation, ...wrong]).map((g) => ({ id: g, label: `Génération ${g}` }));
    return {
      mode: 'generation',
      pokemon: p,
      prompt: 'De quelle génération vient ce Pokémon ?',
      answerType: 'choice',
      choices,
      correct: p.generation,
    };
  }

  function genRegion(p) {
    const regions = PokedexData.getRegions();
    const wrong = PokedexData.shuffle(regions.filter((r) => r !== p.region)).slice(0, 3);
    const choices = PokedexData.shuffle([p.region, ...wrong]).map((r) => ({ id: r, label: r }));
    return {
      mode: 'region',
      pokemon: p,
      prompt: 'Dans quelle région ce Pokémon a-t-il été introduit ?',
      answerType: 'choice',
      choices,
      correct: p.region,
    };
  }

  function genFlash(p) {
    return {
      mode: 'flash',
      pokemon: p,
      prompt: 'Quel Pokémon viens-tu de voir ?',
      answerType: 'text',
      correct: p.name,
      flashMs: 1200,
    };
  }

  function genQCM(p, pool) {
    const distractors = PokedexData.pickDistractors(p, 3, pool);
    const choices = PokedexData.shuffle([
      { id: p.id, label: p.name },
      ...distractors.map((d) => ({ id: d.id, label: d.name })),
    ]);
    return {
      mode: 'qcm',
      pokemon: p,
      prompt: 'Quel est ce Pokémon ?',
      answerType: 'choice',
      choices,
      correct: p.id,
    };
  }

  function genVraiFaux(p, pool) {
    const categories = ['type', 'generation', 'region', 'evolution'];
    const cat = pick(categories);
    let statement;
    let correct;
    let trueStatement;

    if (cat === 'type') {
      trueStatement = `${p.name} est de type ${p.types.join(' et ')}.`;
      const isTrue = Math.random() < 0.5;
      const type = isTrue
        ? pick(p.types)
        : pick(PokedexData.getTypes().filter((t) => !p.types.includes(t)));
      statement = `${p.name} est de type ${type}.`;
      correct = isTrue;
    } else if (cat === 'generation') {
      trueStatement = `${p.name} vient de la génération ${p.generation}.`;
      const isTrue = Math.random() < 0.5;
      const gen = isTrue ? p.generation : pick(PokedexData.getGenerations().filter((g) => g !== p.generation));
      statement = `${p.name} vient de la génération ${gen}.`;
      correct = isTrue;
    } else if (cat === 'region') {
      trueStatement = `${p.name} est originaire de la région ${p.region}.`;
      const isTrue = Math.random() < 0.5;
      const region = isTrue ? p.region : pick(PokedexData.getRegions().filter((r) => r !== p.region));
      statement = `${p.name} est originaire de la région ${region}.`;
      correct = isTrue;
    } else {
      const realTargets = p.evolves_to.map((id) => PokedexData.getById(id)).filter(Boolean);
      trueStatement = realTargets.length
        ? `${p.name} évolue en ${realTargets.map((t) => t.name).join(' ou ')}.`
        : `${p.name} n'évolue pas.`;
      const isTrue = Math.random() < 0.5;
      if (p.evolves_to.length === 0) {
        if (isTrue) {
          statement = `${p.name} n'évolue pas.`;
          correct = true;
        } else {
          const other = pick(pool.filter((x) => x.id !== p.id));
          statement = `${p.name} évolue en ${other.name}.`;
          correct = false;
        }
      } else if (isTrue) {
        const target = PokedexData.getById(pick(p.evolves_to));
        statement = `${p.name} évolue en ${target.name}.`;
        correct = true;
      } else {
        const other = pick(pool.filter((x) => x.id !== p.id && !p.evolves_to.includes(x.id)));
        statement = `${p.name} évolue en ${other.name}.`;
        correct = false;
      }
    }

    return { mode: 'vraifaux', pokemon: p, prompt: statement, answerType: 'boolean', correct, trueStatement };
  }

  const GENERATORS = {
    image2nom: genImage2Nom,
    nom2image: genNom2Image,
    type: genType,
    numero: genNumero,
    evolution: genEvolution,
    generation: genGeneration,
    region: genRegion,
    flash: genFlash,
    qcm: genQCM,
    vraifaux: genVraiFaux,
  };

  function generateQuestion(mode, pokemon, pool) {
    const gen = GENERATORS[mode];
    if (!gen) throw new Error(`Mode de quiz inconnu: ${mode}`);
    return gen(pokemon, pool);
  }

  function checkAnswer(question, userAnswer) {
    switch (question.answerType) {
      case 'text':
        return PokedexData.normalize(userAnswer) === PokedexData.normalize(question.correct);
      case 'choice':
        if (question.multiCorrectOk && Array.isArray(question.correct)) {
          return question.correct.includes(userAnswer);
        }
        return userAnswer === question.correct;
      case 'multichoice': {
        const a = [...(userAnswer || [])].slice().sort();
        const b = [...question.correct].slice().sort();
        return a.length === b.length && a.every((v, i) => v === b[i]);
      }
      case 'boolean':
        return userAnswer === question.correct;
      case 'flashcard':
        return true;
      default:
        return false;
    }
  }

  return { MODE_LABELS, generateQuestion, checkAnswer };
})();
