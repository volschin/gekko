// Directional Movement Indicator;
// for use on gekko trading bot. Same license as gekko.
// Ported from ADX and DI inidicator by MasaNakamura on TradingView
// https://www.tradingview.com/script/VTPMMOrx-ADX-and-DI/ 
// by crypto49er


var Indicator = function (period)
{

    this.input='candle';

    this.lastcandle = false;
    this.requiredHistory = period;
    this.period = period;

    this.age = 0;
    this.result = false;
    this.periodWeight = (period-1)/period;
    this.dm_up = 0;
    this.dm_down = 0;
}


Indicator.prototype.update = function (candle) {

    // Calculate True Range, DM+, DM-
    if(this.lastcandle) {

        // a = greater of (high-low, abs(high-lastcandle.close))
        let a = candle.high - candle.low > Math.abs(candle.high-this.lastcandle.close) ? candle.high - candle.low :  Math.abs(candle.high-this.lastcandle.close);
        //TrueRange = max(max(high-low, abs(high-nz(close[1]))), abs(low-nz(close[1])))
        this.trueRange = a > Math.abs(candle.low-this.lastcandle.close) ? a : Math.abs(candle.low-this.lastcandle.close);

        //DirectionalMovementPlus = high-nz(high[1]) > nz(low[1])-low ? max(high-nz(high[1]), 0): 0
        let b = candle.high - this.lastcandle.high > 0 ? candle.high - this.lastcandle.high : 0;
        this.directionalMovementPlus = candle.high - this.lastcandle.high > this.lastcandle.low - candle.low ? b : 0;

        //DirectionalMovementMinus = nz(low[1])-low > high-nz(high[1]) ? max(nz(low[1])-low, 0): 0
        let c = this.lastcandle.low - candle.low > 0 ? this.lastcandle.low - candle.low : 0;
        this.directionalMovementMinus = this.lastcandle.low - candle.low > candle.high - this.lastcandle.high ? c : 0;

    }

    // Calculate Result

    // The '|| 0' at the end is to evaluate the value and if it is NaN, set value to 0
    this.smoothedTrueRange = this.lastSmoothedTrueRange - (this.lastSmoothedTrueRange/this.period) + this.trueRange || 0;
    this.smoothedDM_plus = this.lastSmoothedDM_plus - (this.lastSmoothedDM_plus/this.period) + this.directionalMovementPlus || 0;
    this.smoothedDM_minus = this.lastSmoothedDM_minus - (this.lastSmoothedDM_minus/this.period) + this.directionalMovementMinus || 0;

    this.di_plus = this.smoothedDM_plus/this.smoothedTrueRange * 100;
    this.di_minus = this.smoothedDM_minus/this.smoothedTrueRange * 100;

    this.result = Math.abs(this.di_plus - this.di_minus) / (this.di_plus + this.di_minus)*100;

    this.lastcandle = candle;
    this.lastSmoothedTrueRange = this.smoothedTrueRange;
    this.lastSmoothedDM_plus = this.smoothedDM_plus;
    this.lastSmoothedDM_minus = this.smoothedDM_minus;
    this.age++;
}


module.exports = Indicator;
