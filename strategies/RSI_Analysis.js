// RSI Analysis
// This is not a strategy
// It is a backtesting tool that 
// simply calculates the following:

// How often it completes a oversold/overbought cycle
// The average oversold/overbought
// How long from oversold to overbought
// How many completions, how many failed cycles
// Lowest/Highest RSI


const fsw = require('fs');
const log = require('../core/log')
const config = require ('../core/util.js').getConfig()
const CandleBatcher = require('../core/candleBatcher')
const RSI = require('../strategies/indicators/RSI.js')

// Let's create our own strat
var strat = {}
var rsi5 = new RSI({ interval: config.RSI_Analysis.interval })
var overSold = config.RSI_Analysis.oversold;
var overBought = config.RSI_Analysis.overbought;
var rsi5History = []
var candle5 = {}
var counter5 = 0
var startCycle = false
var failedCycleCounter = 0
var completedCycleCounter = 0
var lowestRSI = 100
var highestRSI = 0 
var cycleDuration = 0;
var completedCycleDuration = []
var failedCycleDuration = []
var cycleInformation = {}


// Prepare everything our method needs
strat.init = function() {
  this.requiredHistory = config.tradingAdvisor.historySize
  this.filename = "RSI_Analyis_Log.csv"

  // since we're relying on batching 1 minute candles into 5 minute candles
  // lets throw if the settings are wrong
  if (config.tradingAdvisor.candleSize !== 1) {
    throw "This strategy must run with candleSize=1";
  }

  // create candle batchers for 5 minute candles
  this.batcher5 = new CandleBatcher(5)

  // supply callbacks for 5 minute candle function
  this.batcher5.on('candle', this.update5)


  // Define the indicator even thought we won't be using it because
  // Gekko will only use historical data if we define the indicator here
  this.addIndicator('rsi', 'RSI', { interval: this.settings.interval});

//   this.logSetup()
  this.headertxt = "Cycle Type, Start Time, Start Price, RSI, End Time, End Price, RSI, Duration\n"
	
  fsw.writeFile(this.filename, this.headertxt, 'utf8', (err) => {
	if(err) {
	   log.error('Unable to write header text to log')
   }
   })
}

// What happens on every new candle?
strat.update = function(candle) {
  currentPrice = candle.close;

  // write 1 minute candle to 5 and 10 minute batchers
  this.batcher5.write([candle]);
  this.batcher5.flush();

}

strat.update5 = function(candle) {
  rsi5.update(candle);

  candle5 = this.batcher5.calculatedCandles[0];

  // We only need to store RSI for 3 candles
  rsi5History.push(rsi5.result);
  if (rsi5History.length > 3) {
    rsi5History.shift();
  }
  //Send price and RSI to console every 5 minutes
  //log.info('Price', currentPrice, 'RSI', rsi5.result.toFixed(2));
}


strat.check5 = function() {

	// Start Cycle
	if (rsi5History[1] < overSold && rsi5History[2] > overSold) {
		log.debug(candle5.start.format('l LT'), 'Exited oversold', rsi5History[1].toFixed(2), rsi5History[2].toFixed(2))
		startCycle = true
		cycleInformation.startTime = candle5.start.format('l LT')
		cycleInformation.startPrice = candle5.close
		cycleInformation.startRSI = rsi5History[2].toFixed(2)
	}

	if (startCycle) cycleDuration++

	// Failed Cycle
	if (startCycle && rsi5History[2] < overSold) {
		log.debug(candle5.start.format('l LT'), 'Return to oversold', rsi5History[1].toFixed(2), rsi5History[2].toFixed(2))
		failedCycleCounter++
		startCycle = false
		failedCycleDuration.push(cycleDuration)
		cycleInformation.endTime = candle5.start.format('l LT')
		cycleInformation.endPrice = candle5.close
		cycleInformation.endRSI = rsi5History[2].toFixed(2)
		cycleInformation.duration = cycleDuration
		cycleInformation.cycleType = "Failed"
		this.writeToLog(cycleInformation)
		cycleInformation = {}
		cycleDuration = 0
	}

	// Completed Cycle
	if (rsi5History[1] > overBought && rsi5History[2] < overBought) {
		log.debug(candle5.start.format('l LT'), 'Exited overbought', rsi5History[1].toFixed(2), rsi5History[2].toFixed(2))
		if (startCycle) {
			completedCycleCounter++
			startCycle = false
			completedCycleDuration.push(cycleDuration)
			cycleInformation.endTime = candle5.start.format('l LT')
			cycleInformation.endPrice = candle5.close
			cycleInformation.endRSI = rsi5History[2].toFixed(2)
			cycleInformation.duration = cycleDuration
			cycleInformation.cycleType = "Completed"
			this.writeToLog(cycleInformation)
			cycleInformation = {}
			cycleDuration = 0
		}
	} 

	// Calculates the RSI high/low
	if (rsi5History[2] < lowestRSI) {
		lowestRSI = rsi5History[2]
	}

	if (rsi5History[2] > highestRSI) {
		highestRSI = rsi5History[2]
	}
}

strat.check = function() {

	counter5++;
	if (counter5 == 5){
		this.check5();
		counter5 = 0;
	}
}

strat.end = function() {

	var j = 0
	for (i = 0; i < completedCycleDuration.length; i++) {
		j += completedCycleDuration[i]
	}
	var avgcCycles = j / completedCycleDuration.length

	j = 0
	for (i = 0; i < failedCycleDuration.length; i++) {
		j += failedCycleDuration[i]
	}

	var avgfCycles = j / failedCycleDuration.length

	log.info('Completed Cycles', completedCycleCounter)
	log.info('Completed Cycles Average Duration', avgcCycles)
	log.info('Failed Cycles', failedCycleCounter)
	log.info('Failed Cycle Average Duration', avgfCycles)
	log.info('Highest RSI', highestRSI.toFixed(2))
	log.info('Lowest RSI', lowestRSI.toFixed(2))

}

strat.writeToLog = function(cycle) {
	this.outtxt = cycle.cycleType + ',' + cycle.startTime + ',' + cycle.startPrice + ',' + cycle.startRSI + ',' + cycle.endTime + ',' + cycle.endPrice + ',' + cycle.endRSI + ',' + cycle.duration +'\n'
	fsw.appendFile(this.filename, this.outtxt, 'utf8', (err) => {
		if(err) {
		  log.error('Unable to write to log');
		}
	  });
}



module.exports = strat;
