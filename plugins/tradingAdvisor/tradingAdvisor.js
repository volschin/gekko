var util = require('../../core/util');
var _ = require('lodash');
var fs = require('fs');
var toml = require('toml');

var config = util.getConfig();
var dirs = util.dirs();
var log = require(dirs.core + 'log');
var CandleBatcher = require(dirs.core + 'candleBatcher');

var moment = require('moment');
var isLeecher = config.market && config.market.type === 'leech';

var Actor = function(done) {
  _.bindAll(this);

  this.done = done;

  this.batcher = new CandleBatcher(config.tradingAdvisor.candleSize);

  this.strategyName = config.tradingAdvisor.method;

  this.setupStrategy();

  var mode = util.gekkoMode();

  const isExactStartAt = !!config.tradingAdvisor.startAtExact;
  // the stitcher will try to pump in historical data
  // so that the strat can use this data as a "warmup period"
  //
  // the realtime "leech" market won't use the stitcher
  if(mode === 'realtime' && !isLeecher || isExactStartAt) {
    var Stitcher = require(dirs.tools + 'dataStitcher');
    var stitcher = new Stitcher(this.batcher);
    stitcher.prepareHistoricalData(done);
  } else
    done();
}

Actor.prototype.setupStrategy = function() {

  if(!fs.existsSync(dirs.methods + this.strategyName + '.js'))
    util.die('Gekko can\'t find the strategy "' + this.strategyName + '"');

  log.info('\t', 'Using the strategy: ' + this.strategyName);

  const strategy = require(dirs.methods + this.strategyName);

  // bind all trading strategy specific functions
  // to the WrappedStrategy.
  let WrappedStrategy;

  if(config.asyncStrategies.indexOf(this.strategyName) > -1) {
    // meaning we want to make async this strat!
    WrappedStrategy = require('./baseTradingMethodAsync');
  } else {
    WrappedStrategy = require('./baseTradingMethod');
  }


  _.each(strategy, function(fn, name) {
    WrappedStrategy.prototype[name] = fn;
  });

  let stratSettings;
  if(config[this.strategyName]) {
    stratSettings = config[this.strategyName];
  }

  this.strategy = new WrappedStrategy(stratSettings);
  this.strategy
    .on(
      'stratWarmupCompleted',
      e => this.deferredEmit('stratWarmupCompleted', e)
    )
    .on('advice', this.relayAdvice)
    .on(
      'stratUpdate',
      e => this.deferredEmit('stratUpdate', e)
    ).on('stratNotification',
      e => this.deferredEmit('stratNotification', e)
    )

  this.strategy
    .on('tradeCompleted', this.processTradeCompleted);

  this.batcher
    .on('candle', _candle => {
      const { id, ...candle } = _candle;
      this.deferredEmit('stratCandle', candle);
      this.emitStratCandle(candle);
    });
}

// HANDLERS
// process the 1m candles
Actor.prototype.processCandle = function(candle, done) {
  this.candle = candle;
  const completedBatch = this.batcher.write([candle]);
  if(completedBatch) {
    this.next = done;
  } else {
    done();
    this.next = false;
  }
  this.batcher.flush();
}

// propogate a custom sized candle to the trading strategy
Actor.prototype.emitStratCandle = function(candle) {
  const next = this.next || _.noop;
  this.strategy.tick(candle, next);
}

Actor.prototype.processTradeInitiated = function(pendingTrade) {
  this.strategy.processPendingTrade(pendingTrade);
}

Actor.prototype.processTradeAborted = function(abortedTrade) {
  this.strategy.processTerminatedTrades(abortedTrade);
}

Actor.prototype.processTradeCancelled = function(cancelledTrade) {
  this.strategy.processTerminatedTrades(cancelledTrade);
}

Actor.prototype.processTradeErrored = function(tradeError) {
  this.strategy.processTerminatedTrades((tradeError));
}

Actor.prototype.processPortfolioChange = function(portfolio) {
  this.strategy.updatePortfolio(portfolio);
}

Actor.prototype.processPortfolioValueChange = function(portfolioValue) {
  this.strategy.newPortfolioValue(portfolioValue);
}

Actor.prototype.processTradeCompleted = function(trade) {
  this.strategy.processTrade(trade);
}

Actor.prototype.processTriggerFired = function(data) {
  this.strategy.triggerFired(data);
}

// Actor.prototype.processTradeErrored = function(trade) {
//   this.strategy.processTrade(trade);
// }

Actor.prototype.processCommand = function(command) {
  if(command && command.command && command.command.name === 'forceBuy') {
    if(this.strategy && this.strategy.buy) {
      // this is wrapped strat, so we need to do strat.buy instead of advise:
      this.strategy.buy('forceBuy command was triggered by user', {
        // todo: add limitPrice and margin to options later
      });
    } else {
      this.relayAdvice({
        // limit: options.limitPrice, // add field in ui later
        direction: 'long',
        // margin: options.margin
      });
    }
  } else if(command && command.command && command.command.name === 'forceSell') {
    if(this.strategy && this.strategy.sell) {
      // this is wrapped strat, so we need to do strat.sell instead of advise:
      this.strategy.sell('forceSell command was triggered by user', {
        // todo: add limitPrice and margin to options later
      });
    } else {
      this.relayAdvice({
        // limit: options.limitPrice, // add field in ui later
        direction: 'short',
        // margin: options.margin
      });
    }
  }
  this.strategy.processCommand(command);
}

// pass through shutdown handler
Actor.prototype.finish = function(done) {
  this.strategy.finish(done);
}

// EMITTERS
Actor.prototype.relayAdvice = function(advice) {
  advice.date = this.candle.start.clone().add(1, 'minute');
  this.deferredEmit('advice', advice);
}


module.exports = Actor;
