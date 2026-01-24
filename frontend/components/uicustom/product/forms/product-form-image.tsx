import { EdgeStoreApiClientError } from '@edgestore/react/shared';

// NOTE: This is a plain async helper (not a React component / hook).
// Call it from a client component where you already have access to `edgestore`.
export async function ImageHandeler(image: File, edgestore: any) {
  console.log('MyCreateProductAction: IMAGE: ', image);
  let imgUrl;

  try {
    if (image) {
      const res = await edgestore.myPublicImages.upload({
        file: image,
        onProgressChange: (progress: number) => {
          // you can use this to show a progress bar
          console.log('UPLOAD PROGRESS', progress);
        },
      });
      console.log('MyCreateProductAction: IMAGE.RES url', res.url);
      imgUrl = res.url;
    }
  } catch (error) {
    if (error instanceof EdgeStoreApiClientError) {
      console.error('MyCreateProductAction: EdgeStoreApiClientError', error);
    }
  }

  return imgUrl;
}