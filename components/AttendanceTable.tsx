import React from 'react';
import { AttendanceRecord } from '../types';

interface AttendanceTableProps {
  attendanceLog: AttendanceRecord[];
  isMobile: boolean;
}

const AttendanceTable: React.FC<AttendanceTableProps> = ({ attendanceLog, isMobile }) => {
  const downloadCSV = () => {
    if (attendanceLog.length === 0) {
      alert("No attendance data to download.");
      return;
    }

    try {
      // Format the data
      const headers = "Name,Date,Time\n";
      const rows = attendanceLog
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

      // Create download link
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      
      // Set link properties
      link.setAttribute("href", url);
      link.setAttribute("download", `attendance_log_${new Date().toISOString().split('T')[0]}.csv`);
      
      // Handle mobile devices
      if (isMobile) {
        // For mobile, open in new tab
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");
      } else {
        // For desktop, use hidden link
        link.style.visibility = 'hidden';
      }

      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 100);

      // Show success message
      alert("Attendance log downloaded successfully!");
    } catch (error) {
      console.error("Error downloading CSV:", error);
      alert("Failed to download attendance log. Please try again.");
    }
  };

  return (
    <div className="bg-slate-800 p-4 sm:p-6 rounded-xl shadow-2xl">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0 mb-3 sm:mb-4">
        <h2 className="text-lg sm:text-xl font-semibold text-sky-300">Attendance Log</h2>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={downloadCSV}
            disabled={attendanceLog.length === 0}
            className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-3 sm:px-4 rounded-lg transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center sm:justify-start space-x-2 text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <span>Download Latest CSV</span>
          </button>
          <p className="text-xs text-slate-400">
            CSV updates automatically with each new attendance
          </p>
        </div>
      </div>
      {attendanceLog.length === 0 ? (
        <p className="text-slate-400 text-center py-4 text-sm sm:text-base">No attendance records yet. Recognized faces will appear here.</p>
      ) : (
        <div className="max-h-60 sm:max-h-80 overflow-y-auto rounded-md border border-slate-700">
          {isMobile ? (
            // Mobile view: Card-based layout
            <div className="divide-y divide-slate-700">
              {attendanceLog.map((record) => (
                <div key={record.id} className="p-3 hover:bg-slate-750 transition-colors">
                  <div className="font-medium text-sky-300">{record.name}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {record.timestamp.toLocaleTimeString()} - {record.timestamp.toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Desktop view: Table layout
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs text-sky-300 uppercase bg-slate-700 sticky top-0">
                <tr>
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {attendanceLog.map((record) => (
                  <tr key={record.id} className="bg-slate-800 border-b border-slate-700 hover:bg-slate-750 transition-colors">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{record.name}</td>
                    <td className="px-4 py-3">{record.timestamp.toLocaleTimeString()} - {record.timestamp.toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendanceTable;
