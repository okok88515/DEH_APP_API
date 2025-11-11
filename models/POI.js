var db = require('mssql');
var dbconfig = require('../utility/config').dbconfig;
var geo = require('geolib');
var geocoding = require('../services/geocoding');
var shortid = require('shortid');
var moment = require('moment');
var fs = require('fs');
var ftp = require('jsftp');
var ftpconfig = require('../utility/config').ftpconfig;
var ftpconfig2 = require('../utility/config').ftpconfig2;
var poi = require('./POI')

// db connect
// ...
db.connect(dbconfig).then(function () {
  console.log('POI: connected to Micorsoft SQL server');
}).catch(function (err) {
  console.log(err);
});

// exports function
exports.searchPOI = async function (request) {
  var keys = "[POI_id], [POI_title], [latitude], [longitude]";
  keys += ",  ([POI_description_1]+''+ISNULL([POI_description_2], '')) AS POI_description";
  keys += ", [POI_address], [orig_poi],[subject],[keyword1], [format], [rights], [open], [identifier], [language],[verification]";

  var query1 = "SELECT " + keys + " FROM [MOE3].[dbo].[dublincore]"; // default: 50 data
  var cond1 = "[POI_id]=" + Number(request["id"]);

  query1 += " WHERE " + cond1;
  console.log("query1: " + query1);

  try {
    let recordset = await new db.Request().query(query1)
    if (recordset.length == 0) {
      return recordset
    } else {
      let jsonData = await searchMedia(recordset)
      return jsonData
    }
  } catch (err) {
    console.log(err);
  }
}

exports.uploadPOI = async function (request) {
  // transfer files to DEH server
  //console.log(request.files)
  var content = JSON.parse(request.body.content);
  var files = request.files;
  console.log('form data', content);

  // upload content
  uploadContent(content, function (success, id) {
    if (!success) return [success, "upload failed!", null];
    content["POI_id"] = id;
    uploadMedia(content, files, function (success, upload_files) {
      console.log(success)
      if (!success) return [false, "file can't transfer", null];
      addCOIPoint(id, content["COI_name"], function (success, message) {
        if (success) {
          return [true, "file uploaded!", id];
          // console.log(upload_files);
        } else {
          return [false, message, null];
        }
      });
    });
  });
}

exports.getNearbyPOIs = async function (request) {
  var keys = "A.[POI_id], A.[POI_title], A.[latitude], A.[longitude]";
  keys += ", (A.[POI_description_1]+''+ISNULL(A.[POI_description_2], '')) AS POI_description";
  keys += ", A.[POI_address], A.[orig_poi],A.[subject],A.[keyword1], A.[format], A.[rights], A.[open], A.[identifier], A.[language]";

  // calculate distance by using great circle route and add it to key-value
  keys += ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(latitude)) * cos(radians(longitude) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(latitude)))) AS distance";
  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude
  var count = 50; // default
  var request_count = Number(request["num"]);
  console.log("num=" + Number(request["num"]));
  var tp = Number(request["tp"]);
  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }
  }// end if
  console.log("tp=" + tp);

  var cond2 = "(A.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")"; // between bounds
  var cond3 = "(A.[longitude] between " + bounds[0]['longitude'] + "AND " + bounds[1]['longitude'] + ")";// between bounds
  var cond4 = "A.[language]='" + request["clang"] + "'"; // default: Chinese
  var cond5 = "A.[POI_id] IN (SELECT [foreignKey] FROM moe3.dbo.mpeg WHERE format = " + request["tp"] + ")";

  //Chenyi20180327 : Check the coi_name
  if (request["coi_name"] == "deh") {
    var query1 = "SELECT TOP " + count + " " + keys + " FROM [MOE3].[dbo].[dublincore] AS A"; // default: 50 data
    var cond1 = "(A.[verification] = 1 OR A.[verification] = 10 OR A.[verification] =2) AND A.[open] = 1"; // opened POI
  } else {
    var query1 = "SELECT TOP " + count + " " + keys + " FROM [MOE3].[dbo].[dublincore] AS A , [MOE3].[dbo].[CoiPoint] AS B"; // default: 50 data
    var cond1 = "(B.[verification] = 1 OR B.[verification] = 10 OR B.[verification] =2) AND A.[open] = 1"; // opened POI
    var cond6 = "AND A.POI_id = B.point_id AND B.types='poi' AND B.[coi_name]= '" + request["coi_name"] + "'";
  } // End of Check
  var order1 = "ORDER BY distance ASC"; // ordered by most description which means more valuable
  //if(request["tp"] !=null)
  //query1 += join1;
  query1 += " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
  tp = Number(request["tp"]);
  if (!isNaN(tp))
    query1 += " AND " + cond5;
  if (request["iclass"] != null) {
    query1 += " AND A.[identifier]='" + request["iclass"] + "'";// if search specific identifier class
  }
  if (request["fmt"] != null) {
    switch (request["fmt"]) {
      case "1":
        query1 += " AND A.[format] = '古蹟、歷史建築、聚落'";
        break;
      case "2":
        query1 += " AND A.[format] = '遺址'";
        break;
      case "3":
        query1 += " AND A.[format] = '人文景觀'";
        break;
      case "4":
        query1 += " AND A.[format] = '自然景觀'";
        break;
      case "5":
        query1 += " AND A.[format] = '傳統藝術'";
        break;
      case "6":
        query1 += " AND A.[format] = '民俗及有關文物'";
        break;
      case "7":
        query1 += " AND A.[format] = '古物'";
        break;
      case "8":
        query1 += " AND A.[format] = '食衣住行育樂'";
        break;
      case "9":
        query1 += " AND A.[format] = '其他'";
        break;
    }
  }
  //Chenyi20180327 : Check if the app is coi app
  if (request['coi_name'] != "deh") {
    query1 += cond6;
  }//End of Check

  query1 += " " + order1;

  console.log("query: " + query1);
  try {
    let recordset = await new db.Request().query(query1)
    if (recordset.length == 0) {
      return recordset;
    } else {
      // search media in POIs and callback
      let jsonData = searchMedia(recordset)
      return jsonData
    }// end else
  } catch (err) {
    console.log("err" + err);
    return {}
  }
  // new db.Request().query(query1).then(function (recordset) { // send request
  //   if (recordset.length == 0) {
  //     callback(recordset);
  //   } else {
  //     // search media in POIs and callback
  //     searchMedia(recordset, function (jsonData) { callback(jsonData); });
  //   }// end else
  // }).catch(function (err) {
  //   console.log("err" + err);
  // });
}

exports.getGroupNearbyPOIs = async function (request) {
  // console.log(Number(request["num"]));
  var g_id = request["g_id"]
  var keys = "A.[POI_id], A.[POI_title], A.[latitude], A.[longitude]";
  keys += ", (A.[POI_description_1]+''+ISNULL(A.[POI_description_2], '')) AS POI_description";
  keys += ", A.[POI_address], A.[orig_poi],A.[subject],A.[keyword1], A.[format], A.[rights], A.[open], A.[identifier], A.[language]";
  // calculate distance by using great circle route and add it to key-value
  //key  += ", B.[foreignKey],B.[]
  keys += ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(latitude)) * cos(radians(longitude) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(latitude)))) AS distance";
  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude
  var count = 50; // default
  var request_count = Number(request["num"]);
  // console.log("num=" + Number(request["num"]));
  var tp = Number(request["tp"]);
  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }
  }// end if
  // console.log("tp=" + tp);
  var query1 = "SELECT distinct TOP " + count + " " + keys + " FROM [MOE3].[dbo].[dublincore] AS A , [MOE3].[dbo].[GroupsPoint] AS B , [MOE3].[dbo].[CoiPoint] AS C "; // default: 50 data
  //var cond1 = "(C.[verification] = 1 OR C.[verification] = 10 OR C.[verification] =2 or true) AND A.[open] = 1"; // opened POI
  var cond1 = "A.[open] = 1"; // opened POI
  var cond2 = "(A.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")"; // between bounds
  var cond3 = "(A.[longitude] between " + bounds[0]['longitude'] + "AND " + bounds[1]['longitude'] + ")";// between bounds
  var cond4 = "A.[language]='" + request["clang"] + "'"; // default: Chinese
  var cond5 = "A.[POI_id] IN (SELECT [foreignKey] FROM moe3.dbo.mpeg WHERE format = " + request["tp"] + ")";
  var cond6 = "A.POI_id = B.point_id AND A.POI_id = C.point_id AND B.types='poi' AND B.foreignkey_id=" + g_id;
  var order1 = ""; // ordered by most description which means more valuable
  //if(request["tp"] !=null)
  //query1 += join1;
  query1 += " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
  tp = Number(request["tp"]);
  if (!isNaN(tp))
    query1 += " AND " + cond5;
  if (request["iclass"] != null) {
    query1 += " AND A.[identifier]='" + request["iclass"] + "'";// if search specific identifier class
  }
  if (request["fmt"] != null) {
    switch (request["fmt"]) {
      case "1":
        query1 += " AND A.[format] = '古蹟、歷史建築、聚落'";
        break;
      case "2":
        query1 += " AND A.[format] = '遺址'";
        break;
      case "3":
        query1 += " AND A.[format] = '人文景觀'";
        break;
      case "4":
        query1 += " AND A.[format] = '自然景觀'";
        break;
      case "5":
        query1 += " AND A.[format] = '傳統藝術'";
        break;
      case "6":
        query1 += " AND A.[format] = '民俗及有關文物'";
        break;
      case "7":
        query1 += " AND A.[format] = '古物'";
        break;
      case "8":
        query1 += " AND A.[format] = '食衣住行育樂'";
        break;
      case "9":
        query1 += " AND A.[format] = '其他'";
        break;
    }
  }
  query1 += " " + " AND " + cond6;
  query1 += " " + order1;

  console.log("query: " + query1);
  try {
    let recordset = await new db.Request().query(query1)
    if (recordset.length == 0) {
      return recordset
    } else {
      let jsonData = await searchMedia(recordset)
      return jsonData
    }
  } catch (err) {
    console.log("err" + err);
  }
  /*
  new db.Request().query(query1).then(function (recordset) { // send request
    if (recordset.length == 0) {
      callback(recordset);
    } else {
      // search media in POIs and callback
      //console.log('recordser:',recordset)
      searchMedia(recordset, function (jsonData) { callback(jsonData); });
    }// end else
  }).catch(function (err) {
    console.log("err" + err);
  });*/
}



exports.getUserPOIs = async function (request) {
  var count = 50; // default
  var request_count = Number(request["num"]);
  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }
  }
  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude
  var keys = "[POI_id], [POI_title], [latitude], [longitude], ([POI_description_1]+''+ISNULL([POI_description_2], '')) AS POI_description, " +
    "[POI_address], [orig_poi],[subject],[keyword1], [format], [rights], [open], [identifier], [language], [area_name_en], " +
    "( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(latitude)) * cos(radians(longitude) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(latitude)))) AS distance";
  var cond1 = "(latitude between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")"; // between bounds
  var cond2 = "(longitude between " + bounds[0]['longitude'] + "AND " + bounds[1]['longitude'] + ")";// between bounds
  //Chenyi20180327 : condition for coi
  var cond3 = " A.POI_id = B.point_id AND B.types='poi' AND B.[coi_name]= '" + request["coi_name"] + "'"
  if (request["coi_name"] != "deh") {
    var query1 = "SELECT TOP " + count + " " + keys + " FROM [MOE3].[dbo].[dublincore] as A,[MOE3].[dbo].[CoiPoint] as B WHERE B.verification<>2 AND A.[rights]='" + request["username"] + "' AND " + cond1 + " AND " + cond2 + " AND " + cond3 + " ORDER BY distance ASC";
  } else {
    var query1 = "SELECT TOP " + count + " " + keys + " FROM [MOE3].[dbo].[dublincore]  WHERE verification<>2 AND [rights]='" + request["username"] + "' AND " + cond1 + " AND " + cond2 + " ORDER BY distance ASC";
  }

  console.log("query: " + query1);
  try {
    let recordset = await new db.Request().query(query1)
    if (recordset.length == 0) return recordset;
    searchMedia(recordset, function (jsonData) { return jsonData; });
  } catch (error) {
    console.log("err" + err);
  }
  // new db.Request().query(query1).then(function (recordset) {
  //   if (recordset.length == 0) return callback(recordset);
  //   searchMedia(recordset, function (jsonData) { callback(jsonData); });
  // }).catch(function (err) {
  //   console.log("err" + err);
  // });
}
//Chenyi20180201:搜尋Group我的POI
exports.getUserGroupPOIs = async function (request) {
  var count = 50; // default
  var request_count = Number(request["num"]);
  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }
  }
  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude
  var keys = "[POI_id], [POI_title], [latitude], [longitude], ([POI_description_1]+''+ISNULL([POI_description_2], '')) AS POI_description, " +
    "[POI_address], [orig_poi],[subject],[keyword1], [format], [rights], [open], [identifier], [language], [area_name_en], " +
    "( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(latitude)) * cos(radians(longitude) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(latitude)))) AS distance";
  var cond1 = "(latitude between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")"; // between bounds
  var cond2 = "(longitude between " + bounds[0]['longitude'] + "AND " + bounds[1]['longitude'] + ")";// between bounds
  //其中group_id在App和Server溝通的時候是要多包的
  var query1 = "SELECT TOP " + count + " " + keys + " FROM [MOE3].[dbo].[GroupsPoint] as gp,[MOE3].[dbo].[dublincore] as d" +
    " WHERE gp.[types]='poi' AND foreignkey_id = " + request['g_id'] + " AND gp.point_id = d.POI_id AND " +
    "verification<>2 AND d.[rights]='" + request["username"] + "' AND " + cond1 + " AND " + cond2 + " ORDER BY distance ASC";
  console.log("QUERY1  :" + query1)

  try {
    let recordset = await new db.Request().query(query1)
    if (recordset.length == 0) return recordset;
    let jsonData = await searchMedia(recordset)
    return jsonData
  } catch (err) {
    console.log("err", err);
  }
  /*
  new db.Request().query(query1).then(function (recordset) {
    if (recordset.length == 0) return callback(recordset);
    searchMedia(recordset, function (jsonData) { callback(jsonData); });
  }).catch(function (err) {
    console.log("err", err);
  });*/
}

function uploadContent(content, done) {
  geocoding.searchPostcode(content["latitude"], content["longitude"], function (country) {
    var country = "TW"
    console.log("country = " + country);
    if (country == null) {
      return done(false, null);
    } else if (country.substring(0, 2).trim() === "TW") {
      var postcode = country.substring(2);
      var query1 = "SELECT [POI_id],[area_name_en] FROM [MOE3].[dbo].[dublincore] WHERE area_name_en= 'TainanEast' ";
      console.log("query: " + query1);
      new db.Request().query(query1).then(function (recordset) {
        content["area_name_en"] = recordset[0]["area_name_en"];

        var sumOfPOIs = recordset.length;
        var num = ("000000" + sumOfPOIs).slice(-6);
        content["POI_name"] = postcode + "-" + num;
        // change open field to Boolean type(?
        // yap, this is very strange... the type of open field in dublincore is nchar
        if (content["open"] == true) {
          content["open"] = "1";
        } else {
          content["open"] = "0";
        }
        // upload POI_content
        var keys = "[poi_name],[poi_title],[subject],[area_name_en],[type1],[keyword1],[keyword2],[keyword3],[keyword4],[keyword5]," +
          "[period],[year],[height],[poi_address],[latitude],[longitude],[scope],[poi_description_1],[poi_description_2]," +
          "[language],[format],[poi_name_old],[verification],[rights],[contributor],[creator],[publisher],[POI_source]," +
          "[identifier],[open],[POI_added_time],[orig_poi]";
        var values = [content["POI_name"], content["POI_title"], content["subject"], content["area_name_en"], content["type"], content["keyword"], "", "", "", "",
        content["period"], content["year"], content["height"], content["POI_address"], content["latitude"], content["longitude"], content["scope"], content["POI_description"], "",
        content["language"], content["format"], "test", 0, content["rights"], content["rights"], content["rights"], content["rights"], content["source"],
        content["identifier"], content["open"], moment().format('YYYY-MM-DD hh:mm:ss'), 0];

        var valstr = values.join("',N'");
        var query2 = "INSERT INTO [MOE3].[dbo].[dublincore] (" + keys + ") VALUES('" + values.join("',N'") + "')";
        var query3 = "SELECT [POI_id] FROM [MOE3].[dbo].[dublincore] WHERE POI_name='" + content["POI_name"] + "' AND POI_title='" + content["POI_title"] + "'";
        console.log("query:" + query2);
        // INSERT
        new db.Request().query(query2).then(function (recordset) {
          new db.Request().query(query3).then(function (recordset) {
            var poi_id = recordset[0]["POI_id"];
            var group_name = content["group_name"];
            console.log(group_name)
            if (group_name === undefined) {
              console.log("FQ")
            }

            if (group_name != "" && group_name !== undefined) {
              var query4 = "SELECT [group_id] FROM [MOE3].[dbo].[Groups] WHERE [group_name] = '" + content['group_name'] + "'";
              new db.Request().query(query4).then(function (recordset) {
                var group_id = recordset[0]['group_id']

                var keys5 = "[point_id],[foreignkey_id],[types]";
                var values5 = [poi_id, group_id, "poi"];
                var query5 = "INSERT INTO [MOE3].[dbo].[GroupsPoint] (" + keys5 + ") VALUES ('" + values5.join("',N'") + "')";
                var query6 = "SELECT * FROM [MOE3].[dbo].[GroupsPoint] WHERE [point_id] = " + poi_id + " AND [foreignkey_id] = " + group_id;
                new db.Request().query(query5).then(function (recordset) {
                  new db.Request().query(query6).then(function (recordset) {
                    return done(true, recordset[0]['point_id'])
                  }).catch(function (err) {
                    console.log(err);
                    return done(false, null);
                  });
                }).catch(function (err) {
                  console.log(err);
                  return done(false, null);
                });
              }).catch(function (err) {
                console.log(err);
                return done(false, null);
              });
            } else {
              return done(true, poi_id);
            }
          }).catch(function (err) {
            console.log(err);
            return done(false, null);
          });
        }).catch(function (err) {
          console.log(err);
          return done(false, null);
        });

      }).catch(function (err) {
        console.log(err);
        return done(false, null);
      });
    } else {
      var query0 = "SELECT [area_id] ,[area_name_en] FROM [MOE3].[dbo].[area] WHERE area_name_en = '" + country + "'";
      new db.Request().query(query0).then(function (recordset1) {
        var postcode = recordset1[0]["area_id"];
        var area_name_en = recordset1[0]["area_name_en"];
        var query1 = "SELECT [POI_id],[area_name_en] FROM [MOE3].[dbo].[dublincore] WHERE area_name_en= '" + area_name_en + "'";
        console.log("query:" + query1);
        new db.Request().query(query1).then(function (recordset) {
          console.log(query1);
          console.log(recordset);
          content["area_name_en"] = area_name_en;
          var sumOfPOIs = recordset.length;
          // request POI_name: ['area_id'-'sumOfPOIs']
          var num = ("000000" + sumOfPOIs).slice(-6);
          content["POI_name"] = postcode + "-" + num;
          // change open field to Boolean type(?
          // yap, this is very strange... the type of open field in dublincore is nchar
          if (content["open"] == true) {
            content["open"] = "1";
          } else {
            content["open"] = "0";
          }
          // upload POI_content
          var keys =
            "[poi_name],[poi_title],[subject],[area_name_en],[type1],[keyword1],[keyword2],[keyword3],[keyword4],[keyword5]," +
            "[period],[year],[height],[poi_address],[latitude],[longitude],[scope],[poi_description_1]," +
            "[language],[format],[poi_name_old],[verification],[rights],[contributor],[creator],[publisher],[POI_source]," +
            "[identifier],[open],[POI_added_time]";

          var values = [
            content["POI_name"], content["POI_title"], content["subject"], content["area_name_en"], content["type"], content["keyword"], "", "", "", "",
            content["period"], content["year"], content["height"], content["POI_address"], content["latitude"], content["longitude"], content["scope"], content["POI_description"],
            content["language"], content["format"], "test", 0, content["rights"], content["rights"], content["rights"], content["rights"], content["source"],
            content["identifier"], content["open"], moment().format('YYYY-MM-DD hh:mm:ss')
          ];

          var valstr = values.join("',N'");
          var query2 = "INSERT INTO [MOE3].[dbo].[dublincore] (" + keys + ") VALUES('" + values.join("',N'") + "')";
          console.log("query: " + query2);
          var query3 = "SELECT [POI_id] FROM [MOE3].[dbo].[dublincore] WHERE POI_name='" + content["POI_name"] + "' AND POI_title=N'" + content["POI_title"] + "'";
          console.log("query: " + query3);

          new db.Request().query(query2).then(function (recordset) {
            new db.Request().query(query3).then(function (recordset) {
              var poi_id = recordset[0]["POI_id"];
              var group_name = content["group_name"];

              if (group_name != "") {
                var query4 = "SELECT [group_id] FROM [MOE3].[dbo].[Groups] WHERE [group_name] = '" + content['group_name'] + "'";
                new db.Request().query(query4).then(function (recordset) {
                  var group_id = recordset[0]['group_id']

                  var keys5 = "[point_id],[foreignkey_id],[types]";
                  var values5 = [poi_id, group_id, "poi"];
                  var query5 = "INSERT INTO [MOE3].[dbo].[GroupsPoint] (" + keys5 + ") VALUES ('" + values5.join("',N'") + "')";
                  var query6 = "SELECT * FROM [MOE3].[dbo].[GroupsPoint] WHERE [point_id] = " + poi_id + " AND [foreignkey_id] = " + group_id;
                  new db.Request().query(query5).then(function (recordset) {
                    new db.Request().query(query6).then(function (recordset) {
                      return done(true, recordset[0]['point_id'])
                    }).catch(function (err) {
                      console.log(err);
                      return done(false, null);
                    });
                  }).catch(function (err) {
                    console.log(err);
                    return done(false, null);
                  });
                }).catch(function (err) {
                  console.log(err);
                  return done(false, null);
                });
              } else {
                return done(true, poi_id);
              }
            }).catch(function (err) {
              console.log(err);
              return done(false, null);
            });
          }).catch(function (err) {
            console.log(err);
            return done(false, null);
          });
        }).catch(function (err) {
          console.log(err);
          return done(false, null);
        });
      });
    }
  });
}

function uploadMedia(content, files, done) {
  var _base = "E:/new_DEH/";
  //console.log(files);
  var finalpath = "";
  for (i = 0; i < files.length; i++) {
    // dest filename
    var destpath = "";
    var flag = 1;
    var url = "";
    var clients;
    var med_fmt = content["media_set"][i]["media_format"];
    var timestamp = moment();
    var type = files[i]["mimetype"].split("/")[0];
    var format = files[i]["mimetype"].split("/")[1];
    var deformatname = timestamp.format('YYYYMMDDhhmmss') + "_" + shortid.generate();
    var filename = deformatname + "." + format;
    var size = files[i]["size"];
    var rights = content["rights"];
    var foreignkey = content["POI_id"];
    switch (type) {
      case "image":
        url = "player_pictures/media/" + filename;
        destpath = _base + url;
        break
      case "audio":
        url = "player_pictures/media/audio/" + filename;
        destpath = _base + url;
        break
      case "video":
        url = "player_pictures/media/video/" + filename;
        destpath = _base + url;
        break
      default:
    }
    console.log("i=" + i + "\n");
    console.log("transfer " + files[i]["path"] + " to " + destpath);
    // replace
    copyFile(files[i]["path"], destpath, type, foreignkey, filename, deformatname);
    fs.unlink(files[i]["path"], function () {
      console.log("Deleta success");
    });

    // insert into mpeg table
    var keys = "picture_name, picture_type, picture_url, picture_size" + ", picture_upload_user, picture_source, picture_rights, picture_upload_time, foreignKey,format";
    var query1 = "INSERT INTO [MOE3].[dbo].[mpeg] (" + keys + ") VALUES('" + filename + "', '" + format + "', '" + "../" + url + "', " + size + ", '" + rights + "', '', '" + rights + "', CURRENT_TIMESTAMP, " + foreignkey + ", " + med_fmt + ")";
    console.log("query: " + query1);
    new db.Request().query(query1).then(function (recordset) { // send request
      console.log("db data transfered successfully!");
    }).catch(function (err) {
      console.log('err: ' + err);
      done(false, null);
    });
    if (i == 6) {
      setTimeout(sendfinal(clients), 10000);
    }
  } // end for
  done(true, files);
}

function addCOIPoint(poi_id, coi_name, callback) {
  var key = "types, point_id, coi_name, verification, feedback_mes";
  var value = "'poi" + "', '" + poi_id + "', '" + coi_name + "', " + 0 + ", '驗證未通過'";
  var query = "INSERT INTO [MOE3].[dbo].[CoiPoint] (" + key + ") VALUES (" + value + ")";
  console.log("query: " + query);
  new db.Request().query(query).then(function (recordset) {
    callback(true, "insert into coi success!");
  }).catch(function (err) {
    console.log('err: ' + err);
    callback(false, "insert into coi error!");
  });
}

function sendfinal(clients) {
  clients.raw.quit();
  console.log("??????");
  //var clients = new ftp(ftpconfig);
}

// try to find out media in every POI
async function searchMedia(jsonData) {
  // POI is a native POI if "orig_poi" == 0
  // POI is a translated POI if "orig_poi" != 0
  var idList = jsonData[0]["orig_poi"] == 0 || jsonData[0]["orig_poi"] == null ? jsonData[0]["POI_id"] : jsonData[0]["orig_poi"];
  jsonData[0]["open"] = Boolean(parseInt(jsonData[0]["open"]));

  // adjust
  for (i = 1; i < jsonData.length; i++) {
    if (jsonData[i]["orig_poi"] == 0 || jsonData[0]["orig_poi"] == null) {
      idList += ", " + jsonData[i]["POI_id"];
    } else {
      idList += ", " + jsonData[i]["orig_poi"];
    }
    jsonData[i]["open"] = Boolean(parseInt(jsonData[i]["open"]));
  }

  var jsonData = jsonData.sort(sortById); // sort POIs by POI_id
  // select "picture_type, picture_url, foreignKey"
  var query1 = "SELECT picture_type, format, picture_url, foreignKey from [MOE3].[dbo].[mpeg] WHERE foreignKey IN (" + idList + ") ORDER BY foreignKey ASC";
  console.log("query: " + query1);

  try {
    let recordset = await new db.Request().query(query1)
    if (recordset.length == 0) {
      return jsonData
    } else {
      var mediaset = recordset;
      // console.log(mediaset)
      jsonData = append(jsonData, mediaset);
      return jsonData
    }
  } catch (err) {
    console.log("err" + err);
  }
  /*
  new db.Request().query(query1).then(function (recordset) { // send request
    if (recordset.length == 0) {
      callback(jsonData);
    } else {
      var mediaset = recordset;
      console.log(mediaset)
      jsonData = append(jsonData, mediaset);
      callback(jsonData);
    }
  }).catch(function (err) {
    console.log("err" + err);
  });*/
}

function sortById(a, b) {
  return a.POI_id - b.POI_id;
}

function append(data, mediaset) {
  try {
    console.log("appending media...");
    //console.log(data);
    var j = 0;
    var id = -1;
    for (i = 0; i < data.length; i++) {
      // get POI id
      id = data[i]["orig_poi"] == 0 || data[i]["orig_poi"] == null ? data[i]["POI_id"] : data[i]["orig_poi"];
      //console.log("id: "+id);
      // append
      var media = [];
      // append some media to POIs[i]
      // console.log("id: " + id);
      // console.log("foreignKey: " + mediaset[j]["foreignKey"]);
      while (mediaset[j] !== undefined && id == mediaset[j]["foreignKey"]) {
        var json = {};
        var _dirname = "http://deh.csie.ncku.edu.tw/";
        var media_type = mediaset[j]["picture_type"];
        switch (media_type.toLowerCase()) {
          case ".jpg":
          case "jpg":
          case "jpeg":
          case "png":
          case "bmp":
          case "gif":
            json["media_type"] = mediaset[j]["picture_type"];
            json["media_format"] = mediaset[j]["format"];
            json["media_url"] = _dirname + mediaset[j]["picture_url"].substring(3);
            media.push(json);
            break;
          case "aac":
          case "amr":
          case "wav":
          case "mp3":
            json["media_type"] = mediaset[j]["picture_type"];
            json["media_format"] = mediaset[j]["format"];
            json["media_url"] = _dirname + mediaset[j]["picture_url"].substring(3);
            media.push(json);
            break;
          case "wmv":
          case "mp4":
            json["media_type"] = mediaset[j]["picture_type"];
            json["media_format"] = mediaset[j]["format"];
            json["media_url"] = _dirname + mediaset[j]["picture_url"].substring(3);
            media.push(json);
            break;
          default:
            break;
        }
        //console.log(media[j]["picture_url"]);
        j++;
        if (mediaset[j] === undefined) {
          break;
        }
      }// end while
      if (media.length != 0) {
        data[i]["media_set"] = media; // add media object by key "media_set"
      }
    }// end for
    //console.log(data)
    console.log("end appending.");
    return data;
  } catch (err) {
    console.log("err: ", err)
  }

}

function copyFile(src, dest, mediatype, poi_id, filename, deformatename) {
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
    if (mediatype == "video") {
      console.log("Check vedio encoding");
      console.log(fs.existsSync(dest));
      checkVedioEncoding(poi_id, filename, deformatename);
    }
  });
}

function checkVedioEncoding(poiid, filename, name) {
  var childProcess = require('child_process');
  console.log(filename)
  var exe_code = "ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 E:\\new_DEH\\player_pictures\\media\\video\\" + filename;
  var sp_code = exe_code.split(" ");

  var child = childProcess.spawn('C:\\ffmpeg\\bin\\ffprobe.exe', sp_code.slice(1));

  child.stdout.on('data', function (data) {
    console.log('stdout: ' + data);
    if (data.slice(0, 4) != "h264") {
      convert_codec(poiid, filename, name);
    }
  });

  child.stderr.on('data', function (data) {
    console.log('stderr: ' + data);
  });

  child.on('error', function (code) {
    console.log(code);
  });

  child.on('close', function (code) {
    console.log('exit Process:' + code);
  });
}

function convert_codec(poiid, filename, name) {
  var childProcess = require('child_process');

  let media_path = "E:\\new_DEH\\player_pictures\\media\\video\\";
  var exe_code = "ffmpeg -y -i " + media_path + filename + " -f mp4 -vcodec h264 " + media_path + name + ".mp4";
  var sp_code = exe_code.split(" ");

  var child = childProcess.spawn('C:\\ffmpeg\\bin\\ffmpeg.exe', sp_code.slice(1));

  child.stdout.on('data', function (data) {
    console.log('stdout: ' + data);
  });

  child.stderr.on('data', function (data) {
    console.log('stderr: ' + data);
  });

  child.on('error', function (code) {
    console.log(code);
  });

  child.on('close', function (code) {
    console.log('exit Process:' + code);
    update_media_type(poiid, filename, name);
  });
}

function update_media_type(poiid, filename, deFormatFilename) {
  let media_path = "../player_pictures/media/video/";
  let query = "UPDATE [MOE3].[dbo].[mpeg] SET picture_name='" + deFormatFilename + ".mp4', picture_type='mp4', picture_url='" + media_path + deFormatFilename + ".mp4'";
  query += "WHERE picture_name='" + filename + "' AND foreignkey=" + poiid;

  new db.Request().query(query).then(function (recordset) {
    console.log("updata vedio success");
  }).catch(function (err) {
    console.log("err" + err);
  });
}


exports.getCountClick = async function (poi_id) {
  // console.log("call getCountClick")
  // console.log("input poi_id : " + poi_id)

  var query1 = "SELECT COUNT(*) FROM [MOE3].[dbo].[Logs] WHERE [page] = '/API/poi_detail/" + poi_id + "'"

  // console.log("do query : " + query1)

  try {
    let recordset = await new db.Request().query(query1)
    return recordset
  } catch (err) {
    console.log("err" + err)
  }
  // new db.Request().query(query1).then(function (recordset) {
  //     console.log("outcome : " + recordset)

  //     callback(recordset);
  // }).catch(function (err) {
  //     console.log("err" + err);
  //     callback(null);
  // });
}

//// Below is programed by juanmh aka moebear @ 202101
exports.queryUserPOIs = async function (request) {
  var count = 50; // default
  var request_count = Number(request["num"]);
  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }
  }
  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude
  var keys = "[POI_id] AS XOI_id, [POI_title] AS XOI_title, [latitude], [longitude], ([POI_description_1]+''+ISNULL([POI_description_2], '')) AS XOI_description, " +
    "[POI_address] AS XOI_address, [orig_poi],[subject],[keyword1], [format], [rights], [open], [identifier], [language], [area_name_en], " +
    "( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(latitude)) * cos(radians(longitude) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(latitude)))) AS distance";
  var cond1 = "(latitude between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")"; // between bounds
  var cond2 = "(longitude between " + bounds[0]['longitude'] + "AND " + bounds[1]['longitude'] + ")";// between bounds
  //Chenyi20180327 : condition for coi
  var cond3 = " A.POI_id = B.point_id AND B.types='poi' AND B.[coi_name]= '" + request["coi_name"] + "'"
  if (request["coi_name"] != "deh") {
    var query1 = "SELECT TOP " + count + " " + keys + " FROM [MOE3].[dbo].[dublincore] as A,[MOE3].[dbo].[CoiPoint] as B WHERE B.verification<>2 AND A.[rights]='" + request["username"] + "' AND " + cond1 + " AND " + cond2 + " AND " + cond3 + " ORDER BY distance ASC";
  } else {
    var query1 = "SELECT TOP " + count + " " + keys + " FROM [MOE3].[dbo].[dublincore]  WHERE verification<>2 AND [rights]='" + request["username"] + "' AND " + cond1 + " AND " + cond2 + " ORDER BY distance ASC";
  }

  console.log("query: " + query1);
  let POIs = await new db.Request().query(query1)
  if (POIs.length == 0) { return POIs }
  else {
    let POIsWithMedias = await poi.queryMedias(POIs)
    return POIsWithMedias
  }
}
//also add xoiCategory, 'poi', 'loi', 'aoi', 'soi' used in ios swiftui json decoder
exports.queryMedias = async function (POIs) {
  var idList = POIs[0]["orig_poi"] == 0 || POIs[0]["orig_poi"] == null ? POIs[0]["XOI_id"] : POIs[0]["orig_poi"];
  POIs[0]["open"] = Boolean(parseInt(POIs[0]["open"]));
  POIs[0]["xoiCategory"] = "poi"
  // adjust
  console.log("Done!!!!");
  for (i = 1; i < POIs.length; i++) {
    if (POIs[i]["orig_poi"] == 0 || POIs[0]["orig_poi"] == null) {
      idList += ", " + POIs[i]["XOI_id"];
    } else {
      idList += ", " + POIs[i]["orig_poi"];
    }
    POIs[i]["open"] = Boolean(parseInt(POIs[i]["open"]));
    POIs[i]["xoiCategory"] = "poi"
  }

  var POIs = POIs.sort(sortById); // sort POIs by POI_id
  // select "picture_type, picture_url, foreignKey"
  var query1 = "SELECT picture_type, format, picture_url, foreignKey from [MOE3].[dbo].[mpeg] WHERE foreignKey IN (" + idList + ") ORDER BY foreignKey ASC";
  if (global.debugPrintLevel >= 2) console.log("query: " + query1);

  let mediaSets = await new db.Request().query(query1)

  // console.log(POIs[0]["XOI_id"]);
  // console.log(idList);
  // if(mediaSets.length == 0){return POIs}
  // else{
  let POIsWithMediaSets = appendMediaSets(POIs, mediaSets)
  return POIsWithMediaSets
  // }
}


exports.brigedToSearchMedia = function (data, jsonData, callback, appendResponseCallback) {

  searchMediaResponseNormalize(jsonData, function (jsonData2) {
    appendResponseCallback(data, jsonData2, function (jsonData3) {
      callback(jsonData3)
    })
  })
}

//media_format [導覽,影片,聲音,圖片] = [8,4,2,1]
function appendMediaSets(data, mediaset) {
  if (global.debugPrintLevel >= 1) console.log("appending media...");
  //console.log(data);
  // var j = 0;
  var id = -1;
  for (i = 0; i < data.length; i++) {
    // get POI id
    id = data[i]["orig_poi"] == 0 || data[i]["orig_poi"] == null ? data[i]["XOI_id"] : data[i]["orig_poi"];
    var media = [];
    for (j = 0; j < mediaset.length; j++) {
      if (mediaset[j] == undefined || id !== mediaset[j]["foreignKey"]) {
        continue;
      }
      var json = {};
      var _dirname = "http://deh.csie.ncku.edu.tw/";
      var media_type = mediaset[j]["picture_type"];
      switch (media_type.toLowerCase()) {
        case ".jpg":
        case "jpg":
        case "jpeg":
        case "png":
        case "bmp":
        case "gif":
          json["media_type"] = mediaset[j]["picture_type"];
          json["media_format"] = mediaset[j]["format"];
          json["media_url"] = _dirname + mediaset[j]["picture_url"].substring(3);
          media.push(json);
          continue;
        case "aac":
        case "amr":
        case "wav":
        case "mp3":
          json["media_type"] = mediaset[j]["picture_type"];
          json["media_format"] = mediaset[j]["format"];
          json["media_url"] = _dirname + mediaset[j]["picture_url"].substring(3);
          media.push(json);
          continue;
        case "wmv":
        case "mp4":
          json["media_type"] = mediaset[j]["picture_type"];
          json["media_format"] = mediaset[j]["format"];
          json["media_url"] = _dirname + mediaset[j]["picture_url"].substring(3);
          media.push(json);
          continue;
        default:
          continue;
      }
    }
    if (media.length != 0) {
      data[i]["media_set"] = media; // add media object by key "media_set"
    }
    else {
      var json = {}
      json["media_type"] = ""
      json["media_format"] = 0
      json["media_url"] = "";
      media.push(json);
      data[i]["media_set"] = media
    }
    var format = ["none", "image", "audio", "none", "video", "none", "none", "none", "Commentary"]
    for (var k = 0; k < data[i]["media_set"].length; k++) {
      if (data[i]["media_set"][k]["media_format"] > 0 && data[i]["media_set"][k]["media_format"] < 8) {
        data[i]["mediaCategory"] = format[data[i]["media_set"][k]["media_format"]]
      }
    }
    if (data[i]["mediaCategory"] == undefined) data[i]["mediaCategory"] = format[0] // none
  }// end for
  if (global.debugPrintLevel >= 1) console.log("end appending.");
  return data;
}
exports.getCountClickWithColumnName = async function (poi_id) {
  // console.log("call getCountClick")
  // console.log("input poi_id : " + poi_id)

  var query1 = "SELECT COUNT(*) AS count FROM [MOE3].[dbo].[Logs] WHERE [page] = '/API/test/poi_detail/" + poi_id + "'"

  // console.log("do query : " + query1)

  try {
    let recordset = await new db.Request().query(query1)
    return recordset
  } catch (err) {
    console.log("err" + err);
  }
  // new db.Request().query(query1).then(function (recordset) {
  //   console.log("outcome : " + recordset)

  //   callback(recordset);
  // }).catch(function (err) {
  //   console.log("err" + err);
  //   callback(null);
  // });
}
//To be disposed
exports.getUserPOIsResponseNormalize = function (request, callback) {
  var count = 50; // default
  var request_count = Number(request["num"]);
  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }
  }
  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude
  var keys = "[POI_id] AS XOI_id, [POI_title] AS XOI_title, [latitude], [longitude], ([POI_description_1]+''+ISNULL([POI_description_2], '')) AS XOI_description, " +
    "[POI_address] AS XOI_address, [orig_poi],[subject],[keyword1], [format], [rights], [open], [identifier], [language], [area_name_en], " +
    "( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(latitude)) * cos(radians(longitude) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(latitude)))) AS distance";
  var cond1 = "(latitude between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")"; // between bounds
  var cond2 = "(longitude between " + bounds[0]['longitude'] + "AND " + bounds[1]['longitude'] + ")";// between bounds
  //Chenyi20180327 : condition for coi
  var cond3 = " A.POI_id = B.point_id AND B.types='poi' AND B.[coi_name]= '" + request["coi_name"] + "'"
  if (request["coi_name"] != "deh") {
    var query1 = "SELECT TOP " + count + " " + keys + " FROM [MOE3].[dbo].[dublincore] as A,[MOE3].[dbo].[CoiPoint] as B WHERE B.verification<>2 AND A.[rights]='" + request["username"] + "' AND " + cond1 + " AND " + cond2 + " AND " + cond3 + " ORDER BY distance ASC";
  } else {
    var query1 = "SELECT TOP " + count + " " + keys + " FROM [MOE3].[dbo].[dublincore]  WHERE verification<>2 AND [rights]='" + request["username"] + "' AND " + cond1 + " AND " + cond2 + " ORDER BY distance ASC";
  }

  console.log("query: " + query1);
  new db.Request().query(query1).then(function (recordset) {
    if (recordset.length == 0) return callback(recordset);
    searchMediaResponseNormalize(recordset, function (jsonData) { callback(jsonData); });
  }).catch(function (err) {
    console.log("err" + err);
  });
}
exports.getNearbyPOIsV2 = async function (request) {
  var keys = "A.[POI_id] AS XOI_id, A.[POI_title] AS XOI_title, A.[latitude], A.[longitude]";
  keys += ", (A.[POI_description_1]+''+ISNULL(A.[POI_description_2], '')) AS XOI_description";
  keys += ", A.[POI_address] AS XOI_address, A.[orig_poi],A.[subject],A.[keyword1], A.[format], A.[rights], A.[open], A.[identifier], A.[language]";

  // calculate distance by using great circle route and add it to key-value
  keys += ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(latitude)) * cos(radians(longitude) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(latitude)))) AS distance";
  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude
  var count = 50; // default
  var request_count = Number(request["num"]);
  console.log("num=" + Number(request["num"]));
  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = request_count;
    }
  }// end if

  var cond2 = "(A.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")"; // between bounds
  var cond3 = "(A.[longitude] between " + bounds[0]['longitude'] + "AND " + bounds[1]['longitude'] + ")";// between bounds
  var cond4 = "A.[language]='" + request["language"] + "'"; // default: Chinese
  var cond5 = "A.[POI_id] IN (SELECT [foreignKey] FROM moe3.dbo.mpeg WHERE format = " + request["tp"] + ")";

  if (request["coi_name"] == "deh") {
    var query1 = "SELECT TOP " + count + " " + keys + " FROM [MOE3].[dbo].[dublincore] AS A"; // default: 50 data
    var cond1 = "(A.[verification] = 1 OR A.[verification] = 10 OR A.[verification] =2) AND A.[open] = 1"; // opened POI
  } else {
    var query1 = "SELECT TOP " + count + " " + keys + " FROM [MOE3].[dbo].[dublincore] AS A , [MOE3].[dbo].[CoiPoint] AS B"; // default: 50 data
    var cond1 = "(B.[verification] = 1 OR B.[verification] = 10 OR B.[verification] =2) AND A.[open] = 1"; // opened POI
    var cond6 = "AND A.POI_id = B.point_id AND B.types='poi' AND B.[coi_name]= '" + request["coi_name"] + "'";
  }// End of Check
  var order1 = "ORDER BY distance ASC"; // ordered by most description which means more valuable
  //if(request["tp"] !=null)
  //query1 += join1;
  query1 += " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
  if (request["format"] != null) {
    switch (request["format"]) {
      case "1":
        query1 += " AND A.[format] = '古蹟、歷史建築、聚落'";
        break;
      case "2":
        query1 += " AND A.[format] = '遺址'";
        break;
      case "3":
        query1 += " AND A.[format] = '人文景觀'";
        break;
      case "4":
        query1 += " AND A.[format] = '自然景觀'";
        break;
      case "5":
        query1 += " AND A.[format] = '傳統藝術'";
        break;
      case "6":
        query1 += " AND A.[format] = '民俗及有關文物'";
        break;
      case "7":
        query1 += " AND A.[format] = '古物'";
        break;
      case "8":
        query1 += " AND A.[format] = '食衣住行育樂'";
        break;
      case "9":
        query1 += " AND A.[format] = '其他'";
        break;
    }
  }
  if (request['coi_name'] != "deh") {
    query1 += cond6;
  }//End of Check

  query1 += " " + order1;

  console.log("query: " + query1);
  let POIs = await new db.Request().query(query1)
  if (POIs.length == 0) {
    return POIs
  }
  else {
    let jsonData = await poi.queryMedias(POIs)
    return jsonData
  }
}

exports.getNearbyPOIsV3 = async function (request) {
  const { latitude, longitude, distance, number, format, coiName, language } = request;
  var point = { latitude: Number(latitude), longitude: Number(longitude) };
  var bounds = geo.getBoundsOfDistance(point, Number(distance));
  var count = 50;
  var request_count = Number(number);
  console.log("num=" + request_count);

  if (!isNaN(request_count)) {
    count = request_count < 10 ? 10 : request_count < 100 ? request_count : request_count;
  }

  const formatMap = {
    "1": "'古蹟、歷史建築、聚落'",
    "2": "'遺址'",
    "3": "'人文景觀'",
    "4": "'自然景觀'",
    "5": "'傳統藝術'",
    "6": "'民俗及有關文物'",
    "7": "'古物'",
    "8": "'食衣住行育樂'",
    "9": "'其他'"
  };

  var formatCondition = "";
  if (format && formatMap[format]) {
    formatCondition = "AND A.[format] = " + formatMap[format];
  }

  // 動態處理 COI 查詢條件
  var coiCondition = "";
  var coiJoin = "";
  if (coiName === "deh") {
    coiCondition = "(A.[verification] = 1 OR A.[verification] = 10 OR A.[verification] = 2) AND A.[open] = 1";
  } else {
    coiCondition = "(B.[verification] = 1 OR B.[verification] = 10 OR B.[verification] = 2) AND A.[open] = 1 AND A.POI_id = B.point_id AND B.types='poi' AND B.[coi_name] = @coiName";
    coiJoin = "LEFT JOIN [MOE3].[dbo].[CoiPoint] AS B ON A.POI_id = B.point_id";
  }

  // 使用參數化查詢來防止 SQL 注入
  var query = `
  SELECT TOP {count}
    A.[POI_id] AS XOI_id, 
    A.[POI_title] AS XOI_title, 
    A.[latitude], 
    A.[longitude], 
    (A.[POI_description_1] + '' + ISNULL(A.[POI_description_2], '')) AS XOI_description, 
    A.[POI_address] AS XOI_address, 
    A.[orig_poi], 
    A.[subject], 
    A.[keyword1], 
    A.[format], 
    A.[rights], 
    A.[open], 
    A.[identifier], 
    A.[language], 
    (6371 * acos(cos(radians(@latitude)) * cos(radians(A.latitude)) * cos(radians(A.longitude) - radians(@longitude)) + sin(radians(@latitude)) * sin(radians(A.latitude)))) AS distance
  FROM [MOE3].[dbo].[dublincore] AS A
  LEFT JOIN [MOE3].[dbo].[mpeg] AS C ON A.[POI_id] = C.foreign_key
  ${coiJoin} 
  WHERE ${coiCondition}
  AND (A.[latitude] BETWEEN @minLatitude AND @maxLatitude)
  AND (A.[longitude] BETWEEN @minLongitude AND @maxLongitude)
  AND A.[language] = @language
  ${formatCondition}
  ORDER BY distance ASC
  `;
  debugPrint(query, request)
  // 執行 SQL 查詢時傳遞參數
  let POIs = await new db.Request()
    .input('count', db.Int, count)
    .input('latitude', db.Float, latitude)
    .input('longitude', db.Float, longitude)
    .input('minLatitude', db.Float, bounds[0]['latitude'])
    .input('maxLatitude', db.Float, bounds[1]['latitude'])
    .input('minLongitude', db.Float, bounds[0]['longitude'])
    .input('maxLongitude', db.Float, bounds[1]['longitude'])
    .input('coiName', db.NVarChar, coiName)
    .input('language', db.NVarChar, language)
    .query(query);

  return //POIs.length == 0 ? POIs : await poi.queryMedias(POIs);
}




exports.getUserGroupPOIsV2 = async function (request) {
  var count = 50; // default
  var request_count = Number(request["num"]);
  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }
  }
  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude
  var keys = "[POI_id] AS XOI_id, [POI_title] AS XOI_title, [latitude], [longitude], ([POI_description_1]+''+ISNULL([POI_description_2], '')) AS XOI_description, " +
    "[POI_address] AS XOI_address, [orig_poi],[subject],[keyword1], [format], [rights], [open], [identifier], [language], [area_name_en], " +
    "( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(latitude)) * cos(radians(longitude) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(latitude)))) AS distance";
  var cond1 = "(latitude between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")"; // between bounds
  var cond2 = "(longitude between " + bounds[0]['longitude'] + "AND " + bounds[1]['longitude'] + ")";// between bounds
  //其中group_id在App和Server溝通的時候是要多包的
  var query1 = "SELECT TOP " + count + " " + keys + " FROM [MOE3].[dbo].[GroupsPoint] as gp,[MOE3].[dbo].[dublincore] as d" +
    " WHERE gp.[types]='poi' AND foreignkey_id = " + request['groupid'] + " AND gp.point_id = d.POI_id AND " +
    "verification<>2 AND d.[rights]='" + request["username"] + "' AND " + cond1 + " AND " + cond2 + " ORDER BY distance ASC";
  console.log("QUERY1  :" + query1)

  let pois = await new db.Request().query(query1)
  if (pois.length == 0) {
    return pois
  }
  else {
    let POIsWithMedias = poi.queryMedias(pois)
    return POIsWithMedias
  }
  new db.Request().query(query1).then(function (recordset) {
    if (recordset.length == 0) return callback(recordset);
    searchMedia(recordset, function (jsonData) { callback(jsonData); });
  }).catch(function (err) {
    console.log("err", err);
  });
}

exports.getGroupNearbyPOIsV2 = async function (request) {
  var g_id = request["g_id"]
  var keys = "A.[POI_id] AS XOI_id, A.[POI_title] AS XOI_title, A.[latitude], A.[longitude]";
  keys += ", (A.[POI_description_1]+''+ISNULL(A.[POI_description_2], '')) AS XOI_description";
  keys += ", A.[POI_address], A.[orig_poi],A.[subject],A.[keyword1], A.[format], A.[rights], A.[open], A.[identifier], A.[language]";
  // calculate distance by using great circle route and add it to key-value
  //key  += ", B.[foreignKey],B.[]
  keys += ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(latitude)) * cos(radians(longitude) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(latitude)))) AS distance";
  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude
  var count = 50; // default
  var request_count = Number(request["num"]);
  console.log("num=" + Number(request["num"]));
  var tp = Number(request["tp"]);
  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }
  }// end if
  console.log("tp=" + tp);
  var query1 = "SELECT distinct TOP " + count + " " + keys + " FROM [MOE3].[dbo].[dublincore] AS A , [MOE3].[dbo].[GroupsPoint] AS B , [MOE3].[dbo].[CoiPoint] AS C "; // default: 50 data
  //var cond1 = "(C.[verification] = 1 OR C.[verification] = 10 OR C.[verification] =2 or true) AND A.[open] = 1"; // opened POI
  var cond1 = "A.[open] = 1"; // opened POI
  var cond2 = "(A.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")"; // between bounds
  var cond3 = "(A.[longitude] between " + bounds[0]['longitude'] + "AND " + bounds[1]['longitude'] + ")";// between bounds
  var cond4 = "A.[language]='" + request["clang"] + "'"; // default: Chinese
  var cond5 = "A.[POI_id] IN (SELECT [foreignKey] FROM moe3.dbo.mpeg WHERE format = " + request["tp"] + ")";
  var cond6 = "A.POI_id = B.point_id AND A.POI_id = C.point_id AND B.types='poi' AND B.foreignkey_id=" + g_id;
  var order1 = ""; // ordered by most description which means more valuable
  //if(request["tp"] !=null)
  //query1 += join1;
  query1 += " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
  tp = Number(request["tp"]);
  if (!isNaN(tp))
    query1 += " AND " + cond5;
  if (request["iclass"] != null) {
    query1 += " AND A.[identifier]='" + request["iclass"] + "'";// if search specific identifier class
  }
  if (request["fmt"] != null) {
    switch (request["fmt"]) {
      case "1":
        query1 += " AND A.[format] = '古蹟、歷史建築、聚落'";
        break;
      case "2":
        query1 += " AND A.[format] = '遺址'";
        break;
      case "3":
        query1 += " AND A.[format] = '人文景觀'";
        break;
      case "4":
        query1 += " AND A.[format] = '自然景觀'";
        break;
      case "5":
        query1 += " AND A.[format] = '傳統藝術'";
        break;
      case "6":
        query1 += " AND A.[format] = '民俗及有關文物'";
        break;
      case "7":
        query1 += " AND A.[format] = '古物'";
        break;
      case "8":
        query1 += " AND A.[format] = '食衣住行育樂'";
        break;
      case "9":
        query1 += " AND A.[format] = '其他'";
        break;
    }
  }
  query1 += " " + " AND " + cond6;
  query1 += " " + order1;

  console.log("query: " + query1);
  let POIs = await new db.Request().query(query1)
  if (POIs.length == 0) return POIs
  // print(POIs)
  let POIsWithMedias = await poi.queryMedias(POIs)
  // print(POIsWithMedias)
  return POIsWithMedias
  new db.Request().query(query1).then(function (recordset) { // send request
    if (recordset.length == 0) {
      callback(recordset);
    } else {
      // search media in POIs and callback
      //console.log('recordser:',recordset)
      searchMedia(recordset, function (jsonData) { callback(jsonData); });
    }// end else
  }).catch(function (err) {
    console.log("err" + err);
  });
}
// function(request, callback)

exports.getRegionNearbyPOIs = async function (request) {
  // var g_id = request["g_id"]
  var keys = "A.[POI_id] AS XOI_id, A.[POI_title] AS XOI_title, A.[latitude], A.[longitude]";
  keys += ", (A.[POI_description_1]+''+ISNULL(A.[POI_description_2], '')) AS XOI_description";
  keys += ", A.[POI_address], A.[orig_poi],A.[subject],A.[keyword1], A.[format], A.[rights], A.[open], A.[identifier], A.[language]";
  // calculate distance by using great circle route and add it to key-value
  //key  += ", B.[foreignKey],B.[]
  keys += ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(latitude)) * cos(radians(longitude) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(latitude)))) AS distance";
  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude
  var count = 50; // default
  var request_count = Number(request["num"]);
  console.log("num=" + Number(request["num"]));
  var tp = Number(request["tp"]);
  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }
  }// end if
  console.log("tp=" + tp);
  var query1 = "SELECT distinct TOP " + count + " " + keys + " FROM [MOE3].[dbo].[dublincore] AS A , [MOE3].[dbo].[GroupsPoint] AS B , [MOE3].[dbo].[CoiPoint] AS C "; // default: 50 data
  //var cond1 = "(C.[verification] = 1 OR C.[verification] = 10 OR C.[verification] =2 or true) AND A.[open] = 1"; // opened POI
  var cond1 = "A.[open] = 1"; // opened POI
  var cond2 = "(A.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")"; // between bounds
  var cond3 = "(A.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";// between bounds
  var cond4 = "A.[language]='" + request["clang"] + "'"; // default: Chinese
  var cond5 = "A.[POI_id] IN (SELECT [foreignKey] FROM moe3.dbo.mpeg WHERE format = " + request["tp"] + ")";
  var cond6 = "A.POI_id = B.point_id AND A.POI_id = C.point_id AND B.types='poi' AND B.foreignkey_id IN (SELECT [group_id] FROM moe3.dbo.RegionsGroup WHERE region_id = " + request["r_id"] + ")";
  var order1 = ""; // ordered by most description which means more valuable
  //if(request["tp"] !=null)
  //query1 += join1;
  query1 += " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
  tp = Number(request["tp"]);
  if (!isNaN(tp))
    query1 += " AND " + cond5;
  if (request["iclass"] != null) {
    query1 += " AND A.[identifier]='" + request["iclass"] + "'";// if search specific identifier class
  }
  if (request["fmt"] != null) {
    switch (request["fmt"]) {
      case "1":
        query1 += " AND A.[format] = '古蹟、歷史建築、聚落'";
        break;
      case "2":
        query1 += " AND A.[format] = '遺址'";
        break;
      case "3":
        query1 += " AND A.[format] = '人文景觀'";
        break;
      case "4":
        query1 += " AND A.[format] = '自然景觀'";
        break;
      case "5":
        query1 += " AND A.[format] = '傳統藝術'";
        break;
      case "6":
        query1 += " AND A.[format] = '民俗及有關文物'";
        break;
      case "7":
        query1 += " AND A.[format] = '古物'";
        break;
      case "8":
        query1 += " AND A.[format] = '食衣住行育樂'";
        break;
      case "9":
        query1 += " AND A.[format] = '其他'";
        break;
    }
  }
  query1 += " " + " AND " + cond6;
  query1 += " " + order1;

  console.log("query: " + query1);
  let POIs = await new db.Request().query(query1)
  console.log(POIs.length);
  if (POIs.length == 0) return POIs
  // print(POIs)
  let POIsWithMedias = await poi.queryMedias(POIs)
  // print(POIsWithMedias)
  // console.log(POIsWithMedias);
  return POIsWithMedias
  new db.Request().query(query1).then(function (recordset) { // send request
    if (recordset.length == 0) {
      callback(recordset);
    } else {
      // search media in POIs and callback
      //console.log('recordser:',recordset)
      searchMedia(recordset, function (jsonData) { callback(jsonData); });
    }// end else
  }).catch(function (err) {
    console.log("err" + err);
  });
}

// exports.getRegionNearbyPOIs = asyfunction(request) {
//   var r_id = request["r_id"]
//   var keys = "A.[POI_id] AS XOI_id, A.[POI_title] AS XOI_title, A.[latitude], A.[longitude]";
//   keys += ", (A.[POI_description_1]+''+ISNULL(A.[POI_description_2], '')) AS XOI_description";
//   keys += ", A.[POI_address], A.[orig_poi],A.[subject],A.[keyword1], A.[format], A.[rights], A.[open], A.[identifier], A.[language]";
//   // calculate distance by using great circle route and add it to key-value
//   //key  += ", B.[foreignKey],B.[]
//   keys += ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(latitude)) * cos(radians(longitude) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(latitude)))) AS distance";
//   var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"])};
//   var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude
//   var count = 50; // default
//   var request_count = Number(request["num"]);
//   console.log("num=" + Number(request["num"]));
//   var tp = Number(request["tp"]);
//   if (!isNaN(request_count)) {
//     if (request_count < 10) {
//       count = 10;
//     } else if (request_count < 100) {
//       count = request_count;
//     } else {
//       count = 100;
//     }
//   }// end if
//   console.log("tp="+tp);
//   var query1 = "SELECT distinct TOP " + count + " " + keys + " FROM [MOE3].[dbo].[dublincore] AS A , [MOE3].[dbo].[GroupsPoint] AS B , [MOE3].[dbo].[CoiPoint] AS C "; // default: 50 data
//   //var cond1 = "(C.[verification] = 1 OR C.[verification] = 10 OR C.[verification] =2 or true) AND A.[open] = 1"; // opened POI
//   var cond1 = "A.[open] = 1"; // opened POI
//   var cond2 = "(A.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")"; // between bounds
//   var cond3 = "(A.[longitude] between " + bounds[0]['longitude'] + "AND " + bounds[1]['longitude'] + ")";// between bounds
//   var cond4 = "A.[language]='" + request["clang"] + "'"; // default: Chinese
//   var cond5 = "A.[POI_id] IN (SELECT [foreignKey] FROM moe3.dbo.mpeg WHERE format = " + request["tp"] + ")";
//   var cond6 = "A.POI_id = B.point_id AND A.POI_id = C.point_id AND B.types='poi' AND B.foreignkey_id IN (SELECT [group_id] FROM moe3.dbo.RegionsGroup WHERE region_id = " + request["r_id"] + ")";
//   var order1 = ""; // ordered by most description which means more valuable
//   //if(request["tp"] !=null)
//     //query1 += join1;
//   query1 += " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4 ;
//   tp = Number(request["tp"]);
//   if (!isNaN(tp))
//     query1 += " AND " + cond5;
//   if (request["iclass"] != null) {
//     query1 += " AND A.[identifier]='" + request["iclass"] + "'";// if search specific identifier class
//   }
//   if (request["fmt"] != null){
//     switch(request["fmt"]){
//       case "1":
//         query1 += " AND A.[format] = '古蹟、歷史建築、聚落'";
//         break;
//       case "2":
//         query1 += " AND A.[format] = '遺址'";
//         break;
//       case "3":
//         query1 += " AND A.[format] = '人文景觀'";
//         break;
//       case "4":
//         query1 += " AND A.[format] = '自然景觀'";
//         break;
//       case "5":
//         query1 += " AND A.[format] = '傳統藝術'";
//         break;
//       case "6":
//         query1 += " AND A.[format] = '民俗及有關文物'";
//         break;
//       case "7":
//         query1 += " AND A.[format] = '古物'";
//         break;
//       case "8":
//         query1 += " AND A.[format] = '食衣住行育樂'";
//         break;
//       case "9":
//         query1 += " AND A.[format] = '其他'";
//         break;
//     }
//   }
//   query1 += " "  + " AND " + cond6;
//   query1 += " " + order1;

//   console.log("query: " + query1);
//   // let POIs = await new db.Request().query(query1)
//   // if(POIs.length == 0) return POIs
//   // print(POIs)
//   // let POIsWithMedias = await poi.queryMedias(POIs)
//   // print(POIsWithMedias)
//   new db.Request().query(query1).then(function(recordset) { // send request
//     if (recordset.length == 0) {
//       callback(recordset);
//     } else {
//       // search media in POIs and callback
//       //console.log('recordser:',recordset)
//       searchMedia(recordset, function(jsonData) { callback(jsonData); });
//     }// end else
//   }).catch(function(err) {
//     console.log("err" + err);
//   });
//   // return POIsWithMedias
// }

exports.getRegionNearbyPOIsV1 = async function (request) {
  // var g_id = request["g_id"]
  console.log(Number(request["coi_name"]));
  var keys = "A.[POI_id], A.[POI_title], A.[latitude], A.[longitude]";
  keys += ", (A.[POI_description_1]+''+ISNULL(A.[POI_description_2], '')) AS POI_description";
  keys += ", A.[POI_address], A.[orig_poi],A.[subject],A.[keyword1], A.[format], A.[rights], A.[open], A.[identifier], A.[language]";
  // calculate distance by using great circle route and add it to key-value
  //key  += ", B.[foreignKey],B.[]
  keys += ", ( 6371 * acos(cos(radians(" + request["lat"] + ")) * cos(radians(latitude)) * cos(radians(longitude) - radians(" + request["lng"] + ")) + sin(radians(" + request["lat"] + ")) * sin(radians(latitude)))) AS distance";
  console.log(Number(request["lat"]));
  var point = { latitude: Number(request["lat"]), longitude: Number(request["lng"]) };
  var bounds = geo.getBoundsOfDistance(point, Number(request["dis"])); // get maximum latitude/longitude and minimum latitude/longitude
  var count = 50; // default
  var request_count = Number(request["num"]);
  console.log("num=" + Number(request["num"]));
  var tp = Number(request["tp"]);
  if (!isNaN(request_count)) {
    if (request_count < 10) {
      count = 10;
    } else if (request_count < 100) {
      count = request_count;
    } else {
      count = 100;
    }
  }// end if
  console.log("tp=" + tp);
  var query1 = "SELECT distinct TOP " + count + " " + keys + " FROM [MOE3].[dbo].[dublincore] AS A , [MOE3].[dbo].[GroupsPoint] AS B , [MOE3].[dbo].[CoiPoint] AS C "; // default: 50 data
  //var cond1 = "(C.[verification] = 1 OR C.[verification] = 10 OR C.[verification] =2 or true) AND A.[open] = 1"; // opened POI
  var cond1 = "A.[open] = 1"; // opened POI
  var cond2 = "(A.[latitude] between " + bounds[0]['latitude'] + " AND " + bounds[1]['latitude'] + ")"; // between bounds
  var cond3 = "(A.[longitude] between " + bounds[0]['longitude'] + " AND " + bounds[1]['longitude'] + ")";// between bounds
  var cond4 = "A.[language]='" + request["clang"] + "'"; // default: Chinese
  var cond5 = "A.[POI_id] IN (SELECT [foreignKey] FROM moe3.dbo.mpeg WHERE format = " + request["tp"] + ")";
  var cond6 = "A.POI_id = B.point_id AND A.POI_id = C.point_id AND B.types='poi' AND B.foreignkey_id IN (SELECT [group_id] FROM [MOE3].[dbo].[RegionsGroup] WHERE region_id = " + request["r_id"] + ")";
  // var cond6 = "A.POI_id = B.point_id AND A.POI_id = C.point_id AND B.types='poi' AND B.foreignkey_id=" + g_id;
  var order1 = ""; // ordered by most description which means more valuable
  //if(request["tp"] !=null)
  //query1 += join1;
  query1 += " WHERE " + cond1 + " AND " + cond2 + " AND " + cond3 + " AND " + cond4;
  tp = Number(request["tp"]);
  if (!isNaN(tp))
    query1 += " AND " + cond5;
  if (request["iclass"] != null) {
    query1 += " AND A.[identifier]='" + request["iclass"] + "'";// if search specific identifier class
  }
  if (request["fmt"] != null) {
    switch (request["fmt"]) {
      case "1":
        query1 += " AND A.[format] = '古蹟、歷史建築、聚落'";
        break;
      case "2":
        query1 += " AND A.[format] = '遺址'";
        break;
      case "3":
        query1 += " AND A.[format] = '人文景觀'";
        break;
      case "4":
        query1 += " AND A.[format] = '自然景觀'";
        break;
      case "5":
        query1 += " AND A.[format] = '傳統藝術'";
        break;
      case "6":
        query1 += " AND A.[format] = '民俗及有關文物'";
        break;
      case "7":
        query1 += " AND A.[format] = '古物'";
        break;
      case "8":
        query1 += " AND A.[format] = '食衣住行育樂'";
        break;
      case "9":
        query1 += " AND A.[format] = '其他'";
        break;
    }
  }
  query1 += " " + " AND " + cond6;
  query1 += " " + order1;

  console.log("query: " + query1);
  try {
    let recordset = await new db.Request().query(query1)
    if (recordset.length == 0) {
      return recordset
    } else {
      let jsonData = await searchMedia(recordset)
      return jsonData
    }
  } catch (err) {
    console.log("err" + err);
  }
  /*
  new db.Request().query(query1).then(function (recordset) { // send request
    if (recordset.length == 0) {
      callback(recordset);
    } else {
      // search media in POIs and callback
      //console.log('recordser:',recordset)
      searchMedia(recordset, function (jsonData) { callback(jsonData); });
    }// end else
  }).catch(function (err) {
    console.log("err" + err);
  });*/
}

exports.addPoiLog = async function (req) {
  // console.log("call addPoiLog");
  var values = req["user_id"] + ", '" + req["ip"] + "', '" + moment().format('YYYY-MM-DD hh:mm:ss') + "', '" + req["page"] + "'";
  var query = "INSERT INTO [MOE3].[dbo].[Logs] (user_id,ip,dt,page) VALUES (" + values + ")";

  console.log("do query : " + query)
  try {
    await new db.Request().query(query)
    return "success"
  } catch (err) {
    console.log("err" + err);
  }
  // new db.Request().query(query).then(function () {
  //   callback("success");
  // }).catch(function (err) {
  //   console.log("err" + err);
  //   callback(null);
  // });
}

exports.addGroupLog = async function (req) {
  // console.log("call addPoiLog");
  var values = req["user_id"] + ", '" + req["ip"] + "', '" + moment().format('YYYY-MM-DD hh:mm:ss') + "', '" + req["page"] + "'";
  var query = "INSERT INTO [MOE3].[dbo].[Logs] (user_id,ip,dt,page) VALUES (" + values + ")";
  console.log("do query : " + query)
  try {
    let = await new db.Request().query(query)
    return "success"
  } catch (err) {
    console.log("err" + err);
    return null;
  }
  /*
  new db.Request().query(query).then(function () {
    callback("success");
  }).catch(function (err) {
    console.log("err" + err);
    callback(null);
  });*/
}
