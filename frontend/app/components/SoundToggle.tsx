"use client";

import { useEffect, useState } from "react";
import { setSoundMuted, playClick } from "../lib/sound";

const STORAGE_KEY = "fogpot:sound-muted";

export default function SoundToggle() {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) === "true";
    setMuted(stored);
    setSoundMuted(stored);
  }, []);

  function toggle() {
    setMuted((prev) => {
      const next = !prev;
      setSoundMuted(next);
      window.localStorage.setItem(STORAGE_KEY, String(next));
      if (!next) playClick();
      return next;
    });
  }

  return (
    <button
      type="button"
      className="nav-sound-btn"
      onClick={toggle}
      aria-label={muted ? "Unmute sound" : "Mute sound"}
      title={muted ? "Unmute sound" : "Mute sound"}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2 7h3l4-3.5v9L5 9H2z" fill="currentColor" stroke="none" />
        {muted ? (
          <path d="M12 6.5l4 5M16 6.5l-4 5" />
        ) : (
          <>
            <path d="M11.3 6.2a3.4 3.4 0 0 1 0 5.6" />
            <path d="M13.2 4a6.4 6.4 0 0 1 0 10" />
          </>
        )}
      </svg>
    </button>
  );
}
