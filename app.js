const bodyParser = require('body-parser');
const express = require('express');
const app = express();

const middleware = require('./app/middleware/middleware');
const apiRoutes = require('./routes');

// parsing the request body
app.use(bodyParser.urlencoded({ extended: true, limit: '100mb'}));
// json body
app.use(express.json());

middleware.setHeaders(app); // middleware to initialize headers
const sessionChecker = middleware.sessionChecker;

apiRoutes.routes(app, sessionChecker);

module.exports = app;