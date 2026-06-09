/**
 * BrewTrade AI - shared formatting utilities.
 */
import { format, parseISO, isValid } from 'date-fns';

export function formatCurrency(value, currency = 'USD') {
  if (value === null || value === undefined || isNaN(Number(value))) return '$0';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Number(value));
  } catch (_) {
    return `$${Number(value).toLocaleString()}`;
  }
}

export function formatNumber(value, opts = {}) {
  if (value === null || value === undefined || isNaN(Number(value))) return '0';
  return new Intl.NumberFormat('en-US', opts).format(Number(value));
}

export function formatDate(value, pattern = 'MMM d, yyyy') {
  if (!value) return '';
  let d;
  if (value instanceof Date) d = value;
  else if (typeof value === 'string') d = parseISO(value);
  else d = new Date(value);
  if (!isValid(d)) return String(value);
  try {
    return format(d, pattern);
  } catch (_) {
    return String(value);
  }
}

/**
 * Map an order/invoice/credit status string to an MUI palette key.
 */
export function statusColor(status) {
  if (!status) return 'default';
  const s = String(status).toLowerCase();
  switch (s) {
    case 'approved':
    case 'closed':
    case 'delivered':
    case 'green':
      return 'success';
    case 'submitted':
    case 'processing':
    case 'shipped':
    case 'open':
    case 'info':
      return 'info';
    case 'pending_approval':
    case 'pending':
    case 'review':
    case 'yellow':
      return 'warning';
    case 'rejected':
    case 'overdue':
    case 'red':
      return 'error';
    default:
      return 'default';
  }
}

export function percent(value, digits = 1) {
  if (value === null || value === undefined || isNaN(Number(value))) return '0%';
  return `${Number(value).toFixed(digits)}%`;
}
