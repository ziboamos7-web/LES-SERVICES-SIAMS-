/* ---------------------------------------------------------------------------
   /api/store-logo?slug=xxx

   Le logo d'une boutique est stocké dans Supabase sous forme de texte encodé
   (base64), et non comme une vraie image accessible par une adresse web.
   WhatsApp, Facebook, etc. ont besoin d'une vraie URL d'image à télécharger —
   cette fonction fait le pont : elle va chercher le logo dans la base et le
   renvoie comme une vraie image (PNG/JPEG), utilisable dans une balise
   og:image (voir middleware.js).
--------------------------------------------------------------------------- */

export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://xkcvjfxzcjkjthiwgqzi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_1giDs1LqDhCshoKkerkZuA_KXTwF_OV';

export default async function handler(request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');
  const fallback = `${url.origin}/og-image.png`;

  if (!slug) return Response.redirect(fallback, 302);

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/stores?slug=eq.${encodeURIComponent(slug)}&select=photo_url`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const rows = await res.json();
    const photo = Array.isArray(rows) && rows[0] ? rows[0].photo_url : null;

    if (!photo) return Response.redirect(fallback, 302);

    // Cas 1 : logo encodé en base64 (cas actuel le plus fréquent dans l'appli)
    if (photo.startsWith('data:')) {
      const match = photo.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return Response.redirect(fallback, 302);
      const [, mime, base64] = match;
      const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      return new Response(binary, {
        headers: { 'content-type': mime, 'cache-control': 'public, max-age=3600' },
      });
    }

    // Cas 2 : déjà une vraie URL d'image (ex. Supabase Storage) — on redirige simplement
    return Response.redirect(photo, 302);
  } catch (e) {
    return Response.redirect(fallback, 302);
  }
}
