<template lang='pug'>
.grd-row-col-3-6
  table.p1
    tr
      th amount of trades
      td {{ report.trades }}
    tr(v-if='!isBatch')
      th sharpe ratio
      td {{ round2(report.sharpe) }}
    tr(v-if='!isBatch')
      th start balance
      td {{ round(report.startBalance) }} {{ report.currency }}
    tr(v-if='!isBatch')
      th final balance
      td {{ round(report.balance) }} {{ report.currency }}
    tr(v-if='isBatch')
      th total periods number
      td {{ report.periodsTotal }}
    tr(v-if='isBatch')
      th min profit
      td(:class='profitClass') {{ round(report.minProfit) }}%
    tr(v-if='isBatch')
      th max profit
      td(:class='profitClass') {{ round(report.maxProfit) }}%
    tr(v-if='isBatch')
      th profit periods amount
      td {{ report.periodsProfit }}
    tr(v-if='isBatch')
      th loss periods amount
      td {{ report.periodsLoss }}
    tr
      th simulated profit

  .big.txt--right.price(:class='profitClass') {{ round(report.relativeProfit) }}%

</template>

<script>

export default {
  props: ['report', 'isBatch'],
  methods: {
    round2: n => (+n).toFixed(2),
    round: n => (+n).toFixed(5)
  },
  computed: {
    profitClass: function() {
      if(this.report.relativeProfit > 0)
        return 'profit'
      else
        return 'loss'
    }
  }
}
</script>

<style>
.summary td {
  text-align: right;
}

.big {
  font-size: 1.3em;
  width: 80%;
}

.summary table {
  width: 80%;
}

.price.profit {
  color: #7FFF00;
}

.price.loss {
  color: red;
}

</style>
