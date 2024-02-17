

import { EdgeStoreApiClientError } from '@edgestore/react/shared';
import { useEdgeStore, } from '@/lib/edgestore';

export async function ImageHandeler(image: File) {
  const { edgestore } = useEdgeStore();

    console.log('MyCreateProductAction: IMAGE: ', image);
    let imgUrl
    try {
        if (image) {
          const res = await edgestore.myPublicImages.upload({
            file: image,
            onProgressChange: (progress) => {
              // you can use this to show a progress bar
              console.log('UPLOAD PROGRESS',progress);
            },
          });
          console.log('MyCreateProductAction: IMAGE.RES url', res.url);
          imgUrl = res.url;
        }
      } catch (error) {
        if (error instanceof EdgeStoreApiClientError){
            console.error('MyCreateProductAction: EdgeStoreApiClientError', error);
        }
      }

    return imgUrl;

  
}