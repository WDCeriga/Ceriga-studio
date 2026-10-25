
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import { hydrateFontLibrary } from "./app/components/builder/printsStudio/designLibrary";

  // Restore imported typefaces for every editor, including labels and packaging.
  void hydrateFontLibrary();

  createRoot(document.getElementById("root")!).render(<App />);
