const log = require('../../core/log');
const moment = require('moment');
const _ = require('lodash');
const Sequelize = require('sequelize');
const Db = require('./db');

const util = require('../../core/util.js');
const fs = require('fs');

const results = [];

let candleCur, config, sequelize, db;
const debug = true;

const Actor = function(done) {
  consoleLog('gekkosPersistent: constructor');
  _.bindAll(this);
  setupActor();
  done();
}
function setupActor() {
  config = util.getConfig();
  let connectionString = config.postgresql.connectionString + '/' + config.postgresql.database;
  sequelize = new Sequelize(connectionString);

  db = new Db();

  let date;

  Actor.prototype.processCandle = function(candle, done) {
    this.price = candle.close;
    this.marketTime = candle.start;
    date = candle.start;
    candleCur = candle;
    done && done();

  };

  Actor.prototype.processAdvice = function(advice, done) {
    consoleLog('gekkosPersistent: processAdvice');
    consoleLog(JSON.stringify(advice));
    done && done();

  };
  Actor.prototype.processTradeCompleted = function(trade, done) {
    consoleLog('gekkosPersistent: processTradeCompleted');
    consoleLog(JSON.stringify(trade));
    done && done();
  };
  Actor.prototype.processStratWarmupCompleted  = function() {
  }
  Actor.prototype.processStratNotification = function({ content }) {
    consoleLog('gekkosPersistent: processStratNotification');
    consoleLog(JSON.stringify(content));
  };
  Actor.prototype.processPortfolioChange = function(portfolio) {
    consoleLog('gekkosPersistent: processPortfolioChange');
    consoleLog(JSON.stringify(portfolio));
    try {
      let res = db.portfolioChangeForAccount(portfolio, config)
    } catch (err1) {
      consoleLog(err1);
    }
  };
  Actor.prototype.processPortfolioValueChange = function(portfolio) {
    consoleLog('gekkosPersistent: processPortfolioValueChange');
    consoleLog(JSON.stringify(portfolio));
  };
  Actor.prototype.finalize = function(done) {
    consoleLog('gekkosPersistent: finalize');
  };
}

module.exports = Actor;

function consoleLog(msg){
  if(debug) {
    console.log(msg);
  }
}
