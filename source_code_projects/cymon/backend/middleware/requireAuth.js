const { supabase, supabaseConfigured } = require('../lib/supabase');

async function requireAuth(req, res, next) {
  if (!supabaseConfigured) {
    return res
      .status(500)
      .json({ error: 'Server not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.' });
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // first/middle/last feed the sidebar's "First M. Last" short name (exact
  // middle initial, compound surnames like "Dela Cruz" intact). These columns
  // predate every migration fallback below, so all four queries stay safe.
  const baseCols = 'id, role, display_name, email, clinic_id, deleted_at, phone, title, license_no, avatar_url, employee_id, first_name, middle_name, last_name, license_id_url';
  // extra_roles is added by migration 0017, disabled_roles by 0115 —
  // fall back when either isn't applied yet
  let { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(`${baseCols}, extra_roles, disabled_roles, onboarding_completed_at`)
    .eq('id', data.user.id)
    .single();
  if (profileError) {
    ({ data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`${baseCols}, extra_roles, disabled_roles, admin_onboarding_completed_at, psychologist_onboarding_completed_at, psychometrician_onboarding_completed_at`)
      .eq('id', data.user.id)
      .single());
  }
  if (profileError) {
    ({ data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`${baseCols}, extra_roles, disabled_roles`)
      .eq('id', data.user.id)
      .single());
  }
  if (profileError) {
    ({ data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`${baseCols}, extra_roles`)
      .eq('id', data.user.id)
      .single());
  }
  if (profileError) {
    ({ data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(baseCols)
      .eq('id', data.user.id)
      .single());
  }

  if (profileError || !profile) {
    return res.status(401).json({ error: 'Profile not found' });
  }
  if (profile.deleted_at) {
    return res.status(401).json({ error: 'This account has been deactivated' });
  }

  profile.extra_roles = profile.extra_roles || [];
  // Per-role deactivation (migration 0115): a disabled role stays on the
  // account but can no longer be acted in. Sign-in is blocked only when
  // every held role is disabled — otherwise the account keeps working in
  // its remaining roles.
  profile.disabled_roles = Array.isArray(profile.disabled_roles) ? profile.disabled_roles : [];
  profile.onboarding_completed_at = profile.onboarding_completed_at
    || profile.admin_onboarding_completed_at
    || profile.psychologist_onboarding_completed_at
    || profile.psychometrician_onboarding_completed_at
    || null;

  // Branch access (migration 0114): one email, many branches. The junction
  // holds every extra branch; home (clinic_id) is always included. A missing
  // table (migration not applied yet) degrades to home-branch-only.
  let branchIds = [profile.clinic_id].filter(Boolean);
  try {
    const { data: branchRows } = await supabase
      .from('profile_clinics')
      .select('clinic_id')
      .eq('profile_id', profile.id);
    const extra = (branchRows || []).map((r) => r.clinic_id).filter(Boolean);
    branchIds = [...new Set([...branchIds, ...extra])];
  } catch {
    // junction missing — home branch only
  }
  profile.branch_ids = branchIds;
  profile.home_clinic_id = profile.clinic_id;

  // Acting branch: a staffer works in one branch at a time. The header
  // re-scopes clinic_id for this request only, so every existing
  // single-clinic query keeps working unchanged. A Super Admin may act in
  // ANY branch (they administer all of them); everyone else is limited to
  // their assigned branches — unknown branches are ignored, never trusted
  // blindly. `branch_scoped` records an explicit choice so list endpoints
  // can tell "scoped to this branch" apart from "no choice".
  const isSuper = profile.role === 'super_admin';
  const activeBranchHeader = typeof req.headers['x-active-branch'] === 'string'
    ? req.headers['x-active-branch'].trim()
    : '';
  profile.branch_scoped = false;
  if (activeBranchHeader && (branchIds.includes(activeBranchHeader) || isSuper)) {
    if (isSuper && !branchIds.includes(activeBranchHeader)) branchIds.push(activeBranchHeader);
    profile.branch_ids = branchIds;
    profile.active_branch_id = activeBranchHeader;
    profile.clinic_id = activeBranchHeader;
    profile.branch_scoped = true;
  } else {
    profile.active_branch_id = profile.clinic_id;
  }

  const allRoles = [profile.role, ...(profile.extra_roles || [])]
    .filter(Boolean)
    .filter((r) => !profile.disabled_roles.includes(r));
  if (profile.role !== 'client' && allRoles.length === 0) {
    return res.status(401).json({ error: 'All roles on this account have been deactivated. Contact an administrator.' });
  }
  const activeRoleHeader = req.headers['x-active-role'];
  if (activeRoleHeader && allRoles.includes(activeRoleHeader)) {
    req.activeRoles = [activeRoleHeader];
  } else {
    req.activeRoles = allRoles;
  }

  if (profile.role === 'client' && profile.onboarding_completed_at) {
    const { data: pt } = await supabase
      .from('patients')
      .select('id')
      .eq('caregiver_id', profile.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!pt) {
      return res.status(401).json({ error: 'This account has been deactivated because the enrolled student was removed.' });
    }
  }

  req.user = data.user;
  req.profile = profile;
  req.accessToken = token;
  next();
}

module.exports = requireAuth;
