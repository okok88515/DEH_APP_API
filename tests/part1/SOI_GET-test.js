var chai = require('chai');
var should = chai.should();
var supertest = require('supertest');

var server = supertest.agent("http://localhost:8080/api/v1/sois");

describe("sois status code", function() {
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

describe("sois authorized", function() {
  it("should return 401", function() {
    server
    .get("?lat=22.9972413790979&lng=120.221634036872")
    .expect(401) // Unauthorized
    .end(function(err, res) {
      res.status.should.equal(401);
      done();
    });
  });
});

describe("GET /sois", function() {
  it("response with json", function(done) {
    server
    .get("/")
    .expect("Content-type", /json/)
    .expect(200, done);
  });

  it("requests wrong parameters with NaN lat/lng", function(done) {
    server
    .get("?lat=abc&lng=def")
    .expect({ message: "error: parameters required!" }, done);
  });
  
  it("miss parameters", function(done) {
    server
    .get("/")
    .expect({ message: "error: parameters required!" }, done);
  });
});

describe("GET /sois/search", function() {
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
