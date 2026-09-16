export interface OperationalEmailPreference {
  operationalEmailNotificationsEnabled: boolean
}

export function operationalEmailPreferencePayload(enabled: boolean): OperationalEmailPreference {
  return { operationalEmailNotificationsEnabled: enabled }
}
