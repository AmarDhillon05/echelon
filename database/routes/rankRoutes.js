require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const Ld = require("../models/leaderboard.model.js");
const Sub = require("../models/submission.model.js");
const User = require("../models/user.model.js");
const { Pinecone } = require("@pinecone-database/pinecone");
const {encodeString, decodeString, decompressToBase64, uint8ArrayToBase64, embed, dummyEmbed} = require("../utils/slug.js")



//Poll + Rank
const app = express.Router();

const pc = new Pinecone({
  apiKey: process.env.PC_KEY,
});

const index = pc.Index("echelon")





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
    let subid = null;

    for (const sub of matches) {
        const subName = decodeString(JSON.parse(decodeString(sub.id)).name);
        if (!previousPicks || !previousPicks.includes(subName)) {
            secondSub = subName;
            score = sub.score;
            subid = matches[0].metadata.subid
            break;
        }
    }//

    if (secondSub == null && matches.length > 0) {
        secondSub = decodeString(JSON.parse(decodeString(matches[0].id)).name);
        score = matches[0].score;
        subid = matches[0].metadata.subid
    }

    if (!secondSub) {
  
        return res.status(404).json({ error: "No valid second submission found" });
    }

    
    // Re-query second submission from MongoDB using its name and leaderboard

    let secondSubData = (await Sub.find({
      "_id" : subid
    }))[0];


    if (!secondSubData) {

        return res.status(404).json({ error: "Second submission not found in DB" });
    }

    // Decode for return
    firstSub[0].name = decodeString(firstSub[0].name);
    secondSubData.name = decodeString(secondSubData.name);

    return res.status(200).json({ choice1: firstSub[0], choice2: secondSubData, score });

});
//


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

  const ld = (await Ld.find({ name: winner.leaderboard }))[0];
  console.log(ld)

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


  await Ld.updateOne({ name: winner.leaderboard }, { $set: { submissions: oldSubs } });

  // Update Pinecone metadata WITHOUT re-embedding
  const encLd = winner.leaderboard
  const winnerId = encodeString(JSON.stringify({ name: winner.name, leaderboard: encLd }));
  const loserId = encodeString(JSON.stringify({ name: loser.name, leaderboard: encLd }));

  // Fetch existing vectors from Pinecone
  const pineconeFetch = await index.fetch([winnerId, loserId]);
  console.log(winnerId, loserId)
  const winnerVector = pineconeFetch.records[winnerId].values;
  const loserVector = pineconeFetch.records[loserId].values;

  if (!winnerVector || !loserVector) {
    return res.status(500).json({ error: "Could not fetch existing embeddings from Pinecone" });
  }

  await index.upsert([
    {
      id: winnerId,
      values: winnerVector,
      metadata: { rank: oldSubs[winner.name].rank, elo: eloWinner, leaderboard : encLd, subid : winner._id },
    },
    {
      id: loserId,
      values: loserVector,
      metadata: { rank: oldSubs[loser.name].rank, elo: eloLoser, leaderboard : encLd, subid : loser._id },
    },
  ]);

  //If everything went well, increase the vote count
  let n_votes = ld.n_votes ? ld.n_votes + 1 : 1
  await Ld.updateOne({ name: encodeString(winner.leaderboard) }, { $set: { n_votes } })


  res.status(200).json({ success: true, message: "Thanks for playing" });
});











module.exports = app