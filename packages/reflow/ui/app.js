import { loadSpec, parseSpec, groupByTag } from '../core/openapi-parser.js';
import { MockGenerator } from '../core/smart-prefill.js';

/**
 * Alpine component factory for the Reflow REST client panel.
 * Registered globally as `reflowPanel` — index.html wires it via x-data="reflowPanel()".
 * Reads the spec URL from a query param so the same static bundle works
 * against any backend: index.html?spec=/openapi.yaml
 */
export function reflowPanel() {
  return {
    specUrl: new URLSearchParams(location.search).get('spec') || '/openapi.json',
    groups: {},
    selected: null,
    paramValues: {},
    bodyText: '',
    response: null,
    error: null,
    loading: false,

    async init() {
      try {
        const spec = await loadSpec(this.specUrl);
        this.mockGen = new MockGenerator(spec);
        this.groups = groupByTag(parseSpec(spec));
        const firstTag = Object.keys(this.groups)[0];
        if (firstTag) this.select(this.groups[firstTag][0]);
      } catch (err) {
        this.error = `Failed to load spec from ${this.specUrl}: ${err.message}`;
      }
    },

    select(operation) {
      this.selected = operation;
      this.response = null;
      this.error = null;

      this.paramValues = {};
      for (const param of operation.parameters) {
        this.paramValues[param.name] = param.example ?? param.schema?.example ?? '';
      }

      this.bodyText = operation.requestBodySchema
        ? JSON.stringify(this.mockGen.generate(operation.requestBodySchema), null, 2)
        : '';
    },

    resolvedPath() {
      if (!this.selected) return '';
      let path = this.selected.path;
      for (const [name, value] of Object.entries(this.paramValues)) {
        path = path.replace(`{${name}}`, encodeURIComponent(value));
      }
      return path;
    },

    async send() {
      this.loading = true;
      this.response = null;
      this.error = null;

      try {
        const query = (this.selected.parameters || [])
          .filter((p) => p.in === 'query' && this.paramValues[p.name] !== '')
          .map((p) => `${encodeURIComponent(p.name)}=${encodeURIComponent(this.paramValues[p.name])}`)
          .join('&');

        const url = this.resolvedPath() + (query ? `?${query}` : '');
        const hasBody = ['POST', 'PUT', 'PATCH'].includes(this.selected.method);

        const res = await fetch(url, {
          method: this.selected.method,
          headers: hasBody ? { 'Content-Type': 'application/json' } : {},
          body: hasBody ? this.bodyText : undefined,
        });

        const text = await res.text();
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }

        this.response = {
          status: res.status,
          ok: res.ok,
          body: typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2),
        };
      } catch (err) {
        this.error = `Request failed: ${err.message}`;
      } finally {
        this.loading = false;
      }
    },
  };
}

globalThis.reflowPanel = reflowPanel;
