<template lang='pug'>
  div
    #top
    header.bg--off-white.grd
      .contain.grd-row
        h3.py1.px2.col-2 $LON
    nav.bg--light-gray
      .menu.contain
        router-link(to='/home').py1 Home
        router-link(v-if='isAuthenticated' to='/live-gekkos').py1 Live Gekkos
        router-link(v-if='isAuthenticated' to='/bundles').py1 Bundles
        router-link(v-if='isAuthenticated' to='/backtest').py1 Backtest
        router-link(v-if='isAuthorized("admin")' to='/data').py1 Local data
        router-link(v-if='isAuthenticated' to='/config').py1 Config
        router-link(v-if='userManagerEnabled && !isAuthenticated' to='/login').py1 Login
        a(v-if='userManagerEnabled && isAuthenticated' v-on:click='logout').py1 Logout
        a(v-if='isAuthorized("admin")' href='https://gekko.wizb.it/docs/introduction/about_gekko.html', target='_blank').py1 Documentation

</template>

<script>
import globalConfig from '../../../config';
export default {
  computed: {
    userManagerEnabled() {
      return window.CONFIG.userManagerEnabled;
    },
    isAuthenticated () {
      return this.$store.state.auth.isAuthenticated
    },

    siteName () {
      return globalConfig['site-name']
    }
  },
  methods: {
    logout: function() {
      this.$store.dispatch('logout').then(response => {
        this.$router.push('/');
      }, error => {
        console.error('$store.dispatch -> logout: ' + error);
      })
    },
    isAuthorized: function(role) {
      role = role || 'user';
      const dbId = this.$store.state.auth.user('id');
      const isAdmin = this.$store.state.auth.isAdmin();
      const isGuest = this.$store.state.auth.isGuest();
      if(isGuest) {
        return false;
      }
      if(role === 'admin') {
        return !!isAdmin;
      }
      return true;
    },
  }
}
</script>

<style>
.menu {
  display: flex;
  flex-direction: row;
  margin-top: 0;
  margin-bottom: 2rem;
}

.menu a {
  flex: 1 1 100%;
  display: block;
  text-align: center;
  text-decoration: none;
  color: inherit;
}

.menu .router-link-active {
  background-color: rgba(250,250,250,.99);
}

.menu a:hover {
  text-decoration: underline;
}

</style>
