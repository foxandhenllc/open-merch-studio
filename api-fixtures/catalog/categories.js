const { categories, json } = require('../_shared/catalog.cjs');

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { success: false, error: 'Method not allowed' });
  }
  return json(res, 200, { success: true, data: categories, count: categories.length });
};
