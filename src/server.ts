import express from "express";
import { config } from "./config";
import { db } from "./db";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(config.PORT, () => {
  console.log(`Server listening on port ${config.PORT}`);
  console.log(`Base URL: ${config.APP_BASE_URL}`);
  console.log(`Database: ${config.DATABASE_PATH} (${db.name})`);
});

export { app };
