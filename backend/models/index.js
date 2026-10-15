const models = {
  Customer: require("./Customer"),
  CustomerGroup: require("./CustomerGroup"),
  Supplier: require("./Supplier"),
  SupplierGroup: require("./SupplierGroup"),
  Category: require("./Category"),
  Brand: require("./Brand"),
  Warehouse: require("./Warehouse"),
  Product: require("./Product"),
  Item: require("./Item"),
  PurchaseOrder: require("./PurchaseOrder"),
  GoodsReceipt: require("./GoodsReceipt"),
  PurchaseInvoice: require("./PurchaseInvoice"),
  PurchaseReturn: require("./PurchaseReturn"),
  InventoryItem: require("./InventoryItem"),
  StockTransaction: require("./StockTransaction"),
  Bom: require("./Bom"),
  WorkCenter: require("./WorkCenter"),
  Machine: require("./Machine"),
  WorkOrder: require("./WorkOrder"),
  JobCard: require("./JobCard"),
  MaterialIssue: require("./MaterialIssue"),
  ProductionReceipt: require("./ProductionReceipt"),
  SalesOrder: require("./SalesOrder"),
  Enquiry: require("./Enquiry"),
  Quotation: require("./Quotation"),
  DeliveryChallan: require("./DeliveryChallan"),
  Invoice: require("./Invoice"),
  SalesReturn: require("./SalesReturn"),
  MaintenanceTask: require("./MaintenanceTask"),
  User: require("./User"),
  Role: require("./Role"),
  ActivityLog: require("./ActivityLog"),
  LedgerEntry: require("./LedgerEntry"),
  Settings: require("./Settings"),
  CustomFieldDefinition: require("./CustomFieldDefinition"),
};

// ---- Indexes ----
// Every list endpoint sorts by { seq: -1 }; the per-model entries below cover
// the fields each collection is actually filtered / looked up by (see the
// query patterns in server.js). Indexes only speed reads — no behaviour
// change — and createIndexes() is idempotent, so this is safe to re-run.
const EXTRA_INDEXES = {
  Customer: [{ name: 1 }],
  Supplier: [{ name: 1 }],
  Product: [{ name: 1 }, { status: 1 }],
  Item: [{ name: 1, warehouse: 1 }],
  SalesOrder: [{ status: 1 }, { customer: 1 }, { createdAt: -1 }],
  Invoice: [{ customer: 1 }, { soNumber: 1 }, { createdAt: -1 }],
  DeliveryChallan: [{ salesOrder: 1 }],
  PurchaseOrder: [{ supplier: 1 }, { status: 1 }, { createdAt: -1 }],
  PurchaseInvoice: [{ supplier: 1 }],
  PurchaseReturn: [{ supplier: 1 }],
  GoodsReceipt: [{ poNumber: 1 }],
  StockTransaction: [{ type: 1 }, { createdAt: -1 }],
  LedgerEntry: [{ customer: 1 }, { supplier: 1 }],
  Bom: [{ product: 1 }, { status: 1 }],
  WorkCenter: [{ name: 1 }],
  Machine: [{ workCenter: 1 }, { status: 1 }],
  WorkOrder: [{ status: 1 }, { product: 1 }, { bom: 1 }, { salesOrder: 1 }, { createdAt: -1 }],
  JobCard: [{ workOrder: 1 }, { status: 1 }, { workCenter: 1 }],
  MaterialIssue: [{ workOrder: 1 }, { createdAt: -1 }],
  ProductionReceipt: [{ workOrder: 1 }, { product: 1 }, { createdAt: -1 }],
  ActivityLog: [{ createdAt: -1 }],
  User: [{ email: 1 }],
  CustomFieldDefinition: [{ entity: 1 }],
};

Object.entries(models).forEach(([name, Model]) => {
  if (Model.schema.path("seq")) Model.schema.index({ seq: -1 });
  (EXTRA_INDEXES[name] || []).forEach((spec) => {
    // don't re-declare a field that's already its own single index
    const keys = Object.keys(spec);
    if (keys.length === 1 && Model.schema.path(keys[0])?.options?.index) return;
    Model.schema.index(spec);
  });
  Model.createIndexes().catch(() => {});
});

module.exports = models;
