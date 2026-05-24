"use client";

import { useMemo } from "react";
import type { KeywordDefinitions } from "@/lib/live-types";
import { Popover, PopoverContent, PopoverTrigger } from "@dc-copilot/ui/components/popover";

const EMPTY_DEFINITIONS: KeywordDefinitions = {};

function findKeywordInText(text: string, keys: string[]): string | undefined {
  const lower = text.toLowerCase();
  return keys.find((k) => lower.includes(k.toLowerCase()));
}

function splitWithOffsets(text: string) {
  let offset = 0;
  return text.split(/(\s+)/).map((value) => {
    const part = { value, offset };
    offset += value.length;
    return part;
  });
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

  const parts = splitWithOffsets(text);

  return (
    <span>
      {parts.map((part) => {
        const matchedKey = findKeywordInText(part.value, keys);
        const defKey = matchedKey
          ? Object.keys(definitions).find((k) => k.toLowerCase() === matchedKey.toLowerCase())
          : findKeywordInText(part.value, keys);

        const def = defKey ? definitions[defKey] : null;
        if (!def) return <span key={`${part.offset}-${part.value}`}>{part.value}</span>;

        return (
          <Popover key={`${part.offset}-${part.value}`}>
            <PopoverTrigger asChild>
              <button type="button" className="underline decoration-dotted decoration-primary/60 cursor-help">
                {part.value}
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
