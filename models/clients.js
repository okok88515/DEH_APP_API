// client.schema is created for client app registered on deh api
var mongoose = require('mongoose');

// Define our client schema
var ClientScchema = new mongoose.Schema({
  name: { type: String, unique: true, require: true },
  id: { type: String, require: true },
  secret: { type: String, require: true },
  userId: { type: String, rrquire: true }
});

module.exports = mongoose.model('Client', ClientSchema);
