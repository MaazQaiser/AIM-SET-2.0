"use client";

import { useEffect, useState } from "react";
import { POWERPOINT_ICON_SRC } from "@/lib/kb/format-brand-icons";
import { cn } from "@/lib/cn";

interface KbPowerPointIconProps {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  /** Accessible label; empty alt when decorative. */
  alt?: string;
}

const SIZE_PX = {
  xs: 14,
  sm: 18,
  md: 24,
  lg: 48,
} as const;

const processedCache = new Map<number, string>();

function processPowerPointIcon(sourceSrc: string, px: number): Promise<string> {
  const cached = processedCache.get(px);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = px;
      canvas.height = px;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, px, px);
      const imageData = ctx.getImageData(0, 0, px, px);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r < 50 && g < 50 && b < 50) {
          data[i + 3] = 0;
        } else if (r > 245 && g > 245 && b > 245) {
          data[i + 3] = 0;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      const dataUrl = canvas.toDataURL("image/png");
      processedCache.set(px, dataUrl);
      resolve(dataUrl);
    };
    img.onerror = () => reject(new Error("Failed to load PowerPoint icon"));
    img.src = sourceSrc;
  });
}

export function KbPowerPointIcon({
  size = "md",
  className,
  alt = "",
}: KbPowerPointIconProps) {
  const px = SIZE_PX[size];
  const [src, setSrc] = useState<string | null>(() => processedCache.get(px) ?? null);

  useEffect(() => {
    let cancelled = false;
    void processPowerPointIcon(POWERPOINT_ICON_SRC, px).then((dataUrl) => {
      if (!cancelled) setSrc(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [px]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src ?? POWERPOINT_ICON_SRC}
      alt={alt}
      width={px}
      height={px}
      className={cn("shrink-0 object-contain bg-transparent", className)}
      style={{ width: px, height: px }}
    />
  );
}
