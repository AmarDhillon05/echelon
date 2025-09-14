import { useState } from "react";
import axios from "axios";
import { Loader2 } from "lucide-react"; // spinner

export default function DevpostAdd({ show, exit, user, ldStateUpdate }) {
  const apiuri = process.env.REACT_APP_PYAPI_URI;
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  async function returnSearchTerms() {
    setLoading(true);
    setError("");
    setResults([]);
    try {
      const { data } = await axios.post(apiuri + "/search", { query: searchTerm });

      if (!data.error) {
        setResults(data.results || []);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Search failed.");
    } finally {
      setLoading(false);
    }
  }

  async function addFromDevpost() {
    setAdding(true);
    setError("");
    try {
      const { data } = await axios.post(apiuri + "/create", {
        admin: user.username,
        hackathon_name: searchTerm,
      });

      if (data.error) {
        setError(data.error);
      } else {
        localStorage.setItem("user", JSON.stringify(data.hackathon.user));
        ldStateUpdate(data.hackathon.user);
        exit();
      }
    } catch (err) {
      setError("Creation failed.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div
      className={`${
        show ? "scale-100 opacity-100" : "scale-90 opacity-0 pointer-events-none"
      } transition-all duration-200 fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50`}
    >
      <div className="bg-zinc-950 p-8 rounded-2xl shadow-[0_0_30px_#a855f7] w-[90%] max-w-2xl h-[90%] overflow-y-auto border border-purple-700">
        {/* Header */}
        <div className="flex items-center mb-6">
          <h1 className="text-2xl font-bold text-purple-400 drop-shadow-[0_0_6px_#a855f7]">
            Import from Devpost
          </h1>
          <button
            onClick={exit}
            className="ml-auto text-white bg-red-500 hover:bg-red-600 px-3 py-1 rounded text-lg"
          >
            ✕
          </button>
        </div>

        {/* Search bar */}
        <div className="flex mb-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 rounded-l-lg bg-black border border-purple-700 text-white placeholder-gray-400 focus:outline-none"
            placeholder="Search hackathons..."
          />
          <button
            onClick={returnSearchTerms}
            disabled={loading || !searchTerm}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-r-lg text-white font-semibold flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
          </button>
        </div>

        {/* Results */}
        <div className="mb-4 space-y-2 max-h-48 overflow-y-auto">
          {results.map((item, idx) => (
            <div
              key={idx}
              onClick={() => setSearchTerm(item)}
              className={`cursor-pointer px-3 py-2 rounded-lg transition ${
                searchTerm === item
                  ? "bg-purple-700 text-white"
                  : "bg-zinc-800 hover:bg-purple-700 text-gray-200"
              }`}
            >
              {item}
            </div>
          ))}
          {!loading && results.length === 0 && searchTerm && (
            <p className="text-gray-400 italic text-center">No hackathons found</p>
          )}
        </div>

        {/* Add */}
        <button
          onClick={addFromDevpost}
          disabled={!searchTerm || adding}
          className="w-full mt-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg shadow-[0_0_12px_#a855f7] flex items-center justify-center gap-2"
        >
          {adding ? <Loader2 className="w-5 h-5 animate-spin" /> : "Add Hackathon"}
        </button>

        {/* Error */}
        {error && <p className="text-red-500 italic font-bold mt-4 text-center">{error}</p>}
      </div>
    </div>
  );
}
