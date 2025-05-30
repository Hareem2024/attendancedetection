
export const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
export const MIN_CONFIDENCE = 0.6; // Minimum confidence for face detection
export const FACE_MATCH_THRESHOLD = 0.5; // Stricter threshold for matching, face-api.js default is 0.6, but 0.5 can be better for fewer known faces.
export const ATTENDANCE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes cooldown for logging the same person
