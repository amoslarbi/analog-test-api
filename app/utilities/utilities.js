const bcrypt = require("bcryptjs");
const axios = require("axios");
const { v4: uuidv4 } = require('uuid');
var postmark = require("postmark");
var fromEmail = "hello@oballot.com";
var productUrl = "https://analogteams.com";
var supportEmail = "hello@analogteams.com";
var productName = "Analog Teams";
var senderName = "Analog Teams";

// Send an email:
const client = new postmark.ServerClient(process.env.POSTMARK_API_KEY);

const sendRegistrationEmail = (to_email, name, code) => {
    client.sendEmailWithTemplate({
      "From": fromEmail,
      "To": to_email,
      "TemplateAlias": "accountActivationEmail-1",
      "TemplateModel": {
        "product_url": productUrl,
        "name": name,
        "code": code,
        "support_email": supportEmail,
        "sender_name": senderName,
        "product_name": productName,
        "company_name": productName,
      }
    });
}

const sendMovies = (email, image, title, vote_average, overview) => {
  client.sendEmailWithTemplate({
    "From": fromEmail,
    "To": email,
    "TemplateAlias": "movie",
    "TemplateModel": {
      "product_url": productUrl,
      "movie_image": image,
      "title": title,
      "overview": overview,
      "vote_average": vote_average,
      "support_email": supportEmail,
      "sender_name": senderName,
      "product_name": productName,
      "company_name": productName,
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

module.exports = {
  validatePhoneNumber,
  validatePassword,
  checkPassword,
  hashPassword,
  validateWholeNumber,
  validateEmail,
  trim,
  sendRegistrationEmail,
  sendMovies,
}