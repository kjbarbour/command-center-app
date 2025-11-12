// src/components/Sidebar.jsx
export default function Sidebar({ open = true, sections = [], onSelect = () => {} }) {
  return (
    <aside
      className="hidden md:block shrink-0"
      style={{ width: "var(--sidebar-w)" }}
      aria-hidden={!open}
    >
      <div className="sticky top-0 h-[calc(100vh-0px)] p-3">
        <div className="card p-3">
          <div className="heading-sm mb-1">Views</div>
          <p className="text-muted text-xs mb-3">Quick navigation</p>
          <nav className="space-y-1">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                className="w-full text-left px-3 py-2 rounded-2xl hover:bg-[color:var(--stem-blue)]/10 transition-colors"
              >
                <div className="text-sm font-medium">{s.label}</div>
                {s.caption && <div className="text-muted text-xs">{s.caption}</div>}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </aside>
  );
}