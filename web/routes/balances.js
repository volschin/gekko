const cache = require('../state/cache');
const manager = cache.get('apiKeyManager');
const balanceManager = require('../balanceManager');
const isUserManagerPluginEnabled = require('./baseConfig').userManager && require('./baseConfig').userManager.enabled === true;

module.exports = {
  get: async function (ctx, next) {
    let userEmail;
    const apiKeyName = ctx.params.apiKeyName;

    if(isUserManagerPluginEnabled) {
      userEmail = ctx.state.user.get('email');
    }
    if(isUserManagerPluginEnabled && !userEmail) {
      ctx.body = {
        success: false,
        status: 'error'
      }
    } else {
      try {
        const balances = await balanceManager.getBalances(userEmail, apiKeyName);
        ctx.body = {
          status: 'ok',
          result: balances
        }
      } catch(err) {
        ctx.body = {
          status: 'error',
          success: false,
          error: err,
          result: err
        }
      }
    }
  },
}
