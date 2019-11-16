const cache = require('../state/cache');
const bundleManager = cache.get('bundles');

module.exports = async function (ctx, next) {
  const id = ctx.request.body.id;

  const state = bundleManager.delete(id);

  ctx.body = state;
}
