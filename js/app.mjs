// js/app.mjs
'use strict';

import {
  renderPairingsFromModel,
  getPairingsModelFromDOM,
  getPlayersFromTextarea,
  makeFoursomes
} from './pairings.js';

const STORAGE_KEY = 'golfTripPlanner_pairings_v2';

function debounce(fn, wait = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function loadModel() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { players: [], rounds: [] };
  } catch {
    return { players: [], rounds: [] };
  }
}

function saveModel(model) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
}

function reflowUnlockedRounds() {
  const model = getPairingsModelFromDOM();
  const players = getPlayersFromTextarea();
  model.players = players;

  model.rounds = model.rounds.map(r =>
    r.lockGroups ? r : { ...r, groups: makeFoursomes(players) }
  );

  renderPairingsFromModel(model);
  saveModel(model);
}

document.addEventListener('DOMContentLoaded', () => {
  const model = loadModel();
  renderPairingsFromModel(model);

  lastPlayersKey = (Array.isArray(model?.players) ? model.players : []).join('|');

  const playersInput = document.getElementById('playersInput');
  if (!playersInput) return;

// Debounced input handler (auto-reflow + re-render only when players list changes)
let lastPlayersKey = null;

const onPlayersInput = debounce(() => {
  const playersNow = getPlayersFromTextarea();
  const key = playersNow.join('|');

  // If user only pressed Enter / added whitespace, the parsed list didn't change → don't re-render
  if (key === lastPlayersKey) return;

  lastPlayersKey = key;
  reflowUnlockedRoundsAndRender();
}, 250);

playersInput.addEventListener('input', onPlayersInput);


  // Prevent form submission on Enter
  playersInput.closest('form')?.addEventListener('submit', e => e.preventDefault());
});
