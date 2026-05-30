const { adminReport, json } = require('../_shared/catalog.cjs');

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { success: false, error: 'Method not allowed' });
  }
  if (!process.env.ADMIN_ACCESS_CODE || req.headers['x-admin-access'] !== process.env.ADMIN_ACCESS_CODE) {
    return json(res, 403, { success: false, error: 'Admin API is disabled until access is configured.' });
  }
  return json(res, 200, { success: true, data: adminReport() });
};
