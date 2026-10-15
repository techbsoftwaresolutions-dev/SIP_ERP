// Central registry of "pick from another list" dropdown sources used across
// add/edit forms (mirrors the useEffect fetches in the web app's pages).
export const OPTION_SOURCES = {
  customers: { endpoint: "/api/customers?page=1&pageSize=200", map: (r) => (r.data || []).map((c) => c.name) },
  suppliers: { endpoint: "/api/suppliers?page=1&pageSize=200", map: (r) => (r.data || []).map((s) => s.name) },
  products: { endpoint: "/api/products?page=1&pageSize=200", map: (r) => (r.data || []).map((p) => p.name) },
  categories: { endpoint: "/api/categories?page=1&pageSize=200", map: (r) => (r.data || []).map((c) => c.name) },
  brands: { endpoint: "/api/brands?page=1&pageSize=200", map: (r) => (r.data || []).map((b) => b.name) },
  salesOrders: { endpoint: "/api/sales/orders?page=1&pageSize=200", map: (r) => (r.data || []).map((s) => s.orderNo) },
  challans: { endpoint: "/api/sales/delivery-challans?page=1&pageSize=200", map: (r) => (r.data || []).map((c) => c.id) },
  salesInvoices: { endpoint: "/api/sales/invoices?page=1&pageSize=200", map: (r) => (r.data || []).map((i) => i.id) },
};

const UNITS = ["Nos", "Pcs", "Box", "Kg", "Litre", "Set", "Roll", "Sheet"];
export { UNITS };
