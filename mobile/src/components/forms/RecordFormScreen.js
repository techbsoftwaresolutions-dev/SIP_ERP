import { useEffect, useState } from "react";
import api from "../../api/client";
import Screen from "../layout/Screen";
import { Card, ErrorBox, Loader, Note, SectionTitle, useFeedback } from "../ui";
import { AddRecordForm } from ".";
import { useGoBack, useParams } from "../../navigation/router";

// Standalone Add/Edit screen — port of frontend/src/components/forms/RecordFormPage.jsx.
// Edit mode when the route carries an :id. `fields` may be an array or a
// function of the loaded record (for forms whose fields depend on it).
export default function RecordFormScreen({
  entity,
  endpoint,
  fields,
  sectionTitle,
  transform,
  note,
  onSubmit, // optional override: (values, { isEdit, id, existing }) => Promise
  successMessage,
  initialValues: initialOverride,
  loading: externalLoading,
}) {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const goBack = useGoBack();
  const { toast } = useFeedback();
  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!isEdit) return undefined;
    let cancelled = false;
    api
      .get(`${endpoint}/${encodeURIComponent(id)}`)
      .then((r) => !cancelled && setExisting(r))
      .catch((err) => !cancelled && setLoadError(err.message || `Could not load this ${entity.toLowerCase()}.`))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, isEdit, endpoint, entity]);

  const title = isEdit ? `Edit ${entity}` : `Add ${entity}`;

  const handleSubmit = async (values) => {
    const payload = transform ? transform(values, { isEdit, existing }) : values;
    if (onSubmit) {
      // Returning "handled" means the caller already navigated/toasted.
      if ((await onSubmit(payload, { isEdit, id, existing })) === "handled") return;
    } else if (isEdit) {
      await api.put(`${endpoint}/${encodeURIComponent(id)}`, payload);
    } else {
      await api.post(endpoint, payload);
    }
    toast(successMessage || `${entity} ${isEdit ? "updated" : "added"}.`);
    goBack();
  };

  if (loading || externalLoading) {
    return (
      <Screen title={title}>
        <Loader />
      </Screen>
    );
  }
  if (loadError) {
    return (
      <Screen title={title}>
        <ErrorBox message={loadError} />
      </Screen>
    );
  }

  const resolvedFields = typeof fields === "function" ? fields(existing) : fields;
  const initialValues = isEdit ? existing || undefined : initialOverride;

  return (
    <Screen title={isEdit ? `${title} ${id}` : title}>
      <Card>
        <SectionTitle>{sectionTitle || `${entity} Details`}</SectionTitle>
        {note ? <Note>{note}</Note> : null}
        <AddRecordForm
          fields={resolvedFields}
          initialValues={initialValues}
          onSubmit={handleSubmit}
          onCancel={goBack}
          submitLabel={isEdit ? "Save Changes" : `Add ${entity}`}
        />
      </Card>
    </Screen>
  );
}
