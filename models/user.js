var db = require('mssql');
var config = require('../utility/config').dbconfig;
var moment = require('moment');
// var isPrintQuery = false;

// db connect
db.connect(config).then(function () {
  console.log('users: connected to Microsoft SQL server');
}).catch(function (err) {
  console.log(err);
});

exports.verifyPassword = async function (username, password, coiname) {
  console.log("verifyPassword");
  // validate username and password
  var query1 = "SELECT [user_name] AS username, [user_id], [password], [nickname], [email], A.[role], [birthday]"

  if (coiname == "deh" || coiname === undefined) {
    query1 += " FROM moe3.dbo.user_profile AS A";
    query1 += " WHERE user_name = '" + username + "'";
  } else {
    query1 += " FROM moe3.dbo.user_profile AS A, moe3.dbo.CoiUser AS B";
    query1 += " WHERE user_name = '" + username + "' AND coi_name = '" + coiname + "' AND user_id = user_fk_id";
  }

  console.log(query1);
  try {
    let recordset = await new db.Request().query(query1)
    // user doesn't exist
    if (recordset.length == 0) { return [false, null]; }
    // wrong password
    else if (password != recordset[0]["password"]) { return [false, null]; }
    // delete password key-value
    else {
      delete recordset[0]["password"];
      return [true, recordset[0]];
    }
  } catch (err) {
    console.log("err " + err);
    return [false, null];
  }
  // new db.Request().query(query1).then(function (recordset) {
  //   // user doesn't exist
  //   console.log(recordset);
  //   console.log(password);
  //   console.log(recordset.length == 0);
  //   console.log(password != recordset[0]["password"]);
  //   console.log();
  //   if (recordset.length == 0) { callback(false, null); }

  //   // wrong password

  //   else if (password != recordset[0]["password"]) { callback(false, null); }
  //   // delete password key-value
  //   else {
  //     console.log(5648);
  //     delete recordset[0]["password"];
  //     callback(true, recordset[0]);
  //   }
  // }).catch(function (err) {
  //   console.log("err " + err);
  //   callback(false, null);
  // });
}

exports.findByToken = function (token, done) {
  var query1 = "SELECT * FROM APIKey WHERE apikey='" + token + "'";
  new db.Request().query(query1).then(function (recordset) {
    if (recordset.length == 0) {
      done(false, { message: "Authentication Failed" });
    } else {
      var token_expired = recordset[0]["expired_time"];
      if (moment().isAfter(token_expired) == true) { // token expired
        done(false, { message: "Authentication Failed" });
      } else {
        done(true, recordset[0]);
      }
    }
  }).catch(function (err) {
    done(false, { message: "Authentication Failed" });
  });
}

exports.findByUsername = function (username, done) {
  var request = new db.Request();
  var keys = "[name], [telphone], [cellphone], [email], [social_id], [user_address], [charge], [docent_language], [introduction], [photography]";
  var query1 = "SELECT " + keys + " FROM moe3.dbo.user_profile, docent_profile WHERE user_name='" + username + "' and user_id=fk_userid";
  console.log("query: " + query1);
  request.query(query1).then(function (recordset) {
    if (recordset.length == 0) done(false, null);
    done(true, recordset[0]);
  });
}

exports.saveToken = function (username, newToken, done) {
  var timestamp = moment();
  var now = timestamp.format('YYYY-MM-DD hh:mm:ss');
  var expired = timestamp.add(10, 'days').format('YYYY-MM-DD hh:mm:ss');

  // check token expired or not if it exists
  var query1 = "SELECT * FROM APIKey WHERE [username]='" + username + "'";
  console.log(query1);
  new db.Request().query(query1).then(function (recordset) {
    // if no exists
    if (recordset.length == 0) {
      console.log("add token(" + newToken + ") for user(" + username + ")")
      var query2 = "INSERT INTO APIKey(username, apikey, registered_time, expired_time)" +
        " VALUES('" + username + "', '" + newToken + "', '" + now + "', '" + expired + "')";
      console.log(query2);
      new db.Request().query(query2).then(function (recordset) {
        console.log("token added. \nuser: " + username + ", token: " + newToken);
      });
      done(newToken);
    } else {
      // compare time if expired
      var user_token = recordset[0]["apikey"];
      var user_expired = recordset[0]["expired_time"];
      console.log(user_expired, moment().format())
      if (moment().isAfter(user_expired) == true) {
        console.log("token expired! assign new token");
        // UPDATE user token
        var query2 = "UPDATE APIKey " +
          "SET [apikey]='" + newToken + "', " +
          "[registered_time]='" + now + "', " +
          "[expired_time] = '" + expired + "'" +
          " WHERE [username]='" + username + "'";
        console.log(query2);
        new db.Request().query(query2).then(function (recordset) {
          console.log("token updated. \nuser: " + username + ", token: " + newToken);
        });
        done(newToken);
        // return old token user used
      } else {
        console.log("token is valid, token: " + recordset[0]["apikey"]);
        done(user_token);
      }
    }
  }).catch(function (err) {
    console.log(err);
  });
}

exports.uploadLogData = async function (request, done) {
  // console.log("Upload Log Data:" + request["user_id"] + " time: " + moment().format('YYYY-MM-DD hh:mm:ss'));
  // console.log(request["ula"])

  var query1 = "SELECT [user_id] FROM [MOE3].[dbo].[user_profile] WHERE [user_name] = '" + request["useraccount"] + "'";

  console.log(query1)

  try {
    let recordset = await new db.Request().query(query1)
    var userid = -1
    if (recordset.length == 0) {
      // console.log("Can't find this account.")
      userid = 0
    } else {
      // console.log("user_id:" + recordset[0]["user_id"])
      userid = recordset[0]["user_id"]
    }
    var key2 = "[user_id], [ip] ,[dt] ,[page] ,[dveviceID] ,[appVer] ,[ulatitude] ,[ulongitude]";
    var values2 = [userid, request["ip"], moment().format('YYYY-MM-DD HH:mm:ss'), request["action"], request["dveviceID"], "", request["ula"], request["ulo"]]
    var query2 = "INSERT INTO [MOE3].[dbo].[Logs] (" + key2 + ") VALUES ('" + values2.join("',N'") + "')";
    console.log("query:" + query2);

    recordset = await new db.Request().query(query2)
    return done(true);
  } catch (err) {
    console.log(err);
    return done(false);
  }
}

exports.checkCOIList = function (done) {

  var objItem1 = new Object();
  var objItem2 = new Object();
  var query = "SELECT DISTINCT [coi_name] FROM [MOE3].[dbo].[CoiUser]";
  console.log("query:" + query);
  new db.Request().query(query).then(function (recordset) {
    var coilist = [];

    console.log("COI :" + recordset[0]["coi_name"]);
    objItem1.coi_name = recordset[0]["coi_name"];
    coilist.push(objItem1)

    console.log("COI :" + recordset[1]["coi_name"]);
    objItem2.coi_name = recordset[1]["coi_name"];
    coilist.push(objItem2)

    return done(coilist, true);
  }).catch(function (err) {
    console.log(err);
    return done("", false);
  });
}

exports.createTempAccount = function (request, done) {
  console.log("Create Temp Account...")
  var query = "SELECT MAX(user_id) FROM [MOE3].[dbo].[user_profile]"
  console.log(query)

  new db.Request().query(query).then(function (recordset) {
    //console.log(recordset[0][''])
    var user_info
    if (request.body['user_info'] == null) {
      // console.log("null\n\n\n\n\n\n");
      user_info = { 'user_name': request.body['user_name'] }
    }
    else {
      user_info = JSON.parse(request.body['user_info']);
    }



    var new_id = recordset[0][''] + 1;
    var new_name = "123456" + new_id.toString()
    var temp_password = "efekuhubnf"
    var keys6 = "[user_id],[user_name],[password],[nickname],[email],[role],[account_state]";
    var values6 = [recordset[0][''] + 1, new_name, temp_password, user_info["user_name"], "123456", "user", "1"];
    var query2 = "INSERT INTO [MOE3].[dbo].[user_profile] (" + keys6 + ") VALUES('" + values6.join("','") + "')"
    console.log(query2)
    new db.Request().query(query2).then(function (recordset) {
      return done(true, "Create Account Success!", new_name, new_id, temp_password)
    }).catch(function (err) {
      console.log(err);
      return done(false, "Create Account Fail!");
    });
  });

}

exports.attachTempAccount = function (request, done) {
  console.log("Attach Temp Account...")
  var id = request.body.user_id
  //var id = JSON.parse(request.body.user_id)
  var username = request.body.user_name
  var email = request.body.email
  var password = request.body.password
  // var identity = request.body.identity
  var query = "UPDATE [MOE3].[dbo].[user_profile] SET [user_name] = '" + username + "', [password] = '" + password + "', [email] = '" + email
  var cond1 = "' WHERE [user_id] =" + id
  query += cond1
  console.log(query)
  new db.Request().query(query).then(function (recordset) {
    msg = "Attach Success"
    return done(true, msg);
  }).catch(function (err) {
    console.log(err);
    msg = "Attach Fail"
    return done(false, msg);
  });

}