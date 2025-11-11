const { debugPrint, getCount, joinIfAllInt } = require('./dehExtensions');
const { connectDB } = require('../db/dbConnect')
var db = require('mssql');

exports.verifyPassword = async function (request) {
    const { username, password, coiName } = request;
    const coiJoinConditions = {
        deh: ` `,
        default:
            `
        JOIN moe3.dbo.CoiUser AS B
        ON A.[user_id] = B.[user_fk_id]
        AND [coi_name] = @coiName
        `
    };
    const coiJoinCondition = coiJoinConditions[coiName] || coiJoinConditions.default;
    const query =
        `
    SELECT [user_name] AS username, [user_id] AS userId,  
    [nickname], [email], A.[role], [birthday]
    FROM moe3.dbo.user_profile AS A
    ${coiJoinCondition}
    WHERE 1=1
    AND A.[user_name] = @username
    AND A.[password] = @password
    `
    debugPrint(query, request);
    try {
        let connect = await connectDB();
        let recordset = await connect.request()
            .input('username', db.NVarChar, username)
            .input('password', db.NVarChar, password)
            .input('coiName', db.NVarChar, coiName)
            .query(query);
        return recordset;
    } catch (error) {
        console.error("Error executing query: ", error);
        return [];
    }
}