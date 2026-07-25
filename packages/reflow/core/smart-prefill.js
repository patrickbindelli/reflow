/**
 * Reflow — Smart Pre-fill core.
 * Turns an OpenAPI schema into a semi-filled, ready-to-send JSON payload.
 * Pure JS, no dependencies — this is the tool's main differentiator, so it
 * stays isolated and unit-testable outside of the UI layer.
 */

import { resolveRef } from './openapi-parser.js';

const MAX_DEPTH = 8; // guards against circular $ref chains

const FORMAT_GENERATORS = {
  email: () => 'user@example.com',
  'date-time': () => new Date().toISOString(),
  date: () => new Date().toISOString().slice(0, 10),
  uuid: () => '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  uri: () => 'https://example.com',
  hostname: () => 'example.com',
  ipv4: () => '192.0.2.1',
  password: () => '••••••••',
};

function mockString(schema) {
  if (schema.enum?.length) return schema.enum[0];
  if (schema.format && FORMAT_GENERATORS[schema.format]) {
    return FORMAT_GENERATORS[schema.format]();
  }
  if (schema.pattern) {
    // No general regex-to-string generator here — a literal placeholder
    // beats silently producing a value that fails the pattern.
    return `string matching ${schema.pattern}`;
  }
  const base = 'string';
  const min = schema.minLength ?? 0;
  const max = schema.maxLength ?? Infinity;
  if (base.length < min) return base.padEnd(min, 'x');
  if (base.length > max) return base.slice(0, max);
  return base;
}

function mockNumber(schema, isInteger) {
  if (schema.enum?.length) return schema.enum[0];
  let value = schema.minimum ?? (schema.maximum !== undefined ? Math.min(0, schema.maximum) : 0);
  if (schema.exclusiveMinimum !== undefined) value = schema.exclusiveMinimum + 1;
  if (schema.maximum !== undefined) value = Math.min(value, schema.maximum);
  return isInteger ? Math.round(value) : value;
}

export class MockGenerator {
  /**
   * @param {object} rootSpec full OpenAPI document, used to resolve $ref
   */
  constructor(rootSpec) {
    this.rootSpec = rootSpec;
  }

  /**
   * Generates a mock value for the given schema.
   * @param {object} schema
   * @param {number} depth internal recursion guard, do not set manually
   * @returns {*}
   */
  generate(schema, depth = 0) {
    if (!schema) return null;
    if (depth > MAX_DEPTH) return null;

    if (schema.$ref) {
      const resolved = resolveRef(schema.$ref, this.rootSpec);
      return this.generate(resolved, depth + 1);
    }

    if (schema.example !== undefined) return schema.example;
    if (schema.default !== undefined) return schema.default;

    if (schema.oneOf?.length) return this.generate(schema.oneOf[0], depth + 1);
    if (schema.anyOf?.length) return this.generate(schema.anyOf[0], depth + 1);
    if (schema.allOf?.length) {
      return schema.allOf.reduce(
        (acc, sub) => ({ ...acc, ...this.generate(sub, depth + 1) }),
        {}
      );
    }

    switch (schema.type) {
      case 'string':
        return mockString(schema);
      case 'integer':
        return mockNumber(schema, true);
      case 'number':
        return mockNumber(schema, false);
      case 'boolean':
        return true;
      case 'array':
        return [this.generate(schema.items, depth + 1)];
      case 'object':
      default:
        return this.generateObject(schema, depth);
    }
  }

  generateObject(schema, depth) {
    if (!schema.properties) return {};

    const result = {};
    // Semi-filled by design: required AND optional fields are both
    // populated, so the payload is send-ready without manual edits.
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      result[key] = this.generate(propSchema, depth + 1);
    }

    return result;
  }
}
