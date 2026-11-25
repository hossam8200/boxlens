import { describe, it, expect, beforeEach } from 'vitest';
import { detectMode, renderVgm } from '../vgm';

describe('detectMode — smart-search auto-detection (pure)', () => {
  it('detects a container number (4 letters + 1–7 digits)', () => {
    expect(detectMode('CSQU3054383')).toBe('container');
    expect(detectMode('csqu 305438 3')).toBe('container'); // tolerates spaces + lowercase
    expect(detectMode('MSCU12')).toBe('container'); // partial (4 letters + digits)
  });
  it('detects an ISO 6346 size/type code (4 chars)', () => {
    expect(detectMode('22G1')).toBe('sizetype');
    expect(detectMode('45R1')).toBe('sizetype');
    expect(detectMode('42G0')).toBe('sizetype');
    expect(detectMode('22U1')).toBe('sizetype');
  });
  it('detects a BIC owner code (3–4 letters)', () => {
    expect(detectMode('MSCU')).toBe('owner');
    expect(detectMode('CSQ')).toBe('owner');
    expect(detectMode('oneu')).toBe('owner');
  });
  it('returns null for empty / numeric-only / ambiguous input', () => {
    expect(detectMode('')).toBeNull();
    expect(detectMode('!@#')).toBeNull();
    expect(detectMode('12345')).toBeNull();
    expect(detectMode('ABC')).toBe('owner'); // 3 letters → owner (not null)
  });
});

describe('renderVgm — tabbed shell + smart search (jsdom)', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(root);
    renderVgm(root);
  });

  it('renders the header, smart search and three tabs', () => {
    expect(root.querySelector('#smartInput')).toBeTruthy();
    expect(root.querySelector('#vgmStatusChip')!.textContent).toContain('OFFLINE');
    expect(root.querySelectorAll('.vgm-tab')).toHaveLength(3);
    expect(root.querySelector('#tab-container')!.textContent).toBe('Container');
    expect(root.querySelector('#tab-vgm')!.textContent).toBe('VGM');
    expect(root.querySelector('#tab-route')!.textContent).toBe('Route');
  });

  it('defaults to the Container tab (others hidden)', () => {
    expect(root.querySelector('#tab-container')!.classList.contains('active')).toBe(true);
    expect(root.querySelector<HTMLElement>('#panel-container')!.hidden).toBe(false);
    expect(root.querySelector<HTMLElement>('#panel-vgm')!.hidden).toBe(true);
    expect(root.querySelector<HTMLElement>('#panel-route')!.hidden).toBe(true);
  });

  it('shows the detected mode chip + number anatomy as the user types', () => {
    const input = root.querySelector<HTMLInputElement>('#smartInput')!;
    input.value = 'CSQU3054383';
    input.dispatchEvent(new Event('input'));
    const chip = root.querySelector('#smartModeChip')!;
    expect(chip.textContent).toBe('CONTAINER');
    expect(chip.getAttribute('data-mode')).toBe('container');
    // anatomy splits into owner / category / serial / check (4 segments)
    const segs = root.querySelectorAll('#anatomy .vgm-seg');
    expect(segs.length).toBe(4);
    expect(root.querySelector('#anatomy .vgm-seg-owner .vgm-seg-val')!.textContent).toBe('CSQ');
    expect(root.querySelector('#anatomy .vgm-seg-cat .vgm-seg-val')!.textContent).toBe('U');
    expect(root.querySelector('#anatomy .vgm-seg-serial .vgm-seg-val')!.textContent).toBe('305438');
    expect(root.querySelector('#anatomy .vgm-seg-check .vgm-seg-val')!.textContent).toBe('3');
  });

  it('validates a valid container number on Go and shows the spec result', () => {
    const input = root.querySelector<HTMLInputElement>('#smartInput')!;
    input.value = 'CSQU3054383';
    root.querySelector<HTMLButtonElement>('#smartGo')!.click();
    const status = root.querySelector('.vgm-status')!;
    expect(status.classList.contains('vgm-ok')).toBe(true);
    expect(root.querySelector('#cnResult h3')!.textContent).toBe('CSQU3054383');
    // silhouette + bars rendered from the decoded size/type
    expect(root.querySelector('.vgm-silhouette')).toBeTruthy();
    expect(root.querySelectorAll('.vgm-bar').length).toBeGreaterThanOrEqual(3);
  });

  it('on a wrong check digit, shows the expected digit + a one-click Fix button', () => {
    const input = root.querySelector<HTMLInputElement>('#smartInput')!;
    input.value = 'CSQU3054380'; // correct check digit is 3, not 0
    root.querySelector<HTMLButtonElement>('#smartGo')!.click();
    const status = root.querySelector('.vgm-status')!;
    expect(status.classList.contains('vgm-bad')).toBe(true);
    const fix = root.querySelector<HTMLButtonElement>('#cnFix');
    expect(fix).toBeTruthy();
    expect(fix!.dataset.fix).toBe('CSQU3054383');
    // clicking Fix corrects the input + re-validates
    fix!.click();
    expect(root.querySelector<HTMLInputElement>('#smartInput')!.value).toBe('CSQU3054383');
    expect(root.querySelector('.vgm-status')!.classList.contains('vgm-ok')).toBe(true);
  });

  it('switches to the VGM tab on tab click (Container hidden)', () => {
    root.querySelector<HTMLButtonElement>('#tab-vgm')!.click();
    expect(root.querySelector('#tab-vgm')!.classList.contains('active')).toBe(true);
    expect(root.querySelector<HTMLElement>('#panel-vgm')!.hidden).toBe(false);
    expect(root.querySelector<HTMLElement>('#panel-container')!.hidden).toBe(true);
  });

  it('records recent lookups as chips', () => {
    const input = root.querySelector<HTMLInputElement>('#smartInput')!;
    input.value = 'CSQU3054383';
    root.querySelector<HTMLButtonElement>('#smartGo')!.click();
    const rec = root.querySelector<HTMLButtonElement>('#recentChips button[data-rec]');
    expect(rec).toBeTruthy();
    expect(rec!.textContent).toBe('CSQU3054383');
  });
});
