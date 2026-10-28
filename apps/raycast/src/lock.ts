import { showHUD, showToast, Toast } from '@raycast/api';
import { request } from './bridge';
export default async function LockVault() {
  try {
    await request({ type: 'lock' });
    await showHUD('OxVault locked');
  } catch {
    await showToast({
      style: Toast.Style.Failure,
      title: 'Could not lock OxVault',
      message: 'Open OxVault and try again.',
    });
  }
}
