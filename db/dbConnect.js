var db = require('mssql');
var dbconfig = require('../utility/config').dbconfig;
// db.connect(dbconfig).then(function () {
//     console.log('connected to Micorsoft SQL server');
// }).catch(function (err) {
//     console.log(err);
// });

let poolPromise

const connectDB = async () => {
    try {
        if (!poolPromise) {
            poolPromise = db.connect(dbconfig);  // 創建並記錄連接池
            console.log('connected to Micorsoft SQL server');
        }
        return await poolPromise;
    } catch (err) {
        console.error('Database connection failed:', err);
        throw err;
    }
};

module.exports = {
    connectDB
};