const authentication = require('./app/controllers/auth') // authentication routes
const client = require('./app/controllers/client') // client routes
const voter = require('./app/controllers/voter') // voter routes

const getCSV = require('get-csv');
const routes = (app, sessionChecker) => {

  // route to check if the API is running
  app.get("/", function (req, res) {
    res.setHeader("Content-Type", "text/plain");
    res.end("ping-pong");
  });

  app.get('/upload-voters-csv', async (req, res) => {
    getCSV('app/data.csv')
    .then(rows => {
      console.log(rows)
      if(rows[0].Name === undefined){
        console.log('Invalid CSV')
      }
      // let info = 
      res.setHeader("Content-Type", "text/plain");
      res.end("Data:"+JSON.stringify(rows)+'<br><br>'+rows[1].Name);
    }).catch((error) => {
      res.setHeader("Content-Type", "text/plain");
      res.end("error:"+error);
    });
  })

  authentication.routes(app); // authentication routes
  client.routes(app, sessionChecker); // client routes
  voter.routes(app, sessionChecker); // voter routes
}

module.exports = {
  routes
};