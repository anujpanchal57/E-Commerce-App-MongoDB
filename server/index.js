import express from 'express';
import { ObjectId } from 'mongodb';
import { client, products } from './db.js';

const app = express();
app.use(express.json());

const PAGE_SIZE = 20;

const SORTS = {
  relevance: { score: -1 }, // search modes only; browse falls back to newest
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  rating_desc: { rating: -1 },
  newest: { createdAt: -1 },
};

const TEXT_INDEX = 'default';        // Atlas Search index on name+description
const VECTOR_INDEX = 'vector_index'; // Atlas Vector Search index with auto-embedding
// Auto-embedding indexes index the TEXT field directly (type "autoEmbed") — path is
// that field's name, embeddings live inside Atlas. Override if your index uses another field.
const VECTOR_PATH = process.env.VECTOR_PATH || 'description';

function validateProduct(body, { partial = false } = {}) {
  const errors = [];
  const req = (field, msg) => {
    if (!partial || field in body) errors.push(msg);
  };
  if (!partial || 'name' in body) {
    if (typeof body.name !== 'string' || !body.name.trim()) req('name', 'name is required (string)');
  }
  if (!partial || 'description' in body) {
    if (typeof body.description !== 'string' || !body.description.trim()) req('description', 'description is required (string)');
  }
  if (!partial || 'category' in body) {
    if (typeof body.category !== 'string' || !body.category.trim()) req('category', 'category is required (string)');
  }
  if (!partial || 'price' in body) {
    if (typeof body.price !== 'number' || !(body.price > 0)) req('price', 'price is required (number > 0)');
  }
  if ('rating' in body && (typeof body.rating !== 'number' || body.rating < 0 || body.rating > 5))
    errors.push('rating must be a number between 0 and 5');
  return errors;
}

const pickFields = (body) => {
  const allowed = ['name', 'description', 'category', 'price', 'inStock', 'rating', 'imageUrl'];
  return Object.fromEntries(allowed.filter((k) => k in body).map((k) => [k, body[k]]));
};

// List + search + sort + paginate
app.get('/api/products', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const mode = req.query.mode === 'vector' ? 'vector' : 'text';
    const sortKey = req.query.sort in SORTS ? req.query.sort : 'relevance';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const skip = (page - 1) * PAGE_SIZE;

    if (!q) {
      const sort = sortKey === 'relevance' ? SORTS.newest : SORTS[sortKey];
      const [items, total] = await Promise.all([
        products.find({}).sort(sort).skip(skip).limit(PAGE_SIZE).toArray(),
        products.countDocuments({}),
      ]);
      return res.json({
        items, total, page, pageSize: PAGE_SIZE, mode: 'browse',
        mongo: { collection: 'products', operation: 'find', filter: {}, sort, skip, limit: PAGE_SIZE },
      });
    }

    // Atlas auto-embedding: query.text is embedded by Atlas with the index's model.
    // No embedding code here.
    const searchStage =
      mode === 'vector'
        ? { $vectorSearch: { index: VECTOR_INDEX, path: VECTOR_PATH, query: { text: q }, numCandidates: 200, limit: skip + PAGE_SIZE } }
        : { $search: { index: TEXT_INDEX, text: { query: q, path: ['name', 'description'] } } };

    const pipeline = [
      searchStage,
      {
        $facet: {
          items: [
            { $addFields: { score: { $meta: mode === 'vector' ? 'vectorSearchScore' : 'searchScore' } } },
            { $sort: SORTS[sortKey] },
            { $skip: skip },
            { $limit: PAGE_SIZE },
          ],
          total: [{ $count: 'n' }],
        },
      },
    ];
    const [result] = await products.aggregate(pipeline).toArray();

    res.json({
      items: result.items, total: result.total[0]?.n ?? 0, page, pageSize: PAGE_SIZE, mode,
      mongo: { collection: 'products', operation: 'aggregate', pipeline },
    });
  } catch (e) {
    next(e);
  }
});

// Create
app.post('/api/products', async (req, res, next) => {
  try {
    const errors = validateProduct(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join('; ') });
    const doc = {
      ...pickFields(req.body),
      inStock: req.body.inStock ?? true,
      rating: req.body.rating ?? 0,
      createdAt: new Date(),
    };
    const { insertedId } = await products.insertOne(doc);
    res.status(201).json({
      product: await products.findOne({ _id: insertedId }),
      mongo: { collection: 'products', operation: 'insertOne', document: doc },
    });
  } catch (e) {
    next(e);
  }
});

// Update
app.put('/api/products/:id', async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'invalid product id' });
    const errors = validateProduct(req.body, { partial: true });
    if (errors.length) return res.status(400).json({ error: errors.join('; ') });
    const $set = pickFields(req.body);
    if (!Object.keys($set).length) return res.status(400).json({ error: 'no updatable fields provided' });
    const filter = { _id: new ObjectId(req.params.id) };
    const result = await products.findOneAndUpdate(filter, { $set }, { returnDocument: 'after' });
    if (!result) return res.status(404).json({ error: 'product not found' });
    res.json({
      product: result,
      mongo: { collection: 'products', operation: 'findOneAndUpdate', filter: { _id: req.params.id }, update: { $set } },
    });
  } catch (e) {
    next(e);
  }
});

// Delete
app.delete('/api/products/:id', async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'invalid product id' });
    const filter = { _id: new ObjectId(req.params.id) };
    const { deletedCount } = await products.deleteOne(filter);
    if (!deletedCount) return res.status(404).json({ error: 'product not found' });
    res.json({ mongo: { collection: 'products', operation: 'deleteOne', filter: { _id: req.params.id } } });
  } catch (e) {
    next(e);
  }
});

// Central error handler — always JSON, never silent
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'internal server error' });
});

const port = process.env.PORT || 3001;
await client.connect();
app.listen(port, () => console.log(`API on http://localhost:${port}`));
