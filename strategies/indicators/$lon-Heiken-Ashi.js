// https://www.investopedia.com/terms/h/heikinashi.asp

var Indicator = function(){
  this.input = 'candle';
  this.candleCur = {
    high: null,
    low: null,
    open: null,
    close: null,
  }
  this.first = true;
}

Indicator.prototype.update = function(candle) {

  if(this.first) {
    this.first = false;
    this.curClose = (candle.close + candle.open + candle.low + candle.high) / 4;
    this.curOpen = (candle.open + candle.close) / 2;
    this.curHigh = candle.high;
    this.curLow = candle.low;
  } else {
    this.curClose = (candle.close + candle.open + candle.low + candle.high) / 4;
    this.curOpen = (this.candlePrev.open + this.candlePrev.close) / 2;
    this.curHigh = Math.max(candle.high, this.curOpen, this.curClose);
    this.curLow = Math.min(candle.low, this.curOpen, this.curClose);
  }

  this.candleCur = {
    close: this.curClose,
    open: this.curOpen,
    high: this.curHigh,
    low: this.curLow,
  }

  this.candlePrev = this.candleCur;

  this.result = Object.assign({}, candle, this.candleCur);
  return this.result;
}

module.exports = Indicator;
