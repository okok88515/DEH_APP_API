var db = require('mssql');
var dbconfig = require('../utility/config').dbconfig;
var geo = require('geolib');
var geocoding = require('../services/geocoding');
var shortid = require('shortid');
var moment = require('moment');
var fs = require('fs');
var ftp = require('jsftp');
var ftpconfig = require('../utility/config').ftpconfig;
var ftpconfig2 = require('../utility/config').ftpconfig2;
// var async = require('async');
var group_name_array = new Array();
// db connect
//...
db.connect(dbconfig).then(function () {
  console.log('groups: connected to Micorsoft SQL server');
}).catch(function (err) {
  console.log(err);
});

exports.createGroup = async function (request) {
  // console.log('Create Group....');
  try {
    var new_group_info = JSON.parse(request.body['group_information']);
    if (new_group_info['group_name'] == "" || new_group_info['group_name'] == undefined || new_group_info['group_name'] == null) {
      return { success: false, message: "group name Unqualified!" }
    } else {
      const { success, id } = await addGroupToDB(new_group_info)
      if (!success);
      else
        return { success: success, id: id }
    }
  } catch (err) {
    console.log(err);
  }
  /*
  var new_group_info = JSON.parse(request.body['group_information']);
  if (new_group_info['group_name'] == "" || new_group_info['group_name'] == undefined || new_group_info['group_name'] == null) {
    return callback(false, 'group name Unqualified!');
  } else {
    addGroupToDB(new_group_info, function (success, id) {
      if (!success) return callback(success, "create group failed!");
      else {
        return callback(success, "create group successed!", id);
      }
    });
  }*/
}

exports.groupMessage = async function (request) {
  // console.log("Member management request :" + request.body['group_message_info']);
  var new_group_message = JSON.parse(request.body['group_message_info']);
  if (new_group_message['group_id'] == "" || new_group_message['group_id'] == undefined || new_group_message['group_id'] == null) {
    return 'group id Unqualified!';
  } else {
    const { success, mes } = await processGroupMessage(new_group_message)
    return mes
  }
}
exports.searchGroup = async function (request) {
  try {
    const { username, language, coi_name } = request;

    // 查詢用戶 ID
    let query1 = `SELECT [user_id] FROM [MOE3].[dbo].[user_profile] WHERE [user_name] = '${username}'`;
    console.log("User Query: " + query1);
    let recordset1 = await new db.Request().query(query1);

    let userId = recordset1[0]['user_id'];

    // 合併查詢，用於查詢用戶所在的組及其詳細信息
    let query = `
      SELECT 
        g.[group_name], 
        g.[group_info], 
        g.[group_leader_id], 
        gm.[foreignkey_id], 
        gm.[identifier] AS [role], 
        g.[group_id]
      FROM 
        [MOE3].[dbo].[GroupsMember] gm
      JOIN 
        [MOE3].[dbo].[Groups] g
      ON 
        gm.[foreignkey_id] = g.[group_id]
      WHERE 
        gm.[user_id_id] = ${userId}
        AND g.[language] = '${language}'
        AND g.[coi_name] = '${coi_name}'
      ORDER BY 
        gm.[foreignkey_id] ASC`;

    console.log("Combined Query: " + query);
    let recordset = await new db.Request().query(query);
    return recordset
  } catch (err) {
    console.log("err: ", err);
    return []
  }
};

exports.searchGroup_old = async function (request) {
  // console.log("")
  // console.log("Search Request :" + request.body['username']);
  var keys = "[user_id]";
  var query1 = "SELECT " + keys + " FROM [MOE3].[dbo].[user_profile]";
  var cond1 = "[user_name]='" + request.body["username"];
  query1 += " WHERE " + cond1 + "'";
  console.log("User Qery :" + query1);

  try {
    let recordset = new db.Request().query(query1)
    var id = recordset[0]['user_id'];
    var keys2 = "[foreignkey_id],[identifier]";
    var query2 = "SELECT " + keys2 + " FROM [MOE3].[dbo].[GroupsMember]"
    var cond2 = "[user_id_id]= " + id;
    query2 += " WHERE " + cond2 + " ORDER BY [foreignkey_id] ASC";
    console.log("GroupMember :: " + query2);
    try {
      let recordset = new db.Request().query(query2)
      if (recordset == "" || recordset == null || recordset === undefined) {
        return { success: false, NameArr: null, RoleArr: null, InfoArr: null, IdArr: null }
      }
      var sync = new Wait(recordset.length, function (NameArr, RoleArr, InfoArr, IdArr) {
        return callback(true, NameArr, RoleArr, InfoArr, IdArr);
      });
      for (var i = 0; i < recordset.length; i++) {
        var role = recordset[i]['identifier'];
        var groupID = recordset[i]['foreignkey_id'];
        var keys3 = "[group_name],[group_info],[group_leader_id],[group_id]";
        var query3 = "Select " + keys3 + " FROM [MOE3].[dbo].[Groups] ";
        var cond3 = "[group_id]= " + groupID + " AND [language] = '" + request.body["language"] + "'" + " AND [coi_name] = '" + request.body["coi_name"] + "'";
        query3 += "WHERE " + cond3;
        console.log(query3);

        try {
          let recordset = new db.Request().query(query3)
          if (recordset.length == 0) {
            // console.log("Nothing");
            sync.next("", "", "", null);
          } else {
            if (recordset[0]['group_leader_id'] == id) {
              var gName = recordset[0]['group_name'];
              var gInfo = recordset[0]['group_info'];
              var group_id = recordset[0]['group_id'];
              sync.next(gName, "leader", gInfo, group_id);
            } else {
              var gName = recordset[0]['group_name'];
              var gInfo = recordset[0]['group_info'];
              var group_id = recordset[0]['group_id'];
              sync.next(gName, "member", gInfo, group_id);
            }
          }
          return recordset
        } catch (err) {
          console.log("err: ", err)
        }
      }
      return recordset
    } catch (err) {
      console.log("err: ", err)
    }
    return recordset
  } catch (err) {
    console.log("err: ", err)
  }

  /*
  new db.Request().query(query1).then(function (recordset) {
    var id = recordset[0]['user_id'];
    var keys2 = "[foreignkey_id],[identifier]";
    var query2 = "SELECT " + keys2 + " FROM [MOE3].[dbo].[GroupsMember]"
    var cond2 = "[user_id_id]= " + id;
    query2 += " WHERE " + cond2 + " ORDER BY [foreignkey_id] ASC";
    console.log("GroupMember :: " + query2);
    new db.Request().query(query2).then(function (recordset) {
      if (recordset == "" || recordset == null || recordset === undefined) {
        return callback(false, null, null, null, null);
      }
      var sync = new Wait(recordset.length, function (NameArr, RoleArr, InfoArr, IdArr) {
        return callback(true, NameArr, RoleArr, InfoArr, IdArr);
      });
      for (var i = 0; i < recordset.length; i++) {
        var role = recordset[i]['identifier'];
        var groupID = recordset[i]['foreignkey_id'];
        var keys3 = "[group_name],[group_info],[group_leader_id],[group_id]";
        var query3 = "Select " + keys3 + " FROM [MOE3].[dbo].[Groups] ";
        var cond3 = "[group_id]= " + groupID + " AND [language] = '" + request.body["language"] + "'" + " AND [coi_name] = '" + request.body["coi_name"] + "'";
        query3 += "WHERE " + cond3;
        console.log(query3);
        new db.Request().query(query3).then(function (recordset) {
          if (recordset.length == 0) {
            console.log("Nothing");
            sync.next("", "", "", null);
          } else {
            if (recordset[0]['group_leader_id'] == id) {
              var gName = recordset[0]['group_name'];
              var gInfo = recordset[0]['group_info'];
              var group_id = recordset[0]['group_id'];
              sync.next(gName, "leader", gInfo, group_id);
            } else {
              var gName = recordset[0]['group_name'];
              var gInfo = recordset[0]['group_info'];
              var group_id = recordset[0]['group_id'];
              sync.next(gName, "member", gInfo, group_id);
            }
          }
        });
      }
    });
  });*/
}



exports.listGroups = async function (request) {
  // console.log("List Request :" + request.body['user_name']);
  var coi_name = request.body['coi_name'];
  var query = "SELECT [group_name],[group_id],[group_leader_id] FROM [MOE3].[dbo].[Groups] ";
  var cond1 = "WHERE [coi_name] = '" + coi_name + "' AND [verification] = '1'";
  query += cond1;
  console.log("Query :" + query);

  try {
    let recordset = await new db.Request().query(query)
    if (recordset == "" || recordset == null || recordset === undefined) {
      return { success: false, NameArr: null };
    }
    return { success: true, NameArr: recordset };
  } catch (err) {
    console.log(err)
  }
  /*
  new db.Request().query(query).then(function (recordset) {
    if (recordset == "" || recordset == null || recordset === undefined) {
      return callback(false, null);
    }
    
    // var sync = new Wait(recordset.length, function(NameArr) {
    //   return callback(true,NameArr);
    // });
    
    callback(true, recordset);
    // var NameArr = [];
    // for(var i = 0; i < recordset.length;i++) {
    //   var gName = recordset[i]['group_name'];
    //   NameArr.push(gName);
    //   //sync.next(gName);
    // }
    // callback(true,NameArr);
  });*/
}


exports.updateGroup = async function (request) {
  // console.log("Update Request :" + request.body['group_update_info']);
  // var update_group_info = JSON.parse(request.body['group_update_info']);
  var update_group_info = request.body['group_update_info']
  // console.log(request.body['group_update_info']);
  var query = "UPDATE [MOE3].[dbo].[Groups] ";
  var update_state = "SET [group_name]='" + update_group_info['group_name'] + "',[group_info]='" + update_group_info['group_info'] + "'";
  query += " " + update_state;
  var cond = "[group_id]=" + update_group_info["group_id"];
  query += " WHERE " + cond + "";
  console.log("Query :" + query);

  try {
    let recordset = await new db.Request().query(query)
    return { success: true, message: "update success!" };
  } catch (err) {
    console.log(err);
    return { success: false, message: "update failed!" };
  }
}

exports.notificationGroup = async function (request) {
  // console.log("Notification Request :" + request.body['notification']);
  var Gname = new Array();
  var Sname = new Array();
  var Gid = new Array();
  var Grole = new Array
  var notification_info = JSON.parse(request.body['notification']);
  var keys = "[user_id]";
  var query1 = "SELECT " + keys + " FROM [MOE3].[dbo].[user_profile]";
  var cond1 = "[user_name]='" + notification_info["username"];
  query1 += " WHERE " + cond1 + "'";

  try {
    var recordset = await new db.Request().query(query1)
    var id = recordset[0]['user_id'];
    var keys2 = "G.[group_id],UP.[user_name],G.[group_name],GM.[receiver_id],GM.[sender_id],G.[group_leader_id]";
    var query2 = "SELECT " + keys2 + " FROM [MOE3].[dbo].[GroupsMessage] as GM,[MOE3].[dbo].[Groups] as G,[MOE3].[dbo].[user_profile] as UP";
    var cond2 = "GM.[receiver_id]= " + id + " AND GM.[group_id_id] = G.[group_id] AND GM.[message_type] = 0 AND GM.[sender_id] = UP.[user_id] AND [is_read] = 0";
    query2 += " WHERE " + cond2;
    console.log("Noti Query :" + query2);

    recordset = await new db.Request().query(query2)
    // console.log(recordset);
    if (recordset[0] == null || recordset[0] == undefined || recordset[0] == {} || recordset[0] == []) {
      return { success: false, recordset: null };
    } else {
      for (var i = 0; i < recordset.length; i++) {
        if (recordset[i]['receiver_id'] == recordset[i]['group_leader_id']) {//Member join request
          Grole.push("MemberRequest");
        } else {
          Grole.push("LeaderRequest");
        }
        Gname.push(recordset[i]['group_name']);
        Sname.push(recordset[i]['user_name']);
        console.log("GID : " + recordset[i]['group_id']);
        Gid.push(recordset[i]['group_id']);
      }
      return { success: true, Gname, Sname, Gid, Grole };
    }
  } catch (err) {
    console.log(err);
    return { success: false, recordset: null };
  }
}

exports.memberJoinRequest = async function (request) {
  //contain group_name,sender_name
  // console.log("Member join request string :" + request.body['join_info']);
  var join_info = JSON.parse(request.body['join_info']);
  if (join_info['group_name'] == "" || join_info['group_name'] == undefined || join_info['group_name'] == null) {
    return { success: false, message: 'group name Unqualified!' };
  } else {
    const { success, mes } = await memberRequest(join_info)
    if (success) {
      return { success, mes };
    } else {
      return { success, mes };
    }
  }
}

exports.checkMembers = async function (request) {
  // console.log("CheckMember Request :" + request.body['member_info']);
  var username_arr = new Array();
  var role_arr = new Array();
  //var member_info = JSON.parse(request.body['member_info']);
  var member_info = request.body
  var keys = "[user_name],[identifier]";
  var query1 = "SELECT " + keys + " FROM [MOE3].[dbo].[user_profile] as up,[MOE3].[dbo].[Groups] as g,[MOE3].[dbo].[GroupsMember] as gm";
  var cond1 = "gm.[foreignkey_id]=" + member_info["group_id"] + " AND g.[coi_name] = '" + member_info["coi_name"] + "' AND gm.[foreignkey_id] = g.[group_id] " + "AND gm.[user_id_id] = up.[user_id]";
  query1 += " WHERE " + cond1;
  console.log("Member Query : " + query1);

  try {
    let recordset = await new db.Request().query(query1)
    if (recordset[0] == null || recordset[0] == undefined || recordset[0] == {} || recordset[0] == []) {
      return { success: true, username_arr: null };
    } else {
      for (var i = 0; i < recordset.length; i++) {
        username_arr.push(recordset[i]['user_name']);
        role_arr.push(recordset[i]['identifier']);
      }
      return { success: true, username_arr, role_arr };
    }
  } catch (err) {
    console.log(err);
    return { success: false, username_arr: null };
  }
  /*
  new db.Request().query(query1).then(function (recordset) {
    if (recordset[0] == null || recordset[0] == undefined || recordset[0] == {} || recordset[0] == []) {
      callback(true, null);
    } else {
      for (var i = 0; i < recordset.length; i++) {
        username_arr.push(recordset[i]['user_name']);
        role_arr.push(recordset[i]['identifier']);
      }
      return callback(true, username_arr, role_arr);
    }
  }).catch(function (err) {
    console.log(err);
    return callback(false, null);
  });*/
}

exports.insertIntoGroup = function (req, done) {
  console.log("Insert into Group...")
  var query = "SELECT MAX(member_id) FROM [MOE3].[dbo].[GroupsMember]"
  console.log(query)
  var user_id = JSON.parse(req.body['user_id']);
  var group_id = JSON.parse(req.body['group_id']);

  new db.Request().query(query).then(function (recordset) {
    //console.log(recordset[0][''])
    var new_id = recordset[0][''] + 1;
    var keys5 = "[join_time],[identifier],[foreignkey_id],[user_id_id]"
    var values5 = ["2020-01-02", "member", group_id, user_id]
    var query2 = "INSERT INTO [MOE3].[dbo].[GroupsMember] (" + keys5 + ") VALUES('" + values5.join("','") + "')"
    console.log(query2)

    new db.Request().query(query2).then(function (recordset) {
      return done(true, "Insert Success!", group_id)
    }).catch(function (err) {
      console.log(err);
      return done(false, "Insert Fail!");
    });

  });
}

async function processGroupMessage(new_group_message, done) {
  // console.log("Create Message in DB...");
  // search Sender ID
  if (new_group_message["sender_name"] == new_group_message["receiver_name"]) {
    return done(false, "Can not send request for myself!");
  } else {
    var sender_id = ""
    var receiver_id = ""
    var query1 = "SELECT [user_id] FROM [MOE3].[dbo].[user_profile]";
    var cond1 = "[user_name]='" + new_group_message["sender_name"];
    query1 += " WHERE " + cond1 + "'";
    console.log(query1);

    try {
      var recordset = await new db.Request().query(query1)
      sender_id = recordset[0]['user_id'];
      // search Receiver ID
      var query2 = "SELECT [user_id] FROM [MOE3].[dbo].[user_profile]";
      var cond2 = "[user_name]='" + new_group_message["receiver_name"];
      query2 += " WHERE " + cond2 + "'";
      console.log(query2);

      recordset = await new db.Request().query(query2)
      if (recordset == "" || recordset == null || recordset == undefined) {
        return done(false, "Without this person!");
      } else {
        receiver_id = recordset[0]['user_id'];

        var checkGroupLeaderquery = "SELECT [user_id_id] FROM [MOE3].[dbo].[GroupsMember]";
        var checkGroupLeadercond = "[foreignkey_id] = '" + new_group_message["group_id"] + "' AND [identifier] = '" + "leader" + "'";
        checkGroupLeaderquery += " WHERE " + checkGroupLeadercond;
        console.log(checkGroupLeaderquery);

        recordset = await new db.Request().query(checkGroupLeaderquery)
        if (recordset == "" || recordset == null || recordset == undefined) {
          return done(false, "Without this group!");
        } else {
          var leader_id = recordset[0]['user_id_id'];
          var new_member_id = "";

          if (leader_id == sender_id) {
            new_member_id = receiver_id;
          } else {
            new_member_id = sender_id;
          }

          var cond4 = "[user_id_id]='" + new_member_id + "' AND [foreignkey_id]='" + new_group_message["group_id"] + "' AND [group_id_id] = [foreignkey_id] AND [message_type] = 1";
          var query4 = "SELECT [member_id] FROM [MOE3].[dbo].[GroupsMember], [MOE3].[dbo].[GroupsMessage] WHERE " + cond4;
          console.log(query4);

          recordset = await new db.Request().query(query4)
          if (recordset.length != 0) {
            return done(false, "Already in group!");
          } else {
            if (new_group_message["message_type"] == "Invite") {
              var cond4_2 = "[is_read]='0'" + "AND [group_id_id]='" + new_group_message["group_id"] + "' AND ([receiver_id]='" + receiver_id + "' OR [sender_id]='" + receiver_id + "')";
              var query4_2 = "SELECT [is_read] FROM [MOE3].[dbo].[GroupsMessage] WHERE " + cond4_2;
              console.log(query4_2);

              recordset = await new db.Request().query(query4_2)
              if (recordset.length != 0) {
                return done(false, "Already invite!");
              } else {
                var keys3 = "[is_read],[message_type],[group_id_id],[receiver_id],[sender_id]";
                // Insert message into DB
                var value3 = ["0", "0", new_group_message["group_id"], receiver_id, sender_id]
                var query3 = "INSERT INTO [MOE3].[dbo].[GroupsMessage] (" + keys3 + ") VALUES('" + value3.join("',N'") + "')";
                console.log(query3);

                recordset = await new db.Request().query(query3)
                console.log("Message Created!");

                return done(true, "Invite success!");
              }

            } else if (new_group_message["message_type"] == "Agree") {
              var query3 = "UPDATE [MOE3].[dbo].[GroupsMessage] ";
              var update_state = "SET [is_read]='1',[message_type]='1'";
              query3 += " " + update_state;
              var cond = "[receiver_id]=" + receiver_id + " AND " + "[sender_id]=" + sender_id + " AND " + "[group_id_id]=" + new_group_message["group_id"];
              query3 += " WHERE " + cond + "";
              console.log(query3);

              recordset = await new db.Request().query(query3)
              //INSERT the GroupMember Table
              var key5 = "[group_id] = " + new_group_message["group_id"] + " AND [group_leader_id] = " + receiver_id
              var query5 = "SELECT * FROM [MOE3].[dbo].[Groups] WHERE " + key5
              console.log(query5)

              recordset = await new db.Request().query(query5)
              if (recordset.length != 0) {
                var keys4 = "[join_time],[foreignkey_id],[user_id_id],[identifier]";
                var values4 = [moment().format('YYYY-MM-DD hh:mm:ss'), new_group_message["group_id"], sender_id, "member"];
                var query4 = "INSERT INTO [MOE3].[dbo].[GroupsMember] (" + keys4 + ") VALUES('" + values4.join("',N'") + "')";
                console.log(query4);

                recordset = await new db.Request().query(query4)
                console.log("Message Update!");
              } else {
                var keys4 = "[join_time],[foreignkey_id],[user_id_id],[identifier]";
                var values4 = [moment().format('YYYY-MM-DD hh:mm:ss'), new_group_message["group_id"], receiver_id, "member"];
                var query4 = "INSERT INTO [MOE3].[dbo].[GroupsMember] (" + keys4 + ") VALUES('" + values4.join("',N'") + "')";
                console.log(query4);

                recordset = await new db.Request().query(query4)
                console.log("Message Update!");
              }
              return done(true, "Join success!");
            } else {
              var query3 = "UPDATE [MOE3].[dbo].[GroupsMessage] ";
              var update_state = "SET [is_read]='1',[message_type]='-1'";
              query3 += " " + update_state;
              var cond = "[receiver_id]=" + receiver_id + " AND " + "[sender_id]=" + sender_id + " AND " + "[group_id_id]=" + new_group_message["group_id"];
              query3 += " WHERE " + cond + "";

              console.log(query3);
              recordset = await new db.Request().query(query3)
              console.log("Message Update!");

              return done(true, "Reject success!");
            }
          }
        }
      }
    } catch (err) {
      console.log(err)
    }

    /*
    new db.Request().query(query1).then(function (recordset) {
      sender_id = recordset[0]['user_id'];
      // search Receiver ID
      var query2 = "SELECT [user_id] FROM [MOE3].[dbo].[user_profile]";
      var cond2 = "[user_name]='" + new_group_message["receiver_name"];
      query2 += " WHERE " + cond2 + "'";
      console.log(query2);
      new db.Request().query(query2).then(function (recordset) {
        if (recordset == "" || recordset == null || recordset == undefined) {
          return done(false, "Without this person!");
        } else {
          receiver_id = recordset[0]['user_id'];

          var checkGroupLeaderquery = "SELECT [user_id_id] FROM [MOE3].[dbo].[GroupsMember]";
          var checkGroupLeadercond = "[foreignkey_id] = '" + new_group_message["group_id"] + "' AND [identifier] = '" + "leader" + "'";
          checkGroupLeaderquery += " WHERE " + checkGroupLeadercond;
          console.log(checkGroupLeaderquery);

          new db.Request().query(checkGroupLeaderquery).then(function (recordset) {
            if (recordset == "" || recordset == null || recordset == undefined) {
              return done(false, "Without this group!");
            } else {
              var leader_id = recordset[0]['user_id_id'];
              var new_member_id = "";

              if (leader_id == sender_id) {
                new_member_id = receiver_id;
              } else {
                new_member_id = sender_id;
              }

              var cond4 = "[user_id_id]='" + new_member_id + "' AND [foreignkey_id]='" + new_group_message["group_id"] + "' AND [group_id_id] = [foreignkey_id] AND [message_type] = 1";
              var query4 = "SELECT [member_id] FROM [MOE3].[dbo].[GroupsMember], [MOE3].[dbo].[GroupsMessage] WHERE " + cond4;
              console.log(query4);
              new db.Request().query(query4).then(function (recordset) {
                if (recordset.length != 0) {
                  return done(false, "Already in group!");
                } else {
                  if (new_group_message["message_type"] == "Invite") {
                    var cond4_2 = "[is_read]='0'" + "AND [group_id_id]='" + new_group_message["group_id"] + "' AND ([receiver_id]='" + receiver_id + "' OR [sender_id]='" + receiver_id + "')";
                    var query4_2 = "SELECT [is_read] FROM [MOE3].[dbo].[GroupsMessage] WHERE " + cond4_2;
                    console.log(query4_2);
                    new db.Request().query(query4_2).then(function (recordset) {
                      if (recordset.length != 0) {
                        return done(false, "Already invite!");
                      } else {
                        var keys3 = "[is_read],[message_type],[group_id_id],[receiver_id],[sender_id]";
                        // Insert message into DB
                        var value3 = ["0", "0", new_group_message["group_id"], receiver_id, sender_id]
                        var query3 = "INSERT INTO [MOE3].[dbo].[GroupsMessage] (" + keys3 + ") VALUES('" + value3.join("',N'") + "')";
                        console.log(query3);
                        new db.Request().query(query3).then(function (recordset) {
                          console.log("Message Created!");
                        });
                        return done(true, "Invite success!");
                      }
                    });
                  } else if (new_group_message["message_type"] == "Agree") {
                    var query3 = "UPDATE [MOE3].[dbo].[GroupsMessage] ";
                    var update_state = "SET [is_read]='1',[message_type]='1'";
                    query3 += " " + update_state;
                    var cond = "[receiver_id]=" + receiver_id + " AND " + "[sender_id]=" + sender_id + " AND " + "[group_id_id]=" + new_group_message["group_id"];
                    query3 += " WHERE " + cond + "";

                    console.log(query3);
                    new db.Request().query(query3).then(function (recordset) {
                      //INSERT the GroupMember Table
                      var key5 = "[group_id] = " + new_group_message["group_id"] + " AND [group_leader_id] = " + receiver_id
                      var query5 = "SELECT * FROM [MOE3].[dbo].[Groups] WHERE " + key5
                      console.log(query5)
                      new db.Request().query(query5).then(function (recordset) {
                        if (recordset.length != 0) {
                          var keys4 = "[join_time],[foreignkey_id],[user_id_id],[identifier]";
                          var values4 = [moment().format('YYYY-MM-DD hh:mm:ss'), new_group_message["group_id"], sender_id, "member"];
                          var query4 = "INSERT INTO [MOE3].[dbo].[GroupsMember] (" + keys4 + ") VALUES('" + values4.join("',N'") + "')";
                          console.log(query4);
                          new db.Request().query(query4).then(function (recordset) {
                            console.log("Message Update!");
                          });
                        } else {
                          var keys4 = "[join_time],[foreignkey_id],[user_id_id],[identifier]";
                          var values4 = [moment().format('YYYY-MM-DD hh:mm:ss'), new_group_message["group_id"], receiver_id, "member"];
                          var query4 = "INSERT INTO [MOE3].[dbo].[GroupsMember] (" + keys4 + ") VALUES('" + values4.join("',N'") + "')";
                          console.log(query4);
                          new db.Request().query(query4).then(function (recordset) {
                            console.log("Message Update!");
                          });
                        }
                      });
                    });
                    return done(true, "Join success!");
                  } else {
                    var query3 = "UPDATE [MOE3].[dbo].[GroupsMessage] ";
                    var update_state = "SET [is_read]='1',[message_type]='-1'";
                    query3 += " " + update_state;
                    var cond = "[receiver_id]=" + receiver_id + " AND " + "[sender_id]=" + sender_id + " AND " + "[group_id_id]=" + new_group_message["group_id"];
                    query3 += " WHERE " + cond + "";

                    console.log(query3);
                    new db.Request().query(query3).then(function (recordset) {
                      console.log("Message Update!");
                    });
                    return done(true, "Reject success!");
                  }
                }
              });
            }
          });
        }
      });
    });*/
  }
}

async function memberRequest(join_info, done) {
  // console.log("Member Request .....");
  var query1 = "SELECT * FROM [MOE3].[dbo].[Groups] WHERE [group_name] = '" + join_info['group_name'] + "'";
  var query2 = "SELECT * FROM [MOE3].[dbo].[user_profile] WHERE [user_name] = '" + join_info['sender_name'] + "'";

  try {
    var recordset = await new db.Request().query(query2)
    var sender_id = recordset[0]['user_id'];

    recordset = await new db.Request().query(query1)
    if (recordset.length == 0) {
      return done(false, "The group is not exist!");
    }
    var receiver_id = recordset[0]['group_leader_id'];
    if (receiver_id == sender_id) {//Can not send request for myself!
      return done(false, "Can not send request for myself!");
    }
    var group_id = recordset[0]['group_id'];
    var query3 = "SELECT * FROM [MOE3].[dbo].[GroupsMember] WHERE [identifier] = 'member' AND [user_id_id] = " + sender_id + " AND [foreignkey_id] = " + group_id;

    recordset = await new db.Request().query(query3)
    if (recordset.length != 0) {// Member is in this group
      return done(false, "Member is in this group!");
    }
    var query4 = "SELECT * FROM [MOE3].[dbo].[GroupsMessage]" + " WHERE [receiver_id] = " + sender_id + " AND [sender_id] = " + receiver_id + " AND [group_id_id] = " + group_id + " AND [is_read] = 0 AND [message_type] = 0";
    console.log("Query4 : " + query4);

    recordset = await new db.Request().query(query4)
    // console.log(recordset.length);
    if (recordset.length != 0) { // Leader has invited the member.
      return done(false, "Leader has invited the member!");
    }
    var query5 = "SELECT * FROM [MOE3].[dbo].[GroupsMessage]" + " WHERE [receiver_id] = " + receiver_id + " AND [sender_id] = " + sender_id + " AND [group_id_id] = " + group_id + " AND [is_read] = 0 AND [message_type] = 0";
    console.log("Query5 :" + query5);

    recordset = await new db.Request().query(query5)
    if (recordset.length != 0) {//Member has allocated request
      return done(false, "Member has allocated request");
    }
    var keys = "[is_read],[message_type],[group_id_id],[receiver_id],[sender_id]";
    var value = ["0", "0", group_id, receiver_id, sender_id];
    var query6 = "INSERT INTO [MOE3].[dbo].[GroupsMessage] (" + keys + ") VALUES('" + value.join("',N'") + "')";
    console.log("Query6 :" + query6);

    recordset = await new db.Request().query(query6)
    return done(true, "Send request successfully!");
  } catch (err) {
    console.log(err)
  }
  /*
  new db.Request().query(query2).then(function (recordset) {
    var sender_id = recordset[0]['user_id'];
    new db.Request().query(query1).then(function (recordset) {
      if (recordset.length == 0) {
        return done(false, "The group is not exist!");
      }
      var receiver_id = recordset[0]['group_leader_id'];
      if (receiver_id == sender_id) {//Can not send request for myself!
        return done(false, "Can not send request for myself!");
      }
      var group_id = recordset[0]['group_id'];
      var query3 = "SELECT * FROM [MOE3].[dbo].[GroupsMember] WHERE [identifier] = 'member' AND [user_id_id] = " + sender_id + " AND [foreignkey_id] = " + group_id;
      new db.Request().query(query3).then(function (recordset) {
        if (recordset.length != 0) {// Member is in this group
          return done(false, "Member is in this group!");
        }
        var query4 = "SELECT * FROM [MOE3].[dbo].[GroupsMessage]" + " WHERE [receiver_id] = " + sender_id + " AND [sender_id] = " + receiver_id + " AND [group_id_id] = " + group_id + " AND [is_read] = 0 AND [message_type] = 0";
        console.log("Query4 : " + query4);
        new db.Request().query(query4).then(function (recordset) {
          console.log(recordset.length);
          if (recordset.length != 0) { // Leader has invited the member.
            return done(false, "Leader has invited the member!");
          }
          var query5 = "SELECT * FROM [MOE3].[dbo].[GroupsMessage]" + " WHERE [receiver_id] = " + receiver_id + " AND [sender_id] = " + sender_id + " AND [group_id_id] = " + group_id + " AND [is_read] = 0 AND [message_type] = 0";
          console.log("Query5 :" + query5);
          new db.Request().query(query5).then(function (recordset) {
            if (recordset.length != 0) {//Member has allocated request
              return done(false, "Member has allocated request");
            }
            var keys = "[is_read],[message_type],[group_id_id],[receiver_id],[sender_id]";
            var value = ["0", "0", group_id, receiver_id, sender_id];
            var query6 = "INSERT INTO [MOE3].[dbo].[GroupsMessage] (" + keys + ") VALUES('" + value.join("',N'") + "')";
            console.log("Query6 :" + query6);
            new db.Request().query(query6).then(function (recordset) {
              return done(true, "Send request successfully!");
            });
          });
        });
      });
    });
  });*/
}

async function addGroupToDB(new_group_info, done) {
  // console.log("Create Group in DB....");
  var keys = "[user_id]";
  var query1 = "SELECT " + keys + " FROM [MOE3].[dbo].[user_profile]";
  var cond1 = "[user_name]='" + new_group_info["group_leader_name"];
  query1 += " WHERE " + cond1 + "'";

  try {
    var recordset = await new db.Request().query(query1)

    var id = recordset[0]['user_id'];
    console.log("My ID : " + id);
    var keys2 = "[group_name],[group_leader_id],[group_info],[create_time],[language],[verification],[open],[coi_name],[manage],[open_origin]";
    var values2 = [
      new_group_info["group_name"], id, new_group_info["group_info"],
      moment().format('YYYY-MM-DD hh:mm:ss'),
      new_group_info["language"], new_group_info["verification"], new_group_info["open"], new_group_info["coi_name"], 0, 1

    ];
    var valstr = values2.join("',N'");
    var query2 = "INSERT INTO [MOE3].[dbo].[Groups] (" + keys2 + ") VALUES('" + values2.join("',N'") + "')";
    var query3 = "SELECT [group_id] FROM [MOE3].[dbo].[Groups] WHERE group_name = '" + new_group_info["group_name"] +
      "' AND group_info = '" + new_group_info["group_info"] + "'";
    console.log("query : " + query2);
    console.log("query2 : " + query3);


    recordset = await new db.Request().query(query2)

    recordset = await new db.Request().query(query3)
    //INSERT the GroupMember Table
    var keys4 = "[join_time],[foreignkey_id],[user_id_id],[identifier]";
    var values4 = [moment().format('YYYY-MM-DD hh:mm:ss'), recordset[0]["group_id"], id, "leader"];
    var query4 = "INSERT INTO [MOE3].[dbo].[GroupsMember] (" + keys4 + ") VALUES('" + values4.join("',N'") + "')";
    var query5 = "SELECT [foreignkey_id] FROM [MOE3].[dbo].[GroupsMember] WHERE foreignkey_id = " + recordset[0]["group_id"];


    recordset = await new db.Request().query(query4)

    recordset = await new db.Request().query(query5)
    console.log("Group_id = " + recordset[0]["foreignkey_id"]);
    return done(true, recordset[0]["foreignkey_id"]);
  } catch (err) {
    console.log(err);
    return done(false, null);
  }
  /*
  new db.Request().query(query1).then(function (recordset) {
    var id = recordset[0]['user_id'];
    console.log("My ID : " + id);
    var keys2 = "[group_name],[group_leader_id],[group_info],[create_time],[language],[verification],[open],[coi_name],[manage],[open_origin]";
    var values2 = [
      new_group_info["group_name"], id, new_group_info["group_info"],
      moment().format('YYYY-MM-DD hh:mm:ss'),
      new_group_info["language"], new_group_info["verification"], new_group_info["open"], new_group_info["coi_name"], 0, 1

    ];
    var valstr = values2.join("',N'");
    var query2 = "INSERT INTO [MOE3].[dbo].[Groups] (" + keys2 + ") VALUES('" + values2.join("',N'") + "')";
    var query3 = "SELECT [group_id] FROM [MOE3].[dbo].[Groups] WHERE group_name = '" + new_group_info["group_name"] +
      "' AND group_info = '" + new_group_info["group_info"] + "'";
    console.log("query : " + query2);
    console.log("query2 : " + query3);
    //INSERT the Groups Table
    new db.Request().query(query2).then(function (recordset) {
      new db.Request().query(query3).then(function (recordset) {
        //INSERT the GroupMember Table
        var keys4 = "[join_time],[foreignkey_id],[user_id_id],[identifier]";
        var values4 = [moment().format('YYYY-MM-DD hh:mm:ss'), recordset[0]["group_id"], id, "leader"];
        var query4 = "INSERT INTO [MOE3].[dbo].[GroupsMember] (" + keys4 + ") VALUES('" + values4.join("',N'") + "')";
        var query5 = "SELECT [foreignkey_id] FROM [MOE3].[dbo].[GroupsMember] WHERE foreignkey_id = " + recordset[0]["group_id"];
        new db.Request().query(query4).then(function (recordset) {
          new db.Request().query(query5).then(function (recordset) {
            console.log("Group_id = " + recordset[0]["foreignkey_id"]);
            return done(true, recordset[0]["foreignkey_id"]);
          });
        });
      });
    }).catch(function (err) {
      console.log(err);
      return done(false, null);
    });
  });*/
}

//solute the nodejs for asyn
function Wait(count, callback) {
  var payload = [];
  var roleArr = [];
  var infoArr = [];
  var idArr = []
  this.next = function (name, role, info, id) {
    if (name == "" || role == "" || id == null) {
      count--;
    } else {
      payload.push(name);
      roleArr.push(role);
      infoArr.push(info);
      idArr.push(id);
      count--;
    }
    if (count <= 0) {
      callback(payload, roleArr, infoArr, idArr);
    }
  }
}
exports.searchGroupV2 = async function (request) {
  var keys2 = "[foreignkey_id],[identifier]";
  var query2 = "SELECT " + keys2 + " FROM [MOE3].[dbo].[GroupsMember]"
  var cond2 = "[user_id_id]= " + request["user_id"];
  query2 += " WHERE " + cond2 + " ORDER BY [foreignkey_id] ASC";
  if (global.debugPrintLevel >= 2) console.log("GroupMember :: " + query2);

  let groupIDs = await new db.Request().query(query2)
  var groupIDList = '0'
  for (let i = 0; i < groupIDs.length; i++) {
    groupIDList += ","
    groupIDList += groupIDs[i]["foreignkey_id"]
  }

  var keys3 = "[group_id] AS id,[group_name] AS name,[group_leader_id] AS learderId,[group_info]"
  var query3 = "SELECT " + keys3 + " FROM [MOE3].[dbo].[Groups]"
  var cond3 = "[group_id] in (" + groupIDList + ") AND [coi_name] = '" + request["coi_name"] + "'";
  query3 += " WHERE " + cond3 + " ORDER BY [group_id] ASC";
  if (global.debugPrintLevel >= 2) console.log(query3);
  let groups = await new db.Request().query(query3)
  return groups
}

exports.listGroupV2 = async function (request) {
  var keys3 = "[group_id] AS id,[group_name] AS name,[group_leader_id] AS learderId,[group_info]"
  var query3 = "SELECT " + keys3 + " FROM [MOE3].[dbo].[Groups]"
  var cond3 = "WHERE [coi_name] = '" + request["coi_name"] + "'  AND [verification] = '1'";
  query3 += cond3 + "ORDER BY [group_id] ASC";
  if (global.debugPrintLevel >= 2) console.log(query3);
  let groups = await new db.Request().query(query3)
  return groups
}
exports.listRegion = async function (request) {
  var pad = function (num) { return ('00' + num).slice(-2) };
  var date = new Date();
  date = "'" + date.getUTCFullYear() + '-' +
    pad(date.getUTCMonth() + 1) + '-' +
    pad(date.getUTCDate()) + ' ' +
    pad((date.getUTCHours() + 8) % 24) + ':' +
    pad(date.getUTCMinutes()) + ':' +
    pad(date.getUTCSeconds()) + "'";
  console.log(date)
  // var now = "'2023-01-09 15:58:00'";//new Date().getTime()
  var keys = "[region_id] AS id,[region_name] AS name,[region_info] AS info"
  var query = "SELECT " + keys + " FROM [MOE3].[dbo].[Regions]"
  var cond1 = " WHERE [coi_name] = '" + request["coi_name"] + "'";
  // AND [verification] = '1'";
  // var cond2 = " AND "+ date +">[manage_start_time] AND "+ date +"<[manage_end_time]";
  query += cond1 + " ORDER BY [region_id] ASC";

  console.log(query)
  if (global.debugPrintLevel >= 2) console.log(query);
  let regions = await new db.Request().query(query)
  console.log(regions)
  return regions
}