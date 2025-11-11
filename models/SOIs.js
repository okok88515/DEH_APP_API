const { debugPrint, getCount, joinIfAllInt } = require('./dehExtensions');
const { connectDB } = require('../db/dbConnect')
let db = require('mssql');
let geo = require('geolib');
let geocoding = require('../services/geocoding');
let poi = require('./POIs')
let loi = require('./LOIs')
let aoi = require('./AOIs')
let soi = require('./SOIs')
exports.queryXOIs = async function (request, action) {
    const { latitude, longitude, number, distance, language } = request;
    const { username = '', coiName = null, groupId = -1, regionId = -1 } = request;
    let count = getCount(number)

    let point = { latitude: Number(latitude), longitude: Number(longitude) };
    let bounds = geo.getBoundsOfDistance(point, Number(distance)); // get maximum latitude/longitude and minimum latitude/longitude
    const userConditions = {
        user: ' AND A.[SOI_user_name] = @username ',
        // default: ' AND A.[verification] = 1 AND A.[open] = 1'
        // nearby: ' AND A.[verification] = 1 AND A.[open] = 1',
        default: ''
    };
    const userCondition = userConditions[action] || userConditions.default;
    const groupJoinConditions = {
        group:
            `
        JOIN [MOE3].[dbo].[GroupsPoint] AS gp 
        ON gp.point_id = A.[SOI_id]
        AND gp.[types] = 'soi'
        AND gp.foreignkey_id = @groupId
        `,
        region:
            `
        JOIN [MOE3].[dbo].[GroupsPoint] AS gp 
        ON gp.point_id = A.[SOI_id]
        AND gp.[types] = 'soi'
        JOIN [MOE3].[dbo].[RegionsGroup] AS RG ON gp.foreignkey_id = RG.group_id
        AND RG.region_id = @regionId
        `,
        default: '',
    }
    const groupJoinCondition = groupJoinConditions[action] || groupJoinConditions.default;
    const coiJoinCondition = coiName !== "deh"
        ? 'JOIN [MOE3].[dbo].[CoiPoint] AS F ON A.SOI_id = F.point_id AND F.types = \'soi\' AND F.[coi_name] = @coiName '
        : '';
    let verifiConditon = ''
    if (coiName != 'deh') {
        verifiConditon = 'AND F.[verification] = 1 '
    }
    else if (action !== 'user') {
        verifiConditon = ' AND A.[verification] = 1 AND A.[open] = 1 '
    }
    //第一組算距離 第二組找每筆soi資料對應的xoi 第三筆撈資料 第四筆去重
    const query =
        `
WITH DistanceCTE AS (
    SELECT
        C.[POI_id],
        (6371 * acos(
            cos(radians(@latitude)) * cos(radians(C.[latitude])) * cos(radians(C.[longitude]) - radians(@longitude)) +
            sin(radians(@latitude)) * sin(radians(C.[latitude]))
        )) AS distance
    FROM
        moe3.dbo.dublincore AS C
    WHERE
        C.[latitude] BETWEEN @minLatitude AND @maxLatitude AND
        C.[longitude] BETWEEN @minLongitude AND @maxLongitude
),
XOI_CTE AS (
    SELECT
        SOI_id_fk AS SOI_id,
        CASE
            WHEN POI_id != 0 THEN POI_id
            WHEN LOI_id != 0 THEN LOI_id
            WHEN AOI_id != 0 THEN AOI_id
        END AS XOI
    FROM
        moe3.dbo.SOI_story_xoi
    WHERE
        POI_id != 0 OR LOI_id != 0 OR AOI_id != 0
),
RankedDistance AS (
    SELECT
        A.[SOI_id],
        XOI_CTE.XOI,
        D.distance,
        A.[SOI_title],
        A.[SOI_description],
        C.[latitude],
        C.[longitude],
        A.[open],
        A.[SOI_user_name],    
        A.[identifier],
        A.[language],
        A.[area_name_en],
        1 AS source
    FROM
        moe3.dbo.SOI_story AS A
    INNER JOIN XOI_CTE ON A.SOI_id = XOI_CTE.SOI_id
    INNER JOIN moe3.dbo.dublincore AS C ON XOI_CTE.XOI = C.POI_id
    INNER JOIN DistanceCTE AS D ON C.POI_id = D.POI_id
    ${groupJoinCondition}
    ${coiJoinCondition}
    WHERE 1=1
    ${userCondition}
    ${verifiConditon}

    UNION ALL

    SELECT
        A.[SOI_id],
        XOI_CTE.XOI,
        D.distance,
        A.[SOI_title],
        A.[SOI_description],
        C.[latitude],
        C.[longitude],
        A.[open],
        A.[SOI_user_name],
        A.[identifier],
        A.[language],
        A.[area_name_en],
        2 AS source
    FROM
        moe3.dbo.SOI_story AS A
    INNER JOIN XOI_CTE ON A.SOI_id = XOI_CTE.SOI_id
    INNER JOIN moe3.dbo.sequence AS D_seq ON XOI_CTE.XOI = D_seq.foreignKey
    INNER JOIN moe3.dbo.dublincore AS C ON D_seq.POI_id = C.POI_id
    INNER JOIN DistanceCTE AS D ON C.POI_id = D.POI_id
    ${groupJoinCondition}
    ${coiJoinCondition}
    WHERE 1=1
    ${userCondition}
    ${verifiConditon}

    UNION ALL

    SELECT
        A.[SOI_id],
        XOI_CTE.XOI,
        D.distance,
        A.[SOI_title],
        A.[SOI_description],
        C.[latitude],
        C.[longitude],
        A.[open],
        A.[SOI_user_name],
        A.[identifier],
        A.[language],
        A.[area_name_en],
        3 AS source
    FROM
        moe3.dbo.SOI_story AS A
    INNER JOIN XOI_CTE ON A.SOI_id = XOI_CTE.SOI_id
    INNER JOIN moe3.dbo.AOI_POIs AS D_aoi ON XOI_CTE.XOI = D_aoi.AOI_id_fk
    INNER JOIN moe3.dbo.dublincore AS C ON D_aoi.POI_id = C.POI_id
    INNER JOIN DistanceCTE AS D ON C.POI_id = D.POI_id
    ${groupJoinCondition}
    ${coiJoinCondition}
    WHERE 1=1
    ${userCondition}
    ${verifiConditon}
),
FinalRankedDistance AS (
    SELECT
        [SOI_id],
        [SOI_title],
        [SOI_description],
        [latitude],
        [longitude],
        [open],
        [SOI_user_name],
        [identifier],
        [language],
        [area_name_en],
        distance,
        ROW_NUMBER() OVER (PARTITION BY [SOI_id] ORDER BY distance ASC) AS rn
    FROM RankedDistance
)
SELECT TOP ${count}
    [SOI_id] AS xoiId,
    [SOI_title] AS xoiTitle,
    [SOI_description] AS xoiDescription,
    [latitude],
    [longitude],
    CASE 
        WHEN [open] = 1 THEN 'true'
        ELSE 'false'
    END AS [open],
    distance,
    [SOI_user_name] AS rights,    
    [identifier],
    [language],
    [area_name_en] AS areaNameEn,
    'soi' AS [xoiCategory],
    'plural' AS [mediaCategory]
FROM FinalRankedDistance
WHERE rn = 1
AND [language] = @language
ORDER BY distance,[SOI_id] ASC;
`

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
        // let queryPOIsInAOIs = buildqueryPOIsInAOIsString(recordset)
        // let AOIs = await poi.queryPOIsInXOIs(recordset, queryPOIsInAOIs, 'aoi');
        return recordset;
    } catch (error) {
        console.error("Error executing query: ", error);
        return [];
    }
}
exports.xoisFromSoi = async function (request) {
    let Xois = await queryXOIsList(request)
    return await addpendXOIs(Xois)
}
async function queryXOIsList(request) {
    const { soiId } = request
    const query = `
    SELECT [SOI_XOIs_id] AS XoiId, [SOI_id_fk], [POI_id], [AOI_id], [LOI_id] FROM [MOE3].[dbo].[SOI_story_xoi] 
    WHERE SOI_id_fk = @soiId ORDER BY SOI_id_fk ASC`
    debugPrint(query, request);
    let connect = await connectDB();
    let recordset = await connect.request()
        .input('soiId', db.Int, soiId)
        .query(query)
    return recordset
}
async function addpendXOIs(Xois) {
    let poiInSoiList = [];
    let loiInSoiList = [];
    let aoiInSoiList = [];
    let containedXOIs = [];  // 初始化 matchXOIs 列表

    // 根據 XOIs 填充三個不同的列表
    Xois.forEach(item => {
        if (item.POI_id !== 0) poiInSoiList.push(item.POI_id);
        if (item.LOI_id !== 0) loiInSoiList.push(item.LOI_id);
        if (item.AOI_id !== 0) aoiInSoiList.push(item.AOI_id);
    });


    // 異步查詢 POI、LOI 和 AOI
    if (poiInSoiList.length > 0) {
        poiInSoiList = await poi.queryPOIsFromList(poiInSoiList)
        poiInSoiList = await poi.queryMedias(poiInSoiList);
    }
    if (loiInSoiList.length > 0) {
        loiInSoiList = await loi.queryLOIsFromList(loiInSoiList)
        let queryPOIsInLOIs = loi.buildqueryPOIsInLOIsString(loiInSoiList)
        loiInSoiList = await poi.queryPOIsInXOIs(loiInSoiList, queryPOIsInLOIs, 'loi');
    }
    if (aoiInSoiList.length > 0) {
        aoiInSoiList = await loi.queryLOIsFromList(aoiInSoiList)
        let queryPOIsInAOIs = aoi.buildqueryPOIsInAOIsString(aoiInSoiList)
        aoiInSoiList = await poi.queryPOIsInXOIs(aoiInSoiList, queryPOIsInAOIs, 'aoi');
    }


    // 使用展開運算符合併三個列表
    containedXOIs = [...poiInSoiList, ...loiInSoiList, ...aoiInSoiList];

    // 返回合併後的 matchXOIs 列表
    return containedXOIs;
}
