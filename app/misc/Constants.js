const Production = {
  Constants: {
      "API_BASE_URL": "",
  }
}

const Development = {
  Constants: {
    "API_BASE_URL": "http://localhost:3000",
  }
}

export default process.env.CLIENT_APP_MODE === 'production' ? Production.Constants : Development.Constants;