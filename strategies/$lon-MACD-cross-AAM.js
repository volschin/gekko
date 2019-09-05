// MACD Cross
// Created by Ash
// Version 1
//
// https://ru.tradingview.com/script/tDM3U5y7-Renko-MACD-Cross-Strategy/
//

const moment = require('moment');
var log = require('../core/log');
var config = require ('../core/util').getConfig();
const DependenciesManager = require('../web/state/dependencyManager');
const TradingView = require('./tools/tradingView');
const CandleBatcher = require('../core/candleBatcher');

var strat = {};
var buyPrice = 0.0;
var buyTs;
var currentPrice = 0.0;
var advised = false;

let startTs, endTs;
let aaat2DepRes;

// Prepare everything our method needs
strat.init = function() {
  // debug? set to false to disable all logging/messages/stats (improves performance in backtests)
  this.debug = false;

  // performance
  //config.backtest.batchSize = 1000; // increase performance
  config.silent = true;
  config.debug = false;

  // [macdLine, signalLine, _] = macd(close, 12, 26, 9)
  const MACDSettings = {
    short: 12,
    long: 26,
    signal: 9,
  }
  this.addIndicator('macd', 'MACD', MACDSettings);
  // this.addIndicator('macd15', 'MACD', MACDSettings);

  if (!config.dependencyResults || !config.dependencyResults.results) {
    throw 'This strategy must run with dependency "ATR-ADX-Trend-Dep"';
  } else {
    aaat2DepRes = config.dependencyResults.results;
  }

  // create candle batchers for 15 minute candles
  // this.batcher15 = new CandleBatcher(15);
  // this.batcher15.on('candle', this.update15);

  this.tradeInitiated = false;

  startTs = moment();
}
let aaat2, isBullTrendCur = false;
strat.update = function(candle) {

  // this.batcher15.write([candle]);
  // this.batcher15.flush();
  aaat2 = DependenciesManager.getClosestResult(candle.start, aaat2DepRes);
  if(aaat2) {
    if (aaat2.trend > 0) {
      isBullTrendCur = true;
    } else {
      isBullTrendCur = false;
    }
  }
}
strat.update15 = function(candle) {
  this.indicators.macd15.update(candle.close);
  // candle5 = this.batcher5.calculatedCandles[0];
}

let macdLine, macdLine15, macdLinePrev;
let signalLine, signalLine15, signalLinePrev;
strat.check = function() {
  macdLine = this.indicators.macd.diff;
  signalLine = this.indicators.macd.signal.result;
  // console.log(`MACD results (05) -- DATE: ${ this.candle.start }, macdLine: ${ macdLine }, signalLine: ${signalLine}`);
  if(macdLinePrev && signalLinePrev){
    if(!advised && TradingView.crossover([ macdLine, macdLinePrev ], [ signalLine, signalLinePrev ])) {
      console.error(`crossover -- DATE: ${ this.candle.start }, macdLine: ${ macdLine }, signalLine: ${signalLine
        }, macdLinePrev: ${ macdLinePrev }, signalLinePrev: ${signalLinePrev}, `);
      console.log(`aam: ${ JSON.stringify(aaat2) }`)
      this.buy(`crossover`);
    } else if(advised && TradingView.crossunder([ macdLine, macdLinePrev ], [ signalLine, signalLinePrev ])) {
    // } else if(advised && (macdLinePrev - signalLinePrev) > 30 && (macdLine - signalLine) < 30) {
      console.error(`crossunder -- DATE: ${ this.candle.start }, macdLine: ${ macdLine }, signalLine: ${signalLine
        }, macdLinePrev: ${ macdLinePrev }, signalLinePrev: ${signalLinePrev}, `);
      console.log(`aam: ${ JSON.stringify(aaat2) }`)

      this.sell(`crossunder`);
    }
  }

  // macdLine15 = this.indicators.macd15.diff;
  // signalLine15 = this.indicators.macd15.signal.result;
  // console.error(`MACD results (15) -- DATE: ${ this.candle.start }, macd15Line: ${ macdLine15 }, signal15Line: ${ signalLine15 }`);
  // console.error(`MACD15 results -- DATE: ${ this.candle.start }, ${ JSON.stringify(this.indicators.macd15) }`);

  //Entry Condition
  // buy_entry = crossover(macdLine, signalLine)
  // sell_entry = crossunder(macdLine, signalLine)

  // time after last BUY:
  // if ((this.candle.start.diff(buyTs, 'minutes') > this.settings.TIMEOUT)) {
  //
  // }
  // if(!advised) {
  //   // can BUY
  // } else {
  //   // can SELL
  // }
  macdLinePrev = macdLine;
  signalLinePrev = signalLine;
}

strat.sell = function(reason) {
  this.notify({
    type: 'sell advice',
    reason: reason,
  });
  this.advice('short');
  advised = false;
  buyPrice = 0;
  if (this.tradeInitiated) { // Add logic to use other indicators
    this.tradeInitiated = false;
  }
}

strat.buy = function(reason) {
  advised = true;
  // If there are no active trades, send signal
  if (!this.tradeInitiated) { // Add logic to use other indicators
    this.notify({
      type: 'buy advice',
      reason: reason,
    });
    this.advice('long');
    buyTs = this.candle.start;
    buyPrice = currentPrice;
    this.tradeInitiated = true;
  }
}
strat.onPendingTrade = function(pendingTrade) {
  this.tradeInitiated = true;
}

strat.onTrade = function(trade) {
  this.tradeInitiated = false;
}
// Trades that didn't complete with a buy/sell
strat.onTerminatedTrades = function(terminatedTrades) {
  log.info('Trade failed. Reason:', terminatedTrades.reason);
  this.tradeInitiated = false;
}

strat.end = function(a, b, c) {
  endTs = moment();

  console.error(`End. Milliseconds took: ${ endTs.diff(startTs, 'milliseconds') }`);
}

module.exports = strat;
