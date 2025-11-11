let POI = require('../models/POIs');
let LOI = require('../models/LOIs');
let AOI = require('../models/AOIs');
let SOI = require('../models/SOIs');
let others = require('../models/othersModel');

exports.xoisFromSoi = async function (req, res) {
    const { soiId } = req.body;
    const request = { soiId }
    let fullSoi = await SOI.xoisFromSoi(request)
    let json = {};
    json["results"] = fullSoi
    res.json(json);
}
exports.clickPoiAndCount = async function (req, res) {
    const { poiId } = req.body;
    const request = { poiId }
    let clickNumber = await others.clickPoiAndCount(request)
    let json = {};
    json["results"] = clickNumber
    res.json(json);
}
exports.docentProfile = async function (req, res) {
    const { docentname } = req.body;
    const request = { docentname }
    let docentProfile = await others.docentProfile(request)
    let json = {};
    json["results"] = docentProfile
    res.json(json);
}
exports.uploadPoi = async function (req, res) {
    // 因為使用 multer 處理上傳檔案，所以 req.files 將包含上傳的檔案
    // 而 req.body 將包含其他字段
    // 為了簡化邏輯 把json放在req.body.params
    //address由使用者端生成 mediaFormat還沒放
    try {
        var files = req.files;
        const params = JSON.parse(req.body.params)
        const { userId
        } = params
        const { xoiTitle, latitude, longitude, xoiDescription,
            xoiAddress, origPoi, subject, keyword1, format, rights, language, areaNameEn,
            groupId
        } = params.xoi
        const request = {
            userId, xoiTitle, latitude, longitude, xoiDescription,
            xoiAddress, origPoi, subject, keyword1, format, rights, language, areaNameEn,
            groupId, mediaSet: params.xoi.mediaSet
        }
        files.forEach(element => {
            console.log("fileName: ", element.originalname)
        });
        console.log(params)
        let directory = "E:/new_DEH/player_pictures/media/";

        //在裡面會把request加上檔案資料 加入media欄位
        await others.copyFileAndTransCoding(files, request, directory)


        let message = await others.uploadPoi(request);
        message = await others.uploadPoiMedia(request);
        var json = {}
        json["results"] = { message } //會在results底下放message:
        res.json(json);
    } catch (err) {
        console.log("copy err:", err)
        return "api error"
    }
}