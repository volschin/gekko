// Heikin Ashi Strategy V2, credits go to breizh29, https://www.tradingview.com/script/CfMjJmRT-Heikin-Ashi-Strategy-V2/
// Version 2
//
// Translated by Ash
//


const log = require('../core/log');
const config = require ('../core/util').getConfig();
const DependenciesManager = require('../plugins/dependencyManager/web');
const TradingView = require('./tools/tradingView');
const CandleBatcher = require('../core/candleBatcher');
const HeikenAshi = require('./indicators/$lon-Heiken-Ashi');
const MACD = require('./indicators/MACD');
const EMA = require('./indicators/EMA');

let strat = {};
let buyPrice = 0.0;
let buyTs;
let currentPrice = 0.0;
let advised = false;

let batcher60, batcher180, heikenAshiInd, heikenAshi60Ind, heikenAshi180Ind, macdInd, macdHAInd, emaMha180CloseInd, emaHa60CloseInd
  , heikenAshi180ClosePrev, heikenAshi60ClosePrev;


// Prepare everything our method needs
strat.init = function() {
  // debug? set to false to disable all logging/messages/stats (improves performance in backtests)
  this.debug = false;

  // performance
  //config.backtest.batchSize = 1000; // increase performance
  config.silent = true;
  config.debug = false;

  if (config.tradingAdvisor.candleSize !== 15) {
    throw "This strategy must run with candleSize=15";
  }

  batcher60 = new CandleBatcher(4);
  batcher180 = new CandleBatcher(4 * 3);

  batcher60.on('candle', this.update60);
  batcher180.on('candle', this.update180);

  heikenAshiInd = new HeikenAshi();
  heikenAshi60Ind = new HeikenAshi();
  heikenAshi180Ind = new HeikenAshi();

  macdInd = new MACD({
    long: 26,
    short: 12,
    signal: 9,
  });
  macdHAInd = new MACD({
    long: 26,
    short: 12,
    signal: 9,
  });
  emaMha180CloseInd = new EMA(1);
  emaHa60CloseInd = new EMA(30);

  this.tradeInitiated = false;
  this.update60counter = 0;
}

strat.update = function(candle) {
  const res = heikenAshiInd.update(candle);
  macdInd.update(candle.close);
  macdHAInd.update(res.close);


  // if(heikenAshiInd.result) {
    // macdInd.update(heikenAshiInd.result.close);
  // }
  if(heikenAshi180ClosePrev){
    emaMha180CloseInd.update(heikenAshi180ClosePrev);

  }

  batcher60.write([candle]);
  batcher60.flush();
  batcher180.write([candle]);
  batcher180.flush();

}
strat.update60 = function(candle) {
  this.update60counter++;
  const res = heikenAshi60Ind.update(candle);
  if(heikenAshi60ClosePrev) {
    emaHa60CloseInd.update(heikenAshi60ClosePrev);
  }
  heikenAshi60ClosePrev = res.close;
}
strat.update180 = function(candle) {
  const res = heikenAshi180Ind.update(candle);
  console.error(`${ JSON.stringify(res.start) } heikenAshi180Ind: ${ JSON.stringify(res.close) }`);
  // if(heikenAshi180ClosePrev) {
  //   // emaMha180CloseInd.update(heikenAshi180ClosePrev);
  // }
  // heikenAshi180ClosePrev = res.close;
}

let time, haCur, ha60Cur, ha180Cur, macdCur, haPrev, ha60Prev, ha180Prev, ha60open, ha60close, mha180close
  , macdLineCur, macdLinePrev, signalLineCur, signalLinePrev, macdl, macdsl
  , emaMha180CloseIndPrev;

strat.check = function(candle) {
  time = JSON.stringify(this.candle.start);
  haCur = heikenAshiInd.result;
  ha60Cur = heikenAshi60Ind.result;
  ha180Cur = heikenAshi180Ind.result;
  // DONE checking

  macdCur = macdHAInd;

  if(ha60Prev && ha180Prev && macdCur) {

    // 1. Heikin Ashi Open/Close Price
    // ha_t = heikinashi(tickerid)
    // ha_open = security(ha_t, res, open[hshift]) // hshift = 1 (prev candle)
    // ha_close = security(ha_t, res, close[hshift]) // hshift = 1 (prev candle)
    // mha_close = security(ha_t, res1, close[mhshift]) // mhshift = 0
    ha60open = ha60Prev.open; // 60min
    ha60close = ha60Prev.close; // 60 min
    mha180close = ha180Cur.close; // 180 min
    // DONE checking

    // 2. macd
    // [macdLine, signalLine, histLine] = macd(close, 12, 26, 9)
    // macdl = security(ha_t,res2,macdLine[macds]) // macds = 1 (prev candle), res2 = 15
    // macdsl= security(ha_t,res2,signalLine[macds]) // macds = 1 (prev candle), res2 = 15
    macdLineCur = macdCur.diff;
    signalLineCur = macdCur.signal && macdCur.signal.result;
    macdl = macdLinePrev;
    macdsl = signalLinePrev;
    // DONE checking

    // 3. Moving Average
    // fma = ema(mha_close[test],fama) // test = 1 , fama = 1
    // sma = ema(ha_close[slomas],sloma) // slomas = 1, sloma = 30

    console.error(`INFO time:${ time
      // }, ha: ${JSON.stringify(haCur)
      }, emaMha180CloseInd: ${JSON.stringify(emaMha180CloseInd)
      }, emaMha180CloseIndPrev: ${JSON.stringify(emaMha180CloseIndPrev)
      // }, ha60open: ${JSON.stringify(ha60open)
      // }, ha60close: ${JSON.stringify(ha60close)
      }, mha180close: ${JSON.stringify(mha180close)
      // }, macdLine: ${JSON.stringify(macdl)
      // }, signalLine: ${JSON.stringify(macdsl)
      }`);
  }


  // time after last BUY:
  // if ((this.candle.start.diff(buyTs, 'minutes') > this.settings.TIMEOUT)) {
  //
  // }
  // if(!advised) {
  //   // can BUY
  // } else {
  //   // can SELL
  // }

  haPrev = haCur;
  ha60Prev = ha60Cur;
  ha180Prev = ha180Cur;

  macdLinePrev = macdLineCur;
  signalLinePrev = signalLineCur;

  emaMha180CloseIndPrev = emaMha180CloseInd;
}

strat.sell = function(reason) {
  this.notify({
    type: 'sell advice',
    reason: reason,
  });
  this.advice('short');
  advised = false;
  buyPrice = 0;
  if (this.tradeInitiated) { // Add logic to use other indicators
    this.tradeInitiated = false;
  }
}

strat.buy = function(reason) {
  advised = true;
  // If there are no active trades, send signal
  if (!this.tradeInitiated) { // Add logic to use other indicators
    this.notify({
      type: 'buy advice',
      reason: reason,
    });
    this.advice('long');
    buyTs = this.candle.start;
    buyPrice = currentPrice;
    this.tradeInitiated = true;
  }
}
strat.onPendingTrade = function(pendingTrade) {
  this.tradeInitiated = true;
}

strat.onTrade = function(trade) {
  this.tradeInitiated = false;
}
// Trades that didn't complete with a buy/sell
strat.onTerminatedTrades = function(terminatedTrades) {
  log.info('Trade failed. Reason:', terminatedTrades.reason);
  this.tradeInitiated = false;
}

strat.end = function(a, b, c) {
}

module.exports = strat;
