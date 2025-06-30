const mongoose = require("mongoose");

const connect = async () => {
  try {
    await mongoose.connect(process.env.DB_URI);
    console.log("Database is running!");
  } catch (e) {
    console.log("Error: " + e.message);
  }
};

module.exports = connect;
