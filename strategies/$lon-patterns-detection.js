// MACD Cross
// Created by Ash
// Version 1
//
// https://ru.tradingview.com/script/tDM3U5y7-Renko-MACD-Cross-Strategy/
//


const log = require('../core/log');
const config = require ('../core/util').getConfig();
const DependenciesManager = require('../web/state/dependencyManager');
const TradingView = require('./tools/tradingView');
const CandleBatcher = require('../core/candleBatcher');

const bullishharamicross = require('technicalindicators').bullishharamicross;
const technicalIndicators = require('technicalindicators');

const strat = {}
const CANDLES_ARRAY_SIZE = 100;
const MIN_REQUIRED_LENGTH = 3;


// seal everything into init to have the ability to use local variables unique for each strat instance:
strat.init = function() {
  let currentPrice = 0.0, buyPrice = 0.0, advised = false, tradeInitiated = false, buyTs,
    candlesArr, candlesAdapted;

  // debug? set to false to disable all logging/messages/stats (improves performance in backtests)
  this.debug = false;

  // performance
  config.backtest.batchSize = 1000; // increase performance
  config.silent = true;
  config.debug = false;

  // var drawCandleStick = require('draw-candlestick');
  // var canvas = require('canvas');
  candlesArr = [];
  candlesAdapted = {
    open: [],
    high: [],
    close: [],
    low: [],
    reversedInput: false
  }

  // custom functions:
  const convertCandle = (candle)=> {
    let ret = {
      open: [ candle.open ],
      high: [ candle.high ],
      close: [ candle.close ],
      low: [ candle.low ],
      ts: [ candle.start ]
    }
    return ret;
  }

  const convertArr = (arr)=> {
    arr = arr || [];
    let ret = {
      open: [],
      high: [],
      close: [],
      low: [],
      ts: [],
      reversedInput: false
    };
    arr.forEach(c => {
      ret.open.push(c.open);
      ret.high.push(c.high);
      ret.close.push(c.close);
      ret.low.push(c.low);
      ret.ts.push(c.start);
    });
    return ret;
  }
  const convertData = (candle)=> {
    candlesAdapted.open.push(candle.open);
    candlesAdapted.high.push(candle.high);
    candlesAdapted.close.push(candle.close);
    candlesAdapted.low.push(candle.low);
    if(candlesAdapted.open.length > CANDLES_ARRAY_SIZE) {
      candlesAdapted.open.shift();
      candlesAdapted.high.shift();
      candlesAdapted.close.shift();
      candlesAdapted.low.shift();
    }
    return candlesAdapted;
  }

  // actual Gekko strat functions:
  this.update = function(candle) {
    currentPrice = candle.close;
    candlesArr.push(candle);
    if(candlesArr.length > CANDLES_ARRAY_SIZE) {
      candlesArr.shift();
    }
    convertData(candle);
    // if strat has DEPENDENCIES, notify them:
    // this.notify({
    //   type: 'dependency-...',
    //   reason: 'TREND CHANGE',
    //   data: this.curIndicator
    // });
  }

  this.check = function() {
    // time after last BUY:
    // if ((this.candle.start.diff(buyTs, 'minutes') > this.settings.TIMEOUT)) {
    //
    // }
    // if(!advised) {
    //   // can BUY
    //   this.buy(' ... reason ');
    // } else {
    //   // can SELL
    //   this.sell(' ... reason ');
    // }
    if (candlesAdapted.open.length >= MIN_REQUIRED_LENGTH) {
      let arr1, arr2;
      arr1 = candlesArr.slice(candlesArr.length - 2, candlesArr.length);
      arr2 = convertArr(arr1);
      let result = bullishharamicross(arr2), curCandle, dojiDetected = false;
      if (result) {
        /*curCandle = convertCandle(arr1[1]);
        if (technicalIndicators.doji(curCandle)) {
          technicalIndicators.doji(curCandle)
          dojiDetected = true;
          //console.log(`DOJI detected: ${ JSON.stringify(curCandle) }, arr: ${ JSON.stringify(arr1) }`);

        }*/

        console.log(`INFO: DATE: ${this.candle.start}, Bullish Harami Cross Pattern detected `);

      }
    }
    //hammerpattern
    if (candlesAdapted.open.length >= MIN_REQUIRED_LENGTH) {
      let arr1, arr2;
      arr1 = candlesArr.slice(candlesArr.length - 5, candlesArr.length);
      arr2 = convertArr(arr1);
      let result = technicalIndicators.hammerpattern(arr2), curCandle, dojiDetected = false;
      if (result) {
        console.log(`INFO: DATE: ${this.candle.start}, Hammer detected `);
      }
    }

  }

  this.sell = function(reason) {
    this.notify({
      type: 'sell advice',
      reason: reason,
    });
    this.advice('short');
    advised = false;
    buyPrice = 0;
    if (tradeInitiated) { // Add logic to use other indicators
      tradeInitiated = false;
    }
  }

  this.buy = function(reason) {
    advised = true;
    // If there are no active trades, send signal
    if (!tradeInitiated) { // Add logic to use other indicators
      this.notify({
        type: 'buy advice',
        reason: reason,
      });
      this.advice('long');
      buyTs = this.candle.start;
      buyPrice = currentPrice;
      tradeInitiated = true;
    }
  }
  this.onPendingTrade = function(pendingTrade) {
    tradeInitiated = true;
  }

  this.onTrade = function(trade) {
    tradeInitiated = false;
  }
// Trades that didn't complete with a buy/sell
  this.onTerminatedTrades = function(terminatedTrades) {
    log.info('Trade failed. Reason:', terminatedTrades.reason);
    tradeInitiated = false;
  }

  this.end = function(a, b, c) {
  }
}
strat.check = function(){
  // stub for Gekko
}
module.exports = strat;
