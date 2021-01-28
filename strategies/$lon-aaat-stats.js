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
  const that = this;
  let TAKE_PROFIT = this.settings.TAKE_PROFIT || 0.006
    , STOP_LOSS = this.settings.STOP_LOSS || 0.002
    , CROSS_ATTEMPTS = this.settings.CROSS_ATTEMPTS || 100; // infinite

  const config = require ('../core/util').getConfig() || {};
  this.debug = false;

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
  let aaatLenghLow = this.settings.aaat.LOW || 1;
  let aaatLenghMedium = this.settings.aaat.MEDIUM || 2;
  let aaatLenghHigh = this.settings.aaat.HIGH || 4;
  const usesShort = this.settings.margin && this.settings.margin.useShort === true;
  const DEVIATION = this.settings.aaat && this.settings.aaat.DEVIATION || 0;

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

    if (!this.completedWarmup) {
      if (this.indicators.aaatIndHigh.result.trend === 1
        && this.indicators.aaatIndHigh.result.trend !== trendHighPrev && !!trendHighPrev) {
        highStartCur = JSON.stringify(candle.start);
      }
      trendHighPrev = this.indicators.aaatIndHigh.result.trend;
    }
  };

  const stats = {};
  (function setStats() {
    stats['aaatIndLow.green.tail.down'] = 0;
    stats['aaatIndMedium.green.tail.down'] = 0;
    stats['aaatIndHigh.green.tail.down'] = 0;
  })();

  let totCandles = 0,
    trendLowPrev = null,
    trendMediumPrev = null,
    trendHighPrev = null, trendHighChanged = 0, highDowns = [], highDownsCur = [], highInit = null, highMax = null,
      highMin = null, highStartCur = null;
  this.check = function(candle) {
    this.logCheck(candle);

    if (!highStartCur) {
      highStartCur = JSON.stringify(candle.start);
    }
    totCandles++;
    if (this.indicators.aaatIndHigh.result.trend === 1
      && this.indicators.aaatIndHigh.result.trend !== trendHighPrev) {
      highStartCur = JSON.stringify(candle.start);
      highMax = 0;
      highMin = 0;
      // highInit = candle.close;
      highDownsCur = [];
    }
    // short cleanup:
    if (this.settings.margin && this.settings.margin.useShort) {
      if (this.indicators.aaatIndHigh.result.trend === -1
        && this.indicators.aaatIndHigh.result.trend !== trendHighPrev) {
        highStartCur = JSON.stringify(candle.start);
        highMax = 0;
        highMin = 0;
        // highInit = candle.close;
        highDownsCur = [];
      }
    }

    if (highDownsCur.length > 0 && highDownsCur.length <= CROSS_ATTEMPTS) {
      // actual buy / sell here:
      const cur = highDownsCur[highDownsCur.length - 1];
      const price = cur.price;
      const fee = config.paperTrader.feeTaker / 100;
      const slippage = config.paperTrader.slippage / 100;
      const openToExit = !cur.isProfit && !cur.isLoss;

      // what is first: TP or SL?
      if (usesShort ? cur.isShort === false : true) {
        if (openToExit && ((price - candle.low) / price > STOP_LOSS - slippage)) {
          cur.profit = - (STOP_LOSS * (1 - fee) + 2 * fee + slippage) * 100;
          // cur.profit = - (price * STOP_LOSS + price * fee + candle.high * fee) / price * 100;// цена выхода + фии выхода + фи покупки 30000 * 0.035 + 30000 * 0.001 +
          cur.isLoss = true;
        }
        if (openToExit && ((candle.high - price) / price > TAKE_PROFIT + slippage)) {
          cur.profit = (TAKE_PROFIT * (1 - fee) - 2 * fee - slippage) * 100;
          // cur.profit = (price * TAKE_PROFIT - price * fee - candle.high * fee) / price * 100;
          cur.isProfit = true;
        }
      }

      // short cases for exit:
      if (usesShort ? cur.isShort === true : false) {
        if (openToExit && ((candle.high - price) / price > STOP_LOSS - slippage)) {
          cur.profit = - (STOP_LOSS * (1 - fee) + 2 * fee + slippage) * 100;
          // cur.profit = - (price * STOP_LOSS + price * fee + candle.high * fee) / price * 100;// цена выхода + фии выхода + фи покупки 30000 * 0.035 + 30000 * 0.001 +
          cur.isLoss = true;
        }
        if (openToExit && ((price - candle.low) / price > TAKE_PROFIT + slippage)) {
          cur.profit = (TAKE_PROFIT * (1 - fee) - 2 * fee - slippage) * 100;
          // cur.profit = (price * TAKE_PROFIT - price * fee - candle.high * fee) / price * 100;
          cur.isProfit = true;
        }
      }
    }

    // max and mins after cross:
    if (highDownsCur.length > 0) {
      let highMax = highDownsCur[highDownsCur.length - 1].highMax;
      if (candle.high > highMax || highMax === 0) {
        highDownsCur[highDownsCur.length - 1].highMax = candle.high
      }
      let highMin = highDownsCur[highDownsCur.length - 1].highMin;
      if (candle.low < highMin || highMin === 0) {
        highDownsCur[highDownsCur.length - 1].highMin = candle.low
      }
    }

    /*if ((candle.low < highMin || !highMin) && highDownsCur.length > 0) {
      highMin = candle.low
    }*/

    if (this.indicators.aaatIndHigh.result.trend === -1
      && this.indicators.aaatIndHigh.result.trend !== trendHighPrev && !!highStartCur) {
      // trend changed
      trendHighChanged ++;
      highDowns.push({
        start: highStartCur,
        downs: highDownsCur,
      });
    }

    if (usesShort) { // SHORT cases
      if (this.indicators.aaatIndHigh.result.trend === 1
        && this.indicators.aaatIndHigh.result.trend !== trendHighPrev && !!highStartCur) {
        // trend changed
        trendHighChanged++;
        highDowns.push({
          start: highStartCur,
          downs: highDownsCur,
        });
      }
    }

    /*if (this.indicators.aaatIndHigh.result.trend !== trendHighPrev && trendHighPrev !== null) {
      highMax = 0;
      highMin = 0;
    }*/

    /*// цена хвостом пересекла thin зеленую
    if(this.indicators.aaatIndLow.result.trend === 1 && (candle.low < aaatResultLow && candle.close > aaatResultLow)) {
      // this.consoleLog('aaatIndLow.green.tail.down++' + JSON.stringify(this.candle.start));
      stats['aaatIndHigh.green.tail.down']++;
      highDownsCur.push({
        start: JSON.stringify(candle.start),
        trend: this.indicators.aaatIndHigh.result.trend,
        type: 'tail-green-thick'
      })
    }
    // цена хвостом пересекла med зеленую
    if(this.indicators.aaatIndHigh.result.trend === 1 && (candle.low < aaatResultHigh && candle.close > aaatResultHigh)) {
      // this.consoleLog('aaatIndLow.green.tail.down++' + JSON.stringify(this.candle.start));
      stats['aaatIndHigh.green.tail.down']++;
      highDownsCur.push({
        start: JSON.stringify(candle.start),
        trend: this.indicators.aaatIndHigh.result.trend,
        type: 'tail-green-thick'
      })
    }*/
    // цена пересекла thick зеленую и закрылась НАД ней
    if (this.indicators.aaatIndHigh.result.trend === 1 && (candle.low * (1 - DEVIATION) < aaatResultHigh && candle.close > aaatResultHigh)) {
      // this.consoleLog('aaatIndLow.green.tail.down++' + JSON.stringify(this.candle.start));
      stats['aaatIndHigh.green.tail.down']++;
      if (highDownsCur.length < CROSS_ATTEMPTS) {
        highDownsCur.push({
          start: JSON.stringify(candle.start),
          trend: this.indicators.aaatIndHigh.result.trend,
          type: 'tail-green-thick',
          price: this.indicators.aaatIndHigh.result.stop,
          candle,
          highMax: 0,
          highMin: 0,
          isProfit: false,
          isLoss: false,
          profit: 0,
          isShort: false
        });
      }
    }

    // shorts cases:
    if (this.settings.margin && this.settings.margin.useShort) {
      // цена хвостом пересекла thick красную
      if (this.indicators.aaatIndHigh.result.trend === -1 && (candle.high * (1 + DEVIATION) > aaatResultHigh && candle.close < aaatResultHigh)) {
        // this.consoleLog('aaatIndLow.green.tail.down++' + JSON.stringify(this.candle.start));
        stats['aaatIndHigh.green.tail.up']++;
        if (highDownsCur.length < CROSS_ATTEMPTS) {
          highDownsCur.push({
            start: JSON.stringify(candle.start),
            trend: this.indicators.aaatIndHigh.result.trend,
            type: 'tail-red-thick',
            price: this.indicators.aaatIndHigh.result.stop,
            candle,
            highMax: 0,
            highMin: 0,
            isProfit: false,
            isLoss: false,
            profit: 0,
            isShort: true
          });
        }
      }
    }

    trendLowPrev = this.indicators.aaatIndLow.result.trend;
    trendMediumPrev = this.indicators.aaatIndMedium.result.trend;
    trendHighPrev = this.indicators.aaatIndHigh.result.trend;
  };


  this.end = function(a, b, c) {
    //console.error('Here is some statistics for you Sir:')
    //console.error(`total candles: ${ totCandles } (${ config.backtest.daterange.from } - ${ config.backtest.daterange.to }`);
    // console.error(`totalSellTakeProfit: ${ totalSellTakeProfit }`);
    // console.error(`totalTradesLongCandleBelowAaat: ${ totalTradesLongCandleBelowAaat }`);
    // console.error(`totalTradesHighAboveAaatDnTrendRedMedium: ${ totalTradesHighAboveAaatDnTrendRedMedium }`);
    // console.error(`totalTradesHighAboveAaatDnTrendRedHigh: ${ totalTradesHighAboveAaatDnTrendRedHigh }`);
    // console.log('TRADES: ');
    // console.log(JSON.stringify(this.tradesArr));
    //console.log(`trendHighChanged: ${ trendHighChanged }`);
    /*console.log('STATS: ');
    console.log(JSON.stringify(stats));
    console.log('DOWNS');*/
    //console.log(highDowns.map(d => d.downs.length));
    const lengths = highDowns.filter(d => d.downs.length !== 0).map(d => d.downs.length);
    //console.log(`total: ${ lengths.reduce((acc, d) => (acc += d)) }, avg: ${ lengths.reduce((acc, d) => (acc += d)) / lengths.length }`);
    const breakdowns = lengths.reduce((acc, l)=> {
      acc[l] = acc[l] ? acc[l] + 1 : 1;
      return acc;
    }, {});
    //console.log(`lengths breakdowns: ${ JSON.stringify(breakdowns) }`);

    const highs = highDowns.reduce((acc, d) => {
      acc = acc.concat(d.downs.map(a => (a.highMax - a.price) / a.price));
      // acc = acc.concat(d.downs.slice(0, 1).map(a => (a.highMax - a.price) / a.price));
      return acc;
    }, []);
    //console.log(`total: ${ highs.reduce((acc,d)=> acc + d) }, highs: ${ highs }`);
    const mins = highDowns.reduce((acc, d) => {
      acc = acc.concat(d.downs.map(a => (a.highMin - a.price) / a.price));
      // acc = acc.concat(d.downs.slice(0, 1).map(a => (a.highMin - a.price) / a.price));
      return acc;
    }, []);
    //console.log(`total: ${ mins.reduce((acc,d)=> acc + d) }, mins: ${ mins }`);
    //console.log(`diff: ${ highs.reduce((acc,d)=> acc + d) + mins.reduce((acc,d)=> acc + d)}`)

    const profits = highDowns.reduce((acc, d) => {
      acc += d.downs.reduce((a, l) => {
        a += l.isProfit? 1 : l.isLoss ? -1 : 0;
        return a;
      }, 0);
      return acc;
    }, 0);
    const profitTot = highDowns.reduce((acc, d) => {
      acc += d.downs.reduce((a, l) => {
        a += l.isProfit? l.profit : l.isLoss ? l.profit : 0;
        return a;
      }, 0);
      return acc;
    }, 0);
    console.log(`profits: ${ profits }, total: ${ profitTot }`)
    this.tradingAdvisor.stats = {
      highDowns, profits, profitTot
    }
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

  this.logCheck = (candle) => {
    if(this.debug && false) {
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
  }
}

strat.check = function(){
  // gekko stub (DO NOT REMOVE!!)
}

module.exports = strat;
