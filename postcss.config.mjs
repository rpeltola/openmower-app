// Tailwind v4's PostCSS plugin. Scoped in practice to the /v2 subtree: the only stylesheet
// that imports "tailwindcss" utilities is src/app/v2/tailwind.css, loaded solely by the v2
// route group's layout. v1 (MUI) never imports it, so this plugin has nothing to process
// outside v2.
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
