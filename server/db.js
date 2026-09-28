import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

// Server cwd is server/ under `npm --prefix`, so load the root .env explicitly,
// then a local server/.env (never overrides already-set vars).
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('Missing MONGODB_URI. Copy .env.example to .env and set your Atlas URI.');
  process.exit(1);
}

export const client = new MongoClient(uri);
export const db = client.db(process.env.DB_NAME || 'ecommerce_demo');
export const products = db.collection('products');
