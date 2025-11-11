const { debugPrint, getCount, joinIfAllInt } = require('./dehExtensions');
const { connectDB } = require('../db/dbConnect')
var db = require('mssql');
var geo = require('geolib');
var geocoding = require('../services/geocoding');
var poi = require('./POIs')

exports.queryXOIs = async function (request, action) {
    const { latitude, longitude, number, distance, language } = request;
    const { username = '', coiName = null, groupId = -1, regionId = -1 } = request;
    const count = getCount(number);
    const point = { latitude: Number(latitude), longitude: Number(longitude) };
    const bounds = geo.getBoundsOfDistance(point, Number(distance)); // get maximum latitude/longitude and minimum latitude/longitude
    const userConditions = {
        user: ' AND A.[rights] = @username ',
        // default: ' AND (A.[verification] = 1 OR A.[verification] = 10 OR A.[verification] = 2) AND A.[open] = 1'
        // nearby: ' AND (A.[verification] = 1 OR A.[verification] = 10 OR A.[verification] = 2) AND A.[open] = 1',
        default: ''
    };
    const userCondition = userConditions[action] || userConditions.default;
    const groupJoinConditions = {
        group:
            `
        JOIN [MOE3].[dbo].[GroupsPoint] AS gp 
        ON gp.point_id = A.POI_id
        AND gp.[types] = 'poi'
        AND gp.foreignkey_id = @groupId
        `,
        region:
            `
        JOIN [MOE3].[dbo].[GroupsPoint] AS gp 
        ON gp.point_id = A.POI_id
        AND gp.[types] = 'poi'
        JOIN [MOE3].[dbo].[RegionsGroup] AS RG ON gp.foreignkey_id = RG.group_id
        AND RG.region_id = @regionId
        `,
        default: '',
    }
    const groupJoinCondition = groupJoinConditions[action] || groupJoinConditions.default;


    const coiJoinCondition = coiName !== "deh"
        ? 'JOIN [MOE3].[dbo].[CoiPoint] AS F ON a.POI_id = F.point_id AND F.types = \'poi\' AND F.[coi_name] = @coiName '
        : '';
    let verifiConditon = ''
    //如果不是deh
    if (coiName !== 'deh') {
        verifiConditon = 'AND F.[verification] = 1 '
    }
    else if (action !== 'user') {
        verifiConditon = ' AND A.[verification] = 1 AND A.[open] = 1 '
    }


    const query = `
        SELECT TOP ${count}
            a.[POI_id] AS xoiId, 
            a.[POI_title] AS xoiTitle, 
            a.[latitude] AS latitude, 
            a.[longitude] AS longitude, 
            (a.[POI_description_1] + '' + ISNULL(a.[POI_description_2], '')) AS xoiDescription, 
            a.[POI_address] AS xoiAddress, 
            a.[orig_poi] AS origPoi, 
            a.[subject] AS subject, 
            a.[keyword1] AS keyword1, 
            a.[format] AS format, 
            a.[rights] AS rights, 
            a.[open] AS [open], 
            a.[identifier] AS identifier, 
            a.[language] AS language, 
            a.[area_name_en] AS areaNameEn, 
            (6371 * acos(
                cos(radians(@latitude)) * cos(radians(a.latitude)) * cos(radians(a.longitude) - radians(@longitude)) + 
                sin(radians(@latitude)) * sin(radians(a.latitude))
            )) AS distance 
        FROM [MOE3].[dbo].[dublincore] AS a
        ${groupJoinCondition}
        ${coiJoinCondition}
        WHERE 1=1
        ${userCondition}
        ${verifiConditon}
        AND A.[language] = @language
        AND (a.latitude BETWEEN @minLatitude AND @maxLatitude) 
        AND (a.longitude BETWEEN @minLongitude AND @maxLongitude) 
        ORDER BY distance,a.[POI_id] ASC
    `;
    request['count'] = count;
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
        if (recordset.length === 0) {
            return recordset;
        } else {
            let poisWithMedias = await poi.queryMedias(recordset)
            return poisWithMedias.sort(sortByDistance);;
        }
    } catch (error) {
        console.error("Error executing query: ", error);
        return [];
    }
};

exports.queryMedias = async function (pois) {
    const idList = pois.map(poi => poi.origPoi === 0 || poi.origPoi == null ? poi.xoiId : poi.origPoi);
    let idListString = joinIfAllInt(idList);
    pois.forEach(poi => {
        poi.open = Boolean(parseInt(poi.open));
        poi.xoiCategory = "poi";
    });

    const query = `
        SELECT picture_type AS pictureType, format AS format, picture_url AS pictureUrl, foreignKey AS foreignKey
        FROM [MOE3].[dbo].[mpeg]
        WHERE foreignKey IN (${idListString})
        ORDER BY format DESC, foreignKey ASC
    `;
    request = { idList: idListString };
    debugPrint(query, request);
    try {
        let connect = await connectDB();
        let recordset = await connect.request()
            .query(query);

        return appendMediaSets(pois, recordset);
    } catch (error) {
        console.error("Error executing query: ", error);
        return [];
    }
};

function appendMediaSets(data, mediaset) {
    const _dirname = "https://deh.csie.ncku.edu.tw/";
    const mediaFormats = {
        ".jpg": 1, "jpg": 1, "jpeg": 1, "png": 1, "bmp": 1, "gif": 1,
        "aac": 2, "amr": 2, "wav": 2, "mp3": 2,
        "wmv": 4, "mp4": 4
    };
    const mediaCategories = {
        0: "none",
        1: "image",
        2: "audio",
        4: "video",
        8: "commentary"
    };

    data.forEach((item, index) => {
        const id = item.origPoi === 0 || item.origPoi == null ? item.xoiId : item.origPoi;
        const media = mediaset.filter(mediaItem => mediaItem.foreignKey === id)
            .map(mediaItem => {
                const mediaType = mediaItem.pictureType.toLowerCase();
                if (mediaFormats[mediaType]) {
                    return {
                        mediaType: mediaItem.pictureType,
                        mediaFormat: mediaItem.format,
                        mediaUrl: _dirname + mediaItem.pictureUrl.substring(3)
                    };
                }
                return null;
            })
            .filter(Boolean); // Remove null values

        if (media.length === 0) {
            data[index]["mediaSet"] = [{
                mediaType: "",
                mediaFormat: 0,
                mediaUrl: ""
            }];
        } else {
            data[index]["mediaSet"] = media;
        }

        // Set mediaCategory based on media_format using the mediaCategories object
        const mediaCategory = media.find(m => m.mediaFormat > 0 && m.mediaFormat < 9);
        item.mediaCategory = mediaCategory ? mediaCategories[mediaCategory.mediaFormat] : mediaCategories[0];
    });
    return data;
}

function sortById(a, b) {
    return a.xoiId - b.xoiId;
}
function sortByDistance(a, b) {
    return a.distance - b.distance
}

exports.queryPOIsInXOIs = async function (XOIs, query, xoiCategory) {
    try {
        let connect = await connectDB();
        let POIsInXOIs = await connect.request().query(query);
        const POIsWithMedias = await poi.queryMedias(POIsInXOIs);
        console.log(POIsWithMedias)
        XOIs.forEach(xoi => {
            xoi.containedXOIs = POIsWithMedias.filter(poi =>
                poi.foreignKey === xoi.xoiId
            );
            if (xoi.containedXOIs.length > 0) {
                xoi["xoiCategory"] = xoiCategory;
                xoi['mediaCategory'] = "plural";
                xoi['latitude'] = xoi.containedXOIs[0].latitude;
                xoi['longitude'] = xoi.containedXOIs[0].longitude;
            }
        });
        return XOIs;
    } catch (error) {
        console.error("Error executing query in queryPOIsInXOIs:", error);
        return [];
    }
}
exports.queryPOIsFromList = async function (XOIs) {
    const coiName = "deh"
    const idList = joinIfAllInt(XOIs)
    const coiJoinCondition = coiName !== "deh"
        ? 'JOIN [MOE3].[dbo].[CoiPoint] AS F ON a.POI_id = F.point_id AND F.types = \'poi\' AND F.[coi_name] = @coiName WHERE F.[verification] <> 2 '
        : 'WHERE verification <> 2 ';
    const query = `
        SELECT 
            a.[POI_id] AS xoiId, 
            a.[POI_title] AS xoiTitle, 
            a.[latitude] AS latitude, 
            a.[longitude] AS longitude, 
            (a.[POI_description_1] + '' + ISNULL(a.[POI_description_2], '')) AS xoiDescription, 
            a.[POI_address] AS xoiAddress, 
            a.[orig_poi] AS origPoi, 
            a.[subject] AS subject, 
            a.[keyword1] AS keyword1, 
            a.[format] AS format, 
            a.[rights] AS rights, 
            a.[open] AS [open], 
            a.[identifier] AS identifier, 
            a.[language] AS language, 
            a.[area_name_en] AS areaNameEn,
            a.[contributor]
        FROM [MOE3].[dbo].[dublincore] AS a
        ${coiJoinCondition}
        AND a.[POI_id] IN (${idList})
    `;
    try {
        let connect = await connectDB();
        let recordset = await connect.request()
            .input('coiName', db.NVarChar, coiName)
            .query(query);
        return recordset
    } catch (error) {
        console.error("Error executing query: ", error);
        return [];
    }
};

