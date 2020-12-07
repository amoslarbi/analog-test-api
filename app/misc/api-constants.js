const API_CONSTANTS = {
  Constants: {
    VOTE_COST: {
      FREE_VOTERS_LIMIT: 25,
      GHANA_COST_PER_VOTE: 0.50,
      NIGERIA_COST_PER_VOTE: 50,
      COST_PER_VOTE: 0.50,
    },
    OBALLOT_URL:  process.env.API_MODE === 'production' ? "https://oballot.com" : "http://localhost:7070",
    CLIENT_APP_URL:  process.env.API_MODE === 'production' ? "https://app.oballot.com" : "http://localhost:3000",
  }
}

module.exports = API_CONSTANTS.Constants;
