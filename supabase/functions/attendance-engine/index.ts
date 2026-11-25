import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function calculatePercentage(attended: number, total: number): number {
  if (total <= 0) return 0;
  return (attended / total) * 100;
}

function calculateClassesNeeded(attended: number, total: number, requiredPct: number): number {
  if (total <= 0) return 0;
  const r = requiredPct / 100;
  if (attended / total >= r) return 0;
  if (r >= 1) return -1;
  return Math.max(0, Math.ceil((r * total - attended) / (1 - r)));
}

function calculateClassesCanMiss(attended: number, total: number, requiredPct: number): number {
  if (total <= 0) return 0;
  const r = requiredPct / 100;
  if (r <= 0) return 9999;
  if (attended / total < r) return 0;
  return Math.max(0, Math.floor(attended / r - total));
}

function predictFutureAttendance(
  attended: number,
  total: number,
  remainingClasses: number,
  plannedAbsences = 0,
): number {
  const futureAttended = attended + Math.max(0, remainingClasses - plannedAbsences);
  const futureTotal = total + remainingClasses;
  return calculatePercentage(futureAttended, futureTotal);
}

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

    // Use anon key + caller JWT so PostgreSQL RLS enforces user ownership
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

    const url = new URL(req.url);
    const plannedAbsences = Number(url.searchParams.get("plannedAbsences") ?? 0);

    const [{ data: subjects }, { data: records }, { data: timetable }, { data: holidays }, { data: calendars }] =
      await Promise.all([
        supabase.from("subjects").select("*").eq("is_active", true).order("name"),
        supabase.from("attendance_records").select("subject_id, status"),
        supabase.from("timetable_entries").select("subject_id, day_of_week").eq("is_active", true),
        supabase.from("holidays").select("date"),
        supabase.from("academic_calendars").select("*").eq("is_current", true).limit(1),
      ]);

    const holidaySet = new Set((holidays ?? []).map((h: { date: string }) => h.date));
    const endDate = calendars?.[0]?.end_date ? new Date(calendars[0].end_date) : null;

    let totalAttended = 0;
    let totalConducted = 0;

    const subjectStats = (subjects ?? []).map((subj: any) => {
      const subjRecords = (records ?? []).filter((r: any) => r.subject_id === subj.id);
      const attended = subjRecords.filter((r: any) => r.status === "present").length;
      const absent = subjRecords.filter((r: any) => r.status === "absent").length;
      const excused = subjRecords.filter((r: any) => r.status === "excused").length;
      const total = attended + absent;

      totalAttended += attended;
      totalConducted += total;

      const reqPct = Number(subj.required_attendance ?? 75);
      const percentage = Number(calculatePercentage(attended, total).toFixed(1));
      const classesNeeded = calculateClassesNeeded(attended, total, reqPct);
      const classesCanMiss = calculateClassesCanMiss(attended, total, reqPct);

      // Estimate remaining classes until semester end if calendar & timetable exist
      let remainingClasses = 0;
      let estimatedRecoveryDate: string | null = null;
      if (endDate) {
        const subjDays = new Set(
          (timetable ?? []).filter((t: any) => t.subject_id === subj.id).map((t: any) => t.day_of_week),
        );
        const cursor = new Date();
        cursor.setDate(cursor.getDate() + 1);
        while (cursor <= endDate) {
          const iso = cursor.toISOString().split("T")[0];
          if (subjDays.has(cursor.getDay()) && !holidaySet.has(iso)) {
            remainingClasses++;
            if (classesNeeded > 0 && remainingClasses === classesNeeded) {
              estimatedRecoveryDate = iso;
            }
          }
          cursor.setDate(cursor.getDate() + 1);
        }
      }

      const projectedPercentage = Number(
        predictFutureAttendance(attended, total, remainingClasses, plannedAbsences).toFixed(1),
      );

      return {
        subject_id: subj.id,
        code: subj.code,
        name: subj.name,
        attended,
        absent,
        excused,
        total,
        percentage,
        required_attendance: reqPct,
        classes_needed: classesNeeded,
        classes_can_miss: classesCanMiss,
        remaining_classes: remainingClasses,
        projected_percentage: projectedPercentage,
        estimated_recovery_date: estimatedRecoveryDate,
      };
    });

    const overallAttendance = Number(calculatePercentage(totalAttended, totalConducted).toFixed(1));

    return new Response(
      JSON.stringify({
        overall_attendance: overallAttendance,
        total_attended: totalAttended,
        total_conducted: totalConducted,
        subjects: subjectStats,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
