// Simple POST request that returns the batched backtest:
//
// Used for finding optimal params for stable monthly profit (e.g. 5+%/mo)
// Input: array of dates for batch of backtests with same strat/params
//   - or regular from-to dates input and period name ('month', 'day', '15 minutes' etc.)
// Output:
//   - backtests: array of results for dates
//   - performanceReport: total performance report data
//   - batchReport: total report data

// starts a backtest
// requires a post body like:
//
// {
//   gekkoConfig: {watch: {exchange: "poloniex", currency: "USDT", asset: "BTC"},…},…}   <-- see backtest.js
//   data: {
//     candleProps: ["close", "start"],
//     indicatorResults: true,
//     report: true,
//     roundtrips: true,

//    // batch-specific:
//    batchBacktest:
//      synchronous: true/false - should the batch be executed sync/async? (async: +25-50% performance, sync - better logs)
//      noBigData: turn off data like roundtrips, stratcandles etc. (commonly for being used as external API)
//      batchSize: '1 month/1 day/ 1 week' etc.
//   }
// }

const _ = require('lodash');
const promisify = require('tiny-promisify');
const pipelineRunner = promisify(require('../../core/workers/pipeline/parent'));
const moment = require('moment');

module.exports = async function (ctx, next) {
  var mode = 'backtest';

  var config = {};

  var base = require('./baseConfig');

  var req = ctx.request.body;

  _.merge(config, base, req);

  config.mode = mode;
  const dateSpans = getDateMonthSpansForYear(config)
  let dateSpanCur, resultCur;

  if (config.batch && config.batch.noBigData) {
    // Let's not include large data:
    config.backtestResultExporter.data.roundtrips = false;
    config.backtestResultExporter.data.stratCandles = false;
  }

  let backtests = [];
  const ts1 = Date.now();
  if (config.batch && !!config.batch.synchronous) {
    for(let i = 0; i < dateSpans.length; i++ ) {
      dateSpanCur = dateSpans[i];
      config.backtest.daterange = dateSpanCur;
      resultCur = await pipelineRunner(mode, config);
      backtests.push(resultCur);
    }
  } else {
    backtests = await Promise.all(dateSpans.map(dateSpan => {
      const configCur = JSON.parse(JSON.stringify(config));
      configCur.backtest.daterange = dateSpan;
      return pipelineRunner(mode, configCur);
    }));
  }

  const ret = {
    backtests,
    performanceReport: getTotalPerformanceReport(backtests),
    batchReport: getBatchBacktestReport(backtests),
    fakeReport: getFakeReport(backtests.map(b => b.tradingAdvisor.stats).filter(b => !!b))
  };

  const ts2 = Date.now();
  console.log(`batchBacktest route:: spans: ${ dateSpans.length }, mode: ${ config.mode }, exec time: ${ ts2 - ts1 }`);
  ctx.body = ret;
}

/**
 *
 * @param config
 * @returns [ { from: 'yyyy-mm-ddThh:mm:ssZ', to 'yyyy-mm-ddThh:mm:ssZ' } ] - array of date spans
 */
function getDateMonthSpansForYear(config = {}) {
  const batchSize = config.batchBacktest && config.batchBacktest.batchSize;
  let dateSpans;
  // const months = req.data.batchBacktest && req.data.batchBacktest. // todo
  const warmupMinutes = config.tradingAdvisor.historySize * config.tradingAdvisor.candleSize;
  if (!batchSize || batchSize === '1 month') {
    dateSpans = [
      // 2017yr
      /*{ from: '2017-08-18T00:00:00Z', to: '2017-09-21T00:00:00Z' },
      { from: '2017-09-10T00:00:00Z', to: '2017-10-21T00:00:00Z' },
      { from: '2017-10-10T00:00:00Z', to: '2017-11-21T00:00:00Z' },
      { from: '2017-11-10T00:00:00Z', to: '2017-12-21T00:00:00Z' },
      { from: '2017-12-10T00:00:00Z', to: '2018-01-21T00:00:00Z' },
      { from: '2018-01-10T00:00:00Z', to: '2018-02-21T00:00:00Z' },
      { from: '2018-02-10T00:00:00Z', to: '2018-03-21T00:00:00Z' },
      { from: '2018-03-10T00:00:00Z', to: '2018-04-21T00:00:00Z' },
      { from: '2018-04-10T00:00:00Z', to: '2018-05-21T00:00:00Z' },
      { from: '2018-05-10T00:00:00Z', to: '2018-06-21T00:00:00Z' },
      { from: '2018-06-10T00:00:00Z', to: '2018-07-21T00:00:00Z' },
      { from: '2018-07-10T00:00:00Z', to: '2018-08-21T00:00:00Z' },*/
      // 2018yr
      { from: moment('2017-12-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2018-01-21T00:00:00Z' },
      { from: moment('2018-01-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2018-02-21T00:00:00Z' },
      { from: moment('2018-02-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2018-03-21T00:00:00Z' },
      { from: moment('2018-03-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2018-04-21T00:00:00Z' },
      { from: moment('2018-04-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2018-05-21T00:00:00Z' },
      { from: moment('2018-05-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2018-06-21T00:00:00Z' },
      { from: moment('2018-06-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2018-07-21T00:00:00Z' },
      { from: moment('2018-07-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2018-08-21T00:00:00Z' },
      { from: moment('2018-08-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2018-09-21T00:00:00Z' },
      { from: moment('2018-09-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2018-10-21T00:00:00Z' },
      { from: moment('2018-10-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2018-11-21T00:00:00Z' },
      { from: moment('2018-11-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2018-12-21T00:00:00Z' },
      //2019 yr
      { from: moment('2018-12-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2019-01-21T00:00:00Z' },
      { from: moment('2019-01-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2019-02-21T00:00:00Z' },
      { from: moment('2019-02-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2019-03-21T00:00:00Z' },
      { from: moment('2019-03-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2019-04-21T00:00:00Z' },
      { from: moment('2019-04-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2019-05-21T00:00:00Z' },
      { from: moment('2019-05-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2019-06-21T00:00:00Z' },
      { from: moment('2019-06-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2019-07-21T00:00:00Z' },
      { from: moment('2019-07-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2019-08-21T00:00:00Z' },
      { from: moment('2019-08-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2019-09-21T00:00:00Z' },
      { from: moment('2019-09-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2019-10-21T00:00:00Z' },
      { from: moment('2019-10-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2019-11-21T00:00:00Z' },
      { from: moment('2019-11-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2019-12-21T00:00:00Z' },
      //2020 yr
      { from: moment('2019-12-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2020-01-21T00:00:00Z' },
      { from: moment('2020-01-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2020-02-21T00:00:00Z' },
      { from: moment('2020-02-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2020-03-21T00:00:00Z' },
      { from: moment('2020-03-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2020-04-21T00:00:00Z' },
      { from: moment('2020-04-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2020-05-21T00:00:00Z' },
      { from: moment('2020-05-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2020-06-21T00:00:00Z' },
      { from: moment('2020-06-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2020-07-21T00:00:00Z' },
      { from: moment('2020-07-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2020-08-21T00:00:00Z' },
      { from: moment('2020-08-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2020-09-21T00:00:00Z' },
      { from: moment('2020-09-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2020-10-21T00:00:00Z' },
      { from: moment('2020-10-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2020-11-21T00:00:00Z' },
      { from: moment('2020-11-21T00:00:00Z').subtract(warmupMinutes, 'minutes').toDate(), to: '2020-12-21T00:00:00Z' },
    ];
  } else if (batchSize === '') {}
  return dateSpans;
}

function getTotalPerformanceReport(backtests = []) {
  let ret;
  if(backtests.length > 0) {

    ret = backtests.reduce((res, cur) => {
      let pfRes = res.performanceReport || {};
      let pfCur = cur.performanceReport || {};

      return { performanceReport: {
          losses: pfRes.losses + pfCur.losses,
          profit: pfRes.profit + pfCur.profit,
          relativeProfit: pfRes.relativeProfit + pfCur.relativeProfit,
          trades: pfRes.trades + pfCur.trades,
          yearlyProfit: pfRes.yearlyProfit + pfCur.yearlyProfit,
        }}
    }).performanceReport;

    const last = backtests[backtests.length - 1].performanceReport;
    const first = backtests[0].performanceReport;
    ret = Object.assign(ret, {
      endPrice: last.endPrice,
      endTime: last.endTime,
      startBalance: first.startBalance,
      startPrice: first.startPrice,
      startTime: first.startTime,
      minProfit: Math.min.apply(null, backtests.map(backtest => backtest.performanceReport.profit)),
      maxProfit: Math.max.apply(null, backtests.map(backtest => backtest.performanceReport.profit)),
      periodsProfit: backtests.filter(backtest => backtest.performanceReport.profit >= 0).length,
      periodsLoss: backtests.filter(backtest => backtest.performanceReport.profit < 0).length,
      periodsTotal: backtests.length,
    });
  }
  return ret;
}
function getFakeReport(stats) {
  return {
    stats,
    trades: stats.reduce((acc, s) => {
      acc += s.profits;
      return acc;
    }, 0),
    total: stats.reduce((acc, s) => {
      acc += s.profitTot;
      return acc;
    }, 0)
  };
}

function getBatchBacktestReport(backtests) {
  let ret, profitsArr = backtests.map(backtest => backtest.performanceReport.profit) || [];
  if(backtests.length > 0) {
    ret = {
      minProfit: Math.min.apply(null, profitsArr),
      maxProfit: Math.max.apply(null, profitsArr),
    }
  }
  return ret;

}

