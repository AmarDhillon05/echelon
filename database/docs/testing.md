# Database API — Route Reference & Testing Guide

Run the test suite from the `database/` directory:

```bash
npm test          # single run
npm run test:watch  # re-runs on file changes
```

Tests live in `database/tests/`. They use an in-memory MongoDB (no real connection needed) and mock Pinecone and the embed API, so you can run them with no environment variables set.

---

## Auth routes  (`/api/users/...`)

### GET /
Health check. Returns the string `"Hello from the users api!"`.

**Test:** `tests/routes/authRoutes.test.js › GET / › returns a health check message`

---

### POST /create
Create a new user account.

```json
{ "username": "alice", "password": "hunter2", "email": "alice@example.com" }
```

Returns `{ user, success: true }`. Password is bcrypt-hashed before storage (salt rounds: 3).

**Errors**
| Condition | Status | Message |
|---|---|---|
| Duplicate username | 500 | "Username is already taken" |
| Missing any field | *(no response — known bug)* | — |

**Tests**
- `creates a user successfully`
- `hashes the password — plaintext is not stored`
- `rejects a duplicate username`
- `returns an error when required fields are missing` *(todo — route hangs with no response when fields absent)*

**Known bug:** after sending the 500 for a duplicate username the handler does not `return`, so it falls through to `User.create()` and attempts a second `res.json()`. This causes a "headers already sent" error internally but the client still receives the correct 500.

---

### POST /sign-in
Authenticate an existing user.

```json
{ "username": "alice", "password": "hunter2" }
```

Returns `{ user, success: true }`.

**Errors**
| Condition | Status | Message |
|---|---|---|
| Unknown username | 500 | "Invalid Username" |
| Wrong password | 500 | "Incorrect Password" |

**Tests**
- `signs in with correct credentials`
- `rejects a wrong password`
- `rejects an unknown username`

---

### POST /get-user-data
Look up a user by email or username.

```json
{ "email": "alice@example.com" }
// or
{ "username": "alice" }
```

Returns `{ user, success: true }`.

**Errors**
| Condition | Status |
|---|---|
| No match | 404 |

**Tests**
- `finds a user by email`
- `finds a user by username`
- `returns 404 when no user matches the email`
- `returns 404 when no user matches the username`

---

### POST /update
*(Partially implemented — always returns an error. No tests written for it.)*

---

## Leaderboard routes  (`/api/leaderboard/...`)

### GET /
Health check. Returns `"Hello from the leaderboard API!"`.

**Test:** `tests/routes/ldRoutes.test.js › GET / › returns a health check message`

---

### POST /createLeaderboard
Create a new leaderboard.

```json
{
  "name": "Best Films",
  "host": "alice",
  "description": "Optional description",
  "required": [
    { "name": "title", "type": "text", "list": "no", "amount": "1", "important": "yes" }
  ],
  "coverPhoto": "<base64 string>"
}
```

`name` and `host` are required. `name` is compressed + base64-encoded before storage.  
`required` defines the schema that every submission to this leaderboard must satisfy.  
Each field in `required`:
- `name` — field key
- `type` — `"text"`, `"image"`, `"video"`, `"audio"`, or `"link"`
- `list` — `"yes"` / `"no"` (whether multiple values are accepted)
- `amount` — number of items expected, or `"any"`
- `important` — `"yes"` / `"no"` (whether it is sent to the embedding API)

Returns `{ leaderboard, success: true, user }`. If the host user exists, their `leaderboardIds` array is updated.

**Errors**
| Condition | Status | Message |
|---|---|---|
| Missing name or host | 400 | "Must fill out all fields…" |
| Duplicate name | 409 | "Leaderboard name already taken…" |

**Tests**
- `creates a leaderboard successfully`
- `rejects a request missing name or host`
- `rejects a duplicate leaderboard name`
- `links the new leaderboard ID to the host user if they exist`

---

### POST /createSubmission
Add a submission to an existing leaderboard.

```json
{
  "name": "Blade Runner 2049",
  "leaderboard": "Best Films",
  "contributors": ["alice"],
  "data": {
    "title": "Blade Runner 2049"
  }
}
```

`data` must contain every key defined in the leaderboard's `required` array. List fields follow the pattern `"<fieldname> 0"`, `"<fieldname> 1"`, etc.

Returns `{ submission, success: true }`. Elo starts at 100 and rank is assigned sequentially. After the response is sent, the submission is also upserted into Pinecone (first with a dummy embedding, then with a real one from the embed API).

**Errors**
| Condition | Status | Message |
|---|---|---|
| Missing name / leaderboard / contributors / data | 400 | "Must fill out all fields…" |
| Leaderboard not found | 404 | "This leaderboard doesn't exist!" |
| Leaderboard is locked | 403 | "This leaderboard is locked…" |
| Duplicate submission name on same leaderboard | 409 | "Submission with this name already exists…" |
| Missing required data key | 500 | "Missing key `<key>`" |

**Tests**
- `creates a submission successfully`
- `rejects a request missing required top-level fields`
- `rejects submission to a non-existent leaderboard`
- `rejects a duplicate submission name on the same leaderboard`
- `rejects submission to a locked leaderboard`
- `rejects submission missing a required data field`
- `assigns incremental ranks to submissions`

---

### POST /searchForLd
Search leaderboards by name prefix. Falls back to returning all leaderboards if nothing matches.

```json
{ "leaderboard": "Best" }
```

Returns `{ results: [...] }` with decoded names.

**Errors**
| Condition | Status |
|---|---|
| Missing leaderboard field | 500 |

**Tests**
- `returns matching leaderboards by name prefix`
- `falls back to all leaderboards when no name matches`
- `returns 500 when leaderboard query is missing`

---

### POST /getLeaderboardById
Fetch a leaderboard by its MongoDB `_id`. Returns the leaderboard with decoded submission names and an `order` array (submission names sorted by rank, index 0 = rank 1).

```json
{ "id": "<mongodb objectid>" }
```

Returns `{ leaderboard }`.

**Errors**
| Condition | Status |
|---|---|
| ID not found | 500 |

**Tests**
- `returns a leaderboard with decoded name and order array`
- `returns 500 for a non-existent ID`

---

### POST /getSubmissionById
Fetch a submission by its MongoDB `_id`. Also attaches the parent leaderboard's `_id` as `leaderboardId`.

```json
{ "id": "<mongodb objectid>" }
```

Returns `{ submission }` with decoded name.

**Errors**
| Condition | Status |
|---|---|
| ID not found | 404 |

**Tests**
- `returns a submission with decoded name`
- `returns 404 for a non-existent ID`

---

### POST /toggleLock
Lock or unlock a leaderboard so it stops (or starts) accepting submissions.

```json
{ "id": "<mongodb objectid>", "lock": true }
```

Returns `{ success: "true" }`.

**Errors**
| Condition | Status |
|---|---|
| Missing id or lock | 500 |

**Tests**
- `locks a leaderboard`
- `unlocks a leaderboard`
- `returns 500 when id is missing`

---

## Rank routes  (`/api/rank/...`)

### POST /poll
Pick two submissions from a leaderboard to be compared. Intended to be called before `/rank`.

```json
{
  "leaderboard": "Best Films",
  "targetElo": 100,
  "previousPicks": ["Blade Runner 2049", "Dune"]
}
```

- `targetElo` (optional) — picks the submission closest to this Elo as the primary; also filters Pinecone results to ±200 of this value.
- `previousPicks` (optional) — list of decoded submission names to avoid repeating.

Finds the primary submission by Elo proximity, then queries Pinecone for a semantically similar second submission.

Returns `{ choice1, choice2, score }` where `score` is the Pinecone cosine similarity.

**Errors**
| Condition | Status | Message |
|---|---|---|
| Missing leaderboard | 500 | "Requires leaderboard to pick from" |
| Leaderboard not found | 404 | "Leaderboard not found" |
| Fewer than 2 submissions | 500 | "…doesn't have enough submissions for ranked play" |
| First submission not in DB | 404 | "First submission not found" |
| No valid second submission | 404 | "No valid second submission found" |

*(No route-level tests yet — `/poll` depends heavily on Pinecone query results. Test via integration or manually.)*

---

### POST /rank
Record the result of a comparison and update Elo scores.

```json
{ "winner": "<submission _id>", "loser": "<submission _id>", "similarity": 0.87 }
```

`similarity` is the cosine similarity score returned by `/poll`. It dampens the Elo change — a similarity of 0 means no change; 1 means full change.

**Elo formula (non-standard — larger Elo advantage → larger gain):**
```
e          = 1 / (1 + 10 ^ ((loserElo - winnerElo) / 400))
eloChange  = 40 * similarity * e
winnerElo += eloChange
loserElo  -= eloChange   (floor: 100)
```

After updating Elo, submissions in the leaderboard are re-sorted and ranks reassigned (rank 1 = highest Elo). Pinecone metadata is also updated with the new rank and Elo (embeddings are not re-computed).

Returns `{ success: true, message: "Thanks for playing" }`.

**Errors**
| Condition | Status | Message |
|---|---|---|
| Missing winner or loser | 500 | "Must have a winner and a loser ID…" |
| Either submission not found | 404 | "Can't find both parties" |
| Pinecone vectors missing | 500 | "Could not fetch existing embeddings…" |

**Known bug:** the `n_votes` increment at the end of the handler double-encodes the leaderboard name, so the update never finds the document and `n_votes` is never written.

**Tests** (`tests/routes/rankRoutes.test.js`)
- `returns an error when winner or loser ID is missing`
- `returns 404 when winner or loser cannot be found in the DB`
- `updates Elo correctly for equal-rated submissions with similarity=1` — expects winner +20, loser clamped at 100
- `applies no Elo change when similarity=0`
- `correctly computes Elo when winner has a much higher rating than the loser` — e ≈ 0.76, change ≈ 30.4
- `enforces an Elo floor of 100 for the loser`
- `re-sorts ranks in the leaderboard after voting`
- `scales Elo change proportionally with similarity` — similarity 0.5 → +10 pts

---

## Utility functions  (`utils/slug.js`)

| Function | Purpose |
|---|---|
| `encodeString(str)` | Deflate (pako) → base64 → URL-safe (replaces `+` `/` `=`) |
| `decodeString(encoded)` | Reverse of encodeString |
| `dummyEmbed()` | Returns a random 1024-dim float array in `[-1, 1]` |
| `uint8ArrayToBase64(arr)` | Chunked conversion to avoid call-stack limits |
| `base64ToUint8Array(b64)` | Standard decode |
| `embed(data, requirements)` | Calls the external embedding API for important fields |
| `decompressToBase64(b64, mime)` | Decompresses a URL-safe base64 file back to a data URI |

**Tests** (`tests/utils/slug.test.js`)
- `encodeString / decodeString` — round-trips for simple, special-char, JSON, empty, and long strings; URL-safety; determinism
- `dummyEmbed` — length 1024, values in `[-1, 1]`, different on each call
- `uint8ArrayToBase64 / base64ToUint8Array` — round-trip for small and large (100 000-byte) arrays
