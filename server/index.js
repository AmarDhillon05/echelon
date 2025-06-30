require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const app = express();

app.use(require("cors")());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


const userRoutes = require('./routes/authRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes')

app.use('/api/users', userRoutes);
app.use('/api/leaderboard', leaderboardRoutes)


app.listen(2022, () => {
  console.log("listening on port 2022");
});


module.exports = app

//