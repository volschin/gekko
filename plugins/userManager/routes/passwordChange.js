const _ = require('lodash');
const cache = require('../../../web/state/cache');

const ChangePassword = require('../userManager').ChangePassword;

module.exports = async function (ctx, next) {
  const userId = ctx.request.body.userId || cache.get('user').get('id')
    , newPassword = ctx.request.body.newPassword;
  if(!userId) {
    throw 'userId not defined';
  }
  if(!newPassword || newPassword.length < 8) {
    throw 'newPassword not defined or not long enough';
  }
  const state = await ChangePassword( userId, newPassword );

  ctx.body = state;
}
