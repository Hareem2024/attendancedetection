import React, { useState, useRef, useCallback } from 'react';
import { MIN_CONFIDENCE } from '../constants';

interface RegistrationPanelProps {
  onFaceRegistered: (name: string, descriptor: Float32Array) => void;
  isModelsLoaded: boolean;
  isMobile: boolean;
}

const RegistrationPanel: React.FC<RegistrationPanelProps> = ({ 
  onFaceRegistered, 
  isModelsLoaded,
  isMobile 
}) => {
  const [name, setName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const tempVideoRef = useRef<HTMLVideoElement | null>(null);

  const captureAndRegister = useCallback(async () => {
    if (!name.trim()) {
      setMessage('Please enter a name.');
      return;
    }
    if (!isModelsLoaded || !faceapi || !faceapi.nets.ssdMobilenetv1.isLoaded) {
      setMessage('Models not loaded yet. Please wait.');
      return;
    }

    setIsRegistering(true);
    setMessage('Attempting to capture face...');

    let stream: MediaStream | null = null;
    try {
      const constraints = {
        video: {
          facingMode: isMobile ? 'environment' : 'user',
          width: { ideal: isMobile ? 1280 : 1920 },
          height: { ideal: isMobile ? 720 : 1080 }
        }
      };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      const videoEl = document.createElement('video');
      videoEl.srcObject = stream;
      videoEl.autoplay = true;
      videoEl.muted = true;
      videoEl.playsInline = true;
      tempVideoRef.current = videoEl;

      await new Promise(resolve => videoEl.onloadedmetadata = resolve);
      await new Promise(resolve => setTimeout(resolve, 500));

      const detection = await faceapi.detectSingleFace(videoEl, new faceapi.SsdMobilenetv1Options({ minConfidence: MIN_CONFIDENCE }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection) {
        onFaceRegistered(name.trim(), detection.descriptor);
        setMessage(`✅ ${name.trim()} registered successfully!`);
        setName('');
      } else {
        setMessage('⚠️ No face detected or quality too low. Please ensure your face is well-lit and visible.');
      }
    } catch (err: any) {
      console.error("Registration error:", err);
      setMessage(`Error during registration: ${err.message || 'Unknown error'}`);
    } finally {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (tempVideoRef.current) {
        tempVideoRef.current.srcObject = null;
        tempVideoRef.current = null;
      }
      setIsRegistering(false);
      setTimeout(() => setMessage(null), 5000);
    }
  }, [name, onFaceRegistered, isModelsLoaded, isMobile]);

  if (!isModelsLoaded) {
    return (
      <div className="bg-slate-800 p-4 sm:p-6 rounded-xl shadow-2xl">
        <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 text-sky-300">Register Face</h2>
        <p className="text-sm sm:text-base text-slate-400">AI models are loading. Registration will be available soon.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 p-4 sm:p-6 rounded-xl shadow-2xl">
      <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-sky-300">Register New Person</h2>
      <div className="space-y-3 sm:space-y-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter name"
          className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-gray-100 text-sm sm:text-base focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors"
          disabled={isRegistering}
        />
        <button
          onClick={captureAndRegister}
          disabled={isRegistering || !name.trim()}
          className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm sm:text-base"
        >
          {isRegistering ? (
            <>
              <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Registering...</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              <span>Capture & Register Face</span>
            </>
          )}
        </button>
        {message && (
          <p className={`text-xs sm:text-sm mt-2 p-2 rounded-md ${message.startsWith('✅') ? 'bg-green-700_bg-opacity-30 text-green-300' : message.startsWith('⚠️') ? 'bg-yellow-700_bg-opacity-30 text-yellow-300' : 'bg-red-700_bg-opacity-30 text-red-300'}`}>
            {message}
          </p>
        )}
      </div>
      <p className="text-xs text-slate-500 mt-3 sm:mt-4">
        Ensure your face is clearly visible and well-lit for best results. Only one person should be in frame during registration.
      </p>
    </div>
  );
};

export default RegistrationPanel;
