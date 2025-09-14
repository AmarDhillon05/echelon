import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import AddLd from "../components/AddLd";
import DevpostAdd from "../components/DevpostAdd";
import axios from "axios";
import { PlusCircle, UploadCloud } from "lucide-react"; // icons
import pako from "pako";



export function decode(encoded) {
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';

  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  const decompressed = pako.inflate(bytes, { to: 'string' });

  return decompressed;
}



export default function Dashboard() {
  const navigate = useNavigate();
  const api_link = process.env.REACT_APP_DBAPI_URI;

  const [user, setUser] = useState({});
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [showCreateLd, setShowCreateLd] = useState(false);
  const [showDevpostAdd, setShowDevpostAdd] = useState(false);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);


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

      {/* Modals */}
      <AddLd
        show={showCreateLd}
        exit={() => setShowCreateLd(false)}
        ldStateUpdate={(usr) => updateData(usr)}
      />
      <DevpostAdd
        show={showDevpostAdd}
        exit={() => setShowDevpostAdd(false)}
        user={user}
        ldStateUpdate={(usr) => updateData(usr)}
      />

      {loading ? (
        <div className="flex justify-center items-center min-h-[70vh]">
          <div className="w-12 h-12 border-4 border-white border-t-purple-500 rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* Leaderboards Section */}
          <div className="mb-12">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <h1 className="font-bold text-purple-400 text-3xl drop-shadow-[0_0_8px_#a855f7]">
                Your Leaderboards
              </h1>
              <div className="flex gap-4 mt-4 md:mt-0">
                <button
                  className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-lg font-medium rounded-xl shadow-[0_0_15px_#a855f7aa] transition-all hover:scale-105"
                  onClick={() => setShowCreateLd(true)}
                >
                  <PlusCircle className="w-5 h-5" /> Create
                </button>
                <button
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-700 to-fuchsia-600 hover:from-purple-800 hover:to-fuchsia-700 text-white text-lg font-medium rounded-xl shadow-[0_0_15px_#a855f7aa] transition-all hover:scale-105"
                  onClick={() => setShowDevpostAdd(true)}
                >
                  <UploadCloud className="w-5 h-5" /> Add from Devpost
                </button>
              </div>
            </div>

            {leaderboardData.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center mt-16">
                <i className="fa-solid fa-ranking-star text-5xl text-purple-500 mb-4 opacity-80" />
                <p className="italic text-gray-400 max-w-md">
                  No leaderboards yet. Create one or add from Devpost to get started!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {leaderboardData.map((ld, key) => (
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
                                  Rank:{" "}
                                  <span className="text-white font-semibold">{sub.rank}</span>
                                </p>
                                <p>
                                  ELO:{" "}
                                  <span className="text-white font-semibold">
                                    {parseInt(sub.elo)}
                                  </span>
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="italic text-gray-400 text-center mt-10">
                        No submissions yet.
                      </p>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Submissions Section */}
          <div>
            <h1 className="font-bold text-purple-400 text-3xl drop-shadow-[0_0_8px_#a855f7]">
              Your Submissions
            </h1>
            {subs.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center mt-16">
                <i className="fa-solid fa-paper-plane text-5xl text-purple-500 mb-4 opacity-80" />
                <p className="italic text-gray-400 max-w-md">
                  No submissions yet. Go find a cool leaderboard and submit to it!
                </p>
              </div>
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
                        Leaderboard: {decode(sub.leaderboard)}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
