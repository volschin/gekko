// Big Trends
// This strategy scalps until a bull trend is identified, 
// then it holds til RSI drops below 70 to maximize gains.
// When it hits a stop loss (1% loss), it waits until DPO > 0
// before it re-enters scalp mode.
//
// This strategy is made for 5 minute chart.

// Buy
// This strategy buys after RSI dips below 30 and recover above it,
// with exception when RSI dips below 19.5, indicating a severe drop and 
// more drops ahead.
// Buy when stop lossed and DPO crosses above 0

// Sell
// This strategy then uses SMA 200 and SMA 200 * 1.01 to determine sell points
// If < SMA 200, sell as soon as RSI starts falling after hitting 70
// If > SMA 200, don't sell until it goes above SMA 200 * 1.01, 
// enable stop loss so if current price < buy price, sell
// If > SMA 200 * 1.01, wait til RSI falls below 70 then sell (i.e. previous RSI: 73.8 RSI: 68)

// Stop Loss
// 1% stop loss
// After stop loss, wait til DPO goes above 0 to enable buy


var log = require('../core/log');
var config = require ('../core/util.js').getConfig();

const CandleBatcher = require('../core/candleBatcher');
const RSI = require('../strategies/indicators/RSI.js');
const DPO = require('../strategies/indicators/DPO.js');
const SMA = require('../strategies/indicators/SMA.js');

// Let's create our own strat
var strat = {};
var buyPrice = 0.0;
var currentPrice = 0.0;
var rsi5 = new RSI({ interval: 14 });
var dpo5 = new DPO(50);
var sma5 = new SMA(200);
var advised = false;
var counter = 0;
var rsi5History = [];
var rsi5Lowest = 100;
var winningTrades = 0;
var losingTrades = 0;
var wentAbove70 = false;
var stopLossed = false;
var message = '';

// Prepare everything our method needs
strat.init = function() {
  this.name = 'Big Trends';
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
  // Gekko will only provide historical data if we define an indicator here
  this.addIndicator('rsi', 'RSI', { interval: this.settings.interval});
}

// What happens on every new candle?
strat.update = function(candle) {
  currentPrice = candle.close;

  // Notify bot is still working after 24 hours
  counter++;
  if (counter == 1440){
    log.remote(this.name, ' - Bot is still working.');
    counter = 0;
  }

  // write 1 minute candle to 5 and 10 minute batchers
  this.batcher5.write([candle]);
  this.batcher5.flush();

}

strat.update5 = function(candle) {
  rsi5.update(candle);
  dpo5.update(currentPrice);
  sma5.update(currentPrice);

  // We only need to store RSI for 10 candles
  rsi5History.push(rsi5.result);
  if (rsi5History.length > 10) {
    rsi5History.shift();
  }

  rsi5Lowest = Math.min.apply(null, rsi5History);

  //Send price and RSI to console every 5 minutes
  log.info('Price', currentPrice, 'RSI', rsi5.result.toFixed(2), 'SMA', sma5.result.toFixed(2), 
  'SMA-Up', (sma5.result * 1.01).toFixed(2), 'DPO', dpo5.result.toFixed(2));


}

// Based on the newly calculated
// information, check if we should
// update or not.
strat.check = function() {
  
  // Buy 
  // RSI > 19.5 in last 10 candles and rsi[8] < overSold and rsi[9] > overSold 
  if (!advised && !stopLossed && rsi5Lowest > 19.5 && rsi5History[8] < this.settings.oversold && rsi5History[9] > this.settings.oversold) {
      this.buy("RSI Buy - Exited Oversold");
  }

  // Buy if DPO > 0 and stopLossed, turn off stopLossed
  if (!advised && stopLossed && dpo5.result > 0) {
    this.buy("DPO Buy - Above 0");
    stopLossed = false;
  }

  // Sell
  // If current Price < SMA 200, sell as soon as RSI starts falling after hitting 70
  if (advised && currentPrice < sma5.result && rsi5History[8] > 70 && rsi5History[8] > rsi5.result ) {
    this.sell('Sell - Below 200 SMA and RSI > 70 but falling');
  }

  // If > SMA 200, don't sell until it goes above SMA 200 * 1.01, 
  // enable stop loss so if current price < buy price, sell
  if (advised && !wentAbove70 && currentPrice > sma5.result && rsi5.result > 70) {
    wentAbove70 = true;
  }

  // Sell if went above 70, but price fell back below SMA 200 and price < buy price
  if (advised && wentAbove70 && currentPrice < sma5.result && currentPrice < buyPrice) {
    this.sell('Sell - Hit 200 SMA then fell');
  }

  // Sell if current price > 200 SMA * 1.01 and rsi[8] > overBought and rsi[9] < overBought
  if (advised && currentPrice > sma5.result * 1.01 && rsi5History[8] > this.settings.overbought && rsi5History[9] < this.settings.overbought) {
    this.sell("Sell - Take Profit - Price > 200 SMA Up and RSI was > 70");
  }

  // Sell when:
  // current price is 10% lower than buy price
  if (advised && currentPrice < buyPrice * 0.99){
    this.sell("1% stop loss");
    stopLossed = true;
  }

}

strat.onTrade = function(trade) {
  if (trade.action == 'buy') {
    buyPrice = trade.price;
    advised = true;
    log.remote(config.watch.asset, '/', config.watch.currency, 'Buy', trade.price, 
    '\nStrategy:', this.name, '\n', message );
  }

  if (trade.action == 'sell') {
    buyPrice = 0;
    advised = false;
    if (trade.price < buyPrice) {
      losingTrades++;
    } else {
      winningTrades++;
    }
    var gainLoss = trade.price - buyPrice;
    var glPercent = ((trade.price / buyPrice) - 1) * 100;

    message = message +
    '\nBought at ' + buyPrice +
    '\nSold at ' + trade.price +
    '\nP/L: ' + gainLoss +
    '\nP/L %: ' + glPercent + 
    '\nWinning Trades ' + winningTrades + 
    '\nLosing Trades ' + losingTrades;

    log.remote(config.watch.asset, '/', config.watch.currency, 'Sell', trade.price, 
    '\nStrategy: ', this.name, '\n', message );
  }
}

// Sample of how a sell message looks like (sent from onTrade method)
//
// ETH/USD Sell $xx.yy
// Strategy: Big Trends
// Sell - Below 200 SMA and RSI > 70 but falling
// 200 SMA: $ww.zz, RSI History: 72.81, 70.22
// Bought at: $aa.bb
// Sold at: $cc.dd
// Gain/Loss: $ee.ff
// Winning Trades: x
// Losing Trades: y
strat.sell = function(reason) {
  if (reason == "Sell - Below 200 SMA and RSI > 70 but falling") {
    message = reason + '\n200 SMA: ' + sma5.result + ', RSI History: ' + rsi5History[8] + ', ' + rsi5History[9];  
  }
  if (reason == "Sell - Hit 200 SMA then fell") {
    message = reason + '\n200 SMA: ' + sma5.result;
  }
  if (reason == "Sell - Take Profit - Price > 200 SMA Up and RSI was > 70") {
    message = reason + '\n200 SMA Moved Up: ' + (sma5.result * 1.01) + ', RSI History: ' + rsi5History[8] + ', ' + rsi5History[9];  
  }
  if (reason == "1% stop loss") {
    message = reason + '\nStop Loss Price: ' + (buyPrice* 0.99);
  }
  if (reason == "Manual sell order from telegram") {
    message = reason;
  }
  this.advice('short');
  advised = false;
  wentAbove70 = false;
}


// Sample of how a buy message looks like (sent from onTrade method)
//
// ETH/USD Buy $xx.yy
// Strategy: Big Trends
// RSI Buy - Exited Oversold
// RSI History: 28.33, 33.11
strat.buy = function(reason) {
  if (reason == "RSI Buy - Exited Oversold") {
    message = reason + '\nRSI History: ' + rsi5History[8] + ', ' + rsi5History[9];
  } 
  if (reason == "DPO Buy - Above 0") {
    message = reason + '\nDPO: ' + dpo5.result.toFixed(2);
  }
  if (reason == "Manual buy order from telegram") {
    message = reason;
  }
  this.advice('long');
  advised = true; // Will confirm this using onTrade
  buyPrice = currentPrice; // Will update this to correct buy price using onTrade
}

strat.error = function() {
  log.info('Error function called in strategy.');
  process.exit(-1);
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
      "\nSMA: " + sma5.result.toFixed(2) +
      "\nSMA-Up: " + (sma5.result * 1.01).toFixed(2) +
      "\nDPO: " + dpo5.result.toFixed(2) +
      "\nRSI History: " + rsi5History[7].toFixed(2) + ", " + rsi5History[8].toFixed(2) + ", " + rsi5History[9].toFixed(2) +
      "\nPortfolio: ";
      
      // var i;
      // for (i = 0; i < config.currentIndicatorValues.portfolio.length; i++){
      //   cmd.response = cmd.response + "\n" + config.currentIndicatorValues.portfolio[i].name + ": " + config.currentIndicatorValues.portfolio[i].amount;
      // }
  }
  if (command == 'help') {
  cmd.handled = true;
      cmd.response = "Supported commands: \n\n /buy - Buy at next candle" + 
      "\n /sell - Sell at next candle " + 
      "\n /status - Show indicators and current portfolio" +
      "\n /error - Force Gekko to exit";
    }
  if (command == 'error'){
  cmd.handled = true;
  cmd.response = "Received command to stop Gekko.";
  log.remote('Stopping Gekko. If you are using PM2, Gekko will restart shortly.');
  setTimeout(this.error, 5000, 'Error');
  }
  if (command == 'buy') {
  cmd.handled = true;
  this.buy('Manual buy order from telegram');
  }
  if (command == 'sell') {
  cmd.handled = true;
  this.sell('Manual sell order from telegram');
  }
}


module.exports = strat;
