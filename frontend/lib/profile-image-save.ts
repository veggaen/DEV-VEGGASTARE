/** @fileOverview Reuse a successful image upload when the subsequent profile write needs retry. @stability stable */
export async function saveProfileImage({ uploadedUrl, upload, remember, persist }: {
  uploadedUrl?: string;
  upload: () => Promise<{ url: string }>;
  remember: (url: string) => void;
  persist: (url: string) => Promise<void>;
}) {
  let url = uploadedUrl;
  if (!url) {
    url = (await upload()).url;
    if (!url) throw new Error('Image upload did not return a file');
    // Remember before the write: a failed/uncertain write can be retried with
    // the exact same URL without another storage charge or duplicate object.
    remember(url);
  }
  await persist(url);
  return url;
}
