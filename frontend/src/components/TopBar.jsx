// src/components/TopBar.jsx
import { useEffect, useState } from "react";
import StemLogo from "./ui/StemLogo.jsx";

export default function TopBar() {
  const [theme, setTheme] = useState("light");

  // initialize theme on mount
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved) {
      setTheme(saved);
      document.documentElement.classList.toggle("dark", saved === "dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light");
      document.documentElement.classList.toggle("dark", prefersDark);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur bg-white/60 dark:bg-black/30 border-b border-white/20 dark:border-white/10">
      <div className="container-narrow py-3 flex items-center justify-between text-gray-900 dark:text-white">
        <div className="flex items-center gap-3">
          <StemLogo variant="auto" className="h-6 w-auto" />
          <span className="font-heading tracking-wide">Command Center</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="rounded-full p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>
        </div>
      </div>
    </header>
  );
}