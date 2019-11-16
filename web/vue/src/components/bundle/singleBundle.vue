<template lang='pug'>
  div.my2
    .contain(v-if='!data')
      h1 Unknown Bundle
      p $LON doesn't know what bundle this is...
    div(v-if='data')
      gekkos-list(:bundle='data' :bundle-uuid='data.uuid')
      div(v-if='isArchived', class='contain brdr--mid-gray p1 bg--orange')
        | This is an archived Bundle, it is currently not running anymore.
      div(v-if='data.errorMessage', class='contain brdr--mid-gray p1 bg--orange')
        | This is Bundle crashed with the following error: {{ data.errorMessage }}
      .grd.contain
        .grd-row
          .grd-row-col-3-6
            h4 {{ name }}
            h6(v-if='!!description')
              textarea(rows='3' disabled="disabled") {{ description }}
          .grd-row-col-3-6(v-if='isAdmin')
            h4 User: &nbsp
              a(:href='"/users/" + data.ownerId') {{ ownerName  }}
        .grd-row(v-if='isAdmin')
          label(for='sendNotifications').wrapper Send Notifications:
          input(type="checkbox" disabled="disabled" :checked="!!sendNotifications" )
      .grd.contain
        h3 Market
        div
          .grd-row
            .grd-row-col-3-6 Exchange
            .grd-row-col-3-6
              strong {{ config.watch.exchange }}
          .grd-row
            .grd-row-col-3-6 Currency
            .grd-row-col-3-6
              strong {{ config.watch.currency }}
          .grd-row
            .grd-row-col-3-6 Assets
            .grd-row-col-3-6
              strong {{ config.watch.assets }}

        .grd-row(v-if='isStratrunner')
          .grd-row-col-3-6
            h3 Strategy
            .grd-row
              .grd-row-col-3-6 Name
              .grd-row-col-3-6
                strong {{ stratName }}
            .grd-row
              .grd-row-col-3-6 Candle Size
              .grd-row-col-3-6
                strong {{ candleSize }}
            .grd-row
              .grd-row-col-3-6 History Size
              .grd-row-col-3-6
                strong {{ historySize }}
            | Parameters
            pre {{ stratParams }}
          .grd-row-col-3-6
            h3 Profit report
            template(v-if='!report')
              p
                em(v-if='isArchived') This Bundle never executed a trade..
                em(v-if='!isArchived') coming soon..
        p(v-if='!isArchived && isAuthorized')
          a(v-on:click='stopBundle', class='w100--s my1 btn--red') Stop Bundle
        p(v-if='isArchived && isAuthorized')
          a(v-on:click='deleteBundle', class='w100--s my1 btn--red') Delete Bundle
        p(v-if='isAuthorized')
          a(v-on:click='restartBundle', class='w100--s my1 btn--blue') Restart Bundle
        p(v-if='isAdmin')
          router-link.btn--primary(to='/bundles/new' v-if='isAdmin') Start New Bundle

</template>

<script>

import Vue from 'vue'
import _ from 'lodash'

import { post } from '../../tools/ajax'
import spinner from '../global/blockSpinner.vue'
import gekkosList from './gekkosList.vue'
// global moment

export default {
  created: function() {
  },
  components: {
    spinner,
    gekkosList
  },
  data: () => {
    return {
      candleFetch: 'idle',
      candles: false
    }
  },
  computed: {
    id: function() {
      return this.$route.params.id;
    },
    bundles: function() {
      return this.$store.state.bundles;
    },
    archivedBundles: function() {
      return this.$store.state.archivedBundles;
    },
    data: function() {
      if(!this.bundles)
        return false;
      if(_.has(this.bundles, this.id))
        return this.bundles[this.id];
      if(_.has(this.archivedBundles, this.id))
        return this.archivedBundles[this.id];

      return false;
    },
    config: function() {
      return _.get(this, 'data.config');
    },
    latestEvents: function() {
      return _.get(this, 'data.events.latest');
    },
    initialEvents: function() {
      return _.get(this, 'data.events.initial');
    },
    trades: function() {
      return _.get(this, 'data.events.tradeCompleted') || [];
    },
    isLive: function() {
      return _.has(this.bundles, this.id);
    },
    isStratrunner: function() {
      return true;
    },
    isArchived: function() {
      return this.data.stopped;
    },
    isAuthorized: function() {
      const dbId = this.$store.state.auth.user('id');
      const isAdmin = this.$store.state.auth.isAdmin();
      return this.data.ownerId && dbId && this.data.ownerId === dbId || isAdmin;
    },
    isAdmin: function() {
      const isAdmin = this.$store.state.auth.isAdmin();
      return !!isAdmin;
    },
    chartData: function() {
      return {
        candles: this.candles,
        trades: this.trades
      }
    },
    stratName: function() {
      if(this.data)
        return this.data.config.tradingAdvisor.method;
    },
    candleSize: function() {
      if(this.data)
        return this.data.config.tradingAdvisor.candleSize;
    },
    historySize: function() {
      if(this.data)
        return this.data.config.tradingAdvisor.historySize;
    },
    stratParams: function() {
      if(!this.data)
        return 'Loading...';

      let stratParams = Vue.util.extend({}, this.data.config[this.stratName]);
      delete stratParams.__empty;

      if(_.isEmpty(stratParams))
        return 'No parameters'

      return JSON.stringify(stratParams, null, 4);
    },
    hasLeechers: function() {
      if(this.isStratrunner) {
        return false;
      }

      let watch = Vue.util.extend({}, this.data.config.watch);

      return _.find(this.bundles, g => {
        if(g.id === this.id)
          return false;

        return _.isEqual(watch, g.config.watch);
      });
    },
    name: function() {
      if(this.data)
        return _.get(this.data, 'config.options.name');
    },
    description: function() {
      if(this.data)
        return _.get(this.data, 'config.options.description');
    },
    ownerName: function() {
      if(this.data)
        return _.get(this.data, 'ownerId');
    },
    sendNotifications: function() {
      if(this.data)
        return _.get(this.data, 'config.options.sendNotifications');
    }
  },
  watch: {

  },
  methods: {
    round: n => (+n).toFixed(5),
    humanizeDuration: (n, x) => window.humanizeDuration(n, x),
    moment: mom => moment.utc(mom),
    fmt: mom => moment.utc(mom).format('YYYY-MM-DD HH:mm'),
    stopBundle: function() {
      if(this.hasLeechers) {
        return alert('This Bundle is fetching market data for multiple stratrunners, stop these first.');
      }

      if(!confirm('Are you sure you want to stop this Bundle?')) {
        return;
      }

      post('bundleStop', { id: this.data.id }, (err, res) => {
        console.log('stopped bundle');
      });
    },
    deleteBundle: function() {
      if(!this.isArchived) {
        return alert('This Bundle is still running, stop it first!');
      }

      if(!confirm('Are you sure you want to DELETE this Bundle?')) {
        return;
      }

      post('bundleDelete', { id: this.data.id }, (err, res) => {
        this.$router.push({
          path: `/bundles/`
        });
      });
    },
    restartBundle: function() {

      if(!confirm('Are you sure you want to RESTART this Bundle?')) {
        return;
      }

      post('bundleRestart', { id: this.data.id }, (err, res) => {
        this.$router.push({
          path: `/bundles/`
        });
      });
    }
  }
}
</script>

<style>
</style>
