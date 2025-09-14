import Navbar from "../components/Navbar";
import Req from "../components/Req";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

export default function SubmissionPage() {
  const api_link = process.env.REACT_APP_DBAPI_URI;
  const { id } = useParams();
  const navigate = useNavigate();

  // Split "leaderboardId-submissionId"
  const [leaderboardId, submissionId] = id.split("-");

  const [ld, setLd] = useState(undefined);
  const [ldName, setLdName] = useState(undefined);
  const [submissions, setSubmissions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(null);
  const [currentSubmission, setCurrentSubmission] = useState(null);

  // Fisher–Yates shuffle
  function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  async function loadLeaderboard() {
    const { data } = await axios.post(
      api_link + "/leaderboard/getLeaderboardById",
      { id: leaderboardId }
    );

    const ldb = data.leaderboard;
    setLd(ldb);
    setLdName(ldb.name);

    if (ldb.submissions && Object.keys(ldb.submissions).length > 0) {
      // reorder with target first
      const target = Object.values(ldb.submissions).find((s) => s.subid === submissionId);
      const others = Object.values(ldb.submissions).filter((s) => s.subid !== submissionId);
      const shuffled = shuffleArray(others);
      const finalList = target ? [target, ...shuffled] : shuffled;

      setSubmissions(finalList);
      setCurrentIndex(0);

      // load the actual full submission
      if (target) {
        loadSubmissionById(target.subid);
      }
    }
  }



  async function loadSubmissionById(subid) {
    console.log(subid)
    const { data } = await axios.post(api_link + "/leaderboard/getSubmissionById", {
      id: subid,
    });
    setCurrentSubmission(data.submission);
  }



  useEffect(() => {
    loadLeaderboard();
  }, [id]);

  function goToSubmission(direction) {
    if (!submissions.length) return;

    let newIndex;
    if (direction === "left") {
      newIndex = (currentIndex - 1 + submissions.length) % submissions.length;
    } else {
      newIndex = (currentIndex + 1) % submissions.length;
    }

    setCurrentIndex(newIndex);
    const subid = submissions[newIndex].subid;
    navigate(`/submission/${leaderboardId}-${subid}`);
    loadSubmissionById(subid);
  }

  if (!ld || currentIndex === null || !currentSubmission) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  const submission = currentSubmission;

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-900 to-black text-white">
      <Navbar />

      <div className="flex flex-col max-w-6xl mx-auto px-4 py-10">
        <h1 className="text-4xl font-bold mb-8 text-center">
          Viewing Submission in{" "}
          <a className="text-purple-400 hover:scale-[1.05] hover:text-purple-500 cursor-pointer transition-auto duration-300"
          onClick = {() => {
            navigate("/leaderboard/" + leaderboardId)
          }}
          >{ldName}</a>
        </h1>

        <div className="relative flex flex-1 items-center justify-center">
          {/* Left arrow */}
          <button
            onClick={() => goToSubmission("left")}
            className="absolute left-0 p-4 text-purple-400 hover:text-purple-200 text-3xl"
          >
            ←
          </button>

          {/* Submission card */}
          <div className="bg-zinc-950 rounded-2xl p-6 shadow-[0_0_25px_#a855f7aa] max-w-2xl min-w-xl text-center flex flex-col">
            <h2 className="text-2xl font-semibold mb-2 text-purple-400">
              {submission.name}
            </h2>
            <p className="text-sm text-gray-300 mb-4">
              ELO: {Math.round(submission.elo)}
            </p>

            <div className="space-y-3 flex-1">
              {ld.required.map((req, i) => {
                const name = req.name;

                const keys = Object.keys(submission.data).filter((b) => {
                  const escapeRegex = (str) =>
                    str.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
                  const regex = new RegExp(`^${escapeRegex(name)} \\d+$`);
                  return b === name || regex.test(b);
                });

                const entries = keys.map((x) => submission.data[x]);
                const caption_keys = keys.map((x) => `${x} caption`);
                const captions = caption_keys.map((x) => submission.data[x]);

                return (
                  <Req
                    key={i}
                    entries={entries}
                    reqName={name}
                    i={i}
                    dtype={req.type}
                    captions={captions}
                  />
                );
              })}
            </div>
          </div>

          {/* Right arrow */}
          <button
            onClick={() => goToSubmission("right")}
            className="absolute right-0 p-4 text-purple-400 hover:text-purple-200 text-3xl"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
