import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import * as THREE from 'three';

// Override deprecated decodeText method to use TextDecoder
THREE.LoaderUtils.decodeText = function (buffer: ArrayBuffer) {
  return new TextDecoder().decode(buffer);
};

createRoot(document.getElementById("root")!).render(<App />);