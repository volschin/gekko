import Vue from 'vue'
import _ from 'lodash';
const reduceState = require('../../../../../state/reduceState');

export const syncBundles = (state, data) => {
  if(!data) {
    return state;
  }

  state.bundles = data.live;
  state.archivedBundles = data.archive;
  return state;
}

export const addBundle = (state, bundle) => {
  state.bundles = {
    ...state.bundles,
    [bundle.id]: bundle
  }
  return state;
}

export const updateBundle = (state, update) => {
  if(!update.id || !_.has(state.bundles, update.id)) {
    return console.error('cannot update unknown bundle..');;
  }

  state.bundles = {
    ...state.bundles,
    [update.id]: reduceState(state.bundles[update.id], update.event)
  }
  return state;
}

export const archiveBundle = (state, id) => {
  if(!_.has(state.bundles, id)) {
    return console.error('cannot archive unknown bundle..');
  }

  state.archivedBundle = {
    ...state.archivedBundle,
    [id]: {
      ...state.bundles[id],
      stopped: true,
      active: false
    }
  }

  state.bundles = _.omit(state.bundles, id);
  return state;
}

export const errorBundle = (state, data) => {
  if(!_.has(state.bundles, data.id)) {
    return console.error('cannot error unknown bundle..');
  }

  state.bundles = {
    ...state.bundles,
    [data.id]: {
      ...state.bundles[data.id],
      errored: true,
      errorMessage: data.error
    }
  }

  return state;
}

export const deleteBundle = (state, id) => {
  if(!_.has(state.archivedBundles, id)) {
    return console.error('cannot delete unknown bundle..');
  }

  state.archivedBundles = _.omit(state.archivedBundles, id);
  return state;
}
