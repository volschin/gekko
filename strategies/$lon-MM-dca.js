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
  let UNDERVALUE = this.settings.UNDERVALUE || 0.94, THRESHOLD = this.settings.THRESHOLD, TAKE_PROFIT = this.settings.TAKE_PROFIT || 1.05;
  const MIN_TIMEOUT_MINUTES = 1, SINGLE_BET = 100; // 1%
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


  // What happens on every new candle?
  this.update = function(candle = {}) {
    this.indicators.mm.update(candle);

    //consoleLog(`strat update:: advised: ${ advised }, tradeInitiated: ${ tradeInitiated }`);

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
      // console.log(`ALL INFO: ${ time }, mmResult: ${ mmResult }, mmAdvice: ${ mmAdvice }`);
      this.buy({
        advice: {
          direction: 'long', // or short
          reason: 'blabla',
          dca: {
            amount: SINGLE_BET,
            isPercent: false
          }
        },
        reason: 'mm less than 0.99'
      });
    } else {
      if(tradesCount > tradesMaxCount) tradesMaxCount = tradesCount;
      tradesCount = 0;
      tradesArr.filter(t=>t.status !== 'sold').forEach(trade => {
        reason = '';
        if (!trade) return;
        const buyTs = trade.ts;
        if (this.candle.start.diff(buyTs, 'minutes') > MIN_TIMEOUT_MINUTES) {
          if(this.candle.close > trade.price * TAKE_PROFIT) {
            reason = 'take profit';
            this.sell({
              trade,
              reason
            });
          }
        }

      });
      // search trades, that can be sold:
    }

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

  this.buy = function({ advice, reason }) {
    this.notify({
      type: 'buy advice',
      reason: reason,
    });

    // this.advice('long');
    // this.advice(advice);

    // buyTs = this.candle.start;
    // buyPrice = currentPrice;
    // tradeInitiated = true;
    tradesArr.push({
      status: 'bought',
      advice,
      reason,
      amount: advice.dca.amount,
      ts: this.candle.start,
      price: currentPrice,
      tradeInitiated: true
      // amount:
    });
  }
  this.sell = function({ trade, reason }) {
    if(!trade) return;
    const advice = trade.advice;

    this.notify({
      type: 'sell advice',
      reason: reason,
    });

    // this.advice(advice);
    // this.advice('short');

    // find the trade..
    trade.status = 'sold';
    trade.soldPrice = currentPrice;
    trade.tradeInitiated = false;
    // trade.amount = null;

/*    if (tradeInitiated) { // Add logic to use other indicators
      tradeInitiated = false;
    }*/
  }

  this.onPendingTrade = function(pendingTrade) {
    tradeInitiated = true;
  }

  //
  // see https://www.youtube.com/watch?v=lc21W9_zdME
  this.onTrade = function(trade = {}) {
    tradeInitiated = false;
  }
  // Trades tht didn't complete with a buy/sell (see processTradeErrored in tradingAdvisor)
  this.onTerminatedTrades = function(terminatedTrades = {}) {
    tradeInitiated = false;
    consoleLog('onTerminatedTrades:: Trade failed. Reason: ' + terminatedTrades.reason);
  }

  this.onPortfolioChange = function(portfolio) {
    consoleLog(`onPortfolioChange, portfolio: ${ JSON.stringify(portfolio) }`);
  }
  this.onPortfolioValueChange = function(portfolio) {
    //consoleLog(`onPortfolioValueChange, portfolio: ${ JSON.stringify(portfolio) }`);
  }

  this.end = function(a, b, c) {
    consoleLog(`gekko end, trades: ${ JSON.stringify(tradesArr) }`);
    consoleLog(`           total trades: ${ tradesArr.length }`);
    const profitTrades = tradesArr.filter(t=>t.status === 'sold');
    consoleLog(`           closed trades: ${ profitTrades.length }`);
    const openTrades = tradesArr.filter(t=>t.status !== 'sold');
    consoleLog(`           open trades: ${ openTrades.length }`);
    consoleLog(`           startPrice: ${ startPrice }, current price: ${ currentPrice }`);
    let profit = 0;
    profitTrades.forEach(trade => {
      let res = ((trade.soldPrice - trade.price) / trade.price) * trade.amount;
      profit += res;
    })
    let loss = 0;
    openTrades.forEach(trade => {
      let res = ((currentPrice - trade.price) / trade.price) * trade.amount;
      loss -= res;
    })

    consoleLog(`  profit: ${ profit }$, loss: ${ loss }$, result: ${ profit - loss }$, capital: ${ SINGLE_BET * tradesArr.length }, tradesMaxCount: ${ tradesMaxCount }`);

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
