import React from 'react';

interface ProgressBarProps {
    value: number;
    max: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ value, max }) => {
    const percentage = (value / max) * 100;

    return (
        <div className="relative w-full bg-gray-200 rounded-full h-6 overflow-hidden">
            <div
                className={`h-full ${percentage > 20 ? 'bg-green-500' : 'bg-red-500'} transition-width duration-500 ease-in-out`}
                style={{ width: `${percentage}%` }}
                title={`${value}/${max}`}
            ></div>
            <div className="absolute top-0 left-0 w-full h-full flex justify-center items-center">
                <span className="text-sm text-black font-semibold">{`${value}/${max}`}</span>
            </div>
        </div>
    );
};

export default ProgressBar;