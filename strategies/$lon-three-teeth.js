// IAmRich strategy
// v-1
const moment = require('moment');
let _ = require('lodash');
let log = require('../core/log.js');

let bb = require('./indicators/BB.js');
let rsi, RSI = require('./indicators/RSI.js');

let strat = {};
const CandleBatcher = require('../core/candleBatcher');

const SMA = require('../strategies/indicators/SMA.js');
const EMA = require('../strategies/indicators/EMA.js');

let MA = SMA;

strat.init = function() {

  const config = require ('../core/util').getConfig() || {};

  let currentCandle, currentPrice = 0.0, buyPrice = 0.0, advised = false, tradeInitiated = false, buyTs, candlesArr = new Array(10),
    aaatLengh;
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
  this.debug = false;

  // performance
  config.backtest.batchSize = 1000; // increase performance
  config.silent = false;
  config.debug = true;

  this.name = '$lon-IAmRich-1';

  this.requiredHistory = this.tradingAdvisor.historySize;

  // define the indicators we need
  rsi = new RSI({ interval: 14 });
  this.update = function(candle) {
    if(this.debug) {
      // consoleLog(`strat update:: rsi: ${ rsi.result }, rsiJson: ${ JSON.stringify(rsi) }, advised: ${ advised }, tradeInitiated: ${ tradeInitiated }`);
    }

    currentPrice = candle.close;
    currentCandle = candle;
    candlesArr.pop();
    candlesArr.unshift(candle);

    rsi.update(candle);
    rsiVal = rsi.result;
  }

  let rsiVal, longCandle;

  let totalBought = 0, totalSold = 0, totalBoughtAttempts = 0, totalSoldAttempts = 0,
    totalTradesSuccess = 0, totalTradesLongCandleBelowAaat = 0, totalTradesAaatStopLoss = 0, totalHighVolumeCandles = 0;

  let rsiPrev = 0, rsiPrevPrev = 0,
    RSI_LOW = 30, RSI_LOW_CLEAR = 32, RSI_HIGH = 68, RSI_HIGH_CLEAR = 68, RSI_RESET_LOW = 50, RSI_RESET_HIGH = 50, TEETH_DOWN = 3, TEETH_UP = 1,
    rsiUps = [], rsiDowns = [], rsiLowIsInClearedMode = true, rsiHighIsInClearedMode = true;

  RSI_LOW = this.settings.rsi.low;
  RSI_LOW_CLEAR = this.settings.rsi.low_clear;
  RSI_HIGH = this.settings.rsi.high;
  RSI_HIGH_CLEAR = this.settings.rsi.high_clear;
  RSI_RESET_LOW = this.settings.rsi.reset_low;
  RSI_RESET_HIGH = this.settings.rsi.reset_high;
  TEETH_DOWN = this.settings.teeth.down;
  TEETH_UP = this.settings.teeth.up;

  this.check = function(candle) {

    let candlePrev = candlesArr[1];
    if(this.debug) {
      consoleLog(`strat check:: ${ ''
        } candle.close: ${ candle.close }, candle.volume: ${ candle.volume
        // } longCandle.start: ${ JSON.stringify(longCandle && longCandle.start) }, longCandle.close: ${ longCandle.close }, longCandle.volume: ${longCandle.volume
        }, rsiVal: ${ rsiVal
        }, advised: ${ advised }, tradeInitiated: ${ tradeInitiated
      }`);
    }
    if(rsiPrev < RSI_RESET_LOW && rsiVal > RSI_RESET_LOW) {
      rsiDowns = []; // clear on middle cross up
      rsiHighIsInClearedMode = true;
    }
    if(rsiPrev > RSI_RESET_HIGH && rsiVal < RSI_RESET_HIGH) {
      rsiUps = []; // clear on middle cross dn
      rsiLowIsInClearedMode = true;
    }
    if(rsiPrev < RSI_LOW_CLEAR && rsiVal > RSI_LOW_CLEAR) {
      rsiLowIsInClearedMode = true;
    }
    if(rsiPrev > RSI_LOW && rsiVal < RSI_LOW && rsiLowIsInClearedMode) {
      consoleLog('rsiPrev > RSI_LOW && rsiVal < RSI_LOW')
      // low cross to down side
      rsiLowIsInClearedMode = false;
      if(rsiDowns > 5) {
        rsiDowns.pop();
      }
      rsiDowns.unshift({
        time: candle.start,
        candle: candle,
        rsi: rsiVal
      });
    }
    if(rsiPrev > RSI_HIGH_CLEAR && rsiVal < RSI_HIGH_CLEAR) {
      rsiHighIsInClearedMode = true;
    }
    if(rsiPrev < RSI_HIGH && rsiVal > RSI_HIGH && rsiHighIsInClearedMode) {
      consoleLog('rsiPrev < RSI_HIGH && rsiVal > RSI_HIGH')

      // high rsi cross to up side
      rsiHighIsInClearedMode = false;
      if(rsiUps > 5) {
        rsiUps.pop();
      }
      rsiUps.unshift({
        time: candle.start,
        candle: candle,
        rsi: rsiVal
      });
    }
    if(rsiDowns.length >= TEETH_DOWN) {
      consoleLog(`rsiDowns.length > 1!!: ${ JSON.stringify(rsiDowns) }`);
      if(!advised) {
        this.buy(`three teeth buy, rsiVal: ${ rsiVal }, rsiDowns: ${ JSON.stringify(rsiDowns) }`);
      }
    }
    if(rsiUps.length >= TEETH_UP ) {
      consoleLog(`rsiUps.length > 1 || rsiVal > 70!!: ${ JSON.stringify(rsiUps) }`);
      if(advised) {
        this.sell(`two teeth sell, rsiVal: ${ rsiVal }, rsiUps: ${ JSON.stringify(rsiUps) }`);
      }
    }
    // don't forget TP:
    if(advised) {
      if (candle.close >= buyPrice * this.settings.takeProfit) {
        rsiDowns = [ rsiDowns[0] ]; // let's almost reset dips amount (keep last one);
        this.sell(`Take Profit: ${ rsiVal }, buyPrice: ${ buyPrice }`);
      } else if (candle.close <= buyPrice * this.settings.stopLoss) {
        // if (candle.close < aaatStop) {
        // stop loss, urgent sell!
        this.sell(`stop loss: below ${ this.settings.stopLoss }%`);
        totalTradesAaatStopLoss++;
      }
    }
      // цена пересекла зеленую
    if(!advised && rsiVal < 30) {
      // this.buy(`rsi ниже 30, rsiVal: ${ rsiVal }`);
    }
    if (advised && rsiVal > 70) {
      // this.sell(`rsi больше чем 70, rsiVal: ${ rsiVal }`)
    }
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
  }

  this.buy = function(reason, fixedPrice) {
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
      // this.limit = fixedPrice;
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
    consoleLog(`strat check:: candle.close: ${ candle.close }, candle.volume: ${ candle.volume }, rsiVal: ${ rsiVal }, aaatStop: ${ aaatStop }, aaatTrendUp: ${ aaatTrendUp }, bb.lower: ${ bb.lower }, bb.upper: ${ bb.upper }, bb.middle: ${ bb.middle }, advised: ${ advised }, tradeInitiated: ${ tradeInitiated }`);
  }
}

strat.check = function(){
  // gekko stub
}

module.exports = strat;


const isSingleDirectionMoveCandle = function(candle1) {
  let ret;
  if(Math.abs(candle1.high - candle1.low) * 0.7 <= Math.abs(candle1.close - candle1.open)) {
    ret = true;
  } else {
    ret = false;
  }
  return ret;
}

/*

Оптимальные настройки для пар:

BEST:

btc/usdt, 15mo - 51.5%:
takeProfit = 1.01
percentBelowMa = 0.017
bullTrendMa15 = false

eth/usdt, 15mo - 91.19%:
takeProfit = 1.01
percentBelowMa = 0.03
bullTrendMa15 = false

ltc/usdt, 15mo - 67.7%:
takeProfit = 1.01 # take profit when price 0.8% bigger than buy price
percentBelowMa = 0.03 # цена на 1.7% ниже чем оранжевая часовая МА (в расчете на то, что должна к ней вернуться)
bullTrendMa15 = false

ltc/btc, 3mo - 5%:
takeProfit = 1.01
percentBelowMa = 0.017
bullTrendMa15 = true


 */
