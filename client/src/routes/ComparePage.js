import Navbar from "../components/Navbar";
import Req from "../components/Req";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { decompressToBase64 } from "../utils/slug";





export default function ComparePage() {
  const navigate = useNavigate();
  const api_link = process.env.REACT_APP_DBAPI_URI;
  const { id } = useParams();

  const [ld_name, setLdName] = useState(undefined);
  const [ld, setLd] = useState(undefined);
  const [choices, setChoices] = useState({});
  const [previousPicks, setPreviousPicks] = useState([]);

  async function submitAndPoll(pick) {

    let prevPicks = [...previousPicks]

    if (pick !== "" && choices.choice1 && choices.choice2) {
      const winner = choices["choice" + pick]._id;
      const loser = choices[pick === "1" ? "choice2" : "choice1"]._id;
      const similarity = choices.score;


      prevPicks = [...previousPicks, choices["choice" + pick].name, choices["choice" + (pick === "1" ? "2" : "1")].name] //Since state takes a bit to update
      setPreviousPicks(prevPicks);


      await axios.post(api_link + "/rank/rank", { winner, loser, similarity });
    }

    setChoices({});
    await new Promise((resolve) => setTimeout(resolve, 100));


    if (ld_name !== undefined) {

      const { data } = await axios.post(api_link + "/rank/poll", {
        leaderboard: ld_name,
        previousPicks : prevPicks,
      });
    
      setChoices(data);
    }
  }

  
  async function updateLd() {
    const maxRetries = 10;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        console.log(`Searching for ${id}, attempt ${attempt + 1}`);
        const { data } = await axios.post(
          api_link + "/leaderboard/getLeaderboardById",
          { id }
        );

        const ldb = data.leaderboard;
        setLd(ldb);
        setLdName(ldb.name);
        submitAndPoll("");
        return; // success, exit function
      } catch (err) {
        attempt++;
        if (attempt >= maxRetries) {
          console.error("Max retries reached. Could not fetch leaderboard:", err);
          throw err;
        }

        // exponential backoff: 100ms * 2^attempt
        const delay = 100 * Math.pow(2, attempt);
        console.warn(`Error occurred. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }




  useEffect(() => {
    updateLd();
  }, []);

  useEffect(() => {
    submitAndPoll();
  }, [ld_name]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-900 to-black text-white">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 py-10">
        
        <h1 className="text-4xl font-bold mb-8 text-center">
          Playing <a className="text-purple-400 hover:scale-[1.05] hover:text-purple-500 cursor-pointer transition-auto duration-300"
          onClick = {() => {
            navigate("/leaderboard/" + id)
          }}
          >{ld_name}</a>
        </h1>

    
        {choices.choice1 && choices.choice2 && ld && (
          <div className="flex flex-col md:flex-row gap-6 justify-between">
            {[choices.choice1, choices.choice2].map((choice, index) => (
              <div
                key={index}
                className="max-w-1/2 flex-1 bg-zinc-950 hover:bg-zinc-900 rounded-2xl p-6 shadow-[0_0_25px_#a855f7aa] cursor-pointer transition-transform hover:scale-[1.001] transition-auto duration-200"
                onClick={() => submitAndPoll(index === 0 ? "1" : "2")}
              >
                <h2 className="text-2xl font-semibold mb-2 text-purple-400">{choice.name}</h2>
                {/*TODO - maybe add browsing submissions from here */}
                <p className="text-sm text-gray-300 mb-4">ELO: {Math.round(choice.elo)}</p>

                <div className="space-y-3">
                  {ld.required.map((req, i) => {
                    const name = req.name;
                  
                    const keys = Object.keys(choice.data).filter((b) => {
                      const escapeRegex = (str) => str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                      const regex = new RegExp(`^${escapeRegex(name)} \\d+$`);
                      return b == name || regex.test(b);
                    });
                    const entries = keys.map((x) => choice.data[x]);
                    const caption_keys = keys.map((x) => `${x} caption`);
                    const captions = caption_keys.map((x) => choice.data[x]);

              
                    return (
                      <Req
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
