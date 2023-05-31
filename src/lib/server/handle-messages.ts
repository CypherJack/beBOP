import { ObjectId, type ChangeStreamDocument } from 'mongodb';
import { collections } from './database';
import { Lock } from './lock';
import type { NostRReceivedMessage } from '$lib/types/NostRReceivedMessage';
import { Kind } from 'nostr-tools';
import { ORIGIN } from '$env/static/private';
import { runtimeConfig } from './runtime-config';
import { toSatoshis } from '$lib/utils/toSatoshis';
import { addSeconds } from 'date-fns';

const lock = new Lock('received-messages');

// todo: resume changestream on restart if possible
collections.nostrReceivedMessages
	.watch([{ $match: { operationType: 'insert' } }], {
		fullDocument: 'updateLookup'
	})
	.on('change', (ev) => handleChanges(ev).catch(console.error));

async function handleChanges(change: ChangeStreamDocument<NostRReceivedMessage>): Promise<void> {
	if (!lock.ownsLock || !('fullDocument' in change) || !change.fullDocument) {
		return;
	}

	if (change.fullDocument.processedAt) {
		return;
	}

	const content = change.fullDocument.content;
	const senderNpub = change.fullDocument.source;
	const minCreatedAt = addSeconds(change.fullDocument.createdAt, 1);

	const isCustomer =
		(await collections.nostrNotifications.countDocuments({ dest: senderNpub }, { limit: 1 })) > 0;
	const isPrivateMessage = change.fullDocument.kind === Kind.EncryptedDirectMessage;

	const send = (message: string) => sendMessage(senderNpub, message, minCreatedAt);

	switch (content.trim().replaceAll(/\s+/g, ' ')) {
		case 'help':
			await send(
				`Commands:

- orders: Show the list of orders associated to your npub
- catalog: Show the catalog
- detailed catalog: Show the catalog, with product descriptions
- subscribe: Subscribe to catalog updates
- unsubscribe: Unsubscribe from catalog updates`
			);
			break;
		case 'orders': {
			const orders = await collections.orders
				.find({ 'notifications.paymentStatus.npub': senderNpub })
				.sort({ createdAt: -1 })
				.limit(100)
				.toArray();

			if (orders.length) {
				await send(
					orders.map((order) => `- #${order.number}: ${ORIGIN}/order/${order._id}`).join('\n')
				);
			} else {
				await send('No orders found for your npub');
			}

			break;
		}
		case 'detailed catalog':
		case 'catalog': {
			if (!runtimeConfig.discovery) {
				await send('Discovery is not enabled for this bootik. You cannot access the catalog.');
			} else {
				const products = await collections.products.find({}).toArray();

				if (!products.length) {
					await sendMessage(senderNpub, 'Catalog is empty', minCreatedAt);
				} else {
					// todo: proper price dependinc on currency
					await send(
						products
							.map(
								(product) =>
									`- ${product.name} / ${toSatoshis(
										product.price.amount,
										product.price.currency,
										runtimeConfig.BTC_EUR
									)} SAT / ${ORIGIN}/product/${product._id}${
										content === 'detailed catalog'
											? ` / ${product.shortDescription.replaceAll(/\s+/g, ' ')}`
											: ''
									}`
							)
							.join('\n')
					);
				}
			}
			break;
		}
		case 'subscribe':
			if (!runtimeConfig.discovery) {
				await send('Discovery is not enabled for the bootik, you cannot subscribe');
			} else {
				await collections.subscriptions.updateOne(
					{ npub: senderNpub },
					{
						$set: {
							updatedAt: new Date()
						},
						$setOnInsert: {
							createdAt: new Date()
						}
					},
					{ upsert: true }
				);
				await send(
					'You are subscribed to the catalog, you will receive messages when new products are added'
				);
			}
			break;
		case 'unsubscribe': {
			const result = await collections.subscriptions.deleteOne({ npub: senderNpub });

			if (result.deletedCount) {
				await send('You were unsubscribed from the catalog');
			} else {
				await send('You were already unsubscribed from the catalog');
			}
			break;
		}
		default:
			await send(
				`Hello ${
					!isPrivateMessage ? 'world' : isCustomer ? 'customer' : 'you'
				}! To get the list of commands, say 'help'.`
			);
	}
	await collections.nostrReceivedMessages.updateOne(
		{ _id: change.fullDocument._id },
		{ $set: { processedAt: new Date(), updatedAt: new Date() } }
	);
}

function sendMessage(dest: string, content: string, minCreatedAt: Date) {
	return collections.nostrNotifications.insertOne({
		dest,
		_id: new ObjectId(),
		createdAt: new Date(),
		updatedAt: new Date(),
		minCreatedAt,
		content
	});
}
