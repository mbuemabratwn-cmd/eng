# Frontend Guidelines

## Style: Structured Tutor Workspace with Apple-like Semantic Color

The app should feel like a serious long-term AI English learning workspace, but it should not feel sleepy, gray, or overly plain. It should use Apple-like color principles: calm structure, content-first layout, semantic color, lively but controlled accents, and subtle material/motion effects for controls and state changes.

Do not interpret "Apple-like" as only gray, white, and blue. Use color in a modern Apple / WWDC-like way:
- semantic
- consistent
- energetic in small areas
- content-first
- polished
- adaptive
- not decorative everywhere

## Core UI Direction

1. Chat-first.
2. Desktop workspace feel.
3. Prefer dividers, panel boundaries, and spacing for layout separation.
4. Do not rely on many rounded cards to separate every region.
5. Use cards only for focused learning artifacts, such as daily vocabulary themes, word notes, file previews, and weekly review highlights.
6. Keep the right dashboard lightweight and separated by a vertical divider.
7. The UI should feel alive during learning moments, but quiet when reading or chatting.

## Visual References

- Claude / ChatGPT for conversation-first interaction.
- Linear / Raycast for structured desktop tool clarity.
- Readwise Reader for comfortable long reading surfaces.
- Brilliant for guided learning with mild playfulness.
- Apple WWDC / Liquid Glass direction for lively, polished control surfaces and semantic accent color.
- Untitled UI for polished React component quality.

## Base Palette

| Element | Color |
|---------|-------|
| app background | #F7F4EE |
| app background subtle gradient start | #F8F5EF |
| app background subtle gradient end | #F3F7FF |
| main surface | #FFFFFF |
| soft surface | #FFFDF8 |
| sidebar surface | rgba(255, 253, 248, 0.86) |
| divider | #E6DED2 |
| divider strong | #D8CFC2 |
| text primary | #1D1D1F |
| text secondary | #6E6E73 |
| text tertiary | #A1A1A6 |

## Semantic Accent Colors

| Mode | Color | Hex |
|------|-------|-----|
| vocabulary green | green | #34C759 |
| review blue | blue | #0A84FF |
| long sentence indigo | indigo | #5E5CE6 |
| grammar coral/red | coral | #FF6B5F |
| summary purple | purple | #AF52DE |
| file cyan | cyan | #32ADE6 |
| focus amber | amber | #FF9F0A |
| AI glow lavender | lavender | #BF5AF2 |

## Soft Tint Backgrounds

| Mode | Color | Hex |
|------|-------|-----|
| vocabulary tint | green tint | #ECF9F0 |
| review tint | blue tint | #EEF6FF |
| long sentence tint | indigo tint | #F0F0FF |
| grammar tint | coral tint | #FFF0EE |
| summary tint | purple tint | #F8F0FF |
| file tint | cyan tint | #ECFAFD |
| focus tint | amber tint | #FFF6E8 |
| AI tint | lavender tint | #F7EEFF |

## Mode Color Rules

- vocabulary theme: green + focus amber
- review: blue
- long sentence: indigo + blue
- grammar correction: coral/red
- summary / weekly review: purple
- file upload: cyan
- AI thinking / planning: lavender glow
- warning / overload: amber
- destructive action: red, always with confirmation

## Color Usage Ratio

- 80-85% neutral surfaces, text, dividers
- 10-15% soft semantic tints
- 3-5% saturated accent colors

The app should feel more exciting than a plain beige reading app, but still focused enough for daily study.

## Layout Principles

1. Main chat area is dominant.
2. Left sidebar is optional and collapsible.
3. Right status panel is lightweight and separated by a 1px vertical divider.
4. Bottom composer is separated by a 1px top divider.
5. Top bar is compact and separated by a 1px bottom divider.
6. Avoid heavy shadows and nested cards.
7. Use subtle translucent surfaces only for top bar, command menu, floating toolbar, popovers, and composer controls.

## Divider Principles

- Use 1px borders for main regions.
- Use low-contrast warm gray borders.
- Use semantic accent borders only for active learning state.
- Example: active vocabulary mode can use a thin green left border or top hairline, not a full green panel.
- Do not make the UI look like a spreadsheet.

## Corner Radius

- Main panels: 0-8px.
- Buttons: 8-10px.
- Inputs / composer inner box: 12-16px.
- Chips: pill radius.
- Modals / popovers: 12px.
- Learning cards: 10-12px.
- Avoid excessive 2xl rounded corners.
- Do not separate every region with rounded cards; use dividers and spacing.

## Button Behavior

- Primary buttons: dark neutral or current mode accent, white text.
- Secondary buttons: transparent or soft surface with border.
- Ghost buttons: transparent, soft hover background.
- Dangerous buttons: red text, soft red hover, confirmation required.
- Hover should be subtle but responsive: background tint, slight border change, 120-180ms transition.
- Active state can slightly deepen color or move by 0.5px.
- Focus-visible must be clear and accessible.
- Avoid bouncy hover effects, large scaling, and decorative animation.

## Hover Style

- Normal hover: warm neutral tint.
- Mode hover: corresponding semantic tint.
- Active mode: semantic tint background + saturated accent text/icon + thin accent border.
- Message action hover: icon background appears softly.
- Composer toolbar hover: Liquid Glass-inspired translucent highlight is allowed if readability remains clear.

## Motion

- Motion should clarify state changes only.
- Suitable for command menu, toolbar expansion, panel collapse, file upload state, and AI thinking state.
- Use Motion Primitives only for subtle expansion and state transitions.
- Avoid fireworks, mascot animations, gamified celebrations, or attention-grabbing decoration.
- Animation duration should usually be 120-220ms.

## Liquid Glass-inspired Material Rules

Use only for control/navigation layers:
- top bar
- command menu
- composer toolbar
- floating popovers
- small AI thinking overlay

Do not apply glass effects to long reading content, assistant messages, or sentence analysis blocks.
Do not stack multiple glass panels.
Always maintain text contrast.
Provide a fallback solid background if blur/transparency reduces readability.

## Main Chat

- Assistant messages should feel like readable content, not thick cards.
- User messages can have a soft warm-gray background and modest radius.
- Do not wrap every assistant response in a large rounded card.
- Important words can use subtle semantic highlights.
- Long sentence analysis should use structure blocks and dividers, not rainbow highlighting.

## Right Status Panel

- Use border-left divider.
- Background should be warm and quiet.
- Show only lightweight state:
  - current mode
  - current theme
  - current learning time
  - today learning time
  - focused word progress
  - next suggested action
- Use small semantic chips and thin progress lines.
- Do not show a complex dashboard by default.

## Composer

- Bottom composer is a stable control surface.
- Outer composer area uses a top divider.
- Inner input may have 12-16px radius.
- "+" menu is only for file upload in v0.1.
- "/" commands are quick learning shortcuts.
- Natural language remains the main interaction method.
- Command menu can use a subtle translucent / Liquid Glass-inspired surface if readable.

## Daily Vocabulary Theme

- Can use a soft colorful theme strip or small learning card.
- Use green + amber semantic colors.
- It should feel motivating and fresh, not childish.
- Show theme, total word count, focused word count, and current progress.
- Do not show all 45-60 words as a giant table by default.

## Word Cards

- Should feel like learning notes, not database rows.
- Use small accent line or chip.
- Keep radius moderate.
- Avoid heavy shadow.
- Include only useful current learning information.

## Long Sentence UI

- Use indigo/blue accents.
- Use dividers and indentation for:
  - original sentence
  - main structure
  - modifiers
  - clauses
  - translation
- Do not over-color every phrase.

## Grammar Correction UI

- Use coral/red carefully.
- Underline or mark the specific error.
- Use a soft tint explanation block.
- Do not turn the whole message red.

## Weekly Review

- Use purple as the main semantic accent.
- Use section dividers.
- Use small cards only for key highlights.
- It should feel like a thoughtful teacher review, not an analytics dashboard.

## Implementation Rules

- React + TypeScript + Vite.
- Tailwind CSS for tokens, layout, hover, focus, and states.
- Prefer local component ownership, similar to shadcn/ui philosophy.
- Radix UI or React Aria based primitives are preferred for accessibility.
- Untitled UI React components may be copied/adapted for complex UI components.
- Motion Primitives may be used only for subtle toolbar, command menu, and panel transitions.
- Before copying any external component, check dependencies, Tailwind compatibility, accessibility, license/usage constraints, and Electron compatibility.
- Document any added dependency in DECISIONS.md.
- Do not introduce large UI libraries that conflict with the design system.
- Do not redesign the whole app immediately unless the current phase is frontend-related.

## Goal

The final frontend should feel like a calm Apple-quality learning workspace that becomes colorful and energetic at the right learning moments, not a sleepy beige note app, not a gamified vocabulary app, not a SaaS dashboard, and not a glassmorphism demo.
