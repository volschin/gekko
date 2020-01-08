import Vue from 'vue'
import App from './App.vue'

import VueRouter from 'vue-router'
import VueSweetalert2 from 'vue-sweetalert2';
// If you don't need the styles, do not connect
import 'sweetalert2/dist/sweetalert2.min.css';

Vue.use(VueRouter);

const SweetAlertGlobalOptions = {
  confirmButtonColor: '#3498db',
  cancelButtonColor: '#e74c3c',
  // no animation by default
  animation: false
};
Vue.use(VueSweetalert2, SweetAlertGlobalOptions);
global.vue = Vue;

import store from './store'

import backtester from './components/backtester/backtester.vue'
import home from './components/layout/home.vue'

import data from './components/data/data.vue'
import importer from './components/data/import/importer.vue'
import singleImport from './components/data/import/single.vue'
import config from './components/config/config.vue'

import gekkoList from './components/gekko/list.vue'
import newGekko from './components/gekko/new.vue'
import editGekko from './components/gekko/editGekko.vue'
import singleGekko from './components/gekko/singleGekko.vue'
import { connect as connectWS } from './components/global/ws'

import newBundle from './components/bundle/new.vue'
import bundlesList from './components/bundle/list.vue'
import singleBundle from './components/bundle/singleBundle.vue'

import login from './components/auth/login.vue'
import register from './components/auth/register.vue'

const router = new VueRouter({
  mode: 'hash',
  base: __dirname,
  routes: [
    { path: '/', redirect: '/home' },
    { path: '/home', component: home },
    { path: '/backtest', component: backtester },
    { path: '/config', component: config },
    { path: '/data', component: data },
    { path: '/data/importer', component: importer },
    { path: '/data/importer/import/:id', component: singleImport },
    { path: '/live-gekkos', component: gekkoList },
    { path: '/live-gekkos/new', component: newGekko },
    { path: '/live-gekkos/gekko-edit', component: editGekko },
    { path: '/bundles/new', component: newBundle },
    { path: '/bundles', component: bundlesList },
    { path: '/bundles/:id', component: singleBundle },
    { path: '/live-gekkos/:id', component: singleGekko },
    { path: '/login', component: login, name: 'login' },
    { path: '/register', component: register, name: 'register' },


  ]
});

// setup some stuff
connectWS();

new Vue({
  router,
  store,
  el: '#app',
  render: h => h(App),
  /*computed: {
    isAuthenticated: function () {
      return this.$store.getters.isAuthenticated()
    }
  },
  methods: {
    login: function () {
      console.log('!!! methods >> login !!!');
      this.$store.dispatch('login', { user, requestOptions })

      /!*this.$auth.login({ email, password }).then(function () {
        // Execute application logic after successful login
      })*!/
    },

    register: function () {
      this.$auth.register({ name, email, password }).then(function () {
        // Execute application logic after successful registration
      })
    }
  }*/
})
