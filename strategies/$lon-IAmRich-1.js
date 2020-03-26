// IAmRich strategy
// v-1

let strat = {};
const CandleBatcher = require('../core/candleBatcher');

const SMA = require('../strategies/indicators/SMA.js');
const EMA = require('../strategies/indicators/EMA.js');

let MA = SMA;

strat.init = function() {

  let aaatLengh, aaatTrendUp, aaatTrendUpPrev, aaatStop, bb, rsi, rsiVal, longCandle, isMarketLostForThisTrend = false;
  let totalUptrends = 0, totalDntrends = 0, totalBought = 0, totalSold = 0, totalBoughtAttempts = 0, totalSoldAttempts = 0,
    totalTradesSuccess = 0, totalTradesLongCandleBelowAaat = 0, totalTradesAaatStopLoss = 0, totalHighVolumeCandles = 0;
  let greenPrev = 0, redPrev = 0;

  this.name = '$lon-IAmRich-1';
  // debug? set to false to disable all logging/messages/stats (improves performance in backtests)
  this.config.silent = false;
  this.config.debug = true;
  this.debug = true;
  this.requiredHistory = this.tradingAdvisor.historySize;

  // define the indicators we need
  this.addIndicator('bb', 'BBANDS', this.settings.bbands);
  this.addIndicator('rsi', 'RSI', this.settings.rsi);

  let shortMA15 = new MA(21);
  let middleMA15 = new MA(100);
  let longMA15 = new MA(200);
  let shortMA60 = new MA(21);
  let middleMA60 = new MA(100);
  let longMA60 = new MA(200);
  let hadTrade = false;

  let AAAT = require('./indicators/Adaptive-ATR-ADX-Trend');
  aaatLengh = this.settings.aaat.lengthMultiplyer || 4;
  // create candle batchers for N minute candles, where N = lengthMultiplyer
  let batcherAaat = new CandleBatcher(aaatLengh);
  let aaatInd = new AAAT({
    debug: false,
    useHeiken: this.settings.aaat.USE_HEIKEN
  });

  this.update60 = function(candle) {
    if(this.debug) {
      this.consoleLog(`strat updateAaat:: candle: ${JSON.stringify(candle)}`);
    }
    aaatInd.update(candle);

    // MAs:
    shortMA60.update(candle.close);
    middleMA60.update(candle.close);
    longMA60.update(candle.close);
  }
  batcherAaat.on('candle', this.update60);

  this.update = function(candle) {

    batcherAaat.write([candle]);
    batcherAaat.flush();

    bb = this.indicators.bb; //bb: upper, middle, lower
    rsi = this.indicators.rsi;
    rsiVal = rsi.result;
    aaatTrendUp = aaatInd.result.trend === 1;
    aaatStop = aaatInd.result.stop;

    shortMA15.update(candle.close);
    middleMA15.update(candle.close);
    longMA15.update(candle.close);
  }

  this.check = function(candle) {
    let candlePrev = this.candlesArr[1];
    if(this.debug) {
      // consoleLog(`strat check:: price: ${ price }, aaat: ${ JSON.stringify(aaat) }`);
      this.consoleLog(`strat check:: candle.close: ${ candle.close }, candle.volume: ${ candle.volume }, ma.short: ${ shortMA60.result }, ma.middle: ${ middleMA60.result }, ma.long: ${ longMA60.result }, rsiVal: ${ rsiVal }, aaatStop: ${ aaatStop }, aaatTrendUp: ${ aaatTrendUp }, bb.lower: ${ bb.lower }, bb.upper: ${ bb.upper }, bb.middle: ${ bb.middle }`);
    }

    if(aaatTrendUp) {
      if(candlePrev.volume > 1000 && candlePrev.close > candlePrev.open && isSingleDirectionMoveCandle(candlePrev)) {
        // console.error('взмыла, можно продавать: '+ JSON.stringify(candlePrev));
        //
        totalHighVolumeCandles++;
        candlePrev.isHighVolumeUp = true;
      }
      if(candlePrev.volume > 1500 && candlePrev.close < candlePrev.open && isSingleDirectionMoveCandle(candlePrev)) {
        // console.error('упала, можно покупать: '+ JSON.stringify(candlePrev))
        totalHighVolumeCandles++;
        candlePrev.isHighVolumeDown = true;
      }

      if(!this.advised) {
        if (candle.close <= bb.lower && rsiVal <= this.settings.rsi.low && candle.close > aaatStop) {
          //this.buy('bb-rsi trending up');
        }
        // цена на n% ниже чем оранжевая часовая МА (в рассчете на то, что должна к ней вернуться)
        if(candle.close < shortMA60.result && ((shortMA60.result - candle.close) / candle.close) > this.settings.percentBelowMa) {
          if(candle.close < middleMA60.result || candle.close < longMA60.result) {
            if(this.settings.bullTrendMa15 ? middleMA15.result > longMA15.result: true) {
              this.buy('цена на n% ниже чем оранжевая часовая МА');
            }
          }
        }
        if(candle.low < aaatStop && candle.close > aaatStop) {
          // this.limit = aaatStop;
          // this.buy('crossed stop trending up');
        }
        if(candle.close <= bb.middle && candle.close > aaatStop) {
          // this.buy('bb.lower crossed');
        }
        // volume  based (buy after volume up / sell after volume down):
        if(candlePrev.isHighVolumeDown  && !this.candlesArr[2].isHighVolumeUp && candle.close > aaatStop) {

        }
        // this.buy('candlePrev.isHighVolumeDown');
        if( candle.low < shortMA60.result && candle.close > aaatStop && !hadTrade) {
          hadTrade = true;
          //this.buy('lower than 21 ma');
        }
      } else {
        if (candle.close < aaatStop) {
          // stop loss, urgent sell!
          // this.sell('stop loss, urgent sell!');
          // totalTradesAaatStopLoss++;
        } else if(candle.close > bb.middle && rsiVal >= this.settings.rsi.high) {
          //this.sell('bb-rsi trending down');
        }
        if (candle.close >= this.buyPrice * this.settings.takeProfit) {
          console.error(`${ this.buyPrice }, ${ candle.close }`)
          this.sell(`SELL!!: TAKE PROFIT, buy: ${ this.buyPrice }, sell: ${ candle.close }`);
          totalTradesSuccess++;
        }
        if(candlePrev.isHighVolumeUp) {
          // взмыла, можно продавать
          // console.error('взмыла, можно продавать: '+ JSON.stringify(candlePrev))
          // this.sell('взмыла, можно продавать');
        }
        if( candle.high > middleMA60.result || candle.high > longMA60.result) {
          // this.sell('upper than 100ma')
        }
      }
      if(!aaatTrendUpPrev) {
        // trend changed to up once more
        totalUptrends++;
      }
    } else {

      hadTrade = false;
      if(this.advised) {
        if(candle.close <= this.buyPrice * 0.95) {
          // this.sell('stop loss, trending dn, stop loss 10%');
        }
        // this.sell('stop loss, trending dn!');
      }
    }
    aaatTrendUpPrev = aaatTrendUp;
  }

  this.end = function(a, b, c) {
    console.error('Here is some statistics for you Sir:')
    console.error(`totalUptrends: ${ totalUptrends }, totalBought: ${ totalBought } (out of ${ totalBoughtAttempts } attempts), totalSold: ${ totalSold
      } (out of ${ totalSoldAttempts } attempts), statsTotalTradesSuccess: ${ totalTradesSuccess }, totalTradesAaatStopLoss: ${ totalTradesAaatStopLoss
    }, totalHighVolumeCandles: ${ totalHighVolumeCandles }`);

  }

  const printCandle = function(candle) {
    this.consoleLog(`strat check:: candle.close: ${ candle.close }, candle.volume: ${ candle.volume }, rsiVal: ${ rsiVal }, aaatStop: ${ aaatStop }, aaatTrendUp: ${ aaatTrendUp }, bb.lower: ${ bb.lower }, bb.upper: ${ bb.upper }, bb.middle: ${ bb.middle }, advised: ${ this.advised }, tradeInitiated: ${ this.tradeInitiated }`);
  }
}

strat.check = function(){
  // gekko stub
}
module.exports = strat;


const isSingleDirectionMoveCandle = function(candle1) {
  let ret;
  if(Math.abs(candle1.high - candle1.low) * 0.7 <= Math.abs(candle1.close - candle1.open)) {
    ret = true;
  } else {
    ret = false;
  }
  return ret;
}

/*

Оптимальные настройки для пар:

BEST:

btc/usdt, 15mo - 51.5%:
takeProfit = 1.01
percentBelowMa = 0.017
bullTrendMa15 = false

eth/usdt, 15mo - 91.19%:
takeProfit = 1.01
percentBelowMa = 0.03
bullTrendMa15 = false

ltc/usdt, 15mo - 67.7%:
takeProfit = 1.01 # take profit when price 0.8% bigger than buy price
percentBelowMa = 0.03 # цена на 1.7% ниже чем оранжевая часовая МА (в расчете на то, что должна к ней вернуться)
bullTrendMa15 = false

ltc/btc, 3mo - 5%:
takeProfit = 1.01
percentBelowMa = 0.017
bullTrendMa15 = true


 */
