import { error } from '@sveltejs/kit';
import { collections } from '$lib/server/database';
import type { Challenge } from '$lib/types/Challenge';

export const load = async () => {
	const challenges = await collections.challenges
		.find({})
		.project<Pick<Challenge, '_id' | 'name'>>({ _id: 1, name: 1 })
		.toArray();
	if (!challenges) {
		throw error(404, 'Resource not found');
	}

	return {
		challenges
	};
};
