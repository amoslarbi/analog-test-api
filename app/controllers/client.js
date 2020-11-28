const db = require('../database/connection');
const jwt = require('jsonwebtoken');
const { v4: uuidv4, v5: uuidv5 } = require('uuid');
const {
  trim,
  sendMessageToTelegram,
} = require('../utilities/utilities');
const Constants = require('../misc/api-constants');
const PREFIX = "/client";

const routes = (app, sessionChecker) => {
      // new EC create election start
      app.post(PREFIX+'/create-election', sessionChecker, async (req, res) => {

        const uuid = req.uuid;
        let electionName = req.body.electionName;
        let organization = req.body.organization;
        let electionUuid = uuidv5(electionName, uuidv4());

        let errorInfo = {}
        let errorCount = 0;

        if(electionName.length === 0){
          errorCount++;
          errorInfo.electionName = "Enter election name";
        }
    
        if(organization.length === 0){
          errorCount++;
          errorInfo.organization = "Enter organization / group name";
        }
    
        let electionNameQuery = "SELECT * FROM `elections` WHERE (`name` = ? AND `organization_name` = ?) AND `created_by` = ?  ";
        let checkElectionNameQuery;
        try{
          [checkElectionNameQuery] = await db.execute(electionNameQuery, [ electionName, organization, uuid ]);
        }catch(error){
          console.log('SQL-Error: '+error);
          sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+checkElectionNameQuery);
          return res.status(500).json({
            status: 500,
            message: 'Could not connect to server'
          });
        }

        let errorMessage = "Error: Sorry, failed to create account";
    
        if (checkElectionNameQuery.length === 1) {
          errorCount++;
          errorMessage = "You already have and election with the same name and organization/group name.";
        }

        if(errorCount > 0){
          return res.status(400).json({
            status: 400,
            message: errorMessage,
            errors: errorInfo
          });
        }
    
        let createElectionQuery = "INSERT INTO `elections` (`election_uuid`, `name`, `organization_name`,`created_by`, `created_at`) VALUES(?, ?, ?, ?, NOW())";
        let checkElectionQuery;
        try{
          [checkElectionQuery] = await db.execute(createElectionQuery, [electionUuid, electionName, organization, uuid ]);
        }catch(error){
          console.log('SQL-Error: '+error);
          sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+checkElectionQuery);
          return res.status(500).json({
            status: 500,
            message: 'Could not connect to server'
          });
        }
    
        let alertMessage = `ELECTION (Draft):\nElection Name: ${electionName} \nOrganization Name: ${organization}.`
        sendMessageToTelegram('alert', alertMessage);
        return res.status(200).json({
          status: 200,
          message: "worked",
          data: {
            electionUUID: electionUuid
          }
        });
    
      });
  
      // new EC create election end

}

module.exports = {
  routes
}