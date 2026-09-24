import type { SupportSubmissionType } from "./support-api"

export const SUPPORT_MESSAGE_MAX_LENGTH = 5000

export interface SupportFormState {
  open: boolean
  type: SupportSubmissionType
  message: string
  status: "idle" | "submitting" | "success"
  error: string | null
}

export type SupportFormAction =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "SET_SUBMISSION_TYPE"; value: SupportSubmissionType }
  | { type: "SET_MESSAGE"; value: string }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_SUCCESS" }
  | { type: "SUBMIT_FAILURE"; error: string }

export const initialSupportFormState: SupportFormState = {
  open: false,
  type: "PROBLEM",
  message: "",
  status: "idle",
  error: null,
}

export function supportFormReducer(state: SupportFormState, action: SupportFormAction): SupportFormState {
  switch (action.type) {
    case "OPEN":
      return { ...initialSupportFormState, open: true }
    case "CLOSE":
      return initialSupportFormState
    case "SET_SUBMISSION_TYPE":
      return { ...state, type: action.value, error: null }
    case "SET_MESSAGE":
      return { ...state, message: action.value, error: null }
    case "SUBMIT_START":
      return { ...state, status: "submitting", error: null }
    case "SUBMIT_SUCCESS":
      return { ...state, status: "success", error: null }
    case "SUBMIT_FAILURE":
      return { ...state, status: "idle", error: action.error }
  }
}

export function supportMessageError(message: string) {
  if (!message.trim()) return "Tell us how we can help."
  if (message.length > SUPPORT_MESSAGE_MAX_LENGTH) {
    return `Keep your message under ${SUPPORT_MESSAGE_MAX_LENGTH.toLocaleString()} characters.`
  }
  return null
}

export function inferSupportLocationId(locations: Array<{ id: string }>) {
  return locations.length === 1 ? locations[0].id : undefined
}
