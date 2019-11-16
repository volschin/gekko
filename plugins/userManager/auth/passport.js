var LocalStrategy = require('passport-local').Strategy;
var models = require('../models');
const passport = require('koa-passport');

passport.use(new LocalStrategy({
  usernameField: 'email',
}, function(email, password, done) {
  models.User.findOne({
    where: { email: email }
  }).then(function(user) { // successful query to database
    if(!user) {
      return done(null, false, { message: 'Unknown email ' + email });
    }
    models.User.comparePasswordAsync(password, user.password).then( function(isMatch) {
      if(isMatch) {
        return done(null, user);
      } else {
        return done(null, false, { message: 'Invalid password' });
      }
    }).catch(err=>{
      return done(err);
    });
  })
  .catch(function(err) { // something went wrong with query to db
    done(err);
  });
}));

// serialize session, only store user id in the session information
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

// from the user id, figure out who the user is...
passport.deserializeUser(async function(userId, done){
  models.User.findOne({
    where: { id: userId }
  }).then(function(user){
    done(null, user);
  }).catch(function(err){
    done(err, null);
  });
});
