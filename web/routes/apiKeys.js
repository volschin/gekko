const cache = require('../state/cache');
const manager = cache.get('apiKeyManager');

module.exports = {
  get: async function (ctx, next) {
    ctx.body = manager.get();
  },
  add: async function (ctx, next) {
    const content = ctx.request.body;

    manager.add(content.exchange, Object.assign({
      uniqueName: this.request.body.uniqueName
    }, content.values));

    ctx.body = {
      status: 'ok'
    };
  },
  remove: async function () {
    const exchange = ctx.request.body.exchange;

    manager.remove(exchange);

    ctx.body = {
      status: 'ok'
    };
  }
}
