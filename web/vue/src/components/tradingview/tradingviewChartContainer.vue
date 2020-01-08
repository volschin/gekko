<template lang='pug'>
  div.contain
    h3
      a(v-on:click.prevent='switchToggle') TradingView Chart
    div.TVChartContainer(:id='containerId' v-bind:style="{ display: toggle === 'open'? 'block': 'none' }")
</template>
<style>
  .control--toml-input-fixed {
    position: fixed;
    top: 60px;
    width: 250px;
    right: 80px;
    z-index: 10;
  }
  .button--backtest-fixed {
    position: fixed;
    top: 300px;
    right: 150px;
    z-index: 10;
  }
  .txt--backtest-fixed {
    width: 120px;
    position: fixed;
    top: 360px;
    right: 150px;
    z-index: 10;
  }
</style>
<script>


import Vue from 'vue'
import './charting_library';
import Datafeed from './api/index.js';

const STUDY_NAMES = {
  RSI: 'Relative Strength Index',
  ATR: 'Average True Range',
}


function getLanguageFromURL() {
  const regex = new RegExp('[\\?&]lang=([^&#]*)');
  const results = regex.exec(window.location.search);
  return results === null ? null : decodeURIComponent(results[1].replace(/\+/g, ' '));
}
// export const tvBus = new Vue();
let border1Current, border2Current, allExecutionShapes = [];
export default {
  name: 'TVChartContainer',
  props: {
    configCurrent:  {
      default: {},
      type: [ Object ]
    },
    symbol: {
      default: 'Poloniex:BTC/USD',
      type: String,
    },
    interval: {
      default: '1',
      type: String,
    },
    containerId: {
      default: 'tv_chart_container',
      type: String,
    },
    datafeedUrl: {
      default: 'https://demo_feed.tradingview.com',
      type: String,
    },
    timezone: {
      default: 'Europe/Moscow',
      type: String,
    },
    libraryPath: {
      default: '/charting_library/',
      type: String,
    },
    chartsStorageUrl: {
      default: 'https://saveload.tradingview.com',
      type: String,
    },
    chartsStorageApiVersion: {
      default: '1.1',
      type: String,
    },
    clientId: {
      default: 'tradingview.com',
      type: String,
    },
    userId: {
      default: 'public_user_id',
      type: String,
    },
    fullscreen: {
      default: false,
      type: Boolean,
    },
    autosize: {
      default: true,
      type: Boolean,
    },
    studiesOverrides: {
      type: Object,
    },

    config: {
      default: {},
      type: [ Object, Boolean ]
    },
    backtestResult: {
      type: [ Object, Boolean ]
    },
  },
  tvWidget: null,
  data: function () {
    return {
      toggle: 'open'
    }
  },
  watch: {
    configCurrent: function(config) {
      this.reloadChartFromConfig(config);
    },
    config: function(config) {
      this.reloadChartFromConfig(config);
    },
    backtestResult: function(config) {
      this.tvWidget.chart().removeAllShapes();
      this.drawTimeRangeBorders(config);
      this.drawBacktestResult(config);

      this.makeInputsFloatStyle();
    }
  },
  methods: {
    switchToggle: function() {
      if(this.toggle === 'open')
        this.toggle = 'closed';
      else
        this.toggle = 'open';
    },
    makeInputsFloatStyle(){
      let elem = window.document.getElementsByClassName('control--toml-input');
      elem && elem[0] && elem[0].classList.add('control--toml-input-fixed');
      let elem1 = window.document.getElementsByClassName('button--backtest');
      if(elem1 && elem1[0]){
        let elem1C = elem1[0].cloneNode(true);
        elem1[0].parentElement.appendChild(elem1C);
        elem1C.classList.add('button--backtest-fixed');
        elem1C.onclick = function(){
          elem1[0].click();
          return false;
        }
      }
      // elem1 && elem1[0] && elem1[0].classList.add('button--backtest-fixed');
      let elem2 = window.document.querySelectorAll('.price.profit, .price.loss');
      if(elem2[0]) {
        let elem2C = elem2[0].cloneNode(true);
        elem2[0].parentElement.appendChild(elem2C);
        elem2C.classList.add('txt--backtest-fixed');
      }
    },
    reloadChartFromConfig(config) {
      let exchange = '';
      if(config && config.watch && config.watch.exchange && config.watch.asset && config.watch.currency){
        if(config.watch.exchange.toUpperCase() === 'GDAX') {
          exchange = 'COINBASE';
        } else {
          exchange = config.watch.exchange.toUpperCase();
        }
        const symba = `${ exchange }:${ config.watch.asset.toUpperCase() }/${ config.watch.currency.toUpperCase() }`; //'Poloniex:LTC/BTC'
        let candleSize = config && config.tradingAdvisor && config.tradingAdvisor.candleSize;
        let from = config && config.backtest && config.backtest.daterange && config.backtest.daterange.from && new Date(config.backtest.daterange.from).getTime();
        let to = config && config.backtest && config.backtest.daterange && config.backtest.daterange.to && new Date(config.backtest.daterange.to).getTime();
        const tomlObj = config[config && config.tradingAdvisor && config.tradingAdvisor.method];
        const indicators = tomlObj && tomlObj.indicators || [];
        if(this.tvWidget._ready) {
          this.reloadChart(config, symba, this.calculateInterval(candleSize, from, to), from, to, indicators);
        }
      }
    },
    reloadChart(config, symbol, interval, dateFrom, dateTo, indicators) {
      const chart = this.tvWidget.chart();

      dateFrom = dateFrom / 1000;
      dateTo = dateTo / 1000;
      chart.removeAllShapes();
      this.drawTimeRangeBorders(config);
      this.tvWidget.setSymbol(symbol, interval, () => {
        if(dateFrom && dateTo && dateFrom < dateTo) {
          chart.setVisibleRange({ from: dateFrom, to: dateTo }, ()=>{
          });
          // if setSymbol IS called, borders created above will be erased, so simply redraw them here:
          this.drawTimeRangeBorders(config);
        }
      });
      this.addIndicators(indicators);
    },
    drawTimeRangeBorders(config){
      const chart = this.tvWidget.chart();
      let from = config && config.backtest && config.backtest.daterange && config.backtest.daterange.from && new Date(config.backtest.daterange.from).getTime();
      from = from && from / 1000;
      let to = config && config.backtest && config.backtest.daterange && config.backtest.daterange.to && new Date(config.backtest.daterange.to).getTime();
      to = to && to / 1000;
      border1Current && chart.removeEntity(border1Current);
      border1Current = chart.createShape({time: from},
        {
          shape: 'vertical_line',
          overrides: {
            linewidth: 3,
            linecolor: '#FF0000'
          },
        });
      border2Current && chart.removeEntity(border2Current);
      border2Current = chart.createShape({time: to},
        {
          shape: 'vertical_line',
          overrides: {
            linewidth: 3,
            linecolor: '#FF0000'
          },
        });
    },
    calculateInterval(candleSize, from, to){
      // if more 1mo, then int-l 1hr
      let ret = 'D';
      switch(candleSize) {
        case 1:
          /*// ret = '1';
          if(moment(to).diff(from, 'days') >= 7){
            ret = '60';
          } else {
            ret = '1';
          }*/
          ret = '1';

          break;
        case 15:
          ret = '15';
          break;
        case 60:
          ret = '60';
          break;
        case 1440:
          ret = 'D';
          break;
      }

      //temp:
      ret = '60';
      return ret;
    },
    calculateTimeframe(config){
      return "1234D"
    },
    drawBacktestResult(result) {
      let boughtPrice, boughtBalance, diff, tradeSuccessful, curShape, curText;
      allExecutionShapes.forEach(s=>{
        // s. // todo: executionShape.remove() (for arrows)
      })
      _.each(result.trades, (trade)=> {

      });

      _.each(result.trades, (trade) => {
        if (trade.action === 'buy') {
          boughtPrice = trade.price;
          boughtBalance = trade.balance;
        } else {
          if (boughtBalance) {
            // diff = (trade.price - boughtPrice) / trade.price ;
            // if (diff >= (trade.feePercent * 2)) {
            if(trade.balance - boughtBalance > 0) {
              tradeSuccessful = true;
            } else {
              tradeSuccessful = false;
            }
            boughtPrice = null;
          }
        }
        let tradeDate = Number.isInteger(trade.date) ? trade.date: (new Date(trade.date)).getTime() / 1000;
        if (trade.action === 'buy') {
          curShape = widget.chart().createShape({ time: tradeDate, price: trade.price },
            {
              shape: 'note',
              // lock: true,
              disableSelection: true,
              overrides: {
                text: `@${ trade.price } Buy ${ trade.amount }, Balance ${ trade.balance }`, // bug
                // backgroundColor: '#0f0',
                markerColor: '#1976d2',
              },
            });
          widget.chart().getShapeById(curShape).setProperties({
            text: `Bought @${ trade.price } Buy ${ trade.amount }, Balance ${ trade.balance }, id ${ trade.id }, Time ${ new Date(tradeDate * 1000) }`
          })
        } else {
          curShape = widget.chart().createShape({ time: tradeDate, price: trade.price },
            {
              shape: 'note',
              // lock: true,
              disableSelection: true,
              overrides: {
                text: `@${ trade.price } Buy ${ trade.amount }, Balance ${ trade.balance }`, // bug
                // backgroundColor: '#0f0',
                markerColor: tradeSuccessful?'#0f0': '#f00',
              },
            });
          widget.chart().getShapeById(curShape).setProperties({
            text: `Sold @${ trade.price } Buy ${ trade.amount }, Balance ${ trade.balance }, Profit ${ diff }, id ${ trade.id }, Time ${ new Date(tradeDate * 1000) } `
          })

        }
      });
    },

    addIndicators(indicators){
      _.each(indicators, (indicator)=>{
        this.tvWidget.chart().createStudy(indicator, false, false, null, {
          "average true range.precision": 8
        });
      });
    },
    addDefaultIndicators(config){
      this.tvWidget.chart().createStudy(STUDY_NAMES.RSI, false, false, [14], null, {
        "average true range.precision": 8
      });
      this.tvWidget.chart().createStudy(STUDY_NAMES.ATR, false, false, [14], null, {
        // "average true range.precision": 8
      });
    }
  },
  mounted() {
    const config = this.config || {}
    let exchange = '';

    /*
          if(config && config.watch && config.watch.exchange && config.watch.asset && config.watch.currency){
        if(config.watch.exchange.toUpperCase() === 'GDAX') {
          exchange = 'COINBASE';
        } else {
          exchange = config.watch.exchange.toUpperCase();
        }
        const symba = `${ exchange }:${ config.watch.asset.toUpperCase() }/${ config.watch.currency.toUpperCase() }`; //'Poloniex:LTC/BTC'
        let candleSize = config && config.tradingAdvisor && config.tradingAdvisor.candleSize;
        let from = config && config.backtest && config.backtest.daterange && config.backtest.daterange.from && new Date(config.backtest.daterange.from).getTime();
        let to = config && config.backtest && config.backtest.daterange && config.backtest.daterange.to && new Date(config.backtest.daterange.to).getTime();
        const tomlObj = config[config && config.tradingAdvisor && config.tradingAdvisor.method];
        const indicators = tomlObj && tomlObj.indicators || [];
        this.reloadChart(config, symba, this.calculateInterval(candleSize, from, to), from, to, indicators);
      }
    },
     */

    const widgetOptions = {
      symbol: this.symbol,
      // interval: '5',
      // interval: '1h',
      // interval: '30',
      // interval: '1',
      interval: '1',
      // interval: this.interval,
      timeframe: 'max',
      // timeframe: '1830d',
      // BEWARE: no trailing slash is expected in feed URL
      // datafeed: new window.Datafeeds.UDFCompatibleDatafeed(this.datafeedUrl),
      datafeed: Datafeed,
      container_id: this.containerId,
      timezone: this.timezone,
      library_path: this.libraryPath,
      locale: getLanguageFromURL() || 'en',
      disabled_features: ['use_localstorage_for_settings'],
      enabled_features: ['study_templates'],
      charts_storage_url: this.chartsStorageUrl,
      charts_storage_api_version: this.chartsStorageApiVersion,
      client_id: this.clientId,
      user_id: this.userId,
      fullscreen: this.fullscreen,
      autosize: this.autosize,
      studies_overrides: this.studiesOverrides,
    };
    if(config && config.watch && config.watch.exchange && config.watch.asset && config.watch.currency) {
      if(config.watch.exchange.toUpperCase() === 'GDAX') {
        exchange = 'COINBASE';
      } else {
        exchange = config.watch.exchange.toUpperCase();
      }
      widgetOptions.symbol = `${ exchange }:${ config.watch.asset.toUpperCase() }/${ config.watch.currency.toUpperCase() }`;
      widgetOptions.interval = config && config.tradingAdvisor && config.tradingAdvisor.candleSize;
    }
    const tomlObj = config[config && config.tradingAdvisor && config.tradingAdvisor.method];
    const indicators = tomlObj && tomlObj.indicators || [];

    const widget = window.TradingView.widget;
    const tvWidget = new widget(widgetOptions);
    window.widget = tvWidget;
    this.tvWidget = tvWidget;

    tvWidget.onChartReady(() => {
      if(this.configCurrent.watch) {
        this.reloadChartFromConfig(this.configCurrent);
      } else {
        this.reloadChartFromConfig(this.config);
      }
      this.addDefaultIndicators();

      if(indicators) {
        this.addIndicators(indicators);
      }
    });

  },
  destroyed() {
    if (this.tvWidget !== null) {
      this.tvWidget.remove();
      this.tvWidget = null;
    }
  }
}

</script>

<style lang="scss" scoped>
.TVChartContainer {
  height: calc(100vh - 80px);
}
</style>
