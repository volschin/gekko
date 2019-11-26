// RSI + Candle
// Created by Crypto49er
// Version 2 (Version 1 was made for my heavily modded version of Gekko, version 2 is for based version of Gekko)
//
// This strategy is designed for 5 minute candles.
// Idea 1: When RSI drops aggressively (>18 points) and goes way below 30 (< 12), there's an
// excellent chance the price shoots back up and over 70 RSI.
// Idea 2: When RSI drops below 30 and candle creates a hammer, it means the bears are
// exhausted and immediate gains should occur in the new few candles.

// Buy when RSI < 12 and RSI dropped more than 18 points compared to previous 2 candles
// Buy when RSI < 30 and candle is a hammer
// Sell when RSI > 70
// Sell when 1% stop loss
//
// addon: selling gradually in time
//https://www.youtube.com/watch?v=erlPbF0B6BY

var log = require('../core/log');
var config = require ('../core/util.js').getConfig();
const moment = require('moment');

const CandleBatcher = require('../core/candleBatcher');
const RSI = require('../strategies/indicators/RSI.js');
const SMA = require('../strategies/indicators/SMA.js');
const NATR = require('../strategies/indicators/NATR.js');
const DependenciesManager = require('../plugins/dependencyManager/web');

let rsiArr = [];
// Let's create our own strat
var strat = {};
var buyPrice = 0.0;
var buyTs;
var isCandleBuy = false;
var isATRBuy = false;
var currentPrice = 0.0;
var rsi5 = new RSI({ interval: 14 });
var rsi60Ind = new RSI({ interval: 14 });
var rsiIndicator = new RSI({ interval: 14 });
var sma5 = new SMA(200);
let natr60Ind = new NATR(14);
var advised = false;
var rsi5History = [];
var wait = 0;
var counter = 0;
var disableTrading = false;
var waitForRejectedRetry = 0;
var priceHistory = [];
var sma5History = [];
let highestRSI = 0; // highestRSI in last 5 candles
let lowestRSI = 100; // lowestRSI in last 5 candles
var candle5 = {};
let trailingStop, currentCandle;

const STOP_LOSS_COEF = 0.9;
// const STOP_LOSS_COEF = 0.99;
// const TAKE_PROFIT_COEF = 1.1;
const TAKE_PROFIT_COEF = 1.01;

// const ATR_LOW_SELL = 0.00001848;

let THRESHOLDS = {}, strategyIsEnabled = false;
// Prepare everything our method needs
strat.init = function() {
  /*if (!config.dependencyResults || !config.dependencyResults.results) {
    throw 'This strategy must run with dependency "ATR-ADX-Trend-Dep"';
  }*/

  // debug? set to false to disable all logging/messages/stats (improves performance in backtests)
  this.debug = false;
  this.writeToFile = false;

  // performance
  config.backtest.batchSize = 1000; // increase performance
  config.silent = true;
  config.debug = false;

  //console.log(`THRESHOLDS.ATR_LOW_SELL: ${ THRESHOLDS.ATR_LOW_SELL} `);

  this.requiredHistory = config.tradingAdvisor.historySize;

  /*// since we're relying on batching 1 minute candles into 5 minute candles
  // lets throw if the settings are wrong
  if (config.tradingAdvisor.candleSize !== 1) {
    throw "This strategy must run with candleSize=1";
  }*/

  // create candle batchers for 5 minute candles
  this.batcher5 = new CandleBatcher(5);
  this.batcher60 = new CandleBatcher(60);

  // supply callbacks for 5 minute candle function
  this.batcher5.on('candle', this.update5);
  this.batcher60.on('candle', this.update60);


  // Add an indicator even though we won't be using it because
  // Gekko won't use historical data unless we define the indicator here
  //this.addIndicator('rsi', 'RSI', { interval: this.settings.interval});

  trailingStop = this.settings.trailingStop;

  let customNATRSettings = {
    optInTimePeriod: this.settings.ATR_Period || 14,
  }
  // add the indicator to the strategy
  // this.addTulipIndicator('natr', 'natr', customNATRSettings);
  // this.addTulipIndicator('rsi', 'rsi', { optInTimePeriod: 14 });

  /*this.addIndicator('aaat2', 'Adaptive-ATR-ADX-Trend', {
    debug: this.debug
  });*/

  this.tradeInitiated = false;
  consoleLog(`SETTINGS: ${JSON.stringify(this.settings)}`);
}

// What happens on every new candle?
strat.update = function(candle) {
  currentPrice = candle.close;
  currentCandle = candle;
  // atrIndicator.update(candle);
  rsiIndicator.update(candle);
  // write 1 minute candle to 5 minute batchers
  this.batcher5.write([candle]);
  this.batcher5.flush();
  this.batcher60.write([candle]);
  this.batcher60.flush();

  // Send message
  counter++;
  if (counter == 1440){
    //console.log('Bot is still working.');
    counter = 0;
  }

  // Decrement wait
  if (wait > 0) {
    wait--;
    log.debug('Wait: ', wait);
  }
  let res;
  if(config.dependencyResults) {
    res = DependenciesManager.getClosestResult(candle.start, config.dependencyResults.results);
  }
  aaat2 = res;
  isBullTrendCur = res && (res.trend !== -1);

  if(config.dependencyResults) {
    if (new Date(candle.start).getTime() > new Date(config.dependencyResults.warmupCompletedDate).getTime()) {
      strategyIsEnabled = true;
    }
  } else {
    strategyIsEnabled = true;
  }

  // console.error('!! RES:' , res, isBullTrendCur, advised, candle.start.toString());
}

strat.update60 = function(candle) {
  rsi60Ind.update(candle);
  natr60Ind.update(candle);
}
strat.update5 = function(candle) {
  rsi5.update(candle);
  sma5.update(candle.close);

  candle5 = this.batcher5.calculatedCandles[0];
  //log.debug('5 minute candle.close ', candle5.close);

  // Store the last three 5 minute candle prices
  priceHistory.push(candle.close);
  if (priceHistory.length > 10) {
    priceHistory.shift();
  }

  // Store the last three sma5 prices
  sma5History.push(sma5.result);
  if (sma5History.length > 3) {
    sma5History.shift();
  }

  // We only need to store RSI for 10 candles
  rsi5History.push(rsi5.result);
  if (rsi5History.length > 10) {
    rsi5History.shift();
  }

  highestRSI = 0;
  for (let i=5;i<=rsi5History.length-1;i++){
    if(rsi5History[i] > highestRSI) {
      highestRSI = rsi5History[i];
    }
  }
  lowestRSI = 100;
  for (let i=5;i<=rsi5History.length-1;i++){
    if(rsi5History[i] < lowestRSI) {
      lowestRSI = rsi5History[i];
    }
  }

  //Send price and RSI to console every 5 minutes
  //log.info('Price', currentPrice, 'SMA', sma5.result, 'RSI', rsi5.result.toFixed(2));
}

// Based on the newly calculated
// information, check if we should
// update or not.
let rsiPrevPrevPrev = 0, rsiPrevPrev = 0, rsiPrev = 0;
let rsi60PrevPrevPrev = 0, rsi60PrevPrev = 0, rsi60Prev = 0, rsi60 = 0;

let aaat2, isBullTrendCur = false, isBullTrendPrev = false, justChangedTrend = false;
let rsiLastJump, rsiLastDip;
let statsTotalTrades = 0;
let statsTotalTradesForceClose = 0;
let statsTotalTradesSuccess = 0;
strat.check = function() {
  // let atr = this.tulipIndicators.natr.result.result;
  // let rsi = rsi5.result;
  let time = JSON.stringify(this.candle.start);

  let natr60 = natr60Ind.result;
  let rsi = rsiIndicator.result;

  if(strategyIsEnabled) {

    // sharp rsi drop:
    rsi = rsi5.result;
    rsi60 = rsi60Ind.result;
    if (true) {
      const rsiHigh = this.settings.RSI_HIGH;
      const rsiLow = this.settings.RSI_LOW;
      const jumpDipTimeout = this.settings.DIP_TIMEOUT;
      const natrMin = this.settings.NATR_MIN;
      let jumpoDippoProfit = this.settings.TAKE_PROFIT;

      if (rsi && rsi !== 0) {
        if (advised && (currentPrice >= buyPrice * jumpoDippoProfit)) {
          this.sell(`SELL!!: TAKE PROFIT, buy: ${ buyPrice }, sell: ${ currentPrice }`);
          statsTotalTradesSuccess++;
        }
        if(advised && rsi > rsiHigh) {
         /* if (rsi60 > rsiHigh) {
            this.sell(`SELL!!: RSI60 > ${ rsiHigh }, buy: ${ buyPrice }, sell: ${ currentPrice }`);
            if(buyPrice < currentPrice) {
              statsTotalTradesSuccess++;
            } else {
              statsTotalTradesForceClose++;
            }
          } else {}*/

        }
        if (rsiPrev > rsiHigh && rsi < rsiHigh) {
          // console.error(`rsi > ${ rsiHigh} , ${time}, ${ rsi } `);
          rsiLastJump = {
            time: this.candle.start,
            rsi: rsi,
            rsi60: rsi60,
            rsiPrev: rsiPrev,
            candle: this.candle,
            aaat2: aaat2
          }
        }

        if (rsi < rsiLow) {
          // console.error(`rsi < ${ rsiLow} , ${time}, ${ rsi }, rsiLastJump.time: ${rsiLastJump.time},this.candle.start: ${this.candle.start}, ${this.candle.start.diff(rsiLastJump.time, 'minutes')} `);
          rsiLastDip = {
            time: this.candle.start,
            rsi: rsi,
            rsi60: rsi60
          }
          if (rsiLastJump && rsiLastDip) {
            if (this.candle.start.diff(rsiLastJump.time, 'minutes') < jumpDipTimeout && rsi60 < rsiLow && natr60 > natrMin) {
              if (!advised) {
                //if(isBullTrendCur) {
                  console.info(`BUY!!: jump-dippo < ${ rsiLow } , ${time}, ${ rsi }, rsi60: ${ rsi60 } , natr60: ${ natr60 }, buyPrice: ${ buyPrice }, aaat2: ${ JSON.stringify(aaat2)}, jump: ${ JSON.stringify(rsiLastJump) } `);
                  // console.info(`BUY!!: jump-dippo < ${ rsiLow } , ${time}, ${ rsi }, rsi60: ${ rsi60 }, rsiLastJump: ${ JSON.stringify(rsiLastJump) }, rsiLastDip: ${ JSON.stringify(rsiLastDip) } `);
                  this.buy('BUY!!: JUMPODIPPO');
                  statsTotalTrades++;
                //}
              }
            }
          }
        }

       /* if (advised) {
          if (currentPrice <= buyPrice * 0.993) {
            this.sell('SELL!!: STOP LOSS');
            console.error('SELL!!: STOP LOSS');
          }
        }*/
      }
    }
  }

  rsiPrevPrevPrev = rsiPrevPrev;
  rsiPrevPrev = rsiPrev;
  rsiPrev = rsi;
  rsi60PrevPrevPrev = rsi60PrevPrev;
  rsi60PrevPrev = rsi60Prev;
  rsi60Prev = rsi60Ind;

  isBullTrendPrev = isBullTrendCur;
}


strat.sell = function(reason) {
  consoleLog(reason);

  this.notify({
    type: 'sell advice',
    reason: reason,
  });
  this.advice('short');
  advised = false;
  buyPrice = 0;
  if (this.tradeInitiated) { // Add logic to use other indicators
    this.tradeInitiated = false;
  }
}

strat.buy = function(reason) {
  consoleLog(reason);

  advised = true;
  // If there are no active trades, send signal
  if (!this.tradeInitiated) { // Add logic to use other indicators
    this.notify({
      type: 'buy advice',
      reason: reason,
    });
    //this.advice('long');
    if(trailingStop) {
      this.advice({
        direction: 'long', // or short
        trigger: { // ignored when direction is not "long"
          type: 'trailingStop',
          trailPercentage: trailingStop
          // or:
          // trailValue: 100
        }
      });
    } else {
      this.advice('long');
    }

    buyTs = this.candle.start;
    buyPrice = currentPrice;
    this.tradeInitiated = true;
  }
}
this.onTriggerFired = function(data) {
  // tradeInitiated = false;

  consoleLog(`onTriggerFired, data: ${ JSON.stringify(data) }`);
}
// This is called when trader.js initiates a
// trade. Perfect place to put a block so your
// strategy won't issue more trader orders
// until this trade is processed.
// ash: NOT WORKING!! SEE .buy
strat.onPendingTrade = function(pendingTrade) {
  this.tradeInitiated = true;
  consoleLog('onPendingTrade (tradeInitiated = true)');
}
// This runs whenever a trade is completed
// as per information from the exchange.
// The trade object looks like this:
// {
//   id: [string identifying this unique trade],
//   adviceId: [number specifying the advice id this trade is based on],
//   action: [either "buy" or "sell"],
//   price: [number, average price that was sold at],
//   amount: [number, how much asset was trades (excluding "cost")],
//   cost: [number the amount in currency representing fee, slippage and other execution costs],
//   date: [moment object, exchange time trade completed at],
//   portfolio: [object containing amount in currency and asset],
//   balance: [number, total worth of portfolio],
//   feePercent: [the cost in fees],
//   effectivePrice: [executed price - fee percent, if effective price of buy is below that of sell you are ALWAYS in profit.]
// }
strat.onTrade = function(trade = {}) {
  this.tradeInitiated = false;
  if(trade.action === 'sell'){
    advised = false;
  }
  consoleLog(`onTrade:: trade: ${ JSON.stringify(trade) }`);
}
this.onTriggerFired = function(data) {
  // tradeInitiated = false;
  advised = false;
  consoleLog(`onTriggerFired, data: ${ JSON.stringify(data) }`);
}
// Trades that didn't complete with a buy/sell
strat.onTerminatedTrades = function(terminatedTrades) {
  log.info('Trade failed. Reason:', terminatedTrades.reason);
  this.tradeInitiated = false;
  consoleLog('onTerminatedTrades:: Trade failed. Reason: ' + terminatedTrades.reason);
}
strat.end = function() {
  // your code!
  const msg = `END: statsTotalTrades: ${ statsTotalTrades }, success: ${statsTotalTradesSuccess}, fail: ${statsTotalTradesForceClose}`;
  consoleLog(msg);
  console.error(msg);
}
function consoleLog(msg){
  if(config){
    msg = msg || '';
    currentCandle = currentCandle || {}
    const prefix = `${ config.gekkoId }, ${ JSON.stringify(currentCandle.start) || JSON.stringify(moment()) } -- `;
    console.error(prefix, msg);
    log.debug(prefix, msg);
  }
}

module.exports = strat;
