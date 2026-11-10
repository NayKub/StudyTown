// The little wooden board above each shop, with a drawn icon instead of text.
import { ctx } from './canvas.js';
import { roundRect, circle } from './primitives.js';
import { hash } from '../core/city.js';

const BOARD_W = 24;
const BOARD_H = 16;

/** Each icon is drawn around (x, y), the centre of the board. */
const ICONS = {
  cupcake(x, y) {
    ctx.fillStyle = '#7fa8ff'; // paper cup
    ctx.beginPath();
    ctx.moveTo(x - 4.5, y);
    ctx.lineTo(x + 4.5, y);
    ctx.lineTo(x + 3, y + 5);
    ctx.lineTo(x - 3, y + 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffc4d6'; // frosting
    ctx.beginPath();
    ctx.arc(x - 2.5, y - 0.5, 2.6, 0, 7);
    ctx.arc(x + 2.5, y - 0.5, 2.6, 0, 7);
    ctx.arc(x, y - 2.8, 2.8, 0, 7);
    ctx.fill();
    circle(x, y - 5.6, 1.4, '#ff4d6d'); // cherry
  },
  coffee(x, y) {
    ctx.fillStyle = '#fff'; // cup
    roundRect(x - 4.5, y - 3, 8, 7, 2);
    ctx.fill();
    ctx.strokeStyle = '#a8754f';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath(); // handle
    ctx.arc(x + 4, y + 0.5, 2, -1.4, 1.4);
    ctx.stroke();
    ctx.fillStyle = '#8a5a3c'; // coffee
    ctx.fillRect(x - 3.5, y - 2, 6, 1.6);
    ctx.strokeStyle = 'rgba(168,117,79,.7)'; // steam
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x - 2, y - 4);
    ctx.quadraticCurveTo(x - 3, y - 5.5, x - 1.5, y - 6.5);
    ctx.moveTo(x + 1, y - 4);
    ctx.quadraticCurveTo(x, y - 5.5, x + 1.5, y - 6.5);
    ctx.stroke();
  },
  flower(x, y) {
    ctx.fillStyle = '#ff8fab'; // petals
    for (let k = 0; k < 5; k++) {
      const a = k * 1.2566 - 1.57;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 3, y - 1 + Math.sin(a) * 3, 2.2, 0, 7);
      ctx.fill();
    }
    circle(x, y - 1, 1.8, '#ffd36e');
    ctx.strokeStyle = '#5fbf6e'; // stem
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y + 2);
    ctx.lineTo(x, y + 6);
    ctx.stroke();
  },
  icecream(x, y) {
    ctx.fillStyle = '#e9b77a'; // cone
    ctx.beginPath();
    ctx.moveTo(x - 3.2, y);
    ctx.lineTo(x + 3.2, y);
    ctx.lineTo(x, y + 6.5);
    ctx.closePath();
    ctx.fill();
    circle(x, y - 1, 3.6, '#b8e6b0');
    circle(x, y - 4, 2.8, '#ffc4d6');
    circle(x + 0.5, y - 6.6, 1.2, '#ff4d6d');
  },
};
const ICON_NAMES = ['cupcake', 'coffee', 'flower', 'icecream'];

/** x = centre of the shop, top = y of its roof. The icon is picked from the shop's seed, so it never changes. */
export function shopSign(x, top, seed, night, now) {
  const icon = ICON_NAMES[Math.floor(hash(seed, 5, 9) * ICON_NAMES.length)];
  const sway = Math.sin(now / 900 + seed) * 0.04;
  const by = top - 24; // top edge of the board
  const midY = by + BOARD_H / 2;

  ctx.fillStyle = '#8a5a3c'; // two posts
  ctx.fillRect(x - 8, by + BOARD_H - 2, 2.5, 10);
  ctx.fillRect(x + 5.5, by + BOARD_H - 2, 2.5, 10);

  ctx.save();
  ctx.translate(x, midY);
  ctx.rotate(sway);
  ctx.translate(-x, -midY);

  // board with a darker rim and two wood-grain lines
  roundRect(x - BOARD_W / 2 - 1.5, by - 1.5, BOARD_W + 3, BOARD_H + 3, 5);
  ctx.fillStyle = '#a8754f';
  ctx.fill();
  roundRect(x - BOARD_W / 2, by, BOARD_W, BOARD_H, 4);
  ctx.fillStyle = night ? '#f3d9a8' : '#ffe2b0';
  ctx.fill();
  ctx.strokeStyle = 'rgba(168,117,79,.25)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x - BOARD_W / 2 + 3, by + 5.5);
  ctx.lineTo(x + BOARD_W / 2 - 3, by + 5.5);
  ctx.moveTo(x - BOARD_W / 2 + 3, by + 11);
  ctx.lineTo(x + BOARD_W / 2 - 3, by + 11);
  ctx.stroke();

  // tiny pink bow on top
  ctx.fillStyle = '#ff8fab';
  ctx.beginPath();
  ctx.ellipse(x - 3, by - 1.5, 3, 2, -0.4, 0, 7);
  ctx.ellipse(x + 3, by - 1.5, 3, 2, 0.4, 0, 7);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, by - 1.5, 1.4, 0, 7);
  ctx.fillStyle = '#e86d8d';
  ctx.fill();

  ICONS[icon](x, midY + 0.5);
  ctx.restore();
}
