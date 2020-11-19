const bcrypt = require("bcryptjs");
const axios = require("axios");
const { v4: uuidv4 } = require('uuid');


const validatePhoneNumber = phone_number => {
  // const regex = /^[+]*[(]{0,1}[0-9]{1,3}[)]{0,1}[-\s\./0-9]*$/g;
  const regex = /^\+[1-9]\d{1,14}$/;

  return regex.test(trim(phone_number));
};

const trim = text => {
  if (text !== undefined && text !== null) {
    return text.trim();
  }
  return null;
};

const validatePassword = password => {
  let trimPassword = trim(password);
  return trimPassword.length < 8? false:true;
};

const checkPassword = (password, hash) => {
  return bcrypt.compareSync(password, hash);
};

const hashPassword = password => {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
};

const validateWholeNumber = quantity => {
  let regex = /^[1-9]\d*$/;
  return regex.test(trim(quantity));
}

const validateEmail = email => {
  let regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return regex.test(String(trim(email)).toLowerCase());
};

const sendMessageToTelegram = (type, message) => {
  let chatID;
  switch (type) {
    case 'bug':
    chatID = '-424645018';
    break;

    case 'registration':
    chatID = '-402509811';
    break;

    case 'stats':
    chatID = '-437417153';
    break;

    case 'elections':
    chatID = '-452088794';
    break
  
    default:
    chatID = '-470792640';
    break;
  }

  axios.get("https://api.telegram.org/bot" +
    kusBotToken +
    "/sendMessage?chat_id=" +
    chatID +
    "&text=" +
    message +
    ""
  ).then((data) => {
    console.log("Telegram message sent")
  },
    function (err) {
      console.log("Error sending telegram message")
      console.dir(err)
    }
  );

}


module.exports = {
  validatePhoneNumber,
  validatePassword,
  checkPassword,
  hashPassword,
  validateWholeNumber,
  validateEmail,
  sendMessageToTelegram,
  trim,
}