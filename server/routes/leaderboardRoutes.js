require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const Ld = require("../models/leaderboard.model.js");
const Sub = require("../models/submission.model.js");
const User = require("../models/user.model.js");
const { Pinecone } = require("@pinecone-database/pinecone");
const axios = require("axios")



const embed_url = "http://3.93.168.118:8000"
//const embed_url = "http://localhost:5000"

const app = express.Router();


// For sending to api
function removeDataUriPrefix(b64String) {
  if (b64String.startsWith("data:")) {
    return b64String.split(",")[1];
  }
  return b64String;
}




// Calling embed API
async function embed(input, req, size = 1024) {

  //Properly formatting the data, then making request
  let json_body = []
  req.forEach(r => {
    let data = {
      "data" : removeDataUriPrefix(input[r.name]),
      "type" : r.type
    }
    
    json_body.push(data)
  })

  
  const request = await axios.post(`${embed_url}/embed_mult`, { "data" : json_body })
  const embeddings = request.data.embeddings
 
  return embeddings
}

// Fail-case dummy embed
function dummyEmbed() {
  const embedding = [];
  for (let i = 0; i < 1024; i++) {
    embedding.push(Math.random() * 2 - 1); // random float in [-1, 1]
  }
  return embedding;
}

//y





// Initialize Pinecone client and central index
const pc = new Pinecone({
  apiKey: process.env.PC_KEY,
});

const index = pc.Index("echelon")

require("../config/db.config")();

app.get("/", (req, res) => {
  res.send("Hello from the leaderboard API!");
});

// Clear all leaderboards and submissions (commented out by default)
async function clearDb() {
  await Ld.deleteMany({});
  await Sub.deleteMany({});
}
//clearDb();



//In order to allow titles as "sluggified" (required for dbs)
function encodeString(str) {
  return Buffer.from(str, 'utf-8').toString('hex').replace(/(..)/g, '$1-').slice(0, -1);
}

function decodeString(encoded) {
  if(!encoded){
    encoded = ""
  }
  const hex = encoded.replace(/-/g, '');
  return Buffer.from(hex, 'hex').toString('utf-8');
}







app.post("/createLeaderboard", async (req, res) => {
  try {
    let { name, host, description, required } = req.body;

    if (!name || !host) {
      return res.status(400).json({
        error: "Must fill out all fields! Requires appropriate name and host.",
      });
    }

    name = encodeString(name) 

    // Check for duplicate leaderboard name in MongoDB
    const existingLd = await Ld.findOne({ name });
    if (existingLd) {
      return res
        .status(409)
        .json({ error: "Leaderboard name already taken, pick a new one." });
    }


    // Create leaderboard document in MongoDB
    const ld = await Ld.create({ name, host, description, required });


    // Add leaderboard ID to user's leaderboardIds array
    let user = await User.find({ username: host });
    if (user) {
      user = user[0]
      const existingIds = user.leaderboardIds || [];
      await User.findOneAndUpdate({ username: host }, {
        leaderboardIds: [...existingIds, ld._id],
      });
      user['leaderboardIds'] = [...existingIds, ld._id] //For returning user in response
    }

    res.status(201).json({ leaderboard: ld, success: true, user });
  } catch (e) {
    // Cleanup on error
    let { name, host } = req.body;

    name = encodeString(name)

    if (name && host) {
      await Ld.findOneAndDelete({ name, host });
    }

    res.status(500).json({ error: e.message });
  }
});







app.post("/createSubmission", async (req, res) => {
  try {
    let { name, leaderboard, contributors, data } = req.body;

    if (!name || !leaderboard || !contributors || !data) {
      return res.status(400).json({
        error:
          "Must fill out all fields! Requires name, target leaderboard, one or more contributor, and other required fields.",
      });
    }

    name = encodeString(name)
    leaderboard = encodeString(leaderboard)
    const rawNameAndLd = {name, leaderboard}

    // Check for duplicate submission name in this leaderboard
    const existingSub = await Sub.findOne({ name, leaderboard });
    if (existingSub) {
      return res.status(409).json({
        error: "Submission with this name already exists for this leaderboard.",
      });
    }

    // Check if leaderboard exists
    let ld = await Ld.findOne({ name: leaderboard });
    if (!ld) {
      return res.status(404).json({ error: "This leaderboard doesn't exist!" });
    }

    if (ld.locked) {
      return res.status(403).json({ error: "This leaderboard is locked for submissions." });
    }

    // Validate required fields
    const mandatoryKeys = ld.required.map((x) => Object.keys(x)[0]);
    const dataKeys = Object.keys(data);
    for (const key of mandatoryKeys) {
      if (!dataKeys.includes(key)) {
        return res.status(400).json({
          error: `Must fill out all required fields: ${mandatoryKeys.join(", ")}`,
        });
      }
    }

    // Prepare metadata: flatten data and add elo, rank
    const newSublist = ld.submissions || {};
    const rank = Object.keys(newSublist).length + 1;
    const metadata = { ...data, elo: 100, rank, leaderboard };
    delete metadata.name; // remove name if present

    // Update leaderboard submissions and save
    newSublist[name] = { elo: 100, rank };
    await Ld.updateOne({ _id: ld._id }, { $set: { submissions: newSublist } });

    // Create submission document in MongoDB
    const entry = { ...req.body, elo: 100, rank, name };
    const sub = await Sub.create(entry);

    // Add submission ID to each contributor's submissions list
    for (const contributor of sub.contributors) {
      const user = await User.findOne({ username: contributor });
      if (user) {
        user.submissions = user.submissions || [];
        user.submissions.push(sub._id);
        await User.findByIdAndUpdate(user._id, { submissions: user.submissions });
      }
    }

    res.status(201).json({ submission: sub, success: true });




    //Last step should be upserting into pinecone and using dummy embeddings in case of failure
    //Done after return because it's non-critical
    //id is encoded JSON of name and leaderboard to make it unique
    try {
      await index.upsert([
        {
          id: encodeString(JSON.stringify(rawNameAndLd)),
          values: await embed(metadata, ld.required),
          metadata: { rank, leaderboard, elo: 100 },
        },
      ]);
    } catch (e) {
      await index.upsert([
        {
          id: encodeString(JSON.stringify(rawNameAndLd)),
          values: dummyEmbed(),
          metadata: { rank, leaderboard, elo: 100 },
        },
      ]);
    }

  } catch (e) {
    console.log(e)

    // On error, attempt cleanup
    try {
      let { name, leaderboard } = req.body;

      name = encodeString(name)
      leaderboard = encodeString(leaderboard)
      const rawNameAndLd = { name, leaderboard }

      await index.deleteOne(encodeString(JSON.stringify(rawNameAndLd)))

      const ld = await Ld.findOne({ name: leaderboard });
      if (ld) {
        const subList = ld.submissions || {};
        if (name in subList) delete subList[name];
        await Ld.updateOne({ _id: ld._id }, { $set: { submissions: subList } });
      }

      const sub = await Sub.findOne({ name: req.body.name, leaderboard: req.body.leaderboard });
      if (sub) {
        for (const contributor of sub.contributors) {
          const user = await User.findOne({ username: contributor });
          if (user) {
            user.submissions = user.submissions.filter((id) => id.toString() !== sub._id.toString());
            await User.findByIdAndUpdate(user._id, { submissions: user.submissions });
          }
        }
        await Sub.findByIdAndDelete(sub._id);
      }
    } catch {
      // Swallow cleanup errors
    }

    res.status(500).json({ error: e.message });
  }
});









//Poll + Rank
//TODO - put this in a separate route

app.post("/poll", async (req, res) => {

    let { leaderboard, targetElo, previousPicks } = req.body;
    if (!leaderboard) {
        return res.status(500).json({ error: "Requires leaderboard to pick from" });
    }

    leaderboard = encodeString(leaderboard);

    if (previousPicks) {
        previousPicks.reverse();
        previousPicks = previousPicks.map(x => encodeString(x));
    }

    const ld = await Ld.find({ "name": leaderboard });
    if (!ld || ld.length === 0) {
        return res.status(404).json({ error: "Leaderboard not found" });
    }

    const allSubmissions = { ...ld[0].submissions }; // Clone so we can safely delete keys
    if (Object.keys(allSubmissions).length < 2) {
        return res.status(500).json({ error: "This leaderboard doesn't have enough submissions for ranked play" });
    }

    function useTargetElo(allSubmissions) {
        let elos = Object.keys(allSubmissions).map(x => allSubmissions[x].elo);
        let bestMatchIdx = elos
            .map(x => Math.abs(x - targetElo))
            .reduce((maxIdx, curr, idx, array) => curr > array[maxIdx] ? idx : maxIdx, 0);
        return Object.keys(allSubmissions)[bestMatchIdx];
    }

    

    let firstPicks = [];
    while (true) {
        if (Object.keys(allSubmissions).length === 0) break;

        let choice = useTargetElo(allSubmissions);
        firstPicks.push(choice);
        if (!previousPicks || !previousPicks.includes(choice)) break;

        delete allSubmissions[choice];
    }


    const firstSubName = firstPicks.at(-1);
    const firstSub = await Sub.find({ "name": firstSubName });
    if (!firstSub || firstSub.length === 0) {
        return res.status(404).json({ error: "First submission not found" });
    }


    const fetchId = encodeString(JSON.stringify({
      name: firstSubName,
      leaderboard: leaderboard 
    }));

  
    const pineconeFetch = await index.fetch([fetchId]);
    const embedding = pineconeFetch.records[fetchId].values
   
    // Pinecone query for similarity
    let args = {
        topK: 5,
        vector: embedding,
        includeMetadata: true,
        filter: { 'leaderboard': { '$eq': leaderboard } } //ld is encoded here
    };

    if (targetElo) {
        args.filter.elo = { "$gte": targetElo - 200, "$lte": targetElo + 200 };
    }

    let matches = (await index.query(args)).matches.filter(x => x.id !== fetchId);


    let secondSub = null;
    let score = null;

    for (const sub of matches) {
        const subName = decodeString(JSON.parse(decodeString(sub.id)).name);
        if (!previousPicks || !previousPicks.includes(subName)) {
            secondSub = subName;
            score = sub.score;
            break;
        }
    }//

    if (secondSub == null && matches.length > 0) {
        secondSub = decodeString(JSON.parse(decodeString(matches[0].id)).name);
        score = matches[0].score;
    }

    if (!secondSub) {
        return res.status(404).json({ error: "No valid second submission found" });
    }

    
    // Re-query second submission from MongoDB using its name and leaderboard
    const secondSubData = (await Sub.find({
      "name": encodeString(secondSub),
      "leaderboard": decodeString(leaderboard)
    }))[0];

    if (!secondSubData) {
        return res.status(404).json({ error: "Second submission not found in DB" });
    }

    // Decode for return
    firstSub[0].name = decodeString(firstSub[0].name);
    secondSubData.name = decodeString(secondSubData.name);

    return res.status(200).json({ choice1: firstSub[0], choice2: secondSubData, score });

});



app.post("/rank", async (req, res) => {
  let { winner, loser, similarity } = req.body; // Submission ids
  if (!winner || !loser) {
    return res.status(500).json({ error: "Must have a winner and a loser ID, as well as their similarity from /poll" });
  }

  // Grabbing winner and loser
  winner = await Sub.findById(winner);
  loser = await Sub.findById(loser);

  if (!winner || !loser) {
    return res.status(404).json({ error: "Can't find both parties" });
  }

  const ld = (await Ld.find({ name: encodeString(winner.leaderboard) }))[0];

  // Calculating elo change, softening it for lower similarities
  let eloWinner = winner.elo >= 100 ? winner.elo : 100; // Since minimum is 100
  let eloLoser = loser.elo >= 100 ? loser.elo : 100;
  const e = 1 / (1 + 10 ** ((winner.elo - loser.elo) / 400));
  const k = 40;
  eloWinner += k * similarity * e;
  eloLoser -= k * similarity * e;
  eloLoser = eloLoser >= 100 ? eloLoser : 100;

  // Update elo in Sub DB
  await Sub.updateOne({ _id: winner._id }, { $set: { elo: eloWinner } });
  await Sub.updateOne({ _id: loser._id }, { $set: { elo: eloLoser } });

  // Update elo and ranks in leaderboard
  const oldSubs = ld.submissions;
  for (const key of Object.keys(oldSubs)) {
    if (key === winner.name) {
      oldSubs[key].elo = eloWinner;
    } else if (key === loser.name) {
      oldSubs[key].elo = eloLoser;
    }
  }

  const sortedElos = Object.values(oldSubs)
    .map((s) => s.elo)
    .sort((a, b) => b - a);

  for (const key of Object.keys(oldSubs)) {
    oldSubs[key].rank = sortedElos.indexOf(oldSubs[key].elo) + 1;
  }

  await Ld.updateOne({ name: encodeString(winner.leaderboard) }, { $set: { submissions: oldSubs } });

  // Update Pinecone metadata WITHOUT re-embedding
  const encLd = encodeString(winner.leaderboard);
  const winnerId = encodeString(JSON.stringify({ name: winner.name, leaderboard: encLd }));
  const loserId = encodeString(JSON.stringify({ name: loser.name, leaderboard: encLd }));

  // Fetch existing vectors from Pinecone
  const pineconeFetch = await index.fetch([winnerId, loserId]);
  const winnerVector = pineconeFetch.records[winnerId].values;
  const loserVector = pineconeFetch.records[loserId].values;

  if (!winnerVector || !loserVector) {
    return res.status(500).json({ error: "Could not fetch existing embeddings from Pinecone" });
  }

  await index.upsert([
    {
      id: winnerId,
      values: winnerVector,
      metadata: { rank: oldSubs[winner.name].rank, elo: eloWinner, leaderboard : encLd },
    },
    {
      id: loserId,
      values: loserVector,
      metadata: { rank: oldSubs[loser.name].rank, elo: eloLoser, leaderboard : encLd },
    },
  ]);


  res.status(200).json({ success: true, message: "Thanks for playing" });
});



//




//For leaderboard search - TODO make a long term solution
app.post("/searchForLd", async (req, res) => {
  const { leaderboard } = req.body
  if(leaderboard){

    const pattern = encodeString(leaderboard).replace(/-$/, '');

    let results = await Ld.find({
      name: { 
        $regex: `^${pattern}`, 
        $options: 'i' 
      }
    });

    if(results.length == 0){
      results = await Ld.find()
    }

    for(key of Object.keys(results)){
      results[key].name = decodeString(results[key].name)
    }

    res.status(200).json({ results : results })

  }
  else { res.status(500).json({ error : "You must provide a leaderboard" })}
})



app.post("/getSubmissionById", async (req, res) => {
  const { id } = req.body
  if(!id){
    res.status(500).json({ "error" : "Must specify id to use" })
  }

  let sub = await Sub.findById(id)
  if(sub){
    sub = sub.toObject()
    let ld = await Ld.findOne({"name" : encodeString(sub.leaderboard)})
    sub.name = decodeString(sub.name)
    sub.leaderboardId = ld._id.toString()
    res.status(200).json({ "submission" : sub })
  }
  else{
    res.status(404).json({ "error" : "Unable to find this id" })
  }

})





app.post("/getLeaderboardById", async (req, res) => {
  const { id } = req.body
  if(!id){
    res.status(500).json({ "error" : "Must specify id to use" })
  }

  let ld = await Ld.findById(id)
  if(ld){
    ld = ld.toObject()
    
    //Decoding things that need to be decoded
    ld.name = decodeString(ld.name)

    if(ld.submissions){
      Object.keys(ld.submissions).forEach(key => {
        const decoded = decodeString(key)
        ld.submissions[decoded] = ld.submissions[key]
        delete ld.submissions[key]
      })

      //Holding order of submissions
      order = Object.keys(ld.submissions).map(x => null)
      Object.keys(ld.submissions).forEach(key => {
        order[ld.submissions[key].rank - 1] = key
      })
 

      ld.order = order
    }
    if(!ld.order){
      ld.order = []
    }

    res.status(200).json({ "leaderboard" : ld })
  }
  else{
    res.status(500).json({ "error" : "Unable to find this id" })
  }

})








module.exports = app;
