# Spec: pi-workspace Official Website

## Status

Draft for human review. Implementation must not begin until this specification is approved.

## Assumptions

1. The official website is a separate static site and does not replace or alter the local workspace routes.
2. The public product name is `pi-workspace`, matching the npm package and installation command.
3. The first release supports English and Simplified Chinese with equal content coverage.
4. The primary conversion is copying an install command, not account creation, payment, or an online demo.
5. The site serves both developers new to Pi and existing Pi CLI users.
6. The site may reuse product screenshots and brand assets from this repository, but it does not expose local sessions, credentials, or provider keys.
7. Modern evergreen desktop and mobile browsers are the compatibility target.

## Objective

Create a distinctive, responsive official website that explains `pi-workspace` and moves a developer from first impression to a successful local install with minimal friction.

The page has one primary job: help a developer understand within the first viewport that `pi-workspace` turns Pi Agent sessions into a local, browser-based workspace for dialogue, session management, and terminal work, then let that developer copy the installation command.

### Primary audiences

- Developers evaluating coding-agent workspaces who need a concise explanation of Pi and the product's local-first workflow.
- Existing Pi CLI users who want a visual workspace that reuses their local authentication, models, sessions, and project context.

### User stories

- As a new visitor, I can understand what `pi-workspace` is without already knowing Pi.
- As an existing Pi user, I can see that my current credentials, models, and sessions continue to work.
- As a developer, I can copy the correct installation command from the hero and receive visible confirmation.
- As a Chinese or English reader, I can switch languages without losing my place on the page.
- As a mobile or keyboard user, I can navigate and use every interactive control.

## Product Positioning and Content

### Core statement

English: **Your Pi sessions, in one focused workspace.**

Chinese: **把你的 Pi Sessions，带进一个专注的工作台。**

Supporting copy should describe the product plainly: a local browser workspace for Pi Agent dialogue, session history, and a live terminal. Avoid presenting it as a generic consumer chat app or a cloud-hosted coding agent.

### Page structure

1. **Navigation** — wordmark, Features, Workflow, Open source, language switch, GitHub link.
2. **Hero** — positioning statement, concise supporting copy, copyable `npm exec -- pi-workspace` command, and a secondary text link to GitHub.
3. **Product stage** — a realistic product-window composition showing the session sidebar, streamed agent dialogue, and terminal as one coherent workspace.
4. **Three capabilities** — Continue sessions, Work in dialogue, Drop into the terminal. These are parallel capabilities, not artificially numbered steps.
5. **How it fits Pi** — a short flow from existing local Pi credentials and session storage to the browser workspace, explicitly stating that provider keys remain server-side/local.
6. **Local-first trust section** — reuse local auth and models; keep sessions on the user's machine; online chat starts without shell or file-mutation tools.
7. **Install close** — repeat the copyable command and link to the README/GitHub for requirements and development details.
8. **Footer** — package name, GitHub, npm, attribution to the Earendil Works Pi ecosystem, and language control.

### Content constraints

- English and Chinese must communicate the same facts; neither locale may contain sections missing from the other.
- Copy must distinguish `pi-workspace` from Pi Agent and describe a Session as the unit of work.
- Do not claim cloud sync, team collaboration, autonomous tool execution, sandboxing, pricing, or capabilities not present in the repository.
- Use real product UI and real feature names rather than generic dashboard placeholders.

## Visual Design

### Considered directions

1. **Workspace blueprint — selected.** A bright technical canvas, precise dark type, and cobalt/teal state signals. The product interface is treated as the main artifact, while fine routing lines connect Sessions, dialogue, and terminal. This is specific to the product's local workspace model and supports a developer audience without becoming a generic dark developer landing page.
2. **Terminal-first noir.** A nearly black page centered on command-line typography and neon output. It is immediately technical but underrepresents the product's calm visual workspace and resembles many existing developer-tool sites.
3. **Desktop editorial.** A warm, document-like layout with large editorial type and floating application panels. It feels approachable but risks borrowing too much from the current Notion-derived application language and weakens the installation focus.

### Selected direction: Workspace blueprint

The visual thesis is that scattered agent work becomes one navigable workspace. The hero's signature element is a live-looking **session path**: a thin line begins at a compact local Pi marker, crosses the installation command, and resolves into the product-window preview. It should read as one orchestrated composition, not decorative circuitry.

#### Color tokens

- `blueprint`: `#2457F5` — primary action and active path.
- `signal-teal`: `#16A394` — terminal/session status accents.
- `ink`: `#111318` — headings and high-emphasis content.
- `slate`: `#5A6270` — body copy and secondary labels.
- `paper`: `#F7F9FC` — page canvas with a restrained cool cast.
- `surface`: `#FFFFFF` — product windows and cards.

#### Typography

- Display and headings: **Manrope**, using tight spacing and 650–750 weight.
- Body and navigation: **Inter**, optimized for dense technical explanations.
- Commands, paths, and status labels: **IBM Plex Mono**.
- Fonts must be self-hosted or loaded with a resilient system fallback; text remains legible if web fonts fail.

#### Layout and motion

- Use a 12-column desktop grid, a maximum content width near 1200px, and a single-column mobile collapse.
- The hero uses an asymmetric split: copy and install action on the left, product stage breaking the right grid edge.
- The product window is the dominant proof point. Supporting sections remain quieter and use structure rather than decorative card grids.
- One page-load/scroll sequence may animate the session path into the product stage. Other motion is limited to command-copy feedback, button states, and subtle product-window transitions.
- `prefers-reduced-motion` removes path drawing and nonessential transitions.

## Tech Stack

- React 19 and TypeScript 7, matching the repository.
- Vite+ / Vite for development, testing, and static production build.
- Plain CSS with site-scoped design tokens; do not add a styling framework.
- Vitest and Testing Library-compatible DOM tests using the repository's current test environment.
- Static assets committed under the website source tree. No runtime CMS, database, analytics SDK, or server API in the first release.

## Commands

The implementation plan may refine script names, but the completed site must expose these full commands from the repository root:

```bash
vp install
vp run website:dev
vp run website:test
vp run website:check
vp run website:build
```

Repository-wide handoff verification remains:

```bash
vp check
vp test
npm run build
```

## Project Structure

```text
website/
  index.html                 Static site entry document
  src/
    main.tsx                 React mount and global providers
    Website.tsx              Page composition and locale state
    content.ts               Typed English and Chinese content
    components/              Focused navigation, install, product-stage, and section units
    styles/                  Tokens, global rules, and section styles
    assets/                  Product screenshots and site-owned visual assets
    *.test.tsx               Component and behavior tests beside their subjects
vite.website.config.ts       Independent website dev/test/build configuration
dist-website/                Generated static output; never edited by hand
docs/superpowers/specs/      Product and implementation specifications
tasks/                       Approved implementation plan and task checklist
```

The website must remain independently buildable. Its source must not be imported by the local workspace client, and its build must not overwrite `dist/client` or `dist-server`.

## Code Style

Use small typed components, semantic HTML, locale content outside JSX, and explicit event behavior. Names describe user-facing roles rather than visual appearance.

```tsx
type InstallCommandProps = {
  command: string;
  copiedLabel: string;
};

export function InstallCommand({ command, copiedLabel }: InstallCommandProps) {
  const [copied, setCopied] = useState(false);

  async function copyCommand() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
  }

  return (
    <button className="install-command" type="button" onClick={copyCommand}>
      <code>{command}</code>
      <span aria-live="polite">{copied ? copiedLabel : "Copy"}</span>
    </button>
  );
}
```

Conventions:

- Components and exported types use PascalCase; functions, variables, and CSS classes use clear semantic names.
- Keep content keys identical across locales and statically type them so missing translations fail type checking.
- Prefer native elements and CSS over introducing component-library dependencies into the website.
- Format and lint using the repository's Vite+ configuration.

## Interaction and Data Flow

- The selected locale initializes from a persisted user preference, then the browser language, then English.
- The language switch updates content in place, updates the document `lang`, and persists the choice locally. It does not navigate to another route.
- Copy controls use the Clipboard API and show an `aria-live` confirmation. A recoverable fallback selects the command text if clipboard access fails.
- Navigation links scroll to stable section anchors and preserve keyboard focus behavior.
- The website makes no application API calls and reads no Pi credentials, session files, or local workspace data.

## Error Handling

- If a web font fails, the specified fallback stack preserves the hierarchy.
- If clipboard access is unavailable or denied, the command remains selectable and the UI explains how to copy it manually.
- If optional visual media fails, descriptive alt text and surrounding copy continue to explain the product.
- Unsupported stored locale values fall back to browser language or English.

## Testing Strategy

### Automated tests

- Unit tests cover locale resolution, locale persistence, and translation completeness.
- Component tests cover language switching, document language updates, install-command copy success, clipboard failure fallback, and accessible labels.
- A render smoke test verifies that every required section and anchor exists in both locales.
- Production build verification confirms that the website emits to `dist-website` without changing the application build outputs.

### Browser verification

- Verify at desktop and mobile viewport widths in a real browser.
- Verify the initial hero, navigation anchors, command copy feedback, language switch, reduced-motion mode, and keyboard-only navigation.
- Check that the product stage remains readable without horizontal scrolling at 320px width.
- Confirm there are no console errors or failed local asset requests.

### Quality targets

- No automated percentage coverage threshold is introduced for the first release; every stateful behavior listed above must have a focused test.
- Target Lighthouse scores of at least 90 for Performance, Accessibility, Best Practices, and SEO on the built static page under desktop defaults.
- The page must have one `h1`, a descriptive title and meta description in the initial locale, visible focus states, and sufficient color contrast.

## Boundaries

### Always do

- Keep the website build independent from the local application build.
- Preserve semantic HTML, responsive behavior, keyboard access, visible focus, and reduced-motion support.
- Use truthful product claims derived from current repository behavior.
- Keep translation keys aligned and test both locales.
- Run website checks plus repository-wide `vp check`, `vp test`, and `npm run build` before handoff.

### Ask first

- Add or replace runtime dependencies.
- Add analytics, tracking, cookies, remote fonts, or third-party embeds.
- Change the npm install command, package name, repository URL, or product positioning.
- Change the existing application routes, output directories, release process, or npm package contents.
- Publish or deploy the site to an external host.

### Never do

- Expose provider keys, Pi credentials, local session contents, or personal workspace paths.
- Add a live shell, executable agent tools, or a simulated feature that visitors could mistake for a working cloud service.
- Claim unsupported collaboration, cloud synchronization, or security guarantees.
- Edit generated output or vendor directories by hand.
- Remove or weaken existing tests to make the website changes pass.

## Success Criteria

- The official site is an independently runnable and independently buildable static site in this repository.
- A first-time visitor can identify the product, its three core capabilities, and its local-first Pi relationship from the landing page.
- The hero exposes `npm exec -- pi-workspace` as the primary action and copies it with visible, accessible feedback.
- English and Simplified Chinese cover the same page structure and can be switched without navigation or reload.
- The site uses the approved Workspace blueprint direction and a real product-stage composition rather than generic SaaS cards.
- The complete page works at 320px width and desktop widths, with no unintended horizontal scroll.
- Keyboard navigation, focus visibility, reduced motion, alt text, heading order, and contrast pass manual review.
- Automated behavior tests, `vp check`, `vp test`, `vp run website:build`, and `npm run build` pass.
- Browser verification finds no console errors, failed local assets, or broken section links.
- Existing local workspace routes, server behavior, and npm package runtime remain unchanged.

## Open Questions

None for implementation planning. The final GitHub and npm URLs must be taken from verified project metadata during implementation; publishing/deployment remains out of scope.
