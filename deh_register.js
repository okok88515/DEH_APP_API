var db = require('mssql');
var md5 = require('js-md5');

var config = {
  user: 'sa',
  password: 'sfk98xRUzBG2G53x',
  server: '140.116.249.176'
}
console.log(config
    );
db.connect(config).then(function() {
  console.log('connected');

  for (i=10; i<=10; i++) {
    var user = String("NNDHU"+i);
    var pass = String(md5(user));
    var mail = user+"@gmail.com";
    var q = "insert into user_profile(user_name, password, nickname, gender, email, ishiddenemail, homepage, regtime, regip, role, birthday, user_address, education, career, income, interest, user_image) values('"+user+"', '"+pass+"', N'"+user+"',1,'"+mail+"',0,'','2016-07-13 11:21:57.840','140.116.82.143','user','1950-01-01','台北','大學','學生','10000',N'undefined','')";
    console.log(q);
    new db.Request().query(q).then(function(recordset) {
    }).catch(function(err) {
      console.log(err);
    });
  
  }
}).catch(function(err) {
  console.log(err);
});


