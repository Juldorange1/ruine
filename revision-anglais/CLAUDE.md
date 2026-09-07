# Révision Anglais — Notes pour Claude

Application personnelle de révision d'anglais niveau Seconde (voir [../CLAUDE.md](../CLAUDE.md)
pour les règles générales du dépôt). Ce n'est **pas un jeu** — c'est un outil d'apprentissage,
mais il vit dans ce dépôt par commodité, indépendant des autres dossiers.

## Principe

On colle une leçon (texte brut, même mal organisée) dans "Nouvelle leçon" ; l'appli l'analyse
par heuristiques (pas d'IA/API externe) pour en extraire du vocabulaire, expressions, règles de
grammaire, exemples, faux amis, notes culturelles — puis génère des sessions de révision mélangeant
plusieurs types d'exercices, avec un système de répétition espacée "maison" (paliers courts au
début, dynamiques selon la difficulté du mot).

100 % local : aucune requête réseau, tout est stocké dans `localStorage` (voir `js/storage.js`).

## Architecture

- `js/storage.js` — persistance locale (un seul blob JSON), CRUD leçons/items/sessions.
- `js/srs.js` — répétition espacée par compétence (`en_fr`, `fr_en`, `listening`),
  niveaux de maîtrise 0-4, calcul de difficulté par mot. (Il y avait une 4e compétence
  "production", supprimée avec l'exercice du même nom — voir plus bas.)
- `js/visuals.js` — dictionnaire emoji pour la mémoire visuelle + astuces pour les faux amis
  fréquents + génération d'une astuce générique (découpage syllabique) pour les autres mots.
- `js/word-families.js` — table de référence des verbes irréguliers (~110), comparatifs
  irréguliers et pluriels irréguliers anglais (base/prétérit/participe, base/comparatif/
  superlatif, ou singulier/pluriel + sens FR). Permet à l'analyseur de reconnaître qu'une forme
  comme "went"/"gone" ou "axes" appartient au même mot que "go"/"axis", **même si ces formes
  sont écrites à des endroits différents de la leçon** (une simple phrase d'exemple ailleurs
  suffit), et de les regrouper en un seul item `forms:[...]` + `formLabels:[...]` au lieu de
  mots isolés sans lien. Voir `WordFamilies.detect()`. `buildFamilies()` accepte une arité
  variable (2 formes pour les pluriels, 3 pour verbes/comparatifs).
- `js/dictionary.js` — dictionnaire anglais→français de secours (~250 mots courants : salle de
  classe, vie quotidienne, adjectifs, verbes réguliers fréquents), 100% local. Sert à
  `Analyzer.extractOrphanVocabulary()` pour traduire les mots que la leçon mentionne sans
  donner leur traduction (ex: "highlighter" dans une phrase, sans "= surligneur" à côté).
- `js/analyzer.js` — analyseur heuristique du texte de leçon collé (regex + scores
  français/anglais) → liste d'items typés. Voir les commentaires de priorité dans
  `analyzeLesson()` si tu ajoutes une nouvelle règle de détection : les signaux forts
  (grammaire, culture, "Ex :", "faux ami", familles de mots) doivent être testés **avant** le
  découpage générique "mot = traduction", sinon ils se font happer par erreur. La détection de
  familles se fait en 2 temps : un pré-scan sur le texte entier (`WordFamilies.detect`, avant la
  boucle ligne par ligne) trouve les familles dont au moins une forme distincte (prétérit/
  participe/pluriel, jamais la base seule — trop ambiguë/fréquente) apparaît quelque part ; puis,
  pendant la boucle, toute ligne qui ne ferait que traduire/répéter une forme déjà détectée est
  absorbée dans la famille au lieu de créer un item redondant (cf. cas 4b/4c/5 avec
  `detectedFormsToFamily`). En fin d'analyse, `extractOrphanVocabulary()` récupère en plus le
  vocabulaire mentionné dans la leçon sans "= traduction" mais connu du dictionnaire de secours —
  uniquement dans les passages où l'anglais domine, et jamais un mot déjà utilisé comme
  traduction française ailleurs (pour ne pas confondre un mot français avec un mot anglais inconnu).
  Un texte anormalement long (paragraphe entier collé sans retour à la ligne, copié-collé abîmé)
  est découpé en phrases (`expandLongLines`/`splitIntoSentences`) ; une phrase sans traduction
  trouvée est abandonnée plutôt que de créer un item inexploitable ; `clampText()` plafonne à 180
  caractères en dernier recours.
- `js/exercises.js` — génération des exercices + correction tolérante (distance de
  Levenshtein, variantes séparées par `/`), gabarits de phrases pour la traduction quand la
  leçon ne fournit pas d'exemple. Modes actuels : flashcard, rappel actif, traduction, écoute,
  mémoire visuelle, association, et `verbforms` (formes d'une famille de mots). **Pas de mode
  "mot à trous" ni "production"** — supprimés à la demande de l'utilisateur (le premier cassait
  la règle "1-3 mots par question" sur les phrases, le second n'était pas fiable à corriger). Les
  items avec `forms` (familles) sont redirigés vers `genVerbForms`/`verbforms` plutôt que les
  exercices génériques mot-à-mot, sauf pour flashcard/matching/listening qui gèrent `forms`
  nativement. Une phrase d'exemple entière (`type: 'example_sentence'`) n'est jamais utilisée que
  par l'exercice de traduction, jamais comme flashcard/rappel/écoute/association.
- `js/stats.js` — agrégats (compétences, mots difficiles, progression).
- `js/ui.js` — tout le reste : navigation, moteur de session générique, mode "Apprendre une
  leçon" (groupes progressifs), "Test blanc", "Contrôle demain", "Révision intelligente".
- `js/app.js` — bootstrap.

## Points d'attention si tu modifies l'analyseur

- Ordre des règles dans `analyzeLesson()` : du signal le plus spécifique (faux ami explicite,
  "Ex :", mots-clés de grammaire/culture) au plus générique (découpage "mot = traduction" via
  `PAIR_SEPARATOR`, puis détection de phrase anglaise isolée en attente de sa traduction).
- `splitEnFr()` détermine quel côté d'une paire est le français via un score (stopwords +
  accents) ; ça peut se tromper sur des mots courts sans signal (ex: deux mots identiques comme
  "pollution = pollution"), c'est acceptable — l'utilisateur peut corriger après coup dans l'écran
  de revue ou dans le détail de la leçon (tout est éditable).
