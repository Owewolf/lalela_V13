const fs = require('fs');
const file = 'src/components/home/InteractiveCoverageMap.tsx';
let txt = fs.readFileSync(file, 'utf8');

// 1. Add custom state
const stateAnchor = "const [mapFilter, setMapFilter] = useState<MapFilter>(initialFilter || 'members');";
const stateReplacement = `const [mapFilter, setMapFilter] = useState<MapFilter>(initialFilter || 'members');
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const handleOpenDirections = (lat: number, lng: number) => {
    const url = \`https://www.google.com/maps/dir/?api=1&destination=\${lat},\${lng}\`;
    Linking.openURL(url);
  };`;
txt = txt.replace(stateAnchor, stateReplacement);

// 2. MapView onPress
const mapPressAnchor = `          onPress={() => {
            if (isLocked) onUnlock?.();
          }}`;
const mapPressReplacement = `          onPress={() => {
            if (isLocked) onUnlock?.();
            setSelectedLocation(null);
          }}`;
txt = txt.replace(mapPressAnchor, mapPressReplacement);

// 3. Create a wrapper component mapping over all callout views to add "Get Directions" text inside the popup
// Actually, it's easier to just rewrite the render function entirely for safety, or we can just replace `<Callout>` children.
// Let's add the Web toolbar before `</View>` (the very last closing tag in `return ( ... )` of component)

const webToolbar = `
      {/* Universal Floating Navigation Button (Required for Web, Fallback/Enhancement for all) */}
      {selectedLocation && (
        <View className="absolute bottom-6 right-4 shadow-xl z-50">
          <TouchableOpacity 
            className="flex-row items-center space-x-2 bg-blue-600 px-4 py-3 rounded-full shadow-lg border border-blue-500"
            onPress={() => handleOpenDirections(selectedLocation.latitude, selectedLocation.longitude)}
            activeOpacity={0.8}
          >
            <MapPin size={18} color="white" />
            <Text className="text-white font-bold text-sm ml-2 tracking-wide">Navigate</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};`;
txt = txt.replace("    </View>\n  );\n};", webToolbar);

fs.writeFileSync(file, txt);
