"use client";

import { useEffect, useState } from "react";

interface TypingTextProps {
  text: string;
  /** When false, show full text immediately without animation. */
  active?: boolean;
  className?: string;
}

export function TypingText({ text, active = true, className }: TypingTextProps) {
  const [visible, setVisible] = useState(active ? "" : text);

  useEffect(() => {
    if (!active) {
      setVisible(text);
      return;
    }

    setVisible("");
    let index = 0;
    const step = Math.max(1, Math.ceil(text.length / 120));
    const timer = window.setInterval(() => {
      index = Math.min(text.length, index + step);
      setVisible(text.slice(0, index));
      if (index >= text.length) {
        window.clearInterval(timer);
      }
    }, 14);

    return () => window.clearInterval(timer);
  }, [active, text]);

  const typing = active && visible.length < text.length;

  return (
    <span className={className}>
      {visible}
      {typing && (
        <span className="ml-0.5 inline-block h-4 w-1 translate-y-0.5 bg-current animate-cursor" />
      )}
    </span>
  );
}
