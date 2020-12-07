const db = require('../database/connection');
const jwt = require('jsonwebtoken');
const { v4: uuidv4, v5: uuidv5 } = require('uuid');
const {
  trim,
  sendMessageToTelegram,
} = require('../utilities/utilities');
const Constants = require('../misc/api-constants');
const PREFIX = "/client";

const getUserInfo = async(uuid) => {
  let getUserInfoQuery = "SELECT * FROM `users` WHERE `uuid` = ?";
  let getUserInfo;
  try{
    [getUserInfo] = await db.execute(getUserInfoQuery, [uuid]);
  }catch(error){
    console.log('SQL-Error: '+error);
    sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+getUserInfoQuery);
    return res.status(500).json({
      status: 500,
      message: 'Could not connect to server'
    });
  }

  return getUserInfo[0];
}

const getVotesCated = async(electionUuid) => {
  let getVotesQuery = "SELECT COUNT(`id`) as `total` FROM `votes` WHERE `election_uuid` = ? AND `status`='a' ";
  let getVotes;
  try{
    [getVotes] = await db.execute(getVotesQuery, [electionUuid]);
  }catch(error){
    console.log('SQL-Error: '+error);
    sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+getVotesQuery);
    return res.status(500).json({
      status: 500,
      message: 'Could not connect to server'
    });
  }

  return getVotes[0].total;
}

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
          let election_uuid = getElections[i].election_uuid;

          let getElectionVotersQuery = "SELECT COUNT(`id`) as `total` FROM `election_voters` WHERE `election_uuid` = ?";
          let getElectionVoters;
          try{
            [getElectionVoters] = await db.execute(getElectionVotersQuery, [election_uuid]);
          }catch(error){
            console.log('SQL-Error: '+error);
            sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+getElectionVotersQuery);
            return res.status(500).json({
              status: 500,
              message: 'Could not connect to server'
            });
          }

          let status = getElections[i].status;
          let voters = getElectionVoters[0].total;
          let status_info = {};
          

          if(status === 'd'){
            let userInfo = await getUserInfo(uuid);
            let user_country = userInfo['country'];
            let cost_per_vote = Constants.VOTE_COST.COST_PER_VOTE;
            let currency = '$'
            let currency_iso_code = 'USD'

            switch (user_country) {
              case "Ghana":
                cost_per_vote = Constants.VOTE_COST.GHANA_COST_PER_VOTE;
                currency = '¢';
                currency_iso_code = 'GHS';
                break;
              
              case "Nigeria":
                cost_per_vote = Constants.VOTE_COST.NIGERIA_COST_PER_VOTE;
                currency = '₦';
                currency_iso_code = 'NGN';
                break;
            
              default:
                break;
            }

            let cost = 0;
            if(voters > Constants.VOTE_COST.FREE_VOTERS_LIMIT){
              cost = voters * cost_per_vote;
            }

            status_info = {
              cost: cost,
              currency: currency,
              currency_iso_code: currency_iso_code
            }
          }else if(status === 'p'){
            let votes = await getVotesCated(election_uuid);
            
            status_info = {
              votes: votes
            }
          }else if(status === 'e'){
            let votes = await getVotesCated(election_uuid);
            
            status_info = {
              votes: votes,
              result_type: 'winner', // winner, tie, looser
              result: []
            }
          }


          elections.push({
            election: election_uuid,
            icon: getElections[i].icon,
            name: getElections[i].name,
            organization_name: getElections[i].organization_name,
            start_time: getElections[i].start_time,
            end_time: getElections[i].end_time,
            show_result: getElections[i].show_result,
            voters: voters,
            status: status,
            status_info: status_info
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