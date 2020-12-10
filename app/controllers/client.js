const db = require('../database/connection');
const jwt = require('jsonwebtoken');
const { v4: uuidv4, v5: uuidv5 } = require('uuid');
const upload = require("../utilities/image-upload");
const singleUpload = upload.single("ballotIcon");
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
    show_result: getElection[0].show_result,
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

          let electionInfo = await getElectionCardInfo(election_uuid, uuid);
          if(electionInfo.status === 200){
            elections.push(electionInfo.data)
          }

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
        console.dir(req.body)
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
        // console.log(req);
        

        const uuid = req.uuid;
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
          console.dir(ballotIcon);
          return res.status(400).json({
            status: 400,
            message: "Invalid election ID"
          });
      
        });

      //   let electionUUID = req.body.electionUUID;
      //   console.log(electionUUID);
      //   let name = req.body.name;
      //   let organization_name = req.body.organization_name;
      //   let duration = req.body.duration;
      //   let declaration = req.body.declaration;
      //   let declarationStatus;
      //   if(declaration == "show"){
      //     declarationStatus = 1
      //   }
      //   else{
      //     declarationStatus = 0
      //   }

      //   // let getDuration = [];
      //   // getDuration = duration;
      //   // let start_time = getDuration[0];
      //   // let end_time = getDuration[1];

      //   // let durationKyiv = duration.split(' ');
      //   // // let start_time_day = durationKyiv[0].split(',');
      //   // let start_time_month = durationKyiv[1].split(',');
      //   // let start_time_day = durationKyiv[2].split(',');
      //   // let start_time_year = durationKyiv[3].split(',');
      //   // let start_time_time = durationKyiv[4].split(',');
      //   // let start_time = start_time_month + " " + start_time_day + " " + start_time_year + " " + start_time_time;

      //   // let end_time_month = durationKyiv[6].split(',');
      //   // let end_time_day = durationKyiv[7].split(',');
      //   // let end_time_year = durationKyiv[8].split(',');
      //   // let end_time_time = durationKyiv[9].split(',');
      //   // let end_time = end_time_month + " " + end_time_day + " " + end_time_year + " " + end_time_time;

      //   let errorInfo = {}
      //   let errorCount = 0;

      //   if(name.length === 0){
      //     errorCount++;
      //     errorInfo.name = "Enter election name";
      //   }
    
      //   if(organization_name.length === 0){
      //     errorCount++;
      //     errorInfo.organization_name = "Enter organization / group name";
      //   }

      //   if(duration.length === 0){
      //     errorCount++;
      //     errorInfo.duration = "Enter duration";
      //   }

      //   let checkInformationElectionUUIDQuery = "SELECT `id`, `name`, `organization_name` FROM elections WHERE `election_uuid` = ? AND `created_by` = ?";
      //   let checkInformationElectionUUID;
      //   try{
      //     [checkInformationElectionUUID] = await db.execute(checkInformationElectionUUIDQuery, [ electionUUID, uuid ]);
      //   }catch(error){
      //     console.log('SQL-Error: '+error);
      //     sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+checkInformationElectionUUIDQuery);
      //     return res.status(500).json({
      //       status: 500,
      //       message: 'Could not connect to server'
      //     });
      //   }

      //   if (checkInformationElectionUUID.length === 0) {
      //     return res.status(400).json({
      //       status: 400,
      //       message: "Invalid election ID"
      //     });
      //   }
    
      //   // let informationElectionNameQuery = "SELECT * FROM `elections` WHERE (`name` = ? AND `organization_name` = ?) AND `created_by` = ?  ";
      //   // let checkInformationElectionNameQuery;
      //   // try{
      //   //   [checkInformationElectionNameQuery] = await db.execute(informationElectionNameQuery, [ name, organization_name, uuid ]);
      //   // }catch(error){
      //   //   console.log('SQL-Error: '+error);
      //   //   sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+informationElectionNameQuery);
      //   //   return res.status(500).json({
      //   //     status: 500,
      //   //     message: 'Could not connect to server'
      //   //   });
      //   // }

      //   let errorMessage = "Error: Sorry, failed to create election";
    
      //   // if (checkInformationElectionNameQuery.length === 1) {
      //   //   errorCount++;
      //   //   errorMessage = "You already have an election with the same name and organization/group name.";
      //   // }

      //   if(errorCount > 0){
      //     return res.status(400).json({
      //       status: 400,
      //       message: errorMessage,
      //       errors: errorInfo
      //     });
      //   }
    
      //   let updateInformationElectionQuery = "UPDATE elections SET `icon` = ?, `name` = ?, `organization_name` = ?, `start_time` = ?, `end_time` = ?, `show_result` = ?";
      //   let checkUpdateInformationElectionQuery;
      //   try{
      //     [checkUpdateInformationElectionQuery] = await db.execute(updateInformationElectionQuery, [ ballotIcon, name, organization_name, start_time, end_time, declarationStatus ]);
      //   }catch(error){
      //     console.log('SQL-Error: '+error);
      //     sendMessageToTelegram('bug', 'SQL-Error: '+error+'--'+updateInformationElectionQuery);
      //     return res.status(500).json({
      //       status: 500,
      //       message: 'Could not connect to server'
      //     });
      //   }
    
      //   let alertMessage = `ELECTION (Draft):\n Election Name: ${name} \n Organization Name: ${organization_name}.`
      //   sendMessageToTelegram('alert', alertMessage);
      //   return res.status(200).json({
      //     status: 200,
      //     message: "worked",
      //   });

      });
  
      // insert information end
}

module.exports = {
  routes
}