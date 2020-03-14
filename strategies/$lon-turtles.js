// see https://raw.githubusercontent.com/timchepeleff/turtles

var _ = require('lodash');
var log = require('../core/log');
const ATR = require('./indicators/ATR');
var strat = {};
let currentCandle ;

strat.init = function() {
  this.input = 'candle';
  this.currentTrend = 'short';

  // Most strategies need a minimal amount of history before the trading strategy can be started.
  // For example the strategy may be calculating a moving average for the first 3 candles,
  // so it must have at least 3 candles to start.
  // The check function is executed after the required history period is over.
  // The default required history is 0.
  //this.requiredHistory = this.settings.enterSlow + 1; //config.tradingAdvisor.historySize;
  // set to 0  - in the check method we populate array 'candles' with slowEntry+1 candles before giving advice anyway, so no warmup period required.
  // could probably refactor
  this.requiredHistory = 0;


  this.candles = [];
  this.enterFast = this.settings.enterFast;
  this.exitFast = this.settings.exitFast;
  this.enterSlow = this.settings.enterSlow;
  this.exitSlow = this.settings.exitSlow;
  this.hiekenAshi = this.settings.hiekenAshi;
  this.useAtrStop = this.settings.useAtrStop;
  this.useTrailingAtrStop = this.settings.useTrailingAtrStop;
  this.atrPeriod = this.settings.atrPeriod;
  this.atrStop = this.settings.atrStop;
  this.maxCandlesLength = this.settings.enterSlow + 1;
  this.stop = 0

  this.atr = new ATR(this.atrPeriod);
  // this.addTalibIndicator('atr', 'atr', { optInTimePeriod: this.atrPeriod });
}

// What happens on every new candle?
strat.update = function(candle) {
  this.atr.update(candle);
  manageTrailingStopLoss(candle, this);

  this.candles.push(candle);

  let start = (this.candles.length < this.maxCandlesLength) ? 0 : (this.candles.length - this.maxCandlesLength)
  this.candles =  this.candles.slice(start);
  currentCandle = candle;
}

// For debugging purposes.
strat.log = function() {
}

const shouldEnterLong = function(candle, currentFrame, isShort = false) {
  return checkEnterFastLong(candle, currentFrame, isShort) ? checkEnterFastLong(candle, currentFrame, isShort) : checkEnterSlowLong(candle, currentFrame, isShort)
}

const checkEnterFastLong = function(candle, currentFrame, isShort = false) {
  if(!isShort) {
    if (candle.high > highest(currentFrame.enterFast, currentFrame)) {
      currentFrame.currentTrend = 'fastLong'
      return true
    }
  } else {
    if (candle.low < lowest(currentFrame.enterFast, currentFrame)) {
      currentFrame.currentTrend = 'fastShort'
      return true
    }
  }
}

const checkEnterSlowLong = function(candle, currentFrame, isShort = false) {
  if(!isShort) {
    if (candle.high > highest(currentFrame.enterSlow, currentFrame)) {
      currentFrame.currentTrend = 'slowLong'
      return true
    }
  } else {
    if (candle.low < lowest(currentFrame.enterSlow, currentFrame)) {
      currentFrame.currentTrend = 'slowShort'
      return true
    }
  }
}

const shouldExitLong = function(candle, currentFrame, isShort = false) {
  if(!isShort) {
    if (currentFrame.currentTrend === "fastLong") {
      return checkExitFastLong(candle, currentFrame)
    } else if (currentFrame.currentTrend === "slowLong") {
      return checkExitSlowLong(candle, currentFrame)
    }
  } else {
    if (currentFrame.currentTrend === "fastShort") {
      return checkExitFastLong(candle, currentFrame, true)
    } else if (currentFrame.currentTrend === "slowShort") {
      return checkExitSlowLong(candle, currentFrame, true)
    }
  }
}

const checkExitSlowLong = function(candle, currentFrame, isShort) {
  if(!isShort) {
    if (candle.low <= lowest(currentFrame.exitSlow, currentFrame) || (currentFrame.stop !== 0 && candle.close <= currentFrame.stop)) {
      currentFrame.currentTrend = 'short'
      return true
    }
  } else {
    if (candle.high >= highest(currentFrame.exitSlow, currentFrame) || (currentFrame.stop !== 0 && candle.close >= currentFrame.stop)) {
      currentFrame.currentTrend = 'short'
      return true
    }
  }
}

const checkExitFastLong = function(candle, currentFrame, isShort = false) {
  if(!isShort) {
    if (candle.low <= lowest(currentFrame.exitFast, currentFrame) || (currentFrame.stop !== 0 && candle.close <= currentFrame.stop)) {
      currentFrame.currentTrend = 'short'
      return true
    }
  } else {
    if (candle.high >= highest(currentFrame.exitFast, currentFrame) || (currentFrame.stop !== 0 && candle.close <= currentFrame.stop)) {
      currentFrame.currentTrend = 'short'
      return true
    }
  }
}

const lowest = function(numberOfCandlesBack, currentFrame) {
  let relevantCandles = currentFrame.candles.slice((currentFrame.maxCandlesLength-numberOfCandlesBack), -1)
  return Math.min.apply(Math, relevantCandles.map(function(c) { return c.low; }))
}

const highest = function(numberOfCandlesBack, currentFrame) {
  let relevantCandles = currentFrame.candles.slice((currentFrame.maxCandlesLength-numberOfCandlesBack), -1)
  return Math.max.apply(Math, relevantCandles.map(function(c) { return c.high; }))
}

const manageStopLoss = function(candle, currentFrame, isShort = false) {
  if (currentFrame.useAtrStop) {
    if(!isShort) {
      let atr = currentFrame.atr.result;
      currentFrame.stop = (candle.close - (atr * currentFrame.atrStop))
    } else {
      let atr = currentFrame.atr.result;
      currentFrame.stop = (candle.close - (atr * currentFrame.atrStop))
    }

  }
}

const manageTrailingStopLoss = function(candle, currentFrame) {
  if (currentFrame.useTrailingAtrStop) {
    let atr = currentFrame.atr.result;

    // Update the stop loss if the newly suggest stop loss is higher than previous value
    if (currentFrame.stop < (candle.close - (atr * currentFrame.atrStop))) {
      currentFrame.stop = candle.close - (atr * currentFrame.atrStop)
    }
  }
}

const computeExitSignal = function(candle, currentFrame, isShort = false) {
  if(!isShort) {
    if (currentFrame.currentTrend === 'fastLong' || currentFrame.currentTrend === 'slowLong') {
      if (shouldExitLong(candle, currentFrame)) {
        currentFrame.currentTrend = 'short';
        currentFrame.stop = 0;
        consoleLog('short, long', candle);
        currentFrame.advice('short');
        // TODO! check why following doesn't work:
        /*currentFrame.advice({
          direction: 'short',
          margin: { type: 'long', limit: 1 }
        });*/
      }
    }
  } else {
    if (currentFrame.currentTrend === 'fastShort' || currentFrame.currentTrend === 'slowShort') {
      if (shouldExitLong(candle, currentFrame, true)) {
        consoleLog('short, short', candle);
        currentFrame.currentTrend = 'short';
        currentFrame.stop = 0;
        currentFrame.advice({
          direction: 'short',
          margin: { type: 'short', limit: 1 }
        });
      }
    }
  }
}

const computeEntrySignal = function(candle, currentFrame, isShort = false) {
  if(!isShort) {
    if(currentFrame.currentTrend === 'short') {
      if (shouldEnterLong(candle, currentFrame)) {
        manageStopLoss(candle, currentFrame)

        if(!currentFrame.settings.trailingStopLoss) {
          consoleLog('long, long', candle);
          currentFrame.advice('long');
          // TODO! check why following doesn't work:

          /*currentFrame.advice({
            direction: 'long',
            margin: { type: 'long', limit: 1 }
          });*/
        } else {
          /*currentFrame.advice({
            direction: 'long',
            trigger: {
              type: 'trailingStop',
              trailPercentage: currentFrame.settings.trailingStopLoss
            }
          });*/
        }
      }
    }
  } else {
    if(currentFrame.currentTrend === 'short') {
      if (shouldEnterLong(candle, currentFrame, true)) {
        manageStopLoss(candle, currentFrame, true);
        consoleLog('long, short', candle);
        currentFrame.advice({
          direction: 'long',
          margin: { type: 'short', limit: 1 }
        });
      }
    }
  }
}

let trendPrev, shortPrev = false, longPrev = false;
strat.check = function(candle) {

  // won't do anything until we have slowEntry+1 number of candles
  if (this.candles.length === this.maxCandlesLength) {
    if(this.settings.margin.useShort) {
      computeExitSignal(candle, this, true);
      computeEntrySignal(candle, this, true);
    }
    computeExitSignal(candle, this);
    computeEntrySignal(candle, this);
  }
  /*if (checkExitFastLong(candle, this)) {
    consoleLog(`checkExitFastLong, `, candle);
  }
  if (checkExitSlowLong(candle, this)) {
    consoleLog(`checkExitSlowLong, `, candle);
  }
  if (checkEnterFastLong(candle, this)) {
    consoleLog(`checkEnterFastLong, `, candle);
  }
  if (checkEnterSlowLong(candle, this)) {
    consoleLog(`checkEnterSlowLong, `, candle);
  }*/
  if(trendPrev !== this.currentTrend) {
    consoleLog(`trendChanged from ${ trendPrev } to ${ this.currentTrend }`);
  }
  trendPrev = this.currentTrend;
}
function consoleLog(msg = '', curCandle){
  let config = {}
  curCandle = curCandle || currentCandle || {}
  const prefix = `${ config.gekkoId }, ${ JSON.stringify(curCandle.start || moment()) } -- `;
  console.log(prefix, msg);
  log.debug(prefix, msg);
}

module.exports = strat;
