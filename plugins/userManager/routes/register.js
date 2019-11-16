// var router = express.Router();
const models = require('../models');
const cache = require('../../../web/state/cache');
const manager = cache.get('apiKeyManager');
const _ = require('lodash');

module.exports = async function(ctx, next) {
  const body = ctx.request.body;
  let promise1 = new Promise((resolve, reject) => {
    models.User.findOne({
      where: { email: body.email },
      attributes: ['email']
    }).then(function(user) {
      if (!user) {
        models.User.create(body).then(function(user, created) {
          // req.flash('error', 'The user was registered successfully')
          ctx.login(user);
          // ctx.res.redirect('/login');
          ctx.body = { success: true };
          // ctx.body = { success: true, redirect: '/' };
          // resolve();
          next();
        }).catch(err => {
          console.error(err);
          ctx.body = { success: false };
          ctx.throw(500);
          // reject(err);
        });
      } else {
        // ctx.body = { success: false, reason: 'User exists!' };
        ctx.body = { success: false };
        ctx.throw(401, 'User exists!');
        // reject('User exists!');   *    this.assert(this.user, 401, 'Please login!');
        // return next();
      }
    }).catch(function(err) {
      console.log(err);
      // ctx.body = { success: false };
      // ctx.throw(500);
      // reject(500);
      reject(err);
      // resolve();
    });
  });
  await promise1;
}
