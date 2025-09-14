//const { Schema, model } =  require( "mongoose" );
import {Schema, model} from "mongoose"

const userSchema = new Schema({
  username: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    pattern: "^.+@.+$",
  },
  password: {
    type: String,
    required: true,
  },

  // Leaderboards that the user owns 
  leaderboardIds : {
    type: Array,
    required: false, 
    default: []
  },

  // Submissions that the user has givn to a set leaderboard  - these are ids btw
  submissions : {
    type: Array, 
    required: false,
    default: []
  }

  //Entries will be what you've submitted to be ranked, and will contain 
  //id infos that can be looked up in the database of ranked items
});

const User = model("users", userSchema);

export default User
//module.exports = User;