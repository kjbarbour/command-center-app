// src/components/ui/StemLogo.jsx
import { useEffect, useState } from "react";

// Blue
import bluePng from "../../assets/logos/stem-logo-color-blue.png";
import blueJpg from "../../assets/logos/stem-logo-color-blue.jpg";
// Navy
import navyPng from "../../assets/logos/stem-logo-navy-blue.png";
import navyJpg from "../../assets/logos/stem-logo-navy-blue.jpg";
// White
import whitePng from "../../assets/logos/stem-logo-white.png";
import whiteJpg from "../../assets/logos/stem-logo-white.jpg";

/**
 * Props:
 * - variant: "auto" | "blue" | "navy" | "white"
 * - className: Tailwind classes (e.g., "h-6 w-auto")
 * - title: accessible alt text
 * - prefer: "png" | "jpg" (default png)
 */
export default function StemLogo({
  variant = "auto",
  className = "h-8 w-auto",
  title = "Stem",
  prefer = "png",
}) {
  const [isDark, setIsDark] = useState(
    typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  useEffect(() => {
    if (!window?.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => setIsDark(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  const resolved = variant === "auto" ? (isDark ? "white" : "navy") : variant;

  const sets = {
    blue:  { png: bluePng,  jpg: blueJpg  },
    navy:  { png: navyPng,  jpg: navyJpg  },
    white: { png: whitePng, jpg: whiteJpg },
  };
  const chosen = sets[resolved] || sets.navy;

  return (
    <picture>
      {prefer === "jpg" ? (
        <>
          <source srcSet={chosen.jpg} type="image/jpeg" />
          <source srcSet={chosen.png} type="image/png" />
        </>
      ) : (
        <>
          <source srcSet={chosen.png} type="image/png" />
          <source srcSet={chosen.jpg} type="image/jpeg" />
        </>
      )}
      <img src={chosen.png} alt={title} className={className} />
    </picture>
  );
}