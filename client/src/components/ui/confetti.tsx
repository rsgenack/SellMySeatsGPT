import { useEffect, useState } from 'react';
import ReactConfetti from 'react-confetti';

interface ConfettiProps {
  duration?: number; // Duration in milliseconds
}

export function Confetti({ duration = 3000 }: ConfettiProps) {
  const [isActive, setIsActive] = useState(true);
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);

    // Automatically hide confetti after duration
    const timer = setTimeout(() => {
      setIsActive(false);
    }, duration);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [duration]);

  if (!isActive) return null;

  return (
    <ReactConfetti
      width={windowSize.width}
      height={windowSize.height}
      numberOfPieces={200}
      recycle={false}
      style={{ position: 'fixed', top: 0, left: 0, zIndex: 50 }}
    />
  );
}
