// required indicators
// Simple Moving Average - O(1) implementation

var Indicator = function(windowLength, existing) {
  this.input = 'price';
  this.windowLength = windowLength;

  if (existing) {
    this.prices = existing.prices || [];
    this.result = existing.result || 0;
    this.age = existing.age || 0;
    this.sum = existing.sum || 0;
    Object.assign(this, existing);
  } else {
    this.prices = [];
    this.result = 0;
    this.age = 0;
    this.sum = 0;
  }
}

Indicator.prototype.update = function(price) {
  var tail = this.prices[this.age] || 0; // oldest price in window
  this.prices[this.age] = price;
  this.sum += price - tail;
  this.result = this.sum / this.prices.length;
  this.age = (this.age + 1) % this.windowLength
}

module.exports = Indicator;
