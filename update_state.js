const fs = require('fs');
const file = 'src/components/home/InteractiveCoverageMap.tsx';
let txt = fs.readFileSync(file, 'utf8');

const anchor = "const [mapFilter, setMapFilter] = useState<MapFilter>(initialFilter || 'members');";
const replacement = `const [mapFilter, setMapFilter] = useState<MapFilter>(initialFilter || 'members');
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const handleOpenDirections = (lat: number, lng: number) => {
    const url = \`https://www.google.com/maps/dir/?api=1&destination=\${lat},\${lng}\`;
    Linking.openURL(url);
  };`;

txt = txt.replace(anchor, replacement);
fs.writeFileSync(file, txt);
