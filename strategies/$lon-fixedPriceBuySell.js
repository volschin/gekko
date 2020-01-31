// IWannaBeRich strategy
//
const moment = require('moment');
var _ = require('lodash');
var log = require('../core/log.js');

var bb = require('./indicators/BB.js');
var rsi = require('./indicators/RSI.js');

let strat = {};

let FIXED_BUY_PRICE, FIXED_SELL_PRICE;
// seal everything into init to have the ability to use local variables unique for each strat instance
// , instead of using 'this.someVar', to optimize performance:
strat.init = function() {

  const config = require ('../core/util').getConfig() || {};

  let currentCandle, currentPrice = 0.0, buyPrice = 0.0, advised = false, tradeInitiated = false, buyTs;

  consoleLog(`strat init, gekkoId: ${ config.gekkoId }, type: ${ config.type }`)

  // debug? set to false to disable all logging/messages/stats (improves performance in backtests)
  this.debug = true;

  // performance
  config.backtest.batchSize = 1000; // increase performance
  config.silent = true;
  config.debug = false;

  this.name = '$lon-IWannaBeRich-BBRSI';
  this.nsamples = 0;
  this.trend = {
    //zone: 'none',  // none, top, high, low, bottom
    duration: 0,
    persisted: false,
    direction: '', //up, down
    adviced: false
    //  max: 0,
    //  min: 0
  };

  this.requiredHistory = this.tradingAdvisor.historySize;

  // set the fixed prices:
  FIXED_BUY_PRICE = this.settings.prices.buy;
  FIXED_SELL_PRICE = this.settings.prices.sell;

  advised = this.settings.firstTradeBuy;

  this.update = function(candle = {}) {
    consoleLog(`strat update:: advised: ${ advised }, tradeInitiated: ${ tradeInitiated }`);

    currentPrice = candle.close;
    currentCandle = candle;
  }

  this.check = function(candle) {

    let price = candle.close;

    if(!tradeInitiated) {
      if(!advised) {
        this.buy('buying for fixed price');
      } else {
        this.sell('selling for fixed price');
      }
    }

    /*consoleLog(`strat check:: price: ${ price }, rsiVal: ${ rsiVal }, this.trend.direction: ${ this.trend.direction }, this.trend.persisted: ${
      this.trend.persisted }, , this.trend.adviced: ${ this.trend.adviced }, advised: ${ advised }, tradeInitiated: ${ tradeInitiated }`);*/

  }

  this.sell = function(reason) {
    consoleLog(`strat.sell:: attempting, tradeInitiated=${ tradeInitiated }`);
    if (!tradeInitiated) { // Add logic to use other indicators
      consoleLog('strat.sell:: run');
      this.notify({
        type: 'sell advice',
        reason: reason,
      });
      consoleLog(reason);
      this.advice({
        direction: 'short',
        limit: FIXED_SELL_PRICE
      });
      advised = false;
      buyPrice = 0;
    }
  }

  this.buy = function(reason) {
    consoleLog(`strat.buy:: attempting, tradeInitiated=${ tradeInitiated }`);
    advised = true;
    // If there are no active trades, send signal
    if (!tradeInitiated) { // Add logic to use other indicators
      consoleLog('strat.sell:: run');
      this.notify({
        type: 'buy advice',
        reason: reason,
      });
      consoleLog(reason);
      this.advice({
        direction: 'long',
        limit: FIXED_BUY_PRICE
      });
      buyTs = this.candle.start;
      buyPrice = currentPrice;
      tradeInitiated = true;
    }
  }
  this.onPendingTrade = function(pendingTrade = {}) {
    tradeInitiated = true;
    consoleLog('onPendingTrade (tradeInitiated = true)');
  }

  this.onTrade = function(trade = {}) {
    tradeInitiated = false;
    buyPrice = trade.price;
    consoleLog(`onTrade:: trade: ${ JSON.stringify(trade) }`);
  }

  // Trades tht didn't complete with a buy/sell (see processTradeErrored in tradingAdvisor)
  this.onTerminatedTrades = function(terminatedTrades = {}) {
    tradeInitiated = false;
    consoleLog('onTerminatedTrades:: Trade failed. Reason: ' + terminatedTrades.reason);
    /*if(terminatedTrades.reason.toUpperCase().indexOf('LOT SIZE TOO SMALL')) {
      advised = !advised; // somethings like this
    }*/
  }

  this.onPortfolioChange = function(portfolio) {
    consoleLog(`onPortfolioChange, portfolio: ${ JSON.stringify(portfolio) }`);
  }
  this.onPortfolioValueChange = function(portfolio) {
  }

  this.end = function(a, b, c) {
    consoleLog('gekko end')
  }
  function consoleLog(msg){
    if(config){
      msg = msg || '';
      currentCandle = currentCandle || {}
      const prefix = `${ config.gekkoId }, ${ JSON.stringify(currentCandle.start) || JSON.stringify(moment()) } -- `;
      console.log(prefix, msg);
      log.debug(prefix, msg);
    }
  }
}

strat.check = function(){
  // gekko stub
}

module.exports = strat;

