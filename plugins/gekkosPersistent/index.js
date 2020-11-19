const log = require('../../core/log');
const moment = require('moment');
const _ = require('lodash');
const Db = require('./db');

const util = require('../../core/util.js');
const fs = require('fs');

const results = [];

let candleCur, config, db;
const debug = true;

const Actor = function(done) {
  consoleLog('gekkosPersistent: constructor');
  _.bindAll(this);
  setupActor();
  done();
}
function setupActor() {
  config = util.getConfig();

  db = new Db();

  let date;

  Actor.prototype.processCandle = function(candle, done) {
    this.price = candle.close;
    this.marketTime = candle.start;
    date = candle.start;
    candleCur = candle;
    done && done();

  };

  Actor.prototype.processStratUpdate = function({ indicators }, done) {
    db.updateIndicators(config.gekkoId, indicators);
    done && done();
  };

  Actor.prototype.processAdvice = function(advice, done) {
    // consoleLog('gekkosPersistent: processAdvice');
    // consoleLog(JSON.stringify(advice));
    done && done();

  };
  Actor.prototype.processTradeCompleted = function(trade, done) {
    // consoleLog('gekkosPersistent: processTradeCompleted');
    // consoleLog(JSON.stringify(trade));
    let tradeInp = {
      tradeId: trade.id,
      gekkoId: config.gekkoId,
      apiKeyName: config.apiKeyName || config.apiKeyNameForBacktest,
      bundleUuid: config.bundleId || config.bundleIdForBacktest,
      json: trade,
    }
    try {
      db.saveTrade(tradeInp);
    } catch (e) {
      consoleLog('gekkosPersistent::processTradeCompleted:error');
      consoleLog(err1);
    }
    done && done();
  };
  Actor.prototype.processStratWarmupCompleted  = function() {
  }
  Actor.prototype.processStratNotification = function({ content }) {
    // consoleLog('gekkosPersistent: processStratNotification');
    // consoleLog(JSON.stringify(content));
  };
  Actor.prototype.processPortfolioChange = async function(portfolio) {
    // consoleLog('gekkosPersistent: processPortfolioChange');
    // consoleLog(JSON.stringify(portfolio));
    try {
      let res = await db.portfolioChangeForAccount(portfolio, config)
    } catch (err1) {
      consoleLog('gekkosPersistent::processPortfolioChange:error');
      consoleLog(err1);
    }
  };
  Actor.prototype.processPortfolioValueChange = function(portfolio) {
    // consoleLog('gekkosPersistent: processPortfolioValueChange');
    // consoleLog(JSON.stringify(portfolio));
  };
  Actor.prototype.finalize = function(done) {
    consoleLog('gekkosPersistent: finalize');
    db.close();
  };
}

module.exports = Actor;

function consoleLog(msg){
  if(debug) {
    console.log(msg);
  }
}
