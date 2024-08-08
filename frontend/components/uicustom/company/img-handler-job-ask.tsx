import { EdgeStoreApiClientError } from '@edgestore/react/shared';

export async function ImageHandlerJobAsk(image: File, edgestore: any) {
  console.log('ImageHandlerJobAsk: IMAGE: ', image);
  let imgUrl;

  try {
    if (image) {
      const res = await edgestore.myPublicImages.upload({
        file: image,
        onProgressChange: (progress: any) => {
          // you can use this to show a progress bar
          console.log('UPLOAD PROGRESS', progress);
        },
      });
      console.log('ImageHandlerJobAsk: IMAGE.RES url', res.url);
      imgUrl = res.url;
    }
  } catch (error) {
    if (error instanceof EdgeStoreApiClientError) {
      console.error('ImageHandlerJobAsk: EdgeStoreApiClientError', error);
    }
  }

  return imgUrl;
}