var db = require('mssql');
var geo = require('geolib');
var config = require('../utility/config').dbconfig;
var geocoding = require('../services/geocoding');
var poi = require('./POI')
var loi = require('./LOI');
const e = require('express');
// db connect
db.connect(config).then(function () {
  console.log('LOI: connected to Microsoft SQL server');
}).catch(function (err) {
  console.log(err);
});

exports.getNearbyLOIs = async function (request) {
  // console.log(request);
  // get postcode in order to match areaname in [dbo].[area]
  // geocoding.searchPostcode(request["lat"], request["lng"], function(postcode) {
  //   if(postcode == null) {
  //     callback([]);
  //   } else {
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
    }// end if
  }
  // In A table(dbo.route_planning)
  var keys = "[route_id] AS LOI_id, [route_title] AS LOI_title, [route_description] AS LOI_description, [area_name_en], [coverage], [identifier], [open]" +
    ", [route_owner] AS rights" +// In B table(dbo.user_profile) 
    ", [language]";


  var key2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(E.[latitude])) * cos(radians(E.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(E.[latitude])))) AS distance";

  var query1 = "SELECT " + keys + " FROM moe3.dbo.route_planning ";

  var query2 = "SELECT DISTINCT " + "A.[route_id] " + key2 + " FROM moe3.dbo.route_planning AS A";

  var join1 = "INNER JOIN moe3.dbo.user_profile AS B ON A.[route_owner] = B.[user_name]";
  var join2 = "INNER JOIN moe3.dbo.area AS C ON A.[area_name_en] = C.[area_name_en]";
  var join3 = "INNER JOIN moe3.dbo.sequence AS D ON A.[route_id] = D.[foreignkey]";
  var join4 = "INNER JOIN moe3.dbo.dublincore E on E.POI_id = D.POI_id ";
  //Chneyi20180327 : for coi
  if (request["coi_name"] != "deh") {
    var join5 = "INNER JOIN moe3.dbo.CoiPoint AS F ON F.point_id = A.route_id"
    var cond4 = "F.[verification] = 1 AND F.types='loi' AND F.[coi_name]='" + request["coi_name"] + "'";
    var cond1 = "A.[open] = 1 " + "AND E.[language]='" + request["clang"] + "'";
  } else {
    var cond1 = "A.[verification] =1 AND A.[open] = 1 " + "AND E.[language]='" + request["clang"] + "'";
  } //end 

  var cond2 = "(E.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond3 = "(E.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";
  var order1 = "ORDER BY distance ASC";
  //Chneyi20180327 : for coi
  if (request["coi_name"] != "deh") {
    query2 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " " + join5 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
  } else {
    query2 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3;
  } //end

  if (request["iclass"] != null) {
    query1 += "AND [identifier]='" + request["iclass"] + "'";
    query2 += "AND A.[identifier]='" + request["iclass"] + "'";
  }
  query2 += " " + order1;
  console.log(query2);

  try {
    let recordset = await new db.Request().query(query2)
    if (recordset.length == 0) {
      return recordset
      // callback(recordset);
      // console.log("Not found!");
    } else {
      // console.log(recordset);
      let jsonData = await searchLOIs(recordset, query1, count)
      return jsonData
      /*
      searchLOIs(recordset, query1, count, function (jsonData) {
        callback(jsonData)
      });*/
    }
  } catch (err) {
    console.log(err)
  }
  /*
  new db.Request().query(query2).then(function (recordset) {
    if (recordset.length == 0) {
      callback(recordset);
      console.log("Not found!");
    } else {
      console.log(recordset);
      searchLOIs(recordset, query1, count, function (jsonData) {
        callback(jsonData)
      });
    }
  });*/
}

exports.getGroupNearbyLOIs = async function (request) {
  // console.log(request);
  var g_id = request["g_id"]
  // get postcode in order to match areaname in [dbo].[area]
  //geocoding.searchPostcode(request["lat"], request["lng"], function(postcode) {
  // if(postcode == null) {
  //   callback([]);
  // } else {
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
    }// end if
  }
  // In A table(dbo.route_planning)
  var keys = "[route_id] AS LOI_id, [route_title] AS LOI_title, [route_description] AS LOI_description, [area_name_en], [coverage], [identifier], [open]" +
    ", [route_owner] AS rights" +// In B table(dbo.user_profile) 
    ", [language]";


  var key2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(E.[latitude])) * cos(radians(E.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(E.[latitude])))) AS distance";

  var query1 = "SELECT " + keys + " FROM moe3.dbo.route_planning ";

  var query2 = "SELECT DISTINCT " + "A.[route_id] " + key2 + " FROM moe3.dbo.route_planning AS A";

  var join1 = "INNER JOIN moe3.dbo.user_profile AS B ON A.[route_owner] = B.[user_name]";
  var join2 = "INNER JOIN moe3.dbo.area AS C ON A.[area_name_en] = C.[area_name_en]";
  var join3 = "INNER JOIN moe3.dbo.sequence AS D ON A.[route_id] = D.[foreignkey]";
  var join4 = "INNER JOIN moe3.dbo.dublincore AS E on E.POI_id = D.POI_id ";
  var join5 = "INNER JOIN moe3.dbo.GroupsPoint AS F ON F.point_id = A.route_id"
  var cond1 = "A.[verification] =1 AND A.[open] = 1 " + "AND E.[language]='" + request["clang"] + "'";
  var cond2 = "(E.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond3 = "(E.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";
  var cond4 = "F.types='loi' AND F.[foreignkey_id]=" + g_id;
  var order1 = "ORDER BY distance ASC";

  query2 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " " + join5 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
  if (request["iclass"] != null) {
    query1 += "AND [identifier]='" + request["iclass"] + "'";
    query2 += "AND A.[identifier]='" + request["iclass"] + "'";
  }
  query2 += " " + order1;
  console.log(query2);
  try {
    let recordset = await new db.Request().query(query2)
    if (recordset.length == 0) {
      return recordset
    } else {
      let jsonData = await searchLOIs(recordset, query1, count)
      return jsonData
    }
  } catch (err) {
    console.log(err)
  }
  /*
  new db.Request().query(query2).then(function (recordset) {
    if (recordset.length == 0) {
      callback(recordset);
      console.log("Not found!");
    } else {
      console.log(recordset);
      searchLOIs(recordset, query1, count, function (jsonData) {
        callback(jsonData)
      });
    }
  });*/
  //  }
  //});
}



exports.getUserLOIs = async function (request) {
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
    }// end if
  }
  // In A table(dbo.route_planning)
  var keys = "[route_id] AS LOI_id, [route_title] AS LOI_title, [route_description] AS LOI_description, [area_name_en], [coverage], [identifier], [open]" +
    ", [route_owner] AS rights" +// In B table(dbo.user_profile)
    //", C.[area_id], C.[area_country]"+
    ", [language]";
  var keys2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(E.[latitude])) * cos(radians(E.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(E.[latitude])))) AS distance";

  var query1 = "SELECT " + keys + " FROM moe3.dbo.route_planning ";
  var query2 = "SELECT [route_id] " + keys2 + " FROM moe3.dbo.route_planning AS A";
  var join1 = "INNER JOIN moe3.dbo.user_profile AS B ON A.[route_owner] = B.[user_name]";
  var join2 = "INNER JOIN moe3.dbo.area AS C ON A.[area_name_en] = C.[area_name_en]";
  var join3 = "INNER JOIN moe3.dbo.sequence AS D ON A.[route_id] = D.[foreignkey]";
  var join4 = "INNER JOIN moe3.dbo.dublincore E on E.POI_id = D.POI_id";
  var cond1 = "A.[route_owner]='" + request["username"] + "'";
  var cond2 = "(E.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond3 = "(E.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";
  if (request["coi_name"] != "deh") {
    var join5 = "INNER JOIN moe3.dbo.CoiPoint AS F ON F.[point_id]= A.[route_id]"
    var cond4 = "F.types='loi' AND F.[coi_name]= '" + request["coi_name"] + "'";
  }


  var order1 = "ORDER BY distance ASC";
  //`query1 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " WHERE " + cond1 + " "+order1;
  if (request["coi_name"] != "deh") {
    query2 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " " + join5 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4 + " " + order1;
  } else {
    query2 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " " + order1;
  }

  console.log(query2);
  try {
    let recordset = await new db.Request().query(query2)
    if (recordset.length == 0) return [];
    searchLOIs(recordset, query1, count, function (jsonData) { return jsonData });
  } catch (err) {
    console.log(err);
  }
  // new db.Request().query(query2).then(function (recordset) {
  //   if (recordset.length == 0) return callback([]);
  //   console.log(recordset);
  //   searchLOIs(recordset, query1, count, function (jsonData) { callback(jsonData) });
  // })
}


exports.getUserGroupLOIs = async function (request) {
  var count = 50;
  var request_count = Number(request["num"]);
  var g_id = request["g_id"]
  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude
  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }// end if
  }
  // In A table(dbo.route_planning)
  var keys = "[route_id] AS LOI_id, [route_title] AS LOI_title, [route_description] AS LOI_description, [area_name_en], [coverage], [identifier], [open]" +
    ", [route_owner] AS rights" +// In B table(dbo.user_profile)
    //", C.[area_id], C.[area_country]"+
    ", [language]";
  var keys2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(E.[latitude])) * cos(radians(E.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(E.[latitude])))) AS distance";

  var query1 = "SELECT " + keys + " FROM moe3.dbo.route_planning ";
  var query2 = "SELECT [route_id] " + keys2 + " FROM moe3.dbo.route_planning AS A";
  var join1 = "INNER JOIN moe3.dbo.user_profile AS B ON A.[route_owner] = B.[user_name]";
  var join2 = "INNER JOIN moe3.dbo.area AS C ON A.[area_name_en] = C.[area_name_en]";
  var join3 = "INNER JOIN moe3.dbo.sequence AS D ON A.[route_id] = D.[foreignkey]";
  var join4 = "INNER JOIN moe3.dbo.dublincore E on E.POI_id = D.POI_id";
  var join5 = "INNER JOIN moe3.dbo.GroupsPoint AS F ON F.[point_id]= A.[route_id]"
  var cond1 = "A.[route_owner]='" + request["username"] + "'";
  var cond2 = "(E.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond3 = "(E.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";
  var cond4 = "F.types='loi' AND F.[foreignkey_id]=" + g_id;

  var order1 = "ORDER BY distance ASC";
  //`query1 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " WHERE " + cond1 + " "+order1;
  query2 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " " + join5 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4 + " " + order1;
  console.log(query2);
  try {
    let recordset = await new db.Request().query(query2)
    if (recordset.length == 0) return [];
    // console.log(recordset);
    let jsonData = await searchLOIs(recordset, query1, count)
    return jsonData
  } catch (err) {
    console.log(err)
  }
  /*
  new db.Request().query(query2).then(function (recordset) {
    if (recordset.length == 0) return callback([]);
    console.log(recordset);
    searchLOIs(recordset, query1, count, function (jsonData) { callback(jsonData) });
  })*/
}


exports.searchLOI = async function (soi_id) {
  var keys = "A.[route_id] AS LOI_id, A.[route_title] AS LOI_title, A.[route_description] AS LOI_description, A.[area_name_en], A.[coverage], A.[identifier], A.[open],A.[route_owner]" +
    ", B.[user_name] AS rights, C.[area_id], C.[area_country], E.[language]";
  var join1 = "INNER JOIN moe3.dbo.user_profile AS B ON A.[route_owner] = B.[user_name]";
  var join2 = "INNER JOIN moe3.dbo.area AS C ON A.[area_name_en] = C.[area_name_en]";
  var join3 = "INNER JOIN moe3.dbo.sequence AS D ON A.[route_id] = D.[foreignkey]";
  var join4 = "INNER JOIN moe3.dbo.dublincore E on E.POI_id = D.POI_id";
  var cond1 = "A.[verification] =1 AND A.[route_id]=" + soi_id;
  var query1 = "SELECT DISTINCT " + keys + " FROM moe3.dbo.route_planning AS A";
  query1 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " WHERE " + cond1;
  console.log(query1);

  try {
    let recordset = await new db.Request().query(query1)
    if (recordset.length == 0) {
      return recordset
      // callback(recordset);
    } else {
      let jsonData = await searchSequence(recordset)
      return jsonData
      // searchSequence(recordset, function (jsonData) { callback(jsonData); });
    }
  } catch (err) {
    console.log(err)
  }
}

async function searchLOIs(jsonData, seq, count) {
  // console.log("search LOI.....");
  var idList = "" + jsonData[0]["route_id"];
  var c = 1;
  for (i = 1; i < jsonData.length; i++) {
    if (idList.indexOf(jsonData[i]["route_id"]) == -1) {
      if (c < count) {
        c++;
        idList += ", " + jsonData[i]["route_id"];
      }
      else
        break;
    }

  }
  var cond1 = "[route_id] IN (" + idList + ")";
  seq += " WHERE " + cond1 + " ORDER BY CASE route_id ";
  console.log(idList);
  var s = idList.split(",");
  for (i = 0; i < s.length; i++) {
    seq += " WHEN " + s[i] + " THEN " + (i + 1);
  }
  seq += " END"
  console.log(seq);

  try {
    let recordset = await new db.Request().query(seq)
    if (recordset.length == 0) {
      return recordset
      // callback(recordset);
    } else {
      // console.log(recordset);
      let jsonData = await searchSequence(recordset)
      return jsonData
      /*
      searchSequence(recordset, function (jsonData) {
        callback(jsonData)
      });*/
    }
  } catch (err) {
    console.log(err)
  }
  /*
  new db.Request().query(seq).then(function (recordset) {
    if (recordset.length == 0) {
      callback(recordset);
    } else {
      console.log(recordset);

      searchSequence(recordset, function (jsonData) {
        callback(jsonData)
      });
    }
  });*/
}

async function searchSequence(jsonData) {
  //console.log("searching LOI sequence...");
  var idList = "" + jsonData[0]["LOI_id"];
  for (i = 1; i < jsonData.length; i++) {
    idList += ", " + jsonData[i]["LOI_id"];
  }
  // A: dbo.sequence, B: route_planning, C: dublincore
  var keys = "A.[sequence] AS [index], A.[foreignKey], A.[POI_id] AS id, C.[POI_title] AS title, C.[identifier], C.[open], C.[latitude], C.[longitude],C.[rights]";
  var order1 = "[foreignKey], [index]";
  var query1 = "SELECT DISTINCT " + keys + " FROM MOE3.dbo.sequence AS A, MOE3.dbo.route_planning AS B, MOE3.dbo.dublincore AS C" +
    " WHERE foreignKey IN (" + idList + ") AND A.[foreignKey]=B.[route_id] AND A.[POI_id] = C.[POI_id]  ORDER BY " + order1;
  console.log(query1);

  try {
    let recordset = await new db.Request().query(query1)
    var sequences = recordset;
    jsonData = append(jsonData, sequences);
    return jsonData
  } catch (err) {
    console.log("err" + err);
  }
  /*
  new db.Request().query(query1).then(function(recordset) {
    var sequences = recordset;
    jsonData = append(jsonData, sequences);
    callback(jsonData);
  }).catch(function(err) {
    console.log("err" + err);
  });*/
}

function append(data, sequences) {
  console.log("appending POI...");
  //console.log(data);
  //console.log(sequences);
  var j = 0;
  var id = -1;
  var appended = 0;
  for (i = 0; i < data.length; i++) {
    var pois = [];
    // get LOI id
    id = data[i]["LOI_id"];
    // append POIs
    for (j = 0; j < sequences.length; j++) {
      if (id == sequences[j]["foreignKey"]) {
        delete sequences[j]["foreignKey"];
        pois.push(sequences[j]);
      }
    } //don't stop until this POI sequence is pushed into LOI or all sequences are pushed

    if (pois.length != 0) {
      data[i]["POI_set"] = pois;
    }
  }// end for
  return data;
}

exports.queryUserLOIs = async function (request) {
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
    }// end if
  }
  // In A table(dbo.route_planning)
  var keys = "[route_id] AS XOI_id, [route_title] AS XOI_title, [route_description] AS XOI_description, [area_name_en], [coverage], [identifier], [open]" +
    ", [route_owner] AS rights" +// In B table(dbo.user_profile)
    //", C.[area_id], C.[area_country]"+
    ", [language]";
  var keys2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(E.[latitude])) * cos(radians(E.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(E.[latitude])))) AS distance";

  var query1 = "SELECT " + keys + " FROM moe3.dbo.route_planning ";
  var query2 = "SELECT [route_id] " + keys2 + " FROM moe3.dbo.route_planning AS A";
  var join1 = "INNER JOIN moe3.dbo.user_profile AS B ON A.[route_owner] = B.[user_name]";
  var join2 = "INNER JOIN moe3.dbo.area AS C ON A.[area_name_en] = C.[area_name_en]";
  var join3 = "INNER JOIN moe3.dbo.sequence AS D ON A.[route_id] = D.[foreignkey]";
  var join4 = "INNER JOIN moe3.dbo.dublincore E on E.POI_id = D.POI_id";
  var cond1 = "A.[route_owner]='" + request["username"] + "'";
  var cond2 = "(E.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond3 = "(E.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";
  if (request["coi_name"] != "deh") {
    var join5 = "INNER JOIN moe3.dbo.CoiPoint AS F ON F.[point_id]= A.[route_id]"
    var cond4 = "F.types='loi' AND F.[coi_name]= '" + request["coi_name"] + "'";
  }


  var order1 = "ORDER BY distance ASC";
  //`query1 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " WHERE " + cond1 + " "+order1;
  if (request["coi_name"] != "deh") {
    query2 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " " + join5 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4 + " " + order1;
  } else {
    query2 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " " + order1;
  }
  console.log(query2);
  // tempLOIs is a list of route_id and distance
  let tempLOIs = await new db.Request().query(query2)
  console.log(tempLOIs)
  //append pois
  let LOIs = await queryLOIs(tempLOIs, query1, count)
  return LOIs
}
// get pois in lois
async function queryLOIs(tempLOIs, query, count) {
  console.log("search LOI.....");
  if (Object.keys(tempLOIs).length == 0) return {}
  var idList = "" + tempLOIs[0]["route_id"];
  var c = 1;
  for (i = 1; i < tempLOIs.length; i++) {
    if (idList.indexOf(tempLOIs[i]["route_id"]) == -1) {
      if (c < count) {
        c++;
        idList += ", " + tempLOIs[i]["route_id"];
      }
      else
        break;
    }
  }
  var cond1 = "[route_id] IN (" + idList + ")";
  query += " WHERE " + cond1 + " ORDER BY CASE route_id ";
  console.log(idList);
  var s = idList.split(",");
  for (i = 0; i < s.length; i++) {
    query += " WHEN " + s[i] + " THEN " + (i + 1);
  }
  query += " END"
  console.log(query);
  let LOIs = await new db.Request().query(query)
  console.log(LOIs)
  let LOIsWithPOIs = await loi.queryPOIsInLOIs(LOIs)

  return LOIsWithPOIs
}

exports.queryPOIsInLOIs = async function (LOIs) {
  if (global.debugPrintLevel >= 1) console.log("searching LOI sequence....");
  var idList = "" + LOIs[0]["XOI_id"];
  for (i = 1; i < LOIs.length; i++) {
    idList += ", " + LOIs[i]["XOI_id"];
  }
  console.log(idList)
  // A: dbo.sequence, B: route_planning, C: dublincore
  var keys = "A.[sequence] AS [index], A.[foreignKey], A.[POI_id] AS XOI_id, C.[POI_title] AS XOI_title, C.[identifier], C.[open], C.[latitude], C.[longitude],C.[rights], C.[POI_description_1] AS XOI_description";
  var order1 = "[foreignKey], [index]";
  var query1 = "SELECT DISTINCT " + keys + " FROM MOE3.dbo.sequence AS A, MOE3.dbo.route_planning AS B, MOE3.dbo.dublincore AS C" +
    " WHERE foreignKey IN (" + idList + ") AND A.[foreignKey]=B.[route_id] AND A.[POI_id] = C.[POI_id]  ORDER BY " + order1;

  let POIs = await new db.Request().query(query1)
  let LOIsWithPOIs = await appendPOIs(LOIs, POIs)
  // console.log(POIs)
  for (i = 0; i < LOIsWithPOIs.length; i++) {
    LOIsWithPOIs[i]["xoiCategory"] = "loi"
    LOIsWithPOIs[i]["mediaCategory"] = "plural"
    LOIsWithPOIs[i]["latitude"] = LOIsWithPOIs[i]["containedXOIs"][0]["latitude"]
    LOIsWithPOIs[i]["longitude"] = LOIsWithPOIs[i]["containedXOIs"][0]["longitude"]
  }
  return LOIsWithPOIs
}

async function appendPOIs(LOIs, POIs) {
  if (global.debugPrintLevel >= 1) console.log("appending POI....");
  let POIsWithMedias = await poi.queryMedias(POIs)
  var j = 0;
  var id = -1;
  for (i = 0; i < LOIs.length; i++) {
    var pois = [];
    // get LOI id
    id = LOIs[i]["XOI_id"];
    // append POIs
    for (j = 0; j < POIsWithMedias.length; j++) {
      if (id == POIsWithMedias[j]["foreignKey"]) {
        // delete POIsWithMedias[j]["foreignKey"];
        pois.push(POIsWithMedias[j]);
      }
    } //don't stop until this POI sequence is pushed into LOI or all sequences are pushed
    if (pois.length != 0) {
      LOIs[i]["containedXOIs"] = pois;
    }
  }// end for
  return LOIs
}
exports.getNearbyLOIsV2 = async function (request) {
  // console.log(request);
  // get postcode in order to match areaname in [dbo].[area]
  // geocoding.searchPostcode(request["lat"], request["lng"], function(postcode) {
  //   if(postcode == null) {
  //     callback([]);
  //   } else {
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
    }// end if
  }
  // In A table(dbo.route_planning)
  var keys = "[route_id] AS XOI_id, [route_title] AS XOI_title, [route_description] AS XOI_description, [area_name_en], [coverage], [identifier], [open]" +
    ", [route_owner] AS rights" +// In B table(dbo.user_profile) 
    ", [language]";


  var key2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(E.[latitude])) * cos(radians(E.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(E.[latitude])))) AS distance";

  var query1 = "SELECT " + keys + " FROM moe3.dbo.route_planning ";

  var query2 = "SELECT DISTINCT " + "A.[route_id] " + key2 + " FROM moe3.dbo.route_planning AS A";

  var join1 = "INNER JOIN moe3.dbo.user_profile AS B ON A.[route_owner] = B.[user_name]";
  var join2 = "INNER JOIN moe3.dbo.area AS C ON A.[area_name_en] = C.[area_name_en]";
  var join3 = "INNER JOIN moe3.dbo.sequence AS D ON A.[route_id] = D.[foreignkey]";
  var join4 = "INNER JOIN moe3.dbo.dublincore E on E.POI_id = D.POI_id ";

  if (request["coi_name"] != "deh") {
    var join5 = "INNER JOIN moe3.dbo.CoiPoint AS F ON F.point_id = A.route_id"
    var cond4 = "F.[verification] = 1 AND F.types='loi' AND F.[coi_name]='" + request["coi_name"] + "'";
    var cond1 = "A.[open] = 1 " + "AND E.[language]='" + request["language"] + "'";
  } else {
    var cond1 = "A.[verification] =1 AND A.[open] = 1 " + "AND E.[language]='" + request["language"] + "'";
  } //end 

  var cond2 = "(E.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond3 = "(E.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";
  var order1 = "ORDER BY distance ASC";
  //Chneyi20180327 : for coi
  if (request["coi_name"] != "deh") {
    query2 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " " + join5 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
  } else {
    query2 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3;
  } //end

  if (request["iclass"] != null) {
    query1 += "AND [identifier]='" + request["iclass"] + "'";
    query2 += "AND A.[identifier]='" + request["iclass"] + "'";
  }
  query2 += " " + order1;
  console.log(query2);
  // let POIs = await new db.Request().query(query1)
  let tempLOIs = await new db.Request().query(query2)

  if (tempLOIs.length == 0) {
    return tempLOIs
  } else {
    let jsonData = await queryLOIs(tempLOIs, query1, count)
    return jsonData
  }
  //   }
  // });
}
exports.getUserGroupLOIsV2 = async function (request) {
  var count = 50;
  var request_count = Number(request["num"]);
  var group_id = request["group_id"]
  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude
  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }// end if
  }
  // In A table(dbo.route_planning)
  var keys = "[route_id] AS XOI_id, [route_title] AS XOI_title, [route_description] AS XOI_description, [area_name_en], [coverage], [identifier], [open]" +
    ", [route_owner] AS rights" +// In B table(dbo.user_profile)
    //", C.[area_id], C.[area_country]"+
    ", [language]";
  var keys2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(E.[latitude])) * cos(radians(E.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(E.[latitude])))) AS distance";

  var query1 = "SELECT " + keys + " FROM moe3.dbo.route_planning ";
  var query2 = "SELECT [route_id] " + keys2 + " FROM moe3.dbo.route_planning AS A";
  var join1 = "INNER JOIN moe3.dbo.user_profile AS B ON A.[route_owner] = B.[user_name]";
  var join2 = "INNER JOIN moe3.dbo.area AS C ON A.[area_name_en] = C.[area_name_en]";
  var join3 = "INNER JOIN moe3.dbo.sequence AS D ON A.[route_id] = D.[foreignkey]";
  var join4 = "INNER JOIN moe3.dbo.dublincore E on E.POI_id = D.POI_id";
  var join5 = "INNER JOIN moe3.dbo.GroupsPoint AS F ON F.[point_id]= A.[route_id]"
  var cond1 = "A.[route_owner]='" + request["username"] + "'";
  var cond2 = "(E.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond3 = "(E.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";
  var cond4 = "F.types='loi' AND F.[foreignkey_id]=" + group_id;

  var order1 = "ORDER BY distance ASC";
  //`query1 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " WHERE " + cond1 + " "+order1;
  query2 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " " + join5 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4 + " " + order1;
  if (global.debugPrintLevel >= 1) console.log(query2);

  let loiIds = await new db.Request().query(query2)
  console.log(loiIds)
  if (loiIds.length == 0) return loiIds
  else {
    let lois = queryLOIs(loiIds, query1, count)
    return lois
  }
}
exports.getGroupNearbyLOIsV2 = async function (request) {
  console.log(request);
  var g_id = request["g_id"]
  // get postcode in order to match areaname in [dbo].[area]
  //geocoding.searchPostcode(request["lat"], request["lng"], function(postcode) {
  // if(postcode == null) {
  //   callback([]);
  // } else {
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
    }// end if
  }
  // In A table(dbo.route_planning)
  var keys = "[route_id] AS XOI_id, [route_title] AS XOI_title, [route_description] AS XOI_description, [area_name_en], [coverage], [identifier], [open]" +
    ", [route_owner] AS rights" +// In B table(dbo.user_profile) 
    ", [language]";


  var key2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(E.[latitude])) * cos(radians(E.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(E.[latitude])))) AS distance";

  var query1 = "SELECT " + keys + " FROM moe3.dbo.route_planning ";

  var query2 = "SELECT DISTINCT " + "A.[route_id] " + key2 + " FROM moe3.dbo.route_planning AS A";

  var join1 = "INNER JOIN moe3.dbo.user_profile AS B ON A.[route_owner] = B.[user_name]";
  var join2 = "INNER JOIN moe3.dbo.area AS C ON A.[area_name_en] = C.[area_name_en]";
  var join3 = "INNER JOIN moe3.dbo.sequence AS D ON A.[route_id] = D.[foreignkey]";
  var join4 = "INNER JOIN moe3.dbo.dublincore AS E on E.POI_id = D.POI_id ";
  var join5 = "INNER JOIN moe3.dbo.GroupsPoint AS F ON F.point_id = A.route_id"
  var cond1 = "A.[verification] =1 AND A.[open] = 1 " + "AND E.[language]='" + request["clang"] + "'";
  var cond2 = "(E.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond3 = "(E.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";
  var cond4 = "F.types='loi' AND F.[foreignkey_id]=" + g_id;
  var order1 = "ORDER BY distance ASC";

  query2 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " " + join5 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
  if (request["iclass"] != null) {
    query1 += "AND [identifier]='" + request["iclass"] + "'";
    query2 += "AND A.[identifier]='" + request["iclass"] + "'";
  }
  query2 += " " + order1;
  console.log(query2);
  let loiIds = await new db.Request().query(query2)
  if (loiIds.length == 0) return loiIds
  let lois = await queryLOIs(loiIds, query1, count)
  return lois
  new db.Request().query(query2).then(function (recordset) {
    if (recordset.length == 0) {
      callback(recordset);
      console.log("Not found!");
    } else {
      console.log(recordset);
      searchLOIs(recordset, query1, count, function (jsonData) {
        callback(jsonData)
      });
    }
  });
  //  }
  //});
}
exports.getRegionNearbyLOIs = async function (request) {
  console.log(request);
  // var g_id = request["g_id"]
  // get postcode in order to match areaname in [dbo].[area]
  //geocoding.searchPostcode(request["lat"], request["lng"], function(postcode) {
  // if(postcode == null) {
  //   callback([]);
  // } else {
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
    }// end if
  }
  // In A table(dbo.route_planning)
  var keys = "[route_id] AS XOI_id, [route_title] AS XOI_title, [route_description] AS XOI_description, [area_name_en], [coverage], [identifier], [open]" +
    ", [route_owner] AS rights" +// In B table(dbo.user_profile) 
    ", [language]";


  var key2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(E.[latitude])) * cos(radians(E.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(E.[latitude])))) AS distance";

  var query1 = "SELECT " + keys + " FROM moe3.dbo.route_planning ";

  var query2 = "SELECT DISTINCT " + "A.[route_id] " + key2 + " FROM moe3.dbo.route_planning AS A";

  var join1 = "INNER JOIN moe3.dbo.user_profile AS B ON A.[route_owner] = B.[user_name]";
  var join2 = "INNER JOIN moe3.dbo.area AS C ON A.[area_name_en] = C.[area_name_en]";
  var join3 = "INNER JOIN moe3.dbo.sequence AS D ON A.[route_id] = D.[foreignkey]";
  var join4 = "INNER JOIN moe3.dbo.dublincore AS E on E.POI_id = D.POI_id ";
  var join5 = "INNER JOIN moe3.dbo.GroupsPoint AS F ON F.point_id = A.route_id"
  var cond1 = "A.[verification] =1 AND A.[open] = 1 " + "AND E.[language]='" + request["clang"] + "'";
  var cond2 = "(E.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond3 = "(E.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";
  var cond4 = "F.types='loi' AND F.[foreignkey_id] IN (SELECT [group_id] FROM moe3.dbo.RegionsGroup WHERE region_id = " + request["r_id"] + ")";
  var order1 = "ORDER BY distance ASC";

  query2 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " " + join5 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
  if (request["iclass"] != null) {
    query1 += "AND [identifier]='" + request["iclass"] + "'";
    query2 += "AND A.[identifier]='" + request["iclass"] + "'";
  }
  query2 += " " + order1;
  console.log(query2);
  let loiIds = await new db.Request().query(query2)
  if (loiIds.length == 0) return loiIds
  let lois = await queryLOIs(loiIds, query1, count)
  return lois
}
exports.getRegionNearbyLOIsV1 = async function (request) {
  console.log(request);
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
    }// end if
  }
  // In A table(dbo.route_planning)
  var keys = "[route_id] AS LOI_id, [route_title] AS LOI_title, [route_description] AS LOI_description, [area_name_en], [coverage], [identifier], [open]" +
    ", [route_owner] AS rights" +// In B table(dbo.user_profile) 
    ", [language]";


  var key2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(E.[latitude])) * cos(radians(E.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(E.[latitude])))) AS distance";

  var query1 = "SELECT " + keys + " FROM moe3.dbo.route_planning ";

  var query2 = "SELECT DISTINCT " + "A.[route_id] " + key2 + " FROM moe3.dbo.route_planning AS A";

  var join1 = "INNER JOIN moe3.dbo.user_profile AS B ON A.[route_owner] = B.[user_name]";
  var join2 = "INNER JOIN moe3.dbo.area AS C ON A.[area_name_en] = C.[area_name_en]";
  var join3 = "INNER JOIN moe3.dbo.sequence AS D ON A.[route_id] = D.[foreignkey]";
  var join4 = "INNER JOIN moe3.dbo.dublincore AS E on E.POI_id = D.POI_id ";
  var join5 = "INNER JOIN moe3.dbo.GroupsPoint AS F ON F.point_id = A.route_id"
  var cond1 = "A.[verification] =1 AND A.[open] = 1 " + "AND E.[language]='" + request["clang"] + "'";
  var cond2 = "(E.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond3 = "(E.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";
  var cond4 = "F.types='loi' AND F.[foreignkey_id] IN (SELECT [group_id] FROM moe3.dbo.RegionsGroup WHERE region_id = " + request["r_id"] + ")";
  var order1 = "ORDER BY distance ASC";

  query2 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " " + join5 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
  if (request["iclass"] != null) {
    query1 += "AND [identifier]='" + request["iclass"] + "'";
    query2 += "AND A.[identifier]='" + request["iclass"] + "'";
  }
  query2 += " " + order1;
  console.log(query2);

  try {
    let recordset = await new db.Request().query(query2)
    if (recordset.length == 0) {
      return recordset
    } else {
      let jsonData = await searchLOIs(recordset, query1, count)
      return jsonData
    }
  } catch (err) {
    console.log(err)
  }
  /*
  new db.Request().query(query2).then(function (recordset) {
    if (recordset.length == 0) {
      callback(recordset);
      console.log("Not found!");
    } else {
      console.log(recordset);
      searchLOIs(recordset, query1, count, function (jsonData) {
        callback(jsonData)
      });
    }
  });*/
}