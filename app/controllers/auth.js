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
  sendWelcomeEmail,
  sendPasswordResetEmail
} = require('../utilities/utilities');
const { Constants } = require('../misc/constants');

const PREFIX = "/auth";

const routes = (app) => {

  // Login and Generate JWT token
  app.post(PREFIX+'/login', async (req, res) => {

    let email = req.body.email;
    let password = req.body.password;

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

    let loginQuery = "SELECT * FROM `users` WHERE `email` = ?";
    let checkLoginQuery;
    try{
      [checkLoginQuery] = await db.execute(loginQuery, [ email ]);
    }catch(error){
      console.log('SQL-Error: '+error);
      sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+checkForgotPasswordEmailQuery);
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
    let fullName = checkLoginQuery[0].fullname;
    let email_verification_status = checkLoginQuery[0].email_verification_status;
    const access_data = {
      uuid: uuid
    }

    const jwt_access_token = jwt.sign({access_data}, process.env.JWT_KEY, { expiresIn: '30d' })

    return res.status(200).json({
      status: 200,
      user_obj: {
        fullName: fullName,
        email: email,
        emailVerificationStatus: email_verification_status
      },
      access_token: jwt_access_token
    })

  });

  // reset password start
  app.post(PREFIX+'/reset-password', async function(req, res) {

    let token = trim(req.body.token);
    let password = trim(req.body.password);
    let passwordHash = hashPassword(password);

    if(password.length === 0){
      return res.status(400).json({
        status: 400,
        message: "Enter a password"
      });
    }

    let resetPasswordTokenCheckQuery = "SELECT `id` FROM `users` WHERE `reset_password_code` = ? AND `reset_password_status` = 0";
    let resetPasswordTokenCheck;
    try{
      [resetPasswordTokenCheck] = await db.execute(resetPasswordTokenCheckQuery, [ token ]);
    }catch(error){
      console.log('SQL-Error: '+error);
      sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+resetPasswordTokenCheckQuery);
      return res.status(500).json({
        status: 500,
        message: 'Could not connect to server'
      });
    }

    if (resetPasswordTokenCheck.length === 0) {
      return res.status(400).json({
        status: 400,
        message: "Invalid token"
      });
    }

    let resetPasswordCheckQuery = "UPDATE users SET password = ?, reset_password_status = 1 WHERE reset_password_code = ?";
    let resetPassword;
    try{
      [resetPassword] = await db.execute(resetPasswordCheckQuery, [ passwordHash, token ]);
    }catch(error){
      console.log('SQL-Error: '+error);
      sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+resetPasswordCheckQuery);
      return res.status(500).json({
        status: 500,
        message: 'Could not connect to server'
      });
    }

    return res.status(200).json({
      status: 200,
      message: "worked",
    });

  });
  // reset password end

  // reset password token check start
  app.post(PREFIX+'/reset-password-token-check', async function(req, res) {

    let token = trim(req.body.token);

    let resetPasswordTokenCheckQuery = "SELECT `fullname` FROM `users` WHERE `reset_password_code` = ? AND `reset_password_status` = 0";
    let resetPasswordTokenCheck;
    try{
      [resetPasswordTokenCheck] = await db.execute(resetPasswordTokenCheckQuery, [ token ]);
    }catch(error){
      console.log('SQL-Error: '+error);
      sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+resetPasswordTokenCheckQuery);
      return res.status(500).json({
        status: 500,
        message: 'Could not connect to server'
      });
    }

    if (resetPasswordTokenCheck.length === 1) {

      let fullname = resetPasswordTokenCheck[0].fullname;
      return res.status(200).json({
        status: 200,
        message: "valid token",
        fullname: fullname,
      });

    }
    else{

      return res.status(400).json({
        status: 400,
        message: "Invalid token"
      });

    }

  });
  // reset password token check end

  // forgot password start
  app.post(PREFIX+'/forgot-password', async function(req, res) {
  
    let email = trim(req.body.email);

    if(email.length === 0){
      return res.status(400).json({
        status: 400,
        message: 'Enter a valid email'
      });
    }else if(!validateEmail(email)){
      return res.status(400).json({
        status: 400,
        message: 'Enter a valid email'
      });
    }

    let checkForgotPasswordEmailQuery = "SELECT `id`,`fullname` FROM users WHERE email = ?";
    let checkForgotPasswordEmail;
    try{
      [checkForgotPasswordEmail] = await db.execute(checkForgotPasswordEmailQuery, [ email ]);
    }catch(error){
      console.log('SQL-Error: '+error);
      sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+checkForgotPasswordEmailQuery);
      return res.status(500).json({
        status: 500,
        message: 'Could not connect to server'
      });
    }

    if (checkForgotPasswordEmail.length === 0) {
      return res.status(400).json({
        status: 400,
        message: 'Email does not exists'
      });
    }

    let token = uuidv5(email, uuidv4());

    let updateForgotPasswordFieldQuery = "UPDATE users SET reset_password_code = ?, reset_password_stamp = NOW() WHERE email = ?";
    let updateForgotPasswordField;
    try{
      [updateForgotPasswordField] = await db.execute(updateForgotPasswordFieldQuery, [ token, email ]);
    }catch(error){
      console.log('SQL-Error: '+error);
      sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+updateForgotPasswordFieldQuery);
      return res.status(500).json({
        status: 500,
        message: 'Could not connect to server'
      });
    }

    let fullName = checkForgotPasswordEmail[0].fullname;
    let action_url = Constants.CLIENT_APP_URL + "/reset-password/" + token
    sendPasswordResetEmail(email, fullName, action_url);
    return res.status(200).json({
      status: 200,
      message: "Email sent with steps on how to reset your password"
    });

  });
  // forgot password end

  // verify email token start
  app.post(PREFIX+'/verify-token', async function(req, res) {
    
    let token = trim(req.body.token);

    let checkTokenQuery = "SELECT `id`, `fullname`, `email` FROM users WHERE `email_verification_code` = ? AND `email_verification_status` = 0";
    let checkToken;
    try{
      [checkToken] = await db.execute(checkTokenQuery, [ token ]);
    }catch(error){
      console.log('SQL-Error: '+error);
      sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+checkTokenQuery);
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
      sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+changeTokenStatusQuery);
      return res.status(500).json({
        status: 500,
        message: 'Could not connect to server'
      });
    }

    sendWelcomeEmail(email, fullName, action_url);

    return res.status(200).json({
      status: 200,
      message: "Account verification successful"
    });

  });
  // verify email token end

  // register users start
  app.post(PREFIX + '/register', async function(req, res){

    let fullName = trim(req.body.fullName);
    let country = trim(req.body.country);
    let email = trim(req.body.email);
    let password = trim(req.body.password);
    let uuid = uuidv5(email, uuidv4());
    let hash = uuidv5(email, uuidv4());
    let passwordHash = hashPassword(password);

    let errorInfo = {}
    let errorCount = 0;

    if(fullName.length === 0){
      errorCount++;
      errorInfo.fullName = "Enter your Full name";
    }

    if(country.length === 0){
      errorCount++;
      errorInfo.country = "Select a Country";
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
      sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+checkEmailExistQuery);
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

    let signUpQuery = "INSERT INTO users (`uuid`, `fullname`, `email`, `country`, `password`, `email_verification_code`, email_verification_stamp, `user_type`, `created_at`) VALUES(?, ?, ?, ?, ?, ?, NOW(), ?, NOW())";
    let signUp;
    try{
      [signUp] = await db.execute(signUpQuery, [uuid, fullName, email, country, passwordHash, hash, "u"]);
    }catch(error){
      console.log('SQL-Error: '+error);
      sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+signUpQuery);
      return res.status(500).json({
        status: 500,
        message: 'Could not connect to server'
      });
    }

    let action_url = Constants.CLIENT_APP_URL + "/email-verification/code/" + hash
    sendRegisterationEmail(email, fullName, action_url);
    let alertMessage = `${fullName} signed up for oBallot from ${country}.`
    sendMessageToTelegram('alert', alertMessage);
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