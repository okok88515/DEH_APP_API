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

exports.GroupPOIs = async function (group_id) {

    //console.log('call get group poi list');
    //console.log('input group_id : ' + group_id);

    var query0 = "SELECT [POI_id],[POI_title],[latitude],[longitude] FROM [MOE3].[dbo].[dublincore] AS M"
    var query1 = " FULL OUTER JOIN [MOE3].[dbo].[GroupsPoint] AS N ON N.[point_id] = M.[POI_id]"
    var query2 = " WHERE [foreignkey_id] = " + group_id

    console.log("do query : " + query0 + query1 + query2);
    try {
        let recordset = await new db.Request().query(query0 + query1 + query2)
        if (recordset != null && recordset.length == 0) {
            console.log("group has no poi")
            return null
            //callback(null);
        }
        else {
            // console.log("poi list call back")
            return recordset
            //callback(recordset);
        }
    } catch (err) {
        console.log("err" + err);
    }
    // new db.Request().query(query0 + query1 + query2).then(function (recordset) { // send request
    //     if (recordset != null && recordset.length == 0) {
    //         console.log("group has no poi")
    //         callback(null);
    //     }
    //     else {
    //         console.log("poi list call back")
    //         callback(recordset);
    //     }
    // }).catch(function (err) {
    //     console.log("err" + err);
    //     callback(null);
    // });
}

exports.getUserGroupList = async function (search_id, coi, isOld = true) {
    query = "SELECT [Event_name],[Event_id],[Event_leader_id], [start_time], [end_time] FROM [MOE3].[dbo].[Events] "
    if (isOld == false) {
        query = "SELECT [Event_name] AS name,[Event_id] AS id,[Event_leader_id] AS leaderId, [start_time], [end_time] FROM [MOE3].[dbo].[Events] "
    }
    cond1 = "WHERE [coi_name] = '" + coi + "'" + "AND [open] = '1'"
    var query2 = "SELECT [Event_name],[Event_id],[Event_leader_id],[coi_name] FROM [MOE3].[dbo].[Events] AS M LEFT JOIN [MOE3].[dbo].[EventsMember] AS N ON M.[event_id] = N.[foreignkey_id] "
    var query1 = " WHERE [user_id_id] = " + search_id + " AND [coi_name] = '" + coi + "' "

    console.log("do query: " + query + cond1);

    let recordset = await new db.Request().query(query + cond1)
    //console.log(recordset)
    var currentAvaliableEvent = []
    if (recordset.length == 0) {
        console.log("user has no event")
    }
    else {

        for (i = 0; i < recordset.length; i++) {
            var newDate = new Date()
            //GMT+8
            newDate.setTime(newDate.getTime() + 8 * 60 * 60 * 1000)
            var currentTime = moment(newDate);
            var startTime = moment(recordset[i].start_time);
            var endTime = moment(recordset[i].end_time);
            recordset[i].leader_id = recordset[i].leaderId
            if (currentTime.isAfter(startTime) && currentTime.isBefore(endTime)) {
                currentAvaliableEvent.push(recordset[i])
            }
        }
    }
    return currentAvaliableEvent

}

//selet room after choice group
exports.getRoomList = async function (group_id) {

    //console.log("call get room list")
    //console.log("input group_id : " + group_id)

    var query2 = "SELECT [id],[room_name],[auto_start],[is_playing],[start_time],[end_time] FROM [MOE3].[dbo].[EventSetting]"
    var query1 = " WHERE [event_id_id] = " + group_id

    console.log("do query : " + query2 + query1);

    try {
        let recordset = await new db.Request().query(query2 + query1)

        if (recordset.length == 0) {
            console.log("group has no room");
            return null
            // callback(null);
        }
        else {
            for (i = 0; i < recordset.length; i++) {
                var newDate = new Date()
                //GMT+8
                newDate.setTime(newDate.getTime() + 8 * 60 * 60 * 1000)
                var currentTime = moment(newDate);
                var startTime = moment(recordset[i].start_time);
                var endTime = moment(recordset[i].end_time);
                if (currentTime.isBefore(startTime)) {
                    recordset[i].status = "before game"
                }
                else if (currentTime.isAfter(endTime)) {
                    recordset[i].status = "after game"
                }
                else if (currentTime.isAfter(startTime)) {
                    recordset[i].status = "during game"
                }
                else {
                    recordset[i].status = "null game"
                }
            }
        }
        return recordset
    } catch (err) {
        console.log("err" + err);
    }
    // new db.Request().query(query2 + query1).then(function (recordset) {
    //     if (recordset.length == 0) {
    //         console.log("group has no room");
    //         callback(null);
    //     }
    //     else {
    //         for (i = 0; i < recordset.length; i++) {
    //             var newDate = new Date()
    //             //GMT+8
    //             newDate.setTime(newDate.getTime() + 8 * 60 * 60 * 1000)
    //             var currentTime = moment(newDate);
    //             var startTime = moment(recordset[i].start_time);
    //             var endTime = moment(recordset[i].end_time);
    //             if (currentTime.isBefore(startTime)) {
    //                 recordset[i].status = "before game"
    //             }
    //             else if (currentTime.isAfter(endTime)) {
    //                 recordset[i].status = "after game"
    //             }
    //             else if (currentTime.isAfter(startTime)) {
    //                 recordset[i].status = "during game"
    //             }
    //             else {
    //                 recordset[i].status = "null game"
    //             }

    // console.log(endTime)
    // console.log(endTime.diff(currentTime)/1000)
    // recordset[i].end_time = (endTime.diff(currentTime)/1000)|0
    // recordset[i].start_time = newDate
    // }
    //console.log(recordset)
    //console.log("group room list callback")
    // callback(recordset);
    //     }
    // }).catch(function (err) {
    //     console.log("err" + err);
    //     callback(null);
    // });
}

// exports.getGameData = function (game_id, callback) {

//     console.log("call get game data")
//     console.log("input game_id : " + game_id)

//     // var query1 = "SELECT [id],[start_time],[end_time],[play_time],[room_id_id] FROM [MOE3].[dbo].[EventHistory]"
//     var query1 = "SELECT [id],[start_time],[end_time],[play_time],[event_id_id] FROM [MOE3].[dbo].[EventSetting]"
//     var query2 = " WHERE [id] = " + game_id


//     console.log("do query : " + query1 + query2);

//     new db.Request().query(query1 + query2).then(function (recordset) {
//         if (recordset.length == 0) {
//             console.log("game has no setting data")
//             callback(null);
//         }
//         else {
//             /*for (i = 0; i < recordset.length; i++) {
//                 //recordset[i].is_playing = recordset[i].end_time
//                 var newDate = new Date()
//                 //GMT+8
//                 newDate.setTime(newDate.getTime() + 8 * 60 * 60 * 1000)
//                 var a = moment(newDate);
//                 var b = moment(recordset[i].end_time);
//                 recordset[i].end_time = (b.diff(a) / 1000) | 0
//                 recordset[i].start_time = newDate
//             }*/
//             console.log("game data callbak")
//             console.log(recordset)
//             callback(recordset);
//         }
//     }).catch(function (err) {
//         console.log("err" + err);
//         callback(null);
//     });
// }
exports.getGameData = async function (room_id) {
    //如果存在進行中的遊戲，回傳event資料跟game_id，沒有進行中的話game_id是-1
    //console.log("call get game data")
    //console.log("input game_id : " + game_id)

    // var query1 = "SELECT [id],[start_time],[end_time],[play_time],[room_id_id] FROM [MOE3].[dbo].[EventHistory]"
    var query = `
    SELECT TOP 1 A.[id], A.[start_time], A.[end_time], A.[play_time], A.[event_id_id], COALESCE(B.[id], -1) AS [game_id_id], B.[state]
    FROM [MOE3].[dbo].[EventSetting] AS A
    LEFT JOIN [MOE3].[dbo].[EventHistory] AS B 
    ON A.[id] = B.[room_id_id] AND B.[end_time] > GETDATE()
    WHERE A.[id] = ${room_id}
    ORDER BY B.[id] DESC
    `
    //var query2 = " WHERE [id] = " + room_id


    console.log("do query : " + query);
    try {
        let recordset = await new db.Request().query(query)
        if (recordset.length == 0) {
            console.log("game has no setting data")
        }
        else {
            //console.log(recordset)
        }
        return recordset
    } catch (err) {
        console.log("sql error: " + err)
    }
}
exports.getGameID = async function (room_id) {

    //console.log("call get game id")
    //console.log("input room_id : " + room_id)

    var query1 = "SELECT [is_playing] FROM [MOE3].[dbo].[EventSetting]"
    var query2 = " WHERE [id] = " + room_id
    var query3 = " AND [auto_start] = 0"
    var query4 = "SELECT [state] FROM [MOE3].[dbo].[EventHistory]"
    var query5 = " WHERE [state] = 2 AND [id] = "

    console.log("do query : " + query1 + query2);

    try {
        let recordset = await new db.Request().query(query1 + query2)
        if (recordset.length == 0) {
            console.log("this room id is invaild or has no app start game ")
            return null
            // callback(null);
        }
        else {
            console.log("chose room is_playing(game_id) callback")
            search_id = recordset[0].is_playing

            let status_1 = await new db.Request().query(query4 + query5 + search_id)
            if (status_1.length == 0) {
                console.log("this game is not checking");
                return recordset
                // callback(recordset);
            }
            else {
                console.log("this game is checking");
                recordset[0].is_playing = -1
                return recordset
                // callback(recordset);
            }
        }
    } catch (err) {
        console.log("err" + err);
    }
    // new db.Request().query(query1 + query2).then(function (recordset) {
    //     if (recordset.length == 0) {
    //         console.log("this room id is invaild or has no app start game ")
    //         callback(null);
    //     }
    //     else {
    //         console.log("chose room is_playing(game_id) callback")
    //         search_id = recordset[0].is_playing


    //         new db.Request().query(query4 + query5 + search_id).then(function (status_1) {
    //             if (status_1.length == 0) {
    //                 console.log("this game is not checking");
    //                 callback(recordset);
    //             }
    //             else {
    //                 console.log("this game is checking");
    //                 recordset[0].is_playing = -1
    //                 callback(recordset);
    //             }
    //         }).catch(function (err) {
    //             console.log("err" + err);
    //             callback(null);
    //         });
    //     }
    // }).catch(function (err) {
    //     console.log("err" + err);
    //     callback(null);
    // });
}

exports.getGameChest = async function (room_id, user_id) {
    //拿回所有的寶箱 但答過的沒有 remain 0的也沒有
    //第一次有人答題之前在EventChestHistory裡面沒有資料 所以remain會是null
    //先從EventChestSetting撈所有題目 然後排除EventRecordHistory中已有的答題紀錄
    //console.log("call get game unanswered and remained chest list")
    var query =
        `
    SELECT A.[id], A.[lat], A.[lng], A.[num], B.[remain], A.[point], A.[distance], A.[question_type],
        A.[question], A.[option1], A.[option2], A.[option3], A.[option4], A.[hint1], A.[hint2],
        A.[hint3], A.[hint4], A.[answer], A.[room_id_id], A.[poi_id_id]
        FROM [MOE3].[dbo].[EventChestSetting] AS A
        LEFT JOIN [MOE3].[dbo].[EventHistory] AS C
        ON A.[room_id_id] = C.[room_id_id]
        LEFT JOIN [MOE3].[dbo].[EventChestHistory] AS B
        ON A.[id] = B.[src_id] AND B.[game_id_id] = C.[id] 
    
        WHERE A.[room_id_id] =${room_id}
        AND A.[id] NOT IN (
            SELECT [chest_id_id] FROM [MOE3].[dbo].[EventRecordHistory]
            WHERE [game_id_id] = C.[id] AND [user_id_id] = ${user_id}
        )
        AND (B.[remain] > 0 OR B.[remain] IS NULL)
        AND (B.[game_id_id] = C.[id] OR B.[game_id_id] IS NULL)
        AND C.[end_time]  > GETDATE()
    `
    console.log(" do query : \n" + query)
    try {
        var recordset = await new db.Request().query(query)
    } catch (err) {
        console.log("sql error: " + err)
    }

    if (recordset == null || recordset.length == 0) console.log("no chest for this user")  // 須檢查此行code
    return recordset
}
exports.startGame = async function (room_id, user_id) {
    //需要有user_id
    //不會多次startGame 多次的sql不會嚴重影響效能
    //console.log("call start game")
    //1.先檢查是不是owner或授權者 不是的話直接return
    //var query = `select A.event_leader_id from [MOE3].[dbo].[Events] as A join [MOE3].[dbo].[EventSetting] as B ON A.Event_id = B.event_id_id where B.id = ${room_id}`
    var query = `select A.[user_id_id], B.[id] AS [room_id_id], A.[identifier], A.[found_question],
     A.[evaluate_question], A.[enable_activity], B.[auto_start]
    from [MOE3].[dbo].[EventsMember] as A join [MOE3].[dbo].[EventSetting] as B ON A.[event_id_id] = B.[event_id_id] 
    where B.[id] = ${room_id}
    and A.[user_id_id] = ${user_id}
    `
    console.log("do query : " + query)
    try {
        var recordset = await new db.Request().query(query)
        if (recordset != null && recordset[0].enable_activity != 1 && recordset[0].identifier != 'leader' && recordset[0].auto_start != 1) return "failed"
    } catch (err) {
        console.log("sql error : " + err)
    }


    // console.log("input room_id : " + room_id)
    // var query1 = " UPDATE [MOE3].[dbo].[EventSetting] SET [start_time] = CURRENT_TIMESTAMP, [end_time] = DATEADD(n,30,CURRENT_TIMESTAMP), [is_playing] = 400"
    //2.檢查遊戲是否進行中 不使用is_playing判斷 但值必須要保持正確
    var query = `select case when [end_time] < GETDATE() OR [end_time] is NULL then 1 else 0 end as 'notPlaying' from [MOE3].[dbo].[EventSetting] where id = ${room_id}`
    console.log("do query : " + query)
    var recordset = await new db.Request().query(query)
    if (recordset[0].notPlaying == 0) return "failed"

    //3.如果不在進行中 就可以開始 先將EventSetting的值換掉 


    var query1 = " UPDATE [MOE3].[dbo].[EventSetting] SET [start_time] = CURRENT_TIMESTAMP, [end_time] = DATEADD(n,30,CURRENT_TIMESTAMP), [play_time] = 30, [is_playing] = 1"
    var query2 = " WHERE [id] = " + room_id
    console.log("do query : " + query1 + query2);
    await new db.Request().query(query1 + query2)

    console.log("Insert into EventHistory");
    //同一場次只能被開始一次 state 0=正在進行 1=批改中 2=已結束
    var query3 = "INSERT INTO [MOE3].[dbo].[EventHistory] (start_time, end_time, play_time, state,room_id_id)"
    var query4 = " SELECT [start_time], [end_time], [play_time], 0 ,[id] FROM [MOE3].[dbo].[EventSetting]"
    var query5 = " WHERE [id] = " + room_id
    await new db.Request().query(query3 + query4 + query5)
    //console.log("insertEventHistory finish");
    return "finish"
}

exports.chestMinus = async function (chest_id, user_answer, user_id, game_id, lat, lng) {
    //如果未答過此題，將存在EventChestHistory的chest remain數量-1 如果不存在chest則新增chest進去
    //最後將答案塞進EventRecordHistory 下次才能判斷有沒有答過
    //邏輯有冗餘 但不好整理
    //console.log("call chest minus")
    //1.判斷還有沒有剩寶箱
    var query = `select [remain] from [MOE3].[dbo].[EventChestHistory] where src_id = ${chest_id} and game_id_id =${game_id}`
    console.log("do query:" + query)
    var recordset = await new db.Request().query(query)
    if (recordset.length > 0)
        if (typeof (recordset[0].remain) != "undefined")
            if (recordset[0].remain == 0) return "chest is empty"

    //2.有剩的話插入answer到EventRecordHistory 插不進去代表答過了    
    //將問答題的correctness設定為null
    query = `
    INSERT INTO [MOE3].[dbo].[EventRecordHistory] 
    (chest_id_id, lat, lng, point, user_id_id,  game_id_id, answer, answer_time, correctness )
    select [id], ${lat}, ${lng}, [point], ${user_id}, ${game_id},  '${user_answer}', SYSDATETIME(), 
    case 
    when [answer] = '${user_answer}'  then 1 
    when [question_type] >= 3 then null
    else 0 
    end as [correctness] 
    FROM [MOE3].[dbo].[EventChestSetting] where [id] = ${chest_id}
    `
    console.log('do query :' + query)
    try {
        recordset = await new db.Request().query(query)
        //console.log(recordset)
    } catch (err) {
        //2627是違反唯一約束 2601是重複資料
        if (err.number === 2627 || err.number === 2601) {
            console.log("already answer")
            return "already answer"
        }
        console.error('SQL error: ' + err)
    }

    //3.撈record的correctness 答對才扣remain 第四步有檢查答案 不需要回傳值的話可以跳過
    query = `select [answer] from [MOE3].[dbo].[EventChestSetting] 
    where [id] = ${chest_id}`
    console.log('do query :' + query)
    try {
        recordset = await new db.Request().query(query)
        if (recordset[0].answer != user_answer) return "answer is wrong"
    } catch (err) {
        console.error('SQL error: ' + err)
    }
    //4.如果在EventRecordHistory存在寶箱 則用update 否則新增進表
    var condi = `if exists ( select 1 from [MOE3].[dbo].[EventChestHistory] where src_id = ${chest_id} and game_id_id =${game_id})  `
    var query4 = `UPDATE [MOE3].[dbo].[EventChestHistory] SET [remain]=[remain]-1 
    WHERE [src_id] = ${chest_id} and [game_id_id] = ${game_id} and [remain] is not null and [remain] > 0 and [answer] = '${user_answer}'`
    var query5 = `
    insert into [MOE3].[dbo].[EventChestHistory] 
    (src_id, remain , game_id_id) 
    select ${chest_id} as [src_id], [num]-1, ${game_id} as [game_id_id] 
    from [MOE3].[dbo].[EventChestSetting] where [id] = ${chest_id} `
    query = condi + " begin " + query4 + " end else begin " + query5 + " end "
    query = `
            INSERT INTO [MOE3].[dbo].[EventChestHistory] (
            [src_id], [lat], [lng], [num], [remain], [point],
            [distance], [question_type], [question], [option1], [option2],
            [option3], [option4], [hint1], [hint2], [hint3], [hint4],
            [answer], [game_id_id], [poi_id_id]
        )
        SELECT
            [id] AS [src_id], [lat], [lng], [num], 			
            CASE
				WHEN [answer] = ${user_answer} THEN [num] - 1
				ELSE [num] 
            END AS [remain], 
            [point], [distance], [question_type], [question], [option1], [option2],
            [option3], [option4], [hint1], [hint2], [hint3], [hint4],
            [answer], ${game_id} AS [game_id_id], [poi_id_id]
        FROM [MOE3].[dbo].[EventChestSetting]
        WHERE [id] = ${chest_id}
    `
    console.log("do query : " + query)
    try {
        recordset = await new db.Request().query(query)
    } catch (err) {
        console.error('SQL error: ' + err)
        return "server sql error need to check"
    }
    return "answer is right" //應該要回finish 但目前先不改
}

exports.insertAnswer = async function (record) {
    //console.log("call insert answer record")
    //console.log("input user record : " + record)
    var query = `select 1 from [MOE3].[dbo].[EventRecordHistory] 
    where [user_id_id] = ${record["user_id"]} and [game_id_id] = ${record["game_id"]} and  [chest_id_id] = ${record["chest_id"]}`

    var query1 = "INSERT INTO [MOE3].[dbo].[EventRecordHistory] (user_id_id, answer, answer_time, correctness, chest_id_id, game_id_id, lat, lng, point)"
    var query2 = " VALUES (" + record["user_id_id"] + ", '" + record["answer"] + "' ," + "CURRENT_TIMESTAMP" + "," + record["correctness"] + "," + record["chest_id_id"] + "," + record["game_id_id"] + "," + record["lat"] + "," + record["lng"] + "," + record["point"] + ")"

    console.log("do query : " + query)
    try {
        await new db.Request().query(query)
        return "finish"
    } catch (err) {
        console.log("err" + err);
        console.log("cannot insertAnswer because already answer")
    }

    // new db.Request().query(query).then(function () {
    //     console.log("insertAnswer finish");
    //     callback("finish");
    // }).catch(function (err) {
    //     console.log("err" + err);
    //     console.log("cannot insertAnswer because already answer")
    //     callback("already answer");
    // });
}

exports.getAnsRecord = async function (user_id, game_id, room_id) {

    //console.log("call get answer record")
    //console.log("input user_id : " + user_id)
    //console.log("input game_id : " + game_id)

    var query1 = "SELECT [chest_id_id],[question], A.[answer],B.[question_type],[option1],[option2],[option3],[option4], [correctness],A.[point] "
    var query2 = " FROM [MOE3].[dbo].[EventRecordHistory] AS A"
    var query3 = " WHERE A.[user_id_id] = " + user_id + " AND " + " A.[game_id_id] = " + game_id + " AND B.[question_type] != 4"
    //+ " AND " + " A.[event_id_id] = " + game_id
    // Using EventChestSetting instead of EventChestHistory
    // var query4 = " RIGHT JOIN [MOE3].[dbo].[EventChestHistory] AS B ON B.[id] = A.[chest_id_id]"
    var query4 = " RIGHT JOIN [MOE3].[dbo].[EventChestSetting] AS B ON B.[id] = A.[chest_id_id]"
    var query =
        //     `
        // SELECT [chest_id_id],[question], A.[answer],B.[question_type],
        // [option1],[option2],[option3],[option4], [correctness],A.[point]  
        // FROM [MOE3].[dbo].[EventRecordHistory] AS A 
        // RIGHT JOIN [MOE3].[dbo].[EventChestSetting] AS B ON B.[id] = A.[chest_id_id] 
        // WHERE A.[user_id_id] = ${user_id} AND  A.[game_id_id] = ${game_id} AND B.[question_type] != 4
        // `
        `
    With game_id_id AS(
    SELECT TOP 1 id
    FROM [MOE3].[dbo].[EventHistory] where [room_id_id] = ${room_id}
    ORDER BY [id] DESC
    )
    SELECT [chest_id_id],[question], A.[answer],B.[question_type],
    [option1],[option2],[option3],[option4], [correctness],A.[point]  
    FROM [MOE3].[dbo].[EventRecordHistory] AS A 
    RIGHT JOIN [MOE3].[dbo].[EventChestSetting] AS B ON B.[id] = A.[chest_id_id] 
    WHERE A.[user_id_id] = ${user_id} AND  A.[game_id_id] = (
    CASE
    WHEN -1 = ${game_id} THEN (SELECT id FROM game_id_id)
    ELSE ${game_id} 
    END)
    AND B.[question_type] != 4
    `

    console.log("do query : " + query);
    try {
        let recordset = await new db.Request().query(query)
        return recordset
    } catch (err) {
        console.log("err" + err);
    }
}

exports.getChestMedia = async function (chest_id) {

    //console.log("call get chest media")
    //console.log("input user src_id : " + chest_id)

    // var query1 = " SELECT [ATT_id],[ATT_url],[ATT_format] FROM [MOE3].[dbo].[EventATTHistory]"
    var query1 = " SELECT [ATT_id],[ATT_url],[ATT_format] FROM [MOE3].[dbo].[EventATT]"
    var query2 = " WHERE [chest_id_id] = " + chest_id

    console.log("do query : " + query1 + query2);

    try {
        let recordset = await new db.Request().query(query1 + query2)
        if (recordset.length == 0) { return null }
        else {
            for (i = 0; i < recordset.length; i++) {
                recordset[i].ATT_url = media_url_title + recordset[i].ATT_url
            }
            return recordset
            // callback(recordset);
        }
    } catch (err) {
        console.log("err" + err);
    }
    // new db.Request().query(query1 + query2).then(function (recordset) {
    //     if (recordset.length == 0) { callback(null); }
    //     else {
    //         for (i = 0; i < recordset.length; i++) {
    //             recordset[i].ATT_url = media_url_title + recordset[i].ATT_url
    //         }
    //         callback(recordset);
    //     }
    // }).catch(function (err) {
    //     console.log("err" + err);
    //     callback(null);
    // });

}

exports.uploadMedia = async function (content) {

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

    var keys = " answer, answer_time, correctness, game_id_id, user_id_id, chest_id_id, lat, lng, point";
    var query1 = "INSERT INTO [MOE3].[dbo].[EventRecordHistory] (" + keys + ") VALUES ( '" + txt + "', " + " CURRENT_TIMESTAMP " + ", " + "NULL" + ", " + game_id + ", " + user_id + ", " + chest_id + "," + lat + "," + lng + ",NULL)";
    console.log("query: " + query1);
    var recordset
    try {
        recordset = await new db.Request().query(query1)
    } catch (err) {
        console.log('err: ' + err);
    }
    // console.log("db store successfully!");
    if (filename01) {
        var keys01 = " ATT_url, ATT_upload_time, ATT_format, record_id_id ";
        var query01 = "INSERT INTO [MOE3].[dbo].[EventATTRecord] (" + keys01 + ") ";
        var query02 = "SELECT '" + url01 + "', answer_time, '" + type01 + "', id FROM [MOE3].[dbo].[EventRecordHistory] ";
        var query03 = "WHERE game_id_id=" + game_id + " AND user_id_id=" + user_id + " AND chest_id_id=" + chest_id;
        console.log("query: " + query01 + query02 + query03);
        try {
            let recordset = await new db.Request().query(query01 + query02 + query03)
            // console.log("db store media successfully!");
            return recordset
        } catch (err) {
            console.log(err);
        }
    }
    if (filename02) {
        var keys01 = " ATT_url, ATT_upload_time, ATT_format, record_id_id ";
        var query01 = "INSERT INTO [MOE3].[dbo].[EventATTRecord] (" + keys01 + ") ";
        var query02 = "SELECT '" + url02 + "', answer_time, '" + type02 + "', id FROM [MOE3].[dbo].[EventRecordHistory] ";
        var query03 = "WHERE game_id_id=" + game_id + " AND user_id_id=" + user_id + " AND chest_id_id=" + chest_id;
        console.log("query: " + query01 + query02 + query03);
        try {
            let recordset = await new db.Request().query(query01 + query02 + query03)
            // console.log("db store media successfully!");
            return recordset
        } catch (err) {
            console.log(err);
        }
    }
    if (filename03) {
        var keys01 = " ATT_url, ATT_upload_time, ATT_format, record_id_id ";
        var query01 = "INSERT INTO [MOE3].[dbo].[EventATTRecord] (" + keys01 + ") ";
        var query02 = "SELECT '" + url03 + "', answer_time, '" + type03 + "', id FROM [MOE3].[dbo].[EventRecordHistory] ";
        var query03 = "WHERE game_id_id=" + game_id + " AND user_id_id=" + user_id + " AND chest_id_id=" + chest_id;
        console.log("query: " + query01 + query02 + query03);
        try {
            let recordset = await new db.Request().query(query01 + query02 + query03)
            // console.log("db store media successfully!");
            return recordset
        } catch (err) {
            console.log(err);
        }
    }
    if (filename04) {
        var keys01 = " ATT_url, ATT_upload_time, ATT_format, record_id_id ";
        var query01 = "INSERT INTO [MOE3].[dbo].[EventATTRecord] (" + keys01 + ") ";
        var query02 = "SELECT '" + url04 + "', answer_time, '" + type04 + "', id FROM [MOE3].[dbo].[EventRecordHistory] ";
        var query03 = "WHERE game_id_id=" + game_id + " AND user_id_id=" + user_id + " AND chest_id_id=" + chest_id;
        console.log("query: " + query01 + query02 + query03);
        try {
            let recordset = await new db.Request().query(query01 + query02 + query03)
            // console.log("db store media successfully!");
            return recordset
        } catch (err) {
            console.log(err);
        }
    }
    if (filename05) {
        var keys01 = " ATT_url, ATT_upload_time, ATT_format, record_id_id ";
        var query01 = "INSERT INTO [MOE3].[dbo].[EventATTRecord] (" + keys01 + ") ";
        var query02 = "SELECT '" + url05 + "', answer_time, '" + type05 + "', id FROM [MOE3].[dbo].[EventRecordHistory] ";
        var query03 = "WHERE game_id_id=" + game_id + " AND user_id_id=" + user_id + " AND chest_id_id=" + chest_id;
        console.log("query: " + query01 + query02 + query03);
        try {
            let recordset = await new db.Request().query(query01 + query02 + query03)
            // console.log("db store media successfully!");
            return recordset
        } catch (err) {
            console.log(err);
        }
    }
    return recordset

}

exports.getMenberPointList = async function (game_id) {

    //console.log("call get Member list point list")
    //console.log("input game_id : " + game_id)

    var query1 = " SELECT [correctness], [user_id_id], [point], N.[nickname], [answer_time] FROM [MOE3].[dbo].[EventRecordHistory] AS M"
    var query2 = "  LEFT JOIN [MOE3].[dbo].[user_profile] AS N ON M.[user_id_id] = N.[user_id]"
    var query3 = " WHERE M.[game_id_id] = " + game_id

    console.log("do query : " + query1 + query2 + query3);

    try {
        let recordset = await new db.Request().query(query1 + query2 + query3)
        return recordset
    } catch (err) {
        console.log("err" + err);
    }
}

exports.getGameList = async function (room_id) {

    //console.log("call get game history list")
    //console.log("input game_id : " + room_id)

    var query1 = " SELECT [id], [start_time] FROM [MOE3].[dbo].[EventHistory]"
    var query2 = " WHERE [room_id_id] = " + room_id

    console.log("do query : " + query1 + query2);

    try {
        let recordset = await new db.Request().query(query1 + query2)
        return recordset
    } catch (err) {
        console.log("err" + err);
    }
}


exports.endGame = async function (room_id, user_id) {
    //先檢查是不是可關遊戲的人
    //再檢查是否遊戲已關閉
    var query = `
    select A.[user_id_id], B.[id] AS [room_id_id], A.[identifier],
    A.[found_question], A.[evaluate_question], A.[enable_activity], B.[is_playing],
    CASE
        WHEN (
        B.[end_time] > GETDATE()
        OR B.[is_playing] = 1
        ) THEN 0
        ELSE 1
    END AS [ended]
    from [MOE3].[dbo].[EventsMember] as A join [MOE3].[dbo].[EventSetting] as B ON A.[event_id_id] = B.[event_id_id] 
    where B.[id] = ${room_id}
    and A.[user_id_id] = ${user_id}
    `
    console.log("do query : " + query);
    try {
        let recordset = await new db.Request().query(query)
        if (recordset != null && recordset[0].enable_activity != 1 && recordset[0].identifier != 'leader')
            return "not event leader"
        if (recordset[0].ended) return "game is already ended"
    } catch (err) {
        console.log("sql error: " + err)
        return "sql error"
    }



    //改history
    var query = `
    UPDATE [MOE3].[dbo].[EventHistory]
    SET
        [end_time] = CURRENT_TIMESTAMP,
        [state] = CASE
                        WHEN erh.[game_id_id] IS NOT NULL THEN 1
                        ELSE 2
                    END
    FROM [MOE3].[dbo].[EventHistory] AS eh
    LEFT JOIN [MOE3].[dbo].[EventRecordHistory] AS erh ON erh.[game_id_id] = eh.[id] AND erh.[correctness] IS NULL
    WHERE eh.[room_id_id] = ${room_id}
    AND [end_time] > GETDATE()
    `
    //什麼時候state要是1??
    var query2 = " "
    console.log("do query : " + query);
    try {
        await new db.Request().query(query)
    } catch (err) {
        console.log("sql error: " + err)
    }


    //改setting
    query = `update [MOE3].[dbo].[EventSetting] set [end_time] = CURRENT_TIMESTAMP, [is_playing] = 0
    from [MOE3].[dbo].[EventHistory] as A
    join [MOE3].[dbo].[EventSetting] as B
    on A.room_id_id = B.id
    where A.room_id_id = ${room_id}`
    console.log("do query : " + query);
    try {
        await new db.Request().query(query)
    } catch (err) {
        console.log("sql error: " + err)
    }
    return "finish"
}

exports.insertMember = function (user_id, event_id, callback) {
    //console.log("call insert member");
    //console.log("input user_id event_id : " + user_id + event_id);

    var query = " SELECT * FROM [MOE3].[dbo].[EventsMember]"

    var cond = " WHERE [user_id_id] = " + user_id + " AND [event_id_id] = " + event_id
    query += cond;
    console.log("do query: ", query)
    new db.Request().query(query).then(function (recordset) {
        if (recordset.length == 0) {
            var keys = "identifier, event_id_id, user_id_id"
            var values = ["member", event_id, user_id]
            var query2 = "INSERT INTO [MOE3].[dbo].[EventsMember] ("
            query2 = query2 + keys + ") VALUES ('" + values.join("','") + "')"

            console.log("db query :" + query)
            new db.Request().query(query2).then(function (recordset) {
                callback("finish");
            }).catch(function (err) {
                console.log("err" + err);
                callback(null);
            });
        }
    });
}

//hiwang for exchange prize
exports.getPrize = function (search_id, callback) {
    //console.log('call get user prize list');
    //console.log('input search_id(user_id) : ' + search_id);

    var query2 = "SELECT [PTP_id],[start_time],[player_prize_id] FROM [MOE3].[dbo].[prize_to_player]"
    var query1 = " WHERE [user_id_id] = " + search_id

    console.log("do query: " + query2 + query1);

    new db.Request().query(query2 + query1).then(function (recordset) {
        if (recordset.length == 0) {
            console.log("user has no prize")
            callback(null);
        }
        else {
            console.log("user prize list callback")
            callback(recordset);
        }
    }).catch(function (err) {
        console.log("err" + err);
        callback(null);
    });
}

exports.getPrizeAttribute = function (search_id, callback) {
    //console.log('call get user prize attribute');
    //console.log('input search_id(player_prize_id) : ' + search_id);

    var query2 = "SELECT [prize_name],[prize_url] FROM [MOE3].[dbo].[prize_profile]"
    var query1 = " WHERE [prize_id] = " + search_id

    console.log("do query: " + query2 + query1);

    new db.Request().query(query2 + query1).then(function (recordset) {
        if (recordset.length == 0) {
            console.log("No prize")
            callback(null);
        }
        else {
            console.log("user prize list callback")
            callback(recordset);
        }
    }).catch(function (err) {
        console.log("err" + err);
        callback(null);
    });
}

exports.getPrizeDistributed = function (game_id, room_id, user_id, rank, callback) {
    //console.log('user prize distribute');
    //console.log('input game_id : ' + game_id);
    //console.log('input room_id : ' + room_id);
    //console.log('input user_id : ' + user_id);
    //console.log('input rank : ' + rank);


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

    var query2 = "SELECT [event_prize_detail] FROM [MOE3].[dbo].[EventSetting]"
    var query1 = " WHERE [id] = " + room_id

    var query4 = "SELECT [start_time], [end_time], [play_time] FROM [MOE3].[dbo].[EventHistory]"
    var query3 = " WHERE [id] = " + game_id

    var query6 = "SELECT [start_time], [user_id_id] FROM [MOE3].[dbo].[prize_to_player]"


    var query8 = "SET IDENTITY_INSERT [MOE3].[dbo].[prize_to_player] ON;"
    var query10 = "INSERT INTO [MOE3].[dbo].[prize_to_player] ( PTP_id, player_prize_id, prize_amount, start_time, end_time, play_time, is_exchanged, room_id_id, user_id_id)"
    var query11 = "SET IDENTITY_INSERT [MOE3].[dbo].[prize_to_player] OFF;"


    var query9 = "SELECT MAX([PTP_id]) FROM [MOE3].[dbo].[prize_to_player]"

    console.log("do query: " + query2 + query1);

    new db.Request().query(query2 + query1).then(function (recordset1) {
        if (recordset1.length == 0) {
            console.log("Can't distribute prize")
            callback(null);
        }
        else {
            console.log("user prize list callback");
            game_prize_detail = recordset1[0]['event_prize_detail'];
            //console.log(game_prize_detail);
            split_prize_detail = game_prize_detail.split(",");
            if (select_idx > split_prize_detail.length) {
                callback(null)
            }
            prize_amount = parseInt(split_prize_detail[select_idx], 10);
            prize_id = parseInt(split_prize_detail[select_idx - 1], 10);
            award_name = split_prize_detail[select_idx - 2];
            //console.log(prize_amount);
            //console.log(prize_id);
            //console.log(award_name);

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
                    //console.log(start_time);
                    //console.log(end_time);
                    //console.log(play_time);
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
    });
}