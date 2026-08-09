// Bascule entre les deux vues (Éditeur / Jeu) sur une seule et même page.
// C'est ce fichier qui remplace l'ancienne navigation index.html -> play.html
// (qui écrivait le niveau dans localStorage puis changeait de document — un
// passage qui pouvait silencieusement échouer en `file://`, voir
// DESIGN_NOTES.md). Ici "Jouer" est un simple appel de fonction en mémoire.

function showEditorView() {
  document.getElementById("editorView").hidden = false;
  document.getElementById("playerView").hidden = true;
  document.getElementById("editorActions").hidden = false;
  document.getElementById("playerActions").hidden = true;
  document.getElementById("appTitle").textContent = "Créer un niveau";
  setMsg(" ");
}

// Appelée par editor.js (bouton "Jouer ce niveau" et bouton "▶️ Jouer" de
// chaque niveau enregistré) avec le niveau déjà sérialisé + validé.
function showPlayer(levelObj, name) {
  const lvl = { ...levelObj, name: name || levelObj.name || "Niveau sans nom" };
  document.getElementById("editorView").hidden = true;
  document.getElementById("playerView").hidden = false;
  document.getElementById("editorActions").hidden = true;
  document.getElementById("playerActions").hidden = false;
  document.getElementById("appTitle").textContent = lvl.name;
  startPlaying(lvl);
}

document.getElementById("backToEditorBtn").addEventListener("click", showEditorView);
