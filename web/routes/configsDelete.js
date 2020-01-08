const _ = require('lodash');

const cache = require('../state/cache');
const Logger = require('../state/logger');
const ConfigManager = require('../configManager');

module.exports = async function (ctx, next) {
  let id = ctx.params.id;
  const userId = cache.get('user').get('id');
  if(!id || id === 'undefined') {
    throw 'config id not defined';
  }
  if(!userId) {
    throw 'userId not found'
  }
  const configs = await ConfigManager.delete({ id, userId });
  ctx.body = configs;

}
