<template lang='pug'>
  .contain.py2
    router-link.btn--primary(to='/bundles/new' v-if='isAdmin') Start New Bundle
    .hr
    h3 All bundles
    .text(v-if='!stratrunners.length')
      p You don't have any stratrunners.
    table.full(v-if='stratrunners.length')
      thead
        tr
          th name
          th strategy
          th candle
          th history
          th exchange
          th currency
          th assets
          th status
          th(v-if='isAdmin') notifications
          th(v-if='isAdmin') user
      tbody
        tr.clickable(v-for='bundle in stratrunners', v-on:click='$router.push({path: `/bundles/${ bundle.id }`})' :class='getClass(bundle)')
          td {{ bundle.config.options.name }}
          td {{ bundle.config.tradingAdvisor.method }}
          td {{ bundle.config.tradingAdvisor.candleSize }}
          td {{ bundle.config.tradingAdvisor.historySize }}
          td {{ bundle.config.watch.exchange }}
          td {{ bundle.config.watch.currency }}
          td {{ bundle.config.watch.assets }}
          td {{ status(bundle) }}
          td(v-if='isAdmin') {{ bundle.config.options.sendNotifications }}
          td(v-if='isAdmin')
            a(:href='"/users/" + bundle.ownerId') {{ bundle.ownerId  }}
</template>

<script>
// global moment
// global humanizeDuration
export default {
  created: function() {
    this.timer = setInterval(() => {
      this.now = moment();
    }, 1000)
  },
  destroyed: function() {
    clearTimeout(this.timer);
  },
  data: () => {
    return {
      timer: false,
      now: moment()
    }
  },
  computed: {
    stratrunners: function() {
      return _.orderBy(_.toArray(this.$store.state.bundles), b => b.id)
        .concat(_.toArray(this.$store.state.archivedBundles));
    },
    isAdmin: function() {
      const isAdmin = this.$store.state.auth.isAdmin();
      return !!isAdmin;
    },
  },
  methods: {
    isAuthorized: function(bundle) {
      const dbId = this.$store.state.auth.user('id');
      const isAdmin = this.$store.state.auth.isAdmin();
      return bundle.ownerId && dbId && bundle.ownerId === dbId || isAdmin;
    },
    humanizeDuration: (n) => window.humanizeDuration(n),
    moment: mom => moment.utc(mom),
    fmt: mom => moment.utc(mom).format('YYYY-MM-DD HH:mm'),
    round: n => (+n).toFixed(3),
    timespan: function(a, b) {
      return this.humanizeDuration(this.moment(a).diff(this.moment(b)))
    },
    status: state => {
      if(state.errored)
        return 'errored';
      if(state.stopped)
        return 'stopped';
      if(state.active)
        return 'running';

      console.log('unknown state:', state);
    },
    report: state => {
      return _.get(state, 'events.latest.performanceReport');
    },
    apiKey: function(bundle) {
      const name = this.isAuthorized(bundle) && _.get(bundle, 'config.trader.uniqueName') || ' - ';
      return name;
    },
    logLink(bundle = {}) {
      const link = `${ bundle.id }.log`
      return link;
    },
    getClass(bundle = {}) {
      let ret = '';
      /*if(bundle.ownerId === this.$store.state.auth.user('id') && bundle.active === true) {
        ret += 'bold'
      }
      if(bundle.active !== true) {
        ret += ' non-active'
      }*/
      return ret;
    }
  }
}
</script>

<style>
table.clickable {
  border-collapse: separate;
}

tr.clickable td:nth-child(1) {
  padding-left: 5px;
}

tr.clickable {
  cursor: pointer;
}
tr.clickable:hover {
  background: rgba(216,216,216,.99);
}

tr.non-active {
  background-color: rgba(0, 0, 0, 0.05);
}
</style>
