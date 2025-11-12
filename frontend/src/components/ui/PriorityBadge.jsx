// src/components/ui/PriorityBadge.jsx
const map = {
    "P1-Critical": "bg-[color:var(--stem-orange)]/10 text-[color:var(--stem-orange)] border border-[color:var(--stem-orange)]/30",
    "P2-High":     "bg-[color:var(--stem-yellow)]/10 text-[color:var(--stem-yellow)] border border-[color:var(--stem-yellow)]/30",
    "P3-Medium":   "bg-[color:var(--stem-blue)]/10 text-[color:var(--stem-blue)] border border-[color:var(--stem-blue)]/30",
    "P4-Low":      "bg-[color:var(--stem-grey)]/10 text-[color:var(--stem-grey)] border border-[color:var(--stem-grey)]/30",
  };
  export default function PriorityBadge({ value }) {
    return <span className={`badge ${map[value] || map["P3-Medium"]}`}>{value || "P3-Medium"}</span>;
  }