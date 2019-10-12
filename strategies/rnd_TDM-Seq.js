// Let's create our own strategy
let strategy = {};

/*
if (currentcandlenumber > previouscandlenumber && currentprice > highestpriceoflastcandel) {
  set a limit buy order at current price
  if (buyorder is set) {
    set a stoploss at the lowestprice of previous candle
    if (currenturrentcandelnumber != greencount || currenturrentcandelnumber == green9) {
      set a limit sell order at current price
    }
  }
}
if (currentcandlenumber < previouscandlenumber && currentprice < lowestpriceoflastcandel) {
  set a limit short order at current price
  if (buyorder is set) {
    set a stoploss at the highestprice of previous candle
    if (currenturrentcandelnumber != redcount || currenturrentcandelnumber == red9) {
      set a limit buy order at current price
    }
  }
}

*/

// Prepare everything our strat needs
strategy.init = function() {
  // your code!
  let parameters = {};
  this.addIndicator('tdm_seq', 'TDM_Seq', parameters);
};

// What happens on every new candle?
strategy.update = function(candle) {
  // your code!
  this.indicators.tdm_seq.update(candle);
};

// For debugging purposes.
strategy.log = function() {
  // your code!
};

// Based on the newly calculated
// information, check if we should
// update or not.
strategy.check = function(candle) {
  // your code!
  let tdmSeq = this.indicators.tdm_seq.result;
  //console.log(tdmSeq);
};

// Optional for executing code
// after completion of a backtest.
// This block will not execute in
// live use as a live gekko is
// never ending.
strategy.end = function() {
  // your code!
};

module.exports = strategy;
