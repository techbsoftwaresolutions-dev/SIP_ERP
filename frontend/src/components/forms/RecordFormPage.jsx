import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../layout/PageHeader";
import AddRecordForm from "./AddRecordForm";
import Loader from "../ui/Loader";

// Standalone Add/Edit screen — the page equivalent of the modal SimpleListPage
// used to open. One component serves both modes: which one depends only on
// whether the route carries an `:id`, so the two can never drift apart (the
// same trick ItemForm and WorkOrderForm already use).
//
// Lookup-driven `fields` are built by the calling page and passed in, so this
// stays presentational plus the load/save plumbing.
export default function RecordFormPage({
  entity, // "Work Center" — drives the title, submit label and toast
  endpoint, // "/api/manufacturing/work-centers"
  listPath, // where Cancel and a successful save return to
  crumbs, // breadcrumb trail WITHOUT the trailing Add/Edit crumb
  fields,
  sectionTitle,
  // Optional last-pass over the submitted values (e.g. dropping a field the
  // API doesn't accept). Receives and returns the values object.
  transform,
  // Optional last-pass over a loaded record before it becomes the form's
  // initialValues — the inverse of `transform`, for a field that isn't
  // stored flat (e.g. unpacking Item.customFields into cf_* form keys).
  loadTransform,
  // Optional note rendered above the form.
  note,
}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    api
      .get(`${endpoint}/${encodeURIComponent(id)}`)
      .then((r) => {
        if (!cancelled) setExisting(r);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || `Could not load this ${entity.toLowerCase()}.`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, isEdit, endpoint, entity]);

  const title = isEdit ? `Edit ${entity}` : `Add ${entity}`;
  const fullCrumbs = [...crumbs, isEdit ? "Edit" : `Add ${entity}`];

  const handleSubmit = async (values) => {
    const payload = transform ? transform(values) : values;
    if (isEdit) {
      await api.put(`${endpoint}/${encodeURIComponent(id)}`, payload);
      navigate(listPath, { state: { toast: `${entity} updated.` } });
    } else {
      await api.post(endpoint, payload);
      navigate(listPath, { state: { toast: `${entity} added.` } });
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title={title} crumbs={fullCrumbs} />
        <div className="loading-row" style={{ padding: 48, textAlign: "center" }}>
          <Loader />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <PageHeader title={title} crumbs={fullCrumbs} />
        <div className="list-card add-page-card">
          <div className="login-error">{loadError}</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={isEdit ? `${title} ${id}` : title} crumbs={fullCrumbs} />
      <div className="list-card add-page-card">
        <div className="section-title">{sectionTitle || `${entity} Details`}</div>
        {note && (
          <p className="muted" style={{ marginTop: 0 }}>
            {note}
          </p>
        )}
        <AddRecordForm
          fields={fields}
          initialValues={existing ? (loadTransform ? loadTransform(existing) : existing) : undefined}
          onSubmit={handleSubmit}
          onCancel={() => navigate(listPath)}
          submitLabel={isEdit ? "Save Changes" : `Add ${entity}`}
        />
      </div>
    </div>
  );
}
