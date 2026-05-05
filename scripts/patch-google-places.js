const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-google-places-autocomplete',
  'GooglePlacesAutocomplete.js'
);

if (!fs.existsSync(target)) {
  process.exit(0);
}

const source = fs.readFileSync(target, 'utf8');
let next = source;

next = next.replace(
  '  const requestRef = useRef(_request);',
  '  const requestRef = useRef(() => {});'
);

if (!next.includes('  const disableRowLoadersRef = useRef(() => {});')) {
  next = next.replace(
    "  const requestRef = useRef(() => {});\n  const queryString = useMemo(() => JSON.stringify(query), [query]);",
    "  const requestRef = useRef(() => {});\n  const disableRowLoadersRef = useRef(() => {});\n  const queryString = useMemo(() => JSON.stringify(query), [query]);"
  );
}

next = next.replaceAll('_disableRowLoaders();', 'disableRowLoadersRef.current();');

next = next.replace(
  "      onTimeout,\n      _disableRowLoaders,\n      nearbyPlacesAPI,",
  "      onTimeout,\n      nearbyPlacesAPI,"
);

next = next.replace(
  "    currentLocationLabel,\n    nearbyPlacesAPI,\n    _disableRowLoaders,\n    onPress,",
  "    currentLocationLabel,\n    nearbyPlacesAPI,\n    onPress,"
);

if (!next.includes('disableRowLoadersRef.current = _disableRowLoaders;')) {
  next = next.replace(
    "  const _onPress = (rowData) => {",
    "  disableRowLoadersRef.current = _disableRowLoaders;\n\n  const _onPress = (rowData) => {"
  );
}

if (next === source) {
  process.exit(0);
}

fs.writeFileSync(target, next);
console.log('[patch-google-places] Applied Google Places TDZ fixes.');