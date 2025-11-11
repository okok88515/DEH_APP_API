const { debugPrint, getCount, joinIfAllInt } = require('./dehExtensions');
const { connectDB } = require('../db/dbConnect')
let db = require('mssql');
let geo = require('geolib');
let geocoding = require('../services/geocoding');
let poi = require('./POIs')
let loi = require('./LOIs')
let aoi = require('./AOIs')
let soi = require('./SOIs')

exports.listRegion = async function (request) {
    const { coiName, language } = request;


    const query =
        `
    SELECT [region_id] AS id,[region_name] AS name,[region_info] AS info 
    FROM [MOE3].[dbo].[Regions] 
    WHERE 1=1
    AND [coi_name] = @coiName 
    AND [language] = @language
    AND [verification] = 1 AND [open] = 1
    AND [manage_start_time] < GETDATE()
    AND [manage_end_time] > GETDATE()
    ORDER BY [region_id] ASC
    `
    debugPrint(query, request);
    try {
        let connect = await connectDB();
        let recordset = await connect.request()
            .input('language', db.NVarChar, language)
            .input('coiName', db.NVarChar, coiName)
            .query(query);
        return recordset;

    } catch (error) {
        console.error("Error executing query: ", error);
        return [];
    }
}