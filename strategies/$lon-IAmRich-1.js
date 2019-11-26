// IAmRich strategy
// v-1
const moment = require('moment');
let _ = require('lodash');
let log = require('../core/log.js');

let bb = require('./indicators/BB.js');
let rsi = require('./indicators/RSI.js');

let strat = {};
const CandleBatcher = require('../core/candleBatcher');

const SMA = require('../strategies/indicators/SMA.js');
const EMA = require('../strategies/indicators/EMA.js');

let MA = SMA;

strat.init = function() {

  const config = require ('../core/util').getConfig() || {};
  if (config.tradingAdvisor.candleSize === 15) {
    log.remote('This strategy must run with candleSize=15');
    // throw "This strategy must run with candleSize=15";
  }
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
  this.addIndicator('bb', 'BBANDS', this.settings.bbands);
  this.addIndicator('rsi', 'RSI', this.settings.rsi);

  let shortMA15 = new MA(21);
  let middleMA15 = new MA(100);
  let longMA15 = new MA(200);

  let shortMA60 = new MA(21);
  let middleMA60 = new MA(100);
  let longMA60 = new MA(200);
  let hadTrade = false;

  let AAAT = require('./indicators/Adaptive-ATR-ADX-Trend');
  aaatLengh = this.settings.aaat.lengthMultiplyer || 4;
  // create candle batchers for N minute candles, where N = lengthMultiplyer
  let batcherAaat = new CandleBatcher(aaatLengh);
  let aaatInd = new AAAT({
    debug: false,
    useHeiken: this.settings.aaat.USE_HEIKEN
  });

  this.update60 = function(candle) {
    if(this.debug) {
      consoleLog(`strat updateAaat:: candle: ${JSON.stringify(candle)}`);
    }
    aaatInd.update(candle);

    // MAs:
    shortMA60.update(candle.close);
    middleMA60.update(candle.close);
    longMA60.update(candle.close);
  }
  batcherAaat.on('candle', this.update60);

  this.update = function(candle) {
    if(this.debug) {
      // consoleLog(`strat update:: advised: ${ advised }, tradeInitiated: ${ tradeInitiated }`);
    }

    currentPrice = candle.close;
    currentCandle = candle;
    candlesArr.pop();
    candlesArr.unshift(candle);

    batcherAaat.write([candle]);
    batcherAaat.flush();

    bb = this.indicators.bb; //bb: upper, middle, lower
    rsi = this.indicators.rsi;
    rsiVal = rsi.result;
    aaatTrendUp = aaatInd.result.trend === 1;
    aaatStop = aaatInd.result.stop;

    shortMA15.update(candle.close);
    middleMA15.update(candle.close);
    longMA15.update(candle.close);
  }

  let aaatTrendUp, aaatTrendUpPrev, aaatStop, bb, rsi, rsiVal;

  this.check = function(candle) {

    //aaat: {"trend":-1,"stop":8138.549080000001,"trendChange":0}
    let candlePrev = candlesArr[1];
    if(this.debug) {
      // consoleLog(`strat check:: price: ${ price }, aaat: ${ JSON.stringify(aaat) }`);
      consoleLog(`strat check:: candle.close: ${ candle.close }, candle.volume: ${ candle.volume }, ma.short: ${ shortMA60.result }, ma.middle: ${ middleMA60.result }, ma.long: ${ longMA60.result }, rsiVal: ${ rsiVal }, aaatStop: ${ aaatStop }, aaatTrendUp: ${ aaatTrendUp }, bb.lower: ${ bb.lower }, bb.upper: ${ bb.upper }, bb.middle: ${ bb.middle }, advised: ${ advised }, tradeInitiated: ${ tradeInitiated }`);
    }

    if(aaatTrendUp) {
      if(candlePrev.volume > 1000 && candlePrev.close > candlePrev.open && isSingleDirectionMoveCandle(candlePrev)) {
        // console.error('взмыла, можно продавать: '+ JSON.stringify(candlePrev));
        //
        totalHighVolumeCandles++;
        candlePrev.isHighVolumeUp = true;
      }
      if(candlePrev.volume > 1500 && candlePrev.close < candlePrev.open && isSingleDirectionMoveCandle(candlePrev)) {
        // console.error('упала, можно покупать: '+ JSON.stringify(candlePrev))
        totalHighVolumeCandles++;
        candlePrev.isHighVolumeDown = true;
      }

      if(!advised) {
        if (candle.close <= bb.lower && rsiVal <= this.settings.rsi.low && candle.close > aaatStop) {
          //this.buy('bb-rsi trending up');
        }
        // цена на n% ниже чем оранжевая часовая МА (в рассчете на то, что должна к ней вернуться)
        if(candle.close < shortMA60.result && ((shortMA60.result - candle.close) / candle.close) > this.settings.percentBelowMa) {
          if(candle.close < middleMA60.result || candle.close < longMA60.result) {
            if(this.settings.bullTrendMa15 ? middleMA15.result > longMA15.result: true) {
              this.buy('цена на n% ниже чем оранжевая часовая МА');
            }
          }
        }
        if(candle.low < aaatStop && candle.close > aaatStop) {
          // this.limit = aaatStop;
          // this.buy('crossed stop trending up');
        }
        if(candle.close <= bb.middle && candle.close > aaatStop) {
          // this.buy('bb.lower crossed');
        }
        // volume  based (buy after volume up / sell after volume down):
        if(candlePrev.isHighVolumeDown  && !candlesArr[2].isHighVolumeUp && candle.close > aaatStop) {

        }
        // this.buy('candlePrev.isHighVolumeDown');
        if( candle.low < shortMA60.result && candle.close > aaatStop && !hadTrade) {
          hadTrade = true;
          //this.buy('lower than 21 ma');
        }
      } else {
        if (candle.close < aaatStop) {
          // stop loss, urgent sell!
          // this.sell('stop loss, urgent sell!');
          // totalTradesAaatStopLoss++;
        } else if(candle.close > bb.middle && rsiVal >= this.settings.rsi.high) {
          //this.sell('bb-rsi trending down');
        }
        if (candle.close >= buyPrice * this.settings.takeProfit) {
          console.error(`${ buyPrice }, ${ candle.close }`)
          this.sell(`SELL!!: TAKE PROFIT, buy: ${ buyPrice }, sell: ${ candle.close }`);
          totalTradesSuccess++;
        }
        if(candlePrev.isHighVolumeUp) {
          // взмыла, можно продавать
          // console.error('взмыла, можно продавать: '+ JSON.stringify(candlePrev))
          // this.sell('взмыла, можно продавать');
        }
        if( candle.high > middleMA60.result || candle.high > longMA60.result) {
          // this.sell('upper than 100ma')
        }
      }
      if(!aaatTrendUpPrev) {
        // trend changed to up once more
        totalUptrends++;
      }
    } else {

      hadTrade = false;
      if(advised) {
        if(candle.close <= buyPrice * 0.95) {
          // this.sell('stop loss, trending dn, stop loss 10%');
        }
        // this.sell('stop loss, trending dn!');
      }
    }
    aaatTrendUpPrev = aaatTrendUp;
  }

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

ltc/btc, 3mo - 5%:
takeProfit = 1.01
percentBelowMa = 0.017
bullTrendMa15 = true


eth/usdt, 15mo - 91.19%:
takeProfit = 1.01
percentBelowMa = 0.03
bullTrendMa15 = false


 */
