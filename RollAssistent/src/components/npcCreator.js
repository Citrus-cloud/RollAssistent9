/**
 * NPC Creator — full creation/edit form for NPCs and enemies.
 * Supports combo fields (select + custom input) for all categorical fields.
 * Equipment is fixed after creation.
 */
import { t, getCurrentLang } from '../utils/lang.js';
import { STAT_KEYS, NPC_STORAGE_KEY } from '../utils/constants.js';
import { getSavedNpcs, saveNpcList } from './npcStorage.js';

// NPC data from global scope
let personalities, worldviews, professions, weapons, appearances, equipmentSlots;

function loadNpcData() {
  personalities = window._NPC_personalities || [];
  worldviews = window._NPC_worldviews || [];
  professions = window._NPC_professions || [];
  weapons = window._NPC_weapons || [];
  appearances = window._NPC_appearances || [];
  equipmentSlots = window._NPC_equipmentSlots || [];
}

/**
 * Render the NPC creation/edit form into a container.
 * @param {HTMLElement} container - DOM element to render into
 * @param {Object|null} existingNpc - If editing, pass the NPC object; null for new
 * @param {Function} onSave - Callback after save (receives the saved NPC object)
 * @param {Function} onCancel - Callback for cancel/back
 */
export function renderNpcCreator(container, existingNpc, onSave, onCancel) {
  loadNpcData();
  const isEdit = !!existingNpc;
  const npc = existingNpc || {
    id: null,
    name: '',
    level: 1,
    hp: 10,
    baseStats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    personality: '',
    personalityCustom: '',
    worldview: '',
    worldviewCustom: '',
    profession: '',
    professionCustom: '',
    weapon: '',
    weaponCustom: '',
    appearance: '',
    appearanceCustom: '',
    equipment: {}
  };

  const title = isEdit ? t('npcEditTitle') : t('npcCreationTitle');

  let html = `
    <button class="back-btn npc-back-btn" id="npc-creator-back">${t('npcBackToList')}</button>
    <h1>${title}</h1>
    ${!isEdit ? `<div style="text-align:center; margin-bottom:15px;">
      <button class="menu-btn" id="npc-random-btn" style="border-color:#9b59b6; color:#9b59b6;">🎲 ${t('npcRandomBtn')}</button>
    </div>` : ''}

    <section class="card">
      <h2>${t('npcName')}</h2>
      <input type="text" id="npc-name-input" placeholder="${t('npcNamePlaceholder')}" value="${escapeHtml(npc.name)}" 
        style="width:100%; padding:8px; background:#1e1e1e; border:1px solid #3a3a3a; color:#f0e6d2; border-radius:6px;">
    </section>

    <section class="card">
      <h2>${t('npcLevel')} & ${t('npcHP')}</h2>
      <div style="display:flex; gap:10px;">
        <div style="flex:1;">
          <label style="font-size:0.85em; color:#b0a08a;">${t('npcLevel')}</label>
          <input type="number" id="npc-level-input" min="1" max="30" value="${npc.level}" 
            style="width:100%; padding:8px; background:#1e1e1e; border:1px solid #3a3a3a; color:#f0e6d2; border-radius:6px;">
        </div>
        <div style="flex:1;">
          <label style="font-size:0.85em; color:#b0a08a;">${t('npcHP')}</label>
          <input type="number" id="npc-hp-input" min="1" max="9999" value="${npc.hp}" 
            style="width:100%; padding:8px; background:#1e1e1e; border:1px solid #3a3a3a; color:#f0e6d2; border-radius:6px;">
        </div>
      </div>
    </section>

    <section class="card">
      <h2>${t('npcStats')}</h2>
      <div class="npc-stats-grid">
        ${STAT_KEYS.map(key => `
          <div class="npc-stat-item">
            <label>${t('stat' + key.charAt(0).toUpperCase() + key.slice(1))}</label>
            <input type="number" id="npc-stat-${key}" min="1" max="30" value="${npc.baseStats[key] || 10}" class="npc-stat-input">
          </div>
        `).join('')}
      </div>
    </section>

    ${renderComboField('personality', t('npcPersonality'), personalities, 'npcPers_', npc.personality, npc.personalityCustom, t('npcPersonalitySelect'), t('npcPersonalityCustom'))}
    ${renderComboField('worldview', t('npcWorldview'), worldviews, 'npcWv_', npc.worldview, npc.worldviewCustom, t('npcWorldviewSelect'), t('npcWorldviewCustom'))}
    ${renderComboField('profession', t('npcProfession'), professions, 'npcProf_', npc.profession, npc.professionCustom, t('npcProfessionSelect'), t('npcProfessionCustom'))}
    ${renderComboField('weapon', t('npcWeapon'), weapons, 'npcWpn_', npc.weapon, npc.weaponCustom, t('npcWeaponSelect'), t('npcWeaponCustom'))}
    ${renderComboField('appearance', t('npcAppearance'), appearances, 'npcApp_', npc.appearance, npc.appearanceCustom, t('npcAppearanceSelect'), t('npcAppearanceCustom'))}

    <section class="card">
      <h2>${t('npcEquipment')}</h2>
      <p style="font-size:0.8em; color:#b0a08a; margin-bottom:8px;">${t('npcEquipmentHint')}</p>
      <div class="npc-equipment-grid">
        ${equipmentSlots.map(slot => {
          const val = (npc.equipment && npc.equipment[slot.id]) || '';
          const disabled = isEdit ? 'disabled' : '';
          const slotI18nMap = { head: 'slotHead', body: 'slotBody', mainhand: 'slotMainhand', offhand: 'slotOffhand', feet: 'slotFeet', ring: 'slotRing', neck: 'slotNeck', back: 'slotBack' };
          const slotName = slotI18nMap[slot.id] ? t(slotI18nMap[slot.id]) : slot.name;
          return `
            <div class="npc-equip-slot">
              <label style="font-size:0.75em; color:#d4af37;">${t('npcEquipmentSlot', slotName)}</label>
              <input type="text" id="npc-equip-${slot.id}" placeholder="${t('npcEquipmentItemPlaceholder')}" 
                value="${escapeHtml(val)}" ${disabled}
                style="width:100%; padding:6px; background:#1e1e1e; border:1px solid #3a3a3a; color:#f0e6d2; border-radius:4px; font-size:0.85em;">
            </div>
          `;
        }).join('')}
      </div>
    </section>

    <div style="text-align:center; margin:15px 0;">
      <button class="menu-btn" id="npc-save-btn">${t('npcSave')}</button>
    </div>
  `;

  container.innerHTML = html;

  // Event: Back button
  document.getElementById('npc-creator-back').addEventListener('click', () => {
    if (onCancel) onCancel();
  });

  // Event: Random generation (only for new NPC)
  const randomBtn = document.getElementById('npc-random-btn');
  if (randomBtn) {
    randomBtn.addEventListener('click', () => {
      randomizeNpc();
    });
  }

  // Event: Save
  document.getElementById('npc-save-btn').addEventListener('click', () => {
    const result = collectFormData(npc, isEdit);
    if (!result) return; // validation failed
    onSave(result);
  });

  // Setup combo field interactions
  setupComboFields();
}

/**
 * Render a combo field (select + custom input)
 */
function renderComboField(fieldId, label, options, i18nPrefix, selectedValue, customValue, selectPlaceholder, customPlaceholder) {
  const hasCustom = customValue && customValue.trim() !== '';
  return `
    <section class="card">
      <h2>${label}</h2>
      <select id="npc-${fieldId}-select" class="npc-combo-select" data-field="${fieldId}"
        style="width:100%; padding:8px; background:#1e1e1e; border:1px solid #3a3a3a; color:#f0e6d2; border-radius:6px; margin-bottom:6px;">
        <option value="">${selectPlaceholder}</option>
        ${options.map(opt => `<option value="${opt.id}" ${opt.id === selectedValue ? 'selected' : ''}>${t(i18nPrefix + opt.id) || opt.name}</option>`).join('')}
        <option value="__custom__" ${hasCustom ? 'selected' : ''}>${t('npcCustomValue')}</option>
      </select>
      <input type="text" id="npc-${fieldId}-custom" class="npc-combo-custom" data-field="${fieldId}"
        placeholder="${customPlaceholder}" value="${escapeHtml(customValue || '')}"
        style="width:100%; padding:8px; background:#1e1e1e; border:1px solid #3a3a3a; color:#f0e6d2; border-radius:6px; display:${hasCustom ? 'block' : 'none'};">
    </section>
  `;
}

/**
 * Setup combo fields so custom input shows/hides based on select
 */
function setupComboFields() {
  document.querySelectorAll('.npc-combo-select').forEach(select => {
    select.addEventListener('change', function () {
      const field = this.dataset.field;
      const customInput = document.getElementById(`npc-${field}-custom`);
      if (this.value === '__custom__') {
        customInput.style.display = 'block';
        customInput.focus();
      } else {
        customInput.style.display = 'none';
        customInput.value = '';
      }
    });
  });
}

/**
 * Collect data from the form, validate, return NPC object or null if invalid
 */
function collectFormData(originalNpc, isEdit) {
  const name = document.getElementById('npc-name-input').value.trim();
  if (!name) {
    showNpcAlert(t('error'), t('npcValidationName'));
    return null;
  }

  const level = parseInt(document.getElementById('npc-level-input').value);
  if (isNaN(level) || level < 1 || level > 30) {
    showNpcAlert(t('error'), t('npcValidationLevel'));
    return null;
  }

  const hp = parseInt(document.getElementById('npc-hp-input').value);
  if (isNaN(hp) || hp < 1) {
    showNpcAlert(t('error'), t('npcValidationHP'));
    return null;
  }

  // Stats
  const baseStats = {};
  for (const key of STAT_KEYS) {
    const val = parseInt(document.getElementById(`npc-stat-${key}`).value);
    baseStats[key] = isNaN(val) ? 10 : Math.max(1, Math.min(30, val));
  }

  // Combo fields
  const personality = getComboValue('personality');
  const worldview = getComboValue('worldview');
  const profession = getComboValue('profession');
  const weapon = getComboValue('weapon');
  const appearance = getComboValue('appearance');

  // Equipment — only writable on creation, preserved on edit
  let equipment = {};
  if (isEdit) {
    equipment = originalNpc.equipment || {};
  } else {
    const slots = window._NPC_equipmentSlots || [];
    slots.forEach(slot => {
      const val = document.getElementById(`npc-equip-${slot.id}`).value.trim();
      if (val) equipment[slot.id] = val;
    });
  }

  return {
    id: originalNpc.id || 'npc_' + Date.now(),
    name,
    level,
    hp,
    baseStats,
    personality: personality.selected,
    personalityCustom: personality.custom,
    worldview: worldview.selected,
    worldviewCustom: worldview.custom,
    profession: profession.selected,
    professionCustom: profession.custom,
    weapon: weapon.selected,
    weaponCustom: weapon.custom,
    appearance: appearance.selected,
    appearanceCustom: appearance.custom,
    equipment
  };
}

/**
 * Get the value of a combo field (select + custom)
 */
function getComboValue(fieldId) {
  const select = document.getElementById(`npc-${fieldId}-select`);
  const customInput = document.getElementById(`npc-${fieldId}-custom`);
  const selectVal = select.value;
  if (selectVal === '__custom__') {
    return { selected: '', custom: customInput.value.trim() };
  }
  return { selected: selectVal, custom: '' };
}

/**
 * Use the global showAlert if available
 */
function showNpcAlert(title, message) {
  if (window.showAlert) {
    window.showAlert(title, message);
  } else {
    alert(message);
  }
}

/**
 * Escape HTML for safe insertion
 */
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ========== RANDOM NPC GENERATION ==========

const RANDOM_NAMES = {
  ru: [
    'Злобный Грых', 'Торговец Мирко', 'Кровавый Фанг', 'Тихий Шарх',
    'Горбатый Нокс', 'Безумная Мэрга', 'Старик Ворон', 'Одноглазый Крейг',
    'Мрачный Дорн', 'Хитрая Лисса', 'Железный Барг', 'Шёпот Теней',
    'Багровый Кальт', 'Ведьма Зара', 'Молчаливый Ренн', 'Гром Каменный',
    'Плеть Ноктис', 'Костяная Марга', 'Дикий Бран', 'Серебряный Эйк',
    'Чумной Рат', 'Пепельная Вира', 'Клинок Рейза', 'Змеиный Сиз'
  ],
  en: [
    'Grim Fang', 'Mirko the Merchant', 'Bloodclaw Rex', 'Silent Shade',
    'Hunchback Nox', 'Mad Merga', 'Old Raven', 'One-Eye Craig',
    'Dark Dorn', 'Sly Lissa', 'Ironbark', 'Shadow Whisper',
    'Crimson Kalt', 'Witch Zara', 'Silent Renn', 'Stonethunder',
    'Whiplash Noktis', 'Bone Marga', 'Wild Bran', 'Silver Eik',
    'Plague Rat', 'Ash Vira', 'Blade Reiza', 'Serpent Siz'
  ]
};

/**
 * Generate a random NPC and fill the form fields.
 */
function randomizeNpc() {
  const lang = getCurrentLang();

  // Random name from localized array
  const names = RANDOM_NAMES[lang] || RANDOM_NAMES.en;
  const randomName = names[Math.floor(Math.random() * names.length)];
  document.getElementById('npc-name-input').value = randomName;

  // Random level 1–20
  const level = Math.floor(Math.random() * 20) + 1;
  document.getElementById('npc-level-input').value = level;

  // HP based on level: 50 + level * 10 + random(-5, +5)
  const hp = 50 + level * 10 + Math.floor(Math.random() * 11) - 5;
  document.getElementById('npc-hp-input').value = hp;

  // Random stats (8–20, weighted towards 8–16 for balance)
  for (const key of STAT_KEYS) {
    const statVal = 8 + Math.floor(Math.random() * 10) + Math.floor(Math.random() * 3);
    const clamped = Math.min(20, Math.max(8, statVal));
    const input = document.getElementById(`npc-stat-${key}`);
    if (input) input.value = clamped;
  }

  // Random personality
  if (personalities.length > 0) {
    const randPers = personalities[Math.floor(Math.random() * personalities.length)];
    const persSelect = document.getElementById('npc-personality-select');
    const persCustom = document.getElementById('npc-personality-custom');
    if (persSelect) { persSelect.value = randPers.id; persCustom.style.display = 'none'; persCustom.value = ''; }
  }

  // Random worldview
  if (worldviews.length > 0) {
    const randWv = worldviews[Math.floor(Math.random() * worldviews.length)];
    const wvSelect = document.getElementById('npc-worldview-select');
    const wvCustom = document.getElementById('npc-worldview-custom');
    if (wvSelect) { wvSelect.value = randWv.id; wvCustom.style.display = 'none'; wvCustom.value = ''; }
  }

  // Random profession
  if (professions.length > 0) {
    const randProf = professions[Math.floor(Math.random() * professions.length)];
    const profSelect = document.getElementById('npc-profession-select');
    const profCustom = document.getElementById('npc-profession-custom');
    if (profSelect) { profSelect.value = randProf.id; profCustom.style.display = 'none'; profCustom.value = ''; }
  }

  // Random weapon
  if (weapons.length > 0) {
    const randWpn = weapons[Math.floor(Math.random() * weapons.length)];
    const wpnSelect = document.getElementById('npc-weapon-select');
    const wpnCustom = document.getElementById('npc-weapon-custom');
    if (wpnSelect) { wpnSelect.value = randWpn.id; wpnCustom.style.display = 'none'; wpnCustom.value = ''; }
  }

  // Random appearance
  if (appearances.length > 0) {
    const randApp = appearances[Math.floor(Math.random() * appearances.length)];
    const appSelect = document.getElementById('npc-appearance-select');
    const appCustom = document.getElementById('npc-appearance-custom');
    if (appSelect) { appSelect.value = randApp.id; appCustom.style.display = 'none'; appCustom.value = ''; }
  }
}
