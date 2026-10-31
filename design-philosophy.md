# QNTX Design Philosophy

### Data-First 

All interface decisions prioritize data visibility and accessibility over aesthetic concerns.

- Maximize meaningful information density per screen
- Present information in scannable, structured formats
- Visual hierarchy emphasizes content over navigation or decoration
- Use the established symbols (see [Glossary](https://github.com/teranos/QNTX/blob/main/docs/GLOSSARY.md)) for semantic meaning
- Interactive filtering and navigation

## Design Decision Framework

When making interface decisions, evaluate in this order:

1. **Does this improve data access?**
2. **Does this reduce cognitive load?**
3. **Does this improve performance?**
4. **Does this maintain consistency?**
5. **Does this still work on mobile?**

## Implementation Standards

- **Semantic HTML**: Use appropriate elements for their intended purpose
- **System fonts**: Leverage OS defaults for performance and familiarity
- **Functional color**: Color conveys status or type information, not decoration
- **Professional text**: No emojis in user-facing UI elements (buttons, labels, headings, notifications) - Use symbols
- **Accessibility**: Meet WCAG guidelines for inclusive access (keyboard navigation, screen-reader compatibility)

The goal is consistent application of principles that serve users' needs for efficient, data-focused tools.

## Inspiration: The Food Lab Approach

This design philosophy draws inspiration from J. Kenji López-Alt's *The Food Lab: Better Home Cooking Through Science* - applying the same principles of scientific method, transparent process, and data-driven decision-making to interface design.

**Core parallels:**

- **Measure, don't guess**: Like testing temperature and timing in cooking, we validate design decisions with performance metrics and usage patterns
- **Understand the why**: Just as The Food Lab explains *why* techniques work (not just *what* to do), our interfaces expose the underlying data and logic rather than hiding it behind abstractions
- **Function over tradition**: The Food Lab questions conventional wisdom in cooking; we question conventional UI patterns that prioritize aesthetics over data access
- **Reproducible results**: Scientific cooking requires consistent technique; our semantic symbols and patterns create consistent, predictable interfaces

The best interface, like the best recipe, is one that serves its purpose efficiently while revealing its own workings.
