/**
 * chatSampleTools - Demo tool definitions for the RunAnywhere RN starter.
 *
 * Ported from:
 * runanywhere-sdks/examples/react-native/RunAnywhereAI/src/utils/chatSampleTools.ts
 *
 * `ToolDefinition.parameters` is now ONE OpenAI-compatible JSON Schema string
 * (the typed `ToolParameterType` parameter list was deleted from the IDL), and
 * tool executors registered through `RunAnywhere.llm.tools` receive/return
 * plain JSON objects — the SDK owns the ToolValue conversion.
 */

import { RunAnywhere } from '@runanywhere/core';
import { ToolDefinition } from '@runanywhere/proto-ts/tool_calling';
import { safeEvaluateExpression } from './mathParser';

export const DEMO_TOOLS: ToolDefinition[] = [
  ToolDefinition.fromPartial({
    name: 'get_weather',
    description: 'Gets the current weather for a city or location',
    parameters: JSON.stringify({
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description:
            'City name or location (e.g., "Tokyo", "New York", "London")',
        },
      },
      required: ['location'],
    }),
  }),
  ToolDefinition.fromPartial({
    name: 'get_current_time',
    description: 'Gets the current date, time, and timezone information',
    parameters: JSON.stringify({ type: 'object', properties: {} }),
  }),
  ToolDefinition.fromPartial({
    name: 'calculate',
    description:
      'Performs math calculations. Supports +, -, *, /, and parentheses',
    parameters: JSON.stringify({
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Math expression (e.g., "2 + 2 * 3", "(10 + 5) / 3")',
        },
      },
      required: ['expression'],
    }),
  }),
];

/**
 * Register the three demo tools (weather, time, calculator).
 * Clears any pre-existing tools before registering.
 */
export const registerDemoTools = async (): Promise<void> => {
  await RunAnywhere.llm.tools.clear();

  // Weather tool - real API (wttr.in - no key needed)
  await RunAnywhere.llm.tools.register(
    DEMO_TOOLS[0]!,
    async (args: Record<string, unknown>): Promise<Record<string, unknown>> => {
      const location =
        typeof args.location === 'string' ? args.location : 'San Francisco';
      try {
        const response = await fetch(
          `https://wttr.in/${encodeURIComponent(location)}?format=j1`
        );
        const data = await response.json();
        const current = data.current_condition?.[0];
        return {
          location,
          temperature_c: current?.temp_C || 'N/A',
          temperature_f: current?.temp_F || 'N/A',
          condition: current?.weatherDesc?.[0]?.value || 'Unknown',
          humidity: current?.humidity || 'N/A',
          wind_kph: current?.windspeedKmph || 'N/A',
        };
      } catch (error) {
        return { error: `Failed to get weather: ${error}` };
      }
    }
  );

  // Current time tool
  await RunAnywhere.llm.tools.register(
    DEMO_TOOLS[1]!,
    async (): Promise<Record<string, unknown>> => {
      const now = new Date();
      return {
        datetime: now.toLocaleString(),
        time: now.toLocaleTimeString(),
        timestamp: now.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    }
  );

  // Calculator tool - safe math evaluation (no eval()/Function())
  await RunAnywhere.llm.tools.register(
    DEMO_TOOLS[2]!,
    async (args: Record<string, unknown>): Promise<Record<string, unknown>> => {
      const expression =
        typeof args.expression === 'string' ? args.expression : '0';
      try {
        return {
          expression,
          result: safeEvaluateExpression(expression),
        };
      } catch (error) {
        return { error: `Failed to calculate: ${error}` };
      }
    }
  );
};
