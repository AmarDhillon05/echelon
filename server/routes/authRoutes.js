require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");

const app = express.Router();

const User = require("../models/user.model.js");
const bcrypt = require("bcrypt");


require("../config/db.config")();

app.get("/", (req, res) => {
  res.send("Hello from the users api!");
});





// Clear all leaderboards and submissions (commented out by default)
async function clearDb() {
  await User.deleteMany({});
}
//clearDb();







app.post("/create", async (req, res) => {
  console.log("Got a create request")
  try {
    console.log(req.body)
    if (req.body.username && req.body.password && req.body.email) {
      let password = await bcrypt.hash(req.body.password, 3);
      const body = {
        username: req.body.username,
        password : password,
        email : req.body.email
      };

      //Identity checks
      if(req.body.username){
        let user = await User.findOne({ username: req.body.username });
        if(user){
          res.status(500).json({ error:"Username is already taken" })
        }
      }
      else if(req.body.email){
        let user = await User.findOne({password: email})
        if(user){
          res.status(500).json({ error:"Email is already taken" })
        }
      }

      const user = await User.create(body);
      res.status(200).json({ user, success: true });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/sign-in", async (req, res) => {
  try {
    let user = await User.findOne({ username: req.body.username });

    if (!user) return res.status(500).json({ error: "Invalid Username" });

    if (req.body.username && req.body.password) {
      if (!(await bcrypt.compare(req.body.password, user.password)))
        return res.status(500).json({ error: "Incorrect Password" });
      else {
        res.status(200).json({ user, success: true });
      }
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


app.post("/get-user-data", async (req, res) => {
  try {
    if (req.body.email) {
      let user = await User.findOne({ email: req.body.email });
      if (!user) return res.status(404).json({ error: "user cannot be found" });
      res.status(200).json({ user, success: true });
    }
    else if(req.body.username){
      let user = await User.findOne({ username: req.body.username });
      if (!user) return res.status(404).json({ error: "user cannot be found" });
      res.status(200).json({ user, success: true });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
})

app.post("/update", async (req, res) => {
  try {

    if(req.body.username){
      let user = await User.findOne({ username: req.body.username });
      if(user){
        res.status(500).json({ error:"Username is already taken" })
      }
    }
    else if(req.body.email){
      let user = await User.findOne({password: email})
      if(user){
        res.status(500).json({ error:"Email is already taken" })
      }
    }

    res.status(500).json({ error : "Must give username or email to update with" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


module.exports = app