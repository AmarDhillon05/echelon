
GET /
just returns "hello" type beat



POST /create
params: {
    username, 
    password,
    email
}
returns User profile



POST /sign-in
params: {
    username, 
    password
}
returns User profile



POST /get-user-data
params: {
    username, 
    password
}
returns User profile



POST /update
params: {
    username | email,
    everything else
}
resets User profile with new data