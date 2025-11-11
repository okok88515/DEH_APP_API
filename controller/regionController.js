let POI = require('../models/POIs');
let LOI = require('../models/LOIs');
let AOI = require('../models/AOIs');
let SOI = require('../models/SOIs');
let REGION = require('../models/regions');

exports.regionPOIs = async function (req, res) {
    const { latitude, longitude, distance, number, format, coiName, language, regionId } = req.body;
    const request = { latitude, longitude, distance, number, format, coiName, language, regionId }

    const XOIs = await POI.queryXOIs(request, 'region')
    let json = {};
    json["results"] = XOIs
    res.json(json);
}
exports.regionLOIs = async function (req, res) {
    const { latitude, longitude, distance, number, format, coiName, language, regionId } = req.body;
    const request = { latitude, longitude, distance, number, format, coiName, language, regionId }

    const XOIs = await LOI.queryXOIs(request, 'region')
    let json = {};
    json["results"] = XOIs
    res.json(json);
}
exports.regionAOIs = async function (req, res) {
    const { latitude, longitude, distance, number, format, coiName, language, regionId } = req.body;
    const request = { latitude, longitude, distance, number, format, coiName, language, regionId }

    const XOIs = await AOI.queryXOIs(request, 'region')
    let json = {};
    json["results"] = XOIs
    res.json(json);
}
exports.regionSOIs = async function (req, res) {
    const { latitude, longitude, distance, number, format, coiName, language, regionId } = req.body;
    const request = { latitude, longitude, distance, number, format, coiName, language, regionId }

    const XOIs = await SOI.queryXOIs(request, 'region')
    let json = {};
    json["results"] = XOIs
    res.json(json);
}
exports.listRegion = async function (req, res) {
    const { coiName, language } = req.body;
    const request = { coiName, language }

    let regions = await REGION.listRegion(request)
    let json = {};
    json["results"] = regions
    res.json(json);
}