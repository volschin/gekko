const cache = require('../state/cache');
const manager = cache.get('apiKeyManager');
const _ = require('lodash');
const passport = require('koa-passport');

module.exports = async function (ctx, next) {
  const body = ctx.request.body;

  return passport.authenticate('local', { session: true }, (err, user, info, status) => {
    if (user) {
      ctx.body = { success: true, token: 'vasia slon' }; // todo!!
      ctx.login(user);
      return next();
    } else {
      ctx.body = { success: false };
      ctx.throw(401);
    }
  })(ctx);
}

