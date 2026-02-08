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

  const DRAG_THRESHOLD_PX = 5;
  let dragLayer = null;
  let dragState = null;
  let pendingDrag = null;

  function getDragSource(cardEl) {
    const state = game.getState();
    const pos = findCardIndexInTableau(state, cardEl.dataset.id);
    if (pos) {
      return { type: 'tableau', col: pos.col, index: pos.index };
    }
    if (state.waste.length && state.waste[state.waste.length - 1].id === parseInt(cardEl.dataset.id, 10)) {
      return { type: 'waste' };
    }
    const fi = foundations.findIndex(f => f.querySelector('[data-id="' + cardEl.dataset.id + '"]') !== null);
    if (fi >= 0) return { type: 'foundation', index: fi };
    return null;
  }

  function getDraggedCardElements(source) {
    if (source.type === 'tableau') {
      const colEl = tableau[source.col];
      return Array.from(colEl.children).slice(source.index);
    }
    if (source.type === 'waste') return [wasteEl.lastElementChild].filter(Boolean);
    if (source.type === 'foundation') return [foundations[source.index].lastElementChild].filter(Boolean);
    return [];
  }

  function tryDrop(dragFrom, dragCardIds, dropEl) {
    const colEl = dropEl && dropEl.closest('.tableau-column');
    const foundEl = dropEl && dropEl.closest('.pile.foundation');
    if (!dragFrom) return false;
    let ok = false;
    if (colEl) {
      const col = tableau.indexOf(colEl);
      if (col < 0) return false;
      if (dragFrom.type === 'waste') ok = game.moveWasteToTableau(col);
      else if (dragFrom.type === 'tableau') ok = game.moveTableauToTableau(dragFrom.col, dragFrom.index, col);
      else if (dragFrom.type === 'foundation') ok = game.moveFoundationToTableau(dragFrom.index, col);
    } else if (foundEl && (dragFrom.type === 'waste' || (dragFrom.type === 'tableau' && dragCardIds.length === 1))) {
      const index = foundations.indexOf(foundEl);
      if (index < 0) return false;
      if (dragFrom.type === 'waste') ok = game.moveWasteToFoundationTo(index);
      else if (dragFrom.type === 'tableau') ok = game.moveTableauToFoundationTo(dragFrom.col, dragFrom.index, index);
    }
    return ok;
  }

  function onPointerMove(e) {
    if (pendingDrag && !dragState) {
      const dx = e.clientX - pendingDrag.startClientX;
      const dy = e.clientY - pendingDrag.startClientY;
      if (dx * dx + dy * dy >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
        e.preventDefault();
        commitDrag(pendingDrag, e);
        pendingDrag = null;
      } else return;
    }
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    e.preventDefault();
    dragState.lastClientX = e.clientX;
    dragState.lastClientY = e.clientY;
    dragState.wrapper.style.left = (e.clientX - dragState.offsetX) + 'px';
    dragState.wrapper.style.top = (e.clientY - dragState.offsetY) + 'px';
  }

  function onPointerUp(e) {
    if (pendingDrag) {
      pendingDrag.dragTarget.removeEventListener('pointermove', onPointerMove);
      pendingDrag.dragTarget.removeEventListener('pointerup', onPointerUp);
      try { pendingDrag.dragTarget.releasePointerCapture(e.pointerId); } catch (_) {}
      pendingDrag = null;
      return;
    }
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    const { wrapper, source, cardIds, startLeft, startTop, lastClientX, lastClientY } = dragState;
    document.body.style.cursor = '';
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);
    dragState = null;

    const dropX = (e.clientX != null && e.clientX !== 0) ? e.clientX : lastClientX;
    const dropY = (e.clientY != null && e.clientY !== 0) ? e.clientY : lastClientY;
    wrapper.style.visibility = 'hidden';
    const dropEl = document.elementFromPoint(dropX, dropY);
    wrapper.style.visibility = 'visible';

    const ok = tryDrop(source, cardIds, dropEl);
    if (ok) {
      wrapper.remove();
      refresh();
      return;
    }

    wrapper.style.transition = 'left 0.35s ease-out, top 0.35s ease-out';
    wrapper.style.left = startLeft + 'px';
    wrapper.style.top = startTop + 'px';
    wrapper.addEventListener('transitionend', function done() {
      wrapper.removeEventListener('transitionend', done);
      wrapper.remove();
      refresh();
    }, { once: true });
  }

  function commitDrag(p, e) {
    p.dragTarget.removeEventListener('pointermove', onPointerMove);
    p.dragTarget.removeEventListener('pointerup', onPointerUp);
    try { p.dragTarget.releasePointerCapture(e.pointerId); } catch (_) {}

    const { source, cards, cardIds, rect, stackOffset, stackHeight, offsetX, offsetY } = p;
    const n = cards.length;
    const wrapper = document.createElement('div');
    wrapper.className = 'drag-stack';
    wrapper.style.cssText = 'position:fixed;left:' + (e.clientX - offsetX) + 'px;top:' + (e.clientY - offsetY) + 'px;width:' + rect.width + 'px;height:' + stackHeight + 'px;z-index:2000;pointer-events:none;';
    cards.forEach((c, i) => {
      c.style.position = 'absolute';
      c.style.left = '0';
      c.style.top = (i * stackOffset) + 'px';
      c.style.marginBottom = '0';
      wrapper.appendChild(c);
    });
    dragLayer.appendChild(wrapper);
    document.body.style.cursor = 'grabbing';
    dragState = {
      wrapper,
      source,
      cardIds,
      startLeft: rect.left,
      startTop: rect.top,
      offsetX,
      offsetY,
      pointerId: e.pointerId,
      lastClientX: e.clientX,
      lastClientY: e.clientY
    };
    document.addEventListener('pointermove', onPointerMove, { passive: false });
    document.addEventListener('pointerup', onPointerUp, { once: true });
    document.addEventListener('pointercancel', onPointerUp, { once: true });
  }

  function startDrag(cardEl, e) {
    const source = getDragSource(cardEl);
    if (!source) return;
    const cards = getDraggedCardElements(source);
    if (cards.length === 0) return;
    const state = game.getState();
    const cardIds = source.type === 'tableau'
      ? state.tableau[source.col].slice(source.index).map(c => c.id)
      : [parseInt(cardEl.dataset.id, 10)];

    const rect = cards[0].getBoundingClientRect();
    const n = cards.length;
    const stackOffset = n > 1 ? cards[1].getBoundingClientRect().top - rect.top : 0;
    const cardHeight = rect.height;
    const stackHeight = cardHeight + (n - 1) * stackOffset;
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    pendingDrag = {
      source,
      cards,
      cardIds,
      rect,
      stackOffset,
      stackHeight,
      offsetX,
      offsetY,
      startClientX: e.clientX,
      startClientY: e.clientY,
      dragTarget: cards[0]
    };
    pendingDrag.dragTarget.setPointerCapture(e.pointerId);
    pendingDrag.dragTarget.addEventListener('pointermove', onPointerMove);
    pendingDrag.dragTarget.addEventListener('pointerup', onPointerUp);
  }

  function bindDragDrop() {
    if (!dragLayer) {
      dragLayer = document.createElement('div');
      dragLayer.className = 'drag-layer';
      document.body.appendChild(dragLayer);
    }
    dragLayer.innerHTML = '';

    const cards = document.querySelectorAll('.card.face-up');
    cards.forEach(cardEl => {
      cardEl.draggable = false;
      cardEl.onpointerdown = function (e) {
        if (e.button !== 0) return;
        e.preventDefault();
        startDrag(cardEl, e);
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
