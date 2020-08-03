const CandleBatcher = require('../core/candleBatcher');

let strat = {};

strat.init = function(options = {}) {
  let TAKE_PROFIT = this.settings.TAKE_PROFIT || 1.05
    , TIMEOUT_MINUTES = this.settings.TIMEOUT_MINUTES || 1440
    , TRAILING_STOP = this.settings.trailingStop || 5;


  this.config.silent = false;
  this.config.debug = true;
  this.debug = true;

  if (this.config.tradingAdvisor.candleSize !== 60) {
    /*throw {
      error: "This strategy must run with candleSize=60"
    };*/
  }

  // AAAT:
  let AAAT = require('./indicators/Adaptive-ATR-ADX-Trend');
  let aaatLenghLow = 1, aaatLenghMedium = 2, aaatLenghHigh = 4;

  let batcherAaatLow = new CandleBatcher(aaatLenghLow);
  let batcherAaatMedium = new CandleBatcher(aaatLenghMedium);
  let batcherAaatHigh = new CandleBatcher(aaatLenghHigh);
  // let aaatLengh = this.settings.aaat.lengthMultiplyer || 24;
  let aaatIndLow = new AAAT({ debug: false, useHeiken: this.settings.aaat.USE_HEIKEN });
  let aaatIndMedium = new AAAT({ debug: false, useHeiken: this.settings.aaat.USE_HEIKEN });
  let aaatIndHigh = new AAAT({ debug: false, useHeiken: this.settings.aaat.USE_HEIKEN });
  let candle60, candle120, candle240;
  this.updateAaatLow = function(candle = {}) {
    aaatIndLow.update(candle);
    candle60 = candle;
  };
  this.updateAaatMedium = function(candle = {}) {
    aaatIndMedium.update(candle);

    candle120 = candle;
  };
  this.updateAaatHigh = function(candle = {}) {
    aaatIndHigh.update(candle);

    candle240 = candle;
  };
  batcherAaatLow.on('candle', this.updateAaatLow);
  batcherAaatMedium.on('candle', this.updateAaatMedium);
  batcherAaatHigh.on('candle', this.updateAaatHigh);
  // END AAAT

  let aaatResultLow, aaatResultMedium, aaatResultHigh;
  this.update = function(candle = {}) {
    batcherAaatLow.write([candle]); batcherAaatLow.flush();
    batcherAaatMedium.write([candle]); batcherAaatMedium.flush();
    batcherAaatHigh.write([candle]); batcherAaatHigh.flush();
    aaatResultLow = aaatIndLow.result.stop;
    aaatResultMedium = aaatIndMedium.result.stop;
    aaatResultHigh = aaatIndHigh.result.stop;

    if(this.debug && false) {
      this.consoleLog(`strat update:: low: ${ aaatResultLow }, medium: ${ aaatResultMedium }, high: ${ aaatResultHigh }`);
    }

  };

  let totalUptrends = 0, totalDntrends = 0, totalSellTakeProfit = 0,
    totalTradesSuccess = 0, totalTradesLongCandleBelowAaat = 0, totalTradesHighAboveAaatDnTrendRedMedium = 0, totalTradesHighAboveAaatDnTrendRedHigh = 0,
    totalTradesAaatStopLoss = 0, totalHighVolumeCandles = 0,
    totalTradesHighAboveAaatDnTrendGreenMedium = 0, totalTradesHighAboveAaatDnTrendGreenHigh = 0, totalTradesLongCandleAboveAaat = 0;
  this.check = function(candle) {
    if(this.debug && true) {
      this.consoleLog(`strat check:: ${ ''
      } candle.close: ${ candle.close
      // }, candle.volume: ${ candle.volume
      } candle240.start: ${ JSON.stringify(candle240 && candle240.start) }, candle240.close: ${ candle240 && candle240.close
      } aaatResultLow: ${ aaatResultLow }, aaat240Trend: ${ aaatIndHigh.result.trend
      } aaatResultMedium: ${ aaatResultMedium }, aaat240Trend: ${ aaatIndHigh.result.trend
      } aaatResultHigh: ${ aaatResultHigh }, aaat240Trend: ${ aaatIndHigh.result.trend
        // }, ma.short: ${ shortMA60.result }, ma.middle: ${ middleMA60.result }, ma.long: ${ longMA60.result
        // }, rsiVal: ${ rsiVal }, bb.lower: ${ bb.lower }, bb.upper: ${ bb.upper }, bb.middle: ${ bb.middle
        // }, advised: ${ advised }, tradeInitiated: ${ tradeInitiated
      }`);
    }

    // цена пересекла зеленую
    if(!this.advised && aaatIndMedium.result.trend === 1 && (candle.low < aaatResultMedium && candle.close > aaatResultMedium)) {
    // if(!advised && aaatTrendUp && (candle.low < aaatStop) && !isMarketLostForThisTrend) {
      this.buy(`цена пересекла зеленую 120 (${ JSON.stringify( aaatResultMedium )}), candle240: ${ JSON.stringify( candle240 )}`, { limitPrice: aaatResultMedium });

      this.consoleLog(`strat check:: candle240.start: ${ JSON.stringify(candle240 && candle240.start)
      }, candle240.close: ${ candle240 && candle240.close
      }, aaatResultLow: ${ aaatResultLow }, aaat240Trend: ${ aaatIndHigh.result.trend
      }, aaatResultMedium: ${ aaatResultMedium }, aaat240Trend: ${ aaatIndHigh.result.trend
      }, aaatResultHigh: ${ aaatResultHigh }, aaat240Trend: ${ aaatIndHigh.result.trend
        // }, ma.short: ${ shortMA60.result }, ma.middle: ${ middleMA60.result }, ma.long: ${ longMA60.result
        // }, rsiVal: ${ rsiVal }, bb.lower: ${ bb.lower }, bb.upper: ${ bb.upper }, bb.middle: ${ bb.middle
        // }, advised: ${ advised }, tradeInitiated: ${ tradeInitiated
      }`);
    }

    if (this.advised) {
      if(this.settings.aaat.sellOnRedThresholdMedium && aaatIndMedium.result.trend === -1 && candle.high >= aaatResultMedium) { // this never happens (dunno why)
        totalTradesHighAboveAaatDnTrendRedMedium++;
        this.sell(`SELL!!: crossed: aaatResultMedium(in dn trend): ${ aaatResultMedium }`, { limitPrice: aaatResultMedium });
      }
      if(this.settings.aaat.sellOnRedThresholdHigh && aaatIndHigh.result.trend === -1 && candle.high >= aaatResultHigh) {
        totalTradesHighAboveAaatDnTrendRedHigh++;
        this.sell(`SELL!!: crossed: aaatResultHigh(in dn trend): ${ aaatResultHigh }`, { limitPrice: aaatResultHigh });
      }
      if (candle.close >= this.buyPrice * this.settings.takeProfit) {
        totalSellTakeProfit++;
        this.sell(`SELL!!: TAKE PROFIT, bought@ ${ this.buyPrice }, sell: ${candle.close}`);
      // } else if(candle120.close < aaatResultHigh) {
      // } else if(candle240.close < aaatResultHigh) {
        } else if (candle.close < aaatResultMedium) {
        // stop loss, urgent sell!
        totalTradesLongCandleBelowAaat++;
        this.sell('exiting: long candle close BELOW aaat! (SL)');
      } /*else if (candle.close <= buyPrice * this.settings.stopLoss) {
        // if (candle.close < aaatStop) {
        // stop loss, urgent sell!
        // this.sell(`stop loss: below ${ this.settings.stopLoss }%`);
        totalTradesAaatStopLoss++;
        if(USE_MARKET_LOST_FOR_TREND) {
          isMarketLostForThisTrend = true;
        }
      }*/
    }
    // shorts cases:
    if(this.settings.margin && this.settings.margin.useShort) {
      if (!this.advisedShort && aaatIndMedium.result.trend === -1 && (candle.high > aaatResultMedium && candle.close < aaatResultMedium)) {
        // totalBoughtAttempts++;
        this.buy(`цена пересекла красную 240 (${JSON.stringify(aaatResultMedium)}), candle240: ${JSON.stringify(candle240)}`
          , { limitPrice: aaatResultMedium, margin: { type: 'short', limit: 1 } });
      }

      if (this.advisedShort) {
        if (this.settings.aaat.sellOnRedThresholdMedium && aaatIndMedium.result.trend === 1 && candle.high <= aaatResultMedium) {// this never happens (dunno why)
          totalTradesHighAboveAaatDnTrendGreenMedium++;
          this.sell(`SELL SHORT!!: crossed: aaatResultMedium(in UP trend): ${aaatResultMedium}`
            , { limitPrice: aaatResultMedium, margin: { type: 'short', limit: 1 } });
        }
        if (this.settings.aaat.sellOnRedThresholdHigh && aaatIndHigh.result.trend === 1 && candle.high <= aaatResultHigh) { // <- should be candle.low, but works better =)
          totalTradesHighAboveAaatDnTrendGreenHigh++;
          this.sell(`SELL SHORT!!: crossed: aaatResultHigh(in UP trend): ${aaatResultHigh}`
            , { limitPrice: aaatResultHigh, margin: { type: 'short', limit: 1 } });
        }
        if (candle.close <= this.buyPrice * (2 - this.settings.takeProfit)) {
          totalSellTakeProfit++;
          this.sell(`SELL!!: TAKE PROFIT, bought@ ${ this.buyPrice }, sell: ${candle.close}`
            , { margin: { type: 'short', limit: 1 } });
        } else if (candle.close > aaatResultMedium) {
          totalTradesLongCandleAboveAaat++;
          this.sell('exiting: long candle close ABOVE aaat! (SL)', { margin: { type: 'short', limit: 1 } });
        }
      }
    }
  };


  this.end = function(a, b, c) {
    this.consoleLog(`totalSellTakeProfit: ${ totalSellTakeProfit }`);
    this.consoleLog(`totalTradesLongCandleBelowAaat (SL): ${ totalTradesLongCandleBelowAaat
      }, totalTradesHighAboveAaatDnTrendRedMedium: ${ totalTradesHighAboveAaatDnTrendRedMedium
      }, totalTradesHighAboveAaatDnTrendRedHigh: ${ totalTradesHighAboveAaatDnTrendRedHigh }`);
    this.consoleLog(`totalTradesLongCandleAboveAaat (SL): ${ totalTradesLongCandleAboveAaat
      }, totalTradesHighAboveAaatDnTrendGreenMedium: ${ totalTradesHighAboveAaatDnTrendGreenMedium
      }, totalTradesHighAboveAaatDnTrendGreenHigh: ${ totalTradesHighAboveAaatDnTrendGreenHigh }`);

    /*const profitTrades = tradesArr.filter(t=>t.status === 'sold');
    consoleLog(`           closed trades: ${ profitTrades.length }`);
    const openTrades = tradesArr.filter(t=>t.status !== 'sold');
    consoleLog(`           open trades: ${ openTrades.length }`);
    consoleLog(`           startPrice: ${ startPrice }, current price: ${ currentPrice }`);
    let profit = profitTrades.length * ((TAKE_PROFIT - 1) - 0.002) * SINGLE_BET;
    let loss = 0;
    openTrades.forEach(trade => {
      let res = (currentPrice - trade.price) / (trade.price) * SINGLE_BET;
      loss -= res;
    })*/
  }
}

strat.check = function(){
  // gekko stub (DO NOT REMOVE!!)
}
module.exports = strat;
