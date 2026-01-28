import phonkProject from '../projects/phonkProject.json';
import { normalizeProject } from './ProjectLoader';

export function getDemoProject() {
  return normalizeProject(phonkProject);
}
