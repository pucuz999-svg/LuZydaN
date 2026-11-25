import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  centered?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  centered = false,
}) => {
  const iconBox =
    size === 'lg'
      ? 'h-11 w-11 rounded-xl'
      : size === 'sm'
        ? 'h-7 w-7 rounded-lg'
        : 'h-8 w-8 rounded-lg';

  const svgSize =
    size === 'lg' ? 'h-6 w-6' : size === 'sm' ? 'h-4 w-4' : 'h-4.5 w-4.5';

  const textSize =
    size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-xl';

  return (
    <div
      className={`inline-flex items-center gap-2.5 select-none ${
        centered ? 'justify-center' : ''
      }`}
    >
      <span
        className={`inline-flex items-center justify-center border border-orange-500/45 bg-[#161C2B] shadow-sm shadow-orange-500/15 shrink-0 ${iconBox}`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={svgSize}
        >
          <circle
            cx="16"
            cy="16"
            r="11.5"
            stroke="#F97316"
            strokeWidth="2.2"
          />
          <path
            d="M16 2V6.5M16 25.5V30M2 16H6.5M25.5 16H30"
            stroke="#F97316"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M10.5 11.5H16.5V13.8H13V15.3H15.8V17.4H13V21H10.5V11.5Z"
            fill="#F8FAFC"
          />
          <path
            d="M17.5 11.5H23V13.8H19.9V15.3H22.4V17.4H19.9V21H17.5V11.5Z"
            fill="#F97316"
          />
        </svg>
      </span>
      <span className={`font-bold tracking-wider text-white uppercase ${textSize}`}>
        FF <span className="text-orange-500">TUNE</span>
      </span>
    </div>
  );
};
