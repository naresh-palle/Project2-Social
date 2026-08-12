
import sys

with open("frontend/src/pages/Dashboard.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add imports
if "SocialConnect" not in content:
    imports_to_add = """
import { SocialConnect } from "@/components/SocialConnect";
import { SocialAnalyticsCards } from "@/components/SocialAnalyticsCards";
"""
    # find first import
    idx = content.find("import ")
    content = content[:idx] + imports_to_add + content[idx:]

# Find InfluencerPanel
influencer_def = "function InfluencerPanel() {"
panel_idx = content.find(influencer_def)
if panel_idx != -1:
    # insert sync state and function
    insert_idx = content.find("const [activeTab", panel_idx)
    sync_code = """
  const { refresh } = useAuth();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post("/oauth/sync");
      await refresh(); // refresh user data from /auth/me
    } catch (e) {
      console.error(e);
    }
    setSyncing(false);
  };
"""
    content = content[:insert_idx] + sync_code + content[insert_idx:]

    # insert the UI elements inside the main content area of InfluencerPanel
    # The InfluencerPanel returns a big div with <div className="space-y-8">
    ret_idx = content.find("return (", panel_idx)
    space_y_idx = content.find("<div className=\"space-y-8\">", ret_idx)
    if space_y_idx != -1:
        # insert after <div className="space-y-8">
        insert_ui_idx = space_y_idx + len("<div className=\"space-y-8\">")
        ui_code = """
        <SocialAnalyticsCards 
          connections={user?.oauth_connections || []} 
          onSync={handleSync} 
          isSyncing={syncing} 
        />
        
        <SocialConnect 
          connectedPlatforms={(user?.oauth_connections || []).map(c => c.platform)} 
        />
"""
        content = content[:insert_ui_idx] + ui_code + content[insert_ui_idx:]
    else:
        print("COULD NOT FIND space-y-8 in InfluencerPanel")
else:
    print("InfluencerPanel NOT FOUND")

with open("frontend/src/pages/Dashboard.jsx", "w", encoding="utf-8") as f:
    f.write(content)
print("SUCCESS")

