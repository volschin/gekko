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
const RSI = require('../strategies/indicators/RSI.js');

const CandleBatcher = require('../core/candleBatcher');
// Let's create our own strat
var strat = {};
var buyPrice = 0.0;
var buyTs;
var currentPrice = 0.0;
var advised = false;
var rsi5History = [];
var wait = 0;
var counter = 0;
var disableTrading = false;


// Prepare everything our method needs
strat.init = function() {
  // debug? set to false to disable all logging/messages/stats (improves performance in backtests)
  this.debug = false;
  this.writeToFile = false;

  // performance
  config.backtest.batchSize = 1000; // increase performance
  config.silent = true;
  config.debug = false;

  this.requiredHistory = config.tradingAdvisor.historySize;

  this.addIndicator('aaat2', 'Adaptive-ATR-ADX-Trend', {
    debug: this.debug,
    useHeiken: this.settings.USE_HEIKEN
  });
  this.addIndicator('rsi', 'RSI', { interval: 14 });

  this.tradeInitiated = false;
}

// What happens on every new candle?
strat.update = function(candle) {
  aaat2 = this.indicators.aaat2.result;
  rsi = this.indicators.rsi.result;

  currentPrice = candle.close;

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
  if(aaat2) {
    if (aaat2.trend > 0) {
      isBullTrendCur = true;
    } else {
      isBullTrendCur = false;
    }
  }
}

let aaat2, isBullTrendCur = false, aaat2Prev, aaat2PrevPrev, curIndicator,
  rsi;
var rsiIndicator = new RSI({ interval: 14 });

strat.check = function() {
  if(this.settings.CANDLE_NUMBER === 1) {
    curIndicator = aaat2;
  } else if(this.settings.CANDLE_NUMBER === 2) {
    curIndicator = aaat2Prev;
  } else if(this.settings.CANDLE_NUMBER === 3) {
    curIndicator = aaat2PrevPrev;
  } else {
    curIndicator = aaat2;
  }
  // simple change trend strat:

  if(curIndicator) {
    console.log(`INFO: DATE: ${ this.candle.start }, curIndicator.stop: ${ curIndicator.stop }, currentPrice: ${ currentPrice }, 
          curIndicator.trendChange: ${curIndicator.trendChange }, curIndicator.trend: ${curIndicator.trend },  `);
    if (advised && curIndicator.trendChange === -2) {
      this.sell(`TREND CHANGE to down: SELL!! ${curIndicator.stop}`);
    } else if (!advised && curIndicator.trendChange === 2) {
      this.buy(`TREND CHANGE to up: BUY!! ${curIndicator.stop}`);
    } /*else if (!advised && isBullTrendCur) {
      if (rsi && rsi !== 0) {
        if(rsi < this.settings.RSI_BUY_MIN) {
          this.buy(`TREND is up && RSI < 30: BUY!! ${curIndicator.stop}, rsi: ${ rsi }`);
        }
      }
    }*/
  }

  aaat2PrevPrev = aaat2Prev;
  aaat2Prev = aaat2;
}


strat.sell = function(reason) {
  this.notify({
    type: 'sell advice',
    reason: reason,
  });
  this.advice('short');
  //log.info(reason, JSON.stringify(this.candle.start));
  console.log(reason, JSON.stringify(this.candle.start));
  advised = false;
  buyPrice = 0;
  if (this.tradeInitiated) { // Add logic to use other indicators
    this.tradeInitiated = false;
  }
}

strat.buy = function(reason) {
  // console.log(JSON.stringify(candle));
  advised = true;
  // If there are no active trades, send signal
  if (!this.tradeInitiated) { // Add logic to use other indicators
    this.notify({
      type: 'buy advice',
      reason: reason,
    });
    this.advice('long');
    buyTs = this.candle.start;
    //log.info(reason, JSON.stringify(this.candle.start));
    console.log(reason, JSON.stringify(this.candle.start));
    buyPrice = currentPrice;
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



module.exports = strat;
