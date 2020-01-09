const jwt = require('jsonwebtoken');
const cache = require('../../../web/state/cache');

module.exports = function(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role || 'guest'
  };
  const token = jwt.sign(payload, 'jwtsecret', {
    expiresIn: '2 days'
  });
  cache.set('user', user);
  return token;
};
