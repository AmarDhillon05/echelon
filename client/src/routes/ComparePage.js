import Navbar from "../components/Navbar";
import SingleReq from "../components/SingleReq";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { decompressToBase64 } from "../utils/slug";


function Req({ entries, reqName, i, dtype, captions }) {
  const slides = [];
  let currentSlide = [];
  let ind = 0;

  for (const entry of entries) {
    const comp = (
      <SingleReq
        idx={ind}
        dtype={dtype}
        k={captions[ind] || reqName}
        v={entry}
        key={ind}
      />
    );

    if (
      dtype === "image" ||
      dtype === "video" ||
      (dtype === "link" &&
        ((entry.includes("youtube") && entry.includes("embed")) ||
        (entry.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) || entry.startsWith("data:image"))  || 
          entry.match(/\.(mp4|webm|ogg)$/i) ||
          entry.match(/\.(mp3|wav|ogg)$/i)))
    ) {
      if (currentSlide.length > 0) slides.push(currentSlide);
      slides.push([comp]);
      currentSlide = [];
    } else {
      currentSlide.push(comp);
    }

    ind += 1;
  }

  if (currentSlide.length > 0) slides.push(currentSlide);

  const [idx, setIdx] = useState(0);
  const [fade, setFade] = useState(true);

  const prevSlide = () => {
    setFade(false);
    setTimeout(() => {
      setIdx((prev) => (prev - 1 + slides.length) % slides.length);
      setFade(true);
    }, 300);
  };

  const nextSlide = () => {
    setFade(false);
    setTimeout(() => {
      setIdx((prev) => (prev + 1) % slides.length);
      setFade(true);
    }, 300);
  };

  return (
    <div className="p-4 bg-zinc-900 rounded-2xl text-white shadow-[0_0_10px_#a855f7aa]">
      <h2 className="text-lg font-semibold text-purple-400 mb-4">{reqName}</h2>

      <ul
        className={`flex flex-col gap-4 list-none transition-opacity duration-300 ease-in-out ${
          fade ? "opacity-100" : "opacity-0"
        }`}
      >
        {slides.length > 0 && slides[idx].map((comp, i) => (
          <li key={i}>{comp}</li>
        ))}
      </ul>

      {slides.length > 1 && (
        <div className="flex justify-center gap-4 mt-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              prevSlide();
            }}
            className="hover:bg-purple-700 text-white w-8 h-8 flex items-center justify-center"
            aria-label="Previous slide"
          >
            ‹
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              nextSlide();
            }}
            className="hover:bg-purple-700 text-white w-8 h-8 flex items-center justify-center"
            aria-label="Next slide"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}



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
      setPreviousPicks([...previousPicks, choices["choice" + pick].name, choices["choice" + (pick === "1" ? "1" : "2")].name]);
      await axios.post(api_link + "/rank/rank", { winner, loser, similarity });
    }

    setChoices({});
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (ld_name !== undefined) {
      const { data } = await axios.post(api_link + "/rank/poll", {
        leaderboard: ld_name,
        previousPicks,
      });
      console.log(data)
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
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-900 to-black text-white">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 py-10">
        <h1 className="text-4xl font-bold mb-8 text-center">
          Playing <span className="text-purple-400">{ld_name}</span>
        </h1>

        {choices.choice1 && choices.choice2 && ld && (
          <div className="flex flex-col md:flex-row gap-6 justify-between">
            {[choices.choice1, choices.choice2].map((choice, index) => (
              <div
                key={index}
                className="max-w-1/2 flex-1 bg-zinc-950 hover:bg-zinc-900 rounded-2xl p-6 shadow-[0_0_25px_#a855f7aa] cursor-pointer transition-transform hover:scale-[1.02]"
                onClick={() => submitAndPoll(index === 0 ? "1" : "2")}
              >
                <h2 className="text-2xl font-semibold mb-2 text-purple-400">{choice.name}</h2>
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
