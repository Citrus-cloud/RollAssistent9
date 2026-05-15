/**
 * Audio Storage — localStorage CRUD for audio files.
 * Audio data is stored as base64 data URIs in localStorage.
 * Bindings link audio files to characters or NPCs.
 */

const AUDIO_STORAGE_KEY = 'dnd_audio_library';

/**
 * Get all saved audio entries from localStorage
 * @returns {Array} Array of audio objects: { id, name, dataUri, duration, bindType, bindId, bindName, addedAt }
 */
export function getSavedAudio() {
  try {
    const raw = localStorage.getItem(AUDIO_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      localStorage.removeItem(AUDIO_STORAGE_KEY);
      return [];
    }
    return parsed.filter(a => a && typeof a === 'object' && a.id);
  } catch (e) {
    localStorage.removeItem(AUDIO_STORAGE_KEY);
    return [];
  }
}

/**
 * Save the full audio list to localStorage
 * @param {Array} list - Array of audio objects
 * @returns {boolean} Success status
 */
export function saveAudioList(list) {
  try {
    if (!Array.isArray(list)) return false;
    localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    console.error('Audio save error (possibly localStorage quota):', e);
    return false;
  }
}

/**
 * Add a single audio entry to storage
 * @param {Object} audio - Audio object with id, name, dataUri
 * @returns {boolean} Success status
 */
export function addAudio(audio) {
  if (!audio || !audio.id || !audio.dataUri) return false;
  const list = getSavedAudio();
  list.push(audio);
  return saveAudioList(list);
}

/**
 * Update an existing audio entry in storage by id
 * @param {Object} updatedAudio - Audio object with id
 * @returns {boolean} Success status
 */
export function updateAudio(updatedAudio) {
  if (!updatedAudio || !updatedAudio.id) return false;
  const list = getSavedAudio();
  const idx = list.findIndex(a => a.id === updatedAudio.id);
  if (idx < 0) return false;
  list[idx] = updatedAudio;
  return saveAudioList(list);
}

/**
 * Delete an audio entry from storage by id
 * @param {string} audioId - The audio id to delete
 * @returns {boolean} Success status
 */
export function deleteAudio(audioId) {
  if (!audioId) return false;
  const list = getSavedAudio();
  const filtered = list.filter(a => a.id !== audioId);
  return saveAudioList(filtered);
}

/**
 * Get a single audio entry by id
 * @param {string} audioId - The audio id
 * @returns {Object|null} The audio object or null
 */
export function getAudioById(audioId) {
  if (!audioId) return null;
  const list = getSavedAudio();
  return list.find(a => a.id === audioId) || null;
}

/**
 * Get all audio entries bound to a specific character or NPC
 * @param {string} bindType - 'character' or 'npc'
 * @param {string} bindId - The character/npc id
 * @returns {Array} Array of audio objects bound to this entity
 */
export function getAudioByBinding(bindType, bindId) {
  if (!bindType || !bindId) return [];
  const list = getSavedAudio();
  return list.filter(a => a.bindType === bindType && a.bindId === bindId);
}

/**
 * Bind an audio file to a character or NPC
 * @param {string} audioId - Audio id
 * @param {string} bindType - 'character' or 'npc'
 * @param {string} bindId - Target id
 * @param {string} bindName - Display name of the target
 * @returns {boolean} Success status
 */
export function bindAudio(audioId, bindType, bindId, bindName) {
  const audio = getAudioById(audioId);
  if (!audio) return false;
  audio.bindType = bindType;
  audio.bindId = bindId;
  audio.bindName = bindName || '';
  return updateAudio(audio);
}

/**
 * Unbind an audio file (remove its binding)
 * @param {string} audioId - Audio id
 * @returns {boolean} Success status
 */
export function unbindAudio(audioId) {
  const audio = getAudioById(audioId);
  if (!audio) return false;
  audio.bindType = null;
  audio.bindId = null;
  audio.bindName = null;
  return updateAudio(audio);
}

/**
 * Read a File object and return a base64 data URI
 * @param {File} file - The File to read
 * @returns {Promise<{dataUri: string, name: string, duration: number}>}
 */
export function readAudioFile(file) {
  return new Promise((resolve, reject) => {
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3', 'audio/x-wav', 'audio/wave'];
    const validExtensions = ['.mp3', '.wav', '.ogg'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (!validTypes.includes(file.type) && !validExtensions.includes(ext)) {
      reject(new Error('invalid_format'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result;
      // Try to get duration
      const audio = new Audio();
      audio.src = dataUri;
      audio.addEventListener('loadedmetadata', () => {
        resolve({
          dataUri,
          name: file.name,
          duration: Math.round(audio.duration)
        });
      });
      audio.addEventListener('error', () => {
        // Still resolve but without duration
        resolve({
          dataUri,
          name: file.name,
          duration: 0
        });
      });
    };
    reader.onerror = () => reject(new Error('read_error'));
    reader.readAsDataURL(file);
  });
}

/**
 * Format seconds into mm:ss
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
