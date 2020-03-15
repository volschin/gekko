<template lang='pug'>
  div.contain.my2
    h3 Start a new gekko
    .grd-row
      .grd-row-col-3-6.px1(v-if='!isWatcher')
        label(for='gekkoName').wrapper Name:
        input(v-model='gekkoName')
      .grd-row-col-3-6.px1(v-if='!isWatcher')
        label(for='gekkoDescription').wrapper Description:
        textarea(v-model='gekkoDescription' rows="3").control--toml-input
    .grd-row(v-if='isAdmin && !isWatcher')
      label(for='sendNotifications').wrapper Send Notifications:
      input(v-model='sendNotifications' type="checkbox")
    gekko-config-builder(v-on:config='updateConfig' :configCurrent="configCurrent")
    .hr
    .txt--center(v-if='config.valid')
      a.w100--s.my1.btn--primary(href='#', v-on:click.prevent='start', v-if="!pendingStratrunner") Start
      spinner(v-if='pendingStratrunner')
</template>

<script>

import _ from 'lodash'
import Vue from 'vue'
import { post } from '../../tools/ajax'
import gekkoConfigBuilder from './gekkoConfigBuilder.vue'
import spinner from '../global/blockSpinner.vue'

export default {
  components: {
    gekkoConfigBuilder,
    spinner
  },
  data: () => {
    return {
      pendingStratrunner: false,
      config: {},
      gekkoName: '',
      gekkoDescription: '',
      sendNotifications: false,
      savedConfigId: null
    }
  },
  computed: {
    isWatcher: function() {
      return this.config.type === 'market watcher';
    },
    isAdmin: function() {
      const isAdmin = this.$store.state.auth.isAdmin();
      return !!isAdmin;
    },
    gekkos: function() {
      return this.$store.state.gekkos;
    },
    watchConfig: function() {
      let raw = _.pick(this.config, 'watch', 'candleWriter');
      let watchConfig = Vue.util.extend({}, raw);
      watchConfig.type = 'market watcher';
      watchConfig.mode = 'realtime';
      return watchConfig;
    },
    requiredHistoricalData: function() {
      if(!this.config.tradingAdvisor || !this.config.valid)
        return;

      let stratSettings = this.config.tradingAdvisor;
      return stratSettings.candleSize * stratSettings.historySize;
    },
    gekkoConfig: function() {
      var startAt;

      if(!this.existingMarketWatcher)
        return;

      if(!this.requiredHistoricalData) {
        startAt = moment().utc().startOf('minute').format();
      } else if(this.config.tradingAdvisor.startAtExact) {
        startAt = this.config.tradingAdvisor.startAtExact.utc().format();
      } else {
        // TODO: figure out whether we can stitch data
        // without looking at the existing watcher
        const optimal = moment().utc().startOf('minute')
          .subtract(this.requiredHistoricalData, 'minutes')
          .unix();

        let available = 0;
        if(this.existingMarketWatcher.events.initial && this.existingMarketWatcher.events.initial.candle) { // buggy due to persistent gekkos :)
          available = moment
            .utc(this.existingMarketWatcher.events.initial.candle.start)
            .unix();
        }
        startAt = moment.unix(Math.max(optimal, available)).utc().format();
      }

      const gekkoConfig = Vue.util.extend({
        market: {
          type: 'leech',
          from: startAt
        },
        mode: 'realtime'
      }, this.config);

      // set additional custom gekko options, that we want to get from user:
      let options = {}
      if(!_.isEmpty(this.gekkoName)) {
        options.name = this.gekkoName;
      }
      if(!_.isEmpty(this.gekkoDescription)) {
        options.description = this.gekkoDescription;
      }
      options.sendNotifications = this.sendNotifications;
      gekkoConfig.options = options;

      return gekkoConfig;
    },
    existingMarketWatcher: function() {
      let test1 = this.pendingStratrunner; // fixing bug - without this it does not call existingMarketWatcher watcher on pendingStratrunner change!
      let test2 = test1 + 1234;
      const market = Vue.util.extend({}, this.watchConfig.watch);
      return _.find(this.gekkos, {config: {watch: market}});
    },
    exchange: function() {
      return this.watchConfig.watch.exchange;
    },
    existingTradebot: function() {
      return _.find(
        this.gekkos,
        g => {
          if(g.logType === 'tradebot' && g.config.apiKeyName === this.config.apiKeyName) {
            return true;
          }

          return false;
        }
      );
    },
    availableApiKeys: function() {
      return this.$store.state.apiKeys;
    },
    configCurrent: function() {
      return this.$store.state.configCurrent || {};
    },
  },
  watch: {
    // start the stratrunner
    existingMarketWatcher: function(val, prev) {
      if(!this.pendingStratrunner)
        return;

      const gekko = this.existingMarketWatcher;

      if(gekko.events.latest.candle) {
        this.pendingStratrunner = false;

        this.startGekko((err, resp) => {
          this.$router.push({
            path: `/live-gekkos/${resp.id}`
          });
        });
      }
    }
  },
  mounted: async function() {
    if(this.$route.query.configId) {
      this.savedConfigId = this.$route.query.configId;
      this.$store.dispatch({
        type: 'FETCH_CONFIG_CURRENT',
        payload: { configId: this.savedConfigId }
      }).then(response => {
        if(this.configCurrent && this.configCurrent.options) {
          this.gekkoName = this.configCurrent.options.name;
          this.gekkoDescription = this.configCurrent.options.description;
        }
        // TODO: stop the ajax spinner, loading is done at this point.
      }, error => {
        this.$toast({
          text: 'Config NOT fetched',
          fullText: error,
          icon: 'error'
        });
        console.error(error);
      });
    }
  },
  methods: {
    updateConfig: function(config) {
      this.config = config;
    },
    start: function() {
      const that = this;
      // if the user starts a tradebot we do some
      // checks first.
      if(this.config.type === 'tradebot') {
        /*if(this.existingTradebot) {
          let str = 'You already have a tradebot running on this Api Key';
          str += ', you can only run one tradebot per Api Key.';
          return alert(str);
        }*/

        if(_.isEmpty(this.config.apiKeyName)) {
          return alert('Please first select API key');
        }
      }
      // internally a live gekko consists of two parts:
      //
      // - a market watcher
      // - a live gekko (strat runner + (paper) trader)
      //
      // however if the user selected type "market watcher"
      // the second part won't be created
      if(this.config.type === 'market watcher') {

        // check if the specified market is already being watched
        if(this.existingMarketWatcher) {
          alert('This market is already being watched, redirecting you now...');
          this.$router.push({
            path: `/live-gekkos/${this.existingMarketWatcher.id}`
          });
        } else {
          this.startWatcher((error, resp) => {
            this.$router.push({
              path: `/live-gekkos/${resp.id}`
            });
          });
        }

      } else {

        if(this.existingMarketWatcher) {
          // the specified market is already being watched,
          // just start a gekko!
          this.startGekko(this.routeToGekko);

        } else {
          // the specified market is not yet being watched,
          // we need to create a watcher
          this.startWatcher((err, resp) => {
            that.pendingStratrunner = resp.id;
            // now we just wait for the watcher to be properly initialized
            // (see the `watch.existingMarketWatcher` method)
          });
        }
      }
    },
    routeToGekko: function(err, resp) {
      if(err || resp.error)
        return console.error(err, resp.error);

      this.$router.push({
        path: `/live-gekkos/${resp.id}`
      });
    },
    startWatcher: function(next) {
      post('startGekko', this.watchConfig, next);
    },
    startGekko: function(next) {
      post('startGekko', this.gekkoConfig, next);
    }
  }
}
</script>

<style>
</style>
