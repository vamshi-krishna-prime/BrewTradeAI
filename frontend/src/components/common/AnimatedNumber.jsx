import React, { useEffect, useState } from 'react';
import { animate } from 'framer-motion';

/**
 * Count-up number animation using framer-motion's `animate` driver.
 * Pass a `format` fn to render currency, percentages, etc.
 */
export default function AnimatedNumber({
  value = 0,
  duration = 1.1,
  format = (n) => Math.round(n).toLocaleString(),
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(0, Number(value) || 0, {
      duration,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplay(latest),
    });
    return () => controls.stop();
  }, [value, duration]);

  return <span>{format(display)}</span>;
}
