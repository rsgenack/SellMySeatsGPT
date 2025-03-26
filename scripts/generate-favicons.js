import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const sizes = [
  { size: 16, name: 'favicon-16x16.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 192, name: 'android-chrome-192x192.png' },
  { size: 512, name: 'android-chrome-512x512.png' }
];

const sourceIcon = path.join(process.cwd(), 'public', 'generated-icon.png');
const outputDir = path.join(process.cwd(), 'public');

async function generateFavicons() {
  try {
    console.log('Generating favicons...');
    
    // Generate each size
    for (const { size, name } of sizes) {
      console.log(`Generating ${name} (${size}x${size})...`);
      await sharp(sourceIcon)
        .resize(size, size)
        .toFile(path.join(outputDir, name));
    }
    
    // Generate favicon.ico (16x16 and 32x32 combined)
    console.log('Generating favicon.ico...');
    await sharp(sourceIcon)
      .resize(32, 32)
      .toFile(path.join(outputDir, 'favicon.ico'));
    
    console.log('✅ All favicons generated successfully!');
  } catch (error) {
    console.error('❌ Error generating favicons:', error);
    process.exit(1);
  }
}

generateFavicons(); 