import 'dotenv/config';
import BetterSqlite3 from 'better-sqlite3';
import * as path from 'path';
import { createNylasClient } from './src/nylas/nylasClient';

const dbPath = path.resolve(process.cwd(), process.env.DATABASE_PATH || './data/vellum.db');
const db = new BetterSqlite3(dbPath, { readonly: true });
const buyer = db.prepare("SELECT grant_id, email FROM grants WHERE mailbox_type = 'buyer_inbox' LIMIT 1").get() as any;
db.close();

const nylas = createNylasClient();

async function main() {
  console.log('Sending from:', buyer.email);
  try {
    const r = await nylas.sendMessage(buyer.grant_id, 'dingonewen@gmail.com', 'Test send ' + Date.now(), '<p>Can Tifa send?</p>');
    console.log('SUCCESS:', r.messageId);
  } catch (e: any) {
    console.error('FAILED:', e.message, e.statusCode);
  }
}

main();
