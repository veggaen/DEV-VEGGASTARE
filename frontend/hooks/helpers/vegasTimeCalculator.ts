// frontend/hooks/helpers/vegasTimeCalculator.ts

const LOG_PREFIX = '[vegasTimeCalculator.ts]';

export const calculateSessionExpirationMyHelper = (expires: string) => {
    // Check if expires is provided and valid
    if (!expires || isNaN(new Date(expires).getTime())) {
        console.error(`${LOG_PREFIX} Invalid or missing 'expires' parameter.`);
        return `${LOG_PREFIX} Invalid session expiration data.`;
    }
    
    const difference = new Date(expires).getTime() - new Date().getTime();

    if (difference < (1000 * 60 * 60)) { // Less than 60 minutes
        const expiresInMinutes = Math.ceil(difference / (1000 * 60));
        return `${LOG_PREFIX} Session expires in ${expiresInMinutes} minutes. Please refresh the page soon.`;
    } else if (difference < (1000 * 60 * 60 * 24)) { // Less than 24 hours
        const expiresInHours = Math.floor(difference / (1000 * 60 * 60));
        const remainingMinutes = Math.ceil((difference % (1000 * 60 * 60)) / (1000 * 60));
        return `${LOG_PREFIX} Session expires in ${expiresInHours} hours and ${remainingMinutes} minutes.`;
    } else if (difference < (1000 * 60 * 60 * 24 * 30)) { // Less than 30 days
        const expiresInDays = Math.floor(difference / (1000 * 60 * 60 * 24));
        const remainingHours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        return `${LOG_PREFIX} Session expires in ${expiresInDays} days and ${remainingHours} hours.`;
    } else { // More than 30 days
        const expiresInMonths = Math.floor(difference / (1000 * 60 * 60 * 24 * 30));
        const remainingDays = Math.floor((difference % (1000 * 60 * 60 * 24 * 30)) / (1000 * 60 * 60 * 24));
        return `${LOG_PREFIX} Session expires in ${expiresInMonths} months and ${remainingDays} days.`;
    }
};