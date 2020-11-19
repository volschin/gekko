// required indicators
var SMA = require('./SMA');

var Indicator = function (weight, existing) {
  this.input = 'price';
  this.weight = weight;


  if (existing) {
    this.prices = existing.prices || [];
    this.result = existing.result || 0;
    this.age = existing.age || 0;
    Object.assign(this, existing);
  } else {
    this.prices = [];
    this.result = 0;
    this.age = 0;
  }

  this.sma = new SMA(weight, existing && existing.sma);
}

Indicator.prototype.update = function (price) {
  this.prices[this.age] = price;

  if(this.prices.length < this.weight) {
    this.sma.update(price);
  } else if(this.prices.length === this.weight) {
    this.sma.update(price);
    this.result = this.sma.result;
  } else {
    this.result = (this.result * (this.weight - 1) + price) / this.weight;
  }

  this.age++;
}

module.exports = Indicator;
