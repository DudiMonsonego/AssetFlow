/**
 * Webhook Service
 *
 * Sends a structured POST request to an external automation platform
 * (Make.com, Zapier, n8n, etc.) whenever a business event occurs.
 *
 * The target URL is configured via the WEBHOOK_URL_ASSET_REPAIR environment
 * variable. When the variable is absent the function exits silently —
 * webhooks are treated as optional integrations, not hard requirements.
 *
 * This file is SERVER-SIDE ONLY. Import it only in:
 *   - Route Handlers  (app/api/[...]/route.ts)
 *   - Server Actions
 *
 * All functions are fire-and-forget from the caller's perspective:
 * delivery failures are logged but never thrown to the caller.
 */

// ─── Payload types ────────────────────────────────────────────────────────────

export interface AssetRepairWebhookPayload {
  /** ISO-8601 timestamp of the event. */
  event_timestamp: string;
  event_type:      "asset.status_changed";
  asset: {
    id:            string;
    name:          string;
    serial_number: string;
    new_status:    string;
  };
  organization: {
    name: string;
  };
}

// ─── Delivery ─────────────────────────────────────────────────────────────────

/**
 * Delivers the `asset.status_changed` webhook to the configured URL.
 * Fires when an asset transitions to "In Maintenance" (in_maintenance).
 *
 * @param payload - Structured event payload.
 */
export async function sendAssetRepairWebhook(
  payload: AssetRepairWebhookPayload
): Promise<void> {
  const webhookUrl = process.env.WEBHOOK_URL_ASSET_REPAIR;

  if (!webhookUrl?.trim()) {
    // Not configured — silently no-op. This is expected in development.
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        // Identify the sender so the automation platform can filter by source.
        "X-Source-App":  "AssetFlow",
        "X-Event-Type":  payload.event_type,
      },
      body: JSON.stringify(payload),
      // Do not wait longer than 10 seconds for delivery.
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error(
        `[webhook-service] Delivery failed — HTTP ${response.status} from ${webhookUrl}`
      );
    } else {
      console.log("[webhook-service] Delivered asset.status_changed webhook successfully.");
    }
  } catch (err) {
    // Network errors, timeouts, DNS failures — log and continue.
    console.error("[webhook-service] Delivery error:", err);
  }
}
