<template lang='pug'>
#tradingviewWrapper(v-bind:class='')
  // TradingView Widget BEGIN
  .tradingview-widget-container
   #tradingview_4981e
   .tradingview-widget-copyright
     a(href="https://www.tradingview.com/symbols/POLONIEX-LTCBTC/" rel="noopener" target="_blank")
       span.blue-text LTCBTC Chart
     |  by TradingView
   //script(type="text/javascript" src="https://s3.tradingview.com/tv.js")
   script(type="text/javascript").
     new TradingView.widget(
     {
     "width": 980,
     "height": 610,
     "symbol": "POLONIEX:LTCBTC",
     "interval": "1",
     "timezone": "Europe/Moscow",
     "theme": "Light",
     "style": "1",
     "locale": "en",
     "toolbar_bg": "#f1f3f6",
     "enable_publishing": false,
     "hide_side_toolbar": false,
     "allow_symbol_change": true,
     "studies": [
     "ATR@tv-basicstudies",
     "BB@tv-basicstudies",
     "RSI@tv-basicstudies"
     ],
     "container_id": "tradingview_4981e"
     }
     );
     // TradingView Widget END
</template>

<script>

export default {

  data: function() {
    return {
      isClicked: false
    }
  },

  watch: {
    data: function() { this.render() },
  },
  render:()=>{
    window.w = new TradingView.widget(
      {
        "width": 980,
        "height": 610,
        "symbol": "POLONIEX:LTCBTC",
        "interval": "1",
        "timezone": "Europe/Moscow",
        "theme": "Light",
        "style": "1",
        "locale": "en",
        "toolbar_bg": "#f1f3f6",
        "enable_publishing": false,
        "hide_side_toolbar": false,
        "allow_symbol_change": true,
        "studies": [
          "ATR@tv-basicstudies",
          "BB@tv-basicstudies",
          "RSI@tv-basicstudies"
        ],
        "container_id": "tradingview_4981e"
      }
    );
  },
  created: function() {
    setTimeout( this.render, 100)
  },
  beforeDestroy: function() {
    //this.remove();
  },

  methods: {

  }
}
</script>

<style>

#chartWrapper.clickable {
  position: relative;
}

#chartWrapper.clickable .shield {
  cursor: zoom-in;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  background: grey;
  opacity: 0.1;
}

#chart {
  background-color: #eee;
  width: 100%;
}

#chart circle {
  clip-path: url(#clip);
}

#chart .zoom {
  cursor: move;
  fill: none;
  pointer-events: all;
}

#chart .line {
  fill: none;
  stroke: steelblue;
  stroke-width: 1.5px;
  clip-path: url(#clip);
}

/*#chart .price.line {
  stroke-width: 2.5px;
}*/

#chart circle.buy {
  fill: #7FFF00;
}

#chart circle.sell {
  fill: red;
}

</style>
