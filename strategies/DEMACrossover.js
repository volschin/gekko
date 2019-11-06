// Source: https://raw.githubusercontent.com/vrfurl/gekko/stable/strategies/DEMACrossover.js
// Downloaded from: https://github.com/xFFFFF/Gekko-Strategies
// helpers
var _ = require('lodash');
var log = require('../core/log.js');

// let's create our own method
var method = {};

// prepare everything our method needs
method.init = function() {
  const config = require ('../core/util').getConfig() || {};
  this.trailingStop = this.settings.trailingStop;

  this.name = 'DEMACrossover';
  this.debug = true;


  // performance
  config.backtest.batchSize = 1000; // increase performance
  config.silent = true;
  config.debug = false;

  this.currentTrend;
  this.requiredHistory = 0;

  // define the indicators we need
  //this.addIndicator('dema', 'DEMA', this.settings);

  //Determine if we first want to buy or sell
  if(this.settings.firstTrade === 'buy') {
    this.currentTrend = 'down';
  }
  else if(this.settings.firstTrade === 'sell'){
    this.currentTrend = 'up';
  }

  consoleLog("Short DEMA size: "+this.settings.shortSize);
  consoleLog("Long DEMA size: "+this.settings.longSize);

  this.addIndicator('shortDEMA', 'DEMA', { weight: this.settings.shortSize });
  this.addIndicator('longDEMA', 'DEMA', { weight: this.settings.longSize });
  // this.addTalibIndicator('shortDEMA', 'dema', {optInTimePeriod : this.settings.shortSize});
  // this.addTalibIndicator('longDEMA', 'dema', {optInTimePeriod : this.settings.longSize});

  consoleLog(this.name+' Strategy initialized');

}

// what happens on every new candle?
method.update = function(candle) {
  // nothing!
}

// for debugging purposes: log the last calculated
// EMAs and diff.
method.log = function() {
  var shortDEMA = this.indicators.shortDEMA;
  var longDEMA = this.indicators.longDEMA;


  consoleLog('Required history is: '+this.requiredHistory);

  consoleLog('calculated DEMA properties for candle:');

  consoleLog('\t shortDEMA :', shortDEMA.result);

  consoleLog('\t', 'longDEMA:', longDEMA.result);
}

method.check = function(candle) {

  var shortResult = this.indicators.shortDEMA.result;
  var longResult = this.indicators.longDEMA.result;
  var price = candle.close;

  var message = '@ ' + price.toFixed(8);

  let time = JSON.stringify(candle.start);
  consoleLog(`ALL INFO: ${ time }, ${ shortResult }, ${ longResult }, ${ price }`);


  //DEMA Golden Cross
  if(shortResult >  longResult) {
    consoleLog('we are currently in uptrend', message);

    if(this.currentTrend !== 'up') {
      this.currentTrend = 'up';

      if(this.trailingStop) {
        this.advice({
          direction: 'long', // or short
          trigger: { // ignored when direction is not "long"
            type: 'trailingStop',
            trailPercentage: this.trailingStop
          }
        });
        consoleLog("Going to buy with trailing stop " + this.trailingStop);
      } else {
        this.advice('long');
        consoleLog("Going to buy");
      }
    } else {
      consoleLog("Nothing to buy");
      //this.advice();
    }

  } else if(longResult > shortResult) {
    consoleLog('we are currently in a downtrend', message);

    if(this.currentTrend !== 'down') {
      this.currentTrend = 'down';
      this.advice('short');
      consoleLog("Going to sell");
    } else
      consoleLog("Nothing to sell");
      // this.advice();

  } else {
    consoleLog('we are currently not in an up or down trend', message);
    // this.advice();
  }
}

const consoleLog = function(msg = '', obj) {
  /*if(obj) {
    console.log(msg, obj);
  } else {
    console.log(msg);
  }*/
}

module.exports = method;
