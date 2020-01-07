<template lang='pug'>
  div
    h2.contain Backtest
    .hr
    config-builder(v-on:config='check')

    result(v-if='backtestResult && backtestState === "fetched"', :result='backtestResult', v-bind:config={  })

    div.tradingviewContainer(v-bind:style="{ display: tradingviewDisplay }")
      tradingviewChart(:height='500', v-bind:config="config", v-bind:backtestResult="backtestResult")
    div(v-if='backtestable')
      .txt--center
        a.button--backtest.w100--s.my1.btn--primary(href='#', v-if='backtestState !== "fetching"', v-on:click.prevent='run') Backtest
        div(v-if='backtestState === "fetching"').scan-btn
          p Running backtest..
          spinner
</template>

<script>
import configBuilder from './backtestConfigBuilder.vue'
import result from './result/result.vue'
import { post } from '../../tools/ajax'
import spinner from '../global/blockSpinner.vue'
import tradingviewChart from '../tradingview/tradingviewChartContainer.vue'

export default {
  data: () => {
    return {
      backtestable: false,
      backtestState: 'idle',
      backtestResult: false,
      config: false,
      tradingviewDisplay: 'none',
    }
  },
  methods: {
    check: function(config) {
      this.config = config;

      if(!config.valid) {
        this.setVisibilityTradingview('none');
        return this.backtestable = false;
      } else {
        this.setVisibilityTradingview('block');
        this.backtestable = true;
      }

    },
    run: function() {
      this.backtestState = 'fetching';

      post('backtest', this.config, (error, response) => {
        this.backtestState = 'fetched';
        this.backtestResult = response;
      });
    },
    setVisibilityTradingview: function(display){
      this.$set(this, 'tradingviewDisplay', display);
    }
  },
  components: {
    configBuilder,
    result,
    spinner,
    tradingviewChart,
  }
}
</script>
