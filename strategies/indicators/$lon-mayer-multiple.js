// Ash's MM for Gekko
// Taken from JackNYC:
// https://www.tradingview.com/script/nMt7RD5u-Mayer-Multiple-with-muti-color-histogram/
const LENGHT_DEFAULT = 200;
const THRESHOLD_DEFAULT = 2.4;
const UNDERVALUE_DEFAULT = 1.0;
const SMA = require('./SMA.js');

let length, threshold, undervalue;

var Indicator = function(options = {}){
  this.input = 'candle';

  this.config = {
    length: options.length || LENGHT_DEFAULT, // threshold
    threshold: options.threshold || THRESHOLD_DEFAULT, // psma_length
    undervalue: options.undervalue || UNDERVALUE_DEFAULT, // undervalue
  }
  threshold = this.config.threshold;
  undervalue = this.config.undervalue;
  length = this.config.length;

  this.candleCur = {
    high: null,
    low: null,
    open: null,
    close: null,
  }

  this.sma = new SMA(length);
}

Indicator.prototype.update = function(candle) {
  this.sma.update(candle.close);

  const maResult = this.sma.result;

  let multiple = candle.close / maResult;

  this.result = multiple;
  this.advice = multiple > threshold ? 'short': multiple < undervalue ? 'long' : null;
}

module.exports = Indicator;
