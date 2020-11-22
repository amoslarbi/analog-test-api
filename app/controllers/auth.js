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
  sendMessageToTelegram
} = require('../utilities/utilities');
const {
  sendRegisterationEmail,
} = require('../utilities/utilities');

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
      
          let resetPasswordCheckQuery = "UPDATE users SET password = ? WHERE reset_password_code = ?";
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
    
        let resetPasswordTokenCheckQuery = "SELECT * FROM users WHERE reset_password_code = ?";
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

        let action_url = "http://localhost:3000/reset-password/" + token
      // sendRegisterationEmail(email, action_url);
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
    let tokenOkay = 1;
    let tokenNotOkay = 0;

    let checkTokenQuery = "SELECT * FROM users WHERE email_verification_code = ? AND account_status = ?";
    let checkToken;
    try{
      [checkToken] = await db.execute(checkTokenQuery, [ token, tokenNotOkay ]);
    }catch(error){
      console.log('SQL-Error: '+error);
      return res.status(500).json({
        status: 500,
        message: 'Could not connect to server'
      });
    }

    if (checkToken.length == 1) {

      let changeTokenStatusQuery = "UPDATE users SET account_status = ? WHERE email_verification_code = ?";
      let changeTokenStatus;
      try{
        [changeTokenStatus] = await db.execute(changeTokenStatusQuery, [ tokenOkay, token ]);
      }catch(error){
        console.log('SQL-Error: '+error);
        return res.status(500).json({
          status: 500,
          message: 'Could not connect to server'
        });
      }

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

    if(fullName.length === 0){
      return res.status(400).json({
        status: 400,
        message: "Full name required"
      });
    }

    if(country.length === 0){
      return res.status(400).json({
        status: 400,
        message: "Country required"
      });
    }

    if(email.length === 0){
      return res.status(400).json({
        status: 400,
        message: "Email required"
      });
    }

    if(password.length === 0){
      return res.status(400).json({
        status: 400,
        message: "Password required"
      });
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
      return res.status(200).json({
        status: 200,
        message: "already"
      });
    }

    let signUpQuery = "INSERT INTO users (`uuid`, `fullName`, `email`, `country`, `password`, `email_verification_code`, email_verification_stamp, `user_type`, `account_status`, `created_at`) VALUES(?, ?, ?, ?, ?, ?, NOW(), ?, ?, NOW())";
    let signUp;
    try{
      [signUp] = await db.execute(signUpQuery, [uuid, fullName, email, country, passwordHash, hash, "EC", "Pending"]);
    }catch(error){
      console.log('SQL-Error: '+error);
      return res.status(500).json({
        status: 500,
        message: 'Could not connect to server'
      });
    }

    let action_url = "http://localhost:3000/email-verification/code/" + hash

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