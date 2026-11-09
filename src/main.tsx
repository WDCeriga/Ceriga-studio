
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import { hydrateFontLibrary } from "./app/components/builder/printsStudio/designLibrary";

  // Restore imported typefaces for every editor, including labels and packaging.
  void hydrateFontLibrary();

  const markPointerFocus = () => {
    document.documentElement.dataset.focusOrigin = "pointer";
  };
  const markKeyboardFocus = (event: KeyboardEvent) => {
    if (event.key === "Tab") {
      document.documentElement.dataset.focusOrigin = "keyboard";
    } else if (event.key === "Delete" || event.key === "Backspace") {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("input, textarea, [contenteditable=true]")) markPointerFocus();
    }
  };
  document.addEventListener("pointerdown", markPointerFocus, true);
  document.addEventListener("keydown", markKeyboardFocus, true);
  if (import.meta.hot) import.meta.hot.dispose(() => {
    document.removeEventListener("pointerdown", markPointerFocus, true);
    document.removeEventListener("keydown", markKeyboardFocus, true);
  });
  createRoot(document.getElementById("root")!).render(<App />);
