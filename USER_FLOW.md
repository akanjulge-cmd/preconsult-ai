# PreConsult AI — Patient-Facing User Flow

## Step 1: Accessible Onboarding & Language
- Language picker (large buttons with clear flags/scripts: English, Español, Hindi, Telugu).
- Audio greeting and prompt read-aloud option.

## Step 2: Accessibility Preferences
- Interaction Mode:
  - **Standard Touch**: General touchscreen interface.
  - **Non-Speaking Mode (AAC)**: Zero voice/speech required; icon and visual semantic cards.
  - **Motor / Tremor Assistance**: Enlarged targets (>=64px), generous hit padding, tap forgiveness.
- Visual Controls:
  - **High Contrast**: High visibility theme for low-vision patients.
  - **Reduced Motion**: Disables active looping animations, showing static high-contrast icon badges.
  - **Text Scaling**: Standard, Large, Extra Large.
  - **Audio Guidance**: Web Speech API audio prompts for questions.

## Step 3: Plain-Language Consent
- Explains data privacy and human-in-the-loop review.
- Big, unmistakable "I Understand & Begin" button.

## Step 4: Interactive Body Map Selection
- Full anatomical figure with **Front / Back** flip toggle.
- Clear persistent **Left / Right** orientation markers.
- Tap a macro-region (e.g. Abdomen, Chest, Head, Knee) -> transitions to micro-anatomical zone.

## Step 5: Adaptive Semantic Visual Symptom Choice
- Non-verbal visual selection:
  - **Burning / Acidity**: Rising flame animation (or static flame icon in reduced-motion mode).
  - **Cramping / Tightness**: Contracting band animation (or static clamp icon).
  - **Sharp / Acute**: Pulsating needle geometry (or static needle icon).
  - **Dull / Pressure**: Gentle pulsating wave (or static wave icon).

## Step 6: Visual Severity & Timeline
- Color-coded 1–10 slider (calm cyan to intense red).
- Rapid duration selector (Today, 2-3 days, 1+ week, Chronic).
- Optional associated symptom quick-chips.

## Step 7: Confirmation, Undo & Submission
- Clear visual card summarizing location, character, and severity.
- Obvious "Go Back / Change" and "Undo" buttons.
- "Submit for Doctor Review" confirmation state.
