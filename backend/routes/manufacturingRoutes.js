// ---------- Manufacturing ----------
// BOMs, work orders, job cards, work centers, machines, and the two documents
// that actually move stock: material issue (raw material out of the store onto
// a work order) and production receipt (finished goods back into the store).
//
// Registered from server.js AFTER the tenant middleware, so every model access
// below is already scoped to the calling tenant's database via the proxies in
// models/tenantProxy.js — exactly like the route sections that live inline in
// server.js. This is a separate file only because it is large enough to be
// worth its own; it is not a different kind of route.
const {
  Bom,
  WorkCenter,
  Machine,
  WorkOrder,
  JobCard,
  MaterialIssue,
  ProductionReceipt,
  Item,
} = require("../models/tenantProxy");

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// A plain {} object, not an array/null/string — used to validate a submitted
// `customFields` map before it's trusted and saved as-is (mirrors the same
// helper in server.js).
function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

// ---- BOM costing ----------------------------------------------------------

// Component quantities are stated per BOM batch (`outputQty`), so the usable
// quantity of each line already includes its own wastage allowance.
function componentQtyWithWastage(row) {
  const qty = Number(row.qty) || 0;
  const wastage = Number(row.wastagePercent) || 0;
  return round2(qty * (1 + wastage / 100));
}

function normaliseComponents(rawRows) {
  return (Array.isArray(rawRows) ? rawRows : [])
    .filter((r) => r && r.item)
    .map((r) => {
      const qty = Number(r.qty) || 0;
      const rate = Number(r.rate) || 0;
      return {
        item: r.item,
        itemCode: r.itemCode || "",
        qty,
        unit: r.unit || "Nos",
        wastagePercent: Number(r.wastagePercent) || 0,
        rate,
        // Costed on the wastage-inclusive quantity — the scrap is really
        // consumed, so pricing the net quantity would understate the BOM.
        amount: round2(componentQtyWithWastage({ qty, wastagePercent: r.wastagePercent }) * rate),
        notes: r.notes || "",
      };
    });
}

function normaliseOperations(rawRows) {
  return (Array.isArray(rawRows) ? rawRows : [])
    .filter((r) => r && r.operation)
    .map((r, i) => {
      const hours = Number(r.hours) || 0;
      const costPerHour = Number(r.costPerHour) || 0;
      return {
        operation: r.operation,
        workCenter: r.workCenter || "",
        machine: r.machine || "",
        hours,
        costPerHour,
        amount: round2(hours * costPerHour),
        sequence: Number(r.sequence) || i + 1,
      };
    });
}

function costBom(components, operations, overheadCost) {
  const materialCost = round2(components.reduce((a, c) => a + c.amount, 0));
  const operationCost = round2(operations.reduce((a, o) => a + o.amount, 0));
  const overhead = round2(overheadCost);
  return {
    materialCost,
    operationCost,
    overheadCost: overhead,
    totalCost: round2(materialCost + operationCost + overhead),
  };
}

// ---- Work order explosion -------------------------------------------------

// Scales a BOM's components to `plannedQty` finished units. A BOM that yields
// 10 per batch, asked for 25, multiplies every component by 2.5.
function explodeBom(bomDoc, plannedQty) {
  const batch = Number(bomDoc.outputQty) || 1;
  const factor = (Number(plannedQty) || 0) / batch;
  return (bomDoc.components || []).map((c) => {
    const requiredQty = round2(componentQtyWithWastage(c) * factor);
    const rate = Number(c.rate) || 0;
    return {
      item: c.item,
      itemCode: c.itemCode || "",
      requiredQty,
      issuedQty: 0,
      unit: c.unit || "Nos",
      rate,
      amount: round2(requiredQty * rate),
    };
  });
}

function normaliseRequirements(rawRows) {
  return (Array.isArray(rawRows) ? rawRows : [])
    .filter((r) => r && r.item)
    .map((r) => {
      const requiredQty = Number(r.requiredQty) || 0;
      const rate = Number(r.rate) || 0;
      return {
        item: r.item,
        itemCode: r.itemCode || "",
        requiredQty,
        issuedQty: Number(r.issuedQty) || 0,
        unit: r.unit || "Nos",
        rate,
        amount: round2(requiredQty * rate),
      };
    });
}

// ---- Stock movement -------------------------------------------------------

// Stock lives on Item.qty, keyed by item NAME + warehouse — that is what the
// inventory overview aggregates (see GET /api/inventory in server.js). These
// two helpers are the only places manufacturing touches it.
//
// An item may exist in several warehouses; `$inc` is applied to the row for
// the named warehouse, falling back to the item's single row when the
// warehouse does not match any. Returns the list of lines it could not find,
// so the caller can report them instead of silently losing the movement.
async function adjustItemStock(lines, warehouse, sign) {
  const missing = [];
  for (const line of lines) {
    const delta = sign * (Number(line.qty) || 0);
    if (!delta) continue;
    let res = await Item.updateOne({ name: line.item, warehouse }, { $inc: { qty: delta } });
    if (!res.matchedCount) {
      res = await Item.updateOne({ name: line.item }, { $inc: { qty: delta } });
    }
    if (!res.matchedCount) missing.push(line.item);
  }
  return missing;
}

// ---------------------------------------------------------------------------

function registerManufacturingRoutes(app, deps) {
  const { asyncHandler, paginate, nextSeqAndNumber, addCrudRoutes, todayLabel, audit } = deps;

  // Shared list + single-record reads for the simple master records.
  const simpleList = (path, Model, filterFrom) => {
    app.get(
      path,
      asyncHandler(async (req, res) => res.json(await paginate(Model, filterFrom ? filterFrom(req.query) : {}, req)))
    );
    app.get(
      `${path}/:id`,
      asyncHandler(async (req, res) => {
        const doc = await Model.findOne({ id: req.params.id });
        if (!doc) return res.status(404).json({ message: "Record not found." });
        res.json(doc);
      })
    );
  };

  // ---------- Work Centers ----------
  simpleList("/api/manufacturing/work-centers", WorkCenter, (q) => {
    const filter = {};
    if (q.status && q.status !== "all") filter.status = q.status;
    return filter;
  });

  app.post(
    "/api/manufacturing/work-centers",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      if (!body.name) return res.status(400).json({ message: "Work center name is required." });
      const { seq, number } = await nextSeqAndNumber(WorkCenter);
      const created = await WorkCenter.create({
        id: `WC-${String(number).padStart(4, "0")}`,
        seq,
        name: body.name,
        code: body.code || "",
        description: body.description || "",
        location: body.location || "",
        supervisor: body.supervisor || "",
        capacityPerDay: Number(body.capacityPerDay) || 0,
        unit: body.unit || "Nos",
        workingHoursPerDay: Number(body.workingHoursPerDay) || 8,
        costPerHour: Number(body.costPerHour) || 0,
        status: body.status || "Active",
        customFields: isPlainObject(body.customFields) ? body.customFields : {},
      });
      res.status(201).json(created);
    })
  );
  addCrudRoutes("/api/manufacturing/work-centers", WorkCenter);

  // ---------- Machines ----------
  simpleList("/api/manufacturing/machines", Machine, (q) => {
    const filter = {};
    if (q.workCenter && q.workCenter !== "all") filter.workCenter = q.workCenter;
    if (q.status && q.status !== "all") filter.status = q.status;
    return filter;
  });

  app.post(
    "/api/manufacturing/machines",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      if (!body.name) return res.status(400).json({ message: "Machine name is required." });
      const { seq, number } = await nextSeqAndNumber(Machine);
      const created = await Machine.create({
        id: `MC-${String(number).padStart(4, "0")}`,
        seq,
        name: body.name,
        code: body.code || "",
        workCenter: body.workCenter || "",
        machineType: body.machineType || "",
        manufacturer: body.manufacturer || "",
        serialNo: body.serialNo || "",
        installedOn: body.installedOn || "",
        capacityPerHour: Number(body.capacityPerHour) || 0,
        unit: body.unit || "Nos",
        status: body.status || "Idle",
        lastServiceDate: body.lastServiceDate || "",
        nextServiceDate: body.nextServiceDate || "",
        notes: body.notes || "",
        customFields: isPlainObject(body.customFields) ? body.customFields : {},
      });
      res.status(201).json(created);
    })
  );
  addCrudRoutes("/api/manufacturing/machines", Machine);

  // ---------- Bill of Materials ----------
  simpleList("/api/manufacturing/boms", Bom, (q) => {
    const filter = {};
    if (q.product && q.product !== "all") filter.product = q.product;
    if (q.status && q.status !== "all") filter.status = q.status;
    return filter;
  });

  app.post(
    "/api/manufacturing/boms",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      if (!body.product) return res.status(400).json({ message: "Finished product is required." });
      const components = normaliseComponents(body.components);
      if (components.length === 0) {
        return res.status(400).json({ message: "A BOM needs at least one component." });
      }
      const operations = normaliseOperations(body.operations);
      const { seq, number } = await nextSeqAndNumber(Bom);
      const created = await Bom.create({
        id: `BOM-${String(number).padStart(4, "0")}`,
        seq,
        product: body.product,
        productCode: body.productCode || "",
        version: body.version || "1.0",
        outputQty: Number(body.outputQty) || 1,
        unit: body.unit || "Nos",
        components,
        operations,
        ...costBom(components, operations, body.overheadCost),
        status: body.status || "Draft",
        effectiveFrom: body.effectiveFrom || todayLabel(),
        notes: body.notes || "",
        customFields: isPlainObject(body.customFields) ? body.customFields : {},
      });
      res.status(201).json(created);
    })
  );

  app.put(
    "/api/manufacturing/boms/:id",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const before = await Bom.findOne({ id: req.params.id });
      if (!before) return res.status(404).json({ message: "Record not found." });
      const components = normaliseComponents(body.components);
      if (components.length === 0) {
        return res.status(400).json({ message: "A BOM needs at least one component." });
      }
      const operations = normaliseOperations(body.operations);
      const updated = await Bom.findOneAndUpdate(
        { id: req.params.id },
        {
          $set: {
            product: body.product || before.product,
            productCode: body.productCode || "",
            version: body.version || before.version,
            outputQty: Number(body.outputQty) || 1,
            unit: body.unit || "Nos",
            components,
            operations,
            ...costBom(components, operations, body.overheadCost),
            status: body.status || before.status,
            effectiveFrom: body.effectiveFrom || before.effectiveFrom,
            notes: body.notes || "",
            customFields: isPlainObject(body.customFields) ? body.customFields : before.customFields,
          },
        },
        { new: true }
      );
      res.json(updated);
      audit(req, {
        action: "Update",
        module: "Manufacturing",
        entityType: "Bom",
        entityId: req.params.id,
        description: `Updated BOM ${req.params.id}`,
        before,
        after: updated,
      });
    })
  );

  app.delete(
    "/api/manufacturing/boms/:id",
    asyncHandler(async (req, res) => {
      // A BOM that a work order was exploded from is part of that order's
      // cost history — refuse rather than leave the order pointing at nothing.
      const inUse = await WorkOrder.exists({ bom: req.params.id });
      if (inUse) {
        return res.status(409).json({
          message: "This BOM is used by at least one work order. Mark it Obsolete instead of deleting it.",
        });
      }
      const deleted = await Bom.findOneAndDelete({ id: req.params.id });
      if (!deleted) return res.status(404).json({ message: "Record not found." });
      res.json({ success: true });
      audit(req, {
        action: "Delete",
        module: "Manufacturing",
        entityType: "Bom",
        entityId: req.params.id,
        description: `Deleted BOM ${req.params.id}`,
        before: deleted,
      });
    })
  );

  // ---------- Work Orders ----------
  app.get(
    "/api/manufacturing/work-orders/stats",
    asyncHandler(async (_req, res) => {
      const [draft, released, inProgress, completed] = await Promise.all([
        WorkOrder.countDocuments({ status: "Draft" }),
        WorkOrder.countDocuments({ status: "Released" }),
        WorkOrder.countDocuments({ status: "In Progress" }),
        WorkOrder.countDocuments({ status: "Completed" }),
      ]);
      res.json({ draft, released, inProgress, completed, open: draft + released + inProgress });
    })
  );

  simpleList("/api/manufacturing/work-orders", WorkOrder, (q) => {
    const filter = {};
    if (q.status && q.status !== "all") filter.status = q.status;
    if (q.product && q.product !== "all") filter.product = q.product;
    if (q.workCenter && q.workCenter !== "all") filter.workCenter = q.workCenter;
    return filter;
  });

  app.post(
    "/api/manufacturing/work-orders",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      if (!body.product) return res.status(400).json({ message: "Product is required." });
      const plannedQty = Number(body.plannedQty) || 0;
      if (plannedQty <= 0) return res.status(400).json({ message: "Planned quantity must be greater than zero." });

      // Requirements come from the chosen BOM when there is one, and from the
      // request body otherwise (rework / trial orders have no BOM).
      let requirements = normaliseRequirements(body.requirements);
      let operationCost = Number(body.operationCost) || 0;
      let bomDoc = null;
      if (body.bom) {
        bomDoc = await Bom.findOne({ id: body.bom }).lean();
        if (!bomDoc) return res.status(400).json({ message: `BOM ${body.bom} not found.` });
        requirements = explodeBom(bomDoc, plannedQty);
        const factor = plannedQty / (Number(bomDoc.outputQty) || 1);
        operationCost = round2((Number(bomDoc.operationCost) || 0) * factor);
      }

      const materialCost = round2(requirements.reduce((a, r) => a + r.amount, 0));
      const { seq, number } = await nextSeqAndNumber(WorkOrder);
      const created = await WorkOrder.create({
        id: `WO-${String(number).padStart(4, "0")}`,
        seq,
        bom: body.bom || "",
        product: body.product,
        productCode: body.productCode || (bomDoc && bomDoc.productCode) || "",
        plannedQty,
        producedQty: 0,
        rejectedQty: 0,
        unit: body.unit || (bomDoc && bomDoc.unit) || "Nos",
        warehouse: body.warehouse || "Main Warehouse",
        workCenter: body.workCenter || "",
        machine: body.machine || "",
        salesOrder: body.salesOrder || "",
        customer: body.customer || "",
        startDate: body.startDate || todayLabel(),
        dueDate: body.dueDate || "",
        completedDate: "",
        priority: body.priority || "Normal",
        status: body.status || "Draft",
        requirements,
        materialCost,
        operationCost,
        totalCost: round2(materialCost + operationCost),
        notes: body.notes || "",
        customFields: isPlainObject(body.customFields) ? body.customFields : {},
      });
      res.status(201).json(created);
    })
  );

  app.put(
    "/api/manufacturing/work-orders/:id",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const before = await WorkOrder.findOne({ id: req.params.id });
      if (!before) return res.status(404).json({ message: "Record not found." });

      const plannedQty = Number(body.plannedQty) || before.plannedQty;
      // Requirements are re-exploded only while the order is still a Draft.
      // Once it is Released, material may already have been issued against
      // the frozen list and rewriting it would orphan those issues.
      let requirements = before.requirements;
      let materialCost = before.materialCost;
      if (before.status === "Draft" && body.bom) {
        const bomDoc = await Bom.findOne({ id: body.bom }).lean();
        if (!bomDoc) return res.status(400).json({ message: `BOM ${body.bom} not found.` });
        requirements = explodeBom(bomDoc, plannedQty);
        materialCost = round2(requirements.reduce((a, r) => a + r.amount, 0));
      }

      const status = body.status || before.status;
      const operationCost = body.operationCost != null ? Number(body.operationCost) || 0 : before.operationCost;
      const updated = await WorkOrder.findOneAndUpdate(
        { id: req.params.id },
        {
          $set: {
            bom: body.bom != null ? body.bom : before.bom,
            product: body.product || before.product,
            plannedQty,
            unit: body.unit || before.unit,
            warehouse: body.warehouse || before.warehouse,
            workCenter: body.workCenter != null ? body.workCenter : before.workCenter,
            machine: body.machine != null ? body.machine : before.machine,
            salesOrder: body.salesOrder != null ? body.salesOrder : before.salesOrder,
            customer: body.customer != null ? body.customer : before.customer,
            startDate: body.startDate || before.startDate,
            dueDate: body.dueDate != null ? body.dueDate : before.dueDate,
            priority: body.priority || before.priority,
            status,
            // Stamped the first time the order reaches Completed, and kept
            // afterwards so reopening and re-completing doesn't lose the date.
            completedDate:
              status === "Completed" ? before.completedDate || todayLabel() : before.completedDate,
            requirements,
            materialCost,
            operationCost,
            totalCost: round2(materialCost + operationCost),
            notes: body.notes != null ? body.notes : before.notes,
            customFields: isPlainObject(body.customFields) ? body.customFields : before.customFields,
          },
        },
        { new: true }
      );
      res.json(updated);
      audit(req, {
        action: "Update",
        module: "Manufacturing",
        entityType: "WorkOrder",
        entityId: req.params.id,
        description: `Updated work order ${req.params.id}`,
        before,
        after: updated,
      });
    })
  );

  app.delete(
    "/api/manufacturing/work-orders/:id",
    asyncHandler(async (req, res) => {
      // Deleting an order that has any movement document against it would
      // leave those rows behind with nothing to explain them — and because
      // document numbers are allocated from the highest seq in the
      // collection, deleting the newest order frees its number for the next
      // one, which would then inherit the orphans. Cancelled documents count:
      // a cancellation is still a record of what happened.
      const [issued, received] = await Promise.all([
        MaterialIssue.exists({ workOrder: req.params.id }),
        ProductionReceipt.exists({ workOrder: req.params.id }),
      ]);
      if (issued || received) {
        return res.status(409).json({
          message:
            "This work order has material issues or production receipts against it. Cancel the order instead of deleting it.",
        });
      }
      const deleted = await WorkOrder.findOneAndDelete({ id: req.params.id });
      if (!deleted) return res.status(404).json({ message: "Record not found." });
      await JobCard.deleteMany({ workOrder: req.params.id });
      res.json({ success: true });
      audit(req, {
        action: "Delete",
        module: "Manufacturing",
        entityType: "WorkOrder",
        entityId: req.params.id,
        description: `Deleted work order ${req.params.id}`,
        before: deleted,
      });
    })
  );

  // Generates one job card per routing step of the order's BOM. Idempotent:
  // refuses rather than duplicating when cards already exist.
  app.post(
    "/api/manufacturing/work-orders/:id/job-cards",
    asyncHandler(async (req, res) => {
      const order = await WorkOrder.findOne({ id: req.params.id }).lean();
      if (!order) return res.status(404).json({ message: "Work order not found." });
      if (await JobCard.exists({ workOrder: order.id })) {
        return res.status(409).json({ message: "Job cards have already been generated for this work order." });
      }
      if (!order.bom) {
        return res.status(400).json({ message: "This work order has no BOM, so it has no routing to generate from." });
      }
      const bomDoc = await Bom.findOne({ id: order.bom }).lean();
      const operations = (bomDoc && bomDoc.operations) || [];
      if (operations.length === 0) {
        return res.status(400).json({ message: "That BOM has no operations defined, so there is nothing to generate." });
      }

      const sorted = [...operations].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
      const created = [];
      for (const op of sorted) {
        const { seq, number } = await nextSeqAndNumber(JobCard);
        created.push(
          await JobCard.create({
            id: `JC-${String(number).padStart(4, "0")}`,
            seq,
            workOrder: order.id,
            product: order.product,
            operation: op.operation,
            sequence: op.sequence || 0,
            workCenter: op.workCenter || order.workCenter || "",
            machine: op.machine || order.machine || "",
            plannedQty: order.plannedQty,
            unit: order.unit,
            date: todayLabel(),
            status: "Pending",
          })
        );
      }
      res.status(201).json({ created: created.length, jobCards: created });
      audit(req, {
        action: "Create",
        module: "Manufacturing",
        entityType: "JobCard",
        entityId: order.id,
        description: `Generated ${created.length} job card(s) for work order ${order.id}`,
      });
    })
  );

  // ---------- Job Cards ----------
  simpleList("/api/manufacturing/job-cards", JobCard, (q) => {
    const filter = {};
    if (q.workOrder && q.workOrder !== "all") filter.workOrder = q.workOrder;
    if (q.status && q.status !== "all") filter.status = q.status;
    if (q.workCenter && q.workCenter !== "all") filter.workCenter = q.workCenter;
    return filter;
  });

  app.post(
    "/api/manufacturing/job-cards",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      if (!body.workOrder) return res.status(400).json({ message: "Work order is required." });
      if (!body.operation) return res.status(400).json({ message: "Operation is required." });
      const order = await WorkOrder.findOne({ id: body.workOrder }).lean();
      if (!order) return res.status(400).json({ message: `Work order ${body.workOrder} not found.` });

      const { seq, number } = await nextSeqAndNumber(JobCard);
      const created = await JobCard.create({
        id: `JC-${String(number).padStart(4, "0")}`,
        seq,
        workOrder: body.workOrder,
        product: body.product || order.product,
        operation: body.operation,
        sequence: Number(body.sequence) || 0,
        workCenter: body.workCenter || order.workCenter || "",
        machine: body.machine || order.machine || "",
        operator: body.operator || "",
        shift: body.shift || "",
        plannedQty: Number(body.plannedQty) || order.plannedQty,
        completedQty: Number(body.completedQty) || 0,
        rejectedQty: Number(body.rejectedQty) || 0,
        unit: body.unit || order.unit || "Nos",
        startTime: body.startTime || "",
        endTime: body.endTime || "",
        hours: Number(body.hours) || 0,
        date: body.date || todayLabel(),
        status: body.status || "Pending",
        remarks: body.remarks || "",
        customFields: isPlainObject(body.customFields) ? body.customFields : {},
      });
      res.status(201).json(created);
    })
  );
  addCrudRoutes("/api/manufacturing/job-cards", JobCard);

  // ---------- Material Issue ----------
  simpleList("/api/manufacturing/material-issues", MaterialIssue, (q) => {
    const filter = {};
    if (q.workOrder && q.workOrder !== "all") filter.workOrder = q.workOrder;
    if (q.status && q.status !== "all") filter.status = q.status;
    return filter;
  });

  app.post(
    "/api/manufacturing/material-issues",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      if (!body.workOrder) return res.status(400).json({ message: "Work order is required." });
      const order = await WorkOrder.findOne({ id: body.workOrder });
      if (!order) return res.status(400).json({ message: `Work order ${body.workOrder} not found.` });
      if (order.status === "Draft") {
        return res.status(400).json({ message: "Release the work order before issuing material to it." });
      }
      if (order.status === "Cancelled") {
        return res.status(400).json({ message: "This work order is cancelled." });
      }

      const items = (Array.isArray(body.items) ? body.items : [])
        .filter((r) => r && r.item && Number(r.qty) > 0)
        .map((r) => {
          const qty = Number(r.qty) || 0;
          const rate = Number(r.rate) || 0;
          return {
            item: r.item,
            itemCode: r.itemCode || "",
            qty,
            unit: r.unit || "Nos",
            rate,
            amount: round2(qty * rate),
            batchNo: r.batchNo || "",
          };
        });
      if (items.length === 0) {
        return res.status(400).json({ message: "Add at least one material line with a quantity." });
      }

      const warehouse = body.warehouse || order.warehouse || "Main Warehouse";
      const missing = await adjustItemStock(items, warehouse, -1);
      if (missing.length) {
        // Put back whatever did move, so a partially-applied issue never
        // leaves stock wrong — then tell the caller which items are unknown.
        await adjustItemStock(
          items.filter((i) => !missing.includes(i.item)),
          warehouse,
          1
        );
        return res.status(400).json({
          message: `Not in the item catalog: ${missing.join(", ")}. Add them under Products > Items first.`,
        });
      }

      const { seq, number } = await nextSeqAndNumber(MaterialIssue);
      const created = await MaterialIssue.create({
        id: `MI-${String(number).padStart(4, "0")}`,
        seq,
        workOrder: order.id,
        product: order.product,
        issueDate: body.issueDate || todayLabel(),
        warehouse,
        issuedBy: body.issuedBy || "",
        receivedBy: body.receivedBy || "",
        items,
        totalQty: round2(items.reduce((a, i) => a + i.qty, 0)),
        totalValue: round2(items.reduce((a, i) => a + i.amount, 0)),
        status: "Issued",
        notes: body.notes || "",
      });

      // Roll the issued quantities onto the order's requirement lines so the
      // work order screen can show issued-vs-required without re-querying
      // every issue document.
      const byItem = new Map(items.map((i) => [i.item, i.qty]));
      order.requirements.forEach((r) => {
        const extra = byItem.get(r.item);
        if (extra) r.issuedQty = round2((Number(r.issuedQty) || 0) + extra);
      });
      if (order.status === "Released") order.status = "In Progress";
      await order.save();

      res.status(201).json(created);
      audit(req, {
        action: "Create",
        module: "Manufacturing",
        entityType: "MaterialIssue",
        entityId: created.id,
        description: `Issued ${items.length} material line(s) to work order ${order.id}`,
        after: created,
      });
    })
  );

  // Cancelling an issue returns its material to stock and rewinds the work
  // order's issued quantities. There is no edit: a posted stock movement is
  // corrected by cancelling and re-issuing, not by rewriting history.
  app.post(
    "/api/manufacturing/material-issues/:id/cancel",
    asyncHandler(async (req, res) => {
      const issue = await MaterialIssue.findOne({ id: req.params.id });
      if (!issue) return res.status(404).json({ message: "Record not found." });
      if (issue.status === "Cancelled") {
        return res.status(400).json({ message: "This issue is already cancelled." });
      }

      await adjustItemStock(issue.items, issue.warehouse, 1);
      issue.status = "Cancelled";
      await issue.save();

      const order = await WorkOrder.findOne({ id: issue.workOrder });
      if (order) {
        const byItem = new Map(issue.items.map((i) => [i.item, i.qty]));
        order.requirements.forEach((r) => {
          const back = byItem.get(r.item);
          if (back) r.issuedQty = Math.max(0, round2((Number(r.issuedQty) || 0) - back));
        });
        await order.save();
      }

      res.json(issue);
      audit(req, {
        action: "Update",
        module: "Manufacturing",
        entityType: "MaterialIssue",
        entityId: issue.id,
        description: `Cancelled material issue ${issue.id} and returned its stock`,
      });
    })
  );

  // ---------- Production Receipt ----------
  simpleList("/api/manufacturing/production-receipts", ProductionReceipt, (q) => {
    const filter = {};
    if (q.workOrder && q.workOrder !== "all") filter.workOrder = q.workOrder;
    if (q.product && q.product !== "all") filter.product = q.product;
    if (q.status && q.status !== "all") filter.status = q.status;
    return filter;
  });

  app.post(
    "/api/manufacturing/production-receipts",
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      if (!body.workOrder) return res.status(400).json({ message: "Work order is required." });
      const order = await WorkOrder.findOne({ id: body.workOrder });
      if (!order) return res.status(400).json({ message: `Work order ${body.workOrder} not found.` });
      if (order.status === "Draft") {
        return res.status(400).json({ message: "Release the work order before booking production against it." });
      }
      if (order.status === "Cancelled") {
        return res.status(400).json({ message: "This work order is cancelled." });
      }

      const acceptedQty = Number(body.acceptedQty) || 0;
      const rejectedQty = Number(body.rejectedQty) || 0;
      if (acceptedQty <= 0 && rejectedQty <= 0) {
        return res.status(400).json({ message: "Enter an accepted or rejected quantity." });
      }

      const warehouse = body.warehouse || order.warehouse || "Main Warehouse";
      if (acceptedQty > 0) {
        // Only accepted output reaches stock; rejects are recorded for yield.
        const missing = await adjustItemStock([{ item: order.product, qty: acceptedQty }], warehouse, 1);
        if (missing.length) {
          return res.status(400).json({
            message: `"${order.product}" is not in the item catalog. Add it under Products > Items first.`,
          });
        }
      }

      const { seq, number } = await nextSeqAndNumber(ProductionReceipt);
      const created = await ProductionReceipt.create({
        id: `FG-${String(number).padStart(4, "0")}`,
        seq,
        workOrder: order.id,
        product: order.product,
        productCode: order.productCode || "",
        receiptDate: body.receiptDate || todayLabel(),
        warehouse,
        acceptedQty,
        rejectedQty,
        unit: body.unit || order.unit || "Nos",
        batchNo: body.batchNo || "",
        receivedBy: body.receivedBy || "",
        inspectedBy: body.inspectedBy || "",
        rejectionReason: body.rejectionReason || "",
        status: "Accepted",
        notes: body.notes || "",
      });

      order.producedQty = round2((Number(order.producedQty) || 0) + acceptedQty);
      order.rejectedQty = round2((Number(order.rejectedQty) || 0) + rejectedQty);
      if (order.status === "Released") order.status = "In Progress";
      // Closes itself once the planned quantity is met — the order can still
      // be reopened by hand from the work order form.
      if (order.producedQty >= order.plannedQty && order.plannedQty > 0) {
        order.status = "Completed";
        order.completedDate = order.completedDate || todayLabel();
      }
      await order.save();

      res.status(201).json(created);
      audit(req, {
        action: "Create",
        module: "Manufacturing",
        entityType: "ProductionReceipt",
        entityId: created.id,
        description: `Booked ${acceptedQty} ${created.unit} of ${order.product} from work order ${order.id}`,
        after: created,
      });
    })
  );

  app.post(
    "/api/manufacturing/production-receipts/:id/cancel",
    asyncHandler(async (req, res) => {
      const receipt = await ProductionReceipt.findOne({ id: req.params.id });
      if (!receipt) return res.status(404).json({ message: "Record not found." });
      if (receipt.status === "Cancelled") {
        return res.status(400).json({ message: "This receipt is already cancelled." });
      }

      if (receipt.acceptedQty > 0) {
        await adjustItemStock([{ item: receipt.product, qty: receipt.acceptedQty }], receipt.warehouse, -1);
      }
      receipt.status = "Cancelled";
      await receipt.save();

      const order = await WorkOrder.findOne({ id: receipt.workOrder });
      if (order) {
        order.producedQty = Math.max(0, round2((Number(order.producedQty) || 0) - receipt.acceptedQty));
        order.rejectedQty = Math.max(0, round2((Number(order.rejectedQty) || 0) - receipt.rejectedQty));
        if (order.status === "Completed" && order.producedQty < order.plannedQty) {
          order.status = "In Progress";
          order.completedDate = "";
        }
        await order.save();
      }

      res.json(receipt);
      audit(req, {
        action: "Update",
        module: "Manufacturing",
        entityType: "ProductionReceipt",
        entityId: receipt.id,
        description: `Cancelled production receipt ${receipt.id} and reversed its stock`,
      });
    })
  );
}

module.exports = { registerManufacturingRoutes };
