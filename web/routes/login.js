const cache = require('../state/cache');
const manager = cache.get('apiKeyManager');
const _ = require('lodash');
const passport = require('koa-passport');
const jwt = require('jsonwebtoken');

module.exports = async function (ctx, next) {
  const body = ctx.request.body;

  return passport.authenticate('local', { session: true }, (err, user, info, status) => {
    if (user) {

      const payload = {
        id: user.id,
        email: user.email,
        role: user.role || 'user'
      };
      const token = jwt.sign(payload, 'jwtsecret', {
        expiresIn: '2 days'
      });

      ctx.body = { success: true, token, user }; // todo!!
      ctx.login(user);

      return next();
    } else {
      ctx.body = { success: false };
      ctx.throw(401);
    }
  })(ctx);
}

