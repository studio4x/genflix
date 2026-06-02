import { useId, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
type PasswordFieldProps = InputHTMLAttributes<HTMLInputElement>;
export function PasswordField({ className, id, ...props }: PasswordFieldProps) {
    const fallbackId = useId();
    const inputId = id ?? fallbackId;
    const [isVisible, setIsVisible] = useState(false);
    return (<div className="relative">
      <input id={inputId} type={isVisible ? 'text' : 'password'} className={cn('pr-12', className)} {...props}/>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setIsVisible((current) => !current)} aria-label={isVisible ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={isVisible} className="absolute inset-y-0 right-3 inline-flex items-center justify-center rounded-full text-[#5F7077] transition hover:text-[#1398B7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1398B7]/30">
        {isVisible ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
      </button>
    </div>);
}
