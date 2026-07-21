export const APP_BUILD_VERSION = '0.0.2241-f311e9f';
interface AppVersionProps {
    className?: string;
}
export function AppVersion({ className = '' }: AppVersionProps) {
    return <span className={className}>Build v{APP_BUILD_VERSION}</span>;
}
