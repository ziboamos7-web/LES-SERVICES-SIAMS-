const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://xkcvjfxzcjkjthiwgqzi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_1giDs1LqDhCshoKkerkZuA_KXTwF_OV';
const SITE_URL = 'https://www.lesboutiqueagreesiams.app';

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function sb(query) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    if (!r.ok) return [];
    return await r.json();
  } catch (e) {
    return [];
  }
}

module.exports = async (req, res) => {
  const slug = req.query.slug;
  const produit = req.query.produit;

  const htmlPath = path.join(process.cwd(), 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  try {
    if (slug && produit) {
      const stores = await sb(`stores?slug=eq.${encodeURIComponent(slug)}&select=id,name,photo_url`);
      const store = stores[0];

      if (store) {
        const products = await sb(
          `products?id=eq.${encodeURIComponent(produit)}&store_id=eq.${store.id}&select=id,name,price,description`
        );
        const product = products[0];

        if (product) {
          const photos = await sb(
            `product_photos?product_id=eq.${encodeURIComponent(produit)}&select=url&order=position.asc&limit=1`
          );
          const image = (photos[0] && photos[0].url) || `${SITE_URL}/og-image.png`;

          const storeName = store.name || 'SIAMS';
          const title = `${product.name} – ${storeName}`;
          const priceTxt = product.price
            ? `${Number(product.price).toLocaleString('fr-FR').replace(/,/g, ' ')} FCFA`
            : '';
          const shortDesc = (product.description || '').slice(0, 140);
          const desc = [priceTxt, shortDesc].filter(Boolean).join(' — ') ||
            `Découvrez ${product.name} sur ${storeName}, boutique en ligne SIAMS.`;
          const pageUrl = `${SITE_URL}/${encodeURIComponent(slug)}?produit=${encodeURIComponent(produit)}`;

          html = html
            .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
            .replace(/<meta name="description" content=".*?">/, `<meta name="description" content="${escapeHtml(desc)}">`)
            .replace(/<meta property="og:title" content=".*?">/, `<meta property="og:title" content="${escapeHtml(title)}">`)
            .replace(/<meta property="og:description" content=".*?">/, `<meta property="og:description" content="${escapeHtml(desc)}">`)
            .replace(/<meta property="og:image" content=".*?">/, `<meta property="og:image" content="${escapeHtml(image)}">`)
            .replace(/<meta property="og:url" content=".*?">/, `<meta property="og:url" content="${escapeHtml(pageUrl)}">`)
            .replace(/<meta property="og:type" content=".*?">/, `<meta property="og:type" content="product">`);
        }
      }
    }
  } catch (e) {
    // En cas de problème, on sert simplement la page normale (pas d'erreur visible pour l'utilisateur)
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};
