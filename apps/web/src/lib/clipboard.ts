export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  const documentIsFocused =
    typeof document === "undefined" || typeof document.hasFocus !== "function" || document.hasFocus();

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText && documentIsFocused) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall back to the textarea path below.
    }
  }

  if (typeof document === "undefined") return false;

  const textarea = document.createElement("textarea");
  try {
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}
