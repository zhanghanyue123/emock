import nextVitals from "eslint-config-next/core-web-vitals";

const nextConfig = Array.isArray(nextVitals) ? nextVitals : [nextVitals];

const config = [
  {
    ignores: [".next/**", "node_modules/**", ".reference-repos/**", "public/content/**"]
  },
  ...nextConfig,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off"
    }
  }
];

export default config;
