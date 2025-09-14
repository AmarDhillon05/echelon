import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

export default function Home() {

  
  const navigate = useNavigate();
  const [highlightIndex, setHighlightIndex] = useState(0);

  async function clearUser() {
    await localStorage.removeItem("user");
  }

  const word = "echelon";
  const eloIndexes = [3, 4, 5];

  useEffect(() => {
    const interval = setInterval(() => {
      setHighlightIndex((prev) => (prev + 1) % word.length);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col justify-center items-center h-screen bg-gradient-to-b from-black via-zinc-900 to-black text-white px-4">
      {/* Logo */}
      <i className="fa-solid fa-ranking-star text-yellow-300 text-6xl mb-6 drop-shadow-[0_0_12px_rgba(234,179,8,0.7)]" />

      {/* Animated Title */}
      <h1 className="text-6xl font-extrabold mb-4 tracking-wide select-none">
        {word.split("").map((letter, i) => {
          const isElo = eloIndexes.includes(i);
          const isHighlighted = i === highlightIndex;

          let colorClass = "text-gray-500"; // default
          if (isElo) colorClass = "text-yellow-400";
          if (isHighlighted) colorClass = "text-purple-400";

          return (
            <span
              key={i}
              className={`transition-colors duration-500 ${colorClass}`}
            >
              {letter}
            </span>
          );
        })}
      </h1>

      {/* Subtitle */}
      <p className="text-lg text-gray-400 mb-10 italic tracking-tight">
        A new way to compete.
      </p>

      {/* Call to Action Button */}
      <button
        onClick={async () => {
          await clearUser();
          const user = localStorage.getItem("user");
          navigate(user ? "/dashboard" : "/login");
        }}
        className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white text-lg font-bold rounded-xl transition-all duration-300 shadow-lg shadow-purple-700/30 hover:shadow-purple-600/50"
      >
        Get Started
      </button>
    </div>
  );
}
