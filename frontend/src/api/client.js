import axios from 'axios';

// Axios instance pointing to the FastAPI backend via Vite's /api proxy.
// const client = axios.create({
//   baseURL: '/api',
//   timeout: 30_000,
// });

// Axios instance pointing to the render backend site
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 30000,
});

// Attach identity headers from localStorage on every request.
client.interceptors.request.use((config) => {
  try {
    const userId = localStorage.getItem('userId');
    const role = localStorage.getItem('role');
    const customerId = localStorage.getItem('customerId');
    if (userId) config.headers['X-User-Id'] = userId;
    if (role) config.headers['X-Role'] = role;
    if (customerId) config.headers['X-Customer-Id'] = customerId;
  } catch (_) {
    // localStorage may be unavailable in SSR / private modes
  }
  return config;
});

client.interceptors.response.use(
  (resp) => resp,
  (err) => {
    // Surface a friendly error shape upstream
    return Promise.reject(err);
  }
);

// ============================================================
// AUTH
// ============================================================
export const login = (username, password) =>
  client.post('/auth/login', { username, password }).then((r) => r.data);

// ============================================================
// DISTRIBUTOR
// ============================================================
export const getCustomerDashboard = (customerId) =>
  client.get(`/customers/${customerId}/dashboard`).then((r) => r.data);

export const getCatalog = (customerId, params = {}) => {
  // If a customerId is supplied, fetch the customer-filtered catalog with
  // negotiated/promotional pricing.  Otherwise return the full admin list.
  if (customerId !== undefined && customerId !== null && customerId !== '') {
    return client
      .get('/products/catalog', {
        params: { customer_id: customerId, ...params },
      })
      .then((r) => r.data);
  }
  return client.get('/products', { params }).then((r) => r.data);
};

export const getMerchandise = (params = {}) =>
  client.get('/merchandise', { params }).then((r) => r.data);

export const getMerchandiseCategories = () =>
  client.get('/merchandise/categories').then((r) => r.data);

export const getPromotions = (params = {}) =>
  client.get('/promotions', { params }).then((r) => r.data);

export const getActivePromotions = (customerId) =>
  client
    .get('/promotions/active', { params: { customer_id: customerId } })
    .then((r) => r.data);

export const getCart = () => client.get('/orders/cart').then((r) => r.data);

export const validateCart = (customerId, items) =>
  client
    .post('/orders/cart/validate', { customer_id: customerId, items })
    .then((r) => r.data);

export const submitOrder = (customerIdOrPayload, items, notes = null) => {
  // Backwards-compat: accept either a single payload object or (customerId, items, notes).
  let payload;
  if (
    customerIdOrPayload &&
    typeof customerIdOrPayload === 'object' &&
    !Array.isArray(customerIdOrPayload)
  ) {
    payload = customerIdOrPayload;
  } else {
    payload = {
      customer_id: customerIdOrPayload,
      items: items || [],
      notes,
    };
  }
  return client.post('/orders', payload).then((r) => r.data);
};

export const getOrders = (customerId) =>
  client
    .get('/orders', { params: customerId ? { customer_id: customerId } : {} })
    .then((r) => r.data);

export const getOrder = (orderId) =>
  client.get(`/orders/${orderId}`).then((r) => r.data);

export const getOrderTracking = (orderId) =>
  client.get(`/orders/${orderId}/tracking`).then((r) => r.data);

export const reorderOrder = (orderId, customerId) =>
  client
    .post(`/orders/${orderId}/reorder`, null, {
      params: { customer_id: customerId },
    })
    .then((r) => r.data);

export const askAIAboutOrder = (orderId, question) =>
  client
    .post(`/ai/order/${orderId}/explain`, { question })
    .then((r) => r.data);

export const getDocuments = (params = {}) =>
  client.get('/documents', { params }).then((r) => r.data);

export const getAR = (customerId) =>
  client.get(`/customers/${customerId}/ar`).then((r) => r.data);

// ============================================================
// MANAGER
// ============================================================
export const getPendingApprovals = (params = {}) =>
  client.get('/orders/pending/approval', { params }).then((r) => r.data);

export const getOrderReview = (orderId) =>
  client.get(`/orders/${orderId}/review`).then((r) => r.data);

export const approveOrder = (orderId, payload) =>
  client.post(`/orders/${orderId}/approve`, payload).then((r) => r.data);

export const rejectOrder = (orderId, payload) =>
  client.post(`/orders/${orderId}/reject`, payload).then((r) => r.data);

// ============================================================
// AI
// ============================================================
export const getAIRecommendation = (orderId) =>
  client
    .post(`/ai/order/${orderId}/recommendation`)
    // The endpoint wraps the assessment under `recommendation`; the AI Copilot
    // page expects the bare recommendation object.
    .then((r) => r.data?.recommendation ?? r.data);

export const getAIExplanation = (orderId) =>
  client.get(`/ai/order/${orderId}/explain`).then((r) => r.data);

export const explainAIDecision = (orderId, question) =>
  client
    .post(`/ai/order/${orderId}/explain`, { question })
    .then((r) => r.data);

export const askAIAssistant = (payload) =>
  client.post('/ai/assistant', payload).then((r) => r.data);

// Reshape the approval-report payload (which nests data under
// `ai_recommendation` / `inventory_status` / `financial_health` and uses
// backend field names) into the structure the AIApprovalReport page's
// normalizer consumes, so every dossier section renders fully populated.
function _fmtUsd(n) {
  const v = Number(n) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(v);
}

function _mapApprovalReport(d) {
  if (!d || typeof d !== 'object') return d;

  const ai = d.ai_recommendation || {};
  const inv = d.inventory_status || {};
  const fin = d.financial_health || {};
  const order = d.order || {};
  const customer = d.customer || {};

  const invItems = Array.isArray(inv.items) ? inv.items : [];
  const totalRequested = invItems.reduce(
    (acc, i) => acc + (Number(i.requested) || 0),
    0
  );
  const totalShort = Number(inv.total_shortage_units) || 0;
  const coveragePct =
    totalRequested > 0
      ? Math.max(0, Math.min(100, ((totalRequested - totalShort) / totalRequested) * 100))
      : 100;
  const flaggedSkus = invItems
    .filter((i) => (Number(i.shortage) || 0) > 0)
    .map((i) => i.sku || i.name)
    .filter(Boolean);

  const creditLimit = Number(fin.credit_limit) || 0;
  const outstanding = Number(fin.outstanding_balance) || 0;
  const creditUtil = creditLimit > 0 ? (outstanding / creditLimit) * 100 : null;

  const riskScore = ai.risk_score ?? order.risk_score ?? 0; // 0-100

  return {
    customer: {
      name: customer.name,
      market: customer.market,
      contact: customer.contact_name,
      email: customer.contact_email,
      phone: customer.contact_phone,
      credit_limit: customer.credit_limit,
      account_since: customer.created_at,
    },
    order: {
      id: order.id,
      placed_at: order.created_at,
      requested_delivery: order.expected_delivery,
      total: order.total_value,
      currency: 'USD',
      line_items: (Array.isArray(order.items) ? order.items : []).map((it) => ({
        sku: it.sku,
        name: it.name,
        qty: it.quantity_requested,
        unit_price: it.unit_price,
        line_total: it.line_total,
      })),
      notes: order.notes,
    },
    inventory: {
      coverage_pct: coveragePct,
      dc: 'Primary DC',
      flagged_skus: flaggedSkus,
      lead_time_days: null,
      summary: inv.any_shortage
        ? `${totalShort} unit(s) short across ${flaggedSkus.length} SKU(s); remaining quantities are staged at the primary distribution center.`
        : 'All requested SKUs are fully available at the primary distribution center.',
    },
    financial: {
      credit_utilization_pct: creditUtil,
      dpo: fin.days_sales_outstanding ?? null,
      on_time_pct: null,
      ar_balance: fin.open_invoice_balance ?? null,
      overdue_balance: fin.overdue_balance ?? null,
      summary: `Credit health rated "${fin.rating || fin.credit_health || 'n/a'}". Outstanding balance of ${_fmtUsd(outstanding)} against a ${_fmtUsd(creditLimit)} limit, with ${fin.overdue_invoice_count || 0} overdue invoice(s) on file.`,
    },
    ai_decision: {
      decision: ai.decision,
      confidence: ai.confidence,
      reasoning: ai.reasoning,
      key_factors: ai.key_factors,
    },
    risk: {
      score: riskScore,
      drivers: [
        {
          label: 'Credit exposure',
          value:
            creditUtil !== null
              ? `${Math.round(creditUtil)}% of limit utilized`
              : 'Within tolerance',
        },
        {
          label: 'Inventory risk',
          value: inv.any_shortage ? `${totalShort} units short` : 'Fully covered',
        },
        {
          label: 'Overdue invoices',
          value: `${fin.overdue_invoice_count || 0} on file`,
        },
      ],
      mitigations:
        ai.suggested_action ||
        'Standard monitoring applies; no additional mitigations required.',
    },
    recommendations: ai.suggested_action ? [ai.suggested_action] : undefined,
    generated_at: d.generated_at,
  };
}

export const generateApprovalReport = (orderId) =>
  client
    .post(`/ai/order/${orderId}/approval-report`)
    .then((r) => _mapApprovalReport(r.data));

// ============================================================
// EXECUTIVE / SIMULATION
// ============================================================
export const getExecutiveKPIs = (params = {}) =>
  client.get('/analytics/executive/kpis', { params }).then((r) => r.data);

export const runSimulation = (payload) =>
  client.post('/simulation/run', payload).then((r) => r.data);

export default client;
