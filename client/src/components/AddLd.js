import { useState } from "react";
import axios from "axios";
import pako from "pako";


async function compressToBase64(file) {
  const arrayBuffer = await file.arrayBuffer();
  const compressed = pako.deflate(new Uint8Array(arrayBuffer), { level: 9 }); // max compression

  // Convert compressed bytes to base64 string manually (avoid stack overflow)
  const binary = Array.from(compressed)
    .map((byte) => String.fromCharCode(byte))
    .join("");

  const base64 = btoa(binary); // standard base64

  // Make it URL-safe (base64url variant)
  const base64url = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  return {
    base64: base64url,
    mimeType: file.type || "application/octet-stream",
  };
}



// Single requirement display component
function Requirement({ name, type, requirements, setRequirements, index, listornot, amount, important }) {
  return (
    <div
      key={index}
      className="flex flex-row justify-between items-center bg-zinc-900 px-4 py-2 rounded mb-2 shadow-[0_0_8px_#a855f7aa]"
    >
      <p className="text-white text-sm">
        <span className="italic">{name}</span> – {type} –{" "}
        {important === "yes" ? "Used in ranking" : "Not used in ranking"} –{" "}
        {listornot === "yes" ? `List of size ${amount}` : "Single"}
      </p>
      <button
        className="text-white bg-red-500 px-2 py-1 rounded hover:bg-red-600"
        onClick={() =>
          setRequirements(requirements.filter((x) => x.name !== name || x.type !== type))
        }
      >
        ✕
      </button>
    </div>
  );
}



export default function AddLd({ show, exit, ldStateUpdate }) {
  const [requirements, setRequirements] = useState([]);
  const [showAmount, setShowAmount] = useState(false);


  
  const dburi = process.env.REACT_APP_DBAPI_URI;



  async function handleCreate() {

    const name = document.getElementById("newLdName").value;
    const description = document.getElementById("newLdDescr").value;

    let coverPhotoF = document.getElementById("coverPhoto").files[0]
    if(!coverPhotoF || name == "" || description == ""){
      document.getElementById("reqErrText").innerHTML = "Must fill out all fields"
    }

  
    const compressed = await compressToBase64(coverPhotoF)
    const coverPhoto = compressed.base64
    const t = compressed.mimeType
    if(t != "image"){
      document.getElementById("reqErrText").innerHTML = "Cover Photo must be an image"
    }
    console.log(coverPhoto)

    const user = JSON.parse(localStorage.getItem("user"));
    const body = {
      name,
      host: user.username,
      coverPhoto,
      description,
      required: requirements,
    };
    try {
      const { data } = await axios.post(dburi + "/leaderboard/createLeaderboard", body);
      if (data.error) {
        document.getElementById("reqErrText").innerHTML = `Ran into error: ${data.error}`;
      } else {
        console.log(data)
        localStorage.setItem("user", JSON.stringify(data.user));
        ldStateUpdate(data.user);
        exit();
      }

      
    } catch (e) {
      document.getElementById("reqErrText").innerHTML = `Ran into error: ${e.message}`;
    }
  }



  return (
    <div
      className={`${
        show ? "scale-100 opacity-100" : "scale-90 opacity-0 pointer-events-none"
      } transition-all duration-200 fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50`}
    >
      <div className="bg-zinc-950 p-8 rounded-2xl shadow-[0_0_10px_#a855f7] w-[90%] max-w-2xl h-[90%] overflow-y-auto border border-purple-700">
        {/* Header */}
        <div className="flex items-center mb-6">
          <h1 className="text-2xl font-bold text-purple-400 drop-shadow-[0_0_6px_#a855f7]">
            Create a Leaderboard
          </h1>
          <button
            onClick={exit}
            className="ml-auto text-white bg-red-500 hover:bg-red-600 px-3 py-1 rounded text-lg"
          >
            ✕
          </button>
        </div>

        {/* Leaderboard Info */}
        <label htmlFor="newLdName" className="text-white text-sm">Name:</label>
        <input
          id="newLdName"
          className="w-full mb-4 p-2 bg-black border border-white rounded text-white focus:ring-2 focus:ring-purple-600"
        />

        <label htmlFor="newLdDescr" className="text-white text-sm">Description:</label>
        <input
          id="newLdDescr"
          className="w-full mb-6 p-2 bg-black border border-white rounded text-white focus:ring-2 focus:ring-purple-600"
        />


        <label htmlFor = "coverPhoto" className = "text-white text-sm">Cover Photo:</label>
        <input 
          type = "file"
          id = "coverPhoto"
          className = "w-full mb-6 p-2 bg-black border border-white rounded text-white focus:ring-2 focus:ring-purple-600"
        />


        {/* Existing Requirements */}
        <p className="text-white mb-2 font-semibold">Required fields:</p>
        {requirements.length === 0 ? (
          <p className="italic text-gray-400 mb-4">No requirements added yet.</p>
        ) : (
          requirements.map((req, i) => (
            <Requirement
              {...req}
              index={i}
              requirements={requirements}
              setRequirements={setRequirements}
            />
          ))
        )}

        {/* Add Requirement */}
        <div className="flex flex-wrap gap-4 gap-y-3 items-end mb-6">
          <div className="flex flex-col">
            <label htmlFor="newReqName" className="text-white text-sm">Name</label>
            <input
              id="newReqName"
              className="p-2 rounded bg-black border border-white text-white focus:ring-2 focus:ring-purple-600"
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="newReqType" className="text-white text-sm">Type</label>
            <select
              id="newReqType"
              className="p-2 rounded bg-black border border-white text-white focus:ring-2 focus:ring-purple-600"
            >
              <option value="text">Text</option>
              <option value="image">Image</option>
              <option value="audio">Audio</option>
              <option value="video">Video</option>
              <option value="link">Link</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label htmlFor="important" className="text-white text-sm">Use in ranking</label>
            <select
              id="important"
              className="p-2 rounded bg-black border border-white text-white focus:ring-2 focus:ring-purple-600"
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label htmlFor="listOrNot" className="text-white text-sm">List?</label>
            <select
              id="listOrNot"
              onChange={(e) => setShowAmount(e.target.value === "yes")}
              className="p-2 rounded bg-black border border-white text-white focus:ring-2 focus:ring-purple-600"
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>

          {showAmount && (
            <div className="flex flex-col">
              <label htmlFor="amount" className="text-white text-sm">Amount</label>
              <select
                id="amount"
                className="p-2 rounded bg-black border border-white text-white focus:ring-2 focus:ring-purple-600"
              >
                <option value="any">Any</option>
                {Array.from({ length: 15 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => {
              const name = document.getElementById("newReqName").value.trim();
              const type = document.getElementById("newReqType").value;
              const listornot = document.getElementById("listOrNot").value;
              const important = document.getElementById("important").value;

              if (!name) {
                document.getElementById("reqErrText").innerText = "Name is required.";
                return;
              }

              if (requirements.some((r) => r.name === name)) {
                document.getElementById("reqErrText").innerText = "Duplicate names not allowed.";
                return;
              }

              const newReq = {
                name,
                type,
                list: listornot,
                important,
                amount: listornot === "yes" ? document.getElementById("amount").value : undefined,
              };

              setRequirements([...requirements, newReq]);
              document.getElementById("reqErrText").innerText = "";
            }}
            className="bg-purple-700 hover:bg-purple-800 text-white px-4 py-2 rounded shadow-[0_0_10px_#a855f7]"
          >
            Add
          </button>
        </div>
        <p id="reqErrText" className="text-red-500 text-sm italic mb-4"></p>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            onClick={handleCreate}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-2 rounded shadow-[0_0_10px_#a855f7]"
          >
            Create Leaderboard
          </button>
        </div>
      </div>
    </div>
  );
}
