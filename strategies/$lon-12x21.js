// IAmRich strategy
// v-1
const moment = require('moment');
let _ = require('lodash');
let log = require('../core/log.js');

let bb = require('./indicators/BB.js');
let rsi, RSI = require('./indicators/RSI.js');

let strat = {};
const CandleBatcher = require('../core/candleBatcher');

const MA = require('../strategies/indicators/SMA.js');

strat.init = function() {

  const config = require ('../core/util').getConfig() || {};

  let currentCandle, currentPrice = 0.0, buyPrice = 0.0, advised = false, tradeInitiated = false, buyTs, candlesArr = new Array(10)
    , maLengh;
  candlesArr.forEach(candle => {
    candle = {
      open: -1,
      close: -1,
      high: -1,
      low: -1
    }
  })

  consoleLog(`strat init, gekkoId: ${ config.gekkoId }, type: ${ config.type }`)

  // debug? set to false to disable all logging/messages/stats (improves performance in backtests)
  this.debug = true;

  // performance
  config.backtest.batchSize = 1000; // increase performance
  config.silent = false;
  config.debug = true;

  this.name = '$lon-12x21';

  this.requiredHistory = this.tradingAdvisor.historySize;

  // define the indicators we need
  rsi = new RSI({ interval: 14 });
  maLengh = this.settings.MA.length || 252; // 1day, 12 days
  // create candle batchers for N minute candles, where N = lengthMultiplyer
  // let batcherMa = new CandleBatcher(maLengh);
  let MA252 = new MA(maLengh);

  /*this.update12 = function(candle) {
    if(this.debug) {
      consoleLog(`strat updateAaat:: candle: ${JSON.stringify(candle)}`);
    }
    batcherMa.update(candle.close);
  }
  batcherMa.on('candle', this.update12);*/
  this.update = function(candle) {
    if(this.debug) {
      consoleLog(`strat update:: advised: ${ advised }, tradeInitiated: ${ tradeInitiated }, rsi: ${ rsi.result }, rsiJson: ${ JSON.stringify(rsi) }`);
    }

    currentPrice = candle.close;
    currentCandle = candle;
    candlesArr.pop();
    candlesArr.unshift(candle);

    rsi.update(candle);
    rsiVal = rsi.result;

    MA252.update(candle.close);

    /*batcherMa.write([candle]);
    batcherMa.flush();*/
  }

  let rsiVal;

  let totalBought = 0, totalSold = 0, totalBoughtAttempts = 0, totalSoldAttempts = 0,
    totalTradesSuccess = 0, totalTradesLongCandleBelowAaat = 0, totalTradesAaatStopLoss = 0, totalHighVolumeCandles = 0;

  let rsiPrev = 0, rsiPrevPrev = 0;

  // RSI_LOW = this.settings.rsi.low;
  // RSI_HIGH = this.settings.rsi.high;

  this.check = function(candle) {

    let candlePrev = candlesArr[1];
    if(this.debug) {
      consoleLog(`strat check:: ${ ''
        } candle.close: ${ candle.close }, candle.volume: ${ candle.volume
        // } longCandle.start: ${ JSON.stringify(longCandle && longCandle.start) }, longCandle.close: ${ longCandle.close }, longCandle.volume: ${longCandle.volume
        }, MA252: ${ JSON.stringify(MA252)
        }, advised: ${ advised }, tradeInitiated: ${ tradeInitiated
      }`);
    }

    if(candle.close > MA252.result && candlePrev.close < MA252.result) {
      consoleLog(`ma252 cross UP:: candle: ${ JSON.stringify(candle)}, ma: ${MA252.result} `);
      if(!advised) {
        this.buy('ma252 cross UP')
      }
    }
    if(candle.close < MA252.result && candlePrev.close > MA252.result) {
      consoleLog(`ma252 cross DOWN:: candle: ${ JSON.stringify(candle)}, ma: ${MA252.result} `);
      if(advised) {
        this.sell('ma252 cross DN')
      }
    }
    /*if(advised) {
      if (candle.close >= buyPrice * this.settings.takeProfit) {
        this.sell(`Take Profit: ${ rsiVal }, buyPrice: ${ buyPrice }`);
      } else if (candle.close <= buyPrice * this.settings.stopLoss) {
        // if (candle.close < aaatStop) {
        // stop loss, urgent sell!
        this.sell(`stop loss: below ${ this.settings.stopLoss }%`);
        totalTradesAaatStopLoss++;
      }
    }*/

    rsiPrev = rsiVal;
    rsiPrevPrev = rsiPrev;
  }
  this.end = function(a, b, c) {
    consoleLog('gekko end')
    console.error('gekko end, here is some statistics for you Sir:')
    console.error(`totalBought: ${ totalBought } (out of ${ totalBoughtAttempts
    } attempts), totalSold: ${ totalSold
    } (out of ${ totalSoldAttempts
    } attempts), statsTotalTradesSuccess: ${ totalTradesSuccess
    }, totalTradesLongCandleBelowAaat: ${ totalTradesLongCandleBelowAaat
    }, totalTradesAaatStopLoss: ${ totalTradesAaatStopLoss
      // }, totalHighVolumeCandles: ${ totalHighVolumeCandles
    }`);

  };
  this.sell = function(reason) {
    consoleLog(`strat.sell:: attempting, tradeInitiated=${ tradeInitiated }`);
    totalSoldAttempts ++;
    if (!tradeInitiated) {
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
  }

  this.buy = function(reason) {
    consoleLog(`strat.buy:: attempting, tradeInitiated=${ tradeInitiated }`);
    totalBoughtAttempts++;
    advised = true;
    if (!tradeInitiated) {
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
    // consoleLog(`onPortfolioChange, portfolio: ${ JSON.stringify(portfolio) }`);
  }
  this.onPortfolioValueChange = function(portfolio) {
    // consoleLog(`onPortfolioValueChange, portfolio: ${ JSON.stringify(portfolio) }`);
  }
  this.onTriggerFired = function(data) {
    // consoleLog(`onTriggerFired, caused by trailing stop, data: ${ JSON.stringify(data) }`);
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
    consoleLog(`strat check:: candle.close: ${ candle.close }, candle.volume: ${ candle.volume }, rsiVal: ${
      rsiVal }, advised: ${ advised }, tradeInitiated: ${ tradeInitiated }`);
  }
}

strat.check = function(){
  // gekko stub
}

module.exports = strat;
