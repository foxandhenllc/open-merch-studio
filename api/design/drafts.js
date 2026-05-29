const { createDesignDraft, json, parseBody } = require('../_shared/catalog.cjs');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { success: false, error: 'Method not allowed' });
  }
  try {
    const body = await parseBody(req);
    if (!String(body.prompt || '').trim()) {
      return json(res, 400, { success: false, error: 'Prompt is required.' });
    }
    return json(res, 201, { success: true, data: createDesignDraft(body.prompt) });
  } catch (error) {
    return json(res, 400, { success: false, error: error.message || 'Invalid design request.' });
  }
};
