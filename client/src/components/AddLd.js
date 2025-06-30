import { useState } from "react";
import axios from "axios";

function Requirement({ name, type, requirements, setRequirements, index }) {
  return (
    <div
      className="flex flex-row justify-between items-center bg-gray-800 px-4 py-2 rounded mb-2 shadow-[0_0_6px_#a855f7]"
      key={index}
    >
      <p className="italic text-white">{`${name} - ${type}`}</p>
      <button
        className="text-white bg-red-500 px-2 py-1 rounded hover:bg-red-600"
        onClick={() => {
          setRequirements(requirements.filter((x) => x.name !== name || x.type !== type));
        }}
      >
        ✕
      </button>
    </div>
  );
}

export default function AddLd({ show, exit, ldStateUpdate }) {
  const [requirements, setRequirements] = useState([]);
  const dburi = "http://localhost:2022/api";

  async function handleCreate() {
    const body = {
      name: document.getElementById("newLdName").value,
      host: JSON.parse(localStorage.getItem("user")).username,
      description: document.getElementById("newLdDescr").value,
      required: requirements,
    };
    try {
      const { data } = await axios.post(dburi + "/leaderboard/createLeaderboard", body);
      if (data.error) {
        document.getElementById("reqErrText").innerHTML = `Ran into error: ${data.error}`;
      } else {
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
      <div className="bg-black p-8 rounded-xl shadow-[0_0_30px_#a855f7] w-[90%] max-w-2xl h-[90%] overflow-y-auto border border-purple-700">
        {/* Header */}
        <div className="flex flex-row items-center mb-6">
          <h1 className="text-2xl text-white font-bold">Create a Leaderboard</h1>
          <button
            className="text-white bg-red-500 px-2 py-1 rounded hover:bg-red-600 ml-auto w-8 h-8"
            onClick={exit}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <label htmlFor="newLdName" className="text-white block mb-1">
          Name:
        </label>
        <input
          name="newLdName"
          id="newLdName"
          className="border border-white bg-black text-white p-2 w-full mb-4 rounded shadow-inner outline-none focus:ring-2 focus:ring-purple-600"
        />

        <label htmlFor="newLdDescr" className="text-white block mb-1">
          Description:
        </label>
        <input
          name="newLdDescr"
          id="newLdDescr"
          className="border border-white bg-black text-white p-2 w-full mb-4 rounded shadow-inner outline-none focus:ring-2 focus:ring-purple-600"
        />

        {/* Requirements List */}
        <p className="text-white mb-2">Required fields:</p>
        {requirements.length === 0 ? (
          <p className="italic text-gray-400 mb-4">No requirements yet</p>
        ) : (
          requirements.map((req, i) => (
            <Requirement
              name={req.name}
              type={req.type}
              requirements={requirements}
              setRequirements={setRequirements}
              index={i}
            />
          ))
        )}

        {/* Add Requirement */}
        <div className="flex flex-wrap gap-4 items-end mb-6">
          <div className="flex flex-col">
            <label htmlFor="newReqName" className="text-white mb-1">
              Name:
            </label>
            <input
              name="newReqName"
              id="newReqName"
              className="border border-white bg-black text-white p-2 rounded outline-none focus:ring-2 focus:ring-purple-600"
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="newReqType" className="text-white mb-1">
              Type:
            </label>
            <select
              name="newReqType"
              id="newReqType"
              className="border border-white bg-black text-white p-2 rounded outline-none focus:ring-2 focus:ring-purple-600"
            >
              <option value="text">Text</option>
              <option value="image">Image</option>
              <option value="audio">Audio</option>
              <option value="video">Video</option>
              <option value="link">Link</option>
            </select>
          </div>

          <button
            className="bg-purple-700 hover:bg-purple-800 text-white px-4 py-2 rounded shadow-[0_0_10px_#a855f7]"
            onClick={() => {
              const name = document.getElementById("newReqName").value;
              const type = document.getElementById("newReqType").value;
              if (name === "" || type === "") {
                document.getElementById("reqErrText").innerHTML = "Fill out all fields";
              } else {
                const allNames = requirements.map((x) => x.name);
                if (allNames.includes(name)) {
                  document.getElementById("reqErrText").innerHTML = "No duplicates allowed";
                } else {
                  document.getElementById("reqErrText").innerHTML = "";
                  setRequirements([...requirements, { name, type }]);
                }
              }
            }}
          >
            Add
          </button>

          <p className="text-red-500 italic" id="reqErrText"></p>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-2 rounded shadow-[0_0_10px_#a855f7]"
            onClick={handleCreate}
          >
            Create Leaderboard
          </button>
        </div>
      </div>
    </div>
  );
}
