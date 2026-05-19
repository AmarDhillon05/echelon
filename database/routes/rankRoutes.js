import dotenv from "dotenv";
import express from "express";

import Ld from "../models/leaderboard.model.js";
import Sub from "../models/submission.model.js";

import { Pinecone } from "@pinecone-database/pinecone";
import { encodeString, decodeString } from "../utils/slug.js";

dotenv.config();

const app = express.Router();

import connectDB from "../config/db.config.js";
connectDB();

const pc = new Pinecone({ apiKey: process.env.PC_KEY });
const index = pc.Index("echelon");

app.post("/poll", async (req, res) => {
  let { leaderboard, targetElo, previousPicks } = req.body;

  if (!leaderboard) {
    return res.status(400).json({ success: false, error: "Requires leaderboard to pick from" });
  }

  leaderboard = encodeString(leaderboard);
  if (previousPicks) previousPicks.reverse();

  const ld = await Ld.find({ name: leaderboard });
  if (!ld || ld.length === 0) {
    return res.status(404).json({ success: false, error: "Leaderboard not found" });
  }

  const allSubmissions = { ...ld[0].submissions };
  if (Object.keys(allSubmissions).length < 2) {
    return res.status(400).json({ success: false, error: "This leaderboard doesn't have enough submissions for ranked play" });
  }

  function useTargetElo(allSubmissions) {
    const elos = Object.keys(allSubmissions).map((x) => allSubmissions[x].elo);
    const bestMatchIdx = elos
      .map((x) => Math.abs(x - targetElo))
      .reduce((maxIdx, curr, idx, array) => (curr > array[maxIdx] ? idx : maxIdx), 0);
    return Object.keys(allSubmissions)[bestMatchIdx];
  }

  let firstPicks = [];
  while (true) {
    if (Object.keys(allSubmissions).length === 0) break;
    const choice = useTargetElo(allSubmissions);
    firstPicks.push(choice);
    if (!previousPicks || !previousPicks.includes(decodeString(choice))) break;
    delete allSubmissions[choice];
  }

  const firstSubName = firstPicks.at(-1);
  const firstSub = await Sub.find({ name: firstSubName });
  if (!firstSub || firstSub.length === 0) {
    return res.status(404).json({ success: false, error: "First submission not found" });
  }

  const fetchId = encodeString(JSON.stringify({ name: firstSubName, leaderboard }));
  const pineconeFetch = await index.fetch([fetchId]);
  const embedding = pineconeFetch.records[fetchId].values;

  let args = {
    topK: 5,
    vector: embedding,
    includeMetadata: true,
    filter: { leaderboard: { $eq: leaderboard } },
  };
  if (targetElo) {
    args.filter.elo = { $gte: targetElo - 200, $lte: targetElo + 200 };
  }

  const matches = (await index.query(args)).matches.filter((x) => x.id !== fetchId);

  let secondSub = null;
  let score = null;
  let subid = null;

  for (const sub of matches) {
    const subName = decodeString(JSON.parse(decodeString(sub.id)).name);
    if (!previousPicks || !previousPicks.includes(subName)) {
      secondSub = subName;
      score = sub.score;
      subid = matches[0].metadata.subid;
      break;
    }
  }

  if (secondSub == null && matches.length > 0) {
    secondSub = decodeString(JSON.parse(decodeString(matches[0].id)).name);
    score = matches[0].score;
    subid = matches[0].metadata.subid;
  }

  if (!secondSub) {
    return res.status(404).json({ success: false, error: "No valid second submission found" });
  }

  let secondSubData = (await Sub.find({ _id: subid }))[0];
  if (!secondSubData) {
    return res.status(404).json({ success: false, error: "Second submission not found in DB" });
  }

  firstSub[0].name = decodeString(firstSub[0].name);
  secondSubData.name = decodeString(secondSubData.name);

  return res.status(200).json({ success: true, data: { choice1: firstSub[0], choice2: secondSubData, score } });
});

app.post("/rank", async (req, res) => {
  let { winner, loser, similarity } = req.body;

  if (!winner || !loser) {
    return res.status(400).json({ success: false, error: "Must have a winner and a loser ID, as well as their similarity from /poll" });
  }

  winner = await Sub.findById(winner);
  loser = await Sub.findById(loser);

  if (!winner || !loser) {
    return res.status(404).json({ success: false, error: "Can't find both parties" });
  }

  const ld = (await Ld.find({ name: winner.leaderboard }))[0];

  let eloWinner = Math.max(winner.elo, 100);
  let eloLoser = Math.max(loser.elo, 100);
  const e = 1 / (1 + 10 ** ((loser.elo - winner.elo) / 400));
  const k = 40;
  eloWinner += k * similarity * e;
  eloLoser -= k * similarity * e;
  eloWinner = Math.max(eloWinner, 100);
  eloLoser = Math.max(eloLoser, 100);

  await Sub.updateOne({ _id: winner._id }, { $set: { elo: eloWinner } });
  await Sub.updateOne({ _id: loser._id }, { $set: { elo: eloLoser } });

  const oldSubs = ld.submissions;
  for (const key of Object.keys(oldSubs)) {
    if (key === winner.name) oldSubs[key].elo = eloWinner;
    else if (key === loser.name) oldSubs[key].elo = eloLoser;
  }

  let subsArray = Object.entries(oldSubs);
  subsArray.sort((a, b) => b[1].elo - a[1].elo);
  subsArray.forEach(([key, sub], index) => {
    oldSubs[key].rank = index + 1;
  });

  await Ld.updateOne({ name: winner.leaderboard }, { $set: { submissions: oldSubs } });

  const encLd = winner.leaderboard;
  const winnerId = encodeString(JSON.stringify({ name: winner.name, leaderboard: encLd }));
  const loserId = encodeString(JSON.stringify({ name: loser.name, leaderboard: encLd }));

  const pineconeFetch = await index.fetch([winnerId, loserId]);
  const winnerVector = pineconeFetch.records[winnerId].values;
  const loserVector = pineconeFetch.records[loserId].values;

  if (!winnerVector || !loserVector) {
    return res.status(500).json({ success: false, error: "Could not fetch existing embeddings from Pinecone" });
  }

  await index.upsert([
    { id: winnerId, values: winnerVector, metadata: { rank: oldSubs[winner.name].rank, elo: eloWinner, leaderboard: encLd, subid: winner._id } },
    { id: loserId, values: loserVector, metadata: { rank: oldSubs[loser.name].rank, elo: eloLoser, leaderboard: encLd, subid: loser._id } },
  ]);

  const n_votes = (ld.n_votes || 0) + 1;
  await Ld.updateOne({ name: winner.leaderboard }, { $set: { n_votes } });

  res.status(200).json({ success: true, data: {} });
});

export default app;
