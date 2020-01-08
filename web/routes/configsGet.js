const _ = require('lodash');

const cache = require('../state/cache');
const Logger = require('../state/logger');
const ConfigManager = require('../configManager');

module.exports = async function (ctx, next) {
  let userId = cache.get('user').get('id'), configs
    , configId = ctx.params.id
    , amount = ctx.params.amount;
  if(!userId) {
    throw 'userId not defined'
  } else {
    configs = await ConfigManager.get({ configId, amount, userId });
    ctx.body = configs;
  }
}
