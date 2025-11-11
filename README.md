# DEH_APP_API_2024

A RESTful API build with Node.js and Express.js

All requset use post, non restful

交接時請在./git/config裡面更新為現在的維護人員

Pre-installed:

```bash
sudo npm install nodejs
sudo npm install express-generator
sudo apt-get -y install mongodb (Ubuntu)
brew install mongodb && mongod (MacOS X)
```

1. 舊有的不動 整理起來放檔案底部
2. route的格式統一 函數名稱也要統一 輸入輸出的名稱也要統一 看表 有覺得API名稱或是函數名稱不好的 跟我說
3. 必須使用async await 
4. 函數1的時候要取出所有要用的參數 擺到 requset裡面 然後request往下傳
```javaScript
const { lat, lng, dis, num, language } = req.body;
const request = { lat, lng, dis, num, language };
```
5. 在可能會error的地方要catch error 然後印出 不能什麼都不做 
6. response格式應為以下格式或等價於這個的語法
```javaScript
    json = {}
    json["results"] = response 
```

7. 如果要回傳訊息 必須也為這個格式
```javaScript
    json = {}
    json["results"] = {message}
```
```json
{
      "results": [
        {
            "message": "hello world"
        },
    ]
}
```
函數1跟函數2都必須放在適合的檔案

有舊有文件的話 原有的移動到底部


# API需求表 已變更 請參照現有實現更新

## Event 類別

| API位置                                | 函數名稱1              | 函數名稱2          | 輸入         | 輸出         |
|----------------------------------------|------------------------|--------------------|--------------|--------------|
| /events/chestMinus                     | decreaseChest          | \_decreaseChest     |              |              |
| /events/endGame                        | endGame                | \_endGame           |              |              |
| /events/getChestMedia                  | getChestMedia          | \_getChestMedia     |              |              |
| /events/getGameData                    | getGameData            | \_getGameData       |              |              |
| /events/getGameHistory                 | getGameHistory         | \_getGameHistory    |              |              |
| /events/getGameId                      | getGameID              | \_getGameID         |              |              |
| /events/getPrize                       | getPrize               | \_getPrize          |              |              |
| /events/getPrizeAttribute              | getPrizeAttribute      | \_getPrizeAttribute |              |              |
| /events/getPrizeDistributed            | getPrizeDistribution   | \_getPrizeDistribution |              |              |
| /events/getUserAnswerRecord            | getUserAnswerRecord    | \_getUserAnswerRecord |              |              |
| /events/insertAnswer                   | saveAnswer             | \_saveAnswer        |              |              |
| /events/startGame                      | startGame              | \_startGame         |              |              |
| /events/uploadMediaAnswer              | uploadMediaAnswer      | \_uploadMediaAnswer |              |              |
| /events/search_events            | getUserGroupList     | \_getUserGroupList |user_id、coi、coi_name    |groupList、eventList              |
| /events/get_room_list         | getGroupRoomList     | \_getGroupRoomList|group_id    | AnsRecordData  |

## Others 類別

| API位置                                | 函數名稱1              | 函數名稱2          | 輸入         | 輸出         |
|----------------------------------------|------------------------|--------------------|--------------|--------------|
| /others/poi_Count_Click                  | CountClick        | \_CountClick  | poi_id        |  count(查詢該POI的點擊次數)           |
| /others/poi_count_click_with_column_name  | CountClickWithColumnName        | \_CountClickWithColumnName  | poi_id        |  帶有poi_id的count           |
| /pois/upload                           | uploadPOI              | \_uploadPOI         |              |              |
| /add_poi_log                          | addPoiLog             | \_addPoiLog         |user_id、ip、page              |string:<br> 1.success<br> 2.空(查詢失敗時)              |
| /getGroupList                      | getUserGroupList            | \_getUserGroupList |user_id、coi、coi_name    | groupList、 eventList             |
| /groupGois                         | GroupPOIs            | \_GroupPOIs       | group_id             | POIdata            |
| /getRoomList                          | getGroupRoomList           | \_getGroupRoomList        | group_id             |AnsRecordData             |
| /getGameId                           | getGameID             | \_getGameID       |room_id              | GameID             |
| /getGameData                          | getGameData             | \_getGameData        |room_id              |GameData              |
| /getChestList                          | getGameChest             | \_getGameChest        |room_id、user_id              |  chestList            |
| /chestMinus                         | chestMinus          | \_chestMinus      |chest_id、user_id、game_id、lat、lng、user_answer              |Outcome             |
| /insertAnswer                          | insertAnswer             | \_insertAnswer        |user_id、answer、correctness、chest_id、game_id、lat、lng、point              |Outcome        |
| /startGame                          |startGame            | \_startGame        | room_id、user_id                |Outcome              |
| /endGame                         | endGame             | \_endGame       | room_id、user_id               | ListData             |
| /getChestMedia                          | getChestMedia              | \_getChestMedia        |chest_id              | AnsRecordData             |
| /getUserAnswerRecord                          | getAnsRecord              | \_getAnsRecord        |user_id、game_id、room_id              | AnsRecordData             |
| /uploadMediaAnswer                           | AnswerMedia            | \_AnswerMedia         |user_id、chest_id、txt、game_id、lat、lng、point               |Outcome              |
| /getMemberPoint                        | getMemberPoint          | \_getMemberPoint       |game_id              | ListData      |
| /getGameHistory                          | getGameHistory            | \_getGameHistory      |room_id              | ListData             |



## Account 類別

| API位置                                | 函數名稱1              | 函數名稱2          | 輸入         | 輸出         |
|----------------------------------------|------------------------|--------------------|--------------|--------------|
| /account/attachTempAccount             | linkTempAccount        | \_linkTempAccount   |              |              |
| /account/createTempAccount             | createTempAccount      | \_createTempAccount |              |              |
| /account/login                         | login                  | \_login             |              |              |

## Group 類別

| API位置                                | 函數名稱1              | 函數名稱2          | 輸入         | 輸出         |
|----------------------------------------|------------------------|--------------------|--------------|--------------|
| /groups/add                            | createGroup            | \_createGroup       |              |              |
| /groups/checkMembers                   | checkMembers           | \_checkMembers      |              |              |
| /groups/groupList                      | listGroups             | \_listGroups        |              |              |
| /groups/insertIntoGroup                | insertIntoGroup        | \_insertIntoGroup   |success、 mes、 group_id |成功訊息:...done truly!<br>失敗訊息:...error!              |
| /groups/listAllGroups                  | listGroup              | \_listGroup         |              |              |
| /groups/listRegion                     | listRegion             | \_listRegion        |              |              |
| /groups/memberJoin                     | memberJoinRequest      | \_memberJoinRequest |              |              |
| /groups/message                        | groupMessage           | \_groupMessage      |              |              |
| /groups/notification                   | sendGroupNotification  | \_sendGroupNotification |              |              |
| /groups/search                         | searchGroup            | \_searchGroup       |              |              |
| /groups/searchUserGroups               | searchUserGroups       | \_searchUserGroups  |              |              |
| /groups/update                         | updateGroup            | \_updateGroup       |              |              |

## NearbyXois 類別

| API位置                                | 函數名稱1              | 函數名稱2          | 輸入         | 輸出         |
|----------------------------------------|------------------------|--------------------|--------------|--------------|
| /nearbyXois/pois                           | nearbyPOIs             | \_nearbyPOIs        |              |              |
| /nearbyXois/lois                           | nearbyLOIs             | \_nearbyLOIs        |              |              |
| /nearbyXois/aois                           | nearbyAOIs             | \_nearbyAOIs        |              |              |
| /nearbyXois/sois                           | nearbySOIs             | \_nearbySOIs        |              |              |


## GroupsXois 類別

| API位置                                | 函數名稱1              | 函數名稱2          | 輸入         | 輸出         |
|----------------------------------------|------------------------|--------------------|--------------|--------------|
| /groupXois/pois                           | groupPOIs             | \_groupPOIs        |              |              |
| /groupXois/lois                           | groupLOIs             | \_groupLOIs        |              |              |
| /groupXois/aois                           | groupAOIs             | \_groupAOIs        |              |              |
| /groupXois/sois                           | groupSOIs             | \_groupSOIs        |              |              |

## UsersXois 類別

| API位置                                | 函數名稱1          | 函數名稱2          | 輸入         | 輸出         |
|----------------------------------------|--------------------|--------------------|--------------|--------------|
| /usersXois/pois                            | userPOIs           | \_userPOIs      |              |              |
| /usersXois/lois                            | userLOIs           | \_userLOIs      |              |              |
| /usersXois/aois                            | userAOIs           | \_userAOIs      |              |              |
| /usersXois/sois                            | userSOIs           | \_userSOIs      |              |              |

## RegionsXois 類別

| API位置                                | 函數名稱1          | 函數名稱2          | 輸入         | 輸出         |
|----------------------------------------|--------------------|--------------------|--------------|--------------|
| /regionsXois/pois                           | regionPOIs         | \_regionPOIs    |              |              |
| /regionsXois/lois                           | regionLOIs         | \_regionLOIs    |              |              |
| /regionsXois/aois                           | regionAOIs         | \_regionAOIs    |              |              |
| /regionsXois/sois                           | regionSOIs         | \_regionSOIs    |              |              |

## Users 類別

| API位置                                | 函數名稱1          | 函數名稱2          | 輸入         | 輸出         |
|----------------------------------------|--------------------|--------------------|--------------|--------------|
| /users/checkCOI                           | getCOIList         | \_getCOIList   | COIlist             |COIlist              |
| /users/login                         | login        | \_login    | username、password、coi_name             |成功:user(欄位)<br> 失敗:message: "Not found!"              |
| /users/loginJSON                         | login        | \_login    | username、password、coi_name             |成功:user(欄位)<br> 失敗:message: "Not found!"              |
| /users/xoilog                         | uploadUserLog        | \_uploadUserLog  |remoteAddress、useraccount、ula、ulo、action、devid              | 成功訊息:...log done truly!<br>失敗訊息:...log error!            |
| /users/xoilogJSON                         | uploadUserLogJSON        | \_uploadUserLogJSON  |remoteAddress、useraccount、ula、ulo、action、devid、user_id              | 成功訊息:...log done truly!<br>失敗訊息:...log error!            |
| /users/createtempaccount                         | createTempAccount       | \_createTempAccount  |success、mes、 user_name、user_id、 password            |成功訊息:...done truly!<br>失敗訊息:...error!             |
| /users/attachtempaccount                       | attachTempAccount       | \_attachTempAccount   | success, mes            |成功訊息:...done truly!<br>失敗訊息:...error!             |


## Account 類別

| API位置                                | 函數名稱1              | 函數名稱2          | 輸入         | 輸出         |
|----------------------------------------|------------------------|--------------------|--------------|--------------|
| /groups/allGroups                      | allGroups              | \_allGroups         |coiName, language |1.groupName、groupId、groupLeaderId<br>2.空|
| /groups/userGroups                     | userGroups             | \_userGroups         |1.userId, language, coiName|groupId、groupName、groupInfo、groupLeaderId、role<br>2.空              |
| /groups/invite                        | invite                 | \_invite             |senderId, receiverName, groupId、userName、userId、receiverId |1.Can't sent to yourself<br>2.No this user<br>3.Not leader<br>4.No this group<br>5.Already in Group<br>6.Already Invite<br>7.Success<br>8.null              |
| /groups/apply                       | apply                    | \_apply              |senderId, groupId、receiverId              |1.No this group<br>2.Already in Group<br>3.Already Invite<br>4.Success<br>5.null              |
| /groups/notice                        | notice                | \_notice             |userId              |1.messageCategory、messageId、senderId、groupId、groupName、senderName<br>2.空              |
| /groups/reply                        | reply                | \_reply            |messageId, reply, groupId, messageCategory              |1.update error<br>2.insert error<br>3.success              |
| /groups/invite                        | invite                 | \_invite             |              |              |
| /groups/invite                        | invite                 | \_invite             |              |              |
| /groups/invite                        | invite                 | \_invite             |              |              |

