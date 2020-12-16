const db = require('../database/connection');
const jwt = require('jsonwebtoken');
const { v4: uuidv4, v5: uuidv5 } = require('uuid');
const upload = require("../utilities/image-upload");
var moment = require('moment-timezone');
const electionIconUpload = upload.single("electionIcon");
const ballotIconUpload = upload.single("ballotIcon");
const {
  trim,
  sendMessageToTelegram,
} = require('../utilities/utilities');
const Constants = require('../misc/api-constants');
const PREFIX = "/client";

// client functions starts here
const getUserInfo = async(uuid) => {
  let getUserInfoQuery = "SELECT * FROM `users` WHERE `uuid` = ?";
  let getUserInfo;
  try{
    [getUserInfo] = await db.execute(getUserInfoQuery, [uuid]);
  }catch(error){
    console.log('SQL-Error: '+error);
    sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+getUserInfoQuery);
    return {
      status: 500,
      message: 'Could not connect to server'
    };
  }

  return getUserInfo[0];
}

const getBallotInfo = async(ballot_uuid) => {
  let getBallotInfoQuery = "SELECT * FROM `ballots` WHERE `ballot_uuid` = ?";
  let getBallotInfo;
  try{
    [getBallotInfo] = await db.execute(getBallotInfoQuery, [ballot_uuid]);
  }catch(error){
    console.log('SQL-Error: '+error);
    sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+getBallotInfoQuery);
    return {
      status: 500,
      message: 'Could not connect to server'
    };
  }

  return getBallotInfo[0];
}

const getVotesCasted = async(electionUuid) => {
  let getVotesQuery = "SELECT COUNT(`id`) as `total` FROM `votes` WHERE `election_uuid` = ? AND `status`='a' ";
  let getVotes;
  try{
    [getVotes] = await db.execute(getVotesQuery, [electionUuid]);
  }catch(error){
    console.log('SQL-Error: '+error);
    sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+getVotesQuery);
    return {
      status: 500,
      message: 'Could not connect to server'
    };
  }

  return getVotes[0].total;
}

const getElectionCardInfo = async(electionUuid, uuid) => {
  let getElectionQuery = "SELECT * FROM `elections` WHERE `election_uuid` = ? ";
  let getElection;
  try{
    [getElection] = await db.execute(getElectionQuery, [electionUuid]);
  }catch(error){
    console.log('SQL-Error: '+error);
    sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+getElectionQuery);
    return {
      status: 500,
      message: 'Could not connect to server'
    };
  }

  let electionInfo = {}
  if(getElection.length === 0){
    return {
      status: 201,
      data: electionInfo
    }
  }

  let getElectionVotersQuery = "SELECT COUNT(`id`) as `total` FROM `election_voters` WHERE `election_uuid` = ?";
  let getElectionVoters;
  try{
    [getElectionVoters] = await db.execute(getElectionVotersQuery, [electionUuid]);
  }catch(error){
    console.log('SQL-Error: '+error);
    sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+getElectionVotersQuery);
    return {
      status: 500,
      message: 'Could not connect to server'
    };
  }

  let status = getElection[0].status;
  let voters = getElectionVoters[0].total;
  let status_info = {};
  

  if(status === 'd'){
    let user_Info = await getUserInfo(uuid);
    let user_country = user_Info['country'];
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
    let votes = await getVotesCasted(electionUuid);
    
    status_info = {
      votes: votes
    }
  }else if(status === 'e'){
    let votes = await getVotesCasted(electionUuid);
    if(votes === 0){
      status_info = {
        votes: votes,
        result_type: 'no-vote', // winner, tie, looser, no-vote
        result: []
      }
    }else{
      let getBallotCountQuery = "SELECT COUNT(`id`) as `total` FROM `ballots` WHERE `election_uuid` = ? ";
      let getBallotCount;
      try{
        [getBallotCount] = await db.execute(getBallotCountQuery, [electionUuid]);
      }catch(error){
        console.log('SQL-Error: '+error);
        sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+getBallotCountQuery);
        return {
          status: 500,
          message: 'Could not connect to server'
        };
      }

      let ballot = getBallotCount[0].total;

      let getElectionResultQuery = "SELECT COUNT(`id`) as `total`, `vote`, `ballot_uuid` FROM `votes` WHERE `election_uuid` = ? AND `status`='a' GROUP BY `vote`, `ballot_uuid` ORDER BY `vote` DESC";
      let getElectionResult;
      try{
        [getElectionResult] = await db.execute(getElectionResultQuery, [electionUuid]);
      }catch(error){
        console.log('SQL-Error: '+error);
        sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+getElectionResultQuery);
        return {
          status: 500,
          message: 'Could not connect to server'
        };
      }

      let result_type = 'winner';
      let ballot_result = [];

      if(ballot === 1){
        let yes_votes = 0;
        let no_votes = 0;
        for(let i = 0; i < getElectionResult.length; i++){
          if(getElectionResult[i].vote == 1){
            yes_votes = getElectionResult[i].total
          }else{
            no_votes = getElectionResult[i].total;
          }
        }

        if(yes_votes === no_votes){
          result_type = 'tie';
        }else if(yes_votes < no_votes){
          result_type = 'looser';
        }

        let ballot_uuid = getElectionResult[0].ballot_uuid;
        let ballot_info = await getBallotInfo(ballot_uuid);
        ballot_result.push({
          name: ballot_info.name,
          avatar: ballot_info.avatar,
          description: ballot_info.description,
          votes: yes_votes,
        })

      }else{
        for(let i = 0; i < getElectionResult.length; i++){
          let yes_votes = getElectionResult[i].total;
          let ballot_uuid = getElectionResult[i].ballot_uuid;
          let ballot_info = await getBallotInfo(ballot_uuid);
          ballot_result.push({
            name: ballot_info.name,
            avatar: ballot_info.avatar,
            description: ballot_info.description,
            votes: yes_votes,
          })
        }

        if(getElectionResult[0].total === getElectionResult[1].total){
          result_type = 'tie';
        }
      }

      

      status_info = {
        votes: votes,
        result_type: result_type, // winner, tie, looser, no-vote
        result: ballot_result
      }
    }
    
    
  }


  electionInfo = {
    election: electionUuid,
    icon: getElection[0].icon,
    name: getElection[0].name,
    organization_name: getElection[0].organization_name,
    start_time: getElection[0].start_time,
    end_time: getElection[0].end_time,
    show_result: getElection[0].show_result === '0' ? 'hide' : 'show',
    information_status: getElection[0].information_status,
    ballot_status: getElection[0].ballot_status,
    voters_status: getElection[0].voters_status,
    voters: voters,
    status: status,
    status_info: status_info
  }

  return {
    status: 200,
    data: electionInfo
  }
}

// client functions ends here

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
            status: 201,
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

        return res.status(200).json({
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

          let electionInfo = await getElectionCardInfo(election_uuid, uuid);
          if(electionInfo.status === 200){
            elections.push(electionInfo.data)
          }

        }

        return res.status(200).json({
          status: 200,
          message: 'elections ready',
          data: elections
        });

      });
      // end

       // get elections by type start
       app.post(PREFIX+'/get-elections', sessionChecker, async (req, res) => {
        const uuid = req.uuid;
        let electionStatus = req.body.electionStatus;
        let page = req.body.page;

        if(!req.body.page){
          page = 1;
        }

        switch (electionStatus) {
          case 'draft':
            electionStatus = 'd'
            break;

          case 'published':
            electionStatus = 'p'
            break;

          case 'completed':
            electionStatus = 'e'
            break;
        
          default:
            electionStatus = 'p'
            break;
        }

        let limit;
        if(page === 1){
          limit = 0;
        }else{
          limit = parseInt(page - 1) * 10;
        }

        let getElectionsQuery = "SELECT * FROM `elections` WHERE `created_by` = ? AND `status` = ? ORDER BY `updated_at` DESC LIMIT ?,10";
        let getElections;
        try{
          [getElections] = await db.execute(getElectionsQuery, [uuid, electionStatus, limit]);
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
            data: [],
            meta: {
              total_elections: 0
            },
          });
        }

        let getElectionsCountQuery = "SELECT COUNT(`id`) as `total_count` FROM `elections` WHERE `created_by` = ? AND `status` = ? ";
        let getElectionsCount;
        try{
          [getElectionsCount] = await db.execute(getElectionsCountQuery, [uuid, electionStatus]);
        }catch(error){
          console.log('SQL-Error: '+error);
          sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+getElectionsCountQuery);
          return res.status(500).json({
            status: 500,
            message: 'Could not connect to server'
          });
        }

        let elections = []

        for(let i = 0; i < getElections.length; i++){
          let election_uuid = getElections[i].election_uuid;

          let electionInfo = await getElectionCardInfo(election_uuid, uuid);
          if(electionInfo.status === 200){
            elections.push(electionInfo.data)
          }

        }

        return res.status(200).json({
          status: 200,
          message: 'elections ready',
          meta: {
            total_elections: getElectionsCount[0].total_count
          },
          data: elections
        });

      });
      // end

      // get election information by UUID start
      app.post(PREFIX+'/get-election-details', sessionChecker, async (req, res) => {
        const uuid = req.uuid;
        let electionUUID = trim(req.body.election);
    
        let checkElectionUUIDQuery = "SELECT * FROM elections WHERE `election_uuid` = ? AND `created_by` = ?";
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
            message: "Invalid election information"
          });
        }
    
        let electionInfo = await getElectionCardInfo(electionUUID, uuid);
    
        return res.status(200).json({
          status: 200,
          message: "election details ready",
          data: electionInfo.data,
        });
    
      });
      // get election details by UUID end

      // get ballots
      app.post(PREFIX+'/get-ballots', sessionChecker, async (req, res) => {
        let uuid = req.uuid;
        let electionUUID = trim(req.body.election);

        let checkElectionUUIDQuery = "SELECT * FROM elections WHERE `election_uuid` = ? AND `created_by` = ?";
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
            message: "Invalid election information"
          });
        }
    
        let electionBallotQuery = "SELECT * FROM ballots WHERE `election_uuid` = ? ORDER BY `name` ASC";
        let electionBallot;
        try{
          [electionBallot] = await db.execute(electionBallotQuery, [ electionUUID ]);
        }catch(error){
          console.log('SQL-Error: '+error);
          sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+electionBallotQuery);
          return res.status(500).json({
            status: 500,
            message: 'Could not connect to server'
          });
        }
    
        if (electionBallot.length === 0) {
          return res.status(400).json({
            status: 400,
            message: "No ballot found",
            data: []
          });
        }
    
        return res.status(200).json({
          status: 200,
          message: "worked",
          data: electionBallot
        });
    
      });
      // get ballots end

      // add voters start
      app.post(PREFIX+'/add-voter', sessionChecker, async (req, res) => {
        const uuid = req.uuid;
        let electionUUID = trim(req.body.electionUUID);
        let voterEmail = trim(req.body.voterEmail);

        // check elections table if the EC about to add voters is the owner of that election
    
        let checkECQuery = "SELECT * FROM elections WHERE `election_uuid` = ? AND `created_by` = ?";
        let checkECQueryResult;
        try{
          [checkECQueryResult] = await db.execute(checkECQuery, [ electionUUID, uuid ]);
        }catch(error){
          console.log('SQL-Error: '+error);
          sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+checkECQuery);
          return res.status(500).json({
            status: 500,
            message: 'Could not connect to server'
          });
        }
    
        if (checkECQueryResult.length === 0) {
          return res.status(400).json({
            status: 400,
            message: "not you"
          });
        }

        // check the voters table if that voter already exist

        let checkVotersTableQuery = "SELECT id, email FROM voters WHERE `email` = ?";
        let checkVotersTableQueryResult;
        try{
          [checkVotersTableQueryResult] = await db.execute(checkVotersTableQuery, [ voterEmail ]);
        }catch(error){
          console.log('SQL-Error: '+error);
          sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+checkVotersTableQuery);
          return res.status(500).json({
            status: 500,
            message: 'Could not connect to server'
          });
        }

        if (checkVotersTableQueryResult.length === 1) {
          let voter_uuid = checkLoginQuery[0].voter_uuid;

          // check the election voters table to see if that voter already exist

          let checkElectionVotersTableQuery = "SELECT * FROM election_voters WHERE `voter_uuid` = ? AND `election_uuid` = ?";
          let checkElectionVotersTableQueryResult;
          try{
            [checkElectionVotersTableQueryResult] = await db.execute(checkElectionVotersTableQuery, [ voter_uuid, electionUUID ]);
          }catch(error){
            console.log('SQL-Error: '+error);
            sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+checkElectionVotersTableQuery);
            return res.status(500).json({
              status: 500,
              message: 'Could not connect to server'
            });
          }

          // if voter already exist in the voters and election voters table, prompt EC
  
          if (checkElectionVotersTableQueryResult.length === 1) {
            return res.status(400).json({
              status: 400,
              message: "voter already exist"
            });
          }

          // add voter to the election voters table if voter is not present

          let addToElectionVotersTableQuery = "INSERT INTO `election_voters` (`election_uuid`, `voter_uuid`, `created_at`) VALUES(?, ?, NOW())";
          let addToElectionVotersTableQueryResult;
          try{
            [addToElectionVotersTableQueryResult] = await db.execute(addToElectionVotersTableQuery, [ electionUUID, voter_uuid ]);
          }catch(error){
            console.log('SQL-Error: '+error);
            sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+addToElectionVotersTableQuery);
            return res.status(500).json({
              status: 500,
              message: 'Could not connect to server..'
            });
          }

        // get voters

        let getVotersQuery = "SELECT * FROM voters INNER JOIN election_voters WHERE election_voters.election_uuid = ? AND election_voters.voter_uuid = voters.voter_uuid";
        let getVotersQueryResult;
        try{
          [getVotersQueryResult] = await db.execute(getVotersQuery, [ electionUUID ]);
        }catch(error){
          console.log('SQL-Error: '+error);
          sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+getVotersQuery);
          return res.status(500).json({
            status: 500,
            message: 'Could not connect to server..'
          });
        }
    
        return res.status(200).json({
          status: 200,
          message: "worked",
          voter_obj: {
            list: getVotersQueryResult
          },
        });

        }

        // add voter to the voters table if voter
        let newVoterUUID = uuidv5(voterEmail, uuidv4());
        let voterName = trim(req.body.voterName);
        let voterPhoneNumber = trim(req.body.voterPhoneNumber);

        let addToVotersTableQuery = "INSERT INTO `voters` (`voter_uuid`, `fullname`, `email`, `phone_number`, `created_at`) VALUES(?, ?, ?, ?, NOW())";
        let addToVotersTableQueryResult;
        try{
          [addToVotersTableQueryResult] = await db.execute(addToVotersTableQuery, [ newVoterUUID, voterName, voterEmail, voterPhoneNumber ]);
        }catch(error){
          console.log('SQL-Error: '+error);
          sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+addToVotersTableQuery);
          return res.status(500).json({
            status: 500,
            message: 'Could not connect to server..'
          });
        }

        // add voter to the election voters table

        let addNewToElectionVotersTableQuery = "INSERT INTO `election_voters` (`election_uuid`, `voter_uuid`, `created_at`) VALUES(?, ?, NOW())";
        let addNewToElectionVotersTableQueryResult;
        try{
          [addNewToElectionVotersTableQueryResult] = await db.execute(addNewToElectionVotersTableQuery, [ electionUUID, newVoterUUID ]);
        }catch(error){
          console.log('SQL-Error: '+error);
          sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+addNewToElectionVotersTableQuery);
          return res.status(500).json({
            status: 500,
            message: 'Could not connect to server..'
          });
        }

        // get voters

        let getVotersQuery = "SELECT * FROM voters INNER JOIN election_voters WHERE election_voters.election_uuid = ? AND election_voters.voter_uuid = voters.voter_uuid";
        let getVotersQueryResult;
        try{
          [getVotersQueryResult] = await db.execute(getVotersQuery, [ electionUUID ]);
        }catch(error){
          console.log('SQL-Error: '+error);
          sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+getVotersQuery);
          return res.status(500).json({
            status: 500,
            message: 'Could not connect to server..'
          });
        }
    
        return res.status(200).json({
          status: 200,
          message: "worked",
          voter_obj: {
            list: getVotersQueryResult
          },
        });
    
      });
      // add voters end

      // delete ballot start
      app.post(PREFIX+'/delete-ballot', sessionChecker, async (req, res) => {
        const uuid = req.uuid;
        let ballotUUID = trim(req.body.ballot);
        let electionUUID = trim(req.body.election);
        console.log(ballotUUID);
        console.log(electionUUID);

        let checkElectionUUIDQuery = "SELECT * FROM elections WHERE `election_uuid` = ? AND `created_by` = ?";
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
            message: "Invalid ballot information"
          });
        }
    
        let deleteBallotQuery = "DELETE FROM `ballots` WHERE `ballot_uuid` = ? AND `election_uuid` = ?";
        let deleteBallot;
        try{
          [deleteBallot] = await db.execute(deleteBallotQuery, [ ballotUUID, electionUUID ]);
        }catch(error){
          console.log('SQL-Error: '+error);
          sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+deleteBallotQuery);
          return res.status(500).json({
            status: 500,
            message: 'Could not connect to server'
          });
        }
    
        if (deleteBallot.length === 0) {
          return res.status(400).json({
            status: 400,
            message: "Invalid ballot information"
          });
        }

        let getBallotsQuery = "SELECT * FROM ballots WHERE `election_uuid` = ? ORDER BY `name` ASC";
        let getBallots;
        try{
          [getBallots] = await db.execute(getBallotsQuery, [ electionUUID ]);
        }catch(error){
          console.log('SQL-Error: '+error);
          sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+getBallotsQuery);
          return res.status(500).json({
            status: 500,
            message: 'Could not connect to server'
          });
        }
    
        if (getBallots.length === 0) {
          return res.status(200).json({
            status: 200,
            message: "no ballot found",
            data: []
          });
        }
    
        return res.status(200).json({
          status: 200,
          message: "worked",
          data: getBallots
        });
    
      });
      // delete ballot end
  
      // insert information start
      app.post(PREFIX+'/information', sessionChecker, async (req, res) => {

        const uuid = req.uuid;
        let electionIcon;

        

        electionIconUpload(req, res, async function (err) {
          if (err) {
            return res.status(400).json({
              status: 400,
              message: "Election icon upload error",
              errors: {
                title: "Image Upload Error",
                detail: err.message,
                error: err,
              },
            });
          }

          let electionUUID = req.body.electionUUID;

          if (!req.file) {
            let checkElectionIconQuery = "SELECT `id`, `icon` FROM elections WHERE `election_uuid` = ? AND `created_by` = ?";
            let checkElectionIcon;
            try{
              [checkElectionIcon] = await db.execute(checkElectionIconQuery, [ electionUUID, uuid ]);
            }catch(error){
              console.log('SQL-Error: '+error);
              sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+checkElectionIconQuery);
              return res.status(500).json({
                status: 500,
                message: 'Could not connect to server'
              });
            }

            if (checkElectionIcon.length === 0) {
              return res.status(400).json({
                status: 400,
                message: "Invalid election information"
              });
            }

            electionIcon = null;
            if(checkElectionIcon[0].icon !== null){
              electionIcon = checkElectionIcon[0].icon;
            }

          }else{
            electionIcon = req.file.location;
          }
          
          
          let name = req.body.name;
          let organization_name = req.body.organization_name;
          let start_time = req.body.start_time;
          let end_time = req.body.end_time;
          let declaration = req.body.declaration;
          let declarationStatus;
          if(declaration == "show"){
            declarationStatus = '1';
          }
          else{
            declarationStatus = '0';
          }

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

          if(start_time.length === 0 || end_time.length === 0){
            errorCount++;
            errorInfo.duration = "Enter election duration";
          }

          let server_start_time = moment(start_time).format("YYYY-MM-DD HH:mm:ss");
          let server_end_time = moment(end_time).format("YYYY-MM-DD HH:mm:ss");
          let currentTime = moment().format("YYYY-MM-DD HH:mm:ss");
          // check to make sure dates are not in the past

          if(moment(server_start_time).isBefore(currentTime) || moment(server_end_time).isBefore(server_start_time)){
            errorCount++;
            errorInfo.duration = "Election start and end time is invalid";
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
              message: "Invalid election information"
            });
          }
      
          let checkElectionNameQuery = "SELECT `id` FROM `elections` WHERE `name` = ? AND `created_by` = ? AND `election_uuid` != ? ";
          let checkElectionName;
          try{
            [checkElectionName] = await db.execute(checkElectionNameQuery, [ name, uuid, electionUUID ]);
          }catch(error){
            console.log('SQL-Error: '+error);
            sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+checkElectionNameQuery);
            return res.status(500).json({
              status: 500,
              message: 'Could not connect to server'
            });
          }

          let errorMessage = "Error: Sorry, failed to update election information";
      
          if (checkElectionName.length === 1) {
            errorCount++;
            errorInfo.name = "You already have an election with the same name";
          }

          if(errorCount > 0){
            return res.status(400).json({
              status: 400,
              message: errorMessage,
              errors: errorInfo
            });
          }
      
          let updateInformationElectionQuery = "UPDATE elections SET `icon` = ?, `name` = ?, `organization_name` = ?, `start_time` = ?, `end_time` = ?, `server_start_time` = ?, `server_end_time` = ?, `show_result` = ?, `information_status` = '1'  WHERE `election_uuid` = ? AND `created_by` = ? ";
          let checkUpdateInformationElectionQuery;
          try{
            [checkUpdateInformationElectionQuery] = await db.execute(updateInformationElectionQuery, [ electionIcon, name, organization_name, start_time, end_time, server_start_time, server_end_time, declarationStatus, electionUUID, uuid ]);
          }catch(error){
            console.log('SQL-Error: '+error);
            sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+updateInformationElectionQuery);
            return res.status(500).json({
              status: 500,
              message: 'Could not connect to server..'
            });
          }
          
          return res.status(200).json({
            status: 200,
            message: "worked",
          });

        });

      });
  
      // insert information end

      // add ballot start
      app.post(PREFIX+'/add-ballot', sessionChecker, async (req, res) => {

        const uuid = req.uuid;
        let ballotIcon;

        ballotIconUpload(req, res, async function (err) {
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

          if (!req.file) {
            ballotIcon = null;
          }else{
            ballotIcon = req.file.location;
          }

          let electionUUID = req.body.electionUUID;
          let ballotName = req.body.ballotName;
          let ballotDescription = req.body.ballotDescription;
          let ballotPosition = 1; //req.body.ballotPosition;
          let ballotUUID = uuidv5(ballotName, uuidv4());

          let errorInfo = {}
          let errorCount = 0;

          if(ballotName.length === 0){
            errorCount++;
            errorInfo.ballotName = "Enter ballot name";
          }
      
          if(ballotDescription.length === 0){
            errorCount++;
            errorInfo.ballotDescription = "Enter ballot description";
          }

          if(ballotPosition.length === 0){
            errorCount++;
            errorInfo.ballotPosition = "Enter ballot position";
          }

          let checkBallotElectionUUIDQuery = "SELECT `id`, `name`, `organization_name` FROM elections WHERE `election_uuid` = ? AND `created_by` = ?";
          let checkBallotElectionUUID;
          try{
            [checkBallotElectionUUID] = await db.execute(checkBallotElectionUUIDQuery, [ electionUUID, uuid ]);
          }catch(error){
            console.log('SQL-Error: '+error);
            sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+checkBallotElectionUUIDQuery);
            return res.status(500).json({
              status: 500,
              message: 'Could not connect to server'
            });
          }

          if (checkBallotElectionUUID.length === 0) {
            return res.status(400).json({
              status: 400,
              message: "Invalid election ID"
            });
          }

          let checkBallotNameUUIDQuery = "SELECT `id`, `name`, `election_uuid` FROM ballots WHERE `election_uuid` = ? AND `name` = ?";
          let checkBallotNameUUID;
          try{
            [checkBallotNameUUID] = await db.execute(checkBallotNameUUIDQuery, [ electionUUID, ballotName ]);
          }catch(error){
            console.log('SQL-Error: '+error);
            sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+checkBallotNameUUIDQuery);
            return res.status(500).json({
              status: 500,
              message: 'Could not connect to server'
            });
          }

          if (checkBallotNameUUID.length === 1) {
            return res.status(400).json({
              status: 400,
              message: "Ballot name already exist"
            });
          }

          let errorMessage = "Error: Sorry, failed to add ballot";

          if(errorCount > 0){
            return res.status(400).json({
              status: 400,
              message: errorMessage,
              errors: errorInfo
            });
          }
      
          let postBallotQuery = "INSERT INTO `ballots` (`ballot_uuid`, `election_uuid`, `slot_number`, `name`, `description`, `avatar`, `created_at`) VALUES(?, ?, ?, ?, ?, ?, NOW())";
          let checkBallotQuery;
          try{
            [checkBallotQuery] = await db.execute(postBallotQuery, [ ballotUUID, electionUUID, ballotPosition, ballotName, ballotDescription, ballotIcon ]);
          }catch(error){
            console.log('SQL-Error: '+error);
            sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+postBallotQuery);
            return res.status(500).json({
              status: 500,
              message: 'Could not connect to server.'
            });
          }
      
          // let alertMessage = `ELECTION (Draft):\n Ballot Name: ${ballotName} \n Ballot Description: ${ballotDescription}.`
          // sendMessageToTelegram('alert', alertMessage);

          let electionBallotQuery = "SELECT * FROM ballots WHERE `election_uuid` = ? ORDER BY `name` ASC";
          let electionBallot;
          try{
            [electionBallot] = await db.execute(electionBallotQuery, [ electionUUID ]);
          }catch(error){
            console.log('SQL-Error: '+error);
            sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+electionBallotQuery);
            return res.status(500).json({
              status: 500,
              message: 'Could not connect to server'
            });
          }
      
          if (electionBallot.length === 0) {
            return res.status(200).json({
              status: 200,
              message: "No ballots found",
              data: []
            });
          }
      
          return res.status(200).json({
            status: 200,
            message: "worked",
            data: electionBallot
          });

        });

      });
  
      // add ballot end

      // edit ballot start
      app.post(PREFIX+'/edit-ballot', sessionChecker, async (req, res) => {

        const uuid = req.uuid;
        let ballotIcon;

        ballotIconUpload(req, res, async function (err) {
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

          let electionUUID = req.body.electionUUID;

          if (!req.file) {
            let checkBallotIconQuery = "SELECT `id`, `avatar` FROM `ballots` WHERE `election_uuid` = ?";
            let checkBallotIcon;
            try{
              [checkBallotIcon] = await db.execute(checkBallotIconQuery, [ electionUUID ]);
            }catch(error){
              console.log('SQL-Error: '+error);
              sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+checkBallotIconQuery);
              return res.status(500).json({
                status: 500,
                message: 'Could not connect to server'
              });
            }

            if (checkBallotIcon.length === 0) {
              return res.status(400).json({
                status: 400,
                message: "Invalid ballot information"
              });
            }

            ballotIcon = null;
            if(checkBallotIcon[0].avatar !== null){
              ballotIcon = checkBallotIcon[0].avatar;
            }

          }else{
            ballotIcon = req.file.location;
          }

          let ballotName = req.body.ballotName;
          let ballotDescription = req.body.ballotDescription;
          let ballotPosition = 1; //req.body.ballotPosition;
          let ballotUUID = req.body.ballotUUID;

          let errorInfo = {}
          let errorCount = 0;

          if(ballotName.length === 0){
            errorCount++;
            errorInfo.ballotName = "Enter ballot name";
          }
      
          if(ballotDescription.length === 0){
            errorCount++;
            errorInfo.ballotDescription = "Enter ballot description";
          }

          if(ballotPosition.length === 0){
            errorCount++;
            errorInfo.ballotPosition = "Enter ballot position";
          }

          let checkBallotElectionUUIDQuery = "SELECT `id`, `name`, `organization_name` FROM elections WHERE `election_uuid` = ? AND `created_by` = ?";
          let checkBallotElectionUUID;
          try{
            [checkBallotElectionUUID] = await db.execute(checkBallotElectionUUIDQuery, [ electionUUID, uuid ]);
          }catch(error){
            console.log('SQL-Error: '+error);
            sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+checkBallotElectionUUIDQuery);
            return res.status(500).json({
              status: 500,
              message: 'Could not connect to server'
            });
          }

          if (checkBallotElectionUUID.length === 0) {
            return res.status(400).json({
              status: 400,
              message: "Invalid election information"
            });
          }

          let checkBallotNameUUIDQuery = "SELECT `id`, `name`, `election_uuid` FROM ballots WHERE `election_uuid` = ? AND `name` = ? AND `ballot_uuid` != ? ";
          let checkBallotNameUUID;
          try{
            [checkBallotNameUUID] = await db.execute(checkBallotNameUUIDQuery, [ electionUUID, ballotName, ballotUUID ]);
          }catch(error){
            console.log('SQL-Error: '+error);
            sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+checkBallotNameUUIDQuery);
            return res.status(500).json({
              status: 500,
              message: 'Could not connect to server'
            });
          }

          if (checkBallotNameUUID.length > 0) {
            return res.status(400).json({
              status: 400,
              message: "Ballot name already exist"
            });
          }

          let errorMessage = "Error: Sorry, failed to update ballot";

          if(errorCount > 0){
            return res.status(400).json({
              status: 400,
              message: errorMessage,
              errors: errorInfo
            });
          }
      
          let postBallotQuery = "UPDATE `ballots` SET `slot_number` = ?, `name` = ?, `description` = ?, `avatar` = ? WHERE `ballot_uuid` = ? ";
          let checkBallotQuery;
          try{
            [checkBallotQuery] = await db.execute(postBallotQuery, [ ballotPosition, ballotName, ballotDescription, ballotIcon, ballotUUID ]);
          }catch(error){
            console.log('SQL-Error: '+error);
            sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+postBallotQuery);
            return res.status(500).json({
              status: 500,
              message: 'Could not connect to server..'
            });
          }

          let makeGetBallotsQuery = "SELECT * FROM ballots WHERE `election_uuid` = ? ORDER BY `name` ASC";
          let checGetBallotsQuery;
          try{
            [checGetBallotsQuery] = await db.execute(makeGetBallotsQuery, [ electionUUID ]);
          }catch(error){
            console.log('SQL-Error: '+error);
            sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+makeGetBallotsQuery);
            return res.status(500).json({
              status: 500,
              message: 'Could not connect to server'
            });
          }
      
          if (checGetBallotsQuery.length === 0) {
            return res.status(400).json({
              status: 400,
              message: "empty"
            });
          }
      
          return res.status(200).json({
            status: 200,
            message: "worked",
            ballot_obj: {
              list: checGetBallotsQuery
            },
          });

        });

      });
  
      // edit ballot end
}

module.exports = {
  routes
}