import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./routes/Home"
import Profile from "./routes/Profile"
import Join from "./routes/Join"
import Login from "./routes/Login"
import Dashboard from "./routes/Dashboard"
import ComparePage from "./routes/ComparePage"
import Leaderboard from "./routes/Leaderboard";


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
          <Route index element={<Home />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="rank/:id" element={<ComparePage />} />
          <Route path="profile" element={<Profile />} />
          <Route path="join" element={<Join />} />
          <Route path="login" element={<Login />} />
          <Route path="leaderboard/:id" element={<Leaderboard />} />
      </Routes>
    </BrowserRouter>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);