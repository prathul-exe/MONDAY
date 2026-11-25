import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: subjects }, { data: records }, { data: settings }] = await Promise.all([
      supabase.from("subjects").select("*").eq("is_active", true),
      supabase.from("attendance_records").select("subject_id, status"),
      supabase.from("user_settings").select("*").single(),
    ]);

    const notificationsToInsert: any[] = [];

    for (const subj of subjects ?? []) {
      const subjRecords = (records ?? []).filter((r: any) => r.subject_id === subj.id);
      const attended = subjRecords.filter((r: any) => r.status === "present").length;
      const absent = subjRecords.filter((r: any) => r.status === "absent").length;
      const total = attended + absent;
      if (total === 0) continue;

      const pct = (attended / total) * 100;
      const reqPct = Number(subj.required_attendance ?? settings?.min_attendance_threshold ?? 75);
      const warnPct = Number(settings?.warning_threshold ?? reqPct + 5);

      if (pct < reqPct && settings?.critical_shortage_alert !== false) {
        notificationsToInsert.push({
          user_id: user.id,
          type: "attendance_shortage",
          title: `Shortage Alert: ${subj.name}`,
          message: `${subj.code} is at ${pct.toFixed(1)}% (below ${reqPct}%).`,
          level: "critical",
          related_subject_id: subj.id,
        });
      } else if (pct < warnPct && settings?.smart_buffer_warnings !== false) {
        notificationsToInsert.push({
          user_id: user.id,
          type: "attendance_warning",
          title: `Low Buffer: ${subj.name}`,
          message: `${subj.code} is at ${pct.toFixed(1)}%, approaching ${reqPct}%.`,
          level: "warning",
          related_subject_id: subj.id,
        });
      }
    }

    if (notificationsToInsert.length > 0) {
      await supabase.from("notifications").insert(notificationsToInsert);
    }

    // Optional Firebase Cloud Messaging (FCM) push dispatch when configured
    const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");
    if (fcmServerKey && notificationsToInsert.length > 0) {
      const { data: profile } = await supabase
        .from("student_profiles")
        .select("fcm_token")
        .eq("id", user.id)
        .single();

      if (profile?.fcm_token) {
        await fetch("https://fcm.googleapis.com/fcm/send", {
          method: "POST",
          headers: {
            Authorization: `key=${fcmServerKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: profile.fcm_token,
            notification: {
              title: notificationsToInsert[0].title,
              body: notificationsToInsert[0].message,
            },
          }),
        });
      }
    }

    return new Response(
      JSON.stringify({ generated: notificationsToInsert.length, notifications: notificationsToInsert }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
