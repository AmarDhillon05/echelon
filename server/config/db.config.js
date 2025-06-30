const mongoose = require("mongoose");

const connect = async () => {
  try {
    await mongoose.connect(process.env.DB_URI || "mongodb+srv://terp1:terp2@cluster0.pt7nh.mongodb.net/Echelon?retryWrites=true&w=majority&appName=Cluster0&ssl=true");
    console.log("Database is running!");
  } catch (e) {
    console.log("Error: " + e.message);
  }
};

module.exports = connect;