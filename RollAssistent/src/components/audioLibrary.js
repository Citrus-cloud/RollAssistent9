/**
 * Audio Library UI — screen for managing uploaded audio files.
 * Features: upload, list, mini-player (play/pause, progress, volume), bind/unbind to characters/NPCs.
 */
import { t } from '../utils/lang.js';
import {
  getSavedAudio, addAudio, deleteAudio, bindAudio, unbindAudio,
  readAudioFile, formatDuration, getAudioById, getAudioByBinding
} from './audioStorage.js';
import { getSavedCharacters } from '../utils/storage.js';
import { getSavedNpcs } from './npcStorage.js';

let _currentAudioEl = null; // Currently playing Audio element
let _currentPlayingId = null; // ID of currently playing track
let _progressInterval = null;

/**
 * Initialize the audio library screen into a container.
 * @param {HTMLElement} container - DOM element to render into
 * @param {Function} onBack - Callback to go back to main menu
 */
export function initAudioLibrary(container, onBack) {
  renderAudioList(container, onBack);
}

/**
 * Render the full audio library list view
 */
function renderAudioList(container, onBack) {
  stopCurrentAudio();
  const audioFiles = getSavedAudio();

  let html = `
    <button class="back-btn" id="audio-back-btn">${t('audioBackToList')}</button>
    <h1>${t('audioTitle')}</h1>
    <div class="audio-upload-section">
      <button class="menu-btn audio-upload-btn" id="audio-upload-btn">${t('audioUpload')}</button>
      <input type="file" id="audio-file-input" accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg" style="display:none;" multiple>
    </div>
  `;

  if (audioFiles.length === 0) {
    html += `<p class="audio-empty-msg">${t('audioEmpty')}</p>`;
  } else {
    html += '<div class="audio-list">';
    audioFiles.forEach(audio => {
      const isPlaying = _currentPlayingId === audio.id;
      const bindInfo = audio.bindType && audio.bindName
        ? t('audioBound', audio.bindName)
        : t('audioNoBound');

      html += `
        <div class="audio-item card" data-audio-id="${audio.id}">
          <div class="audio-item-header">
            <div class="audio-item-name">${escapeHtml(audio.name)}</div>
            <div class="audio-item-duration">${formatDuration(audio.duration)}</div>
          </div>
          <div class="audio-player-controls">
            <button class="audio-btn audio-play-btn" data-audio-id="${audio.id}" title="${isPlaying ? t('audioPause') : t('audioPlay')}">
              ${isPlaying ? '⏸️' : '▶️'}
            </button>
            <div class="audio-progress-container" data-audio-id="${audio.id}">
              <div class="audio-progress-bar">
                <div class="audio-progress-fill" id="progress-${audio.id}" style="width:0%"></div>
              </div>
              <span class="audio-time" id="time-${audio.id}">0:00</span>
            </div>
            <div class="audio-volume-container">
              <span class="audio-volume-icon">🔊</span>
              <input type="range" class="audio-volume-slider" data-audio-id="${audio.id}" min="0" max="100" value="80" title="${t('audioVolume')}">
            </div>
          </div>
          <div class="audio-item-bind">
            <span class="audio-bind-info">${bindInfo}</span>
            ${audio.bindType
              ? `<button class="audio-btn audio-unbind-btn" data-audio-id="${audio.id}">${t('audioUnbind')}</button>`
              : `<button class="audio-btn audio-bind-btn" data-audio-id="${audio.id}">${t('audioBind')}</button>`
            }
          </div>
          <div class="audio-item-actions">
            <button class="audio-btn audio-delete-btn" data-audio-id="${audio.id}">${t('audioDelete')}</button>
          </div>
        </div>
      `;
    });
    html += '</div>';
  }

  container.innerHTML = html;

  // Event: Back
  document.getElementById('audio-back-btn').addEventListener('click', () => {
    stopCurrentAudio();
    onBack();
  });

  // Event: Upload
  document.getElementById('audio-upload-btn').addEventListener('click', () => {
    document.getElementById('audio-file-input').click();
  });

  document.getElementById('audio-file-input').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    for (const file of files) {
      try {
        const result = await readAudioFile(file);
        const audioEntry = {
          id: 'audio_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          name: result.name,
          dataUri: result.dataUri,
          duration: result.duration,
          bindType: null,
          bindId: null,
          bindName: null,
          addedAt: Date.now()
        };
        const success = addAudio(audioEntry);
        if (!success) {
          showAlert(t('error'), t('audioLoadError'));
        }
      } catch (err) {
        if (err.message === 'invalid_format') {
          showAlert(t('error'), t('audioFileError'));
        } else {
          showAlert(t('error'), t('audioLoadError'));
        }
      }
    }
    // Reset input and re-render
    e.target.value = '';
    renderAudioList(container, onBack);
  });

  // Event delegation for audio controls
  container.addEventListener('click', (e) => {
    const playBtn = e.target.closest('.audio-play-btn');
    if (playBtn) {
      const audioId = playBtn.dataset.audioId;
      togglePlayAudio(audioId, container, onBack);
      return;
    }

    const bindBtn = e.target.closest('.audio-bind-btn');
    if (bindBtn) {
      const audioId = bindBtn.dataset.audioId;
      showBindModal(audioId, container, onBack);
      return;
    }

    const unbindBtn = e.target.closest('.audio-unbind-btn');
    if (unbindBtn) {
      const audioId = unbindBtn.dataset.audioId;
      unbindAudio(audioId);
      renderAudioList(container, onBack);
      return;
    }

    const deleteBtn = e.target.closest('.audio-delete-btn');
    if (deleteBtn) {
      const audioId = deleteBtn.dataset.audioId;
      if (window.showAlert) {
        window.showAlert(t('confirm'), t('audioDeleteConfirm'), () => {
          if (_currentPlayingId === audioId) stopCurrentAudio();
          deleteAudio(audioId);
          renderAudioList(container, onBack);
        });
      } else {
        if (confirm(t('audioDeleteConfirm'))) {
          if (_currentPlayingId === audioId) stopCurrentAudio();
          deleteAudio(audioId);
          renderAudioList(container, onBack);
        }
      }
      return;
    }
  });

  // Volume sliders
  container.querySelectorAll('.audio-volume-slider').forEach(slider => {
    slider.addEventListener('input', (e) => {
      if (_currentAudioEl && _currentPlayingId === e.target.dataset.audioId) {
        _currentAudioEl.volume = parseInt(e.target.value) / 100;
      }
    });
  });
}

/**
 * Toggle play/pause for an audio file
 */
function togglePlayAudio(audioId, container, onBack) {
  if (_currentPlayingId === audioId && _currentAudioEl) {
    if (_currentAudioEl.paused) {
      _currentAudioEl.play();
      startProgressUpdate(audioId);
    } else {
      _currentAudioEl.pause();
      clearProgressInterval();
    }
    updatePlayButton(audioId, !_currentAudioEl.paused);
    return;
  }

  // Stop previous audio
  stopCurrentAudio();

  // Load new audio
  const audio = getAudioById(audioId);
  if (!audio || !audio.dataUri) return;

  _currentAudioEl = new Audio(audio.dataUri);
  _currentPlayingId = audioId;

  // Volume
  const volumeSlider = container.querySelector(`.audio-volume-slider[data-audio-id="${audioId}"]`);
  if (volumeSlider) {
    _currentAudioEl.volume = parseInt(volumeSlider.value) / 100;
  }

  _currentAudioEl.play().catch(() => {
    showAlert(t('error'), t('audioLoadError'));
    stopCurrentAudio();
  });

  _currentAudioEl.addEventListener('ended', () => {
    stopCurrentAudio();
    updatePlayButton(audioId, false);
    updateProgress(audioId, 0, 0);
  });

  startProgressUpdate(audioId);
  updatePlayButton(audioId, true);
}

/**
 * Start updating the progress bar
 */
function startProgressUpdate(audioId) {
  clearProgressInterval();
  _progressInterval = setInterval(() => {
    if (_currentAudioEl && !_currentAudioEl.paused) {
      const current = _currentAudioEl.currentTime;
      const duration = _currentAudioEl.duration || 1;
      updateProgress(audioId, current, duration);
    }
  }, 250);
}

/**
 * Update progress bar and time display
 */
function updateProgress(audioId, current, duration) {
  const fill = document.getElementById(`progress-${audioId}`);
  const timeEl = document.getElementById(`time-${audioId}`);
  if (fill) {
    const pct = duration > 0 ? (current / duration) * 100 : 0;
    fill.style.width = pct + '%';
  }
  if (timeEl) {
    timeEl.textContent = formatDuration(Math.floor(current));
  }
}

/**
 * Update play/pause button display
 */
function updatePlayButton(audioId, isPlaying) {
  const btn = document.querySelector(`.audio-play-btn[data-audio-id="${audioId}"]`);
  if (btn) {
    btn.innerHTML = isPlaying ? '⏸️' : '▶️';
    btn.title = isPlaying ? t('audioPause') : t('audioPlay');
  }
}

/**
 * Stop currently playing audio
 */
function stopCurrentAudio() {
  clearProgressInterval();
  if (_currentAudioEl) {
    _currentAudioEl.pause();
    _currentAudioEl.src = '';
    _currentAudioEl = null;
  }
  _currentPlayingId = null;
}

function clearProgressInterval() {
  if (_progressInterval) {
    clearInterval(_progressInterval);
    _progressInterval = null;
  }
}

/**
 * Show the bind modal to choose character or NPC
 */
function showBindModal(audioId, container, onBack) {
  const characters = getSavedCharacters();
  const npcs = getSavedNpcs();

  let options = '';
  if (characters.length > 0) {
    options += `<optgroup label="${t('audioBindCharacter')}">`;
    characters.forEach(c => {
      options += `<option value="character|${c.id}|${escapeHtml(c.name)}">${c.name}</option>`;
    });
    options += '</optgroup>';
  }
  if (npcs.length > 0) {
    options += `<optgroup label="${t('audioBindNpc')}">`;
    npcs.forEach(n => {
      options += `<option value="npc|${n.id}|${escapeHtml(n.name)}">${n.name}</option>`;
    });
    options += '</optgroup>';
  }

  if (!options) {
    showAlert(t('notification'), t('noSaved'));
    return;
  }

  // Create inline bind UI within the audio item
  const audioItem = container.querySelector(`.audio-item[data-audio-id="${audioId}"]`);
  if (!audioItem) return;

  const bindSection = audioItem.querySelector('.audio-item-bind');
  if (!bindSection) return;

  bindSection.innerHTML = `
    <div class="audio-bind-form">
      <label>${t('audioBindTo')}</label>
      <select class="audio-bind-select" id="audio-bind-select-${audioId}">
        <option value="">${t('audioBindSelect')}</option>
        ${options}
      </select>
      <button class="audio-btn audio-bind-confirm" data-audio-id="${audioId}">${t('audioBind')}</button>
    </div>
  `;

  const confirmBtn = bindSection.querySelector('.audio-bind-confirm');
  confirmBtn.addEventListener('click', () => {
    const select = document.getElementById(`audio-bind-select-${audioId}`);
    const val = select.value;
    if (!val) return;
    const parts = val.split('|');
    const bindType = parts[0];
    const bindId = parts[1];
    const bindName = parts[2];
    bindAudio(audioId, bindType, bindId, bindName);
    renderAudioList(container, onBack);
  });
}

/**
 * Play first audio bound to entity. Returns a stop function or null.
 * @param {string} bindType - 'character' or 'npc'
 * @param {string} bindId - entity id
 * @returns {{ stop: Function, audioName: string }|null}
 */
export function playEntityAudio(bindType, bindId) {
  const audioFiles = getAudioByBinding(bindType, bindId);
  if (audioFiles.length === 0) return null;

  const audio = audioFiles[0];
  stopCurrentAudio();

  _currentAudioEl = new Audio(audio.dataUri);
  _currentPlayingId = audio.id;
  _currentAudioEl.volume = 0.8;
  _currentAudioEl.play().catch(() => {});

  _currentAudioEl.addEventListener('ended', () => {
    stopCurrentAudio();
  });

  return {
    stop: () => stopCurrentAudio(),
    audioName: audio.name
  };
}

/**
 * Check if an entity has bound audio
 * @param {string} bindType - 'character' or 'npc'
 * @param {string} bindId - entity id
 * @returns {boolean}
 */
export function hasEntityAudio(bindType, bindId) {
  const audioFiles = getAudioByBinding(bindType, bindId);
  return audioFiles.length > 0;
}

/**
 * Stop any currently playing audio (exported for external use)
 */
export function stopAudio() {
  stopCurrentAudio();
}

function showAlert(title, msg, cb) {
  if (window.showAlert) {
    window.showAlert(title, msg, cb);
  } else {
    alert(msg);
    if (cb) cb();
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
