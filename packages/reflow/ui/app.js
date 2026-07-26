import { loadSpec, parseSpec, groupByTag, resolveRef } from '../core/openapi-parser.js';
import { MockGenerator } from '../core/smart-prefill.js';

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Minimal vanilla JSON syntax highlighter — escapes HTML then wraps tokens
 * (keys/strings/numbers/booleans/null) in spans. No dependency beyond a regex.
 */
function highlightJson(text) {
  if (!text) return '';
  const escaped = escapeHtml(String(text));
  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(\.\d+)?([eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'tok-number';
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? 'tok-key' : 'tok-string';
      } else if (/^(true|false)$/.test(match)) {
        cls = 'tok-boolean';
      } else if (match === 'null') {
        cls = 'tok-null';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

function defaultAuth() {
  return {
    type: 'none',
    token: '',
    username: '',
    password: '',
    apiKeyName: '',
    apiKeyIn: 'header',
    apiKeyValue: '',
    oauth2: { tokenUrl: '', clientId: '', clientSecret: '', scope: '', accessToken: '' },
  };
}

/**
 * Alpine component factory for the Reflow REST client panel.
 * Registered globally as `reflowPanel` — index.html wires it via x-data="reflowPanel()".
 * Reads the spec URL from a query param so the same static bundle works
 * against any backend: index.html?spec=/openapi.yaml
 */
export function reflowPanel() {
  return {
    specUrl: new URLSearchParams(location.search).get('spec') || '/openapi.json',
    spec: null,
    groups: {},
    search: '',
    openTags: {},
    selected: null,
    paramValues: {},
    bodyText: '',
    activeTab: 'params',
    customHeaders: [],
    auth: defaultAuth(),
    oauth2Error: null,
    response: null,
    responseTab: 'body',
    copied: false,
    error: null,
    loading: false,

    async init() {
      try {
        this.spec = await loadSpec(this.specUrl);
        this.mockGen = new MockGenerator(this.spec);
        this.groups = groupByTag(parseSpec(this.spec));
        const firstTag = Object.keys(this.groups)[0];
        if (firstTag) this.select(this.groups[firstTag][0]);
      } catch (err) {
        this.error = `Failed to load spec from ${this.specUrl}: ${err.message}`;
      }
    },

    filteredGroups() {
      const q = this.search.trim().toLowerCase();
      if (!q) return this.groups;

      const filtered = {};
      for (const [tag, ops] of Object.entries(this.groups)) {
        const matched = ops.filter(
          (op) =>
            op.path.toLowerCase().includes(q) ||
            op.method.toLowerCase().includes(q) ||
            op.summary.toLowerCase().includes(q)
        );
        if (matched.length) filtered[tag] = matched;
      }
      return filtered;
    },

    isTagOpen(tag) {
      return this.openTags[tag] !== false;
    },

    toggleTag(tag) {
      this.openTags[tag] = !this.isTagOpen(tag);
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

      if (this.activeTab === 'body' && !operation.requestBodySchema) {
        this.activeTab = 'params';
      }

      this.suggestAuth(operation);
    },

    /**
     * Auto-flips auth.type to match what the selected operation declares in
     * `security`, without wiping tokens/credentials the user already typed —
     * switching endpoints shouldn't force re-entering the same Bearer token.
     */
    suggestAuth(operation) {
      const schemes = this.spec?.components?.securitySchemes || {};
      const requirement = operation.security?.[0];
      if (!requirement) return;

      const scheme = schemes[Object.keys(requirement)[0]];
      if (!scheme) return;

      if (scheme.type === 'http' && scheme.scheme === 'bearer') {
        this.auth.type = 'bearer';
      } else if (scheme.type === 'http' && scheme.scheme === 'basic') {
        this.auth.type = 'basic';
      } else if (scheme.type === 'apiKey') {
        this.auth.type = 'apiKey';
        this.auth.apiKeyName = scheme.name || this.auth.apiKeyName;
        this.auth.apiKeyIn = scheme.in || this.auth.apiKeyIn;
      } else if (scheme.type === 'oauth2') {
        this.auth.type = 'oauth2';
        const tokenUrl = scheme.flows?.clientCredentials?.tokenUrl;
        if (tokenUrl) this.auth.oauth2.tokenUrl = tokenUrl;
      }
    },

    resolvedPath() {
      if (!this.selected) return '';
      let path = this.selected.path;
      for (const [name, value] of Object.entries(this.paramValues)) {
        path = path.replace(`{${name}}`, encodeURIComponent(value));
      }
      return path;
    },

    /**
     * Flattens a request/response body schema into a documentation table:
     * one row per property, resolving $ref and merging allOf branches.
     */
    describeSchema(schema) {
      if (!schema) return [];
      let resolved = schema.$ref ? resolveRef(schema.$ref, this.spec) : schema;

      let properties = { ...(resolved.properties || {}) };
      const required = new Set(resolved.required || []);

      for (const sub of resolved.allOf || []) {
        const subResolved = sub.$ref ? resolveRef(sub.$ref, this.spec) : sub;
        properties = { ...properties, ...(subResolved.properties || {}) };
        for (const name of subResolved.required || []) required.add(name);
      }

      return Object.entries(properties).map(([name, propSchema]) => {
        const prop = propSchema.$ref ? resolveRef(propSchema.$ref, this.spec) : propSchema;
        let type = prop.type || (prop.enum ? 'enum' : 'object');
        let format = prop.enum ? prop.enum.join(' | ') : prop.format || '';

        if (prop.type === 'array') {
          const items = prop.items?.$ref ? resolveRef(prop.items.$ref, this.spec) : prop.items;
          format = `array<${items?.type || 'object'}>`;
        }

        return {
          name,
          type,
          format,
          required: required.has(name),
          description: prop.description || '',
        };
      });
    },

    highlightJson,

    addHeaderRow() {
      this.customHeaders.push({ key: '', value: '', enabled: true });
    },

    removeHeaderRow(index) {
      this.customHeaders.splice(index, 1);
    },

    /**
     * Applies the active auth config to a request. API keys with `in: query`
     * get appended to the URL instead of a header, since that's how the
     * OpenAPI securityScheme declares them.
     */
    buildAuthHeaders(url) {
      const headers = {};
      let finalUrl = url;

      switch (this.auth.type) {
        case 'bearer':
          if (this.auth.token) headers['Authorization'] = `Bearer ${this.auth.token}`;
          break;
        case 'basic':
          if (this.auth.username || this.auth.password) {
            headers['Authorization'] = `Basic ${btoa(`${this.auth.username}:${this.auth.password}`)}`;
          }
          break;
        case 'apiKey':
          if (this.auth.apiKeyName && this.auth.apiKeyValue) {
            if (this.auth.apiKeyIn === 'query') {
              const sep = finalUrl.includes('?') ? '&' : '?';
              finalUrl += `${sep}${encodeURIComponent(this.auth.apiKeyName)}=${encodeURIComponent(this.auth.apiKeyValue)}`;
            } else {
              headers[this.auth.apiKeyName] = this.auth.apiKeyValue;
            }
          }
          break;
        case 'oauth2':
          if (this.auth.oauth2.accessToken) headers['Authorization'] = `Bearer ${this.auth.oauth2.accessToken}`;
          break;
      }

      return { url: finalUrl, headers };
    },

    /**
     * Client Credentials grant only — no redirect/popup flow. Fetched on
     * demand via an explicit button, never automatically before a send().
     */
    async fetchOAuth2Token() {
      const { tokenUrl, clientId, clientSecret, scope } = this.auth.oauth2;
      if (!tokenUrl) return;

      this.oauth2Error = null;
      try {
        const body = new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        });
        if (scope) body.set('scope', scope);

        const res = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        const data = await res.json();
        if (!res.ok || !data.access_token) {
          throw new Error(data.error_description || data.error || `HTTP ${res.status}`);
        }
        this.auth.oauth2.accessToken = data.access_token;
      } catch (err) {
        this.oauth2Error = `Token request failed: ${err.message}`;
      }
    },

    async copyResponse() {
      if (!this.response) return;
      await navigator.clipboard.writeText(this.response.body);
      this.copied = true;
      setTimeout(() => {
        this.copied = false;
      }, 1500);
    },

    async send() {
      this.loading = true;
      this.response = null;
      this.error = null;
      this.responseTab = 'body';

      try {
        const query = (this.selected.parameters || [])
          .filter((p) => p.in === 'query' && this.paramValues[p.name] !== '')
          .map((p) => `${encodeURIComponent(p.name)}=${encodeURIComponent(this.paramValues[p.name])}`)
          .join('&');

        let url = this.resolvedPath() + (query ? `?${query}` : '');
        const hasBody = ['POST', 'PUT', 'PATCH'].includes(this.selected.method);

        const headers = hasBody ? { 'Content-Type': 'application/json' } : {};

        // Header/cookie params from the spec were previously rendered as
        // inputs but never actually sent — wired up here for real.
        for (const param of this.selected.parameters || []) {
          if (param.in === 'header' && this.paramValues[param.name] !== '') {
            headers[param.name] = this.paramValues[param.name];
          }
          if (param.in === 'cookie' && this.paramValues[param.name] !== '') {
            // fetch() can't set a Cookie header directly (forbidden header
            // name) — set it on the document instead, same-origin only.
            document.cookie = `${encodeURIComponent(param.name)}=${encodeURIComponent(this.paramValues[param.name])}; path=/`;
          }
        }

        for (const row of this.customHeaders) {
          if (row.enabled && row.key) headers[row.key] = row.value;
        }

        const authResult = this.buildAuthHeaders(url);
        url = authResult.url;
        Object.assign(headers, authResult.headers);

        const startedAt = performance.now();
        const res = await fetch(url, {
          method: this.selected.method,
          headers,
          body: hasBody ? this.bodyText : undefined,
          credentials: 'include',
        });
        const durationMs = Math.round(performance.now() - startedAt);

        const text = await res.text();
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }

        const responseHeaders = [];
        for (const [name, value] of res.headers.entries()) responseHeaders.push({ name, value });

        this.response = {
          status: res.status,
          ok: res.ok,
          body: typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2),
          durationMs,
          headers: responseHeaders,
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
