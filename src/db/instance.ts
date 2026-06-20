import { config } from "../config";
import { initDb } from "./database";
import type { Db } from "./database";

export const db: Db = initDb(config.DATABASE_PATH);
