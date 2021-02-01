require('dotenv').config()
const http = require('http');
const app = require('./app');
const port = process.env.PORT || 7770;
const server = http.createServer(app);

server.listen(port);
console.log("WEB: analogteams API Service Stated. Running on PORT="+port);