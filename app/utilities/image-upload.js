const aws = require("aws-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3");

const s3 = new aws.S3();

aws.config.update({
  secretAccessKey: process.env.S3_ACCESS_SECRET,
  accessKeyId: process.env.S3_ACCESS_KEY,
//   secretAccessKey: "AKIAJUAUSC42DM56KATA",
//   accessKeyId: "1+tI7NZGJdFxUBKaqos2QFQRiZ5c9r4wLObodLCZ",
  region: "eu-central-1",
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === "image/jpeg" || file.mimetype === "image/jpg" || file.mimetype === "image/png") {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type, only JPEG and PNG is allowed!"), false);
  }
};

const s3delete = (file) => {
  return new Promise((resolve, reject) => {
      s3.createBucket({
          Bucket: "oballot-election-icons"
      }, function () {
          s3.deleteObject({
            Bucket: "oballot-election-icons",
            Key: file
          }, function (err, data) {
              if (err) {
                console.log(err)
              }
              else{
                console.log(data)
              }
          });
      });
  });
};

const upload = multer({
  fileFilter,
  storage: multerS3({
    acl: "public-read",
    s3,
    bucket: "oballot-election-icons",
    metadata: function (req, file, cb) {
      cb(null, { fieldName: "TESTING_METADATA" });
    },
    key: function (req, file, cb) {
      cb(null, Date.now().toString());
    },
  }),
});

module.exports = {
  upload,
  s3delete
};