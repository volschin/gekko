const _ = require('lodash');
const fs = require('fs');
const moment = require('moment');

const util = require('../../core/util');
const config = util.getConfig();
const dirs = util.dirs();
const log = require(dirs.core + 'log');

const ENV = util.gekkoEnv();
const mode = util.gekkoMode();
const startTime = util.getStartTime();

const indicatorsPath = dirs.methods + 'indicators/';
const indicatorFiles = fs.readdirSync(indicatorsPath);
const Indicators = {};

const Db = require('../gekkosPersistent/db');
const db = new Db();

const AsyncIndicatorRunner = require('./asyncIndicatorRunner');

_.each(indicatorFiles, function(indicator) {
  const indicatorName = indicator.split(".")[0];
  if (indicatorName[0] != "_")
    try {
      Indicators[indicatorName] = require(indicatorsPath + indicator);
    } catch (e) {
      log.error("Failed to load indicator", indicatorName);
    }
});

const allowedIndicators = _.keys(Indicators);

var Base = function(settings) {
  _.bindAll(this);

  // properties
  this.age = 0;
  this.processedTicks = 0;
  this.setup = false;
  this.settings = settings;
  this.tradingAdvisor = config.tradingAdvisor;
  // defaults
  this.priceValue = 'close';
  this.indicators = {};
  this.asyncTick = false;
  this.deferredTicks = [];

  this.propogatedAdvices = 0;

  this.completedWarmup = false;

  this.asyncIndicatorRunner = new AsyncIndicatorRunner();

  this._currentDirection;

  // make sure we have all methods
  _.each(['init', 'check'], function(fn) {
    if(!this[fn])
      util.die('No ' + fn + ' function in this strategy found.')
  }, this);

  if(!this.update)
    this.update = function() {};

  if(!this.end)
    this.end = function() {};

  if(!this.onTrade)
    this.onTrade = function() {};

  if(!this.onCommand)
    this.onCommand = function() {};

  if(!this.onPortfolioChange)
    this.onPortfolioChange = function() {};

  if(!this.onPortfolioValueChange)
    this.onPortfolioValueChange = function() {};

  if(!this.onTriggerFired)
    this.onTriggerFired = function() {};

  if(!this.onPendingTrade)
    this.onPendingTrade = function() {};

  if(!this.onTerminatedTrades)
    this.onTerminatedTrades = function() {};

  // let's run the implemented starting point
  this.initWrapper();

  if(_.isNumber(this.requiredHistory)) {
    log.debug('Ignoring strategy\'s required history, using the "config.tradingAdvisor.historySize" instead.');
  }
  this.requiredHistory = config.tradingAdvisor.historySize;

  if(!config.debug || !this.log)
    this.log = function() {};

  this.setup = true;

  if(_.size(this.asyncIndicatorRunner.talibIndicators) || _.size(this.asyncIndicatorRunner.tulipIndicators))
    this.asyncTick = true;
  else
    delete this.asyncIndicatorRunner;
}

// teach our base trading method events
util.makeEventEmitter(Base);

// add wrappers for Ash's strats:
Base.prototype.initWrapper = function() {
  this.config = config || {};

  this.buyPrice = 0.0;
  this.currentPrice = 0.0;
  this.hadDeal = false;
  this.advised = false;
  this.advisedShort = false;
  this.tradeInitiated = false;
  this.buysAmount = 0;
  this.currentCandle = null;
  this.prevCandle = null;
  this.candlesArr = Array(config.candlesArrLength || 10).fill({ open: -1, close: -1, high: -1, low: -1 });
  this.tradesArr = [];
  this.tradesCount = 0;
  this.config.backtest.batchSize = 1000; // increase performance
  this.totalSellAttempts = 0;
  this.totalBuyAttempts = 0;
  this.totalBought = 0;
  this.totalSold = 0;
  this.tradesArr = [];

  this.consoleLog(`initWrapper:: gekkoId: ${ config.gekkoId }, type: ${ config.type }`);
  return this.init();
}
Base.prototype.onStratWarmupCompletedWrapper = function() {
  this.consoleLog(`onStratWarmupCompletedWrapper:: `);
  // todo!
}

Base.prototype.checkWrapper = function(candle) {
  return this.check(candle);
}
Base.prototype.updateWrapper = function(candle, done) {
  if(this.debug) {
    this.consoleLog(`updateWrapper:: advised: ${ this.advised }, advisedShort: ${ this.advisedShort }, tradeInitiated: ${ this.tradeInitiated }`);
  }
  this.currentCandle = candle;
  this.currentPrice = candle.close;
  this.candlesArr.pop();
  this.candlesArr.unshift(candle);

  return this.update(candle, done);
}

Base.prototype.buyCore = async function(reason, options = {}, api) {
  this.totalBuyAttempts++;

  this.consoleLog(`buy:: advice: long, margin: ${!!options.margin}, tradeGekkoId: ${ api && api.tradeGekkoId}, tradeInitiated=${ this.tradeInitiated }`);


  if(!IsValidConfigForApi(config) || api && !api.tradeGekkoId) {
    this.consoleLog(`strat.buy:: executing, reason: ${ reason }`);

    this.setApiTrade();

    this.notify({
      type: 'buy advice',
      reason: reason,
    });
    this.advice({
      limit: options.limitPrice || _.isNumber(options.limit) && options.limit,
      direction: 'long',
      margin: options.margin
    });

    this.buyTs = this.candle.start;
    this.buyPrice = this.currentPrice;
    if (options.margin && options.margin.type === 'short') {
      this.advisedShort = true;
    } else {
      this.advised = true;
    }
    if (!this.hadDeal) {
      this.hadDeal = true; // only set once: strange startAt.unix() bug
    }
    this.totalBought++;
  }
}
Base.prototype.buy = function(reason, options = {}) {
  const that = this;
  if(this.config.mode !== 'backtest') {
    (async function() {
      let api = await that.getApi();
      that.buyCore(reason, options, api);
    })();
  } else {
    that.buyCore(reason, options);
  }
}
Base.prototype.sellCore = async function(reason, options = {}, api) {
  this.totalSellAttempts ++;

  this.consoleLog(`sell:: (attempting) advice: short, margin: ${!!options.margin}, tradeGekkoId: ${ api && api.tradeGekkoId}`);
  if(!IsValidConfigForApi(config) || api && api.tradeGekkoId === config.gekkoId) {
    this.consoleLog(`strat.sell:: executing, reason: ${ reason }`);

    this.notify({
      type: 'sell advice',
      reason: reason,
    });
    this.advice({
      direction: 'short',
      limit: options.limitPrice,
      margin: options.margin
    });

    this.totalSold++;
    this.buyPrice = 0;
  }
}
Base.prototype.sell = function(reason, options = {}) {
  const that = this;
  if(this.config.mode !== 'backtest') {
    (async function() {
      let api = await that.getApi();
      that.sellCore(reason, options, api);
    })();
  } else {
    that.sellCore(reason, options);
  }
}
Base.prototype.onPendingTradeWrapper = function(pendingTrade) {
  this.consoleLog('onPendingTradeWrapper:: pendingTrade: ' + JSON.stringify(pendingTrade && pendingTrade));
  this.tradeInitiated = true;
  return this.onPendingTrade(pendingTrade);
}
Base.prototype.onTradeWrapper = function(trade) {   // see https://www.youtube.com/watch?v=lc21W9_zdME
  this.consoleLog(`onTradeWrapper:: trade: ${ JSON.stringify(trade && trade.action) }, id: ${ trade && trade.id }`);
  if(trade.action === 'sell') {
    this.unsetApiTrade();

    if(trade.margin && trade.margin.type === 'short') {
      this.advisedShort = false;
    } else {
      this.advised = false;
    }
  }
  this.tradeInitiated = false;
  this.buyPrice = trade.price;
  this.tradesArr.push(trade);
  return this.onTrade(trade);
}
Base.prototype.onTerminatedTradesWrapper = function(terminatedTrades = {}) {  // Trades tht didn't complete with a buy/sell (see processTradeErrored in tradingAdvisor)
  this.consoleLog('onTerminatedTradesWrapper:: Trade failed. Reason: ' + terminatedTrades.reason);
  this.tradeInitiated = false;
  this.unsetApiTrade();
  return this.onTerminatedTrades(terminatedTrades);
}
Base.prototype.onPortfolioChangeWrapper = function(portfolio) {
  this.consoleLog(`onPortfolioChangeWrapper:: Portfolio: ${ JSON.stringify(portfolio) }`);
  return this.onPortfolioChange(portfolio);
}
Base.prototype.onPortfolioValueChangeWrapper = function(portfolioValue) {
  return this.onPortfolioValueChange(portfolioValue);
}
Base.prototype.onTriggerFiredWrapper = function(portfolioValue) {
  this.consoleLog(`onTriggerFiredWrapper:: portfolioValue: ${ JSON.stringify(portfolioValue) }`);

  this.notify({
    type: 'sell advice',
    reason: 'trailing stop trigger fired',
  });
  this.tradeInitiated = false;
  //todo:
  /*this.buyPrice = trade.price;
  if(trade.margin && trade.margin.type === 'short') {
    this.advisedShort = false;
  } else {
    this.advised = false;
  }*/
  return this.onTriggerFired(portfolioValue);
}
Base.prototype.onCommandWrapper = function(command) {
  this.consoleLog(`onCommandWrapper:: command: ${ JSON.stringify(command) }`);
  return this.onCommand(command);
}
Base.prototype.endWrapper = function() {
  this.consoleLog(`endWrapper:: total trades: ${ this.tradesArr.length
  }, totalBought: ${ this.totalBought } (out of ${ this.totalBuyAttempts
  } attempts), totalSold: ${ this.totalSold
  } (out of ${ this.totalSellAttempts } attempts), `);
  return this.end();
}

Base.prototype.isInProfit = function(candle) {
  let ret = false;
  const fee = this.getFee();
  candle = candle || this.candle;
  if(candle) {
    ret = (candle.close * (1 - fee) - this.buyPrice * (1 + fee)) > 0;
  }
  return ret;
}
Base.prototype.isInProfitShort = function(candle) {
  let ret = false;
  const fee = this.getFee();
  candle = candle || this.candle;
  if(candle) {
    ret = (this.buyPrice * (1 - fee) - candle.close * (1 + fee)) > 0;
  }
  return ret;
}
Base.prototype.getFee = function(candle) {
  let feeOrig = this.config.paperTrader && (this.config.paperTrader.feeUsing === 'taker' ?  this.config.paperTrader.feeTaker: this.config.paperTrader.feeMaker);
  return 0.01 * (feeOrig || 0.1);
}

Base.prototype.consoleLog = function(msg = '') {
  this.currentCandle = this.currentCandle || {}
  const prefix = `${ config && config.gekkoId }, ${ JSON.stringify(this.currentCandle.start) || JSON.stringify(moment()) } -- `;
  console.log(prefix, msg);
}

// api-specific (enabling multiple tradebots to trade with a single API Exchange):
Base.prototype.setApiTrade = async function() {
  if(IsValidConfigForApi(config)) {
    await db.setApi(GetUniqueNameFromConfig(config), config.gekkoId);
  }
}
Base.prototype.unsetApiTrade = async function() {
  if(IsValidConfigForApi(config)) {
    await db.setApi(GetUniqueNameFromConfig(config), null);
  }
}
Base.prototype.getApi = async function() {
  if(IsValidConfigForApi(config)) {
    const uniqueName = GetUniqueNameFromConfig(config);
    if(!uniqueName) {
      console.error('not found api name in gekko config');
    }
    let api = await db.getApi(uniqueName);
    return api;
  }
}
function GetUniqueNameFromConfig(config = {}) {
  return config.apiKeyName || config.trader && config.trader.uniqueName;
}
/**
 * @return {boolean}
 */
function IsValidConfigForApi(config = {}) {
  return config.mode === 'realtime' && (config.type === 'tradebot' || config.type === 'paper trader') && !!config.apiKeyName;
}
// end async wrappers


Base.prototype.tick = function(candle, done) {
  this.age++;

  const afterAsync = () => {
    // let's turn off, it's causing a bug for indicators with bigger candles (using candleButchers)
    // this.calculateSyncIndicators(candle, done);
    this.propogateTick(candle);
    done();
  }

  if(this.asyncTick) {
    this.asyncIndicatorRunner.processCandle(candle, () => {

      if(!this.talibIndicators) {
        this.talibIndicators = this.asyncIndicatorRunner.talibIndicators;
        this.tulipIndicators = this.asyncIndicatorRunner.tulipIndicators;
      }

      afterAsync();
    });
  } else {
    afterAsync();
  }
}

Base.prototype.isBusy = function() {
  if(!this.asyncTick)
    return false;

  return this.asyncIndicatorRunner.inflight;
}

Base.prototype.calculateSyncIndicators = function(candle, done) {
  // update all indicators
  var price = candle[this.priceValue];
  _.each(this.indicators, function(i) {
    if(i.input === 'price')
      i.update(price);
    if(i.input === 'candle')
      i.update(candle);
  },this);

  this.propogateTick(candle);

  return done();
}

Base.prototype.propogateTick = function(candle) {
  this.candle = candle;
  this.updateWrapper(candle);

  this.processedTicks++;
  var isAllowedToCheck = this.requiredHistory <= this.age;

  if(!this.completedWarmup) {

    // in live mode we might receive more candles
    // than minimally needed. In that case check
    // whether candle start time is > startTime
    var isPremature = false;

    if(mode === 'realtime') {
      const startTimeMinusCandleSize = startTime
        .clone()
        .subtract(this.tradingAdvisor.candleSize, "minutes");

      isPremature = candle.start < startTimeMinusCandleSize;
    }

    if(isAllowedToCheck && !isPremature) {
      this.completedWarmup = true;
      this.emit(
        'stratWarmupCompleted',
        {start: candle.start.clone()}
      );
    }
  }

  if(this.completedWarmup) {
    this.log(candle);
    this.checkWrapper(candle);

    if(
      this.asyncTick &&
      this.hasSyncIndicators &&
      this.deferredTicks.length
    ) {
      return this.tick(this.deferredTicks.shift())
    }
  }

  const indicators = {};
  _.each(this.indicators, (indicator, name) => {
    indicators[name] = indicator.result;
  });

  _.each(this.tulipIndicators, (indicator, name) => {
    indicators[name] = indicator.result.result
      ? indicator.result.result
      : indicator.result;
  });

  _.each(this.talibIndicators, (indicator, name) => {
    indicators[name] = indicator.result.outReal
      ? indicator.result.outReal
      : indicator.result;
  });

  this.emit('stratUpdate', {
    date: candle.start.clone(),
    indicators: this.indicators
  });

  // are we totally finished?
  const completed = this.age === this.processedTicks;
  if(completed && this.finishCb)
    this.finishCb();
}

Base.prototype.processTrade = function(trade) {
  if(
    this._pendingTriggerAdvice &&
    trade.action === 'sell' &&
    this._pendingTriggerAdvice === trade.adviceId
  ) {
    // This trade came from a trigger of the previous advice,
    // update stored direction
    this._currentDirection = 'short';
    this._pendingTriggerAdvice = null;
  }

  this.onTradeWrapper(trade);
}

Base.prototype.processPendingTrade = function(pendingTrade) {
  this.onPendingTradeWrapper(pendingTrade);
}

Base.prototype.processTerminatedTrades = function(terminatedTrades) {
  if (!terminatedTrades.reason) {
    terminatedTrades.reason = 'Cancelled';
  }
  this.onTerminatedTradesWrapper(terminatedTrades);
}

Base.prototype.updatePortfolio = function(portfolio) {
  this.onPortfolioChangeWrapper(portfolio);
}

Base.prototype.newPortfolioValue = function(portfolioValue) {
  this.onPortfolioValueChangeWrapper(portfolioValue);
}

Base.prototype.triggerFired = function(portfolioValue) {
  this.onTriggerFiredWrapper(portfolioValue);
}

Base.prototype.processCommand = function(command) {
  this.onCommandWrapper(command);
}

Base.prototype.addTalibIndicator = function(name, type, parameters) {
  this.asyncIndicatorRunner.addTalibIndicator(name, type, parameters);
}

Base.prototype.addTulipIndicator = function(name, type, parameters) {
  this.asyncIndicatorRunner.addTulipIndicator(name, type, parameters);
}

Base.prototype.addIndicator = function(name, type, parameters, isPersistent) {
  let indicator;
  if(!_.contains(allowedIndicators, type))
    util.die('I do not know the indicator ' + type);

  if(this.setup)
    util.die('Can only add indicators in the init method!');
  const existingIndicator = config.mode !== 'backtest' && isPersistent && config.indicators && config.indicators[name];
  indicator = new Indicators[type](parameters, existingIndicator);

  return this.indicators[name] = indicator;

  // some indicators need a price stream, others need full candles
}

Base.prototype.advice = function(newDirection) {
  // ignore legacy soft advice
  if(!newDirection) {
    return;
  }

  let trigger, limit, margin;
  if(_.isObject(newDirection)) {
    if(!_.isString(newDirection.direction)) {
      log.error('Strategy emitted unparsable advice:', newDirection);
      return;
    }

    if(newDirection.direction === this._currentDirection) {
      return;
    }

    if(_.isObject(newDirection.trigger)) {
      if(newDirection.direction !== 'long') {
        log.warn(
          'Strategy adviced a stop on not long, this is not supported.',
          'As such the stop is ignored'
        );
      } else {

        // the trigger is implemented in a trader
        trigger = newDirection.trigger;

        if(trigger.trailPercentage && !trigger.trailValue) {
          trigger.trailValue = trigger.trailPercentage / 100 * this.candle.close;
          log.info('[StratRunner] Trailing stop trail value specified as percentage, setting to:', trigger.trailValue);
        }
      }
    }
    if(newDirection.limit) {
      limit = newDirection.limit;
    }
    if(newDirection.margin) { // this.is.margin.trade!
      margin = newDirection.margin;
    }
    newDirection = newDirection.direction;
  }

  // I commented this out so Gekko will buy even if it bought previously
  // if(newDirection === this._currentDirection) {
  //   return;
  // }

  if(newDirection === 'short' && this._pendingTriggerAdvice) {
    this._pendingTriggerAdvice = null;
  }

  this._currentDirection = newDirection;

  this.propogatedAdvices++;

  const advice = {
    id: 'advice-' + this.propogatedAdvices,
    recommendation: newDirection,
  };
  if(limit) {
    advice.limit = limit;
  }
  if(trigger) {
    advice.trigger = trigger;
    this._pendingTriggerAdvice = 'advice-' + this.propogatedAdvices;
  } else {
    this._pendingTriggerAdvice = null;
  }
  if(margin) {
    advice.margin = margin;
  }
  this.emit('advice', advice);

  return this.propogatedAdvices;
}

Base.prototype.notify = function(content) {
  this.emit('stratNotification', {
    content,
    date: new Date(),
  })
}

Base.prototype.finish = function(done) {
  // Because the strategy might be async we need
  // to be sure we only stop after all candles are
  // processed.
  if(!this.asyncTick) {
    this.endWrapper();
    return done();
  }

  if(this.age === this.processedTicks) {
    this.endWrapper();
    return done();
  }

  // we are not done, register cb
  // and call after we are..
  this.finishCb = done;
}
module.exports = Base;
