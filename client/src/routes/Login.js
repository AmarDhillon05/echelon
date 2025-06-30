import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function Join() {
  const dburi = "http://localhost:2022/api";
  const navigate = useNavigate();

  async function login() {
    const errorElem = document.getElementById("loginErr");
    errorElem.innerHTML = "";

    const body = {
      username: document.getElementById("loginUsername").value.trim(),
      password: document.getElementById("loginPass").value,
    };

    if (!body.username || !body.password) {
      errorElem.innerHTML = "Fill out all fields";
      return;
    }

    try {
      const { data } = await axios.post(dburi + "/users/sign-in", body);

      if (!data.user) {
        errorElem.innerHTML = data.error;
      } else {
        localStorage.setItem("user", JSON.stringify(data.user));
        navigate("/dashboard");
      }
    } catch (err) {
      const message =
        err.response?.data?.error || "Something went wrong. Please try again.";
      errorElem.innerHTML = message;
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
        <h1 className="text-4xl font-semibold text-purple-400 mb-10 text-left">
          Welcome Back.
        </h1>

        <label
          htmlFor="loginUsername"
          className="block text-white text-2xl font-semibold mb-2"
        >
          Username
        </label>
        <input
          id="loginUsername"
          name="loginUsername"
          placeholder="Your username"
          className="p-3 mb-6 w-full rounded border border-purple-700 bg-black text-white outline-none focus:ring-2 focus:ring-purple-500"
          autoComplete="username"
        />

        <label
          htmlFor="loginPass"
          className="block text-white text-2xl font-semibold mb-2"
        >
          Password
        </label>
        <input
          id="loginPass"
          name="loginPass"
          type="password"
          placeholder="••••••••••"
          className="p-3 mb-6 w-full rounded border border-purple-700 bg-black text-white outline-none focus:ring-2 focus:ring-purple-500"
          autoComplete="current-password"
        />

        <button
          onClick={login}
          className="w-full py-3 bg-purple-600 text-white font-bold rounded hover:bg-purple-700 transition"
        >
          Login
        </button>

        <p
          id="loginErr"
          className="mt-4 text-red-500 font-semibold text-center min-h-[1.25rem]"
        ></p>

        <a
          href="/join"
          className="block mt-6 text-purple-500 italic text-center hover:text-purple-700 transition"
        >
          New? Join Here
        </a>
      </div>
    </div>
  );
}
