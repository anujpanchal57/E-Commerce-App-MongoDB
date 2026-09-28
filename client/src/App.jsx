import { useCallback, useEffect, useState } from 'react';

const SORTS = [
  ['newest', 'Newest first'],
  ['price_asc', 'Price: low → high'],
  ['price_desc', 'Price: high → low'],
  ['rating_desc', 'Rating: high → low'],
];

const EMPTY_FORM = { name: '', description: '', category: 'Electronics', price: '', inStock: true, rating: 0, imageUrl: '' };

async function api(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

function ProductForm({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const payload = {
      ...form,
      price: Number(form.price),
      rating: Number(form.rating),
      ...(form.imageUrl ? { imageUrl: form.imageUrl } : {}),
    };
    try {
      const res = form._id
        ? await api(`/products/${form._id}`, { method: 'PUT', body: JSON.stringify(payload) })
        : await api('/products', { method: 'POST', body: JSON.stringify(payload) });
      onSaved(res?.mongo, res?.product?._id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{form._id ? 'Edit Product' : 'Add Product'}</h2>
        <label>Name<input required value={form.name} onChange={set('name')} /></label>
        <label>Description<textarea required rows={3} value={form.description} onChange={set('description')} /></label>
        <label>Category
          <select required value={form.category} onChange={set('category')}>
            {['Electronics', 'Apparel', 'Home', 'Sports', 'Books'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <div className="row">
          <label>Price ($)<input required type="number" min="0.01" step="0.01" value={form.price} onChange={set('price')} /></label>
          <label>Rating (0–5)<input type="number" min="0" max="5" step="0.1" value={form.rating} onChange={set('rating')} /></label>
        </div>
        <label className="check"><input type="checkbox" checked={form.inStock} onChange={set('inStock')} /> In stock</label>
        {error && <p className="error">{error}</p>}
        <div className="row actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

function ProductCard({ p, onEdit, onDelete, highlighted }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = (p.description || '').length > 90;
  return (
    <div className={`card${highlighted ? ' highlight' : ''}`}>
      <div className="card-body">
        <div className="card-top">
          <span className="category">{p.category}</span>
          {typeof p.score === 'number' && <span className="score">score {p.score.toFixed(3)}</span>}
        </div>
        <h3>{p.name}</h3>
        <p className={`desc${expanded ? ' expanded' : ''}`}>{p.description}</p>
        {isLong && (
          <button className="link" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'See less ▲' : 'See more ▼'}
          </button>
        )}
        <div className="card-bottom">
          <span className="price">${p.price.toFixed(2)}</span>
          <span className="rating">★ {p.rating?.toFixed(1) ?? '0.0'}</span>
          <span className={p.inStock ? 'stock' : 'stock out'}>{p.inStock ? 'In stock' : 'Out of stock'}</span>
        </div>
        <div className="row actions">
          <button onClick={() => onEdit(p)}>Edit</button>
          <button className="danger" onClick={() => onDelete(p)}>Delete</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('text');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, mode: 'browse' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // null | EMPTY | product
  const [lastQuery, setLastQuery] = useState(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [highlightedId, setHighlightedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, sort });
      if (q.trim()) { params.set('q', q.trim()); params.set('mode', mode); }
      const d = await api(`/products?${params}`);
      setData(d);
      setLastQuery(d.mongo);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [q, mode, sort, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(data.total / (data.pageSize || 20)));

  const onDelete = async (p) => {
    if (!window.confirm(`Delete "${p.name}"?`)) return;
    try {
      const r = await api(`/products/${p._id}`, { method: 'DELETE' });
      await load();
      if (r?.mongo) setLastQuery(r.mongo); // show the delete, not the refresh
    } catch (err) {
      setError(err.message);
    }
  };

  // If already on page 1, state won't change so useEffect won't refire — load directly.
  const submitSearch = (e) => { e.preventDefault(); page === 1 ? load() : setPage(1); };

  return (
    <div className="container">
      <header>
        <h1>Mongo E-commerce Demo</h1>
        <button onClick={() => setEditing(EMPTY_FORM)}>+ Add Product</button>
      </header>


      <form className="toolbar" onSubmit={submitSearch}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={mode === 'vector' ? 'Semantic search, e.g. "something to keep drinks cold"' : 'Full-text search, e.g. "headphones"'}
        />
        <div className="mode-toggle">
          <button type="button" className={mode === 'text' ? 'active' : ''} onClick={() => setMode('text')}>Full-text</button>
          <button type="button" className={mode === 'vector' ? 'active' : ''} onClick={() => setMode('vector')}>Semantic</button>
        </div>
        <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
          {SORTS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <button type="submit">Search</button>
        {q && <button type="button" onClick={() => { setQ(''); setPage(1); }}>Clear</button>}
      </form>

      <div className="status">
        {loading ? 'Loading…' : `${data.total} product${data.total === 1 ? '' : 's'}`}
        {!loading && data.mode !== 'browse' && (
          <span className="mode-badge">
            {data.mode === 'vector' ? 'semantic (Atlas auto-embedding vector search)' : 'full-text (Atlas Search)'}
          </span>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="grid">
        {data.items.map((p) => (
          <ProductCard key={p._id} p={p} onEdit={setEditing} onDelete={onDelete} highlighted={p._id === highlightedId} />
        ))}
        {!loading && !data.items.length && !error && <p>No products found.</p>}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      )}

      {editing && (
        <ProductForm
          initial={editing._id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={async (mongo, id) => {
            setEditing(null);
            await load();
            if (mongo) setLastQuery(mongo); // show the mutation, not the refresh
            if (id) {
              setHighlightedId(id);
              setTimeout(() => setHighlightedId(null), 2500);
            }
          }}
        />
      )}

      <button
        className={`query-tab${panelOpen ? ' open' : ''}`}
        onClick={() => setPanelOpen(!panelOpen)}
        title="Toggle MongoDB query panel"
      >
        {panelOpen ? '⟩' : '⟨'} MongoDB
      </button>
      <aside className={`query-panel${panelOpen ? ' open' : ''}`}>
        <h2>MongoDB Query</h2>
        <p className="panel-hint">The exact operation the server just ran against your cluster.</p>
        <pre>{lastQuery ? JSON.stringify(lastQuery, null, 2) : 'Run an operation to see its query.'}</pre>
      </aside>
    </div>
  );
}
