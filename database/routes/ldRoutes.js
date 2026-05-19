import dotenv from "dotenv";
import express from "express";

import Ld from "../models/leaderboard.model.js";
import Sub from "../models/submission.model.js";
import User from "../models/user.model.js";

import { Pinecone } from "@pinecone-database/pinecone";

import {
  encodeString,
  decodeString,
  embed,
  dummyEmbed
} from "../utils/slug.js";

dotenv.config();

const app = express.Router();

import connectDB from "../config/db.config.js";
connectDB();

const pc = new Pinecone({ apiKey: process.env.PC_KEY });
const index = pc.Index("echelon");

app.get("/", (req, res) => {
  res.send("Hello from the leaderboard API!");
});

async function clearDb() {
  await Ld.deleteMany({});
  await Sub.deleteMany({});
  await User.deleteMany({});
  try {
    await index.deleteAll();
  } catch (e) {
    console.log("Pinecone already empty");
  }
  console.log("Cleared Ld DB");
}
clearDb();

app.post("/createLeaderboard", async (req, res) => {
  try {
    let { name, host, description, required, coverPhoto } = req.body;

    if (!name || !host) {
      return res.status(400).json({
        success: false,
        error: "Must fill out all fields! Requires appropriate name and host.",
      });
    }

    name = encodeString(name);

    const existingLd = await Ld.findOne({ name });
    if (existingLd) {
      return res.status(409).json({ success: false, error: "Leaderboard name already taken, pick a new one." });
    }

    coverPhoto = coverPhoto || "";
    const ld = await Ld.create({ name, host, description, required, coverPhoto });

    let user = await User.find({ username: host });
    if (user && user[0]) {
      user = user[0];
      const existingIds = user.leaderboardIds || [];
      await User.findOneAndUpdate({ username: host }, {
        leaderboardIds: [...existingIds, ld._id],
      });
      user["leaderboardIds"] = [...existingIds, ld._id];
    }

    res.status(201).json({ success: true, data: { leaderboard: ld, user } });
  } catch (e) {
    console.error(e);
    let { name, host } = req.body;
    name = encodeString(name);
    if (name && host) {
      await Ld.findOneAndDelete({ name, host });
    }
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post("/createSubmission", async (req, res) => {
  try {
    let { name, leaderboard, contributors, data } = req.body;

    if (!name || !leaderboard || !contributors || !data) {
      return res.status(400).json({
        success: false,
        error: "Must fill out all fields! Requires name, target leaderboard, one or more contributor, and other required fields.",
      });
    }

    name = encodeString(name);
    leaderboard = encodeString(leaderboard);
    const rawNameAndLd = { name, leaderboard };

    const existingSub = await Sub.findOne({ name, leaderboard });
    if (existingSub) {
      return res.status(409).json({ success: false, error: "Submission with this name already exists for this leaderboard." });
    }

    let ld = await Ld.findOne({ name: leaderboard });
    if (!ld) {
      return res.status(404).json({ success: false, error: "This leaderboard doesn't exist!" });
    }

    if (ld.locked) {
      return res.status(403).json({ success: false, error: "This leaderboard is locked for submissions." });
    }

    const dataKeys = Object.keys(data);
    for (let req of ld.required) {
      let required_keys = [req.name];
      if (req.list === "yes") {
        if (req.amount === "any") {
          required_keys = [`${req.name} 0`];
        } else {
          required_keys = [];
          for (let i = 0; i < parseInt(req.amount); i++) {
            required_keys.push(`${req.name} ${i}`);
          }
        }
      }
      for (let key of required_keys) {
        if (!dataKeys.includes(key)) {
          return res.status(400).json({ success: false, error: `Missing key ${key}` });
        }
      }
    }

    const newSublist = ld.submissions || {};
    const rank = Object.keys(newSublist).length + 1;
    const metadata = { ...data, elo: 100, rank, leaderboard };
    delete metadata.name;

    const entry = { ...req.body, elo: 100, rank, name, leaderboard, data: metadata };
    const sub = await Sub.create(entry);

    for (const contributor of sub.contributors) {
      const user = await User.findOne({ username: contributor });
      if (user) {
        user.submissions = user.submissions || [];
        user.submissions.push(sub._id);
        await User.findByIdAndUpdate(user._id, { submissions: user.submissions });
      }
    }

    newSublist[name] = { elo: 100, subid: sub._id.toString(), rank };
    await Ld.updateOne({ _id: ld._id }, { $set: { submissions: newSublist } });

    res.status(201).json({ success: true, data: { submission: sub } });

    // Post-response: upsert into Pinecone (non-critical)
    await index.upsert([{
      id: encodeString(JSON.stringify(rawNameAndLd)),
      values: dummyEmbed(),
      metadata: { rank, leaderboard, elo: 100, subid: sub._id },
    }]);

    try {
      await index.upsert([{
        id: encodeString(JSON.stringify(rawNameAndLd)),
        values: await embed(metadata, ld.required),
        metadata: { rank, leaderboard, elo: 100, subid: sub._id },
      }]);
    } catch (e) {
      await index.upsert([{
        id: encodeString(JSON.stringify(rawNameAndLd)),
        values: dummyEmbed(),
        metadata: { rank, leaderboard, elo: 100, subid: sub._id },
      }]);
    }
  } catch (e) {
    console.error(e);
    try {
      let { name, leaderboard } = req.body;
      name = encodeString(name);
      leaderboard = encodeString(leaderboard);
      const rawNameAndLd = { name, leaderboard };

      await index.deleteOne(encodeString(JSON.stringify(rawNameAndLd)));

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

    if (!res.headersSent) {
      res.status(500).json({ success: false, error: e.message });
    }
  }
});

app.post("/searchForLd", async (req, res) => {
  const { leaderboard } = req.body;
  if (!leaderboard) {
    return res.status(400).json({ success: false, error: "You must provide a leaderboard" });
  }

  const pattern = encodeString(leaderboard).replace(/-$/, "");
  let results = await Ld.find({ name: { $regex: `^${pattern}`, $options: "i" } });
  if (results.length === 0) {
    results = await Ld.find();
  }

  for (let key of Object.keys(results)) {
    results[key].name = decodeString(results[key].name);
  }

  res.status(200).json({ success: true, data: { results } });
});

app.post("/getSubmissionById", async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ success: false, error: "Must specify id to use" });
  }

  let sub = await Sub.findById(id);
  if (!sub) {
    return res.status(404).json({ success: false, error: "Unable to find this id" });
  }

  sub = sub.toObject();
  const ld = await Ld.findOne({ name: sub.leaderboard });
  sub.name = decodeString(sub.name);
  sub.leaderboardId = ld._id.toString();

  res.status(200).json({ success: true, data: { submission: sub } });
});

app.post("/getLeaderboardById", async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ success: false, error: "Must specify id to use" });
  }

  let ld = await Ld.findById(id);
  if (!ld) {
    return res.status(404).json({ success: false, error: "Unable to find this id" });
  }

  ld = ld.toObject();
  ld.name = decodeString(ld.name);

  if (ld.submissions) {
    Object.keys(ld.submissions).forEach((key) => {
      const decoded = decodeString(key);
      ld.submissions[decoded] = ld.submissions[key];
      delete ld.submissions[key];
    });

    let order = Object.keys(ld.submissions).map(() => null);
    Object.keys(ld.submissions).forEach((key) => {
      order[ld.submissions[key].rank - 1] = key;
    });
    ld.order = order;
  }
  if (!ld.order) ld.order = [];

  res.status(200).json({ success: true, data: { leaderboard: ld } });
});

app.post("/toggleLock", async (req, res) => {
  const { id, lock } = req.body;
  if (!id || (lock !== true && lock !== false)) {
    return res.status(400).json({ success: false, error: "Requires id and a boolean lock value" });
  }

  await Ld.findOneAndUpdate({ _id: id }, { locked: lock });
  res.status(200).json({ success: true, data: {} });
});

export default app;
