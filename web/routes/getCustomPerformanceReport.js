// simple POST request that returns the backtest result

const _ = require('lodash');
const promisify = require('tiny-promisify');
const pipelineRunner = promisify(require('../../core/workers/pipeline/parent'));

const cache = require('../state/cache');

const gekkosPersistent = cache.get('gekkosPersistent');


// starts a backtest
// requires a post body like:
//
// {
//   gekkoConfig: {watch: {exchange: "poloniex", currency: "USDT", asset: "BTC"},…},…}
//   data: {
//     candleProps: ["close", "start"],
//     indicatorResults: true,
//     report: true,
//     roundtrips: true
//   }
// }
module.exports = async function (ctx, next) {
  var config = {};

  var base = require('./baseConfig');

  var req = ctx.request.body;

  _.merge(config, base, req);

  let ret = await gekkosPersistent.getCustomPerformanceReport({ apiKeyName: config['apiKeyNameForBacktest'] });

  ctx.body = ret;
}
