---
name: Kinetic Glass Minimalist
colors:
  surface: '#f9f9f6'
  surface-dim: '#dadad7'
  surface-bright: '#f9f9f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f4f1'
  surface-container: '#eeeeeb'
  surface-container-high: '#e8e8e5'
  surface-container-highest: '#e2e3e0'
  on-surface: '#1a1c1b'
  on-surface-variant: '#444748'
  inverse-surface: '#2f312f'
  inverse-on-surface: '#f1f1ee'
  outline: '#747878'
  outline-variant: '#c4c7c7'
  surface-tint: '#5f5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1c1b1b'
  on-primary-container: '#858383'
  inverse-primary: '#c8c6c5'
  secondary: '#4d6452'
  on-secondary: '#ffffff'
  secondary-container: '#cde6d0'
  on-secondary-container: '#526856'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#001e2f'
  on-tertiary-container: '#6887a0'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c8c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474746'
  secondary-fixed: '#d0e9d3'
  secondary-fixed-dim: '#b4cdb8'
  on-secondary-fixed: '#0b2012'
  on-secondary-fixed-variant: '#364c3c'
  tertiary-fixed: '#c9e6ff'
  tertiary-fixed-dim: '#aacae5'
  on-tertiary-fixed: '#001e2f'
  on-tertiary-fixed-variant: '#2a4a60'
  background: '#f9f9f6'
  on-background: '#1a1c1b'
  surface-variant: '#e2e3e0'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 3rem
    fontWeight: '600'
    lineHeight: 3.25rem
    letterSpacing: -0.04em
  display-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 2.25rem
    fontWeight: '600'
    lineHeight: 2.5rem
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 2rem
    fontWeight: '500'
    lineHeight: 2.375rem
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 1.5rem
    fontWeight: '500'
    lineHeight: 1.875rem
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Manrope
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.625rem
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Manrope
    fontSize: 1.125rem
    fontWeight: '600'
    lineHeight: 1.5rem
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Manrope
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.5rem
    letterSpacing: -0.005em
  body-md:
    fontFamily: Manrope
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.375rem
    letterSpacing: 0em
  body-sm:
    fontFamily: Manrope
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1.125rem
    letterSpacing: 0.01em
  label-numeric:
    fontFamily: Geist
    fontSize: 1.75rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.03em
  label-code:
    fontFamily: Geist
    fontSize: 0.8125rem
    fontWeight: '500'
    lineHeight: 1rem
    letterSpacing: 0.04em
  label-tag:
    fontFamily: Geist
    fontSize: 0.6875rem
    fontWeight: '600'
    lineHeight: 0.875rem
    letterSpacing: 0.06em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-sm: 0.75rem
  margin: 1.25rem
  margin-mobile: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.25rem
---

## Brand & Style

This design system embodies the intersection between the precision-engineered minimalism of Nothing OS and the restrained, tactile lucidity of modern Apple interfaces. Designed specifically for focused academic performance tracking and attendance control, the interface minimizes cognitive friction while delivering instant, glanceable state awareness.

The emotional signature is calm, disciplined, and technologically transparent. It departs from loud gamified student tools in favor of an engineered instrument panel: translucent surfaces, ultra-refined borders, tabular structural discipline, and soft natural accents replace garish alerts.

The aesthetic philosophy centers on:
- **Refined Glassmorphism:** Translucent floating containers with high-diffusion backdrop filters and hairline light-refracting edge borders (`rgba(255, 255, 255, 0.65)` in light mode, `rgba(255, 255, 255, 0.08)` in dark mode).
- **Geometric Dot-Matrix & Grotesque Restraint:** Crisp, technical typesetting paired with understated geometric stat gauges.
- **Micro-Contrast Hierarchy:** Deep charcoal/graphite typography resting upon luminous, clean light grounds, elevated by muted status indicators inspired by natural minerals (sage, soft clay orange, muted crimson, and washed slate blue).

## Colors

The palette leverages a clean, luminous light-mode substrate accented with desaturated semantic indicators to reduce stress during intense academic cycles.

### Canvas & Neutral Architecture
- **Primary Canvas (Light):** `#f5f5f2` — luminous technical paper foundation.
- **Card / Surface Base (Light):** `#ffffff` with translucent layering.
- **Ink / Foundation Charcoal:** `#171717` (Light mode primary text).
- **Muted Label Carbon:** `#666666` (Light).

### Semantic & Status Spectrum
- **Safe / Above Quota (Sage Green):** `#91A995` — calm verification for attendance > 75–80%.
- **Warning / At Risk (Muted Clay Orange):** `#E89A68` — caution without alarming panics for attendance near threshold margins.
- **Critical / Shortage (Muted Crimson):** `#D97B78` — definite shortage alert requiring immediate action.
- **Active / System Pulse (Soft Blue):** `#8FAFC9` — current day, running lecture status, and navigation indicator.

## Typography

The typographic hierarchy relies on a triple font system:
1. **Space Grotesk** for primary brand metrics, big numerical percentage displays, and section headlines. It introduces an architectural, technical edge reminiscent of Nothing OS.
2. **Manrope** for primary interface narration, content groupings, course schedules, and body copy. It supplies high readability and neutral legibility under rapid glance conditions.
3. **Geist** for technical telemetry: timestamps, status tokens, attendance quotas (e.g., `18/24 (75.0%)`), room coordinates, and hardware-style labels.

### Tabular Formatting
All numerical indicators within statistics, gauges, and tables must enforce monospace tabular figures (`font-variant-numeric: tabular-nums`) to prevent layout shifting during real-time status adjustments.

## Layout & Spacing

This design system is tailored for a single-hand, thumb-driven mobile portrait viewport (optimized for 390px–430px widths), scaling smoothly into multi-column dashboard views for iPad and tablet landscape viewports.

### Grid & Composition Rules
- **Mobile Frame:** Single dynamic column with 16px (`1rem`) outer margins and a vertical stack spacing rhythm of 12px to 16px between cards.
- **Tablet & Desktop:** 4 to 8 column fluid responsive grid, capping the maximum container width at 768px for portrait slate modes and 1120px for desktop views.
- **Dock Clearance:** All scrollable canvases must include a mandatory bottom padding clearance of `6rem` (96px) to avoid occlusion by the floating glass dock.
- **Vertical Rhythm:** 4px base modular unit. Micro gaps inside chips and metadata use `space-xs` (4px) or `space-sm` (8px); internal card paddings use `space-md` (16px) or `space-lg` (24px) depending on content density.

## Elevation & Depth

Visual hierarchy leverages clean tonal layering, soft ambient diffusion, and micro rim-lighting tailored for light environments.

### Depth Strata
1. **Base Layer (L0):** The solid foundational canvas (`#f5f5f2` light). Static, un-blurred.
2. **Standard Surface Cards (L1):** 
   - Light mode: `background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(18px);`
   - Border: `1px solid rgba(0, 0, 0, 0.08)`.
   - Shadow: `0 8px 32px -4px rgba(0, 0, 0, 0.08)`.
3. **Floating Navigation Dock & Elevated Sheets (L2):** 
   - Light mode: `background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(28px);`
   - Border: `1px solid rgba(0, 0, 0, 0.12)`.
   - Shadow: `0 16px 48px -4px rgba(0, 0, 0, 0.12)`.
4. **Modals & Overlays (L3):** Full canvas overlay backdrop blurred at `12px` with a `15%` opacity darkening shield.

## Shapes

The design system maintains strict geometric consistency using continuous curvature squircle geometry.

- **Standard Containers & Cards:** `1rem` (16px) radius for regular module cards, creating a unified structural cadence across lists.
- **Hero Stats & Major Progress Cards:** `1.5rem` (24px) radius for primary visual containers (e.g., overall attendance index, weekly trajectory).
- **Interactive Buttons & Badges:** `0.5rem` (8px) radius for compact inline actions; complete continuous pill (`9999px`) for status chips, floating quick-toggles, and the bottom dock capsule.
- **Pointers & Gauges:** Pure circles (`border-radius: 50%`) for metric rings, radial attendance gauges, and avatar anchors.

## Components

### 1. Circular Progress Gauges
- **Structure:** SVG stroke ring with a subtle neutral track (`rgba(0, 0, 0, 0.08)` light) and an active indicator stroke using the semantic state color.
- **Typography Integration:** Central readout displaying the percentage in `label-numeric`, capped with a micro `label-tag` underneath indicating status (e.g., `"SAFE"`, `"CRITICAL"`).
- **Stroke Style:** Round caps, width `6px` to `8px` depending on gauge size (80px compact vs 140px hero).

### 2. Floating Bottom Navigation Dock
- **Form Factor:** Horizontally centered pill capsule floating 24px above screen bottom margin, max width 320px.
- **Surface:** Frosted translucent glass with dynamic edge rim.
- **Items:** 4 primary icons with 1 active state capsule. Active state uses `#FFFFFF` icon on `#171717` pill (light mode), accompanied by a micro glow pulse in Soft Blue (`#8FAFC9`).

### 3. Metric & Attendance Course Cards
- **Structure:** Top row with course code (`label-code`) and status badge. Middle row with course title (`headline-sm`) and schedule time. Bottom row with quick attendance action buttons (`Attended`, `Missed`) and an inline segmented ratio bar.
- **Visuals:** Frosted glass surface, hairline border, `16px` inner padding.

### 4. Status Badges
- **Form Factor:** Pill shaped capsule, vertical padding 4px, horizontal padding 10px.
- **Color Logic:** Tinted semi-transparent fill (`15%` opacity of accent color) paired with a solid accent colored glyph/text. 
  - *Safe:* `#91A995` text, `rgba(145, 169, 149, 0.15)` background.
  - *Warning:* `#E89A68` text, `rgba(232, 154, 104, 0.15)` background.
  - *Shortage:* `#D97B78` text, `rgba(217, 123, 120, 0.15)` background.

### 5. Buttons & Controls
- **Primary Action Button:** Deep charcoal (`#171717`) in light mode. Monospaced or technical grotesque label, tactile scale down animation (`0.97`) on tap.
- **Secondary Ghost Button:** Translucent frosted surface, `1px` border, high-contrast text.
- **Quick Tap Attendance Toggles:** Split segmented controls with haptic-style states: checkmark (`Safe`) vs cross (`Critical`) micro-buttons built directly into lecture schedule rows.

### 6. Input Fields
- **Container:** Recessed pill or rounded card (`0.75rem` radius), tinted `#ffffff` (light).
- **Active State:** Border transitions from neutral hairline to `#8FAFC9` with a subtle outer glow blur (`3px`).