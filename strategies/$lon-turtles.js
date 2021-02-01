// see https://github.com/timchepeleff/turtles

var _ = require('lodash');
var log = require('../core/log');
var strat = {};
let currentCandle ;
const DependenciesManager = require('../plugins/dependencyManager/web');

strat.init = function() {
  this.input = 'candle';
  this.currentTrend = 'shortLong';

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
  // deps related (todo: move to baseTradingMethodAsync)
  this.useDependencies = this.config.isDependency ? false : this.config.dependencies && !!this.config.dependencies.length;
  this.dependencyLast = null; // = this.useDependencies ? null : true;

  this.addIndicator('atr', 'ATR', this.atrPeriod, this.settings.isPersistent);
}

// What happens on every new candle?
strat.update = function(candle) {
  if (this.useDependencies) {
    this.dependencyLast = DependenciesManager.getClosestResult(candle.start, this.config.dependencyResults);
  }

  this.indicators.atr.update(candle);
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
  const checkEnterFast = checkEnterFastLong(candle, currentFrame, isShort);
  return checkEnterFast ? checkEnterFast : checkEnterSlowLong(candle, currentFrame, isShort)
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
      currentFrame.currentTrend = 'shortLong'
      return true
    }
  } else {
    if (candle.high >= highest(currentFrame.exitSlow, currentFrame) || (currentFrame.stop !== 0 && candle.close >= currentFrame.stop)) {
      currentFrame.currentTrend = 'shortShort'
      return true
    }
  }
}

const checkExitFastLong = function(candle, currentFrame, isShort = false) {
  if(!isShort) {
    if (candle.low <= lowest(currentFrame.exitFast, currentFrame) || (currentFrame.stop !== 0 && candle.close <= currentFrame.stop)) {
      currentFrame.currentTrend = 'shortLong'
      return true
    }
  } else {
    if (candle.high >= highest(currentFrame.exitFast, currentFrame) || (currentFrame.stop !== 0 && candle.close <= currentFrame.stop)) {
      currentFrame.currentTrend = 'shortShort'
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
      let atr = currentFrame.indicators.atr.result;
      currentFrame.stop = (candle.close - (atr * currentFrame.atrStop))
    } else {
      let atr = currentFrame.indicators.atr.result;
      currentFrame.stop = (candle.close - (atr * currentFrame.atrStop))
    }

  }
}

const manageTrailingStopLoss = function(candle, currentFrame) {
  if (currentFrame.useTrailingAtrStop) {
    let atr = currentFrame.indicators.atr.result;

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
        if (currentFrame.advised) {
          currentFrame.currentTrend = 'shortLong';
          currentFrame.stop = 0;
          currentFrame.sell(`exit signal for long trade, currentTrend: ${currentFrame.currentTrend}`);
        }
      }
    }
  } else {
    if (currentFrame.currentTrend === 'fastShort' || currentFrame.currentTrend === 'slowShort') {
      if (shouldExitLong(candle, currentFrame, true)) {
        if (currentFrame.advisedShort) {
          consoleLog('short, short', candle);
          currentFrame.currentTrend = 'shortShort';
          currentFrame.stop = 0;

          currentFrame.sell(`exit signal for short trade, currentTrend: ${currentFrame.currentTrend}`
            , { margin: { type: 'short', limit: 1 } });
        }
      }
    }
  }
}

const computeEntrySignal = function(candle, currentFrame, isShort = false) {
  if(!isShort) {
    if(currentFrame.currentTrend === 'shortLong' || currentFrame.currentTrend === 'shortShort') {
      if (shouldEnterLong(candle, currentFrame)) {
        if (!currentFrame.advised) {
          if (this.useDependencies ? currentFrame.dependencyLast.newTrend !== 'shortLong' : true) {
            manageStopLoss(candle, currentFrame)
            if (!currentFrame.settings.trailingStopLoss) {
              currentFrame.buy(`buy signal for long trade, currentTrend: ${currentFrame.currentTrend}`);
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
      }
    }
  } else {
    if (currentFrame.currentTrend === 'shortLong' || currentFrame.currentTrend === 'shortShort') {
      if (shouldEnterLong(candle, currentFrame, true)) {
        if (!currentFrame.advisedShort) {
          if (this.useDependencies ? currentFrame.dependencyLast.newTrend !== 'shortShort' : true) {
            manageStopLoss(candle, currentFrame, true);
            currentFrame.buy(`buy signal for short trade, currentTrend: ${currentFrame.currentTrend}`
              , { margin: { type: 'short', limit: 1 } });
          }
        }
      }
    }
  }
}

let prevTrend, shortPrev = false, longPrev = false;
strat.check = function(candle) {
  if (this.useDependencies) {
    if (this.dependencyLast === 'fastLong' || this.dependencyLast === 'slowLong') {
      this.buy(`buy signal for short trade, currentTrend: ${currentFrame.currentTrend}`);
    } else if (this.dependencyLast === 'fastShort' || this.dependencyLast === 'fastShort') {
      this.buy(`buy signal for short trade, currentTrend: ${currentFrame.currentTrend}`
        , { margin: { type: 'short', limit: 1 } });
    }
  } else {
    // won't do anything until we have slowEntry+1 number of candles
    if (this.candles.length === this.maxCandlesLength) {
      // if (this.candles.length === this.maxCandlesLength && this.useDependencies ? !!this.dependencyLast : true) {
      if (this.settings.margin.useShort) {
        computeExitSignal(candle, this, true);
        computeEntrySignal(candle, this, true);
      }
      computeExitSignal(candle, this);
      computeEntrySignal(candle, this);
    }
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
  if(prevTrend !== this.currentTrend) {
    consoleLog(`trendChanged from ${ prevTrend } to ${ this.currentTrend }`);
    this.sendTrendChangeNotification({ newTrend: this.currentTrend, prevTrend });
  }
  prevTrend = this.currentTrend;
}

strat.sendTrendChangeNotification = function({ newTrend, prevTrend }) {
  this.notify({
    type: 'dependency-trend-change',
    reason: 'TREND CHANGE',
    data: { newTrend, prevTrend }
  });
}

function consoleLog(msg = '', curCandle){
  let config = {}
  curCandle = curCandle || currentCandle || {}
  const prefix = `${ config.gekkoId }, ${ JSON.stringify(curCandle.start || moment()) } -- `;
  console.log(prefix, msg);
  log.debug(prefix, msg);
}

module.exports = strat;
