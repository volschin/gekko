const _ = require('lodash');

const cache = require('../state/cache');
const Logger = require('../state/logger');
const apiKeyManager= cache.get('apiKeyManager');
const bundleManager = cache.get('bundles');

const base = require('./baseConfig');

// starts an import
// requires a post body with a config object
module.exports = async function (ctx, next) {

  let config = {};

  _.merge(config, base, ctx.request.body);
  const bundle = {
    active: true,
    stopped: false,
    uuid: config.bundleUuid,

    options: config.options,
    watch: config.watch,

    config: config // keep backwards compatibility, see Db.prototype.addConfig
  }
  const state = bundleManager.add({ bundle });

  ctx.body = state;
}
