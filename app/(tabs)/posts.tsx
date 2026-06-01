import { useLocalSearchParams } from 'expo-router';
import PostsPage from '../../src/components/posts/PostsPage';

export default function PostsRoute() {
	const params = useLocalSearchParams();
	const noticeId = typeof params.noticeId === 'string' ? params.noticeId : undefined;
	return <PostsPage initialNoticeId={noticeId} />;
}
