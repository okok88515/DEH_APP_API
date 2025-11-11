var db = require('mssql');
var config = require('../utility/config').dbconfig;
var geo = require('geolib');
var geocoding = require('../services/geocoding');
var poi = require('./POI')
var loi = require('./LOI')
var aoi = require('./AOI')
// db connect
db.connect(config).then(function () {
  console.log('SOI: connected to Micorsoft SQL server');
}).catch(function (err) {
  console.log(err);
});

// 2021 google map's API is broken, now is using 700 as postcode 
// nearby SOIs: getNearbySOIs(:_:_) -> searchPostcode(:_:_:_) -> searchXOIs
exports.getNearbySOIs = async function (request) {
  // console.log(request);
  // get postcode in order to match areaname in [dbo].[area]
  //  geocoding.searchPostcode(request["lat"], request["lng"], function(postcode) {
  //    if (postcode == null) {
  // can not fetch postcode by geocoding
  //      var emptyJSON = [];
  //      callback(emptyJSON);
  //    } else {
  var postcode = 700;
  var count = 50;
  var request_count = Number(request["num"]);
  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude
  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }
  }// end if
  //count = 10
  // In A table(dbo.SOI_story)
  var keys = "A.[SOI_id], A.[SOI_title], A.[SOI_description], A.[SOI_user_name] AS rights, A.[open], A.[identifier], A.[language]";
  // In B table(dbo.area)
  keys += ", A.[area_name_en]";
  var key2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(C.[latitude])) * cos(radians(C.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(C.[latitude])))) AS distance";
  var query1 = "SELECT " + keys + " FROM moe3.dbo.SOI_story AS A";
  // find soi_poi in search range
  var query2 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";
  // find soi_loi_pois in search range
  var query3 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";
  // find soi_aoi_pois in search range
  var query4 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";

  var join1 = "INNER JOIN moe3.dbo.area AS B ON A.area_name_en = B.area_name_en";

  // find soi_pois in search range
  var join2 = "INNER JOIN moe3.dbo.SOI_story_xoi AS B ON A.SOI_id = B.SOI_id_fk";
  var join3 = "INNER JOIN moe3.dbo.dublincore AS C ON B.POI_id = C.POI_id";

  // find soi_loi_pois in search range
  var join4 = "INNER JOIN moe3.dbo.sequence AS D ON B.LOI_id = D.foreignKey";
  var join5 = "INNER JOIN moe3.dbo.dublincore AS C ON D.POI_id = C.POI_id";
  //Chneyi20180327 : for coi
  if (request["coi_name"] != "deh") {
    var join6 = "INNER JOIN moe3.dbo.CoiPoint AS E ON E.point_id = A.SOI_id"
    var cond5 = "E.[verification] = 1 AND E.[types] = 'soi' AND E.[coi_name]='" + request["coi_name"] + "'";
    var cond1 = "A.[open]='1' AND A.[language]='" + request["clang"] + "'";
  } else {
    var cond1 = "A.[verification] = 1 AND A.[open]='1' AND A.[language]='" + request["clang"] + "'";
  }

  // find soi_aoi_pois in search range
  var join7 = "INNER JOIN moe3.dbo.AOI_POIs AS D ON B.AOI_id = D.AOI_id_fk";


  //      var cond2 = "B.[area_country] = (SELECT [area_country] FROM moe3.dbo.area WHERE area_id=" + postcode.substring(2) + ")";
  var cond2 = "B.[area_country] = (SELECT [area_country] FROM moe3.dbo.area WHERE area_id=" + postcode + ")";
  var cond3 = "(C.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond4 = "(C.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";


  //var order1 = "ORDER BY A.[SOI_id] ASC";
  var order1 = "ORDER BY distance ASC";
  //query1 += " " + join1 + " WHERE " + cond1 + " AND " + cond2;
  //Chneyi20180327 : for coi
  if (request["coi_name"] != "deh") {
    query2 += " " + join2 + " " + join3 + " " + join6 + " WHERE " + cond1 + " AND " + cond3 + " AND " + cond4 + " AND " + cond5;
    query3 += " " + join2 + " " + join4 + " " + join5 + " " + join6 + " WHERE " + cond1 + " AND " + cond3 + " AND " + cond4 + " AND " + cond5;
    query4 += " " + join2 + " " + join7 + " " + join5 + " " + join6 + " WHERE " + cond1 + " AND " + cond3 + " AND " + cond4 + " AND " + cond5;
  } else {
    query2 += " " + join2 + " " + join3 + " WHERE " + cond1 + " AND " + cond3 + " AND " + cond4;
    query3 += " " + join2 + " " + join4 + " " + join5 + " WHERE " + cond1 + " AND " + cond3 + " AND " + cond4;
    query4 += " " + join2 + " " + join7 + " " + join5 + " WHERE " + cond1 + " AND " + cond3 + " AND " + cond4;
  }

  if (request["iclass"] != null) {
    query1 += " AND identifier='" + request["iclass"] + "'";// if search specific identifier class
  }

  query2 += " UNION " + query3 + " UNION " + query4;
  query2 += " " + order1;
  // console.log("query: "+query2);

  try {
    let recordset = await new db.Request().query(query2)
    if (recordset.length == 0) {
      return recordset
    } else {
      let jsonData = await searchSOIs(recordset, query1, count)
      return jsonData
    }
  } catch (err) {
    console.log(err)
  }
  /*
  new db.Request().query(query2).then(function (recordset) {
    if (recordset.length == 0) {
      callback(recordset);
    } else {
      // console.log(recordset);
      searchSOIs(recordset, query1, count, function (jsonData) {
        callback(jsonData);
      });
      //searchXOIs(recordset, function(jsonData) { callback(jsonData); });
    }
  });*/
  //    }
  //  });
}

// 2021 google map's API is broken now is using 700 as postcode
exports.getGroupNearbySOIs = async function (request) {
  var g_id = request["g_id"];
  // console.log(request);
  // get postcode in order to match areaname in [dbo].[area]
  //  geocoding.searchPostcode(request["lat"], request["lng"], function(postcode) {
  //    if (postcode == null) {
  // can not fetch postcode by geocoding
  //      var emptyJSON = [];
  //      callback(emptyJSON);
  //    } else {
  var postcode = 700;
  var count = 50;
  var request_count = Number(request["num"]);
  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude
  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }
  }// end if

  // In A table(dbo.SOI_story)
  var keys = "A.[SOI_id], A.[SOI_title], A.[SOI_description], A.[SOI_user_name] AS rights, A.[open], A.[identifier], A.[language]";
  // In B table(dbo.area)
  keys += ", A.[area_name_en]";
  var key2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(C.[latitude])) * cos(radians(C.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(C.[latitude])))) AS distance";
  var query1 = "SELECT " + keys + " FROM moe3.dbo.SOI_story AS A";
  // find soi_poi in search range
  var query2 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";
  // find soi_loi_pois in search range
  var query3 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";
  // find soi_aoi_pois in search range
  var query4 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";

  var join1 = "INNER JOIN moe3.dbo.area AS B ON A.area_name_en = B.area_name_en";

  // find soi_pois in search range
  var join2 = "INNER JOIN moe3.dbo.SOI_story_xoi AS B ON A.SOI_id = B.SOI_id_fk";
  var join3 = "INNER JOIN moe3.dbo.dublincore AS C ON B.POI_id = C.POI_id";

  // find soi_loi_pois in search range
  var join4 = "INNER JOIN moe3.dbo.sequence AS D ON B.LOI_id = D.foreignKey";
  var join5 = "INNER JOIN moe3.dbo.dublincore AS C ON D.POI_id = C.POI_id";
  var join6 = "INNER JOIN moe3.dbo.GroupsPoint AS E ON E.point_id = A.SOI_id"
  // find soi_aoi_pois in search range
  var join7 = "INNER JOIN moe3.dbo.AOI_POIs AS D ON B.AOI_id = D.AOI_id_fk";

  var cond1 = "A.[verification] = 1 AND A.[open]='1' AND A.[language]='" + request["clang"] + "'";
  //      var cond2 = "B.[area_country] = (SELECT [area_country] FROM moe3.dbo.area WHERE area_id=" + postcode.substring(2) + ")";
  var cond2 = "B.[area_country] = (SELECT [area_country] FROM moe3.dbo.area WHERE area_id=" + postcode + ")";
  var cond3 = "(C.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond4 = "(C.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";
  var cond5 = "E.[types] = 'soi' AND E.[foreignkey_id]=" + g_id;

  //var order1 = "ORDER BY A.[SOI_id] ASC";
  var order1 = "ORDER BY distance ASC";
  //query1 += " " + join1 + " WHERE " + cond1 + " AND " + cond2;
  query2 += " " + join2 + " " + join3 + " " + join6 + " WHERE " + cond1 + " AND " + cond3 + " AND " + cond4 + " AND " + cond5;
  query3 += " " + join2 + " " + join4 + " " + join5 + " " + join6 + " WHERE " + cond1 + " AND " + cond3 + " AND " + cond4 + " AND " + cond5;
  query4 += " " + join2 + " " + join7 + " " + join5 + " " + join6 + " WHERE " + cond1 + " AND " + cond3 + " AND " + cond4 + " AND " + cond5;
  if (request["iclass"] != null) {
    query1 += " AND identifier='" + request["iclass"] + "'";// if search specific identifier class
  }

  query2 += " UNION " + query3 + " UNION " + query4;
  query2 += " " + order1;
  console.log("query: " + query2);

  try {
    let recordset = await new db.Request().query(query2)
    if (recordset.length == 0) {
      return recordset
    } else {
      let jsonData = await searchSOIs(recordset, query1, count)
      return jsonData
    }
  } catch (err) {
    console.log(err)
  }
  /*
  new db.Request().query(query2).then(function (recordset) {
    if (recordset.length == 0) {
      callback(recordset);
    } else {
      console.log(recordset);
      searchSOIs(recordset, query1, count, function (jsonData) {
        callback(jsonData);
      });
      //searchXOIs(recordset, function(jsonData) { callback(jsonData); });
    }
  });*/
  //    }
  //  });
}


exports.getUserGroupSOIs = async function (request) {
  var count = 50;
  var g_id = request["g_id"]
  var request_count = Number(request["num"]);
  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude
  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }
  }// end if

  // In A table(dbo.SOI_story)
  var keys = "A.[SOI_id], A.[SOI_title], A.[SOI_description], A.[SOI_user_name] AS rights, A.[open], A.[identifier], A.[language]";
  // In B table(dbo.area)
  keys += ", A.[area_name_en]";

  var key2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(C.[latitude])) * cos(radians(C.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(C.[latitude])))) AS distance";

  // find soi_poi in search range
  var query2 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";
  // find soi_loi_pois in search range
  var query3 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";
  // find soi_aoi_pois in search range
  var query4 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";
  var join1 = "INNER JOIN moe3.dbo.area AS B ON A.area_name_en = B.area_name_en";

  // find soi_pois in search range
  var join2 = "INNER JOIN moe3.dbo.SOI_story_xoi AS B ON A.SOI_id = B.SOI_id_fk";
  var join3 = "INNER JOIN moe3.dbo.dublincore AS C ON B.POI_id = C.POI_id";

  // find soi_loi_pois in search range
  var join4 = "INNER JOIN moe3.dbo.sequence AS D ON B.LOI_id = D.foreignKey";
  var join5 = "INNER JOIN moe3.dbo.dublincore AS C ON D.POI_id = C.POI_id";
  var join6 = "INNER JOIN moe3.dbo.GroupsPoint AS E ON E.point_id = A.SOI_id"
  // find soi_aoi_pois in search range
  var join7 = "INNER JOIN moe3.dbo.AOI_POIs AS D ON B.AOI_id = D.AOI_id_fk";

  var cond1 = "A.[SOI_user_name]='" + request["username"] + "'";
  var cond2 = "(C.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond3 = "(C.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";
  var cond4 = "E.[types] = 'soi' AND E.[foreignkey_id]=" + g_id;

  var order1 = "ORDER BY distance ASC";

  query2 += " " + join2 + " " + join3 + " " + join6 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
  query3 += " " + join2 + " " + join4 + " " + join5 + " " + join6 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
  query4 += " " + join2 + " " + join7 + " " + join5 + " " + join6 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
  console.log("Q2 : " + query2);
  console.log("Q3 : " + query3);
  console.log("Q4 : " + query4);

  query2 += " UNION " + query3 + " UNION " + query4;
  query2 += " " + order1;

  var query1 = "SELECT " + keys + " FROM moe3.dbo.SOI_story AS A";
  console.log("query1111: " + query2);

  try {
    let recordset = await new db.Request().query(query2)
    if (recordset.length == 0) return [];
    let jsonData = await searchSOIs(recordset, query1, count)
    return jsonData
  } catch (err) {
    console.log(err)
  }
  /*
  new db.Request().query(query2).then(function(recordset) {
    if (recordset.length == 0) return callback([]);
    searchSOIs(recordset, query1, count, function(jsonData) { callback(jsonData) });
    //searchXOIs(recordset, function(jsonData) { callback(jsonData) });
  });*/
}

exports.getUserSOIs = async function (request) {
  var count = 50;
  var request_count = Number(request["num"]);
  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude
  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }
  }// end if

  // In A table(dbo.SOI_story)
  var keys = "A.[SOI_id], A.[SOI_title], A.[SOI_description], A.[SOI_user_name] AS rights, A.[open], A.[identifier], A.[language]";
  // In B table(dbo.area)
  keys += ", A.[area_name_en]";

  var key2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(C.[latitude])) * cos(radians(C.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(C.[latitude])))) AS distance";

  // find soi_poi in search range
  var query2 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";
  // find soi_loi_pois in search range
  var query3 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";
  // find soi_aoi_pois in search range
  var query4 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";
  var join1 = "INNER JOIN moe3.dbo.area AS B ON A.area_name_en = B.area_name_en";

  // find soi_pois in search range
  var join2 = "INNER JOIN moe3.dbo.SOI_story_xoi AS B ON A.SOI_id = B.SOI_id_fk";
  var join3 = "INNER JOIN moe3.dbo.dublincore AS C ON B.POI_id = C.POI_id";

  // find soi_loi_pois in search range
  var join4 = "INNER JOIN moe3.dbo.sequence AS D ON B.LOI_id = D.foreignKey";
  var join5 = "INNER JOIN moe3.dbo.dublincore AS C ON D.POI_id = C.POI_id";
  // find soi_aoi_pois in search range
  //Chneyi20180327 : for coi
  if (request["coi_name"] != "deh") {
    var join6 = "INNER JOIN moe3.dbo.CoiPoint AS E ON E.point_id = A.SOI_id"
    var cond4 = "E.[types] = 'soi' AND E.[coi_name]='" + request["coi_name"] + "'";
  } else {
    var cond1 = "A.[verification] = 1 AND A.[open]='1' AND A.[language]='" + request["clang"] + "'";
  }
  var join7 = "INNER JOIN moe3.dbo.AOI_POIs AS D ON B.AOI_id = D.AOI_id_fk";

  var cond1 = "A.[SOI_user_name]='" + request["username"] + "'";
  var cond2 = "(C.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond3 = "(C.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";

  var order1 = "ORDER BY distance ASC";
  if (request["coi_name"] != "deh") {
    query2 += " " + join2 + " " + join3 + " " + join6 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
    query3 += " " + join2 + " " + join4 + " " + join5 + " " + join6 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
    query4 += " " + join2 + " " + join7 + " " + join5 + " " + join6 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
  } else {
    query2 += " " + join2 + " " + join3 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3;
    query3 += " " + join2 + " " + join4 + " " + join5 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3;
    query4 += " " + join2 + " " + join7 + " " + join5 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3;
  }

  query2 += " UNION " + query3 + " UNION " + query4;
  query2 += " " + order1;

  var query1 = "SELECT " + keys + " FROM moe3.dbo.SOI_story AS A";
  console.log("query: " + query2);

  try {
    let recordset = await new db.Request().query(query2)
    if (recordset.length == 0) return [];
    searchSOIs(recordset, query1, count, function (jsonData) { return jsonData });
  } catch (err) {
    console.log(err);
  }
  // new db.Request().query(query2).then(function (recordset) {
  //   if (recordset.length == 0) return callback([]);
  //   searchSOIs(recordset, query1, count, function (jsonData) { callback(jsonData) });
  //   //searchXOIs(recordset, function(jsonData) { callback(jsonData) });
  // });
}

exports.searchSOI = async function (soi_id) {
  var query1 = "SELECT [SOI_id], [SOI_title], [SOI_description],[SOI_upload_time], [SOI_user_name] AS rights, [open], [identifier], [language] FROM [MOE3].[dbo].[SOI_story] WHERE SOI_id = " + soi_id + "AND [verification] = 1";
  console.log("query: " + query1);
  try {
    let recordset = await new db.Request().query(query1)
    let jsonData = await searchXOIs(recordset)
    return jsonData
  } catch (err) {
    console.log("err" + err);
  }
  /*
  new db.Request().query(query1).then(function (recordset) {
    searchXOIs(recordset, function (jsonData) { callback(jsonData); });
  }).catch(function (err) {
    console.log("err" + err);
  });*/
}

async function searchSOIs(jsonData, seq, count) {
  // console.log("Search SOIs.....");
  var c = 1;
  var idList = "" + jsonData[0]["SOI_id"];
  for (i = 1; i < jsonData.length; i++) {
    if (idList.indexOf(jsonData[i]["SOI_id"]) == -1) {
      if (c < count) {
        idList += ", " + jsonData[i]["SOI_id"];
        c++;
      }
      else
        break;
    }
  }
  var cond = "[SOI_id] IN ( " + idList + " )";
  seq += " WHERE " + cond + "ORDER BY case SOI_id";
  var s = idList.split(",");
  for (i = 0; i < s.length; i++) {
    seq += " WHEN " + s[i] + " THEN " + (i + 1);
  }
  seq += " END"
  // console.log(seq);
  try {
    let recordset = await new db.Request().query(seq)
    let jsonData = await searchXOIs(recordset)
    return jsonData
  } catch (err) {
    console.log(err)
  }
  /*
  new db.Request().query(seq).then(function(recordset) {
    // console.log(recordset);
    searchXOIs(recordset,function(jsonData) { callback(jsonData); });
  });*/
}

/*function searchGroupSOIs(g_id,jsonData, seq,count ,callback) {
  console.log("Search SOIs.....");
  var c = 1;
  var idList = ""+jsonData[0]["SOI_id"];
  for (i=1 ;i<jsonData.length; i++){
    if(idList.indexOf(jsonData[i]["SOI_id"])==-1){
      if(c < count){
          idList += ", "+jsonData[i]["SOI_id"];
          c++;
      }
      else 
         break;
    }
  }
  var cond1 = "[SOI_id] IN ( "+idList+" )";
  seq += " WHERE " + cond + "ORDER BY case SOI_id";
  var s = idList.split(",");
  for (i=0; i<s.length; i++){
      seq += " WHEN " + s[i]+ " THEN "+(i+1);
  }
  seq += " END"
  console.log(seq);
  new db.Request().query(seq).then(function(recordset) {
    console.log(recordset);
    searchXOIs(recordset,function(jsonData) { callback(jsonData); });
  });
}*/


async function searchXOIs(jsonData) {
  // console.log("searching XOI...");
  var idList = jsonData[0]["SOI_id"];
  for (i = 1; i < jsonData.length; i++) {
    idList += ", " + jsonData[i]["SOI_id"];
  }
  var query1 = "SELECT * FROM [MOE3].[dbo].[SOI_story_xoi] WHERE SOI_id_fk IN (" + idList + ") ORDER BY SOI_id_fk ASC";
  // console.log(query1);
  try {
    let recordset = await new db.Request().query(query1)
    var XOIset = recordset;
    let jsonData = append(jsonData, XOIset)
    return jsonData
  } catch (err) {
    console.log("err" + err);
  }
  /*
  new db.Request().query(query1).then(function(recordset) {
    var XOIset = recordset;
    append(jsonData, XOIset, function(jsondata){ callback(jsonData) });
  }).catch(function(err) {
    console.log("err" + err);
  });*/
}

function append(data, XOIset, callback) {
  // console.log("appending XOI...");
  //console.log(data);
  // console.log(XOIset);
  var id = -1;
  var appended = 0; // already appended SOI
  for (i = 0; i < data.length; i++) {
    // get SOI id
    id = data[i]["SOI_id"];
    // append XOIs
    var xoi_count = 0;// index
    var query = "";
    for (j = 0; j < XOIset.length; j++) {
      if (id == XOIset[j]["SOI_id_fk"]) {
        if (XOIset[j]["POI_id"] != 0) { // POI in XOIs
          query += addPOIQuery(xoi_count, XOIset[j]["POI_id"]);
          //delete XOIset[j];
        } else if (XOIset[j]["LOI_id"] != 0) { // LOI in XOIs
          query += addLOIQuery(xoi_count, XOIset[j]["LOI_id"]);
          //delete XOIset[j];
        } else if (XOIset[j]["AOI_id"] != 0) { // AOI in XOIs
          query += addAOIQuery(xoi_count, XOIset[j]["AOI_id"]);
          //delete XOIset[j];
        }
        xoi_count++;
      }
    }// end while - a SOI

    // find index, type, id, title, identifier, latitude and longitude informations of XOIs
    // console.log("query: "+query);
    addXOIsHandler(data[i], query, function (soi) {
      if (++appended == data.length) {// appended all
        callback(data);
      }
    });
  }
}

function addXOIsHandler(soi, query, callback) {
  new db.Request().query(query).then(function (XOI_data) {
    soi["containedXOIs"] = XOI_data;
    callback(soi);
  });
}

function addPOIQuery(index, id) {
  var query = "";
  if (index != 0)
    query += " UNION ";
  query += "SELECT " + index + " AS [index], 'POI' AS type, " +
    "[POI_id] AS id, [POI_title] AS title, [open], [latitude], [longitude], [rights], [identifier] " +
    "FROM [MOE3].[dbo].[dublincore] WHERE [POI_id] = " + id;
  return query;
}

function addLOIQuery(index, id) {
  var query = "";
  if (index != 0)
    query += " UNION ";
  query += "SELECT " + index + " AS [index], 'LOI' AS type, " +
    "B.route_id AS id, B.route_title AS title, B.[open] , C.latitude, C.longitude , B.route_owner , B.identifier " +
    "FROM MOE3.dbo.sequence AS A, MOE3.dbo.route_planning AS B, MOE3.dbo.dublincore AS C " +
    "WHERE foreignKey = " + id + " AND A.foreignKey = B.route_id AND C.POI_id=A.POI_id AND A.sequence=0";
  return query;
}

function addAOIQuery(index, id) {
  var query = "";
  if (index != 0)
    query += " UNION ";
  query += "SELECT TOP 1 " + index + " AS [index], 'AOI' AS type, " +
    "B.AOI_id AS id, B.title AS title, B.[open],C.latitude, C.longitude , B.owner , B.identifier " +
    "FROM MOE3.dbo.AOI_POIs AS A, MOE3.dbo.AOI AS B, MOE3.dbo.dublincore AS C " +
    "WHERE A.AOI_id_fk =" + id + " AND A.AOI_id_fk = B.AOI_id AND C.POI_id=A.POI_id";
  return query;
}
exports.requestUserSOIs = async function (request) {
  var count = 50;
  var request_count = Number(request["num"]);
  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude
  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }
  }// end if

  // In A table(dbo.SOI_story)
  var keys = "A.[SOI_id] AS XOI_id, A.[SOI_title] AS XOI_title, A.[SOI_description] AS XOI_description, A.[SOI_user_name] AS rights, A.[open], A.[identifier], A.[language]";
  // In B table(dbo.area)
  keys += ", A.[area_name_en]";

  var key2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(C.[latitude])) * cos(radians(C.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(C.[latitude])))) AS distance";

  // find soi_poi in search range
  var query2 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";
  // find soi_loi_pois in search range
  var query3 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";
  // find soi_aoi_pois in search range
  var query4 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";
  var join1 = "INNER JOIN moe3.dbo.area AS B ON A.area_name_en = B.area_name_en";

  // find soi_pois in search range
  var join2 = "INNER JOIN moe3.dbo.SOI_story_xoi AS B ON A.SOI_id = B.SOI_id_fk";
  var join3 = "INNER JOIN moe3.dbo.dublincore AS C ON B.POI_id = C.POI_id";

  // find soi_loi_pois in search range
  var join4 = "INNER JOIN moe3.dbo.sequence AS D ON B.LOI_id = D.foreignKey";
  var join5 = "INNER JOIN moe3.dbo.dublincore AS C ON D.POI_id = C.POI_id";
  // find soi_aoi_pois in search range
  //Chneyi20180327 : for coi
  if (request["coi_name"] != "deh") {
    var join6 = "INNER JOIN moe3.dbo.CoiPoint AS E ON E.point_id = A.SOI_id"
    var cond4 = "E.[types] = 'soi' AND E.[coi_name]='" + request["coi_name"] + "'";
  } else {
    var cond1 = "A.[verification] = 1 AND A.[open]='1' AND A.[language]='" + request["clang"] + "'";
  }
  var join7 = "INNER JOIN moe3.dbo.AOI_POIs AS D ON B.AOI_id = D.AOI_id_fk";

  var cond1 = "A.[SOI_user_name]='" + request["username"] + "'";
  var cond2 = "(C.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond3 = "(C.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";

  var order1 = "ORDER BY distance ASC";
  if (request["coi_name"] != "deh") {
    query2 += " " + join2 + " " + join3 + " " + join6 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
    query3 += " " + join2 + " " + join4 + " " + join5 + " " + join6 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
    query4 += " " + join2 + " " + join7 + " " + join5 + " " + join6 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
  } else {
    query2 += " " + join2 + " " + join3 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3;
    query3 += " " + join2 + " " + join4 + " " + join5 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3;
    query4 += " " + join2 + " " + join7 + " " + join5 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3;
  }

  query2 += " UNION " + query3 + " UNION " + query4;
  query2 += " " + order1;

  var query1 = "SELECT " + keys + " FROM moe3.dbo.SOI_story AS A";
  console.log("query: " + query2);

  let UserSOIs = await new db.Request().query(query2)
  if (UserSOIs.length == 0) return [];
  // console.log("new record")
  // console.log(UserSOIs)
  let SOIs = await querySOIs(UserSOIs, query1, count)
  //console.log(SOIs)
  let XOIs = await queryXOIs(SOIs)
  // console.log(XOIs)
  let fullSOIs = await addpendXOIs(SOIs, XOIs)
  // console.log(fullSOIs)
  return fullSOIs
}
//without callback, for await use
async function querySOIs(UserSOIs, query, count) {
  if (global.debugPrintLevel >= 1) console.log("Search SOIs.....");
  var c = 1;
  var idList = "" + UserSOIs[0]["SOI_id"];
  for (i = 1; i < UserSOIs.length; i++) {
    if (idList.indexOf(UserSOIs[i]["SOI_id"]) == -1) {
      if (c < count) {
        idList += ", " + UserSOIs[i]["SOI_id"];
        c++;
      }
      else
        break;
    }
  }
  var cond = "[SOI_id] IN ( " + idList + " )";
  query += " WHERE " + cond + "ORDER BY case SOI_id";
  var s = idList.split(",");
  for (i = 0; i < s.length; i++) {
    query += " WHEN " + s[i] + " THEN " + (i + 1);
  }
  query += " END"
  if (global.debugPrintLevel >= 2) console.log(query);
  let SOIs = await new db.Request().query(query)

  return SOIs
}

async function queryXOIs(SOIs) {
  if (global.debugPrintLevel >= 1) console.log("searching XOI...");
  var idList = SOIs[0]["XOI_id"];
  for (i = 1; i < SOIs.length; i++) {
    idList += ", " + SOIs[i]["XOI_id"];
  }
  var query1 = "SELECT * FROM [MOE3].[dbo].[SOI_story_xoi] WHERE SOI_id_fk IN (" + idList + ") ORDER BY SOI_id_fk ASC";
  if (global.debugPrintLevel >= 2) console.log(query1);
  let XOIs = await new db.Request().query(query1)
  return XOIs
}
/*
below XOIs Example
[{
  SOI_XOIs_id: 7112,
  SOI_id_fk: 337,
  POI_id: 0,
  AOI_id: 514,
  LOI_id: 0
}]
*/
async function addpendXOIs(SOIs, XOIs) {
  if (global.debugPrintLevel >= 1) console.log("appending XOI...");
  var id = -1;
  var appended = 0; // already appended SOI
  for (let i = 0; i < SOIs.length; i++) {
    // get SOI id
    id = SOIs[i]["XOI_id"];
    // append XOIs
    var xoi_count = 0;// index
    var query = "";
    //  console.log(SOIs[i])
    for (j = 0; j < XOIs.length; j++) {
      if (id == XOIs[j]["SOI_id_fk"]) {
        if (XOIs[j]["POI_id"] != 0) { // POI in XOIs
          query += addPOIQueryResponseNormalize(xoi_count, XOIs[j]["POI_id"]);
        } else if (XOIs[j]["LOI_id"] != 0) { // LOI in XOIs
          query += addLOIQueryResponseNormalize(xoi_count, XOIs[j]["LOI_id"]);
        } else if (XOIs[j]["AOI_id"] != 0) { // AOI in XOIs
          query += addAOIQueryResponseNormalize(xoi_count, XOIs[j]["AOI_id"]);
        }
        xoi_count++;
      }
    }// end while - a SOI

    // find index, type, id, title, identifier, latitude and longitude informations of XOIs
    if (global.debugPrintLevel >= 2) console.log("query: " + query);
    let matchedXOIs = await new db.Request().query(query)
    // console.log(matchedXOIs)
    let matchXOIs = []
    let poiList = []
    let loiList = []
    let aoiList = []
    for (let j = 0; j < matchedXOIs.length; j++) {
      switch (matchedXOIs[j]["xoiCategory"]) {
        case 'poi':
          // if(global.debugPrintLevel >= 1)console.log("searching SOI's poi")
          poiList.push(matchedXOIs[j])
          // tmp = await poi.queryMedias([matchedXOIs[j]])
          // matchXOIs.push(tmp[0])
          break
        case 'loi':
          loiList.push(matchedXOIs[j])
          // if(global.debugPrintLevel >= 1)console.log("searching SOI's loi")
          // tmp = await loi.queryPOIsInLOIs([matchedXOIs[j]])
          // matchXOIs.push(tmp[0])
          // matchedXOIs[j] = await loi.queryPOIsInLOIs([matchedXOIs[j]])[0]
          break
        case 'aoi':
          aoiList.push(matchedXOIs[j])
          // if(global.debugPrintLevel >= 1)console.log("searching SOI's aoi")
          // tmp = await aoi.queryPOIsInAOIs([matchedXOIs[j]])
          // matchXOIs.push(tmp[0])
          // matchedXOIs[j] = await aoi.queryPOIsInAOIs([matchedXOIs[j]])[0]
          break
        default:
          break
      }
    }
    if (global.debugPrintLevel >= 1) console.log("searching SOI's poi")
    if (poiList.length > 0) poiList = await poi.queryMedias(poiList)
    if (global.debugPrintLevel >= 1) console.log("searching SOI's loi")
    if (loiList.length > 0) loiList = await loi.queryPOIsInLOIs(loiList)

    if (global.debugPrintLevel >= 1) console.log("searching SOI's aoi")
    if (aoiList.length > 0) aoiList = await aoi.queryPOIsInAOIs(aoiList)
    matchXOIs.concat(poiList, loiList, aoiList)
    if (global.debugPrintLevel >= 1) console.log("end searching")
    SOIs[i]["containedXOIs"] = matchedXOIs
  }
  for (i = 0; i < SOIs.length; i++) {
    SOIs[i]["xoiCategory"] = "soi";
    SOIs[i]["mediaCategory"] = "plural";
    SOIs[i]["latitude"] = SOIs[i]["containedXOIs"][0]["latitude"]
    SOIs[i]["longitude"] = SOIs[i]["containedXOIs"][0]["longitude"]
  }
  // console.log(SOIs[0])
  return SOIs
}



function addPOIQueryResponseNormalize(index, id) {
  var query = "";
  if (index != 0)
    query += " UNION ";
  query += "SELECT " + index + " AS [index], 'poi' AS xoiCategory, " +
    "[POI_id] AS XOI_id, [POI_title] AS XOI_title, [POI_description_1] AS XOI_description, [open], [latitude], [longitude], [rights], [identifier] " +
    "FROM [MOE3].[dbo].[dublincore] WHERE [POI_id] = " + id;
  return query;
}

function addLOIQueryResponseNormalize(index, id) {
  var query = "";
  if (index != 0)
    query += " UNION ";
  query += "SELECT " + index + " AS [index], 'loi' AS xoiCategory, " +
    "B.route_id AS XOI_id, B.route_title AS XOI_title, B.route_description AS XOI_description, B.[open] , C.latitude, C.longitude , B.route_owner , B.identifier " +
    "FROM MOE3.dbo.sequence AS A, MOE3.dbo.route_planning AS B, MOE3.dbo.dublincore AS C " +
    "WHERE foreignKey = " + id + " AND A.foreignKey = B.route_id AND C.POI_id=A.POI_id AND A.sequence=0";
  return query;
}

function addAOIQueryResponseNormalize(index, id) {
  var query = "";
  if (index != 0)
    query += " UNION ";
  query += "SELECT TOP 1 " + index + " AS [index], 'aoi' AS xoiCategory, " +
    "B.AOI_id AS XOI_id, B.title AS XOI_title, B.description AS XOI_description, B.[open],C.latitude, C.longitude , B.owner , B.identifier " +
    "FROM MOE3.dbo.AOI_POIs AS A, MOE3.dbo.AOI AS B, MOE3.dbo.dublincore AS C " +
    "WHERE A.AOI_id_fk =" + id + " AND A.AOI_id_fk = B.AOI_id AND C.POI_id=A.POI_id";
  return query;
}

//To be disposed
function searchSOIsResponseNormalize(jsonData, seq, count, callback) {
  console.log("Search SOIs.....");
  var c = 1;
  var idList = "" + jsonData[0]["SOI_id"];
  for (i = 1; i < jsonData.length; i++) {
    if (idList.indexOf(jsonData[i]["SOI_id"]) == -1) {
      if (c < count) {
        idList += ", " + jsonData[i]["SOI_id"];
        c++;
      }
      else
        break;
    }
  }
  var cond = "[SOI_id] IN ( " + idList + " )";
  seq += " WHERE " + cond + "ORDER BY case SOI_id";
  var s = idList.split(",");
  for (i = 0; i < s.length; i++) {
    seq += " WHEN " + s[i] + " THEN " + (i + 1);
  }
  seq += " END"
  console.log(seq);
  new db.Request().query(seq).then(function (recordset) {
    console.log(recordset);
    searchXOIsResponseNormalize(recordset, function (jsonData) { callback(jsonData); });
  });
}
function searchXOIsResponseNormalize(jsonData, callback) {
  console.log("searching XOI...");
  var idList = jsonData[0]["XOI_id"];
  for (i = 1; i < jsonData.length; i++) {
    idList += ", " + jsonData[i]["XOI_id"];
  }
  var query1 = "SELECT * FROM [MOE3].[dbo].[SOI_story_xoi] WHERE SOI_id_fk IN (" + idList + ") ORDER BY SOI_id_fk ASC";
  console.log(query1);
  new db.Request().query(query1).then(function (recordset) {
    var XOIset = recordset;
    // console.log(XOIset)
    appendResponseNormalize(jsonData, XOIset, function (jsondata) { callback(jsonData) });
  }).catch(function (err) {
    console.log("err" + err);
  });
}
function appendResponseNormalize(data, XOIset, callback) {
  console.log("appending XOI...");
  //console.log(data);
  // console.log(XOIset);
  var id = -1;
  var appended = 0; // already appended SOI
  for (i = 0; i < data.length; i++) {
    // get SOI id
    id = data[i]["XOI_id"];
    // append XOIs
    var xoi_count = 0;// index
    var query = "";
    for (j = 0; j < XOIset.length; j++) {
      if (id == XOIset[j]["SOI_id_fk"]) {
        if (XOIset[j]["POI_id"] != 0) { // POI in XOIs
          query += addPOIQueryResponseNormalize(xoi_count, XOIset[j]["POI_id"]);
          //delete XOIset[j];
        } else if (XOIset[j]["LOI_id"] != 0) { // LOI in XOIs
          query += addLOIQueryResponseNormalize(xoi_count, XOIset[j]["LOI_id"]);
          //delete XOIset[j];
        } else if (XOIset[j]["AOI_id"] != 0) { // AOI in XOIs
          query += addAOIQueryResponseNormalize(xoi_count, XOIset[j]["AOI_id"]);
          //delete XOIset[j];
        }
        xoi_count++;
      }
    }// end while - a SOI

    // find index, type, id, title, identifier, latitude and longitude informations of XOIs
    console.log("query: " + query);
    addXOIsHandler(data[i], query, function (soi) {
      if (++appended == data.length) {// appended all
        let appendPOIMediaSetCallBack = function () {

        }
        callback(data);
      }
    });
  }
}
exports.getNearbySOIsV2 = async function (request) {
  var count = 50;
  var request_count = Number(request["num"]);
  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude
  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = request_count;
    }
  }// end if

  // In A table(dbo.SOI_story)
  var keys = "A.[SOI_id] AS XOI_id, A.[SOI_title] AS XOI_title, A.[SOI_description] AS XOI_description, A.[SOI_user_name] AS rights, A.[open], A.[identifier], A.[language]";
  // In B table(dbo.area)
  keys += ", A.[area_name_en]";
  var key2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(C.[latitude])) * cos(radians(C.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(C.[latitude])))) AS distance";
  var query1 = "SELECT " + keys + " FROM moe3.dbo.SOI_story AS A";
  // find soi_poi in search range
  var query2 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";
  // find soi_loi_pois in search range
  var query3 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";
  // find soi_aoi_pois in search range
  var query4 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";

  var join1 = "INNER JOIN moe3.dbo.area AS B ON A.area_name_en = B.area_name_en";

  // find soi_pois in search range
  var join2 = "INNER JOIN moe3.dbo.SOI_story_xoi AS B ON A.SOI_id = B.SOI_id_fk";
  var join3 = "INNER JOIN moe3.dbo.dublincore AS C ON B.POI_id = C.POI_id";

  // find soi_loi_pois in search range
  var join4 = "INNER JOIN moe3.dbo.sequence AS D ON B.LOI_id = D.foreignKey";
  var join5 = "INNER JOIN moe3.dbo.dublincore AS C ON D.POI_id = C.POI_id";
  //Chneyi20180327 : for coi
  if (request["coi_name"] != "deh") {
    var join6 = "INNER JOIN moe3.dbo.CoiPoint AS E ON E.point_id = A.SOI_id"
    var cond5 = "E.[verification] = 1 AND E.[types] = 'soi' AND E.[coi_name]='" + request["coi_name"] + "'";
    var cond1 = "A.[open]='1' AND A.[language]='" + request["clang"] + "'";
  } else {
    var cond1 = "A.[verification] = 1 AND A.[open]='1' AND A.[language]='" + request["clang"] + "'";
  }

  // find soi_aoi_pois in search range
  var join7 = "INNER JOIN moe3.dbo.AOI_POIs AS D ON B.AOI_id = D.AOI_id_fk";


  // var cond2 = "B.[area_country] = (SELECT [area_country] FROM moe3.dbo.area WHERE area_id=" + postcode.substring(2) + ")";
  var cond3 = "(C.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond4 = "(C.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";


  //var order1 = "ORDER BY A.[SOI_id] ASC";
  var order1 = "ORDER BY distance ASC";
  //query1 += " " + join1 + " WHERE " + cond1 + " AND " + cond2;
  //Chneyi20180327 : for coi
  if (request["coi_name"] != "deh") {
    query2 += " " + join2 + " " + join3 + " " + join6 + " WHERE " + cond1 + " AND " + cond3 + " AND " + cond4 + " AND " + cond5;
    query3 += " " + join2 + " " + join4 + " " + join5 + " " + join6 + " WHERE " + cond1 + " AND " + cond3 + " AND " + cond4 + " AND " + cond5;
    query4 += " " + join2 + " " + join7 + " " + join5 + " " + join6 + " WHERE " + cond1 + " AND " + cond3 + " AND " + cond4 + " AND " + cond5;
  } else {
    query2 += " " + join2 + " " + join3 + " WHERE " + cond1 + " AND " + cond3 + " AND " + cond4;
    query3 += " " + join2 + " " + join4 + " " + join5 + " WHERE " + cond1 + " AND " + cond3 + " AND " + cond4;
    query4 += " " + join2 + " " + join7 + " " + join5 + " WHERE " + cond1 + " AND " + cond3 + " AND " + cond4;
  }

  if (request["iclass"] != null) {
    query1 += " AND identifier='" + request["iclass"] + "'";// if search specific identifier class
  }

  query2 += " UNION " + query3 + " UNION " + query4;
  query2 += " " + order1;
  console.log("query: " + query2);
  let userSOIs = await new db.Request().query(query2)
  if (userSOIs.length == 0) {
    return userSOIs
  }
  let SOIs = await querySOIs(userSOIs, query1, count)
  let XOIs = await queryXOIs(SOIs)
  let fullSOIs = await addpendXOIs(SOIs, XOIs)
  return fullSOIs
}

exports.getUserGroupSOIsV2 = async function (request) {
  var count = 50;
  var g_id = request["g_id"]
  var request_count = Number(request["num"]);
  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude
  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }
  }// end if

  // In A table(dbo.SOI_story)
  var keys = "A.[SOI_id] AS XOI_id, A.[SOI_title] AS XOI_title, A.[SOI_description] AS XOI_description, A.[SOI_user_name] AS rights, A.[open], A.[identifier], A.[language]";
  // In B table(dbo.area)
  keys += ", A.[area_name_en]";

  var key2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(C.[latitude])) * cos(radians(C.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(C.[latitude])))) AS distance";

  // find soi_poi in search range
  var query2 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";
  // find soi_loi_pois in search range
  var query3 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";
  // find soi_aoi_pois in search range
  var query4 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";
  var join1 = "INNER JOIN moe3.dbo.area AS B ON A.area_name_en = B.area_name_en";

  // find soi_pois in search range
  var join2 = "INNER JOIN moe3.dbo.SOI_story_xoi AS B ON A.SOI_id = B.SOI_id_fk";
  var join3 = "INNER JOIN moe3.dbo.dublincore AS C ON B.POI_id = C.POI_id";

  // find soi_loi_pois in search range
  var join4 = "INNER JOIN moe3.dbo.sequence AS D ON B.LOI_id = D.foreignKey";
  var join5 = "INNER JOIN moe3.dbo.dublincore AS C ON D.POI_id = C.POI_id";
  var join6 = "INNER JOIN moe3.dbo.GroupsPoint AS E ON E.point_id = A.SOI_id"
  // find soi_aoi_pois in search range
  var join7 = "INNER JOIN moe3.dbo.AOI_POIs AS D ON B.AOI_id = D.AOI_id_fk";

  var cond1 = "A.[SOI_user_name]='" + request["username"] + "'";
  var cond2 = "(C.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond3 = "(C.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";
  var cond4 = "E.[types] = 'soi' AND E.[foreignkey_id]=" + g_id;

  var order1 = "ORDER BY distance ASC";

  query2 += " " + join2 + " " + join3 + " " + join6 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
  query3 += " " + join2 + " " + join4 + " " + join5 + " " + join6 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
  query4 += " " + join2 + " " + join7 + " " + join5 + " " + join6 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
  console.log("Q2 : " + query2);
  console.log("Q3 : " + query3);
  console.log("Q4 : " + query4);



  query2 += " UNION " + query3 + " UNION " + query4;
  query2 += " " + order1;


  var query1 = "SELECT " + keys + " FROM moe3.dbo.SOI_story AS A";
  console.log("query1111: " + query2);
  let soiIds = await new db.Request().query(query2)
  if (soiIds.length == 0) return soiIds
  // console.log(soiIds)
  let SOIs = await querySOIs(soiIds, query1, count)
  let XOIs = await queryXOIs(SOIs)
  let fullSOIs = await addpendXOIs(SOIs, XOIs)
  return fullSOIs
  console.log(sois)
  return sois
  new db.Request().query(query2).then(function (recordset) {
    if (recordset.length == 0) return callback([]);
    searchSOIs(recordset, query1, count, function (jsonData) { callback(jsonData) });
    //searchXOIs(recordset, function(jsonData) { callback(jsonData) });
  });
}
exports.getGroupNearbySOIsV2 = async function (request) {
  var g_id = request["g_id"];
  console.log(request);
  // get postcode in order to match areaname in [dbo].[area]
  var count = 50;
  var request_count = Number(request["num"]);
  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude
  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }
  }// end if

  // In A table(dbo.SOI_story)
  var keys = "A.[SOI_id] AS XOI_id, A.[SOI_title] AS XOI_title, A.[SOI_description] AS XOI_description, A.[SOI_user_name] AS rights, A.[open], A.[identifier], A.[language]";
  // In B table(dbo.area)
  keys += ", A.[area_name_en]";
  var key2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(C.[latitude])) * cos(radians(C.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(C.[latitude])))) AS distance";
  var query1 = "SELECT " + keys + " FROM moe3.dbo.SOI_story AS A";
  // find soi_poi in search range
  var query2 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";
  // find soi_loi_pois in search range
  var query3 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";
  // find soi_aoi_pois in search range
  var query4 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";

  var join1 = "INNER JOIN moe3.dbo.area AS B ON A.area_name_en = B.area_name_en";

  // find soi_pois in search range
  var join2 = "INNER JOIN moe3.dbo.SOI_story_xoi AS B ON A.SOI_id = B.SOI_id_fk";
  var join3 = "INNER JOIN moe3.dbo.dublincore AS C ON B.POI_id = C.POI_id";

  // find soi_loi_pois in search range
  var join4 = "INNER JOIN moe3.dbo.sequence AS D ON B.LOI_id = D.foreignKey";
  var join5 = "INNER JOIN moe3.dbo.dublincore AS C ON D.POI_id = C.POI_id";
  var join6 = "INNER JOIN moe3.dbo.GroupsPoint AS E ON E.point_id = A.SOI_id"
  // find soi_aoi_pois in search range
  var join7 = "INNER JOIN moe3.dbo.AOI_POIs AS D ON B.AOI_id = D.AOI_id_fk";

  var cond1 = "A.[verification] = 1 AND A.[open]='1' AND A.[language]='" + request["clang"] + "'";
  //cond is not used
  // var cond2 = "B.[area_country] = (SELECT [area_country] FROM moe3.dbo.area WHERE area_id=" + postcode.substring(2) + ")";
  var cond3 = "(C.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond4 = "(C.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";
  var cond5 = "E.[types] = 'soi' AND E.[foreignkey_id]=" + g_id;

  //var order1 = "ORDER BY A.[SOI_id] ASC";
  var order1 = "ORDER BY distance ASC";
  //query1 += " " + join1 + " WHERE " + cond1 + " AND " + cond2;
  query2 += " " + join2 + " " + join3 + " " + join6 + " WHERE " + cond1 + " AND " + cond3 + " AND " + cond4 + " AND " + cond5;
  query3 += " " + join2 + " " + join4 + " " + join5 + " " + join6 + " WHERE " + cond1 + " AND " + cond3 + " AND " + cond4 + " AND " + cond5;
  query4 += " " + join2 + " " + join7 + " " + join5 + " " + join6 + " WHERE " + cond1 + " AND " + cond3 + " AND " + cond4 + " AND " + cond5;
  if (request["iclass"] != null) {
    query1 += " AND identifier='" + request["iclass"] + "'";// if search specific identifier class
  }

  query2 += " UNION " + query3 + " UNION " + query4;
  query2 += " " + order1;
  console.log("query: " + query2);
  let soiIds = await new db.Request().query(query2)
  if (soiIds.length == 0) return soiIds
  // console.log(soiIds)
  let SOIs = await querySOIs(soiIds, query1, count)
  let XOIs = await queryXOIs(SOIs)
  let fullSOIs = await addpendXOIs(SOIs, XOIs)
  return fullSOIs
}
exports.getRegionNearbySOIs = async function (request) {
  // var g_id = request["g_id"];
  console.log(request);
  // get postcode in order to match areaname in [dbo].[area]
  var count = 50;
  var request_count = Number(request["num"]);
  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude
  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }
  }// end if

  // In A table(dbo.SOI_story)
  var keys = "A.[SOI_id] AS XOI_id, A.[SOI_title] AS XOI_title, A.[SOI_description] AS XOI_description, A.[SOI_user_name] AS rights, A.[open], A.[identifier], A.[language]";
  // In B table(dbo.area)
  keys += ", A.[area_name_en]";
  var key2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(C.[latitude])) * cos(radians(C.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(C.[latitude])))) AS distance";
  var query1 = "SELECT " + keys + " FROM moe3.dbo.SOI_story AS A";
  // find soi_poi in search range
  var query2 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";
  // find soi_loi_pois in search range
  var query3 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";
  // find soi_aoi_pois in search range
  var query4 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";

  var join1 = "INNER JOIN moe3.dbo.area AS B ON A.area_name_en = B.area_name_en";

  // find soi_pois in search range
  var join2 = "INNER JOIN moe3.dbo.SOI_story_xoi AS B ON A.SOI_id = B.SOI_id_fk";
  var join3 = "INNER JOIN moe3.dbo.dublincore AS C ON B.POI_id = C.POI_id";

  // find soi_loi_pois in search range
  var join4 = "INNER JOIN moe3.dbo.sequence AS D ON B.LOI_id = D.foreignKey";
  var join5 = "INNER JOIN moe3.dbo.dublincore AS C ON D.POI_id = C.POI_id";
  var join6 = "INNER JOIN moe3.dbo.GroupsPoint AS E ON E.point_id = A.SOI_id"
  // find soi_aoi_pois in search range
  var join7 = "INNER JOIN moe3.dbo.AOI_POIs AS D ON B.AOI_id = D.AOI_id_fk";

  var cond1 = "A.[verification] = 1 AND A.[open]='1' AND A.[language]='" + request["clang"] + "'";
  //cond is not used
  // var cond2 = "B.[area_country] = (SELECT [area_country] FROM moe3.dbo.area WHERE area_id=" + postcode.substring(2) + ")";
  var cond3 = "(C.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond4 = "(C.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";
  var cond5 = "E.[types] = 'soi' AND E.[foreignkey_id] IN (SELECT [group_id] FROM moe3.dbo.RegionsGroup WHERE region_id = " + request["r_id"] + ")";

  //var order1 = "ORDER BY A.[SOI_id] ASC";
  var order1 = "ORDER BY distance ASC";
  //query1 += " " + join1 + " WHERE " + cond1 + " AND " + cond2;
  query2 += " " + join2 + " " + join3 + " " + join6 + " WHERE " + cond1 + " AND " + cond3 + " AND " + cond4 + " AND " + cond5;
  query3 += " " + join2 + " " + join4 + " " + join5 + " " + join6 + " WHERE " + cond1 + " AND " + cond3 + " AND " + cond4 + " AND " + cond5;
  query4 += " " + join2 + " " + join7 + " " + join5 + " " + join6 + " WHERE " + cond1 + " AND " + cond3 + " AND " + cond4 + " AND " + cond5;
  if (request["iclass"] != null) {
    query1 += " AND identifier='" + request["iclass"] + "'";// if search specific identifier class
  }

  query2 += " UNION " + query3 + " UNION " + query4;
  query2 += " " + order1;
  console.log("query: " + query2);
  let soiIds = await new db.Request().query(query2)
  if (soiIds.length == 0) return soiIds
  // console.log(soiIds)
  let SOIs = await querySOIs(soiIds, query1, count)
  let XOIs = await queryXOIs(SOIs)
  let fullSOIs = await addpendXOIs(SOIs, XOIs)
  return fullSOIs
}
exports.getRegionNearbySOIsV1 = async function (request) {
  var r_id = request["r_id"];
  console.log(request);
  // get postcode in order to match areaname in [dbo].[area]
  //  geocoding.searchPostcode(request["lat"], request["lng"], function(postcode) {
  //    if (postcode == null) {
  // can not fetch postcode by geocoding
  //      var emptyJSON = [];
  //      callback(emptyJSON);
  //    } else {
  var postcode = 700;
  var count = 50;
  var request_count = Number(request["num"]);
  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude
  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }
  }// end if

  // In A table(dbo.SOI_story)
  var keys = "A.[SOI_id], A.[SOI_title], A.[SOI_description], A.[SOI_user_name] AS rights, A.[open], A.[identifier], A.[language]";
  // In B table(dbo.area)
  keys += ", A.[area_name_en]";
  var key2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(C.[latitude])) * cos(radians(C.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(C.[latitude])))) AS distance";
  var query1 = "SELECT " + keys + " FROM moe3.dbo.SOI_story AS A";
  // find soi_poi in search range
  var query2 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";
  // find soi_loi_pois in search range
  var query3 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";
  // find soi_aoi_pois in search range
  var query4 = "SELECT A.[SOI_id]" + key2 + " FROM moe3.dbo.SOI_story AS A";

  var join1 = "INNER JOIN moe3.dbo.area AS B ON A.area_name_en = B.area_name_en";

  // find soi_pois in search range
  var join2 = "INNER JOIN moe3.dbo.SOI_story_xoi AS B ON A.SOI_id = B.SOI_id_fk";
  var join3 = "INNER JOIN moe3.dbo.dublincore AS C ON B.POI_id = C.POI_id";

  // find soi_loi_pois in search range
  var join4 = "INNER JOIN moe3.dbo.sequence AS D ON B.LOI_id = D.foreignKey";
  var join5 = "INNER JOIN moe3.dbo.dublincore AS C ON D.POI_id = C.POI_id";
  var join6 = "INNER JOIN moe3.dbo.GroupsPoint AS E ON E.point_id = A.SOI_id"
  // find soi_aoi_pois in search range
  var join7 = "INNER JOIN moe3.dbo.AOI_POIs AS D ON B.AOI_id = D.AOI_id_fk";

  var cond1 = "A.[verification] = 1 AND A.[open]='1' AND A.[language]='" + request["clang"] + "'";
  //      var cond2 = "B.[area_country] = (SELECT [area_country] FROM moe3.dbo.area WHERE area_id=" + postcode.substring(2) + ")";
  var cond2 = "B.[area_country] = (SELECT [area_country] FROM moe3.dbo.area WHERE area_id=" + postcode + ")";
  var cond3 = "(C.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond4 = "(C.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";
  var cond5 = "E.[types] = 'soi' AND E.[foreignkey_id] IN (SELECT [group_id] FROM moe3.dbo.RegionsGroup WHERE region_id = " + request["r_id"] + ")";

  //var order1 = "ORDER BY A.[SOI_id] ASC";
  var order1 = "ORDER BY distance ASC";
  //query1 += " " + join1 + " WHERE " + cond1 + " AND " + cond2;
  query2 += " " + join2 + " " + join3 + " " + join6 + " WHERE " + cond1 + " AND " + cond3 + " AND " + cond4 + " AND " + cond5;
  query3 += " " + join2 + " " + join4 + " " + join5 + " " + join6 + " WHERE " + cond1 + " AND " + cond3 + " AND " + cond4 + " AND " + cond5;
  query4 += " " + join2 + " " + join7 + " " + join5 + " " + join6 + " WHERE " + cond1 + " AND " + cond3 + " AND " + cond4 + " AND " + cond5;
  if (request["iclass"] != null) {
    query1 += " AND identifier='" + request["iclass"] + "'";// if search specific identifier class
  }

  query2 += " UNION " + query3 + " UNION " + query4;
  query2 += " " + order1;
  console.log("query: " + query2);

  try {
    let recordset = await new db.Request().query(query2)
    if (recordset.length == 0) {
      return recordset
    } else {
      let jsonData = await searchSOIs(recordset, query1, count)
      return jsonData
    }
  } catch (err) {
    console.log(err)
  }
  /*
  new db.Request().query(query2).then(function (recordset) {
    if (recordset.length == 0) {
      callback(recordset);
    } else {
      console.log(recordset);
      searchSOIs(recordset, query1, count, function (jsonData) {
        callback(jsonData);
      });
      //searchXOIs(recordset, function(jsonData) { callback(jsonData); });
    }
  });*/
  //    }
  //  });
}