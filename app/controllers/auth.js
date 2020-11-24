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
  sendRegisterationEmail
} = require('../utilities/utilities');
const API_CONSTANTS = require('../misc/constants')

const PREFIX = "/auth";

const routes = (app) => {

  // Login and Generate JWT token
  app.post(PREFIX+'/login', async (req, res) => {

  });

  // reset password start
  app.post(PREFIX+'/reset-password', async function(req, res) {

    let token = trim(req.body.token);
    let password = trim(req.body.password);
    let passwordHash = hashPassword(password);

    if(password.length === 0){
      return res.status(400).json({
        status: 400,
        message: "Password required"
      });
    }

    let resetPasswordCheckQuery = "UPDATE users SET password = ?, resetPasswordCodeStatus = 1 WHERE reset_password_code = ?";
    let resetPassword;
    try{
      [resetPassword] = await db.execute(resetPasswordCheckQuery, [ passwordHash, token ]);
    }catch(error){
      console.log('SQL-Error: '+error);
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

    let resetPasswordTokenCheckQuery = "SELECT * FROM users WHERE reset_password_code = ? AND resetPasswordCodeStatus = 0";
    let resetPasswordTokenCheck;
    try{
      [resetPasswordTokenCheck] = await db.execute(resetPasswordTokenCheckQuery, [ token ]);
    }catch(error){
      console.log('SQL-Error: '+error);
      return res.status(500).json({
        status: 500,
        message: 'Could not connect to server'
      });
    }

    if (resetPasswordTokenCheck.length == 1) {

      let fullname = resetPasswordTokenCheck[0].fullname;
      return res.status(200).json({
        status: 200,
        message: "worked",
        fullname: fullname,
      });

    }
    else{

      return res.status(200).json({
        status: 200,
        message: "failed"
      });

    }

  });
  // reset password token check end

  // forgot password start
  app.post(PREFIX+'/forgot-password', async function(req, res) {
  
    let email = trim(req.body.email);

    if(email.length === 0){
      errorCount++;
      errorInfo.email = "Enter a valid email";
    }else if(!validateEmail(email)){
      errorCount++;
      errorInfo.email = "Enter a valid email";
    }

    let checkForgotPasswordEmailQuery = "SELECT * FROM users WHERE email = ?";
    let checkForgotPasswordEmail;
    try{
      [checkForgotPasswordEmail] = await db.execute(checkForgotPasswordEmailQuery, [ email ]);
    }catch(error){
      console.log('SQL-Error: '+error);
      return res.status(500).json({
        status: 500,
        message: 'Could not connect to server'
      });
    }

    if (checkForgotPasswordEmail.length == 1) {

      let token = uuidv5(email, uuidv4());

      let updateForgotPasswordFieldQuery = "UPDATE users SET forgot_password_code = ?, forgot_password_stamp = NOW() WHERE email = ?";
      let updateForgotPasswordField;
      try{
        [updateForgotPasswordField] = await db.execute(updateForgotPasswordFieldQuery, [ token, email ]);
      }catch(error){
        console.log('SQL-Error: '+error);
        return res.status(500).json({
          status: 500,
          message: 'Could not connect to server'
        });
      }

      let action_url = API_CONSTANTS.Constants.CLIENT_APP_URL + "/reset-password/" + token
    // sendForgotPasswordEmail(email, action_url);
      return res.status(200).json({
        status: 200,
        message: "worked"
      });

    }
    else{

      return res.status(200).json({
        status: 200,
        message: "failed"
      });

    }

  });
  // forgot password end

  // verify email token start
  app.post(PREFIX+'/verify-token', async function(req, res) {
    
    let token = trim(req.body.token);

    let checkTokenQuery = "SELECT `id` FROM users WHERE `email_verification_code` = ? AND `email_verification_status` = 0";
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

    // let theArray = [];
    // let theArrayKyiv = [];
    // theArray.push(fullName, country, email, password);
    // for (let i = 0; i < theArray.length; i++) {
    //       if (theArray[i] == null || theArray[i] == "" || theArray[i] == undefined) {
    //         theArrayKyiv.push(i);
    //     }
    // }
    // console.log(theArrayKyiv);

    // if(theArrayKyiv.length > 0){
    //   return res.status(400).json({
    //     status: 400,
    //     message: theArrayKyiv
    //   });
    // }

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

    let signUpQuery = "INSERT INTO users (`uuid`, `fullName`, `email`, `country`, `password`, `email_verification_code`, email_verification_stamp, `user_type`, `created_at`) VALUES(?, ?, ?, ?, ?, ?, NOW(), ?, NOW())";
    let signUp;
    try{
      [signUp] = await db.execute(signUpQuery, [uuid, fullName, email, country, passwordHash, hash, "u"]);
    }catch(error){
      console.log('SQL-Error: '+error);
      return res.status(500).json({
        status: 500,
        message: 'Could not connect to server'
      });
    }

    let action_url = API_CONSTANTS.Constants.CLIENT_APP_URL + "/email-verification/code/" + hash
    // sendRegisterationEmail(email, fullName, action_url);
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