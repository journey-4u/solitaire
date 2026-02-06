import { Game } from './gameState.js';
import { renderCard } from './cards.js';

function render(game, containerMap) {
  const s = game.getState();
  containerMap.stock.innerHTML = '';
  containerMap.waste.innerHTML = '';
  s.waste.forEach((c, i) => {
    const el = renderCard(c);
    el.style.zIndex = i + 1;
    containerMap.waste.appendChild(el);
  });
  if (s.stock.length > 0) {
    containerMap.stock.classList.remove('stock-empty');
    const back = document.createElement('div');
    back.className = 'card face-down';
    back.style.position = 'absolute';
    back.style.left = '2px';
    back.style.top = '2px';
    containerMap.stock.appendChild(back);
  } else {
    containerMap.stock.classList.add('stock-empty');
  }
  containerMap.foundations.forEach((cont, i) => {
    cont.innerHTML = '';
    s.foundation[i].forEach(c => {
      cont.appendChild(renderCard(c));
    });
  });
  containerMap.tableau.forEach((cont, i) => {
    cont.innerHTML = '';
    s.tableau[i].forEach((c, j) => {
      const el = renderCard(c);
      if (containerMap.animateDeal) {
        el.style.animationDelay = (i * 0.05 + j * 0.02) + 's';
        el.classList.add('animate-deal');
      }
      cont.appendChild(el);
    });
  });
  containerMap.animateDeal = false;
}

function findCardIndexInTableau(state, cardId) {
  for (let col = 0; col < 7; col++) {
    const idx = state.tableau[col].findIndex(c => c.id === parseInt(cardId, 10));
    if (idx >= 0) return { col, index: idx };
  }
  return null;
}

function setupGame() {
  const game = Game();
  const stockEl = document.getElementById('stock');
  const wasteEl = document.getElementById('waste');
  const foundations = [document.getElementById('f0'), document.getElementById('f1'), document.getElementById('f2'), document.getElementById('f3')];
  const tableau = [
    document.getElementById('col0'), document.getElementById('col1'), document.getElementById('col2'),
    document.getElementById('col3'), document.getElementById('col4'), document.getElementById('col5'), document.getElementById('col6')
  ];
  const containerMap = { stock: stockEl, waste: wasteEl, foundations, tableau };
  const undoBtn = document.getElementById('undoBtn');
  const newGameBtn = document.getElementById('newGameBtn');
  const winOverlay = document.getElementById('winOverlay');
  const winNewGameBtn = document.getElementById('winNewGameBtn');

  function refresh(isNewGame) {
    if (isNewGame) containerMap.animateDeal = true;
    render(game, containerMap);
    undoBtn.disabled = !game.canUndo();
    if (game.isWin()) winOverlay.classList.remove('hidden');
    bindDragDrop();
    bindClicks();
  }

  function bindClicks() {
    stockEl.onclick = function () {
      if (game.drawOne()) refresh();
    };
    newGameBtn.onclick = function () {
      game.init();
      winOverlay.classList.add('hidden');
      refresh(true);
    };
    winNewGameBtn.onclick = function () {
      winOverlay.classList.add('hidden');
      game.init();
      refresh(true);
    };
    undoBtn.onclick = function () {
      if (game.undo()) refresh();
    };

    wasteEl.querySelectorAll('.card').forEach(el => {
      el.onclick = function (e) {
        e.stopPropagation();
        if (game.moveWasteToFoundation()) { refresh(); return; }
        for (let c = 0; c < 7; c++) {
          if (game.moveWasteToTableau(c)) { refresh(); return; }
        }
      };
    });

    foundations.forEach((cont) => {
      cont.onclick = function () { };
    });

    tableau.forEach((colEl) => {
      colEl.onclick = function (e) {
        const cardEl = e.target.closest('.card');
        if (!cardEl || !cardEl.dataset.id) return;
        const state = game.getState();
        const pos = findCardIndexInTableau(state, cardEl.dataset.id);
        if (!pos) return;
        if (game.moveTableauToFoundation(pos.col, pos.index)) refresh();
      };
    });
  }

  let dragFrom = null;
  let dragCardIds = [];

  function bindDragDrop() {
    const cards = document.querySelectorAll('.card.face-up');
    cards.forEach(cardEl => {
      cardEl.draggable = true;
      cardEl.ondragstart = function (e) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', cardEl.dataset.id);
        e.dataTransfer.setData('application/json', JSON.stringify({ id: cardEl.dataset.id }));
        cardEl.classList.add('dragging');
        const state = game.getState();
        const pos = findCardIndexInTableau(state, cardEl.dataset.id);
        if (pos) {
          dragFrom = { type: 'tableau', col: pos.col, index: pos.index };
          const col = state.tableau[pos.col];
          dragCardIds = col.slice(pos.index).map(c => c.id);
        } else if (state.waste.length && state.waste[state.waste.length - 1].id === parseInt(cardEl.dataset.id, 10)) {
          dragFrom = { type: 'waste' };
          dragCardIds = [parseInt(cardEl.dataset.id, 10)];
        } else {
          const fi = foundations.findIndex(f => f.querySelector('[data-id="' + cardEl.dataset.id + '"]') !== null);
          if (fi >= 0) {
            dragFrom = { type: 'foundation', index: fi };
            dragCardIds = [parseInt(cardEl.dataset.id, 10)];
          }
        }
      };
      cardEl.ondragend = function () {
        cardEl.classList.remove('dragging');
        document.querySelectorAll('.drag-over').forEach(n => n.classList.remove('drag-over'));
        dragFrom = null;
        dragCardIds = [];
      };
    });

    const dropTargets = [
      ...tableau.map((el, i) => ({ el, type: 'tableau', col: i })),
      ...foundations.map((el, i) => ({ el, type: 'foundation', index: i }))
    ];

    dropTargets.forEach(({ el, type, col, index }) => {
      el.ondragover = function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        el.classList.add('drag-over');
      };
      el.ondragleave = function () {
        el.classList.remove('drag-over');
      };
      el.ondrop = function (e) {
        e.preventDefault();
        el.classList.remove('drag-over');
        if (!dragFrom) return;
        let ok = false;
        if (type === 'tableau') {
          if (dragFrom.type === 'waste') ok = game.moveWasteToTableau(col);
          else if (dragFrom.type === 'tableau') ok = game.moveTableauToTableau(dragFrom.col, dragFrom.index, col);
          else if (dragFrom.type === 'foundation') ok = game.moveFoundationToTableau(dragFrom.index, col);
        } else if (type === 'foundation' && index !== undefined && (dragFrom.type === 'waste' || (dragFrom.type === 'tableau' && dragCardIds.length === 1))) {
          if (dragFrom.type === 'waste') ok = game.moveWasteToFoundationTo(index);
          else if (dragFrom.type === 'tableau') ok = game.moveTableauToFoundationTo(dragFrom.col, dragFrom.index, index);
        }
        if (ok) refresh();
      };
    });
  }

  game.init();
  refresh(true);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupGame);
} else {
  setupGame();
}
