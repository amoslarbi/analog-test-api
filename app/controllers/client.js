const mysql_db = require('../database/connection');
const jwt = require('jsonwebtoken');
const { v4: uuidv4, v5: uuidv5 } = require('uuid');
const {
  trim,
  sendMessageToTelegram,
} = require('../utilities/utilities');
const Constants = require('../misc/api-constants');
const PREFIX = "/client";

const routes = (app, sessionChecker) => {

  // app.post(PREFIX+'/create-election', sessionChecker, async (req, res) => {
  //   const uuid = req.uuid;
  // });

      // new EC create election start
      app.post(PREFIX+'/create-election', sessionChecker, async (req, res) => {

        const uuid = req.uuid;
        console.log(uuid);
        let electionName = req.body.electionName;
        let organization = req.body.organization;
        let electionUuid = uuidv5(electionName, uuidv4());

        console.log(uuid);
    
        if(electionName.length === 0){
          return res.status(400).json({
            status: 400,
            message: "Enter election name"
          });
        }
    
        if(organization.length === 0){
          return res.status(400).json({
            status: 400,
            message: "Enter organization / group name"
          });
        }
    
        let electionNameQuery = "SELECT * FROM `elections` WHERE `name` = ? AND `organization_name` = ? ";
        let checkElectionNameQuery;
        try{
          [checkElectionNameQuery] = await db.execute(electionNameQuery, [ electionName, organization ]);
        }catch(error){
          console.log('SQL-Error: '+error);
          sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+checkElectionNameQuery);
          return res.status(500).json({
            status: 500,
            message: 'Could not connect to server'
          });
        }
    
        if (checkElectionNameQuery.length === 1) {
            return res.status(400).json({
              status: 400,
              message: 'Election name already exist for this organization/group'
            });
        }
    
        let createElectionQuery = "INSERT INTO `users` (`uuid`, `name`, `organization_name`, `created_at`) VALUES(?, ?, ?, NOW())";
        let checkElectionQuery;
        try{
          [checkElectionQuery] = await db.execute(createElectionQuery, [electionUuid, electionName, organization ]);
        }catch(error){
          console.log('SQL-Error: '+error);
          sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+checkElectionQuery);
          return res.status(500).json({
            status: 500,
            message: 'Could not connect to server'
          });
        }
    
        let alertMessage = `${electionName} created for ${organization}.`
        sendMessageToTelegram('alert', alertMessage);
        return res.status(200).json({
          status: 200,
          message: "worked"
        });
    
      });
  
      // new EC create election end

}

module.exports = {
  routes
}