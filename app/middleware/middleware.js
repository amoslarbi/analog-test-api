const cookieParser = require('cookie-parser');
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

// initialize cookie-parser to allow us access the cookies stored in the requests.
const initCookie = app => {
  app.use(cookieParser());  
}


// middleware function to check for expired session
const sessionChecker = (req, res, next) => {
  const access_token = req.cookies.access_token;
  if(typeof access_token !== 'undefined'){
    jwt.verify(access_token, process.env.JWT_KEY, function (error, data) {
      if(error){
        return res.status(401).json({
          status: 401,
          message: "Invalid login credentials"
        });
      }

      req.token = data.access_data;
      next();
    })
  }else{
    return res.status(401).json({
      status: 401,
      message: "Invalid login credentials"
    });
  }  
};

module.exports = {
  setHeaders,
  initCookie,
  sessionChecker
}