const db = require('../database/connection');
const jwt = require('jsonwebtoken');
const { v4: uuidv4, v5: uuidv5 } = require('uuid');
const cors = require("cors");
const upload = require("../utilities/imageUpload");
const singleUpload = upload.single("ballotIcon");
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

      // election analytics start
      app.post(PREFIX+'/get-analytics', sessionChecker, async (req, res) => {
        const uuid = req.uuid;

        let completedElections = 0;
        let publishedElections = 0;
        let draftElections = 0;
        let totalElections = 0;
        let totalVoters = 0;

        let electionStatsQuery = "SELECT COUNT(`id`) as `total`, `status` FROM `elections` WHERE `created_by` = ? GROUP BY `status` ";
        let electionStats;
        try{
          [electionStats] = await db.execute(electionStatsQuery, [uuid]);
        }catch(error){
          console.log('SQL-Error: '+error);
          sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+electionStatsQuery);
          return res.status(500).json({
            status: 500,
            message: 'Could not connect to server'
          });
        }

        if(electionStats.length === 0){
          return res.status(201).json({
            status: 200,
            message: 'election analytics ready',
            data: {
              published: publishedElections,
              completed: completedElections,
              draft: draftElections,
              voters: totalVoters,
              totalElections: totalElections
            }
          });
        }

        for(let i = 0; i < electionStats.length; i++){
          if(electionStats[i].status === 'd'){
            draftElections = electionStats[i].total;
          }

          if(electionStats[i].status === 'p'){
            publishedElections = electionStats[i].total;
          }

          if(electionStats[i].status === 'e'){
            completedElections = electionStats[i].total;
          }
        }

        totalElections = parseInt(draftElections) + parseInt(publishedElections) + parseInt(completedElections);

        let totalVoterCountsQuery = "SELECT COUNT(DISTINCT(`voter_uuid`)) as `total` FROM `election_voters` WHERE `election_uuid` IN (SELECT `election_uuid` FROM `elections` WHERE `created_by` = ?) ";
        let totalVotersCount;
        try{
          [totalVotersCount] = await db.execute(totalVoterCountsQuery, [uuid]);
        }catch(error){
          console.log('SQL-Error: '+error);
          sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+totalVoterCountsQuery);
          return res.status(500).json({
            status: 500,
            message: 'Could not connect to server'
          });
        }

        totalVoters = totalVotersCount[0].total;

        return res.status(201).json({
          status: 200,
          message: 'election analytics ready',
          data: {
            published: publishedElections,
            completed: completedElections,
            draft: draftElections,
            voters: totalVoters,
            totalElections: totalElections
          }
        });

      });
      // end

      // get user's elections start
      app.post(PREFIX+'/get-dashboard-election', sessionChecker, async (req, res) => {
        const uuid = req.uuid;

        let getElectionsQuery = "SELECT * FROM `elections` WHERE `created_by` = ? AND `status` != 'c' ORDER BY `status` DESC LIMIT 5";
        let getElections;
        try{
          [getElections] = await db.execute(getElectionsQuery, [uuid]);
        }catch(error){
          console.log('SQL-Error: '+error);
          sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+getElectionsQuery);
          return res.status(500).json({
            status: 500,
            message: 'Could not connect to server'
          });
        }

        if(getElections.length === 0){
          return res.status(201).json({
            status: 201,
            message: 'elections ready',
            data: []
          });
        }

        let elections = []

        for(let i = 0; i < getElections.length; i++){
          elections.push({
            election: getElections[i].election_uuid,
            icon: getElections[i].icon,
            name: getElections[i].name,
            organization_name: getElections[i].organization_name,
            start_time: getElections[i].start_time,
            end_time: getElections[i].end_time,
            show_result: getElections[i].show_result,
            voters: 0,
            status: getElections[i].status
          })
        }

        return res.status(201).json({
          status: 200,
          message: 'elections ready',
          data: elections
        });

      });
      // end

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
            app.use(cors());
            
            const uuid = req.uuid;
            console.log(req);
            let ballotIcon;

            singleUpload(req, res, function (err) {
              if (err) {
                return res.json({
                  success: false,
                  errors: {
                    title: "Image Upload Error",
                    detail: err.message,
                    error: err,
                  },
                });
              }

              ballotIcon = { profilePicture: req.file.location };
          
            });

            let electionUUID = req.body.electionUUID;
            console.log(electionUUID);
            let name = req.body.name;
            let organization_name = req.body.organization_name;
            let duration = req.body.duration;
            let declaration = req.body.declaration;
            let declarationStatus;
            if(declaration == "show"){
              declarationStatus = 1
            }
            else{
              declarationStatus = 0
            }
  
            // let getDuration = [];
            // getDuration = duration;
            // let start_time = getDuration[0];
            // let end_time = getDuration[1];
  
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
    
            let errorMessage = "Error: Sorry, failed to create election";
        
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
        
            let updateInformationElectionQuery = "UPDATE elections SET `icon` = ?, `name` = ?, `organization_name` = ?, `start_time` = ?, `end_time` = ?, `show_result` = ?";
            let checkUpdateInformationElectionQuery;
            try{
              [checkUpdateInformationElectionQuery] = await db.execute(updateInformationElectionQuery, [ ballotIcon, name, organization_name, start_time, end_time, declarationStatus ]);
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