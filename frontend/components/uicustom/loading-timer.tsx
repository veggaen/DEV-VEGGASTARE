import React, { useEffect, useState } from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

interface LoadingTimerProps {
  intervalDuration: number;
  onRefresh: () => void;
  refreshing: boolean;
}

const LoadingTimer: React.FC<LoadingTimerProps> = ({ intervalDuration, onRefresh, refreshing }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prevProgress) => (prevProgress < 100 ? prevProgress + (100 / (intervalDuration / 1000)) : 0));
    }, 1000); // Update progress every second

    return () => clearInterval(progressInterval);
  }, [intervalDuration]);

  const displayedProgress = refreshing ? 0 : progress;

  return (
    <div className="flex items-center space-x-4">
      <div style={{ width: 30, height: 30 }}>
        <CircularProgressbar
          value={displayedProgress}
          text={`${Math.round(displayedProgress)}%`}
          styles={buildStyles({
            textColor: 'transparent',
            pathColor: '#0ea5e9',
            trailColor: 'gray',
            strokeLinecap: 'round',
          })}
        />
      </div>
      <button
        onClick={onRefresh}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        disabled={refreshing}
      >
        {refreshing ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
  );
};

export default LoadingTimer;