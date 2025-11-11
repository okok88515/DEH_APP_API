var check_types = require('check-types');
var langTable = require('../utility/clang_table');
var classTable = require('../utility/class_table');
var util = require('util');
var mime = require('mime');
var fs = require('fs');

exports.isSearchPOI = function(req, res, next) {
  if (isEssentialPositiveNumber(req.query.q)) {
    next();
  } else {
    console.log('error: parameters required!');
    res.json({ message: 'error: parameters required!' });
  }
}

exports.isUploadPOI = function(req, res, next) {
  if (metadataChecking(req.body["content"]) && ((req.files.length == 0) || (uploadFileChecking(req.body["content"], req.files))) ) {
    next();
  } else {
    for (i = 0; i < req.files.length; i++) {
      fs.unlink(req.files[i]["path"]);
      console.log("delete " + req.files[i]["path"]);
    }
    console.log('error: parameters required!');
    res.json({ message: 'error: parameters required!' });
  }
}

exports.isNearbyPOIs = function(req, res, next) {
  if (isEssentialNumber(req.query.lat) &&
      isEssentialNumber(req.query.lng) &&
      isEssentialPositiveNumber(req.query.dis) &&
      filterChecking(req.params.clang, req.params.identifier_class)) {
    next();
  } else {
    console.log('error: parameters required!');
    res.json({ message: 'error: parameters required!' });
  }
}

exports.isUserPOIs = function(req, res, next) {
  if (isEssentialNumber(req.query.lat) &&
      isEssentialNumber(req.query.lng)) {
    next();
  } else {
    console.log('error: parameters required!');
    res.json({ message: 'error: parameters required!' });
  }
}

exports.isSearchLOI = function(req, res, next) {
  if (isEssentialPositiveNumber(req.query.q)) {
    next();
  } else {
    console.log('error: parameters required!');
    res.json({ message: 'error: parameters required!' });
  }
}

exports.isNearbyLOIs = function(req, res, next) {
  if (isEssentialNumber(req.query.lat) &&
      isEssentialNumber(req.query.lng) &&
      filterChecking(req.params.clang, req.params.identifier_class)) {
    next();
  } else {
    console.log('error: parameters required!');
    res.json({ message: 'error: parameters required!' });
  }
}

exports.isUserLOIs = function(req, res, next) {
  if (isEssentialNumber(req.query.lat) &&
      isEssentialNumber(req.query.lng) &&
      filterChecking(req.params.clang, req.params.identifier_class)) {
    next();
  } else {
    console.log('error: parameters required!');
    res.json({ message: 'error: parameters required!' });
  }
}

exports.isSearchAOI = function(req, res, next) {
  if (isEssentialPositiveNumber(req.query.q)) {
    next();
  } else {
    console.log('error: parameters required!');
    res.json({ message: 'error: parameters required!' });
  }
}

exports.isNearbyAOIs = function(req, res, next) {
  if (isEssentialNumber(req.query.lat) &&
      isEssentialNumber(req.query.lng) &&
      filterChecking(req.params.clang, req.params.identifier_class)) {
    next();
  } else {
    console.log('error: parameters required!');
    res.json({ message: 'error: parameters required!' });
  }
}

exports.isUserAOIs = function(req, res, next) {
  if (isEssentialNumber(req.query.lat) &&
      isEssentialNumber(req.query.lng) &&
      filterChecking(req.params.clang, req.params.identifier_class)) {
    next();
  } else {
    console.log('error: parameters required!');
    res.json({ message: 'error: parameters required!' });
  }
}

exports.isSearchSOI = function(req, res, next) {
  if (isEssentialPositiveNumber(req.query.q)) {
    next();
  } else {
    console.log('error: parameters required!');
    res.json({ message: 'error: parameters required!' });
  }
}
exports.isNearbySOIs = function(req, res, next) {
  if (isEssentialNumber(req.query.lat) &&
      isEssentialNumber(req.query.lng) &&
      filterChecking(req.params.clang, req.params.identifier_class)) {
    next();
  } else {
    console.log('error: parameters required!');
    res.json({ message: 'error: parameters required!' });
  }
}

exports.isUserSOIs = function(req, res, next) {
  if (isEssentialNumber(req.query.lat) &&
      isEssentialNumber(req.query.lng) &&
      filterChecking(req.params.clang, req.params.identifier_class)) {
    next();
  } else {
    console.log('error: parameters required!');
    res.json({ message: 'error: parameters required!' });
  }
}

exports.loginValidate = function(req, res, next) {
  console.log("login check");
  var username = req.body.username;
  var password = req.body.password;
  var coiname  = req.body.coi_name;
  console.log(username, password, coiname);
  if (username != undefined && password != undefined) {
    next();
  } else {
    console.log('error: parameters required!');
    res.json({ message: 'error: parameters required!' });
  }
}

function metadataChecking(content) {
  console.log("metadata checking...");
  try {
    var json = JSON.parse(content);
    var re = /^[\w\s]/gi;
    var sq = /[']/gi;
    if (re.test(content)) throw "escape characters exists!";
    if (sq.test(content)) throw "singole quote is forbiddened!";
    return true;
  } catch(e) {
    var err = { error: util.inspect(e) };
    console.log(err);
    return false;
  }
}

function uploadFileChecking(metadata, files) {
  console.log("uploadFileChecking...");
  try {
    var content = JSON.parse(metadata);
    console.log(content);
    var media_type = content["media_set"][0]["media_type"];
    var maxImageSize = 5*1024*1024;// 5MB
    var maxAudioSize = 20*1024*1024;// 20MB
    var maxVideoSize = 40*1024*1024;// 40 MB
    var maxFileUpload = 6;

    if (files.length > maxFileUpload) throw "maximum upload file number limited!";
    for (i=0; i<files.length; i++) {
      // check extension and get prefix. ex: fetch 'video' from 'video/mp4'
      var type = mime.lookup(files[i]["originalname"]).split("/")[0];
      if (type != content["media_set"][i]["media_type"]) throw "metadata and files unmatched!";
      switch (type) {
        case "image":
          if (files[i]["size"] > maxImageSize) throw "maximum upload file number limited!";
          break;
        case "audio":
          if (files[i]["size"] > maxAudioSize) throw "maximum upload file number limited!";
          break;
        case "video":
          if (files[i]["size"] > maxVideoSize || i > 0) throw "maximum upload file number limited!";
          break;
        default:
          throw "unsupported file format";
          break
      }
    }
    return true;
  } catch(e) {
    var err = { error: e };
    console.log(err);
    return false;
  }
}

function filterChecking(clang, identifier) {
  // params checking
  // if language is not null and doesn't exist in table
  if (langTable.tableExists(clang) === undefined) {
    console.log("clang not defined");
    return false;
  }
   // if identifier class is not null and doesn't exist in table
  if (classTable.tableExists(identifier) === undefined) {
    console.log("identifier class not defined");
    return false;
  }
  return true;

}

function isEssentialNumber(number) {
  var num = Number(number);
  if (num == "" || num == null || check_types.not.number(num)) {
    return false;
  } else {
    return true;
  }
}
function isEssentialPositiveNumber(number) {
  var num = Number(number);
  // num is null or not a valid number
  if (num == "" || num == null || check_types.not.number(num) || check_types.negative(num)) {
    return false;
  } else {
    return true;
  }
}

function isOptionalPositiveNumber(number) {
  var num = Number(number);
  // num is not a positive number(may be null)
  if (!isNaN(num) && (check_types.not.integer(num) || check_types.not.positive(num))) {
    return false;
  }
  return true;
}
