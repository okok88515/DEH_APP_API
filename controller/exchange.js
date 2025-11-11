var temp = require('../models/temp');
var db = require('mssql');
var geo = require('geolib');
var util = require('util');
// var formidable = require('formidable');
var langTable = require('../utility/clang_table');
var classTable = require('../utility/class_table');
var fs = require('fs');
var moment = require('moment');

//get prize list
exports.getPrize = async function (req, res) {
    //console.log(".POST request hiwang prize...");
    var search_id;

    //console.log(req.body.user_id);
    search_id = req.body.user_id

    let PrizeList = await temp.getPrize(search_id)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(PrizeList);
    //console.log("...done!");
}

exports.getPrizeAttribute = async function (req, res) {
    //console.log(".POST request hiwang prize attribute...");
    var search_id;

    //console.log(req.body.player_prize_id);
    search_id = req.body.player_prize_id;

    let PrizeAttributeList = await temp.getPrizeAttribute(search_id)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(PrizeAttributeList);
    //console.log("...done!");

}

exports.getPrizeDistributed = async function (req, res) {
    //console.log(".POST hiwang set prize distributed...");
    var game_id;
    var room_id;
    var user_id;
    var rank;

    // console.log(req.body.game_id);
    // console.log(req.body.room_id);
    // console.log(req.body.user_id);
    // console.log(req.body.rank);
    game_id = req.body.game_id;
    room_id = req.body.room_id;
    user_id = req.body.user_id;
    rank = req.body.rank;

    let PrizeAttributeList = await temp.getPrizeDistributed(game_id, room_id, user_id, rank)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(PrizeAttributeList);
    //console.log("...done!");
}