const bodyParser = require('body-parser');
const express = require('express');
const app = express();

const middleware = require('./app/middleware/middleware');
const apiRoutes = require('./routes');

middleware.setHeaders(app); // middleware to initialize headers
middleware.initCookie(app); // middleware to initialize cookies
const sessionChecker = middleware.sessionChecker;

apiRoutes.routes(app, sessionChecker);

module.exports = app;