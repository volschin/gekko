import Vue from 'vue'

export const syncApiKeys = (state, apiKeys) => {
  Vue.set(state, 'apiKeys', apiKeys);
  return state;
}

export const syncExchanges = (state, exchanges) => {
  Vue.set(state, 'exchanges', exchanges);
  return state;
}

export const syncConfigs = (state, configs) => {
  Vue.set(state, 'configs', configs);
  return state;
}

export const syncConfigCurrent = (state, config) => {
  Vue.set(state, 'configCurrent', config);
  return state;
}
