const USD_AMOUNT_SOURCE =
  String.raw`(?:US\$|[$€£])\s*\d[\d,]*(?:\.\d+)?(?:\s*(?:k|m|b|thousand|million|billion))?|\b\d[\d,]*(?:\.\d+)?\s*(?:k|m|b|thousand|million|billion)\b|\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b`;
const USD_AMOUNT_PATTERN = new RegExp(USD_AMOUNT_SOURCE, "gi");
const USD_AMOUNT_TEST_PATTERN = new RegExp(USD_AMOUNT_SOURCE, "i");

const CURRENCY_WORD_PATTERN =
  /\b(?:USD|US dollars?|dollars?|EUR|euros?|GBP|pounds?)\b\.?/gi;

function stripCurrencyWords(value: string): string {
  return value.replace(CURRENCY_WORD_PATTERN, "").replace(/\s{2,}/g, " ").trim();
}

function formatUsdAmount(amount: string): string {
  const normalized = amount
    .replace(/^US\$/i, "")
    .replace(/^[$€£]\s*/, "")
    .trim()
    .replace(/\s+(?=[kmb]\b)/i, "")
    .replace(/\s+/g, " ");

  return normalized ? `$${normalized}` : amount;
}

export function formatBudgetUsd(value?: string | null): string {
  const raw = value?.trim();
  if (!raw) return "";

  const withoutCurrencyWords = stripCurrencyWords(raw);
  let matched = false;
  let lastAmountEnd = 0;
  let formatted = "";
  let lastMatchEnd = 0;

  for (const match of withoutCurrencyWords.matchAll(USD_AMOUNT_PATTERN)) {
    const index = match.index ?? 0;
    matched = true;
    formatted += withoutCurrencyWords.slice(lastMatchEnd, index);
    formatted += formatUsdAmount(match[0]);
    lastAmountEnd = formatted.length;
    lastMatchEnd = index + match[0].length;
  }
  formatted += withoutCurrencyWords.slice(lastMatchEnd);

  if (!matched) return raw;

  const withCurrencyCode = `${formatted.slice(0, lastAmountEnd)} USD${formatted.slice(
    lastAmountEnd
  )}`;
  return withCurrencyCode.replace(/\s{2,}/g, " ").trim();
}

export function hasBudgetAmount(value?: string | null): boolean {
  return USD_AMOUNT_TEST_PATTERN.test(value ?? "");
}

export function formatBudgetSignalLabel(label: string, value?: string | null): string {
  const formattedValue = formatBudgetUsd(value);
  if (value && formattedValue && label.includes(value)) {
    return label.replace(value, formattedValue);
  }
  const formattedLabel = formatBudgetUsd(label);
  if (formattedLabel !== label) return formattedLabel;
  return formattedValue ? `${label}: ${formattedValue}` : label;
}
