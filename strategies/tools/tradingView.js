const _ = require('lodash');

const TradingView = function() {

}

TradingView.prototype.f1 = function(name, payload) {
}


// Simple moving average of x for y bars back. https://www.tradingview.com/pine-script-reference/#fun_sma
const sma = function(x, length){
  let sum = 0.0;
  if(x.length < length){
    throw `length should be ${ length }`;
  }
  for (let i = 0; i < length; i++) {
    sum = sum + x[i] / length;
  }
  return sum;
}
const nz = function(value, defaultValue){
  return _.isUndefined(value) ? (_.isUndefined(defaultValue) ? 0 : defaultValue) : value;
}
const ohlc4 = function(candle) {
  return (candle.open + candle.high + candle.low + candle.close) / 4;
}
const hl2 = function(candle) {
  return (candle.high + candle.low) / 2;
}
const valuewhen = function(predicate, source, index){
  // TODO https://www.tradingview.com/pine-script-reference/#fun_valuewhen
}
// https://www.tradingview.com/pine-script-reference/#fun_rma
let sumRma, sumRmaPrev, alphaRma;
const rma = function(x, y) {
  alphaRma = y;
  sumRma = 0.0;
  if(_.isUndefined(sumRmaPrev)) sumRmaPrev = x;

  sumRma = (x + (alphaRma - 1) * sumRmaPrev) / alphaRma;
  sumRmaPrev = sumRma;
  return sumRma;
}
// https://www.tradingview.com/pine-script-reference/#fun_rising
// https://www.tradingview.com/script/UscR50Jd-Built-in-rising-function-and-a-custom-one/
// true if current x is greater than any previous x for y bars back, false otherwise.
/*  rising2(x, len) =>
res = true
for i = 1 to len
  res := res and x[i] < x
res*/

//https://www.tradingview.com/pine-script-reference/#fun_crossover
const crossover = function(X, Y){
  let ret = false;
  if(X && Y && X[0] && X[1] && Y[0] && Y[1]
      && (X[0] > Y[0]) && (X[1] < Y[1])) {
    ret = true;
  }
  return ret;
}
//https://www.tradingview.com/pine-script-reference/#fun_crossunder
const crossunder = function(X, Y){
  let ret = false;
  if(X && Y && X[0] && X[1] && Y[0] && Y[1]
      && (X[0] < Y[0]) && (X[1] > Y[1])) {
    ret = true;
  }
  return ret;
}
const rising = function(X, length){
  let ret = true, x = X[length - 1];
  for(let i = 0; i < length; i++){
    if(X[i] >= x){
      ret = false;
    }
  }
}

// STATICS:
TradingView.sma = sma;
TradingView.nz = nz;
TradingView.ohlc4 = ohlc4;
TradingView.hl2 = hl2;
TradingView.rma = rma;
TradingView.rising = rising;
TradingView.crossover = crossover;
TradingView.crossunder = crossunder;
TradingView.valuewhen = valuewhen;


module.exports = TradingView;
