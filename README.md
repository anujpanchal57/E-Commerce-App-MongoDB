# Mongo E-commerce Demo

A small, locally-run e-commerce product-listing app demonstrating **CRUD, full-text search, semantic (vector) search, and sorting** on MongoDB. Built per `APP_SPEC.md`.

## Prerequisites

- Node.js 18+
- A **MongoDB Atlas cluster** (free M0 tier works). Atlas is required even though the app runs locally, because semantic search uses **Atlas Vector Search with Auto-Embedding**, an Atlas-only feature.

## Setup (~5 min)

```bash
npm run setup          # install root, server and client deps
cp .env.example .env   # then edit .env and set MONGODB_URI
npm run seed           # seeds 220 products and prints the Atlas index definitions you need
```

### Create the two Atlas indexes

`npm run seed` prints the exact JSON. In short — Atlas UI → your cluster → **Search** tab → **Create Search Index** → **JSON Editor**:

1. **Full-text index** named `default` on the `products` collection, indexing `name` + `description` as `string` fields.
2. **Vector index** named `vector_index` on `products`, using **Automated Embedding** (index field `type: "autoEmbed"`):

```json
{
  "fields": [
    {
      "type": "autoEmbed",
      "modality": "text",
      "path": "description",
      "model": "voyage-4",
      "similarity": "cosine"
    }
  ]
}
```

The `path` is the **text field** Atlas embeds — embeddings are stored internally by Atlas (no `embedding` field in your documents), and both documents and query strings are embedded automatically. If you index a different field, set `VECTOR_PATH` in `.env` to match. Automated Embedding is a Preview feature with Voyage AI models only.

Wait until both indexes show status **Active** before using search.

## Run

```bash
npm run dev   # API on :3001, UI on http://localhost:5173
```

## Features

- **CRUD**: add / edit / delete / browse products (20 per page) from the UI.
- **Search bar** with a mode toggle:
  - *Full-text* → Atlas Search `$search` on name + description.
  - *Semantic* → Atlas `$vectorSearch` with auto-embedding (the raw query string is sent; Atlas embeds it).
- **Sort**: relevance (search) / newest (browse), price ↑, price ↓, rating ↓, newest. Sorting composes with search results.
- Result cards show category, price, rating, stock status, stock photo, and the search relevance score when searching.

## API

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/products?q=&mode=text\|vector&sort=&page=` | list / search, 20 per page |
| POST | `/api/products` | create; 400 with message on invalid input |
| PUT | `/api/products/:id` | partial update |
| DELETE | `/api/products/:id` | delete |

## Project layout

```
seed.js          # idempotent seeder (deterministic; prints index JSON)
server/          # Express API (official mongodb driver, no ODM)
client/          # React (Vite) UI, proxies /api to :3001
```

## Notes / limitations

- Stock photos are deterministic `picsum.photos` URLs generated at seed time — they are placeholders, not photos of the actual products.
- Vector search sorting composes only over the top vector-search candidates (a `$vectorSearch` limitation); relevance order is preserved only with the default "Relevance" sort.
- The exact auto-embedding index JSON keys can vary with the Atlas UI version — prefer the UI's JSON editor scaffold if the printed definition drifts. If you see `Path 'embedding' is not defined in Automated Embedding index`, your index `path` isn't `description` — set `VECTOR_PATH` in `.env` to the field you indexed.
