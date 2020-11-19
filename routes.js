const authentication = require('./app/controllers/auth') // authentication routes
const client = require('./app/controllers/client') // client routes
const voter = require('./app/controllers/voter') // voter routes

const routes = (app, sessionChecker) => {

  // route to check if the API is running
  app.get("/", function (req, res) {
    res.setHeader("Content-Type", "text/plain");
    res.end("ping-pong");
  });

  authentication.routes(app); // authentication routes
  client.routes(app, sessionChecker); // client routes
  voter.routes(app, sessionChecker); // voter routes
}

module.exports = {
  routes
};