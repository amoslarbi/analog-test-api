const db = require('../database/connection');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4, v5: uuidv5 } = require('uuid');
const {
  trim,
  validateEmail,
  validatePassword,
  checkPassword,
  hashPassword,
  sendMessageToTelegram,
  sendRegistrationEmail,
  sendMovies,
} = require('../utilities/utilities');
const Constants = require('../misc/api-constants');
const axios = require('axios')

const PREFIX = "/auth";

const routes = (app) => {

  // Login and Generate JWT token
  app.post(PREFIX+'/login', async (req, res) => {

    let email = req.body.email;
    let password = req.body.password;

    console.log(email);

    if(email.length === 0){
      return res.status(400).json({
        status: 400,
        message: "Enter email"
      });
    }else if(!validateEmail(email)){
      return res.status(400).json({
        status: 400,
        message: "Enter email"
      });
    }

    if(password.length === 0){
      return res.status(400).json({
        status: 400,
        message: "Enter password"
      });
    }

    let loginQuery = "SELECT * FROM `users` WHERE `email` = ? AND `email_verification_status` = ?";
    let checkLoginQuery;
    try{
      [checkLoginQuery] = await db.execute(loginQuery, [ email, 1 ]);
    }catch(error){
      console.log('SQL-Error: '+error);
      sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+loginQuery);
      return res.status(500).json({
        status: 500,
        message: 'Could not connect to server'
      });
    }

    if (checkLoginQuery.length === 0) {
        return res.status(400).json({
          status: 400,
          message: 'Invalid login credentials'
        });
    }

    let passwordFromDb = checkLoginQuery[0].password;
    if(!checkPassword(password, passwordFromDb)){
      return res.status(400).json({
        status: 400,
        message: 'Invalid login credentials'
      });
    }

    //jwt start
    let uuid = checkLoginQuery[0].uuid;
    let fullname = checkLoginQuery[0].fullname;
    let emaill = checkLoginQuery[0].email;
    let email_verification_status = checkLoginQuery[0].email_verification_status;
    const access_data = {
      uuid: uuid
    }

    const jwt_access_token = jwt.sign({access_data}, process.env.JWT_KEY, { expiresIn: '30d' })

    let receiver = [];
    receiver.push(fullname);
    receiver.push(emaill);

    return res.status(200).json({
      status: 200,
      data: receiver,
      access_token: jwt_access_token
    })

  });

  // verify email token start
  app.post(PREFIX+'/confirmEmail', async function(req, res) {

    let token = trim(req.body.code);

    let checkTokenQuery = "SELECT `id`, `fullname`, `email` FROM users WHERE `email_verification_code` = ? AND `email_verification_status` = 0";
    let checkToken;
    try{
      [checkToken] = await db.execute(checkTokenQuery, [ token ]);
    }catch(error){
      console.log('SQL-Error: '+error);
      return res.status(500).json({
        status: 500,
        message: 'Could not connect to server'
      });
    }

    if (checkToken.length === 0) {
      return res.status(400).json({
        status: 400,
        message: "Account verification link is invalid or has been already"
      });
    }

    let fullName = checkToken[0].fullname;
    let email = checkToken[0].email;
    let action_url = Constants.CLIENT_APP_URL;

    let changeTokenStatusQuery = "UPDATE users SET `email_verification_status` = 1 WHERE `email_verification_code` = ?";
    let changeTokenStatus;
    try{
      [changeTokenStatus] = await db.execute(changeTokenStatusQuery, [ token ]);
    }catch(error){
      console.log('SQL-Error: '+error);
      return res.status(500).json({
        status: 500,
        message: 'Could not connect to server'
      });
    }

    // sendWelcomeEmail(email, fullName, action_url);

    return res.status(200).json({
      status: 200,
      message: "Account verification successful"
    });

  });
  // verify email token end

  // resend code start
  app.post(PREFIX+'/resend-code', async function(req, res) {

    let fullName = trim(req.body.fullName);
    let email = trim(req.body.email);
    let hash = Math.floor(Math.random()*90000) + 10000;

    sendRegistrationEmail(email, fullName, hash);
    return res.status(200).json({
      status: 200,
      message: "worked"
    });

  });
  // resend code end

  // the movie db request start
  app.get(PREFIX+'/the-movie-db-request', async function(req, res) {

    let getAllEmailsQuery = "SELECT `email` FROM users";
    let getAllEmails;
    try{
      [getAllEmails] = await db.execute(getAllEmailsQuery);
    }catch(error){
      console.log('SQL-Error: '+error);
      return {
        status: 500,
        message: 'Could not connect to server'
      };
    }

      for(let i = 0; i < getAllEmails.length; i++){
        console.log(getAllEmails[i].email);

        const TMDB_API_BASE_URL = "https://api.themoviedb.org/3/movie";
        const TMDB_RANDOM = Math.floor(Math.random() * 6) + 1;
        const TMDB_API_KEY = "77ca42839ed6c6456a94889d026c6d1a";

        const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

        axios.get(TMDB_API_BASE_URL + "/" + TMDB_RANDOM + "?api_key=" + TMDB_API_KEY)
        .then((response) => {

          console.log(response.data.title);
          let image = TMDB_IMAGE_BASE_URL + response.data.poster_path;
          let title = response.data.title;
          let vote_average = response.data.vote_average + "/10 IMDB";
          let overview = response.data.overview;

          sendMovies(getAllEmails[i].email, image, title, vote_average, overview);

        }).catch((error) => {

        });

      }

    // const TMDB_API_BASE_URL = "https://api.themoviedb.org/3/movie";
    // const TMDB_RANDOM = Math.floor(Math.random() * 6) + 1;
    // const TMDB_API_KEY = "77ca42839ed6c6456a94889d026c6d1a";

    // const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

    // axios.get(TMDB_API_BASE_URL + "/" + TMDB_RANDOM + "?api_key=" + TMDB_API_KEY)
    // .then((response) => {

    //   console.log(response.data.title);
    //   let image = TMDB_IMAGE_BASE_URL + response.data.poster_path;
    //   let title = response.data.title;
    //   let vote_average = response.data.vote_average + "/10 IMDB";
    //   let overview = response.data.overview;

    //   sendMovies("larbiamos18@gmail.com", image, title, vote_average, overview);

    // }).catch((error) => {

    // });

  });
  // the movie db request end

  // unsubscribe start
  app.post(PREFIX+'/unsubscribe', async function(req, res) {

    let email = trim(req.body.email);
    console.log(email);

    let getUserDetailsQuery = "DELETE FROM users WHERE `email` = ?";
    let getUserDetails;
    try{
      [getUserDetails] = await db.execute(getUserDetailsQuery, [ email ]);
    }catch(error){
      console.log('SQL-Error: '+error);
      return res.status(500).json({
        status: 500,
        message: 'Could not connect to server'
      });
    }

    if (getUserDetails.length === 0) {
      return res.status(400).json({
        status: 400,
        message: "Failed to get user details"
      });
    }

    return res.status(200).json({
      status: 200,
      message: "worked",
    });

  });
  // unsubscribe end

  // login start
  app.post(PREFIX+'/login', async function(req, res) {

    let email = trim(req.body.email);
    let password = trim(req.body.password);
    console.log(email);

    if(email.length === 0){
      return res.status(400).json({
        status: 400,
        message: "Enter email"
      });
    }else if(!validateEmail(email)){
      return res.status(400).json({
        status: 400,
        message: "Enter email"
      });
    }

    if(password.length === 0){
      return res.status(400).json({
        status: 400,
        message: "Enter password"
      });
    }

    let muchQuery = "DELETE FROM users WHERE `email` = ? AND `email_verification_status` = true";
    let much;
    try{
      [getUserDetails] = await db.execute(muchQuery, [ email ]);
    }catch(error){
      console.log('SQL-Error: '+error);
      return res.status(500).json({
        status: 500,
        message: 'Could not connect to server'
      });
    }

    if (much.length === 0) {
      return res.status(400).json({
        status: 400,
        message: "Failed to get user details"
      });
    }

    return res.status(200).json({
      status: 200,
      message: "worked",
    });

  });
  // login end

  // get user details start
  app.post(PREFIX+'/get-user-details', async function(req, res) {

    let email = trim(req.body.email);

    let getUserDetailsQuery = "SELECT `id`, `fullname`, `email` FROM users WHERE `email` = ?";
    let getUserDetails;
    try{
      [getUserDetails] = await db.execute(getUserDetailsQuery, [ email ]);
    }catch(error){
      console.log('SQL-Error: '+error);
      return res.status(500).json({
        status: 500,
        message: 'Could not connect to server'
      });
    }

    if (getUserDetails.length === 0) {
      return res.status(400).json({
        status: 400,
        message: "Failed to get user details"
      });
    }

    let fullNamee = getUserDetails[0].fullname;
    let fullNameee = getUserDetails[0].fullname;
    let emailBack = getUserDetails[0].email;
    let receiver = [];
    let ress = fullNamee.split('');
    let fullName = ress[0];
    receiver.push(fullName);
    receiver.push(emailBack);
    receiver.push(fullNameee);

    return res.status(200).json({
      status: 200,
      message: "worked",
      data: receiver
    });

  });
  // get user details end

  // register users start
  app.post(PREFIX + '/register', async function(req, res){

    let fullName = trim(req.body.fullName);
    let email = trim(req.body.email);
    let password = trim(req.body.password);
    let uuid = uuidv5(email, uuidv4());
    let hash = Math.floor(Math.random()*90000) + 10000;
    let passwordHash = hashPassword(password);

    let errorInfo = {}
    let errorCount = 0;

    if(fullName.length === 0){
      errorCount++;
      errorInfo.fullName = "Enter your Full name";
    }

    if(email.length === 0){
      errorCount++;
      errorInfo.email = "Enter a valid email";
    }else if(!validateEmail(email)){
      errorCount++;
      errorInfo.email = "Enter a valid email";
    }

    if(password.length === 0){
      errorCount++;
      errorInfo.password = "Enter a password";
    }

    let checkEmailExistQuery = "SELECT id FROM users WHERE email = ?";
    let checkEmailExist;
    try{
      [checkEmailExist] = await db.execute(checkEmailExistQuery, [email]);
    }catch(error){
      console.log('SQL-Error: '+error);
      return res.status(500).json({
        status: 500,
        message: 'Could not connect to server'
      });
    }

    if (checkEmailExist.length > 0) {
      errorCount++;
      errorInfo.email = "Email already exists.";
    }

    if(errorCount > 0){
      return res.status(400).json({
        status: 400,
        message: 'Error: Sorry, failed to create account',
        errors: errorInfo
      });
    }

    let signUpQuery = "INSERT INTO `users` (`uuid`, `fullname`, `email`, `password`, `email_verification_code`, email_verification_stamp, `created_at`) VALUES(?, ?, ?, ?, ?, NOW(), NOW())";
    let signUp;
    try{
      [signUp] = await db.execute(signUpQuery, [uuid, fullName, email, passwordHash, hash]);
    }catch(error){
      console.log('SQL-Error: '+error);
      return res.status(500).json({
        status: 500,
        message: 'Could not connect to server'
      });
    }

    sendRegistrationEmail(email, fullName, hash);
    return res.status(200).json({
      status: 200,
      message: "worked"
    });

  });

  // register users end

}

module.exports = {
  routes
}