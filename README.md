# 3615-UCODIA ☎️

The Internet of the future past 🌈

## Notes

### 2026-09-17 - Broken keyboard keys

The Minitel keyboard is failing progressively. Keys that no longer respond:

- Retour, Suite
- 4 5 6 7 8 9 0 \* #
- Esc ; - :
- U I O
- Q S J K L M
- Up, Down, Left, Right

Temporary remaps until the keyboard is repaired:

| Page             | Action            | Original key        | Temporary key |
| ---------------- | ----------------- | ------------------- | ------------- |
| Main menu        | Venables Vibes    | 4                   | V             |
| Calendars        | Previous / next   | Retour / Suite, ← → | 1 / 3         |
| Omelette facts   | Close up          | Suite, →            | 3             |
| Venables Vibes   | Go west / go east | Retour / Suite, ← → | W / E         |

The original keys are still handled in code, so once the hardware is fixed only the on-screen labels and the main menu key need to be restored. New pages should only rely on keys that still work.