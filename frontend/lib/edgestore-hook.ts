import { EdgeStoreApiClientError } from '@edgestore/react/shared';

export async function uploadImageToEdgeStore(image: File, edgestore: any) {
  const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const MAX_FILE_SIZE_MB = 5;
  const sanitizeFileName = (name: string) => {
    return name.replace(/[^a-zA-Z0-9.\-_]/g, '_'); // Replace any invalid characters
  };
  const sanitizedFileName = sanitizeFileName(image.name);
  
  if (!ALLOWED_FILE_TYPES.includes(image.type)) {
      throw new Error('Invalid file type. Allowed types are .jpg, .jpeg, .png, .gif, .webp');
  }
  const sanitizedFile = new File([image], sanitizedFileName, { type: image.type });

  if (sanitizedFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(`File size exceeds the maximum allowed size of ${MAX_FILE_SIZE_MB}MB.`);
  }
  

  try {
    const res = await edgestore.myPublicImages.upload({
      file: sanitizedFile,
      options: {
        temporary: true
      },
      onProgressChange: (progress) => {
        console.log('Upload Progress:', progress);
      },
    });
    return res.url;
  } catch (error) {
    if (error instanceof EdgeStoreApiClientError) {
      console.error('EdgeStoreApiClientError:', error);
    }
    throw new Error('Failed to upload image');
  }
}