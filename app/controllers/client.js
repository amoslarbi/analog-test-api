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

        let errorMessage = "Error: Sorry, failed to create election";
    
        if (checkElectionNameQuery.length === 1) {
          errorCount++;
          errorMessage = "You already have an election with the same name and organization/group name.";
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
    
        let alertMessage = `ELECTION (Draft):\n Election Name: ${electionName} \n Organization Name: ${organization}.`
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

      // verify election UUID start
    app.post(PREFIX+'/verify-election-uuid', sessionChecker, async (req, res) => {
    
    const uuid = req.uuid;
    let electionUUID = trim(req.body.electionUUID);

    let checkElectionUUIDQuery = "SELECT `id`, `name`, `organization_name` FROM elections WHERE `election_uuid` = ? AND `created_by` = ?";
    let checkElectionUUID;
    try{
      [checkElectionUUID] = await db.execute(checkElectionUUIDQuery, [ electionUUID, uuid ]);
    }catch(error){
      console.log('SQL-Error: '+error);
      sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+checkElectionUUIDQuery);
      return res.status(500).json({
        status: 500,
        message: 'Could not connect to server'
      });
    }

    if (checkElectionUUID.length === 0) {
      return res.status(400).json({
        status: 400,
        message: "failed"
      });
    }

    let name = checkElectionUUID[0].name;
    let organization_name = checkElectionUUID[0].organization_name;

    return res.status(200).json({
      status: 200,
      message: "worked",
      election_obj: {
        name: name,
        organization_name: organization_name,
      },
    });

  });
  // verify election UUID end

        // insert information start
        app.post(PREFIX+'/information', sessionChecker, async (req, res) => {

          const uuid = req.uuid;
          let electionUUID = req.body.electionUUID;
          let name = req.body.name;
          let organization_name = req.body.organization_name;
          let duration = req.body.duration;
          let declaration = req.body.declaration;
          let declarationKyiv;
          if(declaration == "show"){
            declarationKyiv = 1
          }
          else{
            declarationKyiv = 0
          }

          let getDuration = [];
          getDuration = duration;
          let start_time = getDuration[0];
          let end_time = getDuration[1];

          // let durationKyiv = duration.split(' ');
          // // let start_time_day = durationKyiv[0].split(',');
          // let start_time_month = durationKyiv[1].split(',');
          // let start_time_day = durationKyiv[2].split(',');
          // let start_time_year = durationKyiv[3].split(',');
          // let start_time_time = durationKyiv[4].split(',');
          // let start_time = start_time_month + " " + start_time_day + " " + start_time_year + " " + start_time_time;

          // let end_time_month = durationKyiv[6].split(',');
          // let end_time_day = durationKyiv[7].split(',');
          // let end_time_year = durationKyiv[8].split(',');
          // let end_time_time = durationKyiv[9].split(',');
          // let end_time = end_time_month + " " + end_time_day + " " + end_time_year + " " + end_time_time;
  
          let errorInfo = {}
          let errorCount = 0;
  
          if(name.length === 0){
            errorCount++;
            errorInfo.name = "Enter election name";
          }
      
          if(organization_name.length === 0){
            errorCount++;
            errorInfo.organization_name = "Enter organization / group name";
          }

          if(duration.length === 0){
            errorCount++;
            errorInfo.duration = "Enter duration";
          }

          let checkInformationElectionUUIDQuery = "SELECT `id`, `name`, `organization_name` FROM elections WHERE `election_uuid` = ? AND `created_by` = ?";
          let checkInformationElectionUUID;
          try{
            [checkInformationElectionUUID] = await db.execute(checkInformationElectionUUIDQuery, [ electionUUID, uuid ]);
          }catch(error){
            console.log('SQL-Error: '+error);
            sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+checkInformationElectionUUIDQuery);
            return res.status(500).json({
              status: 500,
              message: 'Could not connect to server'
            });
          }

          if (checkInformationElectionUUID.length === 0) {
            return res.status(400).json({
              status: 400,
              message: "Invalid election ID"
            });
          }
      
          // let informationElectionNameQuery = "SELECT * FROM `elections` WHERE (`name` = ? AND `organization_name` = ?) AND `created_by` = ?  ";
          // let checkInformationElectionNameQuery;
          // try{
          //   [checkInformationElectionNameQuery] = await db.execute(informationElectionNameQuery, [ name, organization_name, uuid ]);
          // }catch(error){
          //   console.log('SQL-Error: '+error);
          //   sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+informationElectionNameQuery);
          //   return res.status(500).json({
          //     status: 500,
          //     message: 'Could not connect to server'
          //   });
          // }
  
          // let errorMessage = "Error: Sorry, failed to create election";
      
          // if (checkInformationElectionNameQuery.length === 1) {
          //   errorCount++;
          //   errorMessage = "You already have an election with the same name and organization/group name.";
          // }
  
          if(errorCount > 0){
            return res.status(400).json({
              status: 400,
              message: errorMessage,
              errors: errorInfo
            });
          }
      
          let updateInformationElectionQuery = "UPDATE elections SET `name` = ?, `organization_name` = ?, `start_time` = ?, `end_time` = ?, `show_result` = ?";
          let checkUpdateInformationElectionQuery;
          try{
            [checkUpdateInformationElectionQuery] = await db.execute(updateInformationElectionQuery, [ name, organization_name, start_time, end_time, declarationKyiv ]);
          }catch(error){
            console.log('SQL-Error: '+error);
            sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+updateInformationElectionQuery);
            return res.status(500).json({
              status: 500,
              message: 'Could not connect to server'
            });
          }
      
          let alertMessage = `ELECTION (Draft):\n Election Name: ${name} \n Organization Name: ${organization_name}.`
          sendMessageToTelegram('alert', alertMessage);
          return res.status(200).json({
            status: 200,
            message: "worked",
          });
      
        });
    
        // insert information end

}

module.exports = {
  routes
}