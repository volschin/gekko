// Average Directional Movement Index indicator;
// usable on gekko trading bot. Same license as gekko.
// Ported from ADX and DI inidicator by MasaNakamura on TradingView
// https://www.tradingview.com/script/VTPMMOrx-ADX-and-DI/ 
// by crypto49er

var DX = require('./DX.js');
var SMA = require('./SMA.js');

var Indicator = function (period)
{
    this.input = 'candle';
    this.indicates = 'trend_strength';

    this.dx = new DX(period);
    this.sma = new SMA(period);

    this.result = 0;
    this.periodRatio = (period - 1)/period;
    this.initadx = 0;
    this.initialized = 1;
    this.period = period;
}

Indicator.prototype.update = function (candle)
{
    this.dx.update(candle);
    if(this.dx.result){
    this.sma.update(this.dx.result);
    }

    this.result = this.sma.result;

}

module.exports = Indicator;
