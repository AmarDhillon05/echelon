import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import axios from "axios";

export default function Leaderboard() {
  const navigate = useNavigate();
  const api_link = "http://localhost:2022/api";
  const { id } = useParams();

  const [ld, setLd] = useState({});
  const [contributors, setContributors] = useState([]);
  const [currentContributor, setCurrentContributor] = useState("");
  const [user, setUser] = useState({});
  const [contributorValid, setContributorValid] = useState(null);

  async function getBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  useEffect(() => {
    const userObj = localStorage.getItem("user");
    if (!userObj) navigate("/login");
    else setUser(JSON.parse(userObj));

    updateLd();
  }, []);

  async function updateLd() {
    const { data } = await axios.post(api_link + "/leaderboard/getLeaderboardById", { id });
    const ldb = data.leaderboard;
    ldb.id = id;
    setLd(ldb);
  }

  async function confirmUser() {
    try {
      const { data } = await axios.post(api_link + "/users/get-user-data", { username: currentContributor });
      return !data.error;
    } catch {
      return false;
    }
  }

  useEffect(() => {
    if (!currentContributor) return;
    const check = async () => {
      const valid = await confirmUser();
      setContributorValid(valid);
    };
    check();
  }, [currentContributor]);

  async function newSubmission(e) {
    e.preventDefault();
    const form = document.getElementById("submission");
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    for (const [key, value] of Object.entries(data)) {
      if (value instanceof File) {
        if (!value || value.size === 0) return;

        const dtype = ld.required.find((x) => x.name === key)?.type || "";
        if (!value.type.includes(dtype)) {
          document.getElementById("subErrText").innerHTML = `Uploaded wrong file type to "${key}"`;
          return;
        }
        data[key] = await getBase64(value);
      } else {
        if (!value) {
          document.getElementById("subErrText").innerHTML = "Fill out all fields!";
          return;
        }
      }
    }

    const body = {
      data,
      contributors: [...contributors, user.username],
      name: data.name,
      leaderboard: ld.name,
    };

    try {
      const { data } = await axios.post(api_link + "/leaderboard/createSubmission", body);
      if (data.error) {
        document.getElementById("subErrText").innerHTML = data.error;
      } else {
        form.reset();
        setContributors([]);
        setCurrentContributor("");
        setContributorValid(null);
        document.getElementById("subErrText").innerHTML = "";
        document.getElementById("subConfText").innerHTML = "Successfully submitted!";
        await updateLd(); // Refresh leaderboard data
      }
    } catch {
      document.getElementById("subErrText").innerHTML = "Unable to make the submission.";
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <div className="flex flex-row w-full p-8 gap-8">
        {/* LEFT: Leaderboard */}
        <div className="w-1/2 bg-gray-900 shadow-[0_0_20px_#a855f7] rounded-xl p-6">
          <h1 className="text-4xl font-bold text-purple-400 mb-2">{ld.name}</h1>
          <p className="text-xl mb-4 text-gray-300">{ld.description}</p>

          <h2 className="text-3xl font-semibold mb-2 text-white">Leaderboard</h2>
          {ld.order && ld.order.length > 0 ? (
            <div className="space-y-2">
              {ld.order.map((subname, subKey) => {
                const sub = ld.submissions[subname];
                return (
                  <div key={subKey} className="flex justify-between items-center bg-gray-800 px-4 py-2 rounded">
                    <p className="text-white">{subname}</p>
                    <div className="flex gap-4 text-sm text-gray-300">
                      <p>Rank: <span className="text-white font-semibold">{sub.rank}</span></p>
                      <p>ELO: <span className="text-white font-semibold">{parseInt(sub.elo)}</span></p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-400 italic">No submissions yet.</p>
          )}

          <button
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
            onClick={() => navigate("/rank/" + id)}
          >
            Start playing
          </button>
        </div>

        {/* RIGHT: Submission Form */}
        <div className="w-1/2 bg-gray-900 shadow-[0_0_20px_#a855f7] rounded-xl p-6">
          <h1 className="text-4xl font-semibold text-purple-400 mb-6">Create a Submission</h1>

          <div className="mb-4">
            <label htmlFor="additionalContributors" className="block text-lg mb-1">
              Additional Contributor
            </label>
            <input
              id="additionalContributors"
              type="text"
              value={currentContributor}
              onChange={(e) => setCurrentContributor(e.target.value)}
              className="bg-black text-white p-2 rounded w-full border border-purple-700"
            />
            {currentContributor && (
              <p className={`mt-1 text-sm ${contributorValid ? "text-green-400" : "text-red-400"}`}>
                {contributorValid ? "This contributor exists" : "This contributor doesn't exist"}
              </p>
            )}

            <button
              className="mt-2 px-4 py-2 bg-purple-700 rounded hover:bg-purple-800 transition"
              onClick={() => {
                if (contributorValid && currentContributor !== "") {
                  setContributors([...contributors, currentContributor]);
                  setCurrentContributor("");
                }
              }}
            >
              Add
            </button>
          </div>

          {contributors.length > 0 && (
            <div className="mb-6">
              <p className="text-lg font-semibold mb-2">Contributors:</p>
              <ul className="space-y-2">
                {contributors.map((name, idx) => (
                  <li key={idx} className="flex justify-between items-center bg-gray-800 px-3 py-2 rounded">
                    <span>{name}</span>
                    <button
                      onClick={() =>
                        setContributors(contributors.filter((_, i) => i !== idx))
                      }
                      className="text-red-400 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form id="submission" onSubmit={newSubmission} className="space-y-4">
            <div>
              <label htmlFor="name" className="block mb-1">Submission Name</label>
              <input
                name="name"
                id="name"
                type="text"
                className="bg-black text-white p-2 rounded w-full border border-purple-700"
              />
            </div>

            {ld.required && ld.required.map((req, key) => (
              <div key={key}>
                <label htmlFor={req.name} className="block mb-1">
                  {req.name} ({req.type})
                </label>
                {["text", "link"].includes(req.type) ? (
                  <input
                    type="text"
                    name={req.name}
                    id={req.name}
                    className="bg-black text-white p-2 rounded w-full border border-purple-700"
                  />
                ) : (
                  <input
                    type="file"
                    name={req.name}
                    id={req.name}
                    className="bg-black text-white p-2 rounded w-full border border-purple-700"
                  />
                )}
              </div>
            ))}

            <button
              type="submit"
              className="px-6 py-2 bg-purple-600 text-white font-semibold rounded hover:bg-purple-700 transition"
            >
              Submit
            </button>
          </form>

          <p className="text-red-500 mt-2" id="subErrText"></p>
          <p className="text-green-500 mt-1" id="subConfText"></p>
        </div>
      </div>
    </div>
  );
}
