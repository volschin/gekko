<template lang='pug'>
div.contain
  h3 Top 10

  p(v-if='!isAuthenticated')
    em Please login to see top ten strategies.

  p(v-if='isAuthenticated && !configs.length')
    em No configs now.
  ul(v-if='isAuthenticated')
    li(v-for='config in configs')
      hr
      span {{ config.name }}
      span &nbsp
      span(v-if='config.options.result && config.options.result')
        span
          span.price(:class="profitClass(config.options.result.profit)") {{ config.options.result.profit }}%
          span &nbsp in {{ config.options.result.timespan }} (~
          span.price(:class="profitClass(config.options.result.profit)") {{ config.options.result.yearlyProfit }}%
          span &nbsp per year)
      br
      b {{ config.tradingAdvisor.method }}
      span &nbsp
      router-link(:to='`backtest?configId=${ config.id }`') [ Backtest ]
      span &nbsp
      router-link(:to='`live-gekkos/new?configId=${ config.id }`') [ Live Gekko ]
  .hr
</template>

<script>
import { transformConfigs } from '../../store/modules/config/sync';

export default {
  data: () => {
    return {
      topConfigs: []
    }
  },
  mounted: async function() {
    if(this.isAuthenticated) {
      this.$store.dispatch({
        type: 'FETCH_TOP_CONFIG_LIST',
        payload: { amount: 10 }
      }).then(configs => {
        this.topConfigs = configs;
      }, error => {
        console.error(error);
        this.$toast({
          text: 'Could not fetch configs',
          fullText: error,
          icon: 'error'
        });
      });
    }
  },
  methods: {
    getBacktestingUrl(config) {
      return `backtest?configId=${ config.id }`;
    },
    profitClass: function(profit) {
      if(profit > 0)
        return 'profit'
      else
        return 'loss'
    }
  },
  computed: {
    configs: function() {
      return this.topConfigs;
    },
    isAuthenticated () {
      return this.$store.state.auth.isAuthenticated
    },
  },
  watch: {
  }
}
</script>
