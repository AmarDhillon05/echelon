
GET /
just returns "hello" type beat



POST /createLeaderboard
params: {
    name, 
    host,
}
returns confirmation



POST /createSubmission
params: {
    name, 
    leaderboard, 
    contributors, 
    ... (anything specified in required)
}
returns confirmation



POST /poll
params: {
    leaderboard, 
    targetElo, 
    previousPicks
}
returns { "choice1", "choice2" } where both are database entries to be compared