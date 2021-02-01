const API_CONSTANTS = {
  Constants: {
    OBALLOT_URL:  process.env.API_MODE === 'production' ? "https://analogapi.oballot.com" : "http://localhost:7770",
  }
}

module.exports = API_CONSTANTS.Constants;
