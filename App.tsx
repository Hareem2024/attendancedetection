import React, { useState, useCallback, useEffect } from 'react';
import { AttendanceRecord, RegisteredUser } from './types';
import WebcamDisplay from './components/WebcamDisplay';
import RegistrationPanel from './components/RegistrationPanel';
import AttendanceTable from './components/AttendanceTable';
import { ATTENDANCE_COOLDOWN_MS } from './constants';

const API_URL = 'http://localhost:5000/api';

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

  // Function to update CSV file
  const updateCSV = useCallback((records: AttendanceRecord[]) => {
    try {
      // Format the data
      const headers = "Name,Date,Time\n";
      const rows = records
        .map(record => {
          const date = record.timestamp.toLocaleDateString();
          const time = record.timestamp.toLocaleTimeString();
          return `"${record.name}","${date}","${time}"`;
        })
        .join("\n");
      const csvContent = headers + rows;

      // Create blob with BOM for Excel compatibility
      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csvContent], { 
        type: 'text/csv;charset=utf-8;' 
      });

      // Create a temporary link element
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      // Set link properties
      link.href = url;
      link.download = `attendance_log_${new Date().toISOString().split('T')[0]}.csv`;
      
      // Append link to body
      document.body.appendChild(link);
      
      // Trigger download
      if (isMobile) {
        // For mobile devices, create a data URL
        const reader = new FileReader();
        reader.onload = function(e) {
          const dataUrl = e.target?.result as string;
          const newWindow = window.open();
          if (newWindow) {
            newWindow.document.write(`
              <html>
                <head>
                  <title>Attendance Log Updated</title>
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <style>
                    body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
                    .download-btn {
                      background-color: #4CAF50;
                      color: white;
                      padding: 10px 20px;
                      border: none;
                      border-radius: 5px;
                      cursor: pointer;
                      font-size: 16px;
                      margin: 20px 0;
                    }
                    .download-btn:hover {
                      background-color: #45a049;
                    }
                  </style>
                </head>
                <body>
                  <h2>Attendance Log Updated</h2>
                  <p>Click the button below to download the updated attendance log:</p>
                  <a href="${dataUrl}" download="attendance_log.csv" class="download-btn">
                    Download Updated CSV
                  </a>
                </body>
              </html>
            `);
          }
        };
        reader.readAsDataURL(blob);
      } else {
        // For desktop, trigger click
        link.click();
      }
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error("Error updating CSV:", error);
    }
  }, [isMobile]);

  // Load attendance records from server
  useEffect(() => {
    const fetchAttendanceRecords = async () => {
      try {
        const response = await fetch(`${API_URL}/attendance`);
        const data = await response.json();
        setAttendanceLog(data.map((record: any) => ({
          id: record._id,
          name: record.name,
          timestamp: new Date(record.timestamp)
        })));
      } catch (error) {
        console.error('Error fetching attendance records:', error);
      }
    };

    fetchAttendanceRecords();
  }, []);

  // Save attendance record to server
  const saveAttendanceRecord = async (record: AttendanceRecord) => {
    try {
      await fetch(`${API_URL}/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: record.name,
          timestamp: record.timestamp
        }),
      });
    } catch (error) {
      console.error('Error saving attendance record:', error);
    }
  };

  const handleFaceRecognized = useCallback((name: string) => {
    setAttendanceLog(prevLog => {
      const now = Date.now();
      const lastLoggedTime = lastLoggedTimestamps[name] || 0;

      if (now - lastLoggedTime < ATTENDANCE_COOLDOWN_MS) {
        return prevLog;
      }
      
      setLastLoggedTimestamps(prevTimestamps => ({ ...prevTimestamps, [name]: now }));
      
      const newRecord: AttendanceRecord = {
        id: `${name}-${now}`,
        name,
        timestamp: new Date(),
      };
      
      const updatedLog = [newRecord, ...prevLog];
      
      // Save to server
      saveAttendanceRecord(newRecord);
      
      // Update CSV file with new record
      updateCSV(updatedLog);
      
      return updatedLog;
    });
  }, [lastLoggedTimestamps, updateCSV]);

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
