export const WEATHER_TYPES = ['dry', 'damp', 'light_rain'];
export function weatherLabel(type){ return type === 'dry' ? 'Dry' : type === 'damp' ? 'Damp' : 'Light Rain'; }
