import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import AdminProtectedRoute from "./components/routing/AdminProtectedRoute";
import { SubscriptionProvider } from "./context/SubscriptionContext";
import { PermissionsProvider } from "./context/PermissionsContext";
import ProtectedRoute from "./components/routing/ProtectedRoute";
import Layout from "./components/layout/Layout";
import { STOCK_MOVE_ROLES } from "./components/layout/Sidebar";
import Login from "./pages/auth/Login";
import SetPassword from "./pages/auth/SetPassword";
import ForgotPassword from "./pages/auth/ForgotPassword";
import Loader from "./components/ui/Loader";

// Every page is code-split — the main bundle stays small and each screen
// (and its heavy deps, e.g. jsPDF/html2canvas on the print pages) only
// downloads when first visited. Behaviour is unchanged; just deferred.
const Dashboard = lazy(() => import("./pages/dashboard/Dashboard"));
const Sales = lazy(() => import("./pages/sales/Sales"));
const More = lazy(() => import("./pages/dashboard/More"));
const Subscription = lazy(() => import("./pages/settings/Subscription"));
const SettingsTabs = lazy(() => import("./pages/settings/SettingsTabs"));
const Reminders = lazy(() => import("./pages/dashboard/Reminders"));
const AiAssistant = lazy(() => import("./pages/ai/Assistant"));

const Customers = lazy(() => import("./pages/customers/Customers"));
const AddCustomer = lazy(() => import("./pages/customers/AddCustomer"));
const CustomerDetail = lazy(() => import("./pages/customers/CustomerDetail"));
const CustomerGroups = lazy(() => import("./pages/customers/Groups"));
const CustomerLedger = lazy(() => import("./pages/customers/Ledger"));
const CustomerOutstanding = lazy(() => import("./pages/customers/Outstanding"));

const Suppliers = lazy(() => import("./pages/suppliers/Suppliers"));
const AddSupplier = lazy(() => import("./pages/suppliers/AddSupplier"));
const SupplierDetail = lazy(() => import("./pages/suppliers/SupplierDetail"));
const SupplierGroups = lazy(() => import("./pages/suppliers/Groups"));
const SupplierLedger = lazy(() => import("./pages/suppliers/Ledger"));
const SupplierOutstanding = lazy(() => import("./pages/suppliers/Outstanding"));

const Categories = lazy(() => import("./pages/products/Categories"));
const Brands = lazy(() => import("./pages/products/Brands"));
const CategoryForm = lazy(() => import("./pages/products/CategoryForm"));
const BrandForm = lazy(() => import("./pages/products/BrandForm"));
const Items = lazy(() => import("./pages/products/Items"));
const ItemForm = lazy(() => import("./pages/products/ItemForm"));

const PurchaseOrders = lazy(() => import("./pages/purchase/Orders"));
const AddPurchaseOrder = lazy(() => import("./pages/purchase/AddPurchaseOrder"));
const PurchaseOrderDetail = lazy(() => import("./pages/purchase/PurchaseOrderDetail"));
const PurchaseOrderPrint = lazy(() => import("./pages/purchase/PurchaseOrderPrint"));
const GoodsReceipt = lazy(() => import("./pages/purchase/GoodsReceipt"));
const GoodsReceiptDetail = lazy(() => import("./pages/purchase/GoodsReceiptDetail"));
const PurchaseInvoices = lazy(() => import("./pages/purchase/Invoices"));
const PurchaseReturns = lazy(() => import("./pages/purchase/Returns"));
const AddPurchaseReturn = lazy(() => import("./pages/purchase/AddPurchaseReturn"));
const AddGoodsReceipt = lazy(() => import("./pages/purchase/AddGoodsReceipt"));
const AddPurchaseInvoice = lazy(() => import("./pages/purchase/AddPurchaseInvoice"));

const Inventory = lazy(() => import("./pages/inventory/Inventory"));
const StockDetail = lazy(() => import("./pages/inventory/StockDetail"));
const StockIn = lazy(() => import("./pages/inventory/StockIn"));
const StockInForm = lazy(() => import("./pages/inventory/StockInForm"));
const StockOut = lazy(() => import("./pages/inventory/StockOut"));
const StockOutForm = lazy(() => import("./pages/inventory/StockOutForm"));
const StockTransfer = lazy(() => import("./pages/inventory/StockTransfer"));
const StockAdjustment = lazy(() => import("./pages/inventory/StockAdjustment"));

const Boms = lazy(() => import("./pages/manufacturing/Boms"));
const BomForm = lazy(() => import("./pages/manufacturing/BomForm"));
const WorkOrders = lazy(() => import("./pages/manufacturing/WorkOrders"));
const WorkOrderForm = lazy(() => import("./pages/manufacturing/WorkOrderForm"));
const WorkOrderDetail = lazy(() => import("./pages/manufacturing/WorkOrderDetail"));
const JobCards = lazy(() => import("./pages/manufacturing/JobCards"));
const MaterialIssues = lazy(() => import("./pages/manufacturing/MaterialIssues"));
const ProductionReceipts = lazy(() => import("./pages/manufacturing/ProductionReceipts"));
const WorkCenters = lazy(() => import("./pages/manufacturing/WorkCenters"));
const Machines = lazy(() => import("./pages/manufacturing/Machines"));
const WorkCenterForm = lazy(() => import("./pages/manufacturing/WorkCenterForm"));
const MachineForm = lazy(() => import("./pages/manufacturing/MachineForm"));
const JobCardForm = lazy(() => import("./pages/manufacturing/JobCardForm"));

const Enquiries = lazy(() => import("./pages/sales/Enquiries"));
const Quotations = lazy(() => import("./pages/sales/Quotations"));
const QuotationForm = lazy(() => import("./pages/sales/QuotationForm"));
const QuotationPrint = lazy(() => import("./pages/sales/QuotationPrint"));
const QuotationDetail = lazy(() => import("./pages/sales/QuotationDetail"));
const EnquiryDetail = lazy(() => import("./pages/sales/EnquiryDetail"));
const EnquiryPrint = lazy(() => import("./pages/sales/EnquiryPrint"));
const ServiceDue = lazy(() => import("./pages/maintenance/Due"));
const ServiceHistory = lazy(() => import("./pages/maintenance/History"));
const EnquiryForm = lazy(() => import("./pages/sales/EnquiryForm"));
const SalesOrders = lazy(() => import("./pages/sales/SalesOrders"));
const SalesOrderForm = lazy(() => import("./pages/sales/SalesOrderForm"));
const SalesOrderDetail = lazy(() => import("./pages/sales/SalesOrderDetail"));
const DeliveryChallan = lazy(() => import("./pages/sales/DeliveryChallan"));
const DeliveryChallanForm = lazy(() => import("./pages/sales/DeliveryChallanForm"));
const DeliveryChallanDetail = lazy(() => import("./pages/sales/DeliveryChallanDetail"));
const Invoices = lazy(() => import("./pages/sales/Invoices"));
const InvoiceForm = lazy(() => import("./pages/sales/InvoiceForm"));
const InvoiceDetail = lazy(() => import("./pages/sales/InvoiceDetail"));
const InvoicePrint = lazy(() => import("./pages/sales/InvoicePrint"));
const DeliveryChallanPrint = lazy(() => import("./pages/sales/DeliveryChallanPrint"));
const SalesReturn = lazy(() => import("./pages/sales/SalesReturn"));
const SalesReturnForm = lazy(() => import("./pages/sales/SalesReturnForm"));


const SalesReports = lazy(() => import("./pages/reports/Sales"));
const PurchaseReports = lazy(() => import("./pages/reports/Purchase"));
const InventoryReports = lazy(() => import("./pages/reports/Inventory"));
const FinancialReports = lazy(() => import("./pages/reports/Financial"));
const OtherReports = lazy(() => import("./pages/reports/Other"));

const Users = lazy(() => import("./pages/users/List"));
const UserForm = lazy(() => import("./pages/users/UserForm"));
const RolesPermissions = lazy(() => import("./pages/users/Roles"));
const AuditLogs = lazy(() => import("./pages/users/ActivityLog"));

const Clients = lazy(() => import("./pages/admin/Clients"));
const ClientForm = lazy(() => import("./pages/admin/ClientForm"));
const Plans = lazy(() => import("./pages/admin/Plans"));
const AdminLayout = lazy(() => import("./components/layout/AdminLayout"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const SuperAdmins = lazy(() => import("./pages/admin/SuperAdmins"));
const SuperAdminForm = lazy(() => import("./pages/admin/SuperAdminForm"));
const AdminSessions = lazy(() => import("./pages/admin/AdminSessions"));
const PlanForm = lazy(() => import("./pages/admin/PlanForm"));
const Modules = lazy(() => import("./pages/admin/Modules"));
const ModuleForm = lazy(() => import("./pages/admin/ModuleForm"));
const AddOns = lazy(() => import("./pages/admin/AddOns"));
const AddOnForm = lazy(() => import("./pages/admin/AddOnForm"));
const GlobalRoles = lazy(() => import("./pages/admin/GlobalRoles"));
const GlobalRoleForm = lazy(() => import("./pages/admin/GlobalRoleForm"));
const GlobalPermissions = lazy(() => import("./pages/admin/GlobalPermissions"));
const MenuManagement = lazy(() => import("./pages/admin/MenuManagement"));
const MenuItemForm = lazy(() => import("./pages/admin/MenuItemForm"));
const Themes = lazy(() => import("./pages/admin/Themes"));
const ThemeForm = lazy(() => import("./pages/admin/ThemeForm"));
const InvoiceTemplates = lazy(() => import("./pages/admin/InvoiceTemplates"));
const PaymentMethods = lazy(() => import("./pages/admin/PaymentMethods"));
const PaymentMethodForm = lazy(() => import("./pages/admin/PaymentMethodForm"));
const PaymentGateway = lazy(() => import("./pages/admin/PaymentGateway"));
const Transactions = lazy(() => import("./pages/admin/Transactions"));
const ApprovalRules = lazy(() => import("./pages/admin/ApprovalRules"));
const ApprovalRuleForm = lazy(() => import("./pages/admin/ApprovalRuleForm"));
const Notifications = lazy(() => import("./pages/admin/Notifications"));
const AnnouncementForm = lazy(() => import("./pages/admin/AnnouncementForm"));
const AuditLog = lazy(() => import("./pages/admin/AuditLog"));
const DemoRequests = lazy(() => import("./pages/admin/DemoRequests"));


// The two surfaces have completely separate auth, so their providers are
// mounted as pathless layout routes rather than wrapping the whole tree. A
// signed-in client user has no standing in /admin and a super admin has none
// in the client app — and neither one's session can expire the other's.
function ClientProviders() {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <PermissionsProvider>
          <Outlet />
        </PermissionsProvider>
      </SubscriptionProvider>
    </AuthProvider>
  );
}

function AdminProviders() {
  return (
    <AdminAuthProvider>
      <Outlet />
    </AdminAuthProvider>
  );
}

// The Super Admin panel is served on its own host (admin.<domain>) from this same
// build. On that host the client sign-in and client dashboard make no sense, so
// every path that is not under /admin is sent to the admin sign-in instead.
const ON_ADMIN_HOST = window.location.hostname.split(".")[0] === "admin";

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <Suspense fallback={<div className="loading-row" style={{ padding: "48px", textAlign: "center" }}><Loader /></div>}>
          <Routes>
            {/* ---- Platform control plane ---- */}
            <Route element={<AdminProviders />}>
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route
                element={
                  <AdminProtectedRoute>
                    <AdminLayout />
                  </AdminProtectedRoute>
                }
              >
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/clients" element={<Clients />} />
                <Route path="/admin/clients/new" element={<ClientForm />} />
                <Route path="/admin/clients/:subdomain/edit" element={<ClientForm />} />
                <Route path="/admin/plans" element={<Plans />} />
                <Route path="/admin/plans/new" element={<PlanForm />} />
                <Route path="/admin/plans/:code/edit" element={<PlanForm />} />
                <Route path="/admin/modules" element={<Modules />} />
                <Route path="/admin/modules/:key/edit" element={<ModuleForm />} />
                <Route path="/admin/add-ons" element={<AddOns />} />
                <Route path="/admin/add-ons/new" element={<AddOnForm />} />
                <Route path="/admin/add-ons/:code/edit" element={<AddOnForm />} />
                <Route path="/admin/global-roles" element={<GlobalRoles />} />
                <Route path="/admin/global-roles/new" element={<GlobalRoleForm />} />
                <Route path="/admin/global-roles/:code/edit" element={<GlobalRoleForm />} />
                <Route path="/admin/global-permissions" element={<GlobalPermissions />} />
                <Route path="/admin/menus" element={<MenuManagement />} />
                <Route path="/admin/menus/:key/edit" element={<MenuItemForm />} />
                <Route path="/admin/themes" element={<Themes />} />
                <Route path="/admin/themes/new" element={<ThemeForm />} />
                <Route path="/admin/themes/:code/edit" element={<ThemeForm />} />
                <Route path="/admin/invoice-templates" element={<InvoiceTemplates />} />
                <Route path="/admin/payment-methods" element={<PaymentMethods />} />
                <Route path="/admin/payment-methods/new" element={<PaymentMethodForm />} />
                <Route path="/admin/payment-methods/:code/edit" element={<PaymentMethodForm />} />
                <Route path="/admin/payment-gateway" element={<PaymentGateway />} />
                <Route path="/admin/transactions" element={<Transactions />} />
                <Route path="/admin/approval-rules" element={<ApprovalRules />} />
                <Route path="/admin/approval-rules/new" element={<ApprovalRuleForm />} />
                <Route path="/admin/approval-rules/:code/edit" element={<ApprovalRuleForm />} />
                <Route path="/admin/notifications" element={<Notifications />} />
                <Route path="/admin/announcements/new" element={<AnnouncementForm />} />
                <Route path="/admin/announcements/:code/edit" element={<AnnouncementForm />} />
                <Route path="/admin/audit-log" element={<AuditLog />} />
                <Route path="/admin/demo-requests" element={<DemoRequests />} />
                <Route path="/admin/super-admins" element={<SuperAdmins />} />
                <Route path="/admin/super-admins/new" element={<SuperAdminForm />} />
                <Route path="/admin/super-admins/:id/edit" element={<SuperAdminForm />} />
                <Route path="/admin/sessions" element={<AdminSessions />} />
              </Route>
            </Route>

            {/* ---- Client application ---- */}
            <Route element={<ClientProviders />}>
            <Route path="/login" element={ON_ADMIN_HOST ? <Navigate to="/admin/login" replace /> : <Login />} />
            {/* Public by necessity: both are reached before anyone can sign in. */}
            <Route path="/set-password" element={<SetPassword />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            <Route
              path="/sales/invoices/:id/print"
              element={
                <ProtectedRoute>
                  <InvoicePrint />
                </ProtectedRoute>
              }
            />

            <Route
              path="/sales/enquiries/:id/print"
              element={
                <ProtectedRoute>
                  <EnquiryPrint />
                </ProtectedRoute>
              }
            />

            <Route
              path="/sales/quotations/:id/print"
              element={
                <ProtectedRoute>
                  <QuotationPrint />
                </ProtectedRoute>
              }
            />

            <Route
              path="/sales/delivery-challans/:id/print"
              element={
                <ProtectedRoute>
                  <DeliveryChallanPrint />
                </ProtectedRoute>
              }
            />

            <Route
              path="/purchase/orders/:id/print"
              element={
                <ProtectedRoute>
                  <PurchaseOrderPrint />
                </ProtectedRoute>
              }
            />

            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/more" element={<More />} />
              {/* Deliberately not nested under /settings/ and given no `module`
                  prop — a client must always be able to see what plan they're
                  on, even one restricted enough to hide the Settings menu
                  itself. See the matching PATH_RULES comment in
                  ProtectedRoute.jsx. */}
              <Route path="/reminders" element={<Reminders />} />
              <Route
                path="/ai/assistant"
                element={
                  <ProtectedRoute roles={["Administrator"]}>
                    <AiAssistant />
                  </ProtectedRoute>
                }
              />
              <Route path="/subscription" element={<Subscription />} />

              <Route path="/customers/groups" element={<CustomerGroups />} />
              <Route path="/customers/ledger" element={<CustomerLedger />} />
              <Route path="/customers/outstanding" element={<CustomerOutstanding />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/new" element={<AddCustomer />} />
              <Route path="/customers/:id/edit" element={<AddCustomer />} />
              <Route path="/customers/:id" element={<CustomerDetail />} />

              <Route path="/suppliers/groups" element={<SupplierGroups />} />
              <Route path="/suppliers/ledger" element={<SupplierLedger />} />
              <Route path="/suppliers/outstanding" element={<SupplierOutstanding />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/suppliers/new" element={<AddSupplier />} />
              <Route path="/suppliers/:id/edit" element={<AddSupplier />} />
              <Route path="/suppliers/:id" element={<SupplierDetail />} />

              <Route path="/products/categories/new" element={<CategoryForm />} />
              <Route path="/products/categories/:id/edit" element={<CategoryForm />} />
              <Route path="/products/categories" element={<Categories />} />
              <Route path="/products/brands/new" element={<BrandForm />} />
              <Route path="/products/brands/:id/edit" element={<BrandForm />} />
              <Route path="/products/brands" element={<Brands />} />
              <Route path="/products/items" element={<Items />} />
              <Route path="/products/items/:id/edit" element={<ItemForm />} />
              <Route path="/products/items/new" element={<ItemForm />} />

              <Route path="/purchase/orders" element={<PurchaseOrders />} />
              <Route path="/purchase/orders/new" element={<AddPurchaseOrder />} />
              <Route path="/purchase/orders/:id/edit" element={<AddPurchaseOrder />} />
              <Route path="/purchase/orders/:id" element={<PurchaseOrderDetail />} />
              <Route path="/purchase/goods-receipt" element={<GoodsReceipt />} />
              <Route path="/purchase/goods-receipt/new" element={<AddGoodsReceipt />} />
              <Route path="/purchase/goods-receipt/:id/edit" element={<AddGoodsReceipt />} />
              <Route path="/purchase/goods-receipt/:id" element={<GoodsReceiptDetail />} />
              <Route path="/purchase/invoices" element={<PurchaseInvoices />} />
              <Route path="/purchase/invoices/new" element={<AddPurchaseInvoice />} />
              <Route path="/purchase/invoices/:id/edit" element={<AddPurchaseInvoice />} />
              <Route path="/purchase/returns" element={<PurchaseReturns />} />
              <Route path="/purchase/returns/new" element={<AddPurchaseReturn />} />
              <Route path="/purchase/returns/:id/edit" element={<AddPurchaseReturn />} />

              <Route path="/inventory/stock-transfer" element={<StockTransfer />} />
              <Route path="/inventory/stock-adjustment" element={<StockAdjustment />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/inventory/item/:id" element={<StockDetail />} />
              <Route path="/inventory/stock-in" element={<ProtectedRoute roles={STOCK_MOVE_ROLES}><StockIn /></ProtectedRoute>} />
              <Route path="/inventory/stock-in/new" element={<ProtectedRoute roles={STOCK_MOVE_ROLES}><StockInForm /></ProtectedRoute>} />
              <Route path="/inventory/stock-in/:id/edit" element={<ProtectedRoute roles={STOCK_MOVE_ROLES}><StockInForm /></ProtectedRoute>} />
              <Route path="/inventory/stock-out" element={<ProtectedRoute roles={STOCK_MOVE_ROLES}><StockOut /></ProtectedRoute>} />
              <Route path="/inventory/stock-out/new" element={<ProtectedRoute roles={STOCK_MOVE_ROLES}><StockOutForm /></ProtectedRoute>} />
              <Route path="/inventory/stock-out/:id/edit" element={<ProtectedRoute roles={STOCK_MOVE_ROLES}><StockOutForm /></ProtectedRoute>} />

              <Route path="/manufacturing/boms" element={<Boms />} />
              <Route path="/manufacturing/boms/new" element={<BomForm />} />
              <Route path="/manufacturing/boms/:id/edit" element={<BomForm />} />
              <Route path="/manufacturing/work-orders" element={<WorkOrders />} />
              <Route path="/manufacturing/work-orders/new" element={<WorkOrderForm />} />
              <Route path="/manufacturing/work-orders/:id/edit" element={<WorkOrderForm />} />
              <Route path="/manufacturing/work-orders/:id" element={<WorkOrderDetail />} />
              <Route path="/manufacturing/job-cards/new" element={<JobCardForm />} />
              <Route path="/manufacturing/job-cards/:id/edit" element={<JobCardForm />} />
              <Route path="/manufacturing/job-cards" element={<JobCards />} />
              <Route path="/manufacturing/material-issues" element={<MaterialIssues />} />
              <Route path="/manufacturing/production-receipts" element={<ProductionReceipts />} />
              <Route path="/manufacturing/work-centers/new" element={<WorkCenterForm />} />
              <Route path="/manufacturing/work-centers/:id/edit" element={<WorkCenterForm />} />
              <Route path="/manufacturing/work-centers" element={<WorkCenters />} />
              <Route path="/manufacturing/machines/new" element={<MachineForm />} />
              <Route path="/manufacturing/machines/:id/edit" element={<MachineForm />} />
              <Route path="/manufacturing/machines" element={<Machines />} />

              <Route path="/sales/quotations" element={<Quotations />} />
              <Route path="/sales/quotations/new" element={<QuotationForm />} />
              <Route path="/sales/quotations/:id/edit" element={<QuotationForm />} />
              <Route path="/sales/quotations/:id" element={<QuotationDetail />} />
              <Route path="/maintenance/due" element={<ServiceDue />} />
              <Route path="/maintenance/history" element={<ServiceHistory />} />
              <Route path="/sales/enquiries" element={<Enquiries />} />
              <Route path="/sales/enquiries/new" element={<EnquiryForm />} />
              <Route path="/sales/enquiries/:id/edit" element={<EnquiryForm />} />
              <Route path="/sales/enquiries/:id" element={<EnquiryDetail />} />
              <Route path="/sales/orders" element={<SalesOrders />} />
              <Route path="/sales/orders/new" element={<SalesOrderForm />} />
              <Route path="/sales/orders/:id/edit" element={<SalesOrderForm />} />
              <Route path="/sales/orders/:id" element={<SalesOrderDetail />} />
              <Route path="/sales/delivery-challan" element={<DeliveryChallan />} />
              <Route path="/sales/delivery-challan/new" element={<DeliveryChallanForm />} />
              <Route path="/sales/delivery-challan/:id/edit" element={<DeliveryChallanForm />} />
              <Route path="/sales/delivery-challan/:id" element={<DeliveryChallanDetail />} />
              <Route path="/sales/invoices" element={<Invoices />} />
              <Route path="/sales/invoices/new" element={<InvoiceForm />} />
              <Route path="/sales/invoices/:id/edit" element={<InvoiceForm />} />
              <Route path="/sales/invoices/:id" element={<InvoiceDetail />} />
              <Route path="/sales/returns" element={<SalesReturn />} />
              <Route path="/sales/returns/new" element={<SalesReturnForm />} />
              <Route path="/sales/returns/:id/edit" element={<SalesReturnForm />} />


              <Route path="/reports/financial" element={<FinancialReports />} />
              <Route path="/reports/other" element={<OtherReports />} />
              <Route path="/reports/sales" element={<SalesReports />} />
              <Route path="/reports/purchase" element={<PurchaseReports />} />
              <Route path="/reports/inventory" element={<InventoryReports />} />

              <Route path="/users/new" element={<UserForm />} />
              <Route path="/users/:id/edit" element={<UserForm />} />
              <Route path="/users" element={<Users />} />
              <Route path="/users/roles" element={<RolesPermissions />} />
              <Route
                path="/users/audit-logs"
                element={
                  <ProtectedRoute roles={["Administrator"]}>
                    <AuditLogs />
                  </ProtectedRoute>
                }
              />
              {/* Old link kept working after the rename. */}
              <Route path="/users/activity-log" element={<Navigate to="/users/audit-logs" replace />} />

              <Route path="/settings" element={<SettingsTabs />} />
              <Route path="/settings/:tab" element={<SettingsTabs />} />
            </Route>

            <Route path="/" element={<Navigate to={ON_ADMIN_HOST ? "/admin" : "/dashboard"} replace />} />
            <Route path="*" element={<Navigate to={ON_ADMIN_HOST ? "/admin" : "/dashboard"} replace />} />
            </Route>
          </Routes>
        </Suspense>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
