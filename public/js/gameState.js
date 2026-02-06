import {
  createDeck,
  shuffle,
  canStackOnTableau,
  canStackOnFoundation,
  getTableauBuild,
  cloneState
} from './cards.js';

export function Game() {
  let state = {
    stock: [],
    waste: [],
    foundation: [[], [], [], []],
    tableau: [[], [], [], [], [], [], []]
  };
  let undoStack = [];
  const maxUndo = 200;

  function init() {
    let deck = createDeck();
    deck = shuffle(deck);
    state.stock = deck;
    state.waste = [];
    state.foundation = [[], [], [], []];
    state.tableau = [[], [], [], [], [], [], []];
    let idx = 0;
    for (let col = 0; col < 7; col++) {
      for (let n = 0; n <= col; n++) {
        const card = deck[idx++];
        card.faceUp = n === col;
        state.tableau[col].push(card);
      }
    }
    state.stock = deck.slice(idx);
    undoStack = [];
  }

  function pushUndo() {
    undoStack.push(cloneState(state));
    if (undoStack.length > maxUndo) undoStack.shift();
  }

  function drawOne() {
    if (state.stock.length === 0) {
      if (state.waste.length === 0) return false;
      pushUndo();
      state.stock = state.waste.slice().reverse();
      state.waste = [];
      return true;
    }
    pushUndo();
    const card = state.stock.pop();
    card.faceUp = true;
    state.waste.push(card);
    return true;
  }

  function undo() {
    if (undoStack.length === 0) return false;
    state = undoStack.pop();
    return true;
  }

  function moveWasteToFoundation() {
    if (state.waste.length === 0) return false;
    const card = state.waste[state.waste.length - 1];
    for (let i = 0; i < 4; i++) {
      if (canStackOnFoundation(card, state.foundation[i])) {
        pushUndo();
        state.waste.pop();
        state.foundation[i].push(card);
        return true;
      }
    }
    return false;
  }

  function moveWasteToTableau(col) {
    if (state.waste.length === 0 || col < 0 || col > 6) return false;
    const card = state.waste[state.waste.length - 1];
    const top = state.tableau[col].length ? state.tableau[col][state.tableau[col].length - 1] : null;
    if (!canStackOnTableau(card, top)) return false;
    pushUndo();
    state.waste.pop();
    state.tableau[col].push(card);
    return true;
  }

  function moveTableauToFoundation(col, cardIndex) {
    if (col < 0 || col > 6) return false;
    const t = state.tableau[col];
    if (cardIndex < 0 || cardIndex >= t.length || !t[cardIndex].faceUp) return false;
    const card = t[cardIndex];
    if (cardIndex !== t.length - 1) return false;
    for (let i = 0; i < 4; i++) {
      if (canStackOnFoundation(card, state.foundation[i])) {
        pushUndo();
        const moved = t.splice(cardIndex, 1)[0];
        state.foundation[i].push(moved);
        if (t.length > 0 && !t[t.length - 1].faceUp) t[t.length - 1].faceUp = true;
        return true;
      }
    }
    return false;
  }

  function moveWasteToFoundationTo(i) {
    if (state.waste.length === 0 || i < 0 || i > 3) return false;
    const card = state.waste[state.waste.length - 1];
    if (!canStackOnFoundation(card, state.foundation[i])) return false;
    pushUndo();
    state.waste.pop();
    state.foundation[i].push(card);
    return true;
  }

  function moveTableauToFoundationTo(col, cardIndex, foundationIndex) {
    if (col < 0 || col > 6 || foundationIndex < 0 || foundationIndex > 3) return false;
    const t = state.tableau[col];
    if (cardIndex < 0 || cardIndex >= t.length || !t[cardIndex].faceUp) return false;
    const card = t[cardIndex];
    if (cardIndex !== t.length - 1) return false;
    if (!canStackOnFoundation(card, state.foundation[foundationIndex])) return false;
    pushUndo();
    const moved = t.splice(cardIndex, 1)[0];
    state.foundation[foundationIndex].push(moved);
    if (t.length > 0 && !t[t.length - 1].faceUp) t[t.length - 1].faceUp = true;
    return true;
  }

  function moveTableauToTableau(fromCol, fromIndex, toCol) {
    if (fromCol < 0 || fromCol > 6 || toCol < 0 || toCol > 6 || fromCol === toCol) return false;
    const src = state.tableau[fromCol];
    const dest = state.tableau[toCol];
    if (fromIndex < 0 || fromIndex >= src.length) return false;
    const build = getTableauBuild(src, fromIndex);
    if (!build || build.length === 0) return false;
    const destTop = dest.length ? dest[dest.length - 1] : null;
    if (!canStackOnTableau(build[0], destTop)) return false;
    pushUndo();
    const moved = src.splice(fromIndex, build.length);
    dest.push(...moved);
    if (src.length > 0 && !src[src.length - 1].faceUp) src[src.length - 1].faceUp = true;
    return true;
  }

  function moveFoundationToTableau(foundationIndex, toCol) {
    const f = state.foundation[foundationIndex];
    if (!f.length || toCol < 0 || toCol > 6) return false;
    const card = f[f.length - 1];
    const top = state.tableau[toCol].length ? state.tableau[toCol][state.tableau[toCol].length - 1] : null;
    if (!canStackOnTableau(card, top)) return false;
    pushUndo();
    state.tableau[toCol].push(f.pop());
    return true;
  }

  function canUndo() {
    return undoStack.length > 0;
  }

  function isWin() {
    return state.foundation.every(col => col.length === 13);
  }

  function getState() {
    return state;
  }

  return {
    init,
    drawOne,
    undo,
    moveWasteToFoundation,
    moveWasteToFoundationTo,
    moveWasteToTableau,
    moveTableauToFoundation,
    moveTableauToFoundationTo,
    moveTableauToTableau,
    moveFoundationToTableau,
    canUndo,
    isWin,
    getState
  };
}
