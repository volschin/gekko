<template lang='pug'>
.grd
  .grd-row
    .grd-row-col-3-6.px1
      h3 Strategy
      div
        label(for='strat').wrapper Strategy:
        .custom-select.button
          select(v-model='strategy')
            option(v-for='strat in strategies') {{ strat.name }}
      div
        label(for='candleSize') Candle Size
        .grd-row
          .grd-row-col-3-6
            input(v-model='rawCandleSize')
          .grd-row-col-3-6.align
            .custom-select.button
              select(v-model='candleSizeUnit')
                option minutes
                option hours
                option days
      div
        label(for='historySize') Warmup period (in {{ rawCandleSize }} {{ singularCandleSizeUnit }} candles):
        input(v-model='historySize')
        em.label-like (will use {{ humanizeDuration(candleSize * historySize * 1000 * 60) }} of data as history)
      div
        a(v-if='!isBacktest' v-on:click='setExactBlockVisible = !setExactBlockVisible') Set exact start time (UTC)
        span(v-if='setExactBlockVisible')
          input(v-on:change='startAtChange' v-model='getStartAtTimeFormatted')
          em.label-like (Change this ONLY if you FIRST started watcher and THEN downloaded candles from the start time, till present)
    .grd-row-col-3-6.px1
      div
        h3 Parameters
        p {{ strategy }} Parameters:
        textarea.params(v-model='rawStratParams').control--toml-input
        p.bg--red.p1(v-if='rawStratParamsError') {{ rawStratParamsError.message }}
</template>

<script>

import _ from 'lodash'
import { get } from '../../../tools/ajax'
import toml from 'toml-js';
const dateFormat = 'YYYY-MM-DD HH:mm';
// const dateFormat = 'DD-MM-YYYY HH:mm';

export default {
  data: () => {
    return {
      strategies: [],

      candleSizeUnit: 'hours',
      rawCandleSize: 1,

      strategy: 'MACD',
      historySize: 14,

      rawStratParams: '',
      rawStratParamsError: false,

      emptyStrat: false,
      stratParams: {},
      startAtExact: null,
      setExactBlockVisible: false
    };
  },
  created: function () {
    get('strategies', (err, data) => {
      if(err) {
        console.error('get strategies error: ' + err);
      } else {
        this.strategies = data;

        _.each(this.strategies, function(s) {
          s.empty = s.params === '';
        });
        if(!(this.configCurrent && this.configCurrent.tradingAdvisor)) {
          this.rawStratParams = _.find(this.strategies, { name: this.strategy }).params;
          this.emptyStrat = _.find(this.strategies, { name: this.strategy }).empty;

          this.emitConfig();
        }
      }
    });
  },
  props: ['configCurrent', 'isBacktest'],
  watch: {
    configCurrent: {
      immediate: true,
      handler(val, oldVal) {
        if(val && val.tradingAdvisor) {
          const ta = val.tradingAdvisor;
          this.strategy = ta.method;
          this.historySize = ta.historySize;
          this.startAtExact = ta.startAtExact;
          if(ta.candleSize % 1440 === 0) {
            this.candleSizeUnit = 'days'
            this.rawCandleSize = ta.candleSize / 1440;
          } else if(ta.candleSize % 60 === 0) {
            this.candleSizeUnit = 'hours';
            this.rawCandleSize = ta.candleSize / 60;
          } else {
            this.candleSizeUnit = 'minutes';
            this.rawCandleSize = ta.candleSize;
          }
          this.stratParams = val[ta.method];
          this.rawStratParams = toml.dump(val[ta.method]);
        }
      }
    },
    strategy: function(strat) {
      const stratOrig = strat;
      strat = _.find(this.strategies, { name: strat });
      if(this.configCurrent && this.configCurrent.tradingAdvisor && this.configCurrent.tradingAdvisor.method === stratOrig) {
        // avoid overriding raw strat params
      } else if(strat) {
        this.rawStratParams = strat.params;

        this.emptyStrat = strat.empty;

        this.emitConfig();
      }
    },
    candleSize: function() { this.emitConfig() },
    historySize: function() { this.emitConfig() },
    startAtExact: function() { this.emitConfig() },
    rawStratParams: function() { this.emitConfig() }
  },
  computed: {
    candleSize: function() {
       if(this.candleSizeUnit === 'minutes')
        return this.rawCandleSize;
      else if(this.candleSizeUnit === 'hours')
        return this.rawCandleSize * 60;
      else if(this.candleSizeUnit === 'days')
        return this.rawCandleSize * 60 * 24;
    },
    singularCandleSizeUnit: function() {
      // hours -> hour
      return this.candleSizeUnit.slice(0, -1);
    },
    config: function() {
      let config = {
        tradingAdvisor: {
          enabled: true,
          method: this.strategy,
          candleSize: +this.candleSize,
          historySize: +this.historySize,
          startAtExact: this.startAtExact
        }
      }

      if(this.emptyStrat)
        config[this.strategy] = {__empty: true}
      else
        config[this.strategy] = this.stratParams;

      return config;
    },
    getStartAtTimeFormatted: function(){
      return this.getStartAtTime.format(dateFormat);
    },
    getStartAtTime: function() {
      const requiredHistoricalData = this.candleSize * this.historySize;
      let startAt = this.startAtExact || moment().utc().startOf('minute')
        .subtract(requiredHistoricalData, 'minutes')
      return startAt;
    }
  },
  methods: {
    humanizeDuration: (n) => window.humanizeDuration(n),
    emitConfig: function() {
      this.parseParams();
      this.$emit('stratConfig', this.config);
    },
    parseParams: function() {
      try {
        this.stratParams = toml.parse(this.rawStratParams);
        this.rawStratParamsError = false;
      } catch(e) {
        this.rawStratParamsError = e;
        this.stratParams = {};
      }
    },
    startAtChange: async function(e) {
      const histValue = e.currentTarget._value;
      const newValue = moment.utc(e.currentTarget.value, dateFormat);
      let dataSpan = moment().diff(newValue);

      const res = await this.$swal({
        title: `Are you sure about warmup since ${ newValue.format(dateFormat) }?`,
        html: `About to set warmup for <b>${ window.humanizeDuration(dataSpan) }</b>.
            <ul>
                <li>Change time <b>only if you first started watcher and then downloaded candles</b> for the set time, till present</li>
                <li>Better to <b>set round values</b>, that are dividable to candle size to have standard market candles (00:00 for 1 day, 13:00 for 1 hr, 21:05 for 5 minutes etc.)</li>
                <li><b>No more than 1000-3000 candles</b> for warmup period</li>
            </ul>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ok',
        cancelButtonText: 'Cancel',
        reverseButtons: true
      });
      if(res.value === true && this.isValidExactStartTime(newValue)) {
        this.startAtExact = newValue;
      } else {
        e.target.value = histValue;
      }
    },
    isValidExactStartTime: function(time) {

      let ret = false;
      if(time && time.isValid()) {
        const isHistoricalBefore = this.getStartAtTime.isBefore(time);
        if(!isHistoricalBefore) {
          ret = true;
        }
      }
      return ret;
    }
  }
}
</script>
<style>
.align .custom-select select {
  padding: 0.4em 1.2em .3em .8em;
}

.label-like {
  display: block;
  font-size: 0.9em;
  color: #777;
}

.align {
  padding-left: 1em;
}
</style>
