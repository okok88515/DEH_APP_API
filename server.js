//  https://api.deh.csie.ncku.edu.tw/doc
var express = require('express');
var vhost = require('virtual-host')(express);
var fs = require('fs');
var https = require('https');
var httpolyglot = require('httpolyglot')
var app = express();
var auth = require('./controller/auth');
var bodyParser = require('body-parser');
var check_params = require('./services/paramsChecking');
var deh = require('./controller/deh');
var multer = require('multer');
var upload = multer({ dest: 'uploads/' });
var moment = require('moment');
//huzy for game
var game = require('./controller/game');
var game_event = require('./controller/game_event');
var events = require('./controller/eventsController');
var nearby = require('./controller/nearbyController');
var users = require('./controller/usersController');
var others = require('./controller/othersController');
var group = require('./controller/groupController');
var region = require('./controller/regionController');
var account = require('./controller/accountController');
//
var exchange = require('./controller/exchange');
// const { dbconfig } = require('./utility/config');
// const { addPoiLog } = require('./models/POI');
// const { getRandomValues } = require('crypto');
// const { config } = require('process');
// const { time } = require('console');
// const logReq = require('./models/Log');


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
// app.use(express.json());

var port = process.env.PORT || 8080;

var router = express.Router();
router.use(function (req, res, next) {
  setTimeout(async () => {
    await deh.autoLog(req)
  }, 5000)
  if (req.originalUrl == "/api/v1/others/clickPoiAndCount") {
    //跳過poi記數log 避免冗餘訊息
    next();
  }
  else {
    console.log("[" + moment().format('YYYY-MM-DD HH:mm:ss') + "]");
    console.log('responsing...');
    console.log("body is:")
    let body = { ...req.body }
    delete body.logParameters
    delete body.log_Parameters
    console.log(body)
    console.log("query is:")
    console.log(req.query)
    console.log("param is:")
    console.log(req.params)
    console.log(req.originalUrl);
    const oriJson = res.json
    const oriSend = res.send

    res.json = function (body) {
      //XOI_description太長了 隱藏起來
      try {
        let results = {
          results: body.results.map(item => {
            if (item && typeof item === 'object') { // 檢查 item 是否存在且為對象
              let newItem = { ...item }; // 使用展開運算符複製 item，避免直接修改原始資料
              if (newItem.xoiDescription) {
                newItem.xoiDescription = '[已隱藏]'; // 隱藏 XOI_description
              }
              return newItem;
            }
            return item; // 如果 item 為 null 或 undefined，直接返回它
          })
        };
        console.log('response:')
        console.dir(results, { depth: 2 });//, colors: null
      } catch (err) {
        console.dir(body, { depth: 2 })
        // console.log('response:', body)
      }

      // console.log('response:', results);
      oriJson.call(this, body);
    }
    res.send = function (body) {
      console.log('...done!')
      oriSend.call(this, body)
    }
    next();
  }



});

router.get('/', function (req, res) {
  res.json({ message: 'weber is the best' });
});



/***************************************************************************************************************/

router.route('/events/prize').post(events.prize);
router.route('/get_prize_attribut').post(exchange.getPrizeAttribute);
router.route('/get_prize_distribute').post(exchange.getPrizeDistributed);


router.route('/pois/uploa').post(upload.array('data'), deh.uploadPOI);
router.route('/users/createtempaccoun').post(deh.createTempAccount)
router.route('/users/attachtempaccoun').post(deh.attachTempAccount)
router.route('/groups/insertintogrou').post(deh.insertIntoGroup)
router.route('/group/userPOI').post(deh.getUserGroupPOIsV2); //功能不明
router.route('/group/userLOI').post(deh.getUserGroupLOIsV2);
router.route('/group/userAOI').post(deh.getUserGroupAOIsV2);
router.route('/group/userSOI').post(deh.getUserGroupSOIsV2);
router.route('/groups/ad').post(deh.createGroup);
router.route('/groups/a').post(group.createGroup);
//以上都還沒寫

router.route('/groups/allGroups').post(group.allGroups);
router.route('/groups/userGroups').post(group.userGroups);
router.route('/groups/invite').post(group.invite);
router.route('/groups/apply').post(group.apply);
router.route('/groups/notice').post(group.notice);
router.route('/groups/reply').post(group.reply);
router.route('/groups/members').post(group.members);
router.route('/groups/updateGroupDetail').post(group.updateGroupDetail);
// router.route('/groups/notificationInGroup').post(group.notificationInGroup);

router.route('/nearbyXois/pois').post(nearby.nearbyPOIs)
router.route('/nearbyXois/lois').post(nearby.nearbyLOIs)
router.route('/nearbyXois/aois').post(nearby.nearbyAOIs)
router.route('/nearbyXois/sois').post(nearby.nearbySOIs)
router.route('/groupXois/pois').post(group.groupPOIs)
router.route('/groupXois/lois').post(group.groupLOIs)
router.route('/groupXois/aois').post(group.groupAOIs)
router.route('/groupXois/sois').post(group.groupSOIs)
router.route('/userXois/pois').post(users.userPOIs);
router.route('/userXois/lois').post(users.userLOIs);
router.route('/userXois/aois').post(users.userAOIs);
router.route('/userXois/sois').post(users.userSOIs);
router.route('/regionXois/pois').post(region.regionPOIs);
router.route('/regionXois/lois').post(region.regionLOIs);
router.route('/regionXois/aois').post(region.regionAOIs);
router.route('/regionXois/sois').post(region.regionSOIs);
router.route('/regionXois/listRegion').post(region.listRegion);

router.route('/others/xoisFromSoi').post(others.xoisFromSoi);
router.route('/others/clickPoiAndCount').post(others.clickPoiAndCount);
router.route('/others/docentProfile').post(others.docentProfile)
router.route('/others/uploadPoi').post(upload.array('data'), others.uploadPoi);

router.route('/account/login').post(account.login)



router.route('/events/listEvents').post(events.listEvents);
router.route('/events/listSessions').post(events.listSessions);
router.route('/events/gameData').post(events.gameData);
router.route('/events/chestList').post(events.chestList);
router.route('/events/answerChest').post(events.answerChest);
router.route('/events/startGame').post(events.startGame);
router.route('/events/endGame').post(events.endGame);
router.route('/events/gameHistory').post(events.gameHistory);
router.route('/events/answerRecord').post(events.ansRecord)
router.route('/events/getMemberPoint').post(events.memberPointList); // 功能不明
router.route('/events/userPoint').post(events.userPoint);
router.route('/events/uploadMediaAnswer').post(upload.array('data'), events.uploadMediaAnswer);

/**************************************************************************************************************/
//hiwang for exchange
router.route('/get_prize').post(exchange.getPrize);
router.route('/get_prize_attribute').post(exchange.getPrizeAttribute);
router.route('/get_prize_distributed').post(exchange.getPrizeDistributed);

//準備移除的API
router.route('/start_game').post(game_event.startGame);
router.route('/get_game_data').post(game_event.getGameData);



/************************************************/

//huziyuan for game
router.route('/group_pois').post(game_event.GroupPOIs);
router.route('/get_group_list').post(game_event.getUserGroupList);
router.route('/get_game_id').post(game_event.getGameID);
router.route('/get_chest_list').post(game_event.getGameChest);
router.route('/chest_minus').post(game_event.chestMinus);
router.route('/insert_answer').post(game_event.insertAnswer);

router.route('/get_user_answer_record').post(game_event.getAnsRecord);
router.route('/get_chest_media').post(game_event.getChestMedia);
router.route('/get_room_list').post(game_event.getGroupRoomList);
router.route('/upload_media_answer').post(upload.array('data'), game_event.AnswerMedia);
router.route('/get_menber_point').post(game_event.getMemberPoint);
router.route('/get_game_history').post(game_event.getGameHistory);
router.route('/end_game').post(game_event.endGame);
//20191129
router.route('/poi_count_click').post(deh.CountClick);
router.route('/poi_count_click_with_column_name').post(deh.CountClickWithColumnName);
router.route('/add_poi_log').post(deh.addPoiLog);
//20210122
// ------
router.route('/events/search_events').post(game_event.getUserGroupList);//for test temp
router.route('/events/get_room_list').post(game_event.getGroupRoomList);

//test route
//router.route('/testGetGameChest').post(game_event.getGameChest2);

//Newer one, for private events in group and public events
//@20210308 by moebear
router.route('/getGroupList').post(game_event.getUserGroupList);
router.route('/groupGois').post(game_event.GroupPOIs);
router.route('/getRoomList').post(game_event.getGroupRoomList);
router.route('/getGameId').post(game_event.getGameID);
router.route('/getGameData').post(game_event.getGameData);
router.route('/getChestList').post(game_event.getGameChest);
router.route('/chestMinus').post(game_event.chestMinus);
router.route('/insertAnswer').post(game_event.insertAnswer);
router.route('/startGame').post(game_event.startGame);
router.route('/endGame').post(game_event.endGame);

router.route('/getChestMedia').post(game_event.getChestMedia);
router.route('/getUserAnswerRecord').post(game_event.getAnsRecord)
router.route('/uploadMediaAnswer').post(upload.array('data'), game_event.AnswerMedia);
router.route('/getMemberPoint').post(game_event.getMemberPoint);
router.route('/getGameHistory').post(game_event.getGameHistory);


// User part
router.route('/users/checkCOI')
  .get(deh.getCOIList)
router.route('/users/login')
  .post(deh.login);
router.route('/users/loginJSON')
  .post(deh.login);
router.route('/users/xoilog')
  .post(deh.uploadUserLog)
router.route('/users/xoilogJSON')
  .post(deh.uploadUserLogJSON)
router.route('/users/createtempaccount')
  .post(deh.createTempAccount)
router.route('/users/attachtempaccount')
  .post(deh.attachTempAccount)
router.route('/groups/insertintogroup')
  .post(deh.insertIntoGroup)
router.route('/users/pois')
  .post(/*check_params.loginValidate, check_params.isUserPOIs, auth.isAuthenticated,*/ deh.getUserPOIs);
router.route('/users/poisJSON')
  .post(/*check_params.loginValidate, check_params.isUserPOIs, auth.isAuthenticated,*/ deh.getUserPOIsJSON);
router.route('/users/poisJSONResponseNormalize')
  .post(deh.getUserPOIsJSONResponseNormalize);
router.route('/users/lois')
  .post(/*check_params.loginValidate, check_params.isUserLOIs, auth.isAuthenticated,*/ deh.getUserLOIs);
router.route('/users/loisJSON')
  .post(/*check_params.loginValidate, check_params.isUserPOIs, auth.isAuthenticated,*/ deh.getUserLOIsJSON);
router.route('/users/loisJSONResponseNormalize')
  .post(/*check_params.loginValidate, check_params.isUserPOIs, auth.isAuthenticated,*/ deh.getUserLOIsJSONResponseNormalize);
router.route('/users/aois')
  .post(/*check_params.loginValidate, check_params.isUserAOIs, auth.isAuthenticated,*/ deh.getUserAOIs);
router.route('/users/aoisJSON')
  .post(/*check_params.loginValidate, check_params.isUserPOIs, auth.isAuthenticated,*/ deh.getUserAOIsJSON);
router.route('/users/aoisJSONResponseNormalize')
  .post(/*check_params.loginValidate, check_params.isUserPOIs, auth.isAuthenticated,*/ deh.getUserAOIsJSONResponseNormalize);
router.route('/users/sois')
  .post(/*check_params.loginValidate, check_params.isUserSOIs, auth.isAuthenticated,*/ deh.getUserSOIs);
router.route('/users/soisJSON')
  .post(/*check_params.loginValidate, check_params.isUserPOIs, auth.isAuthenticated,*/ deh.getUserSOIsJSON);
router.route('/users/soisJSONResponseNormalize')
  .post(/*check_params.loginValidate, check_params.isUserPOIs, auth.isAuthenticated,*/ deh.getUserSOIsJSONResponseNormalize);
router.route('/docents/:username')
  .get(deh.getDocentInfo);

// POI part
router.route('/pois/search')
  .get(/*check_params.isSearchPOI, auth.isAuthenticated,*/ deh.searchPOI);

router.route('/pois/upload')
  .post(upload.array('data'), /*check_params.isUploadPOI,*/ deh.uploadPOI);

router.route('/:identifier_class?/pois/:clang?')
  .get(/*check_params.isNearbyPOIs, auth.isAuthenticated,*/  deh.nearbyPOIs);

//created by moebear for refactoring
router.route('/nearby/pois')
  .post(deh.searchNearbyPOIs)
router.route('/nearby/lois')
  .post(deh.searchNearbyLOIs)
router.route('/nearby/aois')
  .post(deh.searchNearbyAOIs)
router.route('/nearby/sois')
  .post(deh.searchNearbySOIs)


// LOI part
// UP: hangps (done), DOWN: liqr
router.route('/lois/search')
  .get(/*check_params.isSearchLOI, auth.isAuthenticated,*/ deh.searchLOI);

router.route('/:identifier_class?/lois/:clang?')
  .get(/*check_params.isNearbyLOIs, auth.isAuthenticated,*/  deh.nearbyLOIs);

// AOI part
router.route('/aois/search')
  .get(/*check_params.isSearchAOI, auth.isAuthenticated,*/ deh.searchAOI);
router.route('/:identifier_class?/aois/:clang?')
  .get(/*check_params.isNearbyAOIs, auth.isAuthenticated,*/  deh.nearbyAOIs);

// SOI part
router.route('/sois/search')
  .get(/*check_params.isSearchSOI, auth.isAuthenticated,*/ deh.searchSOI);

router.route('/:identifier_class?/sois/:clang?')
  .get(/*check_params.isNearbySOIs, auth.isAuthenticated,*/  deh.nearbySOIs);

// API Key granted or exchanged
router.route('/grant')
  .post(check_params.loginValidate, auth.grant);
// Group part
router.route('/groups/add')
  .post(deh.createGroup);
router.route('/groups/search')
  .post(deh.searchGroup);
router.route('/groups/notification')
  .post(deh.notificationGroup);
router.route('/groups/update')
  .post(deh.updateGroup);
router.route('/groups/message')
  .post(deh.groupMessage);
router.route('/groups/checkMembers')
  .post(deh.checkMembers);
router.route('/groups/memberJoin')
  .post(deh.memberJoinRequest);
router.route('/groups/groupList')
  .post(deh.listGroups);
router.route('/groups/addGroupLog')
  .post(deh.addGroupLog);

router.route('/users/group_pois')
  .post(deh.getUserGroupPOIs);
router.route('/users/group_lois')
  .post(deh.getUserGroupLOIs);
router.route('/users/group_sois')
  .post(deh.getUserGroupSOIs);
router.route('/users/group_aois')
  .post(deh.getUserGroupAOIs);


//COI Part

router.route('/:identifier_class?/group_pois/:clang?')
  .get(/*check_params.isNearbyPOIs, auth.isAuthenticated,*/  deh.groupNearbyPOIs);
router.route('/:identifier_class?/group_lois/:clang?')
  .get(/*check_params.isNearbyPOIs, auth.isAuthenticated,*/  deh.groupNearbyLOIs);
router.route('/:identifier_class?/group_aois/:clang?')
  .get(/*check_params.isNearbyPOIs, auth.isAuthenticated,*/  deh.groupNearbyAOIs);
router.route('/:identifier_class?/group_sois/:clang?')
  .get(/*check_params.isNearbyPOIs, auth.isAuthenticated,*/  deh.groupNearbySOIs);

router.route('/:identifier_class?/region_pois/:clang?')
  .get(/*check_params.isNearbyPOIs, auth.isAuthenticated,*/  deh.regionNearbyPOIsV1);
router.route('/:identifier_class?/region_lois/:clang?')
  .get(/*check_params.isNearbyPOIs, auth.isAuthenticated,*/  deh.regionNearbyLOIsV1);
router.route('/:identifier_class?/region_aois/:clang?')
  .get(/*check_params.isNearbyPOIs, auth.isAuthenticated,*/  deh.regionNearbyAOIsV1);
router.route('/:identifier_class?/region_sois/:clang?')
  .get(/*check_params.isNearbyPOIs, auth.isAuthenticated,*/  deh.regionNearbySOIsV1);

// New groupXoi search
router.route('/group/userPOIs')
  .post(deh.getUserGroupPOIsV2);
router.route('/group/userLOIs')
  .post(deh.getUserGroupLOIsV2);
router.route('/group/userAOIs')
  .post(deh.getUserGroupAOIsV2);
router.route('/group/userSOIs')
  .post(deh.getUserGroupSOIsV2);
//


// Group TabViewElement
router.route('/group/nearbyPOIs')
  .post(deh.groupNearbyPOIsV2);
router.route('/group/nearbyLOIs')
  .post(deh.groupNearbyLOIsV2);
router.route('/group/nearbyAOIs')
  .post(deh.groupNearbyAOIsV2);
router.route('/group/nearbySOIs')
  .post(deh.groupNearbySOIsV2);
router.route('/region/nearbyPOIs')
  .post(deh.regionNearbyPOIs);
router.route('/region/nearbyLOIs')
  .post(deh.regionNearbyLOIs);
router.route('/region/nearbyAOIs')
  .post(deh.regionNearbyAOIs);
router.route('/region/nearbySOIs')
  .post(deh.regionNearbySOIs);
router.route('/groups/searchUserGroups')
  .post(deh.searchGroupV2);
router.route('/groups/listAllGroups')
  .post(deh.listGroupV2);
router.route('/groups/listRegion')
  .post(deh.listRegion);




app.use('/api/v1', router);

const sslOptions = {
  key: fs.readFileSync("E:/new_DEH/cert/deh.csie.ncku.edu.tw-key.pem"),  // 你的私鑰
  cert: fs.readFileSync("E:/new_DEH/cert/deh.csie.ncku.edu.tw-crt.pem"), // 你的憑證
  ca: fs.readFileSync("E:/new_DEH/cert/deh.csie.ncku.edu.tw-chain.pem"), //lets encrypt 的中間證書 
};
// 設置 HTTPS 伺服器
// const httpsServer = https.createServer(sslOptions, app);
// httpsServer.listen(8080, () => {
//   console.log(`HTTPS Server running on port ${8080}`);
// });
const biServer = httpolyglot.createServer(sslOptions, app)
biServer.listen(port)
console.log(`HTTPS Server running on port ${port}`);
// app.listen(port);
// app.listen(8079);
// console.log('listening port' + port);
