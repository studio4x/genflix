export const APP_BUILD_VERSION = '0.0.1663-7eb3c13';
interface AppVersionProps {
    className?: string;
}
export function AppVersion({ className = '' }: AppVersionProps) {
    return <span className={className}>Build v{APP_BUILD_VERSION}</span>;
}
