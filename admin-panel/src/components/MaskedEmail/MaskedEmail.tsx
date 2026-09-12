import { useMemo } from 'react';

interface MaskedEmailProps {
  email: string;
}

export const MaskedEmail = ({ email }: MaskedEmailProps) => {
  const { localPart, domain } = useMemo(() => {
    if (!email || !email.includes('@')) {
      return { localPart: email, domain: '' };
    }
    const [local, dom] = email.split('@');
    return { localPart: local, domain: dom };
  }, [email]);

  if (!domain) {
    return <span className="text-zinc-200">{email}</span>;
  }

  // Interspersed masking: replace characters at index 2, 6, 10... with '*'
  const maskedLocalChars = localPart.split('').map((char, i) => {
    return (i % 4 === 2) ? '*' : char;
  });

  return (
    <div className="inline-flex items-center text-[13.5px]">
      <span className="font-semibold text-zinc-200">
        {maskedLocalChars.map((char, i) => {
          if (char === '*') {
            return (
              <span 
                key={i} 
                className="text-[#C5A073] text-base leading-none inline-flex items-center justify-center px-[0.5px]"
                style={{ transform: 'translateY(1.5px)' }}
              >
                {char}
              </span>
            );
          }
          return <span key={i}>{char}</span>;
        })}
      </span>
      <span className="text-zinc-400 font-medium ml-0.5">@{domain}</span>
    </div>
  );
};
