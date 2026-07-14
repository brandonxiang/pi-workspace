import React from "react";
import { createRoot } from "react-dom/client";
import { Website } from "./Website";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Website />
  </React.StrictMode>,
);
