import type { note } from "@prisma/client";

export default function(note: note): boolean {
	return note.renoteId != null && (note.text != null || note.hasPoll || (note.fileIds != null && note.fileIds.length > 0));
}
