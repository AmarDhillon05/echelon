import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import AddLd from "../components/AddLd";
import axios from "axios";

export default function Dashboard() {
  const navigate = useNavigate();
  const api_link = "http://localhost:2022/api";

  const [user, setUser] = useState({});
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [showCreateLd, setShowCreateLd] = useState(false);
  const [subs, setSubs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchMatches, setSearchMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  async function updateSearch() {
    if (searchTerm !== "") {
      const { data } = await axios.post(api_link + "/leaderboard/searchForLd", {
        leaderboard: searchTerm,
      });
      setSearchMatches(data.results);
    }
  }

  useEffect(() => {
    updateSearch();
  }, [searchTerm]);

  async function updateData(user) {
    setUser(user);
    const leaderboard = [];
    const sub = [];

    for (const id of user.leaderboardIds || []) {
      const { data } = await axios.post(api_link + "/leaderboard/getLeaderboardById", { id });
      data.leaderboard.id = id;
      leaderboard.push(data.leaderboard);
    }

    for (const id of user.submissions || []) {
      const { data } = await axios.post(api_link + "/leaderboard/getSubmissionById", { id });
      sub.push(data.submission);
    }

    setLeaderboardData(leaderboard);
    setSubs(sub);
    setLoading(false);
  }

  useEffect(() => {
    let userObj = localStorage.getItem("user");
    if (!userObj) {
      navigate("/login");
    } else {
      userObj = JSON.parse(userObj);
      updateData(userObj);
    }
  }, []);

  return (
    <div className="px-6 py-8 min-h-screen bg-gradient-to-b from-black via-zinc-900 to-black text-white">
      <Navbar />
      <AddLd
        show={showCreateLd}
        exit={() => setShowCreateLd(false)}
        ldStateUpdate={(usr) => updateData(usr)}
      />

      {loading ? (
        <div className="flex justify-center items-center min-h-[70vh]">
          <div className="w-12 h-12 border-4 border-white border-t-purple-500 rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* Search */}
          <h1 className="font-bold text-purple-400 text-3xl mb-4 drop-shadow-[0_0_8px_#a855f7]">
            Find Leaderboards
          </h1>

          <input
            type="text"
            onChange={(e) => setSearchTerm(e.target.value)}
            value={searchTerm}
            placeholder="Search..."
            className="w-full p-3 bg-black border border-purple-700 rounded-md mb-4 text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-purple-500 shadow-[0_0_10px_#a855f7]"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-purple-800/10 p-4 rounded-md shadow-[0_0_10px_#a855f7] mb-8">
            {searchMatches.map((ld, key) => (
              <a
                key={key}
                href={`/leaderboard/${ld._id}`}
                className="text-lg text-purple-300 hover:text-purple-100 transition-all hover:underline"
              >
                {ld.name}
              </a>
            ))}
          </div>

          {/* Your Leaderboards */}
          <div className="flex flex-row items-center w-full mb-6">
            <h1 className="font-bold text-purple-400 text-3xl drop-shadow-[0_0_8px_#a855f7]">
              Your Leaderboards
            </h1>
            <button
              className="ml-auto px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xl rounded shadow-[0_0_10px_#a855f7]"
              onClick={() => setShowCreateLd(true)}
            >
              +
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {leaderboardData.length === 0 ? (
              <p className="italic text-gray-400">No leaderboards yet. Click + to create one.</p>
            ) : (
              leaderboardData.map((ld, key) => (
                <a
                  href={`/leaderboard/${ld.id}`}
                  key={key}
                  className="relative bg-zinc-950 hover:bg-zinc-900 rounded-2xl p-6 shadow-[0_0_20px_#a855f7aa] overflow-hidden transition-all group"
                >
                  <div className="absolute -inset-1 bg-gradient-to-r from-purple-900/20 via-purple-800/10 to-transparent opacity-60 blur-xl group-hover:opacity-80 transition" />
                  <h2 className="text-2xl font-semibold text-purple-300 mb-2 z-10 relative">
                    {ld.name}
                  </h2>
                  {ld.order && ld.order.length > 0 ? (
                    <div className="space-y-2 z-10 relative">
                      {ld.order.slice(0, 3).map((subname, subKey) => {
                        const sub = ld.submissions[subname];
                        return (
                          <div
                            key={subKey}
                            className="flex justify-between items-center bg-gray-800 px-4 py-2 rounded"
                          >
                            <p className="text-white">{subname}</p>
                            <div className="flex gap-4 text-sm text-gray-300">
                              <p>
                                Rank: <span className="text-white font-semibold">{sub.rank}</span>
                              </p>
                              <p>
                                ELO: <span className="text-white font-semibold">{parseInt(sub.elo)}</span>
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">No submissions yet.</p>
                  )}
                </a>
              ))
            )}
          </div>

          {/* Submissions */}
          <h1 className="font-bold text-purple-400 text-3xl mt-10 drop-shadow-[0_0_8px_#a855f7]">
            Your Submissions
          </h1>
          {subs.length === 0 ? (
            <p className="italic text-gray-400 text-center mt-10">
              No submissions yet. Go find a cool leaderboard and submit to it!
            </p>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 mt-8">
              {subs.map((sub, key) => (
                <div
                  key={key}
                  className="bg-zinc-900 rounded-2xl p-6 shadow-[0_0_10px_#a855f7] hover:scale-[1.02] transition-transform duration-200"
                >
                  <p className="text-5xl font-extrabold text-center text-purple-300 mb-4 animate-pulse">
                    #{sub.rank}
                  </p>
                  <div className="text-lg space-y-1 text-center">
                    <p className="font-semibold">{sub.name}</p>
                    <p className="text-gray-300">ELO: {parseInt(sub.elo)}</p>
                    <a
                      href={`/leaderboard/${sub.leaderboardId}`}
                      className="text-purple-400 underline hover:text-purple-300"
                    >
                      Leaderboard: {sub.leaderboard}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
