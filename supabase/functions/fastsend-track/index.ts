/**
 * fastsend-track — Open tracking pixel endpoint
 * 
 * Serves a 1x1 transparent GIF and logs the open event.
 * Public endpoint — no authentication required.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// 1x1 transparent GIF
const TRANSPARENT_GIF = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
  0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
  0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b,
]);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const pixelId = url.searchParams.get("pid");

  // Always return the pixel, even if tracking fails
  const headers = {
    "Content-Type": "image/gif",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    // Allow cross-origin for email clients
    "Access-Control-Allow-Origin": "*",
  };

  if (pixelId) {
    // Fire and forget — don't block the pixel response
    try {
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const now = new Date().toISOString();

      // Update the log entry
      const { data: logEntry } = await adminClient
        .from("email_campaign_logs")
        .select("id, recipient_id, campaign_id, opened_at")
        .eq("tracking_pixel_id", pixelId)
        .maybeSingle();

      if (logEntry && !logEntry.opened_at) {
        // Mark log as opened
        await adminClient
          .from("email_campaign_logs")
          .update({ status: "opened", opened_at: now })
          .eq("id", logEntry.id);

        // Update recipient opened_at if first open
        if (logEntry.recipient_id) {
          await adminClient
            .from("email_campaign_recipients")
            .update({ opened_at: now })
            .eq("id", logEntry.recipient_id)
            .is("opened_at", null);
        }
      }
    } catch (err) {
      console.error("Tracking error:", err);
      // Don't fail — always serve the pixel
    }
  }

  return new Response(TRANSPARENT_GIF, { headers });
});
