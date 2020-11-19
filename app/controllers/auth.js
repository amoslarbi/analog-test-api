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
    let passwordHash = hashPassword(password);

    let signUpQuery = "INSERT INTO users (uuid, `fullName`, `email`, `country`, `password`, `hash`, `createdAt`, `accountType`, `accountStatus`) VALUES(?, ?, ?, ?, ?, ?, ?, ?)";
    let signUp;
    try{
      [signUp] = await db.execute(signUpQuery, [uuid, fullName, email, country, passwordHash, hash, "NOW()", "Pending"]);
    }catch(error){
      console.log('SQL-Error: '+error);
      return res.status(500).json({
        status: 500,
        message: 'Could not connect to server'
      });
    }

    if (signUp) {

    }
    else{
      return res.status(401).json({
        status: 401,
        message: "Error, unable to execute query"
      });
    }

  });


}

module.exports = {
  routes
}