# Echelon Frontend

React 19 app (Create React App) styled with Tailwind CSS. Communicates with two backends: the Node/Express database API and a Python scraping API.

---

## Setup

```bash
cd client
npm install
```

Create a `.env` file in `client/`:

```
REACT_APP_DBAPI_URI=http://localhost:2022/api
REACT_APP_PYAPI_URI=<python api url>
```

```bash
npm start    # dev server on http://localhost:3000
npm run build
```

---

## Directory layout

```
client/src/
├── routes/          # One file per page
│   ├── Home.js
│   ├── Login.js
│   ├── Join.js
│   ├── Dashboard.js
│   ├── Leaderboard.js
│   ├── ComparePage.js
│   └── Submission.js
├── components/      # Reusable UI
│   ├── Navbar.js
│   ├── AddLd.js
│   ├── DevpostAdd.js
│   ├── Req.js
│   ├── ReqModal.js
│   ├── SingleReq.js
│   └── EmbeddedLink.js
└── utils/
    └── slug.js      # File compression helpers
```

Routing is configured in `App.js` using React Router v7.

---

## API response shape

All API calls return the same envelope. On success, the payload is always under `data`. On error the server responds with a 4xx/5xx status — axios throws, and the `catch` block reads `err.response?.data?.error`.

```js
// success
{ success: true,  data: { ... } }

// error (4xx / 5xx — axios throws)
{ success: false, error: "message" }
```

---

## Pages

### `/` — Home
Landing page. Animates the word "echelon" letter-by-letter with colour transitions (yellow for "elo", purple accents). Shows a **Get Started** button that routes to `/dashboard` if the user is already stored in localStorage, otherwise to `/login`.

No API calls.

---

### `/login` — Login
Sign-in form. On submit calls:

```
POST /api/users/sign-in  { username, password }
```

On success, stores `data.data.user` in `localStorage` and navigates to `/dashboard`. Errors are caught from the axios exception (`err.response?.data?.error`).

---

### `/join` — Join
Registration form. Fields: username, email, password, confirm password. Validates that the two password fields match before calling:

```
POST /api/users/create  { username, password, email }
```

On success, stores `data.data.user` in `localStorage` and navigates to `/dashboard`. Errors are caught from the axios exception.

---

### `/dashboard` — Dashboard
Requires auth (reads user from localStorage).

Two-column layout:
- **Your Leaderboards** — grid of cards, each showing the leaderboard name and up to 3 top-ranked submissions. Clicking a card navigates to `/leaderboard/:id`.
- **Your Submissions** — grid of cards showing submission name, leaderboard, rank, and Elo.

Data is fetched on mount by iterating the user's `leaderboardIds` and `submissions` arrays:
```
POST /api/leaderboard/getLeaderboardById  { id }  →  data.data.leaderboard
POST /api/leaderboard/getSubmissionById   { id }  →  data.data.submission
```

**Create leaderboard button** — opens the `AddLd` modal.  
**Add from Devpost button** — opens the `DevpostAdd` modal.

---

### `/leaderboard/:id` — Leaderboard
Two-column layout.

**Left column — leaderboard view**
- Cover photo with title overlay
- Description (truncated with expand/collapse)
- Vote count
- Ranked list of submissions (name, Elo, rank badge)
- **Start Playing** button — navigates to `/rank/:id`

**Right column — submission form**
- Add contributors: type a username and validate it against the API (`POST /api/users/get-user-data` → checks `data.success === true`). Multiple contributors allowed.
- Dynamic form fields generated from the leaderboard's `required` array. Each field type renders an appropriate input (text area, file picker, URL input). List fields render multiple inputs.
- On submit, files are compressed with pako before being included in the payload, then sent to:

```
POST /api/leaderboard/createSubmission
{
  "name": "...",
  "leaderboard": "<decoded leaderboard name>",
  "contributors": ["alice"],
  "data": {
    "<fieldname>": "<value>",
    "<fieldname> 0": "<value>",       // list field, first item
    "<fieldname> 0 caption": "..."    // optional caption
  }
}
```

**Data fetched on mount:**
```
POST /api/leaderboard/getLeaderboardById  { id }  →  data.data.leaderboard
```

---

### `/rank/:id` — ComparePage
Elo voting interface. Presents two submissions side-by-side and asks the user to pick the better one.

**Flow**
1. Fetch leaderboard to get submission list.
2. Call `/api/rank/poll` to get a pair of submissions to compare. `previousPicks` is accumulated across votes in the session so the same match-up is not repeated.
3. Display both submissions with all their fields rendered via `Req`.
4. User clicks one submission to declare it the winner.
5. Call `/api/rank/rank` with `winner._id`, `loser._id`, and the `similarity` score from poll.
6. Go to step 2.

```
POST /api/leaderboard/getLeaderboardById  { id }                     →  data.data.leaderboard
POST /api/rank/poll   { leaderboard, targetElo, previousPicks }      →  data.data  (choice1, choice2, score)
POST /api/rank/rank   { winner, loser, similarity }
```

Both poll and rank calls use exponential backoff retry (up to 10 attempts, base delay 100 ms × 2ⁿ) to handle transient failures.

---

### `/submission/:id` — SubmissionPage
Detailed view of a single submission. Shows all fields rendered by `Req`.

Navigation arrows let the user browse other submissions in the same leaderboard. The order is shuffled (Fisher-Yates) with the current submission placed first. The URL updates as the user navigates without a full page reload.

```
POST /api/leaderboard/getLeaderboardById  { id }   →  data.data.leaderboard
POST /api/leaderboard/getSubmissionById   { id }   →  data.data.submission
```

---

## Components

### Navbar
Header on every page. Shows the logo and a dropdown (Dashboard, Logout). Reads the username from localStorage. Clicking outside closes the dropdown.

---

### AddLd — create leaderboard modal
Form used from Dashboard to create a new leaderboard.

Fields: name, description, cover photo (compressed before upload), and a dynamic requirement builder. Each requirement has: name, type, single/list toggle, item count, and a "use in ranking" flag. Validates for duplicate requirement names.

```
POST /api/leaderboard/createLeaderboard { name, host, description, coverPhoto, required }
  →  data.data.user  (stored in localStorage; passed to ldStateUpdate callback)
```

---

### DevpostAdd — import from Devpost modal
Searches a Python API for hackathon data and imports it as a leaderboard.

```
POST <PYAPI>/search  { query }
POST <PYAPI>/create  { hackathon }
```

---

### Req — requirement display container
Wraps one submission requirement for display. Groups media and text separately; media items show in a carousel with fade transitions. An **Expand** link opens the `ReqModal` for a fullscreen view. Handles multi-item lists by tracking a current slide index.

---

### ReqModal — fullscreen requirement viewer
Portal-rendered modal (appended to `document.body`) showing the same content as `Req` at full size. Closes on background click.

---

### SingleReq — individual field renderer
Renders one value from a submission's `data` object based on its type:

| Type | Render |
|---|---|
| `text` | `dangerouslySetInnerHTML` (HTML allowed) |
| `image` | Decompresses base64url → data URI → `<img>` |
| `audio` | HTML5 `<audio>` with controls |
| `video` | HTML5 `<video>` with controls |
| `link` | Delegates to `EmbeddedLink` |

---

### EmbeddedLink — smart link renderer
Inspects a URL and renders the most appropriate element:

| URL pattern | Render |
|---|---|
| Image extension or `data:image` | `<img>` |
| Contains `youtube` + `embed` | `<iframe>` |
| Video extension | `<video>` |
| Audio extension | `<audio>` |
| Anything else | `<a>` hyperlink |

---

## State management

No global store. Each page manages its own state with `useState` / `useEffect`.

**Persistence across pages:** the logged-in user object is stored as JSON in `localStorage` under the key `user`. Pages that require auth read this on mount. Logout clears it and navigates to `/`.

**Modal state** is owned by the parent page and passed down as props.

---

## File compression

Files uploaded by users (images, audio, video) are compressed with pako before being sent to the API, to reduce payload size.

Utilities in `src/utils/slug.js`:

| Function | Description |
|---|---|
| `encodeString(str)` | Deflate + base64url encode a string |
| `decodeString(str)` | Reverse of encodeString |
| `decompressToBase64(b64, mime)` | Decompress a base64url value back to a `data:<mime>;base64,...` URI |
| `uint8ArrayToBase64(arr)` | Chunked byte array → base64 (avoids call stack overflow on large files) |
| `base64ToUint8Array(b64)` | base64 → byte array |

The compression pipeline used when uploading a file:
```
File object
  → FileReader (read as array buffer)
  → Uint8Array
  → pako.deflate
  → uint8ArrayToBase64
  → base64.replace(+→-, /→_, strip =)
  = value stored in data[fieldName]
```

Decompression for display:
```
data[fieldName]  (base64url)
  → decompressToBase64(value, mimeType)
  = "data:image/jpeg;base64,..."  (standard data URI)
```

---

## Environment variables

| Variable | Description |
|---|---|
| `REACT_APP_DBAPI_URI` | Base URL of the Node/Express API |
| `REACT_APP_PYAPI_URI` | Base URL of the Python scraping API |

Both are accessed via `process.env.REACT_APP_*` at build time. There is no runtime config injection.
