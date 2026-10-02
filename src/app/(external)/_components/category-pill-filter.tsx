"use client";

import { useState } from "react";

const CATEGORIES = [
  { id: "all", label: "All Activities" },
  { id: "ai-cloud", label: "AI & Google Cloud" },
  { id: "android-mobile", label: "Android & Mobile" },
  { id: "web-frontend", label: "Web & Frameworks" },
  { id: "study-jams", label: "Study Jams & Labs" },
  { id: "hackathons", label: "Hackathons & Conferences" },
];

export function CategoryPillFilter() {
  const [activeCategory, setActiveCategory] = useState("all");

  return (
    <div className="border-b py-6" style={{ borderColor: "var(--theme-border)" }}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1 sm:justify-center">
          {CATEGORIES.map((cat) => {
            const isSelected = activeCategory === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className="shrink-0 rounded-full px-5 py-2 font-medium text-[14px] transition-all duration-200"
                style={{
                  backgroundColor: isSelected ? "var(--theme-primary)" : "transparent",
                  color: isSelected ? "var(--theme-primary-foreground)" : "var(--muted-foreground)",
                  border: isSelected ? "1px solid var(--theme-primary)" : "1px solid var(--border)",
                  boxShadow: isSelected ? "var(--theme-shadow)" : "none",
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
