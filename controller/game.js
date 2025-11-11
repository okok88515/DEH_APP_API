var temp_event = require('../models/temp_event');
var db = require('mssql');
var geo = require('geolib');
var util = require('util');
// var formidable = require('formidable');
var langTable = require('../utility/clang_table');
var classTable = require('../utility/class_table');
var fs = require('fs');
var moment = require('moment');
//var uuid = require('uuid');


//get all poi
exports.GroupPOIs = function (req, res) {
    console.log(".get request huzi...");

    group_id = req.body.group_id

    temp_event.GroupPOIs(group_id, function (POIdata) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.json(POIdata);
        console.log("...done!");
    });

}

//get user group list
exports.getUserGroupList = async function (req, res) {
    console.log(".POST request huzi...");
    var search_id;

    console.log(req.body.user_id);
    search_id = req.body.user_id
    coi = req.body.coi
    console.log(search_id);
    let groupList = await temp_event.getUserGroupList(search_id, coi)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(groupList);
    console.log("...done!");
    return res


}

//*************** */
exports.getGameID = function (req, res) {
    console.log(".POST request get group game...");
    console.log(req.body.room_id);
    room_id = req.body.room_id

    temp_event.getGameID(room_id, function (GameID) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.json(GameID);
        console.log(GameID);
        console.log("...done!");
    });

}

exports.getGameData = async function (req, res) {

    console.log(".POST request get group game...");

    // console.log(req.body.game_id);

    game_id = req.body.game_id

    let GameData = await temp_event.getGameData(game_id)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(GameData);
    console.log(GameData);
    console.log("...done!");

}

//get group chests
// exports.getGameChest_old = function (req, res) {
//     console.log(".POST request getGameChest...");

//     // console.log(req.body.game_id);
//     game_id = req.body.game_id
//     user_id = req.body.user_id

//     temp_event.getGameChest(game_id, user_id, function (ChestList) {
//         res.setHeader("Access-Control-Allow-Origin", "*");
//         res.json(ChestList);
//         console.log("...done!");
//     });

// }
exports.getGameChest = async function (req, res) {
    console.log(".POST request getGameChest...");

    // console.log(req.body.game_id);
    room_id = req.body.room_id
    game_id = req.body.game_id
    user_id = req.body.user_id

    let chestList = await temp_event.getGameChest(room_id, game_id, user_id)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(chestList);
    console.log("...done!");


}

exports.chestMinus = async function (req, res) {
    console.log(".POST request chestMinus...");
    chest_id = req.body.chest_id;
    user_id = req.body.user_id;
    game_id = req.body.game_id;
    lat = req.body.lat;
    lng = req.body.lng;
    user_answer = req.body.user_answer;

    let Outcome = await temp_event.chestMinus(chest_id, user_answer, user_id, game_id, lat, lng)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(Outcome);
    console.log("...done!");

}

exports.insertAnswer = function (req, res) {
    console.log(".POST request get group chest...");

    var record = {}

    console.log(req.body.user_id);
    record["user_id_id"] = req.body.user_id
    record["answer"] = req.body.answer
    record["correctness"] = req.body.correctness
    record["chest_id_id"] = req.body.chest_id
    record["game_id_id"] = req.body.game_id
    record["lat"] = req.body.lat
    record["lng"] = req.body.lng
    record["point"] = req.body.point

    temp_event.insertAnswer(record, function (Outcome) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.json(Outcome);
        console.log("...done!");
    });
}


//************************start game
exports.startGame = async function (req, res) {
    console.log(".POST request startGame...");
    room_id = req.body.room_id
    user_id = req.body.user_id
    let Outcome = await temp_event.startGame(room_id, user_id)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(Outcome);
    console.log("...done!");

}

//get user answer record
exports.getAnsRecord = function (req, res) {
    user_id = req.body.user_id
    game_id = req.body.game_id

    temp_event.getAnsRecord(user_id, game_id, function (AnsRecordData) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.json(AnsRecordData);
        console.log("...done!");
    });

}

exports.getChestMedia = function (req, res) {
    chest_id = req.body.chest_id

    temp_event.getChestMedia(chest_id, function (AnsRecordData) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.json(AnsRecordData);
        console.log("...done!");
    });
}

exports.getGroupRoomList = function (req, res) {
    group_id = req.body.group_id

    joinEvents(req, res);

    temp_event.getRoomList(group_id, function (AnsRecordData) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.json(AnsRecordData);
        console.log("...done!");
    });
}

exports.AnswerMedia = function (req, res) {
    console.log(".POST request get group chest...");

    var record = {}
    // record["user_id"] = req.body.user_id
    // record["chest_id"] = req.body.chest_id
    // record["type"] = req.body.type
    // record["file"] = req.body.file
    // record["file_name"] = req.body.filename
    // record["txt"] = req.body.txt

    // var form = new formidable.IncomingForm();
    // form.parse(req, function (err, fields, files) {

    //     console.log('received fields: ');
    //     console.log(fields);
    //     console.log('received files: ');
    //     console.log(files);

    //     var type01,type02,type03,type04,type05 = null;
    //     var filename01, filename02, filename03, filename04, filename05 = null;
    //     var url01,url02,url03,url04,url05 = null;

    //     var format, oldpath, newpath
    //     var base_url = "E:/new_DEH/player_pictures/record_media/";

    //     var ms = (new Date).getTime()


    //     //media
    //      if (files.file01){

    //         type01 = files.file01.type.split("/")[0];
    //         format = files.file01.type.split("/")[1];
    //         filename01 = type01 + "-" + ms + "01." + format;
    //         url01 = "record_media/" + filename01;

    //         oldpath = files.file01.path;
    //         newpath = base_url + filename01;


    //         copyFile(oldpath, newpath, filename01);
    //         fs.unlink(oldpath, function(){
    //             console.log("Deleta success");
    //         });

    //         record["type01"] = type01
    //         record["file_name01"] = filename01
    //         record["url01"] = url01
    //     }
    //     if (files.file02) {

    //         type02 = files.file02.type.split("/")[0];
    //         format = files.file02.type.split("/")[1];
    //         filename02 = type02 + "-" + ms + "02." + format;
    //         url02 = "record_media/" + filename02;


    //         oldpath = files.file02.path;
    //         newpath = base_url + filename02;

    //         copyFile(oldpath, newpath, filename02);
    //         fs.unlink(oldpath, function(){
    //             console.log("Deleta success");
    //         });

    //         record["type02"] = type02
    //         record["file_name02"] = filename02
    //         record["url02"] = url02
    //     }
    //     if (files.file03) {

    //         type03 = files.file03.type.split("/")[0];
    //         format = files.file03.type.split("/")[1];
    //         filename03 = type03 + "-" + ms + "03." + format;
    //         url03 = "record_media/" + filename03;

    //         oldpath = files.file03.path;
    //         newpath = base_url + filename03;

    //         copyFile(oldpath, newpath, filename03);
    //         fs.unlink(oldpath, function(){
    //             console.log("Deleta success");
    //         });

    //         record["type03"] = type03
    //         record["file_name03"] = filename03
    //         record["url03"] = url03
    //     }
    //     if (files.file04) {

    //         type04 = files.file04.type.split("/")[0];
    //         format = files.file04.type.split("/")[1];
    //         filename04 = type04 + "-" + ms + "04." + format;
    //         url04 = "record_media/" + filename04;

    //         oldpath = files.file04.path;
    //         newpath = base_url + filename04;

    //         copyFile(oldpath, newpath, filename04);
    //         fs.unlink(oldpath, function(){
    //             console.log("Deleta success");
    //         });

    //         record["type04"] = type04
    //         record["file_name04"] = filename04
    //         record["url04"] = url04

    //     }
    //     if (files.file05) {

    //         type05 = files.file05.type.split("/")[0];
    //         format = files.file05.type.split("/")[1];
    //         filename05 = type05 + "-" + ms + "05." + format;
    //         url05 = "record_media/" + filename05;

    //         copyFile(oldpath, newpath, filename05);
    //         fs.unlink(oldpath, function(){
    //             console.log("Deleta success");
    //         });

    //         fs.rename(oldpath, newpath, function (err) {
    //             if (err) throw err;
    //             console.log('save file to ' + newpath);
    //         });

    //         record["type05"] = type05
    //         record["file_name05"] = filename05
    //         record["url05"] = url05
    //     }

    //     //database
    //     record["user_id"] = fields.user_id
    //     record["chest_id"] = fields.chest_id
    //     record["txt"] = fields.txt
    //     record["game_id"] = fields.game_id
    //     record["lat"] = fields.lat
    //     record["lng"] = fields.lng
    //     record["point"] = fields.point

    //     temp_event.uploadMedia(record, function (Outcome) {
    //         res.setHeader("Access-Control-Allow-Origin", "*");
    //         res.json(Outcome);
    //         console.log("...done!");
    //     });

    // });
}


exports.getMemberPoint = function (req, res) {
    game_id = req.body.game_id

    temp_event.getMenberPointList(game_id, function (ListData) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.json(ListData);
        console.log("...done!");
    });
}


exports.getGameHistory = function (req, res) {
    room_id = req.body.room_id

    temp_event.getGameList(room_id, function (ListData) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.json(ListData);
        console.log("...done!");
    });


}

exports.endGame = async function (req, res) {
    room_id = req.body.room_id
    let ListData = await temp_event.endGame(room_id, user_id)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(ListData);
    console.log("...done!");


}

function joinEvents(req, res) {
    user_id = req.body.user_id
    event_id = req.body.group_id

    temp_event.insertMember(user_id, event_id, function (Message) {
        if (Message != null)
            console.log("insert success");
        else
            console.log("insert fail");
    });
}

function copyFile(src, dest, filename) {
    let readStream = fs.createReadStream(src);

    readStream.once('error', (err) => {
        console.log(err);
    });

    readStream.once('end', () => {
        console.log('done copying');
    });

    let writeStream = fs.createWriteStream(dest);
    readStream.pipe(writeStream);

    writeStream.on('finish', function () {
        console.log('ooook');
    });
}

