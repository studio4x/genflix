export const APP_BUILD_VERSION = '0.0.2119-282a0d5';
interface AppVersionProps {
    className?: string;
}
export function AppVersion({ className = '' }: AppVersionProps) {
    return <span className={className}>Build v{APP_BUILD_VERSION}</span>;
}
