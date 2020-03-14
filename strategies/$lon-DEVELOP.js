// MACD Cross
// Created by Ash
// Version 1
//
//


const log = require('../core/log');
const config = require ('../core/util').getConfig();
const moment = require('moment');
const CandleBatcher = require('../core/candleBatcher');

let strat = {};

// seal everything into init to have the ability to use local variables unique for each strat instance
// , instead of using 'this.someVar', to optimize performance:
strat.init = function(options = {}) {
  let startPrice, currentCandle, prevCandle, currentPrice = 0.0, buyPrice = 0.0, advised = false, advisedShort = false, tradeInitiated = false, buyTs
    , tradesCount = 0, tradesMaxCount = 0
    , candlesArr = Array(10).fill({
    open: -1,
    close: -1,
    high: -1,
    low: -1
  });
  let tradesArr = [];
  let TAKE_PROFIT = this.settings.TAKE_PROFIT || 1.05
    , TIMEOUT_MINUTES = this.settings.TIMEOUT_MINUTES || 1440
    , TRAILING_STOP = this.settings.trailingStop || 5;

  const config = require ('../core/util').getConfig() || {};
  // debug? set to false to disable all logging/messages/stats (improves performance in backtests)
  this.debug = true;

  // performance
  config.backtest.batchSize = 1000; // increase performance
  config.silent = false;
  config.debug = true;

  let hadDeal = false;
  if (config.tradingAdvisor.candleSize !== 60) {
    /*throw {
      error: "This strategy must run with candleSize=60"
    };*/
  }

  // AAAT:
  let AAAT = require('./indicators/Adaptive-ATR-ADX-Trend');
  let aaatLenghLow = 1;
  let aaatLenghMedium = 2;
  let aaatLenghHigh = 4;


  let aaatResultLow, aaatResultMedium, aaatResultHigh;
  this.update = function(candle = {}) {
    currentCandle = candle;
    currentPrice = candle.close;
    candlesArr.pop();
    candlesArr.unshift(candle);

    if(this.debug && false) {
      consoleLog(`strat update:: candle.start: ${ JSON.stringify(candle.start) }, advised: ${ advised }, tradeInitiated: ${ tradeInitiated
      }, low: ${ aaatResultLow }, medium: ${ aaatResultMedium }, high: ${ aaatResultHigh }`);
    }

  };

  let aaatTrendUp, aaatTrendUpPrev;
  let buysAmount = 0;
  let totalUptrends = 0, totalDntrends = 0, totalBought = 0, totalSold = 0, totalBoughtAttempts = 0, totalSoldAttempts = 0, totalSellTakeProfit = 0,
    totalTradesSuccess = 0, totalTradesLongCandleBelowAaat = 0, totalTradesHighAboveAaatDnTrendRedMedium = 0, totalTradesHighAboveAaatDnTrendRedHigh = 0,
    totalTradesAaatStopLoss = 0, totalHighVolumeCandles = 0;
  this.check = function(candle) {
    if(this.debug && false) {
      consoleLog(`strat check:: ${ ''
      } candle.close: ${ candle.close
      }`);
    }
    // if(!tradeInitiated) {
      if (!advised && buysAmount < 3) {
        buysAmount++;
        this.buy('test long');
      } else {
        this.sell('test short');
      }
    // }
  };

  this.buy = function(reason, options = {}) {
    this.notify({
      type: 'buy advice',
      reason: reason,
    });
    consoleLog(`buy:: advice: long, margin: ${ !!options.margin }`);
    this.advice({
      limit: options.limitPrice,
      direction: 'long',
      margin: options.margin
      /*trigger: {
        type: 'trailingStop',
        trailPercentage: TRAILING_STOP
      }*/
    });

    buyTs = this.candle.start;
    buyPrice = currentPrice;
    if(options.margin && options.margin.type === 'short') {
      advisedShort = true;
    } else {
      advised = true;
    }
    if(!hadDeal) {
      hadDeal = true; // only set once: strange startAt.unix() bug
    }
  }
  this.sell = function(reason, options = {}) {
    this.notify({
      type: 'sell advice',
      reason: reason,
    });
    consoleLog(`sell:: advice: short, margin: ${ !!options.margin }`);
    this.advice({
      direction: 'short',
      limit: options.limitPrice,
      margin: options.margin
    });
    if(options.margin && options.margin.type === 'short') {
      advisedShort = false;
    } else {
      advised = false;
    }
  }

  this.onPendingTrade = function(pendingTrade) {
    tradeInitiated = true;
  }

  //
  // see https://www.youtube.com/watch?v=lc21W9_zdME
  this.onTrade = function(trade = {}) {
    consoleLog('onTrade:: trade: ' + JSON.stringify(trade.action));
    if(trade.action === 'sell') {
      if(trade.margin && trade.margin.type === 'short') {
        advisedShort = false;
      } else {
        advised = false;
      }
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
    // consoleLog(`onPortfolioValueChange, portfolio: ${ JSON.stringify(portfolio) }`);
  }
  this.onTriggerFired = function(data) {
    // tradeInitiated = false;
    this.notify({
      type: 'sell advice',
      reason: 'trailing stop trigger fired',
    });
    consoleLog(`onTriggerFired, data: ${ JSON.stringify(data) }`);
  }

  this.end = function(a, b, c) {
    consoleLog(`gekko end, trades: ${ JSON.stringify(tradesArr) }`);
    consoleLog(`           total trades: ${ tradesArr.length }`);
    consoleLog(`totalBought: ${ totalBoughtAttempts }`);
    consoleLog(`totalSellTakeProfit: ${ totalSellTakeProfit }`);
    consoleLog(`totalTradesLongCandleBelowAaat: ${ totalTradesLongCandleBelowAaat }`);
    consoleLog(`totalTradesHighAboveAaatDnTrendRedMedium: ${ totalTradesHighAboveAaatDnTrendRedMedium }`);
    consoleLog(`totalTradesHighAboveAaatDnTrendRedHigh: ${ totalTradesHighAboveAaatDnTrendRedHigh }`);
    /*const profitTrades = tradesArr.filter(t=>t.status === 'sold');
    consoleLog(`           closed trades: ${ profitTrades.length }`);
    const openTrades = tradesArr.filter(t=>t.status !== 'sold');
    consoleLog(`           open trades: ${ openTrades.length }`);
    consoleLog(`           startPrice: ${ startPrice }, current price: ${ currentPrice }`);
    let profit = profitTrades.length * ((TAKE_PROFIT - 1) - 0.002) * SINGLE_BET;
    let loss = 0;
    openTrades.forEach(trade => {
      let res = (currentPrice - trade.price) / (trade.price) * SINGLE_BET;
      loss -= res;
    })*/

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
