import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import { config } from "./config";
import { db } from "./db";
import { authRouter } from "./routes/auth";
import { webhookRouter } from "./routes/webhooks";
import { configRouter } from "./routes/config";
import { startWebhookProcessor } from "./webhook/processor";
import { startScheduler } from "./scheduler/scheduler";
import { nylasClient } from "./nylas/instance";
import { createGrantStore } from "./stores/grantStore";
import { createUserStore } from "./stores/userStore";
import { createMessageStore } from "./stores/messageStore";
import { createScheduleStore } from "./stores/scheduleStore";
import { createInboxReader } from "./inbox/inboxReader";
import { createEmailSender } from "./email/emailSender";
import { createJobRunner } from "./orchestrator/jobRunner";

const app = express();

app.use(express.static(path.join(__dirname, "../public")));
app.use(cookieParser());

app.use("/webhooks", express.raw({ type: "application/json" }));
app.use(express.json());

app.use("/auth", authRouter);
app.use("/webhooks", webhookRouter);
app.use("/config", configRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(config.PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${config.PORT}`);
  console.log(`Base URL: ${config.APP_BASE_URL}`);
  console.log(`Database: ${config.DATABASE_PATH} (${db.name})`);

  startWebhookProcessor(createMessageStore(db), nylasClient);
  console.log("Webhook processor started");

  const jobRunner = createJobRunner(
    createGrantStore(db),
    createUserStore(db),
    createInboxReader(nylasClient),
    createEmailSender(nylasClient)
  );
  startScheduler(createScheduleStore(db), jobRunner);
  console.log("Scheduler started");
});

export { app };
