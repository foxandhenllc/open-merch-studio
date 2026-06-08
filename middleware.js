import { next } from '@vercel/functions';

const COOKIE_NAME = 'oms_site_access';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function cookieValue(request, name) {
  const raw = request.headers.get('cookie') || '';
  const cookie = raw
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : '';
}

function accessPage(errorMessage = '') {
  const error = errorMessage
    ? `<p class="error" role="alert">${escapeHtml(errorMessage)}</p>`
    : '';
  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Open Merch Studio Access</title>
    <style>
      :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7f4ef; color: #201a26; }
      main { width: min(420px, calc(100vw - 32px)); padding: 24px; border: 1px solid #ded7ca; border-radius: 8px; background: #fffdfa; box-shadow: 0 14px 34px rgba(41, 32, 22, 0.08); }
      h1 { margin: 0 0 8px; font-size: 28px; line-height: 1.05; }
      p { margin: 0 0 18px; color: #5c5361; line-height: 1.45; }
      label { display: grid; gap: 8px; color: #315d62; font-size: 12px; font-weight: 850; letter-spacing: .04em; text-transform: uppercase; }
      input { height: 44px; padding: 0 12px; border: 1px solid #cfc8bb; border-radius: 8px; color: #201a26; font: inherit; }
      button { width: 100%; min-height: 44px; margin-top: 12px; border: 0; border-radius: 8px; background: #315d62; color: #fff; font: inherit; font-weight: 800; cursor: pointer; }
      .error { margin-bottom: 12px; padding: 10px 12px; border-radius: 8px; background: #ffe1e0; color: #a51f1f; font-size: 13px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Open Merch Studio</h1>
      <p>This paid-beta workspace is password protected while provider testing is in progress.</p>
      ${error}
      <form method="post" action="/access">
        <label for="access-code">Access code</label>
        <input id="access-code" name="accessCode" type="password" autocomplete="current-password" required autofocus />
        <button type="submit">Enter studio</button>
      </form>
    </main>
  </body>
</html>`,
    {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    }
  );
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return entities[character] || character;
  });
}

function redirectToAccess(request) {
  const url = new URL('/access', request.url);
  return Response.redirect(url, 302);
}

export default async function middleware(request) {
  const accessCode = process.env.SITE_ACCESS_CODE;
  if (!accessCode) return next();

  const url = new URL(request.url);
  if (url.pathname === '/access') {
    if (request.method === 'POST') {
      const form = await request.formData();
      const submitted = String(form.get('accessCode') || '');
      if (submitted === accessCode) {
        return new Response(null, {
          status: 302,
          headers: {
            location: '/',
            'set-cookie': `${COOKIE_NAME}=${encodeURIComponent(accessCode)}; Path=/; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`,
          },
        });
      }
      return accessPage('That access code did not match.');
    }
    return accessPage();
  }

  if (cookieValue(request, COOKIE_NAME) === accessCode) {
    return next();
  }

  return redirectToAccess(request);
}

export const config = {
  matcher: ['/((?!api/|assets/|favicon.ico|robots.txt|sitemap.xml).*)'],
};
