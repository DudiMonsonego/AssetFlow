/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/settings",          destination: "/dashboard/settings",     permanent: true },
      { source: "/settings/profile",  destination: "/dashboard/settings",     permanent: true },
      { source: "/settings/app",      destination: "/dashboard/settings",     permanent: true },
      { source: "/organization",      destination: "/dashboard/organization", permanent: true },
      { source: "/team",              destination: "/dashboard/team",         permanent: true },
      { source: "/assets",            destination: "/dashboard/assets",       permanent: true },
      { source: "/maintenance",       destination: "/dashboard/maintenance",  permanent: true },
    ];
  },
};

export default nextConfig;
