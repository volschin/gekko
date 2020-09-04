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
import batchBacktester from './components/backtester/batchBacktester.vue'
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
import fourOThree from './components/auth/403.vue'

const router = new VueRouter({
  mode: 'hash',
  base: __dirname,
  routes: [
    { path: '/', redirect: '/home' },
    { path: '/home', component: home },
    { path: '/backtest', component: backtester, meta: { roles: '!guest' }  },
    { path: '/backtest/batch', component: batchBacktester, meta: { roles: '!guest,!user' }  },
    { path: '/config', component: config, meta: { roles: '!guest' } },
    { path: '/data', component: data, meta: { roles: '!guest,!user' } },
    { path: '/data/importer', component: importer, meta: { roles: '!guest' } },
    { path: '/data/importer/import/:id', component: singleImport, meta: { roles: '!guest' } },
    { path: '/live-gekkos', component: gekkoList, meta: { roles: '!guest' } },
    { path: '/live-gekkos/new', component: newGekko, meta: { roles: '!guest' } },
    { path: '/live-gekkos/gekko-edit', component: editGekko, meta: { roles: '!guest' } },
    { path: '/bundles/new', component: newBundle, meta: { roles: '!guest,!user' } },
    { path: '/bundles', component: bundlesList, meta: { roles: '!guest' } },
    { path: '/bundles/:id', component: singleBundle, meta: { roles: '!guest' } },
    { path: '/live-gekkos/:id', component: singleGekko, meta: { roles: '!guest' } },
    { path: '/login', component: login, name: 'login' },
    { path: '/register', component: register, name: 'register' },
    { path: '/403', component: fourOThree, name: 'fourOThree', meta: { roles: '!stranger' } },
  ]
});

router.beforeEach((to, from, next) => {
  const notAuthorizedPage = '/403';
  const notAuthenticatedPage = '/login'
  if(!to.meta.roles) {
    return next(); // no restrictions
  } else {
    const isAuthenticated = router.app.$store.state.auth.isAuthenticated;
    const user = router.app.$store.state.auth.user();

    if(!isAuthenticated || !user) {
      next(notAuthenticatedPage);
    } else {
      const roles = to.meta.roles.split(',');
      if(roles.length === 0) {
        return next();
      } else {
        const userRole = user && user.role;
        const negativeRoles = roles.filter(r=>r.indexOf('!') === 0).map(r=>r.slice(1, r.length));
        if(negativeRoles.indexOf(userRole) !== -1) {
          return next(notAuthorizedPage);
        } else {
          const positiveRoles = roles.filter(r=>r.indexOf('!') === -1);
          if(positiveRoles.indexOf(userRole) !== -1) {
            return next(notAuthorizedPage)
          } else {
            return next();
          }
        }
      }
    }
  }

})

// setup some stuff
connectWS();

const vm1 = new Vue({
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
});


