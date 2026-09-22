/** @fileOverview Produce bounded public previews without publishing the downloadable original. @stability stable */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const source = fileURLToPath(new URL('../.private-showcase/fjord-study.png', import.meta.url));
const output = fileURLToPath(new URL('../public/showcase/', import.meta.url));
await mkdir(output, { recursive: true });
await sharp(source).resize({ width: 960, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(`${output}/fjord-study-preview.jpg`);
await sharp(source).resize({ width: 640, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(`${output}/fjord-study-small.jpg`);
for (const name of ['credits-cover', 'interview-pack-contents']) {
  await sharp(`${output}/${name}.svg`).jpeg({ quality: 88, mozjpeg: true }).toFile(`${output}/${name}.jpg`);
}
// Private delivery copy, not a public image route or a repository asset.
await sharp(source).jpeg({ quality: 95, mozjpeg: true }).toFile(fileURLToPath(new URL('../.private-showcase/fjord-study.jpg', import.meta.url)));
console.log('Prepared public 960/640px previews and a private full-resolution JPG.');
