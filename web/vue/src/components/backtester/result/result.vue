<template lang='pug'>
  div
    .hr.contain
    div.contain
      h3 Backtest result
    result-summary(:report='result.performanceReport')
    .hr.contain
    chart(:data='candles', height='500')
    //.hr.contain
    //tradingviewChart(:height='500', config={asdf: "a"})
    .hr.contain
    roundtripTable(:roundtrips='result.roundtrips')
</template>

<script>
import resultSummary from './summary.vue'
import chart from './chartWrapper.vue'
// import tradingviewChart from '../../tradingview/tradingviewChartContainer.vue'

import roundtripTable from './roundtripTable.vue'

export default {
  props: ['result'],
  data: () => {
    // config.watch.asset = "ltc"
    // config.watch.currency = "btc"
    // config.watch.exchange = "poloniex"
    return {}
  },
  methods: {},
  components: {
    roundtripTable,
    resultSummary,
    chart,
    // tradingviewChart
  },
  computed: {
    candles: function() {
      return {
        candles: this.result.stratCandles,
        trades: this.result.trades
      };
    }
  }
}
</script>

<style>
</style>
