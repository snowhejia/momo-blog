import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SiteProvider } from "./store";
import { MusicProvider } from "./components/Music";
import App from "./App";
import "./styles.css";
import "./themes.css";
import "./themes/retro.css";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SiteProvider>
      <MusicProvider>
        <App />
      </MusicProvider>
    </SiteProvider>
  </StrictMode>,
);
