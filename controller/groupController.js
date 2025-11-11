const POI = require('../models/POIs');
const LOI = require('../models/LOIs');
const AOI = require('../models/AOIs');
const SOI = require('../models/SOIs');
const group = require('../models/GroupModel')

exports.groupPOIs = async function (req, res) {
    const { latitude, longitude, distance, number, format, coiName, language, groupId } = req.body;
    const request = { latitude, longitude, distance, number, format, coiName, language, groupId }

    let XOIs = await POI.queryXOIs(request, 'group')

    let json = {};
    json["results"] = XOIs
    res.json(json);
}
exports.groupLOIs = async function (req, res) {
    const { latitude, longitude, distance, number, format, coiName, language, groupId } = req.body;
    const request = { latitude, longitude, distance, number, format, coiName, language, groupId }

    let XOIs = await LOI.queryXOIs(request, 'group')

    let json = {};
    json["results"] = XOIs
    res.json(json);
}
exports.groupAOIs = async function (req, res) {
    const { latitude, longitude, distance, number, format, coiName, language, groupId } = req.body;
    const request = { latitude, longitude, distance, number, format, coiName, language, groupId }

    let XOIs = await AOI.queryXOIs(request, 'group')

    let json = {};
    json["results"] = XOIs
    res.json(json);
}
exports.groupSOIs = async function (req, res) {
    const { latitude, longitude, distance, number, format, coiName, language, groupId } = req.body;
    const request = { latitude, longitude, distance, number, format, coiName, language, groupId }

    let XOIs = await SOI.queryXOIs(request, 'group')

    let json = {};
    json["results"] = XOIs
    res.json(json);
}
exports.allGroups = async function (req, res) {
    const { coiName, language } = req.body;
    const request = { coiName, language }
    let userGroups = await group.allGroups(request)
    var json = {};
    json["results"] = userGroups;
    res.json(json);
}
exports.invite = async function (req, res) {
    const { senderId, receiverName, groupId } = req.body;
    const request = { senderId, receiverName, groupId }
    const message = await group.invite(request)
    var json = {};
    json["results"] = { message };
    res.json(json);
}
exports.apply = async function (req, res) {
    const { senderId, groupId } = req.body;
    const request = { senderId, groupId }
    const message = await group.apply(request)
    var json = {};
    json["results"] = { message };
    res.json(json);
}
exports.notice = async function (req, res) {
    const { userId } = req.body;
    const request = { userId }
    const notices = await group.notice(request)
    var json = {};
    json["results"] = notices;
    res.json(json);
}
exports.reply = async function (req, res) {
    const { messageId, reply, groupId, messageCategory } = req.body;
    const request = { messageId, reply, groupId, messageCategory }
    const message = await group.reply(request)
    var json = {};
    json["results"] = { message };
    res.json(json);
}
exports.userGroups = async function (req, res) {
    const { userId, language, coiName } = req.body;
    const request = { userId, language, coiName }
    let recordset = await group.userGroups(request)
    var json = {};
    json['results'] = recordset
    res.json(json);
}
exports.members = async function (req, res) {
    const { groupId } = req.body;
    const request = { groupId }
    let recordset = await group.members(request)
    var json = {};
    json['results'] = recordset
    res.json(json);
}
exports.updateGroupDetail = async function (req, res) {
    const { groupId, groupName, groupInfo, userId } = req.body;
    const request = { groupId, groupName, groupInfo, userId }
    let message = await group.updateGroupDetail(request)
    var json = {};
    json["results"] = { message };
    res.json(json);
}

exports.createGroup = async function (req, res) {
    const { groupName, groupInfo, userId, language, } = req.body;
    const request = { groupName, groupInfo, userId, language, }

    let message = await group.createGroup(request)
    var json = {};
    json["results"] = { message };
    res.json(json);
}

