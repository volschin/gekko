// RSI Ladder Sell
// Created by Crypto49er
//
// 
// Buy when it goes below 20
// 2% stop loss
// Sell 25% when it passes 70 and falls
// Sell 75% the next time it passes 70 and falls
// Sell if prices goes up 5% in one candles


const fs = require('fs');
const log = require('../core/log');
const config = require ('../core/util.js').getConfig();

const CandleBatcher = require('../core/candleBatcher');
const RSI = require('../strategies/indicators/RSI.js');

// Let's create our own strat
var strat = {};
var buyPrice = 0.0;
var currentPrice = 0.0;
var rsi5 = new RSI({ interval: 14 });
var advised = false;
var rsi5History = [];
var wait = 0;
var counter = 0;
var disableTrading = false;
var priceHistory = [];
var highestRSI = 0; // highestRSI in last 5 candles
var candle5 = {};
var sold25Percent = false;
var backBelow70 = false;

/*** Set Buy/Sell Limits Here */
var buyLimit = 100; // How much to buy
var sellLimit = 88.33; // How much asset to sell

// Prepare everything our method needs
strat.init = function() {
  this.name = "RSI_Ladder_Sell";
  this.requiredHistory = config.tradingAdvisor.historySize;

  // since we're relying on batching 1 minute candles into 5 minute candles
  // lets throw if the settings are wrong
  if (config.tradingAdvisor.candleSize !== 1) {
    throw "This strategy must run with candleSize=1";
  }

  // create candle batchers for 5 minute candles
  this.batcher5 = new CandleBatcher(60);

  // supply callbacks for 5 minute candle function
  this.batcher5.on('candle', this.update5);


  // Add an indicator even though we won't be using it because
  // Gekko won't use historical data unless we define the indicator here
  this.addIndicator('rsi', 'RSI', { interval: this.settings.interval});

  // Balance Tracker in case Gekko crashes
  fs.readFile(this.name + '-balanceTracker.json', (err, contents) => {
    var fileObj = {};
    if (err) {
      log.warn('No file with the name', this.name + '-balanceTracker.json', 'found. Creating new tracker file');
      fileObj = {
      sellLimit: sellLimit,
      buyLimit: buyLimit,
      };
      fs.appendFile(this.name + '-balanceTracker.json', JSON.stringify(fileObj), (err) => {
      if(err) {
        log.error('Unable to create balance tracker file');
      }
      });
    } else {
      try {
      fileObj = JSON.parse(contents)
      sellLimit = fileObj.sellLimit;
      buyLimit = fileObj.buyLimit;
      }
      catch (err) {
      log.error('Tracker file empty or corrupted');
      }
    }
  });
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
    log.remote(this.name, ' - Bot is still working.');
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

  candle5 = this.batcher5.calculatedCandles[0];
  //log.debug('5 minute candle.close ', candle5.close);

  // Store the last ten 5 minute candle prices
  priceHistory.push(candle.close);
  if (priceHistory.length > 10) {
    priceHistory.shift();
  }

  // We only need to store RSI for 10 candles
  rsi5History.push(rsi5.result);
  if (rsi5History.length > 10) {
    rsi5History.shift();
  }

  highestRSI = 0;
  for (i=5;i<=rsi5History.length-1;i++){
    if(rsi5History[i] > highestRSI) {
      highestRSI = rsi5History[i];
    }
  }
}

strat.onPendingTrade = function(pendingTrade) {
  this.tradeInitiated = true;

}

// Based on the newly calculated
// information, check if we should
// update or not.
strat.check = function() {

  // Buy when RSI > 20
  if (rsi5History[8] < 20 && rsi5History[9] > 20
    && !this.tradeInitiated && !advised && !sold25Percent && !disableTrading){
    this.advice({
      direction: 'long',
      amount: buyLimit,
    });
    log.info('Buy - RSI > 20', 
    rsi5History[0].toFixed(2), rsi5History[1].toFixed(2), rsi5History[2].toFixed(2),
    rsi5History[3].toFixed(2),rsi5History[4].toFixed(2),rsi5History[5].toFixed(2),
    rsi5History[6].toFixed(2),rsi5History[7].toFixed(2),rsi5History[8].toFixed(2),
    rsi5.result.toFixed(2));
    advised = true;
    buyPrice = currentPrice;
  }

  // Sell 25% when RSI passes 70 and falls
  if (rsi5History[8] > rsi5.result && rsi5History[8] > 70 && !sold25Percent && advised && !this.tradeInitiated) {
    var sell25 = sellLimit / 4
    this.advice({
      direction: 'short',
      amount: sell25,
    });
    log.info('Take Profit - RSI past 70');
    sold25Percent = true
  }

  // Note when RSI goes back below 70
  if (sold25Percent && rsi5History[8] < 70 && rsi5.result > 70) {
    backBelow70 = true;
  }

  // Sell remaining 75% when RSI pass 70 again and falls
  if (sold25Percent && backBelow70 && 
    rsi5History[8] > rsi5.result && rsi5History[8] > 70 && advised && !this.tradeInitiated) {
      this.advice({
        direction: 'short',
        amount: sellLimit,
      });
      log.info('Take Profit - RSI past 70 again');
      advised = false;
      sold25Percent = false;
      backBelow70 = false
    }

  // Sell if currentPrice <= buyPrice * 0.98 (2% stop loss)
  if (currentPrice <= buyPrice * 0.98 && advised && !this.tradeInitiated){
    this.advice({
      direction: 'short',
      amount: sellLimit,
    });
    log.info('2% Stop Loss');
    advised = false;
    sold25Percent = false;
    backBelow70 = false

  }
  
  // Sell if candle goes up 5%
  if (candle5.close - candle5.open > candle5.close * 0.05 && advised && !this.tradeInitiated) {
    this.advice({
      direction: 'short',
      amount: sellLimit,
    });
    log.info('2% Stop Loss');
    advised = false;
    sold25Percent = false;
    backBelow70 = false
  }

}

strat.onPortfolioChange = function(portfolio) {

  asset = portfolio.asset;
  currency = portfolio.currency;
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
  if (trade.action == 'buy') {
    buyPrice = trade.price;
    sellLimit = buyLimit / trade.price;
    exposed = true;
  }

  if (trade.action == 'sell') {
    log.info('Bought at', buyPrice, 'Sold at', trade.price);
    buyLimit = trade.amount * trade.price;
    sellLimit = trade.portfolio.asset - trade.amount;
    exposed = false;
    buyPrice = 0;
  }

  // Write balance tracker
  var fileObj = {
    sellLimit: sellLimit,
    buyLimit: buyLimit,
  }
  fs.writeFile(this.name + '-balanceTracker.json', JSON.stringify(fileObj), (err) => {
    if(err) {
      log.error('Unable to write to balance tracker file');
    }
  });

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
  if (command == 'help') {
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



module.exports = strat;
