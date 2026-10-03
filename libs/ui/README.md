# ui

Shared UI kit for the monorepo: [shadcn/ui](https://ui.shadcn.com) components (style **new-york**, **Radix** primitives, Lucide icons) and the Tailwind CSS theme.

## Use it in an app

```tsx
import { Button, Card, cn } from '@kodinga-mono-repo/ui';
```

Import the theme once in the app's global stylesheet (path relative to that file):

```css
@import '../../../libs/ui/src/styles.css';
```

The app's `tsconfig.json` must also list the lib in `paths`, because `paths` there replaces (does not merge with) `tsconfig.base.json`:

```json
"@kodinga-mono-repo/ui": ["../../libs/ui/src/index.ts"]
```

## Add a component (manual install)

1. On ui.shadcn.com, open the component, **Manual** tab, Radix variant.
2. Install the listed dependencies at the repo root: `npm install <pkg>`.
3. Paste the code into `src/components/<name>.tsx`.
4. Rewrite its `@/...` imports to relative ones:
   - `@/components/ui/button` → `./button`
   - `@/lib/utils` → `../lib/utils`
   - `@/hooks/use-mobile` → `../hooks/use-mobile`
5. Export it from `src/index.ts`.
