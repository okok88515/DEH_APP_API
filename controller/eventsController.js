var fs = require('fs');
var eventModels = require('../models/eventsModel');
var othersModel =
    require
        ('../models/othersModel');


exports.listEvents = async function (req, res) {
    const { userId, coiName } = req.body;
    const request = { userId, coiName };
    // var userId = req.body.userId
    // var coi = req.body.coiName
    let groupList = []
    if (userId != null) {
        groupList = await eventModels.fetchPrivateEvent(request)
    }
    let eventList = await eventModels.fetchPublicEvent(request)
    res.setHeader("Access-Control-Allow-Origin", "*");
    var json = {};
    json["results"] = { groupList, eventList }
    res.json(json);
}

exports.listSessions = async function (req, res) {
    const { eventId, userId } = req.body;
    const request = { eventId, userId }
    await eventModels.insertIntoEvent(request)
    let sessions = await eventModels.getSessionList(request)
    res.setHeader("Access-Control-Allow-Origin", "*");
    var json = {}
    json["results"] = sessions
    res.json(json);
}
exports.gameData = async function (req, res) {
    const { sessionId } = req.body;
    const request = { sessionId }
    let gameData = await eventModels.gameData(request)
    var json = {}
    json["results"] = gameData
    res.json(json);
}
exports.chestList = async function (req, res) {
    const { sessionId, userId } = req.body;
    const request = { sessionId, userId }
    let chestList = await eventModels.chestList(request)
    res.setHeader("Access-Control-Allow-Origin", "*");
    var json = {}
    json["results"] = chestList
    res.json(json);
}
exports.answerChest = async function (req, res) {
    const { chestId, userId, gameId, latitude, longitude, userAnswer } = req.body
    const request = { chestId, userId, gameId, latitude, longitude, userAnswer }
    let message = await eventModels.answerChest(request)
    res.setHeader("Access-Control-Allow-Origin", "*");
    var json = {}
    json["results"] = { message } //會在results底下放message:
    res.json(json);
}
exports.startGame = async function (req, res) {
    const { sessionId, userId } = req.body
    const request = { sessionId, userId }
    let message = await eventModels.startGame(request)
    res.setHeader("Access-Control-Allow-Origin", "*");
    var json = {}
    json["results"] = { message } //會在results底下放message:
    res.json(json);
}
exports.endGame = async function (req, res) {
    const { sessionId, userId } = req.body
    const request = { sessionId, userId }
    let message = await eventModels.endGame(request)
    res.setHeader("Access-Control-Allow-Origin", "*");
    var json = {}
    json["results"] = { message } //會在results底下放message:
    res.json(json);
}
exports.ansRecord = async function (req, res) {
    const { userId, gameId } = req.body
    const request = { userId, gameId }
    let ansRecordData = await eventModels.ansRecord(request)
    res.setHeader("Access-Control-Allow-Origin", "*");
    var json = {}
    json["results"] = ansRecordData
    res.json(json);
}
exports.gameHistory = async function (req, res) {
    const { sessionId, userId } = req.body
    const request = { sessionId, userId }
    let gameHistoryList = await eventModels.gameHistory(request)
    res.setHeader("Access-Control-Allow-Origin", "*");
    var json = {}
    json["results"] = gameHistoryList
    res.json(json);
}
exports.memberPointList = async function (req, res) {
    const { gameId } = req.body
    const request = { gameId }


    let memberPointList = await eventModels.memberPointList(request)
    res.setHeader("Access-Control-Allow-Origin", "*");
    var json = {}
    json["results"] = memberPointList
    res.json(json);

}
exports.userPoint = async function (req, res) {
    const { gameId, userId } = req.body
    const request = { gameId, userId }


    let userPoint = await eventModels.userPoint(request)
    res.setHeader("Access-Control-Allow-Origin", "*");
    var json = {}
    json["results"] = userPoint
    res.json(json);

}
exports.uploadMediaAnswer = async function (req, res) {
    // 因為使用 multer 處理上傳檔案，所以 req.files 將包含上傳的檔案
    // 而 req.body 將包含其他字段
    // 為了簡化邏輯 把json放在req.body.params
    try {
        var files = req.files;
        const params = JSON.parse(req.body.params)
        const { userId, chestId, userAnswer, gameId, latitude, longitude, } = params
        const request = { userId, chestId, userAnswer, gameId, latitude, longitude, }
        files.forEach(element => {
            console.log("fileName: ", element.originalname)
        });
        console.log(params)
        let directory = "E:/new_DEH/player_pictures/record_media/";
        //在裡面會把request加上檔案資料
        await othersModel.copyFileAndTransCoding(files, request, directory)


        let message = await eventModels.answerChest(request);
        message = await eventModels.uploadMediaAnswer(request);
        var json = {}
        json["results"] = { message } //會在results底下放message:
        res.json(json);
    } catch (err) {
        console.log("copy err:", err)
        return "api error"
    }
}

exports.prize = async function (req, res) {
    const { userId } = req.body
    const request = { userId }


    let PrizeList = await eventModels.prize(request)

    var json = {}
    json["results"] = { PrizeList } //會在results底下放message:
    res.json(json);

}



