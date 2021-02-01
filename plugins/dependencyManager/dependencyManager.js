const log = require('../../core/log');
const moment = require('moment');
const _ = require('lodash');
const util = require('../../core/util.js');
const config = util.getConfig();
let cache = require('../../web/state/cache');
const fs = require('fs');
const DependencyManager = require('./web');
const results = [];

let candleCur;

var Actor = function() {
  if(config.isDependency) {
    // this.price = 'N/A';
    console.log('dependencyManager: constructor');
    this.marketTime = {
      format: function() {
        return 'N/A'
      }
    };
    _.bindAll(this);
    setupActor();
  }
}
function setupActor() {
  let date;
  Actor.prototype.processCandle = function(candle, done) {
    this.price = candle.close;
    this.marketTime = candle.start;
    date = candle.start;
    candleCur = candle;
    done();
  };

  Actor.prototype.processAdvice = function(advice, done) {
    //done();
  };
  let buyReason, sellReason, result;
  Actor.prototype.processStratNotification = function({ content }) {
    // console.log('process dependency Strategy Notification: ', content);
    // console.log(cache);
    if (content.type === 'dependency-trend-change') {
      console.info(date.toString());

      result = {
        data: content.data,
        date: date,
        ts: new Date(date).getTime()
      }
      results.push(result);
      //  console.log(result)
    }
    /*if(content.type === 'buy advice' ){
      buyReason = content.reason;
      // ‌‌this.marketTime.toString() - ‌Mon Jul 15 2019 23:07:00 GMT+0300
      // JSON.stringify(content.data) - ‌{"trend":1,"stop":10111.31106,"trendChange":2}
    } else if( content.type === 'sell advice'){
      sellReason = content.reason;
    }*/
  };
  Actor.prototype.finalize = function(done) {
    const fileName = `${ util.dirs().gekko }/logs/${ DependencyManager.GetNameFromConfig(config) }.json`;
    console.error('DependencyManagerPlugin: finalize, write to: ', fileName);

    fs.writeFile(
      fileName,
      JSON.stringify(results),
      err => {
        console.error('writeFile - done');

        if(err) {
          log.error('unable to write backtest result', err);
        } else {
          log.info('written backtest to: ', util.dirs().gekko + fileName);
        }
        done();
      }
    );
  };
}

module.exports = Actor;
