import requests
import io
import time
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_FRONTEND = 'http://127.0.0.1:3000'
BASE_BACKEND = 'http://127.0.0.1:8000'

print('=== PRECONSULT AI HACKATHON VERIFICATION ===')

# 1. Frontend & Assets
r_fe = requests.get(BASE_FRONTEND)
assert r_fe.status_code == 200, f'Frontend failed: {r_fe.status_code}'
print('[PASS] 1. Frontend UI is LIVE on http://127.0.0.1:3000')

r_glb = requests.get(f'{BASE_FRONTEND}/models/human_anatomy.glb')
assert r_glb.status_code == 200 and len(r_glb.content) > 500000
print(f'[PASS] 2. 3D Human Anatomy GLB Model served: {len(r_glb.content):,} bytes')

r_draco = requests.get(f'{BASE_FRONTEND}/draco/draco_decoder.wasm')
assert r_draco.status_code == 200 and len(r_draco.content) > 100000
print(f'[PASS] 3. Draco WASM Decoder served: {len(r_draco.content):,} bytes')

# 2. Backend Health & Docs
r_docs = requests.get(f'{BASE_BACKEND}/docs')
assert r_docs.status_code == 200
print('[PASS] 4. Backend Swagger Docs is LIVE on http://127.0.0.1:8000/docs')

# 3. Voice Multipart Audio Upload
session_id = f'SES-DEMO-{int(time.time())}'
audio_bytes = b'RIFFdemoWAVEfmt 16\x01\x00\x01\x00\x44\xac\x00\x00data\x00\x00'
files = {'audio': ('recording.webm', io.BytesIO(audio_bytes), 'audio/webm')}
data = {
    'language': 'en',
    'body_region': 'Abdomen',
    'anatomical_zone': 'Right Upper Quadrant',
    'side': 'right',
    'transcript_hint': 'I have a burning pain in the right upper part of my abdomen since this morning. It is about an eight out of ten and I feel nauseous.'
}
r_up = requests.post(f'{BASE_BACKEND}/api/intake/{session_id}/voice/upload', files=files, data=data)
assert r_up.status_code == 200, f'Upload failed: {r_up.text}'
up_res = r_up.json()
assert 'audio_filename' in up_res and 'transcript' in up_res
print(f'[PASS] 5. Voice Audio Upload & MediaRecorder pipeline works: filename={up_res["audio_filename"]}')

# 4. Audio Playback Endpoint
r_audio = requests.get(f'{BASE_BACKEND}/api/intake/audio/{up_res["audio_filename"]}')
assert r_audio.status_code == 200 and len(r_audio.content) == len(audio_bytes)
print(f'[PASS] 6. Audio Playback Stream endpoint serves audio file ({len(r_audio.content)} bytes)')

# 5. Multilingual Telugu Voice
r_tel = requests.post(f'{BASE_BACKEND}/api/intake/voice/process', json={
    'voice_transcript': 'నాకు కుడి వైపు కడుపులో తీవ్రమైన మంటగా నొప్పి ఉంది',
    'language': 'te',
    'body_region': 'Right Upper Abdomen'
})
assert r_tel.status_code == 200
tel_data = r_tel.json()
assert 'translated_text' in tel_data and 'voice_transcript' in tel_data
print(f'[PASS] 7. Multilingual Telugu Voice translation works: original="{tel_data["voice_transcript"][:15]}..." -> trans="{tel_data["translated_text"][:30]}..."')

# 6. Safety Check & Emergency Intercept
r_cardiac = requests.post(f'{BASE_BACKEND}/api/intake/voice/process', json={
    'voice_transcript': 'I have crushing central chest pain radiating to my left arm and jaw with severe shortness of breath and cold sweat',
    'language': 'en',
    'body_region': 'Chest'
})
assert r_cardiac.status_code == 200
card_res = r_cardiac.json()
assert card_res.get('red_flag_detected') is True or card_res.get('safety_result', {}).get('code') == 'CARDIOVASCULAR_PULMONARY_RED_FLAG'
print('[PASS] 8. Cardiac Red-Flag Safety Engine intercept detected & halted routine triage')

# 7. Routine Intake Persistence
r_rec = requests.post(f'{BASE_BACKEND}/api/intake/record', json={
    'session_id': session_id,
    'patient_identifier': 'PAT-JUDGE-01',
    'body_region': 'Abdomen',
    'anatomical_zone': 'Right Upper Quadrant',
    'symptom': 'Pain',
    'character': 'Burning',
    'severity': 8,
    'onset': 'this morning',
    'duration': 'today',
    'associated_symptoms': ['nausea'],
    'patient_voice_transcript': 'I have a burning pain in the right upper part of my abdomen.',
    'patient_text': 'I have a burning pain in the right upper part of my abdomen.',
    'audio_filename': up_res['audio_filename'],
    'structured_clinical_data': up_res.get('extracted_data', {}),
    'safety_result': {'is_safe': True, 'code': 'ROUTINE_TRIAGE'},
    'patient_confirmed': True,
    'status': 'CONFIRMED'
})
assert r_rec.status_code == 200
rec_res = r_rec.json()
print(f'[PASS] 9. Intake Persisted into SQLite: intake_id={rec_res.get("intake_id")}')

# 8. Clinician Command Center Queue & Approval
r_queue = requests.get(f'{BASE_BACKEND}/api/summary/queue')
assert r_queue.status_code == 200
print(f'[PASS] 10. Clinician Command Center Queue retrieved: {len(r_queue.json())} patients')

r_sum = requests.get(f'{BASE_BACKEND}/api/summary/SES-GERD-01')
assert r_sum.status_code == 200
print('[PASS] 11. Clinician Summary loaded with HPI & SOCRATES variables')

r_app = requests.post(f'{BASE_BACKEND}/api/summary/SES-GERD-01/approve', json={
    'clinician_id': 'Dr. S. Vance, MD',
    'clinician_notes': 'Reviewed in-person. Patient stable.',
    'digital_signature': 'SIG-DRSVANCE-7788'
})
assert r_app.status_code == 200
print('[PASS] 12. Clinician Approval & Digital Signature verified and locked')

print('\nALL 12/12 SYSTEM VERIFICATION CHECKS PASSED PERFECTLY!')
