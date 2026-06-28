import './ListControls.css';

export interface ListFilter {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}

// Reusable search + filter bar for list/table pages. Sits above a table; the
// page owns the actual filtering (client-side) so it can match the right fields.
export default function ListControls({ search, onSearch, placeholder, filters = [], result }: {
  search: string;
  onSearch: (v: string) => void;
  placeholder?: string;
  filters?: ListFilter[];
  result?: string;
}) {
  return (
    <div className="list-controls">
      <input
        className="list-search"
        type="search"
        value={search}
        placeholder={placeholder || 'Search…'}
        onChange={(e) => onSearch(e.target.value)}
        aria-label="Search"
      />
      {filters.map((f) => (
        <select key={f.label} className="admin-filter" value={f.value} onChange={(e) => f.onChange(e.target.value)} aria-label={f.label}>
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ))}
      {result && <span className="list-result muted small">{result}</span>}
    </div>
  );
}
