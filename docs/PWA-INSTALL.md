# PWA installation — 26/10/2026

The landing-page install action opens https://app.goease.com.vn/install/.
Source lives in `client/public/install/`; Vite copies it unchanged into the
production artifact. This public installation screen shares the application's
root manifest identity and service worker. No account or database change is needed.

The install button appears when `beforeinstallprompt` is available and calls its
`prompt()` directly from a user click. A browser prompt cannot be initiated on the
landing origin for the app origin, and a second click on the installation screen
is required. Dismissal and prompt errors retain browser-menu instructions. An
accepted prompt is shown as pending until `appinstalled`; standalone mode hides
the install action. iPhone/iPad gets Safari Share → Add to Home Screen instructions.
Unsupported and embedded browsers receive menu/open-in-browser guidance.

The three static installation files were published to the existing VPS static
root. The API, environment and database were not redeployed. Future client builds
include these files automatically. The current offline-reader service worker does
not cache this installation page or the application's private responses.

Verified: JavaScript syntax, focused ESLint, formatting; live HTTPS page returns
200; persistent Edge reports no manifest or installability errors. At 375×812 no
horizontal overflow or page errors. Browser-event simulations check prompt-on-click,
dismissal, acceptance pending, appinstalled, iOS guidance and standalone state.
These simulations do not confirm an actual OS installation. Physical Android and
iPhone installation remain for the owner to test.

Browser API reference: [MDN installation flow](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt).
