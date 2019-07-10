<template>
<div class="TVChartContainer" :id="containerId" />
</template>
<style>
  .control--toml-input-fixed {
    position: fixed;
    top: 60px;
    width: 250px;
    right: 80px;
  }
  .button--backtest-fixed {
    position: fixed;
    top: 300px;
    right: 150px;
  }
</style>
<script>


import Vue from 'vue'
import './charting_library.min';
import Datafeed from './api/index.js';
import datasetpicker from '../global/configbuilder/datasetpicker'

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
      //config: this.config
    }
  },
  watch: {
    config: function(config) {
      if(config && config.watch && config.watch.exchange && config.watch.asset && config.watch.currency){
        const symba = `${ config.watch.exchange.toUpperCase() }:${ config.watch.asset.toUpperCase() }/${ config.watch.currency.toUpperCase() }`; //'Poloniex:LTC/BTC'
        let candleSize = config && config.tradingAdvisor && config.tradingAdvisor.candleSize;
        let from = config && config.backtest && config.backtest.daterange && config.backtest.daterange.from && new Date(config.backtest.daterange.from).getTime();
        let to = config && config.backtest && config.backtest.daterange && config.backtest.daterange.to && new Date(config.backtest.daterange.to).getTime();
        const tomlObj = config[config && config.tradingAdvisor && config.tradingAdvisor.method];
        const indicators = tomlObj && tomlObj.indicators || [];
        this.reloadChart(config, symba, this.calculateInterval(candleSize, from, to), from, to, indicators);
      }
    },
    backtestResult: function(config) {
      this.tvWidget.chart().removeAllShapes();
      this.drawTimeRangeBorders(config);
      this.drawBacktestResult(config);

      this.makeInputsFloatStyle();
    }
  },
  methods: {
    makeInputsFloatStyle(){
      let elem = window.document.getElementsByClassName('control--toml-input');
      elem && elem[0] && elem[0].classList.add('control--toml-input-fixed');
      let elem1 = window.document.getElementsByClassName('button--backtest');
      elem1 && elem1[0] && elem1[0].classList.add('button--backtest-fixed');
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
      console.log('drawTimeRangeBorders, ', from, to);
    },
    calculateInterval(candleSize, from, to){
      // if more 1mo, then int-l 1hr
      let ret = 'D';
      switch(candleSize) {
        case 1:
          // ret = '1';
          if(moment(to).diff(from, 'days') >= 7){
            ret = '60';
          } else {
            ret = '1';
          }
          break;
        case 60:
          ret = '60';
          break;
        case 1440:
          ret = 'D';
          break;
      }
      return ret;
    },
    calculateTimeframe(config){
      return "1234D"
    },
    drawBacktestResult(result) {
      let boughtPrice, diff, tradeSuccessful, curShape;
      allExecutionShapes.forEach(s=>{
        // s. // todo: executionShape.remove() (for arrows)
      })
      _.each(result.trades, (trade)=> {

      });
      if(true){
        // draw execution shapes (arrow w/text):
        _.each(result.trades, (trade)=>{
          if (trade.action === 'buy') {
            boughtPrice = trade.price;
          } else {
            if (boughtPrice) {
              diff = trade.price - boughtPrice;
              if (diff > 0) {
                tradeSuccessful = true;
              } else {
                tradeSuccessful = false;
              }
              boughtPrice = null;
            }
          }
          if(trade.action === 'buy'){
            curShape = this.tvWidget.chart().createExecutionShape()
              .setText(``)
              .setTooltip(`Bought @${ trade.price } Buy ${ trade.amount }, Balance ${ trade.balance }, id ${ trade.id }, Time ${ new Date(trade.date * 1000) }`)
              .setTextColor("rgba(0,0,255,0.8)")
              .setArrowColor("#00f")
              .setDirection("buy")
              .setTime(trade.date)
              .setPrice(trade.price);
          } else {
            curShape = this.tvWidget.chart().createExecutionShape()
              .setText(``)
              .setTooltip(`Sold @${ trade.price } Buy ${ trade.amount }, Balance ${ trade.balance }, Profit ${ diff }, id ${ trade.id }, Time ${ new Date(trade.date * 1000) } `)
              .setTextColor(tradeSuccessful? "rgba(0,255,0,0.8)": "rgba(255,0,0,0.8)")
              .setArrowColor(tradeSuccessful? "#0F0": "#F00")
              .setDirection("sell")
              .setTime(trade.date)
              .setPrice(trade.price);
          }
        });
      }
      if(false) {
        // draw simple icons:
        _.each(result.trades, (trade) => {
          if (trade.action === 'buy') {
            widget.chart().createShape({ time: trade.date },
              {
                shape: 'icon',
                lock: true,
                disableSelection: true,
                overrides: {
                  size: 20,
                  color: '#0f0',
                  icon: 0xf00c //f041 - pin
                },
              });
          } else {
            widget.chart().createShape({ time: trade.date },
              {
                shape: 'icon',
                lock: true,
                disableSelection: true,
                overrides: {
                  size: 20,
                  color: '#f00',
                  icon: 0xf00d
                },
              });
            /*widget.chart().createShape({ time: trade.date },
            {
              shape: 'flag',
              color: '#F00',
              backgroundcolor: '#F00',
              overrides: {
                linewidth: 3,
                linecolor: '#F00',
                color: '#F00',
                backgroundcolor: '#F00',
              },
            });*/
          }
        });
      }
      _.each(result.trades, (trade) => {
        if (trade.action === 'buy') {
          boughtPrice = trade.price;
        } else {
          if (boughtPrice) {
            diff = trade.price - boughtPrice;
            if (diff > 0) {
              tradeSuccessful = true;
            } else {
              tradeSuccessful = false;
            }
            boughtPrice = null;
          }
        }
        if (trade.action === 'buy') {
          widget.chart().createShape({ time: trade.date, price: trade.price },
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
        } else {
          widget.chart().createShape({ time: trade.date, price: trade.price },
            {
              shape: tradeSuccessful? 'arrow_up': 'arrow_down',
              // lock: true,
              disableSelection: true,
              overrides: {
                text: `@${ trade.price } Buy ${ trade.amount }, Balance ${ trade.balance }`, // bug
                // backgroundColor: '#0f0',
                color: tradeSuccessful?'#0f0': '#f00',
              },
            });
          // for a sell let's show dif icons, depending on result:

          /*widget.chart().createShape({ time: trade.date },
            {
              shape: 'note',
              // lock: true,
              disableSelection: true,
              overrides: {
                text: `@${ trade.price } Sell ${ trade.amount }, Balance ${ trade.balance }`, // this is bug in TV!
                color: '#f00',
                backgroundColor: '#f00',
                markerColor: '#f00',
              },
            });*/
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
    const that = this;
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
    const widget = window.TradingView.widget;
    const tvWidget = new widget(widgetOptions);
    window.widget = tvWidget;
    this.tvWidget = tvWidget;

    tvWidget.onChartReady(() => {
      this.addDefaultIndicators();
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
