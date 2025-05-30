
// Declare faceapi globally to inform TypeScript about its existence
// This is necessary because face-api.js is loaded via a script tag
declare global {
  const faceapi: any; 
}

export interface AttendanceRecord {
  id: string;
  name: string;
  timestamp: Date;
}

export interface RegisteredUser {
  name: string;
  descriptor: Float32Array;
}

// Minimal type for face-api.js LabeledFaceDescriptors if needed
export interface LabeledFaceDescriptor {
  label: string;
  descriptors: Float32Array[];
}
