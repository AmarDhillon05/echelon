import Navbar from "../components/Navbar";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";

export default function ComparePage() {
  const navigate = useNavigate();
  const api_link = "http://localhost:2022/api";
  const { id } = useParams();

  const [ld_name, setLdName] = useState(undefined);
  const [ld, setLd] = useState(undefined);
  const [choices, setChoices] = useState({});
  const [previousPicks, setPreviousPicks] = useState([]);

  async function submitAndPoll(pick) {
    if (pick !== "" && choices.choice1 && choices.choice2) {
      const winner = choices["choice" + pick]._id;
      const loser = choices[pick === "1" ? "choice2" : "choice1"]._id;
      const similarity = choices.score;

      setPreviousPicks([...previousPicks, choices["choice" + pick].name]);

      await axios.post(api_link + "/leaderboard/rank", { winner, loser, similarity });
    }

    setChoices({});
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (ld_name !== undefined) {
      const { data } = await axios.post(api_link + "/leaderboard/poll", {
        leaderboard: ld_name,
        previousPicks,
      });
      setChoices(data);
    }
  }

  async function updateLd() {
    const { data } = await axios.post(api_link + "/leaderboard/getLeaderboardById", { id });
    const ldb = data.leaderboard;
    setLd(ldb);
    setLdName(ldb.name);
    submitAndPoll("");
  }

  useEffect(() => {
    updateLd();
  }, []);

  useEffect(() => {
    submitAndPoll();
  }, [ld_name]);

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-4xl font-bold mb-8 text-center">
          Playing <span className="text-purple-400">{ld_name}</span>
        </h1>

        <div
          className={`$ {
            choices.choice1 && choices.choice2 ? "opacity-100" : "opacity-0"
          } transition-all duration-500 ease-in-out`}
        >
          {choices.choice1 && choices.choice2 && ld && (
            <div className="flex flex-col md:flex-row gap-6 justify-between">
              {[choices.choice1, choices.choice2].map((choice, index) => (
                <div
                  key={index}
                  className="flex-1 bg-gray-900 hover:bg-gray-800 hover:scale-[1.02] transition-transform duration-200 rounded-2xl shadow-xl p-6 cursor-pointer"
                  onClick={() => {
                    submitAndPoll(index === 0 ? "1" : "2");
                  }}
                >
                  <h2 className="text-2xl font-semibold mb-2 text-purple-400">{choice.name}</h2>
                  <p className="text-sm text-gray-300 mb-4">ELO: {Math.round(choice.elo)}</p>

                  <div className="space-y-3">
                    {Object.entries(choice.data)
                      .filter(([k]) => k !== "name")
                      .map(([k, v], i) => {
                        const dtype = ld.required.find((x) => x.name.trim() === k.trim())?.type;

                        if (dtype === "text") {
                          return (
                            <div className="flex justify-between text-sm" key={i}>
                              <span className="text-gray-400">{k}</span>
                              <span className="text-white">{v}</span>
                            </div>
                          );
                        }

                        if (dtype === "link") {
                          return (
                            <a className="block text-purple-400 underline text-sm" key={i} href={v} target="_blank">
                              {k}
                            </a>
                          );
                        }

                        if (dtype === "image") {
                          return (
                            <div key={i} className="flex flex-col items-center">
                              <span className="text-sm text-gray-400 mb-1">{k}</span>
                              <img src={v} alt="submission image" className="max-w-full max-h-60 rounded shadow" />
                            </div>
                          );
                        }

                        if (dtype === "audio") {
                          return (
                            <div key={i} className="text-center">
                              <p className="text-sm text-gray-400 mb-1">{k}</p>
                              <audio controls className="w-full">
                                <source src={v} type="audio/mpeg" />
                                Your browser does not support audio.
                              </audio>
                            </div>
                          );
                        }

                        if (dtype === "video") {
                          return (
                            <div key={i} className="text-center">
                              <p className="text-sm text-gray-400 mb-1">{k}</p>
                              <video controls className="mx-auto max-w-full max-h-72 rounded shadow">
                                <source src={v} type="video/mp4" />
                                Your browser does not support video.
                              </video>
                            </div>
                          );
                        }

                        return (
                          <div className="flex justify-between text-sm" key={i}>
                            <span className="text-gray-400">{k}</span>
                            <span className="text-white">{v}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
