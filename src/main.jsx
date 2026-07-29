import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { AuthProvider } from "./contexts/AuthContext";
import App from "./App";


async function enableMocking() {
  if (!import.meta.env.DEV || import.meta.env.VITE_MOCKING !== 'true') {
    return;
  }
  const { worker } = await import('./mocks/browser');
  return worker.start({
    onUnhandledRequest: 'bypass',
  });
}

async function removeStaleMockWorkers() {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const staleMockRegistrations = registrations.filter((registration) => (
      [registration.active, registration.waiting, registration.installing]
        .some((worker) => worker?.scriptURL.endsWith('/mockServiceWorker.js'))
    ));
    await Promise.all(staleMockRegistrations.map((registration) => registration.unregister()));
  } catch {
    // Service worker erişimi kapalıysa uygulama normal şekilde açılmaya devam eder.
  }
}

Promise.all([enableMocking(), removeStaleMockWorkers()]).then(() => {
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>
  );
});
