import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  APP_BASE_URL: z.string().url(),
  CALLBACK_URL: z.string().url(),

  NYLAS_API_KEY: z.string().min(1),
  NYLAS_CLIENT_ID: z.string().min(1),
  NYLAS_WEBHOOK_SECRET: z.string().default(""),
  NYLAS_API_URI: z.string().url().default("https://api.us.nylas.com"),

  ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5-20251001"),

  DATABASE_PATH: z.string().default("./data/vellum.db"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Missing or invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
