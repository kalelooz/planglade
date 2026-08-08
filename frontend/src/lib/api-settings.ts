import type { AppSettings } from '@/types'

const API_SETTINGS_KEY = 'planglade-ui-settings-v1'

const apiSettings: AppSettings = {
  theme: 'system',
  priorityDisplay: 'icon',
  weekStartsOn: 1,
  hideHomeCompleted: false,
}

export function loadApiSettings(storage: Pick<Storage, 'getItem'> = localStorage): AppSettings {
  try {
    const parsed = JSON.parse(storage.getItem(API_SETTINGS_KEY) ?? 'null') as Partial<AppSettings> | null
    if (!parsed || typeof parsed !== 'object') return apiSettings
    return {
      theme: parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'system' ? parsed.theme : apiSettings.theme,
      priorityDisplay: parsed.priorityDisplay === 'icon' || parsed.priorityDisplay === 'text' ? parsed.priorityDisplay : apiSettings.priorityDisplay,
      weekStartsOn: parsed.weekStartsOn === 0 || parsed.weekStartsOn === 1 ? parsed.weekStartsOn : apiSettings.weekStartsOn,
      hideHomeCompleted: typeof parsed.hideHomeCompleted === 'boolean' ? parsed.hideHomeCompleted : apiSettings.hideHomeCompleted,
    }
  } catch {
    return apiSettings
  }
}

export function saveApiSettings(settings: AppSettings, storage: Pick<Storage, 'setItem'> = localStorage) {
  try {
    storage.setItem(API_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Browser storage is optional; the current session still uses the updated UI setting.
  }
}
