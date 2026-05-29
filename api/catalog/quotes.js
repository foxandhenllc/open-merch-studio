const { buildQuote, json, parseBody } = require('../_shared/catalog.cjs');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { success: false, error: 'Method not allowed' });
  }
  try {
    const body = await parseBody(req);
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return json(res, 400, { success: false, error: 'Quote requires at least one item.' });
    }
    return json(res, 201, { success: true, data: buildQuote(body.items) });
  } catch (error) {
    return json(res, 400, { success: false, error: error.message || 'Invalid quote request.' });
  }
};
