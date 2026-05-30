const { createSession, json, parseBody } = require('../_shared/catalog.cjs');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { success: false, error: 'Method not allowed' });
  }
  await parseBody(req);
  return json(res, 201, { success: true, data: createSession() });
};
