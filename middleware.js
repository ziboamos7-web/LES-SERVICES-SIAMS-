/* ---------------------------------------------------------------------------
   Middleware Vercel : aperçu de lien personnalisé par boutique (WhatsApp,
   Facebook, Messenger, Telegram, etc.)

   Ces robots ne lisent que le HTML brut envoyé au tout premier chargement —
   ils n'exécutent jamais le JavaScript de l'application. Sans ce middleware,
   ils affichent donc toujours la même image générique SIAMS, quelle que soit
   la boutique partagée.

   Ce fichier détecte les robots de partage à partir de leur "user-agent" et,
   uniquement pour eux, renvoie une mini-page HTML avec le nom et le logo de
   la boutique concernée (récupérés dans Supabase). Pour un visiteur normal,
   le middleware ne fait rien : le site continue de fonctionner exactement
   comme avant.
--------------------------------------------------------------------------- */

export const config = {
  // Ne s'applique pas aux fichiers statiques (images, css, js, favicon...),
  // ni au dossier /api, pour ne jamais interférer avec le reste du site.
  matcher: '/((?!api/|_next/|favicon.ico|og-image.png|.*\\.[a-zA-Z0-9]+$).*)',
};

const CRAWLER_UA = /facebookexternalhit|Facebot|WhatsApp|Twitterbot|LinkedInBot|TelegramBot|Slackbot|Discordbot|Pinterest|vkShare|redditbot|SkypeUriPreview|Google-InspectionTool|Applebot/i;

// Mêmes identifiants publics que ceux déjà utilisés côté client dans
// index.html (clé "publishable", protégée par les règles RLS de Supabase —
// aucun secret n'est exposé ici).
const SUPABASE_URL = 'https://xkcvjfxzcjkjthiwgqzi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_1giDs1LqDhCshoKkerkZuA_KXTwF_OV';

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export default async function middleware(request) {
  const ua = request.headers.get('user-agent') || '';
  if (!CRAWLER_UA.test(ua)) return; // visiteur normal : on laisse passer, rien ne change

  const url = new URL(request.url);
  const slug = url.pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
  if (!slug || ['index.html', 'livreur'].includes(slug.toLowerCase())) return;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/stores?slug=eq.${encodeURIComponent(slug)}&select=name,description,photo_url`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const rows = await res.json();
    const store = Array.isArray(rows) ? rows[0] : null;
    if (!store) return; // boutique introuvable : on laisse l'appli gérer normalement

    const title = escapeHtml(store.name || 'Boutique SIAMS');
    const desc = escapeHtml(store.description || 'Découvrez cette boutique sur SIAMS.');
    const imageUrl = `${url.origin}/api/store-logo?slug=${encodeURIComponent(slug)}`;
    const pageUrl = `${url.origin}/${slug}`;

    const html = `<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8">
<title>${title}</title>
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${imageUrl}">
<meta property="og:url" content="${pageUrl}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${imageUrl}">
</head><body>${title}</body></html>`;

    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  } catch (e) {
    return; // en cas d'erreur réseau, on laisse passer normalement plutôt que de bloquer
  }
}
