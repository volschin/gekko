const _ = require('lodash');

const cache = require('../state/cache');
const Logger = require('../state/logger');
const ConfigManager = require('../configManager');

const base = require('./baseConfig');

module.exports = async function (ctx, next) {
  let config = {};
  _.merge(config, ctx.request.body);

  delete config.watch.configCurrent // strange bug on UI (todo!!!!)
  const state = await ConfigManager.add({ config });

  ctx.body = state;
}
