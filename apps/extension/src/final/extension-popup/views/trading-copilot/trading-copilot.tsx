import { Button, useNotification } from 'shared/ui';
import { LatestTransactions } from 'application/trading-copilot/latest-transactions';

import { SettingsLayout } from '../../components';

export const TradingCopilotView = () => {
  const notification = useNotification();
  return (
    <SettingsLayout>
      <SettingsLayout.Header />
      <SettingsLayout.Body>
        <Button
          onClick={() => {
            return notification.show(<LatestTransactions />);
          }}
        >
          CLICK
        </Button>
      </SettingsLayout.Body>
    </SettingsLayout>
  );
};
