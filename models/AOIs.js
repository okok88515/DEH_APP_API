const { debugPrint, getCount, joinIfAllInt } = require('./dehExtensions');
const { connectDB } = require('../db/dbConnect')
let db = require('mssql');
let geo = require('geolib');
let geocoding = require('../services/geocoding');
let poi = require('./POIs')
let loi = require('./LOIs')
let aoi = require('./AOIs')

exports.queryXOIs = async function (request, action) {
    const { latitude, longitude, number, distance, language } = request;
    const { username = '', coiName = null, groupId = -1, regionId = -1 } = request;
    let count = getCount(number)

    let point = { latitude: Number(latitude), longitude: Number(longitude) };
    let bounds = geo.getBoundsOfDistance(point, Number(distance)); // get maximum latitude/longitude and minimum latitude/longitude
    const userConditions = {
        user: ' AND A.[owner] = @username ',
        // default: ' AND A.[verification] = 1 AND A.[open] = 1'
        // nearby: ' AND A.[verification] = 1 AND A.[open] = 1',
        default: ''
    };
    const userCondition = userConditions[action] || userConditions.default;

    const groupJoinConditions = {
        group:
            `
        JOIN [MOE3].[dbo].[GroupsPoint] AS gp 
        ON gp.point_id = A.[AOI_id]
        AND gp.[types] = 'aoi'
        AND gp.foreignkey_id = @groupId
        `,
        region:
            `
        JOIN [MOE3].[dbo].[GroupsPoint] AS gp 
        ON gp.point_id = A.[AOI_id]
        AND gp.[types] = 'aoi'
        JOIN [MOE3].[dbo].[RegionsGroup] AS RG ON gp.foreignkey_id = RG.group_id
        AND RG.region_id = @regionId
        `,
        default: '',
    }
    const groupJoinCondition = groupJoinConditions[action] || groupJoinConditions.default;
    const coiJoinCondition = coiName !== "deh"
        ? 'JOIN [MOE3].[dbo].[CoiPoint] AS F ON A.AOI_id = F.point_id AND F.types = \'aoi\' AND F.[coi_name] = @coiName '
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
            [AOI_id] AS xoiId, 
            [title] AS xoiTitle, 
            [description] AS xoiDescription, 
            A.[area_name_en] AS areaNameEn, [coverage], A.[identifier], A.[open], 
            [owner] AS rights, 
            A.[language],
            MIN((6371 * acos(cos(radians(@latitude)) * cos(radians(E.[latitude])) * cos(radians(E.[longitude]) - radians(@longitude)) + 
            sin(radians(@latitude)) * sin(radians(E.[latitude]))))) AS distance
        FROM moe3.dbo.AOI AS A
        INNER JOIN moe3.dbo.user_profile AS B ON A.[owner] = B.[user_name]
        INNER JOIN moe3.dbo.area AS C ON A.[area_name_en] = C.[area_name_en]
        INNER JOIN moe3.dbo.AOI_POIs AS D ON A.[AOI_id] = D.[AOI_id_fk]
        INNER JOIN moe3.dbo.dublincore AS E ON E.POI_id = D.POI_id
        ${groupJoinCondition}
        ${coiJoinCondition}
        WHERE 1=1
        ${userCondition}
        ${verifiConditon}
        AND A.[language] = @language
        AND E.[latitude] BETWEEN @minLatitude AND @maxLatitude
        AND E.[longitude] BETWEEN @minLongitude AND @maxLongitude
        GROUP BY
            [AOI_id],
            [title],
            [description],
            A.[area_name_en],
            [coverage],
            A.[identifier],
            A.[open],
            [owner],
            A.[language]
        ORDER BY distance,a.[AOI_id] ASC
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
        let queryPOIsInAOIs = aoi.buildqueryPOIsInAOIsString(recordset)
        let AOIs = await poi.queryPOIsInXOIs(recordset, queryPOIsInAOIs, 'aoi');
        return AOIs;
    } catch (error) {
        console.error("Error executing query: ", error);
        return [];
    }
}

exports.buildqueryPOIsInAOIsString = function (AOIs) {
    const idList = AOIs.map(loi => loi["xoiId"]);
    const idListString = joinIfAllInt(idList);
    const query = `
    SELECT 
      A.[POI_id] AS xoiId, A.[AOI_id_fk] AS foreignKey,
      C.[POI_title] AS xoiTitle, C.[identifier], C.[open], C.[latitude], 
      C.[longitude], C.[rights], (C.[POI_description_1]+ '' + ISNULL(C.[POI_description_2], '')) AS xoiDescription,
      C.[verification], C.[contributor]
    FROM MOE3.dbo.AOI_POIs AS A
    INNER JOIN MOE3.dbo.dublincore AS C ON A.[POI_id] = C.[POI_id]
    WHERE A.[AOI_id_fk] IN (${idListString})
    ORDER BY A.AOI_id_fk
  `;
    const request = { idList: idListString };
    debugPrint(query, request);
    return query
}

exports.queryAOIsFromList = async function (XOIs) {
    const coiName = "deh"
    const idList = joinIfAllInt(XOIs)
    const coiCondition = coiName !== "deh"
        ? 'JOIN [MOE3].[dbo].[CoiPoint] AS F ON A.AOI_id = F.point_id AND F.types = \'aoi\' AND F.[coi_name] = @coiName WHERE F.[verification] <> 2'
        : 'WHERE A.[verification] <> 2 ';

    let query = `
    SELECT 
            [AOI_id] AS xoiId, 
            [title] AS xoiTitle, 
            [description] AS xoiDescription, 
            A.[area_name_en] AS areaNameEn, [coverage], A.[identifier], A.[open], 
            [owner] AS rights, 
            A.[language]
        FROM moe3.dbo.AOI AS A
        ${coiCondition}
        AND [AOI_id] IN (${idList})
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
