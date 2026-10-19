export const purchasedLessonExpiry = (paidAt) => {
  const expiry = new Date(paidAt);
  if (Number.isNaN(expiry.getTime())) throw new Error('A successful payment date is required');
  const month = expiry.getUTCMonth();
  expiry.setUTCFullYear(expiry.getUTCFullYear() + 2);
  if (expiry.getUTCMonth() !== month) expiry.setUTCDate(0);
  return expiry;
};

export const entitlementActive = (row, date = new Date()) => Boolean(row && row.status === 'active'
  && (!row.startsAt || new Date(row.startsAt) <= date)
  && (!row.endsAt || new Date(row.endsAt) > date));
