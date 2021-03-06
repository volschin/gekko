// RSI + Candle
// Created by Crypto49er
// Version 2 (Version 1 was made for my heavily modded version of Gekko, version 2 is for based version of Gekko)
//
// This strategy is designed for 5 minute candles.
// Idea 1: When RSI drops aggressively (>18 points) and goes way below 30 (< 12), there's an
// excellent chance the price shoots back up and over 70 RSI.
// Idea 2: When RSI drops below 30 and candle creates a hammer, it means the bears are
// exhausted and immediate gains should occur in the new few candles.

// Buy when RSI < 12 and RSI dropped more than 18 points compared to previous 2 candles
// Buy when RSI < 30 and candle is a hammer
// Sell when RSI > 70
// Sell when 1% stop loss
//
// addon: selling gradually in time
//https://www.youtube.com/watch?v=erlPbF0B6BY

var log = require('../core/log');
var config = require ('../core/util.js').getConfig();

const CandleBatcher = require('../core/candleBatcher');
const RSI = require('../strategies/indicators/RSI.js');
const SMA = require('../strategies/indicators/SMA.js');
let rsiArr = [];
// Let's create our own strat
var strat = {};
var buyPrice = 0.0;
var buyTs;
var isCandleBuy = false;
var isATRBuy = false;
var currentPrice = 0.0;
var rsi5 = new RSI({ interval: 14 });
var sma5 = new SMA(200);
var advised = false;
var rsi5History = [];
var wait = 0;
var counter = 0;
var disableTrading = false;
var waitForRejectedRetry = 0;
var priceHistory = [];
var sma5History = [];
let highestRSI = 0; // highestRSI in last 5 candles
let lowestRSI = 100; // lowestRSI in last 5 candles
var candle5 = {};

const STOP_LOSS_COEF = 0.9;
// const STOP_LOSS_COEF = 0.99;
// const TAKE_PROFIT_COEF = 1.1;
const TAKE_PROFIT_COEF = 1.01;

// const ATR_LOW_SELL = 0.00001848;

let THRESHOLDS = {};
// Prepare everything our method needs
strat.init = function() {
  THRESHOLDS = this.settings.thresholds;
  //console.log(`THRESHOLDS.ATR_LOW_SELL: ${ THRESHOLDS.ATR_LOW_SELL} `);

  this.requiredHistory = config.tradingAdvisor.historySize;

  // since we're relying on batching 1 minute candles into 5 minute candles
  // lets throw if the settings are wrong
  if (config.tradingAdvisor.candleSize !== 1) {
    throw "This strategy must run with candleSize=1";
  }

  // create candle batchers for 5 minute candles
  this.batcher5 = new CandleBatcher(5);

  // supply callbacks for 5 minute candle function
  this.batcher5.on('candle', this.update5);


  // Add an indicator even though we won't be using it because
  // Gekko won't use historical data unless we define the indicator here
  //this.addIndicator('rsi', 'RSI', { interval: this.settings.interval});


  let customATRSettings = {
    optInTimePeriod: this.settings.ATR_Period || 14,
  }
  // add the indicator to the strategy
  this.addTulipIndicator('atr', 'atr', customATRSettings);
  this.addTulipIndicator('rsi', 'rsi', { optInTimePeriod: 14 });

  this.tradeInitiated = false;
  console.log(`SETTINGS: ${JSON.stringify(this.settings)}`);
}

// What happens on every new candle?
strat.update = function(candle) {
  currentPrice = candle.close;

  // write 1 minute candle to 5 minute batchers
  this.batcher5.write([candle]);
  this.batcher5.flush();

  // Send message
  counter++;
  if (counter == 1440){
    //console.log('Bot is still working.');
    counter = 0;
  }

  // Decrement wait
  if (wait > 0) {
    wait--;
    log.debug('Wait: ', wait);
  }

}

strat.update5 = function(candle) {
  rsi5.update(candle);
  sma5.update(candle.close);

  candle5 = this.batcher5.calculatedCandles[0];
  //log.debug('5 minute candle.close ', candle5.close);

  // Store the last three 5 minute candle prices
  priceHistory.push(candle.close);
  if (priceHistory.length > 10) {
    priceHistory.shift();
  }

  // Store the last three sma5 prices
  sma5History.push(sma5.result);
  if (sma5History.length > 3) {
    sma5History.shift();
  }

  // We only need to store RSI for 10 candles
  rsi5History.push(rsi5.result);
  if (rsi5History.length > 10) {
    rsi5History.shift();
  }

  highestRSI = 0;
  for (let i=5;i<=rsi5History.length-1;i++){
    if(rsi5History[i] > highestRSI) {
      highestRSI = rsi5History[i];
    }
  }
  lowestRSI = 100;
  for (let i=5;i<=rsi5History.length-1;i++){
    if(rsi5History[i] < lowestRSI) {
      lowestRSI = rsi5History[i];
    }
  }

  //Send price and RSI to console every 5 minutes
  //log.info('Price', currentPrice, 'SMA', sma5.result, 'RSI', rsi5.result.toFixed(2));
}

// Based on the newly calculated
// information, check if we should
// update or not.
let rsiPrevPrevPrev = 0;
let rsiPrevPrev = 0;
let rsiPrev = 0;
strat.check = function() {
  // RSI Candle:
  if(true) {
    // Buy when RSI < 12 and RSI dropped more than 18 points compared to previous 2 candles
    if (rsi5.result < 12 && (rsi5History[7] > rsi5.result + 18 || rsi5History[8] > rsi5.result + 18) && !advised && !disableTrading) {
      isCandleBuy = true;
      isATRBuy = false;
      this.buy('Buy because RSI less than 12', this.candle);
    }
    // //Buy when RSI < 30 and candle is a hammer
    if (rsi5.result < 30 && candle5.open > candle5.low && candle5.open - candle5.low > candle5.low * 0.006 && candle5.open > candle5.close && (candle5.open - candle5.close) / (candle5.open - candle5.low) < 0.25 && !advised && !disableTrading) {
      isCandleBuy = true;
      isATRBuy = false;
      this.buy('Buy because RSI less than 30 and candle is a hammer', this.candle);
    }
    if(advised && isCandleBuy){
      // Sell when RSI > 70
      if (rsi5.result > 70) {
        //   console.log(`ascurrentPrice: ${currentPrice}, buyPrice: ${ buyPrice } `);
        this.sell('Take Profit - RSI past 70');
      }
      // Sell if currentPrice <= buyPrice * 0.99 (1% stop loss)
      if (currentPrice <= buyPrice * STOP_LOSS_COEF){
        this.sell('Stop Loss - 1% loss');
      }
    }
  }
  // RSI+ATR:
  if(true) {
    let atr = this.tulipIndicators.atr.result.result;
    //console.log(`atr: ${ JSON.stringify(atr)}`);
    // console.log(`candle5: ${ JSON.stringify(candle5)}`);
    let time = JSON.stringify(this.candle.start);
    // console.log(`time: ${ time }`);
    let rsi = rsi5.result;
    // let rsi = this.tulipIndicators.rsi.result.result;
    // console.log(`INFO time:${ time }, Date.now:${ Date.now() }, buyTs:${ buyTs }, diff:${  buyTs && buyTs.diff(this.candle.start, 'minutes') }`);
    // console.log(`ALL INFO: ${time}, ${atr}, ${ rsi }, ${ rsi5.result }`);

    if (atr && rsi && rsi !== 0) {
      if (atr >= THRESHOLDS.ATR_HIGH_BUY
        && (rsi < THRESHOLDS.RSI_LOW_BUY || rsiPrev < THRESHOLDS.RSI_LOW_BUY || rsiPrevPrev < THRESHOLDS.RSI_LOW_BUY || rsiPrevPrevPrev < THRESHOLDS.RSI_LOW_BUY ) && !advised) {
        isCandleBuy = false; // false by default
        isATRBuy = true; // false by default
        this.buy('RSI+ATR: BUY!!', this.candle);
      }
      if (rsi < THRESHOLDS.RSI_LOW_BUY_ALWAYS  && !advised) {
        this.buy(`RSI_LOW_BUY_ALWAYS: BUY!! RSI: ${ rsi }`, this.candle);
        // console.error(`RSI_LOW_BUY_ALWAYS: BUY!!  ${time}, RSI: ${ rsi }, RSI-5: ${ rsi5.result }`);
      }
      if(atr >= THRESHOLDS.ATR_HIGH_BUY) {
        // console.error(`ATR >= THRESHOLDS.ATR_HIGH_BUY: ${time}, ${atr}, ${ rsi }`);
        //console.log(`ATR >= THRESHOLDS.ATR_HIGH_BUY: ${time}, ${atr}, ${ rsi }`);
      }
      if(atr <= THRESHOLDS.ATR_LOW_SELL) {

      }
      // if(advised && isATRBuy) {
      if(advised) {
        if (atr <= THRESHOLDS.ATR_LOW_SELL && rsi > THRESHOLDS.RSI_HIGH_SELL) {
          this.sell('RSI+ATR: SELL!!');
          //console.log(`ATR_LOW_SELL && RSI_HIGH_SELL !!! ${time}, ${atr}, ${ rsi }`);
        }
        if (rsi > THRESHOLDS.RSI_HIGH_SELL_ALWAYS) {
          this.sell('RSI_HIGH_SELL_ALWAYS: SELL!!');
          //console.log(`RSI_HIGH_SELL_ALWAYS !!! ${time}, ${atr}, ${ rsi }`);
        }
        // sell if trade is more than 1 hr(TIMEOUT_EXIT_MINUTES), coz usually it's a loss, if followed this strat rules
        // , if TIMEOUT_EXIT_COEF > 1 - take profit condition, if TIMEOUT_EXIT_COEF< 1 - stop loss:
        if (buyTs) {
          //console.log(`asdf: ${buyTs}, diff: ${this.candle.start.diff(buyTs, 'minutes')}, currentPrice: ${currentPrice},buyPrice: ${buyPrice},buyPrice * THRESHOLDS.TAKE_PROFIT_COEF:${buyPrice * THRESHOLDS.TAKE_PROFIT_COEF}`);
          if (this.candle.start.diff(buyTs, 'minutes') > THRESHOLDS.TIMEOUT_EXIT_MINUTES
              && currentPrice >= buyPrice * THRESHOLDS.TIMEOUT_EXIT_COEF) {
            this.sell('TAKE PROFIT AFTER TIMEOUT: SELL!!');
          } else if (this.candle.start.diff(buyTs, 'minutes') > THRESHOLDS.TIMEOUT_EXIT_MINUTES_2
              && currentPrice >= buyPrice * THRESHOLDS.TIMEOUT_EXIT_COEF_2) {
            this.sell('TAKE PROFIT AFTER TIMEOUT-2: SELL!!');
          } else if (this.candle.start.diff(buyTs, 'minutes') > THRESHOLDS.TIMEOUT_EXIT_MINUTES_3
              && currentPrice >= buyPrice * THRESHOLDS.TIMEOUT_EXIT_COEF_3) {
            this.sell('TAKE PROFIT AFTER TIMEOUT-3: SELL!!');
          }
        }
      }

      /*// Sell if currentPrice <= buyPrice * 0.99 (1% stop loss)
      if (currentPrice <= buyPrice * THRESHOLDS.STOP_LOSS_RATIO && advised) {
        this.sell('Stop Loss - 1% loss');
        console.log(`Stop Loss - 1% loss !!! ${time}, ${atr}, ${ rsi }`);
      }*/
    }
    rsiPrevPrevPrev = rsiPrevPrev;
    rsiPrevPrev = rsiPrev;
    rsiPrev = rsi;
  }
}

strat.sell = function(reason) {
  this.notify({
    type: 'sell advice',
    reason: reason,
  });
  this.advice('short');
  log.info(reason);
  console.log(reason);
  advised = false;
  buyPrice = 0;
  if (this.tradeInitiated) { // Add logic to use other indicators
    this.tradeInitiated = false;
  }
}

strat.buy = function(reason, candle) {
  // console.log(JSON.stringify(candle));
  advised = true;
  // If there are no active trades, send signal
  if (!this.tradeInitiated) { // Add logic to use other indicators
    this.notify({
      type: 'buy advice',
      reason: reason,
    });
    this.advice('long');
    buyTs = candle.start;
    log.info(reason);
    console.log(reason);
    buyPrice = currentPrice;
    this.tradeInitiated = true;
  }
}
// This is called when trader.js initiates a
// trade. Perfect place to put a block so your
// strategy won't issue more trader orders
// until this trade is processed.
// ash: NOT WORKING!! SEE .buy
strat.onPendingTrade = function(pendingTrade) {
  this.tradeInitiated = true;

}
// This runs whenever a trade is completed
// as per information from the exchange.
// The trade object looks like this:
// {
//   id: [string identifying this unique trade],
//   adviceId: [number specifying the advice id this trade is based on],
//   action: [either "buy" or "sell"],
//   price: [number, average price that was sold at],
//   amount: [number, how much asset was trades (excluding "cost")],
//   cost: [number the amount in currency representing fee, slippage and other execution costs],
//   date: [moment object, exchange time trade completed at],
//   portfolio: [object containing amount in currency and asset],
//   balance: [number, total worth of portfolio],
//   feePercent: [the cost in fees],
//   effectivePrice: [executed price - fee percent, if effective price of buy is below that of sell you are ALWAYS in profit.]
// }
strat.onTrade = function(trade) {
  this.tradeInitiated = false;
}
// Trades that didn't complete with a buy/sell
strat.onTerminatedTrades = function(terminatedTrades) {
  log.info('Trade failed. Reason:', terminatedTrades.reason);
  this.tradeInitiated = false;
}
strat.onCommand = function(cmd) {
  var command = cmd.command;
  if (command == 'start') {
    cmd.handled = true;
    cmd.response = "Hi. I'm Gekko. Ready to accept commands. Type /help if you want to know more.";
  }
  if (command == 'status') {
    cmd.handled = true;
    cmd.response = config.watch.currency + "/" + config.watch.asset +
      "\nPrice: " + currentPrice +
      "\nRSI: " + rsi5.result.toFixed(2) +
      "\nRSI History: " + rsi5History[7].toFixed(2) + ", " + rsi5History[8].toFixed(2) + ", " + rsi5History[9].toFixed(2);
  }
  if (command === 'help') {
    cmd.handled = true;
    cmd.response = "Supported commands: \n\n /buy - buy at next candle" +
      "\n /sell - sell at next candle " +
      "\n /status - show RSI and current portfolio" +
      "\n /stop - disable buying";
  }
  if (command == 'buy') {
    cmd.handled = true;
    this.buy('Manual buy order from telegram');
  }
  if (command == 'sell') {
    cmd.handled = true;
    this.sell('Manual sell order from telegram');
  }
  if (command == 'stop') {
    cmd.handled = true;
    if (cmd.arguments == 'true') {
      disableTrading = true;
      cmd.response = 'Gekko disabled from buying.';
    }
    if (cmd.arguments == 'false') {
      disableTrading = false;
      cmd.response = 'Gekko buying enabled.';
    }
  }
}
strat.end = function(a, b, c) {
  // your code!
  //console.log(`END: ${ a }, ${b}, ${c}`);
}


module.exports = strat;
