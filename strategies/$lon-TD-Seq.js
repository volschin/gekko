// MACD Cross
// Created by Ash
// Version 1
//
// https://ru.tradingview.com/script/tDM3U5y7-Renko-MACD-Cross-Strategy/
//


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

  this.addIndicator('tdm_seq', 'TD-Sequential', {
    debug: false
  });

  this.tradeInitiated = false;
}

// What happens on every new candle?
strat.update = function(candle) {
  this.currentPrice = candle.close;

  // if strat has DEPENDENCIES, notify them:
  // this.notify({
  //   type: 'dependency-...',
  //   reason: 'TREND CHANGE',
  //   data: curIndicator
  // });
  this.indicators.tdm_seq.update(candle);

}
const TAKE_PRIFIT_EXIT_COEF = 1.005;
const STOPLOSS_EXIT_COEF = 0.99;
const TIMEOUT_EXIT_MINUTES = 120;
strat.check = function() {
  // time after last BUY:
  // if ((this.candle.start.diff(buyTs, 'minutes') > this.settings.TIMEOUT)) {
  //
  // }
  let seqBuy = this.indicators.tdm_seq.result;

  // console.error(`seqBuy: ${JSON.stringify(this.indicators.tdm_seq)}`);
  if(!this.advised && this.indicators.tdm_seq.isSetupBuy) {
  // if(!this.advised && this.indicators.tdm_seq.isPerfectSetupBuy) {
    // can BUY
    this.buy('td seq buy');

  } else if(this.advised && (
      this.indicators.tdm_seq.isSetupSell
      || this.indicators.tdm_seq.isPerfectSetupSell
      // this.currentPrice >= this.buyPrice * TAKE_PRIFIT_EXIT_COEF
      // || this.candle.start.diff(this.buyTs, 'minutes') > TIMEOUT_EXIT_MINUTES
      // || this.currentPrice <= this.buyPrice * STOPLOSS_EXIT_COEF
  )) {
    // can SELL
    this.sell('td seq sell');
  }
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
