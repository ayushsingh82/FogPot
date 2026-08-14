/** @type {import('next').NextConfig} */
const nextConfig = {
  // @inco/js's bundled deps trip an SWC minifier panic
  // (FRACTIONAL_BITWISE_OPERAND) when compiled for the client; Terser handles it fine.
  swcMinify: false,
};

module.exports = nextConfig;
