import { useLocalSearchParams } from 'expo-router';

export default function PostsRoute() {
	const params = useLocalSearchParams();
	const noticeId = typeof params.noticeId === 'string' ? params.noticeId : undefined;
	const PostsPage = require('../../src/components/posts/PostsPage').default;
	return <PostsPage initialNoticeId={noticeId} />;
}
