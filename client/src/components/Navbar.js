import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export default function Navbar({ addedClassList = "" }) {
  const navigate = useNavigate();
  const [user, setUser] = useState({});
  const [view, setView] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) setUser(JSON.parse(storedUser));
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setView(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div
      className={`flex flex-row items-center px-6 py-4 w-full bg-black shadow-md ${addedClassList}`}
    >
      {/* Logo */}
      <div>
        <a href="/">
          <i className="fa-solid fa-ranking-star text-4xl text-yellow-300 hover:text-white transition duration-500" />
        </a>
      </div>

      {/* User Menu */}
      <div className="ml-auto relative" ref={dropdownRef}>
        <div className="flex flex-col text-sm text-white">
          <button
            className="bg-black border border-purple-600 rounded px-3 py-2 text-purple-400 font-semibold hover:shadow-[0_0_10px_#a855f7] transition-all duration-300"
            onClick={() => setView(!view)}
          >
            {user.username || "Menu"}
          </button>

          {/* Dropdown */}
          <div
            className={`absolute right-0 mt-2 w-40 bg-gray-900 rounded-md shadow-lg overflow-hidden transition-all duration-300 ${
              view ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <button
              className="w-full text-left px-4 py-2 text-white hover:bg-purple-700 transition"
              onClick={() => {
                navigate("/dashboard");
                setView(false);
              }}
            >
              Dashboard
            </button>

            <button
              className="w-full text-left px-4 py-2 text-white hover:bg-purple-700 transition"
              onClick={() => {
                localStorage.removeItem("user");
                navigate("/login");
                setView(false);
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
