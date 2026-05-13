/**
 * POST /api/ai/suggest-category
 *
 * Classifies a hardware asset description into one of the predefined
 * categories using OpenAI's chat completions API.
 *
 * Falls back to a deterministic keyword matcher when OPENAI_API_KEY is not
 * configured, so the feature works in development without any API key.
 *
 * Request body: { description: string }
 * Response:     { category: string; source: "ai" | "fallback" }
 *
 * Categories (fixed list — the LLM is constrained to these values):
 *   Computing | Mobile | Networking | Peripherals |
 *   Office Equipment | Infrastructure | Other
 */
import { NextRequest, NextResponse } from "next/server";

const CATEGORIES = [
  "Computing",
  "Mobile",
  "Networking",
  "Peripherals",
  "Office Equipment",
  "Infrastructure",
  "Other",
] as const;

type Category = (typeof CATEGORIES)[number];

// ─── Keyword fallback ──────────────────────────────────────────────────────────
// Used when OPENAI_API_KEY is absent — keeps the feature fully functional in dev.

const KEYWORD_MAP: Array<{ patterns: RegExp; category: Category }> = [
  {
    patterns: /laptop|desktop|computer|server|workstation|notebook|macbook|thinkpad|imac|mac mini|pc\b|nuc/i,
    category: "Computing",
  },
  {
    patterns: /phone|smartphone|tablet|ipad|iphone|android|mobile|galaxy|pixel/i,
    category: "Mobile",
  },
  {
    patterns: /router|switch|firewall|access.?point|wifi|wi-fi|hub|modem|patch.?panel|poe/i,
    category: "Networking",
  },
  {
    patterns: /printer|scanner|monitor|screen|display|keyboard|mouse|headset|webcam|dock|usb.?hub/i,
    category: "Peripherals",
  },
  {
    patterns: /rack|ups|generator|battery.?backup|pdu|cable.?management|kvm|console/i,
    category: "Infrastructure",
  },
  {
    patterns: /desk|chair|projector|whiteboard|phone.?system|conference|tv|television/i,
    category: "Office Equipment",
  },
];

function classifyByKeyword(description: string): Category {
  for (const { patterns, category } of KEYWORD_MAP) {
    if (patterns.test(description)) return category;
  }
  return "Other";
}

// ─── OpenAI call ──────────────────────────────────────────────────────────────

async function classifyWithAI(description: string): Promise<Category> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an IT asset classification assistant for a hardware lifecycle platform. " +
            "Respond ONLY with one of these exact category names — no punctuation, no explanation:\n" +
            CATEGORIES.join(" | "),
        },
        {
          role: "user",
          content: `Classify this hardware asset: ${description}`,
        },
      ],
      max_tokens: 10,
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${text}`);
  }

  const json = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const raw = json.choices[0]?.message?.content?.trim() ?? "";

  // Validate the returned value is one of our known categories.
  const matched = CATEGORIES.find(
    (c) => c.toLowerCase() === raw.toLowerCase()
  );
  return matched ?? "Other";
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let description: string;

  try {
    const body = (await request.json()) as { description?: string };
    description = body.description?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!description) {
    return NextResponse.json(
      { error: "description is required." },
      { status: 400 }
    );
  }

  // ── Try AI, fall back to keywords ─────────────────────────────────────────
  if (process.env.OPENAI_API_KEY) {
    try {
      const category = await classifyWithAI(description);
      return NextResponse.json({ category, source: "ai" });
    } catch (err) {
      // Log the AI failure but don't propagate it to the client — fall through.
      console.error("[suggest-category] OpenAI call failed, using fallback:", err);
    }
  }

  const category = classifyByKeyword(description);
  return NextResponse.json({ category, source: "fallback" });
}
