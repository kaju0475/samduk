# Prompt: Implement PWA Native-Like "Double Back to Exit" & Secure Logout

## Objective

Enhance the Next.js PWA experience to mimic native Android application behavior regarding navigation and security.

1.  **Double Back to Exit:** When on the **Login Screen**, pressing the hardware "Back" button should NOT immediately navigate back. Instead, it should show a toast message ("Press back again to exit"). If pressed again within 2 seconds, the app should exit (or close the window).
2.  **Secure Logout (History Clearing):** When a user logs out, they should be redirected to the Login Screen. Crucially, the history stack should be managed such that pressing "Back" from the Login Screen does **not** return to the previous protected page (or if it does, it immediately redirects back to login without flashing sensitive data).

## Context

- **Framework:** Next.js (App Router)
- **UI Library:** Mantine UI (for Toasts/Modals)
- **Environment:** PWA (Progressive Web App) running on Android/iOS/Desktop.

## Requirements

### 1. `useDoubleBackExit` Hook (Custom Hook)

Create a hook `useDoubleBackExit.ts` that is only active on the `/login` page.

- **Mechanism:**
  - When the component mounts, push a _dummy_ state to history: `window.history.pushState(null, '', window.location.href)`. This "traps" the back button.
  - Listen for the `popstate` event.
  - **First Back Press:**
    - Check if a `exitToastVisible` flag is true.
    - If `false`: Set the flag to true, show a Toast ("뒤로가기 버튼을 한번 더 누르면 종료됩니다"), and _re-push_ the dummy state to maintain the trap.
    - Start a 2-second timer to reset the flag.
  - **Second Back Press (within 2s):**
    - Allow the `popstate` to happen (removing the dummy state).
    - Execute `window.close()` (Note: This only works if the script opened the window, but in PWA standalone mode, it often works or minimizes the app).
    - Alternatively, if `window.close()` fails, redirect to a "Good Bye" or blank page to simulate exit.

### 2. Secure Logout Lgoic

Refine the `handleLogout` function in `components/Layout/AppHeader.tsx` or `sidebar`.

- **Action:**
  - Call `supabase.auth.signOut()`.
  - **Clear Cache:** Call `router.refresh()` to invalidate server data.
  - **Redirect:** Use `window.location.replace('/login')` instead of `router.push()`. This replaces the current history entry, making it harder to go "Back" to the dashboard.
  - _Note on History API:_ Browsers do not allow clearing the _entire_ history stack via JS for privacy reasons. However, `replace` ensures we don't build a stack forward.
  - **Route Protection:** Ensure `middleware.ts` or the generic Layout wrapper checks for `session`. If no session, immediately redirect to `/login`. This ensures that even if the user manages to go "Back", they bounce right back to Login.

## Deliverables

1.  **`hooks/useDoubleBackExit.ts`**: The core logic hook.
2.  **`app/login/page.tsx`**: Update the login page to use this hook.
3.  **`app/components/LogoutButton.tsx`**: Enhanced logout logic implementation.

## Tech Stack Constraints

- Use `useEffect` for window event listeners.
- Use `@mantine/notifications` for the toast message.
- Handle TypeScript types properly.

---

_Please generate the code following these specifications._
