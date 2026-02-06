import { SUITS, RANKS, RED_SUITS } from './constants.js';

export function createDeck() {
  const deck = [];
  let id = 0;
  for (let s = 0; s < 4; s++) {
    for (let r = 1; r <= 13; r++) {
      deck.push({
        id: id++,
        suit: s,
        rank: r,
        faceUp: false
      });
    }
  }
  return deck;
}

export function shuffle(deck) {
  const out = deck.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function isRed(card) {
  return RED_SUITS.includes(card.suit);
}

export function canStackOnTableau(card, onTopOf) {
  if (!onTopOf) return card.rank === 13;
  return card.rank === onTopOf.rank - 1 && isRed(card) !== isRed(onTopOf);
}

export function canStackOnFoundation(card, foundationPile) {
  if (foundationPile.length === 0) return card.rank === 1;
  const top = foundationPile[foundationPile.length - 1];
  return card.suit === top.suit && card.rank === top.rank + 1;
}

export function getTableauBuild(tableauCol, fromIndex) {
  const cards = tableauCol.slice(fromIndex);
  for (let i = 1; i < cards.length; i++) {
    if (!canStackOnTableau(cards[i], cards[i - 1])) return null;
  }
  return cards;
}

export function cloneState(state) {
  return {
    stock: state.stock.map(c => ({ ...c })),
    waste: state.waste.map(c => ({ ...c })),
    foundation: state.foundation.map(col => col.map(c => ({ ...c }))),
    tableau: state.tableau.map(col => col.map(c => ({ ...c })))
  };
}

const RANK_CHAR = ['a', '2', '3', '4', '5', '6', '7', '8', '9', 't', 'j', 'q', 'k'];
const SUIT_CHAR = ['s', 'h', 'd', 'c'];

function getCardFaceClass(card) {
  return 'card' + RANK_CHAR[card.rank - 1] + SUIT_CHAR[card.suit];
}

export function renderCard(card) {
  const el = document.createElement('div');
  let className = 'card ' + (card.faceUp ? 'face-up' : 'face-down');
  if (card.faceUp) className += ' ' + getCardFaceClass(card);
  el.className = className;
  el.dataset.id = card.id;
  el.dataset.rank = card.rank;
  el.dataset.suit = card.suit;
  if (card.faceUp) {
    el.innerHTML = '<span class="card-rank" aria-hidden="true">' + RANKS[card.rank - 1] + '</span><span class="card-suit" aria-hidden="true">' + SUITS[card.suit] + '</span>';
  }
  return el;
}
