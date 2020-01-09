const db = require('./models');

module.exports = {
  ChangePassword: async function(userId, newPassword) {
    const UserTable = db.User;
    const user = await UserTable.findOne({
      where: {
        id: userId
      }
    });
    user.password = newPassword;
    const userUpdated = await UserTable.generatePasswordHash(user);
    const res = await UserTable.update({
      password: userUpdated.password
    }, {
      where: {
        id: userId
      },
      validate: false
    });
    return res;
  }
}
