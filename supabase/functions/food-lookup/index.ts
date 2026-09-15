// Supabase Edge Function: looks up nutrition estimates for a free-text food
// description using Claude, with web search for branded/restaurant items.
// The Anthropic API key lives only in this function's environment (set via
// `supabase secrets set`) and never reaches the browser.

import Anthropic from 'npm:@anthropic-ai/sdk@0.70.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

const SYSTEM_PROMPT = `You are a nutrition estimation assistant for a personal health tracker.
The user describes a food or drink they consumed, sometimes with several
components (e.g. "chicken burrito bowl with rice, beans, and guac").

For each described component, estimate calories, protein (g), carbohydrates
(g), fat (g), and sodium (mg), then sum the components into a total.

Use web search when the item is a specific restaurant or branded product
whose nutrition facts are likely published online, or when you are not
confident in a generic estimate. For generic or homemade foods, reasonable
standard nutrition values are fine without searching.

Always finish by calling submit_nutrition_estimate exactly once with your
final answer, including a confidence level and a brief source_note
explaining where the numbers came from (e.g. "Chipotle's published nutrition
page" or "USDA generic estimate for cooked white rice").`

const NUTRITION_TOOL: Anthropic.Tool = {
  name: 'submit_nutrition_estimate',
  description: 'Submit the final nutrition estimate for the logged food.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            calories: { type: 'number' },
            protein_g: { type: 'number' },
            carbs_g: { type: 'number' },
            fat_g: { type: 'number' },
            sodium_mg: { type: 'number' },
          },
          required: ['name', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'sodium_mg'],
          additionalProperties: false,
        },
      },
      total: {
        type: 'object',
        properties: {
          calories: { type: 'number' },
          protein_g: { type: 'number' },
          carbs_g: { type: 'number' },
          fat_g: { type: 'number' },
          sodium_mg: { type: 'number' },
        },
        required: ['calories', 'protein_g', 'carbs_g', 'fat_g', 'sodium_mg'],
        additionalProperties: false,
      },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      source_note: { type: 'string' },
    },
    required: ['items', 'total', 'confidence', 'source_note'],
    additionalProperties: false,
  },
}

const MAX_TURNS = 5

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let description: unknown
  try {
    ;({ description } = await req.json())
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  if (typeof description !== 'string' || !description.trim()) {
    return jsonResponse({ error: 'Missing "description" string in request body' }, 400)
  }

  let messages: Anthropic.MessageParam[] = [{ role: 'user', content: description }]

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const response = await client.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3 }, NUTRITION_TOOL],
        messages,
      })

      if (response.stop_reason === 'pause_turn') {
        messages = [...messages, { role: 'assistant', content: response.content }]
        continue
      }

      const submitBlock = response.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'submit_nutrition_estimate',
      )

      if (submitBlock) {
        return jsonResponse(submitBlock.input)
      }

      break
    }
  } catch (err) {
    console.error(err)
    return jsonResponse({ error: 'Nutrition lookup failed' }, 500)
  }

  return jsonResponse({ error: 'Could not produce a nutrition estimate for that description' }, 502)
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
