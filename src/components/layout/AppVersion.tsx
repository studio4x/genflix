export const APP_BUILD_VERSION = '0.0.2013-64a5c6b';
interface AppVersionProps {
    className?: string;
}
export function AppVersion({ className = '' }: AppVersionProps) {
    return <span className={className}>Build v{APP_BUILD_VERSION}</span>;
}
