import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts", "node_modules/**"],
    // Existing forms and async data-loading effects intentionally hydrate local state.
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
];

export default eslintConfig;
