const fs = require('fs');
const file = 'src/components/home/InteractiveCoverageMap.tsx';
let txt = fs.readFileSync(file, 'utf8');

txt = txt.replace(/<Callout>/g, function(match, offset, str) {
  const chunk = str.substring(offset - 200, offset + 200);
  if (chunk.includes('member.latitude')) return `<Callout onPress={() => handleOpenDirections(member.latitude!, member.longitude!)}>`;
  if (chunk.includes('listing.latitude')) return `<Callout onPress={() => handleOpenDirections(listing.latitude!, listing.longitude!)}>`;
  if (chunk.includes('notice.latitude')) return `<Callout onPress={() => handleOpenDirections(notice.latitude!, notice.longitude!)}>`;
  if (chunk.includes('business.latitude')) return `<Callout onPress={() => handleOpenDirections(business.latitude!, business.longitude!)}>`;
  return match;
});

fs.writeFileSync(file, txt);
