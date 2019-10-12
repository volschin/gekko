import Vue from 'vue'
import Vuex from 'vuex'
import _ from 'lodash'
import auth from './auth.js'

import * as importMutations from './modules/imports/mutations'
import * as gekkoMutations from './modules/gekkos/mutations'
import * as notificationMutations from './modules/notifications/mutations'
import * as configMutations from './modules/config/mutations'

Vue.use(Vuex);

const debug = process.env.NODE_ENV !== 'production'

let mutations = {};

_.merge(mutations, importMutations);
_.merge(mutations, gekkoMutations);
_.merge(mutations, notificationMutations);
_.merge(mutations, configMutations);

export default new Vuex.Store({
  state: {
    isAuthenticated: false,
    warnings: {
      connected: true, // assume we will connect
    },
    imports: [],
    gekkos: {},
    archivedGekkos: {},
    connection: {
      disconnected: false,
      reconnected: false
    },
    apiKeys: [],
    exchanges: {}
  },
  mutations,
  strict: debug,
  modules: {
    auth
  }
})
