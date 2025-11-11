const { debugPrint, getCount, joinIfAllInt } = require('./dehExtensions');
const { connectDB } = require('../db/dbConnect')
let db = require('mssql');
var fs = require('fs');
let others = require('./othersModel');

exports.dehQuery = async (query, request) => {
    // 1. 從 query 萃取 @後的變數名稱
    const variablePattern = /@\w+/g;
    const variables = query.match(variablePattern).map(v => v.slice(1)) || [];
    debugPrint(query, request);
    // 2. 建立資料庫連線並設定變數
    try {
        const connect = await connectDB();
        const dbRequest = connect.request();

        for (const variable of variables) {
            const value = request[variable];
            let dbType
            if (value !== undefined) {
                switch (typeof (value)) {
                    case 'string': dbType = db.NVarChar
                        break
                    case 'number':
                        if (Number.isInteger(value)) dbType = db.Int
                        else dbType = db.Float
                        break
                }
                dbRequest.input(variable, dbType, value);
            } else {
                console.warn(`未找到 request 中的變數: ${variable}`);
                dbType = db.NVarChar
                dbRequest.input(variable, dbType, null);
            }

        }

        const recordset = await dbRequest.query(query);
        return recordset;
    } catch (error) {
        console.error('資料庫處理時發生錯誤:', error);
        throw error;
    }
};

exports.clickPoiAndCount = async function (request) {
    const { poiId } = request;
    const query =
        `
    select COUNT(*) AS count from [MOE3].[dbo].[Logs] AS A
    WHERE A.[page] = '/API/poi_detail/' + @poiId
    OR A.[page] = '/API/test/poi_detail/' + @poiId
    OR A.[page] = '/api/v1/others/clickPoiAndCount/' + @poiId
    `
    // debugPrint(query, request);
    try {
        let connect = await connectDB();
        let recordset = await connect.request()
            .input('poiId', db.NVarChar, poiId.toString())
            .query(query)
        return recordset
    } catch (error) {
        console.error("Error executing query: ", error);
        return [];
    }

}

exports.docentProfile = async function (request) {
    const { docentname } = request;
    const query =
        `
    select [telphone] AS telephone,[cellphone],[docent_language] AS docentLanguage,
    [charge], [photography], [introduction], [social_id] AS socialId
    from [MOE3].[dbo].[docent_profile] 
    WHERE [name] = @docentname
    `
    let recordset = await others.dehQuery(query, request)
    debugPrint(query, request);
    try {
        let connect = await connectDB();
        let recordset = await connect.request()
            .input('docentname', db.NVarChar, docentname)
            .query(query)
        return recordset
    } catch (error) {
        console.error("Error executing query: ", error);
        return [];
    }
}


exports.copyFileAndTransCoding = async function (files, request, directory) {
    var type, filename, url;
    var ms = (new Date).getTime();
    for (let i = 0; i < files.length; i++) {
        let file = files[i];
        type = file.mimetype.split("/")[0];
        let format = file.mimetype.split("/")[1];
        filename = type + "/" + ms + (i + 1).toString().padStart(2, '0') + "." + format; // 檔案名稱
        url = "record_media/" + filename; // 檔案URL

        let oldpath = file.path;
        let newpath = directory + filename; // 新檔案的完整路徑
        type = files[i]["mimetype"].split("/")[0];
        if (type == "video") {
            await checkAndConvertVideo(oldpath, newpath)
        }
        copyFile(oldpath, newpath);
        fs.unlink(oldpath, function () {
            console.log("Delete success");
        });

        request[`type0${i + 1}`] = type; // 記錄檔案類型
        request[`filename0${i + 1}`] = path.basename(filename); // 記錄檔案名稱
        request[`url0${i + 1}`] = url; // 記錄檔案URL
        request[`size0${i + 1}`] = file.size; // 記錄檔案size
        if (request.mediaSet && request.mediaSet[i]) {
            request[`mediaFormat0${i + 1}`] = request.mediaSet[i].mediaFormat;
        } // 記錄檔案mediaformat
        switch (type) {
            case 'image': request['media'] = 1
                break
            case 'audio': request['media'] = 2
                break
            case 'video': request['media'] = 4
                break
            default: request['media'] = null
        }
    }
}
function copyFile(src, dest) {
    let readStream = fs.createReadStream(src);

    readStream.once('error', (err) => {
        console.log('Read Stream Error:', err);
    });

    readStream.once('end', () => {
        console.log('done copying');
    });

    let writeStream = fs.createWriteStream(dest);

    writeStream.once('error', (err) => {
        console.log('Write Stream Error:', err);
    });

    writeStream.on('finish', () => {
        console.log('ooook');
    });

    readStream.pipe(writeStream);
}


const childProcess = require('child_process');
const path = require('path')

async function checkAndConvertVideo(oldPath, newPath) {
    try {
        // 使用ffprobe檢查視頻的編碼格式
        const absoluteOldPath = path.resolve(oldPath);
        const codec = await getVideoCodec(absoluteOldPath);
        console.log('Video codec: ' + codec);

        if (codec !== 'h264') {
            // 如果不是h264格式，則轉碼
            await convertCodec(absoluteOldPath, newPath);
        } else {
            console.log('Video is already in h264 format, no conversion needed.');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function getVideoCodec(oldPath) {
    return new Promise((resolve, reject) => {
        const probe_command = [
            'C:\\ffmpeg\\bin\\ffprobe.exe',
            '-v', 'error',
            '-select_streams', 'v:0',
            '-show_entries', 'stream=codec_name',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            oldPath
        ];

        const probe_child = childProcess.spawn(probe_command[0], probe_command.slice(1), {
            stdio: ['ignore', 'pipe', 'ignore'] // 將 stderr 重定向到 ignore
        });

        let codec = '';
        probe_child.stdout.on('data', function (data) {
            codec += data.toString();
        });

        probe_child.stdout.on('end', function () {
            resolve(codec.trim());
        });

        probe_child.on('error', function (err) {
            reject(err);
        });

        probe_child.on('close', function (code) {
            if (code !== 0) {
                reject(new Error('ffprobe process exited with code ' + code));
            }
        });
    });
}

function convertCodec(oldPath, newPath) {
    return new Promise((resolve, reject) => {
        const convert_command = [
            'C:\\ffmpeg\\bin\\ffmpeg.exe',
            '-y',                    // 覆蓋已存在文件
            '-i', oldPath,           // 輸入文件路徑
            '-f', 'mp4',             // 設置目標格式為mp4
            '-vcodec', 'h264',       // 設置視頻編碼格式為h264
            newPath                  // 輸出文件路徑
        ];

        const convert_child = childProcess.spawn(convert_command[0], convert_command.slice(1), {
            stdio: ['ignore', 'ignore', 'ignore'] // 將 stderr 重定向到 ignore
        });


        convert_child.on('error', function (err) {
            reject(err);
        });

        convert_child.on('close', function (code) {
            if (code === 0) {
                console.log(`Video has been converted and saved to: ${newPath}`);
                resolve();
            } else {
                reject(new Error('ffmpeg process exited with code ' + code));
            }
        });
    });
}
exports.uploadPoi = async function (request) {
    const { userId, xoiTitle, latitude, longitude, xoiDescription,
        xoiAddress, subject, keyword, format, language, areaNameEn,
        groupId
    } = request
    //先插入dublinCore 再插入groupPoint 再插入CoiPoint 再插入Mpeg
    //先查userName
    let query = `SELECT [user_name],[role] FROM [MOE3].[dbo].[user_profile] WHERE [USER_ID] = @userId`;
    let recordset = await others.dehQuery(query, request)
    if (recordset.length > 0) {
        request.userName = recordset[0].user_name
        request.identifier = recordset[0].role
    }
    else {
        return "no this user"
    }
    //因為有一些欄位沒有在make實作 先放預設值
    query = `
    INSERT INTO [MOE3].[dbo].[dublincore] (
        [poi_title],[subject],[area_name_en],[type1],[keyword1],[keyword2],[keyword3],[keyword4],
        [period],[year],[height],[poi_address],[latitude],[longitude],[scope],[poi_description_1], [poi_description_2],
        [language],[format],[verification],[rights],[contributor],[creator],[publisher],[POI_source],
        [identifier],[open],[POI_added_time], [media])
        OUTPUT inserted.POI_id
           VALUES(
            @xoiTitle, @subject, @areaNameEn, '人文景觀', @keyword1, '', '', '',
            '現代台灣', YEAR(CURRENT_TIMESTAMP), 0, @xoiAddress, @latitude, @longitude, 30, @xoiDescription, '',
            @language, @format, 0, @userName, @userName, @userName, @userName, '', 
            @identifier, 0, CURRENT_TIMESTAMP, @media)
    `

    recordset = await others.dehQuery(query, request)
    if (recordset.length > 0) {
        request.poiId = recordset[0].POI_id
    }
    else {
        return "something error"
    }

    if (groupId > -1) {
        query = ` 
        INSERT INTO [MOE3].[dbo].[GroupsPoint](
            [types],[point_id],[foreignKey_id]
        ) VALUES (
            'poi', @poiId, @groupId
        )
        `
        recordset = await others.dehQuery(query, request)
    }
    query = ` 
        INSERT INTO [MOE3].[dbo].[CoiPoint](
            [types],[point_id],[coi_name], [verification], [feedback_mes]
        ) VALUES (
            'poi', @poiId, 'deh', 0, '驗證未通過'
        )
        `
    recordset = await others.dehQuery(query, request)
}
exports.uploadPoiMedia = async function (request) {
    const {
        type01, filename01, url01, size01,
        type02, filename02, url02, size02,
        type03, filename03, url03, size03,
        type04, filename04, url04, size04,
        type05, filename05, url05, size05,
        userId, userName, PoiId, mediaFormat
    } = request;
    let connect;
    //format還沒弄 type也是 
    connect = await connectDB();
    const insertMedia = async (index) => {
        let query = `
            INSERT INTO [MOE3].[dbo].[mpeg] (
                [picture_name], [picture_type], [picture_url], [picture_size],       
                [picture_upload_user], [picture_source], [picture_rights],
                [picture_upload_time], [foreignKey], [format]
            ) VALUES(
                @filename${index}, @type${index}, @url${index}, @size${index},
                @userName, @userName, @userName,
                CURRENT_TIMESTAMP, @poiId, @mediaFormat${index}
            )
        `;
        return recordset = await others.dehQuery(query, request)
    };

    if (filename01) await insertMedia('01');
    if (filename02) await insertMedia('02');
    if (filename03) await insertMedia('03');
    if (filename04) await insertMedia('04');
    if (filename05) await insertMedia('05');

    return "upload successful"
};

