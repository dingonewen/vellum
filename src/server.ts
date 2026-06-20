import express from "express";
import { config } from "./config";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(config.PORT, () => {
  console.log(`Server listening on port ${config.PORT}`);
  console.log(`Base URL: ${config.APP_BASE_URL}`);
});

export { app };
