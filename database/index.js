import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

import userRoutes from "./routes/authRoutes.js";
import ldRoutes from "./routes/ldRoutes.js";
import rankRoutes from "./routes/rankRoutes.js";

app.get("/", (req, res) => {
  res.send("echelon db volume 3");
});

app.use("/api/users", userRoutes);
app.use("/api/leaderboard", ldRoutes);
app.use("/api/rank", rankRoutes);

// Local dev only

if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 2022;
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}//


// Export for Vercel
export default app;
