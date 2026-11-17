// Saving and loading: auto-save to localStorage, JSON export/import,
// PNG screenshots and GLB (3D model) export.
import { app, bus, setProject, sanitizeProject } from '../state.js';

const KEY = 'house-builder-3d:project';

export function autosave() {
  try { localStorage.setItem(KEY, JSON.stringify(app.project)); bus.emit('saved'); }
  catch (e) { console.warn('Auto-save failed', e); bus.emit('toast', { msg: 'Could not auto-save (storage full or blocked)' }); }
}

export function loadAutosave() {
  try {
    const s = localStorage.getItem(KEY);
    return s ? sanitizeProject(JSON.parse(s)) : null;
  } catch (e) { console.warn('Auto-save could not be read', e); return null; }
}

const safeName = () => (app.project.name || 'house').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'house';

export function download(blobOrUrl, filename) {
  const a = document.createElement('a');
  const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  if (typeof blobOrUrl !== 'string') setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function exportJSON() {
  download(new Blob([JSON.stringify(app.project, null, 1)], { type: 'application/json' }), `${safeName()}.house.json`);
}

/** Parse the text of a project file and load it. Throws with a readable message. */
export function importJSONText(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('That file is not valid JSON.'); }
  setProject(sanitizeProject(data));
}

export function importJSONFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,application/json';
    input.onchange = async () => {
      const f = input.files[0];
      if (!f) return resolve(false);
      try { importJSONText(await f.text()); resolve(true); } catch (e) { reject(e); }
    };
    input.click();
  });
}

export function exportPNG(dataUrl) { download(dataUrl, `${safeName()}.png`); }

export async function exportGLB(root) {
  const { GLTFExporter } = await import('../../vendor/GLTFExporter.js');
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(root, { binary: true, onlyVisible: true });
  download(new Blob([result], { type: 'model/gltf-binary' }), `${safeName()}.glb`);
}
