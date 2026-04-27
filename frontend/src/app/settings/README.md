# Settings Module

A modular and maintainable settings interface for the price quoter application.

## Architecture

The settings module is organized into several modular components for better maintainability, reusability, and testing:

### Components (`./components/`)

- **`settings.tsx`** - Main container component that orchestrates all child components
- **`settings-header.tsx`** - Header with title, description, and action buttons (Save/Reset)
- **`quoting-parameters.tsx`** - Configuration for price quoter parameters (numeraire, probing depth, max hops, TVL filter)
- **`gas-configuration.tsx`** - Gas-related settings (gas price, gas inclusion toggle, estimation display)
- **`tracked-tokens.tsx`** - Token management interface (add/remove tracked tokens)

### Hooks (`./hooks/`)

- **`use-settings.ts`** - Custom hook that manages all settings state and business logic
  - Configuration state management
  - Tracked tokens state management
  - Save/Reset functionality
  - Unsaved changes tracking

### Benefits of This Structure

1. **Modularity**: Each component has a single responsibility
2. **Reusability**: Components can be easily reused or moved to different pages
3. **Testability**: Smaller components are easier to unit test
4. **Maintainability**: Changes to one section don't affect others
5. **Type Safety**: Strong TypeScript interfaces ensure prop consistency
6. **Clean Separation**: UI logic is separated from business logic (hooks)

### Usage

```tsx
import { Settings } from './components';

// The main Settings component handles all orchestration
export default function SettingsPage() {
  return <Settings />;
}
```

### Extending the Module

To add new settings sections:

1. Create a new component in `./components/`
2. Add any new state/logic to the `useSettings` hook
3. Import and use in the main `Settings` component
4. Export from `./components/index.ts`

### State Management

All state is managed through the `useSettings` hook, which provides:

- **State**: `config`, `trackedTokens`, `hasUnsavedChanges`, `numeraireOptions`
- **Actions**: `handleConfigChange`, `handleSaveSettings`, `handleResetSettings`, `addTrackedToken`, `removeTrackedToken`

This centralized approach ensures consistency and makes testing easier. 