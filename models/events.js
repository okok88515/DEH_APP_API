var db = require('mssql');
var dbconfig = require('../utility/config').dbconfig;

// db connect
//...
db.connect(dbconfig).then(function() {
  console.log('events: connected to Micorsoft SQL server');
}).catch(function(err) {
  console.log(err);
});

exports.searchEvents = function(coi_name, callback){
	query = "SELECT [Event_name],[Event_id],[Event_leader_id] FROM [MOE3].[dbo].[Events] "
	cond1 = "WHERE [coi_name] = '" + coi_name +"'"

	query += cond1;
	console.log("Query :" +query);
	new db.Request().query(query).then(function(recordset){
	      if (recordset == "" || recordset == null || recordset === undefined){
	        return callback(false,null);
	      }

	      callback(true,recordset);
	  });
}

exports.getRoomList = function (event_id, callback) {

    console.log("call get room list")
    console.log("input event_id : " + event_id)

    var query2 = "SELECT [id],[room_name],[auto_start],[is_playing] FROM [MOE3].[dbo].[EventSetting]"
    var query1 = " WHERE [event_id_id] = " + event_id

    console.log("do query : " + query2 + query1);

    new db.Request().query(query2 + query1).then(function (recordset) {
        if (recordset.length == 0) {
            console.log("event has no room");
            callback(null);
        }
        else {
            console.log("event room list callback")
            callback(recordset);
        }
    }).catch(function (err) {
        console.log("err" + err);
        callback(null);
    });
}