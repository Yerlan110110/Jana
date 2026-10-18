import { useEffect, useRef, useState, type ReactNode } from "react";
import "../brand-intro.css";

const seenKey = "janamen-intro-v1";

function shouldPlay() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    return sessionStorage.getItem(seenKey) !== "seen";
  } catch {
    return false;
  }
}

export function BrandIntro({ children }: { children: ReactNode }) {
  const [playing, setPlaying] = useState(shouldPlay);
  const [muted, setMuted] = useState(true);
  const video = useRef<HTMLVideoElement>(null);
  const skip = useRef<HTMLButtonElement>(null);

  function finish() {
    try {
      sessionStorage.setItem(seenKey, "seen");
    } catch {
      // Storage can become unavailable after the initial browser check.
    }
    setPlaying(false);
  }

  useEffect(() => {
    if (!playing) return;
    skip.current?.focus();
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onPreference = () => {
      if (media.matches) finish();
    };
    media.addEventListener("change", onPreference);
    const timeout = window.setTimeout(finish, 15_000);
    void video.current?.play().catch(finish);
    return () => {
      media.removeEventListener("change", onPreference);
      window.clearTimeout(timeout);
    };
  }, [playing]);

  if (!playing) return children;

  return (
    <main className="brand-intro" aria-label="Заставка JanaMen"
      onKeyDown={(event) => { if (event.key === "Escape") finish(); }}>
      <video
        ref={video}
        src="/media/janamen-intro.mp4"
        poster="/media/janamen-intro-poster.jpg"
        autoPlay
        muted={muted}
        playsInline
        preload="auto"
        onEnded={finish}
        onError={finish}
        aria-hidden="true"
      />
      <div className="brand-intro-controls">
        <span>JanaMen</span>
        <div>
          <button type="button" aria-pressed={!muted}
            onClick={() => setMuted(!muted)}>
            {muted ? "Включить звук" : "Выключить звук"}
          </button>
          <button ref={skip} type="button" onClick={finish}>
            Пропустить
          </button>
        </div>
      </div>
    </main>
  );
}
