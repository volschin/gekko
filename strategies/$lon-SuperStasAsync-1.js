// SuperStasAsync strategy
// v-1

let bb = require('./indicators/BB.js');
let rsi = require('./indicators/RSI.js');

let strat = {};
const CandleHelper = require('./tools/candleHelper');

const SMA = require('../strategies/indicators/SMA.js');
require('../core/util').setConfigProperty(null, 'candlesArrLength', 50);

let MA = SMA;

strat.init = function() {
  let bb, rsi, rsiVal;

  let totalUptrends = 0, totalBought = 0, totalSold = 0, totalBoughtAttempts = 0, totalSoldAttempts = 0,
    totalTradesSuccess = 0, totalTradesAaatStopLoss = 0, totalHighVolumeCandles = 0;

  this.name = 'SuperStasAsync-1';
  this.config.silent = false;
  this.config.debug = true;
  this.debug = true;
  this.requiredHistory = this.tradingAdvisor.historySize;

  // define the indicators we need
  this.addIndicator('rsi', 'RSI', this.settings.rsi || 14);
  // this.addIndicator('bb', 'BBANDS', this.settings.bb || 14);

  let shortMA60 = new MA(21);
  let middleMA60 = new MA(100);
  let longMA60 = new MA(200);
  let impulseCandle;
  this.update = function(candle) {
    bb = this.indicators.bb; //bb: upper, middle, lower
    rsi = this.indicators.rsi;
    //rsiVal = rsi.result;

    // shortMA15.update(candle.close);
    // middleMA15.update(candle.close);
    // longMA15.update(candle.close);
  };

  this.check = function(candle) {
    let candlePrev = this.candlesArr[1], hasImpulseBefore = false, hasImpulse = false;

    if(this.debug) {
      this.consoleLog(`strat check:: ma.short: ${ shortMA60.result }, ma.middle: ${ middleMA60.result
      }, ma.long: ${ longMA60.result
      // }, rsiVal: ${ rsiVal
      // }, bb.lower: ${ bb.lower }, bb.upper: ${ bb.upper
      // }, bb.middle: ${ bb.middle
      }`);
    }
    if(this.advised) {
      //1 - tpFibLevel = 0.618
      if(candle.close > impulseCandle.low + ((this.buyPrice - impulseCandle.low) * 2 * (1 - this.settings.tpFibLevel))){
        this.sell();
      }
    }
    if(CandleHelper.isVolchokCandle({ candle })) {
      candle.isVolchok = true;

      for(let i = 1; i < this.settings.maxCandlesBetweenImpulseAndVolchok + 1; i++){
        if(CandleHelper.isImpulseCandle({ candle: this.candlesArr[i], candlesArr: this.candlesArr, absDiff: 100, extremumRange: this.settings.extremumCandlesAmount || 10 })){
          hasImpulse = true;
          impulseCandle = this.candlesArr[i];
        }
      }
      if(!this.advised && hasImpulse) {
        this.buy('isVolchok');
      }

      // hasImpulseBefore = !!candlesArr.slice(0, this.settings.maxCandlesBetweenImpulseAndVolchok || 3).find(c => !!c.isImpulse);
      // if(hasImpulseBefore) {
      //   this.buy('isVolchok');
      // }
    }
  };
}

strat.check = function(){
  // gekko stub
}

module.exports = strat;


