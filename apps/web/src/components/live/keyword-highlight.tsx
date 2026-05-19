"use client";

import { useMemo } from "react";
import type { KeywordDefinitions } from "@/lib/live-types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const EMPTY_DEFINITIONS: KeywordDefinitions = {};

function findKeywordInText(text: string, keys: string[]): string | undefined {
  const lower = text.toLowerCase();
  return keys.find((k) => lower.includes(k.toLowerCase()));
}

interface KeywordHighlightProps {
  text: string;
  definitions?: KeywordDefinitions;
}

export function KeywordHighlight({ text, definitions = EMPTY_DEFINITIONS }: KeywordHighlightProps) {
  const keys = useMemo(() => Object.keys(definitions), [definitions]);

  if (!keys.length) {
    return <span>{text}</span>;
  }

  const parts = text.split(/(\s+)/);

  return (
    <span>
      {parts.map((part, i) => {
        const matchedKey = findKeywordInText(part, keys);
        const defKey = matchedKey
          ? Object.keys(definitions).find((k) => k.toLowerCase() === matchedKey.toLowerCase())
          : findKeywordInText(part, keys);

        const def = defKey ? definitions[defKey] : null;
        if (!def) return <span key={i}>{part}</span>;

        return (
          <Popover key={i}>
            <PopoverTrigger asChild>
              <button type="button" className="underline decoration-dotted decoration-primary/60 cursor-help">
                {part}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 text-sm">
              <p className="font-medium">{def.title}</p>
              <p className="text-muted-foreground mt-1">{def.definition}</p>
              {def.assetHint && (
                <p className="text-xs text-primary mt-2">KB: {def.assetHint}</p>
              )}
            </PopoverContent>
          </Popover>
        );
      })}
    </span>
  );
}
