<template lang='pug'>
  .contain.py2
    router-link.btn--primary(to='/live-gekkos/new') Start New Gekko
    router-link.btn--primary(to='/bundles/new' v-if='isAdmin') Start New Bundle
    .hr
    h3 All live gekkos
    .text(v-if='!stratrunners.length')
      p You don't have any stratrunners.
    table.full(v-if='stratrunners.length')
      thead
        tr
          th(v-if='isAdmin') user
          th api key
          th name
          th PnL
          th trades
          th strategy
          th exchange
          th currency
          th asset
          th duration
          th status
          th type
          th(v-if='isAdmin') log
      tbody
        tr.clickable(v-for='gekko in stratrunners', v-on:click='$router.push({path: `/live-gekkos/${gekko.id}`})' :class='getClass(gekko)')
          td(v-if='isAdmin')
            a(:href='"/users/" + gekko.ownerId') {{ gekko.ownerId  }}
          td {{ apiKey(gekko)  }}
          td {{ gekko.config.options.name }}
          td
            template(v-if='!report(gekko)') 0
            template(v-if='report(gekko)') {{ round(report(gekko).relativeProfit) }}%
          td
            template(v-if='!gekko.events.tradeCompleted') 0
            template(v-if='gekko.events.tradeCompleted') {{ gekko.events.tradeCompleted.length }}
          td {{ gekko.config.tradingAdvisor.method }}
          td {{ gekko.config.watch.exchange }}
          td {{ gekko.config.watch.currency }}
          td {{ gekko.config.watch.asset }}
          td
            template(v-if='gekko.events.initial.candle && gekko.events.latest.candle') {{ timespan(gekko.events.latest.candle.start, gekko.events.initial.candle.start) }}
          td {{ status(gekko) }}
          td {{ gekko.logType }}
          td(v-if='isAdmin')
            a(:href='logLink(gekko)' target='_blank') >>
    h3(v-if='isAdmin') Market watchers
    .text(v-if='!watchers.length')
      p You don't have any market watchers.
    table.full.clickable(v-if='watchers.length && isAdmin')
      thead
        tr
          th exchange
          th currency
          th asset
          th status
          th started at
          th last update
          th duration
      tbody
        tr.clickable(v-for='gekko in watchers', v-on:click='$router.push({path: `/live-gekkos/${gekko.id}`})' :class='getClass(gekko)')
          td {{ gekko.config.watch.exchange }}
          td {{ gekko.config.watch.currency }}
          td {{ gekko.config.watch.asset }}
          td {{ status(gekko) }}
          td
            template(v-if='gekko.events.initial.candle') {{ fmt(gekko.events.initial.candle.start) }}
          td
            template(v-if='gekko.events.latest.candle') {{ fmt(gekko.events.latest.candle.start) }}
          td
            template(v-if='gekko.events.initial.candle && gekko.events.latest.candle') {{ timespan(gekko.events.latest.candle.start, gekko.events.initial.candle.start) }}
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
      const filteredGekkos = _.filter(this.$store.state.gekkos, g => (g.logType !== 'papertrader'
        || g.logType === 'papertrader' && g.config && _.isUndefined(g.config.bundleUuid)));
      const filteredArchivedGekkos = _.filter(this.$store.state.archivedGekkos, g => (g.logType !== 'papertrader'
        || g.logType === 'papertrader' && g.config && _.isUndefined(g.config.bundleUuid)));
      return _.orderBy(filteredGekkos, g=>g.logType !== 'tradebot')
        .concat(_.orderBy(filteredArchivedGekkos, g=>g.logType !== 'tradebot'))
          .filter(g => {
            if(g.logType === 'papertrader')
              return true;

            if(g.logType === 'tradebot')
              return true;

            return false;
          })
    },
    watchers: function() {
      return _.values(this.$store.state.gekkos)
        .concat(_.values(this.$store.state.archivedGekkos))
        .filter(g => g.logType === 'watcher')
    },
    isAdmin: function() {
      const isAdmin = this.$store.state.auth.isAdmin();
      return !!isAdmin;
    },
  },
  methods: {
    isAuthorized: function(gekko) {
      const dbId = this.$store.state.auth.user('id');
      const isAdmin = this.$store.state.auth.isAdmin();
      return gekko.ownerId && dbId && gekko.ownerId === dbId || isAdmin;
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
    apiKey: function(gekko) {
      const name = this.isAuthorized(gekko) && _.get(gekko, 'config.trader.uniqueName') || ' - ';
      return name;
    },
    logLink(gekko = {}) {
      const link = `${ gekko.id }.log`
      return link;
    },
    getClass(gekko = {}) {
      let ret = '';
      if(gekko.ownerId === this.$store.state.auth.user('id') && gekko.config.type === 'tradebot' && gekko.active === true) {
        ret += 'bold'
      }
      if(gekko.active !== true) {
        ret += ' non-active'
      }
      if(gekko.errored) {
        ret += ' errored-gekko'
      }
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
