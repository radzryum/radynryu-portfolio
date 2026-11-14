import { useCallback, useEffect, useState } from 'react'
import { AuthContext } from './AuthContext'
import { api, getSessionAccessToken, getStoredSession, setStoredSession, setStoredActiveRole, setStoredActiveBranch, SESSION_EXPIRED_EVENT } from '../lib/api'
import { supabase as supabaseClient, supabaseConfigured } from '../lib/supabase'

// Bridge the app session into the supabase-js client so features that talk
// to Supabase directly (Realtime channels) authenticate as the same user.
// The app's own API calls keep using the stored Bearer token untouched.
const syncClientSession = (session) => {
  if (!supabaseConfigured) return
  const access_token = session?.access_token
  const refresh_token = session?.refresh_token
  if (access_token && refresh_token) {
    supabaseClient.auth.setSession({ access_token, refresh_token }).catch(() => {})
  } else if (!access_token) {
    supabaseClient.auth.signOut().catch(() => {})
  }
}

export function AuthProvider({ children }) {
  const initialSession = getStoredSession()
  const [session, setSession] = useState(initialSession)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(Boolean(getSessionAccessToken(initialSession)))

  useEffect(() => {
    syncClientSession(initialSession)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!getSessionAccessToken(session)) return
    let active = true
    api
      .me()
      .then((data) => {
        if (!active) return
        setProfile(data.profile)
      })
      .catch((err) => {
        if (!active) return
        // Only drop the local session on auth failures. Network/5xx errors
        // must not sign the user out mid-form (Chrome submit bug).
        if (err?.status === 401) {
          setStoredSession(null)
          setSession(null)
          setProfile(null)
          syncClientSession(null)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [session])

  const signIn = useCallback(async (email, password) => {
    const data = await api.login({ email, password })
    setStoredSession(data.session)
    setSession(data.session)
    setProfile(data.profile)
    syncClientSession(data.session)
    // Fresh login always starts acting as the account's own primary role in
    // its home branch, so a stale role/branch from a previous session can't
    // silently empty directories.
    setStoredActiveRole(data.profile?.role || '')
    setStoredActiveBranch('')
    return data
  }, [])

  const signUp = useCallback(async (payload) => {
    const data = await api.signup(payload)
    if (data.session) {
      setStoredSession(data.session)
      setSession(data.session)
      setProfile(data.profile)
      setStoredActiveRole(data.profile?.role || '')
      setStoredActiveBranch('')
      syncClientSession(data.session)
    }
    return data
  }, [])

  const signOut = useCallback(() => {
    // Fire-and-forget: the audit beacon must not delay or block sign-out.
    try {
      api.logout();
    } catch {
      // Local sign-out always wins.
    }
    setStoredSession(null)
    setStoredActiveRole('')
    setStoredActiveBranch('')
    setSession(null)
    setProfile(null)
    syncClientSession(null)
  }, [])

  // Auto-logout on session expiry: the api layer broadcasts one event per
  // burst (parallel requests 401 together), RequireAuth then routes to
  // /login. The surviving toast — collapsed to one by the dedupe in
  // main.jsx — is the user's "session expired" notification, so no Retry
  // button is needed anywhere: retrying without signing in just 401s again.
  useEffect(() => {
    const onExpired = () => signOut()
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [signOut])

  const reloadProfile = useCallback(async () => {
    try {
      const data = await api.me()
      setProfile(data.profile)
    } catch {
      // ignore
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        reloadProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
