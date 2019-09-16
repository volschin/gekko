/*
 * Gekko Javascript Tom DeMark's Sequential indicator
 * Translated from https://www.tradingview.com/script/t08BkTIg-TD-Sequential/ by Ash
 *
 */
// [ INTRO FROM PINESCRIPT ]
// This indicator implements a flexible rendition of TD Sequentials
//   Reference: DeMark Indicators by Jason Perl
//
// TD Indicators:
//   - TD Price Flips (TD Setup count = 1)
//   - TD Setup count up (green #, above bar, green diamond if count > 'Setup: Bars')
//   - TD Setup count down (red #, above bar, red diamond if count > 'Setup: Bars')
//   - TD Sell Setup (red down arrow "setup", above bar)
//   - TD Sell Setup perfected (yellow diamond, above bar), can be deferred
//   - TD Buy Setup (green up arrow "setup", above bar)
//   - TD Buy Setup perfected (yellow diamond, above bar), can be deferred
//   - TD Setup Trend support (green dotted line)
//   - TD Setup Trend resistance (red dotted line)
//   - TD Countdown up (green circle, below bar)
//   - TD Countdown down (red circle, below bar)
//   - TD Sell Countdown qualify bar (blue circle "Q"),
//   - TD Sell Countdown deferred (green cross, below bar)
//   - TD Sell Countdown (red down arrow "countdown", below bar)
//   - TD Buy Countdown qualify bar (blue circle "Q"),
//   - TD Buy Countdown deferred (red cross, below bar)
//   - TD Buy Countdown (green up arrow "countdown", below bar)
//   - TD Countdown Recycling (white cross "R", below bar)
//        Note: Only one aspect of recycling is implemented where,
//           if Setup Up/Down Count == 2 * 'Setup: Bars', then the present Countdown is cancelled.
//           Trend momentum has intensified.
//   - TD Risk Level (blue step line)
//
// Alerts Conditions:
//   "Sell Setup" - Trigger an alert for Sell Setups
//   "Sell Setup Perfected" - Trigger an alert for Perfected Sell Setups
//   "Buy Setup" - Trigger an alert for Buy Setups
//   "Buy Setup Perfected" - Trigger an alert for Perfected Buy Setups
//   "Sell Countdown" - Trigger an alert for Sell Countdowns
//   "Buy Countdown" - Trigger an alert for Buy Countdowns
//   "Countdown Recycle Up" - Trigger an alert for the Countdown Recycle condition, where price is moving up
//   "Countdown Recycle Down" - Trigger an alert for the Countdown Recycle condition, where price is moving down
//
// "Parameters" and nomenclature:
//   - "Price: Source", defines which bar price to use for price comparisions
//             (close, hlc3, ohlc4, etc...). Traditionally, close.
//   - TD Setups
//        "Setup: Bars", the last Setup count (traditionally 9).
//             In this code, called the Buy/Sell Setup event, e.g. the last price up count
//                 becomes the Sell Setup event.
//        "Setup: Lookback bars", defines the previous bar to compare for counting (traditionally 4).
//        "Setup: Include Equal Price", If enabled, allow >= or <= in price comparisons.
//             Traditionally not used (default is disabled). Might be useful for intraday charts.
//        "Setup: Perfected Lookback", defines the previous count to evaluate for a perfected setup
//             (this count and the next). Traditionally 3, i.e compare count 6 and 7 to count 8 or count 9.
//             See code below for details.
//        "Setup: Show Count", show/hide setup numbers.
//             Note: Buy/Sell Setup events are not affected by this setting. They are always shown.
//   - TD Setup Trends (TDST)
//        "Setup Trend: Extend",
//             If disabled, only look back to the beginning of this Buy/Sell Setup event
//                 to find trends, low(support for Sell) or high(resistance for Buy)
//             If enabled, look back beyond this Buy/Sell Setup event to the previous
//                 Setup event of the same kind. (This capability has limitations... see code).
//        "Setup Trend: Show", show/hide trend lines
//   - TD Countdowns
//        "Countdown: Bars", the last Countdown count (traditionally 13).
//             Called the Buy/Sell Countdown event in this code, i.e. the last up/down
//                 count becomes the Buy/Sell Countdown event.
//        "Countdown: Lookback Bars", define previous bar to compare for counting (traditionally 2).
//        "Countdown: Qualifier Bar", the bar in the Countdown sequence used to qualifiy the price
//             of the Buy/Sell Countdown event (traditionally 8). If a countdown event doesn't
//             qualify, it is marked with a "+" symbol and counting continues.
//             Note: If the Qualifier Bar is set >= "Countdown: Lookback Bars",
//                 qualification is disabled. Countdown events are still determined, just not qualified.
//        "Countdown: Aggressive", Use aggressive comparison. E.g. for Sell Countdown,
//             instead of "Price: Source" >= high of "Countdown: Lookback Bars",
//             use high >= high of "Countdown: Lookback Bars". Disabled by default.
//        "Countdown: Show Count", show/hide countdown numbers. Countdown events are always shown.
//   - TD Risk Level
//        "Risk Level: Show", Show/hide TD Risk Level for setups, countdowns and recycled countdowns.
//
//   If you want more flexibility in the user interface for plotting, set PlotEditEnable = true
//
// Coding notes:
//   - Variable names are hierarchical, to play nicely in a flat namespace.
//        General layout of names: <Indicator><Function><Qualifier><...etc...>
//            Ex) cntdwmCountUp -> <TD Countdown><counting for indicator><counting price moves up>
//   - Variables that start with uppercase represent User input. Otherwise, lowercase. All variables
//        are camelCase.
//   - Plotting parameters are defined at the beginning of each indicator section to
//        faciliate quick/easy alterations. All plots are at the end of the script.
//   - To pull off the logic wizardy of TD Indicators in the Pine Script language,
//        many series are created. The two basic patters are
//            1) Impulse series (booleans), used to capture events at specific bars
//            2) Stair-step series (integers), used to count impulses across multiple bars

const nz = require('../tools/tradingView').nz;
const valuewhen = require('../tools/tradingView').valuewhen;

const SETUP_IS_PERFECTED = 2;
const SETUP_IS_DEFERRED = 1;

let Indicator = function(settings) {
  const that = this;

  // vars from Pine:

  // settings - user input:
  let PriceSource = 'close'; //input(title="Price: Source", type=source, defval=close)
  let SetupBars = 9; //input(title="Setup: Bars", type=integer, defval=9, minval=4, maxval=31)
  let SetupLookback = 4; //input(title="Setup: Lookback Bars", type=integer, defval=4, minval=1, maxval=14)
  let SetupEqualEnable = false; //input(title="Setup: Include Equal Price", type=bool, defval=false)
  let SetupPerfLookback = 3; //input(title="Setup: Perfected Lookback", type=integer, defval=3, minval=1, maxval=14)
  let SetupShowCount = true; //input(title="Setup: Show Count", type=bool, defval=true)
  let SetupTrendExtend = false; //input(title="Setup Trend: Extend", type=bool, defval=false)
  let SetupTrendShow = true; //input(title="Setup Trend: Show", type=bool, defval=true)
  let CntdwnBars = 13; //input(title="Countdown: Bars", type=integer, defval=13, minval=3, maxval=31)
  let CntdwnLookback = 2; //input(title="Countdown: Lookback Bars", type=integer, defval=2, minval=1, maxval=30)
  let CntdwnQualBar = 8; //input(title="Countdown: Qualifier Bar", type=integer, defval=8, minval=3, maxval=30)
  let CntdwnAggressive = false; //input(title="Countdown: Aggressive", type=bool, defval=false)
  let CntdwnShowCount = true; //input(title="Countdown: Show Count", type=bool, defval=true)
  let RiskLevelShow = false; //input(title="Risk Level: Show", type=bool, defval=false)
  let Transp = 0; //input(title="Transparency", type=integer, defval=0, minval=0, maxval=100)

  let high, low, close, open,
    setupCountUp, setupCountDown, setupPriceUp = false, setupPriceDown = false, setupPriceEqual = false,
    setupCountUpPrev, setupCountDownPrev,
    setupSell, setupBuy, setupSellCount = 0, setupBuyCount = 0,
    setupSellPerfPrice, setupSellPerfPricePrev,
    SetupUpPerfLookbackCandle, SetupUpPerfLookbackNextCandle, setupUpPerfMaskCandle,
    setupSellPerfMask, setupSellPerfMaskPrev,
    setupBuyPerfPrice, setupBuyPerfPricePrev,
    setupBuyPerfMask, setupBuyPerfMaskPrev,
    SetupDownPerfLookbackCandle, SetupDownPerfLookbackNextCandle, setupDownPerfMaskCandle
  ;
  const PlotEditEnable = false; // show/hide some of the plots from Format window in the user interface.


  this.update = function(candle) {
    high = candle.high;

    resetCounters();
    addToHistoryData(candle);

    if(candlesArr[SetupLookback]) {
      // 1. Create impulse series of price action. Compare where price is greater/less/equal than prior price.
      setupPriceUp = (candlesArr[0][PriceSource] > candlesArr[SetupLookback][PriceSource]);
      setupPriceDown = (candlesArr[0][PriceSource] < candlesArr[SetupLookback][PriceSource]);
      setupPriceEqual = (candlesArr[0][PriceSource] === candlesArr[SetupLookback][PriceSource]);


      // 2. Look for the establishment of momentum by counting consecutive up/down price moves.
      //   Up/down counters are mutually exclusive; only one is actively counting, while the other is in reset.
      // Equal price ticks are captured separately so that up/down ticks aren't active on the same bar. If equal price enabled,
      //     Then include equal price in the present up or down count
      //     Else ignore equal price and reset count when present
      setupCountUp = SetupEqualEnable
        ? (setupPriceUp || (setupCountUpPrev && setupPriceEqual)) ? nz(setupCountUpPrev) + 1 : 0
        : setupPriceUp ? nz(setupCountUpPrev) + 1 : 0;
      setupCountDown = SetupEqualEnable
        ? (setupPriceDown || (setupCountDownPrev && setupPriceEqual)) ? nz(setupCountDownPrev) + 1 : 0
        : setupPriceDown ? nz(setupCountDownPrev) + 1 : 0;
      // console.error(`INFO (${candle.start.toString()}) - setupCountUp: ${ setupCountUp }, setupCountDown: ${ setupCountDown }, `);

      // 3. // Error check: make sure Setup Up and Down counts don't count on the same bar
      // // setupCountErrorCheck = setupCountUp and setupCountDown
      // // plotshape(setupCountErrorCheck, text="Setup Count Error", style=shape.flag, color=yellow, location=location.abovebar, size=size.normal) // debug
      if(setupCountUp !== 0 && setupCountDown !== 0){
        consoleError(`ERROR (${candle.start.toString()})! Setup Up and Down counts should not count on the same bar `);
      }

      // 4. A Setup event is when up/down count == SetupBars
      // // Sell Setups are defined by up counts, Buy Setups by down counts.
      setupSell = setupCountUp === SetupBars ? candlesArr[ 0 ][ PriceSource ] : null;
      setupBuy = setupCountDown === SetupBars ? candlesArr[ 0 ][ PriceSource ] : null;

      // 5. Count bars between setups... used by other indicators
      // setupSellCount = barssince(setupSell)
      // setupBuyCount = barssince(setupBuy)
      if(setupSell) {
        setupSellCount = 0;
        that.isSetupSell = true;
        consoleError(`SELL (${candle.start.toString()}) - setupSell: ${ setupSell }`);
      } else {
        setupSellCount++;
      }
      if(setupBuy) {
        setupBuyCount = 0;
        that.isSetupBuy = true;
        consoleError(`BUY (${candle.start.toString()}) - setupBuy: ${ setupBuy }`);
      } else {
        setupBuyCount++;
      }
      // consoleError(`INFO (${candle.start.toString()}) - setupSellCount: ${ setupSellCount }, setupBuyCount: ${ setupBuyCount }, `);

      // 6. Perfected Setups
      //   For each sell/buy setup, an additional evaluation is performed to determine if it is "perfected".
      //   This consists of looking back a few bars and determining if the setup event's price is
      //   higher(sell)/lower(buy) than the lookback bars price. If not, a retest of the lookback
      //   bars high/low price is likely.
      // SetupPerfLookback (user input) defines which bars to use for perfection evaluation.
      //   Two bars are included in the evaluation: SetupPerfLookback AND SetupPerfLookback+1
      // The evalution adheres to DeMark's original definiton where the bar before the setup event
      //   also qualifies a perfected setup, even if the setup event bar doesn't qualify.
      // Example) Traditional settings: SetupBars=9, SetupPerfLookback=3,
      //   then a sell setup is perfected when
      //       ( (high(8) >= high(6)) and (high(8) >= high(7)) ) or   // start evaluation
      //       ( (high(9) >= high(6)) and (high(9) >= high(7)) ) or
      //       ...
      //       ( (high(9+n) >= high(6)) and (high(9+n) >= high(7)) )  // continued eval
      //   where n counts past the setup event, on setupCountUp bars. The evalution
      //   continues until the logic evaluates true, or cancelled.
      // Cancelation rules for perfection evaluation aren't clear...(?) So here's a liberal approach:
      //   - If a Setup event in the same direction appears, re-start
      //   - If a Setup event in the opposite direction appears, cancel

      // To evaluate perfected setups, create additional series:
      //   - A perfect price series, used for comparision to the setup event price or beyond
      //   - A mask series which holds the decision logic of "perfected" or "deffered"
      //     After the mask is created, it overlays setup count series to plot visual indicators.
      // For convenience, define const integer variables to translate the meaning of perfected/deffered
      // (see global const above)

      // 7. Perfected Sell Setup events
      // Get the price for which Sell Setup perfection is evaluated. Stair-step series.
      // setupSellPerfPrice = na
      // setupSellPerfPrice := setupCountUp==SetupBars ?
      //   ((valuewhen(setupCountUp==(SetupBars-SetupPerfLookback), high, 0) >=
      //       valuewhen(setupCountUp==(SetupBars-SetupPerfLookback+1), high, 0)) ?
      //       valuewhen(setupCountUp==(SetupBars-SetupPerfLookback), high, 0 ) :
      //       valuewhen(setupCountUp==(SetupBars-SetupPerfLookback+1), high, 0 )
      //   ) : nz(setupSellPerfPrice[1])

      // SELL!!
      if(setupCountUp === (SetupBars - SetupPerfLookback)) {
        SetupUpPerfLookbackCandle = candle;
      } else if(setupCountUp === (SetupBars - SetupPerfLookback + 1)) {
        SetupUpPerfLookbackNextCandle = candle;
      }
      setupSellPerfPrice = setupCountUp === SetupBars
        ? SetupUpPerfLookbackCandle.high >= SetupUpPerfLookbackNextCandle.high ? SetupUpPerfLookbackCandle.high : SetupUpPerfLookbackNextCandle.high
        : nz(setupSellPerfPricePrev);
      // consoleError(`INFO (${candle.start.toString()}) - setupSellPerfPrice: ${ setupSellPerfPrice }, setupSellPerfPricePrev: ${ setupSellPerfPricePrev }, `);

      //plot(setupSellPerfPrice, color=yellow, linewidth=2)  // debug

      // 8. Create mask to hold "perfected" decisions. This is like a state-machine, where new inputs
      //   determine what to do next. The logic:
      // First, cancellation
      //   - If a perfected event found, cancel (done)
      //   - If a Buy Setup event occurs, cancel. This Sell Setup trend is over.
      // Second, start (or re-start) evaluation
      //   - If a new Setup Sell event is present, start. Compare SetupBars and (SetupBars-1) to perf price.
      //       If one of these bars passes, then set mask to perfected.
      //       Else, set mask to deferred and continue evaluaton.
      // Third, continue evaluation
      //   - If mask is deffered, check any bar (count up or down) for perfection, until cancelation.
      //   - If a perfected Sell Setup event NOT found, then seamlessly roll into the next Sell Setup event.
      if(setupCountUp === (SetupBars - 1)) {
        setupUpPerfMaskCandle = candle;
      }
      setupSellPerfMask = ((nz(setupSellPerfMaskPrev) >= SETUP_IS_PERFECTED ) || setupBuy)
        ? null
        : setupCountUp === SetupBars
          ? setupUpPerfMaskCandle.high >= setupSellPerfPrice || high >= setupSellPerfPrice
            ? SETUP_IS_PERFECTED
            : SETUP_IS_DEFERRED
          : !setupSellPerfMaskPrev
            ? null
            : high >= setupSellPerfPrice
              ? SETUP_IS_PERFECTED
              : setupSellPerfMaskPrev
      if(setupSellPerfMask === SETUP_IS_PERFECTED) {
        this.isPerfectSetupSell = true;
        consoleError(`PERFECT SELL (${candle.start.toString()}) - isPerfectSetupSell: ${ this.isPerfectSetupSell }`);
      }

      // BUY !!
      if(setupCountDown === (SetupBars - SetupPerfLookback)) {
        SetupDownPerfLookbackCandle = candle;
      } else if(setupCountDown === (SetupBars - SetupPerfLookback + 1)) {
        SetupDownPerfLookbackNextCandle = candle;
      }
      setupBuyPerfPrice = setupCountDown === SetupBars
        ? SetupDownPerfLookbackCandle.low <= SetupDownPerfLookbackNextCandle.low ? SetupDownPerfLookbackCandle.low : SetupDownPerfLookbackNextCandle.low
        : nz(setupBuyPerfPricePrev);

      if(setupCountDown === (SetupBars - 1)) {
        setupDownPerfMaskCandle = candle;
      }
      setupBuyPerfMask = ((nz(setupBuyPerfMaskPrev) >= SETUP_IS_PERFECTED ) || setupSell)
        ? null
        : setupCountDown === SetupBars
          ? setupDownPerfMaskCandle.low <= setupBuyPerfPrice || low <= setupBuyPerfPrice
            ? SETUP_IS_PERFECTED
            : SETUP_IS_DEFERRED
          : !setupBuyPerfMaskPrev
            ? null
            : low <= setupBuyPerfPrice
              ? SETUP_IS_PERFECTED
              : setupBuyPerfMaskPrev;

      if(setupBuyPerfMask === SETUP_IS_PERFECTED){
        this.isPerfectSetupBuy = true;
        consoleError(`PERFECT BUY (${candle.start.toString()}) - isPerfectSetupBuy: ${ this.isPerfectSetupBuy }`);
      }

      consoleError(`INFO (${candle.start.toString()}) - setupCountDown: ${ setupCountDown} , setupSellPerfMask: ${ setupSellPerfMask }, setupBuyPerfMask: ${ setupBuyPerfMask } `);


      updateCounters();
      // console.error(`INFO (${candle.start.toString()}) - setupCountUp: ${ setupCountUp }, setupCountDown: ${ setupCountDown }, `);
    }
  };
  // helper functions:
  const consoleError = function(text) {
    if(settings.debug === true){
      console.error(text);
    }
  }
  const setSettings = function(settings){
    settings = settings || {}
    PriceSource = settings['PriceSource'] || PriceSource;
    SetupLookback = settings['SetupLookback'] || SetupLookback;
  }
  const updateCounters = function() {
    setupCountUpPrev = setupCountUp;
    setupCountDownPrev = setupCountDown;
    setupSellPerfPricePrev = setupSellPerfPrice;
    setupSellPerfMaskPrev = setupSellPerfMask;
    setupBuyPerfPricePrev = setupBuyPerfPrice;
    setupBuyPerfMaskPrev = setupBuyPerfMask;
  };
  const resetCounters = function() {
    that.isSetupBuy = false;
    that.isSetupSell = false;
    that.isPerfectSetupBuy = false;
    that.isPerfectSetupSell = false;
  };
  const addToHistoryData = function(candle) {
    candlesArr.unshift(candle);
    // this.historyData.unshift(candle);
    if (candlesArr.length > historyMax) {
      candlesArr.pop();
    }
    //console.log('TDM_Seq: Added candle: ', JSON.stringify(candle));
  };

  // start constructor:
  let candlesArr = [];
  const historyMax = 144; //? verify

  setSettings(settings);
  candlesArr = [];
}
module.exports = Indicator;
