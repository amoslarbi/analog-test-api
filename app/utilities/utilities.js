const bcrypt = require("bcryptjs");
const axios = require("axios");
const { v4: uuidv4 } = require('uuid');
var postmark = require("postmark");
var fromEmail = "hello@oballot.com";
var productUrl = "https://oballot.com";
var supportEmail = "hello@oballot.com";
var productName = "oBallot";
var companyAddress = "Amrahia, R40, Adenta-Dodowa Road, Accra, Ghana";
var senderName = "oBallot Team";

// Send an email:
const client = new postmark.ServerClient(process.env.POSTMARK_API_KEY);

const sendRegistrationEmail = (to_email, name, link) => {
    client.sendEmailWithTemplate({
      "From": fromEmail,
      "To": to_email,
      "TemplateAlias": "accountActivationEmail",
      "TemplateModel": {
        "product_url": productUrl,
        "name": name,
        "action_url": link,
        "support_email": supportEmail,
        "sender_name": senderName,
        "product_name": productName,
        "company_name": productName,
        "company_address": companyAddress
      }
    });
}

const sendWelcomeEmail = (to_email, name, link) => {
  client.sendEmailWithTemplate({
    "From": fromEmail,
    "To": to_email,
    "TemplateAlias": "welcomeEmail",
    "TemplateModel": {
      "product_url": productUrl,
      "name": name,
      "action_url": link,
      "support_email": supportEmail,
      "sender_name": senderName,
      "product_name": productName,
      "company_name": productName,
      "company_address": companyAddress
    }
  });
}

const sendPasswordResetEmail = (to_email, name, link) => {
  client.sendEmailWithTemplate({
    "From": fromEmail,
    "To": to_email,
    "TemplateAlias": "passwordResetEmail",
    "TemplateModel": {
      "product_url": productUrl,
      "name": name,
      "product_name": productName,
      "action_url": link,
      "support_url": productUrl,
      "company_name": productName,
      "company_address": companyAddress
    }
  });
}

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

const checkPassword = (password, hashedPassword) => {
  return bcrypt.compareSync(password, hashedPassword);
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
    chatID = '-377867783';
    break;

    case 'alert':
    chatID = '-299530326';
    break;
  
    default:
    chatID = '-384456761';
    break;
  }

  axios.get("https://api.telegram.org/bot" +
    process.env.TELEGRAM_BOT_API_KEY+
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
  sendRegistrationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail
}