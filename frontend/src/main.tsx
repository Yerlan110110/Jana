import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router";
import { Toaster } from "sonner";
import { queryClient } from "./lib/api";
import { Application } from "./app";
import { ApplicationBoundary } from "./components/application-boundary";
import "./index.css";

const router = createBrowserRouter([
  {
    path: "*",
    element: (
      <ApplicationBoundary>
        <Application />
        <Toaster position="bottom-right" closeButton richColors />
      </ApplicationBoundary>
    ),
  },
]);

const root = document.getElementById("root");
if (!root) throw new Error("Не найден корневой элемент приложения.");
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
