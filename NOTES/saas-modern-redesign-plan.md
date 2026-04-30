# SaaS Page Modern Redesign Plan

Branch: `saas-modern-redesign`

Base checkpoint: `3e2c281 Align course availability fields`

Goal: move `saas.html` toward the clean, modern visual direction shown in `Clean and Modern Final.png` while keeping the current production-ready page easy to recover from `main`.

## Revert Strategy

- Keep `main` as the stable current site.
- Do redesign work only on `saas-modern-redesign`.
- If the direction is not right, switch back to `main` or delete the branch.
- If the direction is right, merge after desktop/mobile verification.

## Implementation Slices

### 1. Visual Foundation

- Audit the current `saas.html` structure and CSS.
- Establish shared section/card/button styles for the modern look:
  - white cards
  - soft blue-gray page background
  - stronger but restrained shadows
  - rounded panels
  - blue/green accent system
  - consistent spacing and typography
- Keep changes scoped to the public SaaS page assets.

### 2. Hero Section

- Rebuild the hero to match the target composition:
  - left: eyebrow, headline, support copy, CTAs, trust bullets
  - right: warm homeschool image plus dashboard/product proof area
- Preserve real CTA behavior for subscription and plan comparison.
- Verify headline wrapping across desktop, tablet, and mobile.

### 3. Top Value Cards

- Replace the current early content band with three polished cards:
  - Family Homeschools
  - Small Learning Groups & Co-ops
  - Navigrader solution summary
- Add small icons and concise benefit lists.
- Keep copy readable without making the section feel dense.

### 4. Joy / Image Band

- Create the blue title strip and three-image horizontal band.
- Use existing or approved family/homeschool images.
- Add compact benefit captions below each image.
- Ensure the band stacks cleanly on mobile.

### 5. Why It Helps + Signup Panel

- Rework the `Why It Helps` feature grid into compact icon cards.
- Pair it with the get-started/subscription panel on larger screens.
- Keep current pricing plan content and checkout behavior intact.
- Preserve the right-side emotional copy/photo tile, but polish spacing and typography.

### 6. How It Works + FAQ

- Make the process cards more visual and compact.
- Convert FAQ into small icon cards matching the target.
- Keep all approved FAQ questions and answers.

### 7. Final CTA

- Rebuild the bottom CTA as a wide polished panel:
  - left: final headline, supporting text, CTA buttons, logo
  - right: product screenshot/dashboard/report collage
- Use existing screenshots unless new approved assets are provided.

### 8. Responsive Verification

- Check desktop, tablet, and mobile widths.
- Verify no text overlap, clipped CTAs, broken image ratios, or awkward headline wrapping.
- Confirm all buttons still navigate correctly.

### 9. Deployment / Merge

- Deploy branch build only after visual approval.
- Keep `main` untouched until the redesign is accepted.
- Merge to `main`, deploy, then tag or record the final commit.

## Notes

- This is a layout and style redesign, not a billing/provisioning change.
- Stripe price IDs and checkout behavior should not be changed in this effort.
- The current production page remains recoverable from `main`.
