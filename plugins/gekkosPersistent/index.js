const log = require('../../core/log');
const moment = require('moment');
const _ = require('lodash');
const Sequelize = require('sequelize');

const util = require('../../core/util.js');
// let cache = require('../../web/state/cache');
const fs = require('fs');

const results = [];

let candleCur;
const debug = true;
let config, sequelize;

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
    consoleLog(advice);
    done && done();

  };
  Actor.prototype.processTradeCompleted = function(trade, done) {
    consoleLog('gekkosPersistent: processTradeCompleted');
    consoleLog(trade);
    done && done();
  };
  Actor.prototype.processStratWarmupCompleted  = function() {
  }
  Actor.prototype.processStratNotification = function({ content }) {
    consoleLog('gekkosPersistent: processStratNotification');
    consoleLog(content);
  };
  Actor.prototype.finalize = function(done) {
    consoleLog('gekkosPersistent: finalize');
  };
}

module.exports = Actor;

function consoleLog(msg){
  if(debug) {
    console.log(msg);
    log.info(msg);
  }
}
