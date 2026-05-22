const fs = require('fs');

function replaceBack(filePath, fallbackPath) {
  if (!fs.existsSync(filePath)) return;
  let txt = fs.readFileSync(filePath, 'utf8');
  
  const oldCode2 = `else router.back();`;
  const newCode2 = `else { if (router.canGoBack()) router.back(); else router.replace('${fallbackPath}'); }`;
  
  const oldCode3 = `router.back();`;
  const newCode3 = `if (router.canGoBack()) router.back(); else router.replace('${fallbackPath}');`;

  if(txt.includes(oldCode2)) {
      txt = txt.replace(oldCode2, newCode2);
  } else if (txt.includes(oldCode3)) {
      txt = txt.replace(/router\.back\(\);/g, newCode3);
  }
  
  fs.writeFileSync(filePath, txt);
}

replaceBack('src/components/posts/CreateNoticeForm.tsx', '/posts');
replaceBack('src/components/admin/AdminDashboard.tsx', '/');
replaceBack('src/components/admin/BenefitsPricingPage.tsx', '/admin');
replaceBack('src/components/admin/MockStripeCheckout.tsx', '/admin');

