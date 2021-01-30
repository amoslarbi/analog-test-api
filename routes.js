const authentication = require('./app/controllers/auth') // authentication routes

const getCSV = require('get-csv');
const routes = (app, sessionChecker) => {

  // route to check if the API is running
  app.get("/", function (req, res) {
    res.setHeader("Content-Type", "text/plain");
    res.end("ping-pong");
  });

  authentication.routes(app); // authentication routes
}

module.exports = {
  routes
};