import express from "express";
import { config } from "./config";
import { db } from "./db";
import { authRouter } from "./routes/auth";
import { webhookRouter } from "./routes/webhooks";

const app = express();

// Webhook route must receive the raw body buffer for HMAC verification (M6).
// express.raw() must be mounted before express.json() or the stream is consumed.
app.use("/webhooks", express.raw({ type: "application/json" }));
app.use(express.json());

app.use("/auth", authRouter);
app.use("/webhooks", webhookRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(config.PORT, () => {
  console.log(`Server listening on port ${config.PORT}`);
  console.log(`Base URL: ${config.APP_BASE_URL}`);
  console.log(`Database: ${config.DATABASE_PATH} (${db.name})`);
});

export { app };
