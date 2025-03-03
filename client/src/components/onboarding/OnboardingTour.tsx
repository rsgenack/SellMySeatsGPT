import { useEffect, useState } from 'react';
import Joyride, { CallBackProps, EVENTS, Step } from 'react-joyride';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';

const steps: Step[] = [
  {
    target: '.email-submission',
    content: '👋 Welcome! This is your unique ticket submission email address. Any tickets forwarded to this address will be automatically processed and added to your account.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '.stats-section',
    content: '📊 Your Dashboard Overview: Track your sales performance, monitor listings, and see your total revenue all in one place.',
    placement: 'top',
  },
  {
    target: '.listings-tab',
    content: '🎫 My Listings: Here you can view and manage all your active ticket listings. Track sales status and update pricing.',
    placement: 'bottom',
  },
  {
    target: '.pending-tab',
    content: '⏳ Pending Tickets: When you forward ticket emails, they\'ll appear here first. Review and confirm the details before listing.',
    placement: 'bottom',
  },
  {
    target: '.new-listing-tab',
    content: '✨ Create New Listings: Need to list tickets manually? Use this tab to enter ticket details and set your asking price.',
    placement: 'bottom',
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
    const { type } = data;
    if ([EVENTS.TOUR_END, EVENTS.SKIP].includes(type)) {
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
          arrowColor: 'var(--background)',
        },
        buttonNext: {
          backgroundColor: 'var(--primary)',
          color: 'var(--primary-foreground)',
          padding: '10px 20px',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: '500',
          border: 'none',
          cursor: 'pointer',
          transition: 'opacity 0.2s ease',
        },
        buttonBack: {
          color: 'var(--foreground)',
          marginRight: 12,
          padding: '10px 20px',
          fontSize: '14px',
          backgroundColor: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          cursor: 'pointer',
          transition: 'background-color 0.2s ease',
        },
        buttonSkip: {
          color: 'var(--muted-foreground)',
          padding: '10px 20px',
          borderRadius: '6px',
          textTransform: 'none',
          fontSize: '14px',
          backgroundColor: 'transparent',
          border: '1px solid var(--border)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        },
        tooltipContainer: {
          textAlign: 'left',
          padding: '24px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        },
        tooltipTitle: {
          color: 'var(--foreground)',
          fontSize: '18px',
          fontWeight: '600',
          marginBottom: '12px',
        },
        tooltipContent: {
          color: 'var(--muted-foreground)',
          fontSize: '15px',
          lineHeight: '1.6',
          margin: '16px 0',
        },
        spotlight: {
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
        },
      }}
      floaterProps={{
        styles: {
          arrow: {
            length: 8,
            spread: 12,
          },
        },
        disableAnimation: false,
      }}
    />
  );
}