const API_CONSTANTS = {
  Constants: {
    OBALLOT_URL:  process.env.API_MODE === 'production' ? "https://oballot.com" : "http://localhost:7070",
    CLIENT_APP_URL:  process.env.API_MODE === 'production' ? "https://app.oballot.com" : "http://localhost:3000",
  }
}

module.exports = API_CONSTANTS.Constants;
