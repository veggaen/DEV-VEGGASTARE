import { initEdgeStore } from '@edgestore/server';
import { createEdgeStoreNextHandler } from '@edgestore/server/adapters/next/app';
import { auth } from '@/auth';

type Context = {
  userId: string;
  role: string;
};

// Create EdgeStore builder with context
// Note: userId and role must be strings (not null) for EdgeStore validation
const es = initEdgeStore.context<Context>().create();

// Allowed file extensions for digital products
const DIGITAL_PRODUCT_EXTENSIONS = [
  // Images
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico',
  // Documents
  'pdf', 'doc', 'docx', 'txt', 'rtf', 'odt',
  // Archives
  'zip', 'rar', '7z', 'tar', 'gz',
  // Code/Data
  'json', 'xml', 'csv', 'html', 'css', 'js', 'ts',
  // Audio (small files)
  'mp3', 'wav', 'ogg', 'flac',
  // Video (small files)
  'mp4', 'webm', 'mov',
  // Fonts
  'ttf', 'otf', 'woff', 'woff2',
  // Other
  'psd', 'ai', 'sketch', 'fig',
];
 
/**
 * This is the main router for the Edge Store buckets.
 */
const edgeStoreRouter = es.router({
  // Public images (product photos, logos, etc.)
  myPublicImages: es.fileBucket(),
  
  // Protected digital assets (downloadable products)
  // Only authenticated users can upload to this bucket
  // Files are protected and require valid access through our download endpoint
  digitalAssets: es.fileBucket({
    maxSize: 1024 * 1024 * 100, // 100MB max file size
    accept: DIGITAL_PRODUCT_EXTENSIONS.map(ext => `.${ext}`),
  })
    .path(({ ctx }) => [{ owner: ctx.userId || 'anonymous' }])
    .accessControl({
      OR: [
        // Allow the owner (uploader) to access their files
        { userId: { path: 'owner' } },
        // Allow system access for download endpoint
        { role: { eq: 'ADMIN' } },
      ],
    })
    .beforeUpload(({ ctx }) => {
      // Only allow authenticated users to upload digital assets
      if (!ctx.userId || ctx.userId === 'anonymous') {
        return false;
      }
      return true;
    }),
});
 
const handler = createEdgeStoreNextHandler({
  router: edgeStoreRouter,
  createContext: async () => {
    const session = await auth();
    return {
      // EdgeStore requires string values, use 'anonymous'/'GUEST' for unauthenticated users
      userId: session?.user?.id ?? 'anonymous',
      role: session?.user?.role ?? 'GUEST',
    };
  },
});
 
export { handler as GET, handler as POST };
 
/**
 * This type is used to create the type-safe client for the frontend.
 */
export type EdgeStoreRouter = typeof edgeStoreRouter;