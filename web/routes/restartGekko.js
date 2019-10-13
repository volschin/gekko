const _ = require('lodash');

const cache = require('../state/cache');
const Logger = require('../state/logger');
const apiKeyManager= cache.get('apiKeyManager');
const gekkoManager = cache.get('gekkos');

const base = require('./baseConfig');

// starts an import
// requires a post body with a config object
module.exports = async function (ctx, next) {
  const id = ctx.request.body.id;

  const state = gekkoManager.restart({ id });

  ctx.body = state;
}
