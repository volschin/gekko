// TelegramRC - A strat that doesn't do anything
// except to let you remotely control Gekko via
// Telegram
// Only works with this modded version of Gekko

const log = require('../core/log.js');

var strat = {};
var asset = 0;
var currency = 0;
var advised = false;

// Prepare everything our strat needs
strat.init = function() {
  // your code!
}

// What happens on every new candle?
strat.update = function(candle) {
  // your code!
  if (!advised) {
   this.advice('long');
   advised = true;
  }

  //log.info('asset', asset, 'currency', currency);
}

// For debugging purposes.
strat.log = function() {
  // your code!


}

// Based on the newly calculated
// information, check if we should
// update or not.
strat.check = function(candle) {
  // your code!


}

// Optional for executing code
// after completion of a backtest.
// This block will not execute in
// live use as a live gekko is
// never ending.
strat.end = function() {
  // your code!
}

strat.onTrade = function(trade) {
  if (trade.action == 'buy') {
    this.advice('short');
  }
}




strat.onPortfolioChange = function(portfolio) {

  // Sell if we start out holding a bag
  // We determine this as currency and asset starts out
  // at 0 before we get the info from the exchange. 
  if (asset == 0 && currency == 0 && portfolio.asset > 0) {
    log.info('Starting with a sell as Gekko probably crashed after a buy')
    //this.advice('short');
  }

  asset = portfolio.asset;
  currency = portfolio.currency;

}

strat.onPortfolioValueChange = function(portfolioValue) {
  log.info('new portfolio value', portfolioValue.balance);
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