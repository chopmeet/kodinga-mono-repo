// Split out of input.tsx so its heavy dependency (and CSS) is only bundled when this input is used.
import makeAnimated from "react-select/animated";

/** react-select components with enter/leave animations */
export const animatedComponents = makeAnimated();
