<template lang='pug'>
div
  h3 Select a dataset
  .txt--center.my2(v-if='datasetScanstate === "idle"')
    a.w100--s.btn--primary.scan-btn(href='#', v-on:click.prevent='scan') Scan available data
  .txt--center.my2(v-if='datasetScanstate === "scanning"')
    spinner
  .my2(v-if='datasetScanstate === "scanned" || !!configCurrent.backtest')

    div(v-if='datasets.length != 0')
      table.full
        thead
          tr
            th
            th exchange
            th currency
            th asset
            th from
            th to
            th duration
        tbody
          tr(v-for='(set, i) in datasets')
            td.radio
              input(type='radio', name='dataset', :value='i', v-model='setIndex', v-bind:id='set.id')
            td
              label(v-bind:for='set.id') {{ set.exchange }}
            td
              label(v-bind:for='set.id') {{ set.currency }}
            td
              label(v-bind:for='set.id') {{ set.asset }}
            td
              label(v-bind:for='set.id') {{ fmt(set.from) }}
            td
              label(v-bind:for='set.id') {{ fmt(set.to) }}
            td
              label(v-bind:for='set.id') {{ humanizeDuration(set.to.diff(set.from)) }}
      a.btn--primary(href='#', v-on:click.prevent='openRange', v-if='!rangeVisible && !(configCurrent.backtest && datasetScanstate !== "scanned")') Adjust range
      template(v-if='rangeVisible')
        div
          label(for='customFrom') From:
          input(v-model='customFrom')
        div
          label(for='customTo') To:
          input(v-model='customTo')

    em(v-else) No Data found
      a(href='#/data/importer') Lets add some

</template>

<script>

import _ from 'lodash'
import Vue from 'vue'

import { post } from '../../../tools/ajax'
import spinner from '../../global/blockSpinner.vue'
import dataset from '../../global/mixins/dataset'
import toml from 'toml-js';

export default {
  components: {
    spinner
  },
  props: ['configCurrent'],
  data: () => {
    return {
      setIndex: -1,
      customTo: false,
      customFrom: false,
      rangeVisible: false,
      set: false
    };
  },
  mixins: [ dataset ],
  methods: {
    humanizeDuration: (n) => {
      return window.humanizeDuration(n, {largest: 4});
    },
    fmt: mom => mom.utc().format('YYYY-MM-DD HH:mm'),
    openRange: function() {
      if(this.setIndex === -1)
        return alert('Select a dataset to adjust range');

      this.updateCustomRange();

      this.rangeVisible = true;
    },
    updateCustomRange: function() {
      this.customTo = this.fmt(this.set.to);
      this.customFrom = this.fmt(this.set.from);
    },
    emitSet: function(val) {
      if(!val)
        return;

      let set;

      if(!this.customTo)
        set = val;
      else {
        set = Vue.util.extend({}, val);
        set.to = moment.utc(this.customTo, 'YYYY-MM-DD HH:mm').format();
        set.from = moment.utc(this.customFrom, 'YYYY-MM-DD HH:mm').format();
      }

      this.$emit('dataset', set);
    }
  },
  watch: {
    configCurrent: {
      immediate: true,
      handler(val, oldVal) {
        if(val && val.watch && val.backtest && val.backtest.daterange) {
          const watch = val.watch;
          const daterange = val.backtest.daterange;
          this.customTo = daterange.to;
          this.customFrom = daterange.from;
          const id = val.watch.exchange + val.watch.asset + val.watch.currency + Math.floor(Math.random() * Math.floor(1000)); // random int < 1000
          const obj = {
            exchange: val.watch.exchange,
            currency: val.watch.currency,
            asset: val.watch.asset,
            from: moment(daterange.from),
            to: moment(daterange.to),
          }
          if(this.datasetScanstate === 'idle'){
            obj.id = id;
            this.scanFake(obj);
            this.setIndex = 0;
          } else {
          }
        }
      }
    },
    setIndex: function() {
      this.set = this.datasets[this.setIndex];

      this.updateCustomRange();

      this.emitSet(this.set);
    },

    customTo: function() { this.emitSet(this.set); },
    customFrom: function() { this.emitSet(this.set); }
  }
}
</script>
<style>
td.radio {
  width: 45px;
}
td label{
  display: inline;
  font-size: 1em;
}
</style>
