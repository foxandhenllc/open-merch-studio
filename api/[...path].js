let appPromise;

function restoreExpressPath(req) {
  const url = new URL(req.url || '/', 'http://localhost');
  const catchAllPath = url.searchParams.get('...path') || url.searchParams.get('path');
  if (!catchAllPath) return;

  url.searchParams.delete('...path');
  url.searchParams.delete('path');
  const query = url.searchParams.toString();
  req.url = `/api/${catchAllPath.replace(/^\/+/, '')}${query ? `?${query}` : ''}`;
}

async function handler(req, res) {
  restoreExpressPath(req);
  appPromise ??= import('../backend/dist/app.js').then(({ createApp }) => createApp());
  const app = await appPromise;
  return app(req, res);
}

module.exports = handler;
