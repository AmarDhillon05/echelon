const { Schema, model } = require("mongoose");

const submissionSchema = new Schema({
  // Leaderboard it is assocated with (Leaderboard ID)
  leaderboard: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  elo: {
    type: Number,
    required: true,
    default: 100,
  },
  rank: {
    type: Number,
    required: true,
  },
  data: {
    type: Object,
    required: false,
    default: {}, 
    //This is what would go into pinecone alongside description, might be mandatory based on what's specified by host
    //also required
    //formatted the same way as "required" in leaderboard.model.js
  },
  // Only for submissions that are user-linked (like for competitions) (List of user IDs)
  contributors: {
    type: Array,
    required: false,
  },
});

const Submission = model("submissions", submissionSchema);

module.exports = Submission;
