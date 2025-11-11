var request = require('request');

// search postcode with google api
// postcode default in json["results"][0]["address_components"][components.size()]["long_name]
// if not found, return null
var options = {
  // sample and would be modified
  url: "https://maps.googleapis.com/maps/api/geocode/json?latlng=ooo,xxx"
}

exports.searchPostcode = function(lat, lng, callback) {
  var _base = "https://maps.googleapis.com/maps/api/geocode/json";
  options.url = _base + "?latlng="+lat+","+lng+"&language=en";
  request(options.url, function(err, res, body) {
    if (!err && res.statusCode == 200) {
      callback(parsePostcode(JSON.parse(body)));
    } else {
      console.log("HTTP request failed");
      callback(null);
    }
  });
}

function parsePostcode(json) {
  console.log(json);
  if (json.results.length == 0) { return null; }
  var length = json.results[0].address_components.length;
  var components = json.results[0].address_components;
  var type = components[length-1].types[0];
  var type2 = components[length-2].short_name;
  // if location is in TW then return postcode 
  if (type == "postal_code"&&type2 =="TW"){
      var postcode = components[length-1].long_name;
      console.log("postcode = "+postcode);
      return "TW"+postcode; 
    } 
  // if location is in other country then return country name
  else if (type == "postal_code"&&type2 !="TW") {
    var country = components[length-2].long_name;
    console.log("country = "+country);
    return country;
    }
  else if (type == "country"){
    var country = components[length-1].long_name;
    return country;
    }
  else{
    console.log("geocoding can't found!");
    return null;
  }

}
