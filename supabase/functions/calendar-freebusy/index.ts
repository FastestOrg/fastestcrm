import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { bookingPageId, timeMin, timeMax } = await req.json();

    if (!bookingPageId || !timeMin || !timeMax) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get booking page -> user's calendar connection
    const { data: bookingPage, error: bpError } = await supabase
      .from("booking_pages")
      .select("user_id, timezone")
      .eq("id", bookingPageId)
      .eq("is_active", true)
      .single();

    if (bpError || !bookingPage) {
      return new Response(JSON.stringify({ error: "Booking page not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: calConn } = await supabase
      .from("calendar_connections")
      .select("*")
      .eq("user_id", bookingPage.user_id)
      .eq("provider", "google")
      .eq("is_active", true)
      .single();

    if (!calConn?.access_token || !googleClientId || !googleClientSecret) {
      // If no calendar connected, return empty busy list (relies on internal CRM events only)
      return new Response(JSON.stringify({ busy: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accessToken = calConn.access_token;

    // Check if token expired, refresh if needed
    if (calConn.token_expires_at && new Date(calConn.token_expires_at) < new Date()) {
      if (calConn.refresh_token) {
        const refreshResp = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: googleClientId,
            client_secret: googleClientSecret,
            refresh_token: calConn.refresh_token,
            grant_type: "refresh_token",
          }),
        });
        const refreshData = await refreshResp.json();
        if (refreshData.access_token) {
          accessToken = refreshData.access_token;
          await supabase.from("calendar_connections").update({
            access_token: accessToken,
            token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
          }).eq("id", calConn.id);
        }
      }
    }

    // Call Google FreeBusy API
    const freeBusyReq = {
      timeMin,
      timeMax,
      timeZone: bookingPage.timezone || "Asia/Kolkata",
      items: [{ id: calConn.calendar_id || "primary" }]
    };

    const gcalResp = await fetch(
      `https://www.googleapis.com/calendar/v3/freeBusy`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(freeBusyReq),
      }
    );

    const gcalData = await gcalResp.json();
    
    // Extract busy times for the primary calendar
    const calendarId = calConn.calendar_id || "primary";
    let busyTimes = [];
    
    // GCal freeBusy response structure: 
    // calendars: { "primary": { busy: [{ start: "...", end: "..." }] } }
    if (gcalData.calendars) {
        // Sometimes the key in `calendars` is the actual email if "primary" was requested
        // So we grab the first value we find if `primary` key doesn't work.
        const calKey = gcalData.calendars[calendarId] ? calendarId : Object.keys(gcalData.calendars)[0];
        if (calKey && gcalData.calendars[calKey]?.busy) {
            busyTimes = gcalData.calendars[calKey].busy;
        }
    }

    return new Response(JSON.stringify({ busy: busyTimes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("calendar-freebusy error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
