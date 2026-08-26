import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
import { routes } from './app/routing';

const root = createRoot(document.getElementById("root")!);
root.render(
  <App
    routes={routes}
  />
);