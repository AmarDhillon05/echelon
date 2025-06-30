import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function Join() {
  const dburi = "http://localhost:2022/api";
  const navigate = useNavigate();

  async function create() {
    const pass = document.getElementById("joinPass").value;
    const error = document.getElementById("joinErr");
    error.innerHTML = "";

    if (pass !== document.getElementById("joinPassConf").value) {
      error.innerHTML = "Passwords don't match";
      return;
    }

    const body = {
      username: document.getElementById("joinUsername").value.trim(),
      password: pass,
      email: document.getElementById("joinEmail").value.trim(),
    };

    if (!body.username || !body.password || !body.email) {
      error.innerHTML = "Fill out all fields";
      return;
    }

    try {
      const { data } = await axios.post(dburi + "/users/create", body);

      if (!data.user) {
        error.innerHTML = data.error;
      } else {
        localStorage.setItem("user", JSON.stringify(data.user));
        navigate("/dashboard");
      }
    } catch (err) {
      const message =
        err.response?.data?.error || "Something went wrong. Please try again.";
      error.innerHTML = message;
    }
  }

  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-black px-4">
      <div className="w-full max-w-md text-left p-6">
  <h1 className="text-3xl font-bold text-white flex items-center gap-3">
    <a href="/" className="flex-shrink-0">
      <i className="fa-solid fa-ranking-star text-4xl text-yellow-300 hover:text-white transition duration-700"></i>
    </a>
    <span className="text-purple-400 font-semibold whitespace-nowrap">
      eche
      <span className="text-purple-300">lon</span>
    </span>
  </h1>
</div>


      <div className="w-full max-w-md bg-gray-900 rounded-xl p-8 shadow-[0_0_20px_#a855f7]">
        <h1 className="text-4xl font-semibold text-purple-400 mb-10">
          Join the <span className="text-teal-300 font-bold">Race</span>.
        </h1>

        <label htmlFor="joinUsername" className="block text-white text-2xl font-semibold mb-2">
          Username
        </label>
        <input
          id="joinUsername"
          name="joinUsername"
          placeholder="e.g. spon96"
          className="p-3 mb-6 w-full rounded border border-purple-700 bg-black text-white outline-none focus:ring-2 focus:ring-purple-500"
          autoComplete="username"
        />

        <label htmlFor="joinEmail" className="block text-white text-2xl font-semibold mb-2">
          Email
        </label>
        <input
          id="joinEmail"
          name="joinEmail"
          placeholder="example@umd.edu"
          className="p-3 mb-6 w-full rounded border border-purple-700 bg-black text-white outline-none focus:ring-2 focus:ring-purple-500"
          autoComplete="email"
        />

        <label htmlFor="joinPass" className="block text-white text-2xl font-semibold mb-2">
          Password
        </label>
        <input
          id="joinPass"
          name="joinPass"
          type="password"
          placeholder="••••••••••"
          className="p-3 mb-6 w-full rounded border border-purple-700 bg-black text-white outline-none focus:ring-2 focus:ring-purple-500"
          autoComplete="new-password"
        />

        <label htmlFor="joinPassConf" className="block text-white text-2xl font-semibold mb-2">
          Confirm Password
        </label>
        <input
          id="joinPassConf"
          name="joinPassConf"
          type="password"
          placeholder="••••••••••"
          className="p-3 mb-6 w-full rounded border border-purple-700 bg-black text-white outline-none focus:ring-2 focus:ring-purple-500"
          autoComplete="new-password"
        />

        <button
          className="w-full py-3 bg-purple-600 text-white font-bold rounded hover:bg-purple-700 transition"
          onClick={create}
        >
          Create an Account
        </button>

        <a
          href="/login"
          className="block mt-6 text-purple-500 italic text-center hover:text-purple-700 transition"
        >
          Not New? Login Here
        </a>

        <p id="joinErr" className="mt-4 text-red-500 font-semibold text-center"></p>
      </div>
    </div>
  );
}
