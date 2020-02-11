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
  let startPrice, currentCandle, prevCandle, currentPrice = 0.0, buyPrice = 0.0, advised = false, advisedShort = false, tradeInitiated = false, buyTs
    , tradesCount = 0, tradesMaxCount = 0
    , candlesArr = Array(10).fill({
    open: -1,
    close: -1,
    high: -1,
    low: -1
  });
  let tradesArr = [];
  let TAKE_PROFIT = this.settings.TAKE_PROFIT || 1.05
    , TIMEOUT_MINUTES = this.settings.TIMEOUT_MINUTES || 1440
    , TRAILING_STOP = this.settings.trailingStop || 5;

  const config = require ('../core/util').getConfig() || {};
  // debug? set to false to disable all logging/messages/stats (improves performance in backtests)
  this.debug = true;

  // performance
  config.backtest.batchSize = 1000; // increase performance
  config.silent = false;
  config.debug = true;

  let hadDeal = false;
  if (config.tradingAdvisor.candleSize !== 60) {
    /*throw {
      error: "This strategy must run with candleSize=60"
    };*/
  }

  // AAAT:
  let AAAT = require('./indicators/Adaptive-ATR-ADX-Trend');
  let aaatLenghLow = 1;
  let aaatLenghMedium = 2;
  let aaatLenghHigh = 4;

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
    currentCandle = candle;
    currentPrice = candle.close;
    candlesArr.pop();
    candlesArr.unshift(candle);

    batcherAaatLow.write([candle]); batcherAaatLow.flush();
    batcherAaatMedium.write([candle]); batcherAaatMedium.flush();
    batcherAaatHigh.write([candle]); batcherAaatHigh.flush();
    aaatResultLow = aaatIndLow.result.stop;
    aaatResultMedium = aaatIndMedium.result.stop;
    aaatResultHigh = aaatIndHigh.result.stop;

    if(this.debug && false) {
      consoleLog(`strat update:: candle.start: ${ JSON.stringify(candle.start) }, advised: ${ advised }, tradeInitiated: ${ tradeInitiated
      }, low: ${ aaatResultLow }, medium: ${ aaatResultMedium }, high: ${ aaatResultHigh }`);
    }

  };

  let aaatTrendUp, aaatTrendUpPrev;
  let totalUptrends = 0, totalDntrends = 0, totalBought = 0, totalSold = 0, totalBoughtAttempts = 0, totalSoldAttempts = 0, totalSellTakeProfit = 0,
    totalTradesSuccess = 0, totalTradesLongCandleBelowAaat = 0, totalTradesHighAboveAaatDnTrendRedMedium = 0, totalTradesHighAboveAaatDnTrendRedHigh = 0,
    totalTradesAaatStopLoss = 0, totalHighVolumeCandles = 0;
  this.check = function(candle) {
    if(this.debug && false) {
      consoleLog(`strat check:: ${ ''
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

    let time = JSON.stringify(this.candle.start);
    // цена пересекла зеленую
    if(!advised && aaatIndMedium.result.trend === 1 && (candle.low < aaatResultMedium && candle.close > aaatResultMedium)) {
    // if(!advised && aaatTrendUp && (candle.low < aaatStop) && !isMarketLostForThisTrend) {
      totalBoughtAttempts++;

      this.buy(`цена пересекла зеленую 240 (${ JSON.stringify( aaatResultMedium )}), candle240: ${ JSON.stringify( candle240 )}`, { limitPrice: aaatResultMedium });

      consoleLog(`strat check:: ${ ''
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

    if (advised) {
      if(this.settings.aaat.sellOnRedThresholdMedium && aaatIndMedium.result.trend === -1 && candle.high >= aaatResultMedium) {
        totalTradesHighAboveAaatDnTrendRedMedium++;
        this.sell(`SELL!!: crossed: aaatResultMedium(in dn trend): ${ aaatResultMedium }`, { limitPrice: aaatResultMedium });
      }
      if(this.settings.aaat.sellOnRedThresholdHigh && aaatIndHigh.result.trend === -1 && candle.high >= aaatResultHigh) {
        totalTradesHighAboveAaatDnTrendRedHigh++;
        this.sell(`SELL!!: crossed: aaatResultHigh(in dn trend): ${ aaatResultHigh }`, { limitPrice: aaatResultHigh });
      }
      if (candle.close >= buyPrice * this.settings.takeProfit) {
        totalSellTakeProfit++;
        this.sell(`SELL!!: TAKE PROFIT, bought@ ${buyPrice}, sell: ${candle.close}`);
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
      if (!advisedShort && aaatIndMedium.result.trend === -1 && (candle.high > aaatResultMedium && candle.close < aaatResultMedium)) {
        // totalBoughtAttempts++;
        this.buy(`цена пересекла красную 240 (${JSON.stringify(aaatResultMedium)}), candle240: ${JSON.stringify(candle240)}`
          , { limitPrice: aaatResultMedium, margin: { type: 'short', limit: 1 } });
      }

      if (advisedShort) {
        if (this.settings.aaat.sellOnRedThresholdMedium && aaatIndMedium.result.trend === 1 && candle.high <= aaatResultMedium) {
          // totalTradesHighAboveAaatDnTrendRedMedium++;
          this.sell(`SELL SHORT!!: crossed: aaatResultMedium(in UP trend): ${aaatResultMedium}`
            , { limitPrice: aaatResultMedium, margin: { type: 'short', limit: 1 } });
        }
        if (this.settings.aaat.sellOnRedThresholdHigh && aaatIndHigh.result.trend === 1 && candle.high <= aaatResultHigh) {
          // totalTradesHighAboveAaatDnTrendRedHigh++;
          this.sell(`SELL SHORT!!: crossed: aaatResultHigh(in UP trend): ${aaatResultHigh}`
            , { limitPrice: aaatResultHigh, margin: { type: 'short', limit: 1 } });
        }
        if (candle.close <= buyPrice * (2 - this.settings.takeProfit)) {
          // totalSellTakeProfit++;
          this.sell(`SELL!!: TAKE PROFIT, bought@ ${buyPrice}, sell: ${candle.close}`
            , { margin: { type: 'short', limit: 1 } });
        } else if (candle.close > aaatResultMedium) {
          // totalTradesLongCandleBelowAaat++;
          this.sell('exiting: long candle close ABOVE aaat!', { margin: { type: 'short', limit: 1 } });
        }
      }
    }
  };

  this.buy = function(reason, options = {}) {
    this.notify({
      type: 'buy advice',
      reason: reason,
    });
    consoleLog(`buy:: advice: long, margin: ${ !!options.margin }`);
    this.advice({
      limit: options.limitPrice,
      direction: 'long',
      margin: options.margin
      /*trigger: {
        type: 'trailingStop',
        trailPercentage: TRAILING_STOP
      }*/
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
    this.notify({
      type: 'sell advice',
      reason: reason,
    });
    consoleLog(`sell:: advice: short, margin: ${ !!options.margin }`);
    this.advice({
      direction: 'short',
      limit: options.limitPrice,
      margin: options.margin
    });
    if(options.margin && options.margin.type === 'short') {
      advisedShort = false;
    } else {
      advised = false;
    }
  }

  this.onPendingTrade = function(pendingTrade) {
    tradeInitiated = true;
  }

  //
  // see https://www.youtube.com/watch?v=lc21W9_zdME
  this.onTrade = function(trade = {}) {
    consoleLog('onTrade:: trade: ' + JSON.stringify(trade.action));
    if(trade.action === 'sell') {
      if(trade.margin && trade.margin.type === 'short') {
        advisedShort = false;
      } else {
        advised = false;
      }
    }
    tradeInitiated = false;
  }
  // Trades tht didn't complete with a buy/sell (see processTradeErrored in tradingAdvisor)
  this.onTerminatedTrades = function(terminatedTrades = {}) {
    tradeInitiated = false;
    consoleLog('onTerminatedTrades:: Trade failed. Reason: ' + terminatedTrades.reason);
  }

  this.onPortfolioChange = function(portfolio) {
    // consoleLog(`onPortfolioChange, portfolio: ${ JSON.stringify(portfolio) }`);
  }
  this.onPortfolioValueChange = function(portfolio) {
    // consoleLog(`onPortfolioValueChange, portfolio: ${ JSON.stringify(portfolio) }`);
  }
  this.onTriggerFired = function(data) {
    // tradeInitiated = false;
    this.notify({
      type: 'sell advice',
      reason: 'trailing stop trigger fired',
    });
    consoleLog(`onTriggerFired, data: ${ JSON.stringify(data) }`);
  }

  this.end = function(a, b, c) {
    consoleLog(`gekko end, trades: ${ JSON.stringify(tradesArr) }`);
    consoleLog(`           total trades: ${ tradesArr.length }`);
    consoleLog(`totalBought: ${ totalBoughtAttempts }`);
    consoleLog(`totalSellTakeProfit: ${ totalSellTakeProfit }`);
    consoleLog(`totalTradesLongCandleBelowAaat: ${ totalTradesLongCandleBelowAaat }`);
    consoleLog(`totalTradesHighAboveAaatDnTrendRedMedium: ${ totalTradesHighAboveAaatDnTrendRedMedium }`);
    consoleLog(`totalTradesHighAboveAaatDnTrendRedHigh: ${ totalTradesHighAboveAaatDnTrendRedHigh }`);
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
  function consoleLog(msg = ''){
    if(config){
      currentCandle = currentCandle || {}
      const prefix = `${ config.gekkoId }, ${ JSON.stringify(currentCandle.start) || JSON.stringify(moment()) } -- `;
      console.log(prefix, msg);
      //log.debug(prefix, msg);
    }
  }
}

strat.check = function(){
  // gekko stub (DO NOT REMOVE!!)
}

module.exports = strat;
