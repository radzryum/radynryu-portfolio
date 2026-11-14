import { useEffect, useRef } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'

// Generic live-refresh: subscribe to Postgres changes on UI-facing tables
// and call onEvent (normally: refetch the page's lists from the server, so
// the view stays server-truth with no dedup logic). Polling/focus refetch
// stays as the fallback — a blocked socket or a missing 0109 publication
// just means updates arrive on the next fetch instead of instantly.
//
// subscriptions: [{ table, filter?, events? }]
//   table  — e.g. 'appointments'
//   filter — PostgREST realtime filter, e.g. `clinic_id=eq.${clinicId}`
//            (omit only when RLS already scopes to the user, e.g. the
//            notifications bell which filters recipient_id server-side)
//   events — default '*' (INSERT/UPDATE/DELETE); narrow when the page only
//            cares about one kind.
// RLS gates every event: the subscriber only receives rows its JWT may
// SELECT (see migration 0108), so subscribe with the same scope the page
// already loads.
function useRealtimeRefresh(userId, subscriptions, onEvent) {
  const cbRef = useRef(null)
  useEffect(() => {
    cbRef.current = onEvent
  })
  const sig = (Array.isArray(subscriptions) ? subscriptions : [])
    .map((s) => `${s.table}|${s.filter || ''}|${s.events || '*'}`)
    .join(';')

  useEffect(() => {
    if (!supabaseConfigured || !userId || !sig) return
    // Same guarantee as useRealtimeNotifications: a channel failure
    // (duplicate name, blocked socket) must degrade to polling, never
    // throw out of the effect and unmount the page.
    let channel = null
    try {
      // Rebuild from the signature so the effect only depends on stable
      // strings — callers can pass inline subscription arrays.
      const subs = sig.split(';').map((part) => {
        const [table, filter, events] = part.split('|')
        return { table, filter, events }
      })
      channel = supabase.channel(`ui:${userId}:${subs.map((s) => s.table).join(',')}`)
      for (const sub of subs) {
        channel.on(
          'postgres_changes',
          {
            event: sub.events && sub.events !== '*' ? sub.events : '*',
            schema: 'public',
            table: sub.table,
            ...(sub.filter ? { filter: sub.filter } : {}),
          },
          () => cbRef.current?.(),
        )
      }
      channel.subscribe((status, err) => {
        // Publication missing (migration 0109) or network blocked: stay
        // silent and let the page's normal fetching carry the load.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[realtime] subscription unavailable, using fetch fallback.', err?.message || '')
        }
      })
    } catch (err) {
      console.warn('[realtime] subscription failed, using fetch fallback.', err?.message || '')
      return
    }
    return () => {
      try {
        if (channel) supabase.removeChannel(channel)
      } catch {
        // ignore teardown errors
      }
    }
  }, [userId, sig])
}

export default useRealtimeRefresh
