---
name: PlanGlade
description: A quiet, keyboard-capable workspace for planning and finishing real work.
colors:
  ink: "hsl(240 8% 12%)"
  paper: "hsl(0 0% 100%)"
  soft-surface: "hsl(240 5% 96%)"
  quiet-ink: "hsl(240 4% 42%)"
  rule: "hsl(240 5% 90%)"
  danger: "hsl(0 72% 46%)"
  success: "hsl(152 45% 32%)"
  warning: "hsl(32 85% 40%)"
typography:
  title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  compact: "4px"
  control: "6px"
  surface: "8px"
  panel: "12px"
spacing:
  hairline: "4px"
  compact: "8px"
  control: "12px"
  section: "24px"
  page: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.quiet-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "8px 12px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "8px 12px"
---

# Design System: PlanGlade

## Overview

**Creative North Star: "The Quiet Workshop"**

PlanGlade should feel like a well-kept workbench: calm enough for sustained attention, dense enough for serious planning, and precise enough that users trust every control. The interface recedes behind the work. Brand character comes from disciplined spacing, crisp type, muted neutral surfaces, and small moments of confident feedback rather than decoration.

This is an **Operate** interface. Scanability, keyboard access, touch ergonomics, and state clarity outrank spectacle. Desktop may be compact; touch contexts must provide at least 44px targets without making the visual controls look inflated.

**Key Characteristics:**

- Restrained neutral palette with semantic color used only for status and consequence.
- Flat, information-led surfaces separated primarily by spacing and fine rules.
- Compact desktop controls that expand their hit area for touch.
- Fast, origin-aware motion that explains state and disappears under reduced motion.
- Shared primitives before page-local control styling.

## Colors

The palette is warm-neutral and nearly monochrome; semantic hues are scarce so urgency and completion remain legible.

### Primary

- **Workshop Ink:** The foreground and primary-action color. It carries headings, selected controls, and the strongest action on a surface.

### Secondary

- **Soft Surface:** The quiet grouping layer for hover, selected navigation, and low-emphasis containers.
- **Quiet Ink:** Secondary copy and metadata; never place it over an unrelated colored surface.

### Tertiary

- **Consequence Red, Completion Green, and Attention Amber:** Reserved for destructive actions, completed work, deadlines, blockers, and warnings.

### Neutral

- **Paper:** The default light canvas and card surface.
- **Rule:** Dividers and field boundaries; borders should clarify structure rather than box every region.

**The Scarce Color Rule.** A semantic hue must communicate state or consequence. It is not decoration.

## Typography

**Display Font:** System sans-serif stack

**Body Font:** System sans-serif stack

**Label/Mono Font:** System sans-serif; monospace only for shortcuts, recovery codes, code, or measured data

**Character:** Clear, familiar, and compact. Weight and spacing carry hierarchy; ornamental type would compete with the planning content.

### Hierarchy

- **Title** (600, 22px, 1.25): One page-level heading per route.
- **Section title** (600, 13px, 20px): Quiet hierarchy inside dense operational views.
- **Body** (400, 14px, 1.5): Descriptions, form guidance, and reading content.
- **Label** (500, 12.5px, 1.4): Metadata, chips, counts, and compact controls.

**The One-Read Rule.** A user should distinguish page title, section title, item title, and metadata in one glance without relying on color.

## Layout

The desktop shell uses a fixed 228px sidebar that collapses to 60px and content containers capped at 900px, 1200px, or 1600px according to the task. Mobile uses a 56px top bar and a sheet for primary navigation. Page gutters grow from 12px on small screens to 32px on wide screens.

Desktop density is intentional, but pointer context—not viewport alone—controls hit-area expectations. Frequent mobile and coarse-pointer targets are at least 44px. Toolbars wrap by task group and use progressive disclosure for secondary controls rather than horizontal overflow.

**The Work Before Chrome Rule.** Navigation and controls establish context quickly, then yield visual space to task content.

## Elevation & Depth

PlanGlade is flat by default. Fine borders and tonal changes create most separation. Small offset shadows may distinguish menus, overlays, and selected controls; broad ambient shadows and decorative glow do not belong in routine workspace surfaces.

**The Flat-at-Rest Rule.** Elevation communicates overlay, focus, or movement. A resting content panel does not need both a border and a prominent shadow.

## Shapes

Controls use gently compact corners around 6–8px. Larger grouped surfaces may reach 12px when they contain several related controls. Pills are limited to statuses, filters, and compact counts. Circular geometry is reserved for completion controls, avatars, and count badges.

## Components

### Approved source protocol

Before creating or changing a frontend pattern, inspect the relevant approved source and adapt compatible code to PlanGlade's React, Tailwind, Radix, accessibility, and visual conventions:

1. Use [shadcn/ui](https://ui.shadcn.com) for primitives and [Shadcn Blocks](https://shadcnblocks.com) for application shells, settings, tables, and operational page composition.
2. Use [Transitions.dev](https://transitions.dev) and [beUI](https://beui.dev) for purposeful menu, tab, drawer, switch, and state transitions.
3. Use [Beautiful UI](https://beautifului.dev), [Rare UI](https://rareui.com), [Magic UI](https://magicui.design), and [Aceternity UI](https://ui.aceternity.com) only when their expressive pattern serves a real product state; do not import spectacle into routine task work.
4. Use [AI SDK Elements](https://elements.ai-sdk.dev) only for an actual AI conversation, generation, or tool surface.

Reuse source directly when licensing is clear and the stack is compatible. Otherwise adapt the closest pattern without adding a dependency. Record the chosen source in the implementation or review description when the relationship is not already obvious from a shared primitive.

### Buttons

- **Shape:** Compact rounded rectangle (6px), with a 44px target in touch contexts.
- **Primary:** Workshop Ink on Paper; one dominant action per local task group.
- **Hover / Focus:** Subtle tonal shift, visible 3px focus ring, and restrained press feedback.
- **Secondary / Ghost:** Border or transparent background; never recreate these variants page by page.

### Chips

- **Style:** Small rounded status surfaces with semantic text and a faint same-hue background.
- **State:** Text always accompanies color; selected filter chips retain a visible border.

### Cards / Containers

- **Corner Style:** 8–12px according to grouping scale.
- **Background:** Paper or Soft Surface.
- **Shadow Strategy:** Flat at rest; low offset shadow only for overlays or selected controls.
- **Border:** One fine rule when spacing alone cannot establish the boundary.

### Inputs / Fields

- **Style:** Shared input primitives with Paper background, Rule border, and 6px corners.
- **Focus:** High-contrast ring without layout shift.
- **Error / Disabled:** Error text names recovery; disabled controls retain readable labels.

### Navigation

Primary navigation uses icon plus text, a quiet selected surface, and one narrow active marker. Mobile uses the shared sheet behavior. Workspace, account, appearance, and search controls reuse shared button, input, tooltip, menu, and shortcut primitives.

### Task rows

The whole row opens task details while completion and project controls remain independently reachable. Metadata may compress visually, but its interactive hit regions remain 44px on touch and never overlap.

## Do's and Don'ts

### Do:

- **Do** begin with the approved-source protocol and the existing shared component layer.
- **Do** preserve keyboard focus, semantic names, reduced-motion alternatives, and 44px touch targets.
- **Do** use route-level code splitting for noncritical product surfaces.
- **Do** test light, dark, 320px, 390px, tablet, and wide desktop layouts with real content.

### Don't:

- **Don't** hand-roll buttons, inputs, empty states, shortcuts, sidebars, or overlays when the shared layer owns the pattern.
- **Don't** use animated decoration, gradients, glass, or novelty components without a product-specific job.
- **Don't** globally collapse every animation to a token duration; remove nonessential motion and preserve instantaneous state clarity intentionally.
- **Don't** force every approved library into the product. Relevance, accessibility, licensing, and compatibility still decide what ships.
