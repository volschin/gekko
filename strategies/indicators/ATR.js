// @link http://www.stockcharts.com/school/doku.php?id=chart_school:technical_indicators:average_true_range_atr
// formula http://www.fmlabs.com/reference/default.htm?url=ATR.htm
// Gab0 - 01/24/2018

var TRANGE = require('./TRANGE.js');
var SMMA = require('./SMMA.js');

var Indicator = function(period, existing) {
  this.input = 'candle';

  this.indicates = 'volatility'; //info purpose

  if (existing) {
    this.result = existing.result || false;
    this.age = existing.age || 0;
    Object.assign(this, existing);
  } else {
    this.result = false;
    this.age = 0;
  }

  this.trange = new TRANGE(existing && existing.trange);
  this.smooth = new SMMA(period, existing && existing.smooth);
}

Indicator.prototype.update = function(candle) {
  // The first time we can't calculate based on previous
  // ema, because we haven't calculated any yet.
  this.trange.update(candle);
  this.smooth.update(this.trange.result);

  this.result = this.smooth.result;

  this.age++;
  return this.result;
}

module.exports = Indicator;
