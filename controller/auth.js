var passport = require('passport');
var HTTPHeaderTokenStrategy = require('passport-http-header-token').Strategy;
var User = require('../models/user');
var uuid = require('node-uuid');

passport.use(new HTTPHeaderTokenStrategy({
},
  function (token, done) {
    console.log("validate token: " + token);
    User.findByToken(token, function (success, authorization) {
      // find token
      if (success == true) {
        console.log("token: " + token);
        console.log("username: " + authorization["username"]);
        console.log("expired: " + authorization["expired_time"]);
        return done(null, true);
      } else {
        return done(null, false, { message: "Authentication Failed" });
      }
    });
  }
));

exports.grant = async function (req, res) {
  // generate uuid as token when username and password corrects
  res.setHeader("Access-Control-Allow-Origin", "*");
  // console.log(req.body.username, req.body.password);
  var username = req.body.username;
  var password = req.body.password;
  var coiname = req.body.coi_name;
  let [success, user] = await User.verifyPassword(username, password, coiname)
  res.setHeader("Access-Control-Allow-Oirigin", "*");
  if (success == true) {
    var newToken = uuid.v4();
    User.saveToken(req.body.username, newToken, function (token) {
      res.json({ message: "aithorization granted", token: token });
    })
  } else {
    res.json({ message: "Not found!" });
  }
  // User.verifyPassword(req.body.username, req.body.password, req.body.coi_name, function (success, user) {
  //   if (success == true) {
  //     // generate token using uuid
  //     var newToken = uuid.v4();
  //     User.saveToken(req.body.username, newToken, function (token) {
  //       res.json({ message: "aithorization granted", token: token });
  //     });
  //   } else {
  //     res.json({ message: "Not Found" });
  //   }
  // });
}

exports.isAuthenticated = passport.authenticate('http-header-token', { session: false });
