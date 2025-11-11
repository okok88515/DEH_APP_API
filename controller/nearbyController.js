let POI = require('../models/POIs');
let LOI = require('../models/LOIs');
let AOI = require('../models/AOIs');
let SOI = require('../models/SOIs');

exports.nearbyPOIs = async function (req, res) {
    const { latitude, longitude, distance, number, format, coiName, language } = req.body;
    const request = { latitude, longitude, distance, number, format, coiName, language }

    let nearbyPOIs = await POI.queryXOIs(request, 'nearby')

    let json = {};
    json["results"] = nearbyPOIs
    res.json(json);
}
exports.nearbyLOIs = async function (req, res) {
    const { latitude, longitude, distance, number, format, coiName, language } = req.body;
    const request = { latitude, longitude, distance, number, format, coiName, language }

    let nearbyLOIs = await LOI.queryXOIs(request, 'nearby')

    let json = {};
    json["results"] = nearbyLOIs
    res.json(json);
}
exports.nearbyAOIs = async function (req, res) {
    const { latitude, longitude, distance, number, format, coiName, language } = req.body;
    const request = { latitude, longitude, distance, number, format, coiName, language }

    let nearbyAOIs = await AOI.queryXOIs(request, 'nearby')

    let json = {};
    json["results"] = nearbyAOIs
    res.json(json);
}
exports.nearbySOIs = async function (req, res) {
    const { latitude, longitude, distance, number, format, coiName, language } = req.body;
    const request = { latitude, longitude, distance, number, format, coiName, language }

    let nearbySOIs = await SOI.queryXOIs(request, 'nearby')

    let json = {};
    json["results"] = nearbySOIs
    res.json(json);
}