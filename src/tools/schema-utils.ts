/**
 * Inject per-property `examples` arrays into a zodToJsonSchema() output.
 *
 * JSON Schema 2020-12 allows the `examples` keyword at any subschema level,
 * including individual property schemas inside `properties`. This annotation
 * does not affect validation but helps LLMs construct accurate tool calls.
 *
 * zodToJsonSchema (Zod v3) does not emit `examples` natively. This post-processor
 * merges a per-property examples map into the generated schema.
 *
 * SAFETY: Always spreads property objects — does not mutate the input schema's
 * property references. zodToJsonSchema returns a new plain object per call, so
 * spreading is sufficient to avoid shared-reference mutation.
 *
 * @param schema - Output of zodToJsonSchema(ZodType)
 * @param propertyExamples - Map of { propertyName: examplesArray }
 * @returns The schema with examples injected into matching properties
 */
export function withExamples(
  schema: Record<string, any>,
  propertyExamples: Record<string, any[]>
): Record<string, any> {
  if (!schema.properties) return schema;
  for (const [propName, examples] of Object.entries(propertyExamples)) {
    if (schema.properties[propName]) {
      schema.properties[propName] = {
        ...schema.properties[propName],
        examples,
      };
    }
  }
  return schema;
}
