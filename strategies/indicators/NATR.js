// @link http://www.stockcharts.com/school/doku.php?id=chart_school:technical_indicators:average_true_range_atr
// formula http://www.fmlabs.com/reference/default.htm?url=ATR.htm
// Gab0 - 01/24/2018

var TRANGE = require('./TRANGE.js');
var SMMA = require('./SMMA.js');

var Indicator = function(period) {
  this.input = 'candle';

  this.indicates = 'volatility (normalized)'; //info purpose

  this.result = false;
  this.age = 0;

  this.trange = new TRANGE();
  this.smooth = new SMMA(period);
}

// https://gekko.wizb.it/docs/strategies/tulip_indicators.html#natr
// natr = (atr(t) / close(t)) * 100
Indicator.prototype.update = function(candle) {
  // The first time we can't calculate based on previous
  // ema, because we haven't calculated any yet.
  this.trange.update(candle);
  this.smooth.update(this.trange.result);
  this.resultAtr = this.smooth.result;
  this.result = ( this.resultAtr / candle.close ) * 100;

  this.age++;
  return this.result;
}

module.exports = Indicator;
