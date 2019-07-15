 // Track RSI
// 
// This strategy is made for 5 minute chart.
// This strategy sends a message after RSI dips below 30 and recover above it,
// with exception when RSI dips below 20, indicating a severe drop and 
// more drops ahead.
// This strategy sends another message after RSI goes above 70 but waits 
// until RSI drops below 70 to max out on gains (i.e. pRSI: 73.8 RSI: 68)

var log = require('../core/log');
var config = require ('../core/util.js').getConfig();

const CandleBatcher = require('../core/candleBatcher');
const RSI = require('../strategies/indicators/RSI.js');

// Let's create our own strat
var strat = {};
var buyPrice = 0.0;
var currentPrice = 0.0;
var rsi5 = new RSI({ interval: 14 });
var advised = false;
var rsi5History = [];
var sellAtProfit = false;
var previousCandlePrice = 0.0;
var oversoldPrice = 0.0;
var profitPercentage = 0.0; // Used only for RSI price divergence
var oversoldOnce = false; // Used for checking if RSI hits oversold 3x
var oversoldTwice = false; 

// Prepare everything our method needs
strat.init = function() {
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


  // Define the indicator even thought we won't be using it because
  // Gekko will only use historical data if we define the indicator here
  this.addIndicator('rsi', 'RSI', { interval: this.settings.interval});
}

// What happens on every new candle?
strat.update = function(candle) {
  currentPrice = candle.close;

  // write 1 minute candle to 5 and 10 minute batchers
  this.batcher5.write([candle]);
  this.batcher5.flush();

}

strat.update5 = function(candle) {
  rsi5.update(candle);

  // We only need to store RSI for 3 candles
  rsi5History.push(rsi5.result);
  if (rsi5History.length > 3) {
    rsi5History.shift();
  }
  //Send price and RSI to console every 5 minutes
  log.info('Price', currentPrice, 'RSI', rsi5.result.toFixed(2));
}

// Based on the newly calculated
// information, check if we should
// update or not.
strat.check = function(candle) {
  
  // Buy when:
  // rsi[0] <= rsi[1] and rsi[0] > 19.5 (RSI is slightly lower in bot than on TradingView)
  // rsi[1] <= rsi[2] and rsi[1] < overSold 
  // rsi[2] > overSold 
  if (rsi5History[0] <= rsi5History[1] && rsi5History[0] > 19.5 && rsi5History[1] <= rsi5History[2] && 
    rsi5History[1] < this.settings.oversold && rsi5History[2] > this.settings.oversold && !advised) {
      this.buy();
  }

  // Sell when:
  //(rsi[1] > rsi[2] and rsi[1] > overBought and rsi[2] < overBought
  if (rsi5History[1] > rsi5History[2] && rsi5History[1] > this.settings.overbought && rsi5History[2] < this.settings.overbought && advised) {
    this.sell(" exited overbought lvls in 5 min chart. Good indicator to exit a long.");
  }

  // if bought and rsi falls below 25 for 2 consecutive candles, enable Sell At Profit
  if (advised && rsi5History[2] < 25 && rsi5History[1] < 25) {
    sellAtProfit = true;
  }

  // Since rsi fell below 25 after exiting oversold, sell as soon as price falls after it becomes profitable
  if (advised && sellAtProfit && previousCandlePrice > buyPrice && currentPrice < previousCandlePrice ) {
    this.sell(" fell back under oversold after long indicator. Good time to attempt exit with profits.");
  }

  // Use RSI / Price divergence to indicate potential bear trend in 24 to 48 hours
  // If RSI goes from oversold to overbought but price goes up less than 0.25%,
  // the bulls is very weak, indicating potential for for bear trend in 24 to 48 hours

  // Capture price when oversold
  if (rsi5History[1] < this.settings.oversold && rsi5History[2] > this.settings.oversold) {
    oversoldPrice = currentPrice;
  }

  // Calculate profit percentage from oversold to overbought
  if (rsi5History[1] > this.settings.overbought && rsi5History[2] < this.settings.overbought && currentPrice > oversoldPrice && oversoldPrice > 0) {
    profitPercentage = ((currentPrice / oversoldPrice) - 1) * 100;
    // Check if it is a profit and if profit is smaller than 0.25%
    if (profitPercentage < 0.25 && profitPercentage > 0) {
      log.remote(config.watch.currency + "/" + config.watch.asset + " - RSI bearish divergence, might indicate potential bear trend in 24 to 48 hours.");
    }
    // reset oversoldPrice so this alert won't continue firing (hopefully)
    oversoldPrice = 0;
  }

  // Warn if RSI reach extreme oversold (RSI = 15 or less in ETH) 3x w/o reaching overbought
  if (rsi5History[2] > this.settings.extremeOverSold && rsi5History[1] < this.settings.extremeOverSold && oversoldTwice) {
    log.remote(config.watch.currency + "/" + config.watch.asset + " - RSI hit extreme oversold conditions 3x without hitting overbought lvls, might indicate potential bear trend in 24 to 48 hours");
    oversoldOnce = false;
    oversoldTwice = false;
  }
  if (rsi5History[2] > this.settings.extremeOverSold && rsi5History[1] < this.settings.extremeOverSold && oversoldOnce) {
    oversoldTwice = true;
  }
  if (rsi5History[2] > this.settings.extremeOverSold && rsi5History[1] < this.settings.extremeOverSold) {
    oversoldOnce = true;
  }
  if (rsi5History[2] > this.settings.overbought && (oversoldOnce || oversoldTwice)) {
    oversoldOnce = false;
    oversoldTwice = false;
  }
  previousCandlePrice = currentPrice;


}


strat.sell = function(reason) {
  var message = config.watch.currency + "/" + config.watch.asset + reason +
  "\nPrice: " + currentPrice + 
  "\nRSI History: " + rsi5History[0].toFixed(2) + ", " + rsi5History[1].toFixed(2) + ", " + rsi5History[2].toFixed(2) +
  "\n(15 min ago, 10 min ago, now)";
  log.remote(message);
  advised = false;
  buyPrice = 0;
  sellAtProfit = false;
}

strat.buy = function() {
  var message = config.watch.currency + "/" + config.watch.asset + " exited oversold lvls in 5 min chart. Good indicator to enter a long."+
  "\nPrice: " + currentPrice + 
  "\nRSI History: " + rsi5History[0].toFixed(2) + ", " + rsi5History[1].toFixed(2) + ", " + rsi5History[2].toFixed(2) +
  "\n(15 min ago, 10 min ago, now)";
  log.remote(message);
  advised = true;
  buyPrice = currentPrice;
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
      "\nRSI History: " + rsi5History[0].toFixed(2) + ", " + rsi5History[1].toFixed(2) + ", " + rsi5History[2].toFixed(2) +
      "\nPortfolio: ";
      
      var i;
      for (i = 0; i < config.currentIndicatorValues.portfolio.length; i++){
        cmd.response = cmd.response + "\n" + config.currentIndicatorValues.portfolio[i].name + ": " + config.currentIndicatorValues.portfolio[i].amount;
      }
  }
  if (command == 'help') {
  cmd.handled = true;
      cmd.response = "Supported commands: \n\n /buy - buy at next candle" + 
      "\n /sell - sell at next candle " + 
      "\n /status - show RSI and current portfolio";
    }
  if (command == 'error'){
  cmd.handled = true;
  //cmd.response = "This will generate an error message, let's see if message is shown in Telegram";
  log.remote('Can you see this error message in telegram?');
  }
  if (command == 'buy') {
  cmd.handled = true;
  this.buy();
  }
  if (command == 'sell') {
  cmd.handled = true;
  this.sell();
  }
}

module.exports = strat;
