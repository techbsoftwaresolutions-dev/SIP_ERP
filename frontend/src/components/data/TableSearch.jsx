import Icon from "../ui/Icon";

// Search box that sits above a table (same look as the list pages' toolbar).
// The page passes the text to the API as ?search=, so it matches across every
// record — not just the rows currently on screen. A clear (×) button appears
// inside the field, on the right, only while there is text.
// `children` (optional) are controls shown on the right of the search box, e.g. a
// Filter button and a date dropdown.
export default function TableSearch({ value, onChange, placeholder = "Search…", children }) {
  return (
    <div className="table-toolbar">
      <div className="table-search">
        <Icon name="search" size={16} />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
        />
        {value && (
          <button type="button" className="table-search-clear" onClick={() => onChange("")} aria-label="Clear search" title="Clear search">
            <Icon name="close" size={14} />
          </button>
        )}
      </div>
      {children ? <div className="table-toolbar-right">{children}</div> : null}
    </div>
  );
}
