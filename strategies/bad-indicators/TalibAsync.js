// ****************************************************************************
// *** TalibSync.js                                                         ***
// ****************************************************************************
// * Purpose: Use a Talib indicator inside a strategy like any other native
// * gekko indicator - in a synchronous way, by executing talib functionality
// * with await/promise.
// * This approach also exposes Talib functionality to multi timeframe
// * strategies, with custom candle size batching, where asyncIndicatorRunner 
// * is not available 
// ****************************************************************************


const util = require('../../core/util')
const dirs = util.dirs();
const gekkotalib = require(dirs.core + 'talib');
const talib = require("talib");
const log = require(dirs.core + 'log');


var Indicator = function(config) {
    this.config = config;
    this.talibInput = [];
    this.candleProps = {
        open: [],
        high: [],
        low: [],
        close: [],
        volume: [],
        vwp: []
    };

    if (config.indicator === undefined)
        throw Error('TalibSync: You must specify an indicator, e.g. sma or macd');
    else
        this.indName = config.indicator;


    this.indLength = config.length;
    this.age = 0;
    //log.debug('*** Usage info for Talib ' + talib.version + ' indicator', this.indName, ':\n', talib.explain(this.indName.toUpperCase()));
}


Indicator.prototype.addCandle = function (candle) {
    this.age++;  
    this.candleProps.open.push(candle.open);
    this.candleProps.high.push(candle.high);
    this.candleProps.low.push(candle.low);
    this.candleProps.close.push(candle.close);
    this.candleProps.volume.push(candle.volume);
    this.candleProps.vwp.push(candle.vwp);

    if(this.age > this.indLength) {
        this.candleProps.open.shift();
        this.candleProps.high.shift();
        this.candleProps.low.shift();
        this.candleProps.close.shift();
        this.candleProps.volume.shift();
        this.candleProps.vwp.shift();
    }
}


Indicator.prototype.update = function (candle) {
    this.addCandle(candle) ;  

    return new Promise((resolve, reject) => {       
        talibrunner = gekkotalib[this.indName].create(this.config.options);
        talibrunner(this.candleProps, function(err, talibResults) {
            if (err) {
                reject(err);
            }
            else {
                var result = false;
                if (talibResults['outReal'] !== undefined && talibResults['outReal'].length > 0) {
                   result = talibResults['outReal'][talibResults['outReal'].length-1];
                }
                else {
                    result = talibResults;
                }
                resolve(result);
            }
        });
    });
}


module.exports = Indicator;