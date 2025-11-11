let account = require('../models/accountModel');

exports.login = async function (req, res) {
    const { username, password, coiName } = req.body;
    const request = { username, password, coiName }


    const userData = await account.verifyPassword(request)
    let json = {};


    if (userData.length == 0) {
        json["results"] = { message: "Not found!" }
    } else {
        json["results"] = userData
    }
    res.json(json);
}