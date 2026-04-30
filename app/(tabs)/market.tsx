import { useLocalSearchParams } from 'expo-router';

export default function MarketRoute() {
	const params = useLocalSearchParams();
	const listingId = typeof params.listingId === 'string' ? params.listingId : undefined;
	const MarketPage = require('../../src/components/market/MarketPage').default;
	return <MarketPage initialListingId={listingId} />;
}
