import { PadState } from '../ui/padStates';

export function buildMainGridPads(project, clipStatesById) {
  const pads = new Map();

  for (const track of project.tracks) {
    for (const clip of track.clips) {
      const key = `${track.column}:${clip.row}`;
      pads.set(key, {
        id: clip.id,
        name: clip.name ?? clip.id,
        type: clip.type,
        state: clipStatesById.get(clip.id) ?? PadState.idle,
      });
    }
  }

  return pads;
}

export function buildCustomGridPads(project, clipStatesById) {
  const pads = new Map();

  for (const clip of project.customClips) {
    const key = `${clip.column}:${clip.row}`;
    pads.set(key, {
      id: clip.id,
      name: clip.name ?? clip.id,
      type: clip.type,
      state: clipStatesById.get(clip.id) ?? PadState.idle,
    });
  }

  return pads;
}
