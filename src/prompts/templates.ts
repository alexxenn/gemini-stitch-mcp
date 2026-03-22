import type { Framework, Styling } from "../types.js";

export function getConversionTemplate(
  html: string,
  framework: Framework,
  styling: Styling
): string {
  const frameworkInstructions = FRAMEWORK_INSTRUCTIONS[framework];
  const stylingInstructions = STYLING_INSTRUCTIONS[styling];

  return `Convert the following HTML design (which may contain inline <style> blocks) into a ${framework} component using ${styling} for styling.

${frameworkInstructions}

${stylingInstructions}

=== SOURCE HTML ===
${html}

=== END SOURCE ===

Return ONLY the component code, no explanations or markdown fences.`;
}

const FRAMEWORK_INSTRUCTIONS: Record<Framework, string> = {
  react: `React Component Requirements:
- Use functional component with TypeScript
- Use React.FC or explicit return type
- Define a Props interface for all customizable properties
- Use useState/useEffect hooks as needed
- Export the component as default export
- Name the component based on its purpose (e.g., LoginForm, HeroSection)`,

  vue: `Vue 3 Component Requirements:
- Use <script setup lang="ts"> syntax
- Define props with defineProps<T>() using TypeScript interface
- Use defineEmits for events
- Use ref() and computed() for reactive state
- Structure: <script setup>, <template>, <style scoped>`,

  html: `HTML Component Requirements:
- Clean, semantic HTML5
- Self-contained with <style> block
- Use CSS custom properties for theming
- Add data attributes for JavaScript hooks
- Include a brief comment at the top describing the component`,
};

const STYLING_INSTRUCTIONS: Record<Styling, string> = {
  tailwind: `Tailwind CSS Styling:
- Use Tailwind utility classes directly in the markup
- Use responsive prefixes (sm:, md:, lg:) for breakpoints
- Use dark: prefix for dark mode variants
- Avoid @apply in most cases — prefer inline utilities
- Use arbitrary values [value] sparingly`,

  css: `CSS Modules / Plain CSS Styling:
- Use CSS modules naming convention (.container, .header, etc.)
- Use CSS custom properties for theme values
- Use CSS Grid and Flexbox for layout
- Include media queries for responsive design
- Use BEM naming convention for class names`,

  "styled-components": `Styled Components Styling:
- Define styled components above the main component
- Use template literals for dynamic styles based on props
- Use the css helper for shared style fragments
- Use ThemeProvider pattern for theming
- Export styled components that consumers might want to override`,
};

export function getIterationTemplate(
  previousCode: string,
  feedback: string,
  html: string,
  framework: Framework,
  styling: Styling
): string {
  return `You previously generated this ${framework} component:

=== PREVIOUS CODE ===
${previousCode}

=== UPDATED DESIGN HTML ===
${html}

=== FEEDBACK ===
${feedback}

Apply the feedback and incorporate any changes from the updated design. Use ${styling} for styling.
Return ONLY the updated component code, no explanations or markdown fences.`;
}
