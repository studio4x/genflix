export const APP_BUILD_VERSION = '0.0.2193-20cc71d';
interface AppVersionProps {
    className?: string;
}
export function AppVersion({ className = '' }: AppVersionProps) {
    return <span className={className}>Build v{APP_BUILD_VERSION}</span>;
}
