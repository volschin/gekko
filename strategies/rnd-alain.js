// https://forum.gekko.wizb.it/thread-57900.html
/*
---------------------
190405 Alain Philipin
----------------------

Strategy details:
------------------
This strategy will only place a buy order if a down trend followed by a up trend is detected.
On the order has been done it will monitor the price against the Stoploss and Take profit price.
If the stoploss price is reached the asset will be sold.
If the Take profit price is reached, it will NOT sell. Instead it will activate the trailing Take Profit.
Once the trailing take Profit price is reached, it will sell the asset.

Here below are more details:

PHASE 1 - monitoring of DOWN trend:
------------------------------------
- At startup, it checks the price movement. The goal is to detect a DOWN trend of a certain percentage. We will name it the "priceDownForActivation"
- If the price moves up, the "priceDownForActivation" is also adapted to make sure that even in a up trend we will be able to detect a down trend and then activate the buy monitoring mechanism.
- If the price moves down and reach the "priceDownForActivation", it will activate the mechanism monitor for an UP trend before to buy. The goal is to make sure that it will only buy if there is an UP trend.
We will use the name "priceTrailingBuy" to refer to the price at which one we are happy to buy.

PHASE 2 - monitoring of UP trend:
----------------------------------
- If the price continues to move down, the "priceTrailingBuy" is also moved down to make sure that we will buy at the best price.
- If the price moves up and reach the "priceTrailingBuy", a BUY order will be place.

PHASE 3 - monitoring of STOP LOSS and TAKE PROFIT:
--------------------------------------------------
- Once the asset has been bought, it monitors the Stop loss and take profit price against the last asset price.
- If the stop loss is reached, a SELL order will be placed and the strategy will stop.
- If price is moving UP and reach the Take Profit, the asset WILL NOT BE SOLD. What happens in this case is that it will activate the trailing Take Profit functionality.

PHASE 4 - monitoring of Trailing Take Profit:
----------------------------------------------
- Once the traling take profit is activated, it monitors the asset price to see if it has to trigger a sell order or not.
- If the price continues to move up, the trailing Take Profit is adapted to move up with the price and allow more profit.
- If the price moves down and goes below the trailing take profit price, a SELL order is placed and the strategy will stop.


-------------------------------------------------------------------------------------------------------------------------------------------------------------------
TODOS:
-------
 - IMPORTANT BEFORE USING LIVE: Make sure I can set "market" oder and make sure the onTrade function can detect error/cancellation of ongoing trades.
 - Get the profit analyzer working!!!
 - When the stock has been bought, if we detect a price movement (positive or negative) above 1% per minute we need to monitor the price every 10 seconds and push an event to for the SELL directly in case  of price decrease instead of waiting for the next minute.
- Introduce buy timeout to avoid to buy at high priuce during a fast/short move up which goes down directly.
- Introduce sell timeout to avoid to buy at high priuce during a fast/short move down which goes back up directly.
- IF the variation betweent he new price and the price of the previous candle is too big () we should ignore it (only once) and wait for one more minute to validate the cahnge (up or down).
The number of candles that we should wait for could be configurable.

So, far, the best setting for ALTcoins is the below one by using 1 MINUTE candles.



DONE:
------
- test case where a BUY order does not work.
- Make sure to have a down trend followed by a pu trend before buying. This to avoit to buy a high price in the top of peak.

-------------------------------------------------------------------------------------------------------------------------------------------------------------------

*/

const _ = require('lodash');
const util = require(__dirname + '/../core/util');
const dirs = util.dirs();
const log = require(dirs.core + 'log');

var method = {};

var i = 0;
var firstPrice = 0;
var temp = 0;

const Plugin = function() {};


//CONTANTS:
//------------
var PERCENTAGE_TRAILING_BUY = 1.02; //+2% by default
var PERCENTAGE_STOPLOSS = 0.9; //-10% by default
var PERCENTAGE_TAKE_PROFIT = 1.10; //+10% by default
var PERCENTAGE_TRAILING_TP = 0.95; //-5% If trailing TP is activated, the trailing TP will follow the max price -5%
var PERCENTAGE_PRICE_DOWN_BEFORE_MONITORING = 0.98; //The price has to go down for a certain percentage before we activa the trailing BUY (default -2%)


//State engine definition
var STATE_WAIT_FOR_DOWN_TREND = 0; //First of all, we wait that the price goes down for x percents (x=PERCENTAGE_PRICE_DOWN_BEFORE_MONITORING) before activating the trailing BUY.
var STATE_MONITOR_ENTRY_PRICE = 1;
var STATE_ENTER_BUY_POSITION = 2;
var STATE_MONITOR_POSITION = 3;
var STATE_MONITOR_TRAILING_TP = 4;
var STATE_SELL_AT_STOPLOSS = 5;
var STATE_SELL_AT_TAKEPROFIT = 6;

var STATE_RESET_ENVIRONMENT = 97;
var STATE_BOT_STOPPED = 98;
var STATE_SYSTEM_MALFUNCTION = 99;

/*
const Alain1 = function() {
  _.bindAll(this);

  this.currency = watchConfig.currency;
  this.asset = watchConfig.asset;
  this.performanceReport;
  this.roundtrips = [];
  this.stratUpdates = [];
  this.stratCandles = [];
  this.trades = [];

  this.logger = new Logger(watchConfig);

  this.exposure = 0;

  this.roundTrips = [];
  this.losses = [];


  this.portfolio = {};
  this.balance;

  this.start = {};
  this.openRoundTrip = false;
}
*/

//VARIABLES
//-----------
var priceLast = 0; //Price of the last candle (clode price)
var priceBefore = 0; //Price of the previews candle (clode price)
var priceDownForActivation = 0;
var priceTrailingBuy = 0;
var priceTrailingTakeProfit = 0;
var priceVariationPercentageSinceLastCandle = 0;
var priceHigherPoint = 0; //used to store the highest price since the strategy has started

var priceOrder = 0; //will be used to store the price at which one we bought
var priceSell = 0;
var priceSL = 0;
var priceTP = 0;

var totalProfitAndLoss = 0;
var numberOfWinners = 0;
var numberOfLoosers = 0;

const PerformanceAnalyzer = function() {
  _.bindAll(this);

  this.dates = {
    start: false,
    end: false
  }

  this.startPrice = 0;
  this.endPrice = 0;

  this.currency = watchConfig.currency;
  this.asset = watchConfig.asset;

  this.logger = new Logger(watchConfig);

  this.trades = 0;

  this.exposure = 0;

  this.roundTrips = [];
  this.losses = [];
  this.roundTrip = {
    id: 0,
    entry: false,
    exit: false
  }

  this.portfolio = {};
  this.balance;

  this.start = {};
  this.openRoundTrip = false;
}


var state = STATE_WAIT_FOR_DOWN_TREND;


// Prepare everything our strat needs
method.init = function() {

  console.log('Hello, I\'m alive! My name is \"Up and Down Strategy\". I hope I will make you happy :) ');
  log.debug('Hello, I\'m alive! My name is \"Up and Down Strategy\". I hope I will make you happy :) ');

  //Load settings from the config
  PERCENTAGE_PRICE_DOWN_BEFORE_MONITORING = this.settings.PERCENTAGE_PRICE_DOWN_BEFORE_MONITORING;
  PERCENTAGE_TRAILING_BUY = this.settings.PERCENTAGE_TRAILING_BUY;
  PERCENTAGE_STOPLOSS = this.settings.PERCENTAGE_STOPLOSS;
  PERCENTAGE_TAKE_PROFIT = this.settings.PERCENTAGE_TAKE_PROFIT;
  PERCENTAGE_TRAILING_TP = this.settings.PERCENTAGE_TRAILING_TP;

  log.debug('--------------------------------------------------------')
  log.debug('PERCENTAGE DOWN TREND (down trend to see before to monitor the possibility to buy) = ' + PERCENTAGE_PRICE_DOWN_BEFORE_MONITORING);
  log.debug('PERCENTAGE TRAILING BUY (Up trend to see after the down trend to trigger a BUY action) = ' + PERCENTAGE_TRAILING_BUY);
  log.debug('PERCENTAGE STOP LOSS (Stop loss placed when the BUY order has been fulfilled) = ' + PERCENTAGE_STOPLOSS);
  log.debug('PERCENTAGE TAKE PROFIT (Once reach we don\'t sell. Instead, we activate the trailing Take Profit) = ' + PERCENTAGE_TAKE_PROFIT);
  log.debug('PERCENTAGE TRAILING TAKE PROFIT (This trailing TP is activated as soon as the ) = ' + PERCENTAGE_TRAILING_TP);
  log.debug('--------------------------------------------------------')

  // define the indicators we need
  this.addIndicator('macd', 'MACD', this.settings);



}

// What happens on every new candle?
method.update = function(candle) {
  // your code!
  i++;
  //console.log('hello world strat.update');
  //console.log('i = ', i);
}

// For debugging purposes.
method.log = function() {
  // your code!
  //console.log('hello world strat.log');
}

// Based on the newly calculated
// information, check if we should
// update or not.
// candel data { start: moment("2019-03-29T14:15:00.000"),
//  open: 0.0006943,
//  high: 0.0007019,
//  low: 0.0006939,
//  close: 0.0007016,
//  vwp: 0.0006976619868998939,
//  volume: 11889.979999999998,
//  trades: 383 }
method.check = function(candle) {
  // your code!
  //console.log('hello world strat.check Here is the candel data', candle );
  // var day = candle.start.format('D')
  //
  //if (day % 2 == 0){
  //  this.advice('long');
  //}else{
  //  this.advice('short');
  //}

  if (firstPrice == 0 ){
    //reset some variables
    //--------------------
    priceLast = 0;
    priceBefore = 0;
    priceDownForActivation = 0;
    priceTrailingBuy = 0;
    priceTrailingTakeProfit = 0;
    priceVariationPercentageSinceLastCandle = 0;
    priceHigherPoint = 0;

    //First iteration
    //store the price startup of the strategy
    firstPrice = candle.close;
    priceLast = candle.close;
    //set the trailing buy price for the first time
    priceTrailingBuy = (firstPrice * PERCENTAGE_TRAILING_BUY).toFixed(8);
    priceDownForActivation = (firstPrice * PERCENTAGE_PRICE_DOWN_BEFORE_MONITORING).toFixed(8);

    //log ALL value
    log.debug('--------------------------------------------------------------------------------')
    log.debug('PERCENTAGE DOWN BEFORE TO START = ' + PERCENTAGE_PRICE_DOWN_BEFORE_MONITORING);
    log.debug('PERCENTAGE TRAILING BUY = ' + PERCENTAGE_TRAILING_BUY);
    log.debug('');
    log.debug('PERCENTAGE STOP LOSS = ' + PERCENTAGE_STOPLOSS);
    log.debug('');
    log.debug('PERCENTAGE TAKE PROFIT = ' + PERCENTAGE_TAKE_PROFIT);
    log.debug('PERCENTAGE TRAILING TAKE PROFIT = ' + PERCENTAGE_TRAILING_TP);
    log.debug('--------------------------------------------------------------------------------')

  }else{
    //Update variables based on the quotation
    priceBefore = priceLast;
    priceLast = candle.close;
  }



  console.log('');
  console.log('');
  console.log('');
  console.log('--------------------------------------------');

  switch (state){

    case STATE_WAIT_FOR_DOWN_TREND:
      //We monitor the price and make sure it goes down before we set the trailign BUY
      console.log('Price when the strategy started = ', firstPrice, '. Price of last candle = ', priceLast);
      console.log('Price deviation since strategy started = ', (((priceLast/firstPrice)-1)*100).toFixed(3), '%');
      log.debug('----------------------------------------------------');
      log.debug('PHASE 1/4 - MONITORING DOWN TREND');
      console.log('PHASE 1/4 - MONITORING DOWN TREND');
      if (priceLast > priceDownForActivation){
        log.debug ('The price did not go down enough yet. We wait...');
        log.debug ('Start price = ', firstPrice);
        log.debug ('Actual price = ', priceLast);
        //Check if we have to adapt the price for activation. We have to do it if the price moved up too much otherwise we might never reach the activation price.
        if ((priceLast * PERCENTAGE_PRICE_DOWN_BEFORE_MONITORING).toFixed(8) > priceDownForActivation){
          log.debug('We have to move up the Activation price.');
          log.debug ('OLD Activation price = ', priceDownForActivation);
          //adapt the activation price according to lastest price
          priceDownForActivation = (priceLast * PERCENTAGE_PRICE_DOWN_BEFORE_MONITORING).toFixed(8);
          log.debug('NEW ACTIVATION PRICE = ', priceDownForActivation);
        }else{
          log.debug ('Activation price = ', priceDownForActivation);
        }
        log.debug('----------------------------------------------------');
      }else{
        //Set the trailing BUY price and change state to start monitoring up trend to buy
        state = STATE_MONITOR_ENTRY_PRICE;
        priceTrailingBuy = (priceLast * PERCENTAGE_TRAILING_BUY).toFixed(8);
        log.debug('----------------------------------------------------');
        log.debug ('The price went down enough. We can monitor the up trend to buy.');
        log.debug ('Start price = ', firstPrice);
        log.debug ('Actual price = ', priceLast);
        log.debug ('Activation price = ', priceDownForActivation);
        log.debug('----------------------------------------------------');
        log.debug('*********************************************************');
        log.debug('Activate trailing buy, set it to', priceTrailingBuy);
        log.debug('*********************************************************');
        //update the priceDownForActivation with the price we have now as this will be used later to display the percentage of the up trend.
        priceDownForActivation = priceLast;
      }
      break;

    case STATE_MONITOR_ENTRY_PRICE:
      priceVariationPercentageSinceLastCandle = (((priceLast/priceBefore)-1)*100).toFixed(3);
      log.debug('----------------------------------------------------');
      log.debug('PHASE 2/4 - MONITORING UP TREND');
      console.log('PHASE 2/4 - MONITORING UP TREND');
      //During the monitoring phase we just look at the price, adjust the trailing buy if price is going down and wait for the right price to be reached to buy.
      if (priceLast > priceBefore){
        //Price increased
        log.debug('+++ Price has increased by ' , priceVariationPercentageSinceLastCandle, '% since the last candle.');
        //Check if it is time to buy
        log.debug('+++ Check if it is time to buy....');
        if (priceLast >= priceTrailingBuy){
          log.debug ('Trailing Buy price reached (', priceTrailingBuy , ') WE CAN BUY!');
          //already set the Stop loss and Take profit price to avoid issue later
          priceTrailingTakeProfit = (priceTrailingBuy * PERCENTAGE_TAKE_PROFIT).toFixed(8);
          state = STATE_ENTER_BUY_POSITION;
          this.advice('long'); //BUY!
        }else{
          log.debug ('Trailing Buy price (', priceTrailingBuy , ') not yet reached, actual price is ', priceLast ,'. Keep on waiting...')
        }
        log.debug('----------------------------------------------------');
      }else{
        //Price decreased
        log.debug('----------------------------------------------------');
        log.debug('--- Price has decreased by ', priceVariationPercentageSinceLastCandle, '% since the last candle');
        //decrease the trailing buy if required
        temp = (priceLast * PERCENTAGE_TRAILING_BUY).toFixed(8);
        //just update the trailing buy price if it is lower than before.
        if (temp < priceTrailingBuy){
          priceTrailingBuy = temp;
          log.debug('--- UPDATE THE BUY PRICE to ', priceTrailingBuy);
        }
        log.debug('----------------------------------------------------');

      }
      break;

    case STATE_ENTER_BUY_POSITION:
      log.debug('Wait for the Order to be completed....');
      break;

    case STATE_MONITOR_POSITION:
      log.debug('----------------------------------------------------');
      log.debug('PHASE 3/4 - MONITORING POSITION FOR SP OR TP');
      console.log('PHASE 3/4 - MONITORING POSITION FOR SP OR TP');
      log.debug('Monitor actual position...');

      log.debug('-----------------------------------------');
      log.debug('Last price = ' , priceLast);
      log.debug('price Order = ' , priceOrder);
      log.debug('price Stoploss = ' , priceSL );
      log.debug('price Take Profit Activation = ' , priceTP);
      log.debug('-----------------------------------------');

      //check if TP is reached
      //-----------------------
      if(priceLast >= priceTP){
        state = STATE_MONITOR_TRAILING_TP;
        //calculate trailing TP
        priceTrailingTakeProfit =  (priceLast * PERCENTAGE_TRAILING_TP).toFixed(8);
        log.debug('-----------------------------------------');
        log.debug('TP REACHED :)  ');
        log.debug('WE CAN ACTIVATE THE TRAILING TP');
        log.debug('TRAILING TP = ', priceTrailingTakeProfit);
        log.debug('-----------------------------------------');

      }

      //Check if TP has been reached
      //-----------------------------
      if(priceLast <= priceSL){
        //STOP LOSS REACHED. WE HAVE TO SEEL
        state = STATE_SELL_AT_STOPLOSS;
        log.debug("STOP LOSS REACHED. WE HAVE TO SELL!!!");
        this.check;
      }
      break;

    case STATE_MONITOR_TRAILING_TP:
      log.debug('----------------------------------------------------');
      log.debug('PHASE 4/4 - MONITORING TRAILING TP');
      console.log('PHASE 4/4 - MONITORING TRAILING TP');
      //Check if price has moved up. If yes, the trailing TP has to be adapted.
      if (priceLast > priceHigherPoint){
        log.debug('THE MAX PRICE HAS INCREASED, SO, WE INCREASE THE TRAILING TP');
        //calculate new trailing TP
        priceTrailingTakeProfit =  (priceLast * PERCENTAGE_TRAILING_TP).toFixed(8);
      }

      log.debug('-----------------------------------------');
      log.debug('Last price = ' , priceLast);
      log.debug('price Order = ' , priceOrder);
      log.debug('TRAILING TP = ', priceTrailingTakeProfit);
      log.debug('-----------------------------------------');

      //Check if we have to sell
      if(priceLast <= priceTrailingTakeProfit){
        log.debug('TRAILING TP REACHED, WE HAVE TO SELL!');
        state = STATE_SELL_AT_TAKEPROFIT;
        this.check;
      }
      break;

    case STATE_SELL_AT_TAKEPROFIT: //TP REACHED WE HAVE TO SELL.
      //SELL at Trailing TP
      this.advice('short');
      break;

    case STATE_SELL_AT_STOPLOSS: //STOP LOSS REACHED. WE HAVE TO SELL
      //SELL at stoploss
      this.advice('short');
      break;

    case STATE_BOT_STOPPED:
      //Check if the last trade was a winner or a looser. If it was a loser we stop the bot.
      //We only restart automatically if the last trade was a winner
      //  if (priceSell > priceOrder){
      log.debug('The last trade was a winner, so we continue trading.');
      state = STATE_RESET_ENVIRONMENT;
      /* }else{
         log.debug('The last trade was a loser, so we prefer to stop the bot for now.');
         this.end;
       }*/
      break;

    case STATE_RESET_ENVIRONMENT:

      totalProfitAndLoss =  totalProfitAndLoss + (((priceSell/priceOrder)-1) * 100);

      if (priceSell > priceOrder){
        numberOfWinners =  numberOfWinners + 1;
      }else{
        numberOfLoosers = numberOfLoosers + 1;
      }

      console.log("---------------------------------------------------");
      console.log("P&L since the bot started = " + totalProfitAndLoss.toFixed(3));
      console.log("Number of winning trades = " + numberOfWinners);
      console.log("Number of losing trades = " + numberOfLoosers);
      console.log("---------------------------------------------------");


      log.debug("---------------------------------------------------");
      log.debug("P&L since the bot started = " + totalProfitAndLoss.toFixed(3));
      log.debug("Number of winning trades = " + numberOfWinners);
      log.debug("Number of losing trades = " + numberOfLoosers);
      log.debug("---------------------------------------------------");

      //reset variables before looking for the next trade.
      priceLast = 0; //Price of the last candle (clode price)
      priceBefore = 0; //Price of the previews candle (clode price)
      priceDownForActivation = 0;
      priceTrailingBuy = 0;
      priceTrailingTakeProfit = 0;
      priceVariationPercentageSinceLastCandle = 0;
      priceHigherPoint = 0; //used to store the highest price since the strategy has started
      priceOrder = 0; //will be used to store the price at which one we bought
      priceSell = 0;
      priceSL = 0;
      priceTP = 0;

      //Look for a new trade
      state = STATE_WAIT_FOR_DOWN_TREND;

      break;

    case STATE_SYSTEM_MALFUNCTION:
      log.debug('SYSTEM MALFUNCTION --> STOP THIS BOT!!!');
      this.end;
      break;

    default:
      log.debug('UNKNOWN state --> ', state);
      this.end;
      break;
  }

  //Update the highest price if it has increased
  //!!!! IMPORTANT: DO NOT PUT THIS PIECE OF CODE IN THE BEGINNING OF THE STRATEGY OTHERWISE IT WILL BREAK THE WAY HOW TO TRAILING PROFIT IS AUTOMATICALLY INCREASED !!!!!!
  if (priceLast > priceHigherPoint){
    priceHigherPoint = priceLast; //save the new high price
  }

  console.log("---------------------------------------------------");
  console.log("P&L since the bot started = " + totalProfitAndLoss.toFixed(3));
  console.log("Number of winning trades = " + numberOfWinners);
  console.log("Number of losing trades = " + numberOfLoosers);
  console.log("---------------------------------------------------");


  //---------------
  // LOGGING ONLY
  //---------------
  switch(state){
    case STATE_MONITOR_ENTRY_PRICE:
      console.log('--------------------------------------------');
      console.log('date = ' , candle.start);
      console.log('Price when the strategy started = ', firstPrice, '. Price of last candle = ', priceLast);
      console.log('Price deviation since strategy started = ', (((priceLast/firstPrice)-1)*100).toFixed(3), '%');
      console.log('--------------------------------------------');
      console.log('Preview Price = ', priceBefore);
      console.log('Last Price (close candle)= ', priceLast);
      console.log('Price deviation since last candle = ', priceVariationPercentageSinceLastCandle, '%');
      console.log('--------------------------------------------');
      console.log('Traling Buy Price = ', priceTrailingBuy);
      console.log('Trailing Take profit Price = ', priceTrailingTakeProfit);
      console.log('--------------------------------------------');
      break;
  }

}

// Optional for executing code
// after completion of a backtest.
// This block will not execute in
// live use as a live gekko is
// never ending.
method.end = function() {
  console.log('Bye! I hope I made you happy.');
  console.log('If this is not the case, don\'t forget that I\'m doing what I have been told to do.');
  console.log('So, feel free the enhance me ;)');
  log.debug('Bye! I hope I made you happy.');
  log.debug('If this is not the case, don\'t forget that I\'m doing what I have been told to do.');
  log.debug('So, feel free the enhance me ;)');
}


module.exports = method;

/*
method.prototype.processTradeCompleted = function(trade) {
  switch(state){

    case STATE_ENTER_BUY_POSITION:
            log.debug('****************************');
            log.debug('!!!!!BUY ORDER PLACED !!!!!!!');
            log.debug('****************************');
            log.debug('trabe object = ', trade);
            priceOrder = trade.effectivePrice;
            priceSL = (priceOrder * PERCENTAGE_STOPLOSS).toFixed(8);
            priceTP = (priceOrder * PERCENTAGE_TAKE_PROFIT).toFixed(8);
            log.debug('price Order = ' , priceOrder);
            log.debug('price Stoploss = ' , priceSL );
            log.debug('price Take Profit Activation = ' , priceTP);

            state = STATE_MONITOR_POSITION;

        break;

        case STATE_SELL_AT_TAKEPROFIT:
          log.debug(':) :) :) :) :) :) :) :) :) :) :) :) :) :) :) :) ');
          log.debug('!!!!!SELL ORDER PLACED AT TAKE PROFIT!!!!!!!');
          log.debug(':) :) :) :) :) :) :) :) :) :) :) :) :) :) :) :) ');
          log.debug('trabe object = ', trade);
          priceSell = trade.effectivePrice;
          log.debug('price Order = ' , priceOrder);
          log.debug('price Sell = ' , priceSell );

          state = STATE_BOT_STOPPED;

        break;

        case STATE_SELL_AT_STOPLOSS:
            log.debug(':( :( :( :( :( :( :( :( :( :( :( :( :( :( :(');
            log.debug('!!!!!SELL ORDER PLACED AT STOP LOSS!!!!!!!');
            log.debug(':( :( :( :( :( :( :( :( :( :( :( :( :( :( :(');
            log.debug('trabe object = ', trade);
            priceSell = trade.effectivePrice;
            log.debug('price Order = ' , priceOrder);
            log.debug('price Sell = ' , priceSell );

            state = STATE_BOT_STOPPED;

        break;
  }

}
*/



//method.prototype.processTradeCompleted = function(trade) {
Plugin.prototype.processTradeCompleted = function(trade) {
  switch(state){

    case STATE_ENTER_BUY_POSITION:
      log.debug('****************************');
      log.debug('!!!!!BUY ORDER PLACED !!!!!!!');
      log.debug('****************************');
      log.debug('trabe object = ', trade);
      priceOrder = trade.effectivePrice;
      priceSL = (priceOrder * PERCENTAGE_STOPLOSS).toFixed(8);
      priceTP = (priceOrder * PERCENTAGE_TAKE_PROFIT).toFixed(8);
      log.debug('price Order = ' , priceOrder);
      log.debug('price Stoploss = ' , priceSL );
      log.debug('price Take Profit Activation = ' , priceTP);

      state = STATE_MONITOR_POSITION;

      break;

    case STATE_SELL_AT_TAKEPROFIT:
      log.debug(':) :) :) :) :) :) :) :) :) :) :) :) :) :) :) :) ');
      log.debug('!!!!!SELL ORDER PLACED AT TAKE PROFIT!!!!!!!');
      log.debug(':) :) :) :) :) :) :) :) :) :) :) :) :) :) :) :) ');
      log.debug('trabe object = ', trade);
      priceSell = trade.effectivePrice;
      log.debug('price Order = ' , priceOrder);
      log.debug('price Sell = ' , priceSell );

      state = STATE_BOT_STOPPED;

      break;

    case STATE_SELL_AT_STOPLOSS:
      log.debug(':( :( :( :( :( :( :( :( :( :( :( :( :( :( :(');
      log.debug('!!!!!SELL ORDER PLACED AT STOP LOSS!!!!!!!');
      log.debug(':( :( :( :( :( :( :( :( :( :( :( :( :( :( :(');
      log.debug('trabe object = ', trade);
      priceSell = trade.effectivePrice;
      log.debug('price Order = ' , priceOrder);
      log.debug('price Sell = ' , priceSell );

      state = STATE_BOT_STOPPED;

      break;
  }
}


module.exports = Plugin;

/*
REGISTER TO GET FEEDBACK REGARDING EXECUTION OF ORDERS
*/
/*
method.onTrade = function(trade) {

  console.log('onTradfe event received during state ', state);

  switch(state){

    case STATE_ENTER_BUY_POSITION:
            log.debug('****************************');
            log.debug('!!!!!BUY ORDER PLACED !!!!!!!');
            log.debug('****************************');
            log.debug('trabe object = ', trade);
            priceOrder = trade.effectivePrice;
            priceSL = (priceOrder * PERCENTAGE_STOPLOSS).toFixed(8);
            priceTP = (priceOrder * PERCENTAGE_TAKE_PROFIT).toFixed(8);
            log.debug('price Order = ' , priceOrder);
            log.debug('price Stoploss = ' , priceSL );
            log.debug('price Take Profit Activation = ' , priceTP);

            state = STATE_MONITOR_POSITION;

        break;

        case STATE_SELL_AT_TAKEPROFIT:
          log.debug(':) :) :) :) :) :) :) :) :) :) :) :) :) :) :) :) ');
          log.debug('!!!!!SELL ORDER PLACED AT TAKE PROFIT!!!!!!!');
          log.debug(':) :) :) :) :) :) :) :) :) :) :) :) :) :) :) :) ');
          log.debug('trabe object = ', trade);
          priceSell = trade.effectivePrice;
          log.debug('price Order = ' , priceOrder);
          log.debug('price Sell = ' , priceSell );

          state = STATE_BOT_STOPPED;

        break;

        case STATE_SELL_AT_STOPLOSS:
            log.debug(':( :( :( :( :( :( :( :( :( :( :( :( :( :( :(');
            log.debug('!!!!!SELL ORDER PLACED AT STOP LOSS!!!!!!!');
            log.debug(':( :( :( :( :( :( :( :( :( :( :( :( :( :( :(');
            log.debug('trabe object = ', trade);
            priceSell = trade.effectivePrice;
            log.debug('price Order = ' , priceOrder);
            log.debug('price Sell = ' , priceSell );

            state = STATE_BOT_STOPPED;

        break;
  }

}*/









/*
//performanceAnalyzer.prototype.processTradeCanceled = function(trade) {
  EventCatcher.prototype.processTradeCanceled = function(trade) {

    switch(state){

      case STATE_ENTER_BUY_POSITION:
          log.debug('*************************************************');
          log.debug('!!!!!!!TRADE CANCELLED WHILE TRYING TO BUY!!!!!!!');
          log.debug('*************************************************');
          log.debug('trabe object = ', trade);
        break;

        case STATE_SELL_AT_TAKEPROFIT:
          log.debug(':( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :(');
          log.debug('!!!!!!!TRADE CANCELLED WHILE TRYING TO SELL AT TAKE PROFIT!!!!!!!');
          log.debug('**************************************************************');
          log.debug(':( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :(');
        break;

        case STATE_SELL_AT_STOPLOSS:
          log.debug(':( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :(');
          log.debug('!!!!!!!TRADE CANCELLED WHILE TRYING TO SELL AT STOPLOSS!!!!!!!');
          log.debug(':( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :(');
          log.debug('trabe object = ', trade);
        break;
    }

  state = STATE_SYSTEM_MALFUNCTION;
}

//performanceAnalyzer.prototype.processTradeErrored = function(trade) {
  EventCatcher.prototype.processTradeErrored = function(trade) {
  switch(state){

    case STATE_ENTER_BUY_POSITION:
        log.debug('*************************************************');
        log.debug('!!!!!!!TRADE ERRORED WHILE TRYING TO BUY!!!!!!!');
        log.debug('*************************************************');
        log.debug('trabe object = ', trade);
      break;

      case STATE_SELL_AT_TAKEPROFIT:
        log.debug(':( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :(');
        log.debug('!!!!!!!TRADE ERRORED WHILE TRYING TO SELL AT TAKE PROFIT!!!!!!!');
        log.debug(':( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :(');
        log.debug('trabe object = ', trade);
      break;

      case STATE_SELL_AT_STOPLOSS:
        log.debug(':( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :(');
        log.debug('!!!!!!!TRADE ERRORED WHILE TRYING TO SELL AT STOPLOSS!!!!!!!');
        log.debug(':( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :(');
        log.debug('trabe object = ', trade);
      break;
  }


  state = STATE_SYSTEM_MALFUNCTION;
}

//performanceAnalyzer.prototype.processTradeAborted = function(trade) {
  EventCatcher.prototype.processTradeAborted = function(trade) {

  switch(state){

    case STATE_ENTER_BUY_POSITION:
        log.debug('*************************************************');
        log.debug('!!!!!!!TRADE ABORTED WHILE TRYING TO BUY!!!!!!!');
        log.debug('*************************************************');
        log.debug('trabe object = ', trade);
      break;

      case STATE_SELL_AT_TAKEPROFIT:
        log.debug(':( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :(');
        log.debug('!!!!!!!TRADE ABORTED WHILE TRYING TO SELL AT TAKE PROFIT!!!!!!!');
        log.debug(':( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :(');
        log.debug('trabe object = ', trade);
      break;

      case STATE_SELL_AT_STOPLOSS:
        log.debug(':( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :(');
        log.debug('!!!!!!!TRADE ABORTED WHILE TRYING TO SELL AT STOPLOSS!!!!!!!');
        log.debug(':( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :( :(');
        log.debug('trabe object = ', trade);
      break;
  }


  state = STATE_SYSTEM_MALFUNCTION;
}
*/


