import { useEffect, useState } from 'react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';

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
          zIndex: 1000,
        },
        buttonNext: {
          backgroundColor: 'var(--primary)',
          color: 'var(--primary-foreground)',
          padding: '8px 16px',
          borderRadius: '6px',
        },
        buttonBack: {
          color: 'var(--foreground)',
          marginRight: 8,
        },
        buttonSkip: {
          color: 'var(--muted-foreground)',
          padding: '8px 16px',
          borderRadius: '6px',
          textTransform: 'none',
        },
        tooltipContainer: {
          textAlign: 'left',
          padding: '20px',
        },
        tooltipTitle: {
          color: 'var(--foreground)',
          fontSize: '16px',
          fontWeight: 'bold',
        },
        tooltipContent: {
          color: 'var(--muted-foreground)',
          fontSize: '14px',
          margin: '8px 0',
        },
      }}
      floaterProps={{
        styles: {
          arrow: {
            length: 8,
            spread: 12,
          },
        },
      }}
    />
  );
}