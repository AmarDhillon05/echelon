import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import pako from "pako";
import Navbar from "../components/Navbar";




export default function Leaderboard() {
  const navigate = useNavigate();
  const { id } = useParams();
  const api_link = process.env.REACT_APP_DBAPI_URI;

  const [ld, setLd] = useState({});
  const [contributors, setContributors] = useState([]);
  const [currentContributor, setCurrentContributor] = useState("");
  const [contributorValid, setContributorValid] = useState(null);
  const [user, setUser] = useState({});
  const [inputs, setInputs] = useState([""]);
  const [captions, setCaptions] = useState([""]);
  const [expanded, setExpanded] = useState(false);

  // Initial setup
  useEffect(() => {
    const userObj = localStorage.getItem("user");
    if (!userObj) navigate("/login");
    else setUser(JSON.parse(userObj));
    updateLd();
  }, []);



 async function updateLd() {
  const maxRetries = 10;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log(`Searching leaderboard id ${id}, attempt ${attempt + 1}`);

      const { data } = await axios.post(
        api_link + "/leaderboard/getLeaderboardById",
        { id }
      );

      const ldb = data.leaderboard;
      ldb.id = id;
      setLd(ldb);

      return; //  success, exit the function
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) {
        console.error(" Max retries reached. Could not fetch leaderboard:", err);
        throw err;
      }

      // exponential backoff: 100ms * 2^attempt
      const delay = 100 * Math.pow(2, attempt);
      console.warn(` Error occurred. Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}





  // File compression
  async function compressFileToBase64(file) {
    const arrayBuffer = await file.arrayBuffer();
    const compressed = pako.deflate(new Uint8Array(arrayBuffer));
    const base64 = btoa(String.fromCharCode(...compressed));
    return {
      base64: base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
      mimeType: file.type || "application/octet-stream",
    };
  }



  //Does NOT pair with compress
  function decompressbase64(base64, mimeType = "image/jpeg") {
    if (!base64) return "";

    // Convert base64url back to standard base64
    const padded = base64.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - base64.length % 4) % 4);
    const binary = atob(padded);

    // Convert binary string to Uint8Array
    const compressedBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      compressedBytes[i] = binary.charCodeAt(i);
    }

    // Decompress using pako
    const decompressed = pako.inflate(compressedBytes);

    // Turn back into a Blob and generate a blob URL
    const blob = new Blob([decompressed], { type: mimeType });
    return URL.createObjectURL(blob);
  }





  // Contributor validation
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
    confirmUser().then(valid => setContributorValid(valid));
  }, [currentContributor]);

  // Form submit
  async function newSubmission(e) {
    e.preventDefault();
    const form = document.getElementById("submission");
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    for (const [key, value] of Object.entries(data)) {
      if (value instanceof File && value.size > 0) {
        const dtype = ld.required?.find((x) => x.name === key)?.type || "";
        if (!value.type.includes(dtype)) {
          document.getElementById("subErrText").innerHTML = `Wrong file type for "${key}"`;
          return;
        }
        data[key] = await compressFileToBase64(value);
      } else if (!value) {
        document.getElementById("subErrText").innerHTML = "Fill out all fields!";
        return;
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
        await updateLd();
      }
    } catch {
      document.getElementById("subErrText").innerHTML = "Unable to submit.";
    }
  }

  // For "any" type inputs
  function MultipleInputList({ req }) {
    const addInput = () => {
      setInputs([...inputs, ""]);
      setCaptions([...captions, ""]);
    };

    const removeInput = (index) => {
      setInputs(inputs.filter((_, i) => i !== index));
      setCaptions(captions.filter((_, i) => i !== index));
    };

    return (
      <div className="space-y-2">
        {inputs.map((_, index) => (
          <div key={index} className="flex gap-2 items-center">
            <input
              type={["text", "link"].includes(req.type) ? "text" : "file"}
              name={`${req.name} ${index}`}
              className="bg-black text-white p-2 rounded w-full border border-purple-700"
            />
            <input
              type="text"
              name={`${req.name} ${index} caption`}
              placeholder="Caption"
              className="bg-black text-white p-2 rounded border border-purple-700 w-full"
            />
            {inputs.length > 1 && (
              <button type="button" onClick={() => removeInput(index)} className="text-red-500 px-2 py-1">
                ✕
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={addInput} className="text-sm text-purple-400 hover:underline">
          + Add another
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-900 to-black text-white">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-2 gap-10">



        {/* Leaderboard Panel */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-[0_0_25px_#a855f7aa]">
          <div className="flex justify-between mb-6">

        <div
          className="w-full h-60 rounded-xl relative overflow-hidden bg-cover bg-center"
          style={{
            backgroundImage: `
              linear-gradient(to top, rgba(0,0,0,1), rgba(0,0,0,0.4), transparent),
              url(${decompressbase64(ld.coverPhoto)})
            `
          }}
        >
          <h1 className="absolute bottom-0 p-6 text-3xl font-bold text-purple-400 drop-shadow-lg">
            {ld.name}
          </h1>
        </div>




            
          </div>

          <p className="text-lg font-semibold text-purple-300">{ld.n_votes || 0} votes</p>


       <div className="text-gray-300">


      <div
        className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${
          expanded ? "max-h-[20rem]" : "max-h-[1.5rem]"
        }`}
      >
        <p dangerouslySetInnerHTML={{ __html: ld.description }} />
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2 text-purple-400 hover:text-purple-300 text-sm font-medium"
      >
        {expanded ? "Show less" : "Show more"}
      </button>

      
    </div>


          <h2 className="text-2xl font-semibold mb-4">Leaderboard</h2>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {ld.order?.length ? (
              ld.order.map((subname, i) => {
                const sub = ld.submissions?.[subname];
                if (!sub) return null;
                return (


                  <button
                    key={i}
                    className="flex justify-between items-center px-4 py-3 w-80 bg-gray-800 hover:scale-[1.005] hover:bg-gray-900 rounded-lg transition-all duration-300"
                    onClick={() => {
                      navigate("/submission/" + ld._id + "-" + sub.subid)
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-xl font-bold text-yellow-400 animate-pulse">#{i + 1}</div>
                      <div>
                        <p className="font-semibold">{subname}</p>
                        <p className="text-sm text-gray-400">ELO: {parseInt(sub.elo)}</p>
                      </div>
                    </div>
                    <span className="text-sm text-gray-300">Rank {sub.rank}</span>
                  </button>


                );
              })
            ) : (
              <p className="text-gray-500 italic">No submissions yet.</p>
            )}
          </div>
          <button
            className="mt-6 w-full py-2 bg-purple-600 hover:bg-purple-700 rounded-md font-bold transition shadow-md shadow-purple-800/40"
            onClick={() => navigate("/rank/" + id)}
          >
            Start Playing
          </button>
        </div>


        

        {/* Submission Panel */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-[0_0_25px_#a855f7aa]">
          {ld.locked ? (
            <p className="text-red-400 font-medium">Submissions are locked for this board.</p>
          ) : (
            <>
              <h2 className="text-3xl font-semibold text-purple-400 mb-4">Submit Your Project</h2>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-1">Add Contributor</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={currentContributor}
                    onChange={(e) => setCurrentContributor(e.target.value)}
                    className="bg-black text-white p-2 rounded border border-purple-700 w-full"
                  />
                  <button
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-sm rounded"
                    onClick={() => {
                      if (contributorValid && currentContributor) {
                        setContributors([...contributors, currentContributor]);
                        setCurrentContributor("");
                      }
                    }}
                  >
                    Add
                  </button>
                </div>
                {currentContributor && (
                  <p
                    className={`text-sm mt-1 ${
                      contributorValid ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {contributorValid ? "Valid contributor" : "User not found"}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  {contributors.map((c, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-gray-800 text-sm rounded-full flex items-center gap-2"
                    >
                      {c}
                      <button
                        onClick={() => setContributors(contributors.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <form id="submission" onSubmit={newSubmission} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm mb-1">
                    Submission Name
                  </label>
                  <input
                    name="name"
                    id="name"
                    type="text"
                    className="bg-black text-white p-2 rounded w-full border border-purple-700"
                  />
                </div>

                {ld.required?.map((req, key) => (
                  <div key={key}>
                    <label htmlFor={req.name} className="block text-sm mb-1">
                      {req.name} ({req.type})
                    </label>
                    {req.list === "yes" ? (
                      req.amount === "any" ? (
                        <MultipleInputList req={req} />
                      ) : (
                        Array.from({ length: parseInt(req.amount) || 1 }).map((_, i) => (
                          <input
                            key={i}
                            type={["text", "link"].includes(req.type) ? "text" : "file"}
                            name={`${req.name} ${i}`}
                            className="bg-black text-white p-2 rounded w-full border border-purple-700 mb-2"
                          />
                        ))
                      )
                    ) : (
                      <input
                        type={["text", "link"].includes(req.type) ? "text" : "file"}
                        name={req.name}
                        className="bg-black text-white p-2 rounded w-full border border-purple-700"
                      />
                    )}
                  </div>
                ))}

                <button
                  type="submit"
                  className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-md shadow-md shadow-purple-800/40"
                >
                  Submit
                </button>
              </form>

              <p className="text-red-500 mt-2" id="subErrText"></p>
              <p className="text-green-500 mt-1" id="subConfText"></p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
