const mysql_db = require('../database/connection');
const jwt = require('jsonwebtoken');
const {
  trim,
  validateWholeNumber,
  sendMessageToTelegram
} = require('../utilities/utilities');

const PREFIX = "/voter";

const routes = (app, sessionChecker) => {

  app.post(PREFIX+'/cast-vote', sessionChecker, async (req, res) => {
    const uuid = req.uuid;
  });

}

module.exports = {
  routes
}