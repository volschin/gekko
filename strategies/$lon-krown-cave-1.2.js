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
    totalTradesHighAboveAaatDnTrendGreenMedium = 0, totalTradesHighAboveAaatDnTrendGreenHigh = 0, totalTradesLongCandleAboveAaat = 0,
    totalTradesBelowAaatUpMediumTrend = 0, totalTradesBelowAaatUpHighTrend = 0,
    boughtLenth, boughtLenthShort;

  this.check = function(candle) {
    if(this.debug && false) {
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

    if(true) {
    // цена пересекла зеленую medium
    if(!this.advised && aaatIndMedium.result.trend === 1 && (candle.low < aaatResultMedium && candle.close > aaatResultMedium)) {
    // if(!advised && aaatTrendUp && (candle.low < aaatStop) && !isMarketLostForThisTrend) {
      this.buy(`цена пересекла зеленую 120 (medium) (${ JSON.stringify( aaatResultMedium )}), candle120: ${ JSON.stringify( candle120 )}`, { limitPrice: aaatResultMedium });
      boughtLenth = 'medium';
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
    // цена пересекла зеленую high
    if(!this.advised && aaatIndHigh.result.trend === 1 && (candle.low < aaatResultHigh && candle.close > aaatResultHigh)) {
    // if(!advised && aaatTrendUp && (candle.low < aaatStop) && !isMarketLostForThisTrend) {
      this.buy(`цена пересекла зеленую 240 (high) (${ JSON.stringify( aaatResultHigh )}), candle240: ${ JSON.stringify( candle240 )}`, { limitPrice: aaatResultHigh });
      boughtLenth = 'high';

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
      } else if (candle.close < aaatResultMedium && boughtLenth === 'medium') {
        // stop loss, urgent sell!
        totalTradesLongCandleBelowAaat++;
        this.sell('exiting: long candle close BELOW medium aaat! (SL)');
      } else if (candle.close < aaatResultHigh && boughtLenth === 'high') {
        // stop loss, urgent sell!
        totalTradesLongCandleBelowAaat++;
        this.sell('exiting: long candle close BELOW high aaat! (SL)');
      }/* else if(this.isInProfit() && aaatIndMedium.result.trend === 1 && aaatIndHigh.result.trend === -1 && candle.high >= aaatResultHigh) { // when we are in channel formed by red and green trends
        totalTradesHighAboveAaatDnTrendRedMedium++;
        this.sell(`SELL LONG!!: bought below green medium -> sell above red high, : ${aaatResultHigh}`, { limitPrice: aaatResultHigh });
      }*/ /*else if (candle.close <= buyPrice * this.settings.stopLoss) {
        // if (candle.close < aaatStop) {
        // stop loss, urgent sell!
        // this.sell(`stop loss: below ${ this.settings.stopLoss }%`);
        totalTradesAaatStopLoss++;
        if(USE_MARKET_LOST_FOR_TREND) {
          isMarketLostForThisTrend = true;
        }
      }*/
    }
    }
    // shorts cases:
    if(this.settings.margin && this.settings.margin.useShort) {
      if (!this.advisedShort && aaatIndMedium.result.trend === -1 && (candle.high > aaatResultMedium && candle.close < aaatResultMedium)) {
        this.buy(`цена пересекла красную 120 (${JSON.stringify(aaatResultMedium)}), candle120: ${JSON.stringify(candle120)}`
          , { limitPrice: aaatResultMedium, margin: { type: 'short', limit: 1 } });
        boughtLenthShort = 'medium';
      }
      if (!this.advisedShort && aaatIndHigh.result.trend === -1 && (candle.high > aaatResultHigh && candle.close < aaatResultHigh)) {
        this.buy(`цена пересекла красную 240 (${JSON.stringify(aaatResultHigh)}), candle240: ${JSON.stringify(candle240)}`
          , { limitPrice: aaatResultHigh, margin: { type: 'short', limit: 1 } });
        boughtLenthShort = 'high';
      }

      if (this.advisedShort) {
        if (this.settings.aaat.sellOnGreenThresholdMedium && aaatIndMedium.result.trend === 1 && candle.high <= aaatResultMedium) {// this never happens (dunno why)
          totalTradesBelowAaatUpMediumTrend++;
          this.sell(`SELL SHORT!!: crossed: aaatResultMedium(in UP trend): ${aaatResultMedium}`, { limitPrice: aaatResultMedium, margin: { type: 'short', limit: 1 } });
        }
        if (this.settings.aaat.sellOnGreenThresholdHigh && aaatIndHigh.result.trend === 1 && candle.high <= aaatResultHigh) { // <- should be candle.low, but works better =)
          totalTradesBelowAaatUpHighTrend++;
          this.sell(`SELL SHORT!!: crossed: aaatResultHigh(in UP trend): ${aaatResultHigh}`, { limitPrice: aaatResultHigh, margin: { type: 'short', limit: 1 } });
        }
        if (candle.close <= this.buyPrice * (2 - this.settings.takeProfit)) {
          totalSellTakeProfit++;
          this.sell(`SELL!!: TAKE PROFIT, bought@ ${ this.buyPrice }, sell: ${candle.close}`, { margin: { type: 'short', limit: 1 } });
        } else if (candle.close > aaatResultMedium && boughtLenthShort === 'medium') {
          totalTradesLongCandleAboveAaat++;
          this.sell('exiting: long candle close ABOVE medium aaat! (SL)', { margin: { type: 'short', limit: 1 } });
        } else if (candle.close > aaatResultHigh && boughtLenthShort === 'high') {
          totalTradesLongCandleAboveAaat++;
          this.sell('exiting: long candle close ABOVE high aaat! (SL)', { margin: { type: 'short', limit: 1 } });
        }/* else if(this.isInProfitShort() && aaatIndMedium.result.trend === -1 && aaatIndHigh.result.trend === 1 && candle.low <= aaatResultHigh) { // when we are in channel formed by red and green trends
          totalTradesBelowAaatUpHighTrend++;
          this.sell(`SELL SHORT!!: bought above red medium -> sell below green high, : ${aaatResultHigh}`, { limitPrice: aaatResultHigh, margin: { type: 'short', limit: 1 } });
        }*/
      }
    }
    // rules for both types (always):
    // when we are in channel formed by red and green trends
    if(false) {


      if (this.advised && this.isInProfit()) {
        if (boughtLenth === 'medium' && aaatIndHigh.result.trend === -1 && (candle.high >= aaatResultHigh)) {
          this.sell(`SELL SHORT!!: bought below green medium -> sell above red high, : ${aaatResultHigh}`, { limitPrice: aaatResultHigh });
        }
        if (boughtLenth === 'high' && aaatIndMedium.result.trend === -1 && (candle.high >= aaatResultMedium)) {
          this.sell(`SELL SHORT!!: bought below green high -> sell above red high, : ${aaatResultHigh}`, { limitPrice: aaatResultHigh });
        }
      }

      if (this.advisedShort && this.isInProfitShort()) {
        if (boughtLenthShort === 'medium' && aaatIndHigh.result.trend === 1 && (candle.low <= aaatResultHigh)) {
          this.sell(`SELL SHORT!!: bought above red medium -> sell below green high, : ${aaatResultHigh}`, { limitPrice: aaatResultHigh });
        }
        if (boughtLenthShort === 'high' && aaatIndMedium.result.trend === 1 && (candle.low <= aaatResultMedium)) {
          this.sell(`SELL SHORT!!: bought above red high -> sell below green medium, : ${aaatResultHigh}`, { limitPrice: aaatResultHigh });
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
