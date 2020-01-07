const _ = require('lodash');

const CandleHelper = {
  isImpulseCandle: function({ candle = {}, absDiff, relDiff, candlesArr, extremumRange }) {
    let ret = false, minCandle = candlesArr[0], candleCur, isCandleMinimum = false, candleMinimumNum = -1;
    for(let i = 0; i < candlesArr.length; i++) {
      candleCur = candlesArr[i];
      if(candleCur.low !== -1 && candleCur.low < minCandle.low) {
        minCandle = candleCur;
        candleMinimumNum = i;
      }
    }
    if(!extremumRange) {
      isCandleMinimum = minCandle === candle;
    } else {
      isCandleMinimum = candleMinimumNum < extremumRange;
    }
    if(isCandleMinimum) {
      if (absDiff) {
        if (candle.open < candle.close && candle.high - candle.low > absDiff) {
          ret = true;
        }
      } else if (relDiff) {

      }
    }
    return ret;
  },
  /*
  Свечная модель «Волчок» — это свеча, обладающая длинной нижней тенью, длинной верхней тенью и очень маленьким телом.
  Визуально она действительно напоминает волчок, откуда и пошло это название. Цвет тела в данном случае особой роли не играет.
  Если на рынке появляется данная модель, это свидетельствует про неопределенность баланса между медведями и быками.
  http://ru.i-like-trading.com/wp-content/uploads/2017/08/Model-Volchok.jpg
   */
  isVolchokCandle: function({ candle = {}, bodyPart = 0.2, tailsDiff = 0.4 }) {
    let ret = false, tail1, tail2;
    if(candle.open < candle.close) { // green candle
      tail1 = candle.high - candle.close;
      tail2 = candle.open - candle.low;
    } else { // red candle
      tail1 = candle.high - candle.open;
      tail2 = candle.close - candle.low;
    }
    ret = tail1 > 0 && tail2 > 0;
    ret = ret && Math.abs(candle.open - candle.close) / (tail1 + tail2) < bodyPart;
    ret = ret && Math.abs(tail1 - tail2) / (tail1 > tail2 ? tail1: tail2) < tailsDiff;
    return ret;
  }
}

module.exports = CandleHelper;
