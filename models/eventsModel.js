const { connectDB } = require('../db/dbConnect')
var db = require('mssql');

const { debugPrint } = require('./dehExtensions');
let others = require('./othersModel');



exports.fetchPrivateEvent = async function (request) {
    const { userId, coiName } = request
    const query = `
    SELECT DISTINCT
            E.[Event_name] AS name,
            E.[Event_id] AS id,
            E.[Event_leader_id] AS leaderId,
            E.[start_time] AS startTime, 
            E.[end_time] AS endTime
        FROM [MOE3].[dbo].[Groups] AS M
        inner JOIN [MOE3].[dbo].[GroupsMember] AS N 
            ON M.[group_id] = N.[foreignkey_id]
        inner JOIN [MOE3].[dbo].[EventsGroup] AS EG
            ON M.[group_id] = EG.[group_id_id]
        inner JOIN [MOE3].[dbo].[Events] AS E
            ON EG.[event_id_id] = E.[Event_id]
        WHERE N.[user_id_id] = @userId 
            AND M.[coi_name] = @coiName
    `;
    return recordset = await others.dehQuery(query, request)
}

exports.fetchPublicEvent = async function (request) {
    const { coiName } = request
    const query = `
        SELECT 
            [Event_name] AS name,
            [Event_id] AS id,
            [Event_leader_id] AS leaderId, 
            [start_time] AS startTime, 
            [end_time] AS endTime
        FROM [MOE3].[dbo].[Events]
        WHERE 
            [coi_name] = @coiName 
            AND [open] = '1'
            AND [start_time] <= GETDATE() 
            AND [end_time] >= GETDATE() 
    `;
    return recordset = await others.dehQuery(query, request)
};

exports.insertIntoEvent = async function (request) {
    const { eventId, userId } = request
    const query = `
        MERGE INTO [MOE3].[dbo].[EventsMember] AS target
        USING (SELECT @user_id AS user_id, @event_id AS event_id) AS source
        ON target.[user_id_id] = source.user_id AND target.[event_id_id] = source.event_id
        WHEN NOT MATCHED THEN
            INSERT ([identifier], [event_id_id], [user_id_id])
            VALUES ('member', source.event_id, source.user_id);
    `;
    debugPrint(query, request)
    try {
        let connect = await connectDB()
        await connect.request()
            .input('user_id', db.Int, userId)
            .input('event_id', db.Int, eventId)
            .query(query)
    } catch (error) {
        console.error("Error executing query: ", error);
    }
}

exports.getSessionList = async function (request) {
    const { eventId } = request
    const query = `
        SELECT 
            [id], 
            [room_name] AS sessionName, 
            [auto_start] AS autoStart, 
            [is_playing] AS isPlaying, 
            [start_time] AS startTime, 
            [end_time] AS endTime,
            CASE 
                WHEN GETDATE() < [start_time] THEN 'before game'
                WHEN GETDATE() > [end_time] THEN 'after game'
                WHEN GETDATE() BETWEEN [start_time] AND [end_time] THEN 'during game'
                ELSE 'null game'
            END AS [status]
        FROM [MOE3].[dbo].[EventSetting]
        WHERE [event_id_id] = @eventId
    `;
    let recordset = await others.dehQuery(query, request)
    return recordset
    debugPrint(query, request)
    try {
        // 建立資料庫連接並執行查詢
        let connect = await connectDB();
        let recordset = await connect.request()
            .input('eventId', db.Int, eventId)
            .query(query);
        return recordset;
    } catch (err) {
        console.error("Error executing query: ", err);
        return null;
    }
};

exports.gameData = async function (request) {
    const { sessionId } = request;
    var query = `
    SELECT TOP 1 A.[id] AS sessionId, A.[start_time] AS startTime,
    A.[end_time] AS endTime, A.[play_time] AS playTime,
    A.[event_id_id] AS eventId, COALESCE(B.[id], -1) AS [id], B.[state]
    FROM [MOE3].[dbo].[EventSetting] AS A
    LEFT JOIN [MOE3].[dbo].[EventHistory] AS B 
    ON A.[id] = B.[room_id_id] AND B.[end_time] > GETDATE()
    WHERE A.[id] = @sessionId
    ORDER BY B.[id] DESC
    `;

    try {
        debugPrint(query, request)
        let connect = await connectDB();
        let recordset = await connect.request()
            .input('sessionId', db.Int, sessionId)
            .query(query);
        return recordset;
    } catch (err) {
        console.error("sql error: ", err);
    }
}


exports.chestList = async function (request) {
    const _dirname = "https://deh.csie.ncku.edu.tw/player_pictures/";
    const { sessionId, userId } = request;
    let query = `
        SELECT A.[id], A.[lat] AS latitude, A.[lng] AS longitude, A.[num], B.[remain], A.[point], A.[distance], A.[question_type] AS questionType ,
            A.[question], A.[option1], A.[option2], A.[option3], A.[option4], A.[hint1], A.[hint2], A.[hint3], A.[hint4], 
            A.[answer], A.[room_id_id] AS sessionId,
            A.[poi_id_id] AS PoiId
        FROM [MOE3].[dbo].[EventChestSetting] AS A
        LEFT JOIN [MOE3].[dbo].[EventHistory] AS C
            ON A.[room_id_id] = C.[room_id_id]
        LEFT JOIN [MOE3].[dbo].[EventChestHistory] AS B
            ON A.[id] = B.[src_id] AND B.[game_id_id] = C.[id]
        WHERE A.[room_id_id] = @sessionId
            AND A.[id] NOT IN (
        SELECT E.[src_id] FROM [MOE3].[dbo].[EventRecordHistory] AS D
        JOIN [MOE3].[dbo].[EventChestHistory] AS E
        ON E.[id] = D.[event_chest_history_id]
        WHERE D.[game_id_id] = C.[id] AND [user_id_id] = @userId
        )
            AND (B.[remain] > 0 OR B.[remain] IS NULL)
            AND (B.[game_id_id] = C.[id] OR B.[game_id_id] IS NULL)
            AND C.[end_time] > GETDATE()
    `;

    debugPrint(query, request)
    try {
        let connect = await connectDB();
        let recordset = await connect.request()
            .input('sessionId', db.Int, sessionId)
            .input('userId', db.Int, userId)
            .query(query);


        let query1 = `
        select @_dirname + [ATT_url] AS mediaUrl,
        CASE 
            WHEN [ATT_format] = 'image' THEN 1
            WHEN [ATT_format] = 'audio' THEN 2
            WHEN [ATT_format] = 'video' THEN 4
            ELSE 0 
        END AS mediaFormat
        FROM [MOE3].[dbo].[EventATT]
        WHERE [chest_id_id] = @chestId
        `;
        // 提高效能 1.用list篩出所有media再分發 2.換成新版SSMS 可以用nested json語法
        for (let item of recordset) {
            let connect = await connectDB();
            let medias = await connect.request()
                .input('chestId', db.Int, item.id)
                .input('_dirname', db.NVarChar, _dirname)
                .query(query1);
            if (medias.length > 0) item.medias = medias;
        }
        return recordset;
    } catch (error) {
        console.error("SQL error: ", error);
        return null;
    }

};

exports.answerChest = async function (request) {
    //TODO 沒有檢查回答的時間
    const { chestId, userId, gameId, latitude, longitude, userAnswer } = request;
    let connect, query;
    //1. 如果沒有箱子資料 就插入
    connect = await connectDB();
    query = `
    IF NOT EXISTS (
        SELECT 1
        FROM [MOE3].[dbo].[EventChestHistory]
        WHERE src_id = @chestId AND game_id_id = @gameId
    )
    BEGIN
        INSERT INTO [MOE3].[dbo].[EventChestHistory] (
            [src_id], [lat], [lng], [num], [remain], [point],
            [distance], [question_type], [question], [option1], [option2],
            [option3], [option4], [hint1], [hint2], [hint3], [hint4],
            [answer], [game_id_id], [poi_id_id]
        )
        SELECT
            [id] AS [src_id], [lat], [lng], [num], 			
            CASE
				WHEN [answer] = @userAnswer THEN [num] - 1
				ELSE [num] 
            END AS [remain], 
            [point], [distance], [question_type], [question], [option1], [option2],
            [option3], [option4], [hint1], [hint2], [hint3], [hint4],
            [answer], @gameId AS [game_id_id], [poi_id_id]
        FROM [MOE3].[dbo].[EventChestSetting]
        WHERE [id] = @chestId
    END
    SELECT [id]
    FROM [MOE3].[dbo].[EventChestHistory]
    WHERE src_id = @chestId AND game_id_id = @gameId
`
        ;
    debugPrint(query, request)
    try {
        recordset = await connect.request()
            .input('chestId', db.Int, chestId)
            .input('gameId', db.Int, gameId)
            .input('userAnswer', db.NVarChar, userAnswer)
            .query(query);
        request.eventChestHistoryId = recordset[0].id
    } catch (err) {
        console.error('SQL error: ' + err);
        return "server sql error need to check 1";
    }
    // 2. 判斷還有沒有剩寶箱
    query = `
            SELECT [remain] 
            FROM [MOE3].[dbo].[EventChestHistory] 
            WHERE src_id = @chestId AND game_id_id = @gameId
        `;
    debugPrint(query, request)
    try {
        let recordset = await connect.request()
            .input('chestId', db.Int, chestId)
            .input('gameId', db.Int, gameId)
            .query(query);

        if (recordset.length > 0 && recordset[0].remain !== undefined && recordset[0].remain == 0) {
            return "chest is empty";
        }
    } catch (err) {
        console.error('SQL error: ' + err);
        return "server sql error need to check 2";
    }


    // 3. 有剩的話插入answer到EventRecordHistory
    query = `
            INSERT INTO [MOE3].[dbo].[EventRecordHistory] 
            (event_chest_history_id, lat, lng, point, user_id_id, game_id_id, answer, answer_time, correctness)
            SELECT TOP 1
                [id], 
                @latitude, 
                @longitude, 
                CASE  
                    WHEN [question_type] >= 3 THEN NULL
                    ELSE [point] 
                END AS [point], 
                @userId, 
                @gameId,  
                @userAnswer, 
                SYSDATETIME(), 
                CASE 
                    WHEN [answer] = @userAnswer THEN 1 
                    WHEN [question_type] >= 3 THEN NULL
                    ELSE 0 
                END AS [correctness]
            FROM [MOE3].[dbo].[EventChestHistory] 
            WHERE [src_id] = @chestId
            ORDER BY [id] DESC
        `;
    debugPrint(query, request)

    try {
        recordset = await connect.request()
            .input('chestId', db.Int, chestId)
            .input('latitude', db.Float, latitude)
            .input('longitude', db.Float, longitude)
            .input('userId', db.Int, userId)
            .input('gameId', db.Int, gameId)
            .input('userAnswer', db.NVarChar, userAnswer)
            .query(query);

    } catch (err) {
        if (err.number === 2627 || err.number === 2601) {
            return "already answer";
        }
    }

    // 4. 撈record的correctness
    query = `
            SELECT [answer] 
            FROM [MOE3].[dbo].[EventChestSetting] 
            WHERE [id] = @chestId
        `;
    debugPrint(query, request)

    try {
        recordset = await connect.request()
            .input('chestId', db.Int, chestId)
            .query(query);

    } catch (err) {
        console.error('SQL error: ' + err);
        return "server sql error need to check 4";
    }
    // 4. 如果答對且在EventChestHistory存在寶箱就-1 
    //否則用update 新增進表
    query = `
    IF EXISTS (
        SELECT 1
        FROM [MOE3].[dbo].[EventChestHistory]
        WHERE src_id = @chestId AND game_id_id = @gameId
    )
    BEGIN
        UPDATE [MOE3].[dbo].[EventChestHistory]
        SET [remain] = [remain] - 1
        WHERE [src_id] = @chestId 
          AND [game_id_id] = @gameId 
          AND [remain] IS NOT NULL 
          AND [remain] > 0 
          AND [answer] = @userAnswer
    END
    ELSE
    BEGIN
        INSERT INTO [MOE3].[dbo].[EventChestHistory] (
            [src_id], [lat], [lng], [num], [remain], [point],
            [distance], [question_type], [question], [option1], [option2],
            [option3], [option4], [hint1], [hint2], [hint3], [hint4],
            [answer], [game_id_id], [poi_id_id]
        )
        SELECT
            [id] AS [src_id], [lat], [lng], [num], 			
            CASE
				WHEN [answer] = @userAnswer THEN [num] - 1
				ELSE [num] 
            END AS [remain], 
            [point], [distance], [question_type], [question], [option1], [option2],
            [option3], [option4], [hint1], [hint2], [hint3], [hint4],
            [answer], @gameId AS [game_id_id], [poi_id_id]
        FROM [MOE3].[dbo].[EventChestSetting]
        WHERE [id] = @chestId
    END
`
        ;
    debugPrint(query, request)
    try {
        recordset = await connect.request()
            .input('chestId', db.Int, chestId)
            .input('gameId', db.Int, gameId)
            .input('userAnswer', db.NVarChar, userAnswer)
            .query(query);
    } catch (err) {
        console.error('SQL error: ' + err);
        return "server sql error need to check 5";
    }

    //6.把ATT快照插入EventATTHistory
    query = `
        INSERT INTO [MOE3].[dbo].[EventATTHistory](
        [ATT_url], [ATT_upload_time], [ATT_format], [event_chest_history_id]
        )
        SELECT [ATT_url], [ATT_upload_time], [ATT_format], ECH.[id]
        FROM [MOE3].[dbo].[EventATT] AS EATT
        join [MOE3].[dbo].[EventChestHistory] AS ECH
        ON ECH.[src_id] = EATT.[chest_id_id] AND ECH.[game_id_id] = @gameId
        WHERE EATT.[chest_id_id] = @chestId
    `
    try {
        let record = await connect.request()
            .input('chestId', db.Int, chestId)
            .input('gameId', db.Int, gameId)
            .query(query);
        //沒有ATT的話就不用印sql了
        if (record != null && record.rowsAffected != null && record.rowsAffected[0] > 0) {
            console.log(record != null, record.rowsAffected != null, record.rowsAffected[0] > 0)
            debugPrint(query, request);
        }
    } catch (err) {
        console.log('err: ' + err);
        return "server sql error need to check 6";
    }
    return "finish";

};

exports.startGame = async function (request) {
    const { sessionId, userId } = request;

    // 先連接 DB
    let connect = await connectDB();
    try {
        // 第一步：查詢 EventsMember 和 EventSetting
        var query = `
        select A.[user_id_id], B.[id] AS [room_id_id], A.[identifier], A.[found_question],
        A.[evaluate_question], A.[enable_activity], B.[auto_start]
        from [MOE3].[dbo].[EventsMember] as A join [MOE3].[dbo].[EventSetting] as B ON A.[event_id_id] = B.[event_id_id] 
        where B.[id] = @sessionId
        and A.[user_id_id] = @userId
        `;
        debugPrint(query, request);

        var recordset = await connect.request()
            .input('sessionId', db.Int, sessionId)
            .input('userId', db.Int, userId)
            .query(query);

        //非空 且 (非授權人員 或自動開始)
        if (recordset != null &&
            (
                (recordset[0].enable_activity != 1 && recordset[0].identifier != 'leader')
                ||
                recordset[0].auto_start == 1)) {
            return "autoStartGame or unauthorized";
        }

        // 第二步：查詢 EventSetting 是否結束
        query = `
        select case when [end_time] < GETDATE() OR [end_time] is NULL then 1 else 0 end as 'notPlaying' 
        from [MOE3].[dbo].[EventSetting] where id = @sessionId
        `;
        debugPrint(query, request);

        recordset = await connect.request()
            .input('sessionId', db.Int, sessionId)
            .query(query);

        if (recordset[0].notPlaying == 0) {
            return "already start";
        }
        // 第三步：更新 EventSetting
        query = `
        UPDATE [MOE3].[dbo].[EventSetting] 
        SET [start_time] = CURRENT_TIMESTAMP, 
            [end_time] = DATEADD(n,30,CURRENT_TIMESTAMP), 
            [play_time] = 30, 
            [is_playing] = 1
        WHERE [id] = @sessionId
        `;
        debugPrint(query, request);

        await connect.request()
            .input('sessionId', db.Int, sessionId)
            .query(query);

        // 第四步：插入 EventHistory
        query = `
        INSERT INTO [MOE3].[dbo].[EventHistory] (start_time, end_time, play_time, state, room_id_id)
        SELECT [start_time], [end_time], [play_time], 0, [id] 
        FROM [MOE3].[dbo].[EventSetting]
        WHERE [id] = @sessionId
        `;
        debugPrint(query, request);

        await connect.request()
            .input('sessionId', db.Int, sessionId)
            .query(query);
        return "success start game";
    } catch (err) {
        console.log("sql error : " + err);
        return "unKnown error";
    }
}

exports.endGame = async function (request) {
    const { sessionId, userId } = request;
    let connect = await connectDB();
    try {
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
    where B.[id] = @sessionId
    and A.[user_id_id] = @userId
    `
        debugPrint(query, request);
        var recordset = await connect.request()
            .input('sessionId', db.Int, sessionId)
            .input('userId', db.Int, userId)
            .query(query);
        if (recordset != null &&
            recordset[0].enable_activity != 1
            && recordset[0].identifier != 'leader')
            return "not authorized"
        if (recordset[0].ended) return "game is already ended"
        query = `
        UPDATE [MOE3].[dbo].[EventHistory]
        SET
            [end_time] = CURRENT_TIMESTAMP,
            [state] = CASE
                            WHEN erh.[game_id_id] IS NOT NULL THEN 1
                            ELSE 2
                        END
        FROM [MOE3].[dbo].[EventHistory] AS eh
        LEFT JOIN [MOE3].[dbo].[EventRecordHistory] AS erh ON erh.[game_id_id] = eh.[id] AND erh.[correctness] IS NULL
        WHERE eh.[room_id_id] = @sessionId
        AND [end_time] > GETDATE()
        `
        debugPrint(query, request);
        recordset = await connect.request()
            .input('sessionId', db.Int, sessionId)
            .query(query);

        query = `
        update [MOE3].[dbo].[EventSetting] set [end_time] = CURRENT_TIMESTAMP, [is_playing] = 0
        from [MOE3].[dbo].[EventHistory] as A
        join [MOE3].[dbo].[EventSetting] as B
        on A.room_id_id = B.id
        where A.room_id_id = @sessionId
        `
        debugPrint(query, request);
        recordset = await connect.request()
            .input('sessionId', db.Int, sessionId)
            .query(query);

        return "success end game"
    } catch (err) {
        console.log("sql error: " + err)
        return "unKnown error"
    }
}
exports.ansRecord = async function (request) {
    const { userId, gameId } = request;
    const _dirname = "https://deh.csie.ncku.edu.tw/player_pictures/";
    // 先撈回答筆數，再去撈每一筆題目/回答ATT資料
    let query = `
    SELECT [event_chest_history_id] AS chestId, [question], A.[answer], B.[question_type] AS questionType,
           [option1], [option2], [option3], [option4], [correctness], A.[point], A.[id] AS [recordId]
    FROM [MOE3].[dbo].[EventRecordHistory] AS A 
    RIGHT JOIN [MOE3].[dbo].[EventChestHistory] AS B 
        ON B.[id] = A.[event_chest_history_id] AND B.[game_id_id] = @gameId
    WHERE A.[user_id_id] = @userId AND A.[game_id_id] = @gameId
      AND B.[question_type] != 4
    `;

    let connect, recordset;
    debugPrint(query, request);

    try {
        connect = await connectDB();
        recordset = await connect.request()
            .input('userId', db.Int, userId)
            .input('gameId', db.Int, gameId)
            .query(query);
    } catch (err) {
        console.log("err" + err);
        return [];
    }

    // 篩題目多媒體
    let query1 = `
    SELECT 
        @_dirname + [ATT_url] AS mediaUrl, 
        CASE 
            WHEN [ATT_format] = 'image' THEN 1
            WHEN [ATT_format] = 'audio' THEN 2
            WHEN [ATT_format] = 'video' THEN 4
            ELSE 0 
        END AS mediaFormat
    FROM [MOE3].[dbo].[EventATTHistory] AS A
    JOIN [MOE3].[dbo].[EventChestHistory] AS B 
        ON A.event_chest_history_id = B.id
    WHERE B.src_id = @chestId 
      AND B.game_id_id = @gameId
`;

    // 篩回答多媒體
    let query2 = `
    SELECT @_dirname + [ATT_url] AS mediaUrl,        
        CASE 
            WHEN [ATT_format] = 'image' THEN 1
            WHEN [ATT_format] = 'audio' THEN 2
            WHEN [ATT_format] = 'video' THEN 4
            ELSE 0 
        END AS mediaFormat
    FROM [MOE3].[dbo].[EventATTRecord]
    WHERE [record_id_id] = @recordId
    `;

    const mediaFormats = {
        ".jpg": 1, "jpg": 1, "jpeg": 1, "png": 1, "bmp": 1, "gif": 1,
        "aac": 2, "amr": 2, "wav": 2, "mp3": 2,
        "wmv": 4, "mp4": 4
    };

    try {
        // 使用 Promise.all 並行處理每個 element 的 ATT 資料查詢
        let promises = recordset.map(async element => {
            // 查詢 question 的 ATT 資料
            // debugPrint(query1, request);
            let questionATT = await connect.request()
                .input('chestId', db.Int, element.chestId)
                .input('_dirname', db.NVarChar, _dirname)
                .input('gameId', db.Int, gameId)
                .query(query1);

            // debugPrint(query2, request);
            // 查詢 record 的 ATT 資料
            let recordATT = await connect.request()
                .input('recordId', db.Int, element.recordId)
                .input('_dirname', db.NVarChar, _dirname)
                .query(query2);

            // 將結果存入元素
            if (questionATT.length > 0) element.questionATT = questionATT;
            if (recordATT.length > 0) element.recordATT = recordATT;

            return element; // 返回更新後的元素
        });

        // 等待所有查詢完成後返回結果
        recordset = await Promise.all(promises);
        return recordset; // 返回更新後的 recordset
    } catch (err) {
        console.log("append eventATT err: " + err);
        return [];
    }
};


exports.gameHistory = async function (request) {
    const { sessionId, userId } = request

    var query = `
        SELECT DISTINCT A.[id], [start_time] AS startTime, [state] FROM [MOE3].[dbo].[EventHistory] AS A
        inner join [MOE3].[dbo].[EventRecordHistory] AS B
        ON B.[game_id_id] = A.[id]
        WHERE [room_id_id] = @sessionId AND B.[user_id_id] = @userId
    `
    debugPrint(query, request);

    try {
        let connect = await connectDB();
        let recordset = await connect.request()
            .input('sessionId', db.Int, sessionId)
            .input('userId', db.Int, userId)
            .query(query);
        return recordset
    } catch (err) {
        console.log("err" + err);
    }
}
exports.memberPointList = async function (request) {
    const { gameId } = request
    let query =
        `
    SELECT [correctness], [user_id_id] AS userId, [point], N.[nickname], [answer_time] AS answerTime
    FROM [MOE3].[dbo].[EventRecordHistory] AS M
    LEFT JOIN [MOE3].[dbo].[user_profile] AS N 
    ON M.[user_id_id] = N.[user_id]
    WHERE M.[game_id_id] = @gameId
    `
    debugPrint(query, request);
    try {
        let connect = await connectDB();
        let recordset = await connect.request()
            .input('gameId', db.Int, gameId)
            .query(query);
        return recordset
    } catch (err) {
        console.log("err" + err);
    }
}
exports.userPoint = async function (request) {
    const { gameId, userId } = request
    let query =
        `
    SELECT SUM(COALESCE(M.[point],0)) AS totalPoint, [user_id_id] AS userId, COUNT(M.[correctness]) AS correctAnswers
    FROM [MOE3].[dbo].[EventRecordHistory] AS M
    LEFT JOIN [MOE3].[dbo].[user_profile] AS N 
    ON M.[user_id_id] = N.[user_id]
    WHERE M.[game_id_id] = @gameId AND M.[user_id_id] = @userId AND M.[correctness] = 1
    GROUP BY M.[user_id_id], N.[nickname]
    `
    debugPrint(query, request);
    try {
        let connect = await connectDB();
        let recordset = await connect.request()
            .input('gameId', db.Int, gameId)
            .input('userId', db.Int, userId)
            .query(query);
        if (recordset.length == 0) {
            return { totalPoint: 0, userId: userId, correctAnswers: 0 }
        }
        return recordset[0]
    } catch (err) {
        console.log("err" + err);
    }
}
exports.uploadMediaAnswer = async function (request) {
    const {
        type01, filename01, url01,
        type02, filename02, url02,
        type03, filename03, url03,
        type04, filename04, url04,
        type05, filename05, url05,
        userId, chestId, gameId, eventChestHistoryId
    } = request;
    let connect;

    connect = await connectDB();
    const insertMedia = async (index) => {
        let query = `
            INSERT INTO [MOE3].[dbo].[EventATTRecord] (
                ATT_url, ATT_upload_time, ATT_format, record_id_id
            )
            SELECT @url${index}, answer_time, @type${index}, id
            FROM [MOE3].[dbo].[EventRecordHistory]
            WHERE game_id_id = @gameId AND user_id_id = @userId AND event_chest_history_id = @eventChestHistoryId;
        `;
        return await others.dehQuery(query, request)
    };

    if (filename01) await insertMedia('01');
    if (filename02) await insertMedia('02');
    if (filename03) await insertMedia('03');
    if (filename04) await insertMedia('04');
    if (filename05) await insertMedia('05');


    return "upload successful"
};

exports.prize = async function (request) {
    const { userId } = request
    const query = `
    
    
    `

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