#!/usr/bin/env node

/**
 * Generate placeholder images for development
 * This script creates SVG placeholders that can be replaced with real images later
 *
 * Usage: node scripts/generate-placeholders.js
 */

import fs from "fs";
import path from "path";

const placeholders = [
  {
    path: "public/images/features/tracking.svg",
    width: 400,
    height: 300,
    text: "Tracking",
  },
  {
    path: "public/images/features/budgets.svg",
    width: 400,
    height: 300,
    text: "Budgets",
  },
  {
    path: "public/images/features/savings.svg",
    width: 400,
    height: 300,
    text: "Savings",
  },
  {
    path: "public/images/avatars/maria.svg",
    width: 200,
    height: 200,
    text: "MS",
  },
  {
    path: "public/images/avatars/james.svg",
    width: 200,
    height: 200,
    text: "JC",
  },
  {
    path: "public/images/avatars/aisha.svg",
    width: 200,
    height: 200,
    text: "AM",
  },
];

function generateSVG(width, height, text) {
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#e8b84b;stop-opacity:0.3;" />
      <stop offset="100%" style="stop-color:#4aa9e8;stop-opacity:0.3;" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="#1a1a2e"/>
  <rect width="${width}" height="${height}" fill="url(#grad)"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="24" fill="#e8edf8" text-anchor="middle" dominant-baseline="middle">${text}</text>
</svg>`;
}

console.log("🎨 Generating placeholder images...\n");

placeholders.forEach(({ path: filePath, width, height, text }) => {
  const dir = path.dirname(filePath);

  // Create directory if it doesn't exist
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }

  // Generate SVG content
  const svg = generateSVG(width, height, text);

  // Write file
  fs.writeFileSync(filePath, svg);
  console.log(`✅ Generated: ${filePath} (${width}x${height})`);
});

console.log("\n✨ All placeholder images generated successfully!");
console.log(
  "\n📝 Note: Replace these SVG placeholders with actual images for production.",
);
console.log("   Recommended formats: WebP, AVIF, or high-quality JPEG/PNG\n");
