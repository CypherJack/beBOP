import { collections } from '$lib/server/database';
import { pojo } from '$lib/server/pojo.js';
import { error } from '@sveltejs/kit';

export const load = async ({ params }) => {
	const product = await collections.products.findOne({ _id: params.id });

	if (!product) {
		throw error(404, 'Product not found');
	}
	return { product: pojo(product) };
};
