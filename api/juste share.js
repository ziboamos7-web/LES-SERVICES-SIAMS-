// SIAMS — lien de partage public avec métadonnées sociales dynamiques.
// À placer dans le projet Vercel : /api/share.js

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xkcvjfxzcjkjthiwgqzi.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_1giDs1LqDhCshoKkerkZuA_KXTwF_OV';

function esc(value='') {
  return String(value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

async function supabase(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  return r.json();
}

module.exports = async (req, res) => {
  try {
    const slug = String(req.query?.boutique || '').trim();
    const productId = String(req.query?.produit || '').trim();
    if (!slug) return res.status(400).send('Boutique manquante');

    const stores = await supabase(`stores?select=id,name,slug,description,photo_url,banner_url&slug=eq.${encodeURIComponent(slug)}&limit=1`);
    const store = stores[0];
    if (!store) return res.status(404).send('Boutique introuvable');

    let title = `${store.name || 'Boutique'} — Boutique en ligne`;
    let description = store.description || `Découvrez ${store.name || 'cette boutique'} sur SIAMS.`;
    let image = store.photo_url || store.banner_url || `${new URL(req.url, `https://${req.headers.host}`).origin}/og-image.png`;

    if (productId) {
      const products = await supabase(`products?select=id,name,price,description&store_id=eq.${encodeURIComponent(store.id)}&id=eq.${encodeURIComponent(productId)}&limit=1`);
      const product = products[0];
      if (product) {
        title = `${product.name} — ${store.name || 'Boutique'}`;
        description = product.description || `Découvrez ${product.name} dans la boutique ${store.name || ''}.`;
        const photos = await supabase(`product_photos?select=url&product_id=eq.${encodeURIComponent(product.id)}&order=position.asc&limit=1`);
        if (photos[0]?.url) image = photos[0].url;
      }
    }

    const host = req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const appUrl = `${proto}://${host}/?boutique=${encodeURIComponent(slug)}${productId ? `&produit=${encodeURIComponent(productId)}` : ''}`;

    const html = `<!doctype html><html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(appUrl)}">
<meta property="og:site_name" content="${esc(store.name || 'Boutique')}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0;url=${esc(appUrl)}">
</head><body><p>Ouverture de ${esc(store.name || 'la boutique')}…</p>
<script>location.replace(${JSON.stringify(appUrl)});</script></body></html>`;

    res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=600');
    res.setHeader('Content-Type','text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (e) {
    console.error('SIAMS share error', e);
    return res.status(500).send('Lien de partage temporairement indisponible');
  }
};
