type PlainMarkdownTextPart = { type: "text" | "bold"; value: string };

function splitMarkdownBold(text: string): PlainMarkdownTextPart[] {
  const parts: PlainMarkdownTextPart[] = [];
  const boldRe = /\*\*(.+?)\*\*/g;
  let last = 0;
  let match = boldRe.exec(text);

  while (match !== null) {
    if (match.index > last) {
      parts.push({ type: "text", value: text.slice(last, match.index) });
    }
    parts.push({ type: "bold", value: match[1] ?? "" });
    last = match.index + match[0].length;
    match = boldRe.exec(text);
  }

  if (last < text.length) {
    parts.push({ type: "text", value: text.slice(last) });
  }

  return parts.length > 0 ? parts : [{ type: "text", value: text }];
}

export function PlainMarkdownBold({ text }: { text: string }) {
  const parts = splitMarkdownBold(text);
  let offset = 0;
  const keyedParts = parts.map((part) => {
    const key = `${offset}-${part.value}`;
    offset += part.value.length;
    return { ...part, key };
  });

  return (
    <>
      {keyedParts.map((part) =>
        part.type === "bold" ? (
          <strong key={part.key} className="font-bold text-inherit">
            {part.value}
          </strong>
        ) : (
          <span key={part.key}>{part.value}</span>
        )
      )}
    </>
  );
}
