import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID") || "1033874890501-p253hb5at1qb077rcoitv6pjc9elf75n.apps.googleusercontent.com";
  const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { bookingPageId, startTime, endTime, duration, attendeeName, attendeeEmail, attendeePhone, notes } = await req.json();

    if (!bookingPageId || !startTime || !attendeeName || !attendeeEmail) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get booking page
    const { data: bookingPage, error: bpError } = await supabase
      .from("booking_pages")
      .select("*")
      .eq("id", bookingPageId)
      .eq("is_active", true)
      .single();

    if (bpError || !bookingPage) {
      return new Response(JSON.stringify({ error: "Booking page not found" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const computedEndTime = endTime || new Date(new Date(startTime).getTime() + (duration || 30) * 60000).toISOString();
    const eventTitle = `Meeting with ${attendeeName}`;

    // Check for conflicts
    const { data: conflicts } = await supabase
      .from("calendar_events")
      .select("id")
      .eq("user_id", bookingPage.user_id)
      .eq("status", "confirmed")
      .lt("start_time", computedEndTime)
      .gt("end_time", startTime);

    if (conflicts && conflicts.length > 0) {
      return new Response(JSON.stringify({ error: "This time slot is no longer available" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create event in our DB
    const { data: event, error: eventError } = await supabase
      .from("calendar_events")
      .insert({
        user_id: bookingPage.user_id,
        company_id: bookingPage.company_id,
        booking_page_id: bookingPageId,
        title: eventTitle,
        description: notes || `Booking by ${attendeeName} (${attendeeEmail})`,
        start_time: startTime,
        end_time: computedEndTime,
        attendee_name: attendeeName,
        attendee_email: attendeeEmail,
        attendee_phone: attendeePhone,
        event_type: "booking",
        status: "confirmed",
      })
      .select()
      .single();

    if (eventError) throw eventError;

    // Try to create Google Calendar event if connected
    const { data: calConn } = await supabase
      .from("calendar_connections")
      .select("*")
      .eq("user_id", bookingPage.user_id)
      .eq("provider", "google")
      .eq("is_active", true)
      .maybeSingle();

    // Fetch host profile to get the host's email address
    const { data: hostProfile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", bookingPage.user_id)
      .maybeSingle();

    if (calConn?.access_token && googleClientId && googleClientSecret) {
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

      // Create Google Calendar event
      try {
        const attendeesList = [
          { email: attendeeEmail, displayName: attendeeName }
        ];

        if (hostProfile?.email) {
          attendeesList.push({ email: hostProfile.email, displayName: hostProfile.full_name || 'Host' });
        }

        const gcalEvent = {
          summary: eventTitle,
          description: notes || `Booked via Fastest CRM by ${attendeeName}`,
          start: { dateTime: startTime, timeZone: bookingPage.timezone || "Asia/Kolkata" },
          end: { dateTime: computedEndTime, timeZone: bookingPage.timezone || "Asia/Kolkata" },
          attendees: attendeesList,
          reminders: { useDefault: true },
          conferenceData: {
            createRequest: {
              requestId: crypto.randomUUID(),
              conferenceSolutionKey: { type: "hangoutsMeet" }
            }
          }
        };

        const gcalResp = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${calConn.calendar_id || "primary"}/events?sendUpdates=all&conferenceDataVersion=1`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(gcalEvent),
          }
        );

        const gcalData = await gcalResp.json();
        if (gcalData.id) {
          const meetLink = gcalData.hangoutLink || '';
          await supabase.from("calendar_events").update({ 
            google_event_id: gcalData.id,
            location: meetLink
          }).eq("id", event.id);
          
          event.location = meetLink;
        }
      } catch (gcalError) {
        console.error("Google Calendar API error:", gcalError);
        // Don't fail the booking if GCal fails
      }
    }

    return new Response(JSON.stringify({ success: true, event }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("create-booking error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
