import Image from 'next/image';
import { cn } from '@/shared/lib/utils';

interface BrandLogoProps {
  className?: string;
  imageClassName?: string;
  priority?: boolean;
}

export function BrandLogo({ className, imageClassName, priority = false }: BrandLogoProps) {
  return (
    <div className={cn('inline-flex h-10 items-center justify-center', className)}>
      <Image
        src="/icons/Logo-black.png"
        alt="Amor Amar"
        width={640}
        height={220}
        sizes="(max-width: 640px) 120px, (max-width: 1024px) 150px, 180px"
        priority={priority}
        className={cn(
          'h-full w-auto max-w-full object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]',
          imageClassName
        )}
      />
    </div>
  );
}
