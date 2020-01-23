<template lang='pug'>
  div.contain.my2
    h3 Start a new bundle
    .grd-row
      .grd-row-col-3-6.px1
        label(for='bundleName').wrapper Name:
        input(v-model='bundleName')
      .grd-row-col-3-6.px1
        label(for='bundleDescription').wrapper Description:
        textarea(v-model='bundleDescription' rows="3").control--toml-input
    .grd.grd-row(v-if='isAdmin')
      label(for='sendNotifications').wrapper Send Notifications:
      input(v-model='sendNotifications' type="checkbox")
    gekko-config-builder(v-on:config='updateConfig')
    .hr
    .txt--center(v-if='config.valid')
      a.w100--s.my1.btn--primary(href='#', v-on:click.prevent='start', v-if="!pendingStratrunner") Start
      spinner(v-if='pendingStratrunner')
</template>

<script>

import _ from 'lodash'
import Vue from 'vue'
import { post } from '../../tools/ajax'
import gekkoConfigBuilder from './bundleConfigBuilder.vue'
import spinner from '../global/blockSpinner.vue'
import uuid from 'uuid';

const TYPE = 'paper trader';
let bundleUuid;

export default {
  components: {
    gekkoConfigBuilder,
    spinner
  },
  data: () => {
    return {
      watchersLoaded: false,
      startedLoadProcess: false,
      pendingStratrunner: false,
      config: {},
      bundleName: '',
      bundleDescription: '',
      sendNotifications: false,
    }
  },
  computed: {
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
      this.watchersLoaded = false;
      return watchConfig;
    },
    requiredHistoricalData: function() {
      if(!this.config.tradingAdvisor || !this.config.valid)
        return;

      let stratSettings = this.config.tradingAdvisor;
      return stratSettings.candleSize * stratSettings.historySize;
    },
    gekkoConfig: function() {
      let startAt;

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

        /*let available = 0;
        if(this.existingMarketWatcher.events.initial && this.existingMarketWatcher.events.initial.candle) { // don't actually use, coz we have array of 'starts'
          available = moment
            .utc(this.existingMarketWatcher.events.initial.candle.start)
            .unix();
        }*/
        startAt = moment.unix(optimal).utc().format();
        // startAt = moment.unix(Math.max(optimal, available)).utc().format();
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
      if(!_.isEmpty(this.bundleName)) {
        options.name = this.bundleName;
      }
      if(!_.isEmpty(this.bundleDescription)) {
        options.description = this.bundleDescription;
      }
      options.sendNotifications = this.sendNotifications;
      gekkoConfig.options = options;

      return gekkoConfig;
    },
    /*

    existingMarketWatcher: function() {
      let foundGekko, foundGekkos = [], asset, i= 0, watchClone, assets = _.get(this.watchConfig, 'watch.selectedAssets'), watchConfig = this.watchConfig;
      if(assets) {
        console.log(`existingMarketWatcher: ${ assets.length}`, watchConfig, assets);
        for(let i=0; i < assets.length; i++) {
          asset = assets[i];
          watchClone = _.clone(this.watchConfig);
          watchClone.watch.asset = asset;

          foundGekko = _.find(this.gekkos, { config: watchClone });
          if(foundGekko) {
            foundGekkos.push(foundGekko);
          }
        }
      }

      console.log('found gekkos: ', foundGekkos);

      return foundGekkos;
    },
    */
    existingMarketWatcher: function() {
      let ret = false, foundGekko, notAllLoaded = false, asset, i= 0, watchClone, assets = _.get(this.watchConfig, 'watch.selectedAssets')
        , watchConfig = this.watchConfig;
      if(this.watchersLoaded) {
        ret = true;
      } else {
        if (assets && !this.startedLoadProcess) {
          watchClone = _.clone(this.watchConfig);
          for (let i = 0; i < assets.length; i++) {
            asset = assets[i];
            watchClone.watch.asset = asset;

            foundGekko = _.find(this.gekkos, { config: watchClone });
            // const foundGekko = _.find(this.gekkos, {config: {watch: market}});
            // console.log('existingMarketWatcher: foundGekko:  ', foundGekko)

            // if(!foundGekko || !(foundGekko.events && foundGekko.events.latest && foundGekko.events.latest.candle)) {
            if (!foundGekko) {
              notAllLoaded = true;
              // console.log(`NOT found, for `, watchClone, foundGekko, i)
            } else {
              // console.log(`found, for `, watchClone, foundGekko, i)
            }
            //console.log(watchClone);
          }

          ret = !notAllLoaded;
          if (ret) {
            this.watchersLoaded = true;
          }
          // console.log('existingMarketWatcher result: ', ret);
        }
      }
      // console.log(`existingMarketWatcher: ${ ret }`);
      return ret;
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
    }
  },
  watch: {
    // start the stratrunner
    existingMarketWatcher: function(val, prev) {
      if(!this.pendingStratrunner)
        return;

      const isExisting = this.existingMarketWatcher;

      if(isExisting) {
        this.pendingStratrunner = false;

        this.startGekko((err, resp) => {
          console.log('startGekko - 1')
          /*this.$router.push({
            path: `/bundles/${resp.id}`
          });*/
        });
      }
    }
  },
  methods: {
    updateConfig: function(config) {
      this.config = config;
    },
    start: function() {

      // if the user starts a tradebot we do some
      // checks first.
      if(this.config.type === 'tradebot') {
        if(this.existingTradebot) {
          let str = 'You already have a tradebot running on this Api Key';
          str += ', you can only run one tradebot per Api Key.';
          // return alert(str);
        }

        if(_.isEmpty(this.config.apiKeyName)) {
          // return alert('Please first select API key');
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
            this.pendingStratrunner = resp.id;
            // now we just wait for the watcher to be properly initialized
            // (see the `watch.existingMarketWatcher` method)
          });
        }
      }
    },
    routeToBundle: function(err, resp) {
      if(err || resp.error)
        return console.error(err, resp.error);

      this.$router.push({
        path: `/bundles/${resp.id}`
      });
    },
    startWatcher: async function(next) {
      let that = this, asset, i= 0, watchClone, assets = _.get(this.watchConfig, 'watch.selectedAssets')
        , watchConfig = this.watchConfig;
      console.log(`Trying to start ${ assets.length } watchers....>>>`);
      // alert(`Trying to start ${ assets.length } watchers....>>>`);
      that.startedLoadProcess = true;
      watchClone = _.clone(watchConfig);
      let recf = function(){
        setTimeout(function(){
          asset = assets[i];
          watchClone.watch.asset = asset;
          console.log('startWatcher, ', watchClone)

          let res = post('startGekko', watchClone, next);
          i++;

          if(i< assets.length){
            console.log('run recf, ', i);
            recf();
          } else {
            // alert('startWatcher: done ')
            that.startedLoadProcess = false;
          }
        }, 500);
      }
      recf();
    },
    startGekko: function(next) {
      let that = this, asset, i= 0, gekkoConfigClone, assets = _.get(this.watchConfig, 'watch.selectedAssets')
        , gekkoConfig = this.gekkoConfig;
      console.log(`Trying to start ${ assets.length } gekkos....>>>`);
      // alert(`Trying to start ${ assets.length } gekkos....>>>`);
      that.startedLoadProcess = true;

      gekkoConfigClone = _.clone(gekkoConfig);
      bundleUuid = uuid();
      gekkoConfigClone.bundleUuid = bundleUuid;
      delete gekkoConfigClone.watch.selectedAssets;

      console.log('bundleUuid: ', bundleUuid);
      let recf = function(){
        setTimeout(function(){
          asset = assets[i];
          gekkoConfigClone.watch.asset = asset;
          gekkoConfigClone.watch.assets = assets;
          console.log('startWatcher, ', gekkoConfigClone);

          post('startGekko', gekkoConfigClone, next);

          // let res = post('startGekko', watchClone, next);
          i++;

          if(i< assets.length){
            recf();
          } else {
            // alert('startGekko: done, creating bundle...>>> ');
            post('bundleStart', gekkoConfigClone, (err, res) => {
              console.log('bundleStart res: ', err, res);
              that.pendingStratrunner = res.id;
              that.$router.push({
                // path: `/bundles/`
                path: `/bundles/${ bundleUuid }` // todo -> bundle page
                // path: `/bundles/${res.id}` // todo -> bundle page
              });
              bundleUuid = null;
            });
            that.startedLoadProcess = false;
          }
        }, 500);
      }
      recf();
    }
  }
}
</script>

<style>
</style>
