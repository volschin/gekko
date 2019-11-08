// Ash's MM for Gekko
// Taken from JackNYC:
// https://www.tradingview.com/script/nMt7RD5u-Mayer-Multiple-with-muti-color-histogram/
const LENGHT_DEFAULT = 200;
const THRESHOLD_DEFAULT = 2.4;
const UNDERVALUE_DEFAULT = 1.0;
const SMA = require('./SMA.js');

var Indicator = function(options = {}){
  this.input = 'candle';

  this.config = {
    length: options.length || LENGHT_DEFAULT, // threshold
    threshold: options.threshold || THRESHOLD_DEFAULT, // psma_length
    undervalue: options.undervalue || UNDERVALUE_DEFAULT, // undervalue
  }

  this.candleCur = {
    high: null,
    low: null,
    open: null,
    close: null,
  }

  this.sma = new SMA(this.config.length);
  // this.first = true;
}

Indicator.prototype.update = function(candle) {
  const threshold = this.config.threshold;
  const undervalue = this.config.undervalue;

  this.sma.update(candle.close);

  let multiple = candle.close / this.sma.result;

  this.result = multiple;
  this.advice = multiple > threshold ? 'short': multiple < undervalue ? 'long' : null;
}

module.exports = Indicator;
