// strokes.fun/playlist/…: the Puzzle Playlist, forwarded from its GitHub Pages site
// (funklunsford/playlist, which publishes as before). On strokes.fun it shares Strokes' origin, so it
// sees the "done" mark Strokes leaves in localStorage. Only /playlist and /playlist/* run this
// (public/_routes.json); everything else is Strokes' own files, with its own headers.
const ORIGIN = 'https://funklunsford.github.io';

export async function onRequest({ request }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const url = new URL(request.url);
  const res = await fetch(new URL(url.pathname + url.search, ORIGIN), { method: request.method, redirect: 'manual' });
  const headers = new Headers(res.headers);
  // GitHub sends /playlist on to /playlist/ at its own address: keep players on strokes.fun.
  const location = headers.get('Location');
  if (location) headers.set('Location', location.replace(ORIGIN, url.origin));
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
