/**
 * Reflow — OpenAPI parser core.
 * Pure JS, no build step, no framework dependency. Runs entirely client-side.
 * Accepts a spec already parsed to a plain JS object (caller decides
 * whether the source was JSON.parse or jsyaml.load — see loadSpec()).
 */

/**
 * Fetches a raw spec (JSON or YAML) and returns a plain JS object.
 * Detection is by content-type first, falling back to a cheap heuristic
 * on the raw text (JSON specs start with '{' once trimmed).
 * @param {string} url
 * @returns {Promise<object>}
 */
export async function loadSpec(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch OpenAPI spec (${res.status}): ${url}`);
  }
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  const looksLikeJson = contentType.includes('json') || text.trim().startsWith('{');
  if (looksLikeJson) {
    return JSON.parse(text);
  }

  if (typeof globalThis.jsyaml === 'undefined') {
    throw new Error('js-yaml not loaded — required to parse YAML specs. Include the js-yaml CDN script before reflow scripts.');
  }
  return globalThis.jsyaml.load(text);
}

/**
 * Resolves a local $ref (e.g. "#/components/schemas/User") against the root spec.
 * Only local refs are supported — remote/file refs are out of scope for a
 * client-side, zero-build tool.
 * @param {string} ref
 * @param {object} rootSpec
 * @returns {object}
 */
export function resolveRef(ref, rootSpec) {
  if (!ref.startsWith('#/')) {
    throw new Error(`Unsupported non-local $ref: ${ref}`);
  }
  const path = ref.slice(2).split('/');
  let node = rootSpec;
  for (const segment of path) {
    node = node?.[segment];
    if (node === undefined) {
      throw new Error(`Could not resolve $ref: ${ref}`);
    }
  }
  return node;
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

/**
 * Normalizes spec.paths into a flat list of operations, grouped-friendly
 * (each entry carries its tag so the UI can group without a second pass).
 * @param {object} spec
 * @returns {Array<{
 *   method: string, path: string, tag: string, summary: string,
 *   operationId: string, parameters: object[], requestBodySchema: object|null
 * }>}
 */
export function parseSpec(spec) {
  const operations = [];
  const paths = spec.paths || {};

  for (const [path, pathItem] of Object.entries(paths)) {
    const pathLevelParams = pathItem.parameters || [];

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;

      const requestBody = operation.requestBody?.content?.['application/json']?.schema || null;

      operations.push({
        method: method.toUpperCase(),
        path,
        tag: operation.tags?.[0] || 'default',
        summary: operation.summary || operation.operationId || `${method.toUpperCase()} ${path}`,
        operationId: operation.operationId || `${method}_${path}`,
        parameters: [...pathLevelParams, ...(operation.parameters || [])],
        requestBodySchema: requestBody,
      });
    }
  }

  return operations;
}

/**
 * Groups the flat operation list by tag, preserving insertion order —
 * used directly by the sidebar in ui/app.js.
 * @param {Array} operations
 * @returns {Record<string, Array>}
 */
export function groupByTag(operations) {
  const groups = {};
  for (const op of operations) {
    if (!groups[op.tag]) groups[op.tag] = [];
    groups[op.tag].push(op);
  }
  return groups;
}
