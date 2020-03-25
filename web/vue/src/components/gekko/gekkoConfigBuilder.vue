<template lang='pug'>
.grd.contain
  .grd-row
    .grd-row-col-3-6.mx1
      h3 Market
      market-picker(v-on:market='updateMarketConfig', :only-tradable='isTradebot')
      apiKeyPicker(v-on:apiKeyPicked='updateApiKeyConfig', v-if='isTradebot || isPaperTrader && isAdmin')
    .grd-row-col-3-6.mx1
      type-picker(v-on:type='updateType' :is-bundle='false')
  template(v-if='type !== "market watcher"')
    .hr
    strat-picker.contain.my2(v-on:stratConfig='updateStrat' :configCurrent="configCurrent")
    div.my2.contain
      .grd-row(v-if='type === "paper trader"')
        .grd-row-col-3-6
          paper-trader(v-on:settings='updatePaperTrader' :configCurrent="configCurrent")
        .grd-row-col-3-6
          dependency-picker(v-on:dependenciesConfig='updateDependencies')
</template>

<script>
import toml from 'toml-js';
import marketPicker from '../global/configbuilder/marketpicker.vue'
import typePicker from '../global/configbuilder/typepicker.vue'
import stratPicker from '../global/configbuilder/stratpicker.vue'
import paperTrader from '../global/configbuilder/papertrader.vue'
import DependencyPicker from '../global/configbuilder/dependencyPicker';
import apiKeyPicker from '../global/configbuilder/apiKeyPicker';

import { get } from '../../tools/ajax'
import _ from 'lodash'

export default {

  props: ['configCurrent'],
  created: function() {
    get('configPart/candleWriter', (error, response) => {
      this.candleWriter = toml.parse(response.part);
    });
    get('configPart/performanceAnalyzer', (error, response) => {
      this.performanceAnalyzer = toml.parse(response.part);
      this.performanceAnalyzer.enabled = true;
    });
  },
  data: () => {
    return {
      market: {},
      apiKeyName: '',
      range: {},
      type: '',
      strat: {},
      paperTrader: {},
      candleWriter: {},
      performanceAnalyzer: {}
    }
  },
  components: {
    DependencyPicker,
    marketPicker,
    typePicker,
    stratPicker,
    paperTrader,
    apiKeyPicker
  },
  computed: {
    isAdmin: function() {
      const isAdmin = this.$store.state.auth.isAdmin();
      return !!isAdmin;
    },
    isTradebot: function() {
      return this.type === 'tradebot';
    },
    isPaperTrader: function() {
      return this.type === 'paper trader';
    },
    config: function() {
      let config = {};
      Object.assign(
        config,
        this.market,
        { apiKeyName: this.apiKeyName },
        this.strat,
        { paperTrader: this.paperTrader },
        { candleWriter: this.candleWriter },
        { type: this.type },
        { performanceAnalyzer: this.performanceAnalyzer }
      );

      if(this.isTradebot) {
        delete config.paperTrader;
        config.trader = { enabled: true }
      }

      config.valid = this.validConfig(config);

      return config;
    }
  },
  methods: {
    validConfig: config => {
      if(config.type === 'market watcher')
        return true;
      if(config.type === 'tradebot' && _.isEmpty(config.apiKeyName)) {
        return false;
      }
      if(!config.tradingAdvisor)
        return false;
      if(_.isNaN(config.tradingAdvisor.candleSize))
        return false;
      else if(config.tradingAdvisor.candleSize == 0)
        return false;

      let strat = config.tradingAdvisor.method;
      if(_.isEmpty(config[ strat ]))
        return false;

      return true;
    },
    updateMarketConfig: function(mc) {
      this.market = mc;
      this.emitConfig();
    },
    updateApiKeyConfig: function(apiKey) {
      this.apiKeyName = apiKey;
      this.emitConfig();
    },
    updateType: function(type) {
      this.type = type;
      if(!this.isTradebot) {
        delete this.config.apiKeyName;
      }
      this.emitConfig();
    },
    updateStrat: function(strat) {
      this.strat = strat;
      this.emitConfig();
    },
    updatePaperTrader: function(pt) {
      this.paperTrader = pt;
      this.paperTrader.enabled = true;
      this.emitConfig();
    },
    updateDependencies: function(deps) {
      this.config.dependencies = deps;
      this.emitConfig();
    },

    emitConfig: function() {
      this.$emit('config', this.config);
    }
  }
}
</script>

<style>
</style>
