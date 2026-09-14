import { expect, type Locator, type Page } from '@playwright/test';

/** The map stage at /maps/:id — annotations, placement, and zoom chrome. */
export class MapViewPage {
  readonly backToMapsLink: Locator;
  readonly title: Locator;
  readonly mapFrame: Locator;
  readonly mapImage: Locator;
  readonly labelToggle: Locator;
  readonly pointToggle: Locator;
  readonly regionToggle: Locator;
  readonly placementHint: Locator;
  readonly editor: Locator;
  readonly editorTitle: Locator;
  readonly labelTextInput: Locator;
  readonly targetSelect: Locator;
  readonly textSizeInput: Locator;
  readonly textColorInput: Locator;
  readonly typefaceSelect: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  constructor(private readonly page: Page) {
    this.backToMapsLink = page.getByRole('link', { name: 'Back to maps' });
    this.title = page.locator('h1.map-view-title');
    this.mapFrame = page.getByRole('group', {
      name: 'Map. Zoom with plus and minus, pan with the arrow keys, reset with zero.',
    });
    this.mapImage = page.locator('img.map-image');
    this.labelToggle = page.getByRole('button', { name: 'Place a text label' });
    this.pointToggle = page.getByRole('button', { name: 'Place a point of interest' });
    this.regionToggle = page.getByRole('button', { name: 'Place a region link' });
    this.placementHint = page.getByRole('status').filter({
      hasText: 'Click the map to place a label.',
    });
    this.editor = page.locator('form.annotation-editor');
    this.editorTitle = this.editor.getByRole('heading');
    this.labelTextInput = page.getByLabel('Label text');
    this.targetSelect = page.getByLabel('Opens this map');
    this.textSizeInput = page.getByLabel('Text size');
    this.textColorInput = page.getByLabel('Text color');
    this.typefaceSelect = page.getByLabel('Typeface');
    this.saveButton = this.editor.getByRole('button', { name: 'Save', exact: true });
    this.cancelButton = this.editor.getByRole('button', { name: 'Cancel' });
  }

  async waitForMapReady(mapName: string): Promise<void> {
    await this.page.waitForURL(/\/maps\/[^/]+$/);
    await this.title.waitFor();
    await this.mapImage.waitFor({ state: 'visible' });
    await this.page.getByRole('heading', { name: mapName, exact: true }).waitFor();
  }

  labelButton(labelText: string): Locator {
    return this.page.getByRole('button', {
      name: `${labelText} — opens the linked map`,
    });
  }

  async armLabelPlacement(): Promise<void> {
    await this.labelToggle.click();
  }

  async disarmPlacement(): Promise<void> {
    if ((await this.labelToggle.getAttribute('aria-pressed')) === 'true') {
      await this.labelToggle.click();
    }
    await expect(this.labelToggle).toHaveAttribute('aria-pressed', 'false');
  }

  async clickMapCenter(): Promise<void> {
    await this.mapImage.click({ position: { x: 180, y: 120 } });
  }

  async fillTextLink(options: {
    text: string;
    targetMapName: string;
    color: string;
    typeface: 'sans' | 'serif' | 'condensed';
    textSize: string;
  }): Promise<void> {
    await this.labelTextInput.fill(options.text);
    await this.targetSelect.selectOption({ label: options.targetMapName });
    await this.textSizeInput.fill(options.textSize);
    await this.textColorInput.fill(options.color);
    await this.typefaceSelect.selectOption(options.typeface);
  }

  async saveDraft(): Promise<void> {
    await this.saveButton.click();
    await this.editor.waitFor({ state: 'hidden' });
  }

  async cancelDraft(): Promise<void> {
    await this.cancelButton.click();
    await this.editor.waitFor({ state: 'hidden' });
  }
}
