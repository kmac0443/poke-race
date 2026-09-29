// Each half starts at its own title screen; any button goes on to picking who's playing.
import { Scene, text } from '../core/ui.js';
import { draw } from '../core/assets.js';
import { unlock, se } from '../core/audio.js';
import { KEY_LABELS } from '../core/input.js';
import { PlayerSelectScene } from './playerSelect.js';

export class TitleScene extends Scene {
  constructor() {
    super();
    this.opaque = true;
    this.music = 'Title.ogg';
    this.t = 0;
  }
  update(input) {
    this.t++;
    if (input.anyPressed()) {
      unlock();
      se('GUI sel decision');
      this.seat.push(new PlayerSelectScene());
    }
  }
  draw(g) {
    draw(g, 'ui/titles/title.png', 0, 0);
    // our name over the Essentials wordmark
    const band = g.createLinearGradient(0, 118, 0, 165);
    band.addColorStop(0, '#1E60C8'); band.addColorStop(1, '#58B0F0');
    g.fillStyle = band; g.fillRect(125, 120, 262, 42);
    text(g, 'POKéMON RACE', 256, 126, { color: '#F8E050', shadow: '#704010', size: 32, align: 'center', family: '"Power Clear Bold"' });
    g.fillStyle = this.seat.color; g.fillRect(0, 0, 512, 6);
    if (Math.floor(this.t / 30) % 2 === 0) draw(g, 'ui/titles/start.png', 0, 300);
    g.fillStyle = '#000'; g.fillRect(0, 352, 512, 32);
    text(g, KEY_LABELS[this.seat.index], 256, 360, { color: '#F8F8F8', shadow: '#202020', size: 18, align: 'center' });
  }
}
