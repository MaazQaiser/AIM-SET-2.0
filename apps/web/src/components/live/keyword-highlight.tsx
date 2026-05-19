"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { KEYWORD_DEFINITIONS } from "@/lib/mock-data";

function findKeywordInText(text: string, keywords: string[]): string | null {
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) return kw;
  }
  return null;
}

export function KeywordHighlight({
  text,
  keywords,
}: {
  text: string;
  keywords: string[];
}) {
  if (!keywords.length) return <>{text}</>;

  const pattern = new RegExp(
    `(${keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi"
  );
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, i) => {
        const matchedKey = keywords.find((k) => k.toLowerCase() === part.toLowerCase());
        const defKey = matchedKey
          ? Object.keys(KEYWORD_DEFINITIONS).find((k) => k.toLowerCase() === matchedKey.toLowerCase())
          : findKeywordInText(part, Object.keys(KEYWORD_DEFINITIONS));

        const def = defKey ? KEYWORD_DEFINITIONS[defKey] : null;

        if (!def) return <span key={i}>{part}</span>;

        return (
          <Popover key={i}>
            <PopoverTrigger asChild>
              <mark className="bg-accent text-accent-foreground rounded-sm px-0.5 cursor-help">
                {part}
              </mark>
            </PopoverTrigger>
            <PopoverContent className="w-72 text-xs" side="top">
              <p className="font-medium">{def.title}</p>
              <p className="text-muted-foreground mt-1">{def.definition}</p>
              {def.assetHint && (
                <p className="text-primary mt-2">{def.assetHint}</p>
              )}
            </PopoverContent>
          </Popover>
        );
      })}
    </>
  );
}
