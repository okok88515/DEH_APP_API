const { connectDB } = require('../db/dbConnect')
var db = require('mssql');
const { debugPrint, joinIfAllInt } = require('./dehExtensions');
exports.allGroups = async function (request) {
    const { coiName, language } = request
    const query = `
    SELECT [group_name] AS groupName,
     [group_id] AS groupId,
     [group_leader_id] AS groupLeaderId 
    FROM [MOE3].[dbo].[Groups] AS A
    WHERE 1 = 1
    AND [verification] = 1
    AND [coi_name] = @coiName 
    AND [language] = @language
    `
    try {
        debugPrint(query, request)
        let connect = await connectDB()
        let recordset = await connect.request()
            .input('language', db.NVarChar, language)
            .input('coiName', db.NVarChar, coiName)
            .query(query);
        return recordset;
    } catch (error) {
        console.error("Error executing query: ", error);
    }
}
exports.invite = async function (request) {
    const { senderId, receiverName, groupId } = request
    const request1 = { userName: receiverName }
    const receiverId = await getIdFromName(request1)
    if (receiverId == senderId) return "Can't sent to yourself"
    else if (receiverId == -1) return "No this user"

    const request2 = { groupId }
    const leaders = await getGroupLeaders(request2)
    if (!leaders.some(leader => leader.userId === senderId)) return "Not leader";

    const request3 = {
        userId: receiverId,
        groupId: groupId
    }
    const isInGroup = await checkInGroup(request3)
    if (isInGroup == null) return "No this group"
    else if (isInGroup) return "Already in Group"

    const request4 = {
        senderId: senderId,
        receiverId: receiverId,
        groupId: groupId
    }
    return await addNewInvite(request4)


}
exports.apply = async function (request) {
    const { senderId, groupId } = request

    const request2 = { groupId }
    const leaders = await getGroupLeaders(request2)
    let receiverId
    if (leaders.length > 0) receiverId = leaders[0].userId

    const request3 = {
        userId: senderId,
        groupId: groupId
    }
    const isInGroup = await checkInGroup(request3)
    if (isInGroup == null) return "No this group"
    else if (isInGroup) return "Already in Group"

    const request4 = {
        senderId: senderId,
        receiverId: receiverId,
        groupId: groupId
    }
    return await addNewInvite(request4)
}

exports.reply = async function (request) {
    const { messageId, reply, groupId, messageCategory } = request
    let query = `
    UPDATE [MOE3].[dbo].[GroupsMessage]
    SET [is_read] = 1,
        [message_type] = @reply
    WHERE [message_id] = @messageId;
    `
    try {
        debugPrint(query, request)
        let connect = await connectDB()
        await connect.request()
            .input('messageId', db.Int, messageId)
            .input('reply', db.Int, reply ? 1 : -1)
            .query(query);
    } catch (error) {
        console.error("Error executing query: ", error);
        return "update error"
    }
    //不知到後面兩個填什麼
    if (reply) {
        query = `
    INSERT INTO [MOE3].[dbo].[GroupsMember] 
        ([join_time], [identifier], [foreignkey_id], [user_id_id], [revise], [verify]) 
    SELECT 
        GETDATE(), 'member', @groupId, 
        CASE 
            WHEN
            'invite' = @messageCategory
            THEN A.[receiver_id]
            WHEN
            'apply' = @messageCategory
            THEN A.[sender_id]
            ELSE -1 
        END AS newMemberId, 
        0, 0
    FROM 
        [MOE3].[dbo].[GroupsMessage] AS A
    WHERE 
        A.[message_id] = @messageId;
    `
        try {
            debugPrint(query, request)
            let connect = await connectDB()
            await connect.request()
                .input('messageId', db.Int, messageId)
                .input('groupId', db.Int, groupId)
                .input('messageCategory', db.NVarChar, messageCategory)
                .query(query);
        } catch (error) {
            console.error("Error executing query: ", error);
            return "insert error"
        }
    }
    return "success"

}
exports.userGroups = async function (request) {
    const { userId, language, coiName } = request;
    let query = `
      SELECT 
        g.[group_id] AS groupId,
        g.[group_name] AS groupName, 
        g.[group_info] AS groupInfo, 
        g.[group_leader_id] AS [groupLeaderId], 
        gm.[identifier] AS [role] 
      FROM 
        [MOE3].[dbo].[GroupsMember] gm
      JOIN 
        [MOE3].[dbo].[Groups] g
      ON 
        gm.[foreignkey_id] = g.[group_id]
      WHERE 
        gm.[user_id_id] = @userId
        AND g.[language] = @language
        AND g.[coi_name] = @coiName
      ORDER BY 
        g.[group_id] ASC
        `;
    try {
        debugPrint(query, request)
        let connect = await connectDB()
        return await connect.request()
            .input('userId', db.Int, userId)
            .input('language', db.NVarChar, language)
            .input('coiName', db.NVarChar, coiName)
            .query(query);
    } catch (error) {
        console.error("Error executing query: ", error);
        return []
    }
};
exports.members = async function (request) {
    const { groupId } = request
    let query = `
    SELECT B.[user_name] AS userName, [join_time] AS joinTime, 
    [identifier], B.[user_id] AS userId
    FROM [MOE3].[dbo].[GroupsMember] AS A
    JOIN [MOE3].[dbo].[user_profile] AS B
    ON A.[user_id_id] = B.[user_id]
    where foreignkey_id = @groupId
    `
    try {
        debugPrint(query, request)
        let connect = await connectDB()
        let recordset = await connect.request()
            .input('groupId', db.Int, groupId)
            .query(query);
        return recordset
    } catch (error) {
        console.error("Error executing query: ", error);
        return []
    }
}
exports.updateGroupDetail = async function (request) {
    const { groupId, groupName, groupInfo, userId } = request
    let query = `
    UPDATE G
    SET group_name = @groupName, 
       group_info = @groupInfo
    FROM [MOE3].[dbo].[Groups] AS G 
    JOIN [MOE3].[dbo].[GroupsMember] AS GM
    ON G.[group_id] = GM.[foreignkey_id]
    AND GM.[user_id_id] = @userId
    AND GM.[identifier] = 'leader'
    WHERE 1 = 1 
    AND G.[group_id] = @groupId
    `
    try {
        debugPrint(query, request)
        let connect = await connectDB()
        await connect.request()
            .input('groupId', db.Int, groupId)
            .input('userId', db.Int, userId)
            .input('groupName', db.NVarChar, groupName)
            .input('groupInfo', db.NVarChar, groupInfo)
            .query(query);
        return "success"
    } catch (error) {
        console.error("Error executing query: ", error);
        return []
    }
}
exports.notice = async function (request) {
    const { userId } = request
    let query = `
    SELECT 
        CASE 
            WHEN 1 = 1
                AND (A.[user_id_id] = C.[receiver_id]
                OR B.[user_id_id] = C.[receiver_id])
                AND A.[identifier] = 'leader'
            THEN 'apply'
            ELSE 'unknown'
        END AS [messageCategory], 
        [message_id] AS [messageId], 
        [sender_id] AS [senderId], [group_id_id] AS groupId, 
        D.[group_name] AS [groupName], E.[user_name] AS [senderName]
    FROM [MOE3].[dbo].[GroupsMember] AS A
    JOIN [MOE3].[dbo].[GroupsMember] AS B
        ON A.[foreignkey_id] = B.[foreignkey_id]
        AND A.[user_id_id] = @userId
        AND B.[identifier] = 'leader'
    JOIN [MOE3].[dbo].[GroupsMessage] AS C
        ON B.[foreignkey_id] = C.[group_id_id]
        AND C.[receiver_id] = B.[user_id_id]
        AND A.[identifier] = 'leader'        
    JOIN [MOE3].[dbo].[Groups] AS D
        ON C.[group_id_id] = D.[group_id]
    JOIN [MOE3].[dbo].[user_profile] AS E
        ON C.[sender_id] = E.[user_id]
    WHERE 1 = 1
        AND C.[is_read] = 0
        AND C.[message_type] = 0
UNION
    SELECT        
    CASE 
        WHEN 1 = 1
			AND A.[receiver_id] != B.[user_id_id]
        THEN 'invite'
        ELSE 'unknown'
    END AS [messageCategory], A.[message_id] AS [messageId], 
    A.[sender_id] AS [senderId], A.[group_id_id] AS groupId, 
    C.[group_name] AS [groupName], D.[user_name] AS [senderName]
    FROM [MOE3].[dbo].[GroupsMessage] AS A
    JOIN [MOE3].[dbo].[GroupsMember] AS B
    ON A.[group_id_id] = B.[foreignkey_id]
    JOIN [MOE3].[dbo].[Groups] AS C
    ON A.[group_id_id] = C.[group_id]
    JOIN [MOE3].[dbo].[user_profile] AS D
    ON A.[sender_id] = D.[user_id]
    WHERE 1 = 1
    AND A.[receiver_id] = @userId
	AND A.[is_read] = 0
	AND A.[message_type] = 0        
    ORDER BY [message_id] DESC
    `
    //1. selfjoin 然後以A表為底 篩@userId 目標是留下與userId同樣groupId的其他leader
    //2. join message 篩出同樣groudId的message 
    //3. 篩A是leader或是以A為目標的message
    //4. 後面兩個是加欄位的
    try {
        debugPrint(query, request)
        let connect = await connectDB()
        return recordset = await connect.request()
            .input('userId', db.Int, userId)
            .query(query);
    } catch (error) {
        console.error("Error executing query: ", error);
        return []
    }
}


async function getIdFromName(request) {
    const { userName } = request
    let query = `
    SELECT [user_id] AS userId
    FROM [MOE3].[dbo].[user_profile] 
    WHERE [user_name] = @userName
    `
    try {
        debugPrint(query, request)
        let connect = await connectDB()
        let recordset = await connect.request()
            .input('userName', db.NVarChar, userName)
            .query(query);
        return recordset[0].userId
    } catch (error) {
        console.error("Error executing query: ", error);
        return -1
    }
}
async function getGroupLeaders(request) {
    const { groupId } = request
    let query = `
    SELECT [user_id_id] AS userId
    FROM [MOE3].[dbo].[GroupsMember] 
    WHERE 1 = 1
    AND [foreignkey_id] = @groupId 
    AND [identifier] = 'leader'
    `
    try {
        debugPrint(query, request)
        let connect = await connectDB()
        let recordset = await connect.request()
            .input('groupId', db.Int, groupId)
            .query(query);
        return recordset
    } catch (error) {
        console.error("Error executing query: ", error);
        return null
    }
}
async function checkInGroup(request) {
    const { userId, groupId } = request
    let query = `
    SELECT 1 
    FROM  [MOE3].[dbo].[GroupsMember] 
    WHERE 1 = 1
    AND [user_id_id] = @userId 
    AND [foreignkey_id] = @groupId
    `
    try {
        debugPrint(query, request)
        let connect = await connectDB()
        let recordset = await connect.request()
            .input('groupId', db.Int, groupId)
            .input('userId', db.Int, userId)
            .query(query);
        return recordset.length > 0
    } catch (error) {
        console.error("Error executing query: ", error);
        return null
    }
}
async function addNewInvite(request) {
    const { senderId, receiverId, groupId } = request
    let query = `
    SELECT message_type AS messageType 
    FROM  [MOE3].[dbo].[GroupsMessage] 
    WHERE 1 = 1
    AND group_id_id = @groupId 
    AND receiver_id = @receiverId
    `
    // 1. 檢查有沒有被邀請/申請過
    let rejected = false
    try {
        debugPrint(query, request)
        let connect = await connectDB()
        let recordset = await connect.request()
            .input('groupId', db.Int, groupId)
            .input('receiverId', db.Int, receiverId)
            .query(query);
        if (recordset.length > 0 &&
            (recordset.messageType == 0 || recordset.messageType == 1)
        ) return 'Already Invite'
        else if (recordset.length == 0) {
            rejected = false
        }
        else {
            rejected = true
        }
    } catch (error) {
        console.error("Error executing query: ", error);
        return null
    }
    // 2. 更新或插入
    if (rejected) {
        query = `
    UPDATE [MOE3].[dbo].[GroupsMessage]
    SET message_type = 0, 
        is_read = 0
    WHERE group_id_id = @groupId
    AND receiver_id = @receiverId;
    `
    } else {
        query = `
        INSERT INTO[MOE3].[dbo].[GroupsMessage]
        (group_id_id, receiver_id, sender_id, message_type, is_read)
        VALUES(@groupId, @receiverId, @senderId, 0, 0);
        `
    }
    try {
        debugPrint(query, request)
        let connect = await connectDB()
        await connect.request()
            .input('groupId', db.Int, groupId)
            .input('receiverId', db.Int, receiverId)
            .input('senderId', db.Int, senderId)
            .query(query);
        return 'Success'
    } catch (error) {
        console.error("Error executing query: ", error);
        return null
    }

}

async function createGroup(request) {
    const { groupName, groupInfo, userId, language, } = request

}
