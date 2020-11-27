const jwt = require('jsonwebtoken');

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

    console.dir(bearerToken);
    jwt.verify(bearerToken, process.env.JWT_KEY, function (error, data) {
      if(error){
        return res.status(401).json({
          status: 401,
          message: "authentication invalid"
        });
      }

      req.uuid = data.access_data.uuid;
      next();
    })
  }
  
  return res.status(401).json({
    status: 401,
    message: "authentication invalid"
  }); 
};

module.exports = {
  setHeaders,
  sessionChecker
}