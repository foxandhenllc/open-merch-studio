const baseUrl = (process.env.OMS_MONITOR_BASE_URL || 'https://openmerchstudio.com').replace(
  /\/+$/,
  ''
);
const timeoutMs = Number(process.env.OMS_MONITOR_TIMEOUT_MS || 15_000);
const expectedCapabilities = {
  ai: process.env.OMS_EXPECTED_AI_CAPABILITY || 'live',
  checkout: process.env.OMS_EXPECTED_CHECKOUT_CAPABILITY || 'live',
  fulfillment: process.env.OMS_EXPECTED_FULFILLMENT_CAPABILITY || 'live',
};

const results = [];
const failures = [];

async function probe(name, path, validate) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { accept: path.startsWith('/api/') ? 'application/json' : 'text/html' },
      signal: controller.signal,
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const detail = await validate({ response, body });
    results.push({ name, status: 'pass', durationMs: Date.now() - startedAt, detail });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, status: 'fail', durationMs: Date.now() - startedAt, detail: message });
    failures.push(`${name}: ${message}`);
  } finally {
    clearTimeout(timeout);
  }
}

const parseEnvelope = (body) => {
  const parsed = JSON.parse(body);
  if (parsed?.success !== true) throw new Error('API success envelope was not returned');
  return parsed.data;
};

await probe('homepage', '/', ({ body }) => {
  if (!body.includes('Open Merch Studio')) throw new Error('brand marker missing');
  return 'brand marker present';
});

await probe('health', '/api/health', ({ body }) => {
  const data = parseEnvelope(body);
  for (const [capability, expected] of Object.entries(expectedCapabilities)) {
    const actual = data?.capabilities?.[capability];
    if (actual !== expected) {
      throw new Error(`${capability} capability is ${String(actual)}, expected ${expected}`);
    }
  }
  return `capabilities ${JSON.stringify(data.capabilities)}`;
});

await probe('catalog products', '/api/catalog/products', ({ body }) => {
  const products = parseEnvelope(body);
  if (!Array.isArray(products) || products.length < 5) {
    throw new Error(`catalog returned ${Array.isArray(products) ? products.length : 0} products`);
  }
  if (!products.every((product) => Array.isArray(product.variants) && product.variants.length > 0)) {
    throw new Error('one or more products have no variants');
  }
  return `${products.length} products with variants`;
});

await probe('catalog categories', '/api/catalog/categories', ({ body }) => {
  const categories = parseEnvelope(body);
  if (!Array.isArray(categories) || categories.length < 5) {
    throw new Error(`catalog returned ${Array.isArray(categories) ? categories.length : 0} categories`);
  }
  return `${categories.length} categories`;
});

console.log(
  JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      baseUrl,
      status: failures.length ? 'fail' : 'pass',
      results,
    },
    null,
    2
  )
);

if (failures.length) {
  console.error(`Production monitor failed: ${failures.join('; ')}`);
  process.exitCode = 1;
}
