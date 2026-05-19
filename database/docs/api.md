# Echelon API Reference

The backend is an Express app deployed on Vercel. All routes accept and return JSON.

**Local dev:** `http://localhost:2022`  
**Body size limit:** 10 MB  
**Auth:** none — all endpoints are open (no token/session required)

---

## Standard response envelope

Every response uses the same outer shape, regardless of success or failure.

```json
// success
{ "success": true,  "data": { ... } }

// error
{ "success": false, "error": "human-readable message" }
```

All payload fields on success live under `data`. All error details live in `error` at the top level. `success` is always a boolean.

---

## Route prefixes

| Prefix | Router file | Description |
|---|---|---|
| `/api/users` | `routes/authRoutes.js` | User accounts |
| `/api/leaderboard` | `routes/ldRoutes.js` | Leaderboards and submissions |
| `/api/rank` | `routes/rankRoutes.js` | Elo polling and ranking |

---

## User routes — `/api/users`

### GET /api/users/
Health check.

**Response:** `200 "Hello from the users api!"`

---

### POST /api/users/create
Create a new user account.

**Request body**
```json
{ "username": "alice", "password": "hunter2", "email": "alice@example.com" }
```

The password is bcrypt-hashed (salt rounds: 3) before storage.

**Success — 201**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "...",
      "username": "alice",
      "email": "alice@example.com",
      "password": "<bcrypt hash>",
      "leaderboardIds": [],
      "submissions": []
    }
  }
}
```

**Errors**
| Status | Condition | `error` value |
|---|---|---|
| 400 | Missing any field | "Must provide username, password, and email" |
| 409 | Duplicate username | "Username is already taken" |
| 409 | Duplicate email | "Email is already taken" |
| 500 | Unexpected exception | exception message |

---

### POST /api/users/sign-in
Authenticate an existing user.

**Request body**
```json
{ "username": "alice", "password": "hunter2" }
```

**Success — 200**
```json
{ "success": true, "data": { "user": { ... } } }
```

**Errors**
| Status | Condition | `error` value |
|---|---|---|
| 400 | Missing username or password | "Must provide username and password" |
| 401 | Unknown username | "Invalid Username" |
| 401 | Wrong password | "Incorrect Password" |

---

### POST /api/users/get-user-data
Look up a user by email or username. Send one field.

**Request body**
```json
{ "email": "alice@example.com" }
// or
{ "username": "alice" }
```

**Success — 200**
```json
{ "success": true, "data": { "user": { ... } } }
```

**Errors**
| Status | Condition | `error` value |
|---|---|---|
| 400 | Neither field provided | "Must provide email or username" |
| 404 | No matching user | "user cannot be found" |

---

### POST /api/users/update
Not implemented. Returns `501`.

---

## Leaderboard routes — `/api/leaderboard`

### GET /api/leaderboard/
Health check.

**Response:** `200 "Hello from the leaderboard API!"`

---

### POST /api/leaderboard/createLeaderboard
Create a new leaderboard.

**Request body**
```json
{
  "name": "Best Films",
  "host": "alice",
  "description": "A ranking of great cinema.",
  "coverPhoto": "<base64url compressed image>",
  "required": [
    {
      "name": "title",
      "type": "text",
      "list": "no",
      "amount": "1",
      "important": "yes"
    }
  ]
}
```

`name` and `host` are required. `name` is deflate-compressed and base64url-encoded before storage. `required` defines the submission schema for this leaderboard.

**`required` field schema**

| Key | Values | Description |
|---|---|---|
| `name` | any string | Field key |
| `type` | `text` `image` `audio` `video` `link` | Content type |
| `list` | `"yes"` `"no"` | Whether multiple values are accepted |
| `amount` | integer string or `"any"` | How many values if `list: "yes"` |
| `important` | `"yes"` `"no"` | Whether this field is sent to the embedding API for semantic ranking |

**Success — 201**
```json
{
  "success": true,
  "data": {
    "leaderboard": {
      "_id": "...",
      "name": "<encoded>",
      "host": "alice",
      "description": "A ranking of great cinema.",
      "required": [ ... ],
      "submissions": {},
      "locked": false,
      "n_votes": 0
    },
    "user": { ... }
  }
}
```

If the host username exists, `data.user` has the new leaderboard ID appended to `leaderboardIds`.

**Errors**
| Status | Condition | `error` value |
|---|---|---|
| 400 | Missing name or host | "Must fill out all fields!…" |
| 409 | Duplicate leaderboard name | "Leaderboard name already taken, pick a new one." |
| 500 | Unexpected exception | exception message |

---

### POST /api/leaderboard/createSubmission
Add a submission to a leaderboard.

**Request body**
```json
{
  "name": "Blade Runner 2049",
  "leaderboard": "Best Films",
  "contributors": ["alice"],
  "data": { "title": "Blade Runner 2049" }
}
```

`data` must contain every key defined in the leaderboard's `required` array.

**Data key naming for list fields**

| `list` | `amount` | Expected keys |
|---|---|---|
| `"no"` | — | `"<name>"` |
| `"yes"` | `"2"` | `"<name> 0"`, `"<name> 1"` |
| `"yes"` | `"any"` | `"<name> 0"` (minimum one) |

Files must be deflate-compressed and base64url-encoded before sending.

**Success — 201**

The response is sent before Pinecone indexing completes. Embeddings are computed asynchronously after the response.

```json
{
  "success": true,
  "data": {
    "submission": {
      "_id": "...",
      "name": "<encoded>",
      "leaderboard": "<encoded>",
      "elo": 100,
      "rank": 1,
      "data": { ... },
      "contributors": ["alice"]
    }
  }
}
```

**Errors**
| Status | Condition | `error` value |
|---|---|---|
| 400 | Missing name / leaderboard / contributors / data | "Must fill out all fields!…" |
| 400 | Missing required data key | "Missing key `<key>`" |
| 403 | Leaderboard is locked | "This leaderboard is locked for submissions." |
| 404 | Leaderboard not found | "This leaderboard doesn't exist!" |
| 409 | Duplicate submission name | "Submission with this name already exists for this leaderboard." |
| 500 | Unexpected exception | exception message |

---

### POST /api/leaderboard/searchForLd
Search leaderboards by name prefix. Falls back to all leaderboards if nothing matches.

**Request body**
```json
{ "leaderboard": "Best" }
```

**Success — 200**
```json
{
  "success": true,
  "data": {
    "results": [
      { "_id": "...", "name": "Best Films", "host": "alice", ... }
    ]
  }
}
```

Names in `results` are decoded to plain strings.

**Errors**
| Status | Condition |
|---|---|
| 400 | Missing leaderboard field |

---

### POST /api/leaderboard/getLeaderboardById
Fetch a leaderboard by its MongoDB `_id`.

**Request body**
```json
{ "id": "<mongodb objectid>" }
```

**Success — 200**
```json
{
  "success": true,
  "data": {
    "leaderboard": {
      "_id": "...",
      "name": "Best Films",
      "host": "alice",
      "description": "...",
      "coverPhoto": "<base64url>",
      "required": [ ... ],
      "submissions": {
        "Blade Runner 2049": { "elo": 120, "rank": 1, "subid": "..." }
      },
      "order": ["Blade Runner 2049", "Dune"],
      "locked": false,
      "n_votes": 5
    }
  }
}
```

`submissions` keys and `order` are decoded to plain strings. `order` is rank-sorted (index 0 = rank 1).

**Errors**
| Status | Condition |
|---|---|
| 400 | Missing id field |
| 404 | ID not found |

---

### POST /api/leaderboard/getSubmissionById
Fetch a single submission by its MongoDB `_id`.

**Request body**
```json
{ "id": "<mongodb objectid>" }
```

**Success — 200**
```json
{
  "success": true,
  "data": {
    "submission": {
      "_id": "...",
      "name": "Blade Runner 2049",
      "leaderboard": "<encoded>",
      "leaderboardId": "<mongodb objectid>",
      "elo": 120,
      "rank": 1,
      "data": { "title": "Blade Runner 2049" },
      "contributors": ["alice"]
    }
  }
}
```

`name` is decoded to a plain string. `leaderboardId` (the parent leaderboard's `_id`) is appended.

**Errors**
| Status | Condition |
|---|---|
| 400 | Missing id field |
| 404 | ID not found |

---

### POST /api/leaderboard/toggleLock
Lock or unlock a leaderboard.

**Request body**
```json
{ "id": "<mongodb objectid>", "lock": true }
```

**Success — 200**
```json
{ "success": true, "data": {} }
```

**Errors**
| Status | Condition |
|---|---|
| 400 | Missing id or non-boolean lock |

---

## Rank routes — `/api/rank`

### POST /api/rank/poll
Pick two submissions to compare. Call this before `/rank`.

**Request body**
```json
{
  "leaderboard": "Best Films",
  "targetElo": 100,
  "previousPicks": ["Blade Runner 2049", "Dune"]
}
```

`leaderboard` is required (plain string — encoded internally). `targetElo` and `previousPicks` are optional.

- `targetElo` — selects the primary submission closest to this Elo; also narrows the Pinecone query to ±200 of this value.
- `previousPicks` — decoded submission names to skip.

**Success — 200**
```json
{
  "success": true,
  "data": {
    "choice1": { "_id": "...", "name": "Blade Runner 2049", "elo": 100, ... },
    "choice2": { "_id": "...", "name": "Dune", "elo": 100, ... },
    "score": 0.91
  }
}
```

Pass `data.score` back as `similarity` in `/rank`.

**Errors**
| Status | Condition | `error` value |
|---|---|---|
| 400 | Missing leaderboard | "Requires leaderboard to pick from" |
| 400 | Fewer than 2 submissions | "…doesn't have enough submissions for ranked play" |
| 404 | Leaderboard not found | "Leaderboard not found" |
| 404 | Primary submission not in DB | "First submission not found" |
| 404 | No valid second submission | "No valid second submission found" |

---

### POST /api/rank/rank
Record a pairwise comparison result and update Elo scores.

**Request body**
```json
{
  "winner": "<submission _id>",
  "loser":  "<submission _id>",
  "similarity": 0.91
}
```

`similarity` comes from `/poll`'s `data.score`. It dampens the Elo change — 0 means no change; 1 means full change.

**Elo formula**
```
e         = 1 / (1 + 10 ^ ((loserElo - winnerElo) / 400))
change    = 40 × similarity × e
winnerElo = winnerElo + change
loserElo  = max(100, loserElo - change)
```

After updating Elo, all submissions are re-sorted by Elo descending and ranks are reassigned (rank 1 = highest). Pinecone metadata is updated with new rank/Elo. The leaderboard's `n_votes` counter is incremented.

**Success — 200**
```json
{ "success": true, "data": {} }
```

**Errors**
| Status | Condition | `error` value |
|---|---|---|
| 400 | Missing winner or loser | "Must have a winner and a loser ID…" |
| 404 | Either submission not found | "Can't find both parties" |
| 500 | Pinecone vectors missing | "Could not fetch existing embeddings from Pinecone" |

---

## Data models

### User
```
username       String   required
email          String   required
password       String   required  (bcrypt hash)
leaderboardIds Array    default []
submissions    Array    default []
```

### Leaderboard
```
host           String   required  (username)
name           String   required  (base64url-encoded)
description    String   default "No Description Provided"
coverPhoto     String   optional  (base64url-encoded)
required       Array    default []
submissions    Object   default {}
locked         Boolean  default false
n_votes        Number   default 0
```

### Submission
```
leaderboard    String   required  (base64url-encoded leaderboard name)
name           String   required  (base64url-encoded)
elo            Number   default 100
rank           Number   required
data           Object   default {}
contributors   Array    optional
likes          Number   default 0
```

---

## String encoding

Names and leaderboard identifiers are stored in a compressed, URL-safe format. Routes that take a plain `name` or `leaderboard` value encode it internally — callers send plain strings.

```
raw string
  → pako.deflate (zlib deflate)
  → base64
  → replace + → -   / → _   strip trailing =
  = base64url-encoded compressed string
```

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DB_URI` | yes | MongoDB connection string |
| `PC_KEY` | yes | Pinecone API key |
| `PORT` | local only | Dev server port (default: 2022) |
| `NODE_ENV` | Vercel | Set to `"production"` to disable the local listener |
