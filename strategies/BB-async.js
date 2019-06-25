const _ = require('lodash');
const util = require('util');
const log = require('../core/log.js');
const config = require ('../core/util.js').getConfig();
const candleBatcher = require('../core/candleBatcher');
const TULIPASYNC = require('../strategies/indicators/TulipAsync.js');
const TALIBASYNC = require('../strategies/indicators/TalibAsync.js');

var stratBB = {};


stratBB.init = async function () {
    this.name = 'BB-async';
    this.exposed = false;
    this.cb30 = new candleBatcher(30);
    this.cb30.on('candle', this.onCandle30M);
    
    this.trend = {
        direction: 'none',
        duration: 0,
        adviced: false
    };

    this.requiredHistory = this.tradingAdvisor.historySize;

    this.bb = new TULIPASYNC({ indicator: 'bbands', length: 20, candleinput: 'close', options:[ 20, 2 ] });
    this.bb.count = 0;

    this.bbtalib = new TALIBASYNC({ indicator: 'bbands', length: 20, options: { optInTimePeriod: 20, optInNbDevUp: 2, optInNbDevDn: 2, optInMAType: 0 } });
    this.bbtalib.count = 0;

    //ok, do some lazy stuff here to demonstrate time taking init functions
    return new Promise((resolve, reject) => {
        setTimeout(function() {
           console.log('ok, strat.init execution took a while, but everything is ready now, let the strat start ...');
           resolve();
        }, 2000);
    });
}


stratBB.onTrade = function (trade) {
     //catch all trades.  Whether from manual buy/sell (telegram bot), a stoploss trigger or from a strategy advice
    if (trade.action == 'buy') {
        this.exposed = true;
    }

    if (trade.action == 'sell') {
        this.exposed = false;
    }
}


stratBB.onCandle30M = async function (candle) {
    this.bb.result = await this.bb.update(candle);
    this.bb.count++;

    this.bbtalib.result = await this.bbtalib.update(candle);
    this.bbtalib.count++;

    if (this.bb.count >= this.requiredHistory) {
        this.bbtalib.lowerBand = this.bbtalib.result['outRealLowerBand'][this.bbtalib.result['outRealLowerBand'].length-1];
        this.bbtalib.middleBand = this.bbtalib.result['outRealMiddleBand'][this.bbtalib.result['outRealMiddleBand'].length-1];
        this.bbtalib.upperBand = this.bbtalib.result['outRealUpperBand'][this.bbtalib.result['outRealUpperBand'].length-1];
        this.bbtalib.bbwidth = ((this.bbtalib.upperBand - this.bbtalib.lowerBand) / candle.close) * 100;

        this.exec(candle);
    }
}


stratBB.onCandle = async function (candle) {
    this.cb30.write([candle]);
    this.cb30.flush();
}


stratBB.exec = function(candle) {
    console.log(
        candle.start.format(),
        '::BBtulip lower ' + this.bb.result[0],
        '::BBtulip middle ' + this.bb.result[1],
        '::BBtulip upper ' + this.bb.result[2],
    );
    console.log(
        candle.start.format(),
        '::BBtalib lower ' + this.bbtalib.lowerBand,
        '::BBtalib middle ' + this.bbtalib.middleBand,
        '::BBtalib upper ' + this.bbtalib.upperBand,
        '::BBwidth', this.bbtalib.bbwidth, '%',
        '\n\n'
    );
}


stratBB.update = function (candle) {
    //no need for strat update, we work with onCandle custom batching
}


stratBB.log = function () {
}


stratBB.check = function (candle) {
   //no need for strat check, we work with onCandle custom batching and strat execution
}


module.exports = stratBB;
