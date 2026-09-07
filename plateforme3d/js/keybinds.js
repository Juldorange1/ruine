// ============================================================================
// ASCENSION — keybinds.js
// Raccourcis clavier reconfigurables : liste des actions, formatage lisible
// d'un code clavier, et l'UI de réassignation (écran Contrôles).
// ============================================================================
window.AS = window.AS || {};

AS.Keybinds = (function () {
  const ACTIONS = [
    { id: 'forward', label: 'Avancer' },
    { id: 'back', label: 'Reculer' },
    { id: 'left', label: 'Aller à gauche' },
    { id: 'right', label: 'Aller à droite' },
    { id: 'jump', label: 'Sauter / double saut / wall-jump' },
    { id: 'dash', label: 'Dash' },
    { id: 'pause', label: 'Pause' },
  ];

  const LABELS = {
    Space: 'Espace', Escape: 'Échap', ShiftLeft: 'Maj (G)', ShiftRight: 'Maj (D)',
    ControlLeft: 'Ctrl (G)', ControlRight: 'Ctrl (D)', AltLeft: 'Alt (G)', AltRight: 'Alt (D)',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    Tab: 'Tab', Enter: 'Entrée', Backquote: '²',
  };

  function labelForCode(code) {
    if (!code) return '—';
    if (LABELS[code]) return LABELS[code];
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    return code;
  }

  // Construit la liste de réassignation dans `container`. `onChange(action,code)`
  // est appelé après chaque modification (utile pour rafraîchir l'input en jeu).
  function buildUI(container, onChange) {
    if (container.__cleanup) container.__cleanup();
    container.innerHTML = '';
    const binds = AS.Storage.getKeybinds();
    let listeningRow = null;

    ACTIONS.forEach((action) => {
      const row = document.createElement('div');
      row.className = 'keybind-row';

      const label = document.createElement('span');
      label.className = 'keybind-label';
      label.textContent = action.label;

      const btn = document.createElement('button');
      btn.className = 'keybind-btn';
      btn.type = 'button';
      btn.textContent = labelForCode(binds[action.id]);

      btn.addEventListener('click', () => {
        if (listeningRow && listeningRow !== btn) listeningRow.classList.remove('listening');
        listeningRow = btn;
        btn.classList.add('listening');
        btn.textContent = '...';
      });

      row.appendChild(label);
      row.appendChild(btn);
      container.appendChild(row);

      row.__btn = btn;
      row.__action = action.id;
    });

    function captureKey(e) {
      if (!listeningRow) return;
      e.preventDefault();
      if (e.code === 'Escape' && listeningRow.textContent === '...') {
        // Échap pendant l'écoute : annule (garde l'ancienne touche)
        const binds2 = AS.Storage.getKeybinds();
        const actionId = [...container.children].find((r) => r.__btn === listeningRow).__action;
        listeningRow.textContent = labelForCode(binds2[actionId]);
        listeningRow.classList.remove('listening');
        listeningRow = null;
        return;
      }
      const rowEl = [...container.children].find((r) => r.__btn === listeningRow);
      const actionId = rowEl.__action;
      AS.Storage.setKeybind(actionId, e.code);
      listeningRow.textContent = labelForCode(e.code);
      listeningRow.classList.remove('listening');
      listeningRow = null;
      if (onChange) onChange(actionId, e.code);
    }

    window.addEventListener('keydown', captureKey, true);
    container.__cleanup = () => window.removeEventListener('keydown', captureKey, true);

    return {
      resetAll: () => {
        AS.Storage.resetKeybinds();
        buildUI(container, onChange);
      },
    };
  }

  return { ACTIONS, labelForCode, buildUI };
})();
