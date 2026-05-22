const fs = require('fs');

function replaceBack(filePath, fallbackPath) {
  if (!fs.existsSync(filePath)) return;
  let txt = fs.readFileSync(filePath, 'utf8');
  
  const oldCode = `onPress={() => router.back()}`;
  const newCode = `onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('${fallbackPath}');
            }
          }}`;
          
  const oldCode2 = `router.back();`;
  const newCode2 = `if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('${fallbackPath}');
    }`;

  // For places that use onPress={() => router.back()}
  if(txt.includes(oldCode)) {
      txt = txt.replace(oldCode, newCode);
  }
  
  fs.writeFileSync(filePath, txt);
}

replaceBack('src/components/security/AccountSecurityPage.tsx', '/settings');
replaceBack('src/components/settings/NotificationSettingsPage.tsx', '/settings');
replaceBack('src/components/emergency/EmergencyHub.tsx', '/');
replaceBack('src/components/chat/ChatDetailPage.tsx', '/chat');
replaceBack('src/components/shared/Header.tsx', '/');

