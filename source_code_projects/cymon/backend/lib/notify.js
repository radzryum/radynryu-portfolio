const { supabase } = require('./supabase');
const { sendMail } = require('./email');

// Insert a notification for one recipient. Best-effort: notifications are a
// secondary effect of an action (booking, sign-off, …), so a failure here must
// never break the primary request — we log and swallow instead of throwing.
async function createNotification({ clinicId, recipientId, type = 'system', title, body = null, link = null, email = null, entityType = null, entityId = null }) {
  if (!recipientId || !clinicId || !title) {
    // Silent skips are invisible in prod — log them so a missing bell
    // notification can be traced to a missing id instead of a mystery.
    console.warn('[notify] skipped notification (missing id):', JSON.stringify({ clinicId: clinicId || null, recipientId: recipientId || null, title: title || null, type }));
    return;
  }
  const row = {
    clinic_id: clinicId,
    recipient_id: recipientId,
    type,
    title,
    body,
    link,
  };
  // entity_type/entity_id arrive with migration 0113. If the production
  // database hasn't applied it yet, the insert fails on an unknown column —
  // retry without the linkage rather than dropping the notification (the
  // 0106/0111 enum outage taught us silent notification loss is worse than
  // a temporarily unresolvable bell item).
  if (entityType && entityId) {
    row.entity_type = entityType;
    row.entity_id = entityId;
  }
  const { error } = await supabase.from('notifications').insert(row);
  if (error && entityType && /entity_(type|id)/.test(error.message || '')) {
    console.warn('[notify] entity columns missing (apply migration 0113), storing without linkage.');
    delete row.entity_type;
    delete row.entity_id;
    const { error: retryError } = await supabase.from('notifications').insert(row);
    if (retryError) console.error('[notify] failed to create notification:', retryError.message);
  } else if (error) {
    console.error('[notify] failed to create notification:', error.message);
  }

  if (!email || error) return;
  const { data: recipient, error: recipientError } = await supabase
    .from('profiles')
    .select('email, display_name')
    .eq('id', recipientId)
    .maybeSingle();
  if (recipientError) {
    console.error('[notify] failed to load email recipient:', recipientError.message);
    return;
  }
  if (!recipient?.email) return;

  sendMail({
    to: recipient.email,
    subject: email.subject || title,
    templateKey: email.templateKey || 'notification',
    templateData: {
      recipient_name: recipient.display_name || 'there',
      notification_title: title,
      notification_body: body || '',
      notification_link: link || '',
      ...(email.templateData || {}),
    },
  }).catch((mailError) => console.error('[email] failed to send portal notification:', mailError.message));
}

module.exports = { createNotification };
