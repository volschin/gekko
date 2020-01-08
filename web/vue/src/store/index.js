import Vue from 'vue'
import Vuex from 'vuex'
import _ from 'lodash'
import auth from './auth.js'

import * as importMutations from './modules/imports/mutations'
import * as gekkoMutations from './modules/gekkos/mutations'
import * as bundleMutations from './modules/bundles/mutations'
import * as notificationMutations from './modules/notifications/mutations'
import * as configMutations from './modules/config/mutations'

import * as configActions from './modules/config/actions';

Vue.use(Vuex);

const debug = process.env.NODE_ENV !== 'production'

let mutations = {};

_.merge(mutations, importMutations);
_.merge(mutations, gekkoMutations);
_.merge(mutations, bundleMutations);
_.merge(mutations, notificationMutations);
_.merge(mutations, configMutations);

let actions = {}
_.merge(actions, configActions);

export default new Vuex.Store({
  state: {
    isAuthenticated: window.CONFIG.userManagerEnabled? false: true,
    warnings: {
      connected: true, // assume we will connect
    },
    imports: [],
    gekkos: {},
    archivedGekkos: {},
    bundles: {},
    archivedBundles: {},
    connection: {
      disconnected: false,
      reconnected: false
    },
    apiKeys: [],
    exchanges: {},
    configs: [],
    configCurrent: null
  },
  actions,
  mutations,
  strict: debug,
  modules: {
    auth
  }
})
