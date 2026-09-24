import { STATIONS, CHARGE_DURATION, canActivate, distanceToTarget, getMissionTarget } from './mission-state.js';

export function createMissionView(callbacks) {
  const get = (id) => document.getElementById(id);
  const ids = ['experience', 'briefing', 'mission-panel', 'mission-label', 'mission-count', 'mission-title',
    'mission-hint', 'mission-distance', 'mission-restart', 'interaction', 'interaction-hint', 'interact',
    'interact-label', 'charge-fill', 'mission-announcement', 'cinematic-caption', 'mission-complete', 'mission-time', 'take-control'];
  const ui = Object.fromEntries(ids.map((id) => [id, get(id)]));
  const segments = [...document.querySelectorAll('.mission-track span')];
  for (const [id, action] of Object.entries({ 'launch-mission': 'onLaunch', 'free-explore': 'onFree',
    interact: 'onActivate', 'mission-restart': 'onReplay', 'replay-mission': 'onReplay',
    'keep-exploring': 'onContinue', 'skip-intro': 'onSkip', 'watch-demo': 'onDemo', 'take-control': 'onTakeControl' })) get(id).addEventListener('click', callbacks[action]);
  const text = (id, value) => { if (ui[id].textContent !== value) ui[id].textContent = value; };
  return {
    announce(message) { text('mission-announcement', message); },
    update({ state, position, ready, paused, cinematic, celebrating, guided, bearing }) {
      const briefing = ready && state.phase === 'briefing';
      const complete = state.phase === 'complete' && !celebrating;
      const active = ['active', 'charging'].includes(state.phase);
      const target = getMissionTarget(state);
      const reachable = canActivate(state, position);
      const charging = state.phase === 'charging';
      ui.briefing.hidden = !briefing;
      ui['mission-panel'].hidden = !ready || briefing || cinematic || complete;
      ui['mission-complete'].hidden = !complete;
      ui['cinematic-caption'].hidden = !cinematic;
      ui.interaction.hidden = !active || cinematic || paused || guided;
      ui['take-control'].hidden = !guided;
      ui.experience.classList.toggle('is-briefing', briefing);
      ui.experience.classList.toggle('is-cinematic', cinematic);
      ui.experience.classList.toggle('is-complete', complete);
      ui.experience.classList.toggle('has-objective', active);
      ui.experience.classList.toggle('is-playing', ready && !briefing && !cinematic && !complete);
      text('mission-count', `${String(Math.min(state.completed.length + (active ? 1 : 0), 3)).padStart(2, '0')} / 03`);
      text('mission-label', active ? 'LIVE OBJECTIVE' : state.phase === 'complete' ? 'ALL SYSTEMS ONLINE' : 'FREE EXPLORATION');
      text('mission-title', target?.action || (state.completed.length === 3 ? 'Connection restored' : 'Your room. Your pace.'));
      text('mission-hint', target?.hint || 'Walk around, look closer, say hello.');
      text('mission-restart', state.phase === 'free' && state.completed.length === 0 ? 'Launch mission ↗' : 'Restart mission ↗');
      const distance = target ? distanceToTarget(state, position) : 0;
      const arrow = bearing < -0.28 ? '←' : bearing > 0.28 ? '→' : '↑';
      text('mission-distance', target ? (distance <= 1.15 ? 'SIGNAL IN REACH' : `${arrow} ${distance.toFixed(1)} m TO BEACON`) : 'JOYSTICK / WASD');
      segments.forEach((segment, index) => {
        segment.classList.toggle('is-done', index < state.completed.length);
        segment.classList.toggle('is-current', active && index === state.step);
      });
      text('interact-label', charging ? 'Connecting…' : target?.action || 'Connect');
      text('interaction-hint', charging ? 'Stay beside the beacon' : reachable ? 'Signal found. Tap below or press E.' : 'Follow the glowing numbered beacon');
      ui.interact.disabled = !reachable && !charging;
      ui.interact.setAttribute('aria-busy', String(charging));
      ui.interact.classList.toggle('is-charging', charging);
      ui['charge-fill'].style.transform = `scaleX(${Math.min(1, state.charge / CHARGE_DURATION)})`;
      const seconds = Math.max(1, Math.round(state.elapsed));
      text('mission-time', `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} MISSION TIME`);
      const color = target?.color ?? STATIONS[2].color;
      ui.experience.style.setProperty('--mission-accent', `#${color.toString(16).padStart(6, '0')}`);
    },
  };
}
