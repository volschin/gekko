/*
  IWannaBeRich strategy - 2018-05-03
 */
// helpers
var _ = require('lodash');
var log = require('../core/log.js');

var bb = require('./indicators/BB.js');
var rsi = require('./indicators/RSI.js');
var macd = require('./indicators/MACD.js');

// let's create our own strat
var strat = {};

let counter = 0;

// prepare everything our strat needs
strat.init = function () {
  this.tradeInitiated = false;
  this.name = 'IWannaBeRich';
  this.nsamples = 0;
  this.trend = {
    duration: 0,
    persisted: false,
    direction: '', //up, down
    adviced: false
  };

  this.requiredHistory = this.tradingAdvisor.historySize;

  // define the indicators we need
  this.addIndicator('bb', 'BB', this.settings.bbands);
  this.addIndicator('rsi', 'RSI', this.settings.rsi);
  this.addIndicator('macd', 'MACD', this.settings.macd);
}


// what happens on every new candle?
strat.update = function(candle) {

  // Send message that bot is still working after 24 hours (assuming minute candles)
  counter++;
  if (counter == 1440){
    log.remote(this.name, ' - Bot is still working.');
    counter = 0;
  }
}

// for debugging purposes log the last
// calculated parameters.
strat.log = function (candle) {
   var digits = 8;

   var bb = this.indicators.bb;
   var rsi = this.indicators.rsi;
   var macd = this.indicators.macd;
   var diff = macd.diff;
   var signal = macd.signal.result;

   //BB logging
   //BB.lower; BB.upper; BB.middle are your line values
   log.debug('______________________________________');
   log.debug('calculated BB properties for candle ', this.nsamples);

   if (bb.upper > candle.close) log.debug('\t', 'Upper BB:', bb.upper.toFixed(digits));
   if (bb.middle > candle.close) log.debug('\t', 'Mid   BB:', bb.middle.toFixed(digits));
   if (bb.lower >= candle.close) log.debug('\t', 'Lower BB:', bb.lower.toFixed(digits));
   log.debug('\t', 'price:', candle.close.toFixed(digits));
   if (bb.upper <= candle.close) log.debug('\t', 'Upper BB:', bb.upper.toFixed(digits));
   if (bb.middle <= candle.close) log.debug('\t', 'Mid   BB:', bb.middle.toFixed(digits));
   if (bb.lower < candle.close) log.debug('\t', 'Lower BB:', bb.lower.toFixed(digits));
   log.debug('\t', 'Band gap: ', bb.upper.toFixed(digits) - bb.lower.toFixed(digits));

   //RSI logging
   log.debug('calculated RSI properties for candle:');
   log.debug('\t', 'rsi:', rsi.result.toFixed(digits));
   log.debug('\t', 'price:', candle.close.toFixed(digits));

   //MACD logging
   log.debug('calculated MACD properties for candle:');
   log.debug('\t', 'short:', macd.short.result.toFixed(digits));
   log.debug('\t', 'long:', macd.long.result.toFixed(digits));
   log.debug('\t', 'macd:', diff.toFixed(digits));
   log.debug('\t', 'signal:', signal.toFixed(digits));
   log.debug('\t', 'macdiff:', macd.result.toFixed(digits));
}

// Based on the newly calculated
// information, check if we should
// update or not.
strat.check = function (candle) {
  var bb = this.indicators.bb;
  var price = candle.close;
  this.nsamples++;

  var rsi = this.indicators.rsi;
  var rsiVal = rsi.result;

  var macd = this.indicators.macd;
  var macddiff = this.indicators.macd.result;

  //uptrend
  if (price <= bb.lower && rsiVal <= this.settings.rsi.low && macddiff > this.settings.macd.up) {
      // new trend detected
      if(this.trend.direction !== 'up'){
         // reset the state for the new trend
        this.trend = {
          duration: 0,
          persisted: false,
          direction: 'up',
          adviced: false
        };
      }
      this.trend.duration++;
      log.debug('In uptrend since', this.trend.duration, 'candle(s)');

      if(this.trend.duration >= this.settings.rsi.persistence && this.trend.duration >= this.settings.macd.persistence){
          this.trend.persisted = true;
      }

      if(this.trend.persisted && !this.trend.adviced && !this.tradeInitiated) {
        this.trend.adviced = true;
        this.advice('long');
        return;
      }
  }

  //downtrend
  if (price > bb.middle && rsiVal >= this.settings.rsi.high && macddiff < this.settings.macd.down) {
    // new trend detected
    if(this.trend.direction !== 'down'){
      // reset the state for the new trend
      this.trend = {
      duration: 0,
      persisted: false,
      direction: 'down',
      adviced: false
      };
    }

    this.trend.duration++;

    log.debug('In downtrend since', this.trend.duration, 'candle(s)');

    if(this.trend.duration >= this.settings.rsi.persistence && this.trend.duration >= this.settings.macd.persistence){
      this.trend.persisted = true;
    }

    if(this.trend.persisted && !this.trend.adviced && !this.tradeInitiated) {
      this.trend.adviced = true;
      this.advice('short');
      return;
    }
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

  asset = portfolio.asset;
  currency = portfolio.currency;

}

// This reports the portfolio value as the price of the asset
// fluctuates. Reports every minute when you are hodling.
strat.onPortfolioValueChange = function(portfolioValue) {
  log.info('new portfolio value', portfolioValue.balance);
  log.info('Holding more than 10% of asset =', portfolioValue.hodling);
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
      cmd.response = config.watch.currency + "/" + config.watch.asset +
      "\nPrice: " + currentPrice;

  }
  if (command == 'help') {
  cmd.handled = true;
      cmd.response = "Supported commands: \n\n /buy - Buy at next candle" +
      "\n /sell - Sell at next candle " +
      "\n /status - Show indicators and current portfolio";
  }
  if (command == 'buy') {
    cmd.handled = true;
    this.advice('long');

  }
  if (command == 'sell') {
    cmd.handled = true;
    this.advice('short');
  }
}

module.exports = strat;
