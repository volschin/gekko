// Smart Strategy Template
// This template allows your strategy to do the following:
// - Know the starting asset/currency for the trade pair in your portfolio
// - Know when Gekko sends a trade out so it won't send another until that trade is completed
// - Know when a trade completes or errors out
// - Know the balance limit set for trading and recover that information after a crash
// This only works with this modded version of Gekko
// https://github.com/crypto49er/moddedgekko

const fs = require('fs');
const log = require('../core/log.js');

var strat = {};
var asset = 0;
var disableTrading = false;
var lastTraded; 
var currency = 0;
var counter = 0;
var fiatLimit = 100;
var assetLimit = 0.02857 // $100 USD if Bitcoin is $3500

// Prepare everything our strat needs
strat.init = function() {
  // your code!
  this.tradeInitiated = false;
  this.name = 'SmartStrategy-Template';

  var customSTOCHRSISettings = {
    optInTimePeriod: 14,
    optInFastK_Period: 3,
    optInFastD_Period: 4,
    optInFastD_MAType: 14,
  };
  var customRSISettings = { interval: 14 };
  var customMFISettings = { optInTimePeriod: 12 };

  this.addTalibIndicator('myMFI', 'mfi', customMFISettings);
  this.addTalibIndicator('myStochRSI', 'stochrsi', customSTOCHRSISettings);
  this.addIndicator('myRSI', 'RSI', customRSISettings);

  fs.readFile(this.name + '-balanceTracker.json', (err, contents) => {
    var fileObj = {};
    if (err) {
      log.warn('No file with the name', this.name + '-balanceTracker.json', 'found. Creating new tracker file');
      fileObj = {
        assetLimit: assetLimit,
        fiatLimit: fiatLimit,
      };
      fs.appendFile(this.name + '-balanceTracker.json', JSON.stringify(fileObj), (err) => {
        if(err) {
          log.error('Unable to create balance tracker file');
        }
      });
    } else {
      try {
        fileObj = JSON.parse(contents)
        assetLimit = fileObj.assetLimit;
        fiatLimit = fileObj.fiatLimit;
      }
      catch (err) {
        log.error('Tracker file empty or corrupted');
      }
    }
  });

  log.info('Buy Limit', fiatLimit, 'Sell Limit', assetLimit);


}

// What happens on every new candle?
strat.update = function(candle) {
  // your code!

    // Send message that bot is still working after 24 hours (assuming minute candles)
    counter++;
    if (counter == 1440){
      log.remote(this.name, ' - Bot is still working. \n Last Trade:', lastTraded);
      counter = 0;
    }

log.info('Price:', candle.close);
log.info(this.settings);

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

 //If there are no active trades, send signal
  // if (!this.tradeInitiated && !disableTrading && candle.close > 3500 && candle.close < 3600) { // Add logic to use other indicators

  //   // New method with trailing stoploss
  //   this.advice({ direction: 'long',
  //     trigger: {
  //       type: 'trailingStop',
  //       trailPercentage: 1
  //     },
  //     amount: currency > fiatLimit ? fiatLimit : currency,
  //   });

  // }

  var rsi = this.indicators.myRSI.result;
  var mfi = this.talibIndicators.myMFI.result.outReal;
  var stochRSI = this.talibIndicators.myStochRSI.result;

  log.info('RSI', rsi, 'MFI', mfi, 'StochRSI', stochRSI);


  // Buy when 
  // RSI < 30
  // MFI < 20
  // K < 20
  // D < 20
  if (rsi < 30 && mfi < 20 && stochRSI.outFastK < 20 && stochRSI.outFastD < 20) {
    this.advice('long');
  }

  // Sell when
  // RSI > 70
  // MFI > 80
  // K > 80
  // D > 80
  if (rsi > 70 && mfi > 80 && stochRSI.outFastK > 80 && stochRSI.outFastD > 80) {
    this.advice('short');
  }




  // if (!this.tradeInitiated && candle. close > 3600 ) {
  //   this.advice({
  //     direction: 'short',
  //     amount: asset > assetLimit ? assetLimit : asset,
  //   });
  // }

  
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
    assetLimit = fiatLimit / trade.price;
  }

  if (trade.action == 'sell') {
    fiatLimit = trade.amount * trade.price;
  }
  var fileObj = {
    assetLimit: assetLimit,
    fiatLimit: fiatLimit,
  }
  fs.writeFile(this.name + '-balanceTracker.json', JSON.stringify(fileObj), (err) => {
    if(err) {
      log.error('Unable to write to balance tracker file');
    }
  });

  lastTraded = trade.date.format('l LT');
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
  if (asset == 0 && currency == 0 && portfolio.asset > 0) {
    log.info('Starting with a sell as Gekko probably crashed after a buy')
    //this.advice('short');
  }

  asset = portfolio.asset;
  currency = portfolio.currency;

}

// This reports the portfolio value as the price of the asset
// fluctuates. Reports every minute when you are hodling.
// This is how the portfolioValue object looks like:
// {
//   balance: [currency + (asset * current price)]
//   hodling: [true if hodling more than 10% of asset, else false]
//   
// }
strat.onPortfolioValueChange = function(portfolioValue) {

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
    this.advice({ direction: 'long',
      trigger: {
        type: 'trailingStop',
        trailPercentage: 1
      },
      amount: currency > fiatLimit ? fiatLimit : currency,
    });
  
  }
  if (command == 'sell') {
    cmd.handled = true;
    this.advice({
      direction: 'short',
      amount: asset > assetLimit ? assetLimit : asset,
    });
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