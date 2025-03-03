import { useEffect, useState } from 'react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { useAuth } from '@/hooks/use-auth';

const steps: Step[] = [
  {
    target: '.email-submission',
    content: 'This is your unique email address for ticket submissions. Forward your ticket transfer emails here to automatically process them.',
    disableBeacon: true,
  },
  {
    target: '.stats-section',
    content: 'View your ticket sales statistics and overall performance here.',
  },
  {
    target: '.listings-tab',
    content: 'View and manage all your ticket listings in one place.',
  },
  {
    target: '.pending-tab',
    content: 'Check your pending tickets that are waiting to be processed.',
  },
  {
    target: '.new-listing-tab',
    content: 'Create new ticket listings manually from this section.',
  },
];

export function OnboardingTour() {
  const [run, setRun] = useState(false);
  const { user } = useAuth();
  
  useEffect(() => {
    // Check if this is the user's first visit
    const hasSeenTour = localStorage.getItem('hasSeenTour');
    if (!hasSeenTour && user) {
      setRun(true);
    }
  }, [user]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setRun(false);
      localStorage.setItem('hasSeenTour', 'true');
    }
  };

  return (
    <Joyride
      callback={handleJoyrideCallback}
      continuous
      hideCloseButton
      run={run}
      scrollToFirstStep
      showProgress
      showSkipButton
      steps={steps}
      styles={{
        options: {
          primaryColor: 'var(--primary)',
          textColor: 'var(--foreground)',
          backgroundColor: 'var(--background)',
        },
      }}
    />
  );
}
