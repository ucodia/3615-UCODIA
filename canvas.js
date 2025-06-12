import fs from "fs";
import { registerFont, createCanvas } from "canvas";
registerFont("fonts/Righteous.ttf", { family: "Righteous" });
registerFont("fonts/Thirteen-Pixel-Fonts.ttf", { family: "Thirteen" });
registerFont("fonts/Vermin-Vibes-1989.ttf", { family: "VerminVibes" });

const canvas = createCanvas(200, 100);
const ctx = canvas.getContext("2d");

ctx.font = '32px "VerminVibes"';
ctx.fillText("3615", 16, 32);
ctx.fillText("SLICE", 16, 64);

const buffer = canvas.toBuffer("image/png");
fs.writeFileSync("output.png", buffer);
console.log("Image saved as output.png");
