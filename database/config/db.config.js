//const mongoose = require("mongoose");
import mongoose from "mongoose"

const connect = async () => {
  try {
    await mongoose.connect(process.env.DB_URI);
    console.log("Database is running!");
  } catch (e) {
    console.log("Error: " + e.message);
  }
};

export default connect
//module.exports = connect;
