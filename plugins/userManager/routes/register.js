// var router = express.Router();
const models = require('../models');
const cache = require('../../../web/state/cache');
const manager = cache.get('apiKeyManager');
const _ = require('lodash');
const loginUser = require('../auth/loginUser');

module.exports = async function(ctx, next) {
  const body = ctx.request.body;
  if(!_.isUndefined(body.username) && body.username === '') {
    delete body.username;
  }
  const user = await models.User.findOne({
    where: { email: body.email },
    attributes: ['email']
  });
  if (!user) {
    try {
      body.role = 'guest';
      const newUser = await models.User.create(body);
      const token = loginUser(newUser);

      ctx.body = { success: true, token, user: newUser }; // todo!!
      ctx.login(newUser);

      return next();
    } catch (err) {
      ctx.body = { success: false };
      ctx.throw(500, err.errors && err.errors[0] && err.errors[0].message? err.errors[0].message : err);
    }
  } else {
    ctx.body = { success: false };
    ctx.throw(401, 'User exists!');
  }
}
