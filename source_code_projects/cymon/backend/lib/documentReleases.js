const APPROVED_ASSESSMENT_STATUSES = new Set(['scored', 'approved', 'finalized']);
const SOURCE_TABLES = new Set(['assessment_submissions', 'assessment_reports', 'session_logs']);
const ACTIVE_RELEASE_STATUSES = ['pending', 'scheduled'];

function sourceKey(sourceTable, sourceId) {
  return `${sourceTable}:${sourceId}`;
}

function normalizeMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Number(number.toFixed(2));
}

function totalForItems(items = []) {
  return Number(items.reduce((sum, item) => sum + Number(item.fee || 0), 0).toFixed(2));
}

function formatReleaseRequest(request, items = request?.assessment_document_release_items || []) {
  const normalizedItems = (items || []).map((item) => ({
    id: item.id,
    source_table: item.source_table,
    source_id: item.source_id,
    template_id: item.template_id,
    document_type_code: item.document_type_code,
    title: item.title,
    completed_at: item.completed_at,
    fee: Number(item.fee || 0),
  }));

  return {
    id: request.id,
    patient_id: request.patient_id,
    student_name: request.student_name || null,
    patient_identifier: request.patient_identifier || null,
    status: request.status,
    scheduled_date: request.scheduled_date || null,
    scheduled_start_time: request.scheduled_start_time || null,
    scheduled_end_time: request.scheduled_end_time || null,
    location: request.location || 'Main Clinic Cashier / Reception',
    payment_status: request.payment_status || 'unpaid',
    payment_method: request.payment_method || null,
    payment_preference: request.payment_preference || 'onsite',
    paymongo_checkout_url: request.paymongo_checkout_url || null,
    paid_at: request.paid_at || null,
    released_at: request.released_at || null,
    declined_reason: request.declined_reason || null,
    admin_note: request.admin_note || null,
    client_reason: request.client_reason || null,
    requested_at: request.created_at || null,
    updated_at: request.updated_at || null,
    total_amount: totalForItems(normalizedItems),
    items: normalizedItems,
  };
}

module.exports = {
  ACTIVE_RELEASE_STATUSES,
  APPROVED_ASSESSMENT_STATUSES,
  SOURCE_TABLES,
  formatReleaseRequest,
  normalizeMoney,
  sourceKey,
  totalForItems,
};
