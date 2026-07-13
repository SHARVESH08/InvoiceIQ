/** @type {import('next').NextConfig} */
const nextConfig = {
  // @react-pdf/renderer ships its own reconciler (@react-pdf/reconciler).
  // If Next bundles it into the Server Components graph it gets linked against
  // a second copy of React, so renderToBuffer rejects the JSX elements with
  // "Minified React error #31". Loading it via native Node require keeps it on
  // the single installed React (19), matching the rest of the app.
  serverExternalPackages: ['@react-pdf/renderer'],
};

export default nextConfig;
