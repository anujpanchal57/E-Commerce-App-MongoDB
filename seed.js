import 'dotenv/config';
import { MongoClient } from 'mongodb';

// --- Deterministic RNG (mulberry32) so reseeds produce identical slugs/imageUrls ---
let state = 42;
const rand = () => {
  state |= 0; state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const CATALOG = {
  Electronics: {
    brands: ['NovaTech', 'Circuitly', 'VoltEdge', 'PixelCore', 'Auralux'],
    items: [
      ['Wireless Noise-Cancelling Headphones', 'over-ear headphones with active noise cancellation, 40-hour battery life and plush memory-foam earcups'],
      ['Bluetooth Earbuds', 'compact true-wireless earbuds with touch controls, water resistance and a pocketable charging case'],
      ['4K Action Camera', 'rugged waterproof action camera recording stabilized 4K60 video for adventures'],
      ['Smart Speaker', 'voice-controlled smart speaker with room-filling 360-degree sound'],
      ['Portable Power Bank', 'slim 20000mAh power bank with fast USB-C charging for phones and tablets'],
      ['Mechanical Keyboard', 'hot-swappable mechanical keyboard with tactile switches and per-key RGB lighting'],
      ['Ultrawide Monitor', '34-inch curved ultrawide monitor with 144Hz refresh for work and gaming'],
      ['Webcam Pro', '1080p60 webcam with auto light correction and a noise-reducing dual microphone'],
    ],
  },
  Home: {
    brands: ['Hearth&Co', 'NordicNest', 'CasaMia', 'UrbanRoots', 'CozyCraft'],
    items: [
      ['Insulated Water Bottle', 'double-wall vacuum-insulated stainless steel bottle that keeps drinks cold for 24 hours or hot for 12'],
      ['French Press Coffee Maker', 'borosilicate glass french press for rich, full-bodied coffee in four minutes'],
      ['Ceramic Pour-Over Dripper', 'hand-glazed ceramic dripper for a clean, aromatic pour-over brew'],
      ['Throw Blanket', 'chunky-knit weighted throw blanket in soft hypoallergenic yarn'],
      ['Scented Soy Candle', 'hand-poured soy candle with cedarwood and vanilla notes, 50-hour burn time'],
      ['Bamboo Cutting Board', 'end-grain bamboo cutting board, gentle on knife edges and naturally antimicrobial'],
      ['Air Purifier', 'HEPA air purifier that quietly removes dust, pollen and pet dander from rooms up to 400 sq ft'],
      ['Cast Iron Skillet', 'pre-seasoned 12-inch cast iron skillet for searing, baking and campfire cooking'],
    ],
  },
  Apparel: {
    brands: ['Trailhead', 'Merryweather', 'StitchLab', 'Fieldstone', 'Alderwear'],
    items: [
      ['Merino Wool Hiking Socks', 'moisture-wicking merino wool socks with cushioned soles for long trail days'],
      ['Waterproof Rain Jacket', 'lightweight 3-layer waterproof shell jacket with taped seams and packable hood'],
      ['Organic Cotton T-Shirt', 'soft organic cotton tee with a relaxed everyday fit'],
      ['Insulated Puffer Vest', 'recycled-down puffer vest that layers easily in cold weather'],
      ['Canvas Sneakers', 'classic low-top canvas sneakers with vulcanized rubber soles'],
      ['Fleece Hoodie', 'brushed fleece pullover hoodie with kangaroo pocket'],
      ['Chino Pants', 'stretch-cotton chinos with a tailored taper, office to weekend'],
      ['Running Cap', 'quick-dry running cap with reflective trim and adjustable strap'],
    ],
  },
  Sports: {
    brands: ['SummitPro', 'Kinetic', 'PaceLine', 'IronForm', 'BlueRidge'],
    items: [
      ['Yoga Mat', 'non-slip 6mm yoga mat with alignment lines and a carry strap'],
      ['Adjustable Dumbbells', 'space-saving adjustable dumbbells from 5 to 52.5 lb with quick-change dials'],
      ['Insulated Cooler', 'rotomolded 45-quart cooler that keeps ice frozen and drinks cold for up to 5 days'],
      ['Camping Tent', 'two-person backpacking tent with aluminum poles and a 15-minute setup'],
      ['Road Bike Helmet', 'aerodynamic MIPS road cycling helmet with 21 vents'],
      ['Resistance Bands Set', 'five-stackable resistance bands with handles, door anchor and ankle straps'],
      ['Soccer Ball', 'thermo-bonded size 5 match soccer ball with textured PU surface'],
      ['Trekking Poles', 'collapsible carbon trekking poles with cork grips and quick locks'],
    ],
  },
  Books: {
    brands: ['Harbor Press', 'Quill & Oak', 'Northlight', 'Ember House', 'Juniper Books'],
    items: [
      ['The Silent Coast (Novel)', 'a literary mystery set in a fog-drenched fishing village where a lighthouse keeper vanishes'],
      ['Designing Data-Intensive Apps', 'a practical guide to the architecture of scalable, reliable data systems'],
      ['Sourdough at Home', 'a beginner-friendly cookbook for baking artisan sourdough bread in a home kitchen'],
      ['A History of Maps', 'an illustrated journey through cartography from clay tablets to satellite imagery'],
      ['Mindful Mornings', 'short daily practices for focus, gratitude and calm before the workday begins'],
      ['The Backyard Astronomer', 'a field guide to stargazing with binoculars and small telescopes'],
      ['SQL for Analysts', 'hands-on SQL patterns for data analysis, reporting and dashboards'],
      ['Gardens of Japan', 'a photographic tour of Kyoto temple gardens and the philosophy behind them'],
    ],
  },
};

const ADJECTIVES = ['Essential', 'Premium', 'Everyday', 'Signature', 'Classic', 'Summit', 'Heritage', 'Voyager'];

const TOTAL = 220;
const categories = Object.keys(CATALOG);
const seen = new Set();
const docs = [];

while (docs.length < TOTAL) {
  const category = categories[docs.length % categories.length];
  const { brands, items } = CATALOG[category];
  const [item, blurb] = pick(items);
  const name = `${pick(brands)} ${pick(ADJECTIVES)} ${item}`;
  if (seen.has(name)) continue;
  seen.add(name);
  docs.push({
    name,
    description: `${name} — ${blurb}. Built to last and backed by a 2-year warranty.`,
    category,
    price: Math.round((rand() * 480 + 9.99) * 100) / 100,
    inStock: rand() > 0.15,
    rating: Math.round(rand() * 50) / 10,
    imageUrl: `https://picsum.photos/seed/${slug(name)}/400/300`,
    createdAt: new Date(Date.now() - Math.floor(rand() * 90 * 24 * 3600 * 1000)),
  });
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('Missing MONGODB_URI. Copy .env.example to .env and set your Atlas URI.');
  process.exit(1);
}

const client = new MongoClient(uri);
await client.connect();
const col = client.db(process.env.DB_NAME || 'ecommerce_demo').collection('products');

// Idempotent: full replace each run
await col.deleteMany({});
await col.insertMany(docs);
console.log(`Seeded ${docs.length} products into ${col.dbName}.${col.collectionName}`);

console.log(`
=== Required Atlas indexes (create in Atlas UI: Cluster → Search → Create Search Index → JSON Editor) ===

1) Full-text index, name it "${'default'}", database "${col.dbName}", collection "products":
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "name": { "type": "string" },
      "description": { "type": "string" }
    }
  }
}

2) Vector index with AUTOMATED EMBEDDING, name it "vector_index", same collection:
   In the Atlas UI choose "Vector Search" → JSON Editor → use type "autoEmbed".
   The path is the TEXT field to embed (embeddings are stored internally by Atlas —
   there is no "embedding" field in your documents):
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
NOTE: "path" must match what the app queries (default "description"; override with
VECTOR_PATH in .env). Wait for both indexes to reach "Active".
`);

await client.close();
