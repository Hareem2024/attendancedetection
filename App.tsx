import React, { useState, useCallback, useEffect } from 'react';
import { AttendanceRecord, RegisteredUser } from './types';
import WebcamDisplay from './components/WebcamDisplay';
import RegistrationPanel from './components/RegistrationPanel';
import AttendanceTable from './components/AttendanceTable';
import { ATTENDANCE_COOLDOWN_MS } from './constants';

const App: React.FC = () => {
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [attendanceLog, setAttendanceLog] = useState<AttendanceRecord[]>([]);
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [lastLoggedTimestamps, setLastLoggedTimestamps] = useState<Record<string, number>>({});
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleFaceRegistered = useCallback((name: string, descriptor: Float32Array) => {
    setRegisteredUsers(prevUsers => [...prevUsers, { name, descriptor }]);
  }, []);

  const handleFaceRecognized = useCallback((name: string) => {
    setAttendanceLog(prevLog => {
      const now = Date.now();
      const lastLoggedTime = lastLoggedTimestamps[name] || 0;

      if (now - lastLoggedTime < ATTENDANCE_COOLDOWN_MS) {
         // console.log(`User ${name} recognized but within cooldown period.`);
        return prevLog;
      }
      
      // console.log(`Logging attendance for ${name}`);
      setLastLoggedTimestamps(prevTimestamps => ({ ...prevTimestamps, [name]: now }));
      
      const newRecord: AttendanceRecord = {
        id: `${name}-${now}`, // Simple unique ID
        name,
        timestamp: new Date(),
      };
      return [newRecord, ...prevLog]; // Add to top of the log
    });
  }, [lastLoggedTimestamps]);

  useEffect(() => {
    // Load registered users from localStorage on mount (optional persistence)
    const storedUsers = localStorage.getItem('registeredUsers');
    if (storedUsers) {
      try {
        const parsedUsers: RegisteredUser[] = JSON.parse(storedUsers).map((user: any) => ({
            ...user,
            // Descriptors are plain arrays in JSON, convert back to Float32Array
            descriptor: new Float32Array(Object.values(user.descriptor)) 
        }));
        setRegisteredUsers(parsedUsers);
      } catch (error) {
        console.error("Failed to load registered users from localStorage:", error);
      }
    }
  }, []);

  useEffect(() => {
    // Save registered users to localStorage when they change (optional persistence)
    if (registeredUsers.length > 0) {
      localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
    }
  }, [registeredUsers]);


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 text-gray-100 flex flex-col items-center p-2 sm:p-4 space-y-4 sm:space-y-6">
      <header className="text-center w-full px-2">
        <h1 className="text-2xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">
          👁️ Face Recognition Attendance
        </h1>
        <p className="text-slate-400 mt-2 text-sm sm:text-base">
          Automatically mark attendance using your webcam. Register faces and see live logging.
        </p>
      </header>

      {!isModelsLoaded && (
         <div className="w-full max-w-3xl p-4 sm:p-6 bg-slate-800 rounded-xl shadow-2xl text-center">
            <div className="animate-pulse text-sky-400 text-sm sm:text-base">Loading AI Models... Please wait.</div>
         </div>
      )}

      <div className={`w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 transition-opacity duration-500 ${isModelsLoaded ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
        <div className="md:col-span-2 bg-slate-800 p-3 sm:p-6 rounded-xl shadow-2xl">
          <WebcamDisplay
            onFaceRecognized={handleFaceRecognized}
            registeredUsers={registeredUsers}
            onModelsLoaded={setIsModelsLoaded}
            isMobile={isMobile}
          />
        </div>
        
        <div className="space-y-4 sm:space-y-6">
          <RegistrationPanel 
            onFaceRegistered={handleFaceRegistered} 
            isModelsLoaded={isModelsLoaded}
            isMobile={isMobile}
          />
          <AttendanceTable 
            attendanceLog={attendanceLog}
            isMobile={isMobile}
          />
        </div>
      </div>
      
      <footer className="text-center text-slate-500 mt-auto pt-4 text-xs sm:text-sm">
        <p>Powered by React, Tailwind CSS, and face-api.js</p>
      </footer>
    </div>
  );
};

export default App;
