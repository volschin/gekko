const _ = require('lodash');
const promisify = require('promisify-node');

const scan = promisify(require('../../core/workers/datasetScan/parent'));

// starts a scan
// requires a post body with configuration of:
// 
// - config.watch
const route = async function (ctx) {

  var config = require('./baseConfig');

  _.merge(config, ctx.request.body);

  let scanConfig = await scan(config);
  ctx.body = scanConfig;
};

module.exports = route;
