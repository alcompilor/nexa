import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// Polyfills for secrets.js-grempe
import { Buffer } from "buffer";
(window as any).Buffer = Buffer;

import process from "process";
(window as any).process = process;

createRoot(document.getElementById("root")!).render(<App />);
