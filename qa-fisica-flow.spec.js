const { test, expect } = require('@playwright/test');

test('flujo de 5 opciones: error, reintento y desbloqueo tras acierto', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto('http://127.0.0.1:8124/index-fisica.html');

  const card = page.locator('.exercise-card').filter({ hasText: 'Guía 2 · Reactivo 105' }).first();
  await expect(card).toBeVisible();

  await card.getByRole('button', { name: /^A$/ }).click();
  await expect(card.getByText('Revisa la pista y vuelve a intentarlo')).toBeVisible();
  await expect(card.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  await expect(card.getByText('Incorrecta')).toBeVisible();
  await expect(card.getByText('porque la opción correcta sí corresponde')).toHaveCount(0);

  await card.getByRole('button', { name: 'Ver pista' }).click();
  await expect(card.getByText('Pista')).toBeVisible();

  await card.getByRole('button', { name: 'Reintentar' }).click();
  await expect(card.getByText('Revisa la pista y vuelve a intentarlo')).toHaveCount(0);
  await expect(card.getByText('Pista')).toBeVisible();

  await card.getByRole('button', { name: /^D$/ }).click();
  await expect(card.getByText('Bien resuelto')).toBeVisible();
  await expect(card.getByText('Análisis del reactivo')).toBeVisible();
  await expect(card.getByText('Por qué la correcta sí corresponde')).toBeVisible();
  await expect(card.getByText('Por qué las demás no corresponden')).toBeVisible();
});
