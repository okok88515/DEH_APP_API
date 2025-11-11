let POI = require('../models/POIs');
let LOI = require('../models/LOIs');
let AOI = require('../models/AOIs');
let SOI = require('../models/SOIs');


exports.userPOIs = async function (req, res) {
    if (req.body.username == "") {
        res.json({ "message": "not login" })
        return
    }
    const { username, latitude, longitude, number, coiName, distance, language } = req.body;
    const request = { username, latitude, longitude, number, coiName, distance, language }
    let POIs = await POI.queryXOIs(request, 'user')
    let json = {};
    json["results"] = POIs
    res.json(json);
}
exports.userLOIs = async function (req, res) {
    if (req.body.username == "") {
        res.json({ "message": "not login" })
        return
    }
    const { username, latitude, longitude, number, coiName, distance, language } = req.body;
    const request = { username, latitude, longitude, number, coiName, distance, language }
    let LOIs = await LOI.queryXOIs(request, 'user')
    let json = {};
    json["results"] = LOIs
    res.json(json);
}
exports.userAOIs = async function (req, res) {
    if (req.body.username == "") {
        res.json({ "message": "not login" })
        return
    }
    const { username, latitude, longitude, number, coiName, distance, language } = req.body;
    const request = { username, latitude, longitude, number, coiName, distance, language }


    let AOIs = await AOI.queryXOIs(request, 'user')
    let json = {};
    json["results"] = AOIs
    res.json(json);

}
exports.userSOIs = async function (req, res) {
    if (req.body.username == "") {
        res.json({ "message": "not login" })
        return
    }
    const { username, latitude, longitude, number, coiName, distance, language } = req.body;
    const request = { username, latitude, longitude, number, coiName, distance, language }
    let SOIs = await SOI.queryXOIs(request, 'user')
    let json = {};
    json["results"] = SOIs
    res.json(json);
}
