var chai = require('chai');
var should = chai.should();
var supertest = require('supertest');


var server = supertest.agent("http://localhost:8080/api/v1/aois");

describe("aois status code", function() {
  it("should return 200", function(done) {
    server
    .get("/")
    .expect("Content-type", /json/)
    .expect(200)
    .end(function(err, res) {
      res.status.should.equal(200);
      done();
    });
  });
});

describe("aoi authorized", function() {
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
