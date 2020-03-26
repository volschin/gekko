// IAmRich strategy
// v-2

let bb = require('./indicators/BB.js');
let rsi = require('./indicators/RSI.js');

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

  this.name = '$lon-IAmRich-2';
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
  aaatLengh = this.settings.aaat.lengthMultiplyer || 24;
  // create candle batchers for N minute candles, where N = lengthMultiplyer
  let batcherAaat = new CandleBatcher(aaatLengh);
  let aaatInd = new AAAT({
    debug: false,
    useHeiken: this.settings.aaat.USE_HEIKEN
  });
  const USE_MARKET_LOST_FOR_TREND = this.settings.USE_MARKET_LOST_FOR_TREND;
  const EXIT_ON_AAAT_CHANGE = this.settings.EXIT_ON_AAAT_CHANGE;

  this.updateAaat = function(candle) {
    if(this.debug) {
      this.consoleLog(`strat updateAaat:: candle: ${JSON.stringify(candle)}`);
    }
    aaatInd.update(candle);

    // MAs:
    shortMA60.update(candle.close);
    middleMA60.update(candle.close);
    longMA60.update(candle.close);
    longCandle = candle;
  }
  batcherAaat.on('candle', this.updateAaat);

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
    if(this.debug) {
      this.consoleLog(`strat check:: ${ ''
        } candle.close: ${ candle.close }, candle.volume: ${ candle.volume
        } longCandle.start: ${ JSON.stringify(longCandle && longCandle.start) }, longCandle.close: ${ longCandle && longCandle.close }, longCandle.volume: ${longCandle && longCandle.volume
        } aaatStop: ${ aaatStop }, aaatTrendUp: ${ aaatTrendUp
        // }, ma.short: ${ shortMA60.result }, ma.middle: ${ middleMA60.result }, ma.long: ${ longMA60.result
        // }, rsiVal: ${ rsiVal }, bb.lower: ${ bb.lower }, bb.upper: ${ bb.upper }, bb.middle: ${ bb.middle
        // }, advised: ${ advised }, tradeInitiated: ${ tradeInitiated
      }`);
    }
    // цена пересекла зеленую
    if(!this.advised && aaatTrendUp && (candle.low < aaatStop) && (candle.close > aaatStop) && !isMarketLostForThisTrend) {
      hadTrade = true;

      this.buy(`цена пересекла зеленую: aaaStop: ${ JSON.stringify( aaatStop )}, longCandle: ${ JSON.stringify( longCandle )}`, { limit: aaatStop });
    }
    if (this.advised) {
      if(EXIT_ON_AAAT_CHANGE && aaatTrendUpPrev === true && aaatTrendUp === false) {
        this.sell(`SELL!!: EXIT - зеленая сменилась на красную!`);
      }
      if (candle.close >= this.buyPrice * this.settings.takeProfit) {
        this.sell(`SELL!!: TAKE PROFIT, buy: ${ this.buyPrice }, sell: ${candle.close}`);
      } else if(longCandle.close < aaatStop) {
      // } else if (candle.close < aaatStop) {
        // stop loss, urgent sell!
        // this.sell('exiting: long candle close below aaat!');
        totalTradesLongCandleBelowAaat++;
        if(USE_MARKET_LOST_FOR_TREND) {
          isMarketLostForThisTrend = true;
        }
      } else if (candle.close <= this.buyPrice * this.settings.stopLoss) {
        // if (candle.close < aaatStop) {
        // stop loss, urgent sell!
        this.sell(`stop loss: below ${ this.settings.stopLoss }%`);
        totalTradesAaatStopLoss++;
        if(USE_MARKET_LOST_FOR_TREND) {
          isMarketLostForThisTrend = true;
        }
      }
    }
    if(aaatTrendUp) {
      if(greenPrev !== aaatStop) {
      }
      if(!aaatTrendUpPrev) {
        // trend changed to up again
        totalUptrends++;
        isMarketLostForThisTrend = false;
      }
    } else {
      hadTrade = false;
      if(aaatTrendUpPrev) {
        // trend changed to dn again
        totalDntrends++;
        isMarketLostForThisTrend = false;
      }
    }
    aaatTrendUpPrev = aaatTrendUp;
  }

  this.end = function(a, b, c) {
    console.error('Here is some statistics for you Sir:')
    console.error(`totalUptrends: ${ totalUptrends }, totalDntrends: ${ totalDntrends }, totalBought: ${ totalBought } (out of ${ totalBoughtAttempts
    } attempts), totalSold: ${ totalSold
    } (out of ${ totalSoldAttempts
    } attempts), statsTotalTradesSuccess: ${ totalTradesSuccess
    }, totalTradesLongCandleBelowAaat: ${ totalTradesLongCandleBelowAaat
    }, totalTradesAaatStopLoss: ${ totalTradesAaatStopLoss
      // }, totalHighVolumeCandles: ${ totalHighVolumeCandles
    }`);
  };
}
strat.check = function() {

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
