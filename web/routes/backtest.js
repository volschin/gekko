// simple POST request that returns the backtest result

const _ = require('lodash');
const promisify = require('tiny-promisify');
const pipelineRunner = promisify(require('../../core/workers/pipeline/parent'));

let dependenciesManager = require('../state/cache').get('dependencies');

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
  var mode = 'backtest';

  var config = {};

  var base = require('./baseConfig');

  var req = ctx.request.body;

  _.merge(config, base, req);
  config.mode = mode;
  /*if(!dependenciesManager){
    dependenciesManager = require('./cache').get('dependencies'); // circular reference problem
  }*/

  if(dependenciesManager && config.dependencies && config.dependencies.length > 0){
    await dependenciesManager.getDependencyResultsAsync(config);
  }
  const ts1 = Date.now();
  ctx.body = await pipelineRunner(mode, config);
  const ts2 = Date.now();
  console.log(`backtest route:: exec time: ${ ts2 - ts1 }`);
}
