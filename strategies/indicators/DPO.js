//DPO indicator by Gab0 - 04/jan/2019;

// period for EMA

var SMA = require('./SMA');

var Indicator = function(period) {
    this.input = 'price';

    this.result = NaN;
    this.age = 0;

    this.sma = new SMA(period);

    this.delay = (period / 2) +1;

    this.pricehist = [];
};

Indicator.prototype.update = function(price) {

    this.pricehist.push(price);
    this.sma.update(price);

    if (this.pricehist.length >= this.delay)
    {
        var oldprice = this.pricehist.shift();

        //this.sma.update(oldprice);
        this.result = oldprice - this.sma.result;
    }


};

module.exports = Indicator;
