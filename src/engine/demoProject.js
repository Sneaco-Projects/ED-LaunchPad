import demoProject from '../projects/demoProject.json';
import { normalizeProject } from './ProjectLoader';

export function getDemoProject() {
  return normalizeProject(demoProject);
}
