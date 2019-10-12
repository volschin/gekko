/*
 * Tom DeMark's Sequential indicator
 *
 * Returns an object with properties:
 *
 * numberOfCountdowns: Number of countdowns so far (integer)
 * countdownType: current countdown type (buy/sell)
 * perfectSetup: countdown has a perfect setup? (boolean)
 *
 */

let Indicator = function() {
  this.historyData = [];
  this.historyMax = 20;
  this.state = 'none';
  this.perfectSetup = false;
  this.result = {numberOfCountdowns: 0, countdownType: null, perfectSetup: false};
  this.bearishPriceFlip = false;
  this.bullishPriceFlip = false;
  console.log('TDM_Seq: indicator initialised');
};

Indicator.prototype.update = function(candle) {
  this.bearishPriceFlip = false;
  this.bullishPriceFlip = false;

  this.addToHistoryData(candle);
  if (this.historyData.length > 5) {
    this.updateCounters();
  }
};

Indicator.prototype.addToHistoryData = function(candle) {
  this.historyData.unshift(candle);
  if (this.historyData.length > this.historyMax) {
    this.historyData.pop();
  }
  //console.log('TDM_Seq: Added candle: ', JSON.stringify(candle));
};

Indicator.prototype.updateCounters = function() {
  //First detect price flips
  //Bearish Price Flip - occurs when the market records a close greater than the close four bars earlier, immediately followed by a close less than the close four bars earlier.
  if(
    (this.historyData[1].close > this.historyData[5].close) &&
    (this.historyData[0].close < this.historyData[4].close)
  ) {
    // console.log("TDM_Seq Indicator: Bearish price flip detected at " + JSON.stringify(this.historyData[0]));
    this.bearishPriceFlip = true;
  }

  //Bullish Price Flip - occurs when the market records a close less than the close four bars before, immediately followed by a close greater than the close four bars earlier.
  if(
    (this.historyData[1].close < this.historyData[5].close) &&
    (this.historyData[0].close > this.historyData[4].close)
  ) {
    // console.log("TDM_Seq Indicator: Bullish price flip detected at " + JSON.stringify(this.historyData[0]));
    this.bullishPriceFlip = true;
  }

};

Indicator.prototype.resetCounters = function() {
  this.state = 'none';
  this.perfectSetup = false;
  this.bearishPriceFlip = false;
  this.bullishPriceFlip = false;
};

module.exports = Indicator;
