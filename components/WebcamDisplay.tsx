import React, { useRef, useEffect, useState, useCallback } from 'react';
import { RegisteredUser, LabeledFaceDescriptor } from '../types';
import { MODEL_URL, MIN_CONFIDENCE, FACE_MATCH_THRESHOLD } from '../constants';

interface WebcamDisplayProps {
  onFaceRecognized: (name: string) => void;
  registeredUsers: RegisteredUser[];
  onModelsLoaded: (loaded: boolean) => void;
  isMobile: boolean;
  onAttendanceRecord: (record: any) => void;
}

const WebcamDisplay: React.FC<WebcamDisplayProps> = ({ onFaceRecognized, registeredUsers, onModelsLoaded, isMobile, onAttendanceRecord }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [faceMatcher, setFaceMatcher] = useState<any>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const detectionIntervalRef = useRef<number | null>(null);
  const lastDetectionTime = useRef<number>(0);
  const processingFrame = useRef<boolean>(false);

  const loadModels = useCallback(async () => {
    try {
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      onModelsLoaded(true);
    } catch (err) {
      console.error("Error loading models:", err);
      setError("Failed to load AI models. Please ensure you are connected to the internet and try refreshing.");
      onModelsLoaded(false);
    }
  }, [onModelsLoaded]);

  const startWebcam = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      let facingMode = 'user';
      if (isMobile && videoDevices.length > 1) {
        facingMode = 'environment';
      }

      // Optimize video constraints for mobile
      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: isMobile ? 640 : 1280 }, // Lower resolution for mobile
          height: { ideal: isMobile ? 480 : 720 }, // Lower resolution for mobile
          frameRate: { ideal: isMobile ? 15 : 30 } // Lower frame rate for mobile
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => {
            setIsVideoReady(true);
          }).catch(err => {
            console.error("Error playing video:", err);
            if (facingMode === 'environment') {
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
      if (isMobile) {
        const frontCameraConstraints = {
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 15 }
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

  const detectFaces = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !faceapi || !faceapi.nets.ssdMobilenetv1.isLoaded) {
      return;
    }

    const now = Date.now();
    if (now - lastDetectionTime.current < (isMobile ? 500 : 300)) { // Throttle detection on mobile
      return;
    }

    if (processingFrame.current) {
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

    try {
      processingFrame.current = true;
      lastDetectionTime.current = now;

      // Optimize canvas size for mobile
      const scale = isMobile ? 0.5 : 1;
      const scaledSize = {
        width: displaySize.width * scale,
        height: displaySize.height * scale
      };

      faceapi.matchDimensions(canvas, displaySize);

      const detections = await faceapi.detectAllFaces(
        video, 
        new faceapi.SsdMobilenetv1Options({ 
          minConfidence: isMobile ? MIN_CONFIDENCE * 0.8 : MIN_CONFIDENCE // Lower confidence threshold for mobile
        })
      ).withFaceLandmarks().withFaceDescriptors();
      
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
          ctx.lineWidth = isMobile ? 3 : 2;
          ctx.strokeRect(box.x, box.y, box.width, box.height);

          // Draw label with mobile-optimized font size
          ctx.fillStyle = color;
          ctx.font = isMobile ? 'bold 16px Arial' : '16px Arial';
          const textX = box.x;
          const textY = box.y > 20 ? box.y - 5 : box.y + box.height + 20;
          ctx.fillText(label, textX, textY);
        });
      }
    } catch (err) {
      console.error("Error during face detection:", err);
    } finally {
      processingFrame.current = false;
    }
  }, [faceMatcher, onFaceRecognized, isMobile]);

  const saveAttendance = async (name: string) => {
    try {
      const response = await fetch('/.netlify/functions/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save attendance record');
      }

      const newRecord = await response.json();
      onAttendanceRecord(newRecord);
    } catch (error) {
      console.error('Error saving attendance:', error);
    }
  };

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  useEffect(() => {
    if (videoRef.current && !videoRef.current.srcObject) {
      startWebcam();
    }
    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [startWebcam]);

  useEffect(() => {
    if (registeredUsers.length > 0 && faceapi && faceapi.LabeledFaceDescriptors && faceapi.FaceMatcher) {
      const labeledDescriptors: LabeledFaceDescriptor[] = registeredUsers.map(user => 
        new faceapi.LabeledFaceDescriptors(user.name, [user.descriptor])
      );
      if (labeledDescriptors.length > 0) {
        setFaceMatcher(new faceapi.FaceMatcher(labeledDescriptors, FACE_MATCH_THRESHOLD));
      } else {
        setFaceMatcher(null);
      }
    } else {
      setFaceMatcher(null);
    }
  }, [registeredUsers]);

  useEffect(() => {
    if (videoRef.current && !error) {
      const videoElement = videoRef.current;
      const handlePlay = () => {
        if (detectionIntervalRef.current) {
          clearInterval(detectionIntervalRef.current);
        }
        detectionIntervalRef.current = window.setInterval(detectFaces, isMobile ? 500 : 300);
      };

      if (videoElement.readyState >= 3) {
        handlePlay();
      }
      videoElement.addEventListener('play', handlePlay);
      
      return () => {
        videoElement.removeEventListener('play', handlePlay);
        if (detectionIntervalRef.current) {
          clearInterval(detectionIntervalRef.current);
          detectionIntervalRef.current = null;
        }
        if (videoElement.srcObject) {
          const stream = videoElement.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
        }
      };
    }
  }, [detectFaces, error, isMobile]);

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
