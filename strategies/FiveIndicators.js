// Five Indicators
// 
// This strategy uses the 

var log = require('../core/log');
var config = require ('../core/util.js').getConfig();

const CandleBatcher = require('../core/candleBatcher');
const RSI = require('../strategies/indicators/RSI.js');
const ADX = require('../strategies/indicators/ADX.js')
const BB = require('../strategies/indicators/BB.js');
const MACD = require('../strategies/indicators/MACD.js');

// Let's create our own strat
var strat = {};
var buyPrice = 0.0;
var currentPrice = 0.0;

var bbParams = {
  interval: 14,
  thresholds: {
    low: 40,
    high: 40,
    persistence: 9
  },
  bbands: {
    TimePeriod: 20,
    NbDevUp: 2,
    NbDevDn: 2
  }
}

var macdParams = {
  long: 26,
  short: 12,
  signal: 9,
};

var rsi5 = new RSI({ interval: 14 });
var adx5 = new ADX(14);
var bb5 = new BB(bbParams);
var macd5 = new MACD(macdParams);
var advised = false;
var counter = 0;
var rsi5History = [];
var adx5History = [];
var macd5History = [];
var macd5SignalHistory = [];
var macd5HistogramHistory = [];
var previousCandlePrice = 0.0;


// Prepare everything our method needs
strat.init = function() {
  this.name = "Five Indicators";
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

  // Send message 
  counter++;
  if (counter == 1440){
    log.remote(this.name, ' - Bot is still working.');
    counter = 0;
  }
}

strat.update5 = function(candle) {
  rsi5.update(candle);
  adx5.update(candle);
  bb5.update(candle.close);
  macd5.update(candle.close);

  // We only need to store RSI for 10 candles
  rsi5History.push(rsi5.result);
  if (rsi5History.length > 10) {
    rsi5History.shift();
  }

  adx5History.push(adx5);
  if (adx5History.length > 10) {
    adx5History.shift();
  }

  macd5History.push(macd5.diff);
  if (macd5History.length > 10) {
    macd5History.shift();
  }

  macd5SignalHistory.push(macd5.signal.result);
  if (macd5SignalHistory.length > 10) {
    macd5SignalHistory.shift();
  }

  macd5HistogramHistory.push(macd5.result);
  if (macd5HistogramHistory.length > 10) {
    macd5HistogramHistory.shift();
  }

  //Send price and RSI to console every 5 minutes
  log.info('Price ', currentPrice, 'RSI ', rsi5.result.toFixed(2), 'ADX ', adx5.result.toFixed(2), '+DI ', adx5.dx.di_plus.toFixed(2), '-DI ', adx5.dx.di_minus.toFixed(2), 
  '\nBB Upper ', bb5.upper.toFixed(2), 'BB Middle ', bb5.middle.toFixed(2), 'BB Lower ', bb5.lower.toFixed(2), 'MACD ', macd5.diff.toFixed(2), 'Signal ', macd5.signal.result.toFixed(2), 'Histogram ', macd5.result.toFixed(2));
}

// Based on the newly calculated
// information, check if we should
// update or not.
strat.check = function(candle) {

  // ADX

  //Buy: When pADX < 25 and ADX[5] < 25 and ADX > 25 and +DI > -DI and RSI > 50
  if (!advised && adx5History[8].result < 25 && adx5History[5].result < 25 && adx5.result > 25 && adx5.dx.di_plus > adx5.dx.di_minus && rsi5.result > 50) {
    this.buy('ADX Buy');
    // Create a variable ADXBuy and set it to true here so only ADX buys can be sold by ADX sells
    // Add a way to divide portfolio into 20% each so each strat only have 20% to play with
    // Modify trader.js so it records 5 different blotter for each indicator
  }

  //Sell: When ADX > 25 and current price > buy price by 2% (profit)
  if (advised && adx5.result > 25 && currentPrice > buyPrice * 1.02){
    this.sell('ADX Sell - 2% Profit');
  }

  //Sell: When ADX falling last 3 and -DI > +DI (stop loss)
  if (advised && adx5History[7].result > adx5History[8].result && adx5History[7].result > adx5History[9].result && adx5History[8].result > adx5History[9].result && adx5.dx.di_minus > adx5.dx.di_plus ) {
    this.sell('ADX Sell - ADX falling last 3');
  }

  //Sell: When ADX < 25 and pADX > 25 and ADX[5] > 25 (stop loss)
  if (advised && adx5.result < 25 && adx5History[8].result > 25 && adx5History[5].result > 25 ) {
    this.sell('ADX Sell - ADX < 25');
  }

  // BB

  //Buy: When ( ((Upper / Lower) - 1) * 100 less than 1% or previous candle less than 1% ) and RSI > 65
  if (!advised && (((bb5.upper / bb5.lower) - 1) * 100 < candle.close * 0.01 || ((bb5.upper / bb5.lower) - 1) * 100 < previousCandlePrice * 0.01) && rsi5.result > 65) {
    this.buy('BB Buy - bands tightening');
  }

  //Sell: When price > upper band and price > buy price by 2% (profit)
  if (advised && currentPrice > bb5.upper && currentPrice > buyPrice * 1.02) {
    this.sell('BB Sell - 2% profit');
  }

  // MACD

  //Buy: When MACD and Signal > 0 and MACD crosses above Signal
  if (!advised && macd5.diff > 0 && macd5.signal.result > 0 && macd5History[8] < 0 && macd5.diff > macd5.signal.result && macd5History[8] < macd5SignalHistory[8]) {
    this.buy('MACD Buy - MACD > 0 and MACD cross above signal');
  }

  //Sell: When Histogram of previous candle > Histogram
  if (advised && macd5HistogramHistory[8] > macd5.result && macd5HistogramHistory[7] > 0) {
    this.sell('MACD Sell - Histogram falling after going above 0');
  }

  // DI

  //Buy: When +DI > -DI and 10 candles ago, -DI > +DI and  ADX < 15 
  if (!advised && adx5.dx.di_plus > adx5.dx.di_minus && adx5History[0].dx.di_minus > adx5History[0].dx.di_plus && adx5.result < 15){
    this.buy('DI Buy - Trend Change from bear to bull');
  } 

  //Sell: When +DI forms a 2nd high (profit)
  if (advised && adx5History[0].dx.di_plus > adx5History[5].dx.di_plus && adx5History[9].dx.di_plus > adx5History[0].dx.di_plus) {
    this.sell('DI Sell - +DI forms new high');
  }

  // RSI

  //Buy: When pRSI < 21 and RSI.round = pRSI (found floor)
  if (!advised && rsi5History[8] < 21 && Math.round(rsi5.result) == Math.round(rsi5History[8]) ) {
    this.buy('RSI Buy - Less than 21 & found floor');
  }

  //Buy: When pRSI < 21 and RSI > 21
  if (!advised && rsi5History[8] < 21 && rsi5.result > 21) {
    this.buy('RSI Buy - Bounced off 21');
  }

  //Sell: when pRSI > RSI and pRSI > 70 (profit)
  if (advised && rsi5History[8] > rsi5.result && rsi5History[8] > 70) {
    this.sell('RSI Sell - Above 70 but falling');
  }

  //Sell: when RSI high > 60 and 10 bars later 
  if (advised && rsi5History[0] > 60 && rsi5History[0] < 70 && rsi5.result > 60 && rsi5.result < 70) {
    this.sell('RSI Sell - Stalled between 60 - 70 for 10 bars');
  }

  // All

  //Sell: 1% stop loss 
  if (advised && currentPrice < buyPrice * 0.99) {
    this.sell('Sell - 1% Stop Loss');
  }

}


strat.sell = function(reason) {
  var message = config.watch.currency + "/" + config.watch.asset + " " + reason +
  "\nPrice: " + currentPrice;
  log.remote(message);
  this.advice('short');
  advised = false;
  buyPrice = 0;
  sellAtProfit = false;
}

strat.buy = function(reason) {
  var message = config.watch.currency + "/" + config.watch.asset + " " + reason +
  "\nPrice: " + currentPrice;
  log.remote(message);
  this.advice('long');
  advised = true;
  buyPrice = currentPrice;
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
  setTimeout(this.error, 5000, 'Error');
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
