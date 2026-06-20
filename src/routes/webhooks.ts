import { Router } from "express";

export const webhookRouter = Router();

webhookRouter.get("/nylas", (req, res) => {
  const { challenge } = req.query;

  if (typeof challenge !== "string" || challenge.length === 0) {
    res.status(400).send("Missing challenge parameter.");
    return;
  }

  res.type("text/plain").send(challenge);
});
