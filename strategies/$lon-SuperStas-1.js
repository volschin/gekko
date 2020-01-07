// IAmRich strategy
// v-1
const moment = require('moment');
let _ = require('lodash');
let log = require('../core/log.js');

let bb = require('./indicators/BB.js');
let rsi = require('./indicators/RSI.js');

let strat = {};
const CandleBatcher = require('../core/candleBatcher');
const CandleHelper = require('./tools/candleHelper');

const SMA = require('../strategies/indicators/SMA.js');
const EMA = require('../strategies/indicators/EMA.js');

let MA = SMA;

strat.init = function() {
  const config = require ('../core/util').getConfig() || {};
  if (config.tradingAdvisor.candleSize === 15) {
    log.remote('This strategy must run with candleSize=15');
    // throw "This strategy must run with candleSize=15";
  }
  let currentCandle, currentPrice = 0.0, buyPrice = 0.0, advised = false, tradeInitiated = false, buyTs
    , candlesArr = Array(this.settings.extremumRange || 10).fill({
    open: -1,
    close: -1,
    high: -1,
    low: -1
  }), aaatLengh;

  consoleLog(`strat init, gekkoId: ${ config.gekkoId }, type: ${ config.type }`)

  // debug? set to false to disable all logging/messages/stats (improves performance in backtests)
  this.debug = false;

  // performance
  config.backtest.batchSize = 1000; // increase performance
  config.silent = false;
  config.debug = true;

  this.name = '$lon-IAmRich-1';

  this.requiredHistory = this.tradingAdvisor.historySize;

  // define the indicators we need
  this.addIndicator('rsi', 'RSI', this.settings.rsi || 14);

  let shortMA60 = new MA(21);
  let middleMA60 = new MA(100);
  let longMA60 = new MA(200);
  let impulseCandle;
  this.update = function(candle) {
    if(this.debug) {
      // consoleLog(`strat update:: advised: ${ advised }, tradeInitiated: ${ tradeInitiated }`);
    }

    currentPrice = candle.close;
    currentCandle = candle;
    candlesArr.pop();
    candlesArr.unshift(candle);

    bb = this.indicators.bb; //bb: upper, middle, lower
    rsi = this.indicators.rsi;
    rsiVal = rsi.result;

    // shortMA15.update(candle.close);
    // middleMA15.update(candle.close);
    // longMA15.update(candle.close);
  };

  let bb, rsi, rsiVal;

  this.check = function(candle) {
    let candlePrev = candlesArr[1], hasImpulseBefore = false, hasImpulse = false;

    if(this.debug) {
      consoleLog(`strat check:: candle.close: ${ candle.close }, candle.volume: ${ candle.volume }, ma.short: ${ shortMA60.result }, ma.middle: ${ middleMA60.result }, ma.long: ${ longMA60.result }, rsiVal: ${ rsiVal }, aaatStop: ${ aaatStop }, aaatTrendUp: ${ aaatTrendUp }, bb.lower: ${ bb.lower }, bb.upper: ${ bb.upper }, bb.middle: ${ bb.middle }, advised: ${ advised }, tradeInitiated: ${ tradeInitiated }`);
    }
    if(advised) {
      //1 - tpFibLevel = 0.618
      if(candle.close > impulseCandle.low + ((buyPrice - impulseCandle.low) * 2 * (1 - this.settings.tpFibLevel))){
        this.sell();
      }
    }
    if(CandleHelper.isVolchokCandle({ candle })) {
      candle.isVolchok = true;

      for(let i = 1; i < this.settings.maxCandlesBetweenImpulseAndVolchok + 1; i++){
        if(CandleHelper.isImpulseCandle({ candle: candlesArr[i], candlesArr, absDiff: 100, extremumRange: this.settings.extremumCandlesAmount || 10 })){
          hasImpulse = true;
          impulseCandle = candlesArr[i];
        }
      }
      if(!advised && hasImpulse) {
        this.buy('isVolchok');
      }

      // hasImpulseBefore = !!candlesArr.slice(0, this.settings.maxCandlesBetweenImpulseAndVolchok || 3).find(c => !!c.isImpulse);
      // if(hasImpulseBefore) {
      //   this.buy('isVolchok');
      // }
    }

  };

  this.sell = function(reason) {
    consoleLog(`strat.sell:: attempting, tradeInitiated=${ tradeInitiated }`);
    totalSoldAttempts ++;
    if (!tradeInitiated) { // Add logic to use other indicators
      consoleLog(`strat.sell:: called, reason: ${ reason }`);
      this.notify({
        type: 'sell advice',
        reason: reason,
      });
      this.advice('short');
      advised = false;
      if(currentPrice > buyPrice * 1.002) {
        totalTradesSuccess++;
      }
      buyPrice = 0;
      totalSold ++;
    }
  };

  this.buy = function(reason) {
    consoleLog(`strat.buy:: attempting, tradeInitiated=${ tradeInitiated }`);
    totalBoughtAttempts++;
    advised = true;
    // If there are no active trades, send signal
    if (!tradeInitiated) { // Add logic to use other indicators
      consoleLog(`strat.buy:: called, reason: ${ reason }`);
      this.notify({
        type: 'buy advice',
        reason: reason,
      });
      this.advice('long');
      buyTs = this.candle.start;
      buyPrice = currentPrice;
      tradeInitiated = true;
      totalBought++;
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
  }

  this.onPortfolioChange = function(portfolio) {
    consoleLog(`onPortfolioChange, portfolio: ${ JSON.stringify(portfolio) }`);
  }
  this.onPortfolioValueChange = function(portfolio) {
    // consoleLog(`onPortfolioValueChange, portfolio: ${ JSON.stringify(portfolio) }`);
  }
  this.onTriggerFired = function(data) {
    consoleLog(`onTriggerFired, caused by trailing stop, data: ${ JSON.stringify(data) }`);
  }

  let totalUptrends = 0, totalBought = 0, totalSold = 0, totalBoughtAttempts = 0, totalSoldAttempts = 0,
    totalTradesSuccess = 0, totalTradesAaatStopLoss = 0, totalHighVolumeCandles = 0;
  this.end = function(a, b, c) {
    consoleLog('gekko end')
    console.error('gekko end, here is some statistics for you Sir:')
    console.error(`totalUptrends: ${ totalUptrends }, totalBought: ${ totalBought } (out of ${ totalBoughtAttempts } attempts), totalSold: ${ totalSold
      } (out of ${ totalSoldAttempts } attempts), statsTotalTradesSuccess: ${ totalTradesSuccess }, totalTradesAaatStopLoss: ${ totalTradesAaatStopLoss
    }, totalHighVolumeCandles: ${ totalHighVolumeCandles }`);

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
  const printCandle = function(candle) {
    consoleLog(`strat check:: candle.close: ${ candle.close }, candle.volume: ${ candle.volume }, rsiVal: ${ rsiVal }, aaatStop: ${ aaatStop }, aaatTrendUp: ${ aaatTrendUp }, bb.lower: ${ bb.lower }, bb.upper: ${ bb.upper }, bb.middle: ${ bb.middle }, advised: ${ advised }, tradeInitiated: ${ tradeInitiated }`);
  }
}

strat.check = function(){
  // gekko stub
}

module.exports = strat;


