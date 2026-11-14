// friendlyDbError — translate raw Postgres/PostgREST errors into plain
// language safe to show users. Raw messages like
// `invalid input value for enum report_status: "revalidation"` mean nothing
// to clinicians and parents, so every write path that surfaces
// `error.message` should pass it through here first.

function friendlyDbError(err, fallback = 'Something went wrong while saving. Please reload and try again.') {
  const message = String(err?.message || '');
  if (/invalid input value for enum/i.test(message)) {
    return 'This record has an outdated status and could not be saved. Please reload the page and try again — if it keeps happening, contact support.';
  }
  if (/duplicate key value|unique constraint|already exists/i.test(message)) {
    return 'This record already exists. Reload to see the latest data, then try again.';
  }
  if (/violates foreign key constraint/i.test(message)) {
    return 'A related record is missing (it may have been deleted). Reload and try again.';
  }
  if (/violates not-null constraint/i.test(message)) {
    return 'A required field is missing. Please fill in the form and try again.';
  }
  if (/column .* does not exist/i.test(message)) {
    return 'The server database needs an update before this can be saved. Please contact support.';
  }
  if (/row-level security|permission denied|not allowed/i.test(message)) {
    return 'You do not have permission to perform this action.';
  }
  return message || fallback;
}

module.exports = { friendlyDbError };
