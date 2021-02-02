<template lang='pug'>
  div
    dataset-picker.my2(v-on:dataset='updateDataset' :configCurrent="configCurrent").contain
    //.hr.contain
    //tradingviewChart(:height='500', config={asdf: "a"})
    .hr
    strat-picker.my2(v-on:stratConfig='updateStrat' :configCurrent="configCurrent" :isBacktest='true').contain
    div.grd.my2.contain(v-if='isBatch')
      .hr
      label.wrapper Batch Size:
      .custom-select.button
        select(v-model='selectedBatchSize' v-on:selectedBatchSize='config' v-on:change='updateBatcher')
          option(v-for='(batch) in batchSizes') {{ batch }}
    .hr
    div.my2.contain
      .grd-row
        .grd-row-col-3-6
          paper-trader(v-on:settings='updatePaperTrader' :configCurrent="configCurrent")
        .grd-row-col-3-6
          dependency-picker(v-on:dependenciesConfig='updateDependencies')
</template>

<script>

import datasetPicker from '../global/configbuilder/datasetpicker.vue'
import stratPicker from '../global/configbuilder/stratpicker.vue'
import paperTrader from '../global/configbuilder/papertrader.vue'
import DependencyPicker from '../global/configbuilder/dependencyPicker';

import _ from 'lodash'
import { get } from '../../tools/ajax'
import toml from 'toml-js';
// import tradingviewChart from '../tradingview/tradingviewChartContainer.vue'

export default {
  props: ['configCurrent', 'isBatch'],
  created: function() {
    get('configPart/performanceAnalyzer', (error, response) => {
      this.performanceAnalyzer = toml.parse(response.part);
      this.performanceAnalyzer.enabled = true;
    });
  },
  mounted() {
  },
  data() {
    return {
      dataset: {},
      strat: {},
      paperTrader: {},
      performanceAnalyzer: {},
      dependencyPicker: [],
      selectedBatchSize: '1 month',
      batchSizes: [ '15 minutes', '1 hour', '1 day', '1 week', '1 month', '1 quarter', '1 year']
    }
  },
  components: {
    stratPicker,
    datasetPicker,
    paperTrader,
    DependencyPicker
    // tradingviewChart,
  },
  computed: {
    market: function() {
      if(!this.dataset.exchange)
        return {};

      return {
        configCurrent: this.configCurrent,
        exchange: this.dataset.exchange,
        currency: this.dataset.currency,
        asset: this.dataset.asset
      }
    },
    range: function() {
      if(!this.dataset.exchange)
        return {};

      return {
        from: this.dataset.from,
        to: this.dataset.to
      }
    },
    config: function() {
      let config = {};
      Object.assign(
        config,
        { watch: this.market },
        { paperTrader: this.paperTrader },
        { dependencies: this.dependencyPicker },
        this.strat,
        {
          backtest: {
            daterange: this.range
          },
          backtestResultExporter: {
            enabled: true,
            writeToDisk: false,
            data: {
              stratUpdates: false,
              roundtrips: true,
              stratCandles: true,
              stratCandleProps: ['open'],
              trades: true
            }
          }
        },
        { performanceAnalyzer: this.performanceAnalyzer },
      );

      if (this.isBatch) {
        config.batchBacktest = { batchSize: this.selectedBatchSize };
      }

      config.valid = this.validConfig(config);
      config.backtestResultExporter.enabled = true;
      return config;
    }
  },
  methods: {
    validConfig: function(config) {
      if(!config.backtest)
        return false;

      if(!config.backtest.daterange)
        return false;

      if(_.isEmpty(config.backtest.daterange))
        return false;

      if(!config.watch)
        return false;

      if(!config.tradingAdvisor)
        return false;

      let strat = config.tradingAdvisor.method;
      if(_.isEmpty(config[ strat ]))
        return false;

      if(config.tradingAdvisor) {
        if(_.isNaN(config.tradingAdvisor.candleSize))
          return false;
        else if(config.tradingAdvisor.candleSize === 0)
          return false;
      }

      return true;
    },
    updateDataset: function(set) {
      this.dataset = set;
      this.$emit('config', this.config);
    },
    updateStrat: function(sc) {
      this.strat = sc;
      this.$emit('config', this.config);
    },
    updateDependencies: function(deps) {
      this.dependencyPicker = deps;
      this.$emit('config', this.config);
    },
    updatePaperTrader: function(pt) {
      this.paperTrader = pt;
      this.paperTrader.enabled = true;
      this.$emit('config', this.config);
    },
    updateBatcher: function(batch) {
      this.$emit('config', this.config);
    },
  }
}
</script>

<style>
</style>
