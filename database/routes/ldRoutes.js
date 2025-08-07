require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const Ld = require("../models/leaderboard.model.js");
const Sub = require("../models/submission.model.js");
const User = require("../models/user.model.js");
const { Pinecone } = require("@pinecone-database/pinecone");
const {encodeString, decodeString, decompressToBase64, uint8ArrayToBase64, embed, dummyEmbed} = require("../utils/slug.js")



const embed_url = "http://3.93.168.118:8000"

const app = express.Router();





// Initialize Pinecone client and central index
const pc = new Pinecone({
  apiKey: process.env.PC_KEY,
});

const index = pc.Index("echelon")

require("../config/db.config")();

app.get("/", (req, res) => {
  res.send("Hello from the leaderboard API!");
});



// Clear all leaderboards and submissions 
async function clearDb() {
  await Ld.deleteMany({});
  await Sub.deleteMany({});
  await User.deleteMany({});
  try{
    await index.deleteAll();
  }catch(e){
    console.log("Pinecone already empty")
  }
  console.log("Cleared Ld DB")
}
//clearDb();






app.post("/createLeaderboard", async (req, res) => {
  try {
    let { name, host, description, required, coverPhoto } = req.body;

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
    console.log(coverPhoto)
    coverPhoto = coverPhoto ? coverPhoto : ""
    const ld = await Ld.create({ name, host, description, required, coverPhoto });


    // Add leaderboard ID to user's leaderboardIds array (if the user exists)
    let user = await User.find({ username: host });
    if (user && user[0]) {
      user = user[0]
      const existingIds = user.leaderboardIds || [];
      await User.findOneAndUpdate({ username: host }, {
        leaderboardIds: [...existingIds, ld._id],
      });
      user['leaderboardIds'] = [...existingIds, ld._id] //For returning user in response
    }

    res.status(201).json({ leaderboard: ld, success: true, user });
  } catch (e) {
    console.log(e)
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
  console.log(JSON.stringify(req.body))
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
    const dataKeys = Object.keys(data)
    for(req of ld.required){

      let required_keys = [req.name]
      if(req.list == 'yes'){
        if(req.amount == 'any'){
          required_keys = [`${req.name} 0`]
        }
        else{
          required_keys = []
          for(let i = 0; i < parseInt(req.amount); i ++){
            required_keys.push(`${req.name} ${i}`)
          }
        }
      }

      for(key of required_keys){
        if(!dataKeys.includes(key)){
          res.status("500").json({"error" : `Missing key ${key}`})
          return
        }
      }
    }



    // Prepare metadata: flatten data and add elo, rank
    const newSublist = ld.submissions || {};
    const rank = Object.keys(newSublist).length + 1;
    const metadata = { ...data, elo: 100, rank, leaderboard };
    delete metadata.name; // remove name if present

    // Update leaderboard submissions and save
    newSublist[name] = { elo: 100, rank };
    const resLd = await Ld.updateOne({ _id: ld._id }, { $set: { submissions: newSublist } });
    

    // Create submission document in MongoDB
    const entry = { ...req.body, elo: 100, rank, name, leaderboard, data : metadata };
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
    //id is encoded JSON of name and leaderboard to make it unique for pc
    //////

    try {
      await index.upsert([
        {
          id: encodeString(JSON.stringify(rawNameAndLd)),
          values: await embed(metadata, ld.required),
          metadata: { rank, leaderboard, elo: 100, subid : sub._id },
        },
      ]);
    } catch (e) {
      await index.upsert([
        {
          id: encodeString(JSON.stringify(rawNameAndLd)),
          values: dummyEmbed(),
          metadata: { rank, leaderboard, elo: 100, subid : sub._id },
        },
      ]);
    }

 
  } catch (e) {

    // On error, attempt cleanup
    console.log("Ran into a submission error, attempting cleanup")
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

    if(!res.headersSent){
      res.status(500).json({ error: e.message });
    }
  }
});






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



app.post("/toggleLock", async (req, res) => {
  const { id, lock } = req.body
  if(!id || (lock != true && lock != false)){
    res.status(500).json({"error" : "This request requires ID"})
  }

 else{
    let conf = await Ld.findOneAndUpdate({ _id: id }, {
          locked : lock,
        });
   

    res.status(200).json({ "success" : "true" })
 }

})






module.exports = app;
