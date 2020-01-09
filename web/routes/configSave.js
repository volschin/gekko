const _ = require('lodash');

const cache = require('../state/cache');
const Logger = require('../state/logger');
const ConfigManager = require('../configManager');

const base = require('./baseConfig');

module.exports = async function (ctx, next) {
  let config = {};
  _.merge(config, ctx.request.body);
  let userId = cache.get('user').get('id');
  if(!userId) {
    throw 'userId not defined';
  }
  delete config.watch.configCurrent // strange bug on UI (todo!!!!)
  const state = await ConfigManager.add({ config }, userId);

  ctx.body = state;
}
