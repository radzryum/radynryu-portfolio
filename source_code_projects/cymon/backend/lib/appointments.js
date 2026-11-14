'use strict';

// Shared appointment helpers.

// Marks past-due scheduled appointments as completed so they stop showing
// up in staff pendings and client upcoming lists. An appointment is past-due
// once its end time (starts_at + duration_minutes) has passed.
async function completePastAppointments(supabase, clinicId) {
  if (!supabase || !clinicId) return 0;
  const now = new Date();
  const { data: rows, error } = await supabase
    .from('appointments')
    .select('id, starts_at, duration_minutes')
    .eq('clinic_id', clinicId)
    .eq('status', 'scheduled')
    .lt('starts_at', now.toISOString());
  if (error || !rows || rows.length === 0) return 0;
  const expiredIds = rows
    .filter((row) => {
      const start = new Date(row.starts_at).getTime();
      if (Number.isNaN(start)) return false;
      const end = start + (row.duration_minutes || 60) * 60000;
      return end <= now.getTime();
    })
    .map((row) => row.id);
  if (expiredIds.length === 0) return 0;
  const { error: updateError } = await supabase
    .from('appointments')
    .update({ status: 'completed' })
    .in('id', expiredIds);
  if (updateError) return 0;
  return expiredIds.length;
}

module.exports = { completePastAppointments };
