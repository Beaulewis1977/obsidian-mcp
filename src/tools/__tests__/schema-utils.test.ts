import { describe, it, expect } from 'vitest';
import { withExamples } from '../schema-utils.js';

describe('withExamples', () => {
  it('Test 1: injects examples array into matching property', () => {
    const schema = { properties: { path: { type: 'string' } } };
    const result = withExamples(schema, { path: ['a.md'] });
    expect(result.properties.path.examples).toEqual(['a.md']);
  });

  it('Test 2: does NOT mutate original schema properties (uses spread)', () => {
    const original = { properties: { path: { type: 'string' } } };
    const originalProp = original.properties.path;
    withExamples(original, { path: ['a.md'] });
    // The original property reference should NOT have examples
    expect(originalProp).not.toHaveProperty('examples');
  });

  it('Test 3: ignores property keys not in schema.properties (safe no-op)', () => {
    const schema = { properties: { name: { type: 'string' } } };
    const result = withExamples(schema, { nonExistent: ['value'] });
    expect(result.properties).not.toHaveProperty('nonExistent');
    expect(result.properties.name).toEqual({ type: 'string' });
  });

  it('Test 4: schema with no properties field returns schema unchanged', () => {
    const schema = { type: 'object', title: 'MySchema' };
    const result = withExamples(schema, { path: ['a.md'] });
    expect(result).toEqual({ type: 'object', title: 'MySchema' });
  });
});
