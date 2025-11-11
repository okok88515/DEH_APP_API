var chai = require('chai');
var should = chai.should();
var supertest = require('supertest');

var server = supertest.agent("http://localhost:8080/api/v1/pois");

describe("pois status code", function() {
  it("should return 200", function(done) {
    server
    .get("/")
    .expect("Content-type", /json/)
    .expect(200)// status code
    .end(function(err, res) {
      res.status.should.equal(200);
      done();
    });
  });
});

describe("pois authorized", function() {
  it("should return 401", function() {
    server
    .get("?lat=22&lng=120&dis=2000.0")
    .expect(401)
    .end(function(err, res) {
      res.status.should.equal(401);
      done();
    });
  });
});
describe("GET /pois", function() {
  it("response with json", function(done) {
    server
    .get("/")
    .expect(200, done);
  });

  it("requests wrong parameters with negative integer", function(done) {
    server
    .get("?lat=-10&lng=-20&dis=-20&num=-5")
    .expect({message: "error: parameters required!"}, done);
  });

  it("requests wrong parameters with NaN lat/lng/dis", function(done) {
    server
    .get("/?lat=abc&lng=def&dis=ghi")
    .expect({message: "error: parameters required!"}, done);
  });
  
  it("miss parameters", function(done) {
    server
    .get("/?lat=120.87&lng=22.87")
    .expect({message: "error: parameters required!"}, done);
  });  
});
describe("GET /pois/search", function() {
  it("requests wrong parameters with negative integer", function(done) {
    server
    .get("/search?q=-100")
    .expect({ message: "error: parameters required!" }, done);
  });

  it("requests wrong parameters with NaN q", function(done) {
    server
    .get("/search?q=abc&lng=def")
    .expect({ message: "error: parameters required!" }, done);
  });

  it("miss parameters", function(done) {
    server
    .get("/search")
    .expect({ message: "error: parameters required!" }, done);
  });

});
