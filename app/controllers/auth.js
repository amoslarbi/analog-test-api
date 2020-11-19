const mysql_db = require('../database/connection');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const {
  trim,
  validateEmail,
  validatePassword,
  checkPassword,
  hashPassword,
  sendMessageToTelegram
} = require('../utilities/utilities');

const PREFIX = "/auth";

const routes = (app) => {

  // Login and Generate JWT token
  app.post(PREFIX+'/login', async (req, res) => {

  });

  // Register and Send activation email
  // app.post(PREFIX+'/register', async (req, res) => {
    
  // });

  app.post('/register', async function(req, res){
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
      return res.status(401).json({
        status: 401,
        message: "Already"
      });
    }

    let signUpQuery = "INSERT INTO users (`uuid`, `fullName`, `email`, `country`, `password`, `hash`, `createdAt`, `accountType`, `accountStatus`) VALUES(?, ?, ?, ?, ?, NOW(), ?, ?)";
    let signUp;
    try{
      [signUp] = await db.execute(signUpQuery, [uuid, fullName, email, country, passwordHash, hash, "Pending"]);
    }catch(error){
      console.log('SQL-Error: '+error);
      return res.status(500).json({
        status: 500,
        message: 'Could not connect to server'
      });
    }

      sendRegisterationEmail(email, fullName, hash);
      return res.status(200).json({
        status: 200,
        message: "worked"
      });

  });


}

module.exports = {
  routes
}