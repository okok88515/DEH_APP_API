var db = require('mssql');
var dbconfig = require('../utility/config').dbconfig;
var db = require('mssql');
var dbconfig = require('../utility/config').dbconfig;
var geo = require('geolib');
var geocoding = require('../services/geocoding');
var shortid = require('shortid');
var moment = require('moment');
var fs = require('fs');
var media_url_title = "http://deh.csie.ncku.edu.tw/player_pictures/";

db.connect(dbconfig).then(function () {
    console.log('temp: connected to Micorsoft SQL server');
}).catch(function (err) {
    console.log(err);
});

exports.GroupPOIs = function (group_id, callback) {

    console.log('call get group poi list');
    console.log('input group_id : ' + group_id);

    var query0 = "SELECT [POI_id],[POI_title],[latitude],[longitude] FROM [MOE3].[dbo].[dublincore] AS M"
    var query1 = " FULL OUTER JOIN [MOE3].[dbo].[GroupsPoint] AS N ON N.[point_id] = M.[POI_id]"
    var query2 = " WHERE [foreignkey_id] = " + group_id

    console.log("do query : " + query0 + query1 + query2);

    new db.Request().query(query0 + query1 + query2).then(function (recordset) { // send request
        if (recordset != null && recordset.length == 0) {
            console.log("group has no poi")
            callback(null);
        }
        else {
            console.log("poi list call back")
            callback(recordset);
        }
    }).catch(function (err) {
        console.log("err" + err);
        callback(null);
    });
}

exports.getUserGroupList = async function (search_id, coi, isOld = true) {
    var query2 = "SELECT [group_name],[group_id],[group_leader_id],[coi_name] FROM [MOE3].[dbo].[Groups] AS M LEFT JOIN [MOE3].[dbo].[GroupsMember] AS N ON M.[group_id] = N.[foreignkey_id] "
    if (isOld == false) {
        query2 = "SELECT [group_name] AS name,[group_name], [group_id] AS id, [group_id], [group_leader_id] AS leaderId, [group_leader_id],[coi_name] FROM [MOE3].[dbo].[Groups] AS M LEFT JOIN [MOE3].[dbo].[GroupsMember] AS N ON M.[group_id] = N.[foreignkey_id] "
    }
    var query1 = " WHERE [user_id_id] = " + search_id + " AND [coi_name] = '" + coi + "' "

    console.log("do query: " + query2 + query1);
    let recordset = await new db.Request().query(query2 + query1)
    // console.log(recordset)
    if (recordset.length == 0) {
        console.log("user has no group")
    } else if (isOld == false) {
        //To get events in user groups
        let result = getGroupEventList(recordset);
        recordset = result
        console.log("user group events list callback")
    }
    else {
        console.log("user group list callback")
    }
    return recordset;
}

//selet room after choice group
exports.getRoomList = function (group_id, callback) {

    console.log("call get room list")
    console.log("input group_id : " + group_id)

    var query2 = "SELECT [id],[room_name],[auto_start],[is_playing] FROM [MOE3].[dbo].[GameSetting]"
    var query1 = " WHERE [group_id_id] = " + group_id

    console.log("do query : " + query2 + query1);

    new db.Request().query(query2 + query1).then(function (recordset) {
        if (recordset.length == 0) {
            console.log("group has no room");
            callback(null);
        }
        else {
            console.log("group room list callback")
            callback(recordset);
        }
    }).catch(function (err) {
        console.log("err" + err);
        callback(null);
    });
}

exports.getGameData = function (game_id, callback) {

    console.log("call get game data")
    console.log("input game_id : " + game_id)

    var query1 = "SELECT [id],[start_time],[end_time],[play_time],[room_id_id] FROM [MOE3].[dbo].[GameHistory]"
    var query2 = " WHERE [id] = " + game_id


    console.log("do query : " + query1 + query2);

    new db.Request().query(query1 + query2).then(function (recordset) {
        if (recordset.length == 0) {
            console.log("game has no setting data")
            callback(null);
        }
        else {
            for (i = 0; i < recordset.length; i++) {
                recordset[i].is_playing = recordset[i].end_time
                var newDate = new Date()
                newDate.setTime(newDate.getTime() + 8 * 60 * 60 * 1000)
                var a = moment(newDate);
                var b = moment(recordset[i].end_time);
                recordset[i].end_time = (b.diff(a) / 1000) | 0
                recordset[i].start_time = newDate
            }
            console.log("game data callback")
            callback(recordset);
        }
    }).catch(function (err) {
        console.log("err" + err);
        callback(null);
    });
}

exports.getGameID = function (room_id, callback) {

    console.log("call get game id")
    console.log("input room_id : " + room_id)

    var query1 = "SELECT [is_playing] FROM [MOE3].[dbo].[GameSetting]"
    var query2 = " WHERE [id] = " + room_id
    var query3 = " AND [auto_start] = 0"
    var query4 = "SELECT [state] FROM [MOE3].[dbo].[GameHistory]"
    var query5 = " WHERE [state] = 1 AND [id] = "

    console.log("do query : " + query1 + query2);

    new db.Request().query(query1 + query2).then(function (recordset) {
        if (recordset.length == 0) {
            console.log("this room id is invaild or has no app start game ")
            callback(null);
        }
        else {
            console.log("chose room is_playing(game_id) callback")
            search_id = recordset[0].is_playing

            new db.Request().query(query4 + query5 + search_id).then(function (status_1) {
                if (status_1.length == 0) {
                    console.log("this game is not checking");
                    callback(recordset);
                }
                else {
                    console.log("this game is checking");
                    recordset[0].is_playing = -1
                    callback(recordset);
                }
            }).catch(function (err) {
                console.log("err" + err);
                callback(null);
            });
        }
    }).catch(function (err) {
        console.log("err" + err);
        callback(null);
    });
}

exports.getGameChest = function (game_id, user_id, callback) {

    console.log("call get game unanswered chest list")
    console.log("input game_id : " + game_id)
    console.log("input user_id : " + user_id)

    var query1_1 = "SELECT [id], [src_id], [lat], [lng], [num], [remain], [point], [distance], [question_type], [question]"
    var query1_2 = ", [option1], [option2], [option3], [option4], [hint1], [hint2], [hint3], [hint4], [answer], [game_id_id]"
    var query1_3 = ", [poi_id_id] FROM [MOE3].[dbo].[GameChestHistory] AS M"
    var query2 = " WHERE [game_id_id] = " + game_id
    var query3 = ""

    var query5 = "SELECT [chest_id_id] "
    var query6 = "FROM [MOE3].[dbo].[GameRecordHistory] AS A "
    var query7 = " WHERE A.[user_id_id] = " + user_id + " AND " + " A.[game_id_id] = " + game_id + " AND B.[question_type] != 5"
    var query8 = " RIGHT JOIN [MOE3].[dbo].[GameChestHistory] AS B ON B.[id] = A.[chest_id_id]"

    console.log("(first) do query : " + query5 + query6 + query8 + query7);

    new db.Request().query(query5 + query6 + query8 + query7).then(function (recordset1) {

        if (recordset1.length == 0) {
            console.log("(first) this user has no answer record");
            query3 = ""
        }
        else {
            console.log("(first) user has answer " + recordset1.length + " question in record");
            for (i = 0; i < recordset1.length; i++) {
                query3 = query3 + " AND M.[id] != " + recordset1[i].chest_id_id
            }
        }

        console.log("(second) do query : " + query1_1 + query1_2 + query1_3 + query2 + query3);

        new db.Request().query(query1_1 + query1_2 + query1_3 + query2 + query3).then(function (recordset2) {
            if (recordset2.length == 0) {
                console.log("(second) no chest for this user");
                callback(null);
            }
            else {
                console.log("(second) user chest list callback");
                callback(recordset2);
            }
        }).catch(function (err) {
            console.log("err" + err);
            callback(null);
        });

    }).catch(function (err) {
        console.log("err" + err);
        callback(null);
    });
}

exports.startGame = function (room_id, callback) {

    console.log("call start game")
    console.log("input room_id : " + room_id)

    var query1 = "EXEC  [MOE3].[dbo].[StartGame] @room_id = " + room_id

    console.log("do query : " + query1)

    new db.Request().query(query1).then(function () {

        console.log("start game finish");
        callback("finish");

    }).catch(function (err) {

        console.log("err" + err);
        callback(null);

    });
}

exports.chestMinus = function (chest_id, user_answer, user_id, game_id, callback) {
    console.log("call chest minus")
    console.log("input chest_id : " + chest_id)
    console.log("input user_id : " + user_id)
    console.log("input user_answer : " + user_answer)
    console.log("input game_id : " + game_id)

    var query0 = "SELECT [remain], [answer] FROM [MOE3].[dbo].[GameChestHistory] WHERE [id] =" + chest_id

    var query1 = "UPDATE [MOE3].[dbo].[GameChestHistory] SET [remain]=[remain]-1 WHERE [id] =" + chest_id

    var query5 = "SELECT [chest_id_id] "
    var query6 = "FROM [MOE3].[dbo].[GameRecordHistory] "
    var query7 = "WHERE [user_id_id] = " + user_id + " AND " + " [game_id_id] = " + game_id
    // + " AND " + " [game_id_id] = " + game_id

    console.log("(first) do query : " + query0)
    new db.Request().query(query0).then(function (recordset) {
        console.log("" + recordset[0].remain);
        if (recordset[0].remain != null) {
            console.log("(first) chest is not infinity need to check remain")
            if (recordset[0].remain > 0) {
                console.log("(first) chest still remain")
                console.log("(second) do query : " + query5 + query6 + query7)
                new db.Request().query(query5 + query6 + query7).then(function (user_already_answer) {
                    var has_answer = false;
                    for (i = 0; i < user_already_answer.length; i++) {
                        if (chest_id == user_already_answer[i].chest_id_id) {
                            console.log("(second) user already answer : " + user_already_answer[i].chest_id_id);
                            has_answer = true;
                            break;
                        }
                    }
                    if (has_answer) {
                        callback("already answer");
                    }
                    else {
                        if (user_answer == recordset[0].answer) {
                            console.log("(second) user answer is right")
                            console.log("(third) do query : " + query1)
                            new db.Request().query(query1).then(function () {
                                console.log("(third) chest remain minus 1");
                                callback("answer is right");
                            }).catch(function (err) {
                                console.log("err" + err);
                                callback(null);
                            });
                        }
                        else {
                            console.log("(second) user answer is wrong");
                            callback("answer is wrong");
                        }
                    }
                });
            }
            else {
                console.log("(first) chest is empty")
                callback("chest is empty");
            }
        }
        else {
            console.log("(first) chest is infinity ")
            console.log("(second) do query : " + query5 + query6 + query7)
            new db.Request().query(query5 + query6 + query7).then(function (user_already_answer) {
                var has_answer = false;
                for (i = 0; i < user_already_answer.length; i++) {
                    if (chest_id == user_already_answer[i].chest_id_id) {
                        console.log("(second) user already answer : " + user_already_answer[i].chest_id_id);
                        has_answer = true;
                        break;
                    }
                }
                if (has_answer) {
                    callback("already answer");
                }
                else {
                    if (user_answer == recordset[0].answer) {
                        console.log("(second) answer is right")
                        callback("answer is right");
                    }
                    else {
                        console.log("(second) answer is wrong")
                        callback("answer is wrong");
                    }
                }
            });
        }
    });
}

exports.insertAnswer = function (record, callback) {
    console.log("call insert answer record")
    console.log("input user record : " + record)

    var query1 = "INSERT INTO [MOE3].[dbo].[GameRecordHistory] (user_id_id, answer, answer_time, correctness, chest_id_id, game_id_id, lat, lng, point)"
    var query2 = " VALUES (" + record["user_id_id"] + ", '" + record["answer"] + "' ," + "CURRENT_TIMESTAMP" + "," + record["correctness"] + "," + record["chest_id_id"] + "," + record["game_id_id"] + "," + record["lat"] + "," + record["lng"] + "," + record["point"] + ")"

    console.log("do query : " + query1 + query2)
    new db.Request().query(query1 + query2).then(function () {
        console.log("insertAnswer finish");
        callback("finish");
    }).catch(function (err) {
        console.log("err" + err);
        console.log("cannot insertAnswer because already answer")
        callback("already answer");
    });
}

exports.getAnsRecord = function (user_id, game_id, callback) {

    console.log("call get answer record")
    console.log("input user_id : " + user_id)
    console.log("input game_id : " + game_id)

    var query1 = "SELECT [chest_id_id],[question], A.[answer],B.[question_type],[option1],[option2],[option3],[option4], [correctness],A.[point] "
    var query2 = " FROM [MOE3].[dbo].[GameRecordHistory] AS A"
    var query3 = " WHERE [user_id_id] = " + user_id + " AND " + " A.[game_id_id] = " + game_id + " AND B.[question_type] != 4"
    //+ " AND " + " A.[game_id_id] = " + game_id
    var query4 = " RIGHT JOIN [MOE3].[dbo].[GameChestHistory] AS B ON B.[id] = A.[chest_id_id]"

    console.log("do query : " + query1 + query2 + query4 + query3);
    new db.Request().query(query1 + query2 + query4 + query3).then(function (recordset) {
        if (recordset.length == 0) { callback(null); }
        else {
            for (i = 0; i < recordset.length; i++) {
                if (recordset[i].correctness == true) {
                    recordset[i].correctness = 1
                }
                if (recordset[i].correctness == false) {
                    recordset[i].correctness = 0
                }
            }
            callback(recordset);
        }

    }).catch(function (err) {
        console.log("err" + err);
        callback(null);
    });

}

exports.getChestMedia = function (chest_id, callback) {

    console.log("call get chest media")
    console.log("input user src_id : " + chest_id)

    var query1 = " SELECT [ATT_id],[ATT_url],[ATT_format] FROM [MOE3].[dbo].[GameATTHistory]"
    var query2 = " WHERE [chest_id_id] = " + chest_id

    console.log("do query : " + query1 + query2);
    new db.Request().query(query1 + query2).then(function (recordset) {
        if (recordset.length == 0) { callback(null); }
        else {
            for (i = 0; i < recordset.length; i++) {
                recordset[i].ATT_url = media_url_title + recordset[i].ATT_url
            }
            callback(recordset);
        }
    }).catch(function (err) {
        console.log("err" + err);
        callback(null);
    });

}

exports.uploadMedia = function (content, callback) {

    var type01 = content["type01"];
    var filename01 = content["file_name01"]
    var url01 = content["url01"]

    var type02 = content["type02"];
    var filename02 = content["file_name02"]
    var url02 = content["url02"]

    var type03 = content["type03"];
    var filename03 = content["file_name03"]
    var url03 = content["url03"]

    var type04 = content["type04"];
    var filename04 = content["file_name04"]
    var url04 = content["url04"]

    var type05 = content["type05"];
    var filename05 = content["file_name05"]
    var url05 = content["url05"]

    var user_id = content["user_id"];
    var chest_id = content["chest_id"];
    var txt = content["txt"];
    var game_id = content["game_id"]
    var lat = content["lat"]
    var lng = content["lng"]

    console.log("call uploadMedia")
    console.log("input user_id : " + user_id)
    console.log("input chest_id : " + chest_id)
    console.log("input txt : " + txt)


    // insert into mpeg table
    var keys = " answer, answer_time, correctness, game_id_id, user_id_id, chest_id_id, lat, lng, point";
    var query1 = "INSERT INTO [MOE3].[dbo].[GameRecordHistory] (" + keys + ") VALUES ( '" + txt + "', " + " CURRENT_TIMESTAMP " + ", " + "NULL" + ", " + game_id + ", " + user_id + ", " + chest_id + "," + lat + "," + lng + ",NULL)";
    console.log("query: " + query1);
    new db.Request().query(query1).then(function (recordset) { // send request
        console.log("db store successfully!");

        if (filename01) {
            var keys01 = " ATT_url, ATT_upload_time, ATT_format, record_id_id ";
            var query01 = "INSERT INTO [MOE3].[dbo].[GameATTRecord] (" + keys01 + ") ";
            var query02 = "SELECT '" + url01 + "', answer_time, '" + type01 + "', id FROM [MOE3].[dbo].[GameRecordHistory] ";
            var query03 = "WHERE game_id_id=" + game_id + " AND user_id_id=" + user_id + " AND chest_id_id=" + chest_id;
            console.log("query: " + query01 + query02 + query03);
            new db.Request().query(query01 + query02 + query03).then(function (recordset) { // send request
                console.log("db store media successfully!");
            });
        }
        if (filename02) {
            var keys01 = " ATT_url, ATT_upload_time, ATT_format, record_id_id ";
            var query01 = "INSERT INTO [MOE3].[dbo].[GameATTRecord] (" + keys01 + ") ";
            var query02 = "SELECT '" + url02 + "', answer_time, '" + type02 + "', id FROM [MOE3].[dbo].[GameRecordHistory] ";
            var query03 = "WHERE game_id_id=" + game_id + " AND user_id_id=" + user_id + " AND chest_id_id=" + chest_id;
            console.log("query: " + query01 + query02 + query03);
            new db.Request().query(query01 + query02 + query03).then(function (recordset) { // send request
                console.log("db store media successfully!");

            });
        }
        if (filename03) {
            var keys01 = " ATT_url, ATT_upload_time, ATT_format, record_id_id ";
            var query01 = "INSERT INTO [MOE3].[dbo].[GameATTRecord] (" + keys01 + ") ";
            var query02 = "SELECT '" + url03 + "', answer_time, '" + type03 + "', id FROM [MOE3].[dbo].[GameRecordHistory] ";
            var query03 = "WHERE game_id_id=" + game_id + " AND user_id_id=" + user_id + " AND chest_id_id=" + chest_id;
            console.log("query: " + query01 + query02 + query03);
            new db.Request().query(query01 + query02 + query03).then(function (recordset) { // send request
                console.log("db store media successfully!");

            });
        }
        if (filename04) {
            var keys01 = " ATT_url, ATT_upload_time, ATT_format, record_id_id ";
            var query01 = "INSERT INTO [MOE3].[dbo].[GameATTRecord] (" + keys01 + ") ";
            var query02 = "SELECT '" + url04 + "', answer_time, '" + type04 + "', id FROM [MOE3].[dbo].[GameRecordHistory] ";
            var query03 = "WHERE game_id_id=" + game_id + " AND user_id_id=" + user_id + " AND chest_id_id=" + chest_id;
            console.log("query: " + query01 + query02 + query03);
            new db.Request().query(query01 + query02 + query03).then(function (recordset) { // send request
                console.log("db store media successfully!");

            });
        }
        if (filename05) {
            var keys01 = " ATT_url, ATT_upload_time, ATT_format, record_id_id ";
            var query01 = "INSERT INTO [MOE3].[dbo].[GameATTRecord] (" + keys01 + ") ";
            var query02 = "SELECT '" + url05 + "', answer_time, '" + type05 + "', id FROM [MOE3].[dbo].[GameRecordHistory] ";
            var query03 = "WHERE game_id_id=" + game_id + " AND user_id_id=" + user_id + " AND chest_id_id=" + chest_id;
            console.log("query: " + query01 + query02 + query03);
            new db.Request().query(query01 + query02 + query03).then(function (recordset) { // send request
                console.log("db store media successfully!");

            });
        }
        callback("upload scuess")

    }).catch(function (err) {
        console.log('err: ' + err);
        callback(null);
    });
}

exports.getMenberPointList = function (game_id, callback) {

    console.log("call get Member list point list")
    console.log("input game_id : " + game_id)

    var query1 = " SELECT [correctness], [user_id_id], [point], N.[nickname], [answer_time] FROM [MOE3].[dbo].[GameRecordHistory] AS M"
    var query2 = "  LEFT JOIN [MOE3].[dbo].[user_profile] AS N ON M.[user_id_id] = N.[user_id]"
    var query3 = " WHERE M.[game_id_id] = " + game_id

    console.log("do query : " + query1 + query2 + query3);
    new db.Request().query(query1 + query2 + query3).then(function (recordset) {
        if (recordset.length == 0) { callback(null); }
        else {
            callback(recordset);
        }
    }).catch(function (err) {
        console.log("err" + err);
        callback(null);
    });

}

exports.getGameList = function (room_id, callback) {

    console.log("call get game history list")
    console.log("input game_id : " + room_id)

    var query1 = " SELECT [id], [start_time] FROM [MOE3].[dbo].[GameHistory]"

    var query2 = " WHERE [room_id_id] = " + room_id


    console.log("do query : " + query1 + query2);
    new db.Request().query(query1 + query2).then(function (recordset) {
        if (recordset.length == 0) { callback(null); }
        else {
            callback(recordset);
        }
    }).catch(function (err) {
        console.log("err" + err);
        callback(null);
    });

}


exports.endGame = function (game_id, callback) {

    console.log("call end game")
    console.log("input game_id : " + game_id)

    var query1 = " UPDATE [MOE3].[dbo].[GameHistory] SET [end_time] = CURRENT_TIMESTAMP"

    var query2 = " WHERE [id] = " + game_id


    console.log("do query : " + query1 + query2);
    new db.Request().query(query1 + query2).then(function (recordset) {
        callback("finish");
    }).catch(function (err) {
        console.log("err" + err);
        callback(null);
    });

}

async function getGroupEventList(group_list) {
    console.log('call get group event list')

    query1 = "SELECT DISTINCT [event_id_id] from [MOE3].[dbo].[EventsGroup] WHERE [group_id_id] = " + group_list[0].id
    for (i = 0; i < group_list.length; i++) {
        query1 += " OR [group_id_id] = "
        query1 += group_list[i].id
    }
    console.log("do query : " + query1)
    let recordset = await new db.Request().query(query1)


    if (recordset.length != 0) {
        query = "SELECT [Event_name] AS name,[Event_id] AS id, [Event_leader_id] AS leaderId, [Event_leader_id] AS leader_id, [start_time], [end_time] FROM [MOE3].[dbo].[Events] "
        cond = "WHERE ([Event_id] IN (" + recordset[0].event_id_id
        for (i = 1; i < recordset.length; i++) {
            cond += " ," + recordset[i].event_id_id
        }
        cond += "))"
        console.log("do query : " + query + cond)
        let result = await new db.Request().query(query + cond)
        recordset = result
        console.log("group events callback")
    } else {
        console.log("group has no events")
    }
    return recordset
}


//hiwang for exchange prize
exports.getPrize = async function (search_id) {
    // console.log('call get user prize list');
    // console.log('input search_id(user_id) : ' + search_id);

    var query2 = "SELECT [PTP_id],[start_time],[player_prize_id] FROM [MOE3].[dbo].[prize_to_player]"
    var query1 = " WHERE [user_id_id] = " + search_id

    console.log("do query: " + query2 + query1);
    try {
        let recordset = await new db.Request().query(query2 + query1)
        if (recordset.length == 0) {
            // console.log("user has no prize")       
        }
        else {
            // console.log("user prize list callback")
        }
        return recordset
    } catch (err) {
        console.log("err" + err);
    }

}

exports.getPrizeAttribute = async function (search_id) {
    //console.log('call get user prize attribute');
    //console.log('input search_id(player_prize_id) : ' + search_id);

    var query2 = "SELECT [prize_name],[prize_url] FROM [MOE3].[dbo].[prize_profile]"
    var query1 = " WHERE [prize_id] = " + search_id

    console.log("do query: " + query2 + query1);

    try {
        let recordset = await new db.Request().query(query2 + query1)
        if (recordset.length == 0) {
            //console.log("No prize")
        }
        else {
            // console.log("user prize list callback")
        }
        return recordset
    } catch (err) {
        console.log("err" + err);
    }
}

exports.getPrizeDistributed = async function (game_id, room_id, user_id, rank) {
    console.log('user prize distribute');
    console.log('input game_id : ' + game_id);
    console.log('input room_id : ' + room_id);
    console.log('input user_id : ' + user_id);
    console.log('input rank : ' + rank);


    var game_prize_detail = ""
    var split_prize_detail = ""
    var select_idx = rank * 3 - 1
    var prize_amount = 0
    var prize_id = 0
    var award_name = ""
    var start_time = ""
    var end_time = ""
    var play_time = ""
    var ptp_id = 0

    var query2 = "SELECT [game_prize_detail] FROM [MOE3].[dbo].[GameSetting]"
    var query1 = " WHERE [id] = " + room_id

    var query4 = "SELECT [start_time], [end_time], [play_time] FROM [MOE3].[dbo].[GameHistory]"
    var query3 = " WHERE [id] = " + game_id

    var query6 = "SELECT [start_time], [user_id_id] FROM [MOE3].[dbo].[prize_to_player]"


    var query8 = "SET IDENTITY_INSERT [MOE3].[dbo].[prize_to_player] ON;"
    var query10 = "INSERT INTO [MOE3].[dbo].[prize_to_player] ( PTP_id, player_prize_id, prize_amount, start_time, end_time, play_time, is_exchanged, room_id_id, user_id_id)"
    var query11 = "SET IDENTITY_INSERT [MOE3].[dbo].[prize_to_player] OFF;"


    var query9 = "SELECT MAX([PTP_id]) FROM [MOE3].[dbo].[prize_to_player]"

    console.log("do query: " + query2 + query1);

    try {
        let recordset1 = await new db.Request().query(query2 + query1)

        if (recordset1.length == 0) {
            console.log("Can't distribute prize")
            return null;
        }
        else {
            // console.log("user prize list callback");
            game_prize_detail = recordset1[0]['game_prize_detail'];
            console.log(game_prize_detail);
            split_prize_detail = game_prize_detail.split(",");
            if (select_idx > split_prize_detail.length) {
                return null;
            }
            prize_amount = parseInt(split_prize_detail[select_idx], 10);
            prize_id = parseInt(split_prize_detail[select_idx - 1], 10);
            award_name = split_prize_detail[select_idx - 2];
            console.log(prize_amount);
            console.log(prize_id);
            console.log(award_name);

            let recordset2 = await new db.Request().query(query4 + query3)
            if (recordset2.length == 0) {
                console.log("No prize")
                return recordset1;
            }
            else {
                // console.log("user prize list callback")
                start_time = recordset2[0]['start_time'].toString()
                end_time = recordset2[0]['end_time'].toString()
                play_time = recordset2[0]['play_time']
                // start_time = String(start_time)
                // end_time = String(end_time)
                console.log(start_time);
                console.log(end_time);
                console.log(play_time);
                var query5 = " WHERE  [start_time] = " + "'" + start_time + "'" + " AND [user_id_id] = " + user_id
                let recordset3 = await new db.Request().query(query6 + query5)
                if (recordset3.length == 0) {
                    console.log("Need to insert the prize distribution")
                    let recordset4 = await new db.Request().query(query9)
                    if (recordset4.length != 0) {
                        ptp_id = recordset4[0][''] + 1
                        console.log(ptp_id)
                        var query7 = " VALUES(" + ptp_id + "," + prize_id + "," + prize_amount + "," + "'" + start_time + "'" + "," + "'" + end_time + "'" + "," + "'" + play_time + "'" + "," + "0" + "," + room_id + "," + user_id + ");"
                        console.log(query8 + query10 + query7 + query11)
                        let recordset5 = await new db.Request().query(query8 + query10 + query7 + query11)
                    }
                }
                else {
                    console.log("Prize distribution already complete")
                }
            }
            return recordset1;
        }
    } catch (err) {
        console.log("err" + err);
        return null;
    }
    /*
    new db.Request().query(query2 + query1).then(function (recordset1) {
        if (recordset1.length == 0) {
            console.log("Can't distribute prize")
            callback(null);
        }
        else {
            console.log("user prize list callback");
            game_prize_detail = recordset1[0]['game_prize_detail'];
            console.log(game_prize_detail);
            split_prize_detail = game_prize_detail.split(",");
            if (select_idx > split_prize_detail.length) {
                callback(null)
            }
            prize_amount = parseInt(split_prize_detail[select_idx], 10);
            prize_id = parseInt(split_prize_detail[select_idx - 1], 10);
            award_name = split_prize_detail[select_idx - 2];
            console.log(prize_amount);
            console.log(prize_id);
            console.log(award_name);

            new db.Request().query(query4 + query3).then(function (recordset2) {
                if (recordset2.length == 0) {
                    console.log("No prize")
                    callback(recordset1);
                }
                else {
                    console.log("user prize list callback")
                    start_time = recordset2[0]['start_time'].toString()
                    end_time = recordset2[0]['end_time'].toString()
                    play_time = recordset2[0]['play_time']
                    // start_time = String(start_time)
                    // end_time = String(end_time)
                    console.log(start_time);
                    console.log(end_time);
                    console.log(play_time);
                    var query5 = " WHERE  [start_time] = " + "'" + start_time + "'" + " AND [user_id_id] = " + user_id
                    new db.Request().query(query6 + query5).then(function (recordset3) {
                        if (recordset3.length == 0) {
                            console.log("Need to insert the prize distribution")
                            new db.Request().query(query9).then(function (recordset4) {
                                if (recordset4.length != 0) {
                                    ptp_id = recordset4[0][''] + 1
                                    console.log(ptp_id)
                                    var query7 = " VALUES(" + ptp_id + "," + prize_id + "," + prize_amount + "," + "'" + start_time + "'" + "," + "'" + end_time + "'" + "," + "'" + play_time + "'" + "," + "0" + "," + room_id + "," + user_id + ");"
                                    console.log(query8 + query10 + query7 + query11)
                                    new db.Request().query(query8 + query10 + query7 + query11).then(function (recordset5) {
                                    }).catch(function (err) {
                                        console.log("err" + err);
                                    });
                                }
                            }).catch(function (err) {
                                console.log("err" + err);
                                callback(null);
                            });
                        }
                        else {
                            console.log("Prize distribution already complete")
                        }
                    }).catch(function (err) {
                        console.log("err" + err);
                        callback(null);
                    });

                }
            }).catch(function (err) {
                console.log("err" + err);
                callback(null)
            });
            callback(recordset1);
        }
    }).catch(function (err) {
        console.log("err" + err);
        callback(null);
    });*/
}