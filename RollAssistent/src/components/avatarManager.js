/**
 * Avatar Manager — handles character avatar images.
 * Avatars are stored as base64 data URIs in the character state within localStorage.
 * Images are resized to 256x256 using canvas before storage.
 */
import { t } from '../utils/lang.js';
import { getSavedCharacters, saveCharacterList } from '../utils/storage.js';

const AVATAR_SIZE = 256;

/**
 * Get the avatar for a character by id
 * @param {string} charId - Character id
 * @returns {string|null} Base64 data URI or null
 */
export function getCharacterAvatar(charId) {
  if (!charId) return null;
  const characters = getSavedCharacters();
  const char = characters.find(c => c.id === charId);
  return char?.avatar || null;
}

/**
 * Set avatar for a character
 * @param {string} charId - Character id
 * @param {string} dataUri - Base64 data URI of the image
 * @returns {boolean} Success
 */
export function setCharacterAvatar(charId, dataUri) {
  if (!charId) return false;
  const characters = getSavedCharacters();
  const idx = characters.findIndex(c => c.id === charId);
  if (idx < 0) return false;
  characters[idx].avatar = dataUri;
  return saveCharacterList(characters);
}

/**
 * Remove avatar from a character
 * @param {string} charId - Character id
 * @returns {boolean} Success
 */
export function removeCharacterAvatar(charId) {
  if (!charId) return false;
  const characters = getSavedCharacters();
  const idx = characters.findIndex(c => c.id === charId);
  if (idx < 0) return false;
  delete characters[idx].avatar;
  return saveCharacterList(characters);
}

/**
 * Process an image file: resize to AVATAR_SIZE x AVATAR_SIZE and return base64
 * @param {File} file - Image file
 * @returns {Promise<string>} Base64 data URI
 */
export function processAvatarImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('invalid_type'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = AVATAR_SIZE;
        canvas.height = AVATAR_SIZE;
        const ctx = canvas.getContext('2d');

        // Center-crop: use the largest centered square from the source
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;

        ctx.drawImage(img, sx, sy, size, size, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

        const dataUri = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUri);
      };
      img.onerror = () => reject(new Error('image_load_error'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('read_error'));
    reader.readAsDataURL(file);
  });
}

/**
 * Open file picker for avatar selection (gallery)
 * @returns {Promise<string>} Base64 data URI of processed image
 */
export function pickAvatarFromGallery() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      document.body.removeChild(input);
      if (!file) {
        reject(new Error('no_file'));
        return;
      }
      try {
        const dataUri = await processAvatarImage(file);
        resolve(dataUri);
      } catch (err) {
        reject(err);
      }
    });

    input.addEventListener('cancel', () => {
      document.body.removeChild(input);
      reject(new Error('cancelled'));
    });

    input.click();
  });
}

/**
 * Open camera for avatar capture
 * Uses the capture attribute to request camera on mobile devices
 * @returns {Promise<string>} Base64 data URI of processed image
 */
export function pickAvatarFromCamera() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment');
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      document.body.removeChild(input);
      if (!file) {
        reject(new Error('no_file'));
        return;
      }
      try {
        const dataUri = await processAvatarImage(file);
        resolve(dataUri);
      } catch (err) {
        reject(err);
      }
    });

    input.addEventListener('cancel', () => {
      document.body.removeChild(input);
      reject(new Error('cancelled'));
    });

    input.click();
  });
}

/**
 * Render avatar display HTML for a character card/list
 * @param {string} charId - Character id
 * @param {string} size - CSS size (e.g. '48px', '80px')
 * @returns {string} HTML string
 */
export function renderAvatarHtml(charId, size = '48px') {
  const avatar = getCharacterAvatar(charId);
  if (avatar) {
    return `<div class="avatar-display" style="width:${size}; height:${size};">
      <img src="${avatar}" alt="avatar" class="avatar-img" style="width:${size}; height:${size};">
    </div>`;
  }
  return `<div class="avatar-display avatar-placeholder" style="width:${size}; height:${size};">
    <span class="avatar-placeholder-icon">👤</span>
  </div>`;
}

/**
 * Render the avatar editor section (for character creation/edit)
 * @param {string} charId - Character id (null if creating new)
 * @param {string|null} currentAvatar - Current avatar data URI
 * @returns {string} HTML string
 */
export function renderAvatarEditor(charId, currentAvatar) {
  const hasAvatar = !!currentAvatar;
  let html = `<div class="avatar-editor">
    <h3>${t('avatarTitle')}</h3>
    <div class="avatar-editor-preview">`;

  if (hasAvatar) {
    html += `<img src="${currentAvatar}" alt="avatar" class="avatar-editor-img">`;
  } else {
    html += `<div class="avatar-editor-placeholder"><span>👤</span></div>`;
  }

  html += `</div>
    <div class="avatar-editor-actions">
      <button class="menu-btn avatar-gallery-btn" id="avatar-gallery-btn">${hasAvatar ? t('avatarChange') : t('avatarSelect')}</button>
      <button class="menu-btn avatar-camera-btn" id="avatar-camera-btn">${t('avatarCamera')}</button>
      ${hasAvatar ? `<button class="menu-btn avatar-delete-btn" id="avatar-delete-btn" style="border-color:#e74c3c; color:#e74c3c;">${t('avatarDelete')}</button>` : ''}
    </div>
  </div>`;
  return html;
}

/**
 * Setup avatar editor event handlers
 * @param {string} charId - Character id
 * @param {Function} onUpdate - Callback when avatar changes (receives dataUri or null)
 */
export function setupAvatarEditorEvents(charId, onUpdate) {
  const galleryBtn = document.getElementById('avatar-gallery-btn');
  const cameraBtn = document.getElementById('avatar-camera-btn');
  const deleteBtn = document.getElementById('avatar-delete-btn');

  if (galleryBtn) {
    galleryBtn.addEventListener('click', async () => {
      try {
        const dataUri = await pickAvatarFromGallery();
        if (charId) {
          setCharacterAvatar(charId, dataUri);
        }
        if (onUpdate) onUpdate(dataUri);
      } catch (err) {
        if (err.message !== 'cancelled' && err.message !== 'no_file') {
          window.showAlert?.(t('error'), t('avatarError'));
        }
      }
    });
  }

  if (cameraBtn) {
    cameraBtn.addEventListener('click', async () => {
      try {
        const dataUri = await pickAvatarFromCamera();
        if (charId) {
          setCharacterAvatar(charId, dataUri);
        }
        if (onUpdate) onUpdate(dataUri);
      } catch (err) {
        if (err.message !== 'cancelled' && err.message !== 'no_file') {
          window.showAlert?.(t('error'), t('avatarError'));
        }
      }
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      if (window.showAlert) {
        window.showAlert(t('confirm'), t('avatarDeleteConfirm'), () => {
          if (charId) removeCharacterAvatar(charId);
          if (onUpdate) onUpdate(null);
        });
      } else {
        if (confirm(t('avatarDeleteConfirm'))) {
          if (charId) removeCharacterAvatar(charId);
          if (onUpdate) onUpdate(null);
        }
      }
    });
  }
}
