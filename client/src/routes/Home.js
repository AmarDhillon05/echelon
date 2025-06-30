import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

export default function Home() {
  const navigate = useNavigate();
  const [highlightIndex, setHighlightIndex] = useState(0);

  async function clearUser() {
    await localStorage.removeItem("user");
  }

  const word = "echelon";
  // indexes for "elo" letters: e (3), l (4), o (5)
  const eloIndexes = [3, 4, 5];

  useEffect(() => {
    const interval = setInterval(() => {
      setHighlightIndex((prev) => (prev + 1) % word.length);
    }, 400);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col justify-center items-center h-screen bg-black text-white px-4">
      {/* Logo */}
      <i className="fa-solid fa-ranking-star text-yellow-300 text-6xl mb-4 drop-shadow-[0_0_10px_rgba(234,179,8,0.6)]" />

      {/* Animated App Name */}
      <h1 className="text-5xl font-bold mb-2 tracking-tight select-none">
        {word.split("").map((letter, i) => {
          const isElo = eloIndexes.includes(i);
          const isHighlighted = i === highlightIndex;

          let colorClass = "text-gray-400"; // default for non-elo letters
          if (isElo) colorClass = "text-yellow-400"; // default for elo letters

          if (isHighlighted) colorClass = "text-purple-400"; // override highlight

          return (
            <span key={i} className={`transition-colors duration-500 ${colorClass}`}>
              {letter}
            </span>
          );
        })}
      </h1>

      {/* Subtitle */}
      <p className="text-lg text-gray-300 mb-8 italic">elo rankings for everything.</p>

      {/* Call to Action */}
      <button
        onClick={async () => {
          await clearUser();
          const user = localStorage.getItem("user");
          navigate(user ? "/dashboard" : "/login");
        }}
        className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-all duration-300 shadow-md hover:shadow-purple-500/40"
      >
        Get Started
      </button>
    </div>
  );
}
