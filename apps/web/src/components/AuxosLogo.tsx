'use client';

import Image from 'next/image';
import { useState } from 'react';

export default function AuxosLogo() {
  const [logoError, setLogoError] = useState(false);

  if (logoError) {
    // Fallback: just show text if logo fails to load
    return null;
  }

  return (
    <div className="relative h-10 flex-shrink-0">
      <Image
        src="/images/auxos-logo.png"
        alt="Auxos"
        width={150}
        height={50}
        className="h-10 w-auto object-contain"
        priority
        onError={() => setLogoError(true)}
      />
    </div>
  );
}

