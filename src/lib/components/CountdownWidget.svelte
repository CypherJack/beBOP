<script lang="ts">
	import type { Countdown } from '$lib/types/Countdown';
	import { addHours, differenceInMilliseconds } from 'date-fns';
	import { onMount } from 'svelte';

	let className = '';
	export { className as class };
	export let countdown: Pick<Countdown, '_id' | 'title' | 'description' | 'endsAt'>;
	const timezoneOffsetHours = new Date().getTimezoneOffset() / 60;
	let endsAt = addHours(countdown.endsAt, timezoneOffsetHours);
	$: distance = differenceInMilliseconds(endsAt, new Date());
	function updateCountdown() {
		distance = Math.max(differenceInMilliseconds(endsAt, new Date()), 0);
	}
	onMount(() => {
		const interval = setInterval(updateCountdown, 1000);
		return () => clearInterval(interval);
	});
</script>

<div class="flex flex-row gap-4 {className}">
	<div class="flex flex-row w-full tagWidget tagWidget-main grow pr-5">
		<div class="p-4 grow">
			<h2 class="text-2xl font-bold mb-2 body-title">
				{countdown.title}
			</h2>

			<p class="mb-4">{countdown.description}</p>
		</div>

		<div class="grow-[2] flex flex-row gap-6 p-4">
			{#each ['DAYS', 'HOURS', 'MINS', 'SECS'] as unit (unit)}
				<div class="flex flex-col">
					<span class="text-3xl font-bold body-title">
						{Math.floor(
							unit === 'DAYS'
								? distance / (1000 * 60 * 60 * 24)
								: unit === 'HOURS'
								? (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
								: unit === 'MINS'
								? (distance % (1000 * 60 * 60)) / (1000 * 60)
								: (distance % (1000 * 60)) / 1000
						)}
					</span>
					{unit}
				</div>
			{/each}
		</div>
	</div>
</div>
