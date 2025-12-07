/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        MONGODB_URI: process.env.MONGODB_URI,
    }
};

export default nextConfig;
