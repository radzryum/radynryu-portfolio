import { useEffect, useRef } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'

// Instant bell updates via Supabase Realtime: subscribes to INSERTs on the
// notifications table for one recipient and calls onNotification for each.
// Polling stays as the fallback (works when websockets are blocked or the
// 0106 migration isn't applied yet) — onNotification should just refetch
// from the server so the list is always server-truth, no dedup needed.
function useRealtimeNotifications(userId, onNotification) {
  // Ref-hold the callback so the channel only resubscribes on user change.
  const cbRef = useRef(null)
  useEffect(() => {
    cbRef.current = onNotification
  })

  useEffect(() => {
    if (!supabaseConfigured || !userId) return
    // Realtime must never crash the page: two mounts sharing one channel
    // name (supabase-js reuses the instance) or a mid-subscribe failure
    // throws synchronously — polling stays as the fallback either way.
    let channel = null
    try {
      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` },
          () => cbRef.current?.(),
        )
        .subscribe((status, err) => {
          // Replication not enabled yet (migration 0106) or network blocked:
          // stay silent and let polling carry the load.
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('[realtime] notifications channel unavailable, using polling fallback.', err?.message || '')
          }
        })
    } catch (err) {
      console.warn('[realtime] notifications subscription failed, using polling fallback.', err?.message || '')
      return
    }
    return () => {
      try {
        if (channel) supabase.removeChannel(channel)
      } catch {
        // ignore teardown errors
      }
    }
  }, [userId])
}

export default useRealtimeNotifications
