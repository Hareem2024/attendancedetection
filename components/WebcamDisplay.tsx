import React, { useRef, useEffect, useState, useCallback } from 'react';
import { RegisteredUser, LabeledFaceDescriptor } from '../types';
import { MODEL_URL, MIN_CONFIDENCE, FACE_MATCH_THRESHOLD } from '../constants';

interface WebcamDisplayProps {
  onFaceRecognized: (name: string) => void;
  registeredUsers: RegisteredUser[];
  onModelsLoaded: (loaded: boolean) => void;
  isMobile: boolean;
}

const WebcamDisplay: React.FC<WebcamDisplayProps> = ({ onFaceRecognized, registeredUsers, onModelsLoaded, isMobile }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [faceMatcher, setFaceMatcher] = useState<any>(null); // Use 'any' for faceapi.FaceMatcher
  const [isVideoReady, setIsVideoReady] = useState(false);
  const detectionIntervalRef = useRef<number | null>(null); // Changed NodeJS.Timeout to number

  const loadModels = useCallback(async () => {
    try {
      // console.log("Loading models from:", MODEL_URL);
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      // console.log("Models loaded successfully.");
      onModelsLoaded(true);
    } catch (err) {
      console.error("Error loading models:", err);
      setError("Failed to load AI models. Please ensure you are connected to the internet and try refreshing.");
      onModelsLoaded(false);
    }
  }, [onModelsLoaded]);

  const startWebcam = useCallback(async () => {
    try {
      // First try to get available cameras
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      // Default to user-facing camera (front camera)
      let facingMode = 'user';
      
      // If on mobile and we have multiple cameras, try to use the back camera
      if (isMobile && videoDevices.length > 1) {
        facingMode = 'environment';
      }

      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: isMobile ? 1280 : 1920 },
          height: { ideal: isMobile ? 720 : 1080 }
        }
      };

      // Try to get the camera stream
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => {
            setIsVideoReady(true);
          }).catch(err => {
            console.error("Error playing video:", err);
            // If back camera fails, try front camera
            if (facingMode === 'environment') {
              console.log("Trying front camera...");
              stream.getTracks().forEach(track => track.stop());
              startWebcam();
            } else {
              setError("Failed to start video playback. Please try refreshing.");
            }
          });
        };
      }
    } catch (err) {
      console.error("Error accessing webcam:", err);
      // If back camera fails, try front camera
      if (isMobile) {
        console.log("Trying front camera...");
        const frontCameraConstraints = {
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        };
        try {
          const stream = await navigator.mediaDevices.getUserMedia(frontCameraConstraints);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play().then(() => {
                setIsVideoReady(true);
              }).catch(err => {
                console.error("Error playing video:", err);
                setError("Failed to start video playback. Please try refreshing.");
              });
            };
          }
        } catch (frontErr) {
          setError("Failed to access camera. Please check permissions and ensure a camera is available.");
        }
      } else {
        setError("Failed to access webcam. Please check permissions and ensure a webcam is connected.");
      }
    }
  }, [isMobile]);

  useEffect(() => {
    loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Load models only once

  useEffect(() => {
    // This effect handles starting the webcam *after* models are loaded.
    // It depends on `isModelsLoaded` state which is updated by `onModelsLoaded` callback.
    // `isModelsLoaded` is managed in App.tsx, so this effect will run when that prop changes.
    // For this component, we assume onModelsLoaded is called which triggers parent state update.
    // We don't directly use a state `isModelsLoaded` here, but rely on the parent to control flow.
    // If `onModelsLoaded(true)` was called, the parent might re-render this, or change `startWebcam` conditions.
    // The current logic in App.tsx implies `WebcamDisplay` is conditionally rendered or its props change
    // based on model loading status.
    // Let's assume the parent component handles the logic of when to actually *enable* webcam features.
    // This component's `startWebcam` just attempts to start it.
    // The `onModelsLoaded` in App.tsx makes the WebcamDisplay visible, so startWebcam will then be called.
    if (videoRef.current && !videoRef.current.srcObject) { // Check if webcam is not already started
       startWebcam();
    }
  }, [startWebcam]); // Rerun if startWebcam changes (it's memoized so only on mount typically)


  useEffect(() => {
    if (registeredUsers.length > 0 && faceapi && faceapi.LabeledFaceDescriptors && faceapi.FaceMatcher) {
      const labeledDescriptors: LabeledFaceDescriptor[] = registeredUsers.map(user => 
        new faceapi.LabeledFaceDescriptors(user.name, [user.descriptor])
      );
      if (labeledDescriptors.length > 0) {
        setFaceMatcher(new faceapi.FaceMatcher(labeledDescriptors, FACE_MATCH_THRESHOLD));
        // console.log("FaceMatcher updated with registered users.");
      } else {
        setFaceMatcher(null); // No users or FaceMatcher not ready
      }
    } else {
      setFaceMatcher(null); // No registered users
    }
  }, [registeredUsers]);
  
  const detectFaces = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !faceapi || !faceapi.nets.ssdMobilenetv1.isLoaded) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.paused || video.ended || video.readyState < 3) {
      return;
    }

    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    if(displaySize.width === 0 || displaySize.height === 0) {
      return;
    }
    faceapi.matchDimensions(canvas, displaySize);

    const detections = await faceapi.detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: MIN_CONFIDENCE }))
      .withFaceLandmarks()
      .withFaceDescriptors();
    
    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      resizedDetections.forEach((detection: any) => {
        const box = detection.detection.box;
        let label = 'Unknown';
        let color = 'rgba(255, 0, 0, 0.8)';

        if (faceMatcher) {
          const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
          if (bestMatch && bestMatch.label !== 'unknown' && bestMatch.distance < FACE_MATCH_THRESHOLD) {
            label = `${bestMatch.label} (${Math.round((1 - bestMatch.distance) * 100)}%)`;
            color = 'rgba(0, 255, 0, 0.8)';
            onFaceRecognized(bestMatch.label);
          }
        }
        
        // Draw bounding box
        ctx.strokeStyle = color;
        ctx.lineWidth = isMobile ? 3 : 2; // Thicker lines on mobile
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        // Draw label with mobile-optimized font size
        ctx.fillStyle = color;
        ctx.font = isMobile ? 'bold 20px Arial' : '16px Arial';
        const textX = box.x;
        const textY = box.y > 20 ? box.y - 5 : box.y + box.height + 20;
        ctx.fillText(label, textX, textY);
      });
    }
  }, [faceMatcher, onFaceRecognized, isMobile]);


  useEffect(() => {
    if (videoRef.current && !error ) { 
        const videoElement = videoRef.current;
        const handlePlay = () => {
            // console.log("Video played, starting detection interval.");
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
            }
            detectionIntervalRef.current = window.setInterval(detectFaces, 300); // Use window.setInterval for clarity
        };

        // Ensure video is ready before adding event listener
        if (videoElement.readyState >= 3) { // HAVE_FUTURE_DATA or HAVE_ENOUGH_DATA
            handlePlay(); // If already playing or ready
        }
        videoElement.addEventListener('play', handlePlay);
        
        return () => {
            // console.log("Cleaning up WebcamDisplay: removing event listener and clearing interval.");
            videoElement.removeEventListener('play', handlePlay);
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
                detectionIntervalRef.current = null;
            }
            // Stop webcam stream if component unmounts
            if (videoElement.srcObject) {
              const stream = videoElement.srcObject as MediaStream;
              stream.getTracks().forEach(track => track.stop());
              // console.log("Webcam stream stopped.");
            }
        };
    }
  }, [detectFaces, error]);


  if (error) {
    return (
      <div className="text-red-400 bg-red-900 bg-opacity-50 p-4 rounded-lg text-sm sm:text-base">
        {error}
      </div>
    );
  }
  
  return (
    <div className="relative w-full aspect-video bg-slate-900 rounded-lg overflow-hidden shadow-md">
      <video 
        ref={videoRef} 
        autoPlay 
        muted 
        playsInline 
        className="absolute top-0 left-0 w-full h-full object-cover"
      />
      <canvas 
        ref={canvasRef} 
        className="absolute top-0 left-0 w-full h-full"
      />
      {!isVideoReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white text-sm sm:text-base">
          Initializing Camera...
        </div>
      )}
    </div>
  );
};

export default WebcamDisplay;
