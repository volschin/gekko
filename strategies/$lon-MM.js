// MACD Cross
// Created by Ash
// Version 1
//
//


const log = require('../core/log');
const config = require ('../core/util').getConfig();
const TradingView = require('./tools/tradingView');
const CandleBatcher = require('../core/candleBatcher');
const moment = require('moment');

let strat = {};

// seal everything into init to have the ability to use local variables unique for each strat instance
// , instead of using 'this.someVar', to optimize performance:
strat.init = function() {
  let startPrice, currentCandle, currentPrice = 0.0, buyPrice = 0.0, advised = false, tradeInitiated = false, buyTs, tradesCount = 0, tradesMaxCount = 0;
  let tradesArr = [];
  let UNDERVALUE = this.settings.UNDERVALUE || 0.94, THRESHOLD = this.settings.THRESHOLD, TAKE_PROFIT = this.settings.TAKE_PROFIT || 1.05,
    TIMEOUT_MINUTES = this.settings.TIMEOUT_MINUTES || 1440, TRAILING_STOP = this.settings.trailingStop || 5;
  const SINGLE_BET = 100; // 1%
  // const UNDERVALUE = 0.99, TAKE_PROFIT = 1.01, MIN_TIMEOUT_MINUTES = 1, SINGLE_BET = 10; // 1% // 15min

  // debug? set to false to disable all logging/messages/stats (improves performance in backtests)
  this.debug = true;

  // performance
  config.backtest.batchSize = 1000; // increase performance
  config.silent = false;
  config.debug = true;

  this.addIndicator('mm', '$lon-mayer-multiple', {
    length: 200,
    threshold: THRESHOLD,
    undervalue: UNDERVALUE
  });
  let hadDeal = false;

  // What happens on every new candle?
  this.update = function(candle = {}) {
    // consoleLog(`strat update:: mmResult: ${ this.indicators.mm.result }, advised: ${ advised }, tradeInitiated: ${ tradeInitiated }`);

    if(!startPrice) startPrice = candle.close;
    currentPrice = candle.close;
    currentCandle = candle;

    // if strat has DEPENDENCIES, notify them:
    // this.notify({
    //   type: 'dependency-...',
    //   reason: 'TREND CHANGE',
    //   data: this.curIndicator
    // });
  }

  this.check = function() {
    let time = JSON.stringify(this.candle.start);
    let mmResult = this.indicators.mm.result;
    let mmAdvice = this.indicators.mm.advice;
    let reason;
    if( mmResult < UNDERVALUE ) {
      tradesCount ++;
      if(this.settings.isAccumulative ? true: !advised) {
        this.buy('mm less than 0.99');
      }
    } else {
      if(tradesCount > tradesMaxCount) tradesMaxCount = tradesCount;
      tradesCount = 0;
    }
    reason = '';
    if(mmResult < UNDERVALUE) {
      consoleLog(`mmResult < ${ UNDERVALUE } ( ${ mmResult })`);
    }
    if(mmResult > THRESHOLD) {
      consoleLog(`mmResult > ${ THRESHOLD } ( ${ mmResult })`);
    }
    if (this.settings.isAccumulative ? !hadDeal: !advised) return;
    // if (!advised) return;
    if(this.candle.close > buyPrice * TAKE_PROFIT) {
      reason = 'take profit';
      this.sell(reason);
    } else if(mmResult > THRESHOLD) {
      reason = 'mm sell';
      this.sell(reason);
    } else if (this.candle.start.diff(buyTs, 'minutes') > TIMEOUT_MINUTES) {
      reason = 'timeout sell';
      this.sell(reason);
    }
    // });
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

  this.buy = function(reason) {
    this.notify({
      type: 'buy advice',
      reason: reason,
    });
    consoleLog('buy:: advice: long');

    this.advice({
      direction: 'long',
      trigger: {
        type: 'trailingStop',
        trailPercentage: TRAILING_STOP
      }
    });

    buyTs = this.candle.start;
    buyPrice = currentPrice;
    advised = true;
    if(!hadDeal) {
      hadDeal = true; // only set once: strange startAt.unix() bug
    }
  }
  this.sell = function(reason) {
    this.notify({
      type: 'sell advice',
      reason: reason,
    });
    consoleLog('sell:: advice: short');
    this.advice('short');
    advised = false;
  }

  this.onPendingTrade = function(pendingTrade) {
    tradeInitiated = true;
  }

  //
  // see https://www.youtube.com/watch?v=lc21W9_zdME
  this.onTrade = function(trade = {}) {
    consoleLog('onTrade:: trade: ' + JSON.stringify(trade.action));
    if(trade.action === 'sell') {
      advised = false;
    }
    tradeInitiated = false;
  }
  // Trades tht didn't complete with a buy/sell (see processTradeErrored in tradingAdvisor)
  this.onTerminatedTrades = function(terminatedTrades = {}) {
    tradeInitiated = false;
    consoleLog('onTerminatedTrades:: Trade failed. Reason: ' + terminatedTrades.reason);
  }

  this.onPortfolioChange = function(portfolio) {
    // consoleLog(`onPortfolioChange, portfolio: ${ JSON.stringify(portfolio) }`);
  }
  this.onPortfolioValueChange = function(portfolio) {
    //consoleLog(`onPortfolioValueChange, portfolio: ${ JSON.stringify(portfolio) }`);
  }
  this.onTriggerFired = function(data) {
    // tradeInitiated = false;

    consoleLog(`onTriggerFired, data: ${ JSON.stringify(data) }`);
  }

  this.end = function(a, b, c) {
    // consoleLog(`gekko end, trades: ${ JSON.stringify(tradesArr) }`);
    // consoleLog(`           total trades: ${ tradesArr.length }`);
    // const profitTrades = tradesArr.filter(t=>t.status === 'sold');
    // consoleLog(`           closed trades: ${ profitTrades.length }`);
    // const openTrades = tradesArr.filter(t=>t.status !== 'sold');
    // consoleLog(`           open trades: ${ openTrades.length }`);
    // consoleLog(`           startPrice: ${ startPrice }, current price: ${ currentPrice }`);
    // let profit = profitTrades.length * ((TAKE_PROFIT - 1) - 0.002) * SINGLE_BET;
    // let loss = 0;
    // openTrades.forEach(trade => {
    //   let res = (currentPrice - trade.price) / (trade.price) * SINGLE_BET;
    //   loss -= res;
    // })
    //
    // consoleLog(`  profit: ${ profit }$, loss: ${ loss }$, result: ${ profit - loss }$, capital: ${ SINGLE_BET * tradesArr.length }, tradesMaxCount: ${ tradesMaxCount }`);

  }
  function consoleLog(msg = ''){
    if(config){
      currentCandle = currentCandle || {}
      const prefix = `${ config.gekkoId }, ${ JSON.stringify(currentCandle.start) || JSON.stringify(moment()) } -- `;
      console.log(prefix, msg);
      //log.debug(prefix, msg);
    }
  }
}

strat.check = function(){
  // gekko stub (DO NOT REMOVE!!)
}

module.exports = strat;
