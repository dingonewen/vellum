import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import { config } from "./config";
import { authRouter } from "./routes/auth";
import { webhookRouter } from "./routes/webhooks";
import { settingsRouter } from "./routes/settings";

const app = express();

app.use(express.static(path.join(__dirname, "../public")));
app.use(cookieParser());

app.use("/webhooks", express.raw({ type: "application/json" }));
app.use(express.json());

app.use("/auth", authRouter);
app.use("/webhooks", webhookRouter);
app.use("/settings", settingsRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(config.PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${config.PORT}`);
  console.log(`Base URL: ${config.APP_BASE_URL}`);
  console.log(`Database: ${config.DATABASE_PATH}`);
});
