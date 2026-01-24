// @ts-check
 
/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
    webpack: (config) => {
        config.externals.push("pino-pretty", "lokijs", "encoding");

        // Some wallet SDKs pull in optional React-Native deps even for web builds.
        // We don't use RN storage in the browser, so alias it out to prevent build errors.
        config.resolve.alias = {
            ...(config.resolve.alias || {}),
            "@react-native-async-storage/async-storage": false,
        };

        return config;
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    images: {
        remotePatterns: [
            {
              protocol: 'https',
              hostname: 'images.unsplash.com',
              port: '',
              pathname: '**',
            },
            {
              protocol: 'https',
              hostname: 'cloudflare-ipfs.com',
              port: '',
              pathname: '**',
            },
            {
              protocol: 'https',
              hostname: 'loremflickr.com',
              port: '',
              pathname: '**',
            },
            {
                protocol: 'https',
                hostname: 'unsplash.com',
                port: '',
                pathname: '**',
            },
            {
                protocol: 'https',
                hostname: 'wepik.com',
                port: '',
                pathname: '**',
            },
            {
                protocol: 'https',
                hostname: 'avatars.githubusercontent.com',
                port: '',
                pathname: '**',
            },
            {
                protocol: 'https',
                hostname: 'files.edgestore.dev',
                port: '',
                pathname: '**',
            },
            {
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com',
                port: '',
                pathname: '**',
            },
            {
                protocol: 'http',
                hostname: 'localhost',
                port: '3001',
                pathname: '**',
            },
            {
                protocol: 'http',
                hostname: 'localhost',
                port: '3002',
                pathname: '**',
            },
            {
                protocol: 'http',
                hostname: 'localhost:3002/events',
                port: '3002',
                pathname: '**',
            },
            {
                protocol: 'http',
                hostname: 'wss://ws-eu.pusher.com/app/692749F746AD7FD1178DC19BF658BDC9D5E05C3C8C3B91A818686EDBBF7F743A?protocol=7&client=js&version=8.4.0-rc2&flash=false',
                port: '*',
                pathname: '**',
            },
            {
                protocol: 'http',
                hostname: 'wss://api.mainnet-beta.solana.com/',
                port: '*',
                pathname: '**',
            }
        ],
    },
};

export default nextConfig;
