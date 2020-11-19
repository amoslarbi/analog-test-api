const mysql_db = require('../database/connection');
const jwt = require('jsonwebtoken');
const {
  trim,
  validateWholeNumber,
  sendMessageToTelegram
} = require('../utilities/utilities');

const PREFIX = "/client";

const routes = (app, sessionChecker) => {

  app.post(PREFIX+'/create-election', sessionChecker, async (req, res) => {

  });

}

module.exports = {
  routes
}