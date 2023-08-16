<template>
<!-- eslint-disable vue/no-mutating-props -->
<XContainer :draggable="true" @remove="() => $emit('remove')">
	<template #header><i class="ti ti-note"></i> {{ i18n.ts._pages.blocks.note }}</template>

	<section style="padding: 0 16px 0 16px;">
		<MkInput v-model="id">
			<template #label>{{ i18n.ts._pages.blocks._note.id }}</template>
			<template #caption>{{ i18n.ts._pages.blocks._note.idDescription }}</template>
		</MkInput>
		<MkSwitch v-model="props.modelValue.detailed"><span>{{ i18n.ts._pages.blocks._note.detailed }}</span></MkSwitch>

		<MkNote v-if="note && !props.modelValue.detailed" :key="note.id + ':normal'" v-model:note="note" style="margin-bottom: 16px;"/>
		<MkNoteDetailed v-if="note && props.modelValue.detailed" :key="note.id + ':detail'" v-model:note="note" style="margin-bottom: 16px;"/>
	</section>
</XContainer>
</template>

<script lang="ts" setup>
/* eslint-disable vue/no-mutating-props */
import { watch } from 'vue';
import XContainer from '../page-editor.container.vue';
import type { Note } from 'misskey-js/built/entities';
import type { PageBlock } from '../page-editor.vue';
import MkInput from '@/components/MkInput.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkNote from '@/components/MkNote.vue';
import MkNoteDetailed from '@/components/MkNoteDetailed.vue';
import * as os from '@/os';
import { i18n } from '@/i18n';

const props = defineProps<{
	modelValue: PageBlock;
}>();

const emit = defineEmits<{
	(ev: 'update:modelValue', value: unknown): void;
}>();

let id = $ref<string | undefined>(props.modelValue.note);
let note = $ref<Note | null>(null);

watch($$(id), async () => {
	if (id && (id.startsWith('http://') || id.startsWith('https://'))) {
		id = (id.endsWith('/') ? id.slice(0, -1) : id).split('/').pop();
	}

	emit('update:modelValue', {
		...props.modelValue,
		note: id,
	});
	note = await os.api('notes/show', { noteId: id });
}, {
	immediate: true,
});
</script>
