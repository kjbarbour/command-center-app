// src/components/ui/Card.jsx
export default function Card({ title, subtitle, children, className = "" }) {
    return (
      <div className={`card ${className}`}>
        {(title || subtitle) && (
          <div className="px-4 pt-4">
            {title && <h3 className="heading-sm">{title}</h3>}
            {subtitle && <p className="text-muted text-xs mt-1">{subtitle}</p>}
          </div>
        )}
        <div className="p-4">{children}</div>
      </div>
    );
  }