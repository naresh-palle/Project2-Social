import asyncio
import os
import sys

# Read and parse .env manually to avoid null byte issues
token = None
try:
    with open('backend/.env', 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            line = line.replace('\x00', '').strip()
            if line.startswith('APIFY_TOKEN='):
                token = line.split('=', 1)[1].strip('"\'')
                break
except Exception as e:
    print('Error reading .env:', e)

from apify_client import ApifyClientAsync

async def test_apify():
    if not token:
        print('NO APIFY_TOKEN FOUND')
        return
    client = ApifyClientAsync(token)
    actor_id = 'apify~instagram-scraper'
    handle = 'ramuluputranaresh'
    payload = {'addParentData': False, 'directUrls': [f'https://instagram.com/{handle}'], 'resultsLimit': 1}
    print(f'Starting actor {actor_id} for {handle}...')
    try:
        run = await client.actor(actor_id).call(run_input=payload)
        dataset_id = run.get('defaultDatasetId')
        if not dataset_id:
            print('No dataset returned')
            return
        items = (await client.dataset(dataset_id).list_items()).items
        print('RESULT:', len(items), 'items returned.')
        if items:
            item = items[0]
            print('Followers:', item.get('followersCount'))
            print('Posts:', item.get('postsCount'))
            print('Username:', item.get('username'))
            print('Full Name:', item.get('fullName'))
            if item.get('error'):
                print('Error inside item:', item.get('error'))
    except Exception as e:
        print('ERROR:', str(e))

asyncio.run(test_apify())
