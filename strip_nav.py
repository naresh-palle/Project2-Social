import os
import re

auth_pages = [
    'Feed.jsx', 'SearchPage.jsx', 'Settings.jsx', 'PublicProfile.jsx',
    'ProfileEdit.jsx', 'Messages.jsx', 'Invitations.jsx', 'Wallet.jsx',
    'Marketplace.jsx', 'Leaderboard.jsx', 'Referrals.jsx', 'AdminPage.jsx',
    'NewCampaign.jsx', 'CampaignDetail.jsx', 'CreatorDetail.jsx', 'SupportCenter.jsx', 'HelpChat.jsx', 'Onboarding.jsx'
]

base_dir = r'frontend/src/pages'

for page in auth_pages:
    path = os.path.join(base_dir, page)
    if not os.path.exists(path): continue
    
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Remove imports
    content = re.sub(r'import\s+{\s*Nav\s*}\s+from\s+[\'"]@/components/Nav[\'"];?\n?', '', content)
    content = re.sub(r'import\s+{\s*ThemeToaster\s*}\s+from\s+[\'"]@/components/ThemeToaster[\'"];?\n?', '', content)
    
    # Remove components
    content = re.sub(r'<Nav\s*(?:variant=[\'"][^\'"]*[\'"])?\s*/>', '', content)
    content = re.sub(r'<ThemeToaster\s*/>', '', content)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
print('Done!')
