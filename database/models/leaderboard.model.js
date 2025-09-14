//const { Schema, model } = require("mongoose");
import {Schema, model} from "mongoose"

const leaderboardSchema = new Schema({

  // User ID that owns the leaderboard 
  host: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String, 
    required: true,
    default: "No Description Provided"
  },
  coverPhoto : {
    type : String,
    required: false //This is a encoding
  },
  required: {
    type: Array,
    required: true,
    default: [] //Would include type info, a//rray of objects like {"field1" : "text"}
  },
  submissions: {
    type: Object,
    required: false,
    default: {} //To be sorted easily for extraction, is {id : {elo: 0, rank: 0}} (not all info to keep things light)
  },
  locked: {
    type: Boolean, 
    required: false,
    default: false //Locked - cannot be submitted to
  }
});

const Leaderboard = model("leaderboards", leaderboardSchema);

export default Leaderboard
//module.exports = Leaderboard;
