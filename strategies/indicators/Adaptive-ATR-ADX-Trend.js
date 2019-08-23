//@version=3
// Constructs the trailing ATR stop above or below the price, and switches
// directions when the source price breaks the ATR stop. Uses the Average
// Directional Index (ADX) to switch between ATR multipliers. The higher
// multiplier is used when the ADX is rising, and the lower ATR multiplier
// is used with the ADX is falling. This ADX criteria further widens the gap
// between the source price and the trailing ATR stop when the price is trending,
// and lessens the gap between the ATR and the price when then price is not
// trending.
//
// The ATR-ADX stop is effectively a double adapative stop that trails the price,
// by both adapting to the true range of the price, and the average directional
// change. When the stop is below the price (long trade) the value never decreases
// until the price intersects the stop, and it reverses to being above the price
// (short trade). When the stop is above the price it will never increase until
// it is intersected by the price. As the true range and ADX change, the stop
// will move more quickly or more slowly.

// http://www.fxtsp.com/1287-doubly-adaptive-profit-average-true-range-objectives/
// ash: taken from :  https://www.tradingview.com/script/H48yeyRa-Adaptive-ATR-ADX-Trend-V2/
// and here: https://www.prorealcode.com/prorealtime-indicators/adaptive-atr-adx-trend/
// and here: https://forum.gekko.wizb.it/thread-1431.html
// and here: https://github.com/RJPGriffin/gekko/blob/develop/strategies/ATR_ADX0.js (backtesting settings)
// ...       https://github.com/RJPGriffin/gekko/blob/develop/strategies/ATR_ADX_v2.js (strat)
const _ = require('lodash');
const SMA = require('./SMA');
const ATR = require('./ATR');
const log = require('../../core/log');

// --- settings
const atrLen = 14;
const m1 = 3.5; //"ATR Multiplier - ADX Rising"
const m2 = 1.75; //"ATR Multiplier - ADX Falling"
const adxLen = 14;
const adxThresh = 25; //"ADX Threshold"
const aboveThresh = true; //true, title = "ADX Above Threshold uses ATR Falling Multiplier Even if Rising?")
const useHeiken = false; //(false, title = "Use Heiken-Ashi Bars (Source will be ohlc4)")
// --- end of settings
const block = 0.000010; // BIG QUESTION!! taken from TV
let isDebug = false;
let previousCandle = { //Initialise previousCandle with 0
  "open": null,
  "close": null,
  "high": null,
  "low": null
};
let res = 0;

const Indicator = function(settings) {
  this.settings = settings || {}; // not used now
  this.input = 'candle';

  this.sma = new SMA(adxLen);
  this.atr = new ATR(atrLen);
  isDebug = this.settings.debug || isDebug;
  DXArr = new Array(adxLen).fill(0);
}
Indicator.prototype.update = function(candle) {
  counter++;
  if(counter % 60 === 0){
    // plus 1 hr:

  }
  this.atr.update(candle);

  res = atrCalc.call(this, candle);

  this.result = res;

  previousCandle = candle; //for HA calculation

  return this.result;
}

let counter = 0, high, low, close, highPrev, lowPrev, closePrev, hR, lR, dmPos, dmNeg, tr, sTR, sTRPrev, sDMPos, sDMPosPrev, sDMNeg, sDMNegPrev,
  DIP, DIN, DX, DXArr, adx, adxPrev,
  atr, m, mPrev, mUp, mDn, src, src_, src_Prev, c, cPrev, t, up, dn, TUp, TUpPrev, TDown, TDownPrev, trend, trendPrev, stop, trendChange;

const atrCalc = function(candle){
  let ret = 0;
  // DI-Pos, DI-Neg, ADX
  high = candle.high;
  low = candle.low;
  close = candle.close;

  highPrev = previousCandle.high || high;
  lowPrev = previousCandle.low || low;
  closePrev = previousCandle.close || close;

/*
  highPrev = !_.isUndefined(previousCandle.high) ? previousCandle.high : high;
  lowPrev = !_.isUndefined(previousCandle.low) ? previousCandle.low : low;
  closePrev = !_.isUndefined(previousCandle.close) ? previousCandle.close : close;
*/

  hR = high-highPrev;
  lR = -(low-lowPrev);

  dmPos = hR > lR ? Math.max(hR, 0) : 0;
  dmNeg = lR > hR ? Math.max(lR, 0) : 0;

  tr = Math.max(high - low, Math.abs(high - closePrev), Math.abs(low - closePrev));
  sTR = tr;

  sTR = nz(sTRPrev, sTR) - nz(sTRPrev, sTR) / adxLen + tr;
  sDMPos = nz(sDMPosPrev) - nz(sDMPosPrev) / adxLen + dmPos;
  sDMNeg = nz(sDMNegPrev) - nz(sDMNegPrev) / adxLen + dmNeg;

  DIP = sDMPos / sTR * 100;
  DIN = sDMNeg / sTR * 100;
  DX = Math.abs(DIP - DIN) / (DIP + DIN) * 100;
  // 21:38 - adx 20.7265
  DXArr.push(DX);
  DXArr.shift();
  adx = sma(DXArr, adxLen);


  // Heikin-Ashi
  // пока без хайкина, тк. с ним мне не понравилиьсь графики (см живой график-галочка)
  /*xClose = ohlc4
  xOpen = open
  xOpen := (nz(xOpen[1]) + nz(xClose[1])) / 2
  xHigh = max(high, max(xOpen, xClose))
  xLow = min(low, min(xOpen, xClose))*/

  // Trailing ATR

  /*v1 = abs(xHigh - xClose[1])
  v2 = abs(xLow - xClose[1])
  v3 = xHigh - xLow
  trueRange = max(v1, max(v2, v3))*/
  // atr = useHeikin ? rma(trueRange, atrLen) : atr(atrLen)

  atr = this.atr.result;
  if(_.isUndefined(adxPrev)) adxPrev = adx;
  if(_.isUndefined(mPrev)) mPrev = m;
  // m := rising(adx, 1) and (adx < adxThresh or not aboveThresh) ? m1 : falling(adx, 1) or (adx > adxThresh and aboveThresh) ? m2 : nz(m[1])
  m = (adx > adxPrev) && ((adx < adxThresh) || !aboveThresh) ? m1 : ((adx < adxPrev) || (adx > adxThresh) && aboveThresh) ? m2 : nz(mPrev);
  mUp = (DIP >= DIN) ? m : m2;
  mDn = (DIN >= DIP) ? m : m2;

  src = ohlc4(candle);
  // src_ = useHeikin ? (xOpen + xHigh + xLow + xClose) / 4 : src
  src_ = src;
  c = close;
  t = hl2(candle);

  up = t - mUp * atr;
  dn = t + mDn * atr;

  if(_.isUndefined(src_Prev)) src_Prev = src_;

  TUp = close;
  if(_.isUndefined(TUpPrev)) TUpPrev = TUp;
  if(_.isUndefined(cPrev)) cPrev = c;
  TUp = Math.max(src_Prev, Math.max(cPrev, closePrev)) > TUpPrev ? Math.max(up, TUpPrev) : up;

  TDown = close;
  if(_.isUndefined(TDownPrev)) TDownPrev = TDown;
  TDown = Math.min(src_Prev, Math.min(cPrev, closePrev)) < TDownPrev ? Math.min(dn, TDownPrev) : dn;

  trend = 1;
  if(_.isUndefined(trendPrev)) trendPrev = trend;
  // trend = Math.min(src_, Math.min(c, close)) > TDownPrev ? 1 : Math.max(src_, Math.max(c, close)) < TUp[1]? -1 : nz(trend[1], 1); // makes sense for Heikin!!!
  trend = (Math.min(src_, c) > TDownPrev) ? 1 : (Math.max(src_, c) < TUpPrev) ? -1 : trendPrev;

  // ceil positive trend to nearest pip/tick, floor negative trend to nearest pip/tick
  stop = (trend === 1) ? Math.ceil(TUp / block) * block : Math.floor(TDown / block) * block;
  trendChange = trend - trendPrev;

  if(trendChange !== 0 && counter > 140) {
    if(false) {
      //log.info(`Date: ${JSON.stringify(candle.start)}, counter: ${counter}, candle ${JSON.stringify(candle)}`);
      console.log(`Date: ${JSON.stringify(candle.start)}, counter: ${counter}, candle ${JSON.stringify(candle)}`);
      console.log(`   hR: ${hR}, lR: ${lR}, dmPos: ${dmPos}, dmNeg: ${dmNeg}`)
      console.log(`   tr: ${tr}, sTR: ${sTR}, sDMPos: ${sDMPos}, sDMPosPrev: ${sDMPosPrev}, sDMNeg: ${sDMNeg}, sDMNegPrev: ${sDMNegPrev}
        , DIP: ${DIP}, DIN: ${DIN}, DX: ${DX}, adx: ${adx}`);
      console.log(`   m: ${m}, mUp: ${mUp}, mDn: ${mDn}, src_: ${src_}, c: ${c}, t: ${t}, up: ${up}, dn: ${dn}, TUp: ${TUp}, TDown: ${TDown}
      , trend: ${trend}, stop: ${stop}, trendChange: ${trendChange}`);
    }
  }

  sTRPrev = sTR;
  sDMPosPrev = sDMPos;
  sDMNegPrev = sDMNeg;
  adxPrev = adx;
  mPrev = m;
  cPrev = c;
  TUpPrev = TUp;
  TDownPrev = TDown;
  src_Prev = src_;
  trendPrev = trend;

  return {
    trend, stop, trendChange,
    //adx,atr, m, src_, TUp, TDown // debug
  }
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

/*Indicator.prototype.check = function(candle) {
  debugger;
  console.error('qwer!')
  this.result = 111;
}*/

// https://www.tradingview.com/pine-script-reference/#fun_rising
// https://www.tradingview.com/script/UscR50Jd-Built-in-rising-function-and-a-custom-one/
// true if current x is greater than any previous x for y bars back, false otherwise.
/*  rising2(x, len) =>
res = true
for i = 1 to len
  res := res and x[i] < x
res*/
const rising = function(X, length){
  let ret = true, x = X[length - 1];
  for(let i = 0; i < length; i++){
    if(X[i] >= x){
      ret = false;
    }
  }
}

module.exports = Indicator;
