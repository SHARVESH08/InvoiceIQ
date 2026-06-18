/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // @react-pdf/renderer ships its own React 19-based reconciler (@react-pdf/reconciler).
  // If Next bundles it into the Server Components graph it gets linked against a
  // different React than the app's react@18, so renderToBuffer rejects the JSX
  // elements with "Minified React error #31". Loading it via native Node require
  // keeps it on the single installed React 18, matching the rest of the app.
  serverExternalPackages: ['@react-pdf/renderer'],
};

export default nextConfig;
