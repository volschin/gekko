// Step Gains
// This only works with this modded version of Gekko
//
// This strat begins by waiting for the current price
// to drop 2% (watchPrice). If it drop further, it will
// populate lowestPrice. When current price > lowestPrice
// and it is less than 200 SMA hourly, it will buy.
// It will sell when there's a 5% gain but still less than
// 200 SMA hourly.
// Once it goes above 200 SMA hourly, it won't sell until
// it makes 50% gains.
// It has a trailing stop loss of 5% (it will sell if
// price drops 5%) but still greater than 5% gain.
//
// https://github.com/crypto49er/moddedgekko
//

const fs = require('fs');
const log = require('../core/log.js');
const config = require ('../core/util.js').getConfig();
const CandleBatcher = require('../core/candleBatcher');
const RSI = require('../strategies/indicators/RSI.js');
const SMA = require('../strategies/indicators/SMA.js');

var strat = {};
var rsi5 = new RSI({ interval: 14 });
var sma60 = new SMA(200);
var asset = 0;
var currency = 0;
var currentPrice = 0;
var counter = 0;
var buyPrice = 0; // Get it from onTrade
var watchPrice = 0.0; // 98% of price when bot is started
var lowestPrice = Infinity; // Sets when current price is below watchPrice
var sellPrice = Infinity;
var hugeGainSell = Infinity;
var advised = false;
var candle5 = {};
var candle60 = {};
var exposed = false;
var highestExposedPrice = 0;


/*** Set Buy/Sell Limits Here */
var buyLimit = 10; // How much to buy
var sellLimit = 1.7; // How much asset to sell


// Prepare everything our strat needs
strat.init = function() {
  // your code!
  this.name = 'StepGains';
  this.tradeInitiated = false;

  // since we're relying on batching 1 minute candles into 5 minute candles
  // lets throw if the settings are wrong
  if (config.tradingAdvisor.candleSize !== 1) {
    throw "This strategy must run with candleSize=1";
  }

  // create candle batchers for 5 minute candles
  this.batcher5 = new CandleBatcher(5);

  // supply callbacks for 5 minute candle function
  this.batcher5.on('candle', this.update5);

  // create candle batchers for 60 minute candles
  this.batcher60 = new CandleBatcher(60);

  // supply callbacks for 60 minute candle function
  this.batcher60.on('candle', this.update60);

  // Add an indicator even though we won't be using it because
  // Gekko won't use historical data unless we define the indicator here
  this.addIndicator('rsi', 'RSI', { interval: this.settings.interval});

  // Recovery: If Gekko crashes and PM2 is enabled,
  // we want Gekko to recover the state it was in
  // so it won't miss good trades or execute bad trades
  // (Ex: Sell at loss because it forgot buy price)

  // Use recovery file if it exists and live trading
  if (config.trader && config.trader.enabled) {
    fs.readFile(this.name + '-recovery.json', (_, contents) => {
      var fileObj = {};
      try {
        fileObj = JSON.parse(contents);
        watchPrice = fileObj.watchPrice;
        lowestPrice = fileObj.lowestPrice;
        sellPrice = fileObj.sellPrice;
        hugeGainSell = fileObj.hugeGainSell;
        highestExposedPrice = fileObj.highestExposedPrice;
        advised = fileObj.advised;
        sellPrice = fileObj.sellPrice;
        advised = fileObj.advised;
        }
        catch (err) {
        log.error('Recovery file not available');
        }

    });
  }

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

    // write 1 minute candle to 5 minute batchers
    this.batcher5.write([candle]);
    this.batcher5.flush();

    //write 1 minute candle to 60 minute batchers
    this.batcher60.write([candle]);
    this.batcher60.flush();

    // Send message that bot is still working after 24 hours (assuming minute candles)
    counter++;
    if (counter == 1440){
      log.remote(this.name, '- Bot is still working. Will buy when price closes above ', lowestPrice);
      counter = 0;
    }

    log.debug('candle time', candle.start.format());
    log.debug('candle close price:', candle.close);

    currentPrice = candle.close;
}

strat.update5 = function(candle) {
  rsi5.update(candle);

  candle5 = this.batcher5.calculatedCandles[0];

}

strat.update60 = function(candle) {
  sma60.update(candle.close);

  candle60 = this.batcher5.calculatedCandles[0];
}

// Based on the newly calculated
// information, check if we should
// update or not.
strat.check = function(candle) {
// if we're waiting to sell, update highest price
if(exposed && highestExposedPrice < candle5.close) {
  highestExposedPrice = candle5.close;
}

if(watchPrice == 0){
    watchPrice = candle.close * 0.98;
}
if(candle.close <= watchPrice && candle.close < lowestPrice){
    lowestPrice = candle.close;
}
// Buy if price recover from lowest price and less than 200 SMA hourly
if(candle5.close > lowestPrice && sma60.result > candle5.close && !advised && !this.tradeInitiated){
    this.advice({
      direction: 'long',
      amount: buyLimit,
    });
    log.info('Buying at', candle.close);
    sellPrice = candle.close * 1.05;
    hugeGainSell = candle.close * 1.5;
    advised = true;
    this.writeRecoveryFile();
    return;
}
// Sell if 5% gain but still less than SMA200 hourly
if(candle5.close > sellPrice && sma60.result > candle5.close && watchPrice != 0 && lowestPrice != Infinity && advised && !this.tradeInitiated){
    this.advice({
      direction: 'short',
      amount: sellLimit,
    });
    log.info('Selling at', candle.close);
    watchPrice = 0;
    lowestPrice = Infinity;
    sellPrice = Infinity;
    hugeGainSell = Infinity;
    advised = false;
    highestExposedPrice = 0;
    this.writeRecoveryFile();
    return;
}
// Sell if 50% gain and > SMA200 hourly
if(candle5.close > hugeGainSell && sma60.result < candle5.close && watchPrice != 0 && lowestPrice != Infinity && advised && !this.tradeInitiated){
  this.advice({
    direction: 'short',
    amount: sellLimit,
  });
  log.info('Selling at', candle.close);
  watchPrice = 0;
  lowestPrice = Infinity;
  sellPrice = Infinity;
  hugeGainSell = Infinity;
  advised = false;
  highestExposedPrice = 0;
  this.writeRecoveryFile();
  return;
}
// Trailing stop - Sell if price falls 5% below highest recorded but still > sellPrice
if(highestExposedPrice > candle5.close * 1.05 && candle5.close > sellPrice && watchPrice != 0 && lowestPrice != Infinity && advised && !this.tradeInitiated){
  this.advice({
    direction: 'short',
    amount: sellLimit,
  });
  log.info('Selling at', candle.close);
  watchPrice = 0;
  lowestPrice = Infinity;
  sellPrice = Infinity;
  hugeGainSell = Infinity;
  advised = false;
  highestExposedPrice = 0;
  this.writeRecoveryFile();
  return;
}

log.info(candle.start.format('l LT'), ' Watch', watchPrice, ', Lowest', lowestPrice, ', 5 Min Close', candle5.close, 'SMA', sma60.result);


}

strat.writeRecoveryFile = function() {
  if (config.trader && config.trader.enabled) {
    var recFileObj = {
      watchPrice: watchPrice,
      lowestPrice: lowestPrice,
      sellPrice: sellPrice,
      hugeGainSell: hugeGainSell,
      highestExposedPrice: highestExposedPrice,
      advised: advised,
    }
    fs.writeFile(this.name + '-recovery.json', JSON.stringify(recFileObj), (err) => {
      if(err) {
        log.error('Unable to write to recovery file');
      }
    })
  }
}

// This is called when trader.js initiates a
// trade. Perfect place to put a block so your
// strategy won't issue more trader orders
// until this trade is processed.
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
  if (trade.action == 'buy') {
    buyPrice = trade.price;
    sellLimit = buyLimit / trade.price;
    exposed = true;
  }

  if (trade.action == 'sell') {
    log.info('Bought at', buyPrice, 'Sold at', trade.price);
    buyLimit = trade.amount * trade.price;
    exposed = false;
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

// Trades that didn't complete with a buy/sell
strat.onTerminatedTrades = function(terminatedTrades) {
  log.info('Trade failed. Reason:', terminatedTrades.reason);
  this.tradeInitiated = false;
}

// This runs whenever the portfolio changes
// including when Gekko starts up to talk to
// the exhange to find out the portfolio balance.
// This is how the portfolio object looks like:
// {
//   currency: [number, portfolio amount of currency],
//   asset: [number, portfolio amount of asset],
// }
strat.onPortfolioChange = function(portfolio) {

  // Sell if we start out holding a bag
  // We determine this as currency and asset starts out
  // at 0 before we get the info from the exchange.
  // if (asset == 0 && currency == 0 && portfolio.asset > 0) {
  //   log.info('Starting with a sell as Gekko probably crashed after a buy')
  //   this.advice('short');
  // }

  asset = portfolio.asset;
  currency = portfolio.currency;

}

// This reports the portfolio value as the price of the asset
// fluctuates. Reports every minute when you are hodling.
strat.onPortfolioValueChange = function(portfolioValue) {
  // log.info('new portfolio value', portfolioValue.balance);
  // log.info('Holding more than 10% of asset =', portfolioValue.hodling);
}

// Optional for executing code
// after completion of a backtest.
// This block will not execute in
// live use as a live gekko is
// never ending.
strat.end = function() {
  // your code!
}

// This runs when a commad is sent via Telegram
strat.onCommand = function(cmd) {
  var command = cmd.command;
  if (command == 'start') {
      cmd.handled = true;
      cmd.response = "Hi. I'm Gekko. Ready to accept commands. Type /help if you want to know more.";
  }
  if (command == 'status') {
      cmd.handled = true;
      if (lowestPrice < Infinity) {
        cmd.response = config.watch.currency + "/" + config.watch.asset +
        "\nPrice: " + currentPrice + "\nWill buy when price goes above " + lowestPrice;
      } else {
        cmd.response = config.watch.currency + "/" + config.watch.asset +
        "\nPrice: " + currentPrice + "\nWaiting for price to drop below " + watchPrice;
      }

  }
  if (command == 'help') {
  cmd.handled = true;
      cmd.response = "Supported commands: \n\n /buy - Buy at next candle" +
      "\n /sell - Sell at next candle " +
      "\n /status - Show indicators and current portfolio";
  }
  if (command == 'buy') {
    cmd.handled = true;
    this.advice({
      direction: 'long',
      amount: buyLimit,
    });

  }
  if (command == 'sell') {
    cmd.handled = true;
    this.advice({
      direction: 'short',
      amount: sellLimit,
    });
  }
  if (command == 'setLowestPrice') {
    cmd.handled = true;
    if (cmd.arguments[0]) {
      if (typeof cmd.arguments[0] == 'number') {
        lowestPrice = cmd.arguments[0];
      }
    }
  }
  if (command == 'setSellPrice') {
    cmd.handled = true;
    if (cmd.arguments[0]) {
      if (typeof cmd.arguments[0] == 'number') {
        sellPrice = cmd.arguments[0];
      }
    }
  }

}


module.exports = strat;
