const jwt = require('jsonwebtoken');
const db = require('../database/connection');
const {
  trim,
  sendMessageToTelegram,
} = require('../utilities/utilities');

// sets headers and permissions for all requests.
const setHeaders = app => {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); // * to allow access to all servers
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Resquested-With, Content-Type, Accept, Authorization'
    );
  
    if(req.method === 'OPTIONS'){
      res.header('Access-Control-Allow-Methods', 'POST,GET'); // header to allow only PUT and GET requests
      return res.status(200).json({});
    }
    next();
  });
}

// middleware function to check for expired session
const sessionChecker = (req, res, next) => {
  const bearerHeader = req.headers['authorization'];

  if (bearerHeader) {
    const bearer = bearerHeader.split(' ');
    const bearerToken = bearer[1];

    jwt.verify(bearerToken, process.env.JWT_KEY, async function (error, data) {
      if(error){
        return res.status(401).json({
          status: 401,
          message: "authentication invalid"
        });
      }

      let uuid =  data.access_data.uuid;

      let validateUserQuery = "SELECT `id` FROM `users` WHERE `uuid` = ? ";
      let validateUser;
      try{
        [validateUser] = await db.execute(validateUserQuery, [ uuid ]);
      }catch(error){
        console.log('SQL-Error: '+error);
        sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+validateUserQuery);
        return res.status(500).json({
          status: 500,
          message: 'Could not connect to server'
        });
      }

      if(validateUser.length === 0){
        return res.status(401).json({
          status: 401,
          message: "authentication invalid"
        }); 
      }

      req.uuid = uuid;
      next();
    })
  }else{
    return res.status(401).json({
      status: 401,
      message: "authentication invalid"
    });
  }
  
  
};

module.exports = {
  setHeaders,
  sessionChecker
}