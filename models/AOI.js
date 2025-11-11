var db = require('mssql');
var config = require('../utility/config').dbconfig;
var geocoding = require('../services/geocoding');
var geo = require('geolib');
var poi = require('./POI')
var aoi = require('./AOI')
// db connect
db.connect(config).then(function () {
  console.log('AOI: connected to Microsoft SQL server');
}).catch(function (err) {
  console.log(err);
});

exports.getNearbyAOIs = async function (request) {
  // console.log(request);
  // get postcode in order to match areaname in [dbo].[area]
  // geocoding.searchPostcode(request["lat"], request["lng"], function(postcode) {
  //   if (postcode == null) {
  //     callback([]);
  //   } else {
  var count = 50;
  var request_count = Number(request["num"]);

  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }// end if
  }

  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude

  var keys = "A.[AOI_id], A.[title] AS AOI_title, A.[description] AS AOI_description, A.[area_name_en], A.[coverage], A.[identifier], A.[open]" + // A: dbo.AOI
    ", A.[owner] AS rights" + // B: dbo.user_profile
    ", A.[language]"; // dbo.dublincore
  var key2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(E.[latitude])) * cos(radians(E.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(E.[latitude])))) AS distance";

  var query1 = "SELECT " + keys + " FROM moe3.dbo.AOI AS A";
  var query2 = "SELECT [AOI_id] " + key2 + " FROM moe3.dbo.AOI AS A";
  var join1 = "INNER JOIN MOE3.dbo.user_profile AS B ON A.owner = B.user_name";
  var join2 = "INNER JOIN MOE3.dbo.area C ON A.area_name_en = C.area_name_en";
  var join3 = "INNER JOIN MOE3.dbo.AOI_POIs D ON A.AOI_id = D.AOI_id_fk";
  var join4 = "INNER JOIN MOE3.dbo.dublincore E ON E.POI_id = D.POI_id";
  if (request["coi_name"] != "deh") {
    var join5 = "INNER JOIN moe3.dbo.CoiPoint AS F ON F.point_id = A.AOI_id"
    var cond4 = "F.[verification] = 1 AND F.types='aoi' AND F.[coi_name]='" + request["coi_name"] + "'";
    var cond1 = "A.[open] = 1 " + "AND E.[language]='" + request["clang"] + "'";
  } else {
    var cond1 = "A.[verification] =1 AND A.[open] = 1 " + "AND E.[language]='" + request["clang"] + "'";
  }

  var cond2 = "(E.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond3 = "(E.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";

  var order1 = "ORDER BY distance ASC";
  //Chneyi20180327 : for coi
  if (request["coi_name"] != "deh") {
    query2 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " " + join5 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
  } else {
    query2 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3;
  } //end
  //query1 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " WHERE " + cond1 + " AND "+ cond2;

  if (request["iclass"] != null) {
    query1 += "AND A.[identifier]='" + request["iclass"] + "'";
  }
  query2 += " " + order1;
  // console.log(query2);

  try {
    let recordset = await new db.Request().query(query2)
    if (recordset.length == 0) {
      return recordset
    } else {
      let jsonData = await searchAOIs(recordset, query1, count)
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
      //  console.log(recordset);
      searchAOIs(recordset, query1, count, function (jsonData) {
        callback(jsonData)
      });
      //searchPOIs(recordset, function(jsonData){ callback(jsonData) });
    }
  });*/
  //   }
  // });
}


exports.getGroupNearbyAOIs = async function (request) {
  // console.log(request);
  var g_id = request["g_id"]
  // get postcode in order to match areaname in [dbo].[area]
  // geocoding.searchPostcode(request["lat"], request["lng"], function(postcode) {
  //   if (postcode == null) {
  //     callback([]);
  //   } else {
  var count = 50;
  var request_count = Number(request["num"]);

  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }// end if
  }

  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude

  var keys = "A.[AOI_id], A.[title] AS AOI_title, A.[description] AS AOI_description, A.[area_name_en], A.[coverage], A.[identifier], A.[open]" + // A: dbo.AOI
    ", A.[owner] AS rights" + // B: dbo.user_profile
    ", A.[language]"; // dbo.dublincore
  var key2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(E.[latitude])) * cos(radians(E.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(E.[latitude])))) AS distance";

  var query1 = "SELECT " + keys + " FROM moe3.dbo.AOI AS A";
  var query2 = "SELECT [AOI_id] " + key2 + " FROM moe3.dbo.AOI AS A";
  var join1 = "INNER JOIN MOE3.dbo.user_profile AS B ON A.owner = B.user_name";
  var join2 = "INNER JOIN MOE3.dbo.area C ON A.area_name_en = C.area_name_en";
  var join3 = "INNER JOIN MOE3.dbo.AOI_POIs D ON A.AOI_id = D.AOI_id_fk";
  var join4 = "INNER JOIN MOE3.dbo.dublincore E ON E.POI_id = D.POI_id";
  var join5 = "INNER JOIN MOE3.dbo.GroupsPoint F ON F.point_id = A.AOI_id"
  var cond1 = "A.[verification] =1 AND A.[open] = 1 AND E.[language]='" + request["clang"] + "'";
  var cond2 = "(E.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond3 = "(E.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";
  var cond4 = "F.types = 'aoi' AND F.foreignkey_id = " + g_id;

  var order1 = "ORDER BY distance ASC";
  //query1 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " WHERE " + cond1 + " AND "+ cond2;
  query2 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " " + join5 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
  if (request["iclass"] != null) {
    query1 += "AND A.[identifier]='" + request["iclass"] + "'";
  }
  query2 += " " + order1;
  console.log(query2);

  try {
    let recordset = await new db.Request().query(query2)
    if (recordset.length == 0) {
      return recordset
    } else {
      let jsonData = await searchAOIs(recordset, query1, count)
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
      searchAOIs(recordset, query1, count, function (jsonData) {
        callback(jsonData)
      });
      //searchPOIs(recordset, function(jsonData){ callback(jsonData) });
    }
  });*/
  //   }
  // });
}

exports.getUserAOIs = async function (request) {
  var count = 50;
  var request_count = Number(request["num"]);

  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }// end if
  }

  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude

  var keys = "[AOI_id], [title] AS AOI_title, [description] AS AOI_description, [area_name_en], [coverage], [identifier], [open]" + // A: dbo.AOI
    ", [owner] AS rights" + // B: dbo.user_profile
    ", [language]"; // dbo.dublincore
  var keys2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(E.[latitude])) * cos(radians(E.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(E.[latitude])))) AS distance";

  var join1 = "INNER JOIN MOE3.dbo.user_profile AS B ON A.owner = B.user_name";
  var join2 = "INNER JOIN MOE3.dbo.area C ON A.area_name_en = C.area_name_en";
  var join3 = "INNER JOIN MOE3.dbo.AOI_POIs D ON A.AOI_id = D.AOI_id_fk";
  var join4 = "INNER JOIN MOE3.dbo.dublincore E ON E.POI_id = D.POI_id";
  var cond1 = "A.[owner]='" + request["username"] + "'";
  var cond2 = "(E.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond3 = "(E.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";
  var order1 = "A.[AOI_id] ASC";
  //Chenyi20180327 : for coi
  if (request["coi_name"] != "deh") {
    var join5 = "INNER JOIN moe3.dbo.CoiPoint AS F ON F.[point_id]= A.[AOI_id]"
    var cond4 = "F.types='aoi' AND F.[coi_name]= '" + request["coi_name"] + "'";
  }//end

  var query1 = "SELECT " + keys + " FROM moe3.dbo.AOI AS A ";//+join1+" "+join2+" "+join3+" "+join4+" WHERE "+cond1+" ORDER BY "+order1;

  //Chenyi20180327 : for coi
  if (request["coi_name"] != "deh") {
    var query2 = "SELECT [AOI_id] " + keys2 + " FROM moe3.dbo.AOI AS A " + join1 + " " + join2 + " " + join3 + " " + join4 + " " + join5 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4 + " ORDER BY distance ASC";
  } else {
    var query2 = "SELECT [AOI_id] " + keys2 + " FROM moe3.dbo.AOI AS A " + join1 + " " + join2 + " " + join3 + " " + join4 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " ORDER BY distance ASC";
  } //end

  console.log("query: " + query2);
  try {
    let recordset = await new db.Request().query(query2)
    if (recordset.length == 0) return [];
    searchAOIs(recordset, query1, 100, function (jsonData) { return jsonData });
  } catch (err) {
    console.log(err);
  }
  // new db.Request().query(query2).then(function (recordset) {
  //   if (recordset.length == 0) return callback([]);
  //   console.log(recordset);
  //   searchAOIs(recordset, query1, 100, function (jsonData) { callback(jsonData) });
  // });

}

exports.getUserGroupAOIs = async function (request) {
  var count = 50;
  var request_count = Number(request["num"]);
  var g_id = request["g_id"];

  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }// end if
  }

  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude

  var keys = "[AOI_id], [title] AS AOI_title, [description] AS AOI_description, [area_name_en], [coverage], [identifier], [open]" + // A: dbo.AOI
    ", [owner] AS rights" + // B: dbo.user_profile
    ", [language]"; // dbo.dublincore
  var keys2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(E.[latitude])) * cos(radians(E.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(E.[latitude])))) AS distance";

  var join1 = "INNER JOIN MOE3.dbo.user_profile AS B ON A.owner = B.user_name";
  var join2 = "INNER JOIN MOE3.dbo.area C ON A.area_name_en = C.area_name_en";
  var join3 = "INNER JOIN MOE3.dbo.AOI_POIs D ON A.AOI_id = D.AOI_id_fk";
  var join4 = "INNER JOIN MOE3.dbo.dublincore E ON E.POI_id = D.POI_id";
  var join5 = "INNER JOIN MOE3.dbo.GroupsPoint F ON F.point_id = A.AOI_id"
  var cond1 = "A.[owner]='" + request["username"] + "'";
  var cond2 = "(E.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond3 = "(E.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";
  var cond4 = "F.types = 'aoi' AND F.foreignkey_id = " + g_id;
  var order1 = "A.[AOI_id] ASC";
  var query1 = "SELECT " + keys + " FROM moe3.dbo.AOI AS A ";//+join1+" "+join2+" "+join3+" "+join4+" WHERE "+cond1+" ORDER BY "+order1;
  var query2 = "SELECT [AOI_id] " + keys2 + " FROM moe3.dbo.AOI AS A " + join1 + " " + join2 + " " + join3 + " " + join4 + " " + join5 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4 + " ORDER BY distance ASC";
  console.log("query: " + query2);

  try {
    let recordset = await new db.Request().query(query2)
    if (recordset.length == 0) return [];
    let jsonData = await searchAOIs(recordset, query1, 100)
    return jsonData
  } catch (err) {
    console.log(err)
  }
  /*
  new db.Request().query(query2).then(function(recordset) {
    if (recordset.length == 0) return callback([]);
    console.log(recordset);
    searchAOIs(recordset, query1,100,function(jsonData){ callback(jsonData) });
  });*/
}


exports.searchAOI = async function (aoi_id) {
  var keys = "A.[AOI_id], A.[title] AS AOI_title, A.[description] AS AOI_decsription, A.[area_name_en], A.[coverage], A.[identifier], A.[open],A.[owner]" +
    ", B.[user_name] AS rights, C.[area_id], C.[area_country], E.[language]";
  var query1 = "SELECT DISTINCT " + keys + " FROM moe3.dbo.AOI AS A";
  var join1 = "INNER JOIN MOE3.dbo.user_profile AS B ON A.owner = B.user_name";
  var join2 = "INNER JOIN MOE3.dbo.area C ON A.area_name_en = C.area_name_en ";
  var join3 = "INNER JOIN MOE3.dbo.AOI_POIs D ON A.AOI_id = D.AOI_id_fk";
  var join4 = "INNER JOIN MOE3.dbo.dublincore E ON E.POI_id = D.POI_id";
  var cond1 = "A.[verification] =1 AND A.[AOI_id]=" + aoi_id;
  query1 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " WHERE " + cond1;
  console.log(query1);

  try {
    let recordset = new db.Request().query(query1)
    if (recordset.length == 0) {
      return recordset
    } else {
      let jsonData = await searchPOIs(recordset)
      return jsonData
    }
  } catch (err) {
    console.log(err)
  }
  /*
  new db.Request().query(query1).then(function (recordset) {
    if (recordset.length == 0) {
      callback(recordset);
    } else {
      console.log(recordset);
      searchPOIs(recordset, function (jsonData) { callback(jsonData); });
    }
  });*/
}

async function searchAOIs(jsonData, seq, count) {
  // console.log("Search AOIs....");
  var idList = "" + jsonData[0]["AOI_id"];
  var length;
  var c = 1;
  if (jsonData.length > count)
    length = count;
  else
    length = jsonData.length;
  for (i = 1; i < jsonData.length; i++) {
    if (idList.indexOf(jsonData[i]["AOI_id"]) == -1) {
      if (c < count) {
        c++;
        idList += ", " + jsonData[i]["AOI_id"];
      }
      else
        break;
    }
  }
  var cond1 = "[AOI_id] IN (" + idList + ")";
  seq += " WHERE " + cond1 + " ORDER BY CASE AOI_id ";
  // console.log(idList);
  n = 0;
  l = 0;
  var s = idList.split(",");
  // console.log(s.length);
  for (i = 0; i < s.length; i++) {
    seq += " WHEN " + s[i] + " THEN " + (i + 1);
  }
  seq += " END"
  // console.log(seq);
  try {
    let recordset = await new db.Request().query(seq)
    if (recordset.length == 0) {
      return recordset
    } else {
      let jsonData = await searchPOIs(recordset)
      return jsonData
    }
  } catch (err) {
    console.log(err)
  }
  /*
  new db.Request().query(seq).then(function(recordset) {
    if (recordset.length == 0){
      callback(recordset);
    } else {
      // console.log(recordset);
      searchPOIs(recordset, function(jsonData){ callback(jsonData) });
    }
  });*/
}

async function searchPOIs(jsonData) {
  // console.log("search AOI's POIs...");
  var idList = jsonData[0]["AOI_id"];
  for (i = 1; i < jsonData.length; i++) {
    idList += ", " + jsonData[i]["AOI_id"];
  }
  // console.log(idList);
  var keys = "A.[AOI_id_fk], A.[POI_id] AS id, B.[POI_title] AS title, B.identifier, B.[open], B.latitude, B.longitude,B.[rights]";
  var query1 = "SELECT " + keys + " FROM MOE3.dbo.AOI_POIs AS A, MOE3.dbo.dublincore AS B";
  query1 += " WHERE AOI_id_fk IN (" + idList + ") AND A.[POI_id] = B.[POI_id] ORDER BY A.[AOI_id_fk] ASC";
  // console.log(query1);
  try {
    let recordset = await new db.Request().query(query1)
    var aoi_pois = recordset;
    jsonData = append(jsonData, aoi_pois);
    return jsonData;
  } catch (err) {
    console.log("err" + err);
  }
  /*
  new db.Request().query(query1).then(function(recordset) {
    var aoi_pois = recordset;
    // console.log(recordset);
    jsonData = append(jsonData, aoi_pois);
    // console.log("start");
    // console.log(jsonData);
    // console.log("end");
    callback(jsonData);
  }).catch(function(err) {
    console.log("err" + err);
  });*/
}

function append(data, sequences) {
  console.log("append POI...");
  //console.log(data);
  //console.log(aoi_pois);
  var j = 0;
  var id = -1;
  var appended = 0;
  for (i = 0; i < data.length; i++) {
    var pois = [];
    // get AOI id
    id = data[i]["AOI_id"];
    // append POIs
    for (j = 0; j < sequences.length; j++) {
      if (id == sequences[j]["AOI_id_fk"]) {
        delete sequences[j]["AOI_id_fk"];
        pois.push(sequences[j]);
      }
    } //don't stop until this POI sequence is pushed into LOI or all sequences are pushed

    if (pois.length != 0) {
      data[i]["POI_set"] = pois;
    }
  }// end for

  return data;
}
exports.getUserAOIsResponseNormalize = function (request, callback) {
  var count = 50;
  var request_count = Number(request["num"]);

  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }// end if
  }

  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude

  var keys = "[AOI_id] AS XOI_id, [title] AS XOI_title, [description] AS XOI_description, [area_name_en], [coverage], [identifier], [open]" + // A: dbo.AOI
    ", [owner] AS rights" + // B: dbo.user_profile
    ", [language]"; // dbo.dublincore
  var keys2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(E.[latitude])) * cos(radians(E.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(E.[latitude])))) AS distance";

  var join1 = "INNER JOIN MOE3.dbo.user_profile AS B ON A.owner = B.user_name";
  var join2 = "INNER JOIN MOE3.dbo.area C ON A.area_name_en = C.area_name_en";
  var join3 = "INNER JOIN MOE3.dbo.AOI_POIs D ON A.AOI_id = D.AOI_id_fk";
  var join4 = "INNER JOIN MOE3.dbo.dublincore E ON E.POI_id = D.POI_id";
  var cond1 = "A.[owner]='" + request["username"] + "'";
  var cond2 = "(E.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond3 = "(E.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";
  var order1 = "A.[AOI_id] ASC";
  //Chenyi20180327 : for coi
  if (request["coi_name"] != "deh") {
    var join5 = "INNER JOIN moe3.dbo.CoiPoint AS F ON F.[point_id]= A.[AOI_id]"
    var cond4 = "F.types='aoi' AND F.[coi_name]= '" + request["coi_name"] + "'";
  }//end

  var query1 = "SELECT " + keys + " FROM moe3.dbo.AOI AS A ";//+join1+" "+join2+" "+join3+" "+join4+" WHERE "+cond1+" ORDER BY "+order1;

  //Chenyi20180327 : for coi
  if (request["coi_name"] != "deh") {
    var query2 = "SELECT [AOI_id] " + keys2 + " FROM moe3.dbo.AOI AS A " + join1 + " " + join2 + " " + join3 + " " + join4 + " " + join5 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4 + " ORDER BY distance ASC";
  } else {
    var query2 = "SELECT [AOI_id] " + keys2 + " FROM moe3.dbo.AOI AS A " + join1 + " " + join2 + " " + join3 + " " + join4 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " ORDER BY distance ASC";
  } //end

  console.log("query: " + query2);

  new db.Request().query(query2).then(function (recordset) {
    if (recordset.length == 0) return callback([]);
    console.log(recordset);
    searchAOIsResponseNormalize(recordset, query1, 100, function (jsonData) { callback(jsonData) });
  });
}
function searchAOIsResponseNormalize(jsonData, seq, count, callback) {
  console.log("Search AOIs....");
  var idList = "" + jsonData[0]["AOI_id"];
  var length;
  var c = 1;
  if (jsonData.length > count)
    length = count;
  else
    length = jsonData.length;
  for (i = 1; i < jsonData.length; i++) {
    if (idList.indexOf(jsonData[i]["AOI_id"]) == -1) {
      if (c < count) {
        c++;
        idList += ", " + jsonData[i]["AOI_id"];

      }
      else
        break;
    }

  }
  var cond1 = "[AOI_id] IN (" + idList + ")";
  seq += " WHERE " + cond1 + " ORDER BY CASE AOI_id ";
  console.log(idList);
  n = 0;
  l = 0;
  var s = idList.split(",");
  console.log(s.length);
  for (i = 0; i < s.length; i++) {
    seq += " WHEN " + s[i] + " THEN " + (i + 1);
  }
  seq += " END"
  console.log(seq);
  new db.Request().query(seq).then(function (recordset) {
    if (recordset.length == 0) {
      callback(recordset);
    } else {
      console.log(recordset);
      searchPOIsResponseNormalize(recordset, function (jsonData) { callback(jsonData) });
    }
  });
}
function searchPOIsResponseNormalize(jsonData, callback) {
  console.log("search AOI's POIs...");
  var idList = jsonData[0]["XOI_id"];
  for (i = 1; i < jsonData.length; i++) {
    idList += ", " + jsonData[i]["XOI_id"];
  }
  // console.log(idList);
  var keys = "A.[AOI_id_fk] AS foreignKey, A.[POI_id] AS XOI_id, B.[POI_description_1] AS XOI_description, B.[POI_title] AS XOI_title, B.identifier, B.[open], B.latitude, B.longitude,B.[rights]";
  var query1 = "SELECT " + keys + " FROM MOE3.dbo.AOI_POIs AS A, MOE3.dbo.dublincore AS B";
  query1 += " WHERE AOI_id_fk IN (" + idList + ") AND A.[POI_id] = B.[POI_id] ORDER BY A.[AOI_id_fk] ASC";
  console.log(query1);
  new db.Request().query(query1).then(function (recordset) {
    var aoi_pois = recordset;
    // console.log(recordset);
    appendResponseNormalize(jsonData, aoi_pois, function (jsonData) { callback(jsonData); });
    // jsonData = append(jsonData, aoi_pois);
    // callback(jsonData);
  }).catch(function (err) {
    console.log("err" + err);
  });
}

function appendResponseNormalize(data, sequences, callback) {
  console.log("appending POI....");
  // console.log(data);
  // console.log(sequences);


  var appendResponse = function (data, sequences, callback) {
    // console.log(sequences)
    var j = 0;
    var id = -1;
    var appended = 0;
    for (i = 0; i < data.length; i++) {
      var pois = [];
      // get LOI id
      id = data[i]["XOI_id"];
      // append POIs
      for (j = 0; j < sequences.length; j++) {
        if (id == sequences[j]["foreignKey"]) {
          delete sequences[j]["foreignKey"];
          pois.push(sequences[j]);
        }
      } //don't stop until this POI sequence is pushed into LOI or all sequences are pushed
      // console.log(pois)
      if (pois.length != 0) {
        // console.log(pois)
        data[i]["containedXOIs"] = pois;
        // console.log(data[i]["containedXOIs"])
      }
    }// end for
    callback(data)
  }
  // console.log(sequences)
  poi.brigedToSearchMedia(data, sequences, callback, appendResponse)

}
exports.queryUserAOIs = async function (request) {
  var count = 50;
  var request_count = Number(request["num"]);

  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }// end if
  }

  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude

  var keys = "[AOI_id] AS XOI_id, [title] AS XOI_title, [description] AS XOI_description, [area_name_en], [coverage], [identifier], [open]" + // A: dbo.AOI
    ", [owner] AS rights" + // B: dbo.user_profile
    ", [language]"; // dbo.dublincore
  var keys2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(E.[latitude])) * cos(radians(E.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(E.[latitude])))) AS distance";

  var join1 = "INNER JOIN MOE3.dbo.user_profile AS B ON A.owner = B.user_name";
  var join2 = "INNER JOIN MOE3.dbo.area C ON A.area_name_en = C.area_name_en";
  var join3 = "INNER JOIN MOE3.dbo.AOI_POIs D ON A.AOI_id = D.AOI_id_fk";
  var join4 = "INNER JOIN MOE3.dbo.dublincore E ON E.POI_id = D.POI_id";
  var cond1 = "A.[owner]='" + request["username"] + "'";
  var cond2 = "(E.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond3 = "(E.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";
  var order1 = "A.[AOI_id] ASC";
  //Chenyi20180327 : for coi
  if (request["coi_name"] != "deh") {
    var join5 = "INNER JOIN moe3.dbo.CoiPoint AS F ON F.[point_id]= A.[AOI_id]"
    var cond4 = "F.types='aoi' AND F.[coi_name]= '" + request["coi_name"] + "'";
  }//end

  var query1 = "SELECT " + keys + " FROM moe3.dbo.AOI AS A ";//+join1+" "+join2+" "+join3+" "+join4+" WHERE "+cond1+" ORDER BY "+order1;

  //Chenyi20180327 : for coi
  if (request["coi_name"] != "deh") {
    var query2 = "SELECT [AOI_id] " + keys2 + " FROM moe3.dbo.AOI AS A " + join1 + " " + join2 + " " + join3 + " " + join4 + " " + join5 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4 + " ORDER BY distance ASC";
  } else {
    var query2 = "SELECT [AOI_id] " + keys2 + " FROM moe3.dbo.AOI AS A " + join1 + " " + join2 + " " + join3 + " " + join4 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " ORDER BY distance ASC";
  } //end

  console.log("query: " + query2);

  let tempAOIs = await new db.Request().query(query2)
  let AOIs = await queryAOIs(tempAOIs, query1, 100)
  return AOIs
}
async function queryAOIs(jsonData, seq, count) {
  console.log("In queryAOIs Search AOIs....");
  if (Object.keys(jsonData).length == 0) {
    return jsonData
  }
  var idList = "" + jsonData[0]["AOI_id"];
  var length;
  var c = 1;
  if (jsonData.length > count)
    length = count;
  else
    length = jsonData.length;
  for (i = 1; i < jsonData.length; i++) {
    if (idList.indexOf(jsonData[i]["AOI_id"]) == -1) {
      if (c < count) {
        c++;
        idList += ", " + jsonData[i]["AOI_id"];

      }
      else
        break;
    }

  }
  var cond1 = "[AOI_id] IN (" + idList + ")";
  seq += " WHERE " + cond1 + " ORDER BY CASE AOI_id ";
  console.log(idList);
  n = 0;
  l = 0;
  var s = idList.split(",");
  for (i = 0; i < s.length; i++) {
    seq += " WHEN " + s[i] + " THEN " + (i + 1);
  }
  seq += " END"
  let AOIs = await new db.Request().query(seq)
  let AOIsWithXOIs = await aoi.queryPOIsInAOIs(AOIs)
  return AOIsWithXOIs
}
exports.queryPOIsInAOIs = async function (AOIs) {
  if (global.debugPrintLevel >= 1) console.log("search AOI's POIs...");

  var idList = AOIs[0]["XOI_id"];
  for (i = 1; i < AOIs.length; i++) {
    idList += ", " + AOIs[i]["XOI_id"];
  }
  var keys = "A.[AOI_id_fk] AS foreignKey, A.[POI_id] AS XOI_id, B.[POI_description_1] AS XOI_description, B.[POI_title] AS XOI_title, B.identifier, B.[open], B.latitude, B.longitude,B.[rights]";
  var query1 = "SELECT " + keys + " FROM MOE3.dbo.AOI_POIs AS A, MOE3.dbo.dublincore AS B";
  query1 += " WHERE AOI_id_fk IN (" + idList + ") AND A.[POI_id] = B.[POI_id] ORDER BY A.[AOI_id_fk] ASC";
  if (global.debugPrintLevel >= 2) console.log(query1);
  let POIs = await new db.Request().query(query1)
  let AOIsWithXOIs = await appendPOIs(AOIs, POIs)

  if (Object.keys(AOIsWithXOIs).length > 0) {
    for (i = 0; i < AOIsWithXOIs.length; i++) {
      AOIsWithXOIs[i]["xoiCategory"] = "aoi";
      AOIsWithXOIs[i]["mediaCategory"] = "plural";
      AOIsWithXOIs[i]["latitude"] = AOIsWithXOIs[i]["containedXOIs"][0]["latitude"]
      AOIsWithXOIs[i]["longitude"] = AOIsWithXOIs[i]["containedXOIs"][0]["longitude"]

    }
  }
  return AOIsWithXOIs
}
async function appendPOIs(AOIs, POIs) {
  if (global.debugPrintLevel >= 1) console.log("appending POI....");
  let POIsWithMedias = await poi.queryMedias(POIs)
  var j = 0;
  var id = -1;
  var appended = 0;
  for (i = 0; i < AOIs.length; i++) {
    var pois = [];
    // get LOI id
    id = AOIs[i]["XOI_id"];
    // append POIs
    for (j = 0; j < POIsWithMedias.length; j++) {
      if (id == POIsWithMedias[j]["foreignKey"]) {
        delete POIsWithMedias[j]["foreignKey"];
        pois.push(POIsWithMedias[j]);
      }
    } //don't stop until this POI sequence is pushed into LOI or all sequences are pushed
    if (pois.length != 0) {
      AOIs[i]["containedXOIs"] = pois;
    }
  }
  return AOIs
}
exports.getNearbyAOIsV2 = async function (request) {
  console.log(request);
  var count = 50;
  var request_count = Number(request["num"]);

  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = request_count;
    }// end if
  }

  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude

  var keys = "A.[AOI_id] AS XOI_id, A.[title] AS XOI_title, A.[description] AS XOI_description, A.[area_name_en], A.[coverage], A.[identifier], A.[open]" + // A: dbo.AOI
    ", A.[owner] AS rights" + // B: dbo.user_profile
    ", A.[language]"; // dbo.dublincore
  var key2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(E.[latitude])) * cos(radians(E.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(E.[latitude])))) AS distance";

  var query1 = "SELECT " + keys + " FROM moe3.dbo.AOI AS A";
  var query2 = "SELECT [AOI_id] " + key2 + " FROM moe3.dbo.AOI AS A";
  var join1 = "INNER JOIN MOE3.dbo.user_profile AS B ON A.owner = B.user_name";
  var join2 = "INNER JOIN MOE3.dbo.area C ON A.area_name_en = C.area_name_en";
  var join3 = "INNER JOIN MOE3.dbo.AOI_POIs D ON A.AOI_id = D.AOI_id_fk";
  var join4 = "INNER JOIN MOE3.dbo.dublincore E ON E.POI_id = D.POI_id";
  if (request["coi_name"] != "deh") {
    var join5 = "INNER JOIN moe3.dbo.CoiPoint AS F ON F.point_id = A.AOI_id"
    var cond4 = "F.[verification] = 1 AND F.types='aoi' AND F.[coi_name]='" + request["coi_name"] + "'";
    var cond1 = "A.[open] = 1 " + "AND E.[language]='" + request["clang"] + "'";
  } else {
    var cond1 = "A.[verification] =1 AND A.[open] = 1 " + "AND E.[language]='" + request["clang"] + "'";
  }

  var cond2 = "(E.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond3 = "(E.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";

  var order1 = "ORDER BY distance ASC";
  //Chneyi20180327 : for coi
  if (request["coi_name"] != "deh") {
    query2 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " " + join5 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
  } else {
    query2 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3;
  } //end
  //query1 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " WHERE " + cond1 + " AND "+ cond2;

  if (request["iclass"] != null) {
    query1 += "AND A.[identifier]='" + request["iclass"] + "'";
  }
  query2 += " " + order1;
  console.log(query2);
  let tempAOIs = await new db.Request().query(query2)
  if (tempAOIs.length == 0) {
    return tempAOIs
  }
  // console.log(tempAOIs);
  let aois = await queryAOIs(tempAOIs, query1, count)
  return aois

}
exports.getUserGroupAOIsV2 = async function (request) {
  var count = 50;
  var request_count = Number(request["num"]);
  var g_id = request["g_id"];

  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }// end if
  }

  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude

  var keys = "[AOI_id] AS XOI_id, [title] AS XOI_title, [description] AS XOI_description, [area_name_en], [coverage], [identifier], [open]" + // A: dbo.AOI
    ", [owner] AS rights" + // B: dbo.user_profile
    ", [language]"; // dbo.dublincore
  var keys2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(E.[latitude])) * cos(radians(E.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(E.[latitude])))) AS distance";

  var join1 = "INNER JOIN MOE3.dbo.user_profile AS B ON A.owner = B.user_name";
  var join2 = "INNER JOIN MOE3.dbo.area C ON A.area_name_en = C.area_name_en";
  var join3 = "INNER JOIN MOE3.dbo.AOI_POIs D ON A.AOI_id = D.AOI_id_fk";
  var join4 = "INNER JOIN MOE3.dbo.dublincore E ON E.POI_id = D.POI_id";
  var join5 = "INNER JOIN MOE3.dbo.GroupsPoint F ON F.point_id = A.AOI_id"
  var cond1 = "A.[owner]='" + request["username"] + "'";
  var cond2 = "(E.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond3 = "(E.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";
  var cond4 = "F.types = 'aoi' AND F.foreignkey_id = " + g_id;
  var order1 = "A.[AOI_id] ASC";
  var query1 = "SELECT " + keys + " FROM moe3.dbo.AOI AS A ";//+join1+" "+join2+" "+join3+" "+join4+" WHERE "+cond1+" ORDER BY "+order1;
  var query2 = "SELECT [AOI_id] " + keys2 + " FROM moe3.dbo.AOI AS A " + join1 + " " + join2 + " " + join3 + " " + join4 + " " + join5 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4 + " ORDER BY distance ASC";
  console.log("query: " + query2);
  let aoiIds = await new db.Request().query(query2)
  console.log(aoiIds)
  if (aoiIds.length == 0) return aoiIds
  let aois = await queryAOIs(aoiIds, query1, 100)
  console.log(aois)
  return aois
}
exports.getGroupNearbyAOIsV2 = async function (request) {
  console.log(request);
  var g_id = request["g_id"]
  // get postcode in order to match areaname in [dbo].[area]
  // geocoding.searchPostcode(request["lat"], request["lng"], function(postcode) {
  //   if (postcode == null) {
  //     callback([]);
  //   } else {
  var count = 50;
  var request_count = Number(request["num"]);

  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }// end if
  }

  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude

  var keys = "A.[AOI_id] AS XOI_id, A.[title] AS XOI_title, A.[description] AS XOI_description, A.[area_name_en], A.[coverage], A.[identifier], A.[open]" + // A: dbo.AOI
    ", A.[owner] AS rights" + // B: dbo.user_profile
    ", A.[language]"; // dbo.dublincore
  var key2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(E.[latitude])) * cos(radians(E.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(E.[latitude])))) AS distance";

  var query1 = "SELECT " + keys + " FROM moe3.dbo.AOI AS A";
  var query2 = "SELECT [AOI_id] " + key2 + " FROM moe3.dbo.AOI AS A";
  var join1 = "INNER JOIN MOE3.dbo.user_profile AS B ON A.owner = B.user_name";
  var join2 = "INNER JOIN MOE3.dbo.area C ON A.area_name_en = C.area_name_en";
  var join3 = "INNER JOIN MOE3.dbo.AOI_POIs D ON A.AOI_id = D.AOI_id_fk";
  var join4 = "INNER JOIN MOE3.dbo.dublincore E ON E.POI_id = D.POI_id";
  var join5 = "INNER JOIN MOE3.dbo.GroupsPoint F ON F.point_id = A.AOI_id"
  var cond1 = "A.[verification] =1 AND A.[open] = 1 AND E.[language]='" + request["clang"] + "'";
  var cond2 = "(E.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond3 = "(E.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";
  var cond4 = "F.types = 'aoi' AND F.foreignkey_id = " + g_id;

  var order1 = "ORDER BY distance ASC";
  //query1 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " WHERE " + cond1 + " AND "+ cond2;
  query2 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " " + join5 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
  if (request["iclass"] != null) {
    query1 += "AND A.[identifier]='" + request["iclass"] + "'";
  }
  query2 += " " + order1;
  console.log(query2);
  let aoiIds = await new db.Request().query(query2)
  if (aoiIds.length == 0) return aoiIds
  let aois = await queryAOIs(aoiIds, query1, count)
  return aois
}
exports.getRegionNearbyAOIs = async function (request) {
  console.log(request);
  // var g_id = request["g_id"]
  // get postcode in order to match areaname in [dbo].[area]
  // geocoding.searchPostcode(request["lat"], request["lng"], function(postcode) {
  //   if (postcode == null) {
  //     callback([]);
  //   } else {
  var count = 50;
  var request_count = Number(request["num"]);

  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }// end if
  }

  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude

  var keys = "A.[AOI_id] AS XOI_id, A.[title] AS XOI_title, A.[description] AS XOI_description, A.[area_name_en], A.[coverage], A.[identifier], A.[open]" + // A: dbo.AOI
    ", A.[owner] AS rights" + // B: dbo.user_profile
    ", A.[language]"; // dbo.dublincore
  var key2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(E.[latitude])) * cos(radians(E.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(E.[latitude])))) AS distance";

  var query1 = "SELECT " + keys + " FROM moe3.dbo.AOI AS A";
  var query2 = "SELECT [AOI_id] " + key2 + " FROM moe3.dbo.AOI AS A";
  var join1 = "INNER JOIN MOE3.dbo.user_profile AS B ON A.owner = B.user_name";
  var join2 = "INNER JOIN MOE3.dbo.area C ON A.area_name_en = C.area_name_en";
  var join3 = "INNER JOIN MOE3.dbo.AOI_POIs D ON A.AOI_id = D.AOI_id_fk";
  var join4 = "INNER JOIN MOE3.dbo.dublincore E ON E.POI_id = D.POI_id";
  var join5 = "INNER JOIN MOE3.dbo.GroupsPoint F ON F.point_id = A.AOI_id"
  var cond1 = "A.[verification] =1 AND A.[open] = 1 AND E.[language]='" + request["clang"] + "'";
  var cond2 = "(E.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond3 = "(E.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";
  var cond4 = "F.types = 'aoi' AND F.foreignkey_id IN (SELECT [group_id] FROM moe3.dbo.RegionsGroup WHERE region_id = " + request["r_id"] + ")";

  var order1 = "ORDER BY distance ASC";
  //query1 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " WHERE " + cond1 + " AND "+ cond2;
  query2 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " " + join5 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
  if (request["iclass"] != null) {
    query1 += "AND A.[identifier]='" + request["iclass"] + "'";
  }
  query2 += " " + order1;
  console.log(query2);
  let aoiIds = await new db.Request().query(query2)
  if (aoiIds.length == 0) return aoiIds
  let aois = await queryAOIs(aoiIds, query1, count)
  return aois
}
exports.getRegionNearbyAOIsV1 = async function (request) {
  console.log(request);
  // get postcode in order to match areaname in [dbo].[area]
  // geocoding.searchPostcode(request["lat"], request["lng"], function(postcode) {
  //   if (postcode == null) {
  //     callback([]);
  //   } else {
  var count = 50;
  var request_count = Number(request["num"]);

  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }// end if
  }

  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude

  var keys = "A.[AOI_id], A.[title] AS AOI_title, A.[description] AS AOI_description, A.[area_name_en], A.[coverage], A.[identifier], A.[open]" + // A: dbo.AOI
    ", A.[owner] AS rights" + // B: dbo.user_profile
    ", A.[language]"; // dbo.dublincore
  var key2 = ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(E.[latitude])) * cos(radians(E.[longitude]) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(E.[latitude])))) AS distance";

  var query1 = "SELECT " + keys + " FROM moe3.dbo.AOI AS A";
  var query2 = "SELECT [AOI_id] " + key2 + " FROM moe3.dbo.AOI AS A";
  var join1 = "INNER JOIN MOE3.dbo.user_profile AS B ON A.owner = B.user_name";
  var join2 = "INNER JOIN MOE3.dbo.area C ON A.area_name_en = C.area_name_en";
  var join3 = "INNER JOIN MOE3.dbo.AOI_POIs D ON A.AOI_id = D.AOI_id_fk";
  var join4 = "INNER JOIN MOE3.dbo.dublincore E ON E.POI_id = D.POI_id";
  var join5 = "INNER JOIN MOE3.dbo.GroupsPoint F ON F.point_id = A.AOI_id"
  // console.log(request["r_id"]);
  var cond1 = "A.[verification] =1 AND A.[open] = 1 AND E.[language]='" + request["clang"] + "'";
  var cond2 = "(E.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")";
  var cond3 = "(E.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";
  var cond4 = "F.types = 'aoi' AND F.foreignkey_id IN (SELECT [group_id] FROM moe3.dbo.RegionsGroup WHERE region_id = " + request["r_id"] + ")";

  var order1 = "ORDER BY distance ASC";
  //query1 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " WHERE " + cond1 + " AND "+ cond2;
  query2 += " " + join1 + " " + join2 + " " + join3 + " " + join4 + " " + join5 + " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
  if (request["iclass"] != null) {
    query1 += "AND A.[identifier]='" + request["iclass"] + "'";
  }
  query2 += " " + order1;
  console.log(query2);

  try {
    let recordset = await new db.Request().query(query2)
    if (recordset.length == 0) {
      return recordset
    } else {
      let jsonData = await searchAOIs(recordset, query1, count)
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
      searchAOIs(recordset, query1, count, function (jsonData) {
        callback(jsonData)
      });
      //searchPOIs(recordset, function(jsonData){ callback(jsonData) });
    }
  });*/
  //   }
  // });
}