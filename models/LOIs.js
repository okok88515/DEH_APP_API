const { debugPrint, getCount, joinIfAllInt } = require('./dehExtensions');
const { connectDB } = require('../db/dbConnect')
var db = require('mssql');
var geo = require('geolib');
var geocoding = require('../services/geocoding');
var poi = require('./POIs')
var loi = require('./LOIs')
exports.queryXOIs = async function (request, action) {
    const { latitude, longitude, number, distance, language } = request;
    const { username = '', coiName = null, groupId = -1, regionId = -1 } = request;
    const count = getCount(number)
    const point = { latitude: Number(latitude), longitude: Number(longitude) };
    const bounds = geo.getBoundsOfDistance(point, Number(distance)); // 取得最大/最小經緯度
    const userConditions = {
        user: 'AND A.[route_owner] = @username',
        // default: ' AND A.[verification] = 1 AND A.[open] = 1'
        // nearby: ' AND A.[verification] = 1 AND A.[open] = 1',
        default: ''
    };
    const userCondition = userConditions[action] || userConditions.default;
    const groupJoinConditions = {
        group:
            `
        JOIN [MOE3].[dbo].[GroupsPoint] AS gp 
        ON gp.point_id = A.[route_id]
        AND gp.[types] = 'loi'
        AND gp.foreignkey_id = @groupId
        `,
        region:
            `
        JOIN [MOE3].[dbo].[GroupsPoint] AS gp 
        ON gp.point_id = A.[route_id]
        AND gp.[types] = 'loi'
        JOIN [MOE3].[dbo].[RegionsGroup] AS RG ON gp.foreignkey_id = RG.group_id
        AND RG.region_id = @regionId
        `,
        default: '',
    }
    const groupJoinCondition = groupJoinConditions[action] || groupJoinConditions.default;
    const coiJoinCondition = coiName !== "deh"
        ? 'JOIN [MOE3].[dbo].[CoiPoint] AS F ON a.route_id = F.point_id AND F.types = \'loi\' AND F.[coi_name] = @coiName '
        : '';
    let verifiConditon = ''
    if (coiName != 'deh') {
        verifiConditon = 'AND F.[verification] = 1 '
    }
    else if (action !== 'user') {
        verifiConditon = ' AND A.[verification] = 1 AND A.[open] = 1 '
    }
    let query = `
        SELECT TOP ${count}
            [route_id] AS xoiId, 
            [route_title] AS xoiTitle, 
            [route_description] AS xoiDescription, 
            A.[area_name_en] AS areaNameEn, [coverage], A.[identifier], A.[open], 
            [route_owner] AS rights, 
            A.[language],
            MIN((6371 * acos(cos(radians(@latitude)) * cos(radians(E.[latitude])) * cos(radians(E.[longitude]) - radians(@longitude)) + 
            sin(radians(@latitude)) * sin(radians(E.[latitude]))))) AS distance
        FROM moe3.dbo.route_planning AS A
        INNER JOIN moe3.dbo.user_profile AS B ON A.[route_owner] = B.[user_name]
        INNER JOIN moe3.dbo.area AS C ON A.[area_name_en] = C.[area_name_en]
        INNER JOIN moe3.dbo.sequence AS D ON A.[route_id] = D.[foreignkey]
        INNER JOIN moe3.dbo.dublincore AS E ON E.POI_id = D.POI_id
        ${groupJoinCondition}
        ${coiJoinCondition}
        WHERE 1=1
        ${userCondition}
        ${verifiConditon}
        AND E.[latitude] BETWEEN @minLatitude AND @maxLatitude
        AND E.[longitude] BETWEEN @minLongitude AND @maxLongitude
        AND E.[language] = @language
        GROUP BY
            [route_id],
            [route_title],
            [route_description],
            A.[area_name_en],
            [coverage],
            A.[identifier],
            A.[open],
            [route_owner],
            A.[language]
        ORDER BY distance,a.[route_id] ASC
    `;
    request['count'] = count
    request["minLatitude"] = bounds[0]['latitude'];
    request["maxLatitude"] = bounds[1]['latitude'];
    request["minLongitude"] = bounds[0]['longitude'];
    request["maxLongitude"] = bounds[1]['longitude'];
    debugPrint(query, request);

    try {
        let connect = await connectDB();
        let recordset = await connect.request()
            .input('username', db.NVarChar, username)
            .input('latitude', db.Float, latitude)
            .input('longitude', db.Float, longitude)
            .input('language', db.NVarChar, language)
            .input('count', db.Int, count)
            .input('groupId', db.Int, groupId)
            .input('regionId', db.Int, regionId)
            .input('coiName', db.NVarChar, coiName)
            .input('minLatitude', db.Float, bounds[0]['latitude'])
            .input('maxLatitude', db.Float, bounds[1]['latitude'])
            .input('minLongitude', db.Float, bounds[0]['longitude'])
            .input('maxLongitude', db.Float, bounds[1]['longitude'])
            .query(query);
        let queryPOIsInLOIs = loi.buildqueryPOIsInLOIsString(recordset)
        let LOIs = await poi.queryPOIsInXOIs(recordset, queryPOIsInLOIs, 'loi');
        return LOIs;
    } catch (error) {
        console.error("Error executing query: ", error);
        return [];
    }
}

exports.buildqueryPOIsInLOIsString = function (LOIs) {
    const idList = LOIs.map(loi => loi["xoiId"]);
    const idListString = joinIfAllInt(idList);

    // console.log(idListString)
    const query = `
    SELECT DISTINCT 
      A.[sequence] AS [index], A.[foreignKey], C.[POI_id] AS xoiId, 
      C.[POI_title] AS xoiTitle, C.[identifier], C.[open], C.[latitude],                   
      C.[longitude], C.[rights], (C.[POI_description_1]+ '' + ISNULL(C.[POI_description_2], '')) AS xoiDescription,
      C.[verification], C.[contributor]
    FROM MOE3.dbo.sequence AS A
    INNER JOIN MOE3.dbo.route_planning AS B ON A.[foreignKey] = B.[route_id]
    INNER JOIN MOE3.dbo.dublincore AS C ON A.[POI_id] = C.[POI_id]
    WHERE A.[foreignKey] IN (${idListString})
    ORDER BY [foreignKey], [index]
  `;

    const request = { idList: idListString };
    debugPrint(query, request);
    return query

}

exports.queryLOIsFromList = async function (XOIs) {
    const coiName = "deh"
    const idList = joinIfAllInt(XOIs)
    const coiCondition = coiName !== "deh"
        ? 'JOIN [MOE3].[dbo].[CoiPoint] AS F ON a.route_id = F.point_id AND F.types = \'loi\' AND F.[coi_name] = @coiName WHERE F.[verification] <> 2'
        : 'WHERE A.[verification] <> 2 ';

    let query = `
        SELECT 
            [route_id] AS xoiId, 
            [route_title] AS xoiTitle, 
            [route_description] AS xoiDescription, 
            A.[area_name_en] AS areaNameEn, [coverage], A.[identifier], A.[open], 
            [route_owner] AS rights, 
            A.[language]
        FROM moe3.dbo.route_planning AS A
        ${coiCondition}
        AND [route_id] in (${idList})
    `;

    debugPrint(query, {});

    try {
        let connect = await connectDB();
        let recordset = await connect.request()
            .input('coiName', db.NVarChar, coiName) // 如果是 "deh" 則不傳這個參數
            .query(query);
        return recordset;
    } catch (error) {
        console.error("Error executing query: ", error);
        return [];
    }
}




