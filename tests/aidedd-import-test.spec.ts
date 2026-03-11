import { test } from '@playwright/test';
import path from 'path';

const TESTING_DIR = 'D:/Projects/aidnd/.testing';
const XML_FILE = path.join(TESTING_DIR, 'Vig Vaski-export.xml');

test('import character XML into aidedd.org creator', async ({ page }) => {
  page.setDefaultTimeout(30000);

  // Listen for any JS dialogs
  const dialogs: string[] = [];
  page.on('dialog', async (dialog) => {
    console.log(`Dialog appeared: type=${dialog.type()}, message="${dialog.message()}"`);
    dialogs.push(`${dialog.type()}: ${dialog.message()}`);
    await dialog.accept();
  });

  // Step 1: Navigate
  console.log('Step 1: Navigating to aidedd.org/dnd-creator/...');
  await page.goto('https://www.aidedd.org/dnd-creator/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(TESTING_DIR, 'aidedd-import-step1.png'), fullPage: true });

  // Step 2: Set file and click IMPORT
  console.log('Step 2: Setting file and clicking IMPORT...');
  const fileInput = await page.$('input#xmlfile');
  if (!fileInput) { console.log('ERROR: No file input found!'); return; }
  await fileInput.setInputFiles(XML_FILE);
  await page.waitForTimeout(500);

  const importButton = await page.$('button:has-text("IMPORT")');
  if (!importButton) { console.log('ERROR: No IMPORT button found!'); return; }
  await importButton.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(TESTING_DIR, 'aidedd-import-step2-after-import.png'), fullPage: true });
  console.log('Screenshot saved: after import click');

  // Step 3: Walk through the wizard by clicking NEXT repeatedly
  console.log('Step 3: Walking through wizard steps with NEXT...');
  const nextButton = await page.$('#btNext');
  if (!nextButton) { console.log('ERROR: No NEXT button found!'); return; }

  let stepNum = 0;
  const maxSteps = 20; // Safety limit

  for (let i = 0; i < maxSteps; i++) {
    stepNum++;

    // Check what's visible on the current step
    const stepTitle = await page.$eval('#creation', el => {
      // Get the first visible heading or label
      const h = el.querySelector('h2, h3, .step-title, legend');
      return h?.textContent?.trim() || '';
    }).catch(() => '');

    // Get all visible text in the creation div (first 500 chars)
    const stepContent = await page.$eval('#creation', el => el.innerText.substring(0, 500)).catch(() => '');

    // Check if we can detect which step we're on from select elements
    const selects = await page.$$eval('#creation select:not([style*="display: none"])', els =>
      els.map(el => ({
        id: el.id,
        name: el.name,
        selectedText: el.options[el.selectedIndex]?.text || '',
        selectedValue: el.value,
        optionCount: el.options.length
      }))
    ).catch(() => []);

    console.log(`\n--- Wizard Step ${stepNum} ---`);
    if (stepTitle) console.log(`Step title: ${stepTitle}`);
    console.log(`Content preview: ${stepContent.substring(0, 200)}`);
    if (selects.length > 0) {
      console.log(`Selects: ${JSON.stringify(selects)}`);
    }

    // Take screenshot of this step
    await page.screenshot({ path: path.join(TESTING_DIR, `aidedd-import-wizard-step${stepNum}.png`), fullPage: false });

    // Click NEXT
    const isNextDisabled = await nextButton.isDisabled().catch(() => true);
    if (isNextDisabled) {
      console.log('NEXT button is disabled - reached the end');
      break;
    }

    // Check if NEXT button is still visible/clickable
    const isNextVisible = await nextButton.isVisible().catch(() => false);
    if (!isNextVisible) {
      console.log('NEXT button is not visible - done');
      break;
    }

    await nextButton.click();
    await page.waitForTimeout(1500);

    // Check if content changed (if we're stuck on the same step)
    const newContent = await page.$eval('#creation', el => el.innerText.substring(0, 200)).catch(() => '');
    if (newContent === stepContent.substring(0, 200) && i > 0) {
      console.log('Content did not change - might be at the end');
      // Try one more time
      await nextButton.click();
      await page.waitForTimeout(1000);
      const retryContent = await page.$eval('#creation', el => el.innerText.substring(0, 200)).catch(() => '');
      if (retryContent === newContent) {
        console.log('Still no change - stopping');
        break;
      }
    }
  }

  console.log(`\nCompleted ${stepNum} wizard steps`);

  // Step 4: Now check the character sheet (should be on P1 with full data)
  console.log('\nStep 4: Reading final character sheet...');

  // Go to P1 to see the sheet
  const p1Button = await page.$('#bp1');
  if (p1Button) {
    await p1Button.click();
    await page.waitForTimeout(2000);
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(TESTING_DIR, 'aidedd-import-final-sheet-top.png'), fullPage: false });
  await page.screenshot({ path: path.join(TESTING_DIR, 'aidedd-import-final-sheet-full.png'), fullPage: true });

  // Read all visible fields
  const fieldsToCheck = [
    'myName', 'myClass', 'myLevel', 'myXP',
    'myStr', 'myDex', 'myCon', 'myInt', 'myWis', 'myCha',
    'myHP', 'myAC', 'myInit', 'mySpeed', 'myProf',
    'myAlign', 'mySize',
    'mySpellAbi', 'mySpellMod', 'mySpellDC', 'mySpellAtt',
    'myPerc',
    'myCP', 'mySP', 'myEP', 'myGP', 'myPP',
    'wname1', 'wbonus1', 'wdg1', 'wnote1',
    'wname2', 'wbonus2', 'wdg2', 'wnote2',
    'wname3', 'wbonus3', 'wdg3', 'wnote3',
  ];

  const finalData: Record<string, string> = {};
  for (const fieldId of fieldsToCheck) {
    const el = await page.$(`#${fieldId}`);
    if (el) {
      const value = await el.inputValue().catch(() => null) || await el.textContent().catch(() => null) || '';
      if (value && value !== '' && value !== '...') {
        finalData[fieldId] = value;
      }
    }
  }

  // Read hidden fields
  const hiddenFields = ['class1', 'level1', 'voie1', 'species', 'back', 'align',
    'hp', 'armor', 'weapons', 'feats', 'skillE', 'skillC', 'lang', 'tool'];
  const hiddenData: Record<string, string> = {};
  for (const name of hiddenFields) {
    const el = await page.$(`input[name="${name}"]`);
    if (el) {
      const value = await el.inputValue();
      if (value) hiddenData[name] = value;
    }
  }

  // Check proficiencies
  const saveNames = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
  const saveProfs: string[] = [];
  for (let i = 0; i < 6; i++) {
    const el = await page.$(`#myJdsProf${i}`);
    if (el && await el.isChecked()) saveProfs.push(saveNames[i]);
  }

  const skillNames = [
    'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception',
    'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine',
    'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion',
    'Sleight of Hand', 'Stealth', 'Survival'
  ];
  const skillProfs: string[] = [];
  for (let i = 0; i < 18; i++) {
    const el = await page.$(`#mySkiProf${i}`);
    if (el && await el.isChecked()) skillProfs.push(skillNames[i]);
  }

  const armorProfs: string[] = [];
  for (const [id, name] of [['profL', 'Light'], ['profM', 'Medium'], ['profH', 'Heavy'], ['profS', 'Shields']] as const) {
    const el = await page.$(`#${id}`);
    if (el && await el.isChecked()) armorProfs.push(name);
  }

  // Take scrolling screenshots
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(TESTING_DIR, 'aidedd-import-final-abilities.png'), fullPage: false });

  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(TESTING_DIR, 'aidedd-import-final-combat.png'), fullPage: false });

  // Print summary
  console.log('\n=== IMPORT SUMMARY ===');
  console.log(`Character Name: ${finalData['myName'] || '(empty)'}`);
  console.log(`Class: ${finalData['myClass'] || '(empty)'}`);
  console.log(`Level: ${finalData['myLevel'] || '(empty)'}`);
  console.log(`Abilities: STR=${finalData['myStr']||'-'} DEX=${finalData['myDex']||'-'} CON=${finalData['myCon']||'-'} INT=${finalData['myInt']||'-'} WIS=${finalData['myWis']||'-'} CHA=${finalData['myCha']||'-'}`);
  console.log(`HP: ${finalData['myHP'] || '-'}, AC: ${finalData['myAC'] || '-'}, Init: ${finalData['myInit'] || '-'}, Speed: ${finalData['mySpeed'] || '-'}`);
  console.log(`Prof Bonus: ${finalData['myProf'] || '-'}`);
  console.log(`Save profs: ${saveProfs.join(', ') || 'none'}`);
  console.log(`Skill profs: ${skillProfs.join(', ') || 'none'}`);
  console.log(`Armor profs: ${armorProfs.join(', ') || 'none'}`);
  console.log(`Currency: CP=${finalData['myCP']||'0'} SP=${finalData['mySP']||'0'} EP=${finalData['myEP']||'0'} GP=${finalData['myGP']||'0'} PP=${finalData['myPP']||'0'}`);
  console.log(`Weapons: ${finalData['wname1']||'-'}, ${finalData['wname2']||'-'}, ${finalData['wname3']||'-'}`);
  console.log(`Spellcasting: Ability=${finalData['mySpellAbi']||'-'} Mod=${finalData['mySpellMod']||'-'} DC=${finalData['mySpellDC']||'-'} Att=${finalData['mySpellAtt']||'-'}`);
  console.log(`Hidden fields: ${JSON.stringify(hiddenData)}`);
  console.log(`Dialogs: ${dialogs.join('; ') || 'none'}`);
  console.log(`Total visible fields: ${Object.keys(finalData).length}`);
  console.log('======================\n');

  // Check the printable page (P3)
  const p3Button = await page.$('#bp3');
  if (p3Button) {
    await p3Button.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(TESTING_DIR, 'aidedd-import-printable-full.png'), fullPage: true });
    console.log('Printable page screenshot saved');
  }

  await page.waitForTimeout(2000);
});
