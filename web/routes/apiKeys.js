const cache = require('../state/cache');
const manager = cache.get('apiKeyManager');
const isUserManagerPluginEnabled = require('./baseConfig').userManager && require('./baseConfig').userManager.enabled === true;

module.exports = {
  get: async function (ctx, next) {
    let userEmail;

    if(isUserManagerPluginEnabled) {
      userEmail = ctx.state.user.get('email');
    }
    if(isUserManagerPluginEnabled && !userEmail) {
      ctx.body = {
        success: false,
        status: 'error'
      }
    } else {
      ctx.body = manager.get(userEmail);
    }
  },
  add: async function (ctx, next) {
    const content = ctx.request.body;

    const userEmail = ctx.state.user && ctx.state.user.get('email');
    if(isUserManagerPluginEnabled? !!userEmail : true){
      const props = Object.assign({
        uniqueName: content.uniqueName,
        userEmail
      }, content.values);
      manager.add(content.exchange, props);

      ctx.body = {
        status: 'ok'
      };
    } else {
      ctx.body = {
        success: false,
        status: 'error'
      };
    }

  },
  remove: async function (ctx) {
    const exchange = ctx.request.body.exchange;
    const userEmail = ctx.state.user && ctx.state.user.get('email');
    manager.remove(exchange, userEmail);

    ctx.body = {
      status: 'ok'
    };
  }
}
