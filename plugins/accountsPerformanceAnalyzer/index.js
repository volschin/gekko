const log = require('../../core/log');
const moment = require('moment');
const _ = require('lodash');
const Db = require('../gekkosPersistent/db');

const util = require('../../core/util.js');
const fs = require('fs');

const results = [];

let candleCur, config, db;
const debug = true;

const Actor = function(done) {
  consoleLog('accountsPerformanceAnalyzer: constructor');
  _.bindAll(this);
  done();
  // setupActor();
  // _.isFunction(done) && done();
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

  Actor.prototype.processAdvice = function(advice) {
  };
  Actor.prototype.processTradeCompleted = function(trade) {
  };
  Actor.prototype.processStratWarmupCompleted  = function() {
  }
  Actor.prototype.processStratNotification = function({ content }) {
  };
  Actor.prototype.processPortfolioChange = function(portfolio) {
  };
  Actor.prototype.processPortfolioValueChange = function(portfolio) {
  };
  Actor.prototype.processPerformanceReport = function(report) {
  };
  Actor.prototype.finalize = function(done) {
    consoleLog('accountsPerformanceAnalyzer: finalize');
    db.close();
  };
}

module.exports = Actor;

function consoleLog(msg){
  if(debug) {
    console.log(msg);
  }
}
