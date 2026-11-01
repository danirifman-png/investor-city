import './ui/styles.css';
import { detectQuality, Game } from './core/Game';
import { setLocale, t } from './i18n';

async function boot(): Promise<void> {
  setLocale('he');
  document.title = t('game.title');
  // In-world signs are drawn to canvases, so the Hebrew font must be ready first.
  try {
    await Promise.race([document.fonts.load('700 32px Rubik'), new Promise((r) => setTimeout(r, 2500))]);
  } catch {
    /* fall back to system fonts */
  }
  const container = document.getElementById('app')!;
  try {
    const game = new Game(container, detectQuality());
    (window as unknown as { __game: Game }).__game = game;
  } catch (err) {
    console.error(err);
    container.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'fatal';
    msg.textContent = 'WebGL is required to play.';
    container.append(msg);
  }
  document.getElementById('boot')?.remove();
}

boot();
