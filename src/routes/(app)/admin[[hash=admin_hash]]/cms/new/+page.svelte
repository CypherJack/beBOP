<script lang="ts">
	import CmsForm from '$lib/components/CmsForm.svelte';
	import { page } from '$app/stores';

	let pageId = $page.url.searchParams.get('id') || null;
</script>

<h1 class="text-3xl">Add a CMS Page</h1>

<form method="post" class="flex flex-col gap-4">
	<CmsForm cmsPage={null} slug={pageId || ''} />
</form>
