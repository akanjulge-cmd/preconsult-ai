// PreConsult AI - Multilingual Translations Dictionary
// Supports: English (en), Hindi (hi), Telugu (te), Spanish (es)

export const TRANSLATIONS = {
  en: {
    // Header & Meta
    brandSubtitle: "Your voice. Your symptoms. A clearer clinical picture.",
    patientMode: "Patient Intake Mode",
    clinicianMode: "Clinician Command Mode",
    diagnosticMode: "Diagnostic Mode",
    accessibility: "Accessibility",
    selectLanguage: "Select Patient Language",

    // Navigation Tabs
    navIntake: "1. Patient Intake & 3D Body",
    navScanner: "2. Rx & Lab Scanner",
    navDoctor: "3. Clinician Command Center",
    navDiagnostics: "System Diagnostics",

    // Steps
    stepLanguage: "1. Language",
    stepPreferences: "2. Preferences",
    stepConsent: "3. Consent",
    stepLocation: "4. Location",
    stepSensation: "5. Sensation",
    stepSeverity: "6. Severity",
    stepClarify: "7. Clarify",
    stepConfirm: "8. Confirm",

    // Common Actions
    next: "Next →",
    back: "← Back",
    continue: "Continue →",
    confirmAndProceed: "Confirm & Proceed →",
    submitIntake: "Transmit Intake to Clinician →",
    submitting: "Transmitting Intake...",
    retry: "Retry",
    cancel: "Cancel",
    save: "Save",
    clear: "Clear",

    // Step 1: Language
    langTitle: "Select Your Language",
    langSubtitle: "Choose the language you feel most comfortable communicating with:",
    listenGreeting: "🔊 Listen Greeting",

    // Step 2: Preferences
    prefTitle: "Accessibility & Input Preferences",
    prefSubtitle: "Customize how you interact with PreConsult AI:",
    modeNonSpeaking: "Non-Speaking / Touch First",
    modeTremor: "Motor Assistance / Large Targets",
    modeStandard: "Standard Interactive Mode",

    // Step 3: Consent
    consentTitle: "Patient Privacy & Clinical Consent",
    consentSubtitle: "PreConsult AI prepares a structured summary for your attending doctor.",
    consentBody: "Your responses are encrypted, HIPAA-compliant, and transmitted directly to your physician's command center. The AI does not diagnose you; your licensed clinician makes all medical determinations.",
    consentCheckbox: "I agree to share my reported symptoms and medical history with the care team.",

    // Step 4: 3D Body Location
    bodyTitle: "Let's understand how you're feeling.",
    bodySubtitle: "You can show us where it hurts and describe what you're experiencing in your own words.",
    selectedArea: "Selected Area:",
    selectedLocations: "Selected Locations",
    tellMeWhat: "🎙️ Tell me what you're experiencing →",
    frontView: "Front View",
    backView: "Back View",
    resetView: "Reset View",
    zoomIn: "+ Zoom In",
    zoomOut: "- Zoom Out",

    // Step 5: Sensation & Voice
    sensationTitle: "Describe What You're Feeling",
    sensationSubtitle: "Speak your symptoms naturally, or choose visual sensations below:",
    recordVoice: "🎙️ Record Voice Symptoms",
    stopRecording: "⏹️ Stop Recording",
    recordingTimer: "Recording: ",
    transcribing: "Processing Audio & Extracting Symptoms...",
    voiceInstruction: "Speak freely in your preferred language. You can mention when it started, how severe it is, and any other feelings.",
    typeInstead: "Type your symptoms instead",
    submitText: "Analyze Typed Symptoms",

    // Step 6: Severity & Onset
    severityTitle: "Rate Your Discomfort",
    severitySubtitle: "On a scale from 1 (mild) to 10 (emergency-level):",
    onsetLabel: "When did this sensation start?",
    onsetToday: "Started Today (< 24 hrs)",
    onsetDays: "2 to 3 days ago",
    onsetWeek: "About a week ago",
    onsetMonths: "Over a month (Chronic)",

    // Step 7: Clarifying Questions
    clarifyTitle: "Clarifying Questions",
    clarifySubtitle: "A few quick questions to help your doctor understand:",

    // Step 8: Confirmation & Summary
    confirmTitle: "Review Your Intake Summary",
    confirmSubtitle: "Please review what will be shared with your attending clinician:",
    chiefConcern: "Chief Concern",
    location: "Location",
    character: "Character",
    severity: "Severity",
    onset: "Onset",
    associatedSymptoms: "Associated Symptoms",
    transcript: "Your Spoken Words",
    translation: "English Translation",
    safetyStatus: "Safety Assessment",
    safetySafe: "Routine Intake — No Acute Red Flags Detected",
    safetyUrgent: "CRITICAL ALERT: Urgent Clinical Review Required",
    patientConfirmedBadge: "Patient-Confirmed",
    aiInferredBadge: "AI-Inferred",

    // Transmitted View
    transmittedTitle: "Intake Transmitted to Clinician Command Center",
    transmittedSubtitle: "Your intake has been securely saved to the database and queued for physician review.",
    ticketLabel: "Your Queue Ticket:",
    openDoctorBrief: "Open Clinician 60-Second Brief →",
    startNew: "Start New Intake",
  },

  hi: {
    // Header & Meta
    brandSubtitle: "आपकी आवाज़। आपके लक्षण। एक स्पष्ट नैदानिक तस्वीर।",
    patientMode: "रोगी सेवन मोड",
    clinicianMode: "चिकित्सक कमांड मोड",
    diagnosticMode: "निदान प्रणाली मोड",
    accessibility: "सुलभता",
    selectLanguage: "भाषा चुनें",

    // Navigation Tabs
    navIntake: "१. रोगी सेवन और 3D शरीर",
    navScanner: "२. प्रिस्क्रिप्शन और लैब स्कैनर",
    navDoctor: "३. चिकित्सक कमांड केंद्र",
    navDiagnostics: "सिस्टम डायग्नोस्टिक्स",

    // Steps
    stepLanguage: "१. भाषा",
    stepPreferences: "२. प्राथमिकताएं",
    stepConsent: "३. सहमति",
    stepLocation: "४. स्थान",
    stepSensation: "५. लक्षण",
    stepSeverity: "६. तीव्रता",
    stepClarify: "७. स्पष्टीकरण",
    stepConfirm: "८. पुष्टि",

    // Common Actions
    next: "अगला →",
    back: "← पीछे",
    continue: "जारी रखें →",
    confirmAndProceed: "पुष्टि करें और आगे बढ़ें →",
    submitIntake: "चिकित्सक को विवरण भेजें →",
    submitting: "विवरण भेजा जा रहा है...",
    retry: "पुनः प्रयास करें",
    cancel: "रद्द करें",
    save: "सहेजें",
    clear: "साफ़ करें",

    // Step 1: Language
    langTitle: "अपनी भाषा चुनें",
    langSubtitle: "वह भाषा चुनें जिसमें आप सबसे सहज महसूस करते हैं:",
    listenGreeting: "🔊 अभिवादन सुनें",

    // Step 2: Preferences
    prefTitle: "सुलभता एवं इनपुट प्राथमिकताएं",
    prefSubtitle: "चुनें कि आप प्रीकंसल्ट एआई का उपयोग कैसे करना चाहते हैं:",
    modeNonSpeaking: "मौन / स्पर्श-आधारित मोड",
    modeTremor: "मोटर सहायता / बड़े स्पर्श लक्ष्य",
    modeStandard: "मानक इंटरैक्टिव मोड",

    // Step 3: Consent
    consentTitle: "गोपनीयता और नैदानिक सहमति",
    consentSubtitle: "प्रीकंसल्ट एआई आपके डॉक्टर के लिए एक संरचित सारांश तैयार करता है।",
    consentBody: "आपकी जानकारी सुरक्षित रूप से संग्रहीत की जाती है और सीधे डॉक्टर के डैशबोर्ड पर भेजी जाती है। यह प्रणाली केवल लक्षण एकत्र करने के लिए है; अंतिम नैदानिक निर्णय केवल चिकित्सक द्वारा लिया जाता है।",
    consentCheckbox: "मैं अपने लक्षण और इतिहास को डॉक्टर के साथ साझा करने की सहमति देता हूँ।",

    // Step 4: 3D Body Location
    bodyTitle: "आइए समझें कि आप कैसा महसूस कर रहे हैं।",
    bodySubtitle: "3D मॉडल पर बताएं कि आपको दर्द या परेशानी कहाँ है:",
    selectedArea: "चयनित क्षेत्र:",
    selectedLocations: "चयनित स्थान",
    tellMeWhat: "🎙️ बताएं कि आप क्या महसूस कर रहे हैं →",
    frontView: "सामने का दृश्य",
    backView: "पीछे का दृश्य",
    resetView: "रीसेट दृश्य",
    zoomIn: "+ ज़ूम इन",
    zoomOut: "- ज़ूम आउट",

    // Step 5: Sensation & Voice
    sensationTitle: "अपने लक्षण बताएं",
    sensationSubtitle: "अपनी भाषा में बोलें या नीचे दिए गए लक्षणों को स्पर्श करें:",
    recordVoice: "🎙️ बोलकर लक्षण बताएं",
    stopRecording: "⏹️ रिकॉर्डिंग रोकें",
    recordingTimer: "रिकॉर्डिंग: ",
    transcribing: "आवाज़ का विश्लेषण और अनुवाद हो रहा है...",
    voiceInstruction: "अपनी भाषा में खुलकर बोलें। आप बता सकते हैं कि यह कब शुरू हुआ, कितना गंभीर है और क्या महसूस हो रहा है।",
    typeInstead: "लिखकर लक्षण दर्ज करें",
    submitText: "लक्षणों का विश्लेषण करें",

    // Step 6: Severity & Onset
    severityTitle: "दर्द या परेशानी की तीव्रता दर",
    severitySubtitle: "१ (हल्का) से १० (अत्यधिक गंभीर / आपातकालीन) तक:",
    onsetLabel: "यह परेशानी कब शुरू हुई?",
    onsetToday: "आज शुरू हुआ (< 24 घंटे)",
    onsetDays: "2 से 3 दिन पहले",
    onsetWeek: "लगभग एक सप्ताह पहले",
    onsetMonths: "एक महीने से अधिक",

    // Step 7: Clarifying Questions
    clarifyTitle: "स्पष्टीकरण प्रश्न",
    clarifySubtitle: "आपके डॉक्टर को बेहतर समझने में मदद करने के लिए कुछ प्रश्न:",

    // Step 8: Confirmation & Summary
    confirmTitle: "अपने विवरण की समीक्षा करें",
    confirmSubtitle: "कृपया समीक्षा करें कि आपके डॉक्टर को क्या भेजा जाएगा:",
    chiefConcern: "मुख्य समस्या",
    location: "स्थान",
    character: "लक्षण प्रकार",
    severity: "तीव्रता",
    onset: "शुरुआत",
    associatedSymptoms: "संबंधित लक्षण",
    transcript: "आपके बोले गए शब्द",
    translation: "अंग्रेजी अनुवाद",
    safetyStatus: "सुरक्षा जांच",
    safetySafe: "सामान्य सेवन — कोई आपातकालीन लक्षण नहीं",
    safetyUrgent: "आपातकालीन चेतावनी: तत्काल चिकित्सक ध्यान आवश्यक",
    patientConfirmedBadge: "रोगी-पुष्ट",
    aiInferredBadge: "एआई-अनुमानित",

    // Transmitted View
    transmittedTitle: "विवरण डॉक्टर कमांड सेंटर में जमा हो गया है",
    transmittedSubtitle: "आपका विवरण डेटाबेस में सहेजा गया है और डॉक्टर के समीक्षा क्रम में जोड़ दिया गया है।",
    ticketLabel: "आपका कतार टोकन:",
    openDoctorBrief: "डॉक्टर का 60-सेकंड सारांश देखें →",
    startNew: "नया सेवन शुरू करें",
  },

  te: {
    // Header & Meta
    brandSubtitle: "మీ గొంతు. మీ లక్షణాలు. స్పష్టమైన వైద్య చిత్రం.",
    patientMode: "రోగి నమోదు మోడ్",
    clinicianMode: "వైద్యుల కమాండ్ మోడ్",
    diagnosticMode: "డయాగ్నొస్టిక్ మోడ్",
    accessibility: "యాక్సెసిబిలిటీ",
    selectLanguage: "భాషను ఎంచుకోండి",

    // Navigation Tabs
    navIntake: "1. రోగి నమోదు & 3D శరీరం",
    navScanner: "2. ప్రిస్క్రిప్షన్ & ల్యాబ్ స్కానర్",
    navDoctor: "3. వైద్యుల కమాండ్ సెంటర్",
    navDiagnostics: "సిస్టమ్ డయాగ్నొస్టిక్స్",

    // Steps
    stepLanguage: "1. భాష",
    stepPreferences: "2. ప్రాధాన్యతలు",
    stepConsent: "3. సమ్మతి",
    stepLocation: "4. శరీర ప్రాంతం",
    stepSensation: "5. లక్షణం",
    stepSeverity: "6. తీవ్రత",
    stepClarify: "7. వివరణ",
    stepConfirm: "8. నిర్ధారణ",

    // Common Actions
    next: "తదుపరి →",
    back: "← వెనుకకు",
    continue: "కొనసాగించండి →",
    confirmAndProceed: "నిర్ధారించి కొనసాగించండి →",
    submitIntake: "వైద్యునికి పంపండి →",
    submitting: "వివరాలు పంపబడుతున్నాయి...",
    retry: "మళ్ళీ ప్రయత్నించండి",
    cancel: "రద్దు చేయండి",
    save: "భద్రపరచండి",
    clear: "క్లియర్ చేయండి",

    // Step 1: Language
    langTitle: "మీ భాషను ఎంచుకోండి",
    langSubtitle: "మీకు సౌకర్యవంతంగా ఉండే భాషను ఎంచుకోండి:",
    listenGreeting: "🔊 శుభాకాంక్షలు వినండి",

    // Step 2: Preferences
    prefTitle: "యాక్సెసిబిలిటీ & ప్రాధాన్యతలు",
    prefSubtitle: "ప్రీకన్సల్ట్ AI ని ఎలా ఉపయోగించాలనుకుంటున్నారో ఎంచుకోండి:",
    modeNonSpeaking: "మాట్లాడలేని / స్పర్శ మోడ్",
    modeTremor: "మోటార్ అసిస్టెన్స్ / పెద్ద బటన్లు",
    modeStandard: "సాధారణ ఇంటరాక్టివ్ మోడ్",

    // Step 3: Consent
    consentTitle: "గోప్యత & రోగి సమ్మతి",
    consentSubtitle: "ప్రీకన్సల్ట్ AI మీ వైద్యునికి అవసరమైన సమాచారాన్ని సిద్ధం చేస్తుంది.",
    consentBody: "మీ వివరాలు సురక్షితంగా నిల్వ చేయబడతాయి మరియు మీ వైద్యుని డ్యాష్‌బోర్డ్‌కు మాత్రమే పంపబడతాయి. ఈ సిస్టమ్ రోగ నిర్ధారణ చేయదు; తుది వైద్య నిర్ణయం మీ వైద్యుడు మాత్రమే తీసుకుంటారు.",
    consentCheckbox: "నా లక్షణాలు మరియు చరిత్రను వైద్య బృందంతో పంచుకోవడానికి నేను అంగీకరిస్తున్నాను.",

    // Step 4: 3D Body Location
    bodyTitle: "మీరు ఎలా భావిస్తున్నారో తెలుసుకుందాం.",
    bodySubtitle: "3D శరీర నమూనాపై నొప్పి లేదా అసౌకర్యం ఉన్న భాగాన్ని తాకండి:",
    selectedArea: "ఎంచుకున్న భాగం:",
    selectedLocations: "ఎంచుకున్న ప్రాంతాలు",
    tellMeWhat: "🎙️ మీకు ఏమి జరుగుతుందో చెప్పండి →",
    frontView: "ముందు భాగం",
    backView: "వెనుక భాగం",
    resetView: "రీసెట్",
    zoomIn: "+ జూమ్ ఇన్",
    zoomOut: "- జూమ్ అవుట్",

    // Step 5: Sensation & Voice
    sensationTitle: "మీ లక్షణాలను వివరించండి",
    sensationSubtitle: "మీ భాషలో మాట్లాడండి లేదా కింద ఉన్న లక్షణాలను ఎంచుకోండి:",
    recordVoice: "🎙️ మాట్లాడి రికార్డ్ చేయండి",
    stopRecording: "⏹️ రికార్డింగ్ ఆపండి",
    recordingTimer: "రికార్డింగ్: ",
    transcribing: "ఆడియో విశ్లేషించి అనువదిస్తోంది...",
    voiceInstruction: "మీ స్వంత భాషలో స్వేచ్ఛగా మాట్లాడండి. ఎప్పుడు ప్రారంభమైంది, ఎంత నొప్పిగా ఉందో వివరించండి.",
    typeInstead: "రాతపూర్వకంగా నమోదు చేయండి",
    submitText: "విశ్లేషించండి",

    // Step 6: Severity & Onset
    severityTitle: "నొప్పి తీవ్రతను ఎంచుకోండి",
    severitySubtitle: "1 (తక్కువ) నుండి 10 (అత్యవసరం / తీవ్రం) వరకు:",
    onsetLabel: "ఈ సమస్య ఎప్పుడు ప్రారంభమైంది?",
    onsetToday: "ఈరోజే (< 24 గంటలు)",
    onsetDays: "2-3 రోజుల క్రితం",
    onsetWeek: "వారం క్రితం",
    onsetMonths: "నెల క్రితం (దీర్ఘకాలిక)",

    // Step 7: Clarifying Questions
    clarifyTitle: "వివరణాత్మక ప్రశ్నలు",
    clarifySubtitle: "మీ వైద్యునికి స్పష్టత కోసం కొన్ని శీఘ్ర ప్రశ్నలు:",

    // Step 8: Confirmation & Summary
    confirmTitle: "సారాంశాన్ని సమీక్షించండి",
    confirmSubtitle: "మీ వైద్యునికి పంపబడే సమాచారాన్ని సరిచూసుకోండి:",
    chiefConcern: "ప్రధాన సమస్య",
    location: "శరీర భాగం",
    character: "లక్షణం రకం",
    severity: "తీవ్రత",
    onset: "ప్రారంభం",
    associatedSymptoms: "ఇతర లక్షణాలు",
    transcript: "మీరు మాట్లాడిన మాటలు",
    translation: "ఆంగ్ల అనువాదం",
    safetyStatus: "భద్రతా తనిఖీ",
    safetySafe: "సాధారణ నమోదు — అత్యవసర సంకేతాలు లేవు",
    safetyUrgent: "అత్యవసర హెచ్చరిక: వెంటనే వైద్యుల శ్రద్ధ అవసరం",
    patientConfirmedBadge: "రోగి ధృవీకరించారు",
    aiInferredBadge: "AI అంచనా వేసింది",

    // Transmitted View
    transmittedTitle: "వివరాలు వైద్యుల కమాండ్ సెంటర్‌కు పంపబడ్డాయి",
    transmittedSubtitle: "మీ సమాచారం డేటాబేస్‌లో భద్రపరచబడింది మరియు సమీక్ష క్రమంలో ఉంది.",
    ticketLabel: "మీ టోకెన్ సంఖ్య:",
    openDoctorBrief: "వైద్యుల 60-సెకన్ల బ్రీఫ్ చూడండి →",
    startNew: "కొత్త నమోదు ప్రారంభించండి",
  },
};

export function t(lang, key, fallback = '') {
  const selectedDict = TRANSLATIONS[lang] || TRANSLATIONS.en;
  if (selectedDict && selectedDict[key]) {
    return selectedDict[key];
  }
  return TRANSLATIONS.en[key] || fallback || key;
}
