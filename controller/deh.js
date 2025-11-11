var db = require('mssql');
var geo = require('geolib');
var util = require('util');
var POI = require('../models/POI');
var LOI = require('../models/LOI');
var AOI = require('../models/AOI');
var SOI = require('../models/SOI');
var User = require('../models/user');
// var formidable = require('formidable');
var langTable = require('../utility/clang_table');
var classTable = require('../utility/class_table');
var fs = require('fs');
var groups = require('../models/groups');
var events = require('../models/events');
const { Console } = require('console');
const { json } = require('body-parser');
const { date } = require('check-types');
var moment = require('moment');
const { connectDB } = require('../db/dbConnect')
global.debugPrintLevel = 1
//0 for none
//1 for system flow
//2 for dubug indicate
//3 for input & output User
exports.autoLog = async function (req) {
  console.log("Starting to log..");
  const parsedParams = req.body.params ? JSON.parse(req.body.params) : undefined;

  const logParametersSource = (parsedParams && parsedParams.logParameters) || req.body.logParameters || {};

  const {
    userId = -1,
    deviceID = '',
    appVer = '',
    userLatitude = '',
    userLongitude = '',
    pre_page = ''
  } = logParametersSource;


  // const {
  //   logParameters: {
  //     userId = -1,
  //     // ip = req.ip,
  //     // dt = '',
  //     // page = '',
  //     deviceID = '',
  //     appVer = '',
  //     userLatitude = '',
  //     userLongitude = '',
  //     pre_page = ''
  //   } = {} // 這個空對象是當 logParameters 不存在時的默認值
  // } = req.body;

  let userIp = req.ip;
  if (userIp != null) {
    userIp = userIp.replace(/^::ffff:/, '');
  }
  else {
    userIp = ""
  }
  //prepage先塞req.body的內容好了
  const x = { ...req.body }
  delete x.logParameters
  var _pre_page = JSON.stringify(x).slice(0, 250)
  let page;
  if (req.originalUrl === "/api/v1/others/clickPoiAndCount" && req.body.poiId != null) {
    page = `${req.originalUrl}/${req.body.poiId}`;
  } else if (req.originalUrl === "/api/v1/groups/members" && req.body.groupId != null) {
    //因為app不用顯示這個次數 在拿member的時候記錄
    page = `${req.originalUrl}/${req.body.groupId}`;
  }
  else {
    page = req.originalUrl;
  }


  var query = `
        INSERT INTO [MOE3].[dbo].[Logs] (
            user_id, ip, dt, page, dveviceID, 
            appVer, ulatitude, ulongitude, pre_page
            ) 
        VALUES(
            @userId, @userIp, '${moment().format('YYYY-MM-DD HH:mm:ss')}',
            @page, @deviceID,
            @appVer, @userLatitude, @userLongitude, @_pre_page
            )
        `;
  // console.log("do query : " + query);
  try {
    let connect = await connectDB();
    let recordset = await connect.request()
      .input('userId', db.Int, userId)
      .input('userIp', db.NVarChar, userIp)
      .input('page', db.NVarChar, page)
      .input('deviceID', db.NVarChar, deviceID)
      .input('appVer', db.NVarChar, appVer)
      .input('userLatitude', db.NVarChar, userLatitude)
      .input('userLongitude', db.NVarChar, userLongitude)
      .input('_pre_page', db.NVarChar, _pre_page)
      .query(query)
    // let recordset = await new db.Request().query(query);
    console.log("end logging")

  } catch (error) {
    console.error("Error inserting log: ", error);
  }

}


// User log part
// Each request have to log
exports.uploadUserLog = async function (req, res, next) {
  // console.log("log...");
  var log = {};

  log["ip"] = req.connection.remoteAddress
  log["useraccount"] = req.query.useraccount;
  log["ula"] = req.query.ula;
  log["ulo"] = req.query.ulo;
  log["action"] = req.query.action;
  log["dveviceID"] = req.query.devid;

  let success = await User.uploadLogData(log)
  if (success) {
    // console.log("...log done truly!");
  } else {
    // console.log("...log error!")
  }
  next();
}
exports.uploadUserLogJSON = function (req, res, next) {

  console.log("log...");
  var log = {};
  // console.log(req.body)
  log["ip"] = req.connection.remoteAddress
  log["useraccount"] = req.body.username;
  log["ula"] = req.body.lat;
  log["ulo"] = req.body.lng;
  log["action"] = req.body.action;
  log["dveviceID"] = req.body.devid;
  log["user_id"] = req.body.user_id;

  User.uploadLogData(log, function (success) {
    if (success) {
      console.log("...log done truly!");
    } else {
      console.log("...log error!")
    }
    next();
  });

}


// COI part
// Check Sys COI List
exports.getCOIList = function (req, res) {
  console.log("get COI name...");

  User.checkCOIList(function (COIlist, success) {
    console.log("COI List:" + COIlist);
    var json = {};
    if (success) {
      console.log("...get the COI List!");
      json["result"] = COIlist;
      res.json(json);
    } else {
      console.log("...error to get COI List!");
      res.json({ message: "Check Members Failed!" });
    }
  });
}

// = = POI part
// default: 50 data, language = '中文'
exports.nearbyPOIs = async function (req, res) {
  console.log(".GET request...");
  var poi = {};
  poi["lat"] = req.query.lat;
  poi["lng"] = req.query.lng;
  poi["dis"] = req.query.dis;
  poi["num"] = req.query.num;
  poi["iclass"] = classTable.tableExists(req.params.identifier_class);
  poi["clang"] = langTable.tableExists(req.params.clang);
  poi["tp"] = req.query.tp;
  poi["fmt"] = req.query.fmt;
  poi['coi_name'] = req.query.coi_name;

  // return POI json Object(Array) including POI information and POI media
  let POIdata = await POI.getNearbyPOIs(poi)
  var json = {};
  json["results"] = POIdata;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(json);
  console.log("...done!");
  // return json
}

exports.groupNearbyPOIs = async function (req, res) {
  // console.log(".GET request...");
  var poi = {};
  poi["lat"] = req.query.lat;
  poi["lng"] = req.query.lng;
  poi["dis"] = req.query.dis;
  poi["num"] = req.query.num;
  poi["iclass"] = classTable.tableExists(req.params.identifier_class);
  poi["clang"] = langTable.tableExists(req.params.clang);
  poi["tp"] = req.query.tp;
  poi["fmt"] = req.query.fmt;
  poi["g_id"] = req.query.group_id;
  poi["coi_name"] = req.query.coi_name;

  // return POI json Object(Array) including POI information and POI media
  let POIdata = await POI.getGroupNearbyPOIs(poi)
  var json = {};
  json["results"] = POIdata;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(json);
}

exports.regionNearbyPOIsV1 = async function (req, res) {
  // console.log(".GET request...");
  // console.log(req.query);
  var poi = {};
  poi["lat"] = req.query.lat;
  // console.log("poi: " + poi["lat"]);
  poi["lng"] = req.query.lng;
  poi["dis"] = req.query.dis;
  poi["num"] = req.query.num;
  // request["iclass"] = classTable.tableExists(req.params.identifier_class);
  poi["clang"] = langTable.tableExists(req.params.clang);
  poi["tp"] = req.query.tp;
  // request["fmt"] = req.body.fmt;
  poi["r_id"] = req.query.region_id;
  poi["coi_name"] = req.query.coi_name;
  // console.log("poi: " + poi["lat"]);
  // return POI json Object(Array) including POI information and POI media
  let POIdata = await POI.getRegionNearbyPOIsV1(poi)
  var json = {};
  json["results"] = POIdata;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(json);
  // LOI.getRegionNearbyLOIsV1(loi, function (LOIdata) {
  //   var json = {};
  //   json["results"] = LOIdata;
  //   res.setHeader("Access-Control-Allow-Origin", "*");
  //   res.json(json);
  //   console.log("...done!");
  // });
}
// )
//   var json = {};
//   json["results"] = pois;
//   res.setHeader("Access-Control-Allow-Origin", "*");
//   res.json(json);
//   console.log("...done!");
// }

exports.searchPOI = async function (req, res) {
  // console.log(".GET request...");
  var poi = {};
  poi["id"] = req.query.q;

  // return a POI json Object including POI information
  let POIdata = await POI.searchPOI(poi)
  var json = {};
  json["results"] = POIdata;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(json);
  // console.log("...done!");
}

exports.uploadPOI = async function (req, res) {
  console.log(".POST request...");
  console.log(req.req)

  let [success, mes, id] = await POI.uploadPOI(req)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({ message: mes, id: id });

  console.log("...done!");
}

// = = LOI part
exports.nearbyLOIs = async function (req, res) {
  // console.log(".GET request...");
  var loi = {};
  loi["lat"] = req.query.lat;
  loi["lng"] = req.query.lng;
  loi["num"] = req.query.num;
  loi["dis"] = req.query.dis;
  loi["iclass"] = classTable.tableExists(req.params.identifier_class);
  loi["clang"] = langTable.tableExists(req.params.clang);
  loi["coi_name"] = req.query.coi_name;
  console.log(loi)

  let LOIdata = await LOI.getNearbyLOIs(loi)
  var json = {};
  json["results"] = LOIdata;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(json);
  // console.log("...done!");
}


exports.groupNearbyLOIs = async function (req, res) {
  // console.log(".GET request...");
  var loi = {};
  loi["lat"] = req.query.lat;
  loi["lng"] = req.query.lng;
  loi["num"] = req.query.num;
  loi["dis"] = req.query.dis;
  loi["iclass"] = classTable.tableExists(req.params.identifier_class);
  loi["clang"] = langTable.tableExists(req.params.clang);
  loi["g_id"] = req.query.group_id;
  loi["coi_name"] = req.query.coi_name;

  let LOIdata = await LOI.getGroupNearbyLOIs(loi)
  var json = {};
  json["results"] = LOIdata;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(json);
}
exports.regionNearbyLOIsV1 = async function (req, res) {
  // console.log(".GET request...");
  console.log(req.query);
  var loi = {};
  loi["lat"] = req.query.lat;
  // console.log("poi: " + poi["lat"]);
  loi["lng"] = req.query.lng;
  loi["dis"] = req.query.dis;
  loi["num"] = req.query.num;
  // request["iclass"] = classTable.tableExists(req.params.identifier_class);
  loi["clang"] = langTable.tableExists(req.params.clang);
  loi["tp"] = req.query.tp;
  // request["fmt"] = req.body.fmt;
  loi["r_id"] = req.query.region_id;
  loi["coi_name"] = req.query.coi_name;
  // console.log("poi: " + poi["lat"]);
  // return POI json Object(Array) including POI information and POI media
  let LOIdata = await LOI.getRegionNearbyLOIsV1(loi)
  var json = {};
  json["results"] = LOIdata;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(json);
}

exports.searchLOI = async function (req, res) {
  //console.log(".GET request...");
  var loi = { "id": req.query.q };

  let LOIdata = await LOI.searchLOI(loi["id"])
  var json = {};
  json["results"] = LOIdata;
  res.setHeader("Access-Control-Allow-Oirgin", "*");
  res.json(json);
  // console.log("...done!");
}

// = = AOI part
exports.nearbyAOIs = async function (req, res) {
  // console.log(".GET request...");
  var aoi = {};
  aoi["lat"] = req.query.lat;
  aoi["lng"] = req.query.lng;
  aoi["num"] = req.query.num;
  aoi["dis"] = req.query.dis;
  aoi["iclass"] = classTable.tableExists(req.params.identifier_class);
  aoi["clang"] = langTable.tableExists(req.params.clang);
  aoi["coi_name"] = req.query.coi_name;

  let AOIdata = await AOI.getNearbyAOIs(aoi)
  var json = {};
  json["results"] = AOIdata;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(json);
}

exports.groupNearbyAOIs = async function (req, res) {
  // console.log(".GET request...");
  var aoi = {};
  aoi["lat"] = req.query.lat;
  aoi["lng"] = req.query.lng;
  aoi["num"] = req.query.num;
  aoi["dis"] = req.query.dis;
  aoi["iclass"] = classTable.tableExists(req.params.identifier_class);
  aoi["clang"] = langTable.tableExists(req.params.clang);
  aoi["g_id"] = req.query.group_id;
  aoi["coi_name"] = req.query.coi_name;

  let AOIdata = await AOI.getGroupNearbyAOIs(aoi)
  var json = {};
  json["results"] = AOIdata;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(json);
}

exports.searchAOI = async function (req, res) {
  // console.log(".GET request...");
  var aoi = { "id": req.query.q };
  let AOIdata = await AOI.searchAOI(aoi["id"])
  var json = {};
  json["results"] = AOIdata;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(json);
}

// = = SOI part
exports.nearbySOIs = async function (req, res) {
  // console.log(".GET request...");
  var soi = {};
  soi["lat"] = req.query.lat;
  soi["lng"] = req.query.lng;
  soi["num"] = req.query.num;
  soi["dis"] = req.query.dis;
  soi["iclass"] = classTable.tableExists(req.params.identifier_class);
  soi["clang"] = langTable.tableExists(req.params.clang);
  soi["coi_name"] = req.query.coi_name;

  // let sois = await SOI.getNearbySOIsV2(soi)
  // var json = {};
  // json["results"] = sois;
  // res.setHeader("Access-Control-Allow-Origin", "*");
  // if(global.debugPrintLevel >= 1)console.log("...done!");
  // var end = new Date().getTime();

  // //console.log((end - start) / 1000 + "sec")
  // console.log("size:" + JSON.stringify(json).length  )
  // res.json(json);
  //return SOI json Object(Array) including SOI information and SOI media
  let SOIdata = await SOI.getNearbySOIs(soi)
  var json = {};
  json["results"] = SOIdata;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(json);
}

exports.groupNearbySOIs = async function (req, res) {
  // console.log(".GET request...");
  var soi = {};
  soi["lat"] = req.query.lat;
  soi["lng"] = req.query.lng;
  soi["num"] = req.query.num;
  soi["dis"] = req.query.dis;
  soi["iclass"] = classTable.tableExists(req.params.identifier_class);
  soi["clang"] = langTable.tableExists(req.params.clang);
  soi["g_id"] = req.query.group_id;
  soi["coi_name"] = req.query.coi_name;

  // return SOI json Object(Array) including SOI information and SOI media
  let SOIdata = await SOI.getGroupNearbySOIs(soi)
  var json = {};
  json["results"] = SOIdata;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(json);
}

exports.searchSOI = async function (req, res) {
  var soi = {};
  soi["id"] = req.query.q;

  // return a SOI json including XOI's id, title, identifier, latitude, longitude
  let SOIdata = await SOI.searchSOI(soi["id"])
  var json = {};
  json["results"] = SOIdata;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(json);
}

// = = User part
exports.login = async function (req, res) {
  console.log(".POST request...");
  var username = req.body.username;
  var password = req.body.password;
  var coiname = req.body.coi_name;
  // console.log(coiname)

  let [success, user] = await User.verifyPassword(username, password, coiname)
  res.setHeader("Access-Control-Allow-Oirigin", "*");
  if (success == true) {
    res.json(user);
  } else {
    res.json({ message: "Not found!" });
  }
  console.log("...done!");
}


exports.getUserPOIs = async function (req, res) {
  console.log(".POST request...");
  var pois = {};
  pois["username"] = req.body.username;
  pois["lat"] = req.query.lat;
  pois["lng"] = req.query.lng;
  pois["dis"] = req.query.dis;
  pois["num"] = req.query.num;
  pois["coi_name"] = req.query.coi_name;

  let POIdata = await POI.getUserPOIs(pois)
  var json = {};
  json["results"] = POIdata;
  res.json(json);

}
exports.getUserPOIsJSON = async function (req, res) {
  console.log(".POST request...");
  var pois = {};
  pois["username"] = req.body.username;
  pois["lat"] = req.body.lat;
  pois["lng"] = req.body.lng;
  pois["dis"] = req.body.dis;
  pois["num"] = req.body.num;
  pois["coi_name"] = req.body.coi_name;
  // console.log(pois)
  let POIdata = await POI.getUserPOIs(pois)
  var json = {};
  json["results"] = POIdata;
  console.log(json);
  res.json(json);
}
exports.getUserGroupPOIs = async function (req, res) {
  // console.log(".POST request...");
  var pois = {};
  pois["username"] = req.body.username;
  pois["lat"] = req.query.lat;
  pois["lng"] = req.query.lng;
  pois["dis"] = req.query.dis;
  pois["num"] = req.query.num;
  pois["g_id"] = req.query.group_id;
  pois["coi_name"] = req.query.coi_name;

  let POIdata = await POI.getUserGroupPOIs(pois)
  var json = {};
  json["results"] = POIdata;
  res.json(json);
}

exports.getUserLOIs = async function (req, res) {
  // console.log(".POST request...");
  var lois = {};
  lois["username"] = req.body.username;
  lois["lat"] = req.query.lat;
  lois["lng"] = req.query.lng;
  lois["dis"] = req.query.dis;
  lois["num"] = req.query.num;
  lois["coi_name"] = req.query.coi_name;

  let LOIdata = await LOI.getUserLOIs(lois)
  var json = {};
  json["results"] = LOIdata;
  res.json(json);
}
exports.getUserLOIsJSON = async function (req, res) {
  console.log(".POST request...");
  var lois = {};
  lois["username"] = req.body.username;
  lois["lat"] = req.body.lat;
  lois["lng"] = req.body.lng;
  lois["dis"] = req.body.dis;
  lois["num"] = req.body.num;
  lois["coi_name"] = req.body.coi_name;
  let LOIdata = await LOI.getUserLOIs(lois)
  var json = {};
  json["results"] = LOIdata;
  res.json(json);

}

exports.getUserGroupLOIs = async function (req, res) {
  // console.log(".POST request...");
  var lois = {};
  lois["username"] = req.body.username;
  lois["lat"] = req.query.lat;
  lois["lng"] = req.query.lng;
  lois["dis"] = req.query.dis;
  lois["num"] = req.query.num;
  lois["g_id"] = req.query.group_id;
  lois["coi_name"] = req.query.coi_name;
  let LOIdata = await LOI.getUserGroupLOIs(lois)
  var json = {};
  json["results"] = LOIdata;
  res.json(json);
}

exports.getUserAOIs = async function (req, res) {
  console.log(".POST request...");
  var aois = {};
  aois["username"] = req.body.username;
  aois["lat"] = req.query.lat;
  aois["lng"] = req.query.lng;
  aois["dis"] = req.query.dis;
  aois["num"] = req.query.num;
  aois["coi_name"] = req.query.coi_name;
  var json = {};
  let AOIs = await AOI.queryUserAOIs(aois)
  if (aois["username"] != "") {
    json["results"] = AOIs
  }
  // console.log(Object.keys(json).length)
  // console.log(json)
  res.json(json);
  // AOI.getUserAOIsResponseNormalize(aois, function (AOIdata) {
  //   var json = {};
  //   json["results"] = AOIdata;
  //   res.json(json);
  // });
}
exports.getUserAOIsJSON = async function (req, res) {
  console.log(".POST request...");
  var aois = {};
  aois["username"] = req.body.username;
  aois["lat"] = req.body.lat;
  aois["lng"] = req.body.lng;
  aois["dis"] = req.body.dis;
  aois["num"] = req.body.num;
  aois["coi_name"] = req.body.coi_name;

  let AOIdata = await AOI.getUserAOIs(aois)
  var json = {};
  json["results"] = AOIdata;
  res.json(json);
}

exports.getUserGroupAOIs = async function (req, res) {
  // console.log(".POST request...");
  var aois = {};
  aois["username"] = req.body.username;
  aois["lat"] = req.query.lat;
  aois["lng"] = req.query.lng;
  aois["dis"] = req.query.dis;
  aois["num"] = req.query.num;
  aois["g_id"] = req.query.group_id;
  aois["coi_name"] = req.query.coi_name;

  let AOIdata = await AOI.getUserGroupAOIs(aois)
  var json = {};
  json["results"] = AOIdata;
  res.json(json);
}

exports.getUserSOIs = async function (req, res) {
  console.log(".POST request...");
  var sois = {};
  sois["username"] = req.body.username;
  sois["lat"] = req.query.lat;
  sois["lng"] = req.query.lng;
  sois["dis"] = req.query.dis;
  sois["num"] = req.query.num;
  sois["coi_name"] = req.query.coi_name;

  let SOIdata = await SOI.getUserSOIs(sois)
  var json = {};
  json["results"] = SOIdata;
  res.json(json);
}

exports.getUserSOIsJSON = async function (req, res) {
  console.log(".POST request...");
  var sois = {};
  sois["username"] = req.body.username;
  sois["lat"] = req.body.lat;
  sois["lng"] = req.body.lng;
  sois["dis"] = req.body.dis;
  sois["num"] = req.body.num;
  sois["coi_name"] = req.body.coi_name;

  let SOIdata = await SOI.getUserSOIs(sois)
  var json = {};
  json["results"] = SOIdata;
  res.json(json);
}

exports.getUserGroupSOIs = async function (req, res) {
  // console.log(".POST request...");
  var sois = {};
  sois["username"] = req.body.username;
  sois["lat"] = req.query.lat;
  sois["lng"] = req.query.lng;
  sois["dis"] = req.query.dis;
  sois["num"] = req.query.num;
  sois["g_id"] = req.query.group_id;
  sois["coi_name"] = req.query.coi_name;
  let SOIdata = await SOI.getUserGroupSOIs(sois)
  var json = {};
  json["results"] = SOIdata;
  res.json(json);
}

exports.getDocentInfo = function (req, res) {
  console.log(".GET request...");
  var username = req.params.username;
  User.findByUsername(username, function (success, docent) {
    if (success) {
      res.json(docent);
    } else {
      res.json({ message: "Not found!" });
    }
  });
  console.log("...done!");
}

exports.groupMessage = async function (req, res) {
  // console.log(".POST Group Message request...");
  let mes = await groups.groupMessage(req)

  var json = {}
  json['message'] = mes
  res.json(json);
}

exports.notificationGroup = async function (req, res) {
  // console.log(".notificationGroup Groups request...");
  var json = new Object();
  var array_name = new Array();
  var objItem = new Object();

  const { success, GNameArr, SNameArr, GidArr, GroleArr } = await groups.notificationGroup(req)
  if (GNameArr == null) {
    res.json({ message: "no notification" });
  } else {
    for (var i = 0; i < GNameArr.length; i++) {
      objItem.group_name = GNameArr[i];
      objItem.sender_name = SNameArr[i];
      objItem.group_id = GidArr[i];
      objItem.group_role = GroleArr[i];
      array_name.push(objItem);
      objItem = {};
    }
    json['result'] = array_name;
    json['message'] = "have notification"
    console.log("Return array :" + array_name);
    if (success) {
      res.json(json);
    } else {
      res.json({ message: "Notification Failed!" });
    }
  }
}

exports.createGroup = async function (req, res) {
  // console.log(".POST Groups request...");

  const { success, mes, id } = await groups.createGroup(req)
  if (success) {
    res.json({ message: mes, group_id: id });
    // console.log("...done!");
  } else {
    res.json({ message: mes });
  }
  /*
  groups.createGroup(req, function (success, mes, id) {
    //res.setHeader("Access-Control-Allow-Origin", "*");
    if (success) {
      res.json({ message: mes, group_id: id });
      console.log("...done!");
    } else {
      res.json({ message: mes });
    }
  });*/
}

exports.searchGroup = async function (req, res) {
  // console.log(".POST Groups request...");
  var json = new Object();
  var array_name = new Array();
  var objItem = new Object();

  // let success, NameArr, RoleArr, InfoArr, IdArr = await groups.searchGroup_old(req)
  // if (!success) {
  //   res.json({ result: "search Group Failed!" });
  // } else {
  //   for (var i = 0; i < NameArr.length; i++) {
  //     objItem.group_name = NameArr[i];
  //     objItem.role = RoleArr[i];
  //     objItem.group_info = InfoArr[i];
  //     objItem.group_id = IdArr[i];
  //     array_name.push(objItem);
  //     objItem = {};
  //   }
  //   json['result'] = array_name;
  // }
  const { username, language, coi_name } = req.body;

  let recordset = await groups.searchGroup(req.body)
  json['result'] = recordset
  // console.log("Return array :" , array_name);
  // console.log("Search Result : ", json)
  res.json(json);
}

exports.listUserGroups = async function (req, res) {
  var json = new Object();
  let request = {
    'username': req.body.username,
    'language': req.body.language,
    'coi_name': req.body.coi_name,
  }
  let recordset = await groups.searchGroup(request)
  json['results'] = recordset
  res.json(json);
}


exports.listGroups = async function (req, res) {
  // console.log(".POST Groups request...");
  var json = new Object();
  var array_name = new Array();
  var objItem = new Object();

  const { success, NameArr } = await groups.listGroups(req)
  if (!success) {
    res.json({ result: "search Group Failed!" });
    // console.log("Fail");
  } else {
    // for (var i = 0; i < NameArr.length; i++) {
    //   objItem.group_name = NameArr[i];
    //   array_name.push(objItem);
    //   objItem = {};
    // }
    json['result'] = NameArr;
    // console.log("Return array :" , array_name);
    // console.log("Search Result : ", json);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(json);
  }
  // console.log("...done!");
}


exports.updateGroup = async function (req, res) {
  const { success, message } = await groups.updateGroup(req)
  //res.setHeader("Access-Control-Allow-Origin", "*");
  var json = {}
  json['message'] = message
  res.json(json);
}

exports.checkMembers = async function (req, res) {
  // console.log("checkMembers  request...");
  var json = new Object();
  var array_name = new Array();
  var objItem = new Object();

  const { success: success, username_arr: usernameArr, role_arr: roleArr }
    = await groups.checkMembers(req)
  if (usernameArr == null) {
    res.json({ message: "no another member!" });
  } else {
    for (var i = 0; i < usernameArr.length; i++) {
      objItem.member_name = usernameArr[i];
      objItem.member_role = roleArr[i];
      array_name.push(objItem);
      objItem = {};
    }
    json['result'] = array_name;
    json['message'] = "have members"
    if (success) {
      res.json(json);
    } else {
      res.json({ message: "Check Members Failed!" });
    }
  }
}

exports.memberJoinRequest = async function (req, res) {
  // console.log("Member POST Group Message request...");
  const { success, mes } = await groups.memberJoinRequest(req)
  var json = {}
  json['message'] = mes
  res.json(json);

}


exports.CountClick = async function (req, res) {
  // console.log("count click..");
  // console.log(req.body.poi_id);
  poi_id = req.body.poi_id

  let count = await POI.getCountClick(poi_id);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(count);
  // console.log("...done!");
}

exports.createTempAccount = function (req, res) {

  User.createTempAccount(req, function (success, mes, user_name, user_id, password) {
    if (success) {
      //Create Successfully, return username, id and password
      res.json({ message: mes, username: user_name, id: user_id, password: password });
      console.log("...done!");
    } else {
      res.json({ message: mes });
      console.log("...fail!");
    }
  });

}

exports.attachTempAccount = function (req, res) {
  User.attachTempAccount(req, function (success, mes) {
    if (success) {
      res.json({ message: mes });
      console.log("...done")
    } else {
      res.json({ message: mes });
      console.log("...fail!");
    }
  });


}

exports.insertIntoGroup = function (req, res) {
  groups.insertIntoGroup(req, function (success, mes, group_id) {
    if (success) {
      res.json({ message: mes, group_id: group_id });
      console.log("...done")
    } else {
      res.json({ message: mes })
      console.log("...fail");
    }
  })

}

exports.searchEvents = function (req, res) {
  coi_name = req.body['coi'];
  events.searchEvents(coi_name, function (success, NameArr) {
    if (!success) {
      res.json({ result: "search Events Failed!" });
      console.log("Fail");
    } else {
      res.json(NameArr)
      // console.log("Search Result : ", NameArr);
    }
    console.log("...done!");
  });
}

exports.getEventRoomList = function (req, res) {
  event_id = req.body.group_id

  events.getRoomList(event_id, function (AnsRecordData) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(AnsRecordData);
    console.log("...done!");
  });
}
//// Below is programed by juanmh aka moebear @ 202101
exports.getUserPOIsJSONResponseNormalize = async function (req, res) {
  console.log(".POST request...");
  var request = {};
  request["username"] = req.body.username;
  request["lat"] = req.body.lat;
  request["lng"] = req.body.lng;
  request["dis"] = req.body.dis;
  request["num"] = req.body.num;
  request["coi_name"] = req.body.coi_name;
  // console.log(pois)
  let POIs = await POI.queryUserPOIs(request)
  var json = {};
  if (request["username"] != "") {
    json["results"] = POIs
  }
  console.log(json)
  res.json(json);
}
exports.getUserLOIsJSONResponseNormalize = async function (req, res) {
  console.log(".POST request...");
  var request = {};
  request["username"] = req.body.username;
  request["lat"] = req.body.lat;
  request["lng"] = req.body.lng;
  request["dis"] = req.body.dis;
  request["num"] = req.body.num;
  request["coi_name"] = req.body.coi_name;
  let LOIs = await LOI.queryUserLOIs(request)
  var json = {}
  if (request["username"] != "") {
    json["results"] = LOIs
  }
  // console.log(LOIs["results"][0])
  res.json(json);
}
exports.getUserAOIsJSONResponseNormalize = async function (req, res) {
  console.log(".POST request...");
  var request = {};
  request["username"] = req.body.username;
  request["lat"] = req.body.lat;
  request["lng"] = req.body.lng;
  request["dis"] = req.body.dis;
  request["num"] = req.body.num;
  request["coi_name"] = req.body.coi_name;
  var json = {};
  let AOIs = await AOI.queryUserAOIs(request)
  if (request["username"] != "") {
    json["results"] = AOIs
  }
  // console.log(Object.keys(json).length)
  // console.log(json)
  res.json(json);

}
exports.getUserSOIsJSONResponseNormalize = async function (req, res) {
  console.log(".POST request...");
  var request = {};
  request["username"] = req.body.username;
  request["lat"] = req.body.lat;
  request["lng"] = req.body.lng;
  request["dis"] = req.body.dis;
  request["num"] = req.body.num;
  request["coi_name"] = req.body.coi_name;
  let SOIs = await SOI.requestUserSOIs(request)
  var json = {};
  if (request["username"] != "") {
    json["results"] = SOIs
  }
  // console.log(json["results"])
  // for (i=0; i< json["results"].length; i++) {
  //   json["results"][i]["xoiCategory"] = "soi";
  //   json["results"][i]["mediaCategory"] = "plural";
  //   json["results"][i]["latitude"] = json["results"][i]["containedXOIs"][0]["latitude"]
  //   json["results"][i]["longitude"] = json["results"][i]["containedXOIs"][0]["longitude"]
  // }
  // console.log(json)
  // console.log(json["results"][0]["containedXOIs"])
  res.json(json);
}
exports.CountClickWithColumnName = async function (req, res) {
  // console.log("count click..");
  // console.log(req.body.poi_id);
  poi_id = req.body.poi_id

  let count = await POI.getCountClickWithColumnName(poi_id)
  res.setHeader("Access-Control-Allow-Origin", "*");
  var json = {}
  json["results"] = count[0]
  // console.log(count[0]["count"]);
  res.json(count[0]);
  // console.log("...done!");

}
exports.searchNearbyPOIs = async function (req, res) {
  console.log(".GET request...");
  var request = {};
  request["lat"] = req.body.lat;
  request["lng"] = req.body.lng;
  request["dis"] = req.body.dis;
  request["num"] = req.body.num;
  request["language"] = req.body.language;
  // poi["tp"] = req.query.tp;
  request["format"] = req.body.format;
  request['coi_name'] = req.body.coi_name;
  // return POI json Object(Array) including POI information and POI media
  let nearbyPOIs = await POI.getNearbyPOIsV2(request)
  var json = {};
  json["results"] = nearbyPOIs
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(json);
  // console.log("...done!");
  // console.log(json)
  return json
}

exports.searchNearbyLOIs = async function (req, res) {
  console.log(".GET request...");
  var request = {};
  request["lat"] = req.body.lat;
  request["lng"] = req.body.lng;
  request["num"] = req.body.num;
  request["dis"] = req.body.dis;
  request["language"] = req.body.language;
  request["coi_name"] = req.body.coi_name;

  let lois = await LOI.getNearbyLOIsV2(request)
  var json = {};
  json["results"] = lois;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(json);
  // console.log("...done!");
  // console.log(json["results"][0])
  return json
}
exports.searchNearbyAOIs = async function (req, res) {
  console.log(".GET request...");
  var request = {};
  request["lat"] = req.body.lat;
  request["lng"] = req.body.lng;
  request["num"] = req.body.num;
  request["dis"] = req.body.dis;
  // request["iclass"] = classTable.tableExists(req.params.identifier_class);
  // request["clang"] = langTable.tableExists(req.params.clang);
  request["clang"] = req.body.language
  request["coi_name"] = req.body.coi_name;

  let aois = await AOI.getNearbyAOIsV2(request)

  var json = {};
  json["results"] = aois;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(json);
  console.log("...done!");
}
exports.searchNearbySOIs = async function (req, res) {
  if (global.debugPrintLevel >= 1) console.log(".GET request...");
  var request = {};
  request["lat"] = req.body.lat;
  request["lng"] = req.body.lng;
  request["num"] = req.body.num;
  request["dis"] = req.body.dis;
  request["clang"] = req.body.language
  request["coi_name"] = req.body.coi_name;
  var start = new Date().getTime();

  let sois = await SOI.getNearbySOIsV2(request)
  var json = {};
  json["results"] = sois;
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (global.debugPrintLevel >= 1) console.log("...done!");
  var end = new Date().getTime();

  console.log((end - start) / 1000 + "sec")
  console.log("size:" + JSON.stringify(json).length)
  res.json(json);
}
exports.getUserGroupPOIsV2 = async function (req, res) {
  if (global.debugPrintLevel >= 1) console.log(".POST request...");
  var request = {};
  request["username"] = req.body.username;
  request["lat"] = req.body.lat;
  request["lng"] = req.body.lng;
  request["dis"] = req.body.dis;
  request["num"] = req.body.num;
  request["groupid"] = req.body.group_id;
  request["coi_name"] = req.body.coi_name;
  let pois = await POI.getUserGroupPOIsV2(request)
  var json = {};
  json["results"] = pois;
  if (global.debugPrintLevel >= 0) console.log(pois)
  res.json(json);

  // POI.getUserGroupPOIs(pois, function (POIdata) {
  //   var json = {};
  //   json["results"] = POIdata;
  //   res.json(json);
  // });
}
exports.getUserGroupPOIsV3 = async function (req, res) {
  if (global.debugPrintLevel >= 1) console.log(".POST request...");
  var request = {};
  request["username"] = req.body.username;
  request["lat"] = req.body.lat;
  request["lng"] = req.body.lng;
  request["dis"] = req.body.dis;
  request["num"] = req.body.num;
  request["groupid"] = req.body.groupid;
  request["coi_name"] = req.body.coi_name;
  let pois = await POI.getUserGroupPOIsV2(request)
  var json = {};
  json["results"] = pois;
  if (global.debugPrintLevel >= 0) console.log(pois)
  res.json(json);
}
exports.getUserGroupLOIsV3 = async function (req, res) {
  if (global.debugPrintLevel >= 1) console.log(".POST request...");
  var request = {};
  request["username"] = req.body.username;
  request["lat"] = req.body.lat;
  request["lng"] = req.body.lng;
  request["dis"] = req.body.dis;
  request["num"] = req.body.num;
  request["group_id"] = req.body.groupid;
  request["coi_name"] = req.body.coi_name;
  request["language"] = req.body.language;
  let lois = await LOI.getUserGroupLOIsV2(request)
  var json = {};
  json["results"] = lois;
  res.json(json);
}
exports.getUserGroupAOIsV3 = async function (req, res) {
  console.log(".POST request...");
  var request = {};
  request["username"] = req.body.username;
  request["lat"] = req.body.lat;
  request["lng"] = req.body.lng;
  request["dis"] = req.body.dis;
  request["num"] = req.body.num;
  request["g_id"] = req.body.groupid;
  request["coi_name"] = req.body.coi_name;
  let aois = await AOI.getUserGroupAOIsV2(request)
  var json = {};
  json["results"] = aois;
  res.json(json)
}
exports.getUserGroupSOIsV3 = async function (req, res) {
  // console.log(".POST request...");
  var request = {};
  request["username"] = req.body.username;
  request["lat"] = req.body.lat;
  request["lng"] = req.body.lng;
  request["dis"] = req.body.dis;
  request["num"] = req.body.num;
  request["g_id"] = req.body.groupid;
  request["coi_name"] = req.body.coi_name;
  let sois = await SOI.getUserGroupSOIsV2(request)
  var json = {};
  json["results"] = sois;
  res.json(json);
}
exports.getUserGroupLOIsV2 = async function (req, res) {
  if (global.debugPrintLevel >= 1) console.log(".POST request...");
  var request = {};
  request["username"] = req.body.username;
  request["lat"] = req.body.lat;
  request["lng"] = req.body.lng;
  request["dis"] = req.body.dis;
  request["num"] = req.body.num;
  request["group_id"] = req.body.group_id;
  request["coi_name"] = req.body.coi_name;
  request["language"] = req.body.language;
  let lois = await LOI.getUserGroupLOIsV2(request)
  var json = {};
  json["results"] = lois;
  res.json(json);
}
exports.getUserGroupAOIsV2 = async function (req, res) {
  console.log(".POST request...");
  var request = {};
  request["username"] = req.body.username;
  request["lat"] = req.body.lat;
  request["lng"] = req.body.lng;
  request["dis"] = req.body.dis;
  request["num"] = req.body.num;
  request["g_id"] = req.body.group_id;
  request["coi_name"] = req.body.coi_name;
  let aois = await AOI.getUserGroupAOIsV2(request)
  var json = {};
  json["results"] = aois;
  res.json(json)
}
exports.getUserGroupSOIsV2 = async function (req, res) {
  // console.log(".POST request...");
  var request = {};
  request["username"] = req.body.username;
  request["lat"] = req.body.lat;
  request["lng"] = req.body.lng;
  request["dis"] = req.body.dis;
  request["num"] = req.body.num;
  request["g_id"] = req.body.group_id;
  request["coi_name"] = req.body.coi_name;
  let sois = await SOI.getUserGroupSOIsV2(request)
  var json = {};
  json["results"] = sois;
  res.json(json);
}

exports.searchGroupV2 = async function (req, res) {
  if (global.debugPrintLevel >= 1) console.log(".POST Groups request...");
  var request = {}
  request["coi_name"] = req.body.coi_name
  request["language"] = req.body.language
  request["user_id"] = req.body.user_id
  let UserGroups = await groups.searchGroupV2(request)
  var json = {};
  json["results"] = UserGroups;
  console.log(json);
  if (global.debugPrintLevel >= 1) console.log("...done...");
  res.json(json);
}

exports.listRegion = async function (req, res) {
  if (global.debugPrintLevel >= 1) console.log(".POST Regions request...");
  var request = {}
  request["coi_name"] = req.body.coi_name
  request["language"] = req.body.language
  //request["user_id"] = req.body.user_id
  let UserRegions = await groups.listRegion(request)
  var json = {};
  json["results"] = UserRegions;
  console.log(json);
  if (global.debugPrintLevel >= 1) console.log("...done...");
  res.json(json);
}

exports.listGroupV2 = async function (req, res) {
  if (global.debugPrintLevel >= 1) console.log(".POST Groups request...");
  var request = {}
  request["coi_name"] = req.body.coi_name
  request["language"] = req.body.language
  //request["user_id"] = req.body.user_id
  let UserGroups = await groups.listGroupV2(request)
  var json = {};
  json["results"] = UserGroups;
  console.log(json);
  if (global.debugPrintLevel >= 1) console.log("...done...");
  res.json(json);
}

exports.groupNearbyPOIsV2 = async function (req, res) {
  // console.log(".GET request...");
  var request = {};
  request["lat"] = req.body.lat;
  request["lng"] = req.body.lng;
  request["dis"] = req.body.dis;
  request["num"] = req.body.num;
  // request["iclass"] = classTable.tableExists(req.params.identifier_class);
  request["clang"] = req.body.language
  request["tp"] = req.body.tp;
  // request["fmt"] = req.body.fmt;
  request["g_id"] = req.body.group_id;
  request["coi_name"] = req.body.coi_name;

  // return POI json Object(Array) including POI information and POI media
  let pois = await POI.getGroupNearbyPOIsV2(request)
  var json = {};
  json["results"] = pois;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(json);
  // console.log("...done!");
}
exports.regionNearbyPOIs = async function (req, res) {
  // console.log(".GET request...");
  var request = {};
  request["lat"] = req.body.lat;
  request["lng"] = req.body.lng;
  request["dis"] = req.body.dis;
  request["num"] = req.body.num;
  // request["iclass"] = classTable.tableExists(req.params.identifier_class);
  request["clang"] = req.body.language
  request["tp"] = req.body.tp;
  // request["fmt"] = req.body.fmt;
  request["r_id"] = req.body.region_id;
  request["coi_name"] = req.body.coi_name;

  // return POI json Object(Array) including POI information and POI media
  let pois = await POI.getRegionNearbyPOIs(request)
  var json = {};
  json["results"] = pois;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(json);
  // console.log("...done!");
}
exports.groupNearbyLOIsV2 = async function (req, res) {
  // console.log(".GET request...");
  var request = {};
  request["lat"] = req.body.lat;
  request["lng"] = req.body.lng;
  request["num"] = req.body.num;
  request["dis"] = req.body.dis;
  // request["iclass"] = classTable.tableExists(req.params.identifier_class);
  request["clang"] = req.body.language
  request["g_id"] = req.body.group_id;
  request["coi_name"] = req.body.coi_name;

  let lois = await LOI.getGroupNearbyLOIsV2(request)
  var json = {};
  json["results"] = lois;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(json);
  // console.log("...done!");
}
exports.regionNearbyLOIs = async function (req, res) {
  // console.log(".GET request...");
  var request = {};
  request["lat"] = req.body.lat;
  request["lng"] = req.body.lng;
  request["num"] = req.body.num;
  request["dis"] = req.body.dis;
  // request["iclass"] = classTable.tableExists(req.params.identifier_class);
  request["clang"] = req.body.language
  request["r_id"] = req.body.region_id;
  request["coi_name"] = req.body.coi_name;

  let lois = await LOI.getRegionNearbyLOIs(request)
  var json = {};
  json["results"] = lois;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(json);
  // console.log("...done!");
}
exports.groupNearbyAOIsV2 = async function (req, res) {
  // console.log(".GET request...");
  var request = {};
  request["lat"] = req.body.lat;
  request["lng"] = req.body.lng;
  request["num"] = req.body.num;
  request["dis"] = req.body.dis;
  // require["iclass"] = classTable.tableExists(req.params.identifier_class);
  request["clang"] = req.body.language
  request["g_id"] = req.body.group_id;
  request["coi_name"] = req.body.coi_name;

  let aois = await AOI.getGroupNearbyAOIsV2(request)
  var json = {};
  json["results"] = aois;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(json);
  // console.log("...done!");
  // AOI.getGroupNearbyAOIs(aoi, function (AOIdata) {
  //   var json = {};
  //   json["results"] = AOIdata;
  //   res.setHeader("Access-Control-Allow-Origin", "*");
  //   res.json(json);
  //   console.log("...done!");
  // });
}
exports.regionNearbyAOIs = async function (req, res) {
  // console.log(".GET request...");
  var request = {};
  request["lat"] = req.body.lat;
  request["lng"] = req.body.lng;
  request["num"] = req.body.num;
  request["dis"] = req.body.dis;
  // require["iclass"] = classTable.tableExists(req.params.identifier_class);
  request["clang"] = req.body.language
  request["r_id"] = req.body.region_id;
  request["coi_name"] = req.body.coi_name;

  let aois = await AOI.getRegionNearbyAOIs(request)
  var json = {};
  json["results"] = aois;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(json);
  // console.log("...done!");
  // AOI.getGroupNearbyAOIs(aoi, function (AOIdata) {
  //   var json = {};
  //   json["results"] = AOIdata;
  //   res.setHeader("Access-Control-Allow-Origin", "*");
  //   res.json(json);
  //   console.log("...done!");
  // });
}
exports.groupNearbyLOIsV2 = async function (req, res) {
  console.log(".GET request...");
  var request = {};
  request["lat"] = req.body.lat;
  request["lng"] = req.body.lng;
  request["num"] = req.body.num;
  request["dis"] = req.body.dis;
  // request["iclass"] = classTable.tableExists(req.params.identifier_class);
  request["clang"] = req.body.language
  request["g_id"] = req.body.group_id;
  request["coi_name"] = req.body.coi_name;

  let lois = await LOI.getGroupNearbyLOIsV2(request)
  var json = {};
  json["results"] = lois;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(json);
  console.log("...done!");

}

exports.groupNearbySOIsV2 = async function (req, res) {
  // console.log(".GET request...");
  var request = {};
  request["lat"] = req.body.lat;
  request["lng"] = req.body.lng;
  request["num"] = req.body.num;
  request["dis"] = req.body.dis;
  // request["iclass"] = classTable.tableExists(req.params.identifier_class);
  request["clang"] = req.body.language
  request["g_id"] = req.body.group_id;
  request["coi_name"] = req.body.coi_name;
  let sois = await SOI.getGroupNearbySOIsV2(request)
  var json = {};
  json["results"] = sois;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(json);
  // console.log("...done!");
  // return SOI json Object(Array) including SOI information and SOI media
  // SOI.getGroupNearbySOIs(soi, function (SOIdata) {
  //   var json = {};
  //   json["results"] = SOIdata;
  //   res.setHeader("Access-Control-Allow-Origin", "*");
  //   res.json(json);
  //   console.log("...done!");
  // });
}
exports.regionNearbySOIs = async function (req, res) {
  // console.log(".GET request...");
  var request = {};
  request["lat"] = req.body.lat;
  request["lng"] = req.body.lng;
  request["num"] = req.body.num;
  request["dis"] = req.body.dis;
  // request["iclass"] = classTable.tableExists(req.params.identifier_class);
  request["clang"] = req.body.language
  request["r_id"] = req.body.region_id;
  request["coi_name"] = req.body.coi_name;
  let sois = await SOI.getRegionNearbySOIs(request)
  var json = {};
  json["results"] = sois;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(json);
  // console.log("...done!");
  // return SOI json Object(Array) including SOI information and SOI media
  // SOI.getGroupNearbySOIs(soi, function (SOIdata) {
  //   var json = {};
  //   json["results"] = SOIdata;
  //   res.setHeader("Access-Control-Allow-Origin", "*");
  //   res.json(json);
  //   console.log("...done!");
  // });
}
exports.addPoiLog = async function (req, res) {
  var request = {};
  request["user_id"] = req.body.user_id;
  request["ip"] = req.body.ip;
  request["page"] = req.body.page;

  let recordset = await POI.addPoiLog(request)
  if (recordset) {
    var json = {};
    json["result"] = "sucess";
    res.json(json);
    // console.log("...done!");
  }
  else {
    console.log("fail")
  }
}
exports.addGroupLog = async function (req, res) {
  var request = {};
  request["user_id"] = req.body.user_id;
  request["ip"] = req.body.ip;
  request["page"] = req.body.page;
  let recordset = await POI.addGroupLog(request)
  if (recordset) {
    var json = {};
    json["result"] = "sucess";
    res.json(json);
    // console.log("...done!");
  }
  else {
    // console.log("fail")
  }
}
exports.regionNearbyAOIsV1 = async function (req, res) {
  // console.log(".GET request...");
  var aoi = {};
  aoi["lat"] = req.query.lat;
  aoi["lng"] = req.query.lng;
  aoi["num"] = req.query.num;
  aoi["dis"] = req.query.dis;
  aoi["iclass"] = classTable.tableExists(req.params.identifier_class);
  aoi["clang"] = langTable.tableExists(req.params.clang);
  aoi["r_id"] = req.query.region_id;
  aoi["coi_name"] = req.query.coi_name;

  let AOIdata = await AOI.getRegionNearbyAOIsV1(aoi)
  var json = {};
  json["results"] = AOIdata;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(json);
}

exports.regionNearbySOIsV1 = async function (req, res) {
  // console.log(".GET request...");
  var soi = {};
  soi["lat"] = req.query.lat;
  soi["lng"] = req.query.lng;
  soi["num"] = req.query.num;
  soi["dis"] = req.query.dis;
  soi["iclass"] = classTable.tableExists(req.params.identifier_class);
  soi["clang"] = langTable.tableExists(req.params.clang);
  soi["r_id"] = req.query.region_id;
  soi["coi_name"] = req.query.coi_name;

  // return SOI json Object(Array) including SOI information and SOI media
  let SOIdata = await SOI.getRegionNearbySOIsV1(soi)
  var json = {};
  json["results"] = SOIdata;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(json);
}