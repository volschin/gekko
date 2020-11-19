// MACD Cross
// Created by Ash
// Version 1
//
//


const log = require('../core/log');
const config = require ('../core/util').getConfig();
const moment = require('moment');
const CandleBatcher = require('../core/candleBatcher');

let strat = {};

// seal everything into init to have the ability to use local variables unique for each strat instance
// , instead of using 'this.someVar', to optimize performance:
strat.init = function(options = {}) {
  let TAKE_PROFIT = this.settings.TAKE_PROFIT || 1.05
    , TIMEOUT_MINUTES = this.settings.TIMEOUT_MINUTES || 1440
    , TRAILING_STOP = this.settings.trailingStop || 5;
  const that = this;

  const config = require ('../core/util').getConfig() || {};
  // debug? set to false to disable all logging/messages/stats (improves performance in backtests)
  this.debug = true;

  // performance
  config.backtest.batchSize = 1000; // increase performance
  config.silent = false;
  config.debug = false;

  if (config.tradingAdvisor.candleSize !== 60) {
    /*throw {
      error: "This strategy must run with candleSize=60"
    };*/
  }

  // AAAT:
  // let AAAT = require('./indicators/Adaptive-ATR-ADX-Trend');
  let aaatLenghLow = 1;
  let aaatLenghMedium = 2;
  let aaatLenghHigh = 4;

  let batcherAaatLow = new CandleBatcher(aaatLenghLow);
  let batcherAaatMedium = new CandleBatcher(aaatLenghMedium);
  let batcherAaatHigh = new CandleBatcher(aaatLenghHigh);
  // let aaatLengh = this.settings.aaat.lengthMultiplyer || 24;

  this.addIndicator('aaatIndLow', 'Adaptive-ATR-ADX-Trend',
    { debug: false, useHeiken: this.settings.aaat.USE_HEIKEN }, this.settings.isPersistent);
  this.addIndicator('aaatIndMedium', 'Adaptive-ATR-ADX-Trend',
    { debug: false, useHeiken: this.settings.aaat.USE_HEIKEN }, this.settings.isPersistent);
  this.addIndicator('aaatIndHigh', 'Adaptive-ATR-ADX-Trend',
    { debug: false, useHeiken: this.settings.aaat.USE_HEIKEN }, this.settings.isPersistent);

  let candle60, candle120, candle240;
  this.updateAaatLow = function(candle = {}) {
    that.indicators.aaatIndLow.update(candle);
    candle60 = candle;
  };

  this.updateAaatMedium = function(candle = {}) {
    that.indicators.aaatIndMedium.update(candle);
    candle120 = candle;
  };

  this.updateAaatHigh = function(candle = {}) {
    that.indicators.aaatIndHigh.update(candle);
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
    aaatResultLow = this.indicators.aaatIndLow.result.stop;
    aaatResultMedium = this.indicators.aaatIndMedium.result.stop;
    aaatResultHigh = this.indicators.aaatIndHigh.result.stop;
  };

  let aaatTrendUp, aaatTrendUpPrev;
  let totalUptrends = 0, totalDntrends = 0, totalBought = 0, totalSold = 0, totalBoughtAttempts = 0, totalSoldAttempts = 0, totalSellTakeProfit = 0,
    totalTradesSuccess = 0, totalTradesLongCandleBelowAaat = 0, totalTradesHighAboveAaatDnTrendRedMedium = 0, totalTradesHighAboveAaatDnTrendRedHigh = 0,
    totalTradesAaatStopLoss = 0, totalHighVolumeCandles = 0;
  this.check = function(candle) {
    if(this.debug) {
      this.consoleLog(`strat check:: ${ ''
      } candle.close: ${ candle.close
      // }, candle.volume: ${ candle.volume
      } candle240.start: ${ JSON.stringify(candle240 && candle240.start) }, candle240.close: ${ candle240 && candle240.close
      } aaatResultLow: ${ aaatResultLow }, aaat240Trend: ${ this.indicators.aaatIndHigh.result.trend
      } aaatResultMedium: ${ aaatResultMedium }, aaat240Trend: ${ this.indicators.aaatIndHigh.result.trend
      } aaatResultHigh: ${ aaatResultHigh }, aaat240Trend: ${ this.indicators.aaatIndHigh.result.trend
        // }, ma.short: ${ shortMA60.result }, ma.middle: ${ middleMA60.result }, ma.long: ${ longMA60.result
        // }, rsiVal: ${ rsiVal }, bb.lower: ${ bb.lower }, bb.upper: ${ bb.upper }, bb.middle: ${ bb.middle
        // }, advised: ${ advised }, tradeInitiated: ${ tradeInitiated
      }`);
    }

    // цена пересекла зеленую
    if(!this.advised && !this.advisedShort && this.indicators.aaatIndMedium.result.trend === 1 && (candle.low < aaatResultMedium && candle.close > aaatResultMedium)) {
    // if(!advised && aaatTrendUp && (candle.low < aaatStop) && !isMarketLostForThisTrend) {
      totalBoughtAttempts++;

      this.buy(`цена пересекла зеленую 240 (${ JSON.stringify( aaatResultMedium )}), candle240: ${ JSON.stringify( candle240 )}`, { limitPrice: aaatResultMedium });

      this.consoleLog(`strat check:: ${ ''
      } candle.close: ${ candle.close
        // }, candle.volume: ${ candle.volume
      } candle240.start: ${ JSON.stringify(candle240 && candle240.start) }, candle240.close: ${ candle240 && candle240.close
      } aaatResultLow: ${ aaatResultLow }, aaat240Trend: ${ this.indicators.aaatIndHigh.result.trend
      } aaatResultMedium: ${ aaatResultMedium }, aaat240Trend: ${ this.indicators.aaatIndHigh.result.trend
      } aaatResultHigh: ${ aaatResultHigh }, aaat240Trend: ${ this.indicators.aaatIndHigh.result.trend
        // }, ma.short: ${ shortMA60.result }, ma.middle: ${ middleMA60.result }, ma.long: ${ longMA60.result
        // }, rsiVal: ${ rsiVal }, bb.lower: ${ bb.lower }, bb.upper: ${ bb.upper }, bb.middle: ${ bb.middle
        // }, advised: ${ advised }, tradeInitiated: ${ tradeInitiated
      }`);
    }

    if (this.advised) {
      if(this.settings.aaat.sellOnRedThresholdMedium && this.indicators.aaatIndMedium.result.trend === -1
        && candle.high >= aaatResultMedium) { // this never happens (dunno why)
        totalTradesHighAboveAaatDnTrendRedMedium++;
        this.sell(`SELL!!: crossed: aaatResultMedium(in dn trend): ${ aaatResultMedium }`,
          { limitPrice: aaatResultMedium });
      }
      if(this.settings.aaat.sellOnRedThresholdHigh && this.indicators.aaatIndHigh.result.trend === -1 && candle.high >= aaatResultHigh) {
        totalTradesHighAboveAaatDnTrendRedHigh++;
        this.sell(`SELL!!: crossed: aaatResultHigh(in dn trend): ${ aaatResultHigh }`, { limitPrice: aaatResultHigh });
      }
      if (candle.close >= this.buyPrice * this.settings.takeProfit) {
        totalSellTakeProfit++;
        this.sell(`SELL!!: TAKE PROFIT, bought@ ${ this.buyPrice }, sell: ${ candle.close }`);
      // } else if(candle120.close < aaatResultHigh) {
      // } else if(candle240.close < aaatResultHigh) {
        } else if (candle.close < aaatResultMedium) {
        // stop loss, urgent sell!
        totalTradesLongCandleBelowAaat++;
        this.sell('exiting: long candle close below aaat!');
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
      if (!this.advised && !this.advisedShort && this.indicators.aaatIndMedium.result.trend === -1
        && (candle.high > aaatResultMedium && candle.close < aaatResultMedium)) {
        // totalBoughtAttempts++;
        this.buy(`цена пересекла красную 240 (${JSON.stringify(aaatResultMedium)}), candle240: ${JSON.stringify(candle240)}`
          , { limitPrice: aaatResultMedium, margin: { type: 'short', limit: 1 } });
      }

      if (this.advisedShort) {
        if (this.settings.aaat.sellOnRedThresholdMedium && this.indicators.aaatIndMedium.result.trend === 1
          && candle.high <= aaatResultMedium) {// this never happens (dunno why)
          // totalTradesHighAboveAaatDnTrendRedMedium++;
          this.sell(`SELL SHORT!!: crossed: aaatResultMedium(in UP trend): ${aaatResultMedium}`
            , { limitPrice: aaatResultMedium, margin: { type: 'short', limit: 1 } });
        }
        if (this.settings.aaat.sellOnRedThresholdHigh && this.indicators.aaatIndHigh.result.trend === 1
          && candle.high <= aaatResultHigh) { // <- should be candle.low, but works better =)
          // totalTradesHighAboveAaatDnTrendRedHigh++;
          this.sell(`SELL SHORT!!: crossed: aaatResultHigh(in UP trend): ${aaatResultHigh}`
            , { limitPrice: aaatResultHigh, margin: { type: 'short', limit: 1 } });
        }
        if (candle.close <= this.buyPrice * (2 - this.settings.takeProfit)) {
          // totalSellTakeProfit++;
          this.sell(`SELL!!: TAKE PROFIT, bought@ ${this.buyPrice}, sell: ${ candle.close }`
            , { margin: { type: 'short', limit: 1 } });
        } else if (candle.close > aaatResultMedium) {
          // totalTradesLongCandleBelowAaat++;
          this.sell('exiting: long candle close ABOVE aaat!', { margin: { type: 'short', limit: 1 } });
        }
      }
    }
  };

  /*this.buy = function(reason, options = {}) {
    // consoleLog(`buy:: advice: long, margin: ${ !!options.margin }`);
    this.advice({
      limit: options.limitPrice,
      direction: 'long',
      margin: options.margin
      /!*trigger: {
        type: 'trailingStop',
        trailPercentage: TRAILING_STOP
      }*!/
    });

    buyTs = this.candle.start;
    buyPrice = currentPrice;
    if(options.margin && options.margin.type === 'short') {
      advisedShort = true;
    } else {
      advised = true;
    }
    if(!hadDeal) {
      hadDeal = true; // only set once: strange startAt.unix() bug
    }
  }
  this.sell = function(reason, options = {}) {
    consoleLog(`sell:: advice: short, margin: ${ !!options.margin }`);
    this.advice({
      direction: 'short',
      limit: options.limitPrice,
      margin: options.margin,
      reason
    });
    if(options.margin && options.margin.type === 'short') {
      advisedShort = false;
    } else {
      advised = false;
    }
  }
*/

  this.end = function(a, b, c) {
    console.error('Here is some statistics for you Sir:')
    console.error(`totalSellTakeProfit: ${ totalSellTakeProfit }`);
    console.error(`totalTradesLongCandleBelowAaat: ${ totalTradesLongCandleBelowAaat }`);
    console.error(`totalTradesHighAboveAaatDnTrendRedMedium: ${ totalTradesHighAboveAaatDnTrendRedMedium }`);
    console.error(`totalTradesHighAboveAaatDnTrendRedHigh: ${ totalTradesHighAboveAaatDnTrendRedHigh }`);
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

    // consoleLog(`  profit: ${ profit }$, loss: ${ loss }$, result: ${ profit - loss }$, capital: ${ SINGLE_BET * tradesArr.length }, tradesMaxCount: ${ tradesMaxCount }`);

  }
}

strat.check = function(){
  // gekko stub (DO NOT REMOVE!!)
}

module.exports = strat;
