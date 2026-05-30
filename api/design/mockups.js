const { createMockup, json, parseBody } = require('../_shared/catalog.cjs');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { success: false, error: 'Method not allowed' });
  }
  const body = await parseBody(req);
  if (!body.productId || !body.variantId) {
    return json(res, 400, { success: false, error: 'Product and variant are required.' });
  }
  return json(res, 201, { success: true, data: createMockup(body) });
};
