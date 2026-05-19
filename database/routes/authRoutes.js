import dotenv from "dotenv";
import express from "express";
import bcrypt from "bcrypt";

import User from "../models/user.model.js";
import connectDB from "../config/db.config.js";

dotenv.config();

const app = express.Router();

connectDB();

app.get("/", (req, res) => {
  res.send("Hello from the users api!");
});

app.post("/create", async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
      return res.status(400).json({ success: false, error: "Must provide username, password, and email" });
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(409).json({ success: false, error: "Username is already taken" });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(409).json({ success: false, error: "Email is already taken" });
    }

    const hashed = await bcrypt.hash(password, 3);
    const user = await User.create({ username, password: hashed, email });

    res.status(201).json({ success: true, data: { user } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post("/sign-in", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: "Must provide username and password" });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ success: false, error: "Invalid Username" });
    }

    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, error: "Incorrect Password" });
    }

    res.status(200).json({ success: true, data: { user } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post("/get-user-data", async (req, res) => {
  try {
    const { email, username } = req.body;

    if (email) {
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ success: false, error: "user cannot be found" });
      return res.status(200).json({ success: true, data: { user } });
    }

    if (username) {
      const user = await User.findOne({ username });
      if (!user) return res.status(404).json({ success: false, error: "user cannot be found" });
      return res.status(200).json({ success: true, data: { user } });
    }

    res.status(400).json({ success: false, error: "Must provide email or username" });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post("/update", async (req, res) => {
  res.status(501).json({ success: false, error: "Not implemented" });
});

export default app;
