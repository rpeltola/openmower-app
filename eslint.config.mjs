import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  // Raw <button> is only allowed inside the v2 component kit (src/components/v2/ui/**), which
  // owns native-button chrome handling (preflight is omitted). Everywhere else in v2, use the
  // <Button> component or a kit component — never a raw <button>.
  {
    files: ["src/components/v2/**/*.tsx", "src/app/v2/**/*.tsx"],
    ignores: ["src/components/v2/ui/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name='button']",
          message:
            "Raw <button> is not allowed here — use the <Button> component (or a kit component from components/v2/ui). Raw <button> belongs only in components/v2/ui/**, which handles native-button chrome.",
        },
      ],
    },
  },
];

export default eslintConfig;
