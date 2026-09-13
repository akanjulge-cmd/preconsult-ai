import urllib.request
import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
lines = [
    '--' + boundary,
    'Content-Disposition: form-data; name="audio"; filename="test_voice.webm"',
    'Content-Type: audio/webm',
    '',
    'fake_audio_stream_data_test_12345678',
    '--' + boundary,
    'Content-Disposition: form-data; name="language"',
    '',
    'en',
    '--' + boundary,
    'Content-Disposition: form-data; name="body_region"',
    '',
    'right_upper_abdomen',
    '--' + boundary + '--',
    ''
]
body = '\r\n'.join(lines).encode('utf-8')

req = urllib.request.Request(
    'http://127.0.0.1:8000/api/intake/SES-TEST-UPLOAD/voice/upload',
    data=body,
    headers={'Content-Type': 'multipart/form-data; boundary=' + boundary}
)

with urllib.request.urlopen(req) as resp:
    print('STATUS:', resp.status)
    data = json.loads(resp.read().decode('utf-8'))
    print('TRANSCRIPT:', data.get('voice_transcript'))
    print('AUDIO_URL:', data.get('audio_url'))
    print('EXTRACTED:', data.get('extracted_data', {}).get('character'), data.get('extracted_data', {}).get('severity'))
    print('SAFETY:', data.get('safety_result'))

    # Verify audio retrieval endpoint
    audio_url = data.get('audio_url')
    if audio_url:
        audio_req = urllib.request.Request(f'http://127.0.0.1:8000{audio_url}')
        with urllib.request.urlopen(audio_req) as aresp:
            print('AUDIO SERVE STATUS:', aresp.status, 'BYTES:', len(aresp.read()))

    print("\n--- Testing Telugu Multilingual Upload ---")
    te_lines = [
        '--' + boundary,
        'Content-Disposition: form-data; name="audio"; filename="telugu.webm"',
        'Content-Type: audio/webm',
        '',
        'telugu_audio_data_123',
        '--' + boundary,
        'Content-Disposition: form-data; name="language"',
        '',
        'te',
        '--' + boundary,
        'Content-Disposition: form-data; name="client_transcript"',
        '',
        'పొట్ట కుడి వైపు మంటగా నొప్పిగా ఉంది. పొద్దున్నుంచి మొదలైంది.',
        '--' + boundary + '--',
        ''
    ]
    te_body = '\r\n'.join(te_lines).encode('utf-8')
    te_req = urllib.request.Request(
        'http://127.0.0.1:8000/api/intake/SES-TELUGU-01/voice/upload',
        data=te_body,
        headers={'Content-Type': 'multipart/form-data; boundary=' + boundary}
    )
    with urllib.request.urlopen(te_req) as resp:
        te_data = json.loads(resp.read().decode('utf-8'))
        print('ORIGINAL PATIENT SAID:', te_data.get('voice_transcript'))
        print('TRANSLATED INTERPRETATION:', te_data.get('translated_text'))
        print('EXTRACTED SYMPTOM & SEVERITY:', te_data.get('extracted_data', {}).get('character'), te_data.get('extracted_data', {}).get('severity'))
