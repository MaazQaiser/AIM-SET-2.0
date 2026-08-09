# Glass Card design (CSS snippet)

This file captures the current “glass card” styling used by `DailyBriefingCard` via the `glass-insight-card` class.

## Source

- Class: `.glass-insight-card`
- Defined in: `packages/ui/src/styles/utilities.css`

## CSS

```css
/* Light mode */
.glass-insight-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
  border: 1px solid #ffffff;
  border-radius: 24px;
  box-shadow: none;
  background: linear-gradient(
    180deg,
    #ffffff 0%,
    rgba(255, 255, 255, 0.3) 100%
  );
}

/* Dark mode */
.dark .glass-insight-card {
  border-color: rgba(255, 255, 255, 0.12);
  background: linear-gradient(
    180deg,
    rgba(38, 38, 44, 0.95) 0%,
    rgba(38, 38, 44, 0.6) 100%
  );
}
```

