// ADX+DMI Trading
// Created by Ash
// Version 1
//
// ADX is used for:
// 1. Excellent at quantifying TREND STRENGTH
// 2. Good at FILTERING OUT TRADES during accumulation periods
// 3. Good at identifying TRENDING CONDITIONS
// 4. Allows traders to see the STRENGTH OF BULLS AND BEARS

// https://www.youtube.com/watch?v=4rn1vw3kGuU&t=22s
//
// ADX > 25 - trending, < 25 - no trend zone
// DI+ > DI bulls, DI+ < DI- - bears
// DI+ > DI- && ADX > 25 - uptrend
// DI+ < DI- && ADX > 25 - downtrend

// ADX > 50 - very strong trend!!

const log = require('../core/log');
const config = require ('../core/util').getConfig();

let strat = {};

// Prepare everything our method needs
strat.init = function() {
  this.currentPrice = 0.0;
  this.buyPrice = 0.0;
  this.advised = false;

  // debug? set to false to disable all logging/messages/stats (improves performance in backtests)
  this.debug = false;

  // performance
  config.backtest.batchSize = 1000; // increase performance
  config.silent = true;
  config.debug = false;


  this.tradeInitiated = false;
}

// What happens on every new candle?
strat.update = function(candle) {
  this.currentPrice = candle.close;

  // if strat has DEPENDENCIES, notify them:
  // this.notify({
  //   type: 'dependency-...',
  //   reason: 'TREND CHANGE',
  //   data: this.curIndicator
  // });
}

strat.check = function() {
  // time after last BUY:
  // if ((this.candle.start.diff(this.buyTs, 'minutes') > this.settings.TIMEOUT)) {
  //
  // }
  // if(!this.advised) {
  //   // can BUY
  //   this.buy(' ... reason ');
  // } else {
  //   // can SELL
  //   this.sell(' ... reason ');
  // }
}

strat.sell = function(reason) {
  this.notify({
    type: 'sell advice',
    reason: reason,
  });
  this.advice('short');
  this.advised = false;
  this.buyPrice = 0;
  if (this.tradeInitiated) { // Add logic to use other indicators
    this.tradeInitiated = false;
  }
}

strat.buy = function(reason) {
  this.advised = true;
  // If there are no active trades, send signal
  if (!this.tradeInitiated) { // Add logic to use other indicators
    this.notify({
      type: 'buy advice',
      reason: reason,
    });
    this.advice('long');
    this.buyTs = this.candle.start;
    this.buyPrice = this.currentPrice;
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
}

module.exports = strat;
