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

let strat = {};

// seal everything into init to have the ability to use local variables unique for each strat instance
// , instead of using 'this.someVar', to optimize performance:
strat.init = function() {
  let currentPrice = 0.0, buyPrice = 0.0, advised = false, tradeInitiated = false, buyTs;

  // debug? set to false to disable all logging/messages/stats (improves performance in backtests)
  this.debug = false;

  // performance
  config.backtest.batchSize = 1000; // increase performance
  config.silent = true;
  config.debug = false;


  // What happens on every new candle?
  this.update = function(candle) {
    currentPrice = candle.close;

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
  // gekko stub (DO NOT REMOVE!!)
}

module.exports = strat;
