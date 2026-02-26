import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import App from "./App";


async function enableMocking() {
  if (import.meta.env.VITE_MOCKING !== 'true') {
    console.log('Mocking disabled. Skipping MSW setup.');    
    return;
  }
  const { worker } = await import('./mocks/browser');
  console.log(import.meta.env.VITE_MOCKING, 'Mocking enabled. Starting MSW worker...');
  return worker.start({
    onUnhandledRequest: 'bypass', // Don't warn about unhandled requests
  });
}

enableMocking().then(() => {
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