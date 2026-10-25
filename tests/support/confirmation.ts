import { expect, type Page } from '@playwright/test';

export async function respondToConfirmation(page: Page, accept = true) {
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog
    .locator(accept ? '.app-confirmation-accept' : '.app-confirmation-cancel')
    .click();
  await expect(dialog).not.toBeVisible();
}
